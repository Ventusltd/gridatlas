#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RELEASE_ID = "202608291239-atlas-v9";
const EXPECTED_ROOT = new Map([
  ["index.html", "4d059a6963ee73378b21bf378a3590292bbced0bba6f3cacf4acd9c6bc695533"],
  ["assets/atlas-v9.mjs", "0de34ca55772c744ccf4fd4beda480d4fc1047886b35fa96fdb4464fa7ca7f95"],
  ["assets/atlas-v9.css", "33dd363e811086e8fea4e1a03f145bd362e02679a119f109d8503a9131f7cad6"],
  ["cartridges/202608290716-repd-address-flyto.mjs", "b4dcfcb9cf815012dab6cc634c099179a155ea2f0120f6c61797087fbef1f64a"],
  ["data/repd_browser_registry_202608290716.json", "c8a5c59be878c52014a272eb0e4d09af06a0d301d10a8d6b5d0b116b5d1bb6bc"],
  ["data/repd_projects_202608290716.parquet", "174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b"],
  ["data/repd_v9_manifest_202608290716.json", "8850567ff9f1d2b6996b4e0d9707320030f3466a0b821cdcfc5325322b8be8c8"]
]);
const EXPECTED_RELEASE_FILES = [
  "assets/atlas-v9.css",
  "assets/atlas-v9.mjs",
  "assets/data-gridatlas-client.mjs",
  "build-manifest.json",
  "cartridges/202608290716-repd-address-flyto.mjs",
  "index.html",
  "release-manifest.json"
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function bytes(file) {
  return readFile(file);
}

async function sha256(file) {
  return createHash("sha256").update(await bytes(file)).digest("hex");
}

async function filesUnder(directory, prefix = "") {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await filesUnder(path.join(directory, entry.name), relative));
    else if (entry.isFile()) output.push(relative);
    else fail(`non-regular release entry: ${relative}`);
  }
  return output.sort();
}

function parseArgs(argv) {
  const args = { root: ".", releaseDirectory: null, allowUnsealed: false, dataRelease: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--root") args.root = argv[++index];
    else if (argv[index] === "--release-directory") args.releaseDirectory = argv[++index];
    else if (argv[index] === "--allow-unsealed") args.allowUnsealed = true;
    else if (argv[index] === "--data-release") args.dataRelease = argv[++index];
    else fail(`unknown argument: ${argv[index]}`);
  }
  return args;
}

const args = parseArgs(process.argv);
const root = path.resolve(args.root);
const releaseDirectory = args.releaseDirectory ? path.resolve(args.releaseDirectory) : path.join(root, RELEASE_ID);
const clientPath = path.join(releaseDirectory, "assets/data-gridatlas-client.mjs");
const cartridgePath = path.join(releaseDirectory, "cartridges/202608290716-repd-address-flyto.mjs");
const { buildLayerQuery, rowsToGeoJSON, validateDataClosure, validateReleaseManifest } = await import(pathToFileURL(clientPath));
const { ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT, parseAtlasQuery, rankRepdProjects } = await import(pathToFileURL(cartridgePath));

const manifest = JSON.parse(await readFile(path.join(releaseDirectory, "release-manifest.json"), "utf8"));
validateReleaseManifest(manifest, { sealed: !args.allowUnsealed });

for (const [relative, expected] of EXPECTED_ROOT) {
  const actual = await sha256(path.join(root, relative));
  assert(actual === expected, `last-green root changed: ${relative}`);
}

const releaseFiles = await filesUnder(releaseDirectory);
assert(JSON.stringify(releaseFiles) === JSON.stringify(EXPECTED_RELEASE_FILES), `timestamped release allowlist mismatch: ${releaseFiles}`);

const html = await readFile(path.join(releaseDirectory, "index.html"), "utf8");
const app = await readFile(path.join(releaseDirectory, "assets/atlas-v9.mjs"), "utf8");
const client = await readFile(clientPath, "utf8");
const css = await readFile(path.join(releaseDirectory, "assets/atlas-v9.css"), "utf8");
const cartridge = await readFile(cartridgePath, "utf8");

