#!/usr/bin/env node
/* p09-on-click.mjs — regression-challenge-C targeted P09 probe: are original grid features still clickable WHILE lightning
 * is ON (the overlay's circle layer is added on top, no beforeId)? Harness: lead offline shim + fixtures/lightning-archive,
 * real gestures only (locator.click()/tap(), page.mouse.click / page.touchscreen.tap at a projected feature point).
 * Steps: boot -> lightning ON (native toggle) -> 7d chip -> 400 kV ON -> real click on a rendered 400 kV feature (records
 * whether a lightning circle is rendered at the same pixel) -> count original popups -> close -> real click on a rendered
 * lightning flash away from grid features (expect: no page error, no original popup unless an original feature is there)
 * -> 400 kV OFF -> lightning OFF -> map sources/layers equal boot.
 *   node p09-on-click.mjs --viewport 393x852 [--ua iphone] --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [VW, VH] = arg('--viewport', '1440x900').split('x').map(Number); const MOBILE = VW < 700; const UA_KIND = arg('--ua', 'android');
const OUT = path.resolve(arg('--out', 'p09-on')); fs.mkdirSync(OUT, { recursive: true });
const URL_ = arg('--url', 'http://127.0.0.1:8144/wt/atlas/v/202610261949/'); const LABEL = arg('--label', 'before');
const LDIR = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
const tag = `${VW}x${VH}${MOBILE && UA_KIND === 'iphone' ? '-iphone-emulation' : ''}`;
const UA = MOBILE ? (UA_KIND === 'iphone' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36') : undefined;
const R = { url: URL_, label: LABEL, viewport: tag, harness: 'lead-shim + fixtures/lightning-archive, Chromium headless (not WebKit), real gestures', steps: {} };
const save = () => fs.writeFileSync(path.join(OUT, `p09-on-${LABEL}-${tag}.json`), JSON.stringify(R, null, 2));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: MOBILE, hasTouch: MOBILE, userAgent: UA, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(20000);
await installOfflineShim(page, { lightningDataDir: LDIR });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
const act = (loc) => MOBILE ? loc.tap() : loc.click();
const ev = (fn, a) => page.evaluate(fn, a);
const snap = () => ev(() => { const m = window.__GRIDATLAS_V9_MAP__, s = m.getStyle(); return { sources: Object.keys(s.sources).sort(), layers: s.layers.map(l => l.id) }; });
try {
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60 && window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { }); await page.waitForTimeout(2000);
  const boot = await snap();
  if (MOBILE) { const col = await ev(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed')); if (col === 'true' || col === '1') { await act(page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(300); } }
  const toggle = page.locator('#scada-ui-container [data-lightning-control="toggle"]');
  await act(toggle);
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last !== null, null, { timeout: 40000 });
  const chip7 = page.locator('#scada-ui-container button', { hasText: /^7d$/i }).first();
  if (await chip7.count()) { await act(chip7); await page.waitForTimeout(2500); }
  R.steps.lightningOn = await ev(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state, m = window.__GRIDATLAS_V9_MAP__; return { on: S.on, last: S.last && S.last.state, drawn: S.last && S.last.drawn, rendered: m.getLayer('l-gridatlas-lightning') ? m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length : null, topLayer: m.getStyle().layers.at(-1).id }; });
  const inp = page.locator('#scada-ui-container input[data-layer-id="400"]');
  if (!(await inp.isChecked())) await act(inp);
  await page.waitForFunction(() => /\[(OK|EMPTY|FAIL|\d)/.test(document.getElementById('lbl-400')?.textContent || ''), null, { timeout: 60000, polling: 200 });
  if (MOBILE) { await act(page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(300); } // collapse the panel so the map is clickable
  // choose a rendered 400 kV feature point inside the canvas, preferring one that ALSO has a lightning circle at that pixel
  const pick = await ev(async () => {
    const m = window.__GRIDATLAS_V9_MAP__; const lines = m.queryRenderedFeatures({ layers: ['l-400'] }); const b = m.getCanvas().getBoundingClientRect();
    const pts = []; for (const f of lines.slice(0, 400)) { let c = f.geometry.coordinates; while (Array.isArray(c[0])) c = c[Math.floor(c.length / 2)]; const p = m.project(c); if (p.x > 40 && p.y > 60 && p.x < b.width - 40 && p.y < b.height - 40) pts.push({ x: p.x, y: p.y, lng: c[0], lat: c[1] }); }
    const withL = pts.find(p => m.queryRenderedFeatures([p.x, p.y], { layers: ['l-gridatlas-lightning'] }).length > 0);
    const any = pts[0]; const sel = withL || any;
    return sel ? { x: b.left + sel.x, y: b.top + sel.y, lightningAtPixel: !!withL, candidates: pts.length, rendered400: lines.length } : { candidates: 0, rendered400: lines.length };
  });
  R.steps.pick400 = pick;
  if (pick.x) {
    // move the 400 kV point under a lightning circle if none overlapped: fly so a flash and a line coincide is not guaranteed; record honestly
    R.steps.elementAtHit = await ev(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + '.' + String(e.className).slice(0, 40) : null; }, pick);
    if (MOBILE) await page.touchscreen.tap(pick.x, pick.y); else await page.mouse.click(pick.x, pick.y);
    await page.waitForTimeout(700);
    R.steps.click400 = { popups: await page.locator('.maplibregl-popup').count(), text: (await page.locator('.maplibregl-popup').allTextContents()).map(t => t.replace(/\s+/g, ' ').slice(0, 120)) };
    await page.screenshot({ path: path.join(OUT, `p09-on-${LABEL}-${tag}-400-picked.png`) });
    for (const p of await page.locator('.maplibregl-popup').all()) { const cst = p.locator('.gridatlas-card-bar .close'); const close = await cst.count() ? cst : p.locator('.maplibregl-popup-close-button'); await act(close).catch(e => { R.steps.closeError = e.message.slice(0, 100); }); }
  }
  // real click on a rendered lightning flash that has no original feature under it
  const flash = await ev(() => { const m = window.__GRIDATLAS_V9_MAP__, b = m.getCanvas().getBoundingClientRect(); const fs = m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }); const orig = m.getStyle().layers.map(l => l.id).filter(id => id !== 'l-gridatlas-lightning' && m.getLayer(id)?.type !== 'background' && m.getLayer(id)?.type !== 'raster');
    for (const f of fs) { const p = m.project(f.geometry.coordinates); if (p.x < 40 || p.y < 60 || p.x > b.width - 40 || p.y > b.height - 40) continue; const under = m.queryRenderedFeatures([[p.x - 6, p.y - 6], [p.x + 6, p.y + 6]], { layers: orig }); if (!under.length) return { x: b.left + p.x, y: b.top + p.y }; } return null; });
  R.steps.flashPick = flash;
  if (flash) { const before = pageErrors.length; if (MOBILE) await page.touchscreen.tap(flash.x, flash.y); else await page.mouse.click(flash.x, flash.y); await page.waitForTimeout(700); R.steps.clickFlash = { popups: await page.locator('.maplibregl-popup').count(), newPageErrors: pageErrors.slice(before), text: (await page.locator('.maplibregl-popup').allTextContents()).map(t => t.slice(0, 120)) }; await page.screenshot({ path: path.join(OUT, `p09-on-${LABEL}-${tag}-flash-clicked.png`) }); for (const p of await page.locator('.maplibregl-popup').all()) await act(p.locator('.maplibregl-popup-close-button')).catch(() => { }); }
  if (MOBILE) { await act(page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(300); }
  await act(inp); await page.waitForTimeout(400);
  await act(toggle); await page.waitForTimeout(800);
  const after = await snap();
  R.steps.restore = { sourcesEqualBoot: JSON.stringify(after.sources) === JSON.stringify(boot.sources), layersEqualBoot: JSON.stringify(after.layers) === JSON.stringify(boot.layers), l400visibility: await ev(() => window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-400', 'visibility')), lightningOn: await ev(() => window.__GRIDATLAS_MODULES__.ukLightning.state.on) };
  R.pass = !!(R.steps.click400 && R.steps.click400.popups > 0 && R.steps.restore.sourcesEqualBoot && R.steps.restore.layersEqualBoot && pageErrors.length === 0);
} catch (e) { R.error = String(e).slice(0, 400); R.pass = false; }
R.pageErrors = pageErrors; save(); await browser.close();
console.log(`[p09-on ${tag}]`, JSON.stringify({ pass: R.pass, on: R.steps.lightningOn, pick: R.steps.pick400, click400: R.steps.click400 && R.steps.click400.popups, flash: R.steps.clickFlash, restore: R.steps.restore, error: R.error }));
