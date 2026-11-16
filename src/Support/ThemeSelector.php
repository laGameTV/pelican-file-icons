<?php

namespace LaGameTV\FileIcons\Support;

use App\Models\Egg;
use App\Models\Server;
use Filament\Facades\Filament;
use Illuminate\Contracts\Auth\Authenticatable;
use LaGameTV\FileIcons\Icons\MinecraftDetector;
use LaGameTV\FileIcons\Icons\Themes;
use Throwable;

/**
 * Picks the icon theme for the current request: the user's own choice (if users may choose),
 * otherwise the admin's default; 'auto' becomes Datapack Icons on Minecraft servers (detected
 * from the current tenant's egg) and the Material Icon Theme everywhere else.
 */
final class ThemeSelector
{
    /** @var array<string, string> */
    private array $current = [];

    /** @var array<string, bool> */
    private array $minecraft = [];

    public function __construct(
        private readonly ThemeRegistry $registry,
        private readonly UserPreferences $preferences,
    ) {}

    /**
     * The admin's default choice: a theme id or 'auto'.
     */
    public function defaultChoice(): string
    {
        return ConfigOptions::defaultTheme($this->registry->config());
    }

    public function allowsUserChoice(): bool
    {
        return ConfigOptions::allowsUserChoice($this->registry->config());
    }

    /**
     * The user's own choice (a theme id or 'auto'), null if there is none or users may not choose.
     */
    public function userChoice(?int $userId): ?string
    {
        if ($userId === null || !$this->allowsUserChoice()) {
            return null;
        }

        return $this->preferences->get($userId);
    }

    /**
     * Effective theme id for the current user and server (cached per request).
     */
    public function current(): string
    {
        $userId = self::currentUserId();
        $server = self::currentServer();
        $key = ($userId ?? 0) . '|' . ($server?->getKey() ?? '');

        return $this->current[$key] ??= $this->resolve($this->userChoice($userId) ?? $this->defaultChoice(), $server);
    }

    /**
     * Theme id for a choice; 'auto' depends on the server.
     */
    public function resolve(string $choice, ?Server $server): string
    {
        $choice = ConfigOptions::choice($choice) ?? Themes::MATERIAL;

        if ($choice !== ConfigOptions::AUTO) {
            return $choice;
        }

        return $this->isMinecraftServer($server) ? Themes::DATAPACK : Themes::MATERIAL;
    }

    public function isMinecraftServer(?Server $server): bool
    {
        if ($server === null) {
            return false;
        }

        $key = (string) $server->getKey();

        return $this->minecraft[$key] ??= self::detect($server);
    }

    public static function currentUserId(): ?int
    {
        try {
            $user = Filament::auth()->user();
        } catch (Throwable) {
            $user = null;
        }

        try {
            $user ??= auth()->user();
        } catch (Throwable) {
            return null;
        }

        if (!$user instanceof Authenticatable) {
            return null;
        }

        $id = $user->getAuthIdentifier();

        return is_int($id) || (is_string($id) && ctype_digit($id)) ? (int) $id : null;
    }

    private static function currentServer(): ?Server
    {
        try {
            $tenant = Filament::getTenant();
        } catch (Throwable) {
            return null;
        }

        return $tenant instanceof Server ? $tenant : null;
    }

    private static function detect(Server $server): bool
    {
        try {
            // The relation may be missing (deleted egg); getRelationValue() does not promise an Egg.
            $egg = $server->getRelationValue('egg');
            if (!$egg instanceof Egg) {
                return false;
            }

            return MinecraftDetector::matches($egg->name, $egg->tags, $egg->inherit_features ?? $egg->features ?? []);
        } catch (Throwable) {
            return false;
        }
    }
}
