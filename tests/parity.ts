/**
 * Differential parity test (SPEC §7, SPEC2 §5): the independent VS Code oracle
 * versus the PHP resolver (tests/php/resolve.php), dark AND light theme, for
 * several plugin configurations of both icon themes over a large
 * deterministic corpus.
 *
 * - Material Icon Theme: the oracle is fed with the real `generateManifest()`.
 * - Datapack Icons: the oracle is fed with the raw `active.json` from the
 *   pinned VSIX (scripts/.cache, see oracle/datapack.ts) plus the documented
 *   closed-folder deviation. The theme has no light section, so VS Code shows
 *   the dark icon in light themes too: light must equal dark.
 *
 * One PHP process per configuration; the cases are passed via stdin JSON.
 * Mismatches are grouped by cause; everything that is not in the explicit
 * allow-list (light-theme tie quirks only) fails the run.
 */

import { join } from 'node:path';
import { buildCorpus } from './oracle/corpus.ts';
import { DatapackSourceError, datapackClosedFolderDocument, datapackManifest, loadDatapackSource, type DatapackSource } from './oracle/datapack.ts';
import { generateManifest, material, type ExtraAssociations, type PluginOptions } from './oracle/material.ts';
import { Oracle, loadVscodeLanguages, type Case, type OracleResult } from './oracle/oracle.ts';
import { createLanguageAssociations } from './oracle/vscode/languages.ts';
import type { IconThemeDocument } from './oracle/vscode/iconTheme.ts';

export type ThemeId = 'material' | 'datapack';

export const THEMES: readonly ThemeId[] = ['material', 'datapack'];

export interface ParityConfig {
	name: string;
	/** Icon theme (resolve.php top-level "theme"); default material. */
	theme?: ThemeId;
	options: PluginOptions;
}

/** Associations used by the sample configs (all values are shipped icons). */
const SAMPLE_FILE_ASSOCIATIONS: Record<string, string> = {
	'*.foo': 'toml', // new extension -> icon that has a light variant
	'**.json': 'nodejs', // `**.ext`: also disables built-in fileNames containing ".json"
	'*.YAML': 'Settings', // keys and values are lowercased by Material
	'*.dat_old': 'hex',
	'*.mjs': 'react', // overrides a built-in extension
	'*.toml': 'yaml', // overrides a built-in extension that has a Material light mapping
	'server.properties': 'minecraft', // fileName beats extension
	'next.config.js': 'javascript', // overrides a built-in fileName that has a light mapping
	Jenkinsfile: 'docker',
	'.env': 'lock',
	'eula.txt': 'pdf',
	'plugins/config.yml': 'settings', // parent-qualified fileName
	'.config/abc.json': 'hcl', // parent-qualified, but removed again by `**.json`
	'my file.txt': 'pdf', // whitespace in a key (VS Code escapes whitespace to '/' on both sides)
	'my dir/notes.txt': 'pdf', // whitespace in the parent of a parent-qualified key
	'deep/er/x.txt': 'pdf', // two slashes: VS Code's parent class 'deep/er' only matches a directory named "deep er"
	'*.': 'lock', // empty extension (matches names ending in '.')
	'*.Config.JSON': 'settings', // multi-dot extension, mixed case
	'*.plugins/yml': 'docker', // parent-qualified EXTENSION (Material key 'plugins/yml'): ties with 2-segment extensions
	'*.mca': '', // empty value: Material maps the key to '' and VS Code emits no rule, i.e. the built-in mapping is removed
	'package.json': '', // same for a built-in fileName
};

const SAMPLE_FOLDER_ASSOCIATIONS: Record<string, string> = {
	myfolder: 'cursor', // new name -> folder icon that has a light variant
	src: 'components', // overrides a built-in folder name
	'.cursor': 'src', // overrides a built-in folder name that has a light mapping
	Server: 'config', // case
	plugins: '', // plain folder icon
	'parent/child': 'src', // parent-qualified folder name
	'my folder': 'src', // whitespace in a folder key
};

const NO_EXTRAS = { gameServerExtras: false, mimeFallback: false } as const;

