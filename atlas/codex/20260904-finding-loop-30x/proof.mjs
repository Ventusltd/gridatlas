import {
  coverageBoundary,
  createFindingLoop,
  createProjectIndex,
  createProjectRegister,
  createSelectionStore,
  decodeSelection,
  encodeSelection,
  validateAnySelection,
  validateCoordinateSelection,
  validateSelection,
  validateSubstationSelection,
  validateFinding,
  validateProvenance,
  nearbyProjects,
  orderCandidates,
  projectFindingRequest,
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
  const value = type === 'unknown' ? null : 'test fixture';
  const status = type === 'unknown' ? 'withheld' : 'available';
  const finding = validateFinding({ type, evidence_class: evidenceClass, status,
    selection_revision: 2, value, unit: null, qualifiers: [],
    provenance: type === 'unknown' ? [] : [evidence] });
  check(`${type} accepts only its evidence class`, finding.evidence_class === evidenceClass);
  let mismatchRejected = false;
  try { validateFinding({ ...finding, evidence_class: evidenceClass === 'unknown' ? 'measurement' : 'unknown' }); } catch { mismatchRejected = true; }
  check(`${type} rejects a mismatched evidence class`, mismatchRejected);
}

const pinned = validateProvenance(evidence);
check('pinned provenance is accepted and frozen',
  pinned.sha256 === digest && pinned.bytes === 12 && Object.isFrozen(pinned));
for (const [label, value] of [
  ['missing provenance digest is rejected', { source_id: 'x', release: 'v1', bytes: 1 }],
  ['negative provenance length is rejected', { ...evidence, bytes: -1 }],
  ['extra provenance fields are rejected', { ...evidence, url: 'https://example.invalid' }]
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

const store = createSelectionStore();
store.select(location);
store.select(accepted);
const restored = store.back();
check('selection history restores the prior typed state', restored.selection.kind === 'location');
check('history restoration creates a new revision', restored.revision === 3);
check('selection state is an atomic replacement', !Object.hasOwn(restored, 'previous'));

const register = createProjectRegister([
  { repd_ref: 'B', longitude: 2, latitude: 50 },
  { repd_ref: 'A', longitude: 1, latitude: 50 }
], { ...evidence, source_id: 'project_register' });
const nearby = nearbyProjects({ register, longitude: 0, latitude: 50,
  distanceKm: (_lon, _lat, projectLon) => projectLon });
check('nearby traversal reads and sorts the full register',
  nearby.map((row) => row.repd_ref).join(',') === 'A,B');
check('nearby results retain operable project identity',
  nearby.every((row) => row.repd_ref && row.source_release === digest));
let duplicateProjectRejected = false;
try {
  createProjectRegister([
    { repd_ref: 'A', longitude: 0, latitude: 0 },
    { repd_ref: 'A', longitude: 1, latitude: 1 }
  ], { ...evidence, source_id: 'project_register' });
} catch { duplicateProjectRejected = true; }
check('duplicate register identity fails closed', duplicateProjectRejected);

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
  ['non-finite distance is rejected', [{ feature_id: 'A', distance_km: Number.NaN }]]
]) {
  let rejected = false;
  try { orderCandidates(rows, { idField: 'feature_id' }); } catch { rejected = true; }
  check(label, rejected);
}

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

console.log(JSON.stringify({ status: 'PASS', iteration: 14, checks }));
