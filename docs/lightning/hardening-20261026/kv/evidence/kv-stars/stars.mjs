#!/usr/bin/env node
// kv-stars: combination matrix ("stars") for Lightning Build I (202610270929) under node:vm + minidom.
// REAL archive fixture (Ventusltd/lightning @ 2a49652, the state live at 13:45Z), real clock 2026-10-27T13:45Z.
// Usage: node stars.mjs <module.js> <fixtureDir> <cp-v3.json> <grid_substations.geojson> <out.jsonl>
import vm from 'node:vm';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { makeDocument, dispatch } from '../opus-fix-designer/minidom.mjs';

const [MODULE, FIX, CPV3, SUBS, OUT] = process.argv.slice(2);
const SRC = readFileSync(MODULE, 'utf8'), SEAM = 'NS.ukLightning=Object.freeze(';
if (SRC.split(SEAM).length !== 2) throw new Error('seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={S};' + SEAM);
const NOW = Date.parse('2026-10-27T13:45:00Z'), H = 36e5, D = 864e5, iso = t => new Date(t).toISOString();

// ---------- fixture files (served as raw bytes, keyed by path after /history/) ----------
const files = {}; const walk = (d, rel) => { for (const n of readdirSync(d)) { const p = join(d, n), r = rel ? rel + '/' + n : n; statSync(p).isDirectory() ? walk(p, r) : files[r] = readFileSync(p); } };
walk(join(FIX, 'history'), '');
const realIndex = JSON.parse(files['index.json']); const feedRaw = readFileSync(join(FIX, 'uk_lightning.geojson'), 'utf8'); const feedObj = JSON.parse(feedRaw);
// fresh variant: same data, index regenerated at 13:40Z (as if the hourly :17 cron had run), feed re-published at 13:40Z
const FRESH_GEN = Date.parse('2026-10-27T13:40:00Z');
const freshIndex = Buffer.from(JSON.stringify({ ...realIndex, generated_utc: iso(FRESH_GEN), next_update_due_utc: iso(FRESH_GEN + 3 * H) }));
const freshFeed = JSON.stringify({ ...feedObj, metadata: { ...feedObj.metadata, query_end_utc: iso(FRESH_GEN), published_at_utc: iso(FRESH_GEN) } });

// ---------- ground truth: every archived flash from the shards, independent of the module ----------
const truthFlashes = [];
for (const r of realIndex.days) if (r.path) truthFlashes.push(...JSON.parse(files[r.path]).features.map(f => Date.parse(f.properties.time_utc)));
const feedTimes = feedObj.features.map(f => Date.parse(f.properties.time_utc));
const truthCount = (s, e, src = truthFlashes) => src.filter(t => t >= s && t < e).length;
const sw = realIndex.scan_windows.map(w => [Date.parse(w.start_utc), Date.parse(w.end_utc)]);
const truthSearched = (s, e) => { let n = 0; for (const [a, b] of sw) n += Math.max(0, Math.min(b, e) - Math.max(a, s)); return e > s ? n / (e - s) : 0; };

// ---------- substations: cp-v3 (>=132 kV, located) and the real release payload (>=33 kV, cartridge parsing) ----------
const R = 6378.137, dk = (lo1, la1, lo2, la2) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
const cp = JSON.parse(readFileSync(CPV3, 'utf8')).connection_points.filter(c => c.location)
  .map(c => ({ at: [c.location.lon, c.location.lat], kv: [...c.voltages_kv].sort((a, b) => b - a), name: c.location.mapped_name || c.name, operator: c.transmission_owner }));
