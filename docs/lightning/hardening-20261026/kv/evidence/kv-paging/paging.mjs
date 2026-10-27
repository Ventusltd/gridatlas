#!/usr/bin/env node
// kv-paging harness: Build I module under node:vm + minidom, served the REAL lightning archive from a git commit.
// Usage: node paging.mjs <module.js> <commit> <clockISO> [view w,s,e,n]
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { makeDocument, dispatch } from '../opus-fix-designer/minidom.mjs';

const [MODULE, COMMIT, CLOCK, VIEW = '-6,50,2,56'] = process.argv.slice(2);
const NOW = Date.parse(CLOCK), D = 864e5, iso = t => new Date(t).toISOString(), ymd = t => iso(t).slice(0, 10);
const LREPO = '/home/claude/lightning';
const git = p => { try { return execFileSync('git', ['-C', LREPO, 'show', `${COMMIT}:data/${p}`], { maxBuffer: 1e8 }); } catch { return null; } };
const IDX = JSON.parse(git('history/index.json'));
const COV = Date.parse(IDX.coverage_start_utc);

// ground truth straight from the day shards (independent of the module)
const shardCache = new Map();
const shard = date => { if (!shardCache.has(date)) { const b = git('history/days/' + date.replace(/-/g, '/') + '.json'); shardCache.set(date, b ? JSON.parse(b).features : []); } return shardCache.get(date); };
function truth(s, e) {
  let exact = 0, wholeDays = 0, searched = 0, never = 0, dates = 0;
  for (let t = Date.parse(ymd(s) + 'T00:00:00Z'); t < e; t += D) {
    if (Math.min(e, t + D) - Math.max(s, t) <= 0) continue; dates++;
    const row = IDX.days.find(r => r.date === ymd(t));
    if (!row || row.coverage === 'none') { never++; continue; }
    searched++; wholeDays += row.count;
    for (const f of shard(ymd(t))) { const ft = Date.parse(f.properties.time_utc); if (ft >= s && ft < e) exact++; }
  }
  return { exact, wholeDays, searched, never, dates, allBefore: e <= COV };
}

// sandbox
const doc = makeDocument(), html = doc.documentElement, body = doc.createElement('body'); html.appendChild(body);
const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
const og = doc.createElement('div'); og.className = 'key-group'; host.appendChild(og);
const sources = new Map(), layers = new Map(), camera = [], handlers = [];
let view = VIEW.split(',').map(Number);
const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; } }), addLayer: x => layers.set(x.id, { ...x }),
  removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) { l.layout = l.layout || {}; l.layout[k] = v; } },
  getContainer: () => body, project: ll => ({ x: ll[0] * 10, y: ll[1] * 10 }), on: (t, f) => handlers.push({ t, f }), queryRenderedFeatures: () => [],
  getBounds: () => ({ contains: ([x, y]) => x >= view[0] && y >= view[1] && x <= view[2] && y <= view[3] }) };
for (const k of ['fitBounds', 'flyTo', 'easeTo', 'jumpTo']) map[k] = (...a) => camera.push([k, a]);
const log = { fetch: [], errors: [] };
const fetch = async url => { log.fetch.push(url); await null; const k = url.split('?')[0].split('/main/data/')[1]; const b = k && git(k); return b ? new Response(b, { status: 200 }) : new Response('nope', { status: 404 }); };
class XHR { open(m, u) { this.url = u; } send() { setTimeout(() => { const b = git('uk_lightning.geojson'); this.status = 200; this.responseURL = this.url; this.responseText = String(b); this.onload(); }, 0); } }
class FD extends Date { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } }
const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 390, innerHeight: 844, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true }, addEventListener() {} };
const SEAM = 'NS.ukLightning=Object.freeze(';
const code = readFileSync(MODULE, 'utf8').replace(SEAM, 'window.__P__={S,wf};' + SEAM);
vm.runInNewContext(code, { window: W, document: doc, Date: FD, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout,
  setInterval: () => 1, clearInterval() {}, matchMedia: () => ({ matches: true }), MutationObserver: class { observe() {} disconnect() {} }, innerHeight: 844, addEventListener() {} }, { timeout: 5000 });
