/**
 * Port of the string-pattern part of VS Code `src/vs/base/common/glob.ts`
 * (microsoft/vscode @ 69047191fc427f2f92828279aae1d90d8eeda7ab):
 * `parse(pattern, { ignoreCase })` including the "trivia" fast paths
 * (T1, T2, T4, T5), `toRegExp`/`parseRegExp` and `splitGlobAware`.
 *
 * Platform is assumed to be POSIX (`sep === '/'`), i.e. VS Code attached to a
 * Linux game server. The brace-list fast path (T3) is not needed by any
 * built-in VS Code language pattern and throws instead of silently diverging.
 */

import { endsWithIgnoreCase, equalsIgnoreCase, escapeRegExpCharacters } from './strings.ts';

export type ParsedPattern = (path: string, basename?: string) => boolean;

const GLOBSTAR = '**';
const GLOB_SPLIT = '/';
const PATH_REGEX = '[/\\\\]'; // any slash or backslash
const NO_PATH_REGEX = '[^/\\\\]'; // any non-slash and non-backslash
const SEP = '/';

function starsToRegExp(starCount: number, isLastPattern?: boolean): string {
	switch (starCount) {
		case 0:
			return '';
		case 1:
			return `${NO_PATH_REGEX}*?`;
		default:
			return `(?:${PATH_REGEX}|${NO_PATH_REGEX}+${PATH_REGEX}${isLastPattern ? `|${PATH_REGEX}${NO_PATH_REGEX}+` : ''})*?`;
	}
}

export function splitGlobAware(pattern: string, splitChar: string): string[] {
	if (!pattern) {
		return [];
	}

	const segments: string[] = [];
	let inBraces = false;
	let inBrackets = false;
	let curVal = '';
	for (const char of pattern) {
		switch (char) {
			case splitChar:
				if (!inBraces && !inBrackets) {
					segments.push(curVal);
					curVal = '';
					continue;
				}
				break;
			case '{':
				inBraces = true;
				break;
			case '}':
				inBraces = false;
				break;
			case '[':
				inBrackets = true;
				break;
			case ']':
				inBrackets = false;
				break;
		}
		curVal += char;
	}

	if (curVal) {
		segments.push(curVal);
	}

	return segments;
}

export function parseRegExp(pattern: string): string {
	if (!pattern) {
		return '';
	}

	let regEx = '';
	const segments = splitGlobAware(pattern, GLOB_SPLIT);

	if (segments.every(segment => segment === GLOBSTAR)) {
		regEx = '.*';
	} else {
		let previousSegmentWasGlobStar = false;
		segments.forEach((segment, index) => {
			if (segment === GLOBSTAR) {
				if (previousSegmentWasGlobStar) {
					return;
				}
				regEx += starsToRegExp(2, index === segments.length - 1);
			} else {
				let inBraces = false;
				let braceVal = '';
				let inBrackets = false;
				let bracketVal = '';

				for (const char of segment) {
					if (char !== '}' && inBraces) {
						braceVal += char;
						continue;
					}

					if (inBrackets && (char !== ']' || !bracketVal)) {
						let res: string;
						if (char === '-') {
							res = char;
						} else if ((char === '^' || char === '!') && !bracketVal) {
							res = '^';
						} else if (char === GLOB_SPLIT) {
							res = '';
						} else {
							res = escapeRegExpCharacters(char);
						}
						bracketVal += res;
						continue;
					}

					switch (char) {
						case '{':
							inBraces = true;
							continue;
						case '[':
							inBrackets = true;
							continue;
						case '}': {
							const choices = splitGlobAware(braceVal, ',');
							const braceRegExp = `(?:${choices.map(choice => parseRegExp(choice)).join('|')})`;
							regEx += braceRegExp;
							inBraces = false;
							braceVal = '';
							break;
						}
						case ']': {
							regEx += '[' + bracketVal + ']';
							inBrackets = false;
							bracketVal = '';
							break;
						}
						case '?':
							regEx += NO_PATH_REGEX;
							continue;
						case '*':
							regEx += starsToRegExp(1);
							continue;
						default:
							regEx += escapeRegExpCharacters(char);
					}
				}

				if (
					index < segments.length - 1 &&
					(segments[index + 1] !== GLOBSTAR || index + 2 < segments.length)
				) {
					regEx += PATH_REGEX;
				}
			}

			previousSegmentWasGlobStar = segment === GLOBSTAR;
		});
	}

	return regEx;
}

