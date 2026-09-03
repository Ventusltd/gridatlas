import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  coverageBoundary,
  classifyProjectTechnology,
  createDistanceFinding,
  createScopedDistanceFinding,
  createFindingLoop,
  createGridFindingEngine,
  createProjectIndex,
  createProjectArrivalAdapter,
  createProjectRegister,
  createProjectRegisterFromDocument,
  createRoadRouteFinding,
  createCorridorEstimateFinding,
  createSelectionStore,
  decodeSelection,
  encodeSelection,
  haversineR6378137Km,
  validateAnySelection,
  validateCoordinateSelection,
  validateSelection,
  validateSubstationSelection,
  validateFinding,
  validateProvenance,
  nearbyProjects,
  orderCandidates,
  parseProjectDeepLink,
  projectFindingRequest,
  PROJECT_TECHNOLOGIES,
  resolveNearestCandidate
} from './finding-loop.mjs';

let checks = 0;
function check(label, condition) {
  checks += 1;
  if (!condition) throw new Error(`FAIL: ${label}`);
}
function rejects(label, value) {
  let rejected = false;
  try { validateSelection(value); } catch { rejected = true; }
  check(label, rejected);
}

const digest = 'a'.repeat(64);
const evidence = Object.freeze({
  source_id: 'test_fixture', release: 'fixture-v1', sha256: digest, bytes: 12
});
const accepted = validateSelection({
  kind: 'project',
  repd_ref: '13599',
  source_release: digest
});
check('exact project selection is accepted', accepted.repd_ref === '13599');
check('accepted selection is immutable', Object.isFrozen(accepted));
check('canonical output has exactly three fields', Object.keys(accepted).join(',') === 'kind,repd_ref,source_release');

rejects('missing repd_ref is rejected', { kind: 'project', source_release: digest });
rejects('empty repd_ref is rejected', { kind: 'project', repd_ref: '', source_release: digest });
rejects('whitespace-changing repd_ref is rejected', { kind: 'project', repd_ref: ' 13599 ', source_release: digest });
rejects('control characters are rejected', { kind: 'project', repd_ref: '13599\n', source_release: digest });
rejects('wrong kind is rejected', { kind: 'location', repd_ref: '13599', source_release: digest });
rejects('short source release is rejected', { kind: 'project', repd_ref: '13599', source_release: 'abc' });
rejects('uppercase source release is rejected', { kind: 'project', repd_ref: '13599', source_release: 'A'.repeat(64) });
rejects('extra coordinates are rejected', { kind: 'project', repd_ref: '13599', source_release: digest, latitude: 52 });
rejects('accessor fields are rejected', Object.defineProperties({}, {
  kind: { value: 'project', enumerable: true },
  repd_ref: { get() { return '13599'; }, enumerable: true },
  source_release: { value: digest, enumerable: true }
}));
rejects('arrays are rejected', ['project', '13599', digest]);

const location = validateCoordinateSelection({
  kind: 'location', longitude: -1.5, latitude: 52.4, coordinate_origin: 'user_input'
});
check('coordinate-only selection is accepted', location.kind === 'location');
check('coordinate-only selection carries no asset identity',
  !Object.hasOwn(location, 'repd_ref') && !Object.hasOwn(location, 'site_code'));
check('coordinate output is immutable', Object.isFrozen(location));
for (const [label, value] of [
  ['out-of-range longitude is rejected', { kind: 'location', longitude: 181, latitude: 0, coordinate_origin: 'user_input' }],
  ['out-of-range latitude is rejected', { kind: 'location', longitude: 0, latitude: 91, coordinate_origin: 'user_input' }],
  ['non-finite coordinates are rejected', { kind: 'location', longitude: 'not-a-number', latitude: 0, coordinate_origin: 'user_input' }],
  ['project authority is rejected for a location', { kind: 'location', longitude: 0, latitude: 0, coordinate_origin: 'project_register' }],
  ['asset identity is rejected on a location', { kind: 'location', longitude: 0, latitude: 0, coordinate_origin: 'user_input', repd_ref: '13599' }]
]) {
  let rejected = false;
  try { validateCoordinateSelection(value); } catch { rejected = true; }
  check(label, rejected);
}

for (const [label, longitude, latitude] of [
  ['null direct longitude is rejected', null, 0],
  ['empty direct longitude is rejected', '', 0],
  ['boolean direct longitude is rejected', false, 0],
  ['numeric-string direct latitude is rejected', 0, '52']
]) {
  let rejected = false;
  try {
    validateCoordinateSelection({ kind: 'location', longitude, latitude, coordinate_origin: 'user_input' });
  } catch { rejected = true; }
  check(label, rejected);
}
check('canonical URL decimals are explicitly parsed',
  decodeSelection('kind=location&longitude=-1.5&latitude=52.4&coordinate_origin=user_input').longitude === -1.5);
for (const query of [
  'kind=location&longitude=&latitude=0&coordinate_origin=user_input',
  'kind=location&longitude=01&latitude=0&coordinate_origin=user_input',
  'kind=location&longitude=1e2&latitude=0&coordinate_origin=user_input'
]) {
  let rejected = false;
  try { decodeSelection(query); } catch { rejected = true; }
  check('non-canonical URL coordinate is rejected', rejected);
}

