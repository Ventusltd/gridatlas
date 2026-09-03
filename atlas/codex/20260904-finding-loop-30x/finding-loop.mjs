const PROJECT_FIELDS = Object.freeze(['kind', 'repd_ref', 'source_release']);
const LOCATION_FIELDS = Object.freeze(['coordinate_origin', 'kind', 'latitude', 'longitude']);
const SUBSTATION_FIELDS = Object.freeze(['kind', 'site_code', 'source_release']);
const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const FINDING_FIELDS = Object.freeze([
  'evidence_class', 'provenance', 'qualifiers', 'selection_revision',
  'status', 'type', 'unit', 'value'
]);
const FINDING_TYPES = new Set([
  'declared_connection', 'nearest_connection_point', 'mapped_segment',
  'published_network_fact', 'model_result', 'unknown'
]);
const EVIDENCE_CLASSES = new Set(['published_fact', 'measurement', 'model_result', 'unknown']);
const EVIDENCE_CLASS_BY_TYPE = Object.freeze({
  declared_connection: 'published_fact',
  nearest_connection_point: 'measurement',
  mapped_segment: 'measurement',
  published_network_fact: 'published_fact',
  model_result: 'model_result',
  unknown: 'unknown'
});
const PROVENANCE_FIELDS = Object.freeze(['bytes', 'release', 'sha256', 'source_id']);
export const PROJECT_TECHNOLOGIES = Object.freeze([
  'act', 'bess', 'biomass', 'caes', 'flywheel', 'geothermal',
  'hydro', 'hydrogen', 'other', 'solar', 'tidal'
]);
const PROJECT_TECHNOLOGY_SET = new Set(PROJECT_TECHNOLOGIES);

/**
 * Validate the transport contract for an exact project selection.
 *
 * Identity comes only from repd_ref. source_release is the pinned 64-hex
 * release digest. Display names and coordinates are deliberately excluded.
 */
export function validateSelection(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('selection must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('selection must be a plain object');
  }
  if (Object.getOwnPropertySymbols(input).length) {
    throw new TypeError('selection cannot contain symbol fields');
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  const fields = Object.keys(descriptors).sort();
  if (fields.length !== PROJECT_FIELDS.length
      || fields.some((field, index) => field !== [...PROJECT_FIELDS].sort()[index])) {
    throw new TypeError('selection fields must be exactly kind, repd_ref, source_release');
  }
  for (const field of PROJECT_FIELDS) {
    if (!Object.hasOwn(descriptors[field], 'value')) {
      throw new TypeError(`selection field ${field} must be a data property`);
    }
  }

  const { kind, repd_ref: repdRef, source_release: sourceRelease } = input;
  if (kind !== 'project') throw new TypeError('selection kind must be project');
  if (typeof repdRef !== 'string' || repdRef.length === 0
      || repdRef !== repdRef.trim() || CONTROL_CHARACTER.test(repdRef)) {
    throw new TypeError('repd_ref must be a non-empty canonical string');
  }
  if (typeof sourceRelease !== 'string' || !SHA256.test(sourceRelease)) {
    throw new TypeError('source_release must be a lowercase SHA-256 digest');
  }

  return Object.freeze({ kind: 'project', repd_ref: repdRef, source_release: sourceRelease });
}

/** Validate an explicitly unidentified coordinate selection. */
export function validateCoordinateSelection(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('coordinate selection must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('coordinate selection must be a plain object');
  }
  if (Object.getOwnPropertySymbols(input).length) {
    throw new TypeError('coordinate selection cannot contain symbol fields');
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const fields = Object.keys(descriptors).sort();
  if (fields.length !== LOCATION_FIELDS.length
      || fields.some((field, index) => field !== LOCATION_FIELDS[index])) {
    throw new TypeError('coordinate selection has unexpected or missing fields');
  }
  if (LOCATION_FIELDS.some((field) => !Object.hasOwn(descriptors[field], 'value'))) {
    throw new TypeError('coordinate selection fields must be data properties');
  }
  if (input.kind !== 'location') throw new TypeError('coordinate selection kind must be location');
  if (!['user_input', 'mapped_feature'].includes(input.coordinate_origin)) {
    throw new TypeError('coordinate_origin is invalid');
  }
  const { longitude, latitude } = input;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)
      || longitude < -180 || longitude > 180) {
    throw new TypeError('longitude is invalid');
  }
  if (typeof latitude !== 'number' || !Number.isFinite(latitude)
      || latitude < -90 || latitude > 90) {
    throw new TypeError('latitude is invalid');
  }
  return Object.freeze({
    kind: 'location', longitude, latitude, coordinate_origin: input.coordinate_origin
  });
}

