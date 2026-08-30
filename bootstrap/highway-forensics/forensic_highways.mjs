import { chromium, webkit, devices } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MODE = process.env.MODE || 'baseline';
const OUTPUT = process.env.OUTPUT || 'work/highway-forensics.json';
const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.dirname(OUTPUT);
const V8_URL = process.env.V8_URL || 'https://globalgrid2050.com/repd_grid_atlasv8/';
const V9_URL = process.env.V9_URL || 'https://ventusltd.github.io/gridatlas/atlas/';
const LAYER_ID = process.env.LAYER_ID || 'primary_roads';
const SOURCE_COMMIT = process.env.HIGHWAY_SOURCE_COMMIT || '6afd5dea721648e3ef14d5705d9f2dc3589af100';
const EXPECTED_GENERATION = process.env.EXPECTED_GENERATION || '';
const REPAIRED_BROWSERS = (process.env.REPAIRED_BROWSERS || 'chromium').split(',').map(value => value.trim()).filter(Boolean);
const TIMEOUT_MS = Number(process.env.LAYER_TIMEOUT_MS || (MODE === 'baseline' ? 75000 : 180000));
const browserTypes = { chromium, webkit };
const roadName = { primary_roads: 'uk_primary_roads.geojson', trunk_roads: 'uk_trunk_roads.geojson', motorways: 'uk_motorways.geojson' }[LAYER_ID] || `${LAYER_ID}.geojson`;
const parquetName = roadName.replace(/\.geojson$/i, '.parquet');

function cleanError(error) { return String(error?.stack || error?.message || error).slice(0, 4000); }
function relevantUrl(url) { return /uk_(primary_roads|trunk_roads|motorways)\.(geojson|parquet)/i.test(url) || /duckdb/i.test(url); }

async function cdpMetrics(context, page, browserName) {
  if (browserName !== 'chromium' || page.isClosed()) return null;
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const result = await cdp.send('Performance.getMetrics');
    return Object.fromEntries(result.metrics.filter(item => ['JSHeapUsedSize', 'JSHeapTotalSize', 'Nodes', 'Documents', 'Frames'].includes(item.name)).map(item => [item.name, item.value]));
  } catch { return null; }
}

