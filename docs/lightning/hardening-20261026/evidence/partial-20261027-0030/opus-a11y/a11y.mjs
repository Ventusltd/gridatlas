#!/usr/bin/env node
// a11y.mjs <route> <WxH> <reduce|no-preference> [fixtureVariant] — P15 semantics (CDP AX tree), contrast, motion/sound, live-region churn.
// lead-shim, Chromium headless. Lightning switched ON with a real keyboard Space on the Layers-panel toggle.
import fs from 'node:fs';
import { boot, OUT } from './common.mjs';
const [route = 'candidate', vp = '1440x900', rm = 'reduce', variant = 'lightning-archive', idleMs = '30000'] = process.argv.slice(2);
const [vw, vh] = vp.split('x').map(Number);
const data = `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/${variant}/data`;
// sound + motion probes installed before any page script
const initScript = () => {
  window.__A11Y = { audioCtx: 0, play: 0, media: 0, vibrate: 0, speech: 0, live: [] };
  const AC = window.AudioContext; if (AC) window.AudioContext = function (...a) { window.__A11Y.audioCtx++; return new AC(...a); };
  const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__A11Y.play++; return p.call(this); };
  if (navigator.vibrate) navigator.vibrate = () => { window.__A11Y.vibrate++; return true; };
  if (window.speechSynthesis) { const s = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__A11Y.speech++; return s(u); }; }
};
const { browser, page, errors } = await boot(route, { vw, vh, reducedMotion: rm, data, initScript });
const R = { harness: 'lead-shim chromium headless', route, viewport: vp, reducedMotion: rm, fixture: variant + ' (synthetic/fixture)', errors };
const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable'); await cdp.send('Accessibility.enable');
async function ax(selector) {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
  const out = [];
  for (const nodeId of nodeIds) {
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const n = nodes.find(x => !x.ignored) || nodes[0];
    const { node } = await cdp.send('DOM.describeNode', { nodeId });
    const attrs = {}; for (let i = 0; i < (node.attributes || []).length; i += 2) attrs[node.attributes[i]] = node.attributes[i + 1];
    out.push({ selector, tag: node.localName, dataKeys: Object.keys(attrs).filter(k => k.startsWith('data-') || k.startsWith('aria') || k === 'role').map(k => k + '=' + attrs[k]).join(' '),
      ignored: !!n.ignored, ignoredReasons: (n.ignoredReasons || []).map(r => r.name).join(','), role: n.role && n.role.value, name: n.name && n.name.value,
      props: Object.fromEntries((n.properties || []).map(p => [p.name, p.value && p.value.value])) });
  }
  return out;
}
const SEL = ['[data-lightning-control="toggle"]', '[data-lightning-period]', '[data-lightning-nav]', '[data-lightning-date]', '[data-lightning-caption]', '[data-lightning-controls] > [role="group"]', '[data-lightning-dot]', '[data-lightning-group] .key-title', '[data-lightning-group] .gm-layer-group'];
const axAll = async () => { const a = []; for (const s of SEL) a.push(...await ax(s)); return a; };
const tg = page.locator('#scada-ui-container [data-lightning-control="toggle"]');
if (route !== 'baseline') {
  R.axOff = await axAll();
  await tg.focus(); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  R.stateOn = await page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last);
  R.axOn = await axAll();
  R.ariaSnapshotMain = await page.locator('#scada-ui-container [data-lightning-group="main"]').ariaSnapshot().catch(e => 'ERR ' + e.message);
  R.ariaSnapshotMenu = await page.locator('#gridatlas-menu-bar [data-lightning-group="menu"]').ariaSnapshot().catch(e => 'ERR ' + e.message);
  R.curtain = await page.evaluate(() => { const c = document.getElementById('fs-curtain'); if (!c) return null; const cs = getComputedStyle(c); const r = c.getBoundingClientRect(); return { display: cs.display, visibility: cs.visibility, ariaHidden: c.getAttribute('aria-hidden'), inert: c.inert, rect: [r.x, r.y, r.width, r.height] }; });
}
if (route !== 'baseline' && process.env.PERIOD) { await page.locator(`#scada-ui-container [data-lightning-period="${process.env.PERIOD}"]`).focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(4000); R.statePeriod = await page.evaluate(() => window.__GRIDATLAS_MODULES__.ukLightning.state.last); }
if (process.env.OPENMENU) { await page.locator('#gridatlas-menu-bar-title-4').focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400); }
// contrast: every visible text node, lightning-owned vs original panel reference
R.contrast = await page.evaluate(() => {
  const parse = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const Lu = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const CANVAS = { r: 11, g: 14, b: 20 }; // shim MINIMAL_STYLE background #0b0e14 (the map under translucent panels; real basemap BLOCKED_DEPENDENCY)
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rows = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    const s = t.textContent.replace(/\s+/g, ' ').trim(); if (!s) continue; const e = t.parentElement; if (!e) continue;
    const inScada = e.closest('#scada-ui-container'), inMenu = e.closest('#gridatlas-menu-bar .gm-menu.gm-open, #gridatlas-menu-bar [data-lightning-group]');
    if (!inScada && !inMenu) continue; const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e); if (cs.visibility !== 'visible') continue;
    let bg = CANVAS; const chain = []; let op = 1; for (let a = e; a; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c.a > 0) chain.push(c); op *= Number(getComputedStyle(a).opacity); }
    for (const c of chain.reverse()) bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) };
    let fg = parse(cs.color); const fa = fg.a * op; fg = { r: fg.r * fa + bg.r * (1 - fa), g: fg.g * fa + bg.g * (1 - fa), b: fg.b * fa + bg.b * (1 - fa) };
    const l1 = Lu(fg), l2 = Lu(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700; const large = px >= 24 || (bold && px >= 18.66);
    const ctl = e.closest('button,input'); const disabled = !!(ctl && ctl.disabled);
    rows.push({ owner: e.closest('[data-lightning-group]') ? 'lightning' : 'original', where: inScada ? 'scada' : 'menu', text: s.slice(0, 50), sel: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + [...e.attributes].filter(a => /^data-(cap|lightning-[a-z]+)$/.test(a.name)).map(a => `[${a.name}=${a.value}]`).join(''),
      fg: hex(fg), bg: hex(bg), opacity: op, fontPx: px, bold, ratio: Math.round(ratio * 100) / 100, need: large ? 3 : 4.5, pass: ratio >= (large ? 3 : 4.5), disabled });
  }
  return rows;
});
// dot (non-text, 1.4.11 informative graphic) contrast
R.dot = await page.evaluate(() => { const d = document.querySelector('#scada-ui-container [data-lightning-dot]'); return d ? { bg: getComputedStyle(d).backgroundColor, w: d.getBoundingClientRect().width } : null; });
// motion: animations and transitions on lightning nodes, and map paint transition for the lightning layer
R.motion = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('[data-lightning-group], [data-lightning-group] *')];
  const tr = nodes.map(n => { const c = getComputedStyle(n); return { n: n.tagName.toLowerCase() + '.' + (n.className || ''), td: c.transitionDuration, tp: c.transitionProperty, an: c.animationName, ad: c.animationDuration }; }).filter(x => x.an !== 'none' || x.td.split(',').some(v => parseFloat(v) > 0));
  const anims = document.getAnimations().map(a => ({ id: a.id, target: a.effect && a.effect.target ? a.effect.target.tagName + '.' + a.effect.target.className : null, lightning: !!(a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('[data-lightning-group]')), state: a.playState }));
  const m = window.__GRIDATLAS_V9_MAP__; let layer = null;
  try { const L = m.getLayer('l-gridatlas-lightning'); layer = L ? { vis: m.getLayoutProperty('l-gridatlas-lightning', 'visibility'), transition: m.style && m.style.stylesheet ? m.style.stylesheet.transition : null, paint: m.getStyle().layers.find(l => l.id === 'l-gridatlas-lightning').paint } : null; } catch (e) { layer = 'ERR ' + e.message; }
  return { nodesWithTransitionOrAnimation: tr, documentAnimations: anims, layer, mediaEls: document.querySelectorAll('audio,video').length };
});
// live-region churn: observe both captions for an idle period, sampling the state the AT would see
await page.evaluate(() => {
  window.__A11Y.live = []; const t0 = performance.now();
  for (const c of document.querySelectorAll('[data-lightning-caption]')) new MutationObserver(ms => { const txt = [...new Set(ms.map(m => (m.target.nodeType === 3 ? m.target.parentElement : m.target).dataset.cap || m.type))]; window.__A11Y.live.push({ t: Math.round(performance.now() - t0), cap: c.id, changed: txt }); }).observe(c, { subtree: true, childList: true, characterData: true, attributes: false });
  window.__A11Y.lab = 0; for (const l of document.querySelectorAll('[data-lightning-label],[data-lightning-dot]')) new MutationObserver(() => window.__A11Y.lab++).observe(l, { subtree: true, childList: true, characterData: true, attributes: true });
});
await page.waitForTimeout(Number(idleMs));
R.idle = await page.evaluate(ms => ({ ms, liveMutations: window.__A11Y.live, labelOrDotMutations: window.__A11Y.lab, sound: { audioCtx: window.__A11Y.audioCtx, play: window.__A11Y.play, vibrate: window.__A11Y.vibrate, speech: window.__A11Y.speech } }), Number(idleMs));
// churn during one user action: a chip change, observed 5 s
if (route !== 'baseline') {
  await page.evaluate(() => { window.__A11Y.live = []; });
  await page.locator('#scada-ui-container [data-lightning-period="48h"]').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(5000);
  R.chipChurn = await page.evaluate(() => window.__A11Y.live);
}
R.errors = errors;
const f = `${OUT}/a11y-${route}-${vp}-${rm}-${variant}${process.env.TAG ? '-' + process.env.TAG : ''}.json`; fs.writeFileSync(f, JSON.stringify(R, null, 1)); console.log(f);
await browser.close();
