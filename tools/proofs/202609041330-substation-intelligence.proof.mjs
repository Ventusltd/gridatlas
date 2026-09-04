/**
 * Proof for the substation intelligence cartridge, carried forward to
 * generation 202609041250 (v9.110: the v8 VENTUS masthead and SCADA panel
 * restored around the six-menu bar). Every check below is unchanged from
 * 202609041244 and resolves the composed cartridge dynamically through
 * atlas/current.json, because this generation's only change is in
 * atlas/modules/202609031958-menu-bar.js -- geodesy, network topology,
 * fault current, corridor estimate and every other compute module here are
 * carried byte-identical. The menu-bar-specific checks live in
 * tools/proofs/menu-bar-dom.proof.mjs (imported below),
 * tools/proofs/menu-bar-attrib-clearance.browser.mjs,
 * tools/proofs/menu-bar-mobile-hit.browser.mjs and
 * tools/proofs/202609041250-menu-bar-instrument-panel.browser.mjs.
 *
 * The first check here is the one whose absence took the Atlas down on
 * v9.57: every composed cartridge's slot must be a script the shell
 * actually loads. A directory listing is not the contract; index.html is.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
import { readFileSync as fsReadSync } from 'node:fs';

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

const pinBox = { window: {}, console, Math, JSON, Number, String, Array, Object,
  Map, Set, Boolean, Error, RegExp, Promise, Uint8Array, ArrayBuffer,
  TextEncoder, crypto: webcrypto };
pinBox.window.window = pinBox.window;
pinBox.window.crypto = webcrypto;
vm.createContext(pinBox);
vm.runInContext(await readFile(join(REPO, 'atlas', 'modules',
  '202609030137-pinned-products.js'), 'utf8'), pinBox, { filename: 'pins.js' });
const pins = pinBox.window.__GRIDATLAS_MODULES__.pinnedProducts;

/* Every product this proof measures is read THROUGH THE PIN.
   ------------------------------------------------------------------------
   A neighbouring checkout is used only when its bytes hash to the pinned
   digest AND match its recorded length - that is the fast path on a
   developer's machine, and it is verified rather than assumed. Otherwise the
   pinned URL is fetched, which is what a runner does and what the Atlas
   itself does. If neither yields the pinned bytes, the caller is told why and
   every dependent check FAILS with that reason. A skip is not a pass. */
async function readPinned(id) {
  const entry = pins.pin(id);
  if (!entry) return { ok: false, why: `no pin for ${id}` };
  const { createHash } = await import('node:crypto');
  const digestOf = (buffer) => createHash('sha256').update(buffer).digest('hex');

  for (const base of [resolve(REPO, '..'), resolve(REPO, '..', '..')]) {
    const candidate = join(base, entry.repository, entry.path);
    if (!existsSync(candidate)) continue;
    const buffer = await readFile(candidate);
    if (digestOf(buffer) === entry.sha256 && buffer.length === entry.bytes) {
      return { ok: true, source: 'the checkout beside this repository',
        digest: entry.sha256, bytes: buffer.length, text: buffer.toString('utf8') };
    }
    console.log(`         ${candidate} is not the pinned ${id}; fetching instead`);
  }

  const url = pins.url(id);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return { ok: false, why: `${url} answered HTTP ${response.status}` };
    const buffer = Buffer.from(await response.arrayBuffer());
    const digest = digestOf(buffer);
    if (digest !== entry.sha256 || buffer.length !== entry.bytes) {
      return { ok: false, why: `${url} served ${buffer.length} bytes / ${digest}, `
        + `not the pinned ${entry.bytes} / ${entry.sha256}` };
    }
    return { ok: true, source: 'the pinned URL', digest, bytes: buffer.length,
      text: buffer.toString('utf8') };
  } catch (error) {
    return { ok: false, why: `${url} could not be read: ${String(error?.message || error)}` };
  }
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
const partsManifest = JSON.parse(await readFile(join(REPO, 'atlas', 'manifests',
  `${CURRENT.generation}-substation-intelligence-v9-63-parts.json`), 'utf8'));
