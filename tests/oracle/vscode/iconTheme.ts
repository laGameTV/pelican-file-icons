/**
 * Port of `FileIconThemeLoader.processIconThemeDocument` from VS Code
 * `src/vs/workbench/services/themes/browser/fileIconThemeData.ts`
 * (microsoft/vscode @ 69047191fc427f2f92828279aae1d90d8eeda7ab), plus a tiny
 * CSS cascade simulator for the generated stylesheet.
 *
 * Instead of emitting CSS text, every selector is kept in a structured form
 * (ancestor qualifier classes + the compound selector's classes on the icon
 * element). Rule order and selector grouping are exactly those of the
 * generated stylesheet: one rule per icon definition id, in insertion order of
 * `selectorByDefinitionId` (a plain JS object, so JS property order applies),
 * only for definitions that exist.
 *
 * Cascade: all rules set the same properties (`content`, `background-image`)
 * with the same origin/importance and no layers, so the winner for an element
 * is the rule whose best matching selector has the highest specificity; ties
 * are won by the rule that comes later. Every selector ends in `::before`
 * (same type-level specificity), so comparing the number of class selectors is
 * sufficient.
 */

import { fileIconSelectorEscape } from './iconClasses.ts';

export interface IconsAssociation {
	folder?: string;
	file?: string;
	folderExpanded?: string;
	rootFolder?: string;
	rootFolderExpanded?: string;
	rootFolderNames?: Record<string, string>;
	rootFolderNamesExpanded?: Record<string, string>;
	folderNames?: Record<string, string>;
	folderNamesExpanded?: Record<string, string>;
	fileExtensions?: Record<string, string>;
	fileNames?: Record<string, string>;
	languageIds?: Record<string, string>;
}

export interface IconThemeDocument extends IconsAssociation {
	iconDefinitions?: Record<string, { iconPath?: string; fontCharacter?: string; fontColor?: string }>;
	light?: IconsAssociation;
	highContrast?: IconsAssociation;
	showLanguageModeIcons?: boolean;
}

/** Where a selector came from (diagnostics only). */
export interface SelectorSource {
	section: 'dark' | 'light' | 'hc-black' | 'hc-light';
	table:
		| 'folder'
		| 'folderExpanded'
		| 'rootFolder'
		| 'rootFolderExpanded'
		| 'file'
		| 'folderNames'
		| 'folderNamesExpanded'
		| 'rootFolderNames'
		| 'rootFolderNamesExpanded'
		| 'languageIds'
		| 'fileExtensions'
		| 'fileNames';
	key: string | null;
}

export interface Selector {
	/** Classes required on ancestors (`.vs`, `.show-file-icons`, ...). */
	ancestors: string[];
	/** Whether the selector contains the expanded-twistie part (never matches a closed folder or a file). */
	expanded: boolean;
	/** Classes required on the icon element itself. */
	compound: string[];
	specificity: number;
	source: SelectorSource;
}

export interface Rule {
	defId: string;
	order: number;
	selectors: Selector[];
}

/** `css.className(str, true)` is `CSS.escape`, which round-trips except for U+0000 -> U+FFFD. */
function classSelectorPart(str: string): string {
	return fileIconSelectorEscape(str).replace(/\u0000/g, '�');
}

function handleParentFolder(key: string, selectors: string[]): string {
	const lastIndexOfSlash = key.lastIndexOf('/');
	if (lastIndexOfSlash >= 0) {
		const parentFolder = key.substring(0, lastIndexOfSlash);
		selectors.push(`${classSelectorPart(parentFolder)}-name-dir-icon`);
		return key.substring(lastIndexOfSlash + 1);
	}
	return key;
}

