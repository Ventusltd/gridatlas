#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GENERATION = '202608301825';
const ID = 'streaming-parquet-bridge';
const RUNTIME = `atlas/cartridges/${GENERATION}-streaming-parquet-bridge-v9-5.js`;
const CONTRACT = `ui/cartridges/${GENERATION}-streaming-parquet-bridge-v9-5.mjs`;

const source = await readFile(path.join(ROOT, RUNTIME), 'utf8');
const contractSource = await readFile(path.join(ROOT, CONTRACT), 'utf8');
const current = JSON.parse(await readFile(path.join(ROOT, 'atlas', 'current.json'), 'utf8'));
const entry = current.cartridges.find(({ id }) => id === ID);
assert.ok(entry, `${ID} is not in the current composition`);
assert.equal(entry.generation, GENERATION);
assert.equal(entry.path, `./cartridges/${GENERATION}-streaming-parquet-bridge-v9-5.js`);
const servedSource = source.replace(/\r\n/g, '\n');
assert.equal(createHash('sha256').update(servedSource).digest('hex'), entry.sha256,
  'the proof is not reading the composed runtime bytes');

assert.match(contractSource, /responseEstablishedBeforeBodyReconstruction: true/);
assert.match(contractSource, /payloadCacheReleasedAfterSerialisation: true/);
assert.match(contractSource, /duckdbPrewarm: 'after-critical-400kv-source'/);
assert.match(contractSource, /metroPartitionAlias: 'uk_metros_trams_root'/);

let nativeCalls = 0;
let manifestRequested = false;
const never = new Promise(() => {});
const nativeFetch = async (input, init) => {
  nativeCalls += 1;
  const url = String(input?.url || input);
  if (url.includes('manifest.json')) {
    manifestRequested = true;
    return never;
  }
  return { native: true, input, init };
};

const windowObject = {
  location: { href: 'https://ventusltd.github.io/gridatlas/atlas/' },
  fetch: nativeFetch,
};
windowObject.window = windowObject;
const context = vm.createContext({
  window: windowObject,
  URL,
  TextEncoder,
  TextDecoder,
  ReadableStream,
  Response,
  DOMException,
  Promise,
  Map,
  Set,
  JSON,
  console,
  performance,
  queueMicrotask() {}, // prewarm is orthogonal; do not leave a 60 s interval alive
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
});
vm.runInContext(source, context, { filename: RUNTIME });

const state = windowObject.__GRIDATLAS_MAP_READY__;
assert.equal(state.schema, 'gridatlas.maplibre-worker-fetch-bridge.v1');
assert.equal(state.generation, GENERATION);
assert.equal(state.critical_source.eager_window_prefetch, false);
assert.equal(state.duckdb_runtime_started, false);
assert.notEqual(windowObject.fetch, nativeFetch, 'the composed bridge did not install');

const critical = await windowObject.fetch(
  'https://ventusltd.github.io/gridatlas/atlas/data/grid_400kv.geojson',
  { cache: 'no-store' },
);
assert.equal(critical.native, true);
assert.equal(critical.init.cache, 'force-cache');
assert.equal(state.map_ready_requests, 1);
assert.equal(state.critical_source.window_fetch_hits, 1);
assert.equal(state.duckdb_runtime_started, false,
  'a map-ready source must not boot DuckDB on the main path');

const unrelated = await windowObject.fetch('https://example.test/not-grid-data.json', { method: 'GET' });
assert.equal(unrelated.native, true);
assert.equal(unrelated.init.method, 'GET');

const before = performance.now();
const streamed = await windowObject.fetch(
  'https://ventusltd.github.io/gridatlas/atlas/data/uk_metros_trams.geojson',
);
const establishmentMs = performance.now() - before;
assert.ok(streamed instanceof Response);
assert.equal(streamed.status, 200);
assert.equal(streamed.headers.get('X-GridAtlas-Data-Plane'),
  'V9-PARQUET-DUCKDB-STREAMED-RESPONSE');
assert.equal(state.streamed_responses, 1);
assert.equal(state.intercepted_on_demand, 1);
assert.equal(manifestRequested, true,
  'the body producer should have begun while response headers were already available');
assert.equal(state.duckdb_runtime_started, false,
  'response establishment must not wait for the DuckDB import');
assert.ok(establishmentMs < 1000, `streamed response establishment took ${establishmentMs} ms`);
await streamed.body.cancel();

const controller = new AbortController();
controller.abort();
await assert.rejects(
  windowObject.fetch('https://ventusltd.github.io/gridatlas/atlas/data/repd_master.json', {
    signal: controller.signal,
  }),
  (error) => error?.name === 'AbortError',
);
assert.equal(state.intercepted_on_demand, 2);
assert.equal(nativeCalls, 3,
  'only the critical source, unrelated URL and manifest should reach native fetch');

console.log(JSON.stringify({
  status: 'PASS',
  generation: GENERATION,
  composed_sha256: entry.sha256,
  response_establishment_ms: Number(establishmentMs.toFixed(3)),
  map_ready_requests: state.map_ready_requests,
  streamed_responses: state.streamed_responses,
  duckdb_started_before_body: state.duckdb_runtime_started,
}, null, 2));
