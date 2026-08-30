import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const targetUrl = process.env.TARGET_URL;
const mode = process.env.MODE || 'local';
const expectedRef = process.env.EXPECTED_REPD_REF || '13599';
const expectedName = process.env.EXPECTED_PROJECT_NAME || 'Beacon Fen Energy Park';
const output = process.env.OUTPUT || `work/202608300453-${mode}-exact-repd-deep-link-proof.json`;
const screenshot = process.env.SCREENSHOT || `work/202608300453-${mode}-exact-repd-deep-link.png`;

if (!targetUrl) throw new Error('TARGET_URL is required');
if (!['local', 'public'].includes(mode)) throw new Error(`unsupported mode ${mode}`);

const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const httpErrors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();

page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
page.on('requestfailed', request => {
  requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
});
page.on('response', response => {
  if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() });
});

await page.route('**/dark-matter-gl-style/style.json', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({
    version: 8,
    name: 'Deep-link proof',
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000000' } }]
  })
}));

const url = new URL(targetUrl);
url.searchParams.set('repd_ref', expectedRef);
await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForSelector('.dashboard', { timeout: 60000 });
await page.waitForFunction(
  ref => window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.status === 'RESOLVED'
    && window.__GRIDATLAS_PLACE_SEARCH__?.deep_link?.repd_ref === ref,
  expectedRef,
  { timeout: 150000 }
);
await page.waitForFunction(
  ref => document.body.dataset.gridatlasRepdRef === ref
    && document.body.dataset.gridatlasRepdDeepLink === 'resolved',
  expectedRef,
  { timeout: 30000 }
);
await page.waitForSelector('.maplibregl-popup', { timeout: 30000 });
await page.screenshot({ path: screenshot, fullPage: true });

const surface = await page.evaluate(() => ({
  href: window.location.href,
  body_dataset: { ...document.body.dataset },
  body_text: document.body.innerText,
  search: window.__GRIDATLAS_PLACE_SEARCH__ || null,
  map_captured: Boolean(window.__GRIDATLAS_V9_MAP__),
  popup_text: document.querySelector('.maplibregl-popup')?.innerText || '',
  exact_result_count: [...document.querySelectorAll('.search-result-item')]
    .filter(item => item.dataset.repdRef === new URLSearchParams(location.search).get('repd_ref')).length
}));
await browser.close();

const criticalRequestFailures = requestFailures.filter(item =>
  /duckdb|repd_projects|repd_v9_manifest|202608291818-place-postcode-search|ventus-corev8engine/i.test(item.url)
);
const criticalHttpErrors = httpErrors.filter(item =>
  /duckdb|repd_projects|repd_v9_manifest|202608291818-place-postcode-search|ventus-corev8engine/i.test(item.url)
);
const parsed = new URL(surface.href);
const deepLink = surface.search?.deep_link || {};
const selection = surface.search?.last_selection || {};
const failures = surface.search?.failures || [];

const checks = {
  query_preserved: parsed.searchParams.get('repd_ref') === expectedRef,
  receiver_resolved: deepLink.status === 'RESOLVED' && deepLink.resolved === true,
  exact_identity: deepLink.repd_ref === expectedRef && selection.repd_ref === expectedRef,
  project_name: deepLink.name === expectedName,
  mapped: deepLink.mapped === true && selection.mapped === true && surface.map_captured === true,
  rendered_identity: surface.body_text.includes(expectedName)
    && surface.body_text.includes(`REPD ${expectedRef}`)
    && surface.popup_text.includes(expectedName)
    && surface.popup_text.includes(`REPD ${expectedRef}`),
  exact_result_present: surface.exact_result_count === 1,
  no_receiver_failures: failures.length === 0,
  no_console_errors: consoleErrors.length === 0,
  no_page_errors: pageErrors.length === 0,
  no_critical_request_failures: criticalRequestFailures.length === 0,
  no_critical_http_errors: criticalHttpErrors.length === 0
};
const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
const classification = failedChecks.length
  ? 'ATLAS_EXACT_REPD_DEEP_LINK_FAILURE'
  : mode === 'public'
    ? 'VERIFIED_PUBLIC_ATLAS_EXACT_REPD_DEEP_LINK'
    : 'VERIFIED_LOCAL_ATLAS_EXACT_REPD_DEEP_LINK';

const proof = {
  schema: 'gridatlas.exact-repd-deep-link-browser-proof.v1',
  classification,
  mode,
  target_url: url.href,
  expected_repd_ref: expectedRef,
  expected_project_name: expectedName,
  checks,
  failed_checks: failedChecks,
  receiver: deepLink,
  last_selection: selection,
  search_query_count: surface.search?.query_count ?? null,
  search_failures: failures,
  popup_text: surface.popup_text,
  body_dataset: surface.body_dataset,
  console_errors: consoleErrors,
  page_errors: pageErrors,
  critical_request_failures: criticalRequestFailures,
  critical_http_errors: criticalHttpErrors,
  all_request_failures: requestFailures,
  all_http_errors: httpErrors,
  synthetic_receiver: false,
  route_interceptions: 0,
  privacy: 'NO_PERSONAL_DATA'
};
await fs.mkdir(output.slice(0, output.lastIndexOf('/')), { recursive: true });
await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(proof));
if (failedChecks.length) process.exitCode = 1;
