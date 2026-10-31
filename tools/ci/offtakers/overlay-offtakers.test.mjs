#!/usr/bin/env node
// Vendored for the PR gate (tools/ci/pr-gate.mjs, "offtakers-suites") from the OT-build lane's tests/offtakers.test.mjs; the only
// change is the paths: the data file the module pins (data/offtakers_filtered_*.geojson), the REPD register from
// ../lightning/fixtures/, the record twin and substations from the repository.
// Potential-offtakers overlay: node tests (node:vm + minidom, no network, no browser). Spec: evidence/PW-design/OFFTAKERS-OVERLAY-SPEC.md §8.
//   OFFTAKERS_MODULE=<module.js> LIGHTNING_MODULE=<the composition's lightning module; default M4 0045> M5_MODULE=<built M5 module> node --test offtakers.test.mjs
// Fixtures: the three pinned globalgrid2050 files (sha256 checked here against the module's pins), the repo's REPD register fixture
// (tools/ci/lightning/fixtures/repd-master-v8-oracle.json.gz, 10,784 rows), the repo's REPD record twin
// (data/repd_browser_registry_202608290716.json, served for the parquet query) and the release's grid_substations.geojson.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash, webcrypto } from 'node:crypto';
import { El, makeDocument, dispatch } from '../lightning/minidom.mjs';

const HERE = new URL('./', import.meta.url).pathname, REPO = HERE + '../../../';
const MODULE = process.env.OFFTAKERS_MODULE, LMOD = process.env.LIGHTNING_MODULE || REPO + 'atlas/modules/202610290045-uk-lightning-overlay.js';
if (!MODULE) throw new Error('set OFFTAKERS_MODULE');
const SRC = fs.readFileSync(MODULE, 'utf8'), LSRC = fs.readFileSync(LMOD, 'utf8');
const SEAM = 'NS.ukOfftakers=Object.freeze(';
assert.equal(SRC.split(SEAM).length, 2, 'seam');
// DC-B1 (#73 steps 7-8): a module with a data-centre file (DCF) has the data-centre category and the Grid Engine 30/30/30;
// older modules (the live 202610291044 among them) keep their expectations
const DCB = /DCF='https:/.test(SRC);
const PROBED = SRC.replace(SEAM, 'window.__OT__={S,nm,sites,near,csv,RpJ,hv' + (DCB ? ',dn,cn,AL,dsv' : '') + '};' + SEAM);

const sha = b => createHash('sha256').update(b).digest('hex');
const DREL = (SRC.match(/DATA='https:\/\/ventusltd\.github\.io\/gridatlas\/(data\/offtakers_filtered_\d{12}\.geojson)'/) || [])[1];
if (!DREL) throw new Error('module names no data file');
const DURL = 'https://ventusltd.github.io/gridatlas/' + DREL, RAWD = fs.readFileSync(REPO + DREL), DATA = JSON.parse(RAWD);
const DCREL = (SRC.match(/DCF='https:\/\/ventusltd\.github\.io\/gridatlas\/(data\/[\w.-]+)'/) || [])[1], CVREL = (SRC.match(/CVF='https:\/\/ventusltd\.github\.io\/gridatlas\/(data\/[\w.-]+)'/) || [])[1];
const DCURL = DCREL && 'https://ventusltd.github.io/gridatlas/' + DCREL, DCD = DCREL && JSON.parse(fs.readFileSync(REPO + DCREL, 'utf8')), CVD = CVREL && JSON.parse(fs.readFileSync(REPO + CVREL, 'utf8'));
// the data centres drawn: the DC file's sites without cable landing stations replace the offtakers file's 164
const DCD_MAPPABLE = DCB ? DCD.features.filter(f => f.properties.site_kind !== 'cable_landing_station' && f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) : [];
const DCD_DELTA = DCB ? DCD_MAPPABLE.length - 164 : 0;
const REG = JSON.parse(gunzipSync(fs.readFileSync(REPO + 'tools/ci/lightning/fixtures/repd-master-v8-oracle.json.gz')));
const RECS = JSON.parse(fs.readFileSync(REPO + 'data/repd_browser_registry_202608290716.json', 'utf8')).records;
const MANI = fs.readFileSync(REPO + 'data/repd_v9_manifest_202608290716.json');
const SUBF = JSON.parse(fs.readFileSync(REPO + 'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson', 'utf8')).features;

// El additions the module uses in a browser (minidom lacks them)
Object.defineProperty(El.prototype, 'nextElementSibling', { get() { const p = this.parentNode; if (!p) return null; const c = p.children.filter(x => x instanceof El); return c[c.indexOf(this) + 1] || null; } });
El.prototype.click = function () { dispatch(this, 'click', globalThis.__ERR || []); };
El.prototype.focus = function () { globalThis.__FOCUS = this; };
Object.defineProperty(El.prototype, 'offsetHeight', { get() { return 200; } }); Object.defineProperty(El.prototype, 'offsetWidth', { get() { return 380; } });

// independent references: haversine (6378.137 km, the original's geodesy) and the original nearestSubstations (sld-sandbox 202609241334 :3513)
const hav = (lo1, la1, lo2, la2) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 6378.137 * Math.asin(Math.sqrt(a)); };
// the engine's own geodesy module and Grid Finding Scope (sld-sandbox 202609241334 :45-186), byte for byte from the repository
const GEOSRC = fs.readFileSync(REPO + 'atlas/modules/202609011950-geodesy.js', 'utf8');
const SLD = fs.readFileSync(REPO + 'atlas/cartridges/202609241334-sld-sandbox-v9-8.js', 'utf8');
const GSSRC = (() => { const b = SLD.indexOf('if (NS.gridScope) return;'), a = SLD.lastIndexOf('(() => {', b), e = SLD.indexOf('})();', SLD.indexOf('NS.gridScope = Object.freeze', b)) + 5; return SLD.slice(a, e); })();
const GEO = (() => { const w = {}; vm.runInNewContext(GEOSRC, { window: w, Math, Number, Array, Object, Error }); return w.__GRIDATLAS_MODULES__.geodesy; })();
const origNearest = (lon, lat, subs) => { const sc = []; let beyond = null; for (const sub of subs) { const km = (DCB ? GEO.distanceKm : hav)(lon, lat, sub.at[0], sub.at[1]); if (km > 40) { if (!beyond || km < beyond.km) beyond = { ...sub, km }; continue; } sc.push({ ...sub, km }); }
  sc.sort((a, b) => a.km - b.km); const res = sc.slice(0, 5); res.beyondRadiusNearest = res.length ? null : beyond; res.radiusKm = 40; return res; };
const kvOf = v => [...new Set(String(v ?? '').split(/[;,|:\s]+/).map(Number).filter(x => x > 0).map(x => x >= 1000 ? x / 1000 : x))].filter(x => x >= 32.5).sort((a, b) => b - a);
const SUBS = SUBF.map((f, i) => ({ at: f.geometry.coordinates, kv: kvOf(f.properties.voltage), name: f.properties.name || '' })).filter(s => s.kv.length);
const PTECH = new Set(['solar', 'solar_roof', 'wind', 'bess', 'biomass', 'tidal', 'hydrogen', 'hydro', 'flywheel', 'act', 'geothermal', 'caes', 'other']);

const unhandled = []; process.on('unhandledRejection', e => unhandled.push(e));
// fixed ticks, then (R-cifix MINOR: the async SHA-256 and parse raced the fixed count under load) more ticks while the module
// is still loading its data, up to 5 s, and a few after it settles
const tick = async () => { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); };
const drain = async (n = 60) => { for (let k = 0; k < n; k++) await tick(); const t0 = Date.now(); let b = false; while (globalThis.__OTBUSY?.() && Date.now() - t0 < 5000) { b = true; await tick(); } if (b) for (let k = 0; k < 20; k++) await tick(); };

