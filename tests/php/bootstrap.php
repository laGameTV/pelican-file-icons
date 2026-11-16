<?php

/*
 * Shared bootstrap for the plain-PHP test scripts: a tiny PSR-4 autoloader for
 * LaGameTV\FileIcons\ => src/ (the tests only use the pure-PHP classes in
 * src/Icons and the Laravel-free helpers such as MinecraftDetector) and the
 * paths of the generated data. No Composer, no Laravel.
 */

error_reporting(E_ALL);
ini_set('display_errors', 'stderr');
ini_set('memory_limit', '-1');

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

const MIT_TEST_ROOT = __DIR__ . '/../..';
const MIT_TEST_DATA_DIR = MIT_TEST_ROOT . '/resources/data';
const MIT_TEST_ICON_ROOT = MIT_TEST_ROOT . '/resources/icons';
/** Theme ids (SPEC2 §2), in Themes::all() order. */
const MIT_TEST_THEMES = ['material', 'datapack'];

spl_autoload_register(static function (string $class): void {
    $prefix = 'LaGameTV\\FileIcons\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = MIT_TEST_ROOT . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

/** Directory with the SVGs of a theme (resources/icons/<theme>). */
function mit_icon_dir(string $theme): string
{
    return MIT_TEST_ICON_ROOT . '/' . $theme;
}

/** Validated theme id from user input ('material' if absent). */
function mit_theme_arg(mixed $value): string
{
    if ($value === null || $value === '') {
        return 'material';
    }
    if (!is_string($value) || !in_array($value, MIT_TEST_THEMES, true)) {
        throw new InvalidArgumentException('unknown theme ' . var_export($value, true));
    }

    return $value;
}

/**
 * @return array<mixed>
 */
function mit_read_stdin_json(): array
{
    $raw = stream_get_contents(STDIN);
    if ($raw === false || $raw === '') {
        return [];
    }

    $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

    return is_array($data) ? $data : [];
}

function mit_write_json(mixed $value): void
{
    fwrite(STDOUT, json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n");
}
