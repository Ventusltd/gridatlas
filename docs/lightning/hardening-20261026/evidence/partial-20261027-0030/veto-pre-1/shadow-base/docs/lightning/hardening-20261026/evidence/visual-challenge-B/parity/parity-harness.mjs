#!/usr/bin/env node
/**
 * GridAtlas visual-parity harness (agent: atlas-visual-parity).
 *
 * Compares a BASELINE composition against a CANDIDATE composition in the same
 * headless Chromium, at the same viewports, through the same interaction
 * states, and reports:
 *   1. per-viewport, per-state pixel diffs (clocks, live-count suffixes and a
 *      declared additive region are masked; nothing else is);
 *   2. per-viewport, per-state DOM geometry (getBoundingClientRect) and
 *      computed-style diffs for every major original surface;
 *   3. an external-dependency ledger (which hosts answered, failed or were
 *      served from a local fixture);
 *   4. a PASS / FAIL verdict against an explicit, documented threshold.
 *
 * USAGE  (serve the parent dir first: python3 -m http.server <PORT> --directory /home/claude &)
 *   node parity-harness.mjs \
 *     --baseline  http://127.0.0.1:8102/gridatlas/atlas/ \
 *     --candidate http://127.0.0.1:8102/gridatlas/atlas/preview/lightning/ \
 *     --out ./runs/original-vs-preview \
 *     [--additive '[data-weather-group],[data-weather-native-group],[data-gridatlas-layer-key="weather:uk_lightning"]'] \
 *     [--mask '#some-live-counter'] [--no-mask-map] \
 *     [--viewports desktop-1440x900,android-393x852,android-360x740,iphone-390x844-geometry-only] \
 *     [--states initial,layers,grid,about,fullscreen,deeplink] \
 *     [--shim <offline-shim.mjs>|none] [--lightning-data-dir <dir>] [--fixtures <dir>] \
 *     [--threshold 0.1] [--geometry-tolerance 1] \
 *     [--network-idle-ms 20000] [--settle-ms 3000] [--menu-timeout-ms 60000]
 *
 *   Capture-only (one route, no comparison):
 *     node parity-harness.mjs --capture <url> --label original --out ./runs/original
 *
 * EXIT CODE: 0 = PASS, 1 = FAIL, 2 = BLOCKED (harness could not compose a page).
 *
 * OFFLINE SHIM (default) / FIXTURES (fallback) — why they exist, how to turn them off
 *   The container's egress allowlist refuses cdn.jsdelivr.net (MapLibre GL JS
 *   + CSS, the shell's engine dependency; DuckDB), basemaps.cartocdn.com (the
 *   basemap style) and ventusltd.github.io (data partitions). Without the
 *   engine the shell throws at ventus-corev8engine.js:4-6 and shows only
 *   #fatal-banner; without the style MapLibre never fires 'load', so
 *   buildDOM() never runs and no menu exists (runs/unfixtured/ shows this).
 *   By default the harness installs the LEAD'S offline shim on every page
 *   before goto (scratchpad/lightning/harness/offline-shim.mjs): it answers
 *   those hosts from local copies (npm tarballs in scratchpad/lightning/cdn-cache,
 *   the data-gridatlas clone, a background-only style, the lightning clone or
 *   --lightning-data-dir) and ABORTS every other off-origin request, which the
 *   ledger records as BLOCKED_DEPENDENCY. Both routes therefore see identical
 *   conditions. --shim none disables it (use on a network-enabled machine);
 *   --shim none --fixtures <dir> uses this folder's minimal MapLibre+style
 *   fixtures instead (same MapLibre bytes, sha256 in fixtures/FIXTURES.sha256).
 *   Every run records which URLs were shim/fixture-served or aborted.
 *
 * MASKING POLICY
 *   Default masks: #clock, #date, #days (clocks) and the trailing "[...]" live
 *   status/count suffix of every layer label (measured with a DOM Range so only
 *   the suffix glyphs are masked, never the label). --additive <selector> masks
 *   the candidate's declared additive control(s) in BOTH images; if that control
 *   displaces any original surface the geometry diff still fails, by design.
 *   The map canvas (.maplibregl-canvas) is masked by default: under the shim it
 *   is a background-only style with no tiles, and on a network-enabled machine
 *   tile/label fade-in is timing noise; --no-mask-map turns that off. Nothing
 *   else is masked.
 *
 * THRESHOLD (see justification in the report)
 *   A pixel counts as changed when any RGB channel differs by > 16/255.
 *   PASS requires changed pixels <= 0.1 % of the unmasked area per screenshot
 *   AND every surface rect within 1 CSS px AND identical computed styles,
 *   counts and inventories. 0.1 % of 1440x900 is 1,296 px: smaller than one
 *   10-px-tall relabelled word (~2,400 px) and far smaller than one inserted
 *   44-px control row on a 393-wide phone (~17,000 px = 5 %). Two loads of the
 *   same page in the same Chromium measure 0.000 % (self-check mode), so any
 *   non-zero result is a real difference, not renderer noise.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright: the lead symlinked the global package into the clone's git-ignored node_modules.
const PLAYWRIGHT_CANDIDATES = ['/home/claude/gridatlas/node_modules/playwright/index.mjs', 'playwright'];
let chromium;
for (const spec of PLAYWRIGHT_CANDIDATES) {
  try { ({ chromium } = await import(spec)); break; } catch { /* try next */ }
}
if (!chromium) {
  console.error('BLOCKED_HARNESS: cannot import playwright from ' + PLAYWRIGHT_CANDIDATES.join(' or ') + '. Do not install; report BLOCKED_HARNESS.');
  process.exit(2);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
// visual-challenge-B copy (issue #32 Step B). Adapted from PR #31 evidence/visual-parity/parity-harness.mjs
// (sha256 0317604252c4a299d4ef847f56fad84a83868dfe797878535bf0847a0635fd55, see 00-harness-copy-provenance.txt).
// Changes are listed in CHANGES.md next to this file; the original is never mutated.
// The lead's offline shim (scratchpad/lightning/harness/offline-shim.mjs): answers jsdelivr (MapLibre, DuckDB),
// ventusltd.github.io (data-gridatlas + gridatlas clones), the carto style and the lightning feed from local
// copies, and ABORTS every other off-origin request (logged as BLOCKED_DEPENDENCY). Installed per page before goto.
const DEFAULT_SHIM = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

// ---------------------------------------------------------------- CLI ----------
function parseArgs(argv) {
  const out = { mask: [], additive: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    const takesValue = next !== undefined && !next.startsWith('--');
    if (key === 'mask' || key === 'additive') { out[key].push(next); i++; continue; }
    if (key === 'mask-map' || key === 'no-mask-map' || key === 'help' || key === 'self-check' || key === 'suffix-mask') { out[key] = true; continue; }
    out[key] = takesValue ? (i++, next) : true;
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
if (args.help || (!args.baseline && !args.capture)) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(args.help ? 0 : 2);
}

const OUT = path.resolve(args.out || path.join(HERE, 'runs', new Date().toISOString().replace(/[:.]/g, '-')));
fs.mkdirSync(OUT, { recursive: true });
const THRESHOLD_PCT = Number(args.threshold ?? 0.1);
const CHANNEL_TOLERANCE = Number(args['channel-tolerance'] ?? 16);
const GEOMETRY_TOLERANCE = Number(args['geometry-tolerance'] ?? 1);
const NETWORK_IDLE_MS = Number(args['network-idle-ms'] ?? 20000);
const SETTLE_MS = Number(args['settle-ms'] ?? 3000);
const MENU_TIMEOUT_MS = Number(args['menu-timeout-ms'] ?? 60000);
const SHIM_PATH = args.shim === 'none' ? null : path.resolve(args.shim || DEFAULT_SHIM);
let shimModule = null;
if (SHIM_PATH) {
  try { shimModule = await import(SHIM_PATH); }
  catch (error) { console.error('BLOCKED_HARNESS: cannot import offline shim ' + SHIM_PATH + ': ' + error.message); process.exit(2); }
}
// Secondary, self-contained fixtures (MapLibre dist + black style only) used ONLY when --shim none and --fixtures <dir> are given.
const FIXTURES = (!SHIM_PATH && args.fixtures && args.fixtures !== 'none') ? path.resolve(args.fixtures) : null;
const LIGHTNING_DATA_DIR = args['lightning-data-dir'] || undefined;   // passed to the shim: synthetic shards for candidate tests
const MASK_MAP = !args['no-mask-map'];   // default ON: the shim serves a background-only style, no tiles; canvas is not a UI surface
// visual-challenge-B: the issue-32 mask list is ONLY clock/DAYS, map canvas and the lightning-owned additive group.
// The PR #31 harness also masked the trailing "[...]" live-count suffix of every layer label; that is now OFF unless
// --suffix-mask is passed (a second, clearly labelled run), so the primary run uses no mask the work order did not list.
const SUFFIX_MASK = !!args['suffix-mask'];
const DEEPLINK_QUERY = args.deeplink || 'technology=solar&latitude=52.6369&longitude=-1.1398&zoom=10&project=GRIDATLAS_PROOF_controls&capacity_mw=10';

// ---------------------------------------------------------------- PROFILES -----
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_ANDROID_SMALL = 'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const PROFILES = {
  'desktop-1440x900': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    note: 'desktop Chromium, mouse pointer' },
  'desktop-1280x720': { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    note: 'desktop Chromium, mouse pointer (supplemental, P10 clipping diagnosis)' },
  'desktop-1920x1080': { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    note: 'desktop Chromium, mouse pointer (supplemental, P10 clipping diagnosis)' },
  'android-393x852': { viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA_ANDROID,
    note: 'Android Chrome emulation (Pixel 8 geometry, touch, mobile UA)' },
  'android-360x740': { viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA_ANDROID_SMALL,
    note: 'Android Chrome emulation (small phone geometry, touch, mobile UA)' },
  'iphone-390x844-geometry-only': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA_IPHONE,
    noElementFullscreenApi: true,
    note: 'GEOMETRY-ONLY: Chromium with an iPhone user agent. WebKit is not installed, so Safari rendering, 100dvh/safe-area are NOT represented. '
      + 'Element.requestFullscreen/webkitRequestFullscreen are removed by an init script to mirror iOS Safari (no element fullscreen on a div), '
      + 'so the shell takes its CSS-only fullscreen path (enterFullscreen, substation-intelligence cartridge lines 449-451) and the #fs-curtain surface is painted.' }
};
const VIEWPORTS = String(args.viewports || Object.keys(PROFILES).join(',')).split(',').map(s => s.trim()).filter(Boolean);
for (const v of VIEWPORTS) if (!PROFILES[v]) { console.error('unknown viewport profile ' + v); process.exit(2); }
const STATES = String(args.states || 'initial,layers,grid,about,fullscreen,deeplink').split(',').map(s => s.trim()).filter(Boolean);

