#!/usr/bin/env node
// probe-on-reflow-and-curtain.mjs — visual-challenge-B follow-up to p14-p15 (desktop):
//  (1) WHY do all 65 original Layers rows change rect when lightning is switched ON? Record #scada-ui-container layout
//      (display, column-count, grid, flex), scrollTop and every original row rect in CONTAINER coordinates
//      (rect - container rect + scrollTop) before and after a REAL click ON, so scroll offset and reflow are separated.
//  (2) Is the fullscreen curtain scrollable by a REAL wheel gesture on BOTH routes (baseline = original behaviour)?
//      elementFromPoint at the wheel point is recorded; the original last group (PIPELINE NEWS) is the reference target.
// Harness: lead-shim; candidate lightningDataDir = fixtures/lightning-archive/data. Real click/wheel only, no force.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/visual-challenge-B/p14-p15';
const ROUTES = { baseline: 'http://127.0.0.1:8141/gridatlas/atlas/', candidate: 'http://127.0.0.1:8142/wt/atlas/v/202610261949/' };
const DATA = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
const VPS = [{ name: 'desktop-1440x900', viewport: { width: 1440, height: 900 } }, { name: 'desktop-1920x1080', viewport: { width: 1920, height: 1080 } }];
const ROWS = () => { const c = document.getElementById('scada-ui-container'); const cr = c.getBoundingClientRect(); const cs = getComputedStyle(c);
  return { layout: { display: cs.display, columnCount: cs.columnCount, columnWidth: cs.columnWidth, gridTemplateColumns: cs.gridTemplateColumns, flexWrap: cs.flexWrap, scrollTop: c.scrollTop, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight },
    groups: [...c.children].map(g => { const b = g.getBoundingClientRect(); return { title: (g.querySelector('.key-title') || {}).textContent || g.tagName, lightning: g.hasAttribute('data-lightning-group'), vx: Math.round(b.x), vy: Math.round(b.y), cx: Math.round(b.x - cr.x), cy: Math.round(b.y - cr.y + c.scrollTop), w: Math.round(b.width), h: Math.round(b.height) }; }),
    rows: [...c.querySelectorAll('.key-group:not([data-lightning-group]) label.key-item')].map(l => { const b = l.getBoundingClientRect(); return [Math.round(b.x - cr.x), Math.round(b.y - cr.y + c.scrollTop), Math.round(b.width), Math.round(b.height), Math.round(b.y)]; }) }; };
