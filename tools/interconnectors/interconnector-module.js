
/* ---------------------------------------------------------------------------
   INTERCONNECTORS

   An interconnector is not a generator and it does not arrive anywhere. It has
   two ends, and its connection is already known: it is the thing at the other
   end of its own cable. So this module does not reuse the project arrival at
   all - measured, a BritNed midpoint sits 59.2 km from the nearest substation
   and the far end resolves to Lowestoft at 165.9 km, because our substation
   payload is GB only. Firing the project engine from a midpoint would have
   reported nothing on every link, and matching a Dutch converter to Suffolk
   would have been worse than nothing.

   The model instead is a span with a search budget at each end:

       40km <- Grain --[ BritNed 234.9 km ]-- Maasvlakte -> 40km

   The span is unbounded. The per-end search keeps the ordinary onshore limit
   unless the user widens it with the radius box, and each end states its own
   data coverage so "no substation data for the Netherlands" can never be read
   as "no connection".
   --------------------------------------------------------------------------- */
(function interconnectors() {
  'use strict';

  const SOURCE_ID = 'src-interconnectors';
  const LINE_LAYER = 'l-interconnectors';
  const NODE_LAYER = 'l-interconnector-nodes';
  const DATA_URL = '../../data/interconnectors.geojson';
  const DEFAULT_SEARCH_KM = 40;

  const state = {
    schema: 'gridatlas.interconnectors.v1',
    loaded: false,
    links: [],
    error: null,
    search_km: DEFAULT_SEARCH_KM,
    search_source: 'default',
  };
  window.__GRIDATLAS_INTERCONNECTORS__ = state;

  const EARTH_KM = 6371.0088;
  const rad = (d) => (d * Math.PI) / 180;
  function haversineKm(lon1, lat1, lon2, lat2) {
    const p1 = rad(lat1), p2 = rad(lat2);
    const dp = rad(lat2 - lat1), dl = rad(lon2 - lon1);
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
  }

  /* The radius box is the override, so a widened search is a deliberate and
     attributable choice rather than a different physics applied silently to one
     technology. Onshore keeps its limit until someone types past it. */
  function searchKm() {
    const input = document.getElementById('radius-input');
    const typed = input ? parseFloat(input.value) : NaN;
    if (Number.isFinite(typed) && typed > 0) {
      state.search_km = typed;
      state.search_source = 'user';
      return typed;
    }
    state.search_km = DEFAULT_SEARCH_KM;
    state.search_source = 'default';
    return DEFAULT_SEARCH_KM;
  }

  // 40km <- Grain --[ BritNed 234.9 km ]-- Maasvlakte -> 40km
  function label(link, km) {
    const gb = String(link.gb_converter || 'GB end').replace(/ (Static Inverter Plant|Converter Station|Substation)$/i, '');
    const far = String(link.far_converter || 'far end').replace(/^HVDC /i, '');
    return `${km}km ← ${gb} ──[ ${link.link} ${link.straight_line_km} km ]── ${far} → ${km}km`;
  }

  /* Each end is measured against the substations we actually hold. The GB end
     is a converter inside a substation compound and scores ~0 km. The far end
     has no payload at all, and that is reported as absent coverage rather than
     as an empty result. */
  function measureEnd(role, lon, lat, km, subs) {
    if (!subs || !subs.length) {
      return { role, lon, lat, search_km: km, coverage: 'NONE',
               statement: 'No substation payload for this end, so nothing can be measured here. This is missing data, not an absence of connection.',
               nearest_km: null, nearest_name: null, within: 0 };
    }
    let nearest = null, within = 0;
    for (const sub of subs) {
      const at = sub.at || sub.coordinates;
      if (!at) continue;
      const d = haversineKm(lon, lat, +at[0], +at[1]);
      if (d <= km) within += 1;
      if (!nearest || d < nearest.km) nearest = { km: d, name: sub.name || null };
    }
    return {
      role, lon, lat, search_km: km, coverage: 'GB_SUBSTATIONS',
      nearest_km: nearest ? Number(nearest.km.toFixed(3)) : null,
      nearest_name: nearest ? nearest.name : null,
      nearest_beyond_search: nearest ? nearest.km > km : null,
      within,
    };
  }

  function paint(map, geojson) {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
    } else {
      map.getSource(SOURCE_ID).setData(geojson);
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER, type: 'line', source: SOURCE_ID,
        filter: ['==', ['get', 'feature_role'], 'link-line'],
        layout: { visibility: 'none', 'line-cap': 'round' },
        paint: { 'line-color': '#ffae00', 'line-width': 2, 'line-opacity': 0.9, 'line-dasharray': [3, 2] },
      });
    }
    if (!map.getLayer(NODE_LAYER)) {
      map.addLayer({
        id: NODE_LAYER, type: 'circle', source: SOURCE_ID,
        filter: ['==', ['get', 'feature_role'], 'midpoint'],
        layout: { visibility: 'none' },
        paint: { 'circle-radius': 5, 'circle-color': '#ffae00', 'circle-stroke-width': 1, 'circle-stroke-color': '#0b0d10' },
      });
    }
  }

  async function boot(map) {
    let geojson;
    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      geojson = await response.json();
    } catch (error) {
      state.error = 'interconnector data not served: ' + String(error && error.message || error);
      return;
    }

    const subs = (window.__GRIDATLAS_NEON_LINKS__ || {}).substations
      || (window.__GRIDATLAS_SUBSTATIONS__ || []);
    const km = searchKm();

    state.links = (geojson.features || [])
      .filter((f) => f.properties && f.properties.feature_role === 'link-line')
      .map((f) => {
        const p = f.properties;
        const [a, b] = f.geometry.coordinates;
        return {
          link: p.link, bmrs: p.bmrs_code,
          span_km: p.straight_line_km,
          geometry_kind: p.geometry_kind,
          route_factor: p.route_factor ?? null,
          known_submarine_cable_km: p.known_submarine_cable_km ?? null,
          net_mwh: p.net_mwh ?? null,
          net_direction: p.net_direction ?? null,
          label: label(p, km),
          ends: [
            measureEnd('gb', a[0], a[1], km, subs),
            measureEnd('far', b[0], b[1], km, []),
          ],
        };
      });

    state.loaded = true;
    state.search_km = km;
    paint(map, geojson);
  }

  function ready(map) {
    if (!map) return;
    if (map.isStyleLoaded && map.isStyleLoaded()) boot(map);
    else map.once('load', () => boot(map));
  }

  const timer = setInterval(() => {
    const map = window.__GRIDATLAS_V9_MAP__;
    if (!map) return;
    clearInterval(timer);
    try { ready(map); } catch (error) { state.error = String(error && error.message || error); }
  }, 400);
  setTimeout(() => clearInterval(timer), 90000);
})();
