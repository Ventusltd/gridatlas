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

function boot({ index = null, feedFn = () => feed([flash(Date.now() - 2 * H, 'f1')]), files = {} } = {}) {
  const doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const orig = doc.createElement('div'); orig.className = 'key-group'; host.appendChild(orig);
  const curtain = doc.createElement('div'); curtain.id = 'fs-curtain-keys'; body.appendChild(curtain);
  const bar = doc.createElement('div'); bar.id = 'gridatlas-menu-bar'; body.appendChild(bar);
  const grid = doc.createElement('div'); grid.className = 'gm-panel-grid'; bar.appendChild(grid);
  const pbody = doc.createElement('div'); pbody.className = 'gm-panel-body'; grid.appendChild(pbody);
  const sources = new Map(), layers = new Map();
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; } }), addLayer: x => layers.set(x.id, { ...x }),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) { l.layout = l.layout || {}; l.layout[k] = v; } } };
  const log = { fetch: [], xhr: [], intervals: [], errors: [] };
  class XHR { open(m, u) { this.url = u; } send() { log.xhr.push(this.url); const d = feedFn(); setTimeout(() => { if (d && d.status) { this.status = d.status; this.onload(); return; } this.status = 200; this.responseText = JSON.stringify(d); this.onload(); }, 0); } }
  const fetch = async url => {
    log.fetch.push(url); await null;
    if (url.endsWith('/history/index.json')) return index ? new Response(enc(typeof index === 'function' ? index() : index), { status: 200 }) : new Response('nope', { status: 404 });
    const k = url.split('/history/')[1]; return files[k] ? new Response(files[k], { status: 200 }) : new Response('nope', { status: 404 });
  };
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const sandbox = { window: W, document: doc, Date, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: false }),
    MutationObserver: class { observe() {} disconnect() {} } };
  vm.runInNewContext(PROBED, sandbox, { filename: MODULE, timeout: 5000 });
  const api = W.__GRIDATLAS_MODULES__.ukLightning, probe = W.__PROBE__;
  assert.equal(api.install(), true, 'install');
  const main = probe.S.sfs[0];
  const click = el => dispatch(el, 'click', log.errors);
  const toggle = on => { const t = main.toggle; t.checked = on; dispatch(t, 'change', log.errors); };
  const cap = k => main.caps[k].textContent;
  return { api, probe, S: probe.S, log, main, click, toggle, cap, host, orig, pbody, sources, layers, chip: p => main.chips[p], nav: n => main.nav[n], status: () => main.stx.textContent, label: () => main.label.textContent };
}
const unhandled = [];
process.on('unhandledRejection', e => unhandled.push(e));
const drain = async () => { for (let k = 0; k < 30; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
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
  assert.match(x.label(), /STALE/); assert.match(x.status(), /STALE/);
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
  assert.match(x.label(), /\[1 \| 7d\]/);
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
  assert.match(x.label(), /\| custom/);
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
  assert.equal(x.main.group.style.paddingBottom, '64px');
  assert.equal(x.host.style.paddingBottom, undefined); assert.equal(x.host.style.cssText, '');
  assert.equal(x.orig.style.paddingBottom, undefined);
  assert.equal(x.S.sfs[1].group.style.paddingBottom, undefined, 'fullscreen curtain group');
  assert.equal(x.S.menu.group.style.paddingBottom, undefined, 'Grid footer row');
});