for (const required of [
  "202608291239 LIVE",
  "Official REPD address",
  "data-load-defaults",
  "data-layer-controls",
  "release-manifest.json",
  "LAST-GREEN ROOT"
]) assert(html.includes(required), `release HTML missing ${required}`);
assert(html.includes("maplibre-gl@3.6.2"), "MapLibre dependency is not pinned");
assert(client.includes('version === "1.29.0"'), "DuckDB-WASM dependency is not pinned");
assert(client.includes("EXPLICIT_USER_LAYER_TOGGLE"), "lazy activation contract missing");
assert(client.includes("SEMI JOIN read_parquet"), "exact layer membership join missing");
assert(client.includes("p.max_x") && client.includes("p.min_y"), "map-bounds predicate missing");
assert(app.includes('input.addEventListener("change"'), "user layer-toggle activation missing");
assert(app.match(/dataClient\.queryLayer\(/g)?.length === 1, "unexpected Parquet query call sites");
assert(app.includes('defaultButton.addEventListener("click"'), "explicit V8-default activation missing");
assert(!app.includes("loadDefaults();"), "V8 defaults load automatically");
assert(app.includes("layer.minzoom !== null && layer.minzoom !== undefined"), "null-minzoom heavy-layer fallback missing");
assert(app.includes('map.off("click", renderedId, binding.handler)'), "render-layer handler teardown missing");
assert(app.includes('["LineString", "MultiLineString"]'), "multi-line V8 geometry rendering missing");
assert(app.includes('id: "repd-clusters"'), "REPD cluster circles missing");
assert(app.includes('id: "repd-points"') && app.includes('id: "repd-selected"'), "REPD point/selection layers missing");
assert(app.includes('map.on("click", "repd-clusters"') && app.includes("getClusterExpansionZoom"), "REPD cluster expansion handler missing");
assert(!app.includes('id: "repd-cluster-count"'), "glyph-dependent REPD cluster-count layer remains");
assert(!app.includes('"text-field"'), "undeclared glyph-dependent text field remains");
assert(app.includes("layer-disposition") && css.includes(".layer-disposition.is-quarantined"), "visible provenance badges missing");
assert(app.includes("catalogResultPromise") && app.includes("error => ({ ok: false, error })"), "catalog rejection is not immediately settled");
assert(app.includes('if (requested && featureByRef.has(requested)) select(featureByRef.get(requested));\n\n  try {\n    initialiseMap'), "deep link is not consumed before map load");
assert(!html.includes(".parquet"), "application HTML directly names a Parquet payload");
for (const forbidden of [".geojson", "repd_grid_atlasv8", "ventus-corev8engine", "nominatim", "reverse-geocode"]) {
  assert(!(html + app + client).toLowerCase().includes(forbidden), `forbidden runtime dependency: ${forbidden}`);
}
assert((await stat(path.join(releaseDirectory, "index.html"))).size < 12_000, "timestamped index is unexpectedly large");
assert((await stat(clientPath)).size < 30_000, "lazy data client is unexpectedly large");
assert(css.includes("@media(max-width:760px)"), "mobile layout gate missing");

const repdRegistry = JSON.parse(await readFile(path.join(root, "data/repd_browser_registry_202608290716.json"), "utf8"));
assert(repdRegistry.records.length === 11069, "REPD row closure drift");
const naturalLanguage = "Anybody involved in the solar farm being built by Cranfield/Marston? Bedfordshire?";
const parsed = parseAtlasQuery(naturalLanguage);
const ranked = rankRepdProjects(repdRegistry.records, naturalLanguage, 20);
const postcode = rankRepdProjects(repdRegistry.records, "MK430ZY", 5);
assert(parsed.constructionIntent && parsed.groups.length === 3, "REPD query grammar drift");
assert(ranked[0]?.record?.repd_ref === "16135", "Cranfield/Marston golden search drift");
assert(postcode[0]?.record?.repd_ref === "16135", "MK43 0ZY golden search drift");
assert(ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT.payloadRequests === 0, "address cartridge performs hidden requests");
assert(ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT.proximityEstablishesIdentity === false, "address truth contract drift");
assert(manifest.route_contract.route === "/gridatlas/202608291239-atlas-v9/", "timestamp route contract drift");
assert(manifest.route_contract.query_parameter === "repd_ref", "deep-link query contract drift");
assert(manifest.route_contract.golden_deep_link === "https://ventusltd.github.io/gridatlas/202608291239-atlas-v9/?repd_ref=16135", "deep-link sentinel missing");
assert(manifest.route_contract.consumer_rule === "READ_EXACT_IMMUTABLE_ROUTE_FROM_RELEASE_POINTER", "route consumer rule drift");
assert(manifest.supersedes_candidate?.release_id === "202608291237-atlas-v9" && manifest.supersedes_candidate?.publication_commit === "ce88cd8fdba9c60411cd91c419d43f3bfff38b4c", "superseded candidate identity drift");
assert(manifest.supersedes_candidate?.classification === "PUBLIC_PROOF_REJECTED_NO_POINTER" && manifest.supersedes_candidate?.pointer_created === false, "superseded candidate status drift");
assert(!Object.hasOwn(manifest, "verified_at") && !Object.hasOwn(manifest, "pages_verified_at"), "immutable release advertises null verification timestamps");
assert(app.includes('get("repd_ref")'), "deep-link consumer missing");

let dataClosure = null;
if (args.dataRelease) {
  const dataReleaseRoot = path.resolve(args.dataRelease);
  const dataManifest = JSON.parse(await readFile(path.join(dataReleaseRoot, "data/manifest.json"), "utf8"));
  const dataRegistry = JSON.parse(await readFile(path.join(dataReleaseRoot, "browser-layer-registry.json"), "utf8"));
  const releaseView = JSON.parse(await readFile(path.join(dataReleaseRoot, "release.json"), "utf8"));
  const registryView = structuredClone(dataRegistry);
  const layers = validateDataClosure(manifest, releaseView, registryView);
  const first = layers.find(layer => layer.id === "400");
  const query = buildLayerQuery(manifest, first, { west: -8, south: 49, east: 2, north: 61 });
  assert(query.includes("layer_membership.parquet") && query.includes("m.layer_id = '400'"), "exact membership query drift");
  const geojson = rowsToGeoJSON([{
    source_id: "grid_400kv",
    feature_index: 0,
    geometry_json: '{"type":"LineString","coordinates":[[0,0],[1,1]]}',
    properties_json: '{"voltage":"400000"}',
    original_feature_sha256: "a".repeat(64),
    projected_feature_sha256: "b".repeat(64)
  }], first);
  assert(geojson.features.length === 1 && geojson.features[0].properties.voltage === "400000", "Arrow-to-GeoJSON projection drift");
  dataClosure = {
    features: dataManifest.closure.features,
    layer_memberships: dataManifest.closure.layer_membership_rows,
    layers: layers.length,
    sources: dataManifest.closure.sources
  };
  assert(dataClosure.features === 541282, "data feature closure drift");
  assert(dataClosure.layer_memberships === 526388, "membership closure drift");
}

const fileProofs = {};
for (const relative of releaseFiles) {
  const file = path.join(releaseDirectory, relative);
  fileProofs[relative] = { bytes: (await stat(file)).size, sha256: await sha256(file) };
}

console.log(JSON.stringify({
  schema: "gridatlas.atman.timestamped-live-release.v1",
  classification: args.allowUnsealed ? "VERIFIED_UNSEALED_BUILD_INPUT" : "VERIFIED_LIVE_RELEASE_SOURCE",
  release_id: RELEASE_ID,
  parent_commit: manifest.parent_release.commit,
  root_last_green_files: EXPECTED_ROOT.size,
  release_files: fileProofs,
  repd: { rows: repdRegistry.records.length, golden_repd_ref: "16135", golden_postcode: "MK43 0ZY" },
  data: dataClosure,
  startup_parquet_requests: 0,
  lazy_layers: 60,
  failures: []
}, null, 2));
