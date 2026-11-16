# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-11-16

### Changed

- Updates are now delivered through the [Pelican Plugin Hub](https://hub.pelican.dev/plugins/file-icons).
- The three folder icon options in the settings now explain what they do.

## [1.0.0] - 2026-11-16

### Added

- VS Code file and folder icons in the server file manager, in the folder list and in the search results.
- Two icon themes: **Material Icon Theme** 5.40.0 and **Datapack Icons** 5.0.0 by FuncFusion.
- **Automatic** mode: Datapack Icons on Minecraft servers, Material Icon Theme everywhere else.
- Every user can pick their own theme in their profile (**File icons** tab). Admins set the default and can
  turn the choice off.
- Icons are matched exactly like in VS Code, including Material's framework icons and custom file and folder
  icons in VS Code syntax.
- Extra icons for game-server files such as `.nbt`, `.schem`, `.sk`, `.vdf` and SourceMod plugins.
- Files without a known name or extension get an icon based on the file type Wings detects.
- Settings with a live preview of both themes.
- Icons are part of the page, so large folders load without extra requests.
- One-click updates from the panel's plugin list.
- English and German translations.

[1.0.1]: https://github.com/laGameTV/pelican-file-icons/releases/tag/v1.0.1
[1.0.0]: https://github.com/laGameTV/pelican-file-icons/releases/tag/v1.0.0
