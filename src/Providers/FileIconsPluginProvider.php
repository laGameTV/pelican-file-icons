<?php

namespace LaGameTV\FileIcons\Providers;

use App\Filament\Server\Resources\Files\Pages\ListFiles;
use App\Filament\Server\Resources\Files\Pages\SearchFiles;
use Filament\Tables\Table;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Support\ServiceProvider;
use LaGameTV\FileIcons\Integration\FileManagerIcons;
use LaGameTV\FileIcons\Profile\ProfileTab;
use LaGameTV\FileIcons\Support\PluginPaths;
use LaGameTV\FileIcons\Support\ThemeRegistry;
use LaGameTV\FileIcons\Support\ThemeSelector;
use LaGameTV\FileIcons\Support\UserPreferences;
use Livewire\Livewire;
use Throwable;

class FileIconsPluginProvider extends ServiceProvider
{
    public function register(): void
    {
        // Everything is resolved lazily: nothing here may throw while the panel boots.
        $this->app->scoped(ThemeRegistry::class, static function (): ThemeRegistry {
            $config = config(PluginPaths::PLUGIN_ID);

            return new ThemeRegistry(is_array($config) ? $config : [], PluginPaths::data());
        });

        $this->app->scoped(UserPreferences::class, static fn (Application $app): UserPreferences => new UserPreferences(static fn (): mixed => $app->make('db')));

        $this->app->scoped(ThemeSelector::class, static fn (Application $app): ThemeSelector => new ThemeSelector(
            $app->make(ThemeRegistry::class),
            $app->make(UserPreferences::class),
        ));

        $this->app->scoped(FileManagerIcons::class, static fn (Application $app): FileManagerIcons => new FileManagerIcons($app));

        try {
            ProfileTab::register();
        } catch (Throwable $exception) {
            self::warn('Could not add the profile tab: ' . $exception->getMessage());
        }
    }

    public function boot(): void
    {
        // An exception escaping boot() would mark the plugin as crashed, so swallow everything here.
        // (No report(): reporting before the app has booted also marks the plugin as crashed.)
        try {
            $this->hookFileManager();
        } catch (Throwable $exception) {
            self::warn('Could not hook into the file manager: ' . $exception->getMessage());
        }
    }

    private static function warn(string $message): void
    {
        try {
            logger()->warning('[file-icons] ' . $message);
        } catch (Throwable) {
        }
    }

    /**
     * @return list<class-string>
     */
    private static function fileManagerPages(): array
    {
        return [ListFiles::class, SearchFiles::class];
    }

    private function hookFileManager(): void
    {
        $app = $this->app;

        $modifier = static function (Table $table) use ($app): Table {
            try {
                return $app->make(FileManagerIcons::class)->applyToTable($table);
            } catch (Throwable) {
                return $table;
            }
        };

        // Forward compatibility: use an official static table hook once the file manager pages offer one.
        $hooked = [];
        foreach (self::fileManagerPages() as $page) {
            $modifyTable = [$page, 'modifyTable'];
            if (method_exists($page, 'modifyTable') && is_callable($modifyTable)) {
                $modifyTable($modifier);
                $hooked[] = $page;
            }
        }

        if (count($hooked) === count(self::fileManagerPages())) {
            return;
        }

        // The table is built in Livewire's `booted` hook and Livewire triggers `render` before the
        // view is rendered, so the column can still be patched here. The listener MUST return null:
        // non-null return values become render finishers.
        Livewire::listen('render', static function (mixed $component) use ($app, $hooked): null {
            try {
                if (is_object($component) && FileManagerIcons::supports($component) && !self::isHooked($component, $hooked)) {
                    $app->make(FileManagerIcons::class)->applyToComponent($component);
                }
            } catch (Throwable) {
            }

            return null;
        });
    }

    /**
     * @param  list<class-string>  $hooked
     */
    private static function isHooked(object $component, array $hooked): bool
    {
        foreach ($hooked as $page) {
            if ($component instanceof $page) {
                return true;
            }
        }

        return false;
    }
}
