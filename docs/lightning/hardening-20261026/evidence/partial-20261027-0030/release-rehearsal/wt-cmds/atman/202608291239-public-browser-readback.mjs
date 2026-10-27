#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const liveUrl = new URL(process.argv[2] || "https://ventusltd.github.io/gridatlas/202608291239-atlas-v9/");
const evidence = path.resolve(process.argv[3] || "work/public");
assert.equal(liveUrl.protocol, "https:");
assert.equal(liveUrl.hostname, "ventusltd.github.io");
assert.equal(liveUrl.pathname, "/gridatlas/202608291239-atlas-v9/");
fs.mkdirSync(evidence, { recursive: true });

const requests = [];
const parquetResponses = [];
const errors = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    locale: "en-GB"
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.hostname === "ventusltd.github.io" && url.pathname.startsWith("/data-gridatlas/202608291237-data-gridatlas/data/") && url.pathname.endsWith(".parquet")) {
      parquetResponses.push({ url: url.href, method: response.request().method(), status: response.status(), headers: response.headers() });
    }
  });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });

  const deepLink = new URL("?repd_ref=16135", liveUrl);
  await page.goto(deepLink.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => performance.getEntriesByName("first-contentful-paint").length === 1);
  const firstContentfulPaintMs = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0].startTime);
  assert(firstContentfulPaintMs <= 5000, `first contentful paint exceeded 5 seconds: ${firstContentfulPaintMs}`);
  await page.waitForFunction(() => document.querySelector("[data-registry-status]")?.textContent.includes("11,069"));
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("60 V8 parity layers ready"));
  await page.waitForFunction(() => document.querySelectorAll("[data-layer-id]").length === 60);
  await page.waitForFunction(() => document.querySelector("[data-map-state]")?.dataset.mapState === "ready");
  assert.equal(new URL(page.url()).searchParams.get("repd_ref"), "16135");
  assert.match(await page.locator("[data-atlas-live]").innerText(), /REPD 16135 selected/);
  assert.equal(await page.locator('[data-layer-disposition^="QUARANTINED_"]').count(), 5);

  const initialParquetRequests = requests.filter(item => new URL(item.url).pathname.endsWith(".parquet"));
  assert.equal(initialParquetRequests.length, 0, "public successor fetched Parquet before user activation");
  await page.locator("[data-atlas-query]").fill("MK430ZY");
  await page.locator("[data-atlas-query]").press("Enter");
  assert.match(await page.locator(".result-card").first().innerText(), /REPD 16135/);

  const activationRequestIndex = requests.length;
  await page.locator('[data-layer-id="400"]').check();
  await page.waitForFunction(() => /400kV: [1-9][0-9,]* visible features/.test(document.querySelector("[data-data-status]")?.textContent || ""), null, { timeout: 180_000 });
  const visibleText = await page.locator("[data-data-status]").innerText();
  const visibleFeatures = Number(visibleText.match(/400kV: ([0-9,]+) visible features/)?.[1].replaceAll(",", ""));
  assert(Number.isInteger(visibleFeatures) && visibleFeatures > 0, `real DuckDB returned no 400kV features: ${visibleText}`);
  assert.equal(await page.evaluate(() => globalThis.__GRIDATLAS_DUCKDB_MODE__), "real");
  assert.equal(await page.evaluate(() => Boolean(globalThis.__GRIDATLAS_DUCKDB_TEST_MODULE__)), false);

  const activatedParquetRequests = requests.slice(activationRequestIndex).filter(item => new URL(item.url).pathname.endsWith(".parquet"));
  assert(activatedParquetRequests.some(item => new URL(item.url).pathname.endsWith("/data/derived/grid_400kv_snapped.parquet")), "real DuckDB did not request 400kV partition");
  assert(activatedParquetRequests.some(item => new URL(item.url).pathname.endsWith("/data/layer_membership.parquet")), "real DuckDB did not request membership Parquet");
  assert(parquetResponses.length >= 2, "real DuckDB produced fewer than two Parquet responses");
  const parquetGets = parquetResponses.filter(item => item.method === "GET");
  assert(parquetGets.some(item => new URL(item.url).pathname.endsWith("/data/derived/grid_400kv_snapped.parquet") && item.status === 206 && /^bytes /i.test(item.headers["content-range"] || "")), "400kV partition was not range-served");
  assert(parquetGets.some(item => new URL(item.url).pathname.endsWith("/data/layer_membership.parquet") && item.status === 206 && /^bytes /i.test(item.headers["content-range"] || "")), "membership Parquet was not range-served");
  assert(parquetGets.every(item => item.status === 206 && /^bytes /i.test(item.headers["content-range"] || "")), `full/non-range Parquet GET: ${JSON.stringify(parquetGets)}`);
  const parquetMetadata = parquetResponses.filter(item => item.method !== "GET");
  assert(parquetMetadata.every(item => ["HEAD", "OPTIONS"].includes(item.method) && [200, 204].includes(item.status)), `unexpected Parquet metadata response: ${JSON.stringify(parquetMetadata)}`);
  assert.deepEqual(errors, []);

  await page.screenshot({ path: path.join(evidence, "202608291239-public-live-duckdb.png"), fullPage: true });
  const report = {
    schema: "gridatlas.public-duckdb-browser-readback.v1",
    classification: "VERIFIED_PUBLIC_DUCKDB_BROWSER",
    release_id: "202608291239-atlas-v9",
    failed: 0,
    live_url: liveUrl.href,
    deep_link: deepLink.href,
    first_contentful_paint_ms: firstContentfulPaintMs,
    layer_controls: 60,
    quarantined_visible_badges: 5,
    map_state_ready: true,
    golden_repd_ref: "16135",
    golden_postcode: "MK43 0ZY",
    initial_v8_parquet_requests: 0,
    duckdb_mode: "real",
    real_layer_id: "400",
    real_visible_features: visibleFeatures,
    parquet_responses: parquetResponses
  };
  fs.writeFileSync(path.join(evidence, "202608291239-public-browser-readback.json"), JSON.stringify(report, null, 2) + "\n");
  const claim = {
    schema: "gridatlas.public-duckdb-browser-claim.v1",
    classification: "VERIFIED_PUBLIC_DUCKDB_BROWSER",
    release_id: "202608291239-atlas-v9",
    live_url: liveUrl.href,
    data_release_id: "202608291237-data-gridatlas",
    layer_controls: 60,
    quarantined_visible_badges: 5,
    map_state_ready: true,
    golden_repd_ref: "16135",
    golden_postcode: "MK43 0ZY",
    initial_v8_parquet_requests: 0,
    duckdb_mode: "real",
    real_layer_id: "400",
    real_result_nonempty: true,
    real_parquet_range_206: true,
    console_errors: 0
  };
  fs.writeFileSync(path.join(evidence, "202608291239-public-browser-claim.json"), JSON.stringify(claim, null, 2) + "\n");
  console.log(JSON.stringify(report));
  await context.close();
} catch (error) {
  const report = {
    schema: "gridatlas.public-duckdb-browser-readback.v1",
    classification: "REJECTED",
    release_id: "202608291239-atlas-v9",
    failed: 1,
    error: error instanceof Error ? error.stack : String(error)
  };
  fs.writeFileSync(path.join(evidence, "202608291239-public-browser-readback.json"), JSON.stringify(report, null, 2) + "\n");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
