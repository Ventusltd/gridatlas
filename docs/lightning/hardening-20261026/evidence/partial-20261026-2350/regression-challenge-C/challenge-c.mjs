#!/usr/bin/env node
/* challenge-c.mjs — regression-challenge-C targeted probes: P05 control inventory, P06 event semantics, P07 keyboard,
 * P08 real taps, P09 layering, P12 mutation storm, P16 boot budget. Harness: lead-shim (installOfflineShim), real gestures
 * only (locator.click()/tap(), page.keyboard, page.mouse, page.touchscreen); never force:true; no synthetic dispatch for hit claims.
 *
 *   node challenge-c.mjs --route baseline|candidate --url <base> --generation <gen> --viewport 1440x900 --out <dir>
 *        [--lightning-data-dir <fixtures>/lightning-archive/data] [--idle-ms 30000] [--ua iphone]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ROUTE = arg('--route', 'baseline');
const URL_ = arg('--url', 'http://127.0.0.1:8143/gridatlas/atlas/');
const GEN = arg('--generation', '202609241334');
const [VW, VH] = arg('--viewport', '1440x900').split('x').map(Number);
const OUT = path.resolve(arg('--out', `challenge/${ROUTE}/${VW}x${VH}`));
const LDIR = arg('--lightning-data-dir', '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data');
const IDLE = Number(arg('--idle-ms', '30000'));
const UA_KIND = arg('--ua', 'android');
const MOBILE = VW < 700;
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
fs.mkdirSync(OUT, { recursive: true });
const R = { route: ROUTE, url: URL_, generation: GEN, viewport: { width: VW, height: VH, mobile: MOBILE, touch: MOBILE, ua: MOBILE ? (UA_KIND === 'iphone' ? 'iPhone UA (Chromium emulation of geometry/UA only, NOT WebKit: BLOCKED_HARNESS for real Safari)' : 'Android Chrome UA') : 'desktop' }, harness: 'lead-shim (installOfflineShim) + lightningDataDir ' + LDIR, startedAt: new Date().toISOString(), phases: {}, errors: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(R, null, 2));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }).catch(e => R.errors.push('shot ' + name + ': ' + e.message));
const log = (...a) => console.log(`[C ${ROUTE} ${VW}x${VH}]`, ...a);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: MOBILE, hasTouch: MOBILE, userAgent: MOBILE ? (UA_KIND === 'iphone' ? IPHONE_UA : ANDROID_UA) : undefined, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const shim = await installOfflineShim(page, { lightningDataDir: LDIR });
// Early in-page instrumentation: long tasks, boot milestones, body mutation counters (installed before any page script).
await page.addInitScript(() => {
  window.__C = { longTasks: [], milestones: {}, muts: null };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__C.longTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (e) { }
  const mark = (k) => { if (!(k in window.__C.milestones)) window.__C.milestones[k] = Math.round(performance.now()); };
  const poll = setInterval(() => {
    try {
      if (window.__GRIDATLAS_V9_MAP__) mark('map_object');
      if (document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60) mark('proxies_60');
      if (window.__GRIDATLAS_MODULES__?.menuBar?.installed === true) mark('menuBar_installed');
      if (window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true) mark('ukLightning_installed');
      if (window.__GRIDATLAS_MODULES__?.menuBar?.installed === true && (!window.__GRIDATLAS_MODULES__?.ukLightning || window.__GRIDATLAS_MODULES__.ukLightning.state.installed) && performance.now() > 20000) clearInterval(poll);
    } catch (e) { }
  }, 25);
});
const requests = [], responses = [], failed = [], consoleErrors = [], pageErrors = [];
page.on('request', r => requests.push({ url: r.url(), type: r.resourceType(), t: Date.now() }));
page.on('response', async r => { let len = null; try { const h = r.headers()['content-length']; if (h) len = Number(h); else if (r.status() === 200) len = (await r.body()).length; } catch { } responses.push({ url: r.url(), status: r.status(), bytes: len }); });
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const scripts = new Map();
cdp.on('Debugger.scriptParsed', e => scripts.set(e.scriptId, e.url));
await cdp.send('Debugger.enable');

const LIGHT_RE = /raw\.githubusercontent\.com\/Ventusltd\/lightning\//;
const inPage = (fn, a) => page.evaluate(fn, a);
const metrics = async () => { const m = await cdp.send('Performance.getMetrics'); return Object.fromEntries(m.metrics.filter(x => /JSHeapUsedSize|JSHeapTotalSize|TaskDuration|ScriptDuration|LayoutCount|RecalcStyleCount|Nodes|JSEventListeners|Timestamp/.test(x.name)).map(x => [x.name, x.value])); };

/* ------------------------------------------------------------------ boot */
async function boot() {
  const t0 = Date.now();
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const waits = {};
  try { await page.waitForFunction(g => document.documentElement.dataset.gridatlasGeneration === g, GEN, { timeout: 60000 }); waits.generation_ms = Date.now() - t0; } catch { waits.generation_ms = 'timeout'; }
  try { await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60 && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 }); waits.boot_ms = Date.now() - t0; } catch { waits.boot_ms = 'timeout'; }
  if (ROUTE === 'candidate') { try { await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 }); waits.lightning_installed_ms = Date.now() - t0; } catch { waits.lightning_installed_ms = 'timeout'; } }
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); waits.idle_ms = Date.now() - t0; } catch { waits.idle_ms = 'timeout'; }
  await page.waitForTimeout(3000);
  const inpage = await inPage(() => ({ milestones: window.__C.milestones, longTasks: window.__C.longTasks, resources: performance.getEntriesByType('resource').map(e => ({ name: e.name.slice(0, 120), transfer: e.transferSize, encoded: e.encodedBodySize, decoded: e.decodedBodySize, dur: Math.round(e.duration) })), nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; })() }));
  const bytes = responses.reduce((n, r) => n + (r.bytes || 0), 0);
  const byHost = {}; for (const r of responses) { const h = new URL(r.url).host; byHost[h] = byHost[h] || { n: 0, bytes: 0 }; byHost[h].n++; byHost[h].bytes += r.bytes || 0; }
  R.phases.boot = { waits, policy: 'generation<=60s; map+60 proxies+menuBar<=90s; (candidate: ukLightning.installed<=30s); networkidle<=20s; fixed 3s', milestones_ms_from_nav: inpage.milestones, longTasks: { count: inpage.longTasks.length, total_ms: inpage.longTasks.reduce((n, t) => n + t.duration, 0), max_ms: Math.max(0, ...inpage.longTasks.map(t => t.duration)), list: inpage.longTasks.slice(0, 40) }, requests: { total: requests.length, responses: responses.length, failed: failed.length, bytes_total: bytes, byHost, lightning_requests: requests.filter(r => LIGHT_RE.test(r.url)).map(r => r.url), resource_entries: inpage.resources.length, encoded_sum: inpage.resources.reduce((n, e) => n + (e.encoded || 0), 0) }, shim: shim.summary(), nav: inpage.nav, metrics_after_boot: await metrics(), consoleErrors: consoleErrors.slice(), pageErrors: pageErrors.slice() };
  log('boot', JSON.stringify(waits), 'requests', requests.length, 'bytes', bytes);
  await shot(page, '01-boot');
}

