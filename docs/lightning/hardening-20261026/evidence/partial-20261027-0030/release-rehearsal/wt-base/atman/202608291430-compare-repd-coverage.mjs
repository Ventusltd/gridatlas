#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { repository: ".", buildA: null, buildB: null, routingProjects: null, output: null };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--repository") args.repository = argv[++index];
    else if (argv[index] === "--build-a") args.buildA = argv[++index];
    else if (argv[index] === "--build-b") args.buildB = argv[++index];
    else if (argv[index] === "--routing-projects") args.routingProjects = argv[++index];
    else if (argv[index] === "--output") args.output = argv[++index];
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  for (const key of ["buildA", "buildB", "routingProjects", "output"]) assert(args[key], `${key} is required`);
  return args;
}

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

async function tree(root, prefix = "") {
  const output = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) Object.assign(output, await tree(target, relative));
    else if (entry.isFile()) {
      const bytes = await readFile(target);
      output[relative] = { bytes: bytes.length, sha256: sha256(bytes) };
    } else throw new Error(`non-regular build entry: ${relative}`);
  }
  return output;
}

function setHash(values) {
  const ordered = [...values].sort((left, right) => Number(left) - Number(right));
  return sha256(Buffer.from(JSON.stringify(ordered) + "\n"));
}

const args = parseArgs(process.argv);
const repository = path.resolve(args.repository);
const buildA = path.resolve(args.buildA);
const buildB = path.resolve(args.buildB);
const routingPath = path.resolve(args.routingProjects);
const routingModule = await import(pathToFileURL(path.join(buildA, "assets/repd-routing-client.mjs")));
const normalBytes = await readFile(path.join(repository, "data/repd_browser_registry_202608290716.json"));
assert.equal(sha256(normalBytes), "c8a5c59be878c52014a272eb0e4d09af06a0d301d10a8d6b5d0b116b5d1bb6bc");
const normal = JSON.parse(normalBytes);
assert.equal(normal.records.length, 11069);
const normalByRef = new Map(normal.records.map(record => [String(record.repd_ref), record]));
assert.equal(normalByRef.size, 11069);
const safeNormalByRef = new Map();
const excludedFalseOrigin = new Set();
for (const record of normal.records) {
  assert.equal(typeof record.latitude, "number", `normal latitude type: ${record.repd_ref}`);
  assert.equal(typeof record.longitude, "number", `normal longitude type: ${record.repd_ref}`);
  assert(Number.isFinite(record.latitude) && Number.isFinite(record.longitude), `normal non-finite: ${record.repd_ref}`);
  assert(!(record.latitude === 0 && record.longitude === 0), `normal zero-origin: ${record.repd_ref}`);
  if (record.latitude === 49.766807 && record.longitude === -7.55716) excludedFalseOrigin.add(String(record.repd_ref));
  else safeNormalByRef.set(String(record.repd_ref), record);
}
assert.equal(excludedFalseOrigin.size, 36);
assert.equal(setHash(excludedFalseOrigin), "acdee510ef7f29855ea07b376cdc1519835d498184c5d14ea2a8a06d756365d9");
assert.equal(safeNormalByRef.size, 11033);
assert.equal(setHash(safeNormalByRef.keys()), "fc8b3bedf4f39c2eaa534d45a30806053cc931fdf7ced4a703f7275e43d27b21");

const routingBytes = await readFile(routingPath);
assert.equal(routingBytes.length, 979338);
assert.equal(sha256(routingBytes), "c06aedef176d2d38fd135806306a8ef81b4af9994c7be31e8bd760304149f862");
const payload = JSON.parse(routingBytes);
const decoded = routingModule.decodeRoutingProjects(payload);
assert.equal(decoded.records.length, 7680);
assert.equal(decoded.byRef.size, 7680);
const mapRefs = decoded.records.filter(record => record.selectable).map(record => record.repd_ref);
const noMapRefs = decoded.records.filter(record => !record.selectable).map(record => record.repd_ref);
assert.equal(mapRefs.length, 7652);
assert.equal(noMapRefs.length, 28);
assert.equal(setHash(mapRefs), "4199f74165ed049c382ae322c5b5577a06a01c72dde0df9711a0bc368a918834");
assert.equal(setHash(noMapRefs), "4e172523b8b352c73f98e7533cbb814559dd5d1dd9c2c04d1ee3904df26303e6");
assert.equal(decoded.records.filter(record => record.geometry_status === "missing").length, 26);
assert.equal(decoded.records.filter(record => record.geometry_status === "invalid").length, 2);
assert(decoded.records.filter(record => !record.selectable).every(record => record.latitude === null && record.longitude === null));
assert(decoded.records.filter(record => record.selectable).every(record => !(record.latitude === 0 && record.longitude === 0)));

