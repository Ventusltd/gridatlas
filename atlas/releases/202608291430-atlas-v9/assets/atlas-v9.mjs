import { mountRepdAddressFlyTo } from "../cartridges/202608290716-repd-address-flyto.mjs";
import {
  createGridAtlasDataClient,
  fetchVerifiedJson,
  loadDataCatalog,
  loadReleaseContract
} from "./data-gridatlas-client.mjs";
import { loadRoutingDeepLinkFallback } from "./repd-routing-client.mjs";

const RELEASE_ID = "202608291430-atlas-v9";
const HISTORIC_DEFAULT_LAYER_IDS = new Set(["400", "275", "220", "132", "66", "subs", "nuc", "gas", "dc", "air", "rail"]);
const status = document.querySelector("[data-registry-status]");
const live = document.querySelector("[data-atlas-live]");
const mapStatus = document.querySelector("[data-map-status]");
const dataStatus = document.querySelector("[data-data-status]");
const layerRoot = document.querySelector("[data-layer-controls]");
const defaultButton = document.querySelector("[data-load-defaults]");
let map = null;
let mapReady = false;
let featureByRef = new Map();
let dataClient = null;
let layerManager = null;

function popupNode(record) {
  const node = document.createElement("div");
  for (const value of [
    record.name,
    record.repd_address_display || "Address not supplied by REPD",
    [record.repd_postcode, record.county].filter(Boolean).join(" · "),
    `${record.capacity_mw} MW · ${record.status}`,
    `REPD operator or applicant: ${record.repd_operator_or_applicant || "Not supplied / withheld"}`,
    `REPD ${record.repd_ref}`
  ]) {
    const line = document.createElement("div");
    line.textContent = value;
    node.append(line);
  }
  return node;
}

function layerPopupNode(feature, layer) {
  const node = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = layer.label;
  node.append(heading);
  const entries = Object.entries(feature.properties || {})
    .filter(([key, value]) => !key.startsWith("_atlas_") && value !== null && value !== "")
    .slice(0, 8);
  for (const [key, value] of entries) {
    const line = document.createElement("div");
    line.textContent = `${key}: ${String(value)}`;
    node.append(line);
  }
  const provenance = document.createElement("small");
  provenance.textContent = `V8 parity layer · ${layer.v9_data.disposition}`;
  node.append(provenance);
  return node;
}

function setSelectedUrl(record) {
  const url = new URL(location.href);
  url.searchParams.set("repd_ref", record.repd_ref);
  history.replaceState(null, "", url);
}

function hasMappableGeometry(record) {
  return typeof record?.latitude === "number" && typeof record?.longitude === "number"
    && Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
    && record.latitude >= -90 && record.latitude <= 90
    && record.longitude >= -180 && record.longitude <= 180
    && !(record.latitude === 0 && record.longitude === 0)
    && !(record.latitude === 49.766807 && record.longitude === -7.55716);
}

function select(record) {
  if (!hasMappableGeometry(record)) {
    live.textContent = `REPD ${record?.repd_ref || "unknown"} has NO MAP geometry and is not selectable`;
    return false;
  }
  setSelectedUrl(record);
  if (!mapReady || !map) {
    live.textContent = `REPD ${record.repd_ref} selected · map unavailable; official search remains active`;
    return;
  }
  map.getSource("repd-selected").setData({
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [record.longitude, record.latitude] }
  });
  new globalThis.maplibregl.Popup({ offset: 12 })
    .setLngLat([record.longitude, record.latitude])
    .setDOMContent(popupNode(record))
    .addTo(map);
}

const mapAdapter = {
  flyTo(options) {
    if (!mapReady || !map) {
      live.textContent = "Map unavailable in this browser; the official REPD match remains selected.";
      return;
    }
    map.flyTo(options);
  }
};

function markMapUnavailable(error) {
  mapReady = false;
  mapStatus.dataset.mapState = "unavailable";
  mapStatus.textContent = "MAP UNAVAILABLE IN THIS BROWSER · OFFICIAL REPD ADDRESS SEARCH REMAINS ACTIVE";
  console.warn("Atlas V9 map isolated:", error instanceof Error ? error.message : String(error));
}

