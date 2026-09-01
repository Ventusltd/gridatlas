/**
 * Parity proof: the new modules against the 4,000-line incumbent.
 *
 * Vikram, 2026-09-01: "do not risk what you have built… modularise and
 * test against the 4000+ lines."
 *
 * So nothing is swapped here. The composed cartridges are untouched and
 * still live. This loads BOTH the incumbent cartridge and the extracted
 * modules into separate contexts, runs the same inputs through each, and
 * asserts the answers are identical. Only when a module has proven itself
 * equal to the code it would replace does replacing it become a question
 * worth asking.
 *
 * The incumbent exposes what this needs already:
 *   sandbox cartridge      link.measure = { distanceKm, voltagesKv,
 *                          representativePoint }
 *   substation cartridge   state.byName, state.nearest
 *
 *   node tools/proofs/modules/202609011950-module-parity.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const CURRENT = JSON.parse(await readFile(join(REPO, 'atlas', 'current.json'), 'utf8'));

const MODULES = [
  '202609011950-geodesy.js',
  '202609011950-substation-lookup.js'
];

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

/* ── load the modules alone, with nothing else present ─────────────────── */

function loadModules() {
  const box = { window: {}, console, Math, JSON, Number, String, Array, Object,
    Map, Set, Boolean, Error, RegExp, isNaN, parseFloat };
  box.window.window = box.window;
  box.globalThis = box;
  vm.createContext(box);
  return box;
}

const moduleSource = new Map();
for (const name of MODULES) {
  moduleSource.set(name, await readFile(join(REPO, 'atlas', 'modules', name), 'utf8'));
}

const moduleBox = loadModules();
for (const name of MODULES) {
  vm.runInContext(moduleSource.get(name), moduleBox, { filename: name });
}
const modules = moduleBox.window.__GRIDATLAS_MODULES__;

console.log('\nthe modules load alone, and declare themselves\n');
check('geodesy registers', modules?.geodesy?.schema === 'gridatlas.module.geodesy.v1');
check('substation-lookup registers',
  modules?.substationLookup?.schema === 'gridatlas.module.substation-lookup.v1');
check('the estate radius is the estate radius',
  modules.geodesy.EARTH_RADIUS_KM === 6378.137);
check('a module refuses to load without its dependency', (() => {
  const bare = loadModules();
  try {
    vm.runInContext(moduleSource.get('202609011950-substation-lookup.js'), bare,
      { filename: 'lookup-alone.js' });
    return false;   // it should have thrown
  } catch (error) {
    return /requires the geodesy module/.test(String(error.message));
  }
})());

/* ── load the incumbent sandbox cartridge ──────────────────────────────── */

const sandboxEntry = CURRENT.cartridges.find(c => c.id === 'sld-sandbox');
const sandboxSource = await readFile(
  join(REPO, 'atlas', sandboxEntry.path.replace('./', '')), 'utf8');

function makeElement(tag) {
  return { tagName: tag, style: {}, dataset: {}, children: [], classList: {
      add() {}, remove() {}, contains: () => false, toggle: () => false },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    getAttribute: () => null, querySelector: () => null, querySelectorAll: () => [],
    remove() {}, closest: () => null, getBoundingClientRect: () => ({
      x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 })
  };
}

class MutationObserverStub { observe() {} disconnect() {} }

function sandboxContext() {
  const documentStub = {
    baseURI: 'https://ventusltd.github.io/gridatlas/atlas/',
    head: makeElement('head'), body: makeElement('body'), _byId: new Map(),
    getElementById() { return null; }, createElement: makeElement,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}
  };
  const box = {
    window: { initVentusMap: (options) => options, matchMedia: () => ({ matches: false }),
      requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
      MutationObserver: MutationObserverStub, location: { search: '' },
      addEventListener() {}, innerWidth: 1280 },
    document: documentStub, console,
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
    URL, Math, JSON, Number, String, Array, Object, Set, Map, Boolean, Error, RegExp,
    setTimeout, clearTimeout, setInterval, clearInterval, performance,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    MutationObserver: MutationObserverStub
  };
  box.window.maplibregl = { Map: class { constructor() {} on() {} once() {}
    getStyle() { return { layers: [] }; } isStyleLoaded() { return false; }
    getContainer() { return makeElement('div'); } }, Popup: class {} };
  box.maplibregl = box.window.maplibregl;
  box.window.window = box.window;
  box.globalThis = box;
  return box;
}

