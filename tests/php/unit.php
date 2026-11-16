<?php

/*
 * Plain-PHP unit checks for src/Icons + resources/data (SPEC §7, SPEC2 §5), the settings
 * conversion (src/Settings/SettingsData) and config/file-icons.php (with a stand-in env()).
 * Run: php tests/php/unit.php   (exit code 1 on any failure)
 */

use LaGameTV\FileIcons\Icons\GameServerExtras;
use LaGameTV\FileIcons\Icons\IconResolver;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\IconThemeOptions;
use LaGameTV\FileIcons\Icons\MimeTypeIcons;
use LaGameTV\FileIcons\Icons\ResolvedIcon;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Settings\SettingsData;
use LaGameTV\FileIcons\Support\ConfigOptions;

require __DIR__ . '/bootstrap.php';

$GLOBALS['mit_passed'] = 0;
$GLOBALS['mit_failures'] = [];
$verbose = in_array('--verbose', $argv, true);

function fail_(string $label, string $detail): void
{
    $GLOBALS['mit_failures'][] = $label . ($detail !== '' ? ': ' . $detail : '');
}

function ok(string $label, bool $condition, string $detail = ''): void
{
    if ($condition) {
        $GLOBALS['mit_passed']++;
    } else {
        fail_($label, $detail);
    }
}

function same(string $label, mixed $actual, mixed $expected): void
{
    if ($actual === $expected) {
        $GLOBALS['mit_passed']++;
    } else {
        fail_($label, 'expected ' . export($expected) . ', got ' . export($actual));
    }
}

function export(mixed $v): string
{
    if ($v instanceof ResolvedIcon) {
        return 'ResolvedIcon(' . $v->icon . ', ' . var_export($v->lightIcon, true) . ', ' . $v->source . ')';
    }

    return str_replace("\n", ' ', var_export($v, true));
}

/** @param callable(): void $fn */
function section(string $name, callable $fn): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        fail_($name, 'threw ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
    }
}

/** @param callable(): mixed $fn */
function throws(string $label, callable $fn): void
{
    try {
        $fn();
        fail_($label, 'expected an exception, nothing was thrown');
    } catch (Throwable) {
        $GLOBALS['mit_passed']++;
    }
}

/** @param array<string,mixed> $options */
function resolver(array $options = [], string $theme = 'material'): IconResolver
{
    return new IconResolver(IconTheme::load(MIT_TEST_DATA_DIR, IconThemeOptions::fromArray($options), $theme));
}

/** [icon, lightIcon, source] */
function triple(?ResolvedIcon $r): ?array
{
    return $r === null ? null : [$r->icon, $r->lightIcon, $r->source];
}

/** Class of the pure Minecraft egg detector (SPEC2 §3 allows src/Icons or src/Support). */
function detector_class(): ?string
{
    foreach (['LaGameTV\\FileIcons\\Icons\\MinecraftDetector', 'LaGameTV\\FileIcons\\Support\\MinecraftDetector'] as $class) {
        if (class_exists($class)) {
            return $class;
        }
    }

    return null;
}

$GLOBALS['mit_env'] = [];

if (!function_exists('env')) {
    /** Stand-in for Laravel's env(), so config/file-icons.php can be loaded: values of $GLOBALS['mit_env']. */
    function env(string $key, mixed $default = null): mixed
    {
        return array_key_exists($key, $GLOBALS['mit_env']) ? $GLOBALS['mit_env'][$key] : $default;
    }
}

/**
 * config/file-icons.php evaluated with these environment variables.
 *
 * @param  array<string, string>  $env
 * @return array<mixed>
 */
function plugin_config(array $env): array
{
    $GLOBALS['mit_env'] = $env;
    try {
        return require MIT_TEST_ROOT . '/config/file-icons.php';
    } finally {
        $GLOBALS['mit_env'] = [];
    }
}

/**
 * The Material Icon Theme the panel builds from a plugin config.
 *
 * @param  array<mixed>  $config
 */
function material_from_config(array $config): IconTheme
{
    return IconTheme::load(MIT_TEST_DATA_DIR, ConfigOptions::forTheme($config, Themes::MATERIAL));
}

/** @var array<string, array<mixed>> $data theme => data file */
$data = [];
/** @var array<string, array<string, int>> $icons theme => icons map */
$icons = [];
foreach (MIT_TEST_THEMES as $themeId) {
    $data[$themeId] = require MIT_TEST_DATA_DIR . "/$themeId.php";
    $icons[$themeId] = is_array($data[$themeId]['icons'] ?? null) ? $data[$themeId]['icons'] : [];
}
$manifest = $data['material'];
$languages = require MIT_TEST_DATA_DIR . '/languages.php';

const SECTIONS = ['fileExtensions', 'fileExtensionsByParent', 'fileNames', 'fileNamesByParent', 'folderNames', 'folderNamesByParent', 'languageIds'];

/** @return list<string> */
function sorted_keys(array $a): array
{
    $k = array_map('strval', array_keys($a));
    sort($k);

    return $k;
}

// ---------------------------------------------------------------------------
section('data: material.php shape', function () use ($manifest, $icons): void {
    same('material format', $manifest['format'] ?? null, 1);
    same('material theme', $manifest['theme'] ?? null, 'material');
    same('material source key', $manifest['material'] ?? null, ['package' => 'material-icon-theme', 'version' => '5.40.0']);
    if (array_key_exists('source', $manifest)) {
        same('material source (optional)', $manifest['source'], ['package' => 'material-icon-theme', 'version' => '5.40.0']);
    }
    ok('material hash is 12 hex', is_string($manifest['hash'] ?? null) && preg_match('/^[0-9a-f]{12}$/', $manifest['hash']) === 1, export($manifest['hash'] ?? null));
    same('material defaults', $manifest['defaults'] ?? null, ['file' => 'file', 'folder' => 'folder']);
    same('material defaultPack', $manifest['defaultPack'] ?? null, 'angular');
    same('material packs', $manifest['packs'] ?? null, ['angular', 'nest', 'angular_ngrx', 'react', 'react_redux', 'roblox', 'qwik', 'vue', 'vue_vuex', 'bashly']);
    ok('material icons non-empty', count($icons['material']) > 500, (string) count($icons['material']));
    same('material base has all sub-arrays', sorted_keys($manifest['base'] ?? []), SECTIONS);
    $packs = $manifest['packs'] ?? [];
    sort($packs);
    same('material packOverrides keys', sorted_keys($manifest['packOverrides'] ?? []), $packs);
    foreach ($manifest['packOverrides'] ?? [] as $pack => $section) {
        same("material packOverrides[$pack] has all sub-arrays", sorted_keys($section), SECTIONS);
    }
    ok('old manifest.php is gone', !is_file(MIT_TEST_DATA_DIR . '/manifest.php'));
});

section('data: datapack.php shape', function () use ($data, $icons): void {
    $d = $data['datapack'];
    same('datapack format', $d['format'] ?? null, 1);
    same('datapack theme', $d['theme'] ?? null, 'datapack');
    same('datapack source', $d['source'] ?? null, ['package' => 'mc-dp-icons', 'version' => '5.0.0']);
    ok('datapack hash is 12 hex', is_string($d['hash'] ?? null) && preg_match('/^[0-9a-f]{12}$/', $d['hash']) === 1, export($d['hash'] ?? null));
    ok('theme hashes differ', ($d['hash'] ?? null) !== ($data['material']['hash'] ?? null));
    same('datapack defaults', $d['defaults'] ?? null, ['file' => 'generic_file', 'folder' => 'generic_folder_closed']);
    same('datapack defaultPack', $d['defaultPack'] ?? null, '');
    same('datapack packs', $d['packs'] ?? null, []);
    same('datapack packOverrides', $d['packOverrides'] ?? null, []);
    same('datapack base has all sub-arrays', sorted_keys($d['base'] ?? []), SECTIONS);
    same('datapack has no language ids', $d['base']['languageIds'] ?? null, []);
    ok('datapack icons (~300)', count($icons['datapack']) > 250 && count($icons['datapack']) < 400, (string) count($icons['datapack']));
    ok('datapack has parent-qualified extensions', isset($d['base']['fileExtensionsByParent']['advancement']['json']));
    same('datapack render_controllers/render_controllers.json', $d['base']['fileExtensionsByParent']['render_controllers']['render_controllers.json'] ?? null, 'render_controllers_file');
    same('datapack function/load.json', $d['base']['fileNamesByParent']['function']['load.json'] ?? null, 'load.json_file');
    same('datapack CHANGELOG lowercased', $d['base']['fileNames']['changelog'] ?? null, 'timeline_file');
    same('datapack closed folder from folderNamesExpanded', $d['base']['folderNames']['advancement'] ?? null, 'advancement_folder');
    same('datapack closed folder entry wins', $d['base']['folderNames']['data'] ?? null, 'data_folder_closed');
    same('datapack buildSrc lowercased', $d['base']['folderNames']['buildsrc'] ?? null, 'gradle_folder');
    ok('datapack does not ship the expanded default folder', !isset($icons['datapack']['generic_folder']));
});

