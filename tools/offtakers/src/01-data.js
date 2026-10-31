let W=window,NS=(W.__GRIDATLAS_MODULES__=W.__GRIDATLAS_MODULES__||{});
if(NS.ukOfftakers||typeof document==='undefined')return;
let MX=Math.max,MN=Math.min,AI=Array.isArray,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
GEN='@@GEN@@',TMO=15000,TOE='timeout after 15 s',R40=40,NR=15,
/// DC-B1 (#73 steps 7-8): a data-centre tap lists 30 substations, 30 REPD sites and 30 conventional power sites (R100 km);
/// labels on the map only for the nearest DL of each set
N3=30,R100=100,DL=5,
/// the filtered, classified open-data file (hardening lane OT-filter, ot_filter.py; owner's rules of 29 Oct 2026 02:57 UTC), served
/// from this repository and checked against its SHA-256 before anything is drawn
/// DC-B1: 202610292000 = 202610290945 with one correction (Marchwood OT-B-0823 gas CCGT, not biomass; DC-A6), see its "corrections"
DATA='https://ventusltd.github.io/gridatlas/data/offtakers_filtered_202610292000.geojson',DSHA='16dca56003e7a222e7a74025b9b61db3c1929ac7e34adc38daeb343074e68139',
/// byte cap of the pinned data (about twice the 2,288,733 B file): the read is aborted past it and nothing is hashed or parsed (R-otsec ORS2)
DCAP=5e6,
/// the data centres (#73 step 7): the open UK data-centre pipeline (hardening DC-A7, dc_pipeline.schema.json: DC-A4's
/// OpenStreetMap sites, DC-A3's government-published sites, merged with provenance; status, IT load, grid connection and an
/// unlabelled MW kept apart), read after the other sites are drawn; it replaces the offtakers file's data centres, which
/// come back if it fails. The conventional power sites (#73 step 5, DC-A6) are read on the first data-centre tap.
/// Both are committed verbatim, pinned by SHA-256 and capped (PCAP bytes, PMAX features).
DCF='https://ventusltd.github.io/gridatlas/data/uk_datacentre_pipeline_202610312133.geojson',DCFSHA='87337db5d3bf7959f7f605d3abd029dd4196ab24a79107ceb95210c5b7751654',
CVF='https://ventusltd.github.io/gridatlas/data/conventional_power_uk_202610292000.geojson',CVFSHA='44b577a12d714d934ce90ce39b44951fb2a641f32ccc20d45a5e2461b145ec98',PCAP=4e6,PMAX=5e3,
/// the only URLs this module reads: files of this site's data/ folder (and /dist/repd_master.json, the engine's register)
AL=u=>/^https:\/\/ventusltd\.github\.io\/gridatlas\/data\/[\w.-]+\.(geo)?json$/.test(u)||E('URL not allow-listed'),
SRC='gridatlas-offtakers',LAYER='l-gridatlas-offtakers',GLOW=SRC+'-glow',HIT=SRC+'-hit',LINKS='l-gridatlas-offtakers-links',
/// class: [chip label, fill, stroke, radius z6, radius z12, on by default]; s = the NAEI-listed small water works (a sub-chip)
CLS={a:['Industry','#e07b39','#3a1d0a',3,6,1],b:['Power stations','#f2c14e','#3a1d0a',3.5,7,1],c:['Data centres','#b07cff','#ffffff',3.5,6.5,1],d:['Water (large)','#4f86c6','rgba(0,0,0,0)',3,5,1],s:['Water (listed, small)','#4f86c6','rgba(0,0,0,0)',3,5,0],e:['Campus/CHP sites','#a26769','#3a1d0a',3,5,0]},
CK='abcdse'.split(''),
/// power-station status groups (chips): operating, closing, closed or converted (a hollow ring), unknown
BST={op:'Operating (2023)',cl:'Closing',cc:'Closed/converted',un:'Unknown'},BK=Object.keys(BST),
/// data centres: their own palette (violet), chip row and legend; the ring is the status (pipeline vocabulary, #73 step 3)
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
/// "Unknown …" and the pipeline's "Unnamed data centre" are not names
unk=s=>!s||/^(unknown|unnamed\b)/i.test((s+'').trim()),
S={schema:'gridatlas.module.uk-offtakers-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,busy:false,requests:0,errors:[],serial:0,
 cls:Object.fromEntries(CK.map(k=>[k,!!CLS[k][5]])),bst:Object.fromEntries(BK.map(k=>[k,true])),data:null,err:null,cache:{},sfs:[],rf:{st:'all',te:'all'}},
