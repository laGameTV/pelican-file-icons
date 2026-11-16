<?php

namespace LaGameTV\FileIcons;

use App\Contracts\Plugins\HasPluginSettings;
use App\Traits\EnvironmentWriterTrait;
use Closure;
use Filament\Contracts\Plugin;
use Filament\Forms\Components\Field;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Components\ToggleButtons;
use Filament\Notifications\Notification;
use Filament\Panel;
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\Html;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\View\PanelsRenderHook;
use Illuminate\Support\HtmlString;
use Illuminate\Support\Str;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Rendering\IconRenderer;
use LaGameTV\FileIcons\Rendering\Styles;
use LaGameTV\FileIcons\Settings\Preview;
use LaGameTV\FileIcons\Settings\SettingsData;
use LaGameTV\FileIcons\Support\ConfigOptions;
use LaGameTV\FileIcons\Support\PluginPaths;
use LaGameTV\FileIcons\Support\ThemeRegistry;
use Throwable;

class FileIconsPlugin implements HasPluginSettings, Plugin
{
    use EnvironmentWriterTrait;

    private const int SEARCH_LIMIT = 50;

    private const string LANG = 'file-icons::settings.';

    /** Form fields that update the live preview. */
    private const array PREVIEW_FIELDS = ['default_theme', 'folder_theme', 'mime_fallback', 'game_server_extras', 'icon_pack', 'file_associations', 'folder_associations'];

    public function getId(): string
    {
        return PluginPaths::PLUGIN_ID;
    }

    public function register(Panel $panel): void
    {
        if ($panel->getId() !== 'server') {
            return;
        }

        // Unlayered <style>, so it beats Filament's `@layer components` rules.
        $panel->renderHook(PanelsRenderHook::STYLES_AFTER, static fn (): HtmlString => new HtmlString(Styles::render()));
    }

    public function boot(Panel $panel): void {}

    /**
     * @return array<string, mixed>
     */
    public function getSettingsFormData(): array
    {
        $config = config(PluginPaths::PLUGIN_ID);

        return $this->settings()->formData(is_array($config) ? $config : []);
    }

    public function getSettingsForm(): array
    {
        return [
            Section::make(self::trans('sections.appearance'))
                ->description(self::trans('sections.appearance_description'))
                ->schema([
                    Radio::make('default_theme')
                        ->label(self::trans('fields.default_theme'))
                        ->helperText(self::trans('fields.default_theme_help'))
                        ->options(self::themeOptions())
                        ->descriptions(self::themeDescriptions())
                        ->required()
                        ->live(),
                    Toggle::make('allow_user_choice')
                        ->label(self::trans('fields.allow_user_choice'))
                        ->helperText(self::trans('fields.allow_user_choice_help')),
                    ToggleButtons::make('folder_theme')
                        ->label(self::trans('fields.folder_theme'))
                        ->helperText(self::trans('fields.folder_theme_help'))
                        ->options(array_combine(
                            SettingsData::FOLDER_THEMES,
                            array_map(static fn (string $theme): string => self::trans('folder_themes.' . $theme), SettingsData::FOLDER_THEMES),
                        ))
                        ->inline()
                        ->required()
                        ->live(),
                ]),
            Section::make(self::trans('sections.detection'))
                ->description(self::trans('sections.detection_description'))
                ->schema([
                    Toggle::make('mime_fallback')
                        ->label(self::trans('fields.mime_fallback'))
                        ->helperText(self::trans('fields.mime_fallback_help'))
                        ->live(),
                    Toggle::make('game_server_extras')
                        ->label(self::trans('fields.game_server_extras'))
                        ->helperText(self::trans('fields.game_server_extras_help'))
                        ->live(),
                ]),
            Section::make(self::trans('sections.material'))
                ->description(self::trans('sections.material_description'))
                // Opened when custom icons from .env can't be shown, so the notice below is seen.
                ->collapsed(fn (): bool => $this->hiddenAssociations() === 0)
                ->schema([
                    Callout::make(self::trans('notices.hidden_title'))
                        ->description(fn (): string => self::transChoice('notices.hidden', $this->hiddenAssociations()))
                        ->warning()
                        ->visible(fn (): bool => $this->hiddenAssociations() > 0),
                    Select::make('icon_pack')
                        ->label(self::trans('fields.icon_pack'))
                        ->helperText(self::trans('fields.icon_pack_help'))
                        ->options(fn (): array => $this->packOptions())
                        ->selectablePlaceholder(false)
                        ->required()
                        ->live(),
                    Repeater::make('file_associations')
                        ->label(self::trans('fields.file_associations'))
                        ->helperText(self::trans('fields.file_associations_help'))
                        ->columns(2)
                        ->defaultItems(0)
                        ->addActionLabel(self::trans('fields.add_file_association'))
                        ->live()
                        ->schema([
                            TextInput::make('pattern')
                                ->label(self::trans('fields.pattern'))
                                ->placeholder(self::trans('fields.pattern_placeholder'))
                                ->required()
                                ->maxLength(128)
                                ->regex(SettingsData::PATTERN_REGEX)
                                ->validationMessages(['regex' => self::trans('validation.pattern')])
                                ->rule(static fn (Field $component): Closure => self::uniqueInRepeater($component, 'pattern', self::trans('validation.duplicate_pattern')))
                                ->live(onBlur: true),
                            $this->iconSelect('icon', false)
                                ->label(self::trans('fields.icon')),
                        ]),
                    Repeater::make('folder_associations')
                        ->label(self::trans('fields.folder_associations'))
                        ->helperText(self::trans('fields.folder_associations_help'))
                        ->columns(2)
                        ->defaultItems(0)
                        ->addActionLabel(self::trans('fields.add_folder_association'))
                        ->live()
                        ->schema([
                            TextInput::make('folder')
                                ->label(self::trans('fields.folder'))
                                ->placeholder(self::trans('fields.folder_placeholder'))
                                ->required()
                                ->maxLength(128)
                                ->regex(SettingsData::FOLDER_REGEX)
                                ->validationMessages(['regex' => self::trans('validation.folder')])
                                ->rule(static fn (Field $component): Closure => self::uniqueInRepeater($component, 'folder', self::trans('validation.duplicate_folder')))
                                ->live(onBlur: true),
                            $this->iconSelect('icon', true)
                                ->label(self::trans('fields.folder_icon')),
                        ]),
                ]),
            Section::make(self::trans('sections.preview'))
                ->description(self::trans('sections.preview_description'))
                ->schema([
                    Html::make(fn (Get $get): HtmlString => new HtmlString($this->previewHtml($get))),
                ]),
        ];
    }