section('data: icons <-> svg files', function () use ($icons): void {
    foreach (MIT_TEST_THEMES as $theme) {
        $dir = mit_icon_dir($theme);
        $badIds = [];
        $missing = [];
        $notSvg = [];
        foreach ($icons[$theme] as $id => $one) {
            $id = (string) $id;
            if (preg_match('/^[a-z0-9][a-z0-9_.-]*$/', $id) !== 1 || str_contains($id, '/') || str_contains($id, '..')) {
                $badIds[] = $id;
            }
            $file = "$dir/$id.svg";
            if (!is_file($file)) {
                $missing[] = $id;
            } elseif (!str_contains((string) file_get_contents($file, false, null, 0, 4096), '<svg')) {
                $notSvg[] = $id;
            }
            if ($one !== 1) {
                $badIds[] = "$id(value)";
            }
        }
        same("$theme: icon ids are valid", $badIds, []);
        same("$theme: every icon has an svg in resources/icons/$theme", array_slice($missing, 0, 10), []);
        same("$theme: every svg file contains <svg", array_slice($notSvg, 0, 10), []);
        $stale = [];
        foreach (glob("$dir/*") ?: [] as $f) {
            if (!str_ends_with($f, '.svg') || !isset($icons[$theme][basename($f, '.svg')])) {
                $stale[] = basename($f);
            }
        }
        same("$theme: no stale files", array_slice($stale, 0, 10), []);
    }
    same('no svg files left in resources/icons/', array_map('basename', glob(MIT_TEST_ICON_ROOT . '/*.svg') ?: []), []);
    $m = $icons['material'];
    $open = array_values(array_filter(array_keys($m), static fn ($id) => preg_match('/-open(_light)?$/', (string) $id) === 1));
    same('material: no expanded-folder icons shipped', array_slice($open, 0, 10), []);
    foreach (['file', 'folder', 'folder-root', 'toml', 'toml_light', 'folder-cursor_light', 'minecraft', 'pawn', 'systemd', 'hex', 'zip', 'settings', 'php', 'console'] as $id) {
        ok("material icon $id shipped", isset($m[$id]));
    }
    $dp = $icons['datapack'];
    foreach (['generic_file', 'generic_folder_closed', 'pack.mcmeta_file', 'advancement_folder', 'data_folder_closed', 'nbt_file', 'structure_file', 'json_file'] as $id) {
        ok("datapack icon $id shipped", isset($dp[$id]));
    }
    $light = array_values(array_filter(array_keys($dp), static fn ($id) => str_ends_with((string) $id, '_light')));
    same('datapack: no light icons', $light, []);
});

section('data: every referenced icon exists', function () use ($data, $icons): void {
    foreach (MIT_TEST_THEMES as $theme) {
        $d = $data[$theme];
        $known = $icons[$theme];
        $missing = [];
        $walk = static function (array $section, string $where) use (&$missing, $known): void {
            foreach ($section as $table => $map) {
                foreach ($map as $key => $value) {
                    if (is_array($value)) {
                        foreach ($value as $k2 => $v2) {
                            if ($v2 !== null && !isset($known[$v2])) {
                                $missing[] = "$where.$table.$key/$k2=$v2";
                            }
                        }
                    } elseif ($value !== null && !isset($known[$value])) {
                        $missing[] = "$where.$table.$key=$value";
                    }
                }
            }
        };
        $walk($d['base'], 'base');
        foreach ($d['packOverrides'] as $pack => $section) {
            $walk($section, "packOverrides.$pack");
        }
        foreach ($d['defaults'] as $k => $v) {
            if (!isset($known[$v])) {
                $missing[] = "defaults.$k=$v";
            }
        }
        same("$theme: referenced icons are shipped", array_slice($missing, 0, 10), []);
    }
});

section('data: key normalisation', function () use ($data): void {
    foreach (MIT_TEST_THEMES as $theme) {
        $d = $data[$theme];
        $bad = [];
        foreach (['base' => $d['base']] + $d['packOverrides'] as $where => $section) {
            foreach (['fileNames', 'fileExtensions', 'folderNames'] as $table) {
                foreach ($section[$table] as $key => $_) {
                    $key = (string) $key;
                    if ($key !== mb_strtolower($key)) {
                        $bad[] = "$where.$table: '$key' not lowercase";
                    }
                    if (str_contains($key, '/')) {
                        $bad[] = "$where.$table: '$key' contains '/'";
                    }
                }
            }
            foreach (['fileNamesByParent', 'fileExtensionsByParent', 'folderNamesByParent'] as $table) {
                foreach ($section[$table] as $parent => $map) {
                    $parent = (string) $parent;
                    if ($parent !== mb_strtolower($parent) || str_contains($parent, '/')) {
                        $bad[] = "$where.$table: bad parent '$parent'";
                    }
                    foreach ($map as $key => $_) {
                        $key = (string) $key;
                        if ($key !== mb_strtolower($key) || str_contains($key, '/')) {
                            $bad[] = "$where.$table: bad key '$parent/$key'";
                        }
                    }
                }
            }
        }
        same("$theme: keys lowercase and slash-free", array_slice($bad, 0, 10), []);
    }
    $m = $data['material']['base'];
    ok('languageIds keep case (testOutput)', isset($m['languageIds']['testOutput']));
    ok('languageIds has jsonc', isset($m['languageIds']['jsonc']));
    ok('fileNamesByParent has .config', isset($m['fileNamesByParent']['.config']['postcssrc.json']));
    ok('folderNamesByParent has .github/workflows', isset($m['folderNamesByParent']['.github']['workflows']));
});

section('data: languages.php', function () use ($languages): void {
    same('languages format', $languages['format'] ?? null, 1);
    same('languages vscode', $languages['vscode'] ?? null, ['tag' => '1.146.0', 'commit' => '69047191fc427f2f92828279aae1d90d8eeda7ab']);
    ok('languages filenames non-empty', count($languages['filenames'] ?? []) > 50);
    ok('languages extensions non-empty', count($languages['extensions'] ?? []) > 300);
    same('languages pattern count', count($languages['patterns'] ?? []), 25);
    $bad = [];
    foreach ($languages['patterns'] ?? [] as $i => $p) {
        if (!is_array($p) || array_keys($p) !== ['glob', 'regex', 'onPath', 'id']) {
            $bad[] = "#$i shape";

            continue;
        }
        if (@preg_match($p['regex'], '') === false) {
            $bad[] = "#$i regex does not compile: {$p['regex']}";
        }
        if ($p['onPath'] !== str_contains($p['glob'], '/')) {
            $bad[] = "#$i onPath";
        }
    }
    same('language patterns valid', $bad, []);
    foreach (['filenames', 'extensions'] as $t) {
        foreach ($languages[$t] ?? [] as $k => $v) {
            if ((string) $k !== mb_strtolower((string) $k) || !is_string($v)) {
                $bad[] = "$t.$k";
            }
        }
    }
    same('language keys lowercase', $bad, []);
    same('language .txt', $languages['extensions']['.txt'] ?? null, 'plaintext');
    same('language makefile', $languages['filenames']['makefile'] ?? null, 'makefile');
});

// ---------------------------------------------------------------------------
section('Themes', function (): void {
    same('Themes::MATERIAL', Themes::MATERIAL, 'material');
    same('Themes::DATAPACK', Themes::DATAPACK, 'datapack');
    same('Themes::all()', Themes::all(), ['material', 'datapack']);
    same('Themes::all() = data files', Themes::all(), MIT_TEST_THEMES);
});

