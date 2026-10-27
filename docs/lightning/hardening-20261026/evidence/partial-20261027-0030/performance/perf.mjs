// perf.mjs — performance lane (issue #32 final push). Harness: lead-shim (lightning/harness/offline-shim.mjs),
// Chromium headless via Playwright from /home/claude/gridatlas/node_modules, software GL (SwiftShader).
// Phones are CHROMIUM EMULATION (isMobile, hasTouch, coarse pointer), not WebKit and not real devices.
// CPU throttle via CDP Emulation.setCPUThrottlingRate. No fake clock (it would distort timings).
//
// usage: node perf.mjs <mode> <route> <WxH> <throttle> <outfile> [dataDir] [--interact] [--cluster-zoom]
//   mode  boot   : navigate, record composition-ready (menuBar.installed), lightning install, long tasks, heap, requests
//         toggle : boot, [baseline pan/zoom], open Layers, real tap on the lightning toggle, record tap -> first flashes
//                  painted / label settled / map idle, long tasks, heap delta, rendered/cluster counts, [pan/zoom ON]
//   route base | cand
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { writeFile } from 'node:fs/promises';

const [mode, routeKey, wh, thr, outFile, dataDir] = process.argv.slice(2);
const INTERACT = process.argv.includes('--interact');
const CLZOOM = process.argv.includes('--cluster-zoom');
const ROUTES = { base: 'http://127.0.0.1:8178/wt/atlas/', cand: 'http://127.0.0.1:8178/wt/atlas/v/202610262323/' };
const [W, H] = wh.split('x').map(Number);
const RATE = Number(thr);
const LIGHTNING_RE = /raw\.githubusercontent\.com\/Ventusltd\/lightning|uk_lightning\.geojson|\/history\/index\.json|\/history\/days\//;
const LAYER = 'l-gridatlas-lightning', SRC = 'gridatlas-lightning';
const G = '#scada-ui-container [data-lightning-group="main"]';
const phone = W < 700;
const UA = W === 393
  ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
  : 'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

const INIT = () => {
  const P = window.__PERF = { lt: [], marks: {}, t0: performance.timeOrigin };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { P.ltErr = String(e); }
  const iv = setInterval(() => {
    const M = window.__GRIDATLAS_MODULES__ || {}, m = window.__GRIDATLAS_V9_MAP__;
    if (!P.marks.map && m) P.marks.map = performance.now();
    if (!P.marks.mapLoaded && m && m.loaded && m.loaded()) P.marks.mapLoaded = performance.now();
    if (!P.marks.menu && M.menuBar && M.menuBar.installed === true) P.marks.menu = performance.now();
    if (!P.marks.lightning && M.ukLightning && M.ukLightning.state && M.ukLightning.state.installed) P.marks.lightning = performance.now();
    if (P.marks.menu && (P.marks.lightning || performance.now() - P.marks.menu > 20000)) clearInterval(iv);
  }, 100);
};

const ST = m => { res.stage = m; console.error(new Date().toISOString().slice(11,19), m); };
const res = { mode, route: ROUTES[routeKey], routeKey, viewport: wh, cpuThrottle: RATE, dataDir: dataDir || null,
  harness: 'lead-shim offline-shim.mjs; Chromium headless, SwiftShader GL; ' + (phone ? 'phone = Chromium emulation (isMobile, hasTouch), not WebKit' : 'desktop'),
  startedUtc: new Date().toISOString(), loadavgStart: (await import('node:os')).loadavg(), freeMemMBStart: Math.round((await import('node:os')).freemem()/1048576) };
const browser = await chromium.launch({ headless: true });
res.chromium = browser.version();
const ctx = await browser.newContext(phone ? { viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, userAgent: UA, locale: 'en-GB' } : { viewport: { width: W, height: H }, locale: 'en-GB' });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const reqs = []; const t0n = Date.now();
page.on('request', r => reqs.push({ t: Date.now() - t0n, url: r.url() }));
const errors = []; page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
page.on('crash', () => errors.push('RENDERER CRASH'));
await page.addInitScript(INIT);
const shim = await installOfflineShim(page, dataDir ? { lightningDataDir: dataDir } : {});