    public function saveSettings(array $data): void
    {
        try {
            ['values' => $values, 'dropped' => $dropped] = $this->settings()->envValues($data);
            // Entries from .env that the form could not show are not in $data, so saving removes them.
            $removed = $dropped + $this->hiddenAssociations();

            $this->writeToEnvironment($values);

            Notification::make()
                ->title(self::trans('notifications.saved'))
                ->body($removed > 0 ? self::transChoice('notifications.removed', $removed) : null)
                ->success()
                ->send();
        } catch (Throwable $exception) {
            report($exception);

            Notification::make()
                ->title(self::trans('notifications.save_failed'))
                ->body($exception->getMessage())
                ->danger()
                ->send();
        }
    }

    /**
     * Labels of the theme choices (theme ids and 'auto').
     *
     * @return array<string, string>
     */
    public static function themeOptions(): array
    {
        $options = [];
        foreach (ConfigOptions::choices() as $choice) {
            $options[$choice] = self::trans('themes.' . $choice);
        }

        return $options;
    }

    /**
     * @return array<string, string>
     */
    public static function themeDescriptions(): array
    {
        $descriptions = [];
        foreach (ConfigOptions::choices() as $choice) {
            $descriptions[$choice] = self::trans('themes.' . $choice . '_description');
        }

        return $descriptions;
    }

    /**
     * Preview of the sample entries in every theme with the given config (saved or unsaved).
     *
     * @param  array<mixed>  $config  config values (config/file-icons.php shape)
     * @param  string  $choice  theme id or 'auto', marks the column(s) it uses
     */
    public static function themePreview(ThemeRegistry $registry, array $config, string $choice, ?string $badge = null): string
    {
        $badges = Preview::badges($choice, [
            'default' => $badge ?? self::trans('preview.default'),
            'minecraft' => self::trans('preview.minecraft'),
            'other' => self::trans('preview.other'),
        ]);

        $columns = [];
        foreach (Themes::all() as $theme) {
            try {
                $columns[] = [
                    'theme' => $registry->build($theme, ConfigOptions::forTheme($config, $theme)),
                    'title' => self::trans('themes.' . $theme),
                    'badge' => $badges[$theme] ?? null,
                ];
            } catch (Throwable) {
                // Missing data for one theme only hides its column.
            }
        }

        return Preview::render($columns, self::trans('preview.mime'));
    }

    /**
     * @param  array<string, mixed>  $replace
     */
    private static function trans(string $key, array $replace = []): string
    {
        $value = trans(self::LANG . $key, $replace);

        return is_string($value) ? $value : $key;
    }

    /**
     * @param  array<string, mixed>  $replace
     */
    private static function transChoice(string $key, int $count, array $replace = []): string
    {
        return trans_choice(self::LANG . $key, $count, ['count' => $count, ...$replace]);
    }

