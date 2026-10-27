// kv-engine lane: lightning NEAREST SUBSTATIONS vs the original deep-link arrival engine.
// usage: node kv-engine.browser.mjs <phase> ; phase = repro | deeplink | proto
// One Chromium, one context, closed at the end. Server: python3 -m http.server 8201 (hardening/).
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PHASE = process.argv[2] || 'repro';
const BASE = 'http://127.0.0.1:8201/wt/atlas';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const G = '#scada-ui-container [data-lightning-group="main"]';
const FLASH = [Number(process.env.FX || -1.6956), Number(process.env.FY || 51.437702)];
const out = { phase: PHASE, startedAt: new Date().toISOString(), steps: [] };
const save = () => writeFile(join(HERE, `${PHASE}.json`), JSON.stringify(out, null, 2));

const browser = await chromium.launch(process.env.KVLOG ? { headless: true, args: ['--enable-logging=stderr'] } : { headless: true, channel: process.env.KVCH || undefined, args: ['--disable-dev-shm-usage', '--enable-logging=stderr', '--v=0'], env: { ...process.env }, logger: undefined });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: UA, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = []; const consoleErr = [];
page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 300)); });
if (PHASE !== 'deeplink') await page.clock.install({ time: '2026-10-26T18:40:00Z' });
const shim = await installOfflineShim(page);
const shot = n => page.screenshot({ path: join(HERE, n) }).catch(() => {});

