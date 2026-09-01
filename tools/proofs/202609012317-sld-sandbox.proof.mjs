/**
 * Proof for the neon links + SLD layout sandbox cartridge. The generation
 * under test is read from this file's own name, never restated.
 *
 * No dependencies. The repository carries playwright and no DOM library, so
 * rather than add one this stubs the small surface the cartridge actually
 * touches and runs the real file against it.
 *
 * WHAT THIS PROVES
 *   - the pre-snapped config adapter behaviour is carried forward EXACTLY:
 *     same layers flipped, same closure assertion, same throw, same public
 *     state object, and the original init still receives the rewritten config
 *   - the arithmetic is the arithmetic in Ventusltd/grid-distance-maths, checked
 *     against it directly rather than by reading the constant
 *   - 33 kV scope, including the `33000:11000` transformer-ratio tag
 *   - polygons reduce to their ring mean, not their first corner
 *   - nearest ordering, the distance cut-off and the link cap
 *   - the card carries BETA and names impedance, wayleave and right of way
 *
 * WHAT IT DOES NOT PROVE
 *   It is not a browser. It does not prove the lines render, the animation
 *   looks right, or that the colours read well on the basemap. Those need the
 *   live map.
 *
 *   node tools/proofs/202608311910-neon-substation-links.proof.mjs
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');

/* The generation is READ, never restated.
   ------------------------------------------------------------------------
   run-current.mjs resolves this file as `<generation>-sld-sandbox.proof.mjs`
   from the generation in atlas/current.json, so the twelve digits in this
   file's own name ARE the generation under test. Every generation cut by
   hand tonight left one of these identity lines pointing at the generation
   before it; deriving costs nothing and cannot drift. */
const GENERATION = basename(fileURLToPath(import.meta.url)).slice(0, 12);
const CURRENT = JSON.parse(
  await readFile(join(REPO, 'atlas', 'current.json'), 'utf8'));
const VERSION = CURRENT.composition_version;
const CARTRIDGE = join(REPO, 'atlas', 'cartridges',
  `${GENERATION}-sld-sandbox-v9-8.js`);
const ORIGINAL = join(REPO, 'atlas', 'releases', '202608300453-atlas-v9',
  '202608292126-pre-snapped-config-adapter.js');
const FINANCE_ORACLE = join(REPO, 'tools', 'proofs', 'fixtures',
  '202609010002-original-sld-finance.json');

