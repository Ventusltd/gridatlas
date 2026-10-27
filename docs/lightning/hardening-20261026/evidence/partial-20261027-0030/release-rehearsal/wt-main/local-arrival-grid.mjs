/**
 * Local arrival regression grid.
 *
 * The gap that let every defect found on 2026-09-04 ship: no CI job has ever
 * loaded a deep link in a real browser at any viewport. Every vm proof stubs
 * innerWidth:1280 and matchMedia->false, so the narrow branch is never taken,
 * and the one mobile audit is orphaned because run-current cannot pick up a
 * .audit.mjs file.
 *
 * This runs the real thing, locally, across every core: workers x {chromium,
 * webkit} x {393, 1280} px, cycling REPD deep links harvested from the live
 * Pipeline News release, asserting what a reader actually gets.
 *
 * Usage: node local-arrival-grid.mjs [--workers N] [--limit N] [--hidden]
 *
 * --hidden forces document.visibilityState to 'hidden' for the whole load,
 * which is the iOS new-tab case: MAP carries target=_blank, iOS defers the
 * tab, rAF never ticks, and the arrival expires against its 12s budget.
 */
import { chromium, webkit } from 'playwright';
import { appendFileSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const WORKERS = Number(arg('--workers', Math.max(4, Math.floor(os.cpus().length / 2))));
const LIMIT = Number(arg('--limit', 400));
const HIDDEN = process.argv.includes('--hidden');
const OUT = arg('--out', 'C:/Users/vikra/OneDrive/Documents/GitHub/claude-governor-codex-20260904/sessions/202609040915-chrome-map-cycle/arrival-grid.jsonl');
const ATLAS = 'https://ventusltd.github.io/gridatlas/atlas/';
const PIPELINE = 'https://globalgrid2050.com/pipelinenews_intelligence/202609040144/';

const VIEWPORTS = [
  { w: 393, h: 852, name: 'iphone', mobile: true },
  { w: 1280, h: 800, name: 'desktop', mobile: false },
];

/** Harvest the real deep links from the live Pipeline News release. */
async function harvest() {
  const cache = 'harvest-cache.json';
  if (existsSync(cache)) {
    const rows = JSON.parse(readFileSync(cache, 'utf8'));
    if (rows.length) { console.log('harvest: ' + rows.length + ' rows from cache'); return rows; }
  }
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await p.goto(PIPELINE, { waitUntil: 'load', timeout: 90000 });
  await p.waitForSelector('table tbody tr', { timeout: 60000 });
  const rows = await p.evaluate(async () => {
    const grab = () => [...document.querySelectorAll('table tbody tr')].map(r => {
      const tds = [...r.querySelectorAll('td')].map(t => t.textContent.trim());
      const a = [...r.querySelectorAll('a,button')].find(e => /^MAP/.test(e.textContent.trim()));
      if (!a || !a.href) return { repd: tds[8], noMap: true, techLabel: tds[5], actions: tds[12] };
      const u = new URL(a.href); const q = {}; u.searchParams.forEach((v, k) => q[k] = v);
      return Object.assign({ repd: tds[8], name: tds[0].split('REPD')[0].trim(),
        techLabel: tds[5], actions: tds[12], noMap: false }, q);
    });
    const out = [];
    const spine = [...document.querySelectorAll('button')]
      .filter(b => ['ALL TECH', 'SOLAR', 'BATTERY', 'ONSHORE', 'OFFSHORE'].includes(b.textContent.trim()));
    for (const b of spine) {
      b.click(); await new Promise(r => setTimeout(r, 900)); out.push(...grab());
    }
    const sel = document.querySelector('#widerTechnology') || document.querySelector('#tech');
    if (sel) {
      const opts = [...sel.querySelectorAll('option')].map(o => o.value).filter(v => v && !/^all/i.test(v));
      for (const o of opts) {
        sel.value = o; sel.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(r => setTimeout(r, 900)); out.push(...grab());
      }
    }
    const seen = new Set();
    return out.filter(r => r.repd && !seen.has(r.repd) && seen.add(r.repd));
  });
  await b.close();
  writeFileSync(cache, JSON.stringify(rows, null, 1));
  console.log('harvest: ' + rows.length + ' distinct REPD rows (' + rows.filter(r => r.noMap).length + ' NO MAP)');
  return rows;
}

const probe = () => {
  const L = window.__GRIDATLAS_NEON_LINKS__;
  const m = window.__GRIDATLAS_V9_MAP__;
  const q = new URLSearchParams(location.search);
  const ans = [...document.querySelectorAll('body *')]
    .find(e => e.children.length < 6 && /Nearest .* substation/.test(e.innerText || ''));
  const attr = document.querySelector('.custom-map-attrib');
  const ar = attr && attr.getBoundingClientRect();
  // Sample the credit across its whole width. A centre-only check passed this
  // build while "(c) CARTO" was already buried under an open menu panel.
  const cover = ar ? [0.1, 0.3, 0.5, 0.7, 0.9].map(f => {
    const e = document.elementFromPoint(ar.x + ar.width * f, ar.y + ar.height / 2);
    return !!(e && (attr === e || attr.contains(e)));
  }) : [];
  const scada = document.querySelector('#scada-ui-container');
  return {
    repd: q.get('repd_ref'),
    tech: q.get('technology'),
    visibility: document.visibilityState,
    card: !!ans,
    answerY: ans ? Math.round(ans.getBoundingClientRect().y) : null,
    answerOnFirstScreen: !!(ans && ans.getBoundingClientRect().y >= 0 && ans.getBoundingClientRect().y < innerHeight),
    links_drawn: L ? L.links_drawn : null,
    failures: L ? L.failures : null,
    project_layer_enabled: L ? L.project_layer_enabled : null,
    cameraFlew: m ? Math.abs(m.getCenter().lng - Number(q.get('longitude'))) < 0.05 : null,
    attribCovered: cover.filter(x => !x).length,
    attribSamples: cover.length,
    menuBar: !!document.querySelector('#gridatlas-menu-bar'),
    masthead: /SYSTEM TIME/.test(document.body.innerText),
    scadaHeight: scada ? Math.round(scada.getBoundingClientRect().height) : null,
    undersized: [...document.querySelectorAll('button,a,input,label')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && Math.min(r.width, r.height) < 44;
    }).length,
  };
};

