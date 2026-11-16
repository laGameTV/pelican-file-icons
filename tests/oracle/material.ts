/**
 * Material Icon Theme as a black box: the REAL `generateManifest(config)` from
 * the installed `material-icon-theme` package (dist/module/index.cjs).
 *
 * Maps the plugin options (SPEC §4 `IconThemeOptions`) to Material's
 * `ManifestConfig` the way a VS Code user would configure the extension:
 *   iconPack           -> activeIconPack       (null => not set => Material default)
 *   folderTheme        -> folders.theme
 *   fileAssociations   -> files.associations   (game-server extras first, so custom ones win)
 *   folderAssociations -> folders.associations (same)
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { IconThemeDocument } from './vscode/iconTheme.ts';

const require = createRequire(import.meta.url);

export interface MaterialModule {
	availableIconPacks: string[];
	generateManifest: (config?: unknown) => IconThemeDocument & Record<string, unknown>;
}

export const material: MaterialModule = require('material-icon-theme/dist/module/index.cjs');

export const materialPackageDir = dirname(require.resolve('material-icon-theme/package.json'));
export const materialVersion: string = require('material-icon-theme/package.json').version;

export interface PluginOptions {
	iconPack?: string | null;
	folderTheme?: 'specific' | 'classic' | 'none';
	fileAssociations?: Record<string, string>;
	folderAssociations?: Record<string, string>;
	gameServerExtras?: boolean;
	mimeFallback?: boolean;
}

export interface ExtraAssociations {
	fileAssociations: Record<string, string>;
	folderAssociations: Record<string, string>;
}

export function toManifestConfig(options: PluginOptions, extras?: ExtraAssociations): Record<string, unknown> {
	const config: Record<string, unknown> = {};
	if (options.iconPack !== undefined && options.iconPack !== null) {
		config.activeIconPack = options.iconPack;
	}
	const useExtras = options.gameServerExtras ?? true;
	if (useExtras && !extras) {
		throw new Error('toManifestConfig: gameServerExtras enabled but no extras associations supplied');
	}
	const files = { ...(useExtras ? extras!.fileAssociations : {}), ...(options.fileAssociations ?? {}) };
	const folders = { ...(useExtras ? extras!.folderAssociations : {}), ...(options.folderAssociations ?? {}) };
	config.files = { associations: files };
	config.folders = { theme: options.folderTheme ?? 'specific', associations: folders };
	return config;
}

export function generateManifest(options: PluginOptions, extras?: ExtraAssociations): IconThemeDocument {
	return material.generateManifest(toManifestConfig(options, extras));
}

/** Whether VS Code could actually load the SVG of a definition (`iconPath` is relative to `dist/`). */
export function definitionFileExists(manifest: IconThemeDocument, defId: string): boolean {
	const def = manifest.iconDefinitions?.[defId];
	if (!def?.iconPath) {
		return false;
	}
	return existsSync(join(materialPackageDir, 'dist', def.iconPath));
}