function boot({ tamper = false, lightning = false, neon = true, register = REG.features, duck = true, offtakers = true, srcOverride = null, gridScope = true } = {}) {
  const doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body); const errs = globalThis.__ERR = [];
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const orig = doc.createElement('div'); orig.className = 'key-group'; host.appendChild(orig);
  const curtain = doc.createElement('div'); curtain.id = 'fs-curtain-keys'; body.appendChild(curtain);
  const bar = doc.createElement('div'); bar.id = 'gridatlas-menu-bar'; body.appendChild(bar);
  const sources = new Map(), layers = new Map(), order = [], camera = [], handlers = [];
  const src = (id, o) => ({ ...o, setData(x) { this.data = x; }, serialize() { return { type: 'geojson', data: this.data }; } });
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => { if (sources.has(id)) throw new Error('source exists ' + id); sources.set(id, src(id, o)); },
    addLayer: (x, before) => { if (layers.has(x.id)) throw new Error('layer exists ' + x.id); if (x.source && !sources.has(x.source)) throw new Error('no source ' + x.source); layers.set(x.id, { ...x }); const i = before ? order.indexOf(before) : -1; i >= 0 ? order.splice(i, 0, x.id) : order.push(x.id); },
    removeLayer: id => { layers.delete(id); order.splice(order.indexOf(id), 1); }, removeSource: id => { if ([...layers.values()].some(l => l.source === id)) throw new Error('source in use ' + id); sources.delete(id); },
    moveLayer: id => { order.splice(order.indexOf(id), 1); order.push(id); }, setFilter: (id, f) => { layers.get(id).filter = f; },
    setPaintProperty: (id, k, v) => { const l = layers.get(id); l.paint = { ...l.paint, [k]: v }; }, setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) { l.layout = l.layout || {}; l.layout[k] = v; } },
    getLayoutProperty: (id, k) => (layers.get(id)?.layout || {})[k], getStyle: () => ({ layers: order.map(id => ({ id, ...layers.get(id) })) }), isMoving: () => false, getZoom: () => 8 };
  for (const k of ['fitBounds', 'flyTo', 'easeTo', 'jumpTo']) map[k] = (...a) => camera.push([k, a]);
  const mapEl = doc.createElement('div'); mapEl.id = 'map'; mapEl._rect = { top: 0, left: 0, right: 393, bottom: 852, width: 393, height: 852 }; body.appendChild(mapEl);
  map.getContainer = () => mapEl; map.project = ll => ({ x: (ll[0] + 12) * 1000, y: (62 - ll[1]) * 1000 });
  map.once = (t, f) => f(); map.on = (t, a, b) => handlers.push({ t, layer: b ? a : null, f: b || a }); map.off = (t, f) => { const i = handlers.findIndex(h => h.t === t && h.f === f); if (i >= 0) handlers.splice(i, 1); };
  let qrf = () => []; map.queryRenderedFeatures = (pt, o) => (o && o.layers || []).flatMap(l => qrf(l, pt));
  const tapMap = (pt, hits = {}) => { qrf = l => hits[l] || []; const e = { point: pt, lngLat: { lng: 0, lat: 0 }, originalEvent: { target: mapEl } }; for (const h of handlers.filter(h => h.t === 'click')) h.f(e); };
  if (register) sources.set('src-repd', src('src-repd', { type: 'geojson', data: { type: 'FeatureCollection', features: register } }));
  const log = { xhr: [], fetch: [], winAdd: [], sql: [] }, winL = {};
  const feed = { type: 'FeatureCollection', features: [], metadata: { query_start_utc: new Date(Date.now() - 4 * 36e5).toISOString(), query_end_utc: new Date(Date.now() - 36e5).toISOString() } };
  class XHR { open(m, u) { this.url = u; } send() { log.xhr.push(this.url); setTimeout(() => {
    const dm = /^https:\/\/ventusltd\.github\.io\/gridatlas\/(data\/[\w.-]+)$/.exec(this.url);
    if (dm && fs.existsSync(REPO + dm[1])) { let b = fs.readFileSync(REPO + dm[1]); if (tamper === true ? this.url === DURL : tamper && this.url.endsWith(tamper)) { b = Buffer.from(b); b[10] ^= 1; } this.status = 200; this.responseURL = this.url; this.response = b.buffer.slice(b.byteOffset, b.byteOffset + b.length); this.onload(); return; }
    if (/uk_lightning\.geojson$/.test(this.url)) { this.status = 200; this.responseURL = this.url; this.responseText = JSON.stringify(W.__FEED__ || feed); this.onload(); return; }
    this.status = 404; this.onload(); }, 0); } }
  const fetch = async (u, o) => { log.fetch.push(String(u)); await null;
    if (String(u).endsWith('repd_v9_manifest_202608290716.json')) return new Response(MANI, { status: 200 });
    return new Response('nope', { status: 404 }); };
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 393, innerHeight: 852, crypto: { subtle: webcrypto.subtle }, __GRIDATLAS_MODULES__: { menuBar: { installed: true, inspect: () => ({ n: 60 }) } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  W.addEventListener = (t, f) => { log.winAdd.push(t); (winL[t] = winL[t] || []).push(f); }; W.removeEventListener = (t, f) => { const a = winL[t] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); };
  W.dispatchEvent = ev => { for (const f of [...(winL[ev.type] || [])]) f(ev); return true; };
  if (neon) W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { MAX_LINK_KM: 40, distanceKm: DCB ? GEO.distanceKm : hav, representativePoint: g => g && g.type === 'Point' ? g.coordinates.slice(0, 2) : null, isProjectTech: t => PTECH.has(t), nearestSubstations: (...a) => { (W.__NS__ = W.__NS__ || []).push(a.slice(0, 2)); return origNearest(...a); } } };
  if (duck) W.__GRIDATLAS_DUCKDB_RUNTIME__ = { promise: Promise.resolve({ database: { connect: async () => ({ query: async sql => { log.sql.push(sql); const pts = [...sql.matchAll(/abs\(longitude-\((-?[\d.e-]+)\)\)<=([\d.e-]+) AND abs\(latitude-\((-?[\d.e-]+)\)\)<=[\d.e-]+/g)].map(m => [+m[1], +m[3], +m[2]]);
    const rows = RECS.filter(r => r.longitude != null && pts.some(([x, y, e]) => Math.abs(r.longitude - x) <= e && Math.abs(r.latitude - y) <= e)); return { toArray: () => rows.map(r => ({ ...r })) }; }, close: async () => {} }) } }) };
  class CE { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }
  const blobs = []; class Blob { constructor(p, o) { this.text = p.join(''); this.type = o && o.type; blobs.push(this); } }
  const URLx = { createObjectURL: b => 'blob:' + blobs.indexOf(b), revokeObjectURL: () => {} };
  let raf = 0; const rafs = new Set();
  const sandbox = { window: W, document: doc, Date, AbortController, Map, Set, WeakMap, Promise, XMLHttpRequest: XHR, fetch, Response, TextDecoder, Uint8Array, setTimeout, clearTimeout, URLSearchParams,
    setInterval: () => 1, clearInterval: () => {}, matchMedia: q => ({ matches: !/reduce/.test(q) }), MutationObserver: class { observe() {} disconnect() {} }, innerHeight: 852, addEventListener: W.addEventListener,
    CustomEvent: CE, Blob, URL: URLx, location: { pathname: '/gridatlas/atlas/' }, requestAnimationFrame: f => { raf++; rafs.add(raf); return raf; }, cancelAnimationFrame: i => rafs.delete(i), console };
  Object.assign(W, { CustomEvent: CE });
  const ctx = vm.createContext(sandbox);
  if (DCB && gridScope) { vm.runInContext(GEOSRC, ctx); vm.runInContext(GSSRC, ctx); }
  let L = null, O = null;
  if (lightning) { vm.runInContext(LSRC.replace('NS.ukLightning=Object.freeze(', 'window.__LP__={S};NS.ukLightning=Object.freeze('), ctx, { filename: 'lightning.js', timeout: 5000 }); L = W.__GRIDATLAS_MODULES__.ukLightning; assert.equal(L.install(), true); }
  if (offtakers) { try { vm.runInContext(srcOverride ? srcOverride : PROBED, ctx, { filename: MODULE, timeout: 5000 }); } catch (e) { if (!srcOverride) throw e; log.top = e; } O = W.__GRIDATLAS_MODULES__.ukOfftakers; }
  const P = W.__OT__; globalThis.__OTBUSY = () => !!(P && P.S && (P.S.busy || P.S.pend));
  const group = () => host.querySelector('[data-offtakers-group]');
  const toggle = on => { const t = group().querySelector('[data-offtakers-control]'); t.checked = on; dispatch(t, 'change', errs); };
  const ltoggle = on => { const t = host.querySelector('[data-lightning-control]'); t.checked = on; dispatch(t, 'change', errs); };
  const card = () => mapEl.querySelector('[data-offtakers-card]'), lcard = () => mapEl.querySelector('[data-lightning-card]');
  const dot = pred => P.S.data.dots.find(pred);
  const tapDot = async r => { tapMap([0, 0], { 'gridatlas-offtakers-hit': [{ properties: { i: r.i }, geometry: { type: 'Point', coordinates: r.a } }] }); await drain(); };
  return { W, doc, host, curtain, map, layers, sources, order, camera, handlers, tapMap, log, winL, errs, mapEl, O, L, P, S: P && P.S, toggle, ltoggle, card, lcard, dot, tapDot, blobs, rafs, sandbox };
}
const text = e => e ? e.textContent : '';
const deq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)), m);
const OTIDS = id => /offtakers/.test(id);

// ---------------------------------------------------------------- data and pins
test('P0: the module pins the committed OT-filter file (sha256)', () => {
  assert.ok(SRC.includes(`DSHA='${sha(RAWD)}'`), 'data pin'); assert.equal(DATA.type, 'FeatureCollection');
});