// everything the map holds, in draw order, with each layer's source and paint
const snapMap = (prefixes) => page.evaluate((prefixes) => {
  const m = window.__GRIDATLAS_V9_MAP__; if (!m) return null;
  const st = m.getStyle(); const layers = st.layers.map((l, i) => ({ i, id: l.id, type: l.type, source: l.source || null, vis: (l.layout || {}).visibility || 'visible' }));
  const pick = layers.filter(l => prefixes.some(p => l.id.startsWith(p)));
  const detail = pick.map(l => ({ ...l, paint: st.layers[l.i].paint, layout: st.layers[l.i].layout, filter: st.layers[l.i].filter }));
  const srcIds = [...new Set(pick.map(l => l.source))];
  const sources = {};
  for (const s of srcIds) { const d = st.sources[s] && st.sources[s].data; sources[s] = typeof d === 'object' ? d : String(d).slice(0, 200); }
  const c = m.getCenter();
  return { total: layers.length, order: layers.map(l => l.id), picked: detail, sources, zoom: m.getZoom(), center: [c.lng, c.lat], bounds: m.getBounds().toArray() };
}, prefixes);
const linkState = () => page.evaluate(() => {
  const L = window.__GRIDATLAS_NEON_LINKS__ || {};
  return { installed: L.installed, substations_loaded: L.substations_loaded, substations_qualifying: L.substations_qualifying, substations_len: Array.isArray(L.substations) ? L.substations.length : null,
    links_drawn: L.links_drawn, arrival_engine: L.arrival_engine, project_pin: L.project_pin, deep_linked: L.deep_linked, camera_from_link: L.camera_from_link, failures: L.failures, last_selection: L.last_selection && JSON.parse(JSON.stringify(L.last_selection)),
    selectAt: typeof L.selectAt, measureKeys: Object.keys(L.measure || {}), linkKeys: Object.keys(L).filter(k => typeof L[k] === 'function') };
});
const cards = () => page.evaluate(() => {
  const r = n => { if (!n) return null; const b = n.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const pop = document.querySelector('.maplibregl-popup'); const lc = document.querySelector('[data-lightning-card]');
  const markers = [...document.querySelectorAll('.maplibregl-marker')].map(n => ({ cls: n.className, rect: r(n), html: n.innerHTML.slice(0, 200) }));
  return { mapRect: r(window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_V9_MAP__.getContainer()),
    popup: pop ? { cls: pop.className, rect: r(pop), bar: pop.querySelector('.gridatlas-card-bar') ? pop.querySelector('.gridatlas-card-bar').outerHTML.slice(0, 600) : null, text: pop.innerText.slice(0, 1500) } : null,
    lightningCard: lc ? { rect: r(lc), text: lc.innerText.slice(0, 1200) } : null, markers, htmlClass: document.documentElement.className, sheetH: document.documentElement.style.getPropertyValue('--gridatlas-sheet-h') };
});
// pixel geometry of the drawn link lines and the fraction visible on the map outside any card
const pixels = (src) => page.evaluate((src) => {
  const m = window.__GRIDATLAS_V9_MAP__; const s = m.getStyle().sources[src]; if (!s || !s.data || !s.data.features) return null;
  const k = m.getContainer().getBoundingClientRect();
  const cardsR = [...document.querySelectorAll('.maplibregl-popup, [data-lightning-card]')].map(n => n.getBoundingClientRect());
  return s.data.features.filter(f => f.geometry.type === 'LineString').map(f => {
    const [a, b] = f.geometry.coordinates.map(c => m.project(c)); const len = Math.hypot(b.x - a.x, b.y - a.y);
    let vis = 0, n = 40; for (let i = 0; i <= n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; const X = k.left + x, Y = k.top + y;
      const inMap = x >= 0 && y >= 0 && x <= k.width && y <= k.height; const covered = cardsR.some(r => X >= r.left && X <= r.right && Y >= r.top && Y <= r.bottom); if (inMap && !covered) vis++; }
    return { from: [Math.round(a.x), Math.round(a.y)], to: [Math.round(b.x), Math.round(b.y)], px: Math.round(len * 10) / 10, visibleFraction: Math.round(vis / (n + 1) * 100) / 100 };
  });
}, src);

async function bootLightning() {
  await page.goto(BASE + '/v/202610270929/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  out.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
  await page.waitForSelector(G, { state: 'attached', timeout: 30000 });
  const st = await page.evaluate(() => document.getElementById('gridatlas-dash-toggle')?.getAttribute('aria-pressed'));
  if (st === 'true') { await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(500); }
  await page.locator(`${G} input[data-lightning-control="toggle"]`).tap({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.locator(`${G} button[data-lightning-period="7d"]`).tap({ timeout: 8000 });
  for (let i = 0; i < 60; i++) { const s = await page.locator(`${G} .status-dot`).innerText().catch(() => ''); if (s && !/LOADING/.test(s)) break; await page.waitForTimeout(250); }
  out.steps.push({ what: '7D on', label: await page.locator(`${G} [data-lightning-label]`).innerText().catch(() => null), status: await page.locator(`${G} .status-dot`).innerText().catch(() => null) });
  // close the Layers panel so the map is tappable, as the owner did
  const st2 = await page.evaluate(() => document.getElementById('gridatlas-dash-toggle')?.getAttribute('aria-pressed'));
  if (st2 === 'false') { await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(700); }
  out.steps.push({ what: 'layers collapsed', dashPressed: await page.evaluate(() => document.getElementById('gridatlas-dash-toggle')?.getAttribute('aria-pressed')) });
}
async function tapFlash() {
  const p = await page.evaluate((F) => { const m = window.__GRIDATLAS_V9_MAP__; const k = m.getContainer().getBoundingClientRect(); const q = m.project(F); const X = k.left + q.x, Y = k.top + q.y; const el = document.elementFromPoint(X, Y); return { X, Y, top: el ? (el.tagName + '.' + el.className).slice(0, 80) : null, zoom: m.getZoom() }; }, FLASH);
  out.steps.push({ what: 'flash screen point', ...p });
  await page.touchscreen.tap(p.X, p.Y); await page.waitForTimeout(1200);
  return p;
}

try {
  if (PHASE === 'repro' || PHASE === 'proto') {
    await bootLightning();
    out.linkBeforeTap = await linkState();
    await shot(`${PHASE}-01-7d-on.png`);
    await tapFlash();
    out.afterFlashTap = { cards: await cards() };
    await shot(`${PHASE}-02-flash-card.png`);
    if (PHASE === 'repro') {
      out.layersBeforeNearest = (await snapMap(['gridatlas-lightning', 'l-neon', 'l-project-pin'])).order;
      await page.locator('[data-lightning-card] button[data-lightning-nearest]').tap({ timeout: 8000 });
      await page.waitForTimeout(1500);
      out.afterNearest = { map: await snapMap(['gridatlas-lightning-nearest', 'gridatlas-lightning', 'l-neon']), cards: await cards(), pixels: await pixels('gridatlas-lightning-nearest'), link: await linkState() };
      await shot('repro-03-after-nearest.png');
      // is anything drawn under the card? hide the card and look again
      await page.evaluate(() => { const c = document.querySelector('[data-lightning-card]'); if (c) c.style.visibility = 'hidden'; });
      await shot('repro-04-card-hidden.png');
      await page.evaluate(() => { const c = document.querySelector('[data-lightning-card]'); if (c) c.style.visibility = ''; });
      // same lines at zoom 12 on the flash: do they exist and render?
      await page.evaluate((F) => window.__GRIDATLAS_V9_MAP__.jumpTo({ center: F, zoom: 11 }), FLASH); await page.waitForTimeout(1500);
      out.atZoom11 = { pixels: await pixels('gridatlas-lightning-nearest'), cards: await cards(), rendered: await page.evaluate(() => window.__GRIDATLAS_V9_MAP__.queryRenderedFeatures({ layers: ['gridatlas-lightning-nearest-core'] }).length) };
      await shot('repro-05-zoom11.png');
    } else {
      // ---- prototype: the ORIGINAL engine draws for the flash, through engine-nearest.js verbatim
      const SRC = await readFile(join(HERE, 'engine-nearest.js'), 'utf8');
      const neon = () => page.evaluate(() => { const s = window.__GRIDATLAS_V9_MAP__.getStyle().sources, L = window.__GRIDATLAS_NEON_LINKS__;
        return { links: s['gridatlas-neon-links']?.data?.features?.length, nodes: s['gridatlas-neon-nodes']?.data?.features?.length, pin: s['gridatlas-project-pin']?.data?.features?.length,
          links_drawn: L.links_drawn, arrival_engine: L.arrival_engine, last_selection: L.last_selection, project_pin: L.project_pin, popups: document.querySelectorAll('.maplibregl-popup').length,
          block: !!document.querySelector('.maplibregl-popup .neon-hd'), htmlClass: document.documentElement.className, sheetH: document.documentElement.style.getPropertyValue('--gridatlas-sheet-h'),
          containerAttrs: [...window.__GRIDATLAS_V9_MAP__.getContainer().attributes].map(a => a.name).filter(n => /arrival/.test(n)), clicks: window.__kvClicks.slice() }; });
      // harness stand-ins for the module's S, pc, note, msg (pc closes Lightning's real card through its own × button)
      await page.evaluate((src) => {
        window.__kvClicks = []; window.__GRIDATLAS_V9_MAP__.on('click', e => window.__kvClicks.push((e.originalEvent && e.originalEvent.target && e.originalEvent.target.className) || 'canvas?'));
        window.S = {}; window.note = (x) => (window.__kvNotes = window.__kvNotes || []).push(String(x)); window.msg = e => String(e && e.message || e);
        window.pc = () => { document.querySelector('[data-lightning-card] button[aria-label="Close"]')?.click(); engineClose(); };
        (0, eval)(src + ';window.engineNearest=engineNearest;window.engineClose=engineClose;');
      }, SRC);
      const run = async (F, when, tag) => {
        const t0 = Date.now();
        const r = await page.evaluate(({ F, when }) => window.engineNearest(window.__GRIDATLAS_V9_MAP__, F[0], F[1], when), { F, when });
        for (let i = 0; i < 40; i++) { const n = await neon(); if (n.arrival_engine && n.arrival_engine.terminal) break; await page.waitForTimeout(250); }
        await page.waitForTimeout(1800);
        const res = { returned: r, ms: Date.now() - t0, map: await snapMap(['l-neon', 'l-project-pin']), cards: await cards(), pixels: await pixels('gridatlas-neon-links'), neon: await neon(), notes: await page.evaluate(() => window.__kvNotes || []) };
        await shot(`proto-${tag}.png`); return res;
      };
      out.protoLand = await run(FLASH, '2026-10-23 02:22:34 UTC', '03-land-engine');
      // a person minimises and restores the docked card through its own bar: the card and lines must survive
      const minB = page.locator('.maplibregl-popup .gridatlas-card-bar .min');
      if (await minB.count()) { await minB.tap(); await page.waitForTimeout(600); out.protoMin = await neon(); await shot('proto-04-expanded.png'); await minB.tap(); await page.waitForTimeout(600); out.protoRestore = await neon(); }
      // close = what pc() does on OFF / × / next tap: remove the engine popup; the engine's own watcher clears the rest
      await page.evaluate(() => window.pc()); await page.waitForTimeout(900);
      out.protoAfterPc = await neon(); await shot('proto-05-after-pc.png');
      // a flash at sea: nothing within 40 km, the engine says so and draws nothing
      out.protoSea = await run([-3.9177, 49.515301], '2026-10-21 12:32:19 UTC', '06-sea-engine');
      await page.evaluate(() => window.pc()); await page.waitForTimeout(900);
      out.protoSeaAfterPc = await neon();
      // land again, then a real OFF gesture through the Layers panel; then pc + camera restore as so(false) would
      out.protoLand2 = { returned: (await run(FLASH, '2026-10-23 02:22:34 UTC', '07-land-again')).returned };
      const st = await page.evaluate(() => document.getElementById('gridatlas-dash-toggle')?.getAttribute('aria-pressed'));
      if (st === 'true') { await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(600); }
      await page.locator(`${G} input[data-lightning-control="toggle"]`).tap({ timeout: 15000 }); await page.waitForTimeout(600);
      out.protoOffWithoutPatch = await neon();
      await page.evaluate(() => { window.pc(); if (S.ev) { window.__GRIDATLAS_V9_MAP__.jumpTo(S.ev); S.ev = null; } document.getElementById('gridatlas-lightning-engine')?.remove(); }); await page.waitForTimeout(900);
      out.protoOffPatched = { ...(await neon()), zoom: await page.evaluate(() => window.__GRIDATLAS_V9_MAP__.getZoom()), lightningLayers: await page.evaluate(() => window.__GRIDATLAS_V9_MAP__.getStyle().layers.filter(l => /lightning/.test(l.id)).map(l => l.id)), styleEl: await page.evaluate(() => !!document.getElementById('gridatlas-lightning-engine')) };
      await shot('proto-08-off.png');
    }
  } else if (PHASE === 'deeplink') {
    await page.goto(BASE + '/?repd_ref=12588&technology=solar&latitude=51.8132088&longitude=-1.3489728&zoom=12', { waitUntil: 'domcontentloaded', timeout: 90000 });
    out.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 1000 });
    const t0 = Date.now();
    for (;;) { const s = await linkState(); if ((s.links_drawn > 0 && s.arrival_engine && s.arrival_engine.terminal) || Date.now() - t0 > 90000) break; await page.waitForTimeout(500); }
    await page.waitForTimeout(1500);
    await shot('deeplink-01-arrival.png');
    try { out.cards = await cards(); } catch (e) { out.cardsErr = String(e).slice(0, 200); }
    try { out.pixels = await pixels('gridatlas-neon-links'); } catch (e) { out.pixelsErr = String(e).slice(0, 200); }
    out.link = await linkState();
    out.map = await snapMap(['l-neon', 'l-project-pin']);
    out.place = await page.evaluate(() => { const p = window.__GRIDATLAS_PLACE_SEARCH__; return p ? JSON.parse(JSON.stringify({ deep_link: p.deep_link })) : null; });
    out.windowFns = await page.evaluate(() => Object.keys(window).filter(k => /GRIDATLAS/.test(k)));
    await shot('deeplink-01-arrival.png');
  }
} catch (e) { out.error = String(e.stack || e).slice(0, 1500); }
out.pageErrors = errors; out.consoleErrors = consoleErr.slice(0, 30); out.shim = shim.summary();
await save();
await ctx.close(); await browser.close();
console.log(PHASE, 'done', out.error ? 'ERROR ' + out.error.split('\n')[0] : 'ok', 'pageErrors', errors.length);
