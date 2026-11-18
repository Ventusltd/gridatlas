/** Native MapLibre learning cursor. Travel direction is never electrical flow. */
export function createTrainRide({map, geodesy, palette = {}, onState = () => {}, reducedMotion = false, readPlanEpoch = null,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
  setTimer = globalThis.setTimeout?.bind(globalThis), clearTimer = globalThis.clearTimeout?.bind(globalThis)} = {}) {
  if (!map || typeof geodesy?.distanceKm !== 'function') throw Error('Map and canonical geodesy required.');
  const prefix = 'gridatlas-train-', sources = new Map(), layers = new Map();
  const colour = palette.SUBSTATION_COLOUR || palette.substation || '#5fbdc2'; // Existing SLD substation colour.
  const flowColour = palette.FLOW_COLOUR || '#bfe9ee';
  const customerColour = palette.CUSTOMER_SUBSTATION_COLOUR || '#e0b050'; // Existing SLD_COLOUR.node customer_substation glyph.
  // Same 24 cached dash patterns as the existing SLD neon renderer; no atlas growth per frame.
  const flowPatterns = Array.from({length: 24}, (_, i) => Object.freeze([0.001,
    Math.max(0.001, i / 24 * 1.5), 0.42, Math.max(0.001, 1.5 - i / 24 * 1.5)]));
  let lastDashIndex = -1;
  let alive = true, plan = null, pinStops = [], playing = false, handle = null, legIndex = 0, fraction = 0, epoch = 0, measures = [], prefixStop = 0;
  let lastTime = null, lastPaint = -Infinity, cameraFollow = false, durationMs = 2400, unavailable = null;
  let retryHandle = null, retryCount = 0;
  const state = () => ({schema: 'gridatlas.train.motion.v1', alive, playing, legIndex, fraction,
    stopIndex: fraction === 1 ? legIndex + 1 : legIndex, reducedMotion: !!reducedMotion,
    cameraFollow, unavailable, approvedThroughStop: prefixStop, evidence: plan?.legs[legIndex]?.evidence || null,
    electricalFlow: 'UNKNOWN', simulated: !!plan?.simulated, stops: plan?.stops.length || pinStops.length});
  const notify = () => onState(state());
  const collection = features => ({type: 'FeatureCollection', features});
  const point = (at, properties = {}) => ({type: 'Feature', properties, geometry: {type: 'Point', coordinates: at}});
  function cancel() { epoch++; if (handle !== null) cancelFrame?.(handle); handle = null; lastTime = null; }
  function schedule() { const token = epoch; handle = requestFrame(time => { if (token === epoch) tick(time); }); }
  function pause() { playing = false; cancel(); notify(); return state(); }
  function cancelRetry() { if(retryHandle!==null)clearTimer?.(retryHandle);retryHandle=null;retryCount=0; }
  function waitForStyle() {
    unavailable = retryCount < 12 ? 'Map style is loading; drawing will retry briefly.' : 'Map style is not ready. Retry Draw when the map is ready.';
    if(retryHandle===null && retryCount<12 && typeof setTimer==='function') {
      retryCount++;retryHandle=setTimer(()=>{retryHandle=null;if(alive)paint();},250);
    }
    notify();return false;
  }
  function ensure() {
    if (!alive || !plan && !pinStops.length) return false;
    const sourceIds = ['routes', 'stops', 'cursor'].map(id => prefix + id);
    const layerIds = ['route-gis', 'route-topology', 'route-simulated', 'flow', 'stops', 'proposals', 'cursor'].map(id => prefix + id);
    for (const id of sourceIds) {
      const existing = map.getSource(id);
      if (existing && existing !== sources.get(id)) { unavailable = 'Source ID belongs to another module'; pause(); return false; }
    }
    for (const id of layerIds) {
      const existing = map.getLayer(id);
      if (existing && existing !== layers.get(id)) { unavailable = 'Layer ID belongs to another module'; pause(); return false; }
    }
    // Existing verified sources remain writable while their own setData is
    // pending. Global isStyleLoaded also includes that work; it is not a
    // readiness test for an owned source or for each animation frame.
    if(sourceIds.some(id=>!map.getSource(id)) && map.isStyleLoaded?.()===false) return waitForStyle();
    for (const id of sourceIds) if (!map.getSource(id)) {
      map.addSource(id, {type: 'geojson', data: collection([])}); sources.set(id, map.getSource(id));
    }
    const add = spec => { if (!map.getLayer(spec.id)) { map.addLayer(spec); layers.set(spec.id, map.getLayer(spec.id)); if (spec.id === prefix + 'flow') lastDashIndex = -1; } };
    const line = {type: 'line', source: prefix + 'routes', layout: {'line-cap': 'round', 'line-join': 'round'}};
    add({...line, id: prefix + 'route-gis', filter: ['==', ['get', 'evidence'], 'GIS_REVIEWED'],
      paint: {'line-color': colour, 'line-width': 1.8, 'line-opacity': 0.8}});
    add({...line, id: prefix + 'route-topology', filter: ['==', ['get', 'evidence'], 'TOPOLOGY_ONLY'],
      paint: {'line-color': colour, 'line-width': 1.4, 'line-opacity': 0.65, 'line-dasharray': [5, 2]}});
    add({...line, id: prefix + 'route-simulated', filter: ['==', ['get', 'evidence'], 'SIMULATED'],
      paint: {'line-color': colour, 'line-width': 1.4, 'line-opacity': 0.65, 'line-dasharray': [1, 3]}});
    // Existing l-neon-flow rhythm, confined to our own overlay.
    add({...line, id: prefix + 'flow',filter:['==',['get','evidence'],'GIS_REVIEWED'], paint: {'line-color': flowColour, 'line-width': 1.2,
      'line-opacity': reducedMotion ? 0 : 0.45, 'line-dasharray': [0.2, 3.2]}});
    add({id: prefix + 'stops', type: 'circle', source: prefix + 'stops', filter:['!=',['get','proposed'],true],paint: {
      'circle-color': colour, 'circle-radius': 3, 'circle-opacity': 0.8}});
    add({id:prefix+'proposals',type:'circle',source:prefix+'stops',filter:['==',['get','proposed'],true],paint:{
      'circle-color':customerColour,'circle-radius':5,'circle-stroke-color':'#000c10','circle-stroke-width':1.5,'circle-opacity':0.9}});
    add({id: prefix + 'cursor', type: 'circle', source: prefix + 'cursor', paint: {
      'circle-color': colour, 'circle-radius': 5, 'circle-stroke-color': '#000c10', 'circle-stroke-width': 1.5}});
    cancelRetry();unavailable = null; return true;
  }
  function position() {
    const line = plan?.legs[legIndex]?.coordinates;
    if (!line) return plan?.stops[legIndex]?.at || null;
    if (fraction === 1) return line.at(-1);
    const cumulative = measures[legIndex], wanted = cumulative.at(-1) * fraction;
    let lo = 1, hi = cumulative.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < wanted) lo = mid + 1; else hi = mid; }
    const i = lo - 1, span = cumulative[lo] - cumulative[i], t = span ? (wanted - cumulative[i]) / span : 0;
    return [line[i][0] + (line[lo][0] - line[i][0]) * t, line[i][1] + (line[lo][1] - line[i][1]) * t];
  }
  function paint() {
    if(plan && readPlanEpoch && readPlanEpoch()!==plan.planEpoch){clearPlan();return;}
    if (!ensure()) return;
    sources.get(prefix + 'routes').setData(collection((plan?.legs||[]).slice(0,prefixStop).filter(l => l.coordinates).map(l => ({type: 'Feature',
      properties: {evidence: l.evidence, label: l.label}, geometry: {type: 'LineString', coordinates: l.coordinates}}))));
    sources.get(prefix + 'stops').setData(stopData(plan?.stops||pinStops));
    paintCursor();
  }
  function paintCursor() {
    if (!alive || !plan || !sources.has(prefix + 'cursor') || map.getSource(prefix + 'cursor') !== sources.get(prefix + 'cursor')) return;
    const at = position(); sources.get(prefix + 'cursor').setData(collection(at ? [point(at, {meaning: 'User journey heading; electrical flow unknown'})] : []));
    if (cameraFollow && playing && at) map.easeTo?.({center: at, duration: 0});
  }
  function tick(time) {
    handle = null; if (!alive || !playing) return;
    if (readPlanEpoch && readPlanEpoch() !== plan.planEpoch) { clearPlan(); return; }
    if(!sources.has(prefix+'cursor') || map.getSource(prefix+'cursor')!==sources.get(prefix+'cursor')) {pause();return;}
    if (lastTime === null) lastTime = time;
    fraction += Math.max(0, Math.min(250, time - lastTime)) / durationMs; lastTime = time;
    if (fraction >= 1) {
      if (legIndex < plan.legs.length - 1) { legIndex++; fraction = 0; } else { fraction = 1; playing = false; }
    }
    if (time - lastPaint >= 33 || !playing) {
      lastPaint = time; paintCursor();
      const layer = map.getLayer(prefix + 'cursor');
      if (layer === layers.get(prefix + 'cursor')) map.setPaintProperty(prefix + 'cursor', 'circle-radius', 5 + Math.sin(fraction * Math.PI) * 1.5);
      const dashIndex = Math.floor(fraction * 24) % 24;
      if (dashIndex !== lastDashIndex && map.getLayer(prefix + 'flow') === layers.get(prefix + 'flow')) {
        lastDashIndex = dashIndex; map.setPaintProperty(prefix + 'flow', 'line-dasharray', flowPatterns[dashIndex]);
      }
      notify();
    }
    if (playing) schedule();
  }
  function setPlan(next) {
    if (!alive) throw Error('Train ride is destroyed.');
    // Reject stale asynchronous results before clearing or painting any current ride.
    if(readPlanEpoch && next?.planEpoch!==readPlanEpoch())throw Error('Stale journey plan epoch.');
    clearPlan({stops:pinStops});
    if (next?.schema !== 'gridatlas.train.route-plan.v1' || !Array.isArray(next.legs) || !next.legs.length
      || !Array.isArray(next.stops) || next.stops.length !== next.legs.length + 1
      || next.legs.reduce((n, leg) => n + (leg.coordinates?.length || 0), 0) > 20000) throw Error('Invalid or oversized journey plan.');
    // Snapshot input so later UI edits cannot mutate an active ride.
    const copy = JSON.parse(JSON.stringify(next)); plan = copy; pinStops = copy.stops;
    const gap = plan.legs.findIndex(leg => !leg.coordinates || leg.evidence === 'MISSING');
    prefixStop = gap < 0 ? plan.legs.length : gap;
    measures = plan.legs.map(leg => { const cumulative = [0];
      for (let i = 1; i < (leg.coordinates?.length || 0); i++) cumulative.push(cumulative.at(-1) + geodesy.distanceKm(...leg.coordinates[i - 1], ...leg.coordinates[i]));
      return cumulative; });
    legIndex = 0; fraction = 0; paint(); notify(); return state();
  }
  function play(options = {}) {
    if (readPlanEpoch && plan && readPlanEpoch() !== plan.planEpoch) { clearPlan(); return false; }
    if (!alive || !plan?.playable || prefixStop !== plan.legs.length || unavailable) return false;
    cameraFollow = options.cameraFollow === true;
    if (Number.isFinite(options.durationMs)) durationMs = Math.max(500, Math.min(30000, options.durationMs));
    if (reducedMotion) { step(); return false; }
    if (typeof requestFrame !== 'function') return false;
    if (playing) return true;
    if (legIndex === plan.legs.length - 1 && fraction === 1) { legIndex = 0; fraction = 0; }
    playing = true; lastTime = null; schedule(); notify(); return true;
  }
  function seekStop(index) {
    if (readPlanEpoch && plan && readPlanEpoch() !== plan.planEpoch) { clearPlan(); return false; }
    if (!alive || !plan || !Number.isInteger(index) || index < 0 || index > prefixStop || index >= plan.stops.length) return false;
    pause(); legIndex = index === prefixStop && index > 0 ? index - 1 : index;
    fraction = index === prefixStop && index > 0 ? 1 : 0;
    paintCursor(); notify(); return true;
  }
  function step() { const next = state().stopIndex + 1; return next <= prefixStop && seekStop(next); }
  function stopData(stops) { return collection(stops.map((stop,i)=>point(stop.at,{stationId:stop.id||stop.stationId,stopIndex:i,
    proposed:stop.proposed===true,kind:stop.proposed?'customer_substation':'source_substation',label:stop.proposed?'PROPOSED SESSION ONLY':stop.name||''}))); }
  function clearPlan({stops=[]}={}) {
    if (!alive) return false;
    if (!Array.isArray(stops) || stops.length>90 || stops.some(stop=>!Array.isArray(stop.at)||stop.at.length!==2
      ||!stop.at.every(Number.isFinite)||Math.abs(stop.at[0])>180||Math.abs(stop.at[1])>90)) throw Error('Invalid selected station pins.');
    cameraFollow=false;cancelRetry();pause();plan=null;measures=[];prefixStop=0;legIndex=0;fraction=0;
    pinStops=JSON.parse(JSON.stringify(stops.filter(stop=>!stop.invalid)));
    if(ensure()) for(const [suffix,data]of [['routes',collection([])],['cursor',collection([])],['stops',stopData(pinStops)]]) {
      const id=prefix+suffix;if(map.getSource(id)===sources.get(id))sources.get(id).setData(data);
    }
    // Empty selections still clear existing owned layers/sources without adding any.
    if(!pinStops.length)for(const suffix of ['routes','cursor','stops']){const id=prefix+suffix;
      if(sources.has(id)&&map.getSource(id)===sources.get(id))sources.get(id).setData(collection([]));}
    notify();return true;
  }
  function styleReload() { if (!alive) return; cancelRetry();pause(); paint(); }
  function removed() { if (!alive) return; alive = false; playing = false; cancelRetry();cancel(); sources.clear(); layers.clear(); map.off('style.load', styleReload); notify(); }
  function destroy() {
    if (!alive) return; cancelRetry();pause();
    for (const [id, layer] of [...layers].reverse()) if (map.getLayer(id) === layer) map.removeLayer(id);
    for (const [id, source] of sources) if (map.getSource(id) === source) map.removeSource(id);
    sources.clear(); layers.clear(); alive = false;
    map.off('style.load', styleReload); map.off('remove', removed); notify();
  }
  map.on('style.load', styleReload); map.on('remove', removed);
  return Object.freeze({setPlan, clearPlan, play, pause, step, seekStop, destroy, snapshot: state});
}
