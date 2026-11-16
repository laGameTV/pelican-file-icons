/**
 * Port of VS Code `src/vs/editor/common/services/getIconClasses.ts`
 * (microsoft/vscode @ 69047191fc427f2f92828279aae1d90d8eeda7ab).
 *
 * Simplifications that are exact for the Explorer of a remote (Linux) workspace:
 * - the resource is never a data URI and never has a predefined ThemeIcon/URI icon,
 * - no editor model is open for the resource, so `detectLanguageId` falls back
 *   to `languageService.guessLanguageIdByFilepathOrFirstLine(resource)` without
 *   a first line.
 */

export const enum FileKind {
	FILE = 0,
	FOLDER = 1,
	ROOT_FOLDER = 2,
}

export interface LanguageGuesser {
	guessLanguageId(resourcePath: string): string | null;
}

const fileIconDirectoryRegex = /(?:\/|^)(?:([^\/]+)\/)?([^\/]+)$/;

export function fileIconSelectorEscape(str: string): string {
	return str.replace(/[\s]/g, '/');
}

/**
 * @param resourcePath `URI.path` of the resource (absolute, '/'-separated).
 * @param authority `URI.authority` (only used when the path does not match).
 */
export function getIconClasses(languageService: LanguageGuesser, resourcePath: string, fileKind: FileKind, authority = ''): string[] {
	const classes = fileKind === FileKind.ROOT_FOLDER ? ['rootfolder-icon'] : fileKind === FileKind.FOLDER ? ['folder-icon'] : ['file-icon'];

	let name: string | undefined;
	const match = resourcePath.match(fileIconDirectoryRegex);
	if (match) {
		name = fileIconSelectorEscape(match[2].toLowerCase());
		if (match[1]) {
			classes.push(`${fileIconSelectorEscape(match[1].toLowerCase())}-name-dir-icon`);
		}
	} else {
		name = fileIconSelectorEscape(authority.toLowerCase());
	}

	if (fileKind === FileKind.ROOT_FOLDER) {
		classes.push(`${name}-root-name-folder-icon`);
	} else if (fileKind === FileKind.FOLDER) {
		classes.push(`${name}-name-folder-icon`);
	} else {
		if (name) {
			classes.push(`${name}-name-file-icon`);
			classes.push(`name-file-icon`);
			if (name.length <= 255) {
				const dotSegments = name.split('.');
				for (let i = 1; i < dotSegments.length; i++) {
					classes.push(`${dotSegments.slice(i).join('.')}-ext-file-icon`);
				}
			}
			classes.push(`ext-file-icon`);
		}

		const detectedLanguageId = languageService.guessLanguageId(resourcePath);
		if (detectedLanguageId) {
			classes.push(`${fileIconSelectorEscape(detectedLanguageId)}-lang-file-icon`);
		}
	}
	return classes;
}
