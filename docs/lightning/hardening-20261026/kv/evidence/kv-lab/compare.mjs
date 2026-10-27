// kv-lab: compare nearest-substation outputs for three flash points across
// (a) the lab's pinned ventus-grid-engine adapter, (b) Build I's in-card method,
// (c) the original sld-sandbox neon nearestSubstations, (d) nearestTransmission.
// Cartridge functions are extracted VERBATIM from the source text and run in node:vm.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const D = path.dirname(fileURLToPath(import.meta.url));
const H = path.resolve(D, '../..');
const CART = path.join(H, 'wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js');
const MOD = path.join(H, 'wt/atlas/modules/202610270929-uk-lightning-overlay.js');
const src = fs.readFileSync(CART, 'utf8');
const geo = JSON.parse(fs.readFileSync(path.join(D, 'data/grid_substations.geojson'), 'utf8'));

// ---- shared vm context with the estate geodesy module ----
const ctx = vm.createContext({ window: {}, Math, Number, String, Array, Object, Set, isFinite });
vm.runInContext(fs.readFileSync(path.join(D, 'data/geodesy.js'), 'utf8'), ctx);
const GEODESY = ctx.window.__GRIDATLAS_MODULES__.geodesy;

function extract(name, fromLine) {
  const lines = src.split('\n');
  const start = lines.findIndex((l, i) => i >= fromLine - 1 && l.startsWith('  function ' + name + '('));
  let depth = 0, out = [];
  for (let i = start; i < lines.length; i++) {
    out.push(lines[i]);
    for (const ch of lines[i].replace(/\/\/.*$/, '')) { if (ch === '{') depth++; if (ch === '}') depth--; }
    if (depth === 0 && i > start) break;
  }
  return out.join('\n');
}
const fnSrc = [
  'const MIN_KV=33, LINK_COUNT=5, MAX_LINK_KM=40;',
  'function distanceKm(a,b,c,d){return window.__GRIDATLAS_MODULES__.geodesy.distanceKm(a,b,c,d)}',
  'function worksAt(){return null}',
  extract('voltagesKv', 3338), extract('representativePoint', 3356),
  extract('nearestSubstations', 3513), extract('nearestTransmission', 623),
  'globalThis.__x={voltagesKv,representativePoint,nearestSubstations,nearestTransmission};'
].join('\n');
fs.writeFileSync(path.join(D, 'extracted-cartridge-fns.js'), fnSrc);
vm.runInContext(fnSrc, ctx);
const C = ctx.__x;

// loadSubstations() loop body, as at cartridge lines 3487-3500
const linkSubs = [];
for (const feature of geo.features) {
  const kv = C.voltagesKv(feature.properties);
  if (!kv.length || Math.max(...kv) < 33 - 0.5) continue;
  const at = C.representativePoint(feature.geometry);
  if (!at) continue;
  linkSubs.push({ at, kv: kv.filter(v => v >= 33 - 0.5).sort((a, b) => b - a),
    name: feature.properties?.name || '', operator: feature.properties?.operator || '' });
}

// Build I nr(): verbatim filter/sort/slice from the module (line 156)
const modSrc = fs.readFileSync(MOD, 'utf8');
const buildIline = modSrc.split('\n').find(l => l.startsWith('const k=subs.filter'));
const buildI = (x, y) => vm.runInNewContext(
  buildIline.replace(/^const k=/, 'k=') + ';k', { subs: linkSubs, dk: GEODESY.distanceKm, x, y, isFinite, k: null });

// Lab engine at pinned SHA 69b4e88
const eng = await import(pathToFileURL(path.join(D, 'engine-repo/engine/lightning-click-context.js')).href);
const engine = eng.createLightningContextEngine({ substations: geo.features, solarProjects: [] });

const points = [[51.899, -0.313], [55.374, -4.212], [51.5, -1.3]];
const r2 = n => Math.round(n * 100) / 100;
const fmt = a => `${r2(a.km).toFixed(2)} km · ${a.kv} kV · ${a.name || '(unnamed)'}`;
const out = { dataset: { features: geo.features.length, link_substations_ge33: linkSubs.length,
  lab_located: engine.dataset_summary.located_substations }, points: [] };
for (const [lat, lon] of points) {
  const f = { type: 'Feature', id: `kv-lab-${lat},${lon}`, geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { observation_kind: 'optical_lightning_flash', time_utc: '2026-10-27T12:00:00Z' } };
  const lab = (minimumKv, substationLimit) => engine.selectFlash(f, { radiusKm: 20, minimumKv, substationLimit, solarLimit: 1 })
    .substations.map(s => fmt({ km: s.km, kv: s.voltages_kv.join('/'), name: s.name }));
  const nt = C.nearestTransmission([lon, lat], linkSubs);
  out.points.push({
    flash: { lat, lon },
    lab_ui_default_ge132_limit6: lab(132, 6),
    lab_ge33_limit5: lab(33, 5),
    lab_all_limit5: lab(0, 5),
    buildI_ge132_top3: buildI(lon, lat).map(a => fmt({ km: a.km, kv: a.s.kv[0], name: a.s.name })),
    original_neon_ge33_top5_within40: C.nearestSubstations(lon, lat, linkSubs).map(a => fmt({ km: a.km, kv: a.kv.join('/'), name: a.name })),
    nearestTransmission_ge400: nt && { best: fmt({ km: nt.km, kv: '>=400', name: nt.name }), considered: nt.considered,
      named: nt.named ? fmt({ km: nt.named.km, kv: '>=400', name: nt.named.name }) : null }
  });
}
// voltage-parser divergence across the whole payload
let diffKv = 0; const ex = [];
for (const ft of geo.features) {
  const a = C.voltagesKv(ft.properties).slice().sort((x, y) => y - x);
  const b = eng ? (await import(pathToFileURL(path.join(D, 'engine-repo/engine/v9-geodesy.js')).href)).voltagesKv(ft.properties) : [];
  const A = [...new Set(a)].join('/'), B = b.join('/');
  if (A !== B) { diffKv++; if (ex.length < 8) ex.push({ name: ft.properties.name, voltage: ft.properties.voltage, kv: ft.properties.kv, cartridge: A, engine: B }); }
}
out.voltage_parser_divergence = { features: diffKv, examples: ex };
fs.writeFileSync(path.join(D, 'compare-out.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
