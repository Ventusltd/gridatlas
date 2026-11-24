// DC-B3: Grid Engine 30/30/30 feasibility and benchmark, node only.
// Loads the ORIGINAL engine code unchanged (sliced byte-for-byte from the live
// cartridges into a vm sandbox) and measures it against the real data.
// Usage: node bench.mjs <gridatlas clone> <repd_master.json> <dc_operational.geojson> <out.json>
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const [GA, REPD, DCA4, OUT] = process.argv.slice(2);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const lines = (f, a, b) => fs.readFileSync(f, 'utf8').split('\n').slice(a - 1, b).join('\n');

const SI = `${GA}/atlas/cartridges/202609062358-substation-intelligence-v9-63.js`;
const SLD = `${GA}/atlas/cartridges/202609241334-sld-sandbox-v9-8.js`;
const SUBS = `${GA}/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson`;
const OFF = `${GA}/data/offtakers_filtered_202610290945.geojson`;
const PP = `${GA}/atlas/releases/202608300453-atlas-v9/data/power_plants.geojson`;

// ---- the original code, unchanged ----
const sandbox = { window: {}, Math, Number, Array, String, Object, Error };
sandbox.window.__GRIDATLAS_MODULES__ = {};
vm.createContext(sandbox);
vm.runInContext(lines(SI, 1653, 1783), sandbox);            // geodesy module (identical to modules/202609011950-geodesy.js)
vm.runInContext(lines(SLD, 45, 186), sandbox);              // grid-scope module
const src = fs.readFileSync(SLD, 'utf8');
const grab = name => { const i = src.indexOf(`  function ${name}(`); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
vm.runInContext(`const GEODESY = window.__GRIDATLAS_MODULES__.geodesy; const MIN_KV = 33, LINK_COUNT = 5, MAX_LINK_KM = 40;
${grab('distanceKm')}\n${grab('voltagesKv')}\n${grab('representativePoint')}\n${grab('nearestSubstations')}
this.E = { distanceKm, voltagesKv, representativePoint, nearestSubstations, gridScope: window.__GRIDATLAS_MODULES__.gridScope };`, sandbox);
const E = sandbox.E;

// ---- the substation list exactly as loadSubstations() builds link.substations ----
const subFc = rd(SUBS);
const subs = [];
for (const f of subFc.features) {
  const kv = E.voltagesKv(f.properties); if (!kv.length || Math.max(...kv) < 33 - 0.5) continue;
  const at = E.representativePoint(f.geometry); if (!at) continue;
  subs.push({ at, kv: kv.filter(v => v >= 32.5).sort((a, b) => b - a), name: f.properties?.name || '',
    operator: f.properties?.operator || f.properties?.['operator:short'] || '' });
}

// ---- REPD register (the map register; offtakers RG() filter: representativePoint + not the Scilly placeholder) ----
const repdFc = rd(REPD);
const repd = repdFc.features.map(f => ({ at: E.representativePoint(f.geometry), p: f.properties }))
  .filter(r => r.at && !(r.at[0] === -7.55716 && r.at[1] === 49.766807));
// sites: projects within ~10 m share one site (offtakers groups by point); here: exact 5-dp key, conservative
const siteMap = new Map();
for (const r of repd) { const k = r.at[0].toFixed(4) + ',' + r.at[1].toFixed(4); (siteMap.get(k) || siteMap.set(k, { at: r.at, parts: [] }).get(k)).parts.push(r.p); }
const repdSites = [...siteMap.values()];

// ---- conventional: offtakers class B (until DC-A5's DUKES/GPPD set lands) and atlas power_plants ----
const off = rd(OFF);
const convB = off.features.filter(f => f.properties.class === 'B').map(f => ({ at: f.geometry.coordinates, p: f.properties }));
const convBlive = convB.filter(c => !/^(closed|converted)/.test(c.p.status));
const pp = rd(PP).features.map(f => ({ at: f.geometry.coordinates, p: f.properties }));

// ---- origins ----
const dcAll = rd(DCA4).features;
const dc = dcAll.filter(f => f.properties.site_kind !== 'cable_landing_station').map(f => ({ at: f.geometry.coordinates, p: f.properties }));
const otC = off.features.filter(f => f.properties.class === 'C').map(f => ({ at: f.geometry.coordinates, p: f.properties }));
const rural = repd.filter((_, i) => i % 5 === 0).map(r => ({ at: r.at })); // ~2,150 REPD project points: mostly rural

// ---- helpers ----
const D = (a, b) => E.distanceKm(a[0], a[1], b[0], b[1]);
function kNearest(o, set, k) { const s = set.map(x => ({ x, km: D(o, x.at) })); s.sort((a, b) => a.km - b.km); return s.slice(0, k); }
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const stats = a => ({ n: a.length, min: +q(a, 0).toFixed(2), p10: +q(a, .1).toFixed(2), p50: +q(a, .5).toFixed(2), p90: +q(a, .9).toFixed(2), max: +q(a, 1).toFixed(2) });
function dist(origins, set, label) {
  const k30 = [], in40 = [], in25 = [], in10 = [];
  for (const o of origins) { const s = set.map(x => D(o.at, x.at)).sort((a, b) => a - b);
    k30.push(s[29] ?? Infinity); in40.push(s.filter(v => v <= 40).length); in25.push(s.filter(v => v <= 25).length); in10.push(s.filter(v => v <= 10).length); }
  return { label, set_size: set.length, km_to_30th: stats(k30), count_within_40km: stats(in40), count_within_25km: stats(in25), count_within_10km: stats(in10),
    share_with_30_within_40km: +(in40.filter(v => v >= 30).length / origins.length).toFixed(3),
    share_with_fewer_than_5_within_40km: +(in40.filter(v => v < 5).length / origins.length).toFixed(3) };
}

const R = { inputs: {
  sld_cartridge: { path: SLD, sha256: sha(SLD) }, si_cartridge: { path: SI, sha256: sha(SI) },
  grid_substations: { path: SUBS, sha256: sha(SUBS), features: subFc.features.length, qualifying_33kv: subs.length },
  repd_master: { path: REPD, sha256: sha(REPD), features: repdFc.features.length, usable_points: repd.length, sites_4dp: repdSites.length },
  offtakers: { path: OFF, sha256: sha(OFF), classB: convB.length, classB_not_closed_or_converted: convBlive.length, classC: otC.length },
  power_plants: { path: PP, sha256: sha(PP), features: pp.length },
  dc_a4: { path: DCA4, sha256: sha(DCA4), features: dcAll.length, data_centres_excl_cls: dc.length } } };

// 1. can nearestSubstations return 30? (cap is LINK_COUNT=5, closure const)
const maxLen = Math.max(...dc.map(o => E.nearestSubstations(o.at[0], o.at[1], subs).length));
R.q1_nearestSubstations_max_length_over_dc_origins = maxLen;

// parity: gridScope.scope(..., {bandsKm:[40], nearestCount:30}) first 5 == nearestSubstations (same items, same order, same km)
let parityOk = 0, parityBad = [];
const allO = [...dc, ...otC, ...rural];
for (const o of allO) {
  const a = E.nearestSubstations(o.at[0], o.at[1], subs);
  const b = E.gridScope.scope(o.at, subs, { bandsKm: [40], nearestCount: 30 }).nearest;
  const same = a.length === Math.min(5, b.length) && a.every((x, i) => x.at === b[i].at && x.km === b[i].km);
  same ? parityOk++ : parityBad.push(o.p?.id || o.at);
}
R.parity_gridScope_vs_nearestSubstations = { origins: allO.length, identical_first5: parityOk, mismatches: parityBad.slice(0, 10) };

// independent haversine check of the 30-list (R=6371.0088 mean radius, asin form) - membership only
const hv = (a, b) => { const r = Math.PI / 180, dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2; return 2 * 6371.0088 * Math.asin(Math.sqrt(h)); };
let indOk = 0; for (const o of dc) { const a = E.gridScope.scope(o.at, subs, { bandsKm: [40], nearestCount: 30 }).nearest.map(x => x.at);
  const b = subs.map(s => ({ s, km: hv(o.at, s.at) })).filter(x => x.km <= 40 * 6371.0088 / 6378.137).sort((x, y) => x.km - y.km).slice(0, 30).map(x => x.s.at);
  if (a.length === b.length && a.every((x, i) => x === b[i])) indOk++; }
R.independent_haversine_same_30_in_order = `${indOk}/${dc.length} data-centre origins`;

// 2. distributions
R.distribution = {
  substations_vs_dc: dist(dc, subs, 'substations >=33 kV, DC-A4 data centres'),
  substations_vs_rural: dist(rural, subs, 'substations >=33 kV, rural proxy (every 5th REPD point)'),
  substations132_vs_rural: dist(rural, subs.filter(s => s.kv[0] >= 131.5), 'substations >=132 kV, rural proxy'),
  repd_sites_vs_dc: dist(dc, repdSites, 'REPD sites, DC-A4 data centres'),
  repd_sites_vs_rural: dist(rural, repdSites, 'REPD sites, rural proxy'),
  convB_vs_dc: dist(dc, convBlive, 'conventional (offtakers class B, not closed/converted), DC-A4 data centres'),
  convB_vs_rural: dist(rural, convBlive, 'conventional class B, rural proxy'),
  pp_vs_dc: dist(dc, pp, 'atlas power_plants (gas/nuclear only), DC-A4 data centres') };

// 3. timing per tap (warm), 30/30/30
const time = (fn, n) => { for (let i = 0; i < 20; i++) fn(i); const t = performance.now(); for (let i = 0; i < n; i++) fn(i); return +((performance.now() - t) / n).toFixed(3); };
const N = 400; const O = i => dc[i % dc.length].at;
R.timing_ms_per_tap = {
  original_nearestSubstations_5: time(i => E.nearestSubstations(O(i)[0], O(i)[1], subs), N),
  gridScope_scope_30_bands_2_5_10_25_40: time(i => E.gridScope.scope(O(i), subs, { bandsKm: [2, 5, 10, 25, 40], nearestCount: 30 }), N),
  repd_sites_30_full_sort: time(i => kNearest(O(i), repdSites, 30), N),
  conventional_30_full_sort: time(i => kNearest(O(i), convBlive, 30), N),
  all_three: time(i => { E.gridScope.scope(O(i), subs, { bandsKm: [40], nearestCount: 30 }); kNearest(O(i), repdSites, 30); kNearest(O(i), convBlive, 30); }, N) };
R.timing_note = 'node ' + process.version + ', warm, mean of ' + N + ' taps; a mid-range phone is typically 4-8x slower';

// 4. GeoJSON for 90 lines (+ 90 end nodes + pin)
const o = dc.find(d => /slough/i.test(d.p.name || '')) || dc[0];
const sN = E.gridScope.scope(o.at, subs, { bandsKm: [40], nearestCount: 30 }).nearest;
const rN = kNearest(o.at, repdSites, 30), cN = kNearest(o.at, convBlive, 30);
const r5 = v => Math.round(v * 1e5) / 1e5;
const feats = [];
const add = (kind, i, at, km, label) => { feats.push({ type: 'Feature', properties: { k: kind, r: i, km: +km.toFixed(2) }, geometry: { type: 'LineString', coordinates: [[r5(o.at[0]), r5(o.at[1])], [r5(at[0]), r5(at[1])]] } });
  feats.push({ type: 'Feature', properties: { k: kind, r: i, label }, geometry: { type: 'Point', coordinates: [r5(at[0]), r5(at[1])] } }); };
sN.forEach((s, i) => add('s', i, s.at, s.km, `${s.km.toFixed(1)} km · ${s.kv} kV`));
rN.forEach((s, i) => add('r', i, s.x.at, s.km, `${s.km.toFixed(1)} km`));
cN.forEach((s, i) => add('c', i, s.x.at, s.km, `${s.km.toFixed(1)} km`));
const fc = { type: 'FeatureCollection', features: feats };
let json; const tB = performance.now(); for (let i = 0; i < 200; i++) json = JSON.stringify(fc); const tS = (performance.now() - tB) / 200;
R.geojson_90 = { origin: o.p.name, features: feats.length, bytes: Buffer.byteLength(json), stringify_ms: +tS.toFixed(3),
  farthest_km: { s: +sN.at(-1).km.toFixed(2), r: +rN.at(-1).km.toFixed(2), c: +cN.at(-1).km.toFixed(2) } };

// 5. Slough cluster (lead request): no cross-operator merge in the origin set
const STE = [-0.6200, 51.5230]; // Slough Trading Estate, approx centre
const sl = dc.filter(d => D(d.at, STE) <= 3); const slOT = otC.filter(d => D(d.at, STE) <= 3);
const ops = new Map(); for (const d of sl) { const k = (d.p.operator || '').trim().toLowerCase() || '(unknown:' + d.p.id + ')'; ops.set(k, (ops.get(k) || 0) + 1); }
const keys = new Set(sl.map(d => d.at.join(',')));
R.slough_cluster_3km = { dc_a4_sites: sl.length, distinct_points: keys.size, operators: Object.fromEntries(ops), offtakers_classC_sites: slOT.length,
  offtakers_merged_records: slOT.map(s => ({ id: s.p.id, name: s.p.name, records: (s.p.records || []).length })) };

fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