const metrics = async (gc = true) => {
  if (gc) { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await page.waitForTimeout(300); }
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  return { heapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), heapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(2), nodes: m.Nodes, documents: m.Documents, listeners: m.JSEventListeners };
};
const ltSummary = (lt, a = 0, b = Infinity) => { const s = lt.filter(([st]) => st >= a && st <= b); return { count: s.length, totalMs: s.reduce((n, x) => n + x[1], 0), maxMs: s.reduce((n, x) => Math.max(n, x[1]), 0), over1s: s.filter(x => x[1] > 1000).length }; };
const lightningReqs = () => reqs.filter(r => LIGHTNING_RE.test(r.url));

try {
  await page.goto(res.route, { waitUntil: 'domcontentloaded', timeout: 120000 });
  res.composition = await waitForComposition(page, { deadlineMs: 150000, settleMs: 0 });
  // let lightning install (cand) and the composition quiet down: up to 20 s after menu, then fixed 5 s
  for (let i = 0; i < 80; i++) { const ok = await page.evaluate(k => !!(window.__PERF.marks.menu && (k === 'base' || window.__PERF.marks.lightning)), routeKey); if (ok) break; await page.waitForTimeout(250); }
  await page.waitForTimeout(5000);
  const P = await page.evaluate(() => window.__PERF);
  res.boot = {
    menuInstalledMs: Math.round(P.marks.menu), mapCreatedMs: Math.round(P.marks.map), mapLoadedMs: Math.round(P.marks.mapLoaded),
    lightningInstalledMs: P.marks.lightning ? Math.round(P.marks.lightning) : null,
    lightningAfterMenuMs: P.marks.lightning ? Math.round(P.marks.lightning - P.marks.menu) : null,
    longTasksToMenu: ltSummary(P.lt, 0, P.marks.menu), longTasksMenuPlus5s: ltSummary(P.lt, P.marks.menu, P.marks.menu + 5000), longTasksAll: ltSummary(P.lt),
    requests: reqs.length, lightningRequests: lightningReqs().map(r => r.url), shim: shim.summary(),
    lightningState: await page.evaluate(() => { const L = window.__GRIDATLAS_MODULES__.ukLightning; if (!L) return null; const m = window.__GRIDATLAS_V9_MAP__;
      return { installed: L.state.installed, on: L.state.on, requests: L.state.requests, errors: L.state.errors, nodes: document.querySelectorAll('[data-lightning-group], [data-lightning-group] *').length, source: !!(m && m.getSource('gridatlas-lightning')), layer: !!(m && m.getLayer('l-gridatlas-lightning')) }; }),
    ...(await metrics(true)),
  };
  if (mode === 'toggle') {
    const T = res.toggle = {};
    const gestures = async label => {
      // real touch input through CDP (pan) and the browser's synthetic pinch gesture (zoom) on the map canvas
      await page.evaluate(() => { const m = window.__GRIDATLAS_V9_MAP__; const g = window.__G = { frames: [], renders: 0, run: true, z0: m.getZoom(), c0: m.getCenter() };
        m.on('render', g.rf = () => g.renders++); const f = t => { if (!g.run) return; g.frames.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); g.start = performance.now(); });
      const x = Math.round(W / 2), y = Math.round(H * 0.5);
      const tp = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
      console.error('g start'); const tA = Date.now();
      await tp('touchStart', x, y);
      for (let i = 1; i <= 40; i++) { await tp('touchMove', x - i * 4, y - i * 3); await new Promise(r => setTimeout(r, 16)); }
      await tp('touchEnd'); const panMs = Date.now() - tA;
      console.error('pan sent'); const tB = Date.now();
      await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: 2.5, relativeSpeed: 600, gestureSourceType: 'touch' });
      await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: 0.6, relativeSpeed: 600, gestureSourceType: 'touch' });
      const pinchMs = Date.now() - tB; console.error('pinch sent');
      const gEnd = await page.evaluate(() => performance.now());
      let idle = null; const tI = Date.now();
      while (Date.now() - tI < 60000) { idle = await page.evaluate(() => { const m = window.__GRIDATLAS_V9_MAP__; return m.loaded() && m.areTilesLoaded() && !m.isMoving() && !m.isZooming(); }); if (idle) break; await page.waitForTimeout(200); }
      const out = await page.evaluate(gEnd => { const g = window.__G, m = window.__GRIDATLAS_V9_MAP__; g.run = false; m.off('render', g.rf);
        const fr = g.frames.filter(t => t <= gEnd), iv = fr.slice(1).map((t, i) => t - fr[i]).sort((a, b) => a - b), dur = (gEnd - g.start) / 1000;
        const lt = window.__PERF.lt.filter(([s]) => s >= g.start);
        return { activeSec: +dur.toFixed(2), rafFps: +(fr.length / dur).toFixed(1), frameP50: Math.round(iv[iv.length >> 1] || 0), frameP95: Math.round(iv[Math.floor(iv.length * 0.95)] || 0), frameMax: Math.round(iv[iv.length - 1] || 0),
          mapRenders: g.renders, mapRenderFps: +(g.renders / dur).toFixed(1), zoom0: +g.z0.toFixed(2), zoom1: +m.getZoom().toFixed(2), moved: JSON.stringify(g.c0) !== JSON.stringify(m.getCenter()),
          longTasks: { count: lt.length, totalMs: lt.reduce((n, x) => n + x[1], 0), maxMs: lt.reduce((n, x) => Math.max(n, x[1]), 0) } }; }, gEnd);
      out.label = label; out.panSendMs = panMs; out.pinchSendMs = pinchMs; out.idleAfterGestureMs = idle ? Date.now() - tI : null;
      return out;
    };
    ST('gestures off'); if (INTERACT) T.gesturesOff = await gestures('lightning OFF');
    ST('heap0');
    const heap0 = await metrics(true); T.heapBefore = heap0;
    ST('open panel'); if (phone) { await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(800); }
    ST('scroll'); await page.locator(`${G} input[data-lightning-control="toggle"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.evaluate(({ LAYER, SRC, G }) => {
      const m = window.__GRIDATLAS_V9_MAP__, X = window.__TG = { tap: null, paint: null, settled: null, idle: null, paintCount: null };
      const grp = document.querySelector(G);
      for (const ev of ['pointerdown', 'touchstart', 'click']) grp.addEventListener(ev, e => { if (X.tap === null) X.tap = e.timeStamp; }, { capture: true });
      const lab = grp.querySelector('[data-lightning-label]');
      new MutationObserver(() => { if (X.tap !== null && X.settled === null && !/\[(LOAD|WAIT)\]/.test(lab.textContent)) { X.settled = performance.now(); X.label = lab.textContent; } }).observe(lab, { childList: true, characterData: true, subtree: true });
      m.on('render', X.rf = () => { if (X.paint === null && m.getLayer(LAYER) && m.getLayoutProperty(LAYER, 'visibility') === 'visible' && m.isSourceLoaded(SRC)) { X.paint = performance.now(); X.paintCount = m.queryRenderedFeatures({ layers: [LAYER] }).length; } });
      m.on('idle', X.if = () => { if (X.paint !== null && X.idle === null) X.idle = performance.now(); });
    }, { LAYER, SRC, G });
    ST('tap'); const tapWall = Date.now();
    if (phone) await page.locator(`${G} input[data-lightning-control="toggle"]`).tap({ timeout: 15000 }); else await page.locator(`${G} input[data-lightning-control="toggle"]`).click({ timeout: 15000 });
    let X; const tP = Date.now();
    while (Date.now() - tP < 180000) { X = await page.evaluate(() => window.__TG); if (X.idle !== null || (X.settled !== null && X.paint === null && /EMPTY|UNKNOWN|FAIL/.test(X.label || '') && Date.now() - 0 > 0)) break; await page.waitForTimeout(250); }
    await page.waitForTimeout(2000);
    X = await page.evaluate(() => window.__TG);
    const P2 = await page.evaluate(() => window.__PERF);
    T.tapToFirstPaintMs = X.paint !== null ? Math.round(X.paint - X.tap) : null;
    T.tapToLabelSettledMs = X.settled !== null ? Math.round(X.settled - X.tap) : null;
    T.tapToIdleMs = X.idle !== null ? Math.round(X.idle - X.tap) : null;
    T.renderedAtFirstPaint = X.paintCount; T.label = X.label; T.wallTimeoutHit = X.idle === null;
    T.longTasks = ltSummary(P2.lt, X.tap, (X.idle ?? X.tap + 180000) + 2000);
    T.longTaskList = P2.lt.filter(([s]) => s >= X.tap && s <= (X.idle ?? 1e12) + 2000);
    ST('state'); T.state = await page.evaluate(({ LAYER, SRC, G }) => { const L = window.__GRIDATLAS_MODULES__.ukLightning.state, m = window.__GRIDATLAS_V9_MAP__;
      const r = m.queryRenderedFeatures({ layers: [LAYER] }), cl = r.filter(f => f.properties && f.properties.point_count);
      const src = m.getSource(SRC); const t = s => { const n = document.querySelector(`${G} ${s}`); return n ? n.textContent : null; };
      return { last: L.last, requests: L.requests, errors: L.errors, zoom: +m.getZoom().toFixed(2), clusterOption: !!(src && src._options && src._options.cluster), rendered: r.length, clustersRendered: cl.length,
        clusterPointsSum: cl.reduce((n, f) => n + f.properties.point_count, 0), maxClusterSize: cl.reduce((n, f) => Math.max(n, f.properties.point_count), 0),
        status: t('.status-dot'), flashesCaption: t('[data-cap="flashes"]') }; }, { LAYER, SRC, G });
    T.heapAfter = await metrics(true); T.heapDeltaMB = +(T.heapAfter.heapUsedMB - heap0.heapUsedMB).toFixed(2);
    T.lightningRequests = lightningReqs().filter(r => r.t >= tapWall - t0n - 50).map(r => ({ t: r.t - (tapWall - t0n), url: r.url.replace(/^.*\/data\//, '') }));
    T.lightningRequestsBeforeTap = lightningReqs().filter(r => r.t < tapWall - t0n - 50).length;
    await page.screenshot({ path: outFile.replace(/\.json$/, '-on.png') }).catch(() => {});
    if (phone) { await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(1500); }
    if (INTERACT) T.gesturesOn = await gestures('lightning ON');
    if (CLZOOM) {
      // programmatic (labelled): jump to the densest cluster and past clusterMaxZoom 10, time to idle and what is drawn
      const z = await page.evaluate(async ({ LAYER }) => { const m = window.__GRIDATLAS_V9_MAP__; const r = m.queryRenderedFeatures({ layers: [LAYER] }).filter(f => f.properties.point_count).sort((a, b) => b.properties.point_count - a.properties.point_count);
        if (!r.length) return { note: 'no clusters' }; const c = r[0].geometry.coordinates; const out = [];
        for (const zz of [7, 9, 11]) { const t = performance.now(); m.jumpTo({ center: c, zoom: zz }); await new Promise(res => { const ck = () => (m.loaded() && m.areTilesLoaded()) ? res() : setTimeout(ck, 50); setTimeout(ck, 50); });
          const q = m.queryRenderedFeatures({ layers: [LAYER] }); out.push({ zoom: zz, msToLoaded: Math.round(performance.now() - t), rendered: q.length, clusters: q.filter(f => f.properties.point_count).length }); }
        return { center: c, steps: out }; }, { LAYER });
      T.clusterZoom = z;
    }
  }
} catch (e) { res.error = String(e && e.message || e).slice(0, 500); }
res.pageErrors = errors; res.finishedUtc = new Date().toISOString(); res.loadavgEnd = (await import('node:os')).loadavg();
await writeFile(outFile, JSON.stringify(res, null, 1));
await Promise.race([browser.close().catch(() => {}), new Promise(r => setTimeout(r, 10000))]);
console.log(JSON.stringify({ out: outFile, error: res.error || null, boot: res.boot && { menu: res.boot.menuInstalledMs, lightning: res.boot.lightningInstalledMs, lreq: res.boot.lightningRequests.length, heap: res.boot.heapUsedMB }, toggle: res.toggle && { paint: res.toggle.tapToFirstPaintMs, settled: res.toggle.tapToLabelSettledMs, idle: res.toggle.tapToIdleMs, lt: res.toggle.longTasks, heapD: res.toggle.heapDeltaMB, st: res.toggle.state && { r: res.toggle.state.rendered, c: res.toggle.state.clustersRendered, cl: res.toggle.state.clusterOption, d: res.toggle.state.last && res.toggle.state.last.drawn } } }));
process.exit(0);
