#!/usr/bin/env node
/**
 * run-baseline.mjs — run the whole GridAtlas proof estate against ONE served
 * composition, with a hard per-proof timeout, and write a classified table.
 *
 * Written by atlas-regression-auditor so another agent can re-run the identical
 * catalogue against the CANDIDATE and diff the two tables.
 *
 *   node run-baseline.mjs --repo /home/claude/gridatlas \
 *        --base http://127.0.0.1:8107/gridatlas/atlas/ \
 *        --out  <evidence>/baseline-run [--group static|browser|live|python|all]
 *        [--only id1,id2] [--skip id1,id2] [--concurrency 2] [--live https://ventusltd.github.io/gridatlas/atlas/]
 *        [--label baseline] [--sld-original /home/claude/ventusltd/globalgrid2050/solar-bess-topology-v7/gis-sld-financial-sandbox]
 *
 * Classification (per the swarm brief):
 *   PASS                exit 0 inside the budget
 *   FAIL                non-zero exit that is the product's own doing
 *   BLOCKED_HARNESS     test tooling: missing browser engine, missing sibling checkout,
 *                       missing python module, a proof pinned to a superseded generation,
 *                       no PowerShell, 1.62/1.63 Playwright drift
 *   BLOCKED_DEPENDENCY  an external host the proof or the page needs is unreachable
 *                       (the runner probes the served route first; when the route cannot
 *                       even boot MapLibre, every route-dependent proof is BLOCKED_DEPENDENCY,
 *                       and the raw error is still recorded beside the classification)
 *
 * Nothing here edits the repository. Proof outputs are redirected into --out wherever
 * a proof accepts a flag; the two proofs that hard-code <repo>/work/ (gitignored) are
 * copied out afterwards.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const REPO = path.resolve(arg('--repo', '/home/claude/gridatlas'));
const BASE = arg('--base', 'http://127.0.0.1:8107/gridatlas/atlas/');
const LIVE = arg('--live', 'https://ventusltd.github.io/gridatlas/atlas/');
const OUT = path.resolve(arg('--out', path.join(HERE, 'baseline-run')));
const GROUP = arg('--group', 'all');
const ONLY = arg('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const SKIP = arg('--skip', '').split(',').map(s => s.trim()).filter(Boolean);
const CONCURRENCY = Number(arg('--concurrency', '2'));
const LABEL = arg('--label', 'baseline');
// regression-challenge-C chunking: --chunk-tag names the results file; --layer-ids restricts all-layer-clicks-* to a subset (passed as the proof's own --ids)
const CHUNK = arg('--chunk-tag', '');
const LAYER_IDS = arg('--layer-ids', '');
const LAYER_TIMEOUT = Number(arg('--layer-timeout-ms', '1150000'));
const SHIM = process.argv.includes('--shim');
const SHIM_PRELOAD = path.join(HERE, 'shim-preload.cjs');
const LIGHTNING_DIR = arg('--lightning-data-dir', '');
const SLD_ORIGINAL = arg('--sld-original', '/home/claude/ventusltd/globalgrid2050/solar-bess-topology-v7/gis-sld-financial-sandbox');
fs.mkdirSync(OUT, { recursive: true });

const current = JSON.parse(fs.readFileSync(path.join(REPO, 'atlas', 'current.json'), 'utf8'));
const GENERATION = current.generation;
const P = (...p) => path.join(REPO, 'tools', 'proofs', ...p);
const node = process.execPath;

/* ------------------------------------------------------------------------ */
/* 1. Probe the served route once, so route-dependent failures can be        */
/*    attributed to the environment rather than to the product.              */
/* ------------------------------------------------------------------------ */
async function probeRoute(url, label) {
  const probeOut = path.join(OUT, `probe-${label}`);
  const r = await run({ id: `probe-${label}`, group: 'browser', cmd: [node, path.join(HERE, 'probe-route.mjs'), url, probeOut, '--width', '1440', '--height', '1000', '--wait-ms', '60000'], timeoutMs: 150000, cwd: REPO, env: {} });
  let probe = null;
  try { probe = JSON.parse(fs.readFileSync(path.join(probeOut, 'probe-1440x1000.json'), 'utf8')); } catch { }
  return { ...r, probe };
}

