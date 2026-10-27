#!/usr/bin/env node
/* p13-clock.mjs — P13 no unintended data traffic (regression-challenge-C), FAKE-TIMER variant of p13-idle.mjs.
 * page.clock.install() before navigation (time flows naturally during boot), then virtual idle via page.clock.fastForward()
 * in 30 s steps (each step fires every due timer at most once, so the 600 000 ms updater fires at the step that crosses it).
 * One phase per process (--phase off|on) so OFF and ON are separate chunks. The ON phase is the positive control: the
 * 10-minute refresh MUST be observed there, proving the fake clock reaches the overlay's setInterval.
 * Phase OFF: boot the candidate under the lead shim and stay idle for --minutes; every 30 s sample lightning requests,
 * timers/fetch/XHR created by the overlay (attributed by stack: sld-sandbox blob, line > 8666 = appended module), map
 * sources/layers, and the overlay state. Phase ON: real click on the native toggle, then the same idle sampling; the
 * 10-minute refresh must only touch declared endpoints (history/index.json, history/days/*.json, uk_lightning.geojson).
 *   node p13-idle.mjs --url <candidate> --generation 202610261949 --minutes 11 --out <dir> [--lightning-data-dir <dir>] [--route baseline]
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const URL_ = arg('--url', 'http://127.0.0.1:8144/wt/atlas/v/202610261949/'), GEN = arg('--generation', '202610261949'), MIN = Number(arg('--minutes', '11')), PHASE = arg('--phase', 'off'), STEP = Number(arg('--step-ms', '30000')), OUT = path.resolve(arg('--out', 'p13')), ROUTE = arg('--route', 'candidate');
const LDIR = arg('--lightning-data-dir', '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data');
fs.mkdirSync(OUT, { recursive: true });
const R = { route: ROUTE, url: URL_, minutes: MIN, harness: 'lead-shim, Playwright page.clock fake timers (install before goto; fastForward 30 s steps), viewport 1440x900 desktop', phase: PHASE, stepMs: STEP, lightningDataDir: LDIR, startedAt: new Date().toISOString(), off: null, on: null };
const save = () => fs.writeFileSync(path.join(OUT, `p13-${ROUTE}-${PHASE}.json`), JSON.stringify(R, null, 2));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage(); page.setDefaultTimeout(20000);
const shim = await installOfflineShim(page, { lightningDataDir: LDIR });
await page.clock.install();
await page.addInitScript(() => {
  const P = window.__P13 = { timers: [], fetches: [], xhrs: [], cleared: new Set(), t0: Date.now() };
  const stack = () => { try { return (new Error().stack || '').split('\n').slice(2, 7).map(s => s.trim()).join(' <- '); } catch { return ''; } };
  const si = window.setInterval, st = window.setTimeout, ci = window.clearInterval;
  window.setInterval = function (fn, ms, ...a) { const id = si.call(window, fn, ms, ...a); P.timers.push({ kind: 'interval', id, ms, t: Date.now() - P.t0, stack: stack() }); return id; };
  window.setTimeout = function (fn, ms, ...a) { const id = st.call(window, fn, ms, ...a); if (ms >= 1000) P.timers.push({ kind: 'timeout', id, ms, t: Date.now() - P.t0, stack: stack() }); return id; };
  window.clearInterval = function (id) { P.cleared.add(id); return ci.call(window, id); };
  const f = window.fetch; window.fetch = function (u, o) { P.fetches.push({ url: String(u && u.url || u).slice(0, 160), t: Date.now() - P.t0, stack: stack() }); return f.call(window, u, o); };
  const xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u, ...a) { P.xhrs.push({ url: String(u).slice(0, 160), t: Date.now() - P.t0, stack: stack() }); return xo.call(this, m, u, ...a); };
});
const requests = []; page.on('request', r => { const rec = { url: r.url(), t: Date.now(), v: null }; requests.push(rec); page.evaluate(() => Date.now()).then(v => { rec.v = v; }).catch(() => { }); });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
const LIGHT = /raw\.githubusercontent\.com\/Ventusltd\/lightning\//;
const DECLARED = (u) => /^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\/data\/(history\/index\.json|history\/days\/\d{4}\/\d{2}\/\d{2}\.json|uk_lightning\.geojson)$/.test(u);

const t0 = Date.now();
await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(g => document.documentElement.dataset.gridatlasGeneration === g, GEN, { timeout: 60000 });
await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60 && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
if (ROUTE === 'candidate') await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { }); await new Promise(r => setTimeout(r, 3000));
const bootMs = Date.now() - t0;
const vnow = () => page.evaluate(() => Date.now());

const sample = (label) => page.evaluate((label) => {
  const P = window.__P13; const blob = document.querySelector('script[data-gridatlas-cartridge="sld-sandbox"]')?.src; const short = blob ? blob.replace(/^blob:https?:\/\/[^/]+\//, '') : '§';
  const moduleFrame = (s) => { const m = s && s.match(new RegExp(short.replace(/[-]/g, '\\-') + ':(\\d+):\\d+')); return m ? Number(m[1]) : null; };
  const owned = (e) => { const line = moduleFrame(e.stack); return line !== null && line > 8666; };
  const S = window.__GRIDATLAS_MODULES__?.ukLightning?.state; const m = window.__GRIDATLAS_V9_MAP__;
  return { label, virtual_t_ms: Date.now() - P.t0, moduleTimers: P.timers.filter(owned).map(e => ({ kind: e.kind, ms: e.ms, t: e.t, cleared: P.cleared.has(e.id), line: moduleFrame(e.stack) })), moduleFetches: P.fetches.filter(owned).map(e => ({ url: e.url, t: e.t })), moduleXhrs: P.xhrs.filter(owned).map(e => ({ url: e.url, t: e.t })), allIntervalsCreated: P.timers.filter(e => e.kind === 'interval').length, allIntervalsActive: P.timers.filter(e => e.kind === 'interval' && !P.cleared.has(e.id)).length, state: S ? { on: S.on, installed: S.installed, requests: S.requests, timer: !!S.timer, serial: S.serial, last: S.last && S.last.state, errors: S.errors.length } : null, map: m ? { source: !!m.getSource('gridatlas-lightning'), layer: !!m.getLayer('l-gridatlas-lightning'), sources: Object.keys(m.getStyle().sources).length, layers: m.getStyle().layers.length } : null };
}, label);

async function idle(phaseLabel, minutes) {
  const samples = []; const req0 = requests.length; const realStart = Date.now(); const v0 = await vnow();
  samples.push(await sample(phaseLabel + ' start'));
  const steps = Math.ceil(minutes * 60000 / STEP);
  for (let i = 1; i <= steps; i++) {
    await page.clock.fastForward(STEP);
    await new Promise(r => setTimeout(r, 400)); // real time for any fetch the fired timer started to leave the page
    samples.push(await sample(phaseLabel + ' +' + Math.round(i * STEP / 1000) + 's (virtual)'));
    if (i % 4 === 0) save();
  }
  await new Promise(r => setTimeout(r, 2000));
  const during = requests.slice(req0);
  const light = during.filter(r => LIGHT.test(r.url)).map(r => ({ url: r.url.replace(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\//, ''), virtual_t_s: r.v !== null ? +((r.v - v0) / 1000).toFixed(1) : null, declared: DECLARED(r.url) }));
  const offOrigin = during.filter(r => !/^https?:\/\/127\.0\.0\.1/.test(r.url) && !/^(blob|data):/.test(r.url)).map(r => new URL(r.url).host + new URL(r.url).pathname.slice(0, 60));
  return { virtual_minutes: minutes, steps, real_seconds: +((Date.now() - realStart) / 1000).toFixed(1), virtual_seconds: +(((await vnow()) - v0) / 1000).toFixed(1), requests_total_during: during.length, lightning_requests_during: light, lightning_undeclared: light.filter(l => !l.declared), off_origin_requests_during: [...new Set(offOrigin)], samples, pageErrors: pageErrors.slice() };
}

R.boot = { bootMs, lightningRequestsAtBoot: requests.filter(r => LIGHT.test(r.url)).length, sample: await sample('after boot') };
console.log('[p13c]', ROUTE, PHASE, 'booted in', bootMs, 'ms; lightning requests at boot', R.boot.lightningRequestsAtBoot); save();
if (PHASE === 'off') {
  R.off = await idle('OFF', MIN); save();
  console.log('[p13c] OFF virtual idle done:', R.off.virtual_seconds, 's virtual,', R.off.lightning_requests_during.length, 'lightning requests;', R.off.samples.at(-1).moduleTimers.length, 'module timers;', JSON.stringify(R.off.samples.at(-1).state), JSON.stringify(R.off.samples.at(-1).map));
} else {
  const toggle = page.locator('#scada-ui-container [data-lightning-control="toggle"]');
  const reqOn = requests.length;
  await toggle.click();
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last !== null, null, { timeout: 40000 }).catch(() => { });
  await new Promise(r => setTimeout(r, 1500));
  R.onLoad = { requests: requests.slice(reqOn).filter(r => LIGHT.test(r.url)).map(r => ({ url: r.url.replace(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/lightning\/main\//, ''), declared: DECLARED(r.url) })), state: await sample('after ON load'), caption: await page.locator('#scada-ui-container [data-lightning-control]').evaluateAll(xs => xs.map(x => (x.getAttribute('aria-label') || x.textContent || '').trim().slice(0, 80))).catch(e => String(e)) };
  console.log('[p13c] ON loaded:', JSON.stringify(R.onLoad.requests)); save();
  R.on = await idle('ON', MIN); save();
  console.log('[p13c] ON virtual idle done:', JSON.stringify(R.on.lightning_requests_during), 'undeclared', R.on.lightning_undeclared.length);
  await toggle.click(); await new Promise(r => setTimeout(r, 1000));
  R.afterOff = await sample('after OFF');
  R.offAgain = await idle('OFF-again', MIN); save();
  console.log('[p13c] OFF-again virtual idle:', R.offAgain.lightning_requests_during.length, 'lightning requests', JSON.stringify(R.offAgain.samples.at(-1).state), JSON.stringify(R.offAgain.samples.at(-1).map));
}
R.shim = shim.summary(); R.endedAt = new Date().toISOString(); save();
await page.screenshot({ path: path.join(OUT, `p13-${ROUTE}-${PHASE}-final.png`) });
await browser.close();
console.log('[p13c] saved');
