# File Icons

Replaces the file and folder icons in the Pelican Panel file manager with the icons of a VS Code icon theme.
Two complete themes are included: the [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme)
and [Datapack Icons](https://github.com/FuncFusion/mc-dp-icons), a pixel-art theme in the style of Minecraft.
Icons are picked the same way VS Code picks them with the theme's default settings, so `package.json`,
`docker-compose.yml`, `.github/workflows` or `pack.mcmeta` look the same as in your editor.

## Features

- Two icon themes, always used as a whole and never mixed:
  - **Material Icon Theme** 5.40.0: about 960 file and folder icons, with light variants where Material
    has them.
  - **Datapack Icons** 5.0.0 by FuncFusion: about 310 pixel-art icons for Minecraft data packs, resource
    packs and common development files.
- **Automatic** mode: Datapack Icons on Minecraft servers, Material Icon Theme on all other servers.
- Every user can choose their own theme in a **File icons** tab in their profile. Admins pick the default
  and can turn the choice off.
- Icons are resolved like VS Code does: parent-qualified file names, file names, the longest file
  extension, then VS Code's built-in language associations (VS Code 1.146.0). Folders use parent-qualified
  names, then folder names.
- Material Icon Theme options: framework icons (Material's `activeIconPack`), and custom file and folder
  icons. These use the same syntax as `material-icon-theme.files.associations` and
  `material-icon-theme.folders.associations`, so you can copy them from your VS Code settings.
- Folder icons: specific icons, one generic folder icon, or the panel's own folder icons.
- Optional game-server extras: icons for files and folders that the VS Code themes don't know, such as
  Minecraft schematics and NBT files, Skript scripts, SourceMod and AMX Mod X plugins, Valve KeyValues files
  and systemd units.
- Optional MIME-type fallback. Wings detects each file's type from its content, so a file without a known
  name or extension still gets a matching icon, for example an extension-less shell script with a shebang.
- Fast: icons are embedded in the page by default, so a folder with hundreds of files doesn't cause hundreds
  of extra requests.
- A live preview in the settings shows sample entries in both themes before you save.
- Covers both the folder listing and the search results of the server file manager.
- Follows the panel's light and dark mode.
- Runs on PHP only. There's no Node.js, Vite build or `public/` directory on the panel host.
- English and German translations.

## Requirements

- Pelican Panel 1.0.0 release candidate (tested with `v1.0.0-rc.3`), which ships Filament 5 and Livewire 4.
- PHP 8.4 or newer (the panel already requires it).
- No Node.js or Yarn. The plugin has no frontend build. Pelican still runs its asset build when a plugin is
  installed. For non-theme plugins, a failure there is only logged, unless the panel's plugin dev mode
  (`PANEL_PLUGIN_DEV_MODE=true`) is on: then the install fails on a host without Yarn.

## Installation

The plugin folder must be named `file-icons`, which is the plugin id. Pelican refuses to load it under any
other name.

### Import a zip (recommended)

1. Sign in to GitHub with an account that has access to the repository, and download
   `file-icons-<version>.zip` from the [GitHub releases](https://github.com/laGameTV/pelican-file-icons/releases).
2. In the admin area, open **Plugins**, click **Import from File** and upload the zip.
3. On the *File Icons* row, open the actions menu and choose **Install**. The install runs as a background
   job, so the panel's queue worker must be running. Installing also enables the plugin.

The repository is private, so **Import from URL** doesn't work with the release link: the panel would have to
sign in to GitHub. It only works if you host the zip somewhere the panel can download it without logging in.

### Install with git

The repository is private, so the server needs read access to it. Use one of these:

- **Deploy key (SSH):** add the server's public SSH key as a read-only deploy key in the repository settings
  and clone `git@github.com:laGameTV/pelican-file-icons.git`. Deploy keys only work over SSH.
- **Fine-grained personal access token (HTTPS):** create a token with read-only access to the *Contents* of
  this repository, clone `https://github.com/laGameTV/pelican-file-icons.git`, and enter the token when git
  asks for the password.

```bash
cd /var/www/pelican/plugins
git clone git@github.com:laGameTV/pelican-file-icons.git file-icons   # or the HTTPS URL with a token
chown -R www-data:www-data file-icons    # use your web server user
cd /var/www/pelican
php artisan p:plugin:install file-icons  # installs and enables the plugin
```

Instead of running the last command, you can also choose **Install** from the plugin's actions menu in the admin
area.

The panel stores the plugin's status in a `meta` block that it writes into `plugin.json`. That's why the
plugin folder must be writable by the web server user, and why `git status` shows `plugin.json` as modified.
Never commit that change, and keep it when you update (`git stash` before the pull, `git stash pop` after it).
If you lose the `meta` block, the panel considers the plugin not installed.

Two things to know when you run git in the plugin folder later:

- After the `chown`, the folder belongs to the web server user. Git refuses to work in a repository that
  belongs to another user (`fatal: detected dubious ownership in repository`). To run git as root anyway,
  allow the folder once with
  `git config --global --add safe.directory /var/www/pelican/plugins/file-icons`.
- Git recreates every file it changes, owned by the user who runs it. If you run git as root, run the `chown`
  again afterwards, or the panel can't write `plugin.json` any more (enabling, disabling and uninstalling the
  plugin then fail). Alternatively, run git as the web server user (`sudo -u www-data git ...`); that user
  then needs the deploy key or token, and no `chown` is needed.

### Database table

Installing runs the plugin's migration, which creates the table `file_icons_user_preferences`. It holds
one row per user who picked their own icon theme in their profile, and nothing else. The plugin doesn't
change any of the panel's own tables. When a user is deleted, their row is deleted too.

Uninstalling the plugin (**Uninstall** in the actions menu) rolls the migration back and drops the table, so
the users' choices are lost. Disabling the plugin keeps the table. If the table is missing, for example
because the migration didn't run, everyone sees the admin's theme, and saving a choice in the profile shows
a warning.

### Updating

- **Zip:** import the new zip the same way. When you import over an installed plugin, the panel keeps its
  status and reinstalls it in the background, which also runs new migrations. Your settings live in `.env`
  and are kept.
- **Git:** keep the `meta` block, pull, fix the owner and run new migrations (see
  [Install with git](#install-with-git) for the ownership notes). Pelican's Docker image runs the migrations
  on every start anyway.

  ```bash
  cd /var/www/pelican/plugins/file-icons
  git stash && git pull && git stash pop   # keeps the panel's meta block in plugin.json
  chown -R www-data:www-data .             # only if you ran git as root; use your web server user
  cd /var/www/pelican
  php artisan migrate --force
  ```

The panel's one-click update button isn't available. It needs an `update_url` in `plugin.json` that points to
a publicly reachable `update.json` with the download link of each version. This repository is private, so
`update_url` is `null`. Update by importing the new zip instead. If you publish the zips somewhere public,
`bun run release` prints a matching `update.json` entry.

## Icon themes

### Material Icon Theme

The default theme. It covers a very wide range of programming languages, tools and config files, and it has
light variants for icons that would be hard to see on a light background. All of Material Icon Theme's file
and folder mappings are included, together with VS Code's built-in language associations, which Material
uses for files that only have a language (for example `Jenkinsfile.prod` is Groovy).

### Datapack Icons

A pixel-art theme by FuncFusion with icons for Minecraft data packs and resource packs (`pack.mcmeta`,
`*.mcfunction`, advancements, loot tables, structures, ...) and for common development files. It has no
light variants and doesn't map VS Code languages to icons, so files are matched by name and extension
only, exactly like in VS Code.

One deliberate difference to VS Code: Datapack Icons defines its specific folder icons only for *expanded*
folders. In VS Code, collapsed folders all share the generic folder icon, except `data`, `assets` and `src`.
The panel's file manager only ever shows collapsed folders, so the plugin also uses the expanded-folder icons
for them, and the three collapsed-folder icons keep priority. A `plugins` folder therefore shows the same
icon as an opened `plugins` folder in VS Code. Everything else follows VS Code exactly.

Datapack Icons' extra VS Code features need its extension code and aren't available: special function icons
for functions listed in `tick.json` / `load.json`, namespace and overlay folder icons, icons for nested
subfolders, and the Christmas icons.

### Automatic

Uses Datapack Icons on Minecraft servers and the Material Icon Theme everywhere else. A server counts as a
Minecraft server if its egg

- has a tag that contains `minecraft` (any case), or
- has the `eula` or `java_version` feature (the panel's Minecraft EULA and Java version helpers), or
- has a name with one of these words: Minecraft, Paper, Purpur, Spigot, Bukkit, Folia, Forge, NeoForge,
  Fabric, Quilt, Sponge, Velocity, BungeeCord, Waterfall or Bedrock, or a name that contains Nukkit or
  PocketMine anywhere (such as `PowerNukkitX` or `PocketmineMP`).

## Choosing a theme as a user

Open your profile from the user menu (your avatar in the top right corner) and select the **File icons**
tab. Under **Icon theme**, choose one of these options, then save your profile with the save button (the
floppy-disk icon, or <kbd>Ctrl</kbd>+<kbd>S</kbd>):

| Option | Shows |
|---|---|
| Panel default | the theme the admin chose (the tab shows which one). This is the default. |
| Material Icon Theme | Material Icon Theme on every server |
| Datapack Icons | Datapack Icons on every server |
| Automatic | Datapack Icons on Minecraft servers, Material Icon Theme on all other servers |

The tab also has a preview of typical server files in both themes, which marks the theme you selected. The
choice only changes what you see.

If the admin turns off **Let users choose**, the tab is hidden and everyone sees the admin's theme. Choices
that were saved before are kept and apply again when the option is turned back on. Choosing **Panel default**
deletes your saved choice.

## Settings

To change the settings, open **Plugins** in the admin area and click **Settings** on the *File Icons* row.
The plugin must be enabled for this button to appear. Like the official plugins, the settings are stored in
the panel's `.env`. You can also edit them there directly:

| Setting | Environment variable | Default | Values |
|---|---|---|---|
| Icon theme | `FILE_ICONS_DEFAULT_THEME` | `material` | `material`, `datapack`, `auto` |
| Let users choose | `FILE_ICONS_ALLOW_USER_CHOICE` | `true` | `true`, `false` |
| Folder icons | `FILE_ICONS_FOLDER_THEME` | `specific` | `specific`, `classic`, `none` |
| Detect files by their content | `FILE_ICONS_MIME_FALLBACK` | `true` | `true`, `false` |
| Game-server extras | `FILE_ICONS_GAME_SERVER_EXTRAS` | `true` | `true`, `false` |
| Framework icons | `FILE_ICONS_ICON_PACK` | `angular` | `none`, `angular`, `nest`, `angular_ngrx`, `react`, `react_redux`, `roblox`, `qwik`, `vue`, `vue_vuex`, `bashly` |
| Custom file icons | `FILE_ICONS_FILE_ASSOCIATIONS` | `{}` | JSON object, see below |
| Custom folder icons | `FILE_ICONS_FOLDER_ASSOCIATIONS` | `{}` | JSON object, see below |
| Icon delivery (`.env` only) | `FILE_ICONS_DELIVERY` | `inline` | `inline`, `route` |

Unknown values fall back to the default, except for the framework icons: an unknown icon pack turns them off,
and the form shows *None*.

The form has four sections:

- **Appearance**
  - **Icon theme:** *Material Icon Theme*, *Datapack Icons* or *Automatic* (see [Icon themes](#icon-themes)).
    It applies to everyone who hasn't picked a theme in their profile.
  - **Let users choose:** shows the **File icons** tab in the users' profiles, see
    [Choosing a theme as a user](#choosing-a-theme-as-a-user).
  - **Folder icons:** *Specific folder icons* gives folders like `src`, `config` or `plugins` their own icon.
    *Generic folder icon* uses the theme's plain folder icon for all folders, except for your own custom
    folder icons and the folder icons of the game-server extras (turn off **Game-server extras** to remove
    those too). *Keep the panel's folder icons* leaves folders alone and only changes file icons. This
    applies to both themes.
- **Detection:** **Detect files by their content** (see [MIME-type fallback](#mime-type-fallback)) and
  **Game-server extras** (see [Game-server extras](#game-server-extras)). Both apply to both themes.
- **Material Icon Theme options** (collapsed, unless it has to show a notice about custom icons from `.env`,
  see below): only used by the Material Icon Theme.
  - **Framework icons:** Material's `activeIconPack` option. It only changes the icons of framework files
    such as `*.component.ts`, `*.service.ts` or `*.routing.ts`, and adds a few framework folder icons. VS Code
    uses Angular by default. Most game servers don't contain such files, so you can usually leave it alone.
    *None* turns framework icons off.
  - **Custom file icons** and **Custom folder icons**, see below.
- **Preview:** typical server folders and files, side by side in both themes, with the settings that are
  currently in the form. It updates while you edit, before you save. A badge marks the theme that the
  **Icon theme** setting selects (with *Automatic*: which theme Minecraft servers and other servers get).

### Custom file and folder icons

These are Material Icon Theme settings (`files.associations` and `folders.associations`), so they only apply
when the Material Icon Theme is shown. Datapack Icons always uses its own mappings.

**Custom file icons** map a pattern to a Material icon name. An icon name is a file name in
`resources/icons/material` without `.svg`, for example `minecraft`, `settings` or `json`. In the form, the icon
picker searches these names and shows the icons. Matching is case-insensitive. Unknown icon names are
ignored. Your custom icons override the built-in icons and the game-server extras.

| Pattern | Matches | Example |
|---|---|---|
| `*.ext` | files ending in `.ext` (multi-part extensions such as `*.d.ts` work too) | `"*.sk": "minecraft"` |
| `**.ext` | like `*.ext`, and it also overrides built-in file-name icons that contain `.ext` (for example, `"**.yml"` also changes `docker-compose.yml`) | `"**.yml": "settings"` |
| `name` | files with exactly this name | `"server.properties": "minecraft"` |
| `parent/name` | files with this name directly inside a folder named `parent` | `"plugins/config.yml": "settings"` |

**Custom folder icons** map a folder name to a Material folder icon. In the form you pick the icon itself,
for example `folder-global`. In `.env` and in VS Code, the value is the icon name without `folder-`:
`"world": "global"` uses `folder-global`, and an empty value (`""`) uses the plain folder icon. Like in
Material, each entry also matches the `.world`, `_world`, `-world` and `__world__` variants. Custom folder
icons also apply with *Generic folder icon*, and a `parent/name` key works for folders too.

In `.env`, each value is a single-line JSON object in single quotes. You can paste the objects from your
VS Code `settings.json` keys `material-icon-theme.files.associations` and
`material-icon-theme.folders.associations`:

```dotenv
FILE_ICONS_FILE_ASSOCIATIONS='{"server.properties":"minecraft","*.lck":"lock"}'
FILE_ICONS_FOLDER_ASSOCIATIONS='{"world":"global","backups":""}'
```

Values must not contain single quotes or backslashes. Invalid JSON is treated as `{}`.

An empty file value removes the built-in icon of the pattern, as in Material: with `"*.yml": ""`, `.yml` files
fall back to the next rule, here the YAML language icon. This only works in `.env`. The form can't show such
an entry, so saving the form removes it.

In the form, each pattern and each folder name can only be used once (upper and lower case count as the
same). The form only shows entries it can save. Entries from `.env` that it can't show are left out: unknown
icons, invalid patterns or folder names, empty file values (`""`), and entries that differ from a later one
only in upper and lower case (the later one applies, so the form shows that one). A notice at the top of
**Material Icon Theme options** says how many entries were left out, and the section opens by itself. When
you save the form, these entries are removed from `.env`, and the notification says how many. Apart from the
empty file values, they had no effect anyway.

In light mode, Material only has light variants for its built-in mappings. A custom icon is shown as is, and a
built-in light mapping for the same name or extension still wins in light mode, exactly as in VS Code. For
example, `"*.toml": "yaml"` shows the YAML icon in dark mode and `toml_light` in light mode.

### Icon delivery

- `inline` (default): the icons are embedded in the page as compact `data:` URIs. Each icon is only encoded
  once per request, and no extra requests are made, which is much faster for folders with many files.
- `route`: the page links to the plugin's icon route, `GET /file-icons/{hash}/{theme}/{icon}.svg`, and
  the browser downloads each icon once and then caches it. Pages get smaller, but the first visit makes one
  request per distinct icon.

### Configuration caching

> **Don't run `php artisan config:cache` (or `php artisan optimize`).** Pelican's Docker image deliberately
> doesn't build these caches, because settings live in `.env` and plugins register providers and routes at
> runtime. With a config cache, Laravel stops reading `.env`, and this plugin falls back to its defaults.
> Saving the plugin settings runs `php artisan config:clear`, which removes the cache again.

- A route cache (`php artisan route:cache`) that was built before the plugin was enabled doesn't contain the
  icon route. With `route` delivery, the plugin then embeds the icons instead. Rebuild or clear the route
  cache to use the route again.
- Real environment variables, for example those set under `environment:` in a Docker `compose.yml`, take
  precedence over `.env`. The settings form can't change them.

## Game-server extras

These rules are on by default, and each theme has its own list that only uses that theme's icons. They only
fill gaps: none of these names has an icon of its own in the theme. They work like custom file and folder
icons (folder entries also match the `.name`, `_name`, `-name` and `__name__` variants), so their folder
icons also apply with *Generic folder icon*. With the Material Icon Theme they are applied *before* your own
custom icons, so you can override any of them.

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

## MIME-type fallback

Wings detects each file's MIME type from its content. When name-based resolution ends at the theme's default
file icon, the plugin uses the MIME type instead. `text/plain` and `application/octet-stream` are never used.

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

## How it works

### Icon resolution

The plugin resolves icons the same way VS Code resolves them with the selected theme and its default
settings. Names are compared case-insensitively, and only the folder that directly contains an entry counts
as its parent.

For **files**, the first match wins:

1. **Parent-qualified file name.** In Material, `postcssrc.json` inside `.config` uses `postcss`. In
   Datapack Icons, `tick.json` inside `function` uses the tick icon.
2. **File name.** `package.json` uses `nodejs` in Material and the npm icon in Datapack Icons.
3. **Longest extension.** Each part after a dot is tried, starting at the first dot, so `index.d.ts` tries
   `d.ts` (`typescript-def`) before `ts`. Dotfiles count too: `.env` matches the `env` extension. A
   parent-qualified extension beats a plain one of the same length: in Datapack Icons, a `.json` file
   directly inside an `advancement` folder gets the advancement icon.
4. **VS Code language** (Material only, Datapack Icons has no language mappings). The VS Code language is
   found from the built-in language associations of VS Code 1.146.0 (exact file names, file-name patterns,
   then extensions) and mapped to an icon. `Jenkinsfile.prod` is Groovy, and `.git/config` is a properties
   file, so it uses `settings`.
5. **Default file icon.** If the MIME-type fallback is on, the MIME type is tried before this.

For **folders**, the order is the parent-qualified folder name (`.github/workflows` uses
`folder-gh-workflows` in Material), then the folder name (`src`, `.src`, `_src`, `-src` and `__src__` all use
`folder-src`), then the default folder icon.

The framework icons and the custom icons are applied the same way Material Icon Theme's manifest generator
applies its `activeIconPack`, `files.associations` and `folders.associations` settings. The game-server
extras come before your own custom icons. The parity tests compare the results with an independent model of
VS Code, built from VS Code's source and fed with Material's real generated manifest and Datapack Icons' real
theme file (`active.json` from the pinned VSIX, with the same collapsed-folder change).

### Which theme is shown

1. The user's own choice from the **File icons** tab, if **Let users choose** is on and the user picked a
   theme.
2. Otherwise the **Icon theme** from the settings.
3. *Automatic* is decided per server from the server's egg (see [Automatic](#automatic)).

### Panel integration

The plugin doesn't replace any panel page. It hooks into the file list (`ListFiles`) and search results
(`SearchFiles`) pages:

- When they render, it swaps the icon of the table's `name` column. It does this through a Livewire `render`
  listener, or through a `modifyTable()` hook if a future panel version adds one to these pages.
- If anything goes wrong while an icon is resolved, the panel's original icon is shown and the error is
  reported.
- Each icon is an `<img>`. Icons that have a light variant get a second `<img>`, and a small scoped stylesheet
  shows the right one for the current light or dark mode.
- The **File icons** profile tab is added through the panel's `EditProfile::registerCustomTabs()` hook. The
  choice is saved in the plugin's own table, never in the `users` table.

### Icon route

With `route` delivery, icons are served from `GET /file-icons/{hash}/{theme}/{icon}.svg`:

- `{hash}` is the first 12 hex characters of a SHA-256 over the theme's generated data and icons, so it
  changes whenever the icons change.
- The route only serves shipped icons of the two themes. Anything else returns 404.
- It uses no session or cookies, because the icons are public MIT-licensed assets.
- Responses for the current hash carry `Cache-Control: public, max-age=31536000, immutable`. Requests with an
  outdated hash still work, but are only cached for a few minutes.
- Every response also carries `X-Content-Type-Options: nosniff` and a sandboxing `Content-Security-Policy`.

## Limitations

- Only collapsed-folder icons are used, because the file manager has no expanded folders. Open-folder and
  root-folder variants aren't shown.
- Only the direct parent folder is taken into account, as in VS Code. A custom file icon such as `a/b/name`
  never matches.
- Languages aren't detected from file contents (VS Code's explorer doesn't do that either). The MIME-type
  fallback covers part of that gap.
- Symlinks are resolved by their own name, and their target isn't inspected. Wings reports a symlink to a
  directory as a file, so it gets a file icon.
- Light-theme ties are reproduced, not fixed. In VS Code's light theme, the light rules have higher CSS
  specificity and win ties against the dark rules. Because of that, a few multi-dot names get a different icon
  in light mode. For example, `foo.pdm.toml` shows `pdm` in dark mode and `toml_light` in light mode, exactly
  as in VS Code.
- Theme settings that only affect the VS Code extensions aren't supported: Material's icon colours, opacity,
  saturation, custom clones, `languages.associations` and root-folder settings, and Datapack Icons' dynamic
  features (see [Datapack Icons](#datapack-icons)).
- Only the file manager's name column changes. Breadcrumbs, the editor and other pages keep the panel icons.

## Development

You need [Bun](https://bun.sh) 1.4 for the tooling. To run the tests, you also need PHP 8.4 with `mbstring`.
The panel host never needs Bun.

```bash
bun install                            # dev dependencies (material-icon-theme, fflate, @types/bun)
bun run fetch:vscode                   # refresh scripts/data/vscode-languages.json from GitHub (GITHUB_TOKEN optional)
bun run build                          # regenerate resources/data/*.php and resources/icons/**
PHP_BINARY=/path/to/php bun run test   # data checks, PHP unit tests and parity tests against a VS Code model
bun run release                        # build dist/file-icons-<version>.zip
```

- `bun run build` needs network access the first time. It downloads the Datapack Icons VSIX from the Visual
  Studio Marketplace into `scripts/.cache/` (ignored by git) and checks it against the SHA-256 pinned in
  `scripts/data/sources.json`. A mismatch stops the build. With `--offline`, it never downloads and only
  uses the cached file. The tests read the theme from the same cached VSIX, so run `bun run build` once
  before `bun run test`.
- `bun run fetch:vscode` accepts `--tag <vscode tag>`, `--repo <local vscode clone>` and `--check`. With
  `--check`, it compares with the committed file instead of writing it.
- `resources/data` and `resources/icons` are generated and committed. `bun run build --check` only verifies
  them. CI runs `bun run build` and fails if the result differs from the committed files.
- `bun run release` first checks the generated data, then writes a reproducible zip. The zip has a single
  `file-icons/` folder that contains only the runtime files, including `database/`. The script also
  prints the zip's SHA-256 and a matching entry for an `update.json` feed.
- Pint and PHPStan run from a Pelican Panel checkout, with this repository cloned to `plugins/file-icons`:

  ```bash
  cd /path/to/pelican/plugins/file-icons && ../../vendor/bin/pint --test
  cd /path/to/pelican && vendor/bin/phpstan analyse -c plugins/file-icons/phpstan.neon
  ```

### Updating Material Icon Theme

1. Run `bun add --dev --exact material-icon-theme@<version>`.
2. Run `bun run build` and `bun run test`. The unit tests also check that every icon used by the game-server
   extras and the MIME-type fallback still exists, in both themes.
3. Update the version in this README, `THIRD_PARTY_NOTICES.md` and `CHANGELOG.md`, then commit `resources/`
   together with `package.json` and `bun.lock`.

### Updating Datapack Icons

1. Find the VSIX download URL of the new version on the Visual Studio Marketplace, download it once, and
   compute its SHA-256.
2. Update `version`, `url` and `sha256` in `scripts/data/sources.json`.
3. Run `bun run build` and `bun run test`. The build stops if the new theme file uses something the plugin
   can't reproduce, such as font icons or light and high-contrast sections.
4. Check the license text in the VSIX's `extension/LICENSE.txt`, update the version and license in this
   README, `THIRD_PARTY_NOTICES.md` and `CHANGELOG.md`, then commit `resources/` together with
   `scripts/data/sources.json`.

### Updating the VS Code language data

1. Run `bun run fetch:vscode --tag <version>`, for example `--tag 1.147.0`. Also update `DEFAULT_VSCODE_TAG` in
   `scripts/lib/vscode-languages.ts`, so that a plain `bun run fetch:vscode` reproduces the committed file.
2. Run `bun run build` and `bun run test`.
3. Check the VS Code files listed in `THIRD_PARTY_NOTICES.md` for changes to the resolution logic, and update the
   versions in the docs.

## Credits

- [Material Icon Theme](https://github.com/material-extensions/vscode-material-icon-theme) by Material
  Extensions provides the Material icons and their mappings (MIT License).
- [Datapack Icons](https://github.com/FuncFusion/mc-dp-icons) by FuncFusion provides the Datapack Icons theme
  (MIT License).
- [Visual Studio Code](https://github.com/microsoft/vscode) by Microsoft provides the built-in language
  associations and the icon resolution rules this plugin re-implements (MIT License).
- [Pelican Panel](https://pelican.dev).

## License

This plugin is released under the MIT License, see `LICENSE`. The third-party notices and licenses are in
`THIRD_PARTY_NOTICES.md`. Brand logos in the icons are trademarks of their owners. Not an official Minecraft
product, and not approved by or associated with Mojang or Microsoft.