/** Validate an exact connection-point selection without guessing from a label. */
export function validateSubstationSelection(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('substation selection must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('substation selection must be a plain object');
  }
  if (Object.getOwnPropertySymbols(input).length) {
    throw new TypeError('substation selection cannot contain symbol fields');
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const fields = Object.keys(descriptors).sort();
  if (fields.length !== SUBSTATION_FIELDS.length
      || fields.some((field, index) => field !== SUBSTATION_FIELDS[index])) {
    throw new TypeError('substation selection has unexpected or missing fields');
  }
  if (SUBSTATION_FIELDS.some((field) => !Object.hasOwn(descriptors[field], 'value'))) {
    throw new TypeError('substation selection fields must be data properties');
  }
  const { kind, site_code: siteCode, source_release: sourceRelease } = input;
  if (kind !== 'substation') throw new TypeError('selection kind must be substation');
  if (typeof siteCode !== 'string' || siteCode.length === 0
      || siteCode !== siteCode.trim() || CONTROL_CHARACTER.test(siteCode)) {
    throw new TypeError('site_code must be a non-empty canonical string');
  }
  if (typeof sourceRelease !== 'string' || !SHA256.test(sourceRelease)) {
    throw new TypeError('source_release must be a lowercase SHA-256 digest');
  }
  return Object.freeze({ kind: 'substation', site_code: siteCode, source_release: sourceRelease });
}

/** Dispatch the discriminated union without coercing an unknown kind. */
export function validateAnySelection(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('selection must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null
      || Object.getOwnPropertySymbols(input).length) {
    throw new TypeError('selection must be a plain string-keyed object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (!Object.hasOwn(descriptors, 'kind') || !Object.hasOwn(descriptors.kind, 'value')) {
    throw new TypeError('selection kind must be a data property');
  }
  const copy = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => {
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError(`selection field ${key} must be a data property`);
    return [key, descriptor.value];
  }));
  if (descriptors.kind.value === 'project') return validateSelection(copy);
  if (descriptors.kind.value === 'location') return validateCoordinateSelection(copy);
  if (descriptors.kind.value === 'substation') return validateSubstationSelection(copy);
  throw new TypeError('selection kind is unsupported');
}

/** Canonical, lossless share state for the three selection variants. */
export function encodeSelection(input) {
  const selection = validateAnySelection(input);
  const query = new URLSearchParams();
  query.set('kind', selection.kind);
  if (selection.kind === 'project') {
    query.set('repd_ref', selection.repd_ref);
    query.set('source_release', selection.source_release);
  } else if (selection.kind === 'substation') {
    query.set('site_code', selection.site_code);
    query.set('source_release', selection.source_release);
  } else {
    query.set('longitude', String(selection.longitude));
    query.set('latitude', String(selection.latitude));
    query.set('coordinate_origin', selection.coordinate_origin);
  }
  return query.toString();
}

