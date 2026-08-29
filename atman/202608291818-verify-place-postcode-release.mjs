import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const candidateUrl = process.env.CANDIDATE_URL || 'http://127.0.0.1:4173/202608291818-atlas-v9/';
const oracleUrl = process.env.ORACLE_URL || 'http://127.0.0.1:4174/';
const output = process.env.OUTPUT || 'work/202608291818-place-postcode-proof.json';

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const selectors = [
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
  await page.waitForSelector('.dashboard', { timeout: 45000 });
  await page.waitForSelector('#scada-ui-container .key-item', { timeout: 45000 });
  await page.waitForSelector('#map canvas', { timeout: 45000 });
}

async function snapshot(page, normaliseSearchPlaceholder = false) {
  if (normaliseSearchPlaceholder) {
    await page.evaluate(() => document.getElementById('search-input')?.setAttribute('placeholder', 'Search project name...'));
  }
  return page.evaluate(({ selectors, styleProps }) => {
    const clean = value => Math.round(Number(value) * 10) / 10;
    const boxes = {};
    const styles = {};
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) { boxes[selector] = null; styles[selector] = null; continue; }
      const box = el.getBoundingClientRect();
      const computed = getComputedStyle(el);
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
      brand: document.querySelector('.ventus-main')?.textContent.trim() || ''
    };
  }, { selectors, styleProps });
}

function assertStructuralParity(oracle, candidate, viewport) {
  requireCondition(JSON.stringify(oracle.controls) === JSON.stringify(candidate.controls), `${viewport}: V8 map controls changed`);
  requireCondition(JSON.stringify(oracle.group_titles) === JSON.stringify(candidate.group_titles), `${viewport}: V8 layer groups changed`);
  requireCondition(oracle.checkboxes === candidate.checkboxes, `${viewport}: V8 checkbox count changed`);
  requireCondition(oracle.radios === candidate.radios, `${viewport}: V8 basemap radios changed`);
  requireCondition(oracle.brand === candidate.brand, `${viewport}: Ventus brand changed`);
  for (const selector of selectors) {
    const a = oracle.boxes[selector];
    const b = candidate.boxes[selector];
    requireCondition((a === null) === (b === null), `${viewport}: selector presence changed ${selector}`);
    if (!a || !b) continue;
    for (const key of ['x', 'y', 'width', 'height']) {
      requireCondition(Math.abs(a[key] - b[key]) <= 1.0, `${viewport}: ${selector} ${key} changed ${b[key]} vs ${a[key]}`);
    }
    for (const prop of styleProps) {
      requireCondition(oracle.styles[selector]?.[prop] === candidate.styles[selector]?.[prop], `${viewport}: ${selector} style ${prop} changed`);
    }
  }
}

async function runSearch(page, query) {
  await page.fill('#search-input', query);
  await page.press('#search-input', 'Enter');
  await page.waitForFunction(expected => {
    const state = window.__GRIDATLAS_PLACE_SEARCH__;
    return state?.last_query === expected && Array.isArray(state.last_results);
  }, query.trim(), { timeout: 90000 });
  await page.waitForSelector('#search-results', { state: 'visible', timeout: 30000 });
  return page.evaluate(() => ({
    html: document.getElementById('search-results')?.innerHTML || '',
    count: document.querySelectorAll('#search-results .search-result-item').length,
    state: window.__GRIDATLAS_PLACE_SEARCH__
  }));
}