// voltagesKv / representativePoint copied from sld-sandbox 202609241334 lines 3338-3368
const voltagesKv = p => { const out = []; const push = (raw, dv) => { for (const t of String(raw ?? '').split(/[;,|:\s]+/)) { if (!t) continue; const v = Number(t); if (!Number.isFinite(v) || v <= 0) continue; out.push(v / dv); } }; push(p?.voltage, 1000); if (!out.length) push(p?.kv, 1); return out; };
const repPt = g => { if (!g) return null; if (g.type === 'Point') return [g.coordinates[0], g.coordinates[1]]; const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null; if (!Array.isArray(ring) || !ring.length) return null; let x = 0, y = 0; for (const p of ring) { x += p[0]; y += p[1]; } return [x / ring.length, y / ring.length]; };
const rel = []; for (const f of JSON.parse(readFileSync(SUBS, 'utf8')).features) { const kv = voltagesKv(f.properties); if (!kv.length || Math.max(...kv) < 32.5) continue; const at = repPt(f.geometry); if (!at) continue; rel.push({ at, kv: kv.filter(v => v >= 32.5).sort((a, b) => b - a), name: f.properties?.name || '', operator: f.properties?.operator || '' }); }
const NEON = { cpv3: cp, release: rel };
// the original engine's nearestSubstations (sld-sandbox 3511-3540): >=33 kV, <=40 km, 5 links
const engineNearest = (lon, lat, subs) => subs.map(s => ({ ...s, km: dk(lon, lat, s.at[0], s.at[1]) })).filter(s => s.km <= 40).sort((a, b) => a.km - b.km).slice(0, 5);

// ---------- one boot ----------
function boot({ archive, fresh, device, neon }) {
  const phone = device === 'phone', doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const orig = doc.createElement('div'); orig.className = 'key-group'; host.appendChild(orig);
  const curtain = doc.createElement('div'); curtain.id = 'fs-curtain-keys'; body.appendChild(curtain);
  const bar = doc.createElement('div'); bar.id = 'gridatlas-menu-bar'; bar._rect = { top: 0, bottom: phone ? 96 : 56, left: 0, right: 0, width: 0, height: phone ? 96 : 56 }; body.appendChild(bar);
  const W0 = phone ? 390 : 1440, H0 = phone ? 664 : 900;
  const sources = new Map(), layers = new Map(), camera = [], handlers = []; let qrf = () => [];
  const mapEl = doc.createElement('div'); mapEl.id = 'map'; mapEl._rect = { top: 0, left: 0, right: W0, bottom: H0, width: W0, height: H0 }; body.appendChild(mapEl);
  // equirectangular projection framing GB, so card placement is meaningful
  const proj = ([x, y]) => ({ x: (x + 11) / 14 * W0, y: (61.5 - y) / 12 * H0 });
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => { if (sources.has(id)) throw new Error('There is already a source with ID "' + id + '"'); sources.set(id, { ...o, setData(x) { this.data = x; } }); },
    addLayer: x => { if (layers.has(x.id)) throw new Error('Layer "' + x.id + '" already exists'); if (x.source && !sources.has(x.source)) throw new Error('Source "' + x.source + '" not found'); layers.set(x.id, { ...x }); },
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) { l.layout = l.layout || {}; l.layout[k] = v; } },
    getContainer: () => mapEl, project: proj, getStyle: () => ({ layers: [{ type: 'symbol', layout: { 'text-font': ['Noto Sans Regular'] } }] }),
    getBounds: () => ({ contains: ([x, y]) => x >= -11 && x <= 3 && y >= 49.5 && y <= 61.5 }),
    on: (t, a, b) => handlers.push({ t, layer: b ? a : null, f: b || a }), queryRenderedFeatures: (pt, o) => (o && o.layers || []).flatMap(l => qrf(l, pt)) };
  for (const k of ['fitBounds', 'flyTo', 'easeTo', 'jumpTo']) map[k] = (...a) => camera.push([k, a]);
  const tapMap = (pt, hits) => { qrf = l => hits[l] || []; for (const h of handlers.filter(h => h.t === 'click')) h.f({ point: pt }); };
  const log = { fetch: [], xhr: [], errors: [] };
  class XHR { open(m, u) { this.url = u; } send() { log.xhr.push(this.url); setTimeout(() => { this.status = 200; this.responseURL = this.url; this.responseText = fresh ? freshFeed : feedRaw; this.onload(); }, 0); } }
  const fetch = async url => {
    log.fetch.push(url); await null; const k = url.split('/history/')[1].split('?')[0];
    if (k === 'index.json') {
      if (archive === 'index404') return new Response('404: Not Found', { status: 404 });
      if (archive === 'feedonly') throw new TypeError('Failed to fetch'); // archive host unreachable / CORS / offline
      return new Response(fresh ? freshIndex : files['index.json'], { status: 200 });
    }
    return files[k] ? new Response(files[k], { status: 200 }) : new Response('404: Not Found', { status: 404 });
  };
  const L = { substations: NEON[neon], substations_loaded: NEON[neon].length, measure: { distanceKm: dk } };
  if (process.env.ENGINE_NS) L.measure.nearestSubstations = engineNearest; // the cartridge's public pure measure (link.measure.nearestSubstations)
  const W = { __GRIDATLAS_V9_MAP__: map, __GRIDATLAS_NEON_LINKS__: L, innerWidth: W0, innerHeight: H0, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true }, addEventListener: () => {} };
  const Dt = class extends Date { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } };
  const sandbox = { window: W, document: doc, Date: Dt, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {}, matchMedia: () => ({ matches: phone }), MutationObserver: class { observe() {} disconnect() {} }, innerHeight: H0, innerWidth: W0, addEventListener: () => {} };
  vm.runInNewContext(PROBED, sandbox, { filename: MODULE, timeout: 5000 });
  const api = W.__GRIDATLAS_MODULES__.ukLightning, S = W.__PROBE__.S;
  if (!api.install()) throw new Error('install');
  const main = S.sfs[0], click = el => { if (el.disabled) return false; dispatch(el, 'click', log.errors); return true; };
  return { S, main, click, map, sources, layers, tapMap, mapEl, log, camera,
    toggle: on => { main.toggle.checked = on; dispatch(main.toggle, 'change', log.errors); } };
}
const drain = async () => { for (let k = 0; k < 40; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 0)); } };
const unhandled = []; process.on('unhandledRejection', e => unhandled.push(String(e && e.message || e)));

