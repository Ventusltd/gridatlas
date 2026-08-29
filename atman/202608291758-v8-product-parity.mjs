import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const candidateUrl = process.env.CANDIDATE_URL || 'http://127.0.0.1:4173/202608291758-atlas-v9/';
const oracleUrl = process.env.ORACLE_URL || 'https://globalgrid2050.com/repd_grid_atlasv8/';
const output = process.env.OUTPUT || 'work/202608291758-v8-product-parity.json';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const structuralSelectors = [
  '.dashboard', '.hud-header', '.map-container', '.scada-wrapper', '.scada-brand',
  '.status-legend', '#scada-ui-container', '.search-bar-wrapper', '.map-controls',
  '#radius-popup', '#radius-area-popup', '#zonedraw-display', '#measure-display',
  '#polyzone-display', '#fs-curtain', '#fs-letterhead'
];
const styleProps = [
  'display', 'position', 'font-family', 'font-size', 'font-weight', 'color',
  'background-color', 'border-top-width', 'border-right-width', 'border-bottom-width',
  'border-left-width', 'border-radius', 'padding-top', 'padding-right', 'padding-bottom',
  'padding-left', 'gap', 'grid-template-columns', 'flex-direction', 'overflow', 'z-index'
];

async function ready(page) {
  await page.waitForSelector('.dashboard', { timeout: 30000 });
  await page.waitForSelector('#scada-ui-container .key-item', { timeout: 30000 });
  await page.waitForSelector('#map canvas', { timeout: 30000 });
}

async function snapshot(page) {
  return page.evaluate(({ structuralSelectors, styleProps }) => {
    const clean = value => Math.round(Number(value) * 10) / 10;
    const boxes = {};
    const styles = {};
    for (const selector of structuralSelectors) {
      const el = document.querySelector(selector);
      if (!el) {
        boxes[selector] = null;
        styles[selector] = null;
        continue;
      }
      const box = el.getBoundingClientRect();
      boxes[selector] = { x: clean(box.x), y: clean(box.y), width: clean(box.width), height: clean(box.height) };
      const computed = getComputedStyle(el);
      styles[selector] = Object.fromEntries(styleProps.map(prop => [prop, computed.getPropertyValue(prop)]));
    }
    return {
      title: document.title,
      boxes,
      styles,
      buttons: [...document.querySelectorAll('.map-ctrl-btn')].map(el => ({ id: el.id, text: el.textContent.trim() })),
      groups: [...document.querySelectorAll('#scada-ui-container .key-title')].map(el => el.textContent.trim()),
      checkboxes: document.querySelectorAll('#scada-ui-container input[type="checkbox"]').length,
      radios: document.querySelectorAll('#scada-ui-container input[type="radio"]').length,
      searchPlaceholder: document.querySelector('#search-input')?.getAttribute('placeholder') || '',
      brand: document.querySelector('.ventus-main')?.textContent.trim() || '',
      bodyClass: document.body.className
    };
  }, { structuralSelectors, styleProps });
}

function compareSnapshots(oracle, candidate, viewport) {
  const errors = [];
  const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  if (!sameJson(oracle.buttons, candidate.buttons)) errors.push(`${viewport}: map control contract differs`);
  if (!sameJson(oracle.groups, candidate.groups)) errors.push(`${viewport}: layer group contract differs`);
  if (oracle.checkboxes !== candidate.checkboxes) errors.push(`${viewport}: checkbox count ${candidate.checkboxes} != ${oracle.checkboxes}`);
  if (oracle.radios !== candidate.radios) errors.push(`${viewport}: basemap radio count ${candidate.radios} != ${oracle.radios}`);
  if (oracle.searchPlaceholder !== candidate.searchPlaceholder) errors.push(`${viewport}: search placeholder differs`);
  if (oracle.brand !== candidate.brand) errors.push(`${viewport}: brand differs`);
  for (const selector of structuralSelectors) {
    const a = oracle.boxes[selector];
    const b = candidate.boxes[selector];
    if ((a === null) !== (b === null)) {
      errors.push(`${viewport}: selector presence differs: ${selector}`);
      continue;
    }
    if (!a || !b) continue;
    for (const key of ['x', 'y', 'width', 'height']) {
      if (Math.abs(a[key] - b[key]) > 1.5) errors.push(`${viewport}: ${selector} ${key} ${b[key]} != ${a[key]}`);
    }
    for (const prop of styleProps) {
      if (oracle.styles[selector]?.[prop] !== candidate.styles[selector]?.[prop]) {
        errors.push(`${viewport}: ${selector} style ${prop} differs`);
      }
    }
  }
  return errors;
}

