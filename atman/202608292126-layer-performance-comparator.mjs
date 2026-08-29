import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const contractPath = process.env.CONTRACT || 'contracts/202608292126-map-ready-runtime.json';
const candidateUrl = process.env.CANDIDATE_URL;
const oracleUrl = process.env.ORACLE_URL;
const mode = process.env.MODE || 'local';
const output = process.env.OUTPUT || `work/202608292126-${mode}-map-ready-proof.json`;
const recordOutput = process.env.RECORD_OUTPUT || `work/202608292126-${mode}-layer-performance.jsonl`;
const localProofPath = process.env.LOCAL_PROOF || '';

const requireCondition = (condition, message) => {
  if (!condition) throw new Error(message);
};
const canonical = value => JSON.stringify(value, Object.keys(value || {}).sort());
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blobSha1 = bytes => crypto
  .createHash('sha1')
  .update(Buffer.from(`blob ${bytes.length}\0`))
  .update(bytes)
  .digest('hex');
const round = value => Math.round(Number(value) * 100) / 100;

requireCondition(candidateUrl, 'CANDIDATE_URL is required');
requireCondition(oracleUrl, 'ORACLE_URL is required');
requireCondition(['local', 'public'].includes(mode), `unsupported MODE: ${mode}`);

const contract = JSON.parse(await fs.readFile(contractPath, 'utf8'));
requireCondition(contract.schema === 'gridatlas.map-ready-runtime-contract.v1', 'contract schema mismatch');
const thresholds = contract.performance_gates[mode];
const sampleCount = Number(thresholds.cold_samples);
const injectedBefore = '<script src="202608292126-map-ready-fetch-bridge.js"></script>\n<script src="202608291818-place-postcode-search.js"></script>\n\n';
const injectedAfter = '\n<script src="202608292126-pre-snapped-config-adapter.js"></script>';

