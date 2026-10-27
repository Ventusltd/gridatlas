/**
 * Proof: an assembled cartridge still matches the parts it was built from.
 *
 * The hole this closes was opened by my own hand. tools/build-cartridge.mjs
 * writes a parts manifest recording the SHA-256 of every part that went
 * into a cartridge — and then nothing ever looked at it again. I edited
 * atlas/modules/202609012040-grid-scope.js after the 202609012045
 * composition had already assembled it, and every gate in the estate
 * still passed 526/526, because they all test the CARTRIDGE bytes, which
 * had not moved. The manifest was a receipt no one was checking.
 *
 * Two rules, and they are deliberately different:
 *
 *   1. Every cartridge that has a parts manifest must still hash to the
 *      digest that manifest records. Cartridges are immutable here; a
 *      drift is an edited artefact and is always a failure.
 *
 *   2. For the cartridges in the CURRENT composition, every part must
 *      still hash to its record too — otherwise the thing being served
 *      cannot be rebuilt from the tree that claims to produce it. A
 *      superseded generation is exempt: its parts are allowed to have
 *      moved on, which is the whole point of a new generation.
 *
 * Rule 2 is what fails on a tree where a part was edited without
 * reassembling. The correct response is a new generation, never an edit
 * to the shipped cartridge.
 *
 *   node tools/proofs/202609012105-parts-integrity.proof.mjs
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const MANIFESTS = join(REPO, 'atlas', 'manifests');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

// Every digest in this estate is over LF bytes.
const sha256 = (text) => createHash('sha256')
  .update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex');

const entries = (await readdir(MANIFESTS)).filter(f => f.endsWith('-parts.json'));

/* Which generation is being served: the one atlas/current.json POINTS AT.
   This used to take the last manifest in name order, which is the same
   thing only while every stamp was read from the clock. On 1 Sep 2026 they
   were typed ahead of it - v9.67 is named 202609012250 and was cut at
   18:51 UTC - so the generation that succeeded it, read from the clock,
   sorts before it. Name order called the served composition superseded and
   the superseded one served, and then failed the wrong one. The pointer
   is the chain; sort order is a coincidence of honest clocks. */
const current = JSON.parse(
  await readFile(join(REPO, 'atlas', 'current.json'), 'utf8'));
const currentGeneration = current.generation;
const servedCartridges = new Set(
  (current.cartridges || []).map(c => basename(c.path || c.file || '')));

console.log(`\n${entries.length} parts manifest(s); serving generation ${currentGeneration}\n`);
check('there is at least one parts manifest to check', entries.length > 0);

for (const entry of entries) {
  const manifest = JSON.parse(await readFile(join(MANIFESTS, entry), 'utf8'));
  /* A manifest with no cartridge named is a broken record, and it used to
     take the whole proof down with an ERR_INVALID_ARG_TYPE from basename()
     rather than reporting itself. A gate that crashes tells you less than
     a gate that fails. */
  if (typeof manifest.cartridge !== 'string' || !manifest.cartridge) {
    check(`${entry}: names the cartridge it was built for`, false, 'no cartridge field');
    continue;
  }
  const cartridgeName = basename(manifest.cartridge);
  const cartridgePath = join(REPO, 'atlas', 'cartridges', cartridgeName);

  let present = true;
  try { await access(cartridgePath, constants.R_OK); } catch { present = false; }
  check(`${cartridgeName}: the cartridge its manifest names exists`, present);
  if (!present) continue;

  const cartridge = await readFile(cartridgePath, 'utf8');
  check(`${cartridgeName}: still hashes to its recorded digest`,
    sha256(cartridge) === manifest.sha256,
    `${sha256(cartridge).slice(0, 12)} vs ${String(manifest.sha256).slice(0, 12)}`);

  const isServed = servedCartridges.has(cartridgeName)
    || manifest.generation === currentGeneration;
  if (!isServed) {
    console.log(`  [skip] ${cartridgeName}: superseded, its parts may move on`);
    continue;
  }

  for (const part of manifest.assembled_from || []) {
    let source = null;
    try { source = await readFile(join(REPO, part.path), 'utf8'); } catch { /* gone */ }
    check(`${cartridgeName}: served part is present — ${part.path}`, source !== null);
    if (source === null) continue;
    check(`${cartridgeName}: served part is unchanged — ${part.path}`,
      sha256(source) === part.sha256,
      `${sha256(source).slice(0, 12)} vs ${String(part.sha256).slice(0, 12)}`);
  }
}

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  console.error('\nA served cartridge no longer matches the parts it was assembled\n'
    + 'from. Assemble a NEW generation from the edited parts. Do not edit the\n'
    + 'cartridge, and do not rewrite the manifest to agree with the drift.');
  process.exit(1);
}
console.log('every assembled cartridge still matches the parts it was built from.');
