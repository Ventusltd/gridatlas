// recon.mjs <route baseline|candidate> <WxH> [noapi] — lane fullscreen-orientation. lead-shim, Chromium headless.
// Dumps where the fullscreen entry, curtain tab, HIDE LAYERS and the curtain sit at a viewport. Real gestures only.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const [route = 'candidate', vp = '393x852', mode = ''] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const URLS = { baseline: ['http://127.0.0.1:8180/gridatlas/atlas/', '202609241334'], candidate: ['http://127.0.0.1:8180/wt/atlas/v/202610262323/', '202610262323'] };
const touch = W < 1400;
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
const page = await ctx.newPage(); page.setDefaultTimeout(8000);
if (mode === 'noapi') await page.addInitScript(() => { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen; });
if (!process.env.NOCLOCK) await page.clock.install({ time: '2026-10-26T18:40:00Z' });
await installOfflineShim(page, { lightningDataDir: '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data' });
await page.goto(URLS[route][0], { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
await page.waitForTimeout(3000);
const act = l => touch ? l.tap() : l.click();
const dump = () => page.evaluate(() => {
  const r = id => { const e = typeof id === 'string' ? document.querySelector(id) : id; if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), txt: (e.innerText || '').trim().slice(0, 30), vis: getComputedStyle(e).display !== 'none' && b.width > 0 }; };
  return { fsEl: document.fullscreenElement?.id || null, bodyFs: document.body.classList.contains('fs-active'), menus: [...document.querySelectorAll('.gm-title')].map(t => t.textContent.trim()), btnFs: r('#btn-fullscreen'), btnFsParent: document.querySelector('#btn-fullscreen')?.parentElement?.className, exit: r('#btn-fullscreen-exit'), tab: r('#fs-curtain-tab'), curtain: r('#fs-curtain'), curtainCls: document.getElementById('fs-curtain').className, hide: r('#gridatlas-dash-toggle'), menubar: r('#gridatlas-menu-bar'), fsGroup: r('#fs-curtain-keys [data-lightning-group]'), fsToggle: r('#fs-curtain-keys [data-lightning-control="toggle"]') };
});
console.log('rest', JSON.stringify(await dump()));
try { await act(page.getByRole('button', { name: 'View', exact: true })); await page.waitForTimeout(300); console.log('view open', JSON.stringify(await dump())); await act(page.locator('#btn-fullscreen')); await page.waitForTimeout(800); } catch (e) { console.log('ERR fs', e.message.split('\n')[0]); }
console.log('fs', JSON.stringify(await dump()));
try { await act(page.getByRole('button', { name: 'Grid', exact: true })); await page.waitForTimeout(300); await act(page.locator('#fs-curtain-tab')); await page.waitForTimeout(800); } catch (e) { console.log('ERR tab', e.message.split('\n')[0]); }
console.log('curtain', JSON.stringify(await dump()));
const at = await page.evaluate(() => { const i = document.querySelector('#fs-curtain-keys input[data-layer-id="400"]'); const b = i.getBoundingClientRect(); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return t ? t.tagName + '#' + t.id + '.' + String(t.className).slice(0, 40) : null; });
console.log('at400', at);
await page.screenshot({ path: `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/fullscreen-orientation/out/recon-${route}-${vp}${mode}.png` });
await b.close();
