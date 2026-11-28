import { normaliseGeoJSON } from '../interchange/geojson.mjs';
import { buildPerimeter } from '../perimeter/perimeter.mjs';
import { createTrackRecorder } from '../track/recorder.mjs';

const pointLimit = 20_000;
const maxGapMs = 10_000;

function feature(id, role, geometry, properties = {}) {
  return { type: 'Feature', id, geometry, properties: { satnavRole: role, ...properties } };
}

function trackFeature(segment, index) {
  const id = 'measured-' + (index + 1);
  const coordinate = fix => [fix.longitude, fix.latitude];
  if (segment.length === 1) {
    const [fix] = segment;
    return feature(id, 'walked-fix', { type: 'Point', coordinates: coordinate(fix) }, {
      accuracyM: fix.accuracyM, timestampMs: fix.timestampMs,
    });
  }
  return feature(id, 'walked-track', { type: 'LineString', coordinates: segment.map(coordinate) }, {
    accuracyM: segment.map(fix => fix.accuracyM),
    timestampMs: segment.map(fix => fix.timestampMs),
  });
}

export function createFieldSurvey({ fixQuality, distanceKm }) {
  let recorder = null;
  let status = 'idle';
  let pointCount = 0;
  let distanceM = 0;
  let previousFix = null;
  let lastTimestamp = -Infinity;
  const finishedSegments = [];
  let perimeter = null;

  function start() {
    if (recorder || pointCount >= pointLimit) return false;
    recorder = createTrackRecorder({ fixQuality, maxGapMs, maxPoints: pointLimit - pointCount });
    recorder.start();
    status = 'recording';
    previousFix = null;
    return true;
  }

  function pause() {
    if (!recorder?.pause()) return false;
    previousFix = null;
    status = 'paused';
    return true;
  }

  function resume() {
    if (!recorder?.resume()) return false;
    status = 'recording';
    return true;
  }

  function stop() {
    if (!recorder) return false;
    recorder.stop();
    finishedSegments.push(...recorder.snapshot().segments);
    previousFix = null;
    recorder = null;
    status = 'stopped';
    return true;
  }

  function ingest(fix, now = Date.now()) {
    if (status !== 'recording') return false;
    // A resumed watch may redeliver its last fix after the previous recording stopped.
    if (Number.isFinite(fix?.timestampMs) && fix.timestampMs <= lastTimestamp && fixQuality(fix, now) === 'usable') return false;
    const result = recorder.ingest(fix, now);
    if (!result.accepted) {
      if (result.reason !== 'nonmonotonic') previousFix = null;
      return false;
    }
    if (previousFix && fix.timestampMs - previousFix.timestampMs <= maxGapMs) {
      distanceM += distanceKm(previousFix.longitude, previousFix.latitude, fix.longitude, fix.latitude) * 1000;
    }
    previousFix = { longitude: fix.longitude, latitude: fix.latitude, timestampMs: fix.timestampMs };
    lastTimestamp = fix.timestampMs;
    pointCount++;
    if (pointCount === pointLimit) stop();
    return true;
  }

  function close(pins) {
    const candidate = buildPerimeter(pins.map(pin => pin.coordinate), { distanceKm });
    perimeter = candidate;
    return perimeter;
  }

  function reopen() {
    perimeter = null;
  }

  function measuredFeatures() {
    const active = recorder ? recorder.snapshot().segments : [];
    return finishedSegments.concat(active).map(trackFeature);
  }

  function mapData() {
    const features = measuredFeatures();
    if (perimeter) features.push(feature('boundary', 'perimeter', perimeter.polygon));
    return { type: 'FeatureCollection', features };
  }

  function exportData(pins) {
    const features = pins.map(pin => feature('pin-' + pin.id, 'waypoint', { type: 'Point', coordinates: pin.coordinate }));
    if (pins.length >= 2) {
      const line = perimeter?.plannedWalk ?? { type: 'LineString', coordinates: pins.map(pin => pin.coordinate) };
      features.push(feature('design-line', 'planned-route', line));
    }
    features.push(...mapData().features);
    // Each form has its own 20k capacity. A full recording can coexist with a full plan.
    // The interchange adapter validates known roles. Its single-fix extension retains
    // the measured role and recorder-validated metadata on genuinely isolated points.
    const checked = features.map(f => f.properties.satnavRole === 'walked-fix' ? f : normaliseGeoJSON(f).features[0]);
    return { type: 'FeatureCollection', features: checked };
  }

  return {
    start, pause, resume, stop, ingest, close, reopen, mapData, exportData,
    get status() { return status; },
    get pointCount() { return pointCount; },
    get distanceM() { return distanceM; },
    get full() { return pointCount === pointLimit; },
    get perimeter() { return perimeter; },
  };
}