// ---------------------------------------------------------------- SURFACES -----
// Every major ORIGINAL surface. Order matters only for the report.
const SURFACES = [
  ['dashboard', '.dashboard'],
  ['hud-header', '.hud-header'],
  ['hud-clock', '#clock'],
  ['hud-date', '#date'],
  ['hud-days', '#days'],
  ['hud-brand', '.hud-header .ventus-brand'],
  ['map-container', '#map-container'],
  ['map', '#map'],
  ['map-canvas', '.maplibregl-canvas'],
  ['menu-bar', '#gridatlas-menu-bar'],
  ['menu-side-left', '#gridatlas-menu-bar .gm-side-left'],
  ['menu-brand-slot', '#gridatlas-menu-bar .gm-brand-slot'],
  ['menu-side-right', '#gridatlas-menu-bar .gm-side-right'],
  ['menu-title-File', '#gridatlas-menu-bar-title-0'],
  ['menu-title-Edit', '#gridatlas-menu-bar-title-1'],
  ['menu-title-View', '#gridatlas-menu-bar-title-2'],
  ['menu-title-Scope', '#gridatlas-menu-bar-title-3'],
  ['menu-title-Grid', '#gridatlas-menu-bar-title-4'],
  ['menu-title-About', '#gridatlas-menu-bar-title-5'],
  ['menu-panel-File', '#gridatlas-menu-bar-panel-0'],
  ['menu-panel-Edit', '#gridatlas-menu-bar-panel-1'],
  ['menu-panel-View', '#gridatlas-menu-bar-panel-2'],
  ['menu-panel-Scope', '#gridatlas-menu-bar-panel-3'],
  ['menu-panel-Grid', '#gridatlas-menu-bar-panel-4'],
  ['menu-panel-About', '#gridatlas-menu-bar-panel-5'],
  ['grid-panel-head', '#gridatlas-menu-bar-panel-4 .gm-panel-head'],
  ['grid-panel-body', '#gridatlas-menu-bar-panel-4 .gm-panel-body'],
  ['grid-panel-first-child', '#gridatlas-menu-bar-panel-4 .gm-panel-body > :first-child'],
  ['grid-panel-first-layer-row', '#gridatlas-menu-bar-panel-4 .gm-panel-body .gm-layer'],
  ['grid-panel-400kv-row', '#gridatlas-menu-bar-panel-4 [data-gridatlas-layer-key="engine:400"]'],
  ['scada-wrapper', '.scada-wrapper'],
  ['scada-brand', '.scada-brand'],
  ['status-legend', '.status-legend'],
  ['scada-ui-container', '#scada-ui-container'],
  ['scada-first-child', '#scada-ui-container > :first-child'],
  ['scada-first-item', '#scada-ui-container .key-item'],
  ['scada-400kv-input', '#scada-ui-container input[data-layer-id="400"]'],
  ['disclaimer', '.disclaimer-box'],
  ['podcast-shoutout', '.podcast-shoutout'],
  ['fs-curtain', '#fs-curtain'],
  ['fs-curtain-keys', '#fs-curtain-keys'],
  ['fs-curtain-first-child', '#fs-curtain-keys > :first-child'],
  ['fs-curtain-400kv-input', '#fs-curtain-keys input[data-layer-id="400"]'],
  ['fs-curtain-tab', '#fs-curtain-tab'],
  ['fs-letterhead', '#fs-letterhead'],
  ['btn-fullscreen', '#btn-fullscreen'],
  ['btn-fullscreen-exit', '#btn-fullscreen-exit'],
  ['search-wrapper', '.search-bar-wrapper'],
  ['search-input', '#search-input'],
  ['search-btn', '#search-btn'],
  ['map-controls', '.map-controls'],
  ['attribution', '.custom-map-attrib'],
  ['dash-toggle', '#gridatlas-dash-toggle'],
  ['project-card-popup', '.maplibregl-popup'],
  ['project-card-bar', '.gridatlas-card-bar'],
  ['moving-sheet', '.gridatlas-sheet'],
  ['fatal-banner', '#fatal-banner'],
  ['composer-loader', '#gridatlas-loader']
];
const STYLE_PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'background-image',
  'z-index', 'position', 'display', 'visibility', 'opacity', 'overflow', 'pointer-events', 'transform'];

// ---------------------------------------------------------------- HELPERS ------
const nowIso = () => new Date().toISOString();
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function hostOf(url) { try { return new URL(url).host; } catch { return url; } }

function installNetworkLedger(page, ledger, fixtureUrls) {
  page.on('response', async (response) => {
    const url = response.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    const req = response.request();
    const host = hostOf(url);
    const shimServed = !!shimModule && /^(cdn\.jsdelivr\.net|ventusltd\.github\.io|basemaps\.cartocdn\.com|raw\.githubusercontent\.com)$/.test(host) && !/127\.0\.0\.1|localhost/.test(host);
    ledger.push({ url, host, status: response.status(), type: req.resourceType(),
      fixture: fixtureUrls.has(url) || shimServed, fromServiceWorker: response.fromServiceWorker(), t: nowIso() });
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    ledger.push({ url, host: hostOf(url), status: null, failure: request.failure()?.errorText || 'failed',
      type: request.resourceType(), fixture: false, t: nowIso() });
  });
}

async function installFixtures(context, fixturesDir, log) {
  const fixtureUrls = new Set();
  if (!fixturesDir) { log('fixtures: NONE (all external requests go to the network as-is)'); return fixtureUrls; }
  const files = {
    'https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js': ['maplibre-gl@3.6.2/maplibre-gl.js', 'text/javascript'],
    'https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css': ['maplibre-gl@3.6.2/maplibre-gl.css', 'text/css'],
    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json': ['basemap-style-black.json', 'application/json']
  };
  for (const [url, [rel, contentType]] of Object.entries(files)) {
    const file = path.join(fixturesDir, rel);
    if (!fs.existsSync(file)) { log('fixture missing: ' + file + ' (request will go to the network)'); continue; }
    const body = fs.readFileSync(file);
    await context.route(url, (route) => route.fulfill({ status: 200, contentType, body, headers: { 'access-control-allow-origin': '*' } }));
    fixtureUrls.add(url);
    log('fixture: ' + url + ' <- ' + rel + ' (' + body.length + ' bytes)');
  }
  return fixtureUrls;
}

/** The documented wait strategy. Returns a record of every wait actually used. */
async function settle(page, url, log) {
  const waits = [];
  const t0 = Date.now();
  const mark = (name, extra) => { const ms = Date.now() - t0; waits.push({ wait: name, at_ms: ms, ...(extra || {}) }); log(`  wait ${name} @${ms}ms${extra ? ' ' + JSON.stringify(extra) : ''}`); };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  mark('goto:domcontentloaded');
  // The composer document.write()s the shell; wait for that document, or for a composer failure.
  await page.waitForFunction(() => !!document.documentElement.dataset.gridatlasGeneration
    || document.body?.dataset?.gridatlasRouter === 'failed', null, { timeout: 60000 }).catch(() => {});
  const composed = await page.evaluate(() => ({
    generation: document.documentElement.dataset.gridatlasGeneration || null,
    router: document.body?.dataset?.gridatlasRouter || null,
    title: document.title
  }));
  mark('composer:document.write-complete', composed);
  if (shimModule && typeof shimModule.waitForComposition === 'function') {
    // The lead's own readiness poll (menuBar.installed), recorded as a wait of its own; settleMs 0 because the fixed settle follows below.
    const comp = await shimModule.waitForComposition(page, { deadlineMs: MENU_TIMEOUT_MS, settleMs: 0 });
    mark('shim:waitForComposition(menuBar.installed)', comp);
  }
  let menuInstalled = false;
  try {
    await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__
      && document.querySelectorAll('#gridatlas-menu-bar .gm-title').length === 6
      && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60, null, { timeout: MENU_TIMEOUT_MS });
    menuInstalled = true;
    mark('menu-bar:6-titles+>=60-proxies');
  } catch {
    const diag = await page.evaluate(() => ({
      map: !!window.__GRIDATLAS_V9_MAP__, maplibre: typeof window.maplibregl,
      fatalBanner: getComputedStyle(document.getElementById('fatal-banner') || document.body).display,
      titles: document.querySelectorAll('#gridatlas-menu-bar .gm-title').length,
      proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length,
      engineControls: document.querySelectorAll('#scada-ui-container input[data-layer-id]').length
    })).catch(() => ({}));
    mark('menu-bar:TIMEOUT', diag);
  }
  // Candidate-specific readiness, if the page exposes it (harmless on the original).
  await page.waitForFunction(() => {
    const w = window.__GRIDATLAS_WEATHER_LIGHTNING__;
    return !w || w.installed || (w.errors && w.errors.length);
  }, null, { timeout: 15000 }).then(() => mark('weather-module:installed-or-absent')).catch(() => mark('weather-module:TIMEOUT'));
  // Candidate 202610261949 readiness: __GRIDATLAS_MODULES__.ukLightning.state.installed (absent on the original = pass through).
  await page.waitForFunction(() => { const u = window.__GRIDATLAS_MODULES__?.ukLightning; return !u || u.state?.installed === true; }, null, { timeout: 30000 })
    .then(async () => mark('uk-lightning:installed-or-absent', await page.evaluate(() => { const u = window.__GRIDATLAS_MODULES__?.ukLightning; return u ? { installed: u.state.installed, on: u.state.on, requests: u.state.requests } : 'absent'; })))
    .catch(() => mark('uk-lightning:TIMEOUT'));
  try { await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }); mark('networkidle'); }
  catch { mark('networkidle:NOT-REACHED-within-' + NETWORK_IDLE_MS + 'ms'); }
  await page.waitForTimeout(SETTLE_MS);
  mark('fixed-settle:' + SETTLE_MS + 'ms');
  return { composed, menuInstalled, waits };
}

