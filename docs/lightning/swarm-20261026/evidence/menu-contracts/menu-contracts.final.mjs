/* atlas-menu-contracts, consolidated pass on the lead's offline shim (BRIEF.md "Offline harness").
   1. Per-surface counts and the live inventory at 1440x900, 393x852, 360x740.
   2. Hit-tested interactions (real click/tap, no force:true): SCADA original, Grid proxy,
      basemap radio, keyboard; phones open the collapsed Layers panel with the real toggle.
   3. Bottom sheet (deep-link arrival) on both phones: occlusion of the toggle, chips, Grid
      proxies, and of the SCADA panel itself when opened under the sheet.
   4. Fail-closed gate on the REAL DOM (desktop): a 61st data-layer-id or a 4th data-pn-layer
      injected the instant the engine builds its panel (before the menu can install) must
      leave the menu uninstalled with the loud failure banner; a neutral weather-style
      control injected the same way must not. */
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8103/gridatlas/atlas/';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/atlas-menu-contracts';
const DEEP = BASE + '?technology=solar&latitude=52.6369&longitude=-1.1398&zoom=10&project=GRIDATLAS_PROOF_menu_contracts&capacity_mw=10';
const report = { started: new Date().toISOString(), harness: 'lead offline-shim.mjs (MapLibre 3.6.2 npm tarball sha256 c46084df…, background-only style, data-gridatlas clone); no force:true', runs: [] };

const COUNTS = () => {
  const q = (s, r = document) => Array.from(r.querySelectorAll(s));
  const host = document.getElementById('scada-ui-container'), curtain = document.getElementById('fs-curtain-keys'), grid = document.getElementById('gridatlas-menu-bar-panel-4');
  const mb = window.__GRIDATLAS_MODULES__?.menuBar;
  return {
    generation: document.documentElement.dataset.gridatlasGeneration,
    scada: { engine: q('input[type="checkbox"][data-layer-id]', host).length, pn: q('input[type="checkbox"][data-pn-layer]', host).length, checkboxes: q('input[type="checkbox"]', host).length, radios: q('input[type="radio"]', host).length, groups: q('.key-group', host).map((g) => g.querySelector('.key-title')?.textContent.trim()) },
    curtain: { engine: q('input[type="checkbox"][data-layer-id]', curtain).length, pn: q('input[type="checkbox"][data-pn-layer]', curtain).length, groups: q('.key-group', curtain).length },
    grid: grid ? { proxies: q('[data-gridatlas-layer-proxy]', grid).length, engine_proxies: q('[data-gridatlas-layer-proxy^="engine:"]', grid).length, pn_proxies: q('[data-gridatlas-layer-proxy^="pipeline:"]', grid).length, radios: q('input[name="gridatlas-menu-basemap"]', grid).length, groups: q('.gm-layer-group', grid).map((g) => g.textContent.trim()) } : null,
    document: { engine: q('input[data-layer-id]').length, pn: q('input[data-pn-layer]').length, proxies: q('[data-gridatlas-layer-proxy]').length },
    menu: mb ? { installed: mb.installed, failure: mb.failure, inspect: mb.inspect(), counts: [mb.engine_layer_controls, mb.pipeline_layer_controls, mb.layer_controls, mb.expected_layer_controls], tries: mb.tries, banner: document.getElementById('gridatlas-menu-bar-failure')?.textContent || null } : null,
    collapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed'), sheet: document.documentElement.classList.contains('gridatlas-sheet-open'), fs: document.body.classList.contains('fs-active'), viewport: [innerWidth, innerHeight]
  };
};
const HIT = (sel) => { const el = document.querySelector(sel); if (!el) return { sel, found: false }; const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const label = el.closest('label'); return { sel, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], top: top ? top.tagName + (top.id ? '#' + top.id : '') + (typeof top.className === 'string' && top.className ? '.' + top.className.trim().split(/\s+/).join('.') : '') : null, hit_ok: top === el || !!(label && label.contains(top)), in_viewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; };
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); return name + '.png'; }
async function gridOpen(page) { await page.getByRole('button', { name: 'Grid', exact: true }).click(); await page.waitForFunction(() => document.getElementById('gridatlas-menu-bar-panel-4')?.hidden === false, null, { timeout: 5000 }); await page.waitForTimeout(250); }
const gridState = (page) => page.evaluate(() => ({ hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden, expanded: document.getElementById('gridatlas-menu-bar-title-4').getAttribute('aria-expanded') }));
const dcState = (page) => page.evaluate(() => ({ scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]')?.checked, label: document.getElementById('lbl-dc').textContent, vis: window.__GRIDATLAS_V9_MAP__?.getLayoutProperty('l-dc', 'visibility') }));

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const configs = [
  { name: 'desktop-1440x900', touch: false, ctx: { viewport: { width: 1440, height: 900 } } },
  { name: 'android-393x852', touch: true, ctx: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } },
  { name: 'android-360x740', touch: true, ctx: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } }
];
const browser = await chromium.launch();

