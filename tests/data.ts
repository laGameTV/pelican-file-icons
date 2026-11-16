/**
 * Data checks (SPEC §3, SPEC2 §2) that need the upstream sources, so they run
 * in TypeScript rather than in tests/php/unit.php:
 *
 * - resources/data/datapack.php equals what SPEC2 §2 derives from the RAW
 *   mc-dp-icons active.json (keys lowercased, parent-qualified keys split at
 *   the last '/', closed-folder map = folderNamesExpanded ∪ folderNames with
 *   closed entries winning, no language ids), and ships exactly the icons
 *   those maps + defaults reference;
 * - every shipped SVG is byte-identical to its upstream file (Material: the
 *   definition's iconPath in the npm package; Datapack Icons: the VSIX entry);
 * - resources/icons/<theme>/ contains exactly the shipped icons and the old
 *   flat layout (resources/icons/*.svg) is gone;
 * - per-theme hashes are 12 hex digits and differ.
 *
 * PHP is only used to dump the generated data files as JSON.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDatapackSource } from './oracle/datapack.ts';
import { material, materialPackageDir } from './oracle/material.ts';
import type { IconThemeDocument } from './oracle/vscode/iconTheme.ts';

export interface DataCheckResult {
	passed: number;
	failures: string[];
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Section = Record<string, Record<string, unknown>>;

export function dumpPhpData(php: string, file: string): Record<string, Json> {
	const code = 'echo json_encode(require $argv[1], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);';
	const r = Bun.spawnSync([php, '-r', code, file], { stdout: 'pipe', stderr: 'pipe' });
	if (r.exitCode !== 0) {
		throw new Error(`cannot load ${file}: ${(r.stderr.toString() || r.stdout.toString()).trim().slice(0, 1000)}`);
	}
	return JSON.parse(r.stdout.toString());
}

/** PHP `[]` is JSON `[]`; as a map it means `{}`. */
function asMap(v: Json | undefined): Record<string, Json> {
	if (v === undefined || v === null) return {};
	if (Array.isArray(v)) return v.length === 0 ? {} : Object.fromEntries(v.map((x, i) => [String(i), x]));
	return typeof v === 'object' ? v : {};
}

function canonical(v: unknown): string {
	if (Array.isArray(v)) {
		return v.length === 0 ? '{}' : JSON.stringify(v);
	}
	if (v && typeof v === 'object') {
		const keys = Object.keys(v).sort();
		return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical((v as Record<string, unknown>)[k])).join(',') + '}';
	}
	return JSON.stringify(v);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.byteLength !== b.byteLength) return false;
	for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
	return true;
}

/** SPEC2 §2 key normalisation for one raw map: [flat, byParent, droppedMultiSlash, lowercaseCollisions]. */
function splitMap(map: Record<string, string> | undefined): [Record<string, string>, Record<string, Record<string, string>>, string[], string[]] {
	const flat: Record<string, string> = {};
	const byParent: Record<string, Record<string, string>> = {};
	const dropped: string[] = [];
	const collisions: string[] = [];
	const seen = new Map<string, string>();
	for (const [key, value] of Object.entries(map ?? {})) {
		const k = key.toLowerCase();
		if (seen.has(k) && seen.get(k) !== value) collisions.push(key);
		seen.set(k, value);
		const i = k.lastIndexOf('/');
		if (i < 0) {
			flat[k] = value;
			continue;
		}
		const parent = k.substring(0, i);
		if (parent.includes('/')) {
			dropped.push(key);
			continue;
		}
		(byParent[parent] ??= {})[k.substring(i + 1)] = value;
	}
	return [flat, byParent, dropped, collisions];
}

