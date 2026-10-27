import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const site = path.resolve(process.argv[2] || "build-a");
const evidence = path.resolve(process.argv[3] || "work");
const registry = JSON.parse(fs.readFileSync(path.join(site, "data", "repd_browser_registry_202608290716.json"), "utf8"));
const golden = registry.records.find(record => String(record.repd_ref) === "16135");
const expectedGolden = Object.freeze({
  repd_ref: "16135",
  name: "Prologis DC4 Marston Gate, Brockley Way - Solar Panels",
  repd_address_display: "Prologis Marston Gate DC4, Unit 1 Brockley Way, Brogborough",
  repd_postcode: "MK43 0ZY",
  county: "Bedfordshire",
  status: "awaiting construction",
  capacity_mw: 0.35,
  repd_operator_or_applicant: "Prologis UK Limited",
  longitude: -0.592657,
  latitude: 52.032151
});
fs.mkdirSync(evidence, { recursive: true });

const mime = new Map([
  [".html", "text/html; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".parquet", "application/octet-stream"]
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  const relative = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "") || "index.html";
  const target = path.resolve(site, relative);
  if (target !== site && !target.startsWith(site + path.sep)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  fs.readFile(target, (error, body) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": mime.get(path.extname(target)) || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  });
});

const maplibreStub = `
globalThis.__atlasAudit = { flyTo: [], jumpTo: [], easeTo: [], selected: [], popups: [] };
class AtlasSource {
  constructor(id, options) { this.id = id; this.data = options.data; }
  setData(data) { this.data = data; if (this.id === "repd-selected") globalThis.__atlasAudit.selected.push(data); }
  getClusterExpansionZoom(_id, callback) { callback(null, 10); }
}
class AtlasMap {
  constructor(options) { this.options = options; this.sources = new globalThis.Map(); this.handlers = {}; setTimeout(() => this.emit("load", {}), 0); }
  addControl() {}
  addSource(id, options) { this.sources.set(id, new AtlasSource(id, options)); }
  addLayer() {}
  getSource(id) { return this.sources.get(id); }
  on(event, layerOrHandler, possibleHandler) { const handler = typeof layerOrHandler === "function" ? layerOrHandler : possibleHandler; (this.handlers[event] ||= []).push(handler); }
  emit(event, payload) { for (const handler of this.handlers[event] || []) handler(payload); }
  flyTo(options) { globalThis.__atlasAudit.flyTo.push(options); }
  jumpTo(options) { globalThis.__atlasAudit.jumpTo.push(options); }
  easeTo(options) { globalThis.__atlasAudit.easeTo.push(options); }
}
class AtlasPopup {
  setLngLat(value) { this.lngLat = value; return this; }
  setDOMContent(node) { this.text = node.textContent; return this; }
  addTo() { globalThis.__atlasAudit.popups.push({ lngLat: this.lngLat, text: this.text }); return this; }
}
globalThis.maplibregl = { Map: AtlasMap, Popup: AtlasPopup, NavigationControl: class {} };
`;

function captureErrors(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return errors;
}

async function routeDependencies(context, mapMode, baseOrigin, externalAttempts) {
  await context.route("**/*", route => {
    const requested = new URL(route.request().url());
    if (requested.origin === baseOrigin) return route.continue();
    externalAttempts.push(requested.href);
    if (requested.hostname === "cdn.jsdelivr.net" && requested.pathname.endsWith("maplibre-gl.js")) {
      const body = mapMode === "ready"
        ? maplibreStub
        : mapMode === "constructor-throws"
          ? "globalThis.maplibregl = { Map: class { constructor() { throw new Error('Failed to initialize WebGL'); } }, NavigationControl: class {} };"
          : "globalThis.maplibregl = undefined;";
      return route.fulfill({ status: 200, contentType: "text/javascript", body });
    }
    if (requested.hostname === "cdn.jsdelivr.net" && requested.pathname.endsWith("maplibre-gl.css")) {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    if (requested.hostname === "tile.openstreetmap.org") return route.abort();
    return route.abort("blockedbyclient");
  });
}

async function waitForRegistry(page) {
  await page.waitForFunction(() => document.querySelector("[data-registry-status]")?.textContent.includes("11,069"));
}

async function run() {
  assert(golden, "golden REPD 16135 missing from browser registry");
  for (const [field, expected] of Object.entries(expectedGolden)) {
    assert.deepEqual(golden[field], expected, `golden REPD 16135 ${field} drifted`);
  }
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}/`;
  let browser = null;
  const checks = [];
  const externalAttempts = [];
  const baseOrigin = new URL(base).origin;
  try {
    browser = await chromium.launch({ headless: true });
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce", locale: "en-GB" });
    await routeDependencies(desktop, "ready", baseOrigin, externalAttempts);
    const desktopPage = await desktop.newPage();
    const desktopErrors = captureErrors(desktopPage);
    await desktopPage.goto(base, { waitUntil: "networkidle" });
    await waitForRegistry(desktopPage);
    await desktopPage.waitForFunction(() => document.querySelector("[data-map-status]")?.dataset.mapState === "ready");
    await desktopPage.locator("[data-atlas-query]").fill("Anybody involved in the solar farm being built by Cranfield/Marston? Bedfordshire?");
    await desktopPage.locator("[data-atlas-search]").click();
    const first = desktopPage.locator(".result-card").first();
    await first.waitFor();
    assert.equal(await desktopPage.locator("[data-atlas-live]").textContent(), "4 direct REPD project matches");
    const orderedRefs = (await desktopPage.locator(".result-kicker").allTextContents()).map(value => value.match(/REPD (\d+)/)?.[1]);
    assert.deepEqual(orderedRefs, ["16135", "8811", "12802", "6603"]);
    const firstText = await first.innerText();
    assert.match(firstText, /REPD 16135/);
    assert.match(firstText, /Prologis DC4 Marston Gate, Brockley Way - Solar Panels/);
    assert.match(firstText, /Prologis Marston Gate DC4, Unit 1 Brockley Way, Brogborough/);
    assert.match(firstText, /MK43 0ZY/);
    assert.match(firstText, /Bedfordshire/);
    assert.match(firstText, /0\.35 MW · awaiting construction/);
    assert.match(firstText, /REPD operator or applicant \(as published\): Prologis UK Limited/);
    assert.equal(await first.getAttribute("data-result-class"), "DIRECT_PROJECT_MATCH");
    await first.locator("button.fly-button").click();
    const desktopAudit = await desktopPage.evaluate(() => globalThis.__atlasAudit);
    assert.equal(desktopAudit.flyTo.length, 1, "FLY TO PROJECT did not invoke map.flyTo exactly once");
    assert.deepEqual(desktopAudit.flyTo[0].center, [expectedGolden.longitude, expectedGolden.latitude]);
    assert.equal(desktopAudit.flyTo[0].zoom, 13);
    assert.equal(desktopAudit.flyTo[0].duration, 0);
    assert.equal(desktopAudit.selected.length, 1, "selected-project layer was not updated");
    assert.deepEqual(desktopAudit.selected[0].geometry.coordinates, [expectedGolden.longitude, expectedGolden.latitude]);
    assert.equal(new URL(desktopPage.url()).searchParams.get("repd_ref"), "16135");
    assert.deepEqual(desktopErrors, []);
    await desktopPage.screenshot({ path: path.join(evidence, "browser-audit-desktop.png"), fullPage: true });
    checks.push("desktop four-result order", "rendered official fields", "fly-to invocation", "reduced-motion fly-to", "selected layer", "deep-link write");
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", locale: "en-GB" });
    await routeDependencies(mobile, "ready", baseOrigin, externalAttempts);
    const mobilePage = await mobile.newPage();
    const mobileErrors = captureErrors(mobilePage);
    await mobilePage.goto(`${base}?repd_ref=16135`, { waitUntil: "networkidle" });
    await waitForRegistry(mobilePage);
    await mobilePage.waitForFunction(() => globalThis.__atlasAudit?.jumpTo.length === 1);
    const deepLinkAudit = await mobilePage.evaluate(() => globalThis.__atlasAudit);
    assert.deepEqual(deepLinkAudit.jumpTo[0].center, [expectedGolden.longitude, expectedGolden.latitude]);
    assert.equal(deepLinkAudit.jumpTo[0].zoom, 13);
    assert.deepEqual(deepLinkAudit.selected[0].geometry.coordinates, [expectedGolden.longitude, expectedGolden.latitude]);
    assert.deepEqual(deepLinkAudit.popups[0].lngLat, [expectedGolden.longitude, expectedGolden.latitude]);
    assert.match(deepLinkAudit.popups[0].text, /REPD 16135/);
    assert.equal(new URL(mobilePage.url()).searchParams.get("repd_ref"), "16135");
    await mobilePage.locator("[data-atlas-query]").fill("MK430ZY");
    await mobilePage.locator("[data-atlas-query]").press("Enter");
    assert.match(await mobilePage.locator(".result-card").first().innerText(), /REPD 16135/);
    const mobileLayout = await mobilePage.evaluate(() => {
      const panel = document.querySelector(".search-panel");
      const panelBox = panel.getBoundingClientRect();
      const selectors = ["[data-atlas-query]", "[data-atlas-search]", ".result-card"];
      return {
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        panelOverflow: panel.scrollWidth - panel.clientWidth,
        buttonBelowInput: document.querySelector("[data-atlas-search]").getBoundingClientRect().top >= document.querySelector("[data-atlas-query]").getBoundingClientRect().bottom,
        withinPanel: selectors.every(selector => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return box.left >= panelBox.left - 1 && box.right <= panelBox.right + 1;
        })
      };
    });
    assert(mobileLayout.documentOverflow <= 1, `mobile viewport overflows by ${mobileLayout.documentOverflow}px`);
    assert(mobileLayout.panelOverflow <= 1, `mobile search panel overflows by ${mobileLayout.panelOverflow}px`);
    assert.equal(mobileLayout.withinPanel, true, "mobile search controls or result escape the search panel");
    assert.equal(mobileLayout.buttonBelowInput, true, "mobile SEARCH button does not stack below the input");
    assert.deepEqual(mobileErrors, []);
    await mobilePage.screenshot({ path: path.join(evidence, "browser-audit-mobile.png"), fullPage: true });
    checks.push("deep-link read", "deep-link popup", "compact postcode Enter", "mobile viewport", "mobile panel bounds");
    await mobile.close();

    for (const mapMode of ["absent", "constructor-throws"]) {
      const isolated = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce", locale: "en-GB" });
      await routeDependencies(isolated, mapMode, baseOrigin, externalAttempts);
      const isolatedPage = await isolated.newPage();
      const isolatedErrors = captureErrors(isolatedPage);
      await isolatedPage.goto(base, { waitUntil: "networkidle" });
      await waitForRegistry(isolatedPage);
      await isolatedPage.waitForFunction(() => document.querySelector("[data-map-status]")?.dataset.mapState === "unavailable");
      await isolatedPage.locator("[data-atlas-query]").fill("Anybody involved in the solar farm being built by Cranfield/Marston? Bedfordshire?");
      await isolatedPage.locator("[data-atlas-search]").click();
      const isolatedRefs = (await isolatedPage.locator(".result-kicker").allTextContents()).map(value => value.match(/REPD (\d+)/)?.[1]);
      assert.deepEqual(isolatedRefs, ["16135", "8811", "12802", "6603"]);
      const isolatedFirst = isolatedPage.locator(".result-card").first();
      await isolatedFirst.locator("button.fly-button").click();
      assert.equal(new URL(isolatedPage.url()).searchParams.get("repd_ref"), "16135");
      assert.deepEqual(isolatedErrors, []);
      checks.push(`${mapMode} map failure isolation`, `${mapMode} search and selection`);
      await isolated.close();
    }

    const allowedExternal = externalAttempts.every(url => {
      const parsed = new URL(url);
      return parsed.hostname === "cdn.jsdelivr.net" || parsed.hostname === "tile.openstreetmap.org";
    });
    assert.equal(allowedExternal, true, `unexpected external request attempted: ${externalAttempts.join(", ")}`);
    const report = {
      schema: "gridatlas.rendered-browser-audit.v1",
      classification: "VERIFIED_RENDERED_BROWSER",
      generation: "202608290836",
      checks: checks.length,
      failed: 0,
      golden_repd_ref: "16135",
      expected_center: [expectedGolden.longitude, expectedGolden.latitude],
      external_network_transfers: 0,
      intercepted_external_requests: [...new Set(externalAttempts)].sort(),
      viewports: ["1280x800", "390x844", "1024x768-map-absent", "1024x768-WebGL-constructor-failure"]
    };
    fs.writeFileSync(path.join(evidence, "browser-audit.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

try {
  await run();
} catch (error) {
  const rejected = {
    schema: "gridatlas.rendered-browser-audit.v1",
    classification: "REJECTED",
    generation: "202608290836",
    failed: 1,
    error: error instanceof Error ? error.stack : String(error)
  };
  fs.writeFileSync(path.join(evidence, "browser-audit.json"), JSON.stringify(rejected, null, 2) + "\n");
  console.error(rejected.error);
  process.exitCode = 1;
}
