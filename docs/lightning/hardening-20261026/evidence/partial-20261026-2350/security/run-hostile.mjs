// run-hostile.mjs — security lane. Harness: lead-shim (offline-shim.mjs), Chromium headless, desktop 1440x900, fake clock
// 2026-10-26T18:40:00Z, fixtures SYNTHETIC (./fixtures, built by build_hostile.py). Real locator.click() on the toggle.
// usage: node run-hostile.mjs --gen 202610262323 --port 8177 [--cases S1,S5]
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GEN = arg('gen', '202610262323'), PORT = arg('port', '8177');
const ROUTE = `http://127.0.0.1:${PORT}/wt/atlas/v/${GEN}/`;
const ALL = ['S0', 'S1', 'S2', 'S3', 'S4a', 'S4b', 'S4c', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S10b'];
const CASES = (arg('cases') || ALL.join(',')).split(',');
const DIRS = { S0: join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data') };
const fx = n => DIRS[n] || join(HERE, 'fixtures', { S1: 'S1-xss', S2: 'S2-xss-schema', S3: 'S3-proto', S4a: 'S4a-count-inf', S4b: 'S4b-count-types', S4c: 'S4c-extreme-header', S5: 'S5-parts-traversal', S6: 'S6-parts-flood', S7: 'S7-giant-index', S8: 'S8-scanwindow-spread', S9: 'S9-giant-feed', S10: 'S10-feed-coords-ids', S10b: 'S10b-feed-noid-only' }[n], 'data');
const OUT = join(HERE, 'runs', GEN); await mkdir(OUT, { recursive: true });
const G = '#scada-ui-container [data-lightning-group="main"]';
const browser = await chromium.launch({ headless: true });
const results = {};
const probe = page => page.evaluate((G) => {
  const g = document.querySelector(G), M = window.__GRIDATLAS_MODULES__, L = M && M.ukLightning, map = window.__GRIDATLAS_V9_MAP__;
  const caps = {}; if (g) g.querySelectorAll('[data-cap]').forEach(n => { caps[n.dataset.cap] = { len: n.textContent.length, text: n.textContent.slice(0, 400) } });
  let mapOk = null; try { const c = map.getCenter(); map.jumpTo({ center: [c.lng + 0.01, c.lat] }); mapOk = { center: map.getCenter().lng.toFixed(3), layers: map.getStyle().layers.length, lightningLayer: !!map.getLayer('l-gridatlas-lightning') }; } catch (e) { mapOk = 'ERR ' + e.message }
  let feats = null; try { const s = map.getSource('gridatlas-lightning'); feats = s && s._data && s._data.features ? s._data.features.length : null } catch (e) { }
  return {
    pwn: window.__PWN ?? null, protoPolluted: ({}).polluted ?? null, protoKeys: Object.keys(Object.prototype),
    injectedNodes: g ? g.querySelectorAll('img,svg,script,iframe').length : null, injectedDoc: document.querySelectorAll('img[src="x"],svg[onload]').length,
    label: g && g.querySelector('[data-lightning-label]').textContent, status: g && g.querySelector('.status-dot').textContent.slice(0, 300), caps,
    last: L && L.state.last, errors: L && L.state.errors.slice(-5).map(e => String(e).slice(0, 200)), requests: L && L.state.requests,
    inspect: M && M.menuBar && M.menuBar.inspect ? M.menuBar.inspect() : null, mapOk, sourceFeatures: feats
  };
}, G);
for (const name of CASES) {
  const t0 = Date.now(); const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  const page = await ctx.newPage(); const log = { pageErrors: [], dialogs: [], hosts: {}, offHostOrPath: [], lightningReq: 0, console: [] };
  page.on('pageerror', e => log.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('dialog', d => { log.dialogs.push(d.message()); d.dismiss().catch(() => { }) });
  page.on('request', r => { const u = new URL(r.url()); log.hosts[u.host] = (log.hosts[u.host] || 0) + 1;
    if (u.host === 'raw.githubusercontent.com') { log.lightningReq++; if (!u.pathname.startsWith('/Ventusltd/lightning/main/data/')) log.offHostOrPath.push(r.url()); }
    else if (!['127.0.0.1:' + PORT, 'cdn.jsdelivr.net', 'ventusltd.github.io', 'basemaps.cartocdn.com'].includes(u.host) && !/^(data|blob):/.test(r.url())) log.offHostOrPath.push(r.url()); });
  await page.clock.install({ time: '2026-10-26T18:40:00Z' });
  const shim = await installOfflineShim(page, { lightningDataDir: fx(name) });
  const R = { fixture: fx(name), harness: 'lead-shim, Chromium ' + browser.version() + ' headless, desktop 1440x900, SYNTHETIC fixture' };
  try {
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    R.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2000 });
    await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
    R.before = await probe(page); R.requestsBeforeOn = log.lightningReq;
    // real click; then poll with round-trip latency as a main-thread freeze meter
    const clickAt = Date.now(); await page.locator(`${G} input[data-lightning-control="toggle"]`).click({ timeout: 15000 });
    let maxRtt = 0, settled = null; const lim = +(arg('settle', '60')) * 1000;
    while (Date.now() - clickAt < lim) { const a = Date.now(); const st = await page.evaluate(G => { const g = document.querySelector(G); return g.querySelector('.status-dot').textContent }, G); maxRtt = Math.max(maxRtt, Date.now() - a);
      if (st !== 'LOADING' && !/LOADING/.test(st)) { settled = Date.now() - clickAt; break } await new Promise(z => setTimeout(z, 100)) }
    R.settledMs = settled; R.maxMainThreadRttMs = maxRtt;
    R.after = await probe(page); R.lightningRequestsWhileOn = log.lightningReq;
    // OFF by real click; any request after OFF is a leak
    try { await page.locator(`${G} input[data-lightning-control="toggle"]`).click({ timeout: 30000 }); R.offClick = 'ok' } catch (e) { R.offClick = String(e.message).split('\n').slice(0, 6).join(' | ').slice(0, 600) } const n0 = log.lightningReq; await page.waitForTimeout(8000);
    R.requestsAfterOff8s = log.lightningReq - n0; R.off = await probe(page);
  } catch (e) { R.error = String(e.message || e).split('\n')[0].slice(0, 300) }
  R.pageErrors = log.pageErrors; R.dialogs = log.dialogs; R.hosts = log.hosts; R.unexpected = [...new Set(log.offHostOrPath)].slice(0, 40); R.shim = shim.summary(); R.shim.aborted = R.shim.aborted.slice(0, 40); R.shim.missingCount = R.shim.missing.length; R.shim.missing = R.shim.missing.slice(0, 10);
  R.wallMs = Date.now() - t0; results[name] = R;
  const a = R.after || {};
  console.log(`${name} settled=${R.settledMs} rtt=${R.maxMainThreadRttMs} pwn=${a.pwn} proto=${a.protoPolluted} inj=${a.injectedNodes}/${a.injectedDoc} req=${R.lightningRequestsWhileOn} afterOff=${R.requestsAfterOff8s} unexpected=${R.unexpected.length} pageErr=${R.pageErrors.length} inspect=${JSON.stringify(a.inspect)} map=${JSON.stringify(a.mapOk)} feats=${a.sourceFeatures}\n   label=${a.label}\n   status=${a.status}\n   last=${JSON.stringify(a.last)}\n   errors=${JSON.stringify(a.errors)} ${R.error || ''}`);
  await writeFile(join(OUT, name + '.json'), JSON.stringify(R, null, 1));
  await ctx.close();
}
await browser.close();
