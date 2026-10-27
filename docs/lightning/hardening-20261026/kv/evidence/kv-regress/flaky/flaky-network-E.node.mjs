#!/usr/bin/env node
// flaky-network-E.node.mjs — lane flaky-network-E (issue #32 final push). NODE ONLY, no Chromium.
// Harness: self-fixture. The generation 202610270024 overlay module runs in node:vm with minidom.mjs (copied from
// opus-fix-designer), a stubbed fetch (index.json, day shards, hourly parts) and a stubbed XMLHttpRequest (live feed
// uk_lightning.geojson, the module's only XHR, used as the fallback when the index is unavailable). Fake clock: the
// sandbox's Date/setTimeout/clearTimeout are virtual, so the 15 s AbortController / XHR timeout fires on clock.advance().
// The "next refresh" is the module's own 10-minute setInterval callback (captured), invoked after advancing 600 s.
// All data are SYNTHETIC (built below); nothing is fetched from the network.
// usage: MODULE=<overlay.js> node flaky-network-E.node.mjs [--out DIR]
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeDocument, dispatch } from './minidom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = process.env.MODULE || join(HERE, 'module.js');
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(HERE, 'out');
mkdirSync(OUT, { recursive: true });
const SRC = readFileSync(MODULE, 'utf8');
const SEAM = 'NS.ukLightning=Object.freeze(';
if (SRC.split(SEAM).length !== 2) throw new Error('seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={S,lru};' + SEAM);

const H = 36e5, D = 864e5, T0 = Date.parse('2026-10-27T06:30:00Z');
const iso = t => new Date(t).toISOString();
const sha = b => createHash('sha256').update(b).digest('hex');
const enc = o => Buffer.from(JSON.stringify(o));
const fl = (t, id) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [-1.5, 52] }, properties: { time_utc: iso(t), observation_kind: 'optical_lightning_flash' } });
const dayFile = (date, f, extra = {}) => ({ schema: 'uk-lightning-history-day.v1', type: 'FeatureCollection', metadata: { date_utc: date, ...extra }, features: f });

// ---------------------------------------------------------------- SYNTHETIC fixture (window 24h at T0: 10-26 06:30 -> 10-27 06:30)
const SHARD = 'days/2026/10/26.json', P1 = 'days/2026/10/27/01.json', P3 = 'days/2026/10/27/03.json';
const BODIES = {
  [SHARD]: enc(dayFile('2026-10-26', [fl(Date.parse('2026-10-26T12:00:00Z'), 'd1'), fl(Date.parse('2026-10-26T13:00:00Z'), 'd2'), fl(Date.parse('2026-10-26T14:00:00Z'), 'd3')])),
  [P1]: enc(dayFile('2026-10-27', [fl(Date.parse('2026-10-27T01:10:00Z'), 'p1a'), fl(Date.parse('2026-10-27T01:20:00Z'), 'p1b')], { hour_utc: 1 })),
  [P3]: enc(dayFile('2026-10-27', [fl(Date.parse('2026-10-27T03:10:00Z'), 'p3a'), fl(Date.parse('2026-10-27T03:20:00Z'), 'p3b')], { hour_utc: 3 })),
};
const IDS = { [SHARD]: ['d1', 'd2', 'd3'], [P1]: ['p1a', 'p1b'], [P3]: ['p3a', 'p3b'] };
function mkIndex() {
  const cutoff = Date.parse('2025-10-27T00:00:00Z'), days = [];
  for (let t = cutoff; t <= Date.parse('2026-10-27T00:00:00Z'); t += D) {
    const date = iso(t).slice(0, 10);
    days.push({ date, coverage: 'full', scanned_seconds: 86400, count: 0, bytes: null, path: null, sealed: true, first_observation_utc: null, last_observation_utc: null, sha256: null });
  }
  const d26 = days.find(r => r.date === '2026-10-26'), d27 = days.find(r => r.date === '2026-10-27');
  Object.assign(d26, { count: 3, bytes: BODIES[SHARD].length, sha256: sha(BODIES[SHARD]), path: SHARD, sealed: true, first_observation_utc: '2026-10-26T12:00:00Z', last_observation_utc: '2026-10-26T14:00:00Z' });
  Object.assign(d27, { count: 4, sealed: false, coverage: 'partial', scanned_seconds: 23400, first_observation_utc: '2026-10-27T01:10:00Z', last_observation_utc: '2026-10-27T03:20:00Z',
    parts: [{ hour: 1, path: P1, count: 2, bytes: BODIES[P1].length, sha256: sha(BODIES[P1]) }, { hour: 3, path: P3, count: 2, bytes: BODIES[P3].length, sha256: sha(BODIES[P3]) }] });
  return { schema: 'uk-lightning-history-index.v2', generated_utc: iso(T0 - 20 * 6e4), next_update_due_utc: iso(T0 + 3 * H), cutoff_date_utc: '2025-10-27', collection_interval_hours: 1,
    observation: 'satellite optical lightning flashes, not ground strikes', coverage_start_utc: iso(cutoff),
    // SYNTHETIC: the scan window runs past T0 so the clean baseline is READY and any other state is attributable to the fault
    scan_windows: [{ start_utc: iso(cutoff), end_utc: iso(T0 + D), successful_runs: 999 }], days };
}
const INDEX_BODY = enc(mkIndex());
const feedBody = now => enc({ type: 'FeatureCollection', metadata: { query_start_utc: iso(now - 4 * H), query_end_utc: iso(now - H), latest_detection_utc: iso(now - 2 * H) },
  features: [fl(now - 3 * H, 'live1'), fl(now - 2 * H, 'live2')] });