const sandboxBox = sandboxContext();
vm.createContext(sandboxBox);
vm.runInContext(sandboxSource, sandboxBox, { filename: 'sld-sandbox.js' });
const incumbent = sandboxBox.window.__GRIDATLAS_NEON_LINKS__?.measure;

console.log('\nparity: geodesy against the incumbent measurement\n');
check('the incumbent exposes its measurement for comparison', Boolean(incumbent));

/* Cases chosen because each one has bitten this estate at least once. */
const DISTANCE_CASES = [
  ['Cottam to its substation', -0.643208, 53.352088, -0.78, 53.3],
  ['West Burton to its PoC', -0.6774547, 53.2926216, -0.812, 53.361],
  ['Cleve Hill, a two-kilometre hop', 0.913885, 51.338767, 0.9404896, 51.3381981],
  ['the length of GB', -1.0, 50.0, -1.0, 58.0],
  ['identical points', -1.0, 53.0, -1.0, 53.0],
  ['across the prime meridian', -0.001, 51.5, 0.001, 51.5]
];
let distancesEqual = true;
for (const [label, lon1, lat1, lon2, lat2] of DISTANCE_CASES) {
  const a = incumbent.distanceKm(lon1, lat1, lon2, lat2);
  const b = modules.geodesy.distanceKm(lon1, lat1, lon2, lat2);
  const same = Math.abs(a - b) < 1e-12;
  if (!same) distancesEqual = false;
  check(`distance parity: ${label}`, same, same ? '' : `${a} vs ${b}`);
}
check('every distance case agrees to floating point', distancesEqual);

console.log('\nparity: the voltage contract, where magnitude is not the unit\n');
const VOLTAGE_CASES = [
  ['a 400 kV substation', { voltage: '400000' }],
  ['two voltages at one site', { voltage: '400000;275000' }],
  ['the traction supply that read as 750 kV', { voltage: '33000;750' }],
  ['a 415 V works supply', { voltage: '33000;11000;415' }],
  ['an explicit kv property', { kv: '132' }],
  ['nothing at all', {}],
  ['a malformed token', { voltage: 'not a number' }]
];
for (const [label, properties] of VOLTAGE_CASES) {
  const a = JSON.stringify(incumbent.voltagesKv(properties));
  const b = JSON.stringify(modules.geodesy.voltagesKv(properties));
  check(`voltage parity: ${label}`, a === b, a === b ? '' : `${a} vs ${b}`);
}

console.log('\nparity: representative point, where a polygon is not its first corner\n');
const GEOMETRY_CASES = [
  ['a point', { type: 'Point', coordinates: [-1.5, 53.2] }],
  ['a square polygon', { type: 'Polygon', coordinates: [[[0, 0], [0, 2], [2, 2], [2, 0]]] }],
  ['a multipolygon', { type: 'MultiPolygon',
    coordinates: [[[[1, 1], [1, 3], [3, 3], [3, 1]]]] }],
  ['a line', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }],
  ['nothing', null]
];
for (const [label, geometry] of GEOMETRY_CASES) {
  const a = JSON.stringify(incumbent.representativePoint(geometry));
  const b = JSON.stringify(modules.geodesy.representativePoint(geometry));
  check(`geometry parity: ${label}`, a === b, a === b ? '' : `${a} vs ${b}`);
}

