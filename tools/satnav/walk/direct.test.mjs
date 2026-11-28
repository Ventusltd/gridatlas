import test from 'node:test';
import assert from 'node:assert/strict';
import * as compass from '../vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/compass.mjs';
import * as maths from '../vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/vendor/grid-distance-maths/src/geodesy.mjs';
import {createDirectWalk,walkTargets} from './direct.mjs';

const origin = {id:'start',coordinate:[-1.5,51.5]};
const north = metres => [origin.coordinate[0],origin.coordinate[1] + metres / (maths.R_ATLAS * 1000) * 180 / Math.PI];
const destination = {id:'end',coordinate:north(63)};
const fix = (coordinate, timestampMs, accuracyM = 4) => ({longitude:coordinate[0],latitude:coordinate[1],accuracyM,timestampMs});

test('the measured approach can shorten or lengthen while the fixed plan stays at 63 m',() => {
  const walk = createDirectWalk(maths,compass);
  walk.setTargets(walkTargets([origin,destination],origin.coordinate,false));
  for (const [i,metres] of [0,28,14].entries()) {
    const result = walk.locate(fix(north(metres),1000+i),1000+i);
    assert.equal(result.status,'guiding');
    assert.equal(Math.round(result.distanceM),63-metres);
    assert.equal(Math.round(result.bearingDeg),0);
  }
  assert.equal(walk.locate(fix(destination.coordinate,1020,60),1020).status,'waiting');
  assert.equal(walk.locate(fix(destination.coordinate,1000),15000).status,'waiting');
  assert.equal(walk.locate(fix(north(53),15001,8),15001).status,'guiding');
  assert.equal(walk.locate(fix(destination.coordinate,15002),15002).status,'complete');
  assert.equal(Math.round(maths.distanceKm(...origin.coordinate,...destination.coordinate)*1000),63);
});

test('TO first, GPS origin capture, destination replacement and restart',() => {
  const walk = createDirectWalk(maths,compass);
  walk.setTargets(walkTargets([destination],null,false));
  assert.equal(walk.locate(null,1000).status,'waiting');
  assert.equal(walk.locate(fix(destination.coordinate,1001),1001).status,'complete');
  walk.setTargets(walkTargets([origin,destination],origin.coordinate,false));
  assert.equal(walk.locate(fix(origin.coordinate,1002),1002).status,'complete');
  walk.setTargets([{...destination,coordinate:north(100)}]);
  assert.equal(Math.round(walk.locate(fix(origin.coordinate,1003),1003).distanceM),100);
  walk.restart();
  assert.equal(walk.locate(null,1004).status,'waiting');
  assert.equal(walk.locate(fix(origin.coordinate,1005),1005).status,'guiding');
});

test('multiple pins and a perimeter visit ordered targets before returning to FROM',() => {
  const walk = createDirectWalk(maths,compass);
  const via = {id:'via',coordinate:north(28)};
  walk.setTargets(walkTargets([origin,via,destination],origin.coordinate,true));
  assert.equal(walk.locate(fix(origin.coordinate,101),101).targetId,via.id);
  assert.equal(walk.locate(fix(via.coordinate,102),102).targetId,destination.id);
  assert.equal(walk.locate(fix(destination.coordinate,103),103).targetId,'return-start');
  assert.equal(walk.locate(fix(origin.coordinate,104),104).status,'complete');
  walk.setTargets(walkTargets([origin],origin.coordinate,false));
  assert.equal(walk.locate(fix(origin.coordinate,105),105).status,'choose');
});