section('MinecraftDetector', function (): void {
    $class = detector_class();
    ok('MinecraftDetector exists (src/Icons or src/Support)', $class !== null);
    if ($class === null) {
        return;
    }
    $m = static fn (string $name, array $tags = [], array $features = []): bool => $class::matches($name, $tags, $features);
    foreach ([
        'Vanilla Minecraft', 'Minecraft: Java Edition', 'MINECRAFT', 'Paper', 'Purpur', 'Spigot', 'Bukkit', 'Folia', 'Forge Enhanced', 'NeoForge',
        'Fabric', 'Quilt', 'SpongeVanilla (Sponge)', 'Sponge', 'Velocity', 'BungeeCord', 'Bungee Cord', 'Waterfall', 'Nukkit', 'PocketMine-MP',
        'Bedrock', 'Minecraft Bedrock Edition', 'Paper (1.21)', 'Modded: Forge', 'paper-mc',
        // official pelican-eggs names; the PTDL versions of these eggs have no tags and no features
        'PocketmineMP', 'PowerNukkitX', 'PowerNukkit', 'NukkitX', 'Cloudburst Nukkit', 'Vanilla Bedrock ARM64', 'Purpur-Geyser-Floodgate',
    ] as $name) {
        same("egg name '$name' => minecraft", $m($name), true);
    }
    foreach ([
        'Terraria', 'Rust', 'Valheim', 'Counter-Strike 2', "Garry's Mod", 'ARK: Survival Evolved', 'Factorio', 'Palworld', 'Satisfactory',
        'Forgejo', 'Paperless-ngx', 'Fabricator', 'Spongebob Server', 'Hytale', 'Node.js Generic', 'Python Generic', '', 'Mine craft', 'Minecrafter',
        'ARK', 'ARK: Survival Ascended', 'Rust Autowipe', 'Garrys Mod', 'FiveM', 'RedM', 'Citadel: Forged with Fire', 'Forged in Fire',
        'discord.js Generic', 'discord.py Generic', 'Red-DiscordBot', 'JMusicBot', 'SinusBot', 'TeaSpeak', 'Mumble Server', 'Uptime Kuma',
    ] as $name) {
        same("egg name '$name' => not minecraft", $m($name), false);
    }
    same('tag minecraft', $m('Custom Java', ['minecraft']), true);
    same('tag Minecraft (case)', $m('Custom Java', ['Java', 'Minecraft']), true);
    same('tag containing minecraft', $m('Custom', ['minecraft-java-edition']), true);
    same('tag containing MineCraft', $m('Custom', ['Survival MineCraft']), true);
    same('feature eula', $m('Custom Java', [], ['eula']), true);
    same('feature java_version', $m('Custom Java', [], ['java_version']), true);
    same('feature among others', $m('Custom', ['java'], ['pid_limit', 'eula']), true);
    same('steam game with steam features', $m('Counter-Strike 2', ['source', 'steamcmd'], ['steam_disk_space', 'pid_limit']), false);
    same('rust with tags', $m('Rust', ['rust', 'oxide'], ['steam_disk_space']), false);
    same('no false positive from tags', $m('Terraria', ['terraria', 'tshock'], []), false);
    same('non-string tags/features are ignored', $m('Valheim', [null, 42, ['minecraft']], [false, ['eula']]), false);
});

section('MimeTypeIcons (material)', function () use ($icons): void {
    $expected = [
        'text/x-shellscript' => 'console', 'text/x-python' => 'python', 'text/x-perl' => 'perl', 'text/x-php' => 'php',
        'text/javascript' => 'javascript', 'application/javascript' => 'javascript', 'text/x-lua' => 'lua', 'text/x-ruby' => 'ruby',
        'text/x-tcl' => 'tcl', 'application/json' => 'json', 'application/x-ndjson' => 'json', 'text/xml' => 'xml',
        'application/xml' => 'xml', 'text/html' => 'html', 'image/svg+xml' => 'svg', 'image/png' => 'image', 'image/webp' => 'image',
        'text/csv' => 'table', 'text/tab-separated-values' => 'table', 'application/zip' => 'zip', 'application/gzip' => 'zip',
        'application/x-gzip' => 'zip', 'application/x-tar' => 'zip', 'application/x-7z-compressed' => 'zip', 'application/x-xz' => 'zip',
        'application/x-bzip2' => 'zip', 'application/x-rar-compressed' => 'zip', 'application/vnd.rar' => 'zip', 'application/zstd' => 'zip',
        'application/java-archive' => 'jar', 'application/x-executable' => 'exe', 'application/x-elf' => 'exe',
        'application/x-mach-binary' => 'exe', 'application/vnd.microsoft.portable-executable' => 'exe', 'application/x-msdownload' => 'exe',
        'application/x-sharedlib' => 'dll', 'application/pdf' => 'pdf', 'audio/mpeg' => 'audio', 'audio/ogg' => 'audio',
        'video/mp4' => 'video', 'video/webm' => 'video', 'application/x-sqlite3' => 'database', 'application/vnd.sqlite3' => 'database',
        'font/woff2' => 'font', 'font/ttf' => 'font',
    ];
    foreach ($expected as $mime => $icon) {
        same("mime $mime", MimeTypeIcons::iconFor($mime), $icon);
        same("mime $mime (explicit material)", MimeTypeIcons::iconFor($mime, Themes::MATERIAL), $icon);
        ok("mime $mime icon $icon shipped", isset($icons['material'][$icon]));
    }
    same('mime params stripped', MimeTypeIcons::iconFor('text/x-python; charset=utf-8'), 'python');
    same('mime params stripped (no space)', MimeTypeIcons::iconFor('application/json;charset=UTF-8'), 'json');
    same('mime case-insensitive', MimeTypeIcons::iconFor('Text/X-ShellScript'), 'console');
    foreach (['text/plain', 'text/plain; charset=utf-8', 'application/octet-stream', 'inode/x-empty', '', 'garbage', 'text/', 'image', 'application/x-unknown'] as $mime) {
        same("mime $mime => null", MimeTypeIcons::iconFor($mime), null);
    }
});

section('MimeTypeIcons (datapack)', function () use ($icons): void {
    // SPEC2 §3: datapack equivalents
    $expected = [
        'text/x-shellscript' => 'shell_file', 'text/x-python' => 'python_file', 'text/x-php' => 'php_file', 'text/javascript' => 'javascript_file',
        'application/javascript' => 'javascript_file', 'text/x-lua' => 'lua_file', 'text/x-ruby' => 'ruby_file', 'application/json' => 'json_file',
        'text/xml' => 'xml_file', 'application/xml' => 'xml_file', 'text/html' => 'html_file', 'image/png' => 'image_file', 'image/webp' => 'image_file',
        'text/csv' => 'excel_file', 'application/zip' => 'archive_file', 'application/gzip' => 'archive_file', 'application/x-tar' => 'archive_file',
        'application/x-7z-compressed' => 'archive_file', 'application/vnd.rar' => 'archive_file', 'application/java-archive' => 'jar_file',
        'application/x-executable' => 'executable_file', 'application/x-elf' => 'executable_file', 'application/x-msdownload' => 'executable_file',
        'application/pdf' => 'pdf_file', 'audio/mpeg' => 'audio_file', 'audio/ogg' => 'audio_file', 'video/mp4' => 'video_file',
        'application/x-sqlite3' => 'database_file', 'font/woff2' => 'font_file',
    ];
    foreach ($expected as $mime => $icon) {
        same("datapack mime $mime", MimeTypeIcons::iconFor($mime, Themes::DATAPACK), $icon);
    }
    same('datapack mime params stripped', MimeTypeIcons::iconFor('Text/X-Python; charset=utf-8', Themes::DATAPACK), 'python_file');
    foreach (['text/plain', 'text/plain; charset=utf-8', 'application/octet-stream', '', 'garbage', 'image'] as $mime) {
        same("datapack mime $mime => null", MimeTypeIcons::iconFor($mime, Themes::DATAPACK), null);
    }
    // every mapping of every theme points at an icon of that theme
    $probe = [
        'text/x-shellscript', 'text/x-python', 'text/x-perl', 'text/x-php', 'text/javascript', 'application/javascript', 'text/x-lua', 'text/x-ruby',
        'text/x-tcl', 'application/json', 'application/x-ndjson', 'text/xml', 'application/xml', 'text/html', 'image/svg+xml', 'image/png', 'image/x-icon',
        'text/csv', 'text/tab-separated-values', 'application/zip', 'application/gzip', 'application/x-gzip', 'application/x-tar',
        'application/x-7z-compressed', 'application/x-xz', 'application/x-bzip2', 'application/x-rar-compressed', 'application/vnd.rar', 'application/zstd',
        'application/java-archive', 'application/x-executable', 'application/x-elf', 'application/x-mach-binary',
        'application/vnd.microsoft.portable-executable', 'application/x-msdownload', 'application/x-sharedlib', 'application/pdf', 'audio/mpeg',
        'audio/x-wav', 'video/mp4', 'application/x-sqlite3', 'application/vnd.sqlite3', 'font/woff2', 'font/otf',
    ];
    foreach (MIT_TEST_THEMES as $theme) {
        $missing = [];
        foreach ($probe as $mime) {
            $icon = MimeTypeIcons::iconFor($mime, $theme);
            if ($icon !== null && !isset($icons[$theme][$icon])) {
                $missing[] = "$mime => $icon";
            }
        }
        same("$theme: every mime icon is shipped", $missing, []);
    }
});