/** Geometry + computed styles + inventories for every surface, evaluated in the page. */
async function dumpGeometry(page, surfaces, styleProps, additiveSelectors = []) {
  return page.evaluate(([surfaces, styleProps, additiveSelectors]) => {
    const r2 = (n) => Math.round(n * 100) / 100;
    // visual-challenge-B: a surface selector such as ".status-legend" or ".key-item" must never resolve to a node the
    // candidate's additive group owns (the overlay reuses shell class names inside its own subtree); those nodes are
    // skipped so every surface record describes an ORIGINAL element on both routes.
    const additiveSel = additiveSelectors.join(',');
    const notAdditive = (el) => !additiveSel || !el.closest(additiveSel);
    const rectOf = (el) => { const r = el.getBoundingClientRect(); return { x: r2(r.x), y: r2(r.y), width: r2(r.width), height: r2(r.height), top: r2(r.top), right: r2(r.right), bottom: r2(r.bottom), left: r2(r.left) }; };
    const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const inventory = (el) => {
      if (!el) return undefined;
      const groups = [...el.querySelectorAll('.key-title, .gm-layer-group')].map(text);
      const inputs = el.querySelectorAll('input');
      const engine = el.querySelectorAll('input[data-layer-id]').length;
      const pipeline = el.querySelectorAll('input[data-pn-layer]').length;
      const proxies = el.querySelectorAll('input[data-gridatlas-layer-proxy]').length;
      const weather = el.querySelectorAll('input[data-weather-layer]').length;
      const lightning = el.querySelectorAll('[data-lightning-control]').length;   // candidate 202610261949's own toggle (never counted as an original)
      const firstRows = [...el.querySelectorAll('label')].slice(0, 4).map(text);
      return { groups, groupCount: groups.length, inputs: inputs.length, engine, pipeline, proxies, weather, lightning, firstRows };
    };
    const out = { surfaces: {}, document: {} };
    for (const [name, selector] of surfaces) {
      let nodes = [];
      try { nodes = [...document.querySelectorAll(selector)].filter(notAdditive); } catch (e) { out.surfaces[name] = { selector, error: String(e) }; continue; }
      const el = nodes[0];
      if (!el) { out.surfaces[name] = { selector, present: false, count: 0 }; continue; }
      const cs = getComputedStyle(el);
      const styles = {}; for (const p of styleProps) styles[p] = cs.getPropertyValue(p);
      const rec = { selector, present: true, count: nodes.length, tag: el.tagName.toLowerCase(), id: el.id || null, class: el.className && typeof el.className === 'string' ? el.className : null,
        hidden: el.hidden || null, ariaExpanded: el.getAttribute('aria-expanded'), rect: rectOf(el), styles, childCount: el.childElementCount, text: text(el),
        parentPath: (() => { const p = []; let n = el.parentElement; while (n && p.length < 4) { p.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); n = n.parentElement; } return p.join(' < '); })() };
      if (/scada-ui-container|fs-curtain-keys|grid-panel-body/.test(name)) rec.inventory = inventory(el);
      out.surfaces[name] = rec;
    }
    const menu = window.__GRIDATLAS_MODULES__?.menuBar;
    out.document = {
      title: document.title, url: location.href,
      generation: document.documentElement.dataset.gridatlasGeneration || null,
      atlasState: window.__GRIDATLAS_ATLAS__ || null,
      htmlClass: document.documentElement.className, bodyClass: document.body.className,
      viewport: { innerWidth: innerWidth, innerHeight: innerHeight, dpr: devicePixelRatio, userAgent: navigator.userAgent },
      fullscreenElement: document.fullscreenElement ? (document.fullscreenElement.id || document.fullscreenElement.className) : null,
      menuBar: menu ? { installed: !!menu.installed, inspect: (typeof menu.inspect === 'function' ? menu.inspect() : null), panel_counts: menu.panel_counts || null, attrib_clearance_px: menu.attrib_clearance_px } : null,
      dash: window.__GRIDATLAS_DASH__ || null,
      scadaCollapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') || null,
      weather: window.__GRIDATLAS_WEATHER_LIGHTNING__ ? { ...window.__GRIDATLAS_WEATHER_LIGHTNING__ } : null,
      ukLightning: (() => { const u = window.__GRIDATLAS_MODULES__?.ukLightning; if (!u) return null; const s = u.state || {}; return { installed: s.installed, on: s.on, requests: s.requests, errors: (s.errors || []).slice(0, 5), waiting_for: s.waiting_for, last: s.last }; })(),
      mapLayerCount: (() => { try { return window.__GRIDATLAS_V9_MAP__.getStyle().layers.length; } catch { return null; } })(),
      storageKeys: (() => { try { return { local: Object.keys(localStorage), session: Object.keys(sessionStorage) }; } catch { return null; } })(),
      engineControls: document.querySelectorAll('#scada-ui-container input[data-layer-id]').length,
      pipelineControls: document.querySelectorAll('#scada-ui-container input[data-pn-layer]').length,
      proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length,
      maplibre: typeof window.maplibregl === 'undefined' ? 'undefined' : (window.maplibregl.version || 'present'),
      mapStyleLoaded: (() => { try { return !!window.__GRIDATLAS_V9_MAP__?.isStyleLoaded(); } catch { return null; } })(),
      openMenus: [...document.querySelectorAll('#gridatlas-menu-bar .gm-menu.gm-open .gm-title')].map(t => t.textContent.trim())
    };
    return out;
  }, [surfaces, styleProps, additiveSelectors]);
}

/** Rects to mask: clocks, live-count suffixes (Range-measured), optional map canvas, optional additive controls. */
async function maskRects(page, { maskSelectors, additiveSelectors, maskMap, suffixMask }) {
  return page.evaluate(([maskSelectors, additiveSelectors, maskMap, suffixMask]) => {
    const rects = [];
    const push = (r, why) => { if (r && r.width > 0 && r.height > 0) rects.push({ x: Math.floor(r.left), y: Math.floor(r.top), w: Math.ceil(r.width) + 1, h: Math.ceil(r.height) + 1, why }); };
    for (const sel of maskSelectors) { try { for (const el of document.querySelectorAll(sel)) push(el.getBoundingClientRect(), 'mask:' + sel); } catch {} }
    // Live-count suffix: the trailing "[WAIT]" / "[OK]" / "[123 | 4GW]" on every layer label, measured by Range.
    // visual-challenge-B: OFF unless --suffix-mask (not in the issue-32 mask list).
    const labelNodes = suffixMask ? document.querySelectorAll('span[id^="lbl-"], span[id^="fs-lbl-"], .gm-layer-name, [data-weather-label]') : [];
    for (const span of labelNodes) {
      const tn = [...span.childNodes].find(n => n.nodeType === 3 && /\[/.test(n.nodeValue));
      if (!tn) continue;
      const idx = tn.nodeValue.lastIndexOf('[');
      try { const range = document.createRange(); range.setStart(tn, idx); range.setEnd(tn, tn.nodeValue.length); for (const r of range.getClientRects()) push(r, 'live-count-suffix'); } catch {}
    }
    if (maskMap) {
      for (const el of document.querySelectorAll('.maplibregl-canvas')) push(el.getBoundingClientRect(), 'mask-map');
      // UI surfaces painted ABOVE the canvas are carved back out of the canvas mask, so a dropdown, card, sheet,
      // curtain or control stacked over the map is still compared. Markers/popups drawn by the map itself are not.
      const OVERLAYS = ['#gridatlas-menu-bar', '#gridatlas-menu-bar .gm-panel:not([hidden])', '.search-bar-wrapper', '.search-results',
        '.map-controls', '.custom-map-attrib', '#gridatlas-dash-toggle', '.gridatlas-sheet', '.gridatlas-card-bar', '.maplibregl-popup',
        '#fs-curtain', '#fs-curtain-tab', '#btn-fullscreen', '#btn-fullscreen-exit', '#fs-letterhead', '#gridatlas-mobile-tray',
        '#measure-display', '#polyzone-display', '.radius-popup', '#fatal-banner', '.podcast-shoutout', '#gridatlas-sld-panel',
        '#gridatlas-boot-status', '#gridatlas-arrival-status', '.hud-header', '.scada-wrapper'];
      for (const sel of OVERLAYS) {
        try {
          for (const el of document.querySelectorAll(sel)) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
            push(el.getBoundingClientRect(), 'overlay:' + sel);
          }
        } catch {}
      }
    }
    for (const sel of additiveSelectors) { try { for (const el of document.querySelectorAll(sel)) push(el.getBoundingClientRect(), 'additive:' + sel); } catch {} }
    return rects;
  }, [maskSelectors, additiveSelectors, maskMap, suffixMask]);
}

