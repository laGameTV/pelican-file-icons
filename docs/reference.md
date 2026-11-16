# Reference

Everything about the File Icons settings and how the plugin picks its icons. For installation and a quick
overview, see the [README](../README.md).

- [Settings](#settings)
- [Custom file and folder icons](#custom-file-and-folder-icons)
- [Game-server extras](#game-server-extras)
- [Detecting files by their content](#detecting-files-by-their-content)
- [Icon themes](#icon-themes)
- [How icons are matched](#how-icons-are-matched)
- [Icon delivery](#icon-delivery)
- [Database table](#database-table)
- [Limitations](#limitations)

## Settings

The settings are stored in the panel's `.env`, like those of the official Pelican plugins. You can change them
in the settings form or edit `.env` directly.

| Setting | Environment variable | Default | Values |
|---|---|---|---|
| Icon theme | `FILE_ICONS_DEFAULT_THEME` | `material` | `material`, `datapack`, `auto` |
| Let users choose | `FILE_ICONS_ALLOW_USER_CHOICE` | `true` | `true`, `false` |
| Folder icons | `FILE_ICONS_FOLDER_THEME` | `specific` | `specific`, `classic` (one generic icon), `none` (keep the panel's icons) |
| Detect files by their content | `FILE_ICONS_MIME_FALLBACK` | `true` | `true`, `false` |
| Game-server extras | `FILE_ICONS_GAME_SERVER_EXTRAS` | `true` | `true`, `false` |
| Framework icons | `FILE_ICONS_ICON_PACK` | `angular` | `none`, `angular`, `nest`, `angular_ngrx`, `react`, `react_redux`, `roblox`, `qwik`, `vue`, `vue_vuex`, `bashly` |
| Custom file icons | `FILE_ICONS_FILE_ASSOCIATIONS` | `{}` | JSON object, see [below](#custom-file-and-folder-icons) |
| Custom folder icons | `FILE_ICONS_FOLDER_ASSOCIATIONS` | `{}` | JSON object, see [below](#custom-file-and-folder-icons) |
| Icon delivery (only in `.env`) | `FILE_ICONS_DELIVERY` | `inline` | `inline`, `route`, see [Icon delivery](#icon-delivery) |

Unknown values fall back to the default. The one exception is the framework icons: an unknown value turns them
off, and the form shows *None*.

**Folder icons** apply to both themes. With *Generic folder icon*, all folders get the theme's plain folder
icon, except for your own custom folder icons and the folder icons of the game-server extras (turn off
**Game-server extras** to remove those as well).

**Framework icons** are the Material Icon Theme's `activeIconPack` option. They only change the icons of
web-framework files such as `*.component.ts`, `*.service.ts` or `*.routing.ts` and add a few framework folder
icons. VS Code uses Angular by default.

**Users' own choice:** when **Let users choose** is off, the **File icons** tab is hidden and everyone sees the
admin's theme. Choices that users saved earlier are kept and apply again when the option is turned back on.
Choosing *Panel default* in the profile deletes the user's saved choice.

### Don't cache the configuration

Don't run `php artisan config:cache` or `php artisan optimize`. Pelican's Docker image doesn't build these
caches on purpose: settings live in `.env`, and plugins register their providers and routes at runtime. With a
config cache, Laravel stops reading `.env` and this plugin falls back to its defaults. Saving the plugin
settings runs `php artisan config:clear`, which removes the cache again.

Real environment variables, for example those set under `environment:` in a Docker `compose.yml`, take
precedence over `.env`. The settings form can't change them.

## Custom file and folder icons

Custom icons are a Material Icon Theme feature (`files.associations` and `folders.associations` in VS Code), so
they only apply while the Material Icon Theme is shown. Datapack Icons always uses its own mappings. Your custom
icons override the built-in icons and the game-server extras.

### File icons

A file icon maps a pattern to a Material icon name. The icon names are the file names in
`resources/icons/material` without `.svg`, for example `minecraft`, `settings` or `json`. The icon picker in
the settings form lets you search them. Patterns are case-insensitive.

| Pattern | Matches | Example |
|---|---|---|
| `*.ext` | files ending in `.ext`, including multi-part extensions like `*.d.ts` | `"*.sk": "minecraft"` |
| `**.ext` | like `*.ext`, but also overrides built-in file-name icons that contain `.ext` (`"**.yml"` also changes `docker-compose.yml`) | `"**.yml": "settings"` |
| `name` | files with exactly this name | `"server.properties": "minecraft"` |
| `parent/name` | files with this name directly inside a folder called `parent` | `"plugins/config.yml": "settings"` |

### Folder icons

A folder icon maps a folder name to a Material folder icon. In the form you pick the icon itself, for example
`folder-global`. In `.env` and in VS Code, the value is the icon name without `folder-`: `"world": "global"`
uses `folder-global`, and an empty value (`""`) uses the plain folder icon. Like in Material, each entry also
matches the variants `.world`, `_world`, `-world` and `__world__`, and `parent/name` works for folders too.

### Editing them in `.env`

Each value is a single-line JSON object in single quotes. You can paste the objects from the VS Code settings
`material-icon-theme.files.associations` and `material-icon-theme.folders.associations`:

```dotenv
FILE_ICONS_FILE_ASSOCIATIONS='{"server.properties":"minecraft","*.lck":"lock"}'
FILE_ICONS_FOLDER_ASSOCIATIONS='{"world":"global","backups":""}'
```

The values must not contain single quotes or backslashes. Invalid JSON counts as `{}`.

An empty file icon value removes the built-in icon of a pattern, as in Material: with `"*.yml": ""`, `.yml`
files fall back to the next rule, here the YAML language icon. This only works in `.env`.

### What the form does with your entries

Each pattern and each folder name can only be used once in the form (upper and lower case count as the same).
The form can't show some entries from `.env`: unknown icons, invalid patterns or folder names, empty file values
and entries that only differ from a later one in upper and lower case. It leaves them out, shows a notice with
their number, and removes them from `.env` when you save. Apart from the empty file values, they had no effect
anyway.

### Light mode

Material only has light variants for its built-in mappings. A custom icon is shown as it is, and a built-in
light mapping for the same name or extension still wins in light mode, exactly as in VS Code. For example,
`"*.toml": "yaml"` shows the YAML icon in dark mode and `toml_light` in light mode.

## Game-server extras

These icons fill gaps for files and folders that the VS Code themes don't know. They are on by default, and
each theme has its own list that only uses that theme's icons. Folder entries also match the `.name`, `_name`,
`-name` and `__name__` variants. With the Material Icon Theme, your own custom icons override them.

### Material Icon Theme

| Files | Icon |
|---|---|
| `*.nbt`, `*.snbt`, `*.schem`, `*.schematic`, `*.litematic`, `*.sk` | `minecraft` |
| `*.dat_old` | `hex` |
| `*.phar` | `php` |
| `*.sp`, `*.sma`, `*.smx`, `*.amxx` | `pawn` |
| `*.vdf`, `*.acf` | `settings` |
| `*.vpk`, `*.pak` | `zip` |
| `*.service`, `*.socket`, `*.timer`, `*.target`, `*.mount` | `systemd` |

| Folders | Icon |
|---|---|
| `crash-reports` | `folder-log` |
| `resourcepacks`, `datapacks` | `folder-resource` |
| `defaultconfigs`, `serverconfig` | `folder-config` |
| `kubejs` | `folder-scripts` |

### Datapack Icons

| Files | Icon |
|---|---|
| `*.snbt`, `*.dat_old`, `*.mca`, `*.mcr` | `nbt_file` |
| `*.schem`, `*.schematic`, `*.litematic` | `structure_file` |
| `*.phar` | `php_file` |
| `*.vdf`, `*.acf`, `*.vpk`, `*.sp`, `*.smx`, `*.sma`, `*.amxx` | `valve_file` |
| `*.service`, `*.socket`, `*.timer`, `*.target`, `*.mount` | `config_file` |

| Folders | Icon |
|---|---|
| `crash-reports` | `log_folder` |
| `resourcepacks` | `assets_folder_closed` |
| `defaultconfigs`, `serverconfig` | `config_folder` |
| `kubejs` | `javascript_folder` |
| `world_nether`, `world_the_end` | `worldgen_folder` |
| `libraries` | `jar_folder` |

## Detecting files by their content

Wings detects the type (MIME type) of each file from its content. If a file's name doesn't match anything and
it would get the theme's default file icon, the plugin uses its type instead. `text/plain` and
`application/octet-stream` are never used.

| MIME type | Material Icon Theme | Datapack Icons |
|---|---|---|
| `text/x-shellscript` | `console` | `shell_file` |
| `text/x-python` | `python` | `python_file` |
| `text/x-perl` | `perl` | `perl_file` |
| `text/x-php` | `php` | `php_file` |
| `text/javascript`, `application/javascript` | `javascript` | `javascript_file` |
| `text/x-lua` | `lua` | `lua_file` |
| `text/x-ruby` | `ruby` | `ruby_file` |
| `text/x-tcl` | `tcl` | – |
| `application/json`, `application/x-ndjson` | `json` | `json_file` |
| `text/xml`, `application/xml` | `xml` | `xml_file` |
| `text/html` | `html` | `html_file` |
| `image/svg+xml` | `svg` | `image_file` |
| `image/*` | `image` | `image_file` |
| `text/csv`, `text/tab-separated-values` | `table` | `excel_file` |
| `application/zip`, `application/gzip`, `application/x-gzip`, `application/x-tar`, `application/x-7z-compressed`, `application/x-xz`, `application/x-bzip2`, `application/x-rar-compressed`, `application/vnd.rar`, `application/zstd` | `zip` | `archive_file` |
| `application/java-archive` | `jar` | `jar_file` |
| `application/x-executable`, `application/x-elf`, `application/x-mach-binary`, `application/vnd.microsoft.portable-executable`, `application/x-msdownload` | `exe` | `executable_file` |
| `application/x-sharedlib` | `dll` | `binary_file` |
| `application/pdf` | `pdf` | `pdf_file` |
| `audio/*` | `audio` | `audio_file` |
| `video/*` | `video` | `video_file` |
| `application/x-sqlite3`, `application/vnd.sqlite3` | `database` | `database_file` |
| `font/*` | `font` | `font_file` |

## Icon themes

### Material Icon Theme

Version 5.40.0 with all its file and folder mappings and its light variants for icons that would be hard to see
on a light background. Files that VS Code only knows by their language use VS Code's built-in language
associations, for example `Jenkinsfile.prod` is Groovy.

### Datapack Icons

Version 5.0.0 by FuncFusion. It has no light variants and no language mappings, so files are matched by name
and extension only, exactly like in VS Code.

There is one deliberate difference: Datapack Icons only defines its specific folder icons for *opened* folders.
In VS Code, all closed folders share the generic icon, except `data`, `assets` and `src`. The file manager only
shows closed folders, so the plugin uses the opened-folder icons for them, while the three closed-folder icons
keep priority. A `plugins` folder therefore looks like an opened `plugins` folder in VS Code.

The theme's dynamic features need its VS Code extension and aren't available: special icons for functions listed
in `tick.json` and `load.json`, namespace and overlay folder icons, icons for nested subfolders, and the Christmas
icons.

### Automatic

Uses Datapack Icons on Minecraft servers and the Material Icon Theme everywhere else. A server counts as a
Minecraft server if its egg

- has a tag that contains `minecraft` (in any case),
- has the `eula` or `java_version` feature (Pelican's Minecraft EULA and Java version helpers), or
- has one of these words in its name: Minecraft, Paper, Purpur, Spigot, Bukkit, Folia, Forge, NeoForge, Fabric,
  Quilt, Sponge, Velocity, BungeeCord, Waterfall or Bedrock, or contains Nukkit or PocketMine anywhere in its
  name (such as `PowerNukkitX` or `PocketmineMP`).

### Which theme a user sees

1. The theme from the user's **File icons** tab, if **Let users choose** is on and the user picked one.
2. Otherwise the **Icon theme** from the settings.
3. *Automatic* is decided per server, from the server's egg.

## How icons are matched

The plugin matches icons the same way VS Code does with the selected theme and its default settings. Names are
compared case-insensitively, and only the folder that directly contains an entry counts as its parent.

For **files**, the first match wins:

1. **File name inside a specific folder.** In Material, `postcssrc.json` inside `.config` gets the PostCSS
   icon. In Datapack Icons, `tick.json` inside `function` gets the tick icon.
2. **File name.** `package.json` gets the Node.js icon in Material and the npm icon in Datapack Icons.
3. **Longest extension.** Every part after a dot is tried, starting at the first dot, so `index.d.ts` tries
   `d.ts` before `ts`. Dotfiles count too: `.env` matches the `env` extension. An extension that is tied to a
   folder beats a plain one of the same length: in Datapack Icons, a `.json` file directly inside an
   `advancement` folder gets the advancement icon.
4. **Language** (Material only). The language comes from VS Code 1.146.0's built-in language associations
   (exact file names, file-name patterns, then extensions). `Jenkinsfile.prod` is Groovy, and `.git/config` is a
   properties file, so it gets the settings icon.
5. **Content type**, if **Detect files by their content** is on (see above).
6. **Default file icon.**

For **folders**, the order is: folder name inside a specific folder (`.github/workflows` gets the GitHub
workflows icon in Material), then the folder name (`src`, `.src`, `_src`, `-src` and `__src__` all get the
`src` icon), then the default folder icon.

Framework icons and custom icons are applied the same way the Material Icon Theme applies its `activeIconPack`,
`files.associations` and `folders.associations` settings. When two rules are equally specific, VS Code's CSS
rule order decides, and the plugin reproduces that order too.

The test suite checks all of this against an independent model of VS Code, built from VS Code's source code
and fed with Material's real generated manifest and Datapack Icons' real theme file.

### Panel integration

The plugin doesn't replace any page of the panel. It hooks into the file list (`ListFiles`) and the search
results (`SearchFiles`):

- While these pages render, it swaps the icon of the table's `name` column, through a Livewire `render`
  listener (or a `modifyTable()` hook, should a future panel version add one to these pages).
- If anything goes wrong while an icon is resolved, the panel's original icon is shown and the error is logged.
- Each icon is an `<img>`. Icons with a light variant get a second `<img>`, and a small stylesheet shows the
  right one for the current light or dark mode.
- The **File icons** profile tab uses the panel's `EditProfile::registerCustomTabs()` hook.

## Icon delivery

- `inline` (default): the icons are embedded in the page as compact `data:` URIs. Each icon is only encoded once
  per request, and the browser makes no extra requests. This is the fastest option for folders with many files.
- `route`: the page links the icons from `GET /file-icons/{hash}/{theme}/{icon}.svg`, and the browser downloads
  each icon once and caches it. Pages get smaller, but the first visit makes one request per distinct icon.

About the route:

- `{hash}` is the first 12 hex characters of a SHA-256 over the theme's generated data and icons, so it changes
  whenever the icons change. Responses for the current hash are cached for a year
  (`Cache-Control: public, max-age=31536000, immutable`); requests with an outdated hash still work but are only
  cached for a few minutes.
- It only serves the icons of the two themes. Anything else returns 404.
- It uses no session or cookies, and every response carries `X-Content-Type-Options: nosniff` and a sandboxing
  `Content-Security-Policy`.
- A route cache (`php artisan route:cache`) that was built before the plugin was enabled doesn't contain the
  route. The plugin then embeds the icons instead. Rebuild or clear the route cache to use the route again.

## Database table

Installing the plugin creates the table `file_icons_user_preferences`. It holds one row per user who picked
their own theme, and nothing else. The plugin doesn't change any of the panel's own tables. When a user is
deleted, their row is deleted too.

Uninstalling the plugin drops the table, so the users' choices are lost. Disabling the plugin keeps it. If the
table is missing, for example because the migration didn't run, everyone sees the admin's theme, and saving a
choice in the profile shows a warning.

## Limitations

- Only closed-folder icons are used, because the file manager has no expanded folders.
- Only the direct parent folder is taken into account, as in VS Code. A custom icon for `a/b/name` never
  matches.
- Languages aren't detected from the file content (VS Code's explorer doesn't do that either). The content-type
  fallback covers part of that gap.
- Symlinks are matched by their own name; their target isn't inspected. Wings reports a symlink to a folder as a
  file, so it gets a file icon.
- In light mode, a few files with several dots get a different icon than in dark mode, exactly as in VS Code. For
  example, `foo.pdm.toml` shows the PDM icon in dark mode and `toml_light` in light mode.
- Theme settings that only affect the VS Code extensions aren't supported: Material's icon colours, opacity,
  saturation, custom clones, `languages.associations` and root-folder settings, and the dynamic features of
  Datapack Icons.
- Only the name column of the file manager changes. Breadcrumbs, the file editor and other pages keep the panel's
  icons.
