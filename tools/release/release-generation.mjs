#!/usr/bin/env node
/**
 * Release a published preview generation G to the live route.
 *
 *   node tools/release/release-generation.mjs --generation G --authorised-by "..." [options]
 *
 * This is the hand procedure of RELEASE-COMMANDS.md (rehearsal E, then the
 * 202610281340 Build L3 release, PR #49) as one checked script. It works in
 * the checkout it lives in, so run it from a fresh worktree of main:
 *
 *   git fetch origin && git worktree add --detach ../gridatlas-release origin/main
 *   cd ../gridatlas-release && node tools/release/release-generation.mjs --generation G ...
 *
 * WHAT IT DOES, IN ORDER
 *   1. Preconditions, all against committed bytes, nothing written:
 *      - the tree is clean and HEAD is exactly --base (default origin/main);
 *      - live (atlas/current.json) is the expected predecessor: --expect-live,
 *        which must also be the manifest's previous_generation;
 *      - G's preview files are present and committed: the composition
 *        manifest, atlas/v/G/{current.json,index.html}, every cartridge the
 *        manifest names (sha256 of the committed blob = the recorded digest),
 *        and a proof tools/proofs/G-<id>.proof.mjs for every cartridge cut at G;
 *      - atlas/v/G/current.json is the derived pointer re-rooted to ../../,
 *        i.e. the preview people tested is the composition that will go live;
 *      - G's proofs pass;
 *      - the loader is identical: atlas/index.html == atlas/v/G/index.html.
 *   2. On a new branch, optional preparatory commits: --prep-commit <sha>
 *      (cherry-picked, e.g. retiring a workflow) and --prep-gate-kb <N> (raise
 *      the recorded cartridge ceiling in tools/scope/loop.mjs). Each must
 *      leave lint and STATE.md parity green and must not touch the pointer.
 *   3. atlas/current.json from G's manifest exactly as the rehearsal did
 *      (drop the six cut-only keys, JSON.stringify(m, null, 1) + "\n"), then
 *      `node tools/scope/loop.mjs state`. Only those two files may change.
 *   4. Every gate: lint, state parity, verify-compose (generation G),
 *      run-current, G's proofs, data-contract parity (no FAIL row the base
 *      did not already have), rollback.mjs --to <predecessor> --dry-run.
 *   5. The release commit (pointer + STATE.md only), then the hashes.
 *
 * If live is already G, it is a NO-OP release: every precondition and gate
 * still runs, the derived pointer must equal the live one byte for byte, and
 * nothing is committed. That is how the tooling is rehearsed on main.
 *
 * It never pushes, never opens a PR and never edits atlas/releases/**. The
 * owner's authorisation is recorded in the commit, not inferred.
 *
 * Options
 *   --generation G          12-digit preview generation to release (required)
 *   --authorised-by TEXT    who authorised it and where (required to commit)
 *   --expect-live P         the generation that must be live now (default: G's previous_generation)
 *   --base REV              HEAD must equal this (default origin/main)
 *   --branch NAME           default release/G-gridatlas-<composition_version>
 *   --title TEXT            commit subject after "G-gridatlas-vX: "
 *   --prep-commit SHA       cherry-pick as a preparatory commit (repeatable)
 *   --prep-gate-kb N        raise the cartridge ceiling to N kB as a preparatory commit
 *   --prep-gate-reason TEXT required with --prep-gate-kb (who decided, when)
 *   --trailer TEXT          appended to every commit message (repeatable)
 *   --check                 preconditions only; write nothing
 *   --no-commit             leave the release staged-but-uncommitted for inspection
 *   --report FILE           write a JSON report (hashes, gates) to FILE
 *   --log FILE              write the full gate output to FILE
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, POINTER_FILES, die as dieWith, parseArgs, run, git, gitOk, gitBlob, sha256, sha256File,
  readText, exists, deriveCurrent, rerootForPreview, cleanTree, changedPaths, isTracked,
  runGates, printGates, parityFailRows, commitWithMessage, trailerBlock
} from './lib.mjs';

const TOOL = 'release-generation';
const die = (m) => dieWith(TOOL, m);
const step = (m) => console.log(`\n== ${m}`);
const ok = (m) => console.log(`  OK    ${m}`);

let args;
try {
  args = parseArgs(process.argv.slice(2), {
    generation: {}, 'authorised-by': {}, 'expect-live': {}, base: { default: 'origin/main' },
    branch: {}, title: {}, 'prep-commit': { multi: true }, 'prep-gate-kb': {}, 'prep-gate-reason': {},
    trailer: { multi: true }, check: { bool: true }, 'no-commit': { bool: true },
    report: {}, log: {}
  });
} catch (error) { die(error.message); }

const G = args.generation;
if (!G || !/^\d{12}$/.test(G)) die('--generation must be a 12-digit generation');
if (args['prep-gate-kb'] && !/^\d{3}$/.test(args['prep-gate-kb'])) die('--prep-gate-kb must be a 3-digit kB figure');
if (args['prep-gate-kb'] && !args['prep-gate-reason']) die('--prep-gate-kb needs --prep-gate-reason (the owner decision it records)');

const report = { tool: TOOL, generation: G, root: ROOT, started_utc: new Date().toISOString() };
const finish = (code) => {
  report.finished_utc = new Date().toISOString();
  report.exit = code;
  if (args.report) fs.writeFileSync(path.resolve(args.report), `${JSON.stringify(report, null, 1)}\n`);
  process.exit(code);
};

/* ------------------------------------------------------- 1. preconditions */
step('preconditions');
if (!cleanTree()) die(`working tree is not clean:\n${changedPaths().join('\n')}`);
ok('working tree clean');

