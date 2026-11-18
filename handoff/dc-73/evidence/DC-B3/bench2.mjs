// DC-B3 addendum: bbox-prefiltered search (same distanceKm, same ordering) and conventional reach.
import fs from 'node:fs'; import { performance } from 'node:perf_hooks';
const [GA, REPD, DCA4] = process.argv.slice(2);
const rd = f => JSON.parse(fs.readFileSync(f, 'utf8'));
// geodesy distance identical to the module (R 6378.137, atan2 form)
const R = 6378.137, DEG = Math.PI / 180;
const dk = (a, b) => { const dLat = (b[1] - a[1]) * DEG, dLon = (b[0] - a[0]) * DEG; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLon / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); };
const subs = rd(`${GA}/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson`).features.map(f => f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[0][0] ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0]);
const repd = rd(REPD).features.map(f => f.geometry.coordinates);
const off = rd(`${GA}/data/offtakers_filtered_202610290945.geojson`).features;
const conv = off.filter(f => f.properties.class === 'B' && !/^(closed|converted)/.test(f.properties.status)).map(f => f.geometry.coordinates);
const dc = rd(DCA4).features.filter(f => f.properties.site_kind !== 'cable_landing_station').map(f => f.geometry.coordinates);
// bbox prefilter: lat band 40/111.2 deg, lon band scaled by cos(lat); then exact distance, sort, slice
function near(o, set, k, cap) { const dLat = cap / 110.5 * 1.01, dLon = dLat / Math.cos(Math.min(89, Math.abs(o[1]) + dLat) * DEG); const out = [];
  for (let i = 0; i < set.length; i++) { const p = set[i]; if (Math.abs(p[1] - o[1]) > dLat || Math.abs(p[0] - o[0]) > dLon) continue; const km = dk(o, p); if (km <= cap) out.push([km, i]); }
  out.sort((a, b) => a[0] - b[0]); return out.slice(0, k); }
function full(o, set, k, cap) { const out = []; for (let i = 0; i < set.length; i++) { const km = dk(o, set[i]); if (km <= cap) out.push([km, i]); } out.sort((a, b) => a[0] - b[0]); return out.slice(0, k); }
let eq = 0; for (const o of dc) { const a = near(o, subs, 30, 40), b = full(o, subs, 30, 40); if (a.length === b.length && a.every((x, i) => x[1] === b[i][1])) eq++; }
const t = fn => { for (let i = 0; i < 50; i++) fn(i); const s = performance.now(); for (let i = 0; i < 1000; i++) fn(i); return +((performance.now() - s) / 1000).toFixed(3); };
const O = i => dc[i % dc.length];
const res = { bbox_equals_full_scan: `${eq}/${dc.length}`,
  ms_per_tap: { subs30_40km_bbox: t(i => near(O(i), subs, 30, 40)), repd30_40km_bbox: t(i => near(O(i), repd, 30, 40)), conv30_uncapped: t(i => full(O(i), conv, 30, Infinity)),
    all_three_bbox: t(i => { near(O(i), subs, 30, 40); near(O(i), repd, 30, 40); full(O(i), conv, 30, Infinity); }) } };
const reach = c => dc.map(o => full(o, conv, 30, Infinity).filter(x => x[0] <= c).length);
for (const c of [40, 60, 100, 150]) { const r = reach(c); res['conv_lines_within_' + c + 'km'] = { mean: +(r.reduce((a, b) => a + b, 0) / r.length).toFixed(1), all30: r.filter(v => v === 30).length + '/' + r.length }; }
console.log(JSON.stringify(res, null, 1)); fs.writeFileSync('results2.json', JSON.stringify(res, null, 1));
