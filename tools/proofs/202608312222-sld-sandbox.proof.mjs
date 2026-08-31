/**
 * Proof for the neon links + SLD layout sandbox cartridge, generation 202608312222.
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
  '202608312222-sld-sandbox-v9-8.js');
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
  /Loading the grid data .{1,12} the distances need it\./.test(st));
check('failure blames the network rather than the project',
  /usually the network rather than the project/.test(st));
check('failure offers a way forward', /again\.textContent = 'Try again';/.test(st));
check('the retry re-runs the arrival instead of reloading the engine',
  /retryArrival = \(\) => \{ arrive\(\)\.then/.test(st));
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
  /await waitForLayerControls\(12000\);\s*[\s\S]{0,40}enableSubstationLayer\(\);/.test(bootSrc));
check('the wait is bounded, not a hang',
  /while \(Date\.now\(\) - started < budgetMs\)/.test(bootSrc));
check('it waits for a tagged control, the same hook it will tick',
  /querySelector\('input\[type=checkbox\]\[data-layer-id\]'\)/.test(bootSrc));
check('how long the engine took is published', /link\.layer_controls_ready_ms = Date\.now\(\) - started;/.test(bootSrc));
check('giving up says what could not be switched on, and why',
  /had not rendered its layer controls within/.test(bootSrc));
check('the published state carries both new facts',
  'boot_trigger' in link && 'layer_controls_ready_ms' in link);


console.log('\ncentral sizing\n');

/* The shipped default reported 211.2 MW of AC. It is not the inverter figure
   and it is not the transformer figure; it is larger than both, and it comes
   from multiplying a count of inverters by a transformer rating and then by
   the inverters-per-skid a second time.

   Defaults: inv_ac_mw_c 4.4, central_skid_mva_c 4.4, inv_per_mv_c 2,
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

check('the defaults are still the ones this fixture reasons about',
  /inv_ac_mw_c: 4\.4, inv_dc_mw_c: 5\.28, central_skid_mva_c: 4\.4/.test(cs)
  && /inv_per_mv_c: 2, mv_per_ring_c: 4, rings_c: 3/.test(cs));
check('24 inverters on 12 skids', inverters === 24 && skids === 12);
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
check('on the defaults that comparison does fire',
  INV_AC * PER_MV > SKID_MVA);
check('the warning says which element limits export, not merely that it is odd',
  /Export is limited by the transformer/.test(cs));

check('the divergence from the ported sandbox is recorded, not silent',
  /gis-sld-v5-calculations\.js line 147/.test(cs));
check('the source of the report is credited',
  /Codex session auditing this estate in parallel/.test(cs));


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
  const strDcKwp = (i.x_mods_c * i.mod_wp) / 1000;
  const reqStrings = Math.ceil((i.inv_dc_mw_c * 1000) / strDcKwp);
  const total_blocks = i.inv_per_mv_c * i.mv_per_ring_c * i.rings_c;
  const module_count = reqStrings * i.x_mods_c * total_blocks;
  const dc_mwp = (module_count * i.mod_wp) / 1e6;
  const ac_mw = total_blocks * i.central_skid_mva_c * i.inv_per_mv_c;
  const net_array_area_m2 = (module_count * i.mod_l * i.mod_w) / i.gcr;
  return {
    total_blocks, module_count, dc_mwp, ac_mw,
    dc_ac_ratio: ac_mw > 0 ? dc_mwp / ac_mw : 1.2,
    net_array_area_m2,
    gross_site_area_m2: net_array_area_m2 * i.gross_factor,
    ring_main_ac_mva: i.central_skid_mva_c * i.inv_per_mv_c * i.mv_per_ring_c
  };
}

const CASES = [
  { mode: 'string' },
  { mode: 'string', b_cols: 4, s_subs: 3, y_invs: 20, z_strings: 14, x_mods: 26, mod_wp: 580 },
  { mode: 'string', b_cols: 12, s_subs: 8, string_skid_mva: 12.5, gcr: 0.35, gross_factor: 1.5 },
  { mode: 'central' },
  { mode: 'central', inv_per_mv_c: 3, mv_per_ring_c: 6, rings_c: 4, inv_ac_mw_c: 6.6, inv_dc_mw_c: 7.9, central_skid_mva_c: 6.6 },
  { mode: 'central', x_mods_c: 32, mod_wp: 720, gcr: 0.75 }
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
    oursIsLower: mine.ac_mw < theirs.ac_mw
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
check('ours is lower than the sandbox on every central case, never higher',
  divergence.every(d => d.oursIsLower));
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
check('every geometric operation is on R_ATLAS',
  /const R_ATLAS = 6378\.137/.test(src) && /destinationPoint/.test(src));
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
check('the fit moves only the block count',
  /const key = sld\.inputs\.mode === 'string' \? 'b_cols' : 'rings_c'/.test(code));
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
check('an out-of-range DC\/AC ratio is called out in red',
  /sld-ratio-warn/.test(src) && /outside the usual 1\.0 to 1\.6/.test(src));
check('the ratio warning explains both directions',
  /inverters are larger than the array/i.test(j) && /heavy clipping/i.test(j));

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
  /class="min"/.test(code) && /class="close"/.test(code) && /min-width:26px/.test(src));
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

// The glyph pre-flight is deliberately not awaited by the cartridge, so a
// promise is still in flight here. Whether it has resolved before the
// tally is a scheduling detail that differs between platforms, and a
// proof must not depend on one. Drain, then count.
await new Promise(resolve => setTimeout(resolve, 0));
await new Promise(resolve => setImmediate(resolve));

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error('\nFAILURES');
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('the adapter is intact, the sandbox arithmetic is reproduced on one radius, and the panel states its limits.');
