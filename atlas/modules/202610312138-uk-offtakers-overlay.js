/* uk-offtakers-overlay, generation 202610312138 (UTC). Potential offtakers: sites listed in open registers (NAEI 2023 point sources, GPPD) and OpenStreetMap, classified by the OT-filter rules (energy-intensive industry, power stations incl. closed and closing, data centres, large water works, other large users). OFF by default, never persisted. A listing is not electricity demand; distances are straight lines; vicinity screening only. Separate from the lightning overlay: own ids (gridatlas-offtakers*), copper-to-teal palette, own card. */
/* A tap on a site: neon links to the 15 nearest REPD project sites (40 km; status and technology chips as in M2+; projects within about 10 m share one site; ties at the 15th kept) and the 5 nearest substations (the original link.measure.nearestSubstations); a docked card with each listed project's full REPD record (M5-build's exact join, copied unchanged), a 5 km area summary and a CSV vicinity sheet. */
/* Data centres (#73 steps 7-8): their own class (violet, status ring, sized by stated MW), from a pinned open file; a tap fires the Grid Engine 30/30/30: the 30 nearest substations (the engine's gridScope; the original nearestSubstations for the first 5), 30 REPD sites (40 km) and the 30 nearest conventional power sites (lines up to 100 km), in tabs with an area summary. IT load and grid connection are never conflated; a pipeline entry is not a commitment; proximity is not connection. */
(()=>{'use strict';
let W=window,NS=(W.__GRIDATLAS_MODULES__=W.__GRIDATLAS_MODULES__||{});
if(NS.ukOfftakers||typeof document==='undefined')return;
let MX=Math.max,MN=Math.min,AI=Array.isArray,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
GEN='202610312138',TMO=15000,TOE='timeout after 15 s',R40=40,NR=15,
N3=30,R100=100,DL=5,
DATA='https://ventusltd.github.io/gridatlas/data/offtakers_filtered_202610292000.geojson',DSHA='16dca56003e7a222e7a74025b9b61db3c1929ac7e34adc38daeb343074e68139',
DCAP=5e6,
DCF='https://ventusltd.github.io/gridatlas/data/uk_datacentre_pipeline_202610312133.geojson',DCFSHA='87337db5d3bf7959f7f605d3abd029dd4196ab24a79107ceb95210c5b7751654',
CVF='https://ventusltd.github.io/gridatlas/data/conventional_power_uk_202610292000.geojson',CVFSHA='44b577a12d714d934ce90ce39b44951fb2a641f32ccc20d45a5e2461b145ec98',PCAP=4e6,PMAX=5e3,
AL=u=>/^https:\/\/ventusltd\.github\.io\/gridatlas\/data\/[\w.-]+\.(geo)?json$/.test(u)||E('URL not allow-listed'),
SRC='gridatlas-offtakers',LAYER='l-gridatlas-offtakers',GLOW=SRC+'-glow',HIT=SRC+'-hit',LINKS='l-gridatlas-offtakers-links',
CLS={a:['Industry','#e07b39','#3a1d0a',3,6,1],b:['Power stations','#f2c14e','#3a1d0a',3.5,7,1],c:['Data centres','#b07cff','#ffffff',3.5,6.5,1],d:['Water (large)','#4f86c6','rgba(0,0,0,0)',3,5,1],s:['Water (listed, small)','#4f86c6','rgba(0,0,0,0)',3,5,0],e:['Campus/CHP sites','#a26769','#3a1d0a',3,5,0]},
CK='abcdse'.split(''),
BST={op:'Operating (2023)',cl:'Closing',cc:'Closed/converted',un:'Unknown'},BK=Object.keys(BST),
DST={op:['Operational','#39d98a'],uc:['Under construction','#ffc400'],co:['Consented','#40c4ff'],pl:['In planning','#ff8a3d'],cr:['Connection request','#ff4fd8'],an:['Announced','#e6e6e6'],rw:['Refused/withdrawn','#a05252'],un:['Status not stated','#6b7a8f']},DK=Object.keys(DST),
DSK=s=>{let o={operational:'op',under_construction:'uc',consented:'co',in_planning:'pl',connection_request:'cr',announced:'an',refused_or_withdrawn:'rw'};return Object.hasOwn(o,s)?o[s]:'un'},
DLEG='Data centres (violet): dot size by the stated IT load, else the stated grid connection (faint = neither stated); ring colour = status. A pipeline entry is not a commitment.',
TITLE='Potential offtakers',BASE='Potential offtakers (open registers)',
FOOT='Sites listed in open registers (NAEI, GPPD) and OpenStreetMap. A listing is not electricity demand. Distances are straight lines. Vicinity screening only. Contains OpenStreetMap data © OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright).',
LEG='Dot size: emission band (NAEI 2023) or installed MW (GPPD). Hollow ring: closed, closing or converted station.',
HEAD='Potential offtaker (screening): not a confirmed demand, contract or connection.',
SCR='Screening · straight-line distance, not a cable route. Vicinity only.',
NOTSHOWN='Not shown here: electricity use, connection terms, TEC, consent, viability.',
N=n=>Number(n).toLocaleString('en-GB'),pl=(n,w,s='s')=>N(n)+' '+w+(n==1?'':s),k2=v=>(+v).toFixed(2),k1=v=>(+v).toFixed(1),
cs=v=>(v+'').replace(/\p{Cf}/gu,'').slice(0,200),msg=e=>cs(e&&e.message||e),FC=f=>({type:'FeatureCollection',features:f||[]}),
el=(t,css,s)=>{let e=document.createElement(t);if(css)e.style.cssText=css;if(s!=null)e.textContent=s;return e},
tier=(e,t)=>(e.dataset.tier=t,e),
unk=s=>!s||/^(unknown|unnamed\b)/i.test((s+'').trim()),
S={schema:'gridatlas.module.uk-offtakers-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,busy:false,requests:0,errors:[],serial:0,
 cls:Object.fromEntries(CK.map(k=>[k,!!CLS[k][5]])),bst:Object.fromEntries(BK.map(k=>[k,true])),data:null,err:null,cache:{},sfs:[],rf:{st:'all',te:'all'}},
note=m=>S.errors.push(String(m)),
mh=()=>{let m=W.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{try{for(let l of m.getStyle().layers||[]){let f=l.type==='symbol'&&l.layout&&l.layout['text-font'];if(AI(f)&&f.length&&typeof f[0]==='string')return f}}catch(_){}return['Open Sans Regular']},
gj=(u,cache,raw)=>{let c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
 return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
hex=b=>[...new Uint8Array(b)].map(x=>(x|256).toString(16).slice(1)).join(''),
gx=(u,h,cap=DCAP)=>new Promise((res,rej)=>{AL(u);S.requests++;let x=new XMLHttpRequest();x.open('GET',u);x.responseType='arraybuffer';x.timeout=TMO;
 x.onload=()=>x.status>=200&&x.status<300?x.responseURL&&!x.responseURL.startsWith(u)?rej(new Error('redirected')):res(x.response):rej(new Error('HTTP '+x.status));
 x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.onprogress=e=>{if(e.loaded>cap){x.abort();rej(new Error('data check failed (size)'))}};x.send()})
 .then(async b=>{let s=W.crypto&&W.crypto.subtle;if(!(b.byteLength<=cap))E('data check failed (size)');if(!s)E('data check failed (no WebCrypto)');if(hex(await s.digest('SHA-256',b))!==h)E('data check failed (SHA-256 differs from the pin)');return JSON.parse(new TextDecoder().decode(b))}),
rd=()=>S.cache.f||(S.cache.f=gx(DATA,DSHA).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),o)).catch(e=>{S.cache.f=null;throw new Error('offtakers data: '+msg(e))})),
okPt=c=>AI(c)&&c[0]===+c[0]&&c[1]===+c[1]&&c[0]>=-11&&c[0]<=3&&c[1]>=49.5&&c[1]<=61.5,
hv=(a,b)=>{let r=Math.PI/180,p1=a[1]*r,p2=b[1]*r,h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[0]-a[0])*r/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(h))},
KL=p=>{let o={A:'a',B:'b',C:'c',E:'e',D:p.subclass==='water_wastewater_large'?'d':'s'};return Object.hasOwn(o,p.class)?o[p.class]:null},
ao=v=>v==null||AI(v)&&v.every(o=>o&&typeof o=='object'),okP=p=>ao(p.records)&&ao(p.sources)&&ao(p.osm_corroboration)&&(p.subclass==null||typeof p.subclass=='string'),
STG=p=>p.class!=='B'?'':/^operat/i.test(p.status)?'op':/^closing/i.test(p.status)?'cl':/^(closed|converted)/i.test(p.status)?'cc':'un',
MW=p=>{let m=p.size_metric||{};return/^MW/.test(m.unit||'')&&m.value>0?+m.value:0},
DMW=p=>{let v=o=>o&&typeof o=='object'&&typeof o.value=='number'&&o.value>0&&o.value<=1e4?o.value:null;return{it:v(p.it_load_mw),gc:v(p.grid_connection_mw),un:v(p.unclassified_mw)??v(AI(p.mw_unclassified)&&p.mw_unclassified[0])}},
DZ=w=>{let v=w.it??w.gc;return v==null?1:v>=200?2:v>=50?1.6:v>=10?1.25:1},
ZS=p=>{let w=MW(p),b=p.emission_band_naei_2023||'';return p.class==='C'?DZ(DMW(p)):p.class==='B'&&w?w>=1e3?1.5:w>=100?1.25:1:/^>=100/.test(b)?1.5:/^(10-25|25-100)/.test(b)?1.25:1},
nm=fs=>{let dots=[],bad=0;for(let f of fs){let p=f&&f.properties,k=p&&KL(p),c=f&&f.geometry&&f.geometry.coordinates;
  if(!k||!okP(p)||!f.geometry||f.geometry.type!=='Point'||!okPt(c)){bad++;continue}
  dots.push({i:dots.length,k,t:k=='c'?DSK(p.status):STG(p),z:ZS(p),n:p.name,op:p.operator,sub:(p.subclass||'').replace(/_/g,' '),a:c.slice(0,2),p})}
 return{dots,bad,counts:Object.fromEntries(CK.map(k=>[k,dots.filter(r=>r.k==k).length]))}},
OPL=/^(OGL|ODbL|CC[ -]?BY|CC0|PDDL|public[ -]domain|Open[ -]Parliament|cited fact)/i,
SRCS=p=>AI(p.sources)&&p.sources.length&&p.sources.length<=50&&p.sources.every(s=>s&&typeof s=='object'&&OPL.test(s.licence)&&!/\b(NC|ND)\b|non-?commercial|no.?deriv/i.test(s.licence)),
OKR=(p,c)=>p&&typeof p=='object'&&(p.name==null||typeof p.name=='string')&&/^[\w-]{1,40}$/.test(p.id)&&SRCS(p)&&okPt(c),
dn=fs=>{let o=[],bad=MX(0,fs.length-PMAX),cl=0;for(let f of fs.slice(0,PMAX)){let p=f&&f.properties,l=p&&p.location||{},g=f&&f.geometry,c=g&&g.type==='Point'?g.coordinates:[l.lon,l.lat];
  if(p&&p.site_kind==='cable_landing_station'){cl++;continue}if(!OKR(p,c)||typeof p.status!='string'){bad++;continue}
  o.push({k:'c',t:DSK(p.status),z:DZ(DMW(p)),n:p.name,op:typeof p.operator=='string'?p.operator:null,sub:'data centre',a:c.slice(0,2),p,dc:1})}
 return{o,bad,cl}},
