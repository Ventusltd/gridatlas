#!/usr/bin/env node
// kv-security repro: node:vm + minidom.mjs against the published Build I module (or MODULE=<path>).
// Usage: node repro.mjs            -> runs every case against the live module and prints PROVEN / not proven.
//        MODULE=patched.js node repro.mjs   -> same cases against a patched copy (expect every case FIXED).
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { makeDocument, dispatch } from '../opus-fix-designer/minidom.mjs';

const HERE = new URL('.', import.meta.url).pathname;
const MODULE = process.env.MODULE || HERE + '../../wt/atlas/modules/202610270929-uk-lightning-overlay.js';
const SRC = readFileSync(MODULE, 'utf8');
const SEAM = 'NS.ukLightning=Object.freeze(';
if (SRC.split(SEAM).length !== 2) throw new Error('seam');
const CODE = SRC.replace(SEAM, 'window.__PROBE__={S};' + SEAM);
const H = 36e5, iso = t => new Date(t).toISOString();
const flash = (t, id, c = [-1.5, 52]) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: c }, properties: { time_utc: iso(t), observation_kind: 'optical_lightning_flash' } });
const feedOf = fs => ({ type: 'FeatureCollection', features: fs, metadata: { query_start_utc: iso(Date.now() - 4 * H), query_end_utc: iso(Date.now() - H), scan_end_utc: iso(Date.now() - H), latest_detection_utc: null } });
const drain = async () => { for (let k = 0; k < 20; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const haversine = (lo1, la1, lo2, la2) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.sqrt(a)); };

function boot(feedText) {
  const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const kg = doc.createElement('div'); kg.className = 'key-group'; host.appendChild(kg);
  const bar = doc.createElement('div'); bar.id = 'gridatlas-menu-bar'; body.appendChild(bar);
  const grid = doc.createElement('div'); grid.className = 'gm-panel-grid'; bar.appendChild(grid);
  const pb = doc.createElement('div'); pb.className = 'gm-panel-body'; grid.appendChild(pb);
  const mapEl = doc.createElement('div'); body.appendChild(mapEl); mapEl._rect = { top: 0, left: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
  const sources = new Map(), layers = new Map(), handlers = []; let qrf = () => [], proj = ll => ({ x: ll[0] * 10 + 500, y: 400 - ll[1] });
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; } }), addLayer: x => layers.set(x.id, x),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty() {}, getContainer: () => mapEl, project: ll => proj(ll),
    on: (t, a, b) => handlers.push({ t, f: b || a }), off: (t, f) => { const i = handlers.findIndex(h => h.t === t && h.f === f); if (i >= 0) handlers.splice(i, 1); },
    queryRenderedFeatures: (pt, o) => (o.layers || []).flatMap(l => qrf(l)), easeTo() {}, fitBounds() {} };
  // MapLibre 3.6.2 Evented.fire: listeners run in a plain loop with no try/catch, so a throw skips the later ones
  const fire = (t, e) => { for (const h of handlers.filter(h => h.t === t)) h.f(e); };
  const errors = [], winL = {};
  class XHR { open(m, u) { this.url = u; } send() { setTimeout(() => { this.status = 200; this.responseURL = this.url; this.responseText = feedText(); this.onload(); }, 0); } }
  const fetch = async () => new Response('nope', { status: 404 });
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight: 900, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true }, addEventListener: (t, f) => (winL[t] = winL[t] || []).push(f) };
  const sb = { window: W, document: doc, Date, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} disconnect() {} }, innerHeight: 900, addEventListener: W.addEventListener };
  const ctx = vm.createContext(sb); vm.runInContext(CODE, ctx, { filename: MODULE });
  // window === global in a browser: mirror the window object's own props onto the context so prototype reads behave alike
  const api = W.__GRIDATLAS_MODULES__.ukLightning; if (!api.install()) throw new Error('install');
  const S = W.__PROBE__.S, sf = S.sfs[0];
  const toggle = on => { sf.toggle.checked = on; dispatch(sf.toggle, 'change', errors); };
  const tap = (pt, hits) => { qrf = l => (l === 'l-gridatlas-lightning-hit' ? hits : []); try { fire('click', { point: pt }); } catch (e) { errors.push(e); } };
  const card = () => mapEl.querySelector('[data-lightning-card]');
  const nearest = () => dispatch(card().querySelector('[data-lightning-nearest]'), 'click', errors);
  return { W, S, ctx, map, mapEl, sources, layers, handlers, errors, toggle, tap, card, nearest, fire, setProj: f => { proj = f; } };
}
// hits are what MapLibre would return: the properties Lightning itself put on the source feature
const hitAt = (x, i = 0) => { const f = (x.sources.get('gridatlas-lightning')?.data.features || [])[i]; return f ? [{ properties: { ...f.properties }, geometry: f.geometry }] : []; };
const results = [];
const R = (id, proven, detail) => { results.push({ id, proven, detail }); console.log(`${proven ? 'PROVEN ' : 'not-proven/FIXED'}  ${id}  ${detail}`); };
const lines = c => c.children.filter(e => e.tagName === 'DIV').map(e => e.textContent);