// fabricated payloads served by the off-host redirect target (CORS allowed), SYNTHETIC
const FAKE_INDEX = (() => { const x = mkIndex(); const r = x.days.find(r => r.date === '2026-10-26'); r.count = 0; r.path = null; r.bytes = null; r.sha256 = null; r.first_observation_utc = r.last_observation_utc = null; const q = x.days.find(r => r.date === '2026-10-27'); q.count = 0; delete q.parts; q.coverage = 'full'; q.scanned_seconds = 86400; return enc(x); })();
const fakeFeed = now => enc({ type: 'FeatureCollection', metadata: { query_start_utc: iso(now - 4 * H), query_end_utc: iso(now - H), latest_detection_utc: null }, features: [] });
const FAKE_DAY = (date, extra) => enc(dayFile(date, [fl(Date.parse(date + 'T12:30:00Z'), 'evil')], extra));
const HTML = '<!doctype html><html><head><title>Sign in</title></head><body>Wi-Fi login</body></html>';

// ---------------------------------------------------------------- faults
const FETCH_FAULTS = ['http500', 'http503', 'http403', 'http404', 'stall', 'stall-body', 'reset', 'reset-midbody', 'truncated', 'html200', 'wrong-ctype', 'empty', 'redirect-offhost-blocked', 'redirect-offhost-cors'];
const XHR_FAULTS = ['http500', 'http503', 'http403', 'http404', 'stall', 'reset', 'truncated', 'html200', 'wrong-ctype', 'empty', 'redirect-offhost-blocked', 'redirect-offhost-cors'];
const kindOf = url => url.endsWith('/history/index.json') ? 'index' : url.endsWith('uk_lightning.geojson') ? 'feed' : /\/days\/\d{4}\/\d\d\/\d\d\.json$/.test(url) ? 'shard' : /\/days\/\d{4}(\/\d\d){3}\.json$/.test(url) ? 'part' : 'other';

class Clock {
  constructor(t) { this.t = t; this.q = []; this.id = 0; }
  setTimeout(f, ms) { const id = ++this.id; this.q.push({ id, at: this.t + Math.max(0, Number(ms) || 0), f }); return id; }
  clearTimeout(id) { this.q = this.q.filter(x => x.id !== id); }
  async advance(ms) { const end = this.t + ms; for (;;) { await drain(); this.q.sort((a, b) => a.at - b.at || a.id - b.id); const n = this.q[0]; if (!n || n.at > end) break; this.q.shift(); this.t = n.at; n.f(); } this.t = end; await drain(); }
}
const drain = async () => { for (let k = 0; k < 40; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 0)); } };
const unhandled = [], uncaught = [];
process.on('unhandledRejection', e => unhandled.push(String(e && e.stack || e)));
process.on('uncaughtException', e => uncaught.push(String(e && e.stack || e)));

