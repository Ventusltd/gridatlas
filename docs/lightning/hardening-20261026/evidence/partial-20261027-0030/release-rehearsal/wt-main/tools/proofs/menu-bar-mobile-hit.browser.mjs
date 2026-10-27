#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const menuPath = path.join(ROOT, 'atlas', 'modules', '202609031958-menu-bar.js');
const sldBodyPath = path.join(ROOT, 'atlas', 'parts', '202609012045-sld-sandbox-body.js');

const sldBody = await readFile(sldBodyPath, 'utf8');
const fullscreenStart = sldBody.indexOf('  function keepLayersInFullscreen() {');
const fullscreenEnd = sldBody.indexOf('\n  function installSld(map) {', fullscreenStart);
assert.ok(fullscreenStart >= 0 && fullscreenEnd > fullscreenStart,
  'could not extract the production fullscreen handler');
const fullscreenHandler = sldBody.slice(fullscreenStart, fullscreenEnd);

const engineIds = Array.from({ length: 60 }, (_, index) =>
  index === 37 ? 'dlr' : `engine-${index}`);
const engineControls = engineIds.map((id) => `
  <label class="key-item"><input type="checkbox" data-layer-id="${id}">
    <span data-base-label="${id === 'dlr' ? 'DLR' : id}">${id}</span></label>`).join('');
