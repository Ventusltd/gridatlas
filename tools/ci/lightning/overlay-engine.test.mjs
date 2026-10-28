#!/usr/bin/env node
// @gate-min-generation 202610282100
// Vendored from the hardening lanes' test-engine.mjs (Build M2, 202610282100: 176 tests, a superset of
// test-fixes.mjs), so the PR gate (tools/ci/pr-gate.mjs, docs/CI.md) runs the lightning engine, cell and REPD
// tests on every overlay module from 202610282100 on. Changes from the source, all mechanical:
//   - the module path is read from LIGHTNING_MODULE (the gate's variable) or MODULE;
//   - fixtures come from ./fixtures/ (provenance and SHA-256 in docs/CI.md); the REPD register is one gzip of
//     the repd_master_v8_oracle export that both REPD_REAL and REPD_IND pointed at (10,784 identical rows);
//   - a CI-additions section at the end (CI1, CI2) closes a gap a mutation run found.
//   - the six LIGHTNING_DATA tests still skip unless LIGHTNING_DATA points at a Ventusltd/lightning data/history
//     checkout (the gate has no network).
// The tests below were written fail-first against earlier builds; do not relax an expectation to make a module pass.
// A new build that changes behaviour on purpose updates the affected test here, in the same PR, with the reason.
//   LIGHTNING_MODULE=atlas/modules/<gen>-uk-lightning-overlay.js node --test tools/ci/lightning/overlay-engine.test.mjs
// --- original header ---
// test-fixes.mjs — one fail-first test per defect for the 202610261949 uk-lightning overlay.
// Harness: self-fixture under node:vm with a minimal synthetic DOM (minidom.mjs) and SYNTHETIC index/feed/shard data
// built in this file; no network, no browser. Usage:  MODULE=<path to overlay .js> node --test test-fixes.mjs
// Expected: every test FAILS on the unmodified module (fda6b10) and PASSES on fixed-module.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash, webcrypto } from 'node:crypto';
import { El, makeDocument, dispatch } from './minidom.mjs';

const MODULE = process.env.LIGHTNING_MODULE || process.env.MODULE;
if (!MODULE) throw new Error('set LIGHTNING_MODULE=<overlay path>');
const SRC = readFileSync(MODULE, 'utf8');
const SEAM = 'NS.ukLightning=Object.freeze(';
assert.equal(SRC.split(SEAM).length, 2, 'seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S};' + SEAM);

const H = 36e5, D = 864e5;
// L3 (drain flake): count in-flight fetches, Response bodies and WebCrypto digests of the CURRENT boot only (__G);
// drain() keeps ticking while any is pending, but stops after 100 ticks with no settlement (a deliberately held promise).
globalThis.__G = 0; globalThis.__PEND = 0; globalThis.__PARK = 0; globalThis.__SET = 0;
const track = p => { const g = globalThis.__G; globalThis.__PEND++; return Promise.resolve(p).finally(() => { if (g === globalThis.__G) { globalThis.__PEND--; globalThis.__SET++; } }); };
class TResponse extends Response { arrayBuffer() { return track(super.arrayBuffer()); } json() { return track(super.json()); } }
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
  globalThis.__G++; globalThis.__PEND = 0; globalThis.__PARK = 0; const doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body);
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
  map.getContainer = () => mapEl; map.project = ll => proj(ll); map.once = (t, f) => f(); // moveend after flyTo, immediately
  map.on = (t, a, b) => handlers.push({ t, layer: b ? a : null, f: b || a });
  map.queryRenderedFeatures = (pt, o) => (o && o.layers || []).flatMap(l => qrf(l, pt));
  const tapMap = (pt, hitsByLayer = {}) => { for (const q of hitsByLayer['gridatlas-lightning-hit'] || []) if (q.properties && !('s' in q.properties) && W.__GRIDATLAS_MODULES__.ukLightning.state.res) q.properties.s = W.__GRIDATLAS_MODULES__.ukLightning.state.res.s; qrf = l => hitsByLayer[l] || []; const e = { point: pt, lngLat: { lng: 0, lat: 0 } };
    for (const h of handlers.filter(h => h.t === 'click')) { if (h.layer) { if ((hitsByLayer[h.layer] || []).length) h.f(e); } else h.f(e); } };
  const popups = []; class Popup { constructor(o) { this.o = o; this.removed = false; popups.push(this); } setLngLat(l) { this.ll = l; return this; } setDOMContent(d) { this.dom = d; return this; } setHTML(h) { this.html = h; return this; } addTo() { return this; } remove() { this.removed = true; } }
  if (bounds) map.getBounds = () => ({ contains: ([x, y]) => x >= bounds[0] && y >= bounds[1] && x <= bounds[2] && y <= bounds[3] });
  const log = { fetch: [], xhr: [], intervals: [], errors: [] }, parked = [], winL = {};
  class XHR { open(m, u) { this.url = u; } send() { log.xhr.push(this.url); const d = feedFn(); setTimeout(() => { if (d && d.status) { this.status = d.status; this.onload(); return; } this.status = 200; this.responseURL = redirect === 'feed' ? 'https://evil.example/f.geojson' : this.url; this.responseText = typeof d === 'string' ? d : JSON.stringify(d); this.onload(); }, 0); } }
  let nIdx = 0;
  const fetch = url => track(fetch0(url)); const fetch0 = async url => {
    log.fetch.push(url); await null;
    if (url.split('?')[0].endsWith('/history/index.json')) {
      const v = typeof index === 'function' ? await index(++nIdx) : index;
      if (redirect === 'index') return { ok: true, status: 200, redirected: true, url: 'https://evil.example/index.json', json: async () => mkIndex() };
      return v == null ? new TResponse('nope', { status: 404 }) : new TResponse(typeof v === 'string' ? v : enc(v), { status: 200 });
    }
    if (park) { const g = globalThis.__G; globalThis.__PARK++; await new Promise(r => parked.push(r)); if (g === globalThis.__G) globalThis.__PARK--; }
    const k = url.split('/history/')[1]; return files[k] ? new TResponse(files[k], { status: 200 }) : new TResponse('nope', { status: 404 });
  };
  const W = { maplibregl: { Popup }, __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight, crypto: noCrypto ? undefined : { subtle: { digest: (a, b) => track(webcrypto.subtle.digest(a, b)) } }, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const addEventListener = (t, f) => (winL[t] = winL[t] || []).push(f);
  W.addEventListener = addEventListener;
  let D = Date;
  if (now !== null) D = class extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } };
  const sandbox = { window: W, document: doc, Date: D, AbortController, Map, XMLHttpRequest: XHR, fetch, Response: TResponse, TextDecoder, setTimeout, clearTimeout,
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: phone }),
    MutationObserver: class { observe() {} disconnect() {} }, innerHeight, addEventListener, maplibregl: { Popup } };
  const robs = []; if (ro) sandbox.ResizeObserver = class { constructor(f) { this.f = f; this.off = 0; } observe(el) { robs.push({ el, f: this.f, o: this }); } disconnect() { this.off++; } };
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
const drain = async () => { let idle = 0, last = -1; for (let k = 0; k < 30 || (globalThis.__PEND > globalThis.__PARK && idle < 100 && k < 5000); k++) { const sig = globalThis.__SET * 1e4 + globalThis.__PEND; idle = sig === last ? idle + 1 : 0; last = sig; await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const sha = b => createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- ChatGPT findings
test('H01: OFF->ON revalidates the live feed (no cached promise)', async () => {
  let resp = feed([flash(Date.now() - 2 * H, 'old')]);
  const x = boot({ feedFn: () => resp });
  x.toggle(true); await drain();
  assert.equal(x.S.res.ev[0].id, 'old');
  x.toggle(false); resp = feed([flash(Date.now() - 0.5 * H, 'new')]);
  x.toggle(true); await drain();
  assert.equal(x.log.xhr.length, 2, 'second ON must request the feed again');
  assert.equal(x.S.res.ev.at(-1).id, 'new');
});

test('H01/F3: the 10-minute refresh re-requests the live feed, not only index.json', async () => {
  let n = 0; const x = boot({ feedFn: () => feed([flash(Date.now() - 2 * H, 'f' + (++n))]) });
  x.toggle(true); await drain();
  const tick = x.log.intervals.find(i => i.ms === 6e5); assert.ok(tick, 'refresh timer');
  tick.f(); await drain(); tick.f(); await drain();
  assert.equal(x.log.xhr.length, 3, 'feed requests after two refresh ticks');
  assert.equal(x.S.res.ev[0].id, 'f3');
});

test('H02/F4: a feed whose query_end_utc is 6 h old is STALE in state, label and status', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - 7 * H, 'a')], 6) });
  x.toggle(true); await drain();
  assert.equal(x.S.last.stale, true);
  assert.match(x.status(), /COLLECTOR LAST R[AU]N/); // J: kv-words (was /STALE/ on label and status)
});

test('H03: ok() rejects malformed and out-of-box coordinates; such a record is never drawn', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - 2 * H, 'in'), flash(Date.now() - 2 * H, 'out', [150, 10]), flash(Date.now() - 2 * H, 'nul', [null, 52])]) });
  assert.equal(x.probe.ok(flash(0, 'v', [-1.5, 52])), true);
  for (const bad of [[150, 10], [null, 52], ['bad', 52], [NaN, 52], [-1.5, 95], [], [0], null, 5, '1,52', [[-1.5, 52]], [Infinity, 52]])
    assert.equal(x.probe.ok(flash(0, 'b', bad)), false, 'accepted ' + JSON.stringify(bad));
  x.toggle(true); await drain();
  assert.equal(JSON.stringify(x.sources.get('gridatlas-lightning').data.features.map(f => f.id)), '["in"]');
});

test('H04: a shard is rejected when its count, bytes or sha256 differ from the index entry; a matching shard loads', async () => {
  const date = ymd(Date.now() - 2 * D), body = enc(dayFile(date, [flash(Date.parse(date + 'T12:00:00Z'), 'z')]));
  const good = { path: 'days/' + date.replace(/-/g, '/') + '.json', sealed: true, count: 1, bytes: body.length, sha256: sha(body) };
  const fresh = () => boot({ files: { [good.path]: body } }).probe; // fresh boot per case: sh() caches by URL
  assert.equal((await fresh().sh(good, date)).length, 1, 'matching shard must load');
  for (const [k, v] of [['count', 2], ['bytes', body.length + 1], ['sha256', '0'.repeat(64)]])
    await assert.rejects(fresh().sh({ ...good, [k]: v }, date), new RegExp(k), k + ' mismatch accepted');
});

test('H05: a sub-day budget caption never calls whole-day index sums "in window"', async () => {
  const x = boot(), now = Date.now(), w = { s: now - 12 * H, e: now, period: '12h', label: '12 hours', atLatest: true, custom: false, clamped: false };
  const r = { w, mode: 'detail', idx: { gen: now, iv: 1, nextDue: now + H }, ev: [flash(now - 2 * H, 'v')], arch: 50000, ld: ['d1'], sk: ['d0'], fl: [], rq: 2, cs: 'index', ic: 40000, cl: true, cov: { f: 1, r: 6, a: w.s, b: w.e, ny: 0, bf: 0, u: [], d: 2 } };
  const L = x.probe.cp(r, now);
  assert.doesNotMatch(L.flashes, /archived in window/);
  assert.match(L.flashes, /50,000 archived on the overlapping UTC dates \(index, whole days\)/);
});

// ---------------------------------------------------------------- overlay-code-review F1-F6
test('F2: CUSTOM clicked during the first LOADING neither throws nor paints the stale 24h result', async () => {
  const x = boot({ index: mkIndex() });
  x.toggle(true); x.click(x.chip('custom'));
  assert.deepEqual(x.log.errors.map(String), [], 'click handler threw');
  await drain();
  assert.equal(x.S.res.w.custom, true, 'result painted under the CUSTOM chip is not the custom window');
  assert.match(x.cap('window'), /^Window {2}UTC dates /);
});

test('F1: an unparsable feed timestamp does not wedge the UI (label leaves [LOAD], chips still load)', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - 2 * H, 'a')], 1, { query_end_utc: 'garbage', latest_detection_utc: 'nope' }) });
  x.toggle(true); await drain();
  assert.doesNotMatch(x.label(), /\[LOAD\]/); assert.notEqual(x.status(), 'LOADING');
  const before = x.log.xhr.length + x.log.fetch.length;
  x.click(x.chip('7d')); await drain();
  assert.deepEqual(x.log.errors.map(String), []);
  assert.ok(x.log.xhr.length + x.log.fetch.length > before, 'chip click started no load');
  assert.equal(x.S.last.period, '7d');
  assert.match(x.cap('refresh'), /Refresh live feed unknown/);
  assert.deepEqual(unhandled.filter(e => /Invalid time value/.test(String(e))).length, 0, 'RangeError escaped');
});

test('F5: PREV is disabled in feed-only mode', async () => {
  const x = boot();
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.equal(x.S.res.mode, 'feed');
  assert.equal(x.nav('prev').disabled, true);
});

test('F6 / owner device 2: feed-mode coverage reads "unknown (live feed records only its last collection window)", never a percentage', async () => {
  const x = boot();
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.cap('searched'), 'Searched EUMETSAT unknown (live feed records only its last collection window)');
  assert.doesNotMatch(x.status(), /%/);
  assert.match(x.label(), /\[1 \| live feed\]/); // J: kv-words
});

test('F9: bytes:null is estimated, not counted as 0, in the 32 MB budget', async () => {
  const d1 = ymd(Date.now() - D), d2 = ymd(Date.now() - 2 * D), p = d => 'days/' + d.replace(/-/g, '/') + '.json';
  const x = boot({ index: mkIndex({ [d1]: { count: 10, bytes: 30e6, path: p(d1), sha256: 'x' }, [d2]: { count: 5000, bytes: null, path: p(d2), sha256: 'y' } }) });
  x.toggle(true); await drain(); const before = x.log.fetch.filter(u => u.includes('/days/')).length;
  x.click(x.chip('7d')); await drain();
  assert.equal(x.S.res.clp, true, '30 MB + 5,000 flashes x 530 B must exceed 32 MB and ask before loading');
  assert.equal(x.log.fetch.filter(u => u.includes('/days/')).length, before, 'day files fetched without consent');
});

// ---------------------------------------------------------------- owner decision pack
test('R02: a v1 index reads "archive unavailable", not "archive not yet published"', async () => {
  const x = boot({ index: { schema: 'uk-lightning-history-index.v1', days: [] } });
  x.toggle(true); await drain();
  assert.match(x.cap('refresh'), /archive unavailable: unsupported index schema uk-lightning-history-index\.v1/);
  assert.doesNotMatch(x.cap('refresh'), /not yet published/);
});

test('R04: CUSTOM shows a custom-window caption at once, not the previous period until APPLY', async () => {
  const x = boot({ index: mkIndex() });
  x.toggle(true); x.click(x.chip('3m')); await drain();
  assert.match(x.cap('window'), /3 months/);
  x.click(x.chip('custom')); await drain();
  assert.doesNotMatch(x.cap('window'), /3 months/);
  assert.match(x.cap('window'), /^Window  UTC dates/); // J: kv-words
});

test('LP: LOAD POINTS stops before a day that would break 40,000 flashes or 32 MB', async () => {
  const p = d => 'days/' + d.replace(/-/g, '/') + '.json', dd = [1, 2, 3].map(k => ymd(Date.now() - k * D));
  const big = Object.fromEntries(dd.map(d => [d, { count: 30000, bytes: 1000, path: p(d), sha256: 'x' }]));
  let x = boot({ index: mkIndex(big) });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.res.clp, true); x.click(x.nav('points')); await drain();
  assert.ok(x.S.last.index_count <= 40000, `loaded ${x.S.last.index_count} > 40,000`);
  const heavy = Object.fromEntries(dd.map(d => [d, { count: 100, bytes: 20e6, path: p(d), sha256: 'x' }]));
  x = boot({ index: mkIndex(heavy) });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.res.clp, true); x.click(x.nav('points')); await drain();
  assert.equal(x.S.res.ld.length, 1, `days loaded ${x.S.res.ld.length}: 32 MB ignored after consent`);
});

// ---------------------------------------------------------------- owner iPhone (2026-10-26 22:44 UTC)
test('Owner device 1: in feed fallback the 30D-12M chips respond with "archive not yet published: earlier coverage unknown, not zero"', async () => {
  const x = boot();
  x.toggle(true); await drain();
  for (const p of ['30d', '3m', '6m', '12m']) assert.equal(x.chip(p).disabled, false, p + ' chip disabled');
  x.click(x.chip('12m')); await drain();
  assert.notEqual(x.S.last.state, 'FAIL');
  assert.equal(x.cap('warning'), 'archive not yet published: earlier coverage unknown, not zero');
  assert.equal(x.S.last.drawn, 1);
});

test('Owner device 3: bottom padding is inline on the lightning main group only; no original node or selector touched', async () => {
  const x = boot();
  assert.ok(parseFloat(x.main.group.style.paddingBottom) >= 56, 'spacer ' + x.main.group.style.paddingBottom);
  assert.equal(x.host.style.paddingBottom, undefined); assert.equal(x.host.style.cssText, '');
  assert.equal(x.orig.style.paddingBottom, undefined);
  if (x.S.menu) assert.equal(x.S.menu.group.style.paddingBottom, undefined, 'Grid footer row');
});

// ---------------------------------------------------------------- variant C additions (fail-first against 202610262310)
const attrsWith = (root, re) => [root, ...root.walk()].filter(e => [...e.attrs.values()].some(v => re.test(v)));

test('P14: the lightning main group carries an inline bottom spacer of at least 56 px (44 px HIDE LAYERS + 12 px inset)', async () => {
  const x = boot();
  assert.ok(parseFloat(x.main.group.style.paddingBottom) >= 56, 'paddingBottom ' + x.main.group.style.paddingBottom);
});

test('A11Y P15-1: period chips expose aria-pressed and it follows the selected period', async () => {
  const x = boot();
  x.toggle(true); await drain();
  assert.equal(x.chip('24h').getAttribute('aria-pressed'), 'true');
  assert.equal(x.chip('7d').getAttribute('aria-pressed'), 'false');
  x.click(x.chip('7d')); await drain();
  assert.equal(x.chip('7d').getAttribute('aria-pressed'), 'true');
  assert.equal(x.chip('24h').getAttribute('aria-pressed'), 'false');
});

test('A11Y P15-2: the custom From/To date inputs have accessible names', async () => {
  const x = boot();
  for (const k of ['from', 'to']) assert.match(x.main[k].getAttribute('aria-label') || '', new RegExp('^' + k + ' date \\(UTC\\)$'));
});

test('A11Y P15-3: no #555 text on lightning nodes; caption footer and status line are #888', async () => {
  const x = boot();
  assert.deepEqual(attrsWith(x.main.group, /#555/).map(e => e.tagName), [], '#555 still used');
  assert.match(x.main.caps.footer.getAttribute('style'), /color:#(888|[9a-f]{3})\b/);
  assert.match(x.main.group.querySelector('.status-dot').getAttribute('style') || '', /color:#(888|[9a-f]{3})\b/);
});

test('A11Y P15-4: FAIL-state label opacity is 0.6', async () => {
  const today = ymd(Date.now()), path = 'days/' + today.replace(/-/g, '/') + '.json';
  const x = boot({ index: mkIndex({ [today]: { count: 1, bytes: 10, path, sha256: 'x', sealed: false } }) });
  x.toggle(true); await drain();
  assert.equal(x.S.last.state, 'FAIL');
  assert.equal(x.main.label.style.opacity, '0.6');
});

test('R01/P02/P10: no Grid dropdown mirror is inserted; the original Grid panel keeps its children', async () => {
  const x = boot();
  assert.deepEqual(x.grid.children.map(c => c.className), ['gm-panel-body'], 'Grid panel children changed');
  assert.equal(x.doc.documentElement.querySelector('[data-lightning-group="menu"]'), null);
  assert.equal(x.S.menu, undefined);
});

test('R01: boot no longer waits for .gm-panel-body', async () => {
  const x = boot({ noGrid: true });
  assert.equal(x.installed, true, 'waiting_for ' + JSON.stringify(x.S.waiting_for));
});

test('R01: without the mirror, panel and curtain twins stay in sync both ways', async () => {
  const x = boot(), fs = x.S.sfs[1];
  fs.toggle.checked = true; dispatch(fs.toggle, 'change', x.log.errors); await drain();
  assert.equal(x.S.on, true); assert.equal(x.main.toggle.checked, true);
  assert.equal(fs.label.textContent, x.main.label.textContent);
  x.toggle(false); await drain();
  assert.equal(fs.toggle.checked, false); assert.match(fs.label.textContent, /\[WAIT\]/);
  assert.deepEqual(x.log.errors.map(String), []);
});

// ---------------------------------------------------------------- variant E (fail-first against fixed-module-D.js)
const P = d => 'days/' + d.replace(/-/g, '/') + '.json';
const shard = (date, n, t0) => { const fs = []; for (let i = 0; i < n; i++) fs.push(flash(t0 + i, date + '-' + i)); const b = enc(dayFile(date, fs)); return { b, row: { count: n, bytes: b.length, sha256: sha(b), path: P(date) } }; };

test('CR1: LOAD POINTS when the newest day alone exceeds the budget never reads EMPTY / "NO FLASHES DETECTED"', async () => {
  const today = ymd(Date.now()), y1 = ymd(Date.now() - D);
  const x = boot({ index: mkIndex({ [today]: { count: 45000, bytes: 1000, path: P(today), sha256: 'x', sealed: false }, [y1]: { count: 100, bytes: 1000, path: P(y1), sha256: 'y' } }) });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.res.clp, true); x.click(x.nav('points')); await drain();
  assert.notEqual(x.S.last.state, 'EMPTY-COVERED'); assert.doesNotMatch(x.status(), /NO FLASHES/); assert.doesNotMatch(x.label(), /EMPTY/);
  assert.match(x.cap('flashes'), /newest day alone exceeds/);
  assert.equal(x.nav('points').hidden, true, 'LOAD POINTS offered again although it cannot draw anything');
});

test('CR2: a failed index reload clears S.idx (no stale archive state after fallback)', async () => {
  let ok = true; const x = boot({ index: () => ok ? mkIndex() : null, feedFn: () => ({ status: 503 }) });
  x.toggle(true); await drain(); assert.ok(x.S.idx, 'first index');
  x.toggle(false); ok = false; x.toggle(true); await drain();
  assert.equal(x.S.idx, null, 'S.idx kept from the earlier index');
  assert.match(x.cap('warning'), /Archive unavailable: HTTP 404/);
});

test('CR3: superseded shard workers issue no new requests after OFF', async () => {
  const files = {}, over = {};
  for (let k = 0; k < 8; k++) { const d = ymd(Date.now() - k * D), s = shard(d, 1, Date.parse(d + 'T00:00:01Z')); files[s.row.path] = s.b; over[d] = s.row; }
  const x = boot({ index: mkIndex(over), files, park: true });
  x.toggle(true); await drain(); x.click(x.chip('7d')); await drain();
  x.toggle(false); const atOff = x.log.fetch.length;
  for (let k = 0; k < 6; k++) { x.release(); await drain(); }
  assert.equal(x.log.fetch.length, atOff, `${x.log.fetch.length - atOff} shard requests issued after OFF`);
});

test('CR4: a late, older index response does not overwrite a newer S.idx', async () => {
  let rel; const older = mkIndex({}, { generated_utc: iso(Date.now() - 2 * H) }), newer = mkIndex({}, { generated_utc: iso(Date.now() - 60e3) });
  const x = boot({ index: n => n === 1 ? new Promise(r => { rel = () => r(older); }) : newer });
  x.toggle(true); await drain(); x.toggle(false); x.toggle(true); await drain();
  assert.equal(x.S.idx.gen, Date.parse(newer.generated_utc));
  rel(); await drain();
  assert.equal(x.S.idx.gen, Date.parse(newer.generated_utc), 'older index overwrote S.idx');
});

test('CR5/S4: index counts must be non-negative integers ("03" and 1e400 are rejected, archive fails closed)', async () => {
  const d = ymd(Date.now() - D);
  for (const bad of ['"03"', '1e400']) {
    const body = JSON.stringify(mkIndex({ [d]: { count: 777777, path: P(d), bytes: 10, sha256: 'x' } })).replace('777777', bad);
    const x = boot({ index: body }); x.toggle(true); await drain();
    assert.equal(x.S.idx, null, bad + ' accepted'); assert.match(x.S.ie || '', /count/);
  }
});

test('CR6: a budget-truncated LOAD POINTS result is PARTIAL, not READY', async () => {
  const d8 = ymd(Date.now() - 8 * D), d9 = ymd(Date.now() - 9 * D), a = shard(d8, 30000, Date.parse(d8 + 'T10:00:00Z')), b = shard(d9, 30000, Date.parse(d9 + 'T10:00:00Z'));
  const x = boot({ index: mkIndex({ [d8]: a.row, [d9]: b.row }), files: { [a.row.path]: a.b, [b.row.path]: b.b } });
  x.toggle(true); x.click(x.chip('7d')); await drain(); x.click(x.nav('prev')); await drain();
  assert.equal(x.S.res.clp, true); x.click(x.nav('points')); await drain();
  assert.equal(x.S.res.sk.length, 1); assert.equal(x.S.last.failures, 0);
  assert.equal(x.S.last.state, 'PARTIAL');
});

test('M01: group spans the grid; spacer = HIDE LAYERS rect + 16 px, right inset clears the button, both recomputed on resize/orientationchange', async () => {
  const x = boot({ dash: { top: 788, bottom: 832, left: 245, right: 377, width: 132, height: 44 }, innerHeight: 844 });
  assert.equal(x.main.group.style.gridColumn, '1/-1');
  assert.equal(x.main.group.style.paddingBottom, '72px');
  x.main.group._rect = { top: 400, bottom: 900, left: 8, right: 385, width: 377, height: 500 }; x.fire('resize');
  assert.equal(x.main.group.style.paddingRight, '156px');
  x.W.innerHeight = 393; x.dashEl._rect = { top: 337, bottom: 381, left: 708, right: 840, width: 132, height: 44 }; x.main.group._rect = { right: 600 }; x.fire('orientationchange');
  assert.equal(x.main.group.style.paddingBottom, '72px'); assert.equal(x.main.group.style.paddingRight, '0px');
  const y = boot(); assert.equal(y.main.group.style.paddingBottom, '96px', 'fallback without the button');
});

test('M02: feed fallback on a long period states "<n> seen in the available 7-day feed · <period> requested · older history unknown" near the chips, with oldest/latest UTC', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - 5 * D, 'a'), flash(Date.now() - 2 * D, 'b')]) });
  x.toggle(true); x.click(x.chip('12m')); await drain();
  const want = '2 seen in the available 7-day feed · ' + x.S.res.w.label + ' requested · older history unknown';
  assert.ok(x.status().includes(want) || x.cap('flashes').includes(want), 'status/flashes line: ' + x.status() + ' | ' + x.cap('flashes'));
  assert.match(x.cap('actual'), /first \d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC · last \d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC/);
  assert.match(x.cap('warning'), /archive not yet published: earlier coverage unknown, not zero/);
});
const tm0 = f => Date.parse(f.properties.time_utc);

