// veto-pre-1 interaction suite v2 (restart copy: 120 s default timeout, evaluate-based settle, VP filter) for V2, V4, V5 (DOM), V7, V10, V15. Harness: lead-shim (offline-shim.mjs), Chromium headless.
// Phones are Chromium emulation (isMobile/hasTouch + UA), NOT WebKit. Real gestures only: locator.click()/tap(), no force, no dispatchEvent.
// Usage: node veto-interact.mjs <port> <outdir>   (server: python3 -m http.server <port> --directory <scratchpad>/hardening)
// Synthetic fixtures (labelled SYNTHETIC) are generated under <outdir>/fixtures relative to real "now".
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.argv[2] || '8170';
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const BASE = `http://127.0.0.1:${PORT}/wt/atlas/`;
const CAND = `http://127.0.0.1:${PORT}/wt/atlas/v/202610262323/`;
const G = '[data-lightning-group="main"]';
const FS = '[data-lightning-group="fs"]';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const VPS = [
  { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 } },
  { name: 'android-393x852', viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: UA_ANDROID },
  { name: 'android-360x740', viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: UA_ANDROID },
  { name: 'iphone-390x844-chromium-emulation', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA_IPHONE },
];
const only = (process.env.ONLY || '').split(',').filter(Boolean);

