// probe-N35b.mjs — corrective re-probe for N35 (owner-device case N-OD3). Harness: lead-shim, Chromium iPhone-12 emulation
// (NOT WebKit), viewports 393x852 and 360x740. N35's panelProbe matched a non-button text node as "HIDE LAYERS" (0x0 static
// rect), so its coveredByHide=false values are void. This probe uses #gridatlas-dash-toggle (the sld-sandbox fixed button
// whose text is "▾ HIDE LAYERS" when the panel is open) and samples elementFromPoint on a 4 px grid over every text leaf of
// (a) the last panel group on the BASELINE route (production c08f3a6, /gridatlas/atlas/ served from /home/claude on :8146)
// and (b) the candidate lightning caption lines at 7d ON (route :8145). Real tap opens Layers; the panel is scrolled to its end
// by real wheel gestures. Read-only; writes results/probe-N35b.json and shots/probe-N35b-*.png.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium, devices } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import * as L from './lib.mjs';
const BROOT = '/home/claude', BPORT = 8146;
const bsrv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(BROOT, p); if (!f.startsWith(BROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); } res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm' })[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => bsrv.listen(BPORT, '0.0.0.0', r)); const srv = await L.startServer();
const browser = await chromium.launch(); const out = { harness: 'lead-shim; Chromium iPhone 12 emulation (not WebKit)', candidate: 'fda6b10 gen 202610261949', baseline: 'production /home/claude/gridatlas (c08f3a6 gen 202609241334)', runs: [] };
const probe = (which) => {
  const btn = document.getElementById('gridatlas-dash-toggle'); const br = btn.getBoundingClientRect(); const cs = getComputedStyle(btn);
  const host = document.getElementById('scada-ui-container');
  let leaves;
  if (which === 'caption') leaves = [...document.querySelectorAll('#gridatlas-lightning-caption-main [data-cap]')].filter(n => n.textContent);
  else { const g = [...document.querySelectorAll('#scada-ui-container .key-group')].filter(g => !g.dataset.lightningGroup).at(-1); leaves = [...g.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim()); }
  const res = leaves.map(n => { const r = n.getBoundingClientRect(); let tot = 0, cov = 0, other = 0; for (let y = r.top + 2; y < r.bottom - 1; y += 4) for (let x = r.left + 2; x < r.right - 1; x += 4) { if (y < 0 || y >= innerHeight || x < 0 || x >= innerWidth) continue; tot++; const e = document.elementFromPoint(x, y); if (e === btn || btn.contains(e)) cov++; else if (!(e === n || n.contains(e))) other++; } return { key: n.dataset?.cap || n.textContent.trim().slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), samples: tot, coveredByHideBtn: cov, coveredPct: tot ? Math.round(100 * cov / tot) : null, otherOccluder: other }; });
  return { button: { text: btn.textContent.trim(), position: cs.position, zIndex: cs.zIndex, rect: { top: Math.round(br.top), bottom: Math.round(br.bottom), left: Math.round(br.left), right: Math.round(br.right) } }, host: { scrollTop: Math.round(host.scrollTop), maxScroll: host.scrollHeight - host.clientHeight, bottom: Math.round(host.getBoundingClientRect().bottom) }, leaves: res, anyCovered: res.some(x => x.coveredByHideBtn > 0) };
};
for (const [w, h] of [[393, 852], [360, 740]]) for (const route of ['baseline', 'candidate']) {
  const ctx = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/London' });
  const page = await ctx.newPage(); await page.clock.install({ time: '2026-10-26T18:40:00Z' });
  await installOfflineShim(page, { lightningDataDir: L.realDir('lightning-archive') });
  await page.goto(route === 'baseline' ? `http://127.0.0.1:${BPORT}/gridatlas/atlas/` : L.ROUTE(), { waitUntil: 'domcontentloaded' });
  await waitForComposition(page, { deadlineMs: 90000, settleMs: 1500 });
  const tog = page.locator('#gridatlas-dash-toggle'); const tb = await tog.boundingBox(); await page.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2); await page.waitForTimeout(600);
  const scrollEnd = async () => { const hb = await page.locator('#scada-ui-container').boundingBox(); await page.mouse.move(hb.x + hb.width / 2, hb.y + 40); for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 400); await page.waitForTimeout(600); };
  await scrollEnd(); const r = { viewport: `${w}x${h}`, route, lastGroupOFF: await page.evaluate(probe, 'group') };
  await page.screenshot({ path: `shots/probe-N35b-${route}-${w}x${h}-OFF-end.png` });
  if (route === 'candidate') { await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true); await L.clickToggle(page, false); await L.clickChip(page, '7d'); await L.settle(page); await scrollEnd(); r.captionON7d = await page.evaluate(probe, 'caption'); await page.screenshot({ path: `shots/probe-N35b-candidate-${w}x${h}-ON7d-end.png` }); }
  out.runs.push(r); console.log(JSON.stringify(r, null, 0).slice(0, 3000)); await ctx.close();
}
fs.writeFileSync('results/probe-N35b.json', JSON.stringify(out, null, 1)); await browser.close(); srv.close(); bsrv.close();
