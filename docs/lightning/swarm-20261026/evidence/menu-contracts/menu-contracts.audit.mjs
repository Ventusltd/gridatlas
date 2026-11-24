/* atlas-menu-contracts: native menu / layer-control invariant audit against the
   SERVED original composition (generation 202609241334) on port 8103.

   Harness substitutions (labelled, hash-verified, no allowlist bypass):
   - cdn.jsdelivr.net maplibre-gl@3.6.2 js/css -> local copy of the GitHub release
     dist (sha256 c46084df... / 731181d4...), because the CDN host is policy-denied.
   - basemaps.cartocdn.com style.json -> minimal local style with a black
     background so MapLibre fires 'load' (the engine builds its panel inside
     map.on('load')). Basemap tiles remain BLOCKED_DEPENDENCY.
   Everything else goes to the network and may fail naturally.

   No force:true anywhere. All clicks/taps are Playwright actionability-checked. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8103/gridatlas/atlas/';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/atlas-menu-contracts';
const FIX = path.join(OUT, 'fixtures', 'maplibre-gl@3.6.2');
const STUB_STYLE = JSON.stringify({ version: 8, name: 'harness-black-stub', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#000000' } }] });

const report = { started: new Date().toISOString(), base: BASE, runs: [] };

function log(...a) { console.log(...a); }

async function openPage(browser, viewportName, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const run = { viewport: viewportName, contextOptions: { ...contextOptions }, console_errors: [], page_errors: [], failed_requests: [], steps: {} };
  page.on('console', (m) => { if (m.type() === 'error') run.console_errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 300)));
  page.on('requestfailed', (r) => run.failed_requests.push(r.url().slice(0, 160) + ' :: ' + (r.failure()?.errorText || '')));
  await page.route('**/maplibre-gl@3.6.2/dist/maplibre-gl.js', (route) => route.fulfill({ path: path.join(FIX, 'maplibre-gl.js'), contentType: 'application/javascript' }));
  await page.route('**/maplibre-gl@3.6.2/dist/maplibre-gl.css', (route) => route.fulfill({ path: path.join(FIX, 'maplibre-gl.css'), contentType: 'text/css' }));
  await page.route('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', (route) => route.fulfill({ body: STUB_STYLE, contentType: 'application/json' }));
  run.harness_substitutions = ['jsdelivr maplibre-gl@3.6.2 js+css -> GitHub release dist (hash-verified)', 'cartocdn style.json -> black stub style (BLOCKED_DEPENDENCY: basemap)'];
  return { context, page, run };
}

async function settle(page, run, label) {
  const t0 = Date.now();
  let idle = true;
  try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch { idle = false; }
  await page.waitForTimeout(3000);
  run.steps[label + '_wait'] = { networkidle_reached: idle, waited_ms: Date.now() - t0, rule: 'networkidle<=20s then fixed 3s' };
}

async function waitMenu(page) {
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
}

