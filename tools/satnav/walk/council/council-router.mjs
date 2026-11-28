// Local, fixed council extracts. No endpoint or GPS fix is sent to a provider.
import { createBristolFootpathRouter, createMappedFootpathRouter } from './mapped-footpaths.mjs';

const SURREY_PAGE = 'https://www.surreycc.gov.uk/culture-and-leisure/countryside/management/footpaths-byways-and-bridleways/rights-of-way/open-data';
const BRISTOL_NOTICES = 'https://www.bristol.gov.uk/residents/streets-travel/highways/roadworks-road-closures-and-temporary-traffic-regulation-orders-ttros/temporary-traffic-regulation-order-ttros-notices';
const SURREY_ARCHIVE_HASH = 'e2ad1dfaecb0e522172af916f3ebbd4fde8c606fdb87f142a696c6bce97f6fdf';
const packs = [
  ['bristol', 'bristol-footpaths.geojson', '4b2b7af898c7e1cb617af7266e31bea960c22a4fc5e3fe08fcbe6e09338dcfd6'],
  ['mickleham', 'mickleham-footpaths-20260907.geojson', '10d9167fa8a38809a33dd77e30b1731af938d17f236e5231a61f3a12f393280c'],
];

function readMicklehamSections(pack) {
  if (pack?.schema !== 'ventus.surrey-footpath-pack.v1' || pack.type !== 'FeatureCollection'
      || pack.source !== SURREY_PAGE || pack.archiveSha256 !== SURREY_ARCHIVE_HASH
      || !Array.isArray(pack.features) || pack.features.length > 39) {
    throw new Error('Invalid Mickleham footpath source');
  }
  const chains = new Map();
  const ids = new Set();
  let pointCount = 0;
  for (const feature of pack.features) {
    const p = feature.properties;
    if (p?.accessCode !== '01' || feature.geometry?.type !== 'LineString') continue;
    const points = feature.geometry.coordinates;
    if (!Number.isSafeInteger(feature.id) || ids.has(feature.id) || !/^\d+[A-Z]?$/.test(p.footpath)
        || !/^j\d+$/.test(p.chain) || !Number.isSafeInteger(p.position) || p.position < 0
        || typeof p.forward !== 'boolean' || !Array.isArray(points) || points.length < 2) {
      throw new Error('Invalid Mickleham footpath section');
    }
    ids.add(feature.id);
    pointCount += points.length;
    if (pointCount > 20000 || !points.every(at => Array.isArray(at) && at.length === 2 && at.every(Number.isFinite)
        && at[0] > -0.5 && at[0] < 0 && at[1] > 51 && at[1] < 52)) throw new Error('Invalid Mickleham geometry');

    // Chain IDs and positions come from exact original British National Grid
    // endpoints on this numbered path. Separate components keep separate IDs.
    const key = p.footpath + '/' + p.chain;
    if (!chains.has(key)) chains.set(key, []);
    const coords = points.map(at => [...at]);
    chains.get(key).push({
      route: 'Mickleham FP ' + p.footpath, code: 'Mickleham/' + feature.id,
      sequence: p.position * 10, points: p.forward ? coords : coords.reverse(),
    });
  }
  return chains;
}

export function createPedestrianRouter({ bristol, mickleham }, maths) {
  const providers = [];
  if (bristol) providers.push({
    route: createBristolFootpathRouter(bristol, maths), attribution: bristol.source.attribution,
    licence: bristol.source.licence, coverage: bristol.source.coverage, closureNotices: BRISTOL_NOTICES,
  });
  if (mickleham) providers.push({
    route: createMappedFootpathRouter(readMicklehamSections(mickleham), maths, SURREY_PAGE),
    attribution: mickleham.attribution, licence: mickleham.licence,
    coverage: 'Mickleham public footpaths, 7 September 2026', closureNotices: mickleham.closureNotices,
  });
  return function findFootpath(from, to, excludedSections = []) {
    for (const { route, ...publication } of providers) {
      const result = route(from, to, excludedSections);
      if (result.status === 'mapped') return { ...result, ...publication };
      if (result.reason !== 'outside-coverage') return result;
    }
    return { status: 'unavailable', reason: providers.length ? 'outside-coverage' : 'footpath-data-unavailable' };
  };
}

/** Read static site assets. A missing or corrupt pack does not disable other areas. */
export async function loadPedestrianRouter(maths) {
  const loaded = await Promise.allSettled(packs.map(async ([name, file, expected]) => {
    const response = await fetch(new URL(file, import.meta.url), { credentials: 'omit' });
    if (!response.ok) throw new Error('Footpath data unavailable');
    const bytes = await response.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const actual = [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new Error('Footpath data differs from the published extract');
    return [name, JSON.parse(new TextDecoder().decode(bytes))];
  }));
  const available = Object.fromEntries(loaded.filter(result => result.status === 'fulfilled').map(result => result.value));
  return createPedestrianRouter(available, maths);
}
