<?php

namespace LaGameTV\FileIcons\Rendering;

use LaGameTV\FileIcons\Support\PluginPaths;
use Throwable;

final class Styles
{
    /**
     * The plugin's `<style>` block (resources/views/styles.blade.php, i.e. `file-icons::styles`).
     * Rendered by path so it works even if the view namespace is not registered; never throws.
     */
    public static function render(): string
    {
        try {
            return view()->file(PluginPaths::path('resources', 'views', 'styles.blade.php'))->render();
        } catch (Throwable) {
            return '';
        }
    }
}
