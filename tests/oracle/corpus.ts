/**
 * Deterministic test corpus (SPEC §7).
 *
 * Built from:
 * - every fileNames / fileExtensions / folderNames / folderNamesExpanded key
 *   (dark + light) of the theme documents passed in (Material: all packs and
 *   configs; Datapack Icons: the raw active.json), incl. parent-qualified keys
 *   placed in matching (also deep), non-matching and grand-parent directories,
 * - per document: every parent-qualified extension's directory combined with
 *   the other keys ending in the same extension (equal-specificity ties),
 * - data pack / resource pack / Bedrock add-on / mod source trees,
 * - every VS Code built-in language filename / extension and samples for every
 *   filenamePattern,
 * - association keys of the parity configs,
 * - game-server trees, mixed case, dotfiles, multi-dot names, >255 chars,
 *   unicode, whitespace and other exotic names.
 *
 * Randomness only comes from a seeded PRNG, so the corpus is identical on
 * every run.
 */

import type { Case } from './oracle.ts';
import type { LanguageContribution } from './vscode/languages.ts';
import type { IconsAssociation, IconThemeDocument } from './vscode/iconTheme.ts';

export interface CorpusInput {
	manifests: IconThemeDocument[];
	languages: LanguageContribution[];
	/** Extra association keys (Material files.associations syntax). */
	fileAssociationKeys?: string[];
	/** Extra association keys (Material folders.associations syntax). */
	folderAssociationKeys?: string[];
	seed?: number;
}

/** mulberry32 */
function prng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const PLAIN_DIRS = ['/', '/home/container', '/srv/Server', '/plugins/Essentials', '/A B/My Dir', 'plugins/', '//data//world//', null, ''];

