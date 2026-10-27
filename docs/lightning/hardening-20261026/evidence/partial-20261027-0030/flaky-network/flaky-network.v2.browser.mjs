// flaky-network.v2.browser.mjs — issue #32 final push, lane flaky-network (v2 after container restart).
// v2 changes vs v1: ONE page per group (the atlas boot takes ~75 s under shared load and v1's fake clock crashed the
// renderer); Date frozen with page.clock.setFixedTime(FAKE_NOW) so real timers run (15 s timeout fires for real);
// the overlay's own 10-minute setInterval callback is captured by an init script (setInterval wrapper, delay 6e5 only)
// and invoked to perform 'the next refresh'. Each fault case = real click OFF, arm fault, real click ON, settle.
// Transport-fault injection (page.route) on every lightning resource of the uk-lightning overlay.
// Harness: lead-shim (lightning/harness/offline-shim.mjs) + this lane's fault route registered AFTER the shim (takes
// precedence; non-faulted requests fall back to the shim). Chromium headless via Playwright from /home/claude/gridatlas.
// Desktop 1440x900. Real locator.click() and real mouse drag; no force, no dispatchEvent. Fake clock installed at
// FAKE_NOW and left running at real speed (so the overlay's 15 s AbortController/XHR timeout fires in real time);
// the "next refresh" is the overlay's own 10-minute timer, reached with page.clock.fastForward(600 s + 1 s)
// (fastForward fires each due timer once; runFor replayed ~37k rAF frames and crashed the renderer in the smoke run).
// "slow trickle" cannot be produced by route.fulfill (no streaming); it is a 302 from the faulted URL to an in-process
// node http server on an ephemeral 127.0.0.1 port that dribbles the genuine bytes. Labelled in the results.
//
// usage: node flaky-network.browser.mjs --route http://127.0.0.1:8176/wt/atlas/v/202610262323/ --group index|shard|part|feed|refresh [--faults a,b] [--out DIR]
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEADFIX = join(HERE, '..', '..', '..', 'lightning', 'fixtures');
const PARTS = join(HERE, 'fixtures', 'SYNTHETIC-hourly-parts', 'data');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROUTE = arg('route'); const GROUP = arg('group');
const ONLY = (arg('faults') || '').split(',').filter(Boolean);
const OUT = arg('out') || join(HERE, 'runs', GROUP);
await mkdir(OUT, { recursive: true });
const FAKE_NOW = '2026-10-26T18:40:00Z';
const G = '#scada-ui-container [data-lightning-group="main"]';
const SEL = { toggle: `${G} input[data-lightning-control="toggle"]`, chip: p => `${G} button[data-lightning-period="${p}"]` };
const CAPS = ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning', 'footer'];
const INV = JSON.stringify({ engine: 60, pipeline: 3, total: 63, unique: 63, complete: true });

// resource matchers on the path after /Ventusltd/lightning/<ref>/data/
const RES = {
  index: r => r === 'history/index.json',
  shard: r => /^history\/days\/\d{4}\/\d{2}\/\d{2}\.json$/.test(r),
  part: r => /^history\/days\/\d{4}\/\d{2}\/\d{2}\/\d{2}\.json$/.test(r),
  feed: r => r === 'uk_lightning.geojson',
  status: r => r === 'status.json',
};
const restOf = u => { const m = /^\/Ventusltd\/lightning\/[^/]+\/data\/(.+)$/.exec(new URL(u).pathname); return m ? m[1] : null; };

// ---------------------------------------------------------------- trickle server (genuine bytes, slowly)
let DATA_FOR_TRICKLE = null;
const trickle = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const ms = Number(u.searchParams.get('ms')) || 20000; const rest = u.pathname.replace(/^\/t\//, '');
  let body; try { body = await readFile(join(DATA_FOR_TRICKLE, rest)); } catch { res.writeHead(404, { 'access-control-allow-origin': '*' }); return res.end('nf'); }
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  const n = 40, step = Math.ceil(body.length / n); let i = 0;
  const iv = setInterval(() => { if (res.destroyed || i >= body.length) { clearInterval(iv); if (!res.destroyed) res.end(); return; } res.write(body.subarray(i, i + step)); i += step; }, ms / n);
  req.on('close', () => clearInterval(iv));
});
await new Promise(r => trickle.listen(0, '127.0.0.1', r));
const TPORT = trickle.address().port;

