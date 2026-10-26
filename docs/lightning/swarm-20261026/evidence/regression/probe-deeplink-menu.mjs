import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const url = process.argv[2];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await installOfflineShim(ctx);
await ctx.route(/^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/(?!lightning\/)/, r => r.continue());
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__GRIDATLAS_V9_MAP__ && document.querySelectorAll('[data-gridatlas-layer-proxy]').length >= 60, null, { timeout: 90000 });
await page.locator('.gridatlas-card-bar .min').first().waitFor({ timeout: 60000 });
await page.waitForFunction(() => window.__GRIDATLAS_PIPELINE_LAYERS__?.selection, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const titles = [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')];
  const bar = document.getElementById('gridatlas-menu-bar');
  const ariaHiddenAncestor = (el) => { let n = el; while (n) { if (n.getAttribute && (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('inert'))) return n.id || n.className; n = n.parentElement; } return null; };
  return { titles: titles.map(t => ({ text: t.textContent.trim(), role: t.getAttribute('role'), tag: t.tagName, ariaLabel: t.getAttribute('aria-label'), hiddenAncestor: ariaHiddenAncestor(t), rect: t.getBoundingClientRect().toJSON(), display: getComputedStyle(t).display, visibility: getComputedStyle(t).visibility })), barHidden: ariaHiddenAncestor(bar), fullscreen: document.fullscreenElement?.id || null, bodyClass: document.body.className, topAtGrid: (() => { const g = titles.find(t => /grid/i.test(t.textContent)); if (!g) return null; const r = g.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && (e.id || e.className || e.tagName); })() };
});
console.log(JSON.stringify(info, null, 1));
const grid = page.getByRole('button', { name: 'Grid', exact: true });
console.log('getByRole count:', await grid.count());
try { await grid.click({ timeout: 6000 }); console.log('click ok, expanded=', await grid.getAttribute('aria-expanded')); } catch (e) { console.log('click failed:', String(e).split('\n').slice(0, 4).join(' | ')); }
await page.screenshot({ path: 'probe/deeplink-menu-1440.png' });
await browser.close();
