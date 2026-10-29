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
 *   loader-registry   atlas/index.html and every atlas/v/<gen>/index.html is
 *                     byte-identical to a registered loader
 *                     (tools/scope/lib.mjs ATLAS_LOADERS) that supports every
 *                     slot its own current.json uses; a loader that exists at
 *                     the base is never rewritten, and atlas/index.html
 *                     changes with atlas/current.json, to the loader of
 *                     the generation going live (docs/LIGHTNING-CARTRIDGE.md),
 *                     or alone, to a registered loader proven to compose the
 *                     unchanged live pointer byte for byte as the base's
 *                     loader does (tools/release/loader-swap.mjs check)
 *   loader-equivalence  tools/proofs/loader-equivalence.proof.mjs
 *   lightning-source  node tools/lightning/build.mjs --check: the newest
 *                     lightning overlay generation is listed in
 *                     tools/lightning/generations.json, and every listed
 *                     generation rebuilds from tools/lightning/src byte for
 *                     byte (docs/LIGHTNING-SOURCE.md)
 *   offtakers-source  node tools/offtakers/build.mjs --check (the same, for the
 *                     potential-offtakers overlay; docs/OFFTAKERS-SOURCE.md)
 *   lightning-suites  tools/ci/lightning/*.test.mjs against the live overlay
 *                     module, every overlay module the PR adds or edits, the
 *                     overlay of every pinned generation the PR adds, and,
 *                     when the PR changes a suite or this gate, the newest
 *                     pinned overlay; a suite marked
 *                     `@gate-min-generation <stamp>` skips older modules
 *   offtakers-suites  tools/ci/offtakers/*.test.mjs once per (offtakers module,
 *                     lightning module) pair composed by the live pointer, by a
 *                     pinned composition the PR adds or edits, or by one that
 *                     composes an overlay module the PR adds or edits (and the
 *                     newest such composition when the PR changes a suite, the
 *                     source or this gate), each with that composition's OWN
 *                     lightning module; an uncomposed module runs against
 *                     the suite's default lightning module
 *   release-tools     node --check of every tools/release/*.mjs and
 *                     node --test tools/release/*.test.mjs (offline)
 *
 * A generation is "touched" when a changed path under atlas/ or tools/proofs/
 * carries its twelve-digit stamp as a path segment or a filename prefix.
 * A NEW pinned generation (atlas/v/<gen>/current.json added by the PR) with no
 * proof is a failure, as run-current already treats a composed cartridge with
 * no proof. Historical generations that never had a proof are reported, not
 * failed: nothing can be run for them.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// The same served-bytes digest every other verifier in this repository uses.
import { sha256PublishedFile as sha256Published, registeredLoader, slotsUsed } from '../scope/lib.mjs';

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
group('loader-registry', () => {
  const vDir = path.join(ROOT, 'atlas', 'v');
  const dirs = fs.existsSync(vDir) ? fs.readdirSync(vDir).filter(d => STAMP.test(d)).sort() : [];
  const bad = [];
  const count = {};
  const check = (indexRel, currentRel) => {
    const loader = registeredLoader(path.join(ROOT, indexRel));
    if (!loader) { bad.push(`${indexRel} is not a registered loader`); return; }
    count[loader.name] = (count[loader.name] || 0) + 1;
    let pointer;
    try { pointer = JSON.parse(fs.readFileSync(path.join(ROOT, currentRel), 'utf8')); } catch { return; }
    for (const slot of slotsUsed(pointer)) if (!loader.slots.includes(slot)) bad.push(`${indexRel} (loader ${loader.name}) cannot compose slot ${slot} of ${currentRel}`);
  };
  check('atlas/index.html', 'atlas/current.json');
  for (const d of dirs) {
    const rel = `atlas/v/${d}/index.html`;
    if (!fs.existsSync(path.join(ROOT, rel))) {
      if (fs.existsSync(path.join(vDir, d, 'current.json'))) bad.push(`${rel} missing beside its current.json`);
      continue;
    }
    check(rel, `atlas/v/${d}/current.json`);
  }
  // Existing generations keep the loader bytes they were cut with.
  for (const file of changed) {
    if (/^atlas\/v\/\d{12}\/index\.html$/.test(file) && baseHas(file)) bad.push(`${file} existed at the base and was changed or removed`);
  }
  // The live loader moves either with the pointer, to the loader of the generation going live, or ON ITS OWN
  // (step 1 of a two-step release, docs/RELEASE.md): then it must be a registered loader that composes the
  // unchanged live pointer byte for byte as the base's loader does (tools/release/loader-swap.mjs check).
  if (changed.includes('atlas/index.html')) {
    const liveIndex = path.join(ROOT, 'atlas', 'v', String(current.generation), 'index.html');
    if (!changed.includes('atlas/current.json')) {
      const swap = run(['node', 'tools/release/loader-swap.mjs', 'check', '--base', BASE]);
      process.stdout.write(swap.stdout);
      process.stderr.write(swap.stderr);
      if (swap.code !== 0) bad.push(`atlas/index.html changed without atlas/current.json and is not a proven loader-only change: ${tail(swap.stdout || swap.stderr, 2)}`);
    } else if (!fs.existsSync(liveIndex) || !fs.readFileSync(liveIndex).equals(fs.readFileSync(path.join(ROOT, 'atlas', 'index.html')))) {
      bad.push(`atlas/index.html changed but is not atlas/v/${current.generation}/index.html`);
    }
  }
  record('loader-registry', bad.length === 0, bad.length ? bad.join('; ')
    : `${1 + dirs.length} served loader(s) registered (${Object.entries(count).map(([k, v]) => `${k} ${v}`).join(', ')}); each supports its own composition`);
});
step('loader-equivalence', ['node', 'tools/proofs/loader-equivalence.proof.mjs']);

// ---------------------------------------------------------------- 6b
// The overlay modules are built from tools/lightning/src, not edited in
// atlas/modules/: the newest generation must rebuild from the committed
// source byte for byte, so the source in the repository is the source of
// the bytes that ship.
step('lightning-source', ['node', 'tools/lightning/build.mjs', '--check']);
// The same for the potential-offtakers overlay (tools/offtakers/src, docs/OFFTAKERS-SOURCE.md).
step('offtakers-source', ['node', 'tools/offtakers/build.mjs', '--check']);

// ---------------------------------------------------------------- 7
// Each suite may declare, in its first lines, `// @gate-min-generation <stamp>`:
// the first overlay generation it describes. It is run only against modules of
// that generation or later, because a suite that tests a newer feature (the
// REPD card of 202610282100) is RED by design on the modules before it.
const SUITE_TIMEOUT_MS = 240_000;
function runAsync(argv, opts = {}) {
  return new Promise(resolve => {
    const child = spawn(argv[0], argv.slice(1), { cwd: ROOT, ...opts });
    let stdout = '', stderr = '', timedOut = false;
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    const t = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, SUITE_TIMEOUT_MS);
    child.on('close', (code, signal) => { clearTimeout(t); resolve({ code: timedOut ? 124 : code ?? (signal ? 1 : 0), stdout, stderr, timedOut }); });
  });
}

const suiteDir = path.join(ROOT, 'tools', 'ci', 'lightning');
const suites = (fs.existsSync(suiteDir) ? fs.readdirSync(suiteDir).filter(f => f.endsWith('.test.mjs')).sort() : [])
  .map(name => {
    const head = fs.readFileSync(path.join(suiteDir, name), 'utf8').slice(0, 2048);
    const min = (head.match(/@gate-min-generation\s+(\d{12})\b/) || [])[1] || null;
    return { name, min };
  });
const overlayFile = g => path.join('atlas', 'modules', `${g}-uk-lightning-overlay.js`);
/* The overlay module a composition serves: its own 'uk-lightning-overlay'
   cartridge (the module file itself, docs/LIGHTNING-CARTRIDGE.md), else the
   module appended to its sld-sandbox, named by the sld-sandbox generation. */
