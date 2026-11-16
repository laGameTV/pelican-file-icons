#!/usr/bin/env bun
/**
 * Generates the runtime data of the plugin (dev tooling only, the panel host needs no Node/Bun):
 *
 *   resources/data/material.php        Material Icon Theme mappings (base + per-pack overrides)
 *   resources/data/datapack.php        Datapack Icons mappings (same format, no packs)
 *   resources/data/languages.php       VS Code built-in language associations (+ PCRE for the globs)
 *   resources/icons/material/<id>.svg  every shipped Material icon, copied verbatim from the npm package
 *   resources/icons/datapack/<id>.svg  every shipped Datapack icon, copied verbatim from the VSIX
 *
 *   bun scripts/build-data.ts [--check] [--offline]
 *
 * Sources: the `material-icon-theme` dev dependency, scripts/data/vscode-languages.json and the
 * pinned VSIX in scripts/data/sources.json (downloaded once into scripts/.cache/, sha256-verified).
 *
 * --check   writes no generated file and exits with 1 if any output is missing, stale or out of date
 *           (it may still download the pinned VSIX into scripts/.cache/)
 * --offline never downloads; the VSIX must already be cached
 *
 * The output is deterministic: running the script twice yields byte-identical files.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { availableIconPacks, generateManifest, type Manifest } from 'material-icon-theme';
import { closedFolderNames, extensionTies, iconEntry, LICENSE_ENTRY, parseThemeDocument, THEME_ENTRY, wantedEntry } from './lib/datapack';
import {
    applyOverride,
    diffSection,
    FLAT_KEYS,
    NESTED_KEYS,
    type NormalizeStats,
    normalizeSection,
    type Section,
    type SectionOverride,
    sectionEquals,
    sectionIcons,
    sectionToPhp,
} from './lib/material';
import { applyInserts, extensionKeyOrder, orderInserts, ordersAgree, vscodeRuleOrder } from './lib/order';
import { isPhpIntegerKey, phpFile, type PhpValue, PhpWrappedList, strcmp } from './lib/php';
import { fetchSource, readSources } from './lib/sources';
import { svgProblem } from './lib/svg';
import { buildLanguageTables, parseVscodeLanguages } from './lib/vscode-languages';
import { readVsix } from './lib/vsix';

const GENERATOR = 'scripts/build-data.ts';
const FORMAT = 1;
const ROOT = resolve(import.meta.dir, '..');
const DATA_DIR = join(ROOT, 'resources', 'data');
const ICON_DIR = join(ROOT, 'resources', 'icons');
const VSCODE_JSON = join(ROOT, 'scripts', 'data', 'vscode-languages.json');
const SOURCES_JSON = join(ROOT, 'scripts', 'data', 'sources.json');
const CACHE_DIR = join(ROOT, 'scripts', '.cache');
const ICON_ID = /^[a-z0-9][a-z0-9_.-]*$/;
const DATAPACK_SOURCE = 'mc-dp-icons';

const { values: args } = parseArgs({
    options: {
        check: { type: 'boolean', default: false },
        offline: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
});
if (args.help) {
    console.log('usage: bun scripts/build-data.ts [--check] [--offline]');
    process.exit(0);
}

function fail(message: string): never {
    throw new Error(`[build] ${message}`);
}
const log = (message: string) => console.log(`[build] ${message}`);
const rel = (file: string) => relative(ROOT, file).split(sep).join('/');

/** One generated icon theme: its data file (as a function of its own hash) and its svgs. */
interface ThemeBuild {
    id: string;
    value: (hash: string) => Map<string, PhpValue>;
    /** shipped icon id => svg bytes, in strcmp order */
    icons: Map<string, Uint8Array>;
    sections: [string, Section | SectionOverride][];
    stats: string[];
}

function checkIconIds(theme: string, ids: Iterable<string>): void {
    for (const id of ids) {
        if (!ICON_ID.test(id) || id.includes('/') || id.includes('..')) {
            // '..' anywhere in an entry name makes Pelican's zip import reject the release
            fail(`${theme}: icon id ${JSON.stringify(id)} does not match ${ICON_ID} (or contains '..')`);
        }
    }
}

function checkSvgs(theme: string, icons: Map<string, Uint8Array>): void {
    for (const [id, bytes] of icons) {
        const problem = svgProblem(bytes);
        if (problem !== null) {
            fail(`${theme}: icon ${id}.svg ${problem}`);
        }
    }
}

