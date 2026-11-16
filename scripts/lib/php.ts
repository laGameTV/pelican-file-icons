/**
 * Tiny deterministic serializer for PHP array literals (dev tooling only).
 *
 * - strings are single-quoted; only `\` and `'` are escaped (the only two escapes PHP
 *   recognises inside single quotes), every other byte is written verbatim (UTF-8)
 * - JS arrays become PHP lists; `Map`s and plain objects become associative arrays in their
 *   insertion order. Data maps must be `Map`s: plain objects enumerate integer-like keys first
 *   and treat `__proto__` specially, so they are only accepted for fixed, non-numeric keys.
 *   Callers sort keys with {@link strcmp} where SPEC requires sorted keys.
 * - short arrays whose values are all scalars are written on one line, everything else one
 *   entry per line with 4-space indentation, LF line endings, trailing commas; a
 *   {@link PhpWrappedList} (long scalar lists) packs several entries per line instead
 */

export type PhpScalar = string | number | boolean | null;
export type PhpValue = PhpScalar | PhpValue[] | PhpMap | Map<string, PhpValue> | PhpWrappedList;
export interface PhpMap {
    [key: string]: PhpValue;
}

/** A PHP list of scalars written with as many entries per line as fit (smaller files for long lists). */
export class PhpWrappedList {
    constructor(readonly items: readonly PhpScalar[]) {}
}

const INLINE_MAX = 120;

/** Byte-wise comparison of the UTF-8 encodings, i.e. exactly PHP's `strcmp()` order. */
export function strcmp(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** PHP turns these array keys into integers (`'7' => …` becomes `7 => …`). */
export function isPhpIntegerKey(key: string): boolean {
    if (!/^(0|-?[1-9][0-9]*)$/.test(key)) {
        return false;
    }
    const n = BigInt(key);
    return n >= -(2n ** 63n) && n < 2n ** 63n;
}

export function phpString(value: string): string {
    if (/\p{Cs}/u.test(value)) {
        throw new Error(`refusing to serialize a string with lone surrogates: ${JSON.stringify(value)}`);
    }
    return `'${value.replace(/[\\']/g, (c) => `\\${c}`)}'`;
}

function isScalar(value: PhpValue): value is PhpScalar {
    return value === null || typeof value !== 'object';
}

function scalar(value: PhpScalar): string {
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'string') {
        return phpString(value);
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (!Number.isSafeInteger(value)) {
        throw new Error(`only safe integers are supported, got ${value}`);
    }
    return String(value);
}

function entries(value: PhpValue[] | PhpMap | Map<string, PhpValue>): [string | null, PhpValue][] {
    if (Array.isArray(value)) {
        return value.map((v) => [null, v]);
    }
    if (value instanceof Map) {
        for (const k of value.keys()) {
            if (typeof k !== 'string') {
                throw new Error(`Map keys must be strings, got ${typeof k}`);
            }
        }
        return [...value.entries()];
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
        throw new Error('only arrays, Maps and plain objects can be serialized');
    }
    const list = Object.entries(value);
    for (const [k] of list) {
        if (/^(0|[1-9][0-9]*)$/.test(k) || k === '__proto__') {
            throw new Error(`plain object key ${JSON.stringify(k)} would be reordered/mangled by JS - use a Map`);
        }
    }
    return list;
}

export function phpValue(value: PhpValue, indent = ''): string {
    if (value === undefined) {
        throw new Error('undefined cannot be serialized');
    }
    if (isScalar(value)) {
        return scalar(value);
    }
    const inner = `${indent}    `;
    if (value instanceof PhpWrappedList) {
        const inline = `[${value.items.map(scalar).join(', ')}]`;
        if (indent.length + inline.length <= INLINE_MAX) {
            return inline;
        }
        const lines: string[] = [];
        let line = '';
        for (const item of value.items) {
            const part = `${scalar(item)},`;
            if (line !== '' && inner.length + line.length + 1 + part.length > INLINE_MAX) {
                lines.push(`${inner}${line}`);
                line = '';
            }
            line = line === '' ? part : `${line} ${part}`;
        }
        lines.push(`${inner}${line}`);
        return `[\n${lines.join('\n')}\n${indent}]`;
    }
    const list = entries(value);
    if (list.length === 0) {
        return '[]';
    }
    const key = (k: string | null) => (k === null ? '' : `${phpString(k)} => `);
    if (list.every(([, v]) => isScalar(v))) {
        const inline = `[${list.map(([k, v]) => key(k) + phpValue(v)).join(', ')}]`;
        if (indent.length + inline.length <= INLINE_MAX) {
            return inline;
        }
    }
    const lines = list.map(([k, v]) => `${inner}${key(k)}${phpValue(v, inner)},`);
    return `[\n${lines.join('\n')}\n${indent}]`;
}

/** A complete, `require`-able PHP file returning `value`. */
export function phpFile(value: PhpValue, generator: string): string {
    return `<?php\n\n// @generated by ${generator} - do not edit.\n\nreturn ${phpValue(value)};\n`;
}