const CENSUS = () => {
  const q = (s, r = document) => Array.from(r.querySelectorAll(s));
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  const host = document.getElementById('scada-ui-container');
  const curtain = document.getElementById('fs-curtain-keys');
  const groupsOf = (root) => q('.key-group', root).map((g) => ({
    title: g.querySelector('.key-title')?.textContent.trim() || '(no title)',
    inputs: g.querySelectorAll('input').length,
    engine: g.querySelectorAll('input[data-layer-id]').length,
    pn: g.querySelectorAll('input[data-pn-layer]').length,
    rect: R(g)
  }));
  const mb = window.__GRIDATLAS_MODULES__?.menuBar;
  const wrapper = document.querySelector('.scada-wrapper');
  const t = document.getElementById('gridatlas-dash-toggle');
  const tray = document.getElementById('gridatlas-mobile-tray');
  const body = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body');
  return {
    generation: document.documentElement.dataset.gridatlasGeneration,
    loaded_cartridges: window.__GRIDATLAS_ATLAS__?.loaded_cartridges,
    scada: {
      engine: q('input[type="checkbox"][data-layer-id]', host).length,
      pipeline: q('input[type="checkbox"][data-pn-layer]', host).length,
      checkboxes_total: q('input[type="checkbox"]', host).length,
      radios: q('input[type="radio"]', host).length,
      groups: groupsOf(host),
      group_count: q('.key-group', host).length,
      rect: R(host), scrollHeight: host.scrollHeight, clientHeight: host.clientHeight,
      display: getComputedStyle(host).display,
      gridTemplateColumns: getComputedStyle(host).gridTemplateColumns,
      wrapper_collapsed_attr: wrapper?.getAttribute('data-gridatlas-collapsed'),
      wrapper_rect: R(wrapper), wrapper_maxHeight: wrapper ? getComputedStyle(wrapper).maxHeight : null
    },
    curtain: {
      engine: q('input[type="checkbox"][data-layer-id]', curtain).length,
      pipeline: q('input[type="checkbox"][data-pn-layer]', curtain).length,
      groups: groupsOf(curtain).map((g) => g.title),
      group_count: q('.key-group', curtain).length,
      fs_curtain_display: getComputedStyle(document.getElementById('fs-curtain')).display,
      tab_parent: document.getElementById('fs-curtain-tab')?.parentElement?.id || document.getElementById('fs-curtain-tab')?.parentElement?.className
    },
    document: { engine_inputs: q('input[data-layer-id]').length, pn_inputs: q('input[data-pn-layer]').length },
    menu: mb ? {
      installed: mb.installed, failure: mb.failure, inspect: mb.inspect(),
      engine_layer_controls: mb.engine_layer_controls, pipeline_layer_controls: mb.pipeline_layer_controls,
      layer_controls: mb.layer_controls, expected_layer_controls: mb.expected_layer_controls,
      proxies: q('[data-gridatlas-layer-proxy]').length,
      proxy_first: q('[data-gridatlas-layer-proxy]')[0]?.getAttribute('data-gridatlas-layer-proxy'),
      proxy_last: q('[data-gridatlas-layer-proxy]').slice(-1)[0]?.getAttribute('data-gridatlas-layer-proxy'),
      layer_keys: q('[data-gridatlas-layer-key]').length,
      grid_groups: q('#gridatlas-menu-bar-panel-4 .gm-layer-group').map((g) => g.textContent.trim()),
      panel_counts: mb.panel_counts, listeners: mb.listeners, tries: mb.tries,
      panel_grid_children: Array.from(document.getElementById('gridatlas-menu-bar-panel-4')?.children || []).map((c) => c.className || c.id),
      body_column_count: body ? getComputedStyle(body).columnCount : null,
      bar_rect: R(document.getElementById('gridatlas-menu-bar'))
    } : null,
    dash_toggle: t ? { text: t.textContent, hidden: t.hidden, rect: R(t), display: getComputedStyle(t).display } : null,
    tray: tray ? q('button', tray).map((b) => ({ text: b.textContent.trim(), hidden: b.hidden, rect: R(b), disabled: b.disabled, pressed: b.getAttribute('aria-pressed') })) : null,
    map_controls_emptied: document.querySelector('.map-controls')?.getAttribute('data-gridatlas-menu-emptied'),
    sheet_open: document.documentElement.classList.contains('gridatlas-sheet-open'),
    fs_active: document.body.classList.contains('fs-active'),
    viewport: [innerWidth, innerHeight]
  };
};

/* Hit test: is the element itself (or its own label) the topmost thing at its centre? */
const HIT = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return { sel, found: false };
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const top = document.elementFromPoint(x, y);
  const label = el.closest('label');
  const ok = top === el || (label && label.contains(top));
  return { sel, found: true, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], in_viewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, top: top ? (top.tagName + (top.id ? '#' + top.id : '') + (top.className && typeof top.className === 'string' ? '.' + top.className.split(' ').join('.') : '')) : null, hit_ok: !!ok, checked: el.checked, disabled: el.disabled };
};