test('T3/T4: classes on the pinned OT-filter file; power stations kept (incl. closed); no small water by default; Offshore never', () => {
  const x = boot(); const r = x.P.nm(DATA.features);
  deq({ ...r.counts }, { a: 813, b: 358, c: 164, d: 8, s: 168, e: 57 }); assert.equal(r.bad, 0);
  assert.equal(r.dots.filter(d => d.k !== 's' && d.k !== 'e').length, 1343, 'default dots'); assert.equal(r.dots.length, 1568, 'with the small water and other-large-users tiers');
  const b = r.dots.filter(d => d.k === 'b'); deq(Object.fromEntries(['op', 'cl', 'cc', 'un'].map(t => [t, b.filter(d => d.t === t).length])), { op: 269, cl: 4, cc: 14, un: 71 });
  assert.ok(b.some(d => /Ratcliffe/.test(d.n) && d.t === 'cc'), 'closed coal kept');
  assert.equal(r.dots.filter(d => (d.p.records || []).some(q => /offshore/i.test(q.sector || ''))).length, 0);
  for (const d of r.dots) assert.ok(d.a[0] >= -11 && d.a[0] <= 3 && d.a[1] >= 49.5 && d.a[1] <= 61.5);
  for (const d of r.dots.filter(d => d.k === 'd' || d.k === 's')) assert.ok(d.p.records.some(q => q.source === 'NAEI'), 'water only NAEI-listed');
});

// ---------------------------------------------------------------- arrival
test('T1: arrival identity: OFF adds no request, source, layer or listener; the group sits before lightning\'s; OFF by default', () => {
  const x = boot({ lightning: true }); const pre = { s: [...x.sources.keys()], l: [...x.layers.keys()], h: x.handlers.length, w: x.log.winAdd.length };
  assert.equal(x.O.install(), true);
  deq([...x.sources.keys()], pre.s); deq([...x.layers.keys()], pre.l); assert.equal(x.handlers.length, pre.h); assert.equal(x.log.winAdd.length, pre.w);
  assert.equal(x.log.xhr.length + x.log.fetch.length, 0); assert.equal(x.S.on, false); assert.equal(x.host.querySelector('[data-offtakers-control]').checked, false);
  const kids = x.host.children; assert.ok(kids.indexOf(x.host.querySelector('[data-offtakers-group]')) < kids.indexOf(x.host.querySelector('[data-lightning-group]')), 'before the lightning group');
  assert.ok(x.curtain.querySelector('[data-offtakers-group]'), 'fullscreen curtain copy');
  assert.equal(/data-layer-id|data-pn-layer|data-gridatlas-layer|lbl-|name=["']bm|localStorage|sessionStorage|document\.cookie|window\.fetch/.test(SRC), false, 'no engine/menu/storage contract');
});

// ---------------------------------------------------------------- switch-on
test('T2a: switch-on fetches exactly the pinned data file once; copper-to-teal palette; small water off; legend', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain();
  const X0 = DCB ? [DURL, DCURL] : [DURL]; deq(x.log.xhr, X0); x.toggle(false); x.toggle(true); await drain(); deq(x.log.xhr, X0, 'cached for the page');
  assert.equal(x.sources.get('gridatlas-offtakers').data.features.length, 1568 + DCD_DELTA);
  const f = x.layers.get('l-gridatlas-offtakers').filter; deq(f[1][2][1], ['a', 'b', 'c', 'd'], 'small water and other large users off by default');
  assert.match(JSON.stringify(x.layers.get('l-gridatlas-offtakers').paint), DCB ? /#e07b39.*#f2c14e.*#b07cff.*#4f86c6.*#a26769/ : /#e07b39.*#f2c14e.*#2ec4b6.*#4f86c6.*#a26769/);
  assert.match(text(x.host.querySelector('[data-offtakers-label]')), new RegExp(`\\[${(1343 + DCD_DELTA).toLocaleString('en-GB')} sites\\]`));
  assert.match(text(x.host.querySelector('[data-offtakers-foot]')), /Dot size: emission band \(NAEI 2023\) or installed MW \(GPPD\)\. Hollow ring: closed, closing or converted station\..*A listing is not electricity demand\. Distances are straight lines\. Vicinity screening only\. Contains OpenStreetMap data © OpenStreetMap contributors, ODbL 1\.0/);
});

test('T2b: a SHA-256 mismatch shows "data check failed" and draws nothing', async () => {
  const y = boot({ tamper: true }); y.O.install(); y.toggle(true); await drain();
  assert.match(text(y.host.querySelector('[data-offtakers-status]')), /data check failed/); assert.match(text(y.host.querySelector('[data-offtakers-label]')), /\[FAIL\]/);
  assert.equal([...y.sources.keys()].filter(OTIDS).length + [...y.layers.keys()].filter(OTIDS).length, 0, 'nothing drawn');
});

test('T2c: class and power-status chips filter the drawn and tappable layers; All resets; hollow ring for closed', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain(); const lab = () => text(x.host.querySelector('[data-offtakers-label]'));
  const nl = n => new RegExp(`\\[${(n + DCD_DELTA).toLocaleString('en-GB')} sites\\]`);
  x.host.querySelector('[data-offtakers-class="s"]').click(); deq(x.layers.get('gridatlas-offtakers-hit').filter[1][2][1], ['a', 'b', 'c', 'd', 's']); assert.match(lab(), nl(1511));
  x.host.querySelector('[data-offtakers-class="a"]').click(); assert.match(lab(), nl(698));
  const a = x.dot(r => r.k === 'a'); await x.tapDot(a); assert.equal(x.card(), null, 'a hidden class is not tappable');
  x.host.querySelector('[data-offtakers-bst="cc"]').click(); deq(x.layers.get('gridatlas-offtakers-hit').filter[2][2][2][1], ['op', 'cl', 'un']);
  const rat = x.dot(r => /Ratcliffe/.test(r.n)); await x.tapDot(rat); assert.equal(x.card(), null, 'a hidden status is not tappable');
  x.host.querySelector('[data-offtakers-all]').click(); assert.match(lab(), nl(1343));
  const paint = JSON.stringify(x.layers.get('l-gridatlas-offtakers').paint); assert.match(paint, /"case",\["in",\["get","t"\],\["literal",\["cl","cc"\]\]\],"rgba\(0,0,0,0\)"/);
  assert.ok(x.layers.get('gridatlas-offtakers-centre'), 'operating power stations get a dark centre dot');
});

// ---------------------------------------------------------------- the tap
const indep = (r, f = { st: 'all', te: 'all' }, n = 15) => { // independent of the module: haversine, M2 status/tech tables, ~10 m grouping, 15 + ties
  const S = s => ({ operational: 'op', 'under construction': 'cc', 'awaiting construction': 'cc', 'application submitted': 'pl' })[String(s || '').toLowerCase()] || '?';
  const T = t => /^solar/.test(t) ? 'solar' : /^wind/.test(t) ? 'wind' : /^bess/.test(t) ? 'bess' : 'other';
  const seen = new Set(), rows = [];
  for (const g of REG.features) { const a = g.geometry.coordinates, p = g.properties; if (!PTECH.has(p.tech)) continue; const km = hav(r.a[0], r.a[1], a[0], a[1]); if (km > 40) continue; const k = a + JSON.stringify(p); if (seen.has(k)) continue; seen.add(k);
    if ((f.st === 'all' || S(p.status) === f.st) && (f.te === 'all' || T(p.tech) === f.te)) rows.push({ a, p, km }); }
  rows.sort((a, b) => a.km - b.km); const gs = [];
  for (const q of rows) { let g = gs.find(g => Math.abs(g.a[0] - q.a[0]) < 2e-4 && Math.abs(g.a[1] - q.a[1]) < 1e-4); if (!g) gs.push(g = { a: q.a, km: q.km, parts: [] }); g.parts.push(q.p); }
  return gs.filter((g, i, a) => i < n || g.km === a[n - 1].km);
};
const rowsOf = c => [...c.querySelectorAll('a')].map(a => text(a));
const bigSites = x => ({ refinery: x.dot(r => r.k === 'a' && /refinery/.test(r.sub)), steel: x.dot(r => r.k === 'a' && r.sub === 'steel' && /^Port Talbot \(site: \d+ NAEI points\)/.test(r.n)), naei: x.dot(r => /Ratcliffe/.test(r.n)), dc: x.dot(r => r.k === 'c' && !/^unknown/i.test(r.n)) });

test('T6a: a tap lists the 15 nearest REPD sites (≤40 km, ties kept), equal to an independent haversine reference, and draws 15 REPD links + 5 substation links', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain();
  const picks = Object.entries(bigSites(x)).filter(([k, v]) => v && !(DCB && k === 'dc')).map(e => e[1]); assert.ok(picks.length >= 3, 'refinery / steel / data-centre fixtures present');
  for (const r of picks) {
    await x.tapDot(r); const c = x.card(); assert.ok(c, 'card'); const exp = indep(r), got = rowsOf(c);
    assert.equal(got.length, exp.length, r.n); assert.ok(exp.length >= 15);
    exp.forEach((g, i) => assert.ok(got[i].startsWith(`${i + 1}. ${g.km.toFixed(2)} km`), `${r.n} row ${i + 1}: ${got[i]} vs ${g.km.toFixed(2)}`));
    for (const g of exp) assert.ok(g.km <= 40);
    const pl = x.sources.get('gridatlas-offtakers-neon-plinks').data.features, sl = x.sources.get('gridatlas-offtakers-neon-subs').data.features;
    assert.equal(pl.length, exp.length); deq(pl.map(f => f.geometry.coordinates[1]), exp.map(g => g.a));
    const ns = origNearest(r.a[0], r.a[1], SUBS); assert.equal(sl.length, 5); deq(sl.map(f => f.geometry.coordinates[1]), ns.map(s => s.at));
    deq(x.W.__NS__.at(-1), r.a, 'nearestSubstations called at the site');
    assert.match(text(c), /Screening · 5 nearest substations, straight line\. Not capacity or connection feasibility\./);
    assert.ok(x.layers.get('l-gridatlas-offtakers-links'), 'links layer id');
  }
});

