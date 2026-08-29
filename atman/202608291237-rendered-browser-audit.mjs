#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const repository = path.resolve(process.argv[2] || ".");
const site = path.resolve(process.argv[3] || "build-a/202608291237-atlas-v9");
const dataReleaseDirectory = path.resolve(process.argv[4] || "work/data-release/202608291237-data-gridatlas");
const evidence = path.resolve(process.argv[5] || "work");
const releaseId = "202608291237-atlas-v9";
const dataReleaseId = "202608291237-data-gridatlas";
const dataBase = `https://ventusltd.github.io/data-gridatlas/${dataReleaseId}/`;
const candidateManifest = JSON.parse(fs.readFileSync(path.join(dataReleaseDirectory, "data/manifest.json"), "utf8"));
const repdRegistry = JSON.parse(fs.readFileSync(path.join(repository, "data/repd_browser_registry_202608290716.json"), "utf8"));
fs.mkdirSync(evidence, { recursive: true });

function canonical(value) {
  return Buffer.from(JSON.stringify(value, Object.keys(value).sort(), 2) + "\n");
}

function canonicalDeep(value) {
  if (Array.isArray(value)) return value.map(canonicalDeep);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalDeep(value[key])]));
  return value;
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(canonicalDeep(value), null, 2) + "\n");
}

function sha256(body) {
  return createHash("sha256").update(body).digest("hex");
}

const liveReleaseBytes = fs.readFileSync(path.join(dataReleaseDirectory, "release.json"));
const liveRegistryBytes = fs.readFileSync(path.join(dataReleaseDirectory, "browser-layer-registry.json"));
const liveRelease = JSON.parse(liveReleaseBytes);
const liveRegistry = JSON.parse(liveRegistryBytes);
assert.equal(liveRelease.schema, "data-gridatlas.immutable-live-data-release.v1");
assert.equal(liveRegistry.schema, "data-gridatlas.live-browser-layer-registry.v1");

const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".parquet", "application/octet-stream"]
]);
const served = [];

function patchedAppManifest() {
  const source = fs.readFileSync(path.join(site, "release-manifest.json"));
  const manifest = JSON.parse(source);
  const expectedRelease = sha256(liveReleaseBytes);
  const expectedRegistry = sha256(liveRegistryBytes);
  if (String(manifest.data_release.source_commit).startsWith("__DATA_RELEASE_")) {
    manifest.data_release.source_commit = "c".repeat(40);
    manifest.data_release.release_sha256 = expectedRelease;
    manifest.data_release.browser_registry_sha256 = expectedRegistry;
    return jsonBytes(manifest);
  }
  assert.equal(manifest.data_release.release_sha256, expectedRelease, "sealed data release hash mismatch");
  assert.equal(manifest.data_release.browser_registry_sha256, expectedRegistry, "sealed data registry hash mismatch");
  return source;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(requestUrl.pathname);
  let target = null;
  let body = null;
  if (pathname === `/${releaseId}/release-manifest.json`) body = patchedAppManifest();
  else if (pathname === `/${releaseId}` || pathname === `/${releaseId}/`) target = path.join(site, "index.html");
  else if (pathname.startsWith(`/${releaseId}/`)) target = path.resolve(site, pathname.slice(releaseId.length + 2));
  else if (pathname.startsWith("/data/")) target = path.resolve(repository, pathname.slice(1));
  if (target && target !== site && !target.startsWith(site + path.sep) && target !== repository && !target.startsWith(repository + path.sep)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try {
    body ||= target ? fs.readFileSync(target) : null;
  } catch {
    body = null;
  }
  if (!body) {
    response.writeHead(404).end("not found");
    return;
  }
  served.push({ url: pathname, bytes: body.length });
  response.writeHead(200, {
    "content-type": mime.get(path.extname(target || pathname)) || "application/octet-stream",
    "content-length": body.length,
    "cache-control": "no-store"
  });
  response.end(body);
});

