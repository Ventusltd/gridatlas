// test-fixes.mjs — one fail-first test per defect for the 202610261949 uk-lightning overlay.
// Harness: self-fixture under node:vm with a minimal synthetic DOM (minidom.mjs) and SYNTHETIC index/feed/shard data
// built in this file; no network, no browser. Usage:  MODULE=<path to overlay .js> node --test test-fixes.mjs
// Expected: every test FAILS on the unmodified module (fda6b10) and PASSES on fixed-module.js.
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
// kv-words sample renderer: real index + day shards + feed from Ventusltd/lightning 2a49652 (1,480 flashes, 29 searched days)
const KW = new URL('.', import.meta.url).pathname;
const IX = JSON.parse(readFileSync(KW + 'index-2a49652.json', 'utf8'));
const FEED = JSON.parse(readFileSync(KW + 'feed-2a49652.geojson', 'utf8'));
const files = {}; for (const d of IX.days) if (d.path) files[d.path] = readFileSync(KW + 'days2a/' + d.path);
const at = s => Date.parse('2026-10-27T' + s + ':00Z');
const show = (tag, x) => { const L = x.main.caps; console.log(`\n## ${tag}\nLABEL  ${x.label()}\nSTATUS ${x.status()}\nCAP1   ${(L.notice && L.notice.textContent) ? L.notice.textContent + '\nCAP1b  ' : ''}${L.window.textContent}\nCAP2   ${(L.days || L.actual).textContent}`); };
const run = async (tag, o, steps) => { const x = boot({ files, feedFn: () => FEED, ...o }); x.toggle(true); await drain();
  for (const s of steps) { if (s.chip) x.click(x.chip(s.chip)); if (s.nav) x.click(x.nav(s.nav)); if (s.from) { x.main.from.value = s.from; x.main.to.value = s.to; x.click(x.nav('apply')); } await drain(); }
  show(tag, x); };
for (const now of [at('13:45'), at('15:00')]) {
  console.log(`\n# now ${new Date(now).toISOString()} (index generated ${IX.generated_utc})`);
  for (const p of ['12h', '48h', '7d', '30d', '3m', '12m']) await run('archive ' + p, { index: IX, now }, [{ chip: p }]);
  await run('archive 30d PREV', { index: IX, now }, [{ chip: '30d' }, { nav: 'prev' }]);
  await run('archive 3m PREV', { index: IX, now }, [{ chip: '3m' }, { nav: 'prev' }]);
  await run('custom 2026-10-01..04 (all full)', { index: IX, now }, [{ chip: 'custom' }, { from: '2026-10-01', to: '2026-10-04' }]);
  await run('custom 2026-10-10..20', { index: IX, now }, [{ chip: 'custom' }, { from: '2026-10-10', to: '2026-10-20' }]);
  await run('custom 2026-10-27 (today)', { index: IX, now }, [{ chip: 'custom' }, { from: '2026-10-27', to: '2026-10-27' }]);
  await run('custom 2025-01-01..31 (before retention)', { index: IX, now }, [{ chip: 'custom' }, { from: '2025-01-01', to: '2025-01-31' }]);
  for (const p of ['24h', '7d', '12m']) await run('feed only (404) ' + p, { index: null, now }, [{ chip: p }]);
  await run('index unavailable (v1 schema) 7d', { index: { schema: 'uk-lightning-history-index.v1', days: [] }, now }, [{ chip: '7d' }]);
}
process.exit(0);
