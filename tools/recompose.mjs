/**
 * Cut a new composition generation.
 *
 * Every generation tonight was cut by hand: rename the cartridge, rename its
 * proof, edit current.json, write a composition manifest, update three
 * pointers, hope nothing was missed. Three separate identity defects came out
 * of exactly that - a manifest that still named an older composition for four
 * generations, and twice a proof left asserting the generation before the one
 * it was running against. The habit is "restamp what I am editing and trust
 * the rest", and the only fix is to stop doing it by hand.
 *
 * This restamps ONLY the cartridges named on the command line. A cartridge
 * that did not change keeps its own generation, which is why the composition
 * carries mixed stamps and should.
 *
 *   node tools/recompose.mjs --generation 202609012110 --version v9.64 \
 *     --restamp sld-sandbox --note "why this generation exists"
 *
 * A restamped cartridge with a parts manifest is REASSEMBLED from the same
 * part list through tools/build-cartridge.mjs, so an edited part actually
 * reaches the served bytes. One without is copied forward verbatim.
 *
 * It does not touch the immutable shell, and it never rewrites an existing
 * generation: build-cartridge refuses that, and so does this.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATLAS = path.join(ROOT, 'atlas');

function argv(flag, { many = false } = {}) {
  const values = [];
  for (let i = 2; i < process.argv.length; i += 1) {
    if (process.argv[i] === flag) values.push(process.argv[i + 1]);
  }
  return many ? values : values[0];
}

const generation = argv('--generation');
const version = argv('--version');
const restamp = argv('--restamp', { many: true });
const addModules = argv('--add-module', { many: true });
const scope = argv('--scope');
const proofs = argv('--proof', { many: true });
const note = argv('--note') || '';

/* A failed cut must not leave a half-composed tree.
   ------------------------------------------------------------------------
   The first run of this tool died on its own acceptance guard AFTER it had
   assembled a cartridge and renamed a proof, leaving exactly the half-state
   the assembler was hardened against an hour earlier. Every mutation
   registers its undo; die() runs them newest first. */
const undo = [];
function die(message) {
  while (undo.length) {
    const step = undo.pop();
    try { step(); } catch { /* best effort; the message below matters more */ }
  }
  console.error(message);
  process.exit(1);
}

if (!generation || !/^\d{12}$/.test(generation)) die('--generation YYYYMMDDHHMM is required');
if (!version || !/^v\d+\.\d+$/.test(version)) die('--version vX.Y is required');
if (!restamp.length) die('--restamp <cartridge-id> is required at least once');
/* The first cut of this tool spread the previous composition manifest and
   inherited its acceptance block whole, so the new generation shipped
   claiming the PREVIOUS generation's scope sentence and proof paths. That
   is the identity lie this tool exists to prevent, reproduced by the tool
   itself. Both are now required per generation and checked. */
if (!scope) die('--scope "what this generation changes" is required');
if (!proofs.length) die('--proof <path> is required at least once');

