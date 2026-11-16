/**
 * Built-in VS Code language contributions (`scripts/data/vscode-languages.json`) and the lookup
 * tables derived from them for `resources/data/languages.php`.
 */
import { compileGlob, type CompiledGlob } from './glob';
import { strcmp } from './php';

export const VSCODE_REPO = 'microsoft/vscode';
export const DEFAULT_VSCODE_TAG = '1.146.0';

/**
 * Folders under `extensions/` that are not shipped as built-in extensions
 * (build/lib/extensions.ts `excludedExtensions` @ 1.146.0, restricted to real folders).
 * The fetch script re-reads the list from the pinned source and fails if it diverges.
 */
export const EXCLUDED_EXTENSIONS = [
    'copilot',
    'vscode-api-tests',
    'vscode-colorize-tests',
    'vscode-colorize-perf-tests',
    'vscode-test-resolver',
] as const;

export interface LanguageContribution {
    /** Extension folder name, or `(core)` for languages registered by VS Code itself. */
    extension: string;
    id: string;
    extensions: string[];
    filenames: string[];
    filenamePatterns: string[];
}

export interface VscodeLanguages {
    source: string;
    tag: string;
    commit: string;
    contributions: LanguageContribution[];
}

/**
 * Languages registered by the core (`ModesRegistry`, src/vs/editor/common/languages/modesRegistry.ts):
 * only plaintext has file associations. They come before every extension
 * (languagesRegistry.ts `_initializeFromRegistry`: ModesRegistry languages, then dynamic ones).
 */
export const CORE_CONTRIBUTIONS: readonly LanguageContribution[] = [
    { extension: '(core)', id: 'plaintext', extensions: ['.txt'], filenames: [], filenamePatterns: [] },
];

export interface ExtensionManifest {
    /** Folder name below `extensions/`. */
    dir: string;
    /** Parsed package.json. */
    pkg: unknown;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isUndefinedOrStringArray = (v: unknown): boolean => v === undefined || isStringArray(v);

/** Port of workbench languageService.ts `isValidLanguageExtensionPoint` (invalid entries are skipped). */
function isValidLanguageExtensionPoint(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const v = value as Record<string, unknown>;
    if (typeof v.id !== 'string') {
        return false;
    }
    if (!isUndefinedOrStringArray(v.extensions) || !isUndefinedOrStringArray(v.filenames)) {
        return false;
    }
    if (v.firstLine !== undefined && typeof v.firstLine !== 'string') {
        return false;
    }
    if (v.configuration !== undefined && typeof v.configuration !== 'string') {
        return false;
    }
    if (!isUndefinedOrStringArray(v.aliases) || !isUndefinedOrStringArray(v.mimetypes)) {
        return false;
    }
    if (v.icon !== undefined) {
        const icon = v.icon as Record<string, unknown> | null;
        if (typeof icon !== 'object' || icon === null || typeof icon.light !== 'string' || typeof icon.dark !== 'string') {
            return false;
        }
    }
    return true;
}

/**
 * Registration order of VS Code: core languages, then built-in extensions sorted by folder name
 * with a plain JS `<` (extensionDescriptionRegistry.ts `extensionCmp`), each extension's
 * `contributes.languages` in package.json order.
 */
export function collectContributions(
    manifests: ExtensionManifest[],
    excluded: readonly string[] = EXCLUDED_EXTENSIONS,
    warn: (message: string) => void = console.warn,
): LanguageContribution[] {
    const skip = new Set(excluded);
    const sorted = manifests
        .filter((m) => !skip.has(m.dir))
        .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0));
    const out: LanguageContribution[] = CORE_CONTRIBUTIONS.map((c) => structuredClone(c));
    for (const { dir, pkg } of sorted) {
        const contributes = (pkg as { contributes?: { languages?: unknown } } | null)?.contributes;
        const languages = contributes?.languages;
        if (languages === undefined) {
            continue;
        }
        if (!Array.isArray(languages)) {
            warn(`extensions/${dir}: contributes.languages is not an array (VS Code ignores it)`);
            continue;
        }
        for (const lang of languages) {
            if (!isValidLanguageExtensionPoint(lang)) {
                warn(`extensions/${dir}: skipping invalid language contribution ${JSON.stringify(lang)}`);
                continue;
            }
            const patterns = lang.filenamePatterns;
            if (patterns !== undefined && !isStringArray(patterns)) {
                throw new Error(`extensions/${dir}: filenamePatterns of ${lang.id as string} is not a string[]`);
            }
            out.push({
                extension: dir,
                id: lang.id as string,
                extensions: [...((lang.extensions as string[] | undefined) ?? [])],
                filenames: [...((lang.filenames as string[] | undefined) ?? [])],
                filenamePatterns: [...(patterns ?? [])],
            });
        }
    }
    return out;
}

