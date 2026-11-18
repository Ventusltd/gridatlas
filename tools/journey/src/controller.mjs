/** Native MapLibre presentation only. The pinned engine owns evidence and traversal. */
export function createJourneyController({map, document: D, window: W, planner, fixture, css, generation}) {
  const NS = 'gridatlas-gj03', source = NS + '-route', cursor = NS + '-cursor';
  const layerIds = [NS + '-verified', NS + '-schematic', NS + '-cursor'];
  const empty = () => ({type: 'FeatureCollection', features: []});
  const caveat = 'The travelling light is a learning cursor, not measured current or a power-flow simulation. Dotted links are schematic, not cable routes. Flow direction unavailable.';
  const layerGroups = [], layerLaunchers = [];
  let layerObserver = null, returnFocus = null, originContext = null;
  const on = [], ownedSources = new Map(), ownedLayers = new Map();
  let alive = true, opened = false, plan = null, step = 0, raf = null, playing = false, epoch = 0, demo = false, routeData = empty(), cursorData = empty();
  if (!map || !['addSource', 'addLayer', 'getSource', 'getLayer', 'removeSource', 'removeLayer', 'on', 'off'].every(k => typeof map[k] === 'function')) throw new Error('Native MapLibre map unavailable');
  if (D.getElementById(NS)) throw new Error('Journey already mounted');
  const container = D.getElementById('map-container') || map.getContainer?.();
  const initialPadding = map.getPadding?.();
  if (!container) throw new Error('Native map container unavailable');
  function el(tag, text, parent, attrs = {}) { const e = D.createElement(tag); if (text) e.textContent = text; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; }
  function listen(e, type, fn) { e.addEventListener(type, fn); on.push(() => e.removeEventListener(type, fn)); }
  const root = el('div', null, container, {id: NS, 'data-generation': generation});
  const style = el('style', css, root);
  const opener = el('button', 'Grid Journeys', root, {type: 'button', 'aria-expanded': 'false', 'aria-controls': NS + '-panel', class: 'gj-launch'});
  const panel = el('section', null, root, {id: NS + '-panel', 'aria-label': 'Grid Journeys', hidden: '', class: 'gj-panel'});
  const heading = el('div', null, panel, {class: 'gj-heading'});
  el('strong', 'GRID JOURNEYS', heading);
  const close = el('button', 'Close', heading, {type: 'button', 'aria-label': 'Close Grid Journey'});
  const caption = el('p', caveat, panel, {class: 'gj-caveat'});
  const state = el('p', 'Explore the physical grid on the map, or choose a learning demonstration below.', panel, {role: 'status', 'aria-live': 'polite', class: 'gj-status'});
  const context = el('p', 'Select an asset on the map to explore its surroundings.', panel, {class: 'gj-origin'});
  const realGrid = el('button', 'Explore real grid nearby', panel, {type: 'button'});
  const demoButton = el('button', 'Load SYNTHETIC demonstration', panel, {type: 'button'});
  const label = el('label', 'Explicit starting node ', panel, {class: 'gj-node'});
  const select = el('select', null, label, {'aria-label': 'Explicit starting node', disabled: ''});
  el('option', 'Choose a reviewed node…', select, {value: ''});
  const controls = el('div', null, panel, {class: 'gj-controls'});
  const start = el('button', 'Start', controls, {type: 'button', disabled: ''});
  const pause = el('button', 'Pause', controls, {type: 'button', disabled: ''});
  const next = el('button', 'Next', controls, {type: 'button', disabled: ''});
  const reset = el('button', 'Reset', controls, {type: 'button', disabled: ''});
  const evidence = el('details', null, panel, {class: 'gj-evidence'});
  el('summary', 'Input evidence and limits', evidence);
  evidence.appendChild(caption);
  const receipt = el('pre', 'Real routes: 0 accepted. No measured or modelled MW inputs. Synthetic data loads only on explicit request.', evidence);
  const media = W.matchMedia?.('(prefers-reduced-motion: reduce)');
  function isReduced() { return media?.matches === true; }
  function report(s) { if (alive) state.textContent = s; }
  function pauseMotion() { playing = false; if (raf !== null) W.cancelAnimationFrame(raf); raf = null; pause.disabled = true; start.disabled = !plan?.steps.length || step >= plan.steps.length; }
  function controlsState() { const usable = !!plan?.steps.length; start.disabled = !usable || step >= plan.steps.length || playing; next.disabled = !usable || playing || step >= plan.steps.length; reset.disabled = !plan; pause.disabled = !playing; start.textContent = isReduced() ? 'Start · manual' : 'Start'; }
  function removeMap() {
    for (const [id, object] of [...ownedLayers].reverse()) { if (map.getLayer(id) === object) map.removeLayer(id); ownedLayers.delete(id); }
    for (const [id, object] of ownedSources) { if (map.getSource(id) === object) map.removeSource(id); } ownedSources.clear();
  }
  function installMap() {
    if (!alive || !opened || !plan) return false;
    // isStyleLoaded also waits on map resources; a loaded stylesheet can accept sources earlier.
    if (typeof map.getStyle === 'function' && !map.getStyle()) return true;
    try {
      for (const id of [source, cursor]) if (map.getSource(id) && ownedSources.get(id) !== map.getSource(id)) throw new Error('Journey source collision; existing map source preserved');
      for (const id of layerIds) if (map.getLayer(id) && ownedLayers.get(id) !== map.getLayer(id)) throw new Error('Journey layer collision; existing map layer preserved');
      for (const [id, data] of [[source, routeData], [cursor, cursorData]]) { if (!map.getSource(id)) { map.addSource(id, {type: 'geojson', data}); ownedSources.set(id, map.getSource(id)); } else map.getSource(id).setData(data); }
      const layers = [
        {id: layerIds[0], type: 'line', source, filter: ['==', ['get', 'schematic'], false], paint: {'line-color': '#00ffff', 'line-width': 3}},
        {id: layerIds[1], type: 'line', source, filter: ['==', ['get', 'schematic'], true], paint: {'line-color': '#ffd84d', 'line-width': 3, 'line-dasharray': [1, 3]}},
        {id: layerIds[2], type: 'circle', source: cursor, paint: {'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': '#00ffff', 'circle-stroke-width': 3}}
      ];
      for (const l of layers) if (!map.getLayer(l.id)) { map.addLayer(l); ownedLayers.set(l.id, map.getLayer(l.id)); }
      return true;
    } catch (e) { pauseMotion(); report('WITHHELD: ' + e.message); removeMap(); plan = null; controlsState(); return false; }
  }
  function writeCursor(coordinates) {
    cursorData = {type: 'FeatureCollection', features: coordinates ? [{type: 'Feature', properties: {meaning: 'learning cursor only'}, geometry: {type: 'Point', coordinates}}] : []};
    if (ownedSources.has(cursor) && ownedSources.get(cursor) === map.getSource(cursor)) map.getSource(cursor).setData(cursorData);
  }
  function lineFor(s) { const e = plan.edgeCatalog.find(e => e.edgeUid === s.edgeUid); if (!e?.coordinates) return null; const coords = e.coordinates.map(p => [...p]); if (s.direction === 'reverse') coords.reverse(); return {e, coords}; }
  function frameRoute() {
    if (!alive || !opened || !plan) return;
    const pts = plan.edgeCatalog.flatMap(e => e.coordinates || []);
    const r = map.getContainer?.().getBoundingClientRect?.(), q = panel.getBoundingClientRect?.();
    let padding = 65;
    if (r && q) { const top = Math.max(45, q.bottom - r.top + 12); padding = q.width > r.width * .6 && r.height - top > 130 ? {left: 35, right: 35, top, bottom: 50} : {left: 45, right: Math.min(r.width * .6, q.width + 25), top: 55, bottom: 55}; }
    if (pts.length && map.fitBounds) { map.setPadding?.({top: 0, right: 0, bottom: 0, left: 0}); map.fitBounds([[Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1]))], [Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]], {padding, maxZoom: 9, duration: 0}); }
  }
  function showStep(index) {
    const s = plan.steps[index], line = lineFor(s);
    writeCursor(line?.coords.at(-1) || null);
    report(`SYNTHETIC ONLY · ${index + 1}/${plan.steps.length} · ${s.traversal} ${s.nearNode} → ${s.farNode} · ${s.geometryStatus === 'published_node_unlocated' ? 'UNLOCATED: text only' : line?.e.schematic ? 'DOTTED SCHEMATIC: not a cable route' : 'synthetic reviewed polyline'} · journey heading, flow direction unavailable`);
    step = index + 1; controlsState();
  }
  function advance() { pauseMotion(); if (plan && step < plan.steps.length) showStep(step); }
  function resetPlan() { pauseMotion(); step = 0; writeCursor(null); if (plan) report(`SYNTHETIC ONLY · ready · ${plan.visitedUniqueEdges} source-row edges; ${plan.steps.length} moves including explicit backtracking; physical units unknown`); controlsState(); }
  function animate() {
    if (!alive || !opened || !plan || step >= plan.steps.length) { pauseMotion(); controlsState(); return; }
    if (isReduced()) { pauseMotion(); controlsState(); return; }
    const index = step, s = plan.steps[index], line = lineFor(s); let began;
    function frame(now) {
      if (!alive || !opened || !playing) return;
      if (isReduced()) { pauseMotion(); controlsState(); return; }
      began ??= now; const t = Math.min(1, (now - began) / 1000);
      // Only a reviewed polyline gets a travelling light. Schematic/unlocated moves are discrete.
      if (line && !line.e.schematic) {
        const p = t * (line.coords.length - 1), i = Math.min(line.coords.length - 2, Math.floor(p)), f = p - i;
        writeCursor(line.coords[i].map((v, k) => v + (line.coords[i + 1][k] - v) * f));
      }
      if (t < 1) raf = W.requestAnimationFrame(frame);
      else { showStep(index); if (playing) animate(); }
    }
    raf = W.requestAnimationFrame(frame);
  }
  async function choose() {
    const ticket = ++epoch; pauseMotion(); plan = null; routeData = empty(); cursorData = empty(); removeMap(); controlsState();
    if (!select.value || !demo) { report('Choose an explicit reviewed synthetic node. No nearest-node or project connection is inferred.'); return; }
    report('Checking exact source bytes and review ledger…');
    try {
      const candidate = await planner({sourceBytes: fixture.networkText, ledger: fixture.ledger, query: {seed: {chosenNode: select.value}, bounds: {maxNodes: 25, maxEdges: 30, maxMoves: 60, maxGeometryBytes: 16000}}});
      if (!alive || ticket !== epoch || !opened) return;
      if (candidate.status === 'refused' || !candidate.steps.length) { report('WITHHELD: ' + (candidate.refusal || 'no eligible reviewed edges')); return; }
      // The engine classifies evidence. Presentation refuses unsupported output as well.
      if (candidate.edgeCatalog.some(e => !['verified_circuit_and_polyline', 'published_topology_only', 'published_node_unlocated'].includes(e.geometryStatus))) throw new Error('Unsupported geometry evidence');
      plan = candidate;
      routeData = {type: 'FeatureCollection', features: plan.edgeCatalog.filter(e => e.coordinates).map(e => ({type: 'Feature', properties: {edgeUid: e.edgeUid, schematic: e.schematic, meaning: e.label}, geometry: {type: 'LineString', coordinates: e.coordinates}}))};
      receipt.textContent = `SYNTHETIC TEST ONLY; no real assets or third-party approval\nsource SHA256 ${plan.sourceBundleSha}\nreview SHA256 ${plan.reviewLedgerSha}\nplan SHA256 ${plan.planSha256}\n${plan.edgeCatalog.filter(e => e.geometryStatus === 'verified_circuit_and_polyline').length} synthetic polylines; ${plan.edgeCatalog.filter(e => e.schematic).length} schematic; ${plan.edgeCatalog.filter(e => !e.coordinates).length} text-only\nEligible source rows ${plan.visitedUniqueEdges}/${plan.eligibleReachableEdges} in chosen component; excludes disconnected/withheld rows. Physical units and MW unknown.\nBounds: 25 nodes / 30 edges / 60 moves / 16000 geometry bytes.\nSource and receipts: https://fixture.invalid/ — synthetic, not an official source.`;
      if (!installMap()) return;
      resetPlan();
      frameRoute();
    } catch (e) { if (alive && ticket === epoch) report('WITHHELD: ' + e.message); }
  }
  function installLayerControls() {
    const hosts = ['scada-ui-container', 'fs-curtain-keys'].map(id => [id, D.getElementById(id)]);
    hosts.push(['native-grid-menu', D.querySelector?.('#gridatlas-menu-bar-panel-4 .gm-panel-body')]);
    for (const [id, host] of hosts) {
      if (!host || layerGroups.some(g => g.parentNode === host || g.parent === host)) continue;
      const group = el('div', null, host, {class: 'key-group', 'data-journey-group': id});
      const title = el('div', 'Grid Journeys', group, {class: 'key-title'});
      const button = el('button', 'Open Grid Journey', group, {type: 'button', class: 'map-ctrl-btn', 'aria-controls': NS + '-panel', 'aria-expanded': String(opened)});
      button.style.cssText = 'min-height:44px;min-width:44px;';
      el('p', 'Exploratory only; real routes require reviewed circuit evidence.', group);
      listen(button, 'click', e => { e.stopPropagation?.(); returnFocus = button; const curtain = D.getElementById('fs-curtain'); if (id === 'fs-curtain-keys' && curtain?.classList?.contains('curtain-open')) D.getElementById('fs-curtain-tab')?.click(); open(); });
      layerGroups.push(group); layerLaunchers.push(button);
    }
  }
  function setOrigin(origin) {
    originContext = null;
    if (origin && typeof origin === 'object') {
      const name = typeof origin.name === 'string' ? origin.name.slice(0, 160) : '';
      const id = typeof origin.id === 'string' || typeof origin.id === 'number' ? String(origin.id).slice(0, 80) : '';
      if (name || id) { originContext = {name, id}; if (Array.isArray(origin.at) && origin.at.length === 2 && origin.at.every(Number.isFinite) && Math.abs(origin.at[0]) <= 180 && Math.abs(origin.at[1]) <= 90 && (origin.at[0] !== 0 || origin.at[1] !== 0)) originContext.at = [...origin.at]; if (['repd', 'datacentre', 'substation'].includes(origin.type)) originContext.type = origin.type; }
    }
    context.textContent = originContext ? 'Selected asset: ' + [originContext.name, originContext.id].filter(Boolean).join(' ? ') + '. Nearby assets are map context; connections need source evidence.' : 'Select an asset on the map to explore its surroundings.';
    realSelection(false);
  }
  function shut() { ++epoch; pauseMotion(); opened = false; panel.hidden = true; opener.setAttribute('aria-expanded', 'false'); removeMap(); if (initialPadding) map.setPadding(initialPadding); for (const b of layerLaunchers) b.setAttribute('aria-expanded', 'false'); (returnFocus?.isConnected === false ? opener : returnFocus || opener).focus(); }
  function open(options) { if (!alive) return; if (options?.origin) setOrigin(options.origin); opened = true; panel.hidden = false; opener.setAttribute('aria-expanded', 'true'); for (const b of layerLaunchers) b.setAttribute('aria-expanded', 'true'); installMap(); frameRoute(); close.focus(); }
  function realSelection(clearContext = true) { if (clearContext) { originContext = null; context.textContent = 'Selected asset has no reviewed circuit identity. Real circuit journeys remain withheld.'; } ++epoch; pauseMotion(); plan = null; demo = false; select.value = ''; select.disabled = true; removeMap(); controlsState(); report('Explore this asset and the surrounding grid. Nearby assets do not establish a connection.'); }
  listen(opener, 'click', () => {returnFocus = opener; opened ? shut() : open();}); listen(close, 'click', shut);
  listen(panel, 'keydown', e => { if (e.key === 'Escape') { e.preventDefault(); shut(); } });
  listen(demoButton, 'click', () => { ++epoch; pauseMotion(); plan = null; removeMap(); demo = true; select.disabled = false; select.replaceChildren(); el('option', 'Choose a reviewed synthetic node…', select, {value: ''}); for (const n of fixture.ledger.nodes) el('option', 'SYNTHETIC ' + n.nodeId, select, {value: n.nodeId}); report('SYNTHETIC DEMONSTRATION LOADED. These are invented assets; choose a starting node explicitly.'); controlsState(); });
  listen(realGrid, 'click', () => {
    const vicinity = W.__GRIDATLAS_MODULES__?.gridVicinity;
    if (!vicinity?.open) {
      const grid = D.getElementById('gridatlas-menu-bar-title-4');
      if (!grid?.click) {
        const layers = D.getElementById('scada-ui-container');
        if (!layers?.scrollIntoView) { report('Grid layers are loading. Try Explore grid again when the map controls appear.'); return; }
        if (originContext?.at) map.flyTo?.({center: [...originContext.at], duration: 0});
        shut(); layers.scrollIntoView({block: 'start', behavior: 'instant'});
        layers.querySelector?.('input[data-layer-id]')?.focus();
        return;
      }
      if (originContext?.at) map.flyTo?.({center: [...originContext.at], duration: 0});
      shut();
      if (grid.getAttribute?.('aria-expanded') !== 'true') grid.click();
      grid.focus();
      return;
    }
    pauseMotion(); vicinity.open({origin: originContext?.at ? {...originContext, at: [...originContext.at]} : undefined, radiusKm: 10}); shut();
  });
  listen(select, 'change', choose); listen(next, 'click', advance); listen(reset, 'click', resetPlan);
  listen(start, 'click', () => { if (!plan) return; if (isReduced()) { advance(); return; } playing = true; controlsState(); animate(); });
  listen(pause, 'click', () => { pauseMotion(); controlsState(); });
  listen(W, 'gridatlas:card-open', e => { if (e.detail?.origin) setOrigin(e.detail.origin); else realSelection(); });
  listen(W, 'gridatlas:journey-open', e => open(e.detail));
  installLayerControls();
  if (W.MutationObserver && D.documentElement) { layerObserver = new W.MutationObserver(installLayerControls); layerObserver.observe(D.documentElement, {childList: true, subtree: true}); }
  const styleLoad = () => { pauseMotion(); installMap(); controlsState(); }; map.on('style.load', styleLoad);
  map.on('resize', frameRoute);
  const preferenceChange = () => { if (isReduced()) pauseMotion(); controlsState(); };
  if (media?.addEventListener) { media.addEventListener('change', preferenceChange); on.push(() => media.removeEventListener('change', preferenceChange)); }
  function mapRemoved() { destroy(true); }
  function destroy(mapWasRemoved = false) {
    if (!alive) return; alive = false; ++epoch; pauseMotion();
    try {
      map.off('style.load', styleLoad); map.off('resize', frameRoute); map.off('remove', mapRemoved); for (const off of on.splice(0)) off();
      // MapLibre fires remove AFTER destroying its style. Its layers/sources have already gone.
      if (mapWasRemoved) { ownedLayers.clear(); ownedSources.clear(); } else { removeMap(); if (initialPadding) map.setPadding(initialPadding); }
    } finally { layerObserver?.disconnect(); for (const group of layerGroups) group.remove(); root.remove(); }
  }
  map.on('remove', mapRemoved);
  controlsState();
  return Object.freeze({open, setOrigin, close: shut, snapshot: () => ({alive, opened, playing, step, status: plan?.status || 'withheld', synthetic: demo, origin: originContext ? {...originContext} : null, layerControls: layerGroups.length, steps: plan?.steps.length || 0, edgeCount: plan?.edgeCatalog.length || 0}), destroy});
}
