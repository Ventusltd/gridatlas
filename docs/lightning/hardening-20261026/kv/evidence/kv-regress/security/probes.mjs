// probes.mjs - security-E lane. SYNTHETIC in-memory hostile indexes/feeds against the REAL module bytes under node:vm + minidom.
// Same environment as node-harness-E.mjs (fake clock 2026-10-26T18:40:00Z, 24h window = UTC dates 2026-10-25/26, desktop).
// Base data = lead's genuine fixture lightning/fixtures/lightning-archive/data; each case mutates a deep clone in memory.
// Fetch: index and feed served from memory; day files served from the genuine fixture if the path exists, else 404.
// Every URL requested is recorded. usage: node probes.mjs <module.js> <out.json> [caseRegex]
import vm from 'node:vm'; import { readFileSync, existsSync, writeFileSync } from 'node:fs'; import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url'; import { webcrypto } from 'node:crypto'; import { El, makeDocument, dispatch } from './minidom.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)); const [MOD, OUT, FILTER] = process.argv.slice(2); const SRC = readFileSync(MOD, 'utf8');
const DATA = join(HERE, '..', '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data');
const IX0 = JSON.parse(readFileSync(join(DATA, 'history', 'index.json'), 'utf8')), FEED0 = JSON.parse(readFileSync(join(DATA, 'uk_lightning.geojson'), 'utf8'));
const PFX = 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/'; const NOW0 = Date.parse('2026-10-26T18:40:00Z'), REAL0 = Date.now();
const clone = o => JSON.parse(JSON.stringify(o)); const row = (ix, d) => ix.days.find(r => r.date === d);
const feat = (i, t, lon = -1.5, lat = 53.0, id) => { const f = { type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { time_utc: t, observation_kind: 'optical_lightning_flash' } }; if (id !== undefined) f.id = id; return f };
const T = '2026-10-26T12:00:00Z';
class FD extends Date { constructor(...a) { a.length ? super(...a) : super(NOW0 + (Date.now() - REAL0)) } static now() { return NOW0 + (Date.now() - REAL0) } }

