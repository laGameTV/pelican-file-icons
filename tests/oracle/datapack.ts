/**
 * Datapack Icons (marketplace `SuperAnt.mc-dp-icons`) as a black box: the RAW
 * `extension/icon_theme/active.json` from the pinned VSIX, exactly what VS Code
 * loads when the theme is active.
 *
 * The VSIX is the one cached by `bun run build` at
 * `scripts/.cache/mc-dp-icons-<version>.vsix` (version + sha256 pinned in
 * `scripts/data/sources.json`). The test never downloads anything; if the
 * cache is missing it fails with a hint to run `bun run build`.
 * `DATAPACK_VSIX=<file>` overrides the location (still sha256-verified).
 *
 * The archive is untrusted data: only `extension/icon_theme/active.json` and
 * `extension/icons/*.svg` are inflated (in memory, size-capped), nothing is
 * written to disk.
 *
 * `datapackManifest()` turns the raw document into the document whose VS Code
 * rendering the plugin must reproduce:
 * 1. documented deviation (SPEC2 §1): the file manager only shows CLOSED
 *    folders, but Datapack Icons has specific icons only for expanded ones, so
 *    `folderNames := folderNamesExpanded ∪ folderNames` (closed entries win);
 * 2. folder theme (plugin option, same meaning as for Material):
 *    `specific` = as is, `classic` = generic folder icon only (no folder name
 *    rules), `none` = no folder icons at all;
 * 3. game-server extras / associations with Material's association semantics
 *    (./associations.ts), extras first so custom ones win.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { unzipSync } from 'fflate';
import { applyMaterialAssociations } from './associations.ts';
import type { ExtraAssociations, PluginOptions } from './material.ts';
import type { IconThemeDocument } from './vscode/iconTheme.ts';

export const DATAPACK_PACKAGE = 'mc-dp-icons';
const ACTIVE_JSON = 'extension/icon_theme/active.json';
const ICON_ENTRY = /^extension\/icons\/[A-Za-z0-9_.-]+\.svg$/;
const ICON_PATH = /^\.\.\/icons\/([A-Za-z0-9_.-]+\.svg)$/;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;

export class DatapackSourceError extends Error {}

export interface DatapackSource {
	version: string;
	sha256: string;
	vsixPath: string;
	/** Raw `active.json` (never mutated; clone before use). */
	theme: IconThemeDocument & Record<string, unknown>;
	/** SVG bytes per icon definition id (resolved through `iconPath`). */
	svgs: Map<string, Uint8Array>;
}

interface SourcesFile {
	[name: string]: { version?: string; sha256?: string } | undefined;
}

let cached: DatapackSource | null = null;

export function datapackVsixPath(root: string): { path: string; version: string; sha256: string } {
	const sourcesFile = join(root, 'scripts/data/sources.json');
	if (!existsSync(sourcesFile)) {
		throw new DatapackSourceError('scripts/data/sources.json is missing (it pins the Datapack Icons VSIX); run `bun run build`.');
	}
	const sources: SourcesFile = JSON.parse(readFileSync(sourcesFile, 'utf8'));
	const pin = sources[DATAPACK_PACKAGE];
	if (!pin?.version || !pin.sha256 || !/^[0-9a-f]{64}$/.test(pin.sha256)) {
		throw new DatapackSourceError(`scripts/data/sources.json has no valid "${DATAPACK_PACKAGE}" entry (version + sha256).`);
	}
	const path = process.env.DATAPACK_VSIX || join(root, 'scripts/.cache', `${DATAPACK_PACKAGE}-${pin.version}.vsix`);
	return { path, version: pin.version, sha256: pin.sha256 };
}

