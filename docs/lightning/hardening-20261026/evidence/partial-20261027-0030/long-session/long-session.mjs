// long-session.mjs — lane "long-session", issue #32 final push.
// Harness: lead-shim (lightning/harness/offline-shim.mjs), Chromium headless via Playwright 1.63, desktop 1440x900,
// Playwright fake clock (page.clock.install at 2026-10-26T18:40:00Z, advanced with clock.runFor).
// Gestures: real locator.click() on the toggle checkbox and the period chips (no force, no dispatchEvent).
// Probes (non-visual): CDP Performance.getMetrics, HeapProfiler.collectGarbage, DOMDebugger.getEventListeners,
// map.getStyle(), an init-script wrapper over the (fake) timer functions and over fetch/XMLHttpRequest that logs
// every lightning request with the overlay's S.on and S.serial at the moment it is issued and when it settles.
//
// usage: node long-session.mjs --mode candidate|baseline --route <url> --out <dir>
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = arg('mode', 'candidate'); const ROUTE = arg('route'); const OUT = arg('out');
const DATA = join(HERE, '..', '..', '..', 'lightning', 'fixtures', 'lightning-archive', 'data');
const FAKE_NOW = '2026-10-26T18:40:00Z';
const G = '#scada-ui-container [data-lightning-group="main"]';
const TOGGLE = `${G} input[data-lightning-control="toggle"]`;
const CHIP = p => `${G} button[data-lightning-period="${p}"]`;
await mkdir(OUT, { recursive: true });