section('GameServerExtras (material)', function () use ($icons): void {
    $files = GameServerExtras::fileAssociations();
    $folders = GameServerExtras::folderAssociations();
    same('default theme is material (files)', GameServerExtras::fileAssociations(Themes::MATERIAL), $files);
    same('default theme is material (folders)', GameServerExtras::folderAssociations(Themes::MATERIAL), $folders);
    $expectedFiles = [
        '*.nbt' => 'minecraft', '*.snbt' => 'minecraft', '*.schem' => 'minecraft', '*.schematic' => 'minecraft', '*.litematic' => 'minecraft',
        '*.sk' => 'minecraft', '*.dat_old' => 'hex', '*.phar' => 'php', '*.sp' => 'pawn', '*.sma' => 'pawn', '*.smx' => 'pawn',
        '*.amxx' => 'pawn', '*.vdf' => 'settings', '*.acf' => 'settings', '*.vpk' => 'zip', '*.pak' => 'zip', '*.service' => 'systemd',
        '*.socket' => 'systemd', '*.timer' => 'systemd', '*.target' => 'systemd', '*.mount' => 'systemd',
    ];
    $expectedFolders = [
        'crash-reports' => 'log', 'resourcepacks' => 'resource', 'datapacks' => 'resource', 'defaultconfigs' => 'config',
        'serverconfig' => 'config', 'kubejs' => 'scripts',
    ];
    $sortedFiles = $files;
    ksort($sortedFiles);
    ksort($expectedFiles);
    same('extras file associations (SPEC §6)', $sortedFiles, $expectedFiles);
    $sortedFolders = $folders;
    ksort($sortedFolders);
    ksort($expectedFolders);
    same('extras folder associations (SPEC §6)', $sortedFolders, $expectedFolders);
    foreach ($files as $pattern => $icon) {
        ok("extras '$pattern' is a *.ext key", preg_match('/^\*\.[a-z0-9_]+$/', (string) $pattern) === 1);
        ok("extras '$pattern' icon '$icon' shipped", isset($icons['material'][$icon]));
    }
    foreach ($folders as $name => $suffix) {
        ok("extras folder '$name' icon folder-$suffix shipped", isset($icons['material']['folder-' . $suffix]));
    }

    $on = resolver(['gameServerExtras' => true, 'mimeFallback' => false]);
    $off = resolver(['gameServerExtras' => false, 'mimeFallback' => false]);
    same('extras on: script.sk', triple($on->forFile('script.sk', '/plugins/Skript/scripts')), ['minecraft', null, 'fileExtension']);
    same('extras on: level.dat_old', triple($on->forFile('level.dat_old', '/world'))[0] ?? null, 'hex');
    same('extras on: mc.service', $on->forFile('mc.service', '/')->icon, 'systemd');
    same('extras off: script.sk', triple($off->forFile('script.sk', '/')), ['file', null, 'default']);
    same('extras on: folder crash-reports', triple($on->forFolder('crash-reports', '/')), ['folder-log', null, 'folderName']);
    same('extras on: folder .crash-reports variant', $on->forFolder('_crash-reports', '/')?->icon, 'folder-log');
    same('extras off: folder crash-reports', triple($off->forFolder('crash-reports', '/')), ['folder', null, 'folderDefault']);
    $custom = resolver(['gameServerExtras' => true, 'fileAssociations' => ['*.SK' => 'json'], 'folderAssociations' => ['kubejs' => 'javascript']]);
    same('custom association beats extras (file)', $custom->forFile('x.sk', '/')->icon, 'json');
    same('custom association beats extras (folder)', $custom->forFolder('kubejs', '/')?->icon, 'folder-javascript');
    same('built-in still beats nothing: server.properties', $on->forFile('server.properties', '/')->icon, 'settings');
});

section('GameServerExtras (datapack)', function () use ($icons): void {
    $files = GameServerExtras::fileAssociations(Themes::DATAPACK);
    $folders = GameServerExtras::folderAssociations(Themes::DATAPACK);
    ok('datapack extras: some file associations', count($files) > 0);
    foreach ($files as $pattern => $icon) {
        ok("datapack extras '$pattern' is a *.ext key", preg_match('/^\*\.[a-z0-9_]+$/', (string) $pattern) === 1);
        ok("datapack extras '$pattern' icon '$icon' shipped", isset($icons['datapack'][$icon]));
    }
    foreach ($folders as $name => $icon) {
        ok("datapack extras folder '$name' icon '$icon' shipped", $icon === '' || isset($icons['datapack'][$icon]));
    }
    // SPEC2 §3 examples
    foreach (['*.schem', '*.schematic', '*.litematic'] as $k) {
        same("datapack extras $k => structure icon", $files[$k] ?? null, 'structure_file');
    }
    same('datapack extras *.snbt => nbt icon', $files['*.snbt'] ?? null, 'nbt_file');
    same('datapack extras *.phar => php icon', $files['*.phar'] ?? null, 'php_file');
    foreach (['*.vdf', '*.acf', '*.vpk'] as $k) {
        same("datapack extras $k => valve icon", $files[$k] ?? null, 'valve_file');
    }
    foreach (['*.service', '*.socket', '*.timer', '*.target', '*.mount'] as $k) {
        same("datapack extras $k => config icon", $files[$k] ?? null, 'config_file');
    }
    same('datapack extras crash-reports => log folder', $folders['crash-reports'] ?? null, 'log_folder');

    $on = resolver(['gameServerExtras' => true, 'mimeFallback' => false], Themes::DATAPACK);
    $off = resolver(['gameServerExtras' => false, 'mimeFallback' => false], Themes::DATAPACK);
    same('datapack extras on: castle.schem', triple($on->forFile('castle.schem', '/plugins/WorldEdit/schematics')), ['structure_file', null, 'fileExtension']);
    same('datapack extras off: castle.schem', triple($off->forFile('castle.schem', '/')), ['generic_file', null, 'default']);
    same('datapack extras on: folder crash-reports', triple($on->forFolder('crash-reports', '/')), ['log_folder', null, 'folderName']);
    same('datapack extras on: folder __crash-reports__ variant', $on->forFolder('__crash-reports__', '/')?->icon, 'log_folder');
    same('datapack extras off: folder crash-reports', triple($off->forFolder('crash-reports', '/')), ['generic_folder_closed', null, 'folderDefault']);
    same('datapack extras keep raw mappings: x.json', $on->forFile('x.json', '/')->icon, 'json_file');
    same('material extras are not applied to datapack (*.sk)', $on->forFile('script.sk', '/')->icon, isset($files['*.sk']) ? $files['*.sk'] : 'generic_file');
});

section('IconThemeOptions', function (): void {
    $d = IconThemeOptions::fromArray([]);
    same('default iconPack', $d->iconPack, null);
    same('default folderTheme', $d->folderTheme, 'specific');
    same('default fileAssociations', $d->fileAssociations, []);
    same('default folderAssociations', $d->folderAssociations, []);
    same('default gameServerExtras', $d->gameServerExtras, true);
    same('default mimeFallback', $d->mimeFallback, true);
    $c = new IconThemeOptions();
    same('constructor defaults equal fromArray([])', [$c->iconPack, $c->folderTheme, $c->fileAssociations, $c->folderAssociations, $c->gameServerExtras, $c->mimeFallback], [null, 'specific', [], [], true, true]);
    $o = IconThemeOptions::fromArray([
        'iconPack' => 'react',
        'folderTheme' => 'classic',
        'fileAssociations' => ['*.foo' => 'toml'],
        'folderAssociations' => ['bar' => 'src'],
        'gameServerExtras' => false,
        'mimeFallback' => false,
    ]);
    same('fromArray all keys', [$o->iconPack, $o->folderTheme, $o->fileAssociations, $o->folderAssociations, $o->gameServerExtras, $o->mimeFallback], ['react', 'classic', ['*.foo' => 'toml'], ['bar' => 'src'], false, false]);
    $p = IconThemeOptions::fromArray(['iconPack' => '', 'mimeFallback' => false]);
    same('fromArray partial', [$p->iconPack, $p->folderTheme, $p->gameServerExtras, $p->mimeFallback], ['', 'specific', true, false]);
    $theme = IconTheme::load(MIT_TEST_DATA_DIR, $o);
    ok('IconTheme::options()', $theme->options() instanceof IconThemeOptions && $theme->options()->folderTheme === 'classic' && $theme->options()->fileAssociations === ['*.foo' => 'toml']);
});

