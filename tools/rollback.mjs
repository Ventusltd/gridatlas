/**
 * Roll the live composition back to a generation that has already shipped.
 *
 * WHY THIS EXISTS
 * ---------------
 * `tools/recompose.mjs` moves atlas/current.json forward. Nothing moved it
 * back. Ten generations were cut in three hours on 2026-09-03, every one of
 * them repointing the live route, and the only way to undo a bad one was to
 * hand-edit the pointer at whatever hour it was noticed - which is the
 * hand-editing habit that recompose was written to end.
 *
 * v9.83 pinned the runtime products by commit and digest so that a bad
 * PRODUCT cannot reach a shipped release. This is the other half: so that a
 * bad RELEASE cannot stay on the pointer.
 *
 *   node tools/rollback.mjs --to 202609030233 --reason "why"
 *   node tools/rollback.mjs --to 202609030233 --reason "why" --dry-run
 *
 * WHAT IT IS NOT
 * --------------
 * It is not an amend. A shipped generation is never rewritten: rolling back
 * cuts a NEW generation whose composition is a previously shipped one, and
 * `previous_generation` still names the generation it replaced, so the
 * lineage reads forwards and the history stays append-only. The manifest
 * records `restored_from`, so a rollback is visible as a rollback rather than
 * looking like an ordinary cut that happens to repeat itself.
 *
 * WHAT IT REFUSES
 * ---------------
 * A rollback that cannot be trusted is worse than no rollback, because it is
 * reached for in the one moment nobody has time to check it. So before it
 * writes anything:
 *
 *   - the target must be an ANCESTOR of the current generation, walked
 *     through parent_generation. "Roll back" to something that never shipped
 *     on this line is a typo, and a typo at 3am must not be servable.
 *   - every cartridge the target names must still exist, and its bytes must
 *     still hash to the digest the target recorded. A pointer to bytes that
 *     are gone is the failure this whole mechanism exists to prevent.
 *
 * Digests are taken from the COMMITTED bytes (`git show HEAD:<path>`), never
 * from the working copy. A git-clean tree is not a byte-clean tree: git
 * compares through .gitattributes normalisation and reports clean while the
 * disk holds CRLF and the blob holds LF. Four separate measurements in this
 * estate were wrong for exactly that reason in one night. atlas/ is pinned to
 * LF today and both readings agree, which is precisely why reading the wrong
 * one now would go unnoticed until the day it stops agreeing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/* fileURLToPath, never new URL().pathname: on Windows the latter yields
   "/C:/Users/..." and join() then produces "C:\C:\Users\...". */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATLAS = path.join(ROOT, 'atlas');