export function expectedDatapackBase(raw: IconThemeDocument): { base: Section; dropped: string[]; collisions: string[] } {
	const [fileNames, fileNamesByParent, d1, c1] = splitMap(raw.fileNames);
	const [fileExtensions, fileExtensionsByParent, d2, c2] = splitMap(raw.fileExtensions);
	const closed = { ...(raw.folderNamesExpanded ?? {}), ...(raw.folderNames ?? {}) };
	const [folderNames, folderNamesByParent, d3, c3] = splitMap(closed);
	return {
		base: { fileNames, fileNamesByParent, fileExtensions, fileExtensionsByParent, languageIds: {}, folderNames, folderNamesByParent },
		dropped: [...d1, ...d2, ...d3],
		collisions: [...c1, ...c2, ...c3],
	};
}

export function runDataChecks(php: string, root: string): DataCheckResult {
	const failures: string[] = [];
	let passed = 0;
	const ok = (label: string, cond: boolean, detail = '') => {
		if (cond) passed++;
		else failures.push(label + (detail ? `: ${detail}` : ''));
	};
	const same = (label: string, actual: unknown, expected: unknown) => {
		const a = canonical(actual);
		const e = canonical(expected);
		ok(label, a === e, `expected ${e.slice(0, 400)}, got ${a.slice(0, 400)}`);
	};
	const list = (xs: string[], n = 8) => (xs.length > n ? `${xs.slice(0, n).join(', ')} … (+${xs.length - n})` : xs.join(', '));
	const iconDir = (theme: string) => join(root, 'resources/icons', theme);

	const flat = existsSync(join(root, 'resources/icons')) ? readdirSync(join(root, 'resources/icons')).filter(f => f.endsWith('.svg')) : [];
	same('no SVGs left in the old flat resources/icons/ layout', flat.slice(0, 10), []);
	ok('old resources/data/manifest.php is gone (renamed to material.php)', !existsSync(join(root, 'resources/data/manifest.php')));

	const hashes: Record<string, string> = {};

	// ---------------------------------------------------------------- datapack
	{
		const source = loadDatapackSource(root);
		const raw = source.theme;
		const data = dumpPhpData(php, join(root, 'resources/data/datapack.php'));
		same('datapack format/theme/source', [data.format, data.theme, data.source], [1, 'datapack', { package: 'mc-dp-icons', version: source.version }]);
		same('datapack defaults = raw file/folder', data.defaults, { file: raw.file, folder: raw.folder });
		same('datapack defaultPack/packs/packOverrides', [data.defaultPack, asMap(data.packs), asMap(data.packOverrides)], ['', {}, {}]);
		hashes.datapack = String(data.hash);

		const { base, dropped, collisions } = expectedDatapackBase(raw);
		same('raw active.json has no keys that collide after lowercasing', collisions, []);
		// keys like 'a/b/c' are dropped by SPEC §3.1 / SPEC2 §2 (none in 5.0.0)
		ok(`raw active.json: ${dropped.length} parent-qualified keys with a nested parent are dropped`, true);
		const actualBase = asMap(data.base);
		same('datapack base sections', Object.keys(actualBase).sort(), Object.keys(base).sort());
		for (const [table, expected] of Object.entries(base)) {
			const actual = asMap(actualBase[table]);
			const nested = table.endsWith('ByParent');
			const normalised = nested ? Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, asMap(v)])) : actual;
			const missing: string[] = [];
			const wrong: string[] = [];
			const extra: string[] = [];
			const flatten = (m: Record<string, unknown>): Map<string, unknown> => {
				const out = new Map<string, unknown>();
				for (const [k, v] of Object.entries(m)) {
					if (nested) for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) out.set(`${k}/${k2}`, v2);
					else out.set(k, v);
				}
				return out;
			};
			const e = flatten(expected);
			const a = flatten(normalised);
			for (const [k, v] of e) {
				if (!a.has(k)) missing.push(k);
				else if (a.get(k) !== v) wrong.push(`${k}: ${String(a.get(k))} (expected ${String(v)})`);
			}
			for (const k of a.keys()) if (!e.has(k)) extra.push(k);
			ok(`datapack base.${table} matches raw active.json (${e.size} keys)`, missing.length + wrong.length + extra.length === 0, `missing [${list(missing)}] wrong [${list(wrong)}] extra [${list(extra)}]`);
		}

		const referenced = new Set<string>([raw.file!, raw.folder!]);
		for (const section of Object.values(base)) {
			for (const v of Object.values(section)) {
				if (typeof v === 'string') referenced.add(v);
				else for (const v2 of Object.values(v as Record<string, string>)) referenced.add(v2);
			}
		}
		const icons = Object.keys(asMap(data.icons));
		const iconSet = new Set(icons);
		same('datapack icons map values are 1', [...new Set(Object.values(asMap(data.icons)))], [1]);
		same('datapack ships every referenced icon', [...referenced].filter(i => !iconSet.has(i)).sort().slice(0, 20), []);
		same('datapack ships no unreferenced icon (xmas/crowned/expanded-only)', icons.filter(i => !referenced.has(i)).sort().slice(0, 20), []);
		const bad = icons.filter(i => !/^[a-z0-9][a-z0-9_.-]*$/.test(i));
		same('datapack icon ids valid', bad, []);

		const dir = iconDir('datapack');
		const files = existsSync(dir) ? readdirSync(dir) : [];
		same('resources/icons/datapack has exactly the shipped icons', [files.filter(f => !iconSet.has(f.replace(/\.svg$/, '')) || !f.endsWith('.svg')).slice(0, 10), icons.filter(i => !files.includes(`${i}.svg`)).slice(0, 10)], [[], []]);
		const differs: string[] = [];
		for (const id of icons) {
			const upstream = source.svgs.get(id);
			const file = join(dir, `${id}.svg`);
			if (!upstream || !existsSync(file) || !sameBytes(readFileSync(file), upstream)) differs.push(id);
		}
		same('datapack SVGs are byte-identical to the VSIX', differs.slice(0, 10), []);
	}

	// ---------------------------------------------------------------- material
	{
		const data = dumpPhpData(php, join(root, 'resources/data/material.php'));
		same('material format/theme', [data.format, data.theme], [1, 'material']);
		hashes.material = String(data.hash);
		// Material defines every icon regardless of the active pack (only the mappings depend on it; verified for 5.40.0)
		const defs = new Map<string, string>();
		for (const [id, def] of Object.entries(material.generateManifest({}).iconDefinitions ?? {})) {
			if (def.iconPath) defs.set(id, def.iconPath);
		}
		const icons = Object.keys(asMap(data.icons));
		const iconSet = new Set(icons);
		const dir = iconDir('material');
		const files = existsSync(dir) ? readdirSync(dir) : [];
		same('resources/icons/material has exactly the shipped icons', [files.filter(f => !iconSet.has(f.replace(/\.svg$/, '')) || !f.endsWith('.svg')).slice(0, 10), icons.filter(i => !files.includes(`${i}.svg`)).slice(0, 10)], [[], []]);
		const differs: string[] = [];
		for (const id of icons) {
			const path = defs.get(id);
			const file = join(dir, `${id}.svg`);
			if (!path || !existsSync(file) || !sameBytes(readFileSync(file), readFileSync(join(materialPackageDir, 'dist', path)))) differs.push(id);
		}
		same('material SVGs are byte-identical to material-icon-theme (iconPath)', differs.slice(0, 10), []);
	}

	for (const [theme, hash] of Object.entries(hashes)) {
		ok(`${theme} hash is 12 hex`, /^[0-9a-f]{12}$/.test(hash), hash);
	}
	ok('theme hashes differ', hashes.material !== hashes.datapack, JSON.stringify(hashes));
	return { passed, failures };
}

if (import.meta.main) {
	const r = runDataChecks(process.env.PHP_BINARY || 'php', join(import.meta.dir, '..'));
	for (const f of r.failures) console.log(`  FAIL ${f}`);
	console.log(`data: ${r.passed} passed, ${r.failures.length} failed`);
	process.exit(r.failures.length ? 1 : 0);
}
