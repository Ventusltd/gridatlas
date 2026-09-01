/**
 * Module: grid-scope
 *
 * "When you click on a blank space, the user should be able to see grid in
 * the vicinity. Call it the GRID FINDING SCOPE — analysis of what is
 * there, NOT indicative of capacity." — Vikram, 2026-09-01.
 *
 * So this answers exactly one question: WHAT IS MAPPED HERE. It counts
 * what the served payload contains around a point, by voltage class and
 * by distance band, and names the nearest few. It is a census of the map,
 * not a study of the network.
 *
 * WHAT IT WILL NOT DO, EVER
 * It does not say whether a connection is available, likely, cheap or
 * possible. Nothing in a payload of substation positions can support any
 * of that: capacity depends on queue position, committed connections,
 * thermal and fault headroom, consent and commercial terms, and none of
 * those is a distance. A scope that counted substations and implied
 * opportunity would be the most dangerous thing this estate could ship,
 * because it would look like analysis.
 *
 * Pure. No DOM, no network, no state. Depends on: geodesy.
 */
(() => {
  'use strict';

  const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  if (NS.gridScope) return;

  const geodesy = NS.geodesy;
  if (!geodesy) throw new Error('grid-scope requires the geodesy module');

  /* Bands, not a single radius. A reader asking "what is around here"
     wants the shape of the answer - is the nearest thing on top of me or
     twenty kilometres away - and one number hides that. */
  const DEFAULT_BANDS_KM = [2, 5, 10, 25];
  const CLASSES_KV = [400, 275, 220, 132, 66, 33];

  /* A voltage is classified ONLY as a class it actually is.
     ------------------------------------------------------------------
     The first version walked the classes and returned the first one the
     value exceeded, so it labelled 750 kV as 400, 110 kV as 66 and 50 kV
     as 33 - a false label on anything the list does not contain, which is
     exactly the sort of quiet relabelling this estate exists to avoid.
     Codex caught it on the committed module before it reached a card
     (stop-ship 202609012025).

     Now: membership, within a tolerance for the fractions OSM carries.
     Anything else is UNCLASSIFIED and counted as such, because a voltage
     the standard classes do not contain is a fact about the data, not a
     value to be rounded into the nearest familiar number. */
  const CLASS_TOLERANCE_KV = 0.5;

  function classOf(kv) {
    if (!Number.isFinite(kv)) return null;
    for (const known of CLASSES_KV) {
      if (Math.abs(kv - known) <= CLASS_TOLERANCE_KV) return known;
    }
    return null;
  }

  /**
   * @param origin [lon, lat]
   * @param substations  [{ at:[lon,lat], kv:[numbers], name, operator }]
   * @param options { bandsKm, minimumKv, nearestCount }
   */
  function scope(origin, substations, options) {
    const bandsKm = (options && options.bandsKm) || DEFAULT_BANDS_KM;
    const minimumKv = (options && options.minimumKv) || 0;
    const nearestCount = (options && options.nearestCount) || 5;
    const maximumKm = bandsKm[bandsKm.length - 1];

    const within = [];
    for (const substation of substations || []) {
      if (!substation || !Array.isArray(substation.at)) continue;
      const voltages = Array.isArray(substation.kv) ? substation.kv : [];
      const top = voltages.length ? Math.max(...voltages) : 0;
      if (top < minimumKv) continue;
      const km = geodesy.distanceKm(origin[0], origin[1],
        substation.at[0], substation.at[1]);
      if (km > maximumKm) continue;
      within.push({
        name: substation.name || '',
        operator: substation.operator || '',
        kv: top,
        class_kv: classOf(top),
        km,
        at: substation.at
      });
    }
    within.sort((a, b) => a.km - b.km);

    const bands = bandsKm.map((band) => {
      const inBand = within.filter(entry => entry.km <= band);
      const counts = {};
      let unclassified = 0;
      const unclassifiedKv = [];
      for (const entry of inBand) {
        if (entry.class_kv == null) {
          // Counted, never folded into a class it is not.
          unclassified += 1;
          if (Number.isFinite(entry.kv) && !unclassifiedKv.includes(entry.kv)) {
            unclassifiedKv.push(entry.kv);
          }
          continue;
        }
        counts[entry.class_kv] = (counts[entry.class_kv] || 0) + 1;
      }
      const highest = inBand.reduce(
        (best, entry) => (entry.class_kv != null && (best == null || entry.class_kv > best)
          ? entry.class_kv : best), null);
      return {
        within_km: band,
        substations: inBand.length,
        by_class_kv: counts,
        highest_class_kv: highest,
        unclassified_voltage: unclassified,
        unclassified_kv: unclassifiedKv.sort((a, b) => b - a)
      };
    });

    /* Named first, because an unnamed OSM node is a fact about the map
       rather than a place anyone can look up. Both are reported: the
       nearest thing, and the nearest thing with an identity. */
    const named = within.filter(entry => entry.name);
    return {
      schema: 'gridatlas.grid-scope.v1',
      origin: [origin[0], origin[1]],
      radius_km: maximumKm,
      minimum_kv: minimumKv,
      counted: within.length,
      bands,
      nearest: within.slice(0, nearestCount),
      nearest_named: named.slice(0, nearestCount),
      nearest_transmission: within.find(entry => entry.kv >= 275 - 0.5) || null,
      /* Carried in the result itself so it cannot be separated from the
         numbers by a renderer, a screenshot or a quote. */
      what_this_is: 'A census of the substations in the served map payload '
        + 'around this point, by voltage class and distance band.',
      what_this_is_not: 'Not a statement about capacity, headroom, '
        + 'availability or the cost of connecting here. Distance is not '
        + 'capacity: queue position, committed connections, thermal and '
        + 'fault headroom, consent and commercial terms decide that, and '
        + 'none of them is in this payload.',
      method: 'haversine on a single Earth radius of '
        + geodesy.EARTH_RADIUS_KM + ' km, straight line to mapped geometry'
    };
  }

  NS.gridScope = Object.freeze({
    schema: 'gridatlas.module.grid-scope.v2',
    CLASS_TOLERANCE_KV,
    DEFAULT_BANDS_KM,
    CLASSES_KV,
    classOf,
    scope
  });
})();