const pipelineControls = ['same-tech', 'wider-fleet', 'all-pipeline'].map((id) => `
  <label class="key-item"><input type="checkbox" data-pn-layer="${id}">
    <span data-pn-label="${id}">${id}</span></label>`).join('');

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
  await page.setContent(`<!doctype html>
<html class="gridatlas-sheet-open"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  html,body{margin:0;width:100%;height:100%;font:12px sans-serif}
  .map-container{position:relative;width:100%;height:100%;background:#071217}
  .map-controls{position:absolute;top:50px;left:4px}
  .scada-wrapper{position:fixed;left:12px;top:580px;z-index:2;color:white}
  .key-item{display:block;min-height:22px}
  .maplibregl-popup.gridatlas-sheet{position:fixed;inset:auto 0 0 0;height:56vh;z-index:400;background:#182229}
  .maplibregl-popup.gridatlas-sheet .neon-caveat{position:absolute;inset:0;padding:20px;color:white}
</style></head><body>
  <div id="dashboard" class="dashboard">
  <div class="hud-header">GridAtlas</div>
  <div id="map-container" class="map-container">
    <div class="search-bar-wrapper"><input id="search-input"><div id="search-results"></div></div>
    <div class="map-controls">
      <button id="btn-export">Export</button><button id="btn-status">Status</button>
      <button id="btn-radius">Radius</button><button id="btn-radius-area">Area</button>
      <button id="btn-zonedraw">Zone</button><button id="btn-measure">Measure</button>
    </div>
    <button id="btn-fullscreen">Fullscreen</button>
    <div class="maplibregl-popup gridatlas-sheet"><span class="neon-caveat">Project evidence card</span></div>
  </div>
  <div class="scada-wrapper"><div class="scada-brand">Ventus</div>
    <div id="scada-ui-container">
      <div class="key-group"><div class="key-title">Engine layers</div>${engineControls}</div>
      <div class="key-group"><div class="key-title">Pipeline News</div>${pipelineControls}</div>
    </div>
  </div>
  <button id="gridatlas-dash-toggle">Layers</button>
  <button id="btn-fullscreen-exit">Exit</button>
  <div id="fs-curtain-tab">Layers</div>
  <script>
    window.originalChanges = 0;
    document.getElementById('btn-fullscreen').addEventListener('click', () =>
      document.getElementById('map-container').requestFullscreen());
    document.querySelectorAll('input[data-layer-id]').forEach((input) => {
      input.addEventListener('change', () => {
        window.originalChanges += 1;
        const label = input.closest('label').querySelector('[data-base-label]');
        label.textContent = label.getAttribute('data-base-label') + ' [OK]';
      });
    });
  </script>
  </div>
</body></html>`);

  const before = await page.locator('input[data-layer-id="engine-0"]').evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return { tag: top?.tagName, className: top?.className || '' };
  });
  assert.match(before.className, /neon-caveat/,
    'fixture must reproduce the v9.90 project sheet intercepting an original layer checkbox');

  await page.addScriptTag({ path: menuPath });
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true);

  /* Execute the production fullscreen handler, not a restatement. The real
     regression occurred when #map-container (a dashboard descendant) became
     fullscreen and the handler tried to append its ancestor into it. */
  await page.addScriptTag({ content: `
    const link = { failures: [] };
    let fullscreenBounds = 0;
    const boundCardToMap = () => { fullscreenBounds += 1; };
    ${fullscreenHandler}
    keepLayersInFullscreen();
    window.__fullscreenProof = { link, get bounds() { return fullscreenBounds; } };
  ` });

  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.locator('#btn-fullscreen').click();
  await page.waitForFunction(() => document.fullscreenElement?.id === 'map-container');

  await page.getByRole('button', { name: 'Grid', exact: true }).click();

  const proxy = page.locator('[data-gridatlas-layer-proxy="engine:dlr"]');
  await proxy.scrollIntoViewIfNeeded();
  const hit = await proxy.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, isProxy: top === input, tag: top?.tagName, className: top?.className || '' };
  });
  assert.equal(hit.isProxy, true,
    `Grid proxy lost the production hit test to ${hit.tag}.${hit.className}`);
  await page.mouse.click(hit.x, hit.y);

  await page.waitForFunction(() =>
    document.querySelector('[data-gridatlas-layer-proxy="engine:dlr"]')
      ?.getAttribute('aria-label') === 'DLR [OK]');

  const result = await page.evaluate(() => ({
    originalChecked: document.querySelector('input[data-layer-id="dlr"]').checked,
    proxyChecked: document.querySelector('[data-gridatlas-layer-proxy="engine:dlr"]').checked,
    originalChanges: window.originalChanges,
    menuExpanded: document.getElementById('gridatlas-menu-bar-title-4')
      .getAttribute('aria-expanded'),
    proxyLabel: document.querySelector('[data-gridatlas-layer-proxy="engine:dlr"]')
      .getAttribute('aria-label'),
    fullscreenElement: document.fullscreenElement?.id || '',
    fullscreenContainsMenu: document.fullscreenElement
      ?.contains(document.getElementById('gridatlas-menu-bar')),
    dashboardStillAtHome: document.getElementById('dashboard').parentElement === document.body,
    dashboardWasNotRelocated: !document.getElementById('dashboard')
      .classList.contains('gridatlas-fs-layers'),
    menuCountInFullscreen: document.fullscreenElement
      ?.querySelectorAll('.gm-title').length,
    fullscreenBounds: window.__fullscreenProof.bounds,
    fullscreenFailures: window.__fullscreenProof.link.failures,
    guard: window.__GRIDATLAS_MODULES__.menuBar.mobile_sheet_hit_target_guard,
    viewport: [innerWidth, innerHeight],
  }));
  assert.deepEqual(result, {
    originalChecked: true,
    proxyChecked: true,
    originalChanges: 1,
    menuExpanded: 'true',
    proxyLabel: 'DLR [OK]',
    fullscreenElement: 'map-container',
    fullscreenContainsMenu: true,
    dashboardStillAtHome: true,
    dashboardWasNotRelocated: true,
    menuCountInFullscreen: 6,
    fullscreenBounds: 1,
    fullscreenFailures: [],
    guard: true,
    viewport: [393, 852],
  });
  assert.deepEqual(pageErrors, [], `fullscreen raised page errors: ${pageErrors.join(' | ')}`);

  console.log(JSON.stringify({ status: 'PASS', pageErrors, before, hit, ...result }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
