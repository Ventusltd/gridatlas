// SPDX-License-Identifier: Apache-2.0
// Bridge the two Ventus GeoJSON encodings without promoting measured fixes to design.
import { fromGisSnapshot, normaliseGeoJSON } from '../interchange/geojson.mjs';

const MAX_COORDINATES = 20000;
const roles = new Set(['waypoint', 'planned-route', 'perimeter', 'walked-track', 'walked-fix']);
const defaultRole = { Point: 'waypoint', LineString: 'planned-route', Polygon: 'perimeter' };
export const GIS_TYPES = {
  export_cable: ['LineString', 'Export cable'],
  '33kv_radial': ['LineString', '33 kV radial'],
  export_cable_pin: ['Point', 'Cable pin'],
  poi: ['Point', 'Grid connection'],
  private_sub: ['Point', 'Customer substation'],
  string_substation: ['Point', 'String substation'],
  central_inverter: ['Point', 'Central inverter'],
  bess_compound: ['Point', 'BESS compound'],
  array_boundary: ['Polygon', 'Array boundary'],
  skid_footprint: ['Polygon', 'Skid footprint'],
  central_footprint: ['Polygon', 'Central inverter footprint'],
  bess_footprint: ['Polygon', 'BESS footprint'],
};
export const RADIAL_NAMES = {
  collector_trunk: '33 kV collector trunk',
  block_branch: '33 kV block branch',
};
const geographicReferences = new Set([
  'EPSG:4326', 'OGC:CRS84', 'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:EPSG::4326',
]);

function featuresOf(data) {
  if (data?.type === 'FeatureCollection') return data.features;
  if (data?.type === 'Feature') return [data];
  if (Object.hasOwn(defaultRole, data?.type)) return [{type: 'Feature', geometry: data}];
  throw new Error('Expected a GeoJSON point, line, polygon or feature collection');
}

function sampleProperty(properties, key, legacyKey) {
  if (properties[key] !== undefined && properties[legacyKey] !== undefined &&
      properties[key] !== properties[legacyKey]) {
    throw new Error('Conflicting measured fix metadata');
  }
  const value = properties[key] === undefined ? properties[legacyKey] : properties[key];
  if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new Error('Invalid measured fix metadata');
  }
  return value;
}

function countCoordinates(feature) {
  const geometry = feature.geometry;
  if (geometry.type === 'Point') return 1;
  if (geometry.type === 'Polygon') return geometry.coordinates[0].length;
  return geometry.coordinates.length;
}

function normaliseFeature(feature) {
  if (feature?.type !== 'Feature' || !feature.geometry) throw new Error('Invalid GeoJSON feature');
  const properties = feature.properties ?? {};
  if (typeof properties !== 'object' || Array.isArray(properties)) throw new Error('Invalid feature properties');
  const gisType = Object.hasOwn(GIS_TYPES, properties.type) ? properties.type : null;
  if (gisType && GIS_TYPES[gisType][0] !== feature.geometry.type) throw new Error('GIS feature type and geometry disagree');
  const electricalRole = gisType === '33kv_radial' && Object.hasOwn(RADIAL_NAMES, properties.role);
  const navigationRole = electricalRole ? undefined : properties.role;
  const role = properties.satnavRole ?? navigationRole ?? defaultRole[feature.geometry.type];
  if (!roles.has(role)) throw new Error('Unsupported feature role or geometry');
  if (properties.satnavRole != null && navigationRole != null && properties.satnavRole !== navigationRole) {
    throw new Error('Conflicting planned and measured feature roles');
  }

  // The existing validator handles bounds, 2D coordinates, ring closure and track arrays.
  // A single received fix is still measured even when it has no adjacent line segment.
  const baseRole = role === 'walked-fix' ? 'waypoint' : role;
  const [result] = normaliseGeoJSON({
    ...feature,
    properties: {...properties, satnavRole: baseRole},
  }).features;
  if (Number.isFinite(feature.id)) result.id = feature.id;
  result.properties.satnavRole = role;
  if (gisType && !['walked-fix', 'walked-track'].includes(role)) {
    result.properties.type = gisType;
    const radial = electricalRole ? properties.role : properties.gisRole;
    if (gisType === '33kv_radial' && Object.hasOwn(RADIAL_NAMES, radial)) result.properties.gisRole = radial;
    if (!result.properties.name && ['poi', 'private_sub'].includes(gisType) && typeof properties.selected_substation_name === 'string') {
      result.properties.name = properties.selected_substation_name.trim().slice(0, 200);
    }
  }
  if (properties.gisReferenceOnly === true) result.properties.gisReferenceOnly = true;
  if (role === 'walked-fix') {
    const timestamp = sampleProperty(properties, 'timestampMs', 'timestamp');
    const accuracy = sampleProperty(properties, 'accuracyM', 'accuracy');
    if (timestamp !== undefined) result.properties.timestampMs = timestamp;
    if (accuracy !== undefined) result.properties.accuracyM = accuracy;
  }
  if ((role === 'walked-fix' || role === 'waypoint') && properties.order !== undefined) {
    if (!Number.isSafeInteger(properties.order) || properties.order < 0) throw new Error('Invalid point order');
    result.properties.order = properties.order;
  }
  return result;
}