/** For themes without a light section: the runtime's "X_light if shipped" rule must never fire. */
function checkNoLightPairs(theme: string, ids: Set<string>): void {
    for (const id of ids) {
        if (id.endsWith('_light') && ids.has(id.slice(0, -'_light'.length))) {
            fail(`${theme}: ships both ${id.slice(0, -6)} and ${id}, but the theme has no light section`);
        }
    }
}

/** The keys of a SECTION's `fileExtensions` (+ parent-qualified ones as 'parent/name'). */
function sectionExtensionKeys(s: Section): string[] {
    return [
        ...s.fileExtensions.keys(),
        ...[...s.fileExtensionsByParent].flatMap(([parent, inner]) => [...inner.keys()].map((name) => `${parent}/${name}`)),
    ];
}

/** definitionOrder / extensionOrder must cover every icon and extension key of the section they order. */
function checkOrderCovers(label: string, section: Section, icons: readonly string[], extensions: readonly string[]): void {
    const iconSet = new Set(icons);
    const keySet = new Set(extensions);
    const missingIcons = [...sectionIcons(section)].filter((id) => !iconSet.has(id));
    const missingKeys = sectionExtensionKeys(section).filter((key) => !keySet.has(key));
    if (missingIcons.length || missingKeys.length) {
        fail(`${label}: the rule order misses icons [${missingIcons.slice(0, 10).join(', ')}] / extension keys [${missingKeys.slice(0, 10).join(', ')}]`);
    }
}

const insertsToPhp = (inserts: Map<string, string[]>) => new Map<string, PhpValue>([...inserts].map(([anchor, ids]) => [anchor, new PhpWrappedList(ids)]));

const sectionCounts = (s: Section | SectionOverride) =>
    [
        ...FLAT_KEYS.map((k) => `${k} ${s[k].size}`),
        ...NESTED_KEYS.map((k) => `${k} ${s[k].size}/${[...s[k].values()].reduce((n, m) => n + m.size, 0)}`),
    ].join(', ');

const svgSummary = (icons: Map<string, Uint8Array>) => {
    let total = 0;
    let max = 0;
    for (const b of icons.values()) {
        total += b.length;
        max = Math.max(max, b.length);
    }
    return `${total} bytes, largest ${max}`;
};

// ---------------------------------------------------------------------------------------------
// VS Code languages (shared by all themes)

const vscode = parseVscodeLanguages(readFileSync(VSCODE_JSON, 'utf8'));
const builtinLanguageIds = new Set(vscode.contributions.map((c) => c.id));
const tables = buildLanguageTables(vscode);
const languagesPhp = phpFile(
    new Map<string, PhpValue>([
        ['format', FORMAT],
        ['vscode', new Map<string, PhpValue>([['tag', vscode.tag], ['commit', vscode.commit]])],
        ['filenames', tables.filenames],
        ['extensions', tables.extensions],
        [
            'patterns',
            tables.patterns.map(
                (p) =>
                    new Map<string, PhpValue>([
                        ['glob', p.glob],
                        ['regex', p.regex],
                        ['onPath', p.onPath],
                        ['id', p.id],
                    ]),
            ),
        ],
    ]),
    GENERATOR,
);

// ---------------------------------------------------------------------------------------------
// Material Icon Theme

