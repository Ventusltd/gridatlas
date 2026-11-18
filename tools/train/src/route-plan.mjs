/** Ordered user itinerary; proximity never establishes electrical connectivity. */
export function buildRoutePlan({stops, stationIndex = null, scenarioStore = null, planEpoch = null, synthetic = false, geodesy, allowSimulated = false, network = null, rules = {}, law = null} = {}) {
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 90) throw Error('Choose 2–90 station stops.');
  if (typeof geodesy?.distanceKm !== 'function') throw Error('Canonical geodesy is required.');
  const ids = new Set();
  const selected = stops.map(stop => {
    const id = stop.stationId || stop.id;
    if (typeof id !== 'string' || !id) throw Error('Each stop needs a stable station identity.');
    if (stop.id != null && stop.id !== id) throw Error('Conflicting station identity.');
    const canonical = stationIndex?.get(id);
    const proposed = !canonical && law?.fallback === 'user-opted-hypothetical' ? scenarioStore?.get(id) : null;
    if (proposed && (proposed.proposed !== true || proposed.source !== 'SESSION_ONLY_USER_PROPOSED'
      || !id.startsWith('scenario:') || proposed.kv.length !== 1 || ![11,33].includes(proposed.kv[0]))) throw Error('Invalid session-owned proposal.');
    const owned = canonical || proposed;
    if (stop.invalid || !synthetic && (!owned || !same(owned.at, stop.at))) throw Error('Choose an existing canonical station from the station index or an opted-in current session proposal.');
    if (synthetic && !String(stop.source).startsWith('SYNTHETIC')) throw Error('Fictional stops need an explicit synthetic source.');
    const stopId = stop.stopId || 'visit-' + ids.size;
    if (ids.has(stopId)) throw Error('Each visit needs a distinct stop identity.');
    ids.add(stopId);
    if (!Array.isArray(stop.at) || stop.at.length !== 2 || !stop.at.every(Number.isFinite)
      || Math.abs(stop.at[0]) > 180 || Math.abs(stop.at[1]) > 90) throw Error('A station stop is unlocated.');
    const trusted = owned || stop;
    const kv = (Array.isArray(trusted.kv) ? trusted.kv : [trusted.kv]).filter(kv => Number.isFinite(kv) && kv > 0);
    if (stop.selectedVoltageKv != null && !kv.includes(stop.selectedVoltageKv)) throw Error('Selected journey voltage must belong to the canonical station.');
    return {...trusted, ...(stop.place ? {place: stop.place} : {}), id, stationId: id, stopId, at: [...trusted.at],
      kv, ...(stop.selectedVoltageKv != null ? {selectedVoltageKv: stop.selectedVoltageKv} : {})};
  });
  if (law) {
    rules = {...rules, allowedVoltages: law.allowedVoltageBands == null ? null : law.allowedVoltageBands.filter(v => /^\d+$/.test(String(v))).map(Number),
      allowOtherVoltage: law.allowedVoltageBands?.includes('other') === true, allowTransformers: law.allowTransformers !== false};
    allowSimulated = law.fallback === 'user-opted-hypothetical';
    let at = 0;
    for (const id of law.mustVisitStationIds || []) {
      while (at < selected.length && selected[at].id !== id) at++;
      if (at === selected.length) throw Error('Required stations must appear in their declared order.');
      at++;
    }
  }
  const allowedVoltages = rules.allowedVoltages === undefined ? null : rules.allowedVoltages;
  if (allowedVoltages !== null && (!Array.isArray(allowedVoltages) || allowedVoltages.some(kv => !Number.isFinite(kv) || kv <= 0))) throw Error('Choose valid voltage levels.');
  const eligible = network?.index && createEligibleTrainIndex(network.index,
    {allowedVoltages, allowOtherVoltage:rules.allowOtherVoltage===true, allowTransformers: rules.allowTransformers === true}, network.isReviewedEdge);
  const sequence = planTrainBuses(selected, eligible, network, allowedVoltages, allowSimulated,rules.allowOtherVoltage===true);
  const legs = selected.slice(1).map((to, i) => {
    const from = selected[i];
    const choice = sequence[i];
    let evidence = choice?.topology ? 'TOPOLOGY_ONLY' : choice?.simulated ? 'SIMULATED' : 'MISSING';
    let coordinates = choice ? [[...from.at], [...to.at]] : null;
    const topology = choice?.topology || null, source = choice?.source || null;
    if (topology) {
      const joined = topology.path.map(hop => {
        const id = hop.circuit_id, join = id && network.geometryByCircuit?.[id];
        return join?.reviewed === true && join.source && join.circuitId === id
          && join.fromNode === hop.from_node && join.toNode === hop.to_node
          && join.geometry?.type === 'LineString' && validLine(join.geometry.coordinates)
          ? join.geometry.coordinates.map(at => [...at]) : null;
      });
      if (joined.length && joined.every(Boolean) && joined.every((line, n) => !n || same(line[0], joined[n - 1].at(-1)))) {
        evidence = 'GIS_REVIEWED'; coordinates = joined.flatMap((line, n) => n ? line.slice(1) : line);
      }
    }
    const km = coordinates ? coordinates.slice(1).reduce((sum, at, n) => sum
      + geodesy.distanceKm(...coordinates[n], ...at), 0) : null;
    if (km !== null && (!Number.isFinite(km) || km < 0)) throw Error('Invalid route distance.');
    return {id: 'leg-' + i, index: i, fromId: from.id, toId: to.id, evidence, coordinates, km,
      topology, source, simulationVoltageKv: choice?.simulated ? choice.kv : null, fromBus: choice?.fromBus || null, toBus: choice?.toBus || null,
      electricalTopology: topology ? 'PUBLISHED_REVIEWED_PATH' : 'UNKNOWN',
      geometry: evidence === 'GIS_REVIEWED' ? 'REVIEWED_SOURCE_GIS' : coordinates ? 'SCHEMATIC' : 'UNKNOWN',
      surveyConstructability: 'UNKNOWN', accessStatus: 'UNKNOWN', direction: 'USER_JOURNEY_HEADING_ONLY', electricalFlow: 'UNKNOWN',
      label: evidence === 'SIMULATED' ? 'User-assumed simulated leg; not a cable route'
        : evidence === 'TOPOLOGY_ONLY' ? 'Published topology; schematic line, not a cable route'
        : evidence === 'GIS_REVIEWED' ? 'Reviewed circuit identity and source GIS geometry'
        : 'No reviewed route for this leg'};
  });
  return {schema: 'gridatlas.train.route-plan.v1', planEpoch, rules: {allowedVoltages: allowedVoltages === null ? null : [...allowedVoltages], allowOtherVoltage:rules.allowOtherVoltage===true, allowTransformers: rules.allowTransformers === true}, stops: selected, legs,
    totalKm: legs.every(leg => leg.km !== null) ? legs.reduce((sum, leg) => sum + leg.km, 0) : null,
    synthetic: !!synthetic, playable: legs.every(leg => leg.coordinates !== null), simulated: legs.some(leg => leg.evidence === 'SIMULATED')};
}
function trainVoltageAllowed(kv, allowed,other=false) { return Number.isFinite(kv) && kv > 0 && (allowed === null || allowed.includes(kv)
  ||other&&![400,275,220,132,66,33,11].includes(kv)); }
