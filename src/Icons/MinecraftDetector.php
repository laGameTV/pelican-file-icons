<?php

namespace LaGameTV\FileIcons\Icons;

/**
 * Decides whether an egg runs a Minecraft (Java, Bedrock or proxy) server, used by the
 * "automatic" theme choice. Pure PHP: the caller passes the egg's name, tags and features.
 */
final class MinecraftDetector
{
    /**
     * Server software whose eggs are Minecraft eggs: whole words, except for the Bedrock servers
     * Nukkit and PocketMine, which also match inside a name ("PowerNukkitX", "PocketmineMP").
     */
    private const string NAME_PATTERN = '/\b(minecraft|paper|purpur|spigot|bukkit|folia|forge|neoforge|fabric|quilt|sponge|velocity|bungee ?cord|waterfall|bedrock)\b|nukkit|pocketmine/i';

    /** Egg features that only Minecraft eggs use. */
    private const array FEATURES = ['eula', 'java_version'];

    /**
     * @param  array<mixed>  $tags  egg tags
     * @param  array<mixed>  $features  egg features
     */
    public static function matches(string $eggName, array $tags, array $features): bool
    {
        foreach ($tags as $tag) {
            if (is_string($tag) && stripos($tag, 'minecraft') !== false) {
                return true;
            }
        }

        foreach ($features as $feature) {
            if (is_string($feature) && in_array(strtolower(trim($feature)), self::FEATURES, true)) {
                return true;
            }
        }

        return preg_match(self::NAME_PATTERN, $eggName) === 1;
    }
}