async function testSearch(page) {
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.ready === true, null, { timeout: 30000 });
  requireCondition(await page.getAttribute('#search-input', 'placeholder') === 'Search project, place or postcode...', 'search discoverability placeholder missing');

  const spaced = await runSearch(page, 'MK43 0ZY');
  requireCondition(spaced.count > 0, 'spaced postcode returned no results');
  requireCondition(/Prologis DC4 Marston Gate/i.test(spaced.html), 'spaced postcode missed golden project');
  requireCondition(/MK43 0ZY/i.test(spaced.html), 'spaced postcode not exposed in result');

  const compact = await runSearch(page, 'MK430ZY');
  requireCondition(compact.count > 0, 'compact postcode returned no results');
  requireCondition(/Prologis DC4 Marston Gate/i.test(compact.html), 'compact postcode missed golden project');

  const place = await runSearch(page, 'cranfield/marston bedfordshire');
  requireCondition(place.count > 0, 'slash place/county search returned no results');
  requireCondition(/Prologis DC4 Marston Gate/i.test(place.html), 'slash place/county search missed golden project');

  const county = await runSearch(page, 'Bedfordshire');
  requireCondition(county.count > 0, 'county search returned no results');

  const name = await runSearch(page, 'Beacon Fen');
  requireCondition(name.count > 0, 'existing project-name search regressed');
  requireCondition(/Beacon Fen/i.test(name.html), 'existing project-name search missed Beacon Fen');

  await runSearch(page, 'MK43 0ZY');
  const golden = page.locator('#search-results .search-result-item[data-repd-ref="16135"]');
  requireCondition(await golden.count() === 1, 'golden REPD 16135 result not uniquely identified');
  await golden.click();
  await page.waitForFunction(() => new URL(location.href).searchParams.get('repd_ref') === '16135', null, { timeout: 10000 });
  await page.waitForFunction(() => window.__GRIDATLAS_PLACE_SEARCH__?.last_selection?.repd_ref === '16135', null, { timeout: 10000 });
  const selected = await page.evaluate(() => ({
    search: window.__GRIDATLAS_PLACE_SEARCH__,
    url: location.href,
    center: window.__GRIDATLAS_V9_MAP__?.getCenter ? window.__GRIDATLAS_V9_MAP__.getCenter().toArray() : null
  }));
  requireCondition(selected.search.last_selection.mapped === true, 'golden postcode result did not map');
  requireCondition(selected.search.map_captured === true, 'MapLibre instance was not captured safely');
  requireCondition(selected.search.failures.length === 0, `place search failures: ${JSON.stringify(selected.search.failures)}`);
  requireCondition(selected.search.query_count >= 6, 'expected search queries did not execute through DuckDB');
  requireCondition(Array.isArray(selected.center), 'map center unavailable after selection');

  return selected;
}

async function testV9DataBridge(page) {
  for (const id of ['400', 'dc', 'solar']) {
    const checkbox = page.locator(`#scada-ui-container input[data-layer-id="${id}"]`);
    if (!(await checkbox.isChecked())) await checkbox.check();
    await page.waitForFunction(layerId => {
      const text = document.querySelector(`#lbl-${layerId}`)?.textContent || '';
      return /\[(?:OK|\d+)/.test(text) && !text.includes('[FAIL]');
    }, id, { timeout: 90000 });
  }
  const bridge = await page.evaluate(() => window.__GRIDATLAS_V9_BRIDGE__);
  requireCondition(bridge?.intercepted >= 3, 'V9 data bridge did not intercept sentinel V8 loads');
  requireCondition((bridge?.failures || []).length === 0, `V9 data bridge failures: ${JSON.stringify(bridge?.failures || [])}`);
  return bridge;
}

const browser = await chromium.launch({ headless: true });
const proof = {
  schema: 'gridatlas.place-postcode-release-proof.v1',
  classification: 'REJECTED',
  candidate: candidateUrl,
  oracle: oracleUrl,
  viewports: {},
  search: null,
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
    try {
      await Promise.all([
        oraclePage.goto(oracleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }),
        candidatePage.goto(candidateUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      ]);
      await Promise.all([ready(oraclePage), ready(candidatePage)]);
      const [oracleSnapshot, candidateSnapshot] = await Promise.all([
        snapshot(oraclePage), snapshot(candidatePage, true)
      ]);
      assertStructuralParity(oracleSnapshot, candidateSnapshot, viewport.name);
      proof.viewports[viewport.name] = { v8_structure_and_geometry_preserved: true };
      if (viewport.name === 'desktop') {
        proof.search = await testSearch(candidatePage);
        proof.bridge = await testV9DataBridge(candidatePage);
      }
    } finally {
      await oraclePage.close();
      await candidatePage.close();
    }
  }
  proof.classification = 'VERIFIED_V8_MIRROR_WITH_PLACE_POSTCODE_SEARCH';
} catch (error) {
  proof.errors.push(String(error?.stack || error));
  throw error;
} finally {
  await browser.close();
  const parent = output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.';
  await fs.mkdir(parent, { recursive: true });
  await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n');
}

console.log(JSON.stringify({ classification: proof.classification, query_count: proof.search?.search?.query_count || 0, bridge_sources: Object.keys(proof.bridge?.loaded || {}).length }));
