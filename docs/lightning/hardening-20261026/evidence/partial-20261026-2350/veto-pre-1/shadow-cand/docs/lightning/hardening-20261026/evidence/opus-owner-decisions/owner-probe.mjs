// owner-probe.mjs — opus-owner-decisions lane, issue #32. Read-only observation of the UNMODIFIED candidate.
// Harness: lead-shim (scratchpad/lightning/harness/offline-shim.mjs imported unmodified), Playwright 1.63 Chromium (repo pins 1.62.1).
// Candidate bytes: scratchpad/hardening/wt (HEAD 18842df = fda6b10 + docs-only commit). Served from scratchpad/hardening
// on 127.0.0.1:8197 (and 192.0.2.2:8198 for E3 only). Real clicks / key presses only; no force:true, no synthetic dispatch.
//   E1  R01 keyboard path: Grid opened by real click, then Tab until focus reaches the candidate's footer mirror
//       (or, on the original route, the original's own "⬇ Layers" tab) at 1440x900 and 1280x720; #map-container scrollTop.
//   E2  R02: a v1 index served (SYNTHETIC fixture fixtures/R02-v1-index): what the viewer sees at 7D and for a custom
//       date older than the 7-day feed.
//   E3  Live-route note: the loader's crypto.subtle hash check on a loopback origin vs a LAN-style http origin.
//   E4  R04/R05: 3M overview, then CUSTOM before APPLY, then CUSTOM single day after APPLY; nav button states.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import { writeFileSync } from 'node:fs';

const EV = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/opus-owner-decisions';
const FIX = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures';
const BASE = 'http://127.0.0.1:8197';
const CAND = BASE + '/wt/atlas/v/202610261949/';
const ORIG = BASE + '/wt/atlas/';
const LAN = 'http://192.0.2.2:8198/wt/atlas/v/202610261949/';
const only = (process.argv[2] || 'E1,E2,E3,E4').split(',');
const out = { started: new Date().toISOString(), harness: 'lead-shim', candidateSha: 'fda6b10 (worktree HEAD 18842df, docs-only on top)', experiments: {} };
const browser = await chromium.launch();
out.browser = 'chromium ' + browser.version();
const save = () => writeFileSync(`${EV}/${only.join('') === 'E5' ? 'owner-probe-E5.json' : 'owner-probe.json'}`, JSON.stringify(out, null, 1));

async function open(url, vp, dataDir, extraRoute) {
  const [w, h] = vp.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  const reqs = []; page.on('request', (r) => { if (r.url().includes('raw.githubusercontent.com')) reqs.push(r.url().replace('https://raw.githubusercontent.com/Ventusltd/lightning/main/data/', '')); });
  await installOfflineShim(page, { lightningDataDir: dataDir });
  if (extraRoute) await extraRoute(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { ctx, page, errors, reqs };
}
const ready = async (page) => {
  const boot = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
  return boot;
};
const lightningReady = (page) => page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
const settled = (page, period) => page.waitForFunction((p) => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return s.on && s.last && (!p || s.last.period === p); }, period || null, { timeout: 40000 });

// Lightning snapshot of the native (main) group, all three toggles, the map source and the module state.
const snap = (page) => page.evaluate(() => {
  const g = document.querySelector('#scada-ui-container [data-lightning-group="main"]');
  const S = window.__GRIDATLAS_MODULES__.ukLightning.state;
  const map = window.__GRIDATLAS_V9_MAP__; const src = map && map.getSource('gridatlas-lightning');
  const chips = {}; g.querySelectorAll('[data-lightning-period]').forEach((b) => { chips[b.dataset.lightningPeriod] = (b.classList.contains('active') ? 'active' : '') + (b.disabled ? 'disabled' : '') || 'enabled'; });
  const nav = {}; g.querySelectorAll('[data-lightning-nav]').forEach((b) => { nav[b.dataset.lightningNav] = b.hidden ? 'hidden' : b.disabled ? 'disabled' : 'enabled'; });
  return {
    labels: [...document.querySelectorAll('[data-lightning-label]')].map((n) => n.textContent),
    labelOpacity: [...document.querySelectorAll('[data-lightning-label]')].map((n) => n.style.opacity),
    toggles: [...document.querySelectorAll('[data-lightning-control="toggle"]')].map((t) => t.checked),
    stateText: g.querySelector('.status-dot').lastChild.textContent,
    dot: g.querySelector('[data-lightning-dot]').style.background,
    caption: [...g.querySelectorAll('[data-cap]')].map((n) => n.dataset.cap + ': ' + n.textContent),
    chips, nav,
    custom: { display: g.querySelector('[data-lightning-custom]').style.display, from: g.querySelector('[data-lightning-date="from"]').value, to: g.querySelector('[data-lightning-date="to"]').value },
    mapFeatures: src && src._data && src._data.features ? src._data.features.length : null,
    layerVisibility: map && map.getLayer('l-gridatlas-lightning') ? map.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null,
    module: { on: S.on, period: S.period, requests: S.requests, errors: S.errors.slice(0, 5), indexError: S.ie, last: S.last },
  };
});

