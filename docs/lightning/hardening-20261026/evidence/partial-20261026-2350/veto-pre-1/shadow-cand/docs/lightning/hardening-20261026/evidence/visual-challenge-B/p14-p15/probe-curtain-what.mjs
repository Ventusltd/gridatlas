// What is under the pointer inside the visible curtain area at desktop 1440x900 fullscreen (baseline route, lead-shim)?
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const url = process.argv[2] || 'http://127.0.0.1:8141/gridatlas/atlas/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
await installOfflineShim(page, {}); await page.goto(url, { waitUntil: 'domcontentloaded' }); await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
await page.getByRole('button', { name: 'View', exact: true }).first().click(); await page.waitForTimeout(300);
await page.locator('#btn-fullscreen').click(); await page.waitForTimeout(700);
if (!(await page.locator('#fs-curtain-tab').isVisible())) { await page.getByRole('button', { name: 'Grid', exact: true }).first().click(); await page.waitForTimeout(300); }
await page.locator('#fs-curtain-tab').click(); await page.waitForTimeout(700);
const info = await page.evaluate(() => { const sg = (e) => { const out = []; for (let a = e; a && out.length < 6; a = a.parentElement) out.push(a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (typeof a.className === 'string' && a.className ? '.' + a.className.split(' ')[0] : '')); return out.join(' < '); };
  const c = document.getElementById('fs-curtain'); const cs = getComputedStyle(c); const r = c.getBoundingClientRect();
  return { curtain: { rect: [r.x, r.y, r.width, r.height], display: cs.display, visibility: cs.visibility, opacity: cs.opacity, z: cs.zIndex, position: cs.position, transform: cs.transform, pointerEvents: cs.pointerEvents, cls: c.className, parent: sg(c.parentElement) }, at: [[1190, 300], [1190, 500], [1100, 200], [1300, 400]].map(p => ({ p, el: sg(document.elementFromPoint(p[0], p[1])) })) }; });
console.log(JSON.stringify(info, null, 1));
for (const p of [[1190, 400]]) { await page.mouse.move(...p); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(250); } }
console.log(JSON.stringify(await page.evaluate(() => { const o = {}; for (const el of document.querySelectorAll('*')) { if (el.scrollTop > 0) o[el.tagName + '#' + el.id + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '')] = el.scrollTop; } const pn = document.querySelector('#fs-curtain-keys input[data-pn-layer]').getBoundingClientRect(); return { scrolled: o, pipelineY: pn.y, gridPanelHidden: document.getElementById('gridatlas-menu-bar-panel-4')?.hidden }; })));
await b.close();
