#!/usr/bin/env node
/**
 * Proof: every technology bucket Pipeline News' MAP link can send arrives
 * with the project's own layer switched on -- or, for the one bucket that
 * genuinely has no layer, arrives saying so plainly -- never with
 * `technology_layer.enabled` reading true while nothing is actually lit.
 *
 * MEASURED BY THE ARCHITECT, LIVE, ON v9.107 -- REPRODUCED HERE
 * ------------------------------------------------------------------------
 *   repd    technology      links  failures                                  project_layer_enabled
 *   7698    wind_offshore   5      ["layer control not found: wind_offshore"] null
 *   2498    wind_offshore   5      ["layer control not found: wind_offshore"] null
 *   3139    wind_onshore    4      ["layer control not found: wind_onshore"]  null
 *   15205   other           5      ["layer control not found: other"]        null
 *   801     biomass         5      []                                        "biomass"
 *   12464   bess            5      []                                        "bess"
 *
 * isProjectTech() tested membership of PROJECT_TECHS, which deliberately
 * contains wind_onshore, wind_offshore and other -- so
 * `link.technology_layer.enabled` read true regardless, and the failure
 * that told the truth sat in `link.failures`, a field no gate read. 2,508
 * of the 7,680-row register -- a third of it -- arrived with the
 * project's own layer dark while the field a reader would check said
 * green.
 *
 * THE BUCKET LIST IS NOT HAND-TYPED HERE
 * ------------------------------------------------------------------------
 * BUCKETS below is read out of the served composition's own
 * technology-coverage module (SPINE + widerFleetBuckets()) at proof run
 * time -- the same module the architect's own root-cause report pointed
 * at. A bucket cannot go missing from THIS list the way wind_onshore,
 * wind_offshore and other went missing from the old PROJECT_TECHS-based
 * `enabled` read, because this list is derived, not retyped.
 *
 * WHAT "a layer id the engine publishes" MEANS HERE
 * ------------------------------------------------------------------------
 * PUBLISHED_LAYER_IDS is read from the LIVE PAGE's own
 * `input[type=checkbox][data-layer-id]` controls after the engine has
 * booted -- not a second hand-typed list either. For twelve of the
 * thirteen buckets, `project_layer_enabled` must be a member of that set.
 * `other` is the documented, permanent exception (see the fix's commit):
 * it has never had a layer, and the proof asserts the arrival says so
 * instead -- `failures: []`, `project_layer_enabled: null`,
 * `technology_layer.enabled: false`, with a stated reason -- rather than
 * asserting a fact that would never be true.
 *
 * WHY NO repd_ref
 * ------------------------------------------------------------------------
 * A supplied longitude/latitude/technology with NO repd_ref never awaits
 * register identity resolution (`receiverPlan.route === 'MEASURE_LINK_FIRST'`
 * and `repdRef` is falsy, so the identity-verification branch is skipped
 * entirely) -- see runDeepLink() in the sld-sandbox cartridge. That makes
 * this proof deterministic and independent of which REPD rows happen to be
 * live in the pinned register product, while still exercising the exact
 * production arrival path a Pipeline News MAP link takes. The coordinates
 * are a fixed, arbitrary point in Great Britain; no real project is
 * claimed to exist there.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CURRENT = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const GENERATION = CURRENT.generation;

// The bucket list, derived from the served module, not retyped.
const coverageContext = { window: {} };
coverageContext.window.window = coverageContext.window;
vm.createContext(coverageContext);
vm.runInContext(
  await readFile(path.join(ROOT, 'atlas', 'modules', '202609031310-technology-coverage.js'), 'utf8'),
  coverageContext, { filename: 'technology-coverage.js' });
const coverage = coverageContext.window.__GRIDATLAS_MODULES__?.technologyCoverage;
assert.ok(coverage, 'the technology-coverage module did not register');
const BUCKETS = [...coverage.spine, ...coverage.widerFleetBuckets()];
assert.equal(BUCKETS.length, 13, `expected 13 Pipeline buckets, the module named ${BUCKETS.length}`);

const NO_LAYER_BUCKETS = new Set(['other']);

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
      'content-type': MIME.get(path.extname(target).toLowerCase()) || 'application/octet-stream',
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

// A fixed, arbitrary GB point (near Leicester). No real project is claimed
// to exist here -- see the header note on why no repd_ref is supplied.
const LATITUDE = 52.6369;
const LONGITUDE = -1.1398;

const WIDTHS = [
  { width: 393, height: 852, touch: true },
  { width: 456, height: 906, touch: true },
  { width: 1280, height: 800, touch: false }
];

const widthFilter = String(process.env.GRIDATLAS_BROWSER_WIDTH || '').trim();
const bucketFilter = String(process.env.GRIDATLAS_BROWSER_BUCKET || '').trim();
const selectedWidths = widthFilter
  ? WIDTHS.filter((w) => String(w.width) === widthFilter) : WIDTHS;
const selectedBuckets = bucketFilter
  ? BUCKETS.filter((b) => b === bucketFilter) : BUCKETS;
assert.ok(selectedWidths.length, `no width matched GRIDATLAS_BROWSER_WIDTH=${widthFilter}`);
assert.ok(selectedBuckets.length, `no bucket matched GRIDATLAS_BROWSER_BUCKET=${bucketFilter}`);

const failures = [];
const receipts = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const spec of selectedWidths) {
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      ...(spec.touch ? { isMobile: true, hasTouch: true } : {})
    });
    const page = await context.newPage();
    let publishedLayerIds = null;

    for (const bucket of selectedBuckets) {
      const pageErrors = [];
      page.removeAllListeners('pageerror');
      page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));

      const query = new URLSearchParams({
        technology: bucket, latitude: String(LATITUDE), longitude: String(LONGITUDE),
        zoom: '12', project: 'GRIDATLAS_PROOF_' + bucket, capacity_mw: '10'
      });
      const url = `http://127.0.0.1:${port}/atlas/?${query}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForFunction((generation) =>
        document.documentElement.dataset.gridatlasGeneration === generation,
      GENERATION, { timeout: 120_000 });
      await page.waitForFunction(() =>
        window.__GRIDATLAS_MODULES__?.menuBar?.installed === true
          && document.querySelectorAll('#gridatlas-menu-bar .gm-title').length === 6,
      null, { timeout: 120_000 });

      if (!publishedLayerIds) {
        publishedLayerIds = await page.evaluate(() =>
          [...document.querySelectorAll('input[type=checkbox][data-layer-id]')]
            .map((input) => input.dataset.layerId));
      }

      try {
        await page.waitForFunction(() => {
          const link = window.__GRIDATLAS_NEON_LINKS__;
          const layer = link?.technology_layer;
          return !!layer && (layer.enabled === true || layer.layer_id === null);
        }, null, { timeout: 60_000 });
      } catch (error) {
        const diagnostic = await page.evaluate(() => ({
          link: window.__GRIDATLAS_NEON_LINKS__ ? {
            technology_layer: window.__GRIDATLAS_NEON_LINKS__.technology_layer,
            project_layer_enabled: window.__GRIDATLAS_NEON_LINKS__.project_layer_enabled,
            failures: window.__GRIDATLAS_NEON_LINKS__.failures
          } : null
        }));
        throw new Error(`${spec.width}px ${bucket} did not reach a terminal layer state: `
          + `${JSON.stringify(diagnostic)}`, { cause: error });
      }

      const result = await page.evaluate(() => {
        const link = window.__GRIDATLAS_NEON_LINKS__;
        return {
          runtime_generation: document.documentElement.dataset.gridatlasGeneration,
          failures: link.failures || [],
          project_layer_enabled: link.project_layer_enabled ?? null,
          technology_layer: link.technology_layer || null
        };
      });

      const check = (label, condition, detail) => {
        const full = `${spec.width}px ${bucket}: ${label}`;
        if (condition) { console.log(`  [PASS] ${full}`); }
        else { console.log(`  [FAIL] ${full}${detail ? ' -- ' + detail : ''}`); failures.push(full); }
      };

      check('runtime generation matches the composed generation',
        result.runtime_generation === GENERATION);
      check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));

      if (NO_LAYER_BUCKETS.has(bucket)) {
        check('failures stays empty -- the missing layer is said plainly, not searched for',
          Array.isArray(result.failures) && result.failures.length === 0,
          JSON.stringify(result.failures));
        check('project_layer_enabled stays null -- there was never a layer to enable',
          result.project_layer_enabled === null, String(result.project_layer_enabled));
        check('technology_layer.enabled is false',
          result.technology_layer?.enabled === false);
        check('technology_layer.layer_id is null',
          result.technology_layer?.layer_id === null);
        check('technology_layer.reason states plainly that no layer exists',
          /no map layer/i.test(result.technology_layer?.reason || ''),
          result.technology_layer?.reason);
      } else {
        check('failures: [] -- the exact assertion the old code could not make',
          Array.isArray(result.failures) && result.failures.length === 0,
          JSON.stringify(result.failures));
        check('project_layer_enabled is a layer id the engine actually publishes',
          publishedLayerIds.includes(result.project_layer_enabled),
          `got ${JSON.stringify(result.project_layer_enabled)}, `
            + `published: ${JSON.stringify(publishedLayerIds)}`);
        check('technology_layer.enabled is true',
          result.technology_layer?.enabled === true);
        check('technology_layer.layer_id matches project_layer_enabled',
          result.technology_layer?.layer_id === result.project_layer_enabled);
      }

      receipts.push({ width: spec.width, bucket, ...result, page_errors: pageErrors });
    }
    await context.close();
  }

  console.log(`\n${receipts.length} bucket/width cases run, ${failures.length} failure(s)`);
  if (failures.length) {
    console.error('\nFAILURES');
    for (const failure of failures) console.error('  ' + failure);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: 'PASS', generation: GENERATION,
      widths: selectedWidths.map((w) => w.width), buckets: selectedBuckets,
      cases: receipts.length }, null, 2));
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
