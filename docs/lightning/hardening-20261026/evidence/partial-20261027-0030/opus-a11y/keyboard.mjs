#!/usr/bin/env node
// keyboard.mjs <route> <WxH> — P07 real-key behaviour (page.keyboard only for activation). lead-shim, Chromium headless.
import fs from 'node:fs';
import { boot, ACTIVE, OUT } from './common.mjs';
const [route = 'baseline', vp = '1440x900'] = process.argv.slice(2);
const [vw, vh] = vp.split('x').map(Number);
const { browser, page, errors } = await boot(route, { vw, vh });
const L = []; const log = (step, extra = {}) => L.push({ step, ...extra });
const act = () => page.evaluate(ACTIVE);
const st = () => page.evaluate(() => { const S = window.__GRIDATLAS_MODULES__.ukLightning?.state; const open = [...document.querySelectorAll('.gm-menu.gm-open .gm-title')].map(t => t.textContent);
  return { open, lightningOn: S ? S.on : null, period: S ? S.period : null, last: S && S.last ? S.last.state : null }; });
// menu-row focus indicator: the input may be visually hidden; record the label/box styles while focused
const menuRing = () => page.evaluate(() => { const e = document.activeElement; if (!e || !e.closest('.gm-layer')) return null; const lab = e.closest('.gm-layer'), box = lab.querySelector('.gm-layer-box');
  const s = n => { const c = getComputedStyle(n); return { outline: c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineColor, boxShadow: c.boxShadow, bg: c.backgroundColor, border: c.borderColor, opacity: c.opacity, w: n.getBoundingClientRect().width }; };
  return { input: s(e), label: s(lab), box: box ? s(box) : null }; });
const tabTo = async (pred, max = 200) => { for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const a = await act(); if (pred(a)) return a; } return null; };
await page.evaluate(() => document.activeElement && document.activeElement.blur());

