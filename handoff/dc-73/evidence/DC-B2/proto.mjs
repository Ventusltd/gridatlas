// DC-B2 node prototype: 30/30/30 around every data-centre site in the pinned offtakers file.
// Usage: node proto.mjs <grid_substations.geojson> <repd_master.json> <offtakers_filtered.geojson>
// No browser. Measures distances, camera zoom at 393x852, label load, CSV bytes, compute time, palette distances.
import fs from 'node:fs';
const [SUBF, REPDF, OTF] = process.argv.slice(2);
const J = f => JSON.parse(fs.readFileSync(f));
const R = 6371.0088, rad = Math.PI / 180;
const hv = (a, b) => { const p1 = a[1]*rad, p2 = b[1]*rad, h = Math.sin((p2-p1)/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin((b[0]-a[0])*rad/2)**2; return 2*R*Math.asin(Math.sqrt(h)); };
const rp = g => { if (!g) return null; if (g.type === 'Point') return g.coordinates.slice(0, 2); const r = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null; if (!r?.length) return null; let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x/r.length, y/r.length]; };
const vk = p => { const o = []; for (const t of String(p?.voltage ?? '').split(/[;,|:\s]+/)) { const v = Number(t); if (t && Number.isFinite(v) && v > 0) o.push(v/1000); } return o; };
const PT = new Set(['solar','solar_operational','solar_roof','bess','bess_operational','wind','wind_onshore','wind_onshore_operational','wind_offshore','wind_offshore_operational','biomass','hydro','hydrogen','tidal','geothermal','flywheel','caes','act','other']);

// substations: the engine's own qualifying list (>= 33 kV, representative point)
const subs = [];
for (const f of J(SUBF).features) { const kv = vk(f.properties); if (!kv.length || Math.max(...kv) < 32.5) continue; const at = rp(f.geometry); if (!at) continue; subs.push({ at, kv: kv.filter(v => v >= 32.5).sort((a, b) => b - a), name: f.properties?.name || '' }); }
// REPD: project techs, grouped by point within ~10 m (5 dp), as the offtakers card groups sites
const rg = new Map();
for (const f of J(REPDF).features) { const p = f.properties || {}; if (!PT.has(p.tech)) continue; const at = rp(f.geometry); if (!at || (at[0] === -7.55716 && at[1] === 49.766807)) continue; const k = at[0].toFixed(4) + ',' + at[1].toFixed(4); (rg.get(k) || rg.set(k, { at, parts: [] }).get(k)).parts.push(p); }
const repd = [...rg.values()];
// conventional proxy: offtakers class B (GPPD/NAEI power stations) until the step-5 dataset (DUKES 5.11 / GPPD) lands
const ot = J(OTF).features;
const conv = ot.filter(f => f.properties.class === 'B').map(f => ({ at: f.geometry.coordinates.slice(0, 2), p: f.properties }));
const dcs = ot.filter(f => f.properties.class === 'C').map(f => ({ at: f.geometry.coordinates.slice(0, 2), p: f.properties }));

const nearest = (o, arr, n, cap) => { const s = []; for (const a of arr) { const km = hv(o, a.at); if (km <= cap) s.push({ a, km }); } s.sort((x, y) => x.km - y.km); return s.slice(0, n); };
const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + .5))] : NaN; };
const f1 = v => Number.isFinite(v) ? v.toFixed(1) : 'n/a';

// camera: site held at the centre of the free map band; zoom so radius r km fits half the band's short side.
// Band at 393x852 with the card in its peek state (232 px) docked 8 px from the bottom: top inset 150 (ck T),
// bottom inset 8+232+24 = 264, sides 40 -> band 313 x 438 px; limiting half-size 156 px. MapLibre: 512 px tiles.
const BAND_HALF = 156, zoomFor = (km, lat) => Math.log2(78271.517 * Math.cos(lat*rad) * BAND_HALF / (km*1000));
const clampZ = z => Math.max(7.5, Math.min(13, z));

