<?php

// Wrapped in a closure: the panel `require`s this file inside a method, so no variables may leak.
return (static function (): array {
    $associations = static function (mixed $value): array {
        if (is_array($value)) {
            return $value;
        }

        $decoded = is_string($value) ? json_decode($value, true) : null;

        return is_array($decoded) ? $decoded : [];
    };

    $boolean = static fn (mixed $value, bool $default): bool => is_bool($value)
        ? $value
        : (filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default);

    $defaultTheme = strtolower(trim((string) env('FILE_ICONS_DEFAULT_THEME', 'material')));

    // Material Icon Theme `availableIconPacks` (tests/php/unit.php checks this list against the generated data)
    $iconPacks = ['angular', 'nest', 'angular_ngrx', 'react', 'react_redux', 'roblox', 'qwik', 'vue', 'vue_vuex', 'bashly'];

    $iconPack = strtolower(trim((string) env('FILE_ICONS_ICON_PACK', 'angular')));

    $delivery = strtolower(trim((string) env('FILE_ICONS_DELIVERY', 'inline')));

    return [
        // Icon theme for everyone who has not chosen one: material (Material Icon Theme), datapack (Datapack Icons)
        // or auto (Datapack Icons on Minecraft servers, Material Icon Theme everywhere else)
        'default_theme' => in_array($defaultTheme, ['material', 'datapack', 'auto'], true) ? $defaultTheme : 'material',

        // Let users pick their own icon theme on their profile page ("File icons" tab)
        'allow_user_choice' => $boolean(env('FILE_ICONS_ALLOW_USER_CHOICE', true), true),

        // Folder icons (all themes): specific, classic (one generic folder icon) or none (= keep the panel's folder icons)
        'folder_theme' => strtolower(trim((string) env('FILE_ICONS_FOLDER_THEME', 'specific'))),

        // Use the MIME type reported by Wings when the name only resolves to the generic file icon (all themes)
        'mime_fallback' => $boolean(env('FILE_ICONS_MIME_FALLBACK', true), true),

        // Curated associations for game-server files (Minecraft, SourceMod, Valve, systemd, ...) (all themes)
        'game_server_extras' => $boolean(env('FILE_ICONS_GAME_SERVER_EXTRAS', true), true),

        // Material Icon Theme `activeIconPack` ("framework icons"): angular, nest, angular_ngrx, react, react_redux,
        // roblox, qwik, vue, vue_vuex, bashly or none ('' = none; an unknown pack also means none, as in Material)
        'icon_pack' => in_array($iconPack, $iconPacks, true) ? $iconPack : '',

        // Material Icon Theme `files.associations` as a JSON object, e.g. {"*.sk":"minecraft","**.md":"markdown","start.sh":"console"}
        'file_associations' => $associations(env('FILE_ICONS_FILE_ASSOCIATIONS', '{}')),

        // Material Icon Theme `folders.associations` as a JSON object, e.g. {"world":"resource","backups":"archive"}
        'folder_associations' => $associations(env('FILE_ICONS_FOLDER_ASSOCIATIONS', '{}')),

        // Icon delivery: inline (data URIs in the page, no extra requests) or route (one cached request per icon)
        'delivery' => in_array($delivery, ['inline', 'route'], true) ? $delivery : 'inline',
    ];
})();