section('IconTheme::load / id()', function () use ($data, $languages): void {
    same('load() defaults to material', IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions())->id(), 'material');
    foreach (MIT_TEST_THEMES as $theme) {
        $t = IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions(), $theme);
        same("load($theme)->id()", $t->id(), $theme);
        same("load($theme)->version() = hash", $t->version(), $data[$theme]['hash']);
        same("fromArrays($theme)->id()", IconTheme::fromArrays($data[$theme], $languages, new IconThemeOptions())->id(), $theme);
    }
    $noTheme = $data['material'];
    unset($noTheme['theme']);
    same("fromArrays() without 'theme' => material", IconTheme::fromArrays($noTheme, $languages, new IconThemeOptions())->id(), 'material');
    throws("load('does-not-exist') throws", static fn () => IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions(), 'does-not-exist'));
    throws("load('../data/material') throws (no path traversal)", static fn () => IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions(), '../data/material'));
});

section('IconTheme helpers (material)', function () use ($manifest, $icons): void {
    $icons = $icons['material'];
    $theme = IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions());
    $fromArrays = IconTheme::fromArrays($manifest, require MIT_TEST_DATA_DIR . '/languages.php', new IconThemeOptions());
    same('version() = manifest hash', $theme->version(), $manifest['hash']);
    same('fromArrays version', $fromArrays->version(), $manifest['hash']);
    ok('hasIcon(file)', $theme->hasIcon('file'));
    ok('hasIcon(toml_light)', $theme->hasIcon('toml_light'));
    ok('!hasIcon(nope)', !$theme->hasIcon('does-not-exist'));
    ok('!hasIcon(traversal)', !$theme->hasIcon('../file'));
    ok('!hasIcon(empty)', !$theme->hasIcon(''));
    ok('!hasIcon(folder-open)', !$theme->hasIcon('folder-open'));
    ok('!hasIcon(datapack icon)', !$theme->hasIcon('generic_file'));
    same('lightVariant(toml)', $theme->lightVariant('toml'), 'toml_light');
    same('lightVariant(folder-cursor)', $theme->lightVariant('folder-cursor'), 'folder-cursor_light');
    same('lightVariant(file)', $theme->lightVariant('file'), null);
    same('lightVariant(json)', $theme->lightVariant('json'), null);
    same('lightVariant(toml_light)', $theme->lightVariant('toml_light'), null);
    $names = $theme->iconNames();
    $sorted = array_map('strval', array_keys($icons));
    sort($sorted, SORT_STRING);
    same('iconNames() = sorted icons', $names, $sorted);
    $folders = $theme->folderIconNames();
    $copy = $folders;
    sort($copy, SORT_STRING);
    same('folderIconNames sorted', $folders, $copy);
    ok('folderIconNames contains folder', in_array('folder', $folders, true));
    ok('folderIconNames contains folder-src', in_array('folder-src', $folders, true));
    $bad = array_values(array_filter($folders, static fn ($f) => !($f === 'folder' || str_starts_with($f, 'folder-')) || str_ends_with($f, '-open') || str_contains($f, '_light') || !isset($icons[$f])));
    same('folderIconNames only closed dark folder icons', array_slice($bad, 0, 10), []);
    same('packs()', $theme->packs(), $manifest['packs']);
});

section('IconTheme helpers (datapack)', function () use ($data, $icons): void {
    $icons = $icons['datapack'];
    $theme = IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions(), Themes::DATAPACK);
    same('datapack version()', $theme->version(), $data['datapack']['hash']);
    same('datapack packs()', $theme->packs(), []);
    ok('datapack hasIcon(generic_file)', $theme->hasIcon('generic_file'));
    ok('datapack hasIcon(pack.mcmeta_file) (dot in id)', $theme->hasIcon('pack.mcmeta_file'));
    ok('datapack !hasIcon(material icon)', !$theme->hasIcon('folder-src'));
    ok('datapack !hasIcon(expanded default)', !$theme->hasIcon('generic_folder'));
    ok('datapack !hasIcon(traversal)', !$theme->hasIcon('../material/file'));
    $light = [];
    foreach (array_keys($icons) as $id) {
        if ($theme->lightVariant((string) $id) !== null) {
            $light[] = $id;
        }
    }
    same('datapack lightVariant() always null', $light, []);
    $sorted = array_map('strval', array_keys($icons));
    sort($sorted, SORT_STRING);
    same('datapack iconNames() = sorted icons', $theme->iconNames(), $sorted);
    $folders = $theme->folderIconNames();
    $copy = $folders;
    sort($copy, SORT_STRING);
    same('datapack folderIconNames sorted', $folders, $copy);
    same('datapack folderIconNames are shipped', array_values(array_filter($folders, static fn ($f) => !isset($icons[$f]))), []);
});

// ---------------------------------------------------------------------------
// Material Icon Theme resolution
section('resolution basics', function (): void {
    $r = resolver(['gameServerExtras' => false, 'mimeFallback' => false]);
    same('server.properties', triple($r->forFile('server.properties', '/')), ['settings', null, 'fileExtension']);
    same('package.json', triple($r->forFile('package.json', '/')), ['nodejs', null, 'fileName']);
    same('PACKAGE.JSON (case)', $r->forFile('PACKAGE.JSON', '/')->icon, 'nodejs');
    same('.config/postcssrc.json (parent)', triple($r->forFile('postcssrc.json', '/home/.config')), ['postcss', null, 'fileName']);
    same('other/postcssrc.json', $r->forFile('postcssrc.json', '/other')->icon, 'json');
    same('x.mpp (languageId)', triple($r->forFile('x.mpp', '/')), ['cpp', null, 'languageId']);
    same('/repo/.git/config (onPath pattern)', triple($r->forFile('config', '/repo/.git')), ['settings', null, 'languageId']);
    same('unknown', triple($r->forFile('level.dat_old', '/world')), ['file', null, 'default']);
    same('folder src', triple($r->forFolder('src', '/')), ['folder-src', null, 'folderName']);
    same('folder workflows (parent)', triple($r->forFolder('workflows', '/x/.github')), ['folder-gh-workflows', null, 'folderName']);
    same('folder world', triple($r->forFolder('world', '/')), ['folder', null, 'folderDefault']);
    same('null directory', $r->forFile('package.json', null)->icon, 'nodejs');
    same('directory without leading slash', $r->forFile('postcssrc.json', 'home/.config/')->icon, 'postcss');
    same('>255 chars: no extension match', $r->forFile(str_repeat('a', 252) . '.mca', '/')->icon, 'file');
    same('255 chars: extension match', $r->forFile(str_repeat('a', 251) . '.mca', '/')->icon, 'minecraft');
});

section('light variants', function (): void {
    $r = resolver(['gameServerExtras' => false, 'mimeFallback' => false]);
    same('x.toml', triple($r->forFile('x.toml', '/')), ['toml', 'toml_light', 'fileExtension']);
    same('x.json', triple($r->forFile('x.json', '/')), ['json', null, 'fileExtension']);
    same('vercel.json', triple($r->forFile('vercel.json', '/')), ['vercel', 'vercel_light', 'fileName']);
    same('folder .cursor', triple($r->forFolder('.cursor', '/')), ['folder-cursor', 'folder-cursor_light', 'folderName']);
    same('folder default has no light', $r->forFolder('nothing-special', '/')?->lightIcon, null);
});

section('mime fallback only for default results', function (): void {
    $on = resolver(['gameServerExtras' => false, 'mimeFallback' => true]);
    $off = resolver(['gameServerExtras' => false, 'mimeFallback' => false]);
    same('extensionless script + mime', triple($on->forFile('start', '/', 'text/x-shellscript')), ['console', null, 'mimeType']);
    same('mime with params', $on->forFile('run', '/', 'text/x-python; charset=utf-8')->icon, 'python');
    same('extension wins over mime', triple($on->forFile('x.json', '/', 'text/x-shellscript')), ['json', null, 'fileExtension']);
    same('fileName wins over mime', $on->forFile('package.json', '/', 'text/x-shellscript')->icon, 'nodejs');
    same('languageId wins over mime', triple($on->forFile('x.mpp', '/', 'text/x-shellscript')), ['cpp', null, 'languageId']);
    same('text/plain is never mapped', triple($on->forFile('start', '/', 'text/plain')), ['file', null, 'default']);
    same('octet-stream is never mapped', triple($on->forFile('blob', '/', 'application/octet-stream')), ['file', null, 'default']);
    same('no mime', triple($on->forFile('start', '/', null)), ['file', null, 'default']);
    same('mimeFallback off', triple($off->forFile('start', '/', 'text/x-shellscript')), ['file', null, 'default']);
    same('mime ignored for folders', triple($on->forFolder('zz-no-icon', '/')), ['folder', null, 'folderDefault']);
});

