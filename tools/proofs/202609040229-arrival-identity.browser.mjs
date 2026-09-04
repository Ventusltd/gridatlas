import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require(path.resolve(ROOT, '..', '..', 'gridatlas-v9104-fullscreen',
    'node_modules', 'playwright'));
}
const { chromium } = playwright;
const CURRENT = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const GENERATION = CURRENT.generation;
const VIEWPORT = { width: 393, height: 852 };
const REPD_MANIFEST_URL =
  'https://ventusltd.github.io/gridatlas/data/repd_v9_manifest_202608290716.json';
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.parquet', 'application/octet-stream']
]);

const server = createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = requestPath.replace(/^\/+/, '') || 'index.html';
    let target = path.resolve(ROOT, relative);
    if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) {
      response.writeHead(403).end('outside repository');
      return;
    }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const bytes = await readFile(target);
    response.writeHead(200, {
      'content-type': MIME.get(path.extname(target).toLowerCase())
        || 'application/octet-stream',
      'cache-control': 'no-store', 'access-control-allow-origin': '*'
    });
    response.end(bytes);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const { port } = server.address();

const fixtures = [{
  label: 'supplied-point active-register absence', identity: 'NOT_IN_ACTIVE_REGISTER',
  verification: 'NOT_IN_ACTIVE_REGISTER', measures: true,
  query: { repd_ref: '12453', project: 'Thorpe Marsh Power Station - Battery Energy Storage',
    technology: 'bess', capacity_mw: '1450', latitude: '53.5802575',
    longitude: '-1.0850616', zoom: '12' }
}, {
  label: 'ref-only active-register absence', identity: 'NOT_IN_ACTIVE_REGISTER',
  verification: 'NOT_IN_ACTIVE_REGISTER', measures: false,
  query: { repd_ref: '12453' }
}, {
  label: 'failed owner retries to official match', identity: 'RESOLVED',
  verification: null, measures: true, retry: true,
  query: { repd_ref: '12588' }
}, {
  label: 'failed owner retries to active-register absence',
  identity: 'NOT_IN_ACTIVE_REGISTER', verification: 'NOT_IN_ACTIVE_REGISTER',
  measures: false, retry: true, query: { repd_ref: '12453' }
}, {
  label: 'official active-register match', identity: 'RESOLVED',
  verification: 'VERIFIED', measures: true,
  query: { repd_ref: '12588', project: 'Botley West, Botley - Botley West Solar Project',
    technology: 'solar', capacity_mw: '840', latitude: '51.8132088',
    longitude: '-1.3489728', zoom: '12' }
}];
const filter = String(process.env.GRIDATLAS_BROWSER_FIXTURE || '').trim();
const selected = filter ? fixtures.filter(({ label }) => label.includes(filter)) : fixtures;
assert.ok(selected.length, `no fixture matched GRIDATLAS_BROWSER_FIXTURE=${filter}`);