// Runs after Playwright's clock script (registered later), so it wraps the FAKE timer functions.
const PROBE = () => {
  const P = window.__LS_PROBE__ = { intervals: new Map(), timeouts: new Map(), reqs: [], wrapNative: String(window.setTimeout).includes('[native code]') };
  const st = window.setTimeout, ct = window.clearTimeout, si = window.setInterval, ci = window.clearInterval;
  const where = () => { const s = (new Error().stack || '').split('\n').slice(3, 5).join(' | '); return /uk-lightning|sld-sandbox-v9-8|202610262323/.test(s) ? 'lightning-cartridge' : 'other'; };
  window.setTimeout = function (fn, ms, ...a) { let id; const w = typeof fn === 'function' ? function () { P.timeouts.delete(id); return fn.apply(this, arguments); } : fn; id = st.call(window, w, ms, ...a); P.timeouts.set(id, { ms, src: where() }); return id; };
  window.clearTimeout = function (id) { P.timeouts.delete(id); return ct.call(window, id); };
  window.setInterval = function (fn, ms, ...a) { const id = si.call(window, fn, ms, ...a); P.intervals.set(id, { ms, src: where() }); return id; };
  window.clearInterval = function (id) { P.intervals.delete(id); return ci.call(window, id); };
  const L = () => { const m = window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.ukLightning; return m ? { on: m.state.on, serial: m.state.serial } : { on: null, serial: null }; };
  const isL = u => /raw\.githubusercontent\.com\/Ventusltd\/lightning/.test(String(u));
  const of = window.fetch;
  window.fetch = function (u, o) {
    const url = String(u && u.url || u); if (!isL(url)) return of.apply(this, arguments);
    const r = { url: url.replace(/^.*\/data\//, ''), kind: 'fetch', t0: performance.now(), at: Date.now(), ...L(), done: null };
    P.reqs.push(r);
    return of.apply(this, arguments).then(x => { r.done = performance.now(); r.status = x.status; r.endOn = L().on; return x; }, e => { r.done = performance.now(); r.err = String(e).slice(0, 80); r.endOn = L().on; throw e; });
  };
  const oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__lsu = String(u); return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    if (isL(this.__lsu)) { const r = { url: this.__lsu.replace(/^.*\/data\//, ''), kind: 'xhr', t0: performance.now(), at: Date.now(), ...L(), done: null }; P.reqs.push(r);
      this.addEventListener('loadend', () => { r.done = performance.now(); r.status = this.status; r.endOn = L().on; }); }
    return os.apply(this, arguments);
  };
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
const page = await ctx.newPage(); page.setDefaultTimeout(120000);
page.on('crash', async () => { console.log('RENDERER CRASH at', new Date().toISOString()); RUN.crashed = true; try { await writeFile(join(OUT, 'results.partial.json'), JSON.stringify(RUN, null, 2)); } catch {} process.exit(3); });
const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e && e.message || e).slice(0, 300)));
const netL = []; page.on('request', r => { if (r.url().includes('raw.githubusercontent.com/Ventusltd/lightning')) netL.push(r.url().replace(/^.*\/data\//, '')); });
await page.clock.install({ time: FAKE_NOW });
await page.addInitScript(PROBE);
const shim = await installOfflineShim(page, { lightningDataDir: DATA });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const RUN = { mode: MODE, route: ROUTE, harness: 'lead-shim; Chromium ' + browser.version() + ' headless; desktop 1440x900; Playwright fake clock', fakeStart: FAKE_NOW, samples: [], phases: {}, startedAt: new Date().toISOString() };
const t0 = Date.now();
await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90000 });
RUN.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
RUN.probeWrappedFake = await page.evaluate(() => !window.__LS_PROBE__.wrapNative);
const HAS_L = MODE === 'candidate';
const PH = (arg('phases', 'A,B,C')).split(','); RUN.phasesRun = PH;
const wall = l => console.log('WALL', l, Math.round((Date.now() - t0) / 1000) + 's');
if (HAS_L) await page.waitForSelector(G, { state: 'attached', timeout: 30000 });

async function listenerCount(expr) {
  const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
  if (!result.objectId) return null;
  const a = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: 0 });
  const d = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: -1, pierce: true }).catch(() => null);
  await cdp.send('Runtime.releaseObject', { objectId: result.objectId });
  return { own: a.listeners.length, subtree: d ? d.listeners.length : null };
}
async function sample(label) {
  await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const pg = await page.evaluate(() => {
    const P = window.__LS_PROBE__, map = window.__GRIDATLAS_V9_MAP__, st = map && map.getStyle ? map.getStyle() : null;
    const L = window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.ukLightning; const S = L && L.state;
    const cnt = (mp, src) => [...mp.values()].filter(v => !src || v.src === src).length;
    return {
      fakeNow: new Date(Date.now()).toISOString(), domNodesInDocument: document.getElementsByTagName('*').length,
      intervals: cnt(P.intervals), intervalsLightning: cnt(P.intervals, 'lightning-cartridge'), timeouts: cnt(P.timeouts), timeoutsLightning: cnt(P.timeouts, 'lightning-cartridge'),
      intervalDetail: [...P.intervals.values()].map(v => v.ms + ':' + v.src).sort().join(','),
      mapSources: st ? Object.keys(st.sources).length : null, mapLayers: st ? st.layers.length : null,
      lightningSources: st ? Object.keys(st.sources).filter(k => /lightning/.test(k)).length : null, lightningLayers: st ? st.layers.filter(l => /lightning/.test(l.id)).length : null,
      lightningGroups: document.querySelectorAll('[data-lightning-group]').length,
      S: S ? { on: S.on, serial: S.serial, requests: S.requests, errors: S.errors.length, sfs: S.sfs.length, timer: S.timer !== null, period: S.period, last: S.last && S.last.state, drawn: S.last && S.last.drawn } : null,
      reqLogged: P.reqs.length,
    };
  });
  const listeners = {
    window: await listenerCount('window'), document: await listenerCount('document'),
    panel: await listenerCount("document.getElementById('scada-ui-container')"),
    lightningGroup: HAS_L ? await listenerCount(`document.querySelector('${G}')`) : null,
  };
  const s = { label, realSec: Math.round((Date.now() - t0) / 1000), heapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), heapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(2), cdpNodes: m.Nodes, cdpJSEventListeners: m.JSEventListeners, cdpDocuments: m.Documents, cdpFrames: m.Frames, ...pg, listeners };
  RUN.samples.push(s);
  console.log(JSON.stringify({ label, heap: s.heapUsedMB, nodes: s.cdpNodes, jsL: s.cdpJSEventListeners, dom: s.domNodesInDocument, src: s.mapSources, lay: s.mapLayers, iv: s.intervals, ivL: s.intervalsLightning, to: s.timeouts, toL: s.timeoutsLightning, S: s.S, lis: listeners }));
  await writeFile(join(OUT, 'results.partial.json'), JSON.stringify(RUN, null, 2));
  return s;
}
const status = () => page.evaluate(g => { const n = document.querySelector(g + ' .status-dot'); const l = document.querySelector(g + ' [data-lightning-label]'); return { status: n ? n.innerText.trim() : null, label: l ? l.innerText.trim() : null }; }, G);
async function settle(ms = 60000) {
  const s0 = Date.now(); let v; await page.waitForTimeout(150);
  while (Date.now() - s0 < ms) { v = await status(); if (v.status && v.status !== 'LOADING' && !/\[(LOAD|WAIT)\]/.test(v.label || '')) return { ...v, ms: Date.now() - s0 }; await page.waitForTimeout(100); }
  return { ...v, ms: null };
}
async function quiesce() { // wait until no lightning request is in flight (real time)
  const s0 = Date.now(); while (Date.now() - s0 < 60000) { const n = await page.evaluate(() => window.__LS_PROBE__.reqs.filter(r => r.done === null).length); if (!n) return true; await page.waitForTimeout(100); } return false;
}
const reqCount = () => page.evaluate(() => window.__LS_PROBE__.reqs.length);
const reqsSince = i => page.evaluate(i => window.__LS_PROBE__.reqs.slice(i), i);