note=m=>S.errors.push(String(m)),
mh=()=>{let m=W.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{try{for(let l of m.getStyle().layers||[]){let f=l.type==='symbol'&&l.layout&&l.layout['text-font'];if(AI(f)&&f.length&&typeof f[0]==='string')return f}}catch(_){}return['Open Sans Regular']},
/// guarded fetch, as lightning's: 15 s timeout covering the body, redirect refused, "HTTP n" (REPD register and the M5 record join)
gj=(u,cache,raw)=>{let c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
 return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
hex=b=>[...new Uint8Array(b)].map(x=>(x|256).toString(16).slice(1)).join(''),
/// the pinned open data: XMLHttpRequest (the original bridge does not hook it), same timeout and redirect rules, then SHA-256 against the pin
gx=(u,h,cap=DCAP)=>new Promise((res,rej)=>{AL(u);S.requests++;let x=new XMLHttpRequest();x.open('GET',u);x.responseType='arraybuffer';x.timeout=TMO;
 x.onload=()=>x.status>=200&&x.status<300?x.responseURL&&!x.responseURL.startsWith(u)?rej(new Error('redirected')):res(x.response):rej(new Error('HTTP '+x.status));
 x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.onprogress=e=>{if(e.loaded>cap){x.abort();rej(new Error('data check failed (size)'))}};x.send()})
 .then(async b=>{let s=W.crypto&&W.crypto.subtle;if(!(b.byteLength<=cap))E('data check failed (size)');if(!s)E('data check failed (no WebCrypto)');if(hex(await s.digest('SHA-256',b))!==h)E('data check failed (SHA-256 differs from the pin)');return JSON.parse(new TextDecoder().decode(b))}),
/// the data file, once per page (pinned and hashed); a failed read is retried on the next switch-on
rd=()=>S.cache.f||(S.cache.f=gx(DATA,DSHA).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),o)).catch(e=>{S.cache.f=null;throw new Error('offtakers data: '+msg(e))})),
okPt=c=>AI(c)&&c[0]===+c[0]&&c[1]===+c[1]&&c[0]>=-11&&c[0]<=3&&c[1]>=49.5&&c[1]<=61.5,
hv=(a,b)=>{let r=Math.PI/180,p1=a[1]*r,p2=b[1]*r,h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[0]-a[0])*r/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(h))},
/// class, power-station status group and size step of one feature (pure; the tests call it on the pinned file).
/// z: ×1 / 1.25 / 1.5 by installed MW (<100, 100–1000, ≥1000; power stations with a GPPD figure) or by NAEI band (<10, 10–100, ≥100 kt)
KL=p=>{let o={A:'a',B:'b',C:'c',E:'e',D:p.subclass==='water_wastewater_large'?'d':'s'};return Object.hasOwn(o,p.class)?o[p.class]:null},
/// list fields are absent or arrays of objects; subclass absent or a string (R-otsec ORS3)
ao=v=>v==null||AI(v)&&v.every(o=>o&&typeof o=='object'),okP=p=>ao(p.records)&&ao(p.sources)&&ao(p.osm_corroboration)&&(p.subclass==null||typeof p.subclass=='string'),
STG=p=>p.class!=='B'?'':/^operat/i.test(p.status)?'op':/^closing/i.test(p.status)?'cl':/^(closed|converted)/i.test(p.status)?'cc':'un',
MW=p=>{let m=p.size_metric||{};return/^MW/.test(m.unit||'')&&m.value>0?+m.value:0},
/// a data centre's MW figures, kept apart (IT load, grid connection, unlabelled); null = not stated, never 0
DMW=p=>{let v=o=>o&&typeof o=='object'&&typeof o.value=='number'&&o.value>0&&o.value<=1e4?o.value:null;return{it:v(p.it_load_mw),gc:v(p.grid_connection_mw),un:v(p.unclassified_mw)??v(AI(p.mw_unclassified)&&p.mw_unclassified[0])}},
/// size: IT load, else grid connection; never an unlabelled MW (it may be a battery or an energy centre)
DZ=w=>{let v=w.it??w.gc;return v==null?1:v>=200?2:v>=50?1.6:v>=10?1.25:1},
ZS=p=>{let w=MW(p),b=p.emission_band_naei_2023||'';return p.class==='C'?DZ(DMW(p)):p.class==='B'&&w?w>=1e3?1.5:w>=100?1.25:1:/^>=100/.test(b)?1.5:/^(10-25|25-100)/.test(b)?1.25:1},
nm=fs=>{let dots=[],bad=0;for(let f of fs){let p=f&&f.properties,k=p&&KL(p),c=f&&f.geometry&&f.geometry.coordinates;
  if(!k||!okP(p)||!f.geometry||f.geometry.type!=='Point'||!okPt(c)){bad++;continue}
  dots.push({i:dots.length,k,t:k=='c'?DSK(p.status):STG(p),z:ZS(p),n:p.name,op:p.operator,sub:(p.subclass||'').replace(/_/g,' '),a:c.slice(0,2),p})}
 return{dots,bad,counts:Object.fromEntries(CK.map(k=>[k,dots.filter(r=>r.k==k).length]))}},
/// schema checks (DC-A4 / DC-A7 data centres, DC-A6 conventional sites), at most PMAX each: an id, a name or none, a UK point (the
/// geometry, else location lon/lat) and 1-50 sources, each under a fully open licence (#73 rule) or a cited fact;
/// anything else is skipped and counted, never repaired. Cable landing stations are not data centres here (DC-B3).
OPL=/^(OGL|ODbL|CC[ -]?BY|CC0|PDDL|public[ -]domain|Open[ -]Parliament|cited fact)/i,
/// (non-commercial or no-derivatives terms are not fully open, whatever the prefix)
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
