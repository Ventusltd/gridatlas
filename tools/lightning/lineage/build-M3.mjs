// build-M3.mjs: Build M2 module (202610282100, as published on main) -> M3 module.
// Owner, 28 Oct 2026 21:39 UTC: "Can we auto activate the REPD layers of the targeted 10 nearest projects?"
// Every replacement is exact-once against the M2 bytes. The layer bookkeeping lives in tools/layers-m3.part.js.
// Review fixes from reports/M2R-*.md are applied by tools/fixes-m3.mjs (exported `fixes(once, cut)`), if present.
// usage: node build-M3.mjs <module-M2.js> <out.js>
import fs from 'node:fs';
const [, , IN, OUT] = process.argv;
let s = fs.readFileSync(IN, 'utf8'); const b0 = Buffer.byteLength(s), log = [];
const once = (id, a, b) => { const k = s.split(a).length - 1; if (k !== 1) throw new Error(id + ' found ' + k); const n0 = Buffer.byteLength(s); s = s.replace(a, () => b); log.push([id, Buffer.byteLength(s) - n0]); };
const cut = (id, from, to, b) => { const i = s.indexOf(from), j = s.indexOf(to, i); if (i < 0 || j < 0 || s.indexOf(from, i + 1) >= 0) throw new Error(id); const n0 = Buffer.byteLength(s); s = s.slice(0, i) + b + s.slice(j); log.push([id, Buffer.byteLength(s) - n0]); };

once('header', 'with "◀ back" to the lightning card. Distance only: never "affected". */',
  'with "◀ back" to the lightning card. Distance only: never "affected". */\n/* M3: the original REPD map layers of the listed technologies are switched on through their own Layers checkboxes, and only those M3 switched on are switched off again on close, lightning OFF, a period change, LATEST or a new list. */');
// the REPD block (M2's RG … RpV) is replaced by the M3 block: the layer bookkeeping (tools/layers-m3.part.js) and the REPD
// card with the M2 review fixes folded in (tools/repd-m3.part.js; see reports/M3-build.md for each finding)
cut('repd', '/* ---- REPD projects near a tap (M2)', 'BTN=(a,t,x)=>', fs.readFileSync(new URL('layers-m3.part.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('repd-m3.part.js', import.meta.url), 'utf8'));
// M2R-repd R2: the header says what the grouping does
once('hdr-group', '40 km; co-located parts grouped;', '40 km; projects at one point grouped;');
// M2R-a11y MAJOR-1: one visually hidden polite status region per card, outside the closed <details>
once('a11y-live', 'ap(c,bar);ap(c,bd);S.pp=c;', "ap(c,bar);ap(c,bd);c.lv=ap(c,el('div','position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)'));c.lv.setAttribute('role','status');S.pp=c;");
// M2R-a11y MINOR-1: the back control's name without the ◀ glyph
once('a11y-back', "k.dataset.lightningBack='';", "k.dataset.lightningBack='';k.setAttribute('aria-label',o.back[0].slice(2));");
// M2R-words W10: next to the REPD summary, say what is not within 40 km
once('w10', '` · none within ${k.radiusKm||40} km`', '` · no substation within ${k.radiusKm||40} km`');
// M2R-layout F1 (MAJOR-1): an open card never rises above the container top + 320 px (at least 240 px tall), so the origin
// band stays visible
once('layout-f1', "c.style.maxHeight=MX(44,k.height-t-b)+'px'", "c.style.maxHeight=MX(44,MN(k.height-t-b,MX(240,k.height-b-320)))+'px'");
// M2R-layout F2 (MAJOR-2, MINOR-3): refit when any point is outside the visible band (x 20..W-20, y 130..card top-24), not only
// outside the map, or when forced; M2R-diff MD1: the bottom padding is capped at H-270 only when L3's fit is impossible
once('layout-f2', 'ck=()=>{try{let m=mh(),v=m&&m.getBounds&&m.getBounds(),k=S.fk;if(!v||!S.pp||k.every(a=>v.contains(a)))return;',
  'ck=f=>{try{let m=mh(),c=S.pp,k=S.fk,C=m&&m.getContainer(),H=C&&C.clientHeight||1e4,B=c&&(c.bb+c.offsetHeight||196)+24;if(!c||!k||f!==1&&k.every(a=>{let p=m.project(a);return p.x>=20&&p.x<=(C.clientWidth||1e4)-20&&p.y>=130&&p.y<=H-B}))return;');
once('layout-f2b', 'bottom:MN((S.pp.bb+S.pp.offsetHeight||196)+24,MX(0,(m.getContainer().clientHeight||1e4)-270))}', 'bottom:H-150>B?B:MX(0,H-270)}');
// M2R-layout F3: re-frame when the card is expanded, collapsed or minimised
once('layout-f3', "bd=el('div','padding:0 8px 6px'),d=el('details'),", "bd=el('div','padding:0 8px 6px'),d=el('details'),rf=()=>{cpos();if(S.pp===c)ck(1)},");
once('layout-f3b', "mn.setAttribute('aria-expanded',o);cpos()});", "mn.setAttribute('aria-expanded',o);rf()});d.addEventListener('toggle',rf);");
// M2R-layout MINOR-4: 11 px, not 10 px (detail line, footer; the REPD block's chip labels and part lines in repd-m3.part.js)
once('layout-11a', "ap(d,el('div','color:#8b9aa1;font-size:10px;overflow-wrap:anywhere',de));", "ap(d,el('div','color:#8b9aa1;font-size:11px;overflow-wrap:anywhere',de));");
once('layout-11b', "ap(bd,el('div','color:#8b9aa1;font-size:10px',o.foot||", "ap(bd,el('div','color:#8b9aa1;font-size:11px',o.foot||");
// close (×), a tap on empty map, period / page / custom / LOAD POINTS (ld without refresh), LATEST, lightning OFF
once('close', "B('×','Close',pc)", "B('×','Close',()=>{pc();Ry()})");
once('tap-empty', 'return f&&cc(m,f)}', 'return f?cc(m,f):Ry()}');
once('ld', 'ld=refresh=>{if(!refresh)pc();', 'ld=refresh=>{if(!refresh)pc(),Ry();');
once('latest', 'S.end=null;S.h=[];pc();return ld(true)', 'S.end=null;S.h=[];pc();Ry();return ld(true)');
once('off', 'else{S.serial++;S.res=null;cx();', 'else{S.serial++;S.res=null;cx();Ry();');
// a user tick/untick of a layer M3 holds hands it to the user (M3's own dispatch runs with S.lyx set)
once('bt', "bt=c=>c.addEventListener('change',ev=>{let t=ev.target;if(t&&t.dataset&&t.dataset.lightningControl==='toggle')so(!!t.checked)})",
  "bt=c=>c.addEventListener('change',ev=>{let t=ev.target,d=t&&t.dataset;if(!d)return;if(d.lightningControl==='toggle')so(!!t.checked);else if(!S.lyx&&S.ly)S.ly.delete(d.layerId)})");

let fixesUrl = new URL('fixes-m3.mjs', import.meta.url);
if (fs.existsSync(fixesUrl)) { const { fixes } = await import(fixesUrl); fixes(once, cut); }
fs.writeFileSync(OUT, s);
const n = Buffer.byteLength(s);
console.log(JSON.stringify({ from: b0, to: n, deltas: log, cap: 64781, spare: 64781 - n, cartridge: 435219 + n, cartridgeSpare: 500000 - 435219 - n }));
