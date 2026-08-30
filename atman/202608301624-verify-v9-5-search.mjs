import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = String(process.env.GRIDATLAS_URL || 'http://127.0.0.1:4173/gridatlas/atlas/');
const output = process.env.OUTPUT || 'work/202608301624-v9-5-search-proof.json';
const expectedCompositionGeneration = process.env.EXPECTED_GENERATION || '202608301624';
const expectedSearchGeneration = process.env.EXPECTED_SEARCH_GENERATION || '202608301624';

const proof = {
  schema: 'gridatlas.v9-5-global-search-proof.v2',
  composition_generation: expectedCompositionGeneration,
  search_cartridge_generation: expectedSearchGeneration,
  url: base,
  status: 'RUNNING',
  tests: [],
  console_errors: [],
  failure: null
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitReady(page) {
  await page.waitForFunction(expected => {
    const search = window.__GRIDATLAS_PLACE_SEARCH__;
    const atlas = window.__GRIDATLAS_ATLAS__;
    return search?.ready === true &&
      search?.generation === expected.search &&
      atlas?.generation === expected.composition &&
      atlas?.loaded_cartridges?.some(item => item.id === 'uk-gazetteer-flyto') &&
      window.__GRIDATLAS_V9_MAP__;
  }, { composition: expectedCompositionGeneration, search: expectedSearchGeneration }, { timeout: 120_000 });
}

async function record(name, action) {
  const row = { name, status: 'RUNNING' };
  proof.tests.push(row);
  try {
    row.evidence = await action();
    row.status = 'PASS';
    console.log(JSON.stringify({ test: name, status: 'PASS', evidence: row.evidence }));
  } catch (error) {
    row.status = 'FAIL';
    row.message = String(error?.message || error);
    throw error;
  }
}

async function cleanPage(page) {
  await page.goto(`${base}?proof=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitReady(page);
}

async function query(page, text, { sequential = false } = {}) {
  const input = page.locator('#search-input');
  await input.fill('');
  if (sequential) await input.pressSequentially(text, { delay: 220 });
  else await input.fill(text);
  await input.press('Enter');
  await page.waitForFunction(expected => window.__GRIDATLAS_PLACE_SEARCH__?.last_query === expected, text, { timeout: 120_000 });
  await page.locator('#search-results').waitFor({ state: 'visible', timeout: 120_000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on('console', message => {
  if (message.type() === 'error') proof.console_errors.push(message.text());
});
page.on('pageerror', error => proof.console_errors.push(String(error?.message || error)));

try {
  await record('composition retains the independently versioned search cartridge', async () => {
    await cleanPage(page);
    const state = await page.evaluate(() => ({
      atlas: window.__GRIDATLAS_ATLAS__,
      search_generation: window.__GRIDATLAS_PLACE_SEARCH__?.generation,
      search_ready: window.__GRIDATLAS_PLACE_SEARCH__?.ready
    }));
    invariant(state.atlas.generation === expectedCompositionGeneration, 'composition generation mismatch');
    invariant(state.search_generation === expectedSearchGeneration, 'search cartridge generation mismatch');
    invariant(state.search_ready === true, 'search cartridge is not ready');
    invariant(state.atlas.loaded_cartridges.some(item => item.id === 'uk-gazetteer-flyto'), 'search cartridge is not loaded');
    return state;
  });

  await record('direct REPD 13599 deep link flies to Beacon Fen', async () => {
    await page.goto(`${base}?repd_ref=13599`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitReady(page);
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.status === 'RESOLVED', null, { timeout: 120_000 });
    await page.locator('.maplibregl-popup-content').filter({ hasText: 'Beacon Fen Energy Park' }).waitFor({ state: 'visible', timeout: 30_000 });
    const state = await page.evaluate(() => ({
      deep_link: window.__GRIDATLAS_PLACE_SEARCH__.deep_link,
      selection: window.__GRIDATLAS_PLACE_SEARCH__.last_selection,
      url: location.href
    }));
    invariant(state.deep_link.repd_ref === '13599' && state.deep_link.mapped === true, 'direct 13599 did not map');
    invariant(new URL(state.url).searchParams.get('repd_ref') === '13599', 'direct deep link lost identity');
    return state;
  });

  await record('SW1A 1AA typed character-by-character keeps final postcode result', async () => {
    await cleanPage(page);
    await query(page, 'SW1A 1AA', { sequential: true });
    const postcode = page.locator('.search-result-item[data-location-kind="postcode"]').first();
    await postcode.waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(3000);
    invariant(await postcode.isVisible(), 'final postcode was overwritten by a stale response');
    const kinds = await page.locator('.search-result-item[data-location-kind]').evaluateAll(items => items.map(item => item.dataset.locationKind));
    invariant(kinds[0] === 'postcode', `final location was ${kinds[0] || 'missing'}, not postcode`);
    invariant((await postcode.textContent() || '').includes('SW1A 1AA'), 'final visible postcode label is wrong');
    await postcode.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'postcode' && window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection.mapped === true, null, { timeout: 30_000 });
    const selected = await page.evaluate(() => ({
      location: window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection,
      popup: document.querySelector('.maplibregl-popup-content')?.textContent || '',
      url: location.href
    }));
    invariant(!new URL(selected.url).searchParams.has('repd_ref'), 'postcode selection claimed REPD identity');
    invariant(selected.popup.includes('Location only · postcodes.io · no project identity claimed'), 'postcode popup provenance is wrong');
    return { kinds, selected };
  });

  await record('Truro flies to a UK location', async () => {
    await query(page, 'Truro');
    const result = page.locator('.search-result-item[data-location-kind="place"]').filter({ hasText: 'Truro' }).first();
    await result.waitFor({ state: 'visible', timeout: 60_000 });
    await result.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'place' && window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection.mapped === true, null, { timeout: 30_000 });
    const selected = await page.evaluate(() => window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection);
    invariant(/truro/i.test(selected.label), `unexpected Truro label ${selected.label}`);
    invariant(!new URL(page.url()).searchParams.has('repd_ref'), 'Truro selection claimed REPD identity');
    return selected;
  });

  await record('Beacon Fen REPD 13599 is first and sets identity', async () => {
    await query(page, 'Beacon Fen');
    const exact = page.locator('.search-result-item[data-repd-ref="13599"]').first();
    await exact.waitFor({ state: 'visible', timeout: 60_000 });
    const firstRef = await page.locator('.search-result-item').first().getAttribute('data-repd-ref');
    invariant(firstRef === '13599', `first result is ${firstRef}, expected 13599`);
    await exact.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_selection?.repd_ref === '13599', null, { timeout: 30_000 });
    invariant(new URL(page.url()).searchParams.get('repd_ref') === '13599', 'Beacon Fen did not set repd_ref=13599');
    return await page.evaluate(() => window.__GRIDATLAS_PLACE_SEARCH__.last_selection);
  });

  await record('Oxford, England, UK flies without project identity', async () => {
    await query(page, 'Oxford, England, UK');
    const result = page.locator('.search-result-item[data-location-kind]').filter({ hasText: 'Oxford' }).first();
    await result.waitFor({ state: 'visible', timeout: 60_000 });
    await result.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.mapped === true, null, { timeout: 30_000 });
    const selected = await page.evaluate(() => window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection);
    invariant(selected.latitude > 51.5 && selected.latitude < 52.0, `Oxford latitude out of range ${selected.latitude}`);
    invariant(selected.longitude > -1.6 && selected.longitude < -0.8, `Oxford longitude out of range ${selected.longitude}`);
    invariant(!new URL(page.url()).searchParams.has('repd_ref'), 'Oxford selection claimed REPD identity');
    return selected;
  });

  await record('Delhi flies through the global gazetteer', async () => {
    await query(page, 'Delhi');
    const result = page.locator('.search-result-item[data-location-kind="global_place"]').filter({ hasText: 'Delhi' }).first();
    await result.waitFor({ state: 'visible', timeout: 90_000 });
    await result.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'global_place' && window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection.mapped === true, null, { timeout: 30_000 });
    const selected = await page.evaluate(() => window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection);
    invariant(selected.latitude > 27.5 && selected.latitude < 29.8, `Delhi latitude out of range ${selected.latitude}`);
    invariant(selected.longitude > 76.0 && selected.longitude < 78.5, `Delhi longitude out of range ${selected.longitude}`);
    invariant(selected.provider === 'Nominatim / OpenStreetMap', `unexpected global provider ${selected.provider}`);
    invariant(!new URL(page.url()).searchParams.has('repd_ref'), 'Delhi selection claimed REPD identity');
    return selected;
  });

  proof.status = 'PASS';
} catch (error) {
  proof.status = 'FAIL';
  proof.failure = String(error?.stack || error);
  proof.runtime_state = await page.evaluate(() => ({
    atlas: window.__GRIDATLAS_ATLAS__ || null,
    search: window.__GRIDATLAS_PLACE_SEARCH__ || null,
    transport: window.__GRIDATLAS_MAP_READY__ || null,
    ready_state: document.readyState
  })).catch(() => null);
  process.exitCode = 1;
} finally {
  await browser.close();
  await fs.mkdir(output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.', { recursive: true });
  await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify({ status: proof.status, tests: proof.tests.map(test => ({ name: test.name, status: test.status })), output }));
}