<?php

namespace LaGameTV\FileIcons\Icons;

use InvalidArgumentException;
use RuntimeException;

/**
 * A VS Code file icon theme manifest as VS Code would see it for a given set of options.
 *
 * The generated data (resources/data/<theme>.php) contains the dark maps of the theme; for the
 * Material Icon Theme those of `generateManifest({ activeIconPack: '' })` plus per-pack overrides.
 * This class overlays the active pack and applies `files.associations` / `folders.associations`
 * exactly like Material's generator does (fileGenerator.ts / folderGenerator.ts), so that
 * IconResolver only has to replicate VS Code's CSS selector matching. Themes without packs,
 * language ids or a light section (Datapack Icons) use the same code with empty tables.
 *
 * Light-theme maps (Material Icon Theme only) are derived: for file and folder names/extensions
 * Material maps `key => X_light` for every key of an icon `X` that has a light variant, but only for its
 * built-in mappings (custom associations never get a light entry). The light lookup therefore
 * uses the built-in tables (after pack overlay and `**.ext` removal) and maps the value to
 * `X_light` if that icon is shipped. Language ids only get light mappings for an explicit list.
 *
 * Pure PHP: no Laravel or Filament dependencies.
 */
final class IconTheme
{
    public const int FORMAT = 1;

    public const string LIGHT_SUFFIX = '_light';

    /** Material constants.ts `wildcardPattern`. */
    private const string WILDCARD = '/^\*{1,2}\./';

    /** Material fileGenerator.ts: two asterisks also overwrite file names containing the extension. */
    private const string OVERWRITE_WILDCARD = '/^\*{2}\./';

    /** Material folderGenerator.ts `extendFolderNames()`. */
    private const array FOLDER_VARIANTS = [['', ''], ['.', ''], ['_', ''], ['-', ''], ['__', '__']];

    /** JS `\s`, without PCRE's Unicode-mode extras such as U+0085. */
    private const string JS_WHITESPACE = '/[\t\n\x{0B}\f\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}]/u';

    private const array FLAT_SECTIONS = ['fileNames', 'fileExtensions', 'languageIds', 'folderNames'];

    private const array NESTED_SECTIONS = ['fileNamesByParent', 'fileExtensionsByParent', 'folderNamesByParent'];

    /**
     * Language ids with a light-theme mapping (Material 5.40.0 languageIcons with `light: true`).
     * Unlike file and folder names, a language id does NOT get a light mapping just because its
     * icon has a `_light` variant (e.g. `jinja`, `hcl`), so this cannot be derived from the icons.
     * The generated manifest may override it with an optional `lightLanguageIds` list.
     */
    private const array LIGHT_LANGUAGE_IDS = ['toml', 'systemd-conf', 'systemd-unit-file'];

    /** Positions per rank class in definitionRank(). */
    private const int RANK_SCALE = 1000000;

    /** Allowed theme ids (= data file names). */
    private const string THEME_PATTERN = '/^[a-z0-9][a-z0-9_-]*$/';

    /** @var array<string, int> */
    private array $icons = [];

    /** @var array<string, int> */
    private array $lightLanguageIds = [];

    private string $id;

    /** Whether light-theme icons are derived from `_light` variants (Material Icon Theme). */
    private bool $derivesLight;

    /** @var list<string> */
    private array $packs = [];

    private string $hash;

    private string $defaultFile;

    private string $defaultFolder;

    private string $folderTheme;

    private string $pack;

    /** @var array<string, mixed> */
    private array $base;

    /** @var array<string, mixed> */
    private array $packOverride;

    /** @var array<string, mixed> */
    private array $languageData;

    /** @var ?array<string, array<array-key, mixed>> effective (dark) tables, built lazily */
    private ?array $dark = null;

    /** @var array<string, array<array-key, mixed>> built-in tables the light maps are derived from */
    private array $light = [];

    /** @var array<array-key, string> */
    private array $langFilenames = [];

    /** @var array<array-key, string> */
    private array $langExtensions = [];

    private int $langMaxExtensionLength = 0;

    /** @var list<array{0: string, 1: bool, 2: string, 3: int}> regex, onPath, language id, glob length */
    private array $langPatterns = [];

