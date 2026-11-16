/**
 * Independent oracle: "which icon would VS Code + Material Icon Theme show?"
 *
 * Built only from VS Code sources (ported in ./vscode) and the real Material
 * `generateManifest()` output. Knows nothing about the PHP implementation.
 */

import { readFileSync } from 'node:fs';
import { createLanguageAssociations, type LanguageAssociations, type LanguageContribution } from './vscode/languages.ts';
import { FileKind, getIconClasses } from './vscode/iconClasses.ts';
import {
	processIconThemeDocument,
	StyleSheet,
	type CascadeResult,
	type IconThemeDocument,
	type SelectorSource,
	type ThemeKind,
} from './vscode/iconTheme.ts';

export interface Case {
	kind: 'file' | 'folder';
	name: string;
	/** Directory containing the entry ('/'-separated), null if unknown (treated as the root). */
	directory: string | null;
	mime?: string | null;
	/** Corpus group (diagnostics only). */
	group?: string;
}

export interface OracleAnswer {
	/** Icon definition id shown, null when no rule matches (e.g. folders with Material folder theme "none"). */
	icon: string | null;
	/** Human readable winning selector origin, e.g. `dark:fileExtensions[ts]`. */
	via: string;
	specificity: number;
	source: SelectorSource | null;
	/** Icons of other matching rules with the same specificity that lost on CSS rule order. */
	tiedWith: string[];
}

export interface OracleResult {
	dark: OracleAnswer;
	light: OracleAnswer;
	/**
	 * Diagnostics only: "dark winner, swapped to the light rule of the very same
	 * table/key if Material has one". Equals `light.icon` except for VS Code's
	 * light-theme specificity quirks.
	 */
	sameKeyLight: string | null;
	classes: string[];
	languageId: string | null;
}

export interface VscodeLanguagesFile {
	tag: string;
	commit: string;
	contributions: LanguageContribution[];
}

export function loadVscodeLanguages(file: string): VscodeLanguagesFile {
	return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * The URI path VS Code would see for the entry: absolute, '/'-separated, empty
 * segments collapsed (the panel passes server-relative directories such as
 * '/', '/plugins/Essentials' or 'plugins/').
 */
export function resourcePath(directory: string | null, name: string): string {
	const segments = (directory ?? '').split('/').filter(s => s !== '');
	return '/' + [...segments, name].join('/');
}

function describe(r: CascadeResult): string {
	if (!r.selector) {
		return 'none';
	}
	const s = r.selector.source;
	return `${s.section}:${s.table}${s.key !== null ? `[${s.key}]` : ''}`;
}

export class Oracle {
	readonly languages: LanguageAssociations;
	readonly styleSheet: StyleSheet;

	constructor(manifest: IconThemeDocument, languages: LanguageAssociations | LanguageContribution[]) {
		// processIconThemeDocument mutates languageIds (jsonc fallback) like VS Code does; work on a copy.
		const doc = structuredClone(manifest);
		this.styleSheet = new StyleSheet(processIconThemeDocument(doc));
		this.languages = Array.isArray(languages) ? createLanguageAssociations(languages) : languages;
	}

	resolve(c: Case): OracleResult {
		const path = resourcePath(c.directory, c.name);
		let languageId: string | null = null;
		const guesser = {
			guessLanguageId: (p: string) => {
				languageId = this.languages.guessLanguageId(p);
				return languageId;
			},
		};
		const classes = getIconClasses(guesser, path, c.kind === 'folder' ? FileKind.FOLDER : FileKind.FILE);
		const answer = (theme: ThemeKind): OracleAnswer => {
			const r = this.styleSheet.resolve(classes, theme);
			return { icon: r.defId, via: describe(r), specificity: r.selector?.specificity ?? 0, source: r.selector?.source ?? null, tiedWith: r.tiedWith };
		};
		const dark = answer('dark');
		const light = answer('light');
		const sameKeyLight = dark.source ? (this.styleSheet.iconForSource('light', dark.source.table, dark.source.key) ?? dark.icon) : dark.icon;
		return { dark, light, sameKeyLight, classes, languageId };
	}
}
