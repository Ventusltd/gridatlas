// 00-dom-probe.mjs — visual-challenge-B. Confirms, from the live candidate DOM (not from source), which selector the
// lightning overlay owns, where the Grid-dropdown mirror lands, and the <style> inventory on both routes.
// Harness: lead-shim (offline-shim.mjs unmodified), Chromium headless, 1440x900. Read-only; writes only into this folder.
import fs from 'node:fs';
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const OUT = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/visual-challenge-B/parity/00-dom-probe.json';
const ROUTES = { baseline: 'http://127.0.0.1:8141/gridatlas/atlas/', candidate: 'http://127.0.0.1:8142/wt/atlas/v/202610261949/' };
const browser = await chromium.launch({ headless: true });
const result = { harness: 'lead-shim', chromium: browser.version(), viewport: '1440x900', routes: {} };
for (const [label, url] of Object.entries(ROUTES)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB', timezoneId: 'Europe/London', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const shim = await installOfflineShim(page, {});
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
  if (label === 'candidate') await page.waitForFunction(() => window.__GRIDATLAS_MODULES__?.ukLightning?.state?.installed === true, null, { timeout: 30000 }).catch(() => {});
  const probe = await page.evaluate(() => {
    const sig = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '') + [...el.attributes].filter(a => a.name.startsWith('data-lightning')).map(a => `[${a.name}="${a.value}"]`).join('');
    const bar = document.getElementById('gridatlas-menu-bar');
    const panels = [...bar.querySelectorAll('.gm-panel')].map(p => ({ id: p.id, class: p.className, hidden: p.hidden, hasBody: !!p.querySelector('.gm-panel-body'), children: [...p.children].map(sig) }));
    const firstBody = bar.querySelector('.gm-panel-body');
    const lightning = [...document.querySelectorAll('[data-lightning-group]')].map(g => ({ sig: sig(g), parent: sig(g.parentElement), indexInParent: [...g.parentElement.children].indexOf(g), siblings: g.parentElement.children.length,
      toggle: (() => { const t = g.querySelector('[data-lightning-control="toggle"]'); return t ? { tag: t.tagName, type: t.type, role: t.getAttribute('role'), ariaLabel: t.getAttribute('aria-label'), checked: t.checked, attrs: [...t.attributes].map(a => a.name + '=' + a.value) } : null; })(),
      otherNamespaced: [...g.querySelectorAll('[data-layer-id],[data-pn-layer],[data-gridatlas-layer-proxy],[data-gridatlas-layer-key],[name="bm"]')].length,
      inlineStyle: g.getAttribute('style') }));
    const styles = [...document.querySelectorAll('style')].map((s, i) => ({ i, id: s.id || null, attrs: [...s.attributes].map(a => a.name + '=' + a.value).join(' '), bytes: s.textContent.length, head40: s.textContent.replace(/\s+/g, ' ').slice(0, 60) }));
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href);
    const anyLightningStyle = styles.filter(s => /lightning/i.test(s.head40)).length;
    const groups = [...document.querySelectorAll('#scada-ui-container .key-group')].map(g => (g.querySelector('.key-title')?.textContent || '').trim());
    const curtainGroups = [...document.querySelectorAll('#fs-curtain-keys .key-group')].map(g => (g.querySelector('.key-title')?.textContent || '').trim());
    const m = window.__GRIDATLAS_MODULES__?.menuBar;
    return { generation: document.documentElement.dataset.gridatlasGeneration, panels, firstBodyPanel: firstBody ? firstBody.parentElement.id + ' ' + firstBody.parentElement.className : null, lightning, styles, links, anyLightningStyle,
      scadaGroups: groups, curtainGroups, menuInspect: m && typeof m.inspect === 'function' ? m.inspect() : null, proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length,
      lightningState: window.__GRIDATLAS_MODULES__?.ukLightning ? { installed: window.__GRIDATLAS_MODULES__.ukLightning.state.installed, on: window.__GRIDATLAS_MODULES__.ukLightning.state.on, requests: window.__GRIDATLAS_MODULES__.ukLightning.state.requests, waiting_for: window.__GRIDATLAS_MODULES__.ukLightning.state.waiting_for } : null,
      storage: { local: Object.keys(localStorage), session: Object.keys(sessionStorage) } };
  });
  result.routes[label] = { url, composition: comp, probe, shim: shim.summary() };
  await ctx.close();
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ baselineStyles: result.routes.baseline.probe.styles.length, candidateStyles: result.routes.candidate.probe.styles.length, lightning: result.routes.candidate.probe.lightning, firstBodyPanel: result.routes.candidate.probe.firstBodyPanel, panels: result.routes.candidate.probe.panels.map(p => p.id + ':' + p.hasBody), menu: result.routes.candidate.probe.menuInspect, scadaGroups: result.routes.candidate.probe.scadaGroups, lightningState: result.routes.candidate.probe.lightningState, lightningRequests: result.routes.candidate.shim.served['lightning-data'] || 0 }, null, 1));
