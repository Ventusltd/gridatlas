// time-boundaries.vm.mjs — deterministic cross-check of the SAME case bodies as time-boundaries.browser.mjs (sliced from that
// file between "const FULL" and "// ---- run"), executed against the real candidate module source under node:vm with
// minidom.mjs, a controlled Date (Date.now() and new Date() return the case instant) and the process TZ set by the caller
// (TZ=Europe/London|UTC|America/New_York|Asia/Kolkata). Data: SYNTHETIC fixtures in ./fixtures/synthetic (not EUMETSAT).
// usage: TZ=<zone> node time-boundaries.vm.mjs --module <overlay.js> [--out file.json] [--only T01,T02]
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { makeDocument, dispatch } from './minidom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODULE = arg('module'), OUTF = arg('out'), ONLY = (arg('only') || '').split(',').filter(Boolean);
const SRC = readFileSync(MODULE, 'utf8');
const SEAM = 'NS.ukLightning=Object.freeze(';
if (SRC.split(SEAM).length !== 2) throw new Error('seam');
const PROBED = SRC.replace(SEAM, 'window.__PROBE__={S,cv,wf,stale,cp,cf};' + SEAM);
const DATA = join(HERE, 'fixtures', 'synthetic', 'data', 'history');
const ROWS = JSON.parse(readFileSync(join(HERE, 'fixtures', 'synthetic', 'rows.json'), 'utf8'));
const TZ = process.env.TZ || '(unset)';

const H = 36e5, DAY = 864e5, MIN = 6e4;
const P = s => Date.parse(s);
const iso = t => new Date(t).toISOString();
const Tm = t => iso(t).slice(0, 16).replace('T', ' ') + ' UTC';
const RealDate = Date;

function expected(s, e) {
  let n = 0; const ids = [];
  for (const d of Object.keys(ROWS)) { if (ROWS[d].note) continue; const b = P(d + 'T00:00:00Z');
    if (b + DAY <= s || b >= e) continue;
    for (let k = 0; k < 48; k++) { const t = b + k * 30 * MIN; if (t >= s && t < e) { n++; ids.push(`syn-${d}-${iso(t).slice(11, 13)}${iso(t).slice(14, 16)}`); } } }
  return { n, ids };
}
function makeIndex({ gen, nextDue, cutoff, scan, iv = 3, dates }) {
  const days = (dates || Object.keys(ROWS)).filter(d => d >= cutoff).sort().map(d => { const r = { ...ROWS[d] }; delete r.note; return r; });
  const sw = (scan || []).map(([a, b, n = 1]) => ({ start_utc: iso(a), end_utc: iso(b), successful_runs: n }));
  const ix = { schema: 'uk-lightning-history-index.v2', synthetic: 'SYNTHETIC time-boundaries fixture, not EUMETSAT data', generated_utc: iso(gen), collection_interval_hours: iv,
    cutoff_date_utc: cutoff, observation: 'satellite optical lightning flashes, not ground strikes', scan_windows: sw, days };
  if (nextDue) ix.next_update_due_utc = iso(nextDue);
  if (sw.length) ix.coverage_start_utc = sw[0].start_utc;
  return ix;
}

