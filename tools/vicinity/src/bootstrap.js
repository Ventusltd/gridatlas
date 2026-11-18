const W = window, D = document, NS = W.__GRIDATLAS_MODULES__ = W.__GRIDATLAS_MODULES__ || {};
if (!NS.gridVicinity) {
  let controller = null, timer = null, stopped = false, pendingIntent = null, intentError = null;
  try { pendingIntent = parseVicinityIntent(W.location.search); } catch (error) { intentError = error.message; }
  function createController(map) {
    const geodesy = NS.geodesy;
    if (!geodesy?.distanceKm || !geodesy?.voltagesKv || !geodesy?.representativePoint) throw new Error('Canonical Atlas geodesy is not ready.');
    const host = map.getContainer(), prior = D.getElementById('gridatlas-vicinity');
    if (prior) throw new Error('Vicinity UI already mounted.');
    let alive = true, opened = false, origin = null, radius = 10, picking = false, result = null, records = [], contextSource = 'No loaded substation data', error = null;
    let source = null, sourceUnavailable = false, selectionEpoch = 0, refreshTimer = null, returning = null;
    const itinerary = [], bands = new Set(VOLTAGE_BANDS.map(b => b[0])), listeners = [], groups = [], controls = [], ownedLayers = new Map();
    const SOURCE = 'gridatlas-vicinity-context', LAYERS = ['gridatlas-vicinity-radius', 'gridatlas-vicinity-points', 'gridatlas-vicinity-model'];
    const root = D.createElement('div'); root.id = 'gridatlas-vicinity'; host.appendChild(root);
    const style = D.createElement('style'); style.textContent = VICINITY_CSS; root.appendChild(style);
    function el(tag, text, parent, attrs = {}) { const e = D.createElement(tag); if (text != null) e.textContent = text; for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; }
    function listen(target, type, fn) { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); }
    const launch = el('button', 'Vicinity · 1–50 km', root, {type: 'button', class: 'vic-launch', 'aria-expanded': 'false', 'aria-controls': 'gridatlas-vicinity-panel'});
    const panel = el('section', null, root, {id: 'gridatlas-vicinity-panel', class: 'vic-panel', 'aria-label': 'Vicinity familiarisation'}); panel.hidden = true;
    const heading = el('div', null, panel, {class: 'vic-head'}); el('h2', 'Explore the nearby grid', heading);
    const close = el('button', 'Close', heading, {type: 'button', 'aria-label': 'Close vicinity explorer'});
    const originLabel = el('p', '', panel, {class: 'vic-origin'});
    el('p', 'Spatial vicinity, connectivity unknown. Mapped points and voltage tags are context, not capacity or an electrical path.', panel, {class: 'vic-caption'});
    const actions = el('div', null, panel, {class: 'vic-actions'});
    const centre = el('button', 'Use map centre', actions, {type: 'button'});
    const pick = el('button', 'Pick origin on map', actions, {type: 'button', 'aria-pressed': 'false'});
    const fit = el('button', 'Fit radius', actions, {type: 'button'});
    const radial = el('fieldset', null, panel); el('legend', 'Radius in whole kilometres', radial);
    const rangeLabel = el('label', '', radial, {for: 'gridatlas-vicinity-radius-input'});
    const slider = el('input', null, radial, {id: 'gridatlas-vicinity-radius-input', type: 'range', min: '1', max: '50', step: '1', value: '10', 'aria-label': 'Vicinity radius in kilometres'});
    const voltage = el('fieldset', null, panel); el('legend', 'Source voltage tags', voltage);
    const bandBox = el('div', null, voltage, {class: 'vic-bands'});
    for (const [key, name, colour] of VOLTAGE_BANDS) {
      const label = el('label', null, bandBox), input = el('input', null, label, {type: 'checkbox', value: key, 'aria-label': name}); input.checked = true;
      const text = el('span', name, label); text.style.color = colour;
      listen(input, 'change', () => { input.checked ? bands.add(key) : bands.delete(key); refresh(); });
    }
    const status = el('p', '', panel, {class: 'vic-status', role: 'status', 'aria-live': 'polite'});
    const failure = el('p', '', panel, {class: 'vic-error', role: 'alert'}); failure.hidden = true;
    const modelBox = el('fieldset', null, panel); el('legend', 'Your local grid model', modelBox);
    el('p', 'Add mapped stations in your chosen order. Dashed pink joins are your assumed scenario, not source-confirmed cables or power flow.', modelBox);
    const modelStatus = el('p', 'No stations added.', modelBox, {class: 'vic-model-status'});
    const modelActions = el('div', null, modelBox, {class: 'vic-actions'});
    const undo = el('button', 'Undo last station', modelActions, {type: 'button'}), clear = el('button', 'Clear model', modelActions, {type: 'button'});
    el('p', 'Nearby mapped substations · straight-line distance', panel);
    const list = el('ol', null, panel, {class: 'vic-results'});
    el('p', 'Existing Atlas substation layer; source tags and coverage may be incomplete. Reuses the map’s existing data loader.', panel, {class: 'vic-source'});

    function readRecords() {
      let features = [];
      try { if (map.getSource('src-subs')) features = map.querySourceFeatures('src-subs') || []; } catch (_) {}
      if (features.length) { contextSource = 'Loaded Atlas substation source'; return stationRecords(features, geodesy); }
      const loaded = W.__GRIDATLAS_NEON_LINKS__?.substations || W.__GRIDATLAS_SUBSTATIONS__ || [];
      if (loaded.length) {
        contextSource = 'Loaded Atlas ≥33 kV screening subset; lower voltages are not included';
        return stationRecords(loaded.map(row => ({type: 'Feature', id: row.id ?? undefined, geometry: {type: 'Point', coordinates: row.at},
          properties: {name: row.name, operator: row.operator, kv: (row.kv || []).join(';'), source: row.source || 'Existing Atlas screening subset'}})), geodesy);
      }
      contextSource = 'Substation layer is not loaded yet'; return [];
    }
    function draw() {
      if (!opened || !result || !alive) return;
      try {
        let current = map.getSource(SOURCE);
        if (current && current !== source) { sourceUnavailable = true; return; }
        for (const id of LAYERS) {
          const existing = map.getLayer(id);
          if (existing && existing !== ownedLayers.get(id)) { sourceUnavailable = true; showError('A map layer ID is already in use. Results remain available; existing layers were preserved.'); return; }
        }
        if (!current) { map.addSource(SOURCE, {type: 'geojson', data: {type: 'FeatureCollection', features: []}}); source = map.getSource(SOURCE); }
        sourceUnavailable = false;
        const specs = [
          {id: LAYERS[0], type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'radius'], paint: {'line-color': '#0ff', 'line-width': 1.5, 'line-dasharray': [3,3], 'line-opacity': 0.8}},
          {id: LAYERS[1], type: 'circle', source: SOURCE, filter: ['in', ['get', 'kind'], ['literal', ['origin','substation']]], paint: {'circle-color': ['case', ['==', ['get', 'kind'], 'origin'], '#ff4fd8', ['get', 'colour']], 'circle-radius': ['case', ['==', ['get', 'kind'], 'origin'], 8, 5], 'circle-stroke-color': '#020809', 'circle-stroke-width': 1.5}},
          {id: LAYERS[2], type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'user-model'], paint: {'line-color': '#ff4fd8', 'line-width': 3, 'line-dasharray': [2,3]}}
        ];
        for (const spec of specs) if (!map.getLayer(spec.id)) { map.addLayer(spec); ownedLayers.set(spec.id, map.getLayer(spec.id)); }
        const data = vicinityGeoJSON(result, geodesy);
        if (itinerary.length > 1) data.features.push({type: 'Feature', properties: {kind: 'user-model', evidence: 'USER_ASSUMED_LOCAL_MODEL'}, geometry: {type: 'LineString', coordinates: itinerary.map(row => row.at)}});
        source.setData(data);
      } catch (e) { sourceUnavailable = true; failure.textContent = 'Map overlay not ready. Results remain available below.'; failure.hidden = false; }
    }
    function removeMap(mapRemoved = false) {
      if (!source || mapRemoved) { source = null; ownedLayers.clear(); return; }
      try {
        if (map.getSource(SOURCE) === source) {
          for (const id of [...LAYERS].reverse()) if (map.getLayer(id) && map.getLayer(id) === ownedLayers.get(id)) map.removeLayer(id);
          const foreignDependency = (map.getStyle()?.layers || []).some(layer => layer.source === SOURCE);
          if (!foreignDependency && map.getSource(SOURCE) === source) map.removeSource(SOURCE);
        }
      } catch (_) {}
      source = null; ownedLayers.clear();
    }
    function showError(message) { error = message; failure.textContent = message; failure.hidden = !message; }
    function updateModel() { modelStatus.textContent = itinerary.length ? `${itinerary.length} selected stations: ${itinerary.map(row => row.name).join(' → ')}. User-assumed joins.` : 'No stations added.'; undo.disabled = clear.disabled = !itinerary.length; }
    function addStation(row) {
      if (itinerary.length >= 20) { showError('This local model holds up to 20 stations. Undo or clear to make another choice.'); return; }
      if (itinerary.at(-1)?.at.every((n,i) => n === row.at[i])) { showError('That station is already the last choice.'); return; }
      itinerary.push({...row, at: row.at.slice()}); showError(null); updateModel(); draw();
    }
    function refresh() {
      if (!alive || !opened) return;
      try {
        records = readRecords(); result = exploreVicinity({origin, radius, records, bands, geodesy});
        originLabel.textContent = `Origin: ${origin.name}${origin.id ? ' · source ID ' + origin.id : ''}`;
        rangeLabel.textContent = `${radius} km radius`; slider.value = String(radius);
        status.textContent = `${result.matching} matching mapped stations within ${radius} km · ${result.loadedRecords} loaded records. ${result.truncated ? 'Showing nearest 200. ' : ''}${contextSource}.`;
        list.replaceChildren();
        for (const row of result.shown) {
          const item = el('li', row.name, list); el('span', `${row.km.toFixed(2)} km · ${row.kv.length ? row.kv.join(' / ') + ' kV' : 'Voltage not stated'}${row.operator ? ' · ' + row.operator : ''}`, item, {class: 'vic-row-meta'});
          const buttons = el('div', null, item, {class: 'vic-actions'});
          const recenter = el('button', 'Use as origin', buttons, {type: 'button', 'aria-label': 'Use ' + row.name + ' as origin'});
          const add = el('button', 'Add to my model', buttons, {type: 'button', 'aria-label': 'Add ' + row.name + ' to my model'});
          recenter.addEventListener('click', () => setOrigin({at: row.at, name: row.name, id: row.id, type: 'substation'}));
          add.addEventListener('click', () => addStation(row));
        }
        draw(); updateModel();
      } catch (e) { showError(e.message); }
    }
    function setOrigin(next) {
      try { const validated = normaliseOrigin(next); origin = validated; selectionEpoch++; picking = false; pick.setAttribute('aria-pressed', 'false'); pick.textContent = 'Pick origin on map'; showError(null); refresh(); return true; }
      catch (e) { origin = null; result = null; list.replaceChildren(); originLabel.textContent = 'Origin was not applied.'; removeMap(); showError(e.message); return false; }
    }
    function mapCentre() { const c = map.getCenter(); return {at: [c.lng, c.lat], type: 'map-centre', id: null, name: 'Chosen map centre'}; }
    function fitRadius() {
      if (!result) return;
      const points = vicinityGeoJSON(result, geodesy).features[0].geometry.coordinates;
      const lngs = points.map(p => p[0]), lats = points.map(p => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {padding: 32, duration: 0});
    }
    function installControls() {
      for (const host of [D.getElementById('scada-ui-container'), D.getElementById('fs-curtain-keys'), D.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body')]) {
        if (!host || groups.some(g => g.parentNode === host)) continue;
        if (host.id === 'scada-ui-container' && !host.querySelector('input[data-layer-id]')) continue;
        if (host.id === 'fs-curtain-keys' && !host.querySelector('input[data-layer-id]')) continue;
        if (host.closest?.('#gridatlas-menu-bar-panel-4') && !NS.menuBar?.installed) continue;
        const group = el('div', null, host, {class: 'key-group', 'data-vicinity-group': 'true'}); group.style.gridColumn = '1/-1'; el('div', 'Vicinity familiarisation', group, {class: 'key-title'});
        const button = el('button', 'Explore nearby grid · 1–50 km', group, {type: 'button', class: 'map-ctrl-btn', 'aria-expanded': String(opened), 'aria-controls': panel.id});
        button.style.minHeight = '44px'; listen(button, 'click', event => { event.stopPropagation(); NS.menuBar?.closeAll?.(); returning = button; open(); }); groups.push(group); controls.push(button);
      }
    }
    function open(options = {}) {
      if (!alive) return false;
      returning = D.activeElement; opened = true; panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); for (const b of controls) b.setAttribute('aria-expanded', 'true');
      try {
        if (options.error) { origin = null; result = null; removeMap(); list.replaceChildren(); originLabel.textContent = 'Journey link was not applied. Choose an origin to explore.'; status.textContent = ''; showError(options.error); close.focus(); return false; }
        radius = radiusKm(options.radiusKm ?? radius);
        if (!setOrigin(options.origin || origin || mapCentre())) return false;
        try { W.__GRIDATLAS_NEON_LINKS__?.enableSubstationLayer?.(); } catch (_) {}
        refresh(); close.focus(); return true;
      } catch (e) { showError(e.message); close.focus(); return false; }
    }
    function shut() {
      if (!alive) return;
      opened = false; picking = false; panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); for (const b of controls) b.setAttribute('aria-expanded', 'false');
      removeMap(); const candidate = returning?.isConnected && returning.getClientRects().length ? returning : D.getElementById('gridatlas-menu-bar-title-4') || launch; candidate.focus();
    }
    listen(launch, 'click', () => { opened ? shut() : open(); }); listen(close, 'click', shut);
    listen(centre, 'click', () => setOrigin(mapCentre())); listen(fit, 'click', fitRadius);
    listen(pick, 'click', () => { picking = !picking; pick.setAttribute('aria-pressed', String(picking)); pick.textContent = picking ? 'Tap a point on the map' : 'Pick origin on map'; });
    listen(slider, 'input', () => { try { radius = radiusKm(slider.value); showError(null); refresh(); } catch (e) { showError(e.message); } });
    listen(undo, 'click', () => { itinerary.pop(); updateModel(); draw(); }); listen(clear, 'click', () => { itinerary.length = 0; updateModel(); draw(); });
    listen(panel, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); shut(); } });
    for (const type of ['click','dblclick','pointerdown','touchstart']) listen(panel, type, event => event.stopPropagation());
    const clicked = event => { if (opened && picking && event.lngLat) setOrigin({at: [event.lngLat.lng,event.lngLat.lat], name: 'Chosen map point', type: 'map-point', id: null}); };
    const sourced = event => { if (opened && (!event || event.sourceId === 'src-subs')) { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 100); } };
    const styled = () => { if (!map.getSource(SOURCE)) source = null; if (opened) refresh(); };
    const removed = () => destroy(true);
    map.on('click', clicked); map.on('sourcedata', sourced); map.on('style.load', styled); map.on('remove', removed);
    const onIntent = event => open(event.detail || {}); listen(W, 'gridatlas:vicinity-open', onIntent);
    const onCard = event => { if (event.detail?.origin && opened) setOrigin(event.detail.origin); }; listen(W, 'gridatlas:card-open', onCard);
    const observer = new MutationObserver(installControls); observer.observe(D.documentElement, {childList: true, subtree: true}); installControls();
    function destroy(mapRemoved = false) {
      if (!alive) return; alive = false; clearTimeout(refreshTimer); observer.disconnect(); listeners.forEach(off => off());
      map.off('click', clicked); map.off('sourcedata', sourced); map.off('style.load', styled); map.off('remove', removed); removeMap(mapRemoved);
      groups.forEach(g => g.remove()); root.remove();
    }
    return Object.freeze({open, close: shut, setOrigin, refresh, destroy, snapshot: () => ({alive, opened, generation: VICINITY_GENERATION, radiusKm: radius,
      origin: origin ? {...origin,at: origin.at.slice()} : null, matching: result?.matching ?? null, shown: result?.shown.length ?? 0, loadedRecords: records.length,
      selectedBands: [...bands], contextSource, sourceUnavailable, modelStations: itinerary.map(row => ({name: row.name, id: row.id, at: row.at.slice()})),
      modelEvidence: 'USER_ASSUMED_LOCAL_MODEL', realConnectionsInferred: 0, error, selectionEpoch})});
  }
  function mount(map = W.__GRIDATLAS_V9_MAP__) {
    if (controller?.snapshot().alive) return controller;
    if (!map?.getContainer) return null;
    controller = createController(map); return controller;
  }
  let tries = 0;
  function attach() {
    if (stopped) return;
    try {
      if (mount()) {
        if (pendingIntent) { controller.open(pendingIntent); pendingIntent = null; }
        else if (intentError) { controller.open({error: 'Journey link refused: ' + intentError}); intentError = null; }
        return;
      }
    } catch (e) { console.warn('[Vicinity]', e.message); }
    if (++tries < 240) timer = setTimeout(attach, 250);
  }
  NS.gridVicinity = Object.freeze({schema: 'gridatlas.vicinity.v1', generation: VICINITY_GENERATION, mount,
    open(options) { return mount()?.open(options); }, setOrigin(origin) { return mount()?.setOrigin(origin); },
    snapshot: () => controller?.snapshot() || {alive: false, opened: false, status: 'map-unavailable'},
    destroy() { stopped = true; clearTimeout(timer); controller?.destroy(); controller = null; }});
  attach();
}