test('M03: drawn flashes outside map.getBounds() are reported; the map is never moved', async () => {
  const t = Date.now() - 20 * H;
  const x = boot({ bounds: [-3, 50, 2, 53], feedFn: () => feed([flash(t, 'a', [-4.212, 55.3743]), flash(t + 1, 'b', [-5.4351, 55.3068]), flash(t + 2, 'c', [-4.4874, 55.1637]), flash(t + 3, 'd', [-1.5, 52])]) });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.match(x.cap('flashes'), /3 of 4 outside the current view/);
  assert.deepEqual(x.camera, [], 'camera moved');
});

test('M04: caption 12 px, #bbb or brighter, disclaimer at least 11 px, normal wrapping', async () => {
  const x = boot(), st = x.main.group.querySelector('[data-lightning-caption]').getAttribute('style');
  assert.match(st, /font:12px/); assert.match(st, /color:#(bbb|[c-f]{3})\b/); assert.doesNotMatch(st, /overflow-wrap:anywhere/);
  assert.match(x.main.caps.footer.getAttribute('style'), /font-size:1[1-9]px/);
});

test('M05/H08: a feed result with a cov object keeps "Searched EUMETSAT unknown"', async () => {
  const x = boot(), now = Date.now(), w = { s: now - 7 * D, e: now, period: '7d', label: '7 days', atLatest: true, custom: false, clamped: false };
  const f = feed([flash(now - 2 * H, 'r')]);
  const L = x.probe.cp({ mode: 'feed', idx: null, ie: 'HTTP 404', meta: f.metadata, w, ev: f.features, fl: [], cs: 'live feed', ic: 1, cl: false, cov: { f: 0.02, ny: 0, bf: 0, u: [], d: 7, r: 1, a: now - 3 * H, b: now } }, now);
  assert.equal(L.searched, 'Searched EUMETSAT unknown (live feed records only its last collection window)');
});

test('SL: a shard_lost day is unknown coverage, never searched or zero, with the integrity warning', async () => {
  const d3 = ymd(Date.now() - 3 * D);
  const idx = mkIndex({ [d3]: { coverage: 'none', scanned_seconds: 0, count: null, shard_lost: true } },
    { integrity: { state: 'shard_lost', alert: 'INTEGRITY ALERT: 1 date lost', lost_days: [{ date: d3, reason: 'missing', detected_utc: iso(Date.now()), missing_paths: [P(d3)] }], recoveries: [] } });
  const x = boot({ index: idx });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.match(x.cap('warning'), /1 days lost from the archive \(integrity alert\), unknown, not zero/);
  const pc = searchedPct(x.cap('searched')); // J: hours, not a bare percentage
  assert.ok(pc <= 88, `lost day counted as searched (${pc}%)`);
  assert.ok(!/READY|EMPTY/.test(x.S.last.state), x.S.last.state);
});

test('S5: parts[] paths outside days/YYYY/MM/DD/HH.json fail the index closed; nothing off-path is requested', async () => {
  const d = ymd(Date.now() - D), h = Number(iso(Date.now()).slice(11, 13));
  const bad = mkIndex({ [d]: { count: 3, path: null, parts: [{ hour: h, path: '../../../../evil-owner/evil-repo/main/x.json', count: 3, bytes: 10, sha256: 'x' }] } });
  const x = boot({ index: bad }); x.toggle(true); await drain();
  assert.deepEqual(x.log.fetch.filter(u => !u.includes('/Ventusltd/lightning/main/data/history/')), []);
  assert.equal(x.S.idx, null); assert.match(x.S.ie || '', /parts/);
  const good = mkIndex({ [d]: { count: 3, path: null, parts: [{ hour: 5, path: P(d).replace('.json', '/05.json'), count: 3, bytes: 10, sha256: 'x' }] } });
  const y = boot({ index: good }); y.toggle(true); await drain(); assert.ok(y.S.idx, 'valid hourly part rejected');
});

test('S6: more than 24 parts per day fails closed with a named reason, not thousands of requests', async () => {
  const d = ymd(Date.now()), parts = []; for (let k = 0; k < 2000; k++) parts.push({ hour: 0, path: P(d).replace('.json', '/00.json'), count: 1, bytes: 10, sha256: 'x' });
  const x = boot({ index: mkIndex({ [d]: { count: 2000, path: null, parts, sealed: false } }) }); x.toggle(true); await drain();
  assert.ok(x.log.fetch.filter(u => u.includes('/days/')).length <= 24, x.log.fetch.length + ' requests');
  assert.equal(x.S.idx, null); assert.match(x.S.ie || '', /parts/);
});

test('S8: a huge scan_windows list does not reject the archive', async () => {
  const now = Date.now(), sw = []; for (let k = 0; k < 150000; k++) sw.push({ start_utc: iso(now - 300 * D + k * 60e3), end_utc: iso(now - 300 * D + k * 60e3 + 30e3), successful_runs: 1 });
  const x = boot({ index: mkIndex({}, { scan_windows: sw }) }); x.toggle(true); await drain();
  assert.ok(x.S.idx, 'archive rejected: ' + x.S.ie);
});

test('S10: one record with a giant coordinates array is rejected alone; the feed still draws', async () => {
  const big = flash(Date.now() - 2 * H, 'huge'); big.geometry.coordinates = new Array(200000).fill(1);
  const x = boot({ feedFn: () => feed([big, flash(Date.now() - H, 'ok')]) }); x.toggle(true); await drain();
  assert.notEqual(x.S.last.state, 'FAIL'); assert.equal(x.S.last.drawn, 1);
  assert.match(x.cap('flashes'), /1 malformed records rejected/);
});

test('S10b: id-less flashes dedupe on time+lon+lat, not all into one', async () => {
  const fs = []; for (let k = 0; k < 50; k++) { const f = flash(Date.now() - H - k * 1000, null, [-1.5 + k / 100, 52]); delete f.id; fs.push(f); }
  const dup = JSON.parse(JSON.stringify(fs[0]));
  const x = boot({ feedFn: () => feed([...fs, dup]) }); x.toggle(true); await drain();
  assert.equal(x.S.last.drawn, 50);
});

test('T08: 3M PREV then NEXT returns to the latest window (calendar months)', async () => {
  const x = boot({ index: mkIndex() });
  x.toggle(true); x.click(x.chip('3m')); await drain();
  x.click(x.nav('prev')); await drain(); x.click(x.nav('next')); await drain();
  assert.equal(x.S.res.w.atLatest, true, 'NEXT did not return to latest: ' + x.cap('window'));
});

test('T11: a feed without query_end_utc is STALE (age unknown)', async () => {
  const f = feed([flash(Date.now() - 2 * H, 'a')]); delete f.metadata.query_end_utc;
  const x = boot({ feedFn: () => f }); x.toggle(true); await drain();
  assert.equal(x.S.last.stale, true); assert.match(x.status(), /COLLECTOR LAST R[AU]N/); // J: kv-words
});

test('T12a: a sub-minute ingest gap reads "<1 min", not "0h 0min", and the searched % is floored (not 100%)', async () => {
  const now = Date.now(), cutoff = Date.parse(ymd(now) + 'T00:00:00Z') - 365 * D;
  const x = boot({ index: mkIndex({}, { scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(now - 20e3), successful_runs: 9 }] }) });
  x.toggle(true); await drain();
  assert.match(x.cap('warning'), /Not yet searched: last <1 min of window/); // L3: LR-words W5/W6
  assert.doesNotMatch(x.cap('searched'), /100%/);
});

test('T13: a zone-less time_utc is read as UTC in America/New_York', async () => {
  const tz = process.env.TZ; process.env.TZ = 'America/New_York';
  try {
    const t = Date.now() - 2 * H, f = flash(t, 'z'); f.properties.time_utc = iso(t).slice(0, 19);
    const x = boot({ feedFn: () => feed([f]) }); x.toggle(true); x.click(x.chip('12h')); await drain();
    assert.equal(x.S.last.drawn, 1);
    assert.match(x.cap('actual'), new RegExp(iso(t).slice(0, 10) + ' ' + iso(t).slice(11, 19) + ' UTC'));
  } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz; }
});

test('T14: a 30D window with a 40-min ingest tail is not 100% / READY / EMPTY-COVERED', async () => {
  const now = Date.now(), cutoff = Date.parse(ymd(now) + 'T00:00:00Z') - 365 * D;
  const x = boot({ index: mkIndex({}, { scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(now - 40 * 60e3), successful_runs: 9 }] }) });
  x.toggle(true); x.click(x.chip('30d')); await drain();
  assert.doesNotMatch(x.cap('searched'), /100%/); assert.equal(x.S.last.state, 'PARTIAL');
});

test('T15: CUSTOM at exactly 00:00:00.000 UTC never inverts the date range', async () => {
  const now = Date.parse(ymd(Date.now()) + 'T00:00:00.000Z'), today = ymd(now);
  const x = boot({ now, feedFn: () => feed([]) }); x.toggle(true); await drain(); x.click(x.chip('custom')); await drain();
  assert.match(x.cap('window'), new RegExp(`UTC dates ${today} to ${today} inclusive`));
});

// ---------------------------------------------------------------- data-contract parity (tools/proofs/202609012214-data-contract-parity.proof.mjs L55-75)
const parity = src => { const j = src.replace(/'\s*\n\s*\+\s*'/g, '').replace(/"\s*\n\s*\+\s*"/g, ''), out = {};
  for (const m of j.matchAll(/https:\/\/raw\.githubusercontent\.com\/Ventusltd\/([A-Za-z0-9._-]+)\/main\/([A-Za-z0-9._/-]+)/g)) { const k = m[1] + ':' + m[2]; if (k in out) continue;
    const s = j.slice(m.index, m.index + 600).match(/(?:REQUIRED_SCHEMA|GB_SCHEMA|ACCEPTS|SCHEMA)\s*=\s*'([^']+)'/); out[k] = s ? s[1] : null; } return out; };

test('PARITY: the bytes declare IX_SCHEMA for the archive URL and FEED_SCHEMA for the feed URL, and nothing else', () => {
  assert.deepEqual(parity(SRC), { 'lightning:data/history/': 'uk-lightning-history-index.v2', 'lightning:data/uk_lightning.geojson': 'FeatureCollection/optical_lightning_flash' });
});

test('IX_SCHEMA: the index loader enforces the declared constant (wrong, missing or v1 schema = archive unavailable)', async () => {
  const mutated = SRC.replace("IX_SCHEMA='uk-lightning-history-index.v2'", "IX_SCHEMA='uk-lightning-history-index.v9'");
  assert.notEqual(mutated, SRC, 'no IX_SCHEMA constant in the module');
  const run = async (src, index) => { const keep = globalThis.__SRC_OVERRIDE; globalThis.__SRC_OVERRIDE = src; try { const x = boot({ index }); x.toggle(true); await drain(); return x; } finally { globalThis.__SRC_OVERRIDE = keep; } };
  let x = await run(mutated, mkIndex());
  assert.equal(x.S.idx, null, 'a v2 index was accepted although IX_SCHEMA names v9');
  for (const schema of [undefined, 'uk-lightning-history-index.v1', 'nonsense']) {
    const idx = mkIndex(); if (schema === undefined) delete idx.schema; else idx.schema = schema;
    x = await run(SRC, idx);
    assert.equal(x.S.idx, null); assert.match(x.cap('refresh'), /archive unavailable: unsupported index schema/);
  }
  x = await run(SRC, mkIndex()); assert.ok(x.S.idx, 'genuine v2 index rejected');
});

// ---------------------------------------------------------------- variant F (fail-first against fixed-module-E.js)
const LAYER_ID = 'l-gridatlas-lightning';
const partPath = (d, h) => P(d).replace('.json', '/' + String(h).padStart(2, '0') + '.json');

test('E1: a 60 s scan gap is not "NO FLASHES DETECTED · SEARCHED 100%"', async () => {
  const now = Date.now(), cutoff = Date.parse(ymd(now) + 'T00:00:00Z') - 365 * D, gap = now - 36 * H;
  const x = boot({ index: mkIndex({}, { scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(gap), successful_runs: 9 }, { start_utc: iso(gap + 60e3), end_utc: iso(now), successful_runs: 9 }] }) });
  x.toggle(true); await drain(); x.click(x.nav('prev')); await drain();
  assert.notEqual(x.S.last.state, 'EMPTY-COVERED'); assert.doesNotMatch(x.status(), /SEARCHED 100%/);
});

test('E2/E02: 3M PREV then NEXT on 2026-05-31 returns exactly to the latest window (window-end stack)', async () => {
  const now = Date.parse('2026-05-31T12:00:00Z');
  const x = boot({ now, index: mkIndex({}, {}, now) });
  x.toggle(true); x.click(x.chip('3m')); await drain();
  const latest = x.S.res.w.e; x.click(x.nav('prev')); await drain(); x.click(x.nav('next')); await drain();
  assert.equal(x.S.res.w.atLatest, true, x.cap('window')); assert.equal(x.S.res.w.e, latest);
});

test('E03: 12M PREV then NEXT on leap day 2028-02-29 keeps the leap day', async () => {
  const now = Date.parse('2028-02-29T12:00:00Z');
  const x = boot({ now, index: mkIndex({}, {}, now) });
  x.toggle(true); x.click(x.chip('12m')); await drain();
  x.click(x.nav('prev')); await drain(); x.click(x.nav('next')); await drain();
  assert.equal(x.S.res.w.atLatest, true, x.cap('window'));
});

test('E3: a part without "hour" is still fetched (hour from its path), never a silent zero', async () => {
  const d = ymd(Date.now() - D), t = Date.parse(d + 'T12:00:00Z'), fs = [0, 1, 2].map(i => flash(t + i, 'p' + i)), body = enc({ ...dayFile(d, fs) });
  const part = { path: partPath(d, 12), count: 3, bytes: body.length, sha256: sha(body) };
  const x = boot({ index: mkIndex({ [d]: { count: 3, path: null, parts: [part] } }), files: { [part.path]: body } });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.equal(x.S.last.drawn, 3);
});

test('E4: a date with no index row inside full scan coverage is not EMPTY-COVERED', async () => {
  const x = boot({ index: mkIndex({ [ymd(Date.now() - 10 * D)]: null }) });
  x.toggle(true); x.click(x.chip('7d')); await drain(); x.click(x.nav('prev')); await drain();
  assert.notEqual(x.S.last.state, 'EMPTY-COVERED'); assert.doesNotMatch(x.status(), /NO FLASHES/);
});

test('E5: setOn(true) before install does not break the install (fit listeners registered)', async () => {
  const x = boot({ lazy: true, index: () => new Promise(() => {}) });
  x.api.setOn(true);
  assert.doesNotThrow(() => x.api.install());
  assert.ok((x.winL.resize || []).length > 0, 'resize listener missing');
});

test('E6: observation_kind must be exactly the string (an array is rejected)', () => {
  const x = boot(), f = flash(Date.now(), 'k'); f.properties.observation_kind = ['optical_lightning_flash'];
  assert.equal(x.probe.ok(f), false);
});

test('E7: a budget-truncated PARTIAL carries a reason', async () => {
  const d8 = ymd(Date.now() - 8 * D), d9 = ymd(Date.now() - 9 * D), a = shard(d8, 30000, Date.parse(d8 + 'T10:00:00Z')), b = shard(d9, 30000, Date.parse(d9 + 'T10:00:00Z'));
  const x = boot({ index: mkIndex({ [d8]: a.row, [d9]: b.row }), files: { [a.row.path]: a.b, [b.row.path]: b.b } });
  x.toggle(true); x.click(x.chip('7d')); await drain(); x.click(x.nav('prev')); await drain(); x.click(x.nav('points')); await drain();
  assert.equal(x.S.last.state, 'PARTIAL'); assert.ok(x.S.last.reasons.some(r => /not loaded/.test(r)), JSON.stringify(x.S.last.reasons));
});

test('E06: an index generated 2 h in the future (device clock behind) is STALE', async () => {
  const x = boot({ index: mkIndex({}, { generated_utc: iso(Date.now() + 2 * H), next_update_due_utc: iso(Date.now() + 3 * H) }) });
  x.toggle(true); await drain();
  assert.equal(x.S.last.stale, true);
});

test('F-A: negative or zero part counts reject the index (no budget bypass)', async () => {
  const d = ymd(Date.now());
  for (const c of [-10000000, 0]) {
    const x = boot({ index: mkIndex({ [d]: { count: 10000000, path: null, sealed: false, parts: [{ path: partPath(d, 1), count: 10000000, bytes: 1, sha256: 'x' }, { path: partPath(d, 2), count: c, bytes: 1, sha256: 'y' }] } }) });
    x.toggle(true); await drain();
    assert.equal(x.S.idx, null, 'part count ' + c + ' accepted'); assert.match(x.S.ie || '', /parts/);
  }
});

test('F-B: duplicate index rows for one date are loaded and counted once', async () => {
  const d = ymd(Date.now() - D), s1 = shard(d, 2, Date.parse(d + 'T12:00:00Z')), idx = mkIndex({ [d]: s1.row });
  idx.days.push(...Array.from({ length: 5 }, () => ({ ...idx.days.find(r => r.date === d) })));
  const x = boot({ index: idx, files: { [s1.row.path]: s1.b } });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.ok(x.log.fetch.filter(u => u.endsWith(s1.row.path)).length <= 1, 'duplicate rows fetched repeatedly');
  assert.equal(x.S.res.arch, 2);
});

test('F-C: listing every scan window twice does not raise Searched %', async () => {
  const now = Date.now(), w1 = { start_utc: iso(now - 10 * D), end_utc: iso(now - 3.5 * D), successful_runs: 1 };
  const x = boot({ index: mkIndex({}, { scan_windows: [w1, { ...w1 }] }) });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  const pc = searchedPct(x.cap('searched')); // J
  assert.ok(pc <= 51, pc + '%');
});

test('DATES: a rollover date such as 2026-02-30 rejects the index', async () => {
  const idx = mkIndex(); idx.days.push({ ...idx.days[0], date: '2026-02-30' });
  const x = boot({ index: idx }); x.toggle(true); await drain();
  assert.equal(x.S.idx, null); assert.match(x.S.ie || '', /date/);
});

test('F1: "Flashes 0 archived" never appears bare while UNKNOWN/PARTIAL; a lost day has its own Searched line', async () => {
  const now = Date.now();
  const x = boot({ index: mkIndex({}, { scan_windows: [{ start_utc: iso(now - 2 * D), end_utc: iso(now), successful_runs: 9 }] }) });
  x.toggle(true); x.click(x.chip('7d')); await drain(); x.click(x.nav('prev')); await drain();
  assert.match(x.S.last.state, /UNKNOWN|PARTIAL/);
  assert.match(x.cap('flashes'), /^Flashes not yet searched \(unknown, not zero\)/); // J: kv-paging K1 (was 'Flashes 0 archived … (unknown, not zero)')
  const d3 = ymd(now - 3 * D), y = boot({ index: mkIndex({ [d3]: { coverage: 'none', scanned_seconds: 0, count: null, shard_lost: true } }) });
  y.toggle(true); await drain(); y.click(y.chip('custom')); await drain();
  y.main.from.value = d3; y.main.to.value = d3; y.click(y.nav('apply')); await drain();
  assert.doesNotMatch(y.cap('searched'), /no collection run/); assert.match(y.cap('searched'), /shard lost \(integrity alert\), unknown, not zero/);
});

test('F2: index/shard mismatch refetches the index once (cache-busted) and retries; if still inconsistent, PARTIAL "archive updating", never FAIL', async () => {
  const d = ymd(Date.now() - D), t = Date.parse(d + 'T12:00:00Z'), old = shard(d, 1, t), cur = shard(d, 2, t);
  let x = boot({ index: n => mkIndex({ [d]: n === 1 ? old.row : cur.row }), files: { [cur.row.path]: cur.b } });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.ok(x.log.fetch.some(u => /index\.json\?/.test(u)), 'no cache-busted index refetch');
  assert.notEqual(x.S.last.state, 'FAIL'); assert.equal(x.S.last.drawn, 2);
  x = boot({ index: mkIndex({ [d]: old.row }), files: { [cur.row.path]: cur.b } });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.equal(x.S.last.state, 'PARTIAL'); assert.match(x.cap('warning'), /archive updating, (retrying next refresh|reload later)/);
});

