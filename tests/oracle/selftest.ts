/**
 * Self-tests for the oracle: hand-verified expectations so that the oracle
 * itself is checked before it is used to judge the PHP implementation.
 *
 * Sources of the expectations:
 * - VS Code's own unit tests (languagesAssociations.test.ts) for the
 *   association semantics,
 * - glob semantics read from glob.ts,
 * - the hand-checked table at the end of report-material-icon-theme.md and the
 *   probe table of report-vscode-languages.md,
 * - specificity arithmetic from fileIconThemeData.ts,
 * - the ported Material association semantics compared with the REAL
 *   generateManifest() output for the same associations,
 * - Datapack Icons: values read by hand from the raw active.json (mc-dp-icons
 *   5.0.0) and the CSS rule order derived from it.
 */

import { parse, parseRegExp } from './vscode/glob.ts';
import { LanguageAssociations, createLanguageAssociations } from './vscode/languages.ts';
import { FileKind, getIconClasses } from './vscode/iconClasses.ts';
import { Oracle, loadVscodeLanguages, type Case } from './oracle.ts';
import { generateManifest, material } from './material.ts';
import { applyMaterialAssociations, materialFolderIcon } from './associations.ts';
import { DatapackSourceError, datapackManifest, loadDatapackSource } from './datapack.ts';
import type { IconThemeDocument } from './vscode/iconTheme.ts';
import { join } from 'node:path';

export interface SelfTestResult {
	passed: number;
	failures: string[];
}

