// browser-repro-c.mjs — overlay-code-review scenario C/D: SYNTHETIC hostile timestamp strings reaching cp()
// (overlay lines 102 and 107). Same harness as browser-repro.mjs (lead-shim, Chromium, 1440x900, fake clock).
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const port = process.argv[2] || '8146';
const ROUTE = `http://127.0.0.1:${port}/wt/atlas/v/202610261949/`;
const HERE = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/overlay-code-review';
const OUT = join(HERE, 'browser-out');
const FAKE_NOW = '2026-10-26T18:40:00Z';
const G = '[data-lightning-group="main"]';
const sel = { toggle: `${G} input[data-lightning-control="toggle"]`, chip: p => `${G} button[data-lightning-period="${p}"]`, nav: n => `${G} button[data-lightning-nav="${n}"]` };
const S = { G, label: `${G} [data-lightning-label]`, status: `${G} .status-dot`, custom: `${G} [data-lightning-custom]` };
const report = { route: ROUTE, harness: 'lead-shim', viewport: '1440x900', browser: null, scenarios: {} };
const browser = await chromium.launch(); report.browser = browser.version();

async function newPage(dataDir) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const log = { pageErrors: [], lightningRequests: [] };
  page.on('pageerror', e => log.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('request', r => { const u = r.url(); if (u.includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightningRequests.push(u.replace(/^.*\/data\//, 'data/')); });
  await page.clock.install({ time: FAKE_NOW });
  const shim = await installOfflineShim(page, { lightningDataDir: dataDir });
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
  await page.waitForSelector(G, { timeout: 30000 });
  return { ctx, page, log, shim, comp };
}
const snap = (page) => page.evaluate((s) => {
  const q = x => document.querySelector(x); const t = x => (q(x) ? q(x).textContent : null);
  const L = window.__GRIDATLAS_MODULES__.ukLightning; const map = window.__GRIDATLAS_V9_MAP__;
  const caps = {}; for (const k of ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning']) caps[k] = t(`${s.G} [data-cap="${k}"]`);
  const src = map && map.getSource('gridatlas-lightning');
  return { label: t(s.label), status: t(s.status), period: L.state.period, on: L.state.on, activeChip: (q(`${s.G} button.active`) || {}).textContent || null,
    dot: q(`${s.G} [data-lightning-dot]`).style.background, caps, requests: L.state.requests, errors: L.state.errors.slice(-3), last: L.state.last,
    source: !!src, layerVisibility: map && map.getLayer('l-gridatlas-lightning') ? map.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null,
    resMode: L.state.res ? L.state.res.mode : null, resEvents: L.state.res ? L.state.res.ev.length : null };
}, S);
const shot = (page, name) => page.locator(G).screenshot({ path: join(OUT, name) }).catch(() => null);

{ // C: index row 21 Oct first_observation_utc = "not-a-date" -> overview caption path (line 107)
  const sc = report.scenarios.C_hostile_index_first_obs = { fixture: 'SYNTHETIC-hostile-index-first-obs', steps: [] };
  const { ctx, page, log, comp } = await newPage(join(HERE, 'fixtures', 'SYNTHETIC-hostile-index-first-obs'));
  sc.composition = comp;
  await page.click(sel.toggle); await page.waitForTimeout(2500);
  sc.steps.push({ step: 'ON 24h (detail path; line 107 not reached)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await page.click(sel.chip('12m')); await page.waitForTimeout(2500);
  sc.steps.push({ step: '12M clicked (overview -> line 107)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await shot(page, 'C1-12m-hostile-first-obs.png');
  let clockErr = null; try { await page.clock.runFor(600_000); } catch (e) { clockErr = String(e.message || e).split('\n').slice(0, 9).join(' | '); } await page.waitForTimeout(2000);
  sc.steps.push({ step: '+10 min timer', clockError: clockErr, ...await snap(page), pageErrors: log.pageErrors.slice() });
  await page.click(sel.chip('7d')); await page.waitForTimeout(2500);
  sc.steps.push({ step: '7D clicked (does the UI recover?)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await shot(page, 'C2-after-7d-click.png');
  await page.click(sel.toggle); await page.waitForTimeout(300);
  await page.click(sel.toggle); await page.waitForTimeout(2500);
  sc.steps.push({ step: 'OFF then ON (recovery via toggle)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  sc.lightningRequests = log.lightningRequests; sc.pageErrors = log.pageErrors;
  await ctx.close();
}
{ // D: feed metadata query_end_utc = "not-a-date" -> feed caption path (line 102)
  const sc = report.scenarios.D_hostile_feed_query_end = { fixture: 'SYNTHETIC-hostile-feed-query-end (no index)', steps: [] };
  const { ctx, page, log, comp } = await newPage(join(HERE, 'fixtures', 'SYNTHETIC-hostile-feed-query-end'));
  sc.composition = comp;
  await page.click(sel.toggle); await page.waitForTimeout(3000);
  sc.steps.push({ step: 'ON 24h (feed fallback -> line 102)', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await shot(page, 'D1-feed-hostile-query-end.png');
  await page.click(sel.chip('7d')).catch(e => sc.steps.push({ step: '7D click error', error: String(e).slice(0, 200) })); await page.waitForTimeout(2500);
  sc.steps.push({ step: '7D clicked', ...await snap(page), pageErrors: log.pageErrors.slice() });
  await page.click(sel.toggle); await page.waitForTimeout(300);
  sc.steps.push({ step: 'OFF', ...await snap(page), pageErrors: log.pageErrors.slice() });
  sc.lightningRequests = log.lightningRequests; sc.pageErrors = log.pageErrors;
  await ctx.close();
}
await browser.close();
await writeFile(join(OUT, 'browser-repro-c.json'), JSON.stringify(report, null, 2));
for (const [n, sc] of Object.entries(report.scenarios)) {
  console.log('=====', n, sc.fixture);
  for (const st of sc.steps) { console.log('--', st.step); for (const k of ['label', 'status', 'activeChip', 'dot', 'resMode', 'resEvents', 'source', 'layerVisibility', 'requests']) if (k in st) console.log('  ', k, '=', st[k]); if (st.caps) for (const [a, b] of Object.entries(st.caps)) if (b) console.log('   cap.' + a + ':', b.slice(0, 200)); if (st.pageErrors && st.pageErrors.length) console.log('   pageErrors:', st.pageErrors); if (st.clockError) console.log('   clockError:', st.clockError); if (st.errors && st.errors.length) console.log('   S.errors:', st.errors); }
  console.log(' requests:', sc.lightningRequests);
}
