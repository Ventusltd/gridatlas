import fs from 'node:fs'; import vm from 'node:vm';
const D=new URL('.',import.meta.url).pathname;
const geo=JSON.parse(fs.readFileSync(D+'data/grid_substations.geojson','utf8'));
const ctx=vm.createContext({window:{},Math,Number,String,Array,Object,Set,isFinite});
vm.runInContext(fs.readFileSync(D+'data/geodesy.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(D+'extracted-cartridge-fns.js','utf8'),ctx);const C=ctx.__x;
const subs=geo.features.map(f=>({at:C.representativePoint(f.geometry),kv:C.voltagesKv(f.properties).filter(v=>v>=32.5).sort((a,b)=>b-a),name:f.properties.name||''})).filter(s=>s.at&&s.kv.length);
const eng=await import(D+'engine-repo/engine/lightning-click-context.js');
const e=eng.createLightningContextEngine({substations:geo.features});
let mism=0,n=0;
for(const [lat,lon] of [[51.899,-0.313],[55.374,-4.212],[51.5,-1.3],[57.9,-1.0]]){
 const f={type:'Feature',id:'x',geometry:{type:'Point',coordinates:[lon,lat]},properties:{observation_kind:'optical_lightning_flash',time_utc:'2026-10-27T12:00:00Z'}};
 const L=e.selectFlash(f,{minimumKv:33,substationLimit:5,radiusKm:20,solarLimit:1}).substations;
 const N=C.nearestSubstations(lon,lat,subs);
 for(let i=0;i<Math.min(L.length,N.length);i++){n++;if(L[i].km!==N[i].km||L[i].name!==(N[i].name||null)&&!(L[i].name===null&&N[i].name===''))mism++;}
 console.log(lat,lon,'lab n=',L.length,'first',L[0]&&L[0].km.toFixed(2),L[0]&&L[0].name,'| neon n=',N.length,'beyond',N.beyondRadiusNearest&&N.beyondRadiusNearest.km.toFixed(2));
}
console.log('pairs',n,'bitwise km/name mismatches',mism);
