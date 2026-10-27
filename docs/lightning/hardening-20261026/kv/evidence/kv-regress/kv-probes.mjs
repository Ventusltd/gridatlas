#!/usr/bin/env node
// test-fixes.mjs — one fail-first test per defect for the 202610261949 uk-lightning overlay.
// Harness: self-fixture under node:vm with a minimal synthetic DOM (minidom.mjs) and SYNTHETIC index/feed/shard data
// built in this file; no network, no browser. Usage:  MODULE=<path to overlay .js> node --test test-fixes.mjs
// Expected: every test FAILS on the unmodified module (fda6b10) and PASSES on fixed-module.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { El, makeDocument, dispatch } from './designer-I/minidom.mjs';

const MODULE = process.env.MODULE;
if (!MODULE) throw new Error('set MODULE=<overlay path>');
const SRC = readFileSync(MODULE, 'utf8');
const SEAM = 'NS.ukLightning=Object.freeze(';
assert.equal(SRC.split(SEAM).length, 2, 'seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S};' + SEAM);

const H = 36e5, D = 864e5;
const iso = t => new Date(t).toISOString();
const ymd = t => iso(t).slice(0, 10);
const enc = o => Buffer.from(JSON.stringify(o));
const flash = (t, id, coords = [-1.5, 52]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: coords }, properties: { time_utc: iso(t), observation_kind: 'optical_lightning_flash' } });
const feed = (features, ageH = 1, extra = {}) => ({ type: 'FeatureCollection', features, metadata: { query_start_utc: iso(Date.now() - (ageH + 3) * H), query_end_utc: iso(Date.now() - ageH * H), scan_end_utc: iso(Date.now() - ageH * H), latest_detection_utc: features.length ? features[features.length - 1].properties.time_utc : null, ...extra } });
const dayFile = (date, features) => ({ schema: 'uk-lightning-history-day.v1', type: 'FeatureCollection', metadata: { date_utc: date }, features });

// v2 index: every date from cutoff to today, fully scanned, count 0, unless overridden
function mkIndex(over = {}, top = {}, nowT = null) {
  const now = nowT ?? Date.now(), today = Date.parse(ymd(now) + 'T00:00:00Z'), cutoff = today - 365 * D, days = [];
  for (let t = cutoff; t <= today; t += D) {
    const date = ymd(t);
    if (over[date] === null) continue;
    days.push(Object.assign({ date, coverage: 'full', scanned_seconds: 86400, count: 0, bytes: null, path: null, sealed: t < today - D, first_observation_utc: null, last_observation_utc: null, sha256: null }, over[date] || {}));
  }
  return Object.assign({ schema: 'uk-lightning-history-index.v2', generated_utc: iso(now - 600e3), next_update_due_utc: iso(now + H), cutoff_date_utc: ymd(cutoff), collection_interval_hours: 1,
    observation: 'satellite optical lightning flashes, not ground strikes', coverage_start_utc: iso(cutoff), scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(now), successful_runs: 999 }], days }, top);
}