const sha256 = (text) => createHash('sha256')
  .update(String(text).replace(/\r\n/g, '\n'), 'utf8').digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`, 'utf8');

const currentPath = path.join(ATLAS, 'current.json');
const current = readJson(currentPath);
const previousGeneration = current.generation;

if (generation <= previousGeneration) {
  die(`--generation ${generation} is not after the current ${previousGeneration}`);
}
const compositionPath = path.join(ATLAS, 'manifests', `${generation}-composition.json`);
if (fs.existsSync(compositionPath)) {
  die(`refusing to rewrite an existing composition: ${generation}-composition.json`);
}

const changed = [];
const followUps = [];

for (const id of restamp) {
  const cartridge = (current.cartridges || []).find(entry => entry.id === id);
  if (!cartridge) die(`no cartridge with id ${id} in the current composition`);

  const oldGeneration = cartridge.generation;
  const oldFile = path.basename(cartridge.path);
  const stem = oldFile.replace(new RegExp(`^${oldGeneration}-`), '').replace(/\.js$/, '');
  const newFile = `${generation}-${stem}.js`;
  const newPath = path.join(ATLAS, 'cartridges', newFile);
  if (fs.existsSync(newPath)) die(`refusing to overwrite ${newFile}`);

  const partsManifest = path.join(ATLAS, 'manifests', `${oldGeneration}-${stem}-parts.json`);
  if (fs.existsSync(partsManifest)) {
    /* Reassembled, not copied: the point of restamping an assembled
       cartridge is that one of its parts moved. */
    const parts = readJson(partsManifest).assembled_from || [];

    /* A cartridge can gain a module at a cut.
       -------------------------------------------------------------------
       Without this, the reassembly reproduces the previous part list
       exactly, and a new module written for this generation is simply not
       in the served bytes - the body calls `sourceRegistry` and finds
       undefined. That happened on the first attempt at v9.67. A module is
       inserted BEFORE the non-module parts, because a body that depends on
       a module must be evaluated after it. */
    for (const modulePath of addModules) {
      if (parts.some(entry => entry.path === modulePath)) continue;
      if (!fs.existsSync(path.join(ROOT, modulePath))) die(`no such module: ${modulePath}`);
      const lastModule = parts.map(e => e.role).lastIndexOf('module');
      parts.splice(lastModule + 1, 0, { role: 'module', path: modulePath });
      console.log(`  +module    ${modulePath}`);
    }

    /* The version ledger the page shows is written by the cut, not by hand.
       -------------------------------------------------------------------
       v9.64 shipped with a ledger whose newest entry said v9.63, so the
       page told its reader it was running the generation before the one it
       was actually running. That list is generated metadata — the scope
       sentence is already required above — and the only reason it ever went
       stale is that appending to it was a separate manual step. */
    for (const entry of parts) {
      const partPath = path.join(ROOT, entry.path);
      if (!fs.existsSync(partPath)) continue;
      const before = fs.readFileSync(partPath, 'utf8');
      const found = before.match(/const VERSION_LEDGER = (\[[\s\S]*?\]);/);
      if (!found) continue;
      const ledger = JSON.parse(found[1]);
      if (ledger.some(row => row.g === generation)) continue;
      ledger.push({ g: generation, v: version, s: scope });
      const after = before.slice(0, found.index)
        + `const VERSION_LEDGER = ${JSON.stringify(ledger)};`
        + before.slice(found.index + found[0].length);
      fs.writeFileSync(partPath, after, 'utf8');
      undo.push(() => fs.writeFileSync(partPath, before, 'utf8'));
      console.log(`  ledger     ${entry.path}  += ${version}`);
    }

    const args = ['--generation', generation, '--name', stem];
    const flagFor = { carried_shell_script: '--carry', module: '--module', part: '--part' };
    for (const entry of parts) {
      const flag = flagFor[entry.role];
      if (!flag) die(`unknown part role ${entry.role} in ${path.basename(partsManifest)}`);
      args.push(flag, entry.path);
    }
    const built = spawnSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-cartridge.mjs'), ...args],
      { cwd: ROOT, encoding: 'utf8' });
    if (built.status !== 0) die(`assembly failed for ${id}: ${built.stderr || built.stdout}`);
    const partsOut = path.join(ATLAS, 'manifests', `${generation}-${stem}-parts.json`);
    undo.push(() => { fs.rmSync(newPath, { force: true }); fs.rmSync(partsOut, { force: true }); });
    console.log(`  assembled  ${newFile}  from ${parts.length} part(s)`);
  } else {
    fs.copyFileSync(path.join(ATLAS, 'cartridges', oldFile), newPath);
    undo.push(() => fs.rmSync(newPath, { force: true }));
    console.log(`  copied     ${newFile}`);
  }

  // The proof travels with the cartridge, by the runner's own convention.
  const oldProof = path.join(ROOT, 'tools', 'proofs', `${oldGeneration}-${id}.proof.mjs`);
  const newProof = path.join(ROOT, 'tools', 'proofs', `${generation}-${id}.proof.mjs`);
  if (!fs.existsSync(oldProof)) die(`no proof to carry forward at ${path.relative(ROOT, oldProof)}`);
  if (fs.existsSync(newProof)) die(`refusing to overwrite ${path.basename(newProof)}`);
  fs.renameSync(oldProof, newProof);
  undo.push(() => fs.renameSync(newProof, oldProof));
  console.log(`  proof      ${path.basename(newProof)}`);

  /* Deliberately NOT rewritten. A proof that mentions an older generation is
     sometimes right - it may be asserting that the old identity is gone -
     and blanket substitution is the same reflex that caused the drift this
     tool exists to stop. They are reported, and a human decides. */
  const proofText = fs.readFileSync(newProof, 'utf8');
  const stale = proofText.split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(row => row.line.includes(oldGeneration) || row.line.includes(cartridge.version));
  if (stale.length) {
    followUps.push({ proof: path.relative(ROOT, newProof).replace(/\\/g, '/'), stale });
  }

  const bytes = fs.readFileSync(newPath, 'utf8');
  cartridge.generation = generation;
  cartridge.version = version;
  cartridge.path = `./cartridges/${newFile}`;
  cartridge.sha256 = sha256(bytes);
  changed.push({ id, from: oldFile, to: newFile, sha256: cartridge.sha256, oldGeneration });
}

current.previous_generation = previousGeneration;
current.generation = generation;
current.composition_version = version;
current.composition_id = `${generation}-gridatlas-${version}`;
current.composition_manifest = `./manifests/${generation}-composition.json`;
if (note) current.composition_note = note;

/* The composition manifest is DERIVED from current.json, never restated.
   The four-generation identity lie came from restating it. */
const previousComposition = readJson(
  path.join(ATLAS, 'manifests', `${previousGeneration}-composition.json`));
for (const proof of proofs) {
  if (!fs.existsSync(path.join(ROOT, proof))) die(`no such proof: ${proof}`);
}
const composition = {
  ...previousComposition,
  generation,
  parent_generation: previousGeneration,
  cartridge_order: current.cartridge_order,
  cartridges: current.cartridges,
  composition_version: version,
  composition_id: current.composition_id,
  version,
  acceptance: {
    ...previousComposition.acceptance,
    // Never inherited: these three describe THIS generation or they lie.
    scope,
    proof: proofs.join(', '),
    golden_browser_verification: 'PENDING_THIS_GENERATION'
  }
};
if (note) composition.note = note;

/* Last guard before it is written, and deliberately precise.
   ------------------------------------------------------------------------
   A proof path naming an older generation is usually CORRECT - a cartridge
   that did not change keeps its stamp, and so does its proof. What is never
   correct is naming the superseded proof of a cartridge that DID change, or
   describing this generation with the previous one's identity. */
for (const entry of changed) {
  const superseded = `${entry.oldGeneration}-${entry.id}.proof.mjs`;
  if (proofs.some(proofPath => proofPath.endsWith(superseded))) {
    die(`${superseded} was renamed by this cut; name the ${generation} proof instead`);
  }
}
for (const stale of [previousGeneration, previousComposition.composition_version]) {
  if (stale && String(scope).includes(stale)) {
    die(`--scope describes ${stale}; write the sentence for ${generation}`);
  }
}

writeJson(compositionPath, composition);
writeJson(currentPath, current);

const liveSetPath = path.join(ATLAS, 'state', 'live-set.json');
if (fs.existsSync(liveSetPath)) {
  const liveSet = readJson(liveSetPath);
  liveSet.generation = generation;
  liveSet.composition_manifest = current.composition_manifest;
  liveSet.cartridge_order = current.cartridge_order;
  writeJson(liveSetPath, liveSet);
}

for (const pointerPath of [path.join(ROOT, 'releases', 'current-v5.json'),
  path.join(ROOT, 'state', 'live-set.json')]) {
  if (!fs.existsSync(pointerPath)) continue;
  const pointer = readJson(pointerPath);
  if (pointer?.current?.atlas_composition) {
    pointer.current.atlas_composition.generation = generation;
    pointer.current.atlas_composition.manifest =
      current.composition_manifest.replace(/^\.\//, 'atlas/');
    pointer.current.atlas_composition.cartridge_order = current.cartridge_order;
    writeJson(pointerPath, pointer);
  }
}

const verified = spawnSync(process.execPath,
  [path.join(ROOT, 'tools', 'scope', 'verify-compose.mjs')],
  { cwd: ROOT, encoding: 'utf8' });
console.log(`\n${(verified.stdout || verified.stderr).trim()}`);
if (verified.status !== 0) die('composition verification failed; the tree is mid-cut and needs review');

console.log(`\ncomposed ${current.composition_id} from ${previousGeneration}`);
for (const entry of changed) console.log(`  ${entry.id}: ${entry.from} -> ${entry.to}`);

if (followUps.length) {
  console.log('\nproofs carried forward that still name the previous identity -'
    + '\nread each one and decide; do not assume it is stale:');
  for (const item of followUps) {
    console.log(`  ${item.proof}`);
    for (const row of item.stale.slice(0, 12)) {
      console.log(`    ${String(row.number).padStart(4)}  ${row.line.trim().slice(0, 96)}`);
    }
    if (item.stale.length > 12) console.log(`    ... ${item.stale.length - 12} more`);
  }
}
