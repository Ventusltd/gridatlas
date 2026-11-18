/** Spatial exploration only. Canonical Atlas geodesy is injected, never forked. */
export const VOLTAGE_BANDS = Object.freeze([
  ['400', '400 kV', '#ff5555'], ['275', '275 kV', '#ff8a3d'],
  ['132', '132 kV', '#ffd84d'], ['66', '66 kV', '#8be28b'],
  ['33', '33 kV', '#48d8df'], ['11', '11 kV', '#b8b8ed'],
  ['other', 'Other stated voltage', '#e6e6e6'], ['unknown', 'Voltage not stated', '#8b9ca0']
]);

export function validCoordinate(at) {
  return Array.isArray(at) && at.length >= 2 && at.slice(0, 2).every(v => typeof v === 'number' && Number.isFinite(v))
    && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90
    && !(Math.abs(at[0]) < 1e-9 && Math.abs(at[1]) < 1e-9);
}

export function radiusKm(value) {
  if (typeof value === 'string' && !value.trim()) throw new Error('Choose a radius from 1 to 50 km.');
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error('Choose a whole-kilometre radius from 1 to 50 km.');
  return n;
}

export function normaliseOrigin(origin, {requireIdentity = false} = {}) {
  if (!validCoordinate(origin?.at)) throw new Error('A valid located origin is required; no coordinates were inferred.');
  const type = String(origin.type || 'map-centre');
  const id = origin.id == null ? null : String(origin.id).trim();
  if (requireIdentity && (!['repd', 'datacentre', 'substation'].includes(type) || !id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id))) {
    throw new Error('Journey origin type and stable source ID are required.');
  }
  return {at: [origin.at[0], origin.at[1]], type, id, name: String(origin.name || (id ? `${type} ${id}` : 'Map centre')).slice(0, 240)};
}

export function parseVicinityIntent(search) {
  const q = new URLSearchParams(search);
  if (q.get('journey') !== 'vicinity') return null;
  const unique = ['journey', 'origin_type', 'origin_id', 'latitude', 'longitude', 'radius_km'];
  if (unique.some(k => q.getAll(k).length !== 1)) throw new Error('Journey link has missing or duplicate origin fields.');
  const latitude = q.get('latitude'), longitude = q.get('longitude');
  const numberText = value => typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim());
  if (!numberText(latitude) || !numberText(longitude)) throw new Error('Journey link has invalid coordinates.');
  const origin = normaliseOrigin({at: [Number(longitude), Number(latitude)], type: q.get('origin_type'), id: q.get('origin_id'), name: q.get('name')}, {requireIdentity: true});
  const intent = {origin, radiusKm: radiusKm(q.get('radius_km'))};
  if (q.has('news_context_url')) {
    if (q.getAll('news_context_url').length !== 1 || q.getAll('news_topic').length > 1) throw new Error('Journey link has duplicate news context fields.');
    intent.newsContextUrl = validateNewsContextBase(q.get('news_context_url'));
    intent.newsTopic = normaliseNewsTopic(q.get('news_topic'), origin);
  }
  return intent;
}

export function validateNewsContextBase(value) {
  if (typeof value !== 'string' || value.length > 200 || !/^https:\/\/globalgrid2050\.com\//.test(value)) throw new Error('News context must use a dated GlobalGrid2050 edition.');
  const url = new URL(value);
  if (url.origin !== 'https://globalgrid2050.com' || url.username || url.password || url.port || url.search || url.hash
    || !/^\/uk_renewables_pipeline\/\d{12}\/(?:index\.html)?$/.test(url.pathname)) throw new Error('News context must use a dated GlobalGrid2050 edition without extra URL fields.');
  return url.href;
}

export function normaliseNewsTopic(value, origin) {
  const allowed = ['datacentre','grid','renewables','storage','solar','wind'];
  if (value != null && value !== '') {
    if (!allowed.includes(value)) throw new Error('News topic is not supported.');
    return value;
  }
  return origin?.type === 'datacentre' ? 'datacentre' : origin?.type === 'substation' ? 'grid' : 'renewables';
}

export function newsContextHref(base, origin, topic) {
  const url = new URL(validateNewsContextBase(base));
  if (['repd','datacentre','substation'].includes(origin?.type) && origin?.id) {
    url.searchParams.set('news_origin_type', origin.type);
    url.searchParams.set('news_origin_id', String(origin.id).slice(0,256));
  }
  url.searchParams.set('news_topic', normaliseNewsTopic(topic, origin));
  url.hash = 'headlinesHeading';
  return url.href;
}

export function voltageBands(kv) {
  if (!kv.length) return ['unknown'];
  return [...new Set(kv.map(v => VOLTAGE_BANDS.some(b => b[0] === String(v)) ? String(v) : 'other'))];
}

export function stationRecords(features, geodesy) {
  const seen = new Set(), records = [];
  for (const feature of features || []) {
    const p = feature?.properties || {}, at = geodesy.representativePoint(feature?.geometry);
    if (!validCoordinate(at)) continue;
    const kv = Array.from(geodesy.voltagesKv(p)).filter(v => Number.isFinite(v) && v > 0);
    // This key deduplicates display rows only. It is never exported as source identity.
    const id = feature.id ?? p.id ?? null;
    const key = `${at[0]}|${at[1]}|${p.name || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({id: id == null ? null : String(id), at: [at[0], at[1]], name: String(p.name || 'Unnamed mapped substation'),
      operator: String(p.operator || ''), kv, bands: voltageBands(kv), source: String(p.source || 'Existing Atlas substation layer')});
  }
  return records;
}

export function exploreVicinity({origin, radius, records, bands, geodesy, limit = 200}) {
  const o = normaliseOrigin(origin), r = radiusKm(radius), selected = new Set(bands);
  const ordered = [];
  for (const row of records) {
    if (!row.bands.some(b => selected.has(b))) continue;
    const km = geodesy.distanceKm(o.at[0], o.at[1], row.at[0], row.at[1]);
    if (!Number.isFinite(km) || km < 0 || km > r) continue;
    ordered.push({...row, km});
  }
  ordered.sort((a, b) => a.km - b.km || a.name.localeCompare(b.name, 'en') || String(a.id).localeCompare(String(b.id), 'en'));
  return {origin: o, radiusKm: r, matching: ordered.length, loadedRecords: records.length,
    shown: ordered.slice(0, limit), truncated: ordered.length > limit,
    statement: 'Spatial vicinity, connectivity unknown. Distances are straight-line; mapped voltage is a source tag, not capacity or an electrical path.'};
}

/** A radius boundary is spatial geometry, never a circuit or route. */
export function vicinityGeoJSON(result, geodesy) {
  const [lon, lat] = result.origin.at;
  const ring = [];
  for (let i = 0; i <= 96; i++) {
    ring.push(geodesy.destinationPoint(lon, lat, result.radiusKm, i * 360 / 96));
  }
  return {type: 'FeatureCollection', features: [
    {type: 'Feature', properties: {kind: 'radius', meaning: 'Spatial boundary; not a circuit'}, geometry: {type: 'LineString', coordinates: ring}},
    {type: 'Feature', properties: {kind: 'origin', name: result.origin.name}, geometry: {type: 'Point', coordinates: result.origin.at}},
    ...result.shown.map(row => ({type: 'Feature', properties: {kind: 'substation', name: row.name, km: row.km,
      voltage: row.kv.length ? row.kv.join(' / ') + ' kV' : 'Not stated', colour: VOLTAGE_BANDS.find(b => b[0] === row.bands[0])?.[2] || '#e6e6e6'},
      geometry: {type: 'Point', coordinates: row.at}}))
  ]};
}
