/**
 * GridAtlas substation intelligence, generation 202609011751 (UTC), composition v9.57.
 * Slot: replace-script for 202608292126-map-ready-fetch-bridge.js.
 *
 * PART 1 is that bridge, carried forward VERBATIM. It is the shell's own
 * data plane - the fetch interception that lets the Atlas serve its map
 * layers from the parquet data plane - and this cartridge claims its slot
 * without changing a byte of it. Behaviour preserved, same public state
 * object, same failure mode.
 *
 * PART 2 is new: what the system operator publishes about a substation.
 *
 * WHY IT EXISTS
 *   The Atlas measured projects against OpenStreetMap substations, which
 *   know a name and a location and nothing else. A card could say "Cottam
 *   Substation, 400 kV, 10.82 km" and could not say how many circuits meet
 *   there, what they are rated at, what the fault level is, or that the
 *   operator has already published seventeen changes at that node. All of
 *   that is public - NESO's Electricity Ten Year Statement appendices -
 *   and now sits clean in Ventusltd/data-grid-gb.
 *
 * WHAT IT DOES AND WILL NOT DO
 *   It fetches one 357 kB product, indexes it by name and by position,
 *   and answers questions. It renders nothing and decorates nothing: the
 *   sandbox owns the card, this owns the computation. And it never grades
 *   a connection - a rating is a rating and a fault level is a fault
 *   level; queue position, committed connections, consent and commercial
 *   terms decide connection, and no published appendix contains them.
 *
 *   Fails closed. A product whose schema is not the one this was written
 *   against yields no answers at all, loudly, rather than plausible ones.
 */