/** Keep every reachable arrival bus, not just the cheapest arrival at a station. */
function planTrainBuses(stops, eligible, network, allowed, simulate,other) {
  const graph = eligible?.graph();
  const binding = stop => {
    if (stop.proposed) return null;
    const row = network?.stationBindings?.[stop.id];
    return row?.stationId === stop.id && row.reviewed === true && row.source && typeof row.siteCode === 'string'
      && eligible?.site(row.siteCode)?.code === row.siteCode ? row : null;
  };
  const voltages = stop => (stop.selectedVoltageKv == null ? stop.kv : [stop.selectedVoltageKv])
    .filter(kv => trainVoltageAllowed(kv, allowed,other)).sort((a,b) => a-b);
  const statesAt = stop => {
    const bind = binding(stop), kv = voltages(stop);
    const buses = bind ? graph.nodesOfSite(bind.siteCode).filter(bus => kv.includes(graph.nodeVoltageKv(bus))).sort() : [];
    return buses.length ? buses.map(bus => ({bus, kv: graph.nodeVoltageKv(bus), binding: bind}))
      : kv.map(voltage => ({bus: null, kv: voltage, binding: null}));
  };
  const order = (a,b) => a.cost-b.cost || a.key.localeCompare(b.key,'en');
  let states = statesAt(stops[0]).map(s => ({...s,cost:0,key:s.bus || 'virtual:'+s.kv,choices:[]}));
  for (let i=0;i<stops.length-1;i++) {
    const targets = statesAt(stops[i+1]), candidates = new Map();
    for (const previous of states) for (const target of targets) {
      let choice = null;
      if (previous.bus && target.bus && typeof network?.electricalDistance?.between === 'function') {
        const topology = trainExactBusPath(eligible, network, previous, target);
        if (topology) choice = {topology,source:{from:previous.binding.source,to:target.binding.source},fromBus:previous.bus,toBus:target.bus};
      }
      if (!choice && simulate === true && previous.kv === target.kv) choice = {
        simulated:true,kv:previous.kv,fromBus:previous.bus,toBus:target.bus};
      if (!choice) continue;
      const fingerprint = choice.topology?.path.map(h=>h.from_node+'>'+h.to_node+':'+h.kind).join('|') || 'hypothetical';
      const candidate = {...target,cost:previous.cost+(choice.simulated?1000000:choice.topology.path.length),
        key:previous.key+'|'+(target.bus || 'virtual:'+target.kv)+'|'+fingerprint,choices:[...previous.choices,choice]};
      const key = target.bus || 'virtual:'+target.kv;
      if (!candidates.has(key) || order(candidate,candidates.get(key))<0) candidates.set(key,candidate);
    }
    if (!candidates.size) {
      const prefix = states.sort(order)[0]?.choices || [];
      return [...prefix,...Array(stops.length-1-prefix.length).fill(null)];
    }
    states = [...candidates.values()];
  }
  return states.sort(order)[0]?.choices || Array(stops.length-1).fill(null);
}
function trainExactBusPath(eligible, network, from, to) {
  const graph = eligible.graph(), START='@train-exact-start', END='@train-exact-end';
  // Query aliases avoid electrical-distance's same-SITE zero-hop shortcut.
  // They are not source nodes or graph edges: exact source bus IDs remain unchanged.
  const queryGraph = {...graph,nodesOfSite:code => code===START?[from.bus]:code===END?[to.bus]:graph.nodesOfSite(code)};
  const index = {graph:()=>queryGraph,site:key=>key===START?{code:START,name:from.binding.siteCode}
    :key===END?{code:END,name:to.binding.siteCode}:null};
  const result = network.electricalDistance.between(index,START,END,{voltageKv:from.kv,
    maxHops:Number.isInteger(network.maxHops)&&network.maxHops>0?Math.min(10000,network.maxHops):10000});
  if (result?.schema!=='gridatlas.module.electrical-distance.v1'||result.reached!==true
    ||result.from?.code!==START||result.to?.code!==END||!Array.isArray(result.path)) return null;
  const path=result.path;
  if (path.length ? path[0].from_node!==from.bus||path.at(-1).to_node!==to.bus : from.bus!==to.bus) return null;
  if (!path.every((hop,n)=>graph.has(hop.from_node)&&graph.has(hop.to_node)
    &&(!n||path[n-1].to_node===hop.from_node)
    &&graph.edgesAt(hop.from_node).some(edge=>edge.kind===hop.kind&&edge.row[edge.far]===hop.to_node))) return null;
  return {...result,from:{code:from.binding.siteCode},to:{code:to.binding.siteCode},arrival_node:to.bus,
    path:path.map(hop=>{const rows=graph.edgesAt(hop.from_node).filter(edge=>edge.kind===hop.kind&&edge.row[edge.far]===hop.to_node);
      return {...hop,circuit_id:rows.length===1?rows[0].row.circuit_id||rows[0].row.id||null:null};})};
}
/** A view over the existing graph, never a new graph or a mutation of it. */
export function createEligibleTrainIndex(index, {allowedVoltages, allowOtherVoltage=false, allowTransformers}, isReviewedEdge) {
  const graph = index.graph();
  if (graph?.schema !== 'gridatlas.module.network-topology.graph.v1') throw Error('Unsupported network graph.');
  const permitted = node => graph.has(node) && trainVoltageAllowed(graph.nodeVoltageKv(node), allowedVoltages,allowOtherVoltage);
  const view = {...graph,
    has: permitted,
    nodesOfSite: code => graph.nodesOfSite(code).filter(permitted),
    edgesAt: node => !permitted(node) ? [] : graph.edgesAt(node).filter(edge => {
      const far = edge.row[edge.far];
      if (!permitted(far) || typeof isReviewedEdge !== 'function' || isReviewedEdge(edge) !== true) return false;
      const changes = graph.nodeVoltageKv(node) !== graph.nodeVoltageKv(far);
      return edge.kind === 'circuit' ? !changes : edge.kind === 'transformer' && allowTransformers === true;
    })};
  return {graph: () => view, site: key => index.site(key)};
}
function same(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function validLine(line) {
  return Array.isArray(line) && line.length >= 2 && line.length <= 10000 && line.every(at =>
    Array.isArray(at) && at.length === 2 && at.every(Number.isFinite) && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90);
}
