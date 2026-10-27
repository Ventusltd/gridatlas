// EXPERIMENT 5 (pr2-data-verifier): D06/D07 semantics in PR #2's client (history-window.mjs @ f7db76c)
// against the REAL index/shards produced by experiment 1 and the real 408-flash feed. Offline self-fixture:
// fetchImpl serves files from disk; variants simulate 404 / schema mismatch / network error / bad JSON.
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [,, WT, ARCHIVE] = process.argv;
const c = await import(pathToFileURL(WT + '/history-window.mjs').href);
const NOW = Date.parse('2026-10-26T13:10:00Z'); // just after the real run end 13:05:58
const BASE = 'https://example.test/data/';
const ok = (obj) => ({ ok: true, status: 200, json: async () => obj });
const notFound = { ok: false, status: 404, json: async () => { throw new Error('no body'); } };
function diskFetch(url) {
  const rel = url.replace(BASE, '');
  const path = rel === 'uk_lightning.geojson' ? WT + '/data/uk_lightning.geojson' : ARCHIVE + '/' + rel.replace(/^history\//, '');
  if (!existsSync(path)) return notFound;
  return ok(JSON.parse(readFileSync(path, 'utf8')));
}
function mk(variant) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url.replace(BASE, ''));
    if (variant === 'index404' && url.endsWith('index.json')) return notFound;
    if (variant === 'index500' && url.endsWith('index.json')) return { ok: false, status: 500 };
    if (variant === 'indexNet' && url.endsWith('index.json')) throw new TypeError('Failed to fetch');
    if (variant === 'indexBadJson' && url.endsWith('index.json')) return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
    if (variant === 'indexV3' && url.endsWith('index.json')) { const o = JSON.parse(readFileSync(ARCHIVE + '/index.json', 'utf8')); o.schema = 'uk-lightning-history-index.v3'; return ok(o); }
    if (variant === 'shard404' && url.endsWith('days/2026/10/23.json')) return notFound;
    if (variant === 'bothDown') throw new TypeError('Failed to fetch');
    return diskFetch(url);
  };
  const client = c.createLightningHistoryClient({ indexUrl: BASE + 'history/index.json', feedUrl: BASE + 'uk_lightning.geojson', fetchImpl, now: () => NOW });
  return { client, calls };
}
const w24 = c.selectUtcWindow({ period: '24h', end: new Date(NOW), now: NOW });
const w7d = c.selectUtcWindow({ period: '7d', end: new Date(NOW), now: NOW });
const w30 = c.selectUtcWindow({ period: '30d', end: new Date(NOW), now: NOW });
const show = (tag, r) => console.log(tag, JSON.stringify({ mode: r.mode, fallback: r.fallback ?? null, indexError: r.indexError ?? null, state: r.status.state, stale: r.status.stale,
  reasons: r.status.reasons, total: r.totalMatchingObservations ?? null, archivedDayCount: r.archivedDayCount ?? null, failures: r.failures?.length ?? 0,
  searched: r.coverage ? Math.round(r.coverage.searchedFraction * 100) + '%' : null, unknownDays: r.coverage?.unknownDays?.length ?? null }));

console.log('--- D06: archive missing/unavailable -> explicit fallback, never zero ---');
for (const v of ['index404', 'index500', 'indexNet', 'indexBadJson', 'indexV3']) {
  const { client, calls } = mk(v);
  const r = await client.loadWindow(w24); show(`[${v}] 24h`, r);
  console.log(`   caption.refresh: ${c.captionLines(r, { nowMs: NOW }).refresh}`);
  try { await client.loadWindow(w30); console.log(`[${v}] 30d UNEXPECTED success`); } catch (e) { console.log(`[${v}] 30d -> throws: ${e.message}`); }
  console.log('   requests:', calls);
}
{ const { client } = mk('bothDown'); try { await client.loadWindow(w24); } catch (e) { console.log('[bothDown] 24h -> throws:', e.message); } }

console.log('--- D07: never searched vs searched-zero vs partial, with the real archive ---');
const { client } = mk('ok');
const r7 = await client.loadWindow(w7d); show('[ok] 7d', r7);
console.log('   dailyCounts:', JSON.stringify(r7.dailyCounts));
for (const l of Object.values(c.captionLines(r7, { nowMs: NOW }))) if (l) console.log('   | ' + l);
const wNever = c.selectUtcDates('2026-10-10', '2026-10-12', { now: NOW });
const rN = await client.loadWindow(wNever); show('[ok] 10-12 Oct (never searched)', rN);
console.log('   | ' + c.captionLines(rN, { nowMs: NOW }).searched + ' | ' + c.captionLines(rN, { nowMs: NOW }).warning);
const wZero = c.selectUtcDates('2026-10-21', '2026-10-21', { now: NOW });
const rZ = await client.loadWindow(wZero); show('[ok] 21 Oct (full day searched, 31 flashes)', rZ);
const w20 = c.selectUtcWindow({ period: 'custom', start: '2026-10-20T22:45:00Z', end: '2026-10-20T23:45:00Z', now: NOW });
const r20 = await client.loadWindow(w20); show('[ok] 20 Oct 22:45-23:45 (searched by seed window, zero flashes)', r20);
console.log('   | ' + c.captionLines(r20, { nowMs: NOW }).actual);
const { client: cs } = mk('shard404');
const rS = await cs.loadWindow(w7d); show('[shard404] 7d', rS);
console.log('   | ' + c.captionLines(rS, { nowMs: NOW }).warning);
console.log('--- D07: cutoff clamp-and-flag ---');
const wOld = c.selectUtcWindow({ period: 'custom', start: '2025-10-01T00:00:00Z', end: '2025-11-05T00:00:00Z', now: NOW });
const rOld = await client.loadWindow(wOld); console.log('[ok] 1 Oct-5 Nov 2025 -> clamped.start', rOld.clamped.start, 'window', rOld.window.start, '->', rOld.window.end, 'state', rOld.status.state);
const wBefore = c.selectUtcWindow({ period: 'custom', start: '2025-10-01T00:00:00Z', end: '2025-10-20T00:00:00Z', now: NOW });
const rB = await client.loadWindow(wBefore); console.log('[ok] 1-20 Oct 2025 -> beforeArchive', rB.beforeArchive, 'state', rB.status.state, '|', c.captionLines(rB, { nowMs: NOW }).warning);
console.log('--- STALE after next_update_due (generated 13:05:58 + 3 h) ---');
const { client: late } = mk('ok');
const rL = await late.loadWindow(w24); console.log('[ok] at 13:10 stale?', rL.status.stale);
const { client: late2 } = mk('ok'); late2; // separate instance with a later clock
const c2 = c.createLightningHistoryClient({ indexUrl: BASE + 'history/index.json', feedUrl: BASE + 'uk_lightning.geojson', fetchImpl: async (u) => diskFetch(u), now: () => Date.parse('2026-10-26T16:10:00Z') });
const rL2 = await c2.loadWindow(c.selectUtcWindow({ period: '24h', end: new Date(Date.parse('2026-10-26T16:10:00Z')), now: Date.parse('2026-10-26T16:10:00Z') }));
console.log('[ok] at 16:10 (3h04 after generated, past next_update_due 16:05:58) stale?', rL2.status.stale, '|', c.captionLines(rL2, { nowMs: Date.parse('2026-10-26T16:10:00Z') }).refresh);
