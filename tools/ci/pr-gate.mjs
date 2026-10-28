/**
 * The pull-request gate: every check that was run by hand before a cut,
 * run by the runner on every PR to main. Node built-ins only, no browser,
 * no network, no secrets. See docs/CI.md.
 *
 *   node tools/ci/pr-gate.mjs                    # diff against origin/main
 *   node tools/ci/pr-gate.mjs --base <sha>       # diff against a given commit
 *
 * Checks, in order; every check runs even after an earlier one fails, so one
 * run reports everything that is wrong:
 *
 *   lint              node tools/scope/loop.mjs lint
 *   state-parity      node tools/scope/loop.mjs state --stdout == STATE.md
 *   generations       for every generation the PR touches, and the one
 *                     atlas/current.json points to: its pinned composition
 *                     (atlas/v/<gen>/current.json) hashes, and every
 *                     tools/proofs/<gen>-*.proof.mjs
 *   run-current       node tools/proofs/run-current.mjs
 *   verify-compose    node tools/scope/verify-compose.mjs
 *   loader-identity   every atlas/v/<gen>/index.html is byte-identical to
 *                     atlas/index.html
 *   lightning-suites  tools/ci/lightning/*.test.mjs against the live overlay
 *                     module, every overlay module the PR adds or edits, and
 *                     the overlay of every pinned generation the PR adds
 *
 * A generation is "touched" when a changed path under atlas/ or tools/proofs/
 * carries its twelve-digit stamp as a path segment or a filename prefix.
 * A NEW pinned generation (atlas/v/<gen>/current.json added by the PR) with no
 * proof is a failure, as run-current already treats a composed cartridge with
 * no proof. Historical generations that never had a proof are reported, not
 * failed: nothing can be run for them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// The same served-bytes digest every other verifier in this repository uses.
import { sha256PublishedFile as sha256Published } from '../scope/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STAMP = /^\d{12}$/;
const PROOF_TIMEOUT_MS = 180_000;

const args = process.argv.slice(2);
const baseFlag = args.indexOf('--base');
const BASE = baseFlag >= 0 ? args[baseFlag + 1] : 'origin/main';

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  // An annotation shows on the PR itself, without opening the log.
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error title=PR gate: ${name}::${String(detail).replace(/\r?\n/g, ' ')}`);
}

function run(argv, opts = {}) {
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd: ROOT, encoding: 'utf8', timeout: PROOF_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024, ...opts
  });
  return { code: r.status ?? (r.signal ? 124 : 1), stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

// The line that says what went wrong: the first Error/FAIL line if there is
// one (an assertion's stack ends in '}', which says nothing), else the last.
function tail(text, lines = 6) {
  const all = text.trim().split(/\r?\n/);
  const hit = all.find(l => /(Error|FAIL|mismatch|missing)\b/.test(l));
  return (hit ? [hit.trim()] : all.slice(-lines)).join(' ').slice(0, 400);
}

function group(title, fn) {
  if (process.env.GITHUB_ACTIONS) console.log(`::group::${title}`);
  try { return fn(); } finally { if (process.env.GITHUB_ACTIONS) console.log('::endgroup::'); }
}

function step(name, argv) {
  return group(name, () => {
    const r = run(argv);
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    record(name, r.code === 0, r.code === 0 ? '' : `exit ${r.code}: ${tail(r.stderr || r.stdout, 3)}`);
    return r;
  });
}

// ---------------------------------------------------------------- the diff
const diff = run(['git', 'diff', '--name-only', '--no-renames', BASE]);
if (diff.code !== 0) {
  console.error(`cannot diff against ${BASE}: ${diff.stderr.trim()}`);
  console.error('fetch the base first (git fetch origin main) or pass --base <sha>');
  process.exit(2);
}
const changed = diff.stdout.split('\n').map(s => s.trim()).filter(Boolean);
const baseHas = file => run(['git', 'cat-file', '-e', `${BASE}:${file}`]).code === 0;
console.log(`base ${BASE}; ${changed.length} changed path(s)`);

const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const touched = new Set();
for (const file of changed) {
  if (!file.startsWith('atlas/') && !file.startsWith('tools/proofs/')) continue;
  if (file.startsWith('atlas/releases/')) continue; // immutable shells, not generations
  for (const segment of file.split('/')) {
    const stamp = segment.slice(0, 12);
    if (STAMP.test(stamp) && (segment.length === 12 || segment[12] === '-')) touched.add(stamp);
  }
}
const generations = new Set([...touched, String(current.generation)]);
console.log(`generations under test: ${[...generations].sort().join(', ')}` +
  ` (touched: ${[...touched].sort().join(', ') || 'none'}; live: ${current.generation})`);

// ---------------------------------------------------------------- 1, 2
step('lint', ['node', 'tools/scope/loop.mjs', 'lint']);

group('state-parity', () => {
  const r = run(['node', 'tools/scope/loop.mjs', 'state', '--stdout']);
  const committed = fs.readFileSync(path.join(ROOT, 'STATE.md'), 'utf8');
  const ok = r.code === 0 && r.stdout === committed;
  record('state-parity', ok, ok ? '' : r.code !== 0
    ? `state --stdout exit ${r.code}: ${tail(r.stderr, 3)}`
    : 'STATE.md differs from `node tools/scope/loop.mjs state --stdout`; regenerate it in the same commit');
});

// ---------------------------------------------------------------- 3
const proofsDir = path.join(ROOT, 'tools', 'proofs');
const proofFiles = fs.readdirSync(proofsDir).filter(f => /^\d{12}-.+\.proof\.mjs$/.test(f));
for (const gen of [...generations].sort()) {
  group(`generation ${gen}`, () => {
    const pinned = path.join(ROOT, 'atlas', 'v', gen, 'current.json');
    const isLive = gen === String(current.generation);
    if (fs.existsSync(pinned)) {
      const failures = [];
      let composition;
      try { composition = JSON.parse(fs.readFileSync(pinned, 'utf8')); }
      catch (e) { failures.push(`unreadable: ${e.message}`); }
      if (composition) {
        if (String(composition.generation) !== gen) failures.push(`declares generation ${composition.generation}`);
        const byId = new Map((composition.cartridges || []).map(c => [c.id, c]));
        for (const id of composition.cartridge_order || []) {
          const c = byId.get(id);
          if (!c) { failures.push(`${id}: in cartridge_order but not in cartridges`); continue; }
          const file = path.resolve(path.dirname(pinned), c.path);
          if (!file.startsWith(path.join(ROOT, 'atlas') + path.sep)) { failures.push(`${id}: path escapes atlas/`); continue; }
          if (!fs.existsSync(file)) { failures.push(`${id}: ${path.relative(ROOT, file)} missing`); continue; }
          if (sha256Published(file) !== c.sha256) failures.push(`${id}: SHA-256 mismatch for ${path.relative(ROOT, file)}`);
        }
      }
      record(`composition ${gen}`, failures.length === 0, failures.join('; '));
    }
    const proofs = proofFiles.filter(f => f.startsWith(`${gen}-`)).sort();
    if (!proofs.length) {
      const isNew = fs.existsSync(pinned) && !baseHas(`atlas/v/${gen}/current.json`);
      if (isNew || isLive) record(`proof ${gen}`, false, `no tools/proofs/${gen}-*.proof.mjs for a ${isLive ? 'live' : 'new pinned'} generation`);
      else console.log(`note  ${gen}: historical generation with no proof; nothing to run`);
      return;
    }
    for (const proof of proofs) {
      const r = run(['node', path.join('tools', 'proofs', proof)]);
      process.stdout.write(r.stdout);
      process.stderr.write(r.stderr);
      record(`proof ${proof}`, r.code === 0, r.code === 0 ? '' : `exit ${r.code}: ${tail(r.stderr || r.stdout, 3)}`);
    }
  });
}

// ---------------------------------------------------------------- 4, 5
step('run-current', ['node', 'tools/proofs/run-current.mjs']);
step('verify-compose', ['node', 'tools/scope/verify-compose.mjs']);

// ---------------------------------------------------------------- 6
group('loader-identity', () => {
  const loader = fs.readFileSync(path.join(ROOT, 'atlas', 'index.html'));
  const vDir = path.join(ROOT, 'atlas', 'v');
  const dirs = fs.existsSync(vDir) ? fs.readdirSync(vDir).filter(d => STAMP.test(d)).sort() : [];
  const bad = [];
  let checked = 0;
  for (const d of dirs) {
    const file = path.join(vDir, d, 'index.html');
    if (!fs.existsSync(file)) {
      if (fs.existsSync(path.join(vDir, d, 'current.json'))) bad.push(`atlas/v/${d}/index.html missing beside its current.json`);
      continue;
    }
    checked += 1;
    if (!loader.equals(fs.readFileSync(file))) bad.push(`atlas/v/${d}/index.html`);
  }
  record('loader-identity', bad.length === 0,
    bad.length ? `not byte-identical to atlas/index.html: ${bad.join(', ')}` : `${checked} pinned loader(s) identical to atlas/index.html`);
});

// ---------------------------------------------------------------- 7
group('lightning-suites', () => {
  const suiteDir = path.join(ROOT, 'tools', 'ci', 'lightning');
  const suites = fs.existsSync(suiteDir) ? fs.readdirSync(suiteDir).filter(f => f.endsWith('.test.mjs')).sort() : [];
  const sld = (current.cartridges || []).find(c => c.id === 'sld-sandbox');
  // The live overlay, every overlay module the PR adds or edits, and the
  // overlay of any pinned generation the PR adds. Not every touched
  // generation: the suite was written RED against the first candidates
  // (202610261949, 202610262323), so a PR that only edits an old proof must
  // not be failed for a module it did not change.
  const gens = new Set();
  if (sld) gens.add(String(sld.generation));
  for (const file of changed) {
    const m = file.match(/^atlas\/modules\/(\d{12})-uk-lightning-overlay\.js$/)
      || file.match(/^atlas\/v\/(\d{12})\/current\.json$/);
    if (m && (file.startsWith('atlas/modules/') || !baseHas(file))) gens.add(m[1]);
  }
  const modules = [...gens].sort()
    .map(g => ({ g, file: path.join('atlas', 'modules', `${g}-uk-lightning-overlay.js`) }))
    .filter(m => fs.existsSync(path.join(ROOT, m.file)));
  if (!modules.length) { console.log('note  no lightning overlay module in the live or touched generations'); return; }
  if (!suites.length) { record('lightning-suites', false, 'tools/ci/lightning/*.test.mjs missing'); return; }
  for (const { g, file } of modules) {
    for (const suite of suites) {
      const r = run(['node', '--test', '--test-reporter=tap', path.join('tools', 'ci', 'lightning', suite)], {
        env: { ...process.env, LIGHTNING_MODULE: file, LIGHTNING_TEST_GEN: g }
      });
      const counts = (r.stdout.match(/^# (pass|fail) \d+$/gm) || []).join(' ').replace(/# /g, '');
      if (r.code !== 0) process.stdout.write(r.stdout);
      record(`lightning ${g} ${suite}`, r.code === 0, counts + (r.code === 0 ? '' : `  exit ${r.code}`));
    }
  }
});

// ---------------------------------------------------------------- summary
const failed = results.filter(r => !r.ok);
const lines = [
  '## PR gate', '',
  `Base \`${BASE}\`, ${changed.length} changed path(s). Generations under test: ${[...generations].sort().map(g => `\`${g}\``).join(', ')}.`, '',
  '| check | result | detail |', '|---|---|---|',
  ...results.map(r => `| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${String(r.detail).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')} |`), '',
  `${results.length - failed.length}/${results.length} passed.`
];
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (process.env.GITHUB_ACTIONS) {
  console.log(`::notice title=PR gate::${results.length - failed.length}/${results.length} passed; generations ${[...generations].sort().join(', ')}; ` +
    results.map(r => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}`).join('; '));
}
if (failed.length) {
  for (const f of failed) console.error(`  FAIL ${f.name}`);
  process.exitCode = 1;
}
