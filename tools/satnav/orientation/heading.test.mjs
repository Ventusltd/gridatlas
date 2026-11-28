import assert from 'node:assert/strict';
import test from 'node:test';
import { geodesicCircle } from '../vendor/grid-distance-maths/src/geodesy.mjs';
import { compactTargetBearing, deviceHeading, formatDegrees } from './heading.mjs';

const point = (role, coordinates) => ({ properties: { role }, geometry: { type: 'Point', coordinates } });
const start = [-1, 51];
const destination = [-1, 51.005];
const end = point('destination-point', destination);

test('calibrated WebKit compass reports magnetic bearings in both orientations', () => {
  const event = { webkitCompassHeading: 350, webkitCompassAccuracy: 9 };
  assert.deepEqual(deviceHeading(event), { degrees: 350, reference: 'magnetic' });
  assert.deepEqual(deviceHeading(event, 90), { degrees: 80, reference: 'magnetic' });
  assert.equal(deviceHeading({ ...event, webkitCompassAccuracy: -1 }), null);
  assert.equal(deviceHeading({ ...event, webkitCompassHeading: -1 }), null);
});

test('absolute orientation uses the screen top and ignores relative or vertical readings', () => {
  const event = { absolute: true, alpha: 90, beta: 0, gamma: 0 };
  assert.equal(deviceHeading(event).degrees, 270);
  assert.equal(deviceHeading(event, 90).degrees, 0);
  assert.equal(deviceHeading({ ...event, absolute: false }), null);
  assert.equal(deviceHeading({ ...event, alpha: null }), null);
  assert.equal(deviceHeading({ ...event, beta: 90 }), null);
  assert.equal(formatDegrees(359.9), '000°');
});

test('planned and current target bearings identify their origin', () => {
  assert.equal(compactTargetBearing([]), '');
  assert.equal(compactTargetBearing([end, point('start-point', start)]), 'FROM to TO 000° true');
  assert.equal(compactTargetBearing([end, point('measured-gps', start)]), 'GPS to TO 000° true');
  assert.equal(compactTargetBearing([end, point('measured-gps', destination)]), 'TO within GPS accuracy');
  assert.equal(compactTargetBearing([end, point('start-point', destination)]), 'FROM and TO coincide');
  assert.equal(compactTargetBearing([point('start-point', [0, 1]), point('destination-point', [180, -1])]), 'Bearing undetermined');
});

test('the existing measured accuracy ring controls bearing availability', () => {
  const measured = point('measured-gps', start);
  function radius(metres) {
    return { properties: { role: 'gps-accuracy' }, geometry: { type: 'Polygon', coordinates: [geodesicCircle(...start, metres / 1000, 64)] } };
  }
  assert.equal(compactTargetBearing([end, measured, radius(30)]), 'GPS to TO 000° true');
  assert.equal(compactTargetBearing([end, measured, radius(31)]), 'Bearing awaiting an accurate GPS fix');
  assert.equal(compactTargetBearing([point('destination-point', [-1, 51.00002]), measured, radius(10)]), 'TO within GPS accuracy');
});