test('T6b: ties at the 15th site distance are kept; "Only n REPD sites within 40 km" for a sparse point; chips re-rank; MW not stated is never 0', async () => {
  const at = [-1.0, 54.0], mk = (dx, p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [at[0] + dx, at[1]] }, properties: { name: 'P' + dx, tech: 'solar', raw_tech: 'Solar Photovoltaics', status: 'operational', capacity: 5, ...p } });
  const reg = [...Array.from({ length: 14 }, (_, i) => mk(0.01 * (i + 1))), mk(0.25, { name: 'tieA' }), mk(-0.25, { name: 'tieB', status: 'application submitted', capacity: null, tech: 'wind', raw_tech: 'Wind Onshore' }), mk(0.3, { name: 'far' })];
  const x = boot({ register: reg }); x.O.install(); x.toggle(true); await drain(); const r = x.dot(r => r.k === 'a'); r.a = at; // a synthetic site
  await x.tapDot(r); let rows = rowsOf(x.card()); assert.equal(rows.length, 16, 'ties kept'); assert.ok(rows.some(t => /tieA/.test(t)) && rows.some(t => /tieB/.test(t)) && !rows.some(t => /far/.test(t)));
  assert.match(rows.find(t => /tieB/.test(t)), /capacity not stated/); assert.equal(rows.some(t => / 0 MW/.test(t)), false);
  x.card().querySelector('[data-offtakers-repd-filter="st:pl"]').click(); rows = rowsOf(x.card()); assert.equal(rows.length, 1); assert.match(rows[0], /tieB/);
  assert.match(text(x.card()), /Only 1 REPD site within 40 km for this filter/);
  assert.equal(x.sources.get('gridatlas-offtakers-neon-plinks').data.features.length, 1, 'links follow the chips');
  x.card().querySelector('[data-offtakers-repd-filter="st:all"]').click(); x.card().querySelector('[data-offtakers-repd-filter="te:wind"]').click(); assert.equal(rowsOf(x.card()).length, 1);
  x.card().querySelector('[data-offtakers-repd-filter="te:all"]').click();
  assert.match(text(x.card()), /Within 5 km: 7 REPD projects · Operational 7 · 35 MW stated/); // 0.01° steps at 54° N: 7 within 5 km
});

test('T7: substations are exactly the 5 from nearestSubstations; beyondRadiusNearest is named when none lies within 40 km', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain(); const r = bigSites(x).refinery; await x.tapDot(r);
  const ns = origNearest(r.a[0], r.a[1], SUBS), lines = text(x.card()).match(/\d+\.\d\d km · \d+ kV · [^·]*?(?=\d+\.\d\d km|Download|$)/g) || [];
  for (const s of ns) assert.ok(text(x.card()).includes(`${s.km.toFixed(2)} km · ${Math.max(...s.kv)} kV`), 'substation ' + s.km);
  const y = boot({ neon: true }); y.W.__GRIDATLAS_NEON_LINKS__.substations = [{ at: [-4, 58.5], kv: [132], name: 'Far North' }]; y.O.install(); y.toggle(true); await drain();
  const q = y.dot(r => r.k === 'a' && r.a[1] < 51); await y.tapDot(q);
  assert.match(text(y.card()), /No substation within 40 km \(nearest: Far North, 132 kV, \d+\.\d\d km\)/);
});

test('T8: full REPD record (M5 join, copied unchanged): joined rows show ref, address, postcode; unjoined read "address not in register"', async () => {
  const m5p = process.env.M5_MODULE; if (m5p) { const m5 = fs.readFileSync(m5p, 'utf8'), a = m5.indexOf("RU='https://ventusltd.github.io/gridatlas/data/repd_projects_"), b = m5.indexOf('RpX='); assert.ok(SRC.includes(m5.slice(a, b).replace(/\n$/, '')), 'M5 join text byte-identical'); }
  const x = boot(); x.O.install(); x.toggle(true); await drain(); const r = bigSites(x).refinery; await x.tapDot(r); await drain(); const c = x.card();
  const recs = [...c.querySelectorAll('[data-tier="record"]')].map(text).join('\n');
  assert.match(recs, /Record · REPD \d+ · /); assert.ok(x.log.sql.length >= 1 && /read_parquet\('https:\/\/ventusltd\.github\.io\/gridatlas\/data\/repd_projects_202608290716\.parquet'\)/.test(x.log.sql[0]));
  // every listed project: an exact single record ⇒ its ref; otherwise "address not in register" (independent join)
  const nz = s => ((s || '') + '').normalize('NFC').split(/\s+/).filter(Boolean).join(' ');
  for (const g of indep(r)) for (const p of g.parts) { const m = RECS.filter(o => o.longitude != null && Math.abs(o.longitude - g.a[0]) <= 1.000001e-6 && Math.abs(o.latitude - g.a[1]) <= 1.000001e-6 && nz(o.name) === nz(p.name) && Math.abs((o.capacity_mw > 0 ? +o.capacity_mw : 0) - (p.capacity > 0 ? +p.capacity : 0)) < 1e-6 && o.repd_technology === p.raw_tech);
    if (m.length === 1) { assert.ok(recs.includes(`Record · REPD ${m[0].repd_ref} · `), 'ref ' + m[0].repd_ref); if (m[0].repd_postcode) assert.ok(recs.includes(m[0].repd_postcode)); } }
  const y = boot({ register: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-1.3, 50.8] }, properties: { name: 'No Such Farm', tech: 'solar', raw_tech: 'Solar Photovoltaics', status: 'operational', capacity: 3 } }] }); y.O.install(); y.toggle(true); await drain();
  const q = y.dot(d => d.k === 'a'); q.a = [-1.31, 50.8]; await y.tapDot(q); await drain(); assert.match(text(y.card()), /Record · address not in register/);
});

test('T9: wording lint: banned words, no tCO2e and no "%" in the card; every text block tiered; no distance tiered Record; first line ≤ 90 chars; Unknown never a name', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain(); x.host.querySelector('[data-offtakers-class="s"]').click(); x.host.querySelector('[data-offtakers-class="e"]').click();
  const lits = SRC.match(/'[^'\n]*'|`[^`\n]*`/g).join('\n').replace("'Not shown here: electricity use, connection terms, TEC, consent, viability.'", '');
  const BAN = /\b(viable|feasible|opportunity|offtake agreement|PPA|private wire|supply|capacity available|demand of|consumes|MWh|large user|best|recommended|suitable)\b/i;
  assert.equal(BAN.test(lits), false, 'banned word in a module literal: ' + (lits.match(BAN) || [])[0]);
  const unknownN = x.dot(r => r.k === 'c' && (!r.n || /^(unknown|unnamed\b)/i.test(r.n))), unknownOp = x.dot(r => /^unknown/i.test(r.op || 'Unknown'));
  const picks = [...Object.values(bigSites(x)), unknownN, unknownOp, x.dot(r => r.k === 's'), x.dot(r => r.k === 'd'), x.dot(r => r.k === 'e'), x.dot(r => r.k === 'b' && r.t === 'un'), x.dot(r => r.p.records.length > 2)];
  assert.equal(picks.filter(Boolean).length, picks.length, 'every pick exists: ' + picks.map((p, i) => p ? '' : i).join(''));
  for (const r of picks) {
    await x.tapDot(r); await drain(); const c = x.card(), t = text(c);
    assert.equal(/\b(viable|feasible|opportunity|PPA|MWh|recommended|suitable)\b/.test(t.replace(/Not shown here: [^.]*\./, '')), false, 'banned in card: ' + t.slice(0, 80)); const tn = t.replace(/source https?:\/\/\S+/g, ''); assert.equal(/tCO2e|tonnes|%/i.test(tn), false, 'no emission figure or %: ' + (tn.match(/.{30}(tCO2e|tonnes|%).{10}/i) || [])[0]);
    for (const m of tn.matchAll(/Emission band ([^ ]+ kt|[^ ]+) CO2e/g)) assert.ok(['<1 kt', '1-10 kt', '10-25 kt', '25-100 kt', '>=100 kt'].includes(m[1]), 'band only: ' + m[1]);
    assert.equal(/Unknown/.test(t.split('Substations')[0]), false, 'Unknown… never rendered as a name or operator');
    const title = c.children[0].children[0]; assert.ok(text(title).length <= 90);
    for (const e of c.walk()) { if (!['DIV', 'A'].includes(e.tagName) || !e.children.some(k => !(k instanceof El) && k.data.trim())) continue;
      let p = e; while (p && !p.dataset.tier && p !== c) p = p.parentNode; if (e.closest('[role="group"]') || e.closest('[role="status"]')) continue;
      assert.ok(p && p.dataset.tier, 'untiered block: ' + text(e).slice(0, 60));
      if (p.dataset.tier === 'record') assert.equal(/\d km\b/.test(text(e)), false, 'distance tiered Record: ' + text(e)); }
  }
  assert.match(text(x.card() || x.host), /./);
  const u = unknownN; await x.tapDot(u); assert.match(text(x.card()), /name not listed · /); assert.match(text(x.card().children[0]), DCB ? /^Data centre \(screening\)/ : /^Potential offtaker \(screening\): not a confirmed demand, contract or connection\./);
});

