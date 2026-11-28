import { fromGisSnapshot, normaliseGeoJSON } from './geojson.mjs';
import {
  importGeoJSON as readLegacySurvey,
  exportGeoJSON as writeLegacySurvey,
} from './geojson-interchange.mjs';

export const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_COORDINATES = 64000;
const MAX_ROUTE_PINS = 20000;
const WGS84 = new Set(['OGC:CRS84', 'URN:OGC:DEF:CRS:OGC:1.3:CRS84', 'EPSG:4326', 'URN:OGC:DEF:CRS:EPSG::4326']);
const ROLE_NAMES = {
  waypoint: 'Waypoint', 'planned-route': 'Planned line', perimeter: 'Perimeter',
  'walked-track': 'Recorded track', 'walked-fix': 'Recorded fix',
};
// Feature types emitted by the original GIS SLD drawing and financial export.
const GIS_TYPES = {
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
const RADIAL_NAMES = {
  collector_trunk: '33 kV collector trunk',
  block_branch: '33 kV block branch',
};

function checkReferenceSystem(value) {
  if (!value?.crs) return;
  const name = value.crs.properties?.name;
  if (value.crs.type !== 'name' || typeof name !== 'string' || !WGS84.has(name.toUpperCase())) {
    throw Error('Convert the layout to WGS84 longitude and latitude before importing.');
  }
}

function measuredPoint(feature, properties) {
  const stamp = properties.timestampMs ?? properties.timestamp;
  const accuracy = properties.accuracyM ?? properties.accuracy;
  if (![stamp, accuracy].every(number => Number.isFinite(number) && number >= 0)) {
    throw Error('A recorded fix needs its original timestamp and accuracy.');
  }
  if (feature.geometry?.type !== 'Point') throw Error('A recorded fix must be a point.');
  const { geometry } = normaliseGeoJSON(feature.geometry).features[0];
  return { type: 'Feature', geometry, properties: { satnavRole: 'walked-fix', timestampMs: stamp, accuracyM: accuracy } };
}

function normaliseFeature(feature) {
  if (feature?.type !== 'Feature' || !feature.geometry) throw Error('Each layout feature needs a geometry.');
  checkReferenceSystem(feature);
  checkReferenceSystem(feature.geometry);
  const props = feature.properties ?? {};
  if (typeof props !== 'object' || Array.isArray(props)) throw Error('Invalid feature properties.');
  const definition = Object.hasOwn(GIS_TYPES, props.type) ? GIS_TYPES[props.type] : null;
  const gisType = definition?.[0] === feature.geometry.type ? props.type : null;
  // The source uses "role" for the electrical function of a radial cable.
  // Other values keep their original navigation-role validation.
  const radialRole = gisType === '33kv_radial' && Object.hasOwn(RADIAL_NAMES, props.role);
  const navigationRole = radialRole ? undefined : props.role;
  if (props.satnavRole !== undefined && navigationRole !== undefined && props.satnavRole !== navigationRole) {
    throw Error('A feature declares two different navigation roles.');
  }
  const role = props.satnavRole ?? navigationRole;
  const item = role === 'walked-fix'
    ? measuredPoint(feature, props)
    : normaliseGeoJSON({ ...feature, properties: { ...props, satnavRole: role } }).features[0];
  if (typeof props.name === 'string') item.properties.name = props.name.trim().slice(0, 200);
  if (gisType && !['walked-fix', 'walked-track'].includes(item.properties.satnavRole)) {
    item.properties.type = gisType;
    if (gisType === '33kv_radial') {
      const sourceRole = radialRole ? props.role : props.gisRole;
      if (Object.hasOwn(RADIAL_NAMES, sourceRole)) item.properties.gisRole = sourceRole;
    }
    if ((gisType === 'poi' || gisType === 'private_sub') && !item.properties.name &&
        typeof props.selected_substation_name === 'string') {
      item.properties.name = props.selected_substation_name.trim().slice(0, 200);
    }
  }
  if (typeof feature.id === 'string' && feature.id.length <= 200 || Number.isFinite(feature.id)) item.id = feature.id;
  return item;
}

function readFeatures(doc) {
  checkReferenceSystem(doc);
  if (doc?.schema === 'ventus.gis-route.v1') {
    checkReferenceSystem(doc.route);
    checkReferenceSystem(doc.route?.geometry);
    return fromGisSnapshot(doc).features;
  }
  if (doc?.schema === 'ventus.satnav.geojson.v1') {
    if (!Array.isArray(doc.features) || doc.features.length > MAX_COORDINATES) throw Error('Too many features.');
    for (const feature of doc.features) {
      checkReferenceSystem(feature);
      checkReferenceSystem(feature?.geometry);
      if (feature?.properties?.satnavRole !== undefined && feature.properties.satnavRole !== feature.properties.role) {
        throw Error('A survey feature has conflicting roles.');
      }
    }
    return writeLegacySurvey(readLegacySurvey(doc)).features;
  }
  if (doc?.schema !== undefined) throw Error('Unsupported layout schema.');
  if (doc?.type === 'FeatureCollection') return doc.features;
  if (doc?.type === 'Feature') return [doc];
  if (['Point', 'LineString', 'Polygon'].includes(doc?.type)) return [{ type: 'Feature', geometry: doc }];
  throw Error('Choose a GeoJSON layout or a GIS SLD route snapshot.');
}

export function readLayout(input) {
  const doc = typeof input === 'string' ? JSON.parse(input) : input;
  const features = readFeatures(doc);
  if (!Array.isArray(features) || !features.length || features.length > MAX_COORDINATES) {
    throw Error('The layout is empty or exceeds the feature limit.');
  }
  let count = 0;
  const ids = new Set();
  const normalised = features.map(feature => {
    const item = normaliseFeature(feature);
    const { type, coordinates } = item.geometry;
    count += type === 'Point' ? 1 : type === 'Polygon' ? coordinates[0].length : coordinates.length;
    if (count > MAX_COORDINATES) throw Error('The layout exceeds 64,000 coordinates.');
    if (item.id !== undefined) {
      if (ids.has(item.id)) throw Error('The layout contains duplicate feature IDs.');
      ids.add(item.id);
    }
    return item;
  });
  return { type: 'FeatureCollection', features: normalised };
}

export function layoutChoices(layout) {
  const choices = [];
  const cables = [];
  const pins = [];
  const counts = Object.create(null);
  for (const [index, feature] of layout.features.entries()) {
    const role = feature.properties.satnavRole;
    if (role === 'walked-track' || role === 'walked-fix') continue;
    const type = feature.properties.type;
    const sourceLabel = Object.hasOwn(GIS_TYPES, type) ? GIS_TYPES[type][1] : '';
    const radial = feature.properties.gisRole;
    const kind = Object.hasOwn(RADIAL_NAMES, radial) ? RADIAL_NAMES[radial] : sourceLabel || ROLE_NAMES[role];
    counts[kind] = (counts[kind] ?? 0) + 1;
    const label = feature.properties.name || kind + ' ' + counts[kind];
    const target = type === 'export_cable' ? cables : choices;
    target.push({ index, label, role });
    // GIS equipment and design markers are individually selectable destinations.
    // Its explicit cable line already contains the endpoints and ordered cable pins.
    if (role === 'waypoint' && !sourceLabel) pins.push(index);
  }
  if (pins.length > 1 && pins.length <= MAX_ROUTE_PINS) {
    choices.unshift({ index: -1, label: 'Ordered waypoints (' + pins.length + ')', role: 'waypoints', pins });
  }
  return cables.concat(choices);
}

export function walkLayoutChoice(survey, layout, choice) {
  if (!choice) throw Error('Select a design feature for the walk.');
  if (choice.role === 'waypoints') {
    const coordinates = choice.pins.map(index => {
      const pin = layout.features[index];
      if (pin?.properties.satnavRole !== 'waypoint') throw Error('Invalid waypoint selection.');
      return [...pin.geometry.coordinates];
    });
    return survey.replacePlan(coordinates);
  }
  const selected = layout.features[choice.index];
  const role = selected?.properties.satnavRole;
  if (role === 'waypoint') return survey.setDestination([...selected.geometry.coordinates]);
  if (role !== 'planned-route' && role !== 'perimeter') throw Error('Choose a design feature for the walk.');
  const coords = role === 'perimeter' ? selected.geometry.coordinates[0] : selected.geometry.coordinates;
  return survey.replacePlan(coords.map(point => [...point]));
}
