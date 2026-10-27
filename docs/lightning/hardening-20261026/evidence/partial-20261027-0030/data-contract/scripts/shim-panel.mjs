// shim-panel.mjs — data-contract lane. Boots candidate 202610262323 through the lead offline shim with a REAL data set
// (lightningDataDir = sets/<name>/data) and records what the panel says, using real locator.click() gestures only.
// Harness: lead-shim (offline-shim.mjs), Chromium headless via Playwright, desktop 1440x900. Clock: --clock or wall now.
// usage: node shim-panel.mjs --set <dir/data> --name <tag> --out <json> [--clock ISO] [--base http://127.0.0.1:8182]
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../../lightning/harness/offline-shim.mjs';
import { writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const DATA = arg('set'), NAME = arg('name'), OUT = arg('out'), CLOCK = arg('clock') || new Date().toISOString();
const ROUTE = (arg('base') || 'http://127.0.0.1:8182') + '/wt/atlas/v/202610262323/';
const G = '#scada-ui-container [data-lightning-group="main"]';
const CAPS = ['window', 'actual', 'flashes', 'refresh', 'searched', 'warning', 'footer'];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
const page = await ctx.newPage();
const errs = [], reqs = [];
page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
page.on('response', r => { const u = r.url(); if (u.includes('raw.githubusercontent.com/Ventusltd/lightning')) reqs.push([u.replace(/^.*\/data\//, ''), r.status()]); });
await page.clock.install({ time: CLOCK });
const shim = await installOfflineShim(page, { lightningDataDir: DATA });
await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 });
const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
const view = () => page.evaluate(({ G, CAPS }) => {
  const q = s => document.querySelector(s), t = s => { const n = q(s); return n ? n.innerText.trim() : null; };
  const caps = {}; for (const k of CAPS) caps[k] = t(`${G} [data-cap="${k}"]`);
  const nav = {}; document.querySelectorAll(`${G} button[data-lightning-nav]`).forEach(b => { nav[b.dataset.lightningNav] = { disabled: b.disabled, hidden: b.hidden || getComputedStyle(b).display === 'none' }; });
  const m = window.__GRIDATLAS_V9_MAP__, src = m && m.getSource && m.getSource('gridatlas-lightning');
  const lay = m && m.getLayer && m.getLayer('l-gridatlas-lightning');
  return { label: t(`${G} [data-lightning-label]`), status: t(`${G} .status-dot`), caps, nav,
    layerVisibility: lay ? m.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null,
    sourceFeatures: src && src._data && src._data.features ? src._data.features.length : null };
}, { G, CAPS });
const settle = async () => { const t0 = Date.now(); let v; await page.waitForTimeout(300);
  while (Date.now() - t0 < 25000) { v = await view(); if (v.status && v.status !== 'LOADING' && !/\[(LOAD|WAIT)\]/.test(v.label || '')) return v; await page.waitForTimeout(250); }
  return { ...v, note: 'still loading after 25 s' }; };
const steps = [];
const click = async sel => page.locator(sel).first().click({ timeout: 30000 });
const rec = async tag => { const v = await settle(); steps.push({ tag, ...v }); };
await click(`${G} input[data-lightning-control="toggle"]`); await rec('ON (default)');
for (const p of ['12h', '48h', '7d', '30d', '3m', '6m', '12m']) { await click(`${G} button[data-lightning-period="${p}"]`); await rec(p); }
await click(`${G} button[data-lightning-period="7d"]`); await settle();
let v = await view();
if (v.nav.points && !v.nav.points.hidden && !v.nav.points.disabled) { await click(`${G} button[data-lightning-nav="points"]`); await rec('7d LOAD POINTS'); await click(`${G} button[data-lightning-period="7d"]`); await settle(); v = await view(); }
if (v.nav.prev && !v.nav.prev.disabled && !v.nav.prev.hidden) { await click(`${G} button[data-lightning-nav="prev"]`); await rec('7d PREV'); } else steps.push({ tag: '7d PREV', skipped: 'PREV disabled/hidden', nav: v.nav });
await click(`${G} button[data-lightning-period="custom"]`); await page.waitForTimeout(300);
await page.locator(`${G} input[data-lightning-date="from"]`).fill('2026-10-21'); await page.locator(`${G} input[data-lightning-date="to"]`).fill('2026-10-25');
await click(`${G} button[data-lightning-nav="apply"]`); await rec('custom 2026-10-21..25');
await page.locator(G).screenshot({ path: OUT.replace(/\.json$/, '.png') }).catch(() => {});
const res = { name: NAME, data: DATA, clock: CLOCK, route: ROUTE, harness: 'lead-shim; Chromium ' + browser.version() + ' headless; desktop 1440x900; real clicks', composition: comp, steps, pageErrors: errs, lightningResponses: reqs, shim: shim.summary() };
await writeFile(OUT, JSON.stringify(res, null, 1));
console.log(NAME, 'steps', steps.length, 'pageErrors', errs.length, 'reqs', JSON.stringify([...new Set(reqs.map(r => r.join(':')))]));
await browser.close();
