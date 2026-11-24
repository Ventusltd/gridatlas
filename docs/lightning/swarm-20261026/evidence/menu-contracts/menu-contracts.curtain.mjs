/* atlas-menu-contracts, third pass: the fullscreen curtain on both fullscreen paths.
   (A) Chromium with element fullscreen GRANTED (desktop + Android): record that
       body-level #fs-curtain is outside document.fullscreenElement and unpainted.
   (B) iOS EMULATION in Chromium (WebKit binary absent = BLOCKED_HARNESS):
       390x844, iPhone UA, touch, and Element.prototype.requestFullscreen removed
       so the engine takes the CSS-only path (body.fs-active, no top layer),
       exactly as iOS Safari does for non-video elements. Geometry/behaviour
       emulation only; not a WebKit rendering proof.
   Same harness substitutions as the other passes. No force:true. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8103/gridatlas/atlas/';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/atlas-menu-contracts';
const FIX = path.join(OUT, 'fixtures', 'maplibre-gl@3.6.2');
const STUB_STYLE = JSON.stringify({ version: 8, name: 'harness-black-stub', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#000000' } }] });
const report = { started: new Date().toISOString(), runs: [] };

const REL = (containerSel) => {
  const c = document.querySelector(containerSel); const cr = c.getBoundingClientRect(); const out = {};
  const key = (el) => el.getAttribute('data-layer-id') ? 'engine:' + el.getAttribute('data-layer-id') : 'pipeline:' + el.getAttribute('data-pn-layer');
  c.querySelectorAll('input[data-layer-id],input[data-pn-layer]').forEach((el) => { const r = el.getBoundingClientRect(); out[key(el)] = [Math.round((r.left - cr.left + c.scrollLeft) * 10) / 10, Math.round((r.top - cr.top + c.scrollTop) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; });
  return out;
};
function diff(a, b) { const moved = []; for (const k of Object.keys(a)) { const x = a[k], y = b[k]; if (!y) { moved.push(k + ':missing'); continue; } if (x.some((v, i) => v !== y[i])) moved.push(k + ' ' + JSON.stringify(x) + '->' + JSON.stringify(y)); } return { total: Object.keys(a).length, moved: moved.length, examples: moved.slice(0, 4) }; }
const ADD = ({ hostId, mode }) => {
  const host = document.getElementById(hostId);
  const g = document.createElement('div'); g.className = 'key-group'; g.setAttribute('data-menu-contracts-probe', mode); g.innerHTML = '<div class="key-title">WEATHER (PROBE)</div>';
  const l = document.createElement('label'); l.className = 'key-item'; const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('data-menu-contracts-probe-input', hostId);
  const s = document.createElement('span'); s.style.color = '#ffdf44'; s.textContent = 'Lightning (probe) [WAIT]'; l.append(i, ' ', s); g.appendChild(l);
  if (mode === 'append') host.appendChild(g); else host.prepend(g);
  const r = g.getBoundingClientRect(); return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], group_index: Array.from(host.children).indexOf(g) };
};
const REMOVE = () => { document.querySelectorAll('[data-menu-contracts-probe]').forEach((n) => n.remove()); };
const HIT = (sel) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], top: top ? top.tagName + '#' + top.id + '.' + (typeof top.className === 'string' ? top.className : '') : null, hit_ok: top === el || !!(el.closest('label') && el.closest('label').contains(top)) }; };
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); return name + '.png'; }

const browser = await chromium.launch();
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const configs = [
  { name: 'desktop-1440x900-truefullscreen', touch: false, iosEmu: false, ctx: { viewport: { width: 1440, height: 900 } } },
  { name: 'android-393x852-truefullscreen', touch: true, iosEmu: false, ctx: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, userAgent: ANDROID_UA } },
  { name: 'iphone-emulation-390x844-cssfullscreen', touch: true, iosEmu: true, ctx: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: IOS_UA } }
];
for (const cfg of configs) {
  const context = await browser.newContext(cfg.ctx);
  if (cfg.iosEmu) await context.addInitScript(() => { try { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen; delete Document.prototype.exitFullscreen; delete Document.prototype.webkitExitFullscreen; } catch (e) {} });
  const page = await context.newPage();
  const run = { viewport: cfg.name, emulation: cfg.iosEmu ? 'Chromium emulating iOS Safari: iPhone UA, 390x844, element-fullscreen API removed (WebKit binary absent: BLOCKED_HARNESS)' : 'Chromium, element fullscreen granted', steps: {}, page_errors: [] };
  page.on('pageerror', (e) => run.page_errors.push(String(e.message).slice(0, 200)));
  await page.route('**/maplibre-gl@3.6.2/dist/maplibre-gl.js', (r) => r.fulfill({ path: path.join(FIX, 'maplibre-gl.js'), contentType: 'application/javascript' }));
  await page.route('**/maplibre-gl@3.6.2/dist/maplibre-gl.css', (r) => r.fulfill({ path: path.join(FIX, 'maplibre-gl.css'), contentType: 'text/css' }));
  await page.route('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', (r) => r.fulfill({ body: STUB_STYLE, contentType: 'application/json' }));
  const act = cfg.touch ? (l) => l.tap() : (l) => l.click();
  const S = run.steps;
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try { await page.waitForLoadState('networkidle', { timeout: 20000 }); } catch {}
    await page.waitForTimeout(3000);
    await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
    S.arrival = await page.evaluate(() => ({ collapsed: document.querySelector('.scada-wrapper').getAttribute('data-gridatlas-collapsed'), inspect: window.__GRIDATLAS_MODULES__.menuBar.inspect(), requestFullscreen_available: typeof Element.prototype.requestFullscreen === 'function', fs_curtain_parent: document.getElementById('fs-curtain').parentElement.tagName, fs_curtain_inside_map_container: document.getElementById('map-container').contains(document.getElementById('fs-curtain')) }));
    S.shot_arrival = await shot(page, cfg.name + '-20-arrival');
    // Enter fullscreen through the app's own control (View > fullscreen button), real click/tap.
    await page.getByRole('button', { name: 'View', exact: true }).click(); await page.waitForTimeout(200);
    await act(page.locator('#btn-fullscreen')); await page.waitForTimeout(600);
    S.fullscreen_state = await page.evaluate(() => { const fe = document.fullscreenElement; const c = document.getElementById('fs-curtain'); return { fs_active_body: document.body.classList.contains('fs-active'), fullscreenElement: fe ? fe.id || fe.className : null, curtain_inside_fullscreen_element: fe ? fe.contains(c) : null, scada_inside_fullscreen_element: fe ? fe.contains(document.getElementById('scada-ui-container')) : null, bar_inside_fullscreen_element: fe ? fe.contains(document.getElementById('gridatlas-menu-bar')) : null, curtain_display: getComputedStyle(c).display, letterhead_display: getComputedStyle(document.getElementById('fs-letterhead')).display, dash_toggle_hidden: document.getElementById('gridatlas-dash-toggle').hidden, map_container_class: document.getElementById('map-container').className }; });
    // Open the curtain with its real tab (the tab lives inside the Grid panel after adoptLate).
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('gridatlas-menu-bar-panel-4').hidden === false); await page.waitForTimeout(200);
    S.curtain_tab = await page.evaluate(HIT, '#fs-curtain-tab');
    S.shot_grid_fs = await shot(page, cfg.name + '-21-fullscreen-grid-open');
    await act(page.locator('#fs-curtain-tab')); await page.waitForTimeout(600);
    await page.evaluate(() => window.__GRIDATLAS_MODULES__.menuBar.closeAll()); await page.waitForTimeout(300);
    S.curtain_after_tab = await page.evaluate(() => { const c = document.getElementById('fs-curtain'); const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { curtain_open: c.classList.contains('curtain-open'), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], transform: cs.transform, zIndex: cs.zIndex, position: cs.position, tab_text: document.getElementById('fs-curtain-tab').textContent.trim(), keys_cols: getComputedStyle(document.getElementById('fs-curtain-keys')).gridTemplateColumns, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight }; });
    S.shot_curtain = await shot(page, cfg.name + '-22-fullscreen-curtain-open');
    S.hit_curtain_400 = await page.evaluate(HIT, '#fs-curtain-keys input[data-layer-id="400"]');
    S.hit_curtain_dc = await page.evaluate(HIT, '#fs-curtain-keys input[data-layer-id="dc"]');
    // Real click/tap on a curtain original with a short timeout: a refusal here is a FINDING, not a harness fault.
    const cdc = page.locator('#fs-curtain-keys input[data-layer-id="dc"]');
    try {
      await act(cdc.first()); await page.waitForTimeout(300);
      S.curtain_click_dc = { performed: true, ...(await page.evaluate(() => ({ curtain: document.querySelector('#fs-curtain-keys input[data-layer-id="dc"]').checked, scada: document.querySelector('#scada-ui-container input[data-layer-id="dc"]').checked, proxy: document.querySelector('[data-gridatlas-layer-proxy="engine:dc"]').checked, fs_label: document.getElementById('fs-lbl-dc').textContent }))) };
      await act(cdc.first()); await page.waitForTimeout(200);
    } catch (e) { S.curtain_click_dc = { performed: false, refusal: String(e.message).split('\n').slice(0, 1).join(' ') + ' | ' + (String(e.message).match(/<canvas[^>]*>[^\n]*intercepts pointer events/) || [''])[0].slice(0, 160) }; }
    // Curtain insertion-point geometry (content-relative to #fs-curtain, the scroll container) regardless of paint.
    await page.evaluate(() => { document.getElementById('fs-curtain').scrollTop = 0; });
    const cbase = await page.evaluate(REL, '#fs-curtain');
    S.curtain_append = { probe: await page.evaluate(ADD, { hostId: 'fs-curtain-keys', mode: 'append' }) };
    await page.waitForTimeout(150); await page.evaluate(() => { document.getElementById('fs-curtain').scrollTop = 0; });
    S.curtain_append.shift = diff(cbase, await page.evaluate(REL, '#fs-curtain'));
    if (S.curtain_click_dc.performed) {
      const cp = page.locator('[data-menu-contracts-probe-input="fs-curtain-keys"]'); await cp.scrollIntoViewIfNeeded();
      S.curtain_append.probe_hit = await page.evaluate(HIT, '[data-menu-contracts-probe-input="fs-curtain-keys"]');
      await act(cp); await page.waitForTimeout(200);
      S.curtain_append.probe_click = await page.evaluate(() => ({ probe_checked: document.querySelector('[data-menu-contracts-probe-input="fs-curtain-keys"]').checked, engine_checked: document.querySelectorAll('input[data-layer-id]:checked').length, pn_checked: document.querySelectorAll('input[data-pn-layer]:checked').length, menu: window.__GRIDATLAS_MODULES__.menuBar.inspect(), installed: window.__GRIDATLAS_MODULES__.menuBar.installed }));
      S.curtain_append.shot = await shot(page, cfg.name + '-23-curtain-append-probe');
    }
    await page.evaluate(REMOVE); await page.waitForTimeout(150);
    S.curtain_prepend = { probe: await page.evaluate(ADD, { hostId: 'fs-curtain-keys', mode: 'prepend' }) };
    await page.waitForTimeout(150); await page.evaluate(() => { document.getElementById('fs-curtain').scrollTop = 0; });
    S.curtain_prepend.shift = diff(cbase, await page.evaluate(REL, '#fs-curtain'));
    await page.evaluate(REMOVE);
    // Exit via the app's own exit control, where it lives now (View panel), real click/tap.
    await page.getByRole('button', { name: 'View', exact: true }).click(); await page.waitForTimeout(200);
    const exitBtn = page.locator('#btn-fullscreen-exit');
    S.exit_button = await exitBtn.evaluate((b) => { const r = b.getBoundingClientRect(); return { parent: b.parentElement.id, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], display: getComputedStyle(b).display }; });
    try { await act(exitBtn); await page.waitForTimeout(500); S.exit_performed = true; } catch (e) { S.exit_performed = false; S.exit_refusal = String(e.message).split('\n')[0]; await page.evaluate(() => window.exitFullscreen()); }
    S.after_exit = await page.evaluate(() => ({ fs_active: document.body.classList.contains('fs-active'), fullscreenElement: !!document.fullscreenElement, curtain_display: getComputedStyle(document.getElementById('fs-curtain')).display, inspect: window.__GRIDATLAS_MODULES__.menuBar.inspect(), installed: window.__GRIDATLAS_MODULES__.menuBar.installed, curtain_groups: document.querySelectorAll('#fs-curtain-keys .key-group').length }));
  } catch (e) { run.error = String(e.stack || e).slice(0, 1000); try { S.error_shot = await shot(page, cfg.name + '-97-error'); } catch {} }
  report.runs.push(run); await context.close();
  console.log(cfg.name, run.error ? 'ERROR ' + run.error.split('\n')[0] : 'ok');
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'menu-contracts.curtain.json'), JSON.stringify(report, null, 2));
console.log('written menu-contracts.curtain.json');
