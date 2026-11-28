import { readSurveyLayout, editableCoordinates, GIS_TYPES, RADIAL_NAMES } from '../survey/interchange.mjs';
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

function checkReferenceSystem(value) {
  if (!value?.crs) return;
  const name = value.crs.properties?.name;
  if (value.crs.type !== 'name' || typeof name !== 'string' || !WGS84.has(name.toUpperCase())) {
    throw Error('Convert the layout to WGS84 longitude and latitude before importing.');
  }
}

// Preserve an engineering layer label when the GIS exporter only supplies its type.
function sourceFeature(feature, nativeLayout = false) {
  if (feature?.type !== 'Feature' || !feature.geometry) throw Error('Each layout feature needs a geometry.');
  checkReferenceSystem(feature);
  checkReferenceSystem(feature.geometry);
  const props = feature.properties ?? {};
  if (typeof props !== 'object' || Array.isArray(props)) throw Error('Invalid feature properties.');
  const known = Object.hasOwn(GIS_TYPES, props.type);
  const extra = {};
  const hasName = typeof props.name === 'string' && props.name.trim();
  if (typeof props.label === 'string' && props.label.trim() && !hasName) extra.name = props.label.trim().slice(0, 200);
  if (nativeLayout && !known && feature.geometry.type === 'LineString' && !props.satnavRole && !props.role) {
    extra.gisReferenceOnly = true;
  }
  return { ...feature, properties: { ...props, ...extra } };
}

function readFeatures(doc) {
  checkReferenceSystem(doc);
  if (doc?.schema === 'ventus.gis-route.v1') {
    checkReferenceSystem(doc.route);
    checkReferenceSystem(doc.route?.geometry);
    const [route] = readSurveyLayout(doc).features;
    route.properties.type = 'export_cable';
    const name = doc.route.properties?.name;
    if (typeof name === 'string' && name.trim()) route.properties.name = name.trim().slice(0, 200);
    return [route];
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
  const nativeLayout = features.some(f => Object.hasOwn(GIS_TYPES, f?.properties?.type));
  const result = readSurveyLayout({ type: 'FeatureCollection', features: features.map(f => sourceFeature(f, nativeLayout)) });
  let count = 0;
  for (const { geometry } of result.features) {
    const coordinates = geometry.coordinates;
    count += geometry.type === 'Point' ? 1 : geometry.type === 'Polygon' ? coordinates[0].length : coordinates.length;
    if (count > MAX_COORDINATES) throw Error('The layout exceeds 64,000 coordinates.');
  }
  return result;
}

export function layoutChoices(layout) {
  const choices = [];
  const cables = [];
  const pins = [];
  const counts = Object.create(null);
  const nativeLayout = layout.features.some(f => Object.hasOwn(GIS_TYPES, f.properties.type));
  for (const [index, feature] of layout.features.entries()) {
    const {satnavRole:role, type, gisRole, gisReferenceOnly} = feature.properties;
    if (role === 'walked-track' || role === 'walked-fix' || gisReferenceOnly) continue;
    const sourceLabel = Object.hasOwn(GIS_TYPES, type) ? GIS_TYPES[type][1] : '';
    const kind = Object.hasOwn(RADIAL_NAMES, gisRole) ? RADIAL_NAMES[gisRole] :
      sourceLabel || (nativeLayout && role === 'waypoint' ? 'Site point' : ROLE_NAMES[role]);
    counts[kind] = (counts[kind] ?? 0) + 1;
    const label = feature.properties.name?.trim() || kind + ' ' + counts[kind];
    const target = type === 'export_cable' ? cables : choices;
    target.push({index, label, role});
    if (role === 'waypoint' && !nativeLayout) pins.push(index);
  }
  if (pins.length > 1 && pins.length <= MAX_ROUTE_PINS) {
    choices.unshift({ index: -1, label: 'Ordered waypoints (' + pins.length + ')', role: 'waypoints', pins });
  }
  return cables.concat(choices);
}

export function walkLayoutChoice(survey, layout, choice) {
  if (!choice) throw Error('Select a design feature for the walk.');
  if (choice.role === 'waypoints') {
    if (layout.features.some(f => Object.hasOwn(GIS_TYPES, f.properties.type))) throw Error('Select a design line or individual site point.');
    const coordinates = choice.pins.map(index => {
      const pin = layout.features[index];
      if (pin?.properties.satnavRole !== 'waypoint') throw Error('Invalid waypoint selection.');
      return [...pin.geometry.coordinates];
    });
    return survey.replacePlan(coordinates);
  }
  const selected = layout.features[choice.index];
  const role = selected?.properties.satnavRole;
  const points = editableCoordinates(selected);
  if (!points) throw Error('Choose a design feature for the walk.');
  if (role === 'waypoint') return survey.setDestination(points[0]);
  if (role === 'perimeter') points.push([...points[0]]);
  return survey.replacePlan(points);
}
