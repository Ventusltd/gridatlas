// node test-lightning-neon.mjs — minidom + node:vm. Compares the Lightning neon against the LIVE cartridge's own code,
// extracted from atlas/cartridges/202609241334-sld-sandbox-v9-8.js and run against the same recording map.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { makeDocument, dispatch } from '../opus-fix-designer/minidom.mjs';

const H = new URL('../../', import.meta.url).pathname;
const CART = readFileSync(H + 'wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js', 'utf8');
const GEO = readFileSync(H + 'wt/atlas/modules/202609011950-geodesy.js', 'utf8');
const IMPL = readFileSync(new URL('./lightning-neon.js', import.meta.url), 'utf8');
let pass = 0; const fail = [];
const ok = (name, c, d = '') => { if (c) { pass++; console.log('  [PASS] ' + name); } else { fail.push(name); console.log('  [FAIL] ' + name + ' ' + d); } };
const cut = (from, to) => { const a = CART.indexOf(from), b = CART.indexOf(to, a); if (a < 0 || b < 0) throw new Error('cannot cut ' + from); return CART.slice(a, b); };

function recMap({ glyphs = true } = {}) {
  const src = new Map(), lay = new Map(), log = [];
  return { src, lay, log, addSource: (id, s) => { if (src.has(id)) throw new Error('dup source ' + id); src.set(id, { ...s, setData(d) { this.data = d; } }); },
    getSource: id => src.get(id), removeSource: id => src.delete(id),
    addLayer: l => { if (lay.has(l.id)) throw new Error('dup layer ' + l.id); if (!src.has(l.source)) throw new Error('no source ' + l.source); lay.set(l.id, structuredClone(l)); },
    getLayer: id => lay.get(id), removeLayer: id => lay.delete(id),
    setPaintProperty: (id, k, v) => { lay.get(id).paint[k] = v; log.push([id, k, v]); },
    getStyle: () => ({ glyphs: glyphs ? 'https://x/{fontstack}/{range}.pbf' : undefined, layers: [{ type: 'symbol', layout: { 'text-font': ['Open Sans Regular'] } }] }),
    flyTo: o => log.push(['flyTo', o]) };
}

// 1. The ORIGINAL layer specs, produced by the cartridge's own ensureLayers / ensurePinLayers / flow code.
const orig = (() => {
  const code = cut('const FLOW_COLOUR =', 'const SRC = ') + cut('const SRC = ', 'const link = {')
    + cut('function emptyCollection()', 'function stopAnimation()') + cut('const SRC_PIN =', 'function setPin(')
    + 'return { ensureLayers, ensurePinLayers, flowDash, FLOW_PERIOD, FLOW_SPEED, FLOW_PULSE };';
  const label = {};
  const f = new Function('link', 'SUBSTATION_COLOUR', 'styleTextFont', 'addLabelLayerWhenDrawable', code);
  const api = f({ failures: [] }, CART.match(/const SUBSTATION_COLOUR = '([^']+)'/)[1], () => ['Open Sans Regular'], (m, font, spec) => { label.spec = spec; });
  const m = recMap(); api.ensureLayers(m); api.ensurePinLayers(m); return { m, label: label.spec, api };
})();