async function run(name, { ix, ixRaw, feed, consent }) {
  const urls = []; const ixText = ixRaw ?? (ix ? JSON.stringify(ix) : null);
  const serve = u => { const x = new URL(u); if (x.href === PFX + 'history/index.json') return ixText == null ? null : Buffer.from(ixText);
    if (x.href === PFX + 'uk_lightning.geojson') return Buffer.from(JSON.stringify(feed || FEED0));
    if (x.host !== 'raw.githubusercontent.com' || !x.pathname.startsWith('/Ventusltd/lightning/main/data/')) return null;
    const p = join(DATA, decodeURIComponent(x.pathname.slice('/Ventusltd/lightning/main/data/'.length))); return p.startsWith(DATA) && existsSync(p) ? readFileSync(p) : null };
  const fetch = async u => { urls.push(String(u)); await new Promise(r => setTimeout(r, 0)); const b = serve(u); return b ? new Response(b, { status: 200 }) : new Response('nope', { status: 404 }) };
  class XHR { open(m, u) { this.url = u } send() { urls.push(this.url); setTimeout(() => { const b = serve(this.url); if (!b) { this.status = 404; this.onload(); return } this.status = 200; this.responseText = b.toString('utf8'); this.onload() }, 0) } }
  const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host); const og = doc.createElement('div'); og.className = 'key-group'; host.appendChild(og);
  const sources = new Map(), layers = new Map();
  const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x } }), addLayer: x => layers.set(x.id, { ...x }),
    removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty(id, k, v) { const l = layers.get(id); if (l) l.layout = { ...l.layout, [k]: v } } };
  const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 1440, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true } };
  const protoBefore = Object.getOwnPropertyNames(Object.prototype).join();
  const sb = { window: W, document: doc, addEventListener: () => { }, innerHeight: 900, Date: FD, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, setTimeout, clearTimeout, setInterval: () => 1, clearInterval: () => { }, matchMedia: () => ({ matches: false }), MutationObserver: class { observe() { } disconnect() { } } };
  vm.runInNewContext(SRC, sb); const api = W.__GRIDATLAS_MODULES__.ukLightning; api.install(); const S = api.state, main = S.sfs[0]; const errs = [];
  const settle = async () => { const t0 = Date.now(); await new Promise(r => setTimeout(r, 5)); while (!S.last || /LOAD/.test(main.label.textContent)) { await new Promise(r => setTimeout(r, 5)); if (Date.now() - t0 > 60000) break } };
  main.toggle.checked = true; dispatch(main.toggle, 'change', errs); await settle();
  let afterConsent = null;
  if (consent && !main.nav.points.hasAttribute('hidden')) { const n0 = urls.length; S.last = null; dispatch(main.nav.points, 'click', errs); await settle(); afterConsent = urls.length - n0 }
  const src = sources.get('gridatlas-lightning'), dayUrls = urls.filter(u => !/index\.json$|uk_lightning\.geojson$/.test(u));
  const r = { case: name, indexAccepted: !!S.idx, ie: S.ie, requests: S.requests, dayRequests: dayUrls.length, uniqueDayUrls: new Set(dayUrls).size, sampleUrls: [...new Set(dayUrls)].slice(0, 6),
    offRepo: dayUrls.filter(u => !u.startsWith(PFX)).length, consentShown: !main.nav.points.hasAttribute('hidden'), afterConsentRequests: afterConsent,
    last: S.last && { st: S.last.state, mode: S.last.mode, drawn: S.last.drawn, ic: S.last.index_count, rs: S.last.reasons },
    label: main.label.textContent, status: main.stx.textContent.slice(0, 160), flashes: main.caps.flashes.textContent.slice(0, 200), searched: main.caps.searched.textContent.slice(0, 160), warning: main.caps.warning.textContent.slice(0, 200),
    drawnIds: src && src.data ? src.data.features.map(f => f.id === undefined ? 'noid' : JSON.stringify(f.id)) : null,
    protoChanged: Object.getOwnPropertyNames(Object.prototype).join() !== protoBefore || ({}).polluted !== undefined, listenerErrors: errs.map(String) };
  console.log(name, JSON.stringify({ acc: r.indexAccepted, ie: r.ie && r.ie.slice(0, 70), dayReq: r.dayRequests, off: r.offRepo, st: r.last && r.last.st, mode: r.last && r.last.mode, drawn: r.last && r.last.drawn, consent: r.consentShown, ac: afterConsent }));
  return r;
}

const C = {};
// ---- A. path allow-list (row.path) ----
const PATHS = { query: 'days/2026/10/25.json?x=1', frag: 'days/2026/10/25.json#x', encSlash: 'days%2F2026%2F10%2F25.json', encSlashLower: 'days%2f2026%2f10%2f25.json', encDot: 'days/2026/10/%2e%2e/25.json',
  dotdot: 'days/2026/10/../25.json', dotdotLead: '../days/2026/10/25.json', upperDays: 'DAYS/2026/10/25.json', upperExt: 'days/2026/10/25.JSON', leadSlash: '/days/2026/10/25.json',
  backslash: 'days\\2026\\10\\25.json', fullwidthDigits: 'days/２０２６/10/25.json', arabicDigits: 'days/٢٠٢٦/10/25.json', devanagari: 'days/२०२६/10/25.json', trailingNL: 'days/2026/10/25.json\n', leadingNL: '\ndays/2026/10/25.json',
  nul: 'days/2026/10/25.json\u0000', ls2028: 'days/2026/10/25.json ', tab: 'days/2026/10/25.json\t', space: 'days/2026/10/25.json ', absolute: 'https://evil.example/days/2026/10/25.json', protoRel: '//evil.example/days/2026/10/25.json',
  arrayWrapped: ['days/2026/10/25.json'], arrayTwo: ['days/2026/10/25.json', 'x'], objectPath: { a: 1 }, numberPath: 20261025, otherDate: 'days/2026/10/21.json' };