const browser = await chromium.launch({ headless: true });
const receipts = [];
try {
  for (const fixture of selected) {
    const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true,
      hasTouch: true, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const requestFailures = [];
    const requests = [];
    let manifestAttempts = 0;
    let beforeRetry = null;
    let inducedFailure = null;
    if (fixture.retry) {
      await page.route(REPD_MANIFEST_URL, async (route) => {
        manifestAttempts += 1;
        if (manifestAttempts === 1) await route.abort('failed');
        else await route.continue();
      });
    }
    page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('request', (request) => requests.push(request.url()));
    page.on('requestfailed', (request) => requestFailures.push({
      url: request.url(), error: request.failure()?.errorText || 'unknown'
    }));
    await page.addInitScript(() => {
      let value;
      const capture = (candidate) => {
        if (!candidate || typeof candidate.Map !== 'function'
            || candidate.Map.__gridatlasProofWrapped) return candidate;
        const OriginalMap = candidate.Map;
        function ProofMap(...args) {
          const instance = Reflect.construct(OriginalMap, args,
            new.target === ProofMap ? OriginalMap : new.target);
          window.__GRIDATLAS_PROOF_MAP__ = instance;
          return instance;
        }
        Object.setPrototypeOf(ProofMap, OriginalMap);
        ProofMap.prototype = OriginalMap.prototype;
        ProofMap.__gridatlasProofWrapped = true;
        candidate.Map = ProofMap;
        return candidate;
      };
      Object.defineProperty(window, 'maplibregl', { configurable: true, enumerable: true,
        get: () => value, set: (candidate) => { value = capture(candidate); } });
    });

    const url = `http://127.0.0.1:${port}/atlas/?${new URLSearchParams(fixture.query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction((generation) =>
      document.documentElement.dataset.gridatlasGeneration === generation,
    GENERATION, { timeout: 120_000 });
    await page.waitForFunction(() =>
      window.__GRIDATLAS_MODULES__?.menuBar?.installed === true
        && document.querySelectorAll('#gridatlas-menu-bar .gm-title').length === 6
        && window.__GRIDATLAS_PROOF_MAP__, null, { timeout: 120_000 });

    if (fixture.retry) {
      await page.waitForFunction(() =>
        window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.status === 'FAILED'
          && document.querySelector('#gridatlas-boot-status button')?.textContent.trim()
            === 'Try again', null, { timeout: 120_000 });
      beforeRetry = await page.evaluate(() => ({
        status: window.__GRIDATLAS_PLACE_SEARCH__.deep_link.status,
        epoch: window.__GRIDATLAS_PLACE_SEARCH__.deep_link.owner_epoch,
        queries: window.__GRIDATLAS_PLACE_SEARCH__.query_count,
        retries: window.__GRIDATLAS_PLACE_SEARCH__.identity_retry_count
      }));
      inducedFailure = { pageErrors: [...pageErrors], consoleErrors: [...consoleErrors],
        requestFailures: [...requestFailures] };
      await page.click('#gridatlas-boot-status button');
      pageErrors.length = 0;
      consoleErrors.length = 0;
      requestFailures.length = 0;
    }

    try {
      await page.waitForFunction(({ identity, verification, measures }) => {
        const owner = window.__GRIDATLAS_PLACE_SEARCH__?.deep_link;
        const link = window.__GRIDATLAS_NEON_LINKS__;
        return owner?.status === identity
          && (!verification || link?.identity_verification?.status === verification)
          && (measures ? link?.links_drawn > 0 && link?.last_selection?.nearest_km > 0
            : link?.links_drawn === 0
              && /not in the active-register snapshot/u.test(link?.status_message || ''));
      }, { identity: fixture.identity, verification: fixture.verification,
        measures: fixture.measures }, { timeout: 180_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        owner: window.__GRIDATLAS_PLACE_SEARCH__?.deep_link || null,
        query_count: window.__GRIDATLAS_PLACE_SEARCH__?.query_count ?? null,
        retry_count: window.__GRIDATLAS_PLACE_SEARCH__?.identity_retry_count ?? null,
        link: window.__GRIDATLAS_NEON_LINKS__ ? {
          origin: window.__GRIDATLAS_NEON_LINKS__.origin_source || null,
          identity: window.__GRIDATLAS_NEON_LINKS__.identity_verification || null,
          links: window.__GRIDATLAS_NEON_LINKS__.links_drawn,
          selection: window.__GRIDATLAS_NEON_LINKS__.last_selection || null,
          retry: window.__GRIDATLAS_NEON_LINKS__.arrival_retry || null,
          reconciliation: window.__GRIDATLAS_NEON_LINKS__.arrival_reconciliation || null,
          gate: window.__GRIDATLAS_NEON_LINKS__.measure?.arrivalGate?.snapshot?.() || null,
          failures: window.__GRIDATLAS_NEON_LINKS__.failures || []
        } : null,
        status: document.getElementById('gridatlas-boot-status')?.innerText || null
      }));
      throw new Error(`${fixture.label} did not finish: ${JSON.stringify({
        manifestAttempts, diagnostic, pageErrors, consoleErrors, requestFailures
      })}`, { cause: error });
    }

    const result = await page.evaluate(() => {
      const state = window.__GRIDATLAS_PLACE_SEARCH__;
      const owner = state.deep_link;
      const link = window.__GRIDATLAS_NEON_LINKS__;
      const popup = document.querySelector('.maplibregl-popup-content');
      const popupText = popup?.innerText.replace(/\s+/g, ' ').trim() || '';
      return {
        runtime_generation: document.documentElement.dataset.gridatlasGeneration,
        owner_generation: state.generation, source_generation: state.source_generation,
        owner, query_count: state.query_count, retry_count: state.identity_retry_count,
        menus: [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')]
          .map((node) => node.textContent.trim()),
        links_drawn: link.links_drawn,
        nearest_km: link.last_selection?.nearest_km ?? null,
        origin_source: link.origin_source || null,
        verification: link.identity_verification || null,
        status_message: link.status_message || null,
        failures: link.failures || [],
        arrival_retry: link.arrival_retry || null,
        reconciliation: link.arrival_reconciliation || null,
        gate: link.measure?.arrivalGate?.snapshot?.() || null,
        popup_text: popupText,
        visible_measurement: /\d+(?:\.\d+)? km straight/u.test(popupText)
      };
    });

    assert.equal(result.runtime_generation, GENERATION);
    assert.equal(result.owner_generation, GENERATION);
    assert.equal(result.source_generation, '202609040229');
    assert.deepEqual(result.menus, ['File', 'Edit', 'View', 'Scope', 'Grid', 'About']);
    assert.equal(result.owner.status, fixture.identity);
    assert.equal(result.owner.repd_ref, fixture.query.repd_ref);
    assert.equal(requests.some((request) => request.includes('/uk_renewables_pipeline/')),
      false, 'legacy wrong-domain Pipeline request was issued');
    if (fixture.retry) {
      assert.equal(beforeRetry.status, 'FAILED');
      assert.equal(beforeRetry.queries, 0);
      assert.equal(beforeRetry.retries, 0);
      assert.equal(result.query_count, 1);
      assert.equal(result.retry_count, 1);
      assert.ok(result.owner.owner_epoch > beforeRetry.epoch);
      assert.equal(result.arrival_retry.owner_epoch, result.owner.owner_epoch);
      assert.equal(result.arrival_retry.measurement_epoch, result.owner.owner_epoch);
      assert.equal(result.reconciliation.epoch, result.owner.owner_epoch);
      assert.equal(result.reconciliation.owner_epoch, result.owner.owner_epoch);
      assert.equal(result.gate.epoch, result.owner.owner_epoch);
      assert.equal(result.arrival_retry.status,
        fixture.identity === 'NOT_IN_ACTIVE_REGISTER'
          ? 'NOT_IN_ACTIVE_REGISTER' : 'RESOLVED');
      assert.ok(manifestAttempts >= 2);
      assert.ok(inducedFailure.consoleErrors.some((message) =>
        /V9 EXACT REPD DEEP LINK/u.test(message)));
    }
    if (fixture.measures) {
      assert.ok(result.links_drawn > 0);
      assert.ok(result.nearest_km > 0);
      assert.equal(result.visible_measurement, true);
    } else {
      assert.equal(result.links_drawn, 0);
      assert.equal(result.nearest_km, null);
      assert.match(result.status_message, /not in the active-register snapshot/u);
      assert.match(result.status_message, /supplies no coordinates/u);
      assert.match(result.status_message, /No official status or location is inferred/u);
    }
    if (fixture.identity === 'NOT_IN_ACTIVE_REGISTER') {
      assert.equal(result.owner.identity_source, 'ARRIVAL_LINK');
      assert.equal(result.owner.official_active_register_match, false);
      assert.equal(result.owner.status_value ?? null, null);
      assert.equal(result.verification.status, 'NOT_IN_ACTIVE_REGISTER');
      if (fixture.measures) {
        assert.equal(result.owner.name, fixture.query.project);
        assert.equal(result.origin_source, 'link-supplied-not-in-active-register');
        assert.match(result.popup_text, /Thorpe Marsh Power Station/u);
        assert.doesNotMatch(result.popup_text, /Revised/u);
      } else {
        assert.equal(result.owner.name, null);
        assert.equal(result.origin_source, 'not-in-active-register-no-supplied-point');
      }
    } else {
      assert.equal(result.owner.identity_source, 'OFFICIAL_ACTIVE_REGISTER');
      assert.equal(result.owner.official_active_register_match, true);
      assert.equal(result.owner.status_value, 'application submitted');
      assert.match(result.popup_text, /Botley West/u);
    }
    assert.deepEqual(result.failures, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    const materialFailures = requestFailures.filter(({ url: failedUrl }) =>
      !/basemaps\.cartocdn\.com/u.test(failedUrl));
    assert.deepEqual(materialFailures, []);

    receipts.push({ label: fixture.label, url, manifest_attempts: manifestAttempts,
      induced_failure: inducedFailure, page_errors: pageErrors,
      console_errors: consoleErrors, material_request_failures: materialFailures,
      obsolete_pipeline_requests: requests.filter((request) =>
        request.includes('/uk_renewables_pipeline/')), ...result });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', generation: GENERATION,
    viewport: VIEWPORT, cases: receipts }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