const substation = validateSubstationSelection({
  kind: 'substation', site_code: 'TEST-SITE', source_release: digest
});
check('exact substation selection is accepted', substation.site_code === 'TEST-SITE');
check('substation output is immutable', Object.isFrozen(substation));
for (const [label, value] of [
  ['missing site_code is rejected', { kind: 'substation', source_release: digest }],
  ['blank site_code is rejected', { kind: 'substation', site_code: ' ', source_release: digest }],
  ['display label cannot replace site_code', { kind: 'substation', site_code: '', source_release: digest, name: 'Plausible Site' }],
  ['coordinates are not substation identity', { kind: 'substation', site_code: 'TEST-SITE', source_release: digest, latitude: 52 }],
  ['wrong substation source digest is rejected', { kind: 'substation', site_code: 'TEST-SITE', source_release: 'bad' }]
]) {
  let rejected = false;
  try { validateSubstationSelection(value); } catch { rejected = true; }
  check(label, rejected);
}

check('union dispatch accepts an exact project',
  validateAnySelection({ kind: 'project', repd_ref: '13599', source_release: digest }).kind === 'project');
check('union dispatch accepts an explicit location',
  validateAnySelection({ kind: 'location', longitude: 0, latitude: 0, coordinate_origin: 'mapped_feature' }).kind === 'location');
check('union dispatch accepts an exact substation',
  validateAnySelection({ kind: 'substation', site_code: 'TEST-SITE', source_release: digest }).kind === 'substation');
let unsupportedRejected = false;
try { validateAnySelection({ kind: 'asset', id: 'plausible' }); } catch { unsupportedRejected = true; }
check('union dispatch rejects unknown kinds', unsupportedRejected);
let getterReads = 0;
const getterSelection = Object.defineProperties({}, {
  kind: { get() { getterReads += 1; return 'project'; }, enumerable: true },
  repd_ref: { value: '13599', enumerable: true },
  source_release: { value: digest, enumerable: true }
});
let getterRejected = false;
try { validateAnySelection(getterSelection); } catch { getterRejected = true; }
check('kind accessor is rejected without executing it', getterRejected && getterReads === 0);
let proxyReads = 0;
const proxiedSelection = new Proxy({
  kind: 'project', repd_ref: '13599', source_release: digest
}, { get(target, key, receiver) { proxyReads += 1; return Reflect.get(target, key, receiver); } });
check('dispatch validates a descriptor snapshot without property reads',
  validateAnySelection(proxiedSelection).repd_ref === '13599' && proxyReads === 0);

for (const selection of [accepted, location, substation]) {
  const encoded = encodeSelection(selection);
  const decoded = decodeSelection(encoded);
  check(`${selection.kind} selection round-trips canonically`,
    JSON.stringify(decoded) === JSON.stringify(selection));
}
let unsafeQueryRejected = false;
try { decodeSelection(`kind=project&repd_ref=13599&source_release=${digest}&name=plausible`); } catch { unsafeQueryRejected = true; }
check('unexpected query field is rejected', unsafeQueryRejected);
let duplicateQueryRejected = false;
try { decodeSelection(`kind=project&repd_ref=13599&repd_ref=other&source_release=${digest}`); } catch { duplicateQueryRejected = true; }
check('duplicate identity field is rejected', duplicateQueryRejected);
let queryToStringReads = 0;
let nonStringQueryRejected = false;
try { decodeSelection({ toString() { queryToStringReads += 1; return encodeSelection(accepted); } }); } catch { nonStringQueryRejected = true; }
check('selection decoder rejects objects without invoking toString',
  nonStringQueryRejected && queryToStringReads === 0);

const measurement = validateFinding({
  type: 'nearest_connection_point', evidence_class: 'measurement', status: 'available',
  selection_revision: 1, value: 3.2, unit: 'km', qualifiers: ['test fixture'], provenance: [evidence]
});
check('typed available finding is accepted', measurement.value === 3.2);
check('finding collections are immutable',
  Object.isFrozen(measurement.qualifiers) && Object.isFrozen(measurement.provenance));
const withheld = validateFinding({
  type: 'unknown', evidence_class: 'unknown', status: 'withheld',
  selection_revision: 1, value: null, unit: null, qualifiers: ['SOURCE_UNAVAILABLE'], provenance: []
});
check('typed withheld finding has no numeric answer', withheld.value === null);
for (const [label, value] of [
  ['unknown finding type is rejected', { ...measurement, type: 'answer' }],
  ['zero revision is rejected', { ...measurement, selection_revision: 0 }],
  ['available null value is rejected', { ...measurement, value: null }],
  ['withheld numeric value is rejected', { ...withheld, value: 12, unit: 'km' }],
  ['unknown available value is rejected', { ...withheld, status: 'available', value: 42, unit: 'MW' }],
  ['NaN finding value is rejected', { ...measurement, value: Number.NaN }],
  ['infinite finding value is rejected', { ...measurement, value: Number.POSITIVE_INFINITY }],
  ['object finding value is rejected', { ...measurement, value: { km: 3.2 } }],
  ['distance finding with wrong unit is rejected', { ...measurement, unit: 'miles' }],
  ['unknown finding with provenance is rejected', { ...withheld, provenance: [evidence] }],
  ['extra presentation field is rejected', { ...measurement, headline: 'plausible' }]
]) {
  let rejected = false;
  try { validateFinding(value); } catch { rejected = true; }
  check(label, rejected);
}

