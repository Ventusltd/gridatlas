import {
  decodeSelection,
  encodeSelection,
  validateAnySelection,
  validateCoordinateSelection,
  validateSelection,
  validateSubstationSelection,
  validateFinding
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
  selection_revision: 1, value: 3.2, unit: 'km', qualifiers: ['test fixture'], provenance: []
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
    selection_revision: 2, value, unit: null, qualifiers: [], provenance: [] });
  check(`${type} accepts only its evidence class`, finding.evidence_class === evidenceClass);
  let mismatchRejected = false;
  try { validateFinding({ ...finding, evidence_class: evidenceClass === 'unknown' ? 'measurement' : 'unknown' }); } catch { mismatchRejected = true; }
  check(`${type} rejects a mismatched evidence class`, mismatchRejected);
}

console.log(JSON.stringify({ status: 'PASS', iteration: 7, checks }));
