// node-harness.mjs — security lane. Runs the REAL 202610262323 module bytes under node:vm with minidom (copied from
// opus-fix-designer), fake clock 2026-10-26T18:40:00Z, and serves the SYNTHETIC hostile fixtures in ./fixtures.
// fetch URLs are normalised with WHATWG URL exactly as a browser would; only https://raw.githubusercontent.com/Ventusltd/lightning/main/data/
// is served, anything else is recorded as OFF-PATH and answered 404. Every innerHTML write is recorded.
// usage: node node-harness.mjs <module.js> <case> [<case>...]
import vm from 'node:vm'; import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'; import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url'; import { webcrypto } from 'node:crypto'; import { El, makeDocument, dispatch } from './minidom.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)); const [MOD, ...CASES] = process.argv.slice(2); const SRC = readFileSync(MOD, 'utf8');
const DIR = { S0: join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data') };
const FX = { S1: 'S1-xss', S2: 'S2-xss-schema', S3: 'S3-proto', S4a: 'S4a-count-inf', S4b: 'S4b-count-types', S4c: 'S4c-extreme-header', S5: 'S5-parts-traversal', S6: 'S6-parts-flood', S7: 'S7-giant-index', S8: 'S8-scanwindow-spread', S9: 'S9-giant-feed', S10: 'S10-feed-coords-ids', S10b: 'S10b-feed-noid-only', S11: 'S11-click-props' };
const PFX = '/Ventusltd/lightning/main/data/'; const NOW0 = Date.parse('2026-10-26T18:40:00Z'), REAL0 = Date.now();
const htmlWrites = []; const desc = Object.getOwnPropertyDescriptor(El.prototype, 'innerHTML');
Object.defineProperty(El.prototype, 'innerHTML', { set(v) { htmlWrites.push(String(v)); desc.set.call(this, v) } });
class FD extends Date { constructor(...a) { a.length ? super(...a) : super(NOW0 + (Date.now() - REAL0)) } static now() { return NOW0 + (Date.now() - REAL0) } }
const out = {};
for (const name of CASES) {
  const data = DIR[name] || join(HERE, 'fixtures', FX[name], 'data'); htmlWrites.length = 0;
  const log = { fetch: [], offPath: [], xhr: 0, served: 0, bytesServed: 0, maxConcurrent: 0, inflight: 0, errors: [] };
  const serve = u => { const x = new URL(u); if (x.host !== 'raw.githubusercontent.com' || !x.pathname.startsWith(PFX)) { log.offPath.push(x.href); return null }
    const p = join(data, decodeURIComponent(x.pathname.slice(PFX.length))); if (!p.startsWith(data) || !existsSync(p)) return null; const b = readFileSync(p); log.served++; log.bytesServed += b.length; return b };
  const fetch = async (u, o) => { log.fetch.push(u); log.inflight++; log.maxConcurrent = Math.max(log.maxConcurrent, log.inflight); await new Promise(r => setTimeout(r, 1));
    try { const b = serve(u); return b ? new Response(b, { status: 200 }) : new Response('nope', { status: 404 }) } finally { log.inflight-- } };
  class XHR { open(m, u) { this.url = u } send() { log.xhr++; log.fetch.push(this.url); setTimeout(() => { const b = serve(this.url); if (!b) { this.status = 404; this.onload(); return } this.status = 200; this.responseText = b.toString('utf8'); this.onload() }, 1) } }
  const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host); const og = doc.createElement('div'); og.className = 'key-group'; host.appendChild(og);
  const sources = new Map(), layers = new Map();
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x } }), addLayer: x => layers.set(x.id, { ...x }),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) { l.layout = { ...l.layout, [k]: v } } } };
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const sb = { window: W, document: doc, Date: FD, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => { }, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() { } disconnect() { } } };
  vm.runInNewContext(SRC, sb, { filename: MOD }); const api = W.__GRIDATLAS_MODULES__.ukLightning; api.install(); const S = api.state, main = S.sfs[0];
  const protoBefore = Object.keys(Object.prototype).length;
  const t0 = performance.now(), m0 = process.memoryUsage().heapUsed; main.toggle.checked = true; dispatch(main.toggle, 'change', log.errors);
  let maxHeap = m0; while (!S.last || /LOAD/.test(main.label.textContent)) { await new Promise(r => setTimeout(r, 20)); maxHeap = Math.max(maxHeap, process.memoryUsage().heapUsed); if (performance.now() - t0 > 240000) break }
  const caps = Object.fromEntries(Object.entries(main.caps).map(([k, n]) => [k, n.textContent.slice(0, 300)]));
  const src = sources.get('gridatlas-lightning');
  out[name] = { fixture: data, ms: Math.round(performance.now() - t0), heapDeltaMB: Math.round((maxHeap - m0) / 1048576), requests: S.requests, fetchCount: log.fetch.length, xhr: log.xhr, served: log.served, bytesServed: log.bytesServed, maxConcurrent: log.maxConcurrent,
    offPath: [...new Set(log.offPath)].slice(0, 20), offPathCount: log.offPath.length, last: S.last, errors: S.errors.slice(-3).map(e => String(e).slice(0, 300)), label: main.label.textContent, status: main.stx.textContent.slice(0, 300), caps,
    drawn: src && src.data ? src.data.features.length : null, htmlWritesWithData: htmlWrites.filter(h => /onerror|onload|<script|__PWN/.test(h)).length, htmlWrites: htmlWrites.length,
    protoPolluted: ({}).polluted ?? Object.prototype.polluted ?? null, protoKeysAdded: Object.keys(Object.prototype).length - protoBefore, listenerErrors: log.errors.map(String) };
  console.log(name, JSON.stringify({ ms: out[name].ms, heapMB: out[name].heapDeltaMB, req: out[name].requests, off: out[name].offPathCount, html: out[name].htmlWritesWithData, proto: out[name].protoPolluted, last: S.last && { st: S.last.state, mode: S.last.mode, drawn: S.last.drawn, idx: S.last.index_count }, err: out[name].errors.slice(-1) }));
}
mkdirSync(join(HERE, 'node-runs'), { recursive: true }); writeFileSync(join(HERE, 'node-runs', CASES.join('_') + '.json'), JSON.stringify(out, null, 1));
