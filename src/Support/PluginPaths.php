<?php

namespace LaGameTV\FileIcons\Support;

final class PluginPaths
{
    public const string PLUGIN_ID = 'file-icons';

    public static function path(string ...$paths): string
    {
        if (function_exists('plugin_path')) {
            return plugin_path(self::PLUGIN_ID, ...$paths);
        }

        $base = dirname(__DIR__, 2);

        return $paths === [] ? $base : $base . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $paths);
    }

    public static function data(): string
    {
        return self::path('resources', 'data');
    }

    public static function icons(string $theme): string
    {
        return self::path('resources', 'icons', $theme);
    }

    /**
     * Callers must have validated both ids (IconTheme::hasIcon(), Themes::isValid()).
     */
    public static function icon(string $theme, string $icon): string
    {
        return self::path('resources', 'icons', $theme, $icon . '.svg');
    }
}