await sample('S0 boot (lightning OFF)');
if (HAS_L) {
  await page.locator(TOGGLE).click(); RUN.phases.firstOn = await settle();
  await page.locator(CHIP('7d')).click(); RUN.phases.chip7d = await settle(); await quiesce();
}
await sample('S1 ON + 7D settled');

// Phase A: 18 refresh cycles of 10 fake minutes each
RUN.phases.refresh = [];
wall('A start');
for (let i = 1; i <= (PH.includes('A') ? 18 : 0); i++) {
  const i0 = HAS_L ? await reqCount() : 0;
  await page.clock.runFor(10 * 60 * 1000);
  const st = HAS_L ? await settle() : null; if (HAS_L) await quiesce();
  const rq = HAS_L ? await reqsSince(i0) : [];
  RUN.phases.refresh.push({ cycle: i, requests: rq.length, urls: rq.map(r => r.url), status: st && st.status, label: st && st.label, settleMs: st && st.ms });
  console.log(`refresh ${i}: ${rq.length} req ${rq.map(r => r.url).join(' ')} :: ${st && st.status}`);
  if (i === 1 || i % 3 === 0) await sample(`A${i} after refresh cycle ${i}`);
}

if (HAS_L) {
  // Phase B: 50 OFF/ON toggles; 1-25 settle after ON, 26-50 back-to-back clicks
  wall('B start');
  const b0 = await reqCount(); RUN.phases.toggles = { settledBetween: 25, rapid: 25 };
  for (let i = 1; i <= (PH.includes('B') ? 50 : 0); i++) {
    await page.locator(TOGGLE).click(); // OFF
    await page.locator(TOGGLE).click(); // ON
    if (i <= 25) { await settle(); await quiesce(); }
    if (i === 25) await sample('B25 after 25 settled OFF/ON toggles');
  }
  RUN.phases.toggles.finalSettle = await settle(); RUN.phases.toggles.quiesced = await quiesce();
  RUN.phases.toggles.requests = (await reqsSince(b0)).length;
  await sample('B50 after 50 OFF/ON toggles');

  // OFF idle check: OFF, 11 fake minutes, no request may start
  const o0 = await reqCount(); await page.locator(TOGGLE).click(); await page.waitForTimeout(300);
  await page.clock.runFor(11 * 60 * 1000); await page.waitForTimeout(800);
  RUN.phases.offIdleRequests = (await reqsSince(o0)).filter(r => r.on === false).map(r => r.url);
  await page.locator(TOGGLE).click(); RUN.phases.reOn = await settle(); await quiesce();

  // Phase C: 30 chip changes; 1-15 settled, 16-30 back-to-back
  const order = ['12h', '24h', '48h', '7d', '30d', '3m', '6m', '12m', 'custom'];
  wall('C start');
  const c0 = await reqCount(); RUN.phases.chips = { seq: [] };
  for (let i = 0; i < (PH.includes('C') ? 30 : 0); i++) {
    const p = order[i % order.length]; await page.locator(CHIP(p)).click();
    if (i < 15) { const s = await settle(); await quiesce(); RUN.phases.chips.seq.push({ i: i + 1, p, status: s.status }); } else RUN.phases.chips.seq.push({ i: i + 1, p, rapid: true });
    if (i === 14) await sample('C15 after 15 settled chip changes');
  }
  RUN.phases.chips.finalSettle = await settle(); RUN.phases.chips.quiesced = await quiesce();
  RUN.phases.chips.requests = (await reqsSince(c0)).length;
  await sample('C30 after 30 chip changes');

  // final: back to 7D, 2 more refresh cycles (plateau check), then OFF + 11 min idle
  await page.locator(CHIP('7d')).click(); await settle(); await quiesce();
  for (let i = 1; i <= 2; i++) { const i0 = await reqCount(); await page.clock.runFor(10 * 60 * 1000); await settle(); await quiesce(); RUN.phases[`postRefresh${i}`] = (await reqsSince(i0)).map(r => r.url); }
  await sample('D after 2 more refresh cycles (7D)');
  const f0 = await reqCount(); await page.locator(TOGGLE).click(); await page.waitForTimeout(300);
  await page.clock.runFor(11 * 60 * 1000); await page.waitForTimeout(800);
  RUN.phases.finalOffIdle = (await reqsSince(f0)).map(r => ({ url: r.url, on: r.on }));
  await sample('E END (OFF, +11 fake min)');
} else {
  // baseline: same fake-time span as the candidate's later phases is idle time only (no lightning control exists)
  for (let i = 1; i <= 3; i++) { await page.clock.runFor(10 * 60 * 1000); await page.waitForTimeout(500); }
  await sample('E END (idle +30 fake min)');
}

