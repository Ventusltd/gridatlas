#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const repository = path.resolve(process.argv[2] || ".");
const site = path.resolve(process.argv[3] || "work/build-a/202608291430-atlas-v9");
const dataReleaseDirectory = path.resolve(process.argv[4] || "work/data-release/202608291237-data-gridatlas");
const routingProjectsPath = path.resolve(process.argv[5] || "work/routing/projects.json");
const evidence = path.resolve(process.argv[6] || "work/rendered");
const releaseId = "202608291430-atlas-v9";
const dataBase = "https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/";
const routingBase = "https://ventusltd.github.io/data-gridatlas/202608291410-repd-routing/";
fs.mkdirSync(evidence, { recursive: true });

function sha256(body) { return createHash("sha256").update(body).digest("hex"); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function jsonBytes(value) { return Buffer.from(JSON.stringify(canonical(value), null, 2) + "\n"); }

const appManifest = JSON.parse(fs.readFileSync(path.join(site, "release-manifest.json"), "utf8"));
const normalRegistryBytes = fs.readFileSync(path.join(repository, "data/repd_browser_registry_202608290716.json"));
const normalRegistry = JSON.parse(normalRegistryBytes);
const dataReleaseBytes = fs.readFileSync(path.join(dataReleaseDirectory, "release.json"));
const dataRegistryBytes = fs.readFileSync(path.join(dataReleaseDirectory, "browser-layer-registry.json"));
const routingProjectsBytes = fs.readFileSync(routingProjectsPath);
assert.equal(routingProjectsBytes.length, 979338);
assert.equal(sha256(routingProjectsBytes), "c06aedef176d2d38fd135806306a8ef81b4af9994c7be31e8bd760304149f862");
const routing = appManifest.repd_routing;
const routingReleaseBytes = jsonBytes({
  schema: "data-gridatlas.repd-routing-release.v1",
  generation: "202608291410",
  release_id: routing.release_id,
  source_commit: routing.source_commit,
  classification: "IMMUTABLE_REPD_ROUTING_RELEASE",
  immutable: true,
  public_url: routing.base_url,
  coverage: {
    projects: 7680,
    unique_numeric_repd_refs: 7680,
    map_identities: 7652,
    no_map_identities: 28,
    map_set_sha256: routing.map_set_sha256,
    no_map_set_sha256: routing.no_map_set_sha256
  },
  files: { projects: { path: "projects.json", bytes: routingProjectsBytes.length, sha256: sha256(routingProjectsBytes) } }
});
const servedManifest = structuredClone(appManifest);
servedManifest.repd_routing.release_sha256 = sha256(routingReleaseBytes);
const servedManifestBytes = jsonBytes(servedManifest);

const mime = new Map([[".html", "text/html"], [".mjs", "text/javascript"], [".css", "text/css"], [".json", "application/json"]]);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  let target = null;
  let body = null;
  if (pathname === `/${releaseId}/release-manifest.json`) body = servedManifestBytes;
  else if (pathname === `/${releaseId}` || pathname === `/${releaseId}/`) target = path.join(site, "index.html");
  else if (pathname.startsWith(`/${releaseId}/`)) target = path.resolve(site, pathname.slice(releaseId.length + 2));
  else if (pathname.startsWith("/data/")) target = path.resolve(repository, pathname.slice(1));
  if (target && !target.startsWith(site + path.sep) && !target.startsWith(repository + path.sep)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try { body ||= target ? fs.readFileSync(target) : null; } catch { body = null; }
  if (!body) { response.writeHead(404).end("not found"); return; }
  response.writeHead(200, { "content-type": mime.get(path.extname(target || pathname)) || "application/octet-stream", "content-length": body.length, "cache-control": "no-store" });
  response.end(body);
});

