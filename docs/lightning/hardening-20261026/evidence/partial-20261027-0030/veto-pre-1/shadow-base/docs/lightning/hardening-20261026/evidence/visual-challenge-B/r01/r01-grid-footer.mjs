#!/usr/bin/env node
// r01-grid-footer.mjs — visual-challenge-B, issue #32 R01 (Grid-dropdown Weather mirror in the clipped footer band).
//
// For each viewport (1440x900 and 1280x720 as asked; 1920x1080 and 393x852 as the "hittable elsewhere" control):
//   baseline  /gridatlas/atlas/ (202609241334)        candidate /wt/atlas/v/202610261949/ (202610261949)
//   1. real click on the "Grid" title; measure #map-container, the Grid panel, its head/body, the ORIGINAL
//      "⬇ Layers" tab (#fs-curtain-tab) and (candidate) the footer mirror as built: rect, elementFromPoint at the
//      centre, which overflow ancestor clips it, and whether a REAL wheel gesture over the panel can reveal it.
//   2. candidate only, simulation B (NOT APPLIED TO ANY FILE, page.evaluate in this browser session only): a
//      role="checkbox" row is inserted into .gm-panel-head; the body and every original proxy row are re-measured so
//      the shift B would cause is quantified. Two variants: B1 head row added with the footer left in place,
//      B2 head row added and the footer hidden (what "moving" the mirror would do). Both are removed afterwards.
//   3. side-by-side PNGs composed in Chromium (baseline | candidate | B2 simulation) for the report.
// Harness: lead-shim (offline-shim.mjs unmodified), Chromium headless, real locator.click() / tap, no force:true.
// Lightning stays OFF throughout (no fixture needed; zero lightning requests asserted).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/visual-challenge-B/r01';
const ROUTES = { baseline: 'http://127.0.0.1:8141/gridatlas/atlas/', candidate: 'http://127.0.0.1:8142/wt/atlas/v/202610261949/' };
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const VIEWPORTS = [
  { name: '1440x900', viewport: { width: 1440, height: 900 }, phone: false },
  { name: '1280x720', viewport: { width: 1280, height: 720 }, phone: false },
  { name: '1920x1080', viewport: { width: 1920, height: 1080 }, phone: false, supplemental: true },
  { name: '393x852', viewport: { width: 393, height: 852 }, phone: true, supplemental: true }
];
const R = (b) => ({ x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100, width: Math.round(b.width * 100) / 100, height: Math.round(b.height * 100) / 100, bottom: Math.round(b.bottom * 100) / 100, right: Math.round(b.right * 100) / 100 });

