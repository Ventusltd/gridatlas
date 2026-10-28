/* uk-lightning-overlay, generation 202610281250 (UTC). EUMETSAT MTG Lightning Imager (L2-LFL) optical flashes, OFF by
 * default, appended last to the original Layers panel and fullscreen curtain; no request, source, layer or listener until
 * switched on; never persisted. Optical flashes are NOT confirmed ground strikes; a day never searched is unknown, never
 * zero. Above the device cap the window draws as tappable ≈10 km cells (data/history/grid) near UK land. */
(()=>{'use strict';
const NS=(window.__GRIDATLAS_MODULES__=window.__GRIDATLAS_MODULES__||{});
if(NS.ukLightning||typeof document==='undefined')return;
const GEN='202610281250',AR='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/',IX_SCHEMA='uk-lightning-history-index.v2',GS='uk-lightning-history-grid.v1',
FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson',FEED_SCHEMA='FeatureCollection/optical_lightning_flash',
SRC='gridatlas-lightning',LAYER='l-gridatlas-lightning',DAY=864e5,HOUR=36e5,TMO=15000,BUDGET=40000,RQ=400,DRE=/^\d{4}-\d{2}-\d{2}$/,TOE='timeout after 15 s',NA=e=>/HTTP 404/.test(e)?'archive not yet published':'archive unavailable',
PERIODS=[['12h','12 hours',12*HOUR],['24h','24 hours',DAY],['48h','48 hours',2*DAY],['7d','7 days',7*DAY],['30d','30 days',30*DAY],['3m','3 months',-3],['6m','6 months',-6],['12m','12 months',-12],['custom','Custom UTC dates',0]],
LONG=['30d','3m','6m','12m'],BASE='Lightning Flashes (Optical)',TITLE='Weather · EUMETSAT Lightning Imager',
FOOTER='Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5',
COLOUR=st=>({L:'#888',P:'#ffcc00',U:'#ff8800',B:'#ff8800',F:'#ff4444'})[st[0]]||'#00ff88',
ymd=t=>new Date(t).toISOString().slice(0,10),ds=d=>Date.parse(d+'T00:00:00Z'),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
T=(t,n=16)=>isFinite(t)?new Date(t).toISOString().slice(0,n).replace('T',' ')+' UTC':'unknown',Ts=t=>T(t,19),
N=n=>Number(n).toLocaleString('en-GB'),pl=(n,w,s='s')=>N(n)+' '+w+(n==1?'':s),dm=t=>{const s=new Date(t).toUTCString(),y=s.slice(12,16);return+s.slice(5,7)+s.slice(7,11)+(y==new Date().getUTCFullYear()?'':' '+y)},hm=t=>T(t).slice(11,16),dt=t=>dm(t)+' '+hm(t),du=m=>(m=Math.round(m/6e4),(m>59?Math.floor(m/60)+' h ':'')+(m%60||m<60?m%60+' min':'')).trim(),hz=w=>!w.custom&&w.span<=2*DAY,de=(a,b)=>dm(a)==dm(b)?hm(b):dt(b),sv=(r,k,p)=>{const v=r.cov,w=r.w,a=k&&/READY|EMPTY/.test(k.st);return hz(w)?(a?'all ':(v.f>0?du(v.f*w.span):'0')+' of ')+w.label+' searched':(a?'all '+pl(v.d,'day'):`${v.k} of ${pl(v.d,'day')}`)+' searched'+(p&&v.pp?` (${v.pp} in part)`:'')},lr=(g,now,f)=>isFinite(g)?`collector last ran ${ymd(g)==ymd(now)?hm(g):dt(g)} UTC${f&&g-f>HOUR?`, searched to ${ymd(f)==ymd(now)?hm(f):dt(f)} UTC`:''}${g>now+9e5?' (device clock behind)':''}`:'collector last run unknown',F7=r=>`${N(r.ev.length)} seen in the available 7-day feed · ${r.w.label} requested${r.old?' · older history unknown':''}`,AGO=t=>{const m=Math.round(t/6e4);return m<0?'?':m<1?'<1 min':`${Math.floor(m/60)}h ${m%60}min`},
ov=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c)),FC=f=>({type:'FeatureCollection',features:f||[]}),bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5,isFC=o=>o&&o.type==='FeatureCollection'&&Array.isArray(o.features),tm=f=>{const s=f.properties.time_utc+'';return Date.parse(/T[\d:.]+$/.test(s)?s+'Z':s)},msg=e=>e&&e.message||String(e),
ph=()=>{try{return matchMedia('(pointer: coarse)').matches||window.innerWidth<=700}catch(_){return false}},cap=()=>ph()?10000:40000,
mm=(t,k)=>{const d=new Date(t),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-k);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.getTime()},
S={schema:'gridatlas.module.uk-lightning-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,requests:0,errors:[],last:null,
period:'24h',end:null,h:[],from:'',to:'',consent:false,serial:0,idx:null,ie:null,res:null,sfs:[]},lru=new Map(),
note=m=>S.errors.push(String(m)),
gj=(u,cache,raw)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
gx=u=>{S.requests++;return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('GET',u);x.timeout=TMO;
x.onload=()=>{if(x.status>=200&&x.status<300){try{if(x.responseURL&&!x.responseURL.startsWith(u))E('redirected');res(JSON.parse(x.responseText))}catch(e){rej(e)}}else rej(new Error('HTTP '+x.status))};
x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.send()})},
lg=k=>{if(!lru.has(k))return;const v=lru.get(k);lru.delete(k);lru.set(k,v);return v},ls=(k,v)=>{lru.delete(k);lru.set(k,v);while(lru.size>RQ)lru.delete(lru.keys().next().value)},
vk=r=>{const n=r&&r.count,b=w=>E(`invalid index row ${r&&r.date}: ${w}`);if(!r||ymd(ds(r.date)||0)!=r.date)b('date');if(!['none','partial','full'].includes(r.coverage))b('coverage');
if(r.coverage==='none'?n!==null:n>>>0!==n)b('count');if(n===0&&!(r.scanned_seconds>0))b('count 0 unscanned');if(n>0&&!r.path&&!(r.parts&&r.parts.length))b('no path/parts');
if(r.path&&!/^days\/\d{4}\/\d{2}\/\d{2}\.json$/.test(r.path))b('path');if(typeof r.sealed!=='boolean')b('sealed');
if(r.parts&&!(Array.isArray(r.parts)&&r.parts.length<=24&&r.parts.every(p=>p&&/^days\/\d{4}(\/\d\d){3}\.json$/.test(p.path)&&(p.count>>>0||-1)===p.count)))b('parts')},
ni=raw=>{if(!raw||typeof raw!=='object'||!Array.isArray(raw.days))E('not a lightning history index');
if(raw.schema!==IX_SCHEMA)E('unsupported index schema '+raw.schema);
if(raw.observation!=='satellite optical lightning flashes, not ground strikes')E('index observation missing');
const gen=Date.parse(raw.generated_utc);if(!isFinite(gen))E('index generated_utc missing');if(!DRE.test(raw.cutoff_date_utc||''))E('index cutoff_date_utc missing');
raw.days.forEach(vk);
const sw=(raw.scan_windows||[]).map(w=>({s:Date.parse(w.start_utc),e:Date.parse(w.end_utc),n:Number(w.successful_runs)||1})).filter(w=>isFinite(w.s)&&isFinite(w.e)&&w.e>w.s).sort((a,b)=>a.s-b.s),
cutoff=ds(raw.cutoff_date_utc),iv=Number(raw.collection_interval_hours)||3;
return{days:raw.days,by:new Map(raw.days.map(r=>[r.date,r])),sw,gen,cutoff,iv,nextDue:Date.parse(raw.next_update_due_utc||'')||gen+(iv+1)*HOUR,lastScan:sw.length?sw.reduce((a,w)=>Math.max(a,w.e),-Infinity):null,
covStart:Date.parse(raw.coverage_start_utc||'')||(sw.length?sw[0].s:cutoff),cutoffDate:raw.cutoff_date_utc,lost:new Set(raw.days.filter(r=>r.shard_lost).map(r=>r.date))}},
stale=(g,now,f=g)=>!(now-f<=4*HOUR&&g<=now+9e5),
li=q=>{if(!S.ip){const p=S.ip=gj(AR+'index.json'+(q?'?'+q:''),'no-cache').then(ni).then(m=>{if(S.ip===p){for(const k of[...lru.keys()])if(!lru.get(k).sealed)lru.delete(k);S.idx=m;S.ie=null}return m}).catch(e=>{if(S.ip===p){S.ip=null;S.idx=null;S.ie=msg(e)}throw e})}return S.ip},
cv=(x,ws,we)=>{const win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0,l=0,fs=null,lz,pp=0;
for(const w of x.sw){const o=ov(Math.max(ws,b),we,w.s,w.e);if(o<=0)continue;sd+=o;r+=w.n;const s=Math.max(ws,w.s),e=Math.min(we,w.e);a=a===null?s:Math.min(a,s);b=b===null?e:Math.max(b,e)}
for(let t=ds(ymd(ws));t<we;t+=DAY){if(ov(ws,we,t,t+DAY)<=0)continue;d++;const y=ymd(t),row=x.by.get(y);if(x.lost.has(y)){l++;let m=t;for(const w of x.sw)sd-=ov(Math.max(ws,m),Math.min(we,t+DAY),w.s,w.e),m=Math.max(m,w.e)}else if(!row||row.coverage==='none')u.push(y);else{fs??=t;lz=t;pp+=row.coverage==='partial'}}
return{f:win>0?Math.min(1,sd/win):0,r,a,b,d,u,l,fs,lz,pp,k:d-u.length-l,ny:x.lastScan===null?win:Math.max(0,we-Math.max(ws,x.lastScan)),bf:Math.max(0,Math.min(we,x.covStart)-ws)}},
wf=now=>{const P=PERIODS.find(p=>p[0]===S.period)||PERIODS[1],cu=S.period==='custom';let s,e,atLatest;
if(cu){s=ds(S.from);e=Math.min(ds(S.to)+DAY,now);atLatest=ds(S.to)+DAY>=now}else{e=S.end===null?now:Math.min(S.end,now);atLatest=S.end===null;s=P[2]<0?mm(e,-P[2]):e-P[2]}
return{s,e,atLatest,period:P[0],label:P[1],span:e-s,clamped:false,custom:cu}},
tg=(row,ws,we)=>!row||!row.count?[]:row.path?[row]
:(row.parts||[]).filter(p=>{const h=ds(row.date)+p.path.slice(-7,-5)*HOUR;return h<we&&h+HOUR>ws}).map(p=>({...p,sealed:row.sealed})),
sh=(t,date)=>{const u=AR+t.path,c=lg(u);if(c)return c.p;
const p=gj(u,t.sealed?'default':'no-cache',1).then(async b=>{const o=b.byteLength>=0?await new Response(b).json():b,s=(window.crypto||0).subtle;
if(!isFC(o)||o.schema!=='uk-lightning-history-day.v1'||!o.metadata||o.metadata.date_utc!==date)E('invalid day file');
const bad=[o.features.length!==t.count&&'count',b.byteLength!==t.bytes&&'bytes',s&&[...new Uint8Array(await s.digest('SHA-256',b))].map(x=>(x|256).toString(16).slice(1)).join('')!==t.sha256&&'sha256'].filter(Boolean);
if(bad.length)E('index mismatch: '+bad.join(', '));if(!s&&t.sha256)E('not verified (no WebCrypto)');return o.features}).catch(e=>{lru.delete(u);throw e});
ls(u,{p,sealed:!!t.sealed});return p},
fr=async(rows,ws,we,sn)=>{const jobs=[];for(const row of rows)for(const t of tg(row,ws,we))jobs.push({row,t});const parts=new Array(jobs.length),fl=[];let pos=0;
await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(pos<jobs.length&&sn===S.serial){const i=pos++,{row,t}=jobs[i];try{parts[i]=await sh(t,row.date)}catch(e){parts[i]=[];fl.push({date:row.date,error:msg(e),t})}}}));
return{parts,fl,rq:jobs.length}},
ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&(c=>Array.isArray(c)&&c.length<4&&bx(c[0],c[1]))(f.geometry.coordinates)&&f.properties&&FEED_SCHEMA.split('/')[1]===f.properties.observation_kind&&isFinite(tm(f))&&!(f.id&&typeof f.id=='object'),
co=(parts,ws,we)=>{const m=new Map();let k=0;for(const part of parts)for(const f of part){if(!ok(f)){k++;continue}const t=tm(f);if(t>=ws&&t<we)m.set(f.id==null?t+','+f.geometry.coordinates:JSON.stringify(f.id),f)}const a=[...m.values()].sort((a,b)=>tm(a)-tm(b));a.bad=k;return a},
// cells: month grids grid/YYYY-MM.json (0.1°, per UTC day); a day counts only if coverage, count and sha256 match its index row
gg=mo=>{if(!/^\d{4}-\d\d$/.test(mo))E('grid path');const u=AR+'grid/'+mo+'.json',h=lg(u);if(h)return h.p;
const p=gj(u,'no-cache').then(o=>{if(!o||o.schema!==GS||o.month!==mo||o.cols!==140||o.rows!==120||o.cell_deg!==.1||!Array.isArray(o.days)||o.days.length>31||!Array.isArray(o.cells)||o.cells.length>16800)E('invalid grid '+mo);const t=[];
for(const r of o.cells){if(!Array.isArray(r)||r.length%2<1||r.length<3||r.length>63||r[0]>>>0!==r[0]||r[0]>=16800)E('grid cell');for(let i=1;i<r.length;i+=2){const d=r[i],n=r[i+1];if(d>>>0!==d||d<1||d>31||n>>>0!==n||!n)E('grid count');t[d]=(t[d]||0)+n}}
for(const d of o.days)if(!d||!Array.isArray(d.sha256)||(d.date+'').slice(0,8)!==mo+'-'||(t[+d.date.slice(8)]||0)!==(d.count||0))E('grid sum '+mo);return o}).catch(e=>{lru.delete(u);throw e});ls(u,{p});return p},
// land mask: cells whose centre is within 30 km of an onshore REPD site (run lengths); totals keep every cell
LM=()=>{if(!LM.a){const a=LM.a=new Uint8Array(16800);let p=0,v=1;for(const c of'w5Cq7Co9Cn8dbC17beCie83C7rC6sC6r4583Bmr1a28BmAg26BaAqB7AsB6AsB5AtB3AuB4AtB4AsB5AsAw81AqAvB0AvAzAxB0AwB1AvB3AuB3AuB8ArB6AtB4AvB0AwAzAuAyAwAzAxAyAyAxB0AvB0AuB1AmBaAmBbAkBe82A7Bh47A5BrA4Av4e5aA3Am71b7a6A3Alo4b4A4Ajr3c2A5Agv3c1A5Agw3AfAhz3AbAkA0161A3AnB9AoB5AsB1AxAyAzAwB1l2A8B2AtB9AnBbAkBdAiBdAjBcAjBdAiBfAgBiAdBnA6Bh44A5Bh81A6BgAgBgAhBgAhBiAgBjAdBib1A3B872AgB692AfB6ArB5AsB6ArBcAkBdAjB973AcB9b1A9BaA793BeA6BrA7BoAaBmf1vBnd5rBp9dlBs2hmCcmCghChfCghCfhCgfCidCl9Cr2L07ChhCdkCckCdjCehCkdCkdCkcClbClaCp4Tj'.match(/[A-Z]?./g))a.fill(v^=1,p,p+=c[1]?(c.charCodeAt(0)-64)*36+parseInt(c[1],36):parseInt(c,36))}return LM.a},
gd=async(rows,sn)=>{let er,n=0,st=0,k=0;const gs=new Map(await Promise.all([...new Set(rows.filter(y=>y.count>0).map(y=>y.date.slice(0,7)))].map(async m=>[m,await gg(m).catch(e=>(er=e,{days:[],cells:[]}))]))),ok=new Set,c=new Map,f=[],v=[];
for(const y of rows)if(y.count>0){const d=gs.get(y.date.slice(0,7)).days.find(d=>d.date===y.date);if(d&&d.count===y.count&&d.coverage===y.coverage&&d.sha256+''==(y.path?[y.sha256]:y.parts.map(p=>p.sha256))+'')ok.add(y.date),n+=y.count;else st++}if(er&&!n)throw er;
for(const[m,g]of gs)for(const r of g.cells)for(let i=1;i<r.length;i+=2)if(ok.has(m+'-'+(r[i]+'').padStart(2,0)))c.set(r[0],(c.get(r[0])||0)+r[i+1]);
for(const[q,x]of c)if(LM()[q]){const lon=-11+(q%140+.5)/10,lat=49.5+((q/140|0)+.5)/10;k+=x;v.push(x);f.push({type:'Feature',properties:{cell:q,n:x,lon,lat,s:sn},geometry:{type:'Point',coordinates:[lon,lat]}})}
v.sort((a,b)=>a-b);return{fc:FC(f),n,k,st,T:Math.max(30,v[v.length*.95|0]||0)}},
// tiers: live feed (7 days only), archive overview (>31 days), archive detail (budgeted)
ff=async(w,now,reason)=>{
const f=await(S.fp||(S.fp=gx(FEED).catch(e=>{S.fp=null;throw e})));if(!isFC(f))E('invalid live feed');
const ev=co([f.features],w.s,w.e);
return{mode:'feed',w,idx:null,ie:reason,meta:f.metadata||{},old:w.s<now-7*DAY,ev,fl:[],cs:'live feed',ic:ev.length,cl:ev.length>cap(),cov:null}},
lw=async(now,sn,q)=>{const w=wf(now);let x=null,ie=null;try{x=await li(q)}catch(e){ie=msg(e)}
if(!x)return ff(w,now,ie);
if(w.e<=x.cutoff)return{mode:'overview',w,idx:x,before:true,fl:[],ev:[],arch:0};
if(w.s<x.cutoff){w.s=x.cutoff;w.span=w.e-w.s;w.clamped=true}
const rows=[...x.by.values()].filter(y=>{const f=ds(y.date);return f<w.e&&f+DAY>w.s}),known=rows.filter(y=>y.count!==null),
r={mode:'overview',w,idx:x,before:false,rows,arch:known.reduce((n,y)=>n+(y.parts?tg(y,w.s,w.e).reduce((a,p)=>a+p.count,0):y.count),0),cov:cv(x,w.s,w.e),fl:[],ev:[],ld:[],sk:[]};
let tf=rows.filter(y=>y.count>0),bytes=0,count=0,nq=0;
for(const row of tf)for(const t of tg(row,w.s,w.e)){nq++;count+=t.count||0;bytes+=t.bytes>0?t.bytes:(t.count||0)*530}
// within the device cap, 32 MB and RQ files points load for any window; above, cells draw and LOAD POINTS asks first
if(count>Math.min(BUDGET,cap())||bytes>32e6||nq>RQ){r.budget=`${N(count)} flashes, ${N(bytes)} bytes, ${N(nq)} files`;try{r.gd=await gd(rows,sn)}catch(e){r.ge=NA(msg(e))+': '+msg(e)}if(sn!==S.serial)return r;if(!S.consent){r.clp=true;return r}
let run=0,rb=0,rn=0;tf.sort((a,b)=>b.date.localeCompare(a.date));const keep=[];for(const y of tf){const ps=tg(y,w.s,w.e),c=ps.reduce((a,p)=>a+(p.count||0),0),b=ps.reduce((a,p)=>a+(p.bytes>0?p.bytes:(p.count||0)*530),0),q=ps.length;if(r.sk.length||run+c>BUDGET||rb+b>32e6||rn+q>RQ){r.sk.push(y.date);continue}keep.push(y);run+=c;rb+=b;rn+=q}if(!keep.length){r.clp=r.big=1;return r}tf=keep;count=run}
r.ld=tf.map(y=>y.date);r.ic=count;r.cs='index';r.cl=count>cap();
const got=await fr(tf,w.s,w.e,sn);for(const f of got.fl)if(/WebCrypto/.test(f.error))f.u=1;else if(!f.t.sealed&&/mismatch/.test(f.error)){if(!q){S.ip=null;return lw(now,sn,now)}f.error+='; archive updating, reload later';f.u=1}r.mode='detail';r.fl=got.fl;r.rq=got.rq;r.ev=co(got.parts,w.s,w.e);return r},
cf=(r,now)=>{let st;const rs=[];
if(r.fail){st='FAIL';rs.push(r.fail)}else if(r.before){st='BEFORE-ARCHIVE';rs.push('before archive start')}
else if(r.fl.some(f=>!f.u)){st='FAIL';rs.push(`${r.fl.length} of ${r.rq} day files failed`)}
else{const c=r.cov,f=c?c.f:0;if(r.mode==='feed'){st=r.ev.length?'PARTIAL':'UNKNOWN';rs.push('coverage unknown')}else if(!c||f<=0){st='UNKNOWN';rs.push('nothing searched')}
else if(f<1||c.ny>0||c.l||c.u.length||r.fl.length){st='PARTIAL';if(c.ny>0)rs.push('tail unknown');if(c.bf>0)rs.push('head unknown');if(c.u.length)rs.push(`${c.u.length} unscanned dates`);if(!rs.length)rs.push(r.fl.length?'unverified':'gaps in window')}
else if(r.mode!=='overview')st=r.sk.length?(rs.push('days not loaded'),'PARTIAL'):r.ev.length?'READY·DETAIL':'EMPTY-COVERED';else st=r.arch>0?r.gd?'READY·CELLS':'READY·SUMMARY':'EMPTY-COVERED'}
const g=r.idx?r.idx.gen:r.meta?Date.parse(r.meta.query_end_utc):NaN,f=r.idx&&r.idx.lastScan||g;return{st,g,f,stale:!!(r.idx||r.meta)&&r.w.atLatest!==false&&stale(g,now,f),colour:COLOUR(st),rs}},
DN=r=>{const g=r.gd;return`observed optical flashes per ≈10 km cell (not ground strikes): ${N(g.k)} of ${N(g.n)} in ${pl(g.fc.features.length,'cell')} within ≈30 km of UK land (sea and abroad not drawn); unsearched days${g.st?` and ${pl(g.st,'day')} not yet in the grid`:''} unknown, not zero · tap a cell for nearest substations`},
cp=(r,now,k)=>{const w=r.w,x=r.idx,v=r.cov,nz=' (unknown, not zero)',L={window:'',days:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER};
L.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(Math.max(w.s,w.e-1))} inclusive (${pl(Math.ceil(w.span/DAY),'day')}${w.atLatest?', to now':''})`:`Window  ${w.label} · ${dt(w.s)} → ${de(w.s,w.e)} UTC · ${w.atLatest?'latest':'earlier page'}`;
L.days=r.mode==='feed'?`${r.old?'Last 7 days only (live feed)':'Live 7-day feed'} · ${NA(r.ie)}${/404/.test(r.ie)?'':': '+r.ie} · ${r.old?'earlier days unknown, not zero':'hours searched unknown'}`:r.before?`Before the 1-year archive (from ${dm(x.cutoff)}): never searched${nz}`:!v?'':hz(w)?(v.f<=0?`None of the ${w.label} searched yet${nz}`:k&&/READY|EMPTY/.test(k.st)?`All ${w.label} searched (${dt(v.a)} → ${de(v.a,v.b)} UTC)`:`Searched ${du(v.f*w.span)} of ${w.label} (${dt(v.a)} → ${de(v.a,v.b)} UTC) · ${du(w.span*(1-v.f))} not searched${nz}`):!v.k?`None of the ${pl(v.d,'day')} searched yet${nz}`:`${v.k==v.d&&!v.pp?'All':v.k+' of'} ${pl(v.d,'day')} searched (${dm(v.fs)}${v.lz>v.fs?'–'+dm(v.lz):''}${v.pp?`, ${v.pp} in part`:''})${v.u.length?` · ${v.u.length} not yet searched`:''}${v.l?` · ${v.l} lost (integrity alert)`:''}${v.k<v.d?nz:''}`;
if(v&&v.bf>0&&v.f<=0&&x)L.days+=` · archive starts ${dm(x.covStart)}`;
if(w.clamped)L.window+=' · start clamped to retention start '+x.cutoffDate;
if(r.fail){L.warning=r.ie&&!x?`Archive unavailable: ${r.ie} — nothing shown (unknown, not zero)`:r.fail;return L}
if(r.before){L.warning=`Window predates the archive (began ${T(x.covStart)}; retention from ${x.cutoffDate}) — unknown, not zero`;return L}
r.out=0;try{const b=mh().getBounds();r.out=r.ev.filter(f=>!b.contains(f.geometry.coordinates)).length}catch(_){}
const n=r.ev.length,first=n?`Actual  first ${Ts(tm(r.ev[0]))} · last ${Ts(tm(r.ev[n-1]))}`:'',
drawn=(!n?'':` · ${N(n)} drawn as ${r.cl?'clusters':'points'} (cap ${N(cap())})`)+(r.ev&&r.ev.bad?` · ${N(r.ev.bad)} malformed records rejected`:'')+(r.out?` · ${N(r.out)} of ${N(n)} outside the current view`:'');
if(r.mode==='feed'){const m=r.meta,P=(k,f=T)=>f(Date.parse(m[k]));
L.refresh=`Refresh live feed ${P('query_end_utc')} (last collection window ${P('query_start_utc')} → ${P('query_end_utc')}; latest detection ${P('latest_detection_utc',Ts)}; 7-day retention; ${NA(r.ie)}: ${r.ie}; earlier hours unknown, not zero)`;
L.searched='Searched EUMETSAT unknown (live feed records only its last collection window)';if(r.old)L.warning=NA(r.ie)+': earlier coverage unknown, not zero'
L.actual=first||'Actual  none seen in the 7-day feed (unknown, not zero)';L.flashes=`Flashes ${F7(r)}${drawn}`}
else if(r.mode==='detail'){L.actual=r.fl.length?'Actual  unknown (day files failed)':first||'Actual  no archived flashes within this window';
L.flashes=(r.sk.length?`Flashes ${N(r.arch)} archived on the overlapping UTC dates (index, whole days) · ${N(n)} downloaded from the newest ${r.ld.length} of ${r.ld.length+r.sk.length} days (budget ${N(BUDGET)} flashes / 32 MB; ${r.sk.length} days not loaded)${drawn}`:`Flashes ${r.fl.length?`${N(r.ic)} in index · ${N(n)} loaded`:N(n)+' archived in window'}${drawn}`)+(r.gd?' · cells beneath: '+DN(r):'')}
else{const o=r.rows.filter(y=>y.first_observation_utc),k=r.rows.length;
L.actual=o.length?`Actual  on the ${k} overlapping UTC dates: first ${Ts(Date.parse(o[0].first_observation_utc))} · last ${Ts(Date.parse(o[o.length-1].last_observation_utc))} (day-level; may lie outside a midday window edge)`:`Actual  no archived flashes on the ${k} overlapping UTC dates`;
L.flashes=`Flashes ${N(r.arch)} archived on ${k} overlapping UTC dates · ${r.gd?`drawn as ${DN(r)}${r.clp&&!r.big?` · LOAD POINTS adds the newest ${N(BUDGET)} as tappable points`:''}`:`none drawn (summary mode; ${r.clp?`index sum ${r.budget} exceeds the budget; ${r.big?'newest day alone exceeds it; none drawn':`LOAD POINTS draws up to the newest ${N(BUDGET)}`}`:'points load automatically within the budget'})${r.ge?' · cell grid '+r.ge:''}`}`}
if(x)L.refresh=`Refresh archive ${T(x.gen)} (${AGO(now-x.gen)} ago; expected every ${x.iv} h)${stale(x.gen,now,x.lastScan||x.gen)?' · overdue':''}`;
const c=r.mode!=='feed'&&r.cov;if(c){const warn=[];
L.searched=c.f>0?`Searched EUMETSAT ${du(c.f*w.span)} of ${du(w.span)}${c.a!==null?` · ${T(c.a)} → ${T(c.b)}`:''}`:c.l?'Searched EUMETSAT: shard lost (integrity alert), unknown, not zero':'Searched EUMETSAT none of this window — no collection run covers it';
if(c.ny>0)warn.push(`Not yet ingested: last ${AGO(c.ny)} of window (unknown, not zero)`);
if(c.bf>0&&x&&!c.u.length)warn.push(`Unknown: ${ymd(w.s)} to ${ymd(Math.min(w.e,x.covStart)-1)} precede archive start ${T(x.covStart)} (not zero)`);
if(c.l)warn.push(`${c.l} days lost from the archive (integrity alert), unknown, not zero`);if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);
if(r.fl.length)warn.push(`${r.fl.length} of ${r.rq} day files failed (${r.fl.map(f=>f.date+' '+f.error).join(', ')}); points incomplete, counts from index`);
const ub=(r.rows||[]).filter(y=>[y.first_observation_utc,y.last_observation_utc].some(t=>t!=null&&!isFinite(Date.parse(t)))).length;if(ub)warn.push(`${N(ub)} archive entr${ub==1?'y':'ies'} unreadable (malformed timestamp; unknown, not zero)`);
if(c.f<1&&!warn.length)warn.push('Unknown: gaps between collection runs inside this window (not zero)');L.warning=warn.join(' · ')}
if(k&&/UNK|PAR/.test(k.st)&&/^Flashes 0 a/.test(L.flashes))L.flashes+=' (unknown, not zero)'
if(v&&v.f<=0&&!v.l&&r.mode!=='feed'&&!r.fl.length){L.flashes='Flashes not yet searched'+nz;L.actual='Actual  not yet searched'}
return L},
// map: points layer, invisible 44 px hit layer, (clustered) count labels; cells below the original's projects
mh=()=>{const m=window.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{try{for(const l of m.getStyle().layers||[]){const f=l.type==='symbol'&&l.layout&&l.layout['text-font'];if(Array.isArray(f)&&f.length&&typeof f[0]==='string')return f}}catch(_){}return['Open Sans Regular']},
HIT=SRC+'-hit',CEL=SRC+'-cell',CNT=LAYER+'-count',pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
cs=v=>(v+'').replace(/\p{Cf}/gu,'').slice(0,200),el=(t,css,s)=>{const e=document.createElement(t);if(css)e.style.cssText=css;if(s!=null)e.textContent=s;return e},
cpos=()=>{const c=S.pp,m=mh();if(!c||!m)return;const k=m.getContainer().getBoundingClientRect(),q=Q('gridatlas-menu-bar'),t=Math.max(0,(q?q.getBoundingClientRect().bottom:0)-k.top)+8,w=Math.min(480,k.width-16),L=k.left+(k.width-w)/2,h=c.offsetHeight||0;let b=8;
for(const o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){const r=o&&o.getBoundingClientRect();if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=Math.max(b,k.bottom-r.top+8)}
if(b+h>k.height-t)b=8;c.bb=b;c.style.bottom=b+'px';c.style.maxHeight=Math.max(44,k.height-t-b)+'px'},
cx=()=>{const m=mh();pc();if(m)try{for(const l of[CNT,HIT,LAYER])if(m.getLayer(l))m.removeLayer(l);if(m.getSource(SRC))m.removeSource(SRC);dd()}catch(e){note(e)}S.mode=null},
// cells: REPD-style graduated core (n<=3 ~1 px, faint) + glow for the top 5%, violet ramp on log10 n (1/3/10/30/100/300); ids avoid 'l-'
CS=SRC+'-cells',CL=[CEL+'-glow',CEL+'-core',CEL],RP=(m,a)=>{try{return m.getStyle().layers.filter(l=>(l.source=='src-repd'||l.id=='l-subs')&&(a||m.getLayoutProperty(l.id,'visibility')!='none')).map(l=>l.id)}catch(_){return[]}},
dd=g=>{const m=mh();if(!m)return;for(const l of CL)if(m.getLayer(l))m.removeLayer(l);if(m.getSource(CS))m.removeSource(CS);if(!g||!g.fc.features.length)return;
const b=RP(m,1).find(l=>l!='l-subs')||(m.getLayer(LAYER)?LAYER:void 0),L=['log10',['get','n']],I=(x,...s)=>['interpolate',['linear'],x,...s],B=[0,.48,1,1.48,2,2.48],R=v=>I(L,...B.flatMap((k,i)=>[k,v[i]])),Z=(a,c,d)=>I(['zoom'],5,a,7,c,10,d),
C=R(['#5a5590','#6f68a8','#8d7fd0','#a066ff','#c23cff','#e01cff']),A=(i,p,x)=>m.addLayer({id:CL[i],type:'circle',source:CS,...x,paint:p},b);m.addSource(CS,{type:'geojson',data:g.fc});
A(0,{'circle-radius':Z(I(L,1.48,5,2.48,13),I(L,1.48,8,2.48,20),I(L,1.48,16,2.48,36)),'circle-color':C,'circle-opacity':I(L,1.48,.15,2.48,.4),'circle-blur':1},{filter:['>=',['get','n'],g.T]});
A(1,{'circle-radius':Z(R([.8,1,1.2,1.7,3.2,6]),R([1,1.2,1.6,2.4,5,9]),R([2,2.5,3.5,6,12,20])),'circle-color':C,'circle-opacity':R([.22,.3,.42,.6,.85,.95]),'circle-stroke-width':I(L,1.48,0,2,.6),'circle-stroke-color':'#140a2a'},{layout:{'circle-sort-key':['get','n']}});
A(2,{'circle-radius':22,'circle-opacity':0})},
dw=(fc,cl)=>{const m=mh(),K={'circle-stroke-width':1.5,'circle-stroke-color':'#1a1a1a'},Z=k=>['interpolate',['linear'],['zoom'],5,k(6),8,k(8),11,k(10)];if(!m)E('no map');const mode=cl?'cluster':'raw';if(S.mode&&S.mode!==mode)cx();
if(!m.getSource(SRC)){m.addSource(SRC,Object.assign({type:'geojson',data:FC()},cl?{cluster:true,clusterRadius:40,clusterMaxZoom:10}:{}));
m.addLayer({id:LAYER,type:'circle',source:SRC,layout:{visibility:'none'},paint:cl?{'circle-radius':Z(x=>['case',['has','point_count'],['step',['get','point_count'],12,100,16,1000,20,10000,26],x]),...K,'circle-color':['case',['has','point_count'],'#ffb000','#fff3a0'],'circle-opacity':0.9}
:{'circle-radius':Z(x=>x),...K,'circle-color':'#fff3a0','circle-opacity':0.95}});
m.addLayer({id:HIT,type:'circle',source:SRC,layout:{visibility:'none'},paint:{'circle-radius':22,'circle-opacity':0}});
if(cl)try{m.addLayer({id:CNT,type:'symbol',source:SRC,filter:['has','point_count'],layout:{visibility:'none','text-field':['get','point_count_abbreviated'],'text-font':sf(m),'text-size':11},paint:{'text-color':'#000'}})}catch(e){note('count labels: '+msg(e))}S.mode=mode}
m.getSource(SRC).setData(fc);const v=fc.features.length?'visible':'none';for(const l of[LAYER,HIT,CNT])if(m.getLayer(l))m.setLayoutProperty(l,'visibility',v)},
// tap: a flash (or cluster) under the tap wins, then the nearest cell unless a project/substation of the original is hit
tap=e=>{const m=mh();if(!S.on||!m)return;const px=e.point.x??e.point[0],py=e.point.y??e.point[1],Y=l=>m.getLayer(l)?m.queryRenderedFeatures(e.point,{layers:[l]}):[];let f=null,dm=Infinity;
for(const q of Y(HIT)){const g=q.properties&&!q.properties.cluster&&S.res&&S.res.ev[q.properties.i],a=m.project((g||q).geometry.coordinates),d=(a.x-px)**2+(a.y-py)**2;if(d<dm){dm=d;f=q}}pc();if(!f){const rp=RP(m);if(rp.length&&m.queryRenderedFeatures(e.point,{layers:rp}).length)return;for(const q of Y(CEL)){const p=q.properties||{},k=cb(p),a=k&&m.project([p.lon,p.lat]),d=k?(a.x-px)**2+(a.y-py)**2:1/0;if(d<dm){dm=d;f=p}}return f&&cc(m,f)}
const p=f.properties||{};if(p.cluster){const go=z=>m.easeTo({center:f.geometry.coordinates,zoom:z}),z=m.getSource(SRC).getClusterExpansionZoom(p.cluster_id,(err,z)=>err||go(z));if(z&&z.then)z.then(go,note);return}
const g=S.res&&p.s===S.res.s&&S.res.ev[p.i];if(!g)return;const[x,y]=g.geometry.coordinates,id=g.id==null?'(none)':cs(g.id);
cd(m,x,y,'Lightning flash','Flash '+Ts(tm(g)),`lat ${y.toFixed(3)}, lon ${x.toFixed(3)} · ID ${sid(id)}`,'Flash ID '+id,'optical flash')},
cd=(m,x,y,lb,ti,su,de,wh)=>{const c=el('div','position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;background:#000;color:#e8f4f5;border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25);font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain'),
bar=el('div','display:flex;align-items:center;gap:6px;padding-left:8px;background:#0a1a1d;border-bottom:1px solid #1d3238'),bd=el('div','padding:0 8px 6px'),d=el('details'),
B=(t,a,f)=>{const e=el('button','flex:none;width:44px;height:44px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:14px/1 monospace;cursor:pointer',t);e.type='button';e.setAttribute('aria-label',a);e.addEventListener('click',f);bar.appendChild(e);return e};
c.dataset.lightningCard='';c.setAttribute('role','dialog');c.setAttribute('aria-label',lb);c.wh=wh;
bar.appendChild(el('span','flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5fbdc2;font-weight:bold',ti));
const mn=B('−','Minimise',()=>{const o=bd.style.display=='none';bd.style.display=o?'':'none';mn.textContent=o?'−':'+';mn.setAttribute('aria-expanded',o);cpos()});mn.setAttribute('aria-expanded',true);B('×','Close',pc);
c.sm=el('summary','padding:14px 0 13px;line-height:17px;cursor:pointer;color:#bfe9ee',su);d.appendChild(c.sm);
d.appendChild(el('div','color:#8b9aa1;font-size:10px;overflow-wrap:anywhere',de));c.out=el('div','margin-top:4px;color:#9fb3ba');d.appendChild(c.out);bd.appendChild(d);
bd.appendChild(el('div','color:#8b9aa1;font-size:10px','EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.'));
c.appendChild(bar);c.appendChild(bd);S.pp=c;m.getContainer().appendChild(c);cpos();nf(m,c,x,y,15)},
cb=p=>{const c=p.cell,w=-11+c%140/10,s=49.5+(c-c%140)/1400;return c>>>0===c&&c<16800&&p.n>>>0===p.n&&p.n>0&&p.lon>w&&p.lon<w+.1&&p.lat>s&&p.lat<s+.1&&S.res&&(p.s==null||p.s===S.res.s)?[w,s]:null},
cc=(m,p)=>{const[w,s]=cb(p),W=S.res.w,r=a=>a.toFixed(2)+'–'+(a+.1).toFixed(2);cd(m,p.lon,p.lat,'Lightning cell',pl(p.n,'observed optical flash','es')+' · ≈10 km cell',`${ymd(W.s)} to ${ymd(Math.max(W.s,W.e-1))} UTC · centre lat ${p.lat.toFixed(3)}, lon ${p.lon.toFixed(3)}`,`Cell lat ${r(s)}, lon ${r(w)} (0.1°) · searched UTC days only; unsearched days unknown, not zero`,'cell centre')},
sid=s=>{const r=/_\d{8}(\d\d)(\d\d)\d\d_\d{8}(\d\d)(\d\d)\d\d_N_.*:(\d+)$/.exec(s);return r?`${r[1]}:${r[2]}–${r[3]}:${r[4]} #${r[5]}`:s.length>24?s.slice(0,12)+'…'+s.slice(-8):s},
// nearest substations: the original's own measure (__GRIDATLAS_NEON_LINKS__.measure.nearestSubstations) drawn as its neon
// arrival in Lightning-owned layers; link.selectAt is not used (it treats its origin as a project; kv-arrival-api).
NP='gridatlas-lightning-neon',NI=['glow','core','flow','flow-b','node-ring','node','label','pin-halo','pin'].map(s=>NP+'-'+s),NSR=[NP+'-links',NP+'-nodes',NP+'-pin'],
nc=()=>{const m=mh();if(S.raf){cancelAnimationFrame(S.raf);S.raf=null}if(m)try{for(const l of[...NI].reverse())if(m.getLayer(l))m.removeLayer(l);for(const s of NSR)if(m.getSource(s))m.removeSource(s)}catch(e){note(e)}},
nr=(m,c,x,y)=>{const L=window.__GRIDATLAS_NEON_LINKS__||{},M=L.measure||{},subs=Object.hasOwn(L,'substations')?L.substations:null,say=s=>c.out.appendChild(el('div','',s));c.out.textContent='';nc();
if(!Array.isArray(subs)||!subs.length||typeof M.nearestSubstations!=='function')return say('Substation data not loaded yet; trying again.'),0;
const k=M.nearestSubstations(x,y,subs);say(`Nearest substations to this ${c.wh} (straight-line km). Not evidence any asset was struck; faults can have other causes.`);
if(!k.length){const b=k.beyondRadiusNearest;say(`No substation within ${k.radiusKm||40} km`+(b?` (nearest: ${cs(b.name||'unnamed substation')}, ${(+b.km).toFixed(2)} km)`:''));return k}
for(const a of k)say(`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV · ${cs(a.name||'unnamed substation')}`);
const o=[x,y],TC='#d8c96a',TL='#5fbdc2',FL='#bfe9ee',Z=(a,b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},
A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{}));
m.addSource(NSR[0],{type:'geojson',data:FC(k.map((a,i)=>({type:'Feature',properties:{colour:TC,strength:Math.max(.2,.62-i*.1)},geometry:{type:'LineString',coordinates:[o,a.at]}})))});
m.addSource(NSR[1],{type:'geojson',data:FC(k.map(a=>({type:'Feature',properties:{label:`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV`},geometry:{type:'Point',coordinates:a.at}})))});
A(0,'line',NSR[0],{'line-color':['get','colour'],'line-width':Z(5,12),'line-opacity':.1,'line-blur':Z(3,8)},RJ);
A(1,'line',NSR[0],{'line-color':['get','colour'],'line-width':Z(.9,1.8),'line-opacity':['get','strength']},RJ);
A(2,'line',NSR[0],{'line-color':FL,'line-width':Z(1.2,2.4),'line-opacity':.8,'line-dasharray':[.2,3.2]},{'line-cap':'round'});
A(3,'line',NSR[0],{'line-color':FL,'line-width':Z(.9,1.8),'line-opacity':.45,'line-dasharray':[.2,3.2]},{'line-cap':'round'});
A(4,'circle',NSR[1],{'circle-radius':Z(6,13),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':TL,'circle-stroke-width':1,'circle-stroke-opacity':.4});
A(5,'circle',NSR[1],{'circle-radius':Z(2.2,4),'circle-color':TL,'circle-opacity':.8});
try{A(6,'symbol',NSR[1],{'text-color':'#a9c4c9','text-halo-color':'#000c10','text-halo-width':1.5,'text-opacity':.9},{'text-field':['get','label'],'text-size':10,'text-offset':[0,-1.5],'text-anchor':'bottom','text-allow-overlap':false,'text-font':sf(m)})}catch(e){note('neon labels: '+msg(e))}
m.addSource(NSR[2],{type:'geojson',data:FC([{type:'Feature',properties:{},geometry:{type:'Point',coordinates:o}}])});
A(7,'circle',NSR[2],{'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':TC,'circle-stroke-width':6,'circle-stroke-opacity':.13,'circle-blur':.4});
A(8,'circle',NSR[2],{'circle-radius':Z(11,26,14),'circle-color':'rgba(0,0,0,0)','circle-stroke-color':'#cfe9ed','circle-stroke-width':1.6,'circle-stroke-opacity':.85});
let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches===true}catch(_){}
if(rm){m.setPaintProperty(NI[2],'line-opacity',0);m.setPaintProperty(NI[3],'line-opacity',0)}else if(typeof requestAnimationFrame=='function'){let ph=0;const fd=typeof M.flowDash=='function'?M.flowDash:p=>{const s=Math.floor(p/1.5*24)%24/24*1.5;return[.001,Math.max(.001,s),.42,Math.max(.001,1.5-s)]},mo={},
set=(i,p)=>{const d=fd(p),j=d.join();if(mo[i]!==j){mo[i]=j;m.setPaintProperty(NI[i],'line-dasharray',d)}},st=()=>{ph=(ph+.055)%1.5;try{set(2,ph);set(3,(ph+.75)%1.5)}catch(_){S.raf=null;return}S.raf=requestAnimationFrame(st)};S.raf=requestAnimationFrame(st)}
return k},
nf=(m,c,x,y,n)=>{if(S.pp!==c)return;let k;try{k=nr(m,c,x,y)}catch(e){note('nearest: '+msg(e));nc();c.out.textContent='Substation data unavailable.';return cpos()}cpos();
if(Array.isArray(k)){c.sm.textContent+=k.length?` · ${k.length} nearest substations`:` · none within ${k.radiusKm||40} km`;if(k.length)nz(m,x,y,k);return}if(n)setTimeout(()=>nf(m,c,x,y,n-1),2e3)},
nz=(m,x,y,k)=>{try{m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});const ck=()=>{const v=m.getBounds&&m.getBounds();if(!v||S.pp===null||k.every(a=>v.contains(a.at)))return;let w=x,s=y,e=x,n=y;for(const[a,o]of k.map(a=>a.at)){w=Math.min(w,a);e=Math.max(e,a);s=Math.min(s,o);n=Math.max(n,o)}
m.fitBounds([[w,s],[e,n]],{padding:{top:90,left:40,right:40,bottom:220},maxZoom:12,duration:900})};typeof m.once=='function'?m.once('moveend',ck):ck()}catch(e){note('camera: '+msg(e))}},
BTN=(a,t,x)=>`<button type="button" class="map-ctrl-btn" ${a}${x||''}>${t}</button>`,NAV=(k,t,x)=>BTN(`data-lightning-nav="${k}"`,t,x),ROW='style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0"',
DATE=k=>`<input type="date" class="search-input" data-lightning-date="${k}" aria-label="${k} date (UTC)" style="width:9.5em;color-scheme:dark">`,
bg=key=>{const g=document.createElement('div');g.className='key-group';g.style.gridColumn='1/-1';g.dataset.lightningGroup=key;
g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-lightning-control="toggle"> <span data-lightning-label="${key}" style="color:#ffdf44">${BASE} [WAIT]</span></label>`
+`<div data-lightning-controls="${key}" hidden><div role="group" ${ROW}>${PERIODS.map(p=>BTN(`data-lightning-period="${p[0]}"`,p[0].toUpperCase())).join('')}</div>`
+`<div class="radius-input-row" data-lightning-custom style="display:none;flex-wrap:wrap;margin:4px 0"><span class="radius-unit">From (UTC)</span>${DATE('from')}<span class="radius-unit">To (incl.)</span>${DATE('to')}${NAV('apply','APPLY')}</div>`
+`<div ${ROW}>${NAV('prev','◀ PREV')}${NAV('latest','LATEST',' disabled')}${NAV('next','NEXT ▶',' disabled')}${NAV('points','LOAD POINTS',' hidden')}${NAV('fit','FIT FLASHES',' hidden')}</div>`
+`<div class="status-legend" style="border:0;margin:0;padding:2px 0"><div class="status-dot" style="color:#bbb"><span data-lightning-dot style="background:#888"></span>LOADING</div></div>`
+`<div id="gridatlas-lightning-caption-${key}" data-lightning-caption role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word">`
+['window','days','actual','flashes','refresh','searched','warning','footer'].map(k=>`<div data-cap="${k}"${k==='days'?' style="font-weight:bold"':k==='warning'?' style="color:#ffcc00"':k==='footer'?' style="font-size:11px;color:#bbb"':''}></div>`).join('')+'</div></div>';
if(ph())g.querySelectorAll('.map-ctrl-btn').forEach(b=>b.style.cssText+='min-height:44px;min-width:44px');
const q=s=>g.querySelector(s),sf={key,group:g,toggle:q('[data-lightning-control]'),label:q('[data-lightning-label]'),ctl:q('[data-lightning-controls]'),custom:q('[data-lightning-custom]'),from:q('[data-lightning-date="from"]'),to:q('[data-lightning-date="to"]'),dot:q('[data-lightning-dot]'),stx:q('.status-dot').lastChild,caps:{},nav:{},chips:{}};
g.querySelectorAll('[data-cap],[data-lightning-nav],[data-lightning-period]').forEach(n=>{const d=n.dataset;if(d.cap)sf.caps[d.cap]=n;else if(d.lightningNav)sf.nav[d.lightningNav]=n;else sf.chips[d.lightningPeriod]=n});
g.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||!g.contains(b))return;if(b.dataset.lightningPeriod)sp(b.dataset.lightningPeriod);else if(b.dataset.lightningNav)nv(b.dataset.lightningNav,sf)});
return sf},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},flag=(n,a,on)=>{if(n)on?n.setAttribute(a,''):n.removeAttribute(a)},
lt=(r,c,loading)=>{if(!S.on)return BASE+' [WAIT]';if(loading)return BASE+' [LOAD]';if(!r||c.st==='FAIL')return BASE+' [FAIL]';
const n=fn(r);return`${BASE} [${r.mode==='feed'?(n?N(n):'none seen')+' | '+(r.old?'last 7 days only':'live feed'):/UNKNOWN|BEFORE/.test(c.st)?(r.before?'UNKNOWN':'not yet searched')+' | '+(r.before?'before archive':sv(r,c)):(n?N(n):'none found')+' | '+sv(r,c)}]`},fn=r=>r.mode==='overview'||r.mode==='detail'&&(r.sk.length||r.fl.length)?r.arch:r.ev.length,
sl=(r,c)=>{const st=c.st,n=fn(r),z=c.stale?' · '+lr(c.g,Date.now(),c.f).toUpperCase()+' · STALE':'';
return st==='FAIL'?'FAIL · '+c.rs.join('; ')+z:(r.mode==='feed'?`${pl(n,'flash','es')} · ${r.old?'last 7 days only · older not yet collected':'live 7-day feed · searched unknown'}`:/UNKNOWN|BEFORE/.test(st)?(r.before?'unknown':'not yet searched')+' · '+(r.before?'before archive (from '+dm(r.idx.cutoff)+')':sv(r,c)):`${n?(r.sk&&r.sk.length?N(r.ev.length)+' of ':'')+pl(n,'flash','es'):st==='EMPTY-COVERED'?'no flashes detected':'none found'} · ${sv(r,c,1)}`).toUpperCase()+z},
pt=loading=>{S.busy=loading;const now=Date.now(),r=S.res,c=r?cf(r,now):null,L=r?cp(r,now,c):null,text=lt(r,c,loading),fail=!!(c&&c.st==='FAIL'),w=r?r.w:null;
for(const sf of S.sfs){if(sf.toggle.checked!==S.on)sf.toggle.checked=S.on;txt(sf.label,text);sf.label.style.opacity=fail?'0.6':'1'}
for(const sf of S.sfs){flag(sf.ctl,'hidden',!S.on);if(!S.on)continue;
for(const k in sf.chips){const b=sf.chips[k],na=!S.idx&&!!S.ie&&LONG.includes(k);b.setAttribute('aria-pressed',b.classList.toggle('active',k===S.period));
if(LONG.includes(k)){let d=b.lastChild;if(!d||!d.tagName){d=document.createElement('span');d.style.opacity='.55';b.appendChild(d)}txt(d,na?' •':'');b.title=na?'7-day feed only: the archive is not available yet':''}}
const cu=S.period==='custom';sf.custom.style.display=cu?'flex':'none';if(S.idx)sf.from.min=sf.to.min=S.idx.cutoffDate;sf.from.max=sf.to.max=ymd(now);if(sf.from.value!==S.from)sf.from.value=S.from;if(sf.to.value!==S.to)sf.to.value=S.to;
sf.nav.prev.disabled=loading||cu||!S.idx||!w||w.s<=S.idx.covStart||w.s-w.span<S.idx.cutoff;sf.nav.next.disabled=sf.nav.latest.disabled=loading||cu||!w||w.atLatest;flag(sf.nav.points,'hidden',!(r&&r.clp&&!r.big));flag(sf.nav.fit,'hidden',loading||!(r&&r.ev.length));
sf.dot.style.background=loading?COLOUR('L'):c.colour;txt(sf.stx,loading?'LOADING':sl(r,c));if(!loading){for(const k in L)txt(sf.caps[k],L[k]);if(c)sf.caps.days.style.color=c.colour}}
if(r&&!loading)S.last={state:c.st,stale:c.stale,mode:r.mode,period:w.period,drawn:r.ev.length,cluster:!!r.cl,cap:cap(),cap_source:r.cs||null,index_count:r.ic===undefined?null:r.ic,failures:r.fl.length,reasons:c.rs,cells:r.gd?r.gd.fc.features.length:0};if(S.installed)fit()},
sp=p=>{S.period=p;S.consent=false;S.end=null;S.h=[];if(p==='custom'&&!S.from)S.from=S.to=ymd(Date.now());ld()},
fb=()=>{const e=S.res&&S.res.ev,m=mh();if(!e||!e.length||!m)return;let a=180,b=90,c=-180,d=-90;for(const f of e){const[x,y]=f.geometry.coordinates;a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y)}m.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:9})},
nv=(which,sf)=>{if(which==='fit')return fb();const now=Date.now(),w=wf(now);S.consent=which==='points';
if(which==='apply'){const f=sf.from.value,t=sf.to.value,good=DRE.test(f)&&DRE.test(t)&&f<=t&&t<=ymd(now);sf.from.style.borderColor=sf.to.style.borderColor=good?'':'#ff4444';
if(!good)return txt(sf.caps.warning,'Custom dates invalid — nothing loaded');S.from=f;S.to=t}
else if(which==='latest'){S.end=null;S.h=[];return ld(true)}else if(which==='prev')S.h.push(S.end),S.end=w.s;else if(which==='next')S.end=S.h.pop()||null;
ld()},
ld=refresh=>{if(!refresh)pc();const serial=++S.serial,now=Date.now();if(refresh)S.ip=S.fp=null;pt(true);
lw(now,serial).then(r=>({r}),e=>({e})).then(({r,e})=>{if(serial!==S.serial||!S.on)return;
if(e){note(e);r={mode:'fail',fail:msg(e),w:wf(now),idx:S.idx,ie:S.ie,fl:[],ev:[]}}
S.res=r;r.s=serial;try{dw(FC(r.ev.map((f,i)=>({type:'Feature',id:f.id,geometry:f.geometry,properties:{i,s:serial}}))),!!r.cl);dd(r.gd)}catch(err){note('draw: '+err.message);r.fail=r.fail||'map layer: '+err.message}pt(false)})},
so=on=>{if(S.on===on)return;S.on=on;
if(on){S.end=null;S.consent=false;S.res=null;const m=mh();if(m&&!S.ck&&typeof m.on==='function'){S.ck=1;m.on('click',tap);m.on('resize',cpos);m.on('moveend',()=>{if(S.on&&S.res&&!S.busy)pt(false)})}
ld(true);if(!S.timer)S.timer=setInterval(()=>{if(S.on&&S.res&&S.res.w.atLatest)ld(true)},6e5)}
else{S.serial++;S.res=null;cx();if(S.rz){S.rz.disconnect();S.rz=S.ro=null}if(S.timer){clearInterval(S.timer);S.timer=null}pt(false)}},
bt=c=>c.addEventListener('change',ev=>{const t=ev.target;if(t&&t.dataset&&t.dataset.lightningControl==='toggle')so(!!t.checked)}),
fit=()=>{const d=Q('gridatlas-dash-toggle'),b=d&&d.getBoundingClientRect(),v=b&&b.height;if(d&&d!==S.ro&&typeof ResizeObserver=='function'){if(S.rz)S.rz.disconnect();(S.rz=new ResizeObserver(fit)).observe(S.ro=d)}for(const sf of S.sfs){const s=sf.group.style;s.paddingBottom=(v?innerHeight-b.top+16:96)+'px';s.paddingRight=(v?Math.max(0,sf.group.getBoundingClientRect().right-b.left+16):0)+'px'}},
ins=()=>{if(S.installed)return true;
const M=NS.menuBar,P=window.__GRIDATLAS_PIPELINE_LAYERS__,host=Q('scada-ui-container'),miss=[];
if(!(M&&M.installed===true))miss.push('menuBar');if(!(P&&P.installed))miss.push('pipelineLayers');if(!mh())miss.push('map');if(!host||!host.querySelector('.key-group'))miss.push('groups');S.waiting_for=miss;if(miss.length)return false;
const main=bg('main');host.appendChild(main.group);bt(host);S.sfs.push(main);
const cur=Q('fs-curtain-keys');if(cur){const fs=bg('fs');cur.appendChild(fs.group);bt(cur);S.sfs.push(fs)}
S.installed=true;pt(!S.res);for(const e of['resize','orientationchange','click','transitionend'])addEventListener(e,fit);return true};
if(typeof setInterval==='function'&&typeof MutationObserver==='function'){const ob=new MutationObserver(()=>tick()),poll=setInterval(()=>tick(),250),
tick=()=>{try{if(ins()){clearInterval(poll);ob.disconnect()}}catch(e){note('install: '+msg(e))}};ob.observe(document.documentElement,{childList:true,subtree:true})}
NS.ukLightning=Object.freeze({schema:S.schema,generation:GEN,state:S,install:ins,setOn:so,load:()=>ld(true),windowFor:wf});
})();
