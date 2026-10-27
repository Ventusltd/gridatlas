#!/usr/bin/env node
// p14-p15.mjs — visual-challenge-B, issue #32 P14 (controls physically reachable without programmatic scrolling) and
// P15 (named/announced toggle, state, contrast, reduced motion, no flashing). Candidate route only (the original
// controls' reachability on BOTH routes per state is in parity/runs/full-matrix-OFF/*/extras.json).
// Harness: lead-shim with lightningDataDir = fixtures/lightning-archive/data (the data-plane builder's fixture built from
// the genuine 408-flash seed; see fixtures/README.md), Chromium headless. Real locator.click()/tap() and REAL wheel
// gestures (page.mouse.wheel) only; no force:true; the one programmatic scroll is labelled as such.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';

const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/visual-challenge-B/p14-p15';
const CANDIDATE = 'http://127.0.0.1:8142/wt/atlas/v/202610261949/';
const DATA = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_ANDROID_SMALL = 'Mozilla/5.0 (Linux; Android 14; SM-A156B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const VIEWPORTS = [
  { name: 'desktop-1440x900', viewport: { width: 1440, height: 900 }, phone: false },
  { name: 'desktop-1280x720', viewport: { width: 1280, height: 720 }, phone: false },
  { name: 'desktop-1920x1080', viewport: { width: 1920, height: 1080 }, phone: false },
  { name: 'android-393x852', viewport: { width: 393, height: 852 }, phone: true, ua: UA_ANDROID },
  { name: 'android-360x740', viewport: { width: 360, height: 740 }, phone: true, ua: UA_ANDROID_SMALL },
  { name: 'iphone-390x844-geometry-only', viewport: { width: 390, height: 844 }, phone: true, ua: UA_IPHONE, noFs: true, note: 'Chromium with an iPhone UA; WebKit not installed; geometry only, NOT Safari' }
];

// resume (after container restart): optional VPS=name1,name2 filter and OUTNAME; partial JSON written after every context.
const VPS = (process.env.VPS || '').split(',').filter(Boolean);
const OUTNAME = process.env.OUTNAME || 'p14-p15.json';
const HIT = `((sel) => { const sg = (e) => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + [...e.attributes].filter(a => /^data-(lightning-group|lightning-control|layer-id|pn-layer)$/.test(a.name)).map(a => '[' + a.name + '=' + a.value + ']').join('') : null;
  const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) return { present: false };
  const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
  const inVp = b.width > 0 && b.height > 0 && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight; const t = inVp ? document.elementFromPoint(cx, cy) : null;
  const self = t && (t === e || e.contains(t) || (e.tagName === 'LABEL' && e.control && (t === e.control || e.control.contains(t))) || (t.tagName === 'LABEL' && t.control === e));
  return { present: true, rect: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], inViewport: inVp, hit: !inVp ? 'OUT-OF-VIEWPORT' : !t ? 'NONE' : self ? 'self' : 'OTHER:' + sg(t) }; })`;

// WCAG 2.x contrast of an element's text colour against the first opaque-enough ancestor background (alpha composited over #000, the body background).
const CONTRAST = `((sel) => { const e = document.querySelector(sel); if (!e) return null;
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  let bg = { r: 0, g: 0, b: 0 }; const chain = []; for (let a = e; a; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c.a > 0) chain.push({ el: a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (a.className && typeof a.className === 'string' ? '.' + a.className.trim().split(/\\s+/)[0] : ''), c }); }
  for (const { c } of chain.reverse()) bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) };
  const fg = parse(getComputedStyle(e).color); const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const l1 = L(fg), l2 = L(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); const cs = getComputedStyle(e);
  return { selector: sel, color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight, opacity: cs.opacity, effectiveBackground: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')', backgroundChain: chain.map(x => x.el), ratio: Math.round(ratio * 100) / 100, wcagAA_normalText: ratio >= 4.5, wcagAA_largeText: ratio >= 3, text: (e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60) }; })`;