function buildMaterial(): ThemeBuild {
    const pkgJsonPath = Bun.resolveSync('material-icon-theme/package.json', ROOT);
    const pkgDir = dirname(pkgJsonPath);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { name: string; version: string };
    const distDir = join(pkgDir, 'dist'); // iconPath values are relative to dist/material-icons.json
    const packageIconDir = join(pkgDir, 'icons');

    /** JSON round-trip: detaches the result from any state shared inside the generator. */
    const generate = (config?: Parameters<typeof generateManifest>[0]): Manifest =>
        JSON.parse(JSON.stringify(generateManifest(config))) as Manifest;

    const packs = [...availableIconPacks] as string[];
    const baseManifest = generate({ activeIconPack: '' });
    const packManifests = new Map(packs.map((p) => [p, generate({ activeIconPack: p as (typeof availableIconPacks)[number] })]));
    if (JSON.stringify(generate({ activeIconPack: '' })) !== JSON.stringify(baseManifest)) {
        fail('material: generateManifest() is not deterministic across calls');
    }
    const defaultJson = JSON.stringify(generate());
    const defaultPacks = packs.filter((p) => JSON.stringify(packManifests.get(p)) === defaultJson);
    if (defaultPacks.length !== 1) {
        fail(`material: cannot determine the default activeIconPack (candidates: ${JSON.stringify(defaultPacks)})`);
    }
    const defaultPack = defaultPacks[0]!;

    const allManifests: [string, Manifest][] = [['(no pack)', baseManifest], ...packManifests];
    for (const [label, m] of allManifests) {
        if (m.file !== baseManifest.file || m.folder !== baseManifest.folder) {
            fail(`material ${label}: default file/folder icons differ from the base manifest`);
        }
    }
    if (!baseManifest.file || !baseManifest.folder) {
        fail('material: base manifest has no default file/folder icon');
    }

    // --- light variants: the runtime derives light mode as "X_light if shipped"; prove that holds ---
    const lightNotes: string[] = [];
    for (const [label, m] of allManifests) {
        const defs = m.iconDefinitions ?? {};
        for (const key of ['fileNames', 'fileExtensions', 'languageIds', 'folderNames', 'folderNamesExpanded'] as const) {
            const dark = m[key] ?? {};
            const light = m.light?.[key] ?? {};
            for (const [k, v] of Object.entries(light)) {
                if (!Object.hasOwn(dark, k) || v !== `${dark[k]}_light`) {
                    fail(`material ${label}: light.${key}[${k}] = ${v} is not dark value + '_light' (${dark[k]})`);
                }
            }
            for (const [k, v] of Object.entries(dark)) {
                if (Object.hasOwn(defs, `${v}_light`) && (!Object.hasOwn(light, k) || light[k] !== `${v}_light`)) {
                    // VS Code would keep the dark icon in light themes for this key
                    if (key === 'languageIds' && !builtinLanguageIds.has(k)) {
                        lightNotes.push(`${label}: languageIds[${k}]`);
                    } else {
                        fail(`material ${label}: ${key}[${k}] = ${v} has a ${v}_light icon but no light mapping - runtime light derivation would be wrong`);
                    }
                }
            }
        }
        if (m.light?.file || m.light?.folder) {
            fail(`material ${label}: light defaults are not supported by the data format`);
        }
    }

    // --- sections ---------------------------------------------------------------------------------
    const stats: NormalizeStats = { dropped: [] };
    const base = normalizeSection(baseManifest, 'base', stats);
    const overrides = new Map<string, SectionOverride>();
    for (const [pack, m] of packManifests) {
        const section = normalizeSection(m, pack, stats);
        const diff = diffSection(base, section);
        if (!sectionEquals(applyOverride(base, diff), section)) {
            fail(`material ${pack}: base + packOverrides does not reproduce generateManifest({ activeIconPack: '${pack}' })`);
        }
        overrides.set(pack, diff);
    }

    // --- icons: every definition except those only reachable through expanded/open folder maps -----
    const definitions = new Map<string, string>();
    const closedRefs = new Set<string>();
    const openRefs = new Set<string>();
    for (const [label, m] of allManifests) {
        for (const [id, def] of Object.entries(m.iconDefinitions ?? {})) {
            const known = definitions.get(id);
            if (known !== undefined && known !== def.iconPath) {
                fail(`material ${label}: iconDefinitions[${id}] changes its iconPath (${known} vs ${def.iconPath})`);
            }
            definitions.set(id, def.iconPath);
        }
        for (const s of [m, m.light ?? {}, m.highContrast ?? {}] as Manifest[]) {
            for (const key of ['fileNames', 'fileExtensions', 'languageIds', 'folderNames', 'rootFolderNames'] as const) {
                for (const v of Object.values(s[key] ?? {})) {
                    closedRefs.add(v);
                }
            }
            for (const key of ['folderNamesExpanded', 'rootFolderNamesExpanded'] as const) {
                for (const v of Object.values(s[key] ?? {})) {
                    openRefs.add(v);
                }
            }
            for (const v of [s.file, s.folder, s.rootFolder]) {
                if (v) {
                    closedRefs.add(v);
                }
            }
            for (const v of [s.folderExpanded, s.rootFolderExpanded]) {
                if (v) {
                    openRefs.add(v);
                }
            }
        }
    }
    for (const id of closedRefs) {
        if (!definitions.has(id)) {
            fail(`material: icon ${id} is referenced but has no iconDefinition`);
        }
    }
    const shippedIds = [...definitions.keys()].filter((id) => closedRefs.has(id) || !openRefs.has(id)).sort(strcmp);
    const unreferenced = shippedIds.filter((id) => !closedRefs.has(id));
    checkIconIds('material', shippedIds);
    const icons = new Map<string, Uint8Array>();
    for (const id of shippedIds) {
        const iconPath = definitions.get(id)!;
        const file = resolve(distDir, iconPath);
        if (!iconPath.startsWith('./../icons/') || !file.startsWith(packageIconDir + sep) || !file.endsWith('.svg')) {
            fail(`material: iconDefinitions[${id}].iconPath ${iconPath} does not point into the package's icons/ folder`);
        }
        if (!existsSync(file)) {
            fail(`material: iconDefinitions[${id}]: ${relative(pkgDir, file)} is missing in the npm package`);
        }
        icons.set(id, readFileSync(file));
    }
    checkSvgs('material', icons);
    const shipped = new Set(shippedIds);
    const missing = (refs: Iterable<string>, where: string) => {
        for (const id of refs) {
            if (!shipped.has(id)) {
                fail(`material: ${where} references icon ${id}, which is not shipped`);
            }
        }
    };
    missing([baseManifest.file!, baseManifest.folder!], 'defaults');
    missing(sectionIcons(base), 'base');
    for (const [pack, o] of overrides) {
        missing(sectionIcons(o), `packOverrides.${pack}`);
    }
    for (const [label, m] of allManifests) {
        for (const key of ['fileNames', 'fileExtensions', 'languageIds', 'folderNames'] as const) {
            missing(Object.values(m.light?.[key] ?? {}), `${label}.light.${key}`);
        }
    }

    // --- VS Code CSS rule order (equal-specificity ties): base order + what each pack inserts -------
    const ruleOrder = (m: Manifest) => vscodeRuleOrder(m, 'dark').filter((id) => shipped.has(id));
    const baseOrder = ruleOrder(baseManifest);
    const baseExtensions = extensionKeyOrder(baseManifest, 'material base');
    checkOrderCovers('material base', base, baseOrder, baseExtensions);
    const packOrder = new Map<string, PhpValue>();
    let insertedIcons = 0;
    let insertedKeys = 0;
    for (const [pack, m] of packManifests) {
        const order = ruleOrder(m);
        const extensions = extensionKeyOrder(m, `material ${pack}`);
        const icons = orderInserts(baseOrder, order, `material ${pack} definitionOrder`);
        const keys = orderInserts(baseExtensions, extensions, `material ${pack} extensionOrder`);
        if (!ordersAgree(applyInserts(baseOrder, icons), order) || !ordersAgree(applyInserts(baseExtensions, keys), extensions)) {
            fail(`material ${pack}: base order + packOrder does not reproduce VS Code's rule order`);
        }
        checkOrderCovers(`material ${pack}`, applyOverride(base, overrides.get(pack)!), order, extensions);
        insertedIcons += [...icons.values()].reduce((n, ids) => n + ids.length, 0);
        insertedKeys += [...keys.values()].reduce((n, ids) => n + ids.length, 0);
        packOrder.set(
            pack,
            new Map<string, PhpValue>([
                ['definitionOrder', insertsToPhp(icons)],
            ]),
        );
    }

    const source = new Map<string, PhpValue>([['package', pkg.name], ['version', pkg.version]]);
    const value = (hash: string) =>
        new Map<string, PhpValue>([
            ['format', FORMAT],
            ['theme', 'material'],
            ['source', source],
            ['material', source],
            ['hash', hash],
            ['defaults', new Map<string, PhpValue>([['file', baseManifest.file!], ['folder', baseManifest.folder!]])],
            ['defaultPack', defaultPack],
            ['packs', packs],
            ['icons', new Map<string, PhpValue>(shippedIds.map((id) => [id, 1]))],
            ['base', sectionToPhp(base)],
            ['packOverrides', new Map<string, PhpValue>([...overrides].map(([p, o]) => [p, sectionToPhp(o)]))],
            ['definitionOrder', new PhpWrappedList(baseOrder)],
            ['packOrder', packOrder],
        ]);

    const lines = [
        `${pkg.name} ${pkg.version}: default pack '${defaultPack}', packs ${packs.join(', ')}`,
        `base: ${sectionCounts(base)}`,
        ...[...overrides].map(([pack, o]) => `packOverrides.${pack}: ${sectionCounts(o)}`),
        `dropped unreachable parent-qualified keys: ${stats.dropped.length}${stats.dropped.length ? ` (${stats.dropped.join(', ')})` : ''}`,
        `rule order: ${baseOrder.length} icons, ${baseExtensions.length} extension keys; the packs insert ${insertedIcons} icons and ${insertedKeys} keys`,
        `icons: ${shippedIds.length} shipped (${svgSummary(icons)}), ${definitions.size - shippedIds.length} open-folder-only skipped, ` +
            `${unreferenced.length} unreferenced kept (${unreferenced.join(', ')})`,
    ];
    if (lightNotes.length) {
        lines.push(
            `light: ${new Set(lightNotes.map((n) => n.replace(/^[^:]*: /, ''))).size} non-built-in languageIds have a _light icon but no light mapping (unreachable at runtime)`,
        );
    }
    return {
        id: 'material',
        value,
        icons,
        sections: [['base', base], ...[...overrides].map(([p, o]) => [p, o] as [string, SectionOverride])],
        stats: lines,
    };
}

