#!/usr/bin/env node
// a11y-extra.mjs <WxH> <fixtureVariant> — candidate only: date-input names (CUSTOM), menu-row AX node, label contrast in the
// resulting state, map repaint loop with points drawn under reduced motion. lead-shim, Chromium headless, real keyboard.
import fs from 'node:fs';
import { boot, OUT } from './common.mjs';
const [vp = '1440x900', variant = 'lightning-archive'] = process.argv.slice(2);
const [vw, vh] = vp.split('x').map(Number);
const data = `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/${variant}/data`;
const { browser, page, errors } = await boot('candidate', { vw, vh, reducedMotion: 'reduce', data });
const R = { harness: 'lead-shim chromium headless', viewport: vp, reducedMotion: 'reduce', fixture: variant };
const cdp = await page.context().newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('Accessibility.enable');
const axOf = async sel => { const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true }); const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel }); const o = [];
  for (const id of nodeIds) { const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId: id, fetchRelatives: false }); const n = nodes[0]; o.push({ sel, ignored: n.ignored, role: n.role && n.role.value, name: n.name && n.name.value, props: Object.fromEntries((n.properties || []).map(p => [p.name, p.value && p.value.value])) }); } return o; };
const done = () => page.waitForFunction(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning.state; return S.last && !document.querySelector('#scada-ui-container [data-lightning-dot]').parentElement.textContent.includes('LOADING'); }, null, { timeout: 25000 }).catch(() => {});
await page.locator('#scada-ui-container [data-lightning-control="toggle"]').focus(); await page.keyboard.press('Space'); await done();
// 7D via keyboard
await page.locator('#scada-ui-container [data-lightning-period="7d"]').focus(); await page.keyboard.press('Enter'); await done(); await page.waitForTimeout(1500);
R.state7d = await page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last);
R.label = await page.evaluate(() => { const l = document.querySelector('#scada-ui-container [data-lightning-label]'); const c = getComputedStyle(l); return { text: l.textContent, color: c.color, opacity: c.opacity }; });
R.toggleAx = await axOf('#scada-ui-container [data-lightning-control="toggle"]');
// map repaint loop: count render events over 10 s idle with the layer visible
R.render = await page.evaluate(() => new Promise(res => { const m = window.__GRIDATLAS_V9_MAP__; let n = 0; const f = () => n++; m.on('render', f);
  setTimeout(() => { m.off('render', f); res({ renders10s: n, layerVis: m.getLayer('l-gridatlas-lightning') ? m.getLayoutProperty('l-gridatlas-lightning', 'visibility') : null, features: (m.querySourceFeatures('gridatlas-lightning') || []).length }); }, 10000); }));
// CUSTOM: date inputs and APPLY names
await page.locator('#scada-ui-container [data-lightning-period="custom"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
R.customAx = [...await axOf('#scada-ui-container [data-lightning-date]'), ...await axOf('#scada-ui-container [data-lightning-nav="apply"]')];
// invalid custom range via keyboard: type From > To, APPLY; is the error announced (live region) and are inputs marked invalid?
await page.evaluate(() => { window.__mut = []; new MutationObserver(ms => window.__mut.push(ms.length)).observe(document.querySelector('#scada-ui-container [data-lightning-caption]'), { subtree: true, childList: true, characterData: true }); });
const from = page.locator('#scada-ui-container [data-lightning-date="from"]'); await from.fill('2026-10-20'); // fill (labelled): headless date-field segment order is locale-dependent
const to = page.locator('#scada-ui-container [data-lightning-date="to"]'); await to.fill('2026-10-10');
await page.locator('#scada-ui-container [data-lightning-nav="apply"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
R.invalidApply = { values: await page.evaluate(() => [...document.querySelectorAll('#scada-ui-container [data-lightning-date]')].map(i => i.value)), warning: await page.evaluate(() => document.querySelector('#scada-ui-container [data-cap="warning"]').textContent), captionMutations: await page.evaluate(() => window.__mut.length), dateAx: await axOf('#scada-ui-container [data-lightning-date]') };
// menu row AX with Grid open (keyboard)
await page.locator('#gridatlas-menu-bar-title-4').focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
R.menuRowAx = await axOf('#gridatlas-menu-bar [data-lightning-control="toggle"]');
R.menuOriginalAx = (await axOf('#gridatlas-menu-bar input[data-gridatlas-layer-proxy="engine:400"]'));
R.menuAria = await page.locator('#gridatlas-menu-bar [data-lightning-group="menu"]').ariaSnapshot().catch(e => 'ERR ' + e.message);
// touch target sizes of lightning controls (phone)
R.targets = await page.evaluate(() => [...document.querySelectorAll('#scada-ui-container [data-lightning-group] button:not([hidden]), #scada-ui-container [data-lightning-control]')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [b.dataset.lightningPeriod || b.dataset.lightningNav || 'toggle', Math.round(r.width), Math.round(r.height)]; }));
R.errors = errors;
const f = `${OUT}/a11y-extra-${vp}-${variant}.json`; fs.writeFileSync(f, JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1));
await browser.close();