const P = W.__P__, S = P.S; W.__GRIDATLAS_MODULES__.ukLightning.install();
const sf = S.sfs[0], drain = async () => { for (let k = 0; k < 40; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
const click = el => dispatch(el, 'click', log.errors);
const snap = tag => {
  const r = S.res, w = r.w, t = truth(w.s, w.e), cap = k => sf.caps[k].textContent;
  return { tag, window: `${iso(w.s).slice(0, 16)} -> ${iso(w.e).slice(0, 16)}`, label: sf.label.textContent, status: sf.stx.textContent, state: S.last && S.last.state,
    mode: r.mode, drawn: r.ev.length, arch: r.arch, out: r.out, truth: t,
    prev: sf.nav.prev.disabled ? 'off' : 'on', next: sf.nav.next.disabled ? 'off' : 'on', latest: sf.nav.latest.disabled ? 'off' : 'on', fit: sf.nav.fit.hidden ? 'hidden' : 'shown',
    caps: { window: cap('window'), actual: cap('actual'), flashes: cap('flashes'), searched: cap('searched'), warning: cap('warning'), notice: cap('notice') }, stack: S.h.map(x => x === null ? null : iso(x).slice(0, 16)) };
};
async function fitCheck() {
  if (sf.nav.fit.hidden) return { fit: 'hidden' };
  const n0 = camera.length; click(sf.nav.fit); const c = camera.slice(n0).find(x => x[0] === 'fitBounds');
  if (!c) return { fit: 'no camera call' };
  const [[a, b], [cc, d]] = c[1][0]; const old = view; view = [a, b, cc, d];
  for (const h of handlers.filter(h => h.t === 'moveend')) h.f(); const out = S.res.out, flashes = sf.caps.flashes.textContent; view = old;
  for (const h of handlers.filter(h => h.t === 'moveend')) h.f();
  return { fit: [a, b, cc, d].map(v => +v.toFixed(3)), outAfterFit: out, flashesAfterFit: flashes, maxZoom: c[1][1].maxZoom };
}

const out = { module: MODULE, commit: COMMIT, clock: CLOCK, view: VIEW, index: { generated: IDX.generated_utc, total: IDX.archived_observations, coverage_start: IDX.coverage_start_utc, cutoff: IDX.cutoff_date_utc }, periods: {} };
sf.toggle.checked = true; dispatch(sf.toggle, 'change', log.errors); await drain();
for (const p of ['12h', '24h', '48h', '7d', '30d', '3m', '6m', '12m']) {
  const seq = []; click(sf.chips[p]); await drain(); seq.push({ ...snap('LATEST'), ...(await fitCheck()) });
  for (let k = 1; k <= 3; k++) { if (sf.nav.prev.disabled) { seq.push({ tag: 'PREV' + k, blocked: true }); continue; } click(sf.nav.prev); await drain(); seq.push({ ...snap('PREV' + k), ...(await fitCheck()) }); }
  for (let k = 1; k <= 3; k++) { if (sf.nav.next.disabled) { seq.push({ tag: 'NEXT' + k, blocked: true }); continue; } click(sf.nav.next); await drain(); seq.push(snap('NEXT' + k)); }
  click(sf.nav.prev); await drain(); click(sf.nav.prev); await drain(); click(sf.nav.latest); await drain(); seq.push(snap('PREVx2+LATEST'));
  out.periods[p] = seq;
}
// cross-period: page 30d back twice, then switch to 7d and step NEXT
click(sf.chips['30d']); await drain(); click(sf.nav.latest); await drain(); click(sf.nav.prev); await drain(); click(sf.nav.prev); await drain();
click(sf.chips['7d']); await drain(); const x1 = snap('30d PREV PREV -> 7D'); click(sf.nav.next); await drain(); const x2 = snap('then NEXT');
out.crossPeriod = [x1, x2];
// custom ranges
const custom = [['2026-09-29', '2026-10-27'], ['2026-09-01', '2026-09-28'], ['2026-09-20', '2026-10-05'], ['2025-10-27', '2025-11-10'], ['2026-10-27', '2026-10-27'], ['2026-10-28', '2026-10-28'], ['2026-10-12', '2026-10-12']];
out.custom = [];
click(sf.chips.custom); await drain();
for (const [f, t] of custom) { sf.from.value = f; sf.to.value = t; click(sf.nav.apply); await drain(); out.custom.push({ ...snap(`CUSTOM ${f}..${t}`), ...(await fitCheck()) }); }
out.errors = [...log.errors.map(String), ...S.errors];
out.requests = S.requests;
console.log(JSON.stringify(out, null, 1));
