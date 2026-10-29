let W=window,NS=(W.__GRIDATLAS_MODULES__=W.__GRIDATLAS_MODULES__||{});
if(NS.ukOfftakers||typeof document==='undefined')return;
let MX=Math.max,MN=Math.min,AI=Array.isArray,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
GEN='@@GEN@@',TMO=15000,TOE='timeout after 15 s',R40=40,NR=15,
/// the filtered, classified open-data file (hardening lane OT-filter, ot_filter.py; owner's rules of 29 Oct 2026 02:57 UTC), served
/// from this repository and checked against its SHA-256 before anything is drawn
DATA='https://ventusltd.github.io/gridatlas/data/offtakers_filtered_202610290317.geojson',DSHA='b31a369e51040aa86f5ca699a003c0fc8a7f43e71e9d74868c77e1db783121cb',
SRC='gridatlas-offtakers',LAYER='l-gridatlas-offtakers',GLOW=SRC+'-glow',HIT=SRC+'-hit',LINKS='l-gridatlas-offtakers-links',
/// class: [chip label, fill, stroke, radius z6, radius z12, on by default]; s = the NAEI-listed small water works (a sub-chip)
CLS={a:['Industry','#e07b39','#3a1d0a',3,6,1],b:['Power stations','#f2c14e','#3a1d0a',3.5,7,1],c:['Data centres','#2ec4b6','#ffffff',3,6,1],d:['Water (large)','#4f86c6','rgba(0,0,0,0)',3,5,1],s:['Water (listed, small)','#4f86c6','rgba(0,0,0,0)',3,5,0],e:['Other large users','#a26769','#3a1d0a',3,5,1]},
CK='abcdse'.split(''),
/// power-station status groups (chips): operating, closing, closed or converted (a hollow ring), unknown
BST={op:'Operating',cl:'Closing',cc:'Closed/converted',un:'Unknown'},BK=Object.keys(BST),
TITLE='Potential offtakers',BASE='Potential offtakers (open registers)',
FOOT='Sites listed in open registers (NAEI, GPPD) and OpenStreetMap. A listing is not electricity demand. Distances are straight lines. Vicinity screening only.',
LEG='Dot size: emission band (NAEI 2023) or installed MW (GPPD). Hollow ring: closed or closing station.',
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
/// guarded fetch, as lightning's: 15 s timeout covering the body, redirect refused, "HTTP n" (REPD register and the M5 record join)
gj=(u,cache,raw)=>{let c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
 return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
hex=b=>[...new Uint8Array(b)].map(x=>(x|256).toString(16).slice(1)).join(''),
/// the pinned open data: XMLHttpRequest (the original bridge does not hook it), same timeout and redirect rules, then SHA-256 against the pin
gx=(u,h)=>new Promise((res,rej)=>{S.requests++;let x=new XMLHttpRequest();x.open('GET',u);x.responseType='arraybuffer';x.timeout=TMO;
 x.onload=()=>x.status>=200&&x.status<300?x.responseURL&&!x.responseURL.startsWith(u)?rej(new Error('redirected')):res(x.response):rej(new Error('HTTP '+x.status));
 x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.send()})
 .then(async b=>{let s=W.crypto&&W.crypto.subtle;if(!s)E('data check failed (no WebCrypto)');if(hex(await s.digest('SHA-256',b))!==h)E('data check failed (SHA-256 differs from the pin)');return JSON.parse(new TextDecoder().decode(b))}),
/// the data file, once per page (pinned and hashed); a failed read is retried on the next switch-on
rd=()=>S.cache.f||(S.cache.f=gx(DATA,DSHA).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),o)).catch(e=>{S.cache.f=null;throw new Error('offtakers data: '+msg(e))})),
okPt=c=>AI(c)&&c[0]===+c[0]&&c[1]===+c[1]&&c[0]>=-11&&c[0]<=3&&c[1]>=49.5&&c[1]<=61.5,
hv=(a,b)=>{let r=Math.PI/180,p1=a[1]*r,p2=b[1]*r,h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[0]-a[0])*r/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(h))},
/// class, power-station status group and size step of one feature (pure; the tests call it on the pinned file).
/// z: ×1 / 1.25 / 1.5 by installed MW (<100, 100–1000, ≥1000; power stations with a GPPD figure) or by NAEI band (<10, 10–100, ≥100 kt)
KL=p=>({A:'a',B:'b',C:'c',E:'e'})[p.class]||(p.class==='D'?p.subclass==='water_wastewater_large'?'d':'s':null),
STG=p=>p.class!=='B'?'':/^operat/i.test(p.status)?'op':/^closing/i.test(p.status)?'cl':/^(closed|converted)/i.test(p.status)?'cc':'un',
MW=p=>{let m=p.size_metric||{};return/^MW/.test(m.unit||'')&&m.value>0?+m.value:0},
ZS=p=>{let w=MW(p),b=p.emission_band_naei_2023||'';return p.class==='B'&&w?w>=1e3?1.5:w>=100?1.25:1:/^>=100/.test(b)?1.5:/^(10-25|25-100)/.test(b)?1.25:1},
nm=fs=>{let dots=[],bad=0;for(let f of fs){let p=f&&f.properties,k=p&&KL(p),c=f&&f.geometry&&f.geometry.coordinates;
  if(!k||!f.geometry||f.geometry.type!=='Point'||!okPt(c)){bad++;continue}
  dots.push({i:dots.length,k,t:STG(p),z:ZS(p),n:p.name,op:p.operator,sub:(p.subclass||'').replace(/_/g,' '),a:c.slice(0,2),p})}
 return{dots,bad,counts:Object.fromEntries(CK.map(k=>[k,dots.filter(r=>r.k==k).length]))}},
NM=r=>unk(r.n)?'name not listed':cs(r.n),
SRCN=r=>{let q=(r.p.records||[])[0];return q?String(q.source).split(' ')[0]:'register'},
OP=r=>unk(r.op)?'operator not listed':`operator (${SRCN(r)}) ${cs(r.op)}`,
LIC=r=>(r.p.sources||[]).map(s=>`${cs(s.name)} (${cs(String(s.licence||'licence not stated').split(' (')[0])})`).join(' · ')||'source not stated',
SUBL=r=>cs(r.sub),
