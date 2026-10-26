import { webkit, chromium } from 'playwright';

const URL = 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=20388&project=Berden+Hall+Solar+Farm&technology=solar&capacity_mw=56&latitude=51.9369457&longitude=0.1309736&zoom=12';

async function run(engine, name) {
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: name === 'webkit',
    hasTouch: name === 'webkit',
  });
  const page = await ctx.newPage();
  const errors = [], logs = [], failed = [];
  page.on('pageerror', e => errors.push(String(e && e.stack || e).slice(0, 400)));
  page.on('console', m => { if (/error|fail|warn/i.test(m.type() + m.text())) logs.push(m.type() + ': ' + m.text().slice(0, 220)); });
  page.on('requestfailed', r => failed.push(r.url().slice(0, 120) + ' :: ' + (r.failure()?.errorText || '')));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 }).catch(e => errors.push('goto: ' + e.message));
  await page.waitForTimeout(20000);

  const state = await page.evaluate(() => {
    const L = window.__GRIDATLAS_NEON_LINKS__;
    const m = window.__GRIDATLAS_V9_MAP__;
    const ans = [...document.querySelectorAll('body *')]
      .find(e => e.children.length < 6 && /Nearest .* substation/.test(e.innerText || ''));
    return {
      mapGlobal: !!m,
      centre: m ? [+m.getCenter().lng.toFixed(3), +m.getCenter().lat.toFixed(3)] : null,
      zoom: m ? +m.getZoom().toFixed(2) : null,
      styleLayers: m ? m.getStyle().layers.length : null,
      neon: L ? { drawn: L.links_drawn, fail: L.failures, proj: L.project_layer_enabled } : null,
      card: !!ans,
      checkboxes: document.querySelectorAll('#scada-ui-container input[type=checkbox]').length,
      bodyStart: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
    };
  }).catch(e => ({ evalError: e.message }));

  await browser.close();
  return { engine: name, state, pageErrors: errors.slice(0, 6), consoleErrors: logs.slice(0, 10), requestFailures: failed.slice(0, 8) };
}

const wk = await run(webkit, 'webkit');
console.log('================ WEBKIT (iOS Safari engine) ================');
console.log(JSON.stringify(wk, null, 1));
const ch = await run(chromium, 'chromium');
console.log('================ CHROMIUM (control) ================');
console.log(JSON.stringify(ch, null, 1));