section('memoization does not leak', function (): void {
    $r = resolver(['gameServerExtras' => false, 'mimeFallback' => true]);
    same('file src first', $r->forFile('src', '/')->icon, 'file');
    same('then folder src', $r->forFolder('src', '/')?->icon, 'folder-src');
    same('then file src again', $r->forFile('src', '/')->icon, 'file');
    same('folder package.json first', $r->forFolder('package.json', '/')?->icon, 'folder');
    same('then file package.json', $r->forFile('package.json', '/')->icon, 'nodejs');
    same('mime first', $r->forFile('start', '/', 'text/x-shellscript')->icon, 'console');
    same('then same name without mime', $r->forFile('start', '/', null)->icon, 'file');
    same('then other mime', $r->forFile('start', '/', 'text/x-python')->icon, 'python');
    same('parent .config first', $r->forFile('postcssrc.json', '/.config')->icon, 'postcss');
    same('then other parent', $r->forFile('postcssrc.json', '/other')->icon, 'json');
    same('then root', $r->forFile('postcssrc.json', '/')->icon, 'json');
    same('folder parent first', $r->forFolder('workflows', '/.github')?->icon, 'folder-gh-workflows');
    same('then folder other parent', $r->forFolder('workflows', '/x')?->icon, 'folder');
    $a = resolver(['gameServerExtras' => false, 'iconPack' => '']);
    $b = resolver(['gameServerExtras' => false, 'iconPack' => 'angular']);
    ok('separate resolvers do not share state', $a->forFile('app.module.ts', '/')->icon !== $b->forFile('app.module.ts', '/')->icon);
});

section('icon packs', function () use ($manifest): void {
    $none = resolver(['iconPack' => '', 'gameServerExtras' => false]);
    $default = resolver(['iconPack' => null, 'gameServerExtras' => false]);
    $angular = resolver(['iconPack' => 'angular', 'gameServerExtras' => false]);
    $unknown = resolver(['iconPack' => 'does-not-exist', 'gameServerExtras' => false]);
    same("pack '' app.module.ts", $none->forFile('app.module.ts', '/')->icon, 'typescript');
    $angularIcon = $manifest['packOverrides']['angular']['fileExtensions']['module.ts'] ?? null;
    ok('angular overrides module.ts', is_string($angularIcon), export($angularIcon));
    same('pack null => defaultPack', $default->forFile('app.module.ts', '/')->icon, $angularIcon);
    same('pack angular', $angular->forFile('app.module.ts', '/')->icon, $angularIcon);
    same('unknown pack => none', $unknown->forFile('app.module.ts', '/')->icon, 'typescript');
    same('angular folder store', $angular->forFolder('store', '/')?->icon, 'folder-store');
    same('no pack folder store', $none->forFolder('store', '/')?->icon, 'folder');
});

section('folder themes', function (): void {
    $none = resolver(['folderTheme' => 'none', 'gameServerExtras' => false]);
    same('none => null', $none->forFolder('src', '/'), null);
    same('none => null (default folder)', $none->forFolder('whatever', '/'), null);
    same('none keeps file icons', $none->forFile('x.ts', '/')->icon, 'typescript');
    $noneAssoc = resolver(['folderTheme' => 'none', 'folderAssociations' => ['foo' => 'src'], 'gameServerExtras' => true]);
    same('none ignores folder associations', $noneAssoc->forFolder('foo', '/'), null);
    $classic = resolver(['folderTheme' => 'classic', 'gameServerExtras' => false]);
    same('classic src', triple($classic->forFolder('src', '/')), ['folder', null, 'folderDefault']);
    same('classic .cursor has no light', triple($classic->forFolder('.cursor', '/')), ['folder', null, 'folderDefault']);
    $classicAssoc = resolver(['folderTheme' => 'classic', 'folderAssociations' => ['foo' => 'src'], 'gameServerExtras' => false]);
    same('classic + association (Material applies it)', $classicAssoc->forFolder('foo', '/')?->icon, 'folder-src');
    same('classic + association variant', $classicAssoc->forFolder('__foo__', '/')?->icon, 'folder-src');
    same('classic + association others plain', $classicAssoc->forFolder('src', '/')?->icon, 'folder');
});

section('associations', function (): void {
    $r = resolver([
        'gameServerExtras' => false,
        'fileAssociations' => ['*.foo' => 'toml', '**.json' => 'nodejs', 'Server.Properties' => 'Minecraft', '*.zzz' => 'does-not-exist', '*.json5' => '../etc/passwd', 'plugins/config.yml' => 'settings'],
        'folderAssociations' => ['MyFolder' => 'src', 'plugins' => '', 'bad' => 'does-not-exist', 'parent/child' => 'config'],
    ]);
    same('*.foo', $r->forFile('x.foo', '/')->icon, 'toml');
    same('**.json ext', $r->forFile('x.json', '/')->icon, 'nodejs');
    same('**.json removes fileNames containing .json', $r->forFile('tsconfig.json', '/')->icon, 'nodejs');
    same('**.json keeps other fileNames', $r->forFile('.gitignore', '/')->icon, 'git');
    same('fileName association (case-insensitive)', triple($r->forFile('server.properties', '/')), ['minecraft', null, 'fileName']);
    same('unknown icon ignored', $r->forFile('x.zzz', '/')->icon, 'file');
    same('path-like icon ignored', $r->forFile('x.json5', '/')->icon, 'json');
    same('parent-qualified file association', $r->forFile('config.yml', '/plugins')->icon, 'settings');
    same('parent-qualified file association elsewhere', $r->forFile('config.yml', '/other')->icon, 'yaml');
    same('folder association', $r->forFolder('myfolder', '/')?->icon, 'folder-src');
    same('folder association variant .x', $r->forFolder('.myfolder', '/')?->icon, 'folder-src');
    same('folder association variant __x__', $r->forFolder('__MyFolder__', '/')?->icon, 'folder-src');
    same("folder association '' => folder", $r->forFolder('plugins', '/')?->icon, 'folder');
    same('folder association unknown icon ignored', $r->forFolder('bad', '/')?->icon, 'folder');
    same('folder association parent-qualified', $r->forFolder('child', '/x/parent')?->icon, 'folder-config');
    same('folder association parent-qualified elsewhere', $r->forFolder('child', '/x/other')?->icon, 'folder');
});

// ---------------------------------------------------------------------------
// Settings: config/file-icons.php and SettingsData (form state <-> config <-> .env)
section('config/file-icons.php icon pack', function () use ($manifest): void {
    same('no FILE_ICONS_ICON_PACK => angular', plugin_config([])['icon_pack'], 'angular');
    foreach ($manifest['packs'] ?? [] as $pack) {
        same("FILE_ICONS_ICON_PACK=$pack", plugin_config(['FILE_ICONS_ICON_PACK' => $pack])['icon_pack'], $pack);
    }
    same('FILE_ICONS_ICON_PACK=" Vue " => vue', plugin_config(['FILE_ICONS_ICON_PACK' => ' Vue '])['icon_pack'], 'vue');
    foreach (['none', 'NONE', '', 'svelte', 'nestjs', 'react-redux', '../angular'] as $value) {
        same("FILE_ICONS_ICON_PACK='$value' => ''", plugin_config(['FILE_ICONS_ICON_PACK' => $value])['icon_pack'], '');
    }
    // config('file-icons.icon_pack') is the pack the Material Icon Theme really uses
    foreach (['', 'none', 'svelte', 'nestjs', 'nest', 'angular', ' React '] as $value) {
        $config = plugin_config(['FILE_ICONS_ICON_PACK' => $value]);
        same("config icon_pack '$value' = activePack()", $config['icon_pack'], material_from_config($config)->activePack());
    }
    same('config icon_pack (unset) = activePack()', plugin_config([])['icon_pack'], material_from_config(plugin_config([]))->activePack());
});

