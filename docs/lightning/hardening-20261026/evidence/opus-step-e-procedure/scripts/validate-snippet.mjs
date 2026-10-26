// Validates ONLY the Step E console snippet (that it runs, is read-only and reports the fields the owner
// procedure relies on). Harness: lead-shim (offline-shim.mjs), Chromium headless, 1440x900, SHA fda6b10.
// This is NOT Step E evidence: raw.githubusercontent.com is answered from local files by the shim.
// Usage: node validate-snippet.mjs <port> <outDir>
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [port, outDir] = [process.argv[2], process.argv[3]];
mkdirSync(outDir, { recursive: true });
const SNIPPET = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'step-e-console-snippet.js'), 'utf8');
const BASE = `http://127.0.0.1:${port}/wt/atlas/`;
const CAND = `http://127.0.0.1:${port}/wt/atlas/v/202610261949/`;
const FIX = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/fixtures/lightning-archive/data';
const log = [];
const say = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };

async function probe(page, tag, reqs) {
  const before = await page.evaluate(() => { const S = window.__GRIDATLAS_MODULES__?.ukLightning?.state; return S ? { on: S.on, requests: S.requests, serial: S.serial, errors: S.errors.length } : null; });
  const n0 = reqs.length;
  let printed = null;
  const onConsole = m => { if (m.type() === 'log' && m.text().startsWith('{')) printed = m.text(); };
  page.on('console', onConsole);
  const ret = await page.evaluate(SNIPPET);            // the snippet is an expression (IIFE); evaluate returns its value
  await page.waitForTimeout(300);
  page.off('console', onConsole);
  const after = await page.evaluate(() => { const S = window.__GRIDATLAS_MODULES__?.ukLightning?.state; return S ? { on: S.on, requests: S.requests, serial: S.serial, errors: S.errors.length } : null; });
  const newReqs = reqs.slice(n0).filter(u => !/tiles|\.pbf|\.png/.test(u));
  writeFileSync(join(outDir, `${tag}.json`), printed || 'NO JSON PRINTED');
  const j = printed ? JSON.parse(printed) : {};
  say(`[${tag}] return="${ret}" printed=${!!printed} state_unchanged=${JSON.stringify(before) === JSON.stringify(after)} requests_during_probe=${newReqs.length}${newReqs.length ? ' ' + JSON.stringify(newReqs) : ''}`);
  say(`   generation=${j.generation} sld=${(j.sld_sha256 || '').slice(0, 12)} inspect=${JSON.stringify(j.menu_inspect)} proxies=${j.proxies} markers=${j.markers} inputs=${JSON.stringify(j.inputs)} leak=${j.leak} fetch=${j.fetch_name} iod=${j.intercepted_on_demand} style=${JSON.stringify(j.style_layers_sources)} secure=${j.secure} bridge_failures=${JSON.stringify(j.bridge && j.bridge.failures)} search=${JSON.stringify(j.search)}`);
  const L = j.lightning;
  if (L && typeof L === 'object') say(`   lightning phase=${L.phase} on=${L.on} requests=${L.requests} ie=${JSON.stringify(L.ie)} index=${JSON.stringify(L.index)} res=${JSON.stringify(L.res)} surfaces=${JSON.stringify(L.surfaces)} labels=${JSON.stringify(L.labels)} status=${JSON.stringify(L.status)} map_layer=${L.map_layer} map_source=${L.map_source} last=${JSON.stringify(L.last)}`);
  else say(`   lightning=${JSON.stringify(L)}`);
  return j;
}

async function run(name, url, lightningDataDir, toggle) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reqs = []; const errors = [];
  page.on('request', r => reqs.push(r.url()));
  page.on('pageerror', e => errors.push(String(e.message || e)));
  const shim = await installOfflineShim(page, lightningDataDir ? { lightningDataDir } : {});
  say(`== ${name}: ${url} (lightningDataDir=${lightningDataDir || 'default /home/claude/lightning/data'})`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  say('   composition ' + JSON.stringify(await waitForComposition(page)));
  await page.waitForTimeout(3000);
  await probe(page, `${name}-1-rest`, reqs);
  if (toggle) {
    // Snippet validation only: Playwright click (it may scroll the panel programmatically; not a hit-test claim).
    const box = page.locator('[data-lightning-group="main"] [data-lightning-control="toggle"]');
    await box.click({ timeout: 10000 });
    await page.waitForFunction(() => { const t = document.querySelector('[data-lightning-label="main"]')?.textContent || ''; return !/\[(LOAD|WAIT)\]/.test(t); }, null, { timeout: 30000 }).catch(() => say('   label still LOAD/WAIT after 30 s'));
    await page.waitForTimeout(1500);
    await probe(page, `${name}-2-on`, reqs);
    await box.click({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await probe(page, `${name}-3-off`, reqs);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForComposition(page);
    await page.waitForTimeout(3000);
    await probe(page, `${name}-4-reload`, reqs);
  }
  say(`   pageerrors=${JSON.stringify(errors.slice(0, 5))} shim=${JSON.stringify(shim.summary().served)}`);
  await browser.close();
}

say(`validate-snippet start_utc=${new Date().toISOString()} harness=lead-shim chromium-headless 1440x900 candidate=fda6b10 (atlas/ unchanged at worktree HEAD 18842df)`);
await run('baseline', BASE, null, false);
await run('candidate-noarchive', CAND, null, true);
await run('candidate-fixture-archive', CAND, FIX, true);
say(`end_utc=${new Date().toISOString()}`);
writeFileSync(join(outDir, 'validate-snippet.log'), log.join('\n') + '\n');