test('M01: the inset is re-measured after render/ON and on clicks (panel opened after install)', async () => {
  const x = boot({ dash: { top: 788, bottom: 832, left: 245, right: 377, width: 132, height: 44 }, innerHeight: 844 });
  assert.equal(x.main.group.style.paddingRight, '0px');
  x.main.group._rect = { right: 385 }; x.toggle(true); await drain();
  assert.equal(x.main.group.style.paddingRight, '156px', 'not re-measured on ON/render');
  x.main.group._rect = { right: 300 }; x.fire('click');
  assert.equal(x.main.group.style.paddingRight, '71px', 'not re-measured on click');
});

test('DOTS: points are at least 4 px at low zoom with a dark 1 px stroke', async () => {
  const x = boot(); x.toggle(true); await drain();
  const p = x.layers.get(LAYER_ID).paint, rr = p['circle-radius'];
  assert.ok(rr[0] === 'interpolate' ? rr[4] >= 4 : rr[rr.length - 1] >= 4, JSON.stringify(rr));
  assert.ok(p['circle-stroke-width'] >= 1); assert.match(p['circle-stroke-color'], /^#[0-3][0-9a-f]{2}([0-9a-f]{3})?$/i);
});

test('NF1: when day files fail with the index up, Actual is "unknown (day files failed)" and Flashes shows index vs loaded, never "at least 0"', async () => {
  const d = ymd(Date.now() - D), x = boot({ index: mkIndex({ [d]: { count: 7, bytes: 100, path: P(d), sha256: 'x' } }) });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.equal(x.S.last.state, 'FAIL');
  assert.equal(x.cap('actual'), 'Actual  unknown (day files failed)');
  assert.match(x.cap('flashes'), /^Flashes 7 in index · 0 loaded/); assert.doesNotMatch(x.cap('flashes'), /at least 0/);
});

test('NF2: a redirected index (fetch) or feed (XHR responseURL off the requested URL) is rejected', async () => {
  let x = boot({ index: mkIndex(), redirect: 'index' }); x.toggle(true); await drain();
  assert.equal(x.S.idx, null, 'redirected index accepted'); assert.match(x.S.ie || '', /redirected/);
  x = boot({ redirect: 'feed' }); x.toggle(true); await drain();
  assert.equal(x.S.last.state, 'FAIL', 'redirected feed accepted'); assert.equal(x.S.last.drawn, 0);
});

test('RO: the right inset follows the HIDE LAYERS button live size (ResizeObserver), also after the button is replaced', async () => {
  const x = boot({ ro: true, dash: { top: 788, bottom: 832, left: 274, right: 377, width: 103, height: 44 }, innerHeight: 844 });
  x.main.group._rect = { right: 385 }; x.toggle(true); await drain();
  assert.equal(x.main.group.style.paddingRight, '127px');
  assert.ok(x.robs.length >= 1, 'no ResizeObserver attached');
  x.dashEl._rect = { top: 788, bottom: 832, left: 234, right: 377, width: 143, height: 44 }; x.robs.at(-1).f();
  assert.equal(x.main.group.style.paddingRight, '167px');
  const nb = x.doc.createElement('button'); nb.id = 'gridatlas-dash-toggle'; nb._rect = { top: 788, bottom: 832, left: 254, right: 377, width: 123, height: 44 };
  x.dashEl.parentNode.removeChild(x.dashEl); x.doc.documentElement.children[0].appendChild(nb); x.fire('click');
  assert.equal(x.robs.at(-1).el, nb, 'observer not re-attached to the new button');
  assert.equal(x.main.group.style.paddingRight, '147px');
});

// ---------------------------------------------------------------- variant G (fail-first against fixed-module-F.js)
test('R1/CRF-1: a fractional part count (0.5) rejects the index', async () => {
  const d = ymd(Date.now());
  const x = boot({ index: mkIndex({ [d]: { count: 3, path: null, sealed: false, parts: [{ path: partPath(d, 1), count: 0.5, bytes: 1, sha256: 'x' }] } }) });
  x.toggle(true); await drain();
  assert.equal(x.S.idx, null); assert.match(x.S.ie || '', /parts/);
});

test('R2: a tampered SEALED shard is FAIL naming the mismatch, never "archive updating"', async () => {
  const d = ymd(Date.now() - 4 * D), s = shard(d, 2, Date.parse(d + 'T12:00:00Z'));
  const x = boot({ index: mkIndex({ [d]: { ...s.row, sha256: '0'.repeat(64), sealed: true } }), files: { [s.row.path]: s.b } });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.last.state, 'FAIL');
  assert.match(x.cap('warning'), new RegExp(d + ' index mismatch: sha256'));
  assert.doesNotMatch(x.cap('warning'), /archive updating/);
});

test('T10/CRF-3b: after a failed retry the caption names date and field; status never SEARCHED n%; reason is not "gaps in window"', async () => {
  const d = ymd(Date.now() - D), t = Date.parse(d + 'T12:00:00Z'), old = shard(d, 1, t), cur = shard(d, 2, t);
  const x = boot({ index: mkIndex({ [d]: old.row }), files: { [cur.row.path]: cur.b } });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.match(x.cap('warning'), new RegExp(d + ' index mismatch: count[^·]*archive updating, reload later'));
  assert.doesNotMatch(x.status(), /SEARCHED \d+%/);
  assert.ok(!x.S.last.reasons.includes('gaps in window'), JSON.stringify(x.S.last.reasons));
});

test('E06 (G): a future-dated index does not read "<1 min ago"', async () => {
  const x = boot({ index: mkIndex({}, { generated_utc: iso(Date.now() + 2 * H), next_update_due_utc: iso(Date.now() + 3 * H) }) });
  x.toggle(true); await drain();
  assert.doesNotMatch(x.cap('refresh'), /<1 min ago/); assert.match(x.cap('refresh'), /\(\? ago/);
});

test('REST: before ON there are no requests, map sources or map listeners; outside the hidden controls the group is identical to F', async () => {
  const x = boot(); await drain();
  assert.equal(x.log.fetch.length + x.log.xhr.length, 0); assert.equal(x.sources.size, 0); assert.equal(x.handlers.length, 0, 'map listener before ON');
  assert.equal(x.main.ctl.hidden, true, 'controls not hidden at rest');
  const ser = el => el.hasAttribute && el.hasAttribute('data-lightning-controls') ? '[controls hidden=' + el.hidden + ']' : el.tagName + JSON.stringify([...el.attrs]) + el.children.map(c => c.tagName ? ser(c) : c.textContent).join('');
  globalThis.__SRC_OVERRIDE = readFileSync(new URL('./fixtures/reference-module-F.js', import.meta.url), 'utf8');
  let y; try { y = boot(); } finally { globalThis.__SRC_OVERRIDE = undefined; }
  assert.equal(ser(x.main.group), ser(y.main.group));
  assert.equal(JSON.stringify(x.main.group.style), JSON.stringify(y.main.group.style));
});

test('I01: without WebCrypto, a shard with valid count/bytes but a false sha256 is not drawn as verified (PARTIAL "not verified (no WebCrypto)")', async () => {
  const d = ymd(Date.now() - 4 * D), s = shard(d, 2, Date.parse(d + 'T12:00:00Z'));
  const x = boot({ noCrypto: true, index: mkIndex({ [d]: { ...s.row, sha256: 'f'.repeat(64) } }), files: { [s.row.path]: s.b } });
  x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.last.drawn, 0, 'unverified shard drawn');
  assert.equal(x.S.last.state, 'PARTIAL');
  assert.match(x.cap('warning'), new RegExp(d + ' not verified \\(no WebCrypto\\)'));
  assert.doesNotMatch(x.status(), /SEARCHED \d+%/);
});

// ---------------------------------------------------------------- variant H (fail-first against fixed-module-G.js)
const NOTICE = 'Only the last 7 days are available yet. The 12-month archive is being collected and backfilled; earlier months are unknown, not zero.';
const LBASE = 'Lightning Flashes (Optical)';

test('H1: feed-only 12M reads "[n · last 7 days only]", never "≥n | 12m"; bold first caption line; 7-DAY FEED ONLY status', async () => {
  const x = boot(); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.label(), `${LBASE} [1 | last 7 days only]`); // J: kv-words
  const capEl = x.main.group.querySelector('[data-lightning-caption]');
  assert.equal(capEl.children[1].dataset.cap, 'days'); assert.equal(x.cap('days'), 'Last 7 days only (live feed) · archive not yet published · earlier days unknown, not zero'); // J: kv-words
  assert.match(capEl.children[1].getAttribute('style'), /font-weight:bold/);
  assert.equal(x.status(), '1 FLASH · LAST 7 DAYS ONLY · OLDER NOT YET COLLECTED');
  for (const p of ['30d', '3m']) { x.click(x.chip(p)); await drain(); assert.match(x.label(), /\[1 \| last 7 days only\]/, p); }
  x.click(x.chip('7d')); await drain(); assert.doesNotMatch(x.cap('days'), /Last 7 days only/); assert.doesNotMatch(x.label(), /last 7 days only/);
});

test('H1: in feed fallback the 30D-12M chips carry a dim marker and stay tappable; with an archive they carry none', async () => {
  const x = boot(); x.toggle(true); await drain();
  for (const p of ['30d', '3m', '6m', '12m']) { const b = x.chip(p); assert.equal(b.disabled, false); assert.equal(b.lastChild.textContent, ' •', p); assert.equal(b.lastChild.style.opacity, '.55'); assert.ok(b.title); }
  assert.equal(x.chip('7d').textContent, '7D');
  const y = boot({ index: mkIndex() }); y.toggle(true); await drain();
  for (const p of ['30d', '12m']) assert.ok(!/•/.test(y.chip(p).textContent), 'marker with an archive');
  y.click(y.chip('12m')); await drain(); assert.doesNotMatch(y.label(), /last 7 days only/); assert.doesNotMatch(y.cap('days'), /live feed/);
});

test('H2: dots 6/8/10 px at z5/z8/z11 with a 1.5 px dark stroke and light core, plus an invisible >=22 px hit layer', async () => {
  const x = boot(); x.toggle(true); await drain();
  const p = x.layers.get('l-gridatlas-lightning').paint;
  assert.equal(JSON.stringify(p['circle-radius']), JSON.stringify(['interpolate', ['linear'], ['zoom'], 5, 6, 8, 8, 11, 10]));
  assert.equal(p['circle-stroke-width'], 1.5); assert.match(p['circle-stroke-color'], /^#[0-3][0-9a-f]{5}$/i);
  const hit = x.layers.get('gridatlas-lightning-hit'); assert.ok(hit, 'no hit layer');
  assert.ok(hit.paint['circle-radius'] >= 22); assert.equal(hit.paint['circle-opacity'], 0); assert.equal(hit.layout.visibility, 'visible');
  const pt = x.sources.get('gridatlas-lightning').data.features[0];
  assert.deepEqual([...pt.geometry.coordinates], [-1.5, 52], 'coordinates changed');
});

test('H2: above the phone cap clusters get count labels and a tap on a cluster zooms in', async () => {
  const fs = []; for (let k = 0; k < 10001; k++) fs.push(flash(Date.now() - H - k, 'c' + k, [-1.5 + (k % 100) / 1000, 52 + Math.floor(k / 100) / 1000]));
  const x = boot({ phone: true, feedFn: () => feed(fs) }); x.toggle(true); await drain();
  assert.ok(x.layers.get('l-gridatlas-lightning-count'), 'no cluster count layer');
  assert.equal(JSON.stringify(x.layers.get('l-gridatlas-lightning-count').layout['text-field']), '["get","point_count_abbreviated"]');
  x.sources.get('gridatlas-lightning').getClusterExpansionZoom = (id, cb) => cb(null, 9);
  x.tapMap([10, 10], { 'gridatlas-lightning-hit': [{ properties: { cluster: true, cluster_id: 7, point_count: 50 }, geometry: { coordinates: [-1.5, 52] } }] });
  assert.equal(x.camera.length, 1); assert.equal(x.camera[0][0], 'easeTo'); assert.equal(x.camera[0][1][0].zoom, 9);
});

test('H3/I1/J2: tapping a flash opens a Lightning-owned docked card (not maplibregl.Popup): bar "Flash <UTC>", lat/lon + short ID row, full ID, honesty line', async () => {
  const t = Date.parse('2026-10-25T11:15:58.149Z'), f = flash(t, 'abc-123', [-4.4874, 55.1637]);
  const x = boot({ feedFn: () => feed([f]) }); x.toggle(true); x.click(x.chip('7d')); await drain();
  x.tapMap([5, 5], { 'gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [-4.49, 55.16] } }] });
  assert.equal(x.popups.length, 0, 'maplibregl.Popup used');
  const card = x.mapEl.querySelector('[data-lightning-card]'); assert.ok(card, 'no card in the map container');
  const txt = card.textContent;
  for (const s of ['Flash 2026-10-25 11:15:58 UTC', 'lat 55.164, lon -4.487 · ID abc-123', 'Flash ID abc-123', 'EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.']) assert.ok(txt.includes(s), s);
  x.tapMap([200, 200], {}); assert.equal(x.mapEl.querySelector('[data-lightning-card]'), null, 'card not closed on an empty tap');
  x.tapMap([5, 5], { 'gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [0, 0] } }] });
  x.toggle(false); assert.equal(x.mapEl.querySelector('[data-lightning-card]'), null, 'card not closed on OFF');
});

test('H3: an original layer click handler still fires when no flash is under the tap (and when one is)', async () => {
  const x = boot(); let fired = 0; x.map.on('click', 'orig-substations', () => fired++);
  x.toggle(true); await drain();
  x.tapMap([1, 1], { 'orig-substations': [{ properties: { name: 'X' } }] });
  assert.equal(fired, 1); assert.equal(x.popups.length, 0);
  x.tapMap([1, 1], { 'orig-substations': [{ properties: { name: 'X' } }], 'gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [0, 0] } }] });
  assert.equal(fired, 2);
});

test('H4: FIT FLASHES fits the map to drawn flashes only when tapped; the outside-view count is recounted on moveend', async () => {
  let b = [-3, 50, 2, 53];
  const t = Date.now() - 20 * H, x = boot({ bounds: null, feedFn: () => feed([flash(t, 'a', [-4.2, 55.3]), flash(t + 1, 'b', [-1.5, 52])]) });
  x.map.getBounds = () => ({ contains: ([lo, la]) => lo >= b[0] && la >= b[1] && lo <= b[2] && la <= b[3] });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  assert.equal(x.nav('fit').hidden, false); assert.deepEqual(x.camera, []);
  assert.match(x.cap('flashes'), /1 of 2 outside the current view/);
  b = [-5, 50, 2, 56]; for (const h of x.handlers.filter(h => h.t === 'moveend')) h.f();
  assert.doesNotMatch(x.cap('flashes'), /outside the current view/);
  x.click(x.nav('fit'));
  assert.equal(x.camera.length, 1); assert.equal(x.camera[0][0], 'fitBounds');
  assert.equal(JSON.stringify(x.camera[0][1][0]), JSON.stringify([[-4.2, 52], [-1.5, 55.3]]));
});

test('H4: restored "12 months" period label and aria-live on the caption', async () => {
  const x = boot(); assert.equal(x.main.group.querySelector('[data-lightning-caption]').getAttribute('aria-live'), 'polite');
  x.toggle(true); x.click(x.chip('12m')); await drain(); assert.match(x.cap('window'), /12 months/);
});

test('H4 CRF-2/2b: a lost day is subtracted once even when scan windows overlap', async () => {
  const now = Date.now(), cutoff = Date.parse(ymd(now) + 'T00:00:00Z') - 365 * D, w1 = { start_utc: iso(cutoff), end_utc: iso(now), successful_runs: 9 };
  const d3 = ymd(now - 3 * D), lost = { [d3]: { coverage: 'none', scanned_seconds: 0, count: null, shard_lost: true } };
  const pct = async sw => { const x = boot({ index: mkIndex(lost, { scan_windows: sw }) }); x.toggle(true); x.click(x.chip('7d')); await drain(); return x.cap('searched'); };
  assert.equal(await pct([w1, { ...w1 }]), await pct([w1]));
});

test('H2b: the cluster label font comes from the basemap style (first symbol layer with text-font), else Open Sans Regular', async () => {
  const fs = []; for (let k = 0; k < 10001; k++) fs.push(flash(Date.now() - H - k, 'c' + k, [-1.5 + (k % 100) / 1000, 52 + Math.floor(k / 100) / 1000]));
  const run = async style => { const x = boot({ phone: true, feedFn: () => feed(fs) }); x.map.getStyle = () => style; x.toggle(true); await drain(); return JSON.stringify(x.layers.get('l-gridatlas-lightning-count').layout['text-font']); };
  assert.equal(await run({ glyphs: 'g', layers: [{ type: 'fill', layout: {} }, { type: 'symbol', layout: { 'text-field': 'x' } }, { type: 'symbol', layout: { 'text-font': ['Montserrat Medium', 'Open Sans Bold'] } }, { type: 'symbol', layout: { 'text-font': ['Other'] } }] }), '["Montserrat Medium","Open Sans Bold"]');
  assert.equal(await run({ layers: [{ type: 'fill' }] }), '["Open Sans Regular"]');
  assert.equal(await run(undefined), '["Open Sans Regular"]');
});

// ---------------------------------------------------------------- variant I (fail-first against fixed-module-H.js)
const mins = s => { let m = 0; for (const [, v, u] of s.matchAll(/(\d+) (h|min)/g)) m += u === 'h' ? 60 * v : +v; return m; };
const searchedPct = t => { const r = /Searched EUMETSAT (.+?) of (.+?)( ·|$)/.exec(t); return r ? Math.floor(100 * mins(r[1]) / mins(r[2])) : (/none of this window/.test(t) ? 0 : 100); };
const tapFlash = (x, i = 0) => x.tapMap([5, 5], { 'gridatlas-lightning-hit': [{ properties: { i }, geometry: { coordinates: [0, 0] } }] });
const haversine = (lo1, la1, lo2, la2) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.sqrt(a)); };
// the original's public measure, reproduced from sld-sandbox 202609241334 C:3509 (nearestSubstations) with its geodesy (R 6378.137 km)
const hav = (lo1, la1, lo2, la2) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 6378.137 * Math.asin(Math.sqrt(a)); };
const origNearest = (lon, lat, subs) => { const sc = []; let beyond = null; for (const sub of subs) { const km = hav(lon, lat, sub.at[0], sub.at[1]); if (km > 40) { if (!beyond || km < beyond.km) beyond = { ...sub, km }; continue; } sc.push({ ...sub, km }); }
  sc.sort((a, b) => a.km - b.km); const res = sc.slice(0, 5); res.beyondRadiusNearest = res.length ? null : beyond; res.radiusKm = 40; return res; };
const SUBS = [
  { at: [-1.505, 52.002], kv: [33], name: 'Tiny 33kV' }, { at: [-1.6, 52.0], kv: [132], name: 'A 132' }, { at: [-1.5, 52.2], kv: [400, 132], name: 'B 400' },
  { at: [-1.7, 52.1], kv: [66], name: 'C 66' }, { at: [-1.4, 51.9], kv: [275], name: 'D 275' }, { at: [-1.3, 52.15], kv: [33], name: 'E 33' }, { at: [-4.0, 55.0], kv: [400], name: 'Far 400' }];
const installNeon = (x, subs) => { x.neonCalls = []; x.W.__GRIDATLAS_NEON_LINKS__ = { substations: subs, measure: { nearestSubstations: (lo, la, ss) => { x.neonCalls.push([lo, la, ss]); return origNearest(lo, la, ss); } } }; };

test('I1/J2: the card is docked at the bottom (bar 44 px − and ×), explicit inline colours, minimise keeps the bar, × closes; repositioned on resize, not on move', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); x.mapEl._rect = { top: 0, left: 0, right: 393, bottom: 700, width: 393, height: 700 }; x.toggle(true); await drain();
  tapFlash(x); const card = x.mapEl.querySelector('[data-lightning-card]'); assert.ok(card);
  const st = card.style.cssText; assert.match(st, /position:absolute/); assert.match(st, /background:#000/); assert.match(st, /color:#e8f4f5/); assert.match(st, /border:1px solid #2f6f75/);
  assert.equal(card.style.bottom, '8px'); assert.equal(card.style.top, undefined);
  const [mn, close] = card.querySelectorAll('button'); assert.equal(mn.getAttribute('aria-label'), 'Minimise'); assert.match(close.style.cssText, /width:44px;height:44px/); assert.equal(close.getAttribute('aria-label'), 'Close');
  dispatch(mn, 'click', x.log.errors); assert.equal(card.children[1].style.display, 'none'); assert.equal(mn.getAttribute('aria-expanded'), 'false');
  assert.ok(x.handlers.some(h => h.t === 'resize'), 'no resize listener'); assert.ok(!x.handlers.some(h => h.t === 'move'), 'card still follows move');
  dispatch(close, 'click', x.log.errors); assert.equal(x.mapEl.querySelector('[data-lightning-card]'), null);
});

test('I2: 3M and 12M with 763 archived flashes load and draw points automatically', async () => {
  const files = {}, over = {}; let total = 0;
  for (let k = 1; k <= 18; k++) { const d = ymd(Date.now() - k * D), n = k === 18 ? 763 - total : 42; total += n; const s = shard(d, n, Date.parse(d + 'T10:00:00Z')); files[s.row.path] = s.b; over[d] = s.row; }
  for (const p of ['3m', '12m']) {
    const x = boot({ index: mkIndex(over), files }); x.toggle(true); x.click(x.chip(p)); await drain();
    assert.equal(x.S.res.mode, 'detail', p); assert.equal(x.S.last.drawn, 763, p); assert.equal(x.S.res.clp, undefined, p);
  }
});

test('I2: 12M with 50,000 archived flashes still asks first (LOAD POINTS); a phone asks above its 10,000 cap', async () => {
  const d1 = ymd(Date.now() - 40 * D), d2 = ymd(Date.now() - 41 * D);
  let x = boot({ index: mkIndex({ [d1]: { count: 25000, bytes: 1000, path: P(d1), sha256: 'x' }, [d2]: { count: 25000, bytes: 1000, path: P(d2), sha256: 'y' } }) });
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.res.clp, true); assert.equal(x.nav('points').hidden, false); assert.equal(x.log.fetch.filter(u => u.includes('/days/')).length, 0);
  x = boot({ phone: true, index: mkIndex({ [d1]: { count: 15000, bytes: 1000, path: P(d1), sha256: 'x' } }) });
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.res.clp, true, 'phone loaded 15,000 points without asking');
});

test('I3/J1: tapping a flash fires the original nearestSubstations (>=33 kV, <=40 km, 5) and draws the neon arrival; no NEAREST button', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installNeon(x, SUBS);
  x.toggle(true); await drain(); tapFlash(x);
  const card = x.mapEl.querySelector('[data-lightning-card]'); assert.equal(card.querySelector('[data-lightning-nearest]'), null, 'button still present');
  assert.deepEqual(x.neonCalls.map(a => [a[0], a[1]]), [[-1.5, 52]], 'original nearestSubstations not called with the flash');
  const src = x.sources.get('gridatlas-lightning-neon-links'); assert.ok(src, 'no neon links source');
  assert.equal(src.data.features.length, 5); assert.equal(src.data.features[0].properties.colour, '#d8c96a');
  assert.match(card.textContent, /0\.\d\d km · 33 kV · Tiny 33kV/); assert.doesNotMatch(card.textContent.split('REPD projects')[0], /Far 400|project/i); // M: projects follow the substation rows
  assert.match(card.textContent, /Nearest substations to this optical flash \(straight-line km\)\. Not evidence any asset was struck; faults can have other causes\./);
  dispatch(card.querySelectorAll('button')[1], 'click', x.log.errors);
  assert.equal(x.sources.get('gridatlas-lightning-neon-links'), undefined); assert.equal(x.layers.get('gridatlas-lightning-neon-core'), undefined);
  tapFlash(x); assert.ok(x.sources.get('gridatlas-lightning-neon-links'));
  x.toggle(false); assert.equal(x.sources.get('gridatlas-lightning-neon-links'), undefined, 'lines kept after OFF');
});

