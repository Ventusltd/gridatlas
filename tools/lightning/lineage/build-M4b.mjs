// build-M4b.mjs: M4 module -> M4b module (owner option). Same as M4, but instead of switching on whole REPD layers (M3/M4
// lit 148 dots in view at Doncaster, burying the 10 listed sites) it draws ONLY the listed sites, as REPD-styled dots with
// the engine's own glow + core paint (atlas/releases/202608300453-atlas-v9/ventus-corev8engine.js:1305-1337; colours of
// the other techs from that shell's "REPD (GeoJSON)" config, index.html:243-259), and never touches the Layers controls.
// Every replacement is exact-once against the M4 bytes.  usage: node build-M4b.mjs <module-M4.js> <out.js>
import fs from 'node:fs';
const [, , IN, OUT] = process.argv;
let s = fs.readFileSync(IN, 'utf8'); const b0 = Buffer.byteLength(s), log = [];
const once = (id, a, b) => { const k = s.split(a).length - 1; if (k !== 1) throw new Error(id + ' found ' + k); const n0 = Buffer.byteLength(s); s = s.replace(a, () => b); log.push([id, Buffer.byteLength(s) - n0]); };
const cut = (id, from, to, b) => { const i = s.indexOf(from), j = s.indexOf(to, i); if (i < 0 || j < 0 || s.indexOf(from, i + 1) >= 0) throw new Error(id); const n0 = Buffer.byteLength(s); s = s.slice(0, i) + b + s.slice(j); log.push([id, Buffer.byteLength(s) - n0]); };

cut('header', '/* M3: the original REPD map layers', '\n',
  '/* M4b: the listed REPD sites only are drawn as REPD-styled dots (the engine\'s glow + core paint); the Layers controls are never touched. */');
// the M3 layer bookkeeping (RL, Ly, Ry) is replaced by the dot layer of the listed sites
cut('layers', '/* ---- M3: the REPD map layers', '/* ---- REPD projects near a tap', `/* ---- M4b: the listed REPD sites, drawn in the original REPD style ----------------------------------------------------
   One dot per listed project at its site, with the engine's own paint (ventus-corev8engine.js:1305-1337): the solar and
   rooftop-solar glow by capacity, the capacity-graded core, and each other technology's own layer colour; stacked in the
   engine's REPD layer order. Only the sites on the card are drawn; the reader's Layers are never changed. A dot tap opens
   that site's project view, as its row does. */
RpO='solar solar_operational solar_roof wind wind_onshore_operational wind_offshore_operational bess bess_operational biomass tidal hydrogen hydro flywheel act geothermal caes'.split(' '),
RpD=(m,P)=>{let d=FC(P.flatMap((g,k)=>g.parts.map(p=>({type:'Feature',properties:{t:p.tech,c:+p.capacity>0?+p.capacity:0,k,o:RpO.indexOf(p.tech)},geometry:{type:'Point',coordinates:g.a}})))),
  T=['get','t'],I=(...a)=>['interpolate',['linear'],['get','c'],...a],R=(r,o)=>['match',T,'solar_roof',r,o];
  if(m.getSource(NSR[5]))return m.getSource(NSR[5]).setData(d);m.addSource(NSR[5],{type:'geojson',data:d});
  m.addLayer({id:NI[12],type:'circle',source:NSR[5],filter:['any',['all',['==',T,'solar'],['>=',['get','c'],4]],['all',['==',T,'solar_roof'],['>=',['get','c'],1]]],
    paint:{'circle-color':R(I(1,'#ff8c00',5,'#ff6600',10,'#ff4400'),I(4,'#ffff00',20,'#ffaa00',50,'#ff4400',200,'#ff0000')),'circle-radius':R(I(1,26,2,30,5,36,10,44),I(4,22,20,32,50,44,200,60,500,80)),
      'circle-opacity':R(.15,I(4,.12,20,.18,50,.25,200,.35)),'circle-blur':1,'circle-stroke-width':0}});
  m.addLayer({id:NI[13],type:'circle',source:NSR[5],layout:{'circle-sort-key':['get','o']},
    paint:{'circle-color':['match',T,'solar_roof',I(0,'#ffcc00',.99,'#ffcc00',1,'#ff8c00',5,'#ff6600',10,'#ff4400'),'solar',I(0,'#ffff00',20,'#ffcc00',50,'#ffaa00',200,'#ff6600',500,'#ff2200'),
      'wind','#00ffff','bess','#ffae00','biomass','#39ff14','tidal','#00bfff','hydrogen','#ffffff','hydro','#00aaff','flywheel','#ff69b4','act','#ff6600','geothermal','#ff3300','caes','#88aaff','#888888'],
      'circle-radius':R(I(0,7,.5,7,.99,8,1,16,2,18,5,22,10,28),I(0,8,10,10,50,13,200,17,500,22,1000,28)),'circle-stroke-width':R(I(0,1,.99,1,1,2),1.5),'circle-stroke-color':'#000','circle-opacity':R(.9,.85)}})},
`);
once('ni', "'p-label'].map(s=>NP+'-'+s)", "'p-label','p-glow','p-dot'].map(s=>NP+'-'+s)");
once('nsr', "NP+'-pnodes']", "NP+'-pnodes',NP+'-pdots']");
// no layer is switched, so nothing is released (M3's Ry calls go) and the container listener is M2's again
once('close', "B('×','Close',()=>{pc();Ry()})", "B('×','Close',pc)");
once('tap-empty', 'return f?cc(m,f):Ry()}', 'return f&&cc(m,f)}');
once('ld', 'if(!refresh)pc(),Ry();', 'if(!refresh)pc();');
once('latest', 'pc();Ry();return ld(true)', 'pc();return ld(true)');
once('off', 'cx();Ry();', 'cx();');
// M4b holds no layer: a tap on a drawn REPD dot (the reader's own layers) just closes the card, as in L3 (pc removes the dots)
once('l3r-dot', 'if(h&&h.length){for(let q of h)S.ly&&S.ly.delete(q.properties&&q.properties.tech);return Ry()}', 'if(h&&h.length)return;');
once('rg-fail', 'if(S.pp!==c)return;Ry();', 'if(S.pp!==c)return;');
once('bt', "bt=c=>c.addEventListener('change',ev=>{let t=ev.target,d=t&&t.dataset;if(!d)return;if(d.lightningControl==='toggle')so(!!t.checked);else if(!S.lyx&&S.ly)S.ly.delete(d.layerId)})",
  "bt=c=>c.addEventListener('change',ev=>{let t=ev.target;if(t&&t.dataset&&t.dataset.lightningControl==='toggle')so(!!t.checked)})");
