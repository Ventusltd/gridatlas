#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const releaseId = "202608291430-atlas-v9";
const liveUrl = new URL(process.argv[2] || `https://ventusltd.github.io/gridatlas/${releaseId}/`);
const evidence = path.resolve(process.argv[3] || "work/public/browser");
const routingBase = "https://ventusltd.github.io/data-gridatlas/202608291410-repd-routing/";
const dataPrefix = "/data-gridatlas/202608291237-data-gridatlas/data/";
assert.equal(liveUrl.protocol, "https:");
assert.equal(liveUrl.hostname, "ventusltd.github.io");
assert.equal(liveUrl.pathname, `/gridatlas/${releaseId}/`);
fs.mkdirSync(evidence, { recursive: true });

const sentinels = Object.freeze({
  "17494": { source: "normal", geometryStatus: null, center: [1.243276, 52.47333] },
  "13599": { source: "normal", geometryStatus: null, center: [-0.409234, 52.998999] },
  "12453": { source: "routing", geometryStatus: "valid", center: [-1.0850616, 53.5802575] },
  "2484": { source: "routing", geometryStatus: "valid", center: [2.5499934, 52.6199968] },
  "2535": { source: "routing", geometryStatus: "valid", center: [-1.8390082, 50.3929991] },
  "12780": { source: "routing", geometryStatus: "invalid", center: null },
  "13429": { source: "routing", geometryStatus: "missing", center: null }
});

function collect(page) {
  const requests = [];
  const parquetResponses = [];
  const errors = [];
  page.setDefaultTimeout(120_000);
  page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.hostname === "ventusltd.github.io" && url.pathname.startsWith(dataPrefix) && url.pathname.endsWith(".parquet")) {
      parquetResponses.push({ url: url.href, method: response.request().method(), status: response.status(), headers: response.headers() });
    }
  });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return { requests, parquetResponses, errors };
}

async function waitReady(page) {
  await page.waitForFunction(() => document.querySelector("[data-registry-status]")?.textContent.includes("11,033"));
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("60 V8 parity layers ready"));
  await page.waitForFunction(() => document.querySelectorAll("[data-layer-id]").length === 60);
  await page.waitForFunction(() => document.querySelector("[data-map-state]")?.dataset.mapState === "ready");
}