const rows = [], t0 = process.hrtime.bigint();
const CAPS = { sub: 40, repd: 40, conv: 40 };
for (const d of dcs) {
  const S = nearest(d.at, subs, 30, CAPS.sub), Rp = nearest(d.at, repd, 30, CAPS.repd), C = nearest(d.at, conv, 30, CAPS.conv);
  const Cu = nearest(d.at, conv, 30, 1e4); // uncapped, to show what "30 nearest" costs for conventional
  const byV = {}; for (const b of [400, 275, 132, 33]) { const h = nearest(d.at, subs.filter(s => s.kv[0] >= b && (b === 33 ? s.kv[0] < 132 : b === 132 ? s.kv[0] < 275 : b === 275 ? s.kv[0] < 400 : true)), 1, 1e4)[0]; byV[b] = h ? h.km : null; }
  const within = (L, r) => L.filter(x => x.km <= r).length;
  const rn10 = Math.max(S[9]?.km ?? S.at(-1)?.km ?? 0, Rp[9]?.km ?? Rp.at(-1)?.km ?? 0, C[9]?.km ?? C.at(-1)?.km ?? 0);
  const d30 = [...S.slice(0,10), ...Rp.slice(0,10), ...C.slice(0,10)].map(x => x.km), rp80 = q(d30, .8), rsr = Math.max(S[9]?.km ?? S.at(-1)?.km ?? 0, Rp[9]?.km ?? Rp.at(-1)?.km ?? 0, C[0]?.km ?? 0);
  const all = [...S, ...Rp, ...C].map(x => x.km), r90 = q(all, .9), rmax = Math.max(0, ...all);
  rows.push({ name: d.p.name || d.p.id, lat: d.at[1], s: S.length, r: Rp.length, c: C.length, s10: S[9]?.km, s30: S[29]?.km, r10: Rp[9]?.km, r30: Rp[29]?.km, c10: C[9]?.km, cu30: Cu[29]?.km, cu1: Cu[0]?.km,
    w: [5, 10, 20].map(k => [within(S, k), within(Rp, k), within(C, k)]), byV,
    z10: clampZ(zoomFor(Math.max(rn10, 2), d.at[1])), z80: clampZ(zoomFor(Math.max(rp80, 2), d.at[1])), zsr: clampZ(zoomFor(Math.max(rsr, 2), d.at[1])), rp80, rsr, z90: clampZ(zoomFor(Math.max(r90, 2), d.at[1])), zmax: clampZ(zoomFor(Math.max(rmax, 2), d.at[1])), rmax, r90, rn10 });
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
const out = [];
const P = (...a) => out.push(a.join(' '));
P(`inputs: ${subs.length} qualifying substations (>=33 kV), ${repd.length} REPD sites (${[...rg.values()].reduce((s, g) => s + g.parts.length, 0)} projects), ${conv.length} conventional-proxy sites (offtakers class B), ${dcs.length} data-centre sites (offtakers class C)`);
P(`compute: ${ms.toFixed(1)} ms for ${dcs.length} taps (3 brute-force scans each) = ${(ms/dcs.length).toFixed(2)} ms per tap in node`);
const col = k => rows.map(r => r[k]).filter(v => v != null && Number.isFinite(v));
for (const [k, lab] of [['s10','10th substation km'],['s30','30th substation km'],['r10','10th REPD site km'],['r30','30th REPD site km'],['c10','10th conventional km (40 km cap)'],['cu1','nearest conventional km'],['cu30','30th conventional km (no cap)'],['rmax','farthest of all drawn (40 km cap)'],['r90','P90 radius of 90 drawn'],['rn10','radius of nearest-10 x3'],['rp80','P80 radius of the 30 drawn (10 per set)'],['rsr','framing radius: 10th sub,10th REPD,1st conv']])
  P(`${lab.padEnd(36)} median ${f1(q(col(k), .5))}  P90 ${f1(q(col(k), .9))}  max ${f1(Math.max(...col(k)))}  (n=${col(k).length})`);
P(`sites with <30 substations within 40 km: ${rows.filter(r => r.s < 30).length}; <30 REPD sites: ${rows.filter(r => r.r < 30).length}; <30 conventional within 40 km: ${rows.filter(r => r.c < 30).length} (median count ${q(rows.map(r => r.c), .5)})`);
P(`sites whose 30th substation is beyond 20 km: ${rows.filter(r => !(r.s30 <= 20)).length}`);
for (const [i, k] of [[0, 5], [1, 10], [2, 20]]) P(`within ${k} km (median subs/REPD/conv): ${q(rows.map(r => r.w[i][0]), .5)} / ${q(rows.map(r => r.w[i][1]), .5)} / ${q(rows.map(r => r.w[i][2]), .5)}`);
for (const b of [400, 275, 132, 33]) P(`nearest ${b === 33 ? '33-66' : b} kV substation km: median ${f1(q(rows.map(r => r.byV[b]).filter(v => v != null), .5))}  P90 ${f1(q(rows.map(r => r.byV[b]).filter(v => v != null), .9))}`);
P(`camera zoom (centre-held, 156 px half-band, clamp 7.5-13): nearest-10 median ${q(col('z10'), .5).toFixed(2)} min ${Math.min(...col('z10')).toFixed(2)}; P80-of-30 median ${q(col('z80'), .5).toFixed(2)} P10 ${q(col('z80'), .1).toFixed(2)}; sub10+repd10+conv1 median ${q(col('zsr'), .5).toFixed(2)} P10 ${q(col('zsr'), .1).toFixed(2)} max ${Math.max(...col('zsr')).toFixed(2)}; P90-of-90 median ${q(col('z90'), .5).toFixed(2)} min ${Math.min(...col('z90')).toFixed(2)}; all-90 median ${q(col('zmax'), .5).toFixed(2)} min ${Math.min(...col('zmax')).toFixed(2)}`);
const lon = rows.filter(r => /london|slough|docklands/i.test(r.name)).slice(0, 1)[0], rural = [...rows].sort((a, b) => (b.s30 ?? 99) - (a.s30 ?? 99))[0];
for (const r of [lon, rural].filter(Boolean)) P(`example ${r.name}: conv-1st ${f1(r.cu1)} km; subs ${r.s} (10th ${f1(r.s10)}, 30th ${f1(r.s30)} km), REPD ${r.r} (30th ${f1(r.r30)}), conv ${r.c} within 40 (30th uncapped ${f1(r.cu30)}), zoom n10 ${r.z10.toFixed(2)} / P90 ${r.z90.toFixed(2)} / all ${r.zmax.toFixed(2)}`);

// CSV: worst case 90 rows plus REPD multi-project points expanded
const cq = v => { let s = v == null ? '' : String(v).replace(/\p{Cf}/gu, ''); if (typeof v != 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\r\n#]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
let big = 0;
for (const d of dcs.slice(0, 164)) { const L = [...nearest(d.at, subs, 30, 40).map((x, i) => ['substation', i+1, x.a.name || 'unnamed substation', '', '', '', x.a.kv[0], '', '', x.km.toFixed(2), x.a.at[0], x.a.at[1], 'OpenStreetMap as loaded by the map', 'ODbL 1.0', '']),
  ...nearest(d.at, repd, 30, 40).flatMap((x, i) => x.a.parts.map(p => ['REPD project', i+1, p.name, '', p.raw_tech || p.tech, p.status, '', p.capacity > 0 ? +p.capacity : 'not stated', '', x.km.toFixed(2), x.a.at[0], x.a.at[1], 'REPD (DESNZ) Apr 2026 map register', 'OGL v3.0', 'Apr 2026 extract'])),
  ...nearest(d.at, conv, 30, 40).map((x, i) => ['conventional', i+1, x.a.p.name, '', x.a.p.subclass, x.a.p.status, '', x.a.p.size_metric?.value ?? 'not stated', '', x.km.toFixed(2), x.a.at[0], x.a.at[1], 'GPPD / NAEI 2023', 'CC BY 4.0 / OGL v3.0', ''])];
  const s = L.map(r => r.map(cq).join(',')).join('\n'); big = Math.max(big, Buffer.byteLength(s) + 900); }
P(`CSV vicinity sheet: largest ${big} bytes across all 164 sites (rows incl. expanded REPD projects), header + 3 comment lines ~900 B`);
// map payload: 90 lines + 90 nodes as GeoJSON
const one = dcs[0]; const fc = { type: 'FeatureCollection', features: [...nearest(one.at, subs, 30, 40), ...nearest(one.at, repd, 30, 40), ...nearest(one.at, conv, 30, 40)].flatMap(x => [{ type: 'Feature', properties: { s: 'x', r: 1, l: 'Solar 49.9 MW · 12.34 km' }, geometry: { type: 'LineString', coordinates: [one.at, x.a.at] } }, { type: 'Feature', properties: { s: 'x', r: 1, l: 'Solar 49.9 MW · 12.34 km' }, geometry: { type: 'Point', coordinates: x.a.at } }]) };
P(`map payload for 90 links: ${Buffer.byteLength(JSON.stringify(fc))} bytes GeoJSON (90 lines + 90 nodes), 2 sources`);

// palette: CIEDE2000 between proposed set colours and the map's existing colours
const lin = c => { c /= 255; return c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4; };
const lab = h => { const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i+2), 16))); let X = (r*.4124+g*.3576+b*.1805)/.95047, Y = r*.2126+g*.7152+b*.0722, Z = (r*.0193+g*.1192+b*.9505)/1.08883; const F = t => t > 216/24389 ? Math.cbrt(t) : (24389/27*t+16)/116; [X, Y, Z] = [F(X), F(Y), F(Z)]; return [116*Y-16, 500*(X-Y), 200*(Y-Z)]; };
const de = (h1, h2) => { const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2), d = Math.PI/180, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1+C2)/2, G = .5*(1-Math.sqrt(Cm**7/(Cm**7+25**7))), A1 = a1*(1+G), A2 = a2*(1+G), c1 = Math.hypot(A1, b1), c2 = Math.hypot(A2, b2), hh = (x, y) => { const v = Math.atan2(y, x)/d; return v < 0 ? v+360 : v; }, H1 = hh(A1, b1), H2 = hh(A2, b2), dL = L2-L1, dC = c2-c1; let dh = H2-H1; if (c1*c2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; const dH = 2*Math.sqrt(c1*c2)*Math.sin(dh*d/2), Lm = (L1+L2)/2, cm = (c1+c2)/2; let Hm = H1+H2; if (c1*c2 !== 0) Hm = Math.abs(H1-H2) > 180 ? (H1+H2+360)/2 : (H1+H2)/2; const T = 1-.17*Math.cos((Hm-30)*d)+.24*Math.cos(2*Hm*d)+.32*Math.cos((3*Hm+6)*d)-.2*Math.cos((4*Hm-63)*d), dT = 30*Math.exp(-(((Hm-275)/25)**2)), RC = 2*Math.sqrt(cm**7/(cm**7+25**7)), SL = 1+.015*(Lm-50)**2/Math.sqrt(20+(Lm-50)**2), SC = 1+.045*cm, SH = 1+.015*cm*T, RT = -Math.sin(2*dT*d)*RC; return Math.sqrt((dL/SL)**2+(dC/SC)**2+(dH/SH)**2+RT*(dC/SC)*(dH/SH)); };
const EX = { lightning: ['#a066ff','#c23cff','#e01cff','#8d7fd0','#6f68a8'], repd: ['#ffcc00','#ff8a3d','#ff4444','#ff6600','#ff4400','#ffff00','#ffaa00','#ff8c00','#ff3300','#ff0000','#00ff88','#39ff14','#ff69b4','#00ffff','#00bfff','#00aaff','#88aaff'], substation: ['#5fbdc2','#bfe9ee','#2f6f75','#00ffff'], offtakers: ['#e07b39','#f2c14e','#2ec4b6','#4f86c6','#a26769','#3d7bff','#8fb4ff'], text: ['#e8eef9','#fff3a0'] };
const ALL = Object.values(EX).flat();
// search: sample sRGB cube; pick the triple maximising min(dE to existing, dE among themselves), luminance contrast >= 7:1 on black
const relL = h => { const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i+2), 16))); return .2126*r+.7152*g+.0722*b; };
const hx = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const cand = []; for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) { const h = hx(r, g, b); if ((relL(h)+.05)/.05 < 7) continue; const m = Math.min(...ALL.map(e => de(h, e))); if (m >= 12) cand.push([h, m]); }
cand.sort((a, b) => b[1]-a[1]);
P(`palette: ${cand.length} sRGB candidates (step 17) are >= 12 dE2000 from every existing map colour and >= 7:1 on black; top: ${cand.slice(0, 12).map(([h, m]) => h + ' ' + m.toFixed(1)).join(', ')}`);
const sim = (h, M) => { const c = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i+2), 16))), o = M.map(r => r[0]*c[0]+r[1]*c[1]+r[2]*c[2]), g = v => { v = Math.max(0, Math.min(1, v)); return Math.round(255*(v <= .0031308 ? 12.92*v : 1.055*v**(1/2.4)-.055)); }; return hx(...o.map(g)); };
const PROT = [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]], DEUT = [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]];
// triple search over the top 300 candidates: maximise the worst of (dE to existing, pairwise dE, pairwise dE under protan and deutan)
const sP = h => sim(h, PROT), sD = h => sim(h, DEUT), TOP = cand.slice(0, 300); let best = null;
for (let i = 0; i < TOP.length; i++) for (let j = i+1; j < TOP.length; j++) { const a = TOP[i][0], b = TOP[j][0], ab = Math.min(de(a, b), de(sP(a), sP(b)), de(sD(a), sD(b))); if (ab < 20 || (best && Math.min(TOP[i][1], TOP[j][1], ab) <= best[0])) continue;
  for (let k = j+1; k < TOP.length; k++) { const c = TOP[k][0], w = Math.min(TOP[i][1], TOP[j][1], TOP[k][1], ab, de(a, c), de(b, c), de(sP(a), sP(c)), de(sP(b), sP(c)), de(sD(a), sD(c)), de(sD(b), sD(c))); if (!best || w > best[0]) best = [w, a, b, c]; } }
