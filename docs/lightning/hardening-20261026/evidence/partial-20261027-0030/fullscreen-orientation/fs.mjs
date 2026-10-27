// fs.mjs <baseline|candidate> <WxH> — lane fullscreen-orientation. Harness: lead-shim (offline-shim.mjs, fixture lightning-archive),
// Chromium headless (phones/tablets = Chromium emulation, isMobile+hasTouch). Real gestures only: tap/click on locators,
// mouse.wheel (desktop) or CDP Input.synthesizeScrollGesture (touch) to scroll, setViewportSize to emulate rotation.
// No force:true, no dispatchEvent, no programmatic .checked / .click().
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import { writeFileSync } from 'node:fs';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/fullscreen-orientation/out';
const [route, vp] = process.argv.slice(2);
let [W, H] = vp.split('x').map(Number);
const URLS = { baseline: 'http://127.0.0.1:8180/gridatlas/atlas/', candidate: 'http://127.0.0.1:8180/wt/atlas/v/202610262323/' };
const touch = W < 1400, phone = Math.min(W, H) < 500, cand = route === 'candidate';
const tag = `${route}-${vp}`;
const R = { route, vp, harness: 'lead-shim, Chromium headless' + (touch ? ' emulation (isMobile, hasTouch)' : ''), steps: [], errors: [] };
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
const page = await ctx.newPage(); page.setDefaultTimeout(30000);
const cdp = await ctx.newCDPSession(page);
await page.clock.install({ time: '2026-10-26T18:40:00Z' });
await installOfflineShim(page, { lightningDataDir: '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data' });
page.on('pageerror', e => R.errors.push('pageerror: ' + e.message.slice(0, 200)));
await page.goto(URLS[route], { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 120000 });
if (cand) await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 60000 });
await page.waitForFunction(() => { const m = window.__GRIDATLAS_V9_MAP__; return m && m.loaded && m.loaded(); }, null, { timeout: 120000 }).catch(() => R.errors.push('map.loaded wait timed out'));
await page.waitForTimeout(6000);
const act = l => touch ? l.tap() : l.click();
const CT = '#fs-curtain-keys [data-lightning-control="toggle"]', MT = '#scada-ui-container [data-lightning-control="toggle"]';