export function decodeSelection(text) {
  const query = new URLSearchParams(String(text).replace(/^\?/, ''));
  const kind = query.get('kind');
  const allowed = kind === 'project' ? PROJECT_FIELDS
    : kind === 'substation' ? SUBSTATION_FIELDS
      : kind === 'location' ? LOCATION_FIELDS : [];
  const names = [...query.keys()];
  if (!allowed.length || names.length !== allowed.length
      || names.some((name) => !allowed.includes(name) || query.getAll(name).length !== 1)) {
    throw new TypeError('selection query has unexpected, missing, or duplicate fields');
  }
  if (kind === 'project') {
    return validateSelection({ kind, repd_ref: query.get('repd_ref'), source_release: query.get('source_release') });
  }
  if (kind === 'substation') {
    return validateSubstationSelection({ kind, site_code: query.get('site_code'), source_release: query.get('source_release') });
  }
  const parseCoordinate = (name) => {
    const raw = query.get(name);
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw || '')) {
      throw new TypeError(`${name} is not a canonical decimal`);
    }
    const value = Number(raw);
    if (String(value) !== raw) throw new TypeError(`${name} is not canonically encoded`);
    return value;
  };
  return validateCoordinateSelection({ kind,
    longitude: parseCoordinate('longitude'), latitude: parseCoordinate('latitude'),
    coordinate_origin: query.get('coordinate_origin') });
}

/** Validate the common result envelope before any view can render it. */
export function validateFinding(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
      || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
      || Object.getOwnPropertySymbols(input).length) {
    throw new TypeError('finding must be a plain string-keyed object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const fields = Object.keys(descriptors).sort();
  if (fields.length !== FINDING_FIELDS.length
      || fields.some((field, index) => field !== FINDING_FIELDS[index])
      || FINDING_FIELDS.some((field) => !Object.hasOwn(descriptors[field], 'value'))) {
    throw new TypeError('finding fields are unexpected, missing, or unsafe');
  }
  if (!FINDING_TYPES.has(input.type) || !EVIDENCE_CLASSES.has(input.evidence_class)) {
    throw new TypeError('finding discriminator is invalid');
  }
  if (EVIDENCE_CLASS_BY_TYPE[input.type] !== input.evidence_class) {
    throw new TypeError('finding type and evidence class disagree');
  }
  if (!['available', 'withheld', 'failed'].includes(input.status)) {
    throw new TypeError('finding status is invalid');
  }
  if (!Number.isInteger(input.selection_revision) || input.selection_revision < 1) {
    throw new TypeError('selection_revision must be a positive integer');
  }
  if (!Array.isArray(input.qualifiers) || input.qualifiers.some((item) => typeof item !== 'string')) {
    throw new TypeError('qualifiers must be strings');
  }
  if (!Array.isArray(input.provenance)) throw new TypeError('provenance must be an array');
  if (input.evidence_class !== 'unknown' && input.provenance.length === 0) {
    throw new TypeError('evidenced findings require provenance');
  }
  if (input.status === 'available' ? input.value === null : input.value !== null || input.unit !== null) {
    throw new TypeError('finding value contradicts its status');
  }
  if (input.unit !== null && (typeof input.unit !== 'string' || !input.unit.trim())) {
    throw new TypeError('unit must be null or a non-empty string');
  }
  return Object.freeze({ ...input,
    qualifiers: Object.freeze([...input.qualifiers]),
    provenance: Object.freeze(input.provenance.map(validateProvenance))
  });
}

/** Validate a byte-pinned evidence source. */
export function validateProvenance(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)
      || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
      || Object.getOwnPropertySymbols(input).length) {
    throw new TypeError('provenance must be a plain string-keyed object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const fields = Object.keys(descriptors).sort();
  if (fields.length !== PROVENANCE_FIELDS.length
      || fields.some((field, index) => field !== PROVENANCE_FIELDS[index])
      || PROVENANCE_FIELDS.some((field) => !Object.hasOwn(descriptors[field], 'value'))) {
    throw new TypeError('provenance fields are unexpected, missing, or unsafe');
  }
  const { source_id: sourceId, release } = input;
  if (typeof sourceId !== 'string' || !sourceId || sourceId !== sourceId.trim()
      || typeof release !== 'string' || !release || release !== release.trim()
      || CONTROL_CHARACTER.test(sourceId) || CONTROL_CHARACTER.test(release)) {
    throw new TypeError('source identity and release must be canonical strings');
  }
  if (typeof input.sha256 !== 'string' || !SHA256.test(input.sha256)) {
    throw new TypeError('provenance sha256 is invalid');
  }
  if (!Number.isInteger(input.bytes) || input.bytes < 0) {
    throw new TypeError('provenance bytes are invalid');
  }
  return Object.freeze({ source_id: sourceId, release, sha256: input.sha256, bytes: input.bytes });
}

/** Compute and expose the coverage boundary for the exact query predicate. */
export function coverageBoundary({ predicate, located, total }) {
  if (typeof predicate !== 'string' || !predicate.trim() || CONTROL_CHARACTER.test(predicate)) {
    throw new TypeError('coverage predicate is required');
  }
  if (!Number.isInteger(located) || !Number.isInteger(total)
      || located < 0 || total < 0 || located > total) {
    throw new TypeError('coverage counts are invalid');
  }
  return Object.freeze({
    predicate,
    located,
    total,
    ratio: total === 0 ? null : located / total,
    status: total === 0 ? 'unavailable' : 'available'
  });
}

/** Build a qualified straight-line distance measurement from pinned evidence. */
export function createDistanceFinding({
  type, distance_km: distanceKm, selection_revision: selectionRevision,
  provenance, qualifiers = []
}) {
  if (!['nearest_connection_point', 'mapped_segment'].includes(type)) {
    throw new TypeError('distance finding type is unsupported');
  }
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new TypeError('distance_km must be a finite non-negative number');
  }
  if (!Array.isArray(qualifiers)
      || qualifiers.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new TypeError('distance qualifiers must be non-empty strings');
  }
  return validateFinding({
    type,
    evidence_class: 'measurement',
    status: 'available',
    selection_revision: selectionRevision,
    value: distanceKm,
    unit: 'km',
    qualifiers: [...qualifiers, 'STRAIGHT_LINE_DISTANCE', 'PROXIMITY_IS_NOT_CONNECTION'],
    provenance
  });
}

