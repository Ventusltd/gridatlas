/**
 * GridAtlas cartridge — neon substation links and the SLD layout sandbox.
 *
 * Generation 202608312008 (UTC), composition v9.8. Slot: replace-script for
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

  const GENERATION = '202608312008';

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

  // The flow. MapLibre repeats a dash array along the line, so a short period
  // puts several electrons on the wire at once instead of one dot going round.
  // Two layers half a period apart double the density without doubling the
  // speed, which would only look frantic.
  const FLOW_PERIOD = 1.5;
  const FLOW_SPEED = 0.055;
  const FLOW_PULSE = 0.42;

  function flowDash(phase) {
    const lead = Math.max(0.001, phase);
    const tail = Math.max(0.001, FLOW_PERIOD - phase);
    return [0.001, lead, FLOW_PULSE, tail];
  }

  const SRC = 'gridatlas-neon-links';
  const SRC_NODES = 'gridatlas-neon-nodes';
  const L_GLOW = 'l-neon-glow';
  const L_CORE = 'l-neon-core';
  const L_FLOW = 'l-neon-flow';
  const L_FLOW_B = 'l-neon-flow-b';
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
    deep_linked: false,
    substation_layer_enabled: false,
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
.${BLOCK_CLASS} .neon-layout{display:block;width:100%;margin-top:7px;padding:5px 6px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;
  font:inherit;font-size:10px;letter-spacing:.05em;cursor:pointer;text-transform:uppercase}
.${BLOCK_CLASS} .neon-layout:hover{border-color:#5fbdc2;color:#bfe9ee;background:#0d2429}
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

  // Remembered so the LAYOUT button knows what it was opened from.
  let lastSelection = null;

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
    // The way into the layout. Without this there is no route from a project
    // to the sandbox at all, which is exactly how it felt to use.
    const button = toSubstations
      ? `<button class="neon-layout" type="button">Lay out a scheme here &#9656;</button>`
      : '';
    return `<div class="${BLOCK_CLASS}">${head}<ol>${rows}</ol>${button}${caveatHtml()}</div>`;
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
    block.querySelector?.('.neon-layout')?.addEventListener('click', () => {
      if (!lastSelection || !capturedMap) return;
      // The array goes at the project and the cable runs to the nearest
      // substation found for it, which is the direction a scheme is actually
      // built: generation first, then the route to the network.
      openSldFromProject(capturedMap, lastSelection);
    });
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
    // Two flow layers, half a period apart, so a link reads as a stream of
    // electrons rather than one dot going round.
    map.addLayer({
      id: L_FLOW, type: 'line', source: SRC,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': FLOW_COLOUR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 12, 2.4],
        'line-opacity': 0.8,
        'line-dasharray': [0.2, 3.2]
      }
    });
    map.addLayer({
      id: L_FLOW_B, type: 'line', source: SRC,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': FLOW_COLOUR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 12, 1.8],
        'line-opacity': 0.45,
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
      try {
        map.setPaintProperty(L_FLOW, 'line-opacity', 0);
        map.setPaintProperty(L_FLOW_B, 'line-opacity', 0);
      } catch (_) { /* layer gone */ }
      return;
    }
    const step = () => {
      dashPhase = (dashPhase + FLOW_SPEED) % FLOW_PERIOD;
      const half = (dashPhase + FLOW_PERIOD / 2) % FLOW_PERIOD;
      try {
        map.setPaintProperty(L_FLOW, 'line-dasharray', flowDash(dashPhase));
        map.setPaintProperty(L_FLOW_B, 'line-dasharray', flowDash(half));
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
    lastSelection = { origin, name, tech, direction, links };
  }

  /* ── selection ───────────────────────────────────────────────────────── */

  // Tick the engine's own Subs control. Going through the checkbox means the
  // engine hydrates the layer, updates its UI state and stays the owner of it;
  // adding the source here instead would leave its panel lying about what is on.
  function enableSubstationLayer() {
    try {
      const box = [...document.querySelectorAll('input[type=checkbox]')].find((input) => {
        const label = (input.closest('label') || input.parentElement)?.textContent || '';
        return label.replace(/\s+/g, ' ').trim().toLowerCase().startsWith('subs ');
      });
      if (!box) { link.failures.push('subs: control not found'); return false; }
      if (!box.checked) box.click();
      link.substation_layer_enabled = true;
      return true;
    } catch (error) {
      link.failures.push('subs: ' + String(error?.message || error));
      return false;
    }
  }

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
    // Measure and draw for one selection. Split out of the click handler so a
    // deep link, which opens a card without anybody clicking, goes through
    // exactly the same path.
    async function selectAt(origin, name, tech, fromSubstation) {
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
    }
    link.selectAt = selectAt;

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
        await selectAt(origin, name, tech, fromSubstation);
      } catch (error) {
        link.failures.push(String(error?.message || error));
      }
    });

    // A deep link opens the project card on its own, with no click anywhere.
    // Arriving that way is how most people reach the Atlas -- the MAP button in
    // Pipeline News sends them here -- so the measurement has to run for it
    // too, or the card that brought them arrives with nothing on it.
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const lon = Number(q.get('longitude'));
        const lat = Number(q.get('latitude'));
        const tech = String(q.get('technology') || '');
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
        if (!PROJECT_TECHS.has(tech)) return;
        const name = q.get('project') || 'Deep-linked project';
        // Turn the substations on. Arriving from the MAP button in Pipeline
        // News, the whole point is to see the project against the network, and
        // a user who has to find a checkbox first has been handed a puzzle
        // rather than an answer. The engine owns the layer, so this ticks its
        // own control rather than reaching past it into the map.
        enableSubstationLayer();
        // Wait for the engine to put its own card up first, so this decorates
        // that card rather than racing it. Give up rather than hang.
        for (let i = 0; i < 40; i += 1) {
          if (document.querySelector('.maplibregl-popup-content')) break;
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        link.deep_linked = true;
        await selectAt([lon, lat], name, tech, false);
      } catch (error) {
        link.failures.push('deep link: ' + String(error?.message || error));
      }
    })();

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
      try { installSld(map); }
      catch (error) { link.failures.push('sld: ' + String(error?.message || error)); }
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

  /* ══════════════════════════════════════════════════════════════════════
     PART 3 — the SLD sandbox, ported from
     globalgrid2050/solar-bess-topology-v7/gis-sld-financial-sandbox.

     WHAT CHANGED IN THE PORT, AND WHY
     ---------------------------------
     The sandbox is a working engine and the arithmetic below is its
     arithmetic, carried across unchanged. Three things are deliberately
     different.

     1. ONE EARTH RADIUS. The sandbox measures cable length with
        atlasHaversineKm on R = 6378.137 but builds every rectangle, offset
        and projection with turf.destination, whose default is 6371.0088. It
        therefore mixes two radii inside one drawing: a 0.112% disagreement
        between where a thing IS and how far away it is said to be. That is
        the exact defect Ventusltd/grid-distance-maths was created to end.
        The Atlas ships no turf, so every geometric operation here is the
        canonical one on R_ATLAS and the mixture cannot recur.

     2. GRAB, DO NOT MODE-SWITCH. The sandbox moves the array by arming a
        mode and clicking a destination, and edits a route by dropping pins
        and committing them. Here the array is dragged by grabbing it, the
        rotation has a handle on its boundary, and route vertices are
        dragged, inserted on a segment and removed with a double click.
        Everything recomputes live while the pointer is down.

     3. THE ELECTRON FLOW CARRIES THROUGH. The travelling pulse used for the
        substation links runs along the 33 kV collectors and the export cable
        too, in the direction power actually flows: block, to customer
        substation, to grid node.

     WHAT IT STILL IS NOT
     --------------------
     A layout, not a design. Straight-line geometry with no wayleave,
     crossing, terrain, ground condition or consent content, and no
     confirmation that any of it can connect. The caveat block travels with
     it.
     ══════════════════════════════════════════════════════════════════════ */

  const SLD = {
    M2_PER_ACRE: 4046.86,
    BESS_M2_PER_MWH: 85,
    BESS_ASPECT: 2.5,
    BLOCK_SPACING_KM: 0.01,
    BOUNDARY_BUFFER_KM: 0.02,
    ARRAY_OFFSET_KM: 0.2
  };

  const SRC_SLD = 'gridatlas-sld';
  const SLD_LAYERS = {
    boundary: 'l-sld-boundary',
    boundaryLine: 'l-sld-boundary-line',
    block: 'l-sld-block',
    bess: 'l-sld-bess',
    radial: 'l-sld-radial',
    radialFlow: 'l-sld-radial-flow',
    cable: 'l-sld-cable',
    cableGlow: 'l-sld-cable-glow',
    cableFlow: 'l-sld-cable-flow',
    cableFlowB: 'l-sld-cable-flow-b',
    node: 'l-sld-node',
    pin: 'l-sld-pin',
    handle: 'l-sld-handle',
    label: 'l-sld-label'
  };

  // Muted SCADA, same family as the substation links.
  const SLD_COLOUR = {
    boundary: '#3f7fbf',
    block: '#5fbdc2',
    bess: '#b06ac0',
    radial: '#6fb582',
    cable: '#d9963c',
    node: '#e0b050',
    pin: '#bfe9ee',
    handle: '#d8c96a'
  };

  const sld = {
    active: false,
    gridNode: null,          // the substation the scheme connects to
    gridNodeName: '',
    gridNodeVoltage: '',
    arrayCentre: null,       // null = derived from the grid node and array size
    rotationDeg: 0,
    routePins: [],           // user vertices between customer substation and grid node
    stats: null,
    projectName: null,
    cableKm: 0,
    straightKm: 0,
    dragging: null,
    inputs: {
      mode: 'string',
      mod_wp: 660, mod_l: 2.38, mod_w: 1.30, gcr: 0.45, gross_factor: 1.35,
      x_mods: 28, z_strings: 18, y_invs: 28, s_subs: 5, b_cols: 6,
      dc_ac_ratio: 1.20, string_inv_kva: 352, string_skid_mva: 8.96,
      inv_ac_mw_c: 4.4, inv_dc_mw_c: 5.28, central_skid_mva_c: 4.4,
      x_mods_c: 28, str_per_cb_c: 1, inv_per_mv_c: 2, mv_per_ring_c: 4, rings_c: 3,
      bess_mwh: 0
    }
  };
  window.__GRIDATLAS_SLD__ = sld;

  /* ── geodesy the layout needs, all on R_ATLAS ────────────────────────── */

  function destinationPoint(lon, lat, km, bearingDeg) {
    const ad = km / R_ATLAS;
    const brg = bearingDeg * DEG;
    const p1 = lat * DEG;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(ad)
      + Math.cos(p1) * Math.sin(ad) * Math.cos(brg));
    const l2 = lon * DEG + Math.atan2(
      Math.sin(brg) * Math.sin(ad) * Math.cos(p1),
      Math.cos(ad) - Math.sin(p1) * Math.sin(p2));
    return [l2 / DEG, p2 / DEG];
  }

  function initialBearingDeg(lon1, lat1, lon2, lat2) {
    const p1 = lat1 * DEG; const p2 = lat2 * DEG;
    const dl = (lon2 - lon1) * DEG;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / DEG + 360) % 360;
  }

  function pathLengthKm(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      total += distanceKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    }
    return total;
  }

  function normBearing(deg) { return ((deg % 360) + 360) % 360; }

  // Scale factors from the WGS84 radii of curvature at a latitude, so a local
  // tangent plane is correct rather than merely convenient.
  function localScaleKm(latDeg) {
    const a = 6378.137;
    const e2 = (1 / 298.257223563) * (2 - 1 / 298.257223563);
    const s = Math.sin(latDeg * DEG);
    const t = 1 - e2 * s * s;
    return {
      kx: (a / Math.sqrt(t)) * Math.cos(latDeg * DEG) * DEG,
      ky: ((a * (1 - e2)) / t ** 1.5) * DEG
    };
  }

  // Perpendicular distance to a SEGMENT, and the foot of that perpendicular.
  // Measuring to an endpoint instead can only overstate; this is the function
  // whose absence caused the original circuit_km defect, and it is what
  // replaces turf.nearestPointOnLine in the ported layout.
  function distanceToSegmentKm(lon, lat, aLon, aLat, bLon, bLat) {
    const { kx, ky } = localScaleKm(lat);
    const ax = (aLon - lon) * kx; const ay = (aLat - lat) * ky;
    const bx = (bLon - lon) * kx; const by = (bLat - lat) * ky;
    const dx = bx - ax; const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = -(ax * dx + ay * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    const foot = [aLon + (bLon - aLon) * t, aLat + (bLat - aLat) * t];
    return { km: distanceKm(lon, lat, foot[0], foot[1]), foot, t };
  }

  // The sandbox's getRectPolygon, on one radius.
  function rectPolygon(centre, widthKm, lengthKm, rotationDeg) {
    const axis = normBearing(rotationDeg);
    const n = destinationPoint(centre[0], centre[1], lengthKm / 2, axis);
    const s = destinationPoint(centre[0], centre[1], lengthKm / 2, axis + 180);
    const nw = destinationPoint(n[0], n[1], widthKm / 2, axis - 90);
    const ne = destinationPoint(n[0], n[1], widthKm / 2, axis + 90);
    const se = destinationPoint(s[0], s[1], widthKm / 2, axis + 90);
    const sw = destinationPoint(s[0], s[1], widthKm / 2, axis - 90);
    return [[nw, ne, se, sw, nw]];
  }

  // The sandbox uses turf.nearestPointOnLine to drop each block onto the
  // collector trunk. distanceToSegmentKm already returns that foot.
  function footOnSegment(lon, lat, a, b) {
    return distanceToSegmentKm(lon, lat, a[0], a[1], b[0], b[1]).foot;
  }

  /* ── the sizing arithmetic, carried across unchanged ─────────────────── */

  function buildStats(o) {
    const i = sld.inputs;
    const dcMwp = (o.module_count * i.mod_wp) / 1e6;
    const acMw = o.ac_mw_direct != null ? o.ac_mw_direct
      : (o.dc_ac_ratio > 0 ? dcMwp / o.dc_ac_ratio : 0);
    const netModArea = o.module_count * i.mod_l * i.mod_w;
    const netArrayArea = i.gcr > 0 ? netModArea / i.gcr : 0;
    return {
      total_blocks: o.total_blocks,
      module_count: o.module_count,
      dc_mwp: dcMwp,
      ac_mw: acMw,
      dc_ac_ratio: acMw > 0 ? dcMwp / acMw : o.dc_ac_ratio,
      net_array_area_m2: netArrayArea,
      gross_site_area_m2: netArrayArea * i.gross_factor,
      block_ground_area_m2: o.total_blocks > 0 ? netArrayArea / o.total_blocks : 0,
      production_substation_ac_mva: o.production_substation_ac_mva || 0,
      ring_main_ac_mva: o.ring_main_ac_mva || 0,
      warning: o.warning || 'Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.'
    };
  }

  function computeStringStats() {
    const i = sld.inputs;
    if (i.mod_wp <= 0 || i.mod_l <= 0 || i.mod_w <= 0 || i.x_mods <= 0) {
      return buildStats({ total_blocks: 0, module_count: 0, dc_ac_ratio: i.dc_ac_ratio });
    }
    const total_blocks = i.b_cols * i.s_subs;
    const module_count = total_blocks * i.y_invs * i.z_strings * i.x_mods;
    const inverterAcMaxMva = (i.y_invs * i.string_inv_kva) / 1000;
    const production = i.string_skid_mva;
    let warning;
    if (inverterAcMaxMva > production) {
      warning = 'Inverter ACmax exceeds the skid transformer rating. Verify temperature rating, overload strategy and clipping assumptions.';
    } else if (i.string_inv_kva > 500) {
      warning = 'Large string inverter rating selected. Verify LV switchgear, transformer, cable loading and protection.';
    }
    return buildStats({
      total_blocks, module_count, dc_ac_ratio: i.dc_ac_ratio,
      ac_mw_direct: total_blocks * production,
      production_substation_ac_mva: production,
      ring_main_ac_mva: production * i.s_subs,
      warning
    });
  }

  function computeCentralStats() {
    const i = sld.inputs;
    if (i.mod_wp <= 0 || i.mod_l <= 0 || i.mod_w <= 0 || i.x_mods_c <= 0) {
      return buildStats({ total_blocks: 0, module_count: 0, dc_ac_ratio: 1.2 });
    }
    const strDcKwp = (i.x_mods_c * i.mod_wp) / 1000;
    const reqStrings = strDcKwp > 0 ? Math.ceil((i.inv_dc_mw_c * 1000) / strDcKwp) : 0;
    const total_blocks = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c;
    const module_count = reqStrings * i.x_mods_c * total_blocks;
    const production = i.central_skid_mva_c * i.inv_per_mv_c;
    let warning;
    if (i.inv_ac_mw_c > i.central_skid_mva_c) {
      warning = 'Central inverter AC output exceeds the skid transformer rating. Verify thermal rating and export limitation.';
    } else if (i.inv_ac_mw_c > 10) {
      warning = 'Large central inverter or power block selected. Verify transformer, MV switchgear, harmonics, thermal loading, protection and grid code compliance.';
    }
    return buildStats({
      total_blocks, module_count,
      dc_ac_ratio: i.inv_ac_mw_c > 0 ? i.inv_dc_mw_c / i.inv_ac_mw_c : 1.2,
      ac_mw_direct: total_blocks * i.central_skid_mva_c * i.inv_per_mv_c,
      production_substation_ac_mva: production,
      ring_main_ac_mva: production * i.mv_per_ring_c,
      warning
    });
  }

  const computeSldStats = () =>
    (sld.inputs.mode === 'string' ? computeStringStats() : computeCentralStats());

  /* ── the layout ──────────────────────────────────────────────────────── */

  function buildLayout() {
    const stats = computeSldStats();
    sld.stats = stats;
    if (!sld.gridNode || stats.total_blocks === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    const axis = normBearing(sld.rotationDeg);
    const N = stats.total_blocks;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);
    const blockAreaKm2 = stats.block_ground_area_m2 / 1e6;
    const aspect = sld.inputs.gcr === 0.45 ? 1 / 1.4 : sld.inputs.gcr === 0.75 ? 1.0 : 1.4;
    const blockW = Math.sqrt(blockAreaKm2 / aspect);
    const blockL = blockW * aspect;
    const gap = SLD.BLOCK_SPACING_KM;
    const gridW = cols * blockW + (cols - 1) * gap;
    const gridL = rows * blockL + (rows - 1) * gap;

    const gridNode = sld.gridNode;
    const offset = gridL / 2 + SLD.ARRAY_OFFSET_KM;
    const centre = sld.arrayCentre
      || destinationPoint(gridNode[0], gridNode[1], offset, axis);
    // The customer substation sits on the array edge nearest the grid node.
    const customerSub = destinationPoint(centre[0], centre[1], gridL / 2, axis + 180);

    const features = [];
    const push = (geometry, properties) =>
      features.push({ type: 'Feature', geometry, properties });

    // Site boundary, and the grab surface for dragging.
    push({ type: 'Polygon', coordinates: rectPolygon(centre, gridW + SLD.BOUNDARY_BUFFER_KM, gridL + SLD.BOUNDARY_BUFFER_KM, axis) },
      { kind: 'boundary', colour: SLD_COLOUR.boundary });

    // Blocks, laid out from the north-west corner along the axis.
    const ptN = destinationPoint(centre[0], centre[1], gridL / 2, axis);
    const ptNW = destinationPoint(ptN[0], ptN[1], gridW / 2, axis - 90);
    const blocks = [];
    let placed = 0;
    for (let r = 0; r < rows && placed < N; r += 1) {
      for (let c = 0; c < cols && placed < N; c += 1) {
        const across = destinationPoint(ptNW[0], ptNW[1],
          c * blockW + c * gap + blockW / 2, axis + 90);
        const at = destinationPoint(across[0], across[1],
          r * blockL + r * gap + blockL / 2, axis + 180);
        push({ type: 'Polygon', coordinates: rectPolygon(at, blockW, blockL, axis) },
          { kind: 'block', colour: SLD_COLOUR.block });
        blocks.push(at);
        placed += 1;
      }
    }

    // 33 kV collectors: each block drops onto a trunk running up the axis
    // from the customer substation, and the trunk is clipped to the furthest
    // block rather than drawn to the far edge of nothing.
    if (blocks.length) {
      const trunkEnd = destinationPoint(customerSub[0], customerSub[1], gridL, axis);
      let furthest = 0;
      const branches = [];
      for (const at of blocks) {
        const foot = footOnSegment(at[0], at[1], customerSub, trunkEnd);
        furthest = Math.max(furthest,
          distanceKm(customerSub[0], customerSub[1], foot[0], foot[1]));
        branches.push([at, foot]);
      }
      if (furthest > 0) {
        const clipped = destinationPoint(customerSub[0], customerSub[1], furthest, axis);
        push({ type: 'LineString', coordinates: [customerSub, clipped] },
          { kind: 'radial', role: 'collector_trunk', colour: SLD_COLOUR.radial });
      }
      for (const [at, foot] of branches) {
        push({ type: 'LineString', coordinates: [at, foot] },
          { kind: 'radial', role: 'block_branch', colour: SLD_COLOUR.radial });
      }
    }

    // BESS compound alongside the customer substation.
    if (sld.inputs.bess_mwh > 0) {
      const areaKm2 = (sld.inputs.bess_mwh * SLD.BESS_M2_PER_MWH) / 1e6;
      const w = Math.sqrt(areaKm2 * SLD.BESS_ASPECT);
      const l = areaKm2 / w;
      const at = destinationPoint(customerSub[0], customerSub[1], w / 2 + 0.05, axis - 90);
      push({ type: 'Polygon', coordinates: rectPolygon(at, w, l, axis) },
        { kind: 'bess', colour: SLD_COLOUR.bess });
      push({ type: 'LineString', coordinates: [at, customerSub] },
        { kind: 'radial', role: 'bess_tie', colour: SLD_COLOUR.radial });
    }

    // Export cable: customer substation, through the user's vertices, to the
    // grid node. Measured along its own path, and against the straight line
    // so the detour is visible rather than implied.
    const route = [customerSub, ...sld.routePins, gridNode];
    sld.cableKm = pathLengthKm(route);
    sld.straightKm = distanceKm(customerSub[0], customerSub[1], gridNode[0], gridNode[1]);
    push({ type: 'LineString', coordinates: route },
      { kind: 'cable', colour: SLD_COLOUR.cable, km: sld.cableKm });

    sld.routePins.forEach((at, index) => {
      push({ type: 'Point', coordinates: at },
        { kind: 'pin', index, colour: SLD_COLOUR.pin });
    });

    push({ type: 'Point', coordinates: customerSub },
      { kind: 'node', role: 'customer_substation', colour: SLD_COLOUR.node,
        label: `CUSTOMER SUB · ${stats.production_substation_ac_mva.toFixed(2)} MVA` });
    push({ type: 'Point', coordinates: gridNode },
      { kind: 'node', role: 'grid_node', colour: SLD_COLOUR.node,
        label: `${sld.gridNodeName || 'GRID NODE'}${sld.gridNodeVoltage ? ` · ${sld.gridNodeVoltage}` : ''}` });

    // Rotation handle, off the far edge of the array.
    const handle = destinationPoint(centre[0], centre[1], gridL / 2 + 0.12, axis);
    push({ type: 'Point', coordinates: handle },
      { kind: 'handle', colour: SLD_COLOUR.handle });
    push({ type: 'LineString', coordinates: [centre, handle] },
      { kind: 'radial', role: 'handle_stem', colour: SLD_COLOUR.handle });

    sld.geometry = { centre, customerSub, gridW, gridL, axis, handle, blocks: blocks.length };
    return { type: 'FeatureCollection', features };
  }

  function ensureSldLayers(map) {
    if (map.getSource(SRC_SLD)) return;
    map.addSource(SRC_SLD, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({ id: SLD_LAYERS.boundary, type: 'fill', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'boundary'],
      paint: { 'fill-color': SLD_COLOUR.boundary, 'fill-opacity': 0.07 } });
    map.addLayer({ id: SLD_LAYERS.boundaryLine, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'boundary'],
      paint: { 'line-color': SLD_COLOUR.boundary, 'line-width': 1.2, 'line-opacity': 0.65 } });
    map.addLayer({ id: SLD_LAYERS.block, type: 'fill', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'block'],
      paint: { 'fill-color': SLD_COLOUR.block, 'fill-opacity': 0.16,
        'fill-outline-color': SLD_COLOUR.block } });
    map.addLayer({ id: SLD_LAYERS.bess, type: 'fill', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'bess'],
      paint: { 'fill-color': SLD_COLOUR.bess, 'fill-opacity': 0.22,
        'fill-outline-color': SLD_COLOUR.bess } });

    map.addLayer({ id: SLD_LAYERS.radial, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'radial'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'colour'], 'line-width': 0.9, 'line-opacity': 0.5 } });
    // The electron flow, on the collectors.
    map.addLayer({ id: SLD_LAYERS.radialFlow, type: 'line', source: SRC_SLD,
      filter: ['all', ['==', ['get', 'kind'], 'radial'], ['!=', ['get', 'role'], 'handle_stem']],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOUR, 'line-width': 1.3, 'line-opacity': 0.65,
        'line-dasharray': [0.2, 3.2] } });

    map.addLayer({ id: SLD_LAYERS.cableGlow, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': SLD_COLOUR.cable, 'line-width': 8, 'line-opacity': 0.12,
        'line-blur': 5 } });
    map.addLayer({ id: SLD_LAYERS.cable, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': SLD_COLOUR.cable, 'line-width': 1.8, 'line-opacity': 0.85 } });
    map.addLayer({ id: SLD_LAYERS.cableFlow, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOUR, 'line-width': 2.4, 'line-opacity': 0.9,
        'line-dasharray': [0.2, 3.2] } });
    map.addLayer({ id: SLD_LAYERS.cableFlowB, type: 'line', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'cable'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOUR, 'line-width': 1.6, 'line-opacity': 0.55,
        'line-dasharray': [0.2, 3.2] } });

    map.addLayer({ id: SLD_LAYERS.node, type: 'circle', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'node'],
      paint: { 'circle-radius': 5, 'circle-color': SLD_COLOUR.node,
        'circle-stroke-color': '#000c10', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: SLD_LAYERS.pin, type: 'circle', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'pin'],
      paint: { 'circle-radius': 5, 'circle-color': SLD_COLOUR.pin, 'circle-opacity': 0.9,
        'circle-stroke-color': '#04343a', 'circle-stroke-width': 1.5 } });
    map.addLayer({ id: SLD_LAYERS.handle, type: 'circle', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'handle'],
      paint: { 'circle-radius': 6, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': SLD_COLOUR.handle, 'circle-stroke-width': 1.8 } });
    map.addLayer({ id: SLD_LAYERS.label, type: 'symbol', source: SRC_SLD,
      filter: ['==', ['get', 'kind'], 'node'],
      layout: { 'text-field': ['get', 'label'], 'text-size': 9.5,
        'text-offset': [0, -1.4], 'text-anchor': 'bottom',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'] },
      paint: { 'text-color': '#a9c4c9', 'text-halo-color': '#000c10',
        'text-halo-width': 1.5 } });
  }

  let sldFlowHandle = null;
  let sldPhase = 0;
  function animateSld(map) {
    if (sldFlowHandle !== null) cancelAnimationFrame(sldFlowHandle);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      try {
        map.setPaintProperty(SLD_LAYERS.cableFlow, 'line-opacity', 0);
        map.setPaintProperty(SLD_LAYERS.cableFlowB, 'line-opacity', 0);
        map.setPaintProperty(SLD_LAYERS.radialFlow, 'line-opacity', 0);
      } catch (_) { /* layer gone */ }
      return;
    }
    const step = () => {
      sldPhase = (sldPhase + FLOW_SPEED) % FLOW_PERIOD;
      const half = (sldPhase + FLOW_PERIOD / 2) % FLOW_PERIOD;
      try {
        map.setPaintProperty(SLD_LAYERS.cableFlow, 'line-dasharray', flowDash(sldPhase));
        map.setPaintProperty(SLD_LAYERS.cableFlowB, 'line-dasharray', flowDash(half));
        map.setPaintProperty(SLD_LAYERS.radialFlow, 'line-dasharray', flowDash(sldPhase));
      } catch (_) { sldFlowHandle = null; return; }
      sldFlowHandle = requestAnimationFrame(step);
    };
    sldFlowHandle = requestAnimationFrame(step);
  }

  function redrawSld(map, { fit = false } = {}) {
    ensureSldLayers(map);
    const data = buildLayout();
    map.getSource(SRC_SLD).setData(data);
    renderSldPanel();
    if (data.features.length) animateSld(map);
    if (fit && data.features.length && sld.geometry) {
      const lons = []; const lats = [];
      for (const f of data.features) {
        const walk = (c) => {
          if (typeof c[0] === 'number') { lons.push(c[0]); lats.push(c[1]); return; }
          c.forEach(walk);
        };
        walk(f.geometry.coordinates);
      }
      map.fitBounds([[Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)]], { padding: 70, duration: 700 });
    }
  }

  /* ── dragging ────────────────────────────────────────────────────────── */

  function attachSldDragging(map) {
    const canvas = map.getCanvas();
    const grabbable = [SLD_LAYERS.handle, SLD_LAYERS.pin, SLD_LAYERS.boundary];

    map.on('mousemove', (event) => {
      if (!sld.active || sld.dragging) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: grabbable.filter(id => map.getLayer(id)) });
      canvas.style.cursor = hits.length ? 'grab' : '';
    });

    map.on('mousedown', (event) => {
      if (!sld.active) return;
      const layers = grabbable.filter(id => map.getLayer(id));
      if (!layers.length) return;
      const hits = map.queryRenderedFeatures(event.point, { layers });
      if (!hits.length) return;
      const kind = hits[0].properties?.kind;
      if (kind === 'handle') sld.dragging = { what: 'rotate' };
      else if (kind === 'pin') sld.dragging = { what: 'pin', index: Number(hits[0].properties.index) };
      else if (kind === 'boundary') sld.dragging = { what: 'array' };
      else return;
      event.preventDefault();
      map.dragPan.disable();
      canvas.style.cursor = 'grabbing';
    });

    map.on('mousemove', (event) => {
      if (!sld.dragging) return;
      const at = [event.lngLat.lng, event.lngLat.lat];
      if (sld.dragging.what === 'array') {
        sld.arrayCentre = at;
      } else if (sld.dragging.what === 'rotate') {
        const c = sld.geometry?.centre;
        if (c) sld.rotationDeg = initialBearingDeg(c[0], c[1], at[0], at[1]);
      } else if (sld.dragging.what === 'pin') {
        sld.routePins[sld.dragging.index] = at;
      }
      redrawSld(map);
    });

    const release = () => {
      if (!sld.dragging) return;
      sld.dragging = null;
      map.dragPan.enable();
      canvas.style.cursor = '';
    };
    map.on('mouseup', release);
    map.on('mouseout', release);

    // Click the cable to insert a vertex where you clicked; double-click a
    // vertex to remove it. No modes, no commit step.
    map.on('click', (event) => {
      if (!sld.active || !map.getLayer(SLD_LAYERS.cable)) return;
      const onPin = map.queryRenderedFeatures(event.point, { layers: [SLD_LAYERS.pin] });
      if (onPin.length) return;
      const onCable = map.queryRenderedFeatures(event.point, { layers: [SLD_LAYERS.cable] });
      if (!onCable.length) return;
      const at = [event.lngLat.lng, event.lngLat.lat];
      const route = [sld.geometry.customerSub, ...sld.routePins, sld.gridNode];
      let best = 0; let bestKm = Infinity;
      for (let i = 0; i < route.length - 1; i += 1) {
        const km = distanceToSegmentKm(at[0], at[1], route[i][0], route[i][1],
          route[i + 1][0], route[i + 1][1]).km;
        if (km < bestKm) { bestKm = km; best = i; }
      }
      sld.routePins.splice(best, 0, at);
      redrawSld(map);
    });

    map.on('dblclick', (event) => {
      if (!sld.active || !map.getLayer(SLD_LAYERS.pin)) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: [SLD_LAYERS.pin] });
      if (!hits.length) return;
      event.preventDefault();
      sld.routePins.splice(Number(hits[0].properties.index), 1);
      redrawSld(map);
    });
  }

  /* ── the panel ───────────────────────────────────────────────────────── */

  const PANEL_ID = 'gridatlas-sld-panel';

  function installSldStyles() {
    if (document.getElementById('gridatlas-sld-css')) return;
    const style = document.createElement('style');
    style.id = 'gridatlas-sld-css';
    style.textContent = `
/* Top RIGHT, below the search box. The Atlas keeps its own tool buttons down
   the left edge -- EXPORT CSV, RADIUS SEARCH, ZONE DRAW, MEASURE -- and a
   panel on that side covers them, and the search bar occupies 72-96px inside
   the map container on the right, so the panel clears it at 112px. Both offsets
   were measured on the live map: no headless test catches a collision with a
   component the panel knows nothing about. */
#${PANEL_ID}{position:absolute;right:14px;top:112px;z-index:11;width:310px;
  max-height:calc(100% - 28px);overflow:auto;font:11px/1.5 'Courier New',monospace;
  color:#cfe9ee;background:rgba(2,8,11,.93);border:1px solid #0b5f63;border-radius:5px;
  padding:11px 12px;box-shadow:0 0 22px rgba(0,255,255,.14);backdrop-filter:blur(3px);display:none}
#${PANEL_ID}[data-open="true"]{display:block}
#${PANEL_ID} h4{margin:0 0 2px;font-size:10px;letter-spacing:.09em;color:#5fbdc2;text-transform:uppercase;
  display:flex;align-items:center;gap:7px}
#${PANEL_ID} .sld-beta{font-size:8px;padding:1px 4px;border-radius:2px;background:#3a2f12;
  color:#e0b050;border:1px solid #6a5320}
#${PANEL_ID} .sld-site{color:#fff;font-size:12px;font-weight:bold;margin:2px 0 8px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${PANEL_ID} .sld-close{margin-left:auto;cursor:pointer;background:none;border:0;color:#3f6f75;
  font:inherit;font-size:14px;padding:0 2px}
#${PANEL_ID} .sld-close:hover{color:#5fbdc2}
#${PANEL_ID} .sld-to{color:#8b9aa1;font-size:9.5px;margin:-6px 0 8px}
#${PANEL_ID} .sld-tabs{display:flex;gap:5px;margin-bottom:8px}
#${PANEL_ID} .sld-tabs button{flex:1;background:#050a0d;border:1px solid #1d3238;color:#7f939a;
  font:inherit;font-size:9px;padding:4px;cursor:pointer;border-radius:3px;text-transform:uppercase}
#${PANEL_ID} .sld-tabs button[data-on="true"]{color:#5fbdc2;border-color:#5fbdc2}
#${PANEL_ID} .sld-grid{display:grid;grid-template-columns:1fr 62px;gap:3px 7px;align-items:center}
#${PANEL_ID} label{color:#8b9aa1;font-size:10px}
#${PANEL_ID} input,#${PANEL_ID} select{width:100%;background:#050a0d;border:1px solid #1d3238;
  color:#d8dee6;font:inherit;font-size:10px;padding:2px 4px;border-radius:2px}
#${PANEL_ID} input:focus,#${PANEL_ID} select:focus{outline:1px solid #5fbdc2}
#${PANEL_ID} .sld-out{margin-top:9px;padding-top:8px;border-top:1px solid #10262b;
  display:grid;grid-template-columns:1fr auto;gap:2px 8px}
#${PANEL_ID} .sld-out b{color:#e0b050;font-variant-numeric:tabular-nums}
#${PANEL_ID} .sld-out .lit{color:#5fbdc2}
#${PANEL_ID} .sld-warn{margin-top:7px;color:#d9963c;font-size:9px;line-height:1.45}
#${PANEL_ID} .sld-caveat{margin-top:7px;padding-top:7px;border-top:1px solid #10262b;
  color:#68797f;font-size:9px;line-height:1.5}
#${PANEL_ID} .sld-caveat b{color:#8b9aa1}
#${PANEL_ID} .sld-hint{margin-top:6px;color:#5f7a80;font-size:9px;line-height:1.45}
@media (max-width:700px){#${PANEL_ID}{width:auto;left:14px;right:14px;top:96px}}`;
    document.head.appendChild(style);
  }

  function sldPanel() {
    let el = document.getElementById(PANEL_ID);
    if (el) return el;
    installSldStyles();
    el = document.createElement('div');
    el.id = PANEL_ID;
    (capturedMap?.getContainer() || document.body).appendChild(el);
    return el;
  }

  const FIELDS_STRING = [
    ['mod_wp', 'Module rating Wp'], ['mod_l', 'Module length m'], ['mod_w', 'Module width m'],
    ['gcr', 'Ground cover ratio'], ['gross_factor', 'Gross site factor'],
    ['x_mods', 'Modules / string'], ['z_strings', 'Strings / inverter'],
    ['y_invs', 'Inverters / skid'], ['s_subs', 'Skids / ring main'], ['b_cols', 'Ring main circuits'],
    ['string_inv_kva', 'String inverter kVA'], ['string_skid_mva', 'Skid transformer MVA'],
    ['dc_ac_ratio', 'DC/AC ratio'], ['bess_mwh', 'BESS MWh']
  ];
  const FIELDS_CENTRAL = [
    ['mod_wp', 'Module rating Wp'], ['mod_l', 'Module length m'], ['mod_w', 'Module width m'],
    ['gcr', 'Ground cover ratio'], ['gross_factor', 'Gross site factor'],
    ['x_mods_c', 'Modules / string'], ['str_per_cb_c', 'Strings / combiner'],
    ['inv_ac_mw_c', 'Inverter AC MW'], ['inv_dc_mw_c', 'Inverter DC MWp'],
    ['central_skid_mva_c', 'Skid MVA'], ['inv_per_mv_c', 'Inverters / MV'],
    ['mv_per_ring_c', 'MV / ring'], ['rings_c', 'Rings'], ['bess_mwh', 'BESS MWh']
  ];

  function renderSldPanel() {
    const el = sldPanel();
    const s = sld.stats;
    const fields = sld.inputs.mode === 'string' ? FIELDS_STRING : FIELDS_CENTRAL;
    const detour = sld.straightKm > 0 ? sld.cableKm / sld.straightKm : 1;
    const acres = s ? s.gross_site_area_m2 / SLD.M2_PER_ACRE : 0;

    el.innerHTML = `
      <h4>Layout sandbox<span class="sld-beta">Beta</span>
        <button class="sld-close" title="Close">&times;</button></h4>
      <div class="sld-site">${escapeHtml(sld.projectName || sld.gridNodeName || 'Grid node')}</div>
      ${sld.projectName ? `<div class="sld-to">to ${escapeHtml(sld.gridNodeName || 'grid node')}`
        + `${sld.gridNodeVoltage ? ` &middot; ${escapeHtml(sld.gridNodeVoltage)}` : ''}</div>` : ''}
      <div class="sld-tabs">
        <button data-mode="string" data-on="${sld.inputs.mode === 'string'}">String</button>
        <button data-mode="central" data-on="${sld.inputs.mode === 'central'}">Central</button>
      </div>
      <div class="sld-grid">
        ${fields.map(([key, label]) =>
          `<label for="sld_${key}">${label}</label>`
          + `<input id="sld_${key}" data-key="${key}" type="number" step="any" value="${sld.inputs[key]}">`
        ).join('')}
      </div>
      <div class="sld-out">
        <span>DC capacity</span><b>${s ? s.dc_mwp.toFixed(1) : '0.0'} MWp</b>
        <span>AC capacity</span><b>${s ? s.ac_mw.toFixed(1) : '0.0'} MW</b>
        <span>DC/AC</span><b>${s ? s.dc_ac_ratio.toFixed(2) : '0.00'}</b>
        <span>Modules</span><b>${s ? s.module_count.toLocaleString('en-GB') : '0'}</b>
        <span>Blocks</span><b>${s ? s.total_blocks : 0}</b>
        <span>Gross site</span><b>${acres.toFixed(0)} acres</b>
        <span>Ring main</span><b>${s ? s.ring_main_ac_mva.toFixed(2) : '0.00'} MVA</b>
        <span class="lit">Export cable</span><b class="lit">${sld.cableKm.toFixed(3)} km</b>
        <span>Straight line</span><b>${sld.straightKm.toFixed(3)} km</b>
        <span>Detour factor</span><b>${detour.toFixed(2)}&times;</b>
        <span>Route vertices</span><b>${sld.routePins.length}</b>
        <span>Rotation</span><b>${normBearing(sld.rotationDeg).toFixed(0)}&deg;</b>
      </div>
      ${s && s.warning ? `<div class="sld-warn">${escapeHtml(s.warning)}</div>` : ''}
      <div class="sld-hint">Drag the site to move it. Drag the handle to rotate. Click the
        cable to add a vertex, drag a vertex to shape the route, double-click one to remove it.</div>
      <div class="sld-caveat"><b>Beta analytics, not an actual grid connection.</b> A layout, not
        a design. Every length is straight-line between the points shown, with no wayleave,
        easement, right of way, crossing, terrain, ground condition or consent content, and no
        route has been walked. A real connection depends on factors that must be studied:
        network impedance and fault level, thermal headroom, existing committed connections and
        queue position, and land control. A mapped substation does not confirm capacity, voltage
        suitability or acceptance by any network party.</div>`;

    el.dataset.open = 'true';
    // Optional throughout: a panel that cannot find its own controls must not
    // take the layout down with it. The geometry is the product; the panel is
    // how it is driven.
    el.querySelector?.('.sld-close')?.addEventListener('click', closeSld);
    (el.querySelectorAll?.('.sld-tabs button') || []).forEach(button => {
      button.addEventListener('click', () => {
        sld.inputs.mode = button.dataset.mode;
        if (capturedMap) redrawSld(capturedMap);
      });
    });
    (el.querySelectorAll?.('input[data-key]') || []).forEach(input => {
      input.addEventListener('change', () => {
        const value = Number(input.value);
        if (Number.isFinite(value)) sld.inputs[input.dataset.key] = value;
        if (capturedMap) redrawSld(capturedMap);
      });
    });
  }

  function closeSld() {
    sld.active = false;
    sld.projectName = null;
    sld.routePins = [];
    sld.arrayCentre = null;
    sld.rotationDeg = 0;
    if (sldFlowHandle !== null) { cancelAnimationFrame(sldFlowHandle); sldFlowHandle = null; }
    const el = document.getElementById(PANEL_ID);
    if (el) el.dataset.open = 'false';
    if (capturedMap && capturedMap.getSource(SRC_SLD)) {
      capturedMap.getSource(SRC_SLD).setData({ type: 'FeatureCollection', features: [] });
    }
  }

  // Opened from the substation card the neon links already produce, so the
  // sandbox is one click from the thing it connects to.
  function openSldAt(map, gridNode, name, voltage) {
    sld.active = true;
    sld.projectName = null;
    sld.gridNode = gridNode;
    sld.gridNodeName = name;
    sld.gridNodeVoltage = voltage;
    sld.arrayCentre = null;
    sld.rotationDeg = 0;
    sld.routePins = [];
    redrawSld(map, { fit: true });
  }
  sld.openAt = openSldAt;

  // Opened from a project card. The scheme sits at the project and the export
  // cable runs to the nearest substation the links already found, which is the
  // order a scheme is actually built: generation first, then the route to the
  // network. Falls back to the project's own point if nothing was in range, so
  // the button never does nothing.
  function openSldFromProject(map, selection) {
    const nearest = selection.links && selection.links[0];
    if (!nearest) {
      sld.active = false;
      link.failures.push('layout: no substation within '
        + `${MAX_LINK_KM} km of ${selection.name}`);
      return;
    }
    sld.active = true;
    sld.gridNode = nearest.at;
    sld.gridNodeName = nearest.name || 'Grid node';
    sld.gridNodeVoltage = nearest.kv && nearest.kv.length ? `${nearest.kv[0]} kV` : '';
    sld.projectName = selection.name;
    // The array starts on the project, not offset from the substation, because
    // the project is the thing that exists.
    sld.arrayCentre = selection.origin;
    sld.rotationDeg = initialBearingDeg(
      nearest.at[0], nearest.at[1], selection.origin[0], selection.origin[1]);
    sld.routePins = [];
    enableSubstationLayer();
    redrawSld(map, { fit: true });
  }
  sld.openFromProject = openSldFromProject;

  function installSld(map) {
    installSldStyles();
    ensureSldLayers(map);
    attachSldDragging(map);
    // A substation click offers the layout; the neon links still draw.
    map.on('click', (event) => {
      if (!map.getLayer(SUBS_LAYER_ID)) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: [SUBS_LAYER_ID] });
      if (!hits.length) return;
      const properties = hits[0].properties || {};
      const at = representativePoint(hits[0].geometry);
      if (!at) return;
      openSldAt(map, at, properties.name || 'Grid node',
        (voltagesKv(properties)[0] ? `${voltagesKv(properties)[0]} kV` : ''));
    });
  }
})();
