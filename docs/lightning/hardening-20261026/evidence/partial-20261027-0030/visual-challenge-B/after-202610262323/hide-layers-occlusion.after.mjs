#!/usr/bin/env node
// hide-layers-occlusion.mjs — visual-challenge-B, issue #32 P14 owner-device defect 3 (owner iPhone Safari, 22:44 UTC):
// "the pre-existing sld-sandbox '▾ HIDE LAYERS' fixed button covers the end of the last panel group, here the lightning
// caption lines". Reproduce in Chromium phone emulation (NOT Safari, NOT a real device) at 393x852 and 360x740 (plus
// 390x844 with an iPhone UA, geometry only), Layers open, lightning ON, and compare with the baseline where the same
// button covers the end of the last ORIGINAL group (PIPELINE NEWS (REPD)).
// Harness: lead-shim (offline-shim.mjs unmodified) + lightningDataDir = fixtures/lightning-archive/data (fixture built
// from the genuine 408-flash seed) for the candidate; the baseline makes no lightning request. Real tap() on the LAYERS
// toggle and on the lightning checkbox; REAL wheel gestures (page.mouse.wheel) to scroll; no force:true, no
// programmatic scrolling. Every line box of text inside the measured group is taken from Range.getClientRects(), then
// intersected with the fixed button's rect; elementFromPoint at the centre of the overlap tells who is on top.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/visual-challenge-B/after-202610262323';
const ROUTES = { baseline: 'http://127.0.0.1:8141/gridatlas/atlas/', candidate: 'http://127.0.0.1:8160/wt/atlas/v/202610262323/' };
const DATA = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_ANDROID_SMALL = 'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const VIEWPORTS = [
  { name: 'android-393x852', viewport: { width: 393, height: 852 }, ua: UA_ANDROID },
  { name: 'android-360x740', viewport: { width: 360, height: 740 }, ua: UA_ANDROID_SMALL },
  { name: 'iphone-390x844-geometry-only', viewport: { width: 390, height: 844 }, ua: UA_IPHONE, note: 'Chromium with an iPhone UA; NOT Safari/WebKit' }
];
const ONLY = (process.env.VPS || '').split(',').filter(Boolean);

