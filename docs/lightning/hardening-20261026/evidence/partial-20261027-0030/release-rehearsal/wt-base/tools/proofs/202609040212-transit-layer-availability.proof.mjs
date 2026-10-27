import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const OLD_PART = 'atlas/parts/202609040045-ventus-corev8engine-deep-link-receiver.js';
const NEW_PART = 'atlas/parts/202609040212-ventus-corev8engine-layer-availability.js';
const OWNER_GENERATION = '202608291237-data-gridatlas';
const OWNER_COMMIT = '32459230b958ff6ddbdb24365f56da83ab1cdc93';
const OWNER_BASE = `https://ventusltd.github.io/data-gridatlas/${OWNER_GENERATION}`;
const PARTITION_PATH = 'data/partitions/uk_metros_trams_root.parquet';
const PARTITION_BYTES = 1_411_687;
const PARTITION_SHA256 = '49d46beb139b22afdd4e64bdbcf550f53b6a1bd09910d27e7174e5d1761c4c7a';
const RELEASE_BYTES = 18_333;
const RELEASE_SHA256 = '19684ac3e86fac4346fab121a948bab0aa857108564fec5be242484d2baefd06';
const REGISTRY_BYTES = 64_993;
const REGISTRY_SHA256 = '9b2169bcfd47bf51f0aaf8350487de19578e32358e191b961385a149a4637e1b';
const OLD_PART_BYTES = 92_388;
const OLD_PART_SHA256 = 'b1da9baca77c7ddc1b45ce3396c60d1da17e38fdf4faa0a5fc70ea1639a92dfc';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function publicBytes(path) {
  const response = await fetch(`${OWNER_BASE}/${path}`, { cache: 'no-store' });
  assert.equal(response.status, 200, `${path} public response`);
  return Buffer.from(await response.arrayBuffer());
}

const oldPartBytes = await readFile(join(REPO, OLD_PART));
const newPartSource = await readFile(join(REPO, NEW_PART), 'utf8');
assert.equal(oldPartBytes.length, OLD_PART_BYTES, 'historical receiver byte count is immutable');
assert.equal(sha256(oldPartBytes), OLD_PART_SHA256, 'historical receiver hash is immutable');
assert.match(newPartSource, /updateTransitSourceStates\(TRANSIT_SOURCE_MAP\[layerId\], features\)/,
  'successfully fetched transit bytes are classified before the UI reports success');
