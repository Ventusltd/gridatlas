#!/usr/bin/env node
/* p16-boot-paired.mjs — regression-challenge-C. Interleaved, same-harness boot/idle budget for P16 (and a P12 repeat):
 * baseline and candidate booted alternately (B,C,B,C,...) at one viewport, fresh browser per boot, lead offline shim,
 * nothing else running. Records milestones from navigation, long tasks, CDP metrics after boot, a 20 s idle window
 * (CPU TaskDuration/ScriptDuration, body mutations total and by attribute), and first-interaction latency
 * (real click on the Grid title -> panel visible).
 *   node p16-boot-paired.mjs --viewport 393x852 [--reps 3] [--ua iphone] --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [VW, VH] = arg('--viewport', '1440x900').split('x').map(Number);
const REPS = Number(arg('--reps', '3')), UA_KIND = arg('--ua', 'android'), IDLE = Number(arg('--idle-ms', '20000'));
const OUT = path.resolve(arg('--out', 'p16-boot')); fs.mkdirSync(OUT, { recursive: true });
const MOBILE = VW < 700;
const UA = MOBILE ? (UA_KIND === 'iphone' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36') : undefined;
const ROUTES = { baseline: { url: 'http://127.0.0.1:8143/gridatlas/atlas/', gen: '202609241334' }, candidate: { url: 'http://127.0.0.1:8144/wt/atlas/v/202610261949/', gen: '202610261949' } };
const LDIR = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
if (process.argv.includes('--after')) ROUTES.candidate = { url: 'http://127.0.0.1:8162/wt/atlas/v/202610262323/', gen: '202610262323' };
const LBL = process.argv.includes('--after') ? 'after-' : '';
const tag = `${LBL}${VW}x${VH}${MOBILE && UA_KIND === 'iphone' ? '-iphone-emulation' : ''}`;
const R = { viewport: tag, routes: ROUTES, harness: 'lead-shim (installOfflineShim), Chromium headless Playwright 1.63, fresh browser per boot, routes interleaved B/C, nothing else running', ua: UA || 'desktop', reps: REPS, runs: [] };
const save = () => fs.writeFileSync(path.join(OUT, `p16-boot-${tag}.json`), JSON.stringify(R, null, 2));

async function boot(route) {
  const { url, gen } = ROUTES[route];
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, isMobile: MOBILE, hasTouch: MOBILE, userAgent: UA, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  await installOfflineShim(page, { lightningDataDir: LDIR });
  await page.addInitScript(() => {
    window.__B = { longTasks: [], milestones: {}, muts: { total: 0, attrs: {}, childList: 0, on: false } };
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__B.longTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (e) { }
    const mark = (k) => { if (!(k in window.__B.milestones)) window.__B.milestones[k] = Math.round(performance.now()); };
    const poll = setInterval(() => { try {
      if (window.__GRIDATLAS_V9_MAP__) mark('map_object');
      if (document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60) mark('proxies_60');
      if (window.__GRIDATLAS_MODULES__?.menuBar?.installed === true) mark('menuBar_installed');
      if (window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true) mark('ukLightning_installed');
      if (performance.now() > 25000) clearInterval(poll);
    } catch (e) { } }, 25);
  });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const pageErrors = []; page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(g => document.documentElement.dataset.gridatlasGeneration === g, gen, { timeout: 60000 });
  await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60 && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
  if (route === 'candidate') await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
  const bootMs = Date.now() - t0;
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
  await page.waitForTimeout(3000);
  const mBoot = await metrics();
  const b = await page.evaluate(() => ({ milestones: window.__B.milestones, lt: window.__B.longTasks }));
  // idle window: body mutation counts + CPU
  await page.evaluate(() => { const M = window.__B.muts; window.__B.mo = new MutationObserver(list => { for (const m of list) { M.total++; if (m.type === 'attributes') M.attrs[m.attributeName] = (M.attrs[m.attributeName] || 0) + 1; else if (m.type === 'childList') M.childList++; } }); window.__B.mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
  const m0 = await metrics();
  await page.waitForTimeout(IDLE);
  const m1 = await metrics();
  const muts = await page.evaluate(() => { window.__B.mo.disconnect(); return window.__B.muts; });
  // first interaction: real click/tap on the Grid title, time until the Grid panel is visible
  const grid = page.getByRole('button', { name: 'Grid', exact: true });
  const fi0 = Date.now();
  if (MOBILE) await grid.tap(); else await grid.click();
  await page.waitForFunction(() => { const p = document.querySelector('[data-gridatlas-layer-proxy="engine:400"]'); if (!p) return false; const r = p.getBoundingClientRect(); return r.width > 0 && r.height > 0; }, null, { timeout: 10000 }).catch(() => { });
  const firstInteractionMs = Date.now() - fi0;
  await browser.close();
  const lt = b.lt;
  return { route, bootMs, milestones: b.milestones, longTasks: { count: lt.length, total_ms: lt.reduce((a, x) => a + x.duration, 0), max_ms: lt.reduce((a, x) => Math.max(a, x.duration), 0) }, afterBoot: { heapMB: +(mBoot.JSHeapUsedSize / 1048576).toFixed(1), nodes: mBoot.Nodes, listeners: mBoot.JSEventListeners, scriptS: +mBoot.ScriptDuration.toFixed(3), taskS: +mBoot.TaskDuration.toFixed(3) }, idle: { ms: IDLE, taskS: +(m1.TaskDuration - m0.TaskDuration).toFixed(3), scriptS: +(m1.ScriptDuration - m0.ScriptDuration).toFixed(3), layouts: m1.LayoutCount - m0.LayoutCount, mutations: muts }, firstInteractionMs, pageErrors };
}
for (let i = 0; i < REPS; i++) for (const route of (i % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])) {
  try { const r = await boot(route); r.rep = i; R.runs.push(r); console.log(`[p16 ${tag}] rep ${i} ${route} boot ${r.bootMs} ms proxies_60 ${r.milestones.proxies_60} lt ${r.longTasks.total_ms} idleTask ${r.idle.taskS}s muts ${r.idle.mutations.total} fi ${r.firstInteractionMs} ms`); }
  catch (e) { R.runs.push({ route, rep: i, error: String(e).slice(0, 300) }); console.log(`[p16 ${tag}] rep ${i} ${route} ERROR ${e}`); }
  save();
}
const med = (a) => { const s = a.filter(x => typeof x === 'number').sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
R.median = {};
for (const route of ['baseline', 'candidate']) { const rs = R.runs.filter(r => r.route === route && !r.error); R.median[route] = { bootMs: med(rs.map(r => r.bootMs)), proxies_60: med(rs.map(r => r.milestones.proxies_60)), longTask_total_ms: med(rs.map(r => r.longTasks.total_ms)), longTask_max_ms: med(rs.map(r => r.longTasks.max_ms)), heapMB: med(rs.map(r => r.afterBoot.heapMB)), nodes: med(rs.map(r => r.afterBoot.nodes)), listeners: med(rs.map(r => r.afterBoot.listeners)), bootScriptS: med(rs.map(r => r.afterBoot.scriptS)), idleTaskS: med(rs.map(r => r.idle.taskS)), idleScriptS: med(rs.map(r => r.idle.scriptS)), idleMutations: med(rs.map(r => r.idle.mutations.total)), firstInteractionMs: med(rs.map(r => r.firstInteractionMs)) }; }
save(); console.log(`[p16 ${tag}] medians`, JSON.stringify(R.median));