function addProjectLayers(records) {
  const geojson = {
    type: "FeatureCollection",
    features: records.filter(hasMappableGeometry).map(record => ({
      type: "Feature",
      id: Number(record.repd_ref) || undefined,
      properties: { repd_ref: String(record.repd_ref), technology: record.technology, status: record.status },
      geometry: { type: "Point", coordinates: [record.longitude, record.latitude] }
    }))
  };
  map.addSource("repd-v9", { type: "geojson", data: geojson, cluster: true, clusterMaxZoom: 9, clusterRadius: 45 });
  map.addLayer({
    id: "repd-clusters", type: "circle", source: "repd-v9", filter: ["has", "point_count"],
    paint: {
      "circle-color": ["step", ["get", "point_count"], "#00b7c7", 100, "#ffae00", 500, "#ff5b5b"],
      "circle-radius": ["step", ["get", "point_count"], 16, 100, 22, 500, 28],
      "circle-stroke-width": 2, "circle-stroke-color": "#001014"
    }
  });
  map.addLayer({
    id: "repd-points", type: "circle", source: "repd-v9", filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["match", ["get", "technology"], "solar", "#ffe600", "bess", "#ff7ab6", "wind_onshore", "#00e5ff", "wind_offshore", "#0068ff", "#8dff7a"],
      "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#001014"
    }
  });
  map.addSource("repd-selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "repd-selected", type: "circle", source: "repd-selected",
    paint: { "circle-color": "#00ffff", "circle-radius": 11, "circle-stroke-width": 4, "circle-stroke-color": "#000" }
  });
  map.on("click", "repd-clusters", event => {
    const feature = event.features[0];
    map.getSource("repd-v9").getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
      if (!error) map.easeTo({ center: feature.geometry.coordinates, zoom });
    });
  });
  map.on("click", "repd-points", event => {
    const record = featureByRef.get(String(event.features[0].properties.repd_ref));
    if (record) select(record);
  });
}

function sourceId(layer) {
  return `v8-${layer.id}`;
}

function renderLayerIds(layer) {
  return [`${sourceId(layer)}-line`, `${sourceId(layer)}-point`];
}

function minimumZoom(layer) {
  if (layer.minzoom !== null && layer.minzoom !== undefined && Number.isFinite(Number(layer.minzoom))) {
    return Number(layer.minzoom);
  }
  const heavy = {
    "partitions/uk_primary_roads.parquet": 8,
    "partitions/uk_trunk_roads.parquet": 7,
    "partitions/uk_motorways.parquet": 6,
    "partitions/uk_mainline_railways.parquet": 6
  };
  return heavy[layer.v9_data.parquet_path] || 0;
}

function mapBounds() {
  const bounds = map.getBounds();
  return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
}

