# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-16

### Added

- File and folder icons from VS Code icon themes in the server file manager, both in the folder list and in
  the search results.
- Two complete icon themes, each used as a whole:
  - **Material Icon Theme** 5.40.0 (`material-icon-theme`), with light variants that follow the panel's
    light and dark mode.
  - **Datapack Icons** 5.0.0 by FuncFusion (`SuperAnt.mc-dp-icons`), pixel-art icons in the style of
    Minecraft. Its expanded-folder icons are also used for the file manager's collapsed folders.
- **Automatic** theme: Datapack Icons on Minecraft servers, Material Icon Theme everywhere else. A server
  counts as a Minecraft server if its egg has a `minecraft` tag, the `eula` or `java_version` feature, or a
  Minecraft server software in its name (such as Paper, Forge, Fabric, Velocity, PocketmineMP or
  PowerNukkitX).
- A **File icons** tab in the user profile, where every user can pick their own icon theme or keep the
  panel default. Admins choose the default theme and whether users may change it. The choices are stored in
  the plugin's own `file_icons_user_preferences` table, which is created on install and dropped on
  uninstall.
- Icons are resolved the same way as in VS Code with the theme's default settings: parent-qualified file
  names, file names, the longest file extension, VS Code language associations (VS Code 1.146.0), then the
  default icon. Folders use parent-qualified folder names, then folder names.
- Admin settings, stored in the panel's `.env` as `FILE_ICONS_*` variables, in four sections:
  - **Appearance:** the icon theme, whether users may choose their own, and the folder icons (specific, one
    generic icon, or the panel's own folder icons).
  - **Detection:** a fallback that picks icons from the file type detected by Wings, and game-server extras
    for files and folders that the VS Code themes don't know, such as `.nbt`, `.schem`, `.sk`, `.vdf` and
    SourceMod plugins, with matching icons in each theme.
  - **Material Icon Theme options:** framework icons (Material's `activeIconPack`) and custom file and folder
    icons, with the same syntax as Material's `files.associations` and `folders.associations` in VS Code
    and an icon picker that shows the icons. Each pattern and folder name can only be used once. Entries in
    `.env` that the form can't show (unknown icons, invalid patterns, empty file values, duplicates) are
    counted in a notice and removed when the form is saved.
  - **Preview:** typical server files in both themes, updated live with the unsaved settings.
- Icons are embedded in the page as `data:` URIs by default, so a folder with many files doesn't need one
  request per icon. With `FILE_ICONS_DELIVERY=route`, they are served from a cacheable plugin route
  instead.
- English and German translations.

[1.0.0]: https://github.com/laGameTV/pelican-file-icons/releases/tag/v1.0.0