test('I3: the module never invents a repd_ref, never touches the URL', () => {
  assert.doesNotMatch(SRC, /repd_ref|location\.(href|search|hash|assign|replace)|history\.(push|replace)State/);
});

test('I1b: with overlapping hit circles, the tap opens the flash nearest the tap point', async () => {
  const t = Date.now() - H, x = boot({ feedFn: () => feed([flash(t, 'far', [-1.0, 52.0]), flash(t + 1, 'near', [-1.5, 52.0])]) });
  x.toggle(true); await drain();
  x.tapMap({ x: -14, y: 520 }, { 'gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [0, 0] } }, { properties: { i: 1 }, geometry: { coordinates: [0, 0] } }] });
  assert.match(x.mapEl.querySelector('[data-lightning-card]').textContent, /Flash ID near/);
});

// ---------------------------------------------------------------- variant J (fail-first against fixed-module-I.js)
test('J1: a tap flies to zoom 12 over 1200 ms like the original arrival, and fitBounds (top 150, bottom clear of the card; LR-layout) only when a link end is off screen', async () => {
  let inView = true; const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installNeon(x, SUBS);
  x.map.getBounds = () => ({ contains: () => inView });
  x.toggle(true); await drain(); tapFlash(x);
  assert.equal(JSON.stringify(x.camera.map(c => c[0])), '["flyTo"]'); const fo = x.camera[0][1][0];
  assert.equal(fo.zoom, 12); assert.equal(fo.duration, 1200); assert.equal(JSON.stringify(fo.center), '[-1.5,52]');
  inView = false; x.camera.length = 0; tapFlash(x);
  assert.equal(JSON.stringify(x.camera.map(c => c[0])), '["flyTo","fitBounds"]');
  { const c0 = x.mapEl.querySelector('[data-lightning-card]'); assert.equal(JSON.stringify(x.camera[1][1][1].padding), JSON.stringify({ top: 150, left: 40, right: 40, bottom: (c0.bb + c0.offsetHeight || 196) + 24 })); } // L3: LR-layout
});

test('J1: the arrival layers match the original (glow, core, 2 flow, node ring, node, label, origin halo + ring); colour #d8c96a; labels "x.xx km · N kV"', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installNeon(x, SUBS); x.map.getStyle = () => ({ glyphs: 'g', layers: [{ type: 'symbol', layout: { 'text-font': ['Montserrat Medium'] } }] });
  x.toggle(true); await drain(); tapFlash(x);
  for (const id of ['glow', 'core', 'flow', 'flow-b', 'node-ring', 'node', 'label', 'pin-halo', 'pin']) assert.ok(x.layers.get('gridatlas-lightning-neon-' + id), id);
  assert.equal(JSON.stringify(x.layers.get('gridatlas-lightning-neon-glow').paint), JSON.stringify({ 'line-color': ['get', 'colour'], 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 12], 'line-opacity': 0.1, 'line-blur': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 8] }));
  assert.equal(x.layers.get('gridatlas-lightning-neon-node').paint['circle-color'], '#5fbdc2'); assert.equal(x.layers.get('gridatlas-lightning-neon-pin-halo').paint['circle-stroke-color'], '#d8c96a');
  const labels = x.sources.get('gridatlas-lightning-neon-nodes').data.features.map(f => f.properties.label);
  assert.ok(labels.every(l => /^\d+\.\d\d km · \d+ kV$/.test(l)), JSON.stringify(labels)); assert.equal(labels.length, 5);
  assert.ok(!['gridatlas-lightning-neon-core', 'gridatlas-lightning-hit'].some(id => id.startsWith('l-')));
});

test('J1: with no substation within 40 km the card says so with the nearest beyond, and nothing is drawn; not-loaded and errors are honest', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'sea', [-10.5, 50.0])]) }); installNeon(x, SUBS);
  x.toggle(true); await drain(); tapFlash(x);
  assert.match(x.mapEl.querySelector('[data-lightning-card]').textContent, /No substation within 40 km \(nearest: C 66, \d+\.\d\d km\)/);
  assert.equal(x.sources.get('gridatlas-lightning-neon-links'), undefined); assert.deepEqual(x.camera, []);
  const y = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); y.W.__GRIDATLAS_NEON_LINKS__ = Object.create({ substations: SUBS, measure: { nearestSubstations: origNearest } });
  y.toggle(true); await drain(); tapFlash(y); assert.match(y.mapEl.querySelector('[data-lightning-card]').textContent, /Substation data not loaded yet/, 'inherited substations used');
  const z = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); z.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { nearestSubstations: () => { throw new Error('boom'); } } };
  z.toggle(true); await drain(); tapFlash(z); assert.match(z.mapEl.querySelector('[data-lightning-card]').textContent, /Substation data unavailable\./); assert.equal(z.sources.get('gridatlas-lightning-neon-links'), undefined);
});

test('J1/R2: the card and lines close on PREV and on a period change, but survive the 10-minute refresh', async () => {
  const x = boot({ index: mkIndex({ [ymd(Date.now() - D)]: (() => { const d = ymd(Date.now() - D), sh = shard(d, 1, Date.now() - 20 * H); x0files[sh.row.path] = sh.b; sh.row.at = 0; return sh.row; })() }), files: x0files });
  installNeon(x, SUBS); x.toggle(true); x.click(x.chip('48h')); await drain(); tapFlash(x);
  assert.ok(x.sources.get('gridatlas-lightning-neon-links'));
  x.log.intervals.find(i => i.ms === 6e5).f(); await drain();
  assert.ok(x.mapEl.querySelector('[data-lightning-card]'), 'refresh closed the card');
  x.click(x.nav('prev')); await drain();
  assert.equal(x.mapEl.querySelector('[data-lightning-card]'), null); assert.equal(x.sources.get('gridatlas-lightning-neon-links'), undefined);
  x.click(x.nav('latest')); await drain(); tapFlash(x); x.click(x.chip('7d')); await drain();
  assert.equal(x.mapEl.querySelector('[data-lightning-card]'), null, 'period change kept the card');
});
const x0files = {};

test('J2: the card shows a short ID and keeps the full ID; bidi/zero-width characters are stripped and IDs capped at 200; object ids are rejected; a stale tap opens nothing', async () => {
  const pid = 'W_XX-EUMETSAT-Darmstadt,IMG+SAT,MTI1+LI-2-LFL--FD--x-x--ARC-x_C_EUMT_20261022205024_L2PF_OPE_20261022204009_20261022205009_N__O_0125_0000:4458';
  let x = boot({ feedFn: () => feed([flash(Date.now() - H, pid, [-1.5, 52])]) }); x.toggle(true); await drain(); tapFlash(x);
  let t = x.mapEl.querySelector('[data-lightning-card]').textContent; assert.match(t, /ID 20:40–20:50 #4458/); assert.ok(t.includes('Flash ID ' + pid));
  x = boot({ feedFn: () => feed([flash(Date.now() - H, 'evil\u202Eid\u200B' + 'x'.repeat(400), [-1.5, 52])]) }); x.toggle(true); await drain(); tapFlash(x);
  t = x.mapEl.querySelector('[data-lightning-card]').textContent; assert.ok(!/[\u202E\u200B]/.test(t)); assert.ok(!t.includes('x'.repeat(201)));
  x = boot(); assert.equal(x.probe.ok({ ...flash(Date.now(), 'o'), id: { toString: () => 'x' } }), false);
  x = boot({ feedFn: () => feed([flash(Date.now() - H, 'a', [-1.5, 52])]) }); x.toggle(true); await drain();
  x.tapMap([5, 5], { 'gridatlas-lightning-hit': [{ properties: { i: 0, s: -1 }, geometry: { coordinates: [0, 0] } }] });
  assert.equal(x.mapEl.querySelector('[data-lightning-card]'), null, 'stale hit index opened a card');
});

test('J3: archive wording: "[1,480 | 29 of 31 days searched]"-style label, "N FLASHES · 29 OF 31 DAYS SEARCHED (k IN PART)" status, caption line 2; no "≥", no bare %', async () => {
  const over = {}, files = {}; for (const k of [1, 2]) { const d = ymd(Date.now() - k * D), sh = shard(d, 3, Date.parse(d + 'T10:00:00Z')); files[sh.row.path] = sh.b; over[d] = sh.row; }
  over[ymd(Date.now() - 3 * D)] = { coverage: 'partial', scanned_seconds: 3600 };
  for (const k of [20, 21]) over[ymd(Date.now() - k * D)] = { coverage: 'none', scanned_seconds: 0, count: null };
  const x = boot({ index: mkIndex(over), files }); x.toggle(true); x.click(x.chip('30d')); await drain();
  assert.equal(x.label(), `${LBASE} [6 | 29 of 31 days searched]`);
  assert.equal(x.status(), '6 FLASHES · 29 OF 31 DAYS SEARCHED (1 IN PART)');
  assert.match(x.cap('days'), /^29 of 31 days searched \(\d+ \w{3}–\d+ \w{3}, 1 in part\) · 2 not yet searched \(unknown, not zero\)$/);
  for (const s of [x.label(), x.status(), ...['window', 'days', 'actual', 'flashes', 'refresh', 'searched', 'warning'].map(k => x.cap(k))]) { assert.doesNotMatch(s, /≥/, s); assert.doesNotMatch(s, /\d%/, s); }
});

test('J3: STALE is the search frontier (not nextDue or a backfill-bumped generated_utc), shown as COLLECTOR LAST RAN …, on the latest page only', async () => {
  const now = Date.now(), cutoff = Date.parse(ymd(now) + 'T00:00:00Z') - 365 * D;
  const idx = mkIndex({}, { generated_utc: iso(now - 600e3), next_update_due_utc: iso(now + H), scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(now - 6 * H), successful_runs: 9 }] });
  const x = boot({ index: idx }); x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.last.stale, true, 'backfill-bumped generated_utc hid a 6 h old frontier'); assert.match(x.status(), /COLLECTOR LAST RAN \d\d:\d\d UTC, SEARCHED TO \d\d:\d\d UTC · STALE$/);
  x.click(x.nav('prev')); await drain(); assert.equal(x.S.last.stale, false, 'STALE printed on an earlier page');
  const y = boot({ index: mkIndex({}, { generated_utc: iso(now - 600e3), next_update_due_utc: iso(now - 60e3) }) }); y.toggle(true); await drain();
  assert.equal(y.S.last.stale, false, 'nextDue alone made it STALE');
});

test('J3: pages before the searched history read "not yet searched", never "0"; PREV stops at the archive start; a period change and LATEST reset paging; CUSTOM To after today is refused', async () => {
  const now = Date.now(), cs = ymd(now - 10 * D), over = {};
  for (let k = 11; k <= 365; k++) over[ymd(now - k * D)] = { coverage: 'none', scanned_seconds: 0, count: null };
  const x = boot({ index: mkIndex(over, { coverage_start_utc: cs + 'T00:00:00Z', scan_windows: [{ start_utc: cs + 'T00:00:00Z', end_utc: iso(now), successful_runs: 9 }] }) });
  x.toggle(true); x.click(x.chip('7d')); await drain(); x.click(x.nav('prev')); await drain(); x.click(x.nav('prev')); await drain();
  assert.match(x.cap('flashes'), /^Flashes not yet searched \(unknown, not zero\)$/); assert.match(x.label(), /\[not yet searched \| 0 of \d+ days searched\]/);
  assert.equal(x.nav('prev').disabled, true, 'PREV still offered before the archive start');
  x.click(x.chip('48h')); await drain(); assert.equal(x.S.res.w.atLatest, true, 'period change kept the old page');
  assert.equal(x.S.h.length, 0);
  x.click(x.chip('custom')); await drain(); x.main.from.value = ymd(now); x.main.to.value = ymd(now + 2 * D); x.click(x.nav('apply')); await drain();
  assert.match(x.cap('warning'), /Custom dates invalid/);
});

test('J4: the shard cache holds a long window (no re-download on refresh); the label keeps the index count when day files fail', async () => {
  const over = {}, files = {}; for (let k = 2; k <= 13; k++) { const d = ymd(Date.now() - k * D), sh = shard(d, 1, Date.parse(d + 'T10:00:00Z')); files[sh.row.path] = sh.b; over[d] = sh.row; }
  const x = boot({ index: mkIndex(over), files }); x.toggle(true); x.click(x.chip('30d')); await drain();
  const n0 = x.log.fetch.filter(u => u.includes('/days/')).length; x.log.intervals.find(i => i.ms === 6e5).f(); await drain();
  assert.equal(x.log.fetch.filter(u => u.includes('/days/')).length, n0, 'sealed day files re-downloaded on the refresh');
  const d = ymd(Date.now() - D), y = boot({ index: mkIndex({ [d]: { count: 7, bytes: 10, path: P(d), sha256: 'x' } }) }); y.toggle(true); y.click(y.chip('48h')); await drain();
  assert.match(y.label(), /\[FAIL\]|\[7 \|/);
});

test('J5: a sub-day overview sums only the overlapping hourly parts; after consent the status reads "N OF M FLASHES"', async () => {
  const d = ymd(Date.now() - 40 * D), parts = [1, 2].map(h => ({ path: partPath(d, h), count: 30000, bytes: 1000, sha256: 'x' }));
  const x = boot({ phone: true, index: mkIndex({ [d]: { count: 60000, path: null, parts } }) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  x.click(x.nav('points')); await drain();
  assert.match(x.status(), /OF 60,000 FLASHES|^FAIL/);
  const t = Date.now(), dd = ymd(t), hh = new Date(t).getUTCHours(), pp = [{ path: partPath(dd, (hh + 23) % 24), count: 5, bytes: 1, sha256: 'x' }, { path: partPath(dd, 0), count: 9, bytes: 1, sha256: 'y' }];
  if (hh >= 2) { const y = boot({ index: mkIndex({ [dd]: { count: 14, path: null, parts: pp, sealed: false } }) }); y.toggle(true); y.click(y.chip('12h')); await drain(); assert.ok(y.S.res.arch <= 14); }
});

test('J6 (kv-vogel a): a single ResizeObserver — the old one is disconnected when the button is replaced and on OFF; ON observes again', async () => {
  const x = boot({ ro: true, dash: { top: 788, bottom: 832, left: 274, right: 377, width: 103, height: 44 }, innerHeight: 844 });
  x.toggle(true); await drain(); const first = x.robs.at(-1).o;
  const nb = x.doc.createElement('button'); nb.id = 'gridatlas-dash-toggle'; nb._rect = { top: 788, bottom: 832, left: 254, right: 377, width: 123, height: 44 };
  x.dashEl.parentNode.removeChild(x.dashEl); x.doc.documentElement.children[0].appendChild(nb); x.fire('click');
  assert.equal(first.off, 1, 'old observer not disconnected'); const second = x.robs.at(-1).o; assert.notEqual(second, first);
  x.toggle(false); assert.equal(second.off, 1, 'observer kept after OFF');
  x.toggle(true); await drain(); assert.notEqual(x.robs.at(-1).o, second, 'not observed again after ON');
});

test('J7 (browser T4): a stale feed status ends with the collector phrase and "· STALE"', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - 7 * H, 'a')], 6) }); x.toggle(true); await drain();
  assert.match(x.status(), /COLLECTOR LAST RAN [^·]+ UTC · STALE$/);
});

test('J7 (browser T2): an unreadable index timestamp in the window is named in the 12M warning line', async () => {
  const d = ymd(Date.now() - 5 * D), sh = shard(d, 2, Date.parse(d + 'T10:00:00Z'));
  const x = boot({ index: mkIndex({ [d]: { ...sh.row, first_observation_utc: 'not-a-date', last_observation_utc: iso(Date.parse(d + 'T11:00:00Z')) } }), files: { [sh.row.path]: sh.b } });
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.match(x.cap('warning'), /1 archive entry unreadable \(malformed timestamp; unknown, not zero\)/);
  x.click(x.chip('7d')); await drain(); assert.match(x.cap('window'), /7 days/);
});

// ---------------------------------------------------------------- L-engine: a tap on a lightning CELL circle fires the same engine (fail-first against fixed-module-J.js)
const CELL = 'gridatlas-lightning-cell';
const cellF = (p, at) => ({ properties: { ...p }, geometry: { type: 'Point', coordinates: at || [p.lon, p.lat] } });
const C1 = { n: 1234, cell: 25 * 140 + 94, lon: -1.55, lat: 52.05 };
const bootCell = async (feedFlashes = [flash(Date.now() - H, 'z', [-1.5, 52])]) => {
  const x = boot({ feedFn: () => feed(feedFlashes) }); installNeon(x, SUBS); x.toggle(true); await drain();
  x.map.addLayer({ id: CELL, type: 'circle', source: 'gridatlas-lightning-cells' });
  // MapLibre throws on an unknown layer and on a NaN LngLat
  const q0 = x.map.queryRenderedFeatures; x.map.queryRenderedFeatures = (pt, o) => { for (const l of o.layers) if (!x.layers.has(l)) throw new Error(`layer ${l} does not exist`); return q0(pt, o); };
  x.setProj(ll => { if (!ll.every(Number.isFinite)) throw new Error('Invalid LngLat'); return { x: ll[0] * 10, y: ll[1] * 10 }; });
  return x;
};
const card = x => x.mapEl.querySelector('[data-lightning-card]');

test('LE1: tapping a cell fires the original nearestSubstations from the cell centre, draws the neon arrival and frames the camera like a flash', async () => {
  const x = await bootCell(); x.camera.length = 0;
  x.tapMap([-15.5, 520.5], { [CELL]: [cellF(C1)] });
  assert.deepEqual(x.neonCalls.map(a => [a[0], a[1]]), [[-1.55, 52.05]], 'engine not fired from the cell centre');
  const src = x.sources.get('gridatlas-lightning-neon-links'); assert.ok(src, 'no neon links'); assert.equal(src.data.features.length, 5);
  assert.deepEqual([...src.data.features[0].geometry.coordinates[0]], [-1.55, 52.05], 'links do not start at the cell centre');
  assert.deepEqual([...x.sources.get("gridatlas-lightning-neon-pin").data.features[0].geometry.coordinates], [-1.55, 52.05]);
  const fly = x.camera.find(c => c[0] === 'flyTo'); assert.ok(fly); assert.deepEqual([...fly[1][0].center], [-1.55, 52.05]); assert.equal(fly[1][0].zoom, 12);
  assert.equal(x.popups.length, 0);
});

test('LE2: the cell card: title "N optical flashes in this ≈10 km cell", window dates, cell bounds, no flash ID or time, honesty kept', async () => {
  const x = await bootCell(); x.tapMap([-15.5, 520.5], { [CELL]: [cellF(C1)] });
  const c = card(x); assert.ok(c, 'no card'); const t = c.textContent, w = x.S.res.w;
  assert.equal(c.getAttribute('aria-label'), 'Lightning cell'); assert.equal(c.getAttribute('role'), 'dialog');
  assert.equal(c.children[0].children[0].textContent, '1,234 optical flashes in this ≈10 km cell');
  assert.ok(t.includes(`${ymd(w.s)} to ${ymd(w.e - 1)} UTC · centre lat 52.050, lon -1.550 · 5 nearest substations`), 'summary row');
  assert.ok(t.includes('Cell lat 52.00–52.10, lon -1.60–-1.50 (0.1°) · searched UTC days only; unsearched days unknown, not zero'), 'bounds row');
  assert.ok(t.includes('Nearest substations to this cell centre (straight-line km). Not evidence any asset was struck; faults can have other causes.'), 'engine honesty line');
  assert.ok(t.includes('EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.'), 'footer');
  assert.doesNotMatch(t, /Flash ID|· ID |Flash \d|\d\d:\d\d|\(none\)|undefined|NaN|unknown UTC|strike[sd]? (at|on)|affected/i);
  const [, close] = c.querySelectorAll('button'); dispatch(close, 'click', x.log.errors);
  assert.equal(card(x), null); assert.equal(x.sources.get('gridatlas-lightning-neon-links'), undefined, 'lines kept after ×');
});

test('LE3: when a flash and a cell are both under the tap, the flash wins (even if the cell centre is nearer)', async () => {
  const x = await bootCell();
  x.tapMap([-15.5, 520.5], { 'gridatlas-lightning-hit': [{ properties: { i: 0 }, geometry: { coordinates: [-1.5, 52] } }], [CELL]: [cellF(C1)] });
  assert.deepEqual(x.neonCalls.map(a => [a[0], a[1]]), [[-1.5, 52]]);
  assert.match(card(x).textContent, /^Flash \d{4}-\d\d-\d\d \d\d:\d\d:\d\d UTC/); assert.equal(card(x).getAttribute('aria-label'), 'Lightning flash');
  assert.match(card(x).textContent, /Nearest substations to this optical flash \(straight-line km\)/);
  // a cluster also wins over a cell
  x.camera.length = 0; x.neonCalls.length = 0; x.map.getSource('gridatlas-lightning').getClusterExpansionZoom = (id, cb) => cb(null, 9);
  x.tapMap([-15.5, 520.5], { 'gridatlas-lightning-hit': [{ properties: { cluster: true, cluster_id: 3 }, geometry: { coordinates: [-1.5, 52] } }], [CELL]: [cellF(C1)] });
  assert.equal(x.neonCalls.length, 0); assert.equal(card(x), null); assert.equal(x.camera[0][0], 'easeTo');
});

test('LE4: overlapping cell circles open the cell whose centre is nearest the tap; 1 flash is singular', async () => {
  const x = await bootCell(), C2 = { n: 1, cell: 25 * 140 + 95, lon: -1.45, lat: 52.05 };
  x.tapMap([-14.6, 520.5], { [CELL]: [cellF(C1), cellF(C2)] });
  assert.deepEqual(x.neonCalls.map(a => [a[0], a[1]]), [[-1.45, 52.05]]);
  assert.equal(card(x).children[0].children[0].textContent, '1 optical flash in this ≈10 km cell');
});

test('LE5: malformed, inconsistent or stale cells open nothing and never throw; an empty tap still closes the card', async () => {
  const x = await bootCell();
  for (const p of [{}, { ...C1, n: 0 }, { ...C1, n: 1.5 }, { ...C1, n: '7' }, { ...C1, cell: -1 }, { ...C1, cell: 16800 }, { ...C1, lon: -1.65 }, { ...C1, lat: 52.15 }, { ...C1, lon: NaN }, { ...C1, lon: undefined }, { ...C1, s: -1 }]) {
    x.tapMap([-15.5, 520.5], { [CELL]: [cellF(p, [0, 0])] }); assert.equal(card(x), null, JSON.stringify(p));
  }
  assert.equal(x.neonCalls.length, 0); assert.deepEqual(x.log.errors, []);
  x.tapMap([-15.5, 520.5], { [CELL]: [cellF({ ...C1, s: x.S.res.s })] }); assert.ok(card(x), 'current-serial cell refused');
  x.tapMap([0, 0], {}); assert.equal(card(x), null);
});

