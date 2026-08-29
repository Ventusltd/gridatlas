#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RELEASE_ID = "202608291430-atlas-v9";
const ROOT_INDEX_SHA256 = "4d059a6963ee73378b21bf378a3590292bbced0bba6f3cacf4acd9c6bc695533";
const REPD_REGISTRY_SHA256 = "c8a5c59be878c52014a272eb0e4d09af06a0d301d10a8d6b5d0b116b5d1bb6bc";
const ROUTING_PROJECTS_SHA256 = "c06aedef176d2d38fd135806306a8ef81b4af9994c7be31e8bd760304149f862";
const RELEASE_FILES = [
  "assets/atlas-v9.css",
  "assets/atlas-v9.mjs",
  "assets/data-gridatlas-client.mjs",
  "assets/repd-routing-client.mjs",
  "build-manifest.json",
  "cartridges/202608290716-repd-address-flyto.mjs",
  "index.html",
  "release-manifest.json"
];

function fail(message) { throw new Error(message); }
function invariant(condition, message) { if (!condition) fail(message); }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function setHash(values) { return digest(Buffer.from(JSON.stringify([...values].sort((left, right) => Number(left) - Number(right))) + "\n")); }

async function sha256(file) { return digest(await readFile(file)); }

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
  const args = { root: ".", releaseDirectory: null, routingProjects: null, dataRelease: null, allowUnsealed: false };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--root") args.root = argv[++index];
    else if (argv[index] === "--release-directory") args.releaseDirectory = argv[++index];
    else if (argv[index] === "--routing-projects") args.routingProjects = argv[++index];
    else if (argv[index] === "--data-release") args.dataRelease = argv[++index];
    else if (argv[index] === "--allow-unsealed") args.allowUnsealed = true;
    else fail(`unknown argument: ${argv[index]}`);
  }
  invariant(args.routingProjects, "--routing-projects is required");
  return args;
}

const args = parseArgs(process.argv);
const root = path.resolve(args.root);
const releaseDirectory = args.releaseDirectory ? path.resolve(args.releaseDirectory) : path.join(root, RELEASE_ID);
const routingProjectsPath = path.resolve(args.routingProjects);
const clientPath = path.join(releaseDirectory, "assets/data-gridatlas-client.mjs");
const routingClientPath = path.join(releaseDirectory, "assets/repd-routing-client.mjs");
const cartridgePath = path.join(releaseDirectory, "cartridges/202608290716-repd-address-flyto.mjs");
const { buildLayerQuery, rowsToGeoJSON, validateDataClosure, validateReleaseManifest } = await import(pathToFileURL(clientPath));
const { decodeRoutingProjects, resolveRoutingRecord, REPD_ROUTING_CONTRACT } = await import(pathToFileURL(routingClientPath));
const { ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT, parseAtlasQuery, rankRepdProjects } = await import(pathToFileURL(cartridgePath));

const manifest = JSON.parse(await readFile(path.join(releaseDirectory, "release-manifest.json"), "utf8"));
validateReleaseManifest(manifest, { sealed: !args.allowUnsealed });
assert.equal(manifest.source_parent_commit, "936a31f703d31bd975af22d7349708d68a143d56");
assert.equal(manifest.route_contract.identity_rule, "EXACT_REPD_REF_ONLY");
assert.equal(manifest.route_contract.query_coordinates_ignored, true);
assert.deepEqual(manifest.route_contract.browser_sentinels, ["17494", "13599", "12453", "2484", "12780", "2535", "13429"]);

assert.equal(await sha256(path.join(root, "index.html")), ROOT_INDEX_SHA256, "root last-green index changed");
const current = JSON.parse(await readFile(path.join(root, "state/live-set.json"), "utf8"));
const currentMirror = await readFile(path.join(root, "releases/current-v3.json"));
assert.deepEqual(current, JSON.parse(currentMirror), "current pointer mirrors differ");
assert.equal(current.current.release_id, "202608291239-atlas-v9", "verified predecessor pointer drift");
assert.equal(current.current.publication_commit, "1898184ccbf52ca836cf1482362fc5933baf3e8d", "verified predecessor release drift");

const releaseFiles = await filesUnder(releaseDirectory);
assert.deepEqual(releaseFiles, RELEASE_FILES, "timestamped release allowlist mismatch");
const buildManifest = JSON.parse(await readFile(path.join(releaseDirectory, "build-manifest.json"), "utf8"));
assert.equal(buildManifest.schema, "gridatlas.timestamped-live-build.v2");
assert.equal(buildManifest.release_id, RELEASE_ID);
assert.equal(buildManifest.source_commit, manifest.source_commit);
assert.equal(buildManifest.deterministic, true);
const declaredFiles = new Map(buildManifest.files.map(item => [item.path, item]));
assert.equal(declaredFiles.size, buildManifest.files.length, "duplicate build file receipt");
assert.deepEqual([...declaredFiles.keys()].sort(), releaseFiles.filter(item => item !== "build-manifest.json"), "build file closure mismatch");
for (const [relative, receipt] of declaredFiles) {
  const file = path.join(releaseDirectory, relative);
  assert.equal((await stat(file)).size, receipt.bytes, `build byte mismatch: ${relative}`);
  assert.equal(await sha256(file), receipt.sha256, `build hash mismatch: ${relative}`);
}