const maplibreStub = `
globalThis.__atlasAudit = { flyTo: [], jumpTo: [], selected: [], popups: [], sources: [], layers: [] };
class Source { constructor(id, options) { this.id=id; this.data=options.data; } setData(data) { this.data=data; if(this.id==="repd-selected") globalThis.__atlasAudit.selected.push(data); } getClusterExpansionZoom(_id, cb) { cb(null,10); } }
class MapStub {
  constructor(options) { this.options=options; this.sources=new globalThis.Map(); this.layers=new globalThis.Map(); this.handlers={}; this.zoom=options.zoom; globalThis.__atlasAudit.map=this; setTimeout(()=>this.emit("load",{}),0); }
  addControl() {} addSource(id,options) { this.sources.set(id,new Source(id,options)); this.__push("sources",id); }
  addLayer(layer) { this.layers.set(layer.id,layer); this.__push("layers",layer.id); }
  __push(key,value) { globalThis.__atlasAudit[key].push(value); }
  getSource(id) { return this.sources.get(id); } getLayer(id) { return this.layers.get(id); }
  removeLayer(id) { this.layers.delete(id); } removeSource(id) { this.sources.delete(id); }
  getZoom() { return this.zoom; } getBounds() { return {getWest:()=>-8,getSouth:()=>49,getEast:()=>2,getNorth:()=>61}; }
  on(event, layerOrHandler, possibleHandler) { const layer=typeof layerOrHandler==="function"?null:layerOrHandler; const handler=layer?possibleHandler:layerOrHandler; (this.handlers[event]||=[]).push({layer,handler}); }
  off(event, layerOrHandler, possibleHandler) { const layer=typeof layerOrHandler==="function"?null:layerOrHandler; const handler=layer?possibleHandler:layerOrHandler; this.handlers[event]=(this.handlers[event]||[]).filter(item=>item.layer!==layer||item.handler!==handler); }
  emit(event,payload) { for(const item of this.handlers[event]||[]) if(!item.layer) item.handler(payload); }
  flyTo(options) { globalThis.__atlasAudit.flyTo.push(options); } jumpTo(options) { this.zoom=options.zoom; globalThis.__atlasAudit.jumpTo.push(options); } easeTo() {}
}
class Popup { setLngLat(value){this.lngLat=value;return this;} setDOMContent(node){this.text=node.textContent;return this;} addTo(){globalThis.__atlasAudit.popups.push({lngLat:this.lngLat,text:this.text});return this;} }
globalThis.maplibregl={Map:MapStub,Popup,NavigationControl:class{}};
`;

function captureErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return errors;
}

async function configure(context, requests) {
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") return route.continue();
    requests.push(url.href);
    if (url.href === `${dataBase}release.json`) return route.fulfill({ status: 200, contentType: "application/json", body: dataReleaseBytes });
    if (url.href === `${dataBase}browser-layer-registry.json`) return route.fulfill({ status: 200, contentType: "application/json", body: dataRegistryBytes });
    if (url.href === `${routingBase}release.json`) return route.fulfill({ status: 200, contentType: "application/json", body: routingReleaseBytes });
    if (url.href === `${routingBase}projects.json`) return route.fulfill({ status: 200, contentType: "application/json", body: routingProjectsBytes });
    if (url.hostname === "cdn.jsdelivr.net" && url.pathname.endsWith("maplibre-gl.js")) return route.fulfill({ status: 200, contentType: "text/javascript", body: maplibreStub });
    if (url.hostname === "cdn.jsdelivr.net" && url.pathname.endsWith("maplibre-gl.css")) return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    if (url.hostname === "tile.openstreetmap.org") return route.abort();
    return route.abort("blockedbyclient");
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => document.querySelector("[data-registry-status]")?.textContent.includes("11,033"));
  await page.waitForFunction(() => document.querySelector("[data-data-status]")?.textContent.includes("60 V8 parity layers ready"));
  await page.waitForFunction(() => document.querySelectorAll("[data-layer-id]").length === 60);
  await page.waitForFunction(() => document.querySelector("[data-map-state]")?.dataset.mapState === "ready");
}

const expected = {
  "17494": { source: "normal", center: [1.243276, 52.47333] },
  "13599": { source: "normal", center: [-0.409234, 52.998999] },
  "12453": { source: "routing", center: [-1.0850616, 53.5802575] },
  "2484": { source: "routing", center: [2.5499934, 52.6199968] },
  "2535": { source: "routing", center: [-1.8390082, 50.3929991] },
  "12780": { source: "routing", center: null },
  "13429": { source: "routing", center: null }
};

