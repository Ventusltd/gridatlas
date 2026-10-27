// lightning-hardening.browser.mjs — opus-browser-tests, issue #32 Claude lane.
// Browser-level fail-first tests for the uk-lightning overlay, runnable against ANY candidate generation.
// Harness: lead-shim (../../../lightning/harness/offline-shim.mjs), Chromium via Playwright 1.63 from
// /home/claude/gridatlas/node_modules. Phones are Chromium emulation (isMobile, hasTouch), NOT WebKit/Safari.
// Gestures: real locator.click() (desktop) / locator.tap() (phone) and real mouse.wheel for scrolling; never force:true,
// never dispatchEvent. Assertions read user-visible caption/status/label text; menuBar.inspect() and request logs are
// the only non-visual probes (T13 invariants, T3/T12 request counts).
//
// usage:
//   node lightning-hardening.browser.mjs --gen 202610261949 --base http://127.0.0.1:8151/wt [--only 1,2,13] [--out DIR]
//   route = <base>/atlas/v/<gen>/   (override with --route <full url>)
//   server: python3 -m http.server 8151 --bind 127.0.0.1 --directory <scratchpad>/hardening
// exit code: 0 all PASS, 1 any FAIL/ERROR.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEADFIX = join(HERE, '..', '..', '..', 'lightning', 'fixtures');
const MYFIX = join(HERE, 'fixtures');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GEN = arg('gen'); const BASE = (arg('base') || '').replace(/\/$/, '');
if (!GEN || !(BASE || arg('route'))) { console.error('need --gen <stamp> and --base <url>'); process.exit(2); }
const ROUTE = arg('route') || `${BASE}/atlas/v/${GEN}/`;
const ONLY = (arg('only') || '').split(',').filter(Boolean).map(Number);
const STAMP = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const OUT = arg('out') || join(HERE, 'runs', `${GEN}-${STAMP}`);
await mkdir(OUT, { recursive: true });

const FAKE_NOW = '2026-10-26T18:40:00Z'; // lead fixtures built 18:37:03Z; feed query_end 13:05:58Z
const G = '#scada-ui-container [data-lightning-group="main"]';
const SEL = {
  toggle: `${G} input[data-lightning-control="toggle"]`, label: `${G} [data-lightning-label]`, status: `${G} .status-dot`,
  chip: p => `${G} button[data-lightning-period="${p}"]`, nav: n => `${G} button[data-lightning-nav="${n}"]`, cap: k => `${G} [data-cap="${k}"]`,
};
const CAPS = ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning', 'footer'];
const INV_EXPECT = { engine: 60, pipeline: 3, total: 63, unique: 63, complete: true };
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  p393: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: UA_IPHONE, deviceScaleFactor: 1 },
  p360: { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, userAgent: UA_ANDROID, deviceScaleFactor: 1 },
};
const num = s => s == null ? null : Number(String(s).replace(/,/g, ''));
const NF = n => Number(n).toLocaleString('en-GB');

const browser = await chromium.launch({ headless: true });
const RUN = { route: ROUTE, gen: GEN, harness: 'lead-shim (offline-shim.mjs); Chromium ' + browser.version() + ' headless; phones = Chromium emulation, not WebKit', node: process.version, startedAt: new Date().toISOString(), fakeClockDefault: FAKE_NOW, cases: {}, tests: {} };
const invRecords = []; // for T13

