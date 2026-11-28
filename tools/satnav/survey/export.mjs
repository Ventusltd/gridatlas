// Local survey export from the waypoint, perimeter and GPS recorder snapshots.
import { normaliseGeoJSON } from '../interchange/geojson.mjs';

const MAX_FIXES = 20_000;

function feature(geometry, satnavRole, metadata = {}) {
  // Older Ventus GIS readers recognise "role". Both names describe the same geometry.
  return { type: 'Feature', geometry, properties: { satnavRole, role: satnavRole, ...metadata } };
}

function measuredFeatures(track) {
  if (track == null) return [];
  if (track.schema !== 'ventus.satnav-track.v1' || !Array.isArray(track.segments)) {
    throw new TypeError('Expected a recorded GPS track.');
  }

  let count = 0;
  let singletons = 0;
  let previousTime = -Infinity;
  const features = [];
  for (const segment of track.segments) {
    if (!Array.isArray(segment) || !segment.length || count + segment.length > MAX_FIXES) {
      throw new RangeError('Invalid number of recorded fixes.');
    }
    const coordinates = [];
    const timestampMs = [];
    const accuracyM = [];
    for (const fix of segment) {
      if (!Number.isFinite(fix?.timestampMs) || fix.timestampMs < 0 ||
          fix.timestampMs <= previousTime || !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0) {
        throw new TypeError('Invalid recorded GPS time or accuracy.');
      }
      previousTime = fix.timestampMs;
      coordinates.push([fix.longitude, fix.latitude]);
      timestampMs.push(fix.timestampMs);
      accuracyM.push(fix.accuracyM);
    }
    if (segment.length === 1) {
      const geometry = normaliseGeoJSON({ type: 'Point', coordinates: coordinates[0] }).features[0].geometry;
      features.push(feature(geometry, 'walked-fix', {
        timestampMs: timestampMs[0], accuracyM: accuracyM[0],
        timestamp: timestampMs[0], accuracy: accuracyM[0], order: singletons++,
      }));
    } else {
      const geometry = normaliseGeoJSON({ type: 'LineString', coordinates }).features[0].geometry;
      features.push(feature(geometry, 'walked-track', { timestampMs, accuracyM }));
    }
    count += segment.length;
  }
  if (count !== track.pointCount) throw new TypeError('Recorded fix count does not match the segments.');
  return features;
}

export function surveyGeoJSON({ pins = [], perimeter = null, track = null } = {}) {
  if (!Array.isArray(pins) || pins.length > MAX_FIXES) throw new RangeError('Invalid waypoint count.');
  const features = [];
  const coordinates = [];
  for (const pin of pins) {
    const point = normaliseGeoJSON({ type: 'Point', coordinates: pin.coordinate }).features[0].geometry;
    const waypoint = feature(point, 'waypoint', { order: coordinates.length });
    if (typeof pin.id === 'string') waypoint.id = pin.id;
    features.push(waypoint);
    coordinates.push(point.coordinates);
  }
  if (coordinates.length >= 2) {
    features.push(feature({ type: 'LineString', coordinates }, 'planned-route'));
  }
  if (perimeter != null) {
    const polygon = normaliseGeoJSON(perimeter.polygon).features[0].geometry;
    if (polygon.type !== 'Polygon') throw new TypeError('Expected a survey perimeter.');
    features.push(feature(polygon, 'perimeter'));
  }
  for (const recorded of measuredFeatures(track)) features.push(recorded);
  return { type: 'FeatureCollection', features };
}

export function mountSurveyExport({ container, getSurvey, onStatus } = {}) {
  const document = container.ownerDocument;
  const browser = document.defaultView;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Export GeoJSON';
  container.append(button);

  const output = document.createElement('output');
  output.setAttribute('aria-live', 'polite');
  if (!onStatus) container.append(output);
  const report = onStatus ?? (message => { output.textContent = message; });

  function download() {
    try {
      const collection = surveyGeoJSON(getSurvey());
      if (!collection.features.length) {
        report('Add a pin or record a track to export.');
        return;
      }
      const blob = new browser.Blob([JSON.stringify(collection)], { type: 'application/geo+json' });
      const url = browser.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ventus-survey.geojson';
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        browser.setTimeout(() => browser.URL.revokeObjectURL(url), 60_000);
      }
      report('GeoJSON download started.');
    } catch (error) {
      report('Export failed. ' + error.message);
    }
  }
  button.addEventListener('click', download);
  return () => {
    button.removeEventListener('click', download);
    button.remove();
    output.remove();
  };
}
