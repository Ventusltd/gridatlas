// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createWaypointGuidance} from './ordered.mjs';

const stored = '../vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/';
const root = process.env.SATNAV_COMPASS_ROOT
  ? pathToFileURL(resolve(process.env.SATNAV_COMPASS_ROOT) + '/')
  : new URL(stored, import.meta.url);
const maths = await import(new URL('vendor/grid-distance-maths/src/geodesy.mjs', root));
const compass = await import(new URL('nav/compass.mjs', root));
const now = 10_000;
const start = [-0.1, 51.5];
const east = maths.destinationPoint(...start, 0.1, 90);
const north = maths.destinationPoint(...east, 0.1, 0);
const fix = (at, timestampMs = now, accuracyM = 3) => ({
  longitude: at[0], latitude: at[1], accuracyM, timestampMs
});
const pin = (id, coordinate) => ({id, coordinate});
const pins = [pin('from', start), pin('middle', east), pin('to', north)];
function route(points = pins) {
  const guidance = createWaypointGuidance(maths, compass);
  guidance.setRoute(points);
  return guidance;
}
function close(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test('the first unvisited pin remains the only target, even at a later pin', () => {
  const g = route();
  const atEnd = g.locate(fix(north), now);
  assert.equal(atEnd.targetId, 'from');
  assert.equal(atEnd.status, 'guiding');
  close(atEnd.plannedM, 200);
  close(atEnd.remainingM, atEnd.distanceM + 200);
  assert.equal(atEnd.offRoute, null);
});

test('an ordered walk uses canonical bearings and distance to the remaining pins', () => {
  const g = route();
  const leg = g.locate(fix(start), now);
  assert.equal(leg.targetIndex, 1);
  close(leg.bearingDeg, 90);
  close(leg.remainingM, 200);
  assert.equal(leg.offRoute, false);
  const turn = g.locate(fix(east, now + 1), now + 1);
  assert.equal(turn.targetId, 'to');
  close(turn.bearingDeg, 0);
  close(turn.remainingM, 100);
  const end = g.locate(fix(north, now + 2), now + 2);
  assert.equal(end.status, 'complete');
  assert.equal(end.remainingM, 0);
  assert.equal(end.bearingDeg, null);
  assert.equal(end.targetId, null);
  assert.equal(g.locate(null, now + 3).status, 'complete');
});

test('stale, invalid, missing, poor and out-of-order fixes cannot advance', () => {
  const g = route();
  const rejected = [
    [null, 'missing'], [fix(start, -1), 'stale'], [fix(start, now + 1), 'stale'],
    [fix([181, 0]), 'invalid'], [fix(start, now, 31), 'poor']
  ];
  for (const [sample, quality] of rejected) {
    const row = g.locate(sample, now);
    assert.equal(row.status, 'waiting');
    assert.equal(row.quality, quality);
    assert.equal(row.targetIndex, 0);
    assert.equal(row.bearingDeg, null);
  }
  g.locate(fix(start), now);
  const late = g.locate(fix(east, now - 1), now);
  assert.equal(late.quality, 'out-of-order');
  assert.equal(late.targetId, 'middle');
});

test('the accuracy circle must fit the arrival radius, no false bearing in it', () => {
  const g = route();
  const uncertain = g.locate(fix(start, now, 20), now);
  assert.equal(uncertain.targetIndex, 0);
  assert.equal(uncertain.bearingDeg, null);
  const closeBy = maths.destinationPoint(...start, 0.012, 45);
  const near = g.locate(fix(closeBy, now + 1, 10), now + 1);
  assert.equal(near.targetIndex, 0);
  const ok = g.locate(fix(start, now + 2, 15), now + 2);
  assert.equal(ok.targetIndex, 1);
});

test('an accuracy or clock repaint cannot advance two overlapping pins', () => {
  const g = route([pin('a', start), pin('b', start), pin('c', north)]);
  assert.equal(g.locate(fix(start), now).targetId, 'b');
  assert.equal(g.locate(fix(start), now + 1).targetId, 'b');
  assert.equal(g.locate(fix(start, now + 1), now + 1).targetId, 'c');
});

test('a closed loop cannot finish while its middle waypoint is unvisited', () => {
  const g = route([pin('A', start), pin('B', east), pin('A-return', start)]);
  g.locate(fix(start), now);
  assert.equal(g.locate(fix(start, now + 1), now + 1).targetId, 'B');
  assert.equal(g.locate(fix(east, now + 2), now + 2).targetId, 'A-return');
  assert.equal(g.locate(fix(start, now + 3), now + 3).status, 'complete');
});

test('deviation is relative to the current leg and respects fix uncertainty', () => {
  const g = route();
  g.locate(fix(start), now);
  const middle = maths.destinationPoint(...start, 0.05, 90);
  const offset = maths.destinationPoint(...middle, 0.04, 0);
  assert.equal(g.locate(fix(offset, now + 1), now + 1).offRoute, true);
  const lessCertain = g.locate(fix(offset, now + 2, 25), now + 2);
  assert.equal(lessCertain.offRoute, false);
});

test('long and dateline-crossing legs retain compass guidance without a deviation claim', () => {
  const long = route([pin('a', start), pin('b', maths.destinationPoint(...start, 2, 90))]);
  const row = long.locate(fix(start), now);
  close(row.remainingM, 2000);
  close(row.bearingDeg, 90);
  assert.equal(row.deviationAvailable, false);
  assert.equal(row.offRoute, null);
  assert.equal(row.deviationLimit, 'over-1-km');
  const dateline = route([pin('a', [179.999, 0]), pin('b', [-179.999, 0])]);
  const short = dateline.locate(fix([179.999, 0]), now);
  close(short.remainingM, 222.64, 0.1);
  assert.equal(short.deviationAvailable, false);
  assert.equal(short.deviationLimit, 'antimeridian');
  assert.equal(short.bearingDeg, 90);
});

test('a fix across the dateline cannot be projected onto a near-dateline leg', () => {
  const g = route([pin('A', [179.996, 0]), pin('B', [179.999, 0])]);
  assert.equal(g.locate(fix([179.996, 0]), now).deviationAvailable, true);
  const row = g.locate(fix([-179.999, 0], now + 1), now + 1);
  close(row.remainingM, 222.64, 0.1);
  close(row.bearingDeg, 270);
  assert.equal(row.offRoute, null);
  assert.equal(row.deviationLimit, 'antimeridian');
});

test('edits to future pins keep progress and edits to visited pins revisit the first change', () => {
  const g = route();
  g.locate(fix(start), now);
  g.locate(fix(east, now + 1), now + 1);
  g.setRoute([...pins, pin('last', start)]);
  assert.equal(g.locate(null, now).targetId, 'to');
  g.setRoute([pin('from', start), pin('middle', north), pin('to', start)]);
  assert.equal(g.locate(null, now).targetId, 'middle');
  g.setRoute([pin('middle', north), pin('from', start)]);
  assert.equal(g.locate(null, now).targetId, 'middle');
});

test('handles draft routes and rejects invalid or excessive edits atomically', () => {
  const g = route();
  for (const invalid of [
    [pin('repeat', start), pin('repeat', north)], [pin('a', [181, 0])],
    [pin('a', [0, Infinity])], Array(20_001).fill(pins[0]), null
  ]) assert.throws(() => g.setRoute(invalid), RangeError);
  assert.equal(g.locate(null, now).targetId, 'from');
  g.setRoute([]);
  assert.equal(g.locate(null, now).status, 'draft');
  g.setRoute([pins[0]]);
  assert.equal(g.locate(fix(start), now).status, 'draft');
});

test('route inputs and caller-owned fixes are never mutated', () => {
  const copied = pins.map(p => pin(p.id, [...p.coordinate]));
  const current = Object.freeze(fix(start));
  const g = route(copied);
  copied[0].coordinate[0] = 180;
  copied[1].id = 'renamed';
  const row = g.locate(current, now);
  assert.equal(row.targetId, 'middle');
  close(row.remainingM, 200);
});

test('20,000 ordered pins can be loaded and located', () => {
  const many = Array.from({length: 20_000}, (_, i) => pin(String(i), [i * 0.0001, 0]));
  const g = route(many);
  const row = g.locate(fix([0, 0]), now);
  assert.equal(row.targetId, '1');
  close(row.remainingM, maths.distanceKm(0, 0, 1.9999, 0) * 1000);
});