const snap = x => { const m = x.main, caps = {}; for (const k in m.caps) caps[k] = m.caps[k].textContent; const r = x.S.res;
  return { label: m.label.textContent, status: m.stx.textContent, caps, drawn: r && r.ev ? r.ev.length : null, mode: r && r.mode, window: r && r.w ? [iso(r.w.s), iso(r.w.e)] : null,
    prevDisabled: m.nav.prev.disabled, nextDisabled: m.nav.next.disabled, pointsVisible: !m.nav.points.hidden,
    layerVisible: x.layers.get('l-gridatlas-lightning')?.layout?.visibility ?? null, srcFeatures: x.sources.get('gridatlas-lightning')?.data?.features?.length ?? null }; };

const PER = ['12h', '24h', '48h', '7d', '30d', '3m', '6m', '12m', 'custom'];
const out = []; let i = 0;
for (const period of PER) for (const paging of [0, 1, 2]) for (const archive of ['real', 'feedonly', 'index404']) for (const fresh of [true, false]) for (const device of ['phone', 'desktop']) for (const tapMode of ['none', 'flash', 'nearest']) {
  const id = `${period}|p${paging}|${archive}|${fresh ? 'fresh' : 'stale'}|${device}|${tapMode}`; const star = { id, period, paging, archive, fresh, device, tap: tapMode };
  try {
    const x = boot({ archive, fresh, device, neon: process.env.NEON || 'cpv3' }); x.toggle(true); await drain();
    if (period !== '24h') x.click(x.main.chips[period]); await drain();
    if (period === 'custom') { x.main.from.value = '2026-09-01'; x.main.to.value = '2026-09-30'; x.click(x.main.nav.apply); await drain(); }
    star.pagesTaken = 0; for (let k = 0; k < paging; k++) { if (x.click(x.main.nav.prev)) star.pagesTaken++; await drain(); }
    Object.assign(star, snap(x));
    const r = x.S.res;
    if (r && r.w) { star.truth = truthCount(r.w.s, r.w.e); star.truthFeed = truthCount(r.w.s, r.w.e, feedTimes); star.truthSearchedPct = Math.floor(truthSearched(r.w.s, r.w.e) * 100);
      // the window the user ASKED for (before retention clamping)
      const asked = x.S.res.w; star.clamped = !!asked.clamped; }
    if (tapMode !== 'none') {
      const ev = r && r.ev || []; star.tap_target = null;
      if (!ev.length) star.tap_result = 'no flash drawn to tap';
      else {
        // the drawn flash nearest Wymondley (the owner's example), deterministic
        let bi = 0, bd = Infinity; ev.forEach((f, j) => { const d = dk(f.geometry.coordinates[0], f.geometry.coordinates[1], -0.249047, 51.927715); if (d < bd) { bd = d; bi = j; } });
        const f = ev[bi], pt = x.map.project(f.geometry.coordinates); star.tap_target = { i: bi, at: f.geometry.coordinates, id_len: String(f.id).length };
        x.tapMap([pt.x, pt.y], { 'l-gridatlas-lightning-hit': [{ properties: { i: bi }, geometry: f.geometry }] }); await drain();
        const card = x.S.pp; star.card = !!card;
        if (card) { star.card_lines = card.children.filter(c => c.tagName === 'DIV' && c !== card.out).map(c => c.textContent);
          const W0 = x.mapEl._rect.width, H0 = x.mapEl._rect.height, h = card.children.length * 18 + 60; star.card_box = { left: card.style.left, top: card.style.top, maxHeight: card.style.maxHeight, map: [W0, H0] }; }
        star.popupClassUsed = /maplibregl-popup/.test(JSON.stringify([...(card?.attrs || [])]));
        if (tapMode === 'nearest' && card) {
          const btn = card.children.find(c => c.dataset && c.dataset.lightningNearest !== undefined); x.click(btn); await drain();
          star.nearest_text = card.out.children.map(c => c.textContent);
          const src = x.sources.get('gridatlas-lightning-nearest');
          star.lines_added = src ? src.data.features.filter(f => f.geometry.type === 'LineString').length : 0;
          star.nearest_layers = ['glow', 'core', 'node', 'label'].filter(k => x.layers.has('gridatlas-lightning-nearest-' + k));
          star.camera_after_nearest = x.camera.length; star.camera_last = x.camera.length ? JSON.stringify(x.camera[x.camera.length - 1][1][0]) : null;
          // what the original deep-link engine would draw from the same point (release payload, >=33 kV, 40 km, 5)
          const [lo, la] = f.geometry.coordinates; star.engine_would_draw = engineNearest(lo, la, rel).map(s => `${s.km.toFixed(2)} km · ${Math.round(s.kv[0])} kV · ${s.name || 'unnamed'}`);
          // second tap on the same flash and NEAREST again: duplicate-source safety
          x.tapMap([pt.x, pt.y], { 'l-gridatlas-lightning-hit': [{ properties: { i: bi }, geometry: f.geometry }] }); await drain();
          star.lines_after_retap = x.sources.get('gridatlas-lightning-nearest') ? 'kept' : 'removed';
        }
      }
    }
    // round trip: NEXT as many times as PREV was taken, label must equal the paging-0 label (checked in analysis)
    for (let k = 0; k < star.pagesTaken; k++) { x.click(x.main.nav.next); await drain(); }
    star.label_after_next = x.main.label.textContent;
    star.errors = [...x.log.errors.map(e => String(e.message || e)), ...x.S.errors.map(String)];
    star.requests = { fetch: x.log.fetch.length, xhr: x.log.xhr.length };
  } catch (e) { star.harness_error = String(e.stack || e).slice(0, 400); }
  star.unhandled = unhandled.splice(0); out.push(star); i++;
}
writeFileSync(OUT, out.map(s => JSON.stringify(s)).join('\n') + '\n');
console.log('stars', out.length, 'harness errors', out.filter(s => s.harness_error).length);
