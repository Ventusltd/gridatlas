// SPDX-License-Identifier: Apache-2.0
// The Bristol extract has section IDs and shapes but no cross-path junction IDs.
const COUNCIL_LAYER = 'https://maps2.bristol.gov.uk/server2/rest/services/ext/ll_transport/MapServer/0';
const SNAP_M = 12;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const valid = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
  && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
const unavailable = reason => ({ status: 'unavailable', reason });

function readSections(collection) {
  if (collection?.type !== 'FeatureCollection' || collection.source?.url !== COUNCIL_LAYER
      || !Array.isArray(collection.features) || collection.features.length > 2000) {
    throw new Error('Invalid Bristol footpath source');
  }
  const routes = new Map();
  const seen = new Set();
  let pointCount = 0;
  for (const feature of collection.features) {
    const props = feature?.properties;
    if (props?.STATUS !== 'FP' || feature.geometry?.type !== 'LineString') continue;
    const match = /^(BCC\/[0-9A-Z]+)\/(\d+)$/.exec(props.ROUTE_CODE);
    if (!match) continue;
    const [, route, digits] = match;
    const sequence = Number(digits);
    const key = route + '/' + sequence;
    if (seen.has(key)) throw new Error('Duplicate footpath section');
    seen.add(key);
    const points = feature.geometry.coordinates;
    pointCount += points?.length || 0;
    if (pointCount > 20000 || !Array.isArray(points) || points.length < 2 || !points.every(valid)) {
      throw new Error('Invalid footpath geometry');
    }
    if (!routes.has(route)) routes.set(route, []);
    routes.get(route).push({ route, code: props.ROUTE_CODE, sequence, points: points.map(p => [...p]) });
  }
  return routes;
}

function consecutive(a, b) {
  return a && b && b.sequence === a.sequence + 10;
}

function chainsFor(routes, maths) {
  const chains = [];
  for (const sections of routes.values()) {
    sections.sort((a, b) => a.sequence - b.sequence);
    let chain, last;
    for (const [i, section] of sections.entries()) {
      let points = section.points;
      const first = points[0], end = points.at(-1);
      if (consecutive(sections[i - 1], section) && (same(last, first) || same(last, end))) {
        if (same(last, end)) points = [...points].reverse();
      } else {
        chain = { route: section.route, segments: [], lengthM: 0 };
        chains.push(chain);
        const next = sections[i + 1];
        if (consecutive(section, next)
            && (same(first, next.points[0]) || same(first, next.points.at(-1)))) {
          points = [...points].reverse();
        }
      }
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1], b = points[j];
        if (same(a, b)) continue;
        const lengthM = maths.distanceKm(...a, ...b) * 1000;
        if (!Number.isFinite(lengthM) || lengthM <= 0 || lengthM > 1000) throw new Error('Unsupported footpath segment');
        chain.segments.push({ a, b, first: j === 1, last: j === points.length - 1,
          code: section.code, startM: chain.lengthM, lengthM });
        chain.lengthM += lengthM;
      }
      last = points.at(-1);
    }
  }
  return chains;
}

function locate(point, chains, maths) {
  if (!valid(point)) return unavailable('invalid-point');
  const hits = [];
  for (const chain of chains) {
    for (const seg of chain.segments) {
      const hit = maths.distanceToSegmentKm(...point, ...seg.a, ...seg.b);
      const offsetM = hit.km * 1000;
      if (offsetM <= SNAP_M) {
        let junction = null;
        if (seg.first && hit.t === 0) junction = seg.a;
        if (seg.last && hit.t === 1) junction = seg.b;
        hits.push({ chain, offsetM, point: junction ?? hit.foot, junction, atM: seg.startM + hit.t * seg.lengthM });
      }
    }
  }
  hits.sort((a, b) => a.offsetM - b.offsetM);
  const best = hits[0];
  if (!best) return unavailable('outside-coverage');
  const positions = new Map();
  for (const h of hits) {
    if (h.offsetM > best.offsetM + 1) break;
    const prior = positions.get(h.chain);
    if (prior && Math.abs(h.atM - prior.atM) > 3) return unavailable('ambiguous-tap');
    if (!prior) positions.set(h.chain, h);
  }
  // A tap on a shared section endpoint can belong to either recorded path.
  // Intersecting or closely parallel shapes elsewhere provide no junction evidence.
  if (positions.size > 1 && [...positions.values()].some(h =>
    !best.junction || !h.junction || !same(h.junction, best.junction))) return unavailable('ambiguous-tap');
  return { positions };
}

// The caller supplies the pinned Ventus distanceKm/distanceToSegmentKm functions.
// Pins select positions on the mapped line. The measured GPS fix stays independent.
export function createBristolFootpathRouter(collection, maths) {
  return createMappedFootpathRouter(readSections(collection), maths, COUNCIL_LAYER);
}

// A source-specific reader must have verified foot access, chain membership
// and section order before passing its mapped sections to the shared clipper.
export function createMappedFootpathRouter(sections, maths, source) {
  const chains = chainsFor(sections, maths);
  return function route(from, to, excludedSections = []) {
    if (!Array.isArray(excludedSections) || !excludedSections.every(x => typeof x === 'string')) {
      return unavailable('invalid-closures');
    }
    const blocked = new Set(excludedSections);
    const fromHits = locate(from, chains, maths);
    if (fromHits.status) return fromHits;
    const toHits = locate(to, chains, maths);
    if (toHits.status) return toHits;
    const shared = [...fromHits.positions.keys()].filter(chain => toHits.positions.has(chain));
    if (!shared.length) return unavailable('no-mapped-connection');
    if (shared.length > 1) return unavailable('ambiguous-tap');
    const start = fromHits.positions.get(shared[0]), finish = toHits.positions.get(shared[0]);
    const reverse = finish.atM < start.atM;
    const [lo, hi] = reverse ? [finish, start] : [start, finish];
    if (hi.atM - lo.atM < 0.01) return unavailable('same-position');
    const coordinates = [[...lo.point]];
    const sectionCodes = [];
    for (const seg of lo.chain.segments) {
      const endM = seg.startM + seg.lengthM;
      if (endM <= lo.atM || seg.startM >= hi.atM) continue;
      if (blocked.has(seg.code)) return unavailable('excluded-section');
      if (sectionCodes.at(-1) !== seg.code) sectionCodes.push(seg.code);
      if (endM < hi.atM) coordinates.push([...seg.b]);
    }
    coordinates.push([...hi.point]);
    if (reverse) {
      coordinates.reverse();
      sectionCodes.reverse();
    }
    return {
      status: 'mapped',
      route: start.chain.route,
      sectionCodes,
      geometry: { type: 'LineString', coordinates },
      distanceM: hi.atM - lo.atM,
      fromOffsetM: start.offsetM,
      toOffsetM: finish.offsetM,
      currentAccess: 'unverified',
      source,
    };
  };
}