for (const [type, evidenceClass] of [
  ['declared_connection', 'published_fact'],
  ['nearest_connection_point', 'measurement'],
  ['mapped_segment', 'measurement'],
  ['published_network_fact', 'published_fact'],
  ['model_result', 'model_result'],
  ['unknown', 'unknown']
]) {
  const distanceType = ['nearest_connection_point', 'mapped_segment'].includes(type);
  const value = type === 'unknown' ? null : distanceType ? 1.25 : 'test fixture';
  const unit = distanceType ? 'km' : null;
  const status = type === 'unknown' ? 'withheld' : 'available';
  const finding = validateFinding({ type, evidence_class: evidenceClass, status,
    selection_revision: 2, value, unit, qualifiers: [],
    provenance: type === 'unknown' ? [] : [evidence] });
  check(`${type} accepts only its evidence class`, finding.evidence_class === evidenceClass);
  let mismatchRejected = false;
  try { validateFinding({ ...finding, evidence_class: evidenceClass === 'unknown' ? 'measurement' : 'unknown' }); } catch { mismatchRejected = true; }
  check(`${type} rejects a mismatched evidence class`, mismatchRejected);
}

const roadRoute = createRoadRouteFinding(1);
check('road route is explicitly not computed without an authoritative graph',
  roadRoute.type === 'road_route' && roadRoute.status === 'withheld'
    && roadRoute.value === null && roadRoute.unit === null
    && roadRoute.qualifiers.includes('ROAD_ROUTE_NOT_COMPUTED'));
const corridorEstimate = createCorridorEstimateFinding(1, 'straight_line_to_substation');
check('1.245 calibration is withheld for straight-line substation geometry',
  corridorEstimate.type === 'corridor_estimate' && corridorEstimate.value === null
    && corridorEstimate.qualifiers.includes('CALIBRATION_1_245_NOT_APPLICABLE')
    && !JSON.stringify(corridorEstimate).includes('35.9'));
let inventedCorridorBasisRejected = false;
try { createCorridorEstimateFinding(1, 'road_graph'); } catch { inventedCorridorBasisRejected = true; }
check('corridor estimator rejects an unproved basis', inventedCorridorBasisRejected);

const substationDigest = '87976435766a58ddf19c99540b58cd7f18a224148af42ba55075d8851f9e6251';
const substationBytes = readFileSync(new URL(
  '../../../atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson', import.meta.url
));
check('substation fixture is pinned to immutable release bytes',
  substationBytes.length === 1192748
    && createHash('sha256').update(substationBytes).digest('hex') === substationDigest);
const substationEvidence = Object.freeze({
  source_id: 'grid_substations',
  release: 'atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson',
  sha256: substationDigest, bytes: 1192748
});
const substationDocument = JSON.parse(substationBytes);
const markinchGeometryRecord = JSON.parse(readFileSync(new URL(
  '../../../data/repd_browser_registry_202608290716.json', import.meta.url
))).records.find((row) => row.repd_ref === '155');
const voltageKv = (feature) => String(feature.properties?.voltage || '')
  .split(';').filter(Boolean).map((value) => Number(value) / 1000)
  .filter((value) => Number.isInteger(value) && value > 0);
const validPoint = (feature) => feature.geometry?.type === 'Point'
  && Array.isArray(feature.geometry.coordinates)
  && feature.geometry.coordinates.length >= 2
  && typeof feature.geometry.coordinates[0] === 'number'
  && typeof feature.geometry.coordinates[1] === 'number';
const substationCandidates = (minimumKv, namedOnly = false) => substationDocument.features
  .filter((feature) => validPoint(feature)
    && voltageKv(feature).some((value) => value >= minimumKv)
    && (!namedOnly || String(feature.properties?.name || '').trim()))
  .map((feature) => ({
    feature,
    distance_km: haversineR6378137Km(
      markinchGeometryRecord.longitude, markinchGeometryRecord.latitude,
      feature.geometry.coordinates[0], feature.geometry.coordinates[1]
    )
  }))
  .sort((left, right) => left.distance_km - right.distance_km
    || (left.feature.id < right.feature.id ? -1 : left.feature.id > right.feature.id ? 1 : 0));
const candidates33 = substationCandidates(33);
const candidates400 = substationCandidates(400);
const namedCandidates400 = substationCandidates(400, true);
check('substation candidate populations are derived from pinned geometry and voltage',
  substationDocument.features.length === 5800
    && candidates33.length === 5799 && candidates400.length === 278
    && namedCandidates400.length === 238);
const targetFromFeature = (entry) => ({
  target_id: entry.feature.id,
  target_name: entry.feature.properties?.name?.trim() || null,
  operator: entry.feature.properties?.operator?.trim() || null,
  voltage_kv: voltageKv(entry.feature),
  longitude: entry.feature.geometry.coordinates[0],
  latitude: entry.feature.geometry.coordinates[1]
});
const glenrothesDistance = createScopedDistanceFinding({
  type: 'nearest_connection_point', distance_km: candidates33[0].distance_km,
  selection_revision: 1, provenance: [substationEvidence],
  qualifiers: ['MARKINCH', 'ANY_VOLTAGE_AT_OR_ABOVE_33_KV'],
  target: targetFromFeature(candidates33[0]),
  scope: {
    predicate: 'valid point geometry and any voltage_kv >= 33',
    candidate_count: 5799, located_count: 5799, total_count: 5800,
    geometry: 'haversine_r6378_137_km'
  }
});
const nearest400Distance = createScopedDistanceFinding({
  type: 'nearest_connection_point', distance_km: candidates400[0].distance_km,
  selection_revision: 1, provenance: [substationEvidence],
  qualifiers: ['MARKINCH', 'ANY_VOLTAGE_AT_OR_ABOVE_400_KV'],
  target: targetFromFeature(candidates400[0]),
  scope: {
    predicate: 'valid point geometry and any voltage_kv >= 400',
    candidate_count: 278, located_count: 278, total_count: 5800,
    geometry: 'haversine_r6378_137_km'
  }
});
const nearestNamed400Distance = createScopedDistanceFinding({
  type: 'nearest_connection_point', distance_km: namedCandidates400[0].distance_km,
  selection_revision: 1, provenance: [substationEvidence],
  qualifiers: ['MARKINCH', 'NAMED_AND_ANY_VOLTAGE_AT_OR_ABOVE_400_KV'],
  target: targetFromFeature(namedCandidates400[0]),
  scope: {
    predicate: 'valid point geometry, non-empty name, and any voltage_kv >= 400',
    candidate_count: 238, located_count: 238, total_count: 5800,
    geometry: 'haversine_r6378_137_km'
  }
});
check('Markinch any-voltage and 400 kV substation findings remain distinct',
  Math.abs(glenrothesDistance.finding.value - 2.485885849) < 1e-9
    && glenrothesDistance.target.target_id === 'grid_substations:417'
    && Math.abs(nearest400Distance.finding.value - 28.819562529) < 1e-9
    && nearest400Distance.target.target_id === 'grid_substations:2033'
    && glenrothesDistance.scope.predicate !== nearest400Distance.scope.predicate);