    private bool $languagesCompiled = false;

    /** @var ?list<array{0: string, 1: bool}> combined pattern regexes (with `(*MARK:index)`) and whether they match the path */
    private ?array $langPatternMatchers = null;

    /** @var ?array<string, int> */
    private ?array $ranks = null;

    /**
     * VS Code's CSS rule order (optional manifest keys, see definitionRank()): `definitionOrder` (icon
     * ids of the built-in dark associations) and the active pack's insertions into it.
     *
     * @var array{definitionOrder: mixed, pack: mixed}
     */
    private array $ruleOrder = ['definitionOrder' => null, 'pack' => null];

    /** @var ?array<string, int> icon id => position in VS Code's rule order (active pack applied), built lazily */
    private ?array $definitionPositions = null;

    /**
     * @param  array<mixed>  $manifest
     * @param  array<mixed>  $languages
     */
    private function __construct(array $manifest, array $languages, private readonly IconThemeOptions $options)
    {
        $id = $manifest['theme'] ?? null;
        $this->id = is_string($id) && preg_match(self::THEME_PATTERN, $id) === 1 ? $id : Themes::MATERIAL;
        $this->derivesLight = $this->id === Themes::MATERIAL;

        foreach (is_array($manifest['icons'] ?? null) ? $manifest['icons'] : [] as $icon => $_) {
            $this->icons[(string) $icon] = 1;
        }

        foreach (is_array($manifest['packs'] ?? null) ? $manifest['packs'] : [] as $pack) {
            if (is_string($pack) && $pack !== '') {
                $this->packs[] = $pack;
            }
        }

        $lightLanguageIds = is_array($manifest['lightLanguageIds'] ?? null) ? $manifest['lightLanguageIds'] : self::LIGHT_LANGUAGE_IDS;
        foreach ($lightLanguageIds as $languageId) {
            if (is_string($languageId)) {
                $this->lightLanguageIds[$languageId] = 1;
            }
        }

        $hash = $manifest['hash'] ?? '';
        $this->hash = is_string($hash) ? $hash : '';

        $defaults = is_array($manifest['defaults'] ?? null) ? $manifest['defaults'] : [];
        $this->defaultFile = is_string($defaults['file'] ?? null) && $defaults['file'] !== '' ? $defaults['file'] : 'file';
        $this->defaultFolder = is_string($defaults['folder'] ?? null) && $defaults['folder'] !== '' ? $defaults['folder'] : 'folder';

        $this->folderTheme = in_array($options->folderTheme, IconThemeOptions::FOLDER_THEMES, true) ? $options->folderTheme : 'specific';

        $defaultPack = is_string($manifest['defaultPack'] ?? null) ? $manifest['defaultPack'] : '';
        $pack = $options->iconPack ?? $defaultPack;
        $overrides = is_array($manifest['packOverrides'] ?? null) ? $manifest['packOverrides'] : [];
        // Material only enables icons whose `enabledFor` contains the active pack, so an unknown pack equals ''.
        $this->pack = ($pack !== '' && is_array($overrides[$pack] ?? null)) ? $pack : '';
        $this->packOverride = $this->pack !== '' ? $overrides[$this->pack] : [];

        $packOrder = is_array($manifest['packOrder'] ?? null) ? $manifest['packOrder'] : [];
        $this->ruleOrder = [
            'definitionOrder' => $manifest['definitionOrder'] ?? null,
            'pack' => $this->pack !== '' && is_array($packOrder[$this->pack] ?? null) ? $packOrder[$this->pack] : [],
        ];

        $this->base = is_array($manifest['base'] ?? null) ? $manifest['base'] : [];
        $this->languageData = $languages;
    }

    /**
     * Load `$dataDir/$theme.php` (see Themes) and `$dataDir/languages.php`.
     */
    public static function load(string $dataDir, IconThemeOptions $options, string $theme = Themes::MATERIAL): self
    {
        if (preg_match(self::THEME_PATTERN, $theme) !== 1) {
            throw new InvalidArgumentException("Invalid icon theme id [$theme].");
        }

        $dir = rtrim($dataDir, '/\\');
        $manifest = self::requireData($dir . DIRECTORY_SEPARATOR . $theme . '.php');
        $manifest['theme'] ??= $theme;

        return self::fromArrays($manifest, self::requireData($dir . DIRECTORY_SEPARATOR . 'languages.php'), $options);
    }