/** Selection history creates a fresh revision whenever state is restored. */
export function createSelectionStore() {
  let state = Object.freeze({ revision: 0, selection: null });
  const history = [];
  let cursor = -1;
  const apply = (selection) => {
    state = Object.freeze({ revision: state.revision + 1, selection: validateAnySelection(selection) });
    return state;
  };
  return Object.freeze({
    read: () => state,
    select(selection) {
      history.splice(cursor + 1);
      history.push(validateAnySelection(selection));
      cursor = history.length - 1;
      return apply(history[cursor]);
    },
    back() {
      if (cursor < 1) return null;
      cursor -= 1;
      return apply(history[cursor]);
    },
    forward() {
      if (cursor >= history.length - 1) return null;
      cursor += 1;
      return apply(history[cursor]);
    }
  });
}

/** Adapt the complete published project vocabulary without guessing aliases. */
export function classifyProjectTechnology(input) {
  if (typeof input !== 'string' || !input || input !== input.trim()
      || CONTROL_CHARACTER.test(input)) {
    throw new TypeError('project technology must be a canonical string');
  }
  const known = PROJECT_TECHNOLOGY_SET.has(input);
  return Object.freeze({
    technology: known ? input : 'unknown',
    source_technology: input,
    status: known ? 'known' : 'unknown'
  });
}

/** Build a complete, pinned project index. Duplicate identities fail closed. */
export function createProjectRegister(rows, provenance) {
  const source = validateProvenance(provenance);
  if (source.source_id !== 'project_register' || !Array.isArray(rows)) {
    throw new TypeError('a pinned project_register array is required');
  }
  const seen = new Set();
  const projects = rows.map((row) => {
    const repdRef = String(row?.repd_ref || '').trim();
    const longitude = Number(row?.longitude);
    const latitude = Number(row?.latitude);
    const technology = classifyProjectTechnology(row?.technology);
    if (!repdRef || seen.has(repdRef)) throw new TypeError('repd_ref must be present and unique');
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
        || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new TypeError('project register coordinates are invalid');
    }
    seen.add(repdRef);
    return Object.freeze({
      repd_ref: repdRef, longitude, latitude,
      technology: technology.technology,
      source_technology: technology.source_technology,
      technology_status: technology.status
    });
  });
  return Object.freeze({ source, projects: Object.freeze(projects) });
}