export function runOracleSelfTests(root: string): SelfTestResult {
	const languagesFile = join(root, 'scripts/data/vscode-languages.json');
	const failures: string[] = [];
	let passed = 0;
	const eq = (label: string, actual: unknown, expected: unknown) => {
		const a = JSON.stringify(actual);
		const e = JSON.stringify(expected);
		if (a === e) {
			passed++;
		} else {
			failures.push(`${label}: expected ${e}, got ${a}`);
		}
	};

	// --- glob.ts ---
	eq('glob Docker* ~ docker-PROD', parse('Docker*', { ignoreCase: true })('docker-PROD'), true);
	eq('glob Docker* !~ foo/Docker', parse('Docker*', { ignoreCase: true })('xdocker'), false);
	eq('glob **/.git/config (T4) path end', parse('**/.git/config', { ignoreCase: true })('/repo/.git/config'), true);
	eq('glob **/.git/config (T4) bare', parse('**/.git/config', { ignoreCase: true })('.git/config'), true);
	eq('glob **/.git/config (T4) no', parse('**/.git/config', { ignoreCase: true })('/repo/x.git/config'), false);
	eq('glob **/.git/config (T4) backslash is no separator', parse('**/.git/config', { ignoreCase: true })('/repo/x\\.git/config'), false);
	eq('glob regex: backslash is a separator', parse('**/snippets*.json', { ignoreCase: true })('/a\\snippets.json'), true);
	eq('glob /i is not Unicode-aware (U+017F)', parse('Jenkinsfile*', { ignoreCase: true })('jenkinſfile'), false);
	eq('glob compose.yml (T5) equality', parse('compose.yml', { ignoreCase: true })('COMPOSE.yml'), true);
	eq('glob compose.yml (T5) no suffix match', parse('compose.yml', { ignoreCase: true })('my-compose.yml'), false);
	eq('glob **/snippets*.json yes', parse('**/snippets*.json', { ignoreCase: true })('/a/b/snippets-x.json'), true);
	eq('glob **/snippets*.json root', parse('**/snippets*.json', { ignoreCase: true })('/snippets.json'), true);
	eq('glob **/snippets*.json no', parse('**/snippets*.json', { ignoreCase: true })('/a/xsnippets.json'), false);
	eq('glob * does not cross backslash', parse('Dockerfile.*', { ignoreCase: true })('dockerfile.a\\b'), false);
	eq('glob $ is end of input', parse('tsconfig.*.json', { ignoreCase: true })('tsconfig.a.json\n'), false);
	eq('glob **/.cursor/**/*.mdc deep', parse('**/.cursor/**/*.mdc', { ignoreCase: true })('/p/.cursor/a/b/x.mdc'), true);
	eq('glob **/.cursor/**/*.mdc direct', parse('**/.cursor/**/*.mdc', { ignoreCase: true })('/p/.cursor/x.mdc'), true);
	eq(
		'glob parseRegExp **/User/snippets/*.json',
		parseRegExp('**/User/snippets/*.json'),
		'(?:[/\\\\]|[^/\\\\]+[/\\\\])*?User[/\\\\]snippets[/\\\\][^/\\\\]*?\\.json',
	);

	// --- languagesAssociations.test.ts (platform part) ---
	{
		const r = new LanguageAssociations();
		eq('assoc unknown', r.getLanguageIds('/foo.monaco'), ['unknown']);
		r.registerPlatform({ id: 'monaco', extension: '.monaco' });
		eq('assoc ext', r.getLanguageIds('/foo.monaco'), ['monaco', 'plaintext']);
		eq('assoc dotfile ext', r.getLanguageIds('/.monaco'), ['monaco', 'plaintext']);
		r.registerPlatform({ id: 'codefile', filename: 'Codefile' });
		eq('assoc filename', r.getLanguageIds('/Codefile'), ['codefile', 'plaintext']);
		eq('assoc filename is exact', r.getLanguageIds('/foo.Codefile'), ['unknown']);
		r.registerPlatform({ id: 'docker', filepattern: 'Docker*' });
		eq('assoc pattern', r.getLanguageIds('/Docker-debug'), ['docker', 'plaintext']);
		eq('assoc pattern ignore case', r.getLanguageIds('/docker-PROD'), ['docker', 'plaintext']);
	}
	{
		const r = new LanguageAssociations();
		r.registerPlatform({ id: 'monaco', extension: '.monaco' });
		r.registerPlatform({ id: 'monaco-xml', extension: '.monaco.xml' });
		r.registerPlatform({ id: 'monaco-xml-build', extension: '.monaco.xml.build' });
		eq('assoc longest ext 1', r.guessLanguageId('/foo.monaco'), 'monaco');
		eq('assoc longest ext 2', r.guessLanguageId('/foo.monaco.xml'), 'monaco-xml');
		eq('assoc longest ext 3', r.guessLanguageId('/foo.monaco.xml.build'), 'monaco-xml-build');
		r.registerPlatform({ id: 'winner', filename: 'dockerfile' });
		r.registerPlatform({ id: 'looser', filepattern: 'dockerfile*' });
		eq('assoc filename beats pattern', r.guessLanguageId('/dockerfile'), 'winner');
		r.registerPlatform({ id: 'monaco', filepattern: '**/dot.monaco.xml' });
		r.registerPlatform({ id: 'other', filepattern: '*ot.other.xml' });
		eq('assoc pattern on path', r.guessLanguageId('/some/path/dot.monaco.xml'), 'monaco');
		r.registerPlatform({ id: 'last', filepattern: '**/dot.monaco.xml' });
		eq('assoc last registered pattern wins', r.guessLanguageId('/some/path/dot.monaco.xml'), 'last');
	}
	{
		const r = new LanguageAssociations();
		r.registerConfigured({ id: 'user', extension: '.monaco.xnl' });
		r.registerPlatform({ id: 'platform', extension: '.monaco.xml' });
		eq('assoc user configured wins', r.guessLanguageId('/foo.monaco.xnl'), 'user');
	}

	// --- real VS Code 1.146.0 table (report-vscode-languages.md probe table) ---
	const langs = loadVscodeLanguages(languagesFile);
	const registry = createLanguageAssociations(langs.contributions);
	const lang = (path: string) => registry.guessLanguageId(path);
	eq('lang server.cfg', lang('/server.cfg'), 'properties');
	eq('lang nginx.conf', lang('/nginx.conf'), 'properties');
	eq('lang latest.log', lang('/logs/latest.log'), 'log');
	eq('lang latest.log.1', lang('/logs/latest.log.1'), 'unknown');
	eq('lang build.gradle.kts', lang('/build.gradle.kts'), 'unknown');
	eq('lang Jenkinsfile.prod', lang('/Jenkinsfile.prod'), 'groovy');
	eq('lang /repo/.git/config', lang('/repo/.git/config'), 'properties');
	eq('lang foo.hpp.in', lang('/foo.hpp.in'), 'cpp');
	eq('lang tsconfig.base.json', lang('/tsconfig.base.json'), 'jsonc');
	eq('lang x.PL', lang('/x.PL'), 'perl');
	eq('lang composer.lock', lang('/composer.lock'), 'json');
	eq('lang bun.lock', lang('/bun.lock'), 'jsonc');
	eq('lang .flaskenv', lang('/.flaskenv'), 'dotenv');
	eq('lang my-language-configuration.json (pure suffix)', lang('/my-language-configuration.json'), 'jsonc');
	eq('lang *.log.? is literal', lang('/x.log.1'), 'unknown');
	eq('lang eula.txt', lang('/eula.txt'), 'plaintext');

	// --- getIconClasses ---
	const fake = { guessLanguageId: () => 'typescript' };
	eq('classes file', getIconClasses(fake, '/a/Src/Foo.D.ts', FileKind.FILE), [
		'file-icon',
		'src-name-dir-icon',
		'foo.d.ts-name-file-icon',
		'name-file-icon',
		'd.ts-ext-file-icon',
		'ts-ext-file-icon',
		'ext-file-icon',
		'typescript-lang-file-icon',
	]);
	eq('classes root file has no dir class', getIconClasses(fake, '/x', FileKind.FILE), ['file-icon', 'x-name-file-icon', 'name-file-icon', 'ext-file-icon', 'typescript-lang-file-icon']);
	eq('classes folder', getIconClasses(fake, '/a/My Dir/META-INF', FileKind.FOLDER), ['folder-icon', 'my/dir-name-dir-icon', 'meta-inf-name-folder-icon']);
	eq(
		'classes >255 has no ext classes',
		getIconClasses(fake, '/' + 'a'.repeat(252) + '.mca', FileKind.FILE).filter(c => c.endsWith('-ext-file-icon')),
		[],
	);

	// --- specificity / rule order on a synthetic theme ---
	{
		const doc: IconThemeDocument = {
			iconDefinitions: { a: { iconPath: 'a' }, b: { iconPath: 'b' }, c: { iconPath: 'c' }, d: { iconPath: 'd' }, f: { iconPath: 'f' } },
			file: 'f',
			languageIds: { typescript: 'b' },
			fileExtensions: { ts: 'a', 'x.ts': 'c' },
			fileNames: { 'x.ts': 'd' },
			light: { fileExtensions: { ts: 'a' } },
		};
		const reg = new LanguageAssociations();
		reg.registerPlatform({ id: 'typescript', extension: '.ts' });
		reg.registerPlatform({ id: 'typescript', filename: 'tsfile' });
		const o = new Oracle(doc, reg);
		const r = (name: string) => o.resolve({ kind: 'file', name, directory: '/' });
		eq('synthetic ext beats lang', r('y.ts').dark.icon, 'a');
		eq('synthetic longer ext beats shorter', r('y.x.ts').dark.icon, 'c');
		eq('synthetic fileName beats ext', r('x.ts').dark.icon, 'd');
		eq('synthetic lang beats default', r('tsfile').dark.icon, 'b');
		eq('synthetic lang specificity', r('tsfile').dark.specificity, 3);
		eq('synthetic default', r('nothing').dark.icon, 'f');
		// light 'ts' (spec 5) ties dark 'x.ts' (spec 5); rule for 'a' was emitted first, so 'c' (later) keeps winning
		eq('synthetic tie broken by rule order', r('y.x.ts').light.icon, 'c');
	}

	// --- real Material manifest (report-material-icon-theme.md, Deliverable B table) ---
	const o = new Oracle(generateManifest({ gameServerExtras: false }), registry);
	const icon = (c: Case) => o.resolve(c).dark.icon;
	const file = (name: string, directory = '/'): Case => ({ kind: 'file', name, directory });
	const folder = (name: string, directory = '/'): Case => ({ kind: 'folder', name, directory });
	eq('mit server.properties', icon(file('server.properties')), 'settings');
	eq('mit eula.txt', icon(file('eula.txt')), 'document');
	eq('mit r.0.0.mca', icon(file('r.0.0.mca', '/world/region')), 'minecraft');
	eq('mit level.dat_old', icon(file('level.dat_old', '/world')), 'file');
	eq('mit .gitignore', icon(file('.gitignore')), 'git');
	eq('mit .env', icon(file('.env')), 'tune');
	eq('mit Dockerfile.prod', icon(file('Dockerfile.prod')), 'docker');
	eq('mit foo.d.ts', icon(file('foo.d.ts')), 'typescript-def');
	eq('mit x.mpp (languageId)', icon(file('x.mpp')), 'cpp');
	eq('mit Jenkinsfile.prod (pattern -> languageId)', icon(file('Jenkinsfile.prod')), 'groovy');
	eq('mit .config/postcssrc.json', icon(file('postcssrc.json', '/.config')), 'postcss');
	eq('mit other/postcssrc.json', icon(file('postcssrc.json', '/other')), 'json');
	eq('mit folder META-INF', icon(folder('META-INF')), 'folder-config');
	eq('mit folder x/.github/workflows', icon(folder('workflows', '/x/.github')), 'folder-gh-workflows');
	eq('mit folder plugins', icon(folder('plugins')), 'folder-plugin');
	eq('mit folder mods', icon(folder('mods')), 'folder-plugin');
	eq('mit folder world', icon(folder('world')), 'folder');
	eq('mit folder resourcepacks', icon(folder('resourcepacks')), 'folder');
	eq('mit /repo/.git/config (onPath pattern)', icon(file('config', '/repo/.git')), 'settings');
	eq('mit light x.toml', o.resolve(file('x.toml')).light.icon, 'toml_light');
	eq('mit light x.json (no light variant)', o.resolve(file('x.json')).light.icon, 'json');
	eq('mit light tie quirk foo.pdm.toml dark', o.resolve(file('foo.pdm.toml')).dark.icon, 'pdm');
	eq('mit light tie quirk foo.pdm.toml light', o.resolve(file('foo.pdm.toml')).light.icon, 'toml_light');
	eq('mit light folder .cursor', o.resolve(folder('.cursor')).light.icon, 'folder-cursor_light');

	const none = new Oracle(generateManifest({ gameServerExtras: false, folderTheme: 'none' }), registry);
	eq('mit folders none => no icon', none.resolve(folder('src')).dark.icon, null);
	eq('mit folders none keeps files', none.resolve(file('x.ts')).dark.icon, 'typescript');
	const classic = new Oracle(generateManifest({ gameServerExtras: false, folderTheme: 'classic' }), registry);
	eq('mit folders classic', classic.resolve(folder('src')).dark.icon, 'folder');

	// --- associations.ts port == real Material generateManifest() ---
	{
		const files: Record<string, string> = {
			'*.foo': 'toml',
			'**.json': 'nodejs',
			'*.YAML': 'Settings',
			'*.mjs': 'react',
			'server.properties': 'minecraft',
			'next.config.js': 'javascript',
			'.config/abc.json': 'hcl',
			'plugins/config.yml': 'settings',
			'*.mca': '',
			'60': 'zip',
			'**.Md': 'pdf',
		};
		const folders: Record<string, string> = { myfolder: 'cursor', src: 'components', '.cursor': 'src', Server: 'config', plugins: '', 'parent/child': 'src', x: 'log', '.x': 'src' };
		for (const theme of ['specific', 'classic', 'none'] as const) {
			for (const pack of [undefined, 'react']) {
				const base: Record<string, unknown> = { folders: { theme } };
				if (pack) base.activeIconPack = pack;
				const port = material.generateManifest(base);
				applyMaterialAssociations(port, files, folders, { folderTheme: theme, folderIcon: materialFolderIcon });
				const real = material.generateManifest({ ...base, files: { associations: files }, folders: { theme, associations: folders } });
				for (const table of ['fileNames', 'fileExtensions', 'folderNames'] as const) {
					for (const section of ['dark', 'light'] as const) {
						const a = section === 'dark' ? port[table] : port.light?.[table];
						const b = section === 'dark' ? real[table] : (real.light as IconThemeDocument | undefined)?.[table];
						// key order matters too (it decides the CSS rule order)
						eq(`associations port ${theme}/${pack ?? 'default'} ${section}.${table}`, JSON.stringify(a ?? {}) === JSON.stringify(b ?? {}), true);
					}
				}
			}
		}
	}

	// --- Datapack Icons (raw active.json, hand-checked values) ---
	let dp: ReturnType<typeof loadDatapackSource> | null = null;
	try {
		dp = loadDatapackSource(root);
	} catch (e) {
		if (!(e instanceof DatapackSourceError)) throw e;
		failures.push(`datapack self-tests not run: ${e.message}`);
	}
	if (dp) {
		const plain = { gameServerExtras: false } as const;
		const raw = new Oracle(dp.theme, registry);
		const dpo = new Oracle(datapackManifest(dp, plain), registry);
		const d = (c: Case) => dpo.resolve(c).dark.icon;
		eq('dp defaults', [dp.theme.file, dp.theme.folder], ['generic_file', 'generic_folder_closed']);
		eq('dp no light section', dp.theme.light === undefined && dp.theme.languageIds === undefined, true);
		eq('dp raw: closed advancement folder is generic in VS Code', raw.resolve(folder('advancement')).dark.icon, 'generic_folder_closed');
		eq('dp raw: closed data folder', raw.resolve(folder('data')).dark.icon, 'data_folder_closed');
		eq('dp deviation: advancement', d(folder('advancement')), 'advancement_folder');
		eq('dp deviation: closed entry wins (data)', d(folder('Data')), 'data_folder_closed');
		eq('dp deviation: functions', d(folder('functions', '/x/data/ns')), 'function_folder');
		eq('dp deviation: logs', d(folder('logs')), 'log_folder');
		eq('dp deviation: buildSrc (raw key not lowercase)', d(folder('BUILDSRC')), 'gradle_folder');
		eq('dp folder default', d(folder('crash-reports')), 'generic_folder_closed');
		eq('dp file default', d(file('nothing-here')), 'generic_file');
		eq('dp no language tier (Jenkinsfile)', d(file('Jenkinsfile')), 'generic_file');
		eq('dp pack.mcmeta', d(file('PACK.MCMETA')), 'pack.mcmeta_file');
		eq('dp CHANGELOG.md (raw key upper case)', d(file('changelog.md')), 'timeline_file');
		eq('dp level.dat', d(file('level.dat', '/world')), 'level.dat_file');
		eq('dp function/load.json', d(file('load.json', '/dp/data/minecraft/tags/function')), 'load.json_file');
		eq('dp load.json elsewhere', d(file('load.json', '/dp/data/minecraft/tags')), 'json_file');
		eq('dp advancement/json', d(file('root.json', '/dp/data/ns/advancement')), 'advancement_file');
		eq('dp advancement/json only direct parent', d(file('root.json', '/dp/data/ns/advancement/story')), 'json_file');
		eq('dp structure/nbt beats nbt', d(file('house.nbt', '/structure')), 'structure_file');
		eq('dp nbt', d(file('house.nbt', '/x')), 'nbt_file');
		eq('dp atlases/blocks.json beats blocks.json', d(file('blocks.json', '/rp/atlases')), 'atlases_file');
		eq('dp blocks.json', d(file('blocks.json', '/rp')), 'blocks.json_file');
		eq('dp 2-segment parent ext', d(file('x.render_controllers.json', '/rp/render_controllers')), 'render_controllers_file');
		eq('dp workflows/yml (as shipped)', d(file('ci.yml', '/.github/workflows')), 'vertex_shader_file');
		eq('dp mixins/java', d(file('FooMixin.java', '/src/mixins')), 'sponge_mixins_file');
		// equal specificity (5): parent-qualified 1-segment extension vs plain 2-segment extension -> later CSS rule wins
		// rule order = first use of the definition id: entities_file (fileExtensions #153) < sponge_mixins_file (#266)
		eq('dp tie entity/json vs mixins.json', dpo.resolve(file('x.mixins.json', '/rp/entity')).dark.specificity, 5);
		eq('dp tie entity/json vs mixins.json -> later rule', d(file('x.mixins.json', '/rp/entity')), 'sponge_mixins_file');
		eq('dp tie entity/json vs mixins.json tiedWith', dpo.resolve(file('x.mixins.json', '/rp/entity')).dark.tiedWith, ['entities_file']);
		// advancement_file (#101) < spyglass_file (#128)
		eq('dp tie advancement/json vs spyglass.json -> later rule', d(file('a.spyglass.json', '/dp/advancement')), 'spyglass_file');
		eq('dp light == dark (file)', dpo.resolve(file('root.json', '/advancement')).light.icon, 'advancement_file');
		eq('dp light == dark (folder)', dpo.resolve(folder('advancement')).light.icon, 'advancement_folder');
		const classicDp = new Oracle(datapackManifest(dp, { ...plain, folderTheme: 'classic' }), registry);
		eq('dp classic: advancement', classicDp.resolve(folder('advancement')).dark.icon, 'generic_folder_closed');
		eq('dp classic: data', classicDp.resolve(folder('data')).dark.icon, 'generic_folder_closed');
		eq('dp classic keeps files', classicDp.resolve(file('pack.mcmeta')).dark.icon, 'pack.mcmeta_file');
		const noneDp = new Oracle(datapackManifest(dp, { ...plain, folderTheme: 'none' }), registry);
		eq('dp none: no folder icon', noneDp.resolve(folder('data')).dark.icon, null);
		eq('dp none keeps files', noneDp.resolve(file('x.ts')).dark.icon, 'typescript_file');
		const extras = { fileAssociations: { '*.schem': 'structure_file', '*.json': 'nbt_file', '**.md': 'text_file', '*.nope': 'not-an-icon' }, folderAssociations: { 'crash-reports': 'log_folder', logs: '' } };
		const ex = new Oracle(datapackManifest(dp, { gameServerExtras: true }, extras), registry);
		eq('dp extras *.schem', ex.resolve(file('castle.schem')).dark.icon, 'structure_file');
		eq('dp extras *.json overrides json but not parent-qualified', [ex.resolve(file('x.json')).dark.icon, ex.resolve(file('x.json', '/advancement')).dark.icon], ['nbt_file', 'advancement_file']);
		eq('dp extras **.md removes fileNames with .md', [ex.resolve(file('README.md')).dark.icon, ex.resolve(file('README')).dark.icon], ['text_file', 'readme_file']);
		eq('dp extras unknown icon ignored', ex.resolve(file('x.nope')).dark.icon, 'generic_file');
		eq('dp extras folder (+ variants)', [ex.resolve(folder('crash-reports')).dark.icon, ex.resolve(folder('__crash-reports__')).dark.icon], ['log_folder', 'log_folder']);
		eq("dp extras folder '' => generic", ex.resolve(folder('logs')).dark.icon, 'generic_folder_closed');
		const exNone = new Oracle(datapackManifest(dp, { gameServerExtras: true, folderTheme: 'none' }, extras), registry);
		eq('dp extras + none: no folder icons', exNone.resolve(folder('crash-reports')).dark.icon, null);
		const exClassic = new Oracle(datapackManifest(dp, { gameServerExtras: true, folderTheme: 'classic' }, extras), registry);
		eq('dp extras + classic: associations still apply', [exClassic.resolve(folder('crash-reports')).dark.icon, exClassic.resolve(folder('advancement')).dark.icon], ['log_folder', 'generic_folder_closed']);
	}

	return { passed, failures };
}
