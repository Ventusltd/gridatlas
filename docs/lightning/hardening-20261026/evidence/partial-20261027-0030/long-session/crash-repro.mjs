// crash-repro.mjs — isolate the renderer crash seen at ON -> 7D. flags: --probe 1 --cdp 1 --clock 1
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROUTE = arg('route'); const PROBE = arg('probe', '0') === '1', CDP = arg('cdp', '0') === '1', CLOCK = arg('clock', '1') === '1';
const G = '#scada-ui-container [data-lightning-group="main"]';
const b = await chromium.launch({ headless: true }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200))); page.on('crash', () => console.log('CRASH event'));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
if (CLOCK) await page.clock.install({ time: '2026-10-26T18:40:00Z' });
if (PROBE) await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = function (fn, ms, ...a) { new Error().stack; return st.call(window, fn, ms, ...a); }; });
await installOfflineShim(page, { lightningDataDir: join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data') });
if (CDP) { const c = await ctx.newCDPSession(page); await c.send('Performance.enable'); await c.send('HeapProfiler.collectGarbage'); }
await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 }); await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
const st = () => page.evaluate(g => document.querySelector(g + ' .status-dot')?.innerText, G);
try {
  await page.locator(G + ' input[data-lightning-control="toggle"]').click(); await page.waitForTimeout(3000); console.log('after ON', await st());
  await page.locator(G + ' button[data-lightning-period="7d"]').click(); await page.waitForTimeout(3000); console.log('after 7D', await st());
  console.log('heapMB', await page.evaluate(() => performance.memory && (performance.memory.usedJSHeapSize / 1048576).toFixed(1)));
} catch (e) { console.log('ERR', String(e.message).split('\n')[0]); }
console.log('errors', JSON.stringify(errs.slice(0, 8)));
await b.close();
