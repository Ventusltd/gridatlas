/* uk-offtakers-overlay, generation 202610290949 (UTC). Potential offtakers: sites listed in open registers (NAEI 2023 point sources, GPPD) and OpenStreetMap, classified by the OT-filter rules (energy-intensive industry, power stations incl. closed and closing, data centres, large water works, other large users). OFF by default, never persisted. A listing is not electricity demand; distances are straight lines; vicinity screening only. Separate from the lightning overlay: own ids (gridatlas-offtakers*), copper-to-teal palette, own card. */
/* A tap on a site: neon links to the 15 nearest REPD project sites (40 km; status and technology chips as in M2+; projects within about 10 m share one site; ties at the 15th kept) and the 5 nearest substations (the original link.measure.nearestSubstations); a docked card with each listed project's full REPD record (M5-build's exact join, copied unchanged), a 5 km area summary and a CSV vicinity sheet. */
(()=>{'use strict';
let W=window,NS=(W.__GRIDATLAS_MODULES__=W.__GRIDATLAS_MODULES__||{});
if(NS.ukOfftakers||typeof document==='undefined')return;
let MX=Math.max,MN=Math.min,AI=Array.isArray,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
GEN='202610290949',TMO=15000,TOE='timeout after 15 s',R40=40,NR=15,
DATA='https://ventusltd.github.io/gridatlas/data/offtakers_filtered_202610290945.geojson',DSHA='6fc20e04fdcaadc55d723354848bcf77d3871e9d088a29cbf7ea3a76890b6730',
DCAP=5e6,
SRC='gridatlas-offtakers',LAYER='l-gridatlas-offtakers',GLOW=SRC+'-glow',HIT=SRC+'-hit',LINKS='l-gridatlas-offtakers-links',
CLS={a:['Industry','#e07b39','#3a1d0a',3,6,1],b:['Power stations','#f2c14e','#3a1d0a',3.5,7,1],c:['Data centres','#2ec4b6','#ffffff',3,6,1],d:['Water (large)','#4f86c6','rgba(0,0,0,0)',3,5,1],s:['Water (listed, small)','#4f86c6','rgba(0,0,0,0)',3,5,0],e:['Campus/CHP sites','#a26769','#3a1d0a',3,5,0]},
CK='abcdse'.split(''),
BST={op:'Operating (2023)',cl:'Closing',cc:'Closed/converted',un:'Unknown'},BK=Object.keys(BST),
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
unk=s=>!s||/^unknown/i.test((s+'').trim()),
S={schema:'gridatlas.module.uk-offtakers-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,busy:false,requests:0,errors:[],serial:0,
 cls:Object.fromEntries(CK.map(k=>[k,!!CLS[k][5]])),bst:Object.fromEntries(BK.map(k=>[k,true])),data:null,err:null,cache:{},sfs:[],rf:{st:'all',te:'all'}},
note=m=>S.errors.push(String(m)),
mh=()=>{let m=W.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{try{for(let l of m.getStyle().layers||[]){let f=l.type==='symbol'&&l.layout&&l.layout['text-font'];if(AI(f)&&f.length&&typeof f[0]==='string')return f}}catch(_){}return['Open Sans Regular']},
gj=(u,cache,raw)=>{let c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
 return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
hex=b=>[...new Uint8Array(b)].map(x=>(x|256).toString(16).slice(1)).join(''),
gx=(u,h)=>new Promise((res,rej)=>{S.requests++;let x=new XMLHttpRequest();x.open('GET',u);x.responseType='arraybuffer';x.timeout=TMO;
 x.onload=()=>x.status>=200&&x.status<300?x.responseURL&&!x.responseURL.startsWith(u)?rej(new Error('redirected')):res(x.response):rej(new Error('HTTP '+x.status));
 x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.onprogress=e=>{if(e.loaded>DCAP){x.abort();rej(new Error('data check failed (size)'))}};x.send()})
 .then(async b=>{let s=W.crypto&&W.crypto.subtle;if(!(b.byteLength<=DCAP))E('data check failed (size)');if(!s)E('data check failed (no WebCrypto)');if(hex(await s.digest('SHA-256',b))!==h)E('data check failed (SHA-256 differs from the pin)');return JSON.parse(new TextDecoder().decode(b))}),
rd=()=>S.cache.f||(S.cache.f=gx(DATA,DSHA).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),o)).catch(e=>{S.cache.f=null;throw new Error('offtakers data: '+msg(e))})),
okPt=c=>AI(c)&&c[0]===+c[0]&&c[1]===+c[1]&&c[0]>=-11&&c[0]<=3&&c[1]>=49.5&&c[1]<=61.5,
hv=(a,b)=>{let r=Math.PI/180,p1=a[1]*r,p2=b[1]*r,h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[0]-a[0])*r/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(h))},
KL=p=>{let o={A:'a',B:'b',C:'c',E:'e',D:p.subclass==='water_wastewater_large'?'d':'s'};return Object.hasOwn(o,p.class)?o[p.class]:null},
ao=v=>v==null||AI(v)&&v.every(o=>o&&typeof o=='object'),okP=p=>ao(p.records)&&ao(p.sources)&&ao(p.osm_corroboration)&&(p.subclass==null||typeof p.subclass=='string'),
STG=p=>p.class!=='B'?'':/^operat/i.test(p.status)?'op':/^closing/i.test(p.status)?'cl':/^(closed|converted)/i.test(p.status)?'cc':'un',
MW=p=>{let m=p.size_metric||{};return/^MW/.test(m.unit||'')&&m.value>0?+m.value:0},
ZS=p=>{let w=MW(p),b=p.emission_band_naei_2023||'';return p.class==='B'&&w?w>=1e3?1.5:w>=100?1.25:1:/^>=100/.test(b)?1.5:/^(10-25|25-100)/.test(b)?1.25:1},
nm=fs=>{let dots=[],bad=0;for(let f of fs){let p=f&&f.properties,k=p&&KL(p),c=f&&f.geometry&&f.geometry.coordinates;
  if(!k||!okP(p)||!f.geometry||f.geometry.type!=='Point'||!okPt(c)){bad++;continue}
  dots.push({i:dots.length,k,t:STG(p),z:ZS(p),n:p.name,op:p.operator,sub:(p.subclass||'').replace(/_/g,' '),a:c.slice(0,2),p})}
 return{dots,bad,counts:Object.fromEntries(CK.map(k=>[k,dots.filter(r=>r.k==k).length]))}},