/** Game-server style trees (Minecraft, Source, Rust, Valheim, Node, Python, ...). */
const GAME_FILES: Array<[string, string | null]> = [
	['server.properties', '/'], ['eula.txt', '/'], ['ops.json', '/'], ['whitelist.json', '/'], ['banned-players.json', '/'],
	['banned-ips.json', '/'], ['usercache.json', '/'], ['bukkit.yml', '/'], ['spigot.yml', '/'], ['paper.yml', '/'],
	['paper-global.yml', '/config'], ['paper-world-defaults.yml', '/config'], ['purpur.yml', '/'], ['commands.yml', '/'],
	['permissions.yml', '/'], ['help.yml', '/'], ['server.jar', '/'], ['paper-1.21.4-232.jar', '/'], ['start.sh', '/'],
	['start.bat', '/'], ['run.sh', '/'], ['user_jvm_args.txt', '/'], ['unix_args.txt', '/libraries/net/minecraftforge/forge/1.20.1-47.2.0'],
	['level.dat', '/world'], ['level.dat_old', '/world'], ['session.lock', '/world'], ['uid.dat', '/world'], ['r.0.0.mca', '/world/region'],
	['r.-1.2.mca', '/world_nether/DIM-1/region'], ['c.0.0.mcc', '/world/region'], ['latest.log', '/logs'], ['2024-01-01-1.log.gz', '/logs'],
	['debug.log', '/logs'], ['crash-2024-01-01_00.00.00-server.txt', '/crash-reports'], ['server-icon.png', '/'], ['pack.mcmeta', '/world/datapacks/my-pack'],
	['load.mcfunction', '/world/datapacks/my-pack/data/ns/function'], ['house.nbt', '/world/generated/minecraft/structures'], ['house.snbt', '/'],
	['castle.schem', '/plugins/WorldEdit/schematics'], ['old.schematic', '/plugins/WorldEdit/schematics'], ['base.litematic', '/schematics'],
	['script.sk', '/plugins/Skript/scripts'], ['-disabled.sk', '/plugins/Skript/scripts'], ['config.yml', '/plugins/Essentials'], ['messages.yml', '/plugins/Essentials'],
	['plugin.yml', '/'], ['forge-common.toml', '/config'], ['mods.toml', '/META-INF'], ['fabric.mod.json', '/'], ['sodium.jar.disabled', '/mods'],
	['modpack.mrpack', '/'], ['server.cfg', '/csgo/cfg'], ['autoexec.cfg', '/cfg'], ['gameinfo.txt', '/csgo'], ['de_dust2.bsp', '/csgo/maps'],
	['de_dust2.nav', '/csgo/maps'], ['pak01_dir.vpk', '/csgo'], ['appmanifest_740.acf', '/steamapps'], ['libraryfolders.vdf', '/steamapps'],
	['admins.cfg', '/addons/sourcemod/configs'], ['basecommands.sp', '/addons/sourcemod/scripting'], ['basecommands.smx', '/addons/sourcemod/plugins'],
	['amxmodx.sma', '/addons/amxmodx/scripting'], ['admin.amxx', '/addons/amxmodx/plugins'], ['sourcemod.inc', '/addons/sourcemod/scripting/include'],
	['srcds_run', '/'], ['srcds_linux', '/'], ['steam_appid.txt', '/'], ['RustDedicated', '/'], ['RustDedicated_Data', '/'], ['valheim_server.x86_64', '/'],
	['UnityPlayer.so', '/'], ['steamclient.so', '/linux64'], ['steam_api64.dll', '/'], ['TerrariaServer.exe', '/'], ['oxide.config.json', '/oxide'],
	['MyPlugin.cs', '/oxide/plugins'], ['Game.ini', '/ShooterGame/Saved/Config/LinuxServer'], ['GameUserSettings.ini', '/ShooterGame/Saved/Config/LinuxServer'],
	['Engine.pak', '/Content/Paks'], ['world.db', '/'], ['database.sqlite', '/'], ['luckperms-h2-v2.mv.db', '/plugins/LuckPerms'], ['.env', '/'],
	['.env.example', '/'], ['Dockerfile', '/'], ['docker-compose.yml', '/'], ['backup.zip', '/backups'], ['backup-2024.tar.gz', '/backups'],
	['world.7z', '/backups'], ['world.rar', '/backups'], ['server.pid', '/'], ['bun.lock', '/'], ['package.json', '/'], ['package-lock.json', '/'],
	['index.js', '/'], ['bot.py', '/'], ['requirements.txt', '/'], ['main.go', '/'], ['Cargo.toml', '/'], ['Cargo.lock', '/'], ['bot.rb', '/'],
	['Gemfile', '/'], ['script.lua', '/garrysmod/lua/autorun'], ['init.luau', '/'], ['addon.txt', '/garrysmod/addons/my-addon'],
	['server.old', '/'], ['server.tmp', '/'], ['config.bak', '/'], ['velocity.toml', '/'], ['forwarding.secret', '/'], ['waterfall.yml', '/'],
	['BepInEx.cfg', '/BepInEx/config'], ['doorstop_config.ini', '/'], ['start_server.sh', '/'], ['build.gradle.kts', '/'], ['pom.xml', '/'],
	['gradlew', '/'], ['gradlew.bat', '/'], ['mc.service', '/etc/systemd/system'], ['backup.timer', '/etc/systemd/system'], ['php.phar', '/'],
	['composer.phar', '/'], ['install.log', '/'], ['nohup.out', '/'], ['screenlog.0', '/'], ['core.12345', '/'], ['hs_err_pid1234.log', '/'],
	['options.txt', '/'], ['servers.dat', '/'], ['playerdata.dat', '/world/playerdata'], ['0b3a7c9e-1234.dat', '/world/playerdata'],
	['0b3a7c9e-1234.json', '/world/stats'], ['idcounts.dat', '/world/data'], ['raids.dat', '/world/data'], ['Steam.dll', '/'], ['server.xml', '/'],
];

const GAME_FOLDERS: Array<[string, string | null]> = [
	['world', '/'], ['world_nether', '/'], ['world_the_end', '/'], ['plugins', '/'], ['mods', '/'], ['config', '/'], ['configs', '/'],
	['logs', '/'], ['crash-reports', '/'], ['resourcepacks', '/'], ['datapacks', '/world'], ['defaultconfigs', '/'], ['serverconfig', '/world'],
	['kubejs', '/'], ['libraries', '/'], ['versions', '/'], ['cache', '/'], ['region', '/world'], ['playerdata', '/world'], ['stats', '/world'],
	['advancements', '/world'], ['data', '/world'], ['DIM-1', '/world_nether'], ['DIM1', '/world_the_end'], ['scripts', '/kubejs'],
	['server_scripts', '/kubejs'], ['cfg', '/csgo'], ['addons', '/csgo'], ['maps', '/csgo'], ['garrysmod', '/'], ['csgo', '/'], ['tf', '/'],
	['cstrike', '/'], ['sourcemod', '/addons'], ['disabled', '/plugins'], ['.git', '/'], ['.github', '/'], ['workflows', '/.github'],
	['node_modules', '/'], ['backups', '/'], ['BepInEx', '/'], ['oxide', '/'], ['Saved', '/ShooterGame'], ['Content', '/'], ['Binaries', '/'],
	['Essentials', '/plugins'], ['LuckPerms', '/plugins'], ['WorldEdit', '/plugins'], ['schematics', '/plugins/WorldEdit'], ['steamapps', '/'],
	['linux64', '/'], ['.steam', '/home/container'], ['.cache', '/home/container'], ['tmp', '/'], ['src', '/'], ['bin', '/'], ['lib', '/'],
	['public', '/'], ['dist', '/'], ['vendor', '/'], ['.config', '/home/container'], ['META-INF', '/'], ['assets', '/'], ['textures', '/assets/minecraft'],
	['lang', '/assets/minecraft'], ['Logs', '/'], ['PLUGINS', '/'], ['World', '/'], ['crash_reports', '/'], ['KubeJS', '/'],
];