/**
 * Extracts `const excludedExtensions = [ ... ];` from build/lib/extensions.ts.
 * Returns null if the declaration cannot be found.
 */
export function parseExcludedExtensions(source: string): string[] | null {
    const m = /const\s+excludedExtensions\s*=\s*\[([^\]]*)\]/.exec(source);
    if (!m) {
        return null;
    }
    return [...m[1]!.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => (x[1] ?? x[2])!);
}

export function serializeVscodeLanguages(data: VscodeLanguages): string {
    return `${JSON.stringify(data, null, 2)}\n`;
}

export function parseVscodeLanguages(json: string): VscodeLanguages {
    const data = JSON.parse(json) as VscodeLanguages;
    if (typeof data.tag !== 'string' || !/^[0-9a-f]{40}$/.test(data.commit) || !Array.isArray(data.contributions)) {
        throw new Error('scripts/data/vscode-languages.json: unexpected shape');
    }
    for (const c of data.contributions) {
        for (const key of ['extensions', 'filenames', 'filenamePatterns'] as const) {
            if (!isStringArray(c[key])) {
                throw new Error(`scripts/data/vscode-languages.json: ${c.extension}/${c.id}.${key} is not a string[]`);
            }
        }
        if (typeof c.id !== 'string' || typeof c.extension !== 'string') {
            throw new Error('scripts/data/vscode-languages.json: contribution without id/extension');
        }
    }
    return data;
}

export interface LanguagePattern extends CompiledGlob {
    glob: string;
    id: string;
}

export interface LanguageTables {
    /** lower-cased exact basename => language id (later registration wins) */
    filenames: Map<string, string>;
    /** lower-cased suffix (as registered, not necessarily starting with '.') => language id (later registration wins) */
    extensions: Map<string, string>;
    /** registration order */
    patterns: LanguagePattern[];
}

/**
 * The association list of languagesAssociations.ts, folded into lookup tables.
 * Keys are lower-cased with `toLowerCase()`, like `getAssociations()` does with the path.
 */
export function buildLanguageTables(data: VscodeLanguages): LanguageTables {
    const filenames = new Map<string, string>();
    const extensions = new Map<string, string>();
    const patterns: LanguagePattern[] = [];
    for (const c of data.contributions) {
        for (const ext of c.extensions) {
            if (ext === '') {
                continue; // `if (association.extension)` - an empty string never matches
            }
            extensions.set(ext.toLowerCase(), c.id);
        }
        for (const name of c.filenames) {
            if (name === '') {
                continue; // equals('', …) can never match a basename
            }
            filenames.set(name.toLowerCase(), c.id);
        }
        for (const glob of c.filenamePatterns) {
            if (glob === '') {
                continue; // `if (association.filepattern)`
            }
            patterns.push({ glob, id: c.id, ...compileGlob(glob) });
        }
    }
    const sorted = (m: Map<string, string>) => new Map([...m].sort(([a], [b]) => strcmp(a, b)));
    return { filenames: sorted(filenames), extensions: sorted(extensions), patterns };
}
