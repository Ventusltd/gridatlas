/**
 * Proof for the declared-connections module.
 *
 * The module was cut out of the sld-sandbox body, so the question that
 * matters most is PARITY: does the module hold exactly the records the
 * served cartridge held, and do its three functions answer exactly as the
 * served functions answered, on the same inputs? Both halves are read from
 * the last cartridge that carried the table inline (v9.67, 202609012250),
 * evaluated, and compared value for value. A transcription slip in a DCO
 * citation would fail here, not on a card.
 *
 *   node tools/proofs/modules/202609012130-declared-connections.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { isDeepStrictEqual } from 'node:util';

/* Values from two vm realms have two Object.prototypes, and a strict deep
   comparison would call every record different for that reason alone. A
   JSON round-trip strips the realm and keeps key order, which is exactly
   the comparison wanted: same keys, same order, same values. */
const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));
const same = (a, b) => isDeepStrictEqual(plain(a), plain(b));

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const MODULE = join(REPO, 'atlas', 'modules', '202609012128-declared-connections.js');
const GEODESY = join(REPO, 'atlas', 'modules', '202609011950-geodesy.js');
const BODY = join(REPO, 'atlas', 'parts', '202609012045-sld-sandbox-body.js');
/* The last served bytes that carried the table inline. Pinned on purpose:
   this is the record the module must reproduce, and it does not move. */
const LAST_INLINE = join(REPO, 'atlas', 'cartridges', '202609012250-sld-sandbox-v9-8.js');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

function fresh() {
  const box = { window: {}, console, Math, JSON, Number, String, Array, Object,
    Map, Set, Boolean, Error, RegExp };
  box.window.window = box.window;
  vm.createContext(box);
  return box;
}

const moduleSource = await readFile(MODULE, 'utf8');
const geodesySource = await readFile(GEODESY, 'utf8');
const body = await readFile(BODY, 'utf8');
const shipped = await readFile(LAST_INLINE, 'utf8');

console.log('\nit loads, and only after geodesy\n');
check('without geodesy it refuses to load, by name', (() => {
  try { vm.runInContext(moduleSource, fresh()); return false; }
  catch (error) { return /requires the geodesy module/.test(error.message); }
})());
const box = fresh();
vm.runInContext(geodesySource, box);
vm.runInContext(moduleSource, box);
const mod = box.window.__GRIDATLAS_MODULES__.declaredConnections;
check('with geodesy it registers a frozen surface',
  !!mod && Object.isFrozen(mod) && Object.isFrozen(mod.records));
check('loading it twice is a no-op, not a second table', (() => {
  vm.runInContext(moduleSource, box);
  return box.window.__GRIDATLAS_MODULES__.declaredConnections === mod;
})());

/* ── the record, value for value ─────────────────────────────────────── */

function inlineObject(text, name) {
  const start = text.indexOf(`const ${name} = Object.freeze({`);
  if (start < 0) throw new Error(`${name} not found in the served cartridge`);
  const end = text.indexOf('\n  });\n', start);
  const literal = text.slice(start + `const ${name} = Object.freeze(`.length, end + '\n  }'.length);
  return vm.runInNewContext(`(${literal})`, { Object });
}
const servedRecords = inlineObject(shipped, 'DECLARED_CONNECTIONS');
const servedWorks = inlineObject(shipped, 'SUBSTATION_WORKS');

console.log('\nparity with the last cartridge that carried the table inline\n');
check(`the served table had ${Object.keys(servedRecords).length} records and the module has the same count`,
  Object.keys(servedRecords).length === mod.count && mod.count === 19);
check('every record is identical, key for key and value for value',
  same(servedRecords, mod.records),
  Object.keys(servedRecords).filter(k => !same(servedRecords[k], mod.records[k])).join(', '));
check('the substation-works sentences are identical',
  same(servedWorks, mod.substationWorks));

/* ── the behaviour, answer for answer ────────────────────────────────── */

/* Evaluate the SERVED functions with their own table, and the module's
   geodesy for distance, so the only thing under comparison is the code
   that moved. */
function servedFunctions() {
  const from = shipped.indexOf('  function provisionalDeclaredConnection(repdRef) {');
  const to = shipped.indexOf('  function declaredBlockHtml(toSubstations) {');
  const code = shipped.slice(from, to);
  const ctx = { DECLARED_CONNECTIONS: servedRecords, SUBSTATION_WORKS: servedWorks,
    distanceKm: box.window.__GRIDATLAS_MODULES__.geodesy.distanceKm, Math, String, Array, Object };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.__fns = { provisionalDeclaredConnection, resolveDeclaredConnection, nearestTransmission };', ctx);
  return ctx.__fns;
}
const served = servedFunctions();

