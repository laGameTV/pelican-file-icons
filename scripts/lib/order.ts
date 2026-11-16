/**
 * VS Code's CSS rule order for a file icon theme (src/vs/workbench/services/themes/browser/fileIconThemeData.ts):
 * one rule per icon definition, in the order of the first `addSelector()` call that used it.
 * Rules with equal specificity are won by the LATER rule, and the sorted data maps cannot
 * express that order, so it is shipped separately:
 *
 *   definitionOrder  icon ids in VS Code's rule order for the dark associations
 *   packOrder        per icon pack: `[name => [definitionOrder => [anchor => [ids…]]]]`, the ids a pack inserts into the base
 *                    order right after `anchor` ('' = at the start); a pack never reorders base entries
 *
 * The runtime (IconTheme::definitionRank()) rebuilds the order of the active pack from these and
 * places the keys that only associations add after the built-in ones, like Material's generator.
 */
import type { Manifest } from 'material-icon-theme';

/** JS `\s`: VS Code escapes it to '/' in class names, which the 'parent/name' form cannot represent. */
const JS_WHITESPACE = /\s/;

/**
 * Definition ids in the order VS Code emits their CSS rules (one rule per definition, keyed by the
 * first `addSelector()` call that used it; `for…in` order, so array-index-like ids come first).
 * `passes: 'dark'` stops after the dark associations, whose rules precede every light and
 * high-contrast rule. Equal-specificity matches are won by the LATER rule, so this order breaks
 * ties such as `recipes/x.lock.json` (`lock.json` vs `recipes/json`, both three classes).
 */
export function vscodeRuleOrder(doc: Manifest, passes: 'all' | 'dark' = 'all'): string[] {
    const first: Record<string, true> = {};
    const add = (defId: string | undefined) => {
        if (defId) {
            first[defId] = true;
        }
    };
    const pass = (a: Manifest | undefined) => {
        if (!a) {
            return;
        }
        add(a.folder);
        add(a.folderExpanded);
        add(a.rootFolder || a.folder);
        add(a.rootFolderExpanded || a.folderExpanded);
        add(a.file);
        for (const key of ['folderNames', 'folderNamesExpanded', 'rootFolderNames', 'rootFolderNamesExpanded'] as const) {
            for (const k in a[key] ?? {}) {
                add(a[key]![k]);
            }
        }
        const languageIds = { ...(a.languageIds ?? {}) };
        if (!languageIds.jsonc && languageIds.json) {
            languageIds.jsonc = languageIds.json;
        }
        for (const k in languageIds) {
            add(languageIds[k]);
        }
        for (const key of ['fileExtensions', 'fileNames'] as const) {
            for (const k in a[key] ?? {}) {
                add(a[key]![k]);
            }
        }
    };
    pass(doc);
    if (passes === 'all') {
        pass(doc.light);
        pass(doc.highContrast);
    }
    return Object.keys(first);
}

/**
 * The `fileExtensions` keys of a theme document in the order VS Code iterates them, normalised
 * like scripts/lib/material.ts normalizeSection(): lowercased, parent-qualified keys as
 * 'parent/name'; keys no VS Code class can match (empty parent or name, nested parent) are dropped.
 */
export function extensionKeyOrder(doc: Manifest, label: string): string[] {
    const out: string[] = [];
    for (const raw in doc.fileExtensions ?? {}) {
        const key = raw.toLowerCase();
        if (key === '' || JS_WHITESPACE.test(key)) {
            throw new Error(`${label}: fileExtensions key ${JSON.stringify(raw)} cannot be represented in extensionOrder`);
        }
        const slash = key.lastIndexOf('/');
        if (slash >= 0 && (slash === 0 || slash === key.length - 1 || key.slice(0, slash).includes('/'))) {
            continue;
        }
        out.push(key);
    }
    return out;
}

/**
 * The entries `pack` inserts into `base`, keyed by the preceding base entry of `pack` ('' = start).
 * Fails if `pack` orders two base entries differently (not representable as insertions).
 */
export function orderInserts(base: readonly string[], pack: readonly string[], label: string): Map<string, string[]> {
    const index = new Map(base.map((id, i) => [id, i]));
    if (index.size !== base.length || index.has('')) {
        throw new Error(`${label}: the base order has duplicate or empty entries`);
    }
    const inserts = new Map<string, string[]>();
    let anchor = '';
    let previous = -1;
    for (const id of pack) {
        const i = index.get(id);
        if (i === undefined) {
            let list = inserts.get(anchor);
            if (!list) {
                inserts.set(anchor, (list = []));
            }
            list.push(id);
            continue;
        }
        if (i <= previous) {
            throw new Error(`${label}: ${JSON.stringify(id)} comes before ${JSON.stringify(base[previous])} here but after it in the base order`);
        }
        previous = i;
        anchor = id;
    }
    return inserts;
}

/** Inverse of {@link orderInserts} (the runtime does the same): base order with the insertions. */
export function applyInserts(base: readonly string[], inserts: ReadonlyMap<string, readonly string[]>): string[] {
    const out = [...(inserts.get('') ?? [])];
    for (const id of base) {
        out.push(id, ...(inserts.get(id) ?? []));
    }
    return out;
}

/** Whether `order` lists every entry of `expected` exactly once and in the same relative order. */
export function ordersAgree(order: readonly string[], expected: readonly string[]): boolean {
    const wanted = new Set(expected);
    if (wanted.size !== expected.length) {
        return false;
    }
    const filtered = order.filter((id) => wanted.has(id));
    return filtered.length === expected.length && filtered.every((id, i) => id === expected[i]);
}
