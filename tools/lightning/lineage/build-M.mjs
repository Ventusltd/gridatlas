#!/usr/bin/env node
// build-M.mjs: L3 live module (202610281340) -> M0 (byte savings only, zero behaviour change) -> M (adds REPD projects).
// Every replacement must match exactly once (or the stated count). Usage: node build-M.mjs <L3 module> <outdir> [GEN]
import fs from 'node:fs';
import { const2let } from './const2let.mjs';
// A5 (applied last to each output): const -> let where scope analysis proves no reassignment; two declarations whose
// exact text the suites assert (test-engine 1271 grid path, 1457 mask loop) stay const.
const KEEP = t => t.startsWith("const u=AR+'grid/'") || t === "const c of'";
const fin = t => { const r = const2let(t, KEEP); if (r.kept !== 2) throw new Error('const2let kept ' + r.kept); return r.out; };
const [,, SRC, OUT, GEN] = process.argv;
let s = fs.readFileSync(SRC, 'utf8');
const L3GEN = '202610281340';
const once = (from, to, n = 1) => { const k = s.split(from).length - 1; if (k !== n) throw new Error(`expected ${n} x ${JSON.stringify(from.slice(0, 80))}, found ${k}`); s = s.split(from).join(to); };
const all = (from, to) => once(from, to, s.split(from).length - 1);

/* ---------- stage A: savings ---------- */
// A1 header: 4 lines -> 1 shorter line, same facts (generation, OFF by default, never persisted, not ground strikes, unknown not zero, cells)
const hEnd = s.indexOf('*/') + 3;
if (!s.startsWith('/* uk-lightning-overlay, generation ' + L3GEN)) throw new Error('header');
s = `/* uk-lightning-overlay, generation ${L3GEN} (UTC). EUMETSAT MTG LI L2-LFL optical flashes, OFF by default, never persisted; NOT confirmed ground strikes; unsearched is unknown, never zero. Long periods: ≈10 km cells within 30 km of a REPD site. */\n` + s.slice(hEnd);
// A2 whole-line // comments
const before = s.length; s = s.replace(/^\/\/.*\n/gm, ''); if (before - s.length < 1000) throw new Error('comments');
// A3 aliases: Math.max/min, Array.isArray, Date.parse (all static, no `this`), appendChild and getBoundingClientRect helpers,
//    and the phrase 'unknown, not zero'
once("const NS=(window", "const MX=Math.max,MN=Math.min,AI=Array.isArray,DP=Date.parse,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),U='unknown, not zero',NS=(window");
all('Math.max(', 'MX('); all('Math.min(', 'MN('); all('Array.isArray(', 'AI('); all('Date.parse(', 'DP(');
{ const n = s.split('.appendChild(').length - 1;
  s = s.replace(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?)\.appendChild\(/g, (m0, r) => r === 'p' ? m0 : `ap(${r},`);
  if (n < 10 || s.split('.appendChild(').length - 1 !== 1) throw new Error('ap'); }
{ s = s.replace(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\(\))?)\.getBoundingClientRect\(\)/g, (m0, r) => r === 'e' ? m0 : `gr(${r})`);
  if (s.split('.getBoundingClientRect()').length - 1 !== 1) throw new Error('gr'); }
once("FOOTER='Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5'",
  "FOOTER=`Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are ${U} · UK box −11.0,49.5 → 3.0,61.5`");
