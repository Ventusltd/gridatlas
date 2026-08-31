/**
 * GridAtlas cartridge — neon substation links.
 *
 * Generation 202608311910 (UTC). Slot: replace-script for
 * 202608292126-pre-snapped-config-adapter.js.
 *
 * WHAT IT DOES
 * ------------
 * Select a solar, battery or onshore wind project and the map draws animated
 * neon lines from it to the nearest substations at 33 kV and above. The same
 * distances are written onto the project card the engine has just opened,
 * marked BETA, with the reasons a distance is not a connection stated on the
 * card itself rather than hidden in a tooltip.
 *
 * WHY IT REPLACES THE CONFIG ADAPTER RATHER THAN ADDING A SCRIPT
 * -------------------------------------------------------------
 * The composer in atlas/index.html supports exactly one slot, `replace-script`.
 * There is no append slot, and inventing one would mean changing the composer,
 * which is a larger contract change than this feature is worth. So this
 * cartridge carries the pre-snapped config adapter's behaviour VERBATIM -- same
 * layer ids, same closure assertion, same failure mode, same public state
 * object -- and adds the link layer beside it. The immutable shell is not
 * touched, and `__GRIDATLAS_PRE_SNAPPED_CONFIG__` still reports exactly what it
 * reported before, so anything asserting on it keeps working.
 *
 * HOW IT HOOKS IN WITHOUT SHELL MUTATION
 * --------------------------------------
 * Two decorators, both of things the engine has already published by the time
 * this script runs:
 *
 *   window.initVentusMap  wrapped for the pre-snap config, as before.
 *   maplibregl.Map        wrapped to capture the instance, because the engine
 *                         keeps `map` in a closure and returns nothing. The
 *                         engine constructs its map inside initVentusMap, which
 *                         runs after this file, so the constructor is still
 *                         ours to wrap.
 *
 * THE MEASUREMENT
 * ---------------
 * Haversine on R = 6378.137 km, the same constant as ventus-corev8engine.js,
 * pipelinenews and Ventusltd/grid-distance-maths, so a distance read here
 * equals the same distance read there. Substations are mapped as points AND as
 * polygons; a polygon is reduced to its ring mean, because its first vertex is
 * a corner rather than the site.
 *
 * Scope is 33 kV and above. 11 kV is rare for utility-scale export and where it
 * occurs is often a private network behind the meter, so it is not a screening
 * signal. `voltage` is written `33000`, `33000;11000` for two voltages, and
 * `33000:11000` for a transformer ratio -- a 33/11 primary still carries 33 kV.
 *
 * WHAT A LINE IS NOT
 * ------------------
 * A straight line to mapped geometry. Not a cable route, not a connection
 * length, no wayleave, crossing, terrain or consent content. A mapped
 * substation does not confirm capacity, voltage suitability or connection
 * rights, and fault level and thermal headroom cannot be inferred from distance
 * at all -- they need DNO network data such as source impedance and a
 * connection study, alongside right of way, wayleaves and easements, land
 * control and consent. The card says all of that on screen.
 */