// ---- C1: bidi / zero-width / very long flash ID reach the card verbatim (textContent: no XSS, but spoofable + unbounded)
{
  const RLO = '‮', ZW = '​', long = 'X'.repeat(200000);
  for (const [name, id] of [['RLO', 'abc' + RLO + '321-dif'], ['ZWSP', 'f1' + ZW], ['200k chars', long], ['markup', '<img src=x onerror=alert(1)>']]) {
    const x = boot(() => JSON.stringify(feedOf([flash(Date.now() - 2 * H, id)]))); x.toggle(true); await drain(); x.tap({ x: 485, y: 348 }, hitAt(x));
    const c = x.card(), idLine = lines(c).find(s => s.startsWith('Flash ID ')), imgs = c.querySelectorAll('img').length;
    if (name === 'markup') R('C1-markup', imgs !== 0, `markup id rendered as text, <img> elements created: ${imgs} (textContent holds)`);
    else R('C1-' + name, /[​-‏‪-‮⁦-⁩]/.test(idLine) || idLine.length > 1000, `ID line length ${idLine.length}, contains format chars: ${/[​-‏‪-‮⁦-⁩]/.test(idLine)}`);
  }
}
// ---- C2: a JSON object ID whose own "toString" is not callable throws inside the map click handler
{
  const raw = JSON.stringify(feedOf([flash(Date.now() - 2 * H, 'PLACEHOLDER')])).replace('"PLACEHOLDER"', '{"toString":1}');
  const x = boot(() => raw); let later = 0; x.toggle(true); await drain(); x.map.on('click', () => later++);
  x.tap({ x: 485, y: 348 }, hitAt(x));
  R('C2-object-id', x.errors.length > 0 && !x.card(), `accepted ev=${x.S.res.ev.length}; tap threw: ${x.errors.map(e => e.message).join('; ') || 'no'}; card opened: ${!!x.card()}; later click listener ran: ${later}`);
}
// ---- C3: card positioning with NaN projection and a zero-size map container
{
  const x = boot(() => JSON.stringify(feedOf([flash(Date.now() - 2 * H, 'n1')]))); x.toggle(true); await drain();
  const P0 = x.map.project; x.setProj(() => ({ x: NaN, y: NaN })); x.tap({ x: 0, y: 0 }, hitAt(x));
  const opened = !!x.card(); x.setProj(ll => ({ x: ll[0] * 10 + 500, y: 400 - ll[1] })); x.tap({ x: 485, y: 348 }, hitAt(x));
  const c = x.card(), l0 = c.style.left, t0 = c.style.top; x.setProj(() => ({ x: NaN, y: NaN })); x.fire('move');
  R('C3-NaN', /NaN/.test(c.style.left + c.style.top), `tap under NaN projection opens a card: ${opened} (dm stays Infinity: safe); open card then a NaN 'move': left ${l0} -> ${c.style.left}, top ${t0} -> ${c.style.top} (a browser drops 'NaNpx' and keeps the stale position)`);
}
// ---- C4: stale hit-feature index after a refresh (setData is async in MapLibre; rendered tiles still carry old i)
{
  let fs = [flash(Date.now() - 2 * H, 'OLD-near-Wymondley', [-0.25, 51.95])];
  const x = boot(() => JSON.stringify(feedOf(fs))); x.toggle(true); await drain();
  const oldHit = hitAt(x); // what the not-yet-re-rendered tile still returns
  fs = [flash(Date.now() - 1 * H, 'NEW-in-Cornwall', [-5.0, 50.2])]; x.W.__GRIDATLAS_MODULES__.ukLightning.load(); await drain();
  x.tap({ x: 497.5, y: 348 }, oldHit);
  const id = x.card() ? lines(x.card()).find(s => s.startsWith('Flash ID')) : '(no card: stale hit refused)';
  R('C4-stale-index', /NEW/.test(id), `tapped the rendered OLD flash at -0.25,51.95 before re-render; card shows "${id}"${x.card() ? ' / ' + lines(x.card())[2] : ''}`);
}
const SUBS = [{ at: [-1.6, 52.0], kv: [132], name: 'A 132' }, { at: [-1.5, 52.3], kv: [400, 132], name: 'B 400' }, { at: [-2.5, 52.0], kv: [275], name: 'C 275' }];
const nearBoot = async L => { const x = boot(() => JSON.stringify(feedOf([flash(Date.now() - 2 * H, 'z')]))); x.toggle(true); await drain(); if (L) x.W.__GRIDATLAS_NEON_LINKS__ = L; x.tap({ x: 485, y: 348 }, hitAt(x)); return x; };
// ---- C5: a getter on __GRIDATLAS_NEON_LINKS__.substations that throws
{
  const x = await nearBoot({ substations: SUBS, measure: { distanceKm: haversine } }); x.nearest();
  const before = x.sources.has('gridatlas-lightning-nearest');
  const L = { measure: { distanceKm: haversine } }; Object.defineProperty(L, 'substations', { get() { throw new Error('getter boom'); } }); x.W.__GRIDATLAS_NEON_LINKS__ = L;
  x.nearest();
  R('C5-throwing-getter', x.errors.length > 0, `listener threw: ${x.errors.map(e => e.message).join('; ')}; user message shown: ${/unavailable|not loaded/i.test(x.card().textContent)}; previous lines still drawn: ${before && x.sources.has('gridatlas-lightning-nearest')}`);
}
// ---- C6: substations replaced by a non-array (string / array-like)
for (const [n, v] of [['string', 'Wymondley'], ['array-like', { length: 3 }]]) {
  const x = await nearBoot({ substations: v, measure: { distanceKm: haversine } }); x.nearest();
  R('C6-' + n, x.errors.length > 0, `listener threw: ${x.errors.map(e => e.message).join('; ') || 'no'}`);
}
// ---- C7: distanceKm returns a numeric string ("isFinite" coerces; .toFixed then throws after the old lines were removed)
{
  const x = await nearBoot({ substations: SUBS, measure: { distanceKm: (...a) => String(haversine(...a)) } }); x.nearest();
  R('C7-string-km', x.errors.length > 0, `listener threw: ${x.errors.map(e => e.message).join('; ') || 'no'}; card text after: "${x.card().textContent.slice(-90)}"`);
}
// ---- C8: prototype pollution before link.substations is assigned (it is NOT an own property until loadSubstations resolves, cartridge l.3503)
{
  const x = await nearBoot(null); // real pre-load shape: no own 'substations'; object made in the page realm
  x.W.__GRIDATLAS_NEON_LINKS__ = vm.runInContext('({substations_loaded:0})', x.ctx); x.W.__GRIDATLAS_NEON_LINKS__.measure = { distanceKm: haversine };
  vm.runInContext(`Object.prototype.substations=[{at:[-1.5001,52.0001],kv:[400],name:'\\u202Eniaga yrt :TRUCK OT NUR'}]`, x.ctx);
  x.nearest(); const t = x.card().textContent, src = x.sources.get('gridatlas-lightning-nearest');
  vm.runInContext('delete Object.prototype.substations', x.ctx);
  R('C8-proto-pollution', /TRUCK/.test(t), `polluted substation listed: ${/TRUCK/.test(t)}; line drawn to it: ${!!(src && src.data.features.some(f => f.geometry.type === 'LineString'))}`);
  // the __GRIDATLAS_SUBSTATIONS__ fallback is never assigned anywhere in atlas/ (grep) and also resolves through the prototype
  const y = await nearBoot(null); const y0 = y; delete y.W.__GRIDATLAS_NEON_LINKS__;
  vm.runInContext(`Object.prototype.__GRIDATLAS_SUBSTATIONS__=[{at:[-1.5,52.01],kv:[400],name:'FAKE'}]`, y.ctx);
  const Wp = Object.getPrototypeOf(y.W); // y.W is a host object whose prototype is the OUTER Object.prototype; emulate a browser window (inherits page Object.prototype)
  Object.setPrototypeOf(y.W, vm.runInContext('Object.prototype', y.ctx));
  y.W.__GRIDATLAS_NEON_LINKS__ = { measure: { distanceKm: haversine } }; y.nearest(); Object.setPrototypeOf(y.W, Wp);
  R('C8b-dead-fallback', /FAKE/.test(y.card().textContent), `window.__GRIDATLAS_SUBSTATIONS__ (never assigned) read through the prototype: ${/FAKE/.test(y.card().textContent)}`);
}
// ---- C9: memory — 1,000 open/NEAREST/close cycles and 100 OFF/ON cycles
{
  const x = await nearBoot({ substations: SUBS, measure: { distanceKm: haversine } }); const h0 = x.handlers.length, n0 = x.mapEl.children.length;
  for (let k = 0; k < 1000; k++) { x.tap({ x: 485, y: 348 }, hitAt(x)); x.nearest(); x.fire('move'); dispatch(x.card().querySelector('button'), 'click', x.errors); }
  for (let k = 0; k < 100; k++) { x.toggle(false); x.toggle(true); }
  await drain();
  const h1 = x.handlers.length, n1 = x.mapEl.children.length, srcs = [...x.sources.keys()].filter(k => k.includes('nearest')).length;
  R('C9-leak', h1 !== h0 || n1 > n0, `map listeners ${h0} -> ${h1} (${x.handlers.map(h => h.t).join(',')}); map-container children ${n0} -> ${n1}; nearest sources ${srcs}; errors ${x.errors.length}`);
}
// ---- C10: hostile time strings (control: the time line is rebuilt from Date.parse + toISOString, so it cannot carry text)
{
  const times = ['2026-10-27T10:00:00Z‮', '​2026-10-27T10:00:00Z', '2026-10-27T10:00:00' + '0'.repeat(500000) + 'x', 'T' + '1'.repeat(500000) + 'x'];
  const fs = times.map((t, k) => ({ ...flash(0, 'h' + k), properties: { time_utc: t, observation_kind: 'optical_lightning_flash' } }));
  const t0 = Date.now(); const x = boot(() => JSON.stringify(feedOf(fs))); x.toggle(true); await drain();
  R('C10-time', x.S.res.ev.length !== 0, `hostile times accepted: ${x.S.res.ev.length} of ${times.length}; rejected as malformed: ${x.S.res.ev.bad}; parse+filter took ${Date.now() - t0} ms (no ReDoS in /T[\\d:.]+$/)`);
}
console.log(JSON.stringify({ module: MODULE, bytes: SRC.length, proven: results.filter(r => r.proven).map(r => r.id) }));