once("nz=' (unknown, not zero)'", "nz=` (${U})`");
once("r.old?'earlier days unknown, not zero':", "r.old?'earlier days '+U:");
once("nothing shown (unknown, not zero)`", "nothing shown (${U})`");
once("${x.cutoffDate}) — unknown, not zero`", "${x.cutoffDate}) — ${U}`");
once("earlier hours unknown, not zero)`", "earlier hours ${U})`");
once("': earlier coverage unknown, not zero'", "': earlier coverage '+U");
once("'Actual  none seen in the 7-day feed (unknown, not zero)'", "`Actual  none seen in the 7-day feed (${U})`");
once("'Searched EUMETSAT: shard lost (integrity alert), unknown, not zero'", "'Searched EUMETSAT: shard lost (integrity alert), '+U");
once("of window (unknown, not zero)`", "of window (${U})`");
once("(integrity alert), unknown, not zero`", "(integrity alert), ${U}`");
once("(malformed timestamp; unknown, not zero)`", "(malformed timestamp; ${U})`");
once("unsearched days unknown, not zero`", "unsearched days ${U}`");
if (s.split('unknown, not zero').length !== 2) throw new Error('phrase left');
const M0 = fin(s);
fs.writeFileSync(`${OUT}/module-M0.js`, M0);

