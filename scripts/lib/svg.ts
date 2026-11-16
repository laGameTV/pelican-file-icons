/**
 * Conservative sanity check for shipped SVG icons. The icons are rendered through `<img>` (inline
 * data URIs or the plugin's route with a sandboxing CSP), where scripts never run, but third-party
 * files should still be plain, self-contained vector images - anything else fails the build.
 */

const decoder = new TextDecoder('utf-8', { fatal: true });

/** `null` if the file looks like a plain, self-contained SVG, else the reason it does not. */
export function svgProblem(bytes: Uint8Array): string | null {
    let text: string;
    try {
        text = decoder.decode(bytes);
    } catch {
        return 'is not valid UTF-8';
    }
    if (text.length === 0) {
        return 'is empty';
    }
    const body = text.replace(/^﻿?\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*/, '');
    if (!/^<svg[\s>]/.test(body)) {
        return 'does not start with an <svg> element';
    }
    if (!/<\/svg>\s*$/.test(body)) {
        return 'does not end with </svg>';
    }
    const rules: [RegExp, string][] = [
        [/<!DOCTYPE|<!ENTITY/i, 'contains a DOCTYPE/ENTITY declaration'],
        [/<script/i, 'contains a <script> element'],
        [/<foreignObject/i, 'contains a <foreignObject> element'],
        [/<(?:iframe|object|embed|audio|video)\b/i, 'contains an embedded document/media element'],
        [/[\s"']on[a-z]+\s*=/i, 'contains an event handler attribute'],
        [/javascript:/i, 'contains a javascript: URL'],
        [/(?:href|src)\s*=\s*["']\s*(?!#|data:image\/)/i, 'references an external resource'],
        [/url\(\s*["']?\s*(?!#|data:image\/)/i, 'references an external resource in CSS'],
        [/@import/i, 'contains a CSS @import'],
    ];
    for (const [re, problem] of rules) {
        if (re.test(text)) {
            return problem;
        }
    }
    return null;
}