// 2. A window with the live cartridge's public surface: substations + measure.distanceKm (the geodesy module's).
function boot({ reduced = false, subs, glyphs = true, width = 393 } = {}) {
  const document = makeDocument(); const frames = [];
  const window = { innerWidth: width, __GRIDATLAS_MODULES__: {}, matchMedia: q => ({ matches: reduced && /reduce/.test(q) }) };
  vm.runInNewContext(GEO, { window, Math, Object, Number, Error });
  const dk = window.__GRIDATLAS_MODULES__.geodesy.distanceKm;
  window.__GRIDATLAS_NEON_LINKS__ = { substations: subs, measure: { distanceKm: dk, MIN_KV: 33, MAX_LINK_KM: 40, LINK_COUNT: 5, flowDash: orig.api.flowDash } };
  const ctx = { window, document, requestAnimationFrame: f => { frames.push(f); return frames.length; }, cancelAnimationFrame: h => { frames[h - 1] = null; }, Math, Number, Array, Object };
  vm.runInNewContext(IMPL, ctx);
  return { window, document, frames, N: window.__GRIDATLAS_LIGHTNING_NEON__, map: recMap({ glyphs }), dk };
}
// fixture: Wymondley-like point; offsets in km north of the flash
const X = -0.24, Y = 51.95, at = km => [X, Y + km / 111.32];
const SUBS = [
  { at: at(4.56), kv: [33], name: 'A 33' }, { at: at(3.43), kv: [132, 33], name: 'B 132' }, { at: at(5.42), kv: [400, 132], name: 'Wymondley' },
  { at: at(12), kv: [66], name: 'C 66' }, { at: at(20), kv: [275], name: 'D 275' }, { at: at(30), kv: [33], name: 'E sixth' },
  { at: at(45), kv: [400], name: 'F beyond' }, { at: at(1), kv: [11], name: 'G 11 kV must not appear' }];