async function e1(route, vp) {
  const url = route === 'candidate' ? CAND : ORIG;
  const { ctx, page, errors } = await open(url, vp, `${FIX}/lightning-archive/data`);
  const rec = { url, vp, route };
  rec.boot = await ready(page);
  if (route === 'candidate') await lightningReady(page);
  const targetSel = route === 'candidate' ? '#gridatlas-menu-bar [data-lightning-group="menu"] input' : '#fs-curtain-tab';
  rec.target = targetSel;
  const probe = () => page.evaluate((sel) => {
    const mc = document.getElementById('map-container'); const t = document.querySelector(sel);
    const title = [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].find((b) => b.textContent.trim().startsWith('Grid'));
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    let hit = null;
    if (t) { const b = t.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
      const e = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight ? document.elementFromPoint(x, y) : null;
      const own = t.closest('label') || t;
      hit = !e ? 'outside-viewport' : (e === t || own.contains(e)) ? 'self' : (e.id ? '#' + e.id : (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : e.tagName)); }
    const a = document.activeElement;
    const act = !a ? null : a.getAttribute('data-gridatlas-layer-proxy') || (a.dataset && a.dataset.lightningControl ? 'lightning:' + a.closest('[data-lightning-group]').dataset.lightningGroup : null) || (a.id ? '#' + a.id : a.tagName);
    const firstProxy = document.querySelector('#gridatlas-menu-bar [data-gridatlas-layer-proxy="engine:400"]');
    return { mcScrollTop: mc.scrollTop, mcRect: R(mc), gridExpanded: title ? title.getAttribute('aria-expanded') : null, targetRect: R(t), targetHit: hit, active: act,
      engine400Rect: R(firstProxy), lightningOn: window.__GRIDATLAS_MODULES__?.ukLightning?.state?.on ?? null };
  }, targetSel);
  await page.locator('#gridatlas-menu-bar .gm-title', { hasText: 'Grid' }).click();
  await page.waitForTimeout(400);
  rec.afterOpen = await probe();
  await page.screenshot({ path: `${EV}/shots/E1-${route}-${vp}-1-grid-open.png` });
  let presses = 0; const trail = [];
  for (; presses < 220; presses++) {
    const p = await probe();
    if (presses < 3 || presses % 25 === 0) trail.push(`${presses}:${p.active}:mc${p.mcScrollTop}:exp=${p.gridExpanded}`);
    if (await page.evaluate((sel) => document.activeElement === document.querySelector(sel), targetSel)) break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(15);
  }
  rec.tabPresses = presses; rec.tabTrail = trail;
  rec.atTarget = await probe();
  await page.screenshot({ path: `${EV}/shots/E1-${route}-${vp}-2-target-focused.png` });
  if (route === 'candidate' && rec.atTarget.active === 'lightning:menu') {
    await page.keyboard.press('Space');
    await page.waitForTimeout(2500);
    rec.afterSpace = await probe();
    rec.afterSpaceLabels = await page.evaluate(() => [...document.querySelectorAll('[data-lightning-label]')].map((n) => n.textContent));
    await page.screenshot({ path: `${EV}/shots/E1-${route}-${vp}-3-after-space.png` });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  rec.afterEscape = await probe();
  await page.screenshot({ path: `${EV}/shots/E1-${route}-${vp}-4-after-escape.png` });
  // Can a mouse user undo a scrolled #map-container? Wheel over the map centre (MapLibre consumes wheel for zoom).
  const m = rec.afterEscape.mcRect; await page.mouse.move(m[0] + m[2] / 2, m[1] + m[3] / 2); await page.mouse.wheel(0, -400); await page.waitForTimeout(600);
  rec.afterWheelUp = await probe();
  rec.pageErrors = errors;
  await ctx.close();
  return rec;
}

async function e2() {
  const { ctx, page, errors, reqs } = await open(CAND, '1440x900', `${EV}/fixtures/R02-v1-index/data`);
  const rec = { fixture: 'fixtures/R02-v1-index (SYNTHETIC: lightning-archive with index schema set to v1)', vp: '1440x900' };
  rec.boot = await ready(page); await lightningReady(page);
  await page.locator('#scada-ui-container [data-lightning-control="toggle"]').click(); // auto-scrolls the user-scrollable Layers list
  await settled(page); await page.waitForTimeout(400);
  rec.on24h = await snap(page);
  await page.locator('#scada-ui-container [data-lightning-period="7d"]').click();
  await settled(page, '7d'); await page.waitForTimeout(400);
  rec.on7d = await snap(page);
  await page.locator('#scada-ui-container [data-lightning-group="main"]').screenshot({ path: `${EV}/shots/E2-v1-index-1440x900-7d-group.png` });
  await page.screenshot({ path: `${EV}/shots/E2-v1-index-1440x900-7d-viewport.png` });
  await page.locator('#scada-ui-container [data-lightning-period="custom"]').click();
  await page.locator('#scada-ui-container [data-lightning-date="from"]').fill('2026-10-12');
  await page.locator('#scada-ui-container [data-lightning-date="to"]').fill('2026-10-12');
  await page.locator('#scada-ui-container [data-lightning-nav="apply"]').click();
  await settled(page, 'custom'); await page.waitForTimeout(400);
  rec.customOlderThanFeed = await snap(page);
  await page.locator('#scada-ui-container [data-lightning-group="main"]').screenshot({ path: `${EV}/shots/E2-v1-index-1440x900-custom-2026-10-12-group.png` });
  rec.requests = reqs; rec.pageErrors = errors;
  await ctx.close();
  return rec;
}

async function e3() {
  const state = (page) => page.evaluate(() => ({ origin: location.origin, isSecureContext: window.isSecureContext, subtle: typeof (window.crypto && window.crypto.subtle),
    menuInstalled: !!(window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar && window.__GRIDATLAS_MODULES__.menuBar.installed),
    loaderText: (document.getElementById('gridatlas-loader') || {}).innerText || null }));
  const rec = {};
  const a = await open(CAND, '1440x900', `${FIX}/lightning-archive/data`);
  await ready(a.page); rec.loopback = await state(a.page); rec.loopback.pageErrors = a.errors; await a.ctx.close();
  const b = await open(LAN, '1440x900', `${FIX}/lightning-archive/data`, async (page) => { await page.route((u) => u.host === '192.0.2.2:8198', (r) => r.continue()); });
  await b.page.waitForTimeout(8000);
  rec.lanHttp = await state(b.page); rec.lanHttp.pageErrors = b.errors;
  await b.page.screenshot({ path: `${EV}/shots/E3-lan-http-origin-1440x900.png` });
  await b.ctx.close();
  return rec;
}

async function e4() {
  const { ctx, page, errors, reqs } = await open(CAND, '1440x900', `${FIX}/lightning-archive/data`);
  const rec = { fixture: 'lightning-archive (data-plane builder fixture from the genuine 408 flashes)', vp: '1440x900' };
  rec.boot = await ready(page); await lightningReady(page);
  await page.locator('#scada-ui-container [data-lightning-control="toggle"]').click();
  await settled(page);
  await page.locator('#scada-ui-container [data-lightning-period="3m"]').click();
  await settled(page, '3m'); await page.waitForTimeout(400);
  rec.overview3m = await snap(page);
  await page.locator('#scada-ui-container [data-lightning-group="main"]').screenshot({ path: `${EV}/shots/E4-3m-overview-group.png` });
  await page.locator('#scada-ui-container [data-lightning-period="custom"]').click();
  await page.waitForTimeout(800);
  rec.customBeforeApply = await snap(page);
  await page.locator('#scada-ui-container [data-lightning-group="main"]').screenshot({ path: `${EV}/shots/E4-custom-before-apply-group.png` });
  await page.locator('#scada-ui-container [data-lightning-date="from"]').fill('2026-10-23');
  await page.locator('#scada-ui-container [data-lightning-date="to"]').fill('2026-10-23');
  await page.locator('#scada-ui-container [data-lightning-nav="apply"]').click();
  await settled(page, 'custom'); await page.waitForTimeout(400);
  rec.customApplied = await snap(page);
  await page.locator('#scada-ui-container [data-lightning-group="main"]').screenshot({ path: `${EV}/shots/E4-custom-2026-10-23-applied-group.png` });
  rec.requests = reqs; rec.pageErrors = errors;
  await ctx.close();
  return rec;
}

// E5  R01 option C check: desktop true full-screen (View -> ⛶ by real clicks), then Grid; is the footer mirror hittable?
async function e5(vp) {
  const { ctx, page, errors } = await open(CAND, vp, `${FIX}/lightning-archive/data`);
  const rec = { vp };
  rec.boot = await ready(page); await lightningReady(page);
  await page.locator('#gridatlas-menu-bar .gm-title', { hasText: 'View' }).click(); await page.waitForTimeout(300);
  await page.locator('#btn-fullscreen').click();
  rec.fsActive = await page.waitForFunction(() => document.body.classList.contains('fs-active'), null, { timeout: 5000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(600);
  rec.fullscreenElement = await page.evaluate(() => document.fullscreenElement ? (document.fullscreenElement.id || document.fullscreenElement.className) : null);
  const grid = page.locator('#gridatlas-menu-bar .gm-title', { hasText: 'Grid' });
  if (await page.evaluate(() => { const t = [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].find((b) => b.textContent.trim().startsWith('Grid')); return !t || t.getAttribute('aria-expanded') !== 'true'; })) { await grid.click(); await page.waitForTimeout(400); }
  rec.geometry = await page.evaluate(() => {
    const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const t = document.querySelector('#gridatlas-menu-bar [data-lightning-group="menu"] input'); const own = t && t.closest('label');
    const b = t.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const tab = document.getElementById('fs-curtain-tab'); const tb = tab.getBoundingClientRect(); const te = document.elementFromPoint(tb.x + tb.width / 2, tb.y + tb.height / 2);
    return { mapContainer: R(document.getElementById('map-container')), footerInput: R(t), footerHit: e && (e === t || own.contains(e)) ? 'self' : (e ? (e.id || e.className || e.tagName) : null),
      curtainTab: R(tab), curtainTabHit: te && (te === tab || tab.contains(te)) ? 'self' : (te ? (te.id || te.className || te.tagName) : null) };
  });
  await page.screenshot({ path: `${EV}/shots/E5-candidate-${vp}-fullscreen-grid-open.png` });
  if (rec.geometry.footerHit === 'self') {
    await page.locator('#gridatlas-menu-bar [data-lightning-group="menu"] input').click();
    await page.waitForTimeout(2500);
    rec.afterClick = await page.evaluate(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, labels: [...document.querySelectorAll('[data-lightning-label]')].map((n) => n.textContent),
      captionVisibleOnScreen: (() => { const c = document.querySelector('#scada-ui-container [data-lightning-caption]'); if (!c) return null; const b = c.getBoundingClientRect(); const e = document.elementFromPoint(b.x + 5, b.y + 5); return !!e && c.contains(e); })() }));
    await page.screenshot({ path: `${EV}/shots/E5-candidate-${vp}-fullscreen-after-click.png` });
  }
  rec.pageErrors = errors;
  await ctx.close();
  return rec;
}

try {
  if (only.includes('E5')) { out.experiments.E5 = []; for (const vp of ['1440x900', '1280x720']) { try { out.experiments.E5.push(await e5(vp)); } catch (e) { out.experiments.E5.push({ vp, error: String(e).slice(0, 600) }); } } save(); }
  if (only.includes('E1')) { out.experiments.E1 = []; for (const route of ['candidate', 'original']) for (const vp of ['1440x900', '1280x720']) { try { out.experiments.E1.push(await e1(route, vp)); } catch (e) { out.experiments.E1.push({ route, vp, error: String(e).slice(0, 600) }); } save(); } }
  if (only.includes('E2')) { try { out.experiments.E2 = await e2(); } catch (e) { out.experiments.E2 = { error: String(e).slice(0, 600) }; } save(); }
  if (only.includes('E3')) { try { out.experiments.E3 = await e3(); } catch (e) { out.experiments.E3 = { error: String(e).slice(0, 600) }; } save(); }
  if (only.includes('E4')) { try { out.experiments.E4 = await e4(); } catch (e) { out.experiments.E4 = { error: String(e).slice(0, 600) }; } save(); }
} finally {
  out.finished = new Date().toISOString(); save(); await browser.close();
}
console.log('done', out.started, out.finished);