// ---------------------------------------------------------------- EXTRAS (visual-challenge-B) ---------------------
// Every original element's DOM order + box + key computed styles (lightning-owned subtrees excluded), scroll areas,
// original hit targets (elementFromPoint at the centre must resolve to the element itself or a descendant), and the
// <style>/<link rel=stylesheet> inventory. Evaluated in the page; nothing is scrolled or clicked here.
const EXTRA_STYLE_PROPS = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'z-index', 'display', 'visibility', 'position', 'opacity'];
async function dumpExtras(page, state, additiveSelectors) {
  return page.evaluate(([state, additiveSelectors, props]) => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const sig = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '')
      + [...el.attributes].filter(a => /^data-(layer-id|pn-layer|gridatlas-layer-key|lightning-group|lightning-control)$/.test(a.name)).map(a => `[${a.name}=${a.value}]`).join('');
    const additiveSel = additiveSelectors.join(',');
    const isAdditive = (el) => additiveSel && !!el.closest(additiveSel);
    // 1. every element, DOM order, lightning-owned subtrees removed
    const all = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.currentNode; el; el = walker.nextNode()) {
      if (isAdditive(el)) continue;
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      all.push([sig(el), r2(r.x), r2(r.y), r2(r.width), r2(r.height), props.map(p => cs.getPropertyValue(p)).join('|')]);
    }
    const additiveNodes = additiveSel ? [...document.querySelectorAll(additiveSel)].map(el => { const r = el.getBoundingClientRect(); return { sig: sig(el), parent: sig(el.parentElement), indexInParent: [...el.parentElement.children].indexOf(el), siblings: el.parentElement.children.length, rect: { x: r2(r.x), y: r2(r.y), width: r2(r.width), height: r2(r.height) }, descendants: el.querySelectorAll('*').length }; }) : [];
    // 2. scroll areas
    const scrollSel = ['html', '#map-container', '#gridatlas-menu-bar', '#gridatlas-menu-bar .gm-panel:not([hidden])', '#gridatlas-menu-bar-panel-4', '#gridatlas-menu-bar-panel-4 .gm-panel-body', '.scada-wrapper', '#scada-ui-container', '#fs-curtain', '#fs-curtain-keys', '.dashboard'];
    const scroll = {};
    for (const sel of scrollSel) { const el = document.querySelector(sel); if (!el) { scroll[sel] = null; continue; } const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      scroll[sel] = { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollTop: el.scrollTop, overflowY: cs.overflowY, overflowX: cs.overflowX, rect: { x: r2(r.x), y: r2(r.y), width: r2(r.width), height: r2(r.height) }, hiddenOverflowPx: Math.max(0, el.scrollHeight - el.clientHeight) }; }
    // 3. hit targets
    const vw = innerWidth, vh = innerHeight;
    const clipChain = (el, cx, cy) => { const out = []; for (let a = el.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const b = a.getBoundingClientRect(); if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) out.push(sig(a) + ' ' + [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)].join(',')); } } return out; };
    const probe = (name, el) => {
      if (!el) return { name, present: false };
      const b = el.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const inViewport = b.width > 0 && b.height > 0 && cx >= 0 && cy >= 0 && cx <= vw && cy <= vh;
      const t = inViewport ? document.elementFromPoint(cx, cy) : null;
      let result;
      if (!inViewport) result = 'OUT-OF-VIEWPORT';
      else if (!t) result = 'NONE';
      else if (t === el || el.contains(t)) result = 'self';
      else if (el.tagName === 'LABEL' && (t === el.control || (el.control && el.control.contains(t)))) result = 'self';
      else if (t.tagName === 'LABEL' && t.control === el) result = 'self';
      else if (t.contains(el)) result = 'ANCESTOR:' + sig(t);
      else result = 'OTHER:' + sig(t);
      return { name, present: true, rect: { x: r2(b.x), y: r2(b.y), width: r2(b.width), height: r2(b.height) }, centre: [r2(cx), r2(cy)], inViewport, result, clippedBy: clipChain(el, cx, cy), text: (el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 60) };
    };
    const q = (s) => document.querySelector(s);
    // "visible" = the row's box lies inside the viewport AND inside every overflow-clipping ancestor (the Grid panel
    // body, the panel, #map-container ...), so a row painted into a clipped band never counts as visible.
    const clipRect = (el) => { let top = 0, bottom = vh, left = 0, right = vw; for (let a = el.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const b = a.getBoundingClientRect(); top = Math.max(top, b.top); bottom = Math.min(bottom, b.bottom); left = Math.max(left, b.left); right = Math.min(right, b.right); } } return { top, bottom, left, right }; };
    const visibleRows = (container, rowSel) => { const c = q(container); if (!c) return []; return [...c.querySelectorAll(rowSel)].filter(el => !isAdditive(el)).filter(el => { const b = el.getBoundingClientRect(); const k = clipRect(el); return b.height > 0 && b.top >= k.top && b.bottom <= k.bottom && b.left >= k.left && b.right <= k.right; }); };
    const targets = [];
    for (let i = 0; i < 6; i++) targets.push(probe('menu-title-' + i, q('#gridatlas-menu-bar-title-' + i)));
    targets.push(probe('dash-toggle', q('#gridatlas-dash-toggle')));
    targets.push(probe('search-input', q('#search-input')));
    targets.push(probe('search-btn', q('#search-btn')));
    [...document.querySelectorAll('.map-controls button')].slice(0, 3).forEach((b, i) => targets.push(probe('map-control-' + i, b)));
    targets.push(probe('attribution', q('.custom-map-attrib')));
    targets.push(probe('hud-brand', q('.hud-header .ventus-brand')));
    // native Layers panel rows (desktop: open by default; phone: only after the LAYERS tap)
    const l400 = q('#scada-ui-container input[data-layer-id="400"]'); targets.push(probe('layers-400kv-row', l400 ? l400.closest('label') || l400 : null));
    const lv = visibleRows('#scada-ui-container', 'label.key-item'); targets.push(probe('layers-first-visible-row', lv[0])); targets.push(probe('layers-last-visible-row', lv[lv.length - 1]));
    const lpn = q('#scada-ui-container input[data-pn-layer]'); targets.push(probe('layers-first-pipeline-row', lpn ? lpn.closest('label') || lpn : null));
    if (state === 'grid' || state === 'fullscreen') {
      targets.push(probe('grid-400kv-proxy', q('#gridatlas-menu-bar-panel-4 [data-gridatlas-layer-key="engine:400"]')));
      const gv = visibleRows('#gridatlas-menu-bar-panel-4 .gm-panel-body', 'label.gm-layer'); targets.push(probe('grid-first-visible-proxy', gv[0])); targets.push(probe('grid-last-visible-proxy', gv[gv.length - 1]));
      const allProxies = [...document.querySelectorAll('#gridatlas-menu-bar-panel-4 .gm-panel-body label.gm-layer')]; targets.push(probe('grid-last-proxy-in-dom', allProxies[allProxies.length - 1]));
      targets.push(probe('fs-curtain-tab', q('#fs-curtain-tab')));
      const head = q('#gridatlas-menu-bar-panel-4 .gm-panel-head'); targets.push(probe('grid-panel-head', head));
    }
    if (state === 'about') { const ab = [...document.querySelectorAll('#gridatlas-menu-bar-panel-5 button, #gridatlas-menu-bar-panel-5 a, #gridatlas-menu-bar-panel-5 [role="button"]')]; targets.push(probe('about-first-control', ab[0])); targets.push(probe('about-last-control', ab[ab.length - 1])); }
    if (state === 'fullscreen') { targets.push(probe('btn-fullscreen-exit', q('#btn-fullscreen-exit'))); const c400 = q('#fs-curtain-keys input[data-layer-id="400"]'); targets.push(probe('curtain-400kv-row', c400 ? c400.closest('label') || c400 : null)); const cv = visibleRows('#fs-curtain-keys', 'label.key-item'); targets.push(probe('curtain-first-visible-row', cv[0])); targets.push(probe('curtain-last-visible-row', cv[cv.length - 1])); }
    if (state === 'deeplink') { targets.push(probe('card-bar', q('.gridatlas-card-bar'))); targets.push(probe('card-bar-first-button', q('.gridatlas-card-bar button'))); }
    // the candidate's own control(s): reported separately (P14), never counted as an original
    const lightningTargets = [...document.querySelectorAll('[data-lightning-control="toggle"]')].map((t, i) => { const g = t.closest('[data-lightning-group]'); const p = probe('lightning-toggle-' + (g ? g.dataset.lightningGroup : i), t.closest('label') || t); p.ariaLabel = t.getAttribute('aria-label'); p.role = t.getAttribute('role'); p.type = t.type; p.checked = t.checked; return p; });
    // 4. style elements
    const h32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
    const styleElements = [...document.querySelectorAll('style')].map((s, i) => ({ i, id: s.id || null, bytes: s.textContent.length, fnv1a: h32(s.textContent), parent: sig(s.parentElement) }));
    const styleLinks = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.getAttribute('href'));
    return { elementCount: all.length, all, additiveNodes, scroll, targets, lightningTargets, styleElements, styleLinks, viewport: { vw, vh } };
  }, [state, additiveSelectors, EXTRA_STYLE_PROPS]);
}

