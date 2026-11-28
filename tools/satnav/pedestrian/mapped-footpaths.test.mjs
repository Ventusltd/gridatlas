// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createBristolFootpathRouter } from './mapped-footpaths.mjs';

const revision = '8e91b07d8312acca5bcaef43e839f06a3b1d642a';
const upstream = 'https://raw.githubusercontent.com/Ventusltd/grid-distance-maths/' + revision + '/src/geodesy.mjs';
const bytes = process.env.SATNAV_GEODESY_FILE
  ? await readFile(process.env.SATNAV_GEODESY_FILE)
  : Buffer.from(await (await fetch(upstream)).arrayBuffer());
const blob = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
assert.equal(blob, '5a0320ca6db05273fae14f786b20223b088bc60b');
const maths = await import('data:text/javascript;base64,' + bytes.toString('base64'));
const bundle = JSON.parse(await readFile(new URL('bristol-footpaths.geojson', import.meta.url)));
const route = createBristolFootpathRouter(bundle, maths);
const source = code => bundle.features.find(f => f.properties.ROUTE_CODE === code).geometry.coordinates;
const endpoints = (first, last) => [source(first)[0], source(last).at(-1)];
const route21 = endpoints('BCC/21/10', 'BCC/21/30');
const route25 = endpoints('BCC/25/10', 'BCC/25/50');
const route38 = endpoints('BCC/38/10', 'BCC/38/30');
const section = (code, coords, status = 'FP') => ({ type: 'Feature',
  properties: { ROUTE_CODE: code, STATUS: status }, geometry: { type: 'LineString', coordinates: coords } });
const synthetic = features => createBristolFootpathRouter({ ...bundle, features }, maths);

for (const [id, points, expectedM, count] of [
  ['BCC/21', route21, 578.2, 3], ['BCC/25', route25, 1276.4, 5], ['BCC/38', route38, 342.0, 3],
]) {
  test(id + ' follows the mapped geometry in both directions', () => {
    const forward = route(...points), backward = route(points[1], points[0]);
    assert.equal(forward.status, 'mapped');
    assert.equal(forward.route, id);
    assert.equal(forward.currentAccess, 'unverified');
    assert.ok(Math.abs(forward.distanceM - expectedM) < 2);
    assert.equal(forward.sectionCodes.length, count);
    assert.deepEqual(backward.sectionCodes, [...forward.sectionCodes].reverse());
    assert.deepEqual(backward.geometry.coordinates, [...forward.geometry.coordinates].reverse());
    assert.deepEqual(forward.geometry.coordinates[0], points[0]);
    assert.deepEqual(forward.geometry.coordinates.at(-1), points[1]);
    const sum = forward.geometry.coordinates.slice(1).reduce((total, b, i) =>
      total + maths.distanceKm(...forward.geometry.coordinates[i], ...b) * 1000, 0);
    assert.ok(Math.abs(sum - forward.distanceM) < 0.01);
    assert.ok(forward.distanceM > maths.distanceKm(...points[0], ...points[1]) * 1000 + 2);
  });
}

test('clipping within an original segment excludes off-path taps from geometry', () => {
  const [a, b] = source('BCC/21/10');
  const interp = t => a.map((v, i) => v + t * (b[i] - v));
  const from = interp(0.3), to = interp(0.7);
  from[1] += 0.00002;
  const before = [...from];
  const answer = route(from, to);
  assert.equal(answer.status, 'mapped');
  assert.ok(answer.fromOffsetM > 0 && answer.fromOffsetM < 3);
  assert.notDeepEqual(answer.geometry.coordinates[0], from);
  assert.equal(answer.geometry.coordinates.length, 2);
  assert.deepEqual(from, before);
});

test('coverage, separate routes and identical selections have explicit outcomes', () => {
  assert.equal(route([0, 0], route21[0]).reason, 'outside-coverage');
  assert.equal(route([NaN, 52], route21[0]).reason, 'invalid-point');
  assert.equal(route(route21[0], route38[1]).reason, 'no-mapped-connection');
  assert.equal(route(route21[0], route21[0]).reason, 'same-position');
});

test('supplied closure blocks only journeys which use that section', () => {
  assert.equal(route(...route21, ['BCC/21/20']).reason, 'excluded-section');
  assert.equal(route(...route21, ['BCC/25/30']).status, 'mapped');
  assert.equal(route(...route21, null).reason, 'invalid-closures');
  const coords = source('BCC/21/10');
  assert.equal(route(coords[0], coords.at(-1), ['BCC/21/20']).status, 'mapped');
});

const a = [-2.63,51.50], b = [-2.629,51.50], c = [-2.628,51.50], d = [-2.627,51.50];
test('unknown access and missing section prevent traversing the gap', () => {
  const go = synthetic([section('BCC/X/10',[a,b]),section('BCC/X/20',[b,c],'FPS'),section('BCC/X/30',[c,d])]);
  assert.equal(go(a,d).reason, 'no-mapped-connection');
});

test('sections with a geographic gap cannot be traversed', () => {
  const go = synthetic([section('BCC/X/10',[a,b]),section('BCC/X/20',[c,d])]);
  assert.equal(go(a,d).reason, 'no-mapped-connection');
});

test('an interior line crossing cannot create a mapped pedestrian junction', () => {
  const p=[-2.6285,51.50], south=[p[0],p[1]-.001], north=[p[0],p[1]+.001];
  const go=synthetic([section('BCC/X/10',[a,d]),section('BCC/Y/10',[south,north])]);
  assert.equal(go(p,north).reason,'ambiguous-tap');
  assert.equal(go(a,north).reason,'no-mapped-connection');
});

test('source order and feature orientation do not set the walking direction', () => {
  const go=synthetic([section('BCC/X/20',[b,c]),section('BCC/X/10',[b,a])]);
  assert.deepEqual(go(a,c).geometry.coordinates,[a,b,c]);
});

test('snapshot validation and output do not corrupt input or future routes', () => {
  assert.throws(() => createBristolFootpathRouter({...bundle, source:{url:'unknown'}},maths));
  assert.throws(() => synthetic([section('BCC/X/10',[a,b]),section('BCC/X/10',[c,d])]));
  assert.throws(() => synthetic([section('BCC/X/10',[a,[Infinity,51.50]])]));
  const first=route(...route21);
  first.geometry.coordinates[1][0]=0;
  assert.notEqual(route(...route21).geometry.coordinates[1][0],0);
});
