#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GENERATION = '202609011141';
const ID = 'uk-gazetteer-flyto';
const RUNTIME = `atlas/cartridges/${GENERATION}-place-global-search-v9-5.js`;
const CONTRACT = `ui/cartridges/${GENERATION}-global-gazetteer-flyto-v9-5.mjs`;
const MANIFEST_DIGEST = '8850567ff9f1d2b6996b4e0d9707320030f3466a0b821cdcfc5325322b8be8c8';

const source = await readFile(path.join(ROOT, RUNTIME), 'utf8');
const contractSource = await readFile(path.join(ROOT, CONTRACT), 'utf8');
const current = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const entry = current.cartridges.find(({ id }) => id === ID);
assert.ok(entry, `${ID} is not in the current composition`);
assert.equal(entry.generation, GENERATION);
assert.equal(entry.path, `./cartridges/${GENERATION}-place-global-search-v9-5.js`);
assert.equal(createHash('sha256').update(source).digest('hex'), entry.sha256,
  'the proof is not reading the composed search runtime bytes');
assert.match(contractSource, /publishesResolvedTechnologyAndCapacity: true/);

const importLine = 'const duckdb = await import(DUCKDB_MODULE);';
assert.equal(source.split(importLine).length - 1, 1,
  'the DuckDB test seam must replace exactly one import');
const executableSource = source.replace(importLine,
  'const duckdb = window.__GRIDATLAS_TEST_DUCKDB__;');

function element() {
  return {
    value: '',
    innerHTML: '',
    className: '',
    dataset: {},
    style: {},
    children: [],
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
  };
}

function digestBuffer(hex) {
  return Uint8Array.from(hex.match(/../gu), (byte) => Number.parseInt(byte, 16)).buffer;
}