function createLayerManager(layers) {
  const byId = new Map(layers.map(layer => [layer.id, layer]));
  const active = new Map();
  const controls = new Map();
  const clickHandlers = new Map();
  let moveTimer = null;

  function removeRendered(layer) {
    const binding = clickHandlers.get(layer.id);
    if (binding) {
      for (const renderedId of binding.renderedIds) map.off("click", renderedId, binding.handler);
      clickHandlers.delete(layer.id);
    }
    for (const id of renderLayerIds(layer)) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(sourceId(layer))) map.removeSource(sourceId(layer));
  }

  function bindRendered(layer) {
    if (clickHandlers.has(layer.id)) return;
    const renderedIds = renderLayerIds(layer);
    const handler = event => {
      const feature = event.features?.[0];
      if (feature) new globalThis.maplibregl.Popup({ offset: 10 })
        .setLngLat(event.lngLat)
        .setDOMContent(layerPopupNode(feature, layer))
        .addTo(map);
    };
    for (const renderedId of renderedIds) map.on("click", renderedId, handler);
    clickHandlers.set(layer.id, { renderedIds, handler });
  }

  function putRendered(layer, geojson) {
    const id = sourceId(layer);
    if (map.getSource(id)) {
      map.getSource(id).setData(geojson);
      return;
    }
    map.addSource(id, { type: "geojson", data: geojson });
    map.addLayer({
      id: `${id}-line`, type: "line", source: id,
      filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      paint: {
        "line-color": layer.color || "#00e5ff",
        "line-width": Number(layer.width) || (layer.type === "line" ? 2 : 1.5),
        "line-opacity": 0.9
      }
    });
    map.addLayer({
      id: `${id}-point`, type: "circle", source: id,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": layer.color || "#00e5ff",
        "circle-radius": Array.isArray(layer.radius) ? layer.radius : 4.5,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#001014"
      }
    });
    bindRendered(layer);
  }

  async function refresh(layer, force = false) {
    const state = active.get(layer.id);
    if (!state) return;
    const requiredZoom = minimumZoom(layer);
    if (map.getZoom() < requiredZoom) {
      removeRendered(layer);
      dataStatus.textContent = `${layer.label} is live; zoom to ${requiredZoom}+ to query it`;
      return;
    }
    const bounds = mapBounds();
    const key = Object.values(bounds).map(value => value.toFixed(2)).join(":");
    if (!force && state.boundsKey === key) return;
    const token = state.token + 1;
    state.token = token;
    state.boundsKey = key;
    controls.get(layer.id)?.classList.add("is-loading");
    try {
      const geojson = await dataClient.queryLayer(layer, bounds);
      if (!active.has(layer.id) || active.get(layer.id).token !== token) return;
      putRendered(layer, geojson);
    } catch (error) {
      if (active.has(layer.id)) {
        controls.get(layer.id).querySelector("input").checked = false;
        active.delete(layer.id);
        removeRendered(layer);
      }
      dataStatus.textContent = `${layer.label} failed closed: ${error.message}`;
      console.warn("Atlas V9 layer query isolated:", error instanceof Error ? error.message : String(error));
    } finally {
      controls.get(layer.id)?.classList.remove("is-loading");
    }
  }

  function activate(layer, checkbox) {
    if (!checkbox.checked) {
      active.delete(layer.id);
      removeRendered(layer);
      dataStatus.textContent = `${layer.label} unloaded; browser memory released`;
      return;
    }
    active.set(layer.id, { token: 0, boundsKey: null });
    refresh(layer, true);
  }

  function renderControls() {
    layerRoot.replaceChildren();
    const grouped = new Map();
    for (const layer of layers) {
      if (!grouped.has(layer.group)) grouped.set(layer.group, []);
      grouped.get(layer.group).push(layer);
    }
    for (const [groupName, groupLayers] of grouped) {
      const section = document.createElement("details");
      section.className = "layer-group";
      if (groupName === "Topology (GeoJSON)") section.open = true;
      const summary = document.createElement("summary");
      summary.textContent = `${groupName} · ${groupLayers.length}`;
      section.append(summary);
      for (const layer of groupLayers) {
        const label = document.createElement("label");
        label.className = "layer-toggle";
        label.title = `${layer.v9_data.disposition} · ${layer.v9_data.parquet_path}`;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.layerId = layer.id;
        input.addEventListener("change", () => activate(layer, input));
        const swatch = document.createElement("span");
        swatch.className = "layer-swatch";
        swatch.style.backgroundColor = layer.color || "#00e5ff";
        const text = document.createElement("span");
        text.textContent = layer.label;
        const disposition = document.createElement("span");
        const dispositionText = layer.v9_data.disposition.startsWith("QUARANTINED_")
          ? "QUARANTINED"
          : layer.v9_data.disposition.startsWith("ORACLE_ONLY_")
            ? "ORACLE ONLY"
            : "LICENCE / REACQUIRE";
        disposition.className = `layer-disposition${dispositionText === "QUARANTINED" ? " is-quarantined" : ""}`;
        disposition.dataset.layerDisposition = layer.v9_data.disposition;
        disposition.textContent = dispositionText;
        disposition.title = layer.v9_data.disposition;
        label.append(input, swatch, text, disposition);
        section.append(label);
        controls.set(layer.id, label);
      }
      layerRoot.append(section);
    }
  }

  function loadDefaults() {
    for (const layer of layers.filter(item => HISTORIC_DEFAULT_LAYER_IDS.has(item.id))) {
      const input = controls.get(layer.id).querySelector("input");
      if (!input.checked) {
        input.checked = true;
        activate(layer, input);
      }
    }
  }

  map.on("moveend", () => {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      for (const id of active.keys()) refresh(byId.get(id));
    }, 250);
  });
  renderControls();
  defaultButton.disabled = false;
  defaultButton.addEventListener("click", loadDefaults, { once: true });
  return Object.freeze({ refresh, loadDefaults });
}

function initialiseMap(records, onReady) {
  if (!globalThis.maplibregl?.Map) throw new Error("MapLibre did not load");
  map = new globalThis.maplibregl.Map({
    container: "map",
    center: [-3.5, 54.2],
    zoom: 4.4,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    }
  });
  map.addControl(new globalThis.maplibregl.NavigationControl(), "top-right");
  map.on("load", () => {
    try {
      addProjectLayers(records);
      mapReady = true;
      mapStatus.dataset.mapState = "ready";
      mapStatus.textContent = "REPD viable projects · V8 layers load only when selected";
      onReady();
      const requested = new URLSearchParams(location.search).get("repd_ref");
      if (requested && featureByRef.has(requested)) {
        const record = featureByRef.get(requested);
        if (hasMappableGeometry(record)) {
          map.jumpTo({ center: [record.longitude, record.latitude], zoom: 13 });
          select(record);
        }
      }
    } catch (error) {
      markMapUnavailable(error);
    }
  });
}