async function boot(cfg, url, init) {
  const context = await browser.newContext(cfg.ctx);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const run = { viewport: cfg.name, url, page_errors: [], steps: {} };
  page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 200)));
  const shim = await installOfflineShim(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  run.steps.composition = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
  run.shim = shim;
  return { context, page, run };
}

/* ---------- 1 + 2: counts and hit-tested interactions ---------- */
for (const cfg of configs) {
  const { context, page, run } = await boot(cfg, BASE);
  const act = cfg.touch ? (l) => l.tap() : (l) => l.click();
  const S = run.steps;
  try {
    S.counts = await page.evaluate(COUNTS);
    S.shot_arrival = await shot(page, 'F-' + cfg.name + '-arrival');
    S.hit_400_on_arrival = await page.evaluate(HIT, '#scada-ui-container input[data-layer-id="400"]');
    if (S.counts.collapsed === '1') {
      S.toggle_hit = await page.evaluate(HIT, '#gridatlas-dash-toggle');
      await act(page.locator('#gridatlas-dash-toggle'));
      await page.waitForFunction(() => !document.querySelector('.scada-wrapper').hasAttribute('data-gridatlas-collapsed'), null, { timeout: 5000 }); await page.waitForTimeout(400);
      S.toggle_after = await page.evaluate(() => ({ text: document.getElementById('gridatlas-dash-toggle').textContent, wrapper_h: Math.round(document.querySelector('.scada-wrapper').getBoundingClientRect().height) }));
      S.shot_layers_open = await shot(page, 'F-' + cfg.name + '-layers-open');
    }
    for (const [k, sel] of [['400', '#scada-ui-container input[data-layer-id="400"]'], ['dc', '#scada-ui-container input[data-layer-id="dc"]'], ['caes', '#scada-ui-container input[data-layer-id="caes"]'], ['pn_all', '#scada-ui-container input[data-pn-layer="all"]']]) {
      await page.locator(sel).scrollIntoViewIfNeeded(); S['hit_scada_' + k] = await page.evaluate(HIT, sel);
    }
    const dc = page.locator('#scada-ui-container input[data-layer-id="dc"]'); await dc.scrollIntoViewIfNeeded();
    S.scada_dc_before = await dcState(page); await act(dc); await page.waitForTimeout(300); S.scada_dc_after = await dcState(page); await act(dc); await page.waitForTimeout(200); S.scada_dc_revert = await dcState(page);
    await gridOpen(page);
    S.grid_hit_400 = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:400"]');
    const pdc = page.locator('[data-gridatlas-layer-proxy="engine:dc"]'); await pdc.scrollIntoViewIfNeeded(); S.grid_hit_dc = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:dc"]');
    await act(pdc); await page.waitForTimeout(300); S.grid_proxy_dc = { ...(await dcState(page)), ...(await gridState(page)) };
    await act(pdc); await page.waitForTimeout(200); S.grid_proxy_dc_revert = { ...(await dcState(page)), ...(await gridState(page)) };
    S.shot_grid = await shot(page, 'F-' + cfg.name + '-grid-open');
    const sat = page.locator('input[name="gridatlas-menu-basemap"][value="sat"]'); await sat.scrollIntoViewIfNeeded(); await act(sat); await page.waitForTimeout(300); S.basemap_sat_closes = await gridState(page);
    await gridOpen(page); const dark = page.locator('input[name="gridatlas-menu-basemap"][value="dark"]'); await dark.scrollIntoViewIfNeeded(); await act(dark); await page.waitForTimeout(300);
    S.basemap_restored = await page.evaluate(() => document.querySelector('#scada-ui-container input[name="bm"][value="dark"]').checked);
    if (!cfg.touch) {
      await page.evaluate(() => document.getElementById('gridatlas-menu-bar-title-4').focus()); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
      S.kbd_arrowdown_focus = await page.evaluate(() => document.activeElement?.getAttribute('data-gridatlas-layer-proxy') || document.activeElement?.id);
      await page.keyboard.press('Space'); await page.waitForTimeout(300);
      S.kbd_space = await page.evaluate(() => ({ original_400: document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden }));
      await page.keyboard.press('Space'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      S.kbd_escape = await page.evaluate(() => ({ panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden, focus: document.activeElement?.id, original_400: document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked }));
    }
    S.tray = await page.evaluate(() => Array.from(document.querySelectorAll('#gridatlas-mobile-tray button')).filter((b) => !b.hidden).map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: b.textContent.trim(), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hit_ok: t === b || b.contains(t) }; }));
    S.counts_final = await page.evaluate(COUNTS);
  } catch (e) { run.error = String(e.stack || e).slice(0, 900); try { S.error_shot = await shot(page, 'F-' + cfg.name + '-error'); } catch {} }
  run.shim = run.shim.summary(); report.runs.push(run); await context.close();
  console.log(cfg.name, run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
}

