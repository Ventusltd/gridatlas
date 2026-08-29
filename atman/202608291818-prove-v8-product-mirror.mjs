import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const oracleUrl = process.env.ORACLE_URL || 'http://127.0.0.1:4174/';
const mirrorUrl = process.env.MIRROR_URL || 'https://ventusltd.github.io/gridatlas/202608291758-atlas-v9/';
const output = process.env.OUTPUT || 'work/202608291818-v8-mirror-proof.json';

const EXPECTED = Object.freeze({
  indexBlob: '278c3f55d3b61af9d13417c99bfb558374131143',
  cssBlob: '29a2edb490407f489c29433d84e329b1038e0657',
  engineBlob: '0a647c32c346770851704727bbf86fb7167e2596',
  bridgeScript: '<script src="v9-parquet-fetch-bridge.js"></script>\n\n'
});

const selectors = [
  '.dashboard', '.hud-header', '.map-container', '.scada-wrapper', '.scada-brand',
  '.status-legend', '#scada-ui-container', '.search-bar-wrapper', '.map-controls',
  '#radius-popup', '#radius-area-popup', '#zonedraw-display', '#measure-display',
  '#polyzone-display', '#fs-curtain', '#fs-letterhead', '#btn-fullscreen', '#btn-fullscreen-exit'
];
const pixelRegions = [
  { selector: '.hud-header', masks: [] },
  { selector: '.search-bar-wrapper', masks: [] },
  { selector: '.map-controls', masks: [] },
  { selector: '.scada-wrapper', masks: ['#scada-ui-container'] }
];
const styleProps = [
  'display','position','font-family','font-size','font-weight','color','background-color',
  'border-top-width','border-right-width','border-bottom-width','border-left-width','border-radius',
  'padding-top','padding-right','padding-bottom','padding-left','gap','grid-template-columns',
  'flex-direction','overflow','z-index'
];

function requireCondition(condition, message) { if (!condition) throw new Error(message); }
function gitBlobSha1(buffer) {
  return crypto.createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}
