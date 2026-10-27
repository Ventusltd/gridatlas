#!/usr/bin/env node
// curtain-tab.mjs <route> — P07 Tab order inside the fullscreen curtain (#fs-curtain-keys). Real clicks open View>fullscreen and the
// curtain tab (as in regression-challenge-C/curtain-probe.mjs); then real Tab presses. lead-shim, Chromium headless, 1440x900.
import fs from 'node:fs';
import { boot, ACTIVE, OUT } from './common.mjs';
const [route = 'baseline'] = process.argv.slice(2);
const { browser, page, errors } = await boot(route, {});
const R = { harness: 'lead-shim chromium headless', route, viewport: '1440x900', steps: [] };
await page.getByRole('button', { name: 'View', exact: true }).click(); await page.waitForTimeout(200);
await page.locator('#btn-fullscreen').click(); await page.waitForFunction(() => !!document.fullscreenElement, null, { timeout: 8000 }).catch(e => R.steps.push('fullscreen: ' + e.message)); await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Grid', exact: true }).click(); await page.waitForTimeout(250);
await page.locator('#fs-curtain-tab').click(); await page.waitForTimeout(600);
await page.keyboard.press('Escape'); await page.waitForTimeout(300); // close the Grid menu, focus returns to Grid title
R.curtainClass = await page.evaluate(() => document.getElementById('fs-curtain').className);
R.diag = await page.evaluate(() => { const i = document.querySelector('#fs-curtain-keys input[data-layer-id="400"]'); const c = getComputedStyle(i); const r = i.getBoundingClientRect(); i.focus(); return { fs: document.fullscreenElement && document.fullscreenElement.id, inFs: !!(document.fullscreenElement && document.fullscreenElement.contains(i)), disp: c.display, vis: c.visibility, rect: [r.x, r.y, r.width, r.height], tabIndex: i.tabIndex, active: document.activeElement === i, curtainVis: getComputedStyle(document.getElementById('fs-curtain')).visibility, curtainDisp: getComputedStyle(document.getElementById('fs-curtain')).display }; });
const seq = []; for (let i = 0; i < 120; i++) { const a = await page.evaluate(ACTIVE); seq.push({ key: a.key, lightning: a.lightning, inViewport: a.inViewport, outline: a.outline }); if (a.surf !== 'curtain') break; await page.keyboard.press('Tab'); }
R.seq = seq; R.errors = errors;
fs.writeFileSync(`${OUT}/curtain-tab-${route}.json`, JSON.stringify(R, null, 1));
console.log(route, R.curtainClass, seq.length, seq.slice(-4).map(x => x.key + ' ' + x.inViewport).join(' / '));
await browser.close();