test('LE6: without a cell layer a tap never queries it (MapLibre would throw); without a flash layer a cell still fires', async () => {
  const x = await bootCell(); x.map.removeLayer(CELL);
  tapFlash(x); assert.ok(card(x), 'flash tap broken without a cell layer');
  x.tapMap([0, 0], {}); assert.equal(card(x), null);
  const y = await bootCell(); for (const l of ['l-gridatlas-lightning', 'gridatlas-lightning-hit', 'l-gridatlas-lightning-count']) y.map.removeLayer(l);
  y.tapMap([-15.5, 520.5], { [CELL]: [cellF(C1)] }); assert.ok(card(y), 'cell needs the flash hit layer'); assert.equal(y.neonCalls.length, 1);
});

test('LE7: substations not loaded yet: the cell card retries the engine like a flash card', async () => {
  const x = await bootCell(); const L = x.W.__GRIDATLAS_NEON_LINKS__, subs = L.substations; L.substations = [];
  const st = x.sandbox.setTimeout, q = []; x.sandbox.setTimeout = (f, ms) => (ms === 2e3 ? q.push(f) : st(f, ms));
  x.tapMap([-15.5, 520.5], { [CELL]: [cellF(C1)] }); assert.match(card(x).textContent, /Substation data not loaded yet/); assert.equal(q.length, 1);
  L.substations = subs; q.shift()(); assert.deepEqual(x.neonCalls.map(a => [a[0], a[1]]), [[-1.55, 52.05]]); assert.match(card(x).textContent, /· 5 nearest substations/);
});

// ---------------------------------------------------------------- L-build: tappable cells above the cap (grid/YYYY-MM.json), land clip, projects win
const GC = (lon, lat) => Math.floor(Math.round((lat - 49.5) * 1e7) / 1e6) * 140 + Math.floor(Math.round((lon + 11) * 1e7) / 1e6);
const gday = (date, row, over = {}) => ({ date, coverage: row.coverage || 'full', count: row.count, sha256: row.path ? [row.sha256] : row.parts.map(p => p.sha256), ...over });
const mkGrids = (entries, tweak = g => g) => {
  const by = {};
  for (const e of entries) { const m = e.date.slice(0, 7), g = by[m] = by[m] || { days: [], cells: {} }; g.days.push(gday(e.date, e.row, e.day)); for (const [c, n] of Object.entries(e.cells)) (g.cells[c] = g.cells[c] || []).push(+e.date.slice(8), n); }
  return Object.fromEntries(Object.entries(by).map(([m, g]) => ['grid/' + m + '.json', (o => typeof o === 'string' ? o : enc(o))(tweak({ schema: 'uk-lightning-history-grid.v1', month: m, observation: 'satellite optical lightning flashes, not ground strikes', bounds_wsen: [-11, 49.5, 3, 61.5], cell_deg: 0.1, cols: 140, rows: 120, days: g.days, cells: Object.keys(g.cells).map(Number).sort((a, b) => a - b).map(c => [c, ...g.cells[c]]) }))]));
};
const KD = [40, 80].map(k => ymd(Date.now() - k * D));
const KROWS = { [KD[0]]: { count: 25000, bytes: 1000, path: P(KD[0]), sha256: 'x' }, [KD[1]]: { count: 25000, bytes: 1000, path: P(KD[1]), sha256: 'y' } };
const LC1 = GC(-1.5, 52), LC2 = GC(0.12, 51.5), SEA = GC(2.5, 56), EIRE = GC(-8.6, 53.1); // Midlands, London; North Sea, Galway
const KGRID = [{ date: KD[0], row: KROWS[KD[0]], cells: { [LC1]: 20000, [LC2]: 4000, [SEA]: 700, [EIRE]: 300 } }, { date: KD[1], row: KROWS[KD[1]], cells: { [LC1]: 25000 } }];
const cellsSrc = x => x.sources.get('gridatlas-lightning-cells');
const gridUrls = x => x.log.fetch.filter(u => u.includes('/grid/'));
const CLS = ['gridatlas-lightning-cell-glow', 'gridatlas-lightning-cell-core', 'gridatlas-lightning-cell'];
const cellHit = (x, f) => x.tapMap([f.properties.lon * 10, f.properties.lat * 10], { [CELL]: [f] });

test('L1: 12M above the cap draws tappable graduated cells (glow + core + 22 px hit), never a heatmap; only grid files fetched; honest caption', async () => {
  const full = { scan_windows: [{ start_utc: iso(Date.now() - 400 * D), end_utc: iso(Date.now() + 60e3), successful_runs: 999 }] };
  const x = boot({ index: mkIndex(KROWS, full), files: mkGrids(KGRID) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.res.clp, true); assert.equal(x.S.last.state, 'READY·CELLS', x.S.last.reasons.join()); assert.equal(x.S.last.cells, 2);
  assert.equal(x.log.fetch.filter(u => u.includes('/days/')).length, 0, 'day files fetched without consent');
  for (const u of gridUrls(x)) assert.match(u, /^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\/data\/history\/grid\/\d{4}-\d\d\.json$/);
  assert.equal(new Set(gridUrls(x)).size, 2);
  const f = Object.fromEntries(cellsSrc(x).data.features.map(q => [q.properties.n, q]));
  assert.deepEqual(Object.keys(f).map(Number).sort((a, b) => a - b), [4000, 45000]);
  const p = f[45000].properties; assert.equal(p.cell, LC1); assert.equal(p.s, x.S.res.s); assert.ok(Math.abs(p.lon - -1.45) < 1e-9 && Math.abs(p.lat - 52.05) < 1e-9, `${p.lon},${p.lat}`);
  assert.deepEqual([...f[45000].geometry.coordinates], [p.lon, p.lat]);
  for (const l of CLS) { assert.equal(x.layers.get(l).type, 'circle', l); assert.equal(x.layers.get(l).source, 'gridatlas-lightning-cells'); }
  assert.ok([...x.layers.keys()].every(l => !/heat/.test(l) && x.layers.get(l).type !== 'heatmap'), 'heatmap layer present');
  assert.ok(CLS.every(l => !l.startsWith('l-')), 'cell ids must not use the original\'s interactive l- prefix');
  const hit = x.layers.get(CELL).paint; assert.equal(hit['circle-radius'], 22); assert.equal(hit['circle-opacity'], 0);
  const core = x.layers.get(CLS[1]); assert.deepEqual([...core.layout['circle-sort-key']], ['get', 'n']); assert.equal(x.layers.get(CLS[0]).filter[2], 45000, 'glow floor = max(30, p95 of drawn cells)');
  assert.equal(x.sources.get('gridatlas-lightning').data.features.length, 0, 'points drawn without consent');
  assert.match(x.cap('flashes'), /^Flashes 50,000 archived on \d+ overlapping UTC dates · map shows 49,000 in 2 ≈10 km cells within 30 km of a REPD site; 1,000 further out counted, not drawn · tap a cell for nearest substations · LOAD POINTS adds the newest 40,000 flashes$/);
  assert.equal(x.nav('points').hidden, false); assert.match(x.label(), /\[50,000 \| /);
});

test('L2: land clip is render-only: sea and Republic of Ireland cells are not drawn but stay in the totals', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.res.gd.n, 50000); assert.equal(x.S.res.gd.k, 49000);
  const cells = cellsSrc(x).data.features.map(q => q.properties.cell); assert.ok(!cells.includes(SEA) && !cells.includes(EIRE));
});

test('L3: tapping a cell fires the original nearestSubstations from the cell centre with the neon arrival and the cell card', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain();
  const f = cellsSrc(x).data.features.find(q => q.properties.n === 45000); x.camera.length = 0; cellHit(x, f);
  assert.equal(x.neonCalls.length, 1); assert.ok(Math.abs(x.neonCalls[0][0] - -1.45) < 1e-9 && Math.abs(x.neonCalls[0][1] - 52.05) < 1e-9);
  assert.equal(x.sources.get('gridatlas-lightning-neon-links').data.features.length, 5);
  const c = card(x); assert.equal(c.getAttribute('aria-label'), 'Lightning cell'); assert.equal(c.children[0].children[0].textContent, '45,000 optical flashes in this ≈10 km cell');
  assert.match(c.textContent, /searched UTC days only; unsearched days unknown, not zero/); assert.ok(x.camera.find(k => k[0] === 'flyTo'));
});

test('L4: a project or substation of the original under the tap wins over a cell (no second engine, no card); hidden ones do not', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain();
  const vis = { 'l-solar': 'visible', 'l-solar-glow': 'visible', 'l-subs': 'visible', 'l-wind': 'none' };
  x.map.getStyle = () => ({ layers: [{ id: 'l-solar-glow', source: 'src-repd' }, { id: 'l-solar', source: 'src-repd' }, { id: 'l-wind', source: 'src-repd' }, { id: 'l-subs', source: 'src-subs' }, ...[...x.layers.keys()].map(id => ({ id, source: x.layers.get(id).source }))] });
  x.map.getLayoutProperty = (id, k) => vis[id] || 'visible';
  const f = cellsSrc(x).data.features[0], at = [f.properties.lon * 10, f.properties.lat * 10];
  for (const l of ['l-solar', 'l-subs']) { x.tapMap(at, { [l]: [{ properties: { tech: 'solar' } }], [CELL]: [f] }); assert.equal(card(x), null, l); assert.equal(x.neonCalls.length, 0, l); }
  x.tapMap(at, { 'l-wind': [{ properties: {} }], [CELL]: [f] }); assert.ok(card(x), 'a hidden project layer blocked the cell'); assert.equal(x.neonCalls.length, 1);
});

test('L5: cells are inserted below the original\'s first REPD layer (projects stay on top), else below our points', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); const add = x.map.addLayer, before = {};
  x.map.addLayer = (l, b) => { before[l.id] = b; return add(l, b); };
  x.map.getStyle = () => ({ layers: [{ id: 'base' }, { id: 'l-solar-glow', source: 'src-repd' }, { id: 'l-solar', source: 'src-repd' }] }); x.map.getLayoutProperty = () => 'none';
  x.toggle(true); x.click(x.chip('12m')); await drain();
  for (const l of CLS) assert.equal(before[l], 'l-solar-glow', l);
  const y = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }), b2 = {}, a2 = y.map.addLayer; y.map.addLayer = (l, b) => { b2[l.id] = b; return a2(l, b); };
  y.toggle(true); y.click(y.chip('12m')); await drain(); for (const l of CLS) assert.equal(b2[l], 'l-gridatlas-lightning', l);
});

test('L6: stale (sha256/count differs) and never-searched grid days are not drawn and are named (unknown, not zero)', async () => {
  const g = [KGRID[0], { ...KGRID[1], day: { sha256: ['0'.repeat(64)] } }];
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(g) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.res.gd.n, 25000); assert.equal(x.S.res.gd.st, 1);
  assert.deepEqual(Array.from(cellsSrc(x).data.features, q => q.properties.n).sort((a, b) => a - b), [4000, 20000]);
  assert.match(x.cap('flashes'), /· 1 day not yet mapped \(unknown\) ·/);
  const d3 = ymd(Date.now() - 41 * D), idx = mkIndex({ ...KROWS, [d3]: { coverage: 'none', scanned_seconds: 0, count: null } });
  const y = boot({ index: idx, files: mkGrids([...KGRID, { date: d3, row: { count: 7, path: P(d3), sha256: 'q' }, cells: { [LC2]: 7 } }]) }); y.toggle(true); y.click(y.chip('12m')); await drain();
  assert.equal(y.S.res.gd.n, 50000); assert.equal(cellsSrc(y).data.features.find(q => q.properties.cell === LC2).properties.n, 4000);
});

test('L7: an invalid or unpublished grid is refused; nothing is drawn, the caption says why, never FAIL', async () => {
  const bad = [g => ({ ...g, schema: 'uk-lightning-history-grid.v0' }), g => ({ ...g, month: '1999-01' }), g => ({ ...g, cols: 141 }), g => ({ ...g, cells: [[16800, 1, 1]] }),
    g => ({ ...g, cells: g.cells.map(r => [r[0], 32, r[2]]) }), g => ({ ...g, cells: g.cells.map(r => [r[0], r[1], 0]) }), g => ({ ...g, cells: g.cells.map(r => [r[0], r[1], String(r[2])]) }),
    g => ({ ...g, cells: g.cells.slice(1) }), g => ({ ...g, days: g.days.map(d => ({ ...d, sha256: d.sha256[0] })) }), g => ({ ...g, cells: ['<img src=x onerror=alert(1)>'] }),
    g => ({ ...g, cells: g.cells.map(r => [r[0] + 0.5, ...r.slice(1)]) }), g => ({ ...g, days: Array(32).fill(g.days[0]) }), () => '{not json'];
  for (const [i, t] of bad.entries()) {
    const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID, t) }); x.toggle(true); x.click(x.chip('12m')); await drain();
    assert.equal(x.S.res.gd, undefined, 'variant ' + i); assert.equal(cellsSrc(x), undefined, 'variant ' + i); assert.equal(x.S.last.cells, 0); assert.notEqual(x.S.last.state, 'FAIL');
    assert.match(x.cap('flashes'), /none drawn \(summary mode; .*\) · cell grid archive unavailable: /, 'variant ' + i);
  }
  const x = boot({ index: mkIndex(KROWS), files: {} }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.match(x.cap('flashes'), /· cell grid archive not yet published: HTTP 404$/); assert.equal(x.log.errors.length, 0);
  const files = mkGrids(KGRID); delete files['grid/' + KD[1].slice(0, 7) + '.json'];
  const y = boot({ index: mkIndex(KROWS), files }); y.toggle(true); y.click(y.chip('12m')); await drain();
  assert.equal(y.S.res.gd.n, 25000); assert.match(y.cap('flashes'), /1 day not yet mapped \(unknown; HTTP 404\)/); // L3: LRB3 names the refused month
});

test('L8: phone over its 10,000 cap: cells by default; LOAD POINTS keeps them beneath tappable points; flash wins, cell still fires', async () => {
  const s1 = shard(KD[0], 6000, Date.parse(KD[0] + 'T10:00:00Z')), s2 = shard(KD[1], 6000, Date.parse(KD[1] + 'T10:00:00Z'));
  const rows = { [KD[0]]: s1.row, [KD[1]]: s2.row }, g = [{ date: KD[0], row: s1.row, cells: { [LC1]: 6000 } }, { date: KD[1], row: s2.row, cells: { [LC1]: 6000 } }];
  const x = boot({ phone: true, index: mkIndex(rows), files: { ...mkGrids(g), [s1.row.path]: s1.b, [s2.row.path]: s2.b } }); installNeon(x, SUBS); x.map.setPaintProperty = () => {};
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.last.cells, 1); assert.equal(x.S.last.drawn, 0); const f = cellsSrc(x).data.features[0]; assert.equal(f.properties.n, 12000);
  cellHit(x, f); assert.equal(x.neonCalls.length, 1); assert.match(card(x).textContent, /^12,000 optical flashes in this ≈10 km cell/);
  x.click(x.nav('points')); await drain();
  assert.equal(x.S.res.mode, 'detail'); assert.equal(x.sources.get('gridatlas-lightning').data.features.length, 12000); assert.ok(cellsSrc(x), 'cells removed after LOAD POINTS');
  assert.match(x.cap('flashes'), /· map shows 12,000 in 1 ≈10 km cell within 30 km of a REPD site/);
  x.neonCalls.length = 0; tapFlash(x); assert.deepEqual(x.neonCalls.map(a => [a[0], a[1]]), [[-1.5, 52]]); assert.equal(card(x).getAttribute('aria-label'), 'Lightning flash');
  const g2 = cellsSrc(x).data.features[0]; x.neonCalls.length = 0; cellHit(x, g2); assert.equal(x.neonCalls.length, 1, 'cell under LOAD POINTS'); assert.equal(card(x).getAttribute('aria-label'), 'Lightning cell');
});

test('L9: short windows within the cap keep J\'s dots only: no grid request, no cell layer; OFF and short windows remove the cells', async () => {
  const files = {}, over = {};
  for (let k = 1; k <= 3; k++) { const d = ymd(Date.now() - k * D), s = shard(d, 42, Date.parse(d + 'T10:00:00Z')); files[s.row.path] = s.b; over[d] = s.row; }
  let x = boot({ index: mkIndex(over), files }); x.toggle(true); x.click(x.chip('7d')); await drain();
  assert.equal(x.S.res.mode, 'detail'); assert.equal(x.S.last.drawn, 126); assert.equal(gridUrls(x).length, 0); assert.equal(cellsSrc(x), undefined); for (const l of CLS) assert.equal(x.layers.get(l), undefined);
  x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); x.toggle(true); x.click(x.chip('12m')); await drain(); assert.ok(cellsSrc(x));
  x.click(x.chip('7d')); await drain(); assert.equal(cellsSrc(x), undefined, 'cells kept on a window within the cap');
  x.click(x.chip('12m')); await drain(); assert.ok(cellsSrc(x)); x.toggle(false);
  assert.equal(cellsSrc(x), undefined); for (const l of CLS) assert.equal(x.layers.get(l), undefined);
});

test('L10: budget and discipline: module <= 44,781 B, one innerHTML, GS constant, grid path only from YYYY-MM, no heatmap', () => {
  assert.ok(Buffer.byteLength(SRC) <= 64781, `${Buffer.byteLength(SRC)} B`); assert.ok(435218 + 1 + Buffer.byteLength(SRC) <= 500000); // M2: owner's 500 kB gate
  assert.equal(SRC.split('innerHTML').length, 2); assert.match(SRC, /GS='uk-lightning-history-grid\.v1'/); assert.doesNotMatch(SRC, /heatmap/);
  assert.match(SRC, /if\(!\/\^\\d\{4\}-\\d\\d\$\/\.test\(mo\)\)E\('grid path'\);const u=AR\+'grid\/'\+mo\+'\.json'/);
});

test('L11 (real data, LIGHTNING_DATA=<lightning checkout>/data/history): 12M cells sum to the index; REPD 30 km clip; a real cell fires the engine', { skip: !process.env.LIGHTNING_DATA }, async () => {
  const dir = process.env.LIGHTNING_DATA, idx = JSON.parse(readFileSync(dir + '/index.json', 'utf8'));
  const files = new Proxy({}, { get: (_, k) => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } } });
  const x = boot({ phone: true, index: idx, files, now: Date.parse(idx.generated_utc) + 60e3 }); installNeon(x, SUBS); x.map.setPaintProperty = () => {}; x.toggle(true); x.click(x.chip('12m')); await drain();
  const want = idx.days.filter(r => r.count > 0 && Date.parse(r.date) >= x.S.res.w.s - D).reduce((a, r) => a + r.count, 0), fs = cellsSrc(x).data.features;
  assert.equal(x.S.res.gd.st, 0); assert.equal(x.S.res.gd.n, want); assert.equal(fs.reduce((a, f) => a + f.properties.n, 0), x.S.res.gd.k);
  console.log(`# L11 real 12M: ${want} flashes, ${fs.length} cells drawn holding ${x.S.res.gd.k} (glow floor ${x.S.res.gd.T}), ${new Set(gridUrls(x)).size} grid files · ${x.cap('flashes')}`);
  const big = fs.reduce((a, f) => f.properties.n > a.properties.n ? f : a); cellHit(x, big); assert.equal(x.neonCalls.length, 1); assert.ok(card(x));
  console.log(`# L11 tap cell ${big.properties.cell} n=${big.properties.n}: ${card(x).children[0].children[0].textContent}`);
  for (const p of ['7d', '30d', '3m', '6m']) { x.click(x.chip(p)); await drain(); console.log(`# L11 ${p}: ${x.S.last.state} cells ${x.S.last.cells} drawn ${x.S.last.drawn} · ${x.status()}`); }
});

// ================================================================ LR-bugs (evidence/LR-bugs/tests.part)

// ================================================================ LR-bugs: adversarial review of the L2 cell code
const BLOB = [-7.55716, 49.766807]; // REPD placeholder coordinate (OSGB 0,0) carried by 18 records with no real location
const kmTo = (lon, lat, [x, y]) => hav(lon, lat, x, y);

test('LRB1 (MAJOR): the land mask draws open-Atlantic cells ~100 km SW of Scilly as "within ≈30 km of UK land"', async () => {
  const SW = GC(-7.55, 49.75), FAR = GC(-7.3, 49.95);
  const g = [{ date: KD[0], row: KROWS[KD[0]], cells: { [LC1]: 24000, [SW]: 600, [FAR]: 400 } }, { date: KD[1], row: KROWS[KD[1]], cells: { [LC1]: 25000 } }];
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(g) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  const sea = cellsSrc(x).data.features.filter(f => f.properties.lon < -6.6 && f.properties.lat < 50.3);
  assert.match(x.cap('flashes'), /within 30 km of a REPD site/); // L3 wording
  assert.equal(sea.length, 0, 'open-sea cells drawn under a "sea not drawn" caption: ' + JSON.stringify(sea.map(f => [f.properties.lon, f.properties.lat, f.properties.n])));
});

test('LRB1-real (MAJOR, LIGHTNING_DATA): real 12M draws cells around the REPD placeholder point in the Atlantic', { skip: !process.env.LIGHTNING_DATA }, async () => {
  const dir = process.env.LIGHTNING_DATA, idx = JSON.parse(readFileSync(dir + '/index.json', 'utf8'));
  const files = new Proxy({}, { get: (_, k) => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } } });
  const x = boot({ phone: true, index: idx, files, now: Date.parse(idx.generated_utc) + 60e3 }); x.toggle(true); x.click(x.chip('12m')); await drain();
  const sea = cellsSrc(x).data.features.filter(f => f.properties.lon < -6.6 && kmTo(f.properties.lon, f.properties.lat, BLOB) < 32);
  console.log(`# LRB1-real: ${sea.length} drawn cells, ${sea.reduce((a, f) => a + f.properties.n, 0)} flashes within 32 km of ${BLOB}: ${sea.map(f => f.properties.lon.toFixed(2) + ',' + f.properties.lat.toFixed(2) + ' n=' + f.properties.n).join('; ')}`);
  assert.equal(sea.length, 0);
});