// The three containers the overlay appends INTO (issue §2: "any added group goes AFTER original groups"). When such a
// host is not a scroll container its own box grows by the appended group's height; that growth is the approved
// additive affordance and is listed as additive-host-growth, not as an original element moving. Any other change of
// any element — including a host whose x/y/width changes or whose height SHRINKS — is original movement (FAIL).
const ADDITIVE_HOST_SIG = /^div#(scada-ui-container|fs-curtain-keys|gridatlas-menu-bar-panel-4)\b/;
function diffExtras(a, b) {
  const out = { elementCountBaseline: a.elementCount, elementCountCandidate: b.elementCount, movedElements: [], additiveHostGrowth: [], styleChangedElements: [], signatureDivergence: null, scrollDiffs: [], hitTargetDiffs: [], occluderChanged: [], hitTargetsCompared: 0, hitTargetsPreexistingNotSelf: [], styleElementsEqual: true, styleLinksEqual: true, lightningTargets: b.lightningTargets, additiveNodes: b.additiveNodes };
  const n = Math.min(a.all.length, b.all.length);
  for (let i = 0; i < n; i++) {
    const [sa, xa, ya, wa, ha, sta] = a.all[i], [sb, xb, yb, wb, hb, stb] = b.all[i];
    if (sa !== sb) { out.signatureDivergence = { index: i, baseline: sa, candidate: sb }; break; }
    const d = { x: xb - xa, y: yb - ya, width: wb - wa, height: hb - ha };
    if (Object.values(d).some(v => Math.abs(v) > GEOMETRY_TOLERANCE)) {
      const rec = { index: i, sig: sa, baseline: [xa, ya, wa, ha], candidate: [xb, yb, wb, hb], delta: d };
      const hostGrowthOnly = ADDITIVE_HOST_SIG.test(sa) && Math.abs(d.x) <= GEOMETRY_TOLERANCE && Math.abs(d.y) <= GEOMETRY_TOLERANCE && Math.abs(d.width) <= GEOMETRY_TOLERANCE && d.height > 0;
      (hostGrowthOnly ? out.additiveHostGrowth : out.movedElements).push(rec);
    }
    if (sta !== stb) out.styleChangedElements.push({ index: i, sig: sa, baseline: sta, candidate: stb });
  }
  if (a.all.length !== b.all.length && !out.signatureDivergence) out.signatureDivergence = { index: n, baseline: a.all[n]?.[0] || null, candidate: b.all[n]?.[0] || null, note: 'element counts differ after excluding additive subtrees' };
  for (const sel of Object.keys(a.scroll)) {
    const sa = a.scroll[sel], sb = b.scroll[sel];
    if (!sa || !sb) { if (!!sa !== !!sb) out.scrollDiffs.push({ selector: sel, kind: 'presence', baseline: !!sa, candidate: !!sb }); continue; }
    for (const k of ['scrollHeight', 'clientHeight', 'scrollWidth', 'clientWidth', 'overflowY', 'hiddenOverflowPx']) if (sa[k] !== sb[k]) out.scrollDiffs.push({ selector: sel, kind: k, baseline: sa[k], candidate: sb[k], delta: typeof sa[k] === 'number' ? sb[k] - sa[k] : undefined });
  }
  const byName = (list) => Object.fromEntries(list.map(t => [t.name, t]));
  const ta = byName(a.targets), tb = byName(b.targets);
  for (const name of new Set([...Object.keys(ta), ...Object.keys(tb)])) {
    const x = ta[name], y = tb[name];
    if (!x || !y || !x.present || !y.present) { if ((x?.present || false) !== (y?.present || false)) out.hitTargetDiffs.push({ name, kind: 'presence', baseline: x?.present || false, candidate: y?.present || false }); continue; }
    out.hitTargetsCompared++;
    if (x.result !== y.result) {
      const bothOccluded = x.result !== 'self' && y.result !== 'self' && x.result !== 'OUT-OF-VIEWPORT' && y.result !== 'OUT-OF-VIEWPORT';
      // occluded on BOTH routes (e.g. a map control under the open dropdown): the occluder's identity changed, the
      // original control's reachability did not -> listed, not failed. Everything else is a regression.
      (bothOccluded ? out.occluderChanged : out.hitTargetDiffs).push({ name, kind: 'result', baseline: x.result, candidate: y.result, baselineRect: x.rect, candidateRect: y.rect, candidateClippedBy: y.clippedBy, text: x.text });
    } else if (x.result !== 'self') out.hitTargetsPreexistingNotSelf.push({ name, result: x.result, clippedBy: x.clippedBy, rect: x.rect });
    // dynamically chosen rows ("last visible") legitimately change identity when the list's visible area changes; the
    // rect comparison is kept for the fixed-identity targets and reported with the row text for the dynamic ones.
    if (['x', 'y', 'width', 'height'].some(k => Math.abs(x.rect[k] - y.rect[k]) > GEOMETRY_TOLERANCE)) out.hitTargetDiffs.push({ name, kind: 'rect', baseline: x.rect, candidate: y.rect, baselineText: x.text, candidateText: y.text, dynamicRow: /visible/.test(name) });
  }
  out.styleElementsEqual = JSON.stringify(a.styleElements) === JSON.stringify(b.styleElements);
  out.styleLinksEqual = JSON.stringify(a.styleLinks.map(s => s.replace(/^http:\/\/127\.0\.0\.1:\d+\/(gridatlas|wt)\//, '<origin>/'))) === JSON.stringify(b.styleLinks.map(s => s.replace(/^http:\/\/127\.0\.0\.1:\d+\/(gridatlas|wt)\//, '<origin>/')));
  if (!out.styleElementsEqual) out.styleElementsDiff = { baseline: a.styleElements, candidate: b.styleElements };
  out.pass = !out.signatureDivergence && out.movedElements.length === 0 && out.styleChangedElements.length === 0 && out.hitTargetDiffs.length === 0 && out.styleElementsEqual && out.styleLinksEqual;
  return out;
}

const tapOrClick = async (profile, locator) => profile.hasTouch ? locator.tap({ timeout: 8000 }) : locator.click({ timeout: 8000 });

/** Drive the page into a named state using REAL clicks/taps only (never force:true). */
async function enterState(page, profile, state, log) {
  const note = {};
  if (state === 'initial') return note;
  if (state === 'layers') {
    const collapsed = await page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') === '1');
    const toggle = page.locator('#gridatlas-dash-toggle');
    if (collapsed) {
      if (await toggle.count() === 0) { note.outcome = 'FAIL: panel collapsed and no #gridatlas-dash-toggle'; return note; }
      note.toggle = await page.evaluate(() => { const t = document.getElementById('gridatlas-dash-toggle'); const b = t.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { text: (t.textContent || '').trim(), ariaLabel: t.getAttribute('aria-label'), rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], hitSelf: h === t || t.contains(h) }; });
      if (!note.toggle.hitSelf) { note.outcome = 'FAIL: #gridatlas-dash-toggle not hit-testable at its centre (would need programmatic scroll)'; return note; }
      await tapOrClick(profile, toggle);
      await page.waitForTimeout(400);
      note.outcome = (await page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') !== '1')) ? 'opened by real ' + (profile.hasTouch ? 'tap' : 'click') + ' on #gridatlas-dash-toggle' : 'FAIL: toggle clicked but panel still collapsed';
      note.openedByUs = true;
    } else {
      note.outcome = 'already open on arrival (desktop default); screenshot equals initial state apart from clocks';
    }
    await page.evaluate(() => { const c = document.getElementById('scada-ui-container'); if (c) c.scrollTop = 0; });
    return note;
  }
  if (state === 'grid' || state === 'about' || state === 'fullscreen' || state === 'view') {
    const name = state === 'grid' ? 'Grid' : state === 'about' ? 'About' : 'View';
    const title = page.getByRole('button', { name, exact: true });
    if (await title.count() === 0) { note.outcome = 'FAIL: no "' + name + '" menu title (menu bar absent)'; return note; }
    await tapOrClick(profile, title.first());
    await page.waitForTimeout(350);
    note.menuExpanded = await title.first().getAttribute('aria-expanded');
    note.outcome = 'opened "' + name + '" by real ' + (profile.hasTouch ? 'tap' : 'click') + ' (aria-expanded=' + note.menuExpanded + ')';
    if (state === 'grid' || state === 'about') {
      await page.evaluate(() => { for (const b of document.querySelectorAll('#gridatlas-menu-bar .gm-panel-body, #gridatlas-menu-bar .gm-panel')) b.scrollTop = 0; });
      return note;
    }
    // fullscreen: the shell's #btn-fullscreen lives inside the View panel once the menu bar is hosted.
    const fsBtn = page.locator('#btn-fullscreen');
    if (await fsBtn.count() === 0) { note.outcome += '; FAIL: #btn-fullscreen missing'; return note; }
    await tapOrClick(profile, fsBtn);
    const entered = await page.waitForFunction(() => document.body.classList.contains('fs-active'), null, { timeout: 5000 }).then(() => true).catch(() => false);
    note.fsActive = entered;
    note.fullscreenElement = await page.evaluate(() => document.fullscreenElement ? (document.fullscreenElement.id || document.fullscreenElement.className) : null);
    note.outcome += entered ? '; entered fullscreen by real click on #btn-fullscreen (body.fs-active)' : '; FAIL: body.fs-active not set after clicking #btn-fullscreen';
    await page.waitForTimeout(600);
    // Open the curtain: #fs-curtain-tab was moved into the Grid panel by the menu bar.
    const tab = page.locator('#fs-curtain-tab');
    if (entered && await tab.count()) {
      const visible = await tab.isVisible().catch(() => false);
      if (!visible) { const grid = page.getByRole('button', { name: 'Grid', exact: true }); if (await grid.count()) { await tapOrClick(profile, grid.first()); await page.waitForTimeout(300); } }
      // visual-challenge-B: "where reachable" — the tab is clicked ONLY if a real pointer at its centre would hit it.
      // Playwright's locator.click() would otherwise scroll the overflow:hidden ancestors programmatically, which is
      // not a user gesture; that case is recorded as UNREACHABLE with the occluding element named.
      note.curtainTabHit = await page.evaluate(() => { const t = document.getElementById('fs-curtain-tab'); if (!t) return null; const b = t.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const inVp = b.width > 0 && b.height > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight; const h = inVp ? document.elementFromPoint(cx, cy) : null;
        const sg = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') : null;
        return { rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], inViewport: inVp, hit: h === t || (h && t.contains(h)) ? 'self' : sg(h) }; });
      if (note.curtainTabHit && note.curtainTabHit.hit === 'self') {
        try {
          await tapOrClick(profile, tab);
          await page.waitForTimeout(500);
          note.curtainOpen = await page.evaluate(() => document.getElementById('fs-curtain')?.classList.contains('curtain-open'));
          note.outcome += '; curtain ' + (note.curtainOpen ? 'opened' : 'NOT opened') + ' by real ' + (profile.hasTouch ? 'tap' : 'click') + ' on #fs-curtain-tab (hit-tested self first)';
        } catch (e) { note.outcome += '; curtain tab not clickable: ' + String(e.message).split('\n')[0]; }
        await page.evaluate(() => { const k = document.getElementById('fs-curtain'); if (k) k.scrollTop = 0; });
      } else {
        note.curtainOpen = false;
        note.outcome += '; curtain NOT opened: #fs-curtain-tab UNREACHABLE without programmatic scrolling (elementFromPoint=' + JSON.stringify(note.curtainTabHit) + ')';
      }
    }
    return note;
  }
  if (state === 'deeplink') {
    note.outcome = 'separate navigation with ?' + DEEPLINK_QUERY;
    return note;
  }
  note.outcome = 'unknown state';
  return note;
}

async function leaveState(page, profile, state, note) {
  try {
    if (state === 'layers' && note.openedByUs) { await tapOrClick(profile, page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(300); }
    if (state === 'grid' || state === 'about') { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
    if (state === 'fullscreen') {
      await page.keyboard.press('Escape');
      const exit = page.locator('#btn-fullscreen-exit');
      if (await page.evaluate(() => document.body.classList.contains('fs-active'))) {
        const view = page.getByRole('button', { name: 'View', exact: true });
        if (await view.count()) { await tapOrClick(profile, view.first()); await page.waitForTimeout(250); }
        if (await exit.count() && await exit.isVisible().catch(() => false)) await tapOrClick(profile, exit);
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(400);
    }
  } catch { /* best effort */ }
}

// ---------------------------------------------------------------- CAPTURE ------
async function captureRoute(browser, { label, baseUrl, additiveSelectors, maskSelectors, maskMap, log }) {
  const result = { label, baseUrl, startedAt: nowIso(), fixtures: FIXTURES, viewports: {} };
  for (const vp of VIEWPORTS) {
    const profile = PROFILES[vp];
    log(`[${label}] viewport ${vp}: ${profile.note}`);
    const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile,
      hasTouch: profile.hasTouch, userAgent: profile.userAgent, reducedMotion: 'no-preference', colorScheme: 'dark', locale: 'en-GB', timezoneId: 'Europe/London' });
    const fixtureUrls = await installFixtures(context, FIXTURES, log);
    if (profile.noElementFullscreenApi) {
      await context.addInitScript(() => {
        try { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen; } catch {}
        try { Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true }); } catch {}
        try { Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { value: undefined, configurable: true }); } catch {}
      });
      log('  init-script: element Fullscreen API removed (iOS Safari emulation; CSS-only fullscreen path)');
    }
    const page = await context.newPage();
    const ledger = []; const pageErrors = []; const consoleErrors = [];
    installNetworkLedger(page, ledger, fixtureUrls);
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 400)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
    let shim = null;
    if (shimModule) {
      shim = await shimModule.installOfflineShim(page, LIGHTNING_DATA_DIR ? { lightningDataDir: LIGHTNING_DATA_DIR } : {});
      log('  offline shim installed on page (' + SHIM_PATH + (LIGHTNING_DATA_DIR ? ', lightningDataDir=' + LIGHTNING_DATA_DIR : '') + ')');
    }
    const vpOut = { profile: { ...profile }, states: {}, pageErrors, consoleErrors, network: null, shim: null };
    result.viewports[vp] = vpOut;
    const settled = await settle(page, baseUrl, log);
    vpOut.settle = settled;
    const dir = path.join(OUT, label, vp); fs.mkdirSync(dir, { recursive: true });
    for (const state of STATES) {
      let targetPage = page;
      const stateRec = { state, note: null, screenshot: null, geometry: null, masks: null, waits: null };
      try {
        if (state === 'deeplink') {
          const sep = baseUrl.includes('?') ? '&' : '?';
          const url = baseUrl + sep + DEEPLINK_QUERY;
          const s2 = await settle(page, url, log);
          stateRec.waits = s2.waits;
          const card = await page.locator('.gridatlas-card-bar, .maplibregl-popup').first().waitFor({ timeout: 30000 }).then(() => 'card present').catch(() => 'no card within 30s');
          await page.waitForTimeout(800);
          stateRec.note = { outcome: 'deep link ' + url + ' -> ' + card };
        } else {
          stateRec.note = await enterState(page, profile, state, log);
        }
        const masks = await maskRects(targetPage, { maskSelectors, additiveSelectors, maskMap, suffixMask: SUFFIX_MASK });
        const shot = path.join(dir, `${state}.png`);
        await targetPage.screenshot({ path: shot, fullPage: false, animations: 'disabled', caret: 'hide' });
        stateRec.screenshot = shot; stateRec.masks = masks;
        stateRec.geometry = await dumpGeometry(targetPage, SURFACES, STYLE_PROPS, additiveSelectors);
        stateRec.extras = await dumpExtras(targetPage, state, additiveSelectors);
        writeJson(path.join(dir, `${state}.geometry.json`), stateRec.geometry);
        writeJson(path.join(dir, `${state}.extras.json`), stateRec.extras);
        writeJson(path.join(dir, `${state}.masks.json`), masks);
        log(`  [${label}/${vp}/${state}] ${stateRec.note?.outcome || ''}`);
      } catch (error) {
        stateRec.error = String(error && error.stack || error).slice(0, 600);
        log(`  [${label}/${vp}/${state}] ERROR ${stateRec.error.split('\n')[0]}`);
        try { const shot = path.join(dir, `${state}.error.png`); await page.screenshot({ path: shot, fullPage: false }); stateRec.screenshot = shot; } catch {}
      }
      if (state !== 'deeplink') await leaveState(page, profile, state, stateRec.note || {});
      vpOut.states[state] = stateRec;
    }
    // Network ledger summary per host.
    const byHost = {};
    for (const e of ledger) {
      const h = byHost[e.host] ||= { requests: 0, ok: 0, failed: 0, http4xx5xx: 0, fixture: 0, sampleFailure: null, sample: e.url.slice(0, 160) };
      h.requests++;
      if (e.fixture) h.fixture++;
      else if (e.status === null) { h.failed++; h.sampleFailure ||= e.failure; }
      else if (e.status >= 400) h.http4xx5xx++;
      else h.ok++;
    }
    vpOut.network = { byHost, entries: ledger.length };
    vpOut.shim = shim ? shim.summary() : null;
    writeJson(path.join(dir, 'network-ledger.json'), { byHost, shim: vpOut.shim, entries: ledger });
    writeJson(path.join(dir, 'console.json'), { pageErrors, consoleErrors });
    await context.close();
  }
  result.finishedAt = nowIso();
  writeJson(path.join(OUT, label, 'capture.json'), result);
  return result;
}