function url(r) {
  const p = new URLSearchParams({
    repd_ref: r.repd,
    project: r.name || ('REPD-' + r.repd),
    technology: r.technology || 'solar',
    capacity_mw: r.capacity_mw || '1',
    latitude: r.latitude,
    longitude: r.longitude,
    zoom: r.zoom || '12',
  });
  return ATLAS + '?' + p.toString();
}

async function worker(engine, engineName, vp, queue, stats) {
  const browser = await engine.launch();
  while (queue.length) {
    const r = queue.pop();
    if (!r) break;
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: vp.mobile ? 3 : 1,
      isMobile: vp.mobile && engineName === 'webkit',
      hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 180)));
    const t0 = Date.now();
    try {
      if (HIDDEN) {
        await page.addInitScript(() => {
          Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' });
          Object.defineProperty(document, 'hidden', { get: () => true });
        });
      }
      await page.goto(url(r), { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(9000);
      const s = await page.evaluate(probe);
      s.engine = engineName;
      s.viewport = vp.name;
      s.ms = Date.now() - t0;
      s.pageErrors = errors.slice(0, 3);
      s.techLabel = r.techLabel;
      s.hiddenRun = HIDDEN;
      s.t = new Date().toISOString();
      s.observer = 'grid';
      appendFileSync(OUT, JSON.stringify(s) + '\n');
      stats.done++;
      if ((s.failures && s.failures.length) || !s.card || s.attribCovered > 0) stats.bad++;
      if (stats.done % 10 === 0) {
        console.log('[' + engineName + '/' + vp.name + '] ' + stats.done + ' done, '
          + stats.bad + ' with findings, queue ' + queue.length);
      }
    } catch (e) {
      appendFileSync(OUT, JSON.stringify({
        repd: r.repd, engine: engineName, viewport: vp.name,
        error: String(e.message).slice(0, 200), observer: 'grid', t: new Date().toISOString(),
      }) + '\n');
      stats.errors++;
    }
    await ctx.close();
  }
  await browser.close();
}

const all = await harvest();
const rows = all.filter(r => !r.noMap && r.latitude && r.longitude).slice(0, LIMIT);
console.log('grid: ' + rows.length + ' projects x ' + VIEWPORTS.length
  + ' viewports x 2 engines, ' + WORKERS + ' workers, hidden=' + HIDDEN);

const stats = { done: 0, bad: 0, errors: 0 };
const jobs = [];
for (const vp of VIEWPORTS) {
  for (const pair of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    jobs.push({ eng: pair[0], name: pair[1], vp, queue: rows.slice() });
  }
}
const perJob = Math.max(1, Math.floor(WORKERS / jobs.length));
const lanes = [];
for (const j of jobs) {
  for (let i = 0; i < perJob; i++) lanes.push(worker(j.eng, j.name, j.vp, j.queue, stats));
}
await Promise.all(lanes);
console.log('GRID COMPLETE: ' + stats.done + ' arrivals, ' + stats.bad
  + ' with findings, ' + stats.errors + ' errors -> ' + OUT);