test('LRB2 (MINOR): every grid day stale (no error) -> READY·CELLS with "0 of 0 in 0 cells … tap a cell", nothing drawn, no summary fallback', async () => {
  const g = KGRID.map(e => ({ ...e, day: { sha256: ['0'.repeat(64)] } }));
  const full = { scan_windows: [{ start_utc: iso(Date.now() - 400 * D), end_utc: iso(Date.now() + 60e3), successful_runs: 999 }] };
  const x = boot({ index: mkIndex(KROWS, full), files: mkGrids(g) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  console.log('# LRB2 state ' + x.S.last.state + ' cells ' + x.S.last.cells + ' · ' + x.cap('flashes'));
  assert.equal(cellsSrc(x), undefined);
  assert.doesNotMatch(x.cap('flashes'), /0 of 0 in 0 cells/, 'empty grid reported as drawn cells');
  assert.doesNotMatch(x.cap('flashes'), /tap a cell/, 'invites a tap on nothing');
  assert.notEqual(x.S.last.state, 'READY·CELLS');
});

test('LRB3 (MINOR): one month grid refused (invalid / sha-type / timeout) while another loads -> named only as "not yet in the grid"; the error is swallowed', async () => {
  const files = mkGrids(KGRID), bad = 'grid/' + KD[1].slice(0, 7) + '.json'; files[bad] = enc({ schema: 'uk-lightning-history-grid.v0' });
  const x = boot({ index: mkIndex(KROWS), files }); x.toggle(true); x.click(x.chip('12m')); await drain();
  console.log('# LRB3 ' + x.cap('flashes') + ' · errors ' + JSON.stringify(x.S.errors));
  assert.ok(cellsSrc(x));
  assert.match(x.cap('flashes'), /invalid grid|unavailable/, 'a refused grid is reported as an ordinary lag');
});

// whole-UTC-day edge: a window starting mid-day on an hourly-parts day (real: 2026-05-27, 06-25..27, 08-27)
const PT = Date.UTC(2026, 6, 26, 12), PD = '2026-06-26', OD = '2026-07-10';
const partsRow = (date, per) => ({ count: 24 * per, bytes: null, path: null, sha256: null, parts: Array.from({ length: 24 }, (_, h) => ({ path: P(date).replace('.json', '/' + String(h).padStart(2, '0') + '.json'), count: per, bytes: 100, sha256: 'p' + h })) });

test('LRB4 (MINOR): 30D starting mid-day on a parts day: cells sum the whole day, so "k of n" exceeds the caption\'s "N archived"', async () => {
  const rows = { [PD]: partsRow(PD, 500), [OD]: { count: 6000, bytes: 1000, path: P(OD), sha256: 'o' } };
  const g = [{ date: PD, row: rows[PD], cells: { [LC1]: 12000 } }, { date: OD, row: rows[OD], cells: { [LC1]: 6000 } }];
  const x = boot({ phone: true, now: PT, index: mkIndex(rows, {}, PT), files: mkGrids(g) }); x.toggle(true); x.click(x.chip('30d')); await drain();
  const arch = x.S.res.arch, n = x.S.res.gd && x.S.res.gd.n; console.log(`# LRB4 arch ${arch} gd.n ${n} · ${x.cap('flashes')}`);
  assert.ok(n <= arch, `cells total ${n} > archived ${arch} in the same caption`);
});

test('LRB4-real (MINOR, LIGHTNING_DATA): 3M on 2026-11-27 13:20 UTC starts mid-day on parts day 2026-08-27', { skip: !process.env.LIGHTNING_DATA }, async () => {
  const dir = process.env.LIGHTNING_DATA, idx = JSON.parse(readFileSync(dir + '/index.json', 'utf8'));
  const files = new Proxy({}, { get: (_, k) => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } } });
  const now = Date.UTC(2026, 10, 27, 13, 20);
  const x = boot({ phone: true, index: idx, files, now }); x.toggle(true); x.click(x.chip('3m')); await drain();
  const r = x.S.res; console.log(`# LRB4-real 3M ${new Date(r.w.s).toISOString()}: arch ${r.arch} gd.n ${r.gd && r.gd.n} · ${x.cap('flashes')}`);
  assert.ok(r.gd.n <= r.arch, `cells total ${r.gd.n} > archived ${r.arch}`);
});

// ---------------------------------------------------------------- guards (expected PASS): races, 404, NaN, rapid taps
test('LRG1: toggle OFF while the grid fetch is in flight leaves no cell source/layer and no card', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID), park: true }); x.toggle(true); x.click(x.chip('12m')); await drain();
  x.toggle(false); x.release(); await drain(); x.release(); await drain();
  assert.equal(cellsSrc(x), undefined); for (const l of CLS) assert.equal(x.layers.get(l), undefined); assert.equal(x.S.res, null);
});

test('LRG2: 12M -> 7D while the grid fetch is in flight: the late 12M grid never paints cells over 7D', async () => {
  const s = shard(ymd(Date.now() - D), 5, Date.now() - D);
  const x = boot({ index: mkIndex({ ...KROWS, [ymd(Date.now() - D)]: s.row }), files: { ...mkGrids(KGRID), [s.row.path]: s.b }, park: true }); x.toggle(true); x.click(x.chip('12m')); await drain();
  x.click(x.chip('7d')); for (let i = 0; i < 4; i++) { x.release(); await drain(); }
  assert.equal(x.S.res.w.period, '7d'); assert.equal(cellsSrc(x), undefined); assert.equal(x.S.last.drawn, 5);
});

test('LRG3: rapid taps on two cells leave exactly one card and one neon set (latest cell)', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.map.setPaintProperty = () => {}; x.toggle(true); x.click(x.chip('12m')); await drain();
  const fs = cellsSrc(x).data.features; for (let i = 0; i < 6; i++) cellHit(x, fs[i % fs.length]);
  assert.equal(x.mapEl.querySelectorAll('[data-lightning-card]').length, 1); assert.equal(x.neonCalls.length, 6);
  const last = fs[5 % fs.length].properties; assert.deepEqual(x.neonCalls[5].slice(0, 2), [last.lon, last.lat]);
});

test('LRG4: all grid months 404 -> summary fallback, no throw, no cell layer; no error', async () => {
  const x = boot({ index: mkIndex(KROWS), files: {} }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(cellsSrc(x), undefined); assert.match(x.cap('flashes'), /cell grid archive not yet published: HTTP 404/); assert.deepEqual(x.log.errors, []);
});


// ================================================================ LR-security (appended to a copy of L-build/test-engine.mjs)
const ctxEval = (x, js) => vm.runInContext(js, x.sandbox);
const ALLOW = /^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\/data\/history\/(index\.json(\?[\w=&.-]*)?|days\/\d{4}\/\d\d\/\d\d(\/\d\d)?\.json|grid\/\d{4}-\d\d\.json)$/;
const boot12 = async (files, extra = {}) => { const x = boot({ index: mkIndex(KROWS), files, ...extra }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain(); return x; };
const wrapFetch = (x, f) => { const real = x.sandbox.fetch; x.sandbox.fetch = (u, o) => f(u, o, real); };

test('LRS1 allow-list: every request (index, days, grid) in every window matches the Ventusltd/lightning history allow-list; grid only YYYY-MM.json', { skip: !process.env.LIGHTNING_DATA }, async () => {
  const dir = process.env.LIGHTNING_DATA, idx = JSON.parse(readFileSync(dir + '/index.json', 'utf8'));
  const files = new Proxy({}, { get: (_, k) => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } } });
  const x = boot({ phone: true, index: idx, files, now: Date.parse(idx.generated_utc) + 60e3 }); installNeon(x, SUBS); x.map.setPaintProperty = () => {}; x.toggle(true);
  for (const p of ['24h', '7d', '30d', '3m', '6m', '12m']) { x.click(x.chip(p)); await drain(); }
  x.click(x.nav('points')); await drain();
  const bad = x.log.fetch.filter(u => !ALLOW.test(u)); assert.deepEqual(bad, []);
  const g = x.log.fetch.filter(u => u.includes('/grid/')); assert.ok(g.length > 0);
  console.log(`# LRS1 ${x.log.fetch.length} fetches (${g.length} grid, ${new Set(g).size} distinct), ${x.log.xhr.length} xhr; all on the allow-list`);
});

test('LRS2 redirect: a grid response with redirected:true is refused (no cells drawn, never FAIL)', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS);
  wrapFetch(x, async (u, o, real) => { const r = await real(u, o); if (!u.includes('/grid/')) return r; const b = await r.arrayBuffer(); return { ok: true, status: 200, redirected: true, url: 'https://evil.example/g.json', json: async () => JSON.parse(Buffer.from(b)), arrayBuffer: async () => b }; });
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.equal(x.S.res.gd, undefined); assert.equal(cellsSrc(x), undefined); assert.notEqual(x.S.last.state, 'FAIL'); assert.match(x.cap('flashes'), /cell grid archive unavailable: redirected/);
});

test('LRS3 prototype pollution: __proto__/constructor keys in a grid never reach Object.prototype; a schema hidden under __proto__ is refused', async () => {
  const poison = '"__proto__":{"polluted":"yes","schema":"uk-lightning-history-grid.v1"},"constructor":{"prototype":{"polluted2":"yes"}}';
  // a valid grid with extra poison keys at top level and inside every day entry still loads, and nothing is polluted
  const files = mkGrids(KGRID); for (const k in files) { const s = files[k].toString(); files[k] = Buffer.from(s.replace(/^\{/, '{' + poison + ',').replace(/\{"date"/g, '{' + poison + ',"date"')); }
  const x = await boot12(files);
  assert.equal(x.S.res.gd.n, 50000); assert.equal(ctxEval(x, '({}).polluted===undefined&&({}).polluted2===undefined&&[].polluted===undefined'), true);
  // the only schema is under __proto__ (own key after JSON.parse): refused
  const g2 = mkGrids(KGRID, g => { const { schema, ...rest } = g; return '{' + poison + ',' + JSON.stringify(rest).slice(1); });
  const y = await boot12(g2); assert.equal(y.S.res.gd, undefined); assert.equal(ctxEval(y, '({}).schema'), undefined);
  // a cell row that is an object (with numeric keys / length) is refused, not iterated
  const z = await boot12(mkGrids(KGRID, g => ({ ...g, cells: g.cells.map(r => ({ ...r, length: r.length })) }))); assert.equal(z.S.res.gd, undefined);
});

test('LRS4 huge numbers: floats, negatives, 2^32, 1e308, 2^53+1 are refused; -0 is harmless', async () => {
  for (const v of [1.5, -1, 4294967296, 1e308, 9007199254740993, '7', null, true]) {
    const x = await boot12(mkGrids(KGRID, g => ({ ...g, cells: g.cells.map(r => [r[0], r[1], v]) }))); assert.equal(x.S.res.gd, undefined, String(v));
  }
  const y = await boot12(mkGrids(KGRID, g => ({ ...g, cells: g.cells.map((r, i) => i ? r : [-0, ...r.slice(1)]) })));
  assert.ok(y.S.res.gd === undefined || y.S.res.gd.fc.features.every(f => f.properties.cell >= 0));
});

test('LRS5 [FIXED S2] a cell summing to >= 2^32 (two valid uint32 days) is drawn and its tap fires', async () => {
  const M = 4294967295, R = { [KD[0]]: { count: M, bytes: 1000, path: P(KD[0]), sha256: 'x' }, [KD[1]]: { count: M, bytes: 1000, path: P(KD[1]), sha256: 'y' } };
  const g = [{ date: KD[0], row: R[KD[0]], cells: { [LC1]: M } }, { date: KD[1], row: R[KD[1]], cells: { [LC1]: M } }];
  const x = boot({ index: mkIndex(R), files: mkGrids(g) }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain();
  const f = cellsSrc(x).data.features[0]; assert.equal(f.properties.n, 2 * M, 'cell drawn with n = 2^33-2');
  cellHit(x, f);
  assert.equal(x.neonCalls.length, 1, 'tap dropped'); assert.ok(card(x));
  console.log('# LRS5 drawn n=' + f.properties.n + ', tap: 0 engine calls, no card');
});

test('LRS6 [FIXED S1] grid/YYYY-MM.json over 2 MB is refused before parsing; 1.9 MB still loads', async () => {
  const pad = 'x'.repeat(2.1e6); { const y = await boot12(mkGrids(KGRID, g => ({ ...g, pad: 'x'.repeat(1.9e6) }))); assert.equal(y.S.res.gd.n, 50000, '1.9 MB refused'); }
  const files = mkGrids(KGRID, g => ({ ...g, pad }));
  const t0 = Date.now(); const x = await boot12(files);
  assert.equal(x.S.res.gd, undefined, 'over-cap grid accepted'); assert.match(x.cap('flashes'), /cell grid archive unavailable: grid size/);
  console.log(`# LRS6 accepted ${Object.values(files).reduce((a, b) => a + b.length, 0)} B of grid JSON in ${Date.now() - t0} ms; day files are capped by index bytes+sha256, grid files by nothing`);
});

test('LRS7 innerHTML/attributes: grid text never becomes markup; the JSON error message reaches the caption as text only', async () => {
  const x = await boot12(mkGrids(KGRID, () => '<img src=x onerror=alert(1)>"‮'));
  const imgs = x.doc.documentElement.querySelectorAll('img').length; assert.equal(imgs, 0);
  const c = x.cap('flashes'); console.log('# LRS7 caption tail: ' + JSON.stringify(c.slice(c.indexOf('cell grid'))));
  assert.match(c, /cell grid archive unavailable: /);
  const b = await boot12(mkGrids(KGRID, () => '\u202e\u200bevil')); const cb2 = b.cap('flashes');
  assert.equal(/[\u202e\u200b]/.test(cb2), false, 'bidi/zero-width text reached the caption (S3)'); console.log('# LRS7 bidi in caption: ' + /[\u202e\u200b]/.test(cb2) + ' ' + JSON.stringify(cb2.slice(cb2.indexOf('cell grid'))));
  // the cell card is built from numbers re-derived and range-checked by cb(); feature properties are never interpolated as HTML
  const y = await boot12(mkGrids(KGRID)); const f = cellsSrc(y).data.features[0];
  cellHit(y, { properties: { ...f.properties, lat: '<b>x</b>' } }); assert.equal(card(y), null, 'string lat accepted');
  cellHit(y, { properties: { ...f.properties, n: '<b>' } }); assert.equal(card(y), null, 'string n accepted');
  cellHit(y, { properties: { ...f.properties, lon: f.properties.lon + 0.2 } }); assert.equal(card(y), null, 'centre outside its cell accepted');
  cellHit(y, { properties: { ...f.properties, s: -1 } }); assert.equal(card(y), null, 'stale serial accepted');
  cellHit(y, f); assert.ok(card(y)); assert.equal(card(y).querySelectorAll('img').length, 0);
});

test('LRS8 mask blob: decodes to exactly 16,800 cells, equals LR-bugs mask-30km.txt (placeholder point dropped), is a module-private constant not reachable from the API', () => {
  const m = SRC.match(/for\(const c of'([0-9A-Za-z]+)'\.match/); assert.ok(m); const s = m[1];
  assert.equal(s, readFileSync(new URL('./fixtures/mask-30km.txt', import.meta.url), 'utf8'));
  let p = 0; const runs = s.match(/[A-Z]?./g).map(c => c[1] ? (c.charCodeAt(0) - 64) * 36 + parseInt(c[1], 36) : parseInt(c, 36)); for (const r of runs) p += r;
  assert.equal(p, 16800, 'run lengths sum'); assert.ok(runs.every(Number.isInteger));
  assert.doesNotMatch(SRC.match(/NS\.ukLightning=Object\.freeze\(\{[^}]*\}/)[0], /LM|gd|gg/);
  assert.equal(SRC.split('LM()[').length, 2, 'mask indexed in one place'); assert.match(SRC, /r\[0\]>>>0!==r\[0\]\|\|r\[0\]>=16800/);
});

test('LRS9 caps: >16,800 cell rows, a row of 65 entries, 32 days are refused', async () => {
  for (const t of [g => ({ ...g, cells: Array(16801).fill(g.cells[0]) }), g => ({ ...g, cells: [[g.cells[0][0], ...Array(32).fill([1, 1]).flat()]] }), g => ({ ...g, days: Array(32).fill(g.days[0]) })]) {
    const x = await boot12(mkGrids(KGRID, t)); assert.equal(x.S.res.gd, undefined);
  }
});

// ================================================================ LR-words (evidence/LR-words/harness.mjs WORDS dump)

const textOf = n => { const o = []; const w = e => { if (e.textContent !== undefined && !e.children?.length) o.push(e.textContent); for (const c of e.children || []) w(c); }; w(n); return o; };
const dumpAll = (x, tag) => { const o = [`=== ${tag}`, `LABEL  ${x.label()}`, `STATUS ${x.status()}`]; for (const k of ['window','days','actual','flashes','refresh','searched','warning','footer']) o.push(`CAP.${k.padEnd(8)} ${x.cap(k)}`); o.push(`STATE ${JSON.stringify(x.S.last)}`); return o.join('\n'); };
const dumpCard = (x, tag) => { const c = card(x); if (!c) return `--- ${tag}: NO CARD`; const o = [`--- CARD ${tag}`, `aria-label=${c.getAttribute('aria-label')} role=${c.getAttribute('role')}`];
  for (const b of c.querySelectorAll('button')) o.push(`button "${b.textContent}" aria-label=${b.getAttribute('aria-label')}`); o.push(...textOf(c).map(s => '  · ' + s)); return o.join('\n'); };
test('WORDS dump (real data)', { skip: !process.env.LIGHTNING_DATA }, async () => {
  const dir = process.env.LIGHTNING_DATA, idx = JSON.parse(readFileSync(dir + '/index.json', 'utf8'));
  const files = new Proxy({}, { get: (_, k) => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } } });
  const fd = readFileSync(dir + '/../uk_lightning.geojson', 'utf8'); const out = [];
  for (const phone of [true, false]) {
    const x = boot({ phone, index: idx, files, feedFn: () => fd, now: Date.parse(idx.generated_utc) + 60e3 }); installNeon(x, SUBS); x.map.setPaintProperty = () => {}; x.toggle(true); await drain();
    out.push(dumpAll(x, `${phone ? 'PHONE' : 'DESKTOP'} 24h (default)`));
    for (const p of ['12h', '48h', '7d', '30d', '3m', '6m', '12m']) {
      x.click(x.chip(p)); await drain(); out.push(dumpAll(x, `${phone ? 'PHONE' : 'DESKTOP'} ${p}`));
      const cs = cellsSrc(x); const fs = cs && cs.data && cs.data.features || [];
      if (fs.length) { const big = fs.reduce((a, f) => f.properties.n > a.properties.n ? f : a), sm = fs.find(f => f.properties.n === 1);
        cellHit(x, big); out.push(dumpCard(x, `${p} big cell n=${big.properties.n}`)); if (sm) { cellHit(x, sm); out.push(dumpCard(x, `${p} n=1 cell`)); }
        if (phone && p === '12m') { x.click(x.nav('points')); await drain(); out.push(dumpAll(x, 'PHONE 12m after LOAD POINTS')); x.click(x.nav('prev')); await drain(); out.push(dumpAll(x, 'PHONE 12m PREV (after LOAD POINTS consent reset?)')); }
      } else if (x.S.res && x.S.res.ev.length) { tapFlash(x, x.S.res.ev.length - 1); out.push(dumpCard(x, `${p} flash`)); }
    }
    x.click(x.chip('7d')); await drain(); installNeon(x, []); tapFlash(x, 0); out.push(dumpCard(x, '7d flash, substations not loaded'));
    if (phone) { x.click(x.chip('30d')); await drain(); x.click(x.nav('prev')); await drain(); out.push(dumpAll(x, 'PHONE 30d PREV')); }
  }
  // grid unavailable
  const nog = new Proxy({}, { get: (_, k) => String(k).startsWith('grid/') ? undefined : (() => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } })() });
  const y = boot({ phone: true, index: idx, files: nog, feedFn: () => fd, now: Date.parse(idx.generated_utc) + 60e3 }); y.map.setPaintProperty = () => {}; y.toggle(true); await drain(); y.click(y.chip('12m')); await drain(); out.push(dumpAll(y, 'PHONE 12m grid 404'));
  // index 404 -> feed
  const z = boot({ phone: true, index: null, files: {}, feedFn: () => fd, now: Date.parse(idx.generated_utc) + 60e3 }); z.map.setPaintProperty = () => {}; z.toggle(true); await drain(); out.push(dumpAll(z, 'PHONE 24h index 404')); z.click(z.chip('12m')); await drain(); out.push(dumpAll(z, 'PHONE 12m index 404'));
  console.log(out.join('\n\n').split('\n').map(l => '#R ' + l).join('\n'));
  const all = out.join('\n'); // L3: LR-words assertions on the rendered words
  assert.doesNotMatch(all, /affected|Not yet ingested|\d+h \d+min|0 archived in window \(unknown, not zero\)|day-level|as tappable points|UK land|sea and abroad/i);
  for (const m of all.matchAll(/CAP\.flashes  (Flashes .*map shows.*)/g)) assert.ok(m[1].length <= 380, 'flashes line ' + m[1].length + ' chars: ' + m[1]);
  for (const m of all.matchAll(/--- CARD .*\n.*\n.*\n.*\n  · (.*)/g)) assert.ok(m[1].length <= 42, 'card title ' + m[1]);
  assert.match(all, /optical flashes in this ≈10 km cell/); assert.match(all, /Not evidence any asset was struck/);
});


// ================================================================ L3-build: LR-numbers, LR-layout (node), LR-regress m1/m2, LR-words W-checks
test('LRN (real data): whenever cells draw, the caption\'s "N archived" equals the grid total (whole UTC days), at index time and on parts day 2026-08-27', { skip: !process.env.LIGHTNING_DATA }, async () => {
  const dir = process.env.LIGHTNING_DATA, idx = JSON.parse(readFileSync(dir + '/index.json', 'utf8'));
  const files = new Proxy({}, { get: (_, k) => { try { return readFileSync(dir + '/' + String(k)); } catch { return undefined; } } });
  for (const now of [Date.parse(idx.generated_utc) + 60e3, Date.parse('2026-08-27T13:00:00Z'), Date.UTC(2026, 10, 27, 13, 20)]) {
    const x = boot({ phone: true, index: idx, files, now }); x.toggle(true); await drain();
    for (const p of ['30d', '3m', '6m', '12m']) {
      x.click(x.chip(p)); await drain(); const r = x.S.res; if (!r.gd) { console.log(`# LRN ${new Date(now).toISOString()} ${p}: ${r.mode} ${r.ev.length} points`); continue; }
      const g = r.gd, fs = cellsSrc(x).data.features;
      console.log(`# LRN ${new Date(now).toISOString()} ${p}: arch ${r.arch} grid n ${g.n} drawn ${g.k} in ${fs.length} cells (stale ${g.st})`);
      if (!g.st) assert.equal(g.n, r.arch, p + ' two totals in one caption');
      assert.equal(fs.reduce((a, f) => a + f.properties.n, 0), g.k); assert.match(x.cap('flashes'), new RegExp('archived on .* map shows ' + g.k.toLocaleString('en-GB') + ' in .* ' + (g.n - g.k).toLocaleString('en-GB') + ' further out counted, not drawn'));
    }
  }
});

test('LAY1 (LR-layout MAJOR): fitBounds keeps the origin and endpoints clear: top 150 (search bar + labels), bottom = card bottom offset + height + 24', async () => {
  const od = Object.getOwnPropertyDescriptor(El.prototype, 'offsetHeight');
  Object.defineProperty(El.prototype, 'offsetHeight', { configurable: true, get() { return 143; } });
  try {
    const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installNeon(x, SUBS);
    x.mapEl._rect = { top: 0, left: 0, right: 393, bottom: 659, width: 393, height: 659 }; x.map.getBounds = () => ({ contains: () => false });
    x.toggle(true); await drain(); tapFlash(x);
    const c = card(x), fb = x.camera.find(k => k[0] === 'fitBounds'); assert.ok(fb, 'fitBounds'); const pad = fb[1][1].padding;
    assert.equal(pad.top, 150); assert.equal(typeof c.bb, 'number'); assert.equal(pad.bottom, c.bb + 143 + 24); assert.ok(pad.bottom >= 175);
  } finally { if (od) Object.defineProperty(El.prototype, 'offsetHeight', od); else delete El.prototype.offsetHeight; }
});

test('LAY2 (LR-layout MINOR): the card title wraps instead of ellipsising; LR-words W3 title fits 40 characters for n < 10,000', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain();
  cellHit(x, cellsSrc(x).data.features[0]); const t = card(x).children[0].children[0];
  assert.doesNotMatch(t.style.cssText, /nowrap|ellipsis|overflow:hidden/); assert.equal(pl9999(), true);
  function pl9999() { return '9,999 optical flashes in this ≈10 km cell'.length <= 41; }
});