// ---------------------------------------------------------------------------------------------
// Datapack Icons

async function buildDatapack(): Promise<ThemeBuild> {
    const sources = readSources(SOURCES_JSON);
    const source = sources[DATAPACK_SOURCE] ?? fail(`scripts/data/sources.json has no "${DATAPACK_SOURCE}" entry`);
    const fetched = await fetchSource(DATAPACK_SOURCE, source, CACHE_DIR, args.offline!);
    const entries = readVsix(fetched.bytes, wantedEntry, `${DATAPACK_SOURCE} ${source.version} VSIX`);
    const text = (name: string) => {
        const bytes = entries.get(name) ?? fail(`datapack: the VSIX has no ${name}`);
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
            fail(`datapack: ${name} is not valid UTF-8`);
        }
    };

    const license = text(LICENSE_ENTRY);
    if (source.license !== 'MIT' || !license.includes(source.copyright) || !license.includes('Permission is hereby granted, free of charge')) {
        fail(`datapack: ${LICENSE_ENTRY} is not the pinned ${source.license} license with "${source.copyright}" - review the license before bumping`);
    }

    const doc = parseThemeDocument(text(THEME_ENTRY).replace(/^﻿/, ''), `datapack ${THEME_ENTRY}`);
    if (!doc.file || !doc.folder) {
        fail('datapack: the theme has no default file/folder icon');
    }
    const defs = doc.iconDefinitions ?? {};
    const folders = closedFolderNames(doc, 'datapack');
    const stats: NormalizeStats = { dropped: [] };
    const base = normalizeSection(
        { fileNames: doc.fileNames, fileExtensions: doc.fileExtensions, folderNames: folders.map, languageIds: doc.languageIds },
        'datapack',
        stats,
    );

    // --- icons: the defaults and everything the (closed-folder) maps reference ---------------------
    const referenced = new Set<string>([doc.file!, doc.folder!, ...sectionIcons(base)]);
    const shippedIds = [...referenced].sort(strcmp);
    checkIconIds('datapack', shippedIds);
    const icons = new Map<string, Uint8Array>();
    for (const id of shippedIds) {
        const def = defs[id] ?? fail(`datapack: icon ${id} is referenced but has no iconDefinition`);
        const entry = iconEntry(def.iconPath) ?? fail(`datapack: iconDefinitions[${id}].iconPath ${def.iconPath} does not point into extension/icons/`);
        icons.set(id, entries.get(entry) ?? fail(`datapack: ${entry} (icon ${id}) is missing in the VSIX`));
    }
    checkSvgs('datapack', icons);
    checkNoLightPairs('datapack', referenced);
    const skipped = Object.keys(defs).filter((id) => !referenced.has(id)).sort(strcmp);

    const order = vscodeRuleOrder(doc).filter((id) => referenced.has(id));
    if (order.length !== shippedIds.length) {
        fail('datapack: definitionOrder does not cover every shipped icon');
    }
    const extensionOrder = extensionKeyOrder(doc, 'datapack');
    checkOrderCovers('datapack', base, order, extensionOrder);

    const value = (hash: string) =>
        new Map<string, PhpValue>([
            ['format', FORMAT],
            ['theme', 'datapack'],
            ['source', new Map<string, PhpValue>([['package', DATAPACK_SOURCE], ['version', source.version]])],
            ['hash', hash],
            ['defaults', new Map<string, PhpValue>([['file', doc.file!], ['folder', doc.folder!]])],
            ['defaultPack', ''],
            ['packs', []],
            ['icons', new Map<string, PhpValue>(shippedIds.map((id) => [id, 1]))],
            ['base', sectionToPhp(base)],
            ['packOverrides', new Map<string, PhpValue>()],
            ['definitionOrder', new PhpWrappedList(order)],
            ['packOrder', new Map<string, PhpValue>()],
        ]);

    const ties = extensionTies(base.fileExtensions, base.fileExtensionsByParent);
    return {
        id: 'datapack',
        value,
        icons,
        sections: [['base', base]],
        stats: [
            `${DATAPACK_SOURCE} ${source.version}: VSIX sha256 ${source.sha256.slice(0, 12)}… ${fetched.downloaded ? 'downloaded' : 'cached'} (${rel(fetched.file)})`,
            `base: ${sectionCounts(base)}`,
            `closed-folder deviation: ${folders.fromExpanded} folder names taken from folderNamesExpanded, ` +
                `${Object.keys(doc.folderNames ?? {}).length} from folderNames (${folders.overridden.length} of them override an expanded icon)`,
            `dropped unreachable parent-qualified keys: ${stats.dropped.length}${stats.dropped.length ? ` (${stats.dropped.join(', ')})` : ''}`,
            `icons: ${shippedIds.length} shipped (${svgSummary(icons)}), ${skipped.length} definitions not referenced by any closed map skipped (${skipped.join(', ')})`,
            `equal-specificity extension pairs: ${ties} (CSS rule order decides - see 'definitionOrder')`,
        ],
    };
}

