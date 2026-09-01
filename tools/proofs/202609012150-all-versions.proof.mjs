/**
 * Built vs all previous versions.
 *
 * Vikram, 2026-09-01: *"deepen grid computation — built vs all previous
 * versions."*
 *
 * The existing parity proof compares the modules against ONE incumbent:
 * the cartridge currently composed. That is the version most likely to
 * agree with them, because it is the one they were extracted from. This
 * asks the harder question — does every version this estate has ever
 * shipped still agree?
 *
 * It matters because the estate's numbers are cumulative. A distance
 * published on a card in v9.51 and the same distance published in v9.65
 * have to be the same distance, or one of them was wrong and nobody said
 * which. The hostile reviewer raised exactly this about the Earth radius:
 * 6378.137 km is the WGS-84 equatorial semi-major axis where a spherical
 * haversine would conventionally use the mean 6371.0088, which is +0.11%
 * on every figure. That is a decision for the whole estate to take at once
 * — grid-distance-maths owns the constant — and this proof is what makes
 * taking it safely possible, because it can name every artefact that would
 * have to move together.
 *
 * Three passes:
 *
 *   1. THE CONSTANT. Every JavaScript artefact under atlas/ that carries an
 *      Earth radius carries the SAME one, and no artefact anywhere carries
 *      a second, different radius. This is exhaustive over the tree, so a
 *      new file cannot quietly introduce a second geodesy.
 *
 *   2. THE ANSWER. Every shipped cartridge that exposes a measuring surface
 *      is loaded and run against the same battery as the geodesy module,
 *      including the versions long superseded. Identical to the last digit,
 *      or it is a finding.
 *
 *      WITH ONE HONEST LIMIT, measured rather than assumed. "Identical to
 *      the last digit" holds IN THIS ENGINE. Verified on the deployed page:
 *      for West Burton Solar to Cottam, Node's V8 (13.6) returns
 *      7.050150827184836 from the atan2 form and ...837 from the asin form,
 *      while Chrome's V8 returns ...837 from BOTH. The same source, two
 *      engines, a different last bit - Math.asin and Math.atan2 are not
 *      required to be correctly rounded and their implementations differ
 *      between builds.
 *
 *      So this proves the estate's versions agree with each other under one
 *      engine, which is what catches a form or constant that has actually
 *      diverged. It does NOT prove bit-identical output in every browser,
 *      and no proof run here could. The bound that does hold is the useful
 *      one: the forms are algebraically the same, so any difference is at
 *      the scale of floating-point epsilon - 1e-15 km here - and no figure
 *      this estate displays is quoted to anywhere near that precision.
 *
 *   3. THE HISTORY. The version ledger on the page is checked against the
 *      compositions actually on disk, so the list a reader sees is the list
 *      that was really shipped.
 *
 *   node tools/proofs/202609012150-all-versions.proof.mjs
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const ATLAS = join(REPO, 'atlas');
const ESTATE_RADIUS_KM = 6378.137;

let passed = 0;
const failures = [];
function check(label, condition, detail) {
  if (condition) { passed += 1; console.log('  [PASS] ' + label); }
  else {
    failures.push(label + (detail ? ` — ${detail}` : ''));
    console.log('  [FAIL] ' + label + (detail ? ` — ${detail}` : ''));
  }
}

function sandbox() {
  const box = { window: {}, console, Math, JSON, Number, String, Array, Object,
    Map, Set, Boolean, Error, RegExp, isNaN, parseFloat, parseInt };
  box.window.window = box.window;
  box.globalThis = box;
  vm.createContext(box);
  return box;
}

/* The same stubs the parity proof uses, because the same cartridges need
   them: a document that answers nothing, a MapLibre that constructs and
   does nothing, and an initVentusMap for the shell slot. */
function makeElement(tag) {
  return { tagName: tag, style: {}, dataset: {}, children: [],
    classList: { add() {}, remove() {}, contains: () => false },
    appendChild() {}, insertBefore() {}, addEventListener() {},
    removeEventListener() {}, setAttribute() {}, getAttribute: () => null,
    querySelector: () => null, querySelectorAll: () => [], remove() {},
    closest: () => null, getBoundingClientRect: () => ({ x: 0, y: 0, width: 0,
      height: 0, top: 0, left: 0, right: 0, bottom: 0 }) };
}
class MutationObserverStub { observe() {} disconnect() {} }

function cartridgeContext() {
  const documentStub = {
    baseURI: 'https://ventusltd.github.io/gridatlas/atlas/',
    head: makeElement('head'), body: makeElement('body'),
    getElementById: () => null, createElement: makeElement,
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
  vm.createContext(box);
  return box;
}

async function walk(directory) {
  const found = [];
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) found.push(full);
  }
  return found;
}

