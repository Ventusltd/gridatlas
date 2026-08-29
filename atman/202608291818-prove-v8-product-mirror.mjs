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

const structuralSelectors = [
  '.dashboard', '.hud-header', '.map-container', '.scada-wrapper', '.scada-brand',
  '.status-legend', '#scada-ui-container', '.search-bar-wrapper', '.map-controls',
  '#radius-popup', '#radius-area-popup', '#zonedraw-display', '#measure-display',
  '#polyzone-display', '#fs-curtain', '#fs-letterhead', '#btn-fullscreen', '#btn-fullscreen-exit'
];

const styleProps = [
  'display', 'position', 'font-family', 'font-size', 'font-weight', 'color',
  'background-color', 'border-top-width', 'border-right-width', 'border-bottom-width',
  'border-left-width', 'border-radius', 'padding-top', 'padding-right', 'padding-bottom',
  'padding-left', 'gap', 'grid-template-columns', 'flex-direction', 'overflow', 'z-index'
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function gitBlobSha1(buffer) {
  const prefix = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(prefix).update(buffer).digest('hex');
}

async function getBytes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  requireCondition(response.ok, `${url} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function verifyPublicBytes() {
  const [oracleIndex, oracleCss, oracleEngine, mirrorIndex, mirrorCss, mirrorEngine] = await Promise.all([
    getBytes(new URL('index.html', oracleUrl)),
    getBytes(new URL('ventusv8.css', oracleUrl)),
    getBytes(new URL('ventus-corev8engine.js', oracleUrl)),
    getBytes(new URL('index.html', mirrorUrl)),
    getBytes(new URL('ventusv8.css', mirrorUrl)),
    getBytes(new URL('ventus-corev8engine.js', mirrorUrl))
  ]);

  requireCondition(gitBlobSha1(oracleIndex) === EXPECTED.indexBlob, 'pinned V8 index blob mismatch');
  requireCondition(gitBlobSha1(oracleCss) === EXPECTED.cssBlob, 'pinned V8 CSS blob mismatch');
  requireCondition(gitBlobSha1(oracleEngine) === EXPECTED.engineBlob, 'pinned V8 engine blob mismatch');
  requireCondition(gitBlobSha1(mirrorCss) === EXPECTED.cssBlob, 'public mirror CSS is not byte-identical to V8');
  requireCondition(gitBlobSha1(mirrorEngine) === EXPECTED.engineBlob, 'public mirror engine is not byte-identical to V8');

  const mirrorText = mirrorIndex.toString('utf8');
  requireCondition(mirrorText.includes(EXPECTED.bridgeScript), 'public mirror bridge insertion missing');
  const normalisedMirror = Buffer.from(mirrorText.replace(EXPECTED.bridgeScript, ''), 'utf8');
  requireCondition(gitBlobSha1(normalisedMirror) === EXPECTED.indexBlob, 'public mirror HTML differs from V8 beyond the permitted bridge insertion');
  requireCondition(normalisedMirror.equals(oracleIndex), 'normalised public mirror HTML is not byte-identical to pinned V8 HTML');

  return {
    index_blob: EXPECTED.indexBlob,
    css_blob: EXPECTED.cssBlob,
    engine_blob: EXPECTED.engineBlob,
    html_delta: 'ONE_BRIDGE_SCRIPT_INSERTION_ONLY',
    css_byte_identical: true,
    engine_byte_identical: true
  };
}

async function ready(page) {
  await page.waitForSelector('.dashboard', { timeout: 45000 });
  await page.waitForSelector('#scada-ui-container .key-item', { timeout: 45000 });
  await page.waitForSelector('#map canvas', { timeout: 45000 });
}

async function structuralSnapshot(page) {
  return page.evaluate(({ structuralSelectors, styleProps }) => {
    const clean = value => Math.round(Number(value) * 10) / 10;
    const boxes = {};
    const styles = {};
    for (const selector of structuralSelectors) {
      const element = document.querySelector(selector);
      if (!element) {
        boxes[selector] = null;
        styles[selector] = null;
        continue;
      }
      const box = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      boxes[selector] = { x: clean(box.x), y: clean(box.y), width: clean(box.width), height: clean(box.height) };
      styles[selector] = Object.fromEntries(styleProps.map(prop => [prop, computed.getPropertyValue(prop)]));
    }
    return {
      boxes,
      styles,
      controls: [...document.querySelectorAll('.map-ctrl-btn')].map(el => ({ id: el.id, text: el.textContent.trim() })),
      group_titles: [...document.querySelectorAll('#scada-ui-container .key-title')].map(el => el.textContent.trim()),
      checkboxes: document.querySelectorAll('#scada-ui-container input[type="checkbox"]').length,
      radios: document.querySelectorAll('#scada-ui-container input[type="radio"]').length,
      placeholder: document.querySelector('#search-input')?.getAttribute('placeholder') || '',
      brand: document.querySelector('.ventus-main')?.textContent.trim() || ''
    };
  }, { structuralSelectors, styleProps });
}

function compareStructure(oracle, mirror, viewport) {
  const errors = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!same(oracle.controls, mirror.controls)) errors.push(`${viewport}: control labels/order differ`);
  if (!same(oracle.group_titles, mirror.group_titles)) errors.push(`${viewport}: SCADA group labels/order differ`);
  if (oracle.checkboxes !== mirror.checkboxes) errors.push(`${viewport}: checkbox count differs`);
  if (oracle.radios !== mirror.radios) errors.push(`${viewport}: basemap radio count differs`);
  if (oracle.placeholder !== mirror.placeholder) errors.push(`${viewport}: search placeholder differs`);
  if (oracle.brand !== mirror.brand) errors.push(`${viewport}: brand differs`);
  for (const selector of structuralSelectors) {
    const a = oracle.boxes[selector];
    const b = mirror.boxes[selector];
    if ((a === null) !== (b === null)) {
      errors.push(`${viewport}: selector presence differs: ${selector}`);
      continue;
    }
    if (!a || !b) continue;
    for (const key of ['x', 'y', 'width', 'height']) {
      if (Math.abs(a[key] - b[key]) > 1.0) errors.push(`${viewport}: ${selector} ${key} differs: ${b[key]} vs ${a[key]}`);
    }
    for (const prop of styleProps) {
      if (oracle.styles[selector]?.[prop] !== mirror.styles[selector]?.[prop]) {
        errors.push(`${viewport}: ${selector} computed ${prop} differs`);
      }
    }
  }
  return errors;
}

async function normaliseForPixels(page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
    #map canvas, .maplibregl-canvas-container, .maplibregl-popup { visibility: hidden !important; }
  ` });
  await page.evaluate(() => {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('clock', '12:34:56');
    set('date', '29/08/2026');
    set('days', '8526 DAYS');
    document.querySelectorAll('span[data-base-label]').forEach(el => { el.textContent = `${el.getAttribute('data-base-label')} [WAIT]`; });
    document.querySelectorAll('input[type="checkbox"]').forEach(el => { el.checked = false; });
    document.querySelectorAll('input[type="radio"][value="dark"]').forEach(el => { el.checked = true; });
    const input = document.getElementById('search-input'); if (input) { input.value = ''; input.blur(); }
    const results = document.getElementById('search-results'); if (results) { results.innerHTML = ''; results.style.display = 'none'; }
    document.querySelectorAll('.map-ctrl-btn').forEach(el => el.classList.remove('active'));
    for (const id of ['radius-popup','radius-area-popup','zonedraw-display','measure-display','polyzone-display']) {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(100);
}

async function pixelProof(oraclePage, mirrorPage, viewportName) {
  await Promise.all([normaliseForPixels(oraclePage), normaliseForPixels(mirrorPage)]);
  const [oraclePng, mirrorPng] = await Promise.all([
    oraclePage.screenshot({ fullPage: false, animations: 'disabled' }),
    mirrorPage.screenshot({ fullPage: false, animations: 'disabled' })
  ]);
  const oracleSha = crypto.createHash('sha256').update(oraclePng).digest('hex');
  const mirrorSha = crypto.createHash('sha256').update(mirrorPng).digest('hex');
  requireCondition(oraclePng.equals(mirrorPng), `${viewportName}: normalised rendered pixels are not byte-identical`);
  return { identical: true, sha256: oracleSha, mirror_sha256: mirrorSha, bytes: oraclePng.length };
}

async function stateForControl(page, controlId) {
  return page.evaluate(id => {
    const display = selector => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).display : null;
    };
    return {
      active: document.getElementById(id)?.classList.contains('active') || false,
      radius: display('#radius-popup'),
      radius_area: display('#radius-area-popup'),
      zone: display('#zonedraw-display'),
      measure: display('#measure-display'),
      map_container_class: document.getElementById('map-container')?.className || '',
      body_class: document.body.className
    };
  }, controlId);
}