let browser;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/${releaseId}/`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", locale: "en-GB" });
  const baseRequests = [];
  await configure(context, baseRequests);
  const page = await context.newPage();
  const baseErrors = captureErrors(page);
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  assert.equal(baseRequests.filter(url => url.startsWith(routingBase)).length, 0, "routing loaded without a missing deep link");
  assert.equal(baseRequests.filter(url => url.endsWith(".parquet")).length, 0, "Parquet loaded on boot");
  assert.deepEqual(await page.evaluate(() => globalThis.__GRIDATLAS_RUNTIME__), {
    normalRegistrySourceRows: 11069,
    normalSelectableRows: 11033,
    excludedFalseOriginRows: 36,
    baseMapFeatures: 11033,
    routingProjectsWithoutDeepLink: 0
  });
  assert.equal(await page.evaluate(() => globalThis.__atlasAudit.map.getSource("repd-v9").data.features.length), 11033, "safe normal map registry closure drift");
  assert.equal(await page.evaluate(() => globalThis.__atlasAudit.map.getSource("repd-v9").data.features.some(item => item.geometry.coordinates[0] === 0 && item.geometry.coordinates[1] === 0)), false);
  assert.equal(await page.evaluate(() => globalThis.__atlasAudit.map.getSource("repd-v9").data.features.some(item => item.geometry.coordinates[0] === -7.55716 && item.geometry.coordinates[1] === 49.766807)), false);
  await page.locator("[data-atlas-query]").fill("MK430ZY");
  await page.locator("[data-atlas-query]").press("Enter");
  assert.match(await page.locator(".result-card").first().innerText(), /REPD 16135/);
  assert.deepEqual(baseErrors, []);
  await page.screenshot({ path: path.join(evidence, "202608291430-browser-desktop.png"), fullPage: true });
  await context.close();

  const sentinelProof = {};
  for (const [repdRef, claim] of Object.entries(expected)) {
    const sentinelContext = await browser.newContext({ viewport: { width: repdRef === "12780" ? 390 : 1024, height: repdRef === "12780" ? 844 : 768 }, reducedMotion: "reduce", locale: "en-GB" });
    const requests = [];
    await configure(sentinelContext, requests);
    const sentinelPage = await sentinelContext.newPage();
    const errors = captureErrors(sentinelPage);
    await sentinelPage.goto(`${base}?repd_ref=${repdRef}&longitude=0&latitude=0`, { waitUntil: "domcontentloaded" });
    await waitReady(sentinelPage);
    const state = await sentinelPage.evaluate(() => globalThis.__GRIDATLAS_REPD_ROUTE__);
    const audit = await sentinelPage.evaluate(() => ({
      jumps: globalThis.__atlasAudit.jumpTo,
      selections: globalThis.__atlasAudit.selected,
      live: document.querySelector("[data-atlas-live]")?.textContent || ""
    }));
    assert.equal(state.requested, repdRef);
    assert.equal(state.source, claim.source);
    const routingRequests = requests.filter(url => url.startsWith(routingBase));
    if (claim.source === "normal") assert.equal(routingRequests.length, 0, `normal sentinel fetched routing: ${repdRef}`);
    else assert.deepEqual(routingRequests.sort(), [`${routingBase}projects.json`, `${routingBase}release.json`].sort());
    if (claim.center) {
      assert.equal(state.selectable, true);
      assert.deepEqual([state.longitude, state.latitude], claim.center);
      assert.deepEqual(audit.jumps.at(-1)?.center, claim.center);
      const selected = audit.selections.at(-1)?.geometry?.coordinates;
      assert.deepEqual(selected, claim.center);
      assert.notDeepEqual(selected, [0, 0]);
    } else {
      assert.equal(state.found, true);
      assert.equal(state.selectable, false);
      assert.equal(state.longitude, null);
      assert.equal(state.latitude, null);
      assert.equal(state.geometry_status, repdRef === "12780" ? "invalid" : "missing");
      assert.equal(audit.jumps.length, 0);
      assert.equal(audit.selections.length, 0);
      assert.match(audit.live, /NO MAP geometry and is not selectable/);
    }
    assert.equal(requests.filter(url => url.endsWith(".parquet")).length, 0);
    assert.deepEqual(errors, []);
    sentinelProof[repdRef] = { ...state, center: claim.center, routing_requests: routingRequests.length, zero_origin: false };
    if (repdRef === "12780") await sentinelPage.screenshot({ path: path.join(evidence, "202608291430-browser-mobile.png"), fullPage: true });
    await sentinelContext.close();
  }

  const report = {
    schema: "gridatlas.rendered-routing-browser-audit.v1",
    classification: "VERIFIED_RENDERED_ROUTING_BROWSER",
    release_id: releaseId,
    failed: 0,
    viewports: ["1440x900", "1024x768", "390x844"],
    normal_registry_source_rows: normalRegistry.records.length,
    normal_registry_selectable_rows: 11033,
    excluded_false_origin_rows: 36,
    normal_search_preserved: true,
    routing_without_deep_link_requests: 0,
    initial_v8_parquet_requests: 0,
    layer_controls: 60,
    sentinels: sentinelProof,
    false_zero_origin_points: 0,
    exact_repd_ref_only: true,
    query_coordinates_ignored: true
  };
  fs.writeFileSync(path.join(evidence, "202608291430-browser-audit.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} catch (error) {
  const report = { schema: "gridatlas.rendered-routing-browser-audit.v1", classification: "REJECTED", release_id: releaseId, failed: 1, error: error instanceof Error ? error.stack : String(error) };
  fs.writeFileSync(path.join(evidence, "202608291430-browser-audit.json"), JSON.stringify(report, null, 2) + "\n");
  console.error(report.error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