function argv(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function die(message) {
  console.error(`rollback: ${message}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`, 'utf8');
}

/* The committed bytes, which are the bytes GitHub Pages serves. */
function committedBytes(relative) {
  const shown = spawnSync('git', ['-C', ROOT, 'show', `HEAD:${relative}`], {
    encoding: 'buffer',
    maxBuffer: 256 * 1024 * 1024
  });
  if (shown.status !== 0) return null;
  return shown.stdout;
}

const target = argv('--to');
const reason = argv('--reason');
const dryRun = process.argv.includes('--dry-run');

if (!target) die('--to <generation> is required');
if (!/^\d{12}$/.test(target)) die(`--to must be a 12-digit generation, got ${target}`);
if (!reason) die('--reason "..." is required; a rollback with no recorded reason is an unexplained pointer move');

const currentPath = path.join(ATLAS, 'current.json');
const current = readJson(currentPath);
const fromGeneration = current.generation;

if (target === fromGeneration) die(`${target} is already the live generation`);

const targetManifestPath = path.join(ATLAS, 'manifests', `${target}-composition.json`);
if (!fs.existsSync(targetManifestPath)) die(`no composition manifest for ${target}`);
const targetComposition = readJson(targetManifestPath);

/* ---- the target must be an ancestor, walked rather than assumed ---- */
const lineage = [];
let walk = fromGeneration;
const seen = new Set();
while (walk && !seen.has(walk)) {
  seen.add(walk);
  lineage.push(walk);
  const manifestPath = path.join(ATLAS, 'manifests', `${walk}-composition.json`);
  if (!fs.existsSync(manifestPath)) break;
  walk = readJson(manifestPath).parent_generation || null;
}
if (!lineage.includes(target)) {
  die(`${target} is not an ancestor of ${fromGeneration}; the lineage from here is ${lineage.join(' <- ')}`);
}
const distance = lineage.indexOf(target);

/* ---- every cartridge the target names must still be servable ---- */
const order = targetComposition.cartridge_order;
const cartridges = targetComposition.cartridges;
if (!Array.isArray(order) || !Array.isArray(cartridges) || cartridges.length === 0) {
  die(`${target} composition manifest carries no cartridges`);
}
const byId = new Map(cartridges.map(entry => [entry.id, entry]));
for (const id of order) {
  if (!byId.has(id)) die(`${target} names ${id} in cartridge_order and does not define it`);
}

const checks = [];
for (const cartridge of cartridges) {
  const relative = path.posix.join('atlas', String(cartridge.path).replace(/^\.\//, ''));
  const bytes = committedBytes(relative);
  if (bytes === null) {
    checks.push({ id: cartridge.id, relative, state: 'ABSENT' });
    continue;
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  checks.push({
    id: cartridge.id,
    relative,
    bytes: bytes.length,
    state: digest === cartridge.sha256 ? 'MATCH' : 'DIGEST_MISMATCH',
    recorded: cartridge.sha256,
    measured: digest
  });
}

const shellIndex = path.posix.join('atlas', String(targetComposition.shell.index).replace(/^\.\//, ''));
const shellBytes = committedBytes(shellIndex);
checks.push({ id: 'shell:index.html', relative: shellIndex, state: shellBytes === null ? 'ABSENT' : 'PRESENT' });

for (const check of checks) {
  console.log(`  ${check.state.padEnd(15)} ${check.id.padEnd(28)} ${check.relative}`);
}
const broken = checks.filter(check => check.state !== 'MATCH' && check.state !== 'PRESENT');
if (broken.length) {
  die(`${broken.length} of ${checks.length} target artefacts are absent or no longer hash to what ${target} recorded; refusing to point the live route at them`);
}

/* ---- the new generation ---- */
const now = new Date();
const stamp = argv('--generation') || [
  now.getUTCFullYear(),
  String(now.getUTCMonth() + 1).padStart(2, '0'),
  String(now.getUTCDate()).padStart(2, '0'),
  String(now.getUTCHours()).padStart(2, '0'),
  String(now.getUTCMinutes()).padStart(2, '0')
].join('');
if (!/^\d{12}$/.test(stamp)) die(`malformed generation stamp ${stamp}`);
if (fs.existsSync(path.join(ATLAS, 'manifests', `${stamp}-composition.json`))) {
  die(`${stamp} already exists; a rollback never rewrites a shipped generation`);
}

const version = targetComposition.composition_version || targetComposition.version;
if (!version) die(`${target} composition manifest records no composition_version`);

const restored = {
  ...current,
  previous_generation: fromGeneration,
  generation: stamp,
  shell: targetComposition.shell.hashes
    ? { release_id: targetComposition.shell.release_id, index: targetComposition.shell.index, base: targetComposition.shell.base }
    : targetComposition.shell,
  cartridge_order: order,
  cartridges,
  composition_version: version,
  composition_id: `${stamp}-gridatlas-${version}`,
  composition_manifest: `./manifests/${stamp}-composition.json`,
  composition_note: reason
};

const composition = {
  ...targetComposition,
  generation: stamp,
  parent_generation: fromGeneration,
  restored_from: target,
  restored_over: fromGeneration,
  restored_generations_back: distance,
  composition_id: restored.composition_id,
  cut_at_utc: now.toISOString(),
  acceptance: {
    ...(targetComposition.acceptance || {}),
    scope: reason,
    golden_browser_verification: 'PENDING_THIS_GENERATION'
  },
  note: reason
};

console.log('');
console.log(`  from        ${fromGeneration}  ${current.composition_version}`);
console.log(`  restoring   ${target}  ${version}   (${distance} generation${distance === 1 ? '' : 's'} back)`);
console.log(`  as          ${stamp}  ${restored.composition_id}`);
console.log(`  cartridges  ${cartridges.length} verified against committed bytes`);

if (dryRun) {
  console.log('\n--dry-run: nothing written');
  process.exit(0);
}

writeJson(path.join(ATLAS, 'manifests', `${stamp}-composition.json`), composition);
writeJson(currentPath, restored);

const liveSetPath = path.join(ATLAS, 'state', 'live-set.json');
if (fs.existsSync(liveSetPath)) {
  const liveSet = readJson(liveSetPath);
  liveSet.generation = stamp;
  liveSet.composition_manifest = restored.composition_manifest;
  liveSet.cartridge_order = restored.cartridge_order;
  writeJson(liveSetPath, liveSet);
}

console.log(`\nrolled back to ${target} as ${restored.composition_id}`);
console.log('run `node tools/scope/loop.mjs state` and `node tools/proofs/run-current.mjs` before committing');