/* ---------- 3: bottom sheet on both phones ---------- */
for (const cfg of configs.slice(1)) {
  const { context, page, run } = await boot({ ...cfg, name: cfg.name + '-sheet' }, DEEP);
  const S = run.steps;
  try {
    let sheet = false; try { await page.waitForFunction(() => document.documentElement.classList.contains('gridatlas-sheet-open'), null, { timeout: 45000 }); sheet = true; } catch {}
    await page.waitForTimeout(1500);
    S.sheet_open = sheet; S.counts = await page.evaluate(COUNTS);
    S.geometry = await page.evaluate(() => { const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; return { sheet: R(document.querySelector('.maplibregl-popup.gridatlas-sheet')), sheet_min: !!document.querySelector('.maplibregl-popup.gridatlas-sheet.gridatlas-min'), toggle: R(document.getElementById('gridatlas-dash-toggle')), map_controls: R(document.querySelector('.map-controls')), scada_wrapper: R(document.querySelector('.scada-wrapper')), fullscreenElement: !!document.fullscreenElement }; });
    S.shot = await shot(page, 'F-' + cfg.name + '-sheet-arrival');
    S.hit_toggle = await page.evaluate(HIT, '#gridatlas-dash-toggle');
    S.hit_chips = await page.evaluate(() => Array.from(document.querySelectorAll('#gridatlas-mobile-tray button')).filter((b) => !b.hidden).map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: b.textContent.trim(), hit_ok: t === b || b.contains(t), top: t && t.tagName + '#' + t.id }; }));
    // Grid dropdown over the sheet
    await gridOpen(page); S.hit_grid_400 = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:400"]');
    const pdc = page.locator('[data-gridatlas-layer-proxy="engine:dc"]'); await pdc.scrollIntoViewIfNeeded(); await pdc.tap(); await page.waitForTimeout(300);
    S.grid_proxy_dc_with_sheet = { ...(await dcState(page)), ...(await gridState(page)) }; await pdc.tap(); await page.waitForTimeout(200);
    S.shot_grid = await shot(page, 'F-' + cfg.name + '-sheet-grid-open');
    await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll());
    // The SCADA panel opened UNDER the sheet: is any original control hittable?
    const toggle = page.locator('#gridatlas-dash-toggle');
    if (await toggle.evaluate((t) => !t.hidden && t.offsetWidth > 0)) {
      await toggle.tap(); await page.waitForTimeout(500);
      S.scada_under_sheet = await page.evaluate(() => { const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; const host = document.getElementById('scada-ui-container'); const first = host.querySelector('input[data-layer-id="400"]'); const r = first.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { collapsed: document.querySelector('.scada-wrapper').getAttribute('data-gridatlas-collapsed'), wrapper: R(document.querySelector('.scada-wrapper')), host: R(host), first_400: R(first), first_in_viewport: r.top >= 0 && r.bottom <= innerHeight, top_at_first: t && (t.tagName + '#' + t.id + '.' + (typeof t.className === 'string' ? t.className.trim().split(/\s+/).join('.') : '')), first_hit_ok: t === first || first.closest('label').contains(t), page_scrollHeight: document.documentElement.scrollHeight, inner: innerHeight }; });
      S.shot_scada_under_sheet = await shot(page, 'F-' + cfg.name + '-sheet-layers-open');
    } else S.scada_under_sheet = { toggle_hidden: true };
  } catch (e) { run.error = String(e.stack || e).slice(0, 900); try { S.error_shot = await shot(page, 'F-' + cfg.name + '-sheet-error'); } catch {} }
  run.shim = run.shim.summary(); report.runs.push(run); await context.close();
  console.log(cfg.name + '-sheet', run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
}

