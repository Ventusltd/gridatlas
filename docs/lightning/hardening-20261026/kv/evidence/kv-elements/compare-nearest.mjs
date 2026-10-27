// kv-elements: Lightning's nearest list (module line 157) vs the cartridge's canonical
// link.measure.nearestSubstations (cartridge 3513-3541), both on the cartridge's own geodesy module.
import fs from 'node:fs'; import vm from 'node:vm';
const [,, cartPath, geoPath, subsPath, feedPath] = process.argv;
const cart = fs.readFileSync(cartPath, 'utf8').split('\n');
const win = {}; vm.runInNewContext(fs.readFileSync(geoPath, 'utf8'), { window: win, Object, Math, Number, Array });
const GEODESY = win.__GRIDATLAS_MODULES__.geodesy;
const src = l => cart.slice(l[0]-1, l[1]).join('\n');
const ctx = { GEODESY, MIN_KV: 33, LINK_COUNT: 5, MAX_LINK_KM: 40, Math, Number, String, Array, Infinity };
vm.runInNewContext(src([3299,3301]) + src([3338,3366]) + src([3513,3541]) + '\nthis.f={distanceKm,voltagesKv,representativePoint,nearestSubstations}', ctx);
const { distanceKm, voltagesKv, representativePoint, nearestSubstations } = ctx.f;
// loadSubstations (3486-3499) shape
const subs = [];
for (const f of JSON.parse(fs.readFileSync(subsPath)).features) {
  const kv = voltagesKv(f.properties); if (!kv.length || Math.max(...kv) < 32.5) continue;
  const at = representativePoint(f.geometry); if (!at) continue;
  subs.push({ at, kv: kv.filter(v => v >= 32.5).sort((a,b)=>b-a), name: f.properties?.name || '' });
}
// Lightning module line 157, verbatim logic
const lightning = (x,y) => subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv)&&s.kv[0]>=132).map(s=>({s,km:distanceKm(x,y,s.at[0],s.at[1])})).filter(a=>isFinite(a.km)).sort((a,b)=>a.km-b.km).slice(0,3);
const mpp = (lat,z) => 78271.517 * Math.cos(lat*Math.PI/180) / 2**z; // m per CSS px, 512 tiles
const feed = JSON.parse(fs.readFileSync(feedPath)).features.filter(f=>f.geometry?.type==='Point');
const step = Math.max(1, Math.floor(feed.length/8)); const rows=[];
for (let i=0;i<feed.length && rows.length<8;i+=step) {
  const [x,y] = feed[i].geometry.coordinates;
  const L = lightning(x,y), C = nearestSubstations(x,y,subs);
  rows.push({ flash:[+x.toFixed(3),+y.toFixed(3)],
    lightning: L.map(a=>`${a.km.toFixed(2)} km · ${a.s.kv[0]} kV`),
    canonical: C.map(a=>`${a.km.toFixed(2)} km · ${a.kv[0]} kV`),
    canonical_beyond: C.beyondRadiusNearest ? `${C.beyondRadiusNearest.km.toFixed(2)} km (beyond ${C.radiusKm} km)` : null,
    lightning_nearest_px_z6: L[0] ? +(L[0].km*1000/mpp(y,6)).toFixed(1) : null,
    lightning_nearest_px_z12: L[0] ? +(L[0].km*1000/mpp(y,12)).toFixed(0) : null });
}
console.log(JSON.stringify({ substations_qualifying: subs.length, ge132: subs.filter(s=>s.kv[0]>=132).length, ge400: subs.filter(s=>s.kv[0]>=400).length, geo_radius: GEODESY.EARTH_RADIUS_KM, rows }, null, 1));
