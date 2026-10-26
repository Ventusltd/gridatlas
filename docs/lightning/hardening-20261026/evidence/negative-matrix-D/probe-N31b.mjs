// probe-N31b.mjs — N31 re-run with a bounded style-reload wait. matrix.mjs N31 hung: m.once('style.load') never fired after
// map.setStyle(map.getStyle()) (MapLibre diffs an identical style; no style.load), and page.evaluate had no timeout.
// Harness: lead-shim, 1440x900, genuine lightning-archive fixture, clock 2026-10-26T18:40Z. Basemap tiles BLOCKED_DEPENDENCY.
import fs from 'node:fs';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import * as L from './lib.mjs';
const srv = await L.startServer(); const browser = await chromium.launch(); const out = { harness: 'lead-shim 1440x900', steps: [] };
const state = page => page.evaluate(() => { const m = window.__GRIDATLAS_V9_MAP__; let feats = null; try { feats = m.getSource('gridatlas-lightning')?._data?.features?.length ?? null } catch { } return { layer: !!m.getLayer('l-gridatlas-lightning'), source: !!m.getSource('gridatlas-lightning'), feats, vis: m.getLayer('l-gridatlas-lightning') ? m.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null, label: document.querySelector('#scada-ui-container [data-lightning-label]').textContent, stateLine: document.querySelector('#scada-ui-container [data-lightning-state]')?.textContent || null, styleLayers: m.getStyle().layers.length }; });
const B = await L.boot({ browser, fixtureDir: L.realDir('lightning-archive'), clock: '2026-10-26T18:40:00Z' });
const step = async (s, extra = {}) => { const r = { step: s, ...(await state(B.page)), ...extra }; out.steps.push(r); console.log(JSON.stringify(r)); };
await L.clickToggle(B.page, false); await L.clickChip(B.page, '7d'); await L.settle(B.page); await step('ON 7d');
for (const v of ['sat', 'dark']) { const el = B.page.locator(`#scada-ui-container input[name="bm"][value="${v}"]`); const n = await el.count(); if (n) { await el.click({ timeout: 10000 }).catch(e => out.steps.push({ step: 'click ' + v + ' failed', err: String(e).slice(0, 200) })); await B.page.waitForTimeout(2500); } await step(`real basemap radio → ${v}`, { radioFound: n }); }
const evs = await B.page.evaluate(() => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__; const ev = []; for (const k of ['style.load', 'styledata', 'idle']) m.on(k, () => ev.push(k)); const st = m.getStyle(); st.layers = st.layers.filter(l => l.id !== 'l-gridatlas-lightning'); delete st.sources['gridatlas-lightning']; m.setStyle(st, { diff: false }); setTimeout(() => res([...new Set(ev)]), 6000); }));
await step('SYNTHETIC PROBE (not a user gesture): full style replacement without the lightning layer, setStyle(..., {diff:false}), +6 s', { events: evs });
await L.clickChip(B.page, '7d'); await L.settle(B.page); await B.page.waitForTimeout(1500); await step('real click 7d after style replacement → layer re-added?');
await B.page.screenshot({ path: 'shots/probe-N31b-after-style.png' });
out.pageErrors = B.rec.pageErrors; fs.writeFileSync('results/probe-N31b.json', JSON.stringify(out, null, 1));
await browser.close(); srv.close();