for (const [k, p] of Object.entries(PATHS)) C['A-path-' + k] = () => { const ix = clone(IX0); row(ix, '2026-10-25').path = p; return { ix } };
// ---- B. parts path allow-list (same variants, hourly form) ----
const PP = { ok: 'days/2026/10/26/05.json', query: 'days/2026/10/26/05.json?x', encSlash: 'days%2F2026%2F10%2F26%2F05.json', dotdot: 'days/2026/10/26/../05.json', upper: 'days/2026/10/26/05.JSON',
  fullwidth: 'days/2026/10/26/０５.json', arabic: 'days/2026/10/26/٠٥.json', trailingNL: 'days/2026/10/26/05.json\n', leadSlash: '/days/2026/10/26/05.json', crossRepo: '../../../../../evil-owner/evil-repo/main/x.json', arrayWrapped: ['days/2026/10/26/05.json'] };
const partsRow = (ix, parts, extra = {}) => Object.assign(row(ix, '2026-10-26'), { coverage: 'full', scanned_seconds: 86400, count: 1, path: null, bytes: null, sha256: null, sealed: false, parts }, extra);
for (const [k, p] of Object.entries(PP)) C['B-parts-path-' + k] = () => { const ix = clone(IX0); partsRow(ix, [{ hour: '05', path: p, count: 1, bytes: 10, sha256: '0'.repeat(64) }]); return { ix } };
// ---- C. parts caps ----
const hp = (i, pre = '2026/10/26') => ({ hour: String(i % 24).padStart(2, '0'), path: `days/${pre}/${String(i % 24).padStart(2, '0')}.json`, count: 1 });
C['C-parts-24'] = () => { const ix = clone(IX0); partsRow(ix, Array.from({ length: 24 }, (_, i) => hp(i))); return { ix } };
C['C-parts-25'] = () => { const ix = clone(IX0); partsRow(ix, Array.from({ length: 25 }, (_, i) => hp(i))); return { ix } };
C['C-parts-arraylike'] = () => { const ix = clone(IX0); partsRow(ix, { length: 1, 0: hp(5) }); return { ix } };
C['C-parts-string'] = () => { const ix = clone(IX0); partsRow(ix, 'days/2026/10/26/05.json'); return { ix } };
C['C-parts-nullentry'] = () => { const ix = clone(IX0); partsRow(ix, [null]); return { ix } };
C['C-parts-empty-count>0'] = () => { const ix = clone(IX0); partsRow(ix, []); return { ix } };
// ---- D. dedupe keys (duplicate / aliased index dates) -> request amplification and count inflation ----
C['D-dup-date-rows-31x24-count0'] = () => { const ix = clone(IX0); ix.days = ix.days.filter(r => r.date !== '2026-10-26');
  for (let k = 0; k < 31; k++) ix.days.push({ date: '2026-10-26', coverage: 'full', scanned_seconds: 86400, count: 1, path: null, sealed: false, parts: Array.from({ length: 24 }, (_, i) => ({ ...hp(i, `${1000 + k}/10/26`), count: 0 })) });
  return { ix } };
