/**
 * Minimal, defensive reader for VSIX packages (zip archives) - the content is untrusted data.
 *
 * Everything happens in memory; nothing from the archive is ever written to a path derived from an
 * entry name. Still, the archive is rejected as a whole if any entry name is absolute, has a drive
 * letter, a backslash, a control character or a `..` segment, or appears twice. Only the entries
 * selected by the caller are inflated, each one capped in size.
 */
import { unzipSync } from 'fflate';

const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

export function unsafeEntryName(name: string): string | null {
    if (name === '') {
        return 'empty name';
    }
    if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
        return 'absolute path';
    }
    if (name.includes('\\')) {
        return 'backslash';
    }
    if (/[\0-\x1f\x7f]/.test(name)) {
        return 'control character';
    }
    if (name.split('/').includes('..')) {
        return "'..' segment";
    }
    return null;
}

/**
 * Inflates the entries for which `want(name)` is true (directory entries are never selected).
 * Returns them keyed by entry name, in archive order.
 */
export function readVsix(bytes: Uint8Array, want: (name: string) => boolean, label = 'archive'): Map<string, Uint8Array> {
    const seen = new Set<string>();
    const declared = new Map<string, number>();
    let total = 0;
    const files = unzipSync(bytes, {
        filter(file) {
            const problem = unsafeEntryName(file.name);
            if (problem !== null) {
                throw new Error(`${label}: refusing entry ${JSON.stringify(file.name)} (${problem})`);
            }
            if (seen.has(file.name)) {
                throw new Error(`${label}: duplicate entry ${JSON.stringify(file.name)}`);
            }
            seen.add(file.name);
            if (file.name.endsWith('/') || !want(file.name)) {
                return false;
            }
            if (file.originalSize > MAX_ENTRY_BYTES) {
                throw new Error(`${label}: entry ${file.name} is too large (${file.originalSize} bytes)`);
            }
            total += file.originalSize;
            if (total > MAX_TOTAL_BYTES) {
                throw new Error(`${label}: selected entries exceed ${MAX_TOTAL_BYTES} bytes`);
            }
            declared.set(file.name, file.originalSize);
            return true;
        },
    });
    const out = new Map<string, Uint8Array>();
    for (const [name, size] of declared) {
        const data = files[name];
        if (!data || data.length !== size) {
            throw new Error(`${label}: entry ${name} inflated to ${data?.length ?? 'nothing'} bytes, expected ${size}`);
        }
        out.set(name, data);
    }
    return out;
}