test('T10: CSV vicinity sheet: header with generation and caveat; one row per listed project and substation; licence filled', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain(); const r = bigSites(x).steel || bigSites(x).refinery; await x.tapDot(r); await drain();
  x.card().querySelector('[data-offtakers-csv]').click(); const csv = x.blobs.at(-1).text, lines = csv.trim().split('\n');
  assert.match(lines[0], new RegExp('generation ' + x.O.generation)); assert.match(lines[1], /straight-line distance, not a cable route.*not electricity demand/);
  const parts = indep(r).reduce((s, g) => s + g.parts.length, 0); assert.equal(lines.length - 3, parts + 5);
  const rows = lines.slice(3).map(l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(v => v.replace(/,$/, ''))); for (const c of rows) assert.ok(c[10] && /OGL|ODbL/.test(c[10]), 'licence ' + c);
  assert.equal(x.blobs.at(-1).type, 'text/csv');
});

test('T12: cleanup: OFF removes every offtakers source, layer, card, map listener and animation; ON again redraws; repeated cycles leave nothing', async () => {
  const x = boot(); x.O.install(); const h0 = x.handlers.length;
  for (let k = 0; k < 3; k++) {
    x.toggle(true); await drain(); await x.tapDot(bigSites(x).refinery); await drain(); assert.ok(x.card()); assert.ok(x.rafs.size >= 1);
    x.toggle(false); assert.equal(x.card(), null); assert.equal([...x.sources.keys()].filter(OTIDS).length, 0); assert.equal([...x.layers.keys()].filter(OTIDS).length, 0);
    assert.equal(x.handlers.length, h0, 'map listeners removed'); assert.equal(x.rafs.size, 0, 'animation cancelled'); assert.equal((x.winL['gridatlas:card-open'] || []).length, 0);
  }
  assert.equal(x.errs.length, 0); assert.equal(x.S.errors.length, 0, x.S.errors.join('; '));
});

test('T13: both ON: no interference with the lightning overlay (ids disjoint, lightning layers untouched, one card at a time, offtakers above)', async () => {
  const x = boot({ lightning: true }); x.O.install(); x.W.__FEED__ = { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'f1', geometry: { type: 'Point', coordinates: [-1.3, 50.8] }, properties: { time_utc: new Date(Date.now() - 36e5).toISOString(), observation_kind: 'optical_lightning_flash' } }], metadata: { query_start_utc: new Date(Date.now() - 4 * 36e5).toISOString(), query_end_utc: new Date(Date.now() - 30 * 6e4).toISOString() } };
  x.ltoggle(true); await drain(); const lIds = () => [...x.layers.keys()].filter(id => /lightning/.test(id)), lSrc = () => [...x.sources.keys()].filter(id => /lightning/.test(id));
  const before = { l: lIds(), s: lSrc(), d: JSON.stringify(x.sources.get('gridatlas-lightning')?.data) }; assert.ok(before.l.length, 'lightning drawn');
  x.toggle(true); await drain();
  deq(lIds(), before.l); deq(lSrc(), before.s); assert.equal(JSON.stringify(x.sources.get('gridatlas-lightning')?.data), before.d);
  for (const id of x.order.filter(OTIDS)) assert.equal(/lightning/.test(id), false);
  assert.ok(x.order.indexOf('l-gridatlas-offtakers') > x.order.indexOf('l-gridatlas-lightning'), 'offtakers above lightning');
  // a tap on an offtaker dot that ALSO hits a flash: the offtaker card wins, the lightning card is closed through its own Close
  const r = bigSites(x).refinery; x.W.__GRIDATLAS_NEON_LINKS__.substations = SUBS;
  x.tapMap([0, 0], { 'gridatlas-offtakers-hit': [{ properties: { i: r.i }, geometry: { type: 'Point', coordinates: r.a } }], 'gridatlas-lightning-hit': [{ properties: { i: 0, s: x.W.__LP__.S.res.s }, geometry: { type: 'Point', coordinates: [-1.3, 50.8] } }] });
  await drain(); assert.ok(x.card(), 'offtaker card'); assert.equal(x.lcard(), null, 'lightning card closed');
  assert.ok([...x.sources.keys()].some(s => /offtakers-neon/.test(s))); assert.equal([...x.sources.keys()].some(s => /lightning-neon/.test(s)), false, 'lightning links cleared by its own close');
  // a flash-only tap: the lightning card opens as before, and the offtaker card closes
  x.tapMap([0, 0], { 'gridatlas-lightning-hit': [{ properties: { i: 0, s: x.W.__LP__.S.res.s }, geometry: { type: 'Point', coordinates: [-1.3, 50.8] } }] }); await drain();
  assert.ok(x.lcard(), 'lightning card'); assert.equal(x.card(), null); assert.equal([...x.sources.keys()].some(s => /offtakers-neon/.test(s)), false);
  assert.match(text(x.lcard()), /Flash/);
  // offtakers OFF: lightning untouched and still tappable
  x.toggle(false); deq(lIds().filter(i => !/neon/.test(i)), before.l.filter(i => !/neon/.test(i))); assert.ok(x.lcard(), 'lightning card survives offtakers OFF');
  x.tapMap([0, 0], {}); await drain(); assert.equal(x.lcard(), null);
  x.tapMap([0, 0], { 'gridatlas-lightning-hit': [{ properties: { i: 0, s: x.W.__LP__.S.res.s }, geometry: { type: 'Point', coordinates: [-1.3, 50.8] } }] }); await drain(); assert.ok(x.lcard());
  assert.equal(x.errs.length, 0); assert.equal(x.W.__LP__.S.errors.filter(e => !/neon labels|count labels/.test(e)).length, 0, x.W.__LP__.S.errors.join('; '));
});

test('T11: isolation: an offtakers error (throwing measure, a top-level throw) leaves lightning installed and working', async () => {
  const x = boot({ lightning: true }); x.O.install(); x.toggle(true); await drain(); x.W.__GRIDATLAS_NEON_LINKS__.measure.nearestSubstations = () => { throw new Error('boom'); };
  await x.tapDot(bigSites(x).refinery); assert.match(text(x.card()), /Substation data unavailable/); x.ltoggle(true); await drain(); assert.equal(x.W.__LP__.S.on, true);
  const bad = SRC.replace("let MX=Math.max", "throw new Error('top-level');let MX=Math.max");
  const y = boot({ lightning: true, srcOverride: bad + '\n' }); assert.match(String(y.log.top), /top-level/); assert.ok(y.L && y.L.state.installed); y.ltoggle(true); await drain(); assert.equal(y.W.__LP__.S.on, true);
});

test('T14: a row flies to the REPD site with its own substations; ◀ back restores the offtaker card; Escape and × close', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain(); const r = bigSites(x).refinery; await x.tapDot(r); await drain();
  const a = x.card().querySelector('a'); a.click(); await drain(); assert.equal(x.card().getAttribute('aria-label'), 'REPD project');
  const g = indep(r)[0]; deq(x.W.__NS__.at(-1), g.a); assert.equal(x.camera.filter(c => c[0] === 'flyTo').at(-1)[1][0].center.join(), g.a.join());
  x.card().querySelector('[data-offtakers-back]').click(); await drain(); assert.equal(x.card().getAttribute('aria-label'), 'Potential offtaker');
  dispatch(x.card(), 'keydown', x.errs); // no key: stays
  x.card().listeners.keydown[0]({ key: 'Escape' }); assert.equal(x.card(), null);
  await x.tapDot(r); [...x.card().querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close').click(); assert.equal(x.card(), null);
  assert.equal([...x.sources.keys()].some(s => /offtakers-neon/.test(s)), false);
});

