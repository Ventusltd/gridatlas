const PROJECT_FIELDS = Object.freeze(['kind', 'repd_ref', 'source_release']);
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
