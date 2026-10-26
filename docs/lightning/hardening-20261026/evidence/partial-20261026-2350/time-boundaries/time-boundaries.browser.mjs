// time-boundaries.browser.mjs — hardening lane "time-boundaries", issue #32.
// Harness: lead-shim (../../../lightning/harness/offline-shim.mjs) + SYNTHETIC fixtures (./fixtures/synthetic, built by
// build_fixtures.py; every UTC hour holds flashes at HH:00:00.000Z and HH:30:00.000Z). index.json is generated per case
// by this file (also saved under runs/<stamp>/indexes/). Chromium (Playwright 1.63) desktop 1440x900, locale en-GB,
// browser timezone emulated via context timezoneId. Clock: page.clock.install, paused, then setSystemTime per case (Date.now frozen at the exact instant).
// Gestures: real locator.click() on chips/nav/toggle; date inputs via locator.fill() (keyboard-equivalent).
// usage: node time-boundaries.browser.mjs --route http://127.0.0.1:8174/wt/atlas/v/202610262323/ [--tz Europe/London,UTC] [--only T1,T5]
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'fixtures', 'synthetic', 'data');
const ROWS = JSON.parse(await readFile(join(HERE, 'fixtures', 'synthetic', 'rows.json'), 'utf8'));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROUTE = arg('route'); if (!ROUTE) { console.error('need --route'); process.exit(2); }
const TZS = (arg('tz') || 'Europe/London,UTC,America/New_York,Asia/Kolkata').split(',');
const ONLY = (arg('only') || '').split(',').filter(Boolean);
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const OUT = arg('out') || join(HERE, 'runs', STAMP);
await mkdir(join(OUT, 'indexes'), { recursive: true });

const H = 36e5, DAY = 864e5, MIN = 6e4;
const P = s => Date.parse(s);
const iso = t => new Date(t).toISOString();
const Tm = t => iso(t).slice(0, 16).replace('T', ' ') + ' UTC';
const G = '#scada-ui-container [data-lightning-group="main"]';
const SEL = { toggle: `${G} input[data-lightning-control="toggle"]`, chip: p => `${G} button[data-lightning-period="${p}"]`, nav: n => `${G} button[data-lightning-nav="${n}"]`, date: k => `${G} input[data-lightning-date="${k}"]` };

// expected flashes in [s,e): synthetic marks every 30 min on catalogue dates (zone-less date excluded)
function expected(s, e) {
  let n = 0; const ids = [];
  for (const d of Object.keys(ROWS)) { if (ROWS[d].note) continue; const b = P(d + 'T00:00:00Z');
    if (b + DAY <= s || b >= e) continue;
    for (let k = 0; k < 48; k++) { const t = b + k * 30 * MIN; if (t >= s && t < e) { n++; ids.push(`syn-${d}-${iso(t).slice(11, 13)}${iso(t).slice(14, 16)}`); } } }
  return { n, ids };
}
// index v2 generator
function makeIndex({ gen, nextDue, cutoff, scan, iv = 3, dates }) {
  const days = (dates || Object.keys(ROWS)).filter(d => d >= cutoff).sort().map(d => { const r = { ...ROWS[d] }; delete r.note; return r; });
  const sw = (scan || []).map(([a, b, n = 1]) => ({ start_utc: iso(a), end_utc: iso(b), successful_runs: n }));
  const ix = { schema: 'uk-lightning-history-index.v2', synthetic: 'SYNTHETIC time-boundaries fixture, not EUMETSAT data', generated_utc: iso(gen), collection_interval_hours: iv,
    cutoff_date_utc: cutoff, observation: 'satellite optical lightning flashes, not ground strikes', scan_windows: sw, days };
  if (nextDue) ix.next_update_due_utc = iso(nextDue);
  if (sw.length) { ix.coverage_start_utc = sw[0].start_utc; }
  return ix;
}

const browser = await chromium.launch({ headless: true });
const RUN = { route: ROUTE, harness: 'lead-shim + self-fixture (SYNTHETIC); Chromium ' + browser.version() + ' headless desktop 1440x900 locale en-GB; clock page.clock.install + pauseAt, then setSystemTime per case (Date frozen at the exact instant)', startedAt: new Date().toISOString(), tzs: TZS, results: [] };
let idxSeq = 0;

