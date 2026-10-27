// release-rehearsal | harness: lead-shim (offline-shim.mjs, Chromium headless) | viewport 1440x900 desktop
// Usage: node boot-probe.mjs <label> <url> <expectedGeneration> [<url> <gen> ...]
// Boots each atlas/ route, never touches lightning, records generation, digests and the 60+3 invariant while OFF.
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import fs from 'node:fs';
const [label, ...pairs] = process.argv.slice(2);
const EXPECT = { engine: 60, pipeline: 3, total: 63, unique: 63, complete: true };
const out = []; let allOk = true;
const browser = await chromium.launch();
for (let i = 0; i < pairs.length; i += 2) {
  const url = pairs[i], gen = pairs[i + 1];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [], lightning = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 200)));
  page.on('request', r => { if (r.url().includes('raw.githubusercontent.com/Ventusltd/lightning')) lightning.push(r.url()); });
  const shim = await installOfflineShim(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const comp = await waitForComposition(page, { deadlineMs: 90000, settleMs: 3000 });
  const v = await page.evaluate(() => {
    const M = window.__GRIDATLAS_MODULES__ && window.__GRIDATLAS_MODULES__.menuBar;
    const A = window.__GRIDATLAS_ATLAS__ || {};
    const lc = (A.loaded_cartridges || []).map(c => ({ id: c.id, generation: c.generation, sha256: c.sha256 }));
    const groups = [...document.querySelectorAll('.key-group')].map(g => (g.querySelector('h3,h4,.key-group-title,summary,button')?.textContent || g.textContent).trim().slice(0, 30));
    const lightInputs = [...document.querySelectorAll('input')].filter(x => /lightning/i.test(x.id + ' ' + x.name + ' ' + JSON.stringify(x.dataset))).map(x => ({ id: x.id, checked: x.checked }));
    return {
      dataGeneration: document.documentElement.dataset.gridatlasGeneration || null,
      atlasGeneration: A.generation || null, compositionId: A.composition_id || null,
      inspect: M && M.inspect ? M.inspect() : null, installed: !!(M && M.installed),
      proxies: document.querySelectorAll('[data-gridatlas-layer-proxy]').length,
      markers: document.querySelectorAll('[data-gridatlas-layer-key]').length,
      loaded: lc, keyGroups: groups.length, firstGroup: groups[0] || null, lastGroup: groups[groups.length - 1] || null,
      lightningInputs: lightInputs
    };
  });
  // the shell sets a <base>, so resolve current.json against the ROUTE url, not the document base
  const cur = await fetch(new URL('current.json', url)).then(r => r.json()).catch(() => null);
  const digestsOk = !!cur && v.loaded.length === cur.cartridges.length && v.loaded.every(l => cur.cartridges.some(c => c.id === l.id && c.sha256 === l.sha256));
  const gotGen = v.dataGeneration || v.atlasGeneration;
  const ok = gotGen === gen && JSON.stringify(v.inspect) === JSON.stringify(EXPECT) && v.installed && v.proxies === 63 && v.markers === 63
    && lightning.length === 0 && v.lightningInputs.every(x => !x.checked) && digestsOk && errs.length === 0;
  allOk = allOk && ok;
  out.push({ url, expectedGeneration: gen, verdict: ok ? 'PASS' : 'FAIL', composition: comp, ...v, currentJsonGeneration: cur && cur.generation, digestsOk, lightningRequests: lightning.length, pageErrors: errs, shim: shim.summary() });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${url} gen=${gotGen} (want ${gen}) inspect=${JSON.stringify(v.inspect)} installed=${v.installed} proxies=${v.proxies} markers=${v.markers} lightningReq=${lightning.length} lightningInputsChecked=${v.lightningInputs.filter(x => x.checked).length}/${v.lightningInputs.length} digests=${digestsOk} groups=${v.keyGroups} first="${v.firstGroup}" last="${v.lastGroup}" errors=${errs.length}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(new URL(`./${label}.boot.json`, import.meta.url), JSON.stringify(out, null, 1));
process.exit(allOk ? 0 : 1);
