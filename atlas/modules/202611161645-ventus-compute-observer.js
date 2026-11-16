/* Ventus Grid Engine: generated receipt observer; not a substitute nearest engine. */
(() => {
'use strict';
const distanceKm = (() => {
/**
 * Module: geodesy
 *
 * Extracted verbatim (formula and constant unchanged) from
 * gridatlas/atlas/modules/202609011950-geodesy.js.
 *
 * One Earth radius for the whole estate, and the three operations every
 * measurement here is built from. This existed three times tonight - in
 * the sandbox, in the substation cartridge and in the data repository -
 * which is exactly how two of them end up on different radii without
 * anyone noticing.
 *
 * Radius 6378.137 km, matching Ventusltd/grid-distance-maths. Haversine.
 * No projection, no turf, no second radius for geometry.
 *
 * Pure functions. No DOM, no network, no state.
 *
 * CHANGED: source wraps this in `(() => { ... NS.geodesy = Object.freeze({...}) })()`
 * and registers itself on `window.__GRIDATLAS_MODULES__.geodesy`. That
 * closure/global-namespace wiring is removed; every function below is
 * otherwise byte-identical to the source, including the atan2 argument
 * order that the source's own comment insists on for numerical parity
 * with ventus-corev8engine.js haversine() (see distanceKm below).
 */

const EARTH_RADIUS_KM = 6378.137;
const DEG = Math.PI / 180;

function distanceKm(lon1, lat1, lon2, lat2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  /* atan2, in this operand order, because that is the form every version
     of this estate has shipped - ventus-corev8engine.js haversine() and
     every cartridge carried from it.
     -------------------------------------------------------------------
     The extraction wrote 2 * R * asin(sqrt(a)) instead. Algebraically the
     same; numerically one unit in the last place apart, which the
     all-versions proof caught on West Burton Solar to Cottam:
     7.050150827184836 shipped, 7.050150827184837 from the module. It is
     1e-15 km and changes no figure any reader will ever see - and it is
     still wrong, because the claim being made is PARITY. A module that is
     nearly the incumbent is a module that has to be argued about every
     time a digit differs. */
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* A polygon reduces to the mean of its outer ring, not its first corner.
   A substation drawn as a compound outline would otherwise be measured
   from whichever vertex the mapper happened to start at.

   Point, Polygon and MultiPolygon, and NOTHING ELSE. The first draft of
   this module accepted any nested coordinate array and so returned a
   mean for a LineString where the incumbent returns null; the parity
   proof caught it against the live cartridge. Extraction is not the
   moment to change behaviour, so the behaviour is pinned here and any
   widening becomes its own version with its own reasoning.

   One deliberate difference, on malformed input only: this returns null
   where the incumbent would throw on a Point with no coordinates. No
   real geometry reaches that path, and a proof asserts it. */
function representativePoint(geometry) {
  if (!geometry) return null;
  const { type, coordinates } = geometry;
  if (type === 'Point') {
    return Array.isArray(coordinates) && coordinates.length >= 2
      ? [coordinates[0], coordinates[1]] : null;
  }
  const ring = type === 'Polygon' ? coordinates && coordinates[0]
    : type === 'MultiPolygon' ? coordinates && coordinates[0] && coordinates[0][0]
      : null;
  if (!Array.isArray(ring) || !ring.length) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const point of ring) {
    sumLon += point[0];
    sumLat += point[1];
  }
  return [sumLon / ring.length, sumLat / ring.length];
}

/* OpenStreetMap's `voltage` is VOLTS at every magnitude, and a feature
   may carry several separated by a semicolon. Magnitude is not the unit:
   750 is a DC traction supply at a railway depot, not 750 kV. An audit
   of the served payload found 229 features (3.95%) carrying a token
   below 1,000, every one of which had been misread. An explicit `kv`
   property is already kilovolts and is trusted as such. */
function voltagesKv(properties) {
  if (!properties) return [];
  const out = [];
  const explicit = properties.kv ?? properties.KV;
  if (explicit != null && String(explicit).trim() !== '') {
    for (const token of String(explicit).match(/\d+(?:\.\d+)?/g) || []) {
      const value = Number(token);
      if (Number.isFinite(value) && value > 0) out.push(value);
    }
  }
  const volts = properties.voltage ?? properties.VOLTAGE;
  if (volts != null) {
    for (const token of String(volts).match(/\d+(?:\.\d+)?/g) || []) {
      const value = Number(token);
      if (Number.isFinite(value) && value > 0) out.push(value / 1000);
    }
  }
  return [...new Set(out)].sort((a, b) => b - a);
}

/* Projection and bearing, carried in from the sandbox verbatim.
   ----------------------------------------------------------------------
   The deep scan found the body carrying a SECOND geodesy section - "the
   geodesy the layout needs, all on R_ATLAS" - four hundred lines away
   from the first. Two geodesies in one file, on a constant that must
   never differ, is the configuration that produced the divergence the
   all-versions proof caught. Both belong here, on the one radius, and
   the body now delegates rather than defining.

   The bodies below are the incumbent's, character for character apart
   from the radius identifier, so parity is a property of the move rather
   than something to argue about afterwards. */
function destinationPoint(lon, lat, km, bearingDeg) {
  const ad = km / EARTH_RADIUS_KM;
  const brg = bearingDeg * DEG;
  const p1 = lat * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(ad)
    + Math.cos(p1) * Math.sin(ad) * Math.cos(brg));
  const l2 = lon * DEG + Math.atan2(
    Math.sin(brg) * Math.sin(ad) * Math.cos(p1),
    Math.cos(ad) - Math.sin(p1) * Math.sin(p2));
  return [l2 / DEG, p2 / DEG];
}

function initialBearingDeg(lon1, lat1, lon2, lat2) {
  const p1 = lat1 * DEG; const p2 = lat2 * DEG;
  const dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

const schema = 'gridatlas.module.geodesy.v1';

return distanceKm;
})();
/** Actual-computation receipts, shared by Node and browsers. No DOM or network. */

const schema = 'ventus.grid-compute-receipt.v1';
const copy = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const located = point => point && finite(point.lon) && finite(point.lat)
  && Math.abs(point.lon) <= 180 && Math.abs(point.lat) <= 90;
const sameLocation = (a, b) => located(a) && located(b) && a.lon === b.lon && a.lat === b.lat;
const sameEntity = (a, b) => a && b && a.kind === b.kind && String(a.id) === String(b.id);

/**
 * Create one observer per selection surface, not one per project. Every request
 * invalidates the previous selection for assessment, including repeated IDs.
 * Receipts are evidence about the supplied callback, not proof that a renderer
 * used this module. Attach run() at the real calculation call site.
 */
function createComputeObserver({ onEvent = () => {}, now = () => Date.now() } = {}) {
  const attempts = new Map();
  let sequence = 0;
  let latest = null;
  const publish = (attempt, status, extra = {}) => {
    Object.assign(attempt, extra, { status, sequence: ++sequence, updated_at_ms: now() });
    attempt.events.push({ status, sequence: attempt.sequence, at_ms: attempt.updated_at_ms });
    // A broken logging consumer must never break the grid calculation itself.
    try { onEvent(copy(attempt)); } catch { /* receipt remains queryable */ }
    return copy(attempt);
  };
  const get = id => {
    const attempt = attempts.get(id);
    if (!attempt) throw new Error('Unknown computation attempt: ' + id);
    return attempt;
  };
  return {
    request({ entity, location = null, operation = 'nearest-grid', dataset = null }) {
      if (!entity || typeof entity.kind !== 'string' || !entity.kind.trim()
          || entity.id == null || !String(entity.id).trim()) {
        throw new TypeError('A computation request requires an entity kind and ID');
      }
      const id = 'compute-' + (sequence + 1);
      const attempt = {
        schema, id, entity: { kind: entity.kind, id: String(entity.id) },
        location: located(location) ? { lon: location.lon, lat: location.lat } : null,
        operation, dataset, requested_at_ms: now(), events: []
      };
      attempts.set(id, attempt);
      latest = id;
      publish(attempt, 'requested');
      return id;
    },
    unsupported(id, reason) {
      const attempt = get(id);
      if (attempt.status !== 'requested') throw new Error('Attempt already invoked or terminal');
      return publish(attempt, 'unsupported', { reason: String(reason || 'Unsupported input') });
    },
    async run(id, compute) {
      const attempt = get(id);
      if (attempt.status !== 'requested') throw new Error('Attempt already invoked or terminal');
      if (!attempt.location) return publish(attempt, 'unsupported', { reason: 'No valid project location' });
      if (typeof compute !== 'function') return publish(attempt, 'failed', { reason: 'No computation callback' });
      publish(attempt, 'started');
      try {
        const result = await compute(copy(attempt));
        if (!sameLocation(result?.origin, attempt.location)) throw new Error('Result origin does not match this request');
        if (!sameEntity(result?.entity, attempt.entity)) throw new Error('Result entity does not match this request');
        if (!Array.isArray(result.measurements)) throw new Error('Computation returned no measurements array');
        if (result.measurements.length === 0) {
          if (result.search_completed !== true || !Number.isInteger(result.scanned_count) || result.scanned_count < 0) {
            throw new Error('Empty result lacks completed-search and scanned-count evidence');
          }
          return publish(attempt, 'completed_empty', { measurements: [],
            summary: { measured_count: 0, scanned_count: result.scanned_count, nearest_km: null } });
        }
        const measurements = result.measurements.map(row => {
          if (!row || row.node_id == null || !String(row.node_id).trim()
              || !located(row) || !finite(row.km) || row.km < 0) {
            throw new Error('Computation returned an invalid grid measurement');
          }
          const expected = distanceKm(attempt.location.lon, attempt.location.lat, row.lon, row.lat);
          // Receipts carry unrounded values from the shared geodesy, not UI text.
          if (Math.abs(expected - row.km) > Math.max(1e-6, expected * 1e-9)) {
            throw new Error('Grid distance does not match the request and measured node');
          }
          return { node_id: String(row.node_id), lon: row.lon, lat: row.lat, km: row.km };
        });
        return publish(attempt, 'completed', { measurements,
          summary: { measured_count: measurements.length, nearest_km: Math.min(...measurements.map(row => row.km)) } });
      } catch (error) {
        return publish(attempt, 'failed', { reason: String(error?.message || error) });
      }
    },
    snapshot(id = latest) { return id == null ? null : copy(get(id)); },
    assess(id, expected) {
      if (!attempts.has(id)) return { passed: false, reason: 'never-requested' };
      const attempt = get(id);
      if (id !== latest) return { passed: false, reason: 'stale-attempt' };
      if (!sameEntity(attempt.entity, expected?.entity) || !sameLocation(attempt.location, expected?.location)) {
        return { passed: false, reason: 'selection-mismatch' };
      }
      return { passed: attempt.status === 'completed', reason: attempt.status };
    }
  };
}

/** Honest UI projection of computation receipts. No inference from a URL. */
function describeComputeReceipt(receipt) {
  const status = receipt?.status || 'not_requested';
  const summary = receipt?.summary;
  const nearest = summary?.nearest_km;
  const labels = {
    not_requested: 'Grid calculation not requested', requested: 'Grid calculation queued',
    started: 'Calculating nearest mapped substations', completed_empty: 'Search completed: no mapped substations returned',
    unsupported: 'Grid calculation unavailable', failed: 'Grid calculation failed',
  };
  if (status === 'completed' && Number.isFinite(nearest) && nearest >= 0) {
    return { status, text: `Nearest mapped substation: ${nearest.toFixed(2)} km`,
      distance_km: nearest, unit: 'km', scope: 'Geometric screening only; not an electrical connection, capacity or offer.' };
  }
  return { status, text: labels[status] || 'Grid calculation result unavailable',
    reason: receipt?.reason || null, distance_km: null, unit: null,
    scope: 'Geometric screening only; not an electrical connection, capacity or offer.' };
}

globalThis.VentusGridCompute = Object.freeze({ schema, distanceKm, createComputeObserver, describeComputeReceipt });
})();