CST={operational:'operating',closing:'closing',closed:'closed',converted:'converted',construction:'under construction'},
cn=fs=>{let o=[],bad=MX(0,fs.length-PMAX);for(let f of fs.slice(0,PMAX)){let p=f&&f.properties,g=f&&f.geometry,c=g&&g.type==='Point'&&g.coordinates;
  if(!OKR(p,c)){bad++;continue}if(p.in_nearest_default===false)continue;
  o.push({id:p.id,a:c.slice(0,2),n:unk(p.name)?'name not listed':cs(p.name),op:p.operator,f:typeof p.fuel=='string'&&p.fuel!='unstated'?cs(p.fuel):'fuel not stated',te:typeof p.technology=='string'?p.technology:'',mw:typeof p.mw=='number'&&p.mw>0&&p.mw<=1e4?p.mw:null,st:Object.hasOwn(CST,p.status)?CST[p.status]:'status unknown',p})}
 return{o,bad}},
NM=r=>unk(r.n)?'name not listed':cs(r.n),
SRCN=r=>{let q=(r.p.records||[])[0];return q?String(q.source).split(' ')[0]:'register'},
OP=r=>unk(r.op)?'operator not listed':`operator (${SRCN(r)}) ${cs(r.op)}`,
LIC=r=>(r.p.sources||[]).map(s=>`${cs(s.name)} (${cs(String(s.licence||'licence not stated').split(/ \(|, \(c\)/)[0])})`).join(' · ')||'source not stated',
SUBL=r=>cs(r.sub).replace(/\b(ccgt|ocgt|chp)\b/g,s=>s.toUpperCase()).replace(/^water wastewater (large|listed small)$/,'wastewater works'),
fl=()=>['all',['in',['get','k'],['literal',CK.filter(k=>S.cls[k])]],['any',['!=',['get','k'],'b'],['in',['get','t'],['literal',BK.filter(k=>S.bst[k])]]]],
MT=(i,d)=>['match',['get','k'],...CK.flatMap(k=>[k,CLS[k][i]]),d],RING=['in',['get','t'],['literal',['cl','cc']]],
IC=['==',['get','k'],'c'],DRC=['match',['get','t'],...DK.flatMap(k=>[k,DST[k][1]]),DST.un[1]],
CORE=SRC+'-centre',LY=[GLOW,LAYER,CORE,HIT],
dw=()=>{let m=mh();if(!m||!S.data)return;let fc=FC(S.data.dots.map(r=>({type:'Feature',id:r.i,properties:{k:r.k,t:r.t,z:r.z,i:r.i,u:r.k=='c'&&(w=>w.it??w.gc)(DMW(r.p))==null?1:0},geometry:{type:'Point',coordinates:r.a}}))),Z=(a,b)=>['interpolate',['linear'],['zoom'],6,['*',['get','z'],a],12,['*',['get','z'],b]],F=fl();
 if(!m.getSource(SRC)){m.addSource(SRC,{type:'geojson',data:fc});
  m.addLayer({id:GLOW,type:'circle',source:SRC,filter:F,paint:{'circle-radius':Z(['*',2.4,MT(3,3)],['*',2.4,MT(4,6)]),'circle-color':MT(1,'#e07b39'),'circle-opacity':['case',RING,0,['match',['get','k'],'d',.12,'s',0,.2]],'circle-blur':1}});
  m.addLayer({id:LAYER,type:'circle',source:SRC,filter:F,layout:{'circle-sort-key':['+',['match',['get','k'],'s',0,'e',1,'d',2,'a',4,'c',7,5],['get','z']]},paint:{'circle-radius':Z(MT(3,3),MT(4,6)),
   'circle-color':['case',RING,'rgba(0,0,0,0)',MT(1,'#e07b39')],'circle-opacity':['match',['get','k'],'d',.8,'s',.8,'c',['case',['==',['get','u'],1],.45,.95],.95],
   'circle-stroke-color':['case',RING,CLS.b[1],IC,DRC,MT(2,'#3a1d0a')],'circle-stroke-width':['case',RING,2,IC,2.5,['match',['get','k'],'d',0,'s',0,1]]}});
  m.addLayer({id:CORE,type:'circle',source:SRC,filter:['all',F,['==',['get','k'],'b'],['!',RING]],paint:{'circle-radius':Z(1,2),'circle-color':'#3a1d0a'}});
  m.addLayer({id:HIT,type:'circle',source:SRC,filter:F,paint:{'circle-radius':12,'circle-opacity':0}})}
 else{m.getSource(SRC).setData(fc);rf()}},