// ---------- synthetic fixtures (SYNTHETIC, test-only) ----------
const NOW = Date.now(), iso = t => new Date(t).toISOString();
const FIX = path.join(OUT, 'fixtures-SYNTHETIC');
const mkFeed = (dir, feats, qEnd, latest) => {
  fs.mkdirSync(path.join(FIX, dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(FIX, dir, 'data', 'uk_lightning.geojson'), JSON.stringify({ type: 'FeatureCollection', metadata: { SYNTHETIC: 'veto-pre-1 test fixture, not observations', source: 'EUMETSAT MTG Lightning Imager L2-LFL', retention_days: 7, latest_detection_utc: latest, query_start_utc: iso(Date.parse(qEnd) - 3 * 36e5), query_end_utc: qEnd, status: 'ready' }, features: feats }));
};
const feat = (i, t) => ({ type: 'Feature', id: 'synthetic-' + i, geometry: { type: 'Point', coordinates: [-2 + i * 0.01, 53 + i * 0.01] }, properties: { time_utc: iso(t), observation_kind: 'optical_lightning_flash', source: 'SYNTHETIC' } });
mkFeed('empty', [], iso(NOW - 30 * 6e4), null);
fs.mkdirSync(path.join(FIX, 'none', 'data'), { recursive: true }); // feed and index both 404
mkFeed('stale', [0, 1, 2, 3, 4].map(i => feat(i, NOW - 3 * 864e5 - i * 6e4)), iso(NOW - 3 * 864e5 + 36e5), iso(NOW - 3 * 864e5));
mkFeed('fresh', [0, 1, 2, 3, 4].map(i => feat(i, NOW - 2 * 36e5 - i * 6e4)), iso(NOW - 30 * 6e4), iso(NOW - 2 * 36e5));


async function boot(url, vp, { data, route500 } = {}) {
  const ctx = await browser.newContext({ ...vp, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London' });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const log = { errors: [], lightning: [] };
  page.on('pageerror', e => log.errors.push(String(e.message || e).slice(0, 200)));
  page.on('request', r => { if (r.url().includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightning.push({ t: iso(Date.now()), url: r.url(), type: r.resourceType() }); });
  page.on('response', r => { if (r.url().includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightning.push({ t: iso(Date.now()), url: r.url(), status: r.status() }); });
  const shim = await installOfflineShim(page, data ? { lightningDataDir: data } : {});
  if (route500) await page.route(u => u.hostname === 'raw.githubusercontent.com', r => r.fulfill({ status: 500, body: 'synthetic 500', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
  if (url === CAND) await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 }).catch(() => {});
  return { ctx, page, log, shim, comp, mobile: !!vp.isMobile };
}
const snap = page => page.evaluate(() => {
  const qa = s => [...document.querySelectorAll(s)];
  const M = window.__GRIDATLAS_MODULES__?.menuBar, L = window.__GRIDATLAS_MODULES__?.ukLightning, map = window.__GRIDATLAS_V9_MAP__;
  const BR = window.__GRIDATLAS_MAP_READY__;
  const ctl = qa('[data-lightning-control]');
  let src = null, lay = null, layers = null;
  try { layers = map.getStyle().layers.map(l => l.id); const s = map.getSource('gridatlas-lightning'); if (s) src = { n: (s.serialize().data.features || []).length }; if (map.getLayer('l-gridatlas-lightning')) lay = map.getLayoutProperty('l-gridatlas-lightning', 'visibility'); } catch (e) { src = { err: String(e) }; }
  return {
    inspect: M?.inspect ? M.inspect() : null,
    proxies: qa('[data-gridatlas-layer-proxy]').length, markers: qa('[data-gridatlas-layer-key]').length,
    scadaEngine: qa('#scada-ui-container input[type=checkbox][data-layer-id]').length, scadaPn: qa('#scada-ui-container input[type=checkbox][data-pn-layer]').length,
    scadaInputsNonLightning: qa('#scada-ui-container input').filter(i => !i.closest('[data-lightning-group]')).length,
    curtainInputsNonLightning: qa('#fs-curtain-keys input').filter(i => !i.closest('[data-lightning-group]')).length,
    keyTitles: qa('#scada-ui-container .key-title').map(e => e.textContent.trim()),
    curtainTitles: qa('#fs-curtain-keys .key-title').map(e => e.textContent.trim()),
    firstLabel: (document.querySelector('#scada-ui-container label')?.textContent || '').trim().slice(0, 30),
    gmGroups: qa('#gridatlas-menu-bar .gm-layer-group').map(e => e.textContent.trim()),
    gmRows: qa('#gridatlas-menu-bar .gm-layer').length,
    styles: qa('style').map(s => s.id || '(no id)'), links: qa('link[rel=stylesheet]').map(l => l.getAttribute('href')),
    mapControlsEmptied: document.querySelector('.map-controls')?.getAttribute('data-gridatlas-menu-emptied') ?? null,
    lightningCtlAttrs: ctl.map(c => [...c.attributes].map(a => a.name)),
    lightningForbidden: ctl.some(c => ['data-layer-id', 'data-pn-layer', 'data-gridatlas-layer-proxy', 'data-gridatlas-layer-key'].some(a => c.hasAttribute(a))) || !!document.querySelector('[data-lightning-group] [data-layer-id],[data-lightning-group] [data-pn-layer],[data-lightning-group] [data-gridatlas-layer-proxy],[data-lightning-group] [data-gridatlas-layer-key]'),
    lightningInGridPanel: !!document.querySelector('#gridatlas-menu-bar [data-lightning-group]'),
    lightningGroups: qa('[data-lightning-group]').map(g => ({ key: g.dataset.lightningGroup, parent: g.parentElement.id, last: g.parentElement.lastElementChild === g })),
    checked: ctl.map(c => c.checked),
    label: document.querySelector('[data-lightning-group="main"] [data-lightning-label]')?.textContent ?? null,
    labelFs: document.querySelector('[data-lightning-group="fs"] [data-lightning-label]')?.textContent ?? null,
    status: document.querySelector('[data-lightning-group="main"] .status-dot')?.textContent ?? null,
    caps: Object.fromEntries(qa('[data-lightning-group="main"] [data-cap]').map(n => [n.dataset.cap, n.textContent])),
    capsVisible: (() => { const c = document.querySelector('[data-lightning-group="main"] [data-lightning-caption]'); return !!(c && c.offsetParent); })(),
    lstate: L ? { on: L.state.on, requests: L.state.requests, errors: L.state.errors.slice(), last: L.state.last, timer: !!L.state.timer } : null,
    fetchName: window.fetch.name, xhrOpenNative: /native code/.test(String(XMLHttpRequest.prototype.open)),
    bridge: BR ? { intercepted_on_demand: BR.intercepted_on_demand, failures: (BR.failures || []).map(f => f.pathname + ' ' + f.message) } : null,
    initVentusMap: typeof window.initVentusMap === 'function' ? (window.initVentusMap.name + '|' + String(window.initVentusMap).length) : String(typeof window.initVentusMap),
    mapSource: src, mapLayerVis: lay, mapLayerCount: layers ? layers.length : null, lightningLayers: layers ? layers.filter(i => /lightning/i.test(i)) : null,
    storage: (() => { try { return { ls: Object.keys(localStorage).filter(k => /lightn|weather/i.test(k)), ss: Object.keys(sessionStorage).filter(k => /lightn|weather/i.test(k)), ck: document.cookie }; } catch (e) { return String(e); } })(),
  };
});
const act = async (h, loc) => { await loc.scrollIntoViewIfNeeded(); if (h.mobile) await loc.tap(); else await loc.click(); };
async function openLayers(h) {
  if (!h.mobile) return 'desktop default open';
  const collapsed = await h.page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') === '1');
  if (collapsed) { await h.page.locator('#gridatlas-dash-toggle').tap(); await h.page.waitForTimeout(600); }
  return await h.page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') !== '1') ? 'opened by tap on #gridatlas-dash-toggle' : 'FAILED to open';
}
async function settle(h, ms = 60000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await h.page.evaluate(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.last); const lab = await h.page.evaluate(() => document.querySelector('[data-lightning-group="main"] [data-lightning-label]')?.textContent || '[WAIT]'); if (!/\[(LOAD|WAIT)\]/.test(lab) && s) return; await h.page.waitForTimeout(250); } }
const hit = (h, sel) => h.page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return 'absent'; const b = el.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return t === el || el.contains(t) || (t && t.control === el) ? 'self' : (t ? t.tagName + '#' + t.id + '.' + t.className : 'none'); }, sel);


// ---------- veto-focus: ONE candidate boot per viewport, all checks in-page (OOM-constrained host) ----------
const VPN = process.env.VP || 'desktop-1440x900';
const vp = VPS.find(v => v.name === VPN);
const browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=1', '--disable-gpu-shader-disk-cache'] });
const R = { harness: 'lead-shim offline-shim.mjs (default lightning data = shim cache of the real feed) + page.route overrides for SYNTHETIC V10 fixtures; Chromium ' + browser.version() + '; ' + VPN + (vp.isMobile ? ' (Chromium emulation, not WebKit)' : ''), startedAt: iso(NOW), cand: CAND, steps: {} };
const save = () => fs.writeFileSync(path.join(OUT, 'veto-focus.json'), JSON.stringify(R, null, 2));
const step = async (name, fn) => { const t = Date.now(); try { R.steps[name] = await fn(); } catch (e) { R.steps[name] = { error: String(e).slice(0, 300) }; } R.steps[name] && (R.steps[name].ms = Date.now() - t); save(); console.log(iso(Date.now()), name, R.steps[name].error || 'ok'); };
const pick = s => ({ label: s.label, labelFs: s.labelFs, status: s.status, caps: s.caps, capsVisible: s.capsVisible, checked: s.checked, lstate: s.lstate, mapSource: s.mapSource, mapLayerVis: s.mapLayerVis, lightningLayers: s.lightningLayers, inspect: s.inspect, proxies: s.proxies, markers: s.markers, bridge: s.bridge, fetchName: s.fetchName, xhrOpenNative: s.xhrOpenNative, initVentusMap: s.initVentusMap, storage: s.storage, keyTitles: s.keyTitles, curtainTitles: s.curtainTitles, styles: s.styles, lightningGroups: s.lightningGroups, lightningForbidden: s.lightningForbidden, lightningInGridPanel: s.lightningInGridPanel, gmRows: s.gmRows, scadaInputsNonLightning: s.scadaInputsNonLightning, curtainInputsNonLightning: s.curtainInputsNonLightning, firstLabel: s.firstLabel, mapControlsEmptied: s.mapControlsEmptied });
const h = await boot(CAND, vp);
const tog = h.page.locator(`${G} input[data-lightning-control="toggle"]`);
const period = async p => { await act(h, h.page.locator(`${G} button[data-lightning-period="${p}"]`)); await settle(h); await h.page.waitForTimeout(400); };
await step('offBoot', async () => ({ ...pick(await snap(h.page)), layers: await openLayers(h), lightningRequests: h.log.lightning.length }));
await step('toggleOn24h', async () => { const hitT = await (async () => { await tog.scrollIntoViewIfNeeded(); return hit(h, `${G} input[data-lightning-control="toggle"]`); })(); await act(h, tog); await settle(h); return { hit: hitT, ...pick(await snap(h.page)) }; });
await step('v15idleOn30s', async () => { const before = h.log.lightning.length; await h.page.evaluate(() => { window.__vetoMut = { all: 0, lightning: 0, lightningChildList: 0, records: [] }; new MutationObserver(ms => { for (const m of ms) { window.__vetoMut.all++; const t = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (t && t.closest && t.closest('[data-lightning-group]')) { window.__vetoMut.lightning++; if (m.type === 'childList') window.__vetoMut.lightningChildList++; if (window.__vetoMut.records.length < 30) window.__vetoMut.records.push(m.type + ' ' + JSON.stringify(t.dataset || {})); } } }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); }); await h.page.waitForTimeout(30000); return { ...(await h.page.evaluate(() => window.__vetoMut)), lightningRequestsDuringIdle: h.log.lightning.length - before }; });
await step('offAgain', async () => { await act(h, tog); await h.page.waitForTimeout(800); return pick(await snap(h.page)); });
// V10 cases via route override (registered after the shim; Playwright gives the newest route priority)
const FEEDRE = /raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\/data\/uk_lightning\.geojson/;
const IDXRE = /raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\/data\/history\//;
const hdr = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
for (const [k, how] of [['empty', 'empty'], ['http404', 404], ['http500', 500], ['stale', 'stale'], ['fresh', 'fresh']]) await step('v10_' + k, async () => {
  await h.page.unroute(FEEDRE).catch(() => {}); await h.page.unroute(IDXRE).catch(() => {});
  await h.page.route(IDXRE, r => r.fulfill({ status: how === 500 ? 500 : 404, body: 'synthetic', headers: hdr }));
  await h.page.route(FEEDRE, r => typeof how === 'number' ? r.fulfill({ status: how, body: 'synthetic ' + how, headers: hdr }) : r.fulfill({ status: 200, body: fs.readFileSync(path.join(FIX, how, 'data', 'uk_lightning.geojson')), headers: hdr }));
  await act(h, tog); await settle(h); await h.page.waitForTimeout(400);
  await h.page.locator(G).screenshot({ path: path.join(OUT, `${VPN}-v10-${k}.png`) }).catch(() => {});
  const s = pick(await snap(h.page)); await act(h, tog); await h.page.waitForTimeout(500); return s; });
await step('afterReload', async () => { await h.page.unroute(FEEDRE).catch(() => {}); await h.page.unroute(IDXRE).catch(() => {}); await h.page.reload({ waitUntil: 'domcontentloaded' }); await waitForComposition(h.page, { deadlineMs: 120000, settleMs: 2500 }); await h.page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 60000 }).catch(() => {}); return pick(await snap(h.page)); });
await step('reOnForPeriods', async () => { await act(h, tog); await settle(h); return pick(await snap(h.page)); });
for (const p of ['12m', '30d', '7d']) await step('on' + p, async () => { await period(p); const s = pick(await snap(h.page)); if (p === '7d') { s.renderedFeatures = await h.page.evaluate(() => { try { return window.__GRIDATLAS_V9_MAP__.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length; } catch (e) { return String(e); } }); await h.page.screenshot({ path: path.join(OUT, `${VPN}-on-7d.png`) }); } await h.page.locator(G).screenshot({ path: path.join(OUT, `${VPN}-panel-${p}.png`) }).catch(() => {}); return s; });
R.errors = h.log.errors; R.lightningRequests = h.log.lightning; R.finishedAt = iso(Date.now()); save();
await browser.close();
