<?php

namespace LaGameTV\FileIcons\Icons;

/**
 * Curated associations for game-server files that VS Code would show with the generic file or
 * folder icon. They are applied like Material Icon Theme associations (files.associations /
 * folders.associations), with a lower priority than the associations configured by the admin.
 *
 * Every theme gets its own list that only uses icons of that theme; files that have no sensible
 * icon in a theme are left out.
 */
final class GameServerExtras
{
    /**
     * Material `files.associations` syntax ('*.ext' => icon id of the theme).
     *
     * @return array<string, string>
     */
    public static function fileAssociations(string $theme = Themes::MATERIAL): array
    {
        return match ($theme) {
            Themes::MATERIAL => [
                // Minecraft: NBT data, structures/schematics, Skript
                '*.nbt' => 'minecraft',
                '*.snbt' => 'minecraft',
                '*.schem' => 'minecraft',
                '*.schematic' => 'minecraft',
                '*.litematic' => 'minecraft',
                '*.sk' => 'minecraft',
                // Minecraft level.dat backups
                '*.dat_old' => 'hex',
                // PHP archives (e.g. PocketMine-MP)
                '*.phar' => 'php',
                // SourceMod / AMX Mod X
                '*.sp' => 'pawn',
                '*.sma' => 'pawn',
                '*.smx' => 'pawn',
                '*.amxx' => 'pawn',
                // Valve KeyValues / Steam app manifests
                '*.vdf' => 'settings',
                '*.acf' => 'settings',
                // Game content packages
                '*.vpk' => 'zip',
                '*.pak' => 'zip',
                // systemd units
                '*.service' => 'systemd',
                '*.socket' => 'systemd',
                '*.timer' => 'systemd',
                '*.target' => 'systemd',
                '*.mount' => 'systemd',
            ],
            Themes::DATAPACK => [
                // Minecraft: text NBT, level.dat backups and region files (NBT chunks)
                '*.snbt' => 'nbt_file',
                '*.dat_old' => 'nbt_file',
                '*.mca' => 'nbt_file',
                '*.mcr' => 'nbt_file',
                // Structures and schematics
                '*.schem' => 'structure_file',
                '*.schematic' => 'structure_file',
                '*.litematic' => 'structure_file',
                // PHP archives (e.g. PocketMine-MP)
                '*.phar' => 'php_file',
                // Valve KeyValues, Steam app manifests, Valve packages, SourceMod / AMX Mod X plugins
                '*.vdf' => 'valve_file',
                '*.acf' => 'valve_file',
                '*.vpk' => 'valve_file',
                '*.sp' => 'valve_file',
                '*.smx' => 'valve_file',
                '*.sma' => 'valve_file',
                '*.amxx' => 'valve_file',
                // systemd units
                '*.service' => 'config_file',
                '*.socket' => 'config_file',
                '*.timer' => 'config_file',
                '*.target' => 'config_file',
                '*.mount' => 'config_file',
            ],
            default => [],
        };
    }

    /**
     * Folder associations ('name' => icon). For the Material Icon Theme the value uses Material's
     * `folders.associations` syntax (an icon suffix, i.e. 'folder-' . suffix); themes without an
     * association syntax of their own (Datapack Icons) use the full icon id.
     *
     * @return array<string, string>
     */
    public static function folderAssociations(string $theme = Themes::MATERIAL): array
    {
        return match ($theme) {
            Themes::MATERIAL => [
                'crash-reports' => 'log',
                'resourcepacks' => 'resource',
                'datapacks' => 'resource',
                'defaultconfigs' => 'config',
                'serverconfig' => 'config',
                'kubejs' => 'scripts',
            ],
            Themes::DATAPACK => [
                'crash-reports' => 'log_folder',
                'resourcepacks' => 'assets_folder_closed',
                'defaultconfigs' => 'config_folder',
                'serverconfig' => 'config_folder',
                'kubejs' => 'javascript_folder',
                'world_nether' => 'worldgen_folder',
                'world_the_end' => 'worldgen_folder',
                'libraries' => 'jar_folder',
            ],
            default => [],
        };
    }
}
