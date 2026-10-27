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

const browser = await chromium.launch({ headless: true });
const R = { harness: 'lead-shim offline-shim.mjs; Chromium ' + browser.version() + ' headless; phones = Chromium emulation, not WebKit', startedAt: iso(NOW), base: BASE, cand: CAND, results: {} };
const save = () => fs.writeFileSync(path.join(OUT, 'veto-interact.json'), JSON.stringify(R, null, 2));

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

// ---------- V4/V5/V2/V7 per viewport ----------
const VPF=(process.env.VP||'').split(',').filter(Boolean);
for (const vp of VPS) {
  if (only.length && !only.includes('vp')) break;
  if (VPF.length && !VPF.includes(vp.name)) continue;
  const rec = R.results[vp.name] = {};
  try {
    if (!process.env.SKIPBASE) { const b = await boot(BASE, vp);
    rec.baseline = await snap(b.page); rec.baselineErrors = b.log.errors; await b.ctx.close(); }
    const h = await boot(CAND, vp);
    rec.offBoot = await snap(h.page);
    rec.layers = await openLayers(h);
    rec.offAfterLayers = await snap(h.page);
    const tog = h.page.locator(`${G} input[data-lightning-control="toggle"]`);
    rec.toggleHitBefore = await (async () => { await tog.scrollIntoViewIfNeeded(); return hit(h, `${G} input[data-lightning-control="toggle"]`); })();
    rec.requestsBeforeOn = h.log.lightning.length;
    await act(h, tog); await settle(h);
    rec.on24h = await snap(h.page);
    await act(h, h.page.locator(`${G} button[data-lightning-period="7d"]`)); await settle(h);
    await h.page.waitForTimeout(800);
    rec.on7d = await snap(h.page);
    rec.renderedFeatures = await h.page.evaluate(() => { try { const m = window.__GRIDATLAS_V9_MAP__; return m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length; } catch (e) { return String(e); } });
    await h.page.screenshot({ path: path.join(OUT, `${vp.name}-cand-on-7d.png`) });
    rec.lightningRequests = h.log.lightning.slice();
    await act(h, tog); await h.page.waitForTimeout(800);
    rec.offAgain = await snap(h.page);
    await h.page.reload({ waitUntil: 'domcontentloaded' }); await waitForComposition(h.page, { deadlineMs: 90000, settleMs: 2500 });
    await h.page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 }).catch(() => {});
    rec.afterReload = await snap(h.page);
    rec.candErrors = h.log.errors; rec.shim = h.shim.summary();
    await h.ctx.close();
  } catch (e) { rec.error = String(e.stack || e).slice(0, 600); }
  save(); console.log(vp.name, 'done', rec.error || '');
}

// ---------- V10 zero / error / stale, desktop ----------
const cases = { empty: { data: path.join(FIX, 'empty', 'data') }, http404: { data: path.join(FIX, 'none', 'data') }, http500: { data: path.join(FIX, 'none', 'data'), route500: true }, stale: { data: path.join(FIX, 'stale', 'data') }, fresh: { data: path.join(FIX, 'fresh', 'data') } };
R.v10 = {};
if (!only.length || only.includes('v10')) for (const [k, c] of Object.entries(cases)) {
  try {
    const h = await boot(CAND, VPS[0], c);
    await act(h, h.page.locator(`${G} input[data-lightning-control="toggle"]`)); await settle(h);
    await h.page.locator(`${G}`).screenshot({ path: path.join(OUT, `v10-${k}-panel.png`) }).catch(() => {});
    const s = await snap(h.page);
    R.v10[k] = { label: s.label, status: s.status, caps: s.caps, checked: s.checked, lstate: s.lstate, mapSource: s.mapSource, mapLayerVis: s.mapLayerVis, requests: h.log.lightning };
    await h.ctx.close();
  } catch (e) { R.v10[k] = { error: String(e).slice(0, 400) }; }
  save(); console.log('v10', k);
}

// ---------- V9 no claim of a year: no archive (real feed, index 404) and lead v2 archive fixture ----------
R.v9 = {};
const LEADARCH = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
if (!only.length || only.includes('v9')) for (const [k, data, periods] of [['noArchive', undefined, ['12m', '30d']], ['leadArchiveV2', LEADARCH, ['12m', '30d', '7d']]]) {
  try {
    const h = await boot(CAND, VPS[0], data ? { data } : {});
    await act(h, h.page.locator(`${G} input[data-lightning-control="toggle"]`)); await settle(h);
    R.v9[k] = {};
    for (const p of periods) {
      await act(h, h.page.locator(`${G} button[data-lightning-period="${p}"]`)); await settle(h); await h.page.waitForTimeout(500);
      const s = await snap(h.page);
      R.v9[k][p] = { label: s.label, status: s.status, caps: s.caps, last: s.lstate.last, src: s.mapSource };
      await h.page.locator(G).screenshot({ path: path.join(OUT, `v9-${k}-${p}-panel.png`) }).catch(() => {});
    }
    R.v9[k].requests = h.log.lightning.map(r => (r.status || r.type) + ' ' + r.url.replace(/^.*\/data\//, ''));
    await h.ctx.close();
  } catch (e) { R.v9[k] = { error: String(e).slice(0, 400) }; }
  save(); console.log('v9', k);
}

// ---------- V15 mutation budget: ON idle 30 s vs baseline idle 30 s ----------
R.v15 = {};
if (!only.length || only.includes('v15')) for (const [k, url] of [['baseline', BASE], ['candidateOn', CAND], ['candidateOff', CAND]]) {
  try {
    const h = await boot(url, VPS[0]);
    if (k === 'candidateOn') { await act(h, h.page.locator(`${G} input[data-lightning-control="toggle"]`)); await settle(h); await act(h, h.page.locator(`${G} button[data-lightning-period="7d"]`)); await settle(h); await h.page.waitForTimeout(1000); }
    const reqBefore = h.log.lightning.length;
    await h.page.evaluate(() => { window.__vetoMut = { all: 0, lightning: 0, lightningChildList: 0, records: [] }; new MutationObserver(ms => { for (const m of ms) { window.__vetoMut.all++; const t = m.target.nodeType === 1 ? m.target : m.target.parentElement; if (t && t.closest && t.closest('[data-lightning-group]')) { window.__vetoMut.lightning++; if (m.type === 'childList') window.__vetoMut.lightningChildList++; if (window.__vetoMut.records.length < 30) window.__vetoMut.records.push(m.type + ' ' + (t.dataset ? JSON.stringify(t.dataset) : '')); } } }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
    await h.page.waitForTimeout(30000);
    R.v15[k] = { ...(await h.page.evaluate(() => window.__vetoMut)), lightningRequestsDuringIdle: h.log.lightning.length - reqBefore };
    await h.ctx.close();
  } catch (e) { R.v15[k] = { error: String(e).slice(0, 400) }; }
  save(); console.log('v15', k);
}
R.finishedAt = iso(Date.now()); save();
await browser.close();