export const PARITY_CONFIGS: ParityConfig[] = [
	{ name: 'default', options: { ...NO_EXTRAS } },
	{ name: "pack ''", options: { ...NO_EXTRAS, iconPack: '' } },
	{ name: 'pack react', options: { ...NO_EXTRAS, iconPack: 'react' } },
	{ name: 'pack bashly', options: { ...NO_EXTRAS, iconPack: 'bashly' } },
	{ name: 'pack unknown', options: { ...NO_EXTRAS, iconPack: 'does-not-exist' } },
	{ name: 'folders classic', options: { ...NO_EXTRAS, folderTheme: 'classic' } },
	{ name: 'folders none', options: { ...NO_EXTRAS, folderTheme: 'none' } },
	{
		name: 'associations',
		options: { ...NO_EXTRAS, iconPack: 'vue', fileAssociations: SAMPLE_FILE_ASSOCIATIONS, folderAssociations: SAMPLE_FOLDER_ASSOCIATIONS },
	},
	{
		name: 'associations classic',
		options: { ...NO_EXTRAS, folderTheme: 'classic', fileAssociations: { '**.YmL': 'docker' }, folderAssociations: SAMPLE_FOLDER_ASSOCIATIONS },
	},
	{ name: 'associations none', options: { ...NO_EXTRAS, folderTheme: 'none', folderAssociations: SAMPLE_FOLDER_ASSOCIATIONS } },
	{
		// Parent-qualified extension associations to icons that built-in rules already use: they tie
		// with 2-segment built-in extensions (e.g. compose.yml, gitlab-ci.yml) and the CSS rule order
		// of the built-in definitions (`definitionOrder` + the pack's insertions) decides.
		name: 'association ties',
		options: {
			...NO_EXTRAS,
			fileAssociations: { '*.plugins/yml': 'settings', '*.config/json': 'markdown', '*.src/ts': 'javascript', '*.logs/log': 'zip' },
		},
	},
	{
		name: 'association ties angular',
		options: { ...NO_EXTRAS, iconPack: 'angular', fileAssociations: { '*.app/ts': 'settings', '*.plugins/yml': 'settings' } },
	},
	{
		name: 'game-server extras',
		options: {
			gameServerExtras: true,
			mimeFallback: false,
			fileAssociations: { '*.SK': 'javascript', '*.vdf': 'json' },
			folderAssociations: { kubejs: 'javascript' },
		},
	},
	// Datapack Icons: whole-theme switch; no packs, no language ids, no light section.
	{ name: 'datapack', theme: 'datapack', options: { ...NO_EXTRAS } },
	{ name: 'datapack classic', theme: 'datapack', options: { ...NO_EXTRAS, folderTheme: 'classic' } },
	{ name: 'datapack none', theme: 'datapack', options: { ...NO_EXTRAS, folderTheme: 'none' } },
	{ name: 'datapack extras', theme: 'datapack', options: { gameServerExtras: true, mimeFallback: false } },
	{ name: 'datapack extras classic', theme: 'datapack', options: { gameServerExtras: true, mimeFallback: false, folderTheme: 'classic' } },
	{ name: 'datapack extras none', theme: 'datapack', options: { gameServerExtras: true, mimeFallback: false, folderTheme: 'none' } },
];

/** The only mismatch causes that may pass, each with its justification. */
export const ALLOW_LIST: Record<string, string> = {
	'light-tie-quirk':
		"VS Code light theme: a Material `light` rule (+1 specificity from `.vs`) for a SHORTER key ties with the dark winner and wins by rule order " +
		'(e.g. foo.pdm.toml: dark `pdm.toml` -> pdm, light `toml` -> toml_light). The plugin swaps to the light variant of the dark winner instead (SPEC §3.1/§4).',
};

interface PhpResult {
	icon: string;
	lightIcon: string | null;
	source: string;
}

type PhpEntry = PhpResult | null | { error: string };

export interface Mismatch {
	config: string;
	theme: 'dark' | 'light';
	cause: string;
	case: Case;
	expected: string | null;
	actual: string | null;
	oracle: OracleResult;
	php: PhpEntry;
}

export interface ParityReport {
	ok: boolean;
	lines: string[];
	mismatches: Mismatch[];
}

async function runPhp(php: string, script: string, stdin: string | null, cwd: string, args: string[] = []): Promise<{ code: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn([php, script, ...args], { cwd, stdin: stdin === null ? 'ignore' : 'pipe', stdout: 'pipe', stderr: 'pipe' });
	if (stdin !== null && proc.stdin) {
		proc.stdin.write(stdin);
		await proc.stdin.end();
	}
	const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
	return { code, stdout, stderr };
}

