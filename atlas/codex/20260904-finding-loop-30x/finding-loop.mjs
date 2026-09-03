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
  'published_network_fact', 'model_result', 'road_route', 'corridor_estimate', 'unknown'
]);
const EVIDENCE_CLASSES = new Set(['published_fact', 'measurement', 'model_result', 'unknown']);
const EVIDENCE_CLASS_BY_TYPE = Object.freeze({
  declared_connection: 'published_fact',
  nearest_connection_point: 'measurement',
  mapped_segment: 'measurement',
  published_network_fact: 'published_fact',
  model_result: 'model_result',
  road_route: 'unknown',
  corridor_estimate: 'unknown',
  unknown: 'unknown'
});
const PROVENANCE_FIELDS = Object.freeze(['bytes', 'release', 'sha256', 'source_id']);
export const PROJECT_TECHNOLOGIES = Object.freeze([
  'act', 'bess', 'biomass', 'caes', 'flywheel', 'geothermal',
  'hydro', 'hydrogen', 'other', 'solar', 'solar_roof', 'tidal',
  'wind_offshore', 'wind_onshore'
]);
const PROJECT_TECHNOLOGY_SET = new Set(PROJECT_TECHNOLOGIES);
const EARTH_RADIUS_KM = 6378.137;

/** Estate-standard spherical haversine using the fixed WGS-84 semi-major radius. */
export function haversineR6378137Km(longitude1, latitude1, longitude2, latitude2) {
  for (const [name, value, minimum, maximum] of [
    ['longitude1', longitude1, -180, 180], ['latitude1', latitude1, -90, 90],
    ['longitude2', longitude2, -180, 180], ['latitude2', latitude2, -90, 90]
  ]) {
    if (typeof value !== 'number' || !Number.isFinite(value)
        || value < minimum || value > maximum) {
      throw new TypeError(`${name} is invalid`);
    }
  }
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(latitude2 - latitude1);
  const longitudeDelta = radians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2))
      * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  if (typeof text !== 'string') throw new TypeError('selection query must be a string');
  const query = new URLSearchParams(text.replace(/^\?/, ''));
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
  if (!Array.isArray(input.qualifiers)
      || input.qualifiers.some((item) => typeof item !== 'string'
        || !item || item !== item.trim() || CONTROL_CHARACTER.test(item))) {
    throw new TypeError('qualifiers must be canonical strings');
  }
  if (!Array.isArray(input.provenance)) throw new TypeError('provenance must be an array');
  if (input.evidence_class !== 'unknown' && input.provenance.length === 0) {
    throw new TypeError('evidenced findings require provenance');
  }
  if (input.status === 'available') {
    if (input.evidence_class === 'unknown' || input.value === null
        || !['string', 'number', 'boolean'].includes(typeof input.value)
        || (typeof input.value === 'number' && !Number.isFinite(input.value))
        || (typeof input.value === 'string' && (!input.value || input.value !== input.value.trim()
          || CONTROL_CHARACTER.test(input.value)))) {
      throw new TypeError('available finding value is invalid for its type');
    }
  } else if (input.value !== null || input.unit !== null) {
    throw new TypeError('withheld and failed findings cannot carry a value or unit');
  }
  if (['nearest_connection_point', 'mapped_segment'].includes(input.type)
      && input.status === 'available'
      && (typeof input.value !== 'number' || input.value < 0 || input.unit !== 'km')) {
    throw new TypeError('distance measurement requires a non-negative number in km');
  }
  if (input.evidence_class === 'unknown' && input.provenance.length !== 0) {
    throw new TypeError('unknown finding cannot claim evidence provenance');
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

/** Attach inspectable target identity and population scope to a distance finding. */
export function createScopedDistanceFinding({
  type, distance_km: distanceKm, selection_revision: selectionRevision,
  provenance, qualifiers = [], target, scope
}) {
  if (target === null || typeof target !== 'object' || Array.isArray(target)
      || scope === null || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new TypeError('distance target and scope are required');
  }
  const targetFields = ['target_id', 'target_name', 'operator', 'voltage_kv', 'longitude', 'latitude'];
  const targetDescriptors = Object.getOwnPropertyDescriptors(target);
  if (targetFields.some((field) => !Object.hasOwn(targetDescriptors, field)
      || !Object.hasOwn(targetDescriptors[field], 'value'))) {
    throw new TypeError('distance target fields must be data properties');
  }
  const targetId = targetDescriptors.target_id.value;
  const targetName = targetDescriptors.target_name.value;
  const operator = targetDescriptors.operator.value;
  const voltageKv = targetDescriptors.voltage_kv.value;
  const longitude = targetDescriptors.longitude.value;
  const latitude = targetDescriptors.latitude.value;
  if (typeof targetId !== 'string' || !targetId || targetId !== targetId.trim()
      || CONTROL_CHARACTER.test(targetId)) throw new TypeError('target_id is invalid');
  for (const [field, value] of [['target_name', targetName], ['operator', operator]]) {
    if (value !== null && (typeof value !== 'string' || !value || value !== value.trim()
        || CONTROL_CHARACTER.test(value))) throw new TypeError(`${field} is invalid`);
  }
  if (!Array.isArray(voltageKv) || voltageKv.length === 0
      || voltageKv.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new TypeError('voltage_kv must be positive integer values');
  }
  validateCoordinateSelection({
    kind: 'location', longitude, latitude, coordinate_origin: 'mapped_feature'
  });
  const scopeFields = ['candidate_count', 'geometry', 'located_count', 'predicate', 'total_count'];
  const scopeDescriptors = Object.getOwnPropertyDescriptors(scope);
  if (scopeFields.some((field) => !Object.hasOwn(scopeDescriptors, field)
      || !Object.hasOwn(scopeDescriptors[field], 'value'))) {
    throw new TypeError('distance scope fields must be data properties');
  }
  const candidateCount = scopeDescriptors.candidate_count.value;
  const geometry = scopeDescriptors.geometry.value;
  if (!Number.isInteger(candidateCount) || candidateCount < 1
      || geometry !== 'haversine_r6378_137_km') {
    throw new TypeError('distance scope candidate count or geometry is invalid');
  }
  const coverage = coverageBoundary({
    predicate: scopeDescriptors.predicate.value,
    located: scopeDescriptors.located_count.value,
    total: scopeDescriptors.total_count.value
  });
  if (candidateCount > coverage.located) throw new TypeError('candidate count exceeds coverage');
  return Object.freeze({
    finding: createDistanceFinding({
      type, distance_km: distanceKm, selection_revision: selectionRevision,
      provenance, qualifiers
    }),
    target: Object.freeze({
      target_id: targetId, target_name: targetName, operator,
      voltage_kv: Object.freeze([...voltageKv]), longitude, latitude
    }),
    scope: Object.freeze({
      predicate: coverage.predicate, candidate_count: candidateCount,
      located_count: coverage.located, total_count: coverage.total,
      coverage_ratio: coverage.ratio, geometry
    })
  });
}

/** Road distance is unavailable until a pinned graph and routing receipt exist. */
export function createRoadRouteFinding(selectionRevision) {
  return validateFinding({
    type: 'road_route', evidence_class: 'unknown', status: 'withheld',
    selection_revision: selectionRevision, value: null, unit: null,
    qualifiers: ['ROAD_ROUTE_NOT_COMPUTED', 'AUTHORITATIVE_ROAD_GRAPH_UNAVAILABLE'],
    provenance: []
  });
}

/** Refuse to reuse the 1.245 buried-circuit calibration for incompatible geometry. */
export function createCorridorEstimateFinding(selectionRevision, basis) {
  const disallowed = new Set([
    'arbitrary_click_to_line', 'straight_line_to_substation',
    'overhead_or_unknown_asset', 'unvalidated_route'
  ]);
  if (!disallowed.has(basis)) throw new TypeError('corridor estimate basis is unsupported');
  return validateFinding({
    type: 'corridor_estimate', evidence_class: 'unknown', status: 'withheld',
    selection_revision: selectionRevision, value: null, unit: null,
    qualifiers: ['CORRIDOR_ESTIMATE_NOT_COMPUTED', 'CALIBRATION_1_245_NOT_APPLICABLE', basis],
    provenance: []
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
    if (row === null || typeof row !== 'object' || Array.isArray(row)
        || (Object.getPrototypeOf(row) !== Object.prototype && Object.getPrototypeOf(row) !== null)
        || Object.getOwnPropertySymbols(row).length) {
      throw new TypeError('project row must be a plain string-keyed object');
    }
    const descriptors = Object.getOwnPropertyDescriptors(row);
    const required = ['repd_ref', 'longitude', 'latitude', 'technology'];
    if (required.some((field) => !Object.hasOwn(descriptors, field)
        || !Object.hasOwn(descriptors[field], 'value'))) {
      throw new TypeError('project row fields must be present data properties');
    }
    const repdRef = descriptors.repd_ref.value;
    const longitude = descriptors.longitude.value;
    const latitude = descriptors.latitude.value;
    const technology = classifyProjectTechnology(descriptors.technology.value);
    if (typeof repdRef !== 'string' || !repdRef || repdRef !== repdRef.trim()
        || CONTROL_CHARACTER.test(repdRef) || seen.has(repdRef)) {
      throw new TypeError('repd_ref must be canonical and unique');
    }
    if (typeof longitude !== 'number' || !Number.isFinite(longitude)
        || longitude < -180 || longitude > 180
        || typeof latitude !== 'number' || !Number.isFinite(latitude)
        || latitude < -90 || latitude > 90) {
      throw new TypeError('project register coordinates are invalid');
    }
    seen.add(repdRef);
    const optionalString = (field) => {
      if (!Object.hasOwn(descriptors, field)) return null;
      if (!Object.hasOwn(descriptors[field], 'value')) {
        throw new TypeError(`project ${field} must be a data property`);
      }
      const value = descriptors[field].value;
      if (value === null) return null;
      if (typeof value !== 'string' || !value || value !== value.trim()
          || CONTROL_CHARACTER.test(value)) {
        throw new TypeError(`project ${field} must be a canonical string or null`);
      }
      return value;
    };
    let capacityMw = null;
    if (Object.hasOwn(descriptors, 'capacity_mw')) {
      if (!Object.hasOwn(descriptors.capacity_mw, 'value')) {
        throw new TypeError('project capacity_mw must be a data property');
      }
      capacityMw = descriptors.capacity_mw.value;
      if (capacityMw !== null && (typeof capacityMw !== 'number'
          || !Number.isFinite(capacityMw) || capacityMw < 0)) {
        throw new TypeError('project capacity_mw must be a non-negative number or null');
      }
    }
    return Object.freeze({
      repd_ref: repdRef, longitude, latitude,
      technology: technology.technology,
      source_technology: technology.source_technology,
      technology_status: technology.status,
      name: optionalString('name'),
      operator: optionalString('operator'),
      capacity_mw: capacityMw,
      status: optionalString('status')
    });
  });
  return Object.freeze({ source, projects: Object.freeze(projects) });
}

/** Boundary adapter from the immutable Grid registry document into strict core rows. */
export function createProjectRegisterFromDocument(document, provenance) {
  const source = validateProvenance(provenance);
  if (document === null || typeof document !== 'object' || Array.isArray(document)
      || !Array.isArray(document.records)
      || document.schema !== 'gridatlas.browser-registry.v1'
      || typeof document.generation !== 'string' || !/^\d{12}$/.test(document.generation)
      || source.source_id !== 'project_register'
      || source.release !== `${document.generation}:data/repd_browser_registry_${document.generation}.json`) {
    throw new TypeError('project register document and pinned generation disagree');
  }
  const rows = document.records.map((record) => {
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError('project register source row is invalid');
    }
    if (typeof record.name !== 'string' || !record.name
        || record.name !== record.name.trim() || CONTROL_CHARACTER.test(record.name)
        || (record.repd_operator_or_applicant !== null
          && (typeof record.repd_operator_or_applicant !== 'string'
            || !record.repd_operator_or_applicant
            || record.repd_operator_or_applicant !== record.repd_operator_or_applicant.trim()
            || CONTROL_CHARACTER.test(record.repd_operator_or_applicant)))
        || typeof record.capacity_mw !== 'number' || !Number.isFinite(record.capacity_mw)
        || record.capacity_mw < 0
        || typeof record.status !== 'string' || !record.status
        || record.status !== record.status.trim() || CONTROL_CHARACTER.test(record.status)) {
      throw new TypeError('project register source facts are malformed');
    }
    return {
      repd_ref: record.repd_ref,
      longitude: record.longitude,
      latitude: record.latitude,
      technology: record.technology,
      name: record.name,
      operator: record.repd_operator_or_applicant,
      capacity_mw: record.capacity_mw,
      status: record.status
    };
  });
  return createProjectRegister(rows, source);
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
    'repd_ref', 'project', 'technology', 'capacity_mw', 'latitude', 'longitude', 'zoom'
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
    ['project', 'technology', 'capacity_mw', 'latitude', 'longitude', 'zoom']
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
    if (row === null || typeof row !== 'object' || Array.isArray(row)
        || (Object.getPrototypeOf(row) !== Object.prototype && Object.getPrototypeOf(row) !== null)
        || Object.getOwnPropertySymbols(row).length) {
      throw new TypeError('candidate row must be a plain string-keyed object');
    }
    const descriptors = Object.getOwnPropertyDescriptors(row);
    if (Object.entries(descriptors).some(([, descriptor]) => !Object.hasOwn(descriptor, 'value'))) {
      throw new TypeError('candidate fields must be data properties');
    }
    if (!Object.hasOwn(descriptors, idField) || !Object.hasOwn(descriptors[idField], 'value')
        || !Object.hasOwn(descriptors, distanceField)
        || !Object.hasOwn(descriptors[distanceField], 'value')) {
      throw new TypeError('candidate identity and distance must be data properties');
    }
    const identity = descriptors[idField].value;
    const distance = descriptors[distanceField].value;
    if (typeof identity !== 'string' || !identity || identity !== identity.trim()
        || CONTROL_CHARACTER.test(identity)
        || typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) {
      throw new TypeError('candidate identity and non-negative distance are required');
    }
    const snapshot = Object.fromEntries(Object.entries(descriptors)
      .map(([field, descriptor]) => [field, descriptor.value]));
    return Object.freeze({ ...snapshot, [idField]: identity, [distanceField]: distance });
  });
  copy.sort((left, right) => left[distanceField] - right[distanceField]
    || (left[idField] < right[idField] ? -1 : left[idField] > right[idField] ? 1 : 0));
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