/** Exact identity lookup without replacing the complete nearby-search population. */
export function createProjectIndex(register) {
  if (!register || !Array.isArray(register.projects) || !register.source) {
    throw new TypeError('validated project register is required');
  }
  const byId = new Map(register.projects.map((project) => [project.repd_ref, project]));
  if (byId.size !== register.projects.length) throw new TypeError('project index lost identity');
  return Object.freeze({
    source: register.source,
    size: byId.size,
    get(repdRef) {
      if (typeof repdRef !== 'string' || !repdRef.trim()) throw new TypeError('repd_ref is required');
      return byId.get(repdRef) || null;
    },
    all: () => register.projects
  });
}

/** Resolve a project selection into a query request through exact identity. */
export function projectFindingRequest(selection, projectIndex) {
  const selected = validateSelection(selection);
  if (!projectIndex || !projectIndex.source
      || selected.source_release !== projectIndex.source.sha256) {
    throw new TypeError('project selection and register release do not match');
  }
  const project = projectIndex.get(selected.repd_ref);
  if (!project) throw new TypeError('project is absent from the pinned register');
  return Object.freeze({
    kind: 'project_finding_request',
    selection: selected,
    project,
    source: projectIndex.source
  });
}

/** Convert a legacy project deep link into one exact selection plus advisory transport. */
export function parseProjectDeepLink(input, projectIndex) {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('project deep link is required');
  const url = new URL(input, 'https://candidate.invalid/atlas/');
  const allowed = new Set([
    'repd_ref', 'project', 'technology', 'capacity_mw', 'latitude', 'longitude'
  ]);
  const names = [...url.searchParams.keys()];
  if (names.some((name) => !allowed.has(name)
      || url.searchParams.getAll(name).length !== 1)) {
    throw new TypeError('project deep link has unknown or duplicate fields');
  }
  const repdRef = url.searchParams.get('repd_ref');
  const selection = validateSelection({
    kind: 'project', repd_ref: repdRef, source_release: projectIndex?.source?.sha256
  });
  const request = projectFindingRequest(selection, projectIndex);
  const transportedTechnology = url.searchParams.get('technology');
  const diagnostics = [];
  let technology = null;
  if (transportedTechnology !== null) {
    technology = classifyProjectTechnology(transportedTechnology);
    if (technology.status === 'unknown') diagnostics.push('UNKNOWN_TRANSPORT_TECHNOLOGY');
    if (technology.source_technology !== request.project.source_technology) {
      diagnostics.push('TRANSPORT_TECHNOLOGY_DIFFERS_FROM_REGISTER');
    }
  } else {
    diagnostics.push('TECHNOLOGY_NOT_TRANSPORTED');
  }
  const transport = Object.freeze(Object.fromEntries(
    ['project', 'technology', 'capacity_mw', 'latitude', 'longitude']
      .map((name) => [name, url.searchParams.get(name)])
  ));
  return Object.freeze({
    kind: 'project_deep_link',
    selection,
    project: request.project,
    transport,
    technology,
    diagnostics: Object.freeze(diagnostics)
  });
}

/** Search every row in the pinned register through an injected canonical distance owner. */
export function nearbyProjects({ register, longitude, latitude, distanceKm, limit = 10 }) {
  if (typeof distanceKm !== 'function' || !Number.isInteger(limit) || limit < 1) {
    throw new TypeError('canonical distance function and positive integer limit are required');
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)
      || longitude < -180 || longitude > 180
      || typeof latitude !== 'number' || !Number.isFinite(latitude)
      || latitude < -90 || latitude > 90) {
    throw new TypeError('nearby query requires finite in-range numeric coordinates');
  }
  if (!register || !Array.isArray(register.projects) || !register.source) {
    throw new TypeError('validated project register is required');
  }
  const rows = register.projects.map((project) => ({
    repd_ref: project.repd_ref,
    source_release: register.source.sha256,
    distance_km: distanceKm(longitude, latitude, project.longitude, project.latitude)
  }));
  if (rows.some((row) => !Number.isFinite(row.distance_km) || row.distance_km < 0)) {
    throw new TypeError('canonical distance owner returned an invalid value');
  }
  return Object.freeze(orderCandidates(rows, { idField: 'repd_ref' }).slice(0, limit));
}

