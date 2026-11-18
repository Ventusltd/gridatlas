#!/usr/bin/env node
/**
 * The twin of a generation: rebuild it from its pinned source in a clean
 * temporary directory, with the repository's own compiler and cut tools, and
 * compare every rebuilt file with the committed one byte for byte. The
 * committed generation must be exactly reproducible from its source, or this
 * fails naming the file. Nothing in the repository is written.
 *
 *   node tools/twin/replicate-generation.mjs --offline
 *       pins, coupling and cartridges only; no socket, no Python. The data
 *       rebuild is reported as NOT RUN. This is what tools/ci/pr-gate.mjs runs.
 *   node tools/twin/replicate-generation.mjs --source repd-2026q3.csv --oracle repd_master.json
 *       the whole twin from local files; no socket.
 *   node tools/twin/replicate-generation.mjs --network
 *       the whole twin; the source register and the oracle are fetched from
 *       the commit-pinned URLs in tools/twin/sources.json.
 *   --generation G     default: the generation atlas/current.json names, and the newest
 *                      generation in tools/twin/sources.json when that is a different one
 *   --python PATH      default: python3 (needs requirements.lock: duckdb, pyproj)
 *   --keep             keep the temporary directory and print its path
 *
 * Order (Ventusltd/testcode README, "offline first, then network, then
 * publish"; nothing here publishes): every offline step runs first, and the
 * network is not touched while an offline step is red.
 *
 *   1 pins       tools/twin/sources.json, the compiler's constants and the
 *                committed data manifest name the same source bytes
 *   2 coupling   the committed data files hash to what their manifest says,
 *                and the generation's own cartridges carry those hashes
 *   3 cartridges every cartridge the generation cut (same stamp) is rebuilt:
 *                an assembled cartridge by tools/build-cartridge.mjs from the
 *                parts its manifest lists, an overlay module by its build.mjs
 *   4 source     local file or pinned URL; refused unless sha256 and bytes
 *                equal the pin (Ventusltd/star-quantum-twin README: a record
 *                whose hash does not match is not used)
 *   5 data       the compiler, run twice into two empty directories; the two
 *                builds must agree with each other and with the committed files
 *
 * Without --offline, --source or --network the data step would examine
 * nothing, so the tool refuses (exit 2) instead of passing.
 *
 * Exit: 0 reproduced; 1 FAIL (a file differs, named); 2 refused; 3 this rig
 * cannot build (Python or a library missing); 4 a pinned URL did not answer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, STAMP, EXIT, abs, exists, sha256, sha256Of, readJson, sources, liveGeneration, tmpDir, arg, has, run, composition, reporter } from './lib.mjs';

// Default targets: the live generation, and the newest generation with pinned sources (a preview not yet live).
if (!arg('--generation')) {
  const targets = [...new Set([liveGeneration(), Object.keys(sources()).sort().at(-1)].filter(Boolean))];
  if (targets.length > 1) {
    let worst = 0;
    for (const g of targets) worst = Math.max(worst, run(['node', process.argv[1], ...process.argv.slice(2), '--generation', g], { stdio: 'inherit' }).code);
    process.exit(worst);
  }
}
const G = arg('--generation', liveGeneration());
const OFFLINE = has('--offline'), NETWORK = has('--network');
let SOURCE = arg('--source'), ORACLE = arg('--oracle');
const PYTHON = arg('--python', process.env.TWIN_PYTHON || 'python3');

if (!STAMP.test(G)) { console.error(`--generation must be YYYYMMDDHHMM, got ${G}`); process.exit(EXIT.REFUSED); }
if (!OFFLINE && !NETWORK && !SOURCE) {
  console.error('refused: no --source, --network or --offline, so the data files would not be examined. A check that examines nothing refuses; it does not pass.');
  process.exit(EXIT.REFUSED);
}
if (OFFLINE && (NETWORK || SOURCE)) { console.error('refused: --offline excludes --network and --source'); process.exit(EXIT.REFUSED); }

const R = reporter(`twin ${G}`);
const pin = sources()[G];
const work = tmpDir(`twin-${G}`);
const done = code => { if (has('--keep')) console.log(`kept ${work}`); else fs.rmSync(work, { recursive: true, force: true }); process.exit(code); };
const same = (name, rebuilt, committedRel) => {
  if (!exists(committedRel)) return R.fail(name, `${committedRel} is not in the repository`);
  const a = fs.readFileSync(rebuilt), b = fs.readFileSync(abs(committedRel));
  if (a.equals(b)) return R.pass(name, `${committedRel} ${b.length} B sha256 ${sha256(b)} rebuilt byte for byte`);
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  R.fail(name, `${committedRel} differs from its rebuild at byte ${i} (committed ${b.length} B ${sha256(b)}, rebuilt ${a.length} B ${sha256(a)})`);
};

console.log(`twin of generation ${G}; mode ${OFFLINE ? 'offline (no data rebuild)' : SOURCE ? 'local source' : 'network'}; work ${work}`);
if (!exists(`atlas/v/${G}/current.json`)) { R.fail('generation', `atlas/v/${G}/current.json missing`); done(R.finish()); }
const comp = composition(G);

// ------------------------------------------------------------------ 1 pins
let manifest = null;
if (!pin) {
  // A generation that cut no data (only cartridges) has no entry; one that did must have one.
  const owns = fs.readdirSync(abs('data')).filter(f => f.includes(`_${G}.`));
  if (owns.length) R.fail('pins', `data/ holds ${owns.join(', ')} but tools/twin/sources.json has no entry for ${G}`);
  else R.note('pins', `${G} cut no data files; cartridges only`);
} else {
  const bad = [];
  const compiler = fs.readFileSync(abs(pin.compiler), 'utf8');
  const constant = name => (compiler.match(new RegExp(`^${name} = "?([^"\\n]+)"?$`, 'm')) || [])[1];
  manifest = readJson(pin.data_manifest);
  if (constant('GENERATION') !== G) bad.push(`${pin.compiler} GENERATION is ${constant('GENERATION')}`);
  if (constant('SOURCE_SHA256') !== pin.source.sha256) bad.push(`${pin.compiler} SOURCE_SHA256 is not the pinned source`);
  if (Number(constant('SOURCE_BYTES')) !== pin.source.bytes) bad.push(`${pin.compiler} SOURCE_BYTES is not the pinned size`);
  if (constant('V8_SHA256') !== pin.oracle.sha256) bad.push(`${pin.compiler} V8_SHA256 is not the pinned oracle`);
  if (manifest.generation !== G) bad.push(`${pin.data_manifest} declares generation ${manifest.generation}`);
  if (manifest.source?.sha256 !== pin.source.sha256 || manifest.source?.bytes !== pin.source.bytes) bad.push(`${pin.data_manifest} source is not the pinned source`);
  if (manifest.v8_oracle?.sha256 !== pin.oracle.sha256) bad.push(`${pin.data_manifest} oracle is not the pinned oracle`);
  for (const k of ['source', 'oracle']) if (!/\/[0-9a-f]{40}\//.test(pin[k].url)) bad.push(`${k} URL does not name a commit`);
  if (bad.length) R.fail('pins', bad.join('; '));
  else R.pass('pins', `source ${pin.source.sha256} (${pin.source.bytes} B) and oracle ${pin.oracle.sha256.slice(0, 12)}… agree in sources.json, ${pin.compiler} and ${pin.data_manifest}`);
}

// ------------------------------------------------------------------ 2 coupling
const dataFiles = []; // [name written by the compiler, committed path]
if (manifest) {
  const bad = [];
  for (const k of ['parquet', 'browser_registry']) {
    const rel = `data/${manifest[k].path}`;
    dataFiles.push([manifest[k].path, rel]);
    if (!exists(rel)) { bad.push(`${rel} missing`); continue; }
    if (sha256Of(rel) !== manifest[k].sha256 || fs.statSync(abs(rel)).size !== manifest[k].bytes) bad.push(`${rel} is not the file ${pin.data_manifest} describes`);
  }
  dataFiles.push([path.basename(pin.data_manifest), pin.data_manifest]);
  // The generation's own cartridges read the data by URL and refuse it unless it hashes to these two values.
  const wanted = [sha256Of(pin.data_manifest), manifest.parquet.sha256];
  const own = comp.cartridges.filter(c => !c.missing && String(c.generation) === G);
  const carriers = own.filter(c => wanted.every(h => fs.readFileSync(abs(c.file), 'utf8').includes(h)));
  if (!carriers.length) bad.push(`no cartridge cut at ${G} carries the manifest and parquet hashes, so nothing ties the composition to these data files`);
  if (bad.length) R.fail('coupling', bad.join('; '));
  else R.pass('coupling', `committed parquet and registry are the files the manifest describes; ${carriers.map(c => c.id).join(', ')} pin manifest ${wanted[0].slice(0, 12)}… and parquet ${wanted[1].slice(0, 12)}…`);
}

// ------------------------------------------------------------------ 3 cartridges
const own = comp.cartridges.filter(c => !c.missing && String(c.generation) === G);
if (!own.length) R.note('cartridges', `the composition of ${G} cut no cartridge of its own`);
for (const c of own) {
  const name = `cartridge ${c.id}`;
  const overlay = c.file.match(/^atlas\/modules\/(\d{12})-uk-(lightning|offtakers)-overlay\.js$/);
  if (c.assembled_from) {
    // tools/build-cartridge.mjs writes beside itself and refuses an existing output, so it is run from a copy in an
    // empty tree that holds only the tool and the parts the manifest lists.
    const partsRel = path.posix.normalize(path.posix.join(`atlas/v/${G}`, c.assembled_from));
    const parts = readJson(partsRel);
    const tree = path.join(work, `assemble-${c.id}`);
    for (const d of ['tools', 'atlas/cartridges', 'atlas/manifests']) fs.mkdirSync(path.join(tree, d), { recursive: true });
    fs.copyFileSync(abs('tools/build-cartridge.mjs'), path.join(tree, 'tools', 'build-cartridge.mjs'));
    const argv = ['node', path.join(tree, 'tools', 'build-cartridge.mjs'), '--generation', String(parts.generation),
      '--name', path.basename(parts.cartridge, '.js').slice(13)];
    const flag = { carried_shell_script: '--carry', module: '--module', part: '--part' };
    for (const p of parts.assembled_from) {
      fs.mkdirSync(path.dirname(path.join(tree, p.path)), { recursive: true });
      fs.copyFileSync(abs(p.path), path.join(tree, p.path));
      argv.push(flag[p.role], p.path);
    }
    const r = run(argv, { cwd: tree });
    const out = path.join(tree, 'atlas', path.normalize(parts.cartridge));
    if (r.code !== 0 || !fs.existsSync(out)) { R.fail(name, `tools/build-cartridge.mjs exit ${r.code}: ${(r.stderr || r.stdout).trim().slice(0, 200)}`); continue; }
    same(name, out, c.file);
    if (sha256(fs.readFileSync(out)) !== c.sha256) R.fail(`${name} pin`, `rebuilt ${c.file} is not the sha256 atlas/v/${G}/current.json pins`);
    same(`${name} parts manifest`, path.join(tree, partsRel), partsRel);
  } else if (overlay) {
    const kind = overlay[2], gens = readJson(`tools/${kind}/generations.json`), entry = gens.generations[overlay[1]];
    if (!entry) { R.fail(name, `${overlay[1]} is not listed in tools/${kind}/generations.json`); continue; }
    if (entry.historical) { R.note(name, `historical: built from ${entry.historical}; the current source no longer rebuilds it, so it is held by its hash only (tools/twin/preserve.mjs)`); continue; }
    const out = path.join(work, path.basename(c.file));
    const argv = ['node', `tools/${kind}/build.mjs`, '--gen', overlay[1], '--out', out];
    if (entry.variant) argv.push('--variant', entry.variant);
    const r = run(argv);
    if (r.code !== 0 || !fs.existsSync(out)) { R.fail(name, `tools/${kind}/build.mjs exit ${r.code}: ${(r.stderr || r.stdout).trim().slice(0, 200)}`); continue; }
    same(name, out, c.file);
    if (sha256(fs.readFileSync(out)) !== c.sha256) R.fail(`${name} pin`, `rebuilt ${c.file} is not the sha256 atlas/v/${G}/current.json pins`);
  } else if (c.id === 'substation-intelligence' && exists('tools/pipeline-lifecycle/generations.json') && readJson('tools/pipeline-lifecycle/generations.json').generations[G]) {
    const entry = readJson('tools/pipeline-lifecycle/generations.json').generations[G];
    const tree = path.join(work, 'pipeline-lifecycle-source');
    for (const rel of ['tools/pipeline-lifecycle/build.mjs', 'tools/pipeline-lifecycle/generations.json', entry.base.path, entry.edits]) {
      const to = path.join(tree, rel); fs.mkdirSync(path.dirname(to), {recursive: true}); fs.copyFileSync(abs(rel), to);
    }
    const out = path.join(work, path.basename(c.file));
    const r = run(['node', path.join(tree, 'tools/pipeline-lifecycle/build.mjs'), '--gen', G, '--out', out]);
    if (r.code !== 0 || !fs.existsSync(out)) { R.fail(name, 'Pipeline lifecycle source rebuild failed: ' + (r.stderr || r.stdout).trim().slice(0, 200)); continue; }
    same(name, out, c.file);
    if (sha256(fs.readFileSync(out)) !== c.sha256) R.fail(name + ' pin', 'Rebuilt substation differs from composition pin');
  } else if (c.id === 'sld-sandbox' && exists('tools/sld/generations.json') && readJson('tools/sld/generations.json').generations[G]) {
    // Only pinned source inputs enter this empty tree. The expected final cartridge is absent.
    const entry = readJson('tools/sld/generations.json').generations[G];
    const tree = path.join(work, 'sld-source');
    for (const rel of ['tools/sld/build.mjs', 'tools/sld/generations.json', entry.base.path, entry.owner.path, entry.edits]) {
      const to = path.join(tree, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(abs(rel), to);
    }
    const out = path.join(work, path.basename(c.file));
    const r = run(['node', path.join(tree, 'tools/sld/build.mjs'), '--gen', G, '--out', out]);
    if (r.code !== 0 || !fs.existsSync(out)) { R.fail(name, 'SLD source rebuild failed: ' + (r.stderr || r.stdout).trim().slice(0, 200)); continue; }
    same(name, out, c.file);
    if (sha256(fs.readFileSync(out)) !== c.sha256) R.fail(name + ' pin', 'rebuilt SLD differs from the composition pin');
  } else if (['grid-journey-preview', 'grid-vicinity'].includes(c.id)) {
    // Rebuild source-owned explorer modules in an empty tree. No expected output enters it.
    const kind = c.id === 'grid-journey-preview' ? 'journey' : 'vicinity';
    const tree = path.join(work, `${kind}-source`), rel = `tools/${kind}`;
    fs.mkdirSync(path.join(tree, 'tools'), {recursive: true});
    fs.cpSync(abs(rel), path.join(tree, rel), {recursive: true});
    const out = path.join(work, path.basename(c.file));
    const entry = kind === 'journey' ? 'build-module.mjs' : 'build.mjs';
    const r = run(['node', path.join(tree, rel, entry), '--generation', G, '--out', out]);
    if (r.code !== 0 || !fs.existsSync(out)) { R.fail(name, `${kind} source rebuild failed: ${(r.stderr || r.stdout).trim().slice(0, 200)}`); continue; }
    same(name, out, c.file);
    if (sha256(fs.readFileSync(out)) !== c.sha256) R.fail(`${name} pin`, 'Rebuilt explorer module differs from the composition pin');
  } else {
    R.fail(name, `${c.file} was cut at ${G} but no builder is known for it (not assembled_from, not an overlay module); the twin cannot rebuild it`);
  }
}

// ------------------------------------------------------------------ the offline phase ends here
if (!manifest) done(R.finish());
if (OFFLINE) {
  R.note('data', `NOT RUN in the offline phase: ${dataFiles.map(d => d[1]).join(', ')} are rebuilt only with --source or --network`);
  done(R.finish('data rebuild not run'));
}
if (R.failed().length) {
  R.note('data', 'NOT RUN: an offline step is red, so neither the source nor the network is touched');
  done(R.finish('stopped before the source'));
}

// ------------------------------------------------------------------ 4 source
function fetchPinned(what, to) {
  // curl, because it honours the runner's and a sandbox's proxy settings; Node's fetch does not everywhere.
  const r = run(['curl', '-fsSL', '--retry', '2', '--max-time', '120', '-o', to, pin[what].url]);
  if (r.code !== 0) { console.error(`BLOCKED_DEPENDENCY ${what}: ${pin[what].url} did not answer (curl exit ${r.code}: ${r.stderr.trim().slice(0, 160)})`); done(EXIT.BLOCKED_DEPENDENCY); }
  return to;
}
const inputs = {};
for (const [what, given] of [['source', SOURCE], ['oracle', ORACLE]]) {
  let file;
  if (given) file = path.resolve(given);
  else if (NETWORK) file = fetchPinned(what, path.join(work, pin[what].name));
  else { R.fail(what, `--${what} PATH is required with --source (or use --network): the compiler needs ${pin[what].name}`); continue; }
  if (!fs.existsSync(file)) { R.fail(what, `${file} does not exist`); continue; }
  const got = sha256Of(file), size = fs.statSync(file).size;
  if (got !== pin[what].sha256 || size !== pin[what].bytes) { R.fail(what, `${given ? file : pin[what].url} is ${size} B sha256 ${got}; the pin is ${pin[what].bytes} B ${pin[what].sha256}. Not used.`); continue; }
  inputs[what] = file;
  R.pass(what, `${given ? `local ${path.basename(file)}` : pin[what].url} is the pinned ${pin[what].bytes} B sha256 ${got}`);
}
if (R.failed().length) done(R.finish('stopped before the build'));

// ------------------------------------------------------------------ 5 data
const probe = run([PYTHON, '-c', 'import duckdb, pyproj; print(duckdb.__version__, pyproj.__version__)']);
if (probe.code !== 0) {
  console.error(`BLOCKED_HARNESS: ${PYTHON} cannot import duckdb and pyproj (pip install -r requirements.lock): ${probe.stderr.trim().split('\n').pop()}`);
  done(EXIT.BLOCKED_HARNESS);
}
const [duck, proj] = probe.stdout.trim().split(' ');
const lock = Object.fromEntries(fs.readFileSync(abs('requirements.lock'), 'utf8').split('\n').filter(l => l.includes('==')).map(l => l.trim().split('==')));
const offLock = duck !== lock.duckdb || proj !== lock.pyproj || duck !== manifest.runtime.duckdb;
console.log(`runtime: duckdb ${duck}, pyproj ${proj} (requirements.lock: ${lock.duckdb}, ${lock.pyproj}; the committed manifest was built with duckdb ${manifest.runtime.duckdb})`);

const builds = [];
for (const side of ['a', 'b']) {
  const out = path.join(work, `build-${side}`);
  fs.mkdirSync(out);
  // cwd is the empty build directory: the compiler reads only its two inputs and writes only into --output.
  const r = run([PYTHON, abs(pin.compiler), '--source', inputs.source, '--v8', inputs.oracle, '--output', out], { cwd: out });
  if (r.code !== 0) { R.fail(`compile ${side}`, `${pin.compiler} exit ${r.code}: ${r.stderr.trim().split('\n').pop().slice(0, 240)}`); break; }
  builds.push(out);
  console.log(`build ${side}: ${r.stdout.trim()}`);
}
if (builds.length === 2) {
  const extra = fs.readdirSync(builds[0]).filter(f => !dataFiles.some(d => d[0] === f));
  if (extra.length) R.fail('data closure', `the compiler wrote ${extra.join(', ')}, which the manifest does not list`);
  let stable = true;
  for (const [name] of dataFiles) {
    const a = path.join(builds[0], name), b = path.join(builds[1], name);
    if (!fs.existsSync(a) || !fs.existsSync(b) || !fs.readFileSync(a).equals(fs.readFileSync(b))) { stable = false; R.fail(`deterministic ${name}`, 'two builds from the same source on this machine differ, so no rebuild can be compared with the committed file'); }
  }
  if (stable) {
    R.pass('deterministic', `two builds agree on ${dataFiles.length} files`);
    for (const [name, rel] of dataFiles) same(`data ${name}`, path.join(builds[0], name), rel);
  }
}
if (R.failed().length && offLock) {
  R.finish();
  console.error(`BLOCKED_HARNESS: this rig's duckdb ${duck} / pyproj ${proj} are not the locked versions, and Parquet bytes depend on the writer; install requirements.lock and run again before reading the failures above as a fault in the generation`);
  done(EXIT.BLOCKED_HARNESS);
}
done(R.finish());
