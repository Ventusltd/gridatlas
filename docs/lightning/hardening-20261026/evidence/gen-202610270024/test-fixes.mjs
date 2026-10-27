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

function boot({ index = null, feedFn = () => feed([flash(Date.now() - 2 * H, 'f1')]), files = {}, noGrid = false, park = false, bounds = null, dash = null, innerHeight = 852, now = null } = {}) {
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
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
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
  const installed = api.install();
  if (!noGrid) assert.equal(installed, true, 'install');
  const main = probe.S.sfs[0];
  const click = el => dispatch(el, 'click', log.errors);
  const toggle = on => { const t = main.toggle; t.checked = on; dispatch(t, 'change', log.errors); };
  const cap = k => main.caps[k].textContent;
  const fire = t => { sandbox.innerHeight = W.innerHeight; for (const f of winL[t] || []) f({ type: t }); };
  const release = () => { while (parked.length) parked.shift()(); };
  return { installed, doc, grid, api, probe, S: probe.S, log, main, click, toggle, cap, host, orig, pbody, sources, layers, camera, dashEl, W, sandbox, fire, release, parked,
    chip: p => main.chips[p], nav: n => main.nav[n], status: () => main.stx.textContent, label: () => main.label.textContent };
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
  assert.match(x.label(), /\[≥?1 \| 7d\]/);
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
  const want = '2 seen in the available 7-day feed · 12 months requested · older history unknown';
  assert.ok(x.status().includes(want), 'status line: ' + x.status());
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
  const pc = +(/Searched EUMETSAT (\d+)%/.exec(x.cap('searched')) || [0, 100])[1];
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
  assert.equal(x.S.last.stale, true); assert.match(x.label(), /STALE/);
});

test('T12: a sub-minute ingest gap reads "<1 min", not "0h 0min"', async () => {
  const now = Date.now(), cutoff = Date.parse(ymd(now) + 'T00:00:00Z') - 365 * D;
  const x = boot({ index: mkIndex({}, { scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(now - 20e3), successful_runs: 9 }] }) });
  x.toggle(true); await drain();
  assert.match(x.cap('warning'), /Not yet ingested: last <1 min of window/);
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
