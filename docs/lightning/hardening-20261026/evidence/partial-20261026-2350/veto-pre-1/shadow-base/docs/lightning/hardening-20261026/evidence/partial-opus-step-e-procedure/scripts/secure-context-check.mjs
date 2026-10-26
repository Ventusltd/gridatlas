// Checks the owner-procedure rule "use localhost or HTTPS": the composer needs crypto.subtle (atlas/index.html:28,70).
// Harness: Chromium headless, NO shim (composer fails or proceeds before any off-origin request), SHA fda6b10, 393x852.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
const [ip, port] = [process.argv[2], process.argv[3]];
const browser = await chromium.launch();
for (const host of ['127.0.0.1', ip]) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  await page.route('**/*', r => { const u = new URL(r.request().url()); return (u.hostname === host) ? r.continue() : r.abort('blockedbyclient'); });
  const url = `http://${host}:${port}/wt/atlas/v/202610261949/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const s = await page.evaluate(() => ({ secure: window.isSecureContext, subtle: typeof (window.crypto && window.crypto.subtle), router: document.body && document.body.dataset.gridatlasRouter, loader: (document.getElementById('gridatlas-loader') || {}).innerText || '(loader replaced: composition proceeded)' }));
  console.log(new Date().toISOString(), url, JSON.stringify(s));
  await page.close();
}
await browser.close();
