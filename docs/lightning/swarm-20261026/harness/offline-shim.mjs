// offline-shim.mjs — makes the GridAtlas composition boot inside this sandbox, whose outbound
// network allowlist refuses jsdelivr, cartocdn and ventusltd.github.io.
//
// It does NOT change any repository file. It only answers the browser's requests for
//   - maplibre-gl@3.6.2 (jsdelivr)            -> npm tarball cached in ../cdn-cache
//   - @duckdb/duckdb-wasm@1.29.0 (jsdelivr)   -> npm tarball cached in ../cdn-cache
//   - ventusltd.github.io/data-gridatlas/...  -> local clone /home/claude/ventusltd/data-gridatlas
//   - ventusltd.github.io/gridatlas/...       -> local clone /home/claude/gridatlas (same bytes as main)
//   - basemaps.cartocdn.com style.json        -> a minimal style with a background layer only
//                                                (no sources, no glyphs: a quiet dark map, no labels)
//   - raw.githubusercontent.com/Ventusltd/lightning/<ref>/data/... -> local clone /home/claude/lightning/data
//     (override with opts.lightningDataDir to point at synthetic shards for candidate tests)
//   - everything else off-origin               -> aborted and logged (BLOCKED_DEPENDENCY)
//
// Usage:
//   import { installOfflineShim } from '<this file>';
//   const shim = await installOfflineShim(page, { lightningDataDir: '/path/or/undefined' });
//   ... await page.goto('http://127.0.0.1:PORT/gridatlas/atlas/') ...
//   shim.summary()  -> { served: {...counts}, aborted: [urls] }
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const CDN_CACHE = join(here, '..', 'cdn-cache');
export const MAPLIBRE_DIST = join(CDN_CACHE, 'maplibre-gl-3.6.2', 'package', 'dist');
export const DUCKDB_PKG = join(CDN_CACHE, 'duckdb-duckdb-wasm-1.29.0', 'package');
export const DATA_GRIDATLAS = '/home/claude/ventusltd/data-gridatlas';
export const GRIDATLAS_CLONE = '/home/claude/gridatlas';
export const LIGHTNING_DATA = '/home/claude/lightning/data';

const MIME = {
  '.js': 'application/javascript', '.mjs': 'application/javascript', '.cjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json',
  '.wasm': 'application/wasm', '.parquet': 'application/octet-stream', '.html': 'text/html',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json', '.txt': 'text/plain'
};

export const MINIMAL_STYLE = {
  version: 8,
  name: 'offline-shim-dark',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0b0e14' } }]
};

async function fulfilFile(route, path, extraHeaders = {}) {
  try {
    await stat(path);
    const body = await readFile(path);
    const type = MIME[extname(path)] || 'application/octet-stream';
    await route.fulfill({ status: 200, body, headers: { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store', ...extraHeaders } });
    return true;
  } catch {
    await route.fulfill({ status: 404, body: 'offline-shim: not in local cache: ' + path, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' } });
    return false;
  }
}

export async function installOfflineShim(page, opts = {}) {
  const lightningDataDir = opts.lightningDataDir || LIGHTNING_DATA;
  const served = {}; const aborted = []; const missing = [];
  const bump = (k) => { served[k] = (served[k] || 0) + 1; };
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const host = url.hostname; const p = url.pathname;
    if (host === '127.0.0.1' || host === 'localhost') return route.continue();
    if (url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
    if (host === 'cdn.jsdelivr.net') {
      let m = p.match(/^\/npm\/maplibre-gl@3\.6\.2\/dist\/(.+)$/);
      if (m) { bump('maplibre'); const ok = await fulfilFile(route, join(MAPLIBRE_DIST, m[1])); if (!ok) missing.push(req.url()); return; }
      m = p.match(/^\/npm\/@duckdb\/duckdb-wasm@1\.29\.0\/(.+)$/);
      if (m) {
        bump('duckdb');
        // jsdelivr's "+esm" is a server-side bundle (duckdb-browser.mjs with apache-arrow inlined);
        // the npm tarball has no such file, so serve the esbuild bundle built in ../cdn-cache.
        const target = (m[1] === '+esm' || m[1] === '+esm/') ? join(CDN_CACHE, 'duckdb-browser-esm-bundle.mjs') : join(DUCKDB_PKG, m[1]);
        const ok = await fulfilFile(route, target); if (!ok) missing.push(req.url()); return;
      }
    }
    if (host === 'ventusltd.github.io') {
      let m = p.match(/^\/data-gridatlas\/(.+)$/);
      if (m) { bump('data-gridatlas'); const ok = await fulfilFile(route, join(DATA_GRIDATLAS, m[1])); if (!ok) missing.push(req.url()); return; }
      m = p.match(/^\/gridatlas\/(.+)$/);
      if (m) { bump('gridatlas-clone'); const ok = await fulfilFile(route, join(GRIDATLAS_CLONE, m[1])); if (!ok) missing.push(req.url()); return; }
    }
    if (host === 'basemaps.cartocdn.com' && p.endsWith('style.json')) {
      bump('style'); return route.fulfill({ status: 200, body: JSON.stringify(MINIMAL_STYLE), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (host === 'raw.githubusercontent.com') {
      const m = p.match(/^\/Ventusltd\/lightning\/[^/]+\/data\/(.+)$/);
      if (m) { bump('lightning-data'); const ok = await fulfilFile(route, join(lightningDataDir, m[1])); if (!ok) missing.push(req.url()); return; }
    }
    aborted.push(req.url());
    return route.abort('blockedbyclient');
  });
  return { summary: () => ({ served, aborted: [...new Set(aborted)], missing: [...new Set(missing)] }) };
}

/** Boot the composition and wait until the native menu has installed or the deadline passes. */
export async function waitForComposition(page, { deadlineMs = 60000, settleMs = 3000 } = {}) {
  const t0 = Date.now();
  let state = null;
  while (Date.now() - t0 < deadlineMs) {
    state = await page.evaluate(() => ({
      engine: document.querySelectorAll('input[data-layer-id]').length,
      pn: document.querySelectorAll('input[data-pn-layer]').length,
      scada: !!document.querySelector('#scada-ui-container'),
      curtain: !!document.querySelector('#fs-curtain-keys'),
      menuInstalled: !!(window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar && window.__GRIDATLAS_MODULES__.menuBar.installed),
      map: !!window.__GRIDATLAS_V9_MAP__
    })).catch(() => null);
    if (state && state.menuInstalled) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(settleMs);
  return { ...(state || {}), waitedMs: Date.now() - t0 };
}