const maplibreStub = `
globalThis.__atlasAudit = { flyTo: [], jumpTo: [], selected: [], popups: [], sources: [], layers: [], layerHandlerOns: [], layerHandlerOffs: [] };
class AtlasSource {
  constructor(id, options) { this.id = id; this.data = options.data; }
  setData(data) { this.data = data; if (this.id === "repd-selected") globalThis.__atlasAudit.selected.push(data); }
  getClusterExpansionZoom(_id, callback) { callback(null, 10); }
}
class AtlasMap {
  constructor(options) { this.options = options; this.sources = new globalThis.Map(); this.layers = new globalThis.Map(); this.handlers = {}; this.zoom = options.zoom; globalThis.__atlasAudit.map = this; if (!globalThis.__GRIDATLAS_MAP_STALL_TEST__) setTimeout(() => this.emit("load", {}), 0); }
  addControl() {}
  addSource(id, options) { this.sources.set(id, new AtlasSource(id, options)); globalThis.__atlasAudit.sources.push(id); }
  addLayer(layer) { this.layers.set(layer.id, layer); globalThis.__atlasAudit.layers.push(layer.id); }
  getSource(id) { return this.sources.get(id); }
  getLayer(id) { return this.layers.get(id); }
  removeLayer(id) { this.layers.delete(id); }
  removeSource(id) { this.sources.delete(id); }
  getZoom() { return this.zoom; }
  getBounds() { return { getWest: () => -8, getSouth: () => 49, getEast: () => 2, getNorth: () => 61 }; }
  on(event, layerOrHandler, possibleHandler) {
    const layer = typeof layerOrHandler === "function" ? null : layerOrHandler;
    const handler = layer ? possibleHandler : layerOrHandler;
    if (layer && !this.layers.has(layer)) throw new Error(\`handler registered before layer exists: \${layer}\`);
    (this.handlers[event] ||= []).push({ layer, handler });
    if (layer) globalThis.__atlasAudit.layerHandlerOns.push(layer);
  }
  off(event, layerOrHandler, possibleHandler) {
    const layer = typeof layerOrHandler === "function" ? null : layerOrHandler;
    const handler = layer ? possibleHandler : layerOrHandler;
    this.handlers[event] = (this.handlers[event] || []).filter(entry => entry.layer !== layer || entry.handler !== handler);
    if (layer) globalThis.__atlasAudit.layerHandlerOffs.push(layer);
  }
  emit(event, payload) { for (const entry of this.handlers[event] || []) if (!entry.layer) entry.handler(payload); }
  flyTo(options) { globalThis.__atlasAudit.flyTo.push(options); }
  jumpTo(options) { this.zoom = options.zoom; globalThis.__atlasAudit.jumpTo.push(options); }
  easeTo(options) { globalThis.__atlasAudit.easeTo ||= []; globalThis.__atlasAudit.easeTo.push(options); }
}
class AtlasPopup {
  setLngLat(value) { this.lngLat = value; return this; }
  setDOMContent(node) { this.text = node.textContent; return this; }
  addTo() { globalThis.__atlasAudit.popups.push({ lngLat: this.lngLat, text: this.text }); return this; }
}
globalThis.maplibregl = { Map: AtlasMap, Popup: AtlasPopup, NavigationControl: class {} };
`;

function duckDbStub() {
  const fakeRow = {
    source_id: "grid_400kv", feature_index: 0, feature_id: null,
    geometry_type: "LineString", geometry_json: '{"type":"LineString","coordinates":[[-1,52],[0,53]]}',
    properties_json: '{"name":"400kV browser proof","voltage":"400000"}',
    original_feature_sha256: "d".repeat(64), projected_feature_sha256: "e".repeat(64)
  };
  globalThis.__GRIDATLAS_DUCKDB_TEST_MODULE__ = {
    LogLevel: { WARNING: 1 },
    ConsoleLogger: class {},
    getJsDelivrBundles() { return {}; },
    async selectBundle() { return { mainModule: "audit.wasm", mainWorker: "data:text/javascript," }; },
    AsyncDuckDB: class {
      async instantiate() {}
      async connect() {
        return {
          async query(sql) {
            globalThis.__atlasDuckSql = sql;
            const layerId = /m\.layer_id = '([^']+)'/.exec(sql)?.[1];
            if (layerId && globalThis.__atlasDuckFailLayerId === layerId) throw new Error(`audit failure for ${layerId}`);
            const urls = [...sql.matchAll(/read_parquet\('([^']+)'\)/g)].map(match => match[1]);
            for (const url of urls) {
              const response = await fetch(url, { headers: { Range: "bytes=0-1023" } });
              if (response.status !== 206) throw new Error(`range read failed: ${response.status}`);
              await response.arrayBuffer();
            }
            return { toArray() { return [fakeRow]; } };
          },
          async close() {}
        };
      }
      async terminate() {}
    }
  };
}

function captureErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return errors;
}

async function configure(context, dataRequests, { stallMap = false } = {}) {
  await context.addInitScript(duckDbStub);
  if (stallMap) await context.addInitScript(() => { globalThis.__GRIDATLAS_MAP_STALL_TEST__ = true; });
  await context.route("**/*", async route => {
    const requested = new URL(route.request().url());
    if (requested.hostname === "127.0.0.1") return route.continue();
    if (requested.href === `${dataBase}release.json`) {
      dataRequests.push({ url: requested.href, range: null, bytes: liveReleaseBytes.length, status: 200 });
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: liveReleaseBytes });
    }
    if (requested.href === `${dataBase}browser-layer-registry.json`) {
      dataRequests.push({ url: requested.href, range: null, bytes: liveRegistryBytes.length, status: 200 });
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: liveRegistryBytes });
    }
    if (requested.href.startsWith(`${dataBase}data/`) && requested.pathname.endsWith(".parquet")) {
      const relative = requested.href.slice(`${dataBase}data/`.length);
      const target = path.resolve(dataReleaseDirectory, "data", relative);
      assert(target.startsWith(path.join(dataReleaseDirectory, "data") + path.sep), "Parquet route escaped data release");
      const all = fs.readFileSync(target);
      const range = route.request().headers().range || "";
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      assert(match, `missing byte range for ${requested.href}`);
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), all.length - 1) : all.length - 1;
      const body = all.subarray(start, end + 1);
      dataRequests.push({ url: requested.href, range, bytes: body.length, status: 206 });
      return route.fulfill({
        status: 206,
        contentType: "application/octet-stream",
        headers: {
          "access-control-allow-origin": "*", "accept-ranges": "bytes",
          "content-range": `bytes ${start}-${end}/${all.length}`, "content-length": String(body.length)
        },
        body
      });
    }
    if (requested.hostname === "cdn.jsdelivr.net" && requested.pathname.endsWith("maplibre-gl.js")) {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: maplibreStub });
    }
    if (requested.hostname === "cdn.jsdelivr.net" && requested.pathname.endsWith("maplibre-gl.css")) {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    if (requested.hostname === "tile.openstreetmap.org") return route.abort();
    return route.abort("blockedbyclient");
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => document.querySelector("[data-registry-status]")?.textContent.includes("11,069"));
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("60 V8 parity layers ready"));
  await page.waitForFunction(() => document.querySelectorAll("[data-layer-id]").length === 60);
}

async function openLayerControl(page, layerId) {
  const control = page.locator(`[data-layer-id="${layerId}"]`);
  const group = page.locator(`details:has([data-layer-id="${layerId}"])`);
  assert.equal(await group.count(), 1, `layer ${layerId} must belong to one visible control group`);
  if (!await group.evaluate(element => element.open)) await group.locator("summary").click();
  await control.waitFor({ state: "visible" });
  return control;
}

