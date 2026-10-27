const MIN_KV=33, LINK_COUNT=5, MAX_LINK_KM=40;
function distanceKm(a,b,c,d){return window.__GRIDATLAS_MODULES__.geodesy.distanceKm(a,b,c,d)}
function worksAt(){return null}
  function voltagesKv(properties) {
    const out = [];
    const push = (raw, divisor) => {
      for (const token of String(raw ?? '').split(/[;,|:\s]+/)) {
        if (!token) continue;
        const value = Number(token);
        if (!Number.isFinite(value) || value <= 0) continue;
        out.push(value / divisor);
      }
    };
    // OSM `voltage` is volts. Always, at every magnitude.
    push(properties?.voltage, 1000);
    // An explicit `kv` is already kilovolts.
    if (!out.length) push(properties?.kv, 1);
    return out;
  }
  function representativePoint(geometry) {
    if (!geometry) return null;
    const { type, coordinates } = geometry;
    if (type === 'Point') return [coordinates[0], coordinates[1]];
    const ring = type === 'Polygon' ? coordinates[0]
      : type === 'MultiPolygon' ? coordinates[0]?.[0] : null;
    if (!Array.isArray(ring) || !ring.length) return null;
    let x = 0; let y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    return [x / ring.length, y / ring.length];
  }
  function nearestSubstations(lon, lat, subs) {
    const scored = [];
    /* Beyond MAX_LINK_KM nothing is drawn, and that stays true. What changes is
       that the nearest one is still measured. Returning an empty list with a
       null distance says "no grid data here", when the fact is "the nearest
       mapped substation is further than the draw radius" - a different
       statement, and the only true one. Measured on Bowdun, Hornsea 3 and
       Berwick Bank, which each resolve and map correctly and then report
       nothing at all.

       This follows the reasoning already written into the offshore branch of
       this file: the distance to the nearest mapped substation is a measurement
       of a real thing, and withholding it was over-caution. */
    let beyond = null;
    for (const sub of subs) {
      const km = distanceKm(lon, lat, sub.at[0], sub.at[1]);
      if (km > MAX_LINK_KM) {
        if (!beyond || km < beyond.km) beyond = { ...sub, km };
        continue;
      }
      scored.push({ ...sub, km });
    }
    scored.sort((a, b) => a.km - b.km);
    const result = scored.slice(0, LINK_COUNT);
    // Carried on the array so no caller has to change shape to read it.
    result.beyondRadiusNearest = result.length ? null : beyond;
    result.radiusKm = MAX_LINK_KM;
    return result;
  }
  function nearestTransmission(origin, subs) {
    let best = null;
    let bestNamed = null;
    /* The size of the sample this superlative is drawn from. Counted here
       rather than recounted by a caller, because the predicate below is
       what decides eligibility and a second implementation of it would
       drift from this one. */
    let considered = 0;
    for (const s of (Array.isArray(subs) ? subs : [])) {
      if (!(Array.isArray(s.kv) && s.kv[0] >= 400)) continue;
      considered += 1;
      const km = distanceKm(origin[0], origin[1], s.at[0], s.at[1]);
      if (!best || km < best.km) {
        best = { name: s.name || 'Unnamed substation', km, at: s.at };
      }
      if (s.name && (!bestNamed || km < bestNamed.km)) {
        bestNamed = { name: s.name, km, at: s.at };
      }
    }
    if (best) {
      best.considered = considered;
      best.works = worksAt(best.name);
      if (bestNamed && bestNamed.name !== best.name) {
        best.named = bestNamed;
        best.named.works = worksAt(bestNamed.name);
      }
    }
    return best;
  }
globalThis.__x={voltagesKv,representativePoint,nearestSubstations,nearestTransmission};