    /**
     * @param  array<mixed>  $manifest
     * @param  array<mixed>  $languages
     */
    public static function fromArrays(array $manifest, array $languages, IconThemeOptions $options): self
    {
        if (($manifest['format'] ?? null) !== self::FORMAT) {
            throw new InvalidArgumentException('Unsupported icon theme data format.');
        }

        if (($languages['format'] ?? null) !== self::FORMAT) {
            throw new InvalidArgumentException('Unsupported VS Code language data format.');
        }

        return new self($manifest, $languages, $options);
    }

    /**
     * Theme id (Themes::MATERIAL, Themes::DATAPACK), from the data file's 'theme' key.
     */
    public function id(): string
    {
        return $this->id;
    }

    public function options(): IconThemeOptions
    {
        return $this->options;
    }

    public function hasIcon(string $icon): bool
    {
        return isset($this->icons[$icon]);
    }

    public function lightVariant(string $icon): ?string
    {
        $light = $icon . self::LIGHT_SUFFIX;

        return isset($this->icons[$light]) ? $light : null;
    }

    public function version(): string
    {
        return $this->hash;
    }

    /**
     * @return list<string>
     */
    public function iconNames(): array
    {
        $names = array_map('strval', array_keys($this->icons));
        sort($names, SORT_STRING);

        return $names;
    }

    /**
     * Shipped closed-folder icons, sorted. Material Icon Theme: 'folder' and 'folder-*' (no '-open',
     * no '_light'); other themes: the default folder icon and every icon of the folder name maps.
     *
     * @return list<string>
     */
    public function folderIconNames(): array
    {
        if ($this->id === Themes::MATERIAL) {
            return array_values(array_filter(
                $this->iconNames(),
                static fn (string $icon): bool => $icon === 'folder'
                    || (str_starts_with($icon, 'folder-') && !str_ends_with($icon, '-open') && !str_ends_with($icon, self::LIGHT_SUFFIX)),
            ));
        }

        $icons = [$this->defaultFolder => true];
        foreach ([$this->base, $this->packOverride] as $section) {
            foreach (is_array($section['folderNames'] ?? null) ? $section['folderNames'] : [] as $icon) {
                if (is_string($icon)) {
                    $icons[$icon] = true;
                }
            }

            foreach (is_array($section['folderNamesByParent'] ?? null) ? $section['folderNamesByParent'] : [] as $names) {
                foreach (is_array($names) ? $names : [] as $icon) {
                    if (is_string($icon)) {
                        $icons[$icon] = true;
                    }
                }
            }
        }

        $names = array_values(array_filter(array_map('strval', array_keys($icons)), fn (string $icon): bool => isset($this->icons[$icon])));
        sort($names, SORT_STRING);

        return $names;
    }

    /**
     * @return list<string>
     */
    public function packs(): array
    {
        return $this->packs;
    }

    /**
     * @internal the effective (normalised) folder theme
     */
    public function folderTheme(): string
    {
        return $this->folderTheme;
    }

    /**
     * @internal the effective icon pack ('' => none)
     */
    public function activePack(): string
    {
        return $this->pack;
    }

    /**
     * @internal
     */
    public function defaultFileIcon(): string
    {
        return $this->defaultFile;
    }

    /**
     * @internal
     */
    public function defaultFolderIcon(): string
    {
        return $this->defaultFolder;
    }

    /**
     * @internal whether the theme has light-theme rules (VS Code `.vs` selectors); without them
     * the light theme shows exactly the dark icons
     */
    public function hasLightRules(): bool
    {
        return $this->derivesLight;
    }

    /**
     * @internal whether any language id rule exists (otherwise language detection can be skipped)
     */
    public function hasLanguageRules(): bool
    {
        $this->dark ??= $this->buildTables();

        return $this->dark['languageIds'] !== [];
    }