/** The curated game-server associations of a theme (GameServerExtras::fileAssociations($theme) / folderAssociations($theme)). */
export async function loadExtras(php: string, root: string, theme: ThemeId = 'material'): Promise<ExtraAssociations> {
	const r = await runPhp(php, join(root, 'tests/php/extras.php'), null, root, [theme]);
	if (r.code !== 0) {
		throw new Error(`tests/php/extras.php ${theme} failed (exit ${r.code}): ${(r.stderr || r.stdout).trim().slice(0, 2000)}`);
	}
	return JSON.parse(r.stdout);
}

/** JS string length (UTF-16 code units) vs code points, after VS Code's lowercasing. */
function hints(c: Case): string[] {
	const h: string[] = [];
	const lower = c.name.toLowerCase();
	const cps = [...lower].length;
	if (lower.length > 255 && cps <= 255) h.push('utf16-length>255');
	if (lower.length <= 255 && cps > 255) h.push('codepoints>255');
	if (/\\/.test(c.name)) h.push('backslash');
	if (/[\n\r]/.test(c.name)) h.push('newline');
	if (/[^\S ]/.test(c.name)) h.push('non-space-whitespace');
	return h;
}

function sameSource(a: OracleResult['dark']['source'], b: OracleResult['dark']['source']): boolean {
	return !!a && !!b && a.table === b.table && a.key === b.key;
}

function classify(theme: 'dark' | 'light', c: Case, o: OracleResult, php: PhpEntry, actual: string | null): string {
	if (php !== null && 'error' in php) {
		return 'php-error';
	}
	const phpSource = php === null ? 'null' : php.source;
	const h = hints(c);
	const suffix = h.length ? ` [${h.join(',')}]` : '';
	if (theme === 'dark') {
		if (actual !== null && o.dark.tiedWith.includes(actual)) {
			return `dark-rule-order-tie (equal specificity; VS Code shows the icon whose CSS rule comes later)${suffix}`;
		}
		return `dark ${c.kind}: vscode=${o.dark.source ? o.dark.source.table : 'none'} php=${phpSource}${suffix}`;
	}
	const dark = o.dark;
	const light = o.light;
	if (
		light.source?.section === 'light' &&
		light.specificity === dark.specificity &&
		!sameSource(light.source, dark.source) &&
		actual === o.sameKeyLight
	) {
		return 'light-tie-quirk';
	}
	if (light.icon === dark.icon && dark.icon !== null && actual === dark.icon + '_light') {
		return `light-association-has-no-light-mapping (Material adds no light entry for associations; VS Code keeps the dark icon)${suffix}`;
	}
	if (light.source?.section === 'light' && sameSource(light.source, dark.source) && light.icon !== actual) {
		return `light-association-overrides-light-key (Material keeps the built-in light entry, so VS Code light still shows it)${suffix}`;
	}
	return `light ${c.kind}: vscode=${light.source ? `${light.source.section}:${light.source.table}` : 'none'} php=${phpSource}${suffix}`;
}

function fmtCase(m: Mismatch): string {
	const c = m.case;
	const name = JSON.stringify(c.name.length > 60 ? c.name.slice(0, 28) + '…' + c.name.slice(-28) + ` (len ${c.name.length})` : c.name);
	const php = m.php === null ? 'null' : 'error' in m.php ? `ERROR ${m.php.error}` : `${m.php.icon}/${m.php.lightIcon ?? '-'} (${m.php.source})`;
	return `${c.kind} ${name} in ${JSON.stringify(c.directory)}${c.mime ? ` mime=${c.mime}` : ''}: vscode ${m.theme}=${m.expected} via ${m.theme === 'dark' ? m.oracle.dark.via : m.oracle.light.via} | php ${php}`;
}

export interface ParityOptions {
	php: string;
	root: string;
	examples?: number;
	configs?: ParityConfig[];
	log?: (line: string) => void;
}