// ---------------------------------------------------------------------------------------------
// Hashes and outputs

const themes = [buildMaterial(), await buildDatapack()];

const outputs = new Map<string, Uint8Array | string>([[join(DATA_DIR, 'languages.php'), languagesPhp]]);
const hashes = new Map<string, string>();
const dataSizes = new Map<string, number>();
for (const theme of themes) {
    // cache-busting hash over the theme's data file (with an empty hash), languages.php and its svgs
    const hasher = createHash('sha256');
    const feed = (label: string, bytes: Uint8Array | string) => {
        const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes;
        hasher.update(`${label}\n${buf.length}\n`);
        hasher.update(buf);
    };
    feed(`${theme.id}.php`, phpFile(theme.value(''), GENERATOR));
    feed('languages.php', languagesPhp);
    for (const [id, bytes] of theme.icons) {
        feed(`icons/${theme.id}/${id}.svg`, bytes);
    }
    const hash = hasher.digest('hex').slice(0, 12);
    const php = phpFile(theme.value(hash), GENERATOR);
    hashes.set(theme.id, hash);
    dataSizes.set(theme.id, Buffer.byteLength(php));
    outputs.set(join(DATA_DIR, `${theme.id}.php`), php);
    for (const [id, bytes] of theme.icons) {
        outputs.set(join(ICON_DIR, theme.id, `${id}.svg`), bytes);
    }
}