check('the one deliberate difference is defensive, not behavioural', (() => {
  /* A Point with no coordinates: the incumbent throws, the module returns
     null. No real geometry reaches this path — every case above agrees —
     and the difference is asserted here so it is on the record rather
     than discovered later by someone debugging a null. */
  let incumbentThrew = false;
  try { incumbent.representativePoint({ type: 'Point' }); }
  catch (_) { incumbentThrew = true; }
  return incumbentThrew && modules.geodesy.representativePoint({ type: 'Point' }) === null;
})());

/* ── parity: the lookup against the substation cartridge ───────────────── */

const substationEntry = CURRENT.cartridges.find(c => c.id === 'substation-intelligence');
const substationSource = await readFile(
  join(REPO, 'atlas', substationEntry.path.replace('./', '')), 'utf8');

const PRODUCT = {
  schema: 'data-grid-gb.connection-points.v2',
  counts: { connection_points: 3 },
  connection_points: [
    { site_code: 'COTT', name: 'COTTAM', transmission_owner: 'NGET',
      voltages_kv: [400], circuits: 8, transformers: 0,
      location: { lat: 53.3, lon: -0.78, matched_by: 'exact_name' } },
    { site_code: 'WBUR', name: 'WEST BURTON', transmission_owner: 'NGET',
      voltages_kv: [400, 132], circuits: 8, transformers: 6,
      location: { lat: 53.361, lon: -0.812, matched_by: 'exact_name' } },
    { site_code: 'NOWH', name: 'NOWHERE MAPPED', transmission_owner: 'NGET',
      voltages_kv: [132], circuits: 1, transformers: 0 }
  ]
};

const substationBox = sandboxContext();
substationBox.fetch = async () => ({ ok: true, status: 200,
  json: async () => PRODUCT, headers: { get: () => null } });
substationBox.window.fetch = substationBox.fetch;
vm.createContext(substationBox);
try { vm.runInContext(substationSource, substationBox, { filename: 'substation.js' }); }
catch (_) { /* the carried engine will not boot under a stub; PART 2 registers first */ }
const network = substationBox.window.__GRIDATLAS_NETWORK__;
if (network) await network.ready;

console.log('\nparity: substation lookup against the incumbent cartridge\n');
check('the incumbent loaded the fixture product', network?.loaded === true);
const moduleIndex = modules.substationLookup.index(PRODUCT.connection_points);

const NAME_CASES = ['Cottam Substation', 'COTTAM', 'cottam substation',
  'West Burton', 'West Burton 400kV Substation', 'Nowhere Mapped',
  'Somewhere Nobody Published'];
for (const name of NAME_CASES) {
  const a = network.byName(name);
  const b = moduleIndex.byName(name);
  const same = (a?.site_code ?? null) === (b?.site_code ?? null);
  check(`name parity: "${name}" -> ${a?.site_code ?? 'null'}`, same,
    same ? '' : `${a?.site_code} vs ${b?.site_code}`);
}

const NEAREST_CASES = [
  ['from Cottam Solar, any voltage', -0.643208, 53.352088, 0],
  ['from Cottam Solar, 400 kV only', -0.643208, 53.352088, 400],
  ['from West Burton Solar, 400 kV only', -0.6774547, 53.2926216, 400]
];
for (const [label, lon, lat, minimumKv] of NEAREST_CASES) {
  const a = network.nearest(lon, lat, { minimumKv });
  const b = moduleIndex.nearest(lon, lat, { minimumKv });
  const same = (a?.point?.site_code ?? null) === (b?.point?.site_code ?? null)
    && Math.abs((a?.km ?? 0) - (b?.km ?? 0)) < 1e-12;
  check(`nearest parity: ${label} -> ${a?.point?.site_code ?? 'null'}`, same,
    same ? '' : `${a?.point?.site_code}@${a?.km} vs ${b?.point?.site_code}@${b?.km}`);
}
check('an unmapped site is never returned as nearest',
  moduleIndex.nearest(-0.6, 53.3, { minimumKv: 0 })?.point?.site_code !== 'NOWH');

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}
console.log('the modules answer exactly as the 4,000 lines do. Nothing has been '
  + 'swapped; parity is the precondition for asking.');
