/**
 * Literal port of the helpers from VS Code `src/vs/base/common/strings.ts`
 * (microsoft/vscode @ 69047191fc427f2f92828279aae1d90d8eeda7ab) that the
 * language-association and glob code depends on.
 *
 * Ported 1:1 (including the ASCII fast path and the `toLowerCase()` fallback
 * for non-ASCII characters) so the oracle inherits VS Code's exact
 * case-insensitivity semantics.
 */

const CHAR_A = 65;
const CHAR_Z = 90;
const CHAR_a = 97;
const CHAR_z = 122;

export function compare(a: string, b: string): number {
	if (a < b) {
		return -1;
	} else if (a > b) {
		return 1;
	}
	return 0;
}

export function isLowerAsciiLetter(code: number): boolean {
	return code >= CHAR_a && code <= CHAR_z;
}

export function isUpperAsciiLetter(code: number): boolean {
	return code >= CHAR_A && code <= CHAR_Z;
}

export function compareSubstringIgnoreCase(
	a: string,
	b: string,
	aStart: number = 0,
	aEnd: number = a.length,
	bStart: number = 0,
	bEnd: number = b.length,
): number {
	for (; aStart < aEnd && bStart < bEnd; aStart++, bStart++) {
		let codeA = a.charCodeAt(aStart);
		let codeB = b.charCodeAt(bStart);

		if (codeA === codeB) {
			continue;
		}

		if (codeA >= 128 || codeB >= 128) {
			// not ASCII letters -> fallback to lower-casing strings
			return compare(a.substring(aStart, aEnd).toLowerCase(), b.substring(bStart, bEnd).toLowerCase());
		}

		if (isLowerAsciiLetter(codeA)) {
			codeA -= 32;
		}
		if (isLowerAsciiLetter(codeB)) {
			codeB -= 32;
		}

		const diff = codeA - codeB;
		if (diff === 0) {
			continue;
		}

		return diff;
	}

	const aLen = aEnd - aStart;
	const bLen = bEnd - bStart;

	if (aLen < bLen) {
		return -1;
	} else if (aLen > bLen) {
		return 1;
	}

	return 0;
}

export function equalsIgnoreCase(a: string, b: string): boolean {
	return a.length === b.length && compareSubstringIgnoreCase(a, b) === 0;
}

export function equals(a: string | undefined, b: string | undefined, ignoreCase?: boolean): boolean {
	return a === b || (!!ignoreCase && a !== undefined && b !== undefined && equalsIgnoreCase(a, b));
}

export function endsWithIgnoreCase(str: string, candidate: string): boolean {
	const len = str.length;
	const start = len - candidate.length;
	return start >= 0 && compareSubstringIgnoreCase(str, candidate, start, len) === 0;
}

export function escapeRegExpCharacters(value: string): string {
	return value.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, '\\$&');
}

/** Port of the no-suffix branch of `posix.basename` from `src/vs/base/common/path.ts`. */
export function posixBasename(path: string): string {
	const CHAR_FORWARD_SLASH = 47;
	let start = 0;
	let end = -1;
	let matchedSlash = true;
	for (let i = path.length - 1; i >= 0; --i) {
		if (path.charCodeAt(i) === CHAR_FORWARD_SLASH) {
			if (!matchedSlash) {
				start = i + 1;
				break;
			}
		} else if (end === -1) {
			matchedSlash = false;
			end = i + 1;
		}
	}
	if (end === -1) {
		return '';
	}
	return path.slice(start, end);
}
