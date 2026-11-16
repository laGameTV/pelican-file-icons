<?php

namespace LaGameTV\FileIcons\Icons;

/**
 * Resolves file and folder icons exactly like VS Code renders the icons of a file icon theme
 * (Material Icon Theme, Datapack Icons) in the explorer (src/vs/editor/common/services/getIconClasses.ts
 * + fileIconThemeData.ts):
 *
 * every row gets CSS classes derived from its lowercased name, parent folder, dot-suffixes and
 * language id; every manifest entry becomes a CSS rule; the most specific matching rule wins.
 * This class computes that winner directly by specificity, for the dark (default) rules and for
 * the light-theme rules (`.vs` prefix: +1 specificity, emitted after the dark rules; themes without
 * light rules show the dark icons in light mode).
 *
 * Specificity (number of classes) per rule, for a name with k dot-segments:
 *   default file 2, languageIds 3, fileExtensions (s segments) s+3, fileNames k+4,
 *   '+1' for a parent-folder qualified key, default folder 2, folderNames 3 (+1 with parent).
 * Equal specificity is decided by CSS rule order (IconTheme::definitionRank()).
 * Whitespace in names and keys becomes '/' (fileIconSelectorEscape), names longer than 255 UTF-16
 * units get no extension classes, and an undetected language is the id 'unknown', all as in VS Code.
 *
 * Pure PHP: no Laravel or Filament dependencies.
 */
final class IconResolver
{
    private const int MEMO_LIMIT = 20000;

    /** @var array<string, ?ResolvedIcon> */
    private array $memo = [];

    public function __construct(private readonly IconTheme $theme) {}

    /**
     * @param  string  $name  base name of the file
     * @param  ?string  $directory  directory containing the entry, '/'-separated, server-relative ('/', '/plugins/Essentials'), null if unknown
     * @param  ?string  $mimeType  MIME type reported by Wings (used only as a fallback)
     */
    public function forFile(string $name, ?string $directory = null, ?string $mimeType = null): ResolvedIcon
    {
        $memoKey = "f\0" . $name . "\0" . ($directory ?? "\x01") . "\0" . ($mimeType ?? "\x01");
        if (isset($this->memo[$memoKey])) {
            return $this->memo[$memoKey];
        }

        [$baseName, $parent, $path] = self::split($name, $directory);

        $class = IconTheme::selectorEscape($baseName);
        $parentClass = $parent === null ? null : IconTheme::selectorEscape($parent);

        $segments = explode('.', $class);
        $segmentCount = count($segments);

        // getIconClasses.ts: no extension classes for names longer than 255 (UTF-16) characters.
        $hasExtensionClasses = strlen($class) <= 255 || self::utf16Length($class) <= 255;

        $suffixes = [];
        if ($hasExtensionClasses) {
            for ($i = 1; $i < $segmentCount; $i++) {
                $suffixes[] = implode('.', array_slice($segments, $i));
            }
        }

        // Without extension classes a fileNames rule only matches keys without dots.
        $fileNameMatchable = $hasExtensionClasses || $segmentCount === 1;

        // Unknown files get the 'unknown' language id in VS Code (detection is skipped for themes without language rules).
        $languageId = $this->theme->hasLanguageRules()
            ? IconTheme::selectorEscape($this->theme->languageIdFor($baseName, $path) ?? 'unknown')
            : 'unknown';

        $dark = $this->bestFileRule(false, $class, $parentClass, $segmentCount, $fileNameMatchable, $suffixes, $languageId)
            ?? [2, $this->theme->defaultFileIcon(), 'default'];
        $light = $this->theme->hasLightRules() ? $this->bestFileRule(true, $class, $parentClass, $segmentCount, $fileNameMatchable, $suffixes, $languageId) : null;

        $resolved = null;
        if ($dark[2] === 'default' && $mimeType !== null && $this->theme->options()->mimeFallback) {
            $mimeIcon = MimeTypeIcons::iconFor($mimeType, $this->theme->id());
            if ($mimeIcon !== null && $this->theme->hasIcon($mimeIcon)) {
                $resolved = new ResolvedIcon($mimeIcon, $this->theme->lightVariant($mimeIcon), 'mimeType');
            }
        }

        $resolved ??= new ResolvedIcon($dark[1], $this->lightWinner($dark, $light), $dark[2]);

        return $this->remember($memoKey, $resolved);
    }

    /**
     * @param  string  $name  base name of the folder
     * @param  ?string  $directory  directory containing the folder, '/'-separated, server-relative, null if unknown
     * @return ?ResolvedIcon null iff the folder theme is 'none' (keep the panel's own folder icon)
     */
    public function forFolder(string $name, ?string $directory = null): ?ResolvedIcon
    {
        if ($this->theme->folderTheme() === 'none') {
            return null;
        }

        $memoKey = "d\0" . $name . "\0" . ($directory ?? "\x01");
        if (isset($this->memo[$memoKey])) {
            return $this->memo[$memoKey];
        }

        [$baseName, $parent] = self::split($name, $directory);

        $class = IconTheme::selectorEscape($baseName);
        $parentClass = $parent === null ? null : IconTheme::selectorEscape($parent);

        $dark = $this->bestFolderRule(false, $class, $parentClass) ?? [2, $this->theme->defaultFolderIcon(), 'folderDefault'];
        $light = $this->theme->hasLightRules() ? $this->bestFolderRule(true, $class, $parentClass) : null;

        return $this->remember($memoKey, new ResolvedIcon($dark[1], $this->lightWinner($dark, $light), $dark[2]));
    }

