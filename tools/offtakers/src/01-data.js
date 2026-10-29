let W=window,NS=(W.__GRIDATLAS_MODULES__=W.__GRIDATLAS_MODULES__||{});
if(NS.ukOfftakers||typeof document==='undefined')return;
let MX=Math.max,MN=Math.min,AI=Array.isArray,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
GEN='@@GEN@@',TMO=15000,TOE='timeout after 15 s',R40=40,NR=15,
GG='https://raw.githubusercontent.com/Ventusltd/globalgrid2050/b8973334303709067ef1408b6ff971d323a876ef/',
/// pinned open data: [file, sha256, the shell's own preloaded source that holds the same rows]
FILES={naei:['heavy_emitters_uk.json','9d603ac9a7dd5b831b94c01b1e25b4f0a434e299489a680d9b4461ce5f1a63f3','src-naei_co2'],
 ind:['industrial_offtakers.geojson','c4b3fff1c1da07cf1638e3f1d619ac70ec36be9093a9ca1512329a78ec713919','src-ind'],
 dc:['datacentres.geojson','a686a2e00253bbf30c9f5262439bc2332524e8d5cb34481529c6a711c73acab4','src-dc']},
SRC='gridatlas-offtakers',LAYER='l-gridatlas-offtakers',GLOW=SRC+'-glow',HIT=SRC+'-hit',LINKS='l-gridatlas-offtakers-links',
/// class: [label, fill, stroke, radius z6, radius z12, on by default, source label]
CLS={n:['Industry (NAEI)','#3d7bff','#0b1f4d',3.5,7,1,'NAEI'],o:['Industry (OSM)','#8fb4ff','#0b1f4d',3,6,1,'OSM'],d:['Data centre','#1fb6ff','#ffffff',3,6,1,'OSM'],w:['Water works','#7d8fb3','rgba(0,0,0,0)',2,4.5,0,'OSM']},
CK='nodw'.split(''),WATER=['Wastewater Plant','Water Works','Water Treatment','Sewage Plant'],GENR=['Major power producers','Minor power producers'],
TITLE='Potential offtakers',BASE='Potential offtakers (open registers)',
FOOT='Sites listed in open registers (NAEI) and OpenStreetMap. A listing is not electricity demand. Distances are straight lines. Vicinity screening only.',
SCR='Screening · straight-line distance, not a cable route. Vicinity only.',
NOTSHOWN='Not shown here: electricity use, connection terms, consent, viability.',
N=n=>Number(n).toLocaleString('en-GB'),pl=(n,w,s='s')=>N(n)+' '+w+(n==1?'':s),k2=v=>(+v).toFixed(2),k1=v=>(+v).toFixed(1),
cs=v=>(v+'').replace(/\p{Cf}/gu,'').slice(0,200),msg=e=>cs(e&&e.message||e),FC=f=>({type:'FeatureCollection',features:f||[]}),
el=(t,css,s)=>{let e=document.createElement(t);if(css)e.style.cssText=css;if(s!=null)e.textContent=s;return e},
tier=(e,t)=>(e.dataset.tier=t,e),
unk=s=>!s||/^unknown/i.test((s+'').trim()),
S={schema:'gridatlas.module.uk-offtakers-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,busy:false,requests:0,errors:[],serial:0,
 cls:Object.fromEntries(CK.map(k=>[k,!!CLS[k][5]])),data:null,err:null,cache:{},sfs:[],rf:{st:'all',te:'all'}},
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
/// one source: the shell's own preloaded layer when it holds rows, else the pinned raw file
rd=k=>S.cache[k]||(S.cache[k]=(async()=>{let[f,h,s]=FILES[k],m=mh();try{let d=m&&m.getSource(s)&&m.getSource(s).serialize().data;if(d&&AI(d.features)&&d.features.length)return{f:d.features,from:s}}catch(_){}
 let o=await gx(GG+f,h);if(!o||!AI(o.features))E('data check failed ('+f+' is not a feature collection)');return{f:o.features,from:GG+f}})().catch(e=>{S.cache[k]=null;throw new Error(f0(k)+': '+msg(e))})),