// measurement in page: geometry of original controls, hit tests, overlaps
const measure = (label) => page.evaluate(({ label, cand }) => {
  const rr = e => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const shown = e => e && getComputedStyle(e).display !== 'none' && !e.hidden && e.getBoundingClientRect().width > 0;
  const inter = (a, c) => a && c && a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
  const hit = e => { const b = e.getBoundingClientRect(); const x = b.x + b.width / 2, y = b.y + b.height / 2; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return 'offscreen'; const t = document.elementFromPoint(x, y); if (!t) return 'none'; const lab = e.closest('label'); return (e === t || e.contains(t) || (lab && lab.contains(t))) ? 'self' : (t.tagName + '#' + t.id + '.' + String(t.className).slice(0, 30) + (t.closest('[data-lightning-group]') ? ' [LIGHTNING]' : '')); };
  const cur = document.getElementById('fs-curtain'), keys = document.getElementById('fs-curtain-keys');
  const fixed = { tab: document.getElementById('fs-curtain-tab'), exit: document.getElementById('btn-fullscreen-exit'), hide: document.getElementById('gridatlas-dash-toggle') };
  const o = { label, vw: innerWidth, vh: innerHeight, fsEl: document.fullscreenElement?.id || null, bodyFs: document.body.classList.contains('fs-active'),
    curtainOpen: cur.classList.contains('curtain-open'), curtain: rr(cur), curtainScroll: { top: cur.scrollTop, h: cur.scrollHeight, client: cur.clientHeight },
    tabText: fixed.tab.innerText, hideText: fixed.hide?.textContent || null, hideHidden: fixed.hide ? !shown(fixed.hide) : null,
    panelCollapsed: document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') === '1' };
  o.fixed = {}; for (const k in fixed) if (fixed[k]) o.fixed[k] = { shown: shown(fixed[k]), rect: rr(fixed[k]), hit: shown(fixed[k]) ? hit(fixed[k]) : 'hidden' };
  // original curtain children (relative to curtain content box, independent of scroll) and their checkboxes
  const orig = [...keys.children].filter(c => !c.matches('[data-lightning-group]'));
  const cb = cur.getBoundingClientRect();
  o.origGroups = orig.map(g => { const b = g.getBoundingClientRect(); return { t: (g.querySelector('.key-title')?.textContent || g.className).trim().slice(0, 24), x: +(b.x - cb.x).toFixed(1), y: +(b.y - cb.y + cur.scrollTop).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; });
  const inputs = [...keys.querySelectorAll('input')].filter(i => !i.closest('[data-lightning-group]'));
  o.origInputs = inputs.length;
  // hit test of every original input currently inside the curtain's visible clip and viewport
  const clipTop = Math.max(cb.y, 0), clipBot = Math.min(cb.y + cur.clientHeight, innerHeight);
  const vis = inputs.filter(i => { const b = i.getBoundingClientRect(); return o.curtainOpen && b.y >= clipTop && b.y + b.height <= clipBot && b.height > 0; });
  o.origVisibleInputs = vis.length; o.origBlocked = vis.map(i => ({ id: i.dataset.layerId || i.id, hit: hit(i) })).filter(z => z.hit !== 'self');
  if (cand) {
    const S = window.__GRIDATLAS_MODULES__.ukLightning.state;
    const ct = document.querySelector('#fs-curtain-keys [data-lightning-control="toggle"]'), mt = document.querySelector('#scada-ui-container [data-lightning-control="toggle"]');
    o.lightning = { on: S.on, curtainChecked: ct?.checked, mainChecked: mt?.checked, curtainLabel: document.querySelector('[data-lightning-label="fs"]')?.textContent, mainLabel: document.querySelector('[data-lightning-label="main"]')?.textContent, last: S.last ? { state: S.last.state, drawn: S.last.drawn } : null };
    const g = document.querySelector('#fs-curtain-keys [data-lightning-group]'), mg = document.querySelector('#scada-ui-container [data-lightning-group]');
    // lightning rects clipped to curtain visible region; overlap vs fixed controls
    const clip = r => { const y1 = Math.max(r.y, clipTop), y2 = Math.min(r.y + r.h, clipBot); return y2 > y1 ? { x: r.x, y: y1, w: r.w, h: y2 - y1 } : null; };
    const gr = o.curtainOpen && g ? clip(rr(g)) : null;
    o.overlap = {};
    for (const k in o.fixed) if (o.fixed[k].shown) { o.overlap['fsGroup×' + k] = !!inter(gr, o.fixed[k].rect); if (mg && shown(mg)) { const m = rr(mg); const sw = document.querySelector('.scada-wrapper'); const ok = !o.panelCollapsed; o.overlap['mainGroupControls×' + k] = ok ? [...mg.querySelectorAll('input,button:not([hidden]),[data-lightning-caption]')].filter(n => shown(n)).some(n => inter(rr(n), o.fixed[k].rect) && document.elementFromPoint(rr(n).x + 2, rr(n).y + 2) !== n) : false; } }
    // lightning group vs original groups (layout overlap, content coords)
    if (g) { const b = g.getBoundingClientRect(); const ly = b.y - cb.y + cur.scrollTop; o.fsGroupRel = { x: +(b.x - cb.x).toFixed(1), y: +ly.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; o.overlap['fsGroup×origGroups'] = o.origGroups.some(q => inter({ x: q.x, y: q.y, w: q.w, h: q.h - 0.5 }, { x: o.fsGroupRel.x, y: o.fsGroupRel.y + 0.5, w: o.fsGroupRel.w, h: o.fsGroupRel.h })); }
    const cap = document.getElementById('gridatlas-lightning-caption-fs');
    if (cap && o.curtainOpen && shown(cap)) { const c = rr(cap); o.caption = { rect: c, inClip: c.y >= clipTop - 0.5 && c.y + c.h <= clipBot + 0.5, hit: hit(cap) }; } else o.caption = { shown: !!(cap && shown(cap)) };
    const mcap = document.getElementById('gridatlas-lightning-caption-main');
    if (mcap && shown(mcap)) { const c = rr(mcap); o.mainCaption = { rect: c, inViewport: c.y >= 0 && c.y + c.h <= innerHeight, hit: hit(mcap) }; }
  }
  return o;
}, { label, cand });

const step = async (label, extra = {}) => { const m = await measure(label); Object.assign(m, extra); R.steps.push(m); await page.screenshot({ path: `${OUT}/${tag}-${R.steps.length.toString().padStart(2, '0')}-${label}.png`, timeout: 60000 }); return m; };
const scrollAt = async (x, y, dy) => { if (touch) await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(x), y: Math.round(y), yDistance: -dy, gestureSourceType: 'touch', speed: 3000 }); else { await page.mouse.move(x, y); await page.mouse.wheel(0, dy); } await page.waitForTimeout(250); };
// scroll the open curtain with gestures until selector's element is inside the curtain clip
const revealInCurtain = async (sel, toBottom = false) => {
  for (let i = 0; i < 25; i++) {
    const s = await page.evaluate(sel => { const c = document.getElementById('fs-curtain'), cb = c.getBoundingClientRect(), e = document.querySelector(sel); const b = e.getBoundingClientRect(); const top = Math.max(cb.y, 0), bot = Math.min(cb.y + c.clientHeight, innerHeight); return { ok: b.y >= top && b.y + b.height <= bot, atEnd: c.scrollTop + c.clientHeight >= c.scrollHeight - 1, cx: cb.x + cb.width / 2, cy: top + (bot - top) * 0.6 }; }, sel);
    if ((s.ok && !toBottom) || (toBottom && s.atEnd)) return { gestures: i, ok: s.ok };
    if (s.atEnd && !s.ok) return { gestures: i, ok: false, reason: 'curtain at end but target not in clip' };
    await scrollAt(s.cx, s.cy, 250);
  }
  return { gestures: 25, ok: false };
};
const waitReady = () => page.waitForFunction(() => { const t = document.querySelector('[data-lightning-label="fs"]')?.textContent || ''; return !/LOAD|WAIT/.test(t); }, null, { timeout: 30000 }).then(() => true, () => false);
const enterFs = async () => { await act(page.getByRole('button', { name: 'View', exact: true })); await page.waitForTimeout(400); await act(page.locator('#btn-fullscreen')); await page.waitForTimeout(1000); };
const openCurtain = async () => { await act(page.locator('#fs-curtain-tab')); await page.waitForTimeout(700); };
const rotate = async () => { [W, H] = [H, W]; await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(1200); };
const tryStep = async (name, fn) => { try { await fn(); } catch (e) { R.errors.push(`${name}: ${e.message.split('\n').slice(0, 8).join(' | ').slice(0, 900)}`); await step('ERR-' + name).catch(() => {}); } };

await step('rest');
// A. enter fullscreen, open curtain, original geometry at scrollTop 0
await tryStep('enterFs', async () => { await enterFs(); await step('fs'); await openCurtain(); await step('curtain-open'); });
if (cand) {
  // B. curtain toggle ON (curtain -> main sync)
  await tryStep('curtainOn', async () => { const rv = await revealInCurtain(CT); await act(page.locator(CT)); const ready = await waitReady(); await page.waitForTimeout(500); await step('curtain-on', { reveal: rv, ready }); const cap = await revealInCurtain('#gridatlas-lightning-caption-fs', true); await step('curtain-on-bottom', { reveal: cap }); });
  // C. rotation with lightning ON and curtain (panel) open
  if (phone) await tryStep('rotate', async () => { await rotate(); await step('rotated-on'); await revealInCurtain('#gridatlas-lightning-caption-fs', true); await step('rotated-on-bottom'); await rotate(); await step('rotated-back-on'); await revealInCurtain('#gridatlas-lightning-caption-fs', true); await step('rotated-back-bottom'); });
  // D. exit fullscreen with the curtain open (tap the shell's Exit control)
  await tryStep('exitOpen', async () => { await act(page.locator('#btn-fullscreen-exit')); await page.waitForTimeout(1200); await step('exited-with-curtain-open'); });
  // E. main -> curtain sync: expand panel if collapsed, tap main toggle OFF, re-enter fullscreen and check curtain
  await tryStep('mainOff', async () => {
    const col = await page.evaluate(() => document.querySelector('.scada-wrapper')?.getAttribute('data-gridatlas-collapsed') === '1');
    if (col) { await act(page.locator('#gridatlas-dash-toggle')); await page.waitForTimeout(600); }
    await act(page.locator(MT)); await page.waitForTimeout(600); await step('main-off');
    await enterFs(); await openCurtain(); await step('fs-after-main-off');
    await revealInCurtain(CT); await act(page.locator(CT)); await waitReady(); await page.waitForTimeout(500); await step('curtain-on-again');
    await act(page.locator('#btn-fullscreen-exit')); await page.waitForTimeout(1200); await step('exited-again');
  });
  // F. rotation with lightning ON and the main panel open (not fullscreen)
  if (phone) await tryStep('rotatePanel', async () => { await page.locator(MT).scrollIntoViewIfNeeded(); await step('panel-open-on'); await rotate(); await step('panel-rotated'); await rotate(); await step('panel-rotated-back'); });
} else {
  if (phone) await tryStep('rotate', async () => { await rotate(); await step('rotated-on'); await rotate(); await step('rotated-back-on'); });
  await tryStep('exitOpen', async () => { await act(page.locator('#btn-fullscreen-exit')); await page.waitForTimeout(1200); await step('exited-with-curtain-open'); });
}
writeFileSync(`${OUT}/${tag}.json`, JSON.stringify(R, null, 1));
console.log('DONE', tag, 'steps', R.steps.length, 'errors', R.errors.length);
await b.close();