const mapSet = new Set(mapRefs);
const overlap = [...mapSet].filter(repdRef => normalByRef.has(repdRef));
const fallbacks = [...mapSet].filter(repdRef => !safeNormalByRef.has(repdRef));
const finalSelectable = new Set([...safeNormalByRef.keys(), ...fallbacks]);
const nonMapNormal = noMapRefs.filter(repdRef => safeNormalByRef.has(repdRef));
const nonMapOnly = noMapRefs.filter(repdRef => !normalByRef.has(repdRef));
assert.equal(overlap.length, 5233);
assert.equal(fallbacks.length, 2419);
assert.equal(setHash(fallbacks), "5cbd8e6fc2f24f9fab897e9fb558c01e5886d0868db405f73260713ae3542a3b");
assert.equal(finalSelectable.size, 13452);
assert.equal(setHash(finalSelectable), "1ed30d2eef18b75d4b4064f971d2b1ea3fd41ef618fc585b3a3ff0723462ac5f");
assert.equal([...mapSet].filter(repdRef => !finalSelectable.has(repdRef)).length, 0);
assert.equal(noMapRefs.filter(repdRef => finalSelectable.has(repdRef)).length, 0);
assert.equal(nonMapNormal.length, 0);
assert.deepEqual(nonMapOnly.sort((a, b) => Number(a) - Number(b)), ["12780", "15088"]);

const sentinels = {
  "17494": { authority: "normal", latitude: 52.47333, longitude: 1.243276 },
  "13599": { authority: "normal", latitude: 52.998999, longitude: -0.409234 },
  "12453": { authority: "routing", latitude: 53.5802575, longitude: -1.0850616 },
  "2484": { authority: "routing", latitude: 52.6199968, longitude: 2.5499934 },
  "2535": { authority: "routing", latitude: 50.3929991, longitude: -1.8390082 },
  "12780": { authority: "no-map", latitude: null, longitude: null },
  "13429": { authority: "no-map", latitude: null, longitude: null }
};
for (const [repdRef, expected] of Object.entries(sentinels)) {
  const routing = routingModule.resolveRoutingRecord(decoded, repdRef);
  if (expected.authority === "normal") {
    assert(safeNormalByRef.has(repdRef), `normal sentinel missing: ${repdRef}`);
    assert.equal(safeNormalByRef.get(repdRef).latitude, expected.latitude);
    assert.equal(safeNormalByRef.get(repdRef).longitude, expected.longitude);
  } else if (expected.authority === "routing") {
    assert(!safeNormalByRef.has(repdRef), `fallback sentinel unexpectedly normal: ${repdRef}`);
    assert.equal(routing.selectable, true);
    assert.equal(routing.record.latitude, expected.latitude);
    assert.equal(routing.record.longitude, expected.longitude);
  } else {
    assert(!safeNormalByRef.has(repdRef));
    assert.equal(routing.found, true);
    assert.equal(routing.selectable, false);
    assert.equal(routing.record.latitude, null);
    assert.equal(routing.record.longitude, null);
  }
}
assert.equal(routingModule.resolveRoutingRecord(decoded, "012453").found, false, "leading-zero identity matched non-exact repd_ref");
assert.equal(routingModule.resolveRoutingRecord(decoded, "East Pye Solar Farm").found, false, "name matched routing identity");

const app = await readFile(path.join(buildA, "assets/atlas-v9.mjs"), "utf8");
assert(app.indexOf("const normal = featureByRef.get(requested)") < app.indexOf("loadRoutingDeepLinkFallback(release, requested)"), "normal-first precedence drift");
assert(!app.includes('get("longitude")') && !app.includes('get("latitude")'), "runtime trusts query coordinates");
const treeA = await tree(buildA);
const treeB = await tree(buildB);
assert.deepEqual(treeA, treeB, "A/B compiler output differs");
assert.equal(Object.keys(treeA).length, 8);

const report = {
  schema: "gridatlas.exhaustive-repd-coverage-comparator.v1",
  classification: "VERIFIED_EXHAUSTIVE_REPD_ROUTING_COVERAGE",
  release_id: "202608291430-atlas-v9",
  promotion_eligible: true,
  failed: 0,
  deterministic_ab: true,
  normal_registry: { source_records: 11069, selectable_records: 11033, excluded_false_origin_records: 36, role: "NORMAL_SEARCH_AND_BASE_MAP" },
  routing: {
    projects: 7680,
    map_identities: 7652,
    no_map_identities: 28,
    missing: 26,
    invalid: 2,
    normal_map_overlap: 5233,
    routing_only_map_fallbacks: 2419,
    normal_selectable: 11033,
    excluded_false_origin: 36,
    excluded_false_origin_set_sha256: setHash(excludedFalseOrigin),
    routing_only_map_fallbacks_set_sha256: setHash(fallbacks),
    normal_plus_fallback_union: 13452,
    normal_plus_fallback_union_set_sha256: setHash(finalSelectable),
    missing_map_identities: 0,
    no_map_selectable_intersection: 0,
    false_zero_origin: 0,
    map_set_sha256: setHash(mapRefs),
    no_map_set_sha256: setHash(noMapRefs)
  },
  sentinels,
  exact_repd_ref_only: true,
  query_coordinates_ignored: true,
  files: treeA
};
await mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
await writeFile(path.resolve(args.output), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