// --- stale files: resources/data and resources/icons are fully generated --------------------------
const themeIds = new Set(themes.map((t) => t.id));
const stale: string[] = [];
const staleDirs: string[] = [];
const notes: string[] = [];
const isSvg = (f: string) => f.toLowerCase().endsWith('.svg');
if (existsSync(DATA_DIR)) {
    for (const f of readdirSync(DATA_DIR).sort(strcmp)) {
        // includes the pre-1.0 resources/data/manifest.php
        if (f.toLowerCase().endsWith('.php') && !outputs.has(join(DATA_DIR, f))) {
            stale.push(join(DATA_DIR, f));
        }
    }
}
if (existsSync(ICON_DIR)) {
    for (const entry of readdirSync(ICON_DIR, { withFileTypes: true }).sort((a, b) => strcmp(a.name, b.name))) {
        const path = join(ICON_DIR, entry.name);
        if (entry.isFile()) {
            if (isSvg(entry.name)) {
                stale.push(path); // the old flat layout resources/icons/<id>.svg
            } else {
                notes.push(`non-svg file left alone: ${rel(path)}`);
            }
            continue;
        }
        if (!entry.isDirectory()) {
            notes.push(`left alone: ${rel(path)}`);
            continue;
        }
        let others = 0;
        for (const f of readdirSync(path).sort(strcmp)) {
            if (isSvg(f) && !outputs.has(join(path, f))) {
                stale.push(join(path, f));
            } else if (!isSvg(f)) {
                others++;
                notes.push(`non-svg entry left alone: ${rel(join(path, f))}`);
            }
        }
        if (!themeIds.has(entry.name) && others === 0) {
            staleDirs.push(path);
        }
    }
}

