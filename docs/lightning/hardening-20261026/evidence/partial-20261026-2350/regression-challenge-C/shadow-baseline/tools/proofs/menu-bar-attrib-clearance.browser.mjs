#!/usr/bin/env node
/**
 * Proof: the OpenStreetMap / CARTO / Open Charge Map credit
 * (`.custom-map-attrib`, in the immutable shell) is never occluded by the
 * v9.107 menu bar (`atlas/modules/202609031958-menu-bar.js`), at any width.
 *
 * Measured live by the architect on the composed Atlas:
 *
 *   - at rest, desktop widths (1425, 2327 CSS px): `.custom-map-attrib`
 *     rect y=15, `document.elementFromPoint()` at its centre returned
 *     `NAV#gridatlas-menu-bar` / `#gridatlas-menu-bar-title-4` -- the ABOUT
 *     title, not the credit. `document.body.className === ""`.
 *   - a phone-class viewport (456x906): the same page read as clear, rect
 *     y~47, because a touch arrival calls `window.enterFullscreen()`
 *     (`atlas/parts/*-exact-repd-delegation.js` etc.), which sets
 *     `fs-active`, which the shell's own
 *     `body.fs-active .custom-map-attrib{top:44px}` rule answers. Desktop
 *     never calls `enterFullscreen()`, so that rule never fires there.
 *
 * So the credit's safety depended on a class a desktop visit never sets.
 * The architect's rule is absolute: "the attributions MUST NEVER BE
 * COVERED" -- at every width, not only the one a touch arrival happens to
 * reach. The fix in the menu-bar module clears the credit whenever the bar
 * is hosted (`.gridatlas-menu-hosted`, unconditional -- no width media
 * query, no dependency on `fs-active`), by an offset MEASURED from the
 * bar's own `getBoundingClientRect().height` (36px at rest, 34px under the
 * module's own `@media(max-width:700px)` rule) and kept current by a
 * ResizeObserver; the ONE fallback constant (44px, the value the shell
 * already used for fs-active) is written once, for the instant before the
 * bar has measured itself, not duplicated per breakpoint.
 *
 * This is an occlusion proof, not an existence proof: asserting that
 * `.custom-map-attrib` exists, or is visible/opaque/z-indexed, would have
 * passed on the broken page at every width tested here -- that is exactly
 * how the defect shipped. The only assertion that would have caught it is
 * the one every check below makes: `document.elementFromPoint()` at the
 * credit's own centre must resolve INSIDE `.custom-map-attrib`.
 *
 * WIDTHS is deliberately the five the architect named: 393 and 456 (the two
 * phone widths measured live), 768 (tablet / the module's own 700px
 * breakpoint boundary), 1280 and 2327 (the two desktop widths measured
 * live, where the defect actually reproduced). Each is checked with the
 * body AT REST (className === "", no fs-active) -- the strict case, since
 * that is what a desktop visit always is and what a touch arrival is for
 * however long it takes enterFullscreen() to run.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const menuPath = path.join(ROOT, 'atlas', 'modules', '202609031958-menu-bar.js');

// The immutable shell's own rules for the credit, copied verbatim from
// atlas/releases/202608300453-atlas-v9/ventusv8.css lines 27-30 -- not
// restated from memory, so a change to the shell CSS this proof does not
// know about shows up as a diff against this file, not a silent miss.
const SHELL_ATTRIB_CSS = `
.custom-map-attrib { position: absolute; top: 10px; left: 10px; background: rgba(5, 5, 5, 0.7); color: #888; font-family: 'Courier New', monospace; font-size: 9px; border-radius: 4px; padding: 4px 8px; z-index: 10; border: 1px solid #333; pointer-events: auto; max-width: calc(100% - 60px); line-height: 1.6; }
.custom-map-attrib a { color: #00ffff; text-decoration: none; }
.custom-map-attrib a:hover { text-decoration: underline; }
body.fs-active .custom-map-attrib { top: 44px; }
`;

const engineIds = Array.from({ length: 60 }, (_, index) =>
  index === 37 ? 'dlr' : `engine-${index}`);
const engineControls = engineIds.map((id) => `
  <label class="key-item"><input type="checkbox" data-layer-id="${id}">
    <span data-base-label="${id}">${id}</span></label>`).join('');
const pipelineControls = ['same-tech', 'wider-fleet', 'all-pipeline'].map((id) => `
  <label class="key-item"><input type="checkbox" data-pn-layer="${id}">
    <span data-pn-label="${id}">${id}</span></label>`).join('');

function fixtureHtml(bodyClass) {
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  html,body{margin:0;width:100%;height:100%;font:12px sans-serif;background:#071217}
  .map-container{position:relative;width:100%;height:100%}
  .map-controls{position:absolute;top:50px;left:4px}
  .scada-wrapper{position:fixed;left:12px;top:580px;z-index:2;color:white}
  .key-item{display:block;min-height:22px}
  ${SHELL_ATTRIB_CSS}
</style></head><body${bodyClass ? ` class="${bodyClass}"` : ''}>
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
    <!-- the real shell element: immutable, restyled only from a cartridge -->
    <div class="custom-map-attrib">Data &copy; OpenStreetMap contributors | &copy; CARTO | EV data &copy; Open Charge Map</div>
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
  </div>
</body></html>`;
}

async function attribHit(page) {
  return page.locator('.custom-map-attrib').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      insideAttrib: !!top && (top === node || node.contains(top)),
      hitTag: top?.tagName || null,
      hitId: top?.id || null,
      hitClass: top?.className || '',
      computedTop: getComputedStyle(node).top,
      barHeight: document.getElementById('gridatlas-menu-bar')?.getBoundingClientRect().height ?? null,
      clearanceVar: getComputedStyle(document.documentElement)
        .getPropertyValue('--gridatlas-menu-bar-clear').trim(),
    };
  });
}

async function installedHit(page, { width, height, touch }) {
  const context = await page.context().browser().newContext({
    viewport: { width, height },
    ...(touch ? { isMobile: true, hasTouch: true } : {}),
  });
  const p = await context.newPage();
  const pageErrors = [];
  p.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
  await p.setContent(fixtureHtml(''));

  const before = await attribHit(p);

  await p.addScriptTag({ path: menuPath });
  await p.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true);
  // The clearance is applied by a ResizeObserver callback, which the spec
  // schedules for a later animation frame than script execution -- wait for
  // that frame rather than for a fix-specific side effect (the CSS variable
  // may legitimately never appear on unfixed code, and that must read as a
  // clean FAIL below, not a hung wait).
  await p.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(resolve))));

  const bodyClass = await p.evaluate(() => document.body.className);
  const hit = await attribHit(p);
  await context.close();
  return { before, bodyClass, hit, pageErrors };
}

const failures = [];
function check(label, condition, detail) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
  } else {
    console.log(`  [FAIL] ${label}${detail ? ' -- ' + detail : ''}`);
    failures.push(label);
  }
}

// The five widths the architect named: two phone widths measured live
// (393, 456), the module's own 700px breakpoint boundary (768), and the
// two desktop widths where the defect actually reproduced (1280, 2327).
const WIDTHS = [
  { width: 393, height: 852, touch: true },
  { width: 456, height: 906, touch: true },
  { width: 768, height: 1024, touch: false },
  { width: 1280, height: 800, touch: false },
  { width: 2327, height: 1200, touch: false },
];

const browser = await chromium.launch({ headless: true });
try {
  const anchor = await browser.newContext();
  const anchorPage = await anchor.newPage();

  for (const spec of WIDTHS) {
    const { before, bodyClass, hit, pageErrors } = await installedHit(anchorPage, spec);

    check(`${spec.width}px: fixture reproduces the measured case before the bar installs `
      + '(no bar yet, so the credit is naturally clear)',
      before.insideAttrib === true);
    check(`${spec.width}px: reproduces the exact measured condition -- body.className `
      + 'is empty at rest (no fs-active)',
      bodyClass === '', `got "${bodyClass}"`);
    console.log(`         ${spec.width}px: rect=${JSON.stringify(hit.rect)} `
      + `bar=${hit.barHeight}px clear-var=${hit.clearanceVar} top=${hit.computedTop}`);
    check(`${spec.width}px, body AT REST (not fs-active): elementFromPoint at the `
      + 'credit\'s centre resolves INSIDE .custom-map-attrib, not the menu bar',
      hit.insideAttrib === true,
      `hit ${hit.hitTag}#${hit.hitId}.${hit.hitClass}`);
    check(`${spec.width}px: the clearance was MEASURED from the bar's real rendered `
      + 'height, not a value duplicated per breakpoint',
      hit.barHeight !== null
      && hit.clearanceVar === (Math.ceil(hit.barHeight) + 8) + 'px');
    assert.deepEqual(pageErrors, [],
      `${spec.width}px raised page errors: ${pageErrors.join(' | ')}`);
  }

  // -- body.fs-active set (a completed touch arrival). The rule carries
  //    !important specifically so it keeps winning over the shell's own
  //    body.fs-active .custom-map-attrib{top:44px} rather than the two
  //    fighting back to an accidental match. --
  {
    const context = await browser.newContext({ viewport: { width: 456, height: 906 },
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.setContent(fixtureHtml('fs-active'));
    await page.addScriptTag({ path: menuPath });
    await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(resolve))));
    const hit = await attribHit(page);
    console.log(`         456px fs-active: rect=${JSON.stringify(hit.rect)} `
      + `bar=${hit.barHeight}px clear-var=${hit.clearanceVar} top=${hit.computedTop}`);
    check('456px, body.fs-active (a completed touch arrival): elementFromPoint at the '
      + 'credit\'s centre still resolves INSIDE .custom-map-attrib',
      hit.insideAttrib === true,
      `hit ${hit.hitTag}#${hit.hitId}.${hit.hitClass}`);
    await context.close();
  }

  // -- Resize after install: the bar's own height is watched, not read
  //    once at boot. A tab opened at desktop width and then resized (or
  //    rotated) must not be left with a stale clearance computed for a bar
  //    height it no longer has. --
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.setContent(fixtureHtml(''));
    await page.addScriptTag({ path: menuPath });
    await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() =>
      requestAnimationFrame(resolve))));
    const wide = await attribHit(page);

    await page.setViewportSize({ width: 393, height: 852 });
    try {
      await page.waitForFunction((expected) =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--gridatlas-menu-bar-clear').trim() !== expected,
        wide.clearanceVar, { timeout: 5000 });
    } catch { /* unfixed code never updates the variable; fall through to a clean FAIL below */ }
    const narrow = await attribHit(page);
    console.log(`         resized 1280->393: clear-var ${wide.clearanceVar} -> ${narrow.clearanceVar}`);
    check('a live resize (desktop to phone width) re-measures the bar and updates '
      + 'the clearance, rather than keeping the width it booted at',
      narrow.clearanceVar !== wide.clearanceVar && Math.abs(narrow.barHeight - 34) < 1);
    check('and the credit is still uncovered after the resize',
      narrow.insideAttrib === true);
    await context.close();
  }

  await anchor.close();

  console.log(`\n${failures.length === 0 ? 'ALL' : (WIDTHS.length * 4 + 4 - failures.length)} checks passed`
    + ` (${failures.length} failure(s))`);
  if (failures.length) {
    console.error('\nFAILURES');
    for (const failure of failures) console.error('  ' + failure);
    process.exitCode = 1;
  } else {
    console.log('the credit clears the menu bar at 393, 456, 768, 1280 and 2327 CSS px, '
      + 'at rest, in fs-active, and after a live resize.');
  }
} finally {
  await browser.close();
}