    /**
     * Highest-specificity matching rule of one theme pass (dark or light, without the `.vs` bonus).
     *
     * @param  list<string>  $suffixes  dot-suffixes, longest first
     * @return ?array{0: int, 1: string, 2: string} specificity, icon, source
     */
    private function bestFileRule(bool $light, string $name, ?string $parent, int $segmentCount, bool $fileNameMatchable, array $suffixes, string $languageId): ?array
    {
        if ($fileNameMatchable) {
            if ($parent !== null && ($icon = $this->theme->lookup('fileNames', $name, $parent, $light)) !== null) {
                return [$segmentCount + 5, $icon, 'fileName'];
            }

            if (($icon = $this->theme->lookup('fileNames', $name, null, $light)) !== null) {
                return [$segmentCount + 4, $icon, 'fileName'];
            }
        }

        $best = null;

        if ($parent !== null) {
            foreach ($suffixes as $index => $suffix) {
                if (($icon = $this->theme->lookup('fileExtensions', $suffix, $parent, $light)) !== null) {
                    $best = [$segmentCount - 1 - $index + 4, $icon, 'fileExtension'];

                    break;
                }
            }
        }

        foreach ($suffixes as $index => $suffix) {
            if (($icon = $this->theme->lookup('fileExtensions', $suffix, null, $light)) !== null) {
                $specificity = $segmentCount - 1 - $index + 3;
                // Equal specificity (parent-qualified s vs plain s+1 segments): the later CSS rule wins.
                if (
                    $best === null
                    || $specificity > $best[0]
                    || ($specificity === $best[0] && $this->theme->definitionRank($icon) > $this->theme->definitionRank($best[1]))
                ) {
                    $best = [$specificity, $icon, 'fileExtension'];
                }

                break;
            }
        }

        if ($best !== null) {
            return $best;
        }

        if (($icon = $this->theme->lookup('languageIds', $languageId, null, $light)) !== null) {
            return [3, $icon, 'languageId'];
        }

        if ($light && ($icon = $this->theme->lightVariant($this->theme->defaultFileIcon())) !== null) {
            return [2, $icon, 'default'];
        }

        return null;
    }

    /**
     * @return ?array{0: int, 1: string, 2: string} specificity, icon, source
     */
    private function bestFolderRule(bool $light, string $name, ?string $parent): ?array
    {
        if ($parent !== null && ($icon = $this->theme->lookup('folderNames', $name, $parent, $light)) !== null) {
            return [4, $icon, 'folderName'];
        }

        if (($icon = $this->theme->lookup('folderNames', $name, null, $light)) !== null) {
            return [3, $icon, 'folderName'];
        }

        if ($light && ($icon = $this->theme->lightVariant($this->theme->defaultFolderIcon())) !== null) {
            return [2, $icon, 'folderDefault'];
        }

        return null;
    }

    /**
     * Light rules carry one extra class (`.vs`) and are normally emitted after the dark rules, so
     * they win ties, unless the light icon was already used by a later dark rule (associations).
     *
     * @param  array{0: int, 1: string, 2: string}  $dark
     * @param  ?array{0: int, 1: string, 2: string}  $light
     */
    private function lightWinner(array $dark, ?array $light): ?string
    {
        if ($light === null || $dark[0] > $light[0] + 1 || $light[1] === $dark[1]) {
            return null;
        }

        if ($dark[0] === $light[0] + 1 && $this->theme->definitionRank($dark[1]) > $this->theme->definitionRank($light[1])) {
            return null;
        }

        return $light[1];
    }

    /**
     * @return array{0: string, 1: ?string, 2: string} lowercased base name, lowercased parent folder name, lowercased absolute path
     */
    private static function split(string $name, ?string $directory): array
    {
        $segments = [];
        foreach (explode('/', $directory ?? '') as $segment) {
            if ($segment !== '') {
                $segments[] = $segment;
            }
        }

        $nameSegments = [];
        foreach (explode('/', $name) as $segment) {
            if ($segment !== '') {
                $nameSegments[] = $segment;
            }
        }

        $baseName = array_pop($nameSegments) ?? '';
        array_push($segments, ...$nameSegments);

        $parent = $segments === [] ? null : mb_strtolower($segments[count($segments) - 1], 'UTF-8');
        $segments[] = $baseName;

        return [mb_strtolower($baseName, 'UTF-8'), $parent, mb_strtolower('/' . implode('/', $segments), 'UTF-8')];
    }

    private static function utf16Length(string $value): int
    {
        if (preg_match('//u', $value) !== 1) {
            return strlen($value);
        }

        return intdiv(strlen((string) mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')), 2);
    }

    private function remember(string $key, ResolvedIcon $icon): ResolvedIcon
    {
        if (count($this->memo) >= self::MEMO_LIMIT) {
            $this->memo = [];
        }

        return $this->memo[$key] = $icon;
    }
}
