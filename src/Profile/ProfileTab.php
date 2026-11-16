<?php

namespace LaGameTV\FileIcons\Profile;

use App\Enums\TabPosition;
use App\Filament\Pages\Auth\EditProfile;
use Filament\Forms\Components\Radio;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Html;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Components\Utilities\Get;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;
use LaGameTV\FileIcons\FileIconsPlugin;
use LaGameTV\FileIcons\Support\ConfigOptions;
use LaGameTV\FileIcons\Support\ThemeRegistry;
use LaGameTV\FileIcons\Support\ThemeSelector;
use LaGameTV\FileIcons\Support\UserPreferences;
use Throwable;

/**
 * "File icons" tab on the panel's profile page: every user can pick their own icon theme.
 *
 * The choice is stored in the plugin's table, never on the user model: the field is not
 * dehydrated (Filament removes it from the data passed to `User::update()`), its state is loaded
 * after hydration and stored through `saveRelationshipsUsing()`, which Filament's
 * `EditProfile::save()` runs via `$this->form->getState()` inside its database transaction.
 */
final class ProfileTab
{
    public const string FIELD = 'file_icons_theme';

    /** "Use the panel default" (no stored preference). */
    public const string DEFAULT = 'default';

    private const string LANG = 'file-icons::profile.';

    /**
     * Throws if the panel no longer offers custom profile tabs; the provider catches and logs that.
     */
    public static function register(): void
    {
        EditProfile::registerCustomTabs(TabPosition::After, self::make());
    }

    public static function make(): Tab
    {
        // Labels are closures: the tab is created while the app registers its providers.
        return Tab::make(static fn (): string => self::trans('tab'))
            ->icon('tabler-files')
            ->visible(static fn (): bool => self::selector()?->allowsUserChoice() ?? false)
            ->schema(static fn (): array => [
                Section::make(self::trans('heading'))
                    ->description(self::trans('description'))
                    ->schema([
                        Radio::make(self::FIELD)
                            ->label(self::trans('field'))
                            ->options(self::options())
                            ->descriptions(self::descriptions())
                            ->default(self::DEFAULT)
                            ->live()
                            ->dehydrated(false)
                            ->afterStateHydrated(static function (Radio $component, ?Model $record): void {
                                $component->state(self::stored($record));
                            })
                            ->saveRelationshipsUsing(static function (mixed $state, ?Model $record): void {
                                self::save($state, $record);
                            }),
                    ]),
                Section::make(self::trans('preview'))
                    ->description(self::trans('preview_description'))
                    ->schema([
                        Html::make(static fn (Get $get): HtmlString => new HtmlString(self::preview($get(self::FIELD)))),
                    ]),
            ]);
    }

    /**
     * @return array<string, string>
     */
    private static function options(): array
    {
        return [self::DEFAULT => self::trans('options.default')] + FileIconsPlugin::themeOptions();
    }

    /**
     * @return array<string, string>
     */
    private static function descriptions(): array
    {
        $default = self::selector()?->defaultChoice() ?? ConfigOptions::defaultTheme([]);

        return [self::DEFAULT => self::trans('options.default_description', ['theme' => FileIconsPlugin::themeOptions()[$default] ?? $default])]
            + FileIconsPlugin::themeDescriptions();
    }

    private static function stored(?Model $record): string
    {
        $userId = self::userId($record);

        return ($userId === null ? null : self::preferences()?->get($userId)) ?? self::DEFAULT;
    }

    private static function save(mixed $state, ?Model $record): void
    {
        $userId = self::userId($record);
        $preferences = self::preferences();
        if ($userId === null || $preferences === null || (self::selector()?->allowsUserChoice() ?? false) === false) {
            return;
        }

        $choice = ConfigOptions::choice($state);
        if ($choice === $preferences->get($userId)) {
            return;
        }

        $saved = $choice === null ? $preferences->forget($userId) : $preferences->set($userId, $choice);

        if (!$saved) {
            try {
                Notification::make()
                    ->title(self::trans('save_failed'))
                    ->body(self::trans('save_failed_body'))
                    ->warning()
                    ->send();
            } catch (Throwable) {
            }
        }
    }

    private static function preview(mixed $state): string
    {
        try {
            $registry = app(ThemeRegistry::class);
            $choice = ConfigOptions::choice($state) ?? self::selector()?->defaultChoice() ?? ConfigOptions::defaultTheme([]);

            return FileIconsPlugin::themePreview($registry, $registry->config(), $choice, self::trans('badge'));
        } catch (Throwable) {
            return '';
        }
    }

    private static function userId(?Model $record): ?int
    {
        $id = $record?->getKey() ?? ThemeSelector::currentUserId();

        return is_int($id) || (is_string($id) && ctype_digit($id)) ? (int) $id : null;
    }

    private static function selector(): ?ThemeSelector
    {
        try {
            return app(ThemeSelector::class);
        } catch (Throwable) {
            return null;
        }
    }

    private static function preferences(): ?UserPreferences
    {
        try {
            return app(UserPreferences::class);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $replace
     */
    private static function trans(string $key, array $replace = []): string
    {
        $value = trans(self::LANG . $key, $replace);

        return is_string($value) ? $value : $key;
    }
}