test('T15: power station card: closed coal (Ratcliffe) shows MW, the curated status with its source, the merged records and the combustion indicator', async () => {
  const x = boot(); x.O.install(); x.toggle(true); await drain(); const r = x.dot(r => /Ratcliffe on Soar/.test(r.n)); await x.tapDot(r); await drain(); const t = text(x.card());
  assert.match(t, /Ratcliffe on Soar Power Station · operator \(NAEI\) Uniper UK Ltd · coal/); assert.match(t, /2,000 MW installed \(GPPD, DUKES-derived; installed, not connection capacity\)/);
  assert.match(t, /Status: closed 2024-09-30 · source https:\/\/en\.wikipedia\.org\/wiki\/Ratcliffe-on-Soar_Power_Station/);
  assert.match(t, /3 records merged: Ratcliffe on Soar Power Station \(NAEI\); Ratcliffe \(GPPD, 2,000 MW\); Ratcliffe GT \(GPPD, 34 MW\)/);
  assert.match(t, /Listed as a power producer \(NAEI 2023\)\. Not a measure of its electricity use\./); assert.match(t, /Closed station: no grid connection, TEC or connection rights are implied\./);
  assert.match(t, /Record · NAEI \(OGL v3\.0\) · GPPD \(CC BY 4\.0\)/); assert.equal(r.t, 'cc'); assert.equal(r.z, 1.5);
  assert.match(t, /Not shown here: electricity use, connection terms, TEC, consent, viability\./);
});

test('Z: no unhandled rejections', async () => { await drain(); deq(unhandled.map(String), []); });

// R-taps MAJOR: an offtaker hit claims the tap at once (e.gridatlasClaim = 'offtakers'), whichever overlay registered its click
// handler first; the lightning overlay then leaves the tap alone, and a map popup opened by the same tap (the engine's REPD dot
// under the site, e.g. Drax over a battery) is closed through its own Close button, so only the offtakers card stays.
const OT_GEN = (SRC.match(/GEN='(\d{12})'/) || [])[1] || '0';
test('T13b: both ON, in either handler order: the offtaker hit claims the tap, lightning ignores it, the same-tap map popup closes', { skip: OT_GEN < '202610291044' && `module ${OT_GEN} predates the fix` }, async () => {
  for (const first of ['offtakers', 'lightning']) {
    const x = boot({ lightning: true }); x.O.install(); x.W.__FEED__ = { type: 'FeatureCollection', features: [], metadata: { query_start_utc: new Date(Date.now() - 4 * 36e5).toISOString(), query_end_utc: new Date(Date.now() - 36e5).toISOString() } };
    if (first === 'offtakers') { x.toggle(true); await drain(); x.ltoggle(true); await drain(); } else { x.ltoggle(true); await drain(); x.toggle(true); await drain(); }
    let seen = null; x.handlers.push({ t: 'click', layer: null, f: e => { seen = e.gridatlasClaim; } });
    const lt = x.W.__LP__.S, lstate = () => JSON.stringify([!!lt.pp, lt.ly ? [...lt.ly] : null]), l0 = lstate();
    const pop = x.doc.createElement('div'); pop.className = 'maplibregl-popup'; const close = x.doc.createElement('button'); close.className = 'maplibregl-popup-close-button';
    let closed = 0; close.addEventListener('click', () => { closed++; pop.remove(); }); pop.appendChild(close); x.mapEl.appendChild(pop);
    const r = bigSites(x).refinery; x.W.__GRIDATLAS_NEON_LINKS__.substations = SUBS;
    x.tapMap([0, 0], { 'gridatlas-offtakers-hit': [{ properties: { i: r.i }, geometry: { type: 'Point', coordinates: r.a } }], 'gridatlas-lightning-cell': [{ properties: { lon: r.a[0], lat: r.a[1] } }] });
    assert.equal(seen, 'offtakers', `${first} first: claimed synchronously`); assert.equal(lstate(), l0, `${first} first: lightning did nothing with the tap`);
    await drain(); assert.ok(x.card(), 'offtakers card'); assert.equal(x.lcard(), null, 'no lightning card'); assert.equal(closed, 1, 'the same-tap popup closed through its own button');
    x.tapMap([0, 0], {}); seen = 'none'; x.tapMap([0, 0], {}); assert.equal(seen, undefined, 'a tap off the dots is not claimed');
  }
});

// ---------------------------------------------------------------- DC-B1 (#73 steps 7-8): data centres and the Grid Engine 30/30/30
// Independent references: haversine (hav, asin form; not the engine's geodesy), the pinned DC-A6 conventional file, the
// repository's substations and REPD register fixture. Specs: evidence/DC-B2/CARD-SPEC.md, evidence/DC-B3/ENGINE.md.
const DSKIP = !DCB && 'module has no data-centre file (before DC-B1)';
const SL = [-0.62, 51.523];
const iSubs = o => SUBS.map(s => ({ s, km: hav(o[0], o[1], s.at[0], s.at[1]) })).filter(v => v.km <= 40).sort((a, b) => a.km - b.km).slice(0, 30);
const iCV = o => (CVD ? CVD.features : []).filter(f => f.properties.in_nearest_default !== false).map(f => ({ f, km: hav(o[0], o[1], ...f.geometry.coordinates) })).sort((a, b) => a.km - b.km).slice(0, 30);
const dcBoot = async o => { const x = boot(o); x.O.install(); x.toggle(true); await drain(); return x; };
const tabOf = (x, v) => x.card().querySelector(`[data-offtakers-tab="${v}"]`);
const panel = x => x.card().querySelector('[data-offtakers-panel]'), prow = x => [...panel(x).querySelectorAll('a')].map(text);
const openTab = async (x, v) => { tabOf(x, v).click(); await drain(5); };
const reveal = async x => { x.card().querySelector('[data-offtakers-reveal]').click(); await drain(5); };
const lines = x => x.sources.get('gridatlas-offtakers-neon-dc-l').data.features, bySet = (x, s) => lines(x).filter(f => f.properties.s === s);
const sloughDC = x => x.S.data.dots.filter(d => d.k === 'c').sort((a, b) => hav(...SL, ...a.a) - hav(...SL, ...b.a))[0];

