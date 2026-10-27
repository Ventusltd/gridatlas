// kv-elements: bind Lightning's nearest-substation family to the canonical elements.
// Usage: node make-patch.mjs <in.js> <out.js>
import { readFileSync, writeFileSync } from 'node:fs';
const [,, IN, OUT] = process.argv;
let s = readFileSync(IN, 'utf8');
const rep = (a, b) => { if (s.split(a).length !== 2) throw new Error('anchor not unique: ' + a.slice(0, 60)); s = s.replace(a, () => b); };

// 1. card position: a docked card (canonical dockAsSheet, family:8489) is not re-anchored to the flash
rep("cpos=()=>{const c=S.pp,m=mh();if(!c||!m)return;", "cpos=()=>{const c=S.pp,m=mh();if(!c||!m||c.dk)return;");

// 2. measurement: bind to link.measure.nearestSubstations (family:64149; 33 kV+, LINK_COUNT 5, MAX_LINK_KM 40, beyondRadiusNearest)
rep("NL=[NEAR+'-glow',NEAR+'-core',NEAR+'-node',NEAR+'-label'],", "NL=[NEAR+'-glow',NEAR+'-core',NEAR+'-node',NEAR+'-label',NEAR+'-origin'],");
rep("subs=L.substations||window.__GRIDATLAS_SUBSTATIONS__||[],dk=L.measure&&L.measure.distanceKm,",
    "subs=L.substations||window.__GRIDATLAS_SUBSTATIONS__||[],ns=L.measure&&L.measure.nearestSubstations,");
rep("if(!subs.length||typeof dk!=='function')", "if(!subs.length||typeof ns!=='function')");
rep("const k=subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv)&&s.kv[0]>=132).map(s=>({s,km:dk(x,y,s.at[0],s.at[1])})).filter(a=>isFinite(a.km)).sort((a,b)=>a.km-b.km).slice(0,3);",
    "const r=ns(x,y,subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv))),k=r.map(s=>({s,km:s.km})),far=r.beyondRadiusNearest;");
rep("if(!k.length)return say('No transmission substation (132 kV or above) in the published list.');",
    "if(!k.length)return say(far?`None within ${r.radiusKm} km, so no line is drawn; nearest mapped: ${far.km.toFixed(2)} km · ${far.kv[0]} kV · ${far.name||'unnamed substation'}`:'No substation (33 kV or above) in the published list.');");

// 3. drawing: origin ring with setPin's paint (family:8534); nodes/labels exclude the origin point
rep("const F=[];k.forEach(", "const F=[{type:'Feature',properties:{r:1},geometry:{type:'Point',coordinates:[x,y]}}];k.forEach(");
rep("PT=['==',['geometry-type'],'Point'];", "PT=['all',['==',['geometry-type'],'Point'],['!',['has','r']]];");
rep("catch(e){note('nearest labels: '+msg(e))}},near=(m,c,x,y)=>{nr(m,c,x,y);cpos()},",
    "catch(e){note('nearest labels: '+msg(e))}"
    + "m.addLayer({id:NL[4],type:'circle',source:NEAR,filter:['has','r'],paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,11,14,26],'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#cfe9ed','circle-stroke-width':1.6,'circle-stroke-opacity':0.85}});"
    // 4. card docks at the foot of the map (dockAsSheet) and the camera frames flash + links above it (drawLinks framing, arrival zoom 12)
    + "c.dk=1;Object.assign(c.style,{left:'50%',top:'auto',bottom:'8px',maxHeight:'38%'});"
    + "let a=x,b=y,e=x,d=y;for(const q of k){a=Math.min(a,q.s.at[0]);b=Math.min(b,q.s.at[1]);e=Math.max(e,q.s.at[0]);d=Math.max(d,q.s.at[1])}"
    + "try{m.fitBounds([[a,b],[e,d]],{padding:{top:90,left:40,right:40,bottom:(c.offsetHeight||0)+24},maxZoom:12,duration:600,essential:true})}catch(err){note(err)}},"
    + "near=(m,c,x,y)=>{nr(m,c,x,y);cpos()},");
writeFileSync(OUT, s);
console.log(JSON.stringify({ in_bytes: Buffer.byteLength(readFileSync(IN, 'utf8')), out_bytes: Buffer.byteLength(s) }));