function validatePointOrder(features, role) {
  const points = features.filter(feature => feature.properties.satnavRole === role);
  if (!points.some(feature => feature.properties.order !== undefined)) return;
  const ordered = [...points].sort((a, b) => a.properties.order - b.properties.order);
  if (ordered.some((feature, index) => feature.properties.order !== index)) throw new Error('Invalid point order');
  if (role === 'walked-fix') {
    let previous = -Infinity;
    for (const feature of ordered) {
      const time = feature.properties.timestampMs;
      if (time == null) continue;
      if (time < previous) throw new Error('Measured fix times are out of order');
      previous = time;
    }
  }
  let index = 0;
  for (let i = 0; i < features.length; i++) {
    if (features[i].properties.satnavRole === role) features[i] = ordered[index++];
  }
}

function validateMeasuredOrder(features) {
  if (!features.some(feature => feature.properties.satnavRole === 'walked-track')) {
    validatePointOrder(features, 'walked-fix');
    return;
  }
  // The first V3 exporter counted all samples; its successor counted isolated fixes.
  // Both encodings retain segment order in the FeatureCollection.
  let sampleIndex = 0;
  let singletonIndex = 0;
  let globalOrder = true;
  let singletonOrder = true;
  for (const {geometry, properties} of features) {
    if (properties.satnavRole === 'walked-track') sampleIndex += geometry.coordinates.length;
    if (properties.satnavRole !== 'walked-fix') continue;
    if (properties.order !== undefined) {
      globalOrder = globalOrder && properties.order === sampleIndex;
      singletonOrder = singletonOrder && properties.order === singletonIndex;
      if (!globalOrder && !singletonOrder) throw new Error('Invalid measured sample order');
    }
    sampleIndex++;
    singletonIndex++;
  }
}

export function readSurveyLayout(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (data?.schema === 'ventus.gis-route.v1') return fromGisSnapshot(data);
  if (data?.crs != null && !geographicReferences.has(data.crs?.properties?.name)) {
    throw new Error('Reproject the layout to WGS84 longitude and latitude before importing');
  }
  const features = featuresOf(data);
  // SV02 pins and SV06 recorded fixes have independent limits. The V3 exporter
  // can include both, the planned line repeating the pins, and a closed perimeter.
  if (!Array.isArray(features) || features.length > 4 * MAX_COORDINATES) throw new Error('GeoJSON feature limit exceeded');
  const ids = new Set();
  const counts = new Map();
  const result = features.map(feature => {
    const clean = normaliseFeature(feature);
    const role = clean.properties.satnavRole;
    const group = role === 'walked-fix' ? 'walked-track' : role;
    const count = (counts.get(group) ?? 0) + countCoordinates(clean);
    if (count > MAX_COORDINATES) throw new Error('GeoJSON limit is 20,000 coordinates per layer');
    counts.set(group, count);
    if (clean.id !== undefined && ids.has(clean.id)) throw new Error('Duplicate GeoJSON feature ID');
    if (clean.id !== undefined) ids.add(clean.id);
    return clean;
  });
  validatePointOrder(result, 'waypoint');
  validateMeasuredOrder(result);
  return {type: 'FeatureCollection', features: result};
}

// Only explicitly planned geometry can replace the route in the map editor.
export function editableCoordinates(feature) {
  const clean = normaliseFeature(feature);
  if (clean.properties.gisReferenceOnly) return null;
  switch (clean.properties.satnavRole) {
    case 'waypoint': return [clean.geometry.coordinates];
    case 'planned-route': return clean.geometry.coordinates;
    case 'perimeter': return clean.geometry.coordinates[0].slice(0, -1);
    default: return null;
  }
}