section('SettingsData icon pack', function () use ($manifest): void {
    $settings = new SettingsData(IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions()));
    same('packs() = manifest packs', $settings->packs(), $manifest['packs'] ?? null);
    same('FALLBACK_PACKS = manifest packs', SettingsData::FALLBACK_PACKS, $manifest['packs'] ?? null);
    same('DEFAULT_PACK = manifest defaultPack', SettingsData::DEFAULT_PACK, $manifest['defaultPack'] ?? null);
    same('packs() without data = FALLBACK_PACKS', (new SettingsData(null))->packs(), SettingsData::FALLBACK_PACKS);
    foreach ([[null, 'angular'], [42, 'angular'], [false, 'angular'], ['', 'none'], ['none', 'none'], [' None ', 'none'], ['nest', 'nest'], ['React', 'react'], ['svelte', 'none'], ['nestjs', 'none']] as [$value, $expected]) {
        same('iconPack(' . export($value) . ')', $settings->iconPack($value), $expected);
    }
    same('formData: missing icon_pack => angular', $settings->formData([])['icon_pack'], 'angular');
    same("formData: icon_pack '' => none", $settings->formData(['icon_pack' => ''])['icon_pack'], 'none');
    same('formData: unknown icon_pack => none', $settings->formData(['icon_pack' => 'svelte'])['icon_pack'], 'none');
    same('formData: icon_pack vue', $settings->formData(['icon_pack' => 'vue'])['icon_pack'], 'vue');
    same('config(): missing icon_pack => angular', $settings->config([])['icon_pack'], 'angular');
    same("config(): icon_pack none => ''", $settings->config(['icon_pack' => 'none'])['icon_pack'], '');
    same("config(): unknown icon_pack => ''", $settings->config(['icon_pack' => 'svelte'])['icon_pack'], '');
    same('envValues: unknown icon_pack => none', $settings->envValues(['icon_pack' => 'nestjs'])['values']['FILE_ICONS_ICON_PACK'], 'none');
    same('envValues: icon_pack React => react', $settings->envValues(['icon_pack' => 'React'])['values']['FILE_ICONS_ICON_PACK'], 'react');

    // .env -> form -> save -> .env never changes the effective pack (an unknown pack stays off)
    $files = ['app.component.ts', 'app.module.ts', 'store.ts', 'app.tsx'];
    foreach ([null, '', 'none', 'svelte', 'nestjs', 'nest', 'angular', ' React ', 'vue_vuex'] as $value) {
        $label = $value === null ? '(unset)' : "'$value'";
        $before = plugin_config($value === null ? [] : ['FILE_ICONS_ICON_PACK' => $value]);
        $saved = $settings->envValues($settings->formData($before))['values'];
        $after = plugin_config(['FILE_ICONS_ICON_PACK' => $saved['FILE_ICONS_ICON_PACK']]);
        same("round trip $label: config icon_pack", $after['icon_pack'], $before['icon_pack']);
        $r1 = new IconResolver(material_from_config($before));
        $r2 = new IconResolver(material_from_config($after));
        same("round trip $label: framework file icons", array_map(static fn (string $f): string => $r2->forFile($f, '/')->icon, $files), array_map(static fn (string $f): string => $r1->forFile($f, '/')->icon, $files));
        same("round trip $label: form value", $settings->formData($after)['icon_pack'], $settings->formData($before)['icon_pack']);
    }
});

section('SettingsData custom icons', function (): void {
    $settings = new SettingsData(IconTheme::load(MIT_TEST_DATA_DIR, new IconThemeOptions()));
    same('associationKey trims and lower-cases', SettingsData::associationKey('  *.SK '), '*.sk');

    $config = plugin_config([
        'FILE_ICONS_FILE_ASSOCIATIONS' => '{"*.sk":"doesnotexist","*.ts":"","server.properties":"Minecraft","bad|x":"json","*.LCK":"lock","*.lck":"json"," *.foo ":"toml","n":42,"x.cfg":" json","*.mcfunction":"toml_light"}',
        'FILE_ICONS_FOLDER_ASSOCIATIONS' => '{"world":"global","backups":"","x":"doesnotexist","World":"log","a|b":"src","y":["src"],"z":"folder-src"}',
    ]);
    $rows = $settings->associationRows($config);
    same('form file rows: only what the form can show, the last duplicate wins', $rows['file_associations'], [
        ['pattern' => 'server.properties', 'icon' => 'minecraft'],
        ['pattern' => '*.lck', 'icon' => 'json'],
        ['pattern' => '*.foo', 'icon' => 'toml'],
        ['pattern' => '*.mcfunction', 'icon' => 'toml_light'],
    ]);
    same('form folder rows: only what the form can show, the last duplicate wins', $rows['folder_associations'], [
        ['folder' => 'backups', 'icon' => 'folder'],
        ['folder' => 'World', 'icon' => 'folder-log'],
    ]);
    // files: unknown icon, "", invalid pattern, duplicate, non-string, icon with a space;
    // folders: unknown icon, invalid name, duplicate, non-string, value with the "folder-" prefix
    same('hidden entries', $rows['hidden'], 11);
    same('hiddenAssociations()', $settings->hiddenAssociations($config), 11);
    $form = $settings->formData($config);
    same('formData uses the same rows', [$form['file_associations'], $form['folder_associations']], [$rows['file_associations'], $rows['folder_associations']]);

    // Every row the form shows passes the form's own checks, so the form can always be saved.
    foreach ($form['file_associations'] as $row) {
        ok("form file row {$row['pattern']} is valid", preg_match(SettingsData::PATTERN_REGEX, $row['pattern']) === 1 && $settings->isFileIcon($row['icon']));
    }
    foreach ($form['folder_associations'] as $row) {
        ok("form folder row {$row['folder']} is valid", preg_match(SettingsData::FOLDER_REGEX, $row['folder']) === 1 && $settings->isFolderIcon($row['icon']));
    }
    $keys = array_map(static fn (array $row): string => SettingsData::associationKey($row['pattern']), $form['file_associations']);
    same('form file rows have distinct patterns', count(array_unique($keys)), count($keys));

    $saved = $settings->envValues($form);
    same('saved: nothing dropped', $saved['dropped'], 0);
    same('saved FILE_ASSOCIATIONS', $saved['values']['FILE_ICONS_FILE_ASSOCIATIONS'], '{"server.properties":"minecraft","*.lck":"json","*.foo":"toml","*.mcfunction":"toml_light"}');
    same('saved FOLDER_ASSOCIATIONS', $saved['values']['FILE_ICONS_FOLDER_ASSOCIATIONS'], '{"backups":"","World":"log"}');

    $after = plugin_config([
        'FILE_ICONS_FILE_ASSOCIATIONS' => $saved['values']['FILE_ICONS_FILE_ASSOCIATIONS'],
        'FILE_ICONS_FOLDER_ASSOCIATIONS' => $saved['values']['FILE_ICONS_FOLDER_ASSOCIATIONS'],
    ]);
    same('after saving: nothing hidden', $settings->hiddenAssociations($after), 0);
    same('after saving: same file rows', $settings->formData($after)['file_associations'], $form['file_associations']);
    same('after saving: same folder rows', $settings->formData($after)['folder_associations'], $form['folder_associations']);

    // Saving keeps the icons of every entry the runtime uses (the "" file value is .env-only).
    $r1 = new IconResolver(material_from_config($config));
    $r2 = new IconResolver(material_from_config($after));
    foreach (['server.properties', 'x.lck', 'x.sk', 'x.cfg', 'x.mcfunction'] as $name) {
        same("after saving: file $name", $r2->forFile($name, '/')->icon, $r1->forFile($name, '/')->icon);
    }
    foreach (['world', 'World', '.world', 'backups', 'x', 'z'] as $name) {
        same("after saving: folder $name", $r2->forFolder($name, '/')?->icon, $r1->forFolder($name, '/')?->icon);
    }
    same('folder world uses the last duplicate', $r2->forFolder('world', '/')?->icon, 'folder-log');

    same('valid config: nothing hidden', $settings->hiddenAssociations(plugin_config([
        'FILE_ICONS_FILE_ASSOCIATIONS' => '{"*.sk":"minecraft","plugins/config.yml":"settings"}',
        'FILE_ICONS_FOLDER_ASSOCIATIONS' => '{"world":"global","backups":""}',
    ])), 0);
    same('no associations: nothing hidden', $settings->hiddenAssociations(plugin_config([])), 0);

    // Submitted rows: invalid ones and earlier duplicates (case-insensitive, trimmed) are dropped.
    $submitted = $settings->config([
        'file_associations' => [
            ['pattern' => '*.sk', 'icon' => 'minecraft'],
            ['pattern' => ' *.SK ', 'icon' => 'json'],
            ['pattern' => '*.nbt', 'icon' => 'does-not-exist'],
            ['pattern' => 'a|b', 'icon' => 'json'],
            'not a row',
        ],
        'folder_associations' => [
            ['folder' => 'world', 'icon' => 'folder-global'],
            ['folder' => 'WORLD', 'icon' => 'folder-log'],
            ['folder' => 'backups', 'icon' => 'folder'],
        ],
    ]);
    same('config(): file rows', $submitted['file_associations'], ['*.SK' => 'json']);
    same('config(): folder rows', $submitted['folder_associations'], ['WORLD' => 'log', 'backups' => '']);
    same('config(): dropped', $submitted['dropped'], 4);
});

