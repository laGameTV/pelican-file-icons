# Third-party notices

This plugin is released under the MIT License (see `LICENSE`). It also contains, or is derived from, the
third-party works listed below. Each is used under its own license, reproduced in full.

## Material Icon Theme

- Project: Material Icon Theme by Material Extensions (VS Code publisher `PKief`)
- Source: <https://github.com/material-extensions/vscode-material-icon-theme>
- Version: npm package `material-icon-theme@5.40.0`
- License: MIT

What is used:

- `resources/icons/material/*.svg`: the icon files, copied byte for byte from the package's `icons/`
  directory.
- `resources/data/material.php`: the file-name, extension, language and folder-name mappings, generated
  from the package's `generateManifest()` output.
- `src/Icons/`: re-implements how Material Icon Theme applies icon packs, folder themes and
  `files.associations` / `folders.associations`.

```text
The MIT License (MIT)
Copyright (c) 2025 Material Extensions

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### Upstream icon sources and trademarks

The Material Icon Theme README lists these sources for its icons:

- Material Design Icons: <https://pictogrammers.com/library/mdi/>
- Material Symbols: <https://fonts.google.com/icons>

Many icons show logos of products, projects or companies, such as programming languages, frameworks,
tools and games. These logos are trademarks of their owners. They are included only to identify the
matching file types. Their inclusion does not imply any affiliation with, or endorsement by, those owners.

## Datapack Icons

- Project: Datapack Icons by FuncFusion (VS Code extension `SuperAnt.mc-dp-icons`)
- Source: <https://github.com/FuncFusion/mc-dp-icons>
- Version: `5.0.0`, the VSIX package from the Visual Studio Marketplace (SHA-256
  `d062e75a2f82a7d1e70c6b9701bee16c875ad7eaf59724b73679d33527e296e5`, pinned in
  `scripts/data/sources.json`)
- License: MIT

What is used:

- `resources/icons/datapack/*.svg`: the icon files, copied byte for byte from the package's
  `extension/icons/` directory. Only icons that the theme's mappings use are included.
- `resources/data/datapack.php`: the file-name, extension and folder-name mappings, generated from the
  package's `extension/icon_theme/active.json`. The specific folder icons that the theme only assigns to
  expanded folders are also used for closed folders, because the panel's file manager only shows closed
  folders.

The license text below is copied from the package's `extension/LICENSE.txt`:

```text
Copyright 2023-2026 FuncFusion

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### Minecraft and other trademarks

Datapack Icons is a fan-made icon set in the style of Minecraft. Minecraft is a trademark of Mojang
Synergies AB. Neither Datapack Icons nor this plugin is an official Minecraft product, and neither is
approved by or associated with Mojang or Microsoft. Some icons show logos of other products, tools or
programming languages. These logos are trademarks of their owners and are only used to identify the
matching file types.

## Visual Studio Code

- Project: Visual Studio Code ("Code - OSS") by Microsoft Corporation
- Source: <https://github.com/microsoft/vscode>
- Version: tag `1.146.0`, commit `69047191fc427f2f92828279aae1d90d8eeda7ab`
- License: MIT

What is used:

- `scripts/data/vscode-languages.json` and `resources/data/languages.php`: the language associations
  (`contributes.languages`: ids, extensions, file names and file-name patterns) of the built-in
  extensions shipped with VS Code.
- `src/Icons/` and `tests/oracle/` (the latter is development only): re-implement how VS Code picks a
  file icon and a language for a path. The relevant VS Code files are `getIconClasses.ts`,
  `fileIconThemeData.ts`, `languagesAssociations.ts` and `glob.ts`.

```text
MIT License

Copyright (c) 2015 - present Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
