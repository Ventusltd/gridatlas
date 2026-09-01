/**
 * The night shift: one queued step per invocation, cut on this laptop,
 * proven here, pushed to GitHub, verified live.
 *
 * Asked for on 1 Sep 2026: ten GridAtlas versions overnight, each stamped at
 * the UTC moment it is cut, the laptop doing the compute and GitHub being
 * the version control and the deployment engine. The reviewer is the agent
 * that wakes between runs, reads shift-log.json, and improves this file.
 *
 *   node tools/overnight/202609012200-shift.mjs            # next pending step
 *   node tools/overnight/202609012200-shift.mjs --step tools/overnight/steps/<file>
 *   node tools/overnight/202609012200-shift.mjs --dry      # apply + prove, no cut
 *
 * A step is a module under tools/overnight/steps/ exporting
 *   { id, version, scope, note, brings?: [untracked files it wrote by hand],
 *     addModules?: [], replaceModules?: ['old=new'], proofs?: [paths],
 *     apply({ root, patch, read, write }) }
 * and it is applied to the working tree, checked, composed by recompose
 * (which reads the clock), proven, committed with a subject stamped from the
 * clock, pushed to main, and watched until the live bytes match.
 *
 * Fail closed: any red anywhere and the working tree is put back to what it
 * was before the step was applied, the reason is written to the log, and
 * the process exits non-zero so the next wake reads why before anything
 * else is attempted. Nothing shipped is amended; a failed step is not cut
 * and its stamp is never used.
 *
 * First lesson, 22:03 UTC: the first draft's undo ran `git clean` on
 * tools/proofs and deleted the proof the step had brought, on a
 * PRECONDITION failure, before anything had been applied. The undo now
 * removes only files that appeared after the step was applied, and never
 * runs before that point.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STEPS = path.join(ROOT, 'tools', 'overnight', 'steps');
const LOG = path.join(ROOT, 'tools', 'overnight', 'shift-log.json');
const LIVE = 'https://ventusltd.github.io/gridatlas/atlas/';
const API = 'https://api.github.com/repos/Ventusltd/gridatlas';

const flag = (name) => process.argv.includes(name);
const opt = (name) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : null; };
const utcNow = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const lf = (s) => String(s).split('\r\n').join('\n');
const slash = (p) => String(p).split('\\').join('/');

function run(cmd, args, { cwd = ROOT, allowFail = false, quiet = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: false });
  const out = (r.stdout || '') + (r.stderr || '');
  if (!quiet) process.stdout.write(out.length > 6000 ? out.slice(-6000) : out);
  if (r.status !== 0 && !allowFail) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  return { status: r.status, out };
}
const git = (...args) => run('git', args, { quiet: true }).out.trim();
/* not trimmed: the first column is a space for a modified file */
const status = () => run('git', ['status', '--porcelain'], { quiet: true }).out.split('\n').filter(Boolean);
const untracked = () => git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).map(slash);

const log = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : { schema: 'gridatlas.shift-log.v1', runs: [] };
function record(entry) {
  log.runs.push(entry);
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
}

/* ── choose the step ─────────────────────────────────────────────────── */
const done = new Set(log.runs.filter(r => r.outcome === 'live').map(r => r.step));
let stepPath = opt('--step');
if (!stepPath) {
  const pending = fs.readdirSync(STEPS).filter(f => f.endsWith('.mjs')).sort().filter(f => !done.has(f));
  if (!pending.length) { console.log('no pending step'); process.exit(0); }
  stepPath = path.join(STEPS, pending[0]);
}
const stepFile = path.basename(stepPath);
const step = (await import(pathToFileURL(path.resolve(stepPath)).href)).default;
for (const key of ['id', 'version', 'scope', 'note', 'apply']) {
  if (!step[key]) { console.error(`step ${stepFile} lacks ${key}`); process.exit(2); }
}
const dry = flag('--dry');
const startedAt = new Date().toISOString();
console.log(`\n\x1b[1mshift step ${step.id} -> ${step.version}\x1b[0m  (${stepFile})  ${startedAt}${dry ? '  [dry]' : ''}`);

const entry = { step: stepFile, id: step.id, version: step.version, started_at: startedAt, dry, stages: [] };
const stage = (name, detail) => { entry.stages.push({ name, at: new Date().toISOString(), ...detail }); console.log(`  \x1b[36m${name}\x1b[0m ${detail ? JSON.stringify(detail).slice(0, 200) : ''}`); };

/* the undo: tracked files back to HEAD, and only the untracked files that
   appeared AFTER the step was applied are removed. Armed after apply. */
