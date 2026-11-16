<?php

namespace LaGameTV\FileIcons\Settings;

use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Support\ConfigOptions;

/**
 * Converts between the plugin config, the settings form state and the .env values.
 *
 * Everything written to the .env file is validated against strict whitelists, so no quotes,
 * backslashes, `#`, `$` or line breaks from user input can ever reach it.
 */
final class SettingsData
{
    public const string ENV_PREFIX = 'FILE_ICONS_';

    /** Allowed characters of a file association pattern ('*.ext', '**.ext', 'name', 'parent/name'). */
    public const string PATTERN_REGEX = '/^[A-Za-z0-9._*+@~\/ -]{1,128}$/';

    /** Allowed characters of a folder association name ('name' or 'parent/name'). */
    public const string FOLDER_REGEX = '/^[A-Za-z0-9._+@~\/ -]{1,128}$/';

    private const string ICON_REGEX = '/^[a-z0-9][a-z0-9_.-]*$/';

    public const array FOLDER_THEMES = ['specific', 'classic', 'none'];

    /** Material `availableIconPacks`, used when the generated data cannot be loaded. */
    public const array FALLBACK_PACKS = ['angular', 'nest', 'angular_ngrx', 'react', 'react_redux', 'roblox', 'qwik', 'vue', 'vue_vuex', 'bashly'];

    /** Material's `defaultPack`, used when no icon pack is configured at all. */
    public const string DEFAULT_PACK = 'angular';

    /** Form value of "no icon pack" (stored as '' in the config). */
    public const string NO_PACK = 'none';

    /**
     * @param  ?IconTheme  $theme  the Material Icon Theme (icon packs and association targets)
     */
    public function __construct(private readonly ?IconTheme $theme) {}

    /**
     * @return list<string>
     */
    public function packs(): array
    {
        $packs = $this->theme?->packs() ?? [];

        return $packs !== [] ? $packs : self::FALLBACK_PACKS;
    }

    /**
     * The icon pack a config or form value stands for, as a form value: a pack id, or 'none' for
     * '', 'none' and unknown packs (Material only enables pack icons for a known pack). Only a
     * missing or non-string value means Material's default pack.
     */
    public function iconPack(mixed $value): string
    {
        if (!is_string($value)) {
            return self::DEFAULT_PACK;
        }

        $pack = strtolower(trim($value));

        return in_array($pack, $this->packs(), true) ? $pack : self::NO_PACK;
    }

    /**
     * Form state from the current config.
     *
     * @param  array<mixed>  $config
     * @return array<string, mixed>
     */
    public function formData(array $config): array
    {
        $folderTheme = is_string($config['folder_theme'] ?? null) ? strtolower(trim($config['folder_theme'])) : 'specific';
        $rows = $this->associationRows($config);

        return [
            'default_theme' => ConfigOptions::defaultTheme($config),
            'allow_user_choice' => ConfigOptions::allowsUserChoice($config),
            'icon_pack' => $this->iconPack($config['icon_pack'] ?? null),
            'folder_theme' => in_array($folderTheme, self::FOLDER_THEMES, true) ? $folderTheme : 'specific',
            'mime_fallback' => (bool) ($config['mime_fallback'] ?? true),
            'game_server_extras' => (bool) ($config['game_server_extras'] ?? true),
            'file_associations' => $rows['file_associations'],
            'folder_associations' => $rows['folder_associations'],
        ];
    }

    /**
     * Number of custom file and folder icon entries in the config that the form cannot show, so
     * saving the form removes them: unknown icons, invalid patterns or folder names, non-string
     * values, the `.env`-only empty file value ("") and case-insensitive duplicates (the last
     * one wins, as at runtime, and is shown).
     *
     * @param  array<mixed>  $config
     */
    public function hiddenAssociations(array $config): int
    {
        return $this->associationRows($config)['hidden'];
    }