// ---------------------------------------------------------------------------
// Datapack Icons (hand-checked against the raw active.json of mc-dp-icons 5.0.0)
section('datapack resolution basics', function (): void {
    $r = resolver(['gameServerExtras' => false, 'mimeFallback' => false], Themes::DATAPACK);
    same('dp pack.mcmeta', triple($r->forFile('pack.mcmeta', '/world/datapacks/p')), ['pack.mcmeta_file', null, 'fileName']);
    same('dp PACK.MCMETA (case)', $r->forFile('PACK.MCMETA', '/')->icon, 'pack.mcmeta_file');
    same('dp CHANGELOG.md', triple($r->forFile('CHANGELOG.md', '/')), ['timeline_file', null, 'fileName']);
    same('dp function/load.json', triple($r->forFile('load.json', '/p/data/minecraft/tags/function')), ['load.json_file', null, 'fileName']);
    same('dp load.json elsewhere', triple($r->forFile('load.json', '/p/data/minecraft/tags')), ['json_file', null, 'fileExtension']);
    same('dp advancement/json', triple($r->forFile('root.json', '/p/data/ns/advancement')), ['advancement_file', null, 'fileExtension']);
    same('dp advancement/json (case)', $r->forFile('Root.JSON', '/p/data/ns/Advancement')->icon, 'advancement_file');
    same('dp advancement/json only direct parent', $r->forFile('root.json', '/p/data/ns/advancement/story')->icon, 'json_file');
    same('dp structure/nbt', $r->forFile('house.nbt', '/p/data/ns/structure')->icon, 'structure_file');
    same('dp nbt', $r->forFile('house.nbt', '/')->icon, 'nbt_file');
    same('dp atlases/blocks.json', $r->forFile('blocks.json', '/rp/assets/minecraft/atlases')->icon, 'atlases_file');
    same('dp blocks.json', $r->forFile('blocks.json', '/rp')->icon, 'blocks.json_file');
    same('dp render_controllers/render_controllers.json', $r->forFile('x.render_controllers.json', '/rp/render_controllers')->icon, 'render_controllers_file');
    // equal specificity: VS Code shows the icon whose CSS rule comes later (entities_file is emitted before sponge_mixins_file)
    same('dp tie entity/json vs mixins.json', $r->forFile('x.mixins.json', '/rp/entity')->icon, 'sponge_mixins_file');
    same('dp tie advancement/json vs spyglass.json', $r->forFile('a.spyglass.json', '/advancement')->icon, 'spyglass_file');
    same('dp x.ts', triple($r->forFile('x.ts', '/')), ['typescript_file', null, 'fileExtension']);
    same('dp no language tier: Jenkinsfile', triple($r->forFile('Jenkinsfile', '/')), ['generic_file', null, 'default']);
    same('dp no language tier: x.mpp', triple($r->forFile('x.mpp', '/')), ['generic_file', null, 'default']);
    same('dp unknown', triple($r->forFile('level.dat_old', '/world')), ['generic_file', null, 'default']);
    same('dp level.dat', triple($r->forFile('level.dat', '/world')), ['level.dat_file', null, 'fileName']);
    same('dp folder advancement (closed-folder deviation)', triple($r->forFolder('advancement', '/p/data/ns')), ['advancement_folder', null, 'folderName']);
    same('dp folder data (closed entry wins)', triple($r->forFolder('data', '/p')), ['data_folder_closed', null, 'folderName']);
    same('dp folder Assets', $r->forFolder('Assets', '/rp')?->icon, 'assets_folder_closed');
    same('dp folder world', $r->forFolder('world', '/')?->icon, 'worldgen_folder');
    same('dp folder plugins', $r->forFolder('plugins', '/')?->icon, 'jar_folder');
    same('dp folder buildSrc', $r->forFolder('buildSrc', '/')?->icon, 'gradle_folder');
    same('dp folder default', triple($r->forFolder('crash-reports', '/')), ['generic_folder_closed', null, 'folderDefault']);
    same('dp null directory', $r->forFile('pack.mcmeta', null)->icon, 'pack.mcmeta_file');
    same('dp >255 chars: no extension match', $r->forFile(str_repeat('a', 252) . '.json', '/')->icon, 'generic_file');
    same('dp 255 chars: extension match', $r->forFile(str_repeat('a', 250) . '.json', '/')->icon, 'json_file');
});

section('datapack options', function (): void {
    $base = resolver(['gameServerExtras' => false, 'mimeFallback' => false], Themes::DATAPACK);
    $react = resolver(['gameServerExtras' => false, 'mimeFallback' => false, 'iconPack' => 'react'], Themes::DATAPACK);
    same('dp ignores icon packs', [$react->forFile('app.component.tsx', '/')->icon, $react->forFile('store.ts', '/')->icon], [$base->forFile('app.component.tsx', '/')->icon, $base->forFile('store.ts', '/')->icon]);
    $none = resolver(['folderTheme' => 'none', 'gameServerExtras' => true], Themes::DATAPACK);
    same('dp folders none => null', $none->forFolder('data', '/'), null);
    same('dp folders none => null (default)', $none->forFolder('whatever', '/'), null);
    same('dp folders none => null (extras)', $none->forFolder('crash-reports', '/'), null);
    same('dp folders none keeps files', $none->forFile('pack.mcmeta', '/')->icon, 'pack.mcmeta_file');
    $classic = resolver(['folderTheme' => 'classic', 'gameServerExtras' => false], Themes::DATAPACK);
    same('dp classic advancement', triple($classic->forFolder('advancement', '/')), ['generic_folder_closed', null, 'folderDefault']);
    same('dp classic data', $classic->forFolder('data', '/')?->icon, 'generic_folder_closed');
    $classicExtras = resolver(['folderTheme' => 'classic', 'gameServerExtras' => true], Themes::DATAPACK);
    same('dp classic + extras (associations still apply)', $classicExtras->forFolder('crash-reports', '/')?->icon, 'log_folder');
    $mime = resolver(['gameServerExtras' => false, 'mimeFallback' => true], Themes::DATAPACK);
    same('dp mime fallback', triple($mime->forFile('start', '/', 'text/x-shellscript')), ['shell_file', null, 'mimeType']);
    same('dp mime fallback archive', $mime->forFile('backup', '/', 'application/gzip')->icon, 'archive_file');
    same('dp mime only for default results', triple($mime->forFile('x.json', '/', 'text/x-shellscript')), ['json_file', null, 'fileExtension']);
    same('dp mime text/plain', triple($mime->forFile('start', '/', 'text/plain')), ['generic_file', null, 'default']);
    $noMime = resolver(['gameServerExtras' => false, 'mimeFallback' => false], Themes::DATAPACK);
    same('dp mimeFallback off', triple($noMime->forFile('start', '/', 'text/x-shellscript')), ['generic_file', null, 'default']);
});

section('themes do not share state', function (): void {
    $m = resolver(['gameServerExtras' => false, 'mimeFallback' => true]);
    $d = resolver(['gameServerExtras' => false, 'mimeFallback' => true], Themes::DATAPACK);
    same('material package.json', $m->forFile('package.json', '/')->icon, 'nodejs');
    same('datapack package.json', $d->forFile('package.json', '/')->icon, 'npm_file');
    same('material again', $m->forFile('package.json', '/')->icon, 'nodejs');
    same('material folder src', $m->forFolder('src', '/')?->icon, 'folder-src');
    same('datapack folder src', $d->forFolder('src', '/')?->icon, 'src_folder_closed');
    same('material mime', $m->forFile('start', '/', 'text/x-shellscript')->icon, 'console');
    same('datapack mime', $d->forFile('start', '/', 'text/x-shellscript')->icon, 'shell_file');
});

$passed = $GLOBALS['mit_passed'];
$failures = $GLOBALS['mit_failures'];
if ($failures !== []) {
    foreach ($failures as $f) {
        fwrite(STDOUT, "  FAIL $f\n");
    }
}
fwrite(STDOUT, sprintf("unit.php: %d passed, %d failed\n", $passed, count($failures)));
exit($failures === [] ? 0 : 1);
