// common.mjs — opus-a11y harness helpers. Harness: lead-shim (offline-shim.mjs), Chromium headless, SHA fda6b10 candidate.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
export const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/opus-a11y';
export const DATA = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
export const ROUTES = {
  baseline: { url: 'http://127.0.0.1:8152/gridatlas/atlas/', gen: '202609241334' },
  candidate: { url: 'http://127.0.0.1:8153/wt/atlas/v/202610261949/', gen: '202610261949' },
  after: { url: 'http://127.0.0.1:8161/wt/atlas/v/202610262323/', gen: '202610262323' }
};
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
export async function boot(route, { vw = 1440, vh = 900, reducedMotion = 'no-preference', data = DATA, initScript } = {}) {
  const mobile = vw < 700;
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? UA_ANDROID : undefined,
    locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion, colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(String(e.message || e)));
  if (initScript) await page.addInitScript(initScript);
  const shim = await installOfflineShim(page, { lightningDataDir: data });
  const R = ROUTES[route];
  await page.goto(R.url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(g => document.documentElement.dataset.gridatlasGeneration === g, R.gen, { timeout: 60000 });
  await page.waitForFunction(() => !!window.__GRIDATLAS_V9_MAP__ && window.__GRIDATLAS_MODULES__?.menuBar?.installed === true, null, { timeout: 90000 });
  if (route !== 'baseline') await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  return { browser, ctx, page, errors, shim, mobile };
}
// Describe document.activeElement (deep into shadow roots), plus computed focus indicator.
export const ACTIVE = `(() => { let e = document.activeElement; while (e && e.shadowRoot && e.shadowRoot.activeElement) e = e.shadowRoot.activeElement;
  if (!e || e === document.body) return { tag: e ? e.tagName.toLowerCase() : null, body: true };
  const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
  const attrs = [...e.attributes].filter(a => /^(id|data-[a-z-]+|aria-[a-z-]+|role|type|name|title)$/.test(a.name) && !/^data-gridatlas-layer-proxy$/.test('x')).map(a => a.name + '=' + a.value).join(' ');
  const lab = e.labels && e.labels[0] ? e.labels[0].textContent.trim() : '';
  const name = (e.getAttribute('aria-label') || lab || e.textContent || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 60);
  const surf = e.closest('#scada-ui-container') ? 'scada' : e.closest('#fs-curtain') ? 'curtain' : e.closest('#gridatlas-menu-bar') ? 'menubar' : 'other';
  return { tag: e.tagName.toLowerCase(), attrs, name, surf, lightning: !!e.closest('[data-lightning-group]'),
    key: e.tagName.toLowerCase() + '|' + (e.id || '') + '|' + (e.dataset.layerId || e.dataset.pnLayer || e.dataset.lightningControl || e.dataset.lightningPeriod || e.dataset.lightningNav || e.dataset.lightningDate || '') + '|' + name.slice(0, 30) + '|' + surf,
    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], inViewport: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth,
    outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, boxShadow: cs.boxShadow, border: cs.borderColor, focusVisible: e.matches(':focus-visible') }; })()`;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