// A. Grid menu: Tab to Grid title, ArrowDown
const g = await tabTo(a => a.name === 'Grid' && a.surf === 'menubar');
log('tab to Grid title', { active: g && g.key });
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
const first = await act(); log('ArrowDown on Grid -> first focused', { active: first.key, attrs: first.attrs, state: await st(), ring: await menuRing() });
// B. Tab through the open Grid panel until focus leaves it
const inMenu = []; for (let i = 0; i < 200; i++) { await page.keyboard.press('Tab'); const a = await act(); const s = await st(); inMenu.push({ key: a.key, lightning: a.lightning, open: s.open.join(','), inViewport: a.inViewport, rect: a.rect }); if (a.surf !== 'menubar' || !s.open.length) break; }
log('Tab through open Grid panel', { count: inMenu.length, last5: inMenu.slice(-5), lightningRows: inMenu.filter(x => x.lightning) });
fs.writeFileSync(`${OUT}/grid-menu-tab-${route}-${vp}.json`, JSON.stringify(inMenu, null, 1));
// C. Escape from engine 400 restores focus to Grid title
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
await page.evaluate(() => document.getElementById('gridatlas-menu-bar-title-4').focus());
await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
log('ArrowDown again', { active: (await act()).key });
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
log('Escape from first item', { active: (await act()).key, state: await st() });
// D. candidate: lightning row in the Grid menu via keyboard
if (route !== 'baseline') {
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  const row = await tabTo(a => a.lightning || a.surf !== 'menubar', 200);
  log('Tab to lightning menu row', { active: row && row.key, attrs: row && row.attrs, inViewport: row && row.inViewport, rect: row && row.rect, ring: await menuRing(), state: await st() });
  await page.keyboard.press('Space'); await page.waitForTimeout(1500);
  log('Space on menu row', { active: (await act()).key, state: await st() });
  await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  log('Enter on menu row', { active: (await act()).key, state: await st() });
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  log('Space on menu row again', { active: (await act()).key, state: await st() });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  log('Escape from menu row', { active: (await act()).key, state: await st() });
}
// E. Layers panel: original checkbox 400 Enter/Space (parity reference)
await page.evaluate(() => document.activeElement && document.activeElement.blur());
const c400 = await tabTo(a => a.key.startsWith('input||400|') && a.surf === 'scada');
const v0 = await page.evaluate(() => document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked);
await page.keyboard.press('Enter'); await page.waitForTimeout(200);
const v1 = await page.evaluate(() => document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked);
await page.keyboard.press('Space'); await page.waitForTimeout(300);
const v2 = await page.evaluate(() => document.querySelector('#scada-ui-container input[data-layer-id="400"]').checked);
await page.keyboard.press('Space'); await page.waitForTimeout(300);
log('original 400 checkbox', { found: !!c400, before: v0, afterEnter: v1, afterSpace: v2 });
if (route !== 'baseline') {
  const t = await tabTo(a => a.lightning && a.surf === 'scada');
  log('Tab to panel lightning toggle', { active: t && t.key, outline: t && t.outline, fv: t && t.focusVisible });
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); log('Enter on toggle', { state: await st() });
  await page.keyboard.press('Space'); await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last, null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(500);
  log('Space on toggle', { state: await st(), active: (await act()).key });
  await page.keyboard.press('Shift+Tab'); log('Shift+Tab from toggle', { active: (await act()).key }); await page.keyboard.press('Tab');
  await page.keyboard.press('Tab'); const c12 = await act(); log('Tab -> first chip', { active: c12.key, outline: c12.outline, fv: c12.focusVisible, border: c12.border });
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); const c48 = await act();
  await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
  log('Enter on chip', { chip: c48.key, active: (await act()).key, state: await st(), aria: await page.evaluate(() => document.activeElement.getAttribute('aria-pressed')), cls: await page.evaluate(() => document.activeElement.className) });
  await page.keyboard.press('Tab'); const c7 = await act(); await page.keyboard.press('Space'); await page.waitForTimeout(1500);
  log('Space on chip', { chip: c7.key, active: (await act()).key, state: await st() });
  await page.keyboard.press('Shift+Tab'); log('Shift+Tab from chip', { active: (await act()).key });
  // PREV: activation sets loading -> prev.disabled=true while it has focus
  const prev = await tabTo(a => a.key.includes('|prev|'), 20);
  await page.keyboard.press('Enter');
  const during = await act(); await page.waitForTimeout(2000); const after = await act();
  log('Enter on PREV', { found: !!prev, activeImmediately: during.key || 'BODY', activeAfter2s: after.key || 'BODY', state: await st() });
  await page.keyboard.press('Tab'); log('next Tab after PREV', { active: (await act()).key || 'BODY' });
  // Arrow keys inside the chip row (no roving tabindex expected; record behaviour)
  const chip = await page.$('#scada-ui-container [data-lightning-period="24h"]'); await chip.focus();
  await page.keyboard.press('ArrowRight'); log('ArrowRight on chip', { active: (await act()).key });
  // CUSTOM: date inputs keyboard
  await page.evaluate(() => document.querySelector('#scada-ui-container [data-lightning-period="24h"]').focus());
  const cu = await tabTo(a => a.key.includes('|custom|'), 20); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await page.keyboard.press('Tab'); const fromIn = await act(); log('Tab after CUSTOM', { active: fromIn.key, outline: fromIn.outline, border: fromIn.border, fv: fromIn.focusVisible });
  // Escape in panel: nothing to close; record
  await page.keyboard.press('Escape'); log('Escape in panel', { active: (await act()).key, state: await st() });
  // toggle OFF while focus is on a chip (via the menu row) -> where does focus go?
  await page.evaluate(() => document.querySelector('#scada-ui-container [data-lightning-period="24h"]').focus());
  await page.evaluate(() => { const m = document.querySelector('#gridatlas-menu-bar [data-lightning-control="toggle"]') || document.querySelector('#fs-curtain-keys [data-lightning-control="toggle"]'); m.click(); }); // programmatic, labelled: only to switch OFF while a chip holds focus
  await page.waitForTimeout(300);
  log('OFF while chip focused (programmatic menu click, labelled)', { active: (await act()).key || 'BODY', state: await st() });
}
fs.writeFileSync(`${OUT}/keyboard-${route}-${vp}.json`, JSON.stringify({ harness: 'lead-shim chromium headless', route, viewport: vp, errors, log: L }, null, 1));
console.log(JSON.stringify(L, null, 1).slice(0, 12000));
await browser.close();
