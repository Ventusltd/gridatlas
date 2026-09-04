#!/usr/bin/env node

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
  /* An isolated Git worktree does not duplicate the 200 MB browser install.
     CI resolves the package normally; this is the measured laptop checkout. */
  playwright = require(path.resolve(ROOT, '..', '..', 'gridatlas-v9104-fullscreen',
    'node_modules', 'playwright'));
}
const { chromium } = playwright;
const GENERATION = '202609040219';
const VIEWPORT = { width: 393, height: 852 };
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.wasm', 'application/wasm']
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
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
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

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const metroResponses = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.url().includes('uk_metros_trams_root.parquet')) {
      metroResponses.push({ url: response.url(), status: response.status() });
    }
  });

  /* Capture the real MapLibre instance without changing production bytes.
     The library assigns its UMD export before either cartridge wraps Map. */
  await page.addInitScript(() => {
    let maplibreValue;
    const capture = (value) => {
      if (!value || typeof value.Map !== 'function' || value.Map.__gridatlasProofWrapped) return value;
      const OriginalMap = value.Map;
      function ProofMap(...args) {
        const instance = Reflect.construct(OriginalMap, args,
          new.target === ProofMap ? OriginalMap : new.target);
        window.__GRIDATLAS_PROOF_MAP__ = instance;
        return instance;
      }
      Object.setPrototypeOf(ProofMap, OriginalMap);
      ProofMap.prototype = OriginalMap.prototype;
      ProofMap.__gridatlasProofWrapped = true;
      value.Map = ProofMap;
      return value;
    };
    Object.defineProperty(window, 'maplibregl', {
      configurable: true,
      enumerable: true,
      get: () => maplibreValue,
      set: (value) => { maplibreValue = capture(value); }
    });
  });

  const query = new URLSearchParams({
    repd_ref: '155',
    project: 'Markinch Biomass CHP Plant',
    technology: 'biomass',
    capacity_mw: '65',
    latitude: '56.20118',
    longitude: '-3.16226'
  });
  const url = `http://127.0.0.1:${port}/atlas/?${query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction((generation) =>
    document.documentElement.dataset.gridatlasGeneration === generation,
  GENERATION, { timeout: 120_000 });
  await page.waitForFunction(() =>
    window.__GRIDATLAS_MODULES__?.menuBar?.installed === true
      && document.querySelectorAll('#gridatlas-menu-bar .gm-title').length === 6
      && window.__GRIDATLAS_PROOF_MAP__, null, { timeout: 120_000 });

  /* Preserve the product acceptance which brought the user here: the grid
     computation remains visible before this unrelated layer is exercised. */
  await page.waitForFunction(() => document.body.textContent.includes('28.82 km'),
    null, { timeout: 180_000 });

  /* Arrival requests fullscreen without a user gesture. Chromium correctly
     denies the native request after the shell has entered its CSS state; exit
     that denied state, then exercise the same button with a real click. */
  await page.evaluate(() => {
    if (!document.fullscreenElement && document.body.classList.contains('fs-active')) {
      window.exitFullscreen();
    }
  });
  /* v9.104 already proves the shell's fullscreen button. This proof needs a
     native user-gesture fullscreen while an arrival may be toggling the
     shell's own button visibility, so use a proof-only gesture target. */
  await page.evaluate(() => {
    const trigger = document.createElement('button');
    trigger.id = 'gridatlas-proof-fullscreen';
    trigger.textContent = 'Proof fullscreen';
    trigger.style.cssText = 'position:fixed;inset:40px auto auto 4px;z-index:2147483647';
    trigger.addEventListener('click', () => document.getElementById('map-container').requestFullscreen());
    document.body.appendChild(trigger);
  });
  await page.locator('#gridatlas-proof-fullscreen').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.fullscreenElement?.id === 'map-container',
    null, { timeout: 30_000 });
  await page.evaluate(() => document.getElementById('gridatlas-proof-fullscreen')?.remove());
  await page.getByRole('button', { name: 'Grid', exact: true }).click();

  const tramProxy = page.locator('[data-gridatlas-layer-proxy="engine:tram"]');
  await tramProxy.scrollIntoViewIfNeeded();
  await tramProxy.click();
  await page.waitForFunction(() => {
    const original = document.querySelector('#scada-ui-container input[data-layer-id="tram"]');
    const proxy = document.querySelector('[data-gridatlas-layer-proxy="engine:tram"]');
    return original?.disabled && !original.checked && proxy?.disabled && !proxy.checked
      && proxy.getAttribute('aria-label') === 'Trams & Light Rail [EMPTY]';
  }, null, { timeout: 180_000 });

  const result = await page.evaluate(() => {
    const map = window.__GRIDATLAS_PROOF_MAP__;
    const source = map.getSource('src-metros');
    const features = Array.isArray(source?._data?.features) ? source._data.features : [];
    const propertyPresence = {};
    const geometryTypes = {};
    for (const feature of features) {
      const geometryType = feature?.geometry?.type || '<missing>';
      geometryTypes[geometryType] = (geometryTypes[geometryType] || 0) + 1;
      for (const key of Object.keys(feature?.properties || {})) {
        propertyPresence[key] = (propertyPresence[key] || 0) + 1;
      }
    }
    const layerState = Object.fromEntries(['dlr', 'metro', 'tram'].map((id) => {
      const original = document.querySelector(`#scada-ui-container input[data-layer-id="${id}"]`);
      const proxy = document.querySelector(`[data-gridatlas-layer-proxy="engine:${id}"]`);
      return [id, {
        original_checked: original?.checked,
        original_disabled: original?.disabled,
        proxy_checked: proxy?.checked,
        proxy_disabled: proxy?.disabled,
        proxy_label: proxy?.getAttribute('aria-label'),
        layer_type: map.getLayer(`l-${id}`)?.type,
        visibility: map.getLayoutProperty(`l-${id}`, 'visibility'),
        rendered_in_view: map.queryRenderedFeatures({ layers: [`l-${id}`] }).length
      }];
    }));
    return {
      generation: document.documentElement.dataset.gridatlasGeneration,
      viewport: [innerWidth, innerHeight],
      fullscreen_element: document.fullscreenElement?.id || '',
      fullscreen_contains_menu: document.fullscreenElement
        ?.contains(document.getElementById('gridatlas-menu-bar')),
      menus: [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')]
        .map((node) => node.textContent.trim()),
      source_features: features.length,
      geometry_types: geometryTypes,
      property_presence: propertyPresence,
      layer_state: layerState,
      nearest_visible: document.body.textContent.includes('28.82 km')
    };
  });

  assert.equal(result.generation, GENERATION);
  assert.deepEqual(result.viewport, [393, 852]);
  assert.equal(result.fullscreen_element, 'map-container');
  assert.equal(result.fullscreen_contains_menu, true);
  assert.deepEqual(result.menus, ['File', 'Edit', 'View', 'Scope', 'Grid', 'About']);
  assert.equal(result.source_features, 7_829, 'the complete deployed partition was reconstructed');
  assert.deepEqual(result.geometry_types, { LineString: 7_829 }, 'the runtime payload is entirely LineString');
  assert.equal(result.property_presence.railway || 0, 0, 'the runtime projection retains no railway classifier');
  for (const id of ['dlr', 'metro', 'tram']) {
    assert.deepEqual(result.layer_state[id], {
      original_checked: false,
      original_disabled: true,
      proxy_checked: false,
      proxy_disabled: true,
      proxy_label: `${id === 'dlr' ? 'DLR' : id === 'metro' ? 'UK Metro' : 'Trams & Light Rail'} [EMPTY]`,
      layer_type: 'circle',
      visibility: 'none',
      rendered_in_view: 0
    });
  }
  assert.equal(result.nearest_visible, true);
  assert.ok(metroResponses.some((response) => response.status === 200),
    'the production metro/tram Parquet answered successfully');
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
  const materialFailures = requestFailures.filter(({ url: failedUrl }) =>
    !/basemaps\.cartocdn\.com/.test(failedUrl));
  assert.deepEqual(materialFailures, [], `material request failures: ${JSON.stringify(materialFailures)}`);

  console.log(JSON.stringify({
    status: 'PASS',
    url,
    pageErrors,
    consoleErrors,
    requestFailures,
    metroResponses,
    ...result
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
