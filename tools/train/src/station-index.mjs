/** Full source inventory. Display limits never change inventory or itinerary limits. */
export function trainCoordinate(at) {
  return Array.isArray(at) && at.length === 2 && at.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90 && !(at[0] === 0 && at[1] === 0);
}
export function normaliseTrainStop(stop) {
  const stationId = stop?.stationId ?? stop?.id;
  if (typeof stationId !== 'string' || !stationId.trim() || /[\u0000-\u001f\u007f]/.test(stationId) || (stop.id != null && stop.id !== stationId) || !trainCoordinate(stop.at)) throw new Error('A stable source station ID and valid source point are required.');
  const row = {stationId, id: stationId, name: String(stop.name || 'Unnamed mapped substation'), at: stop.at.slice(), kv: [...new Set((stop.kv || []).filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0))], operator: String(stop.operator || ''), source: String(stop.source || 'Existing Atlas substation layer')};
  if (stop.place) {
    const p = stop.place;
    if (typeof p.label !== 'string' || !p.label.trim() || !trainCoordinate(p.at) || typeof p.provider !== 'string' || !p.provider || typeof p.distanceKm !== 'number' || !Number.isFinite(p.distanceKm) || p.distanceKm < 0) throw new Error('Place binding requires label, resolved point, provider and measured distance.');
    row.place = {label: p.label, at: p.at.slice(), provider: p.provider, precision: p.precision == null ? null : String(p.precision), distanceKm: p.distanceKm, ...(p.resolvedLabel ? {resolvedLabel: String(p.resolvedLabel)} : {})};
  }
  return row;
}
export function buildStationIndex(features, {geodesy, datasetPin = null} = {}) {
  if (!Array.isArray(features) || typeof geodesy?.representativePoint !== 'function' || typeof geodesy?.voltagesKv !== 'function' || typeof geodesy?.distanceKm !== 'function') throw new Error('Full source features and canonical geodesy are required.');
  const sourceRecords = features.length, rows = [], ids = new Map(), conflictingIds = new Set();
  let invalidRecords = 0, duplicateRecords = 0;
  for (const feature of features) {
    const p = feature?.properties || {}, stationId = feature?.id ?? p.id, at = geodesy.representativePoint(feature?.geometry);
    if (stationId == null) { invalidRecords++; continue; }
    let row;
    try { row = normaliseTrainStop({stationId: String(stationId), at, name: p.name, kv: Array.from(geodesy.voltagesKv(p)), operator: p.operator, source: p.source}); } catch { invalidRecords++; continue; }
    if (ids.has(row.stationId)) {
      duplicateRecords++;
      if (JSON.stringify(ids.get(row.stationId)) !== JSON.stringify(row)) conflictingIds.add(row.stationId);
      continue;
    }
    ids.set(row.stationId, row); rows.push(row);
  }
  // Conflicting identities are visible as a coverage gap, never silently selectable.
  const inventory = rows.filter(row => !conflictingIds.has(row.stationId));
  const pin = datasetPin == null ? null : JSON.parse(JSON.stringify(datasetPin));
  const copy = row => normaliseTrainStop(row), folded = s => String(s).normalize('NFKC').toLocaleLowerCase('en').trim();
  const limitValue = limit => { if (limit == null) return Infinity; if (!Number.isInteger(limit) || limit < 1) throw new Error('Result limit must be a positive integer.'); return limit; };
  function result(matches, limit, query = null) {
    const n = limitValue(limit);
    return {schema: 'gridatlas.station-search.v1', query, sourceRecords, indexedRecords: inventory.length, matched: matches.length, truncated: matches.length > n, ambiguous: matches.length > 1, rows: matches.slice(0,n).map(row => ({...copy(row), ...(row.distanceKm == null ? {} : {distanceKm: row.distanceKm})}))};
  }
  return Object.freeze({
    search(query, {limit} = {}) {
      const q = folded(query ?? '');
      const matches = q ? inventory.filter(row => folded(row.stationId).includes(q) || folded(row.name).includes(q)) : [];
      matches.sort((a,b) => Number(folded(b.stationId) === q) - Number(folded(a.stationId) === q) || Number(folded(b.name) === q) - Number(folded(a.name) === q) || a.name.localeCompare(b.name,'en') || a.stationId.localeCompare(b.stationId,'en'));
      return result(matches, limit, String(query ?? ''));
    },
    near(at, {radiusKm, limit} = {}) {
      if (!trainCoordinate(at) || !Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 50) throw new Error('Choose a valid place point and whole radius from 1 to 50 km.');
      const matches = inventory.map(row => ({...row, distanceKm: geodesy.distanceKm(at[0],at[1],row.at[0],row.at[1])})).filter(row => Number.isFinite(row.distanceKm) && row.distanceKm >= 0 && row.distanceKm <= radiusKm).sort((a,b) => a.distanceKm-b.distanceKm || a.stationId.localeCompare(b.stationId,'en'));
      return result(matches, limit);
    },
    get(stationId) { const row = ids.get(stationId); return row && !conflictingIds.has(stationId) ? copy(row) : null; },
    snapshot() { return {schema:'gridatlas.station-index.v1', sourceRecords, indexedRecords:inventory.length, invalidRecords, duplicateRecords, conflictingIds:[...conflictingIds], datasetPin: pin == null ? null : JSON.parse(JSON.stringify(pin)), datasetPinStatus:pin == null ? 'NOT_SUPPLIED' : 'CALLER_SUPPLIED_NOT_REVALIDATED', coordinatePrecision:'SOURCE_PROVIDED_NOT_INDEPENDENTLY_VERIFIED', connectionsInferred:0}; }
  });
}

