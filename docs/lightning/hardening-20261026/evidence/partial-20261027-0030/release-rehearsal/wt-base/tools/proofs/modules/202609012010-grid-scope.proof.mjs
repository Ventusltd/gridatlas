/**
 * Proof for the grid-scope module.
 *
 * The arithmetic is easy; the discipline is the point. A scope that
 * counts substations near a blank patch of farmland is one careless
 * sentence away from reading as "there is capacity here", which is the
 * one claim this estate must never make. So the checks below test the
 * counting AND test that the refusal travels inside the result.
 *
 *   node tools/proofs/modules/202609012010-grid-scope.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

const scopeSource = await readFile(
  join(REPO, 'atlas', 'modules', '202609012010-grid-scope.js'), 'utf8');

const box = { window: {}, console, Math, JSON, Number, String, Array, Object,
  Map, Set, Boolean, Error, RegExp };
box.window.window = box.window;
box.globalThis = box;
vm.createContext(box);
for (const name of ['202609011950-geodesy.js', '202609012010-grid-scope.js']) {
  vm.runInContext(await readFile(join(REPO, 'atlas', 'modules', name), 'utf8'),
    box, { filename: name });
}
const modules = box.window.__GRIDATLAS_MODULES__;
const gridScope = modules.gridScope;

console.log('\nit loads, and refuses to load alone\n');
check('the module registers',
  gridScope?.schema === 'gridatlas.module.grid-scope.v1');
check('it refuses without geodesy', (() => {
  const bare = { window: {}, console, Math, JSON, Number, String, Array, Object,
    Map, Set, Boolean, Error, RegExp };
  bare.window.window = bare.window;
  bare.globalThis = bare;
  vm.createContext(bare);
  try {
    vm.runInContext(
      // read again rather than reuse, so this is the real file
      scopeSource, bare, { filename: 'alone.js' });
    return false;
  } catch (error) { return /requires the geodesy module/.test(String(error.message)); }
})());

/* A synthetic network with known geometry: everything is placed by
   construction so the expected answer is arithmetic, not observation.
   0.01 degrees of latitude is about 1.11 km. */
const HOME = [-0.7, 53.3];
const at = (dLat) => [HOME[0], HOME[1] + dLat];
const SUBSTATIONS = [
  { name: 'Very Near 400', at: at(0.009), kv: [400], operator: 'NGET' },   // ~1.0 km
  { name: 'Near 132', at: at(0.03), kv: [132], operator: 'DNO' },          // ~3.3 km
  { name: '', at: at(0.035), kv: [275], operator: '' },                    // ~3.9 km unnamed
  { name: 'Mid 33', at: at(0.08), kv: [33], operator: 'DNO' },             // ~8.9 km
  { name: 'Far 400', at: at(0.2), kv: [400], operator: 'NGET' },           // ~22.2 km
  { name: 'Beyond', at: at(0.4), kv: [400], operator: 'NGET' },            // ~44.5 km
  { name: 'Malformed', at: null, kv: [400] }
];

console.log('\nit counts what is there, in bands\n');
const result = gridScope.scope(HOME, SUBSTATIONS, {});
check('the far substation beyond the outer band is excluded',
  result.counted === 5, String(result.counted));
check('a malformed entry is skipped rather than throwing',
  result.nearest.every(entry => Array.isArray(entry.at)));
check('bands are cumulative and ordered',
  result.bands.map(band => band.within_km).join(',') === '2,5,10,25'
  && result.bands.every((band, index) =>
    index === 0 || band.substations >= result.bands[index - 1].substations));
check('the 2 km band holds only the one substation that is inside it',
  result.bands[0].substations === 1 && result.bands[0].highest_class_kv === 400);
check('the 5 km band adds the 132 and the unnamed 275',
  result.bands[1].substations === 3
  && result.bands[1].by_class_kv['132'] === 1
  && result.bands[1].by_class_kv['275'] === 1);
check('the 25 km band reaches the far 400',
  result.bands[3].substations === 5 && result.bands[3].by_class_kv['400'] === 2);
check('nearest is sorted by measured distance',
  result.nearest.every((entry, index) =>
    index === 0 || entry.km >= result.nearest[index - 1].km));
check('the nearest is the one placed nearest, at about a kilometre',
  result.nearest[0].name === 'Very Near 400'
  && Math.abs(result.nearest[0].km - 1.0) < 0.1,
  result.nearest[0].km.toFixed(3));

console.log('\nnamed and unnamed are both reported, and kept apart\n');
check('an unnamed node can be the nearest of all',
  result.nearest.some(entry => !entry.name));
check('but the named list contains only named sites',
  result.nearest_named.every(entry => entry.name));
check('the nearest transmission-class site is identified separately',
  result.nearest_transmission?.kv >= 275);

console.log('\nthe voltage floor is honoured\n');
const only400 = gridScope.scope(HOME, SUBSTATIONS, { minimumKv: 400 });
check('a 400 kV floor excludes everything below it',
  only400.nearest.every(entry => entry.kv >= 400) && only400.counted === 2,
  String(only400.counted));
check('classOf maps a voltage to its class, and refuses below the floor',
  gridScope.classOf(400) === 400 && gridScope.classOf(132) === 132
  && gridScope.classOf(11) === null);

console.log('\nwhat it refuses to say travels inside the result\n');
check('the result states what it is',
  /census of the substations/.test(result.what_this_is));
check('the result states what it is not, in the same object',
  /Not a statement about capacity, headroom/.test(result.what_this_is_not)
  && /Distance is not capacity/.test(result.what_this_is_not));
check('it names queue position and consent as the things it cannot see',
  /queue position/.test(result.what_this_is_not)
  && /consent/.test(result.what_this_is_not));
check('the method and the radius are carried with the numbers',
  /haversine/.test(result.method) && /6378\.137/.test(result.method));
check('no grading language anywhere in the module', (() => {
  const code = scopeSource.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(line => line.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  return !/\b(available|opportunity|suitable|viable|good|strong|attractive|headroom exists)\b/i
    .test(code);
})());

console.log('\nedge cases\n');
check('an empty network scopes to nothing rather than throwing',
  gridScope.scope(HOME, [], {}).counted === 0);
check('an empty scope still carries its refusal',
  /Not a statement about capacity/.test(gridScope.scope(HOME, [], {}).what_this_is_not));
check('a null network is survivable',
  gridScope.scope(HOME, null, {}).counted === 0);

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}
console.log('the scope counts what is mapped, names what it cannot know, and '
  + 'carries both together.');
