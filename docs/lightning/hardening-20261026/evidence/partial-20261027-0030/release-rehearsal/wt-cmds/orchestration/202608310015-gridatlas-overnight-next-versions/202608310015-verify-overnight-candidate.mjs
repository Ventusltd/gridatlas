import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = String(process.env.GRIDATLAS_URL || '').replace(/\/?$/, '/');
const expectedGeneration = String(process.env.EXPECTED_GENERATION || '');
const expectedSearchGeneration = String(process.env.EXPECTED_SEARCH_GENERATION || '');
const output = String(process.env.OUTPUT || 'work/202608310015-gridatlas-overnight-candidate-proof.json');
const screenshot = String(process.env.SCREENSHOT || output.replace(/\.json$/, '.png'));
if (!base || !expectedGeneration) throw new Error('GRIDATLAS_URL and EXPECTED_GENERATION are required');

const expectedRoads = new Map([
  ['motorways', { rows: 17713, path: '/uk_motorways.geojson' }],
  ['trunk_roads', { rows: 130228, path: '/uk_trunk_roads.geojson' }],
  ['primary_roads', { rows: 163790, path: '/uk_primary_roads.geojson' }]
]);

const proof = {
  schema: 'gridatlas.overnight-candidate-browser-proof.v1',
  tested_at: new Date().toISOString(),
  url: base,
  expected_generation: expectedGeneration,
  expected_search_generation: expectedSearchGeneration,
  status: 'RUNNING',
  hard_failures: 0,
  soft_failures: 0,
  tests: [],
  console_errors: [],
  page_errors: [],
  runtime: null
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function record(name, severity, action) {
  const row = { name, severity, status: 'RUNNING', started_at: new Date().toISOString() };
  proof.tests.push(row);
  try {
    row.evidence = await action();
    row.status = 'PASS';
  } catch (error) {
    row.status = severity === 'soft' ? 'SOFT_FAIL' : 'FAIL';
    row.error = String(error?.stack || error);
    if (severity === 'soft') proof.soft_failures += 1;
    else proof.hard_failures += 1;
  }
  row.finished_at = new Date().toISOString();
  console.log(JSON.stringify({ test: name, severity, status: row.status, error: row.error || null }));
  return row;
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
page.on('console', message => {
  if (message.type() === 'error') proof.console_errors.push(message.text());
});
page.on('pageerror', error => proof.page_errors.push(String(error?.message || error)));

async function waitCompositionReady() {
  await page.waitForFunction(({ generation, searchGeneration }) => {
    const atlas = window.__GRIDATLAS_ATLAS__;
    const search = window.__GRIDATLAS_PLACE_SEARCH__;
    return atlas?.generation === generation &&
      window.__GRIDATLAS_V9_MAP__ &&
      search?.ready === true &&
      (!searchGeneration || search.generation === searchGeneration);
  }, { generation: expectedGeneration, searchGeneration: expectedSearchGeneration }, { timeout: 120_000 });
}

async function openCandidate(search = '') {
  const separator = search ? (search.startsWith('?') ? '' : '?') : '?';
  const suffix = search ? `${separator}${search.replace(/^\?/, '')}&proof=${Date.now()}` : `?proof=${Date.now()}`;
  await page.goto(`${base}${suffix}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitCompositionReady();
}

async function submitQuery(text, { sequential = false } = {}) {
  const input = page.locator('#search-input');
  await input.waitFor({ state: 'visible', timeout: 30_000 });
  await input.fill('');
  if (sequential) await input.pressSequentially(text, { delay: 220 });
  else await input.fill(text);
  await input.press('Enter');
  await page.waitForFunction(expected => window.__GRIDATLAS_PLACE_SEARCH__?.last_query === expected, text, { timeout: 120_000 });
  await page.locator('#search-results').waitFor({ state: 'visible', timeout: 120_000 });
}

await record('composition loads frozen shell and required cartridges', 'hard', async () => {
  await openCandidate();
  const state = await page.evaluate(() => ({
    atlas: window.__GRIDATLAS_ATLAS__,
    search_generation: window.__GRIDATLAS_PLACE_SEARCH__?.generation,
    search_ready: window.__GRIDATLAS_PLACE_SEARCH__?.ready,
    map_ready: Boolean(window.__GRIDATLAS_V9_MAP__)
  }));
  const order = state.atlas?.cartridge_order || [];
  invariant(state.atlas?.generation === expectedGeneration, 'candidate composition generation mismatch');
  invariant(state.map_ready, 'map object missing');
  invariant(state.search_ready, 'search cartridge not ready');
  if (expectedSearchGeneration) invariant(state.search_generation === expectedSearchGeneration, 'search cartridge generation mismatch');
  invariant(order.includes('streaming-parquet-bridge'), 'streaming road cartridge missing');
  invariant(order.includes('uk-gazetteer-flyto'), 'search cartridge missing');
  invariant(order.indexOf('streaming-parquet-bridge') < order.indexOf('uk-gazetteer-flyto'), 'required cartridge order reversed');
  return state;
});

await record('direct repd_ref=13599 resolves Beacon Fen', 'hard', async () => {
  await openCandidate('repd_ref=13599');
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.status === 'RESOLVED', null, { timeout: 120_000 });
  await page.locator('.maplibregl-popup-content').filter({ hasText: 'Beacon Fen Energy Park' }).waitFor({ state: 'visible', timeout: 30_000 });
  const state = await page.evaluate(() => ({
    deep_link: window.__GRIDATLAS_PLACE_SEARCH__?.deep_link,
    selection: window.__GRIDATLAS_PLACE_SEARCH__?.last_selection,
    url: location.href,
    popup: document.querySelector('.maplibregl-popup-content')?.textContent || ''
  }));
  invariant(state.deep_link?.repd_ref === '13599' && state.deep_link?.mapped === true, 'deep link did not map');
  invariant(new URL(state.url).searchParams.get('repd_ref') === '13599', 'repd_ref was lost');
  invariant(state.popup.includes('Beacon Fen Energy Park'), 'Beacon Fen popup missing');
  return state;
});

await record('Beacon Fen search is REPD-first and sets identity', 'hard', async () => {
  await openCandidate();
  await submitQuery('Beacon Fen');
  const exact = page.locator('.search-result-item[data-repd-ref="13599"]').first();
  await exact.waitFor({ state: 'visible', timeout: 60_000 });
  const firstRef = await page.locator('.search-result-item').first().getAttribute('data-repd-ref');
  invariant(firstRef === '13599', `first result was ${firstRef || 'missing'}`);
  await exact.click();
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_selection?.repd_ref === '13599', null, { timeout: 30_000 });
  const state = await page.evaluate(() => ({ selection: window.__GRIDATLAS_PLACE_SEARCH__?.last_selection, url: location.href }));
  invariant(new URL(state.url).searchParams.get('repd_ref') === '13599', 'Beacon Fen selection did not set repd_ref');
  return state;
});

await record('SW1A 1AA remains LOCATION_ONLY', 'soft', async () => {
  await openCandidate();
  await submitQuery('SW1A 1AA', { sequential: true });
  const postcode = page.locator('.search-result-item[data-location-kind="postcode"]').first();
  await postcode.waitFor({ state: 'visible', timeout: 90_000 });
  await page.waitForTimeout(2500);
  invariant(await postcode.isVisible(), 'postcode result was overwritten');
  await postcode.click();
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'postcode' && window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.mapped === true, null, { timeout: 30_000 });
  const state = await page.evaluate(() => ({
    location: window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection,
    popup: document.querySelector('.maplibregl-popup-content')?.textContent || '',
    url: location.href
  }));
  invariant(!new URL(state.url).searchParams.has('repd_ref'), 'postcode claimed project identity');
  invariant(state.popup.includes('Location only') && state.popup.includes('postcodes.io'), 'postcode provenance missing');
  return state;
});

await record('Truro flies as a UK location', 'soft', async () => {
  await submitQuery('Truro');
  const result = page.locator('.search-result-item[data-location-kind="place"]').filter({ hasText: 'Truro' }).first();
  await result.waitFor({ state: 'visible', timeout: 90_000 });
  await result.click();
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'place' && window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.mapped === true, null, { timeout: 30_000 });
  const state = await page.evaluate(() => ({ location: window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection, url: location.href }));
  invariant(/truro/i.test(state.location?.label || ''), 'Truro label missing');
  invariant(!new URL(state.url).searchParams.has('repd_ref'), 'Truro claimed project identity');
  return state;
});

await record('Oxford, England, UK flies without identity', 'soft', async () => {
  await submitQuery('Oxford, England, UK');
  const result = page.locator('.search-result-item[data-location-kind]').filter({ hasText: 'Oxford' }).first();
  await result.waitFor({ state: 'visible', timeout: 90_000 });
  await result.click();
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.mapped === true, null, { timeout: 30_000 });
  const state = await page.evaluate(() => ({ location: window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection, url: location.href }));
  invariant(state.location.latitude > 51.5 && state.location.latitude < 52.0, 'Oxford latitude out of range');
  invariant(state.location.longitude > -1.6 && state.location.longitude < -0.8, 'Oxford longitude out of range');
  invariant(!new URL(state.url).searchParams.has('repd_ref'), 'Oxford claimed project identity');
  return state;
});

await record('Delhi flies through Nominatim', 'soft', async () => {
  await submitQuery('Delhi');
  const result = page.locator('.search-result-item[data-location-kind="global_place"]').filter({ hasText: 'Delhi' }).first();
  await result.waitFor({ state: 'visible', timeout: 120_000 });
  await result.click();
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'global_place' && window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.mapped === true, null, { timeout: 30_000 });
  const state = await page.evaluate(() => ({ location: window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection, url: location.href }));
  invariant(state.location.latitude > 27.5 && state.location.latitude < 29.8, 'Delhi latitude out of range');
  invariant(state.location.longitude > 76.0 && state.location.longitude < 78.5, 'Delhi longitude out of range');
  invariant(state.location.provider === 'Nominatim / OpenStreetMap', 'unexpected global provider');
  invariant(!new URL(state.url).searchParams.has('repd_ref'), 'Delhi claimed project identity');
  return state;
});

await record('Parquet runtime prewarms after 400 kV readiness', 'hard', async () => {
  await openCandidate();
  await page.waitForFunction(() => document.querySelectorAll('#scada-ui-container input[data-layer-id]').length > 0, null, { timeout: 120_000 });
  await page.waitForFunction(() => {
    const state = window.__GRIDATLAS_MAP_READY__;
    return state?.runtime_prewarm?.completed === true || state?.runtime_prewarm?.failed;
  }, null, { timeout: 120_000 });
  const state = await page.evaluate(() => window.__GRIDATLAS_MAP_READY__?.runtime_prewarm);
  invariant(state?.completed === true, `runtime prewarm failed: ${JSON.stringify(state)}`);
  return state;
});

for (const [layerId, target] of expectedRoads) {
  await record(`${layerId} streams, loads and stays inside browser budgets`, 'hard', async () => {
    const selector = `#scada-ui-container input[data-layer-id="${layerId}"]`;
    const control = page.locator(selector);
    invariant(await control.count() === 1, `${layerId}: layer control missing`);
    if (await control.isChecked()) await control.uncheck({ force: true });
    const started = performance.now();
    await control.check({ force: true });
    await page.waitForFunction(id => {
      const label = document.querySelector(`#lbl-${CSS.escape(id)}`)?.textContent || '';
      return /\[(OK|EMPTY|FAIL)\]/.test(label);
    }, layerId, { timeout: 60_000 });
    const terminal = await page.evaluate(id => {
      const map = window.__GRIDATLAS_V9_MAP__;
      const mapLayer = map?.getLayer(`l-${id}`);
      return {
        source_id: mapLayer?.source || null,
        label: document.querySelector(`#lbl-${CSS.escape(id)}`)?.textContent || ''
      };
    }, layerId);
    if (terminal.source_id && terminal.label.includes('[OK]')) {
      await page.waitForFunction(sourceId => {
        try { return window.__GRIDATLAS_V9_MAP__?.isSourceLoaded(sourceId) === true; } catch { return false; }
      }, terminal.source_id, { timeout: 60_000 });
    }
    const seconds = (performance.now() - started) / 1000;
    await page.waitForTimeout(250);
    await cdp.send('HeapProfiler.collectGarbage');
    const heapMb = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6;
    const state = await page.evaluate(({ id, pathname }) => {
      const map = window.__GRIDATLAS_V9_MAP__;
      const mapLayer = map?.getLayer(`l-${id}`);
      const sourceId = mapLayer?.source || null;
      let loaded = false;
      let rendered = 0;
      try {
        loaded = Boolean(sourceId && map.isSourceLoaded(sourceId));
        rendered = map.queryRenderedFeatures({ layers: [`l-${id}`] }).length;
      } catch {}
      const transport = window.__GRIDATLAS_MAP_READY__;
      const entry = Object.entries(transport?.loaded_on_demand || {}).find(([key]) => key.endsWith(pathname));
      return {
        source_id: sourceId,
        loaded,
        rendered,
        rows: entry?.[1]?.rows ?? -1,
        parquet: entry?.[1]?.parquet ?? null,
        streamed_responses: transport?.streamed_responses ?? -1,
        released_payloads: transport?.released_payloads ?? -1,
        stream_failures: transport?.stream_failures || [],
        label: document.querySelector(`#lbl-${CSS.escape(id)}`)?.textContent || ''
      };
    }, { id: layerId, pathname: target.path });
    invariant(state.label.includes('[OK]'), `${layerId}: terminal label ${state.label}`);
    invariant(state.loaded, `${layerId}: source not loaded`);
    invariant(state.rows === target.rows, `${layerId}: ${state.rows} rows, expected ${target.rows}`);
    invariant(state.streamed_responses >= 1, `${layerId}: no streamed response recorded`);
    invariant(state.released_payloads >= state.streamed_responses, `${layerId}: payload cache not released`);
    invariant(state.stream_failures.length === 0, `${layerId}: stream failures present`);
    invariant(seconds <= 15, `${layerId}: ${seconds.toFixed(2)}s exceeded 15s`);
    invariant(heapMb <= 400, `${layerId}: ${heapMb.toFixed(1)}MB exceeded 400MB`);
    await control.uncheck({ force: true }).catch(() => {});
    return { layer_id: layerId, expected_rows: target.rows, seconds, heap_mb: heapMb, ...state };
  });
}

proof.runtime = await page.evaluate(() => ({
  atlas: window.__GRIDATLAS_ATLAS__ || null,
  search: window.__GRIDATLAS_PLACE_SEARCH__ || null,
  transport: window.__GRIDATLAS_MAP_READY__ || null,
  ready_state: document.readyState
})).catch(() => null);
proof.status = proof.hard_failures > 0
  ? 'FAIL'
  : proof.soft_failures > 0
    ? 'CORE_PASS_EXTERNAL_UNAVAILABLE'
    : 'PASS';

await ensureParent(output);
await ensureParent(screenshot);
await page.screenshot({ path: screenshot, fullPage: true }).catch(error => {
  proof.screenshot_error = String(error?.message || error);
});
await fs.writeFile(output, `${JSON.stringify(proof, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({ status: proof.status, hard_failures: proof.hard_failures, soft_failures: proof.soft_failures, output, screenshot }));
process.exit(proof.hard_failures > 0 ? 1 : 0);