    /**
     * Repeater rows of the custom file and folder icons the form can show, in config order.
     *
     * @param  array<mixed>  $config
     * @return array{file_associations: list<array{pattern: string, icon: string}>, folder_associations: list<array{folder: string, icon: string}>, hidden: int}
     */
    public function associationRows(array $config): array
    {
        $hidden = 0;

        $files = [];
        foreach (is_array($config['file_associations'] ?? null) ? $config['file_associations'] : [] as $pattern => $icon) {
            $pattern = trim((string) $pattern);
            // Lower-cased but not trimmed, exactly as the runtime reads it.
            $icon = is_string($icon) ? strtolower($icon) : '';

            if (preg_match(self::PATTERN_REGEX, $pattern) !== 1 || !$this->isFileIcon($icon)) {
                $hidden++;

                continue;
            }

            $hidden += self::put($files, $pattern, ['pattern' => $pattern, 'icon' => $icon]);
        }

        $folders = [];
        foreach (is_array($config['folder_associations'] ?? null) ? $config['folder_associations'] : [] as $folder => $suffix) {
            $folder = trim((string) $folder);
            $icon = is_string($suffix) ? ($suffix === '' ? 'folder' : 'folder-' . strtolower($suffix)) : '';

            if (preg_match(self::FOLDER_REGEX, $folder) !== 1 || !$this->isFolderIcon($icon)) {
                $hidden++;

                continue;
            }

            $hidden += self::put($folders, $folder, ['folder' => $folder, 'icon' => $icon]);
        }

        return [
            'file_associations' => array_values($files),
            'folder_associations' => array_values($folders),
            'hidden' => $hidden,
        ];
    }

    /**
     * Validated .env values from the submitted form state.
     *
     * @param  array<mixed>  $data
     * @return array{values: array<string, string>, dropped: int}
     */
    public function envValues(array $data): array
    {
        $config = $this->config($data);

        return [
            'values' => [
                self::ENV_PREFIX . 'DEFAULT_THEME' => $config['default_theme'],
                self::ENV_PREFIX . 'ALLOW_USER_CHOICE' => $config['allow_user_choice'] ? 'true' : 'false',
                self::ENV_PREFIX . 'ICON_PACK' => $config['icon_pack'] === '' ? self::NO_PACK : $config['icon_pack'],
                self::ENV_PREFIX . 'FOLDER_THEME' => $config['folder_theme'],
                self::ENV_PREFIX . 'MIME_FALLBACK' => $config['mime_fallback'] ? 'true' : 'false',
                self::ENV_PREFIX . 'GAME_SERVER_EXTRAS' => $config['game_server_extras'] ? 'true' : 'false',
                self::ENV_PREFIX . 'FILE_ASSOCIATIONS' => self::json($config['file_associations']),
                self::ENV_PREFIX . 'FOLDER_ASSOCIATIONS' => self::json($config['folder_associations']),
            ],
            'dropped' => $config['dropped'],
        ];
    }