    /**
     * Validation rule that rejects a pattern or folder name another row of the same repeater
     * already uses. It ignores case (the runtime does too) and surrounding spaces (saving trims them).
     */
    private static function uniqueInRepeater(Field $component, string $field, string $message): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail) use ($component, $field, $message): void {
            if (!is_string($value) || trim($value) === '') {
                return;
            }

            $rows = $component->getParentRepeater()?->getRawState();
            $key = SettingsData::associationKey($value);
            $uses = 0;
            foreach (is_array($rows) ? $rows : [] as $row) {
                if (is_array($row) && is_string($row[$field] ?? null) && SettingsData::associationKey($row[$field]) === $key) {
                    $uses++;
                }
            }

            if ($uses > 1) {
                $fail($message);
            }
        };
    }

    private function settings(): SettingsData
    {
        return new SettingsData($this->materialTheme());
    }

    /**
     * Custom icon entries in the saved config that the form can't show (and saving removes).
     */
    private function hiddenAssociations(): int
    {
        try {
            $config = config(PluginPaths::PLUGIN_ID);

            return $this->settings()->hiddenAssociations(is_array($config) ? $config : []);
        } catch (Throwable) {
            return 0;
        }
    }

    private function registry(): ?ThemeRegistry
    {
        try {
            return app(ThemeRegistry::class);
        } catch (Throwable) {
            return null;
        }
    }

    private function materialTheme(): ?IconTheme
    {
        try {
            return $this->registry()?->theme(Themes::MATERIAL);
        } catch (Throwable) {
            return null;
        }
    }

    private function materialRenderer(): ?IconRenderer
    {
        $theme = $this->materialTheme();

        return $theme === null ? null : new IconRenderer($theme, 'inline');
    }

    /**
     * @return array<string, string>
     */
    private function packOptions(): array
    {
        $options = ['none' => self::trans('icon_packs.none')];

        foreach ($this->settings()->packs() as $pack) {
            $key = 'icon_packs.' . $pack;
            $label = self::trans($key);
            $options[$pack] = $label !== $key && $label !== self::LANG . $key ? $label : Str::headline($pack);
        }

        return $options;
    }

    private function iconSelect(string $name, bool $folders): Select
    {
        return Select::make($name)
            ->required()
            ->native(false)
            ->searchable()
            ->allowHtml()
            ->live()
            ->placeholder(self::trans('fields.icon_search'))
            ->getSearchResultsUsing(fn (?string $search): array => $this->searchIcons($search ?? '', $folders))
            ->getOptionLabelUsing(fn (mixed $value): ?string => is_string($value) ? $this->iconLabel($value, $folders) : null);
    }

    /**
     * @return array<string, string>
     */
    private function searchIcons(string $search, bool $folders): array
    {
        $theme = $this->materialTheme();
        if ($theme === null) {
            return [];
        }

        $search = strtolower(trim($search));
        $icons = $folders ? $theme->folderIconNames() : $theme->iconNames();

        $ranked = [[], [], []];
        foreach ($icons as $icon) {
            // Light variants are picked automatically, they are no association targets.
            if (str_ends_with($icon, IconTheme::LIGHT_SUFFIX)) {
                continue;
            }

            $label = $folders && $icon !== 'folder' ? substr($icon, strlen('folder-')) : $icon;

            if ($search === '' || $icon === $search || $label === $search) {
                $ranked[0][] = $icon;
            } elseif (str_starts_with($label, $search) || str_starts_with($icon, $search)) {
                $ranked[1][] = $icon;
            } elseif (str_contains($icon, $search)) {
                $ranked[2][] = $icon;
            }
        }

        $renderer = $this->materialRenderer();
        $results = [];
        foreach (array_slice(array_merge(...$ranked), 0, self::SEARCH_LIMIT) as $icon) {
            $results[$icon] = $this->iconLabel($icon, $folders, $renderer) ?? e($icon);
        }

        return $results;
    }

    private function iconLabel(string $icon, bool $folders, ?IconRenderer $renderer = null): ?string
    {
        $settings = $this->settings();
        if (!($folders ? $settings->isFolderIcon($icon) : $settings->isFileIcon($icon))) {
            return null;
        }

        $image = '';
        try {
            $image = ($renderer ?? $this->materialRenderer())?->inlineHtml($icon) ?? '';
        } catch (Throwable) {
        }

        return '<span style="display:inline-flex;align-items:center;gap:0.5rem">' . $image . '<span>' . e($icon) . '</span></span>';
    }

    /**
     * Live preview of the current, unsaved form state.
     */
    private function previewHtml(Get $get): string
    {
        try {
            $registry = $this->registry();
            if ($registry === null) {
                return '';
            }

            $state = [];
            foreach (self::PREVIEW_FIELDS as $field) {
                $state[$field] = $get($field);
            }

            $config = $this->settings()->config($state);

            return self::themePreview($registry, $config, $config['default_theme']);
        } catch (Throwable) {
            return '';
        }
    }
}