    /**
     * Look up a (lowercased, selector-escaped) key in one of the manifest maps.
     *
     * @internal used by IconResolver
     *
     * @param  'fileNames'|'fileExtensions'|'languageIds'|'folderNames'  $section
     */
    public function lookup(string $section, string $key, ?string $parent, bool $light): ?string
    {
        $this->dark ??= $this->buildTables();

        if ($light && (!$this->derivesLight || ($section === 'languageIds' && !isset($this->lightLanguageIds[$key])))) {
            return null;
        }

        $tables = $light ? $this->light : $this->dark;

        if ($parent === null) {
            $value = $tables[$section][$key] ?? null;
        } else {
            $value = $tables[$section . 'ByParent'][$parent][$key] ?? null;
        }

        // '' = an association with an empty icon name: Material maps the key to '' and VS Code emits no rule.
        if (!is_string($value) || $value === '') {
            return null;
        }

        return $light ? $this->lightVariant($value) : $value;
    }

    /**
     * Position of an icon definition in VS Code's generated CSS, used to break specificity ties
     * (the later rule wins). VS Code emits one rule per definition, ordered by the first selector
     * that used it: dark pass (defaults 0, folderNames 1, languageIds 2, fileExtensions 3,
     * fileNames 4), then the light pass (5..9). Within one class the optional manifest key
     * `definitionOrder` (icon ids in VS Code's rule order for the built-in dark associations) decides;
     * without it, ties within one class cannot be resolved and return the same value.
     *
     * @internal used by IconResolver
     */
    public function definitionRank(string $icon): int
    {
        $this->dark ??= $this->buildTables();

        if ($this->ranks === null) {
            $this->ranks = [];
            $passes = $this->derivesLight ? [[$this->dark, false, 0], [$this->light, true, 5]] : [[$this->dark, false, 0]];
            foreach ($passes as [$tables, $light, $offset]) {
                $defaults = $this->folderTheme === 'none' ? [$this->defaultFile] : [$this->defaultFolder, $this->defaultFile];
                foreach ($defaults as $default) {
                    $this->rank($light ? $this->lightVariant($default) : $default, $offset * self::RANK_SCALE);
                }

                foreach (['folderNames' => 1, 'languageIds' => 2, 'fileExtensions' => 3, 'fileNames' => 4] as $section => $rank) {
                    $used = [];
                    foreach ($tables[$section] as $key => $value) {
                        if (is_string($value) && (!$light || $section !== 'languageIds' || isset($this->lightLanguageIds[$key]))) {
                            $used[$value] = true;
                        }
                    }

                    if ($section !== 'languageIds') {
                        foreach ($tables[$section . 'ByParent'] as $names) {
                            foreach (is_array($names) ? $names : [] as $value) {
                                if (is_string($value)) {
                                    $used[$value] = true;
                                }
                            }
                        }
                    }

                    $positions = $this->definitionPositions();
                    foreach ($used as $usedIcon => $_) {
                        $usedIcon = (string) $usedIcon;
                        // Icons that only associations use are emitted after the built-in ones.
                        $position = $light ? self::RANK_SCALE - 1 : ($positions[$usedIcon] ?? self::RANK_SCALE - 1);
                        $this->rank($light ? $this->lightVariant($usedIcon) : $usedIcon, ($offset + $rank) * self::RANK_SCALE + $position);
                    }
                }
            }
        }

        return $this->ranks[$icon] ?? 10 * self::RANK_SCALE;
    }

    /**
     * getIconClasses.ts / fileIconThemeData.ts fileIconSelectorEscape(): JS `\s` becomes '/'.
     * Applied to row names and to manifest keys alike.
     *
     * @internal
     */
    public static function selectorEscape(string $value): string
    {
        if (preg_match('/[^\x21-\x7E]/', $value) !== 1) {
            return $value;
        }

        return preg_replace(self::JS_WHITESPACE, '/', $value) ?? $value;
    }