test('DC1: data centres: the pinned pipeline file once, every site that passes the schema checks, one operator per origin; Slough ≥16 origins within 3 km', { skip: DSKIP }, async () => {
  const x = await dcBoot(); const dc = x.S.data.dots.filter(d => d.k === 'c');
  assert.equal(x.log.xhr.filter(u => u === DCURL).length, 1); assert.ok(SRC.includes(`DCFSHA='${sha(fs.readFileSync(REPO + DCREL))}'`), 'DC file pin');
  assert.equal(dc.length, DCD_MAPPABLE.length);
  // NL-007 P7b: the unplaced records (null geometry) are counted in the file whose sha256 equals the module's DCFSHA, not written as
  // a literal, so the test holds for every pin (the live 202610292044 pins a file with two, 202610312138 one); Ebbsfleet is one of them
  const PINNED = SRC.match(/DCFSHA='([0-9a-f]{64})'/)[1], PFILE = fs.readdirSync(REPO + 'data').filter(n => /\.geojson$/.test(n)).find(n => sha(fs.readFileSync(REPO + 'data/' + n)) === PINNED);
  assert.ok(PFILE, 'a file under data/ matches DCFSHA ' + PINNED); const UNPLACED = JSON.parse(fs.readFileSync(REPO + 'data/' + PFILE, 'utf8')).features.filter(f => f.geometry == null);
  assert.ok(UNPLACED.length > 0, 'the pinned file keeps its unplaced planning records'); assert.equal(x.S.data.pl.bad, UNPLACED.length, 'the module skips exactly the unplaced records of ' + PFILE);
  assert.equal(DCD.features.length - DCD_MAPPABLE.length, UNPLACED.length, 'every unplaced record remains in the source, never drawn');
  assert.ok(UNPLACED.some(f => /Ebbsfleet/.test(f.properties.name)), 'Ebbsfleet is among the unplaced'); assert.ok(!dc.some(d => UNPLACED.some(f => f.properties.id === d.p.id)), 'no unplaced record is drawn');
  assert.ok(dc.length >= 178, 'at least the operational OSM sites');
  assert.ok(dc.every(d => d.dc && d.p.site_kind !== 'cable_landing_station'));
  // one operator per origin: a single operator string (or none); a source naming another operator must be flagged by the file
  // (operator_alternatives, or an operator_disagreement conflict). The pipeline's members trace to DC-A4, where one origin merges two
  // operators (Digital Realty LHR26 / Global Technical Realty; evidence/DC-B1/out/cross-operator.txt), reported to the lead
  for (const d of dc) { assert.ok(d.p.operator == null || typeof d.p.operator === 'string', d.p.id);
    const ops = new Set((d.p.sources || []).map(s => (s.operator || '').toLowerCase()).filter(Boolean)); if (ops.size > 1) assert.ok((d.p.operator_alternatives || []).length || (d.p.conflicts || []).some(c => c.kind === 'operator_disagreement'), 'cross-operator merge not flagged: ' + d.p.id); }
  // #73: source refs for different Slough operators must never share one map origin.
  const byRef = id => dc.find(d => (d.p.sources || []).some(s => s.record_ref === 'gg2050-dc-' + id));
  for (const [a,b] of [[133,237],[193,231],[56,196],[56,57]]) {
    const x=byRef(a),y=byRef(b);
    assert.ok(x&&y,'Slough records '+a+'/'+b+' present');
    assert.notEqual(x.p.id,y.p.id,'cross-operator source merge '+a+'/'+b);
  }
  const sl = dc.filter(d => hav(...SL, ...d.a) <= 3); assert.ok(sl.length >= 16, 'Slough origins ' + sl.length); assert.ok(new Set(sl.map(d => d.a + '')).size >= 16, 'distinct points');
  assert.match(text(x.host.querySelector('[data-offtakers-status]')), new RegExp(`data centres: ${dc.length} from the open pipeline \\(operational ${dc.filter(d => d.t === 'op').length}`));
  assert.ok(x.host.querySelector('[data-offtakers-dc]').querySelector('[data-offtakers-class="c"]'), 'own chip row'); assert.match(text(x.host.querySelector('[data-offtakers-foot]')), /Data centres \(violet\)/);
  assert.match(JSON.stringify(x.layers.get('l-gridatlas-offtakers').paint['circle-stroke-color']), /#39d98a/, 'status ring');
});

test('DC2: a Slough tap: 30 substations = gridScope = independent haversine, first 5 = nearestSubstations; 30 REPD; 30 conventional; nearest 10 drawn, Show all, Draw all; labels ≤ 6', { skip: DSKIP }, async () => {
  const x = await dcBoot(); const r = sloughDC(x); await x.tapDot(r); await drain(); const c = x.card();
  assert.equal(c.getAttribute('aria-label'), 'Data centre'); assert.equal(tabOf(x, 'a').getAttribute('aria-selected'), 'true', 'Area by default');
  assert.equal(c.querySelectorAll('[role="tab"]').length, 4); deq(x.W.__NS__.at(-1), r.a, 'the original nearestSubstations is called at the site');
  assert.equal(x.S.errors.filter(e => /differs/.test(e)).length, 0, 'scope head = nearestSubstations');
  const is = iSubs(r.a), ns = origNearest(r.a[0], r.a[1], SUBS); assert.equal(is.length, 30);
  await openTab(x, 's'); let rows = prow(x); assert.equal(rows.length, 10);
  await reveal(x); rows = prow(x); assert.equal(rows.length, 30);
  is.forEach((v, i) => assert.ok(rows[i].startsWith(`${i + 1}. ${v.km.toFixed(2)} km · ${Math.max(...v.s.kv)} kV`), `sub ${i + 1}: ${rows[i]} vs ${v.km.toFixed(2)}`));
  ns.forEach((v, i) => assert.ok(rows[i].startsWith(`${i + 1}. ${v.km.toFixed(2)} km`), 'head = original ' + i));
  assert.equal(bySet(x, 's').length, 30); deq(bySet(x, 's').map(f => f.geometry.coordinates[1]), is.map(v => v.s.at));
  // a voltage chip re-ranks within its band from the whole 40 km scope (not from the 30): 275 kV here
  panel(x).querySelector('[data-offtakers-volt="275"]').click(); await drain(5); const i275 = SUBS.map(q => ({ q, km: hav(r.a[0], r.a[1], q.at[0], q.at[1]) })).filter(v => v.km <= 40 && Math.max(...v.q.kv) >= 274.5 && Math.max(...v.q.kv) < 399.5).sort((a, b) => a.km - b.km);
  rows = prow(x); assert.ok(i275.length > 0); assert.equal(rows.length, Math.min(30, i275.length)); i275.slice(0, 30).forEach((v, i) => assert.ok(rows[i].startsWith(`${i + 1}. ${v.km.toFixed(2)} km · ${Math.max(...v.q.kv)} kV`), `275 ${i + 1}: ${rows[i]}`));
  assert.ok(i275[0].km > is[29].km || !is.some(v => Math.max(...v.s.kv) >= 274.5 && Math.max(...v.s.kv) < 399.5), 'the band reaches past the 30 of All');
  panel(x).querySelector('[data-offtakers-volt="all"]').click(); await drain(5);
  await openTab(x, 'r'); const ir = indep(r, { st: 'all', te: 'all' }, 30); rows = prow(x); assert.equal(rows.length, 10); await reveal(x); rows = prow(x);
  assert.equal(rows.length, ir.length); assert.ok(ir.length >= 30); ir.forEach((g, i) => assert.ok(rows[i].startsWith(`${i + 1}. ${g.km.toFixed(2)} km`), `repd ${i + 1}: ${rows[i]}`));
  await openTab(x, 'v'); const ic = iCV(r.a); rows = prow(x); assert.equal(rows.length, 10); await reveal(x); rows = prow(x); assert.equal(rows.length, 30);
  ic.forEach((v, i) => assert.ok(rows[i].startsWith(`${i + 1}. ${v.km.toFixed(2)} km`), `conv ${i + 1}: ${rows[i]} vs ${v.km.toFixed(2)}`));
  const d = ic.filter(v => v.km <= 100).length; assert.match(text(c), new RegExp(`Lines drawn for ${d} of 30 \\(≤100 km\\)`)); assert.equal(bySet(x, 'v').length, d);
  for (const v of ['a', 's', 'r', 'v']) { await openTab(x, v); const f = x.layers.get('gridatlas-offtakers-neon-dc-label').filter; assert.ok(f[2][1].length <= 6, 'labels ≤ 6 on ' + v); }
  assert.ok(x.S.perf.links >= 60 && x.S.perf.links <= 90 && x.S.perf.ms >= 0, JSON.stringify(x.S.perf));
  await openTab(x, 'a'); assert.match(text(x.card()), /Nearest 400 kV /); assert.match(text(x.card()), /Within \(straight line\)/); assert.match(text(x.card()), /IT load and grid connection not stated/);
  const eases = x.camera.filter(q => q[0] === 'easeTo'); assert.ok(eases.length >= 1); for (const [, [o]] of eases) { assert.equal(o.padding, undefined, 'no persistent padding'); assert.ok(o.offset[1] < 0, 'the site sits in the band above the card'); assert.ok(o.zoom >= 7.5 && o.zoom <= 13); }
  const k = x.layers.get('gridatlas-offtakers-neon-dc-core-r').paint['line-dasharray']; deq(k, [2, 2]); assert.equal(x.layers.get('gridatlas-offtakers-neon-dc-core-s').paint['line-color'], '#ffccee');
});

test('DC3: default: nearest 10 of each set drawn; "Draw all" draws every listed link within reach; tab keys move the selection', { skip: DSKIP }, async () => {
  const x = await dcBoot(); const r = sloughDC(x); await x.tapDot(r); await drain();
  assert.equal(bySet(x, 's').length, 10); assert.equal(bySet(x, 'r').length, 10); assert.equal(bySet(x, 'v').length, iCV(r.a).slice(0, 10).filter(v => v.km <= 100).length);
  x.card().querySelector('[data-offtakers-draw-all]').click(); await drain(5);
  assert.equal(bySet(x, 's').length, 30); assert.equal(bySet(x, 'r').length, indep(r, { st: 'all', te: 'all' }, 30).length); assert.equal(bySet(x, 'v').length, iCV(r.a).filter(v => v.km <= 100).length);
  const tl = x.card().querySelector('[role="tablist"]'); tl.listeners.keydown[0]({ key: 'End' }); assert.equal(tabOf(x, 'v').getAttribute('aria-selected'), 'true');
  x.card().querySelector('[role="tablist"]').listeners.keydown[0]({ key: 'ArrowRight' }); assert.equal(tabOf(x, 'a').getAttribute('aria-selected'), 'true');
});

test('DC4: a remote site: conventional always lists 30 (any distance) and draws only ≤100 km; short substation and REPD sets say so', { skip: DSKIP }, async () => {
  const x = await dcBoot(); const r = x.S.data.dots.find(d => d.k === 'c'); r.a = [-1.2, 60.3]; await x.tapDot(r); await drain();
  await openTab(x, 'v'); await reveal(x); const ic = iCV(r.a), rows = prow(x); assert.equal(rows.length, 30); assert.ok(ic[29].km > 100);
  assert.equal(bySet(x, 'v').length, ic.filter(v => v.km <= 100).length); assert.ok(rows.some(t => / · not drawn/.test(t)));
  await openTab(x, 's'); const t = text(x.card()); assert.ok(/Only \d+ substations ≥33 kV within 40 km/.test(t) || /None within 40 km\. Nearest: /.test(t), t.slice(0, 200));
});

test('DC5: CSV: four comment lines and the header; the site, every listed substation, REPD project and conventional site; licences; drawn flag; no formula cells', { skip: DSKIP }, async () => {
  const x = await dcBoot(); const r = sloughDC(x); await x.tapDot(r); await drain();
  x.card().querySelector('[data-offtakers-csv]').click(); await drain(); const csv = x.blobs.at(-1).text, L = csv.trim().split('\n');
  assert.match(L[0], new RegExp(`^# GridAtlas data-centre vicinity sheet · generation ${x.O.generation} · site ${r.p.id}`)); assert.match(L[1], /Not cable routes, capacity, headroom, connection offers or feasibility/);
  assert.match(L[2], /IT load not stated · grid connection not stated\. Never added together/); assert.equal(L[4], 'set,rank,name,ref,type_or_voltage,status,kv_max,kv_all,mw_stated,mw_basis,km_straight_line,lon,lat,drawn_on_map,source,licence,data_date');
  const rows = L.slice(5).map(l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(v => v.replace(/,$/, ''))), n = s => rows.filter(c => c[0] === s).length;
  const parts = indep(r, { st: 'all', te: 'all' }, 30).reduce((s, g) => s + g.parts.length, 0);
  assert.equal(n('data centre'), 1); assert.equal(n('substation'), 30); assert.equal(n('REPD project'), parts); assert.equal(n('conventional'), 30);
  for (const c of rows) { assert.ok(c[15], 'licence ' + c); assert.ok(!/^[=+\-@]/.test(c[2]), 'no formula'); }
  assert.equal(rows.filter(c => c[0] === 'substation' && c[13] === 'yes').length, 10, 'drawn flag follows the map');
  assert.equal(rows.find(c => c[0] === 'data centre')[8], 'not stated', 'IT load not stated, never 0');
});

test('DC6: cleanup: OFF removes every data-centre source, layer, ring and card; cycles leave nothing; no error noted', { skip: DSKIP }, async () => {
  const x = boot(); x.O.install(); const h0 = x.handlers.length;
  for (let k = 0; k < 3; k++) { x.toggle(true); await drain(); await x.tapDot(sloughDC(x)); await drain(); assert.ok(x.sources.get('gridatlas-offtakers-neon-dc-rings'));
    x.toggle(false); assert.equal(x.card(), null); assert.equal([...x.sources.keys()].filter(OTIDS).length, 0); assert.equal([...x.layers.keys()].filter(OTIDS).length, 0); assert.equal(x.handlers.length, h0); assert.equal(x.rafs.size, 0); }
  assert.equal(x.errs.length, 0); assert.equal(x.S.errors.length, 0, x.S.errors.join('; '));
});

test('DC7: a failed data-centre file keeps the offtakers data centres and says why; a failed conventional file falls back to the power-station class and says so', { skip: DSKIP }, async () => {
  const x = await dcBoot({ tamper: DCREL.split('/').pop() }); assert.equal(x.S.data.dots.filter(d => d.k === 'c').length, 164);
  assert.match(text(x.host.querySelector('[data-offtakers-status]')), /data-centre file not loaded: data check failed/);
  const r = x.S.data.dots.find(d => d.k === 'c'); await x.tapDot(r); await drain(); assert.match(text(x.card()), /Status: not tracked/);
  const y = await dcBoot({ tamper: CVREL.split('/').pop() }); await y.tapDot(sloughDC(y)); await drain(); await openTab(y, 'v');
  assert.match(text(y.card()), /From the offtakers power-station class \(the conventional dataset is not loaded: data check failed/); assert.equal(prow(y).length, 10);
});

test('DC8: isolation: no gridScope → "not loaded yet" (no throw); lightning stays installed and working; non-data-centre taps keep 15 REPD + 5 substations', { skip: DSKIP }, async () => {
  const x = await dcBoot({ gridScope: false, lightning: true }); await x.tapDot(sloughDC(x)); await drain(); await openTab(x, 's');
  assert.match(text(x.card()), /Substation data not loaded yet; trying again\./); x.ltoggle(true); await drain(); assert.equal(x.W.__LP__.S.on, true);
  const y = await dcBoot(); const rf = bigSites(y).refinery; await y.tapDot(rf); await drain();
  assert.equal(y.sources.get('gridatlas-offtakers-neon-subs').data.features.length, 5); assert.equal(rowsOf(y.card()).length, indep(rf).length); assert.equal(y.sources.get('gridatlas-offtakers-neon-dc-l'), undefined);
});

test('DC9: rows open their own card; ◀ back to data centre restores the tab', { skip: DSKIP }, async () => {
  const x = await dcBoot(); await x.tapDot(sloughDC(x)); await drain(); await openTab(x, 'r');
  panel(x).querySelector('a').click(); await drain(); assert.equal(x.card().getAttribute('aria-label'), 'REPD project'); assert.match(text(x.card()), /◀ back to data centre/);
  x.card().querySelector('[data-offtakers-back]').click(); await drain(); assert.equal(x.card().getAttribute('aria-label'), 'Data centre'); assert.equal(tabOf(x, 'r').getAttribute('aria-selected'), 'true');
  await openTab(x, 's'); panel(x).querySelector('a').click(); await drain(); assert.equal(x.card().getAttribute('aria-label'), 'Substation');
  assert.match(text(x.card()), /5 nearest REPD sites to this substation/); x.card().querySelector('[data-offtakers-back]').click(); await drain(); assert.equal(tabOf(x, 's').getAttribute('aria-selected'), 'true');
  await openTab(x, 'v'); panel(x).querySelector('a').click(); await drain(); assert.equal(x.card().getAttribute('aria-label'), 'Conventional power site'); assert.match(text(x.card()), /nearest substations to this site/);
});

test('DC10: schema checks and the URL allow-list: bad records are skipped and counted, never repaired; Marchwood is gas', { skip: DSKIP }, async () => {
  const x = await dcBoot(); const P = x.P, ok = { id: 'DC-X-1', name: 'A', status: 'operational', sources: [{ licence: 'ODbL 1.0' }] }, pt = (p, c = [-0.6, 51.5]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: p });
  const r = P.dn([pt(ok), pt({ ...ok, sources: [{ licence: 'CC BY-NC 4.0' }] }), pt({ ...ok, sources: [{ licence: 'CC BY-ND 4.0' }] }), pt(ok, [5, 40]), pt({ ...ok, id: 'x y' }), pt({ ...ok, sources: 'x' }), pt({ ...ok, site_kind: 'cable_landing_station' }), null]);
  assert.equal(r.o.length, 1); assert.equal(r.bad, 6); assert.equal(r.cl, 1);
  const q = P.cn([pt({ ...ok, mw: -3, fuel: 'unstated', status: 'odd' }), pt({ ...ok, in_nearest_default: false }), pt({ ...ok, mw: 1e9 })]);
  assert.equal(q.o.length, 2); assert.equal(q.o[0].mw, null); assert.equal(q.o[0].f, 'fuel not stated'); assert.equal(q.o[0].st, 'status unknown'); assert.equal(q.o[1].mw, null);
  assert.throws(() => P.AL('https://example.com/x.geojson'), /not allow-listed/); assert.throws(() => P.AL('https://ventusltd.github.io/gridatlas/data/../x.js'), /not allow-listed/);
  const m = x.S.data.dots.find(d => d.p.id === 'OT-B-0823'); assert.equal(m.p.subclass, 'gas_ccgt_large'); await x.tapDot(m); await drain(); assert.match(text(x.card()), /Marchwood .*gas CCGT large/); assert.equal(/biomass/.test(text(x.card()).split('Within 5 km')[0]), false);
  assert.ok(!/https:\/\/(?!ventusltd\.github\.io\/gridatlas\/data\/)/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), 'no other host in the bytes');
});

