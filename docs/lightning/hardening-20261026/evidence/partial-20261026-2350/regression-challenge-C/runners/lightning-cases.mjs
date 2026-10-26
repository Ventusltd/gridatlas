#!/usr/bin/env node
/**
 * lightning-cases.mjs — the lightning-specific failure-mode cases, run against ANY
 * composition that exposes a lightning control, through an adapter.
 *
 * Every case boots the page under the lead's offline shim with the lightning
 * feed/archive answered from a synthetic directory built for that case (the shim's
 * lightningDataDir option), switches lightning ON exactly as a reader would (the
 * adapter clicks the real control), waits for the terminal state, and records the
 * label text, the state object, the source feature count, rendered features, feed
 * request count, page errors, the 60+3 contract and a screenshot. Then it grades
 * the CONTRACT clauses for that case. Clauses the adapter cannot drive (no date
 * window on the surface under test) are reported BLOCKED_HARNESS(adapter), not PASS.
 *
 * Cases: baseline-feed · zero-observations · malformed-json · http-500 ·
 *        network-abort · cors-denied · stale-archive · over-40k-points ·
 *        older-than-one-year · missing-day-unknown
 *
 *   node lightning-cases.mjs --base http://127.0.0.1:8107/gridatlas/atlas/preview/lightning/ \
 *        --adapter ./adapters/v5-preview.mjs --out <dir> [--only case1,case2] [--viewport 1440x1000]
 *        [--stale-hours 6] [--big 45000]
 *
 * Nothing here edits the repository; fixtures are written under --out.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'http://127.0.0.1:8107/gridatlas/atlas/preview/lightning/');
const ADAPTER = path.resolve(arg('--adapter', path.join(path.dirname(new URL(import.meta.url).pathname), 'adapters', 'v5-preview.mjs')));
const OUT = path.resolve(arg('--out', 'lightning-cases-out'));
const ONLY = arg('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const [VW, VH] = arg('--viewport', '1440x1000').split('x').map(Number);
const STALE_HOURS = Number(arg('--stale-hours', '6'));
const BIG = Number(arg('--big', '45000'));
const FEED = 'https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson';
const REAL_FEED = '/home/claude/lightning/data/uk_lightning.geojson';
fs.mkdirSync(OUT, { recursive: true });
const adapter = (await import(pathToFileURL(ADAPTER).href)).default;

/* ------------------------------ fixtures ------------------------------------ */
const iso = (d) => new Date(d).toISOString();
const ymd = (d) => iso(d).slice(0, 10);
const DAY = 86400000;
const now = Date.now();
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function flash(i, t, rnd) {
  return { type: 'Feature', id: `synthetic-${i}`, geometry: { type: 'Point', coordinates: [+(-11 + 14 * rnd()).toFixed(5), +(49.5 + 12 * rnd()).toFixed(5)] }, properties: { name: `Lightning flash ${iso(t).slice(0, 16).replace('T', ' ')} UTC`, time_utc: iso(t), raw_tech: 'EUMETSAT optical flash (not a confirmed ground strike)', status: 'Satellite detection', source: 'EUMETSAT', source_product: 'MTG LI L2-LFL', observation_kind: 'optical_lightning_flash' } };
}
function feed(features, meta = {}) {
  const real = JSON.parse(fs.readFileSync(REAL_FEED, 'utf8'));
  const latest = features.length ? features.map(f => f.properties.time_utc).sort().at(-1) : null;
  return { type: 'FeatureCollection', metadata: { ...real.metadata, total_before_display_cap: features.length, latest_detection_utc: latest, status: 'ready', query_start_utc: iso(now - 3 * 3600000), query_end_utc: iso(now), ...meta }, features };
}
function writeDir(name, files) {
  const dir = path.join(OUT, 'fixtures', name);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [rel, body] of Object.entries(files)) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body)); }
  return dir;
}
function historyIndex({ days, scanWindows, generated = iso(now), cutoff = ymd(now - 365 * DAY) }) {
  return { schema: 'uk-lightning-history-index.v1', generated_utc: generated, observation: 'satellite optical lightning flashes, not ground strikes', cutoff_date_utc: cutoff, days: days.map(d => ({ date: d.date, path: `days/${d.date.slice(0, 4)}/${d.date.slice(5, 7)}/${d.date.slice(8, 10)}.json`, count: d.count, first_observation_utc: d.first, last_observation_utc: d.last })), scan_windows: scanWindows, scan_window_note: 'successful source search windows; evidence of requested periods, not source completeness', availability_note: 'partial archive unless backfilled; a missing day is unknown, not zero' };
}
function dayShard(date, features) { return { schema: 'uk-lightning-history-day.v1', type: 'FeatureCollection', metadata: { date_utc: date, count: features.length }, features }; }