P(`triple search best: ${best.slice(1).join(' ')} worst-case dE ${best[0].toFixed(1)}`);
const PROP = { substations: process.env.PS || '#f4f1ea', repd: process.env.PR || '#c6f05a', conventional: process.env.PC || '#ff7ad9' };
for (const [k, h] of Object.entries(PROP)) { const near = ALL.map(e => [e, de(h, e)]).sort((a, b) => a[1]-b[1])[0]; P(`proposed ${k} ${h}: contrast on #000 ${((relL(h)+.05)/.05).toFixed(1)}:1; nearest existing ${near[0]} dE ${near[1].toFixed(1)}`); }
const pv = Object.values(PROP); P(`proposed pairwise dE: ${pv.map((a, i) => pv.slice(i+1).map(b => a+'/'+b+' '+de(a, b).toFixed(1))).flat().join(', ')}`);
// CVD (Vienot/Brettel protan + deutan approximation) among the three set colours
for (const [n, M] of [['protan', PROT], ['deutan', DEUT]]) { const s = pv.map(h => sim(h, M)); P(`${n}: ${s.join(' ')} pairwise dE ${s.map((a, i) => s.slice(i+1).map(b => de(a, b).toFixed(1))).flat().join(', ')}`); }
fs.writeFileSync(new URL('./proto-sites.json', import.meta.url), JSON.stringify(rows.map(r => ({ name: r.name, s: r.s, r: r.r, c: r.c, s10: r.s10, s30: r.s30, r30: r.r30, cu30: r.cu30, rmax: r.rmax, z10: +r.z10.toFixed(2), z90: +r.z90.toFixed(2), zmax: +r.zmax.toFixed(2), w: r.w, byV: r.byV })), null, 0));
console.log(out.join('\n'));