(() => {
  'use strict';

  const GENERATION = '202608292126';
  const DATA_BASE = 'https://ventusltd.github.io/data-gridatlas/202608291237-data-gridatlas/';
  const MANIFEST_URL = `${DATA_BASE}data/manifest.json`;
  const MANIFEST_SHA256 = '3246dbdaa042ae8352ec9b7128cb6c2fe65e4f1aba0534302510661828df2526';
  const DUCKDB_MODULE = 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
  const CRITICAL_PATH = 'data/grid_400kv.geojson';
  const MAP_READY_PATHS = new Set([
    'data/grid_400kv.geojson',
    'data/grid_275kv.geojson',
    'data/grid_220kv.geojson',
    'data/grid_132kv.geojson',
    'data/grid_66kv.geojson',
    'data/grid_substations.geojson',
    'data/power_plants.geojson',
    'data/industrial_offtakers.geojson',
    'data/datacentres.geojson',
    'data/airports.geojson',
    'data/railways.geojson'
  ]);

  const nativeFetch = window.fetch.bind(window);
  const sourceCache = new Map();
  let manifestPromise = null;
  let runtimePromise = null;

  const state = {
    schema: 'gridatlas.map-ready-fetch-bridge.v1',
    generation: GENERATION,
    data_release: '202608291237-data-gridatlas',
    architecture: {
      map_ready_same_origin_geojson: true,
      preload_browser_duckdb: false,
      serialized_preload_queue: false,
      topology_pre_snapped: true,
      analytical_search_duckdb_retained: true
    },
    critical_prefetch: {
      path: CRITICAL_PATH,
      started_at_ms: performance.now(),
      ready_at_ms: null,
      bytes: 0,
      hits: 0,
      failures: []
    },
    map_ready_requests: 0,
    map_ready_paths: [...MAP_READY_PATHS],
    parquet_requests: 0,
    duckdb_runtime_started: false,
    duckdb_runtime_started_at_ms: null,
    intercepted_on_demand: 0,
    loaded_on_demand: {},
    failures: []
  };
  window.__GRIDATLAS_MAP_READY__ = state;

  function invariant(condition, message) {
    if (!condition) throw new Error(message);
  }

  function requestPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      return new URL(raw, window.location.href).pathname;
    } catch {
      return '';
    }
  }

  function mapReadyKey(pathname) {
    const marker = '/data/';
    const index = pathname.toLowerCase().lastIndexOf(marker);
    if (index < 0) return '';
    return `data/${decodeURIComponent(pathname.slice(index + marker.length)).toLowerCase()}`;
  }

  function legacyStem(pathname) {
    const name = decodeURIComponent(pathname.split('/').pop() || '').toLowerCase();
    if (name === 'repd_master.json') return 'repd_master_v8_oracle';
    if (name === 'heavy_emitters_uk.json') return 'heavy_emitters_uk';
    if (name.endsWith('.geojson')) return name.slice(0, -8);
    return '';
  }

  async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function responseFromBytes(bytes, headers = {}) {
    return new Response(bytes.slice(0), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-GridAtlas-Data-Plane': 'V9-MAP-READY-GEOJSON',
        ...headers
      }
    });
  }

  const criticalPrefetchPromise = (async () => {
    try {
      const url = new URL(CRITICAL_PATH, document.baseURI).href;
      const response = await nativeFetch(url, { cache: 'force-cache' });
      invariant(response.ok, `critical map-ready HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      state.critical_prefetch.bytes = bytes.byteLength;
      state.critical_prefetch.ready_at_ms = performance.now();
      return bytes;
    } catch (error) {
      const failure = String(error?.message || error);
      state.critical_prefetch.failures.push(failure);
      throw error;
    }
  })();

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
      state.duckdb_runtime_started = true;
      state.duckdb_runtime_started_at_ms = performance.now();
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
      return { database, worker };
    })();
    return runtimePromise;
  }

  async function resolvePartition(pathname) {
    const stem = legacyStem(pathname);
    invariant(stem, `unsupported V8 data path: ${pathname}`);
    const expected = `partitions/${stem}.parquet`.toLowerCase();
    const manifest = await getManifest();
    const artifact = (manifest.artifacts || []).find(
      item => String(item.path || '').toLowerCase() === expected
    );
    invariant(artifact, `no V9 Parquet partition for V8 source ${pathname}`);
    invariant(/^[a-f0-9]{64}$/.test(artifact.sha256 || ''), `bad partition digest for ${artifact.path}`);
    return artifact;
  }

  function rowObject(row) {
    return row && typeof row.toJSON === 'function' ? row.toJSON() : row;
  }

  async function queryOnDemand(pathname) {
    if (sourceCache.has(pathname)) return sourceCache.get(pathname);
    const task = (async () => {
      const artifact = await resolvePartition(pathname);
      const parquetUrl = `${DATA_BASE}data/${artifact.path}`;
      const { database } = await getRuntime();
      const connection = await database.connect();
      state.parquet_requests += 1;
      try {
        const escaped = parquetUrl.replaceAll("'", "''");
        const table = await connection.query(`
          SELECT source_id, feature_index, feature_id, geometry_json, properties_json
          FROM read_parquet('${escaped}')
          ORDER BY feature_index
        `);
        const features = table.toArray().map(raw => {
          const row = rowObject(raw);
          return {
            type: 'Feature',
            id: row.feature_id || `${row.source_id}:${row.feature_index}`,
            geometry: JSON.parse(String(row.geometry_json)),
            properties: JSON.parse(String(row.properties_json || '{}'))
          };
        });
        state.loaded_on_demand[pathname] = {
          parquet: artifact.path,
          rows: features.length,
          sha256: artifact.sha256
        };
        return { type: 'FeatureCollection', features };
      } finally {
        await connection.close();
      }
    })();
    sourceCache.set(pathname, task);
    try {
      return await task;
    } catch (error) {
      sourceCache.delete(pathname);
      state.failures.push({ pathname, message: String(error?.message || error) });
      throw error;
    }
  }

  window.fetch = async function gridAtlasMapReadyFetch(input, init = undefined) {
    const pathname = requestPath(input);
    const readyKey = mapReadyKey(pathname);

    if (MAP_READY_PATHS.has(readyKey)) {
      state.map_ready_requests += 1;
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (readyKey === CRITICAL_PATH) {
        state.critical_prefetch.hits += 1;
        const bytes = await criticalPrefetchPromise;
        if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return responseFromBytes(bytes);
      }
      return nativeFetch(input, { ...(init || {}), cache: 'force-cache' });
    }

    if (!legacyStem(pathname)) return nativeFetch(input, init);

    state.intercepted_on_demand += 1;
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const payload = await queryOnDemand(pathname);
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Cache-Control': 'private, max-age=3600',
        'X-GridAtlas-Data-Plane': 'V9-PARQUET-DUCKDB-ON-DEMAND'
      }
    });
  };
})(); 


/* ══════════════════════════════════════════════════════════════════════
   PART 2 - the network, as its operator publishes it
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const GENERATION = '202609011751';
  const PRODUCT = 'https://raw.githubusercontent.com/Ventusltd/data-grid-gb/'
    + 'main/derived/connection-points.v1.json';
  const REQUIRED_SCHEMA = 'data-grid-gb.connection-points.v1';
  const EARTH_RADIUS_KM = 6378.137;   // one radius, the estate's own
  const DEG = Math.PI / 180;

  const state = {
    schema: 'gridatlas.substation-intelligence.v1',
    generation: GENERATION,
    product: PRODUCT,
    loaded: false,
    points: 0,
    located: 0,
    with_fault_level: 0,
    product_schema: null,
    failures: []
  };
  window.__GRIDATLAS_NETWORK__ = state;

  function distanceKm(lon1, lat1, lon2, lat2) {
    const dLat = (lat2 - lat1) * DEG;
    const dLon = (lon2 - lon1) * DEG;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
  }

  /* The same normalisation the product's own join uses, so a name that
     matched there matches here. Kept deliberately dull: this is a lookup
     key, not a search engine. */
  const NOISE = /\b(SUBSTATION|SUB STATION|SUBSTN|GRID|SUPPLY|POINT|GSP|NATIONAL|POWER|STATION|WIND|FARM|WINDFARM|OFFSHORE|ONSHORE|EXTENSION|400KV|275KV|132KV|66KV|33KV|11KV|NGET|SSE|SP|SHE)\b/g;
  function normalise(name) {
    return String(name || '').toUpperCase()
      .replace(/[^A-Z0-9 ]/g, ' ').replace(NOISE, ' ')
      .split(/\s+/).filter(Boolean).join(' ');
  }

  const byName = new Map();
  const located = [];

  const ready = (async () => {
    try {
      /* Revalidated, never pinned to first sight: the lesson v9.42 paid
         for on the price panel. The product is versioned and will move. */
      const response = await fetch(PRODUCT, { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const product = await response.json();
      state.product_schema = product?.schema || null;
      if (product?.schema !== REQUIRED_SCHEMA) {
        // Fail closed. A product this was not written against yields
        // nothing at all rather than answers that look right.
        state.failures.push('schema is ' + String(product?.schema)
          + ', this cartridge answers only ' + REQUIRED_SCHEMA);
        return false;
      }
      for (const point of product.connection_points || []) {
        const key = normalise(point.name);
        if (key && !byName.has(key)) byName.set(key, point);
        if (point.location) located.push(point);
      }
      state.points = (product.connection_points || []).length;
      state.located = located.length;
      state.with_fault_level = product.counts?.with_fault_level ?? null;
      state.join = product.join || null;
      state.source = product.source || null;
      state.loaded = true;
      return true;
    } catch (error) {
      state.failures.push('network product: ' + String(error?.message || error));
      return false;
    }
  })();
  state.ready = ready;

  /* ── the questions this cartridge answers ────────────────────────────
     Each returns published facts or null. None returns a judgement, and
     none is allowed to imply one: no "good", no "strong", no "headroom
     available". The reader gets NESO's numbers and decides. */

  state.byName = (name) => {
    if (!state.loaded) return null;
    return byName.get(normalise(name)) || null;
  };

  state.nearest = (lon, lat, options) => {
    if (!state.loaded) return null;
    const minimumKv = options?.minimumKv ?? 0;
    const limit = options?.limit ?? 1;
    const found = [];
    for (const point of located) {
      if (Math.max(...point.voltages_kv) < minimumKv) continue;
      found.push({
        point,
        km: distanceKm(lon, lat, point.location.lon, point.location.lat)
      });
    }
    found.sort((a, b) => a.km - b.km);
    return limit === 1 ? (found[0] || null) : found.slice(0, limit);
  };

  /* One line a card can print, built only from what is published. Returns
     null rather than a sentence when nothing is published, because an
     empty statement about a substation is worse than silence. */
  state.summarise = (name) => {
    const point = state.byName(name);
    if (!point) return null;
    const parts = [];
    if (point.circuits) {
      parts.push(point.circuits + (point.circuits === 1 ? ' circuit' : ' circuits'));
    }
    if (point.transformers) parts.push(point.transformers + ' transformers');
    if (point.circuit_winter_rating_mva) {
      const rating = point.circuit_winter_rating_mva;
      parts.push('winter ratings ' + rating.min.toLocaleString('en-GB')
        + '\u2013' + rating.max.toLocaleString('en-GB') + ' MVA');
    }
    const peak = point.fault_level?.peak;
    if (peak) {
      parts.push('published fault level ' + peak.three_phase_break_ka_min.toFixed(0)
        + '\u2013' + peak.three_phase_break_ka_max.toFixed(0) + ' kA across '
        + peak.snapshots + ' demand snapshots');
    }
    if (point.reactive_compensation?.units) {
      parts.push(point.reactive_compensation.units + ' reactive compensation units');
    }
    if (point.planned_changes) {
      const years = point.planned_change_years || [];
      parts.push(point.planned_changes + ' changes published for '
        + (years.length ? years[0] + '\u2013' + years[years.length - 1] : 'later years'));
    }
    if (!parts.length) return null;
    return {
      site_code: point.site_code,
      transmission_owner: point.transmission_owner,
      voltages_kv: point.voltages_kv,
      sentence: parts.join(' \u00b7 '),
      attribution: 'NESO Electricity Ten Year Statement 2025, appendices B and D',
      not_an_assessment: 'Published parameters. Not a statement about whether '
        + 'any project can connect here.'
    };
  };
})();