C['D-dup-date-rows-1000-path'] = () => { const ix = clone(IX0); for (let k = 0; k < 1000; k++) ix.days.push({ date: '2026-10-26', coverage: 'full', scanned_seconds: 86400, count: 1, bytes: 1, path: `days/${String(k).padStart(4, '0')}/10/26.json`, sealed: false }); return { ix } };
C['D-dup-date-count-inflation'] = () => { const ix = clone(IX0); ix.days.push({ ...row(ix, '2026-10-25') }, { ...row(ix, '2026-10-25') }); return { ix } };
C['D-alias-date-2026-02-30'] = () => { const ix = clone(IX0); ix.cutoff_date_utc = '2025-10-26'; ix.days.push({ date: '2026-02-30', coverage: 'full', scanned_seconds: 86400, count: 5, bytes: 1, path: 'days/2026/03/02.json', sealed: true }); return { ix, note: 'row only matters for a window over 2026-03-02; checks acceptance only' } };
C['D-alias-date-2026-10-32'] = () => { const ix = clone(IX0); ix.days.push({ date: '2026-10-32', coverage: 'full', scanned_seconds: 86400, count: 5, bytes: 1, path: 'days/2026/10/32.json', sealed: true }); return { ix } };
// ---- E. numeric coercion ----
const CNT = { str: '3', bool: true, inf: '1e999', float: 3.5, neg: -1, negZero: '-0', big: 2 ** 53, hexStr: '0x3', nullFull: null, arr: [3], expNum: '3e0' };
for (const [k, v] of Object.entries(CNT)) C['E-rowcount-' + k] = () => { const ix = clone(IX0); const r = row(ix, '2026-10-25'); if (typeof v === 'string' && /e999|^-0$|e0$/.test(v)) { r.count = 777777; return { ixRaw: JSON.stringify(ix).replace('"count":777777', '"count":' + v) } } r.count = v; return { ix } };
C['E-scanned-seconds-string'] = () => { const ix = clone(IX0); Object.assign(row(ix, '2026-10-26'), { count: 0, scanned_seconds: '1' }); return { ix } };
C['E-scanned-seconds-true'] = () => { const ix = clone(IX0); Object.assign(row(ix, '2026-10-26'), { count: 0, scanned_seconds: true }); return { ix } };
C['E-sealed-string'] = () => { const ix = clone(IX0); row(ix, '2026-10-25').sealed = 'true'; return { ix } };
// negative part count offsets the index budget so a 10,000,000-flash day is fetched without LOAD POINTS consent
C['E-partcount-negative-budget-bypass'] = () => { const ix = clone(IX0); Object.assign(row(ix, '2026-10-25'), { count: 10000000, bytes: 5300000000 });
  partsRow(ix, [{ hour: '05', path: 'days/2026/10/26/05.json', count: -10000000, bytes: -5300000000 }]); return { ix } };