/** Data packs, resource packs, Bedrock add-ons and mod sources as found on Minecraft servers. */
const DP = '/world/datapacks/my-pack';
const RP = '/resourcepacks/my-rp/assets/minecraft';
const BP = '/behavior_packs/my-bp';
const BRP = '/resource_packs/my-rp';
const DATAPACK_FILES: Array<[string, string | null]> = [
	['pack.mcmeta', DP], ['pack.png', DP], ['main.mcfunction', DP + '/data/ns/function'], ['tick.mcfunction', DP + '/data/ns/functions'],
	['load.json', DP + '/data/minecraft/tags/function'], ['tick.json', DP + '/data/minecraft/tags/function'], ['load.json', DP + '/data/minecraft/tags/functions'],
	['load.json', DP + '/data/minecraft/tags'], ['tick.json', '/'], ['root.json', DP + '/data/ns/advancement'], ['root.json', DP + '/data/ns/advancements'],
	['stone.json', DP + '/data/ns/loot_table/blocks'], ['stone.json', DP + '/data/ns/loot_table'], ['diamond.json', DP + '/data/ns/recipe'],
	['house.nbt', DP + '/data/ns/structure'], ['house.nbt', DP + '/data/ns/structures'], ['house.nbt', DP + '/data/ns/structure/village'],
	['plains.json', DP + '/data/ns/worldgen/biome'], ['x.json', DP + '/data/ns/dimension'], ['x.json', DP + '/data/ns/dimension_type'],
	['x.json', DP + '/data/ns/enchantment'], ['x.json', DP + '/data/ns/damage_type'], ['x.json', DP + '/data/ns/predicate'], ['x.json', DP + '/data/ns/item_modifier'],
	['x.json', DP + '/data/ns/trim_material'], ['x.json', DP + '/data/ns/jukebox_song'], ['x.json', DP + '/data/ns/dialog'], ['x.mcdoc', DP],
	['types.mcdoc', '/mcdoc'], ['spyglass.json', '/'], ['x.spyglass.json', '/'], ['beet.json', '/'], ['beet.yml', '/'], ['x.bolt', '/'], ['x.jmc', '/'],
	['x.hjmc', '/'], ['x.mcb', '/'], ['x.fl', '/'], ['flare.json', '/'], ['x.ajblueprint', '/'], ['sandstone.config.ts', '/'],
	['stone.json', RP + '/models/block'], ['stone.json', RP + '/models'], ['stone.json', RP + '/blockstates'], ['en_us.json', RP + '/lang'],
	['en_us.lang', '/texts'], ['stone.png', RP + '/textures/block'], ['stone.png.mcmeta', RP + '/textures/block'], ['blocks.json', RP + '/atlases'],
	['blocks.json', RP], ['sounds.json', RP], ['default.json', RP + '/font'], ['flame.json', RP + '/particles'], ['x.json', RP + '/items'],
	['x.json', RP + '/equipment'], ['x.json', RP + '/shaders'], ['x.json', RP + '/post_effect'], ['x.vsh', RP + '/shaders/core'], ['x.fsh', RP + '/shaders/core'],
	['x.json', RP + '/waypoint_style'], ['splashes.txt', RP + '/texts'], ['x.json', RP + '/color_grading'],
	['manifest.json', BP], ['manifest.json', BRP], ['x.json', BP + '/entities'], ['x.json', BP + '/blocks'], ['x.json', BP + '/feature_rules'],
	['x.json', BP + '/features'], ['x.json', BP + '/spawn_rules'], ['x.json', BP + '/trading'], ['x.json', BP + '/loot_tables'], ['x.json', BP + '/recipes'],
	['x.json', BRP + '/entity'], ['x.json', BRP + '/attachables'], ['x.json', BRP + '/ui'], ['x.json', BRP + '/fogs'], ['x.json', BRP + '/cameras'],
	['x.render_controllers.json', BRP + '/render_controllers'], ['render_controllers.json', BRP + '/render_controllers'], ['x.json', BRP + '/render_controllers'],
	['x.animation.json', BRP + '/animations'], ['animation.json', BRP + '/animations'], ['x.json', BRP + '/animations'], ['x.json', BRP + '/animation_controllers'],
	['terrain_texture.json', BRP + '/textures'], ['flipbook_textures.json', BRP + '/textures'], ['terrain_texture.json', BRP], ['biomes_client.json', BRP],
	['client_biome.json', BRP], ['blocks.json', BRP], ['x.json', BRP + '/block_culling'], ['x.json', BRP + '/atmospherics'], ['x.mcpack', '/'],
	['x.mcaddon', '/'], ['x.mcworld', '/'], ['x.mcstructure', '/structures'], ['x.bbmodel', '/models'], ['.mcattributes', '/'], ['.mcdefinitions', '/'],
	['ExampleMixin.java', '/src/main/java/com/example/mixins'], ['ExampleMixin.java', '/src/main/java/com/example/mixin'], ['x.mixins.json', '/src/main/resources'],
	['x.mixins.json', '/src/main/resources/mixins'], ['x.refmap.json', '/'], ['fabric.mod.json', '/src/main/resources'], ['fabric-mod.json', '/'],
	['quilt.mod.json', '/'], ['mods.toml', '/src/main/resources/META-INF'], ['neoforge.mods.toml', '/src/main/resources/META-INF'], ['mcmod.info', '/'],
	['accesstransformer.cfg', '/META-INF'], ['modrinth.index.json', '/'], ['x.modrinth.json', '/'], ['build.gradle', '/'], ['build.gradle.kts', '/'],
	['settings.gradle.kts', '/'], ['x.loom.gradle', '/'], ['gradle.properties', '/'], ['gradle-wrapper.properties', '/gradle/wrapper'],
	['ci.yml', '/.github/workflows'], ['ci.yaml', '/.github/workflows'], ['ci.yml', '/workflows'], ['config.toml', '/.cargo'], ['config.toml', '/'],
	['init.lua', '/home/container/.config/nvim'], ['init.vim', '/nvim'], ['init.lua', '/'], ['paper-plugin.yml', '/'], ['paper-world.yml', '/world'],
	['plugin.yaml', '/'], ['bukkit.yaml', '/'], ['spigot.yaml', '/'], ['purpur.yaml', '/'], ['CHANGELOG', '/'], ['changelog.md', '/'], ['Changelog.Txt', '/'],
	['README', '/'], ['readme.md', '/'], ['LICENSE', '/'], ['License.txt', '/'], ['COPYRIGHT', '/'], ['CODE_OF_CONDUCT.md', '/'], ['CONTRIBUTING', '/'],
	['todo.md', '/'], ['TODO.txt', '/'], ['requirements.txt', '/'], ['pyproject.toml', '/'], ['Pipfile', '/'], ['pipfile', '/'], ['Gemfile', '/'],
	['Cargo.toml', '/'], ['cargo.TOML', '/x'], ['project.godot', '/'], ['pdxinfo', '/'], ['pixi.toml', '/'], ['conf', '/'], ['config', '/'],
	['settings.json', '/.vscode'], ['appsettings.json', '/'], ['x.env.local', '/'], ['.env.production', '/'], ['x.conf.dist', '/'], ['x.hc.z', '/'],
	['x.nim.cfg', '/'], ['x.md.rendered', '/'], ['x.test.ts', '/'], ['x.test.js', '/'], ['x.config.ts', '/'], ['x.config.js', '/'], ['x.lock.json', '/'],
	['level.dat', '/'], ['level.dat', '/world'], ['Level.DAT', '/world'],
];

