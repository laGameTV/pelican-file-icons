#!/usr/bin/env bun
/**
 * Snapshot the file associations of VS Code's built-in languages into
 * scripts/data/vscode-languages.json (dev tooling only, not needed at runtime).
 *
 *   bun scripts/fetch-vscode-languages.ts [--tag 1.146.0] [--repo <vscode clone>] [--out <file>] [--check]
 *
 * Sources (both resolve the tag to an immutable commit SHA first):
 *   GitHub (default)  1x git/ref (+ git/tags if annotated), 1x contents API for `extensions/`,
 *                     then raw.githubusercontent.com per extension package.json (GITHUB_TOKEN optional)
 *   --repo <dir>      a local (sparse/partial) clone; reads objects via `git show`/`git cat-file`,
 *                     so the working tree / sparse patterns do not matter
 * --check compares with the existing output file instead of writing it (exit code 1 on mismatch).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
    collectContributions,
    DEFAULT_VSCODE_TAG,
    EXCLUDED_EXTENSIONS,
    type ExtensionManifest,
    parseExcludedExtensions,
    serializeVscodeLanguages,
    VSCODE_REPO,
    type VscodeLanguages,
} from './lib/vscode-languages';

const ROOT = resolve(import.meta.dir, '..');
const DEFAULT_OUT = join(ROOT, 'scripts', 'data', 'vscode-languages.json');

const { values: args } = parseArgs({
    options: {
        tag: { type: 'string', default: DEFAULT_VSCODE_TAG },
        repo: { type: 'string' },
        out: { type: 'string', default: DEFAULT_OUT },
        check: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
});

if (args.help) {
    console.log('usage: bun scripts/fetch-vscode-languages.ts [--tag <tag>] [--repo <vscode clone>] [--out <file>] [--check]');
    process.exit(0);
}

interface Source {
    label: string;
    commit: string;
    extensionDirs(): Promise<string[]>;
    /** package.json of `extensions/<dir>`, or null if the folder has none. */
    packageJsons(dirs: string[]): Promise<Map<string, string | null>>;
    file(path: string): Promise<string>;
}

// ---------------------------------------------------------------------------------------------
// GitHub

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, init: RequestInit = {}, attempts = 4): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(url, init);
            if ((res.status === 429 || res.status >= 500) && attempt < attempts) {
                await sleep(500 * 2 ** attempt);
                continue;
            }
            return res;
        } catch (err) {
            if (attempt >= attempts) {
                throw err;
            }
            await sleep(500 * 2 ** attempt);
        }
    }
}

async function githubSource(tag: string): Promise<Source> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'pelican-file-icons-build',
        'X-GitHub-Api-Version': '2022-11-28',
    };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const api = async <T>(path: string): Promise<T> => {
        const res = await request(`https://api.github.com/repos/${VSCODE_REPO}/${path}`, { headers });
        if (!res.ok) {
            const hint = res.status === 403 || res.status === 429 ? ' (rate limited? set GITHUB_TOKEN)' : '';
            throw new Error(`GitHub API ${path}: HTTP ${res.status}${hint}`);
        }
        return (await res.json()) as T;
    };

    // tag -> commit (dereference annotated tags)
    type GitObject = { object: { type: string; sha: string } };
    let obj = (await api<GitObject>(`git/ref/tags/${encodeURIComponent(tag)}`)).object;
    for (let depth = 0; obj.type === 'tag'; depth++) {
        if (depth > 5) {
            throw new Error(`tag ${tag}: too many nested tag objects`);
        }
        obj = (await api<GitObject>(`git/tags/${obj.sha}`)).object;
    }
    if (obj.type !== 'commit') {
        throw new Error(`tag ${tag} points at a ${obj.type}, expected a commit`);
    }
    const commit = obj.sha;
    const raw = (path: string) => `https://raw.githubusercontent.com/${VSCODE_REPO}/${commit}/${path}`;

    return {
        label: `github.com/${VSCODE_REPO}`,
        commit,
        async extensionDirs() {
            const entries = await api<{ name: string; type: string }[]>(`contents/extensions?ref=${commit}`);
            if (!Array.isArray(entries) || entries.length >= 1000) {
                throw new Error('contents API: unexpected listing for extensions/ (truncated at 1000 entries?)');
            }
            return entries.filter((e) => e.type === 'dir').map((e) => e.name);
        },
        async packageJsons(dirs) {
            const out = new Map<string, string | null>();
            const queue = [...dirs];
            const worker = async () => {
                for (let dir = queue.shift(); dir !== undefined; dir = queue.shift()) {
                    const res = await request(raw(`extensions/${dir}/package.json`));
                    if (res.status === 404) {
                        out.set(dir, null);
                    } else if (!res.ok) {
                        throw new Error(`extensions/${dir}/package.json: HTTP ${res.status}`);
                    } else {
                        out.set(dir, await res.text());
                    }
                }
            };
            await Promise.all(Array.from({ length: 8 }, worker));
            return out;
        },
        async file(path) {
            const res = await request(raw(path));
            if (!res.ok) {
                throw new Error(`${path}: HTTP ${res.status}`);
            }
            return res.text();
        },
    };
}

// ---------------------------------------------------------------------------------------------
// Local clone