async function wheelUntilHit(page, containerSel, targetSel, maxSteps = 12, phone = false) {
  const steps = [];
  for (let i = 0; i < maxSteps; i++) {
    const h = await ev(page, HIT, targetSel);
    const st = await page.evaluate((s) => { const c = document.querySelector(s); return c ? { scrollTop: c.scrollTop, max: c.scrollHeight - c.clientHeight, rect: [Math.round(c.getBoundingClientRect().x), Math.round(c.getBoundingClientRect().y), Math.round(c.getBoundingClientRect().width), Math.round(c.getBoundingClientRect().height)] } : null; }, containerSel);
    steps.push({ step: i, hit: h.hit, targetRect: h.rect, containerScrollTop: st?.scrollTop, containerMaxScrollTop: st?.max });
    if (h.hit === 'self' || !st) break;
    if (st.scrollTop >= st.max) { steps.push({ step: i, note: 'container at max scroll, target still ' + h.hit }); break; }
    // resume fix: the geometric centre of #fs-curtain can be covered by the map canvas (the visible curtain sits inside the
    // Grid panel), so wheel at the first scanned point whose elementFromPoint is inside the container.
    const pt = await page.evaluate((s) => { const c = document.querySelector(s); const b = c.getBoundingClientRect(); for (let fy = 0.5; fy < 0.95; fy += 0.1) for (let fx = 0.1; fx < 0.95; fx += 0.1) { const x = Math.min(innerWidth - 2, Math.max(1, b.x + b.width * fx)), y = Math.min(innerHeight - 2, Math.max(1, b.y + b.height * fy)); const e = document.elementFromPoint(x, y); if (e && c.contains(e)) return [x, y]; } for (let y = 40; y < innerHeight; y += 20) for (let x = 10; x < innerWidth; x += 20) { const e = document.elementFromPoint(x, y); if (e && c.contains(e)) return [x, y]; } return null; }, containerSel);
    if (!pt) { steps.push({ step: i, note: 'no point inside the container is hit-testable' }); break; }
    await page.mouse.move(pt[0], pt[1]); await page.mouse.wheel(0, 400); await page.waitForTimeout(250);
  }
  return { gesture: 'page.mouse.wheel(0,400) per step over the container' + (phone ? ' (Chromium touch emulation accepts wheel; NOT a real finger drag)' : ''), steps, reached: steps.some(s => s.hit === 'self') };
}

async function sampleFlashing(page, sel, frames = 12, intervalMs = 250) {
  // consecutive-frame pixel differences of the element's own region (clock excluded by construction: it is not inside the group)
  const shots = [];
  for (let i = 0; i < frames; i++) { const el = page.locator(sel).first(); shots.push((await el.screenshot({ animations: 'allow' })).toString('base64')); await page.waitForTimeout(intervalMs); }
  return page.evaluate(async (shots) => {
    const load = (b) => new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = 'data:image/png;base64,' + b; });
    const ims = await Promise.all(shots.map(load)); const W = Math.max(...ims.map(i => i.width)), H = Math.max(...ims.map(i => i.height));
    const px = ims.map(im => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; });
    const diffs = []; for (let k = 1; k < px.length; k++) { let n = 0; for (let i = 0; i < W * H * 4; i += 4) { if (Math.abs(px[k][i] - px[k - 1][i]) > 16 || Math.abs(px[k][i + 1] - px[k - 1][i + 1]) > 16 || Math.abs(px[k][i + 2] - px[k - 1][i + 2]) > 16) n++; } diffs.push(n); }
    return { width: W, height: H, area: W * H, consecutiveFrameChangedPixels: diffs, framesWithChange: diffs.filter(d => d > 0).length, maxChangedPct: Math.round(Math.max(...diffs) / (W * H) * 10000) / 100 };
  }, shots);
}

// Playwright does NOT invoke a function-valued STRING with an argument (it returns undefined); evaluate the source and call it.
const ev = (page, src, arg) => page.evaluate(([s, a]) => (0, eval)(s)(a), [src, arg]);

