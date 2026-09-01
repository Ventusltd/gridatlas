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
 *   node tools/recompose.mjs --version v9.64 --restamp sld-sandbox \
 *     --scope "..." --proof ... --note "why this generation exists"
 *
 *   The generation is read from the clock (UTC). --generation is accepted
 *   only within five minutes of now; --replace-module old=new swaps a
 *   module for its successor; --add-module appends one after the last.
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

/* The generation is READ FROM THE CLOCK, never typed.
   ------------------------------------------------------------------------
   On the evening of 1 Sep 2026 two agents typed stamps by hand and both ran
   ahead of the clock: v9.67 is named 202609012250 and was cut at 18:51 UTC,
   four hours before the time its name claims. The CVAA vaccine
   monotonic-utc-generations had said since 30 Aug that "generations are
   read from date -u at commit time, never chosen"; it was in the registry
   and not in the loop, and it fired 122 times when it was finally run.

   So --generation is optional and defaults to UTC now. Given explicitly it
   must be within five minutes of UTC now: a stamp is a clock reading, and
   a reading the clock has not reached is not a reading. */
const utcNow = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const generation = argv('--generation') || utcNow();
const version = argv('--version');
const restamp = argv('--restamp', { many: true });
/* Module edits may be scoped to ONE restamped cartridge.
   ------------------------------------------------------------------------
   `--add-module path` applied to every cartridge named by --restamp, which
   was harmless while exactly one was ever restamped. The moment a cut moves
   computation from one cartridge to another - 202609012350, when the
   sandbox reached 95% of its 400 kB boundary - it stops being harmless: the
   same module would be added to both halves of the move.

   So both flags now accept `cartridge-id=path` as well as a bare `path`.
   A bare path keeps the old meaning (every restamped cartridge), because
   every existing caller writes one. */
const scoped = (flag) => argv(flag, { many: true }).map((raw) => {
  const text = String(raw);
  const split = text.indexOf('=');
  /* A path never contains '=', and a cartridge id is never a path, so the
     first '=' is unambiguous - but only when what precedes it looks like an
     id rather than the start of a path. */
  if (split > 0 && !text.slice(0, split).includes('/')) {
    return { id: text.slice(0, split), path: text.slice(split + 1) };
  }
  return { id: null, path: text };
});
const addModules = scoped('--add-module');
const removeModules = scoped('--remove-module');
const partsSeeds = scoped('--parts-from');
const replaceModules = argv('--replace-module', { many: true })
  .map(pair => {
    const [from, to] = String(pair).split('=');
    if (!from || !to) die(`--replace-module wants old/path.js=new/path.js, got ${pair}`);
    return { from, to };
  });
const scope = argv('--scope');
/* A caller that does not know the clock minute (the overnight runner, which
   lets this tool read it) writes {generation} in the proof path; it resolves
   to the generation this cut is stamped with, i.e. the renamed proof. */
const proofs = argv('--proof', { many: true })
  .map(proofPath => String(proofPath).split('{generation}').join(generation));
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

if (!/^[0-9]{12}$/.test(generation)) die('--generation must be YYYYMMDDHHMM (UTC), or omitted to read the clock');
{
  const minute = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)) / 60000;
  const drift = minute(generation) - minute(utcNow());
  if (Math.abs(drift) > 5) {
    die(`--generation ${generation} is ${drift > 0 ? drift + ' minutes ahead of' : (-drift) + ' minutes behind'} `
      + `the clock (UTC now ${utcNow()}). A stamp is read from the clock, not chosen; omit --generation.`);
  }
}
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

/* Ordering is a consequence of the clock, not a rule of its own.
   ------------------------------------------------------------------------
   This used to refuse a generation that sorted before the current one.
   Read from the clock, a new cut sorts after the previous one whenever the
   previous one was honest. The one time it does not is the time this note
   describes: the generation after v9.67 (202609012250, cut at 18:51 UTC)
   was read from the clock at 21:xx UTC and sorts before it. The chain is
   previous_generation, which is a pointer; a listing sorted by name shows
   the lie of the earlier stamp, and should. */