export function processIconThemeDocument(iconThemeDocument: IconThemeDocument): Rule[] {
	if (!iconThemeDocument.iconDefinitions) {
		return [];
	}
	const selectorByDefinitionId: { [def: string]: Selector[] } = {};

	function collectSelectors(associations: IconsAssociation | undefined, section: SelectorSource['section'], baseThemeClassName?: string) {
		function addSelector(selector: Omit<Selector, 'specificity'>, defId: string | undefined) {
			if (defId) {
				let list = selectorByDefinitionId[defId];
				if (!list) {
					list = selectorByDefinitionId[defId] = [];
				}
				// `.monaco-tl-twistie.collapsible:not(.collapsed) + .monaco-tl-contents` adds 4 class-level selectors
				const specificity = selector.ancestors.length + selector.compound.length + (selector.expanded ? 4 : 0);
				list.push({ ...selector, specificity });
			}
		}

		if (!associations) {
			return;
		}
		const qualifier = baseThemeClassName ? [baseThemeClassName, 'show-file-icons'] : ['show-file-icons'];
		const src = (table: SelectorSource['table'], key: string | null = null): SelectorSource => ({ section, table, key });

		if (associations.folder) {
			addSelector({ ancestors: qualifier, expanded: false, compound: ['folder-icon'], source: src('folder') }, associations.folder);
		}
		if (associations.folderExpanded) {
			addSelector({ ancestors: qualifier, expanded: true, compound: ['folder-icon'], source: src('folderExpanded') }, associations.folderExpanded);
		}

		const rootFolder = associations.rootFolder || associations.folder;
		const rootFolderExpanded = associations.rootFolderExpanded || associations.folderExpanded;

		if (rootFolder) {
			addSelector({ ancestors: qualifier, expanded: false, compound: ['rootfolder-icon'], source: src('rootFolder') }, rootFolder);
		}
		if (rootFolderExpanded) {
			addSelector({ ancestors: qualifier, expanded: true, compound: ['rootfolder-icon'], source: src('rootFolderExpanded') }, rootFolderExpanded);
		}
		if (associations.file) {
			addSelector({ ancestors: qualifier, expanded: false, compound: ['file-icon'], source: src('file') }, associations.file);
		}

		const folderNames = associations.folderNames;
		if (folderNames) {
			for (const key in folderNames) {
				const selectors: string[] = [];
				const name = handleParentFolder(key.toLowerCase(), selectors);
				selectors.push(`${classSelectorPart(name)}-name-folder-icon`);
				addSelector({ ancestors: qualifier, expanded: false, compound: [...selectors, 'folder-icon'], source: src('folderNames', key) }, folderNames[key]);
			}
		}
		const folderNamesExpanded = associations.folderNamesExpanded;
		if (folderNamesExpanded) {
			for (const key in folderNamesExpanded) {
				const selectors: string[] = [];
				const name = handleParentFolder(key.toLowerCase(), selectors);
				selectors.push(`${classSelectorPart(name)}-name-folder-icon`);
				addSelector(
					{ ancestors: qualifier, expanded: true, compound: [...selectors, 'folder-icon'], source: src('folderNamesExpanded', key) },
					folderNamesExpanded[key],
				);
			}
		}

		const rootFolderNames = associations.rootFolderNames;
		if (rootFolderNames) {
			for (const key in rootFolderNames) {
				const name = key.toLowerCase();
				addSelector(
					{
						ancestors: qualifier,
						expanded: false,
						compound: [`${classSelectorPart(name)}-root-name-folder-icon`, 'rootfolder-icon'],
						source: src('rootFolderNames', key),
					},
					rootFolderNames[key],
				);
			}
		}
		const rootFolderNamesExpanded = associations.rootFolderNamesExpanded;
		if (rootFolderNamesExpanded) {
			for (const key in rootFolderNamesExpanded) {
				const name = key.toLowerCase();
				addSelector(
					{
						ancestors: qualifier,
						expanded: true,
						compound: [`${classSelectorPart(name)}-root-name-folder-icon`, 'rootfolder-icon'],
						source: src('rootFolderNamesExpanded', key),
					},
					rootFolderNamesExpanded[key],
				);
			}
		}

		const languageIds = associations.languageIds;
		if (languageIds) {
			// VS Code mutates the document here; this port mutates the (per-oracle) copy.
			if (!languageIds.jsonc && languageIds.json) {
				languageIds.jsonc = languageIds.json;
			}
			for (const languageId in languageIds) {
				addSelector(
					{ ancestors: qualifier, expanded: false, compound: [`${classSelectorPart(languageId)}-lang-file-icon`, 'file-icon'], source: src('languageIds', languageId) },
					languageIds[languageId],
				);
			}
		}
		const fileExtensions = associations.fileExtensions;
		if (fileExtensions) {
			for (const key in fileExtensions) {
				const selectors: string[] = [];
				const name = handleParentFolder(key.toLowerCase(), selectors);
				const segments = name.split('.');
				if (segments.length) {
					for (let i = 0; i < segments.length; i++) {
						selectors.push(`${classSelectorPart(segments.slice(i).join('.'))}-ext-file-icon`);
					}
					selectors.push('ext-file-icon');
				}
				addSelector({ ancestors: qualifier, expanded: false, compound: [...selectors, 'file-icon'], source: src('fileExtensions', key) }, fileExtensions[key]);
			}
		}
		const fileNames = associations.fileNames;
		if (fileNames) {
			for (const key in fileNames) {
				const selectors: string[] = [];
				const fileName = handleParentFolder(key.toLowerCase(), selectors);
				selectors.push(`${classSelectorPart(fileName)}-name-file-icon`);
				selectors.push('name-file-icon');
				const segments = fileName.split('.');
				if (segments.length) {
					for (let i = 1; i < segments.length; i++) {
						selectors.push(`${classSelectorPart(segments.slice(i).join('.'))}-ext-file-icon`);
					}
					selectors.push('ext-file-icon');
				}
				addSelector({ ancestors: qualifier, expanded: false, compound: [...selectors, 'file-icon'], source: src('fileNames', key) }, fileNames[key]);
			}
		}
	}

	collectSelectors(iconThemeDocument, 'dark');
	collectSelectors(iconThemeDocument.light, 'light', 'vs');
	collectSelectors(iconThemeDocument.highContrast, 'hc-black', 'hc-black');
	collectSelectors(iconThemeDocument.highContrast, 'hc-light', 'hc-light');

	// `showLanguageModeIcons` only adds rules for languages that contribute an
	// icon; no built-in VS Code language does, so it adds nothing here.

	const rules: Rule[] = [];
	for (const defId in selectorByDefinitionId) {
		const definition = iconThemeDocument.iconDefinitions[defId];
		if (definition && (definition.iconPath || definition.fontCharacter || definition.fontColor)) {
			rules.push({ defId, order: rules.length, selectors: selectorByDefinitionId[defId] });
		}
	}
	return rules;
}

