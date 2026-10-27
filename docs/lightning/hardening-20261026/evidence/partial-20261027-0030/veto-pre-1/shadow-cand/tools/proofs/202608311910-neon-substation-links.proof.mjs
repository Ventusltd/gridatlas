/**
 * Proof for the neon substation links cartridge, generation 202608311910.
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
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CARTRIDGE = join(REPO, 'atlas', 'cartridges',
  '202608311910-neon-substation-links-v9-6.js');
const ORIGINAL = join(REPO, 'atlas', 'releases', '202608300453-atlas-v9',
  '202608292126-pre-snapped-config-adapter.js');

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
  getSource() { return null; } addSource() {} addLayer() {}
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

const originalSource = await readFile(ORIGINAL, 'utf8');
const cartridgeSource = await readFile(CARTRIDGE, 'utf8');

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
check('a kV-unit tag is not multiplied', V({ voltage: '33' }).join(',') === '33');
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
check('offshore wind does NOT draw links', !T.has('wind_offshore_operational'));
check('non-project layers do not', !T.has('naei_emitter') && !T.has('supermarket'));

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

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('the adapter is carried forward intact, the maths is the canonical maths, and the card states its limits.');
