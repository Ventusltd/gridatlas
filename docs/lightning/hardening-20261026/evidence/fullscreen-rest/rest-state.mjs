// Rest-state parity: what a phone user sees on arrival, with NO interaction.
// Baseline = live route wt/atlas/ (202609241334); candidates = atlas/v/<gen>/.
// Harness: lead offline shim, Chromium emulation (not WebKit). Usage:
//   node rest-state.mjs --base http://127.0.0.1:PORT/wt --gens 202610270047,202610262323
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '../../../lightning/harness/offline-shim.mjs';
import fs from 'node:fs';
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const BASE = arg('--base'), GENS = (arg('--gens') || '').split(',').filter(Boolean);
const DATA = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';
const VPS = [{ width: 393, height: 852 }, { width: 393, height: 659 }];
const out = {};
const browser = await chromium.launch({ headless: true });
for (const vp of VPS) for (const route of [['baseline', BASE + '/atlas/'], ...GENS.map(g => [g, `${BASE}/atlas/v/${g}/`])]) {
  const key = `${route[0]}@${vp.width}x${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, userAgent: UA, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  const page = await ctx.newPage(); const light = [];
  page.on('request', r => { if (r.url().includes('Ventusltd/lightning')) light.push(r.url()); });
  await installOfflineShim(page, { lightningDataDir: DATA });
  await page.goto(route[1], { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitForComposition(page, { deadlineMs: 90000, settleMs: 4000 });
  const st = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role=button]')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > innerHeight - 260; })
      .map(b => ({ text: b.innerText.trim().replace(/\s+/g, ' '), cls: b.className, pressed: b.getAttribute('aria-pressed'), active: /active|on|sel/i.test(b.className), bg: getComputedStyle(b).backgroundColor, rect: (r => [r.x, r.y, r.width, r.height].map(Math.round))(b.getBoundingClientRect()) }));
    const m = window.__GRIDATLAS_V9_MAP__; let vis = null;
    try { vis = m.getStyle().layers.filter(l => (m.getLayoutProperty(l.id, 'visibility') || 'visible') === 'visible' && l.type !== 'background').map(l => l.id); } catch (e) { vis = 'err ' + e.message; }
    const lt = document.querySelector('[data-lightning-control="toggle"]');
    return { buttons: btns, visibleLayers: vis, lightningToggleChecked: lt ? lt.checked : null, lightningGroupVisible: !!(document.querySelector('[data-lightning-group]') && document.querySelector('[data-lightning-group]').getBoundingClientRect().height > 0), scrollY };
  });
  const shot = `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/fullscreen-rest/${key}.png`;
  await page.screenshot({ path: shot });
  out[key] = { ...st, lightningRequests: light.length, shot };
  await ctx.close();
}
await browser.close();
fs.writeFileSync('/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/fullscreen-rest/rest-state.json', JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, '| buttons:', v.buttons.map(b => `${b.text}${b.pressed ? '[' + b.pressed + ']' : ''}${b.active ? '*' : ''}`).join(', '), '| visible layers:', Array.isArray(v.visibleLayers) ? v.visibleLayers.length : v.visibleLayers, '| lightning checked:', v.lightningToggleChecked, '| lightning requests:', v.lightningRequests);