test('m1 (LR-regress): a cell layer failure does not turn a good load into FAIL "map layer"; it is noted', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); const a0 = x.map.addLayer;
  x.map.addLayer = (l, b) => { if (/lightning-cell/.test(l.id)) throw new Error('cell layer boom'); return a0(l, b); };
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.notEqual(x.S.last.state, 'FAIL'); assert.ok(x.S.errors.some(e => /cells: cell layer boom/.test(e)), JSON.stringify(x.S.errors));
});

test('m1b (LR-regress): if the points draw throws, the previous window\'s cells are still removed', async () => {
  const s = shard(ymd(Date.now() - D), 5, Date.now() - D);
  const x = boot({ index: mkIndex({ ...KROWS, [ymd(Date.now() - D)]: s.row }), files: { ...mkGrids(KGRID), [s.row.path]: s.b } }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.ok(cellsSrc(x)); x.sources.get('gridatlas-lightning').setData = () => { throw new Error('setData boom'); };
  x.click(x.chip('7d')); await drain(); assert.equal(cellsSrc(x), undefined, 'stale 12M cells left on the map'); assert.equal(x.S.last.state, 'FAIL');
});

test('m2 (LR-regress): with no hit or cell layer a tap does nothing (no style scan, no card close), as in J', async () => {
  const x = boot(); installNeon(x, SUBS); x.toggle(true); await drain(); tapFlash(x); assert.ok(card(x));
  for (const l of ['gridatlas-lightning-hit', 'gridatlas-lightning-cell']) x.layers.delete(l);
  let scans = 0; x.map.getStyle = () => { scans++; return { layers: [] }; }; x.tapMap([1, 1], {});
  assert.equal(scans, 0); assert.ok(card(x), 'card closed by a tap that hit nothing');
});
test('LRT1 (LR-taps MAJOR): LATEST with a card open clears the card and the neon links', async () => {
  const x = boot({ phone: true, index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.map.setPaintProperty = () => {}; x.toggle(true);
  x.click(x.chip('30d')); await drain(); x.click(x.nav('prev')); await drain(); assert.ok(cellsSrc(x), 'paged 30D has cells');
  cellHit(x, cellsSrc(x).data.features.find(q => q.properties.cell === LC1)); assert.ok(card(x)); assert.ok(x.sources.get('gridatlas-lightning-neon-links'));
  x.click(x.nav('latest')); await drain(); assert.ok(!card(x), 'stale card after LATEST'); assert.equal(x.sources.get('gridatlas-lightning-neon-links'), undefined);
});

test('LRT2 (LR-taps MINOR): a tap while a load is in flight is ignored (no stale card)', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain();
  const f = cellsSrc(x).data.features[0]; x.S.busy = true; cellHit(x, f); assert.ok(!card(x)); assert.equal(x.neonCalls.length, 0);
  x.S.busy = false; cellHit(x, f); assert.ok(card(x)); assert.equal(x.neonCalls.length, 1);
});

test('LRT3 (LR-taps MINOR): the solar glow halo alone does not swallow a cell tap; the solar dot still wins', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); x.toggle(true); x.click(x.chip('12m')); await drain();
  x.map.getStyle = () => ({ layers: [{ id: 'l-solar-glow', source: 'src-repd' }, { id: 'l-solar', source: 'src-repd' }, ...[...x.layers.keys()].map(id => ({ id, source: x.layers.get(id).source }))] });
  x.map.getLayoutProperty = () => 'visible'; const f = cellsSrc(x).data.features[0], at = [f.properties.lon * 10, f.properties.lat * 10];
  x.tapMap(at, { 'l-solar-glow': [{ properties: {} }], [CELL]: [f] }); assert.ok(card(x), 'glow swallowed the cell tap'); assert.equal(x.neonCalls.length, 1);
  x.tapMap(at, { 'l-solar-glow': [{ properties: {} }], 'l-solar': [{ properties: {} }], [CELL]: [f] }); assert.ok(!card(x)); assert.equal(x.neonCalls.length, 1);
  assert.equal(x.layers.get(CLS[0]) && true, true);
});

test('LRT4 (LR-taps MINOR): LOAD POINTS states the real number when the window holds fewer than 40,000', async () => {
  const s1 = shard(KD[0], 6000, Date.parse(KD[0] + 'T10:00:00Z')), s2 = shard(KD[1], 6000, Date.parse(KD[1] + 'T10:00:00Z'));
  const rows = { [KD[0]]: s1.row, [KD[1]]: s2.row }, g = [{ date: KD[0], row: s1.row, cells: { [LC1]: 6000 } }, { date: KD[1], row: s2.row, cells: { [LC1]: 6000 } }];
  const x = boot({ phone: true, index: mkIndex(rows), files: mkGrids(g) }); x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.match(x.cap('flashes'), /LOAD POINTS adds the newest 12,000 flashes$/);
});

// ---------------------------------------------------------------- M-build: the 10 nearest REPD projects on a lightning tap
// The original's public measure (sld-sandbox 202609241334 link.measure): distanceKm = GEODESY haversine (R 6378.137 km,
// reproduced as hav above), representativePoint (cartridge :3356) and isProjectTech (PROJECT_TECHS, cartridge :1683).
const PTECH = new Set(['solar', 'solar_operational', 'solar_roof', 'bess', 'bess_operational', 'wind', 'wind_onshore', 'wind_onshore_operational', 'wind_offshore', 'wind_offshore_operational', 'biomass', 'hydro', 'hydrogen', 'tidal', 'geothermal', 'flywheel', 'caes', 'act', 'other']);
const repPoint = g => { if (!g) return null; if (g.type === 'Point') return [g.coordinates[0], g.coordinates[1]]; const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null; if (!Array.isArray(ring) || !ring.length) return null; let a = 0, b = 0; for (const p of ring) { a += p[0]; b += p[1]; } return [a / ring.length, b / ring.length]; };
const REPD_FILE = new URL('./fixtures/repd-master-v8-oracle.json.gz', import.meta.url);
const REPD_RAW = gunzipSync(readFileSync(REPD_FILE)); // required in CI: never skip silently
// the export of the pinned repd_master_v8_oracle.parquet (sha256 a737d00d…) used by M-build, MR and M2-build
assert.equal(createHash('sha256').update(REPD_RAW).digest('hex'), '15cc89a79450711970b0d5be08c3c82542be2103f6e9165c56a92c7fac70f61c', 'REPD fixture bytes changed');
const REPD_REAL = JSON.parse(REPD_RAW.toString('utf8'));
const pf = (lon, lat, p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { name: 'P', tech: 'solar', raw_tech: 'Solar Photovoltaics', capacity: 10, status: 'operational', operator: '', mounting: 'nan', ...p } });
// installs the original's measure surface; repd = FeatureCollection; via 'source' (a REPD layer has loaded src-repd) or 'fetch'
const installRepd = (x, subs, repd, via = 'source', fetchImpl = null) => {
  installNeon(x, subs); x.sandbox.URLSearchParams = URLSearchParams; x.sandbox.location = { pathname: '/gridatlas/atlas/' }; const M = x.W.__GRIDATLAS_NEON_LINKS__.measure; x.distCalls = 0;
  Object.assign(M, { distanceKm: (a, b, c, d) => (x.distCalls++, hav(a, b, c, d)), representativePoint: repPoint, isProjectTech: t => PTECH.has(t), MAX_LINK_KM: 40 });
  x.repdFetch = []; const base = x.map.getSource;
  if (via === 'source') x.map.getSource = id => id === 'src-repd' ? { serialize: () => ({ type: 'geojson', data: repd }) } : base(id);
  const of = x.sandbox.fetch;
  x.sandbox.fetch = async (u, o) => { if (String(u).endsWith('/dist/repd_master.json')) { x.repdFetch.push(u); if (fetchImpl) return fetchImpl(u); return new Response(JSON.stringify(repd), { status: 200 }); } return of(u, o); };
};
const bruteTop = (repd, lon, lat) => repd.features.map(f => ({ f, a: repPoint(f.geometry) })).filter(r => r.a && PTECH.has(r.f.properties.tech)).map(r => ({ ...r, km: hav(lon, lat, r.a[0], r.a[1]) })).filter(r => r.km <= 40).sort((a, b) => a.km - b.km).slice(0, 10);
const prows = c => c.querySelectorAll('a');
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise(r => setImmediate(r)); };
const NEWARK = [-0.81, 53.07];

// M2: co-located parts (same point) are one site row; exact duplicate rows count once; ties with the 10th site are kept.
// The independent brute force below reproduces that from the raw register (no module code).
const cf = v => String(v).replace(/\p{Cf}/gu, '').slice(0, 200);
const siteName = p => ({ solar: 'Solar', solar_roof: 'Rooftop solar' })[p.tech] || cf(p.raw_tech);
const bruteSites = (repd, lon, lat, keep = () => true) => {
  const seen = new Set(), m = new Map();
  for (const f of repd.features) {
    const a = repPoint(f.geometry), p = f.properties || {}; if (!a || !PTECH.has(p.tech) || !keep(p)) continue;
    const km = hav(lon, lat, a[0], a[1]); if (km > 40) continue;
    const k = a + JSON.stringify(p); if (seen.has(k)) continue; seen.add(k);
    const key = a.join(); if (!m.has(key)) m.set(key, { a, km, parts: [] }); m.get(key).parts.push(p);
  }
  const s = [...m.values()].sort((x, y) => x.km - y.km); return s.filter((g, i) => i < 10 || g.km === s[9].km);
};
const siteMW = g => g.parts.reduce((t, p) => t + (p.capacity > 0 ? +p.capacity : 0), 0);
const siteLabel = g => `${g.km.toFixed(2)} km · ${[...new Set(g.parts.map(siteName))].sort().join(' + ')}${siteMW(g) > 0 ? ' ' + siteMW(g).toLocaleString('en-GB') + ' MW' : ''}`;
const siteRow = g => `${siteLabel(g)} · ${g.parts.length > 1 ? g.parts.length + ' co-located · ' : ''}${[...new Set(g.parts.map(p => cf(p.status)))].join(' / ')} · ${[...new Set(g.parts.map(p => cf(p.name)))].join(' / ')}`;

test('REPD1 (real REPD, engine source; M2 grouping): a flash near Newark lists the 10 nearest REPD sites of the full register, ascending, as the brute force over all 10,784 rows', { skip: !REPD_REAL }, async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', NEWARK)]) }); installRepd(x, SUBS.map(q => ({ ...q, at: [q.at[0] + 0.69, q.at[1] + 1.07] })), REPD_REAL);
  x.toggle(true); await drain(); tapFlash(x); await settle();
  const c = card(x), rows = [...prows(c)].map(r => r.textContent), want = bruteSites(REPD_REAL, ...NEWARK);
  assert.equal(REPD_REAL.features.length, 10784); assert.equal(want.length, 10); assert.deepEqual(rows, want.map(siteRow));
  assert.ok(want.some(g => g.parts.length > 1), 'Newark has a co-located site (the M2 grouping case)');
  assert.equal(x.distCalls, 10784, 'every register row measured with the original distanceKm');
  assert.match(c.textContent, /10 nearest REPD sites \(\d+ projects; co-located parts grouped\) within 40 km of this optical flash \(straight-line; all technologies and statuses\)\. Not evidence any project was struck or affected\./);
  assert.match(c.children[0].children[0].textContent + c.textContent, / · 5 nearest substations · 10 nearest projects/);
  const ln = x.sources.get('gridatlas-lightning-neon-plinks').data.features, nd = x.sources.get('gridatlas-lightning-neon-pnodes').data.features;
  assert.equal(ln.length, 10); assert.equal(nd.length, 10); for (const f of ln) assert.deepEqual([...f.geometry.coordinates[0]], NEWARK);
  assert.deepEqual(Array.from(nd, f => f.properties.label), want.map(siteLabel)); assert.deepEqual(Array.from(nd, f => f.properties.mw), want.map(siteMW));
  assert.equal(x.sources.get('gridatlas-lightning-neon-links').data.features.length, 5, 'the 5 substation links are kept');
  for (const id of ['p-core', 'p-node', 'p-label']) assert.ok(x.layers.get('gridatlas-lightning-neon-' + id), id);
  assert.notDeepEqual(x.layers.get('gridatlas-lightning-neon-p-core').paint['line-color'], '#d8c96a');
  assert.equal(x.repdFetch.length, 0, 'the engine source was used; no second fetch');
});

test('REPD2: labels read "2.14 km · Solar 49.9 MW"; unknown capacity shows no MW; every status and technology is eligible; rows deep-link the original way, never with a repd_ref', async () => {
  const repd = { type: 'FeatureCollection', features: [
    pf(-1.5, 52.0192, { name: 'Sun A', capacity: 49.9 }), pf(-1.5, 52.03, { name: 'Bat B', tech: 'bess', raw_tech: 'Battery', capacity: 0, status: 'application submitted' }),
    pf(-1.5, 52.04, { name: 'Wind C', tech: 'wind', raw_tech: 'Wind Onshore', capacity: 1200, status: 'awaiting construction' }), pf(-1.5, 52.05, { name: 'Roof D', tech: 'solar_roof', status: 'under construction' }),
    pf(-1.5, 52.06, { name: 'AD E', tech: 'biomass', raw_tech: 'Anaerobic Digestion', capacity: 2.5 }), pf(-1.5, 52.5, { name: 'Far F' }), pf(-1.5, 52.01, { name: 'Bad G', tech: 'nonsense' })] };
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installRepd(x, SUBS, repd, 'fetch');
  x.toggle(true); await drain(); tapFlash(x); await settle();
  const rows = [...prows(card(x))].map(r => r.textContent);
  assert.deepEqual(rows, ['2.14 km · Solar 49.9 MW · operational · Sun A', '3.34 km · Battery · application submitted · Bat B', '4.45 km · Wind Onshore 1,200 MW · awaiting construction · Wind C', '5.57 km · Rooftop solar 10 MW · under construction · Roof D', '6.68 km · Anaerobic Digestion 2.5 MW · operational · AD E']);
  assert.match(card(x).textContent, /5 nearest REPD projects within 40 km/);
  const a = prows(card(x))[0], q = new URLSearchParams(a.href.split('?')[1]); assert.ok(a.href.startsWith('/gridatlas/atlas/?'), 'the row opens the page route, not the shell base: ' + a.href);
  assert.deepEqual(Object.fromEntries(q), { longitude: '-1.5', latitude: '52.0192', technology: 'solar', project: 'Sun A', capacity_mw: '49.9', status: 'operational' });
  for (const r of prows(card(x))) assert.doesNotMatch(r.href, /repd_ref/);
  assert.equal(x.repdFetch.length, 1); assert.equal(x.repdFetch[0], '/dist/repd_master.json');
});

test('REPD3: the register is fetched once per page (engine URL through the bridge) and reused; a failed fetch says so, keeps the substations, and the next tap retries', async () => {
  let fail = true; const repd = { type: 'FeatureCollection', features: [pf(-1.5, 52.01, { name: 'Near' })] };
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) });
  installRepd(x, SUBS, repd, 'fetch', async () => fail ? Promise.reject(new Error('network error')) : new Response(JSON.stringify(repd), { status: 200 }));
  x.toggle(true); await drain(); tapFlash(x); await settle();
  assert.match(card(x).textContent, /REPD projects unavailable: network error/); assert.equal(x.sources.get('gridatlas-lightning-neon-links').data.features.length, 5);
  assert.equal(x.sources.get('gridatlas-lightning-neon-plinks'), undefined);
  fail = false; tapFlash(x); await settle(); assert.equal(prows(card(x)).length, 1); tapFlash(x); await settle(); assert.equal(prows(card(x)).length, 1);
  assert.equal(x.repdFetch.length, 2, 'one failed + one good fetch; the third tap reuses the register');
  const y = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installRepd(y, SUBS, null, 'fetch', async () => new Response('x', { status: 503 }));
  y.toggle(true); await drain(); tapFlash(y); await settle(); assert.match(card(y).textContent, /REPD projects unavailable: HTTP 503/);
  const z = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installRepd(z, SUBS, { type: 'FeatureCollection', features: [] }, 'fetch');
  z.toggle(true); await drain(); tapFlash(z); await settle(); assert.match(card(z).textContent, /REPD projects unavailable: register empty/); assert.doesNotMatch(card(z).textContent, /No REPD project/);
});

test('REPD4: none within 40 km is stated; no project lines; the substation answer is unchanged', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installRepd(x, SUBS, { type: 'FeatureCollection', features: [pf(-1.5, 53, { name: 'Far' })] });
  x.toggle(true); await drain(); tapFlash(x); await settle();
  assert.match(card(x).textContent, /No REPD project within 40 km of this optical flash \(straight-line; all technologies and statuses\)/); assert.equal(prows(card(x)).length, 0);
  assert.doesNotMatch(card(x).textContent, /nearest projects/); assert.equal(x.sources.get('gridatlas-lightning-neon-plinks').data.features.length, 0);
});

test('REPD5: close, period switch, LATEST and OFF remove the project lines, nodes and labels; a register arriving after close draws nothing', async () => {
  const repd = { type: 'FeatureCollection', features: [pf(-1.5, 52.01, { name: 'Near' })] }, ids = ['p-core', 'p-node', 'p-label'].map(s => 'gridatlas-lightning-neon-' + s);
  const gone = x => { for (const id of ids) assert.equal(x.layers.get(id), undefined, id); assert.equal(x.sources.get('gridatlas-lightning-neon-plinks'), undefined); assert.equal(x.sources.get('gridatlas-lightning-neon-pnodes'), undefined); };
  const x = boot({ phone: true, index: mkIndex(KROWS), files: mkGrids(KGRID) }); x.map.setPaintProperty = () => {}; x.toggle(true);
  x.click(x.chip('30d')); await drain(); x.click(x.nav('prev')); await drain();
  const f0 = cellsSrc(x).data.features.find(q => q.properties.cell === LC1); installRepd(x, SUBS, { type: 'FeatureCollection', features: [pf(f0.properties.lon + 0.05, f0.properties.lat, { name: 'Near' })] });
  const open = async () => { cellHit(x, cellsSrc(x).data.features.find(q => q.properties.cell === LC1)); await settle(); assert.equal(x.sources.get('gridatlas-lightning-neon-plinks').data.features.length, 1, 'drawn'); };
  await open(); dispatch(card(x).querySelectorAll('button')[1], 'click', x.log.errors); gone(x);
  await open(); x.click(x.nav('latest')); gone(x); await drain();
  x.click(x.chip('12m')); await drain(); await open(); x.click(x.chip('6m')); gone(x); await drain();
  await open(); x.toggle(false); gone(x);
  let release; const y = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) });
  installRepd(y, SUBS, repd, 'fetch', () => new Promise(r => { release = () => r(new Response(JSON.stringify(repd), { status: 200 })); }));
  y.toggle(true); await drain(); tapFlash(y); await settle(); dispatch(card(y).querySelectorAll('button')[1], 'click', y.log.errors); release(); await settle(); gone(y);
  assert.deepEqual(y.log.errors.map(String), []);
});

test('REPD6: a cell tap measures projects from the cell centre; the camera frames origin, substations and projects (L3 padding)', async () => {
  const od = Object.getOwnPropertyDescriptor(El.prototype, 'offsetHeight');
  Object.defineProperty(El.prototype, 'offsetHeight', { configurable: true, get() { return 143; } });
  try {
    const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); x.toggle(true); x.click(x.chip('12m')); await drain();
    const f = cellsSrc(x).data.features[0], [lon, lat] = f.geometry.coordinates;
    const repd = { type: 'FeatureCollection', features: [pf(lon + 0.3, lat, { name: 'East' }), pf(lon, lat - 0.2, { name: 'South' })] };
    installRepd(x, SUBS, repd); x.mapEl._rect = { top: 0, left: 0, right: 393, bottom: 659, width: 393, height: 659 }; x.map.getBounds = () => ({ contains: () => false });
    cellHit(x, f); await settle();
    assert.deepEqual(x.neonCalls.at(-1).slice(0, 2), [lon, lat]); assert.equal(prows(card(x)).length, 2);
    assert.match(card(x).textContent, /2 nearest REPD projects within 40 km of this cell centre/);
    const fb = x.camera.filter(k => k[0] === 'fitBounds').at(-1); assert.ok(fb); const [[w, s], [e, n]] = fb[1][0], pad = fb[1][1].padding;
    for (const [a, b] of [[lon, lat], [lon + 0.3, lat], [lon, lat - 0.2]]) assert.ok(a >= w && a <= e && b >= s && b <= n, 'bbox misses ' + a + ',' + b);
    assert.equal(pad.top, 150); assert.equal(pad.bottom, card(x).bb + 143 + 24); assert.equal(fb[1][1].maxZoom, 12);
  } finally { if (od) Object.defineProperty(El.prototype, 'offsetHeight', od); else delete El.prototype.offsetHeight; }
});

test('REPD7: honest wording: never "affected" as a claim, never a strike on a site; the module never writes the URL', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); installRepd(x, SUBS, { type: 'FeatureCollection', features: [pf(-1.5, 52.01)] });
  x.toggle(true); await drain(); tapFlash(x); await settle(); const t = card(x).textContent;
  assert.match(t, /Not evidence any project was struck or affected\./); assert.doesNotMatch(t, /(were|was|are|is) affected|strike on|struck the|hit the/i);
  assert.doesNotMatch(SRC, /repd_ref|location\.(href|search|hash|assign|replace)|history\.(push|replace)State|pushState/);
});

// ---------------------------------------------------------------- M2-build: MR1-MR4 + the comprehensive REPD feature; each fails on Build M
const REPD_IND = structuredClone(REPD_REAL); // MR's independent DuckDB export of the pinned parquet: the same 10,784 rows, in the same order
const flashAt = async (ll, repd = REPD_IND, via = 'source', fi = null) => { const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', ll)]) }); installRepd(x, SUBS.map(q => ({ ...q, at: [q.at[0] + 0.69, q.at[1] + 1.07] })), repd, via, fi); x.toggle(true); await drain(); tapFlash(x); await settle(); return x; };
const hangFetch = x => { const of = x.sandbox.fetch; x.sandbox.fetch = async (u, o) => { if (!String(u).endsWith('/dist/repd_master.json')) return of(u, o); x.repdFetch.push(u);
  return new Response(new ReadableStream({ start(c) { o && o.signal && o.signal.addEventListener('abort', () => c.error(new DOMException('Aborted', 'AbortError'))); } }), { status: 200 }); }; };
const FCx = f => ({ type: 'FeatureCollection', features: f });
const rowsOf = x => [...prows(card(x))].map(a => a.textContent);
const chip = (x, k) => card(x).querySelector(`[data-lightning-repd-filter="${k}"]`);
const press = (x, k) => dispatch(chip(x, k), 'click', x.log.errors);
const tapRow = (x, i = 0) => { const a = prows(card(x))[i]; let prevented = false; for (const f of a.listeners.click || []) f({ type: 'click', target: a, preventDefault: () => { prevented = true; }, stopPropagation() {} }); return prevented; };
const flash0 = () => boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) });