/** Stable ordering makes identical evidence yield identical candidates. */
export function orderCandidates(rows, { idField, distanceField = 'distance_km' }) {
  if (!Array.isArray(rows) || typeof idField !== 'string' || !idField) {
    throw new TypeError('candidate rows and identity field are required');
  }
  const copy = rows.map((row) => {
    const identity = String(row?.[idField] || '').trim();
    const distance = Number(row?.[distanceField]);
    if (!identity || !Number.isFinite(distance) || distance < 0) {
      throw new TypeError('candidate identity and non-negative distance are required');
    }
    return Object.freeze({ ...row, [idField]: identity, [distanceField]: distance });
  });
  copy.sort((left, right) => left[distanceField] - right[distanceField]
    || left[idField].localeCompare(right[idField], 'en'));
  return Object.freeze(copy);
}

/** Withhold a nearest claim when the evidence cannot distinguish the leaders. */
export function resolveNearestCandidate(rows, {
  idField, distanceField = 'distance_km', toleranceKm = 1e-9
}) {
  if (!Number.isFinite(toleranceKm) || toleranceKm < 0) {
    throw new TypeError('tie tolerance must be non-negative');
  }
  const ordered = orderCandidates(rows, { idField, distanceField });
  if (ordered.length === 0) {
    return Object.freeze({ status: 'withheld', reason: 'NO_CANDIDATE', value: null });
  }
  if (ordered.length > 1
      && Math.abs(ordered[1][distanceField] - ordered[0][distanceField]) <= toleranceKm) {
    return Object.freeze({ status: 'withheld', reason: 'AMBIGUOUS_TIE', value: null,
      candidate_ids: Object.freeze([ordered[0][idField], ordered[1][idField]]) });
  }
  return Object.freeze({ status: 'available', reason: null, value: ordered[0] });
}

/** One owner connects selection revisions to findings and rejects late results. */
export function createFindingLoop(query) {
  if (typeof query !== 'function') throw new TypeError('query function is required');
  const selections = createSelectionStore();
  let activeRequest = 0;
  return Object.freeze({
    read: selections.read,
    back() {
      activeRequest += 1;
      return selections.back();
    },
    forward() {
      activeRequest += 1;
      return selections.forward();
    },
    async select(selection) {
      const state = selections.select(selection);
      const request = ++activeRequest;
      try {
        const answer = await query(Object.freeze({ selection: state.selection, revision: state.revision }));
        if (request !== activeRequest) return Object.freeze({ accepted: false, reason: 'STALE_SELECTION' });
        if (!Array.isArray(answer)) throw new TypeError('query result must be an array');
        const findings = answer.map(validateFinding);
        if (findings.some((finding) => finding.selection_revision !== state.revision)) {
          throw new TypeError('query result revision does not match its selection');
        }
        return Object.freeze({ accepted: true, revision: state.revision, findings: Object.freeze(findings) });
      } catch (error) {
        if (request !== activeRequest) return Object.freeze({ accepted: false, reason: 'STALE_SELECTION' });
        const failure = validateFinding({
          type: 'unknown', evidence_class: 'unknown', status: 'failed',
          selection_revision: state.revision, value: null, unit: null,
          qualifiers: ['FAILED_CLOSED', String(error?.message || error)], provenance: []
        });
        return Object.freeze({ accepted: true, revision: state.revision,
          findings: Object.freeze([failure]) });
      }
    }
  });
}
