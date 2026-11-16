/**
 * `bun run test`: oracle self-tests, data checks, PHP unit checks, VS Code parity.
 *
 * PHP binary: env PHP_BINARY (fallback `php`). Exit code != 0 on any failure.
 * The Datapack Icons parts read the raw theme from the VSIX cached by
 * `bun run build` (scripts/.cache/); a missing cache fails with a hint.
 * Env: PARITY_EXAMPLES=<n> examples per mismatch group (default 4),
 *      DATAPACK_VSIX=<file> use another (sha256-verified) copy of the VSIX.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runDataChecks } from '../tests/data.ts';
import { DatapackSourceError, loadDatapackSource } from '../tests/oracle/datapack.ts';
import { runOracleSelfTests } from '../tests/oracle/selftest.ts';
import { runParity } from '../tests/parity.ts';

const root = join(import.meta.dir, '..');
const php = process.env.PHP_BINARY || 'php';
let failed = false;

function step(title: string): void {
	console.log(`\n== ${title}`);
}

// 0. Datapack Icons source (cached VSIX) -------------------------------------
let datapackOk = true;
try {
	const dp = loadDatapackSource(root);
	console.log(`Datapack Icons ${dp.version}: ${dp.vsixPath} (sha256 ok, ${dp.svgs.size} svgs)`);
} catch (e) {
	if (!(e instanceof DatapackSourceError)) throw e;
	console.log(`\nERROR ${e.message}`);
	datapackOk = false;
	failed = true;
}

// 1. oracle self-tests -------------------------------------------------------
step('oracle self-tests');
{
	const r = runOracleSelfTests(root);
	for (const f of r.failures) console.log(`  FAIL ${f}`);
	console.log(`oracle: ${r.passed} passed, ${r.failures.length} failed`);
	if (r.failures.length) failed = true;
}

// preconditions for the PHP parts ----------------------------------------------
const required = [
	'resources/data/material.php',
	'resources/data/datapack.php',
	'resources/data/languages.php',
	'src/Icons/IconResolver.php',
	'src/Icons/IconTheme.php',
];
const missing = required.filter(f => !existsSync(join(root, f)));
let phpOk = missing.length === 0;
if (!phpOk) {
	console.log(`\nmissing ${missing.join(', ')} (run \`bun run build\` / implement src/Icons first)`);
	failed = true;
} else {
	let version: string | null = null;
	let error = '';
	try {
		const probe = Bun.spawnSync([php, '-r', 'echo PHP_VERSION;'], { stdout: 'pipe', stderr: 'pipe' });
		if (probe.exitCode === 0) {
			version = probe.stdout.toString().trim();
		} else {
			error = probe.stderr.toString().trim();
		}
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	if (version === null) {
		console.log(`\ncannot run PHP binary "${php}" (set PHP_BINARY): ${error}`);
		failed = true;
		phpOk = false;
	} else {
		console.log(`\nPHP ${version} (${php})`);
	}
}

if (phpOk) {
	// 2. data checks against the upstream sources ------------------------------
	if (datapackOk) {
		step('tests/data.ts (generated data vs. upstream sources)');
		try {
			const r = runDataChecks(php, root);
			for (const f of r.failures) console.log(`  FAIL ${f}`);
			console.log(`data: ${r.passed} passed, ${r.failures.length} failed`);
			if (r.failures.length) failed = true;
		} catch (e) {
			console.log(`data checks crashed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
			failed = true;
		}
	}

	// 3. PHP unit checks -------------------------------------------------------
	step('tests/php/unit.php');
	{
		const r = Bun.spawnSync([php, join(root, 'tests/php/unit.php')], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
		const out = (r.stdout.toString() + r.stderr.toString()).trim();
		console.log(out);
		if (r.exitCode !== 0) failed = true;
	}

	// 4. parity ----------------------------------------------------------------
	step('parity (VS Code oracle vs PHP)');
	try {
		const report = await runParity({ php, root, examples: Number(process.env.PARITY_EXAMPLES ?? '4') });
		console.log(report.lines.join('\n'));
		if (!report.ok) failed = true;
	} catch (e) {
		console.log(`parity crashed: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
		failed = true;
	}
}

console.log(`\n${failed ? 'TESTS FAILED' : 'ALL TESTS PASSED'}`);
process.exit(failed ? 1 : 0);
