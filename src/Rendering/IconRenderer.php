<?php

namespace LaGameTV\FileIcons\Rendering;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\HtmlString;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\ResolvedIcon;
use LaGameTV\FileIcons\Support\PluginPaths;
use RuntimeException;
use Throwable;

/**
 * Turns resolved icons of one theme into `<img>` markup. Icons are rendered as images (like VS
 * Code does with `background-image`), which isolates the SVGs: many of them reuse short ids such
 * as `#a`.
 *
 * Delivery `inline` (default) embeds every icon as a data URI (no extra requests, memoized per
 * icon); `route` points to the plugin's icon route (one cached request per icon) and falls back
 * to inline if the route is missing.
 */
final class IconRenderer
{
    public const string ROUTE_NAME = 'file-icons.icon';

    private const string ICON_PATTERN = '/^[a-z0-9][a-z0-9_.-]*$/';

    /** @var array<string, string> */
    private array $urls = [];

    /** @var array<string, HtmlString> */
    private array $html = [];

    private ?bool $routeAvailable = null;

    public function __construct(
        private readonly IconTheme $theme,
        private readonly string $delivery = 'inline',
    ) {}

    public function theme(): IconTheme
    {
        return $this->theme;
    }

    /**
     * Markup for the file manager: Filament wraps it in `<span class="fi-icon fi-size-sm">`.
     */
    public function html(ResolvedIcon $icon): HtmlString
    {
        $key = $icon->icon . "\0" . ($icon->lightIcon ?? '');

        return $this->html[$key] ??= new HtmlString($this->markup($icon->icon, $icon->lightIcon));
    }

    /**
     * Stand-alone markup (settings and profile previews), sized via inline styles.
     */
    public function inlineHtml(string $icon, int $size = 16): string
    {
        $url = $this->url($icon);

        return '<img src="' . e($url) . '" alt="" width="' . $size . '" height="' . $size . '"'
            . ' style="width:' . $size . 'px;height:' . $size . 'px;flex-shrink:0;object-fit:contain"'
            . $this->loadingAttributes($url) . ' draggable="false">';
    }

    public function url(string $icon): string
    {
        if (preg_match(self::ICON_PATTERN, $icon) !== 1 || !$this->theme->hasIcon($icon)) {
            throw new RuntimeException("Unknown icon [$icon] in icon theme [{$this->theme->id()}].");
        }

        return $this->urls[$icon] ??= $this->buildUrl($icon);
    }

    private function markup(string $icon, ?string $lightIcon): string
    {
        $html = '<span class="fic-icon' . ($lightIcon !== null ? ' fic-icon-has-light' : '') . '" data-fic-icon="' . e($icon) . '">'
            . $this->img($this->url($icon), 'fic-icon-dark');

        if ($lightIcon !== null) {
            $html .= $this->img($this->url($lightIcon), 'fic-icon-light');
        }

        return $html . '</span>';
    }

    private function img(string $url, string $class): string
    {
        return '<img class="fic-icon-img ' . e($class) . '" src="' . e($url) . '" alt="" width="20" height="20"'
            . $this->loadingAttributes($url) . ' draggable="false">';
    }

    /**
     * Lazy loading only helps for real requests; data URIs are decoded right away.
     */
    private function loadingAttributes(string $url): string
    {
        return str_starts_with($url, 'data:') ? '' : ' loading="lazy" decoding="async"';
    }

    private function buildUrl(string $icon): string
    {
        if ($this->delivery === 'route' && $this->routeAvailable()) {
            try {
                return route(self::ROUTE_NAME, ['version' => $this->version(), 'theme' => $this->theme->id(), 'icon' => $icon]);
            } catch (Throwable) {
                // Route missing (e.g. stale route cache): fall back to an inline data URI.
                $this->routeAvailable = false;
            }
        }

        return $this->dataUri($icon);
    }

    private function dataUri(string $icon): string
    {
        $path = PluginPaths::icon($this->theme->id(), $icon);
        $svg = is_file($path) ? file_get_contents($path) : false;

        if ($svg === false || $svg === '') {
            throw new RuntimeException("Icon file [$path] is missing.");
        }

        return SvgDataUri::encode($svg);
    }

    private function routeAvailable(): bool
    {
        return $this->routeAvailable ??= Route::has(self::ROUTE_NAME);
    }

    private function version(): string
    {
        $version = strtolower($this->theme->version());

        return preg_match('/^[a-f0-9]{1,64}$/', $version) === 1 ? $version : '0';
    }
}