async function proveSentinel(browser, repdRef, expected) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce", locale: "en-GB" });
  const page = await context.newPage();
  const telemetry = collect(page);
  const url = new URL(liveUrl);
  url.searchParams.set("repd_ref", repdRef);
  url.searchParams.set("longitude", "0");
  url.searchParams.set("latitude", "0");
  await page.goto(url.href, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  const route = await page.evaluate(() => globalThis.__GRIDATLAS_REPD_ROUTE__);
  assert.equal(route.requested, repdRef);
  assert.equal(route.source, expected.source);
  assert.equal(route.found, true);
  assert.equal(route.selectable, Boolean(expected.center));
  assert.equal(route.geometry_status || null, expected.geometryStatus);
  const routingRequests = telemetry.requests.filter(item => item.url.startsWith(routingBase));
  if (expected.source === "normal") {
    assert.equal(routingRequests.length, 0, `normal sentinel fetched routing: ${repdRef}`);
  } else {
    assert.deepEqual(
      routingRequests.map(item => item.url).sort(),
      [`${routingBase}projects.json`, `${routingBase}release.json`].sort(),
      `routing request closure drift: ${repdRef}`
    );
  }
  assert.equal(telemetry.requests.filter(item => new URL(item.url).pathname.endsWith(".parquet")).length, 0, `sentinel fetched Parquet: ${repdRef}`);
  if (expected.center) {
    assert.deepEqual([route.longitude, route.latitude], expected.center, `selected coordinates drift: ${repdRef}`);
    assert.notDeepEqual([route.longitude, route.latitude], [0, 0]);
    assert.notDeepEqual([route.longitude, route.latitude], [-7.55716, 49.766807]);
  } else {
    assert.equal(route.longitude, null);
    assert.equal(route.latitude, null);
    assert.match(await page.locator("[data-atlas-live]").innerText(), /NO MAP geometry and is not selectable/);
  }
  assert.deepEqual(telemetry.errors, []);
  const proof = {
    source: route.source,
    found: route.found,
    selectable: route.selectable,
    geometry_status: route.geometry_status || null,
    center: expected.center,
    routing_requests: routingRequests.length,
    initial_parquet_requests: 0,
    query_coordinates_ignored: true
  };
  await context.close();
  return proof;
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const baseContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "en-GB" });
  const basePage = await baseContext.newPage();
  const baseTelemetry = collect(basePage);
  await basePage.goto(liveUrl.href, { waitUntil: "domcontentloaded" });
  await basePage.waitForFunction(() => performance.getEntriesByName("first-contentful-paint").length === 1);
  const firstContentfulPaintMs = await basePage.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0].startTime);
  assert(firstContentfulPaintMs <= 5000, `first contentful paint exceeded 5 seconds: ${firstContentfulPaintMs}`);
  await waitReady(basePage);
  assert.deepEqual(await basePage.evaluate(() => globalThis.__GRIDATLAS_RUNTIME__), {
    normalRegistrySourceRows: 11069,
    normalSelectableRows: 11033,
    excludedFalseOriginRows: 36,
    baseMapFeatures: 11033,
    routingProjectsWithoutDeepLink: 0
  });
  assert.equal(baseTelemetry.requests.filter(item => item.url.startsWith(routingBase)).length, 0, "routing fetched without a deep link");
  assert.equal(baseTelemetry.requests.filter(item => new URL(item.url).pathname.endsWith(".parquet")).length, 0, "Parquet fetched before user activation");
  await basePage.locator("[data-atlas-query]").fill("MK430ZY");
  await basePage.locator("[data-atlas-query]").press("Enter");
  assert.match(await basePage.locator(".result-card").first().innerText(), /REPD 16135/);
  assert.equal(await basePage.locator('[data-layer-disposition^="QUARANTINED_"]').count(), 5);

  const activationRequestIndex = baseTelemetry.requests.length;
  await basePage.locator('[data-layer-id="400"]').check();
  await basePage.waitForFunction(
    () => /400kV: [1-9][0-9,]* visible features/.test(document.querySelector("[data-data-status]")?.textContent || ""),
    null,
    { timeout: 180_000 }
  );
  const visibleText = await basePage.locator("[data-data-status]").innerText();
  const visibleFeatures = Number(visibleText.match(/400kV: ([0-9,]+) visible features/)?.[1].replaceAll(",", ""));
  assert(Number.isInteger(visibleFeatures) && visibleFeatures > 0, `real DuckDB returned no 400kV features: ${visibleText}`);
  assert.equal(await basePage.evaluate(() => globalThis.__GRIDATLAS_DUCKDB_MODE__), "real");
  assert.equal(await basePage.evaluate(() => Boolean(globalThis.__GRIDATLAS_DUCKDB_TEST_MODULE__)), false);
  const activatedParquetRequests = baseTelemetry.requests.slice(activationRequestIndex).filter(item => new URL(item.url).pathname.endsWith(".parquet"));
  assert(activatedParquetRequests.some(item => new URL(item.url).pathname.endsWith("/data/derived/grid_400kv_snapped.parquet")), "real DuckDB did not request 400kV Parquet");
  assert(activatedParquetRequests.some(item => new URL(item.url).pathname.endsWith("/data/layer_membership.parquet")), "real DuckDB did not request membership Parquet");
  const parquetGets = baseTelemetry.parquetResponses.filter(item => item.method === "GET");
  assert(parquetGets.length >= 2, "real DuckDB produced fewer than two Parquet GET responses");
  assert(parquetGets.every(item => item.status === 206 && /^bytes /i.test(item.headers["content-range"] || "")), `full/non-range Parquet GET: ${JSON.stringify(parquetGets)}`);
  const parquetMetadata = baseTelemetry.parquetResponses.filter(item => item.method !== "GET");
  assert(parquetMetadata.every(item => ["HEAD", "OPTIONS"].includes(item.method) && [200, 204].includes(item.status)), `unexpected Parquet metadata response: ${JSON.stringify(parquetMetadata)}`);
  assert.deepEqual(baseTelemetry.errors, []);
  await basePage.screenshot({ path: path.join(evidence, "202608291430-public-live-duckdb.png"), fullPage: true });
  await baseContext.close();

  const sentinelProof = {};
  for (const [repdRef, expected] of Object.entries(sentinels)) sentinelProof[repdRef] = await proveSentinel(browser, repdRef, expected);

  const report = {
    schema: "gridatlas.public-routing-duckdb-browser-readback.v1",
    classification: "VERIFIED_PUBLIC_ROUTING_AND_DUCKDB_BROWSER",
    release_id: releaseId,
    failed: 0,
    live_url: liveUrl.href,
    first_contentful_paint_ms: firstContentfulPaintMs,
    normal_registry_source_rows: 11069,
    normal_registry_selectable_rows: 11033,
    base_map_features: 11033,
    excluded_false_origin_rows: 36,
    routing_without_deep_link_requests: 0,
    initial_v8_parquet_requests: 0,
    normal_search_golden_repd_ref: "16135",
    layer_controls: 60,
    quarantined_visible_badges: 5,
    duckdb_mode: "real",
    real_layer_id: "400",
    real_visible_features: visibleFeatures,
    real_parquet_range_206: true,
    sentinels: sentinelProof,
    query_coordinates_ignored: true,
    console_errors: 0
  };
  fs.writeFileSync(path.join(evidence, "202608291430-public-browser-readback.json"), JSON.stringify(report, null, 2) + "\n");
  const claim = {
    schema: "gridatlas.public-routing-duckdb-browser-claim.v1",
    classification: "VERIFIED_PUBLIC_ROUTING_AND_DUCKDB_BROWSER",
    release_id: releaseId,
    live_url: liveUrl.href,
    normal_registry_source_rows: 11069,
    normal_registry_selectable_rows: 11033,
    excluded_false_origin_rows: 36,
    routing_map_identities: 7652,
    routing_no_map_identities: 28,
    missing_map_identities: 0,
    no_map_selectable_intersection: 0,
    routing_without_deep_link_requests: 0,
    initial_v8_parquet_requests: 0,
    sentinels: Object.fromEntries(Object.entries(sentinelProof).map(([repdRef, proof]) => [repdRef, { source: proof.source, selectable: proof.selectable, geometry_status: proof.geometry_status }])),
    duckdb_mode: "real",
    real_layer_id: "400",
    real_result_nonempty: true,
    real_parquet_range_206: true,
    console_errors: 0
  };
  fs.writeFileSync(path.join(evidence, "202608291430-public-browser-claim.json"), JSON.stringify(claim, null, 2) + "\n");
  console.log(JSON.stringify(report));
} catch (error) {
  const report = {
    schema: "gridatlas.public-routing-duckdb-browser-readback.v1",
    classification: "REJECTED",
    release_id: releaseId,
    failed: 1,
    error: error instanceof Error ? error.stack : String(error)
  };
  fs.writeFileSync(path.join(evidence, "202608291430-public-browser-readback.json"), JSON.stringify(report, null, 2) + "\n");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