const html = await readFile(path.join(releaseDirectory, "index.html"), "utf8");
const app = await readFile(path.join(releaseDirectory, "assets/atlas-v9.mjs"), "utf8");
const routingClient = await readFile(routingClientPath, "utf8");
for (const token of ["202608291430 LIVE", "11,033 safe viable search records", "7,652 MAP / 28 NO MAP", "release-manifest.json"]) {
  assert(html.includes(token), `release index missing: ${token}`);
}
for (const token of ["resolveRequestedDeepLink", "loadRoutingDeepLinkFallback", "hasMappableGeometry", "__GRIDATLAS_REPD_ROUTE__", "__GRIDATLAS_RUNTIME__", "normal", "ROUTING_FAILED_CLOSED"]) {
  assert(app.includes(token), `runtime routing token missing: ${token}`);
}
assert(app.includes("records.filter(hasMappableGeometry).map"), "base-map geometry guard missing");
assert(app.includes("registry.records.filter(hasMappableGeometry)"), "normal search/feature registry guard missing");
assert(app.includes("record.latitude === 49.766807 && record.longitude === -7.55716"), "transformed false-origin guard missing");
assert(!app.includes('get("longitude")') && !app.includes('get("latitude")'), "query coordinates are consumed");
for (const token of ["rawLatitude !== null", "rawLongitude !== null", "geometryStatus === \"valid\"", "false zero-origin routing point", "resolveRoutingRecord"]) {
  assert(routingClient.includes(token), `routing decoder guard missing: ${token}`);
}

const normalRegistryPath = path.join(root, "data/repd_browser_registry_202608290716.json");
assert.equal(await sha256(normalRegistryPath), REPD_REGISTRY_SHA256, "normal registry identity drift");
const normalRegistry = JSON.parse(await readFile(normalRegistryPath, "utf8"));
assert.equal(normalRegistry.records.length, 11069, "normal registry row closure drift");
const normalByRef = new Map();
const safeNormalByRef = new Map();
const excludedFalseOrigin = new Set();
for (const record of normalRegistry.records) {
  const repdRef = String(record.repd_ref);
  assert(!normalByRef.has(repdRef), `duplicate normal repd_ref: ${repdRef}`);
  assert.equal(typeof record.latitude, "number", `normal latitude type drift: ${repdRef}`);
  assert.equal(typeof record.longitude, "number", `normal longitude type drift: ${repdRef}`);
  assert(Number.isFinite(record.latitude) && Number.isFinite(record.longitude), `normal non-finite point: ${repdRef}`);
  assert(!(record.latitude === 0 && record.longitude === 0), `normal false zero-origin point: ${repdRef}`);
  normalByRef.set(repdRef, record);
  if (record.latitude === 49.766807 && record.longitude === -7.55716) excludedFalseOrigin.add(repdRef);
  else safeNormalByRef.set(repdRef, record);
}
assert.equal(excludedFalseOrigin.size, 36);
assert.equal(setHash(excludedFalseOrigin), "acdee510ef7f29855ea07b376cdc1519835d498184c5d14ea2a8a06d756365d9");
assert.equal(safeNormalByRef.size, 11033);
assert.equal(setHash(safeNormalByRef.keys()), "fc8b3bedf4f39c2eaa534d45a30806053cc931fdf7ced4a703f7275e43d27b21");

