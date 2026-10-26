/**
 * probe-route.mjs — what does headless Chromium actually get when it opens the
 * composed Atlas from the mirrored local route?
 *
 * Records every failed request (host + Chromium error text), console errors,
 * whether maplibregl and the composer's own sentinels appear, and a screenshot
 * at the exact viewport after the wait the brief prescribes (network idle up to
 * 20 s, then a fixed 3 s).
 *
 *   node probe-route.mjs <url> <out-dir> [--width 1440 --height 1000] [--wait-ms 45000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3];
if (!url || !out) { console.error('usage: node probe-route.mjs <url> <out-dir> [--width W --height H] [--wait-ms N]'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const width = Number(arg('--width', '1440')), height = Number(arg('--height', '1000'));
const waitMs = Number(arg('--wait-ms', '45000'));
fs.mkdirSync(out, { recursive: true });
const mobile = width < 700;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
const page = await context.newPage();
const failed = [], consoleErrors = [], pageErrors = [], requests = [];
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure()?.errorText || '' }));
page.on('request', r => requests.push(r.url()));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
let mapArrived = false;
try {
  await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60, null, { timeout: waitMs });
  mapArrived = true;
} catch { mapArrived = false; }
try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch { }
await page.waitForTimeout(3000);
const state = await page.evaluate(() => ({
  title: document.title,
  generation: window.__GRIDATLAS_ATLAS__?.generation ?? null,
  htmlGeneration: document.documentElement.dataset.gridatlasGeneration ?? null,
  maplibregl: typeof window.maplibregl,
  map: !!window.__GRIDATLAS_V9_MAP__,
  menuBarInstalled: window.__GRIDATLAS_MODULES__?.menuBar?.installed ?? null,
  menuTitles: [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].map(n => n.textContent.trim()),
  engineControls: document.querySelectorAll('input[data-layer-id]').length,
  pipelineControls: document.querySelectorAll('input[data-pn-layer]').length,
  layerProxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length,
  scadaContainer: !!document.getElementById('scada-ui-container'),
  bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  scripts: [...document.scripts].map(s => s.src).filter(Boolean)
}));
const hosts = {};
for (const f of failed) { const h = new URL(f.url).host; hosts[h] = hosts[h] || { count: 0, errors: new Set(), sample: f.url }; hosts[h].count++; hosts[h].errors.add(f.error); }
const summary = {
  url, viewport: { width, height }, elapsedMs: Date.now() - t0, mapArrived, waitUsed: `waitForFunction(map && >=60 proxies, ${waitMs} ms) then networkidle<=20 s then fixed 3 s`,
  state, failedHosts: Object.fromEntries(Object.entries(hosts).map(([h, v]) => [h, { count: v.count, errors: [...v.errors], sample: v.sample }])),
  requestHosts: [...new Set(requests.map(u => new URL(u).host))], consoleErrors: consoleErrors.slice(0, 20), pageErrors: pageErrors.slice(0, 20)
};
const shot = path.join(out, `probe-${width}x${height}.png`);
await page.screenshot({ path: shot, fullPage: false });
summary.screenshot = shot;
fs.writeFileSync(path.join(out, `probe-${width}x${height}.json`), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await browser.close();