const browser = await chromium.launch({ headless: true });
const report = { harness: 'lead-shim + lightningDataDir=' + DATA, chromium: browser.version(), node: process.version, candidate: CANDIDATE, startedAt: new Date().toISOString(), viewports: {} };
for (const vp of VIEWPORTS.filter(v => !VPS.length || VPS.includes(v.name))) {
  const vrec = { profile: vp.phone ? 'Chromium phone emulation (touch, mobile UA)' + (vp.note ? ' — ' + vp.note : '') : 'desktop Chromium, mouse', motion: {} };
  report.viewports[vp.name] = vrec;
  for (const motion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: vp.viewport, deviceScaleFactor: 1, isMobile: vp.phone, hasTouch: vp.phone, userAgent: vp.ua, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark', reducedMotion: motion });
    if (vp.noFs) await context.addInitScript(() => { try { Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true }); Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { value: undefined, configurable: true }); } catch {} });
    const page = await context.newPage();
    const shim = await installOfflineShim(page, { lightningDataDir: DATA });
    // hold the archive index for 2.5 s so the LOADING state is observable (then fall back to the shim's handler)
    await page.route('**/data/history/index.json', async (route) => { await new Promise(r => setTimeout(r, 2500)); await route.fallback(); });
    const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    const m = { reducedMotionMatches: null, layers: {}, menu: {}, curtain: {}, a11y: {}, contrast: {}, flashing: {}, on: {} };
    vrec.motion[motion] = m;
    await page.goto(CANDIDATE, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForComposition(page, { deadlineMs: 90000, settleMs: 2500 });
    await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
    m.reducedMotionMatches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    m.lightningRequestsAtBoot = await page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.requests);
    // ---- Layers surface (main): phone = real tap on the LAYERS toggle first
    if (vp.phone) {
      const t = page.locator('#gridatlas-dash-toggle'); const th = await ev(page, HIT, '#gridatlas-dash-toggle');
      m.layers.toggleText = await t.textContent(); m.layers.toggleHit = th;
      if (th.hit === 'self') { await t.tap(); await page.waitForTimeout(400); }
      m.layers.openedByTap = await page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') !== '1');
    }
    m.layers.atRest = await ev(page, HIT, '#scada-ui-container [data-lightning-group="main"] [data-lightning-control]');
    m.layers.originalLastGroupAtRest = await ev(page, HIT, '#scada-ui-container input[data-pn-layer]');
    m.layers.scrollContainer = await page.evaluate(() => { const c = document.getElementById('scada-ui-container'); const cs = getComputedStyle(c); return { overflowY: cs.overflowY, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight, userScrollable: /(auto|scroll)/.test(cs.overflowY) && c.scrollHeight > c.clientHeight }; });
    m.layers.wheel = await wheelUntilHit(page, '#scada-ui-container', '#scada-ui-container [data-lightning-group="main"] [data-lightning-control]', 14, vp.phone);
    m.layers.originalLastGroupAfterWheel = await ev(page, HIT, '#scada-ui-container input[data-pn-layer]');
    // ---- accessibility of the toggle (main) + keyboard state semantics
    const mainToggle = page.locator('#scada-ui-container [data-lightning-group="main"] [data-lightning-control]');
    m.a11y.mainGroupAriaSnapshot = await page.locator('#scada-ui-container [data-lightning-group="main"]').ariaSnapshot();
    m.a11y.menuGroupAriaSnapshot = await page.locator('[data-lightning-group="menu"]').ariaSnapshot();
    m.a11y.mainToggle = await page.evaluate(() => { const t = document.querySelector('#scada-ui-container [data-lightning-group="main"] [data-lightning-control]'); const l = t.closest('label'); return { tag: t.tagName, type: t.type, implicitRole: 'checkbox (input type=checkbox)', explicitRole: t.getAttribute('role'), ariaLabel: t.getAttribute('aria-label'), labelledByWrappingLabel: !!l, labelText: l ? l.textContent.trim() : null, checked: t.checked, ariaChecked: t.getAttribute('aria-checked'), focusable: t.tabIndex >= 0, groupTitle: t.closest('.key-group')?.querySelector('.key-title')?.textContent, groupHasRoleOrLabel: !!(t.closest('.key-group')?.getAttribute('role') || t.closest('.key-group')?.getAttribute('aria-label')), originalRowExample: (() => { const o = document.querySelector('#scada-ui-container input[data-layer-id="400"]'); const ol = o.closest('label'); return { ariaLabel: o.getAttribute('aria-label'), labelText: ol ? ol.textContent.trim() : null, role: o.getAttribute('role') }; })() }; });
    m.a11y.menuToggle = await page.evaluate(() => { const t = document.querySelector('[data-lightning-group="menu"] [data-lightning-control]'); return { ariaLabel: t.getAttribute('aria-label'), labelText: t.closest('label')?.textContent.trim(), checked: t.checked, originalProxyExample: (() => { const o = document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body input'); return { ariaLabel: o?.getAttribute('aria-label'), labelText: o?.closest('label')?.textContent.trim() }; })() }; });
    // keyboard: focus the toggle and press Space (checkbox semantics) -> state ON, then Space again -> OFF
    if (m.layers.wheel.reached) {
      await mainToggle.focus(); await page.keyboard.press('Space'); await page.waitForTimeout(300);
      m.a11y.afterSpace = await page.evaluate(() => { const t = document.querySelector('#scada-ui-container [data-lightning-group="main"] [data-lightning-control]'); const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return { checked: t.checked, stateOn: s.on, focused: document.activeElement === t, labelText: t.closest('label').textContent.trim() }; });
      await page.keyboard.press('Space'); await page.waitForTimeout(300);
      m.a11y.afterSecondSpace = await page.evaluate(() => { const t = document.querySelector('#scada-ui-container [data-lightning-group="main"] [data-lightning-control]'); const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return { checked: t.checked, stateOn: s.on, requestsSoFar: s.requests, mapHasLightningLayer: !!window.__GRIDATLAS_V9_MAP__.getLayer('l-gridatlas-lightning') }; });
    }
    // ---- contrast (OFF state first: label), then switch ON by a REAL click/tap on the checkbox and measure captions
    m.contrast.labelOFF = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] [data-lightning-label]');
    m.contrast.originalLabel = await ev(page, CONTRAST, '#scada-ui-container label.key-item span[id^="lbl-"]');
    m.contrast.groupTitle = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] .key-title');
    m.contrast.menuLabel = await ev(page, CONTRAST, '[data-lightning-group="menu"] .gm-layer-name');
    m.contrast.menuGroupTitle = await ev(page, CONTRAST, '[data-lightning-group="menu"] .gm-layer-group');
    if (m.layers.wheel.reached) {
      const before = await page.evaluate(() => [...document.querySelectorAll('#scada-ui-container .key-group:not([data-lightning-group]) label.key-item')].map(l => { const b = l.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }));
      const hitNow = await ev(page, HIT, '#scada-ui-container [data-lightning-group="main"] [data-lightning-control]');
      if (hitNow.hit === 'self') { if (vp.phone) await mainToggle.tap(); else await mainToggle.click(); }
      m.on.toggledBy = hitNow.hit === 'self' ? ('real ' + (vp.phone ? 'tap' : 'click') + ' on the checkbox input') : 'NOT toggled (not hit-testable)';
      await page.waitForTimeout(600);
      m.on.loadingSnapshot = await page.evaluate(() => { const g = document.querySelector('#scada-ui-container [data-lightning-group="main"]'); return { label: g.querySelector('[data-lightning-label]').textContent, status: g.querySelector('.status-dot').textContent.trim(), dot: g.querySelector('[data-lightning-dot]').style.background, controlsHidden: g.querySelector('[data-lightning-controls]').hidden, ariaLive: g.querySelector('[data-lightning-caption]').getAttribute('aria-live'), role: g.querySelector('[data-lightning-caption]').getAttribute('role') }; });
      m.flashing.whileLoading = await sampleFlashing(page, '#scada-ui-container [data-lightning-group="main"]', 8, 250);
      await page.waitForFunction(() => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return s.last && s.last.state; }, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      m.on.readySnapshot = await page.evaluate(() => { const g = document.querySelector('#scada-ui-container [data-lightning-group="main"]'); const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return { label: g.querySelector('[data-lightning-label]').textContent, status: g.querySelector('.status-dot').textContent.trim(), state: s.last, requests: s.requests, errors: s.errors, captions: Object.fromEntries([...g.querySelectorAll('[data-cap]')].map(c => [c.dataset.cap, c.textContent])), groupRect: (() => { const b = g.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; })(), chipMinSize: (() => { const b = g.querySelector('.map-ctrl-btn').getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; })(), mapLayer: !!window.__GRIDATLAS_V9_MAP__.getLayer('l-gridatlas-lightning') }; });
      const after = await page.evaluate(() => [...document.querySelectorAll('#scada-ui-container .key-group:not([data-lightning-group]) label.key-item')].map(l => { const b = l.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; }));
      m.on.originalRowsMovedByON = before.filter((b, i) => JSON.stringify(b) !== JSON.stringify(after[i])).length;
      m.on.originalRowsCompared = before.length;
      m.contrast.caption = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] [data-cap="window"]');
      m.contrast.captionWarning = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] [data-cap="warning"]');
      m.contrast.captionFooter = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] [data-cap="footer"]');
      m.contrast.statusLine = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] .status-dot');
      m.contrast.labelON = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] [data-lightning-label]');
      m.contrast.activeChip = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] .map-ctrl-btn.active');
      m.contrast.chip = await ev(page, CONTRAST, '#scada-ui-container [data-lightning-group="main"] .map-ctrl-btn:not(.active)');
      m.flashing.whileReadyIdle5s = await sampleFlashing(page, '#scada-ui-container [data-lightning-group="main"]', 12, 420);
      m.flashing.computedAnimations = await page.evaluate(() => { const g = document.querySelector('#scada-ui-container [data-lightning-group="main"]'); const out = []; for (const el of [g, ...g.querySelectorAll('*')]) { const cs = getComputedStyle(el); if (cs.animationName !== 'none' || (cs.transitionProperty !== 'all' && cs.transitionProperty !== 'none' && parseFloat(cs.transitionDuration) > 0) || parseFloat(cs.transitionDuration) > 0) out.push({ el: el.tagName + '.' + el.className, animation: cs.animationName, transition: cs.transitionProperty + ' ' + cs.transitionDuration }); } return { count: out.length, sample: out.slice(0, 5), getAnimations: typeof g.getAnimations === 'function' ? g.getAnimations({ subtree: true }).length : null }; });
      const shotOn = path.join(OUT, `layers-ON-${vp.name}-${motion}.png`); await page.screenshot({ path: shotOn, fullPage: false }); m.on.screenshot = shotOn;
      // switch OFF by the same real gesture; the original rows must be back where they were
      const hitOff = await ev(page, HIT, '#scada-ui-container [data-lightning-group="main"] [data-lightning-control]');
      if (hitOff.hit === 'self') { if (vp.phone) await mainToggle.tap(); else await mainToggle.click(); await page.waitForTimeout(400); }
      m.on.afterOFF = await page.evaluate(() => { const s = window.__GRIDATLAS_MODULES__.ukLightning.state; return { on: s.on, mapLayer: !!window.__GRIDATLAS_V9_MAP__.getLayer('l-gridatlas-lightning'), source: !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-lightning'), label: document.querySelector('#scada-ui-container [data-lightning-group="main"] [data-lightning-label]').textContent, controlsHidden: document.querySelector('#scada-ui-container [data-lightning-group="main"] [data-lightning-controls]').hidden }; });
    }
    // ---- Grid dropdown mirror reachability (real click on Grid, no scrolling at all)
    const gridBtn = page.getByRole('button', { name: 'Grid', exact: true }).first();
    if (vp.phone) await gridBtn.tap(); else await gridBtn.click(); await page.waitForTimeout(350);
    m.menu.footerToggle = await ev(page, HIT, '[data-lightning-group="menu"] [data-lightning-control]');
    m.menu.originalFirstProxy = await ev(page, HIT, '#gridatlas-menu-bar-panel-4 [data-gridatlas-layer-key="engine:400"]');
    m.menu.originalCurtainTab = await ev(page, HIT, '#fs-curtain-tab');
    m.menu.panelClipped = await page.evaluate(() => { const p = document.getElementById('gridatlas-menu-bar-panel-4'), mc = document.getElementById('map-container'); const pr = p.getBoundingClientRect(), mr = mc.getBoundingClientRect(); return { panelBottom: Math.round(pr.bottom), mapContainerBottom: Math.round(mr.bottom), clippedPx: Math.max(0, Math.round(pr.bottom - mr.bottom)), mapContainerOverflow: getComputedStyle(mc).overflow, panelPosition: getComputedStyle(p).position }; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    // ---- fullscreen curtain surface (fs): View > fullscreen, Grid > ⬇ Layers tab only if hit-testable, then wheel inside #fs-curtain
    const viewBtn = page.getByRole('button', { name: 'View', exact: true }).first();
    if (vp.phone) await viewBtn.tap(); else await viewBtn.click(); await page.waitForTimeout(300);
    const fsBtn = page.locator('#btn-fullscreen'); const fsHit = await ev(page, HIT, '#btn-fullscreen');
    if (fsHit.hit === 'self') { if (vp.phone) await fsBtn.tap(); else await fsBtn.click(); }
    m.curtain.fsActive = await page.waitForFunction(() => document.body.classList.contains('fs-active'), null, { timeout: 5000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(500);
    const tabVisible = await page.locator('#fs-curtain-tab').isVisible().catch(() => false);
    if (!tabVisible) { if (vp.phone) await gridBtn.tap(); else await gridBtn.click(); await page.waitForTimeout(300); }
    m.curtain.tabHit = await ev(page, HIT, '#fs-curtain-tab');
    if (m.curtain.tabHit.hit === 'self') {
      const tab = page.locator('#fs-curtain-tab'); if (vp.phone) await tab.tap(); else await tab.click(); await page.waitForTimeout(500);
      m.curtain.open = await page.evaluate(() => document.getElementById('fs-curtain')?.classList.contains('curtain-open'));
      m.curtain.scrollContainer = await page.evaluate(() => { const c = document.getElementById('fs-curtain'); const cs = getComputedStyle(c); return { overflowY: cs.overflowY, scrollHeight: c.scrollHeight, clientHeight: c.clientHeight, userScrollable: /(auto|scroll)/.test(cs.overflowY) && c.scrollHeight > c.clientHeight }; });
      m.curtain.atRest = await ev(page, HIT, '#fs-curtain-keys [data-lightning-group="fs"] [data-lightning-control]');
      m.curtain.wheel = await wheelUntilHit(page, '#fs-curtain', '#fs-curtain-keys [data-lightning-group="fs"] [data-lightning-control]', 14, vp.phone);
      m.curtain.originalLastGroupAfterWheel = await ev(page, HIT, '#fs-curtain-keys input[data-pn-layer]');
      m.a11y.fsGroupAriaSnapshot = await page.locator('#fs-curtain-keys [data-lightning-group="fs"]').ariaSnapshot();
      const shotC = path.join(OUT, `curtain-${vp.name}-${motion}.png`); await page.screenshot({ path: shotC, fullPage: false }); m.curtain.screenshot = shotC;
    } else m.curtain.open = false;
    m.pageErrors = errors; m.shim = shim.summary();
    await context.close();
    console.log(`[${vp.name}/${motion}] rm=${m.reducedMotionMatches} layers: rest=${m.layers.atRest.hit} wheel-reached=${m.layers.wheel.reached} (${m.layers.wheel.steps.length} steps) | menu footer=${m.menu.footerToggle.hit} clipped=${m.menu.panelClipped.clippedPx}px | curtain tab=${m.curtain.tabHit?.hit} fs-reached=${m.curtain.wheel?.reached} | ON=${m.on.readySnapshot?.status} rowsMoved=${m.on.originalRowsMovedByON} | flashing loading max=${m.flashing.whileLoading?.maxChangedPct}% frames=${m.flashing.whileLoading?.framesWithChange} idle max=${m.flashing.whileReadyIdle5s?.maxChangedPct}% frames=${m.flashing.whileReadyIdle5s?.framesWithChange} | contrast label=${m.contrast.labelOFF?.ratio} caption=${m.contrast.caption?.ratio} footer=${m.contrast.captionFooter?.ratio}`);
    fs.writeFileSync(path.join(OUT, OUTNAME + '.partial'), JSON.stringify(report, null, 2) + '\n');
  }
}
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, OUTNAME), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log('written ' + path.join(OUT, OUTNAME));
