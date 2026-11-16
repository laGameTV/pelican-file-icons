/**
 * Datapack Icons (VS Code extension `SuperAnt.mc-dp-icons`, github.com/FuncFusion/mc-dp-icons):
 * reading its icon theme document from the VSIX and turning it into the same SECTION format as the
 * Material Icon Theme data (see scripts/lib/material.ts).
 *
 * The theme is a static VS Code file icon theme (`extension/icon_theme/active.json`); VS Code
 * semantics apply unchanged, with one deliberate deviation (see {@link closedFolderNames}).
 */
import { posix } from 'node:path';
import type { Manifest } from 'material-icon-theme';

export const THEME_ENTRY = 'extension/icon_theme/active.json';
export const LICENSE_ENTRY = 'extension/LICENSE.txt';
export const ICONS_PREFIX = 'extension/icons/';

/** The only VSIX entries the build reads. */
export function wantedEntry(name: string): boolean {
    if (name === THEME_ENTRY || name === LICENSE_ENTRY) {
        return true;
    }
    return name.startsWith(ICONS_PREFIX) && /^[A-Za-z0-9][A-Za-z0-9_.-]*\.svg$/.test(name.slice(ICONS_PREFIX.length));
}

const MAP_KEYS = [
    'fileExtensions',
    'fileNames',
    'folderNames',
    'folderNamesExpanded',
    'rootFolderNames',
    'rootFolderNamesExpanded',
    'languageIds',
] as const;
const STRING_KEYS = ['file', 'folder', 'folderExpanded', 'rootFolder', 'rootFolderExpanded'] as const;
/** Keys that do not influence which icon a file or folder gets. */
const IGNORED_KEYS = ['hidesExplorerArrows', 'showLanguageModeIcons'] as const;

/**
 * Parses and validates a VS Code file icon theme document. Anything this pipeline cannot represent
 * faithfully (font icons, light/high-contrast sections, unknown keys) fails the build, so a version
 * bump cannot silently change semantics.
 */
export function parseThemeDocument(text: string, label: string): Manifest {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        throw new Error(`${label}: not valid JSON (${(err as Error).message})`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`${label}: expected a JSON object`);
    }
    const doc = raw as Record<string, unknown>;
    const known = new Set<string>(['iconDefinitions', ...MAP_KEYS, ...STRING_KEYS, ...IGNORED_KEYS]);
    for (const key of Object.keys(doc)) {
        if (!known.has(key)) {
            throw new Error(`${label}: unsupported top-level key "${key}" (fonts, light and highContrast sections are not supported)`);
        }
    }
    const defs = doc.iconDefinitions;
    if (typeof defs !== 'object' || defs === null || Array.isArray(defs)) {
        throw new Error(`${label}: iconDefinitions must be an object`);
    }
    for (const [id, def] of Object.entries(defs)) {
        const d = def as Record<string, unknown>;
        if (typeof d !== 'object' || d === null || typeof d.iconPath !== 'string' || Object.keys(d).length !== 1) {
            throw new Error(`${label}: iconDefinitions[${id}] must be { "iconPath": string } (font icons are not supported)`);
        }
    }
    for (const key of MAP_KEYS) {
        const map = doc[key];
        if (map === undefined) {
            continue;
        }
        if (typeof map !== 'object' || map === null || Array.isArray(map)) {
            throw new Error(`${label}: ${key} must be an object`);
        }
        for (const [k, v] of Object.entries(map)) {
            if (typeof v !== 'string' || v === '') {
                throw new Error(`${label}: ${key}[${k}] must be a non-empty string`);
            }
            if (k === '__proto__') {
                throw new Error(`${label}: ${key} has a "__proto__" key`);
            }
        }
    }
    for (const key of STRING_KEYS) {
        if (doc[key] !== undefined && (typeof doc[key] !== 'string' || doc[key] === '')) {
            throw new Error(`${label}: ${key} must be a non-empty string`);
        }
    }
    return doc as Manifest;
}

/**
 * DELIBERATE DEVIATION from VS Code: the Pelican file manager only ever shows closed folders, but
 * Datapack Icons maps specific folders only in `folderNamesExpanded` (`folderNames` has just three
 * closed entries). The closed-folder map used here is therefore `folderNamesExpanded` overlaid by
 * `folderNames` (closed entries win). Keys are lower-cased first, exactly like VS Code does for
 * both maps, so the overlay happens on the keys VS Code would compare.
 */
export function closedFolderNames(doc: Manifest, label: string): { map: Record<string, string>; fromExpanded: number; overridden: string[] } {
    const out = new Map<string, string>();
    const lowerOnce = (source: Record<string, string> | undefined, where: string) => {
        const m = new Map<string, [string, string]>();
        for (const [rawKey, icon] of Object.entries(source ?? {})) {
            const key = rawKey.toLowerCase();
            const previous = m.get(key);
            if (previous) {
                throw new Error(`${label}.${where}: keys ${JSON.stringify(previous[0])} and ${JSON.stringify(rawKey)} collide after lower-casing`);
            }
            m.set(key, [rawKey, icon]);
        }
        return m;
    };
    const expanded = lowerOnce(doc.folderNamesExpanded, 'folderNamesExpanded');
    const closed = lowerOnce(doc.folderNames, 'folderNames');
    for (const [key, [, icon]] of expanded) {
        out.set(key, icon);
    }
    const overridden: string[] = [];
    for (const [key, [, icon]] of closed) {
        if (out.has(key) && out.get(key) !== icon) {
            overridden.push(key);
        }
        out.set(key, icon);
    }
    const fromExpanded = [...expanded.keys()].filter((k) => !closed.has(k)).length;
    return { map: Object.fromEntries(out), fromExpanded, overridden };
}

/**
 * Resolves an `iconPath` like VS Code (`joinPath(dirname(themeFile), iconPath)`) and returns the
 * VSIX entry name, which must be a direct child of `extension/icons/` ending in `.svg`.
 */
export function iconEntry(iconPath: string): string | null {
    if (iconPath.includes('\\') || iconPath.includes('://') || iconPath.startsWith('/')) {
        return null;
    }
    const entry = posix.normalize(posix.join(posix.dirname(THEME_ENTRY), iconPath));
    if (!entry.startsWith(ICONS_PREFIX) || entry.slice(ICONS_PREFIX.length).includes('/') || !entry.endsWith('.svg')) {
        return null;
    }
    return entry;
}

/**
 * Equal-specificity file-extension pairs (informational): a plain extension with n dot segments and
 * a parent-qualified one with n-1 segments that is its suffix select the same number of classes.
 */
export function extensionTies(fileExtensions: Map<string, string>, byParent: Map<string, Map<string, string>>): number {
    let ties = 0;
    for (const [ext, icon] of fileExtensions) {
        const dot = ext.indexOf('.');
        if (dot < 0) {
            continue;
        }
        const suffix = ext.slice(dot + 1);
        for (const inner of byParent.values()) {
            const other = inner.get(suffix);
            if (other !== undefined && other !== icon) {
                ties++;
            }
        }
    }
    return ties;
}