check('unnamed 400 kV source remains identified by source feature',
  nearest400Distance.target.target_name === null
    && nearest400Distance.target.target_id === 'grid_substations:2033');
check('nearest named 400 kV companion is independently scoped',
  nearestNamed400Distance.target.target_name === 'Smeaton Substation'
    && Math.abs(nearestNamed400Distance.finding.value - 33.503070342) < 1e-9
    && nearestNamed400Distance.scope.candidate_count === 238);

const pinned = validateProvenance(evidence);
check('pinned provenance is accepted and frozen',
  pinned.sha256 === digest && pinned.bytes === 12 && Object.isFrozen(pinned));
for (const [label, value] of [
  ['missing provenance digest is rejected', { source_id: 'x', release: 'v1', bytes: 1 }],
  ['negative provenance length is rejected', { ...evidence, bytes: -1 }],
  ['extra provenance fields are rejected', { ...evidence, url: 'https://example.invalid' }],
  ['numeric source identity is rejected', { ...evidence, source_id: 155 }],
  ['object release is rejected without coercion', { ...evidence, release: { toString: () => 'v1' } }],
  ['whitespace-changing release is rejected', { ...evidence, release: ' v1 ' }]
]) {
  let rejected = false;
  try { validateProvenance(value); } catch { rejected = true; }
  check(label, rejected);
}
let missingEvidenceRejected = false;
try { validateFinding({ ...measurement, provenance: [] }); } catch { missingEvidenceRejected = true; }
check('measurement without provenance is rejected', missingEvidenceRejected);

const coverage = coverageBoundary({
  predicate: 'test fixture: voltage_kv >= 400', located: 2, total: 5
});
check('coverage exposes its exact predicate', coverage.predicate.includes('voltage_kv'));
check('coverage exposes numerator and denominator', coverage.located === 2 && coverage.total === 5);
check('coverage ratio is derived from those counts', coverage.ratio === 0.4);
const emptyCoverage = coverageBoundary({ predicate: 'test fixture: none', located: 0, total: 0 });
check('empty population is unavailable rather than zero percent',
  emptyCoverage.status === 'unavailable' && emptyCoverage.ratio === null);
for (const [label, value] of [
  ['located cannot exceed total', { predicate: 'fixture', located: 6, total: 5 }],
  ['coverage counts cannot be fractional', { predicate: 'fixture', located: 1.5, total: 5 }],
  ['coverage predicate cannot be blank', { predicate: ' ', located: 0, total: 1 }]
]) {
  let rejected = false;
  try { coverageBoundary(value); } catch { rejected = true; }
  check(label, rejected);
}

const markinchSegmentDistance = createDistanceFinding({
  type: 'mapped_segment', distance_km: 2.470, selection_revision: 1,
  provenance: [evidence], qualifiers: ['MARKINCH_COMMITTED_FIXTURE']
});
check('distance finding preserves the committed straight-line value',
  markinchSegmentDistance.value === 2.470 && markinchSegmentDistance.unit === 'km');
check('distance finding declares method and semantic boundary',
  markinchSegmentDistance.qualifiers.includes('STRAIGHT_LINE_DISTANCE')
    && markinchSegmentDistance.qualifiers.includes('PROXIMITY_IS_NOT_CONNECTION'));
for (const value of [null, '2.470', -1, Number.NaN]) {
  let rejected = false;
  try {
    createDistanceFinding({ type: 'mapped_segment', distance_km: value,
      selection_revision: 1, provenance: [evidence] });
  } catch { rejected = true; }
  check('distance builder rejects a non-canonical distance', rejected);
}

const store = createSelectionStore();
store.select(location);
store.select(accepted);
const restored = store.back();
check('selection history restores the prior typed state', restored.selection.kind === 'location');
check('history restoration creates a new revision', restored.revision === 3);
check('selection state is an atomic replacement', !Object.hasOwn(restored, 'previous'));

const register = createProjectRegister([
  { repd_ref: 'B', longitude: 2, latitude: 50, technology: 'bess' },
  { repd_ref: 'A', longitude: 1, latitude: 50, technology: 'solar' }
], { ...evidence, source_id: 'project_register' });
const nearby = nearbyProjects({ register, longitude: 0, latitude: 50,
  distanceKm: (_lon, _lat, projectLon) => projectLon });