    /**
     * VS Code's rule order of the built-in (dark) icon definitions for the active pack: the manifest's
     * `definitionOrder` with the pack's insertions (`packOrder[pack][definitionOrder]`, anchor id =>
     * ids inserted right after it, '' = at the start), as icon id => position.
     *
     * @return array<string, int>
     */
    private function definitionPositions(): array
    {
        if ($this->definitionPositions !== null) {
            return $this->definitionPositions;
        }

        $base = is_array($this->ruleOrder['definitionOrder']) ? $this->ruleOrder['definitionOrder'] : [];
        $pack = is_array($this->ruleOrder['pack']) ? $this->ruleOrder['pack'] : [];
        $inserts = is_array($pack['definitionOrder'] ?? null) ? $pack['definitionOrder'] : [];

        $order = is_array($inserts[''] ?? null) ? $inserts[''] : [];
        foreach ($base as $id) {
            $order[] = $id;
            if (is_string($id) && is_array($inserts[$id] ?? null)) {
                array_push($order, ...array_values($inserts[$id]));
            }
        }

        $positions = [];
        foreach (array_values($order) as $position => $id) {
            if (is_string($id) && !isset($positions[$id])) {
                $positions[$id] = $position;
            }
        }

        return $this->definitionPositions = $positions;
    }

    private function rank(?string $icon, int $rank): void
    {
        if ($icon !== null && $icon !== '' && !isset($this->ranks[$icon])) {
            $this->ranks[$icon] = $rank;
        }
    }

    /**
     * VS Code `getAssociationByPath()` over the built-in language contributions:
     * exact file name > longest matching glob (later registration wins ties) > longest extension suffix.
     *
     * @internal used by IconResolver
     *
     * @param  string  $name  lowercased base name
     * @param  string  $path  lowercased absolute path ('/dir/name')
     */
    public function languageIdFor(string $name, string $path): ?string
    {
        if (!$this->languagesCompiled) {
            $this->compileLanguages();
        }

        if ($name !== '' && isset($this->langFilenames[$name])) {
            return $this->langFilenames[$name];
        }

        $match = null;
        if ($this->langPatternMatchers !== null) {
            // One combined, priority-ordered regex per target (base name / full path).
            foreach ($this->langPatternMatchers as [$combined, $onPath]) {
                if (preg_match($combined, $onPath ? $path : $name, $matches) === 1 && isset($matches['MARK'])) {
                    $index = (int) $matches['MARK'];
                    if ($match === null || $this->langPatterns[$index][3] > $this->langPatterns[$match][3] || ($this->langPatterns[$index][3] === $this->langPatterns[$match][3] && $index > $match)) {
                        $match = $index;
                    }
                }
            }
        } else {
            $matchLength = -1;
            for ($i = count($this->langPatterns) - 1; $i >= 0; $i--) {
                [$regex, $onPath, , $length] = $this->langPatterns[$i];
                if ($length > $matchLength && preg_match($regex, $onPath ? $path : $name) === 1) {
                    $match = $i;
                    $matchLength = $length;
                }
            }
        }

        if ($match !== null) {
            return $this->langPatterns[$match][2];
        }

        $nameLength = strlen($name);
        for ($offset = max(0, $nameLength - $this->langMaxExtensionLength); $offset < $nameLength; $offset++) {
            $suffix = substr($name, $offset);
            if (isset($this->langExtensions[$suffix])) {
                return $this->langExtensions[$suffix];
            }
        }

        return null;
    }

