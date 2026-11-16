/**
 * Material Icon Theme's `files.associations` / `folders.associations`
 * semantics, applied to an EXISTING icon theme document.
 *
 * Needed for themes that have no generator of their own (Datapack Icons):
 * SPEC2 §3 applies the game-server extras to every theme "with the same
 * Material association semantics". Ported from material-icon-theme 5.40.0
 * (`src/core/generator/fileGenerator.ts` `loadFileIconDefinitions`,
 * `mapSpecificFileIcons`, `getCustomIcons`; `folderGenerator.ts`
 * `loadFolderIconDefinitions`, `getCustomIcons`, `extendFolderNames`, and
 * `helpers/object.ts` `merge`):
 *
 * Files
 * - every key is lowercased, every value is lowercased;
 * - `*.ext` / `**.ext` (`/^\*{1,2}\./`) => `fileExtensions[ext]`, anything
 *   else => `fileNames[key]`;
 * - custom icons are mapped after all built-in ones, so they overwrite a key
 *   in place (JS property order of an existing key is kept, new keys are
 *   appended);
 * - a `**.ext` key suppresses every fileNames mapping (built-in AND custom,
 *   dark/light/high contrast) whose lowercased name contains `.ext`;
 * - an empty value maps the key to `''`, for which VS Code emits no rule.
 *
 * Folders
 * - folder theme `none` ignores folder associations completely;
 * - otherwise every association name is lowercased and extended to the five
 *   variants `x`, `.x`, `_x`, `-x`, `__x__`, each mapped to the association's
 *   icon (custom icons come last, so they overwrite);
 * - only `folderNames` matters for closed folders (the `-open` expanded
 *   variants are not modelled).
 *
 * Material creates an icon definition for every custom icon name (VS Code
 * then shows a broken image if the SVG does not exist); the plugin ignores
 * association values that are not shipped icons. That is decided by the
 * caller through `isKnownIcon`, which drops the whole association.
 */

import type { IconsAssociation, IconThemeDocument } from './vscode/iconTheme.ts';

const WILDCARD = /^\*{1,2}\./;
const OVERWRITE_FILE_NAMES = /^\*{2}\./;

export const FOLDER_NAME_VARIANTS: ReadonlyArray<readonly [string, string]> = [
	['', ''],
	['.', ''],
	['_', ''],
	['-', ''],
	['__', '__'],
];

export interface AssociationOptions {
	folderTheme: 'specific' | 'classic' | 'none';
	/** Icon definition id for a folder association value (Material: `v ? 'folder-' + v.toLowerCase() : 'folder'`). */
	folderIcon: (value: string) => string;
	/** Whether the association target exists; unknown targets drop the association. */
	isKnownIcon?: (icon: string) => boolean;
}

export interface AppliedAssociations {
	/** Associations dropped because their icon is unknown (diagnostics). */
	ignored: string[];
}

/** Material's folder association value -> icon id. */
export function materialFolderIcon(value: string): string {
	return value ? `folder-${value.toLowerCase()}` : 'folder';
}

/**
 * Mutates `doc`: applies the associations (in object key order) like
 * Material's generator would have done while generating `doc`.
 */
export function applyMaterialAssociations(
	doc: IconThemeDocument,
	fileAssociations: Record<string, string>,
	folderAssociations: Record<string, string>,
	options: AssociationOptions,
): AppliedAssociations {
	const ignored: string[] = [];
	const known = (icon: string) => icon === '' || !options.isKnownIcon || options.isKnownIcon(icon);

	// --- files ---
	const overwrite = Object.keys(fileAssociations)
		.filter(k => OVERWRITE_FILE_NAMES.test(k))
		.map(k => k.replace(WILDCARD, '.').toLowerCase());
	const suppressed = (name: string) => overwrite.some(ext => name.toLowerCase().indexOf(ext) !== -1);
	const sections: Array<IconsAssociation | undefined> = [doc, doc.light, doc.highContrast];
	if (overwrite.length) {
		for (const section of sections) {
			const fileNames = section?.fileNames;
			if (!fileNames) continue;
			for (const key of Object.keys(fileNames)) {
				if (suppressed(key)) delete fileNames[key];
			}
		}
	}
	for (const key of Object.keys(fileAssociations)) {
		const icon = String(fileAssociations[key]).toLowerCase();
		if (!known(icon)) {
			ignored.push(`file ${key} => ${icon}`);
			continue;
		}
		if (WILDCARD.test(key)) {
			(doc.fileExtensions ??= {})[key.toLowerCase().replace(WILDCARD, '')] = icon;
		} else {
			const name = key.toLowerCase();
			if (!suppressed(name)) {
				(doc.fileNames ??= {})[name] = icon;
			}
		}
	}

	// --- folders ---
	if (options.folderTheme !== 'none') {
		for (const key of Object.keys(folderAssociations)) {
			const icon = options.folderIcon(String(folderAssociations[key]));
			if (!known(icon)) {
				ignored.push(`folder ${key} => ${icon}`);
				continue;
			}
			const folderNames = (doc.folderNames ??= {});
			for (const [prefix, suffix] of FOLDER_NAME_VARIANTS) {
				folderNames[`${prefix}${key.toLowerCase()}${suffix}`] = icon;
			}
		}
	}
	return { ignored };
}