const rnd = mulberry32(20261026);
const realFeatures = JSON.parse(fs.readFileSync(REAL_FEED, 'utf8')).features;
const bigFeatures = Array.from({ length: BIG }, (_, i) => flash(i, now - rnd() * 7 * DAY, rnd));
const D = (k) => ymd(now - k * DAY);
const CASES = [
  { id: 'baseline-feed', dir: () => writeDir('baseline-feed', { 'uk_lightning.geojson': JSON.parse(fs.readFileSync(REAL_FEED, 'utf8')) }), contract: ['label shows the observation count', 'label shows the latest detection or refresh time', 'label says optical/satellite, not ground strikes', 'terminal state reached within 30 s', 'no page errors', '60+3 contract intact', 'source feature count equals the file'] },
  { id: 'zero-observations', dir: () => writeDir('zero-observations', { 'uk_lightning.geojson': feed([]) }), contract: ['empty is reported as no observations in the window, not as a failure', 'control stays ON so the empty state is visible', 'label carries the window or refresh time', 'no page errors', '60+3 contract intact'] },
  { id: 'malformed-json', dir: () => writeDir('malformed-json', { 'uk_lightning.geojson': '{"type":"FeatureCollection","features":[' }), contract: ['failure is reported with a reason (unreadable feed)', 'no uncaught page error', 'feed requested at most 3 times in 15 s (bounded retry)', '60+3 contract intact', 'no feature is drawn'] },
  { id: 'http-500', override: async (ctx) => ctx.route(FEED, r => r.fulfill({ status: 500, body: 'server error', headers: { 'access-control-allow-origin': '*' } })), contract: ['failure is reported with the HTTP status', 'no uncaught page error', 'bounded retry', '60+3 contract intact'] },
  { id: 'network-abort', override: async (ctx) => ctx.route(FEED, r => r.abort('failed')), contract: ['failure is reported as a network failure', 'no uncaught page error', 'bounded retry', '60+3 contract intact'] },
  /* Playwright's route.fulfill bypasses the browser's CORS check (measured: a fulfilled
     response without ACAO still resolved). A genuine denial needs a genuine cross-origin
     response, so this case loads the page from http://localhost:<port>/ and redirects the
     feed to the same file on http://127.0.0.1:<port>/ (python http.server sends no ACAO). */
  { id: 'cors-denied', pageUrl: () => BASE.replace('127.0.0.1', 'localhost'), override: async (ctx) => ctx.route(FEED, r => r.fulfill({ status: 302, headers: { location: BASE.replace(/\/gridatlas\/.*$/, '') + '/lightning/data/uk_lightning.geojson' } })), contract: ['a cross-origin response without Access-Control-Allow-Origin is reported as a failure, not as empty and not as OK', 'no uncaught page error', 'bounded retry', '60+3 contract intact'] },
  { id: 'stale-archive', dir: () => writeDir('stale-archive', { 'uk_lightning.geojson': feed(realFeatures.map(f => ({ ...f, properties: { ...f.properties, time_utc: iso(Date.parse(f.properties.time_utc) - 10 * DAY) } })), { latest_detection_utc: iso(now - 10 * DAY), query_end_utc: iso(now - 10 * DAY), query_start_utc: iso(now - 10 * DAY - 3 * 3600000) }) }), contract: [`label shows the refresh/latest time verbatim`, `a feed older than ${STALE_HOURS} h is flagged stale, not presented as current`, 'no page errors', '60+3 contract intact'] },
  { id: 'over-40k-points', dir: () => writeDir('over-40k-points', { 'uk_lightning.geojson': feed(bigFeatures, { total_before_display_cap: BIG }) }), contract: [`either all ${BIG} are drawn and counted, or the cap is stated as "N shown of ${BIG}"`, 'terminal state within 30 s', 'no page errors', 'frame cadence after render >= 10 fps (recorded)', '60+3 contract intact'] },
  { id: 'older-than-one-year', history: true, dir: () => writeDir('older-than-one-year', { 'uk_lightning.geojson': feed(realFeatures.slice(0, 10)), 'history/index.json': historyIndex({ days: [{ date: D(1), count: 3, first: iso(now - DAY), last: iso(now - DAY + 3600000) }], scanWindows: [{ start_utc: iso(now - 2 * DAY), end_utc: iso(now), products_examined: 9 }] }), [`history/days/${D(1).slice(0, 4)}/${D(1).slice(5, 7)}/${D(1).slice(8, 10)}.json`]: dayShard(D(1), realFeatures.slice(0, 3)) }), window: () => [iso(now - 400 * DAY), iso(now - 390 * DAY)], contract: ['a window before the archive cutoff is refused with a message naming the retention horizon', 'no day shard is requested for it', 'no page errors', '60+3 contract intact'] },
  { id: 'missing-day-unknown', history: true, dir: () => writeDir('missing-day-unknown', { 'uk_lightning.geojson': feed(realFeatures.slice(0, 10)), 'history/index.json': historyIndex({ days: [{ date: D(3), count: 2, first: iso(now - 3 * DAY), last: iso(now - 3 * DAY + 60000) }, { date: D(1), count: 1, first: iso(now - DAY), last: iso(now - DAY) }], scanWindows: [{ start_utc: iso(now - 3.5 * DAY), end_utc: iso(now), products_examined: 20 }] }), [`history/days/${D(3).slice(0, 4)}/${D(3).slice(5, 7)}/${D(3).slice(8, 10)}.json`]: dayShard(D(3), realFeatures.slice(0, 2)), [`history/days/${D(1).slice(0, 4)}/${D(1).slice(5, 7)}/${D(1).slice(8, 10)}.json`]: dayShard(D(1), realFeatures.slice(2, 3)) }), window: () => [iso(now - 6 * DAY), iso(now)], contract: [`${D(2)} (inside a successful scan window, no archived flashes) reads 0`, `${D(5)} (outside every scan window) reads UNKNOWN, never 0`, 'the window total excludes unknown days or says so', 'no page errors', '60+3 contract intact'] }
];

