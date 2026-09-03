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
  const longitude = Number(input.longitude);
  const latitude = Number(input.latitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new TypeError('longitude is invalid');
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
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
  if (input?.kind === 'project') return validateSelection(input);
  if (input?.kind === 'location') return validateCoordinateSelection(input);
  if (input?.kind === 'substation') return validateSubstationSelection(input);
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
  return validateCoordinateSelection({ kind, longitude: query.get('longitude'), latitude: query.get('latitude'), coordinate_origin: query.get('coordinate_origin') });
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
  if (input.status === 'available' ? input.value === null : input.value !== null || input.unit !== null) {
    throw new TypeError('finding value contradicts its status');
  }
  if (input.unit !== null && (typeof input.unit !== 'string' || !input.unit.trim())) {
    throw new TypeError('unit must be null or a non-empty string');
  }
  return Object.freeze({ ...input,
    qualifiers: Object.freeze([...input.qualifiers]),
    provenance: Object.freeze([...input.provenance])
  });
}
