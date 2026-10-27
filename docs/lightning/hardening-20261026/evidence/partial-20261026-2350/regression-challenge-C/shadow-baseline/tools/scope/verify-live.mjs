import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, request } from 'playwright';

const BASE = String(process.env.GRIDATLAS_BASE_URL || 'https://ventusltd.github.io/gridatlas/').replace(/\/?$/, '/');

/* The composition this verifier expects the live surface to reach is READ from
   the composition this repository declares, never written down here.
   ------------------------------------------------------------------------
   It used to be a literal: generation 202608301624, composition_version v9.5.
   That was true on 2026-08-30 and false by the next cut. Measured against the
   live surface on 2026-09-03, thirty-odd generations later:

     live      generation 202609030234  v9.88
     literal   generation 202608301624  v9.5     -> can never match again

   So waitForDeployedCurrent could only ever spend four minutes polling and
   then throw. That is why state/live-set.json still carries
   verified_at 2026-08-30T04:07:46Z while its atlas_composition pointer was
   restamped on every one of those generations: the attestation is not stale
   because nobody ran the verifier, it is stale because the verifier could not
   pass. An expectation that has to be edited by hand on every cut will be
   wrong by the second one.

   fileURLToPath, never new URL().pathname: on Windows the latter yields
   "/C:/Users/..." and join() then produces "C:\C:\Users\...". */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DECLARED = JSON.parse(fs.readFileSync(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const report = {
  schema: 'gridatlas.live-cartridge-verification.v1',
  base_url: BASE,
  status: 'RUNNING',
  deployed_current: null,
  tests: [],
  browser_console_errors: [],
  failure: null
};
let browser;
let page;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function stateSnapshot() {
  if (!page) return null;
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__GRIDATLAS_PLACE_SEARCH__ || null))).catch(() => null);
}

