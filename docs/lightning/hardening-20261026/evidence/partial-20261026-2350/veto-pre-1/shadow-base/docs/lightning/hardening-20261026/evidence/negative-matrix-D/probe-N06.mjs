// probe-N06.mjs — re-check N06 d (invalid coords) and e (10 MB string) with a tile-loaded wait; harness lead-shim; 1440x900
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import * as L from './lib.mjs';
const srv = await L.startServer(); const browser = await chromium.launch();
const out = {};
for (const k of ['N06-d-nan-coords', 'N06-e-10mb-string', 'N06-c-out-of-box']) {
  const B = await L.boot({ browser, fixtureDir: `${L.FIX}/${k}/data`, clock: '2026-10-26T06:00:00Z' });
  await L.clickToggle(B.page, false); await L.clickChip(B.page, '48h'); await L.settle(B.page, 90000);
  const t0 = Date.now();
  const r = await B.page.evaluate(() => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__; const t0 = performance.now(); const tick = () => { let loaded = false; try { loaded = m.isSourceLoaded('gridatlas-lightning') && m.areTilesLoaded(); } catch (e) { } if (loaded || performance.now() - t0 > 25000) { const q = () => { try { return m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length } catch (e) { return 'err:' + e.message } }; res({ loaded, waitedMs: Math.round(performance.now() - t0), rendered: q(), sourceFeatures: m.getSource('gridatlas-lightning')._data.features.length, mapErrors: window.__NMD.mapErrors, label: document.querySelector('#scada-ui-container [data-lightning-label]').textContent, flashesLine: document.querySelector('#gridatlas-lightning-caption-main [data-cap="flashes"]').textContent }); } else setTimeout(tick, 250); }; tick(); }));
  // also pan/zoom to the UK box centre to be sure the viewport covers the genuine 118 points on the 24th
  const r2 = await B.page.evaluate(() => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__; m.jumpTo({ center: [-3.5, 55], zoom: 4.5 }); setTimeout(() => { let n; try { n = m.queryRenderedFeatures({ layers: ['l-gridatlas-lightning'] }).length } catch (e) { n = 'err:' + e.message } res({ renderedAfterJump: n, zoom: m.getZoom(), center: m.getCenter() }); }, 4000); }));
  out[k] = { ...r, ...r2, realMs: Date.now() - t0, pageErrors: B.rec.pageErrors, consoleErrors: B.rec.consoleErrors.filter(e => !/favicon|tile|cartocdn|403|ERR_/.test(e)).slice(0, 5) };
  await B.page.screenshot({ path: `shots/probe-${k}-after-jump.png` });
  console.log(k, JSON.stringify(out[k], null, 1));
  await B.ctx.close();
}
await browser.close(); srv.close();
import fs from 'node:fs'; fs.writeFileSync('results/probe-N06.json', JSON.stringify(out, null, 1));