const DATAPACK_FOLDERS: Array<[string, string | null]> = [
	['datapacks', '/world'], ['my-pack', '/world/datapacks'], ['data', DP], ['assets', '/resourcepacks/my-rp'], ['minecraft', DP + '/data'],
	['function', DP + '/data/ns'], ['functions', DP + '/data/ns'], ['tags', DP + '/data/minecraft'], ['advancement', DP + '/data/ns'],
	['loot_table', DP + '/data/ns'], ['worldgen', DP + '/data/ns'], ['structure', DP + '/data/ns'], ['models', RP], ['textures', RP], ['lang', RP],
	['shaders', RP], ['blockstates', RP], ['font', RP], ['entities', BP], ['render_controllers', BRP], ['animations', BRP], ['ui', BRP], ['src', '/'],
	['Src', '/x'], ['buildSrc', '/'], ['buildsrc', '/'], ['.github', '/'], ['.vscode', '/'], ['node_modules', '/'], ['test', '/'], ['__tests__', '/'],
	['.idea', '/'], ['gradle', '/'], ['build', '/'], ['out', '/'], ['libs', '/'], ['mixins', '/src/main/java/com/example'], ['world', '/'],
];

const EXOTIC_FILES: Array<[string, string | null]> = [
	['a'.repeat(251) + '.mca', '/'], // exactly 255 UTF-16 units
	['a'.repeat(252) + '.mca', '/'], // 256 -> VS Code adds no extension classes
	['b'.repeat(300) + '.ts', '/'],
	['c'.repeat(260), '/'],
	['\u{1F600}'.repeat(130) + '.mcfunction', '/'], // 130 code points but 260 UTF-16 units
	['\u{1F600}'.repeat(60) + '.mcfunction', '/'],
	['İ'.repeat(126) + '.mca', '/'], // 'İ' lowercases to 2 UTF-16 units
	['İ'.repeat(120) + '.mca', '/'],
	['é'.repeat(250) + '.mca', '/'],
	['é'.repeat(252) + '.mca', '/'],
	['ΣΑΣ.TXT', '/'], ['İndex.MD', '/'], ['Straße.Txt', '/'], ['ЦЕНТР.json', '/'],
	['PACKAGE.JSON', '/'], // KELVIN SIGN lowercases to ASCII 'k' -> package.json
	['ẞ.yml', '/'], ['ﬁle.txt', '/'], ['Ångström.PNG', '/'], ['\u{1F525}.js', '/'], ['\u{1F525}', '/'],
	['my file.txt', '/'], ['my\tfile.txt', '/'], ['my file.txt', '/'], ['a b.c d', '/'], [' leading.ts', '/'], ['trailing.ts ', '/'],
	['package .json', '/'], ['package.json ', '/'], ['PACKAGE.JSON', '/A B'], ['.', '/'], ['..', '/'], ['...', '/'], ['a.', '/'], ['a..b', '/'],
	['.a.', '/'], ['..json', '/'], ['x..ncurc.json', '/'], ['.ncurc.json', '/'], ['x.y.z.w.v.u.t.s.json', '/'], ['a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.d.ts', '/'],
	['Dockerfile.', '/'], ['Dockerfile.a\\b', '/'], ['foo\\Dockerfile.x', '/'], ['foo\\bar.json', '/'], ['tsconfig.x\\y.json', '/'],
	['tsconfig.a.json\n', '/'], ['Jenkinsfile\n', '/'], ['[id].tsx', '/'], ['{x}.json', '/'], ['*.txt', '/'], ['a?b.md', '/'], ['100%.txt', '/'],
	['#temp#.log', '/'], ['file:name.txt', '/'], ['con.txt', '/'], ['~$doc.docx', '/'], ['.#lock', '/'], ['-', '/'], ['--version', '/'],
	['60', '/'], ['x.60', '/'], ['001', '/'], ['x.001', '/'], ['0', '/'], ['123.456', '/'],
	['config', '/repo/.git'], ['config', '/repo/.GIT'], ['CONFIG', '/home/u/.config/git'], ['config', '/.git'], ['config', '/git'],
	['done', '/repo/.git/rebase-merge'], ['done', '/rebase-merge'], ['DONE', '/x/Rebase-Merge'],
	['x.json', '/home/u/.config/Code/User/snippets'], ['x.json', '/home/u/.config/Code/User/profiles/abc/snippets'], ['snippets.json', '/'],
	['my-snippets.json', '/'], ['snippetsfoo.json', '/a'], ['hooks.json', '/repo/.github/hooks'], ['a.json', '/repo/.github/hooks/sub'],
	['x.mdc', '/p/.cursor/rules'], ['x.mdc', '/p/.cursor'], ['x.md', '/p/.claude/rules/a/b'], ['x.md', '/p/.claude/agents'],
	['x.md', '/p/.github/agents'], ['compose.yml', '/'], ['compose.prod.yaml', '/'], ['my-docker-compose.yml', '/'], ['docker.compose.yaml', '/'],
	['tsconfig.base.json', '/'], ['jsconfig-x.json', '/'], ['Containerfile.dev', '/'], ['.env.local', '/'], ['.env.foo', '/'], ['.ENV.Bar', '/'],
	['JENKINSFILE.groovy', '/'], ['jenkinsfile-prod', '/'], ['gitconfig', '/'], ['OCamlMakefile', '/'], ['x.gitconfig', '/'], ['x.editorconfig', '/'],
	['my-language-configuration.json', '/'], ['language-configuration.json', '/'], ['x.icon-theme.json', '/'], ['x.log.1', '/'], ['*.log.?', '/'],
	['foo.log.?', '/'], ['copilot-instructions.md', '/'], ['x.copilot-instructions.md', '/'], ['SKILL.md', '/'], ['skill.MD', '/x'],
	['foo.hpp.in', '/'], ['foo.h.in', '/'], ['x.PL', '/'], ['x.pl', '/'], ['foo.ts.map', '/'], ['foo.js.map', '/'], ['foo.pdm.toml', '/'],
	['pdm.toml', '/'], ['foo.drone.yml', '/'], ['x.toml', '/'], ['x.TOML', '/'], ['vercel.json', '/'], ['next.config.js', '/'],
	['postcssrc.json', '/.config'], ['postcssrc.json', '/home/.CONFIG'], ['postcssrc.json', '/.config/sub'], ['.postcssrc.json', '/.config'],
	// whitespace in parent directories / two-slash association keys
	['notes.txt', '/srv/my dir'], ['notes.txt', '/srv/my\tdir'], ['notes.txt', '/srv/my/dir'], ['x.txt', '/deep er'], ['x.txt', '/deep/er'],
	['x.txt', '/deep　er'], ['foo.', '/'],
	// U+017F LATIN SMALL LETTER LONG S: Unicode case folding maps it to 's', JS non-unicode /i and toLowerCase() do not
	['Jenkinſfile', '/'], ['jenkinſfile.prod', '/'], ['ſerver.properties', '/'], ['compoſe.yaml', '/'],
	['x.mpp', '/'], ['X.MXX', '/'], ['tsconfig.json', '/'], ['x.config.json', '/'],
	// parent-qualified extension association ('*.plugins/yml') vs 2-segment built-in extensions (equal specificity)
	['foo.gitlab-ci.yml', '/plugins'], ['x.docker-compose.yml', '/plugins'], ['config.yml', '/plugins'], ['a.b.yml', '/plugins'], ['foo.gitlab-ci.yml', '/'],
	// `**/a/b` globs use VS Code's endsWith fast path (T4): a backslash is NOT a separator there
	['config', '/repo/x\\.git'], ['done', '/a\\rebase-merge'], ['config', '/home/u\\.config/git'],
];