const enginePart = (partsManifest.assembled_from || [])[0];
const engine = enginePart
  ? (await readFile(join(REPO, enginePart.path), 'utf8')).replace(/\r\n/g, '\n')
  : '';
const immutableEnginePath = join(RELEASE, 'ventus-corev8engine.js');
const immutableEngineBytes = await readFile(immutableEnginePath);
const immutableEngineHash = createHash('sha256').update(immutableEngineBytes).digest('hex');

console.log('\nthe engine successor, with the immutable shell preserved\n');
check('the parts manifest names the reviewed exact-REPD delegation successor',
  /202609040229-ventus-corev8engine-exact-repd-delegation\.js$/
    .test(enginePart?.path || ''));
check('the successor is present byte for byte', Boolean(engine) && source.includes(engine));
check('it is carried whole, not excerpted', engine.length > 80000);
check('the intelligence runs after it, not inside it',
  source.indexOf(engine) < source.indexOf('PART 2 - the network'));
check('the immutable V8 shell remains byte-identical to its published digest',
  immutableEngineHash === '9a75901ebdff05e094650e39973fc0f59204724753d393a734bb8cda7bc875ba');
check('the successor accepts the complete canonical technology vocabulary',
  /'solar_operational'[\s\S]*'bess_operational'[\s\S]*'wind'[\s\S]*'biomass'[\s\S]*'tidal'[\s\S]*'hydrogen'[\s\S]*'hydro'[\s\S]*'flywheel'[\s\S]*'act'[\s\S]*'geothermal'[\s\S]*'caes'[\s\S]*'other'/.test(engine));