/* Positions of every ORIGINAL control (63 in scada, 63 in curtain, 63 proxies) */
const RECTS = () => {
  const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
  const key = (el) => el.getAttribute('data-layer-id') ? 'engine:' + el.getAttribute('data-layer-id') : el.getAttribute('data-pn-layer') ? 'pipeline:' + el.getAttribute('data-pn-layer') : el.getAttribute('data-gridatlas-layer-proxy');
  const out = { scada: {}, curtain: {}, proxies: {} };
  document.querySelectorAll('#scada-ui-container input[data-layer-id],#scada-ui-container input[data-pn-layer]').forEach((el) => { out.scada[key(el)] = R(el); });
  document.querySelectorAll('#fs-curtain-keys input[data-layer-id],#fs-curtain-keys input[data-pn-layer]').forEach((el) => { out.curtain[key(el)] = R(el); });
  document.querySelectorAll('[data-gridatlas-layer-proxy]').forEach((el) => { out.proxies[key(el)] = R(el); });
  return out;
};

function diffRects(a, b) {
  const moved = [];
  for (const k of Object.keys(a)) { const x = a[k], y = b[k]; if (!y) { moved.push(k + ':missing'); continue; } if (x[0] !== y[0] || x[1] !== y[1] || x[2] !== y[2] || x[3] !== y[3]) moved.push(k + ' ' + JSON.stringify(x) + '->' + JSON.stringify(y)); }
  return { total: Object.keys(a).length, moved: moved.length, examples: moved.slice(0, 6) };
}

/* Probe: insert a weather-like .key-group (NO data-layer-id / data-pn-layer) in a host,
   either appended (like Pipeline News does) or prepended (like the rejected preview did). */
const PROBE_NATIVE = ({ hostId, mode }) => {
  const host = document.getElementById(hostId);
  const g = document.createElement('div'); g.className = 'key-group'; g.setAttribute('data-menu-contracts-probe', mode);
  const t = document.createElement('div'); t.className = 'key-title'; t.textContent = 'WEATHER (PROBE)';
  const l = document.createElement('label'); l.className = 'key-item';
  const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('data-menu-contracts-probe-input', hostId + ':' + mode);
  const s = document.createElement('span'); s.textContent = 'Lightning (probe) [WAIT]'; s.style.color = '#ffdf44';
  l.append(i, document.createTextNode(' '), s); g.append(t, l);
  if (mode === 'append') host.appendChild(g); else host.prepend(g);
  const r = g.getBoundingClientRect();
  return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], host_scrollHeight: host.scrollHeight, host_clientHeight: host.clientHeight, group_index: Array.from(host.children).indexOf(g), group_count: host.querySelectorAll('.key-group').length };
};
const PROBE_REMOVE = () => { document.querySelectorAll('[data-menu-contracts-probe],[data-menu-contracts-grid-probe]').forEach((n) => n.remove()); return document.querySelectorAll('[data-menu-contracts-probe],[data-menu-contracts-grid-probe]').length; };

/* Probe in the Grid dropdown body: a gm-layer row; withProxyAttr decides whether it
   carries data-gridatlas-layer-proxy (the menu's own close-suppression marker). */
const PROBE_GRID = ({ mode, withProxyAttr }) => {
  const body = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body');
  const head = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-head');
  const g = document.createElement('div'); g.className = 'gm-layer-group'; g.textContent = 'Weather (probe)'; g.setAttribute('data-menu-contracts-grid-probe', mode);
  const l = document.createElement('label'); l.className = 'gm-layer'; l.setAttribute('data-menu-contracts-grid-probe', mode);
  const i = document.createElement('input'); i.type = 'checkbox'; i.id = 'menu-contracts-grid-probe-input';
  if (withProxyAttr) i.setAttribute('data-gridatlas-layer-proxy', 'weather:probe');
  const b = document.createElement('span'); b.className = 'gm-layer-box'; b.setAttribute('aria-hidden', 'true');
  const n = document.createElement('span'); n.className = 'gm-layer-name'; n.textContent = 'Lightning (probe) [WAIT]';
  l.append(i, b, n);
  if (mode === 'append') { body.appendChild(g); body.appendChild(l); }
  else if (mode === 'prepend') { body.prepend(g, l); }
  else if (mode === 'head') { head.appendChild(g); head.appendChild(l); }
  const r = l.getBoundingClientRect();
  return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], body_scrollHeight: body.scrollHeight, body_clientHeight: body.clientHeight, in_viewport: r.top >= 0 && r.bottom <= innerHeight };
};

async function shot(page, name) { const p = path.join(OUT, name + '.png'); await page.screenshot({ path: p, fullPage: false }); return path.basename(p); }