const sameBytes = (file: string, content: Uint8Array | string) => {
    if (!existsSync(file)) {
        return false;
    }
    const want = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
    return readFileSync(file).equals(want);
};
const outdated = () => [...outputs].filter(([file, content]) => !sameBytes(file, content)).map(([file]) => file);

if (args.check) {
    const changed = outdated();
    if (changed.length || stale.length || staleDirs.length) {
        const shown = (list: string[], what: string) => {
            for (const f of list.slice(0, 20)) {
                console.error(`[build] ${what}: ${rel(f)}`);
            }
            if (list.length > 20) {
                console.error(`[build] … and ${list.length - 20} more ${what} file(s)`);
            }
        };
        shown(changed, 'out of date');
        shown(stale, 'stale');
        shown(staleDirs, 'stale directory');
        console.error(`[build] FAILED: ${changed.length} outdated and ${stale.length + staleDirs.length} stale file(s) - run \`bun run build\``);
        process.exit(1);
    }
    log(`OK: generated data is up to date (${[...hashes].map(([t, h]) => `${t} ${h}`).join(', ')})`);
    process.exit(0);
}

mkdirSync(DATA_DIR, { recursive: true });
for (const theme of themes) {
    mkdirSync(join(ICON_DIR, theme.id), { recursive: true });
}
for (const f of stale) {
    rmSync(f);
}
for (const d of staleDirs) {
    rmdirSync(d);
}
// compared after removing stale files (matters on case-insensitive file systems)
const changed = outdated();
for (const file of changed) {
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, outputs.get(file)!);
    renameSync(tmp, file);
}
for (const note of notes) {
    console.warn(`[build] warning: ${note}`);
}

// ---------------------------------------------------------------------------------------------
// Stats

for (const theme of themes) {
    const intKeys: string[] = [];
    for (const [label, s] of theme.sections) {
        for (const k of FLAT_KEYS) {
            for (const key of s[k].keys()) {
                if (isPhpIntegerKey(key)) {
                    intKeys.push(`${label}.${k}[${key}]`);
                }
            }
        }
        for (const k of NESTED_KEYS) {
            for (const [parent, inner] of s[k]) {
                for (const key of [parent, ...inner.keys()]) {
                    if (isPhpIntegerKey(key)) {
                        intKeys.push(`${label}.${k}[${key}]`);
                    }
                }
            }
        }
    }
    for (const line of theme.stats) {
        log(`${theme.id}: ${line}`);
    }
    if (intKeys.length) {
        log(`${theme.id}: note: ${intKeys.length} keys become PHP integers: ${intKeys.slice(0, 10).join(', ')}${intKeys.length > 10 ? ', …' : ''}`);
    }
    log(`${theme.id}: ${theme.id}.php ${dataSizes.get(theme.id)} bytes, hash ${hashes.get(theme.id)}`);
}
const kinds = tables.patterns.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {});
log(
    `languages: VS Code ${vscode.tag} (${vscode.commit.slice(0, 12)}): ${tables.filenames.size} filenames, ` +
        `${tables.extensions.size} extensions, ${tables.patterns.length} patterns (${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(', ')}); ` +
        `languages.php ${Buffer.byteLength(languagesPhp)} bytes`,
);
log(`${changed.length} file(s) written, ${stale.length} stale file(s) and ${staleDirs.length} stale director${staleDirs.length === 1 ? 'y' : 'ies'} removed`);
