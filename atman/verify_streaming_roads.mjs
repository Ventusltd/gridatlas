import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.GRIDATLAS_URL;
const expectedGeneration = process.env.EXPECTED_GENERATION;
const output = process.env.OUTPUT || 'work/streaming-road-proof.json';
if (!url || !expectedGeneration) throw new Error('GRIDATLAS_URL and EXPECTED_GENERATION are required');

const expected = new Map([
  ['motorways', { rows: 17713, path: '/uk_motorways.geojson' }],
  ['trunk_roads', { rows: 130228, path: '/uk_trunk_roads.geojson' }],
  ['primary_roads', { rows: 163790, path: '/uk_primary_roads.geojson' }],
]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', error => consoleErrors.push(String(error?.message || error)));

await page.goto(`${url}${url.includes('?') ? '&' : '?'}streaming-roads=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(generation => (
  window.__GRIDATLAS_ATLAS__?.generation === generation &&
  window.__GRIDATLAS_V9_MAP__ &&
  document.querySelectorAll('#scada-ui-container input[data-layer-id]').length > 0
), expectedGeneration, { timeout: 120000 });

const composition = await page.evaluate(() => window.__GRIDATLAS_ATLAS__);
if (JSON.stringify(composition.cartridge_order) !== JSON.stringify(['streaming-parquet-bridge', 'uk-gazetteer-flyto'])) {
  throw new Error(`unexpected cartridge order: ${JSON.stringify(composition.cartridge_order)}`);
}
await page.waitForFunction(() => {
  const state = window.__GRIDATLAS_MAP_READY__;
  return state?.runtime_prewarm?.completed === true || state?.runtime_prewarm?.failed;
}, null, { timeout: 120000 });
const prewarm = await page.evaluate(() => window.__GRIDATLAS_MAP_READY__?.runtime_prewarm);
if (!prewarm?.completed) throw new Error(`DuckDB runtime prewarm failed: ${JSON.stringify(prewarm)}`);

const results = [];
let failures = 0;
for (const [id, target] of expected) {
  const selector = `#scada-ui-container input[data-layer-id="${id}"]`;
  const exists = await page.locator(selector).count();
  if (exists !== 1) throw new Error(`${id}: expected one layer control, found ${exists}`);
  const started = performance.now();
  await page.locator(selector).check({ force: true });
  await page.waitForFunction(layerId => {
    const label = document.querySelector(`#lbl-${CSS.escape(layerId)}`)?.textContent || '';
    return /\[(OK|EMPTY|FAIL)\]/.test(label);
  }, id, { timeout: 60000 });
  const terminal = await page.evaluate(layerId => {
    const map = window.__GRIDATLAS_V9_MAP__;
    const mapLayer = map?.getLayer(`l-${layerId}`);
    const sourceId = mapLayer?.source || null;
    const label = document.querySelector(`#lbl-${CSS.escape(layerId)}`)?.textContent || '';
    return { sourceId, label };
  }, id);
  if (terminal.sourceId && terminal.label.includes('[OK]')) {
    await page.waitForFunction(sourceId => {
      try { return window.__GRIDATLAS_V9_MAP__?.isSourceLoaded(sourceId) === true; } catch { return false; }
    }, terminal.sourceId, { timeout: 60000 });
  }
  const seconds = (performance.now() - started) / 1000;
  const heapMb = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6;
  const state = await page.evaluate(({ layerId, pathname }) => {
    const map = window.__GRIDATLAS_V9_MAP__;
    const mapLayer = map?.getLayer(`l-${layerId}`);
    const sourceId = mapLayer?.source || null;
    let loaded = false;
    let rendered = 0;
    try {
      loaded = Boolean(sourceId && map.isSourceLoaded(sourceId));
      rendered = map.queryRenderedFeatures({ layers: [`l-${layerId}`] }).length;
    } catch {}
    const transport = window.__GRIDATLAS_MAP_READY__;
    const entry = Object.entries(transport?.loaded_on_demand || {}).find(([key]) => key.endsWith(pathname));
    return {
      sourceId,
      loaded,
      rendered,
      rows: entry?.[1]?.rows ?? -1,
      parquet: entry?.[1]?.parquet ?? null,
      streamedResponses: transport?.streamed_responses ?? -1,
      streamFailures: transport?.stream_failures || [],
      label: document.querySelector(`#lbl-${CSS.escape(layerId)}`)?.textContent || '',
    };
  }, { layerId: id, pathname: target.path });
  const bad = (
    !state.label.includes('[OK]') ||
    !state.loaded ||
    state.rows !== target.rows ||
    state.streamedResponses < 1 ||
    state.streamFailures.length > 0 ||
    seconds > 15 ||
    heapMb > 400
  );
  if (bad) failures += 1;
  results.push({ id, expected_rows: target.rows, seconds, heap_mb: heapMb, ...state, verdict: bad ? 'FAIL' : 'PASS' });
  await page.locator(selector).uncheck({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

const report = {
  schema: 'gridatlas.streaming-road-proof.v1',
  url,
  expected_generation: expectedGeneration,
  composition,
  runtime_prewarm: prewarm,
  results,
  console_errors: consoleErrors,
  failures,
  status: failures ? 'FAIL' : 'PASS',
};
await fs.mkdir(output.split('/').slice(0, -1).join('/') || '.', { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log('| layer | rows | loaded | seconds | heap MB | label | verdict |');
console.log('|---|---:|---:|---:|---:|---|---|');
for (const row of results) console.log(`| ${row.id} | ${row.rows} | ${row.loaded} | ${row.seconds.toFixed(1)} | ${row.heap_mb.toFixed(0)} | ${row.label.replaceAll('|', '/')} | ${row.verdict} |`);
await browser.close();
process.exit(failures ? 1 : 0);