test('DC11: MW wording: IT load and grid connection apart, never derived or added; an unlabelled MW is quoted with its own label and never sizes the dot', { skip: DSKIP }, async () => {
  const x = await dcBoot(), D = n => x.S.data.dots.find(d => d.k === 'c' && new RegExp(n).test([d.p.name,...(d.p.aliases||[])].join(' ')));
  const q = D('QuestPit'), c = D('Court Lane'), mf = D('Manor Farm');
  assert.ok(q && c && mf, 'the pinned pipeline has the DC-A3 sites QuestPit, Court Lane (Iver) and Manor Farm (Slough)');
  await x.tapDot(q); await drain(); assert.match(text(x.card()), /IT load 720 MW · grid connection 200 MW/); assert.equal(q.z, 2);
  await x.tapDot(c); await drain(); assert.match(text(x.card()), /Grid connection 140 MW · IT load not stated/);
  await x.tapDot(mf); await drain(); const t = text(x.card()); assert.match(t, /IT load 72 MW · grid connection not stated/); assert.match(t, /Also stated: 100 MW, not said to be IT load or grid connection \(battery energy storage capacity \(BESS\); not data-centre load\); not added to either\./);
  assert.equal(mf.z, 1.6, 'sized by the 72 MW IT load, not the 100 MW battery');
  const un = x.S.data.dots.filter(d => d.k === 'c' && d.p.unclassified_mw && d.p.unclassified_mw.value > 0 && !(d.p.it_load_mw && d.p.it_load_mw.value) && !(d.p.grid_connection_mw && d.p.grid_connection_mw.value));
  assert.ok(un.length >= 1, 'a site with only an unlabelled MW'); for (const d of un) assert.equal(d.z, 1, 'an unlabelled MW never sizes the dot: ' + d.n); assert.match(t, /A pipeline entry is not a commitment/);
  assert.equal(/\b(172|212|243) MW\b/.test(t), false, 'never summed');
});
