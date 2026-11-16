<?php

namespace LaGameTV\FileIcons\Http\Controllers;

use Illuminate\Contracts\Container\Container;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Support\PluginPaths;
use LaGameTV\FileIcons\Support\ThemeRegistry;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class IconController
{
    public function __construct(private readonly Container $container) {}

    public function __invoke(string $version, string $theme, string $icon): BinaryFileResponse
    {
        $iconTheme = Themes::isValid($theme) ? $this->theme($theme) : null;

        // Whitelist: only shipped icon ids of a bundled theme (they never contain '/').
        if ($iconTheme === null || preg_match('/^[a-z0-9][a-z0-9_.-]*$/', $icon) !== 1 || !$iconTheme->hasIcon($icon)) {
            abort(404);
        }

        $path = PluginPaths::icon($iconTheme->id(), $icon);
        if (!is_file($path)) {
            abort(404);
        }

        // The version segment is the theme's data hash; an outdated hash must not be cached forever.
        $cacheControl = hash_equals(strtolower($iconTheme->version()), strtolower($version))
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300';

        return response()->file($path, [
            'Content-Type' => 'image/svg+xml',
            'Cache-Control' => $cacheControl,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        ]);
    }

    private function theme(string $theme): ?IconTheme
    {
        try {
            return $this->container->make(ThemeRegistry::class)->theme($theme);
        } catch (Throwable) {
            return null;
        }
    }
}