if (generation <= previousGeneration) {
  console.warn(`  note: ${generation} sorts before the current ${previousGeneration} - `
    + 'the earlier stamp was typed ahead of the clock; the chain is previous_generation');
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

  /* A cartridge that has never been assembled has no manifest to read.
     ----------------------------------------------------------------------
     `--parts-from <id>=<path>` seeds one for exactly that case. The seed is
     NOT written into atlas/manifests/: a manifest there is a record of how
     a shipped generation was actually built, and back-dating one that
     cannot reproduce its own cartridge byte-for-byte would be a false
     record of the kind this estate keeps finding. The seed is an input to
     THIS cut; the manifest the cut writes is stamped with the new
     generation and does reproduce its cartridge, because it built it. */
  let partsManifest = path.join(ATLAS, 'manifests', `${oldGeneration}-${stem}-parts.json`);
  if (!fs.existsSync(partsManifest)) {
    const seed = partsSeeds.find(s => s.id === id);
    if (seed) {
      const seedPath = path.join(ROOT, seed.path);
      if (!fs.existsSync(seedPath)) die(`--parts-from: no such seed ${seed.path}`);
      partsManifest = seedPath;
      console.log(`  seed       ${id} assembled from ${seed.path}`);
    }
  }
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
    /* A swap must land somewhere, but not necessarily in EVERY restamped
       cartridge - dying per cartridge was correct only while one was ever
       restamped at a time. Misses are tolerated here and the miss is
       reported after the loop if no cartridge took it. */
    for (const swap of replaceModules) {
      const entry = parts.find(e => e.role === 'module' && e.path === swap.from);
      if (!entry) continue;
      if (!fs.existsSync(path.join(ROOT, swap.to))) die(`no such module: ${swap.to}`);
      entry.path = swap.to;
      swap.applied = true;
      console.log(`  ~module    ${swap.from} -> ${swap.to}  (in ${id})`);
    }
    const forThis = (edit) => edit.id === null || edit.id === id;

    /* Removals run BEFORE additions so a cut can move a module from one
       cartridge to another in a single generation without the two edits
       racing over the same part list. */
    for (const edit of removeModules.filter(forThis)) {
      const at = parts.findIndex(e => e.role === 'module' && e.path === edit.path);
      if (at < 0) die(`--remove-module: ${edit.path} is not a module of ${id}`);
      parts.splice(at, 1);
      console.log(`  -module    ${edit.path}  (from ${id})`);
    }
    for (const edit of addModules.filter(forThis)) {
      const modulePath = edit.path;
      if (parts.some(entry => entry.path === modulePath)) continue;
      if (!fs.existsSync(path.join(ROOT, modulePath))) die(`no such module: ${modulePath}`);
      const lastModule = parts.map(e => e.role).lastIndexOf('module');
      parts.splice(lastModule + 1, 0, { role: 'module', path: modulePath });
      console.log(`  +module    ${modulePath}  (into ${id})`);
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
    /* The pointer follows the manifest that was actually written.
       --------------------------------------------------------------------
       It did not, and the drift was silent: at 202609012350 the sld-sandbox
       entry was on generation 202609012345 while its assembled_from still
       named ./manifests/202609012045-...-parts.json, five generations
       behind. Nothing read the field, which is exactly why it rotted -
       and a reader who did trust it would have been handed the wrong part
       list. This tool exists to stop that class of drift; it should not
       leave one in its own output. */
    const previousPointer = cartridge.assembled_from;
    cartridge.assembled_from = `./manifests/${generation}-${stem}-parts.json`;
    if (previousPointer && previousPointer !== cartridge.assembled_from) {
      console.log(`  pointer    assembled_from ${previousPointer} -> ${cartridge.assembled_from}`);
    }
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

/* A swap that matched no restamped cartridge is a typo, not a no-op. */
for (const swap of replaceModules) {
  if (!swap.applied) die(`--replace-module: ${swap.from} is not a module of any restamped cartridge`);
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
  /* The clock, recorded beside the stamp, so a later reader can verify the
     name against the time without opening git. */
  cut_at_utc: new Date().toISOString(),
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
