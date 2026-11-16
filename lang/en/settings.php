<?php

return [
    'sections' => [
        'appearance' => 'Appearance',
        'appearance_description' => 'Which icons the file manager shows for files and folders.',
        'detection' => 'Detection',
        'detection_description' => 'Icons for files that the icon themes do not recognise by their name alone.',
        'material' => 'Material Icon Theme options',
        'material_description' => 'Fine-tuning for the Material Icon Theme only, with the same options and syntax as in VS Code. The defaults are fine for most panels.',
        'preview' => 'Preview',
        'preview_description' => 'Typical server files with the settings above, before you save them.',
    ],

    'fields' => [
        'default_theme' => 'Icon theme',
        'default_theme_help' => 'Used for everyone who has not picked a theme in their profile.',
        'allow_user_choice' => 'Let users choose',
        'allow_user_choice_help' => 'Users can choose their own icon theme in their profile (tab "File icons").',
        'folder_theme' => 'Folder icons',
        'folder_theme_help' => 'Applies to both themes.',
        'mime_fallback' => 'Detect files by their content',
        'mime_fallback_help' => 'Files without a known name or extension get an icon based on their content as reported by Wings, e.g. a shell script without ".sh".',
        'game_server_extras' => 'Game-server extras',
        'game_server_extras_help' => 'Extra icons for game-server files that the VS Code themes do not know, e.g. .nbt, .schem, .sk, .vdf and SourceMod plugins.',
        'icon_pack' => 'Framework icons',
        'icon_pack_help' => 'Material\'s "activeIconPack" option. It only changes the icons of framework files such as "*.component.ts" or "*.service.ts" (Angular, React, Vue …). VS Code uses Angular by default; for most game servers it makes no difference.',
        'file_associations' => 'Custom file icons',
        'file_associations_help' => 'Like "material-icon-theme.files.associations" in VS Code: "*.ext" for an extension, "**.ext" to also override file names containing it, "name" or "parent/name" for a file name.',
        'folder_associations' => 'Custom folder icons',
        'folder_associations_help' => 'Like "material-icon-theme.folders.associations" in VS Code: a folder name (or "parent/name") and a folder icon. The variants ".name", "_name", "-name" and "__name__" match as well.',
        'pattern' => 'Pattern',
        'pattern_placeholder' => '*.ext',
        'folder' => 'Folder name',
        'folder_placeholder' => 'backups',
        'icon' => 'Icon',
        'folder_icon' => 'Folder icon',
        'icon_search' => 'Type to search icons',
        'add_file_association' => 'Add file icon',
        'add_folder_association' => 'Add folder icon',
    ],

    'themes' => [
        'material' => 'Material Icon Theme',
        'material_description' => 'The icons of the VS Code Material Icon Theme, for more than a thousand file types.',
        'datapack' => 'Datapack Icons',
        'datapack_description' => 'Pixel-art Minecraft icons by FuncFusion.',
        'auto' => 'Automatic',
        'auto_description' => 'Datapack Icons on Minecraft servers, Material Icon Theme everywhere else.',
    ],

    'folder_themes' => [
        'specific' => 'Specific folder icons',
        'specific_description' => 'Known folders get their own icon, e.g. plugins, config or logs. Other folders get the theme\'s plain folder icon.',
        'classic' => 'Generic folder icon',
        'classic_description' => 'All folders get the theme\'s plain folder icon, except your custom folder icons and the game-server extras.',
        'none' => 'Keep the panel\'s folder icons',
        'none_description' => 'Folders keep the panel\'s original icon. Only files get new icons.',
    ],

    'icon_packs' => [
        'none' => 'None',
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
        'default' => 'Default',
        'minecraft' => 'Minecraft servers',
        'other' => 'Other servers',
        'mime' => 'Detected by its content (:mime)',
    ],

    'validation' => [
        'pattern' => 'Only letters, digits, spaces and . _ * + @ ~ / - are allowed (max. 128 characters).',
        'folder' => 'Only letters, digits, spaces and . _ + @ ~ / - are allowed (max. 128 characters).',
        'duplicate_pattern' => 'This pattern is used more than once (upper and lower case count as the same).',
        'duplicate_folder' => 'This folder name is used more than once (upper and lower case count as the same).',
    ],

    'notices' => [
        'hidden_title' => 'Some custom icons from .env are not shown',
        'hidden' => '{1} 1 custom icon entry from .env can\'t be shown here (unknown icon, invalid pattern, empty value or duplicate). Saving removes it.|[2,*] :count custom icon entries from .env can\'t be shown here (unknown icon, invalid pattern, empty value or duplicate). Saving removes them.',
    ],

    'notifications' => [
        'saved' => 'File Icons settings saved',
        'removed' => '{1} 1 custom icon entry that the form couldn\'t show was removed.|[2,*] :count custom icon entries that the form couldn\'t show were removed.',
        'save_failed' => 'File Icons settings could not be saved',
    ],
];