const T1 = /^\*\*\/\*\.[\w\.-]+$/; // **/*.something
const T2 = /^\*\*\/([\w\.-]+)\/?$/; // **/something
const T3 = /^{\*\*\/\*?[\w\.-]+\/?(,\*\*\/\*?[\w\.-]+\/?)*}$/; // {**/*.something,**/*.else}
const T4 = /^\*\*((\/[\w\.-]+)+)\/?$/; // **/something/else
const T5 = /^([\w\.-]+(\/[\w\.-]+)*)\/?$/; // something/else

interface InternalOptions {
	ignoreCase: boolean;
	equals: (a: string, b: string) => boolean;
	endsWith: (str: string, candidate: string) => boolean;
}

type ParsedStringPattern = (path: string, basename?: string) => string | null;

const NULL: ParsedStringPattern = () => null;
const FALSE: ParsedPattern = () => false;

function trivia1(base: string, pattern: string, options: InternalOptions): ParsedStringPattern {
	return (path: string) => (typeof path === 'string' && options.endsWith(path, base) ? pattern : null);
}

function trivia2(base: string, pattern: string, options: InternalOptions): ParsedStringPattern {
	const slashBase = `/${base}`;
	const backslashBase = `\\${base}`;
	return (path: string, basename?: string) => {
		if (typeof path !== 'string') {
			return null;
		}
		if (basename) {
			return options.equals(basename, base) ? pattern : null;
		}
		return options.equals(path, base) || options.endsWith(path, slashBase) || options.endsWith(path, backslashBase) ? pattern : null;
	};
}

function trivia4and5(targetPath: string, pattern: string, matchPathEnds: boolean, options: InternalOptions): ParsedStringPattern {
	// POSIX: sep === posix.sep, so nativePath === targetPath and the
	// `!usingPosixSep` branches are dead.
	const nativePath = targetPath;
	const nativePathEnd = SEP + nativePath;
	if (matchPathEnds) {
		return (path: string) =>
			typeof path === 'string' && (options.equals(path, nativePath) || options.endsWith(path, nativePathEnd)) ? pattern : null;
	}
	return (path: string) => (typeof path === 'string' && options.equals(path, nativePath) ? pattern : null);
}

function toRegExp(pattern: string, options: InternalOptions): ParsedStringPattern {
	try {
		const regExp = new RegExp(`^${parseRegExp(pattern)}$`, options.ignoreCase ? 'i' : undefined);
		return (path: string) => {
			regExp.lastIndex = 0;
			return typeof path === 'string' && regExp.test(path) ? pattern : null;
		};
	} catch {
		return NULL;
	}
}

function parsePattern(arg: string, ignoreCase: boolean): ParsedStringPattern {
	if (!arg) {
		return NULL;
	}

	const pattern = arg.trim();
	const options: InternalOptions = {
		ignoreCase,
		equals: ignoreCase ? equalsIgnoreCase : (a, b) => a === b,
		endsWith: ignoreCase ? endsWithIgnoreCase : (str, candidate) => str.endsWith(candidate),
	};

	let match: RegExpExecArray | null;
	if (T1.test(pattern)) {
		return trivia1(pattern.substring(4), pattern, options);
	} else if ((match = T2.exec(pattern))) {
		return trivia2(match[1], pattern, options);
	} else if (T3.test(pattern)) {
		throw new Error(`glob port: brace-list pattern ${pattern} (T3) is not supported by the oracle`);
	} else if ((match = T4.exec(pattern))) {
		return trivia4and5(match[1].substring(1), pattern, true, options);
	} else if ((match = T5.exec(pattern))) {
		return trivia4and5(match[1], pattern, false, options);
	}
	return toRegExp(pattern, options);
}

/** `glob.parse(pattern, { ignoreCase })` for a string pattern. */
export function parse(pattern: string, options: { ignoreCase?: boolean } = {}): ParsedPattern {
	if (!pattern) {
		return FALSE;
	}
	const parsedPattern = parsePattern(pattern, options.ignoreCase ?? false);
	if (parsedPattern === NULL) {
		return FALSE;
	}
	return (path: string, basename?: string) => !!parsedPattern(path, basename);
}