async function fetchBytes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  requireCondition(response.ok, `${url} HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function byteAndManifestProof() {
  const [oracleIndex, oracleCss, oracleEngine, candidateIndex, candidateCss, candidateEngine] = await Promise.all([
    fetchBytes(new URL('index.html', oracleUrl)),
    fetchBytes(new URL('ventusv8.css', oracleUrl)),
    fetchBytes(new URL('ventus-corev8engine.js', oracleUrl)),
    fetchBytes(new URL('index.html', candidateUrl)),
    fetchBytes(new URL('ventusv8.css', candidateUrl)),
    fetchBytes(new URL('ventus-corev8engine.js', candidateUrl))
  ]);

  requireCondition(blobSha1(oracleIndex) === contract.product_oracle.index_blob_sha1, 'oracle index Git blob mismatch');
  requireCondition(blobSha1(oracleCss) === contract.product_oracle.css_blob_sha1, 'oracle CSS Git blob mismatch');
  requireCondition(blobSha1(oracleEngine) === contract.product_oracle.engine_blob_sha1, 'oracle engine Git blob mismatch');
  requireCondition(candidateCss.equals(oracleCss), 'candidate CSS is not V8 byte-identical');
  requireCondition(candidateEngine.equals(oracleEngine), 'candidate engine is not V8 byte-identical');

  const candidateText = candidateIndex.toString('utf8');
  requireCondition(candidateText.includes(injectedBefore), 'candidate pre-engine adapters missing');
  requireCondition(candidateText.includes(injectedAfter), 'candidate post-engine adapter missing');
  requireCondition(
    candidateText.replace(injectedBefore, '').replace(injectedAfter, '') === oracleIndex.toString('utf8'),
    'candidate HTML contains an unapproved V8 delta'
  );

  const [mapReadyResponse, releaseResponse, buildResponse] = await Promise.all([
    fetch(new URL('map-ready-manifest.json', candidateUrl), { cache: 'no-store' }),
    fetch(new URL('release-manifest.json', candidateUrl), { cache: 'no-store' }),
    fetch(new URL('build-manifest.json', candidateUrl), { cache: 'no-store' })
  ]);
  requireCondition(mapReadyResponse.ok && releaseResponse.ok && buildResponse.ok, 'candidate manifests unavailable');
  const [mapReady, release, build] = await Promise.all([
    mapReadyResponse.json(), releaseResponse.json(), buildResponse.json()
  ]);
  requireCondition(mapReady.schema === 'gridatlas.map-ready-cartridge-manifest.v1', 'map-ready manifest schema mismatch');
  requireCondition(mapReady.classification === 'DETERMINISTIC_MAP_READY_CARTRIDGES', 'map-ready manifest classification mismatch');
  requireCondition(mapReady.closure.cartridges === 11, 'map-ready cartridge closure mismatch');
  requireCondition(mapReady.closure.critical_400kv_rows === 4106, '400kV map-ready row closure mismatch');
  requireCondition(mapReady.architecture.preload_browser_duckdb === false, 'map-ready manifest still permits preload DuckDB');
  requireCondition(mapReady.architecture.serialized_preload_queue === false, 'serialized preload queue still declared');
  requireCondition(mapReady.architecture.topology_pre_snapped === true, 'topology is not declared pre-snapped');
  requireCondition(release.schema === 'gridatlas.v8-map-ready-release.v1', 'release manifest schema mismatch');
  requireCondition(release.release_id === contract.release_id, 'release id mismatch');
  requireCondition(build.schema === 'gridatlas.map-ready-build-manifest.v1', 'build manifest schema mismatch');

  const critical = mapReady.cartridges.find(item => item.source_id === 'grid_400kv');
  requireCondition(critical?.rows === 4106, '400kV cartridge record mismatch');
  requireCondition(critical?.pre_snapped === true, '400kV cartridge is not pre-snapped');
  requireCondition(critical?.critical === true, '400kV cartridge is not critical-prefetched');

  return {
    oracle: {
      index_blob_sha1: blobSha1(oracleIndex),
      css_blob_sha1: blobSha1(oracleCss),
      engine_blob_sha1: blobSha1(oracleEngine)
    },
    candidate: {
      html_delta: 'THREE_EXPLICIT_INVISIBLE_ADAPTER_TAGS_ONLY',
      css_byte_identical: true,
      engine_byte_identical: true,
      map_ready_manifest_sha256: sha256(Buffer.from(JSON.stringify(mapReady))),
      release_manifest: release,
      build_manifest: build,
      map_ready_manifest: mapReady
    }
  };
}

async function configurePage(page, isolateNonCritical) {
  await page.addInitScript(() => {
    let assigned;
    const wrap = value => {
      try {
        if (value?.Map && !value.__atmanMapCapture) {
          const NativeMap = value.Map;
          value.Map = new Proxy(NativeMap, {
            construct(target, args, newTarget) {
              const instance = Reflect.construct(target, args, newTarget);
              window.__ATMAN_MAP__ = instance;
              return instance;
            }
          });
          value.__atmanMapCapture = true;
        }
      } catch {
        // The product's own map-capture adapter remains a second evidence path.
      }
      return value;
    };
    try {
      Object.defineProperty(window, 'maplibregl', {
        configurable: true,
        enumerable: true,
        get() { return assigned; },
        set(value) { assigned = wrap(value); }
      });
    } catch {
      // Existing global property; product capture still works for the candidate.
    }
  });

  await page.route(
    url => url.toString().includes('basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'),
    route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 8,
        name: 'Atman deterministic blank',
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000000' } }]
      })
    })
  );

  if (isolateNonCritical) {
    await page.route(
      url => {
        const value = url.toString();
        if (!value.startsWith('http://127.0.0.1:')) return false;
        if (!/\/data\/[^/?]+\.geojson(?:[?#].*)?$/i.test(value)) return false;
        return !/\/data\/(?:grid_400kv|grid_substations)\.geojson(?:[?#].*)?$/i.test(value);
      },
      route => route.fulfill({
        status: 200,
        contentType: 'application/geo+json',
        body: '{"type":"FeatureCollection","features":[]}'
      })
    );
  }
}

async function waitForUi(page) {
  await page.waitForSelector('.dashboard', { timeout: 60000 });
  await page.waitForSelector('#scada-ui-container input[data-layer-id="400"]', { timeout: 60000 });
  await page.waitForSelector('#map canvas', { timeout: 60000 });
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(
    () => requestAnimationFrame(resolve)
  )));
}

async function runColdSample(browser, url, subject, sampleNumber) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await configurePage(page, mode === 'local');

  const requests = [];
  const errors = [];
  const navigationEpoch = Date.now();
  page.on('request', request => requests.push({ url: request.url(), at_ms: Date.now() - navigationEpoch }));
  page.on('pageerror', error => errors.push(`pageerror:${String(error?.message || error)}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console:${message.text()}`);
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForUi(page);
    const uiReadyMs = await page.evaluate(() => performance.now());
    const checkbox = page.locator('#scada-ui-container input[data-layer-id="400"]');
    const label = page.locator('#lbl-400');

    await page.evaluate(() => { window.__ATMAN_400_CLICK_START__ = performance.now(); });
    await checkbox.check();
    await page.waitForFunction(() => {
      const text = document.querySelector('#lbl-400')?.textContent || '';
      return text.includes('[OK]');
    }, null, { timeout: 90000 });
    await twoFrames(page);

    const timing = await page.evaluate(() => ({
      ready_ms: performance.now(),
      click_start_ms: window.__ATMAN_400_CLICK_START__
    }));
    const readyEpoch = Date.now() - navigationEpoch;
    const clickToReadyMs = Math.max(0, timing.ready_ms - timing.click_start_ms);

    await checkbox.uncheck();
    await twoFrames(page);
    await page.evaluate(() => { window.__ATMAN_400_WARM_START__ = performance.now(); });
    await checkbox.check();
    await twoFrames(page);
    const warmToggleMs = await page.evaluate(
      () => performance.now() - window.__ATMAN_400_WARM_START__
    );

    const runtime = await page.evaluate(() => {
      const map = window.__GRIDATLAS_V9_MAP__ || window.__ATMAN_MAP__ || null;
      let sourceRows = null;
      let visibility = null;
      try {
        const source = map?.getSource?.('src-400');
        sourceRows = Array.isArray(source?._data?.features) ? source._data.features.length : null;
        visibility = map?.getLayoutProperty?.('l-400', 'visibility') ?? null;
      } catch {
        // Evidence remains null and fails the candidate gate.
      }
      const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
      return {
        label: document.querySelector('#lbl-400')?.textContent || '',
        checked: document.querySelector('#scada-ui-container input[data-layer-id="400"]')?.checked || false,
        source_rows: sourceRows,
        visibility,
        bridge: clone(window.__GRIDATLAS_MAP_READY__),
        config_adapter: clone(window.__GRIDATLAS_PRE_SNAPPED_CONFIG__)
      };
    });

    const requestsBeforeReady = requests.filter(item => item.at_ms <= readyEpoch + 5);
    const duckdbBeforeReady = requestsBeforeReady
      .filter(item => /duckdb|@duckdb/i.test(item.url))
      .map(item => item.url);
    const parquetBeforeReady = requestsBeforeReady
      .filter(item => /\.parquet(?:[?#]|$)/i.test(item.url))
      .map(item => item.url);
    const criticalRequests = requestsBeforeReady
      .filter(item => /grid_400kv\.geojson(?:[?#]|$)/i.test(item.url))
      .map(item => item.url);

    return {
      subject,
      sample: sampleNumber,
      ui_ready_ms: round(uiReadyMs),
      preload_ready_ms: round(timing.ready_ms),
      click_to_ready_ms: round(clickToReadyMs),
      warm_toggle_ms: round(warmToggleMs),
      requests_before_ready: requestsBeforeReady.length,
      critical_requests: criticalRequests,
      duckdb_requests_before_ready: duckdbBeforeReady,
      parquet_requests_before_ready: parquetBeforeReady,
      runtime,
      errors
    };
  } finally {
    await context.close();
  }
}

function metric(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => {
    if (!sorted.length) return null;
    return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1))];
  };
  return {
    samples: sorted.length,
    min_ms: round(sorted[0]),
    p50_ms: round(percentile(0.50)),
    p95_ms: round(percentile(0.95)),
    max_ms: round(sorted.at(-1)),
    mean_ms: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    raw_ms: sorted.map(round)
  };
}

async function runSubjectSamples(browser, url, subject) {
  const samples = [];
  for (let index = 1; index <= sampleCount; index += 1) {
    samples.push(await runColdSample(browser, url, subject, index));
  }
  return {
    samples,
    click_to_ready: metric(samples.map(item => item.click_to_ready_ms)),
    preload_ready: metric(samples.map(item => item.preload_ready_ms)),
    warm_toggle: metric(samples.map(item => item.warm_toggle_ms))
  };
}

const selectors = [
  '.dashboard', '.hud-header', '.map-container', '.scada-wrapper', '.scada-brand',
  '.status-legend', '#scada-ui-container', '.search-bar-wrapper', '.map-controls',
  '#radius-popup', '#radius-area-popup', '#zonedraw-display', '#measure-display',
  '#polyzone-display', '#fs-curtain', '#fs-letterhead', '#btn-fullscreen',
  '#btn-fullscreen-exit'
];
const styleProperties = [
  'display', 'position', 'font-family', 'font-size', 'font-weight', 'color',
  'background-color', 'border-top-width', 'border-right-width',
  'border-bottom-width', 'border-left-width', 'border-radius', 'padding-top',
  'padding-right', 'padding-bottom', 'padding-left', 'gap',
  'grid-template-columns', 'flex-direction', 'overflow', 'z-index'
];
const pixelRegions = [
  '.hud-header',
  '.search-bar-wrapper',
  '.map-controls',
  '.scada-brand',
  '.status-legend',
  '.disclaimer-box'
];

async function snapshot(page) {
  return page.evaluate(({ selectors, styleProperties }) => {
    const rounded = value => Math.round(Number(value) * 10) / 10;
    const boxes = {};
    const computed = {};
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element) {
        boxes[selector] = null;
        computed[selector] = null;
        continue;
      }
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      boxes[selector] = {
        x: rounded(box.x),
        y: rounded(box.y),
        width: rounded(box.width),
        height: rounded(box.height)
      };
      computed[selector] = Object.fromEntries(
        styleProperties.map(property => [property, style.getPropertyValue(property)])
      );
    }
    return {
      boxes,
      computed,
      controls: [...document.querySelectorAll('.map-ctrl-btn')]
        .map(element => ({ id: element.id, text: element.textContent.trim() })),
      groups: [...document.querySelectorAll('#scada-ui-container .key-title')]
        .map(element => element.textContent.trim()),
      labels: [...document.querySelectorAll('#scada-ui-container span[data-base-label]')]
        .map(element => ({
          id: element.id,
          base: element.getAttribute('data-base-label'),
          color: getComputedStyle(element).color
        })),
      checkboxes: document.querySelectorAll('#scada-ui-container input[type="checkbox"]').length,
      radios: document.querySelectorAll('#scada-ui-container input[type="radio"]').length,
      placeholder: document.querySelector('#search-input')?.getAttribute('placeholder') || '',
      brand: document.querySelector('.ventus-main')?.textContent.trim() || ''
    };
  }, { selectors, styleProperties });
}

function compareSnapshots(oracle, candidate, viewport) {
  const errors = [];
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  for (const [name, left, right] of [
    ['controls', oracle.controls, candidate.controls],
    ['groups', oracle.groups, candidate.groups],
    ['labels/order/colours', oracle.labels, candidate.labels]
  ]) {
    if (!same(left, right)) errors.push(`${viewport}: ${name} differ`);
  }
  if (oracle.checkboxes !== candidate.checkboxes) errors.push(`${viewport}: checkbox count differs`);
  if (oracle.radios !== candidate.radios) errors.push(`${viewport}: radio count differs`);
  if (oracle.brand !== candidate.brand) errors.push(`${viewport}: brand differs`);
  if (oracle.placeholder !== 'Search project name...') errors.push(`${viewport}: oracle placeholder drift`);
  if (candidate.placeholder !== 'Search project, place or postcode...') errors.push(`${viewport}: candidate place-search placeholder missing`);

  for (const selector of selectors) {
    const left = oracle.boxes[selector];
    const right = candidate.boxes[selector];
    if ((left === null) !== (right === null)) {
      errors.push(`${viewport}: selector presence differs ${selector}`);
      continue;
    }
    if (!left || !right) continue;
    for (const property of ['x', 'y', 'width', 'height']) {
      if (Math.abs(left[property] - right[property]) > 1) {
        errors.push(`${viewport}: ${selector} ${property} differs`);
      }
    }
    for (const property of styleProperties) {
      if (oracle.computed[selector]?.[property] !== candidate.computed[selector]?.[property]) {
        errors.push(`${viewport}: ${selector} ${property} differs`);
      }
    }
  }
  return errors;
}

async function normalisePixels(page) {
  await page.addStyleTag({
    content: `
      *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
      #map{visibility:hidden!important}
    `
  });
  await page.evaluate(() => {
    for (const [id, value] of [['clock', '12:34:56'], ['date', '29/08/2026'], ['days', '8525 DAYS']]) {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    }
    const input = document.getElementById('search-input');
    if (input) {
      input.value = '';
      input.setAttribute('placeholder', '');
      input.blur();
    }
    const results = document.getElementById('search-results');
    if (results) {
      results.innerHTML = '';
      results.style.display = 'none';
    }
    document.querySelectorAll('input[type="checkbox"]').forEach(element => { element.checked = false; });
    document.querySelectorAll('input[type="radio"][value="dark"]').forEach(element => { element.checked = true; });
    document.querySelectorAll('.map-ctrl-btn').forEach(element => element.classList.remove('active'));
    for (const id of ['radius-popup', 'radius-area-popup', 'zonedraw-display', 'measure-display', 'polyzone-display']) {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    }
  });
  await page.waitForTimeout(100);
}

function decodedPixelProof(leftBytes, rightBytes, selector) {
  const left = PNG.sync.read(leftBytes);
  const right = PNG.sync.read(rightBytes);
  requireCondition(left.width === right.width && left.height === right.height, `pixel dimensions differ: ${selector}`);
  requireCondition(Buffer.from(left.data).equals(Buffer.from(right.data)), `decoded pixels differ: ${selector}`);
  return {
    identical: true,
    width: left.width,
    height: left.height,
    rgba_sha256: sha256(Buffer.from(left.data))
  };
}

async function interactionState(page, id) {
  return page.evaluate(controlId => {
    const display = selector => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display : null;
    };
    return {
      active: document.getElementById(controlId)?.classList.contains('active') || false,
      radius: display('#radius-popup'),
      radius_area: display('#radius-area-popup'),
      zone: display('#zonedraw-display'),
      measure: display('#measure-display'),
      map_container_class: document.getElementById('map-container')?.className || '',
      body_class: document.body.className
    };
  }, id);
}

async function pairParity(browser, viewport) {
  const oracleContext = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const candidateContext = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const oraclePage = await oracleContext.newPage();
  const candidatePage = await candidateContext.newPage();
  await Promise.all([
    configurePage(oraclePage, mode === 'local'),
    configurePage(candidatePage, mode === 'local')
  ]);

  try {
    await Promise.all([
      oraclePage.goto(oracleUrl, { waitUntil: 'domcontentloaded', timeout: 90000 }),
      candidatePage.goto(candidateUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
    ]);
    await Promise.all([waitForUi(oraclePage), waitForUi(candidatePage)]);
    const [oracleSnapshot, candidateSnapshot] = await Promise.all([
      snapshot(oraclePage),
      snapshot(candidatePage)
    ]);
    const errors = compareSnapshots(oracleSnapshot, candidateSnapshot, `${viewport.width}x${viewport.height}`);
    requireCondition(errors.length === 0, errors.join('\n'));

    const interactions = {};
    for (const id of ['btn-radius', 'btn-radius-area', 'btn-zonedraw', 'btn-status', 'btn-measure']) {
      await Promise.all([oraclePage.click(`#${id}`), candidatePage.click(`#${id}`)]);
      const [left, right] = await Promise.all([
        interactionState(oraclePage, id),
        interactionState(candidatePage, id)
      ]);
      requireCondition(JSON.stringify(left) === JSON.stringify(right), `interaction differs after ${id}`);
      interactions[id] = right;
      await Promise.all([oraclePage.click(`#${id}`), candidatePage.click(`#${id}`)]);
    }

    await Promise.all([normalisePixels(oraclePage), normalisePixels(candidatePage)]);
    const pixels = {};
    for (const selector of pixelRegions) {
      const [left, right] = await Promise.all([
        oraclePage.locator(selector).screenshot({ animations: 'disabled' }),
        candidatePage.locator(selector).screenshot({ animations: 'disabled' })
      ]);
      pixels[selector] = decodedPixelProof(left, right, selector);
    }

    const adapter = await candidatePage.evaluate(() => JSON.parse(JSON.stringify(
      window.__GRIDATLAS_PRE_SNAPPED_CONFIG__ || null
    )));
    requireCondition(adapter?.applied === true, 'pre-snapped config adapter did not apply');
    requireCondition(
      JSON.stringify([...adapter.changed_layer_ids].sort()) === JSON.stringify(['132', '220', '275', '400', '66']),
      'pre-snapped config adapter layer closure mismatch'
    );
    requireCondition((adapter.failures || []).length === 0, 'pre-snapped config adapter reported failures');

    return {
      viewport,
      structure_and_geometry_identical: true,
      computed_styles_identical: true,
      decoded_pixels_identical: true,
      pixels,
      interactions,
      permitted_placeholder_delta: true,
      adapter
    };
  } finally {
    await Promise.all([oracleContext.close(), candidateContext.close()]);
  }
}