// ---------------------------------------------------------------- DIFF ---------
/** Pixel diff computed inside Chromium (no native image deps). */
async function pixelDiff(browser, aPath, bPath, masks, outPath) {
  const a = fs.readFileSync(aPath).toString('base64');
  const b = fs.readFileSync(bPath).toString('base64');
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const res = await page.evaluate(async ([a, b, masks, tol]) => {
      const load = (src) => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = 'data:image/png;base64,' + src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const W = Math.max(ia.width, ib.width), H = Math.max(ia.height, ib.height);
      const draw = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; };
      const da = draw(ia), db = draw(ib);
      // Three layers: hard masks (clocks, live-count suffixes, declared additive region) are absolute;
      // the map-canvas mask has every UI overlay rect carved out, so surfaces painted over the map are compared.
      const maskMap = new Uint8Array(W * H);
      const canvasMask = new Uint8Array(W * H);
      const fill = (arr, m, v) => { for (let y = Math.max(0, m.y); y < Math.min(H, m.y + m.h); y++) for (let x = Math.max(0, m.x); x < Math.min(W, m.x + m.w); x++) arr[y * W + x] = v; };
      for (const m of masks) if (m.why === 'mask-map') fill(canvasMask, m, 1);
      for (const m of masks) if (m.why.startsWith('overlay:')) fill(canvasMask, m, 0);
      for (const m of masks) if (m.why !== 'mask-map' && !m.why.startsWith('overlay:')) fill(maskMap, m, 1);
      for (let i = 0; i < W * H; i++) if (canvasMask[i]) maskMap[i] = 1;
      const out = document.createElement('canvas'); out.width = W; out.height = H; const ox = out.getContext('2d');
      const od = ox.createImageData(W, H);
      let changed = 0, masked = 0, considered = 0; let minX = W, minY = H, maxX = -1, maxY = -1;
      const rows = new Uint32Array(H);
      for (let i = 0, p = 0; i < W * H; i++, p += 4) {
        const g = Math.round(0.3 * da[p] + 0.59 * da[p + 1] + 0.11 * da[p + 2]) * 0.35 + 40;
        od.data[p] = g; od.data[p + 1] = g; od.data[p + 2] = g; od.data[p + 3] = 255;
        if (maskMap[i]) { masked++; od.data[p] = 40; od.data[p + 1] = 60; od.data[p + 2] = 120; continue; }
        considered++;
        const d = Math.max(Math.abs(da[p] - db[p]), Math.abs(da[p + 1] - db[p + 1]), Math.abs(da[p + 2] - db[p + 2]), Math.abs(da[p + 3] - db[p + 3]));
        if (d > tol) { changed++; od.data[p] = 255; od.data[p + 1] = 40; od.data[p + 2] = 40; const x = i % W, y = (i - x) / W; rows[y]++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      ox.putImageData(od, 0, 0);
      // Row histogram -> horizontal bands of change (helps describe "what moved").
      const bands = []; let start = -1;
      for (let y = 0; y <= H; y++) { const on = y < H && rows[y] > 0; if (on && start < 0) start = y; if (!on && start >= 0) { bands.push({ fromY: start, toY: y - 1 }); start = -1; } }
      return { width: W, height: H, sameSize: ia.width === ib.width && ia.height === ib.height, changed, masked, considered,
        changedPct: considered ? (100 * changed / considered) : 0, bbox: changed ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
        bands: bands.slice(0, 40), bandCount: bands.length, png: out.toDataURL('image/png').split(',')[1] };
    }, [a, b, masks, CHANNEL_TOLERANCE]);
    fs.writeFileSync(outPath, Buffer.from(res.png, 'base64'));
    delete res.png;
    return res;
  } finally { await context.close(); }
}