C['E-control-budget-no-negative'] = () => { const ix = clone(IX0); Object.assign(row(ix, '2026-10-25'), { count: 10000000, bytes: 5300000000 }); return { ix } };
C['E-partcount-float'] = () => { const ix = clone(IX0); partsRow(ix, [{ hour: '05', path: 'days/2026/10/26/05.json', count: 0.5 }]); return { ix } };
C['E-partcount-zero-x24'] = () => { const ix = clone(IX0); partsRow(ix, Array.from({ length: 24 }, (_, i) => ({ ...hp(i), count: 0 }))); return { ix } };
const HR = { null: null, nan: 'x', neg: -100, arr: [5], space: ' 5', exp: '5e0' };
for (const [k, v] of Object.entries(HR)) C['E-parthour-' + k] = () => { const ix = clone(IX0); partsRow(ix, [{ hour: v, path: 'days/2026/10/26/05.json', count: 1 }]); return { ix } };
// ---- F. schema check ----
const SCH = { trailingSpace: 'uk-lightning-history-index.v2 ', upper: 'UK-LIGHTNING-HISTORY-INDEX.V2', v1: 'uk-lightning-history-index.v1', v3: 'uk-lightning-history-index.v3', missing: undefined, array: ['uk-lightning-history-index.v2'], nul: null, zwsp: 'uk-lightning-history-index.v2​' };
for (const [k, v] of Object.entries(SCH)) C['F-schema-' + k] = () => { const ix = clone(IX0); if (v === undefined) delete ix.schema; else ix.schema = v; return { ix } };
C['F-schema-proto-only'] = () => { const ix = clone(IX0); delete ix.schema; const s = JSON.stringify(ix); return { ixRaw: '{"__proto__":{"schema":"uk-lightning-history-index.v2"},' + s.slice(1) } };
C['F-observation-trailing'] = () => { const ix = clone(IX0); ix.observation += ' '; return { ix } };
C['F-days-proto-only'] = () => { const ix = clone(IX0); const d = ix.days; delete ix.days; const s = JSON.stringify(ix); return { ixRaw: '{"__proto__":{"days":' + JSON.stringify(d) + '},' + s.slice(1) } };
// feed observation_kind
const OK = { exact: 'optical_lightning_flash', upper: 'OPTICAL_LIGHTNING_FLASH', space: 'optical_lightning_flash ', suffix: 'lightning_flash', withSlash: 'x/optical_lightning_flash', full: 'FeatureCollection/optical_lightning_flash', array: ['optical_lightning_flash'], empty: '', missing: undefined };
for (const [k, v] of Object.entries(OK)) C['F-feed-kind-' + k] = () => { const fd = clone(FEED0); const f = feat(1, T, -1.5, 53, 'K1'); if (v === undefined) delete f.properties.observation_kind; else f.properties.observation_kind = v; fd.features = [f]; return { feed: fd } };
// ---- G. prototype keys in index entries ----
C['G-row-proto-keys'] = () => { const ix = clone(IX0); const s = JSON.stringify(ix).replace('{"date":"2026-10-26"', '{"__proto__":{"count":5,"path":"../../evil.json","parts":[{"path":"../x.json","count":1}],"polluted":1},"constructor":{"prototype":{"polluted":2}},"date":"2026-10-26"'); return { ixRaw: s } };
C['G-part-proto-keys'] = () => { const ix = clone(IX0); partsRow(ix, [{ hour: '05', path: 'days/2026/10/26/05.json', count: 1 }]); return { ixRaw: JSON.stringify(ix).replace('{"hour":"05"', '{"__proto__":{"path":"../../../../evil/x.json","sealed":true,"polluted":3},"hour":"05"') } };
C['G-part-proto-path-only'] = () => { const ix = clone(IX0); partsRow(ix, [{ hour: '05', path: 'days/2026/10/26/05.json', count: 1 }]); return { ixRaw: JSON.stringify(ix).replace('{"hour":"05","path":"days/2026/10/26/05.json"', '{"__proto__":{"path":"days/2026/10/26/05.json"},"hour":"05"') } };
C['G-date-__proto__'] = () => { const ix = clone(IX0); ix.days.push({ date: '__proto__', coverage: 'none', count: null, sealed: true }); return { ix } };
C['G-row-shard_lost-proto'] = () => { const ix = clone(IX0); return { ixRaw: JSON.stringify(ix).replace('{"date":"2026-10-25"', '{"__proto__":{"shard_lost":true},"date":"2026-10-25"') } };
// ---- H. feed dedupe keys ----
C['H-feed-dedupe'] = () => { const fd = clone(FEED0); fd.features = [feat(1, T, -1.5, 53, 0), feat(2, T, -1.4, 53, -0), feat(3, T, -1.3, 53, '0'), feat(4, T, -1.2, 53, 1e21), feat(5, T, -1.1, 53, 1000000000000000000000),
  feat(6, T, -1.0, 53), feat(7, '2026-10-26T12:00:00.000Z', -1.0, 53), feat(8, '2026-10-26T12:00:00', -1.0, 53), feat(9, T, -0.9, 53, Date.parse(T) + ',-1,53'), feat(10, T, -0.8, 53, { a: 1 }), feat(11, T, -0.7, 53, { a: 1 }),
  feat(12, T, -0.6, 53, '__proto__'), feat(13, T, -0.5, 53, 'constructor'), feat(14, T, -0.4, 53, null)]; return { feed: fd } };
C['H-feed-noid-distinct-alt'] = () => { const fd = clone(FEED0); const a = feat(1, T, -1, 53), b = feat(2, T, -1, 53); b.geometry.coordinates.push(100); fd.features = [a, b]; return { feed: fd } };
C['H-feed-coords-strings'] = () => { const fd = clone(FEED0); fd.features = [feat(1, T, '-1', '53', 'S1'), feat(2, T, -1, 53, 'S2')]; return { feed: fd } };
// ---- I. overlapping scan_windows (coverage honesty; S8 follow-up) ----
C['I-sw-duplicated-once'] = () => { const ix = clone(IX0); ix.scan_windows = ix.scan_windows.concat(clone(ix.scan_windows)); return { ix } };
C['I-sw-contained'] = () => { const ix = clone(IX0); ix.scan_windows.push({ start_utc: '2026-10-26T01:00:00Z', end_utc: '2026-10-26T01:00:01Z', successful_runs: 1 }); return { ix } };
C['I-sw-control'] = () => ({ ix: clone(IX0) });

const out = []; for (const [k, f] of Object.entries(C)) { if (FILTER && !new RegExp(FILTER).test(k)) continue; try { out.push(await run(k, f())) } catch (e) { console.log(k, 'HARNESS-ERROR', e.message); out.push({ case: k, harnessError: e.message }) } }
writeFileSync(OUT, JSON.stringify(out, null, 1));
