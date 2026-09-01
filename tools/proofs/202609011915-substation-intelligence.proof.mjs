/**
 * Proof for the substation intelligence cartridge, generation 202609011915.
 *
 * The first check here is the one whose absence took the Atlas down on
 * v9.57: every composed cartridge's slot must be a script the shell
 * actually loads. A directory listing is not the contract; index.html is.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CURRENT = JSON.parse(await readFile(join(REPO, 'atlas', 'current.json'), 'utf8'));
const RELEASE = join(REPO, 'atlas', 'releases', CURRENT.shell.release_id);
const CARTRIDGE = join(REPO, 'atlas', 'cartridges',
  '202609011915-substation-intelligence-v9-61.js');

const bridgeRejections = [];
process.on('unhandledRejection', (reason) => {
  bridgeRejections.push(String(reason?.message || reason).slice(0, 120));
});

let passed = 0;
const failures = [];
function check(label, condition) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else { failures.push(label); console.log('  [FAIL] ' + label); }
}

const shellHtml = await readFile(join(RELEASE, 'index.html'), 'utf8');
const loaded = new Set(
  [...shellHtml.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map(match => match[1].split('/').pop()));

console.log('\nthe slot contract - the check v9.57 did not have\n');
check('the shell loads the scripts this proof thinks it does', loaded.size >= 4);
for (const cartridge of CURRENT.cartridges) {
  check(`${cartridge.id} claims a slot the shell actually loads: ${cartridge.replace_script}`,
    loaded.has(cartridge.replace_script));
}
check('every cartridge in the order is in the cartridge list',
  CURRENT.cartridge_order.every(id => CURRENT.cartridges.some(c => c.id === id)));

const source = await readFile(CARTRIDGE, 'utf8');
const engine = (await readFile(join(RELEASE, 'ventus-corev8engine.js'), 'utf8'))
  .replace(/\r\n/g, '\n');

console.log('\nthe engine, carried forward\n');
check('the engine is present byte for byte', source.includes(engine));
check('it is carried whole, not excerpted', engine.length > 80000);
check('the intelligence runs after it, not inside it',
  source.indexOf(engine) < source.indexOf('PART 2 - the network'));

console.log('\nthe product contract\n');
check('it reads the data repository product',
  /Ventusltd\/data-grid-gb\//.test(source)
  && /derived\/connection-points\.v2\.json/.test(source));
check('it requires the v2 schema it was written against',
  /const REQUIRED_SCHEMA = 'data-grid-gb\.connection-points\.v2';/.test(source));
check('it revalidates rather than pinning first sight',
  /fetch\(PRODUCT, \{ cache: 'no-cache' \}\)/.test(source));
check('one earth radius, the estate\'s own',
  /const EARTH_RADIUS_KM = 6378\.137;/.test(source));
check('the quoted fault metric is named, not called "the fault level"',
  /const QUOTED_METRIC = 'three_phase_rms_break_current_ka';/.test(source)
  && /three-phase RMS break current/.test(source));
check('the non-interchangeability of the eight metrics travels with the number',
  /they are not interchangeable/.test(source));

console.log('\nwhat it refuses to say\n');
check('every answer carries its attribution',
  /NESO Electricity Ten Year Statement 2025, appendices B and D/.test(source));
check('every answer carries the refusal to assess a connection',
  /Not a statement about whether/.test(source));
check('no grading language in anything the file can emit', (() => {
  const part2 = source.split('PART 2 - the network')[1] || '';
  const code = part2.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(line => line.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  return !/\b(strong|weak|excellent|poor|attractive|constrained|well.connected)\b/i.test(code);
})());

console.log('\nit runs, and answers only from the product\n');
const product = {
  schema: 'data-grid-gb.connection-points.v2',
  counts: { connection_points: 1, with_location: 1 },
  connection_points: [{
    site_code: 'COTT', name: 'COTTAM', transmission_owner: 'NGET',
    voltages_kv: [400], circuits: 8, transformers: 0,
    circuit_winter_rating_mva: { min: 2780, max: 3326 },
    fault_current: { peak: { scenarios: 10, winters: ['2025/26', '2033/34'],
      metrics: { three_phase_rms_break_current_ka: { min: 38.13, max: 50.61, unit: 'kA' },
                 three_phase_initial_peak_current_ka: { min: 102, max: 136, unit: 'kA' } } } },
    reactive_compensation: { units: 2 },
    planned_changes: 17, planned_change_years: ['2028', '2031'],
    location: { lat: 53.3, lon: -0.78, matched_by: 'exact_name' }
  }]
};
let fetched = null;
const context = {
  window: {}, document: { addEventListener() {}, getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }),
    body: { classList: { add() {}, remove() {} } }, head: { appendChild() {} } },
  console, setTimeout, clearTimeout, setInterval, clearInterval, performance,
  Math, JSON, Date, Promise, Map, Set, URL, Error, RegExp, Array, Object, Number, String,
  TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, navigator: { userAgent: 'proof' },
  location: { search: '', href: 'https://example.invalid/' },
  fetch: async (url, options) => { fetched = { url, options };
    return { ok: true, status: 200, json: async () => product,
      text: async () => JSON.stringify(product), headers: { get: () => null } }; },
  Response: class {}, Headers: class {}, Request: class {},
  addEventListener() {}, requestAnimationFrame: () => 0
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
try { vm.runInContext(source, context, { filename: 'substation-intelligence.js' }); }
catch (error) {
  // The engine expects a browser and will not finish booting here; PART 1
  // is proven by byte identity above, and PART 2 registers before it runs.
  console.log('  (engine boot stopped under the stub, as expected: '
    + String(error.message).slice(0, 60) + ')');
}
const api = context.window.__GRIDATLAS_NETWORK__;
check('it publishes its own state object', Boolean(api));
if (api) {
  await api.ready;
  check('it loaded the product', api.loaded === true && api.points === 1);
  check('it revalidated the fetch it made',
    fetched && fetched.options && fetched.options.cache === 'no-cache');
  const summary = api.summarise('Cottam Substation');
  check('a name normalised differently still finds the site', Boolean(summary));
  check('the sentence quotes the RMS break current, named',
    summary && /three-phase RMS break current 38\.1\u201350\.6 kA/.test(summary.sentence));
  check('it does not conflate the peak current metric into the same claim',
    summary && !/102/.test(summary.sentence));
  check('circuits, ratings and planned changes are all there',
    summary && /8 circuits/.test(summary.sentence)
    && /2,780\u20133,326 MVA/.test(summary.sentence)
    && /17 changes/.test(summary.sentence));
  check('an unknown substation returns null, never a guess',
    api.summarise('Somewhere Nobody Published') === null);
}

await new Promise(resolve => setTimeout(resolve, 250));

console.log('\nthe scope of what is quoted\n');

check('a multi-voltage site is labelled site-wide, with its voltages named',
  /Site-wide published envelope across the/.test(source)
  && /kV buses at this site, /.test(source));
check('a single-voltage site says so instead',
  /Published for this site, which carries one voltage/.test(source));
check('the breaker-duty overclaim is gone',
  !/the one\s+\+?\s*'?\s*switchgear is rated against/.test(source)
  && /one published /.test(source) && /breaker-duty metric/.test(source)
  && /several relevant /.test(source));
check('the bus count travels with the fault range',
  /peak\.locations\?\.length \? ' at ' \+ peak\.locations\.length \+ ' buses'/.test(source));
check('the unverified location join is declared',
  /state\.location_join_is_unverified = true;/.test(source));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (bridgeRejections.length) {
  console.log(`(${bridgeRejections.length} rejection(s) from the carried engine under the `
    + `stub, expected: ${bridgeRejections[0]})`);
}
if (failures.length) {
  console.error('\nFAILURES');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('every slot exists, the engine is intact, and nothing here grades a connection.');
