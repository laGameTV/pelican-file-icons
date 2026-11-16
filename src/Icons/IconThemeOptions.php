<?php

namespace LaGameTV\FileIcons\Icons;

/**
 * Options that influence how the Material Icon Theme manifest is "generated" at runtime.
 *
 * They mirror the Material Icon Theme settings of the VS Code extension:
 * `material-icon-theme.activeIconPack`, `material-icon-theme.folders.theme`,
 * `material-icon-theme.files.associations` and `material-icon-theme.folders.associations`.
 */
final readonly class IconThemeOptions
{
    public const array FOLDER_THEMES = ['specific', 'classic', 'none'];

    /**
     * @param  ?string  $iconPack  null => manifest default pack, '' => no pack, unknown => treated as ''
     * @param  string  $folderTheme  'specific' | 'classic' | 'none'
     * @param  array<string, string>  $fileAssociations  Material `files.associations` syntax ('*.ext' | '**.ext' | 'name' | 'parent/name' => icon)
     * @param  array<string, string>  $folderAssociations  Material `folders.associations` syntax ('name' => icon suffix, '' => plain folder)
     */
    public function __construct(
        public ?string $iconPack = null,
        public string $folderTheme = 'specific',
        public array $fileAssociations = [],
        public array $folderAssociations = [],
        public bool $gameServerExtras = true,
        public bool $mimeFallback = true,
    ) {}

    /**
     * Build options from an array whose keys are exactly the constructor parameter names.
     * Missing (or unusable) values fall back to the defaults.
     *
     * @param  array<mixed>  $a
     */
    public static function fromArray(array $a): self
    {
        $iconPack = $a['iconPack'] ?? null;

        $folderTheme = $a['folderTheme'] ?? null;
        $folderTheme = is_string($folderTheme) ? strtolower(trim($folderTheme)) : '';
        if (!in_array($folderTheme, self::FOLDER_THEMES, true)) {
            $folderTheme = 'specific';
        }

        return new self(
            iconPack: is_string($iconPack) ? $iconPack : null,
            folderTheme: $folderTheme,
            fileAssociations: self::associations($a['fileAssociations'] ?? null),
            folderAssociations: self::associations($a['folderAssociations'] ?? null),
            gameServerExtras: self::boolean($a['gameServerExtras'] ?? null, true),
            mimeFallback: self::boolean($a['mimeFallback'] ?? null, true),
        );
    }

    /**
     * @return array<string, string>
     */
    private static function associations(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (!is_array($value)) {
            return [];
        }

        $associations = [];
        foreach ($value as $key => $icon) {
            if (!is_string($icon) || (is_string($key) && $key === '')) {
                continue;
            }

            $associations[(string) $key] = $icon;
        }

        return $associations;
    }

    private static function boolean(mixed $value, bool $default): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_string($value)) {
            return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
        }

        return $default;
    }
}
