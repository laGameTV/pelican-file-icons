/**
 * VS Code glob (src/vs/base/common/glob.ts @ 1.146.0) -> PCRE, for the `filenamePatterns` of
 * built-in languages.
 *
 * VS Code compiles each pattern with `parse(pattern, { ignoreCase: true })`
 * (languagesAssociations.ts toLanguageAssociationItem) and calls the result with a single
 * argument: the lower-cased basename, or the lower-cased full path if the pattern contains '/'.
 * `parsePattern()` first tries the "trivia" fast paths T1..T5 (plain string comparisons, which
 * do NOT treat '\' as a separator the way the regex path does) and only otherwise builds a
 * JavaScript RegExp via `parseRegExp()`. Both branches are reproduced here so that the PCRE
 * matches exactly the same strings:
 *
 * - posix semantics (`path.sep === '/'`) are used for the T4/T5 fast paths: the panel runs on
 *   Linux and our runtime always passes '/'-separated paths
 * - JS `$` (end of input) => PCRE `$` + modifier `D` (otherwise PCRE's `$` also matches before
 *   a trailing "\n", which is a legal character in Linux file names)
 * - the regex works on UTF-8 bytes (no `u` modifier, so invalid UTF-8 never makes preg_match
 *   fail); every construct is written so that it matches the same strings as the JS RegExp,
 *   which works on UTF-16 code units (see `?` and the all-globstar case below)
 * - `{…}` and `[…]` never occur in the pinned data; they are rejected instead of half-ported
 */

/** The regexes glob.ts uses to detect trivial patterns (copied verbatim, L264-269). */
const T1 = /^\*\*\/\*\.[\w\.-]+$/; // **/*.something
const T2 = /^\*\*\/([\w\.-]+)\/?$/; // **/something
const T3 = /^{\*\*\/\*?[\w\.-]+\/?(,\*\*\/\*?[\w\.-]+\/?)*}$/; // {**/*.something,**/*.else}
const T4 = /^\*\*((\/[\w\.-]+)+)\/?$/; // **/something/else
const T5 = /^([\w\.-]+(\/[\w\.-]+)*)\/?$/; // something/else

const GLOBSTAR = '**';
const GLOB_SPLIT = '/';

// PCRE source fragments (written as PCRE pattern text, i.e. a single backslash escapes)
const PATH = '[/\\\\]'; // '/' or '\'           == glob.ts PATH_REGEX
const NO_PATH = '[^/\\\\]'; // neither '/' nor '\'  == glob.ts NO_PATH_REGEX (for '*', see below)
/** Anything, including newlines (for the endsWith/equals fast paths). */
const ANY = '[\\s\\S]';
/**
 * Exactly one UTF-16 code unit other than '/' and '\' (glob `?`, JS `[^/\\]` without the
 * `u` flag), expressed over UTF-8 bytes: an ASCII byte, a 2- or 3-byte sequence (BMP), the
 * first 3 bytes of a 4-byte sequence (high surrogate) or its last byte (low surrogate).
 */
const ONE_CODE_UNIT =
    '(?:[^/\\\\\\x80-\\xff]|[\\xc0-\\xdf][\\x80-\\xbf]|[\\xe0-\\xef][\\x80-\\xbf]{2}' +
    '|[\\xf0-\\xf7][\\x80-\\xbf]{2}|(?<=[\\xf0-\\xf7][\\x80-\\xbf]{2})[\\x80-\\xbf])';
/**
 * JS `.*` without the `s` flag: any code units except the line terminators \n, \r, U+2028 and
 * U+2029 (UTF-8 E2 80 A8 / E2 80 A9).
 */
const JS_DOT_STAR = '(?:[^\\n\\r\\xe2]|\\xe2(?!\\x80[\\xa8\\xa9]))*';

/**
 * `[^/\\]*?` over bytes matches the same strings as over UTF-16 code units: UTF-8 lead and
 * continuation bytes are never '/' or '\', and every literal that can follow starts on a
 * character boundary (or is the low-surrogate branch of {@link ONE_CODE_UNIT}).
 */
const STAR = `${NO_PATH}*?`;

/** Escapes one literal character (code point) for PCRE with delimiter '~'. */
export function pcreQuote(text: string): string {
    let out = '';
    for (const ch of text) {
        if (ch === '\0') {
            out += '\\x00';
        } else if ('\\^$.|?*+()[]{}~#-'.includes(ch)) {
            out += `\\${ch}`;
        } else {
            out += ch;
        }
    }
    return out;
}

