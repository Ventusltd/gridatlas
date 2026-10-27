import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
const b = await chromium.launch({ headless: true }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
await installOfflineShim(p, { lightningDataDir: process.argv[2] });
await p.goto('http://127.0.0.1:8176/wt/atlas/v/202610262323/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await waitForComposition(p, { deadlineMs: 90000, settleMs: 2000 });
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('#scada-ui-container input[type=checkbox]')].slice(0, 8).map(i => { const r = i.getBoundingClientRect(); return [i.id, i.dataset.layerId, i.getAttribute('data-gridatlas-layer-proxy'), i.checked, Math.round(r.x), Math.round(r.y), r.width, i.closest('label')?.innerText.slice(0, 30)]; }))));
await b.close();