if (!gitOk('rev-parse', '--verify', '--quiet', `${args.base}^{commit}`)) die(`--base ${args.base} does not resolve`);
const baseSha = git('rev-parse', `${args.base}^{commit}`);
const headSha = git('rev-parse', 'HEAD');
if (baseSha !== headSha) die(`HEAD ${headSha} is not ${args.base} ${baseSha} (fetch, and start from a fresh worktree of it)`);
report.base = { ref: args.base, sha: baseSha };
ok(`HEAD = ${args.base} = ${baseSha}`);

const liveText = gitBlob('HEAD', 'atlas/current.json');
if (!liveText) die('atlas/current.json is not committed at HEAD');
const live = JSON.parse(liveText.toString('utf8'));
report.live_before = live.generation;

const manifestRel = `atlas/manifests/${G}-composition.json`;
const previewPointerRel = `atlas/v/${G}/current.json`;
const previewLoaderRel = `atlas/v/${G}/index.html`;
for (const rel of [manifestRel, previewPointerRel, previewLoaderRel]) {
  if (!exists(rel) || !isTracked(rel)) die(`preview file ${rel} is missing or not committed`);
}
ok(`preview files committed: ${manifestRel}, ${previewPointerRel}, ${previewLoaderRel}`);

const manifestText = gitBlob('HEAD', manifestRel).toString('utf8');
const manifest = JSON.parse(manifestText);
if (manifest.generation !== G) die(`${manifestRel} declares generation ${manifest.generation}`);
if (manifest.composition_manifest !== `./manifests/${G}-composition.json`) die(`${manifestRel} composition_manifest is ${manifest.composition_manifest}`);
const rejected = String(manifest.candidate_status || '').startsWith('REJECTED')
  || String(manifest.acceptance?.golden_browser_verification || '').startsWith('REJECTED');
if (rejected) die(`${G} is marked REJECTED in its manifest; it is not a release candidate`);
ok(`manifest identity: generation ${G}, ${manifest.composition_version}`);