check('non-spine technologies defer to the exact REPD receiver rather than throw',
  /status: 'DEFERRED_TO_EXACT_REPD_RECEIVER'/.test(engine)
  && /technology: requestedTechnology \|\| null/.test(engine)
  && /legacy_fetches: 0/.test(engine)
  && !/\/uk_renewables_pipeline\//.test(engine));

console.log('\nthe product contract\n');
check('it reads the data repository product',
  /repository: 'data-grid-gb'/.test(source)
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

/* THE REAL PRODUCT, NOT A SHAPE WRITTEN HERE.
   ------------------------------------------------------------------------
   This ran against a one-site stub. That stopped being possible the moment
   the loader began refusing bytes that are not the pinned product, and the
   fixture was the wrong answer anyway: the numbers in it - Cottam's 8
   circuits, 38.13-50.61 kA, 17 planned changes - were copied out of the real
   product and could drift from it silently. The loader is now given the bytes
   the composition pins, so the summariser is measured against what ships. */
const CONNECTION_POINTS = await readPinned('connection-points.v3');
check('the connection-points product this proof measures is the product the pin names',
  CONNECTION_POINTS.ok, CONNECTION_POINTS.ok
    ? `${CONNECTION_POINTS.bytes} bytes from ${CONNECTION_POINTS.source}`
    : CONNECTION_POINTS.why);
const productText = CONNECTION_POINTS.ok ? CONNECTION_POINTS.text : '{}';
const product = JSON.parse(productText);

let fetched = null;
/* The carried browser shell owns a permanent one-second clock interval. It is
   unrelated to the network module under proof and must not keep the exact-head
   CI process alive after every assertion has completed. Browser behavior is
   exercised separately by the bounded Playwright gate. */
const proofSetInterval = () => 0;
const proofClearInterval = () => {};
const context = {
  window: {}, document: { addEventListener() {}, getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }),
    body: { classList: { add() {}, remove() {} } }, head: { appendChild() {} } },
  console, setTimeout, clearTimeout,
  setInterval: proofSetInterval, clearInterval: proofClearInterval, performance,
  Math, JSON, Date, Promise, Map, Set, URL, Error, RegExp, Array, Object, Number, String,
  TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, navigator: { userAgent: 'proof' },
  location: { search: '', href: 'https://example.invalid/' },
  fetch: async (url, options) => { fetched = { url, options };
    return { ok: true, status: 200, json: async () => product,
      text: async () => productText, headers: { get: () => null } }; },
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
  check('it loaded the product',
    api.loaded === true && api.points === (product.connection_points || []).length
    && api.points === 886);
  check('and located exactly what the product locates',
    api.located === (product.connection_points || []).filter(p => p.location).length
    && api.located === 502);
  check('it revalidated the fetch it made',
    fetched && fetched.options && fetched.options.cache === 'no-cache');
  const summary = api.summarise('Cottam Substation');
  check('a name normalised differently still finds the site', Boolean(summary));
  check('the sentence quotes the RMS break current, named',
    summary && /three-phase RMS break current 38\.1\u201350\.6 kA/.test(summary.sentence));
  check('it does not conflate the peak current metric into the same claim',
    summary && !/102/.test(summary.sentence));
  /* 2,780 was the FIXTURE's number and it was wrong. The hand-written stub
     this proof used until now claimed Cottam's winter range as 2,780-3,326
     MVA; the product publishes 2,009-3,326. The fixture had been copied out
     of the product at some point and drifted from it, and this check passed
     the whole time against a minimum nobody serves. Reading the pinned
     product instead is what surfaced it. */
  check('circuits, ratings and planned changes are all there',
    summary && /8 circuits/.test(summary.sentence)
    && /2,009\u20133,326 MVA/.test(summary.sentence)
    && /17 changes/.test(summary.sentence));
  check('and the range is the one the product publishes, not one copied into a fixture',
    (() => {
      const cott = (product.connection_points || []).find(p => p.site_code === 'COTT');
      return cott.circuit_winter_rating_mva.min === 2009
        && cott.circuit_winter_rating_mva.max === 3326;
    })());
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

console.log('\na straight line is not a route, and the estimate says what it is\n');

/* The corridor scalar. Exercised as arithmetic in its own context, because a
   regex over the source would prove only that the number is written down. */
const corrBox = { window: {}, console, Math, JSON, Number, String, Array, Object,
  Map, Set, Boolean, Error, RegExp };
corrBox.window.window = corrBox.window;
vm.createContext(corrBox);
vm.runInContext(await readFile(join(REPO, 'atlas', 'modules',
  '202609030205-corridor-estimate.js'), 'utf8'), corrBox, { filename: 'corridor.js' });
const corridor = corrBox.window.__GRIDATLAS_MODULES__.corridorEstimate;

check('the module loaded and froze its surface',
  !!corridor && Object.isFrozen(corridor));
check('it is in the served bytes',
  /gridatlas\.module\.corridor-estimate\.v1/.test(source));
check('the factor is the calibrated 1.245',
  corridor.factor === 1.245);
check('the estimate is the arithmetic, not a lookup',
  Math.abs(corridor.forCable(15.76).km - 15.76 * 1.245) < 1e-12
  && corridor.forCable(15.76).km.toFixed(1) === '19.6');
check('the straight-line distance is carried through untouched',
  corridor.forCable(15.76).straight_km === 15.76);

check('THE SAMPLE IS 59 DISTINCT SITE PAIRS, not 95 circuits',
  corridor.basis.distinct_site_pairs === 59
  && corridor.basis.circuits === 95
  && /parallel circuits between the same two sites duplicate the geometry/
    .test(corridor.basis.sample_note));
check('the error the calibration actually achieved travels with it',
  corridor.basis.median_absolute_error_pct === 8.45
  && corridor.basis.within_15_pct === 73);

check('under a kilometre it withholds rather than scaling',
  corridor.forCable(0.4).km === null
  && /site-centroid resolution dominates/.test(corridor.forCable(0.4).withheld));
check('and says what the numbers were in that band',
  /0\.59 km/.test(corridor.basis.below_minimum)
  && /52\.5%/.test(corridor.basis.below_minimum));
check('at the boundary it answers, so the rule is a threshold and not a gap',
  corridor.forCable(1).km !== null);
check('nothing, zero and a negative are null, never zero kilometres',
  corridor.forCable(null) === null && corridor.forCable(0) === null
  && corridor.forCable(-5) === null && corridor.forCable('x') === null);

check('IT OFFERS NO OVERHEAD ANSWER AT ALL',
  typeof corridor.forOverhead === 'undefined'
  && !/function forOverhead/.test(source));
check('and publishes 1.13 as the reason the cable factor is not that answer',
  corridor.overhead_factor === 1.13
  && /crosses open country/.test(corridor.not_for_overhead));
check('the standing caveat is exactly the four things it is not',
  /Indicative highway-corridor screening only/.test(corridor.caveat)
  && /Not a connection offer/.test(corridor.caveat)
  && /not a constructability assessment/.test(corridor.caveat)
  && /not a consenting design/.test(corridor.caveat));
check('and it grades nothing',
  !/\b(good|poor|strong|weak|excellent|viable|attractive)\b/i
    .test(corridor.caveat + ' ' + corridor.not_an_assessment));
console.log('\nevery superlative carries the sample it was drawn from\n');

/* F4. "Nearest 400 kV substation: Cowley - 15.76 km" was nearest among the
   points a distance search could actually see, and the card did not say so.
   ETYS names substations and does not locate them, so the geometry comes from
   OpenStreetMap through a GridAtlas release and a fraction of the published
   network is invisible to any search by distance.

   These checks compare the coverage the cartridge REPORTS against the payload
   it was GIVEN, so they cannot pass on a remembered number. That matters more
   than usual here: Codex's join correction takes located points from 502 to
   489, and a literal in the card would go quietly false the day the pin moves. */
check('the cartridge reports coverage at all', typeof api?.coverage === 'function');
if (api && typeof api.coverage === 'function') {
  const all = api.coverage(0);
  const eligible = (point, floor) => Array.isArray(point.voltages_kv)
    && point.voltages_kv.length && Math.max(...point.voltages_kv) >= floor;
  const points = product.connection_points || [];
  check('the coverage it reports is counted from the payload it was given',
    all.published === points.length
    && all.located === points.filter(p => p.location).length
    && all.unlocated === all.published - all.located);
  check('and it agrees with the state it publishes for the whole product',
    all.published === api.points && all.located === api.located);

  const at400 = api.coverage(400);
  check('at 400 kV it counts only what a 400 kV search would consider',
    at400.published === points.filter(p => eligible(p, 400)).length
    && at400.located === points.filter(p => p.location && eligible(p, 400)).length);
  check('the 400 kV band is a real subset, not the whole product',
    at400.published > 0 && at400.published < all.published);
  check('unlocated is the difference, never a separate count that can drift',
    at400.unlocated === at400.published - at400.located);
  check('the predicate is the one the distance search itself uses',
    /Math\.max\(\.\.\.point\.voltages_kv\) >= floor/.test(source)
    && /Math\.max\(\.\.\.point\.voltages_kv\) < minimumKv/.test(source));
  check('it names where the numbers came from, and grades nothing',
    /counted from the connection-points payload this session fetched/.test(source)
    && !/\b(good|poor|strong|weak|excellent|limited)\b/i.test(at400.basis));
  console.log(`         at 400 kV: ${at400.located} of ${at400.published} published `
    + `carry coordinates, ${at400.unlocated} cannot be measured to`);
  console.log(`         whole product: ${all.located} of ${all.published}`);
}
check('an unloaded product reports no coverage rather than zeroes',
  /if \(!state\.loaded\) return null;\n\s*const floor/.test(source));

console.log('\nthe runtime data is pinned to a commit, and checked by content\n');

/* F5. Three runtime fetches named a BRANCH and the only defence was a schema
   string, which defends shape and is blind to values. On 2026-09-03 that
   stopped being theoretical: data-grid-gb commit b91e45b publishes COWLEY's
   transformers as 5 rather than 10 and ABHAM's as 2 rather than 4, under the
   IDENTICAL schema `data-grid-gb.connection-points.v3`. An immutable release
   would have changed what it said with none of its own bytes changing.

   The pin table is exercised in its own context, with real WebCrypto, so the
   MISMATCH path is executed rather than described. The primary context above
   deliberately has NO crypto, which is how the absent-digest path gets
   exercised too: the product still loads there, and says it could not check. */
check('no runtime data URL in this cartridge names a branch',
  !/raw\.githubusercontent\.com\/Ventusltd\/[a-z0-9-]+\/main\//.test(source));
check('the pinned-products module is in the served bytes',
  /gridatlas\.module\.pinned-products\.v1/.test(source));


check('it froze its surface and named its schema',
  Object.isFrozen(pins) && pins.schema === 'gridatlas.module.pinned-products.v1');
check('every pinned product names a 40-character commit, never a branch',
  pins.ids.length === 3
  && pins.ids.every(id => /^[0-9a-f]{40}$/.test(pins.pin(id).ref)));
check('and a 64-character SHA-256 of the bytes served at that commit',
  pins.ids.every(id => /^[0-9a-f]{64}$/.test(pins.pin(id).sha256)));
check('the URL it builds is the commit, not the branch',
  pins.url('connection-points.v3')
    === 'https://raw.githubusercontent.com/Ventusltd/data-grid-gb/'
      + '1c9909d1138704b29235c27fd769436dda8a0b18/derived/connection-points.v3.json');
check('its digest arithmetic is the arithmetic, checked against node',
  await (async () => {
    const sample = 'the quick brown fox';
    const { createHash } = await import('node:crypto');
    return await pins.digestHex(sample)
      === createHash('sha256').update(sample, 'utf8').digest('hex');
  })());
check('bytes that disagree with the recorded digest are a MISMATCH',
  (await pins.verify('connection-points.v3', 'not the product')).state === 'MISMATCH');
check('a short response is named as a length, not left to the digest',
  /is 1 bytes, not the recorded 2896561/
    .test((await pins.verify('connection-points.v3', 'x')).detail || ''));
check('and bytes of the right length that hash wrong say so as a digest',
  await (async () => {
    /* Same length as the pinned product, different content, so the length
       test passes and the digest is the thing that catches it. */
    const wrong = 'x'.repeat(pins.pin('connection-points.v3').bytes);
    const seal = await pins.verify('connection-points.v3', wrong);
    return seal.state === 'MISMATCH'
      && /hash to [0-9a-f]{64}, not the recorded [0-9a-f]{64}/.test(seal.detail);
  })());
check('bytes_seen is BYTES, not UTF-16 code units',
  (await pins.verify('connection-points.v3', 'é')).bytes_seen === 2);
check('an unknown id is unverified rather than quietly accepted',
  /^unverified/.test((await pins.verify('no-such-product', 'x')).state));
check('a pin says which bytes were read and nothing about whether they are right',
  /says nothing about whether those bytes are right/.test(pins.not_an_assessment));

check('a MISMATCH refuses to answer rather than reading on',
  /refusing to answer from bytes this composition has not seen/.test(source));
check('and an uncomposed pin table is a refusal, not a guessed URL',
  /has no pinned ref to read and will not guess one/.test(source));
if (api) {
  check('the load published which pinned bytes it read',
    !!api.product_pin
    && api.product_pin.ref === '1c9909d1138704b29235c27fd769436dda8a0b18');
  check('and where there is no crypto it says so, and still reads the product',
    /^unverified/.test(api.product_pin?.state || '') && api.loaded === true);
}

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

/* THE PRODUCT IS READ THROUGH THE PIN, OR IT IS NOT READ.
   ------------------------------------------------------------------------
   Two defects met here, and the second is the worse one.

   The first: this resolved the product by probing ../data-grid-gb and
   ../../data-grid-gb. That is a neighbouring checkout, which the runner does
   not have, so the proof went red in CI for five generations while passing on
   the laptop that happened to have the neighbour. A path on a disk is not a
   product.

   The second: the real-data checks below were guarded by
   `if (topologyModule && PRODUCT_FILE)`. With the product absent they did not
   fail - they did not RUN. "Cowley reports FIVE transformers, not ten" had
   therefore never executed on a runner in its life, and because run-current
   exits at the first failing proof, the whole sandbox proof behind it never
   ran either. A missing input that makes a proof QUIETER is the exact shape
   this estate keeps recording, and it is worse than a red, because a red is
   visible.

   Both are fixed by reading through the pin the composition already declares.
   The invariant, asserted below either way: THE PRODUCT THE PROOF READS IS THE
   PRODUCT THE PIN NAMES, BY COMMIT AND BY DIGEST. A neighbouring checkout is
   used when it is present AND its bytes hash to the pin - that is the fast
   path on a developer's machine and it is verified, not assumed. Otherwise the
   pinned URL is fetched, which is what the runner does and what the Atlas
   itself does. If neither yields the pinned bytes the checks below FAIL, with
   the reason, one by one. A skip is not a pass. */
const PRODUCT = await readPinned('gb-transmission-network.v1');
check('the product this proof measures is the product the pin names',
  PRODUCT.ok, PRODUCT.ok
    ? `${PRODUCT.bytes} bytes from ${PRODUCT.source}, sha256 ${PRODUCT.digest}`
    : PRODUCT.why);
if (PRODUCT.ok) {
  console.log(`         read ${PRODUCT.bytes} bytes from ${PRODUCT.source}`);
}

/* Every check below states its own reason when the product could not be read,
   rather than vanishing. `measured` runs the assertion only when there is
   something to measure and fails it, loudly, when there is not. */
const measured = (label, assertion) => {
  if (!PRODUCT.ok) { check(label, false, 'not measured: ' + PRODUCT.why); return; }
  check(label, assertion());
};

{
  const gbProduct = PRODUCT.ok ? JSON.parse(PRODUCT.text) : null;
  const gb = gbProduct && topologyModule ? topologyModule.index(gbProduct) : null;
  const cowl = gb ? gb.at('COWL') : null;
  const landings = cowl ? cowl.by_voltage.flatMap(band => band.transformers) : [];
  measured('Cowley publishes ten transformer landings',
    () => cowl.counts.transformer_landings === 10 && landings.length === 10);
  measured('Cowley reports FIVE transformers, not ten',
    () => cowl.counts.transformers === 5);
  measured('and they are the five machines the operator publishes',
    () => landings.filter(t => t.from_node === 'COWL41').length === 5
      && landings.filter(t => t.from_node === 'COWL41')
        .every(t => (t.to_node === 'COWL11' || t.to_node === 'COWL12')
          && t.rating_mva >= 269 && t.rating_mva <= 278));
  measured('at 400 kV it still says five, and at 132 kV five - the same machines',
    () => cowl.by_voltage.find(b => b.voltage_kv === 400).transformers.length === 5
      && cowl.by_voltage.find(b => b.voltage_kv === 132).transformers.length === 5);
  measured('a voltage-filtered query sees one winding and is not halved',
    () => gb.at('COWL', { voltageKv: 400 }).counts.transformers === 5);
  measured('Cowley six circuits are unchanged, because it owns one end of each',
    () => cowl.counts.circuits === 6 && cowl.counts.circuit_landings === 6);

  let sites = 0, differing = 0, units = 0, ends = 0;
  for (const site of (gbProduct ? gbProduct.sites : [])) {
    const facts = gb.at(site.code);
    if (!facts || !facts.counts.transformer_landings) continue;
    sites += 1;
    units += facts.counts.transformers;
    ends += facts.counts.transformer_landings;
    if (facts.counts.transformers !== facts.counts.transformer_landings) differing += 1;
  }
  measured('estate-wide: 2,944 landings resolve to 1,550 site-held units',
    () => ends === 2944 && units === 1550);
  measured('and 484 of the 525 sites that hold a transformer were overstated',
    () => sites === 525 && differing === 484);
  if (PRODUCT.ok) {
    console.log(`         ${ends} landings -> ${units} units at ${sites} sites, `
      + `${differing} of them previously overstated (${(ends / units).toFixed(2)}x)`);
  }
}


const MENU_MODULE = (() => {
  const parts = JSON.parse(fsReadSync(join(REPO, 'atlas', 'manifests',
    `${CURRENT.generation}-substation-intelligence-v9-63-parts.json`)));
  const hit = (parts.assembled_from || []).find(p => /menu-bar\.js$/.test(p.path));
  if (!hit) throw new Error('the composition carries no menu-bar module');
  return hit.path.split('/').pop();
})();

/* ── menu-bar ────────────────────────────────────────────────────────────
   The v9.94 retrofit hid an owner container after adopting only direct
   children. Scope and Clear were nested, so they vanished while its shallow
   proof stayed green. This successor is exercised against a DOM-shaped test:
   60 engine layers plus three Pipeline News layers, nested tools, real event
   forwarding, menu navigation and incomplete/duplicate fail-closed cases. */
const menuSrc = await readFile(join(REPO, 'atlas', 'modules',
  MENU_MODULE), 'utf8');
const { proveMenuBar } = await import('./menu-bar-dom.proof.mjs');
const menuEvidence = await proveMenuBar(
  join(REPO, 'atlas', 'modules', MENU_MODULE), source);

check('the repaired menu passes its DOM behaviour proof',
  menuEvidence.status === 'PASS' && menuEvidence.checks >= 24);
check('the menu proves the complete 60 + 3 control inventory',
  menuEvidence.layers === 63);
check('the six familiar menus are exact, ordered and no alias survives',
  menuEvidence.menus.join('|') === 'File|Edit|View|Scope|Grid|About');
check('nothing in the menu grades a connection',
  !/\b(strong|weak|remote|excellent|poor|good|bad)\b/i.test(menuSrc.replace(
    /\/\*[\s\S]*?\*\//g, '')));



/* Resolved the same way the menu module is: from the composition's OWN parts
   manifest, so a restamp cannot leave this proof reading a module the served
   cartridge no longer carries. */
const TIDY_MODULE = (() => {
  const parts = JSON.parse(fsReadSync(join(REPO, 'atlas', 'manifests',
    `${CURRENT.generation}-substation-intelligence-v9-63-parts.json`)));
  const hit = (parts.assembled_from || []).find(p => /arrival-tidy\.js$/.test(p.path));
  if (!hit) throw new Error('the composition carries no arrival-tidy module');
  return hit.path.split('/').pop();
})();
const tidySrc = await readFile(join(REPO, 'atlas', 'modules', TIDY_MODULE), 'utf8');

/* THE ARRIVAL TIDIES UP AFTER ITSELF.

   A deep link is not a search. Measured on v9.96 at 393x852, arriving at
   ?repd_ref=12588 the way a shared link arrives: the map canvas was topmost
   at 13 per cent of 3,200 sampled viewport points and the app's own controls
   at 87 - and three of those controls were the search that had ALREADY
   answered. The results list was still open, the box still held "12588",
   a reference the reader never typed, and the identity was on screen three
   times.

   Each clause is asserted separately because each is a different way for
   this to be wrong. Dismissing a FAILED arrival would leave a reader with a
   map and no account of it. Clearing a box the reader has touched would take
   their typing away. Hiding by anything other than the shell's own display
   toggle would make the panel unrecoverable by the Escape key and the map
   click that already restore it. */
check('the arrival tidy is carried by this cartridge',
  /function arrivalTidy\(\)/.test(tidySrc));
check('it acts only on an arrival nobody typed',
  /get\('repd_ref'\)/.test(tidySrc) && /if \(!ref\) return;/.test(tidySrc));
check('it dismisses a resolved arrival and leaves a failed one alone',
  /if \(state !== 'resolved'\) return state === 'failed';/.test(tidySrc));
check('it hides with the shell own display toggle, not a new mechanism',
  /results\.style\.display = 'none';/.test(tidySrc));
check('it clears the box only while the box still holds the ref',
  /if \(input\.value === ref\) input\.value = '';/.test(tidySrc));
check('a reader touching the box retires it permanently',
  /addEventListener\('focus', retire/.test(tidySrc)
  && /addEventListener\('input', retire/.test(tidySrc)
  && /if \(!typed\) \{/.test(tidySrc));
check('it does nothing where there is no observer, rather than throwing',
  /if \(typeof MutationObserver !== 'function'\) return;/.test(tidySrc));
check('and it publishes its own state for review',
  /window\.__GRIDATLAS_ARRIVAL_TIDY__ = \{/.test(tidySrc));
check('nothing in the arrival tidy grades a connection',
  !/\b(strong|weak|remote|excellent|poor|good|bad)\b/i.test(
    tidySrc.replace(/\/\*[\s\S]*?\*\//g, '')));

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