function gate(id, passed, observed, threshold, importance = 'promotion') {
  return { id, passed: Boolean(passed), observed, threshold, importance };
}

function candidateArchitectureGates(samples) {
  const results = [];
  for (const sample of samples) {
    const bridge = sample.runtime.bridge;
    const adapter = sample.runtime.config_adapter;
    results.push(
      gate(`sample-${sample.sample}-no-duckdb-before-400-ready`,
        sample.duckdb_requests_before_ready.length === 0 && bridge?.duckdb_runtime_started === false,
        {
          network_requests: sample.duckdb_requests_before_ready,
          runtime_started: bridge?.duckdb_runtime_started ?? null
        },
        { network_requests: 0, runtime_started: false }),
      gate(`sample-${sample.sample}-no-parquet-before-400-ready`,
        sample.parquet_requests_before_ready.length === 0 && Number(bridge?.parquet_requests || 0) === 0,
        {
          network_requests: sample.parquet_requests_before_ready,
          bridge_requests: bridge?.parquet_requests ?? null
        },
        { network_requests: 0, bridge_requests: 0 }),
      gate(`sample-${sample.sample}-critical-prefetch-used`,
        Number(bridge?.critical_prefetch?.hits || 0) >= 1 &&
          Number(bridge?.critical_prefetch?.bytes || 0) > 0,
        {
          hits: bridge?.critical_prefetch?.hits ?? null,
          bytes: bridge?.critical_prefetch?.bytes ?? null,
          failures: bridge?.critical_prefetch?.failures ?? null
        },
        { hits_min: 1, bytes_min: 1, failures: 0 }),
      gate(`sample-${sample.sample}-400kv-source-row-closure`,
        sample.runtime.source_rows === 4106,
        sample.runtime.source_rows,
        4106),
      gate(`sample-${sample.sample}-pre-snapped-adapter-applied`,
        adapter?.applied === true &&
          JSON.stringify([...(adapter?.changed_layer_ids || [])].sort()) ===
            JSON.stringify(['132', '220', '275', '400', '66']) &&
          (adapter?.failures || []).length === 0,
        adapter,
        { applied: true, changed_layer_ids: ['132', '220', '275', '400', '66'], failures: 0 }),
      gate(`sample-${sample.sample}-no-runtime-errors`,
        sample.errors.filter(value => /\[LAYER FAILED\]|Uncaught|CRITICAL ERROR/i.test(value)).length === 0,
        sample.errors,
        { fatal_errors: 0 })
    );
  }
  return results;
}