async function interactionProof(oraclePage, mirrorPage) {
  const controls = ['btn-radius', 'btn-radius-area', 'btn-zonedraw', 'btn-status', 'btn-measure'];
  const states = {};
  for (const id of controls) {
    await Promise.all([oraclePage.click(`#${id}`), mirrorPage.click(`#${id}`)]);
    const [oracleState, mirrorState] = await Promise.all([stateForControl(oraclePage, id), stateForControl(mirrorPage, id)]);
    requireCondition(JSON.stringify(oracleState) === JSON.stringify(mirrorState), `interaction state differs after ${id}`);
    states[id] = mirrorState;
    await Promise.all([oraclePage.click(`#${id}`), mirrorPage.click(`#${id}`)]);
  }
  return states;
}

async function bridgeProof(page) {
  const toggle = async id => {
    await page.locator(`#scada-ui-container input[data-layer-id="${id}"]`).check();
    await page.waitForFunction(layerId => {
      const text = document.querySelector(`#lbl-${layerId}`)?.textContent || '';
      return /\[(?:OK|\d+)/.test(text) && !text.includes('[FAIL]');
    }, id, { timeout: 90000 });
  };
  await toggle('400');
  await toggle('dc');
  await toggle('solar');
  const bridge = await page.evaluate(() => window.__GRIDATLAS_V9_BRIDGE__);
  requireCondition(bridge?.intercepted >= 3, 'mirror bridge did not intercept V8 source loads');
  requireCondition(Object.keys(bridge?.loaded || {}).length >= 3, 'mirror bridge did not hydrate three sentinel sources');
  requireCondition((bridge?.failures || []).length === 0, `mirror bridge failures: ${JSON.stringify(bridge?.failures || [])}`);
  return bridge;
}

const proof = {
  schema: 'gridatlas.v8-public-product-mirror-proof.v2',
  classification: 'REJECTED',
  oracle: oracleUrl,
  mirror: mirrorUrl,
  bytes: null,
  viewports: {},
  interactions: null,
  bridge: null,
  errors: []
};

const browser = await chromium.launch({ headless: true });
try {
  proof.bytes = await verifyPublicBytes();
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    const oraclePage = await browser.newPage({ viewport });
    const mirrorPage = await browser.newPage({ viewport });
    try {
      await Promise.all([
        oraclePage.goto(oracleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }),
        mirrorPage.goto(mirrorUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      ]);
      await Promise.all([ready(oraclePage), ready(mirrorPage)]);
      const [oracleSnapshot, mirrorSnapshot] = await Promise.all([structuralSnapshot(oraclePage), structuralSnapshot(mirrorPage)]);
      const errors = compareStructure(oracleSnapshot, mirrorSnapshot, viewport.name);
      requireCondition(errors.length === 0, errors.join('\n'));
      const pixels = await pixelProof(oraclePage, mirrorPage, viewport.name);
      proof.viewports[viewport.name] = { structure_identical: true, pixels };
      if (viewport.name === 'desktop') {
        proof.interactions = await interactionProof(oraclePage, mirrorPage);
        proof.bridge = await bridgeProof(mirrorPage);
      }
    } finally {
      await oraclePage.close();
      await mirrorPage.close();
    }
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

console.log(JSON.stringify({ classification: proof.classification, viewports: Object.keys(proof.viewports), bridge_sources: Object.keys(proof.bridge?.loaded || {}).length }));
