#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/* Two generations, deliberately, because they are two different things.
   The RUNTIME is restamped every time these bytes change - at 202609041945 it
   gained the shared DuckDB broker. The CONTRACT is the behavioural promise the
   cartridge makes, which did not change, so current.json still points at
   202608301825 and this proof must too. Folding them back into one constant is
   how a proof ends up asserting against a file that does not exist. */
const GENERATION = '202609041945';
const CONTRACT_GENERATION = '202608301825';
const ID = 'streaming-parquet-bridge';
const RUNTIME = `atlas/cartridges/${GENERATION}-streaming-parquet-bridge-v9-5.js`;
const CONTRACT = `ui/cartridges/${CONTRACT_GENERATION}-streaming-parquet-bridge-v9-5.mjs`;

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

/* The fast-header check above deliberately leaves the manifest unresolved, so
   it cannot prove that the historic V8 URL actually reaches the differently
   named V9 partition. Execute a second, deterministic copy of the composed
   bridge with only its external DuckDB/manifest dependencies replaced. This
   runs the real legacyStem -> alias -> resolvePartition -> query -> streamed
   GeoJSON path through to a populated source payload. */
const fixtureManifest = {
  schema: 'data-gridatlas.v8-transplant-manifest.v1',
  closure: { sources: 56, layers: 60, features: 541282 },
  artifacts: [{
    path: 'partitions/uk_metros_trams_root.parquet',
    sha256: 'a'.repeat(64),
  }],
};
const fixtureBytes = new TextEncoder().encode(JSON.stringify(fixtureManifest));
const fixtureSha = createHash('sha256').update(fixtureBytes).digest('hex');
const pinnedManifestSha = '3246dbdaa042ae8352ec9b7128cb6c2fe65e4f1aba0534302510661828df2526';
assert.equal(source.split(pinnedManifestSha).length - 1, 1,
  'the composed bridge manifest pin changed without this proof changing');
/* The seam moved at 202609041945 and this proof moved with it, deliberately.
   The import now lives inside sharedDuckDBRuntime(moduleUrl) - the broker that
   makes this cartridge and the search lane share ONE runtime instead of each
   building their own, which was costing a phone two 5.92 MB WebAssembly heaps.
   So the injection point is the broker's import, not the old direct one, and
   the assertion below still insists there is exactly ONE place a runtime can
   enter this cartridge. That is the property worth guarding: not the literal
   text, but that the seam is singular. */
assert.equal(source.split('const duckdb = await import(moduleUrl);').length - 1, 1,
  'the DuckDB seam changed without this proof changing');
assert.equal(source.split('await import(DUCKDB_MODULE)').length - 1, 0,
  'a second, direct DuckDB import reappeared alongside the shared broker');
const instrumentedSource = source
  .replace(pinnedManifestSha, fixtureSha)
  .replace('const duckdb = await import(moduleUrl);',
    'const duckdb = window.__GRIDATLAS_TEST_DUCKDB__;');

let querySql = '';
let manifestCalls = 0;
const fakeDuckdb = {
  getJsDelivrBundles: () => ({}),
  selectBundle: async () => ({ mainModule: 'fixture.wasm', mainWorker: 'fixture.worker.js' }),
  LogLevel: { WARNING: 'warning' },
  ConsoleLogger: class ConsoleLogger {},
  AsyncDuckDB: class AsyncDuckDB {
    async instantiate() {}
    async connect() {
      return {
        query: async (sql) => {
          querySql = String(sql);
          return {
            toArray: () => [{
              source_id: 'uk_metros_trams_root',
              feature_index: 0,
              feature_id: 'dlr-fixture-0',
              geometry_json: JSON.stringify({
                type: 'LineString',
                coordinates: [[-0.1, 51.5], [-0.08, 51.51]],
              }),
              properties_json: JSON.stringify({ operator: 'Docklands Light Railway' }),
            }],
          };
        },
        close: async () => {},
      };
    }
  },
};
const nativeFetch2 = async (input) => {
  const url = String(input?.url || input);
  assert.match(url, /202608291237-data-gridatlas\/data\/manifest\.json$/);
  manifestCalls += 1;
  return new Response(fixtureBytes, { status: 200 });
};
const windowObject2 = {
  location: { href: 'https://ventusltd.github.io/gridatlas/atlas/' },
  fetch: nativeFetch2,
  __GRIDATLAS_TEST_DUCKDB__: fakeDuckdb,
};
windowObject2.window = windowObject2;
const context2 = vm.createContext({
  window: windowObject2,
  URL,
  Blob,
  Worker: class Worker {},
  crypto: globalThis.crypto,
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
  queueMicrotask() {},
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
});
vm.runInContext(instrumentedSource, context2, { filename: `${RUNTIME}:full-source-load` });
const fullResponse = await windowObject2.fetch(
  'https://ventusltd.github.io/gridatlas/atlas/data/uk_metros_trams.geojson',
);
const fullPayload = await fullResponse.json();
const fullState = windowObject2.__GRIDATLAS_MAP_READY__;
const metroPath = '/gridatlas/atlas/data/uk_metros_trams.geojson';
assert.equal(fullPayload.type, 'FeatureCollection');
assert.equal(fullPayload.features.length, 1);
assert.equal(fullPayload.features[0].properties.operator, 'Docklands Light Railway');
assert.match(querySql,
  /read_parquet\('https:\/\/ventusltd\.github\.io\/data-gridatlas\/202608291237-data-gridatlas\/data\/partitions\/uk_metros_trams_root\.parquet'\)/);
assert.equal(fullState.loaded_on_demand[metroPath].parquet,
  'partitions/uk_metros_trams_root.parquet');
assert.equal(fullState.loaded_on_demand[metroPath].rows, 1);
assert.equal(fullState.loaded_on_demand[metroPath].sha256, 'a'.repeat(64));
assert.equal(fullState.parquet_requests, 1);
assert.equal(fullState.released_payloads, 1);
assert.equal(fullState.failures.length, 0);
assert.equal(fullState.stream_failures.length, 0);
assert.equal(manifestCalls, 1);

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
  metro_partition: fullState.loaded_on_demand[metroPath].parquet,
  metro_rows_reconstructed: fullPayload.features.length,
}, null, 2));