/* ------------------------------------------------------------- inventory */
const INVENTORY = () => {
  const q = (s, root = document) => [...root.querySelectorAll(s)];
  const host = document.getElementById('scada-ui-container'), fs = document.getElementById('fs-curtain-keys'), bar = document.getElementById('gridatlas-menu-bar');
  const groups = (r) => r ? q('.key-group', r).map(g => (g.querySelector('.key-title')?.textContent || '').trim() + (g.dataset.lightningGroup ? ' {lightning}' : '')) : null;
  const M = window.__GRIDATLAS_MODULES__ || {};
  return {
    inspect: M.menuBar?.inspect?.() ?? null,
    menuBar_state: M.menuBar ? { installed: M.menuBar.installed, layer_controls: M.menuBar.layer_controls, engine: M.menuBar.engine_layer_controls, pipeline: M.menuBar.pipeline_layer_controls, controls_moved: M.menuBar.controls_moved, failure: M.menuBar.failure, listeners: M.menuBar.listeners } : null,
    proxies: q('[data-gridatlas-layer-proxy]').length, proxy_keys_unique: new Set(q('[data-gridatlas-layer-proxy]').map(e => e.getAttribute('data-gridatlas-layer-proxy'))).size,
    markers_data_gridatlas_layer_key: q('[data-gridatlas-layer-key]').length,
    gm_layer_labels_total: q('#gridatlas-menu-bar .gm-layer').length, gm_layer_boxes: q('#gridatlas-menu-bar .gm-layer-box').length,
    basemap_menu_radios_excluded: q('#gridatlas-menu-bar input[name="gridatlas-menu-basemap"]').length,
    basemap_native_radios_excluded: q('#scada-ui-container input[type="radio"][name="bm"]').length, basemap_fs_radios_excluded: q('#fs-curtain-keys input[name="bm-fs"]').length,
    engine_inputs_native: q('#scada-ui-container input[data-layer-id]').length, pn_inputs_native: q('#scada-ui-container input[data-pn-layer]').length,
    engine_inputs_fs: q('#fs-curtain-keys input[data-layer-id]').length, pn_inputs_fs: q('#fs-curtain-keys input[data-pn-layer]').length,
    engine_inputs_anywhere: q('input[data-layer-id]').length, pn_inputs_anywhere: q('input[data-pn-layer]').length,
    native_groups: groups(host), fs_groups: groups(fs), gm_group_headings: q('#gridatlas-menu-bar .gm-layer-group').map(e => e.textContent.trim()),
    lightning: { inputs: q('[data-lightning-control]').length, checked: q('[data-lightning-control]:checked').length, groups: q('[data-lightning-group]').map(g => g.dataset.lightningGroup), has_forbidden_attrs: q('[data-lightning-group] [data-layer-id],[data-lightning-group] [data-pn-layer],[data-lightning-group] [data-gridatlas-layer-proxy],[data-lightning-group] [data-gridatlas-layer-key],[data-lightning-group] [name="bm"],[data-lightning-group] [id^="lbl-"]').length, state: M.ukLightning ? { on: M.ukLightning.state.on, installed: M.ukLightning.state.installed, requests: M.ukLightning.state.requests, timer: !!M.ukLightning.state.timer, errors: M.ukLightning.state.errors.slice(), last: M.ukLightning.state.last } : null },
    menu_titles: q('#gridatlas-menu-bar .gm-title').map(e => e.textContent.trim()),
    style_tags: q('style').length, style_ids: q('style').map(s => s.id || '(anon)'),
    scada_collapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') ?? null,
    page_scroll: { scrollY: window.scrollY, scrollHeight: document.documentElement.scrollHeight, innerHeight, bodyScrollHeight: document.body.scrollHeight, overflowHtml: getComputedStyle(document.documentElement).overflowY, overflowBody: getComputedStyle(document.body).overflowY }
  };
};
const MAP_SNAPSHOT = () => { const m = window.__GRIDATLAS_V9_MAP__; if (!m) return null; const st = m.getStyle(); return { sources: Object.keys(st.sources).sort(), layers: st.layers.map(l => ({ id: l.id, type: l.type, source: l.source || null, visibility: (() => { try { return m.getLayoutProperty(l.id, 'visibility') || 'visible'; } catch { return '?'; } })() })), layerCount: st.layers.length, lightning: { source: !!m.getSource('gridatlas-lightning'), layer: !!m.getLayer('l-gridatlas-lightning') } }; };