/* ------------------------------ driver -------------------------------------- */
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const c of CASES.filter(c => !ONLY.length || ONLY.includes(c.id))) {
    const dir = c.dir ? c.dir() : writeDir(c.id, { 'uk_lightning.geojson': feed(realFeatures.slice(0, 5)) });
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: VW < 700, hasTouch: VW < 700, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const pageErrors = [], feedRequests = [], dayRequests = [], consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 240)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240)); });
    page.on('request', r => { const u = r.url(); if (u === FEED) feedRequests.push(Date.now()); if (/\/data\/history\/days\//.test(u)) dayRequests.push(u); });
    const shim = await installOfflineShim(ctx, { lightningDataDir: dir });
    await ctx.route(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/(?!lightning\/)/, r => r.continue());
    if (c.override) await c.override(ctx);
    const rec = { id: c.id, fixtureDir: dir, contract: c.contract, clauses: [], screenshot: path.join(OUT, `${c.id}-${VW}x${VH}.png`) };
    const t0 = Date.now();
    try {
      await page.goto(c.pageUrl ? c.pageUrl() : BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60, null, { timeout: 90000 });
      await adapter.ready(page);
      rec.contract63 = await page.evaluate(() => window.__GRIDATLAS_MODULES__?.menuBar?.inspect?.());
      const switchedOn = Date.now();
      await adapter.turnOn(page);
      let terminal = null;
      try { terminal = await adapter.waitTerminal(page, 30000); } catch (e) { terminal = { timeout: true, error: String(e).slice(0, 200) }; }
      rec.timeToTerminalMs = Date.now() - switchedOn;
      await page.waitForTimeout(1500);
      if (c.history && c.window) {
        if (adapter.selectWindow) { const [s, e] = c.window(); rec.window = { start: s, end: e }; rec.windowResult = await adapter.selectWindow(page, s, e).catch(err => ({ error: String(err).slice(0, 200) })); await page.waitForTimeout(1500); }
        else rec.windowResult = { blockedHarness: 'adapter exposes no date-window control on this surface' };
      }
      rec.state = await adapter.readState(page);
      rec.feedRequests = feedRequests.length; rec.dayRequests = dayRequests;
      rec.contract63After = await page.evaluate(() => window.__GRIDATLAS_MODULES__?.menuBar?.inspect?.());
      rec.fps = await page.evaluate(() => new Promise(res => { let n = 0; const s = performance.now(); const tick = () => { n++; if (performance.now() - s < 1000) requestAnimationFrame(tick); else res(n); }; requestAnimationFrame(tick); }));
      await page.screenshot({ path: rec.screenshot, fullPage: false });
    } catch (error) { rec.harnessError = String(error).slice(0, 300); await page.screenshot({ path: rec.screenshot, fullPage: false }).catch(() => { }); }
    rec.pageErrors = pageErrors; rec.consoleErrors = consoleErrors.slice(0, 10); rec.shim = shim.summary(); rec.elapsedMs = Date.now() - t0;
    rec.clauses = grade(c, rec);
    rec.verdict = rec.harnessError ? 'BLOCKED_HARNESS' : rec.clauses.some(x => x.result === 'FAIL') ? 'FAIL' : rec.clauses.some(x => x.result.startsWith('BLOCKED')) ? 'BLOCKED_HARNESS' : 'PASS';
    results.push(rec);
    console.log(`[lightning-cases] ${rec.verdict.padEnd(16)} ${c.id.padEnd(22)} label="${(rec.state?.label || '').slice(0, 90)}" feedRequests=${rec.feedRequests ?? '-'} pageErrors=${pageErrors.length}`);
    for (const x of rec.clauses) console.log(`    ${x.result.padEnd(16)} ${x.clause}${x.evidence ? ' — ' + x.evidence : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(OUT, 'lightning-cases.json'), JSON.stringify({ base: BASE, adapter: ADAPTER, viewport: [VW, VH], results }, null, 2));
const md = [`# Lightning failure-mode cases — ${BASE}`, '', `adapter: ${ADAPTER}  viewport ${VW}x${VH}`, '', '| case | verdict | label after switch-on | feed requests | page errors | time to terminal | clauses |', '|---|---|---|--:|--:|--:|---|'];
for (const r of results) md.push(`| ${r.id} | **${r.verdict}** | ${(r.state?.label || r.harnessError || '').replace(/\|/g, '/').slice(0, 110)} | ${r.feedRequests ?? '-'} | ${r.pageErrors.length} | ${r.timeToTerminalMs ?? '-'} ms | ${r.clauses.map(x => `${x.result}: ${x.clause}`).join('<br>').replace(/\|/g, '/')} |`);
fs.writeFileSync(path.join(OUT, 'lightning-cases.md'), md.join('\n') + '\n');
console.log(`[lightning-cases] -> ${path.join(OUT, 'lightning-cases.md')}`);

/* ------------------------------ grading ------------------------------------- */
function grade(c, r) {
  const out = [];
  const s = r.state || {}; const label = String(s.label || ''); const L = label.toLowerCase();
  const clause = (text, result, evidence) => out.push({ clause: text, result, evidence });
  const intact = (r.contract63After?.complete === true && r.contract63After.engine === 60 && r.contract63After.pipeline === 3);
  const common = () => { clause('60+3 contract intact', intact ? 'PASS' : 'FAIL', JSON.stringify(r.contract63After)); clause('no page errors', r.pageErrors.length ? 'FAIL' : 'PASS', r.pageErrors.join(' | ').slice(0, 160)); };
  const bounded = () => clause('bounded retry (feed requested <= 3 times)', r.feedRequests <= 3 ? 'PASS' : 'FAIL', `${r.feedRequests} requests`);
  const failureReported = (what, re) => { const failed = s.status === 'FAIL' || /fail|error|unavailable|unreadable|could not|cannot/.test(L); clause(`failure is reported (${what})`, failed ? (re && !re.test(L) ? 'FAIL' : 'PASS') : 'FAIL', failed ? (re && !re.test(L) ? 'reported, but the reason is not in the label: "' + label.slice(0, 80) + '"' : label.slice(0, 80)) : `status=${s.status} label="${label.slice(0, 80)}"`); };
  if (r.harnessError) { clause('harness', 'BLOCKED_HARNESS', r.harnessError); return out; }
  switch (c.id) {
    case 'baseline-feed': {
      const n = realFeatures.length;
      clause('label shows the observation count', new RegExp(`\\b${n}\\b`).test(label) ? 'PASS' : 'FAIL', label.slice(0, 80));
      clause('label shows the latest detection or refresh time', /\d{4}-\d{2}-\d{2}|\d{1,2} [A-Z][a-z]{2} \d{4}|\d{2}:\d{2} ?utc/i.test(label) ? 'PASS' : 'FAIL', label.slice(0, 80));
      clause('label says optical/satellite, not ground strikes', /satellite|optical/.test(L) && !/\bstrikes?\b(?!.*not)/.test(L) ? 'PASS' : 'FAIL', label.slice(0, 80));
      clause('terminal state within 30 s', r.timeToTerminalMs <= 30000 && s.status !== 'LOAD' ? 'PASS' : 'FAIL', `${r.timeToTerminalMs} ms, status ${s.status}`);
      clause('source feature count equals the file', s.features === n ? 'PASS' : 'FAIL', `${s.features} vs ${n}`);
      common(); break;
    }
    case 'zero-observations': {
      clause('empty is reported as no observations in the window, not as a failure', s.status !== 'FAIL' && (/no (published )?observations|none|0 /.test(L) || s.features === 0) ? 'PASS' : 'FAIL', `status=${s.status} label="${label.slice(0, 80)}"`);
      clause('control stays ON so the empty state is visible', s.checked === true ? 'PASS' : 'FAIL', `checked=${s.checked}`);
      clause('label carries the window or refresh time', /\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|utc|window|refreshed|updated/i.test(label) ? 'PASS' : 'FAIL', label.slice(0, 80));
      common(); break;
    }
    case 'malformed-json': failureReported('unreadable feed', /json|parse|unreadable|invalid|malformed|not a|feature/); clause('no feature is drawn', (s.features || 0) === 0 ? 'PASS' : 'FAIL', `${s.features}`); bounded(); common(); break;
    case 'http-500': failureReported('HTTP status', /500|http/); bounded(); common(); break;
    case 'network-abort': failureReported('network failure', /network|offline|fetch|unreachable|failed/); bounded(); common(); break;
    case 'cors-denied': { const corsSeen = r.consoleErrors.some(e => /CORS|Access-Control-Allow-Origin|cross-origin/i.test(e)); if (!corsSeen && s.status === 'OK') { clause('harness: the browser did not raise a CORS denial (redirect not followed cross-origin?)', 'BLOCKED_HARNESS', r.consoleErrors.join(' | ').slice(0, 160)); common(); break; } failureReported('CORS / cross-origin denial', /cors|cross-origin|denied|blocked|fetch|network|failed/); clause('not presented as empty or OK', !/no (published )?observations|empty|\[ok\]/i.test(L) ? 'PASS' : 'FAIL', label.slice(0, 80)); bounded(); common(); break; }
    case 'stale-archive': {
      clause('label shows the refresh/latest time verbatim', /\d{4}-\d{2}-\d{2}|\d{1,2} [A-Z][a-z]{2}|\d{2}:\d{2}/.test(label) ? 'PASS' : 'FAIL', label.slice(0, 80));
      clause(`a feed older than ${STALE_HOURS} h is flagged stale, not presented as current`, /stale|out of date|old|not current|days ago|hours ago|last updated/i.test(label) ? 'PASS' : 'FAIL', label.slice(0, 80));
      common(); break;
    }
    case 'over-40k-points': {
      const all = s.features === BIG; const capped = /\d[\d,]* shown of \d[\d,]*|capped|truncat|of \d/i.test(label);
      clause(`either all ${BIG} drawn and counted, or the cap is stated`, (all && new RegExp(`${BIG}`).test(label.replace(/,/g, ''))) || capped ? 'PASS' : 'FAIL', `features=${s.features} label="${label.slice(0, 80)}"`);
      clause('terminal state within 30 s', r.timeToTerminalMs <= 30000 && s.status !== 'LOAD' ? 'PASS' : 'FAIL', `${r.timeToTerminalMs} ms`);
      clause('frame cadence after render >= 10 fps (recorded)', r.fps >= 10 ? 'PASS' : 'FAIL', `${r.fps} frames in 1 s`);
      common(); break;
    }
    case 'older-than-one-year': {
      if (r.windowResult?.blockedHarness) { clause('a window before the cutoff is refused naming the horizon', 'BLOCKED_HARNESS', r.windowResult.blockedHarness); clause('no day shard requested', 'BLOCKED_HARNESS', 'no date-window control on this surface'); }
      else { const txt = JSON.stringify(r.windowResult || '') + ' ' + label; clause('a window before the cutoff is refused naming the horizon', /precede|retention|cutoff|before .*archive|not archived|older than/i.test(txt) ? 'PASS' : 'FAIL', txt.slice(0, 120)); clause('no day shard requested', r.dayRequests.length === 0 ? 'PASS' : 'FAIL', `${r.dayRequests.length} day requests`); }
      common(); break;
    }
    case 'missing-day-unknown': {
      if (r.windowResult?.blockedHarness) { for (const t of c.contract.slice(0, 3)) clause(t, 'BLOCKED_HARNESS', r.windowResult.blockedHarness); }
      else { const per = r.windowResult?.perDay || {}; clause(`${D(2)} reads 0 (quiet day inside a scan window)`, per[D(2)] === 0 || per[D(2)] === '0' ? 'PASS' : 'FAIL', JSON.stringify(per[D(2)])); clause(`${D(5)} reads UNKNOWN (outside every scan window)`, /unknown/i.test(String(per[D(5)])) ? 'PASS' : 'FAIL', JSON.stringify(per[D(5)])); clause('the window total excludes unknown days or says so', /unknown|partial|gap/i.test(JSON.stringify(r.windowResult)) ? 'PASS' : 'FAIL', JSON.stringify(r.windowResult).slice(0, 120)); }
      common(); break;
    }
  }
  return out;
}