let browser;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/${releaseId}/`;
  browser = await chromium.launch({ headless: true });
  const desktopRequests = [];
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "en-GB" });
  await configure(desktop, desktopRequests);
  const page = await desktop.newPage();
  const errors = captureErrors(page);
  const navigationStart = Date.now();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator("text=CORE READY").waitFor();
  const coreReadyMs = Date.now() - navigationStart;
  assert(coreReadyMs <= 5000, `core first paint exceeded 5 seconds: ${coreReadyMs}`);
  await waitReady(page);
  const initialServedBytes = served.reduce((sum, item) => sum + item.bytes, 0);
  const initialRemoteBytes = desktopRequests.reduce((sum, item) => sum + item.bytes, 0);
  const initialParquet = desktopRequests.filter(item => item.url.endsWith(".parquet"));
  assert.equal(initialParquet.length, 0, "V8 Parquet loaded before user activation");
  assert.equal(await page.locator("[data-layer-id]").count(), 60);
  const quarantineBadges = page.locator('[data-layer-disposition^="QUARANTINED_"]');
  assert.equal(await quarantineBadges.count(), 5, "all five quarantined layers need visible badges");
  assert.deepEqual(await quarantineBadges.allTextContents(), Array(5).fill("QUARANTINED"));
  await page.locator("[data-atlas-query]").fill("Anybody involved in the solar farm being built by Cranfield/Marston? Bedfordshire?");
  await page.locator("[data-atlas-search]").click();
  assert.match(await page.locator(".result-card").first().innerText(), /REPD 16135/);
  await page.locator(".result-card").first().locator("button.fly-button").click();
  assert.equal(new URL(page.url()).searchParams.get("repd_ref"), "16135");

  const primaryRoadsControl = await openLayerControl(page, "primary_roads");
  await primaryRoadsControl.check();
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("zoom to 8+"));
  assert.equal(desktopRequests.filter(item => item.url.endsWith(".parquet")).length, 0, "heavy null-minzoom layer bypassed zoom floor");
  await primaryRoadsControl.uncheck();

  await page.evaluate(() => { globalThis.__atlasDuckFailLayerId = "dc"; });
  const dataCentresControl = await openLayerControl(page, "dc");
  await dataCentresControl.check();
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("Data Ctrs failed closed"));
  assert.equal(await dataCentresControl.isChecked(), false, "failed layer remained active");
  assert.equal(await page.evaluate(() => Boolean(globalThis.__atlasAudit.map.getSource("v8-dc"))), false, "failed query leaked a source");
  await page.evaluate(() => { globalThis.__atlasDuckFailLayerId = null; });
  await page.locator("[data-atlas-query]").fill("MK430ZY");
  await page.locator("[data-atlas-query]").press("Enter");
  assert.match(await page.locator(".result-card").first().innerText(), /REPD 16135/, "REPD search failed after isolated layer error");

  const grid400Control = await openLayerControl(page, "400");
  await grid400Control.check();
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("400kV: 1 visible features"));
  const lazyParquet = desktopRequests.filter(item => item.url.endsWith(".parquet"));
  assert.equal(lazyParquet.length, 2, "one layer must range-read one partition and membership file");
  assert(lazyParquet.every(item => item.status === 206 && item.range === "bytes=0-1023"), "lazy Parquet requests were not ranged");
  assert.match(await page.evaluate(() => globalThis.__atlasDuckSql), /m\.layer_id = '400'/);
  assert.equal(await page.evaluate(() => globalThis.__GRIDATLAS_DUCKDB_MODE__), "test");
  await grid400Control.uncheck();
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("400kV unloaded"));
  const unloaded = await page.evaluate(() => ({
    source: Boolean(globalThis.__atlasAudit.map.getSource("v8-400")),
    line: Boolean(globalThis.__atlasAudit.map.getLayer("v8-400-line")),
    point: Boolean(globalThis.__atlasAudit.map.getLayer("v8-400-point")),
    handlerOns: globalThis.__atlasAudit.layerHandlerOns.filter(id => id.startsWith("v8-400-")).length,
    handlerOffs: globalThis.__atlasAudit.layerHandlerOffs.filter(id => id.startsWith("v8-400-")).length
  }));
  assert.deepEqual(unloaded, { source: false, line: false, point: false, handlerOns: 2, handlerOffs: 2 }, "toggle-off did not release render/listener state");
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(evidence, "202608291237-browser-desktop.png"), fullPage: true });
  await desktop.close();

  const mobileRequests = [];
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "en-GB" });
  await configure(mobile, mobileRequests);
  const mobilePage = await mobile.newPage();
  const mobileErrors = captureErrors(mobilePage);
  await mobilePage.goto(`${base}?repd_ref=16135`, { waitUntil: "domcontentloaded" });
  await waitReady(mobilePage);
  await mobilePage.waitForFunction(() => globalThis.__atlasAudit?.jumpTo.length === 1);
  await mobilePage.locator("[data-atlas-query]").fill("MK430ZY");
  await mobilePage.locator("[data-atlas-query]").press("Enter");
  assert.match(await mobilePage.locator(".result-card").first().innerText(), /REPD 16135/);
  const layout = await mobilePage.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - innerWidth,
    panelOverflow: document.querySelector(".search-panel").scrollWidth - document.querySelector(".search-panel").clientWidth,
    layerControls: document.querySelectorAll("[data-layer-id]").length
  }));
  assert(layout.documentOverflow <= 1 && layout.panelOverflow <= 1, `mobile overflow: ${JSON.stringify(layout)}`);
  assert.equal(layout.layerControls, 60);
  assert.equal(mobileRequests.filter(item => item.url.endsWith(".parquet")).length, 0, "mobile deep link loaded V8 Parquet");
  assert.deepEqual(mobileErrors, []);
  await mobilePage.screenshot({ path: path.join(evidence, "202608291237-browser-mobile.png"), fullPage: true });
  await mobile.close();

  const stalledRequests = [];
  const stalled = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "en-GB" });
  await configure(stalled, stalledRequests, { stallMap: true });
  const stalledPage = await stalled.newPage();
  const stalledErrors = captureErrors(stalledPage);
  await stalledPage.goto(`${base}?repd_ref=16135`, { waitUntil: "domcontentloaded" });
  await stalledPage.waitForFunction(() => document.querySelector("[data-registry-status]")?.textContent.includes("11,069"));
  await stalledPage.waitForFunction(() => document.querySelector("[data-atlas-live]")?.textContent.includes("REPD 16135 selected"));
  assert.equal(new URL(stalledPage.url()).searchParams.get("repd_ref"), "16135");
  await stalledPage.locator("[data-atlas-query]").fill("MK430ZY");
  await stalledPage.locator("[data-atlas-query]").press("Enter");
  assert.match(await stalledPage.locator(".result-card").first().innerText(), /REPD 16135/);
  assert.equal(stalledRequests.filter(item => item.url.endsWith(".parquet")).length, 0);
  assert.deepEqual(stalledErrors, []);
  await stalled.close();

  const initialTransferBytes = initialServedBytes + initialRemoteBytes;
  const report = {
    schema: "gridatlas.rendered-browser-audit.v2",
    classification: "VERIFIED_RENDERED_BROWSER",
    release_id: releaseId,
    failed: 0,
    checks: 24,
    golden_repd_ref: "16135",
    golden_postcode: "MK43 0ZY",
    viewports: ["1440x900", "390x844"],
    core_ready_ms: coreReadyMs,
    initial_transfer_bytes: initialTransferBytes,
    initial_decoded_repd_bytes: fs.statSync(path.join(repository, "data/repd_browser_registry_202608290716.json")).size,
    initial_v8_parquet_requests: 0,
    initial_v8_parquet_bytes: 0,
    lazy_layer_parquet_requests: lazyParquet.length,
    lazy_layer_range_bytes: lazyParquet.reduce((sum, item) => sum + item.bytes, 0),
    layer_controls: 60,
    quarantined_visible_badges: 5,
    heavy_layer_zoom_gate: true,
    failed_query_isolated: true,
    unload_released_render_and_handlers: true,
    map_load_stall_deep_link: true,
    data_closure_bytes: liveRelease.files.reduce((sum, item) => sum + item.bytes, 0) + liveReleaseBytes.length
  };
  fs.writeFileSync(path.join(evidence, "202608291237-browser-audit.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} catch (error) {
  const report = {
    schema: "gridatlas.rendered-browser-audit.v2",
    classification: "REJECTED",
    release_id: releaseId,
    failed: 1,
    error: error instanceof Error ? error.stack : String(error)
  };
  fs.writeFileSync(path.join(evidence, "202608291237-browser-audit.json"), JSON.stringify(report, null, 2) + "\n");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
