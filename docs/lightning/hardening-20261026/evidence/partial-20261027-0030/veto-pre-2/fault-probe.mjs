// veto-pre-2 fault probe: boots baseline / candidate / fault-injected copies (lightning OFF), deep-link URL,
// and records whether the ORIGINAL Atlas still works. Harness: lead-shim (run under shim-preload.cjs).
import fs from 'node:fs';
import { chromium } from 'playwright';
const OUT = process.argv[2]; const VARIANTS = process.argv[3].split(','); const VPS = (process.argv[4] || '1440x900,393x852').split(',');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = 'http://127.0.0.1:8171';
const DL = 'technology=solar&latitude=52.6369&longitude=-1.1398&zoom=12&project=GRIDATLAS_PROOF_parity&capacity_mw=10';
const urlFor = v => v === 'baseline' ? `${ROOT}/wt/atlas/?${DL}` : v === 'candidate' ? `${ROOT}/wt/atlas/v/202610262323/?${DL}` : `${ROOT}/evidence/veto-pre-2/fx/${v}/?${DL}`;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise(r => setTimeout(() => r({ timeout: tag || true }), ms))]);
const results = [];
let browser = await chromium.launch({ headless: true });
console.log('chromium', browser.version(), new Date().toISOString());
for (const vp of VPS) for (const v of VARIANTS) {
  const [w, h] = vp.split('x').map(Number); const mobile = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? MOBILE_UA : undefined, locale: 'en-GB', timezoneId: 'Europe/London', deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const pageErrors = [], reqs = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  page.on('request', r => { if (/lightning/i.test(r.url())) reqs.push(r.url()); });
  const rec = { variant: v, viewport: vp, url: urlFor(v), t0: new Date().toISOString() };
  try {
    await page.goto(rec.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const t0 = Date.now();
    rec.booted = await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true && !!window.__GRIDATLAS_PIPELINE_LAYERS__?.installed, null, { timeout: 120000 }).then(() => Date.now() - t0, () => 'timeout');
    rec.deeplink = await page.waitForFunction(() => (window.__GRIDATLAS_NEON_LINKS__?.links_drawn ?? 0) > 0 || (window.__GRIDATLAS_NEON_LINKS__?.failures?.length ?? 0) > 0, null, { timeout: 60000 }).then(() => Date.now() - t0, () => 'timeout');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(3000);
    const snap = () => page.evaluate(() => {
      const M = window.__GRIDATLAS_MODULES__ || {}, L = M.ukLightning, N = window.__GRIDATLAS_NEON_LINKS__;
      let inspect = null; try { inspect = M.menuBar?.inspect?.(); } catch (e) { inspect = String(e); }
      return {
        router: document.body?.dataset?.gridatlasRouter ?? null, generation: document.documentElement.dataset.gridatlasGeneration ?? null,
        loaded: (window.__GRIDATLAS_ATLAS__?.loaded_cartridges || []).map(c => c.id + ':' + c.sha256.slice(0, 8)),
        inspect, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length,
        engine60: document.querySelectorAll('#scada-ui-container input[type=checkbox][data-layer-id]').length,
        pn3: document.querySelectorAll('#scada-ui-container [data-pn-layer]').length,
        curtainInputs: document.querySelectorAll('#fs-curtain-keys input').length,
        firstTitle: document.querySelector('#scada-ui-container .key-title')?.textContent ?? null,
        lastTitle: [...document.querySelectorAll('#scada-ui-container .key-title')].pop()?.textContent ?? null,
        lgMain: document.querySelectorAll('#scada-ui-container [data-lightning-group]').length,
        lgFs: document.querySelectorAll('#fs-curtain-keys [data-lightning-group]').length,
        lightning: L ? { installed: L.state.installed, on: L.state.on, requests: L.state.requests, errors: L.state.errors.length, firstError: L.state.errors[0] || null, waiting: L.state.waiting_for } : null,
        lightningLayers: (() => { try { return window.__GRIDATLAS_V9_MAP__.getStyle().layers.filter(l => /lightning/.test(l.id)).length } catch { return 'n/a' } })(),
        fetchName: window.fetch.name, bridge: window.__GRIDATLAS_MAP_READY__ ? { on_demand: window.__GRIDATLAS_MAP_READY__.intercepted_on_demand, failures: (window.__GRIDATLAS_MAP_READY__.failures || []).length } : null,
        neon: N ? { links_drawn: N.links_drawn, failures: (N.failures || []).slice(0, 3), substation_layer_enabled: N.substation_layer_enabled, project_layer_enabled: N.project_layer_enabled } : null,
        cardBar: document.querySelectorAll('.gridatlas-card-bar').length,
        sldGlobals: Object.keys(window).filter(k => /^__GRIDATLAS_(SLD|NEON|CARD|LAYOUT)/.test(k)),
        bodyNodes: document.body.getElementsByTagName('*').length
      };
    });
    rec.s1 = await withTimeout(snap(), 20000, 'snap1');
    // mutation budget and runaway check over 10 s, lightning OFF
    rec.mut10s = await withTimeout(page.evaluate(() => new Promise(r => { let n = 0; const o = new MutationObserver(m => { n += m.length; }); o.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true }); setTimeout(() => { o.disconnect(); r(n); }, 10000); })), 25000, 'mut');
    const tE = Date.now(); rec.s2 = await withTimeout(snap(), 20000, 'snap2'); rec.evalMs = Date.now() - tE;
    // menu still usable: open Grid with a real click/tap
    const grid = page.getByRole('button', { name: 'Grid', exact: true });
    rec.gridOpen = await withTimeout((async () => { await (mobile ? grid.tap({ timeout: 8000 }) : grid.click({ timeout: 8000 })); await page.waitForTimeout(500); return page.evaluate(() => !!document.querySelector('#gridatlas-menu-bar .gm-open')); })().catch(e => 'err ' + String(e).slice(0, 120)), 20000, 'grid');
    await withTimeout(page.screenshot({ path: `${OUT}/${v}-${vp}.png` }), 20000, 'shot');
  } catch (e) { rec.error = String(e).slice(0, 300); }
  rec.pageErrors = pageErrors; rec.lightningRequests = reqs;
  results.push(rec); console.log(JSON.stringify({ v, vp, booted: rec.booted, dl: rec.deeplink, gridOpen: rec.gridOpen, mut: rec.mut10s, evalMs: rec.evalMs, lg: rec.s2 && [rec.s2.lgMain, rec.s2.lgFs], nodes: rec.s1 && rec.s2 && [rec.s1.bodyNodes, rec.s2.bodyNodes], errs: pageErrors.length }));
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  await ctx.close().catch(() => { });
}
await browser.close(); console.log('done', new Date().toISOString());