    /**
     * @return array<string, array<array-key, mixed>>
     */
    private function buildTables(): array
    {
        $tables = self::normaliseSection($this->base);

        if ($this->packOverride !== []) {
            $tables = self::overlay($tables, $this->packOverride);
        }

        if ($this->folderTheme === 'classic') {
            // The classic folder theme has no specific folder icons, only the generic folder.
            $tables['folderNames'] = [];
            $tables['folderNamesByParent'] = [];
        }

        // Extras first so the admin's own associations win.
        $fileAssociations = self::pairs($this->options->gameServerExtras ? GameServerExtras::fileAssociations($this->id) : [], $this->options->fileAssociations);
        $folderAssociations = self::pairs($this->options->gameServerExtras ? GameServerExtras::folderAssociations($this->id) : [], $this->options->folderAssociations);

        // '**.ext' removes every file name mapping (built-in and custom) that contains '.ext'.
        $overwrites = [];
        foreach ($fileAssociations as [$key]) {
            if (preg_match(self::OVERWRITE_WILDCARD, $key) === 1) {
                $overwrites[] = mb_strtolower((string) preg_replace(self::WILDCARD, '.', $key, 1));
            }
        }
        $overwrites = array_values(array_unique($overwrites));

        if ($overwrites !== []) {
            $tables['fileNames'] = array_filter(
                $tables['fileNames'],
                static fn (mixed $name): bool => !self::isOverwritten((string) $name, $overwrites),
                ARRAY_FILTER_USE_KEY,
            );

            foreach ($tables['fileNamesByParent'] as $parent => $names) {
                $kept = array_filter(
                    is_array($names) ? $names : [],
                    static fn (mixed $name): bool => !self::isOverwritten($parent . '/' . $name, $overwrites),
                    ARRAY_FILTER_USE_KEY,
                );

                if ($kept === []) {
                    unset($tables['fileNamesByParent'][$parent]);
                } else {
                    $tables['fileNamesByParent'][$parent] = $kept;
                }
            }
        }

        // VS Code escapes whitespace in manifest keys (and row names) to '/'.
        $tables = self::escapeKeys($tables);

        // Custom associations never get light-theme entries in Material.
        $this->light = $tables;

        foreach ($fileAssociations as [$key, $value]) {
            if (!is_string($value)) {
                continue;
            }

            // An empty icon name removes the mapping (VS Code emits no rule for it); unknown icons are ignored.
            $icon = mb_strtolower($value);
            if ($icon !== '' && !isset($this->icons[$icon])) {
                continue;
            }

            $lower = mb_strtolower($key);
            if (preg_match(self::WILDCARD, $key) === 1) {
                self::assign($tables, 'fileExtensions', (string) preg_replace(self::WILDCARD, '', $lower, 1), $icon);
            } elseif ($overwrites === [] || !self::isOverwritten($lower, $overwrites)) {
                self::assign($tables, 'fileNames', $lower, $icon);
            }
        }

        if ($this->folderTheme !== 'none') {
            foreach ($folderAssociations as [$key, $value]) {
                if (!is_string($value)) {
                    continue;
                }

                $icon = $this->folderAssociationIcon($value);
                if (!isset($this->icons[$icon])) {
                    continue;
                }

                $name = mb_strtolower($key);
                foreach (self::FOLDER_VARIANTS as [$prefix, $suffix]) {
                    self::assign($tables, 'folderNames', $prefix . $name . $suffix, $icon);
                }
            }
        }

        return $tables;
    }

    /**
     * Icon of a folder association value: Material `folders.associations` syntax ('' => 'folder',
     * suffix => 'folder-' . suffix) for the Material Icon Theme, the icon id itself for other themes.
     */
    private function folderAssociationIcon(string $value): string
    {
        $value = mb_strtolower($value);

        if ($this->id !== Themes::MATERIAL) {
            return $value === '' ? $this->defaultFolder : $value;
        }

        return $value === '' ? 'folder' : 'folder-' . $value;
    }

    private function compileLanguages(): void
    {
        $this->languagesCompiled = true;

        foreach (is_array($this->languageData['filenames'] ?? null) ? $this->languageData['filenames'] : [] as $name => $id) {
            if (is_string($id) && (string) $name !== '') {
                $this->langFilenames[(string) $name] = $id;
            }
        }

        foreach (is_array($this->languageData['extensions'] ?? null) ? $this->languageData['extensions'] : [] as $suffix => $id) {
            $suffix = (string) $suffix;
            if (is_string($id) && $suffix !== '') {
                $this->langExtensions[$suffix] = $id;
                $this->langMaxExtensionLength = max($this->langMaxExtensionLength, strlen($suffix));
            }
        }

        foreach (is_array($this->languageData['patterns'] ?? null) ? $this->languageData['patterns'] : [] as $pattern) {
            if (!is_array($pattern) || !is_string($pattern['regex'] ?? null) || !is_string($pattern['id'] ?? null)) {
                continue;
            }

            $glob = is_string($pattern['glob'] ?? null) ? $pattern['glob'] : '';
            $onPath = is_bool($pattern['onPath'] ?? null) ? $pattern['onPath'] : str_contains($glob, '/');
            $regex = self::compilePattern($pattern['regex']);
            if ($regex === null) {
                continue;
            }

            $this->langPatterns[] = [$regex, $onPath, $pattern['id'], strlen($glob)];
        }

        $this->langPatternMatchers = $this->combinePatterns();
    }

