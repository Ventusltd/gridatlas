import {createWaypointGuidance} from '../guidance/ordered.mjs';

const samePin = (a, b) => a?.id === b?.id && a.coordinate.every((n, i) => n === b.coordinate[i]);

// FROM is a saved design point. Direct guidance starts at the live measured
// position and targets the first VIA or TO. The final return leg is explicit.
export function walkTargets(pins, from, loop) {
  const targets = from ? pins.slice(1) : pins.slice();
  if (loop && from && pins.length >= 3) targets.push({id:'return-' + pins[0].id,coordinate:from});
  return targets;
}

export function createDirectWalk(maths, compass) {
  let ordered = createWaypointGuidance(maths, compass);
  let targets = [], arrived = false, lastTimestamp = -Infinity;
  function setTargets(next) {
    if (next.length === targets.length && next.every((pin, i) => samePin(pin, targets[i]))) return;
    const singleChanged = next.length === 1 || targets.length === 1;
    targets = next;
    if (singleChanged) {arrived = false; lastTimestamp = -Infinity;}
    ordered.setRoute(targets);
  }
  function restart() {
    arrived = false;
    lastTimestamp = -Infinity;
    ordered = createWaypointGuidance(maths, compass);
    ordered.setRoute(targets);
  }
  function locate(fix, now = Date.now()) {
    if (!targets.length) return {status:'choose'};
    const quality = compass.fixQuality(fix, now);
    if (quality !== 'usable') return {status:'waiting',quality};
    if (targets.length > 1) return ordered.locate(fix,now);
    if (fix.timestampMs < lastTimestamp) return {status:'waiting',quality:'out-of-order'};
    const metrics = compass.guide(fix,{coordinates:targets[0].coordinate},now);
    if (!metrics) return {status:'waiting'};
    if (fix.timestampMs > lastTimestamp && metrics.distanceM + fix.accuracyM <= 15) arrived = true;
    lastTimestamp = fix.timestampMs;
    return arrived ? {status:'complete'} : {status:'guiding', targetIndex:0,
      distanceM:metrics.distanceM,remainingM:metrics.distanceM,bearingDeg:metrics.bearingDeg};
  }
  return {setTargets,restart,locate};
}