console.log('kv-neon: Lightning neon vs live cartridge');
const t = boot({ subs: SUBS }); const r = t.N.show(t.map, X, Y);
ok('lines are drawn', r.ok && t.map.src.get('gridatlas-lightning-neon-links').data.features.length === 5);
ok('33 kV included, 11 kV excluded', r.links.some(l => l.kv[0] === 33) && !r.links.some(l => l.name.startsWith('G')));
ok('cap is 5 (sixth nearest dropped)', r.links.length === 5 && !r.links.some(l => l.name === 'E sixth'), r.links.map(l => l.name).join());
ok('cut-off 40 km', r.links.every(l => l.km <= 40) && !r.links.some(l => l.name === 'F beyond'));
ok('nearest first', r.links.map(l => l.name).join() === 'B 132,A 33,Wymondley,C 66,D 275');
const labels = t.map.src.get('gridatlas-lightning-neon-nodes').data.features.map(f => f.properties.label);
ok('label format "4.56 km · 33 kV"', labels.includes('4.56 km · 33 kV') && labels.includes('3.43 km · 132 kV') && labels.every(s => /^\d+\.\d\d km · \d+ kV$/.test(s)), labels.join(' | '));
ok('strength ramp .62 .52 .42 .32 .22', t.map.src.get('gridatlas-lightning-neon-links').data.features.map(f => +f.properties.strength.toFixed(2)).join() === '0.62,0.52,0.42,0.32,0.22');
ok('cartridge uses the same ramp and label', CART.includes('Math.max(0.20, 0.62 - index * 0.10)') && CART.includes('`${l.km.toFixed(2)} km · ${tail}`'));
// paint/layout equality, layer by layer, against the cartridge's own specs
const pairs = [['glow', 'l-neon-glow'], ['core', 'l-neon-core'], ['flow', 'l-neon-flow'], ['flow-b', 'l-neon-flow-b'], ['node-ring', 'l-neon-node-ring'], ['node', 'l-neon-node'], ['pin-halo', 'l-project-pin-halo'], ['pin', 'l-project-pin']];
for (const [mine, theirs] of pairs) {
  const a = t.map.lay.get('gridatlas-lightning-neon-' + mine), b = orig.m.lay.get(theirs);
  const pa = { ...a.paint }; if (mine.startsWith('flow')) pa['line-dasharray'] = b.paint['line-dasharray'];
  ok(`paint+layout identical: ${mine} == ${theirs}`, JSON.stringify(pa) === JSON.stringify(b.paint) && JSON.stringify(a.layout || {}) === JSON.stringify(b.layout || {}) && a.type === b.type, JSON.stringify([a, b]));
}
const lab = t.map.lay.get('gridatlas-lightning-neon-label');
ok('label layer identical (font taken from the style, as styleTextFont does)', JSON.stringify(lab.paint) === JSON.stringify(orig.label.paint) && JSON.stringify(lab.layout) === JSON.stringify(orig.label.layout));
ok('layer order: glow, core, flow, flow-b, ring, node, label, pin halo, pin', [...t.map.lay.keys()].map(k => k.replace('gridatlas-lightning-neon-', '')).join() === 'glow,core,flow,flow-b,node-ring,node,label,pin-halo,pin');
// animation: one frame writes the cartridge's own patterns, flow-b half a period behind
t.frames.at(-1)(); const d = t.map.log.filter(e => e[1] === 'line-dasharray');
ok('frame 1 dashes = cartridge flowDash(0.055) and flowDash(0.805)', JSON.stringify(d.map(e => e[2])) === JSON.stringify([orig.api.flowDash(0.055), orig.api.flowDash(0.805)]), JSON.stringify(d));
ok('flow constants 1.5 / 0.055 / 0.42', orig.api.FLOW_PERIOD === 1.5 && orig.api.FLOW_SPEED === 0.055 && orig.api.FLOW_PULSE === 0.42);
const fly = t.map.log.find(e => e[0] === 'flyTo')[1];
ok('camera: flyTo flash at zoom 12 (393 px), 1200 ms, essential', fly.zoom === 12 && fly.duration === 1200 && fly.essential && fly.center[0] === X);
// cleanup
const card = t.document.createElement('div'); t.document.documentElement.appendChild(card);
const b = t.N.bar(card, 'Optical flash', () => t.N.clear(t.map));
ok('bar text: grip, title, close', b.textContent === '⋮⋮' + 'Optical flash' + '×' && b.querySelector('button').getAttribute('title') === 'Close');
const live = t.frames.length; dispatch(b.querySelector('button'), 'click', []);
ok('close removes every layer and source', t.map.lay.size === 0 && t.map.src.size === 0);
ok('close cancels the animation frame', t.frames[live - 1] === null);
t.N.clear(t.map); ok('clear is idempotent (OFF after close)', t.map.lay.size === 0);
const t2 = boot({ subs: SUBS }); t2.N.show(t2.map, X, Y); t2.N.show(t2.map, X + 0.01, Y);
ok('second flash replaces, never duplicates', t2.map.src.size === 3 && t2.map.lay.size === 9);
t2.N.clear(t2.map); ok('OFF (clear) leaves nothing', t2.map.lay.size === 0 && t2.map.src.size === 0);
// edges
const t3 = boot({ subs: [] }); const r3 = t3.N.show(t3.map, X, Y);
ok('payload not loaded: says so, draws nothing', !r3.ok && r3.why === 'NOT_LOADED' && t3.map.lay.size === 0);
const t4 = boot({ subs: [SUBS[6]] }); const r4 = t4.N.show(t4.map, X, Y);
ok('nothing within 40 km: no line, nearest beyond still measured', r4.links.length === 0 && r4.beyond && Math.abs(r4.beyond.km - 45) < 0.2);
const t5 = boot({ subs: SUBS, reduced: true }); const r5 = t5.N.show(t5.map, X, Y);
ok('reduced motion: flows at opacity 0, no frame requested', r5.reduced && t5.frames.length === 0 && t5.map.lay.get('gridatlas-lightning-neon-flow').paint['line-opacity'] === 0);
const t6 = boot({ subs: SUBS, glyphs: false }); t6.N.show(t6.map, X, Y);
ok('no glyphs: lines drawn, label layer omitted', !t6.map.lay.has('gridatlas-lightning-neon-label') && t6.map.lay.has('gridatlas-lightning-neon-core'));
const t7 = boot({ subs: SUBS, width: 1400 }); ok('desktop width frames wider like the arrival (12 + log2(1400/393))', Math.abs(t7.N.show(t7.map, X, Y).zoom - (12 + Math.log2(1400 / 393))) < 1e-9);
ok('heading text', t.N.head() === 'NEAREST SUBSTATIONS ≥33 KV · BETA');
ok('implementation is <= 80 lines', IMPL.trimEnd().split('\n').length <= 80, String(IMPL.trimEnd().split('\n').length));
console.log(`\n${pass} passed, ${fail.length} failed`); if (fail.length) process.exit(1);
