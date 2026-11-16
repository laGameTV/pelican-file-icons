<?php

/*
 * Batch resolver used by tests/parity.ts (SPEC §7, SPEC2 §5).
 *
 * stdin:  {"theme": "material"|"datapack" (optional, default material),
 *          "options": {IconThemeOptions::fromArray keys},
 *          "cases": [{"kind": "file"|"folder", "name": "...", "directory": "/..."|null, "mime": null|"..."}]}
 * stdout: JSON array, one entry per case: {"icon", "lightIcon", "source"} | null | {"error": "..."}
 */

use LaGameTV\FileIcons\Icons\IconResolver;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\IconThemeOptions;

require __DIR__ . '/bootstrap.php';

$input = mit_read_stdin_json();
$themeId = mit_theme_arg($input['theme'] ?? null);
$options = IconThemeOptions::fromArray(is_array($input['options'] ?? null) ? $input['options'] : []);
$theme = IconTheme::load(MIT_TEST_DATA_DIR, $options, $themeId);
if ($theme->id() !== $themeId) {
    throw new RuntimeException("IconTheme::load(..., '$themeId')->id() returned '{$theme->id()}'");
}
$resolver = new IconResolver($theme);

$out = [];
foreach ($input['cases'] ?? [] as $case) {
    try {
        $name = (string) $case['name'];
        $directory = isset($case['directory']) ? (string) $case['directory'] : null;
        $mime = isset($case['mime']) ? (string) $case['mime'] : null;

        $resolved = ($case['kind'] ?? 'file') === 'folder'
            ? $resolver->forFolder($name, $directory)
            : $resolver->forFile($name, $directory, $mime);

        $out[] = $resolved === null ? null : [
            'icon' => $resolved->icon,
            'lightIcon' => $resolved->lightIcon,
            'source' => $resolved->source,
        ];
    } catch (Throwable $e) {
        $out[] = ['error' => get_class($e) . ': ' . $e->getMessage()];
    }
}

mit_write_json($out);