function countMasks(masks) { const c = {}; for (const m of masks || []) { const k = m.why.split(':')[0]; c[k] = (c[k] || 0) + 1; } return c; }

function diffGeometry(ga, gb, additiveSelectors) {
  const diffs = []; const additive = []; let compared = 0;
  const names = new Set([...Object.keys(ga.surfaces), ...Object.keys(gb.surfaces)]);
  for (const name of names) {
    const a = ga.surfaces[name], b = gb.surfaces[name];
    if (!a || !b) { diffs.push({ surface: name, kind: 'missing-record' }); continue; }
    if (a.present !== b.present) { diffs.push({ surface: name, kind: 'presence', baseline: a.present, candidate: b.present }); continue; }
    if (!a.present) continue;
    compared++;
    if (a.count !== b.count) diffs.push({ surface: name, kind: 'count', baseline: a.count, candidate: b.count });
    for (const k of ['x', 'y', 'width', 'height']) {
      const d = Math.abs((a.rect?.[k] ?? 0) - (b.rect?.[k] ?? 0));
      if (d > GEOMETRY_TOLERANCE) diffs.push({ surface: name, kind: 'rect.' + k, baseline: a.rect[k], candidate: b.rect[k], delta: Math.round((b.rect[k] - a.rect[k]) * 100) / 100 });
    }
    for (const p of Object.keys(a.styles || {})) if (a.styles[p] !== b.styles?.[p]) diffs.push({ surface: name, kind: 'style.' + p, baseline: a.styles[p], candidate: b.styles[p] });
    if (a.childCount !== b.childCount) diffs.push({ surface: name, kind: 'childCount', baseline: a.childCount, candidate: b.childCount });
    if ((a.hidden || null) !== (b.hidden || null)) diffs.push({ surface: name, kind: 'hidden', baseline: a.hidden, candidate: b.hidden });
    if (a.text !== b.text) {
      const strip = (s) => s.replace(/\[[^\]]*\]/g, '[]').replace(/\d{2}:\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}|\d+ DAYS/g, '#');
      if (strip(a.text) !== strip(b.text)) diffs.push({ surface: name, kind: 'text', baseline: a.text, candidate: b.text });
    }
    if (a.inventory || b.inventory) {
      const ia = a.inventory || {}, ib = b.inventory || {};
      for (const k of ['groupCount', 'inputs', 'engine', 'pipeline', 'proxies', 'weather']) if (ia[k] !== ib[k]) diffs.push({ surface: name, kind: 'inventory.' + k, baseline: ia[k], candidate: ib[k] });
      if (JSON.stringify(ia.groups) !== JSON.stringify(ib.groups)) diffs.push({ surface: name, kind: 'inventory.groups', baseline: ia.groups, candidate: ib.groups });
      if (JSON.stringify(ia.firstRows) !== JSON.stringify(ib.firstRows)) diffs.push({ surface: name, kind: 'inventory.firstRows', baseline: ia.firstRows, candidate: ib.firstRows });
    }
  }
  const docA = ga.document || {}, docB = gb.document || {};
  for (const k of ['htmlClass', 'bodyClass', 'engineControls', 'pipelineControls', 'proxies', 'scadaCollapsed', 'fullscreenElement']) {
    if (JSON.stringify(docA[k]) !== JSON.stringify(docB[k])) diffs.push({ surface: 'document', kind: k, baseline: docA[k], candidate: docB[k] });
  }
  if (docB.weather) additive.push({ weather: { installed: docB.weather.installed, status: docB.weather.status, controls: docB.weather.controls } });
  if (docB.ukLightning) additive.push({ ukLightning: docB.ukLightning });
  // visual-challenge-B classification. A container that HOSTS the appended lightning group legitimately gains a child,
  // an inventory entry and text (additive-host, expected, listed but not failed). Any rect/style change of any
  // surface, and any change on a non-host surface, is an ORIGINAL difference and fails the cell.
  const HOSTS = new Set(['scada-ui-container', 'fs-curtain-keys', 'menu-panel-Grid']);
  const HOST_KINDS = /^(childCount|inventory\.(groupCount|inputs|groups|lightning)|text|count)$/;
  for (const d of diffs) d.class = (HOSTS.has(d.surface) && HOST_KINDS.test(d.kind)) ? 'additive-host' : 'original';
  // a host that is not a scroll container grows by the appended group's height (x/y/width unchanged): additive-host growth
  for (const d of diffs) if (d.class === 'original' && d.kind === 'rect.height' && HOSTS.has(d.surface) && d.delta > 0
    && !diffs.some(o => o.surface === d.surface && /^rect\.(x|y|width)$/.test(o.kind))) d.class = 'additive-host';
  const originalDiffs = diffs.filter(d => d.class === 'original');
  return { compared, diffs, originalDiffs, additiveHostDiffs: diffs.length - originalDiffs.length, additive };
}