function upperCase(s: string): string {
	return s.toUpperCase();
}

export function buildCorpus(input: CorpusInput): Case[] {
	const rnd = prng(input.seed ?? 0x5eed1234);
	const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
	const mixedCase = (s: string): string => {
		let out = '';
		for (const ch of s) {
			out += rnd() < 0.5 ? ch.toUpperCase() : ch.toLowerCase();
		}
		// make sure at least something changed when possible
		return out === s && s.toUpperCase() !== s ? s.toUpperCase() : out;
	};

	const cases: Case[] = [];
	const seen = new Set<string>();
	const add = (group: string, kind: Case['kind'], name: string, directory: string | null, mime: string | null = null) => {
		if (name === '' || name.includes('/')) {
			return; // not a valid entry name
		}
		const id = `${kind}\u0000${name}\u0000${directory === null ? '\u0001' : directory}\u0000${mime ?? ''}`;
		if (seen.has(id)) {
			return;
		}
		seen.add(id);
		cases.push({ kind, name, directory, mime, group });
	};

	// --- harvest keys from all manifests (dark + light, insertion order of first occurrence) ---
	const fileNameKeys = new Set<string>();
	const fileExtKeys = new Set<string>();
	const folderNameKeys = new Set<string>();
	const harvest = (a: IconsAssociation | undefined) => {
		if (!a) {
			return;
		}
		for (const k of Object.keys(a.fileNames ?? {})) fileNameKeys.add(k);
		for (const k of Object.keys(a.fileExtensions ?? {})) fileExtKeys.add(k);
		for (const k of Object.keys(a.folderNames ?? {})) folderNameKeys.add(k);
		for (const k of Object.keys(a.folderNamesExpanded ?? {})) folderNameKeys.add(k);
	};
	for (const m of input.manifests) {
		harvest(m);
		harvest(m.light);
		harvest(m.highContrast);
	}
	for (const k of input.fileAssociationKeys ?? []) {
		if (/^\*{1,2}\./.test(k)) {
			fileExtKeys.add(k.replace(/^\*{1,2}\./, ''));
		} else {
			fileNameKeys.add(k);
		}
	}
	for (const k of input.folderAssociationKeys ?? []) {
		folderNameKeys.add(k);
	}

	const splitKey = (k: string): [string | null, string] => {
		const i = k.lastIndexOf('/');
		return i < 0 ? [null, k] : [k.substring(0, i), k.substring(i + 1)];
	};

	// --- Material fileNames ---
	for (const key of fileNameKeys) {
		const [parent, name] = splitKey(key);
		if (parent === null) {
			add('theme:fileNames', 'file', name, '/');
			add('theme:fileNames', 'file', mixedCase(name), pick(PLAIN_DIRS));
			if (rnd() < 0.25) add('theme:fileNames', 'file', 'x' + name, pick(PLAIN_DIRS));
			if (rnd() < 0.25) add('theme:fileNames', 'file', name + '.bak', '/');
			if (rnd() < 0.1) add('theme:fileNames-as-folder', 'folder', name, '/');
		} else {
			add('theme:fileNames/parent', 'file', name, '/' + parent);
			add('theme:fileNames/parent', 'file', mixedCase(name), '/home/container/' + mixedCase(parent));
			add('theme:fileNames/parent', 'file', name, '/other');
			add('theme:fileNames/parent', 'file', name, '/' + parent + '/sub');
			add('theme:fileNames/parent', 'file', name, null);
		}
	}

	// --- Material fileExtensions ---
	for (const key of fileExtKeys) {
		const [parent, ext] = splitKey(key);
		const dir = parent === null ? '/' : '/' + parent;
		add('theme:fileExtensions', 'file', 'file.' + ext, dir);
		add('theme:fileExtensions', 'file', 'File.' + upperCase(ext), parent === null ? pick(PLAIN_DIRS) : '/X/' + mixedCase(parent));
		add('theme:fileExtensions', 'file', '.' + ext, dir);
		add('theme:fileExtensions', 'file', ext, dir);
		add('theme:fileExtensions', 'file', 'a.b.' + mixedCase(ext), dir);
		if (rnd() < 0.3) add('theme:fileExtensions', 'file', 'x' + ext, dir);
		if (rnd() < 0.3) add('theme:fileExtensions', 'file', 'x.' + ext + '.old', dir);
		if (rnd() < 0.15) add('theme:fileExtensions-as-folder', 'folder', 'dir.' + ext, '/');
		if (parent !== null) {
			// matching deep directory, sub directory of the parent, unrelated directory, unknown directory
			add('fileExtensions/parent', 'file', 'file.' + ext, '/world/datapacks/p/data/ns/' + parent);
			add('fileExtensions/parent', 'file', 'file.' + ext, '/' + parent + '/sub');
			add('fileExtensions/parent', 'file', 'file.' + ext, '/other');
			add('fileExtensions/parent', 'file', 'file.' + ext, null);
		}
	}

	// --- parent-qualified extensions vs. other keys with the same last segment, per manifest ---
	// (`p/json` has the specificity of a 2-segment extension: ties with `mixins.json` are decided by CSS rule order)
	for (const m of input.manifests) {
		const exts = Object.keys(m.fileExtensions ?? {});
		const names = Object.keys(m.fileNames ?? {});
		const qualified = exts.map(splitKey).filter((s): s is [string, string] => s[0] !== null);
		for (const [parent, ext] of qualified) {
			const tail = '.' + ext.toLowerCase();
			const dir = '/' + parent;
			for (const other of exts) {
				const [otherParent, otherExt] = splitKey(other);
				if (otherExt.toLowerCase().endsWith(tail) || (otherParent !== null && otherParent !== parent && otherExt.toLowerCase() === ext.toLowerCase())) {
					add('cross:ext/parent', 'file', 'x.' + otherExt, dir);
				}
			}
			for (const other of names) {
				const [otherParent, otherName] = splitKey(other);
				if (otherName.toLowerCase().endsWith(tail) && otherParent !== parent) {
					add('cross:name/parent', 'file', otherName, dir);
				}
			}
		}
	}

	// --- Material folderNames ---
	for (const key of folderNameKeys) {
		const [parent, name] = splitKey(key);
		if (parent === null) {
			add('theme:folderNames', 'folder', name, '/');
			add('theme:folderNames', 'folder', mixedCase(name), pick(PLAIN_DIRS));
			if (rnd() < 0.1) add('theme:folderNames', 'folder', name + 'x', '/');
			if (rnd() < 0.05) add('theme:folderNames-as-file', 'file', name, '/');
		} else {
			add('theme:folderNames/parent', 'folder', name, '/' + parent);
			add('theme:folderNames/parent', 'folder', mixedCase(name), '/srv/' + mixedCase(parent));
			add('theme:folderNames/parent', 'folder', name, '/other');
			add('theme:folderNames/parent', 'folder', name, '/' + parent + '/sub');
			add('theme:folderNames/parent', 'folder', name, null);
		}
	}

	// --- VS Code language associations ---
	for (const c of input.languages) {
		for (const fn of c.filenames ?? []) {
			add('vscode:filenames', 'file', fn, '/');
			add('vscode:filenames', 'file', upperCase(fn), pick(PLAIN_DIRS));
			add('vscode:filenames', 'file', 'x.' + fn, '/');
		}
		for (const ext of c.extensions ?? []) {
			add('vscode:extensions', 'file', 'f' + ext, '/');
			add('vscode:extensions', 'file', ext, pick(PLAIN_DIRS));
			add('vscode:extensions', 'file', 'F' + upperCase(ext), '/');
			add('vscode:extensions', 'file', 'my-' + ext + '.zzz', '/');
			if (!ext.startsWith('.')) add('vscode:extensions', 'file', 'my-' + ext, '/');
		}
		for (const pattern of c.filenamePatterns ?? []) {
			for (const sample of globSamples(pattern)) {
				const i = sample.lastIndexOf('/');
				const name = i < 0 ? sample : sample.substring(i + 1);
				const dir = i < 0 ? pick(PLAIN_DIRS) : '/' + sample.substring(0, i);
				add('vscode:patterns', 'file', name, dir);
				add('vscode:patterns', 'file', mixedCase(name), dir === null ? dir : mixedCase(dir));
			}
		}
	}

	// --- game-server trees ---
	for (const [name, dir] of GAME_FILES) {
		add('game:files', 'file', name, dir);
		add('game:files', 'file', name, null);
	}
	for (const [name, dir] of GAME_FOLDERS) {
		add('game:folders', 'folder', name, dir);
		add('game:folders', 'folder', name, null);
	}
	for (const [name, dir] of DATAPACK_FILES) {
		add('datapack:files', 'file', name, dir);
		add('datapack:files', 'file', name, null);
	}
	for (const [name, dir] of DATAPACK_FOLDERS) {
		add('datapack:folders', 'folder', name, dir);
		add('datapack:folders', 'folder', name, null);
	}

	// --- mime types must be ignored when mimeFallback is off ---
	const mimes = ['text/x-shellscript', 'text/x-python; charset=utf-8', 'application/json', 'image/png', 'application/zip', 'text/plain', 'application/octet-stream', 'video/mp4'];
	for (const name of ['start', 'run', 'LICENSE', 'srcds_run', 'data.bin', 'image', 'noext', 'server.jar', 'x.json']) {
		for (const mime of mimes) {
			add('mime', 'file', name, '/', mime);
		}
	}

	// --- exotic names ---
	for (const [name, dir] of EXOTIC_FILES) {
		add('exotic', 'file', name, dir);
	}
	for (const name of ['\u{1F525}', 'Ц', 'A B', 'a\tb', '.', '...', 'META-INF', 'Meta-Inf', 'İ', '60', '001', '__src__', '-src', '_src', '.src', 'src.', 'my folder', 'My　Folder', 'my\tfolder']) {
		add('exotic', 'folder', name, '/');
		add('exotic', 'folder', name, '/a b');
	}

	return cases;
}

/** A few concrete paths for a VS Code glob (matching samples; negative ones come from the mixed/other variants). */
export function globSamples(glob: string): string[] {
	const fill = (variant: number) => {
		let out = glob;
		// leading **/ : zero or several segments
		out = out.replace(/^\*\*\//, variant === 0 ? 'root/' : variant === 1 ? 'a/b/c/' : 'x/');
		out = out.replace(/\/\*\*\//g, variant === 0 ? '/' : '/deep/er/');
		out = out.replace(/\*/g, variant === 0 ? '' : variant === 1 ? 'abc' : 'x.y');
		out = out.replace(/\?/g, variant === 2 ? 'é' : 'q');
		return out;
	};
	return [...new Set([fill(0), fill(1), fill(2)])];
}
