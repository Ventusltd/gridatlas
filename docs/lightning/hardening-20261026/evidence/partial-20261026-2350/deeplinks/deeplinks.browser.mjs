// deeplinks.browser.mjs — lane "deeplinks", issue #32 final push.
// Harness: lead-shim (../../../lightning/harness/offline-shim.mjs), Chromium headless via Playwright from the
// production clone's node_modules. Real gestures only (locator.click / tap), never force:true.
// Baseline route  : http://127.0.0.1:8182/gridatlas/atlas/            (serves /home/claude read-only; live gen 202609241334)
// Candidate route : http://127.0.0.1:8181/wt/atlas/v/202610262323/    (serves hardening/)
// Every case runs the same steps on both routes and records a normalised snapshot of all URL / history / storage
// state plus deep-link observables; compare.mjs diffs them.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'runs', new Date().toISOString().replace(/[-:]/g, '').slice(0, 15));
await mkdir(OUT, { recursive: true });
const ROUTES = {
  baseline: 'http://127.0.0.1:8182/gridatlas/atlas/',
  candidate: 'http://127.0.0.1:8181/wt/atlas/v/202610262323/',
};
const ONLY_ROUTE = process.argv.includes('--candidate-only') ? ['candidate'] : Object.keys(ROUTES);
const LDATA = join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data');
const FAKE_NOW = '2026-10-26T18:40:00Z';
const G = '#scada-ui-container [data-lightning-group="main"]';
const TOGGLE = `${G} input[data-lightning-control="toggle"]`;
const PROFILES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  p393: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1' },
};

// Deep links taken from the original receivers (engine 799-855, place-global-search 671-698, sld-sandbox 6322-6387,
// 6598, 8324-8365, substation-intelligence 853-924/6203).
const LINKS = {
  plain: '',
  place: '?longitude=-1.4701&latitude=53.3811&zoom=11',
  project: '?project=Deep%20link%20test&technology=solar&capacity_mw=49.9&longitude=-2.0&latitude=52.5&status=Operational',
  repd: '?repd_ref=1234&technology=solar&longitude=-1.2&latitude=52.9',
  repdOnly: '?repd_ref=ABC-77',
  layerTech: '?technology=wind_onshore&repd_ref=99999&longitude=-3.5&latitude=56.1',
  interconnector: '?interconnector=INTNED&technology=interconnector&anchor=gb',
  interconnectorNoCode: '?technology=interconnector',
  hash: '?longitude=-0.12&latitude=51.5&zoom=9#layers',
  hostile: '?lightning=on&uk_lightning=1&period=7d&layer=lightning#lightning',
};

const browser = await chromium.launch({ headless: true });
const RUN = { harness: 'lead-shim; Chromium ' + browser.version() + ' headless; phone = Chromium emulation (not WebKit)', fakeNow: FAKE_NOW, routes: ROUTES, cases: {} };

