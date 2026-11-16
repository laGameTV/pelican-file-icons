<?php

namespace LaGameTV\FileIcons\Rendering;

/**
 * Compact `data:image/svg+xml,…` URIs (UTF-8 percent-encoding instead of base64, which is a third
 * larger). Pure PHP.
 *
 * Percent-encoded are exactly the bytes that would otherwise change the URI or need escaping in a
 * double-quoted HTML attribute: '%' (escape character), '#' (would start the fragment), '"', "'",
 * '&', '<', '>' (HTML attribute syntax; encoding them is shorter than `e()`'s entities), control
 * characters incl. tabs and newlines (the URL parser drops tabs/newlines and trims control
 * characters), every non-ASCII byte (UTF-8 sequences stay intact as %XX%XX) and a space directly
 * before '?' or at the very end (the URL parser would encode respectively strip it). Everything
 * else is kept verbatim, so decoding the URI yields the original bytes and `e()` is a no-op on it.
 */
final class SvgDataUri
{
    public const string PREFIX = 'data:image/svg+xml,';

    /** @var ?array<string, string> */
    private static ?array $map = null;

    public static function encode(string $svg): string
    {
        $encoded = strtr($svg, self::$map ??= self::map());

        if (str_contains($encoded, ' ?')) {
            $encoded = str_replace(' ?', '%20?', $encoded);
        }

        $trimmed = rtrim($encoded, ' ');
        if ($trimmed !== $encoded) {
            $encoded = $trimmed . str_repeat('%20', strlen($encoded) - strlen($trimmed));
        }

        return self::PREFIX . $encoded;
    }

    /**
     * @return array<string, string>
     */
    private static function map(): array
    {
        $map = [];
        for ($byte = 0; $byte < 256; $byte++) {
            if ($byte < 0x20 || $byte >= 0x7F) {
                $map[chr($byte)] = sprintf('%%%02X', $byte);
            }
        }

        foreach (['%', '#', '"', "'", '&', '<', '>'] as $char) {
            $map[$char] = sprintf('%%%02X', ord($char));
        }

        return $map;
    }
}