// ------------------------------------------------------------------ harness helpers
async function boot(name, { data, clock = FAKE_NOW, profile = 'desktop', indexDelayMs = 0 }) {
  const P = PROFILES[profile];
  const ctx = await browser.newContext({ ...P, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const log = { pageErrors: [], lightning: [], phone: !!P.isMobile, profile, data, clock };
  page.on('pageerror', e => log.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('request', r => { const u = r.url(); if (u.includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightning.push({ t: Date.now(), path: u.replace(/^.*\/data\//, '') }); });
  if (clock) await page.clock.install({ time: clock });
  const shim = await installOfflineShim(page, { lightningDataDir: data });
  if (indexDelayMs) await page.route(u => u.pathname.endsWith('/data/history/index.json'), async r => { await new Promise(z => setTimeout(z, indexDelayMs)); await r.fallback(); });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  log.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
  await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
  const c = { name, ctx, page, log, shim, phone: !!P.isMobile, steps: [] };
  c.invBefore = await invariants(c, 'before');
  if (c.phone) await openLayersPhone(c);
  return c;
}
async function invariants(c, when) {
  const v = await c.page.evaluate(() => {
    const M = window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar;
    return { inspect: M && M.inspect ? M.inspect() : null, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, markers: document.querySelectorAll('[data-gridatlas-layer-key]').length };
  }).catch(e => ({ error: String(e) }));
  v.ok = !!v.inspect && JSON.stringify(v.inspect) === JSON.stringify(INV_EXPECT) && v.proxies === 63 && v.markers === 63;
  v.lightningRequestsSoFar = c.log.lightning.length; v.when = when;
  return v;
}
async function gesture(c, sel, timeout = 5000) {
  const l = c.page.locator(sel).first();
  if (c.phone) await l.tap({ timeout }); else await l.click({ timeout });
}
async function tryGesture(c, sel, timeout = 4000) {
  try { await gesture(c, sel, timeout); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e).split('\n')[0].slice(0, 200) }; }
}
async function openLayersPhone(c) {
  const st = await c.page.evaluate(() => { const t = document.getElementById('gridatlas-dash-toggle'); return t ? t.getAttribute('aria-pressed') : null; });
  if (st === 'true') { await c.page.locator('#gridatlas-dash-toggle').tap(); await c.page.waitForTimeout(500); }
  c.layersOpened = await c.page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') !== '1');
}
const view = c => c.page.evaluate(({ SEL, CAPS }) => {
  const q = s => document.querySelector(s), t = s => { const n = q(s); return n ? n.innerText.trim() : null; };
  const caps = {}; for (const k of CAPS) caps[k] = t(`${SEL.G} [data-cap="${k}"]`);
  const chips = {}; document.querySelectorAll(`${SEL.G} button[data-lightning-period]`).forEach(b => { chips[b.dataset.lightningPeriod] = { active: b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true', disabled: b.disabled }; });
  const nav = {}; document.querySelectorAll(`${SEL.G} button[data-lightning-nav]`).forEach(b => { nav[b.dataset.lightningNav] = { disabled: b.disabled, hidden: b.hidden || getComputedStyle(b).display === 'none' }; });
  const capBox = q(`${SEL.G} [data-lightning-caption]`);
  return { label: t(`${SEL.G} [data-lightning-label]`), status: t(`${SEL.G} .status-dot`), checked: q(`${SEL.G} input[data-lightning-control="toggle"]`)?.checked, caps, chips, nav, captionVisible: !!(capBox && capBox.offsetParent) };
}, { SEL: { G }, CAPS });
async function settle(c, ms = 25000) {
  const t0 = Date.now(); let v;
  await c.page.waitForTimeout(300);
  while (Date.now() - t0 < ms) {
    v = await view(c);
    if (v.status && v.status !== 'LOADING' && !/\[(LOAD|WAIT)\]/.test(v.label || '')) return { ...v, settledMs: Date.now() - t0 };
    await c.page.waitForTimeout(250);
  }
  return { ...(v || await view(c)), settledMs: null, note: 'still loading after ' + ms + ' ms' };
}
async function step(c, what, extra = {}) { const v = await view(c); c.steps.push({ what, ...v, ...extra, pageErrors: c.log.pageErrors.length }); return v; }
async function on(c) { await gesture(c, SEL.toggle, 15000); return settle(c); }
async function shot(c, name) {
  try { if (c.phone) await c.page.screenshot({ path: join(OUT, name) }); else await c.page.locator(G).screenshot({ path: join(OUT, name) }); } catch { /* evidence only */ }
}
async function finish(c) {
  // OFF by a real gesture, then 11 fake minutes must produce no lightning request; invariants again
  const r = { };
  try {
    const v = await view(c);
    if (v.checked) { const g = await tryGesture(c, SEL.toggle, 8000); r.offGesture = g; await c.page.waitForTimeout(500); }
    const n0 = c.log.lightning.length;
    await c.page.clock.runFor(11 * 60 * 1000); await c.page.waitForTimeout(800);
    r.requestsWhileOffAfter11min = c.log.lightning.slice(n0).map(x => x.path);
    r.checkedAfterOff = (await view(c)).checked;
  } catch (e) { r.error = String(e).slice(0, 200); }
  c.invAfter = await invariants(c, 'after');
  const rec = { case: c.name, profile: c.log.profile, before: c.invBefore, after: c.invAfter, requestsBeforeFirstOn: c.firstOnAt ?? c.log.lightning.length, ...r };
  rec.ok = c.invBefore.ok && c.invAfter.ok && rec.requestsBeforeFirstOn === 0 && (rec.requestsWhileOffAfter11min || []).length === 0 && rec.checkedAfterOff === false;
  invRecords.push(rec);
  RUN.cases[c.name] = { profile: c.log.profile, fixture: c.log.data, clock: c.log.clock, composition: c.log.composition, layersOpened: c.layersOpened, steps: c.steps, pageErrors: c.log.pageErrors, lightningRequests: c.log.lightning.map(x => x.path), shim: c.shim.summary(), invariants: rec };
  await c.ctx.close();
}
function markFirstOn(c) { if (c.firstOnAt === undefined) c.firstOnAt = c.log.lightning.length; }
const A = (what, ok, observed) => ({ what, ok: !!ok, observed });
function verdict(id, title, asserts, extra = {}) {
  const res = asserts.every(a => a.ok) ? 'PASS' : 'FAIL';
  RUN.tests[id] = { title, result: res, asserts, ...extra };
  console.log(`${id} ${res}  ${title}`); for (const a of asserts) if (!a.ok) console.log(`    x ${a.what} :: ${JSON.stringify(a.observed).slice(0, 400)}`);
}
const nonFooter = v => CAPS.filter(k => k !== 'footer').map(k => v.caps[k] || '').join('\n');
// drawn count as the user reads it: status "N FLASHES DRAWN|CLUSTERED", else the flashes caption "N drawn as ...", else 0 when nothing is drawn
const drawnOf = v => {
  const m = /([\d,]+) FLASHES (DRAWN|CLUSTERED)/i.exec(v.status || ''); if (m) return num(m[1]);
  const k = /([\d,]+) drawn as/i.exec((v.caps && v.caps.flashes) || ''); if (k) return num(k[1]);
  return /NO FLASHES|none drawn/i.test((v.status || '') + ' ' + ((v.caps && v.caps.flashes) || '')) ? 0 : null;
};
async function runTest(id, fn) {
  if (ONLY.length && !ONLY.includes(Number(id.slice(1)))) return;
  const t0 = Date.now();
  try { await fn(); } catch (e) { RUN.tests[id] = { ...(RUN.tests[id] || {}), result: 'ERROR', error: String(e.stack || e).slice(0, 800) }; console.log(`${id} ERROR ${String(e).slice(0, 300)}`); }
  if (RUN.tests[id]) RUN.tests[id].seconds = Math.round((Date.now() - t0) / 1000);
  await writeFile(join(OUT, 'results.partial.json'), JSON.stringify(RUN, null, 2));
}

// ------------------------------------------------------------------ T1 CUSTOM during the first load
await runTest('T1', async () => {
  const c = await boot('T1-custom-during-first-load', { data: join(LEADFIX, 'lightning-archive', 'data'), indexDelayMs: 6000 });
  try {
    markFirstOn(c); await gesture(c, SEL.toggle); await c.page.waitForTimeout(200);
    await step(c, 'ON; index delayed 6 s');
    await gesture(c, SEL.chip('custom')); await c.page.waitForTimeout(400);
    const v1 = await step(c, 'CUSTOM tapped during first LOADING');
    await c.page.waitForTimeout(8000);
    const v2 = await step(c, 'after the delayed first load landed');
    await shot(c, 'T1-after-load.png');
    const customActive = v2.chips.custom && v2.chips.custom.active;
    verdict('T1', 'CUSTOM during the first load', [
      A('no uncaught page error', c.log.pageErrors.length === 0, c.log.pageErrors),
      A('CUSTOM chip is the active chip', customActive, v2.chips.custom),
      A('no stale non-custom window painted under CUSTOM (window line empty or "UTC dates … inclusive")', !v2.caps.window || /UTC dates/.test(v2.caps.window), v2.caps.window),
      A('label not [FAIL] without a stated reason', !/\[FAIL\]/.test(v2.label || '') || /^FAIL · \S/.test(v2.status || ''), { label: v2.label, status: v2.status, immediately: { label: v1.label, status: v1.status } }),
    ]);
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T2 malformed timestamp in the index
await runTest('T2', async () => {
  const c = await boot('T2-malformed-index-timestamp', { data: join(MYFIX, 'SYNTHETIC-hostile-index-timestamp', 'data') });
  try {
    markFirstOn(c); await on(c); await step(c, 'ON 24h');
    await gesture(c, SEL.chip('12m')); const v12 = await settle(c, 10000); c.steps.push({ what: '12M (overview reads first_observation_utc)', ...v12 });
    await shot(c, 'T2-12m.png');
    const r7 = await tryGesture(c, SEL.chip('7d')); const v7 = await settle(c, 10000); c.steps.push({ what: '7D after 12M', gesture: r7, ...v7 });
    const r24 = await tryGesture(c, SEL.chip('24h')); const v24 = await settle(c, 10000); c.steps.push({ what: '24H after 7D', gesture: r24, ...v24 });
    const named = /invalid|malformed|unparseable|bad (data|timestamp)|not-a-date|unknown/i;
    verdict('T2', 'Malformed timestamp in the index', [
      A('no uncaught page error', c.log.pageErrors.length === 0, c.log.pageErrors),
      A('12M settles (not stuck LOADING/[LOAD])', v12.settledMs !== null, { label: v12.label, status: v12.status }),
      A('12M caption names the bad data (actual or warning line)', named.test(v12.caps.actual || '') || named.test((v12.caps.warning || '').replace(/unknown, not zero|Unknown: \d+ of \d+ UTC dates have no collection run/g, '')), { actual: v12.caps.actual, warning: v12.caps.warning }),
      A('7D still usable afterwards (settles, window says 7 days)', r7.ok && v7.settledMs !== null && /7 days/.test(v7.caps.window || ''), { gesture: r7, label: v7.label, status: v7.status, window: v7.caps.window }),
      A('24H still usable afterwards', r24.ok && v24.settledMs !== null && /24 hours/.test(v24.caps.window || ''), { gesture: r24, label: v24.label, status: v24.status, window: v24.caps.window }),
    ]);
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T3 feed revalidation on OFF -> ON
await runTest('T3', async () => {
  const dir = join(OUT, 'T3-feed', 'data'); await mkdir(dir, { recursive: true });
  await cp(join(LEADFIX, 'lightning-archive-no-index', 'data'), dir, { recursive: true });
  const c = await boot('T3-feed-revalidation', { data: dir });
  try {
    const feedReqs = () => c.log.lightning.filter(x => x.path === 'uk_lightning.geojson').length;
    markFirstOn(c); const v1 = await on(c); c.steps.push({ what: 'ON 24h (feed fallback)', ...v1 }); const n1 = feedReqs();
    // SYNTHETIC change between the two ONs: the collection window moves 5 h later
    const fp = join(dir, 'uk_lightning.geojson'); const feed = JSON.parse(await readFile(fp, 'utf8'));
    feed.metadata.query_start_utc = '2026-10-26T15:05:00.000Z'; feed.metadata.query_end_utc = '2026-10-26T18:05:00.000Z'; feed.metadata.fixture_synthetic = 'opus-browser-tests T3: query window moved to 15:05-18:05Z';
    await writeFile(fp, JSON.stringify(feed));
    await gesture(c, SEL.toggle); await c.page.waitForTimeout(500); await step(c, 'OFF');
    const v2 = await on(c); c.steps.push({ what: 'ON again after the feed changed', ...v2 }); const n2 = feedReqs();
    verdict('T3', 'Feed revalidation (OFF then ON fetches the feed again)', [
      A('first ON fetched the feed once', n1 === 1, n1),
      A('second ON fetched the feed again (count +1)', n2 === n1 + 1, { first: n1, second: n2, log: c.log.lightning.map(x => x.path) }),
      A('caption shows the changed feed (refresh line names 18:05 UTC)', /18:05 UTC/.test(v2.caps.refresh || ''), { before: v1.caps.refresh, after: v2.caps.refresh }),
    ]);
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T4 feed STALE
await runTest('T4', async () => {
  const data = join(LEADFIX, 'lightning-archive-no-index', 'data');
  const c = await boot('T4-feed-stale', { data });
  let vStale, vFresh;
  try { markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); vStale = await settle(c); c.steps.push({ what: '7D at 18:40Z (feed collection ended 13:05:58Z, 5 h 34 min earlier)', ...vStale }); await shot(c, 'T4-stale.png'); }
  finally { await finish(c); }
  const k = await boot('T4-feed-fresh-control', { data, clock: '2026-10-26T14:00:00Z' });
  try { markFirstOn(k); await on(k); await gesture(k, SEL.chip('7d')); vFresh = await settle(k); k.steps.push({ what: '7D at 14:00Z (feed 54 min old) control', ...vFresh }); }
  finally { await finish(k); }
  verdict('T4', 'Feed STALE after 4 h', [
    A('feed >4 h old: label or status shows STALE', /STALE/.test((vStale.label || '') + ' ' + (vStale.status || '')), { label: vStale.label, status: vStale.status, refresh: vStale.caps.refresh }),
    A('control: feed 54 min old shows no STALE', !/STALE/.test((vFresh.label || '') + ' ' + (vFresh.status || '') + ' ' + (vFresh.caps.refresh || '')), { label: vFresh.label, status: vFresh.status }),
  ]);
});

// ------------------------------------------------------------------ T5 feed mode and PREV
await runTest('T5', async () => {
  const c = await boot('T5-feed-prev', { data: join(LEADFIX, 'lightning-archive-no-index', 'data') });
  try {
    markFirstOn(c); await on(c); await gesture(c, SEL.chip('48h')); const v0 = await settle(c); c.steps.push({ what: '48H latest', ...v0 });
    const asserts = []; const seen = [{ press: 0, ...v0 }];
    for (let i = 1; i <= 5; i++) {
      const v = await view(c); if (v.nav.prev.disabled) { c.steps.push({ what: `PREV disabled before press ${i}` }); break; }
      await gesture(c, SEL.nav('prev')); const w = await settle(c); c.steps.push({ what: `PREV #${i}`, ...w }); seen.push({ press: i, ...w });
    }
    await shot(c, 'T5-after-prev.png');
    for (const s of seen) {
      const d = drawnOf(s);
      if (s.press > 0) asserts.push(A(`PREV #${s.press}: not FAIL`, !/^FAIL/.test(s.status || '') && !/\[FAIL\]/.test(s.label || ''), { status: s.status, label: s.label, warning: s.caps.warning }));
      asserts.push(A(`press ${s.press}: no "searched 0%" while ${d} points are drawn`, !(d > 0 && (/Searched EUMETSAT 0%/i.test(s.caps.searched || '') || /SEARCHED 0%/.test(s.status || ''))), { drawn: d, searched: s.caps.searched, status: s.status }));
    }
    verdict('T5', 'Feed mode and PREV', asserts, { presses: seen.length - 1 });
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T6 long chips in feed mode (owner device, phone)
await runTest('T6', async () => {
  const c = await boot('T6-long-chips-feed-phone393', { data: join(LEADFIX, 'lightning-archive-no-index', 'data'), profile: 'p393' });
  try {
    markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); const v7 = await settle(c); c.steps.push({ what: '7D (owner screen)', ...v7 });
    await shot(c, 'T6-phone393-7d.png');
    const asserts = [];
    for (const p of ['30d', '3m', '6m', '12m']) {
      const pre = await view(c); const g = await tryGesture(c, SEL.chip(p), 3000);
      const v = g.ok ? await settle(c, 10000) : await view(c); c.steps.push({ what: `tap ${p.toUpperCase()}`, gesture: g, disabledBefore: pre.chips[p]?.disabled, ...v });
      const txt = nonFooter(v) + '\n' + (v.status || '') + '\n' + (v.label || '');
      asserts.push(A(`${p.toUpperCase()}: chip accepts the tap (not dead)`, g.ok, { gesture: g, disabledBefore: pre.chips[p]?.disabled }));
      asserts.push(A(`${p.toUpperCase()}: visible "archive not yet published … earlier coverage unknown, not zero"`, v.captionVisible && /archive not yet published/i.test(txt) && /earlier[^\n]*unknown,? not zero/i.test(txt), { visible: v.captionVisible, status: v.status, refresh: v.caps.refresh, warning: v.caps.warning, searched: v.caps.searched }));
      if (g.ok) await shot(c, `T6-phone393-${p}.png`);
    }
    verdict('T6', 'Long chips in feed mode (owner device 393x852, Chromium emulation)', asserts);
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T7 feed coverage wording
await runTest('T7', async () => {
  const c = await boot('T7-feed-coverage-wording', { data: join(LEADFIX, 'lightning-archive-no-index', 'data') });
  try {
    markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); const v = await settle(c); c.steps.push({ what: '7D feed', ...v }); await shot(c, 'T7-7d.png');
    verdict('T7', 'Feed coverage shown as unknown, not a percentage', [
      A('status carries no "SEARCHED n%"', !/SEARCHED \d+\s*%/i.test(v.status || ''), v.status),
      A('searched line carries no percentage', !/\d+\s*%/.test(v.caps.searched || ''), v.caps.searched),
      A('coverage stated as unknown (searched line or status)', /unknown/i.test((v.caps.searched || '') + ' ' + (v.status || '')), { searched: v.caps.searched, status: v.status }),
    ]);
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T8 HIDE LAYERS occlusion (phones)
async function wheelToEnd(c) {
  for (let i = 0; i < 40; i++) {
    const s = await c.page.evaluate(() => { const e = document.getElementById('scada-ui-container'); const r = e.getBoundingClientRect(); return { st: e.scrollTop, wy: scrollY, x: r.left + r.width / 2, y: Math.max(80, Math.min(innerHeight - 140, r.top + r.height / 2)) }; });
    await c.page.mouse.move(s.x, s.y); await c.page.mouse.wheel(0, 500); await c.page.waitForTimeout(200);
    const t = await c.page.evaluate(() => ({ st: document.getElementById('scada-ui-container').scrollTop, wy: scrollY }));
    if (t.st === s.st && t.wy === s.wy) return i;
  }
  return 40;
}
await runTest('T8', async () => {
  const asserts = []; const detail = {};
  for (const prof of ['p393', 'p360']) {
    const c = await boot(`T8-hide-layers-${prof}`, { data: join(LEADFIX, 'lightning-archive', 'data'), profile: prof });
    try {
      markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); await settle(c);
      const wheels = await wheelToEnd(c);
      const hits = await c.page.evaluate((G) => [...document.querySelectorAll(G + ' [data-cap]')].filter(n => n.innerText.trim()).map(n => {
        const r = n.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const inVp = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight; const t = inVp ? document.elementFromPoint(x, y) : null;
        const who = !t ? 'OUT-OF-VIEWPORT' : (t === n || n.contains(t)) ? 'caption' : t.id === 'gridatlas-dash-toggle' || t.closest('#gridatlas-dash-toggle') ? 'HIDE-LAYERS-BUTTON' : (t.tagName.toLowerCase() + (t.id ? '#' + t.id : ''));
        return { cap: n.dataset.cap, centre: [Math.round(x), Math.round(y)], hit: who, text: n.innerText.trim().slice(0, 60) };
      }), G);
      // stricter than the work order's "centre" rule: every RENDERED line (Range client rects) sampled at 10%..90% of its width
      const lines = await c.page.evaluate((G) => {
        const out = [];
        for (const n of document.querySelectorAll(G + ' [data-cap]')) {
          if (!n.innerText.trim()) continue;
          const rg = document.createRange(); rg.selectNodeContents(n);
          const rects = [...rg.getClientRects()].filter(r => r.width > 2 && r.height > 2);
          rects.forEach((r, i) => {
            const y = r.top + r.height / 2; const bad = [];
            for (let k = 1; k <= 9; k++) {
              const x = r.left + r.width * k / 10; const inVp = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight; const t = inVp ? document.elementFromPoint(x, y) : null;
              if (!t || !(t === n || n.contains(t))) bad.push({ x: Math.round(x), y: Math.round(y), hit: !t ? 'OUT-OF-VIEWPORT' : (t.closest('#gridatlas-dash-toggle') ? 'HIDE-LAYERS-BUTTON' : t.tagName.toLowerCase() + (t.id ? '#' + t.id : '')) });
            }
            out.push({ cap: n.dataset.cap, line: `${i + 1}/${rects.length}`, rect: [r.left, r.top, r.width, r.height].map(Math.round), blocked: bad });
          });
        }
        return out;
      }, G);
      const btn = await c.page.evaluate(() => { const b = document.getElementById('gridatlas-dash-toggle'); if (!b) return null; const r = b.getBoundingClientRect(); return { text: b.innerText.trim(), rect: [r.left, r.top, r.width, r.height].map(Math.round) }; });
      detail[prof] = { wheels, layersOpened: c.layersOpened, button: btn, hits, lines }; c.steps.push({ what: 'caption-line hit test at max scroll', ...detail[prof] });
      await shot(c, `T8-${prof}-end.png`);
      asserts.push(A(`${prof}: Layers open`, c.layersOpened, c.layersOpened));
      for (const h of hits) asserts.push(A(`${prof}: [as specified] caption block "${h.cap}" centre is hittable`, h.hit === 'caption', h));
      for (const l of lines) asserts.push(A(`${prof}: [strict] rendered line ${l.cap} ${l.line} hittable at 9 points along its width`, l.blocked.length === 0, l));
    } finally { await finish(c); }
  }
  verdict('T8', 'HIDE LAYERS does not occlude caption lines (393x852, 360x740)', asserts, { detail });
});

// ------------------------------------------------------------------ T9 out-of-box / NaN points
await runTest('T9', async () => {
  const c = await boot('T9-out-of-box', { data: join(MYFIX, 'SYNTHETIC-out-of-box', 'data') });
  try {
    markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); const v = await settle(c); c.steps.push({ what: '7D', ...v }); await shot(c, 'T9-7d.png');
    const src = await c.page.evaluate(() => { try { const s = window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-lightning'); const d = s && s.serialize && s.serialize().data; return d && d.features ? d.features.length : null; } catch (e) { return 'err ' + e.message; } });
    const d = drawnOf(v); const txt = nonFooter(v);
    verdict('T9', 'Out-of-box and NaN coordinates rejected and reported', [
      A('drawn count is the 408 genuine points only (3 synthetic bad records excluded)', d === 408, { status: v.status, flashes: v.caps.flashes, mapSourceFeatures: src }),
      A('caption reports records as rejected', /reject|quarantin/i.test(txt), { flashes: v.caps.flashes, warning: v.caps.warning }),
      A('no uncaught page error', c.log.pageErrors.length === 0, c.log.pageErrors),
    ], { mapSourceFeatures: src });
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T10 shard integrity
await runTest('T10', async () => {
  const c = await boot('T10-shard-mismatch', { data: join(MYFIX, 'SYNTHETIC-shard-mismatch', 'data') });
  try {
    markFirstOn(c); await on(c); await gesture(c, SEL.chip('7d')); const v = await settle(c); c.steps.push({ what: '7D', ...v }); await shot(c, 'T10-7d.png');
    const txt = nonFooter(v) + '\n' + (v.status || '');
    const asserts = [A('caption names a mismatch', /mismatch/i.test(txt), { status: v.status, warning: v.caps.warning })];
    for (const [date, field] of [['2026-10-22', 'sha256'], ['2026-10-23', 'bytes'], ['2026-10-24', 'count']])
      asserts.push(A(`${date} (${field} differs from index) named in the caption`, new RegExp(date + '[^,;·]*mismatch|mismatch[^,;·]*' + date, 'i').test(txt) || (txt.includes(date) && /mismatch/i.test(txt) && new RegExp(field, 'i').test(txt)), { warning: v.caps.warning }));
    verdict('T10', 'Shard count/bytes/sha256 disagreeing with the index named as mismatch', asserts);
  } finally { await finish(c); }
});

// ------------------------------------------------------------------ T11 + T12 (one scenario, two verdicts): 12H window, bulk day
const T11_12 = async () => {
  const c = await boot('T11-T12-bulk-12h', { data: join(MYFIX, 'SYNTHETIC-bulk-day', 'data'), clock: '2026-10-25T06:00:00Z' });
  const idx = JSON.parse(await readFile(join(MYFIX, 'SYNTHETIC-bulk-day', 'data', 'history', 'index.json'), 'utf8'));
  const bytesOf = new Map(idx.days.filter(r => r.path).map(r => [r.path, r.bytes]));
  const out = {};
  try {
    markFirstOn(c); await on(c); await gesture(c, SEL.chip('12h')); const pre = await settle(c, 30000); c.steps.push({ what: '12H (24 Oct 18:00 -> 25 Oct 06:00 UTC), before consent', ...pre });
    await shot(c, 'T11-12h-before-consent.png');
    const promised = num((/newest ([\d,]+)/i.exec(nonFooter(pre)) || [])[1]) || 40000;
    const n0 = c.log.lightning.length;
    const g = pre.nav.points && !pre.nav.points.hidden ? await tryGesture(c, SEL.nav('points'), 5000) : { ok: false, error: 'LOAD POINTS not offered' };
    const post = g.ok ? await settle(c, 120000) : await view(c); c.steps.push({ what: 'after LOAD POINTS', gesture: g, ...post });
    await shot(c, 'T11-12h-after-consent.png');
    const shards = c.log.lightning.slice(n0).map(x => x.path).filter(p => p.startsWith('history/days/')).map(p => p.replace('history/', ''));
    const reqBytes = shards.reduce((s, p) => s + (bytesOf.get(p) || 0), 0);
    out.pre = pre; out.post = post; out.promised = promised; out.gesture = g; out.shards = shards; out.reqBytes = reqBytes;
    out.indexSum = idx.days.filter(r => r.date === '2026-10-24' || r.date === '2026-10-25').reduce((s, r) => s + r.count, 0);
  } finally { await finish(c); }
  return out;
};
let BULK = null;
await runTest('T11', async () => {
  BULK = await T11_12(); const { pre, post, indexSum } = BULK;
  const asserts = [];
  for (const [when, v] of [['before consent', pre], ['after LOAD POINTS', post]]) {
    const d = drawnOf(v) ?? 0; const all = nonFooter(v);
    const claims = [...all.matchAll(/([\d,]+) archived in window/gi)].map(m => num(m[1]));
    asserts.push(A(`${when}: no "archived in window" count other than the points actually in the 12 h window`, claims.every(n => n === d), { claims, drawn: d, indexWholeDaySum: indexSum, flashes: v.caps.flashes }));
  }
  verdict('T11', 'Sub-day (12H) caption never calls whole-day index counts "archived in window"', asserts);
});
await runTest('T12', async () => {
  if (!BULK) BULK = await T11_12();
  const { post, promised, gesture: g, reqBytes, shards } = BULK; const d = drawnOf(post);
  verdict('T12', 'LOAD POINTS respects the promised cap and the 32 MB budget', [
    A('LOAD POINTS offered and accepted', g.ok, g),
    A(`drawn count after consent <= promised ${NF(promised)}`, d !== null && d <= promised, { drawn: d, status: post.status, flashes: post.caps.flashes }),
    A('declared bytes of shards fetched after consent <= 32,000,000', reqBytes <= 32e6, { reqBytes, shards }),
  ]);
});

// ------------------------------------------------------------------ T13 invariants across every case above
await runTest('T13', async () => {
  if (!invRecords.length) { const c = await boot('T13-invariants-only', { data: join(LEADFIX, 'lightning-archive', 'data') }); markFirstOn(c); await on(c); await finish(c); }
  verdict('T13', 'menuBar.inspect() {60,3,63,63,true}, 63 proxies, 63 markers before/after every case; zero lightning requests while OFF',
    invRecords.map(r => A(`${r.case}: invariants before/after, 0 requests before first ON, 0 requests in 11 min after OFF`, r.ok, { before: r.before, after: r.after, requestsBeforeFirstOn: r.requestsBeforeFirstOn, whileOff: r.requestsWhileOffAfter11min, checkedAfterOff: r.checkedAfterOff, off: r.offGesture })));
});

await browser.close();
RUN.finishedAt = new Date().toISOString();
await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 2));
const table = Object.entries(RUN.tests).map(([k, v]) => `${k}\t${v.result}\t${v.seconds ?? ''}s\t${v.title || ''}`).join('\n');
await writeFile(join(OUT, 'summary.tsv'), table + '\n');
console.log('\n' + table + '\nout: ' + OUT);
process.exit(Object.values(RUN.tests).every(t => t.result === 'PASS') ? 0 : 1);
