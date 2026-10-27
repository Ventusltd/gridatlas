// strings.mjs — veto-pre-3: render every user-visible string of uk-lightning-overlay 202610262323 under the lead shim.
// Harness: lead-shim (offline-shim.mjs, unmodified) + python http.server on 8172 serving hardening/ (started by the caller).
// Real gestures only (locator.click / fill). Fake clock 2026-10-26T18:40:00Z (fixtures built 18:37:03Z).
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { boot, snap, clickToggle, clickChip, clickNav, applyCustom, settle, EV, realDir, copyReal, writeFixture, readJSON, FEED, SYN } from './lib.mjs';

const CLOCK = '2026-10-26T18:40:00Z';
// ---- synthetic fixtures (labelled) ----
const realFeed = readJSON(path.join(realDir('lightning-archive'), 'uk_lightning.geojson'));
const meta = { ...realFeed.metadata, fixture_note: SYN };
const fx = {};
fx.feedEmpty = writeFixture('feed-empty-noindex', { 'uk_lightning.geojson': { type: 'FeatureCollection', metadata: { ...meta, total_before_display_cap: 0 }, features: [] } });
const f0 = realFeed.features.slice(-2);
const paris = JSON.parse(JSON.stringify(f0[0])); paris.id = 'synthetic-paris'; paris.geometry.coordinates = [2.35, 48.85];
const notime = JSON.parse(JSON.stringify(f0[1])); notime.id = 'synthetic-notime'; delete notime.properties.time_utc;
fx.feedMixed = writeFixture('feed-outofbox-noindex', { 'uk_lightning.geojson': { type: 'FeatureCollection', metadata: meta, features: [...f0, paris, notime] } });
fx.noFeed = copyReal('no-index-no-feed', 'lightning-archive-no-index', { 'uk_lightning.geojson': null });
const idx = readJSON(path.join(realDir('lightning-archive'), 'history/index.json'));
const idxNoSw = { ...idx, fixture_note: SYN }; delete idxNoSw.scan_windows;
fx.noScanWindows = copyReal('index-without-scan-windows', 'lightning-archive', { 'history/index.json': JSON.stringify(idxNoSw) });

const R = realDir;
const feed500 = async page => page.route(FEED, r => r.fulfill({ status: 500, body: 'synthetic 500', headers: { 'access-control-allow-origin': '*' } }));

const CASES = [
  { id: 'S01-off', dir: R('lightning-archive'), steps: [] },
  { id: 'S02-good-24h', dir: R('lightning-archive'), steps: ['on'] },
  { id: 'S03-good-7d', dir: R('lightning-archive'), steps: ['on', '7d'] },
  { id: 'S04-good-30d', dir: R('lightning-archive'), steps: ['on', '30d'] },
  { id: 'S05-good-12m', dir: R('lightning-archive'), steps: ['on', '12m'] },
  { id: 'S06-good-custom-23Oct', dir: R('lightning-archive'), steps: ['on', ['custom', '2026-10-23', '2026-10-23']] },
  { id: 'S07-good-custom-Sep1-3-unsearched', dir: R('lightning-archive'), steps: ['on', ['custom', '2026-09-01', '2026-09-03']] },
  { id: 'S08-good-custom-Jan-Mar-unsearched', dir: R('lightning-archive'), steps: ['on', ['custom', '2026-01-01', '2026-03-31']] },
  { id: 'S09-good-custom-before-archive', dir: R('lightning-archive'), steps: ['on', ['custom', '2025-01-01', '2025-01-05']] },
  { id: 'S10-good-custom-clamped', dir: R('lightning-archive'), steps: ['on', ['custom', '2025-10-01', '2025-10-30']] },
  { id: 'S11-good-custom-bad-dates', dir: R('lightning-archive'), steps: ['on', ['custom', '2026-10-25', '2026-10-21']] },
  { id: 'S12-good-7d-prev', dir: R('lightning-archive'), steps: ['on', '7d', 'prev'] },
  { id: 'S13-noindex-24h', dir: R('lightning-archive-no-index'), steps: ['on'] },
  { id: 'S14-noindex-7d', dir: R('lightning-archive-no-index'), steps: ['on', '7d'] },
  { id: 'S15-noindex-30d', dir: R('lightning-archive-no-index'), steps: ['on', '30d'] },
  { id: 'S16-brokenjson-7d', dir: R('lightning-archive-broken-json'), steps: ['on', '7d'] },
  { id: 'S17-missingshard-7d', dir: R('lightning-archive-missing-shard'), steps: ['on', '7d'] },
  { id: 'S18-stale-7d', dir: R('lightning-archive-stale'), steps: ['on', '7d'] },
  { id: 'S19-bigcount-30d', dir: R('lightning-archive-big-count'), steps: ['on', '30d'] },
  { id: 'S20-bigcount-30d-loadpoints', dir: R('lightning-archive-big-count'), steps: ['on', '30d', 'points'] },
  { id: 'S21-SYN-feed-empty-7d', dir: fx.feedEmpty, steps: ['on', '7d'] },
  { id: 'S22-SYN-feed-outofbox-7d', dir: fx.feedMixed, steps: ['on', '7d'] },
  { id: 'S23-SYN-noindex-feed404', dir: fx.noFeed, steps: ['on'] },
  { id: 'S24-SYN-noindex-feed500', dir: R('lightning-archive-no-index'), before: feed500, steps: ['on'] },
  { id: 'S25-SYN-index-no-scan-windows-7d', dir: fx.noScanWindows, steps: ['on', '7d'] },
  { id: 'S26-good-7d-phone', dir: R('lightning-archive'), phone: true, viewport: { width: 390, height: 844 }, steps: ['on', '7d'] },
  { id: 'S27-good-7d-then-off', dir: R('lightning-archive'), steps: ['on', '7d', 'on'] },
];