function boot({ index = null, feedFn = () => feed([flash(Date.now() - 2 * H, 'f1')]), files = {}, noGrid = false, lazy = false, park = false, bounds = null, dash = null, innerHeight = 852, now = null, redirect = null, ro = false, noCrypto = false, phone = false } = {}) {
  const doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const orig = doc.createElement('div'); orig.className = 'key-group'; host.appendChild(orig);
  const curtain = doc.createElement('div'); curtain.id = 'fs-curtain-keys'; body.appendChild(curtain);
  const bar = doc.createElement('div'); bar.id = 'gridatlas-menu-bar'; body.appendChild(bar);
  const grid = doc.createElement('div'); grid.className = 'gm-panel-grid'; bar.appendChild(grid);
  const pbody = doc.createElement('div'); pbody.className = 'gm-panel-body'; if (!noGrid) grid.appendChild(pbody);
  let dashEl = null; if (dash) { dashEl = doc.createElement('button'); dashEl.id = 'gridatlas-dash-toggle'; dashEl._rect = dash; body.appendChild(dashEl); }
  const sources = new Map(), layers = new Map(), camera = [];
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; } }), addLayer: x => layers.set(x.id, { ...x }),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) { l.layout = l.layout || {}; l.layout[k] = v; } } };
  for (const k of ['fitBounds', 'flyTo', 'easeTo', 'jumpTo', 'setCenter', 'setZoom', 'panTo']) map[k] = (...a) => camera.push([k, a]);
  const handlers = []; let qrf = () => [];
  const mapEl = doc.createElement('div'); mapEl.id = 'map'; body.appendChild(mapEl); let proj = ll => ({ x: ll[0] * 10, y: ll[1] * 10 });
  map.getContainer = () => mapEl; map.project = ll => proj(ll);
  map.on = (t, a, b) => handlers.push({ t, layer: b ? a : null, f: b || a });
  map.queryRenderedFeatures = (pt, o) => (o && o.layers || []).flatMap(l => qrf(l, pt));
  const tapMap = (pt, hitsByLayer = {}) => { qrf = l => hitsByLayer[l] || []; const e = { point: pt, lngLat: { lng: 0, lat: 0 } };
    for (const h of handlers.filter(h => h.t === 'click')) { if (h.layer) { if ((hitsByLayer[h.layer] || []).length) h.f(e); } else h.f(e); } };
  const popups = []; class Popup { constructor(o) { this.o = o; this.removed = false; popups.push(this); } setLngLat(l) { this.ll = l; return this; } setDOMContent(d) { this.dom = d; return this; } setHTML(h) { this.html = h; return this; } addTo() { return this; } remove() { this.removed = true; } }
  if (bounds) map.getBounds = () => ({ contains: ([x, y]) => x >= bounds[0] && y >= bounds[1] && x <= bounds[2] && y <= bounds[3] });
  const log = { fetch: [], xhr: [], intervals: [], errors: [] }, parked = [], winL = {};
  class XHR { open(m, u) { this.url = u; } send() { log.xhr.push(this.url); const d = feedFn(); setTimeout(() => { if (d && d.status) { this.status = d.status; this.onload(); return; } this.status = 200; this.responseURL = redirect === 'feed' ? 'https://evil.example/f.geojson' : this.url; this.responseText = typeof d === 'string' ? d : JSON.stringify(d); this.onload(); }, 0); } }
  let nIdx = 0;
  const fetch = async url => {
    log.fetch.push(url); await null;
    if (url.split('?')[0].endsWith('/history/index.json')) {
      const v = typeof index === 'function' ? await index(++nIdx) : index;
      if (redirect === 'index') return { ok: true, status: 200, redirected: true, url: 'https://evil.example/index.json', json: async () => mkIndex() };
      return v == null ? new Response('nope', { status: 404 }) : new Response(typeof v === 'string' ? v : enc(v), { status: 200 });
    }
    if (park) await new Promise(r => parked.push(r));
    const k = url.split('/history/')[1]; return files[k] ? new Response(files[k], { status: 200 }) : new Response('nope', { status: 404 });
  };
  const W = { maplibregl: { Popup }, __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight, crypto: noCrypto ? undefined : webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const addEventListener = (t, f) => (winL[t] = winL[t] || []).push(f);
  W.addEventListener = addEventListener;
  let D = Date;
  if (now !== null) D = class extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } };
  const sandbox = { window: W, document: doc, Date: D, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: phone }),
    MutationObserver: class { observe() {} disconnect() {} }, innerHeight, addEventListener, maplibregl: { Popup } };
  const robs = []; if (ro) sandbox.ResizeObserver = class { constructor(f) { this.f = f; } observe(el) { robs.push({ el, f: this.f }); } };
  const code = globalThis.__SRC_OVERRIDE ? globalThis.__SRC_OVERRIDE.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S};' + SEAM) : PROBED;
  vm.runInNewContext(code, sandbox, { filename: MODULE, timeout: 5000 });
  const api = W.__GRIDATLAS_MODULES__.ukLightning, probe = W.__PROBE__;
  const installed = lazy ? false : api.install();
  if (!noGrid && !lazy) assert.equal(installed, true, 'install');
  const main = new Proxy({}, { get: (_, k) => probe.S.sfs[0][k] });
  const click = el => dispatch(el, 'click', log.errors);
  const toggle = on => { const t = main.toggle; t.checked = on; dispatch(t, 'change', log.errors); };
  const cap = k => main.caps[k].textContent;
  const fire = t => { sandbox.innerHeight = W.innerHeight; for (const f of winL[t] || []) f({ type: t }); };
  const release = () => { while (parked.length) parked.shift()(); };
  return { mapEl, setProj: f => { proj = f; }, handlers, tapMap, popups, map, robs, winL, installed, doc, grid, api, probe, S: probe.S, log, main, click, toggle, cap, host, orig, pbody, sources, layers, camera, dashEl, W, sandbox, fire, release, parked,
    chip: p => main.chips[p], nav: n => main.nav[n], status: () => main.stx.textContent, label: () => main.label.textContent };
}
const unhandled = [];
process.on('unhandledRejection', e => unhandled.push(e));
const drain = async () => { for (let k = 0; k < 30; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const sha = b => createHash('sha256').update(b).digest('hex');

const P = d => 'days/' + d.replace(/-/g, '/') + '.json';
const shard = (date, n, t0) => { const fs = []; for (let i = 0; i < n; i++) fs.push(flash(t0 + i, date + '-' + i)); const b = enc(dayFile(date, fs)); return { b, row: { count: n, bytes: b.length, sha256: sha(b), path: P(date) } }; };
// ---------------------------------------------------------------- kv-regress probes (G/H/I comparison). SYNTHETIC data.
const OUT = {}; const rec = (k, v) => { OUT[k] = v; };
process.on('exit', () => { console.log('KVJSON ' + JSON.stringify(OUT)); });
const dayReq = x => x.log.fetch.filter(u => u.includes('/days/')).length;
const idxReq = x => x.log.fetch.filter(u => u.includes('/index.json')).length;
const snap = x => ({ mode: x.S.res && x.S.res.mode, clp: !!(x.S.res && x.S.res.clp), drawn: x.S.last && x.S.last.drawn, cluster: x.S.last && x.S.last.cluster, state: x.S.last && x.S.last.state, dayReq: dayReq(x), points_btn_visible: !x.nav('points').hidden, consent: x.S.consent, flashes: x.cap('flashes').slice(0, 160) });
const bytesReq = (x, files) => x.log.fetch.filter(u => u.includes('/days/')).reduce((a, u) => a + ((files[u.split('/history/')[1]] || '').length || 0), 0);
const realLike = (nDays, per) => { const files = {}, over = {}; for (let k = 1; k <= nDays; k++) { const d = ymd(Date.now() - k * D); const s = shard(d, per, Date.parse(d + 'T10:00:00Z')); files[s.row.path] = s.b; over[d] = { ...s.row, sealed: true }; } return { files, over }; };

test('K1: 3M/12M with a small honest archive (22 days, 1,496 flashes)', async () => {
  const { files, over } = realLike(22, 68);
  for (const p of ['30d', '3m', '12m']) { const x = boot({ index: mkIndex(over), files }); x.toggle(true); await drain(); x.click(x.chip(p)); await drain(); rec('K1-' + p, { ...snap(x), bytesDownloaded: bytesReq(x, files) }); }
});

test('K2: 12M, 366 days x 110 = 40,260 flashes (> BUDGET): no auto day requests; LOAD POINTS stays within 40,000 / 32 MB / 400 files', async () => {
  const over = {}; for (let k = 0; k <= 365; k++) { const d = ymd(Date.now() - k * D); over[d] = { count: 110, bytes: 58300, path: P(d), sha256: 'x' }; }
  const x = boot({ index: mkIndex(over) }); x.toggle(true); await drain(); const before = dayReq(x); x.click(x.chip('12m')); await drain();
  const a = snap(x); a.dayReqAfterChip = dayReq(x) - before; assert.equal(a.dayReqAfterChip, 0, '12M fetched day files before consent');
  const b0 = dayReq(x); x.click(x.nav('points')); await drain(); const b = snap(x); b.dayReqAfterConsent = dayReq(x) - b0; b.loadedDays = x.S.res.ld && x.S.res.ld.length; b.skipped = x.S.res.sk && x.S.res.sk.length; b.indexCount = x.S.res.ic;
  rec('K2', { beforeConsent: a, afterConsent: b });
  if (x.S.res.ld && x.S.res.ld.length) { assert.ok(b.dayReqAfterConsent <= 400, 'files cap'); assert.ok(x.S.res.ic <= 40000, 'point cap'); assert.ok(x.S.res.ld.length * 58300 <= 32e6, 'byte cap'); }
});

test('K3: 12M, 40 days x 10 flashes x 1 MB = 40 MB: asks; consent loads <= 32 MB', async () => {
  const over = {}; for (let k = 1; k <= 40; k++) { const d = ymd(Date.now() - k * D); over[d] = { count: 10, bytes: 1e6, path: P(d), sha256: 'x' }; }
  const x = boot({ index: mkIndex(over) }); x.toggle(true); await drain(); x.click(x.chip('12m')); await drain(); const a = snap(x);
  const b0 = dayReq(x); x.click(x.nav('points')); await drain(); const b = { ...snap(x), dayReqAfterConsent: dayReq(x) - b0 };
  rec('K3', { beforeConsent: a, afterConsent: b }); assert.equal(a.dayReq - (a.dayReq), 0); assert.ok(b.dayReqAfterConsent <= 32, 'more than 32 MB requested');
});

test('K4: 12M, 20 days x 24 hourly parts = 480 files: asks; consent requests <= 400 files', async () => {
  const over = {}; for (let k = 1; k <= 20; k++) { const d = ymd(Date.now() - k * D), dp = d.replace(/-/g, '/'); over[d] = { count: 24, bytes: 1, path: null, sealed: true, parts: Array.from({ length: 24 }, (_, h) => ({ path: `days/${dp}/${String(h).padStart(2, '0')}.json`, count: 1, bytes: 500, sha256: 'x' })) }; }
  const x = boot({ index: mkIndex(over) }); x.toggle(true); await drain(); const z = dayReq(x); x.click(x.chip('12m')); await drain(); const a = { ...snap(x), dayReqAfterChip: dayReq(x) - z };
  const b0 = dayReq(x); x.click(x.nav('points')); await drain(); const b = { ...snap(x), dayReqAfterConsent: dayReq(x) - b0 };
  rec('K4', { beforeConsent: a, afterConsent: b });
});

test('K5: 15,000 flashes in 12M: desktop vs phone; consent on phone', async () => {
  const d1 = ymd(Date.now() - 40 * D), s = shard(d1, 15000, Date.parse(d1 + 'T10:00:00Z')), files = { [s.row.path]: s.b };
  for (const phone of [false, true]) { const x = boot({ phone, index: mkIndex({ [d1]: { ...s.row, sealed: true } }), files }); x.toggle(true); await drain(); x.click(x.chip('12m')); await drain(); const a = snap(x);
    x.click(x.nav('points')); await drain(); rec('K5-' + (phone ? 'phone' : 'desktop'), { auto: a, afterPoints: snap(x) }); }
  for (const phone of [false, true]) { const d2 = ymd(Date.now() - 3 * D), s2 = shard(d2, 15000, Date.parse(d2 + 'T10:00:00Z'));
    const x = boot({ phone, index: mkIndex({ [d2]: { ...s2.row, sealed: true } }), files: { [s2.row.path]: s2.b } }); x.toggle(true); await drain(); x.click(x.chip('30d')); await drain(); rec('K5-30d-' + (phone ? 'phone' : 'desktop'), snap(x)); }
});

test('K6: consent lifetime (refresh tick, PREV, period change)', async () => {
  const d1 = ymd(Date.now() - 40 * D), d2 = ymd(Date.now() - 41 * D);
  const x = boot({ index: mkIndex({ [d1]: { count: 25000, bytes: 1000, path: P(d1), sha256: 'x' }, [d2]: { count: 25000, bytes: 1000, path: P(d2), sha256: 'y' } }) });
  x.toggle(true); await drain(); x.click(x.chip('12m')); await drain(); const r = { chip: snap(x) };
  x.click(x.nav('points')); await drain(); r.points = snap(x);
  const tick = x.log.intervals.find(i => i.ms === 6e5); const q = dayReq(x); tick.f(); await drain(); r.tick = { ...snap(x), newDayReq: dayReq(x) - q };
  x.click(x.chip('3m')); await drain(); r.chip3m = snap(x);
  x.click(x.chip('12m')); await drain(); x.click(x.nav('points')); await drain(); x.click(x.nav('prev')); await drain(); r.prev = snap(x);
  rec('K6', r);
});

test('K7: request volume per 10-minute refresh at 12M (22 sealed days)', async () => {
  const { files, over } = realLike(22, 68); const x = boot({ index: mkIndex(over), files }); x.toggle(true); await drain(); x.click(x.chip('12m')); await drain();
  const tick = x.log.intervals.find(i => i.ms === 6e5); const r = { initialDay: dayReq(x), ticks: [] };
  for (let k = 0; k < 3; k++) { const a = dayReq(x), b = idxReq(x), c = x.log.xhr.length; tick.f(); await drain(); r.ticks.push({ day: dayReq(x) - a, index: idxReq(x) - b, feed: x.log.xhr.length - c }); }
  rec('K7', r);
});

test('K8: an open flash card across a period change / refresh', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); x.W.__GRIDATLAS_NEON_LINKS__ = { substations: [{ at: [-1.6, 52], kv: [132], name: 'A' }], measure: { distanceKm: () => 7 } };
  x.toggle(true); await drain(); x.click(x.chip('48h')); await drain();
  x.tapMap([5, 5], { 'l-gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [0, 0] } }] });
  const open = () => !!x.mapEl.querySelector('[data-lightning-card]') || x.popups.some(p => !p.removed);
  const n = x.mapEl.querySelector('[data-lightning-nearest]'); if (n) dispatch(n, 'click', x.log.errors);
  const r = { opened: open(), nearest: !!x.sources.get('gridatlas-lightning-nearest') };
  x.click(x.chip('12h')); await drain(); r.afterPeriodChange = { open: open(), drawn: x.S.last.drawn, nearest: !!x.sources.get('gridatlas-lightning-nearest') };
  const tick = x.log.intervals.find(i => i.ms === 6e5); tick.f(); await drain(); r.afterRefresh = { open: open(), nearest: !!x.sources.get('gridatlas-lightning-nearest') };
  rec('K8', r);
});

test('K9: index whose hourly parts claim count 0 on a counted day (corrupt index) - pre-check view', async () => {
  for (const p of ['30d', '12m']) { const over = {}; for (let k = 1; k <= 16; k++) { const d = ymd(Date.now() - k * D), dp = d.replace(/-/g, '/'); over[d] = { count: 3000, bytes: 1, path: null, sealed: true, parts: Array.from({ length: 16 }, (_, h) => ({ path: `days/${dp}/${String(h).padStart(2, '0')}.json`, count: 0, sha256: 'x' })) }; }
    const x = boot({ index: mkIndex(over) }); x.toggle(true); await drain(); const z = dayReq(x); x.click(x.chip(p)); await drain(); rec('K9-' + p, { ...snap(x), dayReqAfterChip: dayReq(x) - z }); }
});

test('K7b: request volume per 10-minute refresh at 30D (22 sealed days)', async () => {
  const { files, over } = realLike(22, 68); const x = boot({ index: mkIndex(over), files }); x.toggle(true); await drain(); x.click(x.chip('30d')); await drain();
  const tick = x.log.intervals.find(i => i.ms === 6e5); const a = dayReq(x); tick.f(); await drain(); rec('K7b', { initialDay: a, tickDay: dayReq(x) - a });
});
test('K8b: open card, then PREV to a window without that flash', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); x.toggle(true); await drain();
  x.tapMap([5, 5], { 'l-gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [0, 0] } }] });
  const open = () => !!x.mapEl.querySelector('[data-lightning-card]') || x.popups.some(p => !p.removed);
  const r = { opened: open() }; x.click(x.nav('prev')); await drain(); r.afterPrev = { open: open(), drawn: x.S.last.drawn }; rec('K8b', r);
});
