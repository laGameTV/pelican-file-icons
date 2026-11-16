/**
 * Port of VS Code's path based language detection:
 * - `src/vs/editor/common/services/languagesRegistry.ts` `_mergeLanguage`
 *   (registration order: per contribution extensions, then filenames, then
 *   filenamePatterns; firstLine is irrelevant for Explorer icons),
 * - `src/vs/editor/common/services/languagesAssociations.ts`
 *   `toLanguageAssociationItem`, `getAssociations`, `getAssociationByPath`,
 * - `src/vs/editor/common/services/languageService.ts`
 *   `guessLanguageIdByFilepathOrFirstLine` (`languageIds.at(0) ?? null`).
 *
 * (microsoft/vscode @ 69047191fc427f2f92828279aae1d90d8eeda7ab)
 *
 * The resource is a `vscode-remote://` URI (VS Code attached to the Linux game
 * server), so `getAssociations` uses `resource.path` verbatim.
 */

import { parse, type ParsedPattern } from './glob.ts';
import { endsWithIgnoreCase, equals, posixBasename } from './strings.ts';

export interface LanguageContribution {
	extension?: string;
	id: string;
	extensions?: string[];
	filenames?: string[];
	filenamePatterns?: string[];
}

export interface LanguageAssociationItem {
	readonly id: string;
	readonly filename?: string;
	readonly extension?: string;
	readonly filepattern?: string;
	readonly userConfigured: boolean;
	readonly filepatternParsed?: ParsedPattern;
	readonly filepatternOnPath?: boolean;
}

export class LanguageAssociations {
	private readonly nonUser: LanguageAssociationItem[] = [];
	private readonly user: LanguageAssociationItem[] = [];

	/** `registerPlatformLanguageAssociation` */
	registerPlatform(association: { id: string; filename?: string; extension?: string; filepattern?: string }): void {
		this.nonUser.push(toLanguageAssociationItem(association, false));
	}

	/** `registerConfiguredLanguageAssociation` (unused by the plugin; kept for self-tests). */
	registerConfigured(association: { id: string; filename?: string; extension?: string; filepattern?: string }): void {
		this.user.push(toLanguageAssociationItem(association, true));
	}

	/** `LanguagesRegistry._mergeLanguage` (association part). */
	registerLanguage(lang: LanguageContribution): void {
		const langId = lang.id;
		if (Array.isArray(lang.extensions)) {
			for (const extension of lang.extensions) {
				this.registerPlatform({ id: langId, extension });
			}
		}
		if (Array.isArray(lang.filenames)) {
			for (const filename of lang.filenames) {
				this.registerPlatform({ id: langId, filename });
			}
		}
		if (Array.isArray(lang.filenamePatterns)) {
			for (const filenamePattern of lang.filenamePatterns) {
				this.registerPlatform({ id: langId, filepattern: filenamePattern });
			}
		}
	}

	/** `getAssociations(resource)` without a first line; returns the language ids in order. */
	getLanguageIds(resourcePath: string | undefined): string[] {
		let path = resourcePath;
		if (!path) {
			return ['unknown'];
		}

		path = path.toLowerCase();
		const filename = posixBasename(path);

		const configured = getAssociationByPath(path, filename, this.user);
		if (configured) {
			return [configured.id, 'plaintext'];
		}

		const registered = getAssociationByPath(path, filename, this.nonUser);
		if (registered) {
			return [registered.id, 'plaintext'];
		}

		return ['unknown'];
	}

	/** `LanguageService.guessLanguageIdByFilepathOrFirstLine(resource)` */
	guessLanguageId(resourcePath: string): string | null {
		return this.getLanguageIds(resourcePath).at(0) ?? null;
	}

	/** Like {@link guessLanguageId} but also returns the winning association (diagnostics only). */
	explain(resourcePath: string): { id: string; via: LanguageAssociationItem | null } {
		const path = resourcePath.toLowerCase();
		const filename = posixBasename(path);
		const hit = getAssociationByPath(path, filename, this.user) ?? getAssociationByPath(path, filename, this.nonUser);
		return { id: hit ? hit.id : 'unknown', via: hit ?? null };
	}
}

function toLanguageAssociationItem(
	association: { id: string; filename?: string; extension?: string; filepattern?: string },
	userConfigured: boolean,
): LanguageAssociationItem {
	return {
		id: association.id,
		filename: association.filename,
		extension: association.extension,
		filepattern: association.filepattern,
		userConfigured,
		filepatternParsed: association.filepattern ? parse(association.filepattern, { ignoreCase: true }) : undefined,
		filepatternOnPath: association.filepattern ? association.filepattern.indexOf('/') >= 0 : false,
	};
}

function getAssociationByPath(path: string, filename: string, associations: LanguageAssociationItem[]): LanguageAssociationItem | undefined {
	let filenameMatch: LanguageAssociationItem | undefined = undefined;
	let patternMatch: LanguageAssociationItem | undefined = undefined;
	let extensionMatch: LanguageAssociationItem | undefined = undefined;

	for (let i = associations.length - 1; i >= 0; i--) {
		const association = associations[i];

		if (equals(filename, association.filename, true)) {
			filenameMatch = association;
			break;
		}

		if (association.filepattern) {
			if (!patternMatch || association.filepattern.length > patternMatch.filepattern!.length) {
				const target = association.filepatternOnPath ? path : filename;
				if (association.filepatternParsed?.(target)) {
					patternMatch = association;
				}
			}
		}

		if (association.extension) {
			if (!extensionMatch || association.extension.length > extensionMatch.extension!.length) {
				if (endsWithIgnoreCase(filename, association.extension)) {
					extensionMatch = association;
				}
			}
		}
	}

	if (filenameMatch) {
		return filenameMatch;
	}
	if (patternMatch) {
		return patternMatch;
	}
	if (extensionMatch) {
		return extensionMatch;
	}
	return undefined;
}

/**
 * Builds the registry the way the workbench does: core languages
 * (ModesRegistry, i.e. `plaintext`) first, then the built-in extensions'
 * `contributes.languages` in extension registration order. The raw data file
 * `scripts/data/vscode-languages.json` already lists the contributions in that
 * order.
 */
export function createLanguageAssociations(contributions: LanguageContribution[]): LanguageAssociations {
	const registry = new LanguageAssociations();
	for (const c of contributions) {
		registry.registerLanguage(c);
	}
	return registry;
}
