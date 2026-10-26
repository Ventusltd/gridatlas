/* atlas-menu-contracts, second pass: scroll-independent geometry of every ORIGINAL
   control under each candidate insertion point, plus the fullscreen curtain.
   Coordinates are content-relative (rect - scrollContainer.rect + scrollTop), so
   neither scroll position nor Chrome's scroll anchoring can mask a shift.
   Same harness substitutions as menu-contracts.audit.mjs. No force:true. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8103/gridatlas/atlas/';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/atlas-menu-contracts';
const FIX = path.join(OUT, 'fixtures', 'maplibre-gl@3.6.2');
const STUB_STYLE = JSON.stringify({ version: 8, name: 'harness-black-stub', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#000000' } }] });
const report = { started: new Date().toISOString(), runs: [] };

const REL = (containerSel) => {
  const c = document.querySelector(containerSel);
  const cr = c.getBoundingClientRect();
  const out = {};
  const key = (el) => el.getAttribute('data-layer-id') ? 'engine:' + el.getAttribute('data-layer-id') : el.getAttribute('data-pn-layer') ? 'pipeline:' + el.getAttribute('data-pn-layer') : el.getAttribute('data-gridatlas-layer-proxy');
  c.querySelectorAll('input[data-layer-id],input[data-pn-layer],input[data-gridatlas-layer-proxy]').forEach((el) => {
    const r = el.getBoundingClientRect();
    out[key(el)] = [Math.round((r.left - cr.left + c.scrollLeft) * 10) / 10, Math.round((r.top - cr.top + c.scrollTop) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10];
  });
  return { rects: out, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight, count: Object.keys(out).length };
};
function diff(a, b) {
  const moved = [];
  for (const k of Object.keys(a)) { const x = a[k], y = b[k]; if (!y) { moved.push(k + ':missing'); continue; } if (x.some((v, i) => v !== y[i])) moved.push(k + ' ' + JSON.stringify(x) + '->' + JSON.stringify(y)); }
  return { total: Object.keys(a).length, moved: moved.length, examples: moved.slice(0, 4) };
}
const ADD_NATIVE = ({ hostId, mode }) => {
  const host = document.getElementById(hostId);
  const g = document.createElement('div'); g.className = 'key-group'; g.setAttribute('data-menu-contracts-probe', mode);
  g.innerHTML = '<div class="key-title">WEATHER (PROBE)</div>';
  const l = document.createElement('label'); l.className = 'key-item';
  const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('data-menu-contracts-probe-input', hostId);
  const s = document.createElement('span'); s.style.color = '#ffdf44'; s.textContent = 'Lightning (probe) [WAIT]';
  l.append(i, ' ', s); g.appendChild(l);
  if (mode === 'append') host.appendChild(g); else host.prepend(g);
  const cr = host.getBoundingClientRect(), r = g.getBoundingClientRect();
  return { rel_top: Math.round(r.top - cr.top + host.scrollTop), rel_left: Math.round(r.left - cr.left), width: Math.round(r.width), height: Math.round(r.height), scrollHeight: host.scrollHeight, clientHeight: host.clientHeight, needs_scroll: (r.top - cr.top + host.scrollTop) + r.height > host.clientHeight, group_index: Array.from(host.children).indexOf(g) };
};
const ADD_GRID = ({ mode, withAttr }) => {
  const body = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body');
  const head = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-head');
  const panel = document.getElementById('gridatlas-menu-bar-panel-4');
  const g = document.createElement('div'); g.className = 'gm-layer-group'; g.textContent = 'Weather (probe)'; g.setAttribute('data-menu-contracts-probe', mode);
  const l = document.createElement('label'); l.className = 'gm-layer'; l.setAttribute('data-menu-contracts-probe', mode);
  const i = document.createElement('input'); i.type = 'checkbox'; i.id = 'menu-contracts-grid-probe-input'; if (withAttr) i.setAttribute('data-gridatlas-layer-proxy', 'weather:probe');
  const b = document.createElement('span'); b.className = 'gm-layer-box'; b.setAttribute('aria-hidden', 'true');
  const n = document.createElement('span'); n.className = 'gm-layer-name'; n.textContent = 'Lightning (probe) [WAIT]';
  l.append(i, b, n);
  if (mode === 'append') { body.append(g, l); } else if (mode === 'prepend') { body.prepend(g, l); } else if (mode === 'head') { head.append(g, l); } else if (mode === 'footer') { const f = document.createElement('div'); f.className = 'gm-panel-foot'; f.setAttribute('data-menu-contracts-probe', mode); f.style.cssText = 'flex:0 0 auto;padding:6px;border-top:1px solid #19343b'; f.append(g, l); panel.insertBefore(f, document.getElementById('fs-curtain-tab')); }
  const cr = body.getBoundingClientRect(), r = l.getBoundingClientRect(), pr = panel.getBoundingClientRect();
  return { label_rect_viewport: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], body_rect: [Math.round(cr.left), Math.round(cr.top), Math.round(cr.width), Math.round(cr.height)], panel_rect: [Math.round(pr.left), Math.round(pr.top), Math.round(pr.width), Math.round(pr.height)], body_scrollHeight: body.scrollHeight, body_clientHeight: body.clientHeight, visible_without_scroll: r.top >= cr.top && r.bottom <= cr.bottom && r.bottom <= innerHeight && r.top >= 0 };
};
const REMOVE = () => { document.querySelectorAll('[data-menu-contracts-probe]').forEach((n) => n.remove()); return document.querySelectorAll('[data-menu-contracts-probe]').length; };
const RESET_SCROLL = (sel) => { const c = document.querySelector(sel); if (c) c.scrollTop = 0; };

async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); return name + '.png'; }

const browser = await chromium.launch();
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const configs = [
  { name: 'desktop-1440x900', touch: false, ctx: { viewport: { width: 1440, height: 900 } } },
  { name: 'android-393x852', touch: true, ctx: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } },
  { name: 'android-360x740', touch: true, ctx: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } }
];
for (const cfg of configs) {
  const context = await browser.newContext(cfg.ctx);
  const page = await context.newPage();
  const run = { viewport: cfg.name, steps: {}, page_errors: [] };
  page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 200)));
  await page.route('**/maplibre-gl@3.6.2/dist/maplibre-gl.js', (r) => r.fulfill({ path: path.join(FIX, 'maplibre-gl.js'), contentType: 'application/javascript' }));
  await page.route('**/maplibre-gl@3.6.2/dist/maplibre-gl.css', (r) => r.fulfill({ path: path.join(FIX, 'maplibre-gl.css'), contentType: 'text/css' }));
  await page.route('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', (r) => r.fulfill({ body: STUB_STYLE, contentType: 'application/json' }));
  const act = cfg.touch ? (l) => l.tap() : (l) => l.click();
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
    await page.waitForTimeout(3000);
    await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
    const S = run.steps;
    if (await page.evaluate(() => document.querySelector('.scada-wrapper').getAttribute('data-gridatlas-collapsed') === '1')) {
      await act(page.locator('#gridatlas-dash-toggle'));
      await page.waitForFunction(() => !document.querySelector('.scada-wrapper').hasAttribute('data-gridatlas-collapsed'));
      await page.waitForTimeout(400);
    }
    // ---- SCADA panel: content-relative geometry under append / prepend ----
    await page.evaluate(RESET_SCROLL, '#scada-ui-container');
    const base = await page.evaluate(REL, '#scada-ui-container');
    S.scada_baseline = { count: base.count, scrollHeight: base.scrollHeight, clientHeight: base.clientHeight, first: base.rects['engine:400'], last_pn: base.rects['pipeline:all'] };
    S.scada_append = { probe: await page.evaluate(ADD_NATIVE, { hostId: 'scada-ui-container', mode: 'append' }) };
    await page.waitForTimeout(150); await page.evaluate(RESET_SCROLL, '#scada-ui-container');
    S.scada_append.shift = diff(base.rects, (await page.evaluate(REL, '#scada-ui-container')).rects);
    S.scada_append.shot = await shot(page, cfg.name + '-10-scada-append-probe');
    await page.evaluate(REMOVE); await page.waitForTimeout(150); await page.evaluate(RESET_SCROLL, '#scada-ui-container');
    S.scada_after_remove = diff(base.rects, (await page.evaluate(REL, '#scada-ui-container')).rects);
    S.scada_prepend = { probe: await page.evaluate(ADD_NATIVE, { hostId: 'scada-ui-container', mode: 'prepend' }) };
    await page.waitForTimeout(150); await page.evaluate(RESET_SCROLL, '#scada-ui-container');
    S.scada_prepend.shift = diff(base.rects, (await page.evaluate(REL, '#scada-ui-container')).rects);
    S.scada_prepend.shot = await shot(page, cfg.name + '-11-scada-prepend-probe');
    await page.evaluate(REMOVE); await page.waitForTimeout(150);

    // ---- Grid dropdown: append / prepend / head / footer ----
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gridatlas-menu-bar-panel-4').hidden === false);
    await page.waitForTimeout(300);
    await page.evaluate(RESET_SCROLL, '#gridatlas-menu-bar-panel-4 .gm-panel-body');
    const gbase = await page.evaluate(REL, '#gridatlas-menu-bar-panel-4 .gm-panel-body');
    S.grid_baseline = { count: gbase.count, scrollHeight: gbase.scrollHeight, clientHeight: gbase.clientHeight, column_count: await page.evaluate(() => getComputedStyle(document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body')).columnCount), first: gbase.rects['engine:400'], last_pn: gbase.rects['pipeline:all'] };
    for (const mode of ['append', 'prepend', 'head', 'footer']) {
      const probe = await page.evaluate(ADD_GRID, { mode, withAttr: true });
      await page.waitForTimeout(200); await page.evaluate(RESET_SCROLL, '#gridatlas-menu-bar-panel-4 .gm-panel-body');
      const now = await page.evaluate(REL, '#gridatlas-menu-bar-panel-4 .gm-panel-body');
      const bodyRect = await page.evaluate(() => { const r = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
      S['grid_' + mode] = { probe, shift_within_body: diff(gbase.rects, now.rects), body_rect_after: bodyRect, body_clientHeight_after: now.clientHeight };
      S['grid_' + mode].shot = await shot(page, cfg.name + '-12-grid-' + mode + '-probe');
      await page.evaluate(REMOVE); await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll());

    // ---- Fullscreen curtain: enter via the View menu's real button, open the curtain via its real tab ----
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.waitForTimeout(200);
    const fsBtn = page.locator('#btn-fullscreen');
    S.fullscreen_button = await fsBtn.evaluate((b) => ({ visible: !!(b.offsetWidth || b.offsetHeight), parent: b.parentElement.id, text: b.textContent.trim() }));
    await act(fsBtn); await page.waitForTimeout(500);
    S.fs_active = await page.evaluate(() => ({ body: document.body.classList.contains('fs-active'), fullscreenElement: !!document.fullscreenElement, curtain_display: getComputedStyle(document.getElementById('fs-curtain')).display, curtain_open: document.getElementById('fs-curtain').classList.contains('curtain-open'), letterhead_display: getComputedStyle(document.getElementById('fs-letterhead')).display, exit_btn_visible: (() => { const b = document.getElementById('btn-fullscreen-exit'); const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })() }));
    // the curtain tab now lives inside the Grid panel (adoptLate), so open Grid first
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gridatlas-menu-bar-panel-4').hidden === false);
    await page.waitForTimeout(200);
    const tab = page.locator('#fs-curtain-tab');
    S.curtain_tab = await tab.evaluate((t) => { const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], display: cs.display, position: cs.position, text: t.textContent.trim(), parent: t.parentElement.id, top_at_centre: (() => { const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e ? e.tagName + '#' + e.id : null; })() }; });
    let curtainOpened = false;
    try { await act(tab); await page.waitForTimeout(600); curtainOpened = await page.evaluate(() => document.getElementById('fs-curtain').classList.contains('curtain-open')); } catch (e) { S.curtain_tab_click_error = String(e.message).slice(0, 300); }
    S.curtain_opened_by_real_tab = curtainOpened;
    if (curtainOpened) {
      await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll());
      await page.waitForTimeout(300);
      S.curtain_geometry = await page.evaluate(() => { const c = document.getElementById('fs-curtain'); const k = document.getElementById('fs-curtain-keys'); const R = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }; return { curtain: R(c), keys: R(k), keys_cols: getComputedStyle(k).gridTemplateColumns, curtain_scrollHeight: c.scrollHeight, curtain_clientHeight: c.clientHeight, groups: k.querySelectorAll('.key-group').length, last_group: k.querySelector('.key-group:last-child .key-title')?.textContent }; });
      S.curtain_shot = await shot(page, cfg.name + '-13-fullscreen-curtain-open');
      // real click/tap on a curtain original -> mirrored to SCADA + proxy
      const cdc = page.locator('#fs-curtain-keys input[data-layer-id="dc"]');
      await cdc.scrollIntoViewIfNeeded();
      S.curtain_hit_dc = await page.evaluate(() => { const el = document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]'); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], top: top && (top.tagName + '#' + top.id), hit_ok: top === el || el.closest('label').contains(top) }; });
      await act(cdc); await page.waitForTimeout(300);
      S.curtain_click_dc = await page.evaluate(() => ({ curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').checked }));
      await act(cdc); await page.waitForTimeout(200);
      // curtain append / prepend shift, content-relative to #fs-curtain (the scroll container)
      await page.evaluate(RESET_SCROLL, '#fs-curtain');
      const cbase = await page.evaluate(REL, '#fs-curtain');
      S.curtain_baseline = { count: cbase.count, scrollHeight: cbase.scrollHeight, clientHeight: cbase.clientHeight };
      S.curtain_append = { probe: await page.evaluate(ADD_NATIVE, { hostId: 'fs-curtain-keys', mode: 'append' }) };
      await page.waitForTimeout(150); await page.evaluate(RESET_SCROLL, '#fs-curtain');
      S.curtain_append.shift = diff(cbase.rects, (await page.evaluate(REL, '#fs-curtain')).rects);
      S.curtain_append.shot = await shot(page, cfg.name + '-14-curtain-append-probe');
      await page.evaluate(REMOVE); await page.waitForTimeout(150);
      S.curtain_prepend = { probe: await page.evaluate(ADD_NATIVE, { hostId: 'fs-curtain-keys', mode: 'prepend' }) };
      await page.waitForTimeout(150); await page.evaluate(RESET_SCROLL, '#fs-curtain');
      S.curtain_prepend.shift = diff(cbase.rects, (await page.evaluate(REL, '#fs-curtain')).rects);
      await page.evaluate(REMOVE);
      // probe checkbox in the curtain: real click, engine must ignore it
      await page.evaluate(ADD_NATIVE, { hostId: 'fs-curtain-keys', mode: 'append' });
      const cprobe = page.locator('[data-menu-contracts-probe-input="fs-curtain-keys"]');
      await cprobe.scrollIntoViewIfNeeded(); await act(cprobe); await page.waitForTimeout(200);
      S.curtain_probe_click = await page.evaluate(() => ({ probe_checked: document.querySelector('[data-menu-contracts-probe-input="fs-curtain-keys"]').checked, engine_checked: document.querySelectorAll('input[data-layer-id]:checked').length, menu: window.__GRIDATLAS_MODULES__.menuBar.inspect() }));
      await page.evaluate(REMOVE);
    }
    // exit fullscreen through the app's own exit control (moved into View by adoptLate)
    await page.evaluate(() => window.exitFullscreen());
    await page.waitForTimeout(300);
    S.fs_exited = await page.evaluate(() => !document.body.classList.contains('fs-active'));
    S.final_inventory = await page.evaluate(() => ({ ...window.__GRIDATLAS_MODULES__.menuBar.inspect(), installed: window.__GRIDATLAS_MODULES__.menuBar.installed, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length, scada_groups: document.querementorAll ? 0 : document.querySelectorAll('#scada-ui-container .key-group').length, curtain_groups: document.querySelectorAll('#fs-curtain-keys .key-group').length }));
  } catch (e) {
    run.error = String(e.stack || e).slice(0, 1200);
    try { run.steps.error_shot = await shot(page, cfg.name + '-98-geometry-error'); } catch {}
  }
  report.runs.push(run);
  await context.close();
  console.log(cfg.name, run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'menu-contracts.geometry.json'), JSON.stringify(report, null, 2));
console.log('written menu-contracts.geometry.json');
