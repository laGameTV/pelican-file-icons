<?php

namespace LaGameTV\FileIcons\Support;

use Closure;
use Illuminate\Database\Connection;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\ConnectionResolverInterface;
use RuntimeException;
use Throwable;

/**
 * Per-user icon theme choice, stored in the plugin's own table (created by the plugin migration).
 *
 * Deliberately not in `users.customization`: the panel's profile page rebuilds that JSON from a
 * fixed list of keys on every save. Fully defensive: a missing table or any database error
 * reads as "no preference" and writes as a no-op; nothing here throws.
 */
final class UserPreferences
{
    public const string TABLE = 'file_icons_user_preferences';

    private ?bool $available = null;

    /** @var array<int, ?string> */
    private array $cache = [];

    /**
     * @param  Closure(): mixed  $database  returns the connection resolver (`db`); resolved lazily, so a missing database never breaks construction
     */
    public function __construct(private readonly Closure $database) {}

    /**
     * Whether the preferences table exists (i.e. the plugin migration ran).
     */
    public function available(): bool
    {
        if ($this->available === null) {
            try {
                $connection = $this->connection();
                $this->available = $connection instanceof Connection && $connection->getSchemaBuilder()->hasTable(self::TABLE);
            } catch (Throwable) {
                $this->available = false;
            }
        }

        return $this->available;
    }

    /**
     * The stored choice (a theme id or 'auto'), null if there is none or it is no longer valid.
     */
    public function get(int $userId): ?string
    {
        if (array_key_exists($userId, $this->cache)) {
            return $this->cache[$userId];
        }

        $theme = null;
        if ($userId > 0 && $this->available()) {
            try {
                $theme = ConfigOptions::choice($this->connection()->table(self::TABLE)->where('user_id', $userId)->value('theme'));
            } catch (Throwable) {
                $theme = null;
            }
        }

        return $this->cache[$userId] = $theme;
    }

    /**
     * Store a choice (a theme id or 'auto'); anything else removes the preference.
     */
    public function set(int $userId, ?string $theme): bool
    {
        $theme = ConfigOptions::choice($theme);
        if ($theme === null) {
            return $this->forget($userId);
        }

        if ($userId <= 0 || !$this->available()) {
            return false;
        }

        try {
            $connection = $this->connection();
            // Nested transactions use savepoints, so a failure here never poisons an outer transaction.
            $connection->transaction(static function (ConnectionInterface $connection) use ($userId, $theme): void {
                $now = now();
                $query = $connection->table(self::TABLE)->where('user_id', $userId);

                if ($query->exists()) {
                    $query->update(['theme' => $theme, 'updated_at' => $now]);
                } else {
                    $connection->table(self::TABLE)->insert(['user_id' => $userId, 'theme' => $theme, 'created_at' => $now, 'updated_at' => $now]);
                }
            });
        } catch (Throwable) {
            unset($this->cache[$userId]);

            return false;
        }

        $this->cache[$userId] = $theme;

        return true;
    }

    public function forget(int $userId): bool
    {
        if ($userId <= 0 || !$this->available()) {
            return false;
        }

        try {
            $connection = $this->connection();
            $connection->transaction(static function (ConnectionInterface $connection) use ($userId): void {
                $connection->table(self::TABLE)->where('user_id', $userId)->delete();
            });
        } catch (Throwable) {
            unset($this->cache[$userId]);

            return false;
        }

        $this->cache[$userId] = null;

        return true;
    }

    private function connection(): ConnectionInterface
    {
        $resolver = ($this->database)();
        if (!$resolver instanceof ConnectionResolverInterface) {
            throw new RuntimeException('No database connection resolver.');
        }

        return $resolver->connection();
    }
}
