/* atlas-menu-contracts: (A) fail-closed gate on the REAL DOM, injected from the Node side
   with a tight poll the instant the engine's panel exists (before Pipeline News and the
   menu can complete); (B) bottom sheet on both phones with the CSS-only fullscreen path
   (element-fullscreen API removed, as a gesture-less deep-link arrival gets on a real
   phone), plus the granted-fullscreen case recorded for contrast. Lead's offline shim. */
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8103/gridatlas/atlas/';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/atlas-menu-contracts';
const DEEP = BASE + '?technology=solar&latitude=52.6369&longitude=-1.1398&zoom=10&project=GRIDATLAS_PROOF_menu_contracts&capacity_mw=10';
const report = { started: new Date().toISOString(), runs: [] };
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); return name + '.png'; }
const HIT = (sel) => { const el = document.querySelector(sel); if (!el) return { sel, found: false }; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const label = el.closest('label'); return { sel, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], top: top ? top.tagName + (top.id ? '#' + top.id : '') + (typeof top.className === 'string' && top.className ? '.' + top.className.trim().split(/\s+/).join('.') : '') : null, hit_ok: top === el || !!(label && label.contains(top)), in_viewport: r.top >= 0 && r.bottom <= innerHeight }; };
const INVENTORY = () => { const m = window.__GRIDATLAS_MODULES__?.menuBar; const q = (s) => document.querySelectorAll(s).length; return { installed: !!m?.installed, failure: m?.failure ?? null, tries: m?.tries ?? null, waiting_for: m?.waiting_for ?? null, inspect: m ? m.inspect() : null, bar: !!document.getElementById('gridatlas-menu-bar'), banner: document.getElementById('gridatlas-menu-bar-failure')?.textContent || null, scada_engine: q('#scada-ui-container input[type="checkbox"][data-layer-id]'), scada_pn: q('#scada-ui-container input[type="checkbox"][data-pn-layer]'), scada_checkboxes: q('#scada-ui-container input[type="checkbox"]'), proxies: q('[data-gridatlas-layer-proxy]'), map_controls_display: getComputedStyle(document.querySelector('.map-controls')).display, hud_header_parent: document.querySelector('.hud-header')?.parentElement?.className || null, scada_wrapper_display: getComputedStyle(document.querySelector('.scada-wrapper')).display }; };
const MODE = process.argv[2] || 'all';
const browser = await chromium.launch();