async function boot(tz) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: tz, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const c = { tz, ctx, page, req: [], errors: [], index: null };
  page.on('pageerror', e => c.errors.push(String(e.message || e).slice(0, 300)));
  page.on('request', r => { const u = r.url(); if (u.includes('raw.githubusercontent.com/Ventusltd/lightning')) c.req.push(u.replace(/^.*\/data\/history\//, '').replace(/^.*\/data\//, '')); });
  await page.clock.install({ time: new Date('2026-10-26T23:40:00Z') });
  c.shim = await installOfflineShim(page, { lightningDataDir: DATA });
  // registered after the shim, so it takes precedence: dynamic synthetic index (null -> 404)
  await page.route(u => u.hostname === 'raw.githubusercontent.com' && u.pathname.endsWith('/data/history/index.json'), r => c.index
    ? r.fulfill({ status: 200, body: JSON.stringify(c.index), headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } })
    : r.fulfill({ status: 404, body: 'nf', headers: { 'access-control-allow-origin': '*' } }));
  await page.route(u => u.hostname === 'raw.githubusercontent.com' && u.pathname.endsWith('/data/uk_lightning.geojson'), r => c.feed
    ? r.fulfill({ status: 200, body: JSON.stringify(c.feed), headers: { 'content-type': 'application/geo+json', 'access-control-allow-origin': '*' } })
    : r.fulfill({ status: 404, body: 'nf', headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  c.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2000 });
  await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
  // pause the fake clock: from here Date.now() only changes via setSystemTime (exact boundary instants)
  const pnow = await page.evaluate(() => Date.now()); await page.clock.pauseAt(new Date(pnow + 1000));
  return c;
}
const serial = c => c.page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.serial);
async function act(c, fn) {
  const s0 = await serial(c); c.req = []; await fn();
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const ok = await c.page.evaluate(s0 => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; const st = document.querySelector('#scada-ui-container [data-lightning-group="main"] .status-dot');
      return S.serial > s0 && S.res && st && st.innerText.trim() !== 'LOADING'; }, s0);
    if (ok) break; await c.page.waitForTimeout(150);
  }
  await c.page.waitForTimeout(150);
  return read(c);
}
const read = c => c.page.evaluate(() => {
  const g = document.querySelector('#scada-ui-container [data-lightning-group="main"]'), S = window.__GRIDATLAS_MODULES__.ukLightning.state, r = S.res;
  const caps = {}; g.querySelectorAll('[data-cap]').forEach(n => caps[n.dataset.cap] = n.innerText.trim());
  const nav = {}; g.querySelectorAll('[data-lightning-nav]').forEach(b => nav[b.dataset.lightningNav] = b.disabled);
  const m = window.__GRIDATLAS_V9_MAP__, src = m && m.getSource('gridatlas-lightning'); const sd = src && src._data;
  const f = g.querySelector('[data-lightning-date="from"]'), t = g.querySelector('[data-lightning-date="to"]');
  return { label: g.querySelector('[data-lightning-label]').innerText.trim(), status: g.querySelector('.status-dot').innerText.trim(), caps, nav,
    w: r && r.w ? { s: r.w.s, e: r.w.e, atLatest: r.w.atLatest, clamped: r.w.clamped } : null, mode: r && r.mode, ids: r && r.ev ? r.ev.map(x => String(x.id)) : [],
    mapFeatures: sd && sd.features ? sd.features.length : null, last: S.last, inputs: { from: f.value, to: t.value, fromMin: f.min, fromMax: f.max, toMax: t.max },
    ny: r && r.cov ? r.cov.ny : null, cov: r && r.cov ? r.cov.f : null };
});
const click = (c, sel) => c.page.locator(sel).first().click({ timeout: 8000 });
async function setup(c, now, ixOpts, feed) {
  c.index = ixOpts ? makeIndex(ixOpts) : null; c.feed = feed || null;
  const name = `${String(++idxSeq).padStart(3, '0')}-${c.tz.replace('/', '_')}.json`;
  await writeFile(join(OUT, 'indexes', name), JSON.stringify(c.index, null, 1));
  await c.page.clock.setSystemTime(new Date(now));
  const on = await c.page.locator(SEL.toggle).first().isChecked();
  if (on) await click(c, SEL.toggle);
  return act(c, () => click(c, SEL.toggle));
}
const period = (c, p) => act(c, () => click(c, SEL.chip(p)));
const nav = (c, n) => act(c, () => click(c, SEL.nav(n)));
async function custom(c, from, to) {
  if (!(await c.page.locator(SEL.date('from')).first().isVisible())) await period(c, 'custom');
  await c.page.locator(SEL.date('from')).first().fill(from);
  await c.page.locator(SEL.date('to')).first().fill(to);
  return act(c, () => click(c, SEL.nav('apply')));
}
// every displayed date-time must carry UTC; no local zone names
function utcOnly(v) {
  const txt = [v.label, v.status, ...Object.values(v.caps)].join(' \n ');
  const bad = [];
  for (const m of txt.matchAll(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(\s?UTC)?/g)) if (!m[1]) bad.push(m[0]);
  for (const m of txt.matchAll(/\b(GMT|BST|IST|EST|EDT|CET|CEST)\b|[+-]\d{2}:\d{2}\b/g)) bad.push(m[0]);
  return bad;
}
const A = (what, ok, observed) => ({ what, ok: !!ok, observed });
// window, count, ids, map, UTC-only
function winAsserts(v, s, e, { exactCount = true } = {}) {
  const x = expected(s, e), got = v.ids, uniq = new Set(got).size === got.length;
  const out = [A(`window [${iso(s)}, ${iso(e)})`, v.w && v.w.s === s && v.w.e === e, v.w && { s: iso(v.w.s), e: iso(v.w.e) }),
    A(`caption shows ${Tm(s)} → ${Tm(e)}`, v.caps.window.includes(`${Tm(s)} → ${Tm(e)}`), v.caps.window),
    A('all displayed times carry UTC, no local zone', utcOnly(v).length === 0, utcOnly(v))];
  if (exactCount) out.push(A(`flashes = ${x.n} (no hour lost/double counted)`, got.length === x.n && uniq && x.ids.every(i => got.includes(i)), { got: got.length, uniq, missing: x.ids.filter(i => !got.includes(i)).slice(0, 6), extra: got.filter(i => !x.ids.includes(i)).slice(0, 6) }),
    A('map source features = drawn', v.mapFeatures === got.length, { map: v.mapFeatures, drawn: got.length }));
  return out;
}
const FULL = (a, b) => ({ gen: P(b) - 30 * MIN, cutoff: '2025-10-01', scan: [[P(a), P(b)]] }); // index generated 30 min before scan end
const CASES = [];
const T = (id, title, fn) => CASES.push({ id, title, fn });