    /**
     * Combine the patterns of each target into one alternation ordered by VS Code's priority
     * (longest glob first, later registration first). Every alternative is anchored, so the first
     * alternative that matches is the winner; `(*MARK)` reports which one it was.
     *
     * @return ?list<array{0: string, 1: bool}> null => match the patterns one by one
     */
    private function combinePatterns(): ?array
    {
        $order = array_keys($this->langPatterns);
        usort($order, fn (int $a, int $b): int => [$this->langPatterns[$b][3], $b] <=> [$this->langPatterns[$a][3], $a]);

        $groups = [];
        $suffix = null;
        foreach ($order as $index) {
            $regex = $this->langPatterns[$index][0];
            $end = strrpos($regex, '~');
            if ($regex[0] !== '~' || $end === false || $end === 0) {
                return null;
            }

            $flags = substr($regex, $end + 1);
            if ($suffix !== null && $flags !== $suffix) {
                return null;
            }
            $suffix = $flags;

            $groups[(int) $this->langPatterns[$index][1]][] = '(?:' . substr($regex, 1, $end - 1) . ')(*MARK:' . $index . ')';
        }

        $matchers = [];
        foreach ($groups as $onPath => $alternatives) {
            $combined = '~' . implode('|', $alternatives) . '~' . $suffix;
            if (@preg_match($combined, '') === false) {
                return null;
            }

            $matchers[] = [$combined, $onPath === 1];
        }

        return $matchers;
    }

    /**
     * Adapt a generated glob regex (`~^…$~i…`) to VS Code's JS semantics on the lowercased path:
     * - UTF-8 mode, so a glob `?` matches one character instead of one byte;
     * - no PCRE caseless flag, whose Unicode case folding would let e.g. 'ſ' match 's' (JS `/i`
     *   without `u` never maps non-ASCII to ASCII); since the subject is already lowercased, matching
     *   the lowercased pattern literals case-sensitively is equivalent.
     * Falls back to the regex as generated; invalid regexes are dropped.
     */
    private static function compilePattern(string $regex): ?string
    {
        $delimiter = $regex[0] ?? '';
        $end = $delimiter === '' || ctype_alnum($delimiter) || $delimiter === '\\' ? false : strrpos($regex, $delimiter);

        if ($end !== false && $end > 0) {
            $body = substr($regex, 1, $end - 1);
            $flags = substr($regex, $end + 1);

            if (str_contains($flags, 'i')) {
                $body = self::lowercaseLiterals($body);
                $flags = str_replace('i', '', $flags);
            }

            $adapted = $delimiter . $body . $delimiter . (str_contains($flags, 'u') ? $flags : $flags . 'u');
            if (@preg_match($adapted, '') !== false) {
                return $adapted;
            }
        }

        return @preg_match($regex, '') !== false ? $regex : null;
    }

    /**
     * Lowercase ASCII letters of a regex body, leaving escape sequences (`\S`, `\x{..}`, …) intact.
     */
    private static function lowercaseLiterals(string $body): string
    {
        $result = '';
        $length = strlen($body);
        for ($i = 0; $i < $length; $i++) {
            $char = $body[$i];
            if ($char === '\\' && $i + 1 < $length) {
                $result .= $char . $body[++$i];

                continue;
            }

            $result .= strtolower($char);
        }

        return $result;
    }

    /**
     * @param  array<string, array<array-key, mixed>>  $tables
     */
    private static function assign(array &$tables, string $section, string $key, string $icon): void
    {
        // VS Code fileIconThemeData.ts handleParentFolder(): split at the last '/', then escape both parts.
        $slash = strrpos($key, '/');

        if ($slash === false) {
            $tables[$section][self::selectorEscape($key)] = $icon;

            return;
        }

        $tables[$section . 'ByParent'][self::selectorEscape(substr($key, 0, $slash))][self::selectorEscape(substr($key, $slash + 1))] = $icon;
    }