(() => {
  'use strict';

  const GENERATION = '202608311910';

  /* ══════════════════════════════════════════════════════════════════════
     PART 1 — the pre-snapped config adapter, carried forward unchanged.
     ══════════════════════════════════════════════════════════════════════ */

  const PRE_SNAPPED_LAYER_IDS = new Set(['400', '275', '220', '132', '66']);
  const originalInit = window.initVentusMap;

  if (typeof originalInit !== 'function') {
    throw new Error('V8 engine init function is unavailable before map-ready adapter');
  }

  const state = {
    schema: 'gridatlas.pre-snapped-config-adapter.v1',
    generation: '202608292126',
    applied: false,
    changed_layer_ids: [],
    preserved_preload_flags: true,
    failures: []
  };
  window.__GRIDATLAS_PRE_SNAPPED_CONFIG__ = state;

  window.initVentusMap = function gridAtlasMapReadyInit(options) {
    try {
      const changed = [];
      const config = options.config.map(group => ({
        ...group,
        layers: group.layers.map(layer => {
          if (!PRE_SNAPPED_LAYER_IDS.has(String(layer.id))) return layer;
          if (layer.snap !== true) {
            throw new Error(`expected V8 snap=true for topology layer ${layer.id}`);
          }
          changed.push(String(layer.id));
          return { ...layer, snap: false };
        })
      }));

      const expected = [...PRE_SNAPPED_LAYER_IDS].sort();
      if (JSON.stringify([...changed].sort()) !== JSON.stringify(expected)) {
        throw new Error(`pre-snapped layer closure mismatch: ${JSON.stringify(changed)}`);
      }

      state.applied = true;
      state.changed_layer_ids = changed;
      return originalInit({ ...options, config });
    } catch (error) {
      state.failures.push(String(error?.message || error));
      throw error;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     PART 2 — neon substation links.
     ══════════════════════════════════════════════════════════════════════ */

  const R_ATLAS = 6378.137;          // WGS84 semi-major axis. The house constant.
  const DEG = Math.PI / 180;
  const MIN_KV = 33;
  const LINK_COUNT = 5;              // how many substations to reach for
  const MAX_LINK_KM = 40;            // beyond this, silence is more honest
  const SUBS_URL = 'data/grid_substations.geojson';
  const SUBS_LAYER_ID = 'l-subs';    // engine convention: layer `l-<id>`, source `src-<id>`

  // Project technologies this fires for. Onshore only: an offshore turbine's
  // export route is nothing like a straight line to the nearest onshore
  // substation, so drawing one would be a picture of a lie.
  const PROJECT_TECHS = new Set([
    'solar', 'solar_operational', 'solar_roof',
    'bess', 'bess_operational',
    'wind', 'wind_onshore_operational'
  ]);

  // SCADA on a dark map, not arcade neon. These are the muted siblings of the
  // engine's own layer colours: enough saturation to read as live, low enough
  // not to shout over the basemap or the grid layers underneath.
  const TECH_COLOUR = {
    solar: '#d8c96a', solar_operational: '#d8c96a', solar_roof: '#d8c96a',
    bess: '#d9963c', bess_operational: '#d9963c',
    wind: '#6fb582', wind_onshore_operational: '#6fb582'
  };
  const SUBSTATION_COLOUR = '#5fbdc2';   // teal, the substation end of a link
  const FLOW_COLOUR = '#bfe9ee';         // pale cyan travelling pulse, not white

  const SRC = 'gridatlas-neon-links';
  const SRC_NODES = 'gridatlas-neon-nodes';
  const L_GLOW = 'l-neon-glow';
  const L_CORE = 'l-neon-core';
  const L_FLOW = 'l-neon-flow';
  const L_NODE = 'l-neon-node';
  const L_NODE_RING = 'l-neon-node-ring';
  const L_LABEL = 'l-neon-label';

  const link = {
    schema: 'gridatlas.neon-substation-links.v1',
    generation: GENERATION,
    minimum_kv: MIN_KV,
    map_captured: false,
    installed: false,
    substations_loaded: 0,
    substations_qualifying: 0,
    last_selection: null,
    links_drawn: 0,
    reduced_motion: false,
    failures: []
  };
  window.__GRIDATLAS_NEON_LINKS__ = link;

  /* ── geodesy ─────────────────────────────────────────────────────────── */

  // Identical in form and constant to ventus-corev8engine.js haversine().
  function distanceKm(lon1, lat1, lon2, lat2) {
    const dLat = (lat2 - lat1) * DEG;
    const dLon = (lon2 - lon1) * DEG;
    const x = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
    return R_ATLAS * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /* ── substation layer ────────────────────────────────────────────────── */

  // `33000`, `33000;11000` (two voltages) and `33000:11000` (a transformer
  // ratio) all mean 33 kV is present. Splitting only on ';' drops the ratios.
  function voltagesKv(properties) {
    const raw = properties?.voltage ?? properties?.kv ?? '';
    const out = [];
    for (const token of String(raw).split(/[;,|:\s]+/)) {
      if (!token) continue;
      const value = Number(token);
      if (!Number.isFinite(value)) continue;
      out.push(value > 1000 ? value / 1000 : value);
    }
    return out;
  }

  // A polygon's first ring vertex is a corner, not the site.
  function representativePoint(geometry) {
    if (!geometry) return null;
    const { type, coordinates } = geometry;
    if (type === 'Point') return [coordinates[0], coordinates[1]];
    const ring = type === 'Polygon' ? coordinates[0]
      : type === 'MultiPolygon' ? coordinates[0]?.[0] : null;
    if (!Array.isArray(ring) || !ring.length) return null;
    let x = 0; let y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    return [x / ring.length, y / ring.length];
  }

  // Exposed so a proof can check this arithmetic against
  // Ventusltd/grid-distance-maths rather than trusting the comment above it.
  // Pure functions only; nothing here touches the map or the DOM.
  link.measure = { distanceKm, voltagesKv, representativePoint };

  let substationsPromise = null;
  function loadSubstations() {
    if (substationsPromise) return substationsPromise;
    substationsPromise = (async () => {
      // The engine may already hold the layer; prefer that over a second fetch.
      const response = await fetch(new URL(SUBS_URL, document.baseURI), { cache: 'force-cache' });
      if (!response.ok) throw new Error(`substations HTTP ${response.status}`);
      const collection = await response.json();
      const features = Array.isArray(collection?.features) ? collection.features : [];
      link.substations_loaded = features.length;
      const out = [];
      for (const feature of features) {
        const kv = voltagesKv(feature.properties);
        if (!kv.length || Math.max(...kv) < MIN_KV - 0.5) continue;
        const at = representativePoint(feature.geometry);
        if (!at) continue;
        out.push({
          at,
          kv: kv.filter(v => v >= MIN_KV - 0.5).sort((a, b) => b - a),
          name: feature.properties?.name || '',
          operator: feature.properties?.operator
            || feature.properties?.['operator:short'] || ''
        });
      }
      link.substations_qualifying = out.length;
      return out;
    })().catch(error => {
      link.failures.push(String(error?.message || error));
      substationsPromise = null;
      return [];
    });
    return substationsPromise;
  }

  function nearestSubstations(lon, lat, subs) {
    const scored = [];
    for (const sub of subs) {
      const km = distanceKm(lon, lat, sub.at[0], sub.at[1]);
      if (km > MAX_LINK_KM) continue;
      scored.push({ ...sub, km });
    }
    scored.sort((a, b) => a.km - b.km);
    return scored.slice(0, LINK_COUNT);
  }

  // The mirror of nearestSubstations: given a substation, the projects around
  // it. Read from the loaded source rather than the viewport, so panning the
  // map does not change the answer -- querySourceFeatures returns what the
  // GeoJSON source holds, queryRenderedFeatures returns only what is on screen.
  function nearestProjects(map, lon, lat) {
    let features = [];
    try { features = map.querySourceFeatures('src-repd') || []; }
    catch (_) { return []; }
    const seen = new Set();
    const scored = [];
    for (const feature of features) {
      const properties = feature.properties || {};
      const tech = String(properties.tech || properties.type || '');
      if (!PROJECT_TECHS.has(tech)) continue;
      const at = representativePoint(feature.geometry);
      if (!at) continue;
      // One source, many tiles: the same project surfaces more than once.
      const key = properties.repd_ref || properties.repdRef
        || `${at[0].toFixed(5)},${at[1].toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const km = distanceKm(lon, lat, at[0], at[1]);
      if (km > MAX_LINK_KM) continue;
      const capacity = parseFloat(properties.capacity);
      scored.push({
        at, km, tech,
        kv: [],
        name: properties.name || properties.SiteName || properties['Site Name'] || '',
        mw: Number.isFinite(capacity) ? capacity : null
      });
    }
    scored.sort((a, b) => a.km - b.km);
    return scored.slice(0, LINK_COUNT);
  }

  link.measure.nearestSubstations = nearestSubstations;
  link.measure.MIN_KV = MIN_KV;
  link.measure.MAX_LINK_KM = MAX_LINK_KM;
  link.measure.LINK_COUNT = LINK_COUNT;
  link.measure.PROJECT_TECHS = PROJECT_TECHS;

  /* ── the project card ────────────────────────────────────────────────── */

  const BLOCK_CLASS = 'gridatlas-neon-block';
  const CSS_ID = 'gridatlas-neon-css';

  // The distances belong ON the card the user just opened, not in a separate
  // panel they have to notice. The engine builds that card with openPopup(),
  // which is a closure, so this appends to the rendered popup instead --
  // matching the engine's own idiom: monospace on black, cyan heading, amber
  // for a figure, grey for provenance.
  function installStyles() {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
.${BLOCK_CLASS}{margin-top:7px;padding-top:6px;border-top:1px solid #123;font-family:monospace}
.${BLOCK_CLASS} .neon-hd{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.06em;
  color:#5fbdc2;font-weight:bold;text-transform:uppercase}
.${BLOCK_CLASS} .neon-beta{font-size:8px;letter-spacing:.06em;padding:1px 4px;border-radius:2px;
  background:#3a2f12;color:#e0b050;border:1px solid #6a5320;text-transform:uppercase}
.${BLOCK_CLASS} ol{list-style:none;margin:5px 0 0;padding:0}
.${BLOCK_CLASS} li{display:flex;align-items:baseline;gap:6px;padding:2px 0}
.${BLOCK_CLASS} .neon-km{color:#5fbdc2;font-weight:bold;font-variant-numeric:tabular-nums;
  min-width:54px;text-shadow:0 0 6px rgba(95,189,194,.35)}
.${BLOCK_CLASS} .neon-name{color:#9fb3ba;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;flex:1;max-width:150px}
.${BLOCK_CLASS} .neon-kv{color:#ffae00;font-size:9px;white-space:nowrap}
.${BLOCK_CLASS} .neon-caveat{margin-top:6px;color:#68797f;font-size:9px;line-height:1.5}
.${BLOCK_CLASS} .neon-caveat b{color:#8b9aa1;font-weight:bold}`;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // BETA here marks SCOPE, not doubt about the arithmetic. The measurement is
  // published and checked; what it does not cover is stated, and the things a
  // distance cannot answer at any precision are named rather than implied.
  function caveatHtml() {
    return `<div class="neon-caveat">`
      + `<b>Beta analytics, not an actual grid connection.</b> Straight-line distance to mapped `
      + `geometry &mdash; not a cable route, not a connection length, and no route has been `
      + `walked. A real connection depends on factors that must be studied: network impedance `
      + `and fault level, thermal headroom, existing committed connections and queue position, `
      + `right of way, wayleaves and easements, crossings, terrain, land control and consent. `
      + `None of those can be inferred from a distance. A mapped substation does not confirm `
      + `capacity, voltage suitability or acceptance by any network party, and absence from a `
      + `mapped layer is not absence on the ground.`
      + `</div>`;
  }

  function cardBlockHtml(links, direction) {
    installStyles();
    const toSubstations = direction !== 'from-substation';
    const title = toSubstations
      ? `Nearest substations &ge;${MIN_KV} kV`
      : 'Nearest projects';
    const fallbackName = toSubstations ? 'Unnamed substation' : 'Unnamed project';
    const head = `<div class="neon-hd">${title}<span class="neon-beta">Beta</span></div>`;
    if (!links.length) {
      const nothing = toSubstations
        ? `No mapped substation at ${MIN_KV} kV or above within ${MAX_LINK_KM} km of this point.`
        : `No mapped project within ${MAX_LINK_KM} km of this substation, among the layers `
          + `currently loaded.`;
      return `<div class="${BLOCK_CLASS}">${head}`
        + `<div class="neon-caveat">${nothing}</div>${caveatHtml()}</div>`;
    }
    const rows = links.map(l => {
      const tail = l.kv && l.kv.length ? `${l.kv[0]} kV`
        : (l.mw != null ? `${l.mw} MW` : '');
      return `<li><span class="neon-km">${l.km.toFixed(2)} km</span>`
        + `<span class="neon-name">${escapeHtml(l.name || fallbackName)}</span>`
        + (tail ? `<span class="neon-kv">${escapeHtml(tail)}</span>` : '') + `</li>`;
    }).join('');
    return `<div class="${BLOCK_CLASS}">${head}<ol>${rows}</ol>${caveatHtml()}</div>`;
  }

  // The engine opens its popup in its own click handler. This one is registered
  // afterwards, so by the time it runs the popup is in the DOM and can be
  // extended rather than replaced.
  function injectIntoCard(links, direction) {
    const content = document.querySelector('.maplibregl-popup-content');
    if (!content) return false;
    content.querySelectorAll(`.${BLOCK_CLASS}`).forEach(node => node.remove());
    const holder = document.createElement('div');
    holder.innerHTML = cardBlockHtml(links, direction);
    const block = holder.firstElementChild;
    if (!block) return false;
    (content.firstElementChild || content).appendChild(block);
    return true;
  }

  function removeCardBlock() {
    document.querySelectorAll(`.${BLOCK_CLASS}`).forEach(node => node.remove());
  }

  /* ── the map layers ──────────────────────────────────────────────────── */

  let capturedMap = null;
  let animationHandle = null;
  let dashPhase = 0;

  function emptyCollection() {
    return { type: 'FeatureCollection', features: [] };
  }

  function ensureLayers(map) {
    if (map.getSource(SRC)) return;

    map.addSource(SRC, { type: 'geojson', data: emptyCollection() });
    map.addSource(SRC_NODES, { type: 'geojson', data: emptyCollection() });

    // Three stacked strokes make the neon: a wide soft glow, a bright core, and
    // a dashed overlay whose offset is animated so the line reads as flowing
    // towards the substation.
    map.addLayer({
      id: L_GLOW, type: 'line', source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 12],
        'line-opacity': 0.10,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 8]
      }
    });
    map.addLayer({
      id: L_CORE, type: 'line', source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 12, 1.8],
        'line-opacity': ['get', 'strength']
      }
    });
    map.addLayer({
      id: L_FLOW, type: 'line', source: SRC,
      layout: { 'line-cap': 'butt' },
      paint: {
        'line-color': FLOW_COLOUR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2],
        'line-opacity': 0.55,
        'line-dasharray': [0.2, 3.2]
      }
    });

    map.addLayer({
      id: L_NODE_RING, type: 'circle', source: SRC_NODES,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 13],
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': SUBSTATION_COLOUR,
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.4
      }
    });
    map.addLayer({
      id: L_NODE, type: 'circle', source: SRC_NODES,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.2, 12, 4],
        'circle-color': SUBSTATION_COLOUR,
        'circle-opacity': 0.8
      }
    });
    map.addLayer({
      id: L_LABEL, type: 'symbol', source: SRC_NODES,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 10,
        'text-offset': [0, -1.5],
        'text-anchor': 'bottom',
        'text-allow-overlap': false,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
      },
      paint: {
        'text-color': '#a9c4c9',
        'text-halo-color': '#000c10',
        'text-halo-width': 1.5,
        'text-opacity': 0.9
      }
    });

    link.installed = true;
  }

  function stopAnimation() {
    if (animationHandle !== null) {
      cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
  }

  function startAnimation(map) {
    stopAnimation();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
    link.reduced_motion = reduced;
    if (reduced) {
      // Motion is a preference, not a requirement. The lines, the nodes and
      // every number stay; only the travelling dash stops.
      try { map.setPaintProperty(L_FLOW, 'line-opacity', 0); } catch (_) { /* layer gone */ }
      return;
    }
    const step = () => {
      dashPhase = (dashPhase + 0.09) % 3.4;
      try {
        map.setPaintProperty(L_FLOW, 'line-dasharray',
          [0.001, dashPhase, 0.55, 3.4 - dashPhase]);
      } catch (_) {
        stopAnimation();
        return;
      }
      animationHandle = requestAnimationFrame(step);
    };
    animationHandle = requestAnimationFrame(step);
  }

  function clearLinks() {
    stopAnimation();
    const map = capturedMap;
    if (map && map.getSource(SRC)) {
      map.getSource(SRC).setData(emptyCollection());
      map.getSource(SRC_NODES).setData(emptyCollection());
    }
    removeCardBlock();
    link.links_drawn = 0;
    link.last_selection = null;
  }

  function drawLinks(map, origin, name, tech, links, direction) {
    ensureLayers(map);
    // A link takes the colour of the project end, whichever end was clicked.
    const colour = direction === 'from-substation'
      ? SUBSTATION_COLOUR
      : (TECH_COLOUR[tech] || SUBSTATION_COLOUR);

    const lines = links.map((l, index) => ({
      type: 'Feature',
      properties: {
        colour,
        // The nearest link burns brightest; the rest fade back in order, so
        // rank is legible without reading the numbers.
        strength: Math.max(0.20, 0.62 - index * 0.10),
        km: l.km
      },
      geometry: { type: 'LineString', coordinates: [origin, l.at] }
    }));

    const nodes = links.map(l => {
      const tail = l.kv && l.kv.length ? `${l.kv[0]} kV`
        : (l.mw != null ? `${l.mw} MW` : '');
      return {
        type: 'Feature',
        properties: {
          colour,
          label: tail ? `${l.km.toFixed(2)} km · ${tail}` : `${l.km.toFixed(2)} km`
        },
        geometry: { type: 'Point', coordinates: l.at }
      };
    });

    map.getSource(SRC).setData({ type: 'FeatureCollection', features: lines });
    map.getSource(SRC_NODES).setData({ type: 'FeatureCollection', features: nodes });

    // The popup is built by the engine and rendered synchronously in its own
    // click handler, but MapLibre attaches it on the next frame in some paths.
    // One retry covers that without polling forever.
    if (!injectIntoCard(links, direction)) {
      requestAnimationFrame(() => injectIntoCard(links, direction));
    }
    startAnimation(map);

    link.links_drawn = links.length;
    link.last_selection = { name, tech, direction, count: links.length,
      nearest_km: links.length ? Number(links[0].km.toFixed(3)) : null };
  }

  /* ── selection ───────────────────────────────────────────────────────── */

  function interactiveLayerIds(map) {
    // Whatever the engine has made visible and interactive. Reading the style
    // rather than hard-coding ids keeps this working as layers come and go.
    try {
      return map.getStyle().layers
        .filter(layer => /^l-/.test(layer.id) && layer.type !== 'background')
        .map(layer => layer.id)
        .filter(id => {
          try { return map.getLayoutProperty(id, 'visibility') !== 'none'; }
          catch (_) { return false; }
        });
    } catch (_) {
      return [];
    }
  }

  function install(map) {
    installStyles();
    ensureLayers(map);

    // The lines belong to the card. When the card closes, they go with it --
    // leaving neon on the map with nothing explaining it is how a screenshot
    // ends up quoted without its caveat.
    const popupWatcher = new MutationObserver(() => {
      if (link.links_drawn > 0 && !document.querySelector('.maplibregl-popup')) clearLinks();
    });
    try {
      popupWatcher.observe(map.getContainer(), { childList: true, subtree: true });
    } catch (error) {
      link.failures.push(String(error?.message || error));
    }

    // Registered after the engine's own click handler, so the engine's popup
    // opens first and this decorates it rather than racing it.
    map.on('click', async (event) => {
      try {
        const ids = interactiveLayerIds(map);
        if (!ids.length) return;
        let features = [];
        try { features = map.queryRenderedFeatures(event.point, { layers: ids }); }
        catch (_) { return; }
        if (!features.length) { clearLinks(); return; }

        // Either end of a link is a valid place to start. Whichever pixel was
        // clicked, the card that came up is the one the distances are written
        // onto, and the lines run to the other end.
        const hit = features.find(feature => {
          const properties = feature.properties || {};
          const tech = String(properties.tech || properties.type || '');
          return PROJECT_TECHS.has(tech) || feature.layer?.id === SUBS_LAYER_ID;
        });
        if (!hit) { clearLinks(); return; }

        const properties = hit.properties || {};
        const fromSubstation = hit.layer?.id === SUBS_LAYER_ID;
        const tech = String(properties.tech || properties.type || '');
        const origin = representativePoint(hit.geometry)
          || [event.lngLat.lng, event.lngLat.lat];
        const name = properties.name || properties.SiteName || properties['Site Name']
          || (fromSubstation ? 'Unnamed substation' : 'Unnamed project');

        if (fromSubstation) {
          // No fetch needed: the projects are already in the engine's own
          // source, and reading them there keeps one set of coordinates.
          drawLinks(map, origin, name, tech,
            nearestProjects(map, origin[0], origin[1]), 'from-substation');
          return;
        }

        const subs = await loadSubstations();
        drawLinks(map, origin, name, tech,
          nearestSubstations(origin[0], origin[1], subs), 'to-substation');
      } catch (error) {
        link.failures.push(String(error?.message || error));
      }
    });

    // Escape clears, the way a game HUD does.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') clearLinks();
    });

    // A backgrounded tab should not keep an animation frame loop alive.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAnimation();
      else if (link.links_drawn > 0 && capturedMap) startAnimation(capturedMap);
    });
  }

  /* ── capture the map ─────────────────────────────────────────────────── */

  function attach(map) {
    if (capturedMap) return;
    capturedMap = map;
    link.map_captured = true;
    const boot = () => {
      try { install(map); }
      catch (error) { link.failures.push(String(error?.message || error)); }
    };
    if (map.isStyleLoaded?.()) boot(); else map.once('load', boot);
  }

  // The engine keeps its map in a closure and returns nothing, so the only
  // clean handle is the constructor -- and the engine builds its map inside
  // initVentusMap, which runs after this file, so it is still ours to wrap.
  try {
    const gl = window.maplibregl;
    if (gl && typeof gl.Map === 'function' && !gl.Map.__gridatlasNeonWrapped) {
      const OriginalMap = gl.Map;
      function PatchedMap(...args) {
        const instance = new OriginalMap(...args);
        try { attach(instance); }
        catch (error) { link.failures.push(String(error?.message || error)); }
        return instance;
      }
      PatchedMap.prototype = OriginalMap.prototype;
      PatchedMap.__gridatlasNeonWrapped = true;
      Object.setPrototypeOf(PatchedMap, OriginalMap);
      gl.Map = PatchedMap;
    } else if (!gl) {
      link.failures.push('maplibregl unavailable when the neon cartridge loaded');
    }
  } catch (error) {
    link.failures.push(String(error?.message || error));
  }
})();