// ---------------------------------------------------------------- DST (UK clocks back 01:00 UTC 25 Oct 2026)
T('T01', '24H window spanning the 25 Oct 01:00 UTC clock change', async c => {
  const now = P('2026-10-25T01:30:00Z'); const v = await setup(c, now, FULL('2026-10-01T00:00:00Z', '2026-10-30T00:00:00Z')); const v2 = await period(c, '24h');
  const now2 = P('2026-10-26T00:30:00Z'); await c.page.clock.setSystemTime(new Date(now2)); const v3 = await period(c, '12h'); const v4 = await period(c, '24h');
  return [...winAsserts(v2, now - DAY, now), ...winAsserts(v3, now2 - 12 * H, now2), ...winAsserts(v4, now2 - DAY, now2)];
});
T('T02', '7D and 30D windows spanning the clock change', async c => {
  const now = P('2026-10-28T12:00:00Z'); await setup(c, now, FULL('2026-09-01T00:00:00Z', '2026-11-30T00:00:00Z'));
  const v7 = await period(c, '7d'); const v30 = await period(c, '30d');
  return [...winAsserts(v7, now - 7 * DAY, now), A('7D = 336 flashes (168 h x 2)', v7.ids.length === 336, v7.ids.length), ...winAsserts(v30, now - 30 * DAY, now), A('30D = 1440', v30.ids.length === 1440, v30.ids.length)];
});
T('T03', 'CUSTOM From/To across the clock change; midnight UTC not local midnight', async c => {
  const now = P('2026-10-28T12:00:00Z'); await setup(c, now, FULL('2026-09-01T00:00:00Z', '2026-11-30T00:00:00Z'));
  const v = await custom(c, '2026-10-24', '2026-10-26'); const v1 = await custom(c, '2026-10-25', '2026-10-25');
  return [...winAsserts(v, P('2026-10-24T00:00:00Z'), P('2026-10-27T00:00:00Z')), A('caption names UTC dates inclusive', v.caps.window.startsWith('Window  UTC dates 2026-10-24 to 2026-10-26 inclusive'), v.caps.window), A('72 h = 144 flashes', v.ids.length === 144, v.ids.length),
    ...winAsserts(v1, P('2026-10-25T00:00:00Z'), P('2026-10-26T00:00:00Z')), A('25 Oct (UTC day, 24 h; London local day is 25 h) = 48', v1.ids.length === 48, v1.ids.length)];
});
T('T04', 'CUSTOM defaults and date-input max use the UTC date when local date differs', async c => {
  // 23:40 UTC 26 Oct: Kolkata local is 27 Oct 05:10; 02:00 UTC 27 Oct: New York local is 26 Oct 22:00
  const n1 = P('2026-10-26T23:40:00Z'); await setup(c, n1, FULL('2026-10-01T00:00:00Z', '2026-10-26T23:40:00Z'));
  const v1 = await period(c, 'custom');
  const n2 = P('2026-10-27T02:00:00Z'); await setup(c, n2, FULL('2026-10-01T00:00:00Z', '2026-10-27T02:00:00Z'));
  const v2b = await custom(c, '2026-10-27', '2026-10-27');
  return [A('default From/To = UTC date 2026-10-26', v1.inputs.from === '2026-10-26' && v1.inputs.to === '2026-10-26', v1.inputs), A('input max = UTC date 2026-10-26', v1.inputs.fromMax === '2026-10-26' && v1.inputs.toMax === '2026-10-26', v1.inputs),
    ...winAsserts(v1, P('2026-10-26T00:00:00Z'), n1), A('today-so-far = 48 (00:00..23:30)', v1.ids.length === 48, v1.ids.length),
    A('after 00:00 UTC the max moves to 2026-10-27 even where local date is still 26th', v2b.inputs.toMax === '2026-10-27', v2b.inputs),
    ...winAsserts(v2b, P('2026-10-27T00:00:00Z'), n2), A('00:00–02:00 UTC = 4 flashes', v2b.ids.length === 4, v2b.ids.length)];
});
// ---------------------------------------------------------------- day shard selection
const files = req => req.filter(u => u.startsWith('days/')).sort();
T('T05', 'Day-shard selection at 23:59:59.999 and 00:00:00.000 UTC (split day 25 Oct)', async c => {
  const ix = FULL('2026-10-01T00:00:00Z', '2026-10-30T00:00:00Z'); const out = [];
  for (const [now, want] of [['2026-10-25T23:59:59.999Z', ['days/2026/10/24.json', ...Array.from({ length: 24 }, (_, h) => `days/2026/10/25/${String(h).padStart(2, '0')}.json`)]],
    ['2026-10-26T00:00:00.000Z', Array.from({ length: 24 }, (_, h) => `days/2026/10/25/${String(h).padStart(2, '0')}.json`)],
    ['2026-10-25T00:00:00.000Z', ['days/2026/10/24.json']],
    ['2026-10-24T23:59:59.999Z', ['days/2026/10/23.json', 'days/2026/10/24.json']],
    ['2026-10-25T12:00:00.000Z', ['days/2026/10/24.json', ...Array.from({ length: 12 }, (_, h) => `days/2026/10/25/${String(h).padStart(2, '0')}.json`)]]]) {
    const t = P(now); await setup(c, t, ix); const v = await period(c, '24h');
    // a 24h chip click after setup loads the same window; read requests from setup+click combined via a fresh LATEST-equivalent: toggle cycle
    const v2 = await setup(c, t, ix); // ON with 24h selected -> fresh index + shards
    out.push(...winAsserts(v2, t - DAY, t), A(`${now}: shards fetched = exactly overlapping ones`, JSON.stringify([...new Set(files(c.req))]) === JSON.stringify(want.sort()), { got: [...new Set(files(c.req))], want }));
  }
  return out;
});
// ---------------------------------------------------------------- PREV/NEXT across month and year ends
T('T06', '24H PREV/NEXT across 31 Dec -> 1 Jan', async c => {
  const now = P('2027-01-01T00:30:00Z'); await setup(c, now, FULL('2026-12-01T00:00:00Z', '2027-01-01T00:30:00Z'));
  const w0 = await period(c, '24h'); const w1 = await nav(c, 'prev'); const w2 = await nav(c, 'prev'); const n1 = await nav(c, 'next'); const n0 = await nav(c, 'next');
  const all = [...w0.ids, ...w1.ids, ...w2.ids];
  return [...winAsserts(w0, now - DAY, now), ...winAsserts(w1, now - 2 * DAY, now - DAY), ...winAsserts(w2, now - 3 * DAY, now - 2 * DAY),
    A('3 pages: no flash on two pages, none missing (144)', new Set(all).size === all.length && all.length === 144, { total: all.length, unique: new Set(all).size }),
    A('NEXT returns to page 1 exactly', n1.w.s === w1.w.s && n1.w.e === w1.w.e, n1.w), A('NEXT again returns to latest', n0.w.atLatest && n0.w.e === now, n0.w),
    A('page label says end exclusive', /end exclusive/.test(w1.caps.window), w1.caps.window)];
});
T('T07', '7D PREV across year end; 30D PREV across Oct->Nov month end', async c => {
  const now = P('2027-01-03T12:00:00Z'); await setup(c, now, FULL('2026-09-01T00:00:00Z', '2027-01-03T12:00:00Z'));
  const a0 = await period(c, '7d'); const a1 = await nav(c, 'prev');
  const now2 = P('2026-12-01T06:00:00Z'); await setup(c, now2, FULL('2026-09-01T00:00:00Z', '2026-12-01T06:00:00Z'));
  const b0 = await period(c, '30d'); const b1 = await nav(c, 'prev');
  return [...winAsserts(a0, now - 7 * DAY, now), ...winAsserts(a1, now - 14 * DAY, now - 7 * DAY), A('7D pages disjoint', !a0.ids.some(i => a1.ids.includes(i)), null),
    ...winAsserts(b0, now2 - 30 * DAY, now2), ...winAsserts(b1, now2 - 60 * DAY, now2 - 30 * DAY), A('30D pages disjoint', !b0.ids.some(i => b1.ids.includes(i)), null)];
});
T('T08', '3M/12M (calendar-month) PREV then NEXT returns to the same window', async c => {
  const out = [];
  const now = P('2027-01-01T00:30:00Z'); await setup(c, now, { ...FULL('2026-09-25T00:00:00Z', '2027-01-01T00:30:00Z'), cutoff: '2026-01-01' });
  const m0 = await period(c, '3m'); const m1 = await nav(c, 'prev'); const m2 = await nav(c, 'next');
  out.push(...winAsserts(m0, P('2026-10-01T00:30:00Z'), now, { exactCount: false }), ...winAsserts(m1, P('2026-07-01T00:30:00Z'), P('2026-10-01T00:30:00Z'), { exactCount: false }),
    A('3M NEXT from 1 Jul page returns to latest', m2.w.atLatest && m2.w.s === m0.w.s, { s: iso(m2.w.s), e: iso(m2.w.e) }));
  const nowL = P('2028-03-01T12:00:00Z'); await setup(c, nowL, { gen: nowL - 30 * MIN, cutoff: '2026-01-01', scan: [[P('2028-02-01T00:00:00Z'), nowL]] });
  const y0 = await period(c, '12m'); const y1 = await nav(c, 'prev'); const y2 = await nav(c, 'next');
  out.push(...winAsserts(y0, P('2027-03-01T12:00:00Z'), nowL, { exactCount: false }), ...winAsserts(y1, P('2026-03-01T12:00:00Z'), P('2027-03-01T12:00:00Z'), { exactCount: false }),
    A('12M NEXT returns to the latest window [2027-03-01 12:00, 2028-03-01 12:00) with no overlap', y2.w.s === y0.w.s && y2.w.e === y0.w.e, { s: iso(y2.w.s), e: iso(y2.w.e), caption: y2.caps.window }));
  const nowJ = P('2026-07-15T12:00:00Z'); await setup(c, nowJ, { gen: nowJ - 30 * MIN, cutoff: '2025-07-15', scan: [[P('2025-07-15T00:00:00Z'), nowJ]] });
  const j0 = await period(c, '3m'); const j1 = await nav(c, 'prev'); const j2 = await nav(c, 'next');
  out.push(A('3M PREV page = [2026-01-15 12:00, 2026-04-15 12:00)', j1.w.s === P('2026-01-15T12:00:00Z') && j1.w.e === P('2026-04-15T12:00:00Z'), { s: iso(j1.w.s), e: iso(j1.w.e) }),
    A('3M NEXT returns to [2026-04-15 12:00, 2026-07-15 12:00) (latest), no overlap with PREV page', j2.w.s === j0.w.s && j2.w.e === j0.w.e, { s: iso(j2.w.s), e: iso(j2.w.e), caption: j2.caps.window }));
  return out;
});
// ---------------------------------------------------------------- leap day
T('T09', 'Leap day 2028-02-29 in CUSTOM and 24H', async c => {
  const now = P('2028-03-05T12:00:00Z'); await setup(c, now, { gen: now - 30 * MIN, cutoff: '2027-03-05', scan: [[P('2028-02-01T00:00:00Z'), now]] });
  const a = await custom(c, '2028-02-28', '2028-02-29'); const b = await custom(c, '2028-02-29', '2028-02-29'); const d = await custom(c, '2028-02-29', '2028-03-01');
  const n2 = P('2028-03-01T00:00:00Z'); await setup(c, n2, { gen: n2 - 30 * MIN, cutoff: '2027-03-05', scan: [[P('2028-02-01T00:00:00Z'), n2]] }); const e = await period(c, '24h');
  return [...winAsserts(a, P('2028-02-28T00:00:00Z'), P('2028-03-01T00:00:00Z')), A('28+29 Feb = 96', a.ids.length === 96, a.ids.length),
    ...winAsserts(b, P('2028-02-29T00:00:00Z'), P('2028-03-01T00:00:00Z')), A('29 Feb = 48 (24 hourly parts)', b.ids.length === 48, b.ids.length), A('caption "2028-02-29 to 2028-02-29 inclusive"', b.caps.window.includes('UTC dates 2028-02-29 to 2028-02-29 inclusive'), b.caps.window),
    ...winAsserts(d, P('2028-02-29T00:00:00Z'), P('2028-03-02T00:00:00Z')), A('29 Feb + 1 Mar = 96', d.ids.length === 96, d.ids.length),
    ...winAsserts(e, P('2028-02-29T00:00:00Z'), n2), A('24H at 2028-03-01 00:00 = 29 Feb only (48)', e.ids.length === 48, e.ids.length)];
});
// ---------------------------------------------------------------- staleness
T('T10', '4 h staleness threshold (index)', async c => {
  const gen = P('2026-10-26T18:00:00Z'), out = [];
  const ix = (extra = {}) => ({ gen, cutoff: '2025-10-01', scan: [[P('2026-10-20T00:00:00Z'), gen]], ...extra });
  for (const [dt, want, opts, tag] of [[4 * H - MIN, false, {}, '3h59min'], [4 * H, false, {}, 'exactly 4h'], [4 * H + 1000, true, {}, '4h+1s'], [5 * H, true, {}, '5h'],
    [3 * H + 1000, true, { nextDue: gen + 3 * H }, 'next_update_due gen+3h passed by 1s'], [3 * H, false, { nextDue: gen + 3 * H }, 'exactly next_update_due']]) {
    const v = await setup(c, gen + dt, ix(opts)); const st = /STALE/.test(v.caps.refresh), lb = /STALE/.test(v.label);
    out.push(A(`${tag}: STALE=${want} in refresh line and label`, st === want && lb === want && (v.last && v.last.stale) === want, { refresh: v.caps.refresh, label: v.label }),
      A(`${tag}: refresh line shows ${Tm(gen)} and correct age`, v.caps.refresh.includes(`Refresh archive ${Tm(gen)} (${Math.floor(Math.round(dt / MIN) / 60)}h ${Math.round(dt / MIN) % 60}min ago`), v.caps.refresh),
      A(`${tag}: UTC only`, utcOnly(v).length === 0, utcOnly(v)));
  }
  return out;
});
T('T11', 'Staleness in live-feed fallback (index 404)', async c => {
  const now = P('2026-10-26T23:40:00Z'), out = [];
  const feed = qe => ({ type: 'FeatureCollection', metadata: { synthetic: 'SYNTHETIC', ...(qe ? { query_start_utc: iso(qe - 3 * H), query_end_utc: iso(qe), latest_detection_utc: iso(qe - H) } : {}) }, features: [] });
  for (const [qe, want, tag] of [[now - 4 * H + MIN, false, 'feed 3h59min old'], [now - 4 * H - MIN, true, 'feed 4h01min old'], [null, true, 'feed metadata without query_end_utc (age unknown)']]) {
    const v = await setup(c, now, null, feed(qe));
    out.push(A(`${tag}: STALE=${want}`, /STALE/.test(v.label) === want, { label: v.label, refresh: v.caps.refresh }), A(`${tag}: UTC only`, utcOnly(v).length === 0, utcOnly(v)));
  }
  return out;
});
// ---------------------------------------------------------------- not yet ingested arithmetic
T('T12', '"Not yet ingested: last Xh Ymin" arithmetic', async c => {
  const now = P('2026-10-26T23:40:00Z'), out = [];
  for (const [last, txt, tag] of [[P('2026-10-26T21:23:00Z'), '2h 17min', 'scan ends 21:23:00'], [P('2026-10-26T22:40:30Z'), '0h 59min', 'scan ends 59 min 30 s before now'],
    [P('2026-10-25T17:40:00Z'), '24h 0min', 'scan ended before the window (whole 24 h)'], [P('2026-10-26T23:39:00Z'), '0h 1min', '1 min'], [now, null, 'scan ends at now (no warning)']]) {
    const v = await setup(c, now, { gen: Math.min(last, now) - 10 * MIN, cutoff: '2025-10-01', scan: [[P('2026-10-01T00:00:00Z'), last]] }); const v2 = await period(c, '24h');
    const ny = now - Math.max(now - DAY, last), cov = (Math.max(0, last - (now - DAY))) / DAY;
    out.push(A(`${tag}: ${txt ? `"Not yet ingested: last ${txt} of window"` : 'no not-yet-ingested warning'}`, txt ? v2.caps.warning.includes(`Not yet ingested: last ${txt} of window`) : !/Not yet ingested/.test(v2.caps.warning), v2.caps.warning),
      A(`${tag}: searched % + not-ingested = 100% of window (no hour lost/double counted)`, Math.abs(v2.cov + v2.ny / DAY - 1) < 1e-9 && v2.ny === ny, { cov: v2.cov, ny: v2.ny, expectNy: ny }),
      A(`${tag}: searched line ${Math.round(cov * 100)}%`, cov > 0 ? v2.caps.searched.includes(`Searched EUMETSAT ${Math.round(cov * 100)}% of window`) : /0%/.test(v2.caps.searched), v2.caps.searched),
      A(`${tag}: UTC only`, utcOnly(v2).length === 0, utcOnly(v2)));
  }
  return out;
});
// ---------------------------------------------------------------- robustness: zone-less timestamps (malformed on purpose)
T('T13', 'Zone-less time_utc (malformed, no Z) must not shift with the browser timezone', async c => {
  const now = P('2026-10-28T12:00:00Z'); await setup(c, now, { gen: now - 30 * MIN, cutoff: '2025-10-01', scan: [[P('2026-09-01T00:00:00Z'), now]] });
  const v = await custom(c, '2026-09-20', '2026-09-20');
  return [A('2026-09-20 day file: all 48 records either kept as UTC or rejected identically in every timezone', v.ids.length === 48 || (v.ids.length === 0 && /malformed/.test(v.caps.flashes)), { drawn: v.ids.length, actual: v.caps.actual, flashes: v.caps.flashes })];
});

// ---------------------------------------------------------------- run
for (const tz of TZS) {
  const c = await boot(tz); console.log(`== ${tz} composition`, JSON.stringify(c.composition));
  for (const k of CASES) {
    if (ONLY.length && !ONLY.includes(k.id)) continue;
    let asserts; try { asserts = await k.fn(c); } catch (e) { asserts = [A('ERROR ' + String(e.message || e).split('\n')[0].slice(0, 300), false, null)]; }
    const res = asserts.every(a => a.ok) ? 'PASS' : 'FAIL';
    RUN.results.push({ tz, id: k.id, title: k.title, result: res, asserts, pageErrors: [...c.errors] });
    console.log(`${tz.padEnd(16)} ${k.id} ${res}  ${k.title}`); for (const a of asserts) if (!a.ok) console.log(`     x ${a.what} :: ${JSON.stringify(a.observed).slice(0, 360)}`);
  }
  RUN[`shim-${tz}`] = c.shim.summary(); await c.ctx.close();
}
await browser.close();
RUN.finishedAt = new Date().toISOString();
await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 1));
console.log('results:', join(OUT, 'results.json'));
process.exit(RUN.results.every(r => r.result === 'PASS') ? 0 : 1);