const noop = live.generation === G;
const predecessor = noop ? live.previous_generation : live.generation;
if (noop) {
  if (args['expect-live'] && args['expect-live'] !== G) die(`live is ${G}, not --expect-live ${args['expect-live']}`);
  ok(`live is already ${G}: NO-OP release (verify everything, commit nothing)`);
} else {
  const expected = args['expect-live'] || manifest.previous_generation;
  if (live.generation !== expected) die(`live is ${live.generation}, expected predecessor ${expected}`);
  if (manifest.previous_generation !== live.generation) die(`${G}'s previous_generation is ${manifest.previous_generation} but live is ${live.generation}; the manifest was cut against a different predecessor`);
  ok(`live = expected predecessor = ${live.generation} = ${G}.previous_generation`);
  if (!args.check && !args['no-commit'] && !args['authorised-by']) die('--authorised-by is required to commit a release');
}
report.predecessor = predecessor;

const derived = deriveCurrent(manifestText);
const previewPointer = gitBlob('HEAD', previewPointerRel).toString('utf8');
if (rerootForPreview(derived) !== previewPointer) die(`${previewPointerRel} is not the derived pointer re-rooted to ../../; the preview that was tested is not what would go live`);
ok(`${previewPointerRel} == derived pointer re-rooted (the tested preview is the release)`);
if (noop && derived !== liveText.toString('utf8')) die('live is G but the pointer derived from its manifest is not byte-identical to atlas/current.json');
if (noop) ok('derived pointer is byte-identical to the live atlas/current.json');

const cutHere = [];
for (const cartridge of manifest.cartridges || []) {
  const rel = path.posix.join('atlas', cartridge.path);
  const blob = gitBlob('HEAD', rel);
  if (!blob) die(`${cartridge.id}: ${rel} is not committed`);
  if (sha256(blob) !== cartridge.sha256) die(`${cartridge.id}: committed ${rel} does not hash to ${cartridge.sha256}`);
  if (cartridge.generation === G) cutHere.push(cartridge.id);
}
ok(`${(manifest.cartridges || []).length} cartridges: committed blobs hash to the recorded sha256`);
if (!cutHere.length) die(`no cartridge in ${manifestRel} was cut at ${G}`);

const proofs = cutHere.map(id => `tools/proofs/${G}-${id}.proof.mjs`);
for (const proof of proofs) {
  if (!exists(proof) || !isTracked(proof)) die(`${proof} is missing or not committed`);
  const r = run('node', [proof], { allowFail: true });
  if (r.status !== 0) die(`${proof} fails on the preview route:\n${r.out}`);
  ok(`${proof} passes (preview route)`);
}

const loader = gitBlob('HEAD', 'atlas/index.html');
const previewLoader = gitBlob('HEAD', previewLoaderRel);
if (!loader || !previewLoader || Buffer.compare(loader, previewLoader) !== 0) die(`${previewLoaderRel} is not byte-identical to atlas/index.html (LOADER differs)`);
ok(`LOADER_IDENTICAL atlas/index.html == ${previewLoaderRel} (sha256 ${sha256(loader).slice(0, 16)}…)`);

const before = Object.fromEntries(POINTER_FILES.map(f => [f, sha256File(f)]));
report.before = before;

if (args.check) {
  console.log(`\nCHECK PASS: ${G} is releasable on ${baseSha.slice(0, 7)} (live ${live.generation}). Nothing written.`);
  finish(0);
}

/* Parity FAIL rows on the untouched tree: the release must not add any. */
const parityBaseline = parityFailRows().rows;
report.parity_baseline = parityBaseline;

/* ------------------------------------------------------------- no-op path */
if (noop) {
  step('gates (no-op: live tree as is)');
  const gates = runGates({ expectGeneration: G, proofs, parityBaseline, rollbackTo: predecessor });
  printGates(gates.rows);
  if (args.log) fs.writeFileSync(path.resolve(args.log), gates.log);
  report.gates = gates.rows;
  report.after = Object.fromEntries(POINTER_FILES.map(f => [f, sha256File(f)]));
  step('hashes');
  for (const f of POINTER_FILES) console.log(`  ${f.padEnd(20)} ${before[f]}  (unchanged)`);
  console.log(`  derived pointer      ${sha256(derived)}`);
  if (!cleanTree()) die('a gate wrote to the tree');
  const green = gates.rows.every(r => r.ok);
  console.log(green ? `\nNOOP PASS: ${G} is live and re-derives byte-exact; nothing committed.` : '\nNOOP FAIL: see gates above.');
  finish(green ? 0 : 1);
}

