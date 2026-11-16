<?php

namespace LaGameTV\FileIcons\Providers;

use Illuminate\Foundation\Support\Providers\RouteServiceProvider;
use Illuminate\Support\Facades\Route;
use LaGameTV\FileIcons\Http\Controllers\IconController;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Rendering\IconRenderer;

class FileIconsRoutesProvider extends RouteServiceProvider
{
    public function boot(): void
    {
        // Public, static MIT assets: deliberately no middleware group (no session, no cookies).
        // Only used with `FILE_ICONS_DELIVERY=route`; icons are inlined by default.
        $this->routes(static function (): void {
            Route::get('file-icons/{version}/{theme}/{icon}.svg', IconController::class)
                ->where([
                    'version' => '[a-f0-9]{1,64}',
                    'theme' => implode('|', array_map(static fn (string $theme): string => preg_quote($theme, '/'), Themes::all())),
                    'icon' => '[a-z0-9][a-z0-9_.\-]*',
                ])
                ->name(IconRenderer::ROUTE_NAME);
        });
    }
}
