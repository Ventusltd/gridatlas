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
import { El, makeDocument, dispatch } from './minidom.mjs';

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
function mkIndex(over = {}, top = {}) {
  const now = Date.now(), today = Date.parse(ymd(now) + 'T00:00:00Z'), cutoff = today - 365 * D, days = [];
  for (let t = cutoff; t <= today; t += D) {
    const date = ymd(t);
    days.push(Object.assign({ date, coverage: 'full', scanned_seconds: 86400, count: 0, bytes: null, path: null, sealed: t < today - D, first_observation_utc: null, last_observation_utc: null, sha256: null }, over[date] || {}));
  }
  return Object.assign({ schema: 'uk-lightning-history-index.v2', generated_utc: iso(now - 600e3), next_update_due_utc: iso(now + H), cutoff_date_utc: ymd(cutoff), collection_interval_hours: 1,
    observation: 'satellite optical lightning flashes, not ground strikes', coverage_start_utc: iso(cutoff), scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(now), successful_runs: 999 }], days }, top);
}

function boot({ index = null, feedFn = () => feed([flash(Date.now() - 2 * H, 'f1')]), files = {}, noGrid = false, park = false, bounds = null, dash = null, innerHeight = 852, now = null, lazy = false } = {}) {
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
  const mapLog = []; for (const k of ['addSource','addLayer','removeLayer','removeSource','setLayoutProperty']) { const f = map[k]; map[k] = (...a) => { mapLog.push([k, typeof a[0] === 'string' ? a[0] : a[0] && a[0].id]); return f.apply(map, a); }; }
  for (const k of ['fitBounds', 'flyTo', 'easeTo', 'jumpTo', 'setCenter', 'setZoom', 'panTo']) map[k] = (...a) => camera.push([k, a]);
  if (bounds) map.getBounds = () => ({ contains: ([x, y]) => x >= bounds[0] && y >= bounds[1] && x <= bounds[2] && y <= bounds[3] });
  const log = { fetch: [], xhr: [], intervals: [], errors: [] }, parked = [], winL = {};
  class XHR { open(m, u) { this.url = u; } send() { log.xhr.push(this.url); const d = feedFn(); setTimeout(() => { if (d && d.status) { this.status = d.status; this.onload(); return; } this.status = 200; this.responseText = typeof d === 'string' ? d : JSON.stringify(d); this.onload(); }, 0); } }
  let nIdx = 0;
  const fetch = async url => {
    log.fetch.push(url); await null;
    if (url.endsWith('/history/index.json')) {
      const v = typeof index === 'function' ? await index(++nIdx) : index;
      return v == null ? new Response('nope', { status: 404 }) : new Response(typeof v === 'string' ? v : enc(v), { status: 200 });
    }
    if (park) await new Promise(r => parked.push(r));
    const k = url.split('/history/')[1]; return files[k] ? new Response(files[k], { status: 200 }) : new Response('nope', { status: 404 });
  };
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: !lazy } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const addEventListener = (t, f) => (winL[t] = winL[t] || []).push(f);
  W.addEventListener = addEventListener;
  let D = Date;
  if (now !== null) D = class extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } };
  const sandbox = { window: W, document: doc, Date: D, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: false }),
    MutationObserver: class { observe() {} disconnect() {} }, innerHeight, addEventListener };
  const code = globalThis.__SRC_OVERRIDE ? globalThis.__SRC_OVERRIDE.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S};' + SEAM) : PROBED;
  vm.runInNewContext(code, sandbox, { filename: MODULE, timeout: 5000 });
  const api = W.__GRIDATLAS_MODULES__.ukLightning, probe = W.__PROBE__;
  const installed = lazy ? false : api.install();
  if (!noGrid && !lazy) assert.equal(installed, true, 'install');
  const main = probe.S.sfs[0];
  const click = el => dispatch(el, 'click', log.errors);
  const toggle = on => { const t = main.toggle; t.checked = on; dispatch(t, 'change', log.errors); };
  const cap = k => main.caps[k].textContent;
  const fire = t => { sandbox.innerHeight = W.innerHeight; for (const f of winL[t] || []) f({ type: t }); };
  const release = () => { while (parked.length) parked.shift()(); };
  return { mapLog, mods: W.__GRIDATLAS_MODULES__, winL, installed, doc, grid, api, probe, S: probe.S, log, main, click, toggle, cap, host, orig, pbody, sources, layers, camera, dashEl, W, sandbox, fire, release, parked,
    chip: p => main.chips[p], nav: n => main.nav[n], status: () => main.stx.textContent, label: () => main.label.textContent };
}
const unhandled = [];
process.on('unhandledRejection', e => unhandled.push(e));
const drain = async () => { for (let k = 0; k < 30; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const sha = b => createHash('sha256').update(b).digest('hex');


// ---------------------------------------------------------------- code-review-E repros (SYNTHETIC data, self-fixture, node:vm + minidom, 1440 px desktop)
// Each assertion states the EXPECTED behaviour; a FAIL means the defect is present in MODULE.
const P = d => 'days/' + d.replace(/-/g, '/') + '.json';
const N0 = Date.parse(ymd(Date.now()) + 'T12:00:00Z'); // fixed "now": today 12:00 UTC
const idxAt = (over, sw) => { const i = mkIndex(over, { scan_windows: sw || [{ start_utc: iso(N0 - 400 * D), end_utc: iso(N0 + H), successful_runs: 9 }], generated_utc: iso(N0 - 600e3), next_update_due_utc: iso(N0 + H) }); return i; };

test('E1 floor vs 0.999: status "SEARCHED 100%" and caption percentage agree', async () => {
  const sw = [{ start_utc: iso(N0 - 400 * D), end_utc: iso(N0 - 10 * H), successful_runs: 9 }, { start_utc: iso(N0 - 10 * H + 60e3), end_utc: iso(N0 + H), successful_runs: 9 }];
  const x = boot({ index: idxAt({}, sw), now: N0 }); x.toggle(true); await drain();
  const st = x.status(), cap = x.cap('searched');
  console.log('# E1', JSON.stringify({ state: x.S.last.state, status: st, searched: cap, label: x.label() }));
  const a = /SEARCHED (\d+)%/.exec(st), b = /Searched EUMETSAT (\d+)%/.exec(cap);
  assert.ok(a && b, 'percent missing'); assert.equal(a[1], b[1], 'status and caption disagree');
});

test('E2 T08 on a month-end date: 3M PREV then NEXT returns to the latest window (now = 2026-05-31 12:00 UTC)', async () => {
  for (const now of [Date.parse('2026-05-31T12:00:00Z'), Date.parse('2026-12-31T12:00:00Z')]) {
    const x = boot({ index: mkIndex(), now }); x.toggle(true); x.click(x.chip('3m')); await drain();
    x.click(x.nav('prev')); await drain(); x.click(x.nav('next')); await drain();
    console.log('# E2', iso(now), JSON.stringify({ atLatest: x.S.res.w.atLatest, window: x.cap('window') }));
    assert.equal(x.S.res.w.atLatest, true, iso(now) + ': ' + x.cap('window'));
  }
});

test('E3 parts[] without "hour": index count 3 must never read NO FLASHES DETECTED / EMPTY', async () => {
  const d = ymd(N0 - D);
  const x = boot({ index: idxAt({ [d]: { count: 3, path: null, parts: [{ path: P(d).replace('.json', '/05.json'), count: 3, bytes: 10, sha256: 'x' }] } }), now: N0 });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  console.log('# E3', JSON.stringify({ idx: !!x.S.idx, state: x.S.last && x.S.last.state, status: x.status(), label: x.label(), shardFetches: x.log.fetch.filter(u => u.includes('/days/')).length }));
  assert.doesNotMatch(x.status(), /NO FLASHES/); assert.doesNotMatch(x.label(), /EMPTY/);
});

test('E4 a date with no index row inside a 100%-scanned window must not be EMPTY-COVERED / READY', async () => {
  const i = idxAt({}); const d = ymd(N0 - D); i.days = i.days.filter(r => r.date !== d);
  const x = boot({ index: i, now: N0 }); x.toggle(true); x.click(x.chip('48h')); await drain();
  console.log('# E4', JSON.stringify({ state: x.S.last.state, status: x.status(), warning: x.cap('warning') }));
  assert.ok(!/READY|EMPTY/.test(x.S.last.state), x.S.last.state + ' with warning: ' + x.cap('warning'));
});

test('E5 setOn(true) before install, index pending: install() must not throw and must set the spacer + resize listeners', async () => {
  const x = boot({ lazy: true, index: () => new Promise(() => {}) });
  x.api.setOn(true); await drain(); x.mods.menuBar.installed = true;
  let err = null, ok; try { ok = x.api.install(); } catch (e) { err = e; }
  const g = x.S.sfs[0] && x.S.sfs[0].group;
  console.log('# E5', JSON.stringify({ threw: err && String(err), installed: x.S.installed, groups: x.host.children.length - 1, paddingBottom: g && g.style.paddingBottom, resizeListeners: (x.winL.resize || []).length }));
  assert.equal(err, null); assert.equal(ok, true); assert.ok(g && g.style.paddingBottom, 'spacer'); assert.equal((x.winL.resize || []).length, 1);
});

test('E6 ok(): observation_kind must be the exact string (no array coercion)', () => {
  const x = boot(), f = flash(Date.now() - H, 'a'); f.properties.observation_kind = ['optical_lightning_flash'];
  const g = flash(Date.now() - H, 'b'); g.properties.observation_kind = [['optical_lightning_flash']];
  console.log('# E6', JSON.stringify({ array: x.probe.ok(f), nested: x.probe.ok(g) }));
  assert.equal(x.probe.ok(f), false); assert.equal(x.probe.ok(g), false);
});

test('E7 CR6 PARTIAL from budget-skipped days carries a reason', async () => {
  const mk = (date, n, t0) => { const fs = []; for (let i = 0; i < n; i++) fs.push(flash(t0 + i, date + '-' + i)); const b = enc(dayFile(date, fs)); return { b, row: { count: n, bytes: b.length, sha256: sha(b), path: P(date) } }; };
  const d8 = ymd(Date.now() - 8 * D), d9 = ymd(Date.now() - 9 * D), a = mk(d8, 30000, Date.parse(d8 + 'T10:00:00Z')), b = mk(d9, 30000, Date.parse(d9 + 'T10:00:00Z'));
  const x = boot({ index: mkIndex({ [d8]: a.row, [d9]: b.row }), files: { [a.row.path]: a.b, [b.row.path]: b.b } });
  x.toggle(true); x.click(x.chip('7d')); await drain(); x.click(x.nav('prev')); await drain(); x.click(x.nav('points')); await drain();
  console.log('# E7', JSON.stringify({ state: x.S.last.state, reasons: x.S.last.reasons, sk: x.S.res.sk }));
  assert.equal(x.S.last.state, 'PARTIAL'); assert.ok(x.S.last.reasons.length > 0, 'PARTIAL with no reason');
});

// ---------------------------------------------------------------- PASS checks
test('CHK-RACE: chip change, timer tick and OFF during parked shard loads; only the last action paints; no requests after OFF', async () => {
  const files = {}, over = {};
  for (let k = 0; k < 6; k++) { const d = ymd(Date.now() - k * D), fs = [flash(Date.parse(d + 'T00:00:01Z'), d)], b = enc(dayFile(d, fs)); files[P(d)] = b; over[d] = { count: 1, bytes: b.length, sha256: sha(b), path: P(d) }; }
  const x = boot({ index: mkIndex(over), files, park: true });
  x.toggle(true); await drain(); x.click(x.chip('7d')); await drain(); x.click(x.chip('48h')); await drain();
  x.log.intervals.find(i => i.ms === 6e5).f(); await drain(); // timer while 48h pending (atLatest of previous res)
  for (let k = 0; k < 6; k++) { x.release(); await drain(); }
  assert.equal(x.S.res.w.period, '48h'); assert.equal(x.S.last.period, '48h');
  x.click(x.chip('7d')); await drain(); x.toggle(false); const at = x.log.fetch.length;
  for (let k = 0; k < 6; k++) { x.release(); await drain(); }
  assert.equal(x.log.fetch.length, at); assert.equal(x.S.res, null); assert.equal(x.sources.size + x.layers.size, 0); assert.match(x.label(), /\[WAIT\]/);
  assert.deepEqual(x.log.errors.map(String), []);
});

test('CHK-DOM/MAP: original nodes unchanged; map touched only on own ids; camera never moved', async () => {
  const x = boot({ dash: { top: 788, bottom: 832, left: 245, right: 377, width: 132, height: 44 } });
  const snap = n => JSON.stringify([[...n.attrs], n.style.cssText, Object.entries(n.style)]);
  const before = { host: snap(x.host), orig: snap(x.orig), origKids: x.orig.children.length, pbody: snap(x.pbody), grid: x.grid.children.length };
  x.toggle(true); await drain(); for (const p of ['7d', '30d', '3m', 'custom', '12h']) { x.click(x.chip(p)); await drain(); }
  x.click(x.nav('prev')); await drain(); x.fire('resize'); x.toggle(false); await drain(); x.toggle(true); await drain(); x.toggle(false); await drain();
  assert.deepEqual({ host: snap(x.host), orig: snap(x.orig), origKids: x.orig.children.length, pbody: snap(x.pbody), grid: x.grid.children.length }, before);
  assert.deepEqual([...new Set(x.mapLog.map(c => c[1]))].sort(), ['gridatlas-lightning', 'l-gridatlas-lightning']);
  assert.deepEqual(x.camera, []); assert.equal(x.sources.size + x.layers.size, 0);
});