// Everything measured inside the page. `sim` = null | 'B1' | 'B2'.
const MEASURE = `(() => {
  const sg = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + [...e.attributes].filter(a => /^data-(lightning-group|lightning-control|lightning-sim|gridatlas-layer-key)$/.test(a.name)).map(a => '[' + a.name + '=' + a.value + ']').join('') : null;
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100, width: Math.round(b.width * 100) / 100, height: Math.round(b.height * 100) / 100, bottom: Math.round(b.bottom * 100) / 100, right: Math.round(b.right * 100) / 100 }; };
  const hit = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; if (!(b.width > 0 && b.height > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight)) return 'OUT-OF-VIEWPORT'; const t = document.elementFromPoint(cx, cy); if (!t) return 'NONE'; if (t === e || e.contains(t)) return 'self'; if (e.tagName === 'LABEL' && e.control && (t === e.control || e.control.contains(t))) return 'self'; return 'OTHER:' + sg(t); };
  const clip = (e) => { const out = []; if (!e) return out; const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; for (let a = e.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const r = a.getBoundingClientRect(); if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) out.push({ by: sg(a), rect: R(a), overflow: cs.overflow }); } } return out; };
  const mc = document.getElementById('map-container'), panel = document.getElementById('gridatlas-menu-bar-panel-4'), head = panel && panel.querySelector('.gm-panel-head'), body = panel && panel.querySelector('.gm-panel-body'), tab = document.getElementById('fs-curtain-tab');
  const foot = panel && panel.querySelector('[data-lightning-group="menu"]'), footLabel = foot && foot.querySelector('label.gm-layer'), footInput = foot && foot.querySelector('input'), footName = foot && foot.querySelector('.gm-layer-name'), footTitle = foot && foot.querySelector('.gm-layer-group');
  const sim = panel && panel.querySelector('[data-lightning-sim]');
  const proxies = body ? [...body.querySelectorAll('label.gm-layer')] : [];
  const prect = (l) => { const r = R(l); return { key: l.getAttribute('data-gridatlas-layer-key') || (l.querySelector('input') && l.querySelector('input').getAttribute('data-gridatlas-layer-key')) || null, text: (l.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40), x: r.x, y: r.y, width: r.width, height: r.height }; };
  const vis = (l) => { const b = l.getBoundingClientRect(); let top = 0, bottom = innerHeight, left = 0, right = innerWidth; for (let a = l.parentElement; a; a = a.parentElement) { const cs = getComputedStyle(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const r = a.getBoundingClientRect(); top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); left = Math.max(left, r.left); right = Math.min(right, r.right); } } return b.height > 0 && b.top >= top && b.bottom <= bottom; };
  const visible = proxies.filter(vis);
  return {
    innerWidth, innerHeight,
    mapContainer: mc ? { rect: R(mc), overflow: getComputedStyle(mc).overflow, scrollTop: mc.scrollTop, scrollHeight: mc.scrollHeight, clientHeight: mc.clientHeight, position: getComputedStyle(mc).position } : null,
    panel: panel ? { rect: R(panel), position: getComputedStyle(panel).position, overflow: getComputedStyle(panel).overflow, maxHeight: getComputedStyle(panel).maxHeight, scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, children: [...panel.children].map(sg) } : null,
    head: head ? { rect: R(head), hit: hit(head), children: [...head.children].map(sg) } : null,
    body: body ? { rect: R(body), scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, scrollTop: body.scrollTop, maxScrollTop: body.scrollHeight - body.clientHeight, overflow: getComputedStyle(body).overflow, columnCount: getComputedStyle(body).columnCount } : null,
    proxies: { count: proxies.length, visibleCount: visible.length, first: proxies[0] ? prect(proxies[0]) : null, firstVisible: visible[0] ? prect(visible[0]) : null, lastVisible: visible.length ? prect(visible[visible.length - 1]) : null, last: proxies.length ? prect(proxies[proxies.length - 1]) : null, all: proxies.map(prect) },
    curtainTab: tab ? { rect: R(tab), hit: hit(tab), clippedBy: clip(tab), text: (tab.textContent || '').trim(), display: getComputedStyle(tab).display, position: getComputedStyle(tab).position } : null,
    footer: foot ? { rect: R(foot), hidden: foot.hidden, inlineStyle: foot.getAttribute('style'), label: { rect: R(footLabel), hit: hit(footLabel), clippedBy: clip(footLabel) }, input: { rect: R(footInput), hit: hit(footInput), ariaLabel: footInput.getAttribute('aria-label'), checked: footInput.checked }, name: { rect: R(footName), text: footName.textContent, rightEdgeVsPanelRight: Math.round((footName.getBoundingClientRect().right - panel.getBoundingClientRect().right) * 100) / 100, overflowsPanel: footName.getBoundingClientRect().right > panel.getBoundingClientRect().right }, title: { rect: R(footTitle), text: footTitle.textContent } } : null,
    sim: sim ? { rect: R(sim), hit: hit(sim), role: sim.getAttribute('role'), ariaChecked: sim.getAttribute('aria-checked'), parent: sg(sim.parentElement) } : null,
    firstProxyInput: proxies[0] ? (() => { const i = proxies[0].querySelector('input'); const cs = getComputedStyle(i); return { labelRect: R(proxies[0]), inputRect: R(i), transform: cs.transform, width: cs.width, height: cs.height, bodyScrollWidth: body.scrollWidth, bodyClientWidth: body.clientWidth }; })() : null,
    footerInputStyle: footInput ? (() => { const cs = getComputedStyle(footInput); return { transform: cs.transform, width: cs.width, height: cs.height, position: cs.position, inset: cs.inset }; })() : null,
    menuInspect: (window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar && window.__GRIDATLAS_MODULES__.menuBar.inspect) ? window.__GRIDATLAS_MODULES__.menuBar.inspect() : null,
    lightning: window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.ukLightning ? { on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, requests: window.__GRIDATLAS_MODULES__.ukLightning.state.requests } : null
  };
})()`;

