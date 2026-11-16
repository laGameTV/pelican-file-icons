<?php

return [
    'sections' => [
        'appearance' => 'Darstellung',
        'appearance_description' => 'Welche Symbole der Dateimanager für Dateien und Ordner anzeigt.',
        'detection' => 'Erkennung',
        'detection_description' => 'Symbole für Dateien, die die Symboldesigns nicht allein am Namen erkennen.',
        'material' => 'Optionen für das Material Icon Theme',
        'material_description' => 'Feineinstellungen nur für das Material Icon Theme, mit denselben Optionen und derselben Syntax wie in VS Code. Für die meisten Panels passen die Standardwerte.',
        'preview' => 'Vorschau',
        'preview_description' => 'Typische Serverdateien mit den Einstellungen oben, noch bevor Sie sie speichern.',
    ],

    'fields' => [
        'default_theme' => 'Symboldesign',
        'default_theme_help' => 'Gilt für alle, die in ihrem Profil kein eigenes Design gewählt haben.',
        'allow_user_choice' => 'Benutzer dürfen wählen',
        'allow_user_choice_help' => 'Benutzer können in ihrem Profil (Tab „Dateisymbole“) ein eigenes Symboldesign wählen.',
        'folder_theme' => 'Ordnersymbole',
        'folder_theme_help' => 'Gilt für beide Designs.',
        'mime_fallback' => 'Dateien am Inhalt erkennen',
        'mime_fallback_help' => 'Dateien ohne bekannten Namen oder bekannte Endung erhalten ein Symbol passend zu ihrem Inhalt, wie Wings ihn erkennt, z. B. ein Shell-Skript ohne „.sh“.',
        'game_server_extras' => 'Extras für Gameserver',
        'game_server_extras_help' => 'Zusätzliche Symbole für Gameserver-Dateien, die die VS-Code-Designs nicht kennen, z. B. .nbt, .schem, .sk, .vdf und SourceMod-Plugins.',
        'icon_pack' => 'Framework-Symbole',
        'icon_pack_help' => 'Die Option „activeIconPack“ von Material. Sie ändert nur die Symbole von Framework-Dateien wie „*.component.ts“ oder „*.service.ts“ (Angular, React, Vue …). VS Code verwendet standardmäßig Angular; für die meisten Gameserver macht es keinen Unterschied.',
        'file_associations' => 'Eigene Dateisymbole',
        'file_associations_help' => 'Wie „material-icon-theme.files.associations“ in VS Code: „*.ext“ für eine Endung, „**.ext“, um zusätzlich Dateinamen zu überschreiben, die sie enthalten, „name“ oder „ordner/name“ für einen Dateinamen.',
        'folder_associations' => 'Eigene Ordnersymbole',
        'folder_associations_help' => 'Wie „material-icon-theme.folders.associations“ in VS Code: ein Ordnername (oder „ordner/name“) und ein Ordnersymbol. Die Varianten „.name“, „_name“, „-name“ und „__name__“ passen ebenfalls.',
        'pattern' => 'Muster',
        'pattern_placeholder' => '*.ext',
        'folder' => 'Ordnername',
        'folder_placeholder' => 'backups',
        'icon' => 'Symbol',
        'folder_icon' => 'Ordnersymbol',
        'icon_search' => 'Tippen, um Symbole zu suchen',
        'add_file_association' => 'Dateisymbol hinzufügen',
        'add_folder_association' => 'Ordnersymbol hinzufügen',
    ],

    'themes' => [
        'material' => 'Material Icon Theme',
        'material_description' => 'Die Symbole des VS-Code-Designs Material Icon Theme, für über tausend Dateitypen.',
        'datapack' => 'Datapack Icons',
        'datapack_description' => 'Minecraft-Symbole im Pixel-Art-Stil von FuncFusion.',
        'auto' => 'Automatisch',
        'auto_description' => 'Datapack Icons auf Minecraft-Servern, sonst das Material Icon Theme.',
    ],

    'folder_themes' => [
        'specific' => 'Passende Ordnersymbole',
        'classic' => 'Einheitliches Ordnersymbol',
        'none' => 'Ordnersymbole des Panels behalten',
    ],

    'icon_packs' => [
        'none' => 'Keine',
        'angular' => 'Angular',
        'nest' => 'NestJS',
        'angular_ngrx' => 'Angular + NgRx',
        'react' => 'React',
        'react_redux' => 'React + Redux',
        'roblox' => 'Roblox',
        'qwik' => 'Qwik',
        'vue' => 'Vue',
        'vue_vuex' => 'Vue + Vuex',
        'bashly' => 'Bashly',
    ],

    'preview' => [
        'default' => 'Standard',
        'minecraft' => 'Minecraft-Server',
        'other' => 'Andere Server',
        'mime' => 'Am Inhalt erkannt (:mime)',
    ],

    'validation' => [
        'pattern' => 'Erlaubt sind nur Buchstaben, Ziffern, Leerzeichen und . _ * + @ ~ / - (max. 128 Zeichen).',
        'folder' => 'Erlaubt sind nur Buchstaben, Ziffern, Leerzeichen und . _ + @ ~ / - (max. 128 Zeichen).',
        'duplicate_pattern' => 'Dieses Muster kommt mehrfach vor (Groß- und Kleinschreibung zählen als gleich).',
        'duplicate_folder' => 'Dieser Ordnername kommt mehrfach vor (Groß- und Kleinschreibung zählen als gleich).',
    ],

    'notices' => [
        'hidden_title' => 'Einige eigene Symbole aus der .env werden nicht angezeigt',
        'hidden' => '{1} 1 Eintrag für eigene Symbole aus der .env kann hier nicht angezeigt werden (unbekanntes Symbol, ungültiges Muster, leerer Wert oder doppelt). Beim Speichern wird er entfernt.|[2,*] :count Einträge für eigene Symbole aus der .env können hier nicht angezeigt werden (unbekanntes Symbol, ungültiges Muster, leerer Wert oder doppelt). Beim Speichern werden sie entfernt.',
    ],

    'notifications' => [
        'saved' => 'Einstellungen von File Icons gespeichert',
        'removed' => '{1} 1 Eintrag für eigene Symbole, den das Formular nicht anzeigen konnte, wurde entfernt.|[2,*] :count Einträge für eigene Symbole, die das Formular nicht anzeigen konnte, wurden entfernt.',
        'save_failed' => 'Einstellungen von File Icons konnten nicht gespeichert werden',
    ],
];