/* ---------- 4: fail-closed gate on the real DOM ---------- */
const INJECT = (variant) => `(() => {
  const mark = (el) => { el.setAttribute('data-menu-contracts-injected', '${variant}'); return el; };
  const build = () => {
    const host = document.getElementById('scada-ui-container'); if (!host || !host.querySelector('.key-group') || host.querySelector('[data-menu-contracts-injected]')) return false;
    const g = mark(document.createElement('div')); g.className = 'key-group'; g.innerHTML = '<div class="key-title">WEATHER (INJECTED)</div>';
    const l = document.createElement('label'); l.className = 'key-item'; const i = document.createElement('input'); i.type = 'checkbox';
    if ('${variant}' === 'engine61') { i.setAttribute('data-layer-id', 'uk_lightning'); i.dataset.layerId = 'uk_lightning'; }
    if ('${variant}' === 'pipeline4') { i.setAttribute('data-pn-layer', 'uk_lightning'); i.dataset.pnLayer = 'uk_lightning'; }
    i.setAttribute('data-weather-layer', 'uk_lightning'); i.id = 'menu-contracts-injected-input';
    const s = document.createElement('span'); s.style.color = '#ffdf44'; s.textContent = 'Lightning (injected) [WAIT]'; l.append(i, ' ', s); g.appendChild(l); host.appendChild(g);
    window.__MENU_CONTRACTS_INJECTED_AT__ = { t: performance.now(), menu_installed_then: !!(window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar && window.__GRIDATLAS_MODULES__.menuBar.installed) };
    return true;
  };
  const mo = new MutationObserver(() => { if (build()) mo.disconnect(); });
  document.addEventListener('DOMContentLoaded', () => mo.observe(document.documentElement, { childList: true, subtree: true }));
  if (document.readyState !== 'loading') mo.observe(document.documentElement, { childList: true, subtree: true });
})();`;
for (const variant of ['engine61', 'pipeline4', 'neutral']) {
  const cfg = { ...configs[0], name: 'desktop-1440x900-failclosed-' + variant };
  const context = await browser.newContext(cfg.ctx);
  await context.addInitScript(INJECT(variant));
  const page = await context.newPage();
  const run = { viewport: cfg.name, variant, url: BASE, page_errors: [], steps: {} };
  page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 200)));
  const shim = await installOfflineShim(page);
  const S = run.steps;
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !!window.__MENU_CONTRACTS_INJECTED_AT__, null, { timeout: 60000 });
    S.injected = await page.evaluate(() => window.__MENU_CONTRACTS_INJECTED_AT__);
    // Wait for either the install or the loud failure (MAX_TRIES 160 x 250 ms = 40 s), plus margin.
    try { await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true || !!document.getElementById('gridatlas-menu-bar-failure'), null, { timeout: 70000 }); } catch {}
    await page.waitForTimeout(1500);
    S.counts = await page.evaluate(COUNTS);
    S.menu = await page.evaluate(() => { const m = window.__GRIDATLAS_MODULES__.menuBar; return { installed: m.installed, failure: m.failure, tries: m.tries, waiting_for: m.waiting_for, bar_present: !!document.getElementById('gridatlas-menu-bar'), banner: document.getElementById('gridatlas-menu-bar-failure')?.textContent || null, map_controls_display: getComputedStyle(document.querySelector('.map-controls')).display, scada_wrapper_display: getComputedStyle(document.querySelector('.scada-wrapper')).display, hud_header_parent: document.querySelector('.hud-header')?.parentElement?.className }; });
    S.shot = await shot(page, 'F-' + cfg.name);
    // Originals must remain reachable either way: real click on dc in the SCADA panel.
    const dc = page.locator('#scada-ui-container input[data-layer-id="dc"]'); await dc.scrollIntoViewIfNeeded();
    S.hit_dc = await page.evaluate(HIT, '#scada-ui-container input[data-layer-id="dc"]'); await dc.click(); await page.waitForTimeout(300);
    S.dc_after = await page.evaluate(() => ({ scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, label: document.getElementById('lbl-dc').textContent }));
    await dc.click();
    // And the injected control itself, with a real click: what does the engine do with it?
    const inj = page.locator('#menu-contracts-injected-input'); await inj.scrollIntoViewIfNeeded();
    const errs = run.page_errors.length; await inj.click(); await page.waitForTimeout(300);
    S.injected_click = await page.evaluate(() => ({ checked: document.getElementById('menu-contracts-injected-input').checked, engine_checked: document.querySelectorAll('input[data-layer-id]:checked').length, pn_checked: document.querySelectorAll('input[data-pn-layer]:checked').length, label: document.querySelector('#menu-contracts-injected-input ~ span').textContent, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, proxy_for_injected: !!document.querySelector('[data-gridatlas-layer-proxy="engine:uk_lightning"],[data-gridatlas-layer-proxy="pipeline:uk_lightning"]') }));
    S.injected_click_new_page_errors = run.page_errors.slice(errs);
  } catch (e) { run.error = String(e.stack || e).slice(0, 900); try { S.error_shot = await shot(page, 'F-' + cfg.name + '-error'); } catch {} }
  run.shim = shim.summary(); report.runs.push(run); await context.close();
  console.log(cfg.name, run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'menu-contracts.final.json'), JSON.stringify(report, null, 2));
console.log('written menu-contracts.final.json');
