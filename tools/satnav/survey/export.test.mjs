import assert from 'node:assert/strict';
import test from 'node:test';
import { surveyGeoJSON } from './export.mjs';

const coordinates = [[-1.1, 53.1], [-1.101, 53.101], [-1.101, 53.1]];
const pins = coordinates.map((coordinate, i) => ({ id: 'wp-' + (i + 1), coordinate }));
const ring = [...coordinates, coordinates[0]];
const perimeter = { polygon: { type: 'Polygon', coordinates: [ring] } };
const fix = (index, time, accuracy) => ({
  longitude: coordinates[index][0], latitude: coordinates[index][1], timestampMs: time, accuracyM: accuracy,
});
const record = segments => ({
  schema: 'ventus.satnav-track.v1', pointCount: segments.flat().length, segments,
});
const track = record([[fix(1, 1001, 4), fix(0, 2450, 6)], [fix(2, 88000, 3)]]);

test('a design and two recorded segments retain their own geometry and metadata', () => {
  const original = structuredClone({ track, perimeter, pins });
  const { features } = surveyGeoJSON({ track, perimeter, pins });
  assert.deepEqual(features.map(f => [f.properties.satnavRole, f.geometry.type]), [
    ['waypoint', 'Point'], ['waypoint', 'Point'], ['waypoint', 'Point'],
    ['planned-route', 'LineString'], ['perimeter', 'Polygon'],
    ['walked-track', 'LineString'], ['walked-fix', 'Point'],
  ]);
  assert.deepEqual(features.map(f => f.properties.role), features.map(f => f.properties.satnavRole));
  assert.deepEqual(features.slice(0, 3).map(f => f.id), ['wp-1', 'wp-2', 'wp-3']);
  assert.deepEqual(features[3].geometry.coordinates, coordinates);
  assert.deepEqual(features[4].geometry.coordinates, [ring]);
  assert.deepEqual(features[5].geometry.coordinates, [coordinates[1], coordinates[0]]);
  assert.deepEqual(features[5].properties.timestampMs, [1001, 2450]);
  assert.deepEqual(features[5].properties.accuracyM, [4, 6]);
  assert.deepEqual(features[6].geometry.coordinates, coordinates[2]);
  assert.equal(features[6].properties.timestampMs, 88000);
  assert.equal(features[6].properties.accuracyM, 3);
  features[5].geometry.coordinates[0][0] = 20;
  assert.deepEqual({ track, perimeter, pins }, original);
});

test('zero or one planned pin never turns into a proposed line or measured fix', () => {
  assert.deepEqual(surveyGeoJSON().features, []);
  assert.deepEqual(surveyGeoJSON({ track: record([]) }).features, []);
  assert.equal(surveyGeoJSON({ pins: pins.slice(0, 1) }).features.length, 1);
});

test('two isolated measured fixes remain two points even when coordinates coincide', () => {
  const { features } = surveyGeoJSON({ track: record([[fix(0, 1, 1)], [fix(0, 2, 2)]]) });
  assert.deepEqual(features.map(f => f.geometry.type), ['Point', 'Point']);
  assert.deepEqual(features.map(f => f.properties.accuracyM), [1, 2]);
  assert.deepEqual(features.map(f => f.properties.order), [0, 1]);
});

test('recorded fixes rejected by the original schema cannot silently become a design', () => {
  for (const patch of [{ accuracyM: -1 }, { timestampMs: null }, { latitude: 91 }, { longitude: NaN }]) {
    const invalid = record([[{ ...fix(0, 1000, 3), ...patch }]]);
    assert.throws(() => surveyGeoJSON({ track: invalid }));
  }
  assert.throws(() => surveyGeoJSON({ track: { ...track, pointCount: 0 } }));
  assert.throws(() => surveyGeoJSON({ track: record([[]]) }));
  assert.throws(() => surveyGeoJSON({ track: record([[fix(0, 2, 2)], [fix(1, 1, 3)]]) }));
});

test('the full recorder capacity exports the first and last actual fix', () => {
  const samples = Array.from({ length: 20_000 }, (_, i) => fix(i % 3, i + 1, 3));
  const [line] = surveyGeoJSON({ track: record([samples]) }).features;
  assert.equal(line.geometry.coordinates.length, samples.length);
  assert.equal(line.properties.timestampMs.at(0), 1);
  assert.equal(line.properties.timestampMs.at(-1), 20_000);
  assert.throws(() => surveyGeoJSON({ track: record([samples, [fix(0, 20_001, 3)]]) }));
});