/* ---------------------------------------------------- 2. branch and prep */
const branch = args.branch || `release/${G}-gridatlas-${manifest.composition_version}`;
if (gitOk('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)) die(`branch ${branch} already exists`);
run('git', ['switch', '-q', '-c', branch]);
report.branch = branch;
step(`branch ${branch} at ${baseSha.slice(0, 7)}`);

const trailers = trailerBlock(args.trailer);
const prepCommits = [];
const checkPrep = (label) => {
  const touched = git('diff', '--name-only', 'HEAD^', 'HEAD').split('\n').filter(Boolean);
  const bad = touched.filter(f => POINTER_FILES.includes(f) || f.startsWith('atlas/releases/') || f === 'atlas/index.html');
  if (bad.length) die(`${label} touches ${bad.join(', ')}; a preparatory commit must leave the pointer, STATE.md, the loader and releases alone`);
  const lint = run('node', ['tools/scope/loop.mjs', 'lint'], { allowFail: true });
  if (lint.status !== 0) die(`${label}: loop.mjs lint fails after it:\n${lint.out}`);
  const state = run('node', ['tools/scope/loop.mjs', 'state', '--stdout'], { allowFail: true });
  if (state.status !== 0 || state.stdout !== readText('STATE.md')) die(`${label}: STATE.md no longer matches the generator after it`);
  const sha = git('rev-parse', 'HEAD');
  prepCommits.push({ label, sha, files: touched });
  ok(`${label} -> ${sha.slice(0, 7)} (${touched.join(', ')}); lint PASS, STATE.md unchanged`);
};

for (const sha of args['prep-commit']) {
  const r = run('git', ['cherry-pick', '-x', sha], { allowFail: true });
  if (r.status !== 0) { run('git', ['cherry-pick', '--abort'], { allowFail: true }); die(`cherry-pick ${sha} failed:\n${r.out}`); }
  checkPrep(`prep cherry-pick ${sha.slice(0, 7)}`);
}

if (args['prep-gate-kb']) {
  const rel = 'tools/scope/loop.mjs';
  const text = readText(rel);
  const sizeRe = /fs\.statSync\(cartridgePath\)\.size <= (\d{3})_000/g;
  const sizes = [...text.matchAll(sizeRe)];
  if (sizes.length !== 1) die(`${rel}: expected exactly one cartridge ceiling, found ${sizes.length}`);
  const oldKb = sizes[0][1];
  const N = args['prep-gate-kb'];
  if (Number(N) <= Number(oldKb)) die(`--prep-gate-kb ${N} does not raise the current ${oldKb} kB ceiling`);
  const msgRe = /exceeds the \d{3} kB recorded ceiling \([^)`]*\)/g;
  if ([...text.matchAll(msgRe)].length !== 1) die(`${rel}: ceiling message not found exactly once`);
  const reason = args['prep-gate-reason'].replace(/[`$\\]/g, '');
  const next = text.replace(sizeRe, `fs.statSync(cartridgePath).size <= ${N}_000`)
    .replace(msgRe, `exceeds the ${N} kB recorded ceiling (400 kB target; raised from ${oldKb} kB: ${reason})`);
  fs.writeFileSync(path.join(ROOT, rel), next);
  run('git', ['add', '--', rel]);
  commitWithMessage(`gate: raise the recorded cartridge ceiling from ${oldKb} kB to ${N} kB (${reason})\n\nPreparatory commit for the ${G} release. Lint and STATE.md parity pass; live composition unchanged.${trailers}\n`);
  checkPrep(`prep gate ${oldKb} -> ${N} kB`);
}
report.prep_commits = prepCommits;
const releaseParent = git('rev-parse', 'HEAD');

/* ------------------------------------------- 3. pointer and STATE.md only */
step(`write atlas/current.json from ${manifestRel} and regenerate STATE.md`);
fs.writeFileSync(path.join(ROOT, 'atlas/current.json'), derived);
const state = run('node', ['tools/scope/loop.mjs', 'state'], { allowFail: true });
const restore = () => run('git', ['checkout', '--', ...POINTER_FILES], { allowFail: true });
if (state.status !== 0) { restore(); die(`loop.mjs state failed:\n${state.out}`); }
ok(state.out.trim());
const changed = changedPaths();
if (JSON.stringify(changed) !== JSON.stringify([...POINTER_FILES].sort())) {
  restore(); die(`the release must change exactly ${POINTER_FILES.join(' and ')}; it changed: ${changed.join(', ')}`);
}
ok(`changed: ${changed.join(', ')}`);

/* ----------------------------------------------------------------- 4. gates */
step('gates');
const gates = runGates({ expectGeneration: G, proofs, parityBaseline, rollbackTo: predecessor });
printGates(gates.rows);
if (args.log) fs.writeFileSync(path.resolve(args.log), gates.log);
report.gates = gates.rows;
report.parity_after = gates.parityRows;
if (JSON.stringify(changedPaths()) !== JSON.stringify([...POINTER_FILES].sort())) { restore(); die('a gate wrote outside the pointer files'); }
if (!gates.rows.every(r => r.ok)) {
  restore();
  console.error(`\n${TOOL}: gates FAILED; the pointer was restored. Branch ${branch} holds ${prepCommits.length} prep commit(s) only.`);
  finish(1);
}

const after = Object.fromEntries(POINTER_FILES.map(f => [f, sha256File(f)]));
report.after = after;

/* ---------------------------------------------------------- 5. the commit */
if (!args['no-commit']) {
  run('git', ['add', '--', ...POINTER_FILES]);
  const subject = `${G}-gridatlas-${manifest.composition_version}: ${args.title || `release composition ${G} to the live route`}`;
  const body = `Moves atlas/current.json and STATE.md from ${live.generation} to ${G}, written from ${manifestRel} by tools/release/release-generation.mjs. Nothing else changes.\nRollback: git revert this commit (tools/release/rollback-generation.mjs).\n\nAuthorised by: ${args['authorised-by']}`;
  const sha = commitWithMessage(`${subject}\n\n${body}${trailers}\n`);
  const touched = git('diff', '--name-only', 'HEAD^', 'HEAD').split('\n').filter(Boolean).sort();
  if (JSON.stringify(touched) !== JSON.stringify([...POINTER_FILES].sort())) die(`release commit touched ${touched.join(', ')}`);
  report.release_commit = sha;
  report.release_tree = git('rev-parse', 'HEAD^{tree}');
}

step('hashes');
for (const f of POINTER_FILES) console.log(`  ${f.padEnd(20)} before ${before[f]}\n  ${''.padEnd(20)} after  ${after[f]}`);
for (const p of prepCommits) console.log(`  prep commit          ${p.sha}  ${p.label}`);
if (report.release_commit) {
  console.log(`  release commit       ${report.release_commit}`);
  console.log(`  release tree         ${report.release_tree}`);
  console.log(`  parent of release    ${releaseParent}`);
  console.log(`\n${git('diff', '--stat', `${baseSha}..HEAD`)}`);
  console.log(`\nRELEASE READY on branch ${branch} (not pushed). Next, by a person:
  git push -u origin ${branch}
  gh pr create --draft --base main --head ${branch}   # Rebase and merge, never squash: the release commit must stay separately revertable
  # after merge + Pages deploy: GRIDATLAS_BASE_URL=https://ventusltd.github.io/gridatlas/ node tools/scope/verify-live.mjs
  # rollback: node tools/release/rollback-generation.mjs --release-commit <merged sha of the release commit>`);
} else {
  console.log(`\nRELEASE STAGED (--no-commit) on branch ${branch}; inspect with git diff.`);
}
finish(0);