async function gridOpen(page) {
  const title = page.getByRole('button', { name: 'Grid', exact: true });
  await title.click();
  await page.waitForFunction(() => document.getElementById('gridatlas-menu-bar-panel-4')?.hidden === false, null, { timeout: 5000 });
}
async function gridState(page) {
  return page.evaluate(() => ({ hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden, expanded: document.getElementById('gridatlas-menu-bar-title-4').getAttribute('aria-expanded'), closed_at_rest: window.__GRIDATLAS_MODULES__.menuBar.closed_at_rest }));
}

async function coreAudit(page, run, tag, { touch }) {
  const act = touch ? (loc) => loc.tap() : (loc) => loc.click();
  const S = run.steps;

  S.census_arrival = await page.evaluate(CENSUS);
  S.shot_arrival = await shot(page, `${tag}-01-arrival`);

  // -- SCADA panel reachability on arrival --
  S.hit_scada_first_on_arrival = await page.evaluate(HIT, '#scada-ui-container input[data-layer-id="400"]');
  S.hit_scada_pn_all_on_arrival = await page.evaluate(HIT, '#scada-ui-container input[data-pn-layer="all"]');

  // On a phone the panel starts collapsed; open it with the real toggle (tap/click, no force).
  if (S.census_arrival.scada.wrapper_collapsed_attr === '1') {
    const toggle = page.locator('#gridatlas-dash-toggle');
    S.dash_toggle_before = await toggle.evaluate((t) => ({ text: t.textContent, rect: t.getBoundingClientRect().toJSON() }));
    await act(toggle);
    await page.waitForFunction(() => !document.querySelector('.scada-wrapper').hasAttribute('data-gridatlas-collapsed'), null, { timeout: 5000 });
    await page.waitForTimeout(400);
    S.dash_toggle_after = await toggle.evaluate((t) => t.textContent);
    S.census_after_layers_open = await page.evaluate(CENSUS);
    S.shot_layers_open = await shot(page, `${tag}-02-layers-panel-open`);
  }

  // Hit tests of originals in the SCADA panel after scrolling them into view (the panel body scrolls).
  for (const [name, sel] of [['first_engine_400', '#scada-ui-container input[data-layer-id="400"]'], ['engine_dc', '#scada-ui-container input[data-layer-id="dc"]'], ['last_engine_caes', '#scada-ui-container input[data-layer-id="caes"]'], ['pn_all', '#scada-ui-container input[data-pn-layer="all"]']]) {
    const loc = page.locator(sel);
    await loc.scrollIntoViewIfNeeded();
    S['hit_scada_' + name] = await page.evaluate(HIT, sel);
  }

  // Real click/tap on an ORIGINAL (preloaded, locally served) control: Data Ctrs.
  const dc = page.locator('#scada-ui-container input[data-layer-id="dc"]');
  await dc.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({ scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').checked }));
  await act(dc);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').checked, label: document.getElementById('lbl-dc').textContent, fs_label: document.getElementById('fs-lbl-dc').textContent, proxy_label: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').parentNode.querySelector('.gm-layer-name').textContent, map_vis: window.__GRIDATLAS_V9_MAP__?.getLayoutProperty('l-dc', 'visibility') }));
  S.scada_click_dc = { before, after, mirrored_to_curtain_and_proxy: after.scada === after.curtain && after.scada === after.proxy && after.scada !== before.scada };
  await act(dc); await page.waitForTimeout(200);
  S.scada_click_dc_revert = await page.evaluate(() => document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked);

  // -- Grid dropdown: open with a real click/tap on the title --
  await gridOpen(page);
  await page.waitForTimeout(300);
  S.grid_open_state = await gridState(page);
  S.grid_geometry = await page.evaluate(() => {
    const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    const panel = document.getElementById('gridatlas-menu-bar-panel-4');
    const body = panel.querySelector('.gm-panel-body');
    const cs = getComputedStyle(panel);
    return { panel: R(panel), position: cs.position, body: R(body), body_scrollHeight: body.scrollHeight, body_clientHeight: body.clientHeight, column_count: getComputedStyle(body).columnCount, first_proxy: R(document.querySelector('[data-gridatlas-layer-proxy="engine:400"]')), pn_all_proxy: R(document.querySelector('[data-gridatlas-layer-proxy="pipeline:all"]')), basemap_radio: R(document.querySelector('input[name="gridatlas-menu-basemap"]')), head: R(panel.querySelector('.gm-panel-head')), curtain_tab_in_panel: panel.contains(document.getElementById('fs-curtain-tab')) };
  });
  S.shot_grid_open = await shot(page, `${tag}-03-grid-open`);
  S.hit_grid_proxy_400 = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:400"]');

  // Real click/tap on a Grid proxy: forwards to the original and the panel STAYS open.
  const proxyDc = page.locator('[data-gridatlas-layer-proxy="engine:dc"]');
  await proxyDc.scrollIntoViewIfNeeded();
  S.hit_grid_proxy_dc = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:dc"]');
  await act(proxyDc);
  await page.waitForTimeout(300);
  S.grid_proxy_click_dc = await page.evaluate(() => ({ original: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden }));
  await act(proxyDc); await page.waitForTimeout(200);
  S.grid_proxy_click_dc_revert = await page.evaluate(() => ({ original: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden }));

  // Contrast: a control inside the bar WITHOUT data-gridatlas-layer-proxy closes the menu (basemap radio).
  const sat = page.locator('input[name="gridatlas-menu-basemap"][value="sat"]');
  await sat.scrollIntoViewIfNeeded();
  await act(sat); await page.waitForTimeout(300);
  S.basemap_radio_click_closes_menu = await gridState(page);
  // restore Dark
  await gridOpen(page); await page.waitForTimeout(200);
  const dark = page.locator('input[name="gridatlas-menu-basemap"][value="dark"]');
  await dark.scrollIntoViewIfNeeded(); await act(dark); await page.waitForTimeout(300);
  S.basemap_restored = await page.evaluate(() => ({ dark_checked: document.querySelector('#scada-ui-container input[name="bm"][value="dark"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden }));

  // -- Keyboard semantics (desktop only): ArrowDown on Grid focuses the FIRST proxy --
  if (!touch) {
    await page.evaluate(() => document.getElementById('gridatlas-menu-bar-title-4').focus());
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
    S.keyboard_arrowdown = await page.evaluate(() => ({ panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden, active: document.activeElement?.getAttribute('data-gridatlas-layer-proxy') || document.activeElement?.tagName + '#' + document.activeElement?.id }));
    await page.keyboard.press('Space'); await page.waitForTimeout(300);
    S.keyboard_space_toggles_original = await page.evaluate(() => ({ original_400: document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked, proxy_400: document.querySelector('[data-gridatlas-layer-proxy="engine:400"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden }));
    await page.keyboard.press('Space'); await page.waitForTimeout(200);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    S.keyboard_escape = await page.evaluate(() => ({ panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden, focus_on_title: document.activeElement?.id, original_400: document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked }));
  } else {
    await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll());
  }

  // -- Insertion-point probes (throwaway page DOM only; nothing on disk changes) --
  const baseline = await page.evaluate(RECTS);
  const menuBefore = await page.evaluate(() => ({ ...window.__GRIDATLAS_MODULES__.menuBar.inspect(), proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, installed: window.__GRIDATLAS_MODULES__.menuBar.installed, failure: window.__GRIDATLAS_MODULES__.menuBar.failure }));

  // (a) APPEND a probe group to #scada-ui-container and #fs-curtain-keys (Pipeline News precedent)
  S.probe_native_append = { scada: await page.evaluate(PROBE_NATIVE, { hostId: 'scada-ui-container', mode: 'append' }), curtain: await page.evaluate(PROBE_NATIVE, { hostId: 'fs-curtain-keys', mode: 'append' }) };
  await page.waitForTimeout(400);
  const afterAppend = await page.evaluate(RECTS);
  S.probe_native_append.original_shift = { scada: diffRects(baseline.scada, afterAppend.scada), curtain: diffRects(baseline.curtain, afterAppend.curtain), proxies: diffRects(baseline.proxies, afterAppend.proxies) };
  S.probe_native_append.menu_after = await page.evaluate(() => ({ ...window.__GRIDATLAS_MODULES__.menuBar.inspect(), proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, installed: window.__GRIDATLAS_MODULES__.menuBar.installed, failure: window.__GRIDATLAS_MODULES__.menuBar.failure, failure_banner: !!document.getElementById('gridatlas-menu-bar-failure') }));
  // Real click/tap on the probe checkbox in the SCADA panel: the engine's and PN's delegated listeners must ignore it.
  const probeIn = page.locator('[data-menu-contracts-probe-input="scada-ui-container:append"]');
  await probeIn.scrollIntoViewIfNeeded();
  S.probe_native_append.hit = await page.evaluate(HIT, '[data-menu-contracts-probe-input="scada-ui-container:append"]');
  const errsBefore = run.console_errors.length + run.page_errors.length;
  await act(probeIn); await page.waitForTimeout(300);
  S.probe_native_append.after_click = await page.evaluate(() => ({ probe_checked: document.querySelector('[data-menu-contracts-probe-input="scada-ui-container:append"]').checked, engine_checked_count: document.querySelectorAll('#scada-ui-container input[data-layer-id]:checked').length, pn_checked_count: document.querySelectorAll('#scada-ui-container input[data-pn-layer]:checked').length, menu_inspect: window.__GRIDATLAS_MODULES__.menuBar.inspect(), pn_active: window.__GRIDATLAS_PIPELINE_LAYERS__?.active }));
  S.probe_native_append.new_errors_after_click = (run.console_errors.length + run.page_errors.length) - errsBefore;
  S.probe_native_append.shot = await shot(page, `${tag}-04-probe-appended-scada`);
  await page.evaluate(PROBE_REMOVE);
  await page.waitForTimeout(300);

  // (b) PREPEND (what the rejected preview did at weather-module.js:104)
  S.probe_native_prepend = { scada: await page.evaluate(PROBE_NATIVE, { hostId: 'scada-ui-container', mode: 'prepend' }), curtain: await page.evaluate(PROBE_NATIVE, { hostId: 'fs-curtain-keys', mode: 'prepend' }) };
  await page.waitForTimeout(400);
  const afterPrepend = await page.evaluate(RECTS);
  S.probe_native_prepend.original_shift = { scada: diffRects(baseline.scada, afterPrepend.scada), curtain: diffRects(baseline.curtain, afterPrepend.curtain) };
  S.probe_native_prepend.shot = await shot(page, `${tag}-05-probe-prepended-scada`);
  await page.evaluate(PROBE_REMOVE);
  await page.waitForTimeout(300);
  const restored = await page.evaluate(RECTS);
  S.probe_removed_restores_geometry = diffRects(baseline.scada, restored.scada);

  // (c) Grid dropdown probes: append vs prepend vs head; and the close-suppression attribute.
  await gridOpen(page); await page.waitForTimeout(300);
  const gridBase = await page.evaluate(RECTS);
  for (const mode of ['append', 'prepend', 'head']) {
    const placed = await page.evaluate(PROBE_GRID, { mode, withProxyAttr: true });
    await page.waitForTimeout(250);
    const now = await page.evaluate(RECTS);
    S['probe_grid_' + mode] = { placed, proxies_moved: diffRects(gridBase.proxies, now.proxies), menu_inspect: await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.inspect()), proxy_attr_count: await page.evaluate(() => document.querySelectorAll('[data-gridatlas-layer-proxy]').length) };
    if (mode === 'append') S.probe_grid_append.shot = await shot(page, `${tag}-06-probe-grid-appended`);
    await page.evaluate(PROBE_REMOVE); await page.waitForTimeout(200);
  }
  // (d) Event path: a probe row in the Grid body WITHOUT the proxy attribute closes the menu on click; WITH it the menu stays open.
  for (const withProxyAttr of [false, true]) {
    if (await page.evaluate(() => document.getElementById('gridatlas-menu-bar-panel-4').hidden)) { await gridOpen(page); await page.waitForTimeout(200); }
    await page.evaluate(PROBE_GRID, { mode: 'append', withProxyAttr });
    const probe = page.locator('#menu-contracts-grid-probe-input');
    await probe.scrollIntoViewIfNeeded();
    const hit = await page.evaluate(HIT, '#menu-contracts-grid-probe-input');
    await act(probe); await page.waitForTimeout(350);
    S['probe_grid_click_' + (withProxyAttr ? 'with' : 'without') + '_proxy_attr'] = { hit, ...(await gridState(page)), probe_checked: await page.evaluate(() => document.getElementById('menu-contracts-grid-probe-input')?.checked) };
    await page.evaluate(PROBE_REMOVE); await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll());
  S.census_final = await page.evaluate(CENSUS);
}

async function sheetAudit(browser, run, name, ctxOpts, touch) {
  const { context, page, run: r } = await openPage(browser, name + '-deeplink', ctxOpts);
  try {
    await page.goto(BASE + '?technology=solar&latitude=52.6369&longitude=-1.1398&zoom=10&project=GRIDATLAS_PROOF_menu_contracts&capacity_mw=10', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await settle(page, r, 'deeplink');
    await waitMenu(page);
    let sheet = false;
    try { await page.waitForFunction(() => document.documentElement.classList.contains('gridatlas-sheet-open'), null, { timeout: 45000 }); sheet = true; } catch { sheet = false; }
    r.steps.sheet_open = sheet;
    r.steps.status_text = await page.evaluate(() => Array.from(document.querySelectorAll('[id*="status"],[class*="status"]')).map((n) => n.textContent.trim()).filter(Boolean).slice(0, 6));
    r.steps.census = await page.evaluate(CENSUS);
    r.steps.shot = await shot(page, name + '-07-deeplink-arrival');
    if (sheet) {
      r.steps.sheet_geometry = await page.evaluate(() => { const R = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; }; return { sheet: R(document.querySelector('.maplibregl-popup.gridatlas-sheet')), dash_toggle: R(document.getElementById('gridatlas-dash-toggle')), map_controls: R(document.querySelector('.map-controls')), bar: R(document.getElementById('gridatlas-menu-bar')) }; });
      r.steps.hit_dash_toggle_with_sheet = await page.evaluate(HIT, '#gridatlas-dash-toggle');
      await gridOpen(page); await page.waitForTimeout(300);
      r.steps.hit_grid_proxy_with_sheet = await page.evaluate(HIT, '[data-gridatlas-layer-proxy="engine:400"]');
      const proxy = page.locator('[data-gridatlas-layer-proxy="engine:dc"]'); await proxy.scrollIntoViewIfNeeded();
      await (touch ? proxy.tap() : proxy.click()); await page.waitForTimeout(300);
      r.steps.grid_proxy_click_with_sheet = await page.evaluate(() => ({ original: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, panel_hidden: document.getElementById('gridatlas-menu-bar-panel-4').hidden }));
      r.steps.shot_sheet_grid = await shot(page, name + '-08-deeplink-sheet-grid-open');
    }
  } catch (e) { r.error = String(e.message || e).slice(0, 400); }
  report.runs.push(r);
  await context.close();
}

const browser = await chromium.launch();
try {
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const configs = [
    { name: 'desktop-1440x900', touch: false, ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'android-393x852', touch: true, ctx: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } },
    { name: 'android-360x740', touch: true, ctx: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } }
  ];
  for (const cfg of configs) {
    const { context, page, run } = await openPage(browser, cfg.name, cfg.ctx);
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await settle(page, run, 'arrival');
      const t0 = Date.now();
      await waitMenu(page);
      run.steps.menu_installed_after_ms = Date.now() - t0;
      await coreAudit(page, run, cfg.name, { touch: cfg.touch });
    } catch (e) {
      run.error = String(e.stack || e).slice(0, 1200);
      try { run.steps.shot_error = await shot(page, cfg.name + '-99-error'); run.steps.census_at_error = await page.evaluate(CENSUS).catch(() => null); } catch {}
    }
    report.runs.push(run);
    await context.close();
    log(cfg.name, run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
  }
  await sheetAudit(browser, null, 'android-393x852', configs[1].ctx, true);
} finally {
  await browser.close();
}
report.finished = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'menu-contracts.results.json'), JSON.stringify(report, null, 2));
log('written', path.join(OUT, 'menu-contracts.results.json'));
