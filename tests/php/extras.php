<?php

/*
 * Dumps the curated game-server associations of one theme as JSON so the
 * oracle can apply them (Material: via generateManifest(); Datapack Icons: via
 * the ported Material association semantics), with lower priority than custom
 * associations.
 *
 * usage:  php tests/php/extras.php [material|datapack]
 * stdout: {"fileAssociations": {...}, "folderAssociations": {...}}
 */

use LaGameTV\FileIcons\Icons\GameServerExtras;

require __DIR__ . '/bootstrap.php';

$theme = mit_theme_arg($argv[1] ?? null);

mit_write_json([
    'fileAssociations' => (object) GameServerExtras::fileAssociations($theme),
    'folderAssociations' => (object) GameServerExtras::folderAssociations($theme),
]);