function overlayGenerationOf(pointer) {
  const own = (pointer.cartridges || []).find(c => c.id === 'uk-lightning-overlay');
  const m = own && String(own.path).match(/(\d{12})-uk-lightning-overlay\.js$/);
  if (m) return m[1];
  const sldEntry = (pointer.cartridges || []).find(c => c.id === 'sld-sandbox');
  return sldEntry ? String(sldEntry.generation) : null;
}
// The live overlay, every overlay module the PR adds or edits, and the
// overlay of any pinned generation the PR adds. Not every touched
// generation: the suites were written RED against earlier candidates, so a
// PR that only edits an old proof must not be failed for a module it did
// not change. A PR that changes a suite, this gate or its workflow is also
// run against the newest pinned overlay (the candidate), so a suite edit is
// proven on the module it guards.
const gens = new Set();
const liveOverlay = overlayGenerationOf(current);
if (liveOverlay) gens.add(liveOverlay);
for (const file of changed) {
  const m = file.match(/^atlas\/modules\/(\d{12})-uk-lightning-overlay\.js$/);
  if (m) { gens.add(m[1]); continue; }
  const v = file.match(/^atlas\/v\/(\d{12})\/current\.json$/);
  if (v && !baseHas(file)) {
    gens.add(v[1]);
    try {
      const g = overlayGenerationOf(JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')));
      if (g) gens.add(g);
    } catch { /* the composition check above reports an unreadable pointer */ }
  }
}
const gateChanged = changed.some(f => f.startsWith('tools/ci/lightning/') || f === 'tools/ci/pr-gate.mjs'
  || f === '.github/workflows/pr-file-size-guard.yml');
if (gateChanged) {
  const vDir = path.join(ROOT, 'atlas', 'v');
  const pinned = (fs.existsSync(vDir) ? fs.readdirSync(vDir) : [])
    .filter(d => STAMP.test(d) && fs.existsSync(path.join(vDir, d, 'current.json')) && fs.existsSync(path.join(ROOT, overlayFile(d))))
    .sort();
  if (pinned.length) gens.add(pinned[pinned.length - 1]);
}
const modules = [...gens].sort().map(g => ({ g, file: overlayFile(g) })).filter(m => fs.existsSync(path.join(ROOT, m.file)));

if (!modules.length) console.log('note  no lightning overlay module in the live or touched generations');
else if (!suites.length) record('lightning-suites', false, 'tools/ci/lightning/*.test.mjs missing');
else {
  const jobs = [];
  for (const { g, file } of modules) {
    for (const suite of suites) {
      if (suite.min && g < suite.min) { console.log(`note  ${suite.name} starts at ${suite.min}; not run on ${g}`); continue; }
      jobs.push({ g, file, suite: suite.name });
    }
  }
  if (!jobs.length) record('lightning-suites', false, `no suite applies to ${modules.map(m => m.g).join(', ')}`);
  // The suites spend most of their time waiting on real timers (the 15 s
  // register timeout), not on the CPU, so they run side by side.
  const width = Math.max(2, Math.min(4, os.availableParallelism ? os.availableParallelism() : 2));
  const out = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, async () => {
    while (next < jobs.length) {
      const i = next++, { g, file, suite } = jobs[i], t0 = Date.now();
      const r = await runAsync(['node', '--test', '--test-reporter=tap', path.join('tools', 'ci', 'lightning', suite)], {
        env: { ...process.env, LIGHTNING_MODULE: file, LIGHTNING_TEST_GEN: g }
      });
      out[i] = { ...r, seconds: ((Date.now() - t0) / 1000).toFixed(1) };
    }
  }));
  jobs.forEach(({ g, suite }, i) => group(`lightning ${g} ${suite}`, () => {
    const r = out[i];
    const counts = (r.stdout.match(/^# (pass|fail|skipped) \d+$/gm) || []).join(' ').replace(/# /g, '');
    if (r.code !== 0) { process.stdout.write(r.stdout); process.stderr.write(r.stderr); }
    else console.log(`${suite} on ${g}: ${counts} in ${r.seconds} s`);
    record(`lightning ${g} ${suite}`, r.code === 0,
      `${counts} ${r.seconds} s` + (r.code === 0 ? '' : r.timedOut ? `  timed out after ${SUITE_TIMEOUT_MS / 1000} s` : `  exit ${r.code}`));
  }));
}

// ---------------------------------------------------------------- 8
// tools/ci/offtakers/*.test.mjs, run once per (offtakers module, lightning module) PAIR that a composition actually ships:
// the suite boots both overlays side by side (T1, T11, T13), so it must boot the lightning module the composition pairs
// with the offtakers module, not a fixed reference. The compositions under test: the live one; every pinned composition
// (atlas/v/<gen>/current.json) the PR adds or edits; every pinned composition that composes an offtakers or lightning
// module the PR adds or edits; and, when the PR changes a suite, the offtakers source or this gate, the newest pinned
// composition that composes an offtakers module (older ones, e.g. 202610290400, are historical: the suite has moved on
// with the data and the class defaults, as the lightning suites skip modules below @gate-min-generation). An offtakers module the PR adds that no composition composes yet (and,
// on a suite/source/gate change, the newest module if it is uncomposed) runs against the suite's default lightning module
// (LIGHTNING_MODULE unset), and the check name says so. A composition with an offtakers cartridge but no
// uk-lightning-overlay cartridge also runs against the default, named as such.
{
  const dir = path.join(ROOT, 'tools', 'ci', 'offtakers'), vDir = path.join(ROOT, 'atlas', 'v');
  const OFF = /(\d{12})-uk-offtakers-overlay\.js$/, LIG = /(\d{12})-uk-lightning-overlay\.js$/;
  const offFile = g => path.join('atlas', 'modules', `${g}-uk-offtakers-overlay.js`), ligFile = g => path.join('atlas', 'modules', `${g}-uk-lightning-overlay.js`);
  const modOf = (p, id, re) => { const e = (p.cartridges || []).find(c => c.id === id); const m = e && String(e.path).match(re); return m ? m[1] : null; };
  // every composition on disk that ships an offtakers cartridge, with the lightning module it pairs it with
  const comps = [{ name: 'atlas/current.json', p: current }];
  for (const d of (fs.existsSync(vDir) ? fs.readdirSync(vDir) : []).filter(d => STAMP.test(d)).sort()) {
    const f = path.join('atlas', 'v', d, 'current.json');
    if (fs.existsSync(path.join(ROOT, f))) try { comps.push({ name: f, p: JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) }); } catch { /* reported above */ }
  }
  const composed = comps.map(c => ({ name: c.name, o: modOf(c.p, 'uk-offtakers-overlay', OFF), l: modOf(c.p, 'uk-lightning-overlay', LIG) })).filter(c => c.o);
  const newest = composed.filter(c => c.name !== 'atlas/current.json').map(c => c.name).sort().at(-1);
  const offChanged = new Set(), ligChanged = new Set(), compChanged = new Set();
  for (const f of changed) {
    let m = f.match(/^atlas\/modules\/(\d{12})-uk-offtakers-overlay\.js$/); if (m) offChanged.add(m[1]);
    m = f.match(/^atlas\/modules\/(\d{12})-uk-lightning-overlay\.js$/); if (m) ligChanged.add(m[1]);
    if (/^atlas\/v\/\d{12}\/current\.json$/.test(f)) compChanged.add(f);
  }
  const wide = changed.some(f => f.startsWith('tools/ci/offtakers/') || f.startsWith('tools/offtakers/') || f === 'tools/ci/pr-gate.mjs');
  const pairs = new Map(); // "o|l" -> { o, l, why: [composition names] }
  const add = (o, l, why) => { const k = `${o}|${l || ''}`; if (!pairs.has(k)) pairs.set(k, { o, l, why: [] }); if (!pairs.get(k).why.includes(why)) pairs.get(k).why.push(why); };
  for (const c of composed) {
    if (c.name === 'atlas/current.json' || compChanged.has(c.name) || offChanged.has(c.o) || (c.l && ligChanged.has(c.l)) || (wide && c.name === newest)) add(c.o, c.l, c.name);
  }
  const uncomposed = new Set([...offChanged].filter(o => !composed.some(c => c.o === o)));
  if (wide) {
    const all = fs.readdirSync(path.join(ROOT, 'atlas', 'modules')).map(n => (n.match(/^(\d{12})-uk-offtakers-overlay\.js$/) || [])[1]).filter(Boolean).sort();
    if (all.length && !composed.some(c => c.o === all.at(-1))) uncomposed.add(all.at(-1));
  }
  for (const o of uncomposed) add(o, null, 'no composition yet');
  const osuites = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort() : [];
  if (!pairs.size) console.log('note  no offtakers overlay module in the live or touched compositions');
  else if (!osuites.length) record('offtakers-suites', false, 'tools/ci/offtakers/*.test.mjs missing');
  else for (const { o, l, why } of [...pairs.values()].sort((a, b) => (a.o + (a.l || '')).localeCompare(b.o + (b.l || '')))) for (const suite of osuites) {
    const name = `offtakers ${o} + ${l ? `lightning ${l}` : 'default lightning'} ${suite}`;
    group(name, () => {
      if (!fs.existsSync(path.join(ROOT, offFile(o)))) return record(name, false, `${offFile(o)} missing (${why.join(', ')})`);
      if (l && !fs.existsSync(path.join(ROOT, ligFile(l)))) return record(name, false, `${ligFile(l)} missing (${why.join(', ')})`);
      const env = { ...process.env, OFFTAKERS_MODULE: offFile(o) };
      if (l) env.LIGHTNING_MODULE = path.join(ROOT, ligFile(l)); else delete env.LIGHTNING_MODULE;
      const t0 = Date.now(), r = run(['node', '--test', '--test-reporter=tap', path.join('tools', 'ci', 'offtakers', suite)], { env, timeout: SUITE_TIMEOUT_MS });
      const counts = (r.stdout.match(/^# (pass|fail|skipped) \d+$/gm) || []).join(' ').replace(/# /g, ''), sec = ((Date.now() - t0) / 1000).toFixed(1);
      if (r.code !== 0) { process.stdout.write(r.stdout); process.stderr.write(r.stderr); } else console.log(`${suite} on ${o} + ${l || 'default lightning'}: ${counts} in ${sec} s`);
      record(name, r.code === 0, `${counts} ${sec} s; ${why.join(', ')}` + (r.code === 0 ? '' : `  exit ${r.code}`));
    });
  }
}
// The delivery-flow tooling (docs/RELEASE.md): its offline unit tests, and a
// syntax check of every script, so a broken release script fails the PR that
// broke it rather than the release that needs it.
group('release-tools', () => {
  const dir = path.join(ROOT, 'tools', 'release');
  if (!fs.existsSync(dir)) return;
  const scripts = fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort();
  const bad = scripts.filter(f => run(['node', '--check', path.join('tools', 'release', f)]).code !== 0);
  const tests = scripts.filter(f => f.endsWith('.test.mjs')).map(f => path.join('tools', 'release', f));
  const t = tests.length ? run(['node', '--test', '--test-reporter=tap', ...tests]) : { code: 0, stdout: '' };
  const counts = (t.stdout.match(/^# (pass|fail) \d+$/gm) || []).join(' ').replace(/# /g, '');
  if (t.code !== 0) { process.stdout.write(t.stdout); process.stderr.write(t.stderr || ''); }
  record('release-tools', bad.length === 0 && t.code === 0,
    `${scripts.length} script(s) parse${bad.length ? `; SYNTAX ERROR in ${bad.join(', ')}` : ''}; ${tests.length} test file(s): ${counts || 'none'}`);
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