// Lines of text in a group: one entry per line box, with occlusion by the fixed toggle and visibility inside clip ancestors.
const MEASURE = `((groupSel) => {
  const btn = document.getElementById('gridatlas-dash-toggle');
  const br = btn ? btn.getBoundingClientRect() : null;
  const sg = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') : null;
  const g = typeof groupSel === 'string' ? document.querySelector(groupSel) : null;
  if (!g) return { present: false };
  // clip box = intersection of viewport and every overflow-clipping ancestor of the group
  let clip = { top: 0, bottom: innerHeight, left: 0, right: innerWidth };
  for (let a = g.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const r = a.getBoundingClientRect(); clip = { top: Math.max(clip.top, r.top), bottom: Math.min(clip.bottom, r.bottom), left: Math.max(clip.left, r.left), right: Math.min(clip.right, r.right) }; } }
  const lines = [];
  const walker = document.createTreeWalker(g, NodeFilter.SHOW_TEXT, { acceptNode: (n) => n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  for (let n; (n = walker.nextNode());) {
    const el = n.parentElement; if (!el || el.closest('[hidden]') || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    // merge rects on the same line (same top within 2px)
    const byLine = [];
    for (const r of rects) { const l = byLine.find(x => Math.abs(x.top - r.top) < 2); if (l) { l.left = Math.min(l.left, r.left); l.right = Math.max(l.right, r.right); l.bottom = Math.max(l.bottom, r.bottom); } else byLine.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right }); }
    // approximate the text of each line by splitting the node text proportionally (labelled approximate)
    const txt = n.textContent.replace(/\\s+/g, ' ').trim();
    byLine.forEach((l, i) => {
      const visibleInClip = l.bottom > clip.top && l.top < clip.bottom;
      const ov = br ? { left: Math.max(l.left, br.left), right: Math.min(l.right, br.right), top: Math.max(l.top, br.top), bottom: Math.min(l.bottom, br.bottom) } : null;
      const overlapArea = ov && ov.right > ov.left && ov.bottom > ov.top ? (ov.right - ov.left) * (ov.bottom - ov.top) : 0;
      let topAtOverlap = null;
      if (overlapArea > 0) { const t = document.elementFromPoint((ov.left + ov.right) / 2, (ov.top + ov.bottom) / 2); topAtOverlap = t === btn || (btn && btn.contains(t)) ? 'HIDE-LAYERS-BUTTON' : sg(t); }
      const lineArea = (l.right - l.left) * (l.bottom - l.top);
      lines.push({ owner: sg(el), cap: el.closest('[data-cap]') ? el.closest('[data-cap]').getAttribute('data-cap') : null, textApprox: byLine.length > 1 ? '(' + (i + 1) + '/' + byLine.length + ') ' + txt.slice(0, 80) : txt.slice(0, 80), rect: [l.left, l.top, l.right - l.left, l.bottom - l.top].map(v => Math.round(v * 10) / 10), visibleInClip, overlapPx: Math.round(overlapArea), overlapPctOfLine: lineArea ? Math.round(overlapArea / lineArea * 1000) / 10 : 0, topAtOverlap });
    });
  }
  const gr = g.getBoundingClientRect();
  const sc = document.getElementById('scada-ui-container'); const scs = sc ? getComputedStyle(sc) : null;
  return { present: true, group: sg(g), title: (g.querySelector('.key-title') || {}).textContent || null, groupRect: [gr.left, gr.top, gr.width, gr.height].map(v => Math.round(v * 10) / 10), clip: Object.fromEntries(Object.entries(clip).map(([k, v]) => [k, Math.round(v * 10) / 10])),
    button: btn ? { text: btn.textContent, rect: [br.left, br.top, br.width, br.height].map(v => Math.round(v * 10) / 10), position: getComputedStyle(btn).position, zIndex: getComputedStyle(btn).zIndex, hidden: btn.hidden, ariaLabel: btn.getAttribute('aria-label') } : null,
    scroll: { windowScrollY: scrollY, docScrollHeight: document.documentElement.scrollHeight, innerHeight, container: sc ? { scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight, max: sc.scrollHeight - sc.clientHeight, overflowY: scs.overflowY, paddingBottom: scs.paddingBottom, rect: (() => { const r = sc.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(v => Math.round(v * 10) / 10); })() } : null },
    lines, linesVisible: lines.filter(l => l.visibleInClip).length, linesOccluded: lines.filter(l => l.visibleInClip && l.overlapPx > 0 && l.topAtOverlap === 'HIDE-LAYERS-BUTTON').length,
    occludedText: lines.filter(l => l.visibleInClip && l.overlapPx > 0 && l.topAtOverlap === 'HIDE-LAYERS-BUTTON').map(l => (l.cap ? '[' + l.cap + '] ' : '') + l.textApprox + ' (' + l.overlapPctOfLine + '% of line)') };
})`;

