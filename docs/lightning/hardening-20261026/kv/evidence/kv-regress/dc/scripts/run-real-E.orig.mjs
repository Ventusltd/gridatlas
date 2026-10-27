#!/usr/bin/env node
// run-real-E.mjs — data-contract-E lane. Runs generation 202610270024's OWN parsing/validation (ni/vk via li, sh, ok, co,
// cv, cf, cp) and the full panel flow against REAL lightning data files (or the collectors' own history.py output).
// Harness: self-fixture under node:vm + minidom (synthetic DOM shell) with a stubbed fetch/XHR that serves <setDir>
// for https://raw.githubusercontent.com/Ventusltd/lightning/main/data/... and 404 otherwise. NODE ONLY; no Chromium.
// Adapted from data-contract/scripts/run-real.mjs (202610262323): + vk per row, + status.json watch, + install stubs.
// usage: MODULE=<overlay.js> node run-real-E.mjs <setDir/data> <NOW_ISO>
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { makeDocument, dispatch } from './minidom.mjs';

const MODULE = process.env.MODULE, DIR = process.argv[2], NOW = process.argv[3];
const SRC = readFileSync(MODULE, 'utf8'), SEAM = 'NS.ukLightning=Object.freeze(';
if (SRC.split(SEAM).length !== 2) throw new Error('seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={ok,cf,cp,sh,S,ni,vk,cv,tg,co,isFC,wf,stale,IX_SCHEMA,FEED_SCHEMA,AR,FEED};' + SEAM);
const off = NOW ? Date.parse(NOW) - Date.now() : 0;
class FDate extends Date { constructor(...a) { a.length ? super(...a) : super(Date.now() + off); } static now() { return Date.now() + off; } }
FDate.parse = Date.parse; FDate.UTC = Date.UTC;

const ROOT = 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/';
const file = url => { if (!url.startsWith(ROOT)) return null; const p = join(DIR, url.slice(ROOT.length)); return existsSync(p) ? readFileSync(p) : null; };
const log = { fetch: [], xhr: [], errors: [] };
const fetch = async (url, o) => { const b = file(url); log.fetch.push([url.startsWith(ROOT) ? url.slice(ROOT.length) : url, b ? 200 : 404, o && o.cache]); await null; return b ? new Response(b, { status: 200 }) : new Response('404: Not Found', { status: 404 }); };
class XHR { open(m, u) { this.url = u; } send() { const b = file(this.url); log.xhr.push([this.url.slice(ROOT.length), b ? 200 : 404]); setTimeout(() => { this.status = b ? 200 : 404; this.responseText = b ? b.toString('utf8') : '404: Not Found'; this.onload(); }, 0); } }

const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
const g0 = doc.createElement('div'); g0.className = 'key-group'; host.appendChild(g0);
const map = (() => { const s = new Map(), l = new Map(); return { s, l, getLayer: i => l.get(i), getSource: i => s.get(i), addSource: (i, o) => s.set(i, { ...o, setData(x) { this.data = x; } }), addLayer: x => l.set(x.id, { ...x }), removeLayer: i => l.delete(i), removeSource: i => s.delete(i), setLayoutProperty(i, k, v) { const y = l.get(i); if (y) { y.layout = y.layout || {}; y.layout[k] = v; } } }; })();
const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight: 900, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
const timers = [];
vm.runInNewContext(PROBED, { window: W, document: doc, Date: FDate, AbortController, Map, Set, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
  innerHeight: 900, innerWidth: 1440, addEventListener: () => {},
  setInterval: (f, ms) => { timers.push(f); return timers.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} disconnect() {} } }, { filename: MODULE });