// RpR: the card says what the map shows instead of naming switched layers; the drawn list is kept for dot taps
cut('rpr-layers', '  // M3: the original REPD layers of the listed technologies', "  let C=['interpolate'",
  "  c.ps=P;if(P.length)ap(box,el('div','margin-top:6px;color:#8b9aa1;font-size:11px','Map: only these sites are drawn, in the REPD layer style; tap a dot for its project view. Your Layers are unchanged.'));\n");
once('rpr-set', 'm.getSource(NSR[3]).setData(ln);m.getSource(NSR[4]).setData(nd)}', 'm.getSource(NSR[3]).setData(ln);m.getSource(NSR[4]).setData(nd);RpD(m,P)}');
once('rpr-add', "A(9,'line',NSR[3],{'line-color':C,'line-width':Z(1,2),'line-opacity':.8,'line-dasharray':[2,2]});", "A(9,'line',NSR[3],{'line-color':C,'line-width':Z(1,2),'line-opacity':.8,'line-dasharray':[2,2]});RpD(m,P);");
// a tap on a drawn site opens its project view (as its row); the project view draws its own site's dots
once('tap-dot', 'tap=e=>{let m=mh();if(!S.on||S.busy||!m||!(m.getLayer(HIT)||m.getLayer(CEL)))return;',
  'tap=e=>{let m=mh();if(!S.on||S.busy||!m||!(m.getLayer(HIT)||m.getLayer(CEL)))return;let rq=S.pp&&S.pp.ps&&m.getLayer(NI[13])&&m.queryRenderedFeatures(e.point,{layers:[NI[13]]})[0],rg=rq&&S.pp.ps[rq.properties.k];if(rg)return RpV(m,S.pp,rg);');
once('nr-dot', 'if(!c.o.np)Rp(m,c,x,y,M);', 'if(!c.o.np)Rp(m,c,x,y,M);else if(c.o.g)RpD(m,[c.o.g]);');
once('rpv-g', "'project',{np:1,foot:", "'project',{np:1,g,foot:");
once('rpv-cmt', 'The REPD layers M3 switched on stay on.', 'The project view draws its own site in the REPD style.');

for (const bad of [/data-layer-id/, /lbl-/, /\bRy\(/, /S\.ly\b/, /\bRL\b/, /\bLy\(/]) if (bad.test(s)) throw new Error('M4b still contains ' + bad);
fs.writeFileSync(OUT, s);
const n = Buffer.byteLength(s);
console.log(JSON.stringify({ from: b0, to: n, deltas: log, cap: 64781, spare: 64781 - n, cartridge: 435219 + n, cartridgeSpare: 500000 - 435219 - n }));