    /**
     * Apply selectorEscape() to the keys of the generated tables (normally a no-op).
     *
     * @param  array<string, array<array-key, mixed>>  $tables
     * @return array<string, array<array-key, mixed>>
     */
    private static function escapeKeys(array $tables): array
    {
        foreach (self::FLAT_SECTIONS as $section) {
            $tables[$section] = self::escapeMapKeys($tables[$section]);
        }

        foreach (self::NESTED_SECTIONS as $section) {
            $nested = self::escapeMapKeys($tables[$section]);
            foreach ($nested as $parent => $names) {
                if (is_array($names)) {
                    $nested[$parent] = self::escapeMapKeys($names);
                }
            }
            $tables[$section] = $nested;
        }

        return $tables;
    }

    /**
     * @param  array<array-key, mixed>  $map
     * @return array<array-key, mixed>
     */
    private static function escapeMapKeys(array $map): array
    {
        $candidates = preg_grep('/[^\x21-\x7E]/', array_map('strval', array_keys($map)));
        if ($candidates === false || $candidates === []) {
            return $map;
        }

        foreach ($candidates as $key) {
            $escaped = self::selectorEscape($key);
            if ($escaped !== $key) {
                $value = $map[$key];
                unset($map[$key]);
                $map[$escaped] = $value;
            }
        }

        return $map;
    }

    /**
     * @param  list<string>  $overwrites
     */
    private static function isOverwritten(string $fileName, array $overwrites): bool
    {
        $fileName = mb_strtolower($fileName);
        foreach ($overwrites as $extension) {
            if (str_contains($fileName, $extension)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<mixed>  ...$maps
     * @return list<array{0: string, 1: mixed}>
     */
    private static function pairs(array ...$maps): array
    {
        $pairs = [];
        foreach ($maps as $map) {
            foreach ($map as $key => $value) {
                $key = (string) $key;
                if ($key !== '') {
                    $pairs[] = [$key, $value];
                }
            }
        }

        return $pairs;
    }

    /**
     * @param  array<mixed>  $section
     * @return array<string, array<array-key, mixed>>
     */
    private static function normaliseSection(array $section): array
    {
        $normalised = [];
        foreach ([...self::FLAT_SECTIONS, ...self::NESTED_SECTIONS] as $name) {
            $normalised[$name] = is_array($section[$name] ?? null) ? $section[$name] : [];
        }

        return $normalised;
    }

    /**
     * Pack overrides: a string sets/replaces the mapping, null removes it.
     *
     * @param  array<string, array<array-key, mixed>>  $tables
     * @param  array<mixed>  $override
     * @return array<string, array<array-key, mixed>>
     */
    private static function overlay(array $tables, array $override): array
    {
        foreach (self::FLAT_SECTIONS as $section) {
            foreach (is_array($override[$section] ?? null) ? $override[$section] : [] as $key => $value) {
                if (is_string($value)) {
                    $tables[$section][$key] = $value;
                } else {
                    unset($tables[$section][$key]);
                }
            }
        }

        foreach (self::NESTED_SECTIONS as $section) {
            foreach (is_array($override[$section] ?? null) ? $override[$section] : [] as $parent => $names) {
                if (!is_array($names)) {
                    unset($tables[$section][$parent]);

                    continue;
                }

                foreach ($names as $key => $value) {
                    if (is_string($value)) {
                        $tables[$section][$parent][$key] = $value;
                    } else {
                        unset($tables[$section][$parent][$key]);
                    }
                }

                if (($tables[$section][$parent] ?? []) === []) {
                    unset($tables[$section][$parent]);
                }
            }
        }

        return $tables;
    }

    /**
     * @return array<mixed>
     */
    private static function requireData(string $file): array
    {
        if (!is_file($file) || !is_readable($file)) {
            throw new RuntimeException("Icon data file [$file] is missing, run `bun run build`.");
        }

        $data = (static fn (string $path): mixed => require $path)($file);

        if (!is_array($data)) {
            throw new RuntimeException("Icon data file [$file] does not return an array.");
        }

        return $data;
    }
}