check('nearby traversal reads and sorts the full register',
  nearby.map((row) => row.repd_ref).join(',') === 'A,B');
check('nearby results retain operable project identity',
  nearby.every((row) => row.repd_ref && row.source_release === digest));
for (const [label, longitude, latitude] of [
  ['nearby traversal rejects null longitude', null, 50],
  ['nearby traversal rejects numeric-string longitude', '0', 50],
  ['nearby traversal rejects boolean latitude', 0, false],
  ['nearby traversal rejects out-of-range latitude', 0, 91]
]) {
  let calls = 0;
  let rejected = false;
  try {
    nearbyProjects({ register, longitude, latitude, distanceKm: () => { calls += 1; return 0; } });
  } catch { rejected = true; }
  check(label, rejected && calls === 0);
}
let duplicateProjectRejected = false;
try {
  createProjectRegister([
    { repd_ref: 'A', longitude: 0, latitude: 0, technology: 'solar' },
    { repd_ref: 'A', longitude: 1, latitude: 1, technology: 'solar' }
  ], { ...evidence, source_id: 'project_register' });
} catch { duplicateProjectRejected = true; }
check('duplicate register identity fails closed', duplicateProjectRejected);
for (const [label, row] of [
  ['numeric project identity is rejected', { repd_ref: 155, longitude: 0, latitude: 0, technology: 'biomass' }],
  ['object project identity is rejected', { repd_ref: { toString: () => '155' }, longitude: 0, latitude: 0, technology: 'biomass' }],
  ['null project longitude is rejected', { repd_ref: 'strict-1', longitude: null, latitude: 0, technology: 'biomass' }],
  ['string project latitude is rejected', { repd_ref: 'strict-2', longitude: 0, latitude: '0', technology: 'biomass' }],
  ['boolean project coordinate is rejected', { repd_ref: 'strict-3', longitude: false, latitude: 0, technology: 'biomass' }]
]) {
  let rejected = false;
  try { createProjectRegister([row], { ...evidence, source_id: 'project_register' }); } catch { rejected = true; }
  check(label, rejected);
}

const projectIndex = createProjectIndex(register);
check('project index retains the complete register',
  projectIndex.size === 2 && projectIndex.all().length === 2);
check('project index resolves exact identity',
  projectIndex.get('A').repd_ref === 'A' && projectIndex.get('A').longitude === 1);
check('project index reports absence without guessing', projectIndex.get('MISSING') === null);
check('indexed project rows remain immutable', Object.isFrozen(projectIndex.get('B')));
let blankLookupRejected = false;
try { projectIndex.get(' '); } catch { blankLookupRejected = true; }
check('blank exact lookup is rejected', blankLookupRejected);

const projectRequest = projectFindingRequest({
  kind: 'project', repd_ref: 'A', source_release: digest
}, projectIndex);
check('project request resolves through exact repd_ref',
  projectRequest.project.repd_ref === 'A' && projectRequest.kind === 'project_finding_request');
check('project request retains its source evidence',
  projectRequest.source.sha256 === digest && projectRequest.source.source_id === 'project_register');

const technologyFixtures = [
  ['12453', -1.085062, 53.580258, 'bess'],
  ['12588', -1.348973, 51.813209, 'solar'],
  ['14926', -2.34505, 57.23695, 'hydrogen'],
  ['16442', -4.47957, 57.33581, 'hydro'],
  ['6865', -1.22867, 51.65795, 'flywheel'],
  ['6611', -4.71921, 53.3037, 'tidal'],
  ['932', -2.75237, 53.3257, 'biomass'],
  ['11288', -2.40905, 53.4352, 'caes'],
  ['6277', -1.22446, 53.79499, 'act'],
  ['4692', -4.75366, 50.36924, 'geothermal'],
  ['15205', -0.36839, 50.81255, 'other']
].map(([repd_ref, longitude, latitude, technology]) => ({ repd_ref, longitude, latitude, technology }));
const technologyRegister = createProjectRegister(technologyFixtures,
  { ...evidence, source_id: 'project_register' });
check('published wider-fleet vocabulary covers eleven technologies',
  new Set(technologyRegister.projects.map((row) => row.technology)).size === 11
    && technologyFixtures.every((fixture) =>
      PROJECT_TECHNOLOGIES.includes(fixture.technology)));
check('every published technology survives the adapter exactly',
  technologyRegister.projects.every((row) => row.technology === row.source_technology
    && row.technology_status === 'known'));
const unknownTechnology = classifyProjectTechnology('future_test_fixture');
check('unknown technology remains explicit and preserves its source token',
  unknownTechnology.technology === 'unknown'
    && unknownTechnology.source_technology === 'future_test_fixture'
    && unknownTechnology.status === 'unknown');
for (const technology of ['solar_roof', 'wind_onshore', 'wind_offshore']) {
  check(`${technology} from the Grid register is canonical`,
    classifyProjectTechnology(technology).technology === technology);
}

const gridRegisterDigest = 'c8a5c59be878c52014a272eb0e4d09af06a0d301d10a8d6b5d0b116b5d1bb6bc';
const gridRegisterBytes = readFileSync(new URL('../../../data/repd_browser_registry_202608290716.json', import.meta.url));
check('Markinch register fixture is pinned to immutable repository bytes',
  gridRegisterBytes.length === 9328402
    && createHash('sha256').update(gridRegisterBytes).digest('hex') === gridRegisterDigest);