NM=r=>unk(r.n)?'name not listed':cs(r.n),
SRCN=r=>{let q=(r.p.records||[])[0];return q?String(q.source).split(' ')[0]:'register'},
OP=r=>unk(r.op)?'operator not listed':`operator (${SRCN(r)}) ${cs(r.op)}`,
LIC=r=>(r.p.sources||[]).map(s=>`${cs(s.name)} (${cs(String(s.licence||'licence not stated').split(/ \(|, \(c\)/)[0])})`).join(' · ')||'source not stated',
SUBL=r=>cs(r.sub).replace(/\b(ccgt|ocgt|chp)\b/g,s=>s.toUpperCase()).replace(/^water wastewater (large|listed small)$/,'wastewater works'),
fl=()=>['all',['in',['get','k'],['literal',CK.filter(k=>S.cls[k])]],['any',['!=',['get','k'],'b'],['in',['get','t'],['literal',BK.filter(k=>S.bst[k])]]]],
MT=(i,d)=>['match',['get','k'],...CK.flatMap(k=>[k,CLS[k][i]]),d],RING=['in',['get','t'],['literal',['cl','cc']]],
CORE=SRC+'-centre',LY=[GLOW,LAYER,CORE,HIT],
dw=()=>{let m=mh();if(!m||!S.data)return;let fc=FC(S.data.dots.map(r=>({type:'Feature',id:r.i,properties:{k:r.k,t:r.t,z:r.z,i:r.i},geometry:{type:'Point',coordinates:r.a}}))),Z=(a,b)=>['interpolate',['linear'],['zoom'],6,['*',['get','z'],a],12,['*',['get','z'],b]],F=fl();
 if(!m.getSource(SRC)){m.addSource(SRC,{type:'geojson',data:fc});
  m.addLayer({id:GLOW,type:'circle',source:SRC,filter:F,paint:{'circle-radius':Z(['*',2.4,MT(3,3)],['*',2.4,MT(4,6)]),'circle-color':MT(1,'#e07b39'),'circle-opacity':['case',RING,0,['match',['get','k'],'d',.12,'s',0,.2]],'circle-blur':1}});
  m.addLayer({id:LAYER,type:'circle',source:SRC,filter:F,layout:{'circle-sort-key':['+',['match',['get','k'],'s',0,'e',1,'d',2,'c',3,'a',4,5],['get','z']]},paint:{'circle-radius':Z(MT(3,3),MT(4,6)),
   'circle-color':['case',RING,'rgba(0,0,0,0)',MT(1,'#e07b39')],'circle-opacity':['match',['get','k'],'d',.8,'s',.8,.95],
   'circle-stroke-color':['case',RING,CLS.b[1],MT(2,'#3a1d0a')],'circle-stroke-width':['case',RING,2,['match',['get','k'],'d',0,'s',0,1]]}});
  m.addLayer({id:CORE,type:'circle',source:SRC,filter:['all',F,['==',['get','k'],'b'],['!',RING]],paint:{'circle-radius':Z(1,2),'circle-color':'#3a1d0a'}});
  m.addLayer({id:HIT,type:'circle',source:SRC,filter:F,paint:{'circle-radius':12,'circle-opacity':0}})}
 else{m.getSource(SRC).setData(fc);rf()}},