async function waitForDeployedCurrent() {
  const api = await request.newContext({ extraHTTPHeaders: { 'Cache-Control': 'no-cache' } });
  try {
    for (let attempt = 1; attempt <= 24; attempt += 1) {
      const response = await api.get(`${BASE}atlas/current.json?scope_verify=${Date.now()}`);
      if (response.ok()) {
        const current = await response.json();
        const sameOrder = Array.isArray(current?.cartridge_order)
          && JSON.stringify(current.cartridge_order) === JSON.stringify(DECLARED.cartridge_order);
        if (current?.schema === 'gridatlas.current.v2' && current?.generation === DECLARED.generation && current?.composition_version === DECLARED.composition_version && current?.scope_closure?.status === 'DONE' && sameOrder) {
          return current;
        }
        report.deployed_generation_seen = current?.generation ?? null;
      }
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
    /* Name both generations. "did not reach the composition" sent a previous
       reader looking for a broken deploy when the expectation was the thing
       that was wrong. */
    throw new Error(`public atlas/current.json did not reach the declared composition: expected ${DECLARED.generation} ${DECLARED.composition_version}, last saw ${report.deployed_generation_seen ?? 'nothing'}`);
  } finally {
    await api.dispose();
  }
}

async function record(name, action) {
  const entry = { name, status: 'RUNNING', state: null, url: null };
  report.tests.push(entry);
  try {
    await action(entry);
    entry.state = await stateSnapshot();
    entry.url = page.url();
    entry.status = 'PASS';
    console.log(JSON.stringify({ test: name, status: entry.status, url: entry.url, state: entry.state }));
  } catch (error) {
    entry.state = await stateSnapshot();
    entry.url = page?.url() || null;
    entry.status = 'FAIL';
    entry.message = String(error?.message || error);
    console.error(JSON.stringify({ test: name, status: entry.status, message: entry.message, url: entry.url, state: entry.state }));
    throw error;
  }
}

async function run() {
  report.deployed_current = await waitForDeployedCurrent();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') report.browser_console_errors.push(message.text());
  });
  page.on('pageerror', error => report.browser_console_errors.push(String(error?.message || error)));

  await record('exact REPD deep link remains automatic', async () => {
    await page.goto(`${BASE}atlas/?repd_ref=13599`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.status === 'RESOLVED', null, { timeout: 120_000 });
    const result = await page.evaluate(() => ({
      deep_link: JSON.parse(JSON.stringify(window.__GRIDATLAS_PLACE_SEARCH__.deep_link)),
      selection: JSON.parse(JSON.stringify(window.__GRIDATLAS_PLACE_SEARCH__.last_selection)),
      atlas: JSON.parse(JSON.stringify(window.__GRIDATLAS_ATLAS__))
    }));
    invariant(result.deep_link.repd_ref === '13599' && result.deep_link.mapped === true, 'exact REPD 13599 did not map');
    invariant(result.selection?.repd_ref === '13599', 'exact REPD selection was not retained');
    invariant(new URL(page.url()).searchParams.get('repd_ref') === '13599', 'exact REPD URL identity missing');
  });

  await record('SW1A 1AA flies to a LOCATION_ONLY postcode', async () => {
    const input = page.locator('#search-input');
    await input.fill('SW1A 1AA');
    await page.locator('#search-btn').click();
    const result = page.locator('.search-result-item[data-location-kind="postcode"]').first();
    await result.waitFor({ state: 'visible', timeout: 60_000 });
    await result.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'postcode' && window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection.mapped === true, null, { timeout: 30_000 });
    invariant(!new URL(page.url()).searchParams.has('repd_ref'), 'postcode selection retained repd_ref');
    const selected = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection)));
    invariant(String(selected.label).replace(/\s/g, '').toUpperCase() === 'SW1A1AA', `unexpected postcode selection ${selected.label}`);
  });

  await record('Truro town result flies to a LOCATION_ONLY place', async () => {
    const input = page.locator('#search-input');
    await input.fill('Truro');
    await page.locator('#search-btn').click();
    const result = page.locator('.search-result-item[data-location-kind="place"]').filter({ hasText: 'Truro' }).first();
    await result.waitFor({ state: 'visible', timeout: 60_000 });
    await result.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_location_selection?.kind === 'place' && window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection.mapped === true, null, { timeout: 30_000 });
    invariant(!new URL(page.url()).searchParams.has('repd_ref'), 'town selection set repd_ref');
    const selected = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GRIDATLAS_PLACE_SEARCH__.last_location_selection)));
    invariant(/truro/i.test(selected.label), `unexpected place selection ${selected.label}`);
  });

  await record('known REPD project stays first and sets exact identity', async () => {
    const input = page.locator('#search-input');
    await input.fill('Beacon Fen Energy Park');
    await page.locator('#search-btn').click();
    const exact = page.locator('.search-result-item[data-repd-ref="13599"]').first();
    await exact.waitFor({ state: 'visible', timeout: 60_000 });
    const firstIdentity = await page.locator('.search-result-item').first().getAttribute('data-repd-ref');
    invariant(firstIdentity === '13599', `REPD result was not first; first identity=${firstIdentity}`);
    await exact.click();
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_selection?.repd_ref === '13599', null, { timeout: 30_000 });
    invariant(new URL(page.url()).searchParams.get('repd_ref') === '13599', 'REPD project click did not set repd_ref');
  });

  await record('blocked postcodes.io leaves REPD search operational', async () => {
    await page.route('https://api.postcodes.io/**', route => route.abort('failed'));
    await page.evaluate(() => { window.__GRIDATLAS_PLACE_SEARCH__.geocoder_failures.length = 0; });
    const input = page.locator('#search-input');
    await input.fill('Beacon Fen Energy Park');
    await page.locator('#search-btn').click();
    const exact = page.locator('.search-result-item[data-repd-ref="13599"]').first();
    await exact.waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.geocoder_failures?.length > 0, null, { timeout: 30_000 });
    const state = await page.evaluate(() => JSON.parse(JSON.stringify(window.__GRIDATLAS_PLACE_SEARCH__)));
    invariant(state.geocoder_failures.length > 0, 'blocked geocoder failure was not recorded');
    invariant(await exact.isVisible(), 'REPD result disappeared when geocoder failed');
  });

  report.status = 'PASS';
}

function writeReport() {
  const generation = report.deployed_current?.scope_closure?.generation || report.deployed_current?.generation || 'unknown';
  const output = path.join(process.cwd(), 'reports', 'scope-loop', `${generation}-live-verification.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`report=${path.relative(process.cwd(), output)}`);
}

try {
  await run();
} catch (error) {
  report.status = 'FAIL';
  report.failure = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  writeReport();
}
