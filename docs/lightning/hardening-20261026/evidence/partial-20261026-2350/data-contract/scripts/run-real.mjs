#!/usr/bin/env node
// run-real.mjs — data-contract lane. Runs the 202610262323 overlay's OWN parsing/validation (ni/vk via li, sh, ok, co,
// cv, cf, cp) and the full panel flow against REAL data files (set dir = a copy of a lightning ref's data/ tree, or the
// collector's own history.py output). Harness: self-fixture under node:vm + minidom (synthetic DOM shell); data real.
// usage: MODULE=<overlay.js> node run-real.mjs <setDir/data> [NOW_ISO]
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { makeDocument, dispatch } from './minidom.mjs';

const MODULE = process.env.MODULE, DIR = process.argv[2], NOW = process.argv[3];
const SRC = readFileSync(MODULE, 'utf8'), SEAM = 'NS.ukLightning=Object.freeze(';
if (SRC.split(SEAM).length !== 2) throw new Error('seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S,ni,cv,tg,co,isFC,wf,stale};' + SEAM);
const off = NOW ? Date.parse(NOW) - Date.now() : 0;
class FDate extends Date { constructor(...a) { a.length ? super(...a) : super(Date.now() + off); } static now() { return Date.now() + off; } }
FDate.parse = Date.parse; FDate.UTC = Date.UTC;

const AR = 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/';
const file = url => { if (!url.startsWith(AR)) return null; const p = join(DIR, url.slice(AR.length)); return existsSync(p) ? readFileSync(p) : null; };
const log = { fetch: [], xhr: [], errors: [] };
const fetch = async url => { const b = file(url); log.fetch.push([url.slice(AR.length), b ? 200 : 404]); await null; return b ? new Response(b, { status: 200 }) : new Response('404: Not Found', { status: 404 }); };
class XHR { open(m, u) { this.url = u; } send() { const b = file(this.url); log.xhr.push([this.url.slice(AR.length), b ? 200 : 404]); setTimeout(() => { this.status = b ? 200 : 404; this.responseText = b ? b.toString('utf8') : '404: Not Found'; this.onload(); }, 0); } }

const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
const g0 = doc.createElement('div'); g0.className = 'key-group'; host.appendChild(g0);
const map = (() => { const s = new Map(), l = new Map(); return { s, l, getLayer: i => l.get(i), getSource: i => s.get(i), addSource: (i, o) => s.set(i, { ...o, setData(x) { this.data = x; } }), addLayer: x => l.set(x.id, { ...x }), removeLayer: i => l.delete(i), removeSource: i => s.delete(i), setLayoutProperty(i, k, v) { const y = l.get(i); if (y) { y.layout = y.layout || {}; y.layout[k] = v; } } }; })();
const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
const timers = [];
vm.runInNewContext(PROBED, { window: W, document: doc, Date: FDate, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
  setInterval: (f, ms) => { timers.push(f); return timers.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} disconnect() {} } }, { filename: MODULE });
const P = W.__PROBE__, api = W.__GRIDATLAS_MODULES__.ukLightning;
if (!api.install()) throw new Error('install ' + JSON.stringify(P.S.waiting_for));
const sf = P.S.sfs[0];
const drain = async () => { for (let k = 0; k < 40; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const out = { set: DIR, now: new FDate().toISOString(), module: MODULE, unit: {}, panel: [] };

// ---- unit: index
const ib = file(AR + 'history/index.json');
if (!ib) out.unit.index = 'HTTP 404 (absent)';
else { try { const x = P.ni(JSON.parse(ib)); out.unit.index = { ok: true, rows: x.days.length, cutoff: x.cutoffDate, gen: new Date(x.gen).toISOString(), iv: x.iv, nextDue: new Date(x.nextDue).toISOString(), covStart: new Date(x.covStart).toISOString(), lastScan: x.lastScan && new Date(x.lastScan).toISOString(), windows: x.sw.length, stale_now: P.stale(x, FDate.now()) };
  const shards = []; for (const r of x.days) for (const t of P.tg(r, -Infinity, Infinity)) { try { const f = await P.sh(t, r.date); shards.push({ date: r.date, path: t.path, ok: true, features: f.length, okFeatures: f.filter(P.ok).length }); } catch (e) { shards.push({ date: r.date, path: t.path, ok: false, error: e.message }); } }
  out.unit.shards = shards;
  const c = P.cv(x, Date.parse('2026-10-20T00:00:00Z'), FDate.now()); out.unit.cv_since_20oct = { f: +c.f.toFixed(4), runs: c.r, unknownDates: c.u.length, days: c.d, notYet_min: Math.round(c.ny / 6e4), beforeStart_min: Math.round(c.bf / 6e4) };
} catch (e) { out.unit.index = { ok: false, error: e.message }; } }
// ---- unit: feed
const fb = file(AR + 'uk_lightning.geojson');
if (!fb) out.unit.feed = 'HTTP 404'; else { const f = JSON.parse(fb); const acc = f.features.filter(P.ok);
  const m = f.metadata || {}; out.unit.feed = { isFC: !!P.isFC(f), features: f.features.length, accepted: acc.length, rejected: f.features.length - acc.length,
    meta_keys_module_reads: Object.fromEntries(['query_start_utc', 'query_end_utc', 'latest_detection_utc'].map(k => [k, m[k] ?? '(missing)'])),
    first: acc.length ? acc.map(z => z.properties.time_utc).sort()[0] : null, last: acc.length ? acc.map(z => z.properties.time_utc).sort().at(-1) : null,
    feed_age_h: +((FDate.now() - Date.parse(m.query_end_utc)) / 36e5).toFixed(2) }; }
// ---- panel
const snap = tag => ({ tag, label: sf.label.textContent, status: sf.stx.textContent, dot: sf.dot.style.background, caps: Object.fromEntries(Object.entries(sf.caps).map(([k, n]) => [k, n.textContent])),
  last: P.S.last, layer: map.l.get('l-gridatlas-lightning')?.layout?.visibility ?? null, drawn: map.s.get('gridatlas-lightning')?.data?.features?.length ?? null,
  points_btn_hidden: sf.nav.points.hidden, prev_disabled: sf.nav.prev.disabled });
sf.toggle.checked = true; dispatch(sf.toggle, 'change', log.errors); await drain(); out.panel.push(snap('ON (default 24h)'));
for (const p of ['12h', '48h', '7d', '30d', '3m', '6m', '12m']) { dispatch(sf.chips[p], 'click', log.errors); await drain(); out.panel.push(snap(p)); }
dispatch(sf.chips['7d'], 'click', log.errors); await drain();
if (!sf.nav.points.hidden) { dispatch(sf.nav.points, 'click', log.errors); await drain(); out.panel.push(snap('7d LOAD POINTS')); dispatch(sf.chips['7d'], 'click', log.errors); await drain(); }
if (sf.nav.prev.disabled) out.panel.push({ tag: '7d PREV', skipped: 'PREV button disabled (a real click would not fire)' }); else { dispatch(sf.nav.prev, 'click', log.errors); await drain(); out.panel.push(snap('7d PREV')); }
dispatch(sf.chips.custom, 'click', log.errors); await drain(); sf.from.value = '2026-10-21'; sf.to.value = '2026-10-25'; dispatch(sf.nav.apply, 'click', log.errors); await drain(); out.panel.push(snap('custom 2026-10-21..25'));
out.requests = { fetch: log.fetch, xhr: log.xhr }; out.handler_errors = log.errors.map(String); out.module_errors = P.S.errors;
console.log(JSON.stringify(out, null, 1));