/* ------------------------------------------------------- CDP listeners */
async function listeners(label) {
  const targets = [['window', 'window'], ['document', 'document'], ['html', 'document.documentElement'], ['body', 'document.body'], ['#gridatlas-menu-bar', "document.getElementById('gridatlas-menu-bar')"], ['Grid .gm-panel', "document.querySelector('#gridatlas-menu-bar .gm-panel-grid')"], ['Grid .gm-panel-body', "document.querySelector('#gridatlas-menu-bar .gm-panel-body')"], ['#scada-ui-container', "document.getElementById('scada-ui-container')"], ['.scada-wrapper', "document.querySelector('.scada-wrapper')"], ['#fs-curtain-keys', "document.getElementById('fs-curtain-keys')"], ['#fs-curtain', "document.getElementById('fs-curtain')"], ['.map-container', "document.querySelector('.map-container')"], ['.maplibregl-canvas', "document.querySelector('.maplibregl-canvas')"], ['.maplibregl-canvas-container', "document.querySelector('.maplibregl-canvas-container')"], ['#search-input', "document.getElementById('search-input')"], ['#gridatlas-dash-toggle', "document.getElementById('gridatlas-dash-toggle')"], ['first engine input', "document.querySelector('#scada-ui-container input[data-layer-id]')"], ['first proxy', "document.querySelector('[data-gridatlas-layer-proxy]')"], ['lightning footer', "document.querySelector('[data-lightning-group=\"menu\"]')"], ['lightning main group', "document.querySelector('[data-lightning-group=\"main\"]')"]];
  const out = {};
  for (const [name, expr] of targets) {
    try {
      const { result } = await cdp.send('Runtime.evaluate', { expression: expr, objectGroup: 'c' });
      if (!result.objectId) { out[name] = null; continue; }
      const { listeners: ls } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: 0 });
      out[name] = ls.map(l => ({ type: l.type, capture: l.useCapture, passive: l.passive, once: l.once, script: (scripts.get(l.scriptId) || '?').replace(/^blob:https?:\/\/[^/]+\//, 'blob:'), line: l.lineNumber + 1, col: l.columnNumber + 1 }));
    } catch (e) { out[name] = { error: e.message }; }
  }
  await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'c' }).catch(() => { });
  const cart = await inPage(() => Object.fromEntries([...document.querySelectorAll('script[data-gridatlas-cartridge]')].map(s => [s.dataset.gridatlasCartridge, s.src.replace(/^blob:https?:\/\/[^/]+\//, 'blob:')])));
  const sldBlob = cart['sld-sandbox'];
  const flat = Object.entries(out).flatMap(([node, ls]) => Array.isArray(ls) ? ls.map(l => ({ node, ...l, owner: l.script === sldBlob ? (l.line > 8666 ? 'LIGHTNING MODULE (sld cartridge line > 8666)' : 'sld-sandbox live bytes') : (Object.entries(cart).find(([, u]) => u === l.script)?.[0] || l.script) })) : []);
  R.phases['listeners_' + label] = { cartridgeBlobs: cart, nodes: out, capture_phase: flat.filter(l => l.capture), lightning_module_listeners: flat.filter(l => /LIGHTNING/.test(l.owner)), total: flat.length };
  log('listeners', label, 'total', flat.length, 'capture', flat.filter(l => l.capture).length, 'lightning', flat.filter(l => /LIGHTNING/.test(l.owner)).length);
}

/* ----------------------------------------------------------- gestures */
const act = async (loc) => MOBILE ? loc.tap() : loc.click();
const activeEl = () => inPage(() => { const a = document.activeElement; if (!a) return null; return { tag: a.tagName, id: a.id || null, text: (a.textContent || '').trim().slice(0, 40), proxy: a.getAttribute('data-gridatlas-layer-proxy'), lightning: a.getAttribute('data-lightning-control') || a.getAttribute('data-lightning-period') || a.getAttribute('data-lightning-nav') || a.getAttribute('data-lightning-date') || null, type: a.type || null, name: a.name || null, role: a.getAttribute('role'), ariaLabel: a.getAttribute('aria-label'), checked: a.checked ?? null, inBar: !!a.closest('#gridatlas-menu-bar'), inGridPanel: !!a.closest('.gm-panel-grid') }; });
const openMenus = () => inPage(() => [...document.querySelectorAll('#gridatlas-menu-bar .gm-menu.gm-open .gm-title')].map(t => t.textContent.trim()));
const box = async (loc) => { const b = await loc.boundingBox(); return b ? { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), inViewport: b.x >= 0 && b.y >= 0 && b.x + b.width <= VW && b.y + b.height <= VH } : null; };
const hitTest = async (loc) => { const b = await loc.boundingBox(); if (!b) return null; return inPage(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? { tag: el.tagName, id: el.id || null, cls: String(el.className).slice(0, 60), text: (el.textContent || '').trim().slice(0, 40) } : null; }, { x: b.x + b.width / 2, y: b.y + b.height / 2 }); };

async function p06_menus() {
  const P = { six: [], bodyClick: null, gridArrowDown: null, layersToggle: null, searchFocus: null, fullscreen: null, errors: [] };
  const titles = ['File', 'Edit', 'View', 'Scope', 'Grid', 'About'];
  for (const t of titles) {
    try {
      const btn = page.getByRole('button', { name: t, exact: true });
      await act(btn); await page.waitForTimeout(250);
      const afterOpen = await openMenus(); const expanded = await btn.getAttribute('aria-expanded');
      const panelVisible = await inPage((t) => { const title = [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].find(x => x.textContent.trim() === t); const p = title?.parentNode.querySelector('.gm-panel'); if (!p) return null; const r = p.getBoundingClientRect(); return { hidden: p.hidden, w: +r.width.toFixed(1), h: +r.height.toFixed(1), x: +r.x.toFixed(1), y: +r.y.toFixed(1), insideViewport: r.x >= 0 && r.right <= innerWidth }; }, t);
      await shot(page, `06-menu-${t}`);
      await act(btn); await page.waitForTimeout(250);
      const afterClose = await openMenus();
      P.six.push({ title: t, afterOpen, expanded, panel: panelVisible, afterClose, ok: afterOpen.length === 1 && afterOpen[0] === t && expanded === 'true' && afterClose.length === 0 });
    } catch (e) { P.six.push({ title: t, error: e.message.slice(0, 200) }); }
  }
  // body click closes an open menu: open Grid, then a real click/tap on the map area below the bar (not on the panel)
  try {
    await act(page.getByRole('button', { name: 'Grid', exact: true })); await page.waitForTimeout(250);
    const before = await openMenus();
    const spot = await inPage(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-menu.gm-open .gm-panel')?.getBoundingClientRect(); const c = document.querySelector('.maplibregl-canvas')?.getBoundingClientRect(); // a canvas point outside the panel
      const cands = [{ x: c.x + 40, y: c.y + c.height - 60 }, { x: c.x + c.width - 60, y: c.y + c.height - 60 }, { x: c.x + 40, y: c.y + 60 }]; return cands.find(pt => !p || !(pt.x >= p.left && pt.x <= p.right && pt.y >= p.top && pt.y <= p.bottom)) || null; });
    const under = await inPage(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? { tag: el.tagName, cls: String(el.className).slice(0, 60), id: el.id } : null; }, spot);
    if (MOBILE) await page.touchscreen.tap(spot.x, spot.y); else await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(300);
    const after = await openMenus();
    P.bodyClick = { spot, elementUnderSpot: under, before, after, ok: before.length === 1 && after.length === 0 };
  } catch (e) { P.bodyClick = { error: e.message.slice(0, 200) }; }
  // Grid ArrowDown: focus the Grid title (real click to focus then Escape to close, or Tab), then ArrowDown
  try {
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const grid = page.getByRole('button', { name: 'Grid', exact: true });
    await grid.focus(); // keyboard-user entry point; focus() is not a click and makes no hit-test claim
    const focusedBefore = await activeEl();
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
    const focused = await activeEl(); const open = await openMenus();
    const firstInPanel = await inPage(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-panel-grid'); const f = p?.querySelector('button,input,[role="button"]'); return f ? { tag: f.tagName, proxy: f.getAttribute('data-gridatlas-layer-proxy'), lightning: f.getAttribute('data-lightning-control'), text: (f.textContent || '').trim().slice(0, 30) } : null; });
    P.gridArrowDown = { focusedBefore, open, focused, firstFocusableInPanel: firstInPanel, landsOnEngine400: focused?.proxy === 'engine:400' };
    await shot(page, '06-grid-arrowdown');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    P.gridArrowDown.escapeRestoresFocusToGrid = (await activeEl())?.text === 'Grid'; P.gridArrowDown.openAfterEscape = await openMenus();
  } catch (e) { P.gridArrowDown = { error: e.message.slice(0, 200) }; }
  // native Layers toggle (#gridatlas-dash-toggle)
  try {
    const t = page.locator('#gridatlas-dash-toggle');
    const state0 = await inPage(() => ({ collapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed'), rect: (() => { const r = document.getElementById('scada-ui-container')?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; })(), toggleText: document.getElementById('gridatlas-dash-toggle')?.textContent.trim() }));
    await act(t); await page.waitForTimeout(400);
    const state1 = await inPage(() => ({ collapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed'), rect: (() => { const r = document.getElementById('scada-ui-container')?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; })(), toggleText: document.getElementById('gridatlas-dash-toggle')?.textContent.trim(), firstGroupVisible: (() => { const g = document.querySelector('#scada-ui-container .key-group'); if (!g) return null; const r = g.getBoundingClientRect(); return r.width > 0 && r.height > 0; })() }));
    await shot(page, '06-layers-toggled');
    await act(t); await page.waitForTimeout(400);
    const state2 = await inPage(() => ({ collapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed'), toggleText: document.getElementById('gridatlas-dash-toggle')?.textContent.trim() }));
    P.layersToggle = { before: state0, afterFirst: state1, afterSecond: state2, toggles: state0.collapsed !== state1.collapsed && state2.collapsed === state0.collapsed };
  } catch (e) { P.layersToggle = { error: e.message.slice(0, 200) }; }
  // search focus intact
  try {
    const s = page.locator('#search-input');
    await act(s); await page.waitForTimeout(150);
    const f1 = await activeEl();
    await page.keyboard.type('Leicester'); await page.waitForTimeout(150);
    const v = await s.inputValue(); const f2 = await activeEl();
    await s.fill(''); await page.keyboard.press('Escape');
    P.searchFocus = { focusedAfterClick: f1, valueTyped: v, focusedAfterTyping: f2, ok: f1?.id === 'search-input' && v === 'Leicester' && f2?.id === 'search-input' };
  } catch (e) { P.searchFocus = { error: e.message.slice(0, 200) }; }
  // fullscreen + curtain: View > fullscreen (real), then the curtain tab (real)
  try {
    await act(page.getByRole('button', { name: 'View', exact: true })); await page.waitForTimeout(200);
    await act(page.locator('#btn-fullscreen'));
    await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 8000 }).catch(() => { });
    await page.waitForTimeout(600);
    const fsState = await inPage(() => ({ fullscreenElement: document.fullscreenElement?.id || document.fullscreenElement?.tagName || null, bodyClass: document.body.className, titles: [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].map(t => t.textContent.trim()), tab: (() => { const t = document.getElementById('fs-curtain-tab'); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, visible: r.width > 0 && r.height > 0, inBar: !!t.closest('#gridatlas-menu-bar'), text: t.textContent.trim().slice(0, 40) }; })(), curtain: (() => { const c = document.getElementById('fs-curtain'); if (!c) return null; const r = c.getBoundingClientRect(); return { cls: c.className, x: r.x, y: r.y, w: r.width, h: r.height, display: getComputedStyle(c).display, transform: getComputedStyle(c).transform }; })() }));
    let curtainOpened = null;
    const tab = page.locator('#fs-curtain-tab');
    if (await tab.count()) {
      // the tab lives inside the Grid panel once adopted: open Grid first if needed
      const inBar = await inPage(() => !!document.getElementById('fs-curtain-tab')?.closest('#gridatlas-menu-bar'));
      if (inBar) { await act(page.getByRole('button', { name: 'Grid', exact: true })); await page.waitForTimeout(250); }
      const tb = await box(tab); const ht = await hitTest(tab);
      await act(tab); await page.waitForTimeout(600);
      const after = await inPage(() => { const c = document.getElementById('fs-curtain'); const r = c?.getBoundingClientRect(); const keys = document.getElementById('fs-curtain-keys'); return { cls: c?.className, x: r?.x, y: r?.y, w: r?.width, h: r?.height, display: c ? getComputedStyle(c).display : null, transform: c ? getComputedStyle(c).transform : null, groups: keys ? [...keys.querySelectorAll('.key-group')].map(g => (g.querySelector('.key-title')?.textContent || '').trim() + (g.dataset.lightningGroup ? ' {lightning}' : '')) : null, firstGroupRect: (() => { const g = keys?.querySelector('.key-group'); const r = g?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; })(), lastGroupRect: (() => { const gs = keys?.querySelectorAll('.key-group'); const g = gs && gs[gs.length - 1]; const r = g?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height, inViewport: r.y + r.height <= innerHeight } : null; })(), fsEngineInputs: keys?.querySelectorAll('input[data-layer-id]').length }; });
      await shot(page, '06-curtain-open');
      // real click on an engine input inside the curtain toggles the original (bound by the engine's own change listener)
      let toggleViaCurtain = null;
      try { const inp = page.locator('#fs-curtain-keys input[data-layer-id="400"]'); const before = await inPage(() => ({ main: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked, fs: document.querySelector('#fs-curtain-keys input[data-layer-id="400"]')?.checked })); await act(inp); await page.waitForTimeout(500); const mid = await inPage(() => ({ main: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked, fs: document.querySelector('#fs-curtain-keys input[data-layer-id="400"]')?.checked, vis: (() => { try { return window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-400', 'visibility'); } catch (e) { return String(e); } })() })); await act(inp); await page.waitForTimeout(400); const after2 = await inPage(() => ({ main: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked, fs: document.querySelector('#fs-curtain-keys input[data-layer-id="400"]')?.checked })); toggleViaCurtain = { before, afterOn: mid, afterOff: after2, ok: mid.main === true && mid.fs === true && after2.main === false }; } catch (e) { toggleViaCurtain = { error: e.message.slice(0, 160) }; }
      curtainOpened = { tabBox: tb, tabHit: ht, after, toggleViaCurtain };
      // close curtain via the tab again
      try { await act(tab); await page.waitForTimeout(400); } catch { }
    }
    // exit fullscreen through View > Exit full screen, else keyboard
    try { await act(page.getByRole('button', { name: 'View', exact: true })); await page.waitForTimeout(200); const exit = page.locator('#btn-fullscreen-exit'); if (await exit.count() && await exit.isVisible()) await act(exit); else await page.keyboard.press('Escape'); } catch { await page.keyboard.press('Escape'); }
    await page.waitForTimeout(500); await page.keyboard.press('Escape');
    P.fullscreen = { entered: fsState, curtain: curtainOpened, exited: await inPage(() => !document.fullscreenElement) };
  } catch (e) { P.fullscreen = { error: e.message.slice(0, 200) }; }
  R.phases.p06 = P; save(); log('p06 done');
}

async function p07_keyboard() {
  const K = {};
  try {
    await page.keyboard.press('Escape');
    const grid = page.getByRole('button', { name: 'Grid', exact: true });
    await grid.focus();
    await page.keyboard.press('Enter'); await page.waitForTimeout(250);          // Enter on the title opens (native button click)
    K.enterOpens = { open: await openMenus(), focused: await activeEl() };
    // Tab sequence from the title through the panel: record the first 6 and keep going to find the tail (basemap radios, lightning, curtain tab)
    const seq = [];
    for (let i = 0; i < 90; i++) { await page.keyboard.press('Tab'); const a = await activeEl(); seq.push(a); if (!a || !a.inBar) break; }
    K.tabSequence = { count: seq.length, first6: seq.slice(0, 6), tail8: seq.slice(-8), leftBarAt: seq.findIndex(a => !a || !a.inBar), lightningStops: seq.filter(a => a && a.lightning).map(a => a.lightning), proxyStops: seq.filter(a => a && a.proxy).length };
    // Shift+Tab goes back one
    await page.keyboard.press('Shift+Tab'); K.shiftTabBack = await activeEl();
    await page.keyboard.press('Shift+Tab'); K.shiftTabBack2 = await activeEl();
    // Space on a proxy toggles the ORIGINAL (engine) input; a second Space restores
    await page.keyboard.press('Escape'); await page.waitForTimeout(150); await grid.focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
    const target = await activeEl();
    const id = target?.proxy ? target.proxy.split(':')[1] : null;
    if (id) {
      const b = await inPage((id) => ({ orig: document.querySelector(`#scada-ui-container input[data-layer-id="${id}"]`)?.checked, proxy: document.querySelector(`[data-gridatlas-layer-proxy="engine:${id}"]`)?.checked }), id);
      await page.keyboard.press('Space'); await page.waitForTimeout(500);
      const m = await inPage((id) => ({ orig: document.querySelector(`#scada-ui-container input[data-layer-id="${id}"]`)?.checked, proxy: document.querySelector(`[data-gridatlas-layer-proxy="engine:${id}"]`)?.checked, open: !!document.querySelector('#gridatlas-menu-bar .gm-menu.gm-open'), label: document.getElementById('lbl-' + id)?.textContent }), id);
      await page.keyboard.press('Space'); await page.waitForTimeout(500);
      const a = await inPage((id) => ({ orig: document.querySelector(`#scada-ui-container input[data-layer-id="${id}"]`)?.checked, proxy: document.querySelector(`[data-gridatlas-layer-proxy="engine:${id}"]`)?.checked, open: !!document.querySelector('#gridatlas-menu-bar .gm-menu.gm-open') }), id);
      K.spaceOnProxy = { target, before: b, afterSpace: m, afterSecondSpace: a, ok: b.orig === false && m.orig === true && m.proxy === true && m.open === true && a.orig === false };
    } else K.spaceOnProxy = { target, note: 'ArrowDown did not land on a proxy' };
    // Escape from inside the panel restores focus to the Grid title
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    K.escapeFromPanel = { focused: await activeEl(), open: await openMenus() };
    // Arrow keys between titles
    await grid.focus(); await page.keyboard.press('ArrowRight'); const r1 = await activeEl(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); const l1 = await activeEl(); await page.keyboard.press('Home'); const h = await activeEl(); await page.keyboard.press('End'); const e = await activeEl();
    K.arrowsBetweenTitles = { right: r1?.text, leftLeft: l1?.text, home: h?.text, end: e?.text, ok: r1?.text === 'About' && l1?.text === 'Scope' && h?.text === 'File' && e?.text === 'About' };
    if (ROUTE === 'candidate') {
      // Keyboard on the lightning toggle in the NATIVE panel: Tab to it is impractical (120+ stops); focus() then Space, which is the native checkbox key
      const t = page.locator('#scada-ui-container [data-lightning-control="toggle"]');
      const sem = await t.evaluate(el => ({ tag: el.tagName, type: el.type, role: el.getAttribute('role') || '(implicit checkbox)', ariaChecked: el.getAttribute('aria-checked'), checked: el.checked, accessibleName: (el.labels && el.labels[0] ? el.labels[0].textContent.trim() : null) || el.getAttribute('aria-label'), tabIndex: el.tabIndex, disabled: el.disabled }));
      await t.focus(); await page.keyboard.press('Space'); await page.waitForTimeout(300);
      const on = await inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, checked: [...document.querySelectorAll('[data-lightning-control]')].map(i => i.checked), ctlHidden: document.querySelector('#scada-ui-container [data-lightning-controls]')?.hidden, focused: document.activeElement?.getAttribute('data-lightning-control') }));
      // Tab onward lands on the period chips (buttons) once ON
      const after = []; for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); after.push(await activeEl()); }
      // Enter on a focused period button is a native button activation
      const periodBefore = await inPage(() => window.__GRIDATLAS_MODULES__.ukLightning.state.period);
      await page.keyboard.press('Enter'); await page.waitForTimeout(400);
      const periodAfter = await inPage(() => window.__GRIDATLAS_MODULES__.ukLightning.state.period);
      await t.focus(); await page.keyboard.press('Space'); await page.waitForTimeout(300);
      const off = await inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, checked: [...document.querySelectorAll('[data-lightning-control]')].map(i => i.checked), ctlHidden: document.querySelector('#scada-ui-container [data-lightning-controls]')?.hidden, timer: !!window.__GRIDATLAS_MODULES__.ukLightning.state.timer, source: !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-lightning') }));
      K.lightningKeyboard = { semantics: sem, afterSpaceOn: on, tabOnwardStops: after.map(a => a && (a.lightning || a.text)), enterOnFocusedChip: { before: periodBefore, after: periodAfter, focusedWas: after[after.length - 1]?.lightning }, afterSpaceOff: off, ok: on.on === true && on.checked.every(Boolean) && off.on === false && off.checked.every(c => !c) && !off.source };
      // Escape inside the Grid-footer lightning row: focus the footer toggle, press Escape -> menu closes, focus returns to Grid title
      try { await act(grid); await page.waitForTimeout(250); const ft = page.locator('[data-lightning-group="menu"] [data-lightning-control]'); await ft.focus(); await page.keyboard.press('Escape'); await page.waitForTimeout(200); K.escapeFromLightningFooter = { focused: await activeEl(), open: await openMenus() }; } catch (e) { K.escapeFromLightningFooter = { error: e.message.slice(0, 160) }; }
    }
  } catch (e) { K.error = e.message.slice(0, 300); }
  await page.keyboard.press('Escape');
  R.phases.p07 = K; save(); log('p07 done');
}

async function p08_touch() {
  if (!MOBILE) { R.phases.p08 = { skipped: 'desktop viewport' }; return; }
  const T = { targets: [] };
  const probe = async (name, loc, expectFn) => {
    try {
      const b = await box(loc); const h = await hitTest(loc);
      await loc.tap(); await page.waitForTimeout(350);
      const outcome = expectFn ? await expectFn() : null;
      T.targets.push({ name, box: b, meets44: b ? b.w >= 44 && b.h >= 44 : null, elementAtCentre: h, outcome });
    } catch (e) { T.targets.push({ name, error: e.message.slice(0, 200) }); }
  };
  await page.keyboard.press('Escape');
  await probe('Grid title', page.getByRole('button', { name: 'Grid', exact: true }), openMenus);
  await probe('first proxy engine:400 (in open Grid menu)', page.locator('[data-gridatlas-layer-proxy="engine:400"]'), () => inPage(() => ({ orig: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked, open: !!document.querySelector('.gm-menu.gm-open') })));
  await probe('first proxy engine:400 again (off)', page.locator('[data-gridatlas-layer-proxy="engine:400"]'), () => inPage(() => ({ orig: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked })));
  await probe('Grid title (close)', page.getByRole('button', { name: 'Grid', exact: true }), openMenus);
  await probe('#gridatlas-dash-toggle (open Layers panel)', page.locator('#gridatlas-dash-toggle'), () => inPage(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed')));
  await probe('native engine input 400 (panel)', page.locator('#scada-ui-container input[data-layer-id="400"]'), () => inPage(() => ({ orig: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked })));
  await probe('native engine input 400 (panel, off)', page.locator('#scada-ui-container input[data-layer-id="400"]'), () => inPage(() => ({ orig: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked })));
  if (ROUTE === 'candidate') {
    const S = () => inPage(() => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return { on: s.on, period: s.period, requests: s.requests, last: s.last && s.last.state }; });
    await probe('lightning toggle (native panel, tap ON)', page.locator('#scada-ui-container [data-lightning-control="toggle"]'), S);
    await probe('lightning toggle LABEL text (native panel, tap OFF via label)', page.locator('#scada-ui-container [data-lightning-label="main"]'), S);
    await probe('lightning toggle (native panel, tap ON again)', page.locator('#scada-ui-container [data-lightning-control="toggle"]'), S);
    try { await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last !== null, null, { timeout: 30000 }); } catch { }
    for (const p of ['7d', '48h', 'custom', '24h']) await probe(`lightning period chip ${p}`, page.locator(`#scada-ui-container [data-lightning-period="${p}"]`), S);
    await probe('lightning PREV', page.locator('#scada-ui-container [data-lightning-nav="prev"]'), () => inPage(() => ({ end: window.__GRIDATLAS_MODULES__.ukLightning.state.end, last: window.__GRIDATLAS_MODULES__.ukLightning.state.last?.state })));
    await probe('lightning LATEST', page.locator('#scada-ui-container [data-lightning-nav="latest"]'), () => inPage(() => ({ end: window.__GRIDATLAS_MODULES__.ukLightning.state.end })));
    await shot(page, '08-lightning-on-phone');
    // all lightning buttons: 44x44 census while ON
    T.lightningButtons = await inPage(() => [...document.querySelectorAll('#scada-ui-container [data-lightning-group] button')].map(b => { const r = b.getBoundingClientRect(); return { text: b.textContent.trim(), w: +r.width.toFixed(1), h: +r.height.toFixed(1), hidden: b.hidden, disabled: b.disabled, meets44: r.width >= 44 && r.height >= 44 }; }));
    T.lightningToggleLabelBox = await inPage(() => { const l = document.querySelector('#scada-ui-container [data-lightning-control="toggle"]').closest('label'); const r = l.getBoundingClientRect(); const i = l.querySelector('input').getBoundingClientRect(); return { label: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, input: { w: +i.width.toFixed(1), h: +i.height.toFixed(1) } }; });
    T.originalKeyItemLabelBox = await inPage(() => { const l = document.querySelector('#scada-ui-container input[data-layer-id="400"]').closest('label'); const r = l.getBoundingClientRect(); const i = l.querySelector('input').getBoundingClientRect(); return { label: { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, input: { w: +i.width.toFixed(1), h: +i.height.toFixed(1) } }; });
    await probe('lightning toggle (native panel, tap OFF)', page.locator('#scada-ui-container [data-lightning-control="toggle"]'), S);
    // Grid-footer toggle on the phone: reachable? (R01 is desktop clipping; the phone footer is in the scrollable panel)
    await probe('Grid title (open for footer)', page.getByRole('button', { name: 'Grid', exact: true }), openMenus);
    await probe('lightning toggle in Grid footer (tap ON)', page.locator('[data-lightning-group="menu"] [data-lightning-control]'), () => inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, menuStillOpen: !!document.querySelector('.gm-menu.gm-open'), panelScrollTop: document.getElementById('scada-ui-container')?.scrollTop })));
    await shot(page, '08-footer-toggle-phone');
    await probe('lightning toggle in Grid footer (tap OFF)', page.locator('[data-lightning-group="menu"] [data-lightning-control]'), () => inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, menuStillOpen: !!document.querySelector('.gm-menu.gm-open') })));
    await probe('Grid title (close)', page.getByRole('button', { name: 'Grid', exact: true }), openMenus);
  }
  await probe('#gridatlas-dash-toggle (close Layers panel)', page.locator('#gridatlas-dash-toggle'), () => inPage(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed')));
  R.phases.p08 = T; save(); log('p08 done');
}

/* --------------------------------------------------- ON / OFF, P09, P12 */
async function mutationWindow(label, ms) {
  const before = await metrics(); const req0 = requests.length; const light0 = requests.filter(r => LIGHT_RE.test(r.url)).length;
  const res = await inPage(async (ms) => {
    const recs = { total: 0, lightningOwned: 0, byType: {}, outsideSamples: [], insideSamples: [], attrNames: {}, textChanges: 0 };
    const owned = (n) => { const el = n.nodeType === 1 ? n : n.parentElement; return !!(el && el.closest && el.closest('[data-lightning-group]')); };
    const desc = (n) => { const el = n.nodeType === 1 ? n : n.parentElement; return el ? (el.tagName + (el.id ? '#' + el.id : '') + '.' + String(el.className).split(' ').slice(0, 2).join('.')).slice(0, 70) : String(n.nodeName); };
    const ob = new MutationObserver(list => { for (const m of list) { recs.total++; recs.byType[m.type] = (recs.byType[m.type] || 0) + 1; if (m.type === 'attributes') recs.attrNames[m.attributeName] = (recs.attrNames[m.attributeName] || 0) + 1; if (m.type === 'characterData') recs.textChanges++; if (owned(m.target)) { recs.lightningOwned++; if (recs.insideSamples.length < 12) recs.insideSamples.push(m.type + ' ' + desc(m.target) + (m.attributeName ? ' @' + m.attributeName : '')); } else if (recs.outsideSamples.length < 12) recs.outsideSamples.push(m.type + ' ' + desc(m.target) + (m.attributeName ? ' @' + m.attributeName : '')); } });
    ob.observe(document.body, { childList: true, attributes: true, characterData: true, subtree: true });
    const t0 = performance.now(); const lt0 = window.__C.longTasks.length;
    await new Promise(r => setTimeout(r, ms));
    ob.disconnect();
    const S = window.__GRIDATLAS_MODULES__?.ukLightning?.state;
    return { ...recs, elapsed_ms: Math.round(performance.now() - t0), longTasksDuring: window.__C.longTasks.slice(lt0), lightningState: S ? { on: S.on, requests: S.requests, timer: !!S.timer, serial: S.serial } : null };
  }, ms);
  const after = await metrics();
  const out = { ...res, requests_during: requests.length - req0, lightning_requests_during: requests.filter(r => LIGHT_RE.test(r.url)).length - light0, cpu: { TaskDuration_s: +(after.TaskDuration - before.TaskDuration).toFixed(3), ScriptDuration_s: +(after.ScriptDuration - before.ScriptDuration).toFixed(3), LayoutCount: after.LayoutCount - before.LayoutCount, RecalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount, heap_delta_bytes: after.JSHeapUsedSize - before.JSHeapUsedSize, heap_after: after.JSHeapUsedSize, nodes: after.Nodes, listeners: after.JSEventListeners } };
  log('mutations', label, 'total', out.total, 'lightning-owned', out.lightningOwned, 'cpu', out.cpu.TaskDuration_s);
  return out;
}

async function lightningOn(how) {
  // real gesture on the native Layers panel toggle (desktop: panel open by default; phone: open it with the dash toggle)
  if (MOBILE) { const col = await inPage(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed')); if (col === 'true' || col === '1') { await act(page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(400); } }
  const t = page.locator('#scada-ui-container [data-lightning-control="toggle"]');
  const b = await box(t); const h = await hitTest(t);
  await act(t);
  const t0 = Date.now();
  let loaded = true; try { await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last !== null, null, { timeout: 40000 }); } catch { loaded = false; }
  await page.waitForTimeout(800);
  const st = await inPage(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; const cap = document.querySelector('#scada-ui-container [data-lightning-caption]'); return { on: S.on, period: S.period, requests: S.requests, errors: S.errors.slice(), last: S.last, timer: !!S.timer, label: document.querySelector('#scada-ui-container [data-lightning-label]')?.textContent, status: document.querySelector('#scada-ui-container [data-lightning-group] .status-dot')?.textContent.trim(), caption: cap ? [...cap.children].map(c => c.textContent).filter(Boolean) : null }; });
  return { how, toggleBox: b, elementAtCentre: h, load_ms: loaded ? Date.now() - t0 : 'timeout', state: st, lightningRequests: requests.filter(r => LIGHT_RE.test(r.url)).map(r => r.url.replace(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\//, '')) };
}
async function lightningOff() {
  const t = page.locator('#scada-ui-container [data-lightning-control="toggle"]');
  await act(t); await page.waitForTimeout(800);
  return inPage(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; return { on: S.on, timer: !!S.timer, res: S.res, mode: S.mode, label: document.querySelector('#scada-ui-container [data-lightning-label]')?.textContent, ctlHidden: document.querySelector('#scada-ui-container [data-lightning-controls]')?.hidden, checked: [...document.querySelectorAll('[data-lightning-control]')].map(i => i.checked) }; });
}

async function click400() {
  // real click on a rendered 400 kV line feature, the way all-layer-clicks does it (same-origin map-ready partition)
  const r = {};
  try {
    await page.keyboard.press('Escape');
    if (MOBILE) { const col = await inPage(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed')); if (col === 'true' || col === '1') { await act(page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(300); } }
    const inp = page.locator('#scada-ui-container input[data-layer-id="400"]');
    if (!(await inp.isChecked())) { await act(inp); }
    await page.waitForFunction(() => /\[(OK|EMPTY|FAIL|\d)/.test(document.getElementById('lbl-400')?.textContent || ''), null, { timeout: 60000, polling: 200 });
    r.label = await inPage(() => document.getElementById('lbl-400')?.textContent);
    const source = await inPage(async () => { const m = window.__GRIDATLAS_V9_MAP__, layer = m.getStyle().layers.find(x => x.id === 'l-400'); let data = m.getSource(layer.source)._data; if (typeof data === 'string') data = await (await fetch(new URL(data, document.baseURI))).json(); const lines = (data.features || []).filter(f => ['LineString', 'MultiLineString'].includes(f.geometry?.type)); const point = g => { let c = g.coordinates; while (Array.isArray(c[0])) c = c[Math.floor(c.length / 2)]; return c; }; const sample = lines.find(f => { const c = point(f.geometry); return c[0] > -8 && c[0] < 2 && c[1] > 50 && c[1] < 59; }) || lines[0]; const target = sample ? point(sample.geometry) : null; if (target) m.jumpTo({ center: target, zoom: Math.max(layer.minzoom || 0, 10) + .5 }); return { eligible: lines.length, target, visibility: m.getLayoutProperty('l-400', 'visibility') }; });
    Object.assign(r, source);
    await page.waitForFunction(() => { const m = window.__GRIDATLAS_V9_MAP__; const l = m.getLayer('l-400'); return l && m.isSourceLoaded(l.source) && m.queryRenderedFeatures({ layers: ['l-400'] }).length > 0; }, null, { timeout: 30000 });
    await inPage(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    r.rendered = await inPage(() => window.__GRIDATLAS_V9_MAP__.queryRenderedFeatures({ layers: ['l-400'] }).length);
    const hit = await inPage(target => { const m = window.__GRIDATLAS_V9_MAP__, p = m.project(target), b = m.getCanvas().getBoundingClientRect(); return { x: b.left + p.x, y: b.top + p.y }; }, source.target);
    r.hit = hit; r.elementAtHit = await inPage(({ x, y }) => { const el = document.elementFromPoint(x, y); return el ? el.tagName + '.' + String(el.className).slice(0, 40) : null; }, hit);
    if (MOBILE) await page.touchscreen.tap(hit.x, hit.y); else await page.mouse.click(hit.x, hit.y);
    await page.waitForTimeout(600);
    r.popups = await page.locator('.maplibregl-popup').count();
    r.popupText = (await page.locator('.maplibregl-popup').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim().slice(0, 160));
    await shot(page, '09-400kv-picked');
    for (const popup of await page.locator('.maplibregl-popup').all()) { const custom = popup.locator('.gridatlas-card-bar .close'); const close = await custom.count() ? custom : popup.locator('.maplibregl-popup-close-button'); try { await act(close); } catch (e) { r.closeError = e.message.slice(0, 120); } }
    await act(inp); await page.waitForTimeout(400);
    r.off = await inPage(() => ({ checked: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked, visibility: window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-400', 'visibility') }));
    r.pass = r.rendered > 0 && r.popups > 0 && r.off.checked === false;
  } catch (e) { r.error = e.message.slice(0, 300); r.pass = false; }
  return r;
}

/* -------------------------------------------------------------- main */
try {
  await boot();
  R.phases.inventory_off = await inPage(INVENTORY);
  R.phases.map_off = await inPage(MAP_SNAPSHOT);
  await listeners('boot');
  log('inventory OFF', JSON.stringify(R.phases.inventory_off.inspect), 'proxies', R.phases.inventory_off.proxies, 'markers', R.phases.inventory_off.markers_data_gridatlas_layer_key);
  // first-interaction time: a real click on the Grid title, timed in-page from pointerdown to the panel opening
  const grid = page.getByRole('button', { name: 'Grid', exact: true });
  const probeP = inPage(() => new Promise(res => { const bar = document.getElementById('gridatlas-menu-bar'); let t0 = performance.now(); const onDown = () => { t0 = performance.now(); }; bar.addEventListener('pointerdown', onDown, true); const ob = new MutationObserver(() => { if (bar.querySelector('.gm-menu.gm-open')) { ob.disconnect(); bar.removeEventListener('pointerdown', onDown, true); res(+(performance.now() - t0).toFixed(1)); } }); ob.observe(bar, { attributes: true, subtree: true, attributeFilter: ['class'] }); setTimeout(() => { ob.disconnect(); res('timeout'); }, 10000); }));
  await page.waitForTimeout(100); await act(grid);
  R.phases.first_interaction = { grid_pointerdown_to_panel_open_ms: await probeP, boot_to_menuBar_installed_ms: R.phases.boot.milestones_ms_from_nav.menuBar_installed, boot_to_proxies_60_ms: R.phases.boot.milestones_ms_from_nav.proxies_60 };
  await act(grid); await page.waitForTimeout(200);
  save();
  await p06_menus();
  await p07_keyboard();
  R.phases.inventory_after_p06_p07 = await inPage(INVENTORY);
  await p08_touch();
  // P12 baseline idle window (lightning OFF or no lightning): same duration on both routes
  R.phases.p12_idle_off = await mutationWindow('OFF idle', IDLE);
  if (ROUTE === 'candidate') {
    const L = {};
    L.on1 = await lightningOn('native panel toggle, real ' + (MOBILE ? 'tap' : 'click'));
    // choose 7d so points exist in the fixture window
    try { await act(page.locator('#scada-ui-container [data-lightning-period="7d"]')); await page.waitForFunction(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; return S.last && S.period === '7d' && S.res && S.res.w && S.res.w.period === '7d'; }, null, { timeout: 40000 }); await page.waitForTimeout(800); } catch (e) { L.period7dError = e.message.slice(0, 160); }
    L.state7d = await inPage(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; const m = window.__GRIDATLAS_V9_MAP__; const src = m.getSource('gridatlas-lightning'); return { last: S.last, requests: S.requests, errors: S.errors.slice(), label: document.querySelector('#scada-ui-container [data-lightning-label]')?.textContent, status: document.querySelector('#scada-ui-container [data-lightning-group] .status-dot')?.textContent.trim(), caption: [...document.querySelector('#scada-ui-container [data-lightning-caption]').children].map(c => c.textContent).filter(Boolean), source: !!src, features: src && src._data && src._data.features ? src._data.features.length : null, layerVisibility: m.getLayer('l-gridatlas-lightning') ? m.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null, rendered: m.getLayer('l-gridatlas-lightning') ? m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length : null }; });
    await shot(page, '09-lightning-on-7d');
    R.phases.inventory_on = await inPage(INVENTORY);
    R.phases.map_on = await inPage(MAP_SNAPSHOT);
    await listeners('on');
    R.phases.p12_idle_on = await mutationWindow('ON idle', IDLE);
    L.off = await lightningOff();
    R.phases.map_after_off = await inPage(MAP_SNAPSHOT);
    R.phases.inventory_after_off = await inPage(INVENTORY);
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    L.p09 = { off_has_no_lightning_source_or_layer: !R.phases.map_off.lightning.source && !R.phases.map_off.lightning.layer, on_added_exactly: { sources: R.phases.map_on.sources.filter(s => !R.phases.map_off.sources.includes(s)), layers: R.phases.map_on.layers.filter(l => !R.phases.map_off.layers.some(x => x.id === l.id)).map(l => l.id) }, after_off_sources_equal_off: eq(R.phases.map_after_off.sources, R.phases.map_off.sources), after_off_layers_equal_off: eq(R.phases.map_after_off.layers, R.phases.map_off.layers), layer_diff_after_off: R.phases.map_after_off.layers.filter((l, i) => !eq(l, R.phases.map_off.layers[i])) };
    // Grid-footer toggle (the dropdown mirror): real gesture reachability at this viewport, not fullscreen
    try {
      await page.keyboard.press('Escape'); await act(page.getByRole('button', { name: 'Grid', exact: true })); await page.waitForTimeout(300);
      const ft = page.locator('[data-lightning-group="menu"] [data-lightning-control]');
      const geo = await inPage(() => { const f = document.querySelector('[data-lightning-group="menu"]'); const i = f.querySelector('[data-lightning-control]'); const r = i.getBoundingClientRect(); const fr = f.getBoundingClientRect(); const p = f.closest('.gm-panel').getBoundingClientRect(); const mc = document.getElementById('map-container').getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { toggle: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }, footer: { y: +fr.y.toFixed(1), h: +fr.height.toFixed(1) }, panel: { y: +p.y.toFixed(1), h: +p.height.toFixed(1), bottom: +p.bottom.toFixed(1) }, mapContainer: { y: +mc.y.toFixed(1), h: +mc.height.toFixed(1), bottom: +mc.bottom.toFixed(1), overflow: getComputedStyle(document.getElementById('map-container')).overflow }, innerHeight, elementAtCentre: at ? at.tagName + '#' + at.id + '.' + String(at.className).slice(0, 40) : null, toggleInsideViewport: r.y >= 0 && r.bottom <= innerHeight, toggleInsideMapContainer: r.bottom <= mc.bottom }; });
      let clickResult; try { await act(ft); await page.waitForTimeout(400); clickResult = await inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, menuStillOpen: !!document.querySelector('.gm-menu.gm-open'), checked: [...document.querySelectorAll('[data-lightning-control]')].map(i => i.checked) })); } catch (e) { clickResult = { error: e.message.split('\n').filter(l => /intercepts|Timeout|resolved|outside|not visible/.test(l)).slice(0, 4).join(' | ').replace(/\u001b\[\d+m/g, '') }; }
      await shot(page, '10-grid-footer-toggle');
      let clickOff = null; if (clickResult && clickResult.on) { try { await act(ft); await page.waitForTimeout(400); clickOff = await inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, menuStillOpen: !!document.querySelector('.gm-menu.gm-open') })); } catch (e) { clickOff = { error: e.message.slice(0, 160) }; } }
      L.gridFooterToggle = { geometry: geo, realClickOn: clickResult, realClickOff: clickOff };
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      if (await inPage(() => window.__GRIDATLAS_MODULES__.ukLightning.state.on)) { await lightningOff(); }
    } catch (e) { L.gridFooterToggle = { error: e.message.slice(0, 200) }; }
    // rapid ON/OFF x5 (event race): data must not repaint after OFF
    const rapid = []; for (let i = 0; i < 5; i++) { await act(page.locator('#scada-ui-container [data-lightning-control="toggle"]')); await page.waitForTimeout(120); await act(page.locator('#scada-ui-container [data-lightning-control="toggle"]')); await page.waitForTimeout(120); rapid.push(await inPage(() => ({ on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, source: !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-lightning') }))); }
    await page.waitForTimeout(6000);
    L.rapidOnOff = { steps: rapid, settled: await inPage(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; return { on: S.on, source: !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-lightning'), layer: !!window.__GRIDATLAS_V9_MAP__.getLayer('l-gridatlas-lightning'), timer: !!S.timer, requests: S.requests, label: document.querySelector('#scada-ui-container [data-lightning-label]')?.textContent }; }) };
    R.phases.map_after_rapid = await inPage(MAP_SNAPSHOT);
    L.p09.after_rapid_equal_off = eq(R.phases.map_after_rapid.sources, R.phases.map_off.sources) && eq(R.phases.map_after_rapid.layers, R.phases.map_off.layers);
    R.phases.lightning = L; save();
  }
  R.phases.p09_click_400kv = await click400();
  R.phases.final = { inventory: await inPage(INVENTORY), map: await inPage(MAP_SNAPSHOT), consoleErrors, pageErrors, failedRequests: failed.length, lightningRequestsTotal: requests.filter(r => LIGHT_RE.test(r.url)).map(r => r.url.replace(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\//, '')), shim: shim.summary(), metrics: await metrics() };
  await shot(page, '99-final');
} catch (e) { R.errors.push('fatal: ' + (e.stack || e.message)); log('FATAL', e.message); }
finally { R.endedAt = new Date().toISOString(); save(); await browser.close(); log('saved', path.join(OUT, 'result.json')); }
