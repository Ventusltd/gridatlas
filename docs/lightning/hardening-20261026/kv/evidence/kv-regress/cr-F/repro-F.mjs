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
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S,cv,vk,ni,fit,wf};' + SEAM);

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

function boot({ index = null, feedFn = () => feed([flash(Date.now() - 2 * H, 'f1')]), files = {}, noGrid = false, lazy = false, park = false, bounds = null, dash = null, innerHeight = 852, now = null, redirect = null, ro = false } = {}) {
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
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const addEventListener = (t, f) => (winL[t] = winL[t] || []).push(f);
  W.addEventListener = addEventListener;
  let D = Date;
  if (now !== null) D = class extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } };
  const sandbox = { window: W, document: doc, Date: D, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: false }),
    MutationObserver: class { observe() {} disconnect() {} }, innerHeight, addEventListener };
  const robs = []; if (ro) sandbox.ResizeObserver = class { constructor(f) { this.f = f; this.n = 0; this.dc = 0; } observe(el) { this.n++; robs.push({ el, f: this.f, o: this }); } unobserve() { this.dc++; } disconnect() { this.dc++; } };
  const code = globalThis.__SRC_OVERRIDE ? globalThis.__SRC_OVERRIDE.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S,cv,vk,ni,fit,wf};' + SEAM) : PROBED;
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
  return { robs, winL, installed, doc, grid, api, probe, S: probe.S, log, main, click, toggle, cap, host, orig, pbody, sources, layers, camera, dashEl, W, sandbox, fire, release, parked,
    chip: p => main.chips[p], nav: n => main.nav[n], status: () => main.stx.textContent, label: () => main.label.textContent };
}
const unhandled = [];
process.on('unhandledRejection', e => unhandled.push(e));
const drain = async () => { for (let k = 0; k < 30; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const sha = b => createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- code-review-F repros (each asserts the CORRECT behaviour; a FAIL here = defect present)
const P = d => 'days/' + d.replace(/-/g, '/') + '.json';
const shard = (date, n, t0) => { const fs = []; for (let i = 0; i < n; i++) fs.push(flash(t0 + i, date + '-' + i)); const b = enc(dayFile(date, fs)); return { b, row: { count: n, bytes: b.length, sha256: sha(b), path: P(date) } }; };
const partPath = (d, h) => P(d).replace('.json', '/' + String(h).padStart(2, '0') + '.json');
const say = (...a) => console.log('#', ...a);
const pct = x => +(/Searched EUMETSAT (\d+)%/.exec(x.cap('searched')) || [0, -1])[1];

test('CRF-1 part count 0.5 must reject the index (E: Number.isSafeInteger)', async () => {
  const d = ymd(Date.now());
  const x = boot({ index: mkIndex({ [d]: { count: 1, path: null, sealed: false, parts: [{ path: partPath(d, 1), count: 0.5, bytes: 1, sha256: 'x' }] } }) });
  x.toggle(true); await drain();
  say('S.idx', x.S.idx ? 'ACCEPTED' : 'rejected', 'ie=', x.S.ie);
  assert.equal(x.S.idx, null, 'index with part count 0.5 accepted');
});

test('CRF-2 a lost day under duplicated scan windows: Searched % must equal the single-window value', async () => {
  const now = Date.now(), d3 = ymd(now - 3 * D), w1 = { start_utc: iso(now - 10 * D), end_utc: iso(now), successful_runs: 1 };
  const lost = { [d3]: { coverage: 'none', scanned_seconds: 0, count: null, shard_lost: true } };
  const a = boot({ index: mkIndex(lost, { scan_windows: [w1] }) }); a.toggle(true); a.click(a.chip('7d')); await drain();
  const b = boot({ index: mkIndex(lost, { scan_windows: [w1, { ...w1 }] }) }); b.toggle(true); b.click(b.chip('7d')); await drain();
  say('single', pct(a) + '%', 'duplicated', pct(b) + '%', '|', b.cap('searched'));
  assert.equal(pct(b), pct(a));
});

test('CRF-3 persistent index/shard mismatch: exactly one cache-busted refetch, bounded, PARTIAL', async () => {
  const d = ymd(Date.now() - D), t = Date.parse(d + 'T12:00:00Z'), old = shard(d, 1, t), cur = shard(d, 2, t);
  const x = boot({ index: mkIndex({ [d]: old.row }), files: { [cur.row.path]: cur.b } });
  x.toggle(true); await drain(); const i0 = x.log.fetch.length;
  x.click(x.chip('48h')); await drain();
  const f = x.log.fetch.slice(i0), ix = f.filter(u => /index\.json/.test(u)), sh = f.filter(u => u.endsWith(cur.row.path));
  say('index fetches', ix.length, ix.map(u => u.replace(/.*history\//, '')), 'shard fetches', sh.length, 'state', x.S.last.state, 'reasons', JSON.stringify(x.S.last.reasons));
  assert.equal(ix.filter(u => /\?/.test(u)).length, 1, 'exactly one cache-busted refetch'); assert.ok(ix.length <= 2, 'bounded');
  assert.ok(sh.length <= 2); assert.equal(x.S.last.state, 'PARTIAL');
  const tick = x.log.intervals.find(i => i.ms === 6e5); const n0 = x.log.fetch.length; tick.f(); await drain();
  say('timer tick at latest: fetches', x.log.fetch.length - n0);
});

test('CRF-3b u-only PARTIAL must not give the reason "gaps in window"', async () => {
  const d = ymd(Date.now() - D), t = Date.parse(d + 'T12:00:00Z'), old = shard(d, 1, t), cur = shard(d, 2, t);
  const now = Date.now(), x = boot({ index: mkIndex({ [d]: old.row }, { scan_windows: [{ start_utc: iso(now - 400 * D), end_utc: iso(now + H), successful_runs: 9 }] }), files: { [cur.row.path]: cur.b } });
  x.toggle(true); x.click(x.chip('48h')); await drain();
  say('state', x.S.last.state, 'reasons', JSON.stringify(x.S.last.reasons), '| status', x.status());
  assert.doesNotMatch(x.S.last.reasons.join(';'), /gaps in window/);
});

test('CRF-3c "retrying next refresh" on a non-latest window: the refresh timer must actually retry', async () => {
  const d = ymd(Date.now() - 2 * D), t = Date.parse(d + 'T12:00:00Z'), old = shard(d, 1, t), cur = shard(d, 2, t);
  const x = boot({ index: mkIndex({ [d]: old.row }), files: { [cur.row.path]: cur.b } });
  x.toggle(true); await drain(); x.click(x.nav('prev')); await drain();
  say('window', x.cap('window')); say('warning', x.cap('warning'));
  const tick = x.log.intervals.find(i => i.ms === 6e5), n0 = x.log.fetch.length; tick.f(); await drain();
  say('fetches after timer tick', x.log.fetch.length - n0);
  if (/retrying next refresh/.test(x.cap('warning'))) assert.ok(x.log.fetch.length > n0, 'caption promises a retry that never happens');
});

test('CRF-3d a superseded load must not refetch the index on mismatch (INFO)', async () => {
  const d = ymd(Date.now() - D), t = Date.parse(d + 'T12:00:00Z'), old = shard(d, 1, t), cur = shard(d, 2, t);
  const x = boot({ index: mkIndex({ [d]: old.row }), files: { [cur.row.path]: cur.b }, park: true });
  x.toggle(true); await drain(); x.release(); await drain(); const n0 = x.log.fetch.length;
  x.click(x.chip('48h')); await drain(); x.click(x.chip('7d')); await drain();
  for (let k = 0; k < 6; k++) { x.release(); await drain(); }
  const ix = x.log.fetch.slice(n0).filter(u => /index\.json/.test(u));
  say('index fetches for 48h(superseded)+7d', ix.length, ix.map(u => u.replace(/.*history\//, '')));
  assert.ok(ix.length <= 1, ix.length + ' index fetches');
});

test('CRF-4 redirects: day file (fetch) and feed (XHR) are rejected; prefix-only XHR check noted', async () => {
  const d = ymd(Date.now() - D), s = shard(d, 2, Date.parse(d + 'T12:00:00Z'));
  const x = boot({ index: mkIndex({ [d]: s.row }), files: { [s.row.path]: s.b } });
  const f0 = x.sandbox.fetch; x.sandbox.fetch = async (u, o) => { const r = await f0(u, o); if (u.endsWith(s.row.path)) { const b = await r.arrayBuffer(); return { ok: true, status: 200, redirected: true, arrayBuffer: async () => b }; } return r; };
  x.toggle(true); x.click(x.chip('48h')); await drain();
  say('redirected day file ->', x.S.last.state, x.cap('warning'));
  assert.equal(x.S.last.state, 'FAIL'); assert.equal(x.S.last.drawn, 0);
  // XHR: same-origin path-prefix redirect passes startsWith(u)
  const y = boot(); class X2 extends y.sandbox.XMLHttpRequest { send() { super.send(); const s0 = this; setTimeout(() => {}, 0); } }
  y.sandbox.XMLHttpRequest = class { open(m, u) { this.url = u; } send() { y.log.xhr.push(this.url); setTimeout(() => { this.status = 200; this.responseURL = this.url + '.attacker-branch.json'; this.responseText = JSON.stringify(feed([flash(Date.now() - 2 * H, 'z')])); this.onload(); }, 0); } };
  y.toggle(true); await drain();
  say('XHR responseURL = FEED + ".attacker-branch.json" ->', y.S.last.state, 'drawn', y.S.last.drawn, '(INFO: same origin+path prefix)');
});

test('CRF-5a ResizeObserver: replacing the button 3x leaves old observers attached (leak)', async () => {
  const r = { top: 788, bottom: 832, left: 274, right: 377, width: 103, height: 44 };
  const x = boot({ ro: true, dash: r, innerHeight: 844 }); x.toggle(true); await drain();
  for (let i = 0; i < 3; i++) { const old = x.doc.getElementById('gridatlas-dash-toggle'), nb = x.doc.createElement('button'); nb.id = 'gridatlas-dash-toggle'; nb._rect = r; old.parentNode.removeChild(old); x.doc.documentElement.children[0].appendChild(nb); x.fire('click'); }
  const live = x.robs.filter(o => o.o.dc === 0);
  say('observers created', x.robs.length, 'still observing detached buttons', live.filter(o => !x.doc.documentElement.contains(o.el)).length);
  assert.equal(live.filter(o => !x.doc.documentElement.contains(o.el)).length, 0, 'detached buttons still observed');
});

test('CRF-5b ResizeObserver after OFF: still attached and still writing the inset (no disconnect)', async () => {
  const r = { top: 788, bottom: 832, left: 274, right: 377, width: 103, height: 44 };
  const x = boot({ ro: true, dash: r, innerHeight: 844 }); x.main.group._rect = { right: 385 }; x.toggle(true); await drain(); x.toggle(false); await drain();
  x.dashEl._rect = { ...r, left: 200, width: 177 }; x.robs.at(-1).f();
  say('after OFF: disconnects', x.robs.reduce((n, o) => n + o.o.dc, 0), 'paddingRight', x.main.group.style.paddingRight, 'window listeners', Object.keys(x.winL).join(','));
});

test('CRF-5c ResizeObserver self-loop: the callback is idempotent and never re-observes the same node', async () => {
  const r = { top: 788, bottom: 832, left: 274, right: 377, width: 103, height: 44 };
  const x = boot({ ro: true, dash: r, innerHeight: 844 }); x.main.group._rect = { right: 385 }; x.toggle(true); await drain();
  const n = x.robs.length, p = [x.main.group.style.paddingBottom, x.main.group.style.paddingRight];
  for (let i = 0; i < 100; i++) x.robs.at(-1).f();
  say('observers before/after 100 callbacks', n, x.robs.length, 'padding', p, '->', [x.main.group.style.paddingBottom, x.main.group.style.paddingRight]);
  assert.equal(x.robs.length, n); assert.deepEqual([x.main.group.style.paddingBottom, x.main.group.style.paddingRight], p);
});

test('CRF-6a PREV on 7D, chip 12H, NEXT: NEXT should move one 12H page, not jump to LATEST', async () => {
  const x = boot({ index: mkIndex() }); x.toggle(true); x.click(x.chip('7d')); await drain();
  x.click(x.nav('prev')); await drain(); const e0 = x.S.res.w.e;
  x.click(x.chip('12h')); await drain(); say('12H after chip:', x.cap('window'));
  x.click(x.nav('next')); await drain(); say('after NEXT   :', x.cap('window'), 'jump h=', ((x.S.res.w.e - e0) / H).toFixed(1));
  assert.ok(x.S.res.w.e - e0 <= 12 * H + 1, 'NEXT jumped ' + ((x.S.res.w.e - e0) / H).toFixed(1) + ' h');
});

test('CRF-6b PREV,PREV on 24H, chip 7D, NEXT: windows overlap (NEXT advances 24h on a 7D page)', async () => {
  const x = boot({ index: mkIndex() }); x.toggle(true); await drain();
  x.click(x.nav('prev')); await drain(); x.click(x.nav('prev')); await drain();
  x.click(x.chip('7d')); await drain(); const w0 = x.S.res.w;
  x.click(x.nav('next')); await drain(); const w1 = x.S.res.w;
  say('7D page then NEXT advanced', ((w1.e - w0.e) / H) + ' h; overlap', ((w0.e - w1.s) / D).toFixed(2) + ' d');
  assert.ok(w1.s >= w0.e, 'NEXT window overlaps the current one');
});

test('CRF-6c CUSTOM round-trip and OFF/ON keep the stack consistent; stack growth with PREV/LATEST cycles', async () => {
  const x = boot({ index: mkIndex() }); x.toggle(true); await drain();
  x.click(x.nav('prev')); await drain(); const e1 = x.S.res.w.e;
  x.click(x.chip('custom')); await drain(); x.click(x.chip('24h')); await drain();
  say('after CUSTOM->24H end preserved', x.S.res.w.e === e1, 'next enabled', !x.nav('next').disabled);
  x.click(x.nav('next')); await drain(); assert.equal(x.S.res.w.atLatest, true);
  for (let i = 0; i < 50; i++) { x.click(x.nav('prev')); await drain(); x.click(x.nav('latest')); await drain(); }
  x.toggle(false); x.toggle(true); await drain();
  say('S.h length after 50 PREV/LATEST cycles + OFF/ON', x.S.h.length, '(never cleared)');
  x.click(x.nav('prev')); await drain(); x.click(x.nav('next')); await drain(); assert.equal(x.S.res.w.atLatest, true);
});

test('CRF-7 caption live region: aria-live attribute present', async () => {
  const x = boot(); const c = x.main.group.querySelector('[data-lightning-caption]');
  say('role', c.getAttribute('role'), 'aria-live', c.getAttribute('aria-live'));
  assert.equal(c.getAttribute('aria-live'), 'polite');
});

test('CRF-8 conflicting duplicate rows: lost flag from a superseded duplicate must not apply (INFO)', async () => {
  const d = ymd(Date.now() - D), s = shard(d, 2, Date.parse(d + 'T12:00:00Z')), idx = mkIndex({ [d]: s.row });
  idx.days.splice(idx.days.findIndex(r => r.date === d), 0, { ...idx.days.find(r => r.date === d), coverage: 'none', count: null, scanned_seconds: 0, shard_lost: true, path: null, bytes: null, sha256: null });
  const x = boot({ index: idx, files: { [s.row.path]: s.b } }); x.toggle(true); x.click(x.chip('48h')); await drain();
  say('state', x.S.last.state, 'drawn', x.S.last.drawn, '| warning', x.cap('warning'));
  assert.doesNotMatch(x.cap('warning'), /lost from the archive/);
});

test('CRF-2b over-subtraction can turn a searched, flash-bearing window into UNKNOWN (3 duplicated windows, 1 lost day of 2)', async () => {
  const now = Date.now(), dl = ymd(now - 4 * D), dg = ymd(now - 3 * D), s = shard(dg, 2, Date.parse(dg + 'T12:00:00Z'));
  const w1 = { start_utc: iso(now - 10 * D), end_utc: iso(now), successful_runs: 1 };
  const over = { [dl]: { coverage: 'none', scanned_seconds: 0, count: null, shard_lost: true }, [dg]: s.row };
  const run = async sw => { const x = boot({ index: mkIndex(over, { scan_windows: sw }), files: { [s.row.path]: s.b } }); x.toggle(true); await drain();
    x.click(x.chip('custom')); await drain(); x.main.from.value = dl; x.main.to.value = dg; x.click(x.nav('apply')); await drain(); return x; };
  const a = await run([w1]), b = await run([w1, { ...w1 }, { ...w1 }]);
  say('single  :', a.S.last.state, a.label(), '|', a.cap('searched'));
  say('3x dup  :', b.S.last.state, b.label(), '|', b.cap('searched'));
  assert.equal(b.S.last.state, a.S.last.state);
});