async function wheelToEnd(page, phone) {
  // REAL wheel gestures over the layers container until neither the container nor the window scrolls any further.
  const steps = [];
  for (let i = 0; i < 30; i++) {
    const s = await page.evaluate(() => { const c = document.getElementById('scada-ui-container'); const r = c.getBoundingClientRect(); return { st: c.scrollTop, wy: scrollY, cx: r.left + r.width / 2, cy: Math.max(60, Math.min(innerHeight - 120, r.top + r.height / 2)) }; });
    await page.mouse.move(s.cx, s.cy); await page.mouse.wheel(0, 500); await page.waitForTimeout(220);
    const t = await page.evaluate(() => ({ st: document.getElementById('scada-ui-container').scrollTop, wy: scrollY }));
    steps.push({ i, containerScrollTop: t.st, windowScrollY: t.wy });
    if (t.st === s.st && t.wy === s.wy) break;
  }
  return { gesture: 'page.mouse.wheel(0,500) over #scada-ui-container per step' + (phone ? ' (Chromium touch emulation; NOT a finger drag)' : ''), steps: steps.length, final: steps[steps.length - 1] };
}
const HIT = `((sel) => { const e = document.querySelector(sel); if (!e) return 'ABSENT'; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; if (!(b.width > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight)) return 'OUT-OF-VIEWPORT'; const t = document.elementFromPoint(cx, cy); if (!t) return 'NONE'; if (t === e || e.contains(t) || (t.tagName === 'LABEL' && t.control === e)) return 'self'; if (t.id === 'gridatlas-dash-toggle') return 'HIDE-LAYERS-BUTTON'; return 'OTHER:' + t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (typeof t.className === 'string' && t.className ? '.' + t.className.split(' ')[0] : ''); })`;

// Playwright does NOT invoke a function-valued STRING with an argument (it returns undefined); evaluate the source and call it.
const ev = (page, src, arg) => page.evaluate(([s, a]) => (0, eval)(s)(a), [src, arg]);