function boot(tz) {
  const c = { tz, now: P('2026-10-26T23:40:00Z'), req: [], errors: [], index: null, feed: null };
  class FD extends RealDate { constructor(...a) { if (a.length) super(...a); else super(c.now); } static now() { return c.now; } }
  const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const kg = doc.createElement('div'); kg.className = 'key-group'; host.appendChild(kg);
  const sources = new Map(), layers = new Map();
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, _data: null, setData(x) { this._data = x; } }), addLayer: x => layers.set(x.id, x),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty() {} };
  class XHR { open(m, u) { this.url = u; } send() { c.req.push('feed'); setTimeout(() => { if (!c.feed) { this.status = 404; this.onload(); return; } this.status = 200; this.responseText = JSON.stringify(c.feed); this.onload(); }, 0); } }
  const fetch = async url => {
    await null; const k = url.split('/data/history/')[1];
    if (k === 'index.json') { c.req.push('index.json'); return c.index ? new Response(JSON.stringify(c.index), { status: 200 }) : new Response('nf', { status: 404 }); }
    c.req.push(k); try { return new Response(readFileSync(join(DATA, k)), { status: 200 }); } catch { return new Response('nf', { status: 404 }); }
  };
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const sandbox = { window: W, document: doc, Date: FD, AbortController, Map, Promise, XMLHttpRequest: XHR, fetch, Response, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {}, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() {} disconnect() {} } };
  vm.runInNewContext(PROBED, sandbox, { filename: MODULE, timeout: 5000 });
  c.W = W; c.S = W.__PROBE__.S; if (!W.__GRIDATLAS_MODULES__.ukLightning.install()) throw new Error('install');
  c.sf = c.S.sfs[0]; c.map = map;
  c.page = { clock: { setSystemTime: async d => { c.now = +d; } } };
  return c;
}
const settle = async c => { const t0 = RealDate.now(); while (RealDate.now() - t0 < 30000) { await new Promise(r => setTimeout(r, 2)); if (c.S.res && c.sf.stx.textContent !== 'LOADING') { await new Promise(r => setImmediate(r)); return; } } throw new Error('vm: did not settle'); };
const read = c => {
  const sf = c.sf, S = c.S, r = S.res, caps = {}; for (const k in sf.caps) caps[k] = sf.caps[k].textContent;
  const nav = {}; for (const k in sf.nav) nav[k] = sf.nav[k].disabled; const src = c.map.getSource('gridatlas-lightning');
  return { label: sf.label.textContent, status: sf.stx.textContent, caps, nav, w: r && r.w ? { s: r.w.s, e: r.w.e, atLatest: r.w.atLatest, clamped: r.w.clamped } : null, mode: r && r.mode,
    ids: r && r.ev ? r.ev.map(x => String(x.id)) : [], mapFeatures: src && src._data ? src._data.features.length : null, last: S.last,
    inputs: { from: sf.from.value, to: sf.to.value, fromMin: sf.from.min, fromMax: sf.from.max, toMax: sf.to.max }, ny: r && r.cov ? r.cov.ny : null, cov: r && r.cov ? r.cov.f : null };
};
const act = async (c, fn) => { const s0 = c.S.serial; c.req = []; fn(); if (c.S.serial === s0) throw new Error('vm: action did not reload'); await settle(c); return read(c); };
const clickEl = el => { const e = []; dispatch(el, 'click', e); if (e.length) throw e[0]; };
async function setup(c, now, ixOpts, feed) {
  c.index = ixOpts ? makeIndex(ixOpts) : null; c.feed = feed || null; c.now = now;
  const t = c.sf.toggle; if (t.checked) { t.checked = false; dispatch(t, 'change', []); }
  return act(c, () => { t.checked = true; dispatch(t, 'change', []); });
}
const period = (c, p) => act(c, () => clickEl(c.sf.chips[p]));
const nav = (c, n) => act(c, () => clickEl(c.sf.nav[n]));
async function custom(c, from, to) { if (c.S.period !== 'custom') await period(c, 'custom'); c.sf.from.value = from; c.sf.to.value = to; return act(c, () => clickEl(c.sf.nav.apply)); }
function utcOnly(v) {
  const txt = [v.label, v.status, ...Object.values(v.caps)].join(' \n '); const bad = [];
  for (const m of txt.matchAll(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(\s?UTC)?/g)) if (!m[1]) bad.push(m[0]);
  for (const m of txt.matchAll(/\b(GMT|BST|IST|EST|EDT|CET|CEST)\b|[+-]\d{2}:\d{2}\b/g)) bad.push(m[0]);
  return bad;
}
const A = (what, ok, observed) => ({ what, ok: !!ok, observed });
function winAsserts(v, s, e, { exactCount = true } = {}) {
  const x = expected(s, e), got = v.ids, uniq = new Set(got).size === got.length;
  const out = [A(`window [${iso(s)}, ${iso(e)})`, v.w && v.w.s === s && v.w.e === e, v.w && { s: iso(v.w.s), e: iso(v.w.e) }),
    A(`caption shows ${Tm(s)} → ${Tm(e)}`, v.caps.window.includes(`${Tm(s)} → ${Tm(e)}`), v.caps.window),
    A('all displayed times carry UTC, no local zone', utcOnly(v).length === 0, utcOnly(v))];
  if (exactCount) out.push(A(`flashes = ${x.n} (no hour lost/double counted)`, got.length === x.n && uniq && x.ids.every(i => got.includes(i)), { got: got.length, uniq, missing: x.ids.filter(i => !got.includes(i)).slice(0, 6), extra: got.filter(i => !x.ids.includes(i)).slice(0, 6) }),
    A('map source features = drawn', v.mapFeatures === got.length, { map: v.mapFeatures, drawn: got.length }));
  return out;
}

// the case bodies, verbatim from the browser suite
const BSRC = readFileSync(join(HERE, 'time-boundaries.browser.mjs'), 'utf8');
const body = BSRC.slice(BSRC.indexOf('const FULL ='), BSRC.indexOf('// ---------------------------------------------------------------- run'));
const CASES = [];
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFn('P', 'DAY', 'H', 'MIN', 'iso', 'Tm', 'setup', 'period', 'nav', 'custom', 'winAsserts', 'A', 'expected', 'utcOnly', 'OUT', body + '\nOUT.push(...CASES);')
  (P, DAY, H, MIN, iso, Tm, setup, period, nav, custom, winAsserts, A, expected, utcOnly, CASES);

const RUN = { module: MODULE, tz: TZ, offsetCheck: { '2026-10-24T12:00Z': new Date(P('2026-10-24T12:00:00Z')).getTimezoneOffset(), '2026-10-26T12:00Z': new Date(P('2026-10-26T12:00:00Z')).getTimezoneOffset() }, harness: 'node:vm + minidom + controlled Date; SYNTHETIC fixtures', results: [] };
for (const k of CASES) {
  if (ONLY.length && !ONLY.includes(k.id)) continue;
  let asserts; try { asserts = await k.fn(boot(TZ)); } catch (e) { asserts = [A('ERROR ' + String(e.stack || e).split('\n').slice(0, 2).join(' | '), false, null)]; }
  const res = asserts.every(a => a.ok) ? 'PASS' : 'FAIL';
  RUN.results.push({ tz: TZ, id: k.id, title: k.title, result: res, asserts });
  console.log(`${TZ.padEnd(16)} ${k.id} ${res}  ${k.title}`); for (const a of asserts) if (!a.ok) console.log(`     x ${a.what} :: ${JSON.stringify(a.observed).slice(0, 400)}`);
}
console.log('tz offsets (min):', JSON.stringify(RUN.offsetCheck));
if (OUTF) writeFileSync(OUTF, JSON.stringify(RUN, null, 1));
process.exit(0);
