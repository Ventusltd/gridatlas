import assert from 'node:assert/strict';
import test from 'node:test';
import { distanceKm } from '../vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/vendor/grid-distance-maths/src/geodesy.mjs';
import { fixQuality } from '../vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/compass.mjs';
import { createFieldSurvey } from './model.mjs';

const create = () => createFieldSurvey({ fixQuality, distanceKm });
const fix = (longitude, timestampMs, accuracyM = 4) => ({ longitude, latitude: 51, timestampMs, accuracyM });
const pins = [[0,51], [0.001,51], [0.001,51.001]].map((coordinate, id) => ({ id, coordinate }));
const get = (data, role) => data.features.filter(f => f.properties.satnavRole === role);

test('a planned boundary closes once, produces measured units and reopens without changing the design pins', () => {
  const survey = create();
  const polygon = survey.close(pins);
  assert.equal(polygon.polygon.coordinates[0].length, 4);
  assert.ok(polygon.perimeterM > 300 && polygon.perimeterM < 325);
  assert.ok(polygon.areaM2 > 3800 && polygon.areaM2 < 4000);
  assert.equal(polygon.exceedsFollowerSegmentLimit, false);
  const data = survey.exportData(pins);
  assert.equal(get(data, 'waypoint').length, 3);
  assert.deepEqual(get(data, 'perimeter')[0].geometry.coordinates[0], get(data, 'planned-route')[0].geometry.coordinates);
  survey.reopen();
  const open = survey.exportData(pins);
  assert.equal(get(open, 'perimeter').length, 0);
  assert.equal(get(open, 'planned-route')[0].geometry.coordinates.length, 3);
  assert.equal(survey.pointCount, 0);
});

test('paused, poor, lost, stale and interrupted recordings preserve every genuine segment and its metadata', () => {
  const survey = create();
  assert.equal(survey.ingest(fix(0,900), 900), false);
  survey.start();
  survey.ingest(fix(0,1000), 1000);
  survey.ingest(fix(0.001,1500,7), 1500);
  survey.pause();
  assert.equal(survey.ingest(fix(0.002,2000), 2000), false);
  survey.resume();
  survey.ingest(fix(0.5,2500), 2500);
  assert.equal(survey.ingest(fix(0.51,3000,31), 3000), false);
  survey.ingest(fix(0.52,3500), 3500);
  assert.equal(survey.ingest(null, 3700), false);
  survey.ingest(fix(0.53,4000), 4000);
  assert.equal(survey.ingest(fix(0.54,4500), 17000), false);
  survey.ingest(fix(0.55,17500), 17500);
  survey.stop();
  assert.equal(survey.ingest(fix(0.56,18000), 18000), false);
  survey.start();
  assert.equal(survey.ingest(fix(0.55,17500), 18000), false);
  survey.ingest(fix(0.57,18500), 18500);
  survey.ingest(fix(0.58,30000), 30000);
  survey.stop();
  const data = survey.exportData([]);
  assert.equal(survey.pointCount, 8);
  assert.equal(get(data, 'walked-track').length, 1);
  assert.equal(get(data, 'walked-fix').length, 6);
  assert.deepEqual(get(data, 'walked-track')[0].properties.timestampMs, [1000, 1500]);
  assert.deepEqual(get(data, 'walked-track')[0].properties.accuracyM, [4, 7]);
  assert.equal(get(data, 'walked-fix')[0].properties.timestampMs, 2500);
  assert.equal(get(data, 'walked-fix')[0].properties.accuracyM, 4);
  assert.equal(survey.distanceM, distanceKm(0, 51, 0.001, 51) * 1000);
  assert.equal(get(data, 'waypoint').length, 0);
});

test('invalid rings do not change pins and long boundary legs are identified', () => {
  const survey = create();
  assert.throws(() => survey.close(pins.slice(0, 2)), /INVALID_VERTEX_COUNT/);
  assert.throws(() => survey.close([pins[0], pins[1], pins[0]]), /INVALID_VERTEX_COUNT/);
  const long = survey.close([pins[0], pins[1], { id: 7, coordinate: [0.02, 51.01] }]);
  assert.equal(long.exceedsFollowerSegmentLimit, true);
});

test('20,000 accepted fixes remain exportable with a plan and repeated starts keep the previous data', () => {
  const survey = create();
  for (let session = 0; session < 2; session++) {
    survey.start();
    for (let i = 0; i < 10_000; i++) {
      const t = 1 + i + session * 10_000;
      survey.ingest(fix(i / 1_000_000, t), t);
    }
    survey.stop();
  }
  assert.equal(survey.full, true);
  assert.equal(survey.start(), false);
  const data = survey.exportData(pins);
  assert.deepEqual(get(data, 'walked-track').map(f => f.geometry.coordinates.length), [10_000, 10_000]);
  assert.equal(get(data, 'waypoint').length, 3);
});