function gitSource(repo: string, tag: string): Source {
    const git = (argv: string[], input?: Buffer): Buffer =>
        execFileSync('git', ['-C', repo, ...argv], { maxBuffer: 1 << 30, input, stdio: ['pipe', 'pipe', 'pipe'] });
    let commit = '';
    for (const rev of [`refs/tags/${tag}^{commit}`, `${tag}^{commit}`]) {
        try {
            commit = git(['rev-parse', '--verify', '--quiet', rev]).toString('utf8').trim();
            break;
        } catch {
            // try the next spelling
        }
    }
    if (!/^[0-9a-f]{40}$/.test(commit)) {
        throw new Error(`${repo}: cannot resolve ${tag} to a commit (git fetch --tags?)`);
    }
    return {
        label: resolve(repo),
        commit,
        async extensionDirs() {
            return git(['ls-tree', '-d', '-z', '--name-only', commit, 'extensions/'])
                .toString('utf8')
                .split('\0')
                .filter(Boolean)
                .map((p) => p.replace(/^extensions\//, ''));
        },
        async packageJsons(dirs) {
            // one `git cat-file --batch` for all blobs (missing ones are reported as "<name> missing")
            const input = Buffer.from(dirs.map((d) => `${commit}:extensions/${d}/package.json\n`).join(''), 'utf8');
            const buf = git(['cat-file', '--batch'], input);
            const out = new Map<string, string | null>();
            let pos = 0;
            for (const dir of dirs) {
                const eol = buf.indexOf(0x0a, pos);
                const header = buf.subarray(pos, eol).toString('utf8');
                pos = eol + 1;
                if (header.endsWith(' missing')) {
                    out.set(dir, null);
                    continue;
                }
                const m = /^[0-9a-f]+ (\w+) (\d+)$/.exec(header);
                if (!m) {
                    throw new Error(`git cat-file: unexpected header ${JSON.stringify(header)}`);
                }
                const size = Number(m[2]);
                if (m[1] !== 'blob') {
                    throw new Error(`extensions/${dir}/package.json is a ${m[1]}`);
                }
                out.set(dir, buf.subarray(pos, pos + size).toString('utf8'));
                pos += size + 1; // content + LF
            }
            return out;
        },
        async file(path) {
            return git(['show', `${commit}:${path}`]).toString('utf8');
        },
    };
}

// ---------------------------------------------------------------------------------------------

const source = args.repo ? gitSource(args.repo, args.tag!) : await githubSource(args.tag!);
console.error(`[fetch:vscode] ${source.label} ${args.tag} -> ${source.commit}`);

const dirs = (await source.extensionDirs()).sort();
const pkgs = await source.packageJsons(dirs);
const manifests: ExtensionManifest[] = [];
const without: string[] = [];
for (const dir of dirs) {
    const text = pkgs.get(dir);
    if (text === null || text === undefined) {
        without.push(dir);
        continue;
    }
    try {
        manifests.push({ dir, pkg: JSON.parse(text) as unknown });
    } catch (err) {
        throw new Error(`extensions/${dir}/package.json: ${(err as Error).message}`);
    }
}

// The exclusion list must still match the build script of the pinned version.
const declared = parseExcludedExtensions(await source.file('build/lib/extensions.ts'));
if (!declared) {
    throw new Error('build/lib/extensions.ts: `excludedExtensions` not found - review EXCLUDED_EXTENSIONS manually');
}
const declaredFolders = declared.filter((d) => dirs.includes(d)).sort();
const expected = [...EXCLUDED_EXTENSIONS].filter((d) => dirs.includes(d)).sort();
if (declaredFolders.join('\n') !== expected.join('\n')) {
    throw new Error(
        `excludedExtensions changed upstream: ${JSON.stringify(declaredFolders)} vs EXCLUDED_EXTENSIONS ${JSON.stringify(expected)}`,
    );
}

const contributions = collectContributions(manifests, EXCLUDED_EXTENSIONS);
const data: VscodeLanguages = { source: VSCODE_REPO, tag: args.tag!, commit: source.commit, contributions };
const json = serializeVscodeLanguages(data);

const count = (k: 'extensions' | 'filenames' | 'filenamePatterns') =>
    contributions.reduce((n, c) => n + c[k].length, 0);
console.error(
    `[fetch:vscode] ${dirs.length} folders (${without.length} without package.json: ${without.join(', ') || '-'}), ` +
        `${manifests.length - expected.length} shipped, ${contributions.length} contributions ` +
        `(${new Set(contributions.map((c) => c.id)).size} ids), ${count('extensions')} extensions, ` +
        `${count('filenames')} filenames, ${count('filenamePatterns')} filenamePatterns`,
);

const out = resolve(args.out!);
if (args.check) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : null;
    if (current === json) {
        console.error(`[fetch:vscode] OK: ${out} is up to date (${Buffer.byteLength(json)} bytes)`);
        process.exit(0);
    }
    console.error(`[fetch:vscode] MISMATCH: ${out} differs from the freshly generated data`);
    process.exit(1);
}
const tmp = join(dirname(out), `.${Date.now()}.vscode-languages.tmp`);
writeFileSync(tmp, json);
renameSync(tmp, out);
console.error(`[fetch:vscode] wrote ${out} (${Buffer.byteLength(json)} bytes)`);
