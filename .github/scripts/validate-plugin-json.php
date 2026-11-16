<?php

/**
 * Validates plugin.json the way the official pelican-dev/plugins CI does (valid JSON, no "meta" block)
 * and adds a few checks for this plugin. Usage: php .github/scripts/validate-plugin-json.php
 */
$root = dirname(__DIR__, 2);
$file = $root . '/plugin.json';
$errors = [];

$keyOrder = [
    'id', 'name', 'author', 'version', 'description', 'category', 'url', 'update_url',
    'namespace', 'class', 'panels', 'panel_version', 'api_version', 'composer_packages',
];
$required = ['id', 'name', 'author', 'version', 'category', 'namespace', 'class', 'api_version'];

$content = @file_get_contents($file);

if ($content === false) {
    fwrite(STDERR, "plugin.json not found at $file\n");
    exit(1);
}

if (str_starts_with($content, "\xEF\xBB\xBF")) {
    $errors[] = 'plugin.json starts with a UTF-8 BOM.';
}

try {
    $json = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $exception) {
    fwrite(STDERR, 'Invalid JSON in plugin.json: ' . $exception->getMessage() . "\n");
    exit(1);
}

if (!is_array($json) || array_is_list($json)) {
    fwrite(STDERR, "plugin.json must contain a JSON object.\n");
    exit(1);
}

if (array_key_exists('meta', $json)) {
    $errors[] = "plugin.json contains a 'meta' key (written by the panel on install). Please remove it.";
}

foreach ($required as $key) {
    if (!array_key_exists($key, $json)) {
        $errors[] = "Missing required key '$key'.";
    }
}

$unknown = array_diff(array_keys($json), $keyOrder, ['meta']);

if ($unknown !== []) {
    $errors[] = 'Unknown key(s): ' . implode(', ', $unknown) . '.';
}

$present = array_values(array_intersect(array_keys($json), $keyOrder));
$expected = array_values(array_intersect($keyOrder, $present));

if ($present !== $expected) {
    $errors[] = 'Keys are not in the canonical order: ' . implode(', ', $keyOrder) . '.';
}

if (($json['id'] ?? null) !== 'file-icons') {
    $errors[] = "'id' must be 'file-icons' (it must equal the plugin folder name).";
}

if (!is_string($json['version'] ?? null) || !preg_match('/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/', $json['version'])) {
    $errors[] = "'version' must be a SemVer string like 1.2.3.";
}

if (!in_array($json['category'] ?? null, ['plugin', 'theme', 'language'], true)) {
    $errors[] = "'category' must be one of plugin, theme, language.";
}

if (!is_int($json['api_version'] ?? null) || $json['api_version'] < 1) {
    $errors[] = "'api_version' must be a positive integer.";
}

foreach (['url', 'update_url'] as $key) {
    $value = $json[$key] ?? null;

    if ($value !== null && (!is_string($value) || !str_starts_with($value, 'https://')
        || filter_var($value, FILTER_VALIDATE_URL) === false)) {
        $errors[] = "'$key' must be null or an https:// URL.";
    }
}

$panels = $json['panels'] ?? null;

if ($panels !== null && (!is_array($panels) || !array_is_list($panels) || $panels === []
    || array_filter($panels, static fn (mixed $panel): bool => !is_string($panel) || $panel === '') !== [])) {
    $errors[] = "'panels' must be null or a non-empty list of panel ids.";
}

if (is_string($json['class'] ?? null) && !is_file($root . '/src/' . $json['class'] . '.php')) {
    $errors[] = "Main class file src/{$json['class']}.php does not exist.";
}

$changelog = @file_get_contents($root . '/CHANGELOG.md');

if ($changelog !== false && is_string($json['version'] ?? null)
    && !str_contains($changelog, '## [' . $json['version'] . ']')) {
    $errors[] = "CHANGELOG.md has no '## [{$json['version']}]' section.";
}

if ($errors !== []) {
    echo "plugin.json is invalid:\n";

    foreach ($errors as $error) {
        echo "  - $error\n";
    }

    exit(1);
}

echo "plugin.json is valid.\n";