    /**
     * Config values (same shape as config/file-icons.php) from the form state, validated; used
     * for saving and for the live preview of unsaved settings. `dropped` counts the rows that
     * were left out (invalid, or replaced by a later row with the same pattern or folder name).
     *
     * @param  array<mixed>  $data
     * @return array{default_theme: string, allow_user_choice: bool, icon_pack: string, folder_theme: string, mime_fallback: bool, game_server_extras: bool, file_associations: array<string, string>, folder_associations: array<string, string>, dropped: int}
     */
    public function config(array $data): array
    {
        $dropped = 0;

        $iconPack = $this->iconPack($data['icon_pack'] ?? null);

        $folderTheme = is_string($data['folder_theme'] ?? null) ? strtolower(trim($data['folder_theme'])) : 'specific';
        if (!in_array($folderTheme, self::FOLDER_THEMES, true)) {
            $folderTheme = 'specific';
        }

        $fileAssociations = [];
        foreach (self::rows($data['file_associations'] ?? null) as $row) {
            $pattern = is_string($row['pattern'] ?? null) ? trim($row['pattern']) : '';
            $icon = is_string($row['icon'] ?? null) ? strtolower(trim($row['icon'])) : '';

            if (preg_match(self::PATTERN_REGEX, $pattern) !== 1 || !$this->isFileIcon($icon)) {
                $dropped++;

                continue;
            }

            $dropped += self::put($fileAssociations, $pattern, $icon);
        }

        $folderAssociations = [];
        foreach (self::rows($data['folder_associations'] ?? null) as $row) {
            $folder = is_string($row['folder'] ?? null) ? trim($row['folder']) : '';
            $icon = is_string($row['icon'] ?? null) ? strtolower(trim($row['icon'])) : '';

            if (preg_match(self::FOLDER_REGEX, $folder) !== 1 || !$this->isFolderIcon($icon)) {
                $dropped++;

                continue;
            }

            // Stored in Material syntax: 'folder-src' => 'src', plain 'folder' => ''.
            $dropped += self::put($folderAssociations, $folder, $icon === 'folder' ? '' : substr($icon, strlen('folder-')));
        }

        return [
            'default_theme' => ConfigOptions::choice($data['default_theme'] ?? null) ?? ConfigOptions::defaultTheme([]),
            'allow_user_choice' => self::truthy($data['allow_user_choice'] ?? true),
            'icon_pack' => $iconPack === self::NO_PACK ? '' : $iconPack,
            'folder_theme' => $folderTheme,
            'mime_fallback' => self::truthy($data['mime_fallback'] ?? true),
            'game_server_extras' => self::truthy($data['game_server_extras'] ?? true),
            'file_associations' => $fileAssociations,
            'folder_associations' => $folderAssociations,
            'dropped' => $dropped,
        ];
    }

    public function isFileIcon(string $icon): bool
    {
        if (preg_match(self::ICON_REGEX, $icon) !== 1) {
            return false;
        }

        return $this->theme === null || $this->theme->hasIcon($icon);
    }

    public function isFolderIcon(string $icon): bool
    {
        if ($icon !== 'folder' && !str_starts_with($icon, 'folder-')) {
            return false;
        }

        if ($this->theme === null) {
            return preg_match(self::ICON_REGEX, $icon) === 1;
        }

        return in_array($icon, $this->theme->folderIconNames(), true);
    }

    /**
     * Key under which two patterns or folder names are the same association: the runtime compares
     * them case-insensitively, and saving trims them.
     */
    public static function associationKey(string $value): string
    {
        return strtolower(trim($value));
    }

    /**
     * Adds an entry to a map of associations. An earlier entry with the same association key is
     * removed first, so the last one wins, at its own position, like at runtime.
     *
     * @template T
     *
     * @param  array<array-key, T>  $map
     * @param  T  $value
     * @return int 1 if an earlier entry was replaced, 0 otherwise
     */
    private static function put(array &$map, string $key, mixed $value): int
    {
        $replaced = 0;
        foreach (array_keys($map) as $existing) {
            if (self::associationKey((string) $existing) === self::associationKey($key)) {
                unset($map[$existing]);
                $replaced++;
            }
        }

        $map[$key] = $value;

        return $replaced;
    }

    /**
     * @return list<array<mixed>>
     */
    private static function rows(mixed $rows): array
    {
        if (!is_array($rows)) {
            return [];
        }

        return array_values(array_filter($rows, 'is_array'));
    }

    private static function truthy(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
    }

    /**
     * @param  array<array-key, string>  $map
     */
    private static function json(array $map): string
    {
        if ($map === []) {
            return '{}';
        }

        $json = json_encode($map, JSON_UNESCAPED_SLASHES | JSON_FORCE_OBJECT | JSON_THROW_ON_ERROR);

        // Defence in depth: the whitelists above make these impossible.
        if (str_contains($json, '\\') || str_contains($json, "'") || preg_match('/[\r\n#$`]/', $json) === 1) {
            return '{}';
        }

        return $json;
    }
}