rf=()=>{let m=mh(),F=fl();if(m)for(let l of LY)try{m.getLayer(l)&&m.setFilter(l,l===CORE?['all',F,['==',['get','k'],'b'],['!',RING]]:F)}catch(e){note(e)}},
top=()=>{let m=mh();if(m&&m.moveLayer)for(let l of[...LY,...NI])try{m.getLayer(l)&&m.moveLayer(l)}catch(_){}},
cx=()=>{let m=mh();pc();if(m)try{for(let l of[...LY].reverse())m.getLayer(l)&&m.removeLayer(l);m.getSource(SRC)&&m.removeSource(SRC)}catch(e){note(e)}},
NP='gridatlas-offtakers-neon',NI=[NP+'-glow',NP+'-core',NP+'-flow',NP+'-node',NP+'-label',NP+'-pin-halo',NP+'-pin',NP+'-p-glow',LINKS,NP+'-p-node',NP+'-p-label'],NSR=[NP+'-subs',NP+'-snodes',NP+'-pin',NP+'-plinks',NP+'-pnodes'],
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
sites=(all,f)=>{let sel=all.filter(r=>(f.st==='all'||RpS(r.p.status)===f.st)&&(f.te==='all'||RpT(r.p.tech)===f.te)),gs=[];
 for(let r of[...sel].sort((a,b)=>a.km-b.km)){let g=gs.find(g=>Math.abs(g.a[0]-r.a[0])<2e-4&&Math.abs(g.a[1]-r.a[1])<1e-4);if(!g)gs.push(g={a:r.a,km:r.km,parts:[]});g.parts.push(r.p)}
 return{sel,P:gs.filter((g,i,a)=>i<NR||g.km==a[NR-1].km)}},
near=(G,M,x,y)=>{let all=[],seen=new Set;for(let[a,p]of G){let km=M.distanceKm(x,y,...a);if(km<=R40){let k=a+JSON.stringify(p);if(!seen.has(k)){seen.add(k);RpP.set(p,a);all.push({a,p,km})}}}return all},
pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
cpos=()=>{let c=S.pp,m=mh();if(!c||!m)return;let k=gr(m.getContainer()),q=Q('gridatlas-menu-bar'),t=MX(0,(q?gr(q).bottom:0)-k.top)+8,w=MN(480,k.width-16),sd=c.sd=k.height<500&&k.width-w>=300,L=sd?k.right-8-w:k.left+(k.width-w)/2,h=c.offsetHeight||0;c.style.marginRight=sd?'0':'auto';let b=8;
 for(let o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){let r=o&&gr(o);if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=MX(b,k.bottom-r.top+8)}
 if(b+h>k.height-t)b=8;c.bb=b;c.style.bottom=b+'px';c.style.maxHeight=MX(44,MN(k.height-t-b,MX(240,k.height-b-320)))+'px'},
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
 return[`# GridAtlas potential offtakers vicinity sheet · generation ${GEN} · tap point ${x},${y} (${NM(c.r).replace(/[\r\n]/g,' ')}) · ${new Date().toISOString()}`,'# '+SCR+' A listing is not electricity demand. '+NOTSHOWN,...rows.map(r=>r.map(cq).join(','))].join('\n')+'\n'},