export function loadDatapackSource(root: string): DatapackSource {
	if (cached) {
		return cached;
	}
	const { path, version, sha256 } = datapackVsixPath(root);
	const shown = process.env.DATAPACK_VSIX ? path : relative(root, path).replace(/\\/g, '/');
	if (!existsSync(path) && process.env.DATAPACK_VSIX) {
		throw new DatapackSourceError(`DATAPACK_VSIX=${path} does not exist (unset it to use the copy cached by \`bun run build\` in scripts/.cache/).`);
	}
	if (!existsSync(path)) {
		throw new DatapackSourceError(
			`Datapack Icons ${version} VSIX not found at ${shown}. Run \`bun run build\` first: it downloads the pinned VSIX into scripts/.cache/ and the tests read the raw theme from there.`,
		);
	}
	const bytes = readFileSync(path);
	const actual = createHash('sha256').update(bytes).digest('hex');
	if (actual !== sha256) {
		throw new DatapackSourceError(`${shown}: sha256 ${actual} does not match the pinned ${sha256} (scripts/data/sources.json). Delete it and run \`bun run build\`.`);
	}
	let entries: Record<string, Uint8Array>;
	try {
		entries = unzipSync(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
			filter: f => (f.name === ACTIVE_JSON || ICON_ENTRY.test(f.name)) && f.originalSize <= MAX_ENTRY_BYTES,
		});
	} catch (e) {
		throw new DatapackSourceError(`${shown}: cannot unzip: ${e instanceof Error ? e.message : String(e)}`);
	}
	const raw = entries[ACTIVE_JSON];
	if (!raw) {
		throw new DatapackSourceError(`${shown}: ${ACTIVE_JSON} not found in the VSIX.`);
	}
	const theme = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
	if (!theme || typeof theme !== 'object' || typeof theme.iconDefinitions !== 'object') {
		throw new DatapackSourceError(`${shown}: ${ACTIVE_JSON} is not an icon theme document.`);
	}
	const svgs = new Map<string, Uint8Array>();
	for (const [id, def] of Object.entries<{ iconPath?: string }>(theme.iconDefinitions)) {
		const m = def?.iconPath ? ICON_PATH.exec(def.iconPath) : null;
		const data = m ? entries[`extension/icons/${m[1]}`] : undefined;
		if (data) {
			svgs.set(id, data);
		}
	}
	cached = { version, sha256, vsixPath: path, theme, svgs };
	return cached;
}

/** Icon definition ids VS Code can render (definition exists and its SVG is in the VSIX). */
export function datapackRenderableIcons(source: DatapackSource): Set<string> {
	return new Set(source.svgs.keys());
}

/**
 * Datapack folder association value -> icon id. Datapack Icons has no
 * `folder-<suffix>` naming; the plugin's datapack lists use full icon ids
 * (empty value = the generic folder, like Material's `''`).
 */
export function datapackFolderIcon(theme: IconThemeDocument): (value: string) => string {
	return (value: string) => (value ? value.toLowerCase() : (theme.folder ?? ''));
}

/** Step 1 only: the raw theme with the documented closed-folder deviation. */
export function datapackClosedFolderDocument(raw: IconThemeDocument): IconThemeDocument {
	const doc = structuredClone(raw);
	doc.folderNames = { ...(doc.folderNamesExpanded ?? {}), ...(doc.folderNames ?? {}) };
	return doc;
}

/** The document VS Code would render for the plugin options (see header). */
export function datapackManifest(source: DatapackSource, options: PluginOptions, extras?: ExtraAssociations): IconThemeDocument {
	const doc = datapackClosedFolderDocument(source.theme);
	const folderTheme = options.folderTheme ?? 'specific';
	if (folderTheme === 'classic') {
		doc.folderNames = {};
		doc.rootFolderNames = {};
	} else if (folderTheme === 'none') {
		for (const k of ['folder', 'folderExpanded', 'rootFolder', 'rootFolderExpanded', 'folderNames', 'folderNamesExpanded', 'rootFolderNames', 'rootFolderNamesExpanded'] as const) {
			delete doc[k];
		}
	}
	const useExtras = options.gameServerExtras ?? true;
	if (useExtras && !extras) {
		throw new Error('datapackManifest: gameServerExtras enabled but no extras associations supplied');
	}
	const files = { ...(useExtras ? extras!.fileAssociations : {}), ...(options.fileAssociations ?? {}) };
	const folders = { ...(useExtras ? extras!.folderAssociations : {}), ...(options.folderAssociations ?? {}) };
	const renderable = datapackRenderableIcons(source);
	applyMaterialAssociations(doc, files, folders, {
		folderTheme,
		folderIcon: datapackFolderIcon(source.theme),
		isKnownIcon: icon => renderable.has(icon),
	});
	return doc;
}