// ---------------------------------------------------------------- MAIN ---------
const logLines = [];
const log = (s) => { const line = `[${nowIso()}] ${s}`; logLines.push(line); console.log(line); };
const maskSelectors = ['#clock', '#date', '#days', ...args.mask];
const additiveSelectors = args.additive;
const browser = await chromium.launch({ headless: true });
log(`chromium ${browser.version()} | out=${OUT} | shim=${SHIM_PATH || 'none'} | fixtures=${FIXTURES || 'none'} | threshold=${THRESHOLD_PCT}% channel>${CHANNEL_TOLERANCE} | geometry tol=${GEOMETRY_TOLERANCE}px`);
log(`masks=${JSON.stringify(maskSelectors)}${SUFFIX_MASK ? ' + live-count suffixes (--suffix-mask)' : ' (NO live-count suffix mask)'}${MASK_MAP ? ' + map canvas (.maplibregl-canvas)' : ''}; additive=${JSON.stringify(additiveSelectors)}`);
let exitCode = 0;
try {
  if (args.capture) {
    const r = await captureRoute(browser, { label: args.label || 'capture', baseUrl: args.capture, additiveSelectors, maskSelectors, maskMap: MASK_MAP, log });
    log('capture complete: ' + path.join(OUT, r.label));
  } else {
    const baseline = await captureRoute(browser, { label: args['label-baseline'] || 'baseline', baseUrl: args.baseline, additiveSelectors: [], maskSelectors, maskMap: MASK_MAP, log });
    const candidate = await captureRoute(browser, { label: args['label-candidate'] || 'candidate', baseUrl: args.candidate, additiveSelectors, maskSelectors, maskMap: MASK_MAP, log });
    const summary = { startedAt: baseline.startedAt, baseline: args.baseline, candidate: args.candidate, thresholdPct: THRESHOLD_PCT, channelTolerance: CHANNEL_TOLERANCE,
      geometryTolerancePx: GEOMETRY_TOLERANCE, shim: SHIM_PATH, lightningDataDir: LIGHTNING_DATA_DIR || null, fixtures: FIXTURES, maskMap: MASK_MAP, masks: maskSelectors, additive: additiveSelectors, viewports: {}, verdict: 'PASS', failures: [] };
    const diffDir = path.join(OUT, 'diff'); fs.mkdirSync(diffDir, { recursive: true });
    for (const vp of VIEWPORTS) {
      const vA = baseline.viewports[vp], vB = candidate.viewports[vp];
      const vrec = { states: {}, settleBaseline: vA.settle, settleCandidate: vB.settle, networkBaseline: vA.network?.byHost, networkCandidate: vB.network?.byHost };
      summary.viewports[vp] = vrec;
      if (!vA.settle?.menuInstalled || !vB.settle?.menuInstalled) {
        summary.failures.push({ viewport: vp, kind: 'BLOCKED_DEPENDENCY_OR_FAIL', detail: `menu bar installed: baseline=${vA.settle?.menuInstalled} candidate=${vB.settle?.menuInstalled}` });
      }
      for (const state of STATES) {
        const sA = vA.states[state], sB = vB.states[state];
        const srec = { noteBaseline: sA?.note, noteCandidate: sB?.note, pixel: null, geometry: null, pass: null };
        vrec.states[state] = srec;
        if (!sA?.screenshot || !sB?.screenshot || !sA.geometry || !sB.geometry) { srec.pass = false; srec.error = sA?.error || sB?.error || 'missing capture'; summary.failures.push({ viewport: vp, state, kind: 'capture-missing', detail: srec.error }); continue; }
        const masks = [...(sA.masks || []), ...(sB.masks || [])];
        const diffPng = path.join(diffDir, `${vp}.${state}.diff.png`);
        srec.pixel = await pixelDiff(browser, sA.screenshot, sB.screenshot, masks, diffPng);
        srec.pixel.diffPng = diffPng;
        srec.geometry = diffGeometry(sA.geometry, sB.geometry, additiveSelectors);
        srec.extras = (sA.extras && sB.extras) ? diffExtras(sA.extras, sB.extras) : { pass: false, error: 'extras missing' };
        srec.maskCounts = { baseline: countMasks(sA.masks), candidate: countMasks(sB.masks) };
        const pixelPass = srec.pixel.sameSize && srec.pixel.changedPct <= THRESHOLD_PCT;
        const geometryPass = srec.geometry.originalDiffs.length === 0;   // additive-host container diffs are listed, not failed
        const extrasPass = !!srec.extras.pass;
        srec.pass = pixelPass && geometryPass && extrasPass;
        if (!srec.pass) {
          summary.verdict = 'FAIL';
          summary.failures.push({ viewport: vp, state, kind: !pixelPass ? 'pixel' : !geometryPass ? 'geometry' : 'extras', changedPct: Math.round(srec.pixel.changedPct * 1000) / 1000, geometryDiffs: srec.geometry.diffs.length, originalSurfaceDiffs: srec.geometry.originalDiffs.length,
            movedElements: srec.extras.movedElements?.length, styleChangedElements: srec.extras.styleChangedElements?.length, hitTargetDiffs: srec.extras.hitTargetDiffs?.length, scrollDiffs: srec.extras.scrollDiffs?.length,
            firstGeometryDiffs: srec.geometry.originalDiffs.slice(0, 6), firstMoved: (srec.extras.movedElements || []).slice(0, 6), hitTargetDiffList: srec.extras.hitTargetDiffs, scrollDiffList: srec.extras.scrollDiffs });
        }
        log(`DIFF ${vp}/${state}: pixels ${srec.pixel.changedPct.toFixed(3)}% (${srec.pixel.changed}/${srec.pixel.considered}, masked ${srec.pixel.masked}) surface diffs ${srec.geometry.originalDiffs.length} original + ${srec.geometry.additiveHostDiffs} additive-host | elements ${srec.extras.elementCountBaseline}/${srec.extras.elementCountCandidate} moved ${srec.extras.movedElements?.length} styleΔ ${srec.extras.styleChangedElements?.length} hitΔ ${srec.extras.hitTargetDiffs?.length} scrollΔ ${srec.extras.scrollDiffs?.length} styles-equal ${srec.extras.styleElementsEqual} -> ${srec.pass ? 'PASS' : 'FAIL'}`);
      }
    }
    if (summary.failures.some(f => f.kind === 'BLOCKED_DEPENDENCY_OR_FAIL') && summary.verdict === 'PASS') summary.verdict = 'BLOCKED';
    writeJson(path.join(OUT, 'summary.json'), summary);
    // Human-readable summary.
    const md = [];
    md.push(`# Parity run ${summary.startedAt}`, '', `baseline: ${summary.baseline}`, `candidate: ${summary.candidate}`, `offline shim: ${summary.shim || 'none'}${summary.lightningDataDir ? ' (lightningDataDir=' + summary.lightningDataDir + ')' : ''}`, `fixtures: ${summary.fixtures || 'none'}`,
      `threshold: ${THRESHOLD_PCT}% changed pixels (channel > ${CHANNEL_TOLERANCE}), geometry tolerance ${GEOMETRY_TOLERANCE}px`, `masks: ${maskSelectors.join(', ')}${SUFFIX_MASK ? ' + live-count suffixes' : ''}${MASK_MAP ? ' + map canvas' : ''}`, `additive: ${additiveSelectors.join(' | ') || 'none'}`, '',
      `suffix (live-count) mask: ${SUFFIX_MASK ? 'ON (--suffix-mask run)' : 'OFF (issue-32 mask list only)'}`, '',
      `## Verdict: ${summary.verdict}`, '', '| viewport | state | changed px | changed px % | bbox | surface diffs (original / additive-host) | elements (base/cand) | moved | styleΔ | hitΔ | scrollΔ | styles equal | masks (base) | result |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [vp, v] of Object.entries(summary.viewports)) for (const [st, s] of Object.entries(v.states)) {
      const e = s.extras || {};
      md.push(`| ${vp} | ${st} | ${s.pixel ? s.pixel.changed : 'n/a'} | ${s.pixel ? s.pixel.changedPct.toFixed(3) : 'n/a'} | ${s.pixel?.bbox ? `${s.pixel.bbox.x},${s.pixel.bbox.y} ${s.pixel.bbox.w}x${s.pixel.bbox.h}` : '-'} | ${s.geometry ? s.geometry.originalDiffs.length + ' / ' + s.geometry.additiveHostDiffs : 'n/a'} | ${e.elementCountBaseline ?? '?'}/${e.elementCountCandidate ?? '?'} | ${e.movedElements ? e.movedElements.length : '?'} | ${e.styleChangedElements ? e.styleChangedElements.length : '?'} | ${e.hitTargetDiffs ? e.hitTargetDiffs.length : '?'} | ${e.scrollDiffs ? e.scrollDiffs.length : '?'} | ${e.styleElementsEqual === undefined ? '?' : e.styleElementsEqual && e.styleLinksEqual} | ${s.maskCounts ? Object.entries(s.maskCounts.baseline).map(([k, n]) => k + ':' + n).join(' ') : ''} | ${s.pass === null ? 'n/a' : s.pass ? 'PASS' : 'FAIL'} |`);
    }
    md.push('', '## Geometry differences (first 12 per state)');
    for (const [vp, v] of Object.entries(summary.viewports)) for (const [st, s] of Object.entries(v.states)) {
      if (!s.geometry || !s.geometry.diffs.length) continue;
      md.push('', `### ${vp} / ${st}`);
      for (const d of s.geometry.diffs.slice(0, 12)) md.push(`- [${d.class}] ${d.surface} ${d.kind}: baseline=${JSON.stringify(d.baseline)} candidate=${JSON.stringify(d.candidate)}${d.delta !== undefined ? ' (Δ ' + d.delta + ')' : ''}`);
      if (s.geometry.diffs.length > 12) md.push(`- … ${s.geometry.diffs.length - 12} more`);
    }
    md.push('', '## Every-element, scroll-area and hit-target differences (first 12 per state)');
    for (const [vp, v] of Object.entries(summary.viewports)) for (const [st, s] of Object.entries(v.states)) {
      const e = s.extras; if (!e) continue;
      const any = e.signatureDivergence || e.movedElements?.length || e.additiveHostGrowth?.length || e.occluderChanged?.length || e.styleChangedElements?.length || e.scrollDiffs?.length || e.hitTargetDiffs?.length || !e.styleElementsEqual || !e.styleLinksEqual;
      if (!any) continue;
      md.push('', `### ${vp} / ${st}`);
      if (e.signatureDivergence) md.push(`- DOM-order divergence at index ${e.signatureDivergence.index}: baseline=${e.signatureDivergence.baseline} candidate=${e.signatureDivergence.candidate} ${e.signatureDivergence.note || ''}`);
      for (const m of (e.movedElements || []).slice(0, 12)) md.push(`- MOVED (original) #${m.index} ${m.sig}: baseline=[${m.baseline.join(',')}] candidate=[${m.candidate.join(',')}] Δ=${JSON.stringify(m.delta)}`);
      for (const m of (e.additiveHostGrowth || [])) md.push(`- additive-host growth (listed, not failed) #${m.index} ${m.sig}: height ${m.baseline[3]} -> ${m.candidate[3]} (Δ +${m.delta.height}; x/y/width unchanged; appended group at the end)`);
      for (const d of (e.occluderChanged || [])) md.push(`- occluded on both routes, occluder changed (listed, not failed): ${d.name} baseline=${d.baseline} candidate=${d.candidate}`);
      if ((e.movedElements || []).length > 12) md.push(`- … ${e.movedElements.length - 12} more moved elements`);
      for (const m of (e.styleChangedElements || []).slice(0, 6)) md.push(`- style #${m.index} ${m.sig}: baseline=${m.baseline} candidate=${m.candidate}`);
      for (const d of e.scrollDiffs || []) md.push(`- scroll ${d.selector} ${d.kind}: baseline=${d.baseline} candidate=${d.candidate}${d.delta !== undefined ? ' (Δ ' + d.delta + ')' : ''}`);
      for (const d of e.hitTargetDiffs || []) md.push(`- hit-target ${d.name} ${d.kind}${d.dynamicRow ? ' (dynamic row: identity follows the visible area)' : ''}: baseline=${JSON.stringify(d.baseline)}${d.baselineText ? ' "' + d.baselineText + '"' : ''} candidate=${JSON.stringify(d.candidate)}${d.candidateText ? ' "' + d.candidateText + '"' : ''}${d.candidateClippedBy ? ' clippedBy=' + JSON.stringify(d.candidateClippedBy) : ''}`);
      if (!e.styleElementsEqual) md.push(`- <style> inventory differs: ${JSON.stringify(e.styleElementsDiff)}`);
      if (!e.styleLinksEqual) md.push('- <link rel=stylesheet> inventory differs');
    }
    md.push('', '## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)');
    for (const [vp, v] of Object.entries(summary.viewports)) for (const [st, s] of Object.entries(v.states)) {
      const e = s.extras; if (!e || !e.hitTargetsPreexistingNotSelf?.length) continue;
      md.push(`- ${vp}/${st}: ` + e.hitTargetsPreexistingNotSelf.map(t => `${t.name}=${t.result}${t.clippedBy?.length ? ' clippedBy ' + t.clippedBy.join(' > ') : ''}`).join('; '));
    }
    md.push('', '## Candidate additive nodes and lightning toggle hit tests (P14), per state');
    for (const [vp, v] of Object.entries(summary.viewports)) for (const [st, s] of Object.entries(v.states)) {
      const e = s.extras; if (!e) continue;
      md.push(`- ${vp}/${st}: additive=${JSON.stringify((e.additiveNodes || []).map(n => `${n.sig} @${n.parent}[${n.indexInParent}/${n.siblings}] ${n.rect.x},${n.rect.y} ${n.rect.width}x${n.rect.height}`))} toggles=${JSON.stringify((e.lightningTargets || []).map(t => `${t.name}:${t.result}${t.clippedBy?.length ? ' clippedBy ' + t.clippedBy.join(' > ') : ''}`))}`);
    }
    fs.writeFileSync(path.join(OUT, 'SUMMARY.md'), md.join('\n') + '\n');
    log(`VERDICT ${summary.verdict} (${summary.failures.length} failure records) -> ${path.join(OUT, 'SUMMARY.md')}`);
    exitCode = summary.verdict === 'PASS' ? 0 : summary.verdict === 'BLOCKED' ? 2 : 1;
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'harness.log'), logLines.join('\n') + '\n');
}
process.exit(exitCode);