/* ─────────────────────────────────────────────────────────────────────────
   1. ONE RADIUS, EVERYWHERE, EVER
   ───────────────────────────────────────────────────────────────────────── */

console.log('\none radius, across every artefact in the tree\n');

/* Radii a spherical Earth model plausibly uses. If any of these appears
   anywhere in the tree it is a second geodesy, whatever it is called. */
const OTHER_RADII = [
  ['6371.0088', 'IUGG mean radius'],
  ['6371.008', 'mean radius, truncated'],
  ['6371.0', 'mean radius'],
  ['6371,', 'mean radius, bare'],
  ['6356.752', 'WGS-84 polar semi-minor axis'],
  ['6372.8', 'a common approximation'],
  ['3958.8', 'mean radius in miles'],
  ['3963.19', 'equatorial radius in miles']
];

/* Comments are stripped before the scan. The first run of this flagged the
   sandbox body for 6371.0088, which turned out to be a sentence explaining
   that turf.destination defaults to it and this estate does not - exactly
   the documentation that should be there. A check that punishes writing
   down WHY is a check that gets the comment deleted rather than the code
   fixed. Code position only. */
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/.*$/;   // the [^:] keeps https:// intact
const withoutComments = (text) => text
  .replace(BLOCK_COMMENT, ' ')
  .split('\n')
  .map(line => line.replace(LINE_COMMENT, '$1'))
  .join('\n');

const files = await walk(ATLAS);
const carriers = [];
const strangers = [];
for (const file of files) {
  const text = withoutComments(await readFile(file, 'utf8'));
  const relativePath = relative(REPO, file).replace(/\\/g, '/');
  if (text.includes(String(ESTATE_RADIUS_KM))) carriers.push(relativePath);
  for (const [radius, why] of OTHER_RADII) {
    if (text.includes(radius)) strangers.push(`${relativePath}: ${radius} (${why})`);
  }
}

console.log(`         ${files.length} JavaScript artefacts under atlas/, `
  + `${carriers.length} of them measure`);
for (const carrier of carriers) console.log(`           ${carrier}`);

check('the tree was actually walked, not silently empty', files.length > 20);
check('more than one version measures, so this comparison means something',
  carriers.length >= 4, `${carriers.length} carriers`);
check('no artefact anywhere carries a different Earth radius',
  strangers.length === 0, strangers.join('; '));

/* The FORM, not only the constant.
   ------------------------------------------------------------------------
   The local CI found this gap by reading every blob ever committed: this
   scan checked that every artefact used the same radius, and said nothing
   about how it used it. Two forms of the same identity - R*2*atan2(...) and
   2*R*asin(...) - are one unit in the last place apart, which is how the
   geodesy module diverged from every version around it while passing a
   radius check. */