async function scenario(search, { projectOverride = {} } = {}) {
  const listeners = new Map();
  const input = element();
  const button = element();
  const results = element();
  const body = { dataset: {} };
  const historyWrites = [];
  const flyToCalls = [];
  const popupCalls = [];
  const querySql = [];
  const loggedErrors = [];
  const project = {
    repd_ref: '12588',
    name: 'Botley West',
    repd_address_display: 'Oxfordshire',
    repd_postcode: 'OX29',
    county: 'Oxfordshire',
    planning_authority: 'West Oxfordshire',
    technology: 'solar',
    status: 'Awaiting Construction',
    capacity_mw: 840,
    longitude: -1.3489728,
    latitude: 51.8132088,
    search_score: 9000,
    ...projectOverride,
  };
  const connection = {
    async query(sql) {
      querySql.push(sql);
      return { toArray: () => [project] };
    },
  };
  class AsyncDuckDB {
    async instantiate() {}
    async connect() { return connection; }
  }
  class Popup {
    constructor() { this.call = {}; popupCalls.push(this.call); }
    setLngLat(value) { this.call.lngLat = value; return this; }
    setHTML(value) { this.call.html = value; return this; }
    addTo(value) { this.call.map = value; return this; }
  }
  class MapConstructor {}
  class Worker {}
  const map = { flyTo(options) { flyToCalls.push(options); } };
  const location = {
    href: `https://ventusltd.github.io/gridatlas/atlas/${search}`,
    search,
  };
  const windowObject = {
    location,
    fetch: async (url) => {
      assert.match(String(url), /repd_v9_manifest_202608290716\.json$/u);
      return new Response(JSON.stringify({
        schema: 'gridatlas.build-manifest.v1',
        generation: '202608290716',
        closure: { rows: 11069, postcodes: 9505, addresses: 11059 },
        parquet: { sha256: '174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b' },
      }), { status: 200 });
    },
    maplibregl: { Map: MapConstructor, Popup },
    __GRIDATLAS_V9_MAP__: map,
    __GRIDATLAS_TEST_DUCKDB__: {
      selectBundle: async () => ({ mainModule: 'main.wasm', mainWorker: 'worker.js' }),
      getJsDelivrBundles: () => ({}),
      ConsoleLogger: class {},
      LogLevel: { WARNING: 'WARNING' },
      AsyncDuckDB,
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
  };
  windowObject.window = windowObject;
  const context = vm.createContext({
    window: windowObject,
    fetch: (...args) => windowObject.fetch(...args),
    document: {
      body,
      getElementById(id) {
        return { 'search-input': input, 'search-btn': button, 'search-results': results }[id] || null;
      },
      createElement: element,
    },
    history: {
      state: null,
      replaceState(state, title, url) { historyWrites.push({ state, title, url: String(url) }); },
    },
    URL,
    URLSearchParams,
    Blob,
    Worker,
    Response,
    TextDecoder,
    Uint8Array,
    Promise,
    Proxy,
    Reflect,
    Map,
    Set,
    JSON,
    console: { ...console, error: (...values) => loggedErrors.push(values) },
    performance,
    crypto: { subtle: { digest: async () => digestBuffer(MANIFEST_DIGEST) } },
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(executableSource, context, { filename: RUNTIME });
  assert.ok(listeners.has('DOMContentLoaded'), 'search runtime did not register its boot handler');
  listeners.get('DOMContentLoaded')();
  const state = windowObject.__GRIDATLAS_PLACE_SEARCH__;
  const started = performance.now();
  while (!['RESOLVED', 'FAILED', 'ABSENT'].includes(state.deep_link.status)) {
    if (performance.now() - started > 2000) throw new Error('deep-link fixture did not settle');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return {
    state, input, body, historyWrites, flyToCalls, popupCalls, querySql,
    loggedErrors,
  };
}

const resolved = await scenario('?repd_ref=12588');
assert.equal(resolved.state.ready, true);
assert.equal(resolved.state.deep_link.status, 'RESOLVED');
assert.equal(resolved.state.deep_link.repd_ref, '12588');
assert.equal(resolved.state.deep_link.name, 'Botley West');
assert.equal(resolved.state.deep_link.longitude, -1.3489728);
assert.equal(resolved.state.deep_link.latitude, 51.8132088);
assert.equal(resolved.state.deep_link.technology, 'solar');
assert.equal(resolved.state.deep_link.capacity_mw, 840);
assert.equal(resolved.state.last_selection.repd_ref, '12588');
assert.equal(resolved.state.last_selection.technology, 'solar');
assert.equal(resolved.state.last_selection.capacity_mw, 840);
assert.equal(resolved.state.last_selection.mapped, true);
assert.equal(resolved.input.value, '12588');
assert.equal(resolved.body.dataset.gridatlasRepdRef, '12588');
assert.equal(resolved.body.dataset.gridatlasRepdDeepLink, 'resolved');
assert.equal(resolved.flyToCalls.length, 1);
assert.deepEqual(Array.from(resolved.flyToCalls[0].center), [-1.3489728, 51.8132088]);
assert.equal(resolved.popupCalls.length, 1);
assert.equal(resolved.historyWrites.length, 1);
assert.match(resolved.historyWrites[0].url, /repd_ref=12588/u);
assert.equal(resolved.querySql.length, 1);
assert.match(resolved.querySql[0], /upper\(coalesce\(repd_ref,''\)\)/u);
assert.equal(resolved.loggedErrors.length, 0);

const absent = await scenario('');
assert.equal(absent.state.deep_link.status, 'ABSENT');
assert.equal(absent.state.query_count, 0);
assert.equal(absent.flyToCalls.length, 0);
assert.equal(absent.loggedErrors.length, 0);

const invalid = await scenario('?repd_ref=%21%21');
assert.equal(invalid.state.deep_link.status, 'FAILED');
assert.equal(invalid.state.deep_link.repd_ref, '!!');
assert.match(invalid.state.deep_link.message, /invalid exact REPD deep-link identity/u);
assert.equal(invalid.state.query_count, 0);
assert.equal(invalid.flyToCalls.length, 0);
assert.equal(invalid.loggedErrors.length, 1);

const mismatched = await scenario('?repd_ref=12588', {
  projectOverride: { repd_ref: '99999', name: 'Different project' },
});
assert.equal(mismatched.state.deep_link.status, 'FAILED');
assert.equal(mismatched.state.deep_link.repd_ref, '12588');
assert.match(mismatched.state.deep_link.message,
  /official REPD identity 12588 was not found/u);
assert.equal(mismatched.state.last_selection, null,
  'a broad or stale result must not become the selected project');
assert.equal(mismatched.flyToCalls.length, 0,
  'a broad or stale result must not move the map');
assert.equal(mismatched.popupCalls.length, 0,
  'a broad or stale result must not open a project card');
assert.equal(mismatched.loggedErrors.length, 1);

console.log(JSON.stringify({
  status: 'PASS',
  generation: GENERATION,
  composed_sha256: entry.sha256,
  resolved_identity: {
    repd_ref: resolved.state.deep_link.repd_ref,
    technology: resolved.state.deep_link.technology,
    capacity_mw: resolved.state.deep_link.capacity_mw,
    longitude: resolved.state.deep_link.longitude,
    latitude: resolved.state.deep_link.latitude,
  },
  terminal_states: ['RESOLVED', 'ABSENT', 'FAILED'],
  mismatched_identity: 'REJECTED',
}, null, 2));
