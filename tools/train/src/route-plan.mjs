/** Ordered user itinerary; proximity never establishes electrical connectivity. */
export function buildRoutePlan({stops, stationIndex = null, synthetic = false, geodesy, allowSimulated = false, network = null, rules = {}, law = null} = {}) {
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 90) throw Error('Choose 2–90 station stops.');
  if (typeof geodesy?.distanceKm !== 'function') throw Error('Canonical geodesy is required.');
  const ids = new Set();
  const selected = stops.map(stop => {
    const id = stop.stationId || stop.id;
    if (typeof id !== 'string' || !id) throw Error('Each stop needs a stable station identity.');
    const canonical = stationIndex?.get(id);
    if (!synthetic && (!canonical || !same(canonical.at, stop.at))) throw Error('Choose an existing canonical station from the station index.');
    if (synthetic && !String(stop.source).startsWith('SYNTHETIC')) throw Error('Fictional stops need an explicit synthetic source.');
    const stopId = stop.stopId || 'visit-' + ids.size;
    if (ids.has(stopId)) throw Error('Each visit needs a distinct stop identity.');
    ids.add(stopId);
    if (!Array.isArray(stop.at) || stop.at.length !== 2 || !stop.at.every(Number.isFinite)
      || Math.abs(stop.at[0]) > 180 || Math.abs(stop.at[1]) > 90) throw Error('A station stop is unlocated.');
    const trusted = canonical || stop;
    const kv = (Array.isArray(trusted.kv) ? trusted.kv : [trusted.kv]).filter(kv => Number.isFinite(kv) && kv > 0);
    if (stop.selectedVoltageKv != null && !kv.includes(stop.selectedVoltageKv)) throw Error('Selected journey voltage must belong to the canonical station.');
    return {...trusted, ...(stop.place ? {place: stop.place} : {}), id, stationId: id, stopId, at: [...trusted.at],
      kv, ...(stop.selectedVoltageKv != null ? {selectedVoltageKv: stop.selectedVoltageKv} : {})};
  });
  if (law) {
    rules = {...rules, allowedVoltages: law.allowedVoltageBands.filter(v => /^\d+$/.test(String(v))).map(Number), allowTransformers: law.allowTransformers !== false};
    allowSimulated = law.fallback === 'user-opted-hypothetical';
    let at = 0;
    for (const id of law.mustVisitStationIds || []) {
      while (at < selected.length && selected[at].id !== id) at++;
      if (at === selected.length) throw Error('Required stations must appear in their declared order.');
      at++;
    }
  }
  const allowedVoltages = rules.allowedVoltages || [...new Set(selected.flatMap(stop => stop.kv))];
  if (!Array.isArray(allowedVoltages) || !allowedVoltages.length || allowedVoltages.some(kv => !Number.isFinite(kv) || kv <= 0)) throw Error('Choose allowed voltage levels.');
  const eligible = network?.index && createEligibleTrainIndex(network.index,
    {allowedVoltages, allowTransformers: rules.allowTransformers === true}, network.isReviewedEdge);
  const legs = selected.slice(1).map((to, i) => {
    const from = selected[i];
    const fromKv = from.selectedVoltageKv == null ? from.kv : [from.selectedVoltageKv];
    const toKv = to.selectedVoltageKv == null ? to.kv : [to.selectedVoltageKv];
    let evidence = 'MISSING', coordinates = null, topology = null, source = null;
    // Explicit reviewed identity bindings only; never match station names or coordinates.
    const a = network?.stationBindings?.[from.id], b = network?.stationBindings?.[to.id];
    if (a?.stationId === from.id && b?.stationId === to.id && a.reviewed === true && b.reviewed === true
      && a.source && b.source && typeof a.siteCode === 'string' && typeof b.siteCode === 'string'
      && typeof network?.electricalDistance?.between === 'function') {
      const graph = eligible.graph();
      const perLegGraph = {...graph, nodesOfSite: code => graph.nodesOfSite(code).filter(node =>
        (code !== a.siteCode || fromKv.includes(graph.nodeVoltageKv(node)))
        && (code !== b.siteCode || toKv.includes(graph.nodeVoltageKv(node))))};
      const perLegIndex = {site: key => eligible.site(key), graph: () => perLegGraph};
      const result = network.electricalDistance.between(perLegIndex, a.siteCode, b.siteCode,
        {maxHops: Number.isInteger(network.maxHops) && network.maxHops > 0 ? Math.min(10000, network.maxHops) : 10000,
          ...(fromKv.some(kv => allowedVoltages.includes(kv)) ? {voltageKv: fromKv.find(kv => allowedVoltages.includes(kv))} : {})});
      if (result?.schema === 'gridatlas.module.electrical-distance.v1' && result.reached === true
        && result.from?.code === a.siteCode && result.to?.code === b.siteCode && Array.isArray(result.path)
        && eligible && (result.path.length ? perLegGraph.nodesOfSite(a.siteCode).includes(result.path[0].from_node)
          && perLegGraph.nodesOfSite(b.siteCode).includes(result.path.at(-1).to_node) : a.siteCode === b.siteCode && perLegGraph.nodesOfSite(a.siteCode).length > 0)
        && result.path.every((hop, n) => eligible.graph().has(hop.from_node)
          && eligible.graph().has(hop.to_node) && (!n || result.path[n - 1].to_node === hop.from_node)
          && eligible.graph().edgesAt(hop.from_node).some(edge => edge.kind === hop.kind && edge.row[edge.far] === hop.to_node))) {
        const path = result.path.map(hop => {
          const matches = eligible.graph().edgesAt(hop.from_node).filter(edge => edge.kind === hop.kind && edge.row[edge.far] === hop.to_node);
          return {...hop, circuit_id: matches.length === 1 ? matches[0].row.circuit_id || matches[0].row.id || null : null};
        });
        topology = {...result, path}; source = {from: a.source, to: b.source}; evidence = 'TOPOLOGY_ONLY';
        // A topology path contains no GIS route by itself. Each hop must carry an
        // exact circuit ID and a reviewed geometry join for that same identity.
        const joined = topology.path.map(hop => {
          const id = hop.circuit_id;
          const join = id && network.geometryByCircuit?.[id];
          return join?.reviewed === true && join.source && join.circuitId === id
            && join.fromNode === hop.from_node && join.toNode === hop.to_node
            && join.geometry?.type === 'LineString' && validLine(join.geometry.coordinates)
            ? join.geometry.coordinates.map(at => [...at]) : null;
        });
        if (joined.length && joined.every(Boolean) && joined.every((line, n) => !n || same(line[0], joined[n - 1].at(-1)))) {
          evidence = 'GIS_REVIEWED'; coordinates = joined.flatMap((line, n) => n ? line.slice(1) : line);
        }
      }
    }
    if (!coordinates && evidence === 'TOPOLOGY_ONLY') coordinates = [[...from.at], [...to.at]];
    const sharedVoltage = fromKv.find(kv => toKv.includes(kv) && allowedVoltages.includes(kv));
    if (evidence === 'MISSING' && allowSimulated === true && sharedVoltage !== undefined) {
      evidence = 'SIMULATED'; coordinates = [[...from.at], [...to.at]];
    }
    const km = coordinates ? coordinates.slice(1).reduce((sum, at, n) => sum
      + geodesy.distanceKm(...coordinates[n], ...at), 0) : null;
    if (km !== null && (!Number.isFinite(km) || km < 0)) throw Error('Invalid route distance.');
    return {id: 'leg-' + i, index: i, fromId: from.id, toId: to.id, evidence, coordinates, km,
      topology, source, simulationVoltageKv: evidence === 'SIMULATED' ? sharedVoltage : null,
      electricalTopology: topology ? 'PUBLISHED_REVIEWED_PATH' : 'UNKNOWN',
      geometry: evidence === 'GIS_REVIEWED' ? 'REVIEWED_SOURCE_GIS' : coordinates ? 'SCHEMATIC' : 'UNKNOWN',
      surveyConstructability: 'UNKNOWN', accessStatus: 'UNKNOWN', direction: 'USER_JOURNEY_HEADING_ONLY', electricalFlow: 'UNKNOWN',
      label: evidence === 'SIMULATED' ? 'User-assumed simulated leg; not a cable route'
        : evidence === 'TOPOLOGY_ONLY' ? 'Published topology; schematic line, not a cable route'
        : evidence === 'GIS_REVIEWED' ? 'Reviewed circuit identity and source GIS geometry'
        : 'No reviewed route for this leg'};
  });
  return {schema: 'gridatlas.train.route-plan.v1', rules: {allowedVoltages: [...allowedVoltages], allowTransformers: rules.allowTransformers === true}, stops: selected, legs,
    totalKm: legs.every(leg => leg.km !== null) ? legs.reduce((sum, leg) => sum + leg.km, 0) : null,
    synthetic: !!synthetic, playable: legs.every(leg => leg.coordinates !== null), simulated: legs.some(leg => leg.evidence === 'SIMULATED')};
}
/** A view over the existing graph, never a new graph or a mutation of it. */
export function createEligibleTrainIndex(index, {allowedVoltages, allowTransformers}, isReviewedEdge) {
  const graph = index.graph();
  if (graph?.schema !== 'gridatlas.module.network-topology.graph.v1') throw Error('Unsupported network graph.');
  const permitted = node => graph.has(node) && allowedVoltages.includes(graph.nodeVoltageKv(node));
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