function performanceGates(candidate, oracle) {
  const candidateP95 = candidate.click_to_ready.p95_ms;
  const oracleP95 = oracle.click_to_ready.p95_ms;
  const ratioLimit = Number(thresholds.candidate_click_to_ready_p95_vs_oracle_ratio_max);
  const slack = Number(thresholds.candidate_click_to_ready_slack_ms);
  return [
    gate(
      `${mode}-400kv-click-p95-absolute`,
      candidateP95 <= Number(thresholds.candidate_click_to_ready_p95_max_ms),
      candidateP95,
      Number(thresholds.candidate_click_to_ready_p95_max_ms)
    ),
    gate(
      `${mode}-400kv-click-p95-vs-v8`,
      candidateP95 <= oracleP95 * ratioLimit + slack,
      { candidate_p95_ms: candidateP95, oracle_p95_ms: oracleP95 },
      { ratio_max: ratioLimit, slack_ms: slack }
    ),
    gate(
      `${mode}-400kv-warm-toggle-p95`,
      candidate.warm_toggle.p95_ms <= Number(thresholds.candidate_warm_toggle_p95_max_ms),
      candidate.warm_toggle.p95_ms,
      Number(thresholds.candidate_warm_toggle_p95_max_ms)
    )
  ];
}

function validateMlRecord(record) {
  requireCondition(record.schema === 'gridatlas.ml.layer-performance-record.v1', 'ML record schema mismatch');
  requireCondition(['PROMOTE', 'REJECT'].includes(record.label), 'ML record label mismatch');
  requireCondition(record.privacy === 'NO_PERSONAL_DATA', 'ML record privacy contract mismatch');
  requireCondition(record.task === 'binary_release_promotion', 'ML record task mismatch');
  requireCondition(Array.isArray(record.gates) && record.gates.length > 0, 'ML record gates missing');
  requireCondition(record.provenance?.candidate_release_id === contract.release_id, 'ML record candidate provenance mismatch');
}

