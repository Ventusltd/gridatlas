#!/usr/bin/env node
/* footer-clip-probe.mjs — R01/P14 context for P06/P08: is the Grid-footer lightning toggle reachable WITHOUT programmatic
 * scrolling? Measures the clip, elementFromPoint, a mouse-wheel attempt, and what Playwright had to scroll to click it. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const URL_ = arg('--url', 'http://127.0.0.1:8144/wt/atlas/v/202610261949/'), GEN = arg('--generation', '202610261949'), OUT = path.resolve(arg('--out', 'footer-clip'));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const R = { url: URL_, viewports: [] };
for (const [w, h] of [[1440, 900], [1280, 720], [1920, 1080], [393, 852]]) {
  const mobile = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' : undefined, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  await installOfflineShim(page, {});
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(g => document.documentElement.dataset.gridatlasGeneration === g, GEN, { timeout: 60000 });
  await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60 && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true && window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { }); await page.waitForTimeout(2000);
  const grid = page.getByRole('button', { name: 'Grid', exact: true });
  if (mobile) await grid.tap(); else await grid.click(); await page.waitForTimeout(300);
  const geo = () => page.evaluate(() => { const f = document.querySelector('[data-lightning-group="menu"]'); const i = f.querySelector('[data-lightning-control]'); const r = i.getBoundingClientRect(); const mc = document.getElementById('map-container'); const m = mc.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const body = f.closest('.gm-panel').querySelector('.gm-panel-body').getBoundingClientRect(); return { toggleRect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, mapContainerClip: { top: +m.y.toFixed(1), bottom: +m.bottom.toFixed(1), overflow: getComputedStyle(mc).overflow, scrollTop: mc.scrollTop, scrollHeight: mc.scrollHeight, clientHeight: mc.clientHeight }, panelBody: { bottom: +body.bottom.toFixed(1) }, windowScrollY: scrollY, toggleBelowClip: r.y >= m.bottom, elementAtCentre: at ? at.tagName + '#' + at.id + '.' + String(at.className).slice(0, 40) + (at.closest('#scada-ui-container') ? ' (inside native #scada-ui-container)' : at.closest('[data-lightning-group="menu"]') ? ' (the footer itself)' : '') : null }; });
  const before = await geo();
  // user-style attempt: mouse wheel over the open panel body, then over the footer position
  if (!mobile) { await page.mouse.move(before.toggleRect.x + 40, Math.min(h - 10, before.toggleRect.y + 10)); await page.mouse.wheel(0, 300); await page.waitForTimeout(300); }
  const afterWheel = await geo();
  // Playwright click (it may programmatically scroll an overflow:hidden ancestor)
  let click; try { const ft = page.locator('[data-lightning-group="menu"] [data-lightning-control]'); if (mobile) await ft.tap(); else await ft.click(); await page.waitForTimeout(300); click = { ok: true, on: await page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.on) }; } catch (e) { click = { ok: false, error: e.message.split('\n')[0] }; }
  const afterClick = await geo();
  await page.screenshot({ path: path.join(OUT, `footer-after-click-${w}x${h}.png`) });
  R.viewports.push({ viewport: `${w}x${h}`, before, afterWheel, playwrightClick: click, afterClick, verdict: before.toggleBelowClip ? `CLIPPED: toggle top ${before.toggleRect.y} >= #map-container clip bottom ${before.mapContainerClip.bottom}; reached only via scrollTop=${afterClick.mapContainerClip.scrollTop} set programmatically on an overflow:hidden container` : 'inside the clip' });
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'footer-clip.json'), JSON.stringify(R, null, 2));
console.log(JSON.stringify(R.viewports.map(v => ({ vp: v.viewport, toggleY: v.before.toggleRect.y, clipBottom: v.before.mapContainerClip.bottom, at: v.before.elementAtCentre, wheelScrollTop: v.afterWheel.mapContainerClip.scrollTop, click: v.playwrightClick, scrollTopAfterClick: v.afterClick.mapContainerClip.scrollTop, verdict: v.verdict })), null, 1));
await browser.close();