async function ctxFor(profile = 'desktop') {
  const ctx = await browser.newContext({ ...PROFILES[profile], locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  return ctx;
}
async function newPage(ctx, log) {
  const page = await ctx.newPage();
  await page.clock.install({ time: FAKE_NOW });
  page.on('pageerror', e => log.pageErrors.push(String(e && e.message || e).slice(0, 200)));
  page.on('request', r => { if (r.url().includes('raw.githubusercontent.com/Ventusltd/lightning')) log.lightningReqs.push(r.url().replace(/^.*\/data\//, '')); });
  page.on('framenavigated', f => { if (f === page.mainFrame()) log.navs.push(f.url()); });
  const shim = await installOfflineShim(page, { lightningDataDir: LDATA });
  return { page, shim };
}
async function settle(page) {
  await waitForComposition(page, { deadlineMs: 90000, settleMs: 1500 });
  // wait until the map stops moving (deep-link flyTo is ~1.8 s), bounded
  for (let i = 0; i < 40; i++) {
    const moving = await page.evaluate(() => { const m = window.__GRIDATLAS_V9_MAP__; return !!(m && m.isMoving && m.isMoving()); }).catch(() => false);
    if (!moving) break; await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
}
const snap = (page, route, label) => page.evaluate(({ route, label }) => {
  const prefix = new URL(route).pathname;
  const pick = (o, keys) => { const r = {}; if (!o) return null; for (const k of keys) { try { const v = o[k]; r[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v, (kk, vv) => /epoch|_at$|time|ms$|started|elapsed/i.test(kk) ? undefined : vv)) : v; } catch (_) { r[k] = 'unserialisable'; } } return r; };
  const ls = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); } } catch (e) { ls.__error = String(e); }
  const ss = {}; try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage.getItem(k); } } catch (e) { ss.__error = String(e); }
  const m = window.__GRIDATLAS_V9_MAP__;
  let map = null;
  try { const c = m.getCenter(); map = { lng: +c.lng.toFixed(3), lat: +c.lat.toFixed(3), zoom: +m.getZoom().toFixed(2), sources: Object.keys(m.getStyle().sources).sort(), layers: m.getStyle().layers.map(l => l.id), visible: m.getStyle().layers.filter(l => (l.layout || {}).visibility !== 'none').map(l => l.id) }; } catch (e) { map = { error: String(e) }; }
  const lt = document.querySelector('#scada-ui-container [data-lightning-group="main"] input[data-lightning-control="toggle"]');
  return {
    label,
    path: location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : 'OUTSIDE:' + location.pathname,
    search: location.search, hash: location.hash, historyLength: history.length,
    historyState: (() => { try { return JSON.stringify(history.state); } catch (_) { return 'unserialisable'; } })(),
    localStorage: ls, sessionStorage: ss, cookie: document.cookie, windowName: window.name,
    map,
    engineChecked: [...document.querySelectorAll('input[data-layer-id]')].filter(i => i.checked).map(i => i.dataset.layerId).sort(),
    pnChecked: [...document.querySelectorAll('input[data-pn-layer]')].filter(i => i.checked).map(i => i.dataset.pnLayer).sort(),
    v8DeepLink: pick(window.__GRIDATLAS_V8_DEEP_LINK__, ['status', 'repd_ref', 'technology']),
    placeSearch: pick(window.__GRIDATLAS_PLACE_SEARCH__ && window.__GRIDATLAS_PLACE_SEARCH__.deep_link, ['status', 'repd_ref', 'resolved', 'mapped', 'name', 'technology', 'capacity_mw', 'longitude', 'latitude', 'supplied_status', 'identity_source']),
    neon: pick(window.__GRIDATLAS_NEON_LINKS__, ['origin_source', 'declared_connection_framed']),
    neonReconciliation: pick(window.__GRIDATLAS_NEON_LINKS__ && window.__GRIDATLAS_NEON_LINKS__.arrival_reconciliation, ['status', 'reason']),
    interconnectorArrival: pick(window.__GRIDATLAS_INTERCONNECTORS__ && window.__GRIDATLAS_INTERCONNECTORS__.arrival, ['requested', 'anchor', 'status']),
    lightning: lt ? { present: true, checked: lt.checked, sourcePresent: !!(m && m.getSource && m.getSource('gridatlas-lightning')), layerPresent: !!(m && m.getLayer && m.getLayer('l-gridatlas-lightning')), moduleOn: !!(window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.ukLightning && (window.__GRIDATLAS_MODULES__.ukLightning.state || window.__GRIDATLAS_MODULES__.ukLightning).on) } : { present: false },
  };
}, { route, label });

async function toggleLightning(page, phone) {
  const l = page.locator(TOGGLE).first();
  await l.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  if (phone) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 });
  await page.waitForTimeout(2500);
}

async function runCase(name, steps, { profile = 'desktop' } = {}) {
  RUN.cases[name] = {};
  for (const rk of ONLY_ROUTE) {
    const route = ROUTES[rk];
    let log; const crashes = [];
    const t0 = Date.now();
    // The sandbox is shared with other lanes; the kernel memcg OOM-killer has killed renderers mid-case
    // (dmesg: "Memory cgroup out of memory: Killed process ... chrome-headless"). A renderer crash is a harness
    // event, not a page result: retry the whole case from a fresh context up to 3 times and record every crash.
    for (let attempt = 1; attempt <= 4; attempt++) {
      log = { pageErrors: [], lightningReqs: [], navs: [], snaps: [], notes: [], attempt };
      const ctx = await ctxFor(profile);
      try {
        const { page, shim } = await newPage(ctx, log);
        await steps({ ctx, page, route, rk, log, phone: profile !== 'desktop', S: async label => { const s = await snap(page, route, label); log.snaps.push(s); return s; } });
        log.shim = shim.summary();
      } catch (e) { log.error = String(e.stack || e).slice(0, 600); }
      await ctx.close().catch(() => {});
      if (log.error && /crash|Target (page, context or browser )?(has been )?closed/i.test(log.error) && attempt < 4) { crashes.push(log.error.split('\n')[0]); await new Promise(r => setTimeout(r, 5000)); continue; }
      break;
    }
    log.harnessCrashesRetried = crashes;
    log.seconds = Math.round((Date.now() - t0) / 1000);
    RUN.cases[name][rk] = log;
    console.log(`${name} ${rk} ${log.error ? 'ERROR ' + log.error.split('\n')[0] : 'ok'} ${log.seconds}s`);
    await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 2));
  }
}

