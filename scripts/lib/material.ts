/**
 * Normalisation of VS Code file icon theme documents (Material Icon Theme manifests, Datapack Icons)
 * into the SECTION format of resources/data/<theme>.php (see SPEC §3.1), mirroring how VS Code consumes them
 * (src/vs/workbench/services/themes/browser/fileIconThemeData.ts + getIconClasses.ts).
 */
import type { Manifest } from 'material-icon-theme';
import { type PhpValue, strcmp } from './php';

export type Flat = Map<string, string>;
export type Nested = Map<string, Map<string, string>>;

export interface Section {
    fileNames: Flat;
    fileNamesByParent: Nested;
    fileExtensions: Flat;
    fileExtensionsByParent: Nested;
    languageIds: Flat;
    folderNames: Flat;
    folderNamesByParent: Nested;
}

export type FlatOverride = Map<string, string | null>;
export type NestedOverride = Map<string, Map<string, string | null>>;

export interface SectionOverride {
    fileNames: FlatOverride;
    fileNamesByParent: NestedOverride;
    fileExtensions: FlatOverride;
    fileExtensionsByParent: NestedOverride;
    languageIds: FlatOverride;
    folderNames: FlatOverride;
    folderNamesByParent: NestedOverride;
}

export const FLAT_KEYS = ['fileNames', 'fileExtensions', 'languageIds', 'folderNames'] as const;
export const NESTED_KEYS = ['fileNamesByParent', 'fileExtensionsByParent', 'folderNamesByParent'] as const;
/** Output order of the sub-arrays (SPEC §3.1). */
export const SECTION_KEYS = [
    'fileNames',
    'fileNamesByParent',
    'fileExtensions',
    'fileExtensionsByParent',
    'languageIds',
    'folderNames',
    'folderNamesByParent',
] as const;

export interface NormalizeStats {
    /** 'parent/name' keys whose parent contains '/' (or is empty / has an empty name): no VS Code class can match them. */
    dropped: string[];
}

/**
 * `handleParentFolder(key.toLowerCase())`: split at the LAST '/'. getIconClasses only ever emits
 * one non-empty parent segment and a non-empty name, so other shapes are unreachable.
 */
function splitKeyed(
    label: string,
    source: Record<string, string> | undefined,
    lower: boolean,
    flat: Flat,
    nested: Nested | null,
    stats: NormalizeStats,
): void {
    const seen = new Map<string, string>();
    for (const [rawKey, icon] of Object.entries(source ?? {})) {
        if (typeof icon !== 'string' || icon === '') {
            throw new Error(`${label}[${rawKey}]: unexpected value ${JSON.stringify(icon)}`);
        }
        const key = lower ? rawKey.toLowerCase() : rawKey;
        const previous = seen.get(key);
        if (previous !== undefined) {
            throw new Error(`${label}: keys ${JSON.stringify(previous)} and ${JSON.stringify(rawKey)} collide after lower-casing`);
        }
        seen.set(key, rawKey);
        const slash = nested ? key.lastIndexOf('/') : -1;
        if (slash < 0) {
            flat.set(key, icon);
            continue;
        }
        const parent = key.slice(0, slash);
        const name = key.slice(slash + 1);
        if (parent === '' || name === '' || parent.includes('/')) {
            stats.dropped.push(`${label}[${rawKey}]`);
            continue;
        }
        let group = nested!.get(parent);
        if (!group) {
            group = new Map();
            nested!.set(parent, group);
        }
        group.set(name, icon);
    }
}

const sortFlat = <V>(m: Map<string, V>) => new Map([...m].sort(([a], [b]) => strcmp(a, b)));
const sortNested = <V>(m: Map<string, Map<string, V>>) =>
    new Map([...m].sort(([a], [b]) => strcmp(a, b)).map(([k, v]) => [k, sortFlat(v)] as const));

/** Dark-theme SECTION of one generated manifest (light/highContrast are derived at runtime). */
export function normalizeSection(manifest: Manifest, label: string, stats: NormalizeStats): Section {
    const s: Section = {
        fileNames: new Map(),
        fileNamesByParent: new Map(),
        fileExtensions: new Map(),
        fileExtensionsByParent: new Map(),
        languageIds: new Map(),
        folderNames: new Map(),
        folderNamesByParent: new Map(),
    };
    splitKeyed(`${label}.fileNames`, manifest.fileNames, true, s.fileNames, s.fileNamesByParent, stats);
    splitKeyed(`${label}.fileExtensions`, manifest.fileExtensions, true, s.fileExtensions, s.fileExtensionsByParent, stats);
    splitKeyed(`${label}.folderNames`, manifest.folderNames, true, s.folderNames, s.folderNamesByParent, stats);
    // language ids keep their case (classSelectorPart(languageId) is not lower-cased)
    splitKeyed(`${label}.languageIds`, manifest.languageIds, false, s.languageIds, null, stats);
    // fileIconThemeData.ts: if (!languageIds.jsonc && languageIds.json) languageIds.jsonc = languageIds.json
    const json = s.languageIds.get('json');
    if (!s.languageIds.get('jsonc') && json) {
        s.languageIds.set('jsonc', json);
    }
    return {
        fileNames: sortFlat(s.fileNames),
        fileNamesByParent: sortNested(s.fileNamesByParent),
        fileExtensions: sortFlat(s.fileExtensions),
        fileExtensionsByParent: sortNested(s.fileExtensionsByParent),
        languageIds: sortFlat(s.languageIds),
        folderNames: sortFlat(s.folderNames),
        folderNamesByParent: sortNested(s.folderNamesByParent),
    };
}