async function resolveRequestedDeepLink(release) {
  const requested = new URLSearchParams(location.search).get("repd_ref");
  if (!requested) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = { requested: null, source: "none", found: false, selectable: false, latitude: null, longitude: null };
    return null;
  }
  if (!/^\d+$/.test(requested)) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = { requested, source: "none", found: false, selectable: false, reason: "INVALID_EXACT_REPD_REF", latitude: null, longitude: null };
    live.textContent = `REPD deep link ${requested} is not an exact numeric reference`;
    return null;
  }
  const normal = featureByRef.get(requested);
  if (normal && hasMappableGeometry(normal)) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = {
      requested, source: "normal", found: true, selectable: true,
      latitude: normal.latitude, longitude: normal.longitude
    };
    return normal;
  }
  try {
    const fallback = await loadRoutingDeepLinkFallback(release, requested);
    globalThis.__GRIDATLAS_REPD_ROUTE__ = {
      requested, source: "routing", found: fallback.found,
      selectable: fallback.selectable, reason: fallback.reason,
      geometry_status: fallback.record?.geometry_status || null,
      latitude: fallback.record?.latitude ?? null,
      longitude: fallback.record?.longitude ?? null
    };
    if (fallback.selectable && hasMappableGeometry(fallback.record)) {
      featureByRef.set(requested, fallback.record);
      return fallback.record;
    }
    live.textContent = fallback.found
      ? `REPD ${requested} has NO MAP geometry and is not selectable`
      : `REPD ${requested} is not present in the exact routing oracle`;
  } catch (error) {
    globalThis.__GRIDATLAS_REPD_ROUTE__ = { requested, source: "routing", found: false, selectable: false, reason: "ROUTING_FAILED_CLOSED", latitude: null, longitude: null };
    live.textContent = `REPD ${requested} routing failed closed; normal search and map remain active`;
    console.warn("Atlas V9 routing isolated:", error instanceof Error ? error.message : String(error));
  }
  return null;
}

async function boot() {
  const release = await loadReleaseContract();
  if (release.release_id !== RELEASE_ID) throw new Error("wrong timestamped release mounted");
  const catalogResultPromise = loadDataCatalog(release).then(
    value => {
      dataClient = createGridAtlasDataClient(release, { onStatus: message => { dataStatus.textContent = message; } });
      dataStatus.textContent = `${value.layers.length} V8 parity layers ready · zero Parquet loaded`;
      return { ok: true, value };
    },
    error => ({ ok: false, error })
  );
  const registryPromise = fetchVerifiedJson(
    release.repd.registry_url,
    release.repd.registry_sha256,
    release.repd.registry_bytes
  );
  const registry = await registryPromise;
  if (registry.schema !== "gridatlas.browser-registry.v1" || registry.generation !== release.repd.generation || !Array.isArray(registry.records)) {
    throw new Error("REPD registry contract mismatch");
  }
  const records = registry.records.filter(hasMappableGeometry);
  globalThis.__GRIDATLAS_RUNTIME__ = Object.freeze({
    normalRegistrySourceRows: registry.records.length,
    normalSelectableRows: records.length,
    excludedFalseOriginRows: registry.records.length - records.length,
    baseMapFeatures: records.length,
    routingProjectsWithoutDeepLink: 0
  });
  featureByRef = new Map(records.map(record => [String(record.repd_ref), record]));
  status.textContent = `${records.length.toLocaleString()} official viable REPD projects ready`;
  mountRepdAddressFlyTo({
    map: mapAdapter,
    records,
    root: document.querySelector("[data-atlas-search-root]"),
    onSelected: select
  });
  const requested = new URLSearchParams(location.search).get("repd_ref");
  const requestedRecord = await resolveRequestedDeepLink(release);
  if (requestedRecord) select(requestedRecord);

  try {
    initialiseMap(records, async () => {
      try {
        const result = await catalogResultPromise;
        if (!result.ok) throw result.error;
        layerManager = createLayerManager(result.value.layers);
      } catch (error) {
        dataStatus.textContent = `V8 layer catalogue failed closed: ${error.message}`;
        console.error(error);
      }
    });
  } catch (error) {
    markMapUnavailable(error);
    if (requested && featureByRef.has(requested)) select(featureByRef.get(requested));
  }
}

boot().catch(error => {
  console.error(error);
  status.textContent = "Timestamped release failed closed — last-green root Atlas remains available";
  dataStatus.textContent = error.message;
  markMapUnavailable(error);
});

addEventListener("pagehide", () => dataClient?.close(), { once: true });