/* ---------- (A) fail-closed gate ---------- */
const INJECT = (variant) => {
  const host = document.getElementById('scada-ui-container');
  if (!host || !host.querySelector('.key-group')) return null;
  if (host.querySelector('[data-menu-contracts-injected]')) return 'already';
  const g = document.createElement('div'); g.className = 'key-group'; g.setAttribute('data-menu-contracts-injected', variant); g.innerHTML = '<div class="key-title">WEATHER (INJECTED)</div>';
  const l = document.createElement('label'); l.className = 'key-item'; const i = document.createElement('input'); i.type = 'checkbox'; i.id = 'menu-contracts-injected-input'; i.setAttribute('data-weather-layer', 'uk_lightning');
  if (variant === 'engine61') { i.setAttribute('data-layer-id', 'uk_lightning'); i.dataset.layerId = 'uk_lightning'; }
  if (variant === 'pipeline4') { i.setAttribute('data-pn-layer', 'uk_lightning'); i.dataset.pnLayer = 'uk_lightning'; }
  const s = document.createElement('span'); s.style.color = '#ffdf44'; s.textContent = 'Lightning (injected) [WAIT]'; l.append(i, ' ', s); g.appendChild(l); host.appendChild(g);
  const m = window.__GRIDATLAS_MODULES__?.menuBar;
  return { menu_installed_at_injection: !!m?.installed, menu_tries_at_injection: m?.tries ?? null, pn_groups_at_injection: host.querySelectorAll('[data-pn-group]').length, engine_now: host.querySelectorAll('input[data-layer-id]').length, pn_now: host.querySelectorAll('input[data-pn-layer]').length };
};
for (const variant of (MODE === 'sheet' ? [] : ['engine61', 'pipeline4', 'neutral'])) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const run = { viewport: 'desktop-1440x900', test: 'fail-closed-' + variant, attempt, page_errors: [], steps: {} };
    page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 200)));
    const shim = await installOfflineShim(page);
    const S = run.steps;
    try {
      await page.goto(BASE, { waitUntil: 'commit', timeout: 60000 });
      const t0 = Date.now(); let injected = null;
      while (Date.now() - t0 < 60000) { injected = await page.evaluate(INJECT, variant).catch(() => null); if (injected && injected !== 'already') break; }
      S.injection = { ...injected, after_ms: Date.now() - t0 };
      if (!injected || injected.menu_installed_at_injection) { S.race = 'lost (menu already installed) - retrying'; report.runs.push(run); await context.close(); continue; }
      try { await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true || !!document.getElementById('gridatlas-menu-bar-failure'), null, { timeout: 75000 }); } catch {}
      await page.waitForTimeout(1200);
      S.outcome = await page.evaluate(INVENTORY);
      S.shot = await shot(page, 'G-failclosed-' + variant);
      const dc = page.locator('#scada-ui-container input[data-layer-id="dc"]'); await dc.scrollIntoViewIfNeeded();
      S.hit_dc = await page.evaluate(HIT, '#scada-ui-container input[data-layer-id="dc"]');
      await dc.click(); await page.waitForTimeout(300);
      S.dc_after_click = await page.evaluate(() => ({ scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, label: document.getElementById('lbl-dc').textContent, vis: window.__GRIDATLAS_V9_MAP__?.getLayoutProperty('l-dc', 'visibility') }));
      await dc.click(); await page.waitForTimeout(200);
      const inj = page.locator('#menu-contracts-injected-input'); await inj.scrollIntoViewIfNeeded();
      S.hit_injected = await page.evaluate(HIT, '#menu-contracts-injected-input');
      const errs = run.page_errors.length; await inj.click(); await page.waitForTimeout(400);
      S.injected_click = await page.evaluate(() => ({ checked: document.getElementById('menu-contracts-injected-input').checked, label: document.querySelector('#menu-contracts-injected-input ~ span').textContent, engine_checked: document.querySelectorAll('input[data-layer-id]:checked').length, pn_checked: document.querySelectorAll('input[data-pn-layer]:checked').length, pn_state_active: window.__GRIDATLAS_PIPELINE_LAYERS__?.active, pn_failures: window.__GRIDATLAS_PIPELINE_LAYERS__?.failures, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, menu: window.__GRIDATLAS_MODULES__.menuBar.inspect() }));
      S.injected_click_new_page_errors = run.page_errors.slice(errs);
    } catch (e) { run.error = String(e.stack || e).slice(0, 900); try { S.error_shot = await shot(page, 'G-failclosed-' + variant + '-error'); } catch {} }
    run.shim = shim.summary(); report.runs.push(run); await context.close();
    console.log('fail-closed', variant, 'attempt', attempt, run.error ? 'ERROR ' + run.error.split('\n')[0] : (S.race || 'ok'));
    if (!S.race) break;
  }
}