async function getBytes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  requireCondition(response.ok, `${url} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function verifyPublicBytes() {
  const [oi, oc, oe, mi, mc, me] = await Promise.all([
    getBytes(new URL('index.html', oracleUrl)), getBytes(new URL('ventusv8.css', oracleUrl)),
    getBytes(new URL('ventus-corev8engine.js', oracleUrl)), getBytes(new URL('index.html', mirrorUrl)),
    getBytes(new URL('ventusv8.css', mirrorUrl)), getBytes(new URL('ventus-corev8engine.js', mirrorUrl))
  ]);
  requireCondition(gitBlobSha1(oi) === EXPECTED.indexBlob, 'pinned V8 index blob mismatch');
  requireCondition(gitBlobSha1(oc) === EXPECTED.cssBlob, 'pinned V8 CSS blob mismatch');
  requireCondition(gitBlobSha1(oe) === EXPECTED.engineBlob, 'pinned V8 engine blob mismatch');
  requireCondition(gitBlobSha1(mc) === EXPECTED.cssBlob, 'public mirror CSS is not byte-identical to V8');
  requireCondition(gitBlobSha1(me) === EXPECTED.engineBlob, 'public mirror engine is not byte-identical to V8');
  const mirrorText = mi.toString('utf8');
  requireCondition(mirrorText.includes(EXPECTED.bridgeScript), 'public mirror bridge insertion missing');
  const normalised = Buffer.from(mirrorText.replace(EXPECTED.bridgeScript, ''), 'utf8');
  requireCondition(normalised.equals(oi), 'public mirror HTML differs from pinned V8 beyond the permitted bridge insertion');
  requireCondition(gitBlobSha1(normalised) === EXPECTED.indexBlob, 'normalised mirror index blob mismatch');
  return {
    index_blob: EXPECTED.indexBlob, css_blob: EXPECTED.cssBlob, engine_blob: EXPECTED.engineBlob,
    html_delta: 'ONE_BRIDGE_SCRIPT_INSERTION_ONLY', css_byte_identical: true, engine_byte_identical: true
  };
}

async function ready(page) {
  await page.waitForSelector('.dashboard', { timeout: 45000 });
  await page.waitForSelector('#scada-ui-container .key-item', { timeout: 45000 });
  await page.waitForSelector('#map canvas', { timeout: 45000 });
}

async function snapshot(page) {
  return page.evaluate(({ selectors, styleProps }) => {
    const clean = n => Math.round(Number(n) * 10) / 10;
    const boxes = {}, styles = {};
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) { boxes[selector] = null; styles[selector] = null; continue; }
      const b = el.getBoundingClientRect(), c = getComputedStyle(el);
      boxes[selector] = { x: clean(b.x), y: clean(b.y), width: clean(b.width), height: clean(b.height) };
      styles[selector] = Object.fromEntries(styleProps.map(p => [p, c.getPropertyValue(p)]));
    }
    return {
      boxes, styles,
      controls: [...document.querySelectorAll('.map-ctrl-btn')].map(el => ({ id: el.id, text: el.textContent.trim() })),
      groups: [...document.querySelectorAll('#scada-ui-container .key-title')].map(el => el.textContent.trim()),
      layer_labels: [...document.querySelectorAll('#scada-ui-container span[data-base-label]')].map(el => ({ id: el.id, base: el.getAttribute('data-base-label'), color: getComputedStyle(el).color })),
      checkboxes: document.querySelectorAll('#scada-ui-container input[type="checkbox"]').length,
      radios: document.querySelectorAll('#scada-ui-container input[type="radio"]').length,
      placeholder: document.querySelector('#search-input')?.getAttribute('placeholder') || '',
      brand: document.querySelector('.ventus-main')?.textContent.trim() || ''
    };
  }, { selectors, styleProps });
}

function compareSnapshots(a, b, viewport) {
  const errors = [], same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!same(a.controls, b.controls)) errors.push(`${viewport}: map controls differ`);
  if (!same(a.groups, b.groups)) errors.push(`${viewport}: layer groups differ`);
  if (!same(a.layer_labels, b.layer_labels)) errors.push(`${viewport}: layer labels/order/colours differ`);
  if (a.checkboxes !== b.checkboxes) errors.push(`${viewport}: checkbox count differs`);
  if (a.radios !== b.radios) errors.push(`${viewport}: radio count differs`);
  if (a.placeholder !== b.placeholder) errors.push(`${viewport}: search placeholder differs`);
  if (a.brand !== b.brand) errors.push(`${viewport}: brand differs`);
  for (const selector of selectors) {
    const x = a.boxes[selector], y = b.boxes[selector];
    if ((x === null) !== (y === null)) { errors.push(`${viewport}: selector presence differs ${selector}`); continue; }
    if (!x || !y) continue;
    for (const key of ['x','y','width','height']) if (Math.abs(x[key] - y[key]) > 1.0) errors.push(`${viewport}: ${selector} ${key} differs`);
    for (const prop of styleProps) if (a.styles[selector]?.[prop] !== b.styles[selector]?.[prop]) errors.push(`${viewport}: ${selector} ${prop} differs`);
  }
  return errors;
}

async function normaliseStableUi(page) {
  await page.addStyleTag({ content: `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}` });
  await page.evaluate(() => {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('clock','12:34:56'); set('date','29/08/2026'); set('days','8526 DAYS');
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    document.querySelectorAll('input[type="radio"][value="dark"]').forEach(el => el.checked = true);
    const input = document.getElementById('search-input'); if (input) { input.value = ''; input.blur(); }
    const results = document.getElementById('search-results'); if (results) { results.innerHTML = ''; results.style.display = 'none'; }
    document.querySelectorAll('.map-ctrl-btn').forEach(el => el.classList.remove('active'));
    for (const id of ['radius-popup','radius-area-popup','zonedraw-display','measure-display','polyzone-display']) {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }
  });
  await page.waitForTimeout(80);
}

async function regionScreenshot(page, region) {
  const masks = region.masks.map(selector => page.locator(selector));
  return page.locator(region.selector).screenshot({ animations: 'disabled', mask: masks, maskColor: '#000000' });
}

async function pixelProof(oraclePage, mirrorPage, viewport) {
  await Promise.all([normaliseStableUi(oraclePage), normaliseStableUi(mirrorPage)]);
  const regions = {};
  for (const region of pixelRegions) {
    const [a, b] = await Promise.all([regionScreenshot(oraclePage, region), regionScreenshot(mirrorPage, region)]);
    const ah = crypto.createHash('sha256').update(a).digest('hex');
    const bh = crypto.createHash('sha256').update(b).digest('hex');
    requireCondition(a.equals(b), `${viewport}: stable UI pixels differ for ${region.selector}`);
    regions[region.selector] = { identical: true, sha256: ah, mirror_sha256: bh, bytes: a.length, masks: region.masks };
  }
  return {
    identical: true,
    method: 'EXACT_STABLE_REGION_PNG_BYTES_WITH_DYNAMIC_STATUS_MASK',
    volatile_map_canvas_excluded: true,
    asynchronous_scada_status_text_masked: true,
    regions
  };
}

async function stateForControl(page, id) {
  return page.evaluate(controlId => {
    const display = selector => { const el = document.querySelector(selector); return el ? getComputedStyle(el).display : null; };
    return {
      active: document.getElementById(controlId)?.classList.contains('active') || false,
      radius: display('#radius-popup'), radius_area: display('#radius-area-popup'),
      zone: display('#zonedraw-display'), measure: display('#measure-display'),
      map_container_class: document.getElementById('map-container')?.className || '', body_class: document.body.className
    };
  }, id);
}

async function interactionProof(oraclePage, mirrorPage) {
  const states = {};
  for (const id of ['btn-radius','btn-radius-area','btn-zonedraw','btn-status','btn-measure']) {
    await Promise.all([oraclePage.click(`#${id}`), mirrorPage.click(`#${id}`)]);
    const [a, b] = await Promise.all([stateForControl(oraclePage, id), stateForControl(mirrorPage, id)]);
    requireCondition(JSON.stringify(a) === JSON.stringify(b), `interaction state differs after ${id}`);
    states[id] = b;
    await Promise.all([oraclePage.click(`#${id}`), mirrorPage.click(`#${id}`)]);
  }
  return states;
}