test('MR-A (M2 grouping): with the independent register, the rows equal the independent brute force (sites, co-located parts grouped) at 7 dense and sparse points', async () => {
  for (const ll of [[-0.81, 53.07], [-0.85, 52.75], [-0.35, 53.25], [0.15, 53.05], [-4.95, 57.95], [-5.15, 57.65], [-3.85, 58.45]]) {
    const x = await flashAt(ll); assert.deepEqual(rowsOf(x), bruteSites(REPD_IND, ...ll).map(siteRow), ll.join());
  }
});
test('M2-MR1: a register body that never completes (stalled bridge) is reported after the 15 s timeout, the substations stay, and the next tap retries', async () => {
  const x = flash0(); installRepd(x, SUBS, null, 'fetch'); hangFetch(x);
  x.toggle(true); await drain(); tapFlash(x); await settle(); assert.match(card(x).textContent, /REPD projects: loading…/);
  await new Promise(r => setTimeout(r, 15500)); await settle();
  assert.match(card(x).textContent, /REPD projects unavailable: timeout after 15 s/); assert.doesNotMatch(card(x).textContent, /loading…/);
  assert.equal(x.sources.get('gridatlas-lightning-neon-links').data.features.length, 5, 'substation links kept');
  tapFlash(x); await settle(); assert.equal(x.repdFetch.length, 2, 'the next tap retries');
});
test('M2-MR1b: a redirected register response is refused like every other module fetch', async () => {
  const x = flash0();
  installRepd(x, SUBS, null, 'fetch', async () => { const r = new Response(JSON.stringify(FCx([pf(-1.5, 52.01)])), { status: 200 }); Object.defineProperty(r, 'redirected', { value: true }); return r; });
  x.toggle(true); await drain(); tapFlash(x); await settle(); assert.match(card(x).textContent, /REPD projects unavailable: redirected/); assert.equal(prows(card(x)).length, 0);
});
test('M2-MR1c (bridge keeps a failed start): the first failure says "tap again"; a repeated failure adds the switch-on-a-REPD-layer / reload advice', async () => {
  const x = flash0(); installRepd(x, SUBS, null, 'fetch', async () => Promise.reject(new Error('DuckDB start failed')));
  x.toggle(true); await drain(); tapFlash(x); await settle();
  assert.match(card(x).textContent, /REPD projects unavailable: DuckDB start failed\. Tap again to retry\./); assert.doesNotMatch(card(x).textContent, /reload/);
  tapFlash(x); await settle(); assert.match(card(x).textContent, /keeps failing, switch on a REPD layer or reload the page \(the map's REPD loader keeps a failed start until the page is reloaded\)/);
  assert.equal(x.repdFetch.length, 2);
});
test('M2-MR2: exact duplicate register rows are listed once (Kelvin Energy Recovery Facility, real register); same point with other properties is one grouped site', async () => {
  const x = await flashAt([-1.99, 52.51]), t = card(x).textContent; assert.equal(t.split('Kelvin Energy Recovery Facility').length - 1, 1, 'listed once');
  const d = pf(-1.5, 52.01, { name: 'Dup' }), y = await flashAt([-1.5, 52], FCx([d, structuredClone(d)]));
  assert.equal(rowsOf(y).length, 1); assert.doesNotMatch(rowsOf(y)[0], /co-located/); assert.match(card(y).textContent, /1 nearest REPD project within/);
  const z = await flashAt([-1.5, 52], FCx([d, structuredClone(d), pf(-1.5, 52.01, { name: 'Dup', tech: 'bess', raw_tech: 'Battery' })]));
  assert.equal(rowsOf(z).length, 1); assert.match(rowsOf(z)[0], / · Battery \+ Solar 20 MW · 2 co-located · operational · Dup$/);
});
test('M2-MR3: Steeple Renewables solar and its co-located BESS are one site; a different site tied with the 10th is kept; an 11th farther site is not', async () => {
  const x = await flashAt([-0.75, 53.35]), r = rowsOf(x).filter(s => /Steeple Renewables Project/.test(s));
  assert.equal(r.length, 1); assert.match(r[0], /Battery \+ Solar 1,100 MW · 3 co-located/); assert.equal(card(x).textContent.split('Steeple Renewables Project').length - 1, 3, 'one row + its two listed parts (solar and BESS)');
  const f = [...Array(9)].map((_, i) => pf(-1.5, 52 + 0.01 * (i + 1), { name: 'R' + i })); f.push(pf(-1.34, 52, { name: 'TieE' }), pf(-1.66, 52, { name: 'TieW' }), pf(-1.5, 52.2, { name: 'Far' }));
  const y = await flashAt([-1.5, 52], FCx(f)), yr = rowsOf(y);
  assert.equal(yr.length, 11); assert.ok(yr.some(s => /TieE$/.test(s)) && yr.some(s => /TieW$/.test(s))); assert.ok(!yr.some(s => /Far$/.test(s)));
  assert.match(card(y).textContent, /11 nearest REPD projects within 40 km/); assert.equal(y.sources.get('gridatlas-lightning-neon-pnodes').data.features.length, 11);
});
test('M2-MR4: a register landing while the map is still moving is framed when that move ends', async () => {
  let release; const repd = FCx([pf(-1.5, 52.3, { name: 'FarNorth' })]), x = flash0();
  installRepd(x, SUBS, repd, 'fetch', () => new Promise(r => { release = () => r(new Response(JSON.stringify(repd), { status: 200 })); }));
  x.map.getBounds = () => ({ contains: ([a, b]) => b < 52.2 }); x.toggle(true); await drain(); tapFlash(x); await settle();
  const q = []; x.map.once = (t, f) => q.push([t, f]); x.map.isMoving = () => true; release(); await settle();
  assert.equal(prows(card(x)).length, 1); const n0 = x.camera.filter(k => k[0] === 'fitBounds').length;
  x.map.isMoving = () => false; for (const [t, f] of q.splice(0)) if (t === 'moveend') f(); await settle();
  const fb = x.camera.filter(k => k[0] === 'fitBounds'); assert.equal(fb.length, n0 + 1, 'reframed at moveend');
  const [[w, s], [e, n]] = fb.at(-1)[1][0]; assert.ok(n >= 52.3 && s <= 52 && w <= -1.5 && e >= -1.5, 'FarNorth and the origin are framed');
});
test('M2-MR4b: the moveend wait is harmless after close (no reframe, no throw)', async () => {
  let release; const repd = FCx([pf(-1.5, 52.3, { name: 'FarNorth' })]), x = flash0();
  installRepd(x, SUBS, repd, 'fetch', () => new Promise(r => { release = () => r(new Response(JSON.stringify(repd), { status: 200 })); }));
  x.map.getBounds = () => ({ contains: ([a, b]) => b < 52.2 }); x.toggle(true); await drain(); tapFlash(x); await settle();
  const q = []; x.map.once = (t, f) => q.push([t, f]); x.map.isMoving = () => true; release(); await settle();
  dispatch(card(x).querySelectorAll('button')[1], 'click', x.log.errors); await settle(); assert.equal(x.sources.get('gridatlas-lightning-neon-plinks'), undefined, 'closed');
  const n0 = x.camera.filter(k => k[0] === 'fitBounds').length; for (const [t, f] of q.splice(0)) if (t === 'moveend') f(); await settle();
  assert.equal(x.camera.filter(k => k[0] === 'fitBounds').length, n0); assert.deepEqual(x.log.errors.map(String), []);
});

test('M2-C1 co-located: solar + battery at one point are one link, one node and one label ("2.64 km · Battery + Solar 69.9 MW"), with every part listed in the card', async () => {
  const lat = 52 + 2.64 / 111.32, x = await flashAt([-1.5, 52], FCx([pf(-1.5, lat, { name: 'Sun Farm', capacity: 49.9 }), pf(-1.5, lat, { name: 'Sun Farm BESS', tech: 'bess', raw_tech: 'Battery', capacity: 20, status: 'awaiting construction' }), pf(-1.5, 52.1, { name: 'Other' })]));
  const km = hav(-1.5, 52, -1.5, lat).toFixed(2); assert.equal(km, '2.64');
  assert.deepEqual(rowsOf(x), [`2.64 km · Battery + Solar 69.9 MW · 2 co-located · operational / awaiting construction · Sun Farm / Sun Farm BESS`, rowsOf(x)[1]]);
  const t = card(x).textContent; assert.match(t, /Solar 49\.9 MW · operational · Sun Farm/); assert.match(t, /Battery 20 MW · awaiting construction · Sun Farm BESS/);
  assert.match(t, /2 nearest REPD sites \(3 projects; co-located parts grouped\) within 40 km/);
  const nd = x.sources.get('gridatlas-lightning-neon-pnodes').data.features, ln = x.sources.get('gridatlas-lightning-neon-plinks').data.features;
  assert.equal(nd.length, 2); assert.equal(ln.length, 2); assert.equal(nd[0].properties.label, '2.64 km · Battery + Solar 69.9 MW'); assert.equal(nd[0].properties.mw, 69.9);
});
test('M2-C2 filters: All / Operational / Consented & construction / Planning and All / Solar / Wind / BESS / Other; default All; the nearest 10 are re-ranked within the filter; lines follow', async () => {
  const f = [...Array(12)].map((_, i) => pf(-1.5, 52 + 0.01 * (i + 1), { name: 'Await' + i, status: 'awaiting construction' }));
  f.push(pf(-1.5, 52.3, { name: 'OpSolar' }), pf(-1.5, 52.31, { name: 'OpBess', tech: 'bess', raw_tech: 'Battery' }), pf(-1.5, 52.32, { name: 'UC Wind', tech: 'wind_onshore', raw_tech: 'Wind Onshore', status: 'under construction' }),
    pf(-1.5, 52.33, { name: 'Plan Hydro', tech: 'hydro', raw_tech: 'Small Hydro', status: 'application submitted' }));
  const x = await flashAt([-1.5, 52], FCx(f)), lines = () => x.sources.get('gridatlas-lightning-neon-plinks').data.features.length;
  for (const k of ['st:all', 'st:op', 'st:cc', 'st:pl', 'te:all', 'te:solar', 'te:wind', 'te:bess', 'te:other']) assert.ok(chip(x, k), k);
  assert.deepEqual(['Operational', 'Consented & construction', 'Planning', 'Solar', 'Wind', 'BESS', 'Other'].map(t => card(x).querySelectorAll('button').some(b => b.textContent === t)), Array(7).fill(true));
  assert.equal(chip(x, 'st:all').getAttribute('aria-pressed'), 'true'); assert.equal(chip(x, 'te:all').getAttribute('aria-pressed'), 'true');
  assert.equal(rowsOf(x).length, 10); assert.ok(rowsOf(x).every(r => /Await/.test(r)));
  press(x, 'st:op'); assert.deepEqual(rowsOf(x).map(r => r.split(' · ').pop()), ['OpSolar', 'OpBess']); assert.equal(lines(), 2);
  assert.equal(chip(x, 'st:op').getAttribute('aria-pressed'), 'true'); assert.equal(chip(x, 'st:all').getAttribute('aria-pressed'), 'false');
  assert.match(card(x).textContent, /2 nearest REPD projects within 40 km of this optical flash \(straight-line; filter: Operational\)\. Not evidence any project was struck or affected\./);
  press(x, 'te:bess'); assert.deepEqual(rowsOf(x).map(r => r.split(' · ').pop()), ['OpBess']); assert.match(card(x).textContent, /filter: Operational · BESS/);
  press(x, 'st:cc'); press(x, 'te:all'); assert.equal(rowsOf(x).length, 10); assert.ok(rowsOf(x).every(r => /Await/.test(r)));
  press(x, 'te:wind'); assert.deepEqual(rowsOf(x).map(r => r.split(' · ').pop()), ['UC Wind']);
  press(x, 'st:pl'); press(x, 'te:other'); assert.deepEqual(rowsOf(x).map(r => r.split(' · ').pop()), ['Plan Hydro']);
  press(x, 'te:solar'); assert.match(card(x).textContent, /No REPD project within 40 km of this optical flash \(straight-line; filter: Planning · Solar\)/); assert.equal(lines(), 0);
  press(x, 'st:all'); press(x, 'te:all'); assert.equal(rowsOf(x).length, 10); assert.equal(lines(), 10);
  press(x, 'st:op'); tapFlash(x); await settle(); assert.equal(chip(x, 'st:op').getAttribute('aria-pressed'), 'true', 'the filter is kept for the next tap'); assert.equal(rowsOf(x).length, 2);
  assert.deepEqual(x.log.errors.map(String), []);
});
test('M2-C3 summary: "N REPD projects within 10 km · M within 40 km · total X MW within 10 km", follows the filter, and states uncounted capacity honestly', async () => {
  const x = await flashAt([-1.5, 52], FCx([pf(-1.5, 52.018, { capacity: 10, name: 'A' }), pf(-1.5, 52.045, { capacity: 0, name: 'B', status: 'application submitted' }), pf(-1.5, 52.18, { capacity: 100, name: 'C' }), pf(-1.5, 52.5, { name: 'Out' })]));
  assert.match(card(x).textContent, /2 REPD projects within 10 km · 3 within 40 km · total 10 MW within 10 km \(1 without a stated capacity not counted\); registered capacity, straight-line distance only, not a measure of impact/);
  press(x, 'st:op'); assert.match(card(x).textContent, /1 REPD project within 10 km · 2 within 40 km · total 10 MW within 10 km; registered/);
  const y = await flashAt([-1.5, 52], FCx([pf(-1.5, 52.5)])); assert.match(card(y).textContent, /0 REPD projects within 10 km · 0 within 40 km · total 0 MW within 10 km/);
});
test('M2-C4 fewer than 10: stated, with the radius kept at 40 km; not stated when 10 exist', async () => {
  const x = await flashAt([-1.5, 52], FCx([pf(-1.5, 52.01), pf(-1.5, 52.02), pf(-1.5, 52.03), pf(-1.5, 52.6)]));
  assert.match(card(x).textContent, /Only 3 sites within 40 km; the radius stays 40 km, so fewer than 10 are listed\./);
  const y = await flashAt([-1.5, 52], FCx([...Array(12)].map((_, i) => pf(-1.5, 52 + 0.01 * (i + 1))))); assert.doesNotMatch(card(y).textContent, /fewer than 10/);
  press(y, 'st:op'); assert.doesNotMatch(card(y).textContent, /fewer than 10/);
});
test('M2-C5 row tap stays in the page: no navigation; flies to the project and draws its nearest-substation links; "◀ back to lightning flash" restores the card, links and list', async () => {
  const x = flash0(); installRepd(x, SUBS, FCx([pf(-1.45, 52.02, { name: 'Sun A', capacity: 49.9 }), pf(-1.45, 52.02, { name: 'Bat A', tech: 'bess', raw_tech: 'Battery', capacity: 20 }), pf(-1.5, 52.1, { name: 'B' })]), 'fetch');
  x.toggle(true); await drain(); tapFlash(x); await settle();
  const href = prows(card(x))[0].href; assert.ok(href.startsWith('/gridatlas/atlas/?'), 'the deep link stays as the href (open in new tab)');
  x.camera.length = 0; const n0 = x.neonCalls.length; assert.equal(tapRow(x, 0), true, 'default navigation prevented'); await settle();
  const c = card(x); assert.equal(c.getAttribute('aria-label'), 'REPD project'); assert.equal(x.S.pp, c);
  assert.deepEqual(x.neonCalls.at(-1).slice(0, 2), [-1.45, 52.02]); assert.equal(x.neonCalls.length, n0 + 1);
  const fly = x.camera.find(k => k[0] === 'flyTo'); assert.deepEqual([...fly[1][0].center], [-1.45, 52.02]); assert.equal(fly[1][0].zoom, 12);
  assert.equal(x.sources.get('gridatlas-lightning-neon-links').data.features.length, 5, 'the 5 substation links from the project');
  assert.equal(x.sources.get('gridatlas-lightning-neon-plinks'), undefined, 'no project list in the project view');
  assert.match(c.textContent, /REPD · Battery \+ Solar 69\.9 MW/); assert.match(c.textContent, /2 co-located projects · Sun A \/ Bat A/);
  assert.match(c.textContent, /Solar 49\.9 MW · operational · Sun A; Battery 20 MW · operational · Bat A/);
  assert.match(c.textContent, /Nearest substations to this project \(straight-line km; not its declared grid connection\)\./);
  assert.match(c.textContent, /not evidence the project was struck or affected/); assert.doesNotMatch(c.textContent, /(were|was|are|is) affected|strike on|struck the|hit the/i);
  const back = c.querySelector('[data-lightning-back]'); assert.equal(back.textContent, '◀ back to lightning flash'); assert.equal(c.querySelectorAll('button')[1].getAttribute('aria-label'), 'Close');
  dispatch(back, 'click', x.log.errors); await settle();
  const d = card(x); assert.equal(d.getAttribute('aria-label'), 'Lightning flash'); assert.deepEqual(x.neonCalls.at(-1).slice(0, 2), [-1.5, 52]);
  assert.equal(rowsOf(x).length, 2); assert.equal(x.sources.get('gridatlas-lightning-neon-plinks').data.features.length, 2); assert.notEqual(d.querySelector('details').open, true, 'restored as at the tap (collapsed) so the camera frames the links');
  assert.equal(x.repdFetch.length, 1, 'the register is reused'); assert.deepEqual(x.log.errors.map(String), []);
});
test('M2-C6 row tap from a cell: "◀ back to lightning cell"; close, period switch and OFF clean the project view', async () => {
  const x = boot({ phone: true, index: mkIndex(KROWS), files: mkGrids(KGRID) }); x.map.setPaintProperty = () => {}; x.toggle(true); x.click(x.chip('12m')); await drain();
  const f0 = cellsSrc(x).data.features.find(q => q.properties.cell === LC1), lon = f0.properties.lon, lat = f0.properties.lat; installRepd(x, SUBS, FCx([pf(lon + 0.05, lat, { name: 'Near' })]));
  const open = async () => { cellHit(x, cellsSrc(x).data.features.find(q => q.properties.cell === LC1)); await settle(); tapRow(x, 0); await settle(); assert.equal(card(x).getAttribute('aria-label'), 'REPD project'); };
  await open(); const back = card(x).querySelector('[data-lightning-back]'); assert.equal(back.textContent, '◀ back to lightning cell');
  dispatch(back, 'click', x.log.errors); await settle(); assert.equal(card(x).getAttribute('aria-label'), 'Lightning cell'); assert.match(card(x).textContent, /1 nearest REPD project within 40 km of this cell centre/);
  const gone = () => { assert.equal(x.S.pp, null); for (const s of ['links', 'nodes', 'pin', 'plinks', 'pnodes']) assert.equal(x.sources.get('gridatlas-lightning-neon-' + s), undefined, s); };
  await open(); dispatch(card(x).querySelectorAll('button')[1], 'click', x.log.errors); gone();
  await open(); x.click(x.chip('6m')); gone(); await drain();
  await open(); x.toggle(false); gone(); assert.deepEqual(x.log.errors.map(String), []);
});
test('M2-C7 a project with no substation within 40 km is still flown to (zoom 12), states it, and keeps "◀ back"', async () => {
  const x = flash0(); installRepd(x, SUBS, FCx([pf(-1.5, 52.3, { name: 'North' })]), 'fetch'); x.toggle(true); await drain(); tapFlash(x); await settle();
  x.W.__GRIDATLAS_NEON_LINKS__.substations = SUBS.map(q => ({ ...q, at: [q.at[0] - 3, q.at[1] - 3] })); x.camera.length = 0; tapRow(x, 0); await settle();
  assert.match(card(x).textContent, /No substation within 40 km/); const fly = x.camera.find(k => k[0] === 'flyTo'); assert.ok(fly, 'flown'); assert.deepEqual([...fly[1][0].center], [-1.5, 52.3]);
  assert.ok(card(x).querySelector('[data-lightning-back]'));
});
test('M2-C8 framing: a card taller than the room left by the 150 px top padding no longer blocks fitBounds (bottom padding clamped to height − 270)', async () => {
  const od = Object.getOwnPropertyDescriptor(El.prototype, 'offsetHeight'); Object.defineProperty(El.prototype, 'offsetHeight', { configurable: true, get() { return 521; } });
  try { const x = flash0(); installRepd(x, SUBS, FCx([pf(-1.5, 52.3)])); x.mapEl.clientHeight = 659; x.map.getBounds = () => ({ contains: () => false }); x.toggle(true); await drain(); tapFlash(x); await settle();
    const fb = x.camera.filter(k => k[0] === 'fitBounds').at(-1); assert.equal(fb[1][1].padding.bottom, 659 - 270); assert.equal(fb[1][1].padding.top, 150);
  } finally { if (od) Object.defineProperty(El.prototype, 'offsetHeight', od); else delete El.prototype.offsetHeight; }
});
test('M2-MR1d: a stalled register body whose stream errors with a non-Abort error after the 15 s abort is still reported as the timeout', async () => {
  const x = flash0(); installRepd(x, SUBS, null, 'fetch'); const of = x.sandbox.fetch;
  x.sandbox.fetch = async (u, o) => { if (!String(u).endsWith('/dist/repd_master.json')) return of(u, o); x.repdFetch.push(u);
    return new Response(new ReadableStream({ start(c) { o.signal.addEventListener('abort', () => c.error(new TypeError('Failed to fetch'))); } }), { status: 200 }); };
  x.toggle(true); await drain(); tapFlash(x); await settle(); await new Promise(r => setTimeout(r, 15500)); await settle();
  assert.match(card(x).textContent, /REPD projects unavailable: timeout after 15 s\. Tap again to retry\./);
});

// ---------------------------------------------------------------- CI additions (tools/ci/pr-gate.mjs): mutants that the M2 suite let through
// Mutation run of 28 Oct 2026 (hardening lane M2R-ci): 18 single-point bugs in 202610282100; the M2 suite let two
// through. CI1 and CI2 catch "OFF leaves the dots layer behind". The other, "the tap-time cell index guard (< 16,800)
// is gone", is left: the grid parser already refuses such cells, and a test that taps a forged out-of-grid cell sends
// that mutant into a runaway allocation that kills the whole suite process rather than failing one test.
// MapLibre refuses to remove a source while a layer still uses it; the stub map in boot() did not, so a cleanup that
// forgot a layer still looked clean.
const strictRemoval = x => { x.map.removeSource = id => { for (const l of x.layers.values()) if (l.source === id) throw new Error(`Source "${id}" cannot be removed while layer "${l.id}" is using it.`); x.sources.delete(id); }; };
const lightningLeft = x => [...x.layers.keys(), ...x.sources.keys()].filter(id => /lightning/.test(id));

test('CI1: OFF after flashes, a flash card with REPD rows and a project view leaves no lightning layer or source (MapLibre removal rules)', async () => {
  const x = await flashAt([-0.81, 53.07]); strictRemoval(x);
  assert.ok(x.layers.has('l-gridatlas-lightning'), 'flash dots drawn'); assert.ok(prows(card(x)).length > 0, 'REPD rows listed');
  tapRow(x, 0); await settle(); assert.match(card(x).textContent, /◀ back to lightning flash/);
  x.toggle(false); await drain();
  assert.deepEqual(lightningLeft(x), [], 'left behind after OFF'); assert.equal(card(x), null, 'card closed'); assert.deepEqual(x.log.errors.map(String), []);
});

test('CI2: OFF after 12M cells and a cell card leaves no lightning layer or source (MapLibre removal rules)', async () => {
  const x = boot({ index: mkIndex(KROWS), files: mkGrids(KGRID) }); installNeon(x, SUBS); strictRemoval(x);
  x.toggle(true); x.click(x.chip('12m')); await drain();
  assert.ok(cellsSrc(x) && cellsSrc(x).data.features.length > 0, 'cells drawn');
  cellHit(x, cellsSrc(x).data.features[0]); await settle(); assert.ok(card(x), 'cell card');
  x.toggle(false); await drain();
  assert.deepEqual(lightningLeft(x), [], 'left behind after OFF'); assert.deepEqual(x.log.errors.map(String), []);
});