const gridRegisterDocument = JSON.parse(gridRegisterBytes);
const markinchRecord = gridRegisterDocument.records.find((row) => row.repd_ref === '155');
check('Markinch evidence row is resolved from the pinned register',
  markinchRecord.name === 'Markinch Biomass CHP Plant'
    && markinchRecord.source_row_sha256 === '36c59cc66e5e9e6de64184c57155c2fa362f4896d2643a14a04b9720944ef9c4');
const gridRegisterSource = Object.freeze({
  source_id: 'project_register',
  release: '202608290716:data/repd_browser_registry_202608290716.json',
  sha256: gridRegisterDigest, bytes: 9328402
});
const fullGridRegister = createProjectRegisterFromDocument(gridRegisterDocument, gridRegisterSource);
check('full pinned Grid register survives the strict boundary adapter',
  fullGridRegister.projects.length === 11069
    && new Set(fullGridRegister.projects.map((row) => row.technology)).size === 14);
let malformedDocumentRejected = false;
try {
  createProjectRegisterFromDocument({
    schema: 'gridatlas.browser-registry.v1', generation: '202608290716',
    records: [{ repd_ref: 'x', longitude: 0, latitude: 0, technology: 'solar',
      name: 'fixture', repd_operator_or_applicant: null, capacity_mw: '65', status: 'operational' }]
  }, gridRegisterSource);
} catch { malformedDocumentRejected = true; }
check('register boundary rejects malformed published facts instead of dropping them',
  malformedDocumentRejected);
const fullGridIndex = createProjectIndex(fullGridRegister);
const fullGridEngine = createGridFindingEngine({
  projectIndex: fullGridIndex,
  substationFeatures: substationDocument.features,
  provenance: substationEvidence
});
for (const technology of PROJECT_TECHNOLOGIES) {
  const representative = fullGridRegister.projects.find((row) => row.technology === technology);
  const result = fullGridEngine.queryProfiles({
    selection: {
      kind: 'project', repd_ref: representative.repd_ref,
      source_release: fullGridRegister.source.sha256
    },
    revision: 1
  });
  check(`${technology} real project invokes the shared grid engine`,
    result.state === 'RESULT' && result.profiles.every((profile) => profile.state === 'RESULT'));
}
const unknownEngineRegister = createProjectRegister([{
  repd_ref: 'unknown-test-fixture', longitude: -1, latitude: 52,
  technology: 'future_test_fixture'
}], gridRegisterSource);
const unknownEngine = createGridFindingEngine({
  projectIndex: createProjectIndex(unknownEngineRegister),
  substationFeatures: substationDocument.features,
  provenance: substationEvidence
});
const unknownEngineResult = unknownEngine.queryProfiles({
  selection: {
    kind: 'project', repd_ref: 'unknown-test-fixture',
    source_release: gridRegisterSource.sha256
  }, revision: 1
});
check('unknown project technology does not block shared grid computation',
  unknownEngineResult.state === 'RESULT'
    && unknownEngineResult.profiles.every((profile) => profile.state === 'RESULT'));
const markinchRegister = createProjectRegister([{
  repd_ref: markinchRecord.repd_ref,
  longitude: markinchRecord.longitude,
  latitude: markinchRecord.latitude,
  technology: markinchRecord.technology,
  name: markinchRecord.name,
  operator: markinchRecord.repd_operator_or_applicant,
  capacity_mw: markinchRecord.capacity_mw,
  status: markinchRecord.status
}], gridRegisterSource);
const markinchIndex = createProjectIndex(markinchRegister);
const markinchLink = 'https://ventusltd.github.io/gridatlas/atlas/?repd_ref=155'
  + '&project=Markinch+Biomass+CHP+Plant&technology=biomass&capacity_mw=65'
  + '&latitude=56.20118&longitude=-3.162255&zoom=12';
const markinchArrival = parseProjectDeepLink(markinchLink, markinchIndex);
check('Markinch deep link establishes identity only through repd_ref',
  markinchArrival.selection.repd_ref === '155'
    && Object.keys(markinchArrival.selection).join(',') === 'kind,repd_ref,source_release');
check('Markinch transport technology survives as the typed register vocabulary',
  markinchArrival.project.technology === 'biomass'
    && markinchArrival.technology.technology === 'biomass'
    && markinchArrival.diagnostics.length === 0);
check('Markinch canonical row preserves presentation facts without URL authority',
  markinchArrival.project.name === 'Markinch Biomass CHP Plant'
    && markinchArrival.project.operator === 'RWE'
    && markinchArrival.project.capacity_mw === 65
    && markinchArrival.transport.zoom === '12');

let deepLinkConsoleErrors = 0;
const originalConsoleError = console.error;
console.error = () => { deepLinkConsoleErrors += 1; };
try {
  const allTechnologyIndex = createProjectIndex(technologyRegister);
  for (const fixture of technologyFixtures) {
    const arrival = parseProjectDeepLink(
      `?repd_ref=${fixture.repd_ref}&technology=${fixture.technology}`,
      allTechnologyIndex
    );
    check(`${fixture.technology} deep link canonicalizes without fallback`,
      arrival.project.technology === fixture.technology && arrival.diagnostics.length === 0);
  }
  const futureRegister = createProjectRegister([{
    repd_ref: 'future-fixture', longitude: 0, latitude: 0,
    technology: 'future_test_fixture'
  }], gridRegisterSource);
  const futureArrival = parseProjectDeepLink(
    '?repd_ref=future-fixture&technology=future_test_fixture',
    createProjectIndex(futureRegister)
  );
  check('unknown deep-link technology is explicit rather than rejected',
    futureArrival.project.technology === 'unknown'
      && futureArrival.diagnostics.includes('UNKNOWN_TRANSPORT_TECHNOLOGY'));
} finally {
  console.error = originalConsoleError;
}
check('complete technology deep-link adaptation emits no console error', deepLinkConsoleErrors === 0);
const sharedGridEngine = createGridFindingEngine({
  projectIndex: markinchIndex,
  substationFeatures: substationDocument.features,
  provenance: substationEvidence
});
const sharedMarkinchResult = sharedGridEngine.queryProfiles({
  selection: markinchArrival.selection, revision: 1
});
check('shared engine computes all Markinch voltage profiles from one source',
  sharedMarkinchResult.state === 'RESULT'
    && sharedMarkinchResult.profiles.length === 3
    && sharedMarkinchResult.profiles.every((profile) => profile.state === 'RESULT'));
