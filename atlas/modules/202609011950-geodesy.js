/**
 * Module: geodesy
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
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.geodesy) return;

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

  NS.geodesy = Object.freeze({
    schema: 'gridatlas.module.geodesy.v1',
    EARTH_RADIUS_KM,
    distanceKm,
    representativePoint,
    voltagesKv
  });
})();
