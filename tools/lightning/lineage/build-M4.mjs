// build-M4.mjs: Build M3 module (202610282215, as on main) -> M4 module. Every replacement is exact-once against the M3 bytes.
// M2R-taps MAJOR M2R-T1: a camera move started while the previous one was still running made MapLibre's stop() fire the
// pending once('moveend',ck) synchronously, so ck's fitBounds ran NESTED inside the new move; the outer move then left an
// orphan render frame and the map stopped drawing after a few fast row -> back cycles (latent in L3 for quick re-taps).
// Fix: (1) every module camera move first drops the module's pending framing (cm: m.off('moveend',cw)): nz (tap, row,
// back), ck's own fitBounds (details toggle, minimise), RpR's register-lands-mid-move framing, the cluster easeTo, and the
// fit button; (2) the pending framing itself (cw) runs after the stop that fired it has returned (a microtask), and only
// when the map is then not moving, so a camera move by anyone else (engine popup, search, a gesture) is never nested or
// overridden either.
// Review fixes from reports/M2R-camera.md and reports/M2R-l3regress.md are applied by tools/fixes-m4.mjs if present.
// usage: node build-M4.mjs <module-M3.js> <out.js>
import fs from 'node:fs';
const [, , IN, OUT] = process.argv;
let s = fs.readFileSync(IN, 'utf8'); const b0 = Buffer.byteLength(s), log = [];
const once = (id, a, b) => { const k = s.split(a).length - 1; if (k !== 1) throw new Error(id + ' found ' + k); const n0 = Buffer.byteLength(s); s = s.replace(a, () => b); log.push([id, Buffer.byteLength(s) - n0]); };

once('header', '/* M3: the original REPD map layers',
  '/* M4: a module camera move never starts inside another (MapLibre fires moveend synchronously from stop()): the pending framing is dropped before each own move and otherwise runs after the stop that fired it, only when the map is not moving. */\n/* M3: the original REPD map layers');
// (1) nz: drop the pending framing, fly, queue the deferred framing
once('nz', "nz=(m,x,y)=>{try{m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});typeof m.once=='function'?m.once('moveend',ck):ck()}",
  "cw=()=>Promise.resolve().then(()=>{let m=mh();m&&!(m.isMoving&&m.isMoving())&&ck()}),cm=m=>m.off&&m.off('moveend',cw),\nnz=(m,x,y)=>{try{cm(m);m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});typeof m.once=='function'?m.once('moveend',cw):ck()}");
// ck's own fitBounds (forced by the details toggle / minimise while a flight runs)
once('ck', 'm.fitBounds([[w,s],[e,n]],{padding:{top:150', 'cm(m);m.fitBounds([[w,s],[e,n]],{padding:{top:150');
// RpR: a register that lands mid-move is framed when that move ends (deferred, one pending at most)
once('rpr', "m.isMoving&&m.isMoving()?m.once('moveend',ck):ck()}", "m.isMoving&&m.isMoving()?(cm(m),m.once('moveend',cw)):ck()}");
// the cluster zoom and the fit button are camera moves too
once('cluster', 'let go=z=>m.easeTo({center:f.geometry.coordinates,zoom:z})', 'let go=z=>(cm(m),m.easeTo({center:f.geometry.coordinates,zoom:z}))');
once('fit', 'm.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:9})}', 'cm(m);m.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:9})}');

let fixesUrl = new URL('fixes-m4.mjs', import.meta.url);
if (fs.existsSync(fixesUrl)) { const { fixes } = await import(fixesUrl); fixes(once); }
if (/\bm\.once\('moveend',ck\)/.test(s)) throw new Error('an undeferred moveend framing remains');
fs.writeFileSync(OUT, s);
const n = Buffer.byteLength(s);
console.log(JSON.stringify({ from: b0, to: n, deltas: log, cap: 64781, spare: 64781 - n, cartridge: 435219 + n, cartridgeSpare: 500000 - 435219 - n }));
