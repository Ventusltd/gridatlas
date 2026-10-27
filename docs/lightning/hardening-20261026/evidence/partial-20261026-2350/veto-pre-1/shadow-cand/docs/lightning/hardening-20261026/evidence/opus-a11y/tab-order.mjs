#!/usr/bin/env node
// tab-order.mjs <route> <WxH> [on]  — P07 full Tab sequence from page load (real page.keyboard Tab), lead-shim, Chromium headless.
// With "on" the lightning toggle in the Layers panel is switched on by a real keyboard Space before recording.
import fs from 'node:fs';
import { boot, ACTIVE, OUT } from './common.mjs';
const [route = 'baseline', vp = '1440x900', mode = 'off'] = process.argv.slice(2);
const [vw, vh] = vp.split('x').map(Number);
const { browser, page, errors } = await boot(route, { vw, vh });
if (mode === 'on') {
  await page.locator('#scada-ui-container [data-lightning-control="toggle"]').focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.activeElement.blur(); });
}
// start from page load state: focus the document (no element)
await page.evaluate(() => { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
const seq = []; let first = null;
for (let i = 0; i < 700; i++) {
  await page.keyboard.press('Tab');
  const a = await page.evaluate(ACTIVE);
  if (i > 0 && first && a.key === first) { seq.push({ i, wrapped: true }); break; }
  if (!first && !a.body) first = a.key;
  seq.push({ i, ...a });
}
// Shift+Tab reverse for the first 40 positions from the end of the forward run
const rev = [];
for (let i = 0; i < 40; i++) { await page.keyboard.press('Shift+Tab'); const a = await page.evaluate(ACTIVE); rev.push(a.key); }
const file = `${OUT}/tab-${route}-${vp}-${mode}.json`;
fs.writeFileSync(file, JSON.stringify({ harness: 'lead-shim chromium headless', route, viewport: vp, mode, errors, count: seq.length, seq, reverse40: rev }, null, 1));
console.log(file, seq.length, 'errors', errors.length);
await browser.close();
