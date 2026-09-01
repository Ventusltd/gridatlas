/**
 * Proof for tools/build-cartridge.mjs.
 *
 * Codex, 202609011955: the assembler is untrusted until it has its own
 * fail-fast and immutability coverage. Fair — it is the thing that will
 * write every future cartridge, and an assembler that silently produces
 * something plausible is worse than no assembler.
 *
 * What this proves, by running it as a subprocess against real files:
 *   - it refuses a missing part rather than emitting a short cartridge
 *   - it refuses a malformed or absent generation
 *   - it refuses to overwrite an existing generation (cartridges are
 *     immutable here)
 *   - it refuses to assemble nothing
 *   - the output contains every part, in the order given, and the parts
 *     manifest hashes each one and the whole
 *   - a rebuild from the same inputs is byte-identical
 *   - CRLF on disk does not change a hash: every digest is over LF
 *
 *   node tools/proofs/modules/202609012010-assembler.proof.mjs
 */

import { readFile, writeFile, rm, mkdir, access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const BUILDER = join(REPO, 'tools', 'build-cartridge.mjs');
const SCRATCH = join(REPO, 'tools', 'proofs', 'modules', '.assembler-scratch');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

function run(args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [BUILDER, ...args],
    { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...extraEnv } });
  return { code: result.status, out: result.stdout || '', err: result.stderr || '' };
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

await mkdir(SCRATCH, { recursive: true });
const PART_A = 'tools/proofs/modules/.assembler-scratch/part-a.js';
const PART_B = 'tools/proofs/modules/.assembler-scratch/part-b.js';
await writeFile(join(REPO, PART_A), "/* A */\nconst A = 1;\n", 'utf8');
// Written with CRLF deliberately: the estate hashes LF bytes, and a
// Windows working copy is where that promise gets broken.
await writeFile(join(REPO, PART_B), "/* B */\r\nconst B = 2;\r\n", 'utf8');

const GEN_OK = '209912310101';
const GEN_TWO = '209912310202';
const GEN_MANIFEST = '209912310303';
const GEN_FAIL = '209912310404';
const NAME = 'assembler-proof';
const outputFor = (generation) =>
  join(REPO, 'atlas', 'cartridges', `${generation}-${NAME}.js`);
const manifestFor = (generation) =>
  join(REPO, 'atlas', 'manifests', `${generation}-${NAME}-parts.json`);
async function existsForProof(path) {
  try { await access(path, constants.F_OK); return true; }
  catch { return false; }
}

async function cleanup() {
  for (const generation of [GEN_OK, GEN_TWO, GEN_MANIFEST, GEN_FAIL]) {
    await rm(outputFor(generation), { force: true });
    await rm(manifestFor(generation), { force: true });
  }
  await rm(SCRATCH, { recursive: true, force: true });
}

console.log('\nit refuses rather than guessing\n');

check('a missing generation is refused',
  run(['--name', NAME, '--part', PART_A]).code !== 0);
check('a malformed generation is refused',
  run(['--generation', 'tomorrow', '--name', NAME, '--part', PART_A]).code !== 0);
check('a missing name is refused',
  run(['--generation', GEN_OK, '--part', PART_A]).code !== 0);
check('assembling nothing is refused',
  run(['--generation', GEN_OK, '--name', NAME]).code !== 0);

const missing = run(['--generation', GEN_OK, '--name', NAME,
  '--part', 'tools/proofs/modules/.assembler-scratch/not-here.js']);
check('a missing part is refused, loudly',
  missing.code !== 0 && /missing part/.test(missing.err));
let wroteAnyway = true;
try { await access(outputFor(GEN_OK), constants.F_OK); }
catch { wroteAnyway = false; }
check('and nothing is written when it refuses', wroteAnyway === false);

console.log('\nit assembles exactly what it was given\n');

const first = run(['--generation', GEN_OK, '--name', NAME,
  '--carry', PART_A, '--module', PART_B]);
check('a valid assembly succeeds', first.code === 0, first.err.slice(0, 120));

const assembled = await readFile(outputFor(GEN_OK), 'utf8');
check('every part is present', assembled.includes('const A = 1;')
  && assembled.includes('const B = 2;'));
check('parts appear in the order given',
  assembled.indexOf('const A = 1;') < assembled.indexOf('const B = 2;'));
check('the header names the parts and their roles',
  /carried_shell_script\s+tools\/proofs\/modules\/\.assembler-scratch\/part-a\.js/.test(assembled)
  && /module\s+tools\/proofs\/modules\/\.assembler-scratch\/part-b\.js/.test(assembled));
