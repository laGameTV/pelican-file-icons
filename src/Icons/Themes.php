<?php

namespace LaGameTV\FileIcons\Icons;

/**
 * Ids of the bundled icon themes (= data file `resources/data/<id>.php` and icon directory
 * `resources/icons/<id>/`).
 */
final class Themes
{
    /** VS Code "Material Icon Theme" (PKief/vscode-material-icon-theme). */
    public const string MATERIAL = 'material';

    /** VS Code "Datapack Icons" (FuncFusion/mc-dp-icons), pixel-art Minecraft icons. */
    public const string DATAPACK = 'datapack';

    /**
     * @return list<string>
     */
    public static function all(): array
    {
        return [self::MATERIAL, self::DATAPACK];
    }

    public static function isValid(mixed $theme): bool
    {
        return is_string($theme) && in_array($theme, self::all(), true);
    }
}