const P = W.__PROBE__, api = W.__GRIDATLAS_MODULES__.ukLightning;
if (!api.install()) throw new Error('install ' + JSON.stringify(P.S.waiting_for));
const sf = P.S.sfs[0];
const drain = async () => { for (let k = 0; k < 40; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const out = { set: DIR, now: new FDate().toISOString(), module: MODULE, generation: api.generation, constants: { IX_SCHEMA: P.IX_SCHEMA, FEED_SCHEMA: P.FEED_SCHEMA, AR: P.AR, FEED: P.FEED }, unit: {}, panel: [] };

// ---- unit: index (module's own ni -> vk), row-by-row vk, each listed shard/part through the module's own sh
const ib = file(ROOT + 'history/index.json');
if (!ib) out.unit.index = 'HTTP 404 (absent)';
else { let raw; try { raw = JSON.parse(ib); } catch (e) { raw = null; out.unit.index = { ok: false, error: 'JSON ' + e.message }; }
  if (raw) { out.unit.index_schema = { schema: raw.schema, schema_ok: raw.schema === P.IX_SCHEMA, observation: raw.observation, integrity: raw.integrity && { state: raw.integrity.state, alert: raw.integrity.alert, lost: (raw.integrity.lost_days || []).map(d => d.date || d) } };
    const bad = []; for (const r of raw.days || []) { try { P.vk(r); } catch (e) { bad.push(e.message); } } out.unit.rows_rejected_by_vk = bad;
    const kinds = {}; for (const r of raw.days || []) { const k = `${r.coverage}/${r.count === null ? 'null' : r.count > 0 ? '>0' : '0'}${r.parts ? '/parts' : r.path ? '/path' : ''}${r.shard_lost ? '/shard_lost' : ''}`; kinds[k] = (kinds[k] || 0) + 1; } out.unit.row_kinds = kinds;
    try { const x = P.ni(raw); out.unit.index = { ok: true, rows: x.days.length, cutoff: x.cutoffDate, gen: new Date(x.gen).toISOString(), iv: x.iv, nextDue: new Date(x.nextDue).toISOString(), covStart: new Date(x.covStart).toISOString(), lastScan: x.lastScan && new Date(x.lastScan).toISOString(), windows: x.sw.length, lost: [...x.lost], stale_now: P.stale(x, FDate.now()) };
      const shards = []; for (const r of x.days) for (const t of P.tg(r, -Infinity, Infinity)) { try { const f = await P.sh(t, r.date); shards.push({ date: r.date, path: t.path, ok: true, features: f.length, okFeatures: f.filter(P.ok).length }); } catch (e) { shards.push({ date: r.date, path: t.path, ok: false, error: e.message }); } }
      out.unit.shards = shards;
      const c = P.cv(x, Date.parse('2026-10-20T00:00:00Z'), FDate.now()); out.unit.cv_since_20oct = { f: +c.f.toFixed(4), runs: c.r, unknownDates: c.u, lostDates: c.l, days: c.d, notYet_min: Math.round(c.ny / 6e4), beforeStart_min: Math.round(c.bf / 6e4) };
    } catch (e) { out.unit.index = { ok: false, error: e.message }; } } }
// ---- unit: feed (module's own isFC/ok)
const fb = file(ROOT + 'uk_lightning.geojson');
if (!fb) out.unit.feed = 'HTTP 404'; else { const f = JSON.parse(fb); const acc = f.features.filter(P.ok);
  const m = f.metadata || {}; out.unit.feed = { isFC: !!P.isFC(f), features: f.features.length, accepted: acc.length, rejected: f.features.length - acc.length,
    observation_kinds: [...new Set(f.features.map(z => z.properties && z.properties.observation_kind))],
    meta_keys_module_reads: Object.fromEntries(['query_start_utc', 'query_end_utc', 'latest_detection_utc'].map(k => [k, m[k] ?? '(missing)'])),
    first: acc.length ? acc.map(z => z.properties.time_utc).sort()[0] : null, last: acc.length ? acc.map(z => z.properties.time_utc).sort().at(-1) : null,
    feed_age_h: +((FDate.now() - Date.parse(m.query_end_utc)) / 36e5).toFixed(2) }; }
out.unit.status_json_present = !!file(ROOT + 'status.json');
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
sf.from.value = '2026-10-23'; sf.to.value = '2026-10-23'; dispatch(sf.nav.apply, 'click', log.errors); await drain(); out.panel.push(snap('custom 2026-10-23 only'));
out.requests = { fetch: log.fetch, xhr: log.xhr, status_json_requested: log.fetch.some(f => /status\.json/.test(f[0])) }; out.handler_errors = log.errors.map(String); out.module_errors = P.S.errors;
console.log(JSON.stringify(out, null, 1));