const routingRaw = await readFile(routingProjectsPath);
assert.equal(routingRaw.length, 979338, "routing projects byte closure drift");
assert.equal(digest(routingRaw), ROUTING_PROJECTS_SHA256, "routing projects identity drift");
const decoded = decodeRoutingProjects(JSON.parse(routingRaw));
assert.equal(decoded.records.length, REPD_ROUTING_CONTRACT.projects);
assert.equal(decoded.mapIdentities, 7652);
assert.equal(decoded.noMapIdentities, 28);
const routingMapRefs = new Set(decoded.records.filter(record => record.selectable).map(record => record.repd_ref));
const routingNoMapRefs = new Set(decoded.records.filter(record => !record.selectable).map(record => record.repd_ref));
const fallbackRefs = new Set([...routingMapRefs].filter(repdRef => !safeNormalByRef.has(repdRef)));
const finalSelectable = new Set([...safeNormalByRef.keys(), ...fallbackRefs]);
assert.equal(fallbackRefs.size, 2419);
assert.equal(setHash(fallbackRefs), "5cbd8e6fc2f24f9fab897e9fb558c01e5886d0868db405f73260713ae3542a3b");
assert.equal(finalSelectable.size, 13452);
assert.equal(setHash(finalSelectable), "1ed30d2eef18b75d4b4064f971d2b1ea3fd41ef618fc585b3a3ff0723462ac5f");
assert.equal([...routingMapRefs].filter(repdRef => !finalSelectable.has(repdRef)).length, 0);
assert.equal([...routingNoMapRefs].filter(repdRef => finalSelectable.has(repdRef)).length, 0);
for (const repdRef of ["17494", "13599"]) {
  assert(safeNormalByRef.has(repdRef), `normal sentinel missing: ${repdRef}`);
  assert.equal(resolveRoutingRecord(decoded, repdRef).selectable, true, `routing overlap sentinel invalid: ${repdRef}`);
}
for (const repdRef of ["12453", "2484", "2535"]) {
  assert(!safeNormalByRef.has(repdRef), `fallback sentinel unexpectedly normal: ${repdRef}`);
  const result = resolveRoutingRecord(decoded, repdRef);
  assert.equal(result.selectable, true, `fallback sentinel is not selectable: ${repdRef}`);
  assert(!(result.record.longitude === 0 && result.record.latitude === 0));
}
const noMap = resolveRoutingRecord(decoded, "12780");
assert(!safeNormalByRef.has("12780"));
assert.equal(noMap.found, true);
assert.equal(noMap.selectable, false);
assert.equal(noMap.record.geometry_status, "invalid");
assert.equal(noMap.record.latitude, null);
assert.equal(noMap.record.longitude, null);
const transformedNoMap = resolveRoutingRecord(decoded, "13429");
assert(normalByRef.has("13429") && !safeNormalByRef.has("13429"));
assert.equal(transformedNoMap.found, true);
assert.equal(transformedNoMap.selectable, false);
assert.equal(transformedNoMap.record.geometry_status, "missing");
assert.equal(resolveRoutingRecord(decoded, "012780").found, false, "routing identity is not exact repd_ref");

const parsed = parseAtlasQuery("Anybody involved in the solar farm being built by Cranfield/Marston? Bedfordshire?");
const ranked = rankRepdProjects([...safeNormalByRef.values()], "MK430ZY", 5);
assert(parsed.constructionIntent && parsed.groups.length === 3, "normal search grammar drift");
assert.equal(ranked[0]?.record?.repd_ref, "16135", "normal search regression");
assert.equal(ATLAS_V9_REPD_ADDRESS_FLYTO_CONTRACT.payloadRequests, 0, "normal search performs hidden requests");

let dataClosure = null;
if (args.dataRelease) {
  const dataRoot = path.resolve(args.dataRelease);
  const dataRelease = JSON.parse(await readFile(path.join(dataRoot, "release.json"), "utf8"));
  const registry = JSON.parse(await readFile(path.join(dataRoot, "browser-layer-registry.json"), "utf8"));
  const layers = validateDataClosure(manifest, dataRelease, registry);
  const first = layers.find(layer => layer.id === "400");
  const query = buildLayerQuery(manifest, first, { west: -8, south: 49, east: 2, north: 61 });
  assert(query.includes("layer_membership.parquet") && query.includes("m.layer_id = '400'"));
  const geojson = rowsToGeoJSON([{ source_id: "grid_400kv", feature_index: 0, geometry_json: '{"type":"LineString","coordinates":[[0,0],[1,1]]}', properties_json: "{}", original_feature_sha256: "a".repeat(64), projected_feature_sha256: "b".repeat(64) }], first);
  assert.equal(geojson.features.length, 1);
  dataClosure = { layers: layers.length, features: dataRelease.candidate_closure.features, memberships: dataRelease.candidate_closure.layer_membership_rows };
}

const fileProofs = {};
for (const relative of releaseFiles) {
  const file = path.join(releaseDirectory, relative);
  fileProofs[relative] = { bytes: (await stat(file)).size, sha256: await sha256(file) };
}
console.log(JSON.stringify({
  schema: "gridatlas.atman.timestamped-routing-live-release.v1",
  classification: args.allowUnsealed ? "VERIFIED_UNSEALED_ROUTING_BUILD_INPUT" : "VERIFIED_LIVE_ROUTING_RELEASE_SOURCE",
  release_id: RELEASE_ID,
  release_files: fileProofs,
  normal_registry: { source_rows: 11069, selectable_rows: 11033, excluded_false_origin_rows: 36, role: "NORMAL_SEARCH_AND_BASE_MAP" },
  routing: { projects: 7680, map_identities: 7652, no_map_identities: 28 },
  sentinels: { normal: ["17494", "13599"], fallback_map: ["12453", "2484", "2535"], no_map: ["12780", "13429"] },
  data: dataClosure,
  startup_parquet_requests: 0,
  failures: []
}, null, 2));
