// SPDX-License-Identifier: Apache-2.0
import {createRouteFollower} from '../line/route-follower.mjs';

const MAX_PINS = 20_000;
const ARRIVAL_RADIUS_M = 15;
const MAX_FOLLOWER_LEG_M = 1_000;

function copyPin(pin, ids) {
  const at = pin?.coordinate;
  if (typeof pin?.id !== 'string' || !pin.id || ids.has(pin.id)) {
    throw new RangeError('Waypoints need unique IDs');
  }
  if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite)
      || Math.abs(at[0]) > 180 || Math.abs(at[1]) > 90) {
    throw new RangeError('Expected WGS84 [longitude, latitude]');
  }
  ids.add(pin.id);
  return {id: pin.id, coordinate: [...at]};
}

/** Takes the same maths and compass modules used by the SatNav GPS watch. */
export function createWaypointGuidance(maths, compass) {
  let route = [];
  let remainingFromPin = [];
  let next = 0;
  let lastSample = -Infinity;
  let followActiveLeg = null;
  let deviationLimit = null;

  function selectLeg() {
    followActiveLeg = null;
    deviationLimit = null;
    if (next === 0 || next >= route.length) return;
    const from = route[next - 1].coordinate;
    const to = route[next].coordinate;
    const length = maths.distanceKm(...from, ...to) * 1000;
    // The existing local projection takes unwrapped longitude differences.
    if (Math.abs(from[0] - to[0]) > 180) {
      deviationLimit = 'antimeridian';
    } else if (length > MAX_FOLLOWER_LEG_M) {
      deviationLimit = 'over-1-km';
    } else if (length > 0) {
      followActiveLeg = createRouteFollower({type: 'LineString', coordinates: [from, to]}, maths);
    }
  }

  function setRoute(pins) {
    if (!Array.isArray(pins) || pins.length > MAX_PINS) throw new RangeError('Too many waypoints');
    const ids = new Set();
    const updated = Array.from(pins, pin => copyPin(pin, ids));
    const remaining = Array(updated.length).fill(0);
    for (let i = updated.length - 2; i >= 0; i--) {
      const metres = maths.distanceKm(...updated[i].coordinate, ...updated[i + 1].coordinate) * 1000;
      if (!Number.isFinite(metres)) throw new RangeError('Cannot measure this section');
      remaining[i] = remaining[i + 1] + metres;
    }
    // Preserve the visited prefix when editing points further along the route.
    let visited = 0;
    while (visited < next && visited < updated.length) {
      const old = route[visited], pin = updated[visited];
      if (old.id !== pin.id || !old.coordinate.every((value, i) => value === pin.coordinate[i])) break;
      visited++;
    }
    route = updated;
    remainingFromPin = remaining;
    next = visited;
    selectLeg();
  }

  function snapshot(status, quality) {
    const target = route.length >= 2 ? route[next] : null;
    return {
      status, quality, targetIndex: target ? next : null, targetId: target?.id ?? null,
      distanceM: null, bearingDeg: null, remainingM: status === 'complete' ? 0 : null,
      plannedM: remainingFromPin[0] ?? 0,
      offRoute: null, deviationAvailable: false, deviationLimit: null
    };
  }

  function locate(fix, now = Date.now()) {
    const quality = compass.fixQuality(fix, now);
    if (route.length < 2) return snapshot('draft', quality);
    if (next >= route.length) return snapshot('complete', quality);
    if (quality !== 'usable') return snapshot('waiting', quality);
    if (fix.timestampMs < lastSample) return snapshot('waiting', 'out-of-order');

    const bearingToNext = () => compass.guide(fix, {coordinates: route[next].coordinate}, now);
    let guidance = bearingToNext();
    // A single measured fix may visit one pin. A repaint can never visit another.
    const fresh = fix.timestampMs > lastSample;
    lastSample = fix.timestampMs;
    if (fresh && guidance && guidance.distanceM + guidance.accuracyM <= ARRIVAL_RADIUS_M) {
      next++;
      selectLeg();
      if (next >= route.length) return snapshot('complete', quality);
      guidance = bearingToNext();
    }
    if (!Number.isFinite(guidance?.distanceM)) return snapshot('waiting', 'unavailable');

    // Direct guidance remains available on long legs. The follower's bounded
    // active-leg projection supplies deviation only where supported.
    const projectionSafe = followActiveLeg
      && Math.abs(fix.longitude - route[next - 1].coordinate[0]) <= 180
      && Math.abs(fix.longitude - route[next].coordinate[0]) <= 180;
    const leg = projectionSafe ? followActiveLeg(fix, now) : null;
    return {
      ...snapshot('guiding', quality),
      distanceM: guidance.distanceM, bearingDeg: guidance.bearingDeg,
      remainingM: guidance.distanceM + remainingFromPin[next],
      offRoute: leg?.offRoute ?? null, deviationAvailable: leg?.status === 'ok',
      deviationLimit: followActiveLeg && !projectionSafe ? 'antimeridian' : deviationLimit
    };
  }

  return {setRoute, locate};
}