// Each deep link: load -> snapshot -> (candidate only) lightning ON -> snapshot -> lightning OFF -> snapshot ->
// copy href while ON was applied (shared-URL ON) -> reload -> snapshot (expect lightning OFF, deep link reapplied).
for (const [k, q] of Object.entries(LINKS)) {
  await runCase(`DL-${k}`, async ({ page, route, rk, log, S, phone }) => {
    await page.goto(route + q, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(page);
    await S('load');
    if (rk === 'candidate') {
      await toggleLightning(page, phone);
      const on = await S('lightning-on');
      log.sharedUrlWhileOn = on.search + on.hash;
      await toggleLightning(page, phone);
      await S('lightning-off-again');
      await toggleLightning(page, phone); // leave ON before reload
      await S('lightning-on-before-reload');
    } else {
      await page.waitForTimeout(7500); // same wall time as the three toggles, so map/arrival settle equally
      await S('lightning-on'); await S('lightning-off-again'); await S('lightning-on-before-reload');
    }
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(page);
    await S('after-reload');
  });
}

// Shared URL: href copied while lightning is ON, opened in a FRESH browser context (new viewer); and with it OFF.
for (const [k, q] of Object.entries({ place: LINKS.place, repd: LINKS.repd, interconnector: LINKS.interconnector })) {
  await runCase(`SHARE-${k}`, async ({ ctx, page, route, rk, log, S, phone }) => {
    await page.goto(route + q, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(page);
    let hrefOff = page.url();
    if (rk === 'candidate') { await toggleLightning(page, phone); }
    else await page.waitForTimeout(2500);
    const hrefOn = page.url();
    log.hrefOff = hrefOff; log.hrefOn = hrefOn;
    await S('sharer');
    for (const [tag, href] of [['shared-on', hrefOn], ['shared-off', hrefOff]]) {
      const ctx2 = await ctxFor('desktop');
      const l2 = { pageErrors: [], lightningReqs: [], navs: [] };
      const { page: p2 } = await newPage(ctx2, l2);
      await p2.goto(href, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await settle(p2);
      const s = await snap(p2, route, tag); s.receiverLightningRequests = l2.lightningReqs.length; s.receiverPageErrors = l2.pageErrors;
      log.snaps.push(s);
      await ctx2.close();
    }
  });
}

// Back / forward across documents and same-document hash entries, with lightning toggled ON in between.
await runCase('HIST-back-forward', async ({ page, route, rk, log, S, phone }) => {
  await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('A-plain');
  await page.goto(route + LINKS.place, { waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('B-place');
  if (rk === 'candidate') await toggleLightning(page, phone); else await page.waitForTimeout(2500);
  await S('B-after-lightning-on');
  // same-document hash navigation (a user clicking an in-page #anchor or editing the hash)
  await page.evaluate(() => { location.hash = 'x1'; }); await page.waitForTimeout(800); await S('B#x1');
  await page.goto(route + LINKS.repd, { waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('C-repd');
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('back->B#x1');
  await page.goBack({ waitUntil: 'commit', timeout: 90000 }).catch(e => log.notes.push('back2 ' + e.message.split('\n')[0])); await page.waitForTimeout(1500); await S('back->B');
  await page.goBack({ waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('back->A');
  await page.goForward({ waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('fwd->B');
  await page.goForward({ waitUntil: 'commit', timeout: 90000 }).catch(e => log.notes.push('fwd2 ' + e.message.split('\n')[0])); await page.waitForTimeout(1500); await S('fwd->B#x1');
  await page.goForward({ waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('fwd->C');
});

// Original per-viewer storage contract: gridatlas.dash.collapsed (sld-sandbox dashCollapse), phone width, real taps.
await runCase('STORE-dash-collapsed-phone', async ({ page, route, rk, log, S, phone }) => {
  await page.goto(route + LINKS.place, { waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('load');
  const t = page.locator('#gridatlas-dash-toggle');
  const vis = await t.isVisible().catch(() => false); log.notes.push('dash toggle visible: ' + vis);
  if (vis) { await t.tap(); await page.waitForTimeout(700); await S('dash-tap-1'); await t.tap(); await page.waitForTimeout(700); await S('dash-tap-2'); }
  // ensure the Layers panel is open (same taps on both routes), then lightning ON on the candidate only
  const collapsed = await page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') === '1');
  log.notes.push('collapsed before lightning step: ' + collapsed);
  if (collapsed && vis) { await t.tap(); await page.waitForTimeout(700); }
  if (rk === 'candidate') await toggleLightning(page, true); else await page.waitForTimeout(2500);
  await S('lightning-on');
  if (vis) { await t.tap(); await page.waitForTimeout(700); }
  await S('pre-reload');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }); await settle(page); await S('after-reload');
}, { profile: 'p393' });

await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 2));
await browser.close();
console.log('OUT ' + OUT);