// ---------------------------------------------------------------- faults
const TXT = { 'content-type': 'text/plain', 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
const FAULTS = {
  none: null,
  http500: async r => r.fulfill({ status: 500, headers: TXT, body: 'Internal Server Error' }),
  http503: async r => r.fulfill({ status: 503, headers: TXT, body: 'Service Unavailable' }),
  http403: async r => r.fulfill({ status: 403, headers: TXT, body: 'Forbidden' }),
  http404: async r => r.fulfill({ status: 404, headers: TXT, body: '404: Not Found' }),
  stall20: async r => { await new Promise(z => setTimeout(z, 20000)); try { await r.fallback(); } catch { } },
  reset: async r => r.abort('connectionreset'),
  truncated: async (r, f) => { const b = await readFile(f); await r.fulfill({ status: 200, headers: { ...TXT, 'content-type': 'application/json' }, body: b.subarray(0, Math.floor(b.length / 2)) }); },
  html200: async r => r.fulfill({ status: 200, headers: { ...TXT, 'content-type': 'text/html' }, body: '<!DOCTYPE html><html><head><title>Error</title></head><body><h1>We are having trouble</h1><p>Please try again later.</p></body></html>' }),
  wrongtype: async (r, f) => r.fulfill({ status: 200, headers: { ...TXT, 'content-type': 'text/html; charset=utf-8' }, body: await readFile(f) }),
  empty: async r => r.fulfill({ status: 200, headers: { ...TXT, 'content-type': 'application/json' }, body: '' }),
  redirect302: async (r, f, rest) => r.fulfill({ status: 302, headers: { location: `https://mirror.example.net/Ventusltd/lightning/main/data/${rest}`, 'access-control-allow-origin': '*' }, body: '' }),
  trickle20: async (r, f, rest) => r.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${TPORT}/t/${rest}?ms=20000`, 'access-control-allow-origin': '*' }, body: '' }),
  trickle8: async (r, f, rest) => r.fulfill({ status: 302, headers: { location: `http://127.0.0.1:${TPORT}/t/${rest}?ms=8000`, 'access-control-allow-origin': '*' }, body: '' }),
};
// group -> fixture, target, period gesture
const GROUPS = {
  index: { data: PARTS, target: 'index', chip: null },
  shard: { data: PARTS, target: 'shard', chip: '7d' },
  part: { data: PARTS, target: 'part', chip: '7d' },
  feed: { data: join(LEADFIX, 'lightning-archive-no-index', 'data'), target: 'feed', chip: null },
};

const view = c => c.page.evaluate(({ G, CAPS }) => {
  const q = s => document.querySelector(s), t = s => { const n = q(s); return n ? n.innerText.trim() : null; };
  const caps = {}; for (const k of CAPS) caps[k] = t(`${G} [data-cap="${k}"]`);
  const L = window.__GRIDATLAS_MODULES__.ukLightning, S = L.state, m = window.__GRIDATLAS_V9_MAP__;
  let layer = null; try { layer = m.getLayer('l-gridatlas-lightning') ? { visibility: m.getLayoutProperty('l-gridatlas-lightning', 'visibility') } : 'absent'; } catch (e) { layer = 'err ' + e.message; }
  return { label: t(`${G} [data-lightning-label]`), status: t(`${G} .status-dot`), dot: q(`${G} [data-lightning-dot]`)?.style.background, checked: q(`${G} input[data-lightning-control="toggle"]`)?.checked, caps,
    nav: Object.fromEntries([...document.querySelectorAll(`${G} button[data-lightning-nav]`)].map(b => [b.dataset.lightningNav, b.disabled ? 'disabled' : b.hidden ? 'hidden' : 'enabled'])),
    last: S.last, mode: S.res && S.res.mode, drawn: S.res && S.res.ev ? S.res.ev.length : null, errors: S.errors.slice(-6), requests: S.requests, layer };
}, { G, CAPS });
async function settle(c, ms = 90000) {
  const t0 = Date.now(); let v; await c.page.waitForTimeout(300);
  while (Date.now() - t0 < ms) { v = await view(c); if (v.status && v.status !== 'LOADING' && !/\[(LOAD|WAIT)\]/.test(v.label || '')) return { ...v, settledMs: Date.now() - t0 }; await c.page.waitForTimeout(250); }
  return { ...(v || await view(c)), settledMs: null, note: 'still LOADING after ' + ms + ' ms' };
}
async function mapUsable(c) {
  const p = c.page, r = {};
  r.inspect = await p.evaluate(() => { const M = window.__GRIDATLAS_MODULES__.menuBar; return M && M.inspect ? M.inspect() : null; });
  r.inspectOk = JSON.stringify(r.inspect) === INV;
  r.proxies = await p.evaluate(() => [document.querySelectorAll('[data-gridatlas-layer-proxy]').length, document.querySelectorAll('[data-gridatlas-layer-key]').length]);
  // a real click on an original engine layer checkbox and back
  try {
    const ck = await p.evaluate(() => [...document.querySelectorAll('#scada-ui-container input[data-layer-id]')].findIndex(i => i.checked));
    const box = p.locator('#scada-ui-container input[data-layer-id]').nth(Math.max(0, ck)); await box.scrollIntoViewIfNeeded();
    const id = await box.getAttribute('data-layer-id'); const b0 = await box.isChecked();
    await box.click({ timeout: 15000 }); await p.waitForTimeout(300); const b1 = await box.isChecked(); await box.click({ timeout: 15000 }); await p.waitForTimeout(300); const b2 = await box.isChecked();
    r.layerToggle = { id, b0, b1, b2, ok: b1 !== b0 && b2 === b0 };
  } catch (e) { r.layerToggle = { ok: false, error: String(e.message || e).split('\n')[0] }; }
  // a real mouse drag on the map canvas
  try {
    const c0 = await p.evaluate(() => window.__GRIDATLAS_V9_MAP__.getCenter().toArray());
    const cv = await p.locator('canvas.maplibregl-canvas').first().boundingBox();
    const x = cv.x + cv.width * 0.75, y = cv.y + cv.height * 0.5;
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x - 120, y + 60, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    const c1 = await p.evaluate(() => window.__GRIDATLAS_V9_MAP__.getCenter().toArray());
    r.drag = { c0, c1, ok: Math.abs(c1[0] - c0[0]) + Math.abs(c1[1] - c0[1]) > 1e-4 };
  } catch (e) { r.drag = { ok: false, error: String(e.message || e).split('\n')[0] }; }
  r.ok = r.inspectOk && r.proxies[0] === 63 && r.proxies[1] === 63 && r.layerToggle.ok && r.drag.ok;
  return r;
}
const cnt = (c, from, pred) => c.reqs.slice(from).filter(x => !x.failed && pred(x.u)).length;

// stale/unknown honesty on a settled view
function honesty(v, faultBlocksData) {
  const all = [v.label, v.status, ...CAPS.map(k => v.caps[k] || '')].join('\n');
  const issues = [];
  if (/1970|NaN|Invalid Date|undefined|null/.test(all)) issues.push('epoch/NaN/undefined/null text: ' + (all.match(/.{0,40}(1970|NaN|Invalid Date|undefined|null).{0,40}/) || [''])[0]);
  if (faultBlocksData && /NO FLASHES DETECTED|\| ?EMPTY|EMPTY \|/.test(v.status + ' ' + v.label)) issues.push('failed fetch shown as EMPTY/NO FLASHES');
  if (faultBlocksData && /^READY/.test(v.status || '') && !/STALE/.test(v.status)) issues.push('failed fetch shown as READY (fresh)');
  if (v.mode === 'feed' && !/STALE/.test(v.label || '')) issues.push('feed mode (feed 5 h 34 min old) without STALE in label');
  if (/\b0h 0min ago\b/.test(all)) issues.push('"0h 0min ago" (unknown time as zero?)');
  return issues;
}


const RES2 = { ...RES, shard: r => RES.shard(r) };
let browser = await chromium.launch({ headless: true });
let RUN0 = {}; try { RUN0 = JSON.parse(await readFile(join(OUT, 'results.json'), 'utf8')).cases || {}; } catch { }
const RUN = { route: ROUTE, group: GROUP, harness: 'lead-shim + flaky-network fault route; Chromium ' + browser.version() + ' headless; desktop 1440x900; Date fixed at ' + FAKE_NOW + ' (setFixedTime, real timers); next refresh = overlay 10-min interval callback captured and invoked', trickle: 'trickle = 302 to in-process 127.0.0.1:' + TPORT + ' server, 40 chunks over ms (route.fulfill cannot stream)', cases: RUN0 };

async function boot(data) {
  DATA_FOR_TRICKLE = data;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const c = { ctx, page, pageErrors: [], reqs: [], faulted: [], fault: { active: false, name: 'none', target: null }, crashed: false };
  page.on('crash', () => { c.crashed = true; });
  page.on('pageerror', e => c.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('request', r => { const u = r.url(); if (/raw\.githubusercontent\.com\/Ventusltd\/lightning|mirror\.example\.net|127\.0\.0\.1:\d+\/t\//.test(u)) c.reqs.push({ t: Date.now(), host: new URL(u).host, u: u.replace(/^.*\/data\//, '').replace(/^.*\/t\//, 'TRICKLE:').replace(/\?.*$/, '') }); });
  page.on('requestfailed', r => { const u = r.url(); if (/lightning|mirror|\/t\//.test(u)) c.reqs.push({ t: Date.now(), failed: r.failure() && r.failure().errorText, u: u.replace(/^.*\/data\//, '').replace(/^.*\/t\//, 'TRICKLE:').replace(/\?.*$/, '') }); });
  await page.clock.setFixedTime(FAKE_NOW);
  await page.addInitScript(() => { const si = window.setInterval; window.__FN_IV = []; window.setInterval = function (f, ms, ...a) { if (ms === 6e5) window.__FN_IV.push(f); return si.call(this, f, ms, ...a); }; });
  c.shim = await installOfflineShim(page, { lightningDataDir: data });
  await page.route(u => u.hostname === 'mirror.example.net', async r => { const rest = restOf(r.request().url()); try { await r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: await readFile(join(data, rest)) }); } catch { await r.fulfill({ status: 404, headers: TXT, body: 'nf' }); } });
  await page.route(u => u.hostname === 'raw.githubusercontent.com', async r => {
    const rest = restOf(r.request().url());
    if (!c.fault.active || !rest || !RES[c.fault.target](rest)) return r.fallback();
    c.faulted.push(rest);
    try { await FAULTS[c.fault.name](r, join(data, rest), rest); } catch (e) { c.faultErr = String(e).slice(0, 200); }
  });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  c.composition = await waitForComposition(page, { deadlineMs: 120000, settleMs: 2000 });
  await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
  return c;
}
const fireRefresh = c => c.page.evaluate(() => { const L = window.__GRIDATLAS_MODULES__.ukLightning.state; const n = window.__FN_IV.length; window.__FN_IV.forEach(f => f()); return { intervals: n, on: L.on, atLatest: !!(L.res && L.res.w && L.res.w.atLatest) }; });
async function setOn(c, on) { const t = c.page.locator(SEL.toggle); await t.scrollIntoViewIfNeeded(); if ((await t.isChecked()) !== on) await t.click({ timeout: 15000 }); }

process.on('uncaughtException', e => console.log('uncaughtException (logged, run continues): ' + String(e).slice(0, 200)));
let C = null;
async function ensure(cfg) { if (C && !C.crashed && !C.page.isClosed()) return C; if (C) await C.ctx.close().catch(() => { }); if (!browser.isConnected()) browser = await chromium.launch({ headless: true }); C = await boot(cfg.data); C.bootedAt = Date.now(); return C; }

async function runCase(name, fault, cfg, opts = {}, attempt = 1) {
  if (ONLY.length && !ONLY.includes(fault)) return;
  if (RUN0[name] && !RUN0[name].error && !process.argv.includes('--redo')) { console.log(name + '\tdone earlier, skipped (resume)'); return; }
  const t0 = Date.now(); let c;
  const rec = { fault, target: cfg.target, fixture: cfg.data.replace(/^.*scratchpad\//, ''), period: cfg.chip || '24h', mode: opts.refreshFault ? 'clean load, fault armed before next refresh' : 'fault armed before switch-on' };
  try {
    c = await ensure(cfg); rec.freshPage = Date.now() - c.bootedAt < 5000;
    await setOn(c, false); await c.page.waitForTimeout(200);
    c.faulted = []; const n0 = c.reqs.length;
    rec.invBefore = await c.page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.inspect());
    c.fault = { active: !opts.refreshFault && fault !== 'none', name: fault, target: cfg.target };
    await setOn(c, true);
    let v = await settle(c);
    if (cfg.chip) { await c.page.locator(SEL.chip(cfg.chip)).click({ timeout: 15000 }); v = await settle(c); }
    if (opts.refreshFault) {
      rec.cleanFirst = v; c.fault = { active: true, name: fault, target: cfg.target };
      const n2 = c.reqs.length; rec.refreshFire = await fireRefresh(c); v = await settle(c);
      rec.refreshReqs = c.reqs.slice(n2).map(x => x.u + (x.failed ? ' FAILED ' + x.failed : ''));
    }
    rec.faultReqs = c.reqs.slice(n0).map(x => (x.host && x.host !== 'raw.githubusercontent.com' ? x.host + ' ' : '') + x.u + (x.failed ? ' FAILED ' + x.failed : ''));
    rec.tSettle = Date.now() - t0; rec.fault_view = v; rec.faultedRequests = [...c.faulted];
    rec.honesty = honesty(v, fault !== 'none' && !['wrongtype', 'trickle8', 'redirect302'].includes(fault));
    rec.map = await mapUsable(c);
    // next refresh: still faulted (does it retry at all?) then cleared (does it recover?)
    const n3 = c.reqs.length; rec.refreshWhileFaulted = await fireRefresh(c); const vf = await settle(c);
    rec.retryFaulted = { targetRequests: cnt(c, n3, RES[cfg.target]), view: { label: vf.label, status: vf.status } };
    if (/stall|trickle20/.test(fault)) await c.page.waitForTimeout(6000);
    c.fault.active = false; const n1 = c.reqs.length;
    rec.refreshFire2 = await fireRefresh(c); const r = await settle(c);
    rec.retry = { targetRequests: cnt(c, n1, RES[cfg.target]), allRequests: c.reqs.slice(n1).map(x => x.u + (x.failed ? ' FAILED ' + x.failed : '')), view: r };
    rec.retry.recovered = !!r.last && r.last.failures === 0 && !/FAIL/.test(r.status || '') && (cfg.target === 'feed' ? r.mode === 'feed' : r.mode !== 'feed');
    rec.mapAfter = { inspect: await c.page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.inspect()) }; rec.mapAfter.inspectOk = JSON.stringify(rec.mapAfter.inspect) === INV;
    rec.pageErrors = [...c.pageErrors]; c.pageErrors.length = 0; rec.composition = c.composition && { ok: c.composition.ok, ms: c.composition.ms };
    try { await c.page.locator(G).screenshot({ path: join(OUT, `${name}.png`) }); } catch { }
  } catch (e) { rec.error = String(e.stack || e).slice(0, 600); }
  rec.seconds = Math.round((Date.now() - t0) / 1000);
  if (rec.error && (c && c.crashed || /crash|closed|Target|InterceptionId/i.test(rec.error)) && attempt < 3) { console.log(`${name}\tharness error (attempt ${attempt}), retrying on a fresh page: ${rec.error.slice(0, 120)}`); if (C) { await C.ctx.close().catch(() => { }); C = null; } return runCase(name, fault, cfg, opts, attempt + 1); }
  rec.attempt = attempt; RUN.cases[name] = rec;
  const v = rec.fault_view || {};
  console.log(`${name}\t${rec.seconds}s\tlabel=${v.label}\tstatus=${v.status}\tmapOk=${rec.map && rec.map.ok}\tretryF=${rec.retryFaulted && rec.retryFaulted.targetRequests}\tretry=${rec.retry && rec.retry.targetRequests}/${rec.retry && rec.retry.recovered}\thonesty=${JSON.stringify(rec.honesty || [])}${rec.error ? '\tERROR ' + rec.error.slice(0, 200) : ''}`);
  await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 2));
}

if (GROUP === 'refresh') {
  for (const f of ['http503', 'reset', 'stall20', 'html200']) await runCase(`refresh-index-${f}`, f, GROUPS.index, { refreshFault: true });
  if (C) { await C.ctx.close().catch(() => { }); C = null; }
  for (const f of ['http503', 'truncated']) await runCase(`refresh-shard-${f}`, f, GROUPS.shard, { refreshFault: true });
  if (C) { await C.ctx.close().catch(() => { }); C = null; }
  await runCase('refresh-feed-http503', 'http503', GROUPS.feed, { refreshFault: true });
} else {
  const cfg = GROUPS[GROUP];
  const order = Object.keys(FAULTS).filter(f => f !== 'none').concat(['none']);
  for (const f of order) await runCase(`${GROUP}-${f}`, f, cfg);
}
if (C) await C.ctx.close().catch(() => { });
await browser.close(); trickle.close();
console.log('out: ' + OUT);