assert.doesNotMatch(newPartSource,
  /TRANSIT_IDS\.forEach\(tid => \{ if \(TRANSIT_SOURCE_MAP\[tid\].+updateUIState\(tid, 'OK'\)/,
  'the shared-source fast path no longer calls every sibling OK');

const releaseBytes = await publicBytes('release.json');
assert.equal(releaseBytes.length, RELEASE_BYTES, 'public owner release byte count');
assert.equal(sha256(releaseBytes), RELEASE_SHA256, 'public owner release is the audited immutable release');
const ownerRelease = JSON.parse(releaseBytes.toString('utf8'));
const partitionEntry = ownerRelease.files.find((entry) => entry.path === PARTITION_PATH);
assert.deepEqual(
  { bytes: partitionEntry?.bytes, sha256: partitionEntry?.sha256 },
  { bytes: PARTITION_BYTES, sha256: PARTITION_SHA256 },
  'owner release binds the deployed metro/tram partition'
);
const registryEntry = ownerRelease.files.find((entry) => entry.path === 'browser-layer-registry.json');
assert.deepEqual(
  { bytes: registryEntry?.bytes, sha256: registryEntry?.sha256 },
  { bytes: REGISTRY_BYTES, sha256: REGISTRY_SHA256 },
  'owner release binds the browser layer registry'
);

const [partitionBytes, registryBytes] = await Promise.all([
  publicBytes(PARTITION_PATH),
  publicBytes('browser-layer-registry.json')
]);
assert.equal(partitionBytes.length, PARTITION_BYTES, 'deployed partition byte count');
assert.equal(sha256(partitionBytes), PARTITION_SHA256, 'deployed partition exact hash');
assert.equal(registryBytes.length, REGISTRY_BYTES, 'deployed registry byte count');
assert.equal(sha256(registryBytes), REGISTRY_SHA256, 'deployed registry exact hash');

const registry = JSON.parse(registryBytes.toString('utf8'));
assert.equal(registry.generation, OWNER_GENERATION, 'registry generation');
assert.equal(registry.classification, 'LIVE_IMMUTABLE_DATA_RELEASE', 'registry is the live immutable owner release');
const ownerLayers = registry.groups.flatMap((group) => group.layers);
for (const id of ['dlr', 'metro', 'tram']) {
  const layer = ownerLayers.find((entry) => entry.id === id);
  assert.ok(layer, `${id} is present in the owner registry`);
  assert.equal(layer.type, 'point', `${id} is configured as a point layer`);
  assert.equal(layer.v9_data.parquet_path, 'partitions/uk_metros_trams_root.parquet', `${id} uses the audited partition`);
  assert.equal(layer.v9_data.disposition, 'QUARANTINED_GEOMETRY_MISMATCH', `${id} remains quarantined`);
  assert.equal(layer.v9_data.candidate_enabled, false, `${id} is not enabled as a v9 data candidate`);
  assert.equal(layer.v9_data.candidate_publishable, false, `${id} is not published as a v9 data candidate`);
}

const start = newPartSource.indexOf('    function transitExpressionValue(');
const end = newPartSource.indexOf('    async function hydrateLayer(', start);
assert.ok(start >= 0 && end > start, 'availability implementation has extractable boundaries');
const subjectSource = newPartSource.slice(start, end);

const layerConfigs = new Map([
  ['dlr', { filter: ['all', ['in', 'Docklands', ['get', 'operator']], ['!', ['in', 'London Underground', ['get', 'operator']]]] }],
  ['metro', { filter: ['any', ['in', 'Tyne', ['get', 'operator']], ['in', 'Metrolink', ['get', 'operator']]] }],
  ['tram', { filter: ['all', ['==', ['get', 'type'], 'Tram / Light Rail'], ['!', ['in', 'London Underground', ['get', 'operator']]]] }]
]);
const mapTypes = { dlr: 'circle', metro: 'circle', tram: 'circle' };
const controls = Object.fromEntries(['dlr', 'metro', 'tram'].map((id) => [id,
  [{ checked: true, disabled: false }, { checked: true, disabled: false }]]));
const layoutWrites = [];
const uiWrites = [];
const box = {
  console,
  Map,
  Array,
  Object,
  String,
  TRANSIT_IDS: ['dlr', 'metro', 'tram'],
  TRANSIT_SOURCE_MAP: { dlr: 'src-metros', metro: 'src-metros', tram: 'src-metros' },
  RUNTIME_STATE: Object.fromEntries(['dlr', 'metro', 'tram'].map((id) => [id,
    { loaded: false, loading: true, status: 'LOAD' }])),
  getLayerConfig: (id) => layerConfigs.get(id),
  map: {
    getLayer: (id) => mapTypes[id.replace(/^l-/, '')] ? { type: mapTypes[id.replace(/^l-/, '')] } : null,
    setLayoutProperty: (id, property, value) => layoutWrites.push({ id, property, value })
  },
  document: {
    querySelectorAll: (selector) => controls[selector.match(/data-layer-id="([^"]+)"/)?.[1]] || []
  },
  updateUIState: (id, state) => {
    box.RUNTIME_STATE[id].status = state;
    uiWrites.push({ id, state });
  },
  _visibleInteractiveIds: ['l-dlr', 'l-metro', 'l-tram'],
  _visibleHoverIds: ['l-dlr', 'l-metro', 'l-tram']
};
vm.createContext(box);
vm.runInContext(`${subjectSource}\nthis.subject = { transitFilterMatches, geometryFitsMapLayer, countTransitFeaturesLayerCanDraw, updateTransitSourceStates };`,
  box, { filename: NEW_PART });

const retainedProjectionFixture = [
  { geometry: { type: 'LineString', coordinates: [[-0.1, 51.5], [-0.08, 51.51]] }, properties: { operator: 'Docklands Light Railway' } },
  { geometry: { type: 'LineString', coordinates: [[-2.2, 53.4], [-2.1, 53.5]] }, properties: { operator: 'Manchester Metrolink' } },
  { geometry: { type: 'LineString', coordinates: [[-1.5, 53.3], [-1.4, 53.4]] }, properties: { type: 'route' } }
];
assert.equal(retainedProjectionFixture.some((feature) => 'railway' in feature.properties), false,
  'fixture reflects the deployed projection: railway is not retained');
box.subject.updateTransitSourceStates('src-metros', retainedProjectionFixture);

for (const id of ['dlr', 'metro', 'tram']) {
  assert.deepEqual(
    { loaded: box.RUNTIME_STATE[id].loaded, loading: box.RUNTIME_STATE[id].loading, status: box.RUNTIME_STATE[id].status },
    { loaded: true, loading: false, status: 'EMPTY' },
    `${id} reports EMPTY when its circle layer cannot draw the retained LineStrings`
  );
  assert.equal(controls[id].every((control) => !control.checked && control.disabled), true,
    `${id} controls are unchecked and disabled`);
  assert.ok(layoutWrites.some((write) => write.id === `l-${id}` && write.property === 'visibility' && write.value === 'none'),
    `${id} is hidden after the empty verdict`);
}
assert.deepEqual(box._visibleInteractiveIds, [], 'unavailable transit layers leave the click cache');
assert.deepEqual(box._visibleHoverIds, [], 'unavailable transit layers leave the hover cache');
assert.equal(uiWrites.every((write) => write.state === 'EMPTY'), true, 'no quarantined layer is called OK');

const pointDlr = { geometry: { type: 'Point', coordinates: [-0.1, 51.5] }, properties: { operator: 'Docklands Light Railway' } };
assert.equal(box.subject.countTransitFeaturesLayerCanDraw('dlr', [pointDlr]), 1,
  'a compatible feature matching the configured filter remains available');
assert.equal(box.subject.countTransitFeaturesLayerCanDraw('metro', [pointDlr]), 0,
  'the filter still separates a compatible DLR feature from Metro');
assert.equal(box.subject.geometryFitsMapLayer('line', 'LineString'), true, 'line/LineString compatibility');
assert.equal(box.subject.geometryFitsMapLayer('circle', 'LineString'), false, 'circle/LineString incompatibility');
assert.equal(box.subject.transitFilterMatches(['future-expression'], pointDlr), true,
  'unknown future expressions cannot be used as evidence to disable a layer');

console.log(JSON.stringify({
  status: 'PASS',
  owner_commit: OWNER_COMMIT,
  owner_generation: OWNER_GENERATION,
  deployed_partition: {
    url: `${OWNER_BASE}/${PARTITION_PATH}`,
    bytes: partitionBytes.length,
    sha256: sha256(partitionBytes)
  },
  owner_disposition: 'QUARANTINED_GEOMETRY_MISMATCH',
  runtime_verdict: Object.fromEntries(['dlr', 'metro', 'tram'].map((id) => [id, box.RUNTIME_STATE[id].status])),
  historical_part_preserved: { path: OLD_PART, bytes: oldPartBytes.length, sha256: sha256(oldPartBytes) }
}, null, 2));