async function bridgeProof(page) {
  for (const id of ['400','dc','solar']) {
    await page.locator(`#scada-ui-container input[data-layer-id="${id}"]`).check();
    await page.waitForFunction(layerId => {
      const text = document.querySelector(`#lbl-${layerId}`)?.textContent || '';
      return /\[(?:OK|\d+)/.test(text) && !text.includes('[FAIL]');
    }, id, { timeout: 90000 });
  }
  const bridge = await page.evaluate(() => window.__GRIDATLAS_V9_BRIDGE__);
  requireCondition(bridge?.intercepted >= 3, 'V9 bridge did not intercept sentinel loads');
  requireCondition(Object.keys(bridge?.loaded || {}).length >= 3, 'V9 bridge did not hydrate sentinel sources');
  requireCondition((bridge?.failures || []).length === 0, `V9 bridge failures: ${JSON.stringify(bridge?.failures || [])}`);
  return bridge;
}

const proof = {
  schema: 'gridatlas.v8-public-product-mirror-proof.v4', classification: 'REJECTED',
  oracle: oracleUrl, mirror: mirrorUrl, bytes: null, viewports: {}, interactions: null, bridge: null, errors: []
};
const browser = await chromium.launch({ headless: true });
try {
  proof.bytes = await verifyPublicBytes();
  for (const viewport of [{ name:'desktop', width:1440, height:900 }, { name:'mobile', width:390, height:844 }]) {
    const oraclePage = await browser.newPage({ viewport }), mirrorPage = await browser.newPage({ viewport });
    try {
      await Promise.all([
        oraclePage.goto(oracleUrl, { waitUntil:'domcontentloaded', timeout:60000 }),
        mirrorPage.goto(mirrorUrl, { waitUntil:'domcontentloaded', timeout:60000 })
      ]);
      await Promise.all([ready(oraclePage), ready(mirrorPage)]);
      const [a, b] = await Promise.all([snapshot(oraclePage), snapshot(mirrorPage)]);
      const errors = compareSnapshots(a, b, viewport.name);
      requireCondition(errors.length === 0, errors.join('\n'));
      proof.viewports[viewport.name] = { structure_identical: true, pixels: await pixelProof(oraclePage, mirrorPage, viewport.name) };
      if (viewport.name === 'desktop') {
        proof.interactions = await interactionProof(oraclePage, mirrorPage);
        proof.bridge = await bridgeProof(mirrorPage);
      }
    } finally { await oraclePage.close(); await mirrorPage.close(); }
  }
  proof.classification = 'VERIFIED_PUBLIC_V8_PRODUCT_MIRROR';
} catch (error) {
  proof.errors.push(String(error?.stack || error));
  throw error;
} finally {
  await browser.close();
  const parent = output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.';
  await fs.mkdir(parent, { recursive: true });
  await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n');
}
console.log(JSON.stringify({ classification: proof.classification, bridge_sources: Object.keys(proof.bridge?.loaded || {}).length }));