/* ------------------------------------------------------------------------ */
/* 2. The catalogue. Every proof in tools/proofs, tools/proofs/modules, the   */
/*    scope tool, the python census and the PowerShell orchestrator.          */
/* ------------------------------------------------------------------------ */
function catalogue() {
  const list = [];
  const add = (o) => list.push({ cwd: REPO, env: {}, timeoutMs: 120000, ...o });
  const liveBase = LIVE;

  // --- scope tool (static) ---------------------------------------------------
  add({ id: 'scope-lint', group: 'static', kind: 'static', tests: 'repository lint: compositions, manifests, workflow budget, STATE.md', target: 'files', deps: [], cmd: [node, 'tools/scope/loop.mjs', 'lint'], knownPreexisting: /active workflow budget mismatch/ });
  add({ id: 'scope-state-stdout', group: 'static', kind: 'static', tests: 'regenerates STATE.md to stdout (must equal STATE.md)', target: 'files', deps: [], cmd: [node, 'tools/scope/loop.mjs', 'state', '--stdout'], knownPreexisting: /active workflow budget mismatch/ });
  add({ id: 'scope-verify-compose', group: 'static', kind: 'static', tests: 'composer verification of atlas/current.json against manifests and cartridge hashes', target: 'files', deps: [], cmd: [node, 'tools/scope/verify-compose.mjs'] });

  // --- generation-matched cartridge proofs (static) ---------------------------
  add({ id: 'run-current', group: 'static', kind: 'static', tests: 'runs the proof whose stamp matches each composed cartridge (4 cartridges)', target: 'files', deps: [], cmd: [node, 'tools/proofs/run-current.mjs'], timeoutMs: 300000 });
  add({ id: 'bridge-202609241251', group: 'static', kind: 'static', tests: 'streaming-parquet-bridge: contract vs runtime, fetch patching, legacyStem() routing, hashes (hard-codes live hrefs for window.location only)', target: 'files (window.location stubbed to live href)', deps: [], cmd: [node, 'tools/proofs/202609241251-streaming-parquet-bridge.proof.mjs'] });
  add({ id: 'gazetteer-202609071213', group: 'static', kind: 'static', tests: 'uk-gazetteer-flyto: contract vs runtime, deep-link publishing, generation stamps', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609071213-uk-gazetteer-flyto.proof.mjs'] });
  add({ id: 'engine-202609062358', group: 'static', kind: 'static', tests: 'substation-intelligence: byte integrity vs 202609200022 manifest, syntax, initVentusMap present', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609062358-substation-intelligence.proof.mjs'] });
  add({ id: 'sld-202609241334', group: 'static', kind: 'static', tests: 'sld-sandbox: exact delta vs 202609200022 cartridge (5 card-boundary replacements + popup-viewport module), sha256, syntax', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609241334-sld-sandbox.proof.mjs'] });

  // --- composed-bytes static proofs (unpinned) --------------------------------
  add({ id: 'v8-layers-panel-restored', group: 'static', kind: 'static', tests: 'v8 Layers panel shown beneath the six menus; dash toggle; collapsed-on-phone default; localStorage choice', target: 'files (composed cartridges)', deps: [], cmd: [node, 'tools/proofs/v8-layers-panel-restored.proof.mjs'] });
  add({ id: 'menu-bar-dom', group: 'static', kind: 'static', tests: 'menu-bar module DOM contract in a vm (60+3 fail-closed, proxies, brand slot)', target: 'files (atlas/modules)', deps: [], cmd: [node, 'tools/proofs/menu-bar-dom.proof.mjs'] });
  add({ id: 'about-estate-and-attribution', group: 'static', kind: 'static', tests: 'About panel carries attribution + estate links (composed bytes)', target: 'files', deps: [], cmd: [node, 'tools/proofs/about-estate-and-attribution.proof.mjs'] });
  add({ id: 'arrival-visibility-and-one-runtime', group: 'static', kind: 'static', tests: 'visibility-gated arrival + single runtime, asserted on composed bytes', target: 'files', deps: [], cmd: [node, 'tools/proofs/arrival-visibility-and-one-runtime.proof.mjs'] });
  add({ id: 'parts-integrity-202609012105', group: 'static', kind: 'static', tests: 'assembled cartridges still hash to their parts manifests', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609012105-parts-integrity.proof.mjs'] });
  add({ id: 'all-versions-202609012150', group: 'static', kind: 'static', tests: 'one Earth radius across every shipped version; module parity vs every cartridge', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609012150-all-versions.proof.mjs'], timeoutMs: 300000 });
  add({ id: 'data-contract-parity-202609012214', group: 'static', kind: 'static', tests: 'every product URL the bytes fetch is declared in current.json with the same schema', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609012214-data-contract-parity.proof.mjs'] });
  add({ id: 'estate-deep-scan-202609012240', group: 'static', kind: 'static', tests: 'run-current.mjs derives proof names from generation+id; every current cartridge has a matched proof', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609012240-estate-deep-scan.proof.mjs'] });
  add({ id: 'quantumspawn-recovery-202609012305', group: 'static', kind: 'static', tests: 'recovery capsule claims re-derived from git (read-only git calls)', target: 'files + git', deps: ['git'], cmd: [node, 'tools/proofs/202609012305-quantumspawn-recovery.proof.mjs'] });
  add({ id: 'sld-styles-202609040400', group: 'static', kind: 'static', tests: 'seven hoisted CSS values unchanged between sld-sandbox and substation-intelligence; size ceilings', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609040400-sld-styles.proof.mjs'] });
  add({ id: 'arrival-identity-corpus-202609040229', group: 'static', kind: 'static', tests: 'exact Pipeline 0144 corpus hashes against a sibling pipelinenews checkout', target: 'files + sibling repo ../pipelinenews', deps: ['sibling checkout Ventusltd/pipelinenews'], cmd: [node, 'tools/proofs/202609040229-arrival-identity-corpus.proof.mjs'] });
  add({ id: 'transit-layer-availability-202609040212', group: 'static', kind: 'static-network', tests: 'published transit partitions exist and hash at the data-gridatlas owner generation', target: 'https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/', deps: ['ventusltd.github.io'], cmd: [node, 'tools/proofs/202609040212-transit-layer-availability.proof.mjs'], env: { NODE_USE_ENV_PROXY: '1' } });
  add({ id: 'mobile-static-audit-202609010030', group: 'static', kind: 'static', tests: 'static mobile gate over composed sld cartridge + shell css + shell html', target: 'files', deps: [], cmd: [node, 'tools/proofs/202609010030-mobile-static.audit.mjs', 'atlas/cartridges/202609241334-sld-sandbox-v9-8.js', 'atlas/releases/202608300453-atlas-v9/ventusv8.css', 'atlas/releases/202608300453-atlas-v9/index.html'] });
  add({ id: 'sld-finance-fixture-202609010002', group: 'static', kind: 'static', tests: 'executes the original GlobalGrid2050 SLD finance modules and checks the committed oracle fixture', target: 'files + GlobalGrid2050 clone', deps: ['globalgrid2050 clone'], cmd: [node, 'tools/proofs/202609010002-original-sld-finance-fixture.mjs', '--original', SLD_ORIGINAL, '--check', 'tools/proofs/fixtures/202609010002-original-sld-finance.json'] });
  add({ id: 'prepare-layer-census', group: 'static', kind: 'static', tests: 'captures the 60 real shell layer definitions from ukConfig into work/layer-config.json (gitignored)', target: 'files', deps: [], cmd: [node, 'tools/proofs/prepare-layer-census.mjs'] });
  for (const f of fs.readdirSync(P('modules')).filter(f => f.endsWith('.proof.mjs')).sort()) {
    add({ id: 'modules-' + f.replace('.proof.mjs', ''), group: 'static', kind: 'static', tests: 'module-level proof: ' + f, target: 'files (atlas/modules, atlas/parts)' + (/network-topology/.test(f) ? ' + raw.githubusercontent.com product' : ''), deps: /network-topology/.test(f) ? ['raw.githubusercontent.com'] : [], cmd: [node, 'tools/proofs/modules/' + f], env: { NODE_USE_ENV_PROXY: '1' } });
  }

  // --- historical, generation-pinned static proofs ---------------------------
  const pinned = [
    ['202608311910-neon-substation-links.proof.mjs', '202608311910', ['sibling checkout ../grid-distance-maths']],
    ['202609011141-uk-gazetteer-flyto.proof.mjs', '202609011141', []],
    ['202609040134-sld-sandbox.proof.mjs', '202609040134', []],
    ['202609040134-substation-intelligence.proof.mjs', '202609040134', []],
    ['202609040219-sld-sandbox.proof.mjs', '202609040219', []],
    ['202609040219-substation-intelligence.proof.mjs', '202609040219', []],
    ['202609040337-sld-sandbox.proof.mjs', '202609040337', []],
    ['202609040337-substation-intelligence.proof.mjs', '202609040337', []],
    ['202609041244-substation-intelligence.proof.mjs', '202609041244', []],
    ['202609041945-streaming-parquet-bridge.proof.mjs', '202609041945', []],
    ['202609041945-uk-gazetteer-flyto.proof.mjs', '202609041945', []],
    ['202609051522-sld-sandbox.proof.mjs', '202609051522', []],
    ['202609051529-substation-intelligence.proof.mjs', '202609051529', []],
    ['202609051540-sld-sandbox.proof.mjs', '202609051540', []],
    ['202609051624-substation-intelligence.proof.mjs', '202609051624', []],
    ['202609241251-sld-sandbox.proof.mjs', '202609241251', []]
  ];
  for (const [f, gen, deps] of pinned) {
    add({ id: 'historical-' + f.replace('.proof.mjs', ''), group: 'historical', kind: 'static', pinnedGeneration: gen, tests: 'superseded-generation proof kept in tree (pinned to ' + gen + ')', target: 'files', deps, cmd: [node, 'tools/proofs/' + f], timeoutMs: 300000 });
  }

  // --- browser proofs on a synthetic fixture (no route) -----------------------
  add({ id: 'menu-bar-mobile-hit', group: 'browser', kind: 'browser-fixture', tests: 'fixture DOM at 393x852: Grid proxy wins the hit test over a project sheet; fullscreen keeps the six menus; no page errors', target: 'fixture DOM + atlas/modules/202609031958-menu-bar.js + production fullscreen handler', deps: ['chromium'], cmd: [node, 'tools/proofs/menu-bar-mobile-hit.browser.mjs'] });
  add({ id: 'menu-bar-attrib-clearance', group: 'browser', kind: 'browser-fixture', tests: 'fixture DOM at 393/456/768/1280/2327: attribution never occluded by the menu bar', target: 'fixture DOM + menu-bar module', deps: ['chromium'], cmd: [node, 'tools/proofs/menu-bar-attrib-clearance.browser.mjs'] });
  add({ id: 'menu-bar-instrument-panel-202609041250', group: 'browser', kind: 'browser-fixture', tests: 'fixture DOM: masthead survives install, SCADA panel controls >=44px, panels inside viewport at 393/456/1280/1568, attribution clear under every open menu', target: 'fixture DOM + menu-bar module', deps: ['chromium'], cmd: [node, 'tools/proofs/202609041250-menu-bar-instrument-panel.browser.mjs'] });

  // --- browser proofs that accept a base URL -> served route under test --------
  const route = (o) => add({ group: 'browser', kind: 'browser-route', routeDependent: true, deps: ['chromium', 'cdn.jsdelivr.net (maplibre-gl 3.6.2)', 'ventusltd.github.io/data-gridatlas partitions', 'basemaps.cartocdn.com'], ...o });
  route({ id: 'all-controls-desktop', tests: 'menus x6, status/radius/area/zone/measure tools, fullscreen, basemaps, CSV export, GB conditions + version ledger, Layers toggle, image/pdf/print export, solar CSV, search London, deep link, Pipeline same/wider/all, card min/restore/close (1440x1000)', target: BASE, extraDeps: ['api.postcodes.io / nominatim for search'], cmd: [node, 'tools/proofs/all-controls.browser.mjs', '--url', BASE, '--desktop', '--out', path.join(OUT, 'all-controls-desktop')], timeoutMs: 420000 });
  route({ id: 'all-controls-mobile', tests: 'same 26 checks at 393x852 Android touch emulation', target: BASE, cmd: [node, 'tools/proofs/all-controls.browser.mjs', '--url', BASE, '--mobile', '--out', path.join(OUT, 'all-controls-mobile')], timeoutMs: 420000 });
  route({ ...(LAYER_IDS ? {} : {}), id: 'all-layer-clicks-1440' + (LAYER_IDS ? '-' + CHUNK : ''), tests: 'every one of the 60 Grid controls: paints, picks a feature, card closes inside viewport, switches off (1440)', target: BASE, cmd: [node, 'tools/proofs/all-layer-clicks.browser.mjs', '--url', BASE, '--width', '1440', '--out', path.join(OUT, 'all-layer-clicks-1440' + (LAYER_IDS ? '-' + CHUNK : '')), ...(LAYER_IDS ? ['--ids', LAYER_IDS] : [])], timeoutMs: LAYER_IDS ? LAYER_TIMEOUT : (SHIM ? 3300000 : 1500000) });
  route({ ...(LAYER_IDS ? {} : {}), id: 'all-layer-clicks-393' + (LAYER_IDS ? '-' + CHUNK : ''), tests: 'same 60 controls at 393 touch', target: BASE, cmd: [node, 'tools/proofs/all-layer-clicks.browser.mjs', '--url', BASE, '--width', '393', '--out', path.join(OUT, 'all-layer-clicks-393' + (LAYER_IDS ? '-' + CHUNK : '')), ...(LAYER_IDS ? ['--ids', LAYER_IDS] : [])], timeoutMs: LAYER_IDS ? LAYER_TIMEOUT : (SHIM ? 3300000 : 1500000) });
  route({ id: 'grid-subs-chips-on-desktop', tests: 'GRID and SUBS chips are on the map (not only in a menu) at 1400x900, 2327x1156 and 393x852', target: BASE, cmd: [node, 'tools/proofs/grid-subs-chips-on-desktop.browser.mjs', BASE], timeoutMs: 360000 });
  route({ id: 'pdf-export-outcomes-202609051329', tests: 'Save as PDF produces a real PDF with a JPEG map and page aspect == image aspect, on chromium + firefox + webkit', target: BASE, extraDeps: ['firefox', 'webkit'], cmd: [node, 'tools/proofs/202609051329-pdf-export-outcomes.browser.mjs', BASE], timeoutMs: 420000 });
  route({ id: 'screen-grab-print-outcomes', tests: 'under print media the layer controls, menu bar and attribution keep boxes; page box = viewport width; raster inside canvas box', target: BASE, cmd: [node, 'tools/proofs/screen-grab-print-outcomes.browser.mjs', BASE], timeoutMs: 360000 });
  route({ id: 'teleprint-evidence', tests: 'fresh Chrome per session pressing Print source code / Print PDF via the File menu (bounded to 2 sessions here; CI asks 50)', target: BASE, cmd: [node, 'tools/proofs/teleprint-evidence.browser.mjs', BASE, path.join(OUT, 'teleprint-evidence'), '--sessions', '2'], timeoutMs: 420000 });

  // --- browser proofs that serve the repo root themselves at /atlas/ ----------
  const self = (o) => add({ group: 'browser', kind: 'browser-self-served', routeDependent: true, target: 'self-served http://127.0.0.1:<random>/atlas/ (same bytes as ' + BASE + ', route prefix differs)', deps: ['chromium', 'cdn.jsdelivr.net (maplibre-gl 3.6.2)', 'ventusltd.github.io/data-gridatlas partitions'], ...o });
  self({ id: 'deep-link-visibility', tests: 'hidden-tab deep link defers the arrival, then flies, draws links and opens the card once visible (chromium only here; webkit missing)', env: { GRIDATLAS_BROWSER_ENGINE: 'chromium' }, cmd: [node, 'tools/proofs/deep-link-visibility.browser.mjs'], timeoutMs: 420000 });
  self({ id: 'deep-link-technology-buckets', tests: '13 Pipeline technology buckets arrive with the project layer lit (bounded to width 393, bucket solar here)', env: { GRIDATLAS_BROWSER_WIDTH: '393', GRIDATLAS_BROWSER_BUCKET: 'solar' }, cmd: [node, 'tools/proofs/deep-link-technology-buckets.browser.mjs'], timeoutMs: 420000 });
  self({ id: 'export-print-and-image-outcomes', tests: 'print emulation keeps the canvas height, printToPDF carries the map raster, Save an image downloads a real PNG, generation stamp equals composition', env: {}, cmd: [node, 'tools/proofs/export-print-and-image-outcomes.browser.mjs', '--route', '/atlas/', '--receipt', path.join(OUT, 'export-print-receipt.json')], timeoutMs: 420000 });
  self({ id: 'repd-deep-link-sweep', tests: 'REPD corpus deep links through the real arrival path (bounded to 2 cases here)', env: {}, cmd: [node, 'tools/proofs/repd-deep-link-sweep.browser.mjs', '--cases', '2'], timeoutMs: 420000 });
  self({ id: 'arrival-engine-sweep-202609072356', tests: 'arrival_engine sentinel answered/declined/silent per technology (bounded to 1 per tech, 20 s)', env: {}, cmd: [node, 'tools/proofs/202609072356-arrival-engine-sweep.browser.mjs', '--per-tech', '1', '--timeout', '20000', '--json', path.join(OUT, 'arrival-engine-sweep.json')], timeoutMs: 900000 });
  self({ id: 'arrival-identity-202609040229', tests: 'five cold mobile arrivals by repd_ref with manifest retry (routes the live repd manifest URL)', env: {}, extraDeps: ['ventusltd.github.io/gridatlas/data manifest'], cmd: [node, 'tools/proofs/202609040229-arrival-identity.browser.mjs'], timeoutMs: 900000 });
  self({ id: 'transit-layer-availability-202609040219', tests: 'metro/tram partition availability on a Markinch arrival (pinned to generation 202609040219)', pinnedGeneration: '202609040219', env: {}, cmd: [node, 'tools/proofs/202609040219-transit-layer-availability.browser.mjs'], timeoutMs: 420000 });
  self({ id: 'uk-lightning-preview', tests: 'REJECTED preview V5 vs restored baseline: layer-id sets, menu heading/id inventories, 60+3 contract, lightning toggle sync across Grid menu / #scada-ui-container / #fs-curtain-keys, fixture-fed hydration (desktop + mobile)', env: {}, cmd: [node, 'tools/proofs/uk-lightning-preview.browser.mjs'], timeoutMs: 600000, copyAfter: [path.join(REPO, 'work', 'uk-lightning-preview')] });

  // --- the same route proofs pointed at the LIVE site --------------------------
  const live = (o) => add({ group: 'live', kind: 'browser-live', routeDependent: false, liveDependent: true, target: liveBase, deps: ['chromium', 'ventusltd.github.io', 'cdn.jsdelivr.net', 'basemaps.cartocdn.com'], ...o });
  live({ id: 'live-grid-subs-chips', tests: 'GRID/SUBS chips on the live site', cmd: [node, 'tools/proofs/grid-subs-chips-on-desktop.browser.mjs', liveBase], timeoutMs: 360000 });
  live({ id: 'live-all-controls-desktop', tests: 'all-controls desktop profile on the live site', cmd: [node, 'tools/proofs/all-controls.browser.mjs', '--url', liveBase, '--desktop', '--out', path.join(OUT, 'live-all-controls-desktop')], timeoutMs: 420000 });
  live({ id: 'live-screen-grab-print', tests: 'print-media layout on the live site', cmd: [node, 'tools/proofs/screen-grab-print-outcomes.browser.mjs', liveBase], timeoutMs: 360000 });

  // --- python census ------------------------------------------------------------
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gridatlas-no-corpus-'));
  add({ id: 'layer-census-cpu', group: 'python', kind: 'python', tests: 'CPU census of the real published partition corpus against the 60 layer filters', target: '--data-root <local copy of data-gridatlas partitions>', deps: ['python3 pyarrow', 'data-gridatlas corpus (served from ventusltd.github.io)'], cmd: ['python3', 'tools/proofs/layer-census.py', '--data-root', emptyRoot, '--config', 'work/layer-config.json', '--out', path.join(OUT, 'layer-census')] });
  add({ id: 'layer-census-gpu', group: 'python', kind: 'python', tests: 'CuPy GPU parity over the CPU census', target: '--input <census dir>', deps: ['python3 cupy', 'NVIDIA GPU'], cmd: ['python3', 'tools/proofs/layer-census-gpu.py', '--input', path.join(OUT, 'layer-census')] });
  add({ id: 'verify-layers-local-ps1', group: 'python', kind: 'powershell', tests: 'Windows orchestrator: verify-compose, run-current, census CPU+GPU, all-layer-clicks 1440/393, all-controls, lint', target: 'orchestrates the above', deps: ['pwsh/PowerShell', 'CuPy GPU python'], cmd: ['pwsh', '-File', 'tools/proofs/verify-layers-local.ps1', '-DataRoot', emptyRoot, '-GpuPython', 'python3'] });

  return list;
}

/* ------------------------------------------------------------------------ */
/* 3. Execution with a process-group kill on timeout.                        */
/* ------------------------------------------------------------------------ */
function run(entry) {
  return new Promise((resolve) => {
    const dir = path.join(OUT, 'logs', entry.id);
    fs.mkdirSync(dir, { recursive: true });
    const stdout = fs.createWriteStream(path.join(dir, 'stdout.log'));
    const stderr = fs.createWriteStream(path.join(dir, 'stderr.log'));
    const started = Date.now();
    let child;
    try {
      const shimEnv = (SHIM && entry.group !== 'static' && entry.group !== 'historical' && entry.group !== 'python') ? { NODE_OPTIONS: `--require ${SHIM_PRELOAD}`, GRIDATLAS_SHIM_LOG: path.join(dir, 'shim.jsonl'), ...(LIGHTNING_DIR ? { GRIDATLAS_LIGHTNING_DATA_DIR: LIGHTNING_DIR } : {}) } : {};
      child = spawn(entry.cmd[0], entry.cmd.slice(1), { cwd: entry.cwd, env: { ...process.env, ...entry.env, ...shimEnv }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      resolve({ exit: null, signal: null, timedOut: false, spawnError: String(error), durationMs: 0, dir });
      return;
    }
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { } }, entry.timeoutMs);
    let outTail = '', errTail = '', outHead = '', errHead = '';
    child.stdout.on('data', d => { stdout.write(d); if (outHead.length < 20000) outHead += d; outTail = (outTail + d).slice(-20000); });
    child.stderr.on('data', d => { stderr.write(d); if (errHead.length < 20000) errHead += d; errTail = (errTail + d).slice(-20000); });
    child.on('error', (error) => { clearTimeout(timer); resolve({ exit: null, signal: null, timedOut, spawnError: String(error), durationMs: Date.now() - started, dir, outTail, errTail }); });
    child.on('close', (code, signal) => { clearTimeout(timer); stdout.end(); stderr.end(); resolve({ exit: code, signal, timedOut, durationMs: Date.now() - started, dir, outTail: outHead.slice(0, 20000) + '\n…\n' + outTail, errTail: errHead.slice(0, 20000) + '\n…\n' + errTail }); });
  });
}

function firstErrorLine(r) {
  const lines = (s) => String(s || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const err = lines(r.errTail), out = lines(r.outTail);
  if (r.spawnError) return r.spawnError.split('\n')[0];
  const pick = (arr) => arr.find(l => /error|fail|assert|timeout|cannot|denied|refused|not found|usage:|mismatch|\[FAIL\]|Traceback/i.test(l));
  return (pick(err) || pick(out) || err[0] || out.at(-1) || (r.timedOut ? 'killed at per-proof timeout with no output' : '')).slice(0, 220);
}

function classify(entry, r, routeBoots, liveReachable) {
  const text = `${r.outTail || ''}\n${r.errTail || ''}\n${r.spawnError || ''}`;
  const ok = r.exit === 0 && !r.timedOut && !r.spawnError;
  if (ok) {
    if (entry.pinnedGeneration && entry.pinnedGeneration !== GENERATION) return { result: 'PASS', note: `passes against its pinned superseded artefacts (${entry.pinnedGeneration}); says nothing about ${GENERATION}` };
    if (/MOBILE_STATIC_FAILURE/.test(text)) return { result: 'PASS', note: 'exit 0 only because --require-clean was not passed; the audit itself reports MOBILE_STATIC_FAILURE with ' + ((text.match(/"code": "([A-Z_]+)"/g) || []).map(m => m.replace(/"code": "|"/g, '')).join(', ') || 'findings') };
    if (/\[concession\]/.test(text)) return { result: 'PASS', note: 'with a concession printed: real-payload assertions did not run' };
    return { result: 'PASS', note: '' };
  }
  const pre = LABEL.startsWith('baseline') ? 'pre-existing on main — ' : '';
  if (entry.knownPreexisting && entry.knownPreexisting.test(text)) return { result: 'FAIL', note: 'PRE-EXISTING on main (named in the brief): ' + text.match(entry.knownPreexisting)[0] };
  if (/Executable doesn't exist|browserType\.launch: Executable|ERR_MODULE_NOT_FOUND|Cannot find (module|package)|No module named|ENOENT.*(pwsh|powershell)|spawn pwsh ENOENT|not found beside|usage:/i.test(text) || (r.spawnError && /ENOENT/.test(r.spawnError))) {
    return { result: 'BLOCKED_HARNESS', note: 'tooling: ' + (text.match(/Executable doesn't exist[^\n]*|ERR_MODULE_NOT_FOUND|Cannot find (?:module|package) '[^']+'|No module named '[^']+'|spawn pwsh ENOENT|not found beside[^\n]*|usage:[^\n]*/i) || [r.spawnError || 'see log'])[0].slice(0, 160) };
  }
  if (/\/data-grid-gb\/derived|clone Ventusltd\/data-grid-gb beside|beside this\s+repository|Cannot read properties of undefined \(reading 'path'\)/i.test(text)) {
    return { result: 'BLOCKED_HARNESS', note: 'missing sibling checkout the CI workflow provides (Ventusltd/data-grid-gb, pipelinenews, cvaa, spiders beside the repo)' };
  }
  if (/fixture drift: regenerate/.test(text)) return { result: 'BLOCKED_HARNESS', note: 'oracle upstream drifted: the GlobalGrid2050 sandbox files no longer hash as the committed fixture records (not a GridAtlas product fault)' };
  if (entry.pinnedGeneration && entry.pinnedGeneration !== GENERATION && /AssertionError|assert|generation|does not match|mismatch|no such file|ENOENT|Cannot read properties of undefined|registered twice/i.test(text)) {
    return { result: 'BLOCKED_HARNESS', note: `stale proof pinned to superseded generation ${entry.pinnedGeneration} (current ${GENERATION})` };
  }
  if (entry.liveDependent && liveReachable === false) return { result: 'BLOCKED_DEPENDENCY', note: 'ventusltd.github.io denied by the egress policy (CONNECT 403)' };
  if (entry.routeDependent && routeBoots === false) return { result: 'BLOCKED_DEPENDENCY', note: 'served page cannot boot here: maplibre-gl from cdn.jsdelivr.net denied (CONNECT 403), so the map, engine and 60+3 menu never install' };
  if (/ERR_TUNNEL_CONNECTION_FAILED|ECONNREFUSED|ENOTFOUND|fetch failed|CONNECT tunnel failed|response 403|status 403|net::ERR_/i.test(text)) return { result: 'BLOCKED_DEPENDENCY', note: 'network: ' + (text.match(/ERR_TUNNEL_CONNECTION_FAILED|ECONNREFUSED|ENOTFOUND|fetch failed|CONNECT tunnel failed|net::ERR_[A-Z_]+/i) || ['see log'])[0] };
  if (entry.kind === 'python' && /No module named|FileNotFoundError|manifest\.json/.test(text)) return { result: 'BLOCKED_DEPENDENCY', note: 'no local partition corpus / python module: ' + (text.match(/No module named '[^']+'|FileNotFoundError[^\n]*/) || ['see log'])[0].slice(0, 120) };
  return { result: 'FAIL', note: pre + (r.timedOut ? `killed at ${entry.timeoutMs} ms` : `exit ${r.exit}${r.signal ? ' signal ' + r.signal : ''}`) };
}

/* ------------------------------------------------------------------------ */
/* 4. Main                                                                    */
/* ------------------------------------------------------------------------ */
const all = catalogue();
const selected = all.filter(e => (GROUP === 'all' || e.group === GROUP) && (!ONLY.length || ONLY.includes(e.id) || ONLY.some(o => e.id.startsWith(o + '-' + CHUNK) && CHUNK)) && !SKIP.includes(e.id) && !(SHIM && e.group === 'live'));
console.log(`[runner] ${LABEL}: generation ${GENERATION}, ${selected.length} of ${all.length} catalogue entries, base ${BASE}`);

let routeBoots = null, liveReachable = null, probeSummary = null, liveProbeSummary = null;
if (selected.some(e => e.routeDependent)) {
  const p = await probeRoute(BASE, 'route');
  probeSummary = p.probe;
  routeBoots = !!(p.probe && p.probe.mapArrived);
  console.log(`[runner] route probe: mapArrived=${routeBoots} failedHosts=${JSON.stringify(Object.keys(p.probe?.failedHosts || {}))} pageErrors=${JSON.stringify(p.probe?.pageErrors || [])}`);
}
if (selected.some(e => e.liveDependent)) {
  const p = await probeRoute(LIVE, 'live');
  liveProbeSummary = p.probe;
  liveReachable = !!(p.probe && p.probe.state && p.probe.state.generation);
  console.log(`[runner] live probe: reachable=${liveReachable} mapArrived=${!!p.probe?.mapArrived} failedHosts=${JSON.stringify(Object.keys(p.probe?.failedHosts || {}))}`);
}

const results = [];
const queue = [...selected];
async function worker() {
  while (queue.length) {
    const entry = queue.shift();
    process.stdout.write(`[runner] start ${entry.id} (budget ${entry.timeoutMs / 1000}s)\n`);
    const r = await run(entry);
    const c = classify(entry, r, routeBoots, liveReachable);
    const row = { id: entry.id, group: entry.group, kind: entry.kind, tests: entry.tests, target: entry.target, deps: [...(entry.deps || []), ...(entry.extraDeps || [])], invocation: entry.cmd.map(s => s.replace(REPO + '/', '').replace(OUT, '<out>')).join(' '), env: entry.env, exit: r.exit, signal: r.signal, timedOut: r.timedOut, durationMs: r.durationMs, result: c.result, note: c.note, firstError: firstErrorLine(r), log: path.relative(OUT, r.dir) };
    results.push(row);
    fs.appendFileSync(path.join(OUT, `rows${CHUNK ? '-' + CHUNK : ''}.jsonl`), JSON.stringify({ ...row, chunk: CHUNK, finishedAt: new Date().toISOString(), routeBoots }) + '\n');
    console.log(`[runner] ${c.result.padEnd(18)} ${entry.id.padEnd(44)} ${(r.durationMs / 1000).toFixed(1)}s  ${row.firstError}`);
    for (const src of entry.copyAfter || []) { try { if (fs.existsSync(src)) fs.cpSync(src, path.join(OUT, 'copied-' + path.basename(src)), { recursive: true }); } catch { } }
  }
}
const browserish = (e) => e.group !== 'static' && e.group !== 'historical';
// static proofs run one at a time (cheap, deterministic); browser proofs up to CONCURRENCY at once
const staticQueue = queue.filter(e => !browserish(e)); const browserQueue = queue.filter(browserish);
queue.length = 0; queue.push(...staticQueue);
await worker();
queue.push(...browserQueue);
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

results.sort((a, b) => selected.findIndex(e => e.id === a.id) - selected.findIndex(e => e.id === b.id));
const tally = {};
for (const r of results) tally[r.result] = (tally[r.result] || 0) + 1;
const summary = { label: LABEL, shim: SHIM ? { preload: SHIM_PRELOAD, lightningDataDir: LIGHTNING_DIR || '(lead default)' } : null, generation: GENERATION, base: BASE, live: LIVE, repo: REPO, startedAt: new Date().toISOString(), routeBoots, liveReachable, routeProbe: probeSummary, liveProbe: liveProbeSummary, tally, playwright: (() => { try { return JSON.parse(fs.readFileSync(path.join(REPO, 'node_modules', 'playwright', 'package.json'), 'utf8')).version; } catch { return null; } })(), node: process.version, results };
fs.writeFileSync(path.join(OUT, `results${CHUNK ? '-' + CHUNK : ''}.json`), JSON.stringify(summary, null, 2));

const md = [];
md.push(`# ${LABEL} proof run — generation ${GENERATION}`);
md.push('');
md.push(`- base URL: ${BASE}  | live: ${LIVE}`);
md.push(`- route boots here: **${routeBoots}**  | live reachable: **${liveReachable}**  | node ${process.version} | playwright ${summary.playwright}  | offline shim: **${SHIM ? 'ON (' + SHIM_PRELOAD + ')' : 'off'}**`);
md.push(`- tally: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(', ')}`);
md.push('');
md.push('| # | proof | kind | target | result | duration | first error line |');
md.push('|--:|---|---|---|---|--:|---|');
results.forEach((r, i) => md.push(`| ${i + 1} | ${r.id} | ${r.kind} | ${r.target.replace(/\|/g, '/').slice(0, 70)} | **${r.result}**${r.note ? ' — ' + r.note.replace(/\|/g, '/') : ''} | ${(r.durationMs / 1000).toFixed(1)}s | ${r.firstError.replace(/\|/g, '/')} |`));
fs.writeFileSync(path.join(OUT, `results${CHUNK ? '-' + CHUNK : ''}.md`), md.join('\n') + '\n');
console.log(`\n[runner] done: ${JSON.stringify(tally)}  ->  ${path.join(OUT, `results${CHUNK ? '-' + CHUNK : ''}.md`)}`);