/** One shared substation computation owner for Map, Pipeline and World adapters. */
export function createGridFindingEngine({ projectIndex, substationFeatures, provenance }) {
  const source = validateProvenance(provenance);
  if (!projectIndex || typeof projectIndex.get !== 'function'
      || !Array.isArray(substationFeatures)) {
    throw new TypeError('project index and substation feature array are required');
  }
  const totalCount = substationFeatures.length;
  const substations = substationFeatures.map((feature) => {
    const id = feature?.id;
    const coordinates = feature?.geometry?.type === 'Point'
      ? feature.geometry.coordinates : null;
    const voltageText = feature?.properties?.voltage;
    if (typeof id !== 'string' || !id || !Array.isArray(coordinates)
        || coordinates.length < 2 || typeof coordinates[0] !== 'number'
        || typeof coordinates[1] !== 'number' || typeof voltageText !== 'string') return null;
    const voltages = voltageText.split(';').map((value) => Number(value) / 1000)
      .filter((value) => Number.isInteger(value) && value > 0);
    if (voltages.length === 0) return null;
    const canonicalNullable = (value) => typeof value === 'string' && value.trim()
      ? value.trim() : null;
    return Object.freeze({
      id,
      longitude: coordinates[0], latitude: coordinates[1],
      voltage_kv: Object.freeze(voltages),
      name: canonicalNullable(feature.properties?.name),
      operator: canonicalNullable(feature.properties?.operator)
    });
  }).filter(Boolean);

  const query = ({ selection, revision, minimum_voltage_kv: minimumVoltageKv, named_only: namedOnly = false }) => {
    if (!Number.isInteger(revision) || revision < 1
        || !Number.isInteger(minimumVoltageKv) || minimumVoltageKv < 1
        || typeof namedOnly !== 'boolean') {
      throw new TypeError('grid query revision, voltage and named_only are invalid');
    }
    const request = projectFindingRequest(selection, projectIndex);
    const candidates = substations.filter((site) =>
      site.voltage_kv.some((voltage) => voltage >= minimumVoltageKv)
        && (!namedOnly || site.name !== null))
      .map((site) => ({
        ...site,
        distance_km: haversineR6378137Km(
          request.project.longitude, request.project.latitude,
          site.longitude, site.latitude
        )
      }))
      .sort((left, right) => left.distance_km - right.distance_km
        || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    const predicate = `valid point geometry${namedOnly ? ', non-empty name,' : ' and'} any voltage_kv >= ${minimumVoltageKv}`;
    if (candidates.length === 0) {
      return Object.freeze({
        state: 'REASON', reason: 'NO_ELIGIBLE_SUBSTATION',
        selection: request.selection, project: request.project,
        predicate, candidate_count: 0, total_count: totalCount
      });
    }
    const nearest = candidates[0];
    return Object.freeze({
      state: 'RESULT', reason: null,
      selection: request.selection, project: request.project,
      scoped_finding: createScopedDistanceFinding({
        type: 'nearest_connection_point', distance_km: nearest.distance_km,
        selection_revision: revision, provenance: [source],
        qualifiers: [
          `MINIMUM_VOLTAGE_${minimumVoltageKv}_KV`,
          namedOnly ? 'NAMED_TARGET_REQUIRED' : 'UNNAMED_TARGET_ALLOWED'
        ],
        target: {
          target_id: nearest.id, target_name: nearest.name,
          operator: nearest.operator, voltage_kv: nearest.voltage_kv,
          longitude: nearest.longitude, latitude: nearest.latitude
        },
        scope: {
          predicate, candidate_count: candidates.length,
          located_count: candidates.length, total_count: totalCount,
          geometry: 'haversine_r6378_137_km'
        }
      })
    });
  };

  return Object.freeze({
    source,
    query,
    queryProfiles({ selection, revision }) {
      const profiles = Object.freeze([
        query({ selection, revision, minimum_voltage_kv: 33 }),
        query({ selection, revision, minimum_voltage_kv: 400 }),
        query({ selection, revision, minimum_voltage_kv: 400, named_only: true })
      ]);
      return Object.freeze({
        state: profiles.every((profile) => profile.state === 'RESULT') ? 'RESULT' : 'REASON',
        selection: validateSelection(selection), revision,
        profiles,
        road_route: createRoadRouteFinding(revision),
        corridor_estimate: createCorridorEstimateFinding(revision, 'straight_line_to_substation')
      });
    }
  });
}

/** Cold-arrival state machine: every deep link is measuring, a result, or a reason. */
export function createProjectArrivalAdapter({ projectIndex, engine, clock }) {
  if (!projectIndex || typeof projectIndex.get !== 'function'
      || !engine || typeof engine.queryProfiles !== 'function'
      || typeof clock !== 'function') {
    throw new TypeError('project index, shared engine and monotonic clock are required');
  }
  let request = 0;
  let state = Object.freeze({
    phase: 'NEVER_MEASURED', reason: 'NO_SELECTION',
    identity: null, project: null, result: null,
    started_ms: null, elapsed_ms: null
  });
  const elapsed = (started) => {
    const ended = clock();
    if (typeof ended !== 'number' || !Number.isFinite(ended) || ended < started) {
      throw new TypeError('clock must be finite and monotonic');
    }
    return ended - started;
  };
  return Object.freeze({
    read: () => state,
    async arrive(link) {
      const active = ++request;
      const started = clock();
      if (typeof started !== 'number' || !Number.isFinite(started)) {
        throw new TypeError('clock must return a finite number');
      }
      let arrival;
      try {
        arrival = parseProjectDeepLink(link, projectIndex);
      } catch {
        state = Object.freeze({
          phase: 'REASON', reason: 'INVALID_PROJECT_DEEP_LINK',
          identity: null, project: null, result: null,
          started_ms: started, elapsed_ms: elapsed(started)
        });
        return state;
      }
      const identity = arrival.selection;
      const project = Object.freeze({
        name: arrival.project.name,
        operator: arrival.project.operator,
        technology: arrival.project.technology,
        source_technology: arrival.project.source_technology,
        capacity_mw: arrival.project.capacity_mw,
        status: arrival.project.status
      });
      state = Object.freeze({
        phase: 'MEASURING', reason: null, identity, project, result: null,
        started_ms: started, elapsed_ms: null
      });
      try {
        await Promise.resolve();
        const answer = await engine.queryProfiles({ selection: identity, revision: active });
        if (active !== request) return Object.freeze({ phase: 'STALE', reason: 'NEWER_ARRIVAL' });
        const result = Object.freeze({
          profiles: Object.freeze(answer.profiles.map((profile) =>
            profile.state === 'RESULT' ? profile.scoped_finding : Object.freeze({
              state: 'REASON', reason: profile.reason, predicate: profile.predicate,
              candidate_count: profile.candidate_count, total_count: profile.total_count
            }))),
          road_route: answer.road_route,
          corridor_estimate: answer.corridor_estimate
        });
        const reasonProfile = answer.profiles.find((profile) => profile.state !== 'RESULT');
        state = Object.freeze({
          phase: reasonProfile ? 'REASON' : 'RESULT',
          reason: reasonProfile?.reason || null,
          identity, project, result,
          started_ms: started, elapsed_ms: elapsed(started)
        });
        return state;
      } catch {
        if (active !== request) return Object.freeze({ phase: 'STALE', reason: 'NEWER_ARRIVAL' });
        state = Object.freeze({
          phase: 'REASON', reason: 'GRID_FINDING_FAILED',
          identity, project, result: null,
          started_ms: started, elapsed_ms: elapsed(started)
        });
        return state;
      }
    }
  });
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
          qualifiers: ['FAILED_CLOSED', 'QUERY_FAILED'], provenance: []
        });
        return Object.freeze({ accepted: true, revision: state.revision,
          findings: Object.freeze([failure]) });
      }
    }
  });
}