const proof = {
  schema: 'gridatlas.map-ready-layer-comparator-proof.v1',
  classification: 'REJECTED',
  mode,
  generation: contract.generation,
  candidate_url: candidateUrl,
  oracle_url: oracleUrl,
  contract_sha256: sha256(await fs.readFile(contractPath)),
  bytes_and_manifests: null,
  parity: {},
  benchmark: null,
  gates: [],
  errors: []
};

let browser;
let record;
try {
  proof.bytes_and_manifests = await byteAndManifestProof();
  browser = await chromium.launch({ headless: true });

  proof.parity.desktop = await pairParity(browser, { width: 1440, height: 900 });
  proof.parity.mobile = await pairParity(browser, { width: 390, height: 844 });

  const oracleBenchmark = await runSubjectSamples(browser, oracleUrl, 'v8_oracle');
  const candidateBenchmark = await runSubjectSamples(browser, candidateUrl, 'v9_map_ready');
  proof.benchmark = { oracle: oracleBenchmark, candidate: candidateBenchmark };

  const gates = [
    gate('v8-css-byte-identity', proof.bytes_and_manifests.candidate.css_byte_identical, true, true),
    gate('v8-engine-byte-identity', proof.bytes_and_manifests.candidate.engine_byte_identical, true, true),
    gate('desktop-product-parity', proof.parity.desktop.decoded_pixels_identical, true, true),
    gate('mobile-product-parity', proof.parity.mobile.decoded_pixels_identical, true, true),
    gate('map-ready-cartridge-closure',
      proof.bytes_and_manifests.candidate.map_ready_manifest.closure.cartridges === 11,
      proof.bytes_and_manifests.candidate.map_ready_manifest.closure.cartridges,
      11),
    ...candidateArchitectureGates(candidateBenchmark.samples),
    ...performanceGates(candidateBenchmark, oracleBenchmark)
  ];
  proof.gates = gates;
  const failed = gates.filter(item => !item.passed);
  requireCondition(failed.length === 0, `promotion gates failed: ${failed.map(item => item.id).join(', ')}`);

  let localEvidence = null;
  if (mode === 'public') {
    requireCondition(localProofPath, 'LOCAL_PROOF is required for public comparator');
    const localProof = JSON.parse(await fs.readFile(localProofPath, 'utf8'));
    requireCondition(
      localProof.classification === 'VERIFIED_LOCAL_MAP_READY_400KV_REGRESSION_CLOSED',
      'local comparator proof is not green'
    );
    requireCondition(localProof.generation === contract.generation, 'local proof generation mismatch');
    localEvidence = {
      classification: localProof.classification,
      proof_sha256: sha256(await fs.readFile(localProofPath)),
      candidate_click_to_ready: localProof.benchmark.candidate.click_to_ready,
      oracle_click_to_ready: localProof.benchmark.oracle.click_to_ready,
      gates: localProof.gates
    };
  }

  proof.classification = mode === 'local'
    ? 'VERIFIED_LOCAL_MAP_READY_400KV_REGRESSION_CLOSED'
    : 'VERIFIED_PUBLIC_MAP_READY_400KV_REGRESSION_CLOSED';

  record = {
    schema: 'gridatlas.ml.layer-performance-record.v1',
    record_id: `${contract.generation}:${mode}:400kv`,
    generation: contract.generation,
    stage: mode,
    observed_at: new Date().toISOString(),
    task: contract.machine_learning_record.task,
    label: 'PROMOTE',
    privacy: contract.machine_learning_record.privacy,
    provenance: {
      candidate_release_id: contract.release_id,
      parent_release_id: contract.parent_release_id,
      candidate_url: candidateUrl,
      oracle_repository: contract.product_oracle.repository,
      oracle_commit: contract.product_oracle.commit,
      oracle_url: oracleUrl,
      data_repository: contract.data_plane.repository,
      data_commit: contract.data_plane.commit,
      data_release_id: contract.data_plane.release_id,
      data_manifest_sha256: contract.data_plane.manifest_sha256,
      contract_sha256: proof.contract_sha256
    },
    architecture_features: {
      map_ready_cartridges: 11,
      critical_400kv_prefetch: true,
      topology_pre_snapped: true,
      topology_snap_bypass_layers: contract.topology_snap_bypass_layer_ids,
      browser_duckdb_before_400kv_ready: false,
      serialized_preload_queue: false,
      analytical_search_duckdb_retained: true,
      v8_css_byte_identical: true,
      v8_engine_byte_identical: true
    },
    measurements: {
      oracle: {
        click_to_ready: oracleBenchmark.click_to_ready,
        preload_ready: oracleBenchmark.preload_ready,
        warm_toggle: oracleBenchmark.warm_toggle
      },
      candidate: {
        click_to_ready: candidateBenchmark.click_to_ready,
        preload_ready: candidateBenchmark.preload_ready,
        warm_toggle: candidateBenchmark.warm_toggle
      },
      derived: {
        p95_delta_ms: round(candidateBenchmark.click_to_ready.p95_ms - oracleBenchmark.click_to_ready.p95_ms),
        p95_ratio: oracleBenchmark.click_to_ready.p95_ms === 0
          ? null
          : round(candidateBenchmark.click_to_ready.p95_ms / oracleBenchmark.click_to_ready.p95_ms)
      }
    },
    local_evidence: localEvidence,
    gates
  };
  validateMlRecord(record);
} catch (error) {
  proof.errors.push(String(error?.stack || error));
  proof.classification = 'REJECTED';
  record = {
    schema: 'gridatlas.ml.layer-performance-record.v1',
    record_id: `${contract.generation}:${mode}:400kv`,
    generation: contract.generation,
    stage: mode,
    observed_at: new Date().toISOString(),
    task: contract.machine_learning_record.task,
    label: 'REJECT',
    privacy: contract.machine_learning_record.privacy,
    provenance: {
      candidate_release_id: contract.release_id,
      parent_release_id: contract.parent_release_id,
      candidate_url: candidateUrl,
      oracle_repository: contract.product_oracle.repository,
      oracle_commit: contract.product_oracle.commit,
      oracle_url: oracleUrl,
      data_repository: contract.data_plane.repository,
      data_commit: contract.data_plane.commit,
      data_release_id: contract.data_plane.release_id,
      data_manifest_sha256: contract.data_plane.manifest_sha256,
      contract_sha256: proof.contract_sha256
    },
    architecture_features: {},
    measurements: proof.benchmark,
    local_evidence: null,
    gates: proof.gates.length > 0
      ? proof.gates
      : [gate('comparator-execution', false, proof.errors, { errors: 0 })],
    errors: proof.errors
  };
  validateMlRecord(record);
  throw error;
} finally {
  if (browser) await browser.close();
  const outputParent = output.includes('/') ? output.slice(0, output.lastIndexOf('/')) : '.';
  const recordParent = recordOutput.includes('/') ? recordOutput.slice(0, recordOutput.lastIndexOf('/')) : '.';
  await fs.mkdir(outputParent, { recursive: true });
  await fs.mkdir(recordParent, { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(proof, null, 2)}\n`);
  await fs.writeFile(recordOutput, `${JSON.stringify(record)}\n`);
}

console.log(JSON.stringify({
  classification: proof.classification,
  mode,
  candidate_p95_ms: proof.benchmark?.candidate?.click_to_ready?.p95_ms ?? null,
  oracle_p95_ms: proof.benchmark?.oracle?.click_to_ready?.p95_ms ?? null,
  warm_p95_ms: proof.benchmark?.candidate?.warm_toggle?.p95_ms ?? null,
  gates: proof.gates.length
}));