function boot(faultOf) {
  const clock = new Clock(T0);
  const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const orig = doc.createElement('div'); orig.className = 'key-group'; host.appendChild(orig);
  const sources = new Map(), layers = new Map();
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; } }), addLayer: x => layers.set(x.id, { ...x, layout: { ...x.layout } }),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) l.layout[k] = v; } };
  const log = { req: [], errors: [], intervals: [] };
  const abortErr = () => new DOMException('This operation was aborted', 'AbortError');
  const fetch = (url, opt = {}) => new Promise((res, rej) => {
    const kind = kindOf(url), f = faultOf(kind), sig = opt.signal; log.req.push({ kind, url, t: clock.t, fault: f || null });
    if (sig) { if (sig.aborted) return rej(abortErr()); sig.addEventListener('abort', () => rej(abortErr())); }
    const rest = url.split('/history/')[1], good = kind === 'index' ? INDEX_BODY : BODIES[rest];
    const R = (b, init = {}) => new Response(b, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, ...init });
    const stream = (chunk, end) => new ReadableStream({ start(c) { if (chunk) c.enqueue(new Uint8Array(chunk)); if (end === 'reset') c.error(new TypeError('network error')); if (end === 'stall' && sig) sig.addEventListener('abort', () => { try { c.error(abortErr()); } catch (_) {} }); } });
    Promise.resolve().then(() => {
      if (!good) return res(R('nope', { status: 404 }));
      switch (f) {
        case null: case undefined: return res(R(good));
        case 'http500': return res(R('<h1>500</h1>', { status: 500 })); case 'http503': return res(R('upstream', { status: 503 }));
        case 'http403': return res(R('denied', { status: 403 })); case 'http404': return res(R('404: Not Found', { status: 404 }));
        case 'stall': return; // headers never arrive; only the module's AbortController can end it
        case 'stall-body': return res(new Response(stream(good.subarray(0, 40), 'stall'), { status: 200 }));
        case 'reset': return rej(new TypeError('Failed to fetch'));
        case 'reset-midbody': return res(new Response(stream(good.subarray(0, Math.floor(good.length / 2)), 'reset'), { status: 200 }));
        case 'truncated': return res(R(good.subarray(0, Math.floor(good.length * 0.6))));
        case 'html200': return res(R(HTML, { headers: { 'content-type': 'text/html' } }));
        case 'wrong-ctype': return res(R(good, { headers: { 'content-type': 'text/html; charset=utf-8' } }));
        case 'empty': return res(R(''));
        case 'redirect-offhost-blocked': return rej(new TypeError('Failed to fetch')); // 302 -> https://evil.example/ without CORS: browser reports a network error
        case 'redirect-offhost-cors': { // 302 -> https://evil.example/... with ACAO:*; fetch follows and exposes r.redirected / r.url only
          const b = kind === 'index' ? FAKE_INDEX : FAKE_DAY(rest.startsWith('days/2026/10/26.') ? '2026-10-26' : '2026-10-27');
          const r = R(b); Object.defineProperty(r, 'url', { value: 'https://evil.example/' + rest }); Object.defineProperty(r, 'redirected', { value: true }); return res(r); }
        default: throw new Error('unknown fault ' + f);
      }
    });
  });
  class XHR {
    open(m, u) { this.url = u; this.status = 0; this.responseText = ''; this.responseURL = ''; }
    send() {
      const kind = kindOf(this.url), f = faultOf(kind); log.req.push({ kind, url: this.url, t: clock.t, fault: f || null });
      const good = feedBody(clock.t), done = (st, txt, u) => { this.status = st; this.responseText = txt; this.responseURL = u || this.url; this.onload(); };
      if (f === 'stall') { if (this.timeout > 0) clock.setTimeout(() => this.ontimeout(), this.timeout); return; }
      Promise.resolve().then(() => {
        switch (f) {
          case null: case undefined: case 'wrong-ctype': return done(200, good.toString()); // XHR responseText ignores content-type
          case 'http500': return done(500, '<h1>500</h1>'); case 'http503': return done(503, 'upstream'); case 'http403': return done(403, 'denied'); case 'http404': return done(404, '404: Not Found');
          case 'reset': case 'redirect-offhost-blocked': this.status = 0; return this.onerror();
          case 'truncated': return done(200, good.toString().slice(0, Math.floor(good.length * 0.6)));
          case 'html200': return done(200, HTML); case 'empty': return done(200, '');
          case 'redirect-offhost-cors': return done(200, fakeFeed(clock.t).toString(), 'https://evil.example/uk_lightning.geojson');
          default: throw new Error('unknown fault ' + f);
        }
      });
    }
  }
  class FakeDate extends Date { constructor(...a) { a.length ? super(...a) : super(clock.t); } static now() { return clock.t; } }
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, innerHeight: 900, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true }, addEventListener() {} };
  const sandbox = { window: W, document: doc, Date: FakeDate, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, DOMException,
    setTimeout: (f, ms) => clock.setTimeout(f, ms), clearTimeout: id => clock.clearTimeout(id),
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => {}, matchMedia: () => ({ matches: false }),
    MutationObserver: class { observe() {} disconnect() {} }, innerHeight: 900, addEventListener() {} };
  vm.runInNewContext(PROBED, sandbox, { filename: MODULE, timeout: 5000 });
  const api = W.__GRIDATLAS_MODULES__.ukLightning, S = W.__PROBE__.S;
  if (api.install() !== true) throw new Error('install');
  const main = S.sfs[0];
  const toggle = on => { main.toggle.checked = on; dispatch(main.toggle, 'change', log.errors); };
  const refresh = async () => { await clock.advance(600e3); const t = log.intervals.find(i => i.ms === 6e5); if (!t) throw new Error('no refresh timer'); t.f(); };
  const snap = () => {
    const src = sources.get('gridatlas-lightning'), lay = layers.get('l-gridatlas-lightning');
    const caps = {}; for (const k in main.caps) caps[k] = main.caps[k].textContent;
    return { t: iso(clock.t), label: main.label.textContent, status: main.stx.textContent, dot: main.dot.style.background, caps,
      drawn: src && src.data ? src.data.features.map(f => f.id) : [], visible: lay ? lay.layout.visibility : 'no-layer',
      last: S.last ? JSON.parse(JSON.stringify(S.last)) : null, notes: [...S.errors] };
  };
  return { clock, log, toggle, refresh, snap, S };
}