const browser = await chromium.launch({ headless: true });
const rep = { harness: 'lead-shim (+fixture lightning-archive on candidate)', chromium: browser.version(), startedAt: new Date().toISOString(), viewports: {} };
for (const vp of VPS) {
  const R = rep.viewports[vp.name] = {};
  for (const route of ['baseline', 'candidate']) {
    const ctx = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
    const page = await ctx.newPage(); await installOfflineShim(page, route === 'candidate' ? { lightningDataDir: DATA } : {});
    await page.goto(ROUTES[route], { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
    const r = R[route] = {};
    if (route === 'candidate') {
      await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
      // reach the checkbox with real wheel gestures over the container
      for (let i = 0; i < 10; i++) { const s = await page.evaluate(() => { const c = document.getElementById('scada-ui-container').getBoundingClientRect(); const t = document.querySelector('#scada-ui-container [data-lightning-control]').getBoundingClientRect(); return { c: [c.x + c.width / 2, c.y + c.height / 2], inVp: t.bottom <= innerHeight && t.top >= 0 }; }); if (s.inVp) break; await page.mouse.move(...s.c); await page.mouse.wheel(0, 400); await page.waitForTimeout(250); }
      r.before = await page.evaluate(ROWS);
      await page.locator('#scada-ui-container [data-lightning-control]').click();
      await page.waitForFunction(() => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return s.last && s.last.state; }, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(600);
      r.after = await page.evaluate(ROWS);
      const movedContainer = r.before.rows.filter((b, i) => b[0] !== r.after.rows[i][0] || b[1] !== r.after.rows[i][1]).length;
      const movedViewport = r.before.rows.filter((b, i) => b[4] !== r.after.rows[i][4] || b[0] !== r.after.rows[i][0]).length;
      r.summary = { rows: r.before.rows.length, movedInContainerCoords: movedContainer, movedInViewportCoords: movedViewport, scrollTopBefore: r.before.layout.scrollTop, scrollTopAfter: r.after.layout.scrollTop, scrollHeight: [r.before.layout.scrollHeight, r.after.layout.scrollHeight],
        groupsMoved: r.before.groups.map((g, i) => ({ title: g.title, before: [g.cx, g.cy, g.w, g.h], after: [r.after.groups[i].cx, r.after.groups[i].cy, r.after.groups[i].w, r.after.groups[i].h] })).filter(x => JSON.stringify(x.before) !== JSON.stringify(x.after)) };
      await page.screenshot({ path: path.join(OUT, `probe-${vp.name}-candidate-after-ON.png`) });
      console.log(`[${vp.name}/reflow] layout=${JSON.stringify(r.before.layout)} ${JSON.stringify(r.summary).slice(0, 900)}`);
      // switch OFF again (real click) so the curtain test runs in the OFF composition
      await page.locator('#scada-ui-container [data-lightning-control]').click(); await page.waitForTimeout(400);
      r.afterOff = await page.evaluate(ROWS); r.summary.rowsBackAfterOFF = JSON.stringify(r.afterOff.rows.map(x => x.slice(0, 4))) === JSON.stringify(r.before.rows.map(x => x.slice(0, 4)));
    }
    // ---- curtain wheel test (both routes): View > fullscreen (real clicks), curtain tab (real click), wheel over curtain
    await page.getByRole('button', { name: 'View', exact: true }).first().click(); await page.waitForTimeout(300);
    await page.locator('#btn-fullscreen').click(); await page.waitForTimeout(700);
    const tabVisible = await page.locator('#fs-curtain-tab').isVisible().catch(() => false);
    if (!tabVisible) { await page.getByRole('button', { name: 'Grid', exact: true }).first().click(); await page.waitForTimeout(300); }
    const tabHit = await page.evaluate(() => { const t = document.getElementById('fs-curtain-tab'); const b = t.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return e === t || t.contains(e); });
    r.curtain = { tabHit };
    if (tabHit) {
      await page.locator('#fs-curtain-tab').click(); await page.waitForTimeout(600);
      const info = await page.evaluate(() => { const c = document.getElementById('fs-curtain'); const b = c.getBoundingClientRect(); const pts = [[b.x + b.width / 2, b.y + b.height / 2]]; for (let y = 60; y < innerHeight; y += 20) { if (pts.length > 1) break; for (let x = 10; x < innerWidth; x += 20) { const e = document.elementFromPoint(x, y); if (e && c.contains(e)) { pts.push([x + 60, y + 120]); break; } } } const sg = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : '') : null; return { rect: [b.x, b.y, b.width, b.height].map(Math.round), open: c.classList.contains('curtain-open'), overflowY: getComputedStyle(c).overflowY, scrollTop: c.scrollTop, max: c.scrollHeight - c.clientHeight, points: pts.map(p => ({ p: p.map(Math.round), top: sg(document.elementFromPoint(p[0], p[1])), insideCurtain: c.contains(document.elementFromPoint(p[0], p[1])) })) }; });
      r.curtain.info = info;
      const pick = info.points.find(p => p.insideCurtain) || info.points[0];
      const steps = [];
      for (let i = 0; i < 10; i++) { await page.mouse.move(pick.p[0], pick.p[1]); await page.mouse.wheel(0, 400); await page.waitForTimeout(250); steps.push(await page.evaluate(() => { const c = document.getElementById('fs-curtain'); const k = document.getElementById('fs-curtain-keys'); const pn = document.querySelector('#fs-curtain-keys input[data-pn-layer]'); const b = pn.getBoundingClientRect(); const hitOf = (el) => { if (!el) return 'ABSENT'; const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'OUT-OF-VIEWPORT'; const t = document.elementFromPoint(x, y); return t && (t === el || el.contains(t) || (t.tagName === 'LABEL' && t.control === el)) ? 'self' : 'OTHER:' + (t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') : 'none'); }; return { curtainScrollTop: c.scrollTop, keysScrollTop: k ? k.scrollTop : null, windowScrollY: scrollY, pipelineRowY: Math.round(b.y), pipelineHit: hitOf(pn), lightningFsHit: hitOf(document.querySelector('#fs-curtain-keys [data-lightning-group="fs"] [data-lightning-control]')) }; })); }
      r.curtain.wheelAt = pick; r.curtain.steps = steps;
      await page.screenshot({ path: path.join(OUT, `probe-${vp.name}-${route}-curtain-after-wheel.png`) });
      console.log(`[${vp.name}/${route}/curtain] ${JSON.stringify({ rect: info.rect, overflowY: info.overflowY, max: info.max, points: info.points, last: steps[steps.length - 1] })}`);
    }
    await ctx.close();
    fs.writeFileSync(path.join(OUT, 'probe-on-reflow-and-curtain.v2.json.partial'), JSON.stringify(rep, null, 2));
  }
}
rep.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'probe-on-reflow-and-curtain.v2.json'), JSON.stringify(rep, null, 2));
await browser.close();