function starsToRegExp(starCount: number, isLastPattern = false): string {
    switch (starCount) {
        case 0:
            return '';
        case 1:
            return STAR;
        default:
            return `(?:${PATH}|${NO_PATH}+${PATH}${isLastPattern ? `|${PATH}${NO_PATH}+` : ''})*?`;
    }
}

/** Verbatim port of glob.ts splitGlobAware (iterates code points like `for…of`). */
function splitGlobAware(pattern: string, splitChar: string): string[] {
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

/** Port of glob.ts parseRegExp for the `*`, `**`, `?` subset. */
function parseRegExp(pattern: string): string {
    if (!pattern) {
        return '';
    }
    const segments = splitGlobAware(pattern, GLOB_SPLIT);
    if (segments.every((segment) => segment === GLOBSTAR)) {
        return JS_DOT_STAR;
    }
    let regEx = '';
    let previousSegmentWasGlobStar = false;
    segments.forEach((segment, index) => {
        if (segment === GLOBSTAR) {
            if (previousSegmentWasGlobStar) {
                return;
            }
            regEx += starsToRegExp(2, index === segments.length - 1);
        } else {
            for (const char of segment) {
                if (char === '?') {
                    regEx += ONE_CODE_UNIT;
                } else if (char === '*') {
                    regEx += starsToRegExp(1);
                } else {
                    regEx += pcreQuote(char);
                }
            }
            if (
                index < segments.length - 1 &&
                (segments[index + 1] !== GLOBSTAR || index + 2 < segments.length)
            ) {
                regEx += PATH;
            }
        }
        previousSegmentWasGlobStar = segment === GLOBSTAR;
    });
    return regEx;
}

export interface CompiledGlob {
    /** Full PCRE incl. delimiters and modifiers, e.g. `~^dockerfile\.[^/\\]*?$~iD`. */
    regex: string;
    /** Which branch of glob.ts parsePattern() the pattern takes. */
    kind: 'trivia1' | 'trivia2' | 'trivia4' | 'trivia5' | 'regexp';
    /** VS Code matches patterns containing '/' against the full path, others against the basename. */
    onPath: boolean;
}

/**
 * PCRE equivalent of `glob.parse(pattern, { ignoreCase: true })(target)` where `target` is the
 * lower-cased basename or (onPath) the lower-cased absolute posix path.
 */
export function compileGlob(glob: string): CompiledGlob {
    const onPath = glob.includes('/'); // languagesAssociations.ts: filepattern.indexOf(posix.sep) >= 0 (untrimmed)
    const pattern = glob.trim(); // parsePattern: "Whitespace trimming"
    if (!pattern) {
        throw new Error(`empty glob ${JSON.stringify(glob)} (VS Code would never match it)`);
    }
    if (/[{}[\]]/.test(pattern) || T3.test(pattern)) {
        throw new Error(`glob ${JSON.stringify(glob)} uses {…} or […], which scripts/lib/glob.ts does not port`);
    }
    if (/[^\x00-\x7f]/.test(pattern)) {
        // JS `i` would also fold non-ASCII letters, PCRE without `u` does not; never needed so far
        throw new Error(`glob ${JSON.stringify(glob)} contains non-ASCII characters, which scripts/lib/glob.ts does not port`);
    }
    const wrap = (body: string, kind: CompiledGlob['kind']): CompiledGlob => ({
        regex: `~^${body}$~iD`,
        kind,
        onPath,
    });
    let match: RegExpExecArray | null;
    if (T1.test(pattern)) {
        // trivia1: endsWith(path, pattern.substring(4))
        return wrap(`${ANY}*${pcreQuote(pattern.substring(4))}`, 'trivia1');
    }
    if ((match = T2.exec(pattern))) {
        // trivia2 (no basename argument): equals(path, base) || endsWith(path, '/' + base) || endsWith(path, '\\' + base)
        return wrap(`(?:${ANY}*${PATH})?${pcreQuote(match[1]!)}`, 'trivia2');
    }
    if ((match = T4.exec(pattern))) {
        // trivia4and5(matchPathEnds = true), posix: equals(path, target) || endsWith(path, '/' + target)
        return wrap(`(?:${ANY}*/)?${pcreQuote(match[1]!.substring(1))}`, 'trivia4');
    }
    if ((match = T5.exec(pattern))) {
        // trivia4and5(matchPathEnds = false), posix: equals(path, target)
        return wrap(pcreQuote(match[1]!), 'trivia5');
    }
    return wrap(parseRegExp(pattern), 'regexp');
}