cv=c=>{c.csv.textContent='';let b=ap(c.csv,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer','Download vicinity sheet (CSV)'));b.type='button';b.dataset.offtakersCsv='';
 b.addEventListener('click',()=>{try{let u=URL.createObjectURL(new Blob([csv(c)],{type:'text/csv'})),a=el('a');a.href=u;a.download=`offtaker-vicinity-${GEN}.csv`;ap(document.body,a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4e3)}catch(e){note('csv: '+msg(e))}})},
pv=(m,c,g)=>{let back=c.re,[x,y]=g.a,ps=g.parts;pc();
 let v=cd(m,'REPD project',`REPD · ${RpU(ps,RpN).sort().join(' + ')}${RpMW(RpW(ps))}`,{foot:'Record · REPD (DESNZ, Apr 2026, OGL v3.0). Status as registered, not as built. '+NOTSHOWN,open:1,back:['◀ back to offtaker',()=>{pc();back();S.pp&&S.pp.sm.focus?.()}]});
 v.sm.textContent=`${k2(g.km)} km from ${NM(c.r)} (straight line) · details`;
 let sl=ps.map(q=>(L(v.det,`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`,'color:#ffb27a;margin-top:6px'),[ap(v.det,el('div')),q]));RpH(v,sl);
 let Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},k=[];try{k=AI(Lk.substations)&&Lk.substations.length?M.nearestSubstations(x,y,Lk.substations):[]}catch(e){note('nearest: '+msg(e))}
 L(v.det,'Screening · nearest substations to this project, straight line. Not its declared connection or capacity.','color:#5fbdc2;margin-top:6px');for(let a of k)L(v.det,`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'color:#c9d6da');
 v.k=k;S.fk=[[x,y],...k.map(a=>a.at)];try{nl(m,[x,y],k)}catch(e){note('links: '+msg(e))}cpos();nz(m,x,y);v.querySelector('[data-offtakers-back]')?.focus?.()},
tap=e=>{if(!S.on)return;setTimeout(()=>{try{tq(e)}catch(x){note('tap: '+msg(x))}},0)},
tq=e=>{let m=mh();if(!S.on||!m||!m.getLayer(HIT)||!S.data)return;let px=e.point.x??e.point[0],py=e.point.y??e.point[1],f=null,dm=1/0;
 for(let q of m.queryRenderedFeatures(e.point,{layers:[HIT]})){let r=S.data.dots[q.properties&&q.properties.i];if(!r||!S.cls[r.k]||r.k=='b'&&!S.bst[r.t])continue;let a=m.project(r.a),d=(a.x-px)**2+(a.y-py)**2;if(d<dm){dm=d;f=r}}
 if(!f){if(S.pp&&!S.pp.contains(e.originalEvent&&e.originalEvent.target))pc();return}
 oc(m,f);let lc=document.querySelector('[data-lightning-card]'),x=lc&&[...lc.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close');x&&x.click()},
co=e=>{if(e&&e.detail&&e.detail.owner!=='offtakers')pc()},
BTN=(a,t)=>`<button type="button" class="map-ctrl-btn" ${a}>${t}</button>`,
bg=key=>{let g=document.createElement('div');g.className='key-group';g.style.gridColumn='1/-1';g.dataset.offtakersGroup=key;
 g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-offtakers-control="toggle"> <span data-offtakers-label="${key}" style="color:#8fb4ff">${BASE}</span></label>`
 +`<div data-offtakers-controls="${key}" hidden><div role="group" aria-label="Offtaker classes" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">${BTN('data-offtakers-all','All')}${CK.map(k=>BTN(`data-offtakers-class="${k}" aria-pressed="false"`,CLS[k][0])).join('')}</div>`
 +`<div role="group" aria-label="Power station status" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:4px 0"><span style="font-size:11px;color:#bbb">Power stations:</span>${BK.map(k=>BTN(`data-offtakers-bst="${k}" aria-pressed="true"`,BST[k])).join('')}</div>`
 +`</div><div data-offtakers-status role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word"></div><div data-offtakers-foot hidden style="font-size:11px;color:#bbb">${LEG} ${FOOT}</div>`;
 g.querySelectorAll('.map-ctrl-btn').forEach(b=>{b.style.cssText+='min-height:44px;min-width:44px';let k=b.dataset.offtakersClass||(b.dataset.offtakersBst?'b':'');if(k)b.style.borderLeft='4px solid '+CLS[k][1]});
 let q=s=>g.querySelector(s),o={key,group:g,toggle:q('[data-offtakers-control]'),label:q('[data-offtakers-label]'),ctl:q('[data-offtakers-controls]'),st:q('[data-offtakers-status]'),ft:q('[data-offtakers-foot]'),chips:{}};
 o.bchips={};g.querySelectorAll('[data-offtakers-class]').forEach(b=>o.chips[b.dataset.offtakersClass]=b);g.querySelectorAll('[data-offtakers-bst]').forEach(b=>o.bchips[b.dataset.offtakersBst]=b);
 g.addEventListener('click',ev=>{let b=ev.target.closest('button');if(!b||!g.contains(b))return;let d=b.dataset;if(d.offtakersClass)S.cls[d.offtakersClass]=!S.cls[d.offtakersClass];else if(d.offtakersBst)S.bst[d.offtakersBst]=!S.bst[d.offtakersBst];else if(d.offtakersAll!=null){for(let k of CK)S.cls[k]=!!CLS[k][5];for(let k of BK)S.bst[k]=true}else return;
  rf();let r=S.pp&&S.pp.r;if(r&&(!S.cls[r.k]||r.k=='b'&&!S.bst[r.t]))pc();pt()});
 g.addEventListener('change',ev=>{let t=ev.target;if(t&&t.dataset&&t.dataset.offtakersControl==='toggle')so(!!t.checked)});return o},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},