check('shared engine reproduces distinct Markinch targets and distances',
  sharedMarkinchResult.profiles[0].scoped_finding.target.target_id === 'grid_substations:417'
    && Math.abs(sharedMarkinchResult.profiles[0].scoped_finding.finding.value - 2.485885849) < 1e-9
    && sharedMarkinchResult.profiles[1].scoped_finding.target.target_id === 'grid_substations:2033'
    && Math.abs(sharedMarkinchResult.profiles[1].scoped_finding.finding.value - 28.819562529) < 1e-9
    && sharedMarkinchResult.profiles[2].scoped_finding.target.target_name === 'Smeaton Substation');
check('shared engine withholds route and corridor outputs alongside straight-line results',
  sharedMarkinchResult.road_route.qualifiers.includes('ROAD_ROUTE_NOT_COMPUTED')
    && sharedMarkinchResult.corridor_estimate.qualifiers.includes('CALIBRATION_1_245_NOT_APPLICABLE'));

let clockNow = 1000;
let sharedEngineCalls = 0;
const arrivalAdapter = createProjectArrivalAdapter({
  projectIndex: markinchIndex,
  engine: {
    queryProfiles(input) {
      sharedEngineCalls += 1;
      return sharedGridEngine.queryProfiles(input);
    }
  },
  clock: () => clockNow
});
check('cold arrival is distinguishable as never measured',
  arrivalAdapter.read().phase === 'NEVER_MEASURED');
const markinchArrivalPromise = arrivalAdapter.arrive(markinchLink);
check('cold deep-link arrival exposes MEASURING before computation completes',
  arrivalAdapter.read().phase === 'MEASURING'
    && arrivalAdapter.read().identity.repd_ref === '155');
clockNow = 1042;
const markinchArrivalState = await markinchArrivalPromise;
check('direct Markinch arrival invokes the shared engine and measures time to result',
  sharedEngineCalls === 1 && markinchArrivalState.phase === 'RESULT'
    && markinchArrivalState.elapsed_ms === 42);
check('arrival state carries project identity once and does not emit Unnamed',
  markinchArrivalState.identity.repd_ref === '155'
    && !Object.hasOwn(markinchArrivalState.project, 'repd_ref')
    && !JSON.stringify(markinchArrivalState).includes('Unnamed'));
const noCandidateEngine = createGridFindingEngine({
  projectIndex: markinchIndex, substationFeatures: [], provenance: substationEvidence
});
const noCandidateAdapter = createProjectArrivalAdapter({
  projectIndex: markinchIndex, engine: noCandidateEngine, clock: () => 2000
});
const measuredNone = await noCandidateAdapter.arrive(markinchLink);
check('measured-none has an explicit reason distinct from never-measured',
  measuredNone.phase === 'REASON' && measuredNone.reason === 'NO_ELIGIBLE_SUBSTATION'
    && noCandidateAdapter.read().phase !== 'NEVER_MEASURED');
let staleReleaseRejected = false;
try {
  projectFindingRequest({ kind: 'project', repd_ref: 'A', source_release: 'b'.repeat(64) }, projectIndex);
} catch { staleReleaseRejected = true; }
check('project request rejects a selection from another register release', staleReleaseRejected);
let absentProjectRejected = false;
try {
  projectFindingRequest({ kind: 'project', repd_ref: 'MISSING', source_release: digest }, projectIndex);
} catch { absentProjectRejected = true; }
check('absent exact project fails instead of falling back to coordinates', absentProjectRejected);

const loop = createFindingLoop(async ({ revision }) => [{
  type: 'nearest_connection_point', evidence_class: 'measurement', status: 'available',
  selection_revision: revision, value: 3.2, unit: 'km',
  qualifiers: ['test fixture', 'proximity is not a connection'], provenance: [evidence]
}]);
const loopResult = await loop.select(location);
check('finding loop returns the current revision',
  loopResult.accepted && loopResult.findings[0].selection_revision === 1);
check('finding loop preserves the result qualification',
  loopResult.findings[0].qualifiers.includes('proximity is not a connection'));
const failedLoop = createFindingLoop(async () => { throw new Error('test fixture source failure'); });
const failedResult = await failedLoop.select(location);
check('query error becomes an explicit failed-closed finding',
  failedResult.findings[0].status === 'failed' && failedResult.findings[0].value === null);
let hostileErrorReads = 0;
const hostileError = Object.defineProperty({}, 'message', {
  get() { hostileErrorReads += 1; return 'sensitive detail'; }
});
const hostileFailureLoop = createFindingLoop(async () => { throw hostileError; });
const hostileFailure = await hostileFailureLoop.select(location);
check('query failure uses a stable public code without reading hostile error fields',
  hostileErrorReads === 0
    && hostileFailure.findings[0].qualifiers.join(',') === 'FAILED_CLOSED,QUERY_FAILED');

