import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
const mode = process.argv[3];
const b = await chromium.launch({ headless: true }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
p.on('crash', () => console.log('CRASH event', Date.now()));
if (mode === 'install') await p.clock.install({ time: '2026-10-26T18:40:00Z' }); else await p.clock.setFixedTime('2026-10-26T18:40:00Z');
await p.addInitScript(() => { const si = window.setInterval; window.__IV = []; window.setInterval = function (f, ms, ...a) { if (ms === 6e5) window.__IV.push(f); return si.call(this, f, ms, ...a); }; });
await installOfflineShim(p, { lightningDataDir: process.argv[2] });
const t0 = Date.now();
await p.goto('http://127.0.0.1:8176/wt/atlas/v/202610262323/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await waitForComposition(p, { deadlineMs: 90000, settleMs: 2000 }); console.log('composed', Date.now() - t0);
await p.locator('#scada-ui-container [data-lightning-group="main"] input[data-lightning-control="toggle"]').click(); await p.waitForTimeout(3000);
console.log(await p.evaluate(() => [document.querySelector('[data-lightning-group="main"] .status-dot').innerText, window.__IV.length, new Date().toISOString()]));
if (mode === 'install') { await p.clock.fastForward(601000); } else { await p.evaluate(() => window.__IV.forEach(f => f())); }
await p.waitForTimeout(3000);
console.log(await p.evaluate(() => [document.querySelector('[data-lightning-group="main"] .status-dot').innerText, window.__GRIDATLAS_MODULES__.ukLightning.state.requests]));
await b.close(); console.log('ok', Date.now() - t0);
