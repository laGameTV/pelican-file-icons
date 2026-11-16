/**
 * Pinned third-party theme sources (`scripts/data/sources.json`) and their download cache
 * (`scripts/.cache/<name>-<version>.vsix`, gitignored).
 *
 * The archive is the integrity anchor: it is downloaded at most once, verified against the pinned
 * sha256 before it is cached (a partial or wrong download never reaches the cache), and verified
 * again every time it is read. A mismatch always fails hard.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Source {
    version: string;
    url: string;
    sha256: string;
    license: string;
    copyright: string;
}

export type Sources = Record<string, Source>;

/** Upper bound for a theme archive (the Datapack Icons VSIX is ~240 KB). */
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const SAFE_NAME = /^[a-z0-9][a-z0-9.-]*$/;

export function readSources(file: string): Sources {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new Error(`${file}: expected a JSON object`);
    }
    const out: Sources = {};
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        const where = `${file}: ${name}`;
        if (!SAFE_NAME.test(name) || name.includes('..')) {
            throw new Error(`${where}: invalid source name`);
        }
        const s = value as Partial<Record<keyof Source, unknown>>;
        for (const key of ['version', 'url', 'sha256', 'license', 'copyright'] as const) {
            if (typeof s?.[key] !== 'string' || s[key] === '') {
                throw new Error(`${where}: "${key}" must be a non-empty string`);
            }
        }
        const source = s as Source;
        if (!SAFE_NAME.test(source.version) || source.version.includes('..')) {
            throw new Error(`${where}: invalid version ${JSON.stringify(source.version)}`);
        }
        if (!/^[0-9a-f]{64}$/.test(source.sha256)) {
            throw new Error(`${where}: sha256 must be 64 lower-case hex digits`);
        }
        if (new URL(source.url).protocol !== 'https:') {
            throw new Error(`${where}: url must be https`);
        }
        out[name] = source;
    }
    return out;
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function download(url: string): Promise<Uint8Array> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
            if (!res.ok) {
                // 4xx will not get better by retrying
                const err = new Error(`HTTP ${res.status} ${res.statusText}`);
                if (res.status < 500) {
                    throw Object.assign(err, { fatal: true });
                }
                throw err;
            }
            const length = Number(res.headers.get('content-length') ?? '0');
            if (length > MAX_ARCHIVE_BYTES) {
                throw Object.assign(new Error(`archive too large (${length} bytes)`), { fatal: true });
            }
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (bytes.length > MAX_ARCHIVE_BYTES) {
                throw Object.assign(new Error(`archive too large (${bytes.length} bytes)`), { fatal: true });
            }
            return bytes;
        } catch (err) {
            lastError = err;
            if ((err as { fatal?: boolean }).fatal || attempt === 3) {
                break;
            }
            await Bun.sleep(1000 * attempt);
        }
    }
    throw new Error(`download of ${url} failed: ${(lastError as Error)?.message ?? lastError}`);
}

export interface FetchedSource {
    bytes: Uint8Array;
    file: string;
    downloaded: boolean;
}

/**
 * Returns the verified archive bytes of `name`, downloading it into `cacheDir` if it is not cached.
 * `offline` forbids the download (the cached copy must exist).
 */
export async function fetchSource(name: string, source: Source, cacheDir: string, offline: boolean): Promise<FetchedSource> {
    const file = join(cacheDir, `${name}-${source.version}.vsix`);
    if (existsSync(file)) {
        const bytes = new Uint8Array(readFileSync(file));
        const actual = sha256(bytes);
        if (actual !== source.sha256) {
            throw new Error(
                `${file}: sha256 ${actual} does not match the pinned ${source.sha256} (scripts/data/sources.json). ` +
                    'Delete the cached file to download it again.',
            );
        }
        return { bytes, file, downloaded: false };
    }
    if (offline) {
        throw new Error(`${file} is not cached and --offline forbids downloading it from ${source.url}`);
    }
    const bytes = await download(source.url);
    const actual = sha256(bytes);
    if (actual !== source.sha256) {
        throw new Error(`${source.url}: downloaded sha256 ${actual} does not match the pinned ${source.sha256} - refusing to use it`);
    }
    mkdirSync(cacheDir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    try {
        writeFileSync(tmp, bytes);
        renameSync(tmp, file);
    } finally {
        rmSync(tmp, { force: true });
    }
    return { bytes, file, downloaded: true };
}