// Simulation B (page.evaluate only): a head-slot role="checkbox" row. 'B1' keeps the footer; 'B2' hides it.
const SIMULATE = `((variant) => {
  const panel = document.getElementById('gridatlas-menu-bar-panel-4'), head = panel.querySelector('.gm-panel-head'), foot = panel.querySelector('[data-lightning-group="menu"]');
  const row = document.createElement('div');
  row.className = 'gm-layer'; row.setAttribute('role', 'checkbox'); row.setAttribute('aria-checked', 'false'); row.setAttribute('tabindex', '0'); row.setAttribute('aria-label', 'Lightning flashes (optical)'); row.dataset.lightningSim = variant;
  row.innerHTML = '<span class="gm-layer-box" aria-hidden="true"></span><span class="gm-layer-name">Lightning flashes (optical) [WAIT]</span>';
  head.appendChild(row);
  if (variant === 'B2' && foot) foot.hidden = true;
  return { inserted: true, variant, headChildren: [...head.children].map(e => e.tagName.toLowerCase() + '.' + e.className) };
})`;
const UNSIMULATE = `(() => { const panel = document.getElementById('gridatlas-menu-bar-panel-4'); for (const n of panel.querySelectorAll('[data-lightning-sim]')) n.remove(); const foot = panel.querySelector('[data-lightning-group="menu"]'); if (foot) foot.hidden = false; return panel.querySelectorAll('[data-lightning-sim]').length; })`;

function shiftReport(before, after) {
  const d = (a, b, k) => Math.round(((b?.[k] ?? 0) - (a?.[k] ?? 0)) * 100) / 100;
  const byKey = new Map(before.proxies.all.map(p => [p.key || p.text, p]));
  let moved = 0, maxDy = 0; const samples = [];
  for (const p of after.proxies.all) { const q = byKey.get(p.key || p.text); if (!q) continue; const dy = Math.round((p.y - q.y) * 100) / 100, dx = Math.round((p.x - q.x) * 100) / 100; if (Math.abs(dy) > 1 || Math.abs(dx) > 1) { moved++; maxDy = Math.max(maxDy, Math.abs(dy)); if (samples.length < 3) samples.push({ key: p.key, text: p.text, dx, dy }); } }
  return { headHeightDelta: d(before.head?.rect, after.head?.rect, 'height'), bodyTopDelta: d(before.body?.rect, after.body?.rect, 'y'), bodyHeightDelta: d(before.body?.rect, after.body?.rect, 'height'), bodyClientHeight: [before.body?.clientHeight, after.body?.clientHeight], proxiesMoved: moved, proxiesTotal: after.proxies.all.length, maxProxyDy: maxDy, sampleMoved: samples, visibleProxies: [before.proxies.visibleCount, after.proxies.visibleCount], curtainTabTop: [before.curtainTab?.rect.y, after.curtainTab?.rect.y], simRow: after.sim };
}

async function compose(browser, items, outPath, title) {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    const srcs = items.map(i => ({ label: i.label, b64: fs.readFileSync(i.path).toString('base64') }));
    const png = await page.evaluate(async ([srcs, title]) => {
      const load = (b) => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = 'data:image/png;base64,' + b; });
      const ims = await Promise.all(srcs.map(s => load(s.b64)));
      const gap = 12, top = 34, W = ims.reduce((n, im) => n + im.width, 0) + gap * (ims.length + 1), H = Math.max(...ims.map(im => im.height)) + top + gap;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#202830'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.font = '14px monospace'; x.fillText(title, gap, 20);
      let px = gap; ims.forEach((im, i) => { x.fillStyle = '#ffdf44'; x.fillText(srcs[i].label, px, top - 6); x.drawImage(im, px, top); px += im.width + gap; });
      return c.toDataURL('image/png').split(',')[1];
    }, [srcs, title]);
    fs.writeFileSync(outPath, Buffer.from(png, 'base64'));
  } finally { await context.close(); }
}