const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const LA={args:['--disable-dev-shm-usage','--disable-gpu']};const v0=await chromium.launch(LA);const out = { harness: 'lead-shim + python http.server :8172', chromium: v0.version(), clock: CLOCK, started: new Date().toISOString(), cases: {} }; await v0.close();
for (const c of CASES) {
  if (only && !only.test(c.id)) continue;
  let b; const browser = await chromium.launch(LA);
  try {
    b = await boot({ browser, fixtureDir: c.dir, clock: CLOCK, phone: c.phone, viewport: c.viewport, before: c.before });
    const { page } = b; const trail = [];
    for (const s of c.steps) {
      if (s === 'on') await clickToggle(page, c.phone);
      else if (Array.isArray(s)) await applyCustom(page, s[1], s[2]);
      else if (['prev', 'next', 'latest', 'points'].includes(s)) await clickNav(page, s);
      else await clickChip(page, s);
      await settle(page);
      const x = await snap(page); trail.push({ step: s, label: x.label.main, status: x.stateLine });
    }
    const x = await snap(page);
    const fsCaps = await page.evaluate(() => { const c = document.querySelector('#gridatlas-lightning-caption-fs'); return c ? [...c.querySelectorAll('[data-cap]')].map(n => n.textContent) : null; });
    const title = await page.evaluate(() => document.querySelector('#scada-ui-container [data-lightning-group="main"] .key-title')?.textContent);
    const buttons = await page.evaluate(() => [...document.querySelectorAll('#scada-ui-container [data-lightning-group="main"] button')].filter(b => !b.hidden).map(b => b.textContent));
    await page.screenshot({ path: path.join(EV, 'shots', c.id + '.png') }).catch(() => { });
    out.cases[c.id] = { fixture: c.dir, viewport: c.viewport || { width: 1440, height: 900 }, phone: !!c.phone, title, label: x.label, status: x.stateLine, caption: x.caption, fsCaptionEqual: JSON.stringify(fsCaps) === JSON.stringify(x.caption), buttons, last: x.S && x.S.last, errors: x.S && x.S.errors, drawn: x.map.features, firstTime: x.map.firstTime, lastTime: x.map.lastTime, trail, pageErrors: b.rec.pageErrors, now: x.now };
    console.log('\n## ' + c.id + '\nLABEL  ' + x.label.main + '\nSTATUS ' + x.stateLine + '\n' + (x.caption || []).map((t, i) => ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning', 'footer'][i] + ': ' + t).join('\n'));
  } catch (e) { out.cases[c.id] = { error: String(e && e.stack || e).slice(0, 800) }; console.log('## ' + c.id + ' ERROR ' + e); }
  finally { if (b) await b.ctx.close().catch(() => { }); await browser.close().catch(() => { }); }
}
out.finished = new Date().toISOString();
fs.writeFileSync(path.join(EV, only ? 'strings-partial.json' : 'strings.json'), JSON.stringify(out, null, 1));