// ---------------------------------------------------------------- checks
const ZERO = [/\[EMPTY/, /NO FLASHES DETECTED/, /EMPTY-COVERED/, /(^|[^\d,])0 (FLASHES|ARCHIVED)/, /at least 0 /, /no archived flashes within this window/, /none seen(?![^(]*\(unknown, not zero\))/, /\[0 /];
const zeroHits = s => { const txt = [s.label, s.status, ...Object.entries(s.caps).filter(([k]) => k !== 'footer').map(([, v]) => v)]; const h = []; for (const re of ZERO) for (const t of txt) if (re.test(t)) h.push(re.source + ' :: ' + t); return h; };
const reqs = (log, kinds, from) => log.req.slice(from).filter(r => kinds.includes(r.kind)).length;

async function runCase(group, fault) {
  // group -> which resource kinds are faulted; feed group also takes the index down (HTTP 503) so the XHR fallback runs
  const kinds = { index: ['index'], shard: ['shard'], part: ['part'], 'all-day-files': ['shard', 'part'], feed: ['feed'] }[group];
  const rec = { group, fault, harness: 'self-fixture node:vm + minidom, SYNTHETIC data, fake clock, desktop 1440x900 (no layout)', phases: {} };
  const errs0 = { u: unhandled.length, c: uncaught.length };
  let active = true;
  const faultOf = kind => (active === true && kinds.includes(kind)) ? fault : (group === 'feed' && kind === 'index' && active !== 'clean') ? 'http503' : null;
  const stallish = /stall/.test(fault);
  // A. cold: first ON with the fault active
  let x = boot(faultOf); let n0 = x.log.req.length;
  x.toggle(true); await drain();
  if (stallish) { rec.phases.cold_during = x.snap(); await x.clock.advance(14_999); rec.phases.cold_at_14999ms = x.snap(); await x.clock.advance(31_000); }
  rec.phases.cold = x.snap(); rec.phases.cold.faulted_requests = reqs(x.log, kinds, n0);
  // B. next refresh, fault still active: must retry the faulted resource
  n0 = x.log.req.length; await x.refresh(); await drain(); if (stallish) await x.clock.advance(46_000);
  rec.phases.refresh_fault = x.snap(); rec.phases.refresh_fault.faulted_requests = reqs(x.log, kinds, n0);
  // C. next refresh, fault cleared: must recover to the clean baseline
  active = 'clean'; n0 = x.log.req.length; await x.refresh(); await drain();
  rec.phases.refresh_clean = x.snap(); rec.phases.refresh_clean.faulted_requests = reqs(x.log, kinds, n0);
  rec.req_log_cold_boot = x.log.req.map(r => `${r.t} ${r.kind} ${r.url.split('/data/')[1]} ${r.fault || 'ok'}`);
  rec.dispatch_errors = x.log.errors.map(String); x.toggle(false);
  // D. warm: clean ON, then the next refresh hits the fault (stale-as-fresh check)
  active = 'clean'; x = boot(faultOf); x.toggle(true); await drain(); rec.phases.warm_clean = x.snap();
  active = true; n0 = x.log.req.length; await x.refresh(); await drain();
  if (stallish) { rec.phases.warm_during = x.snap(); await x.clock.advance(46_000); }
  rec.phases.warm_fault = x.snap(); rec.phases.warm_fault.faulted_requests = reqs(x.log, kinds, n0);
  rec.req_log_warm_refresh = x.log.req.slice(n0).map(r => `${r.t} ${r.kind} ${r.url.split('/data/')[1]} ${r.fault || 'ok'}`);
  rec.dispatch_errors.push(...x.log.errors.map(String)); x.toggle(false); await drain();
  rec.unhandled = unhandled.slice(errs0.u); rec.uncaught = uncaught.slice(errs0.c);
  return rec;
}

// ---------------------------------------------------------------- run
const BASE = await (async () => { const x = boot(() => null); x.toggle(true); await drain(); const s = x.snap(); x.toggle(false); return s; })();
const GROUPS = [['index', FETCH_FAULTS], ['shard', FETCH_FAULTS], ['part', FETCH_FAULTS], ['all-day-files', FETCH_FAULTS], ['feed', XHR_FAULTS]];
const rows = [], all = [];
for (const [g, faults] of GROUPS) for (const f of faults) {
  const r = await runCase(g, f); all.push(r);
  const P = r.phases, fin = P.cold, failed = new Set(r.req_log_warm_refresh.filter(l => !/ ok$/.test(l)).map(l => l.split(' ')[2]));
  const failedIds = new Set(Object.entries(IDS).filter(([p]) => failed.has('history/' + p)).flatMap(([, v]) => v));
  const zero = [...zeroHits(P.cold), ...zeroHits(P.refresh_fault), ...zeroHits(P.warm_fault)];
  // stale-as-fresh: after the faulted refresh, (a) points from a resource whose request failed are still drawn, or (b) the
  // panel reads exactly like the clean baseline although a faulted request was made and failed
  const wf = P.warm_fault, faultedAndRequested = wf.faulted_requests > 0;
  const accepted = f === 'wrong-ctype' || (f === 'redirect-offhost-cors' && (g === 'index' || g === 'feed'));
  const staleA = wf.drawn.filter(id => failedIds.has(id) && f !== 'wrong-ctype');
  const staleB = faultedAndRequested && !accepted && wf.status === P.warm_clean.status && wf.label === P.warm_clean.label;
  const live = [wf.drawn, P.cold.drawn].flat().filter(id => id === 'evil');
  const row = { group: g, fault: f, cold_label: fin.label, cold_status: fin.status, cold_warning: fin.caps.warning, cold_refresh_cap: fin.caps.refresh,
    retry_requests: P.refresh_fault.faulted_requests, recovered: P.refresh_clean.status === (g === 'feed' ? BASE.status : BASE.status) && JSON.stringify(P.refresh_clean.drawn) === JSON.stringify(BASE.drawn),
    warm_fault_label: wf.label, warm_fault_status: wf.status, warm_requests: wf.faulted_requests, stale_points: staleA, stale_as_fresh: staleA.length > 0 || staleB,
    zero_hits: zero, during: P.warm_during ? { label: P.warm_during.label, status: P.warm_during.status, visible: P.warm_during.visible, drawn: P.warm_during.drawn.length } : null,
    at_14999: P.cold_at_14999ms ? P.cold_at_14999ms.status : null, threw: r.dispatch_errors.length + r.unhandled.length + r.uncaught.length, evil_drawn: live.length };
  rows.push(row);
}
writeFileSync(join(OUT, 'baseline.json'), JSON.stringify(BASE, null, 1));
writeFileSync(join(OUT, 'cases.json'), JSON.stringify(all, null, 1));
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(rows, null, 1));
const tsv = ['group\tfault\tcold label\tcold status\tretry reqs\trecovered\twarm-fault status\tstale-as-fresh\tzero hits\tthrew'];
for (const r of rows) tsv.push([r.group, r.fault, r.cold_label, r.cold_status, r.retry_requests, r.recovered, r.warm_fault_status, r.stale_as_fresh, r.zero_hits.length, r.threw].join('\t'));
writeFileSync(join(OUT, 'summary.tsv'), tsv.join('\n') + '\n');
console.log('BASELINE', BASE.label, '|', BASE.status, '|', BASE.drawn.join(','));
console.log(tsv.join('\n'));
