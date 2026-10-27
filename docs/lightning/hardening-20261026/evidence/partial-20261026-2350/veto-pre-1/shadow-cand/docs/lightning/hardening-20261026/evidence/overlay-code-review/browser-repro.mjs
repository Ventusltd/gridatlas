// browser-repro.mjs — overlay-code-review: confirm reading-derived defects with REAL clicks against the
// UNMODIFIED candidate (generation 202610261949, SHA fda6b10f). Harness: lead-shim (offline-shim.mjs) with
// the lead's fixtures or the labelled SYNTHETIC fixture in ./fixtures. Chromium (Playwright 1.63), 1440x900.
// usage: node browser-repro.mjs <port>   (server: python3 -m http.server <port> --directory <hardening dir>)
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const port = process.argv[2] || '8146';
const ROUTE = `http://127.0.0.1:${port}/wt/atlas/v/202610261949/`;
const FIX = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures';
const HERE = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/overlay-code-review';
const OUT = join(HERE, 'browser-out');
await mkdir(OUT, { recursive: true });
const FAKE_NOW = '2026-10-26T18:40:00Z'; // fixtures were built 18:37:03Z; README recommends a fake clock near that
const report = { route: ROUTE, harness: 'lead-shim', viewport: '1440x900', browser: null, scenarios: {} };

const browser = await chromium.launch();
report.browser = browser.version();

const G = '[data-lightning-group="main"]';
const sel = {
  toggle: `${G} input[data-lightning-control="toggle"]`,
  label: `${G} [data-lightning-label]`,
  chip: p => `${G} button[data-lightning-period="${p}"]`,
  nav: n => `${G} button[data-lightning-nav="${n}"]`,
  status: `${G} .status-dot`,
  cap: k => `${G} [data-cap="${k}"]`,
  custom: `${G} [data-lightning-custom]`,
};