rf=()=>{let m=mh(),F=fl();if(m)for(let l of LY)try{m.getLayer(l)&&m.setFilter(l,l===CORE?['all',F,['==',['get','k'],'b'],['!',RING]]:F)}catch(e){note(e)}},
top=()=>{let m=mh();if(m&&m.moveLayer)for(let l of[...LY,...NI])try{m.getLayer(l)&&m.moveLayer(l)}catch(_){}},
cx=()=>{let m=mh();pc();if(m)try{for(let l of[...LY].reverse())m.getLayer(l)&&m.removeLayer(l);m.getSource(SRC)&&m.removeSource(SRC)}catch(e){note(e)}},
NP='gridatlas-offtakers-neon',/// DI/DS: the data-centre 30/30/30 links (one line source for all three sets, one node source)
DI=['ring','glow','core-s','core-r','core-v','node','label','ring-label'].map(s=>NP+'-dc-'+s),DS=[NP+'-dc-l',NP+'-dc-n',NP+'-dc-rings'],
NI=[NP+'-glow',NP+'-core',NP+'-flow',NP+'-node',NP+'-label',NP+'-pin-halo',NP+'-pin',NP+'-p-glow',LINKS,NP+'-p-node',NP+'-p-label',...DI],NSR=[NP+'-subs',NP+'-snodes',NP+'-pin',NP+'-plinks',NP+'-pnodes',...DS],
nc=()=>{let m=mh();if(S.raf){cancelAnimationFrame(S.raf);S.raf=null}if(m)try{for(let l of[...NI].reverse())m.getLayer(l)&&m.removeLayer(l);for(let s of NSR)m.getSource(s)&&m.removeSource(s)}catch(e){note(e)}},
SC={op:'#00ff88',cc:'#ffcc00',pl:'#ff8a3d','?':'#ff4444'},
nl=(m,o,k,P)=>{let Z=(a,b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{})),TL='#5fbdc2';nc();
 m.addSource(NSR[2],{type:'geojson',data:FC([{type:'Feature',properties:{},geometry:{type:'Point',coordinates:o}}])});
 if(P&&P.length){m.addSource(NSR[3],{type:'geojson',data:FC(P.map(g=>({type:'Feature',properties:{c:SC[RpS(g.parts[0].status)]},geometry:{type:'LineString',coordinates:[o,g.a]}})))});
  m.addSource(NSR[4],{type:'geojson',data:FC(P.map(g=>({type:'Feature',properties:{c:SC[RpS(g.parts[0].status)],label:RpG(g)},geometry:{type:'Point',coordinates:g.a}})))});
  A(7,'line',NSR[3],{'line-color':['get','c'],'line-width':Z(4,9),'line-opacity':.1,'line-blur':Z(2,6)},RJ);A(8,'line',NSR[3],{'line-color':['get','c'],'line-width':Z(1,2),'line-opacity':.85,'line-dasharray':[2,2]});
  A(9,'circle',NSR[4],{'circle-radius':Z(3,5),'circle-color':['get','c'],'circle-stroke-width':1,'circle-stroke-color':'#000'});
  try{A(10,'symbol',NSR[4],{'text-color':'#d6e4ff','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-font':sf(m)})}catch(e){note('labels: '+msg(e))}}
 if(k&&k.length){m.addSource(NSR[0],{type:'geojson',data:FC(k.map((a,i)=>({type:'Feature',properties:{s:MX(.25,.75-i*.1)},geometry:{type:'LineString',coordinates:[o,a.at]}})))});
  m.addSource(NSR[1],{type:'geojson',data:FC(k.map(a=>({type:'Feature',properties:{label:`${k2(a.km)} km · ${KV(a)} kV`},geometry:{type:'Point',coordinates:a.at}})))});
  A(0,'line',NSR[0],{'line-color':TL,'line-width':Z(5,12),'line-opacity':.12,'line-blur':Z(3,8)},RJ);A(1,'line',NSR[0],{'line-color':TL,'line-width':Z(.9,1.8),'line-opacity':['get','s']},RJ);
  A(2,'line',NSR[0],{'line-color':'#bfe9ee','line-width':Z(1.2,2.4),'line-opacity':.8,'line-dasharray':[.2,3.2]},{'line-cap':'round'});
  A(3,'circle',NSR[1],{'circle-radius':Z(2.2,4),'circle-color':TL,'circle-opacity':.85});
  try{A(4,'symbol',NSR[1],{'text-color':'#a9c4c9','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,-1.5],'text-anchor':'bottom','text-font':sf(m)})}catch(e){note('labels: '+msg(e))}
  let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches===true}catch(_){}
  if(rm)m.setPaintProperty(NI[2],'line-opacity',0);else if(typeof requestAnimationFrame=='function'){let ph=0,M=(W.__GRIDATLAS_NEON_LINKS__||{}).measure||{},fd=typeof M.flowDash=='function'?M.flowDash:p=>{let s=Math.floor(p/1.5*24)%24/24*1.5;return[.001,MX(.001,s),.42,MX(.001,1.5-s)]},mo='',
   st=()=>{ph=(ph+.055)%1.5;try{let d=fd(ph),j=d.join();if(j!==mo){mo=j;m.setPaintProperty(NI[2],'line-dasharray',d)}}catch(_){S.raf=null;return}S.raf=requestAnimationFrame(st)};S.raf=requestAnimationFrame(st)}}
 A(5,'circle',NSR[2],{'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#3d7bff','circle-stroke-width':6,'circle-stroke-opacity':.18,'circle-blur':.4});
 A(6,'circle',NSR[2],{'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#8fb4ff','circle-stroke-width':1.8,'circle-stroke-opacity':.9})},
KV=a=>MX(...(AI(a.kv)&&a.kv.length?a.kv:[0])),
RG=(m,M)=>S.rg||(S.rg=(async()=>{let f;try{f=m.getSource('src-repd').serialize().data.features}catch(_){}
 if(!(f&&f.length))f=(await gj('/dist/repd_master.json')).features;
 let o=f.map(x=>{try{let a=M.representativePoint(x.geometry);if(a[0]===+a[0]&&a[1]===+a[1]&&!(a[0]==-7.55716&&a[1]==49.766807))return[a,x.properties||{}]}catch(_){}return[]}).filter(([a,p])=>a&&M.isProjectTech(p.tech));
 return o.length?o:E('register empty')})().catch(e=>{S.rg=null;throw e})),
RpF={st:[['all','All'],['op','Operational'],['cc','Consented'],['pl','Planning']],te:[['all','All'],['solar','Solar'],['wind','Wind'],['bess','BESS'],['other','Other']]},
RpS=s=>{let o={operational:'op','under construction':'cc','awaiting construction':'cc','application submitted':'pl'},k=String(s||'').toLowerCase();return Object.hasOwn(o,k)?o[k]:'?'},
RpT=t=>/^solar/.test(t)?'solar':/^wind/.test(t)?'wind':/^bess/.test(t)?'bess':'other',
RpN=p=>({solar:'Solar',solar_roof:'Rooftop solar'})[p.tech]||cs(p.raw_tech),
RpU=(ps,f)=>[...new Set(ps.map(f))],
RpW=ps=>RpU(ps,p=>p.name+'|'+p.raw_tech+'|'+(p.capacity>0?+p.capacity:0)).reduce((s,k)=>s+ +k.split('|').pop(),0),
RpMW=v=>v>0?` ${N(v)} MW`:'',RpC=ps=>RpW(ps)>0?'':' · capacity not stated',
RpG=g=>`${k2(g.km)} km · ${RpU(g.parts,RpN).sort().join(' + ')}${RpMW(RpW(g.parts))}`,
RU='https://ventusltd.github.io/gridatlas/data/repd_projects_202608290716.parquet',RM='https://ventusltd.github.io/gridatlas/data/repd_v9_manifest_202608290716.json',RpE=1.000001e-6,RpP=new WeakMap,
RpQ=async pts=>{let C=S.rc||(S.rc=new Map),ks=RpU(pts.filter(a=>a&&a[0]===+a[0]&&a[1]===+a[1]&&!C.has(a+'')),a=>a+''),k;
  if(ks.length){let w=window.__GRIDATLAS_DUCKDB_RUNTIME__,R=p=>{let t;return Promise.race([p,new Promise((_,j)=>t=setTimeout(()=>j(new Error(TOE)),TMO))]).finally(()=>clearTimeout(t))};
    if(!w)E('the map search runtime has not started; reload the page');
    await R(S.rv||(S.rv=gj(RM,'no-store',1).then(async b=>{let o,h=[...new Uint8Array(await window.crypto.subtle.digest('SHA-256',b))].map(x=>(x|256).toString(16).slice(1)).join('');
      if(h!='8850567ff9f1d2b6996b4e0d9707320030f3466a0b821cdcfc5325322b8be8c8'||(o=JSON.parse(new TextDecoder().decode(b))).parquet.sha256!='174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b')E('REPD manifest is not the pinned one')}).catch(e=>{S.rv=0;throw e})));
    k=await R(R(w.promise).then(d=>d.database.connect()));
    try{let r=(await R(k.query(`SELECT * FROM read_parquet('${RU}') WHERE ${ks.map(a=>a.split(',')).map(([x,y])=>`(abs(longitude-(${x}))<=${RpE} AND abs(latitude-(${y}))<=${RpE})`).join(' OR ')}`))).toArray().map(o=>o.toJSON?o.toJSON():o);
      for(let a of ks){let[x,y]=a.split(',');C.set(a,r.filter(o=>Math.abs(o.longitude-x)<=RpE&&Math.abs(o.latitude-y)<=RpE))}}finally{try{k.close()?.catch?.(()=>0)}catch(_){}}}
  return C},
RpZ=s=>((s||'')+'').replace(/[\x80-\x9f]/g,c=>new TextDecoder('windows-1252').decode(Uint8Array.of(c.charCodeAt()))).normalize('NFC').split(/\s+/).filter(Boolean).join(' '),
RpJ=(p,a,C)=>{let c=a&&C&&C.get&&C.get(a+''),n=v=>v>0?+v:0;if(!c)return;c=c.filter(o=>RpZ(o.name)==RpZ(p.name)&&Math.abs(n(o.capacity_mw)-n(p.capacity))<1e-6&&o.repd_technology===p.raw_tech);return c.length==1?c[0]:null},
RpB=(q,a,C,e)=>{let o=e?0:RpJ(q,a,C),b=el('div','padding:2px 0 10px 12px;font-size:11px;color:#9fb3ba;overflow-wrap:anywhere'),L=(s,c)=>ap(b,el('div',c,cs(s)));b.dataset.tier='record';
  if(e)L('REPD record unavailable — tap to retry ('+msg(e)+')');else if(o===void 0)L('REPD record: loading…');else if(!o)L('Record · address not in register (no exact REPD match; no ref shown)');
  else{L([o.repd_address_display||'address not stated',o.repd_postcode||'no postcode',o.county,o.region].filter(Boolean).join(' · '),'color:#c9d6da');
    L(`Record · REPD ${o.repd_ref} · ${o.status}`+(o.status!=q.status?` (map register: ${q.status})`:''));
    L('Operator: '+(o.applicant_publication_state=='REPD_AS_PUBLISHED'&&o.repd_operator_or_applicant||'not shown (may name a person) or not stated'));
    L([o.planning_authority||'planning authority not stated',o.planning_application_reference,o.source_record_updated&&'record updated '+o.source_record_updated].filter(Boolean).join(' · '))}
  return b},
sites=(all,f,n=NR)=>{let sel=all.filter(r=>(f.st==='all'||RpS(r.p.status)===f.st)&&(f.te==='all'||RpT(r.p.tech)===f.te)),gs=[];
 for(let r of[...sel].sort((a,b)=>a.km-b.km)){let g=gs.find(g=>Math.abs(g.a[0]-r.a[0])<2e-4&&Math.abs(g.a[1]-r.a[1])<1e-4);if(!g)gs.push(g={a:r.a,km:r.km,parts:[]});g.parts.push(r.p)}
 return{sel,P:gs.filter((g,i,a)=>i<n||g.km==a[n-1].km)}},
near=(G,M,x,y)=>{let all=[],seen=new Set;for(let[a,p]of G){let km=M.distanceKm(x,y,...a);if(km<=R40){let k=a+JSON.stringify(p);if(!seen.has(k)){seen.add(k);RpP.set(p,a);all.push({a,p,km})}}}return all},
pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
cpos=()=>{let c=S.pp,m=mh();if(!c||!m)return;let k=gr(m.getContainer()),q=Q('gridatlas-menu-bar'),t=MX(0,(q?gr(q).bottom:0)-k.top)+8,w=MN(480,k.width-16),sd=c.sd=k.height<500&&k.width-w>=300,L=sd?k.right-8-w:k.left+(k.width-w)/2,h=c.offsetHeight||0;c.style.marginRight=sd?'0':'auto';let b=8;
 for(let o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){let r=o&&gr(o);if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=MX(b,k.bottom-r.top+8)}
 if(b+h>k.height-t)b=8;c.bb=b;c.style.bottom=b+'px';/// a data-centre card (o.hh) opens as M6's half-height panel: at most 45 % of the map, scrolling inside
 c.style.maxHeight=MX(44,MN(k.height-t-b,c.o&&c.o.hh?MX(200,k.height*.45|0):MX(240,k.height-b-320)))+'px'},
cd=(m,lb,ti,o={})=>{pc();let c=el('div','position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;background:#000;color:#e8eef9;border:1px solid #2f5fa8;border-radius:4px;box-shadow:0 0 14px rgba(61,123,255,.28);font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain'),
 bar=el('div','display:flex;align-items:center;gap:6px;padding-left:8px;background:#08142b;border-bottom:1px solid #1d2f52'),bd=el('div','padding:0 8px 6px'),d=el('details'),rf=()=>{cpos();if(S.pp===c)ck(1)},
 B=(t,a,f)=>{let e=el('button','flex:none;width:44px;height:44px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:14px/1 monospace;cursor:pointer',t);e.type='button';e.setAttribute('aria-label',a);e.addEventListener('click',f);ap(bar,e);return e};
 c.dataset.offtakersCard='';c.setAttribute('role','dialog');c.setAttribute('aria-label',lb);c.o=o;
 ap(bar,el('span','flex:1;min-width:0;color:#8fb4ff;font-weight:bold;overflow-wrap:anywhere',ti.slice(0,90)));
 let mn=B('−','Minimise',()=>{let v=bd.style.display=='none';bd.style.display=v?'':'none';mn.textContent=v?'−':'+';mn.setAttribute('aria-expanded',v);rf()});d.addEventListener('toggle',rf);mn.setAttribute('aria-expanded',true);B('×','Close',()=>pc());
 c.addEventListener('keydown',e=>{if(e.key==='Escape')pc()});
 if(o.back){let k=ap(bd,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer',o.back[0]));k.type='button';k.dataset.offtakersBack='';k.setAttribute('aria-label',o.back[0].slice(2));k.addEventListener('click',o.back[1])}
 c.head=ap(bd,el('div'));c.sm=el('summary','padding:12px 0 11px;line-height:17px;cursor:pointer;color:#cfe0ff','');ap(d,c.sm);c.det=ap(d,el('div'));ap(bd,d);if(o.open)d.open=true;c.d=d;
 c.foot=ap(bd,tier(el('div','margin-top:6px;color:#8b9aa1;font-size:11px',o.foot||NOTSHOWN),o.foot?'record':'screening'));
 ap(c,bar);ap(c,bd);c.lv=ap(c,el('div','position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)'));c.lv.setAttribute('role','status');S.pp=c;ap(m.getContainer(),c);cpos();
 try{W.dispatchEvent(new CustomEvent('gridatlas:card-open',{detail:{owner:'offtakers'}}))}catch(_){}return c},
L=(p,s,css,t)=>tier(ap(p,el('div',css||'',s)),t||'screening'),
Ra=(c,s)=>setTimeout(()=>{if(c.lv)c.lv.textContent=s},99),
Ru=(c,s,a)=>{let t=c.sm.textContent.replace(/ · REPD[^·]* unavailable/,'');c.sm.textContent=s?t.replace(/ · details$/,` · ${s} · details`):t;a&&Ra(c,a)},
cw=()=>Promise.resolve().then(()=>{let m=mh();m&&!(m.isMoving&&m.isMoving())&&ck()}),cm=m=>m.off&&m.off('moveend',cw),
nz=(m,x,y)=>{try{cm(m);m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});typeof m.once=='function'?m.once('moveend',cw):ck()}catch(e){note('camera: '+msg(e))}},
ck=f=>{try{let m=mh(),c=S.pp,k=S.fk,C=m&&m.getContainer(),H=C&&C.clientHeight||1e4,d=c&&c.sd,B=d?100:c&&(c.bb+c.offsetHeight||196)+24,R=d?c.offsetWidth+32:40,T=d?60:150;if(!c||!k||f!==1&&k.every(a=>{let p=m.project(a);return p.x>=20&&p.x<=(C.clientWidth||1e4)-R+20&&p.y>=T-20&&p.y<=H-B}))return;let[w,s]=k[0],[e,n]=k[0];for(let[a,o]of k){w=MN(w,a);e=MX(e,a);s=MN(s,o);n=MX(n,o)}
 cm(m);m.fitBounds([[w,s],[e,n]],{padding:{top:T,left:40,right:R,bottom:d?B:H-150>B?B:MX(0,H-270)},maxZoom:12,duration:900})}catch(e){note('camera: '+msg(e))}},
oc=(m,r,n=15)=>{let[x,y]=r.a,p=r.p,c=cd(m,'Potential offtaker',HEAD),h=c.head,w=MW(p),bd=p.emission_band_naei_2023,rc=p.records||[],naei=rc.some(q=>q.source==='NAEI');c.r=r;c.re=()=>oc(m,r,0);S.fk=[r.a];
 L(h,`${NM(r)} · ${OP(r)} · ${SUBL(r)}`,'color:#f3e6da;font-weight:bold;margin-top:6px','record');
 L(h,(w?`${N(w)} MW installed (GPPD, DUKES-derived; installed, not connection capacity)`+(bd?' · ':''):'')+(bd?`Emission band ${cs(bd)} CO2e a year, NAEI 2023 (band only, approximate)`:w?'':'No NAEI 2023 emission band'),'color:#9fb3ba','record');
 if(p.class==='B'||p.status_date){let st=cs(p.status).replace(/^status /,''),sd=cs(p.status_date||'');L(h,`Status: ${st}${sd&&!st.includes(sd)?' '+sd:''}${p.status_source?' · source '+cs(p.status_source):''}`,'color:#9fb3ba','record')}
 if(r.t==='cl'||r.t==='cc')L(h,(r.t==='cl'?'Closing station':/^converted/i.test(p.status)?'Converted station (it may still generate on another fuel)':'Closed station')+': no grid connection, TEC or connection rights are implied.','color:#9fb3ba');
 c.smb=`${CLS[r.k][0]} · ${SUBL(r)}${rc.length>1?` · ${rc.length} records merged`:''}`;c.sm.textContent=c.smb+' · details';
 let dv=c.det;L(dv,p.class==='B'?`Listed as a power producer${naei?' (NAEI 2023)':''}. Not a measure of its electricity use.`:`On-site combustion: ${cs(p.onsite_combustion_indicator||'unknown')}.${naei?' Source NAEI 2023.':''} Not on-site generation capacity.`,'color:#c9d6da;margin-top:4px','record');
 if(rc.length>1)L(dv,`${rc.length} records merged: `+rc.map(q=>`${unk(q.name)?'name not listed':cs(q.name)} (${cs(q.source)}${q.mw?', '+N(q.mw)+' MW':''})`).join('; '),'color:#9fb3ba','record');
 L(dv,'Record · '+LIC(r),'color:#8b9aa1','record');
 let oc_=p.osm_corroboration||[],ds=S.data.dots.filter(q=>q!==r&&q.k!=r.k&&hv(r.a,q.a)<=.3).sort((a,b)=>hv(r.a,a.a)-hv(r.a,b.a)).slice(0,3);
 if(oc_.length)L(dv,'Also mapped in OpenStreetMap nearby: '+oc_.slice(0,4).map(q=>unk(q.name)?'name not listed':cs(q.name)).join('; '),'color:#c9d6f2;margin-top:4px','discovery');
 if(ds.length)L(dv,'Also listed within 300 m: '+ds.map(q=>`${NM(q)} (${CLS[q.k][0]}, ${SUBL(q)})`).join('; '),'color:#c9d6f2;margin-top:4px','discovery');
 if(oc_.length||ds.length)L(dv,'Discovery · nearby listing, not checked to be the same site','color:#8b9aa1','discovery');
 L(dv,'Discovery · listed site, not a confirmed electricity user','color:#8b9aa1','discovery');
 c.area=ap(dv,el('div'));L(dv,SCR,'color:#8b9aa1;margin-top:4px');c.box=ap(dv,el('div'));c.sub=ap(dv,el('div','margin-top:6px'));c.csv=ap(dv,el('div'));
 c.pd=L(c.box,'REPD projects: loading…','margin-top:4px');Ra(c,c.sm.textContent);
 sb(m,c,x,y,n);return c},
sb=(m,c,x,y,n)=>{if(S.pp!==c)return;let Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},subs=Object.hasOwn(Lk,'substations')?Lk.substations:null;c.sub.textContent='';
 if(!AI(subs)||!subs.length||typeof M.nearestSubstations!=='function'){L(c.sub,'Substation data not loaded yet; trying again.');nl(m,[x,y]);return n?setTimeout(()=>sb(m,c,x,y,n-1),2e3):0}
 let k;try{k=c.k=M.nearestSubstations(x,y,subs)}catch(e){note('nearest: '+msg(e));L(c.sub,'Substation data unavailable.');k=c.k=[]}
 L(c.sub,`Screening · ${k.length} nearest substations, straight line. Not capacity or connection feasibility.`,'color:#5fbdc2');
 if(!k.length){let b=k.beyondRadiusNearest;L(c.sub,`No substation within ${k.radiusKm||40} km`+(b?` (nearest: ${cs(b.name||'unnamed substation')}, ${KV(b)} kV, ${k2(b.km)} km)`:''))}
 for(let a of k)L(c.sub,`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'color:#c9d6da');
 S.fk=[[x,y],...k.map(a=>a.at)];nl(m,[x,y],k);cpos();nz(m,x,y);
 if(typeof M.distanceKm!='function'||typeof M.isProjectTech!='function'){c.pd.textContent='REPD projects unavailable: the map measure is not loaded yet. Tap the site again.';return}
 RG(m,M).then(G=>{if(S.pp!==c)return;c.all=near(G,M,x,y);c.fk0=S.fk.slice();rr(m,c)}).catch(e=>{if(S.pp!==c)return;c.pd.textContent=`REPD projects unavailable: ${msg(e)}. Tap the site again to retry.`;Ru(c,'REPD unavailable',c.pd.textContent)})},
ar=c=>{let A=c.area,r=c.r,f=c.all.filter(q=>q.km<=5),t=[],z=0;A.textContent='';
 for(let[v,n]of RpF.st)if(v!='all'){let q=f.filter(o=>RpS(o.p.status)==v),w=RpW(q.map(o=>o.p)),u=q.filter(o=>!(o.p.capacity>0)).length;z+=u;if(q.length)t.push(`${n} ${q.length}${w>0?' · '+N(w)+' MW stated':''}${u?` (${u} not stated)`:''}`)}
 let o=CK.map(k=>[k,S.data.dots.filter(q=>q!==r&&q.k==k&&hv(r.a,q.a)<=5).length]).filter(v=>v[1]).map(([k,v])=>`${CLS[k][0]} ${v}`),s=c.k&&c.k[0];
 L(A,`Within 5 km: ${pl(f.length,'REPD project')}${t.length?' · '+t.join(' · '):''}`,'margin-top:6px;color:#cfe0ff');
 L(A,`Other listed sites within 5 km: ${o.length?o.join(' · '):'none'}${s?` · nearest substation ${KV(s)} kV, ${k1(s.km)} km`:''}`,'color:#c9d6da');
 if(z)L(A,'Capacity not stated: unknown, not zero.','color:#8b9aa1')},
rr=(m,c)=>{let f=S.rf,{sel,P}=sites(c.all,f),box=c.box,all=f.st==='all'&&f.te==='all',nmv=v=>(RpF.st.find(q=>q[0]===v)||RpF.te.find(q=>q[0]===v))[1],fa=all?'all statuses and technologies':[f.st,f.te].filter(v=>v!=='all').map(nmv).join(' · ');
 ar(c);box.textContent='';c.P=P;
 for(let[k,defs,lb]of[['st',RpF.st,'Status'],['te',RpF.te,'Tech']]){let row=ap(box,el('div','display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0 2px'));row.setAttribute('role','group');row.setAttribute('aria-label','REPD '+lb.toLowerCase()+' filter');
  ap(row,el('span','color:#8b9aa1;font-size:11px;min-width:40px',lb));
  for(let[v,t]of defs){let on=f[k]===v,b=ap(row,el('button',`min-height:44px;padding:0 10px;background:${on?'#2f5fa8':'#050a12'};border:1px solid #2f5fa8;border-radius:3px;color:${on?'#e8eef9':'#8fb4ff'};font:11px/1 monospace;cursor:pointer`,t));
   b.type='button';b.dataset.offtakersRepdFilter=k+':'+v;b.setAttribute('aria-pressed',on);b.addEventListener('click',()=>{if(f[k]!==v&&S.pp===c){f[k]=v;rr(m,c);box.querySelector(`[data-offtakers-repd-filter="${k}:${v}"]`)?.focus?.()}})}}
 let parts=P.reduce((s,g)=>s+g.parts.length,0),reach=P.length?P[P.length-1].km:0;
 c.pd=L(box,P.length?`Screening · ${pl(P.length,'nearest REPD site')}${parts>P.length?` (${N(parts)} projects; those at one point grouped)`:''}, all within ${k1(reach)} km, straight line (${fa}):`:`Screening · no REPD site within ${R40} km, straight line (${fa}).`,'margin-top:6px;color:#ffc48a');
 if(P.length&&P.length<NR)L(box,`Only ${pl(P.length,'REPD site')} within ${R40} km${all?'':' for this filter'}.`,'color:#ffc48a');
 let sl=[];P.forEach((g,i)=>{let p=g.parts[0],one=g.parts.length===1,b=tier(ap(box,el('a','display:block;padding:12px 0 6px;border-top:1px solid #1d2f52;color:#ffb27a;text-decoration:none',`${i+1}. ${RpG(g)}${RpC(g.parts)} · ${one?cs(p.status)+' · '+cs(p.name):g.parts.length+' projects at this point:'} ▸`)),'screening');
  b.href='#';b.addEventListener('click',e=>{if(e.preventDefault)e.preventDefault();pv(m,c,g)});
  for(let q of g.parts){one||ap(box,tier(el('div','padding:0 0 2px 12px;color:#c9a27e;font-size:11px',`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`),'record'));sl.push([ap(box,el('div')),q])}});
 L(box,'Record · REPD (DESNZ, OGL v3.0): list from the Apr 2026 extract; address, ref, operator and planning fields from the Jul 2026 extract, only on an exact point, name, MW and type match. Status as registered, not as built.','margin-top:6px;color:#8b9aa1','record');
 RpH(c,sl);cv(c);
 c.sm.textContent=`${c.smb} · ${P.length?pl(P.length,'nearest REPD site'):'no REPD site'} · details`;Ra(c,c.pd.textContent);
 try{nl(m,c.fk0[0],c.k,P)}catch(e){note('links: '+msg(e))}top();
 cpos();S.fk=[...c.fk0,...P.map(g=>g.a)];m.isMoving&&m.isMoving()?(cm(m),m.once('moveend',cw)):ck()},
