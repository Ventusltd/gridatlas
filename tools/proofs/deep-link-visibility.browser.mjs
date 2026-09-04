#!/usr/bin/env node
/**
 * Proof: a deep-link arrival opened in a HIDDEN tab does not run while
 * hidden, does not burn its layer-control budget while hidden, and
 * completes -- camera, card and links -- once the tab is actually shown.
 *
 * MEASURED LIVE, TWICE, ON A REAL IPHONE
 * ------------------------------------------------------------------------
 * The architect opened Pipeline News' MAP control (`target="_blank"` on
 * touch devices) for two different solar projects. Both times: menu bar
 * rendered, attribution rendered unoccluded, the basemap painted fully --
 * and the camera sat at the default UK-wide view (-3.5, 54 @ z4.2), no
 * project card, no neon links. An independent audit reproduced the
 * mechanism exactly: a deep link loaded with `document.hidden === true`
 * drew zero layer controls at 40s and the camera never left its default
 * position -- because `requestAnimationFrame` does not tick in a tab that
 * is not composited on iOS Safari, so `map.flyTo()`'s interpolation and the
 * engine's own paint-gated boot both stall for as long as the tab stays
 * hidden. It recovered 2.5s after being made visible, which is the
 * behaviour this proof pins: NOT that the arrival never fails, but that it
 * is never left stranded once the reader actually looks.
 *
 * WHAT THIS PROOF CAN AND CANNOT SIMULATE
 * ------------------------------------------------------------------------
 * A CI runner cannot reproduce iOS's own suspension of requestAnimationFrame
 * in a background tab -- headless Chromium and WebKit keep ticking regardless
 * of visibility. What this proof CAN and DOES exercise faithfully is the
 * exact signal the fix is built on: `document.visibilityState` and the
 * `visibilitychange` event, overridden here via an init script installed
 * BEFORE any page script runs, so the arrival's own gating logic sees a
 * genuinely hidden document exactly as it would on a real device, then a
 * genuine transition to visible. That the fix does the right thing on that
 * signal is the whole content of the fix; MapLibre's internal animation
 * driver is not this repository's code to prove.
 *
 * Before the fix this test fails two ways: the arrival starts anyway while
 * "hidden" (arrival_attempts > 0 before visibility), and/or it never
 * recovers afterwards. Run on both `chromium` and `webkit`, at 393 px --
 * the width and touch class the architect's phone actually is.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CURRENT = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const GENERATION = CURRENT.generation;

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

// A fixed GB point, matching the pattern of the technology-bucket proof --
// no repd_ref, so no dependency on the live register.
const query = new URLSearchParams({
  technology: 'solar', latitude: '52.6369', longitude: '-1.1398',
  zoom: '12', project: 'GRIDATLAS_PROOF_visibility', capacity_mw: '10'
});
const url = `http://127.0.0.1:${port}/atlas/?${query}`;

const ENGINES = [
  { name: 'chromium', launcher: chromium, mobile: true },
  { name: 'webkit', launcher: webkit, mobile: false }   // Playwright's isMobile emulation is Chromium-only
];
const engineFilter = String(process.env.GRIDATLAS_BROWSER_ENGINE || '').trim();
const selectedEngines = engineFilter ? ENGINES.filter((e) => e.name === engineFilter) : ENGINES;
assert.ok(selectedEngines.length, `no engine matched GRIDATLAS_BROWSER_ENGINE=${engineFilter}`);

const failures = [];
function check(label, condition, detail) {
  if (condition) { console.log(`  [PASS] ${label}`); }
  else { console.log(`  [FAIL] ${label}${detail ? ' -- ' + detail : ''}`); failures.push(label); }
}

try {
  for (const engine of selectedEngines) {
    console.log(`\n=== ${engine.name} ===`);
    const browser = await engine.launcher.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 }, hasTouch: true,
      ...(engine.mobile ? { isMobile: true } : {})
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));

    // Installed BEFORE any page script runs, so the arrival's own gating
    // sees a genuinely hidden document from the very first line of JS --
    // the same as a real tab opened in the background.
    await page.addInitScript(() => {
      let state = 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
      window.__gridatlasProofSetVisibility = (next) => {
        state = next;
        document.dispatchEvent(new Event('visibilitychange'));
      };
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction((generation) =>
      document.documentElement.dataset.gridatlasGeneration === generation,
    GENERATION, { timeout: 120_000 });
    await page.waitForFunction(() =>
      window.__GRIDATLAS_MODULES__?.menuBar?.installed === true,
    null, { timeout: 120_000 });

    // The arrival must recognise the hidden document and defer itself.
    await page.waitForFunction(() =>
      window.__GRIDATLAS_NEON_LINKS__?.arrival_deferred_for_visibility === true,
    null, { timeout: 30_000 });

    // Wait past the OLD 12s budget while still hidden. Nothing should have
    // been attempted, let alone completed.
    await page.waitForTimeout(14_000);
    const whileHidden = await page.evaluate(() => ({
      visibilityState: document.visibilityState,
      links_drawn: window.__GRIDATLAS_NEON_LINKS__?.links_drawn ?? null,
      camera: window.__GRIDATLAS_NEON_LINKS__?.camera_from_link ?? null,
      attempts: window.__GRIDATLAS_NEON_LINKS__?.arrival_attempts ?? null,
      failures: window.__GRIDATLAS_NEON_LINKS__?.failures ?? null
    }));
    check(`${engine.name}: document really reads hidden`,
      whileHidden.visibilityState === 'hidden');
    check(`${engine.name}: the arrival was never attempted while hidden `
      + '(the old code would have started, burned the 12s budget, and failed)',
      whileHidden.attempts === 0, JSON.stringify(whileHidden));
    check(`${engine.name}: the camera never flew while hidden`,
      whileHidden.camera === null, JSON.stringify(whileHidden.camera));
    check(`${engine.name}: nothing drawn while hidden`,
      whileHidden.links_drawn === 0, String(whileHidden.links_drawn));
    check(`${engine.name}: no spurious "layer controls" failure was recorded `
      + 'for time nobody could see spent',
      Array.isArray(whileHidden.failures) && whileHidden.failures.length === 0,
      JSON.stringify(whileHidden.failures));

    // Now the tab is actually shown.
    await page.evaluate(() => window.__gridatlasProofSetVisibility('visible'));

    try {
      await page.waitForFunction(() =>
        (window.__GRIDATLAS_NEON_LINKS__?.links_drawn ?? 0) > 0,
      null, { timeout: 60_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        link: window.__GRIDATLAS_NEON_LINKS__ ? {
          links_drawn: window.__GRIDATLAS_NEON_LINKS__.links_drawn,
          camera_from_link: window.__GRIDATLAS_NEON_LINKS__.camera_from_link,
          arrival_attempts: window.__GRIDATLAS_NEON_LINKS__.arrival_attempts,
          arrival_resumed_on_visibility: window.__GRIDATLAS_NEON_LINKS__.arrival_resumed_on_visibility,
          failures: window.__GRIDATLAS_NEON_LINKS__.failures
        } : null
      }));
      throw new Error(`${engine.name}: arrival never recovered after becoming visible: `
        + `${JSON.stringify(diagnostic)}`, { cause: error });
    }

    const afterVisible = await page.evaluate(() => ({
      links_drawn: window.__GRIDATLAS_NEON_LINKS__.links_drawn,
      camera: window.__GRIDATLAS_NEON_LINKS__.camera_from_link,
      failures: window.__GRIDATLAS_NEON_LINKS__.failures,
      resumed: window.__GRIDATLAS_NEON_LINKS__.arrival_resumed_on_visibility,
      popupText: document.querySelector('.maplibregl-popup-content')
        ?.innerText.replace(/\s+/g, ' ').trim() || ''
    }));
    check(`${engine.name}: the camera flew to the requested coordinates once visible`,
      afterVisible.camera?.longitude === -1.1398 && afterVisible.camera?.latitude === 52.6369,
      JSON.stringify(afterVisible.camera));
    check(`${engine.name}: links were drawn once visible`,
      afterVisible.links_drawn > 0, String(afterVisible.links_drawn));
    check(`${engine.name}: the project card is on screen`,
      /GRIDATLAS_PROOF_visibility/.test(afterVisible.popupText), afterVisible.popupText);
    check(`${engine.name}: the resumed-on-visibility counter recorded the recovery`,
      afterVisible.resumed >= 1, String(afterVisible.resumed));
    check(`${engine.name}: no page errors across the whole run`,
      pageErrors.length === 0, pageErrors.join(' | '));

    await context.close();
    await browser.close();
  }

  console.log(`\n${failures.length === 0 ? 'ALL' : 'SOME'} checks passed (${failures.length} failure(s))`);
  if (failures.length) {
    console.error('\nFAILURES');
    for (const failure of failures) console.error('  ' + failure);
    process.exitCode = 1;
  } else {
    console.log('the arrival never runs hidden, and never stays stranded once seen.');
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
