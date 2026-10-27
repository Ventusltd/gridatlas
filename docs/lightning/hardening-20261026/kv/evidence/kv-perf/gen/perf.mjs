#!/usr/bin/env node --expose-gc
// perf.mjs (kv-perf) — Build I module under node:vm + minidom, simulated fetch served from an archive dir on disk.
// Usage: node --expose-gc perf.mjs <archiveDir> <nowISO> <period> <phone 0|1> <consent 0|1> <net none|4g> [refresh 0|1]
// One scenario per process so maxRSS is per scenario. Prints one JSON line.
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { makeDocument, dispatch } from './minidom.mjs';

const [ARCH, NOWISO, PERIOD, PHONE, CONSENT, NET, REFRESH] = process.argv.slice(2);
const NOW = Date.parse(NOWISO), phone = PHONE === '1';
const SRC = readFileSync(new URL(process.env.MOD || './module-I.js', import.meta.url), 'utf8');
const SEAM = 'NS.ukLightning=Object.freeze(';
const code = SRC.replace(SEAM, 'window.__PROBE__={S};' + SEAM);
// 4G model: 80 ms RTT per request, 2.5 MB/s shared by the 4 module workers (approx: per-request share = 2.5/active)
const RTT = 80, BW = 2.5e6;
let active = 0;
const T = { fetch: 0, bytes: 0, files: 0, parseMs: 0, digestMs: 0, idxBytes: 0, urls: [] };
class R extends Response { async json() { const t = performance.now(); const v = await super.json(); T.parseMs += performance.now() - t; return v; } }
const subtle = { digest: async (a, b) => { const t = performance.now(); const v = await webcrypto.subtle.digest(a, b); T.digestMs += performance.now() - t; return v; } };
const fetch = async url => {
  const k = url.split('/history/')[1].split('?')[0], p = ARCH + '/' + k;
  if (!existsSync(p)) return new R('nope', { status: 404 });
  const buf = readFileSync(p); T.fetch++; T.bytes += buf.length; if (k === 'index.json') T.idxBytes += buf.length; else { T.files++; T.urls.push(k); }
  if (NET === '4g') { active++; await new Promise(r => setTimeout(r, RTT + buf.length / (BW / Math.max(1, active)) * 1000)); active--; }
  return new R(buf, { status: 200 });
};
const doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body);
const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
const orig = doc.createElement('div'); orig.className = 'key-group'; host.appendChild(orig);
const curtain = doc.createElement('div'); curtain.id = 'fs-curtain-keys'; body.appendChild(curtain);
const bar = doc.createElement('div'); bar.id = 'gridatlas-menu-bar'; body.appendChild(bar);
const grid = doc.createElement('div'); grid.className = 'gm-panel-grid'; bar.appendChild(grid);
const pbody = doc.createElement('div'); pbody.className = 'gm-panel-body'; grid.appendChild(pbody);
const sources = new Map(), layers = new Map(); let setDataN = 0;
const mapEl = doc.createElement('div'); mapEl.id = 'map'; body.appendChild(mapEl);
const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; setDataN++; } }), addLayer: x => layers.set(x.id, { ...x }),
  removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty() {}, on() {}, getContainer: () => mapEl, project: ll => ({ x: 0, y: 0 }),
  getBounds: () => ({ contains: () => true }), fitBounds() {}, easeTo() {} };
class XHR { open(m, u) { this.url = u; } send() { setTimeout(() => { this.status = 404; this.onload(); }, 0); } }
const intervals = [];
class D extends Date { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } }
const W = { maplibregl: { Popup: class {} }, __GRIDATLAS_V9_MAP__: map, innerWidth: phone ? 393 : 1440, innerHeight: 852, crypto: { subtle }, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true }, addEventListener() {} };
const sandbox = { window: W, document: doc, Date: D, AbortController, Map, XMLHttpRequest: XHR, fetch, Response: R, TextDecoder, setTimeout, clearTimeout,
  setInterval: (f, ms) => { intervals.push({ f, ms }); return intervals.length; }, clearInterval() {}, matchMedia: () => ({ matches: phone }),
  MutationObserver: class { observe() {} disconnect() {} }, innerHeight: 852, addEventListener() {}, maplibregl: { Popup: class {} } };
vm.runInNewContext(code, sandbox, { filename: 'module-I.js', timeout: 5000 });
W.__GRIDATLAS_MODULES__.ukLightning.install();
const S = W.__PROBE__.S, sf = S.sfs[0];
const settle = async () => { const t0 = performance.now(); await new Promise(r => setImmediate(r)); while (S.busy) await new Promise(r => setTimeout(r, 2)); return performance.now() - t0; };
const reset = () => { for (const k of ['fetch', 'bytes', 'files', 'parseMs', 'digestMs', 'idxBytes']) T[k] = 0; T.urls = []; };
const mem = () => { global.gc(); global.gc(); return +(process.memoryUsage().heapUsed / 1048576).toFixed(1); };
const snap = (wall, heap0) => ({ wallMs: Math.round(wall), requests: T.fetch, files: T.files, bytes: T.bytes, idxBytes: T.idxBytes, parseMs: Math.round(T.parseMs), digestMs: Math.round(T.digestMs),
  drawn: S.res && S.res.ev.length, sourceFeatures: sources.get('gridatlas-lightning')?.data?.features?.length ?? 0, cluster: !!sources.get('gridatlas-lightning')?.cluster,
  heapRetainedMB: +(mem() - heap0).toFixed(1), last: S.last, label: sf.label.textContent, status: sf.stx.textContent, flashes: sf.caps.flashes.textContent, warning: sf.caps.warning.textContent,
  loadPointsVisible: !sf.nav.points.hidden, lruSize: null });
const heap0 = mem();
const tog = sf.toggle; tog.checked = true; dispatch(tog, 'change', []);
await settle(); const idxRun = { requests: T.fetch, bytes: T.bytes };
reset();
if (process.env.END) S.end = Date.parse(process.env.END);
let t0 = performance.now();
if (process.env.CUSTOM) { const [f, t] = process.env.CUSTOM.split(':'); S.period = 'custom'; sf.from.value = f; sf.to.value = t; dispatch(sf.nav.apply, 'click', []); } else dispatch(sf.chips[PERIOD], 'click', []);
await settle();
const out = { arch: ARCH.split('/').pop(), period: PERIOD, phone, net: NET, boot24h: idxRun, first: snap(performance.now() - t0, heap0) };
if (CONSENT === '1' && !sf.nav.points.hidden) { reset(); t0 = performance.now(); dispatch(sf.nav.points, 'click', []); await settle(); out.consent = snap(performance.now() - t0, heap0); }
if (REFRESH === '1') { reset(); const tick = intervals.find(i => i.ms === 6e5); t0 = performance.now(); tick.f(); await settle(); out.refresh = snap(performance.now() - t0, heap0); }
out.maxRssMB = Math.round(process.resourceUsage().maxRSS / 1024);
console.log(JSON.stringify(out));
process.exit(0);
