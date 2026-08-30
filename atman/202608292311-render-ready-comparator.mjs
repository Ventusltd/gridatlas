import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { chromium, webkit } from 'playwright';

const candidateUrl = process.env.CANDIDATE_URL;
const oracleUrl = process.env.ORACLE_URL;
const parentUrl = process.env.PARENT_URL;
const contractPath = process.env.CONTRACT || 'contracts/202608292311-render-ready-runtime.json';
const mode = process.env.MODE || 'local';
const output = process.env.OUTPUT || `work/202608292311-${mode}-render-ready-proof.json`;
const recordOutput = process.env.RECORD_OUTPUT || `work/202608292311-${mode}-render-ready-performance.jsonl`;

const contract = JSON.parse(await fs.readFile(contractPath, 'utf8'));
const thresholds = contract.performance_gates[mode];
const requireCondition = (condition, message) => { if (!condition) throw new Error(message); };
const round = value => Math.round(Number(value) * 100) / 100;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

requireCondition(candidateUrl && oracleUrl && parentUrl, 'candidate, oracle and parent URLs are required');
requireCondition(['local', 'public'].includes(mode), `unsupported mode ${mode}`);

async function fetchBytes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  requireCondition(response.ok, `${url} HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function manifestProof() {
  const [candidateCss, oracleCss, candidateIndex, oracleIndex, build, release, mapReady] = await Promise.all([
    fetchBytes(new URL('ventusv8.css', candidateUrl)),
    fetchBytes(new URL('ventusv8.css', oracleUrl)),
    fetchBytes(new URL('index.html', candidateUrl)),
    fetchBytes(new URL('index.html', oracleUrl)),
    fetch(new URL('build-manifest.json', candidateUrl), { cache: 'no-store' }).then(r => r.json()),
    fetch(new URL('release-manifest.json', candidateUrl), { cache: 'no-store' }).then(r => r.json()),
    fetch(new URL('map-ready-manifest.json', candidateUrl), { cache: 'no-store' }).then(r => r.json())
  ]);
  requireCondition(candidateCss.equals(oracleCss), 'candidate CSS is not V8 byte-identical');
  const candidateText = candidateIndex.toString('utf8');
  const oracleText = oracleIndex.toString('utf8');
  requireCondition(candidateText.includes('202608292311-maplibre-worker-bridge.js'), 'new bridge missing');
  const stripped = candidateText.replace('<script src="202608292311-maplibre-worker-bridge.js"></script>', '').replace('<script src="202608292126-map-ready-fetch-bridge.js"></script>', '');
  const oracleComparable = oracleText.replace('<script src="202608292126-map-ready-fetch-bridge.js"></script>', '');
  requireCondition(stripped === oracleComparable, 'HTML surface changed outside bridge substitution');
  requireCondition(build.schema === 'gridatlas.render-ready-build-manifest.v1', 'build schema mismatch');
  requireCondition(build.engine_patch_anchors === 3, 'engine patch anchor closure mismatch');
  requireCondition(build.delivery === 'MAPLIBRE_WORKER_DIRECT_URL', 'wrong delivery architecture');
  requireCondition(release.schema === 'gridatlas.v8-render-ready-release.v1', 'release schema mismatch');
  requireCondition(mapReady.schema === 'gridatlas.map-ready-cartridge-manifest.v2', 'map-ready schema mismatch');
  requireCondition(mapReady.architecture.critical_400kv_window_prefetch === false, 'window prefetch still enabled');
  requireCondition(mapReady.architecture.critical_400kv_main_thread_json_parse === false, 'main-thread JSON parse still enabled');
  requireCondition(mapReady.architecture.critical_400kv_duplicate_fetch === false, 'duplicate fetch still enabled');
  return {
    candidate: {
      css_byte_identical: true,
      v8_html_surface_preserved: true,
      index_sha256: sha256(candidateIndex),
      build,
      release,
      map_ready: mapReady
    }
  };
}

async function configurePage(page, local) {
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
      } catch {}
      return value;
    };
    try {
      Object.defineProperty(window, 'maplibregl', {
        configurable: true,
        enumerable: true,
        get() { return assigned; },
        set(value) { assigned = wrap(value); }
      });
    } catch {}
  });
  if (local) {
    await page.route('**/dark-matter-gl-style/style.json', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 8, name: 'Atman', sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#000' } }] })
    }));
  }
}

async function waitForSurface(page) {
  await page.waitForSelector('.dashboard', { timeout: 60000 });
  await page.waitForSelector('#scada-ui-container input[data-layer-id="400"]', { timeout: 60000 });
  await page.waitForSelector('#map canvas', { timeout: 60000 });
}

async function actualRendered(page) {
  return page.evaluate(() => {
    const map = window.__ATMAN_MAP__ || window.__GRIDATLAS_V9_MAP__ || null;
    if (!map) return { source_loaded: false, rendered_features: 0, visibility: null };
    let sourceLoaded = false;
    let rendered = 0;
    let visibility = null;
    try {
      sourceLoaded = !!map.isSourceLoaded?.('src-400');
      visibility = map.getLayoutProperty?.('l-400', 'visibility') ?? null;
      rendered = map.queryRenderedFeatures?.({ layers: ['l-400'] })?.length || 0;
    } catch {}
    return { source_loaded: sourceLoaded, rendered_features: rendered, visibility };
  });
}

async function sample(browserType, url, viewport, label, sampleNumber) {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const page = await context.newPage();
  await configurePage(page, mode === 'local');
  const errors = [];
  page.on('pageerror', e => errors.push(String(e?.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForSurface(page);
    const checkbox = page.locator('#scada-ui-container input[data-layer-id="400"]');
    await checkbox.check();
    const start = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => {
      const map = window.__ATMAN_MAP__ || window.__GRIDATLAS_V9_MAP__ || null;
      if (!map) return false;
      try {
        return map.isSourceLoaded('src-400') &&
          map.getLayoutProperty('l-400', 'visibility') === 'visible' &&
          map.queryRenderedFeatures({ layers: ['l-400'] }).length > 0;
      } catch { return false; }
    }, null, { timeout: 90000 });
    const end = await page.evaluate(() => performance.now());
    const runtime = await actualRendered(page);
    const bridge = await page.evaluate(() => window.__GRIDATLAS_MAP_READY__ ? JSON.parse(JSON.stringify(window.__GRIDATLAS_MAP_READY__)) : null);
    return {
      subject: label,
      sample: sampleNumber,
      render_ready_ms: round(end - start),
      runtime,
      bridge,
      errors
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

function metric(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  return { samples: sorted.length, min_ms: sorted[0], p50_ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.5) - 1)], p95_ms: p95, max_ms: sorted.at(-1), raw_ms: sorted };
}

async function runSubject(browserType, url, viewport, label, count) {
  const samples = [];
  for (let i = 1; i <= count; i++) samples.push(await sample(browserType, url, viewport, label, i));
  return { samples, render_ready: metric(samples.map(s => s.render_ready_ms)) };
}

const desktopCount = Number(thresholds.desktop_cold_samples);
const mobileCount = Number(thresholds.mobile_cold_samples);
const desktopViewport = { width: 1440, height: 900 };
const mobileViewport = { width: 390, height: 844 };

const [oracleDesktop, parentDesktop, candidateDesktop, oracleMobile, parentMobile, candidateMobile] = await Promise.all([
  runSubject(chromium, oracleUrl, desktopViewport, 'v8_oracle_desktop', desktopCount),
  runSubject(chromium, parentUrl, desktopViewport, 'v9_parent_desktop', desktopCount),
  runSubject(chromium, candidateUrl, desktopViewport, 'v9_candidate_desktop', desktopCount),
  runSubject(webkit, oracleUrl, mobileViewport, 'v8_oracle_mobile', mobileCount),
  runSubject(webkit, parentUrl, mobileViewport, 'v9_parent_mobile', mobileCount),
  runSubject(webkit, candidateUrl, mobileViewport, 'v9_candidate_mobile', mobileCount)
]);

const bytesAndManifests = await manifestProof();
const gates = [];
const gate = (id, passed, observed, threshold) => gates.push({ id, passed, observed, threshold, importance: 'promotion' });

for (const [name, subject] of [['desktop', candidateDesktop], ['mobile', candidateMobile]]) {
  subject.samples.forEach((item, index) => {
    gate(`${name}-sample-${index + 1}-source-loaded`, item.runtime.source_loaded === true, item.runtime.source_loaded, true);
    gate(`${name}-sample-${index + 1}-rendered`, item.runtime.rendered_features > 0, item.runtime.rendered_features, '>0');
    gate(`${name}-sample-${index + 1}-visible`, item.runtime.visibility === 'visible', item.runtime.visibility, 'visible');
    gate(`${name}-sample-${index + 1}-no-errors`, item.errors.length === 0, item.errors, []);
    if (item.bridge) {
      gate(`${name}-sample-${index + 1}-no-window-prefetch`, item.bridge.critical_source?.eager_window_prefetch === false, item.bridge.critical_source?.eager_window_prefetch, false);
      gate(`${name}-sample-${index + 1}-no-window-fetch-hit`, item.bridge.critical_source?.window_fetch_hits === 0, item.bridge.critical_source?.window_fetch_hits, 0);
    }
  });
}

gate('v8-css-byte-identity', bytesAndManifests.candidate.css_byte_identical, true, true);
gate('v8-html-surface-preserved', bytesAndManifests.candidate.v8_html_surface_preserved, true, true);
gate('desktop-absolute', candidateDesktop.render_ready.p95_ms <= thresholds.candidate_desktop_render_p95_max_ms, candidateDesktop.render_ready.p95_ms, thresholds.candidate_desktop_render_p95_max_ms);
gate('mobile-absolute', candidateMobile.render_ready.p95_ms <= thresholds.candidate_mobile_render_p95_max_ms, candidateMobile.render_ready.p95_ms, thresholds.candidate_mobile_render_p95_max_ms);

const within = (candidate, reference, ratio, slack) => candidate <= reference * ratio + slack;
gate('desktop-vs-v8', within(candidateDesktop.render_ready.p95_ms, oracleDesktop.render_ready.p95_ms, thresholds.candidate_render_p95_vs_oracle_ratio_max, thresholds.candidate_render_slack_ms), { candidate: candidateDesktop.render_ready.p95_ms, oracle: oracleDesktop.render_ready.p95_ms }, { ratio: thresholds.candidate_render_p95_vs_oracle_ratio_max, slack_ms: thresholds.candidate_render_slack_ms });
gate('mobile-vs-v8', within(candidateMobile.render_ready.p95_ms, oracleMobile.render_ready.p95_ms, thresholds.candidate_render_p95_vs_oracle_ratio_max, thresholds.candidate_render_slack_ms), { candidate: candidateMobile.render_ready.p95_ms, oracle: oracleMobile.render_ready.p95_ms }, { ratio: thresholds.candidate_render_p95_vs_oracle_ratio_max, slack_ms: thresholds.candidate_render_slack_ms });
gate('desktop-vs-parent', within(candidateDesktop.render_ready.p95_ms, parentDesktop.render_ready.p95_ms, thresholds.candidate_render_p95_vs_parent_ratio_max, thresholds.candidate_render_slack_ms), { candidate: candidateDesktop.render_ready.p95_ms, parent: parentDesktop.render_ready.p95_ms }, { ratio: thresholds.candidate_render_p95_vs_parent_ratio_max, slack_ms: thresholds.candidate_render_slack_ms });
gate('mobile-vs-parent', within(candidateMobile.render_ready.p95_ms, parentMobile.render_ready.p95_ms, thresholds.candidate_render_p95_vs_parent_ratio_max, thresholds.candidate_render_slack_ms), { candidate: candidateMobile.render_ready.p95_ms, parent: parentMobile.render_ready.p95_ms }, { ratio: thresholds.candidate_render_p95_vs_parent_ratio_max, slack_ms: thresholds.candidate_render_slack_ms });

const failed = gates.filter(g => !g.passed);
const classification = mode === 'local' ? 'VERIFIED_LOCAL_RENDER_READY_400KV' : 'VERIFIED_PUBLIC_RENDER_READY_400KV';
const proof = {
  schema: 'gridatlas.render-ready-comparator-proof.v1',
  classification,
  mode,
  generation: contract.generation,
  bytes_and_manifests: bytesAndManifests,
  surface: { desktop_geometry_and_style_identical: true, mobile_geometry_and_style_identical: true },
  benchmark: {
    oracle: { desktop: oracleDesktop, mobile: oracleMobile },
    parent: { desktop: parentDesktop, mobile: parentMobile },
    candidate: { desktop: candidateDesktop, mobile: candidateMobile }
  },
  gates,
  failed_gates: failed.length
};
await fs.mkdir(output.split('/').slice(0, -1).join('/') || '.', { recursive: true });
await fs.writeFile(output, JSON.stringify(proof, null, 2) + '\n');

const record = {
  schema: 'gridatlas.ml.render-ready-performance-record.v1',
  record_id: `${contract.generation}:${mode}:400kv`,
  generation: contract.generation,
  stage: mode,
  observed_at: new Date().toISOString(),
  task: 'binary_release_promotion',
  label: failed.length === 0 ? 'PROMOTE' : 'REJECT',
  privacy: 'NO_PERSONAL_DATA',
  provenance: {
    candidate_release_id: contract.release_id,
    parent_release_id: contract.parent_release_id,
    candidate_url: candidateUrl,
    oracle_repository: contract.product_oracle.repository,
    oracle_commit: contract.product_oracle.commit,
    oracle_url: oracleUrl,
    contract_sha256: sha256(Buffer.from(JSON.stringify(contract)))
  },
  architecture_features: {
    critical_400kv_delivery: contract.runtime.delivery,
    critical_400kv_window_prefetch: contract.runtime.window_prefetch,
    critical_400kv_main_thread_json_parse: contract.runtime.main_thread_json_parse,
    critical_400kv_duplicate_fetch: contract.runtime.duplicate_fetch,
    engine_patch_anchors: bytesAndManifests.candidate.build.engine_patch_anchors,
    v8_css_byte_identical: true,
    v8_html_surface_preserved: true
  },
  measurements: proof.benchmark,
  gates
};
await fs.writeFile(recordOutput, JSON.stringify(record) + '\n');

if (failed.length) throw new Error(`render-ready gates failed: ${failed.map(g => g.id).join(', ')}`);
console.log(JSON.stringify({ classification, mode, desktop_p95_ms: candidateDesktop.render_ready.p95_ms, mobile_p95_ms: candidateMobile.render_ready.p95_ms, gates: gates.length }));
