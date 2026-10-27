import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out, only] = process.argv.slice(2); let s = readFileSync(inp, 'utf8'); const n0 = Buffer.byteLength(s);
const P = {
 // K1 label: say how much of the window was searched, so identical >=1,480 across 30D..12M explains itself
 K1: ["n>0?(c.st==='PARTIAL'?'≥':'')+N(n):", "n>0?(c.st==='PARTIAL'?'≥':'')+N(n)+(c.st==='PARTIAL'&&r.cov?` · ${Math.floor(r.cov.f*100)}% searched`:''):"],
 // K2 freshness: one rule for archive and feed (collector hourly + 2 h grace = 3 h); feed mode never said STALE
 K2: ["stale=(x,now)=>!(now-x.gen<=4*HOUR&&", "stale=(x,now)=>!(now-x.gen<=3*HOUR&&"],
 // K3 nearest: the engine's own public measure (>=33 kV, <=40 km, 5 links), same answer as the project deep link
 K3: ["const k=subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv)&&s.kv[0]>=132).map(s=>({s,km:dk(x,y,s.at[0],s.at[1])})).filter(a=>isFinite(a.km)).sort((a,b)=>a.km-b.km).slice(0,3);",
      "const ns=L.measure.nearestSubstations,k=(ns?ns(x,y,subs):subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv)&&s.kv[0]>=33).map(s=>({...s,km:dk(x,y,s.at[0],s.at[1])})).filter(a=>a.km<=40).sort((a,b)=>a.km-b.km).slice(0,5)).map(s=>({s,km:s.km}));"],
 K3b: ["if(!k.length)return say('No transmission substation (132 kV or above) in the published list.');", "if(!k.length)return say('No mapped substation of 33 kV or above within 40 km.');"],
 K3c: ["${a.km.toFixed(2)} km · ${a.s.kv[0]} kV · ${a.s.name", "${a.km.toFixed(2)} km · ${Math.round(a.s.kv[0])} kV · ${a.s.name"],
 // K4 framing: lines 4-40 km long are 3-27 px at the national zoom and sit under the 7.5 px flash dot; frame them like the deep link
 K4: ["catch(e){note('nearest labels: '+msg(e))}},near=(m,c,x,y)=>{nr(m,c,x,y);cpos()}",
      "catch(e){note('nearest labels: '+msg(e))}return k},near=(m,c,x,y)=>{const k=nr(m,c,x,y);if(k&&k.length){const X=[x],Y=[y];for(const a of k)X.push(a.s.at[0]),Y.push(a.s.at[1]);m.fitBounds([[Math.min(...X),Math.min(...Y)],[Math.max(...X),Math.max(...Y)]],{padding:{top:Math.min(c.offsetHeight+24,m.getContainer().getBoundingClientRect().height/2),bottom:40,left:40,right:40},maxZoom:13})}cpos()}"],
};
for (const [id, [a, b]] of Object.entries(P)) { if (only && !only.split(',').includes(id.replace(/[bc]$/, ''))) continue; const c = s.split(a).length - 1; if (c !== 1) throw new Error(id + ' matched ' + c); s = s.replace(a, () => b); }
writeFileSync(out, s); console.log(out, n0, '->', Buffer.byteLength(s), '+' + (Buffer.byteLength(s) - n0));