RpH=(c,sl)=>{let r=()=>{RpH(c,sl);c.sm.focus?.()},F=(C,e)=>{if(S.pp==c){for(let[s,q]of sl){s.textContent='';let b=ap(s,RpB(q,RpP.get(q),C,e));if(e){b.setAttribute('role','button');b.setAttribute('tabindex','0');b.style.cursor='pointer';b.addEventListener('click',r);b.addEventListener('keydown',k=>{if(k.key=='Enter'||k.key==' '){k.preventDefault?.();r()}})}}
  if(sl.length)Ru(c,e?'REPD records unavailable':'',e&&`REPD records unavailable: ${msg(e)}. Tap a record line to retry.`)}};F(S.rc);RpQ(sl.map(v=>RpP.get(v[1]))).then(F,e=>F(0,e))},
cq=v=>{let s=v==null?'':String(v).replace(/\p{Cf}/gu,'');if(typeof v!='number'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return/[",\r\n#]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s},
csv=c=>{let[x,y]=c.r.a,J=q=>{let o=S.rc&&RpJ(q,RpP.get(q),S.rc);return o||null},rows=[['kind','name','ref','technology','status','MW','km','lon','lat','source','licence','data date']];
 for(let g of c.P||[])for(let q of g.parts){let o=J(q),a=RpP.get(q)||g.a;rows.push(['REPD project',q.name,o?o.repd_ref:'',q.raw_tech||q.tech,q.status,q.capacity>0?+q.capacity:'not stated',k2(g.km),a[0],a[1],o?'REPD (DESNZ) Jul 2026 extract, exact match':'REPD (DESNZ) Apr 2026 map register','OGL v3.0',o?(o.source_record_updated||'record date not stated'):'Apr 2026 extract'])}
 for(let a of c.k||[])rows.push(['substation',a.name||'unnamed substation','','',KV(a)+' kV','',k2(a.km),a.at[0],a.at[1],'OpenStreetMap as loaded by the map','ODbL 1.0','not carried']);
 for(let{q,km}of c.cv||[])rows.push(['conventional power site',NM(q),'',SUBL(q),BST[q.t],MW(q.p)||'not stated',k2(km),q.a[0],q.a[1],(q.p.sources||[]).map(s=>s.name).join('; ')||'not stated',(q.p.sources||[]).map(s=>String(s.licence||'').split(/ \(|, \(c\)/)[0]).join('; ')||'licence not stated','listed site']);
 return[`# GridAtlas potential offtakers vicinity sheet · generation ${GEN} · tap point ${x},${y} (${NM(c.r).replace(/[\r\n]/g,' ')}) · ${new Date().toISOString()}`,'# '+SCR+' A listing is not electricity demand. '+NOTSHOWN,...rows.map(r=>r.map(cq).join(','))].join('\n')+'\n'},
cv=c=>{c.csv.textContent='';let b=ap(c.csv,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer','Download vicinity sheet (CSV)'));b.type='button';b.dataset.offtakersCsv='';
 b.addEventListener('click',()=>{try{let u=URL.createObjectURL(new Blob([csv(c)],{type:'text/csv'})),a=el('a');a.href=u;a.download=`offtaker-vicinity-${GEN}.csv`;ap(document.body,a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4e3)}catch(e){note('csv: '+msg(e))}})},
pv=(m,c,g,bl='◀ back to offtaker')=>{let back=c.re,[x,y]=g.a,ps=g.parts;pc();
 let v=cd(m,'REPD project',`REPD · ${RpU(ps,RpN).sort().join(' + ')}${RpMW(RpW(ps))}`,{foot:'Record · REPD (DESNZ, Apr 2026, OGL v3.0). Status as registered, not as built. '+NOTSHOWN,open:1,back:[bl,()=>{pc();back();S.pp&&S.pp.sm.focus?.()}]});
 v.sm.textContent=`${k2(g.km)} km from ${NM(c.r)} (straight line) · details`;
 let sl=ps.map(q=>(L(v.det,`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`,'color:#ffb27a;margin-top:6px'),[ap(v.det,el('div')),q]));RpH(v,sl);
 let Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},k=[];try{k=AI(Lk.substations)&&Lk.substations.length?M.nearestSubstations(x,y,Lk.substations):[]}catch(e){note('nearest: '+msg(e))}
 L(v.det,'Screening · nearest substations to this project, straight line. Not its declared connection or capacity.','color:#5fbdc2;margin-top:6px');for(let a of k)L(v.det,`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'color:#c9d6da');
 v.k=k;S.fk=[[x,y],...k.map(a=>a.at)];try{nl(m,[x,y],k)}catch(e){note('links: '+msg(e))}cpos();nz(m,x,y);v.querySelector('[data-offtakers-back]')?.focus?.()},
tap=e=>{if(!S.on)return;let f=th(e);if(f)try{e.gridatlasClaim='offtakers'}catch(_){}setTimeout(()=>{try{tq(e,f)}catch(x){note('tap: '+msg(x))}},0)},
th=e=>{let m=mh();if(!S.on||!m||!m.getLayer(HIT)||!S.data)return null;let px=e.point.x??e.point[0],py=e.point.y??e.point[1],f=null,dm=1/0;
 for(let q of m.queryRenderedFeatures(e.point,{layers:[HIT]})){let r=S.data.dots[q.properties&&q.properties.i];if(!r||!S.cls[r.k]||r.k=='b'&&!S.bst[r.t])continue;let a=m.project(r.a),d=(a.x-px)**2+(a.y-py)**2;if(d<dm){dm=d;f=r}}
 return f},
tq=(e,f)=>{let m=mh();if(!S.on||!m)return;
 if(!f){if(S.pp&&!S.pp.contains(e.originalEvent&&e.originalEvent.target))pc();return}
 (f.k=='c'?dcc:oc)(m,f);let lc=document.querySelector('[data-lightning-card]'),x=lc&&[...lc.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close');x&&x.click();
 for(let b of (m.getContainer?.()||document).querySelectorAll('.maplibregl-popup-close-button'))b.click()},
co=e=>{if(e&&e.detail&&e.detail.owner!=='offtakers')pc()},
VB=[['all','All'],['400','400'],['275','275'],['132','132'],['33','33–66 kV']],
VK=(v,b)=>b=='all'||(b=='400'?v>=399.5:b=='275'?v>=274.5&&v<399.5:b=='132'?v>=131.5&&v<274.5:v<131.5),
LC={s:'#ffccee',r:'#88aa00',v:'#999988'},TC={s:'#ffccee',r:'#c6dd7a',v:'#c9c9bb'},
TB=[['a','Area'],['s','Substations'],['r','REPD'],['v','Conventional']],SN={s:'Substations',r:'REPD sites',v:'Conventional power sites'},
D10=10,KM3=[5,10,20],
DHEAD='A listing or pipeline entry (screening): not a confirmed demand, contract, commitment or connection.',
PN=()=>typeof performance=='object'&&performance.now?performance.now():Date.now(),
RMo=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches===true}catch(_){return false}},
lcv=()=>S.cv||(S.cv=(CVF?gx(CVF,CVFSHA,PCAP).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),cn(o.features))):Promise.reject(Error('not published')))
 .catch(e=>(S.cve=msg(e),note('conventional: '+S.cve),S.cv=null,{o:S.data.dots.filter(q=>q.k=='b'&&q.t!='cc').map(q=>({id:q.p.id,a:q.a,n:NM(q),op:q.op,f:SUBL(q),te:'',mw:MW(q.p)||null,st:BST[q.t].toLowerCase(),p:q.p})),bad:0,fb:1}))),
CT=v=>(/^(CCGT|OCGT|CHP|EfW)\b/.exec(v.te)||[v.f=='fuel not stated'?'Power site':v.f[0].toUpperCase()+v.f.slice(1)])[0],
KA=v=>(AI(v.kva)?v.kva:[v.kv]).filter(x=>x>0),
MWL=w=>w.it!=null&&w.gc!=null?`IT load ${N(w.it)} MW · grid connection ${N(w.gc)} MW`:w.it!=null?`IT load ${N(w.it)} MW · grid connection not stated`:w.gc!=null?`Grid connection ${N(w.gc)} MW · IT load not stated`:'IT load and grid connection not stated',
dcc=(m,r,n=15,o={})=>{let p=r.p,w=DMW(p),c=cd(m,'Data centre','Data centre (screening)',{open:1,hh:1,foot:'Not shown here: electricity use, connection terms, TEC, queue position, consent, viability.'}),h=c.head,dv=c.det,st=DST[r.t],sr=p.sources||[];
 Object.assign(c,{r,tab:o.tab||'a',sh:o.sh||{},vb:o.vb||'all',rst:o.rst||'all'});S.fk=null;c.foot.dataset.tier='screening';
 L(h,`${NM(r)} · ${unk(r.op)?'operator not listed':cs(r.op)}`,'color:#e9dcff;font-weight:bold;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis','record');
 L(h,MWL(w),'color:#9fb3ba;white-space:nowrap;overflow:hidden;text-overflow:ellipsis','record');
 c.tl=tier(ap(h,el('div')),'screening');c.pn=ap(h,el('div'));c.csv=ap(h,el('div'));
 L(dv,DHEAD,'color:#c9b3ff;margin-top:4px');
 if(w.un!=null)L(dv,`Also stated: ${N(w.un)} MW, not said to be IT load or grid connection${(o=>o&&typeof o.label=='string'?' ('+cs(o.label.split('|')[1]||'').trim()+')':'')(p.unclassified_mw||(p.mw_unclassified||[])[0])}; not added to either.`,'color:#9fb3ba','record');
 L(dv,`Status: ${r.dc?st[0].toLowerCase():'not tracked'} · ${cs(p.status_basis||p.status_source_id||(r.dc?'source not stated':'OpenStreetMap listing'))}`,'color:#9fb3ba','record');
 if(r.t!='op')L(dv,'A pipeline entry is not a commitment: plans change, stall or are withdrawn.','color:#9fb3ba');
 L(dv,'IT load is what the computing equipment draws. Grid connection is the import capacity agreed with the network operator, which also covers cooling and losses. Neither is derived from the other here.','color:#8b9aa1');
 if(w.it==null||w.gc==null)L(dv,'Not stated is unknown, not zero.','color:#8b9aa1');
 if(!r.dc||sr.every(s=>/openstreetmap/i.test(s.source||s.dataset||s.name)))L(dv,'Listed in OpenStreetMap; no open IT-load or connection figure found.','color:#8b9aa1');
 let ds=p.dates&&typeof p.dates=='object'?Object.entries(p.dates).filter(([,v])=>typeof v=='string'&&v):[],pr=AI(p.planning_refs)?p.planning_refs:[],qr=AI(p.connection_refs)?p.connection_refs:[];
 if(ds.length)L(dv,'Dates: '+ds.slice(0,6).map(([k,v])=>cs(k).replace(/_/g,' ')+' '+cs(v)).join(' · '),'color:#9fb3ba','record');
 if(pr.length)L(dv,'Planning: '+pr.slice(0,3).map(o=>cs(o&&o.authority)+' '+cs(o&&o.reference)).join('; '),'color:#9fb3ba','record');
 if(qr.length)L(dv,'Connection queue refs: '+qr.slice(0,3).map(cs).join('; ')+' (a queue entry is not a connection)','color:#9fb3ba','record');
 if(AI(p.conflicts)&&p.conflicts.length)L(dv,`${pl(p.conflicts.length,'conflict')} between sources: `+p.conflicts.slice(0,4).map(o=>cs(o&&o.field)).join(', '),'color:#ffc48a','record');
 for(let s of r.dc?sr.slice(0,6):[])L(dv,`Record · ${cs(s.source||s.dataset||s.name)} (${cs(String(s.licence||'licence not stated').split(/,|:/)[0])}${s.licence_status=='unverified'?', licence unverified':''})`,'color:#8b9aa1','record');
 if(AI(p.operator_alternatives)&&p.operator_alternatives.length)L(dv,'Also listed under operator: '+p.operator_alternatives.slice(0,3).map(cs).join('; ')+' (merged by the source as one site; not checked)','color:#ffc48a','record');
 r.dc||L(dv,'Record · '+LIC(r),'color:#8b9aa1','record');
 c.cam=o.cam;c.row=o.row;dg(m,c,n);return c},
dg=(m,c,n)=>{if(S.pp!==c)return;let[x,y]=c.r.a,Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},subs=Object.hasOwn(Lk,'substations')?Lk.substations:null,GS=NS.gridScope;c.ks=0;
 if(!AI(subs)||!subs.length||typeof M.nearestSubstations!='function'||typeof M.distanceKm!='function'||!GS||typeof GS.scope!='function'){c.ks='Substation data not loaded yet; trying again.';c.sc=[];dt(m,c);nl(m,[x,y]);return n?setTimeout(()=>dg(m,c,n-1),2e3):0}
 let t0=PN(),mp=S.kas===subs?S.kam:(S.kas=subs,S.kam=new Map(subs.map(s=>[s.at,s])));
 try{c.sc=GS.scope([x,y],subs,{bandsKm:[40],nearestCount:subs.length}).nearest;for(let e of c.sc)e.kva=(mp.get(e.at)||{}).kv}catch(e){note('scope: '+msg(e));c.sc=[];c.ks='Substation data unavailable.'}
 try{let o=M.nearestSubstations(x,y,subs);c.by=o.beyondRadiusNearest;if(o.some((a,i)=>!c.sc[i]||a.km!==c.sc[i].km||a.at!==c.sc[i].at))note('scope head differs from nearestSubstations')}catch(e){note('nearest: '+msg(e))}
 c.ms={search:0};dt(m,c);S.pend=(S.pend||0)+1;
 Promise.all([lcv().then(v=>{if(S.pp!==c)return;c.cvs=v;c.cva=v.o.map(q=>({q,km:M.distanceKm(x,y,...q.a)})).sort((a,b)=>a.km-b.km)}),
  typeof M.isProjectTech=='function'?RG(m,M).then(G=>{if(S.pp===c)c.all=near(G,M,x,y)},e=>{c.pe=`REPD projects unavailable: ${msg(e)}. Tap the site again to retry.`;Ru(c,'REPD unavailable',c.pe)}):(c.pe='REPD projects unavailable: the map measure is not loaded yet. Tap the site again.',0)])
 .then(()=>{if(S.pp!==c)return;c.ms.search=+(PN()-t0).toFixed(1);dt(m,c);dl3(m,c);if(c.cam)try{m.jumpTo(c.cam)}catch(_){}else dcam(m,c);
  if(c.row!=null)c.pn.querySelector(`[data-offtakers-row="${c.row}"]`)?.focus?.()}).catch(e=>note('dc: '+msg(e))).finally(()=>S.pend--)},
sets=c=>{c.k=(c.sc||[]).filter(e=>VK(e.kv,c.vb)).slice(0,N3);c.P=c.all?sites(c.all,{st:c.rst,te:'all'},N3).P:null;c.cv=c.cva?c.cva.slice(0,N3):null;
 let D=(v,q)=>q?c.sh[v]?q.length:MN(D10,q.length):0;c.nd={s:D('s',c.k),r:D('r',c.P),v:c.cv?c.cv.slice(0,D('v',c.cv)).filter(o=>o.km<=R100).length:0}},
TBL=(v,q,c)=>v=='a'?'5·10·20 km':v=='s'&&c.ks?'…':v=='r'&&c.pe?'unavailable':!q?'…':!q.length?'none ≤40 km':`${q.length} · ≤${k1(q.at(-1).km)} km`,
dt=(m,c)=>{sets(c);let T=c.tl,row=el('div','display:flex;gap:3px;margin:6px 0');T.textContent='';ap(T,row);row.setAttribute('role','tablist');row.setAttribute('aria-label','Data-centre vicinity sets');
 for(let[v,t]of TB){let on=c.tab==v,q={s:c.k,r:c.P,v:c.cv}[v],b=ap(row,el('button',`flex:1;min-width:0;min-height:52px;padding:2px;background:${on?'#1c1430':'#050a12'};border:1px solid ${on?'#b07cff':'#2f5fa8'};border-bottom:3px solid ${v=='a'?'#b07cff':LC[v]};border-radius:3px;color:${on?'#f1e9ff':'#c9d6f2'};font:11px/1.3 monospace;cursor:pointer;text-align:center`));
  ap(b,el('div','',t));ap(b,el('div','color:#9fb3ba',TBL(v,q,c)));b.type='button';b.id='gridatlas-offtakers-dc-tab-'+v;b.setAttribute('role','tab');b.setAttribute('aria-selected',on);b.setAttribute('aria-controls','gridatlas-offtakers-dc-panel');b.tabIndex=on?0:-1;b.dataset.offtakersTab=v;
  b.addEventListener('click',()=>stab(m,c,v))}
 row.addEventListener('keydown',e=>{let i=TB.findIndex(t=>t[0]==c.tab),j={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:3}[e.key];if(j==null)return;e.preventDefault?.();stab(m,c,TB[(j+4)%4][0]);T.querySelector('[aria-selected="true"]')?.focus?.()});
 let P=c.pn;P.textContent='';P.id='gridatlas-offtakers-dc-panel';P.setAttribute('role','tabpanel');P.setAttribute('aria-labelledby','gridatlas-offtakers-dc-tab-'+c.tab);P.dataset.offtakersPanel=c.tab;
 (c.tab=='a'?pa:pls)(m,c,P);dcsv(c);
 c.sm.textContent=`Data centre · ${c.k?pl(c.k.length,'substation'):'…'}, ${c.P?pl(c.P.length,'REPD site'):'…'} within 40 km, ${c.cv?c.cv.length:'…'} conventional listed · details`;cpos()},
stab=(m,c,v)=>{if(S.pp!==c||c.tab==v)return;c.tab=v;dt(m,c);dlab(m,c);let q={s:c.k,r:c.P,v:c.cv}[v];if(q&&q.length)Ra(c,`${SN[v]}: ${c.nd[v]} of ${q.length} shown on the map, nearest ${k2(q[0].km)} km.`)},
RW=(P,i,a,b,f,col)=>{let e=tier(ap(P,el('a',`display:block;min-height:44px;padding:9px 0 6px;border-top:1px solid #1d2f52;color:${col};text-decoration:none`)),'screening');ap(e,el('div','',a));ap(e,el('div','color:#9fb3ba',b+' ▸'));e.href='#';e.dataset.offtakersRow=i;e.addEventListener('click',x=>{x.preventDefault?.();f()});return e},
BT=(P,t,f,k)=>{let b=ap(P,el('button','display:block;width:100%;min-height:44px;margin:6px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1.2 monospace;text-align:left;padding:0 10px;cursor:pointer',t));b.type='button';if(k)b.dataset[k]='';b.addEventListener('click',f);return b},
CH=(P,lb,defs,cur,f,k)=>{let row=ap(P,el('div','display:flex;flex-wrap:wrap;gap:4px;margin:6px 0'));row.setAttribute('role','group');row.setAttribute('aria-label',lb);
 for(let[v,t]of defs){let on=cur==v,b=ap(row,el('button',`min-height:44px;min-width:44px;padding:0 8px;background:${on?'#2f5fa8':'#050a12'};border:1px solid #2f5fa8;border-radius:3px;color:${on?'#e8eef9':'#8fb4ff'};font:11px/1 monospace;cursor:pointer`,t));b.type='button';b.dataset[k]=v;b.setAttribute('aria-pressed',on);b.addEventListener('click',()=>{if(cur!=v)f(v)})}},
rst=(m,c,i)=>{let cam;try{let z=m.getCenter&&m.getCenter();cam=z&&{center:[z.lng,z.lat],zoom:m.getZoom()}}catch(_){}c.re=()=>dcc(m,c.r,0,{tab:c.tab,sh:c.sh,vb:c.vb,rst:c.rst,cam,row:i})},
pls=(m,c,P)=>{let v=c.tab,q={s:c.k,r:c.P,v:c.cv}[v],nn=q?c.sh[v]?q.length:MN(D10,q.length):0,X=(t,s)=>L(P,t,'color:'+(s||'#9fb3ba'));
 if(v=='s'&&c.ks)return X(c.ks);if(v=='r'&&c.pe)return X(c.pe);if(!q)return X(`${SN[v]}: loading…`);
 if(v=='s'){X(`Screening · ${pl(q.length,'nearest substation')} ≥33 kV (straight line)`,TC.s);CH(P,'Voltage band',VB,c.vb,b=>{c.vb=b;dt(m,c);dl3(m,c)},'offtakersVolt')}
 if(v=='r'){let n=q.reduce((s,g)=>s+g.parts.length,0);X(`Screening · ${pl(q.length,'nearest REPD site')}${n>q.length?` (${N(n)} projects; those at one point grouped)`:''}, straight line`,TC.r);CH(P,'REPD status filter',RpF.st,c.rst,b=>{c.rst=b;dt(m,c);dl3(m,c)},'offtakersRepdFilter')}
 if(v=='v'){let d=q.filter(o=>o.km<=R100).length;X(`Screening · ${pl(q.length,'nearest conventional power site')}, straight line`,TC.v);X(`Lines drawn for ${d} of ${q.length} (≤${R100} km); the nearest ${N3} are listed at any distance${q.length?`, out to ${k1(q.at(-1).km)} km`:''}.`);
  if(c.cvs&&c.cvs.fb)X(`From the offtakers power-station class (the conventional dataset is not loaded: ${S.cve}).`,'#ffc48a')}
 else if(q.length<N3){if(q.length)X(`Only ${q.length} ${v=='s'?'substations ≥33 kV':'REPD sites'} within ${R40} km of this site${v=='s'&&c.vb!='all'||v=='r'&&c.rst!='all'?' for this filter':''}; all are listed.`);
  else X(`None within ${R40} km.`+(v=='s'&&c.by?` Nearest: ${cs(c.by.name||'unnamed substation')}, ${k2(c.by.km)} km (not drawn).`:''))}
 q.slice(0,nn).forEach((o,i)=>{let g=v=='r'&&o,s=v=='s'&&o,w=v=='v'&&o.q,p0=g&&g.parts[0],one=g&&g.parts.length==1,ka=s&&KA(s);
  v=='s'?RW(P,i,`${i+1}. ${k2(s.km)} km · ${s.kv} kV · ${cs(s.name||'unnamed substation')}`,`${ka.length>1?'also '+ka.filter(x=>x!=s.kv).join(', ')+' kV':'single voltage'} · OSM`,()=>{rst(m,c,i);sk(m,c,'s',s)},TC.s)
  :v=='r'?RW(P,i,`${i+1}. ${k2(g.km)} km · ${RpU(g.parts,RpN).sort().join(' + ')}${RpMW(RpW(g.parts))} · ${one?cs(p0.status):g.parts.length+' projects'}`,`${one?cs(p0.name):g.parts.map(q=>cs(q.name)).join('; ')}${RpC(g.parts)}`,()=>{rst(m,c,i);pv(m,c,g,'◀ back to data centre')},TC.r)
  :RW(P,i,`${i+1}. ${k2(o.km)} km · ${cs(w.te||w.f)} · ${w.mw?N(w.mw)+' MW':'MW not stated'} · ${w.st}`,`${w.n} · ${cs(String(((w.p.sources||[])[0]||{}).name||'source not stated').split(' ')[0])}${/clos|convert/.test(w.st)?' · no connection rights implied':''}${o.km>R100?' · not drawn':''}`,()=>{rst(m,c,i);sk(m,c,'v',w,o.km)},TC.v)});
 if(q.length>D10)BT(P,c.sh[v]?'Show nearest 10 only':`Show all ${q.length} on the map and in this list`,()=>{c.sh[v]=!c.sh[v];dt(m,c);dl3(m,c);c.sh[v]&&dcam(m,c,v);P.querySelector('[data-offtakers-reveal]')?.focus?.();Ra(c,`${SN[v]}: ${c.nd[v]} of ${q.length} shown on the map.`)},'offtakersReveal');
 L(P,v=='s'?'Mapped substations (OpenStreetMap, ODbL 1.0). Not capacity, headroom or a connection point.':v=='r'?'REPD (DESNZ, OGL v3.0). Status as registered, not as built. MW is installed capacity as registered, not export or connection capacity.'
  :`${c.cvs&&!c.cvs.fb?'UK conventional power assets (NAEI 2023 OGL v3.0, GPPD v1.3.0 CC BY 4.0, OpenStreetMap ODbL 1.0)':'NAEI 2023, GPPD v1.3.0, OpenStreetMap'}. MW is installed capacity as stated by the source, not export or connection capacity. Proximity to a power station is not access to its output or its grid connection.`,'margin-top:6px;color:#8b9aa1','record')},
pa=(m,c,P)=>{let g=ap(P,el('div','display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:1px 8px;margin-top:6px;font-size:11px;color:#c9d6da;text-align:right')),C=(s,l)=>ap(g,el('span',l?'text-align:left':'',s)),sc=c.sc||[],al=c.all,cv=c.cva,
  W3=f=>KM3.map(f),R=(l,f,on)=>{C(l,1);for(let d of KM3)C(on?f(d):'…')},rw=d=>al.filter(q=>q.km<=d).map(q=>q.p),cw_=d=>cv.filter(o=>o.km<=d),Mw=v=>v>0?N(v)+' MW':'–';
 g.dataset.tier='screening';C('Within (straight line)',1);W3(d=>C(d+' km'));
 R('Substations ≥33 kV',d=>sc.filter(e=>e.km<=d).length,!c.ks);R('  of which ≥275 kV',d=>sc.filter(e=>e.km<=d&&e.kv>=274.5).length,!c.ks);
 R('REPD projects',d=>rw(d).length,!!al);R('  MW stated',d=>Mw(RpW(rw(d))),!!al);R('  not stated',d=>rw(d).filter(p=>!(p.capacity>0)).length,!!al);
 R('Conventional sites',d=>cw_(d).length,!!cv);R('  MW stated',d=>Mw(cw_(d).reduce((s,o)=>s+(o.q.mw||0),0)),!!cv);R('  not stated',d=>cw_(d).filter(o=>!o.q.mw).length,!!cv);
 if(al)L(P,'REPD at 20 km: '+RpF.st.slice(1).map(([v,t])=>`${t.toLowerCase()} ${Mw(RpW(rw(20).filter(p=>RpS(p.status)==v)))}`).join(' · '),'color:#c9d6da;margin-top:4px');
 if(cv){let a=cw_(20),s=f=>Mw(a.filter(o=>f.test(o.q.st)).reduce((t,o)=>t+(o.q.mw||0),0));L(P,`Conventional at 20 km: operating ${s(/^operat/)} · closing/closed ${s(/clos/)}`,'color:#c9d6da')}
 for(let[b]of VB.slice(1)){let e=sc.find(e=>VK(e.kv,b));L(P,`Nearest ${b=='33'?'33–66':b} kV `+(e?`${k2(e.km)} km · ${cs(e.name||'unnamed substation')}`:`none ≤${R40} km`),'color:#ffccee')}
 for(let v of'srv')L(P,`${{s:'━',r:'╍',v:'┈'}[v]} ${SN[v]} (${{s:'rose, solid',r:'olive, dashed',v:'grey, dotted'}[v]})`,'color:'+TC[v]);L(P,'◯ 5 · 10 · 20 km rings','color:#8b9aa1');
 for(let t of['Counts within straight-line circles around the site point. Not cable routes, capacity, headroom or connection offers.','MW is installed capacity as each register states it, not export or connection capacity. Generation MW is never added to the site\'s MW.','Not stated is unknown, not zero.'])L(P,t,'color:#8b9aa1;margin-top:4px');
 let n=(c.k||[]).length+(c.P||[]).length+(c.cv||[]).filter(o=>o.km<=R100).length;if(n>c.nd.s+c.nd.r+c.nd.v)BT(P,`Draw all ${n} links`,()=>{c.sh={s:1,r:1,v:1};dt(m,c);dl3(m,c);dcam(m,c,'s')},'offtakersDrawAll')},
dcam=(m,c,v)=>{try{let C=m.getContainer(),Wd=C.clientWidth||393,H=C.clientHeight||852,B=(c.bb||8)+(c.offsetHeight||188)+24,f=(q,i)=>q&&q.length?q[MN(i,q.length-1)].km:0,
  r=MX(f(c.k,D10-1),f(c.P,D10-1),f(c.cv,0));if(v){let q={s:c.k,r:c.P,v:(c.cv||[]).filter(o=>o.km<=R100)}[v];r=MX(r,f(q,99))}r=MN(R40,MX(2,r));
  let hs=MX(40,MN(Wd-80,H-150-B)/2),z=MX(7.5,MN(13,Math.log2(78271.517*Math.cos(c.r.a[1]*Math.PI/180)*hs/(r*1e3)))),go=()=>{cm(m);m.easeTo({center:c.r.a,zoom:z,offset:[0,(150-MN(B,H-200))/2],duration:RMo()?0:900})};
  m.isMoving&&m.isMoving()?m.once('moveend',go):go()}catch(e){note('camera: '+msg(e))}},
dl3=(m,c)=>{let o=c.r.a,t0=PN(),F=[],G=[],Z=(a,b)=>['interpolate',['linear'],['zoom'],6,a,12,b],I=s=>['==',['get','s'],s],
  add=(s,a,i,km,l)=>{F.push({type:'Feature',properties:{s,k:i},geometry:{type:'LineString',coordinates:[o,a]}});G.push({type:'Feature',properties:{s,k:i,id:s+i,l,km},geometry:{type:'Point',coordinates:a}})};
 c.k.slice(0,c.nd.s).forEach((e,i)=>add('s',e.at,i,e.km,`${e.kv} kV · ${k2(e.km)} km`));(c.P||[]).slice(0,c.nd.r).forEach((g,i)=>add('r',g.a,i,g.km,`${RpU(g.parts,RpN).sort()[0]}${RpMW(RpW(g.parts))} · ${k2(g.km)} km`));
 (c.cv||[]).slice(0,c.sh.v?N3:D10).forEach((v,i)=>v.km<=R100&&add('v',v.q.a,i,v.km,`${CT(v.q)}${v.q.mw?' '+N(v.q.mw)+' MW':''} · ${k2(v.km)} km`));c.G=G;
 try{if(m.getSource(DS[0])){m.getSource(DS[0]).setData(FC(F));m.getSource(DS[1]).setData(FC(G))}else{nl(m,o);let K=Math.cos(o[1]*Math.PI/180);
  m.addSource(DS[0],{type:'geojson',data:FC(F)});m.addSource(DS[1],{type:'geojson',data:FC(G)});
  m.addSource(DS[2],{type:'geojson',data:FC(KM3.map(d=>({type:'Feature',properties:{l:d+' km'},geometry:{type:'LineString',coordinates:Array.from({length:65},(_,i)=>[o[0]+d/111.32/K*Math.sin(i*Math.PI/32),o[1]+d/111.32*Math.cos(i*Math.PI/32)])}})))});
  m.addLayer({id:DI[0],type:'line',source:DS[2],paint:{'line-color':'#8b9aa1','line-opacity':.45,'line-width':1,'line-dasharray':[3,3]}});
  m.addLayer({id:DI[1],type:'line',source:DS[0],paint:{'line-color':['match',['get','s'],'s',LC.s,'r',LC.r,LC.v],'line-width':Z(4,9),'line-opacity':.1,'line-blur':Z(2,6)},layout:{'line-cap':'round'}});
  [['s',null],['r',[2,2]],['v',[.5,2]]].forEach(([s,d],j)=>m.addLayer({id:DI[2+j],type:'line',source:DS[0],filter:I(s),paint:Object.assign({'line-color':LC[s],'line-width':Z(1,2),'line-opacity':.7},d?{'line-dasharray':d}:{}),layout:{'line-cap':'round'}}));
  m.addLayer({id:DI[5],type:'circle',source:DS[1],paint:{'circle-radius':Z(2.5,4.5),'circle-color':['case',I('v'),'rgba(0,0,0,0)',['match',['get','s'],'s',LC.s,LC.r]],'circle-stroke-width':['case',I('v'),2,1],'circle-stroke-color':['case',I('v'),LC.v,'#000']}});
  try{m.addLayer({id:DI[6],type:'symbol',source:DS[1],filter:['in',['get','id'],['literal',[]]],layout:{'text-field':['get','l'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-allow-overlap':false,'symbol-sort-key':['get','k'],'text-font':sf(m)},paint:{'text-color':['match',['get','s'],'s',TC.s,'r',TC.r,TC.v],'text-halo-color':'#000c10','text-halo-width':1.5}});
   m.addLayer({id:DI[7],type:'symbol',source:DS[2],layout:{'text-field':['get','l'],'text-size':10,'text-font':sf(m)},paint:{'text-color':'#8b9aa1','text-halo-color':'#000c10','text-halo-width':1.5}})}catch(e){note('labels: '+msg(e))}}
  dlab(m,c)}catch(e){note('links: '+msg(e))}
 top();S.perf={links:F.length,ms:+(PN()-t0).toFixed(1),search_ms:c.ms&&c.ms.search}},
dlab=(m,c)=>{let t=c.tab,G=c.G||[],ids=t=='a'?['s0','r0','v0']:G.filter(f=>f.properties.s==t&&f.properties.k<3).map(f=>f.properties.id);
 if(t=='s')for(let b of['400','275','132']){let i=(c.k||[]).slice(0,c.nd.s).findIndex(e=>VK(e.kv,b));i>2&&ids.push('s'+i)}
 if(t=='r'||t=='v'){let q=(t=='r'?(c.P||[]).map(g=>RpW(g.parts)):(c.cv||[]).map(o=>o.km<=R100?o.q.mw||0:0)).slice(0,t=='r'?c.nd.r:c.sh.v?N3:D10),i=q.indexOf(MX(0,...q));q[i]>0&&i>2&&ids.push(t+i)}
 try{m.getLayer(DI[6])&&m.setFilter(DI[6],['in',['get','id'],['literal',ids.slice(0,6)]]);for(let[j,s]of['s','r','v'].entries())m.getLayer(DI[2+j])&&m.setPaintProperty(DI[2+j],'line-opacity',t=='a'?.7:t==s?.9:.3)}catch(e){note('labels: '+msg(e))}},
sk=(m,c,t,v,km)=>{let back=c.re,o=t=='s'?v.at:v.a,[x,y]=o,Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},p=v.p||{};pc();
 let d=cd(m,t=='s'?'Substation':'Conventional power site',t=='s'?`Substation · ${v.kv} kV`:`Power site · ${cs(v.te||v.f)}`,{open:1,foot:NOTSHOWN,back:['◀ back to data centre',()=>{pc();back()}]}),X=(s,col,ti)=>L(d.det,s,'margin-top:4px;color:'+(col||'#9fb3ba'),ti);
 d.sm.textContent=`${k2(t=='s'?v.km:km)} km from ${NM(c.r)} (straight line) · details`;S.fk=[o];nl(m,o);
 if(t=='s'){X(`${cs(v.name||'unnamed substation')} · ${KA(v).join(', ')} kV${v.operator?' · operator '+cs(v.operator):''}`,TC.s,'record');X('Record · OpenStreetMap as loaded by the map (ODbL 1.0). Not capacity, headroom or a connection point.','#8b9aa1','record');
  RG(m,M).then(G=>{if(S.pp!==d)return;let P=sites(near(G,M,x,y),{st:'all',te:'all'},5).P;X('Screening · 5 nearest REPD sites to this substation, straight line. Not its connections.',TC.r);
   P.forEach((g,i)=>X(`${i+1}. ${RpG(g)}${RpC(g.parts)} · ${cs(g.parts[0].status)} · ${cs(g.parts[0].name)}`,'#c9d6da'));S.fk=[o,...P.map(g=>g.a)];nl(m,o,null,P);ck()}).catch(e=>X('REPD projects unavailable: '+msg(e)))}
 else{X(`${v.n} · ${unk(v.op)?'operator not listed':cs(v.op)}`,TC.v,'record');X(`${v.f} · ${cs(v.te||'type not stated')} · ${v.mw?N(v.mw)+' MW installed (as stated; not connection capacity)':'MW not stated (unknown, not zero)'}`,0,'record');
  X(`Status: ${v.st}${p.status_basis?' · '+cs(p.status_basis):''}`,0,'record');X('Record · '+((p.sources||[]).map(s=>`${cs(String(s.name||'').split(' (')[0])} (${cs(String(s.licence||'licence not stated').split(/[:,]/)[0])})`).join(' · ')||'source not stated'),'#8b9aa1','record');
  let k=[];try{k=AI(Lk.substations)&&Lk.substations.length?M.nearestSubstations(x,y,Lk.substations):[]}catch(e){note('nearest: '+msg(e))}
  X('Screening · nearest substations to this site, straight line. Not its declared connection or capacity.',TC.s);for(let a of k)X(`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'#c9d6da');S.fk=[o,...k.map(a=>a.at)];try{nl(m,o,k)}catch(e){note('links: '+msg(e))}}
 cpos();nz(m,x,y);d.querySelector('[data-offtakers-back]')?.focus?.()},
dcsv=c=>{c.csv.textContent='';let n=(c.k||[]).length+(c.P||[]).reduce((s,g)=>s+g.parts.length,0)+(c.cv||[]).length,b=BT(c.csv,`Download all ${n} as CSV (vicinity sheet)`,()=>{if(b.busy)return;b.busy=1;b.textContent='Preparing… (joining REPD records)';
  let ps=(c.P||[]).flatMap(g=>g.parts),T,go=()=>{clearTimeout(T);if(!b.busy)return;b.busy=0;b.textContent=`Download all ${n} as CSV (vicinity sheet)`;
   try{let u=URL.createObjectURL(new Blob([dsv(c)],{type:'text/csv'})),a=el('a');a.href=u;a.download=`datacentre-vicinity-${GEN}-${String(c.r.p.id||'site').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)}.csv`;ap(document.body,a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4e3)}catch(e){note('csv: '+msg(e))}};
  T=setTimeout(go,TMO);RpQ(ps.map(q=>RpP.get(q))).then(go,go)},'offtakersCsv')},
dsv=c=>{let r=c.r,[x,y]=r.a,w=DMW(r.p),M=v=>v==null?'not stated':v,J=q=>S.rc&&RpJ(q,RpP.get(q),S.rc)||null,id=r.p.id||'',sl=r.dc?DST[r.t][0]:'not tracked',rows=[
  ['data centre',0,NM(r),id,'data centre',sl,'','',M(w.it),'IT load',0,x,y,'site',r.dc?'data-centre dataset':'OpenStreetMap','ODbL 1.0','']];
 if(w.gc!=null)rows.push(['data centre',0,NM(r),id,'data centre',sl,'','',w.gc,'grid connection',0,x,y,'site','data-centre dataset','ODbL 1.0','']);
 (c.k||[]).forEach((e,i)=>rows.push(['substation',i+1,e.name||'unnamed substation','',e.kv+' kV','',e.kv,KA(e).join(';'),'','',k2(e.km),e.at[0],e.at[1],i<c.nd.s?'yes':'no','OpenStreetMap as loaded by the map','ODbL 1.0','not carried']));
 (c.P||[]).forEach((g,i)=>{for(let q of g.parts){let o=J(q),a=RpP.get(q)||g.a;rows.push(['REPD project',i+1,q.name,o?o.repd_ref:'',q.raw_tech||q.tech,q.status,'','',q.capacity>0?+q.capacity:'not stated','installed (REPD)',k2(g.km),a[0],a[1],i<c.nd.r?'yes':'no',o?'REPD (DESNZ) Jul 2026 extract, exact match':'REPD (DESNZ) Apr 2026 map register','OGL v3.0',o?(o.source_record_updated||'record date not stated'):'Apr 2026 extract'])}});
 (c.cv||[]).forEach(({q,km},i)=>rows.push(['conventional',i+1,q.n,q.id||q.p.id||'',`${q.f} ${q.te}`.trim(),q.st,'','',q.mw||'not stated',`installed (${q.mw?'GPPD':'not stated'})`,k2(km),q.a[0],q.a[1],km<=R100&&i<(c.sh.v?N3:D10)?'yes':'no',(q.p.sources||[]).map(s=>String(s.name||'').split(' (')[0]).join('; ')||'not stated',(q.p.sources||[]).map(s=>String(s.licence||'').split(/[:,]/)[0]).join('; ')||'licence not stated',cs(q.p.status_date||'')]));
 let s=[`# GridAtlas data-centre vicinity sheet · generation ${GEN} · site ${id} ${NM(r).replace(/[\r\n]/g,' ')} · point ${x},${y} · ${new Date().toISOString()}`,'# Straight-line distances from the site point. Not cable routes, capacity, headroom, connection offers or feasibility.',
  `# Site: IT load ${w.it!=null?w.it+' MW':'not stated'} · grid connection ${w.gc!=null?w.gc+' MW':'not stated'}. Never added together. A pipeline entry is not a commitment.`,'# MW columns are installed capacity as each source states it, not export or connection capacity. "not stated" is unknown, not zero.',
  'set,rank,name,ref,type_or_voltage,status,kv_max,kv_all,mw_stated,mw_basis,km_straight_line,lon,lat,drawn_on_map,source,licence,data_date'].join('\n')+'\n',k=0;
 for(let o of rows){let l=o.map(cq).join(',')+'\n';if(++k>400||s.length+l.length>256e3){s+=`# truncated at ${k>400?'400 rows':'256 kB'}\n`;break}s+=l}return s},
BTN=(a,t)=>`<button type="button" class="map-ctrl-btn" ${a}>${t}</button>`,
bg=key=>{let g=document.createElement('div');g.className='key-group';g.style.gridColumn='1/-1';g.dataset.offtakersGroup=key;
 g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-offtakers-control="toggle"> <span data-offtakers-label="${key}" style="color:#8fb4ff">${BASE}</span></label>`
 +`<div data-offtakers-controls="${key}" hidden><div role="group" aria-label="Offtaker classes" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">${BTN('data-offtakers-all','All')}${CK.filter(k=>k!='c').map(k=>BTN(`data-offtakers-class="${k}" aria-pressed="false"`,CLS[k][0])).join('')}</div>`
 +`<div role="group" aria-label="Data centres" data-offtakers-dc style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin:4px 0;padding:4px;border:1px solid #6f4fc2;border-radius:3px">${BTN('data-offtakers-class="c" aria-pressed="false"',CLS.c[0]+' · 30/30/30')}${DK.map(k=>`<span style="font-size:11px;color:#ccc;white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${CLS.c[1]};border:2px solid ${DST[k][1]};margin-right:3px;vertical-align:middle"></span>${DST[k][0]}</span>`).join('')}</div>`
 +`<div role="group" aria-label="Power station status" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:4px 0"><span style="font-size:11px;color:#bbb">Power stations:</span>${BK.map(k=>BTN(`data-offtakers-bst="${k}" aria-pressed="true"`,BST[k])).join('')}</div>`
 +`</div><div data-offtakers-status role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word"></div><div data-offtakers-foot hidden style="font-size:11px;color:#bbb">${LEG} ${DLEG} ${FOOT}</div>`;
 g.querySelectorAll('.map-ctrl-btn').forEach(b=>{b.style.cssText+='min-height:44px;min-width:44px';let k=b.dataset.offtakersClass||(b.dataset.offtakersBst?'b':'');if(k)b.style.borderLeft='4px solid '+CLS[k][1]});
 let q=s=>g.querySelector(s),o={key,group:g,toggle:q('[data-offtakers-control]'),label:q('[data-offtakers-label]'),ctl:q('[data-offtakers-controls]'),st:q('[data-offtakers-status]'),ft:q('[data-offtakers-foot]'),chips:{}};
 o.bchips={};g.querySelectorAll('[data-offtakers-class]').forEach(b=>o.chips[b.dataset.offtakersClass]=b);g.querySelectorAll('[data-offtakers-bst]').forEach(b=>o.bchips[b.dataset.offtakersBst]=b);
 g.addEventListener('click',ev=>{let b=ev.target.closest('button');if(!b||!g.contains(b))return;let d=b.dataset;if(d.offtakersClass)S.cls[d.offtakersClass]=!S.cls[d.offtakersClass];else if(d.offtakersBst)S.bst[d.offtakersBst]=!S.bst[d.offtakersBst];else if(d.offtakersAll!=null){for(let k of CK)S.cls[k]=!!CLS[k][5];for(let k of BK)S.bst[k]=true}else return;
  rf();let r=S.pp&&S.pp.r;if(r&&(!S.cls[r.k]||r.k=='b'&&!S.bst[r.t]))pc();pt()});
 g.addEventListener('change',ev=>{let t=ev.target;if(t&&t.dataset&&t.dataset.offtakersControl==='toggle')so(!!t.checked)});return o},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},
pt=()=>{let d=S.data,n=d?d.dots.filter(r=>S.cls[r.k]&&(r.k!='b'||S.bst[r.t])).length:0,lab=!S.on?BASE:S.busy?BASE+' [LOAD]':S.err?BASE+' [FAIL]':`${BASE} [${N(n)} sites]`,
 st=!S.on?'':S.busy?'Loading the pinned open data…':S.err?'Nothing drawn: '+S.err:`${N(n)} sites drawn (${CK.filter(k=>S.cls[k]).map(k=>CLS[k][0]+' '+N(d.counts[k])).join(' · ')||'no class selected'}) · tap a site for its 15 nearest REPD sites and 5 nearest substations, a data centre for 30 substations, 30 REPD sites and 30 conventional power sites (straight line) · data centres: ${d.pl?`${N(d.pl.o.length)} from the open pipeline (${DK.map(k=>[k,d.pl.o.filter(r=>r.t==k).length]).filter(v=>v[1]).map(([k,n])=>DST[k][0].toLowerCase()+' '+N(n)).join(', ')})${d.pl.bad?`, ${N(d.pl.bad)} skipped`:''}`:S.pe?'the offtakers listing (data-centre file not loaded: '+S.pe+')':'loading…'}`;
 for(let o of S.sfs){if(o.toggle.checked!==S.on)o.toggle.checked=S.on;txt(o.label,lab);o.label.style.opacity=S.err?'0.8':'1';o.ctl.hidden=o.ft.hidden=!S.on;txt(o.st,st);
  for(let k in o.chips){let b=o.chips[k];b.setAttribute('aria-pressed',S.cls[k]);b.classList.toggle('active',S.cls[k])}
  for(let k in o.bchips){let b=o.bchips[k];b.setAttribute('aria-pressed',S.bst[k]);b.classList.toggle('active',S.bst[k])}}if(S.installed)fit()},
ld=async()=>{let sn=++S.serial;S.busy=true;S.err=null;pt();
 try{let o=await rd();if(sn!==S.serial||!S.on)return;S.data=S.data||nm(o.features);S.from=DATA;dw();top();lp(sn)}
 catch(e){if(sn!==S.serial)return;S.err=msg(e);note(e);cx()}finally{if(sn===S.serial){S.busy=false;pt()}}},
lp=sn=>{let d=S.data;if(!DCF||d.pl)return;if(!d.c0){d.c0=d.dots.filter(r=>r.k=='c');sw(d,[])}
 (S.cache.p||(S.cache.p=gx(DCF,DCFSHA,PCAP).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),dn(o.features))).catch(e=>{S.cache.p=null;throw e})))
 .then(v=>{if(sn!==S.serial||!S.on||d.pl)return;S.pe=null;d.pl=v;sw(d,v.o)},e=>{if(sn===S.serial){S.pe=msg(e);note('data centres: '+S.pe);sw(d,d.c0)}})},
sw=(d,a)=>{d.dots=[...d.dots.filter(r=>r.k!='c'),...a];d.dots.forEach((r,i)=>r.i=i);d.counts.c=a.length;if(S.pp&&S.pp.r&&S.pp.r.k=='c'&&!a.includes(S.pp.r))pc();dw();top();pt()},
so=on=>{if(S.on===on)return;S.on=on;let m=mh();
 if(on){if(m&&typeof m.on==='function'){m.on('click',tap);m.on('resize',cpos)}W.addEventListener('gridatlas:card-open',co);ld()}
 else{S.serial++;S.busy=false;S.err=null;cx();if(m&&typeof m.off==='function'){m.off('click',tap);m.off('resize',cpos);m.off('moveend',cw)}W.removeEventListener('gridatlas:card-open',co);pt()}},
fit=()=>{let d=Q('gridatlas-dash-toggle'),b=d&&gr(d),v=b&&b.height;for(let o of S.sfs){let g=o.group,last=!g.nextElementSibling,s=g.style;s.paddingBottom=last?(v?innerHeight-b.top+16:96)+'px':'';s.paddingRight=last&&v?MX(0,gr(g).right-b.left+16)+'px':''}},
put=(host,o)=>{let lg=host.querySelector('[data-lightning-group]');lg?host.insertBefore(o.group,lg):ap(host,o.group);S.sfs.push(o)},
ins=()=>{if(S.installed)return true;let M=NS.menuBar,P=W.__GRIDATLAS_PIPELINE_LAYERS__,host=Q('scada-ui-container'),miss=[];
 if(!(M&&M.installed===true))miss.push('menuBar');if(!(P&&P.installed))miss.push('pipelineLayers');if(!mh())miss.push('map');if(!host||!host.querySelector('.key-group'))miss.push('groups');S.waiting_for=miss;if(miss.length)return false;
 put(host,bg('main'));let cur=Q('fs-curtain-keys');if(cur)put(cur,bg('fs'));S.installed=true;pt();for(let t of[0,1e3,5e3])setTimeout(fit,t);return true};
if(typeof setInterval==='function'&&typeof MutationObserver==='function'){let ob=new MutationObserver(()=>tick()),poll=setInterval(()=>tick(),250),
 tick=()=>{try{if(ins()){clearInterval(poll);ob.disconnect()}}catch(e){note('install: '+msg(e))}};ob.observe(document.documentElement,{childList:true,subtree:true})}
NS.ukOfftakers=Object.freeze({schema:S.schema,generation:GEN,state:S,install:ins,setOn:so});
})();