const browser = await chromium.launch({ headless: true });
const report = { harness: 'lead-shim; candidate lightningDataDir=' + DATA + ' (fixture from the genuine 408-flash seed); Chromium phone emulation, NOT Safari', chromium: browser.version(), node: process.version, routes: ROUTES, startedAt: new Date().toISOString(), viewports: {} };
const outFile = path.join(OUT, 'hide-layers-occlusion.json');
for (const vp of VIEWPORTS.filter(v => !ONLY.length || ONLY.includes(v.name))) {
  const rec = report.viewports[vp.name] = { profile: 'Chromium phone emulation (isMobile, hasTouch, ' + (vp.note || 'Android UA') + ')' };
  for (const route of ['baseline', 'candidate']) {
    const context = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: vp.ua, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
    const page = await context.newPage();
    const shim = await installOfflineShim(page, route === 'candidate' ? { lightningDataDir: DATA } : {});
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    const r = rec[route] = { url: ROUTES[route] };
    await page.goto(ROUTES[route], { waitUntil: 'domcontentloaded', timeout: 180000 });
    await waitForComposition(page, { deadlineMs: 180000, settleMs: 2500 });
    if (route === 'candidate') await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 120000 });
    // open Layers by a REAL tap on the LAYERS toggle (the same fixed button) when collapsed
    r.toggleBefore = await page.evaluate(() => { const t = document.getElementById('gridatlas-dash-toggle'); return t ? { text: t.textContent, ariaPressed: t.getAttribute('aria-pressed') } : null; });
    r.toggleHitBefore = await ev(page, HIT, '#gridatlas-dash-toggle');
    if (r.toggleBefore && r.toggleBefore.ariaPressed === 'true' && r.toggleHitBefore === 'self') { await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(500); }
    r.toggleAfterOpen = await page.evaluate(() => { const t = document.getElementById('gridatlas-dash-toggle'); return t ? { text: t.textContent, ariaPressed: t.getAttribute('aria-pressed') } : null; });
    r.lastOriginalGroupTitle = await page.evaluate(() => { const gs = [...document.querySelectorAll('#scada-ui-container .key-group:not([data-lightning-group])')]; const g = gs[gs.length - 1]; return g ? (g.querySelector('.key-title') || {}).textContent : null; });
    // measuring selector that works on both routes without touching the DOM: nth-of-type count from the original group list
    const origCount = await page.evaluate(() => document.querySelectorAll('#scada-ui-container .key-group:not([data-lightning-group])').length);
    const origSel = `#scada-ui-container > .key-group:nth-child(${await page.evaluate(() => { const gs = [...document.querySelectorAll('#scada-ui-container .key-group:not([data-lightning-group])')]; const g = gs[gs.length - 1]; return [...g.parentElement.children].indexOf(g) + 1; })})`;
    r.originalGroupCount = origCount; r.lastOriginalSelector = origSel;
    if (route === 'candidate') {
      // reach the lightning checkbox with REAL wheel gestures, back off if the fixed button sits on it, then tap it ON
      const ctl = '#scada-ui-container [data-lightning-group="main"] [data-lightning-control]';
      r.scrollToEndOFF = await wheelToEnd(page, true);
      r.atEndOFF = { lightning: await ev(page, MEASURE, '#scada-ui-container [data-lightning-group="main"]'), lastOriginal: await ev(page, MEASURE, origSel), checkboxHit: await ev(page, HIT, ctl) };
      await page.screenshot({ path: path.join(OUT, `${vp.name}-candidate-layers-end-OFF.png`) });
      let hit = r.atEndOFF.checkboxHit; const backoff = [];
      for (let i = 0; hit !== 'self' && i < 8; i++) { const c = await page.evaluate(() => { const r = document.getElementById('scada-ui-container').getBoundingClientRect(); return [r.left + r.width / 2, Math.max(60, Math.min(innerHeight - 120, r.top + r.height / 2))]; }); await page.mouse.move(c[0], c[1]); await page.mouse.wheel(0, -60); await page.waitForTimeout(200); hit = await ev(page, HIT, ctl); backoff.push(hit); }
      r.checkboxBackoff = backoff;
      if (hit === 'self') { await page.locator(ctl).tap(); r.toggledOnBy = 'real tap on the lightning checkbox'; } else r.toggledOnBy = 'NOT toggled: checkbox not hit-testable (' + hit + ')';
      await page.waitForFunction(() => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return s.on && s.last && s.last.state; }, null, { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(800);
      r.lightningState = await page.evaluate(() => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return { on: s.on, last: s.last, requests: s.requests }; });
      r.scrollToEndON = await wheelToEnd(page, true);
      r.atEndON = { lightning: await ev(page, MEASURE, '#scada-ui-container [data-lightning-group="main"]'), lastOriginal: await ev(page, MEASURE, origSel) };
      await page.screenshot({ path: path.join(OUT, `${vp.name}-candidate-layers-end-ON.png`) });
      const g = page.locator('#scada-ui-container [data-lightning-group="main"]');
      try { await g.screenshot({ path: path.join(OUT, `${vp.name}-candidate-lightning-group-ON-element.png`) }); } catch (e) { r.groupShotError = String(e).slice(0, 120); }
    } else {
      r.scrollToEnd = await wheelToEnd(page, true);
      r.atEnd = { lastOriginal: await ev(page, MEASURE, origSel) };
      await page.screenshot({ path: path.join(OUT, `${vp.name}-baseline-layers-end.png`) });
      r.lightningRequests = 0;
    }
    r.pageErrors = errors; r.shim = shim.summary ? shim.summary() : null;
    await context.close();
    const a = route === 'candidate' ? r.atEndON : r.atEnd;
    console.log(`[${vp.name}/${route}] btn=${JSON.stringify(a.lastOriginal.button && a.lastOriginal.button.rect)} lastOriginal(${r.lastOriginalGroupTitle}) occluded=${a.lastOriginal.linesOccluded}/${a.lastOriginal.linesVisible} ${JSON.stringify(a.lastOriginal.occludedText)}` + (route === 'candidate' ? ` | lightning ON(${r.lightningState && r.lightningState.last && r.lightningState.last.state}) occluded=${a.lightning.linesOccluded}/${a.lightning.linesVisible} ${JSON.stringify(a.lightning.occludedText)} | OFF occluded=${r.atEndOFF.lightning.linesOccluded}` : ''));
    fs.writeFileSync(outFile + '.partial', JSON.stringify(report, null, 2) + '\n');
  }
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log('written ' + outFile);