async function newPage({ dataDir, clock, indexDelayMs }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const log = { pageErrors: [], consoleErrors: [], lightningRequests: [] };
  page.on('pageerror', e => log.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') log.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('request', r => { const u = r.url(); if (u.includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightningRequests.push(u.replace(/^.*\/data\//, 'data/')); });
  if (clock) await page.clock.install({ time: clock });
  const shim = await installOfflineShim(page, { lightningDataDir: dataDir });
  if (indexDelayMs) {
    // registered after the shim, so it runs first; delay then hand over to the shim's file answer
    await page.route(u => u.pathname.endsWith('/data/history/index.json'), async route => {
      await new Promise(r => setTimeout(r, indexDelayMs)); await route.fallback();
    });
  }
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
  await page.waitForSelector(G, { timeout: 30000 });
  return { ctx, page, log, shim, comp };
}
// read() above cannot pass functions; build a plain selector table instead
const S = { G, label: sel.label, status: sel.status, custom: sel.custom };
const snap = (page) => page.evaluate((s) => {
  const q = x => document.querySelector(x);
  const t = x => (q(x) ? q(x).textContent : null);
  const L = window.__GRIDATLAS_MODULES__.ukLightning;
  const map = window.__GRIDATLAS_V9_MAP__;
  const caps = {}; for (const k of ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning', 'footer']) caps[k] = t(`${s.G} [data-cap="${k}"]`);
  return {
    label: t(s.label), status: t(s.status), period: L.state.period, on: L.state.on,
    activeChip: (q(`${s.G} button.active`) || {}).textContent || null,
    customDisplay: q(s.custom) ? getComputedStyle(q(s.custom)).display : null,
    prevDisabled: q(`${s.G} button[data-lightning-nav="prev"]`).disabled,
    caps, requests: L.state.requests, errors: L.state.errors.slice(-5), last: L.state.last, timer: !!L.state.timer,
    source: !!(map && map.getSource('gridatlas-lightning')), layer: !!(map && map.getLayer('l-gridatlas-lightning')),
    bridge: window.__GRIDATLAS_MAP_READY__ ? { intercepted: window.__GRIDATLAS_MAP_READY__.intercepted_on_demand, failures: (window.__GRIDATLAS_MAP_READY__.failures || []).length } : null,
    ariaPressed: [...document.querySelectorAll(`${s.G} button[data-lightning-period]`)].filter(b => b.hasAttribute('aria-pressed')).length,
    groupAriaLabel: q(`${s.G} [role="group"]`) ? q(`${s.G} [role="group"]`).getAttribute('aria-label') : 'no role=group',
    menuAriaLabel: q('[data-lightning-group="menu"] input') ? q('[data-lightning-group="menu"] input').getAttribute('aria-label') : null,
    menuName: t('[data-lightning-group="menu"] .gm-layer-name'),
    checked: [...document.querySelectorAll('input[data-lightning-control="toggle"]')].map(i => i.checked),
  };
}, S);
const shot = (page, name) => page.locator(G).screenshot({ path: join(OUT, name) }).catch(() => null);

// ---------------------------------------------------------------- Scenario A: good archive, slow index --
{
  const sc = report.scenarios.A_custom_during_loading = { fixture: 'lead lightning-archive (genuine), index.json delayed 6000 ms', steps: [] };
  const { ctx, page, log, shim, comp } = await newPage({ dataDir: join(FIX, 'lightning-archive', 'data'), clock: FAKE_NOW, indexDelayMs: 6000 });
  sc.composition = comp;
  sc.steps.push({ step: 'OFF at rest', ...await snap(page) });
  await page.click(sel.toggle);                       // real click: ON
  await page.waitForTimeout(200);
  sc.steps.push({ step: 'ON, loading (index delayed)', ...await snap(page) });
  await page.click(sel.chip('custom'));               // real click during the first load
  await page.waitForTimeout(300);
  sc.steps.push({ step: 'CUSTOM clicked during first load', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await shot(page, 'A1-custom-during-loading.png');
  await page.waitForTimeout(7500);                     // let the delayed 24h load land
  sc.steps.push({ step: '24h result landed while CUSTOM chip active', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await shot(page, 'A2-24h-caption-under-custom-chip.png');
  await page.click(sel.nav('apply'));                  // APPLY today/today
  await page.waitForTimeout(2500);
  sc.steps.push({ step: 'APPLY (today..today)', ...await snap(page) });
  // OFF -> ON reuses the cached index (no second index.json request)
  const reqBefore = log.lightningRequests.length;
  await page.click(sel.toggle); await page.waitForTimeout(300);
  sc.steps.push({ step: 'OFF', ...await snap(page) });
  await page.click(sel.toggle); await page.waitForTimeout(2500);
  const s2 = await snap(page);
  sc.steps.push({ step: 'ON again', ...s2, newRequestsSinceOff: log.lightningRequests.slice(reqBefore) });
  sc.lightningRequests = log.lightningRequests; sc.pageErrors = log.pageErrors; sc.consoleErrors = log.consoleErrors.slice(0, 10); sc.shim = shim.summary();
  await ctx.close();
}
// ------------------------------------------------- Scenario B: no index (production reality), fake clock --
{
  const sc = report.scenarios.B_feed_never_refreshed = { fixture: 'lead lightning-archive-no-index (genuine feed, no index.json)', steps: [] };
  const { ctx, page, log, shim, comp } = await newPage({ dataDir: join(FIX, 'lightning-archive-no-index', 'data'), clock: FAKE_NOW });
  sc.composition = comp;
  await page.click(sel.toggle); await page.waitForTimeout(2500);
  sc.steps.push({ step: 'ON 24h (feed fallback)', ...await snap(page), requestsSoFar: log.lightningRequests.slice() });
  await page.click(sel.chip('7d')); await page.waitForTimeout(2500);
  sc.steps.push({ step: '7D', ...await snap(page), requestsSoFar: log.lightningRequests.slice() });
  await shot(page, 'B1-feed-7d.png');
  // advance the fake clock by 10 minutes twice: the refresh timer fires ld(true)
  for (let i = 1; i <= 2; i++) {
    await page.clock.runFor(600_000); await page.waitForTimeout(2500);
    sc.steps.push({ step: `after +${i * 10} min (timer)`, ...await snap(page), requestsSoFar: log.lightningRequests.slice() });
  }
  // the feed is now ~5h40m older than the fake clock (query_end 13:05Z vs 18:40Z + 20 min): is STALE shown?
  await shot(page, 'B2-feed-after-20min.png');
  // PREV in feed mode: 48h, PREV x3 -> third press leaves the 7-day feed -> FAIL instead of a clamp
  await page.click(sel.chip('48h')); await page.waitForTimeout(1500);
  for (let i = 1; i <= 3; i++) {
    const dis = await page.locator(sel.nav('prev')).isDisabled();
    if (dis) { sc.steps.push({ step: `PREV #${i} disabled`, ...await snap(page) }); break; }
    await page.click(sel.nav('prev')); await page.waitForTimeout(1500);
    sc.steps.push({ step: `PREV #${i}`, ...await snap(page) });
  }
  await shot(page, 'B3-feed-48h-prev3.png');
  sc.lightningRequests = log.lightningRequests; sc.pageErrors = log.pageErrors; sc.shim = shim.summary();
  await ctx.close();
}
// ------------------------------------------ Scenario C: SYNTHETIC hostile first_observation_utc, overview --
{
  const sc = report.scenarios.C_hostile_observation_utc = { fixture: 'SYNTHETIC-hostile-observation-utc (see fixtures/README.md)', steps: [] };
  const { ctx, page, log, shim, comp } = await newPage({ dataDir: join(HERE, 'fixtures', 'SYNTHETIC-hostile-observation-utc'), clock: FAKE_NOW });
  sc.composition = comp;
  await page.click(sel.toggle); await page.waitForTimeout(2500);
  sc.steps.push({ step: 'ON 24h (detail; row 23 Oct not in the caption path)', ...await snap(page) });
  await page.click(sel.chip('12m')); await page.waitForTimeout(2500);
  sc.steps.push({ step: '12M (overview uses first_observation_utc)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await shot(page, 'C1-12m-paint-crash.png');
  await page.clock.runFor(600_000); await page.waitForTimeout(2000);
  sc.steps.push({ step: 'after +10 min timer', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await page.click(sel.chip('24h')); await page.waitForTimeout(2500);
  sc.steps.push({ step: '24H clicked (recovery?)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await page.click(sel.toggle); await page.waitForTimeout(300);
  sc.steps.push({ step: 'OFF', ...await snap(page) });
  sc.lightningRequests = log.lightningRequests; sc.pageErrors = log.pageErrors; sc.shim = shim.summary();
  await ctx.close();
}
await browser.close();
await writeFile(join(OUT, 'browser-repro.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1).slice(0, 20000));