async function testBridge(page) {
  requireCondition(await page.evaluate(() => Boolean(window.__GRIDATLAS_V9_BRIDGE__)), 'V9 Parquet bridge missing');
  const toggle = async id => {
    const selector = `#scada-ui-container input[data-layer-id="${id}"]`;
    await page.locator(selector).check();
    await page.waitForFunction(layerId => {
      const text = document.querySelector(`#lbl-${layerId}`)?.textContent || '';
      return /\[(?:OK|\d+)/.test(text) && !text.includes('[FAIL]');
    }, id, { timeout: 60000 });
  };
  await toggle('400');
  await toggle('dc');
  await toggle('solar');
  const bridge = await page.evaluate(() => window.__GRIDATLAS_V9_BRIDGE__);
  requireCondition(bridge.intercepted >= 3, 'bridge did not intercept V8 data loads');
  requireCondition(Object.keys(bridge.loaded || {}).length >= 3, 'bridge did not hydrate sentinel sources');
  requireCondition((bridge.failures || []).length === 0, `bridge failures: ${JSON.stringify(bridge.failures)}`);

  await page.fill('#search-input', 'Beacon');
  await page.click('#search-btn');
  await page.waitForTimeout(250);
  requireCondition(await page.locator('#search-results').isVisible(), 'V8 project search results did not open');
  requireCondition(await page.locator('#search-results .search-result-item').count() > 0, 'V8 project search returned no Beacon result');

  for (const id of ['btn-export', 'btn-radius', 'btn-radius-area', 'btn-zonedraw', 'btn-status', 'btn-measure', 'btn-fullscreen']) {
    requireCondition(await page.locator(`#${id}`).count() === 1, `missing V8 control ${id}`);
  }
  return bridge;
}

const browser = await chromium.launch({ headless: true });
const proof = {
  schema: 'gridatlas.v8-product-parity-proof.v1',
  classification: 'REJECTED',
  oracle: oracleUrl,
  candidate: candidateUrl,
  viewports: {},
  bridge: null,
  errors: []
};
try {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    const oraclePage = await browser.newPage({ viewport });
    const candidatePage = await browser.newPage({ viewport });
    await Promise.all([
      oraclePage.goto(oracleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }),
      candidatePage.goto(candidateUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    ]);
    await Promise.all([ready(oraclePage), ready(candidatePage)]);
    const [oracle, candidate] = await Promise.all([snapshot(oraclePage), snapshot(candidatePage)]);
    const errors = compareSnapshots(oracle, candidate, viewport.name);
    proof.viewports[viewport.name] = { oracle, candidate, errors };
    proof.errors.push(...errors);
    await oraclePage.close();
    if (viewport.name === 'desktop') proof.bridge = await testBridge(candidatePage);
    await candidatePage.close();
  }
  requireCondition(proof.errors.length === 0, proof.errors.join('\n'));
  proof.classification = 'VERIFIED_V8_PRODUCT_MIRROR_ON_V9_DATA_PLANE';
} finally {
  await browser.close();
  await fs.mkdir(new URL('.', `file://${process.cwd()}/${output}`).pathname, { recursive: true }).catch(() => {});
  await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n');
}

console.log(JSON.stringify({ classification: proof.classification, errors: proof.errors.length, bridgeSources: Object.keys(proof.bridge?.loaded || {}).length }));
