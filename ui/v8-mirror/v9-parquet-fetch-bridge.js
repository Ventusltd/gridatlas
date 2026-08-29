(() => {
  'use strict';

  const DATA_BASE = 'https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/';
  const MANIFEST_URL = `${DATA_BASE}data/manifest.json`;
  const MANIFEST_SHA256 = '3246dbdaa042ae8352ec9b7128cb6c2fe65e4f1aba0534302510661828df2526';
  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
  const nativeFetch = window.fetch.bind(window);
  const sourceCache = new Map();
  let manifestPromise = null;
  let runtimePromise = null;
  let queue = Promise.resolve();

  const state = {
    schema: 'gridatlas.v9-v8-parquet-fetch-bridge.v1',
    dataRelease: '202608291237-data-gridatlas',
    intercepted: 0,
    loaded: {},
    failures: []
  };
  window.__GRIDATLAS_V9_BRIDGE__ = state;

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  async function getManifest() {
    manifestPromise ||= (async () => {
      const response = await nativeFetch(MANIFEST_URL, { cache: 'no-store' });
      invariant(response.ok, `manifest HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      invariant(await sha256Hex(bytes) === MANIFEST_SHA256, 'data manifest SHA-256 mismatch');
      const manifest = JSON.parse(new TextDecoder().decode(bytes));
      invariant(manifest?.schema === 'data-gridatlas.v8-transplant-manifest.v1', 'data manifest schema mismatch');
      invariant(manifest?.closure?.sources === 56, 'V8 source closure mismatch');
      invariant(manifest?.closure?.layers === 60, 'V8 layer closure mismatch');
      invariant(manifest?.closure?.features === 541282, 'V8 feature closure mismatch');
      return manifest;
    })();
    return manifestPromise;
  }

  async function getRuntime() {
    runtimePromise ||= (async () => {
      const duckdb = await import(DUCKDB_MODULE);
      const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
      invariant(bundle?.mainModule && bundle?.mainWorker, 'DuckDB-WASM bundle unavailable');
      const workerUrl = URL.createObjectURL(new Blob([
        `importScripts(${JSON.stringify(bundle.mainWorker)});`
      ], { type: 'text/javascript' }));
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      const database = new duckdb.AsyncDuckDB(logger, worker);
      try {
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
      } finally {
        URL.revokeObjectURL(workerUrl);
      }
      const connection = await database.connect();
      return { connection, database, worker };
    })();
    return runtimePromise;
  }

  function requestPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      return new URL(raw, window.location.href).pathname;
    } catch {
      return '';
    }
  }

  function legacyStem(pathname) {
    const name = decodeURIComponent(pathname.split('/').pop() || '').toLowerCase();
    if (name === 'repd_master.json') return 'repd_master_v8_oracle';
    if (name === 'heavy_emitters_uk.json') return 'heavy_emitters_uk';
    if (name.endsWith('.geojson')) return name.slice(0, -8);
    return '';
  }

  function shouldIntercept(pathname) {
    return Boolean(legacyStem(pathname));
  }

  async function resolvePartition(pathname) {
    const stem = legacyStem(pathname);
    invariant(stem, `unsupported V8 data path: ${pathname}`);
    const expected = `partitions/${stem}.parquet`.toLowerCase();
    const manifest = await getManifest();
    const artifact = (manifest.artifacts || []).find(item => String(item.path || '').toLowerCase() === expected);
    invariant(artifact, `no V9 Parquet partition for V8 source ${pathname}`);
    invariant(/^[a-f0-9]{64}$/.test(artifact.sha256 || ''), `bad partition digest for ${artifact.path}`);
    return artifact;
  }

  function rowObject(row) {
    return row && typeof row.toJSON === 'function' ? row.toJSON() : row;
  }

  async function querySource(pathname) {
    if (sourceCache.has(pathname)) return sourceCache.get(pathname);
    const task = async () => {
      const artifact = await resolvePartition(pathname);
      const parquetUrl = `${DATA_BASE}data/${artifact.path}`;
      const { connection } = await getRuntime();
      const escaped = parquetUrl.replaceAll("'", "''");
      const table = await connection.query(`
        SELECT source_id, feature_index, feature_id, geometry_json, properties_json
        FROM read_parquet('${escaped}')
        ORDER BY feature_index
      `);
      const features = table.toArray().map(raw => {
        const row = rowObject(raw);
        const geometry = JSON.parse(String(row.geometry_json));
        const properties = JSON.parse(String(row.properties_json || '{}'));
        return {
          type: 'Feature',
          id: row.feature_id || `${row.source_id}:${row.feature_index}`,
          geometry,
          properties
        };
      });
      state.loaded[pathname] = {
        parquet: artifact.path,
        rows: features.length,
        sha256: artifact.sha256
      };
      return { type: 'FeatureCollection', features };
    };
    const result = queue.then(task, task);
    queue = result.catch(() => {});
    sourceCache.set(pathname, result);
    try {
      return await result;
    } catch (error) {
      sourceCache.delete(pathname);
      state.failures.push({ pathname, message: String(error?.message || error) });
      throw error;
    }
  }

  window.fetch = async function gridAtlasV9Fetch(input, init = undefined) {
    const pathname = requestPath(input);
    if (!shouldIntercept(pathname)) return nativeFetch(input, init);
    state.intercepted += 1;
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const payload = await querySource(pathname);
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-GridAtlas-Data-Plane': 'V9-PARQUET-DUCKDB'
      }
    });
  };
})();