let untrackedBefore = null;
function undo() {
  if (untrackedBefore === null) return;
  run('git', ['checkout', '--', '.'], { allowFail: true, quiet: true });
  const before = new Set(untrackedBefore);
  for (const p of untracked()) if (!before.has(p)) fs.rmSync(path.join(ROOT, p), { force: true, recursive: true });
}
function fail(reason, extra = {}) {
  entry.outcome = 'failed'; entry.reason = reason; entry.finished_at = new Date().toISOString(); Object.assign(entry, extra);
  console.log(`\n\x1b[31mFAILED: ${reason}\x1b[0m`);
  undo();
  record(entry);
  process.exit(1);
}

/* ── preconditions: clean tree, in step with origin/main ─────────────── */
/* The tree may hold the runner and steps (committed on their own below) and
   the untracked files a step BRINGS - a proof written by hand for it. */
const brings = new Set((step.brings || []).map(slash));
const dirty = status();
const dirtyElsewhere = dirty.filter(l => !slash(l.slice(3)).startsWith('tools/overnight/') && !(l.startsWith('??') && brings.has(slash(l.slice(3)))));
if (dirtyElsewhere.length) fail('working tree not clean before the step', { dirty: dirtyElsewhere.slice(0, 20) });
for (const p of brings) if (!fs.existsSync(path.join(ROOT, p))) fail(`the step says it brings ${p}, and it is not there`);

run('git', ['fetch', 'origin', '--quiet'], { quiet: true });
const head = git('rev-parse', 'HEAD');
const originMain = git('rev-parse', 'origin/main');
if (head !== originMain) {
  const base = git('merge-base', 'HEAD', 'origin/main');
  if (base === head) {
    /* origin/main moved ahead (another agent pushed); take it, fast-forward only */
    run('git', ['merge', '--ff-only', 'origin/main'], { quiet: true });
    stage('fast-forwarded to origin/main', { from: head.slice(0, 7), to: originMain.slice(0, 7) });
  } else if (base !== originMain) {
    fail('origin/main has diverged from this worktree; a human merges, not the night shift', { head, origin_main: originMain });
  }
}

/* the step and the runner are committed on their own before the cut */
if (dirty.some(l => slash(l.slice(3)).startsWith('tools/overnight/')) && !dry) {
  run('git', ['add', 'tools/overnight'], { quiet: true });
  run('git', ['commit', '-q', '-m', `${utcNow()}: overnight - step ${step.id} authored`], { quiet: true });
  stage('tooling committed', { commit: git('rev-parse', '--short', 'HEAD') });
}