/* ---------- (B) bottom sheet on both phones ---------- */
const phones = [
  { name: 'android-393x852', ctx: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } },
  { name: 'android-360x740', ctx: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } }
];
for (const cfg of (MODE === 'failclosed' ? [] : phones)) for (const noFsApi of (MODE === 'sheet' ? [true] : [true, false])) {
  const context = await browser.newContext(cfg.ctx);
  if (noFsApi) await context.addInitScript(() => { try { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen; } catch (e) {} });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const run = { viewport: cfg.name, test: 'bottom-sheet', fullscreen_path: noFsApi ? 'CSS-only (element-fullscreen API removed: what a gesture-less deep-link arrival gets on a real phone)' : 'element fullscreen granted by headless Chromium without a gesture (contrast case)', page_errors: [], steps: {} };
  page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 200)));
  const shim = await installOfflineShim(page); const S = run.steps;
  try {
    await page.goto(DEEP, { waitUntil: 'domcontentloaded', timeout: 60000 });
    S.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
    let sheet = false; try { await page.waitForFunction(() => document.documentElement.classList.contains('gridatlas-sheet-open'), null, { timeout: 45000 }); sheet = true; } catch {}
    await page.waitForTimeout(1500);
    S.sheet_open = sheet;
    S.state = await page.evaluate(() => { const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; return { fs_active: document.body.classList.contains('fs-active'), fullscreenElement: document.fullscreenElement ? document.fullscreenElement.id : null, sheet: R(document.querySelector('.maplibregl-popup.gridatlas-sheet')), sheet_min: !!document.querySelector('.maplibregl-popup.gridatlas-sheet.gridatlas-min'), toggle: R(document.getElementById('gridatlas-dash-toggle')), toggle_hidden: document.getElementById('gridatlas-dash-toggle').hidden, map_controls: R(document.querySelector('.map-controls')), collapsed: document.querySelector('.scada-wrapper').getAttribute('data-gridatlas-collapsed'), inspect: window.__GRIDATLAS_MODULES__.menuBar.inspect() }; });
    S.shot = await shot(page, 'G-' + cfg.name + '-sheet-' + (noFsApi ? 'cssfs' : 'truefs'));
    S.hit_toggle = await page.evaluate(HIT, '#gridatlas-dash-toggle');
    S.hit_chips = await page.evaluate(() => Array.from(document.querySelectorAll('#gridatlas-mobile-tray button')).filter((b) => !b.hidden).map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: b.textContent.trim(), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hit_ok: t === b || b.contains(t), top: t && (t.tagName + '#' + t.id) }; }));
    await page.getByRole('button', { name: 'Grid', exact: true }).tap(); await page.waitForFunction(() => document.getElementById('gridatlas-menu-bar-panel-4').hidden === false); await page.waitForTimeout(250);
    S.hit_grid_400 = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:400"]');
    const pdc = page.locator('[data-gridatlas-layer-proxy="engine:dc"]'); await pdc.scrollIntoViewIfNeeded(); await pdc.tap(); await page.waitForTimeout(300);
    S.grid_proxy_dc = await page.evaluate(() => ({ original: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden })); await pdc.tap(); await page.waitForTimeout(200);
    S.shot_grid = await shot(page, 'G-' + cfg.name + '-sheet-' + (noFsApi ? 'cssfs' : 'truefs') + '-grid');
    await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll()); await page.waitForTimeout(200);
    if (S.hit_toggle.hit_ok) {
      await page.locator('#gridatlas-dash-toggle').tap(); await page.waitForTimeout(600);
      S.scada_under_sheet = await page.evaluate(() => { const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; const host = document.getElementById('scada-ui-container'); const first = host.querySelector('input[data-layer-id="400"]'); const r = first.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const sheet = document.querySelector('.maplibregl-popup.gridatlas-sheet'); return { collapsed: document.querySelector('.scada-wrapper').getAttribute('data-gridatlas-collapsed'), wrapper: R(document.querySelector('.scada-wrapper')), host: R(host), sheet: sheet ? R(sheet) : null, first_400: R(first), first_in_viewport: r.top >= 0 && r.bottom <= innerHeight, top_at_first: t && (t.tagName + '#' + t.id + '.' + (typeof t.className === 'string' ? t.className.trim().split(/\s+/).join('.') : '')), first_hit_ok: t === first || first.closest('label').contains(t), doc_scrollHeight: document.documentElement.scrollHeight, scrollY: window.scrollY, inner: innerHeight }; });
      // try the real tap on the first SCADA control under the sheet, short timeout: a refusal is a finding
      try { await page.locator('#scada-ui-container input[data-layer-id="400"]').tap({ timeout: 8000 }); S.scada_under_sheet.tap_400 = 'performed'; await page.waitForTimeout(200); S.scada_under_sheet.after = await page.evaluate(() => document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked); await page.locator('#scada-ui-container input[data-layer-id="400"]').tap({ timeout: 8000 }); } catch (e) { S.scada_under_sheet.tap_400 = 'REFUSED: ' + (String(e.message).match(/<[^>]+> from <[^>]+>[^\n]*intercepts pointer events|Timeout[^\n]*/) || [String(e.message).split('\n')[0]])[0].slice(0, 200); }
      S.shot_layers = await shot(page, 'G-' + cfg.name + '-sheet-' + (noFsApi ? 'cssfs' : 'truefs') + '-layers-open');
    }
  } catch (e) { run.error = String(e.stack || e).slice(0, 900); try { S.error_shot = await shot(page, 'G-' + cfg.name + '-sheet-error'); } catch {} }
  run.shim = shim.summary(); report.runs.push(run); await context.close();
  console.log(cfg.name, noFsApi ? 'cssfs' : 'truefs', run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
}
await browser.close();
const outName = 'menu-contracts.' + (MODE === 'all' ? 'failclosed' : MODE) + '.json';
fs.writeFileSync(path.join(OUT, outName), JSON.stringify(report, null, 2));
console.log('written ' + outName);