f0=k=>FILES[k][0],
okPt=c=>AI(c)&&c[0]===+c[0]&&c[1]===+c[1]&&c[0]>=-11&&c[0]<=3&&c[1]>=49.5&&c[1]<=61.5,
hv=(a,b)=>{let r=Math.PI/180,p1=a[1]*r,p2=b[1]*r,h=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((b[0]-a[0])*r/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(h))},
/// group points of ONE source within rKm when their operators match or either is "Unknown…" (union-find on a 0.01° grid)
grp=(F,rKm)=>{let n=F.length,par=F.map((_,i)=>i),f=i=>{while(par[i]!==i)i=par[i]=par[par[i]];return i},g=new Map,key=(x,y)=>x+','+y;
 F.forEach((r,i)=>{let k=key(Math.floor(r.a[0]*100),Math.floor(r.a[1]*100));(g.get(k)||g.set(k,[]).get(k)).push(i)});
 F.forEach((r,i)=>{let cx=Math.floor(r.a[0]*100),cy=Math.floor(r.a[1]*100);for(let dx=-1;dx<2;dx++)for(let dy=-1;dy<2;dy++)for(let j of g.get(key(cx+dx,cy+dy))||[])if(j>i&&hv(r.a,F[j].a)<=rKm){let a=r.op,b=F[j].op;if(a===b||unk(a)||unk(b))par[f(i)]=f(j)}});
 let o=new Map;F.forEach((r,i)=>{let k=f(i);(o.get(k)||o.set(k,[]).get(k)).push(r)});return[...o.values()].map(ms=>({...ms[0],ms}))},
/// normalise the three sources into dots (pure; the tests call it on the pinned files)
nm=(naei,ind,dc)=>{let P=(f,fn)=>f.filter(x=>x&&x.geometry&&x.geometry.type==='Point'&&okPt(x.geometry.coordinates)&&x.properties).map(x=>fn(x.properties,x.geometry.coordinates.slice(0,2))),out=[],ix={},
 dd=a=>{let s=new Set;return a.filter(r=>{let k=r.n+'|'+r.a.map(v=>v.toFixed(4));return s.has(k)?0:s.add(k)})};
 ix.n=P(naei,(p,a)=>({k:'n',n:p.name,op:p.operator,sub:p.sector,cty:p.country,a})).filter(r=>!GENR.includes(r.sub)&&r.cty!=='Offshore');
 let I=dd(P(ind,(p,a)=>({k:WATER.includes(p.type)?'w':'o',n:p.name,op:p.operator,sub:p.type,a})));ix.o=I.filter(r=>r.k=='o');ix.w=I.filter(r=>r.k=='w');
 ix.d=P(dc,(p,a)=>({k:'d',n:p.name,op:p.operator,sub:'data centre',a}));
 let c={rows:{n:ix.n.length,o:ix.o.length,w:ix.w.length,d:ix.d.length}};
 for(let k of CK)for(let r of k=='n'?grp(ix.n,.1):k=='d'?grp(ix.d,.25):ix[k].map(r=>({...r,ms:[r]})))out.push({...r,i:out.length});
 c.dots=Object.fromEntries(CK.map(k=>[k,out.filter(r=>r.k==k).length]));return{dots:out,counts:c}},
NM=r=>unk(r.n)?'name not listed':cs(r.n),OP=r=>unk(r.op)?'operator not listed':`operator (${CLS[r.k][6]}) ${cs(r.op)}`,
REC=r=>r.k=='n'?`Record · NAEI 2023 point source, sector ${cs(r.sub)}`:'Record · OpenStreetMap (ODbL), date not carried',
SUBL=r=>r.k=='n'?cs(r.sub):r.k=='d'?'data centre':cs(r.sub).toLowerCase(),