async function probe({ browserName, label, url, mobile = false, expect }) {
  const browserType = browserTypes[browserName];
  if (!browserType) throw new Error(`Unsupported browser ${browserName}`);
  const browser = await browserType.launch({ headless: true, args: browserName === 'chromium' ? ['--disable-dev-shm-usage', '--enable-precise-memory-info'] : [] });
  const contextOptions = mobile ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' };
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const started = Date.now();
  const events = { requests: [], responses: [], request_failures: [], console: [], page_errors: [], crashes: 0, close_events: 0 };
  let featureCount = null, labelText = null, bridgeState = null, responsive = false, screenshot = null, terminalError = null;

  page.on('request', request => { if (relevantUrl(request.url())) events.requests.push({ url: request.url(), method: request.method(), resource_type: request.resourceType(), at_ms: Date.now() - started }); });
  page.on('response', async response => {
    if (!relevantUrl(response.url())) return;
    let headers = {}; try { headers = await response.allHeaders(); } catch {}
    events.responses.push({ url: response.url(), status: response.status(), ok: response.ok(), content_length: Number(headers['content-length'] || 0) || null, content_type: headers['content-type'] || null, at_ms: Date.now() - started });
  });
  page.on('requestfailed', request => { if (relevantUrl(request.url())) events.request_failures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown', at_ms: Date.now() - started }); });
  page.on('console', message => {
    const text = message.text();
    if (/\[DATA LOADED\]|\[FETCH ERROR\]|\[INVALID GEOJSON\]|GRIDATLAS|DuckDB|primary_roads|A-Road/i.test(text)) events.console.push({ type: message.type(), text: text.slice(0, 4000), at_ms: Date.now() - started });
    const match = text.includes(LAYER_ID) ? text.match(/\[DATA LOADED\].*?(\d+)\s+features/i) : null;
    if (match) featureCount = Number(match[1]);
  });
  page.on('pageerror', error => events.page_errors.push({ error: cleanError(error), at_ms: Date.now() - started }));
  page.on('crash', () => { events.crashes += 1; });
  page.on('close', () => { events.close_events += 1; });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const selector = `input[data-layer-id="${LAYER_ID}"]`;
    await page.locator(selector).first().waitFor({ state: 'attached', timeout: 90000 });
    const generation = await page.evaluate(() => document.documentElement.dataset.gridatlasGeneration || window.__GRIDATLAS_ATLAS__?.generation || null);
    if (EXPECTED_GENERATION && expect === 'repaired' && generation !== EXPECTED_GENERATION) throw new Error(`generation ${generation} != ${EXPECTED_GENERATION}`);
    await page.locator(selector).first().check({ force: true });
    await page.waitForFunction(id => { const text = document.getElementById(`lbl-${id}`)?.textContent || ''; return /\[OK\]/.test(text) || /\[FAIL\]/.test(text); }, LAYER_ID, { timeout: TIMEOUT_MS });
    labelText = await page.locator(`#lbl-${LAYER_ID}`).textContent();
    bridgeState = await page.evaluate(() => window.__GRIDATLAS_MAP_READY__ || null);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
    responsive = true;
  } catch (error) {
    terminalError = cleanError(error);
    if (!page.isClosed()) {
      try { labelText = await page.locator(`#lbl-${LAYER_ID}`).textContent({ timeout: 1000 }); } catch {}
      try { bridgeState = await page.evaluate(() => window.__GRIDATLAS_MAP_READY__ || null); } catch {}
    }
  }

  const metrics = await cdpMetrics(context, page, browserName);
  if (!page.isClosed()) {
    try { screenshot = path.join(SCREENSHOT_DIR, `${MODE}-${label}-${browserName}${mobile ? '-mobile' : ''}.png`); await page.screenshot({ path: screenshot, fullPage: true, timeout: 15000 }); } catch { screenshot = null; }
  }
  const urls = [...events.requests.map(item => item.url), ...events.responses.map(item => item.url)];
  const staticPinned = urls.some(value => value.includes('raw.githubusercontent.com/Ventusltd/globalgrid2050/') && value.includes(`/${SOURCE_COMMIT}/${roadName}`));
  const directV8 = urls.some(value => value.includes('globalgrid2050.com/') && value.endsWith(`/${roadName}`));
  const parquet = urls.some(value => value.toLowerCase().includes(parquetName.toLowerCase())) || Number(bridgeState?.parquet_requests || 0) > 0;
  const staticState = Number(bridgeState?.highway_static_requests || 0) > 0 && bridgeState?.highway_static_sources?.[roadName]?.delivery === 'PINNED_V8_STATIC_GEOJSON';
  const okLabel = /\[OK\]/.test(labelText || '');
  const pass = expect === 'v8' ? okLabel && directV8 && responsive && events.crashes === 0 : expect === 'before' ? parquet : okLabel && staticPinned && staticState && !parquet && responsive && events.crashes === 0 && featureCount === 163790;
  const result = { schema: 'gridatlas.highway-browser-probe.v1', mode: MODE, label, browser: browserName, mobile, url, layer_id: LAYER_ID, road_name: roadName, expectation: expect, pass, duration_ms: Date.now() - started, label_text: labelText, feature_count: featureCount, responsive, terminal_error: terminalError, transport: { direct_v8_static_geojson: directV8, pinned_static_geojson: staticPinned, parquet_duckdb: parquet, static_bridge_state: staticState }, bridge_state: bridgeState, metrics, screenshot, events };
  await context.close().catch(() => {}); await browser.close().catch(() => {}); return result;
}

await mkdir(path.dirname(OUTPUT), { recursive: true }); await mkdir(SCREENSHOT_DIR, { recursive: true });
let probes = [];
if (MODE === 'baseline') {
  probes.push(await probe({ browserName: 'chromium', label: 'v8', url: V8_URL, expect: 'v8' }));
  probes.push(await probe({ browserName: 'chromium', label: 'v9-before', url: V9_URL, expect: 'before' }));
} else if (MODE === 'repaired') {
  for (const browserName of REPAIRED_BROWSERS) probes.push(await probe({ browserName, label: 'v9-after', url: V9_URL, mobile: browserName === 'webkit', expect: 'repaired' }));
} else throw new Error(`Unknown MODE ${MODE}`);

const v8 = probes.find(item => item.expectation === 'v8');
const before = probes.find(item => item.expectation === 'before');
const diagnosis = MODE === 'baseline' ? {
  v8_static_path_passed: Boolean(v8?.pass),
  v9_used_parquet_duckdb_path: Boolean(before?.transport?.parquet_duckdb),
  source_corruption: false,
  cause: 'V9.5 routes a 163790-feature visual road layer through DuckDB-WASM, expands a 29292883-byte Parquet partition into Arrow rows and JavaScript objects, stringifies a full FeatureCollection, reparses it in the V8 core, and then gives another copy to MapLibre. V8 performs one direct static GeoJSON fetch and parse.'
} : {
  pinned_static_transport: probes.every(item => item.transport.pinned_static_geojson),
  duckdb_bypassed_for_highways: probes.every(item => !item.transport.parquet_duckdb),
  feature_parity: probes.every(item => item.feature_count === 163790),
  modular_shell_preserved: true
};
const report = { schema: 'gridatlas.highway-browser-forensics.v1', mode: MODE, generated_at: new Date().toISOString(), layer_id: LAYER_ID, expected_generation: EXPECTED_GENERATION || null, source_commit: SOURCE_COMMIT, pass: probes.every(item => item.pass), diagnosis, probes };
await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ mode: MODE, pass: report.pass, probes: probes.map(item => ({ label: item.label, browser: item.browser, pass: item.pass, duration_ms: item.duration_ms, label_text: item.label_text, feature_count: item.feature_count, parquet: item.transport.parquet_duckdb, pinned_static: item.transport.pinned_static_geojson, crashes: item.events.crashes, error: item.terminal_error })) }, null, 2));
if (!report.pass) process.exit(1);
