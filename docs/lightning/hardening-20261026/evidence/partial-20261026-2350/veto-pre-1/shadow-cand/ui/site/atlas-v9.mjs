import { mountRepdAddressFlyTo } from "../cartridges/202608290716-repd-address-flyto.mjs";

const GENERATION = "202608290716";
const status = document.querySelector("[data-registry-status]");
const live = document.querySelector("[data-atlas-live]");
const mapStatus = document.querySelector("[data-map-status]");
let map = null;
let mapReady = false;
let featureByRef = new Map();

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

function setSelectedUrl(record) {
  const url = new URL(location.href);
  url.searchParams.set("repd_ref", record.repd_ref);
  history.replaceState(null, "", url);
}

function select(record) {
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
    features: records.map(record => ({
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
    id: "repd-cluster-count", type: "symbol", source: "repd-v9", filter: ["has", "point_count"],
    layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
    paint: { "text-color": "#001014" }
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

function initialiseMap(records) {
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
      mapStatus.textContent = "REPD viable projects · clusters expand on click · selected project in cyan";
      const requested = new URLSearchParams(location.search).get("repd_ref");
      if (requested && featureByRef.has(requested)) {
        const record = featureByRef.get(requested);
        map.jumpTo({ center: [record.longitude, record.latitude], zoom: 13 });
        select(record);
      }
    } catch (error) {
      markMapUnavailable(error);
    }
  });
}

async function boot() {
  const response = await fetch(`data/repd_browser_registry_${GENERATION}.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
  const registry = await response.json();
  if (registry.schema !== "gridatlas.browser-registry.v1" || registry.generation !== GENERATION || !Array.isArray(registry.records)) {
    throw new Error("registry contract mismatch");
  }
  const records = registry.records;
  featureByRef = new Map(records.map(record => [String(record.repd_ref), record]));
  status.textContent = `${records.length.toLocaleString()} official viable REPD projects ready`;
  mountRepdAddressFlyTo({
    map: mapAdapter,
    records,
    root: document.querySelector("[data-atlas-search-root]"),
    onSelected: select
  });
  try {
    initialiseMap(records);
  } catch (error) {
    markMapUnavailable(error);
    const requested = new URLSearchParams(location.search).get("repd_ref");
    if (requested && featureByRef.has(requested)) select(featureByRef.get(requested));
  }
}

boot().catch(error => {
  console.error(error);
  status.textContent = "REPD registry failed closed — no project claim has been made";
  markMapUnavailable(error);
});
