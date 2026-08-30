const RELEASE_SCHEMA = "gridatlas.timestamped-live-release.v1";
const REGISTRY_SCHEMA = "data-gridatlas.live-browser-layer-registry.v1";
const DATA_RELEASE_SCHEMA = "data-gridatlas.immutable-live-data-release.v1";
const SAFE_LAYER_ID = /^[a-z0-9_]+$/;
const SAFE_PARQUET_PATH = /^(?:partitions|derived)\/[a-z0-9_]+\.parquet$/;
const SAFE_LIVE_PARQUET_PATH = /^data\/(?:partitions|derived)\/[a-z0-9_]+\.parquet$/;
const SHA256 = /^[a-f0-9]{64}$/;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function hasPlaceholder(value) {
  return typeof value === "string" && value.includes("__");
}

function normaliseBaseUrl(value) {
  const url = new URL(value);
  invariant(url.protocol === "https:", "data release must use HTTPS");
  invariant(url.hostname === "ventusltd.github.io", "unexpected data release host");
  invariant(url.pathname.endsWith("/202608291237-data-gridatlas/"), "unexpected immutable data release path");
  url.search = "";
  url.hash = "";
  return url.href;
}

export function validateReleaseManifest(manifest, { sealed = true } = {}) {
  invariant(manifest?.schema === RELEASE_SCHEMA, "application release schema mismatch");
  invariant(manifest.release_id === "202608291239-atlas-v9", "application release identity mismatch");
  invariant(manifest.generation === "202608291239", "application generation mismatch");
  invariant(manifest.classification === "LIVE_RELEASE", "application is not classified live");
  invariant(manifest.immutable === true && manifest.current === true, "application release flags are not live and immutable");
  invariant(manifest.parent_release?.commit === "514fce2f3605ae53267c5ee955b301604a91b2fd", "last-green parent drift");
  invariant(manifest.repd?.generation === "202608290716" && manifest.repd.rows === 11069, "REPD preservation contract mismatch");
  invariant(manifest.data_release?.source_generation === "202608291015", "data generation mismatch");
  invariant(manifest.data_release?.release_id === "202608291237-data-gridatlas", "data release identity mismatch");
  invariant(manifest.data_release?.layers === 60 && manifest.data_release?.sources === 56, "data closure mismatch");
  invariant(manifest.data_release?.release_path === "release.json", "data release path mismatch");
  invariant(manifest.data_release?.browser_registry_path === "browser-layer-registry.json", "browser registry path mismatch");
  invariant(manifest.data_release?.data_root === "data/", "data root mismatch");
  invariant(manifest.loading_contract?.parquet_on_boot === 0, "Parquet boot budget must be zero");
  invariant(manifest.loading_contract?.activation === "EXPLICIT_USER_LAYER_TOGGLE", "layer activation is not lazy");
  normaliseBaseUrl(manifest.data_release.base_url);
  if (sealed) {
    for (const [name, value] of Object.entries({
      source_commit: manifest.source_commit,
      data_source_commit: manifest.data_release.source_commit,
      data_release_sha256: manifest.data_release.release_sha256,
      data_registry_sha256: manifest.data_release.browser_registry_sha256,
      created_at: manifest.created_at,
      committed_at: manifest.committed_at
    })) invariant(!hasPlaceholder(value), `${name} is not sealed`);
    invariant(SHA256.test(manifest.data_release.release_sha256), "data release digest is invalid");
    invariant(SHA256.test(manifest.data_release.browser_registry_sha256), "browser registry digest is invalid");
    invariant(/^[a-f0-9]{40}$/.test(manifest.source_commit), "application source commit is invalid");
    invariant(/^[a-f0-9]{40}$/.test(manifest.data_release.source_commit), "data source commit is invalid");
    invariant(/^\d{4}-\d{2}-\d{2}T/.test(manifest.committed_at), "application commit timestamp is invalid");
  }
  return manifest;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function fetchVerifiedJson(url, expectedSha256, expectedBytes = null) {
  invariant(SHA256.test(expectedSha256), `invalid expected digest for ${url}`);
  const response = await fetch(url, { cache: "no-store" });
  invariant(response.ok, `${url} returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (Number.isInteger(expectedBytes)) invariant(bytes.byteLength === expectedBytes, `${url} byte count mismatch`);
  invariant(await sha256Hex(bytes) === expectedSha256, `${url} SHA-256 mismatch`);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function dataUrl(release, path) {
  invariant(typeof path === "string" && !path.startsWith("/") && !path.includes(".."), `unsafe data path: ${path}`);
  const base = normaliseBaseUrl(release.data_release.base_url);
  const resolved = new URL(path, base);
  invariant(resolved.href.startsWith(base), `data path escaped immutable release: ${path}`);
  return resolved.href;
}

function payloadUrl(release, path) {
  invariant(release.data_release.data_root === "data/", "data root mismatch");
  const livePath = path.startsWith("data/") ? path : `${release.data_release.data_root}${path}`;
  invariant(SAFE_LIVE_PARQUET_PATH.test(livePath) || livePath === "data/layer_membership.parquet", `unsafe payload path: ${livePath}`);
  return dataUrl(release, livePath);
}

function flattenLayers(registry) {
  invariant(Array.isArray(registry.groups), "browser layer groups missing");
  const layers = [];
  registry.groups.forEach((group, groupIndex) => {
    invariant(typeof group.group === "string" && Array.isArray(group.layers), `invalid group ${groupIndex}`);
    group.layers.forEach((layer, layerIndex) => {
      invariant(SAFE_LAYER_ID.test(layer.id), `unsafe layer id: ${layer.id}`);
      invariant(SAFE_PARQUET_PATH.test(layer.v9_data?.parquet_path || ""), `unsafe Parquet path for ${layer.id}`);
      invariant(layer.v9_data?.parquet_url === `data/${layer.v9_data.parquet_path}`, `live Parquet alias mismatch for ${layer.id}`);
      invariant(layer.v9_data?.membership_url === "data/layer_membership.parquet", `membership alias mismatch for ${layer.id}`);
      invariant(layer.v9_data?.data_live === true, `layer is not live: ${layer.id}`);
      invariant(layer.available === true && layer.publishable === true && layer.enabled === true, `layer is not selectable: ${layer.id}`);
      invariant(layer.default_visible === false && layer.preload === false, `layer violates lazy startup: ${layer.id}`);
      invariant(typeof layer.v9_data?.source_id === "string", `source id missing for ${layer.id}`);
      layers.push(Object.freeze({ ...layer, group: group.group, groupIndex, layerIndex }));
    });
  });
  invariant(layers.length === 60, `expected 60 layers, received ${layers.length}`);
  invariant(new Set(layers.map(layer => layer.id)).size === 60, "duplicate layer ids");
  return layers;
}

export function validateDataClosure(release, dataRelease, registry) {
  invariant(dataRelease?.schema === DATA_RELEASE_SCHEMA, "data release schema mismatch");
  invariant(dataRelease.release_id === release.data_release.release_id, "data release identity mismatch");
  invariant(dataRelease.classification === "LIVE_IMMUTABLE_DATA_RELEASE", "data release classification mismatch");
  invariant(dataRelease.release === true && dataRelease.immutable === true && dataRelease.current_pointer === false, "data release flags mismatch");
  invariant(dataRelease.v8_untouched === true, "data release changed V8");
  invariant(dataRelease.authority_licence_and_quarantine_labels_preserved === true, "data evidence labels were not preserved");
  invariant(dataRelease.candidate_closure?.features === 541282 && dataRelease.candidate_closure?.layers === 60 && dataRelease.candidate_closure?.sources === 56, "data release closure mismatch");
  invariant(dataRelease.candidate_closure?.layer_membership_rows === 526388, "data membership closure mismatch");
  invariant(Array.isArray(dataRelease.files) && dataRelease.files.some(item => item.path === "data/layer_membership.parquet"), "data release membership file missing");
  invariant(registry?.schema === REGISTRY_SCHEMA, "browser registry schema mismatch");
  invariant(registry.generation === release.data_release.release_id, "browser registry generation mismatch");
  invariant(registry.candidate_generation === release.data_release.source_generation, "browser registry candidate generation mismatch");
  invariant(registry.classification === "LIVE_IMMUTABLE_DATA_RELEASE", "browser registry classification mismatch");
  invariant(registry.release === true && registry.current_pointer === false && registry.pages_publication === true, "browser registry flags mismatch");
  invariant(registry.data_base_path === "data/", "browser registry data root mismatch");
  invariant(registry.base_url === release.data_release.base_url, "browser registry base URL mismatch");
  invariant(registry.load_policy?.initial_fetches === 0, "browser registry startup fetch budget mismatch");
  invariant(registry.load_policy?.fetch_on_user_enable_only === true, "browser registry is not user-lazy");
  invariant(Array.isArray(registry.load_policy?.default_visible_layers) && registry.load_policy.default_visible_layers.length === 0, "browser registry has startup-visible layers");
  return flattenLayers(registry);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function finiteBound(value, name) {
  const number = Number(value);
  invariant(Number.isFinite(number), `invalid map bound ${name}`);
  return number;
}

export function normaliseBounds(bounds) {
  const west = finiteBound(bounds.west, "west");
  const south = finiteBound(bounds.south, "south");
  const east = finiteBound(bounds.east, "east");
  const north = finiteBound(bounds.north, "north");
  invariant(west >= -180 && west <= 180 && east >= -180 && east <= 180, "longitude bound outside WGS84");
  invariant(south >= -90 && south <= 90 && north >= -90 && north <= 90 && south <= north, "latitude bound outside WGS84");
  return { west, south, east, north };
}

export function buildLayerQuery(release, layer, bounds) {
  invariant(SAFE_LAYER_ID.test(layer.id), "unsafe layer id");
  invariant(SAFE_PARQUET_PATH.test(layer.v9_data?.parquet_path || ""), "unsafe layer Parquet path");
  const box = normaliseBounds(bounds);
  const partitionUrl = payloadUrl(release, layer.v9_data.parquet_url || layer.v9_data.parquet_path);
  const membershipUrl = payloadUrl(release, `${release.data_release.data_root}${release.data_release.membership_path}`);
  const longitudeClause = box.west <= box.east
    ? `p.max_x >= ${box.west} AND p.min_x <= ${box.east}`
    : `(p.max_x >= ${box.west} OR p.min_x <= ${box.east})`;
  return `
    SELECT p.source_id, p.feature_index, p.feature_id,
           p.geometry_type, p.geometry_json, p.properties_json,
           p.original_feature_sha256, p.projected_feature_sha256
    FROM read_parquet(${sqlLiteral(partitionUrl)}) AS p
    SEMI JOIN read_parquet(${sqlLiteral(membershipUrl)}) AS m
      ON m.source_id = p.source_id
     AND m.feature_index = p.feature_index
     AND m.layer_id = ${sqlLiteral(layer.id)}
    WHERE ${longitudeClause}
      AND p.max_y >= ${box.south} AND p.min_y <= ${box.north}
    ORDER BY p.feature_index
  `.trim();
}

function plainArrowRow(row) {
  return row && typeof row.toJSON === "function" ? row.toJSON() : row;
}

export function rowsToGeoJSON(rows, layer) {
  const features = [];
  for (const arrowRow of rows) {
    const row = plainArrowRow(arrowRow);
    const geometry = JSON.parse(String(row.geometry_json));
    const properties = JSON.parse(String(row.properties_json || "{}"));
    features.push({
      type: "Feature",
      id: `${row.source_id}:${row.feature_index}`,
      geometry,
      properties: {
        ...properties,
        _atlas_layer_id: layer.id,
        _atlas_source_id: String(row.source_id),
        _atlas_feature_index: Number(row.feature_index),
        _atlas_original_sha256: String(row.original_feature_sha256),
        _atlas_projected_sha256: String(row.projected_feature_sha256)
      }
    });
  }
  return { type: "FeatureCollection", features };
}

async function instantiateDuckDb(release, onStatus) {
  const dependency = release.runtime_dependencies.find(item => item.id === "duckdb-wasm");
  invariant(dependency?.version === "1.29.0", "DuckDB-WASM pin mismatch");
  onStatus("Starting browser DuckDB…");
  const testModule = globalThis.__GRIDATLAS_DUCKDB_TEST_MODULE__;
  const duckdb = testModule || await import(dependency.module);
  globalThis.__GRIDATLAS_DUCKDB_MODE__ = testModule ? "test" : "real";
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  invariant(bundle?.mainModule && bundle?.mainWorker, "no compatible DuckDB-WASM bundle");
  const workerUrl = URL.createObjectURL(new Blob([`importScripts(${JSON.stringify(bundle.mainWorker)});`], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const database = new duckdb.AsyncDuckDB(logger, worker);
  try {
    await database.instantiate(bundle.mainModule, bundle.pthreadWorker);
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
  const connection = await database.connect();
  return { database, connection, worker };
}

export async function loadReleaseContract(manifestUrl = "./release-manifest.json") {
  const response = await fetch(manifestUrl, { cache: "no-store" });
  invariant(response.ok, `application manifest HTTP ${response.status}`);
  return validateReleaseManifest(await response.json());
}

export async function loadDataCatalog(release) {
  const dataRelease = await fetchVerifiedJson(
    dataUrl(release, release.data_release.release_path),
    release.data_release.release_sha256
  );
  const registry = await fetchVerifiedJson(
    dataUrl(release, release.data_release.browser_registry_path),
    release.data_release.browser_registry_sha256
  );
  return { dataRelease, registry, layers: validateDataClosure(release, dataRelease, registry) };
}

export function createGridAtlasDataClient(release, { onStatus = () => {} } = {}) {
  validateReleaseManifest(release);
  let runtimePromise = null;
  let queue = Promise.resolve();

  async function runtime() {
    runtimePromise ||= instantiateDuckDb(release, onStatus);
    return runtimePromise;
  }

  function queryLayer(layer, bounds) {
    const task = async () => {
      const { connection } = await runtime();
      onStatus(`Querying ${layer.label} in this map view…`);
      const table = await connection.query(buildLayerQuery(release, layer, bounds));
      const geojson = rowsToGeoJSON(table.toArray(), layer);
      onStatus(`${layer.label}: ${geojson.features.length.toLocaleString()} visible features`);
      return geojson;
    };
    const result = queue.then(task, task);
    queue = result.catch(() => {});
    return result;
  }

  async function close() {
    if (!runtimePromise) return;
    const { connection, database, worker } = await runtimePromise;
    await connection.close();
    await database.terminate();
    worker.terminate();
  }

  return Object.freeze({ queryLayer, close });
}
