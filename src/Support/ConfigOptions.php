<?php

namespace LaGameTV\FileIcons\Support;

use LaGameTV\FileIcons\Icons\IconThemeOptions;
use LaGameTV\FileIcons\Icons\Themes;

/**
 * Maps the `file-icons` config (config/file-icons.php) to theme options. Pure PHP.
 */
final class ConfigOptions
{
    /** Theme choice that picks Datapack Icons on Minecraft servers and the Material Icon Theme elsewhere. */
    public const string AUTO = 'auto';

    public const array DELIVERY_MODES = ['inline', 'route'];

    /**
     * Options of the Material Icon Theme (all admin settings).
     *
     * @param  array<mixed>  $config
     */
    public static function fromConfig(array $config): IconThemeOptions
    {
        $iconPack = $config['icon_pack'] ?? null;
        if (is_string($iconPack)) {
            $iconPack = strtolower(trim($iconPack));
            $iconPack = $iconPack === 'none' ? '' : $iconPack;
        }

        return IconThemeOptions::fromArray([
            'iconPack' => is_string($iconPack) ? $iconPack : null,
            'folderTheme' => $config['folder_theme'] ?? null,
            'fileAssociations' => $config['file_associations'] ?? null,
            'folderAssociations' => $config['folder_associations'] ?? null,
            'gameServerExtras' => $config['game_server_extras'] ?? null,
            'mimeFallback' => $config['mime_fallback'] ?? null,
        ]);
    }

    /**
     * Options of a theme. Icon packs and custom file/folder associations are Material Icon Theme
     * features, so the other themes only share the folder theme, the MIME fallback and the extras.
     *
     * @param  array<mixed>  $config
     */
    public static function forTheme(array $config, string $theme): IconThemeOptions
    {
        $options = self::fromConfig($config);

        if ($theme === Themes::MATERIAL) {
            return $options;
        }

        return new IconThemeOptions(
            iconPack: '',
            folderTheme: $options->folderTheme,
            fileAssociations: [],
            folderAssociations: [],
            gameServerExtras: $options->gameServerExtras,
            mimeFallback: $options->mimeFallback,
        );
    }

    /**
     * The admin's default theme choice: a theme id or 'auto'.
     *
     * @param  array<mixed>  $config
     */
    public static function defaultTheme(array $config): string
    {
        return self::choice($config['default_theme'] ?? null) ?? Themes::MATERIAL;
    }

    /**
     * @param  array<mixed>  $config
     */
    public static function allowsUserChoice(array $config): bool
    {
        $value = $config['allow_user_choice'] ?? true;

        if (is_bool($value)) {
            return $value;
        }

        return is_scalar($value) ? (filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true) : true;
    }

    /**
     * A valid theme choice (theme id or 'auto'), null otherwise.
     */
    public static function choice(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $value = strtolower(trim($value));

        return $value === self::AUTO || Themes::isValid($value) ? $value : null;
    }

    /**
     * @return list<string> theme ids and 'auto'
     */
    public static function choices(): array
    {
        return [...Themes::all(), self::AUTO];
    }

    /**
     * @param  array<mixed>  $config
     */
    public static function delivery(array $config): string
    {
        $delivery = $config['delivery'] ?? 'inline';
        $delivery = is_string($delivery) ? strtolower(trim($delivery)) : 'inline';

        return in_array($delivery, self::DELIVERY_MODES, true) ? $delivery : 'inline';
    }
}
