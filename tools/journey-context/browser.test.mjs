/** Actual existing native GIS composer, not a map stub. No official-source collection. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ROOT, G, inputs, hash} from './build.mjs';
import {createPreviewServer} from '../journey/serve.mjs';
const startedUTC = new Date().toISOString(), {pin, artifact} = inputs();
const output = process.env.JOURNEY_CONTEXT_BROWSER_OUTPUT || path.join(os.tmpdir(), 'gridatlas-gj04-' + startedUTC.replace(/[:.]/g, '-'));
fs.mkdirSync(output, {recursive: true}); fs.rmSync(path.join(output, 'receipt.json'), {force: true});
console.log(JSON.stringify({startedUTC, output}));
const pwModule = process.env.PLAYWRIGHT_MODULE, pw = await import(pwModule && path.isAbsolute(pwModule) ? pathToFileURL(pwModule).href : pwModule || 'playwright');
const server = await createPreviewServer(), origin = `http://127.0.0.1:${server.address().port}`;
const errors = [], failed = [], viewports = [], negatives = [];
let browser;
try {
  browser = await pw.chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
  async function openPage(override) {
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => failed.push({url: r.url(), error: r.failure()?.errorText}));
    if (override) await page.route('**/' + pin.artifact.previewPath, override);
    await page.goto(`${origin}/atlas/v/${G}/`, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.waitForFunction(() => window.__GRIDATLAS_V9_MAP__?.getStyle()?.layers?.length && document.querySelector('.gj-launch'));
    await page.locator('.gj-launch').tap(); return page;
  }
  const page = await openPage();
  await page.waitForFunction(() => document.querySelector('.gj-official-context')?.dataset.state === 'reviewed-facts');
  assert.equal(await page.locator('#gridatlas-gj03-panel > .gj-official-context').count(), 1);
  assert.equal(await page.evaluate(() => !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-gj03-route')), false, 'Planning notice does not start a real or synthetic journey');
  const native = await page.evaluate(() => ({version: maplibregl.version, canvasCount: document.querySelectorAll('canvas.maplibregl-canvas').length, webgl: !!window.__GRIDATLAS_V9_MAP__.getCanvas().getContext('webgl2') || !!window.__GRIDATLAS_V9_MAP__.getCanvas().getContext('webgl')}));
  assert.equal(native.version, '3.6.2'); assert.equal(native.canvasCount, 1); assert.equal(native.webgl, true);
  await page.locator('.gj-official-context > summary').tap();
  const text = await page.locator('.gj-official-context').textContent();
  assert.match(text, /Sea Link/); assert.match(text, /EN020026/); assert.match(text, /2026-10-30 \(day precision\)/); assert.match(text, /planned transmission upper bound/); assert.match(text, /0 REPD\/ETYS\/asset joins/); assert.match(text, /UNKNOWN/);
  assert.ok(text.includes(pin.commit)); assert.ok(text.includes(pin.artifact.sha256));
  const sourceLinks = await page.locator('.gj-official-context a').evaluateAll(links => links.map(a => ({url: a.href, rel: a.rel})));
  assert.equal(sourceLinks.length, 3); assert.ok(sourceLinks.every(a => a.rel.includes('noopener')));
  await page.getByText('Source dates and provenance', {exact: true}).click();
  await page.locator('.gj-official-context a').first().focus();
  await page.keyboard.press('Tab'); assert.equal(await page.locator('.gj-official-context a').nth(1).evaluate(e => e === document.activeElement), true);
  for (const [width, height] of [[390, 844], [393, 852], [1440, 1000], [844, 390]]) {
    await page.setViewportSize({width, height});
    await page.locator('.gj-official-context > summary').scrollIntoViewIfNeeded();
    const layout = await page.evaluate(() => ({overflow: document.documentElement.scrollWidth > innerWidth, controls: [...document.querySelectorAll('.gj-official-context summary,.gj-official-context a')].map(e => ({tag: e.tagName, h: e.getBoundingClientRect().height})), contextCount: document.querySelectorAll('.gj-official-context').length}));
    assert.equal(layout.overflow, false); assert.equal(layout.contextCount, 1); assert.ok(layout.controls.every(e => e.h >= 44));
    const close = page.getByRole('button', {name: 'Close Grid Journey', exact: true}); await close.scrollIntoViewIfNeeded();
    assert.equal(await close.evaluate(e => { const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === e || e.contains(hit); }), true);
    await page.screenshot({path: path.join(output, `official-context-${width}x${height}.png`)});
    viewports.push({width, height, layout, result: 'PASS'});
  }
  await page.evaluate(() => window.__GRIDATLAS_MODULES__.gridJourneyOfficialContext.close());
  assert.equal(await page.locator('.gj-official-context').evaluate(e => e.open), false);
  await page.getByRole('button', {name: 'Load SYNTHETIC demonstration', exact: true}).tap();
  await page.getByRole('combobox', {name: 'Explicit starting node'}).selectOption('A1');
  await page.waitForFunction(() => window.__GRIDATLAS_MODULES__.gridJourneyPreview.snapshot().steps === 8);
  await page.getByRole('button', {name: 'Next', exact: true}).tap(); assert.equal(await page.evaluate(() => window.__GRIDATLAS_MODULES__.gridJourneyPreview.snapshot().step), 1);
  assert.equal(await page.locator('.gj-official-context').count(), 1);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gridatlas:card-open', {detail: {owner: 'offtakers'}})));
  assert.equal(await page.evaluate(() => !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-gj03-route')), false);
  assert.match(await page.locator('.gj-official-context').textContent(), /no association with the selected map asset is established/);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const a = window.__GRIDATLAS_MODULES__.gridJourneyPreview; a.destroy(); a.mount(); });
    await page.waitForFunction(() => document.querySelector('.gj-official-context')?.dataset.state === 'reviewed-facts');
    assert.equal(await page.locator('.gj-official-context').count(), 1);
  }
  await page.evaluate(() => window.__GRIDATLAS_MODULES__.gridJourneyOfficialContext.destroy());
  assert.equal(await page.locator('.gj-official-context').count(), 0); assert.equal(await page.locator('.gj-launch').count(), 1);
  await page.evaluate(() => window.__GRIDATLAS_MODULES__.gridJourneyOfficialContext.mount());
  await page.waitForFunction(() => document.querySelector('.gj-official-context')?.dataset.state === 'reviewed-facts');
  await page.evaluate(() => window.__GRIDATLAS_V9_MAP__.remove());
  assert.equal(await page.locator('.gj-official-context').count(), 0); assert.equal(await page.evaluate(() => window.__GRIDATLAS_MODULES__.gridJourneyOfficialContext.snapshot().alive), false);
  await page.close();
  for (const [name, override] of [
    ['missing', route => route.fulfill({status: 404, body: ''})],
    ['changed-bytes', route => route.fulfill({status: 200, contentType: 'application/json', body: Buffer.concat([artifact, Buffer.from(' ')])})],
    ['oversize', route => route.fulfill({status: 200, contentType: 'application/json', body: 'x'.repeat(8001)})]
  ]) {
    const p = await openPage(override); await p.waitForFunction(() => document.querySelector('.gj-official-context')?.dataset.state === 'withheld');
    assert.equal(await p.locator('.gj-official-context').textContent().then(s => s.includes('EN020026')), false);
    assert.equal(await p.evaluate(() => !!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-gj03-route')), false);
    negatives.push({name, result: 'WITHHELD_NO_ROUTE'}); await p.close();
  }
  assert.deepEqual(errors, []);
  const receipt = {result: 'PASS', startedUTC, completedUTC: new Date().toISOString(), generation: G, producerCommit: pin.commit, producerArtifactSha256: pin.artifact.sha256, factsSha256: pin.factsSha256, scriptSha256: hash(fs.readFileSync(path.join(ROOT, `atlas/modules/${G}-grid-journey-official-context.js`))), native, viewports, negatives, lifecycle: '3 Journey remounts, independent context removal/remount, actual map.remove disconnects bridge; synthetic Journey remains independent', sourceDelivery: 'one pinned local JSON asset, bounded8000B; government HTML and third-party material not fetched', realRoutesAccepted: 0, joinsCreated: 0, physicalHandset: 'UNKNOWN; Chromium touch/keyboard/viewport emulation', physicalAssistiveTechnology: 'UNKNOWN', errors, failed};
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({result: 'PASS', output, viewports: viewports.length, negatives: negatives.length, errors, requestFailures: failed.length}));
} catch (e) { fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({message: e.message, stack: e.stack, errors, failed}, null, 2) + '\n'); throw e; }
finally { await browser?.close(); await new Promise(r => server.close(r)); }
