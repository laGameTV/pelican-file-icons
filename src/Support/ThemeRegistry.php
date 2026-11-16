<?php

namespace LaGameTV\FileIcons\Support;

use LaGameTV\FileIcons\Icons\IconResolver;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\IconThemeOptions;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Rendering\IconRenderer;
use RuntimeException;

/**
 * Lazily builds the icon theme, resolver and renderer of every bundled theme from the plugin
 * config (one instance per theme and request). Previews of unsaved settings use build().
 */
final class ThemeRegistry
{
    /** @var array<string, IconTheme> */
    private array $themes = [];

    /** @var array<string, IconResolver> */
    private array $resolvers = [];

    /** @var array<string, IconRenderer> */
    private array $renderers = [];

    /** @var array<string, array<mixed>> raw data files by name */
    private static array $data = [];

    /**
     * @param  array<mixed>  $config  the `file-icons` config
     */
    public function __construct(
        private readonly array $config,
        private readonly string $dataDir,
    ) {}

    /**
     * @return array<mixed>
     */
    public function config(): array
    {
        return $this->config;
    }

    public function theme(string $theme): IconTheme
    {
        return $this->themes[$theme] ??= $this->build($theme, ConfigOptions::forTheme($this->config, $theme));
    }

    public function resolver(string $theme): IconResolver
    {
        return $this->resolvers[$theme] ??= new IconResolver($this->theme($theme));
    }

    public function renderer(string $theme): IconRenderer
    {
        return $this->renderers[$theme] ??= new IconRenderer($this->theme($theme), ConfigOptions::delivery($this->config));
    }

    /**
     * A fresh theme with the given options (not cached, the data files are).
     */
    public function build(string $theme, IconThemeOptions $options): IconTheme
    {
        if (!Themes::isValid($theme)) {
            throw new RuntimeException("Unknown icon theme [$theme].");
        }

        $manifest = $this->data($theme);
        $manifest['theme'] ??= $theme;

        return IconTheme::fromArrays($manifest, $this->data('languages'), $options);
    }

    /**
     * @return array<mixed>
     */
    private function data(string $name): array
    {
        $file = rtrim($this->dataDir, '/\\') . DIRECTORY_SEPARATOR . $name . '.php';

        if (!isset(self::$data[$file])) {
            if (!is_file($file) || !is_readable($file)) {
                throw new RuntimeException("Icon data file [$file] is missing, run `bun run build`.");
            }

            $data = (static fn (string $path): mixed => require $path)($file);
            if (!is_array($data)) {
                throw new RuntimeException("Icon data file [$file] does not return an array.");
            }

            self::$data[$file] = $data;
        }

        return self::$data[$file];
    }
}
