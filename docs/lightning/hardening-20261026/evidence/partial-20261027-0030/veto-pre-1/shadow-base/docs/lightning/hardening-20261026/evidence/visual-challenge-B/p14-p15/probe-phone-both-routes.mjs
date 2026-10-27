// visual-challenge-B: phone 393x852 (Chromium Android emulation), BOTH routes, lightning OFF, lead-shim.
// (a) Layers opened by real tap, container wheeled to the end (real wheel), Grid opened by real tap: who sits on the
//     original "⬇ Layers" curtain tab (#fs-curtain-tab) and on the candidate's Grid footer mirror?
// (b) View > fullscreen (real taps) > curtain tab (real tap): is ANY point inside #fs-curtain hit-testable?
import fs from 'node:fs';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/visual-challenge-B/p14-p15/';
const ROUTES = { baseline: 'http://127.0.0.1:8141/gridatlas/atlas/', candidate: 'http://127.0.0.1:8142/wt/atlas/v/202610261949/' };
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const HIT = (sel) => { const e = document.querySelector(sel); if (!e) return 'ABSENT'; const b = e.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight || !b.width) return 'OUT-OF-VIEWPORT'; const t = document.elementFromPoint(x, y); if (!t) return 'NONE'; if (t === e || e.contains(t) || (t.tagName === 'LABEL' && t.control === e)) return 'self'; const g = t.closest('.key-group'); return 'OTHER:' + t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (g ? ' in group "' + ((g.querySelector('.key-title') || {}).textContent || '') + '"' + (g.hasAttribute('data-lightning-group') ? ' [lightning]' : '') : ''); };
const b = await chromium.launch(); const rep = {};
for (const route of ['baseline', 'candidate']) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: UA, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  await installOfflineShim(page, {}); await page.goto(ROUTES[route], { waitUntil: 'domcontentloaded' }); await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
  const r = rep[route] = {};
  await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(500);
  for (let i = 0; i < 12; i++) { const c = await page.evaluate(() => { const r = document.getElementById('scada-ui-container').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await page.mouse.move(...c); await page.mouse.wheel(0, 500); await page.waitForTimeout(200); }
  r.layersScrollTop = await page.evaluate(() => document.getElementById('scada-ui-container').scrollTop);
  await page.getByRole('button', { name: 'Grid', exact: true }).first().tap(); await page.waitForTimeout(400);
  r.gridOpenLayersOpen = { curtainTab: await page.evaluate(HIT, '#fs-curtain-tab'), footerMirror: await page.evaluate(HIT, '[data-lightning-group="menu"] [data-lightning-control]'), firstProxy: await page.evaluate(HIT, '#gridatlas-menu-bar-panel-4 [data-gridatlas-layer-key="engine:400"]') };
  await page.screenshot({ path: OUT + `probe-393x852-${route}-layers-open-grid-open.png` });
  await page.getByRole('button', { name: 'Grid', exact: true }).first().tap(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'View', exact: true }).first().tap(); await page.waitForTimeout(300);
  r.fsBtn = await page.evaluate(HIT, '#btn-fullscreen'); if (r.fsBtn === 'self') await page.locator('#btn-fullscreen').tap(); await page.waitForTimeout(700);
  if (!(await page.locator('#fs-curtain-tab').isVisible())) { await page.getByRole('button', { name: 'Grid', exact: true }).first().tap(); await page.waitForTimeout(300); }
  r.tab = await page.evaluate(HIT, '#fs-curtain-tab'); if (r.tab === 'self') { await page.locator('#fs-curtain-tab').tap(); await page.waitForTimeout(700); }
  r.curtain = await page.evaluate(() => { const c = document.getElementById('fs-curtain'); const b = c.getBoundingClientRect(); let inside = 0, total = 0; const tops = {}; for (let y = 10; y < innerHeight; y += 20) for (let x = 10; x < innerWidth; x += 20) { total++; const e = document.elementFromPoint(x, y); if (e && c.contains(e)) inside++; else if (e && y > b.y && y < b.bottom) { const k = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''); tops[k] = (tops[k] || 0) + 1; } } return { open: c.classList.contains('curtain-open'), rect: [b.x, b.y, b.width, b.height].map(Math.round), z: getComputedStyle(c).zIndex, hittablePointsInside: inside, sampled: total, coveredBy: tops, fsActive: document.body.classList.contains('fs-active') }; });
  await page.screenshot({ path: OUT + `probe-393x852-${route}-fullscreen-curtain.png` });
  console.log(route, JSON.stringify(r)); await ctx.close();
}
fs.writeFileSync(OUT + 'probe-phone-both-routes.json', JSON.stringify(rep, null, 2)); await b.close();