const ORIGIN = [-0.7500, 53.3200];
const SUBS = [
  { name: 'Cottam Substation', kv: [400, 132], at: [-0.7815, 53.3045] },
  { name: 'Cottam Substation', kv: [132], at: [-0.7900, 53.3000] },   // same name, wrong class
  { name: 'West Burton Substation', kv: [400], at: [-0.8090, 53.3620] },
  { name: 'High Marnham Substation', kv: [400], at: [-0.7860, 53.2320] },
  { name: 'Bicker Fen Substation', kv: [400], at: [-0.2560, 52.9230] },
  { name: 'Thorpe Marsh Substation', kv: [400], at: [-1.0810, 53.5760] },
  { name: '', kv: [400], at: [-0.7520, 53.3190] },                     // unnamed, nearest
  { name: 'Sturton Le Steeple', kv: [33], at: [-0.8300, 53.3300] }
];
const refs = [...Object.keys(servedRecords), '0', '', null, undefined, 'not-a-ref'];

console.log('\nthe module answers exactly as the served code answered\n');
check('provisional(): identical for every declared ref and for unknown refs',
  refs.every(r => same(mod.provisional(r), served.provisionalDeclaredConnection(r))),
  refs.filter(r => !same(mod.provisional(r), served.provisionalDeclaredConnection(r))).join(', '));
check('resolve(): identical with a full payload',
  refs.every(r => same(mod.resolve(r, ORIGIN, SUBS), served.resolveDeclaredConnection(r, ORIGIN, SUBS))));
check('resolve(): identical with an empty payload (every substation unmatched)',
  refs.every(r => same(mod.resolve(r, ORIGIN, []), served.resolveDeclaredConnection(r, ORIGIN, []))));
check('nearestTransmission(): identical, including the unnamed-wins-on-distance case',
  same(mod.nearestTransmission(ORIGIN, SUBS), served.nearestTransmission(ORIGIN, SUBS))
  && mod.nearestTransmission(ORIGIN, SUBS).name === 'Unnamed substation'
  && mod.nearestTransmission(ORIGIN, SUBS).named.name === 'Cottam Substation');
check('nearestTransmission(): null on a payload with nothing at 400 kV',
  mod.nearestTransmission(ORIGIN, SUBS.filter(s => s.kv[0] < 400)) === null
  && served.nearestTransmission(ORIGIN, SUBS.filter(s => s.kv[0] < 400)) === null);

console.log('\nwhat the record says about itself\n');
const records = Object.values(mod.records);
check('every record cites a public source', records.every(r => typeof r.source === 'string' && r.source.length > 10));
check('every record names a substation or a circuit, never neither',
  records.every(r => (r.poc_kind === 'circuit' ? !!r.circuit : !!r.substation)));
check('poc_status is one of the three states or absent',
  records.every(r => r.poc_status === undefined || ['existing', 'not_built', 'under_construction'].includes(r.poc_status)));
check('a far end that is not built carries a note saying so',
  records.filter(r => r.poc_status === 'not_built' || r.poc_status === 'under_construction')
    .every(r => typeof r.poc_status_note === 'string'));
check('a declared 400 kV substation match ignores a 132 kV site of the same name', (() => {
  const only132 = SUBS.filter(s => s.name === 'Cottam Substation' && s.kv[0] === 132);
  return mod.resolve('10914', ORIGIN, only132).at === null;
})());
check('isDeclared() is true for every record and false otherwise',
  Object.keys(mod.records).every(k => mod.isDeclared(k)) && !mod.isDeclared('0') && !mod.isDeclared(undefined));

console.log('\nthe body no longer carries the table\n');
check('the body declares no DECLARED_CONNECTIONS or SUBSTATION_WORKS of its own',
  !/const DECLARED_CONNECTIONS\b/.test(body) && !/const SUBSTATION_WORKS\b/.test(body));
check('the body throws by name when the module is absent',
  /throw new Error\('sld-sandbox requires the declared-connections module'\)/.test(body));
check('the body delegates all three functions',
  /return DECLARED\.provisional\(/.test(body) && /return DECLARED\.resolve\(/.test(body)
  && /return DECLARED\.nearestTransmission\(/.test(body));

console.log('\nit reads and nothing else\n');
check('it never fetches', !/\bfetch\s*\(/.test(moduleSource));
check('it never renders', !/document\.|innerHTML|appendChild/.test(moduleSource));
check('it never grades a connection',
  !/\b(likely|unlikely|feasible|viable|adequate|sufficient|strong|weak)\b/i.test(moduleSource.replace(/\/\*[\s\S]*?\*\//g, '')));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}
console.log('the public record moved without changing a single value, and the body binds to it or does not load.');