export type ThemeKind = 'dark' | 'light';

/** Classes on ancestors of the icon element for a VS Code base theme. */
export function ancestorClasses(theme: ThemeKind): ReadonlySet<string> {
	return new Set(theme === 'light' ? ['monaco-workbench', 'vs', 'show-file-icons'] : ['monaco-workbench', 'vs-dark', 'show-file-icons']);
}

export interface CascadeResult {
	defId: string | null;
	rule: Rule | null;
	selector: Selector | null;
	/** Other icons whose rules matched with the same (top) specificity and lost on rule order (diagnostics only). */
	tiedWith: string[];
}

/** Indexed stylesheet: finds the winning rule for an element's class list. */
export class StyleSheet {
	private readonly index = new Map<string, Array<{ rule: Rule; selector: Selector }>>();
	private readonly bySource = new Map<string, string>();

	constructor(readonly rules: Rule[]) {
		for (const rule of rules) {
			for (const selector of rule.selectors) {
				const src = selector.source;
				this.bySource.set(`${src.section}\u0000${src.table}\u0000${src.key ?? ''}`, rule.defId);
				if (selector.expanded) {
					continue; // closed folders / files only: the expanded twistie selector never matches
				}
				// Index under any required class (correctness does not depend on the choice).
				let key = selector.compound[0];
				for (const c of selector.compound) {
					if (c.length > key.length) {
						key = c;
					}
				}
				let bucket = this.index.get(key);
				if (!bucket) {
					this.index.set(key, (bucket = []));
				}
				bucket.push({ rule, selector });
			}
		}
	}

	/** Icon of the (emitted) rule that holds the selector generated for section/table/key, if any (diagnostics only). */
	iconForSource(section: SelectorSource['section'], table: SelectorSource['table'], key: string | null): string | null {
		return this.bySource.get(`${section}\u0000${table}\u0000${key ?? ''}`) ?? null;
	}

	resolve(elementClasses: readonly string[], theme: ThemeKind): CascadeResult {
		const element = new Set(elementClasses);
		const ancestors = ancestorClasses(theme);
		let best: { rule: Rule; selector: Selector } | null = null;
		const matched: Array<{ rule: Rule; selector: Selector }> = [];
		const seen = new Set<string>();
		for (const cls of element) {
			if (seen.has(cls)) {
				continue;
			}
			seen.add(cls);
			const bucket = this.index.get(cls);
			if (!bucket) {
				continue;
			}
			for (const cand of bucket) {
				const s = cand.selector;
				if (!s.ancestors.every(a => ancestors.has(a)) || !s.compound.every(c => element.has(c))) {
					continue;
				}
				matched.push(cand);
				if (
					best === null ||
					s.specificity > best.selector.specificity ||
					(s.specificity === best.selector.specificity && cand.rule.order > best.rule.order)
				) {
					best = cand;
				}
			}
		}
		if (!best) {
			return { defId: null, rule: null, selector: null, tiedWith: [] };
		}
		const top = best;
		const tiedWith = [...new Set(matched.filter(m => m.selector.specificity === top.selector.specificity && m.rule !== top.rule).map(m => m.rule.defId))];
		return { defId: top.rule.defId, rule: top.rule, selector: top.selector, tiedWith };
	}
}
