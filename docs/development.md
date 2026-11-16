# Development

The repository root is the plugin: clone it into a Pelican panel as `plugins/file-icons` to work on it. The
plugin itself only needs PHP. [Bun](https://bun.sh) 1.4 is only needed for the dev tooling, and PHP 8.4 with
`mbstring` for the tests.

## Commands

```bash
bun install                            # dev dependencies (material-icon-theme, fflate, @types/bun)
bun run build                          # regenerate resources/data/*.php and resources/icons/**
PHP_BINARY=/path/to/php bun run test   # data checks, PHP unit tests and parity tests against a model of VS Code
bun run release                        # build dist/file-icons-<version>.zip
bun run fetch:vscode                   # refresh scripts/data/vscode-languages.json from GitHub
```

- `resources/data` and `resources/icons` are generated and committed. CI rebuilds them and fails if the result
  differs from the committed files. `bun scripts/build-data.ts --check` only verifies them.
- The first `bun run build` needs network access: it downloads the Datapack Icons VSIX from the Visual Studio
  Marketplace into `scripts/.cache/` (ignored by git) and checks it against the SHA-256 pinned in
  `scripts/data/sources.json`. With `--offline`, it only uses the cached file. The tests read the theme from
  the same file, so run `bun run build` once before `bun run test`.
- `bun run fetch:vscode` accepts `--tag <vscode tag>`, `--repo <local vscode clone>` and `--check` (compare
  with the committed file instead of writing it). `GITHUB_TOKEN` is optional.
- Pint and PHPStan run from a Pelican Panel checkout, with this repository at `plugins/file-icons`:

  ```bash
  cd /path/to/pelican/plugins/file-icons && ../../vendor/bin/pint --test
  cd /path/to/pelican && vendor/bin/phpstan analyse -c plugins/file-icons/phpstan.neon
  ```

## Tests

`bun run test` runs three suites:

- **Data checks** (`tests/data.ts`): the generated data matches the upstream theme files, and every shipped
  icon is byte-identical to the original.
- **PHP unit tests** (`tests/php/unit.php`): settings, game-server extras, content-type fallback, Minecraft
  detection and more.
- **Parity tests** (`tests/parity.ts`): an independent model of VS Code, ported from VS Code's source code
  (`tests/oracle/`), resolves tens of thousands of file and folder names in many configurations, in dark and
  light mode. The plugin's PHP resolver has to return exactly the same icons.

## Releasing

1. Update `version` in `plugin.json` and add a section for it to `CHANGELOG.md`.
2. Commit, then tag and push:

   ```bash
   git tag v1.2.3
   git push origin main v1.2.3
   ```

The [release workflow](../.github/workflows/release.yml) checks that the tag matches `plugin.json`, runs the
tests, builds the zip and publishes a GitHub release with three files:

| File | Purpose |
|---|---|
| `file-icons-<version>.zip` | The plugin. `update.json` points to this file. |
| `file-icons.zip` | The same zip under a fixed name, for `.../releases/latest/download/file-icons.zip`. |
| `update.json` | The update feed. `update_url` in `plugin.json` points to `.../releases/latest/download/update.json`. |

Installed copies of the plugin check `update.json` and show an **Update** button in the panel's plugin list. The
release notes are taken from the version's section in `CHANGELOG.md`.

`bun run release` builds the same zip locally. With `--download-url <url>` it also writes `dist/update.json`
(`{version}` in the URL is replaced with the version).

## Updating the icon themes

### Material Icon Theme

1. Run `bun add --dev --exact material-icon-theme@<version>`.
2. Run `bun run build` and `bun run test`. The unit tests also check that all icons used by the game-server
   extras and the content-type fallback still exist.
3. Update the version in `docs/reference.md`, `THIRD_PARTY_NOTICES.md` and `CHANGELOG.md`, then commit
   `resources/` together with `package.json` and `bun.lock`.

### Datapack Icons

1. Find the VSIX download URL of the new version on the Visual Studio Marketplace, download it once and compute
   its SHA-256.
2. Update `version`, `url` and `sha256` in `scripts/data/sources.json`.
3. Run `bun run build` and `bun run test`. The build stops if the new theme file uses something the plugin can't
   reproduce, such as font icons or light and high-contrast sections.
4. Check the license in the VSIX (`extension/LICENSE.txt`), update the version in `docs/reference.md`,
   `THIRD_PARTY_NOTICES.md` and `CHANGELOG.md`, then commit `resources/` together with
   `scripts/data/sources.json`.

### VS Code language data

1. Run `bun run fetch:vscode --tag <version>` (for example `--tag 1.147.0`), and update `DEFAULT_VSCODE_TAG` in
   `scripts/lib/vscode-languages.ts` so that a plain `bun run fetch:vscode` reproduces the committed file.
2. Run `bun run build` and `bun run test`.
3. Check the VS Code files listed in `THIRD_PARTY_NOTICES.md` for changes to the matching logic, and update the
   versions in the docs.