export async function runParity(opts: ParityOptions): Promise<ParityReport> {
	const { php, root } = opts;
	const examples = opts.examples ?? 4;
	const configs = opts.configs ?? PARITY_CONFIGS;
	const log = opts.log ?? (() => {});
	const lines: string[] = [];

	const langs = loadVscodeLanguages(join(root, 'scripts/data/vscode-languages.json'));
	const registry = createLanguageAssociations(langs.contributions);
	const usedThemes = new Set<ThemeId>(configs.map(c => c.theme ?? 'material'));
	const extras = new Map<ThemeId, ExtraAssociations>();
	for (const theme of usedThemes) {
		extras.set(theme, await loadExtras(php, root, theme));
	}

	// Datapack Icons source (raw active.json from the cached VSIX)
	let datapack: DatapackSource | null = null;
	let runnable = configs;
	let setupFailed = false;
	if (usedThemes.has('datapack')) {
		try {
			datapack = loadDatapackSource(root);
		} catch (e) {
			if (!(e instanceof DatapackSourceError)) throw e;
			lines.push(`datapack: ${e.message}`);
			runnable = configs.filter(c => (c.theme ?? 'material') !== 'datapack');
			setupFailed = true;
		}
	}

	// Manifests per config (+ every Material pack and the raw datapack theme, only for harvesting corpus keys)
	const manifests = new Map<string, IconThemeDocument>();
	for (const cfg of runnable) {
		const theme = cfg.theme ?? 'material';
		manifests.set(
			cfg.name,
			theme === 'datapack' ? datapackManifest(datapack!, cfg.options, extras.get(theme)) : generateManifest(cfg.options, extras.get(theme)),
		);
	}
	const harvest: IconThemeDocument[] = [...manifests.values()];
	for (const pack of material.availableIconPacks) {
		harvest.push(material.generateManifest({ activeIconPack: pack }));
	}
	if (datapack) {
		harvest.push(datapack.theme, datapackClosedFolderDocument(datapack.theme));
	}
	const fileKeys = new Set<string>();
	const folderKeys = new Set<string>();
	for (const e of extras.values()) {
		Object.keys(e.fileAssociations).forEach(k => fileKeys.add(k));
		Object.keys(e.folderAssociations).forEach(k => folderKeys.add(k));
	}
	for (const cfg of configs) {
		Object.keys(cfg.options.fileAssociations ?? {}).forEach(k => fileKeys.add(k));
		Object.keys(cfg.options.folderAssociations ?? {}).forEach(k => folderKeys.add(k));
	}
	const corpus = buildCorpus({
		manifests: harvest,
		languages: langs.contributions,
		fileAssociationKeys: [...fileKeys],
		folderAssociationKeys: [...folderKeys],
	});
	const payloadCases = corpus.map(c => ({ kind: c.kind, name: c.name, directory: c.directory, mime: c.mime ?? null }));
	lines.push(
		`parity: ${runnable.length} configs x ${corpus.length} cases x {dark, light} (VS Code ${langs.tag}${datapack ? `, mc-dp-icons ${datapack.version}` : ''}, oracle vs tests/php/resolve.php)`,
	);

	const mismatches: Mismatch[] = [];
	for (const cfg of runnable) {
		const t0 = performance.now();
		const oracle = new Oracle(manifests.get(cfg.name)!, registry);
		const phpOptions: Record<string, unknown> = { ...cfg.options };
		const payload = { theme: cfg.theme ?? 'material', options: phpOptions, cases: payloadCases };
		const r = await runPhp(php, join(root, 'tests/php/resolve.php'), JSON.stringify(payload), root);
		if (r.code !== 0) {
			lines.push(`  ${cfg.name.padEnd(24)} PHP FAILED (exit ${r.code}): ${(r.stderr || r.stdout).trim().slice(0, 1500)}`);
			mismatches.push({
				config: cfg.name,
				theme: 'dark',
				cause: 'php-crash',
				case: corpus[0],
				expected: null,
				actual: null,
				oracle: oracle.resolve(corpus[0]),
				php: { error: 'resolve.php crashed' },
			});
			continue;
		}
		let results: PhpEntry[];
		try {
			results = JSON.parse(r.stdout);
		} catch (e) {
			lines.push(`  ${cfg.name.padEnd(24)} PHP output is not JSON: ${String(e)} ${r.stdout.slice(0, 300)}`);
			mismatches.push({ config: cfg.name, theme: 'dark', cause: 'php-crash', case: corpus[0], expected: null, actual: null, oracle: oracle.resolve(corpus[0]), php: { error: 'invalid JSON' } });
			continue;
		}
		if (!Array.isArray(results) || results.length !== corpus.length) {
			lines.push(`  ${cfg.name.padEnd(24)} PHP returned ${Array.isArray(results) ? results.length : typeof results} results for ${corpus.length} cases`);
			mismatches.push({ config: cfg.name, theme: 'dark', cause: 'php-crash', case: corpus[0], expected: null, actual: null, oracle: oracle.resolve(corpus[0]), php: { error: 'wrong result count' } });
			continue;
		}

		let dark = 0;
		let light = 0;
		let allowed = 0;
		for (let i = 0; i < corpus.length; i++) {
			const c = corpus[i];
			const o = oracle.resolve(c);
			const p = results[i];
			const isError = p !== null && 'error' in p;
			const actualDark = p === null || isError ? null : (p as PhpResult).icon;
			const actualLight = p === null || isError ? null : ((p as PhpResult).lightIcon ?? (p as PhpResult).icon);
			const push = (theme: 'dark' | 'light', expected: string | null, actual: string | null) => {
				const cause = classify(theme, c, o, p, actual);
				mismatches.push({ config: cfg.name, theme, cause, case: c, expected, actual, oracle: o, php: p });
				if (ALLOW_LIST[cause]) {
					allowed++;
				} else if (theme === 'dark') {
					dark++;
				} else {
					light++;
				}
			};
			if (isError || o.dark.icon !== actualDark) {
				push('dark', o.dark.icon, actualDark);
			} else if (o.light.icon !== actualLight) {
				// light is only judged when dark agrees (otherwise it is the same root cause)
				push('light', o.light.icon, actualLight);
			}
		}
		const ms = Math.round(performance.now() - t0);
		const status = dark + light === 0 ? 'ok' : 'FAIL';
		lines.push(
			`  ${cfg.name.padEnd(24)} ${status.padEnd(4)} dark mismatches ${String(dark).padStart(5)}  light mismatches ${String(light).padStart(5)}  allow-listed ${String(allowed).padStart(4)}  (${ms} ms)`,
		);
		log(lines[lines.length - 1]);
	}

	// Group by cause (across configs)
	const groups = new Map<string, Mismatch[]>();
	for (const m of mismatches) {
		const list = groups.get(m.cause) ?? [];
		list.push(m);
		groups.set(m.cause, list);
	}
	const sorted = [...groups.entries()].sort((a, b) => Number(!!ALLOW_LIST[a[0]]) - Number(!!ALLOW_LIST[b[0]]) || b[1].length - a[1].length);
	if (sorted.length) {
		lines.push('mismatch summary (grouped by cause):');
	}
	for (const [cause, list] of sorted) {
		const perConfig = new Map<string, number>();
		for (const m of list) perConfig.set(m.config, (perConfig.get(m.config) ?? 0) + 1);
		const cfgs = [...perConfig.entries()].map(([k, v]) => `${k}: ${v}`).join(', ');
		lines.push(`  [${ALLOW_LIST[cause] ? 'allowed' : 'FAIL'}] ${cause}  x${list.length}  (${cfgs})`);
		if (ALLOW_LIST[cause]) {
			lines.push(`      justification: ${ALLOW_LIST[cause]}`);
		}
		// distinct examples (prefer different configs / names)
		const shown = new Set<string>();
		let n = 0;
		for (const m of list) {
			const key = `${m.case.kind}:${m.case.name.toLowerCase()}`;
			if (shown.has(key)) continue;
			shown.add(key);
			lines.push(`      - [${m.config}] ${fmtCase(m)}`);
			if (++n >= examples) break;
		}
	}

	const failing = mismatches.filter(m => !ALLOW_LIST[m.cause]).length;
	const ok = failing === 0 && !setupFailed;
	lines.push(
		`parity: ${ok ? 'OK' : 'FAILED'} (${failing} failing, ${mismatches.length - failing} allow-listed mismatches${setupFailed ? '; datapack configs NOT RUN' : ''})`,
	);
	return { ok, lines, mismatches };
}

if (import.meta.main) {
	const root = join(import.meta.dir, '..');
	const php = process.env.PHP_BINARY || 'php';
	const examples = Number(process.env.PARITY_EXAMPLES ?? '4');
	const report = await runParity({ php, root, examples, log: () => {} });
	console.log(report.lines.join('\n'));
	if (process.env.PARITY_DUMP) {
		await Bun.write(process.env.PARITY_DUMP, JSON.stringify(report.mismatches.map(m => ({ ...m, oracle: { dark: m.oracle.dark, light: m.oracle.light, languageId: m.oracle.languageId } })), null, 1));
	}
	process.exit(report.ok ? 0 : 1);
}
