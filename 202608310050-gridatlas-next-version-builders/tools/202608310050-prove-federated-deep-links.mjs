#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium, request } from 'playwright';

const outputDir = path.resolve(process.argv[2] || '');
const generation = process.argv[3] || 'unknown';
if (!outputDir || !fs.existsSync(outputDir)) throw new Error('output directory is required');

const proofDir = path.join(outputDir, 'browser-proof');
fs.mkdirSync(proofDir, { recursive: true });
const cases = [
  { id: 'stable-beacon-fen-desktop', url: 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=13599', ref: '13599', viewport: { width: 1280, height: 900 }, dpr: 1 },
  { id: 'stable-beacon-fen-phone', url: 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=13599', ref: '13599', viewport: { width: 375, height: 667 }, dpr: 2 },
  { id: 'root-redirect-beacon-fen', url: 'https://ventusltd.github.io/gridatlas/?repd_ref=13599', ref: '13599', viewport: { width: 1280, height: 900 }, dpr: 1 },
  { id: 'stable-east-pye-desktop', url: 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=17494', ref: '17494', viewport: { width: 1280, height: 900 }, dpr: 1 }
];

const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;
try {
  for (const test of cases) {
    const context = await browser.newContext({ viewport: test.viewport, deviceScaleFactor: test.dpr });
    const page = await context.newPage();
    const consoleErrors = [];
    const requestFailures = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(String(error?.stack || error)));
    page.on('requestfailed', request => requestFailures.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' }));
    const started = Date.now();
    let responseStatus = null;
    let bodyState = null;
    let error = null;
    try {
      const response = await page.goto(test.url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      responseStatus = response?.status() ?? null;
      await page.waitForFunction(
        ref => document.body?.dataset.gridatlasRepdDeepLink === 'resolved' && document.body?.dataset.gridatlasRepdRef === ref,
        test.ref,
        { timeout: 90_000 }
      );
      bodyState = await page.evaluate(() => ({
        deep_link: document.body?.dataset.gridatlasRepdDeepLink || null,
        repd_ref: document.body?.dataset.gridatlasRepdRef || null,
        router: document.body?.dataset.gridatlasRouter || null,
        generation: document.documentElement?.dataset.gridatlasGeneration || null,
        href: location.href,
        place_search: window.__GRIDATLAS_PLACE_SEARCH__ ? {
          generation: window.__GRIDATLAS_PLACE_SEARCH__.generation,
          deep_link: window.__GRIDATLAS_PLACE_SEARCH__.deep_link,
          failures: window.__GRIDATLAS_PLACE_SEARCH__.failures
        } : null
      }));
      await page.screenshot({ path: path.join(proofDir, `${generation}-${test.id}.png`), fullPage: false });
    } catch (caught) {
      error = String(caught?.stack || caught);
      failed = true;
      try { await page.screenshot({ path: path.join(proofDir, `${generation}-${test.id}-failed.png`), fullPage: false }); } catch {}
    }
    results.push({
      id: test.id,
      url: test.url,
      ref: test.ref,
      viewport: test.viewport,
      dpr: test.dpr,
      response_status: responseStatus,
      elapsed_ms: Date.now() - started,
      body_state: bodyState,
      console_errors: consoleErrors,
      request_failures: requestFailures,
      error,
      passed: !error && bodyState?.deep_link === 'resolved' && bodyState?.repd_ref === test.ref
    });
    if (!results.at(-1).passed) failed = true;
    await context.close();
  }

  const api = await request.newContext({ ignoreHTTPSErrors: false });
  const staleUrl = 'https://ventusltd.github.io/gridatlas/202608300453-atlas-v9/?repd_ref=13599';
  let staleStatus = null;
  let staleError = null;
  try {
    const response = await api.get(staleUrl, { timeout: 30_000, failOnStatusCode: false });
    staleStatus = response.status();
  } catch (error) {
    staleError = String(error?.stack || error);
  } finally {
    await api.dispose();
  }
  const stalePassed = staleStatus === 404;
  if (!stalePassed) failed = true;
  results.push({ id: 'stale-root-release', url: staleUrl, expected_status: 404, response_status: staleStatus, error: staleError, passed: stalePassed });
} finally {
  await browser.close();
}

const proof = {
  schema: 'gridatlas.federated-deep-link-browser-proof.v1',
  generation,
  observed_at: new Date().toISOString(),
  classification: failed ? 'FAILED_PUBLIC_FEDERATED_DEEP_LINK_PROOF' : 'VERIFIED_PUBLIC_FEDERATED_DEEP_LINK_PROOF',
  synthetic_receiver: false,
  route_interceptions: 0,
  stable_route: '/gridatlas/atlas/',
  sentinels: ['13599', '17494'],
  results,
  passed: !failed
};
fs.writeFileSync(path.join(proofDir, `${generation}-federated-deep-link-proof.json`), `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(proof, null, 2));
if (failed) process.exitCode = 1;