/* ── apply the step ─────────────────────────────────────────────────── */
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); fs.writeFileSync(path.join(ROOT, rel), text); };
function patch(rel, pairs) {
  let text = read(rel);
  for (const [from, to, label] of pairs) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${rel}: anchor found ${count} times (${label || from.slice(0, 60)})`);
    text = text.replace(from, () => to);
  }
  write(rel, text);
}
untrackedBefore = untracked();
try {
  await step.apply({ root: ROOT, read, write, patch, run });
} catch (error) { fail(`apply: ${error.message}`); }
const changed = status().map(l => slash(l.slice(3))).filter(p => !p.startsWith('tools/overnight/'));
stage('applied', { changed });
if (!changed.length) fail('the step changed nothing');

/* every changed script must parse */
for (const rel of changed.filter(f => f.endsWith('.js') || f.endsWith('.mjs'))) {
  if (!fs.existsSync(path.join(ROOT, rel))) continue;
  const r = run(process.execPath, ['--check', rel], { allowFail: true, quiet: true });
  if (r.status !== 0) fail(`node --check ${rel}`, { output: r.out.slice(0, 2000) });
}
stage('syntax checked');

/* the step's own proofs, before the cut (module parity etc.) */
for (const proof of step.proofs || []) {
  const r = run(process.execPath, [proof], { allowFail: true });
  const m = r.out.match(/(\d+)\/(\d+) passed/);
  stage(`step proof ${path.basename(proof)}`, { status: r.status, tally: m ? m[1] + '/' + m[2] : undefined });
  if (r.status !== 0) fail(`step proof red: ${proof}`);
}

/* ── compose: recompose reads the clock ─────────────────────────────── */
const proofs = fs.readdirSync(path.join(ROOT, 'tools', 'proofs')).filter(f => f.endsWith('-sld-sandbox.proof.mjs'));
if (proofs.length !== 1) fail('expected exactly one sld-sandbox proof', { proofs });
const before = JSON.parse(read('atlas/current.json'));
if (dry) {
  entry.outcome = 'dry'; entry.finished_at = new Date().toISOString(); record(entry);
  console.log('\n--dry: applied, checked and step-proven; not composing. The working tree is left as applied.');
  process.exit(0);
}
const composeArgs = ['tools/recompose.mjs', '--version', step.version, '--restamp', 'sld-sandbox',
  '--scope', step.scope, '--proof', `tools/proofs/${proofs[0]}`, '--note', step.note];
for (const m of step.addModules || []) composeArgs.push('--add-module', m);
for (const m of step.replaceModules || []) composeArgs.push('--replace-module', m);
{
  const r = run(process.execPath, composeArgs, { allowFail: true });
  if (r.status !== 0) fail('recompose refused the cut', { output: r.out.slice(-3000) });
}
const current = JSON.parse(read('atlas/current.json'));
const generation = current.generation;
if (generation === before.generation) fail('recompose did not advance the generation');
if (current.previous_generation !== before.generation) fail('the chain is broken: previous_generation is not the generation just superseded');
stage('composed', { generation, version: step.version, previous: before.generation });

/* ── prove everything ───────────────────────────────────────────────── */
const gates = [
  ['sandbox proof', [`tools/proofs/${generation}-sld-sandbox.proof.mjs`]],
  ['run-current', ['tools/proofs/run-current.mjs']],
  ['parts integrity', ['tools/proofs/202609012105-parts-integrity.proof.mjs']],
  ['all versions', ['tools/proofs/202609012150-all-versions.proof.mjs']],
  ['local CI (proofs, deep scan, stamps, cvaa)', ['tools/ci/202609012200-local-ci.mjs']],
];
for (const [name, args] of gates) {
  if (!fs.existsSync(path.join(ROOT, args[0]))) fail(`gate missing: ${args[0]}`);
  const r = run(process.execPath, args, { allowFail: true });
  const m = r.out.match(/(\d+)\/(\d+) passed/);
  stage(`gate ${name}`, { status: r.status, tally: m ? m[1] + '/' + m[2] : undefined });
  if (r.status !== 0) fail(`gate red: ${name}`, { output: r.out.slice(-3000) });
}

/* ── commit from the clock, push, watch it go live ──────────────────── */
const stamp = utcNow();
run('git', ['add', '-A'], { quiet: true });
run('git', ['commit', '-q', '-m', `${generation}-gridatlas-${step.version}: ${step.note}`], { quiet: true });
const commit = git('rev-parse', 'HEAD');
untrackedBefore = null; /* committed: nothing left to undo */
stage('committed', { commit: commit.slice(0, 7), subject_stamp: generation, clock_at_commit: stamp });
{
  const r = run('git', ['push', 'origin', 'HEAD:main', 'HEAD'], { allowFail: true, quiet: true });
  if (r.status !== 0) { entry.outcome = 'committed-not-pushed'; entry.reason = r.out.slice(-1500); entry.finished_at = new Date().toISOString(); record(entry); process.exit(1); }
}
stage('pushed');

const sld = current.cartridges.find(c => c.id === 'sld-sandbox');
const localBytes = fs.readFileSync(path.join(ROOT, 'atlas', sld.path.replace('./', '')));
const localSha = sha256(lf(localBytes.toString('utf8')));
const deadline = Date.now() + 12 * 60 * 1000;
let live = null;
while (Date.now() < deadline) {
  await new Promise(r => setTimeout(r, 20000));
  try {
    const t = Date.now();
    const c = await (await fetch(`${LIVE}current.json?t=${t}`, { cache: 'no-store' })).json();
    if (c.generation === generation) {
      const bytes = await (await fetch(`${LIVE}${sld.path.replace('./', '')}?t=${t}`, { cache: 'no-store' })).text();
      live = { generation: c.generation, version: c.composition_version, cartridge_sha_matches: sha256(lf(bytes)) === localSha, at: new Date().toISOString() };
      break;
    }
    process.stdout.write(`  live is ${c.generation}, waiting for ${generation}\r`);
  } catch (error) { process.stdout.write(`  live check: ${error.message}\r`); }
}
let actions = null;
try {
  const runs = await (await fetch(`${API}/actions/runs?per_page=10&head_sha=${commit}`)).json();
  actions = (runs.workflow_runs || []).map(r => ({ name: r.name, status: r.status, conclusion: r.conclusion, url: r.html_url }));
} catch { /* the API is a witness, not a gate */ }
entry.actions = actions;
entry.live = live;
entry.generation = generation;
entry.commit = commit;
entry.finished_at = new Date().toISOString();
if (!live) { entry.outcome = 'pushed-not-seen-live'; entry.reason = 'Pages did not serve the generation within 12 minutes'; record(entry); process.exit(1); }
if (!live.cartridge_sha_matches) { entry.outcome = 'live-bytes-differ'; record(entry); process.exit(1); }
entry.outcome = 'live';
record(entry);
run('git', ['add', LOG], { quiet: true });
run('git', ['commit', '-q', '-m', `${utcNow()}: overnight - ${step.version} ${generation} verified live`], { quiet: true });
console.log(`\n\x1b[32m${step.version} ${generation} is live; cartridge sha matches\x1b[0m`);