let releaseFirst;
const racingLoop = createFindingLoop(({ revision }) => new Promise((resolve) => {
  if (revision === 1) releaseFirst = () => resolve([{
    ...measurement, selection_revision: revision
  }]);
  else resolve([{ ...measurement, selection_revision: revision }]);
}));
const firstRequest = racingLoop.select(location);
const secondRequest = racingLoop.select(validateCoordinateSelection({
  kind: 'location', longitude: 1, latitude: 51, coordinate_origin: 'user_input'
}));
const secondResult = await secondRequest;
releaseFirst();
const firstResult = await firstRequest;
check('newer selection result is accepted', secondResult.accepted && secondResult.revision === 2);
check('late result from the old selection is rejected',
  !firstResult.accepted && firstResult.reason === 'STALE_SELECTION');

let releaseAfterBack;
const navigationLoop = createFindingLoop(({ revision }) => {
  if (revision === 3) return new Promise((resolve) => {
    releaseAfterBack = () => resolve([{ ...measurement, selection_revision: revision }]);
  });
  return Promise.resolve([{ ...measurement, selection_revision: revision }]);
});
await navigationLoop.select(location);
await navigationLoop.select(accepted);
const pendingBeforeBack = navigationLoop.select(validateCoordinateSelection({
  kind: 'location', longitude: 2, latitude: 52, coordinate_origin: 'user_input'
}));
const stateAfterBack = navigationLoop.back();
check('history navigation restores state through the loop owner',
  stateAfterBack.selection.kind === 'project' && stateAfterBack.revision === 4);
releaseAfterBack();
const resultAfterBack = await pendingBeforeBack;
check('back navigation cancels an in-flight finding result',
  !resultAfterBack.accepted && resultAfterBack.reason === 'STALE_SELECTION');
const stateAfterForward = navigationLoop.forward();
check('forward navigation creates a fresh selection revision',
  stateAfterForward.selection.kind === 'location' && stateAfterForward.revision === 5);

const ordered = orderCandidates([
  { feature_id: 'B', distance_km: 1 },
  { feature_id: 'A', distance_km: 1 },
  { feature_id: 'C', distance_km: 0.5 }
], { idField: 'feature_id' });
check('candidate ordering is distance then stable identity',
  ordered.map((row) => row.feature_id).join(',') === 'C,A,B');
check('candidate ordering does not mutate input rows', Object.isFrozen(ordered[0]));
for (const [label, rows] of [
  ['anonymous candidate is rejected', [{ distance_km: 1 }]],
  ['negative distance is rejected', [{ feature_id: 'A', distance_km: -1 }]],
  ['non-finite distance is rejected', [{ feature_id: 'A', distance_km: Number.NaN }]],
  ['numeric candidate identity is rejected', [{ feature_id: 1, distance_km: 1 }]],
  ['string candidate distance is rejected', [{ feature_id: 'A', distance_km: '1' }]]
]) {
  let rejected = false;
  try { orderCandidates(rows, { idField: 'feature_id' }); } catch { rejected = true; }
  check(label, rejected);
}
const codePointOrdered = orderCandidates([
  { feature_id: 'a', distance_km: 1 }, { feature_id: 'Z', distance_km: 1 }
], { idField: 'feature_id' });
check('candidate tie-break uses deterministic code-point order',
  codePointOrdered.map((row) => row.feature_id).join(',') === 'Z,a');
let candidateGetterReads = 0;
const candidateWithGetter = Object.defineProperties({}, {
  feature_id: { value: 'A', enumerable: true },
  distance_km: { value: 1, enumerable: true },
  payload: { get() { candidateGetterReads += 1; return 'unsafe'; }, enumerable: true }
});
let accessorCandidateRejected = false;
try { orderCandidates([candidateWithGetter], { idField: 'feature_id' }); } catch { accessorCandidateRejected = true; }
check('candidate accessors are rejected without execution',
  accessorCandidateRejected && candidateGetterReads === 0);
let candidateProxyReads = 0;
const proxiedCandidate = new Proxy({ feature_id: 'A', distance_km: 1, label: 'safe' }, {
  get(target, key, receiver) { candidateProxyReads += 1; return Reflect.get(target, key, receiver); }
});
const snapshottedCandidate = orderCandidates([proxiedCandidate], { idField: 'feature_id' })[0];
check('candidate output snapshots data descriptors without property reads',
  candidateProxyReads === 0 && snapshottedCandidate.label === 'safe');

const tied = resolveNearestCandidate([
  { site_code: 'B', distance_km: 2 },
  { site_code: 'A', distance_km: 2 }
], { idField: 'site_code' });
check('equal nearest candidates are withheld as ambiguous',
  tied.status === 'withheld' && tied.reason === 'AMBIGUOUS_TIE' && tied.value === null);
check('ambiguous candidate identities remain inspectable',
  tied.candidate_ids.join(',') === 'A,B');
const unique = resolveNearestCandidate([
  { site_code: 'A', distance_km: 2 },
  { site_code: 'B', distance_km: 2.1 }
], { idField: 'site_code' });
check('distinct nearest candidate is available', unique.status === 'available' && unique.value.site_code === 'A');
const absent = resolveNearestCandidate([], { idField: 'site_code' });
check('empty population is withheld', absent.reason === 'NO_CANDIDATE' && absent.value === null);

console.log(JSON.stringify({ status: 'PASS', iteration: 34, checks }));