const ATAN2_FORM = /Math\.atan2\(\s*Math\.sqrt\(\s*\w+\s*\)\s*,\s*Math\.sqrt\(\s*1\s*-\s*\w+\s*\)/;
const ASIN_FORM = /Math\.asin\(\s*Math\.sqrt\(/;
const wrongForm = [];
for (const file of files) {
  const code = withoutComments(await readFile(file, 'utf8'));
  if (!code.includes(String(ESTATE_RADIUS_KM))) continue;
  if (ASIN_FORM.test(code) && !ATAN2_FORM.test(code)) {
    wrongForm.push(relative(REPO, file).replace(/\\/g, '/'));
  }
}
check('every measuring artefact uses the estate haversine form, not only its radius',
  wrongForm.length === 0, wrongForm.join('; '));


/* ─────────────────────────────────────────────────────────────────────────
   2. EVERY SHIPPED VERSION STILL ANSWERS THE SAME
   ───────────────────────────────────────────────────────────────────────── */

console.log('\nthe geodesy module against every version that measures\n');

const geodesySource = await readFile(
  join(ATLAS, 'modules', '202609011950-geodesy.js'), 'utf8');
const geodesyBox = sandbox();
vm.runInContext(geodesySource, geodesyBox, { filename: 'geodesy.js' });
const geodesy = geodesyBox.window.__GRIDATLAS_MODULES__.geodesy;

check('the geodesy module is on the estate radius',
  geodesy.EARTH_RADIUS_KM === ESTATE_RADIUS_KM);

/* A battery chosen to break things, not to pass: a zero distance, a short
   hop, a long diagonal, the prime meridian crossed in both directions, and
   two real GB pairs whose figures have been published on cards. */
const BATTERY = [
  ['identical points', -0.6774547, 53.2926216, -0.6774547, 53.2926216],
  ['West Burton Solar to West Burton', -0.6774547, 53.2926216, -0.8092, 53.3616],
  ['West Burton Solar to Cottam', -0.6774547, 53.2926216, -0.7817, 53.3040],
  ['across the prime meridian, east to west', 0.15, 51.5, -0.15, 51.5],
  ['across the prime meridian, west to east', -0.15, 51.5, 0.15, 51.5],
  ['Lincolnshire to Blackhillock', -0.6774547, 53.2926216, -3.0, 57.5],
  ['one degree of latitude', 0, 50, 0, 51],
  ['one degree of longitude at 55N', 0, 55, 1, 55]
];

/* Each shipped cartridge exposes its measuring surface differently. This
   names them explicitly rather than guessing, because a cartridge whose
   surface is not found must be a FAILURE and not a silent skip - that is
   how a version quietly stops being compared. */
/* DISCOVERED from disk, never listed by hand.
   ------------------------------------------------------------------------
   A hand-written list is a list that stops including the newest version the
   moment someone forgets to add it - and a version that is not compared is
   a version that can drift without anyone hearing about it. Every cartridge
   that registers the neon-links measuring surface is found and compared,
   so cutting a new generation automatically widens this test rather than
   quietly narrowing it. */
const MEASURING = /(sld-sandbox|neon-substation-links)/;
const SURFACES = (await readdir(join(ATLAS, 'cartridges')))
  .filter(name => name.endsWith('.js') && MEASURING.test(name))
  .sort()
  .map(name => ({ file: name, version: name.slice(0, 12) }));

console.log(`         ${SURFACES.length} shipped cartridges expose a measuring surface`);
const composedNow = JSON.parse(
  await readFile(join(ATLAS, 'current.json'), 'utf8')).generation;
check('more than one generation is being compared, and the newest is included',
  SURFACES.length >= 4
  && SURFACES.some(entry => entry.file.startsWith(composedNow)),
  SURFACES.map(entry => entry.file).join(', '));

let compared = 0;
for (const surface of SURFACES) {
  const path = join(ATLAS, 'cartridges', surface.file);
  let source = null;
  try { source = await readFile(path, 'utf8'); } catch { /* reported below */ }
  if (source === null) {
    check(`${surface.file}: the shipped cartridge is still on disk`, false,
      'an immutable artefact is missing');
    continue;
  }

  const box = cartridgeContext();
  /* The load THROWS, and that is expected: these cartridges are carried
     engine slots and the V8 engine will not boot under a stub. They
     register their measuring surface on window before they reach the
     engine, which is exactly the "a missing source costs a drawing, never
     the session" discipline the estate already holds. What is NOT
     tolerated is the surface being absent afterwards - that is a version
     silently dropping out of this comparison, so it is a failure below. */
  try { vm.runInContext(source, box, { filename: surface.file }); }
  catch (_) { /* the carried engine will not boot under a stub */ }

  const measure = box.window.__GRIDATLAS_NEON_LINKS__?.measure;
  check(`${surface.file} (${surface.version}): exposes its measuring surface`,
    typeof measure?.distanceKm === 'function',
    'a version whose surface cannot be found is not being compared');
  if (typeof measure?.distanceKm !== 'function') continue;

  let agrees = true;
  const disagreements = [];
  for (const [label, aLon, aLat, bLon, bLat] of BATTERY) {
    const mine = geodesy.distanceKm(aLon, aLat, bLon, bLat);
    const theirs = measure.distanceKm(aLon, aLat, bLon, bLat);
    if (mine !== theirs) {
      agrees = false;
      disagreements.push(`${label}: ${theirs} vs ${mine}`);
    }
  }
  check(`${surface.file} (${surface.version}): agrees on all ${BATTERY.length} cases, exactly`,
    agrees, disagreements.join('; '));

  /* Voltage parsing travels with the measurement in these cartridges, and
     it has its own history of being wrong - a 750 V traction supply once
     read as 750 kV. Compared here too, across every version. */
  if (typeof measure.voltagesKv === 'function') {
    const AGREED = [{ voltage: '400000' }, { voltage: '400000;275000' },
      { kv: '132' }, {}, { voltage: 'not a number' }];
    check(`${surface.file} (${surface.version}): reads ordinary voltages identically`,
      AGREED.every(properties =>
        JSON.stringify(measure.voltagesKv(properties))
        === JSON.stringify(geodesy.voltagesKv(properties))));

    /* The low-voltage supplies are where versions are ALLOWED to differ,
       and where the difference must be in one direction only.
       ------------------------------------------------------------------
       Before v9.32 the parser took the number at face value, so a 750 V
       traction supply read as 750 kV and a 415 V works supply as 415 kV -
       voltages that do not exist on this network. v9.32 fixed it. So an
       older version disagreeing here is the fixed bug, not a regression,
       and the test asserts the SHAPE of the disagreement rather than
       waving it through: the module must be right, and any version that
       differs must differ by having been wrong in that specific way. */
    const IMPOSSIBLE = [['33000;750', 0.75], ['33000;11000;415', 0.415]];
    for (const [voltage, correctKv] of IMPOSSIBLE) {
      const theirs = measure.voltagesKv({ voltage });
      const mine = geodesy.voltagesKv({ voltage });
      const moduleIsRight = mine.includes(correctKv)
        && !mine.some(kv => kv > 400);
      const theyAgree = JSON.stringify(theirs) === JSON.stringify(mine);
      const theirsIsTheKnownBug = theirs.some(kv => kv === correctKv * 1000);
      check(`${surface.file} (${surface.version}): "${voltage}" is `
        + (theyAgree ? 'read correctly' : 'the pre-v9.32 impossible-voltage bug'),
        moduleIsRight && (theyAgree || theirsIsTheKnownBug),
        `${JSON.stringify(theirs)} vs ${JSON.stringify(mine)}`);
    }
  }
  compared += 1;
}

check('every version that measures was actually compared',
  compared === SURFACES.length, `${compared} of ${SURFACES.length}`);

/* ─────────────────────────────────────────────────────────────────────────
   3. THE HISTORY THE PAGE SHOWS IS THE HISTORY ON DISK
   ───────────────────────────────────────────────────────────────────────── */

console.log('\nthe versions the page lists are the versions that shipped\n');

const current = JSON.parse(await readFile(join(ATLAS, 'current.json'), 'utf8'));
const composedSandbox = current.cartridges.find(c => c.id === 'sld-sandbox');
const shipped = await readFile(
  join(ATLAS, 'cartridges', composedSandbox.path.replace('./cartridges/', '')), 'utf8');
const ledger = JSON.parse(shipped.match(/const VERSION_LEDGER = (\[[\s\S]*?\]);/)[1]);

/* Strictly increasing, except after the one stamp recorded as typed ahead
   of the clock (v9.67, 202609012250, cut at 18:51 UTC). The sandbox proof
   holds the same record; an unrecorded step backwards is a typed stamp. */
const TYPED_AHEAD = new Set(['202609012250']);
check('the ledger is not empty and is strictly increasing, except after the one stamp typed ahead',
  ledger.length > 25 && ledger.every((e, i) => i === 0 || e.g > ledger[i - 1].g
    || TYPED_AHEAD.has(ledger[i - 1].g)));
check('the versions in the ledger are strictly increasing without exception',
  ledger.every((e, i) => i === 0 || Number(e.v.slice(3)) > Number(ledger[i - 1].v.slice(3))));
check('its newest entry is the composition actually being served',
  ledger[ledger.length - 1].g === current.generation
  && ledger[ledger.length - 1].v === current.composition_version);

const compositions = (await readdir(join(ATLAS, 'manifests')))
  .filter(f => f.endsWith('-composition.json'))
  .map(f => f.slice(0, 12));
const claimed = new Set(ledger.map(e => e.g));
/* Only from the ledger's own first entry onward. The ledger begins at
   v9.16; four composition manifests predate it, and the cartridge already
   counts that era as PRE_SCOPE_COMPOSITIONS. Demanding they appear would
   be demanding the ledger claim a history it never had. */
const ledgerBegins = ledger[0].g;
const undeclared = compositions.filter(g => g >= ledgerBegins && !claimed.has(g));
check('every composition manifest from the ledger era onward appears in it',
  undeclared.length === 0, undeclared.join(', '));

/* A version in the ledger with no manifest is NOT a failure: the estate
   keeps only the compositions it still needs, and the ledger is the
   longer memory. It is reported so the difference stays visible. */
const withoutManifest = ledger.filter(e => !compositions.includes(e.g));
console.log(`         ${ledger.length} versions listed, ${compositions.length} composition `
  + `manifests retained, ${withoutManifest.length} versions older than the retained set`);

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const failure of failures) console.error('  ' + failure);
  process.exit(1);
}
console.log('every version this estate has shipped measures the same Earth, '
  + 'and the history the page shows is the history on disk.');