check('the header tells a reader not to edit the output',
  /Do not edit\s*\n?\s*\*?\s*this file/.test(assembled));

const manifest = JSON.parse(await readFile(manifestFor(GEN_OK), 'utf8'));
check('the manifest hashes the whole cartridge correctly',
  manifest.sha256 === sha256(assembled), manifest.sha256.slice(0, 12));
check('the manifest hashes each part', manifest.assembled_from.length === 2
  && manifest.assembled_from.every(part => /^[0-9a-f]{64}$/.test(part.sha256)));
check('a carried shell script is recorded as carried, not as a module',
  manifest.assembled_from[0].role === 'carried_shell_script'
  && manifest.assembled_from[1].role === 'module');

console.log('\nCRLF on disk does not change a digest\n');
const partBSource = await readFile(join(REPO, PART_B), 'utf8');
check('the part really is CRLF on disk', partBSource.includes('\r\n'));
check('its recorded digest is over LF bytes',
  manifest.assembled_from[1].sha256 === sha256(partBSource.replace(/\r\n/g, '\n')));
check('the assembled cartridge carries no CR', !assembled.includes('\r'));

console.log('\nimmutability, and repeatability\n');
const again = run(['--generation', GEN_OK, '--name', NAME,
  '--carry', PART_A, '--module', PART_B]);
check('it refuses to overwrite an existing generation',
  again.code !== 0 && /refusing to overwrite/.test(again.err));
check('the existing cartridge is untouched by the refusal',
  (await readFile(outputFor(GEN_OK), 'utf8')) === assembled);

console.log('\nboth members, or neither\n');
/* Carried from Claude's v9.63 attempt, which Codex's implementation
   superseded: the cases below prove nothing is left behind on failure,
   and these three prove the successful pair really is a pair - a manifest
   that names the cartridge beside it and hashes the bytes on disk. */
check('a successful assembly leaves BOTH the cartridge and its manifest',
  assembled.length > 0 && /^[0-9a-f]{64}$/.test(manifest.sha256));
check('the manifest names the cartridge it was written beside',
  manifest.cartridge.endsWith(`${GEN_OK}-${NAME}.js`));
check('the manifest digest matches the bytes on disk',
  manifest.sha256 === sha256(await readFile(outputFor(GEN_OK), 'utf8')));

const manifestSentinel = 'manifest owned by another invocation\n';
await writeFile(manifestFor(GEN_MANIFEST), manifestSentinel, { encoding: 'utf8', flag: 'wx' });
const manifestCollision = run(['--generation', GEN_MANIFEST, '--name', NAME,
  '--carry', PART_A, '--module', PART_B]);
check('a manifest-only collision is refused before publishing a cartridge',
  manifestCollision.code !== 0 && /existing manifest/.test(manifestCollision.err));
check('the pre-existing manifest is byte-identical after refusal',
  (await readFile(manifestFor(GEN_MANIFEST), 'utf8')) === manifestSentinel);
check('a manifest collision leaves no orphan cartridge',
  !(await existsForProof(outputFor(GEN_MANIFEST))));

const injected = run(['--generation', GEN_FAIL, '--name', NAME,
  '--carry', PART_A, '--module', PART_B], {
  NODE_ENV: 'test', GRIDATLAS_ASSEMBLER_FAIL_STAGE: 'after-cartridge'
});
check('an injected second-stage publication failure is reported',
  injected.code !== 0 && /injected failure/.test(injected.err));
check('a failed second-stage publication removes the cartridge',
  !(await existsForProof(outputFor(GEN_FAIL))));
check('a failed second-stage publication leaves no manifest',
  !(await existsForProof(manifestFor(GEN_FAIL))));
const leftovers = [
  ...(await readdir(join(REPO, 'atlas', 'cartridges'))),
  ...(await readdir(join(REPO, 'atlas', 'manifests')))
].filter(file => file.includes(GEN_FAIL) && file.includes('.tmp-'));
check('failed publication removes both staged files', leftovers.length === 0,
  leftovers.join(', '));

const second = run(['--generation', GEN_TWO, '--name', NAME,
  '--carry', PART_A, '--module', PART_B]);
check('the same inputs under a new generation assemble again', second.code === 0);
const assembledTwo = await readFile(outputFor(GEN_TWO), 'utf8');
check('and differ only by the generation stamp',
  assembledTwo.split('\n').filter(line => !line.includes(GEN_TWO)).join('\n')
  === assembled.split('\n').filter(line => !line.includes(GEN_OK)).join('\n'));

await cleanup();
console.log('\nscratch and test artefacts removed');

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}
console.log('the assembler refuses what it cannot verify, records what it used, '
  + 'and will not rewrite a generation that already exists.');
