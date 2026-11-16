<?php

namespace LaGameTV\FileIcons\Integration;

use App\Filament\Server\Resources\Files\Pages\ListFiles;
use App\Filament\Server\Resources\Files\Pages\SearchFiles;
use App\Models\File;
use BackedEnum;
use Closure;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Support\Htmlable;
use LaGameTV\FileIcons\Icons\IconResolver;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Rendering\IconRenderer;
use LaGameTV\FileIcons\Support\ThemeRegistry;
use LaGameTV\FileIcons\Support\ThemeSelector;
use Throwable;
use WeakMap;

/**
 * Swaps the Tabler icons of the file manager's `name` column for the icons of the effective
 * icon theme of the current user and server (ThemeSelector).
 *
 * Every failure falls back to the panel's own icon (`File::getIcon()`), so a problem in this
 * plugin can never break the file manager.
 */
final class FileManagerIcons
{
    public const string COLUMN = 'name';

    /** @var WeakMap<TextColumn, true> */
    private WeakMap $patched;

    private bool $reported = false;

    private bool $unavailable = false;

    private ?IconResolver $resolver = null;

    private ?IconRenderer $renderer = null;

    private ?IconTheme $theme = null;

    private ?string $themeId = null;

    public function __construct(private readonly Container $container)
    {
        $this->patched = new WeakMap();
    }

    public static function supports(mixed $component): bool
    {
        return $component instanceof ListFiles || $component instanceof SearchFiles;
    }

    /**
     * Livewire `render` listener target: patch the table of a file manager page.
     */
    public function applyToComponent(object $component): void
    {
        if (!method_exists($component, 'getTable')) {
            return;
        }

        try {
            $table = $component->getTable();
        } catch (Throwable) {
            return; // table not booted (yet)
        }

        if ($table instanceof Table) {
            $this->applyToTable($table);
        }
    }

    public function applyToTable(Table $table): Table
    {
        try {
            $column = $table->getColumn(self::COLUMN);

            if ($column instanceof TextColumn && !isset($this->patched[$column])) {
                $this->patched[$column] = true;
                $column->icon(fn ($record = null, $livewire = null): string|BackedEnum|Htmlable|null => $this->iconFor($record, $livewire));
            }
        } catch (Throwable $exception) {
            $this->report($exception);
        }

        return $table;
    }

    public function iconFor(mixed $record, mixed $livewire = null): string|BackedEnum|Htmlable|null
    {
        if (!$record instanceof File || $this->unavailable) {
            return $this->fallback($record);
        }

        try {
            $name = (string) $record->name;
            $slash = strrpos($name, '/');
            $baseName = $slash === false ? $name : substr($name, $slash + 1);
            $directory = $this->directoryFor($name, $slash, $livewire);

            if ($record->is_directory) {
                $resolved = $this->resolver()->forFolder($baseName, $directory);
                if ($resolved === null) {
                    return $this->fallback($record);
                }
            } else {
                $mimeType = $record->getAttribute('mime_type');
                $resolved = $this->resolver()->forFile($baseName, $directory, is_string($mimeType) && $mimeType !== '' ? $mimeType : null);
            }

            $theme = $this->theme();
            if (!$theme->hasIcon($resolved->icon) || ($resolved->lightIcon !== null && !$theme->hasIcon($resolved->lightIcon))) {
                return $this->fallback($record);
            }

            return $this->renderer()->html($resolved);
        } catch (Throwable $exception) {
            $this->report($exception);

            return $this->fallback($record);
        }
    }

    private function directoryFor(string $name, int|false $slash, mixed $livewire): ?string
    {
        // SearchFiles rows carry the full path in their name.
        if ($slash !== false) {
            $directory = substr($name, 0, $slash);

            return '/' . trim($directory, '/');
        }

        if (is_object($livewire) && isset($livewire->path) && is_string($livewire->path)) {
            return '/' . trim($livewire->path, '/');
        }

        return null;
    }

    private function fallback(mixed $record): string|BackedEnum|Htmlable|null
    {
        try {
            if (is_object($record) && method_exists($record, 'getIcon')) {
                $icon = $record->getIcon();

                return ($icon instanceof BackedEnum || $icon instanceof Htmlable || is_string($icon)) ? $icon : null;
            }
        } catch (Throwable) {
        }

        return null;
    }

    private function resolver(): IconResolver
    {
        return $this->resolver ??= $this->service(static fn (ThemeRegistry $registry, string $theme): IconResolver => $registry->resolver($theme));
    }

    private function renderer(): IconRenderer
    {
        return $this->renderer ??= $this->service(static fn (ThemeRegistry $registry, string $theme): IconRenderer => $registry->renderer($theme));
    }

    private function theme(): IconTheme
    {
        return $this->theme ??= $this->service(static fn (ThemeRegistry $registry, string $theme): IconTheme => $registry->theme($theme));
    }

    /**
     * The effective theme id of this request (user choice / admin default / auto detection).
     */
    public function themeId(): string
    {
        if ($this->themeId === null) {
            try {
                $this->themeId = $this->container->make(ThemeSelector::class)->current();
            } catch (Throwable $exception) {
                $this->report($exception);
                $this->themeId = Themes::MATERIAL;
            }
        }

        return $this->themeId;
    }

    /**
     * @template T of object
     *
     * @param  Closure(ThemeRegistry, string): T  $factory
     * @return T
     */
    private function service(Closure $factory): object
    {
        try {
            return $factory($this->container->make(ThemeRegistry::class), $this->themeId());
        } catch (Throwable $exception) {
            // Missing/invalid generated data: stop trying for the rest of the request.
            $this->unavailable = true;

            throw $exception;
        }
    }

    private function report(Throwable $exception): void
    {
        if ($this->reported) {
            return;
        }

        $this->reported = true;

        try {
            report($exception);
        } catch (Throwable) {
        }
    }
}