// request analysis from the in-page log
const all = await page.evaluate(() => window.__LS_PROBE__.reqs);
const dup = []; // a request issued while another request for the same URL is still in flight
for (let i = 0; i < all.length; i++) for (let j = 0; j < i; j++) { const a = all[j], b = all[i]; if (a.url === b.url && a.t0 <= b.t0 && (a.done === null || a.done > b.t0)) { dup.push({ url: b.url, at: b.t0, overlapsWith: a.t0, serialA: a.serial, serialB: b.serial }); break; } }
RUN.requests = {
  total: all.length, netObserved: netL.length,
  issuedWhileOff: all.filter(r => r.on === false).map(r => ({ url: r.url, serial: r.serial, fakeAt: new Date(r.at).toISOString() })),
  settledWhileOff: all.filter(r => r.endOn === false).length,
  duplicateInFlight: dup.length, duplicateByUrl: dup.reduce((o, d) => (o[d.url] = (o[d.url] || 0) + 1, o), {}),
  maxConcurrent: (() => { let mx = 0; for (const r of all) { const n = all.filter(q => q.t0 <= r.t0 && (q.done === null || q.done > r.t0)).length; mx = Math.max(mx, n); } return mx; })(),
  unfinished: all.filter(r => r.done === null).length,
  byUrl: all.reduce((o, r) => (o[r.url] = (o[r.url] || 0) + 1, o), {}),
};
RUN.pageErrors = pageErrors; RUN.shim = shim.summary(); RUN.finishedAt = new Date().toISOString(); RUN.realSeconds = Math.round((Date.now() - t0) / 1000);
await writeFile(join(OUT, 'results.json'), JSON.stringify(RUN, null, 2));
await writeFile(join(OUT, 'requests.json'), JSON.stringify(all, null, 1));
console.log('REQUESTS', JSON.stringify({ ...RUN.requests, issuedWhileOff: RUN.requests.issuedWhileOff.length }));
console.log('pageErrors', pageErrors.length, 'realSeconds', RUN.realSeconds);
await browser.close();