/* ---------- stage B: REPD projects ---------- */
if (GEN) {
  // B1 project layer and source ids join the L3 neon set, so nc() (close, period, LATEST, OFF) removes them too
  once("'pin-halo','pin']", "'pin-halo','pin','p-core','p-node','p-label']");
  once("NSR=[NP+'-links',NP+'-nodes',NP+'-pin']", "NSR=[NP+'-links',NP+'-nodes',NP+'-pin',NP+'-plinks',NP+'-pnodes']");
  // B2 nr: the drawing helpers move above the "no substation" return; the frame list is S.fk; the 10 nearest REPD projects
  once("const k=M.nearestSubstations(x,y,subs);say(", "const k=M.nearestSubstations(x,y,subs),o=[x,y],TC='#d8c96a',TL='#5fbdc2',FL='#bfe9ee',Z=(a,b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},\nA=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{}));S.fk=[o,...k.map(a=>a.at)];say(");
  once(":''));return k}\nfor(const a of k)say(`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV · ${cs(a.name||'unnamed substation')}`);\n",
    ":''))}\nfor(const a of k)say(`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV · ${cs(a.name||'unnamed substation')}`);\n"
    + "const pd=say('REPD projects: loading…');RG(m,M).then(G=>{if(S.pp!==c)return;"
    + "const P=G.map(([a,p])=>({a,p,km:M.distanceKm(x,y,...a)})).filter(r=>r.km<=40).sort((a,b)=>a.km-b.km).slice(0,10),"
    + "L=r=>`${r.km.toFixed(2)} km · ${({solar:'Solar',solar_roof:'Rooftop solar'})[r.p.tech]||cs(r.p.raw_tech)}${r.p.capacity>0?` ${N(r.p.capacity)} MW`:''}`,"
    + "F=g=>({type:'geojson',data:FC(P.map(r=>({type:'Feature',properties:{mw:+r.p.capacity||0,label:L(r)},geometry:g(r)})))}),C=['interpolate',['linear'],['get','mw'],0,'#ffaa00',50,'#ff4400',200,'#f00'];\n"
    + "pd.textContent=`${P.length?pl(P.length,'nearest REPD project'):'No REPD project'} within 40 km of this ${c.wh} (straight-line; all technologies and statuses). Not evidence any project was struck or affected.`;P.length&&(c.sm.textContent+=` · ${P.length} nearest projects`);\n"
    + "for(const r of P){const p=r.p,b=el('a','display:block;padding:14px 0 13px;border-top:1px solid #1d3238;color:#ffb27a',`${L(r)} · ${cs(p.status)} · ${cs(p.name)}`);b.href=location.pathname+'?'+new URLSearchParams({longitude:r.a[0],latitude:r.a[1],technology:p.tech,project:p.name,capacity_mw:p.capacity,status:p.status});ap(c.out,b)}\n"
    + "m.addSource(NSR[3],F(r=>({type:'LineString',coordinates:[o,r.a]})));m.addSource(NSR[4],F(r=>({type:'Point',coordinates:r.a})));\n"
    + "A(9,'line',NSR[3],{'line-color':C,'line-width':Z(1,2),'line-opacity':.8,'line-dasharray':[2,2]});A(10,'circle',NSR[4],{'circle-radius':Z(3,5),'circle-color':C,'circle-stroke-width':1});\n"
    + "try{A(11,'symbol',NSR[4],{'text-color':'#ffc48a','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-font':sf(m)})}catch(e){note('neon labels: '+msg(e))}\n"
    + "cpos();S.fk.push(...P.map(r=>r.a));m.isMoving&&m.isMoving()||ck()}).catch(e=>{if(S.pp===c)pd.textContent='REPD projects unavailable: '+msg(e)});if(!k.length)return k;\n");
  once("\nconst o=[x,y],TC='#d8c96a',TL='#5fbdc2',FL='#bfe9ee',Z=(a,b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},\nA=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{}));\n", "\n");
  // B3 camera: one frame list S.fk (origin, substations, then projects), checked at moveend or when projects arrive
  once("if(k.length)nz(m,x,y,k);return}", "if(k.length)nz(m,x,y);return}");
  once("nz=(m,x,y,k)=>{try{m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});const ck=()=>{const v=m.getBounds&&m.getBounds();if(!v||S.pp===null||k.every(a=>v.contains(a.at)))return;let w=x,s=y,e=x,n=y;for(const[a,o]of k.map(a=>a.at)){w=MN(w,a);e=MX(e,a);s=MN(s,o);n=MX(n,o)}\n"
    + "m.fitBounds([[w,s],[e,n]],{padding:{top:150,left:40,right:40,bottom:(S.pp.bb+S.pp.offsetHeight||196)+24},maxZoom:12,duration:900})};typeof m.once=='function'?m.once('moveend',ck):ck()}catch(e){note('camera: '+msg(e))}},",
    "nz=(m,x,y)=>{try{m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});typeof m.once=='function'?m.once('moveend',ck):ck()}catch(e){note('camera: '+msg(e))}},\n"
    + "ck=()=>{try{const m=mh(),v=m&&m.getBounds&&m.getBounds(),k=S.fk;if(!v||!S.pp||k.every(a=>v.contains(a)))return;let[w,s]=k[0],[e,n]=k[0];for(const[a,o]of k){w=MN(w,a);e=MX(e,a);s=MN(s,o);n=MX(n,o)}\n"
    + "m.fitBounds([[w,s],[e,n]],{padding:{top:150,left:40,right:40,bottom:(S.pp.bb+S.pp.offsetHeight||196)+24},maxZoom:12,duration:900})}catch(e){note('camera: '+msg(e))}},\n"
    // B4 the register: the engine's src-repd data once a REPD layer has loaded it, else the engine's own URL through the bridge
    + "RG=(m,M)=>S.rg||(S.rg=(async()=>{let f;try{f=m.getSource('src-repd').serialize().data.features}catch(_){}if(!(f&&f.length)){let r=await fetch('/dist/repd_master.json');r.ok||E('HTTP '+r.status);f=(await r.json()).features}"
    + "const o=f.map(x=>[M.representativePoint(x.geometry),x.properties||{}]).filter(([a,p])=>a&&M.isProjectTech(p.tech));return o.length?o:E('register empty')})().catch(e=>{S.rg=null;throw e})),");
  s = s.replace(`generation ${L3GEN}`, `generation ${GEN}`).replace(`GEN='${L3GEN}'`, `GEN='${GEN}'`);
  if (!s.includes(`GEN='${GEN}'`) || !s.includes(`generation ${GEN}`)) throw new Error('stamp');
  s = fin(s);
  fs.writeFileSync(`${OUT}/module-M.js`, s);
}
const b = x => Buffer.byteLength(x);
console.log(JSON.stringify({ L3: b(fs.readFileSync(SRC, 'utf8')), M0: b(M0), M: GEN ? b(s) : null, cap: 44781, cartridge_M: GEN ? 435218 + 1 + b(s) : null }));
