const PROJECT_FIELDS = Object.freeze(['kind', 'repd_ref', 'source_release']);
const LOCATION_FIELDS = Object.freeze(['coordinate_origin', 'kind', 'latitude', 'longitude']);
const SUBSTATION_FIELDS = Object.freeze(['kind', 'site_code', 'source_release']);
const SHA256 = /^[0-9a-f]{64}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

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