pt=()=>{let d=S.data,n=d?d.dots.filter(r=>S.cls[r.k]&&(r.k!='b'||S.bst[r.t])).length:0,lab=!S.on?BASE:S.busy?BASE+' [LOAD]':S.err?BASE+' [FAIL]':`${BASE} [${N(n)} sites]`,
 st=!S.on?'':S.busy?'Loading the pinned open data…':S.err?'Nothing drawn: '+S.err:`${N(n)} sites drawn (${CK.filter(k=>S.cls[k]).map(k=>CLS[k][0]+' '+N(d.counts[k])).join(' · ')||'no class selected'}) · tap a site for its 15 nearest REPD sites and 5 nearest substations (straight line)`;
 for(let o of S.sfs){if(o.toggle.checked!==S.on)o.toggle.checked=S.on;txt(o.label,lab);o.label.style.opacity=S.err?'0.8':'1';o.ctl.hidden=o.ft.hidden=!S.on;txt(o.st,st);
  for(let k in o.chips){let b=o.chips[k];b.setAttribute('aria-pressed',S.cls[k]);b.classList.toggle('active',S.cls[k])}
  for(let k in o.bchips){let b=o.bchips[k];b.setAttribute('aria-pressed',S.bst[k]);b.classList.toggle('active',S.bst[k])}}if(S.installed)fit()},
ld=async()=>{let sn=++S.serial;S.busy=true;S.err=null;pt();
 try{let o=await rd();if(sn!==S.serial||!S.on)return;S.data=S.data||nm(o.features);S.from=DATA;dw();top()}
 catch(e){if(sn!==S.serial)return;S.err=msg(e);note(e);cx()}finally{if(sn===S.serial){S.busy=false;pt()}}},
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