const browser = await chromium.launch({ headless: true });
const report = { harness: 'lead-shim (offline-shim.mjs unmodified)', chromium: browser.version(), node: process.version, startedAt: new Date().toISOString(), routes: ROUTES, note: 'Simulation B is page.evaluate-only in this browser session; NO repository or worktree file was modified.', viewports: {} };
for (const vp of VIEWPORTS) {
  const rec = { profile: vp.phone ? 'Chromium Android emulation (Pixel 8 UA, touch) — NOT a real device' : 'desktop Chromium, mouse', routes: {} };
  report.viewports[vp.name] = rec;
  for (const [label, url] of Object.entries(ROUTES)) {
    const context = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 1, isMobile: vp.phone, hasTouch: vp.phone, userAgent: vp.phone ? UA_ANDROID : undefined, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark', reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const shim = await installOfflineShim(page, {});
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
    if (label === 'candidate') await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
    const grid = page.getByRole('button', { name: 'Grid', exact: true }).first();
    if (vp.phone) await grid.tap(); else await grid.click();
    await page.waitForTimeout(400);
    const r = { composition: comp, gridOpen: await grid.getAttribute('aria-expanded'), asBuilt: await page.evaluate(MEASURE) };
    const shot = path.join(OUT, `grid-open-${label}-${vp.name}.png`); await page.screenshot({ path: shot, fullPage: false, animations: 'disabled' }); r.screenshot = shot;
    // REAL wheel gesture over the panel body, then over the panel head: can a user scroll the clipped band into view?
    const bodyRect = r.asBuilt.body?.rect;
    if (bodyRect && !vp.phone) {
      await page.mouse.move(bodyRect.x + bodyRect.width / 2, Math.min(bodyRect.y + 40, vp.viewport.height - 2)); await page.mouse.wheel(0, 5000); await page.waitForTimeout(300);
      r.afterWheelOverBody = { body: (await page.evaluate(MEASURE)).body, curtainTab: (await page.evaluate(MEASURE)).curtainTab, footer: (await page.evaluate(MEASURE)).footer, mapContainerScrollTop: await page.evaluate(() => document.getElementById('map-container').scrollTop) };
      const headRect = r.asBuilt.head?.rect; await page.mouse.move(headRect.x + headRect.width / 2, headRect.y + 10); await page.mouse.wheel(0, 5000); await page.waitForTimeout(300);
      r.afterWheelOverHead = { curtainTab: (await page.evaluate(MEASURE)).curtainTab, footer: (await page.evaluate(MEASURE)).footer, mapContainerScrollTop: await page.evaluate(() => document.getElementById('map-container').scrollTop), bodyScrollTop: (await page.evaluate(MEASURE)).body?.scrollTop };
      const shot2 = path.join(OUT, `grid-open-${label}-${vp.name}-after-wheel.png`); await page.screenshot({ path: shot2, fullPage: false, animations: 'disabled' }); r.screenshotAfterWheel = shot2;
      await page.evaluate(() => { const b = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body'); if (b) b.scrollTop = 0; });   // reset for the simulation (programmatic, documented; not a hit-test claim)
      await page.waitForTimeout(150);
    }
    if (label === 'candidate') {
      // Simulation B (NOT APPLIED): head-slot role=checkbox row, B1 footer kept, B2 footer hidden.
      const before = await page.evaluate(MEASURE);
      for (const variant of ['B1', 'B2']) {
        const ins = await page.evaluate(`(${SIMULATE})(${JSON.stringify(variant)})`); await page.waitForTimeout(150);
        const after = await page.evaluate(MEASURE);
        const shotS = path.join(OUT, `grid-open-candidate-${vp.name}-SIM-${variant}-NOT-APPLIED.png`); await page.screenshot({ path: shotS, fullPage: false, animations: 'disabled' });
        r['simulation' + variant] = { inserted: ins, shift: shiftReport(before, after), after: { head: after.head, body: after.body, sim: after.sim, footer: after.footer, curtainTab: after.curtainTab, proxiesVisible: after.proxies.visibleCount, firstProxy: after.proxies.first, panelScrollWidth: after.panel.scrollWidth }, screenshot: shotS };
        await page.evaluate(`(${UNSIMULATE})()`); await page.waitForTimeout(150);
      }
      const restored = await page.evaluate(MEASURE);
      r.restoredEqualsAsBuilt = JSON.stringify(restored.body) === JSON.stringify(before.body) && JSON.stringify(restored.head) === JSON.stringify(before.head) && restored.panel.children.join() === before.panel.children.join();
    }
    r.shim = shim.summary(); r.pageErrors = errors;
    rec.routes[label] = r;
    await context.close();
    console.log(`[${vp.name}/${label}] panel ${JSON.stringify(r.asBuilt.panel?.rect)} body h=${r.asBuilt.body?.rect.height} tab hit=${r.asBuilt.curtainTab?.hit} footer hit=${r.asBuilt.footer?.input.hit ?? 'n/a'} visibleProxies=${r.asBuilt.proxies.visibleCount}${r.simulationB2 ? ' | B2 shift: ' + JSON.stringify(r.simulationB2.shift) : ''}`);
  }
  // side-by-side composites
  const b = rec.routes.baseline, c = rec.routes.candidate;
  await compose(browser, [{ label: 'A: baseline 202609241334 (Grid open)', path: b.screenshot }, { label: 'A: candidate 202610261949 as built (Grid open, lightning OFF)', path: c.screenshot }, { label: 'B2 SIMULATION (page.evaluate only, NOT APPLIED): head-slot role=checkbox, footer hidden', path: c.simulationB2.screenshot }],
    path.join(OUT, `side-by-side-${vp.name}.png`), `R01 Grid dropdown ${vp.name} — baseline | candidate as built | simulation B (not applied). Harness: lead-shim, Chromium ${browser.version()}`);
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'r01-geometry.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log('written ' + path.join(OUT, 'r01-geometry.json'));
