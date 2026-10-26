// smoke.mjs — proves the offline shim boots the ORIGINAL composition locally.
// usage: node smoke.mjs <port> <route> <outdir>
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from './offline-shim.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [port = '8190', route = '/gridatlas/atlas/', outdir = '/tmp/smoke-out'] = process.argv.slice(2);
await mkdir(outdir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = []; const consoleErr = [];
page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 200)); });
const shim = await installOfflineShim(page);
const url = `http://127.0.0.1:${port}${route}`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
const state = await waitForComposition(page, { deadlineMs: 90000, settleMs: 4000 });
await page.screenshot({ path: join(outdir, 'smoke-1440x900.png') });
const result = { url, state, shim: shim.summary(), pageErrors: errors.slice(0, 20), consoleErrors: consoleErr.slice(0, 20) };
await writeFile(join(outdir, 'smoke.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ state, served: result.shim.served, abortedCount: result.shim.aborted.length, missing: result.shim.missing.slice(0, 10), pageErrors: errors.slice(0, 5) }, null, 2));
await browser.close();
