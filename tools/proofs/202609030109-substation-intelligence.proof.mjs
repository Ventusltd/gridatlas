/**
 * Proof for the substation intelligence cartridge, generation 202609012045.
 *
 * The first check here is the one whose absence took the Atlas down on
 * v9.57: every composed cartridge's slot must be a script the shell
 * actually loads. A directory listing is not the contract; index.html is.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CURRENT = JSON.parse(await readFile(join(REPO, 'atlas', 'current.json'), 'utf8'));
const RELEASE = join(REPO, 'atlas', 'releases', CURRENT.shell.release_id);
/* Resolved from atlas/current.json, never named.
   ----------------------------------------------------------------------
   This read '202609012045-substation-intelligence-v9-63.js' - the
   cartridge cut at 202609012045 - while the composition served
   202609020018, three generations later. It therefore passed against
   bytes nobody was serving, which is the exact drift run-current.mjs and
   recompose.mjs were both written to stop, reproduced inside a proof.
   The composed path is read from the file the loader reads. */
const CARTRIDGE_ENTRY = (CURRENT.cartridges || [])
  .find(entry => entry.id === 'substation-intelligence');
if (!CARTRIDGE_ENTRY) throw new Error('substation-intelligence is not in the composition');
const CARTRIDGE = join(REPO, 'atlas', CARTRIDGE_ENTRY.path.replace(/^\.\//, ''));

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
  && /derived\/connection-points\.v3\.json/.test(source));
check('it requires the v3 schema it was written against',
  /const REQUIRED_SCHEMA = 'data-grid-gb\.connection-points\.v3';/.test(source));
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
  schema: 'data-grid-gb.connection-points.v3',
  counts: { connection_points: 1, with_location: 1 },
  connection_points: [{
    site_code: 'COTT', name: 'COTTAM', transmission_owner: 'NGET',
    voltages_kv: [400], circuits: 8, transformers: 0,
    circuit_winter_rating_mva: { min: 2780, max: 3326 },
    fault_current: { peak: { scenarios: 10, winters: ['2025/26', '2033/34'],
      locations: ['COTT4 M1', 'COTT4 M3'],
      metrics: { three_phase_rms_break_current_ka: { min: 38.13, max: 50.61, unit: 'kA' },
                 three_phase_initial_peak_current_ka: { min: 102, max: 136, unit: 'kA' } } } },
    fault_current_by_voltage: { '400': { peak: { scenarios: 10,
      winters: ['2025/26', '2033/34'], locations: ['COTT4 M1', 'COTT4 M3'],
      metrics: { three_phase_rms_break_current_ka: { min: 38.13, max: 50.61, unit: 'kA' } } } } },
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
  // v9.63 singularises one bus, so the count and its noun are on two lines.
  /peak\.locations\?\.length \? ' at ' \+ peak\.locations\.length/.test(source)
  && /\? ' bus' : ' buses'/.test(source));
check('the unverified location join is declared',
  /state\.location_join_is_unverified = true;/.test(source));


console.log('\nthe fault current is quoted at the connection voltage\n');

check('the consumer requires the v3 product',
  /const REQUIRED_SCHEMA = 'data-grid-gb\.connection-points\.v3';/.test(source)
  && /derived\/connection-points\.v3\.json/.test(source));
check('it reads the per-voltage split when a connection voltage is given',
  /point\.fault_current_by_voltage/.test(source)
  && /faultScope = 'bus'/.test(source));
check('it says which busbars the number belongs to',
  /' at the ' \+ faultKv \+ ' kV busbars'/.test(source));
check('the site-wide fallback names itself as such',
  /' across every busbar at this site'/.test(source));
check('ratings are labelled site-wide, because the product does not split them',
  /circuit winter ratings across the site/.test(source));
check('the label explains what remains site-wide when the fault is bus-scoped',
  /remain site-wide across the/.test(source));

console.log('\na count of machines, not a count of landings\n');
/* F3. The site card said "6 circuits, 10 transformers" for Cowley, which
   holds five machines. A site owns BOTH ends of a transformer - the two
   windings are in the same yard - so every internal transformer was
   published once per winding and counted twice. Measured against
   gb-transmission-network.v1: 2,944 landings for 1,550 site-held units,
   1.90x, at 484 of the 525 sites that hold one.

   Run against the REAL product where it is on disk. A fixture would only
   prove the code agrees with a shape written here. */
const topologyModule = context.window.__GRIDATLAS_MODULES__?.networkTopology || null;
check('the composed cartridge carries the network-topology module', !!topologyModule);
check('the site-wide counts declare that they are units, not landings',
  /counts_are_units/.test(source) && /physical units/.test(source));
check('the per-voltage lists are still landings, and are not deduplicated',
  /band\.transformers\.push\(published\)/.test(source));
check('the summariser never presents a landing tally as a machine count',
  /transformer winding connections at the site/.test(source)
  && !/point\.transformers \+ ' transformers'/.test(source));

/* Number(null) is 0. The first cut of this fix read the unit counts with
   Number(units && units.circuits), which is a finite ZERO whenever no units
   are passed, and every existing caller passes none - so a site publishing
   eight circuits reported none. Both branches are exercised here. */
check('given no units the summariser still reports the product own figures',
  !!api && /^8 circuits /.test(api.summarise('Cottam Substation').sentence));
check('given units it reports the machines rather than the landings',
  !!api && / 5 transformers /.test(api.summarise('Cottam Substation',
    { units: { circuits: 6, transformers: 5 } }).sentence));
check('and a zero unit count is a real zero, not a missing one',
  !!api && /^0 circuits /.test(api.summarise('Cottam Substation',
    { units: { circuits: 0 } }).sentence));

const PRODUCT_FILE = (() => {
  for (const base of [resolve(REPO, '..'), resolve(REPO, '..', '..')]) {
    const candidate = join(base, 'data-grid-gb', 'derived',
      'gb-transmission-network.v1.json');
    if (existsSync(candidate)) return candidate;
  }
  return null;
})();
check('the published node/branch product is on disk for a real-data check',
  !!PRODUCT_FILE);
if (topologyModule && PRODUCT_FILE) {
  const gbProduct = JSON.parse(await readFile(PRODUCT_FILE, 'utf8'));
  const gb = topologyModule.index(gbProduct);
  const cowl = gb.at('COWL');
  const landings = cowl.by_voltage.flatMap(band => band.transformers);
  check('Cowley publishes ten transformer landings',
    cowl.counts.transformer_landings === 10 && landings.length === 10);
  check('Cowley reports FIVE transformers, not ten',
    cowl.counts.transformers === 5);
  check('and they are the five machines the operator publishes',
    landings.filter(t => t.from_node === 'COWL41').length === 5
    && landings.filter(t => t.from_node === 'COWL41')
      .every(t => (t.to_node === 'COWL11' || t.to_node === 'COWL12')
        && t.rating_mva >= 269 && t.rating_mva <= 278));
  const at400 = cowl.by_voltage.find(b => b.voltage_kv === 400);
  const at132 = cowl.by_voltage.find(b => b.voltage_kv === 132);
  check('at 400 kV it still says five, and at 132 kV five - the same machines',
    at400.transformers.length === 5 && at132.transformers.length === 5);
  check('a voltage-filtered query sees one winding and is not halved',
    gb.at('COWL', { voltageKv: 400 }).counts.transformers === 5);
  check('Cowley six circuits are unchanged, because it owns one end of each',
    cowl.counts.circuits === 6 && cowl.counts.circuit_landings === 6);

  let sites = 0, differing = 0, units = 0, ends = 0;
  for (const site of gbProduct.sites) {
    const facts = gb.at(site.code);
    if (!facts || !facts.counts.transformer_landings) continue;
    sites += 1;
    units += facts.counts.transformers;
    ends += facts.counts.transformer_landings;
    if (facts.counts.transformers !== facts.counts.transformer_landings) differing += 1;
  }
  check('estate-wide: 2,944 landings resolve to 1,550 site-held units',
    ends === 2944 && units === 1550);
  check('and 484 of the 525 sites that hold a transformer were overstated',
    sites === 525 && differing === 484);
  console.log(`         ${ends} landings -> ${units} units at ${sites} sites, `
    + `${differing} of them previously overstated (${(ends / units).toFixed(2)}x)`);
}

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