function diffFlat(base: Flat, pack: Flat): FlatOverride {
    const out: FlatOverride = new Map();
    for (const [k, v] of pack) {
        if (base.get(k) !== v) {
            out.set(k, v);
        }
    }
    for (const k of base.keys()) {
        if (!pack.has(k)) {
            out.set(k, null);
        }
    }
    return sortFlat(out);
}

function diffNested(base: Nested, pack: Nested): NestedOverride {
    const out: NestedOverride = new Map();
    for (const parent of new Set([...base.keys(), ...pack.keys()])) {
        const d = diffFlat(base.get(parent) ?? new Map(), pack.get(parent) ?? new Map());
        if (d.size) {
            out.set(parent, d);
        }
    }
    return sortNested(out);
}

/** `pack` minus `base`: changed/new keys => value, keys missing in `pack` => null (nested maps per inner key). */
export function diffSection(base: Section, pack: Section): SectionOverride {
    return {
        fileNames: diffFlat(base.fileNames, pack.fileNames),
        fileNamesByParent: diffNested(base.fileNamesByParent, pack.fileNamesByParent),
        fileExtensions: diffFlat(base.fileExtensions, pack.fileExtensions),
        fileExtensionsByParent: diffNested(base.fileExtensionsByParent, pack.fileExtensionsByParent),
        languageIds: diffFlat(base.languageIds, pack.languageIds),
        folderNames: diffFlat(base.folderNames, pack.folderNames),
        folderNamesByParent: diffNested(base.folderNamesByParent, pack.folderNamesByParent),
    };
}

/** Inverse of {@link diffSection}, used to self-check the overrides. */
export function applyOverride(base: Section, o: SectionOverride): Section {
    const flat = (b: Flat, d: FlatOverride): Flat => {
        const m = new Map(b);
        for (const [k, v] of d) {
            if (v === null) {
                m.delete(k);
            } else {
                m.set(k, v);
            }
        }
        return sortFlat(m);
    };
    const nested = (b: Nested, d: NestedOverride): Nested => {
        const m: Nested = new Map([...b].map(([k, v]) => [k, new Map(v)]));
        for (const [parent, inner] of d) {
            const merged = flat(m.get(parent) ?? new Map(), inner);
            if (merged.size) {
                m.set(parent, merged);
            } else {
                m.delete(parent);
            }
        }
        return sortNested(m);
    };
    return {
        fileNames: flat(base.fileNames, o.fileNames),
        fileNamesByParent: nested(base.fileNamesByParent, o.fileNamesByParent),
        fileExtensions: flat(base.fileExtensions, o.fileExtensions),
        fileExtensionsByParent: nested(base.fileExtensionsByParent, o.fileExtensionsByParent),
        languageIds: flat(base.languageIds, o.languageIds),
        folderNames: flat(base.folderNames, o.folderNames),
        folderNamesByParent: nested(base.folderNamesByParent, o.folderNamesByParent),
    };
}

export function sectionEquals(a: Section, b: Section): boolean {
    return sectionFingerprint(a) === sectionFingerprint(b);
}

/** Every icon id a SECTION (or override) references. */
export function sectionIcons(s: Section | SectionOverride): Set<string> {
    const out = new Set<string>();
    for (const k of FLAT_KEYS) {
        for (const v of s[k].values()) {
            if (v !== null) {
                out.add(v);
            }
        }
    }
    for (const k of NESTED_KEYS) {
        for (const inner of s[k].values()) {
            for (const v of inner.values()) {
                if (v !== null) {
                    out.add(v);
                }
            }
        }
    }
    return out;
}

export function sectionToPhp(s: Section | SectionOverride): Map<string, PhpValue> {
    const out = new Map<string, PhpValue>();
    for (const k of SECTION_KEYS) {
        out.set(k, s[k] as Map<string, PhpValue>);
    }
    return out;
}

/** Stable text form for comparisons (Maps keep insertion order, which is strcmp-sorted). */
function sectionFingerprint(s: Section | SectionOverride): string {
    return JSON.stringify(SECTION_KEYS.map((k) => [...s[k]].map(([key, v]) => [key, v instanceof Map ? [...v] : v])));
}
