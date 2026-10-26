#!/usr/bin/env node
// matrix.mjs — negative matrix runner for candidate 202610261949 (SHA fda6b10f), agent negative-matrix-D.
//   node matrix.mjs [--only N01,N05] [--list]
// Every case boots the candidate route under the lead shim with lightningDataDir switched per case, drives the REAL
// controls (locator.click, fill, keyboard — no force, no synthetic dispatch), and records the rendered caption text,
// state line, label, map source feature count/cluster flag, toggle states, requests (with timing), page/map errors
// and whether any ORIGINAL control changed (diff against the same boot's OFF snapshot).
// Results: results/<id>.json, shots/<id>*.png, results/matrix-*.json.
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import * as L from './lib.mjs';
const { DAY, HOUR, iso, ymd, ds, dayPath, partPath, feat, spread, shard, row, index, writeFixture, realDir, readJSON, copyReal, snap, origDiff, clickToggle, clickChip, clickNav, applyCustom, settle, shot, sleep, concurrency, AR, FEED, ACAO, SYN } = L;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const ONLY = arg('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const CLOCK = '2026-10-26T18:40:00Z';            // 3 min after the builder fixtures' generated_utc (2026-10-26T18:37:03Z)
const T = Date.parse(CLOCK);
const REAL_FEED = readJSON(path.join(realDir('lightning-archive'), 'uk_lightning.geojson'));
const REAL_INDEX = readJSON(path.join(realDir('lightning-archive'), 'history', 'index.json'));
const INJ = '<img src=x onerror="window.__INJECTED=1">';
const emptyFeed = (meta = {}) => ({ ...REAL_FEED, features: [], metadata: { ...REAL_FEED.metadata, total_before_display_cap: 0, latest_detection_utc: null, fixture_note: SYN, ...meta } });
const fileOf = (dir, url) => path.join(dir, url.replace(/^.*\/data\//, ''));
const serveFile = (r, dir) => { const f = fileOf(dir, r.request().url()); if (!fs.existsSync(f)) return r.fulfill({ status: 404, headers: ACAO, body: 'nf' }); return r.fulfill({ status: 200, headers: { 'content-type': 'application/json', ...ACAO }, body: fs.readFileSync(f) }); };
// delayed shard route with an EXACT in-flight counter (incremented when the browser's request reaches the handler, decremented when the body is handed back)
const delayRoute = async (page, re, ms, dir) => { const st = { inFlight: 0, max: 0, count: 0, log: [] }; const t0 = Date.now(); await page.route(re, async r => { st.inFlight++; st.count++; st.max = Math.max(st.max, st.inFlight); const u = r.request().url().replace(/^.*\/days\//, ''); st.log.push({ u, s: Date.now() - t0, inFlightAtStart: st.inFlight }); await sleep(typeof ms === 'function' ? ms(r.request().url()) : ms); st.inFlight--; return serveFile(r, dir); }); return st; };
const shardReqs = B => B.rec.requests.filter(r => /days\//.test(r.url)).map(r => r.url.replace('AR/', ''));
const idxReqs = B => B.rec.requests.filter(r => /index\.json/.test(r.url)).length;
const feedReqs = B => B.rec.requests.filter(r => r.url === 'FEED').length;
const fps = page => page.evaluate(() => new Promise(res => { let n = 0; const s = performance.now(); const tick = () => { n++; if (performance.now() - s < 1000) requestAnimationFrame(tick); else res(n); }; requestAnimationFrame(tick); }));
/** synthetic multi-day archive: nDays ending at endDate inclusive, perDay points each, full coverage. */
function archive(name, { endDate, nDays, perDay = 3, cutoff = '2025-10-26', generated, scanEnd, sealedUntil, interval = 1, extraRows = [], extraIndex = {}, feed }) {
  const files = {}; const days = []; const end = ds(endDate);
  for (let i = nDays - 1; i >= 0; i--) { const d = ymd(end - i * DAY); const fs_ = spread(perDay, ds(d), ds(d) + DAY, 7 + i); const sh = shard(d, fs_); const body = JSON.stringify(sh); files['history/' + dayPath(d)] = body; days.push(row(d, { count: perDay, bytes: body.length, sealed: sealedUntil ? d <= sealedUntil : true, first: sh.metadata.first_observation_utc, last: sh.metadata.last_observation_utc, scanned_seconds: 86400 })); }
  const sw = [{ start_utc: iso(end - (nDays - 1) * DAY), end_utc: iso(scanEnd ?? (end + DAY)), successful_runs: nDays * 24 }];
  files['history/index.json'] = index({ generated, cutoff, days: days.concat(extraRows), scan_windows: sw, interval, extra: extraIndex });
  files['uk_lightning.geojson'] = feed || emptyFeed();
  return { dir: writeFixture(name, files), days, files };
}

const CASES = [];
const C = (id, title, ids, opts, run) => CASES.push({ id, title, ids, opts, run });

/* ============================== cases ===================================================== */
C('N01', 'zero valid events after a COMPLETE scan (archive via PREV; feed via PREV)', ['D07', 'D14', 'D03'], { clock: CLOCK }, async (B, out) => {
  const files = {}; const days = []; for (let i = 7; i >= 0; i--) { const d = ymd(T - i * DAY); days.push(row(d, { count: 0, scanned_seconds: 86400, coverage: 'full', path: null, sealed: i > 0 })); }
  files['history/index.json'] = index({ generated: T - 3 * 60000, cutoff: '2025-10-26', days, scan_windows: [{ start_utc: iso(T - 7 * DAY - HOUR), end_utc: iso(T - 2 * HOUR), successful_runs: 170 }] });
  files['uk_lightning.geojson'] = emptyFeed({ query_start_utc: iso(T - 7 * DAY), query_end_utc: iso(T - 2 * HOUR) });
  await B.restart(writeFixture('N01-zero-complete', files), async (B) => {
    await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h latest (tail not scanned → PARTIAL expected)');
    await clickNav(B.page, 'prev'); await settle(B.page); await B.step('PREV: window fully inside the scan window, all days count 0 → EMPTY-COVERED expected');
    await shot(B.page, 'N01-prev-empty-covered');
  });
  const f2 = { ...files }; delete f2['history/index.json'];
  await B.restart(writeFixture('N01-zero-complete-feed', f2), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page); await B.step('FEED ON 24h latest'); await clickNav(B.page, 'prev'); await settle(B.page); await B.step('FEED PREV (inside the feed query window, 0 features)'); await shot(B.page, 'N01-feed-prev'); });
});

C('N02', 'none under a PARTIAL scan (genuine archive, 24h and 12h at latest)', ['D07', 'D14'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h');
  await clickChip(B.page, '12h'); await settle(B.page); await B.step('12h'); await shot(B.page, 'N02-partial-none');
});

C('N03', 'no index (XHR feed fallback) and the feed itself empty; variant without a query window in the feed metadata', ['D06', 'D07', 'D14', 'D16'], { clock: CLOCK }, async (B) => {
  await B.restart(writeFixture('N03-noindex-emptyfeed', { 'uk_lightning.geojson': emptyFeed() }), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h (feed empty, query window 10:05→13:05)', { idx: idxReqs(B), feed: feedReqs(B) }); await shot(B.page, 'N03-noindex-emptyfeed'); });
  const m = emptyFeed(); delete m.metadata.query_start_utc; delete m.metadata.query_end_utc;
  await B.restart(writeFixture('N03b-noindex-emptyfeed-noquery', { 'uk_lightning.geojson': m }), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h (feed empty, NO query window → 0% searched expected)'); await shot(B.page, 'N03b-noindex-noquery'); });
});

C('N04', 'broken index JSON (HTML error page) → feed fallback; reason as text not markup; long chips disabled; v1 index refused (R02)', ['D06', 'D15', 'R02'], { clock: CLOCK, fixture: realDir('lightning-archive-broken-json') }, async (B) => {
  await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h');
  await clickChip(B.page, '7d'); await settle(B.page); await B.step('7d (feed, 408 expected)', { chip30dDisabled: await B.page.locator('#scada-ui-container [data-lightning-period="30d"]').isDisabled() });
  await shot(B.page, 'N04-broken-index');
  const v1 = { ...REAL_INDEX, schema: 'uk-lightning-history-index.v1', fixture_note: SYN };
  await B.restart(copyReal('N04b-index-v1', 'lightning-archive', { 'history/index.json': JSON.stringify(v1) }), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h with a v1 index (R02)'); await shot(B.page, 'N04b-index-v1'); });
});

C('N05', '404 shard (genuine missing-shard fixture, 7d), LATEST retry, then HTTP 500 for the same shard', ['D15', 'D10', 'R03'], { clock: CLOCK, fixture: realDir('lightning-archive-missing-shard') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d (23.json → 404)'); await shot(B.page, 'N05-404-shard');
  await B.step('LATEST button state while FAIL at latest', { latestDisabled: await B.page.locator('#scada-ui-container [data-lightning-nav="latest"]').isDisabled(), prevDisabled: await B.page.locator('#scada-ui-container [data-lightning-nav="prev"]').isDisabled() });
  await clickChip(B.page, '7d'); await settle(B.page); await B.step('re-click 7d chip = retry (still 404)', { shardRequests: shardReqs(B) });
  await B.page.route(/days\/2026\/10\/23\.json$/, r => r.fulfill({ status: 500, headers: ACAO, body: 'server error' }));
  await clickChip(B.page, '7d'); await settle(B.page); await B.step('re-click 7d with 23.json → HTTP 500', { shardRequests: shardReqs(B) });
  await B.page.unroute(/days\/2026\/10\/23\.json$/); await B.page.route(/days\/2026\/10\/23\.json$/, r => serveFile(r, realDir('lightning-archive')));
  await clickChip(B.page, '7d'); await settle(B.page); await B.step('re-click 7d with 23.json restored → recovery expected (408)', { shardRequests: shardReqs(B) });
});

C('N06', 'malformed shard family (synthetic 25.json): HTML body, wrong schema, out-of-box coords, NaN/invalid coords, 10 MB string property, HTML in properties', ['D02', 'D12', 'D15'], { clock: '2026-10-26T06:00:00Z' }, async (B, out) => {
  const T6 = Date.parse('2026-10-26T06:00:00Z');
  const idx = JSON.parse(JSON.stringify(REAL_INDEX)); idx.generated_utc = iso(T6 - 10 * 60000); idx.next_update_due_utc = iso(T6 + 3 * HOUR); idx.fixture_note = SYN;
  const variants = {
    'a-html-body': '<!doctype html><html><body><h1>503 Service Unavailable</h1></body></html>',
    'b-wrong-schema': shard('2026-10-25', spread(3, ds('2026-10-25'), ds('2026-10-25') + DAY, 3), { top: { schema: 'uk-lightning-history-day.v0' } }),
    'c-out-of-box': shard('2026-10-25', [feat('oob1', '2026-10-25T10:00:00Z', 10.0, 40.0), feat('oob2', '2026-10-25T11:00:00Z', -20.0, 70.0), feat('oob3', '2026-10-25T12:00:00Z', 2.9, 61.4), feat('oob4', '2026-10-25T13:00:00Z', 179.9, -89.9)]),
    'd-nan-coords': JSON.stringify(shard('2026-10-25', [feat('n1', '2026-10-25T10:00:00Z', null, 55), feat('n2', '2026-10-25T11:00:00Z', 'NaN', 'x'), feat('n3', '2026-10-25T12:00:00Z', -4, 55), { type: 'Feature', id: 'n4', geometry: { type: 'Point', coordinates: [] }, properties: feat('x', '2026-10-25T13:00:00Z', 0, 0).properties }, { type: 'Feature', id: 'n5', geometry: { type: 'Point' }, properties: feat('x', '2026-10-25T14:00:00Z', 0, 0).properties }])).replace('"coordinates":[-4,55]', '"coordinates":[1e999,55]'),
    'e-10mb-string': shard('2026-10-25', [feat('big', '2026-10-25T10:00:00Z', -3, 54, { name: 'X'.repeat(10 * 1024 * 1024) }), feat('ok', '2026-10-25T11:00:00Z', -3.1, 54.1)]),
    'f-html-props': shard('2026-10-25', [feat('h1', '2026-10-25T10:00:00Z', -3, 54, { name: INJ, raw_tech: INJ, status: '<script>window.__INJECTED=2</script>' })], { metadata: { source: INJ, observation: INJ } })
  };
  for (const [k, body] of Object.entries(variants)) {
    const idx2 = JSON.parse(JSON.stringify(idx)); const r25 = idx2.days.find(d => d.date === '2026-10-25'); const b = typeof body === 'string' ? body : JSON.stringify(body); r25.bytes = b.length; r25.count = typeof body === 'string' ? 3 : body.features.length; r25.sealed = false;
    await B.restart(copyReal('N06-' + k, 'lightning-archive', { 'history/index.json': JSON.stringify(idx2), 'history/days/2026/10/25.json': b }), async (B) => {
      const t0 = Date.now(); await clickToggle(B.page, B.phone); await clickChip(B.page, '48h'); await settle(B.page, 90000);
      await B.step(k + ' (48h: 24.json genuine 118 + hostile 25.json)', { ms: Date.now() - t0, hostileShardFeatures: typeof body === 'string' ? null : body.features.length }); await shot(B.page, 'N06-' + k);
    });
  }
});

C('N07', 'stale index (genuine stale fixture: generated 9 h before build) at 7d', ['D13', 'D14', 'D03'], { clock: CLOCK, fixture: realDir('lightning-archive-stale') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d'); await shot(B.page, 'N07-stale');
});

C('N08', '100k counted day: index-only budget refusal (no shard request), then LOAD POINTS fan-out over 24 hourly parts (stress)', ['D11', 'D12', 'D08', 'R10'], { clock: '2026-10-26T06:00:00Z' }, async (B, out) => {
  const T6 = Date.parse('2026-10-26T06:00:00Z'); const d = '2026-10-25'; const files = {}; const parts = []; let total = 0;
  for (let h = 0; h < 24; h++) { const n = h === 23 ? 100000 - 23 * 4166 : 4166; const fs_ = spread(n, ds(d) + h * HOUR, ds(d) + (h + 1) * HOUR, 100 + h); const body = JSON.stringify(shard(d, fs_)); files['history/' + partPath(d, h)] = body; parts.push({ hour: h, path: partPath(d, h), bytes: body.length, count: n, sha256: null }); total += n; }
  out.totalSynthetic = total; out.partBytes = parts.reduce((n, p) => n + p.bytes, 0);
  const days = [row('2026-10-24', { count: 0, scanned_seconds: 86400, path: null }), row(d, { count: total, scanned_seconds: 86400, path: null, parts, sealed: true, first: iso(ds(d)), last: iso(ds(d) + DAY - 1), bytes: out.partBytes }), row('2026-10-26', { count: 0, scanned_seconds: 21600, path: null, sealed: false })];
  files['history/index.json'] = index({ generated: T6 - 5 * 60000, cutoff: '2025-10-26', days, scan_windows: [{ start_utc: iso(ds('2026-10-24')), end_utc: iso(T6 - HOUR), successful_runs: 53 }] });
  files['uk_lightning.geojson'] = emptyFeed();
  await B.restart(writeFixture('N08-100k-parts', files), async (B) => {
    await clickToggle(B.page, B.phone); await clickChip(B.page, '48h'); await settle(B.page); await B.step('ON 48h (index-only overview, LOAD POINTS offered)', { shardRequests: shardReqs(B).length }); await shot(B.page, 'N08-100k-overview');
    const t0 = Date.now(); await clickNav(B.page, 'points'); await settle(B.page, 240000);
    await B.step('LOAD POINTS (24 parts, 100,000 synthetic points)', { ms: Date.now() - t0, partRequests: shardReqs(B).length, concurrency: concurrency(B.rec.requests, /days\//), fps: await fps(B.page) }); await shot(B.page, 'N08-100k-points');
    await clickChip(B.page, '12h'); await settle(B.page, 120000); await B.step('12h (only parts 18–23 overlap)', { partRequestsTotal: shardReqs(B).length, newRequests: shardReqs(B).slice(24) });
  });
});

C('N09', 'split hourly parts[] day: 12h window at 20:00 must fetch exactly the 12 overlapping parts (08–19); then 24h adds 00–07', ['D08', 'D10', 'R10'], { clock: '2026-10-25T20:00:00Z' }, async (B) => {
  const T20 = Date.parse('2026-10-25T20:00:00Z'); const d = '2026-10-25'; const files = {}; const parts = []; let total = 0;
  for (let h = 0; h < 24; h++) { const fs_ = spread(5, ds(d) + h * HOUR, ds(d) + (h + 1) * HOUR, 300 + h); const body = JSON.stringify(shard(d, fs_)); files['history/' + partPath(d, h)] = body; parts.push({ hour: h, path: partPath(d, h), bytes: body.length, count: 5, sha256: null }); total += 5; }
  files['history/index.json'] = index({ generated: T20 - 2 * 60000, cutoff: '2025-10-26', days: [row('2026-10-24', { count: 0, scanned_seconds: 86400, path: null }), row(d, { count: total, scanned_seconds: 72000, path: null, parts, sealed: false, first: iso(ds(d)), last: iso(T20 - HOUR), coverage: 'partial' })], scan_windows: [{ start_utc: iso(ds('2026-10-24')), end_utc: iso(T20 - HOUR), successful_runs: 43 }] });
  files['uk_lightning.geojson'] = emptyFeed();
  await B.restart(writeFixture('N09-parts', files), async (B) => {
    await clickToggle(B.page, B.phone); await clickChip(B.page, '12h'); await settle(B.page);
    const got = shardReqs(B).slice().sort(); const want = Array.from({ length: 12 }, (_, i) => partPath(d, 8 + i)).sort();
    await B.step('ON 12h', { partRequests: got, expected: want, exact: JSON.stringify(got) === JSON.stringify(want), concurrency: concurrency(B.rec.requests, /days\//) }); await shot(B.page, 'N09-parts');
    await clickChip(B.page, '24h'); await settle(B.page); await B.step('24h (parts 00–07 added; 08–19 from LRU, which holds 8)', { partRequestsTotal: shardReqs(B).length, newRequests: shardReqs(B).slice(12) });
  });
});

C('N10', 'count mismatch between index and shard (index says 3 for 25 Oct, shard truncated to 2 genuine flashes; sha256 field unchanged)', ['D08', 'D13'], { clock: '2026-10-26T06:00:00Z' }, async (B) => {
  const T6 = Date.parse('2026-10-26T06:00:00Z'); const idx = JSON.parse(JSON.stringify(REAL_INDEX)); idx.generated_utc = iso(T6 - 10 * 60000); idx.next_update_due_utc = iso(T6 + 3 * HOUR); idx.fixture_note = SYN + ' (index untouched except timestamps; shard 25.json truncated to 2 features)';
  const sh = readJSON(path.join(realDir('lightning-archive'), 'history/days/2026/10/25.json')); sh.features = sh.features.slice(0, 2); sh.metadata.fixture_note = SYN;
  await B.restart(copyReal('N10-count-mismatch', 'lightning-archive', { 'history/index.json': JSON.stringify(idx), 'history/days/2026/10/25.json': JSON.stringify(sh) }), async (B) => { await clickToggle(B.page, B.phone); await clickChip(B.page, '48h'); await settle(B.page); await B.step('ON 48h (index 118+3=121, shards 118+2=120)'); await shot(B.page, 'N10-count-mismatch'); });
});


C('N11', 'four simultaneous shard fetches: route-level in-flight counter; clean per-load fan-out (6 shards) and ON→7d→30d overlap (superseded loads not cancelled; LRU-8 evicts mid-load)', ['D10'], { clock: CLOCK }, async (B) => {
  const a = archive('N11-concurrency', { endDate: '2026-10-26', nDays: 8, perDay: 3, generated: T - 3 * 60000, scanEnd: T - HOUR });
  await B.restart(a.dir, async (B) => {
    const st = await delayRoute(B.page, /\/history\/days\//, 1500, a.dir);
    await clickToggle(B.page, B.phone); await settle(B.page, 60000); await B.step('ON 24h settled first (2 shards)', { routeStats: { max: st.max, count: st.count } });
    st.max = 0; const c0 = st.count; await clickChip(B.page, '30d'); await settle(B.page, 60000);
    await B.step('then 30d: 6 new shards (19–24; 25/26 from LRU), 1.5 s each → max in flight at the route = ?', { routeStats: { maxInFlight: st.max, requests: st.count - c0, log: st.log.slice(2) } }); await shot(B.page, 'N11-concurrency');
  });
  const b = archive('N11b-concurrency-12', { endDate: '2026-10-26', nDays: 12, perDay: 3, generated: T - 3 * 60000, scanEnd: T - HOUR });
  await B.restart(b.dir, async (B) => {
    const st = await delayRoute(B.page, /\/history\/days\//, 1500, b.dir);
    await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await B.page.waitForTimeout(200); await clickChip(B.page, '30d'); await settle(B.page, 60000);
    const dup = Object.entries(st.log.reduce((m, x) => (m[x.u] = (m[x.u] || 0) + 1, m), {})).filter(([, n]) => n > 1);
    await B.step('ON→7d→30d within 0.2 s: global in-flight at the route, and duplicate fetches of the same shard inside one load', { routeStats: { maxInFlight: st.max, requests: st.count, distinct: new Set(st.log.map(x => x.u)).size, duplicates: dup, log: st.log } });
  });
  await B.restart(b.dir, async (B) => {
    const st = await delayRoute(B.page, /\/history\/days\//, 800, b.dir);
    await clickToggle(B.page, B.phone); await settle(B.page, 60000); st.log.length = 0; st.count = 0; st.max = 0; await clickChip(B.page, '30d'); await settle(B.page, 60000);
    const dup = Object.entries(st.log.reduce((m, x) => (m[x.u] = (m[x.u] || 0) + 1, m), {})).filter(([, n]) => n > 1);
    await B.step('clean 30d over 12 days (10 new shards; LRU holds 8): duplicates within ONE load?', { routeStats: { maxInFlight: st.max, requests: st.count, distinct: new Set(st.log.map(x => x.u)).size, duplicates: dup, log: st.log } });
  });
});

C('N12', '>40k cap on desktop (45,000 synthetic points one day → LOAD POINTS → clusters) and the 10k phone cap (12,000) vs desktop (12,000 → points)', ['D11', 'D12'], { clock: '2026-10-26T06:00:00Z' }, async (B, out) => {
  const T6 = Date.parse('2026-10-26T06:00:00Z'); const mk = (name, n) => { const d = '2026-10-25'; const fs_ = spread(n, ds(d), ds(d) + DAY, 500); const sh = shard(d, fs_); const body = JSON.stringify(sh); const files = { ['history/' + dayPath(d)]: body, 'uk_lightning.geojson': emptyFeed() }; files['history/index.json'] = index({ generated: T6 - 5 * 60000, cutoff: '2025-10-26', days: [row('2026-10-24', { count: 0, scanned_seconds: 86400, path: null }), row(d, { count: n, bytes: body.length, sealed: true, first: sh.metadata.first_observation_utc, last: sh.metadata.last_observation_utc, scanned_seconds: 86400 }), row('2026-10-26', { count: 0, scanned_seconds: 21600, path: null, sealed: false })], scan_windows: [{ start_utc: iso(ds('2026-10-24')), end_utc: iso(T6 - HOUR), successful_runs: 53 }] }); return { dir: writeFixture(name, files), bytes: body.length }; };
  const big = mk('N12-45k', 45000), mid = mk('N12-12k', 12000); out.bytes = { big: big.bytes, mid: mid.bytes };
  await B.restart(big.dir, async (B) => {
    await clickToggle(B.page, B.phone); await applyCustom(B.page, '2026-10-25', '2026-10-25'); await settle(B.page, 60000); await B.step('desktop custom 25 Oct, 45k → overview + LOAD POINTS expected', { shardRequests: shardReqs(B).length });
    const t0 = Date.now(); await clickNav(B.page, 'points'); await settle(B.page, 180000); const tiles = await L.waitTiles(B.page); await B.step('desktop LOAD POINTS → 45,000 as clusters expected', { ms: Date.now() - t0, tiles, fps: await fps(B.page) }); await shot(B.page, 'N12-45k-desktop-clusters');
  });
  await B.restart(mid.dir, async (B) => { await clickToggle(B.page, B.phone); await applyCustom(B.page, '2026-10-25', '2026-10-25'); await settle(B.page, 120000); const tiles = await L.waitTiles(B.page); await B.step('desktop custom 25 Oct, 12k → points expected (within 40k)', { tiles }); await shot(B.page, 'N12-12k-desktop-points'); });
  const g = async (B) => { await clickToggle(B.page, true); await applyCustom(B.page, '2026-10-25', '2026-10-25'); await settle(B.page, 120000); const tiles = await L.waitTiles(B.page); await B.step('PHONE 390x844 custom 25 Oct, 12k → clusters expected (exceeds 10k)', { tiles, fps: await fps(B.page), ph: await B.page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, w: innerWidth })) }); await shot(B.page, 'N12-12k-phone-clusters'); };
  g.opts = { phone: true, viewport: { width: 390, height: 844 } }; await B.restart(mid.dir, g);
});

C('N13', 'retention cutoff: 12m at latest (start == cutoff), PREV beyond cutoff → BEFORE-ARCHIVE; custom before archive; custom straddling → clamped; index with a 2-year cutoff', ['D05', 'D09', 'D14'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '12m'); await settle(B.page); await B.step('12m latest (window start 2025-10-26 = cutoff)', { prevDisabled: await B.page.locator('#scada-ui-container [data-lightning-nav="prev"]').isDisabled() });
  await clickNav(B.page, 'prev'); await settle(B.page); await B.step('PREV from 12m (entirely before the cutoff)', { prevDisabled: await B.page.locator('#scada-ui-container [data-lightning-nav="prev"]').isDisabled() }); await shot(B.page, 'N13-before-archive');
  await clickNav(B.page, 'latest'); await settle(B.page);
  await applyCustom(B.page, '2025-06-01', '2025-06-30'); await settle(B.page); await B.step('custom 2025-06-01..30 (before the archive)');
  await applyCustom(B.page, '2025-10-01', '2025-11-05'); await settle(B.page); await B.step('custom 2025-10-01..2025-11-05 (straddles the cutoff → clamped)');
  await applyCustom(B.page, '2026-10-20', '2026-10-20'); await settle(B.page); await B.step('custom 2026-10-20 (searched 5.4%, count 0, before coverage_start 22:41)');
  const idx = JSON.parse(JSON.stringify(REAL_INDEX)); idx.cutoff_date_utc = '2024-10-26'; idx.fixture_note = SYN + ' cutoff moved 2 years back';
  await B.restart(copyReal('N13b-cutoff-2y', 'lightning-archive', { 'history/index.json': JSON.stringify(idx) }), async (B) => { await clickToggle(B.page, B.phone); await clickChip(B.page, '12m'); await settle(B.page); await B.step('index cutoff 2024-10-26: 12m latest'); await clickNav(B.page, 'prev'); await settle(B.page); await B.step('PREV → 2024-10-26..2025-10-26 (client follows the index cutoff, not a hard-coded year)', { prevDisabled: await B.page.locator('#scada-ui-container [data-lightning-nav="prev"]').isDisabled(), dateMin: await B.page.locator('#scada-ui-container [data-lightning-date="from"]').getAttribute('min') }); });
});

C('N14', 'UTC midnight boundary + [start,end) with a flash at exactly 00:00:00.000Z', ['D03', 'D09'], { clock: '2026-10-26T00:00:30Z' }, async (B) => {
  const idx = JSON.parse(JSON.stringify(REAL_INDEX)); const T0 = Date.parse('2026-10-26T00:00:30Z'); idx.generated_utc = iso(T0 - 60000); idx.next_update_due_utc = iso(T0 + 3 * HOUR); idx.fixture_note = SYN + ' + one synthetic flash at 2026-10-26T00:00:00.000Z';
  const sh26 = shard('2026-10-26', [feat('midnight', '2026-10-26T00:00:00.000Z', -2.5, 53.5)]); const r26 = idx.days.find(d => d.date === '2026-10-26'); Object.assign(r26, { count: 1, bytes: JSON.stringify(sh26).length, path: dayPath('2026-10-26'), first_observation_utc: '2026-10-26T00:00:00.000Z', last_observation_utc: '2026-10-26T00:00:00.000Z' });
  await B.restart(copyReal('N14-midnight', 'lightning-archive', { 'history/index.json': JSON.stringify(idx), 'history/days/2026/10/26.json': JSON.stringify(sh26) }), async (B) => {
    await clickToggle(B.page, B.phone); await settle(B.page); await B.step('24h at 00:00:30Z → [25 00:00:30, 26 00:00:30): 3 genuine (25th) + midnight flash = 4 expected');
    await applyCustom(B.page, '2026-10-25', '2026-10-25'); await settle(B.page); await B.step('custom 2026-10-25 → [25 00:00, 26 00:00): 3 expected (midnight flash excluded, end exclusive)');
    await applyCustom(B.page, '2026-10-26', '2026-10-26'); await settle(B.page); await B.step('custom 2026-10-26 → [26 00:00, now 00:00:30): 1 expected'); await shot(B.page, 'N14-midnight');
  });
});

C('N15', 'DST change date 2026-10-25 (UK BST→GMT at 01:00 UTC), timezone Europe/London: all captions UTC, 24h window spans exactly 24 h', ['D03', 'D09'], { clock: '2026-10-25T23:30:00Z', timezone: 'Europe/London' }, async (B) => {
  const idx = JSON.parse(JSON.stringify(REAL_INDEX)); const Tc = Date.parse('2026-10-25T23:30:00Z'); idx.generated_utc = iso(Tc - 60000); idx.next_update_due_utc = iso(Tc + 3 * HOUR); idx.fixture_note = SYN + ' timestamps only';
  await B.restart(copyReal('N15-dst', 'lightning-archive', { 'history/index.json': JSON.stringify(idx) }), async (B) => {
    await clickToggle(B.page, B.phone); await settle(B.page); const w = await B.page.evaluate(() => { const w = window.__GRIDATLAS_MODULES__.ukLightning.windowFor(Date.now()); return { s: new Date(w.s).toISOString(), e: new Date(w.e).toISOString(), spanH: w.span / 36e5, localNow: new Date().toString() }; });
    await B.step('24h at 2026-10-25T23:30Z (local 23:30 GMT; day started in BST): 3 flashes of the 25th expected', { window: w });
    await applyCustom(B.page, '2026-10-25', '2026-10-25'); await settle(B.page); const w2 = await B.page.evaluate(() => { const w = window.__GRIDATLAS_MODULES__.ukLightning.windowFor(Date.now()); return { s: new Date(w.s).toISOString(), e: new Date(w.e).toISOString(), spanH: w.span / 36e5 }; });
    await B.step('custom 2026-10-25 (the DST day) → 24 h UTC window, 3 expected', { window: w2 }); await shot(B.page, 'N15-dst');
  });
});

C('N16', 'leap day 2028-02-29, 31-day month end, 6m PREV drift, 12-month lookback across a leap year (synthetic archives)', ['D09', 'D05'], {}, async (B) => {
  const leap = archive('N16-leap', { endDate: '2028-02-29', nDays: 3, perDay: 2, cutoff: '2027-02-28', generated: Date.parse('2028-02-29T11:50:00Z'), scanEnd: Date.parse('2028-02-29T11:00:00Z') });
  const gl = async (B) => { const W = () => B.page.evaluate(() => { const w = window.__GRIDATLAS_MODULES__.ukLightning.windowFor(Date.now()); return { s: new Date(w.s).toISOString(), e: new Date(w.e).toISOString(), days: w.span / 864e5 }; });
    await clickToggle(B.page, B.phone); await settle(B.page); await B.step('leap: 24h at 2028-02-29T12:00Z', { window: await W() });
    await applyCustom(B.page, '2028-02-29', '2028-02-29'); await settle(B.page); await B.step('leap: custom 2028-02-29 (2 synthetic points expected)', { window: await W() });
    await clickChip(B.page, '12m'); await settle(B.page); await B.step('leap: 12m → start 2027-02-28T12:00Z (= cutoff day, 366 days)', { window: await W() });
    await clickChip(B.page, '30d'); await settle(B.page); await B.step('leap: 30d → 2028-01-30T12:00Z', { window: await W() }); await shot(B.page, 'N16-leap'); };
  gl.opts = { clock: '2028-02-29T12:00:00Z' }; await B.restart(leap.dir, gl);
  const aug = archive('N16-monthend', { endDate: '2026-08-31', nDays: 2, perDay: 2, cutoff: '2025-08-31', generated: Date.parse('2026-08-31T11:50:00Z'), scanEnd: Date.parse('2026-08-31T11:00:00Z') });
  const ga = async (B) => { const W = () => B.page.evaluate(() => { const w = window.__GRIDATLAS_MODULES__.ukLightning.windowFor(Date.now()); return { s: new Date(w.s).toISOString(), e: new Date(w.e).toISOString(), days: w.span / 864e5, clamped: w.clamped }; });
    await clickToggle(B.page, B.phone); await clickChip(B.page, '6m'); await settle(B.page); await B.step('month end: 6m from 2026-08-31T12:00Z → 2026-02-28T12:00Z expected', { window: await W() });
    await clickNav(B.page, 'prev'); await settle(B.page); await B.step('month end: PREV → end 2026-02-28, start 2025-08-28 → clamped to cutoff 2025-08-31 (drift from day 31 to 28)', { window: await W() });
    await clickNav(B.page, 'latest'); await settle(B.page); await clickChip(B.page, '3m'); await settle(B.page); await B.step('month end: 3m → 2026-05-31T12:00Z', { window: await W() }); };
  ga.opts = { clock: '2026-08-31T12:00:00Z' }; await B.restart(aug.dir, ga);
  const oct = archive('N16-oct31', { endDate: '2026-10-31', nDays: 2, perDay: 2, cutoff: '2025-10-31', generated: Date.parse('2026-10-31T23:50:00Z'), scanEnd: Date.parse('2026-10-31T23:00:00Z') });
  const go = async (B) => { const W = () => B.page.evaluate(() => { const w = window.__GRIDATLAS_MODULES__.ukLightning.windowFor(Date.now()); return { s: new Date(w.s).toISOString(), e: new Date(w.e).toISOString(), days: w.span / 864e5 }; });
    await clickToggle(B.page, B.phone); await settle(B.page); await B.step('31-day month end: 24h at 2026-10-31T23:59Z', { window: await W() });
    await clickChip(B.page, '30d'); await settle(B.page); await B.step('31-day month end: 30d → 2026-10-01T23:59Z', { window: await W() }); };
  go.opts = { clock: '2026-10-31T23:59:00Z' }; await B.restart(oct.dir, go);
  const ly = archive('N16-leapyear-12m', { endDate: '2029-02-28', nDays: 2, perDay: 1, cutoff: '2028-02-28', generated: Date.parse('2029-02-28T11:50:00Z'), scanEnd: Date.parse('2029-02-28T11:00:00Z') });
  const gy = async (B) => { const W = () => B.page.evaluate(() => { const w = window.__GRIDATLAS_MODULES__.ukLightning.windowFor(Date.now()); return { s: new Date(w.s).toISOString(), e: new Date(w.e).toISOString(), days: w.span / 864e5, clamped: w.clamped }; });
    await clickToggle(B.page, B.phone); await clickChip(B.page, '12m'); await settle(B.page); await B.step('12m lookback from 2029-02-28T12:00Z across leap year 2028 → 2028-02-28T12:00Z, 366 days', { window: await W() }); };
  gy.opts = { clock: '2029-02-28T12:00:00Z' }; await B.restart(ly.dir, gy);
});

C('N17', 'custom From > To (refused), future date (typed past max), and the date input limits', ['D09', 'R05'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d (408)');
  const before = shardReqs(B).length; await applyCustom(B.page, '2026-10-25', '2026-10-21'); await settle(B.page); await B.step('custom From 2026-10-25 > To 2026-10-21 → refused; previous 7d points must stay with their own caption', { newShardRequests: shardReqs(B).length - before });
  await applyCustom(B.page, '2026-11-15', '2026-11-15'); await settle(B.page); await B.step('custom future date 2026-11-15 (typed past max=' + ymd(T) + ')', { validity: await B.page.evaluate(() => { const i = document.querySelector('#scada-ui-container [data-lightning-date="to"]'); return { value: i.value, max: i.max, rangeOverflow: i.validity.rangeOverflow, valid: i.validity.valid }; }) }); await shot(B.page, 'N17-future-date');
  await applyCustom(B.page, '2026-10-20', '2026-11-15'); await settle(B.page); await B.step('custom 2026-10-20..2026-11-15 (To in the future, From valid)');
});

C('N18', 'mid-window ingestion: index generated 3 days before "now" inside a 7d window; last scan 3 d 7 h ago', ['D03', 'D13', 'D07'], { clock: CLOCK }, async (B) => {
  const a = archive('N18-midwindow', { endDate: '2026-10-23', nDays: 10, perDay: 3, generated: Date.parse('2026-10-23T12:00:00Z'), scanEnd: Date.parse('2026-10-23T11:00:00Z') });
  await B.restart(a.dir, async (B) => { await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('7d at 2026-10-26T18:40Z (index generated 2026-10-23T12:00Z)'); await shot(B.page, 'N18-midwindow'); });
});

C('N19', 'window outside feed retention while the archive is unpublished: custom 10 days back (refused), PREV chain stops at 7 days', ['D06', 'D05'], { clock: CLOCK, fixture: realDir('lightning-archive-no-index') }, async (B) => {
  await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h (feed fallback)');
  const f0 = feedReqs(B); await applyCustom(B.page, '2026-10-10', '2026-10-12'); await settle(B.page); await B.step('custom 2026-10-10..12 (older than the 7-day feed)', { feedRequestsAdded: feedReqs(B) - f0 });
  await clickChip(B.page, '24h'); await settle(B.page); let n = 0; while (n < 10 && !(await B.page.locator('#scada-ui-container [data-lightning-nav="prev"]').isDisabled())) { await clickNav(B.page, 'prev'); await settle(B.page); n++; }
  await B.step(`PREV clicked ${n} times until disabled (expected 6: 7-day feed retention)`, { prevClicks: n }); await shot(B.page, 'N19-feed-retention');
});

C('N20', 'mobile viewport switch while ON: 12k points as raw on desktop, resize to 390x844, then re-apply → clusters (phone cap 10k)', ['D11'], { clock: '2026-10-26T06:00:00Z' }, async (B) => {
  await B.restart(`${L.FIX}/N12-12k/data`, async (B) => {
    await clickToggle(B.page, B.phone); await applyCustom(B.page, '2026-10-25', '2026-10-25'); await settle(B.page, 120000); await L.waitTiles(B.page); await B.step('desktop 1440x900: 12,000 as points');
    await B.page.setViewportSize({ width: 390, height: 844 }); await B.page.waitForTimeout(1500); await B.step('after resize to 390x844 WITHOUT reload: caption still describes the desktop load', { ph: await B.page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, w: innerWidth })) });
    await clickNav(B.page, 'apply'); await settle(B.page, 120000); await L.waitTiles(B.page); await B.step('re-APPLY at 390 px → clusters (exceeds the 10,000 cap for this phone) expected'); await shot(B.page, 'N20-resized-390');
  });
});

C('N21', 'cache invalidation: same URLs return new content; PREV→LATEST re-fetches index + UNSEALED shards only; OFF→ON without refresh keeps the old data', ['D08', 'D10', 'D03'], { clock: '2026-10-26T06:00:00Z' }, async (B) => {
  const T6 = Date.parse('2026-10-26T06:00:00Z'); const idx = JSON.parse(JSON.stringify(REAL_INDEX)); idx.generated_utc = iso(T6 - 10 * 60000); idx.next_update_due_utc = iso(T6 + 3 * HOUR); idx.fixture_note = SYN + ' timestamps';
  const dir = copyReal('N21-cache', 'lightning-archive', { 'history/index.json': JSON.stringify(idx) });
  await B.restart(dir, async (B) => {
    await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d (408; 21–23 sealed, 24–25 unsealed)', { shardRequests: shardReqs(B), idx: idxReqs(B) });
    // mutate the served files: newer index, 25.json +1 synthetic flash (unsealed), 23.json +1 synthetic flash (SEALED → must not be re-read)
    const i2 = JSON.parse(JSON.stringify(idx)); i2.generated_utc = iso(T6 - 60000); const r25 = i2.days.find(d => d.date === '2026-10-25'); r25.count = 4; r25.last_observation_utc = '2026-10-25T20:00:00.000Z'; const r23 = i2.days.find(d => d.date === '2026-10-23'); r23.count = 190; i2.archived_observations = 410;
    const s25 = readJSON(path.join(dir, 'history/days/2026/10/25.json')); s25.features.push(feat('late25', '2026-10-25T20:00:00Z', -1.5, 52.5)); s25.metadata.count = 4;
    const s23 = readJSON(path.join(dir, 'history/days/2026/10/23.json')); s23.features.push(feat('late23', '2026-10-23T23:00:00Z', -1.6, 52.6)); s23.metadata.count = 190;
    fs.writeFileSync(path.join(dir, 'history/index.json'), JSON.stringify(i2)); fs.writeFileSync(path.join(dir, 'history/days/2026/10/25.json'), JSON.stringify(s25)); fs.writeFileSync(path.join(dir, 'history/days/2026/10/23.json'), JSON.stringify(s23));
    const n0 = shardReqs(B).length, i0 = idxReqs(B);
    await clickNav(B.page, 'prev'); await settle(B.page); await clickNav(B.page, 'latest'); await settle(B.page);
    await B.step('after mutation, PREV then LATEST: index re-fetched, 24+25 re-fetched (unsealed), 21–23 served from LRU → 409 expected (not 410)', { newShardRequests: shardReqs(B).slice(n0), idxAdded: idxReqs(B) - i0 }); await shot(B.page, 'N21-after-latest');
    // second mutation, then OFF → ON (no refresh path)
    const s25b = JSON.parse(JSON.stringify(s25)); s25b.features.push(feat('late25b', '2026-10-25T21:00:00Z', -1.4, 52.4)); s25b.metadata.count = 5; fs.writeFileSync(path.join(dir, 'history/days/2026/10/25.json'), JSON.stringify(s25b)); const i3 = JSON.parse(JSON.stringify(i2)); i3.generated_utc = iso(T6 - 30000); i3.days.find(d => d.date === '2026-10-25').count = 5; fs.writeFileSync(path.join(dir, 'history/index.json'), JSON.stringify(i3));
    const n1 = shardReqs(B).length, i1 = idxReqs(B); await clickToggle(B.page, B.phone); await settle(B.page); await clickToggle(B.page, B.phone); await settle(B.page);
    await B.step('second mutation, OFF→ON (7d still selected): does it re-read? (requests added; 410 if yes, 409 if cached)', { newShardRequests: shardReqs(B).slice(n1), idxAdded: idxReqs(B) - i1 });
  });
});

C('N22', 'offline (all lightning hosts abort) then online: FAIL named, recovery via re-clicking the period chip', ['D06', 'D15'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await B.page.route(/raw\.githubusercontent\.com/, r => r.abort('internetdisconnected'));
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('OFFLINE: ON 7d', { idx: idxReqs(B), feed: feedReqs(B), requests: B.rec.requests.map(r => r.url + ' ' + (r.failure || r.status)) }); await shot(B.page, 'N22-offline');
  await B.page.unroute(/raw\.githubusercontent\.com/); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ONLINE again: re-click 7d → recovery expected (408)');
});

C('N23', 'CORS denial (genuine: page on localhost, lightning URLs 302 → 127.0.0.1 which sends no Access-Control-Allow-Origin)', ['D06', 'D16', 'D15'], { clock: CLOCK, host: 'localhost', fixture: realDir('lightning-archive'), before: async (page) => { const to = u => `http://127.0.0.1:${L.PORT}/evidence/negative-matrix-D/cors-mirror/` + u.replace(/^.*\/data\//, ''); await page.route(/raw\.githubusercontent\.com\/Ventusltd\/lightning\//, r => r.fulfill({ status: 302, headers: { location: to(r.request().url()) } })); } }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d with cross-origin denial on index and feed', { requests: B.rec.requests.map(r => r.url + ' ' + (r.failure || r.status)), cors: B.rec.consoleErrors.filter(e => /CORS|Access-Control|cross-origin/i.test(e)).slice(0, 4) }); await shot(B.page, 'N23-cors');
});

C('N24', 'data arriving after the user toggles OFF (shards delayed 3 s; OFF after 0.5 s) must not draw; then ON again', ['D10', 'D15', 'P09'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await delayRoute(B.page, /\/history\/days\//, 3000, realDir('lightning-archive'));
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await B.page.waitForTimeout(500); await B.step('ON 7d, 0.5 s later (loading)');
  await clickToggle(B.page, B.phone); await B.page.waitForTimeout(300); await B.step('OFF immediately'); await B.page.waitForTimeout(4500); await B.step('4.5 s after OFF (delayed shards have resolved): no source/layer expected', { shardRequests: shardReqs(B) });
  await clickToggle(B.page, B.phone); await settle(B.page, 60000); await B.step('ON again (24h default, shards from LRU/pending)');
});

C('N25', 'repeated rapid ON/OFF: 20 clicks at 120 ms (ends OFF), then ON; consistency of label, source, timer and request count', ['D15', 'D10', 'P09'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  const t = L.mainToggle(B.page); await t.scrollIntoViewIfNeeded(); for (let i = 0; i < 20; i++) { await t.click(); await B.page.waitForTimeout(120); }
  await B.page.waitForTimeout(2500); await B.step('after 20 rapid clicks (should be OFF)', { idx: idxReqs(B), shards: shardReqs(B).length, feed: feedReqs(B) });
  await t.click(); await settle(B.page); await B.step('21st click → ON, settled', { idx: idxReqs(B), shards: shardReqs(B).length });
  for (let i = 0; i < 10; i++) { await t.click(); await B.page.waitForTimeout(60); } await settle(B.page); await B.step('10 more clicks at 60 ms (ends ON)', { idx: idxReqs(B), shards: shardReqs(B).length }); await shot(B.page, 'N25-rapid');
});

C('N26', 'network callback after navigating to a different window: slow 7d shards (4 s), PREV at 0.4 s; and 24h→7d(slow)→48h', ['D10', 'D03'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  const dir = realDir('lightning-archive'); await delayRoute(B.page, /days\/2026\/10\/2[123]\.json$/, 4000, dir);
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await B.page.waitForTimeout(400); await clickNav(B.page, 'prev'); await settle(B.page); await B.step('PREV window (12→19 Oct) settled while the 7d shards are still in flight');
  await B.page.waitForTimeout(5500); await B.step('5.5 s later: the 7d responses resolved → must NOT paint 408 under the PREV caption', { shardRequests: shardReqs(B) }); await shot(B.page, 'N26-stale-prev');
  await clickNav(B.page, 'latest'); await settle(B.page, 60000); await B.step('LATEST → 7d again');
  // second sequence
  await B.restart(dir, async (B) => {
    await delayRoute(B.page, /days\/2026\/10\/2[123]\.json$/, 4000, dir); await clickToggle(B.page, B.phone); await settle(B.page); await B.step('ON 24h');
    await clickChip(B.page, '7d'); await B.page.waitForTimeout(300); await clickChip(B.page, '48h'); await settle(B.page, 60000); await B.page.waitForTimeout(5000);
    const s = await B.step('24h → 7d (slow) → 48h, after everything resolved: caption 48h and every drawn flash inside the 48h window'); s.allInWindow = s.map.firstTime ? (Date.parse(s.map.firstTime) >= T - 2 * DAY) : null;
  });
});

C('N27', 'prefers-reduced-motion: reduce — ON 7d; no animation/transition on lightning nodes; identical caption', ['P15', 'D13'], { clock: CLOCK, fixture: realDir('lightning-archive'), reducedMotion: 'reduce' }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page);
  await B.step('ON 7d under reduced motion', { motion: await B.page.evaluate(() => { const els = [...document.querySelectorAll('[data-lightning-group], [data-lightning-group] *')]; const anim = els.filter(e => { const c = getComputedStyle(e); return (c.animationName && c.animationName !== 'none') || (c.transitionDuration && c.transitionDuration !== '0s'); }).map(e => e.tagName + '.' + e.className); return { nodes: els.length, animatedOrTransitioning: anim.slice(0, 10), reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }; }) }); await shot(B.page, 'N27-reduced-motion');
});

C('N28', 'Grid menu: open by click, ArrowDown lands on engine:400, Tab to the lightning row, Space toggles OFF without closing, Escape closes and returns focus', ['P06', 'P07', 'D14'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d (408)');
  const title = B.page.locator('#gridatlas-menu-bar .gm-title', { hasText: /^Grid$/ }); await title.click(); await B.page.waitForTimeout(300);
  await B.step('Grid menu opened by click', { panelOpen: await B.page.evaluate(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-panel-grid'); return p && !p.hidden; }), rowBox: await B.page.locator('#gridatlas-menu-bar [data-lightning-group="menu"] input').boundingBox(), mapBox: await B.page.locator('#map-container').boundingBox() }, { ignoreOrig: ['menuOpen'] });
  await B.page.keyboard.press('Escape'); await B.page.waitForTimeout(200); await title.focus(); await B.page.keyboard.press('ArrowDown'); await B.page.waitForTimeout(300);
  await B.step('ArrowDown from the Grid title → first focusable', { ignoreOrig: ['menuOpen'] });
  let tabs = 0; while (tabs < 90) { const a = await B.page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.lightningControl === 'toggle' && !!document.activeElement.closest('#gridatlas-menu-bar')); if (a) break; await B.page.keyboard.press('Tab'); tabs++; }
  await B.step(`Tab ×${tabs} → lightning menu checkbox focused`, { tabs, ignoreOrig: ['menuOpen'], rowVisibleInMap: await B.page.evaluate(() => { const r = document.querySelector('#gridatlas-menu-bar [data-lightning-group="menu"] input').getBoundingClientRect(); const m = document.getElementById('map-container').getBoundingClientRect(); return { rowTop: Math.round(r.top), rowBottom: Math.round(r.bottom), mapBottom: Math.round(m.bottom), inside: r.bottom <= m.bottom }; }) });
  await B.page.keyboard.press('Space'); await B.page.waitForTimeout(600);
  await B.step('Space on the lightning menu checkbox → OFF expected; panel must stay open', { panelOpen: await B.page.evaluate(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-panel-grid'); return p && !p.hidden; }), ignoreOrig: ['menuOpen'] });
  await B.page.keyboard.press('Escape'); await B.page.waitForTimeout(300);
  await B.step('Escape → panel closed, focus back on the Grid title expected', { panelOpen: await B.page.evaluate(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-panel-grid'); return p && !p.hidden; }) }); await shot(B.page, 'N28-grid-menu');
  // mouse: open Grid again, click the lightning row (ON from the menu) → panel stays open; body click closes
  await title.click(); await B.page.waitForTimeout(300); const cb = B.page.locator('#gridatlas-menu-bar [data-lightning-group="menu"] input'); await cb.click(); await settle(B.page);
  await B.step('mouse click on the Grid-footer lightning row → ON; panel stays open', { panelOpen: await B.page.evaluate(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-panel-grid'); return p && !p.hidden; }), ignoreOrig: ['menuOpen'] });
  await B.page.mouse.click(700, 400); await B.page.waitForTimeout(300); await B.step('click on the map body → panel closes; lightning stays ON', { panelOpen: await B.page.evaluate(() => { const p = document.querySelector('#gridatlas-menu-bar .gm-panel-grid'); return p && !p.hidden; }) });
});

C('N29', '10-minute refresh via page.clock.fastForward: at latest → index + unsealed shards re-read; after PREV (not latest) → nothing; after OFF → nothing', ['R10', 'P13', 'D08'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await B.step('ON 7d', { idx: idxReqs(B), shards: shardReqs(B) });
  let n0 = shardReqs(B).length, i0 = idxReqs(B); await B.page.clock.fastForward(600000); await B.page.waitForTimeout(500); await settle(B.page); await B.step('+10 min (fastForward) at latest → auto refresh expected', { idxAdded: idxReqs(B) - i0, newShardRequests: shardReqs(B).slice(n0) });
  n0 = shardReqs(B).length; i0 = idxReqs(B); await B.page.clock.fastForward(600000); await B.page.waitForTimeout(500); await settle(B.page); await B.step('+20 min → second refresh', { idxAdded: idxReqs(B) - i0, newShardRequests: shardReqs(B).slice(n0) });
  await clickNav(B.page, 'prev'); await settle(B.page); n0 = shardReqs(B).length; i0 = idxReqs(B); await B.page.clock.fastForward(600000); await B.page.waitForTimeout(1500); await B.step('PREV (not at latest) then +10 min → no refresh expected', { idxAdded: idxReqs(B) - i0, newShardRequests: shardReqs(B).slice(n0) });
  await clickToggle(B.page, B.phone); await B.page.waitForTimeout(300); n0 = shardReqs(B).length; i0 = idxReqs(B); await B.page.clock.fastForward(1200000); await B.page.waitForTimeout(1500); await B.step('OFF then +20 min → no request expected, timer cleared', { idxAdded: idxReqs(B) - i0, newShardRequests: shardReqs(B).slice(n0) });
});

C('N30', 'LRU eviction beyond 8 shards: 12 days in 30d, then 7d (all in LRU → 0 requests), then the 2 oldest days (evicted → 2 requests)', ['R10', 'D10'], { clock: CLOCK }, async (B) => {
  const a = archive('N30-lru', { endDate: '2026-10-26', nDays: 12, perDay: 2, generated: T - 3 * 60000, scanEnd: T - HOUR });
  await B.restart(a.dir, async (B) => {
    await clickToggle(B.page, B.phone); await clickChip(B.page, '30d'); await settle(B.page, 60000); await B.step('30d: 12 shards', { shards: shardReqs(B) });
    let n0 = shardReqs(B).length; await clickChip(B.page, '7d'); await settle(B.page); await B.step('7d: newest 8 days (19–26) → expected 0 new requests', { newShardRequests: shardReqs(B).slice(n0) });
    n0 = shardReqs(B).length; await applyCustom(B.page, '2026-10-15', '2026-10-16'); await settle(B.page); await B.step('custom 15–16 Oct (evicted) → expected 2 new requests', { newShardRequests: shardReqs(B).slice(n0) });
    n0 = shardReqs(B).length; await clickChip(B.page, '30d'); await settle(B.page, 60000); await B.step('30d again → 2 of 12 evicted meanwhile (17,18) → expected 2 new requests', { newShardRequests: shardReqs(B).slice(n0) }); await shot(B.page, 'N30-lru');
  });
});

C('N31', 'style reload with lightning ON: real basemap radio (Satellite/Dark); then a labelled programmatic map.setStyle(sameStyle) probe (no shell path calls setStyle)', ['R10', 'D10', 'P09'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  await clickToggle(B.page, B.phone); await clickChip(B.page, '7d'); await settle(B.page); await L.waitTiles(B.page); await B.step('ON 7d');
  await B.page.locator('#scada-ui-container input[name="bm"][value="sat"]').click(); await B.page.waitForTimeout(1500); await B.step('real basemap radio → Satellite', { ignoreOrig: ['bm'], tiles: await L.waitTiles(B.page) });
  await B.page.locator('#scada-ui-container input[name="bm"][value="dark"]').click(); await B.page.waitForTimeout(1500); await B.step('real basemap radio → Dark', { tiles: await L.waitTiles(B.page) }); await shot(B.page, 'N31-basemap');
  const r = await B.page.evaluate(() => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__; const before = m.getStyle().layers.length; m.once('style.load', () => setTimeout(() => res({ before, after: m.getStyle().layers.length, lightningLayer: !!m.getLayer('l-gridatlas-lightning'), lightningSource: !!m.getSource('gridatlas-lightning') }), 1500)); m.setStyle(m.getStyle()); }));
  await B.page.waitForTimeout(1000); await B.step('SYNTHETIC PROBE (not a user gesture): map.setStyle(map.getStyle()) with lightning ON', { probe: r, tiles: await L.waitTiles(B.page) });
  await clickChip(B.page, '7d'); await settle(B.page); await B.step('re-click 7d after the style reload → layer re-added?', { tiles: await L.waitTiles(B.page) });
});

C('N32', 'hostile INDEX and FEED metadata strings reaching the caption: HTML in first/last_observation_utc (overview), HTML in schema, HTML/garbage in feed latest_detection_utc/query_end_utc', ['D15', 'D13', 'D06'], { clock: CLOCK }, async (B) => {
  const i1 = JSON.parse(JSON.stringify(REAL_INDEX)); const r23 = i1.days.find(d => d.date === '2026-10-23'); r23.first_observation_utc = INJ; r23.last_observation_utc = 'garbage'; i1.fixture_note = SYN;
  await B.restart(copyReal('N32a-index-html-dates', 'lightning-archive', { 'history/index.json': JSON.stringify(i1) }), async (B) => { await clickToggle(B.page, B.phone); await clickChip(B.page, '3m'); await settle(B.page, 20000); await B.step('3m overview with first_observation_utc = <img onerror> and last = garbage'); await shot(B.page, 'N32a-index-html-dates'); });
  const i2 = JSON.parse(JSON.stringify(REAL_INDEX)); i2.schema = INJ; i2.fixture_note = SYN;
  await B.restart(copyReal('N32b-index-html-schema', 'lightning-archive', { 'history/index.json': JSON.stringify(i2) }), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page, 20000); await B.step('index schema = <img onerror> → reason rendered as text expected'); });
  const fd = JSON.parse(JSON.stringify(REAL_FEED)); fd.metadata.latest_detection_utc = INJ; fd.metadata.query_end_utc = 'garbage'; fd.metadata.fixture_note = SYN;
  await B.restart(writeFixture('N32c-feed-html-meta', { 'uk_lightning.geojson': fd }), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page, 20000); await B.step('no index + feed metadata latest_detection_utc = <img onerror>, query_end_utc = garbage'); await shot(B.page, 'N32c-feed-html-meta'); });
  const i4 = JSON.parse(JSON.stringify(REAL_INDEX)); i4.cutoff_date_utc = INJ; i4.fixture_note = SYN;
  await B.restart(copyReal('N32d-index-html-cutoff', 'lightning-archive', { 'history/index.json': JSON.stringify(i4) }), async (B) => { await clickToggle(B.page, B.phone); await settle(B.page, 20000); await B.step('index cutoff_date_utc = <img onerror> → refused as text'); });
});


/* ---- owner-device reproductions (coordinator request 22:4x UTC; iPhone Safari live route; here Chromium emulation, no-index fixture) ---- */
const PHONE = (w, h) => ({ phone: true, viewport: { width: w, height: h } });
const panelProbe = page => page.evaluate(() => {
  const host = document.getElementById('scada-ui-container'); const grp = document.querySelector('#scada-ui-container [data-lightning-group="main"]');
  const lines = [...document.querySelectorAll('#gridatlas-lightning-caption-main [data-cap]')].filter(n => n.textContent);
  const hide = [...document.querySelectorAll('button,div,a')].find(e => /HIDE LAYERS/i.test(e.textContent || '') && e.children.length === 0) || document.getElementById('gridatlas-dash-toggle');
  const hr = hide && hide.getBoundingClientRect();
  const occl = lines.map(n => { const r = n.getBoundingClientRect(); const pts = [[r.left + 4, r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 4, r.top + r.height / 2]]; const hits = pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e === n || n.contains(e) ? 'caption' : (hide && (e === hide || hide.contains(e)) ? 'HIDE-LAYERS' : (e.tagName + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]).slice(0, 50))) : 'offscreen'; }); return { cap: n.dataset.cap, top: Math.round(r.top), bottom: Math.round(r.bottom), hits }; });
  const hostR = host.getBoundingClientRect(); const lastOrig = [...document.querySelectorAll('#scada-ui-container .key-group')].filter(g => !g.dataset.lightningGroup).at(-1); const lr = lastOrig && lastOrig.getBoundingClientRect();
  return { hostScroll: { top: host.scrollTop, height: host.scrollHeight, client: host.clientHeight, bottom: Math.round(hostR.bottom) }, hideBtn: hide && { text: hide.textContent.trim().slice(0, 30), id: hide.id, pos: getComputedStyle(hide).position, top: Math.round(hr.top), bottom: Math.round(hr.bottom), left: Math.round(hr.left), right: Math.round(hr.right) }, lines: occl, groupBottom: grp && Math.round(grp.getBoundingClientRect().bottom), lastOriginalGroup: lastOrig && { title: lastOrig.querySelector('.key-title')?.textContent, bottom: Math.round(lr.bottom), coveredByHide: hr ? lr.bottom > hr.top && lr.top < hr.bottom : null } };
});
C('N33', 'OWNER-REPRO 1: feed-fallback (no index) at 393x852 — real taps on 30D, 3M, 6M, 12M: disabled / ignored / responsive, and what the caption says', ['D05', 'D06', 'R05'], { clock: CLOCK, fixture: realDir('lightning-archive-no-index'), ...PHONE(393, 852) }, async (B) => {
  await clickToggle(B.page, true); await clickChip(B.page, '7d'); await settle(B.page); await B.step('phone 393x852, feed fallback, 7D (owner saw this state)');
  for (const p of ['30d', '3m', '6m', '12m']) {
    const b = B.page.locator(`#scada-ui-container [data-lightning-period="${p}"]`); await b.scrollIntoViewIfNeeded(); const box = await b.boundingBox(); const disabled = await b.isDisabled(); const cs = await b.evaluate(e => ({ opacity: getComputedStyle(e).opacity, pointerEvents: getComputedStyle(e).pointerEvents, cursor: getComputedStyle(e).cursor, title: e.title, ariaDisabled: e.getAttribute('aria-disabled'), disabledAttr: e.disabled, cls: e.className }));
    const serial0 = await B.page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.serial);
    // a REAL tap at the chip's centre (disabled buttons swallow clicks; tap the coordinates rather than the locator so the attempt itself is recorded)
    if (box) await B.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await B.page.waitForTimeout(800); await settle(B.page, 20000);
    const serial1 = await B.page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.serial);
    await B.step(`real tap on ${p.toUpperCase()} chip`, { chip: { disabled, ...cs, box: box && { w: Math.round(box.width), h: Math.round(box.height) } }, reacted: serial1 !== serial0, serial: [serial0, serial1] });
  }
  await shot(B.page, 'N33-phone-feed-chips');
});
C('N34', 'OWNER-REPRO 2: feed mode "searched 2%" at 7D — how coverage is derived from feed metadata; is it a truthful number?', ['D13', 'D04', 'R06'], { clock: CLOCK, fixture: realDir('lightning-archive-no-index'), ...PHONE(393, 852) }, async (B, out) => {
  await clickToggle(B.page, true); await clickChip(B.page, '7d'); await settle(B.page); const s = await B.step('phone feed fallback 7D');
  const meta = REAL_FEED.metadata; const qs = Date.parse(meta.query_start_utc), qe = Date.parse(meta.query_end_utc); const win = 7 * DAY;
  out.derivation = { feed_metadata: { query_start_utc: meta.query_start_utc, query_end_utc: meta.query_end_utc, products_examined: meta.products_examined, retention_days: meta.retention_days, latest_detection_utc: meta.latest_detection_utc, total_before_display_cap: meta.total_before_display_cap }, overlay_rule: 'ff(): cov = cv({sw:[{s:query_start_utc,e:scan_end_utc||query_end_utc,n:1}], lastScan:qe}, w.s, w.e) → f = overlap(window, last query window)/window; the feed carries ONLY the last run window, no scan history', computed_fraction: Math.min(1, Math.max(0, Math.min(qe, T) - Math.max(qs, T - win)) / win), percent_shown: s.caption && s.caption[4], points_outside_last_query_window: REAL_FEED.features.filter(f => { const t = Date.parse(f.properties.time_utc); return t < qs || t >= qe; }).length, points_total: REAL_FEED.features.length };
  await shot(B.page, 'N34-phone-feed-searched');
});
C('N35', 'OWNER-REPRO 3: 393x852 and 360x740, Layers open, lightning ON, scrolled to the end — does the fixed "▾ HIDE LAYERS" button occlude the caption lines? Compare with the baseline-last group while OFF', ['P14', 'D13', 'R01'], { clock: CLOCK, fixture: realDir('lightning-archive') }, async (B) => {
  for (const [w, h] of [[393, 852], [360, 740]]) {
    const g = async (B) => {
      await L.openLayersOnPhone(B.page); const host = B.page.locator('#scada-ui-container');
      await host.evaluate(e => { e.scrollTop = e.scrollHeight; }); await B.page.waitForTimeout(400); await B.step(`${w}x${h} OFF, Layers open, scrolled to the end (baseline-equivalent: last original group + lightning header)`, { probe: await panelProbe(B.page) });
      await clickToggle(B.page, true); await clickChip(B.page, '7d'); await settle(B.page);
      await host.evaluate(e => { e.scrollTop = e.scrollHeight; }); await B.page.waitForTimeout(400); await B.step(`${w}x${h} ON 7d, scrolled to the end: elementFromPoint over each caption line`, { probe: await panelProbe(B.page) }); await shot(B.page, `N35-hide-layers-${w}x${h}`);
      // user scroll gesture (wheel) instead of programmatic scrollTop
      await host.evaluate(e => { e.scrollTop = 0; }); const hb = await host.boundingBox(); await B.page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); for (let i = 0; i < 40; i++) await B.page.mouse.wheel(0, 400); await B.page.waitForTimeout(500); await B.step(`${w}x${h} ON 7d after 40 wheel steps (real scroll gesture)`, { probe: await panelProbe(B.page) });
    }; g.opts = PHONE(w, h); await B.restart(realDir('lightning-archive'), g);
  }
});

/* ------------------------------ runner ---------------------------------------------------- */
if (process.argv.includes('--list')) { for (const c of CASES) console.log(c.id, c.title); process.exit(0); }
const srv = await L.startServer(); const browser = await chromium.launch();
const results = []; fs.mkdirSync(path.join(L.EV, 'results'), { recursive: true }); fs.mkdirSync(path.join(L.EV, 'shots'), { recursive: true });
for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.id))) {
  const t0 = Date.now();
  const out = { id: c.id, title: c.title, acceptance_ids: c.ids, candidate: { generation: L.GEN, sha: 'fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d', route: L.ROUTE(c.opts.host) }, harness: 'lead-shim (offline-shim.mjs unmodified) + runner static server :8145; Chromium ' + browser.version() + ' / Playwright 1.63.0; page.clock.install fake clock', viewport: c.opts.phone ? '390x844 iPhone-12 emulation (Chromium, NOT WebKit — geometry/UA only)' : (c.opts.viewport ? `${c.opts.viewport.width}x${c.opts.viewport.height}` : '1440x900'), clock: c.opts.clock || null, reducedMotion: c.opts.reducedMotion || 'no-preference', steps: [], boots: [] };
  let B = null;
  const closeB = async () => { if (B) { try { out.boots.push({ dir: B.dir, synthetic: !B.dir.startsWith(L.REAL), requests: B.rec.requests, pageErrors: B.rec.pageErrors, consoleErrors: B.rec.consoleErrors.slice(0, 30), shim: B.shim.summary(), comp: B.comp }); } catch { } await B.ctx.close().catch(() => { }); B = null; } };
  const start = async (dir, fn) => {
    await closeB(); const o = { ...c.opts, ...(fn && fn.opts || {}) };
    B = await L.boot({ browser, fixtureDir: dir, viewport: o.viewport, phone: o.phone, clock: o.clock, reducedMotion: o.reducedMotion, host: o.host, before: o.before, timezone: o.timezone }); B.dir = dir;
    B.before = await snap(B.page);
    B.step = async (name, extra = {}) => { const s = await snap(B.page); out.steps.push({ step: name, boot: out.boots.length, fixture: dir, synthetic: !dir.startsWith(L.REAL), snap: s, origDiff: origDiff(B.before, s, (c.ignoreOrig || []).concat(extra.ignoreOrig || [])), ...extra }); return s; };
    B.restart = (d, g) => start(d, g);
    if (fn) await fn(B);
  };
  try { await start(c.opts.fixture || realDir('lightning-archive')); await c.run(B, out); } catch (e) { out.harnessError = String(e && e.stack || e).slice(0, 1500); }
  await closeB(); out.elapsedMs = Date.now() - t0;
  fs.writeFileSync(path.join(L.EV, 'results', c.id + '.json'), JSON.stringify(out, null, 1)); results.push(out);
  const last = out.steps.at(-1)?.snap;
  console.log(`\n[${c.id}] ${out.harnessError ? 'HARNESS-ERROR ' + out.harnessError.slice(0, 300) : ''} ${(out.elapsedMs / 1000).toFixed(0)}s steps=${out.steps.length} pageErrors=${out.boots.reduce((n, b) => n + b.pageErrors.length, 0)} mapErrors=${last?.nmd?.mapErrors?.length} rejections=${last?.nmd?.rejections?.length}`);
  for (const s of out.steps) { const n = s.snap; console.log(`   - ${s.step}\n       label="${n?.label.main}" menu="${n?.label.menu}" toggles=${JSON.stringify(n?.toggles)} state="${n?.stateLine}" dot=${n?.dot}\n       map: feats=${n?.map.features} cluster=${n?.map.cluster} vis=${n?.map.visibility} badCoords=${n?.map.badCoords} rendered=${n?.map.rendered} first=${n?.map.firstTime} last=${n?.map.lastTime}\n       S.last=${JSON.stringify(n?.S?.last)} S.requests=${n?.S?.requests} S.errors=${JSON.stringify(n?.S?.errors)} injected=${n?.injected} markupNodes=${n?.lightningMarkupNodes} origDiff=${JSON.stringify(s.origDiff)} extra=${JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !['step', 'snap', 'origDiff', 'boot', 'fixture', 'synthetic'].includes(k)))).slice(0, 600)}`); if (n?.caption) for (const l of n.caption) if (l) console.log('       | ' + l.slice(0, 260)); if (n?.nmd?.mapErrors?.length) console.log('       mapErrors: ' + JSON.stringify(n.nmd.mapErrors.slice(0, 3))); if (n?.nmd?.rejections?.length) console.log('       rejections: ' + JSON.stringify(n.nmd.rejections.slice(0, 2))); }
  for (const b of out.boots) if (b.pageErrors.length) console.log('   pageErrors: ' + JSON.stringify(b.pageErrors.slice(0, 3)));
}
await browser.close(); srv.close();
fs.writeFileSync(path.join(L.EV, 'results', `matrix-${ONLY.length ? ONLY.join('_') : 'all'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(results.map(r => ({ id: r.id, title: r.title, acceptance_ids: r.acceptance_ids, elapsedMs: r.elapsedMs, harnessError: r.harnessError, pageErrors: r.boots.flatMap(b => b.pageErrors), steps: r.steps.map(s => ({ step: s.step, synthetic: s.synthetic, label: s.snap?.label, toggles: s.snap?.toggles, stateLine: s.snap?.stateLine, caption: s.snap?.caption, features: s.snap?.map.features, cluster: s.snap?.map.cluster, visibility: s.snap?.map.visibility, badCoords: s.snap?.map.badCoords, injected: s.snap?.injected, markupNodes: s.snap?.lightningMarkupNodes, last: s.snap?.S?.last, origDiff: s.origDiff, extra: Object.fromEntries(Object.entries(s).filter(([k]) => !['step', 'snap', 'origDiff', 'boot', 'fixture', 'synthetic'].includes(k))) })) })), null, 1));