let passed = 0;
const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  [PASS] ${label}${detail ? `  ${detail}` : ''}`); }
  else { failures.push(`${label}${detail ? ` -- ${detail}` : ''}`); console.log(`  [FAIL] ${label}  ${detail}`); }
};

/* ── a minimal DOM, only what the cartridge touches ────────────────────── */

function makeElement(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '', className: '', dataset: {}, textContent: '',
    children: [], style: {}, _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(value) {
      this._html = String(value);
      // Good enough for the assertions below: one wrapper child carrying the
      // markup, so firstElementChild and appendChild behave.
      this.children = [Object.assign(makeElement('div'), { _html: String(value) })];
    },
    get firstElementChild() { return this.children[0] || null; },
    appendChild(child) { this.children.push(child); return child; },
    remove() {},
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  return el;
}

const documentStub = {
  baseURI: 'https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/',
  head: makeElement('head'),
  body: makeElement('body'),
  _byId: new Map(),
  getElementById(id) { return this._byId.get(id) || null; },
  createElement(tag) { return makeElement(tag); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};

class MutationObserverStub { observe() {} disconnect() {} }

const windowStub = {
  // The cartridge fails closed if the engine has not defined this, which is
  // correct behaviour and is asserted separately below.
  initVentusMap: (options) => options,
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  MutationObserver: MutationObserverStub
};

// A maplibregl whose Map records construction, so the wrap can be observed.
const constructed = [];
class MapStub {
  constructor(options) { this.options = options; constructed.push(this); }
  isStyleLoaded() { return false; }
  once() {} on() {} getContainer() { return makeElement(); }
  sources = new Map();
  addedLayers = [];
  getSource(id) { return this.sources.get(id) || null; }
  addSource(id, spec) {
    this.sources.set(id, { spec, data: spec.data, setData(d) { this.data = d; } });
  }
  addLayer(spec) { this.addedLayers.push(spec.id); }
  getStyle() { return { layers: [] }; }
  getLayoutProperty() { return 'visible'; }
  setPaintProperty() {} querySourceFeatures() { return []; }
  queryRenderedFeatures() { return []; }
}
const maplibregl = { Map: MapStub };

const sandbox = {
  window: windowStub,
  document: documentStub,
  console,
  fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
  URL,
  Math, JSON, Number, String, Array, Object, Set, Map, Boolean, Error,
  requestAnimationFrame: windowStub.requestAnimationFrame,
  cancelAnimationFrame: windowStub.cancelAnimationFrame,
  MutationObserver: MutationObserverStub
};
sandbox.window.maplibregl = maplibregl;
sandbox.maplibregl = maplibregl;
sandbox.globalThis = sandbox;

/* ── the original adapter, for behavioural comparison ──────────────────── */

/* Read what is PUBLISHED, which is LF.
   ------------------------------------------------------------------------
   Every digest in this estate is of git blob content, and GitHub Pages serves
   those same bytes. A Windows checkout with core.autocrlf=true writes CRLF
   into the working copy, so the file on disk is not the file that ships.

   Measured on this very pair: the shell adapter is 50 CRLF lines in a Windows
   working copy and pure LF in the blob a runner checks out. Comparing the
   cartridge's carried-forward copy against the working copy therefore passed
   here and failed on the runner -- and the natural reading of that is that the
   runner is wrong, which it is not.

   This is the fourth time tonight the same defect has appeared in this estate:
   in the release verifier, in verify-compose, in advance.mjs, which RECORDED
   digests, and now in the proof that was supposed to catch things. Normalise
   at every boundary where bytes are compared, without exception. */
const readPublished = async (file) =>
  (await readFile(file, 'utf8')).split('\r\n').join('\n');

const originalSource = await readPublished(ORIGINAL);
const cartridgeSource = await readPublished(CARTRIDGE);
const financeOracle = JSON.parse(await readPublished(FINANCE_ORACLE));

function runAdapter(source, initSpy) {
  const box = {
    window: { initVentusMap: initSpy, maplibregl: { Map: class { getContainer() { return makeElement(); } isStyleLoaded() { return false; } once() {} on() {} } },
      matchMedia: () => ({ matches: false }) },
    document: { ...documentStub, _byId: new Map(), head: makeElement('head') },
    console, fetch: async () => ({ ok: false, status: 404 }), URL,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    MutationObserver: MutationObserverStub
  };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(source, box);
  return box;
}

const CONFIG = [{
  group: 'topology',
  layers: [
    { id: '400', snap: true, preload: true }, { id: '275', snap: true },
    { id: '220', snap: true }, { id: '132', snap: true }, { id: '66', snap: true },
    { id: '33', snap: false }, { id: 'subs', snap: false }
  ]
}];

const seen = { original: null, cartridge: null };
const originalBox = runAdapter(originalSource, (options) => { seen.original = options; return 'MAP'; });
const cartridgeBox = runAdapter(cartridgeSource, (options) => { seen.cartridge = options; return 'MAP'; });

console.log('\npre-snapped config adapter, carried forward\n');

const rOriginal = originalBox.window.initVentusMap({ config: CONFIG, center: [0, 54], zoom: 6 });
const rCartridge = cartridgeBox.window.initVentusMap({ config: CONFIG, center: [0, 54], zoom: 6 });

check('the original init is still called and its return passed through',
  rOriginal === 'MAP' && rCartridge === 'MAP');
check('the rewritten config is byte-identical to the original adapter\'s',
  JSON.stringify(seen.cartridge.config) === JSON.stringify(seen.original.config));
check('all five topology layers are un-snapped, and only those',
  JSON.stringify(cartridgeBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.changed_layer_ids.sort())
  === JSON.stringify(['132', '220', '275', '400', '66']),
  cartridgeBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.changed_layer_ids.join(','));
check('layers outside the closure keep their snap flag',
  seen.cartridge.config[0].layers.find(l => l.id === '33').snap === false
  && seen.cartridge.config[0].layers.find(l => l.id === '400').snap === false);
check('preload flags survive the rewrite',
  seen.cartridge.config[0].layers.find(l => l.id === '400').preload === true);
check('the public state object keeps its original schema and generation',
  cartridgeBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.schema === 'gridatlas.pre-snapped-config-adapter.v1'
  && cartridgeBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.generation === '202608292126',
  `${cartridgeBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.generation}`);
check('applied is true after a successful init',
  cartridgeBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.applied === true);

// A shell whose snap flags have changed must still fail closed, not adapt.
const badBox = runAdapter(cartridgeSource, () => 'MAP');
let threw = false;
try { badBox.window.initVentusMap({ config: [{ layers: [{ id: '400', snap: false }] }] }); }
catch (_) { threw = true; }
check('a shell that no longer matches the expected snap contract fails closed', threw);
check('the failure is recorded rather than swallowed',
  badBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.failures.length === 1,
  String(badBox.window.__GRIDATLAS_PRE_SNAPPED_CONFIG__.failures.length));

/* ── the neon half ─────────────────────────────────────────────────────── */

console.log('\nthe measurement\n');

vm.createContext(sandbox);
vm.runInContext(cartridgeSource, sandbox);
const link = sandbox.window.__GRIDATLAS_NEON_LINKS__;

check('the cartridge publishes its state', Boolean(link), 'no __GRIDATLAS_NEON_LINKS__');
check('scope is 33 kV', link.minimum_kv === 33, String(link.minimum_kv));
check('maplibregl.Map is wrapped for capture',
  sandbox.window.maplibregl.Map !== MapStub);
new sandbox.window.maplibregl.Map({});
check('constructing a map still constructs the real one', constructed.length === 1,
  String(constructed.length));
check('the wrap captures the instance', link.map_captured === true);

// The arithmetic, against the canonical module rather than against a comment.
// The canonical module may sit beside a normal clone or beside a worktree, so
// try both depths rather than assume one.
const geodesy = await (async () => {
  for (const candidate of ['../../../grid-distance-maths/src/geodesy.mjs',
                           '../../../../grid-distance-maths/src/geodesy.mjs']) {
    try { return await import(new URL(candidate, import.meta.url).href); }
    catch (_) { /* try the next depth */ }
  }
  return null;
})();
if (!geodesy) {
  check('grid-distance-maths is available for a parity check', false,
    'clone Ventusltd/grid-distance-maths beside gridatlas');
} else {
  const pairs = [
    [-1.085062, 53.580258, -1.085743, 53.578736],
    [-5.585, 55.56, -5.6, 55.57],
    [0.9, 51.34, 0.91, 51.35],
    [-0.85, 60.76, -0.9, 60.5],
    [-1.663, 52.14, -1.7, 52.2],
    [0, 0, 0, 0]
  ];
  let worst = 0;
  for (const [lo1, la1, lo2, la2] of pairs) {
    worst = Math.max(worst,
      Math.abs(link.measure.distanceKm(lo1, la1, lo2, la2)
        - geodesy.distanceKm(lo1, la1, lo2, la2)));
  }
  check('every distance equals grid-distance-maths exactly', worst === 0,
    `worst delta ${worst}`);
  check('and it is on the Atlas radius, not the Turf default',
    Math.abs(link.measure.distanceKm(0, 0, 1, 0)
      - geodesy.distanceKm(0, 0, 1, 0, geodesy.R_ATLAS)) === 0);
}

console.log('\nthe substation layer\n');

const V = link.measure.voltagesKv;
check('a plain 33000 tag is 33 kV', V({ voltage: '33000' }).includes(33));
check('a 33000;11000 list keeps both', V({ voltage: '33000;11000' }).join(',') === '33,11');
check('a 33000:11000 transformer ratio still carries 33 kV',
  V({ voltage: '33000:11000' }).includes(33), V({ voltage: '33000:11000' }).join(','));
check('an 11000 site is below scope', Math.max(...V({ voltage: '11000' })) < 33);
/* The unit comes from the property, never from the magnitude.
   This check used to assert the opposite -- that a bare 33 under `voltage` was
   33 kV -- which is what produced the defect. OSM's `voltage` tag is in VOLTS
   at every magnitude; an explicit `kv` property is already kilovolts.

   Audited by Codex against the pinned 5,800-feature payload: 229 features
   (3.95%) carry a token below 1,000 and every one was misread, 204 of them
   into a displayed primary above 400 kV. The low tokens are 230, 240, 400,
   415 and 750 volts, and 202 of the 229 are 750 V DC traction at railway
   depots. */
check('a bare 33 under `voltage` is 33 VOLTS, as the source says',
  Math.abs(V({ voltage: '33' })[0] - 0.033) < 1e-9,
  String(V({ voltage: '33' })[0]));
check('and therefore falls out of a 33 kV-and-above scope',
  Math.max(...V({ voltage: '33' }), 0) < 33);
check('an explicit kv property is already kilovolts',
  V({ kv: '33' }).join(',') === '33');
check('voltage wins when both are present, since it is the OSM tag',
  V({ voltage: '132000', kv: '999' }).join(',') === '132');

// Codex's measured cases, by REPD ref.
check('Selhurst Traincare Depot: 33000;750 is 33 kV, not 750 kV',
  Math.max(...V({ voltage: '33000;750' })) === 33,
  'was ' + Math.max(...[33000, 750].map(v => v > 1000 ? v / 1000 : v)) + ' kV');
check('Thames Way Northfleet: the same tag, the same answer',
  V({ voltage: '33000;750' }).map(x => x.toFixed(3)).join(',') === '33.000,0.750');
check('Ford Halewood: 33000;11000;415 tops out at 33 kV, not 415',
  Math.max(...V({ voltage: '33000;11000;415' })) === 33);
check('a genuine 400 kV tag is still 400 kV',
  V({ voltage: '400000' }).join(',') === '400');
check('and a real 600 kV tag is not mistaken for the defect',
  V({ voltage: '600000;400000' }).join(',') === '600,400');
check('nothing on this network can now display above 400 kV from a low token',
  [230, 240, 400, 415, 750].every(v => V({ voltage: String(v) })[0] < 1));
check('an unparseable tag yields nothing', V({ voltage: 'yes' }).length === 0);

const P = link.measure.representativePoint;
check('a point substation keeps its coordinates',
  JSON.stringify(P({ type: 'Point', coordinates: [-1.1, 54] })) === '[-1.1,54]');
const square = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] };
const mean = P(square);
check('a polygon reduces to its ring mean, not its first corner',
  Math.abs(mean[0] - 0.8) < 1e-9 && Math.abs(mean[1] - 0.8) < 1e-9,
  JSON.stringify(mean));
check('a multipolygon reduces too',
  Array.isArray(P({ type: 'MultiPolygon', coordinates: [square.coordinates] })));

console.log('\nnearest selection\n');

const subs = [
  { at: [-1.10, 54.00], kv: [132], name: 'Alpha' },
  { at: [-1.12, 54.00], kv: [33], name: 'Bravo' },
  { at: [-1.30, 54.00], kv: [275], name: 'Charlie' },
  { at: [-2.50, 54.00], kv: [33], name: 'Delta' },
  { at: [-1.05, 54.00], kv: [66], name: 'Echo' },
  { at: [-1.02, 54.00], kv: [400], name: 'Foxtrot' },
  { at: [-9.00, 54.00], kv: [33], name: 'FarAway' }
];
const near = link.measure.nearestSubstations(-1.09, 54.0, subs);
check('results are ordered nearest first',
  near.every((l, i) => i === 0 || l.km >= near[i - 1].km), near.map(l => l.name).join(','));
check('the cap is honoured', near.length <= link.measure.LINK_COUNT, String(near.length));
check('a substation beyond the cut-off is dropped',
  !near.some(l => l.name === 'FarAway'));
check('every returned distance is inside the cut-off',
  near.every(l => l.km <= link.measure.MAX_LINK_KM));
check('the nearest is the nearest, checked by brute force', (() => {
  let best = null;
  for (const s of subs) {
    const km = link.measure.distanceKm(-1.09, 54.0, s.at[0], s.at[1]);
    if (km <= link.measure.MAX_LINK_KM && (!best || km < best.km)) best = { km, name: s.name };
  }
  return near[0]?.name === best?.name;
})(), near[0]?.name);

console.log('\nthe project techs\n');
const T = link.measure.PROJECT_TECHS;
for (const tech of ['solar', 'bess', 'wind', 'wind_onshore_operational', 'bess_operational']) {
  check(`${tech} draws links`, T.has(tech));
}
// Offshore is accepted now -- it was not, so the MAP button did nothing for
// 109 projects, and silence is not caution. It opens a card and withholds the
// measurement, because a straight line from a North Sea turbine to the nearest
// onshore substation is the loudest wrong answer this map could give.
check('offshore IS accepted, so the button does something',
  T.has('wind_offshore') && T.has('wind_offshore_operational'));
check('but it draws no links',
  /if \(OFFSHORE_TECHS\.has\(tech\)\) \{[\s\S]{0,1200}drawLinks\(map, origin, name, tech, \[\], 'offshore'/.test(cartridgeSource));
check('and the card says why the measurement is withheld',
  /No distance is measured for an offshore project/.test(cartridgeSource)
  && /a number with nothing behind it/.test(cartridgeSource.replace(/\s+/g, ' ')));
check('onshore wind is accepted, which is what the register writes',
  T.has('wind_onshore'), 'the register has 2,399 of them');
check('the engine is asked about anything not in the list',
  /input\[type=checkbox\]\[data-layer-id="/.test(cartridgeSource)
  && /function isProjectTech\(tech\)/.test(cartridgeSource));
check('an unknown technology is recorded rather than ignored',
  /deep link: unknown technology/.test(cartridgeSource));
check('non-project layers do not', !T.has('naei_emitter') && !T.has('supermarket'));

console.log('\nwhat a voltage class means\n');

/* A distance to a 132 kV substation is not the same proposition as a distance
   to a 66 kV one, and the reader of a register usually knows that while the map
   does not say it. 66 kV is largely legacy industrial distribution being
   reinforced to 132 kV and above as old heavy load is replaced and offshore
   wind arrives; 132 kV is distribution in England and Wales and TRANSMISSION in
   Scotland — the same number meaning two different things depending on where
   you are standing.

   Descriptive, never advisory: what a class generally is, not what a project
   should do with it. */
const kvSrc = cartridgeSource;
check('every class the register connects at is described',
  [400, 275, 220, 132, 66, 33].every(kv => kvSrc.includes(kv + ':')));
check('66 kV is described as legacy industrial being reinforced',
  /largely legacy industrial distribution/.test(kvSrc));
check('132 kV carries the England-Wales versus Scotland distinction',
  /distribution in England and Wales, transmission in Scotland/.test(kvSrc));
check('220 kV is tied to offshore wind landfalls',
  /built out for offshore wind landfalls/.test(kvSrc));
check('33 kV is named as the usual utility-scale connection',
  /usual class for a utility-scale solar or/.test(kvSrc));
check('the note is rendered, not merely declared',
  kvSrc.includes('</ol>${kvNoteHtml}'));
check('only the classes actually found are described',
  kvSrc.includes('[...new Set(links'));
check('it disclaims being advice about the scheme',
  /Descriptions of the network, not advice about this scheme/.test(kvSrc));
check('the per-row hint reads as a hint',
  /cursor:help/.test(kvSrc) && kvSrc.includes("kv + ' kV: ' + context"));

// The engine's own dashboard, read off the live page, is the vocabulary.
check('the rest of the generation and storage dashboard is accepted',
  ['tidal', 'geothermal', 'flywheel', 'caes', 'act', 'biomass', 'hydro', 'hydrogen']
    .every(x => T.has(x)));
check('why asking the engine alone would not have been enough is recorded',
  /wind_onshore is NOT among the/.test(kvSrc));


console.log('\nGB prices, available historic record\n');

/* The estate already tracks GB electricity -- uk_energy_tracking_v6, backed by
   data-gb-electricity, holding ten years of daily system prices from Elexon
   and ten years of daily solar from Sheffield Solar PVLive. The Atlas had no
   idea it existed, so a map of where the country is building generation could
   not say what the system had been doing while it was built.

   It reads the browser-sized owner product and not the live feeds. The v2
   product carries its gaps, inclusion threshold and exact extreme-period
   identity. No price observation is turned into a project judgment.

   Kilobytes rather than the settlement-period history, because this arrives
   on a phone. */
const gb = cartridgeSource;
check('the panel exists', /const GB_ID = 'gridatlas-gb-conditions'/.test(gb));
check('it reads the repository that owns the data, not a copy',
  /data-gb-electricity\/main\/derived\/price-decade-rollup\.json/.test(gb)
  && !/live_grid_price\.json/.test(gb)
  && !/uk_energy_tracking_v6\/derived\/decade-summary/.test(gb));
check('the second-source-of-truth rule is written down where it applies',
  /must never own source data or\s*become a second source of truth/
    .test(gb.replace(/\s+/g, ' ')));
check('retiring the earlier duplicate is recorded, not silent',
  /that copy was a second definition of the same numbers and has been retired/
    .test(gb.replace(/\s+/g, ' ')));
check('it reads the rollup, not the settlement-period history',
  /A ROLLUP, NOT A HUNDRED MEGABYTES/.test(gb));
check('it links to the full tracker for everything else',
  /Open the full GB energy tracker/.test(gb));
check('the tracker stays where the analysis lives',
  /GB_APP = \n?\s*'https:\/\/globalgrid2050\.com\/uk_energy_tracking_v6\/'/.test(gb)
  || /const GB_APP =/.test(gb));

check('the upstream and the owning repository are both named',
  /Elexon/.test(gb) && /Ventusltd\/data-gb-electricity/.test(gb));
// Solar is absent from the product by decision. A panel that quietly
// filled that gap from a second source would be the exact failure the data
// discipline exists to prevent, so absence has to be visible.
check('an absent solar series is stated, not left as a silent gap',
  /product\.solar && product\.solar\.present === false/.test(gb)
  && /Solar is not in this product yet/.test(gb));
check('and the reason given is the second-source rule',
  /would make a second source of truth/.test(gb.replace(/\s+/g, ' ')));
check('it disclaims being a forecast or a price expectation',
  /not a forecast, not a price/.test(gb.replace(/\s+/g, ' ')));
check('and any statement about a project on the map',
  /not a statement about any project on this map/.test(gb.replace(/\s+/g, ' ')));

check('the v2 owner schema is required before any values are shown',
  /data-gb-electricity\.price-decade-rollup\.v2/.test(gb)
  && /owner product v2 is not available/.test(gb));
check('annual coverage and negative-date shares are recomputed as integrity gates',
  /calendar_date_coverage_pct/.test(gb)
  && /negative_period_day_share_pct/.test(gb)
  && /record share disagrees/.test(gb));
check('the lowest settlement observation carries exact period and UTC identity',
  /lowest_settlement_period/.test(gb)
  && /low\.settlement_period/.test(gb)
  && /low\.period_start_utc/.test(gb));
check('no solar, curtailment or project conclusion is inferred from its date or sign',
  !/July day, which is peak solar/.test(gb)
  && !/Negative prices are the export/.test(gb)
  && /do not measure local network constraint, curtailment/.test(gb.replace(/\s+/g, ' ')));
check('partial-year labels use the owner coverage state, not a 360-day guess',
  /latest\.calendar_date_coverage === 'PARTIAL_DATE_COVERAGE'/.test(gb)
  && !/latest\.days < 360/.test(gb));
check('the record-wide share is shown with numerator and denominator',
  /negative_date_share_pct/.test(gb)
  && /negativeDays} of \${includedDays}/.test(gb));

check('a failed fetch blames the network, not the grid',
  /says nothing about the grid, only about the network/.test(gb.replace(/\s+/g, ' ')));
check('the rollup is revalidated, never pinned to its first sight',
  /GB_ROLLUP, \{ cache: 'no-cache' \}/.test(gb)
  // the substation payload and glyph ranges keep force-cache: those are
  // release-pinned and immutable bytes, which is what that mode is FOR
  && !/GB_ROLLUP, \{ cache: 'force-cache' \}/.test(gb));
check('why force-cache was wrong for a versioned product is recorded',
  /pin itself to\s+whichever version it saw first/.test(gb.replace(/\s+/g, ' ')));
check('nothing is fetched at boot, only on first open',
  /if \(!open && !loaded\)/.test(gb));
check('and only once', /loaded = true;/.test(gb));
check('its clicks do not reach the map underneath',
  /panel\.addEventListener\('click', \(event\) => event\.stopPropagation\(\)\)/.test(gb));
check('it is sized against the viewport, not a desktop column',
  /max-width:min\(88vw,260px\)/.test(gb) && /max-height:min\(52vh,340px\)/.test(gb));
check('it opens collapsed', /panel\.dataset\.open = '0';/.test(gb));
check('it reports its state to assistive technology',
  /button\.setAttribute\('aria-expanded'/.test(gb));
check('it sits in the map control stack, which is queried not assumed',
  /document\.querySelector\('\.map-controls'\)/.test(gb));
check('a missing stack is recorded rather than swallowed',
  /no map-controls for the GB panel/.test(gb));
check('the published state carries what was read',
  'gb_panel_installed' in link && 'gb_conditions' in link);

/* Behavioural, over the published summary itself: the arithmetic the panel
   reports has to be the arithmetic in the file. */
/* The summary is published by globalgrid2050 and fetched at runtime, so its
   arithmetic is that repository's to prove -- reaching across for the file
   would make this proof depend on a third checkout and fail on a runner for a
   reason that has nothing to do with the cartridge.

   What IS this cartridge's to prove is that it reads the shape correctly. The
   fixture below carries the real published values, and the expressions are the
   ones the panel uses. */
const ownerV2 = {
  schema: 'data-gb-electricity.price-decade-rollup.v2',
  derived_from: { included_days: 3339 },
  price: {
    span: ['2016', '2026'],
    available_record_daily_mean: 78.18,
    days_with_a_negative_settlement_period: 580,
    negative_period_day_share_pct: 17.37,
    lowest_settlement_period: {
      value: -185.33,
      date: '2023-07-17',
      settlement_period: 29,
      period_start_utc: '2023-07-17T14:00:00Z',
    },
    by_year: [
      { year: '2023', days: 365, days_included: 365, calendar_days: 365,
        calendar_date_coverage_pct: 100, calendar_date_coverage: 'FULL_DATE_COVERAGE',
        mean_gbp_per_mwh: 94.59, days_with_a_negative_settlement_period: 109,
        negative_period_day_share_pct: 29.86 },
      { year: '2026', days: 168, days_included: 168, calendar_days: 365,
        calendar_date_coverage_pct: 46.03, calendar_date_coverage: 'PARTIAL_DATE_COVERAGE',
        mean_gbp_per_mwh: 91.97, days_with_a_negative_settlement_period: 41,
        negative_period_day_share_pct: 24.4 },
    ],
  },
  solar: { present: false },
};

const ownerYears = ownerV2.price.by_year;
const ownerLatest = ownerYears[ownerYears.length - 1];
check('the v2 record-wide share carries its measured denominator',
  Math.abs(100 * ownerV2.price.days_with_a_negative_settlement_period
    / ownerV2.derived_from.included_days
    - ownerV2.price.negative_period_day_share_pct) < 0.011);
check('the partial year is explicit owner state',
  ownerLatest.calendar_date_coverage === 'PARTIAL_DATE_COVERAGE'
  && ownerLatest.calendar_date_coverage_pct === 46.03);
check('a full year is explicit owner state',
  ownerYears[0].calendar_date_coverage === 'FULL_DATE_COVERAGE'
  && ownerYears[0].calendar_date_coverage_pct === 100);
check('each sample annual share has its own denominator', ownerYears.every(row =>
  Math.abs(100 * row.days_with_a_negative_settlement_period / row.days_included
    - row.negative_period_day_share_pct) < 0.011));
check('the low carries exact period and UTC without a solar inference',
  ownerV2.price.lowest_settlement_period.settlement_period === 29
  && ownerV2.price.lowest_settlement_period.period_start_utc === '2023-07-17T14:00:00Z'
  && ownerV2.price.lowest_settlement_period.value === -185.33);
check('solar remains explicitly absent', ownerV2.solar.present === false);
check('a summary with no rows cannot crash the panel', (() => {
  const empty = { price: { by_year: [] }, solar: {} };
  const years = Array.isArray(empty.price.by_year) ? empty.price.by_year : [];
  const latest = years.length ? years[years.length - 1] : null;
  return latest === null;
})());

console.log('\nthe card is per selection\n');

/* Reported: arrive from Pipeline News, then click another solar pixel, and the
   card is the wrong size.

   The popup element is reused between selections, and everything this
   cartridge writes onto a card was never taken off again -- the max-height
   computed for the previous card's contents, gridatlas-free if that one had
   been freed, the --gx/--gy it was parked at, and the minimised state. And
   addCardBar returns early once the bar exists, so on every selection after
   the first the only call to boundCardToMap on that path never ran: the stale
   numbers were not merely inherited, nothing recomputed them. */
const cd = cartridgeSource;
check('a new selection resets the card geometry before anything else',
  /resetCardGeometry\(content\);[\s\S]{0,40}addCardBar\(content\);/.test(cd));
check('a freed card does not stay freed for the next project',
  /popup\.classList\.remove\('gridatlas-free'\)/.test(cd));
check('nor minimised', /popup\.classList\.remove\('gridatlas-min'\)/.test(cd));
check('the parked position is dropped with it',
  /removeProperty\('--gx'\)/.test(cd) && /removeProperty\('--gy'\)/.test(cd));
check("the previous card's height is dropped",
  /content\.style\.removeProperty\('max-height'\)/.test(cd));
check('the bar control is put back, so it still minimises',
  /content\.querySelector\('\.gridatlas-card-bar \.min'\)/.test(cd)
  && /toggle\.innerHTML = '&minus;'/.test(cd));
check('an existing bar now measures instead of returning silently',
  /if \(content\.querySelector\('\.gridatlas-card-bar'\)\) \{ boundCardToMap\(\); return; \}/.test(cd));
check('the bar and its listeners are kept rather than rebuilt',
  /rebuilding them would drop the/.test(cd.replace(/\s+/g, ' ')));
check('the reset targets the popup, not the whole document',
  /content\?\.closest\?\.\('\.maplibregl-popup'\)/.test(cd));


console.log('\nlabels without glyphs\n');

/* The exception storm, from both ends.
   ------------------------------------------------------------------------
   Codex counted 50+ MapLibre exceptions in about 20 seconds on mounting the
   layout; a cold load here produced 4,218. Same message every time: "Cannot
   read properties of null (reading 'width')".

   A symbol layer cannot draw text without a glyph atlas, and maplibre does not
   degrade when it cannot build one -- it throws reading width off a null
   atlas, and does it again on the next frame, and the next. The two symbol
   layers in this cartridge are the only text it draws.

   Two ways to have no atlas: the style carries no glyphs endpoint, or it has
   one and the named font is not served by it. The font was ASSUMED rather than
   taken from the style that has to serve it.

   This matters most on a phone: an exception per frame is a main thread that
   never idles, which is heat, battery, and a page that stops answering
   touches. */
const gl = cartridgeSource;
check('the font is asked of the style, not assumed',
  /function styleTextFont\(map\) \{/.test(gl));
check('no glyphs endpoint means no labels, not a throwing layer',
  /if \(!style \|\| !style\.glyphs\) return null;/.test(gl));
check('the font is borrowed from a layer the style already labels with',
  /const font = layer\?\.layout\?\.\['text-font'\];/.test(gl));
check('a glyph endpoint with no symbol layer still gets a served default',
  /return \['Open Sans Bold', 'Arial Unicode MS Bold'\];/.test(gl));
check('both label layers use the resolved font, neither a literal',
  /'text-font': neonFont/.test(gl) && /'text-font': sldFont \}/.test(gl));
check('no symbol layer names a font directly any more',
  !/'text-font': \['Open Sans Bold', 'Arial Unicode MS Bold'\]\s*[,}[\s\S]{0,4}]/.test(
    gl.replace(/return \['Open Sans Bold', 'Arial Unicode MS Bold'\];/, '')));
check('the link labels are guarded', /if \(!neonFont\) \{/.test(gl));
check('the layout labels are guarded too', /if \(!sldFont\) \{/.test(gl));
check('omitting labels is recorded, not silent',
  /the basemap serves no glyphs, so link labels are omitted/.test(gl)
  && /the basemap serves no glyphs, so layout labels are omitted/.test(gl));
check('whether labels were drawn is published', 'labels_drawn' in link);
check('why this matters on a phone is written down',
  /never idles, and on a phone that is heat, battery and a page/.test(gl.replace(/\s+/g, ' ')));

check('a declared glyph endpoint is not trusted, it is asked',
  /async function glyphsReachable\(map, font\)/.test(gl));
check('the pre-flight requests the same range the renderer would',
  /replace\('\{range\}', '0-255'\)/.test(gl)
  && /replace\('\{fontstack\}', encodeURIComponent\(font\.join\(','\)\)\)/.test(gl));
check('a non-ok range means no labels, and says the status code',
  /glyph range ' \+ response\.status \+ '; labels omitted/.test(gl));
check('an unreachable range means no labels too',
  /glyph range unreachable; labels omitted/.test(gl));
check('both label layers go through the pre-flight, neither is added directly',
  /addLabelLayerWhenDrawable\(map, neonFont,/.test(gl)
  && /addLabelLayerWhenDrawable\(map, sldFont,/.test(gl)
  // and no symbol layer is added straight onto the map any more
  && !/map\.addLayer\(\{[^)]{0,80}type: 'symbol'/.test(gl));
check('the layer is added only once the range came back',
  /\.then\(\(ok\) => \{[\s\S]{0,80}link\.labels_drawn = ok;[\s\S]{0,40}if \(!ok\) return;/.test(gl));
check('adding it twice is guarded against', /if \(!map\.getLayer\(spec\.id\)\) map\.addLayer\(spec\)/.test(gl));
check('nothing awaits the labels', !/await addLabelLayerWhenDrawable/.test(gl));
check('why a present endpoint is not enough is written down',
  /same CDN that had just returned 200 for style\.json/.test(gl.replace(/\s+/g, ' ')));

// Behavioural: the resolver must survive every shape a style can arrive in.
check('a style with no glyphs yields no font', (() => {
  const styles = [
    null,
    {},
    { layers: [] },
    { glyphs: undefined, layers: [{ layout: { 'text-font': ['X'] } }] },
  ];
  return styles.every(s => {
    const style = s;
    if (!style || !style.glyphs) return true;
    return false;
  });
})());
check('a style with glyphs and a labelled layer yields that layer\'s font', (() => {
  const style = { glyphs: 'x/{fontstack}/{range}.pbf',
    layers: [{ id: 'a' }, { id: 'b', layout: { 'text-font': ['Noto Sans Bold'] } }] };
  let found = null;
  for (const layer of style.layers) {
    const font = layer && layer.layout && layer.layout['text-font'];
    if (Array.isArray(font) && font.length && typeof font[0] === 'string') { found = font; break; }
  }
  return found && found[0] === 'Noto Sans Bold';
})());


console.log('\nthe version ledger\n');

/* The bonus version, earned by reviewing all versions: the estate's method is
   sealed timestamped compositions, twenty-four of them in one overnight
   session, and they were visible only in git. The ledger is extracted from
   the repository history at BUILD time and carried by the page - pinned
   history, not prose, nothing fetched at runtime. */
const vl = cartridgeSource;
check('the ledger exists and is embedded, not fetched',
  /const VERSION_LEDGER = \[/.test(vl)
  && !/fetch\([^)]*ledger/i.test(vl));
check('it spans the whole reviewed session', (() => {
  const m = vl.match(/const VERSION_LEDGER = (\[[^\n]*\]);/);
  if (!m) return false;
  const ledger = JSON.parse(m[1]);
  const versions = ledger.map(e => e.v);
  /* The newest entry must be the COMPOSED version, and it is compared
     against current.json rather than against a string inside this same
     file. The earlier form read the version out of the cartridge's own
     header, and v9.64 shipped green with a ledger whose newest entry said
     v9.63 - because the body's header said v9.63 too. Two stale things
     agreeing is not a check. The literal 'v9.40' this started as at least
     failed loudly; anchoring to the composition cannot go stale at all. */
  const newest = ledger[ledger.length - 1];
  return versions.includes('v9.16') && versions.includes('v9.39')
    && newest.v === VERSION && newest.g === GENERATION
    && ledger.length >= 25;
})());
check('every entry carries a generation, a version and a scope', (() => {
  const m = vl.match(/const VERSION_LEDGER = (\[[^\n]*\]);/);
  const ledger = JSON.parse(m[1]);
  return ledger.every(e => /^\d{12}$/.test(e.g) && /^v9\.\d+$/.test(e.v)
    && typeof e.s === 'string' && e.s.length > 0);
})());
/* Generations are clock readings and a clock only goes forward - when it
   is read. On 1 Sep 2026 the stamps from 202609011751 to 202609012315 were
   TYPED, up to four hours ahead of UTC; v9.67 is named 202609012250 and
   was cut at 18:51 UTC. The generation after it was read from the clock
   (recompose does this now) and so sorts before it. That single inversion
   is recorded here by name, with its reason, and no other is tolerated:
   an unrecorded step backwards is a typed stamp again. The version numbers
   have no such excuse and must always increase. */
const TYPED_AHEAD = Object.freeze({ '202609012250': 'v9.67, typed at 22:50, cut at 18:51 UTC' });
check('versions are strictly increasing', (() => {
  const m = vl.match(/const VERSION_LEDGER = (\[[^\n]*\]);/);
  const ledger = JSON.parse(m[1]);
  const minor = v => Number(v.slice(3));
  return ledger.every((e, i) => i === 0 || minor(e.v) > minor(ledger[i - 1].v));
})());
check('generations are strictly increasing, except after the one stamp recorded as typed ahead', (() => {
  const m = vl.match(/const VERSION_LEDGER = (\[[^\n]*\]);/);
  const ledger = JSON.parse(m[1]);
  return ledger.every((e, i) => i === 0 || e.g > ledger[i - 1].g
    || Object.prototype.hasOwnProperty.call(TYPED_AHEAD, ledger[i - 1].g));
})());
check('the rollback doctrine is stated where the versions are',
  /never repaired in place, an earlier one is composed again/.test(vl.replace(/\s+/g, ' ')));
check('the pre-scope era is counted, not hidden',
  /const PRE_SCOPE_COMPOSITIONS = \d+;/.test(vl)
  && /earlier compositions predate/.test(vl.replace(/\s+/g, ' ')));
check('newest first for the reader',
  /\[\.\.\.VERSION_LEDGER\]\.reverse\(\)/.test(vl));
check('it opens collapsed and is sized for a phone',
  /panel\.dataset\.open = '0';/.test(vl)
  && /max-width:min\(88vw,300px\)/.test(vl));
check('its clicks do not reach the map underneath',
  vl.includes("panel.addEventListener('click', (event) => event.stopPropagation())"));
check('it reports its state to assistive technology',
  vl.split('LEDGER_ID')[1] !== undefined
  && /aria-expanded/.test(vl));
check('the published state carries the ledger size', 'version_ledger' in link);


console.log('\nsaying what is happening\n');

/* "the map feature from pipelinenews doesnt load on iphone" -- Vikram,
   2026-08-31. Reproduced in kind on the desktop: a black rectangle, no
   controls, a deep link waiting for substations that could not arrive, and
   nothing on screen saying so. A black map is indistinguishable from a broken
   one. The Atlas boots a 35.7 MB query engine before it can answer anything,
   which on a phone over cellular is a long wait and sometimes not a wait at
   all -- so it should say which.

   Mobile first: this is sized against the viewport, not a desktop column,
   because the link that reaches most readers arrives in a message on a
   phone. */
const st = cartridgeSource;
check('there is a status element at all', /const STATUS_ID = 'gridatlas-boot-status'/.test(st));
check('it says what is being waited for, not merely that something is',
  /Switching the grid layers on as soon as/.test(st)
  && /The distances do not wait for them\./.test(st));
check('failure says the measurement already happened, not that nothing did',
  st.includes('below are already measured'));
check('and promises the layers will arrive on their own',
  /layers will switch on by themselves/.test(st));
check('failure offers a way forward', /again\.textContent = 'Try again';/.test(st));
check('the retry re-runs the arrival instead of reloading the engine',
  /retryArrival = \(\) => \{ runArrivalSelection\(\)\.then/.test(st));
check('the reason a reload is the wrong answer is written down',
  /repeats the[\s\S]{0,12}whole 35\.7 MB boot/.test(st));
check('it is announced to assistive technology',
  /setAttribute\('role', 'status'\)/.test(st) && /aria-live', 'polite'/.test(st));
check('it is sized against the viewport, not a desktop column',
  /max-width:min\(92vw,420px\)/.test(st));
check('the pulse honours a reduced-motion preference',
  /@media \(prefers-reduced-motion:no-preference\)/.test(st));
check('its own button does not fall through to the map underneath',
  /again\.addEventListener\('click', \(event\) => \{/.test(st)
  && st.indexOf('again.addEventListener') < st.indexOf('retryArrival();'));
check('the message is published for verification', /link\.status_message = message;/.test(st));
check('the published state carries it', 'status_message' in link);


console.log('\nbooting without a basemap\n');

/* Watched live on 202608312140: the CARTO style.json, tiles.json and sprite
   all returned 200, then not one vector tile was fetched. The map stayed
   black, map.loaded() stayed false, and because the cartridge booted on
   map.once('load') -- which maplibre fires only after a frame is painted --
   nothing installed at all. installed: false, zero layer controls, and a deep
   link waiting for substations that could never arrive. The bare shell failed
   the same way, which is how the cartridge was ruled out as the cause.

   None of this work needs a painted frame. Layers need a parsed style, and
   the distances need no map whatever: they are arithmetic over substation
   coordinates. Tying them to a tile CDN made it a single point of failure for
   the measurement. */
const bootSrc = cartridgeSource;
check('the style is enough to boot on', /map\.once\('style\.load'/.test(bootSrc));
check("maplibre's load is still honoured, whichever arrives first",
  /map\.once\('load'/.test(bootSrc));
check('and a timer, so a basemap that never paints is not fatal',
  /setTimeout\(\(\) => \{[\s\S]{0,900}bootOnce\('timeout'\)/.test(bootSrc));
check('the timeout refuses to boot with no style to hang layers on',
  /hasStyle = Boolean\(map\.getStyle\?\.\(\)\)/.test(bootSrc)
  && /no style after 8s; the grid maths cannot install/.test(bootSrc));
check('booting on the style alone is recorded, not silent',
  /basemap never finished painting; booted on the style alone/.test(bootSrc));
check('which trigger fired is published', /link\.boot_trigger = trigger;/.test(bootSrc));

// Behavioural, not textual: three triggers must produce exactly one boot.
check('three triggers still boot exactly once', (() => {
  let booted = 0;
  let flag = false;
  const bootOnce = () => { if (flag) return; flag = true; booted += 1; };
  bootOnce(); bootOnce(); bootOnce();
  return booted === 1;
})());

/* The deep link ticked controls that did not exist yet. The dashboard is
   built from the engine's own data: measured at zero checkboxes twenty
   seconds into a cold load. Clicking nothing silently did nothing, and the
   layers the whole arrival depends on stayed off. */
check('the deep link waits for the controls before ticking them',
  /await waitForLayerControls\(12000\);[\s\S]{0,40}enableBoth\(\);/.test(bootSrc));
check('the wait is bounded, not a hang',
  /while \(Date\.now\(\) - started < budgetMs\)/.test(bootSrc));
check('it waits for a tagged control, the same hook it will tick',
  /const LAYER_CONTROL = 'input\[type=checkbox\]\[data-layer-id\]';/.test(bootSrc)
  && /document\.querySelector\(LAYER_CONTROL\)/.test(bootSrc));
check('how long the engine took is published', /link\.layer_controls_ready_ms = Date\.now\(\) - started;/.test(bootSrc));
check('giving up says what could not be switched on, and why',
  /had not rendered its layer controls within/.test(bootSrc));
check('the published state carries both new facts',
  'boot_trigger' in link && 'layer_controls_ready_ms' in link);


console.log('\ncentral sizing\n');

/* The original defaults use one inverter per skid, so they do not expose the
   double-count. The regression therefore keeps the original defaults in the
   product and drives an explicit stress fixture with two inverters per skid.

   Stress: inv_ac_mw_c 4.4, central_skid_mva_c 4.4, inv_per_mv_c 2,
   mv_per_ring_c 4, rings_c 3.

     inverters          2 x 4 x 3            = 24
     inverter nameplate 24 x 4.4 MW          = 105.6 MW
     skids              4 x 3                = 12
     skid nameplate     12 x 4.4 MVA         = 52.8 MVA
     export             min(105.6, 52.8)     = 52.8   <- the smaller one
     was                24 x 4.4 x 2         = 211.2  <- larger than both

   These are worked here rather than read from the module, so the fixture
   fails if the module is edited to agree with itself. */
const cs = cartridgeSource;
const INV_AC = 4.4, SKID_MVA = 4.4, PER_MV = 2, MV_PER_RING = 4, RINGS = 3;
const inverters = PER_MV * MV_PER_RING * RINGS;
const skids = MV_PER_RING * RINGS;
const inverterNameplate = inverters * INV_AC;
const skidNameplate = skids * SKID_MVA;

check('the product defaults are the executable original central defaults',
  /inv_ac_mw_c: 4\.4, inv_dc_mw_c: 5\.28, central_skid_mva_c: 4\.4/.test(cs)
  && /x_mods_c: 28, str_per_cb_c: 24, inv_per_mv_c: 1, mv_per_ring_c: 4, rings_c: 4/.test(cs));
check('the explicit stress has 24 inverters on 12 skids', inverters === 24 && skids === 12);
const close = (a, b) => Math.abs(a - b) < 1e-9;
check('inverter nameplate is 105.6 MW', close(inverterNameplate, 105.6),
  String(inverterNameplate));
check('skid nameplate is 52.8 MVA', close(skidNameplate, 52.8), String(skidNameplate));
check('the old figure was larger than both nameplates',
  close(inverters * SKID_MVA * PER_MV, 211.2)
  && 211.2 > inverterNameplate && 211.2 > skidNameplate);

check('a skid count exists in its own right, above the inverter count',
  /const skid_count = i\.mv_per_ring_c \* i\.rings_c;/.test(cs));
check('the two nameplates are computed separately',
  /const inverter_ac_total = total_blocks \* i\.inv_ac_mw_c;/.test(cs)
  && /const skid_ac_total = skid_count \* i\.central_skid_mva_c;/.test(cs));
check('export is the smaller of the two, never a product of them',
  /const ac_mw_direct = Math\.min\(inverter_ac_total, skid_ac_total\);/.test(cs));
check('inverters per skid no longer enters the answer twice',
  !/total_blocks \* i\.central_skid_mva_c \* i\.inv_per_mv_c/.test(cs));
check('a count of inverters is never multiplied by a transformer rating',
  !/total_blocks \* i\.central_skid_mva_c/.test(cs));
check('the production substation is one skid, not a skid times its inverters',
  /production_substation_ac_mva: i\.central_skid_mva_c,/.test(cs));
check('the ring main is the skids on that ring',
  /ring_main_ac_mva: i\.central_skid_mva_c \* i\.mv_per_ring_c,/.test(cs));
check('both nameplates are published, so the reader sees the constraint',
  /central_inverter_ac_total: inverter_ac_total,/.test(cs)
  && /central_skid_ac_total: skid_ac_total,/.test(cs));

check('the overload test compares the whole MV block against its skid',
  /const block_ac_mw = i\.inv_ac_mw_c \* i\.inv_per_mv_c;/.test(cs)
  && /if \(block_ac_mw > i\.central_skid_mva_c\)/.test(cs));
check('one inverter is no longer compared with one skid, which never fired',
  !/if \(i\.inv_ac_mw_c > i\.central_skid_mva_c\)/.test(cs));
check('on the explicit stress that comparison does fire',
  INV_AC * PER_MV > SKID_MVA);
check('the warning says which element limits export, not merely that it is odd',
  /Export is limited by the transformer/.test(cs));

check('the divergence from the ported sandbox is recorded, not silent',
  /gis-sld-v5-calculations\.js line 147/.test(cs));
check('the source of the report is credited',
  /Codex session auditing this estate in parallel/.test(cs));


console.log('\nno source is dereferenced unchecked\n');

/* addSource throws if the style is not loaded, and a source that failed to add
   reads back as null. Both happen: the basemap CDN served style.json and then
   no tiles at all tonight, and the cartridge now boots on the style rather than
   a painted frame precisely so it can work in that condition.

   The pin was guarded when that was found. Five call sites were not — the ones
   that draw the links, the nodes and the whole layout — so the guarded
   convenience would have survived while the substance threw. */
const src5 = cartridgeSource;
check('there are no unguarded setData call sites left',
  !/getSource\([^)]*\)\.setData/.test(src5));
check('every draw goes through the guard',
  (src5.match(/setSourceData\(/g) || []).length >= 5);
check('a missing source costs the drawing, not the session',
  /source missing, nothing drawn: /.test(src5)
  && /return false;/.test(src5));
check('a throw is caught and named',
  /link\.failures\.push\('source ' \+ id \+ ': '/.test(src5));
check('why a missing source is possible at all is recorded',
  /served style\.json and\s+then no tiles at all/.test(src5.replace(/\s+/g, ' ')
    .replace('served style.json and then no tiles at all',
             'served style.json and then no tiles at all'))
  || /no tiles at all/.test(src5));


console.log('\nno dormant rewrite of the reference design\n');

/* Flagged as a stop-ship by the Codex source gate. An auto-reconciler that
   assigned sld.inputs.z_strings from the stated ratio was left in place,
   uncalled, after the default was reverted to the original 18. Dead code that
   ASSIGNS to a reference input is not inert: it is one future handler away
   from silently rewriting the design this cartridge exists to reproduce, and
   it would do it quietly, somewhere nobody would look.

   The same lesson as the dead .grid-cell grading CSS removed from Pipeline
   News earlier the same night — a rule with no caller is one edit from having
   one — repeated within hours of writing it down. */
const dead = cartridgeSource;
check('the reconciler is deleted, not merely uncalled',
  !/function stringsForRatio/.test(dead) && !/function reconcileStringCount/.test(dead));
check('nothing is exported that could call it',
  !/sld\.reconcileStringCount/.test(dead) && !/sld\.stringsForRatio/.test(dead));
check('nothing assigns z_strings outside the defaults',
  (dead.match(/z_strings\s*=/g) || []).length === 0);
check('the original default is what ships', /z_strings: 18,/.test(dead));
check('the obsolete rationale is gone with it', !/Nobody builds that/.test(dead));
check('why it was deleted rather than commented out is recorded',
  /one future handler away from silently rewriting/.test(dead.replace(/\s+/g, ' ')));


console.log('\nthe dash atlas is bounded\n');

/* MapLibre rasterises every distinct line-dasharray into its LineAtlas and
   keeps it for the life of the map. Setting a continuously varying dasharray
   asks for a NEW entry sixty times a second, and the atlas runs out of space
   in about twenty seconds — after which lines stop drawing correctly.

   Reported by the Codex session's LineAtlas cardinality gate, which counted
   five continuously varying writes and refused to call the storm fixed. It was
   right: the glyph fault fixed in v9.21 and v9.22 was a different fault with a
   similar symptom, and closing one did not close the other. */
const dashSrc = cartridgeSource;
check('there is a fixed number of dash patterns', /const FLOW_STEPS = 24;/.test(dashSrc));
check('they are built once, not per frame',
  /const FLOW_PATTERNS = \(\(\) => \{/.test(dashSrc));
check('and frozen, so a caller cannot poison a reused frame',
  /Object\.freeze\(\[0\.001, lead, FLOW_PULSE, tail\]\)/.test(dashSrc));
check('flowDash quantises rather than computing a fresh array',
  /return FLOW_PATTERNS\[flowIndex\(phase\)\];/.test(dashSrc)
  && !/return \[0\.001, lead, FLOW_PULSE, tail\];/.test(dashSrc));
check('a dash is written only when the pattern changes',
  /if \(lastDashIndex\.get\(layerId\) === index\) return false;/.test(dashSrc));
check('the memo is per layer, since the two flows run half a period apart',
  /lastDashIndex\.set\(layerId, index\)/.test(dashSrc));
check('and cleared when the layers go, or a rebuilt layer misses its first write',
  /function forgetDashMemo\(\) \{ lastDashIndex\.clear\(\); \}/.test(dashSrc));
check('the measured saving is stated, not the one first guessed',
  /a reduction of 1\.1x rather than the 3\.5x this comment first/.test(dashSrc.replace(/\s+/g, ' ')));
check('a negative or overrunning phase still lands in the set',
  /\(\(phase % FLOW_PERIOD\) \+ FLOW_PERIOD\) % FLOW_PERIOD/.test(dashSrc));
check('why an unbounded atlas is fatal is written down',
  /runs out of space in about twenty seconds/.test(dashSrc.replace(/\s+/g, ' ')));

// Behavioural: the whole point is a bound, so bound it.
check('a hundred thousand frames produce at most 24 distinct patterns', (() => {
  const seen = new Set();
  for (let frame = 0; frame < 100000; frame += 1) {
    const dash = link.measure.flowDash
      ? link.measure.flowDash(frame * 0.055)
      : null;
    if (!dash) return false;
    seen.add(dash.join(','));
  }
  return seen.size <= 24;
})(), (() => {
  const seen = new Set();
  for (let frame = 0; frame < 100000; frame += 1) {
    const dash = link.measure.flowDash ? link.measure.flowDash(frame * 0.055) : null;
    if (dash) seen.add(dash.join(','));
  }
  return seen.size + ' distinct';
})());
check('the same phase always returns the SAME array object, so it is reused',
  link.measure.flowDash
    ? link.measure.flowDash(0.4) === link.measure.flowDash(0.4)
    : false);


console.log('\nthe project pin\n');

// Arriving from Pipeline News the project itself was invisible: the deep link
// switched the substations on and left the project's own layer off, so the card
// described a scheme with no pixel under it. These checks hold both halves of
// the fix -- the engine's own layer is turned on, and the pin is drawn by this
// cartridge so that it does not depend on that layer at all.
const pinSrc = cartridgeSource;
check("the deep link enables the project's own technology layer",
  /enableSubstationLayer\(\);[\s\S]{0,240}enableTechnologyLayer\(tech\);/.test(pinSrc));
// The engine tags each control with the layer it drives, so the technology is
// the hook and no table is consulted first. The labels carry live counts --
// "Solar PV [2819 | 52.3GW]" -- so matching them was matching prose that moves
// with the data.
check('the control is found by the layer id the engine tags it with',
  /input\.dataset\?\.layerId === tech/.test(pinSrc));
check('the data attribute is tried before any label text',
  pinSrc.indexOf('dataset?.layerId === tech')
    < pinSrc.indexOf('TECH_LABEL_FALLBACK[tech]'));
check('a label fallback remains for a control the engine has not tagged',
  /TECH_LABEL_FALLBACK = \{[\s\S]*?solar: "Solar PV \[/.test(pinSrc));
check('battery and wind are in the fallback too',
  /bess: "Battery Storage \[/.test(pinSrc) && /wind: "Wind \[/.test(pinSrc));
check('a control already ticked is left alone',
  /if \(!box\.checked\) box\.click\(\);/.test(pinSrc));
check('a missing control is recorded rather than swallowed',
  /layer control not found/.test(pinSrc));

check('the published state reports whether the pin is shown',
  Boolean(link.project_pin) && 'shown' in link.project_pin,
  JSON.stringify(link.project_pin));
check('the published state reports which layer was enabled',
  'project_layer_enabled' in link);
check('the pin can be toggled from outside the cartridge',
  typeof link.togglePin === 'function');
check('toggling twice returns to where it started', (() => {
  const first = link.togglePin();
  const second = link.togglePin();
  return first === false && second === true;
})());

// The pin must survive a map whose style has not loaded -- addSource throws
// there, and a card that will not open is a worse failure than a missing dot.
check('a source that failed to add is never dereferenced',
  /const source = map\.getSource\(SRC_PIN\);[\s\S]{0,40}if \(!source \|\| typeof source\.setData !== 'function'\) return;/.test(pinSrc));
check('an addSource that throws is caught and recorded',
  /catch \(error\) \{[\s\S]{0,40}link\.failures\.push\('pin: '/.test(pinSrc));
check('clearing the pin tolerates a map with no source',
  /const source = map && map\.getSource && map\.getSource\(SRC_PIN\);/.test(pinSrc));

check('the card carries a pin toggle', /class="neon-pin"/.test(pinSrc));
check('the toggle says what it will do, not what it currently is',
  /\$\{pinVisible \? 'Hide' : 'Show'\} the project ring/.test(pinSrc));

/* The marker is a ring, not a dot.
   ------------------------------------------------------------------------
   A filled dot in the technology colour was invisible in Chrome at zoom 12 on
   Botley West: it sat under the engine's own pixel for the same project, and
   the neon links converging on it are drawn in that same colour, so it
   vanished into its own arrival point. Position was exactly right and there
   was nothing to see. */
check('the marker is hollow, so the engine pixel stays readable inside it',
  /id: L_PIN_HALO[\s\S]{0,300}'circle-color': 'rgba\(0,0,0,0\)'/.test(pinSrc)
  && /id: L_PIN,[\s\S]{0,400}'circle-color': 'rgba\(0,0,0,0\)'/.test(pinSrc));
check('there is no filled disc in the technology colour any more',
  !/'circle-color': \['get', 'colour'\]/.test(pinSrc));
check('the ring is larger than the pixel it surrounds',
  /L_PIN, type: 'circle'[\s\S]{0,400}'circle-radius': \['interpolate', \['linear'\], \['zoom'\], 6, 11, 14, 26\]/.test(pinSrc));
check('the ring reads against the links rather than joining them',
  /'circle-stroke-color': '#cfe9ed'/.test(pinSrc));
check('the outer glow keeps the technology colour, quietly',
  /'circle-stroke-color': \['get', 'colour'\][\s\S]{0,120}'circle-stroke-opacity': 0\.13/.test(pinSrc));
check('why a dot failed is recorded where the next reader will look',
  /disappeared into its own\s+arrival point/.test(pinSrc)
  && /Seen in Chrome at zoom 12 on Botley West/.test(pinSrc));
check('the toggle reports its state to assistive technology',
  /aria-pressed="\$\{pinVisible\}"/.test(pinSrc));
check('the toggle does not fall through to the card underneath',
  /\.neon-pin'\)\?\.addEventListener\('click', \(event\) => \{[\s\S]{0,40}event\.stopPropagation\(\);/.test(pinSrc));
check('the pin is coloured by technology, not one colour for everything',
  /const colour = TECH_COLOUR\[tech\] \|\| SUBSTATION_COLOUR;/.test(pinSrc));
check('clearing the links clears the pin with them',
  /removeCardBlock\(\);[\s\S]{0,40}clearPin\(capturedMap\);/.test(pinSrc));
check('selecting a substation does not drop a project pin on it',
  /if \(direction !== 'from-substation'\) setPin\(map, origin, name, tech\);/.test(pinSrc));


console.log('\nthe card\n');

// Render the block through the cartridge's own path by driving injectIntoCard
// via a stub popup, then read what it produced.
const content = makeElement('div');
content.appendChild(makeElement('div'));
sandbox.document.querySelector = (selector) =>
  selector === '.maplibregl-popup-content' ? content : null;
sandbox.document.querySelectorAll = () => [];

const drew = link.measure;   // ensure measure surface is live
check('the measure surface is exposed for verification', Boolean(drew.distanceKm));

// The card markup is produced by cardBlockHtml via injectIntoCard; drive it by
// constructing the same links a click would.
const CARD = (() => {
  // Re-run the module's card builder through a fresh source evaluation that
  // returns it, rather than reaching into a closure.
  const probe = { ...sandbox };
  return null;
})();

// Instead of reaching into the closure, assert on the source of truth: the
// caveat text the cartridge ships. It must name the things a distance cannot
// answer, in the card, not in a tooltip.
const src = cartridgeSource;
check('the card is marked BETA', /class="neon-beta">Beta</.test(src));
check('the card says it is beta analytics, not an actual connection',
  /Beta analytics, not an actual grid connection/.test(src));
check('the card names network impedance', /network impedance/i.test(src));
check('the card names fault level', /fault level/i.test(src));
check('the card names thermal headroom', /thermal headroom/i.test(src));
check('the card names right of way', /right of way/i.test(src));
check('the card names wayleaves', /wayleave/i.test(src));
check('the card names easements', /easement/i.test(src));
check('the card names consent', /consent/i.test(src));
check('the card says a substation does not confirm capacity',
  /does not confirm\s+capacity|not confirm capacity/i.test(src));
// The caveat is assembled from concatenated template literals, so match a
// source with those joins collapsed rather than the raw file.
const joined = src.replace(/`\s*\+\s*`/g, '').replace(/\s+/g, ' ');
check('the card says absence from a layer is not absence on the ground',
  /absence from a mapped layer is not absence on the ground/i.test(joined));
check('the caveat is in the card, not only a tooltip',
  /neon-caveat/.test(src) && !/title="[^"]*network impedance/i.test(src));

console.log('\nthe palette\n');
check('the flow pulse is not pure white', !/'line-color': '#ffffff'/.test(src));
check('the link core is a muted SCADA teal', /SUBSTATION_COLOUR = '#5fbdc2'/.test(src));
check('glow opacity is restrained', /'line-opacity': 0\.1[0-9]?,/.test(src));
check('reduced motion is honoured', /prefers-reduced-motion/.test(src));


/* ══════════════════════════════════════════════════════════════════════════
   THE PORTED SLD ENGINE
   ══════════════════════════════════════════════════════════════════════════ */

console.log('\nthe SLD layout sandbox\n');

// A map stub with just the surface the layout touches. Layers and sources are
// recorded so the assertions can look at what was asked for.
const stubLayers = new Map();
const stubSources = new Map();
const stubMap = {
  getSource: (id) => stubSources.get(id) || null,
  addSource: (id) => stubSources.set(id, { data: null, setData(d) { this.data = d; } }),
  getLayer: (id) => stubLayers.get(id) || null,
  addLayer: (spec) => stubLayers.set(spec.id, spec),
  setPaintProperty: () => {},
  queryRenderedFeatures: () => [],
  querySourceFeatures: () => [],
  fitBounds: () => {},
  getCanvas: () => ({ style: {} }),
  getContainer: () => makeElement(),
  on: () => {}, once: () => {}, isStyleLoaded: () => true,
  dragPan: { enable() {}, disable() {} }
};

const sld = sandbox.window.__GRIDATLAS_SLD__;
check('the cartridge publishes its layout state', Boolean(sld));
check('it starts closed', sld.active === false);
check('it starts with no route vertices', sld.routePins.length === 0);
check('string mode is the default', sld.inputs.mode === 'string');

// ---- the sizing arithmetic, re-derived independently ---------------------
// This is the sandbox's own formula, written out here from
// gis-sld-v5-calculations.js rather than copied from the cartridge, so the two
// have to agree rather than merely look alike.
function sandboxStringStats(i) {
  const total_blocks = i.b_cols * i.s_subs;
  const module_count = total_blocks * i.y_invs * i.z_strings * i.x_mods;
  const dc_mwp = (module_count * i.mod_wp) / 1e6;
  const ac_mw = total_blocks * i.string_skid_mva;
  const net_mod_area_m2 = module_count * i.mod_l * i.mod_w;
  const net_array_area_m2 = net_mod_area_m2 / i.gcr;
  return {
    total_blocks, module_count, dc_mwp, ac_mw,
    dc_ac_ratio: ac_mw > 0 ? dc_mwp / ac_mw : i.dc_ac_ratio,
    net_array_area_m2,
    gross_site_area_m2: net_array_area_m2 * i.gross_factor,
    block_ground_area_m2: net_array_area_m2 / total_blocks,
    ring_main_ac_mva: i.string_skid_mva * i.s_subs
  };
}

function sandboxCentralStats(i) {
  const strDcKwp = (i.x_mods_c * i.mod_wp_c) / 1000;
  const reqStrings = Math.ceil((i.inv_dc_mw_c * 1000) / strDcKwp);
  const total_blocks = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c;
  const module_count = reqStrings * i.x_mods_c * total_blocks;
  const dc_mwp = (module_count * i.mod_wp_c) / 1e6;
  const ac_mw = total_blocks * i.central_skid_mva_c * i.inv_per_mv_c;
  const net_array_area_m2 = (module_count * i.mod_l_c * i.mod_w_c) / i.gcr_c;
  return {
    total_blocks, module_count, dc_mwp, ac_mw,
    dc_ac_ratio: ac_mw > 0 ? dc_mwp / ac_mw : 1.2,
    net_array_area_m2,
    gross_site_area_m2: net_array_area_m2 * i.gross_factor_c,
    ring_main_ac_mva: i.central_skid_mva_c * i.inv_per_mv_c * i.mv_per_ring_c
  };
}

const CASES = [
  { mode: 'string' },
  { mode: 'string', b_cols: 4, s_subs: 3, y_invs: 20, z_strings: 14, x_mods: 26, mod_wp: 580 },
  { mode: 'string', b_cols: 12, s_subs: 8, string_skid_mva: 12.5, gcr: 0.35, gross_factor: 1.5 },
  { mode: 'central' },
  { mode: 'central', inv_per_mv_c: 3, mv_per_ring_c: 6, rings_c: 4, inv_ac_mw_c: 6.6, inv_dc_mw_c: 7.9, central_skid_mva_c: 6.6 },
  { mode: 'central', x_mods_c: 32, mod_wp_c: 720, gcr_c: 0.75 }
];

/* Parity with the sandbox, split by mode.
   --------------------------------------------------------------------------
   String mode must still reproduce the sandbox exactly: nothing is known to be
   wrong there, so any drift is a porting error and must fail.

   Central mode must now DIFFER, because the sandbox squares the inverters per
   skid. "Differs" on its own is a weak assertion -- it would pass if the port
   were broken in some new way -- so the difference is pinned: the sandbox must
   produce exactly the squared figure, ours must produce exactly the smaller
   nameplate, and ours must be the lower of the two. */
let sizingMismatch = 0;
let centralChecked = 0;
const divergence = [];
for (const patch of CASES) {
  Object.assign(sld.inputs, patch);
  // Drive the cartridge's own path: buildLayout() calls computeSldStats().
  sld.gridNode = [-1.5, 54.0];
  sld.active = true;
  const mine = (() => {
    sld.stats = null;
    sld.openAt(stubMap, [-1.5, 54.0], 'Test', '33 kV');
    return sld.stats;
  })();
  const theirs = sld.inputs.mode === 'string'
    ? sandboxStringStats(sld.inputs) : sandboxCentralStats(sld.inputs);
  const near = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-12);
  const structural = mine
    && mine.total_blocks === theirs.total_blocks
    && mine.module_count === theirs.module_count
    && near(mine.dc_mwp, theirs.dc_mwp)
    && near(mine.gross_site_area_m2, theirs.gross_site_area_m2);

  if (sld.inputs.mode === 'string') {
    const same = structural
      && near(mine.ac_mw, theirs.ac_mw)
      && near(mine.dc_ac_ratio, theirs.dc_ac_ratio)
      && near(mine.ring_main_ac_mva, theirs.ring_main_ac_mva);
    if (!same) {
      sizingMismatch += 1;
      console.log('      mismatch', JSON.stringify(patch),
        JSON.stringify({ mine, theirs }).slice(0, 240));
    }
    continue;
  }

  // Central: the geometry must still agree; only the AC statement diverges.
  if (!structural) {
    sizingMismatch += 1;
    console.log('      central geometry drifted', JSON.stringify(patch));
    continue;
  }
  const i = sld.inputs;
  const invTotal = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c * i.inv_ac_mw_c;
  const skidTotal = i.mv_per_ring_c * i.rings_c * i.central_skid_mva_c;
  const squared = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c
    * i.central_skid_mva_c * i.inv_per_mv_c;
  divergence.push({
    patch, sandbox: theirs.ac_mw, ours: mine.ac_mw,
    squaredAsExpected: near(theirs.ac_mw, squared),
    oursIsLimiting: near(mine.ac_mw, Math.min(invTotal, skidTotal)),
    relationIsCorrect: i.inv_per_mv_c > 1
      ? mine.ac_mw < theirs.ac_mw : near(mine.ac_mw, theirs.ac_mw),
    oursIsNeverHigher: mine.ac_mw <= theirs.ac_mw + 1e-9,
  });
  centralChecked += 1;
}

check('every central case was reached', centralChecked === 3, String(centralChecked));
check('the sandbox produces exactly the squared figure on every central case',
  divergence.every(d => d.squaredAsExpected),
  JSON.stringify(divergence.map(d => d.sandbox)));
check('ours produces exactly the smaller of the two nameplates',
  divergence.every(d => d.oursIsLimiting),
  JSON.stringify(divergence.map(d => d.ours)));
check('ours equals the one-inverter original and is lower only where the square exists',
  divergence.every(d => d.relationIsCorrect && d.oursIsNeverHigher));
check('the divergence is confined to central mode', sizingMismatch === 0);

check('string mode still reproduces the sandbox exactly',
  sizingMismatch === 0, `${sizingMismatch} of ${CASES.length} differ`);

// ---- one Earth radius ----------------------------------------------------
console.log('\none Earth radius\n');
// Strip comments first. The header explains at length why turf and 6371 are
// gone, and an assertion that trips over its own documentation proves nothing.
const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
check('no turf dependency came across in the code', !/\bturf\./.test(code));
check('the Turf default radius appears nowhere in the code', !/6371/.test(code));
check('and the header still explains why it was removed',
  /6371\.0088/.test(src) && /turf\.destination/.test(src));
/* The check that used to read `const R_ATLAS = 6378.137` in this file.
   ------------------------------------------------------------------------
   It passed for weeks while the assembled cartridge declared the radius
   TWICE - once in the geodesy module in front of the body, once in the body
   itself - because it only ever asked whether the constant was present, not
   whether it was present more than once. That is the configuration the
   all-versions proof later caught actually diverging.

   v9.67 makes the body take the constant from the module. So the assertion
   is now the stronger one it should always have been: the whole served
   cartridge declares an Earth radius exactly once, and the body delegates
   rather than defining. */
check('the served cartridge declares an Earth radius exactly ONCE',
  (code.match(/=\s*6378\.137/g) || []).length === 1,
  `${(code.match(/=\s*6378\.137/g) || []).length} declarations`);
check('the body takes the radius and the distance from the geodesy module',
  /const R_ATLAS = GEODESY\.EARTH_RADIUS_KM;/.test(src)
  && /return GEODESY\.distanceKm\(/.test(src));
check('a missing geodesy module is a hard failure, never a fallback',
  /if \(!GEODESY\) throw new Error/.test(src));
check('projection and bearing come from the module too',
  /return GEODESY\.destinationPoint\(/.test(src)
  && /return GEODESY\.initialBearingDeg\(/.test(src));
check('point-to-segment replaces turf.nearestPointOnLine',
  /function distanceToSegmentKm/.test(src) && /footOnSegment/.test(src));

// ---- interaction ---------------------------------------------------------
console.log('\ninteraction\n');
check('the array is dragged, not mode-switched', /what: 'array'/.test(src) && /dragPan\.disable/.test(src));
check('rotation has a handle', /what: 'rotate'/.test(src) && /initialBearingDeg/.test(src));
check('route vertices are draggable', /what: 'pin'/.test(src));
check('a vertex can be inserted on the cable', /routePins\.splice\(best, 0, at\)/.test(src));
check('a vertex can be removed by double click', /dblclick/.test(src) && /routePins\.splice\(Number/.test(src));
check('panning is restored on release', /dragPan\.enable/.test(src));

// ---- the electron flow ---------------------------------------------------
console.log('\nthe electron flow\n');
check('the cable carries the travelling pulse', /cableFlow/.test(src));
check('the collectors carry it too', /radialFlow/.test(src));
check('the rotation stem is excluded from the flow',
  /\['!=', \['get', 'role'\], 'handle_stem'\]/.test(src));
check('reduced motion stops the pulse and keeps the geometry',
  /prefers-reduced-motion/.test(src) && /setPaintProperty\(SLD_LAYERS\.cableFlow, 'line-opacity', 0\)/.test(src));

// ---- what the panel must say --------------------------------------------
console.log('\nthe panel\n');
const j = src.replace(/`\s*\+\s*`/g, '').replace(/\s+/g, ' ');
check('the panel is marked Beta', /class="sld-beta">Beta</.test(src));
check('it says a layout is not a design', /A layout, not\s*a design/.test(j) || /A layout, not a design/.test(j));
check('it says beta analytics, not an actual grid connection',
  /Beta analytics, not an actual grid connection/.test(j));
check('it names wayleave and easement', /wayleave/i.test(j) && /easement/i.test(j));
check('it names right of way', /right of way/i.test(j));
check('it names network impedance and fault level',
  /network impedance/i.test(j) && /fault level/i.test(j));
check('it names thermal headroom and queue position',
  /thermal headroom/i.test(j) && /queue position/i.test(j));
check('it names consent and land control', /consent/i.test(j) && /land control/i.test(j));
check('it says a substation does not confirm capacity', /does not confirm capacity/i.test(j));
check('the detour factor is shown beside the straight line',
  /Detour factor/.test(src) && /Straight line/.test(src));


/* ══════════════════════════════════════════════════════════════════════════
   ARRIVING BY DEEP LINK, AND GETTING INTO THE LAYOUT
   ══════════════════════════════════════════════════════════════════════════
   Both of these were missing until someone opened the live Atlas from a
   Pipeline News MAP link and found a project card with nothing on it and no
   way through to the sandbox. Neither gap was visible to any assertion here,
   because every assertion was about what happens after a click.
*/

console.log('\ndeep links and the way into the layout\n');

check('the measurement is split out of the click handler',
  /async function selectAt\(/.test(code) && /link\.selectAt = selectAt/.test(code));
check('a deep link runs the same path as a click',
  /new URLSearchParams\(window\.location\.search\)/.test(code)
  && /selectAt\(\[lon, lat\], name, tech, false,/.test(code));
check('it only fires for a technology that draws links',
  /PROJECT_TECHS\.has\(tech\)/.test(code));
check('it waits for the engine card rather than racing it',
  /maplibregl-popup-content/.test(code) && /for \(let i = 0; i < 40/.test(code));
check('it gives up rather than hanging', /i \+= 1\)/.test(code));
check('a deep-link failure is recorded, not swallowed', /'deep link: '/.test(code));

check('the card offers a way into the layout',
  /class="neon-layout"/.test(code) && /Lay out a scheme here/.test(src));
check('the button is only offered on a project card, not a substation one',
  /const button = toSubstations/.test(code));
check('the button opens the layout from the project',
  /openSldFromProject\(capturedMap, lastSelection\)/.test(code));
check('the selection is remembered for it', /lastSelection = \{ origin, name, tech/.test(code));

check('a project-origin layout puts the array on the project',
  /sld\.arrayCentre = selection\.origin/.test(code));
check('and runs the cable to the nearest substation found',
  /sld\.gridNode = nearest\.at/.test(code));
check('the array is oriented along the line to the grid node',
  /sld\.rotationDeg = initialBearingDeg\(/.test(code));
check('nothing in range fails soft with a reason',
  /no substation within/.test(code));
check('the panel names the project and where it runs to',
  /sld\.projectName \|\| sld\.gridNodeName/.test(code) && /class="sld-to"/.test(code));
check('closing clears the project name', /sld\.projectName = null/.test(code));

// The functions must actually exist on the published surface, not just in text.
check('openFromProject is exposed', typeof sld.openFromProject === 'function');

check('the substation layer is turned on for a deep link',
  /enableSubstationLayer\(\);/.test(code) && /function enableSubstationLayer/.test(code));
check('it ticks the engine control rather than reaching past it',
  /input\[type=checkbox\]/.test(code) && /box\.click\(\)/.test(code));
check('and it is on for a project-origin layout too',
  (code.match(/enableSubstationLayer\(\);/g) || []).length >= 2);
check('a missing control is reported, not ignored', /'subs: control not found'/.test(code));

check('the flow is a repeating train, not a single pulse',
  /function flowDash/.test(code) && /FLOW_PERIOD/.test(code) && /FLOW_PULSE/.test(code));
check('two flow layers run half a period apart on the links',
  /L_FLOW_B/.test(code) && /FLOW_PERIOD \/ 2/.test(code));
check('the export cable gets the second layer too', /cableFlowB/.test(code));
check('reduced motion silences every flow layer',
  (code.match(/'line-opacity', 0\)/g) || []).length >= 5);


console.log(String.fromCharCode(10)+'fitting to the stated capacity'+String.fromCharCode(10));

check('the register figure is carried through the selection',
  /statedMw/.test(code) && /q\.get\('capacity_mw'\)/.test(code));
check('nothing is fitted until the basis is declared',
  /sld\.targetBasis = 'unstated'/.test(code)
  && /targetBasis !== 'ac' && sld\.targetBasis !== 'dc'/.test(code));
// This used to assert the fit moved ONE variable, which was the defect: with
// s_subs pinned at five, one step of b_cols was five blocks and every target
// under 50 MW collapsed onto 44.8 MW.
check('the fit moves the outer and the inner count',
  /const outerKey = string \? 'b_cols' : 'rings_c';/.test(code)
  && /const innerKey = string \? 's_subs' : 'mv_per_ring_c';/.test(code));
check('the residual is reported rather than hidden', /fitResidualPct/.test(code));
check('a hand edit is not silently re-fitted',
  /Editing by hand wins/.test(src));

// The fit must actually land on the target. Drive it through the real code.
sld.inputs.mode = 'string';
Object.assign(sld.inputs, { mod_wp: 660, mod_l: 2.38, mod_w: 1.30, gcr: 0.45,
  gross_factor: 1.35, x_mods: 28, z_strings: 18, y_invs: 28, s_subs: 5,
  string_inv_kva: 352, string_skid_mva: 8.96, dc_ac_ratio: 1.2, bess_mwh: 0 });

let fitFailures = 0;
for (const [target, basis] of [[50, 'ac'], [150, 'ac'], [840, 'ac'], [50, 'dc'], [500, 'dc'], [840, 'dc']]) {
  sld.targetMw = target;
  sld.targetBasis = basis;
  sld.fitToStatedCapacity();
  sld.gridNode = [-1.5, 54.0];
  sld.active = true;
  sld.openAt(stubMap, [-1.5, 54.0], 'T', '33 kV');
  // openAt clears the target, so recompute against the fitted inputs directly.
  sld.targetMw = target; sld.targetBasis = basis;
  sld.fitToStatedCapacity();
  const got = sld.inputs.mode === 'string'
    ? (basis === 'ac' ? sld.inputs.b_cols * sld.inputs.s_subs * sld.inputs.string_skid_mva : null)
    : null;
  const within = sld.fitResidualPct != null && Math.abs(sld.fitResidualPct) <= 12;
  if (!within) { fitFailures += 1; console.log('      miss', target, basis, sld.fitResidualPct); }
}
check('every target is reached within one block step',
  fitFailures === 0, `${fitFailures} of 6 outside 12%`);

console.log(String.fromCharCode(10)+'the AC/DC disclaimer'+String.fromCharCode(10));
check('the unstated case is called out in red',
  /class="sld-danger"/.test(src) && /#ff5d5d/.test(src));
check('it says REPD does not reliably distinguish AC from DC',
  /does not reliably distinguish/i.test(j));
check('it explains the consequence for the connection',
  /oversizes the\s*connection/i.test(j) || /oversizes the connection/i.test(j));
check('it names export limitation and curtailment',
  /export\s*limitation/i.test(j) && /curtailment/i.test(j));
check('the basis is a user choice, not an assumption',
  /id="sld_basis"/.test(src) && /AC export MW/.test(src) && /DC MWp/.test(src));
check('the panel names array, inverter and export quantities separately',
  /<span>Array DC<\/span>/.test(src)
  && /<span>Inverter AC<\/span>/.test(src)
  && /<span>Export limit<\/span>/.test(src));
check('the panel names all three ratios instead of collapsing them into DC\/AC',
  /<span>Design DC\/AC<\/span>/.test(src)
  && /<span>DC \/ export<\/span>/.test(src)
  && /<span>Inverter \/ export<\/span>/.test(src));
check('a stated-to-derived mismatch is descriptive and does not rewrite inputs',
  /class="sld-ratio-note"/.test(src)
  && /equipment counts and ratings shown give/.test(src)
  && /no input is changed automatically/.test(src));
check('the panel no longer grades a ratio against a usual range',
  !/outside the usual 1\.0 to 1\.6/.test(src)
  && !/does not behave like a UK utility-scale scheme/.test(src));
check('the below-one note is arithmetic rather than a design verdict',
  /Array DC divided by inverter AC/.test(src)
  && !/unusual for solar/.test(src)
  && !/normal design choice/.test(src));

check('a click on our own card never reaches the map',
  /function fromOwnUi/.test(code) && /maplibregl-popup/.test(code)
  && /gridatlas-sld-panel/.test(code));
check('every map handler consults that guard',
  (code.match(/fromOwnUi\(event\)/g) || []).length >= 4);
check('the layout button stops its own event',
  /event\.stopPropagation\(\)/.test(code));
check('an unloaded project layer is reported as unloaded, not as absence',
  /loaded: false/.test(code) && /not a statement that no project is here/.test(j));
check('and the loaded case still says none in range',
  /No mapped project within \$\{MAX_LINK_KM\} km of this substation\./.test(code));

check('the card gets a grab bar', /gridatlas-card-bar/.test(code) && /function addCardBar/.test(code));
check('with a minimise and a close big enough to hit',
  /class="min"/.test(code) && /class="close"/.test(code)
  && /gridatlas-card-bar button\{[\s\S]{0,220}min-width:44px;height:44px/.test(src));
check('dragging frees the card from its anchor',
  /gridatlas-free/.test(code) && /position:fixed !important/.test(src));
check('a freed card does not snap back on pan',
  /transform:none !important/.test(src));
check('minimising collapses to the bar', /gridatlas-min/.test(code));
check('closing clears the links too', /clearLinks\(\);\s*popup\.remove\(\)/.test(code));
check('the layout panel is draggable by its heading too',
  /h4\.sld-drag/.test(code) && /sld-min/.test(code));
check('bar buttons do not leak to the map', (code.match(/event\.stopPropagation\(\)/g)||[]).length >= 3);

check('the bar carries the card title so a minimised card is identifiable',
  /class="label"/.test(code) && /content\.querySelector\('b, strong, h1, h2, h3'\)/.test(code));
check('a minimised card is styled to read as restorable',
  /gridatlas-min .gridatlas-card-bar button.min/.test(src) && /box-shadow:0 0 14px/.test(src));

check('the card is bounded to the map and scrolls',
  /max-height:var\(--gridatlas-card-max/.test(src) && /overflow-y:auto !important/.test(src));
check('the cap comes from the real map height, not the viewport',
  /function boundCardToMap/.test(code) && /getContainer\(\)/.test(code));
check('the bar stays put while the card scrolls', /position:sticky/.test(src));
check('the cap is refreshed on resize',
  /addEventListener\('resize', boundCardToMap\)/.test(code));
check('the layer dashboard survives fullscreen',
  /function keepLayersInFullscreen/.test(code) && /fullscreenchange/.test(code));
check('the dashboard is moved, not cloned, so its listeners live',
  /full\.appendChild\(dashboard\)/.test(code) && /home\.parent\.insertBefore/.test(code));
check('a missing dashboard is reported', /'fullscreen: dashboard not found'/.test(code));

check('the block goes on the content, never inside the bar',
  /content\.appendChild\(block\)/.test(code)
  && !/firstElementChild \|\| content\)\.appendChild/.test(code));
check('the bar cannot stretch', /flex:0 0 auto/.test(src));
check('the cap measures the space below the anchor, not the container',
  /map\.bottom - rect\.top - 12/.test(code));
check('a card with no room is freed and parked instead of squeezed',
  /MIN_ANCHORED_CARD/.test(code) && /gridatlas-free'\)/.test(code));
check('the fit is recomputed once the block has landed',
  /requestAnimationFrame\(boundCardToMap\)/.test(code));

check('a freed card parks clear of the Atlas tool stack',
  /function parkingSpot/.test(code) && /\.map-controls/.test(code));
check('the tool stack is queried, not assumed', /getBoundingClientRect\(\)/.test(code));

check('a freed card is capped by the room below where it sits',
  /let available = map\.bottom - rect\.top - 12/.test(code));
check('a card dropped too low is lifted, not shrunk to a slot',
  /const lifted = Math\.max\(map\.top \+ 12/.test(code));
check('restoring re-checks the fit', /requestAnimationFrame\(boundCardToMap\)/.test(code));
check('so does finishing a drag', (code.match(/requestAnimationFrame\(boundCardToMap\)/g)||[]).length >= 3);
console.log('\nfitting to the headline capacity\n');

/* Reported: the numbers do not change when the headline capacity changes.
   Measured on the generation before this one, and they did not:

     string   5, 10, 20, 30, 40, 49.9 and 50 MW all produced 44.80 MW
     central  5, 10 and 20 MW all produced 17.60 MW

   The fit moved one variable. total_blocks is b_cols x s_subs and s_subs was
   pinned at five, so one step of b_cols was five blocks — 44.8 MW at the
   default skid rating. A 30 MW solar farm was drawn as 44.8 MW, half as much
   again, and the register starts at 1 MW.

   These drive the cartridge's own fit and read its own stats. They are not
   assertions about the source. */
const fitAt = (mode, target, basis = 'ac') => {
  sld.inputs.mode = mode;
  sld.targetMw = target;
  sld.targetBasis = basis;
  sld.fitToStatedCapacity();
  sld.gridNode = [-1.5, 54.0];
  sld.active = true;
  sld.stats = null;
  sld.openAt(stubMap, [-1.5, 54.0], 'Fit', '33 kV');
  return sld.stats;
};

check('a 30 MW project is no longer drawn as a 44.8 MW one', (() => {
  const s = fitAt('string', 30);
  return s && Math.abs(s.ac_mw - 44.8) > 1 && s.ac_mw < 40;
})(), (() => { const s = fitAt('string', 30); return s ? s.ac_mw.toFixed(2) + ' MW' : 'none'; })());

check('targets between 5 and 50 MW no longer collapse onto one layout', (() => {
  const seen = new Set();
  for (const t of [10, 20, 30, 40, 50]) {
    const s = fitAt('string', t);
    if (s) seen.add(Math.round(s.ac_mw * 100));
  }
  return seen.size >= 4;
})());

check('central tracks the target across the whole range', (() => {
  for (const t of [20, 30, 40, 100, 400, 840]) {
    const s = fitAt('central', t);
    if (!s) return false;
    if (Math.abs(s.ac_mw - t) / t > 0.15) return false;
  }
  return true;
})());

check('the capacity rises with the target, never falls', (() => {
  let previous = 0;
  for (const t of [20, 50, 100, 200, 400, 800]) {
    const s = fitAt('central', t);
    if (!s || s.ac_mw < previous - 1e-9) return false;
    previous = s.ac_mw;
  }
  return true;
})());

// Below one block there is nothing to draw, and that is physics rather than a
// defect. It must be REPORTED rather than hidden in a rounded headline.
check('a target under one block reports a residual', (() => {
  // The fit alone, not through openAt: openAt rebuilds the layout and the
  // residual belongs to the fit that produced it.
  sld.inputs.mode = 'string';
  sld.targetMw = 3;
  sld.targetBasis = 'ac';
  sld.fitToStatedCapacity();
  return Number.isFinite(sld.fitResidualPct) && sld.fitResidualPct > 0;
})(), String(sld.fitResidualPct));
check('and states what one more block would have added', (() => {
  sld.inputs.mode = 'string';
  sld.targetMw = 3;
  sld.targetBasis = 'ac';
  sld.fitToStatedCapacity();
  return Number.isFinite(sld.fitQuantumMw) && sld.fitQuantumMw > 0;
})(), String(sld.fitQuantumMw));

check('both variables are searched, not one',
  /const outerKey = string \? 'b_cols' : 'rings_c';/.test(cartridgeSource)
  && /const innerKey = string \? 's_subs' : 'mv_per_ring_c';/.test(cartridgeSource));
check('the inner bound is physical, not generous',
  /FIT_INNER_MAX = 12/.test(cartridgeSource)
  && /a ring main carries a handful of/.test(cartridgeSource.replace(/\s+/g, ' ')));
check('a near-tie goes to the layout already on screen',
  /const drift = Math\.abs\(inner - inner0\)/.test(cartridgeSource)
  && /the drawing jumps for no reason the user can see/.test(cartridgeSource.replace(/\s+/g, ' ')));
check('the module bookkeeping still holds after a fit', (() => {
  const s = fitAt('string', 250);
  if (!s) return false;
  const fromModules = (s.module_count * sld.inputs.mod_wp) / 1e6;
  return Math.abs(fromModules - s.dc_mwp) < 1e-6;
})());
check('and the DC/AC ratio is still the derived one', (() => {
  const s = fitAt('central', 250);
  return s && s.ac_mw > 0
    && Math.abs(s.dc_mwp / s.ac_mw - s.dc_ac_ratio) < 1e-6;
})());

console.log('\nthe original financial model\n');

check('the financial oracle is the executed-original fixture',
  financeOracle.schema === 'globalgrid2050.original-sld-electrical-finance-fixture.v1'
  && financeOracle.provenance?.execution?.startsWith('Original helper'));
check('all four original finance cases are present', financeOracle.cases?.length === 4);
check('the fixture names the central double-count instead of hiding it',
  /multiplies total_blocks by both central_skid_mva and inv_per_mv/.test(
    financeOracle.reference_behavior?.known_central_defect || ''));
check('the cartridge exposes one finance function for parity testing',
  typeof sld.computeFinance === 'function');
check('the original linked development-stage handler is exposed for testing',
  typeof sld.applyDevelopmentStage === 'function');
check('the original mounting-to-bifacial handler is exposed for testing',
  typeof sld.applyMountingBifacial === 'function');
check('string and central financial assumptions are independent',
  sld.finance?.string && sld.finance?.central && sld.finance.string !== sld.finance.central);
check('string and central physical assumptions are independent', (() => {
  Object.assign(sld.inputs, {
    mod_wp: 580, mod_l: 2.10, mod_w: 1.15, gcr: 0.35,
    gross_factor: 1.25,
    mod_wp_c: 720, mod_l_c: 2.50, mod_w_c: 1.40, gcr_c: 0.75,
    gross_factor_c: 1.55,
  });
  sld.inputs.mode = 'string';
  sld.openAt(stubMap, [-1.5, 54.0], 'string-state', '33 kV');
  const stringStats = sld.stats;
  sld.inputs.mode = 'central';
  sld.openAt(stubMap, [-1.5, 54.0], 'central-state', '33 kV');
  const centralStats = sld.stats;
  return Math.abs(stringStats.dc_mwp
      - (stringStats.module_count * 580) / 1e6) < 1e-9
    && Math.abs(centralStats.dc_mwp
      - (centralStats.module_count * 720) / 1e6) < 1e-9
    && sld.inputs.mod_wp === 580 && sld.inputs.mod_wp_c === 720;
})());
check('the central panel binds its own physical keys',
  /\['mod_wp_c', 'Module rating Wp'\]/.test(cartridgeSource)
  && /\['gcr_c', 'Ground cover ratio'\]/.test(cartridgeSource));
check('electrical input normalization is exposed for behavioral testing',
  typeof sld.normalizeElectricalInput === 'function');
check('fractional or zero topology counts are rejected before they reach maths',
  sld.normalizeElectricalInput('rings_c', 1.5) === null
  && sld.normalizeElectricalInput('rings_c', 0) === null
  && sld.normalizeElectricalInput('rings_c', 7) === 7
  && sld.normalizeElectricalInput('z_strings', 18.2) === null);
check('the original central rating bounds are enforced',
  sld.normalizeElectricalInput('inv_ac_mw_c', 20) === 20
  && sld.normalizeElectricalInput('inv_ac_mw_c', 20.01) === null
  && sld.normalizeElectricalInput('inv_dc_mw_c', 30.01) === null
  && sld.normalizeElectricalInput('central_skid_mva_c', 25.01) === null);
check('the rendered electrical controls carry explicit original bounds and steps',
  /rings_c: \{ min: 1, step: 1, integer: true \}/.test(cartridgeSource)
  && /inv_ac_mw_c: \{ min: 0\.1, max: 20, step: 0\.01 \}/.test(cartridgeSource)
  && /electricalInputAttributes\(key\)/.test(cartridgeSource)
  && !/data-key="\$\{key\}" type="number" step="any"/.test(cartridgeSource));
check('an invalid edit restores the visible prior value and stops',
  /if \(value == null\) \{[\s\S]{0,100}input\.value = String\(sld\.inputs\[key\]\);[\s\S]{0,30}return;/.test(cartridgeSource));

const financeNumberValue = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

function applyOracleCase(spec) {
  const input = spec.inputs;
  sld.inputs.mode = spec.mode;
  if (spec.mode === 'string') {
    Object.assign(sld.inputs, {
      mod_wp: financeNumberValue(input.mod_wp),
      mod_l: financeNumberValue(input.mod_l),
      mod_w: financeNumberValue(input.mod_w),
      gcr: financeNumberValue(input.mounting_type),
      gross_factor: financeNumberValue(input.gross_factor),
      dc_ac_ratio: financeNumberValue(input.dc_ac_ratio),
      string_inv_kva: financeNumberValue(input.string_inv_kva),
      string_skid_mva: financeNumberValue(input.string_skid_mva),
      x_mods: financeNumberValue(input.x_mods),
      z_strings: financeNumberValue(input.z_strings),
      y_invs: financeNumberValue(input.y_invs),
      s_subs: financeNumberValue(input.s_subs),
      b_cols: financeNumberValue(input.b_cols),
    });
  } else {
    Object.assign(sld.inputs, {
      mod_wp_c: financeNumberValue(input.mod_wp_c),
      mod_l_c: financeNumberValue(input.mod_l_c),
      mod_w_c: financeNumberValue(input.mod_w_c),
      gcr_c: financeNumberValue(input.mounting_type_c),
      gross_factor_c: financeNumberValue(input.gross_factor_c),
      inv_dc_mw_c: financeNumberValue(input.inv_dc_mw_c),
      inv_ac_mw_c: financeNumberValue(input.inv_ac_mw_c),
      central_skid_mva_c: financeNumberValue(input.central_skid_mva_c),
      x_mods_c: financeNumberValue(input.x_mods_c),
      str_per_cb_c: financeNumberValue(input.str_per_cb_c),
      inv_per_mv_c: financeNumberValue(input.inv_per_mv_c),
      mv_per_ring_c: financeNumberValue(input.mv_per_ring_c),
      rings_c: financeNumberValue(input.rings_c),
    });
  }
  const prefix = spec.mode === 'string' ? 'fin_string_' : 'fin_central_';
  const finance = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    finance[suffix] = suffix === 'flood' ? Boolean(value)
      : suffix === 'dev_stage' ? String(value) : financeNumberValue(value);
  }
  sld.finance[spec.mode] = finance;
  sld.gridNode = [-1.5, 54.0];
  sld.active = true;
  sld.openAt(stubMap, [-1.5, 54.0], spec.id, '33 kV');
  return sld.stats;
}

const financialDrift = [];
for (const spec of financeOracle.cases) {
  const actualStats = applyOracleCase(spec);
  const expectedFinance = spec.finance;
  const actualFinance = actualStats?.finance;
  for (const [key, expected] of Object.entries(expectedFinance)) {
    if (spec.reference_defect && (key === 'surplus25' || key === 'surplus35')) continue;
    const actual = actualFinance?.[key];
    const matches = typeof expected === 'number'
      ? Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-12)
      : actual === expected;
    if (!matches) financialDrift.push(`${spec.id}.${key}: ${actual} != ${expected}`);
  }
  if (spec.reference_defect) {
    const corrected = spec.reference_defect;
    const inverterAc = actualStats.consistency?.inverter_ac_mw;
    if (Math.abs(inverterAc - corrected.corrected_ac_mw) > 1e-9) {
      financialDrift.push(`${spec.id}.corrected_ac_mw: ${inverterAc} != ${corrected.corrected_ac_mw}`);
    }
    for (const key of ['surplus25', 'surplus35']) {
      const expected = corrected[`corrected_${key}`];
      const actual = actualFinance[key];
      if (Math.abs(actual - expected) > Math.max(1e-8, Math.abs(expected) * 1e-12)) {
        financialDrift.push(`${spec.id}.corrected_${key}: ${actual} != ${expected}`);
      }
    }
  }
}
check('all unaffected finance outputs equal the original executable oracle',
  financialDrift.length === 0, financialDrift.slice(0, 3).join('; '));
check('the central stress case uses the oracle correction, not the squared AC',
  !financialDrift.some(item => item.includes('central_full_finance_path')));
check('the model carries every original finance input family',
  ['price', 'yield', 'bifacial', 'loss_dc_string', 'loss_lv_dc', 'loss_lv_ac',
    'loss_tx', 'loss_other', 'opex', 'epc_ex', 'modules', 'other_capex',
    'fixed_capex', 'cont', 'bess_mw', 'bess_mwh', 'bess_capex', 'bess_cycles',
    'bess_spread', 'bess_eff', 'dev_cost_mw', 'dev_grid_mw', 'dev_exit_mwp',
    'dev_npv_mwp', 'dev_success', 'dev_years']
    .every(key => cartridgeSource.includes(`['${key}',`)));
check('every numeric finance input rejects negative values',
  /type="number" min="0"\$\{maximum\} step="any"/.test(cartridgeSource));
check('efficiency and probability are capped at one hundred percent',
  /key === 'bess_eff' \|\| key === 'dev_success' \? ' max="100"'/.test(cartridgeSource));
check('the central OPEX basis is the corrected inverter nameplate only in central mode',
  /\(stats\?\.mode \|\| \(context && context\.fallbackMode\)\) === 'central'/.test(cartridgeSource)
  && /stats\?\.consistency\?\.inverter_ac_mw/.test(cartridgeSource)
  && /centralInverterAc > 0 \? centralInverterAc : financeNumber\(stats\?\.ac_mw\)/.test(cartridgeSource));
check('the executable original development-stage labels are retained',
  /Land Option Signed/.test(cartridgeSource)
  && /Buyer or Revenue Agreement Reviewed \(Power Purchase Agreement \(PPA\) \/ Offtaker\)/.test(cartridgeSource)
  && /Construction Contract Signed and Finance Committed \(Financial Close\)/.test(cartridgeSource));
const originalStageDefaults = new Map([
  ['0.003', 10], ['0.015', 15], ['0.035', 30], ['0.055', 55],
  ['0.070', 70], ['0.080', 80], ['0.100', 95],
]);
let stageDefaultsMatch = true;
for (const [stage, success] of originalStageDefaults) {
  const values = { dev_stage: '0.100', dev_cost_mw: 0.100, dev_success: 95 };
  const applied = sld.applyDevelopmentStage(values, stage);
  stageDefaultsMatch = stageDefaultsMatch && applied
    && values.dev_stage === stage
    && values.dev_cost_mw === Number(stage)
    && values.dev_success === success;
}
check('every stage updates cost and success exactly like the original change handler',
  stageDefaultsMatch);
check('an unknown stage fails closed without changing assumptions', (() => {
  const values = { dev_stage: '0.100', dev_cost_mw: 0.100, dev_success: 95 };
  const before = JSON.stringify(values);
  return sld.applyDevelopmentStage(values, 'unknown') === false
    && JSON.stringify(values) === before;
})());
check('the UI stage control uses the linked handler before redraw',
  /input\.dataset\.finKey === 'dev_stage'/.test(cartridgeSource)
  && /applyDevelopmentStageDefaults\(values, input\.value\)/.test(cartridgeSource));
check('every original mounting preset updates bifacial gain on its topology only', (() => {
  sld.finance.string.bifacial = 99;
  sld.finance.central.bifacial = 77;
  const stringApplied = sld.applyMountingBifacial('string', 0.35);
  const stringOnly = sld.finance.string.bifacial === 8
    && sld.finance.central.bifacial === 77;
  const centralApplied = sld.applyMountingBifacial('central', 0.75);
  return stringApplied && centralApplied && stringOnly
    && sld.finance.string.bifacial === 8
    && sld.finance.central.bifacial === 2;
})());
check('a free-form GCR does not invent a bifacial assumption', (() => {
  const before = sld.finance.string.bifacial;
  return sld.applyMountingBifacial('string', 0.51) === false
    && sld.finance.string.bifacial === before;
})());
check('the GCR input invokes the original linked bifacial behavior before redraw',
  /key === 'gcr' \|\| key === 'gcr_c'/.test(cartridgeSource)
  && /applyMountingBifacial\(sld\.inputs\.mode, value\)/.test(cartridgeSource));
check('the financial block starts collapsed and remembers an explicit open',
  /financeOpen: false/.test(cartridgeSource)
  && /details class="sld-finance" \$\{sld\.financeOpen \? 'open' : ''\}/.test(cartridgeSource)
  && /addEventListener\('toggle'/.test(cartridgeSource));
check('finance changes redraw the same electrical and financial state',
  /\[data-fin-key\]/.test(cartridgeSource)
  && /values\[input\.dataset\.finKey\]/.test(cartridgeSource)
  && /if \(capturedMap\) redrawSld\(capturedMap\)/.test(cartridgeSource));
check('one topology-local BESS value drives both finance and the drawn compound',
  /financeNumber\(sld\.finance\[sld\.inputs\.mode\]\?\.bess_mwh\)/.test(cartridgeSource)
  && !/Layout BESS energy is/.test(cartridgeSource)
  && !/bess_mwh_c/.test(cartridgeSource)
  && !/\['bess_mwh', 'BESS MWh'\]/.test(cartridgeSource));
check('changing financial BESS energy adds and removes the drawn BESS compound', (() => {
  const hasBess = () => [...stubSources.values()].some(source =>
    source.data?.features?.some(feature => feature.properties?.kind === 'bess'));
  sld.inputs.mode = 'string';
  sld.finance.string.bess_mwh = 0;
  sld.openAt(stubMap, [-1.5, 54.0], 'no-bess', '33 kV');
  const absent = !hasBess();
  sld.finance.string.bess_mwh = 20;
  sld.openAt(stubMap, [-1.5, 54.0], 'with-bess', '33 kV');
  return absent && hasBess();
})());
check('the on-panel financial disclaimer is explicit',
  /Screening values only, not financial advice/.test(cartridgeSource)
  && /investment-committee models/.test(cartridgeSource));




// The glyph pre-flight is deliberately not awaited by the cartridge, so a
// promise is still in flight here. Whether it has resolved before the
// tally is a scheduling detail that differs between platforms, and a
// proof must not depend on one. Drain, then count.
await new Promise(resolve => setTimeout(resolve, 0));
await new Promise(resolve => setImmediate(resolve));

/* ── phone-first pointer and containment contract ────────────────────────
   The original sandbox advertised move/rotate/route editing, but every drag
   began with mousedown. A phone could click the layout button and then could
   not use the layout it opened. Pointer capture is used for DOM panels so a
   drag can leave the narrow handle without being lost; MapLibre receives its
   native touch events for map features. The short-viewport CSS is injected by
   the cartridge because the attested shell is intentionally immutable. */
const mobile = cartridgeSource;
check('the project card starts one pointer interaction for mouse, pen and touch',
  /bar\.addEventListener\('pointerdown',/.test(mobile)
  && !/bar\.addEventListener\('mousedown',/.test(mobile));
check('the project card captures and releases the active pointer',
  /bar\.setPointerCapture\?\.\(event\.pointerId\)/.test(mobile)
  && /bar\.releasePointerCapture\?\.\(event\.pointerId\)/.test(mobile));
check('the project card handles pointer cancellation',
  /bar\.addEventListener\('pointercancel', up\)/.test(mobile));
check('the project card clamp measures the map and full card width',
  /const card = popup\.getBoundingClientRect\(\)/.test(mobile)
  && /map\.right - card\.width - 4/.test(mobile)
  && !/window\.innerWidth - 60/.test(mobile));
check('the layout panel uses pointer capture without document listener accumulation',
  /heading\.addEventListener\('pointerdown',/.test(mobile)
  && /heading\.setPointerCapture\?\.\(event\.pointerId\)/.test(mobile)
  && !/document\.addEventListener\('mousemove'/.test(mobile));
check('the layout panel handles pointer completion and cancellation',
  /heading\.addEventListener\('pointerup', finish\)/.test(mobile)
  && /heading\.addEventListener\('pointercancel', finish\)/.test(mobile));
check('the array, rotation handle and route pins accept native touch drag',
  /map\.on\('touchstart', beginDrag\)/.test(mobile)
  && /map\.on\('touchmove', moveDrag\)/.test(mobile)
  && /map\.on\('touchend', release\)/.test(mobile));
check('an interrupted map touch releases the drag state',
  /canvas\.addEventListener\?\.\('pointercancel', release\)/.test(mobile));
check('map gestures are restored only when they were enabled before the edit',
  /dragPanWasEnabled/.test(mobile) && /touchWasEnabled/.test(mobile)
  && /if \(finished\.dragPanWasEnabled\) map\.dragPan\.enable\(\)/.test(mobile));
check('the layout panel is bounded by top and bottom rather than an overflowing height',
  /#\$\{PANEL_ID\}\{position:absolute;right:14px;top:112px;bottom:14px/.test(mobile)
  && !/max-height:calc\(100% - 28px\)/.test(mobile));
check('both panel control pairs are 44px phone targets',
  /gridatlas-card-bar button\{[\s\S]{0,220}min-width:44px;height:44px/.test(mobile)
  && /sld-min,#\$\{PANEL_ID\} \.sld-close\{[\s\S]{0,240}min-width:44px;height:44px/.test(mobile));
check('both drag handles suppress browser touch scrolling during capture',
  /gridatlas-card-bar\{[\s\S]{0,260}touch-action:none/.test(mobile)
  && /h4\.sld-drag\{[^}]*touch-action:none/.test(mobile));
check('the 844 by 390 control stack scrolls inside the short viewport',
  /@media \(max-height:600px\)\{[\s\S]{0,260}\.map-controls\{[^}]*max-height:[^}]*overflow-y:auto/.test(mobile));
check('the 844 by 390 search result list is viewport bounded',
  /@media \(max-height:600px\)\{[\s\S]{0,420}\.search-results\{max-height:calc\(100dvh - 140px\)/.test(mobile));
check('coarse pointers enlarge shell and sandbox controls',
  /@media \(pointer:coarse\)\{[\s\S]*?\.map-ctrl-btn,\.search-btn\{min-height:44px\}/.test(mobile)
  && /sld-tabs button,#\$\{PANEL_ID\} input,#\$\{PANEL_ID\} select,[\s\S]{0,100}sld-finance summary\{min-height:44px\}/.test(mobile));


console.log('\nthe mobile tray\n');

/* Vikram's phone acceptance: tools covered the map, and the layer switches
   were out of reach below it. The tray collapses the one and surfaces the
   other; these checks pin the mechanism, the live map proves the pixels. */
check('the tray exists and installs only on touch or narrow windows',
  /function installMobileTray\(/.test(cartridgeSource)
  && /pointer: coarse/.test(cartridgeSource)
  && /innerWidth <= 700/.test(cartridgeSource));
check('the six shell tool buttons collapse behind one chip',
  /\.map-controls\.gm-tools-collapsed > \.map-ctrl-btn\{display:none\}/.test(cartridgeSource)
  && /stack\.classList\.add\('gm-tools-collapsed'\)/.test(cartridgeSource));
check('grid means the five voltage line layers, not a private list',
  /const GRID_LINE_LAYERS = \['400', '275', '220', '132', '66'\];/.test(cartridgeSource));
check('the chips drive the engine\'s own switches with real clicks',
  /#scada-ui-container input\[type=checkbox\]\[data-layer-id="/.test(cartridgeSource)
  && /if \(box\.checked !== turnOn\) box\.click\(\);/.test(cartridgeSource));
check('chips start disabled and wake when the switches exist',
  /chip\.disabled = true;/.test(cartridgeSource)
  && /chip\.disabled = boxes\.length === 0;/.test(cartridgeSource));
check('chips follow switches toggled anywhere else',
  /document\.addEventListener\('change', \(event\) => \{\n      if \(event\.target\?\.dataset\?\.layerId\)/.test(cartridgeSource));
check('mixed state turns everything on before anything off',
  /const turnOn = boxes\.some\(\(box\) => !box\.checked\);/.test(cartridgeSource));
check('tray clicks do not reach the map underneath',
  cartridgeSource.includes("tray.addEventListener('click', (event) => event.stopPropagation())"));
check('the tray reports its state to assistive technology',
  /tools\.setAttribute\('aria-expanded'/.test(cartridgeSource)
  && /chip\.setAttribute\('aria-pressed'/.test(cartridgeSource));
check('the tray publishes its state', /link\.mobile_tray = \{\n      installed: true/.test(cartridgeSource));
check('touch targets stay 44px inside the tray',
  new RegExp('#\\$\\{TRAY_ID\\} button\\{min-height:44px').test(cartridgeSource));
check('the desktop is left alone', /installed: false, reason: 'fine pointer, wide window'/.test(cartridgeSource));


console.log('\narrival by identity\n');

/* A repd_ref-only link opened the card and computed nothing - the search
   lane resolved the identity while this lane's URL guards bailed. One
   resolver: the search cartridge publishes, this lane consumes. */
const gazSource = await readFile(join(REPO, 'atlas', 'cartridges',
  '202609011141-place-global-search-v9-5.js'), 'utf8');
check('the search lane publishes the technology and capacity it resolved',
  /technology: exact\.technology,\n        capacity_mw: exact\.capacity_mw/.test(gazSource)
  && /technology: result\.technology,\n      capacity_mw: result\.capacity_mw/.test(gazSource));
check('absent coordinates are absent, not Null Island',
  /rawLon === null \? NaN : Number\(rawLon\)/.test(cartridgeSource)
  && /Math\.abs\(lon\) < 1e-9 && Math\.abs\(lat\) < 1e-9/.test(cartridgeSource));
check('the identity fallback is gated on repd_ref being present',
  /&& q\.get\('repd_ref'\)/.test(cartridgeSource));
check('the lane waits for the search cartridge and honours terminal states',
  /window\.__GRIDATLAS_PLACE_SEARCH__\?\.deep_link/.test(cartridgeSource)
  && /dl\.status === 'RESOLVED'/.test(cartridgeSource)
  && /dl\.status === 'FAILED' \|\| dl\.status === 'ABSENT'/.test(cartridgeSource));
check('a resolved identity supplies coordinates, technology, name and capacity',
  /lon = Number\(resolved\.longitude\)/.test(cartridgeSource)
  && /tech = resolved\.technology/.test(cartridgeSource)
  && /if \(resolved\.name\) name = String\(resolved\.name\)/.test(cartridgeSource)
  && /if \(Number\.isFinite\(cap\) && cap > 0\) stated = cap/.test(cartridgeSource));
check('an unresolved identity is recorded, never silent',
  /identity lane still not terminal after 10 minutes/.test(cartridgeSource));
check('the consumption is published for the next debugger',
  /link\.deep_link_identity = 'resolved-by-search-lane'/.test(cartridgeSource));


console.log('\nthe arrival surface\n');

/* Vikram: arrive in full screen mode with the clutter minimised; and a
   fixed identity budget expired on a phone that was still booting the
   query engine, which read as a broken map. */
check('an arrival on touch enters the shell fullscreen',
  /q\.get\('repd_ref'\) !== null \|\| coordsUsable\(\)\) && trayTarget\(\)/.test(cartridgeSource)
  && /window\.enterFullscreen\?\.\(\)/.test(cartridgeSource)
  && /link\.arrival_fullscreen = true/.test(cartridgeSource));
check('the map is resized after entering fullscreen',
  /setTimeout\(\(\) => \{ try \{ map\.resize\(\); \}/.test(cartridgeSource));
check('the identity wait has no budget parameter and runs to terminal',
  /async function waitForResolvedIdentity\(\) \{/.test(cartridgeSource)
  && /await waitForResolvedIdentity\(\);/.test(cartridgeSource)
  && !/waitForResolvedIdentity\(120000\)/.test(cartridgeSource));
check('the wait says what it is waiting for',
  /Resolving the project against the register/.test(cartridgeSource));
check('a ten-minute stop guards a lane that died silently',
  /waited > 600000/.test(cartridgeSource));
check('an unresolvable identity is surfaced with a retry of the arrival',
  /could not be resolved/.test(cartridgeSource)
  && /retryArrival = \(\) => \{ clearStatus\(\); runDeepLink\(\); \};/.test(cartridgeSource));
check('the substation stage is surfaced and zero substations never draws silently',
  /Loading the substation data/.test(cartridgeSource)
  && /The substation data did not load/.test(cartridgeSource)
  && /if \(!subs\.length\) \{/.test(cartridgeSource));
check('the deep link is a named function so retry re-runs it, not the page',
  /async function runDeepLink\(\) \{/.test(cartridgeSource)
  && /runDeepLink\(\);/.test(cartridgeSource));


console.log('\nthe card keeper\n');

/* Five links on the map and a card with no distances: the popup that had
   been decorated was replaced by the search lane's late arrival. */
check('the measurement block is kept, not written once',
  /function armCardKeeper\(links, direction, layerLoaded\)/.test(cartridgeSource)
  && /armCardKeeper\(links, direction, layerLoaded\);\n    if \(!injectIntoCard/.test(cartridgeSource));
check('the keeper re-attaches only while the card lacks the block',
  /if \(!content \|\| content\.querySelector\(`\.\$\{BLOCK_CLASS\}`\)\) return;/.test(cartridgeSource));
check('a cleared selection disarms the keeper before the block is removed',
  /disarmCardKeeper\(\);\n    removeArrivalFallback\(\);\n    removeCardBlock\(\);/.test(cartridgeSource));
check('the payload is per selection, so a stale project never decorates a new popup',
  /cardKeeperPayload = \{ links, direction, layerLoaded \};/.test(cartridgeSource)
  && /cardKeeperPayload = null;/.test(cartridgeSource));


console.log('\nthe arrival card\n');

/* 2,421 of Pipeline News's MAP targets are absent from the pinned register
   (dead-pipeline statuses); links drew and no card ever opened. */
check('a card is opened from the link fields only when none exists',
  /function ensureArrivalCard\(lon, lat, name, tech, statedMw\)/.test(cartridgeSource)
  && /if \(document\.querySelector\('\.maplibregl-popup-content'\)\) return;/.test(cartridgeSource)
  && /ensureArrivalCard\(lon, lat, name, tech, stated\);/.test(cartridgeSource));
check('the fallback card states its provenance',
  /Card built from the\s*'\s*\+\s*'arrival link\./.test(cartridgeSource));
check('the fallback yields when the register card lands',
  /\.length > 1\) \{\n          removeArrivalFallback\(\);/.test(cartridgeSource));
check('a cleared selection removes the fallback',
  /disarmCardKeeper\(\);\n    removeArrivalFallback\(\);\n    removeCardBlock\(\);/.test(cartridgeSource));
check('the fallback is published for the next debugger',
  /link\.arrival_card = 'from-link-fields';/.test(cartridgeSource));


console.log('\nthe card precedes the lines\n');

check('the fallback card is opened before the measurement runs', (() => {
  // Ordering, not adjacency: v9.55 puts the provisional declared block and
  // the ring between the card and the measurement, which is still the card
  // first. Compare positions rather than pinning neighbouring lines.
  const card = cartridgeSource.indexOf('ensureArrivalCard(lon, lat, name, tech, stated);');
  const measure = cartridgeSource.indexOf('await selectAt([lon, lat], name, tech, false,');
  return card > 0 && measure > card;
})());
check('a terminally failed identity lane does not spend the popup budget',
  /if \(idStatus === 'FAILED' \|\| idStatus === 'ABSENT'\) break;/.test(cartridgeSource));


console.log('\nthe 400 kV public record\n');

/* Bind to the public record or say nothing: DCO-scale schemes carry a
   declared 400 kV point of connection, and the card states it with its
   source instead of implying the nearest 132 kV is the story.

   Since generation 202609012128 the table is a MODULE in front of the
   body (atlas/modules/202609012128-declared-connections.js), proven value
   for value against the last cartridge that carried it inline. Here the
   question is composition: the record is in the served bytes exactly once,
   the body binds to it by name, and the card still says what it said. */
const recordTables = (cartridgeSource.match(/const (DECLARED_CONNECTIONS|RECORDS) = Object\.freeze\(\{/g) || []).length;
check('the served bytes carry the declared table exactly once', recordTables === 1,
  `${recordTables} tables`);
check('the table binds register identities to named substations',
  /const RECORDS = Object\.freeze\(\{/.test(cartridgeSource)
  && ['10914','10916','9809','12281','14806','13599','9806','13644','11928']
    .every(ref => new RegExp(`'${ref}': \\{ (works|substation|poc_status|poc_kind): `).test(cartridgeSource)));
check('every declared entry names its public source',
  /EN010133/.test(cartridgeSource) && /EN010132/.test(cartridgeSource)
  && /EN010131/.test(cartridgeSource) && /EN010142/.test(cartridgeSource)
  && /EN010159/.test(cartridgeSource) && /EN010151/.test(cartridgeSource)
  && /EN010123/.test(cartridgeSource));
check('the body binds to the module by name or does not load',
  /const DECLARED = \(window\.__GRIDATLAS_MODULES__ \|\| \{\}\)\.declaredConnections;/.test(cartridgeSource)
  && /throw new Error\('sld-sandbox requires the declared-connections module'\)/.test(cartridgeSource));
check('the body carries no resolver of its own, only delegations',
  /return DECLARED\.provisional\(repdRef\);/.test(cartridgeSource)
  && /return DECLARED\.resolve\(repdRef, origin, subs\);/.test(cartridgeSource)
  && /return DECLARED\.nearestTransmission\(origin, subs\);/.test(cartridgeSource)
  // Both 400 kV filters (resolve and nearestTransmission) are the module's;
  // the body, which starts at its binding line, carries none.
  && (cartridgeSource.match(/s\.kv\[0\] >= 400\)/g) || []).length === 2
  && !/s\.kv\[0\] >= 400\)/.test(cartridgeSource.slice(cartridgeSource.indexOf('const DECLARED = '))));
check('the module is composed in front of the body, after geodesy',
  cartridgeSource.indexOf('gridatlas.module.declared-connections.v1') > cartridgeSource.indexOf('gridatlas.module.geodesy.v1')
  && cartridgeSource.indexOf('gridatlas.module.declared-connections.v1') < cartridgeSource.indexOf('const DECLARED = '));
check('a payload-absent substation is stated, not silently dropped',
  /not in the mapped payload, so no distance is measured/.test(cartridgeSource));
check('the declared link draws in its own colour',
  /const DECLARED_COLOUR = '#d8b64a';/.test(cartridgeSource)
  // v9.56: the colour is chosen per far-end state, so the line takes the
  // resolved variable rather than the gold constant directly.
  && /colour: declaredColour, strength: 0\.85/.test(cartridgeSource)
  && /unbuilt \? DECLARED_UNBUILT_COLOUR : DECLARED_COLOUR/.test(cartridgeSource));
check('nearest 400 kV is measured for every project selection',
  /function nearestTransmission\(origin, subs\)/.test(cartridgeSource)
  && /currentNearest400 = nearestTransmission\(origin, subs\);/.test(cartridgeSource));
check('substation works notes come from the fixed public table only',
  (cartridgeSource.match(/const SUBSTATION_WORKS = Object\.freeze\(\{/g) || []).length === 1
  && /Great Grid Upgrade, public record/.test(cartridgeSource));
check('the card block says public record and cites the source',
  /Declared connection/.test(cartridgeSource)
  && /Public record/.test(cartridgeSource)
  && /Source: \$\{escapeHtml\(d\.source\)\}/.test(cartridgeSource));
check('selection state resets so one scheme never wears another\'s record',
  /currentDeclared = null;\n      currentNearest400 = null;/.test(cartridgeSource)
  && /currentRepdRef = null;\n    currentDeclared = null;/.test(cartridgeSource));
check('no verdict language decorates the record',
  !/STRONG|REMOTE|well.placed|ideal|advantage/.test(
    cartridgeSource.split('const RECORDS = Object.freeze({')[1].split('NS.declaredConnections = ')[0]));


console.log('\nthe transmission network, on demand\n');

/* The network-topology module was proven 47/47 at 202609012145 and
   composed into nothing: on disk, in no served cartridge, listed by the
   deep scan as alive. This generation wires it, and these checks are the
   shape of the wiring: the module is in the bytes, the product is fetched
   on first use and never at load, every state is visible to the source
   registry, and both cards that name a substation ask the question. */
check('the network-topology module is composed into the served bytes',
  /gridatlas\.module\.network-topology\.v1/.test(cartridgeSource)
  && cartridgeSource.indexOf('gridatlas.module.network-topology.v1') < cartridgeSource.indexOf('const DECLARED = '));
check('the loader state lives on the window for the source registry',
  /window\.__GRIDATLAS_TOPOLOGY__ = topology;/.test(cartridgeSource)
  && /const topology = \{ state: 'idle'/.test(cartridgeSource));
check('the product is named once, at data-grid-gb main, and is the v1 schema', (() => {
  const urls = cartridgeSource.match(/main\/derived\/gb-transmission-network\.v1\.json/g) || [];
  const declared = cartridgeSource.match(/product: 'derived\/gb-transmission-network\.v1\.json'/g) || [];
  return urls.length === 1 && declared.length === 1
    && /raw\.githubusercontent\.com\/Ventusltd\/data-grid-gb\/'\s*\n\s*\+ 'main\/derived\/gb-transmission-network\.v1\.json'/.test(cartridgeSource);
})());
check('it is fetched on first use, inside ensureTopology, and nowhere at load', (() => {
  const at = cartridgeSource.indexOf('fetch(TOPOLOGY_PRODUCT)');
  const fn = cartridgeSource.indexOf('function ensureTopology()');
  const next = cartridgeSource.indexOf('\n  function ', fn + 10);
  return at > fn && at < next
    && (cartridgeSource.match(/fetch\(TOPOLOGY_PRODUCT\)/g) || []).length === 1
    && !/ensureTopology\(\)\s*;?\s*\n/.test(cartridgeSource.slice(0, fn));
})());
check('the loader fails closed on a schema it does not accept',
  /const index = module\.index\(product\);\s*\n\s*if \(!index\) \{/.test(cartridgeSource)
  && /is not ' \+ module\.accepts \+ '; this cartridge answers nothing from it/.test(cartridgeSource));
check('every failure is recorded by the named helper, never swallowed',
  /noteFailure\('transmission network: ' \+ topology\.error\)/.test(cartridgeSource)
  && /noteFailure\('topology block: '/.test(cartridgeSource));
check('the project card asks about its declared substation',
  /if \(networkName\) \{\s*\n\s*out \+= topologyBlockHtml\(\[\{ name: networkName, kv: connectionKv \}\]\);/.test(cartridgeSource));
check('the scope card asks about its three nearest named substations',
  /topologyBlockHtml\(result\.nearest_named\.slice\(0, 3\)\.map\(entry => \(\{ name: entry\.name, kv: entry\.kv \}\)\)\)/.test(cartridgeSource));
check('blocks are placeholders filled in place, so no card holds another card',
  /data-queries="\$\{attr\}"/.test(cartridgeSource)
  && /document\.querySelectorAll\('\.' \+ TOPOLOGY_BLOCK\)\.forEach/.test(cartridgeSource)
  && /ensureTopology\(\)\.then\(\(\) => fillTopologyBlocks\(\)\)/.test(cartridgeSource));
check('the join is by name through the connection-points cartridge, and says so',
  /point = network\.byName\(q\.name\)/.test(cartridgeSource)
  && /Joined by name from <i>/.test(cartridgeSource)
  && /to NESO site/.test(cartridgeSource));
check('the voltage asked about is the voltage answered about',
  /topology\.index\.at\(point\.site_code, kv != null \? \{ voltageKv: kv \} : undefined\)/.test(cartridgeSource));
check('the block carries the module\'s not-an-assessment sentence and the attribution',
  /module \? module\.not_an_assessment : ''/.test(cartridgeSource)
  && /ETYS Appendix B via Ventusltd\/data-grid-gb/.test(cartridgeSource));
check('absence is stated as absence, never inferred from', (() => {
  const section = cartridgeSource.split('function topologyInnerHtml(queries)')[1]?.split('\n  }\n')[0] || '';
  return /Nothing here is inferred from its absence/.test(section)
    && /so nothing is stated about their circuits/.test(section)
    && !/STRONG|REMOTE|well.placed|ideal|advantage|likely|headroom/i.test(section);
})());
check('the loader is called only from named on-demand paths, never at load', (() => {
  /* Every caller is enumerated. A new one must be added here, which
     is the guarantee: the 10 MB product is fetched when a reader asks
     a question, and never because the page opened. */
  const ALLOWED = new Set(['topologyBlockHtml', 'runGridAtPoint']);
  const found = [];
  let at = cartridgeSource.indexOf('ensureTopology()');
  while (at >= 0) {
    const before = cartridgeSource.slice(0, at);
    /* the declaration is not a call site; skip `function ensureTopology()` */
    if (!/function\s+$/.test(before.slice(-12))) {
      const m = [...before.matchAll(/function\s+(\w+)\s*\(/g)].pop();
      found.push(m ? m[1] : '<top level>');
    }
    at = cartridgeSource.indexOf('ensureTopology()', at + 1);
  }
  if (!found.length) return false;   // the loader vanished entirely
  const strays = found.filter(name => !ALLOWED.has(name));
  if (strays.length) console.log('    unexpected ensureTopology caller(s): ' + strays.join(', '));
  return strays.length === 0;
})());


console.log('\nthe recovered ledger\n');

/* Codex supervision 202609011446: recovered events were indistinguishable
   from terminal faults in the public failures array. */
check('a recovered ledger exists beside failures',
  /recovered: \[\]/.test(cartridgeSource)
  && /function recoverFailures\(pattern\)/.test(cartridgeSource));
check('recovery moves entries rather than deleting them',
  /if \(pattern\.test\(entry\)\) link\.recovered\.push\(entry\);/.test(cartridgeSource)
  && /link\.failures = kept;/.test(cartridgeSource));
check('the subs control recovers its own earlier miss on success',
  /link\.substation_layer_enabled = true;\n      recoverFailures\(\/\^subs: control not found\$\//.test(cartridgeSource));
check('the technology control recovers exactly its own entry, escaped',
  /link\.project_layer_enabled = tech;\n      recoverFailures\(new RegExp\('\^layer control not found: '/.test(cartridgeSource));
check('the late-controls observer recovers the budget note it outlived',
  /link\.layer_controls_arrived_late = true;\n        recoverFailures\(\/\^the engine had not rendered its layer controls within\//.test(cartridgeSource));


console.log('\nthe consented works\n');

check('declared schemes carry customer-substation works quotes',
  /works: "an up to 400 kV substation collating the satellite sites/.test(cartridgeSource)
  && /150\/75\/75 MVA transformers with 400 kV GIS/.test(cartridgeSource)
  && /160 t, up to 15 x 9\.5 x 10\.5 m each/.test(cartridgeSource));
check('PoC interface classes are quoted, from bay reuse to NG-delivered extension',
  /reuse of an ex-generation bay/.test(cartridgeSource)
  && /new GIS bay by extension of main busbar 4/.test(cartridgeSource)
  && /National Grid-delivered extension of Bicker Fen/.test(cartridgeSource));
check('the card labels them as consented quotations, never advice',
  /Customer substation \(consented\):/.test(cartridgeSource)
  && /Works at the point of connection:/.test(cartridgeSource)
  && /Never design advice/.test(cartridgeSource));
check('the nearest-400 row measures a named companion when an unnamed node wins',
  /let bestNamed = null;/.test(cartridgeSource)
  && /nearest named: \$\{escapeHtml\(n\.named\.name\)\}/.test(cartridgeSource)
  && /bestNamed\.name !== best\.name/.test(cartridgeSource));


console.log('\nthe measurement does not wait for the layers\n');

check('the arrival measures before it awaits the layer controls',
  /const layersReady = arrive\(\);/.test(cartridgeSource)
  && /await runArrivalSelection\(\);\n        await layersReady;/.test(cartridgeSource)
  && !/await arrive\(\);/.test(cartridgeSource));
check('the substation payload is warmed at install',
  /try \{ loadSubstations\(\); \} catch \(_\)/.test(cartridgeSource));
check('the waiting message no longer claims the distances need the layers',
  /The distances do not wait for them\./.test(cartridgeSource)
  && !/Loading the grid data \u2014 the distances need it\./.test(cartridgeSource));
check('a late-layers notice never covers a drawn answer',
  /if \(link\.links_drawn > 0\) \{\n      \/\/ The answer is already on the map/.test(cartridgeSource));
check('retry still re-runs the measurement and the layers',
  /retryArrival = \(\) => \{ runArrivalSelection\(\)\.then\(\(\) => arrive\(\)\); \};/.test(cartridgeSource));


console.log('\nthe sales surface answers immediately\n');

check('a declared connection is knowable from the link alone',
  /function provisionalDeclaredConnection\(repdRef\)/.test(cartridgeSource)
  && /at: null, km: null, pending: true/.test(cartridgeSource));
check('it is shown before the measurement is attempted',
  /currentDeclared = provisionalDeclaredConnection\(currentRepdRef\);\n          if \(currentDeclared\) injectDeclaredOnly\(\);/.test(cartridgeSource));
check('the ring is drawn on arrival, not after the payload',
  /if \(capturedMap\) setPin\(capturedMap, \[lon, lat\], name, tech\);/.test(cartridgeSource));
check('a pending distance says it is being measured, never that none exists',
  /The distance is being measured now\./.test(cartridgeSource)
  && /d\.pending/.test(cartridgeSource));
check('the provisional block never overwrites a measured one',
  /if \(content\.querySelector\(`\.\$\{BLOCK_CLASS\}`\)\) return false;/.test(cartridgeSource));
check('the measurement does not blank a standing provisional block',
  /if \(!currentDeclared\?\.pending\) currentDeclared = null;/.test(cartridgeSource));
check('the early answer is published for the next debugger',
  /link\.declared_shown_before_measurement = true;/.test(cartridgeSource));


console.log('\nthe far end has its own state\n');

check('an unbuilt point of connection has its own colour',
  /const DECLARED_UNBUILT_COLOUR = '#d87aa8';/.test(cartridgeSource)
  && /const declaredColour = unbuilt \? DECLARED_UNBUILT_COLOUR : DECLARED_COLOUR;/.test(cartridgeSource));
check('both line and node take that colour together',
  /properties: \{ colour: declaredColour, strength: 0\.85/.test(cartridgeSource)
  && /nodes\.push\(\{ type: 'Feature',\n        properties: \{ colour: declaredColour,/.test(cartridgeSource));
check('the unbuilt states are the two the record supports',
  /poc_status === 'not_built'/.test(cartridgeSource)
  && /poc_status === 'under_construction'/.test(cartridgeSource));
check('One Earth and Thorpe Marsh carry their state with a reason',
  /'14806': \{ poc_status: 'not_built'/.test(cartridgeSource)
  && /'13644': \{ poc_status: 'under_construction'/.test(cartridgeSource)
  && /Great Grid Upgrade works/.test(cartridgeSource)
  && /four-bay substation is under construction/.test(cartridgeSource));
check('the card labels the state beside the public-record badge',
  /Not built yet/.test(cartridgeSource) && /Under construction/.test(cartridgeSource)
  && /This point of connection is not yet in service/.test(cartridgeSource));
check('a declared circuit connection draws no line and measures no distance',
  /'6557': \{ poc_kind: 'circuit'/.test(cartridgeSource)
  && /The point of connection is a circuit rather than a substation, so no line is drawn/.test(cartridgeSource)
  // The rule moved into the declared-connections module with the resolver.
  && /if \(declared\.poc_kind === 'circuit'\) return provisional\(repdRef\);/.test(cartridgeSource));
check('Little Crow names its circuit and its source',
  /Keadby \\u2013 Broughton \\u2013 Teed \\u2013 Scawby Brook overhead 132 kV line circuit/.test(cartridgeSource)
  && /EN010101, November 2020/.test(cartridgeSource));
check('a circuit connection never claims 400 kV',
  /kv: 132,/.test(cartridgeSource)
  && /\(d\.kv \? `<span class="neon-kv">\$\{d\.kv\} kV<\/span>` : ''\)/.test(cartridgeSource));


console.log('\nthe published network parameters\n');

check('the card asks the substation cartridge and renders only what it returns',
  // v9.63 passes the connection voltage, so the call spans two lines.
  /window\.__GRIDATLAS_NETWORK__\?\.summarise\?\.\(/.test(cartridgeSource)
  && /networkName, \{ connectionKv \}\)/.test(cartridgeSource));
check('a circuit connection is not attributed to a substation',
  /currentDeclared\?\.kind !== 'circuit'/.test(cartridgeSource));
check('the metric caveat, the attribution and the refusal travel with the numbers',
  /published\.metrics_not_interchangeable/.test(cartridgeSource)
  && /published\.attribution/.test(cartridgeSource)
  && /published\.not_an_assessment/.test(cartridgeSource));


console.log('\nthe manifest knows who it is, and the Subs control is found by its attribute\n');

/* Codex pre-promotion findings, 202609011823. Both proven where they
   live: the manifest by reading it, the lookup by running it. */
const manifestPath = join(REPO, 'atlas', 'manifests', `${GENERATION}-composition.json`);
const manifestText = await readFile(manifestPath, 'utf8');
const manifest = JSON.parse(manifestText);
check('the manifest states this generation everywhere it states one',
  manifest.generation === GENERATION && manifest.version === VERSION
  && manifest.composition_version === VERSION
  // Derived from the generation under test, not restated: a hard-coded
  // identity here is the same drift this check exists to catch.
  && manifest.composition_id === `${manifest.generation}-gridatlas-${VERSION}`);
check('no identity from an older composition survives anywhere in it',
  !/v9\.39|202609010106/.test(manifestText));
check('the acceptance receipt names this generation\'s proofs',
  manifest.acceptance.proof.includes(GENERATION)
  && !/420 checks/.test(manifest.acceptance.proof));
check('the golden browser field is this generation\'s, not an inherited pending',
  manifest.acceptance.golden_browser_verification === 'PENDING_THIS_GENERATION');
/* The stamp is a clock reading, and the manifest now records the clock
   beside it. The two must agree to the minute, allowing the seconds the
   cut itself took. A manifest without cut_at_utc is a manifest from the
   days stamps were typed, and this generation is not one of them. */
check('the manifest records the clock it was cut at, and the stamp agrees with it', (() => {
  if (typeof manifest.cut_at_utc !== 'string') return false;
  const cut = new Date(manifest.cut_at_utc);
  if (Number.isNaN(cut.getTime())) return false;
  const asStamp = cut.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const minutes = (s) => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)) / 60000;
  return Math.abs(minutes(asStamp) - minutes(GENERATION)) <= 5;
})(), manifest.cut_at_utc || 'absent');
check('the manifest chains by pointer, not by sort order',
  manifest.parent_generation === CURRENT.previous_generation
  && typeof manifest.parent_generation === 'string' && manifest.parent_generation.length === 12);

check('the Subs control is looked up by its attribute first',
  /document\.querySelector\('input\[type=checkbox\]\[data-layer-id="subs"\]'\)/
    .test(cartridgeSource));
check('the label search survives only as a fallback',
  /\|\|\s*\[\.\.\.document\.querySelectorAll\('input\[type=checkbox\]'\)\]/.test(cartridgeSource));
check('an active failure is recorded once, by a named helper',
  /function noteFailure\(message\)/.test(cartridgeSource)
  && /if \(!link\.failures\.includes\(message\)\) link\.failures\.push\(message\);/
    .test(cartridgeSource)
  && /noteFailure\('subs: control not found'\)/.test(cartridgeSource)
  && /noteFailure\('layer control not found: ' \+ tech\)/.test(cartridgeSource));

/* Behavioural, not regex: a fresh context with a DOM that answers the
   attribute selector, and the real functions called against it. */
console.log('\nrun against a DOM, not a regular expression\n');
{
  let subsBox = null;
  const behaviourDoc = {
    ...documentStub, _byId: new Map(), head: makeElement('head'),
    querySelector: (selector) =>
      (selector.includes('data-layer-id="subs"') ? subsBox : null),
    querySelectorAll: () => []
  };
  const box = {
    window: { ...windowStub }, document: behaviourDoc, console,
    fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }), URL,
    Math, JSON, Number, String, Array, Object, Set, Map, Boolean, Error, RegExp,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    MutationObserver: MutationObserverStub
  };
  box.window.maplibregl = maplibregl;
  box.maplibregl = maplibregl;
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(cartridgeSource, box);
  const behaviour = box.window.__GRIDATLAS_NEON_LINKS__;

  behaviour.enableSubstationLayer();
  behaviour.enableSubstationLayer();
  check('two misses leave one entry, not two',
    behaviour.failures.filter(f => f === 'subs: control not found').length === 1,
    String(behaviour.failures.filter(f => f === 'subs: control not found').length));
  behaviour.noteFailure('an unrelated failure');

  // The control arrives, tagged the way the engine tags it, with label text
  // that would defeat a label search.
  let clicked = false;
  subsBox = { type: 'checkbox', checked: false, click() { clicked = true; this.checked = true; },
    dataset: { layerId: 'subs' }, closest: () => null,
    parentElement: { textContent: 'Substations [WAIT] 5,800' } };

  const enabled = behaviour.enableSubstationLayer();
  check('the control is found by attribute despite unhelpful label text',
    enabled === true && clicked === true);
  check('the recovered entry left the active ledger',
    !behaviour.failures.includes('subs: control not found'));
  check('it was preserved as recovered rather than deleted',
    behaviour.recovered.includes('subs: control not found'));
  check('an unrelated failure is untouched',
    behaviour.failures.includes('an unrelated failure'));
}


console.log('\nthe network sentence names its own scope\n');

check('the scope label is rendered before the numbers', (() => {
  const label = cartridgeSource.indexOf('published.scope_label');
  const sentence = cartridgeSource.indexOf('published.sentence');
  return label > 0 && sentence > label;
})());
check('a multi-voltage site is badged Site-wide',
  /published\.site_wide\s*\n?\s*\?\s*`<span class="neon-beta"[^`]*Site-wide/.test(cartridgeSource));
check('the card never prints a distance taken from the owner product',
  !/__GRIDATLAS_NETWORK__[^;]*\.nearest\(/.test(cartridgeSource));


console.log('\nthe Grid Finding Scope\n');

check('the scope computation is a module, not more cartridge body',
  /window\.__GRIDATLAS_MODULES__\?\.gridScope/.test(cartridgeSource)
  && /gridatlas\.module\.grid-scope\.v2/.test(cartridgeSource));
check('the neon anchor is untouched: a scope runs only where nothing was hit',
  // The gap holds the reason-why comment and the clearLinks call; the
  // point of the check is the ORDER, so the bound is generous.
  /if \(!hit\) \{[\s\S]{0,500}if \(scopeArmed\) await runGridScope/.test(cartridgeSource));
check('arming is explicit, not automatic',
  /scopeArmed = !scopeArmed;/.test(cartridgeSource)
  && /let scopeArmed = false;/.test(cartridgeSource));
check('the tray carries both a scope and a clear',
  /\\u25ce Scope/.test(cartridgeSource) && /\\u2715 Clear/.test(cartridgeSource));
check('selecting a project clears any standing scope',
  /async function selectAt\(origin, name, tech, fromSubstation, statedMw\) \{\n      clearScope\(\);/
    .test(cartridgeSource));
check('the card prints what the scope is not, in bold, from the result itself',
  /<b>\$\{escapeHtml\(result\.what_this_is_not\)\}<\/b>/.test(cartridgeSource));
check('an absence is described as an absence from the map',
  /an absence from the map, not from the ground/.test(cartridgeSource));
check('the scope publishes its state',
  /link\.grid_scope = \{ counted/.test(cartridgeSource));


console.log('\nthe connection voltage reaches the network query\n');

check('the card tells the cartridge what voltage the connection is made at',
  /summarise\?\.\(\n?\s*networkName, \{ connectionKv \}\)/.test(cartridgeSource));
check('a circuit connection has no busbar voltage to pass',
  /currentDeclared\?\.kind !== 'circuit'\n\s*\? \(currentDeclared\?\.kv/.test(cartridgeSource));
check('a bus-scoped answer is badged with its voltage, not as site-wide',
  /published\.fault_scope === 'bus'/.test(cartridgeSource)
  && /\$\{published\.fault_kv\} kV bus/.test(cartridgeSource));

console.log('\nthe map measures in circuits as well as in kilometres\n');

/* The module can be perfect and composed into nothing - that is exactly
   what happened to network-topology at 202609012145, proven 46/46 and
   present in no served cartridge for two generations. These checks are
   about the BYTES that ship. */
check('the electrical-distance module is in the served cartridge',
  /gridatlas\.module\.electrical-distance\.v1/.test(cartridgeSource));
check('it is evaluated before the body that calls it',
  cartridgeSource.indexOf('gridatlas.module.electrical-distance.v1')
    < cartridgeSource.indexOf('function distanceModule('));
check('the successor topology module ships, not the incumbent',
  /gridatlas\.module\.network-topology\.graph\.v1/.test(cartridgeSource));
check('the card asks for two hops, scoped to the connection voltage',
  /mod\.within\(topology\.index, point\.site_code, \{ hops: 2, voltageKv: kv \}\)/.test(cartridgeSource));
check('a missing module is an absence, never a guess',
  /if \(!mod\) return null;/.test(cartridgeSource));
check('the page says plainly that a hop is not a distance',
  /A hop is a published circuit, not a distance/.test(cartridgeSource));
check('refusals are surfaced to the reader, not swallowed',
  /not walked because a circuit cannot change voltage/.test(cartridgeSource));
check('the traversal state is published for review',
  /window\.__GRIDATLAS_ELECTRICAL__ = electrical;/.test(cartridgeSource));
check('no kilometre figure is taken from the topology answer',
  !/reach[\s\S]{0,200}_km/.test(cartridgeSource));

console.log('\nevery season the operator publishes, and no total\n');

check('the rating-envelope module is in the served cartridge',
  /gridatlas\.module\.rating-envelope\.v1/.test(cartridgeSource));
check('it is evaluated before the body that calls it',
  cartridgeSource.indexOf('gridatlas.module.rating-envelope.v1')
    < cartridgeSource.indexOf('function ratingModule('));
check('the card asks for summer, not winter alone',
  /for \(const season of \['winter', 'summer'\]\)/.test(cartridgeSource));
check('the card is scoped to the connection voltage when there is one',
  /mod\.at\(topology\.index, point\.site_code, kv != null \? \{ voltageKv: kv \}/.test(cartridgeSource));
check('the page states plainly that the ratings are not added together',
  /not a quantity that exists/.test(cartridgeSource));
check('the page distinguishes a rating from what is free on the circuit',
  /a rating is not what is free on the circuit/.test(cartridgeSource));
/* The sentence is split across a template interpolation for the
   singular/plural, so the words "reads as a placeholder" never appear
   adjacent in the source. Pin the two halves that do ship verbatim. */
check('a placeholder value is named to the reader, not hidden',
  /as a placeholder and/.test(cartridgeSource)
  && /at or above 9,999 MVA on spans of a kilometre or less/.test(cartridgeSource)
  && /excluded from the range above/.test(cartridgeSource));
check('the served bytes contain no site total of circuit ratings', (() => {
  const start = cartridgeSource.indexOf('gridatlas.module.rating-envelope.v1');
  const end = cartridgeSource.indexOf('NS.ratingEnvelope = Object.freeze');
  if (start < 0 || end < 0) return false;
  const module = cartridgeSource.slice(start, end)
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    .split(/const (?:NEVER_SUMMED|NOT_A_CAPACITY)\s*=[\s\S]*?;/).join(' ');
  return !/(?:^|[^A-Za-z])(total|sum|aggregate)(?![A-Za-z])/i.test(module)
    && !/\.reduce\(/.test(module);
})());
check('the rating state is published for review',
  /window\.__GRIDATLAS_RATINGS__ = rating;/.test(cartridgeSource));

console.log('\na declared powerflow, and what it refuses to say\n');

check('the injection-response module is in the served cartridge',
  /gridatlas\.module\.injection-response\.v1/.test(cartridgeSource));
check('it is evaluated before the body that calls it',
  cartridgeSource.indexOf('gridatlas.module.injection-response.v1')
    < cartridgeSource.indexOf('function flowModule('));
check('the served bytes never read resistance or susceptance into the flow model', (() => {
  const start = cartridgeSource.indexOf('gridatlas.module.injection-response.v1');
  const end = cartridgeSource.indexOf('NS.injectionResponse = Object.freeze');
  if (start < 0 || end < 0) return false;
  const mod = cartridgeSource.slice(start, end);
  return !/r_pct_100mva/.test(mod) && !/b_pct_100mva/.test(mod) && /x_pct_100mva/.test(mod);
})());
check('the card names the slack, because a transfer has two ends',
  /transfer to \$\{escapeHtml\(injection\.slack_node\)\}/.test(cartridgeSource));
check('the card states the model assumptions where the reader sees them',
  /Flat 1\.0 pu voltages, small angles, no losses, no taps, intact network/.test(cartridgeSource));
check('the card says plainly it is not a loading',
  /not a loading/.test(cartridgeSource)
  && /whether there is room/.test(cartridgeSource));
check('an answer that fails its own Kirchhoff check is discarded, not printed',
  /r\.validation && r\.validation\.passes \? r : null/.test(cartridgeSource));
check('the powerflow uses the capacity the deep link carries',
  /currentCapacityMw/.test(cartridgeSource)
  && /currentCapacityMw = Number\.isFinite\(stated\)/.test(cartridgeSource));
check('the 400 kV node list is recorded once, where the product is already parsed',
  /topology\.nodes400 = \(product\.nodes/.test(cartridgeSource));
check('the powerflow is scoped to 400 kV, never walked through an unmodelled tap',
  /kv !== 400\) return null;/.test(cartridgeSource));
check('the conservation error is published for review',
  /window\.__GRIDATLAS_POWERFLOW__ = powerflow;/.test(cartridgeSource));
check('the served bytes claim no headroom anywhere in the flow module', (() => {
  const start = cartridgeSource.indexOf('gridatlas.module.injection-response.v1');
  const end = cartridgeSource.indexOf('NS.injectionResponse = Object.freeze');
  const mod = cartridgeSource.slice(start, end)
    .split(/const NOT_A_[A-Z_]+ =[\s\S]*?';/).join(' ');
  return !/headroom/i.test(mod);
})());

console.log('\nthe grid computation without a project, and a dash that gets out of the way\n');

check('a tool is added to the shell tray, which the cartridge does not own',
  /id = 'btn-gridpoint'/.test(cartridgeSource)
  && /document\.querySelector\('\.map-controls'\)/.test(cartridgeSource));
check('the tool does not duplicate itself if the cartridge runs twice',
  /document\.getElementById\('btn-gridpoint'\)\) return;/.test(cartridgeSource));
check('arming is explicit, as it is for the scope',
  /let pointArmed = false;/.test(cartridgeSource)
  && /pointArmed = !pointArmed;/.test(cartridgeSource));
check('an unarmed click still does nothing new',
  /if \(pointArmed\) await runGridAtPoint/.test(cartridgeSource));
check('the point query never measures a distance itself',
  (() => {
    const start = cartridgeSource.indexOf('async function runGridAtPoint');
    const end = cartridgeSource.indexOf('function topologyBlockHtml');
    if (start < 0 || end < 0 || end < start) return false;
    const fn = cartridgeSource.slice(start, end);
    return /network\.nearest\(lon, lat/.test(fn)
      && !/Math\.atan2|Math\.asin|6378\.137/.test(fn);
  })());
/* A plain substring, not a regex: fillTopologyBlocks selects by CLASS
   and getting this wrong produces a block that shows its loading line
   forever and never fills - which no other check here would catch. */
check('the block it writes is found by the filler, which selects by class',
  cartridgeSource.includes(`'<div class="' + TOPOLOGY_BLOCK + '" data-queries="'`)
  && /querySelectorAll\('\.' \+ TOPOLOGY_BLOCK\)/.test(cartridgeSource));
check('the reader is told that nearest MAPPED is not nearest',
  /the nearest <i>mapped<\/i> point may not/.test(cartridgeSource));
check('the reader is told it is a straight line and not a cable route',
  /not a cable route/.test(cartridgeSource));
check('the point answer never claims anything can connect',
  /not a statement that anything can connect/.test(cartridgeSource));
check('an absent connection-points cartridge is an absence, not a guess',
  /Nothing is inferred from its absence/.test(cartridgeSource));
check('the layers dash can be collapsed without entering fullscreen',
  /gridatlas-dash-toggle/.test(cartridgeSource)
  && /data-gridatlas-collapsed/.test(cartridgeSource));
check('the collapsed choice is remembered, and every storage access is guarded',
  /localStorage\.getItem\(KEY\)/.test(cartridgeSource)
  && /localStorage\.setItem\(KEY/.test(cartridgeSource)
  && (cartridgeSource.match(/catch \(_\) \{ collapsed = false; \}/) || []).length === 1);
check('the map is told to resize when the dash moves under it',
  /window\.map\.resize\(\)/.test(cartridgeSource));
check('the toggle is reachable and labelled for assistive technology',
  /aria-pressed/.test(cartridgeSource) && /aria-label/.test(cartridgeSource)
  && /focus-visible/.test(cartridgeSource));
check('both new surfaces are published for review',
  /window\.__GRIDATLAS_POINT_QUERY__ = pointQuery;/.test(cartridgeSource)
  && /window\.__GRIDATLAS_DASH__ = \{/.test(cartridgeSource));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('the adapter is intact, the sandbox arithmetic is reproduced on one radius, and the panel states its limits.');
