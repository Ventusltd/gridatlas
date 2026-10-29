/* uk-lightning-overlay, generation 202610290246 (UTC). EUMETSAT MTG LI L2-LFL optical flashes, OFF by default, never persisted; NOT confirmed ground strikes; unsearched is unknown, never zero. Long periods: ≈10 km cells within 30 km of a REPD site. */
/* M2: a tap lists the nearest REPD project sites (straight-line, 40 km; projects at one point grouped; status and technology filters; 10 km / 40 km summary); a row flies to the project and draws its nearest-substation links, with "◀ back" to the lightning card. Distance only: never "affected". */
/* M4: a module camera move never starts inside another (MapLibre fires moveend synchronously from stop()): the pending framing is dropped before each own move and otherwise runs after the stop that fired it, only when the map is not moving. */
/* M3: the original REPD map layers of the listed technologies are switched on through their own Layers checkboxes, and only those M3 switched on are switched off again on close, lightning OFF, a period change, LATEST or a new list. */
/* M5: every listed REPD project shows its full REPD record (address, postcode, county, region, ref, operator, planning) from the pinned parquet the map's project search reads, joined only on an exact point, name, MW and type match; plus an Area summary. */
(()=>{'use strict';
let MX=Math.max,MN=Math.min,AI=Array.isArray,DP=Date.parse,ap=(p,c)=>p.appendChild(c),gr=e=>e.getBoundingClientRect(),U='unknown, not zero',NS=(window.__GRIDATLAS_MODULES__=window.__GRIDATLAS_MODULES__||{});
if(NS.ukLightning||typeof document==='undefined')return;
let GEN='202610290246',AR='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/',IX_SCHEMA='uk-lightning-history-index.v2',GS='uk-lightning-history-grid.v1',
FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson',FEED_SCHEMA='FeatureCollection/optical_lightning_flash',
SRC='gridatlas-lightning',LAYER='l-gridatlas-lightning',DAY=864e5,HOUR=36e5,TMO=15000,BUDGET=40000,RQ=400,DRE=/^\d{4}-\d{2}-\d{2}$/,TOE='timeout after 15 s',NA=e=>/HTTP 404/.test(e)?'archive not yet published':'archive unavailable',
PERIODS=[['12h','12 hours',12*HOUR],['24h','24 hours',DAY],['48h','48 hours',2*DAY],['7d','7 days',7*DAY],['30d','30 days',30*DAY],['3m','3 months',-3],['6m','6 months',-6],['12m','12 months',-12],['custom','Custom UTC dates',0]],
LONG=['30d','3m','6m','12m'],BASE='Lightning Flashes (Optical)',TITLE='Weather · EUMETSAT Lightning Imager',
FOOTER=`Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are ${U} · UK box −11.0,49.5 → 3.0,61.5`,
COLOUR=st=>({L:'#888',P:'#ffcc00',U:'#ff8800',B:'#ff8800',F:'#ff4444'})[st[0]]||'#00ff88',
ymd=t=>new Date(t).toISOString().slice(0,10),ds=d=>DP(d+'T00:00:00Z'),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
T=(t,n=16)=>isFinite(t)?new Date(t).toISOString().slice(0,n).replace('T',' ')+' UTC':'unknown',Ts=t=>T(t,19),
N=n=>Number(n).toLocaleString('en-GB'),pl=(n,w,s='s')=>N(n)+' '+w+(n==1?'':s),dm=t=>{let s=new Date(t).toUTCString(),y=s.slice(12,16);return+s.slice(5,7)+s.slice(7,11)+(y==new Date().getUTCFullYear()?'':' '+y)},hm=t=>T(t).slice(11,16),dt=t=>dm(t)+' '+hm(t),du=m=>(m=Math.round(m/6e4),(m>59?N(m/60|0)+' h ':'')+(m%60||m<60?m%60+' min':'')).trim(),hz=w=>!w.custom&&w.span<=2*DAY,de=(a,b)=>dm(a)==dm(b)?hm(b):dt(b),sv=(r,k,p)=>{let v=r.cov,w=r.w,a=k&&/READY|EMPTY/.test(k.st);return hz(w)?(a?'all ':(v.f>0?du(v.f*w.span):'0')+' of ')+w.label+' searched':(a?'all '+pl(v.d,'day'):`${v.k} of ${pl(v.d,'day')}`)+' searched'+(p&&v.pp?` (${v.pp} in part)`:'')},lr=(g,now,f)=>isFinite(g)?`collector last ran ${ymd(g)==ymd(now)?hm(g):dt(g)} UTC${f&&g-f>HOUR?`, searched to ${ymd(f)==ymd(now)?hm(f):dt(f)} UTC`:''}${g>now+9e5?' (device clock behind)':''}`:'collector last run unknown',F7=r=>`${N(r.ev.length)} seen in the available 7-day feed · ${r.w.label} requested${r.old?' · older history unknown':''}`,AGO=t=>t<0?'?':t<3e4?'<1 min':du(t),
ov=(a,b,c,d)=>MX(0,MN(b,d)-MX(a,c)),FC=f=>({type:'FeatureCollection',features:f||[]}),bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5,isFC=o=>o&&o.type==='FeatureCollection'&&AI(o.features),tm=f=>{let s=f.properties.time_utc+'';return DP(/T[\d:.]+$/.test(s)?s+'Z':s)},msg=e=>cs(e&&e.message||e),
ph=()=>{try{return matchMedia('(pointer: coarse)').matches||window.innerWidth<=700}catch(_){return false}},cap=()=>ph()?10000:40000,
mm=(t,k)=>{let d=new Date(t),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-k);d.setUTCDate(MN(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.getTime()},
S={schema:'gridatlas.module.uk-lightning-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,requests:0,errors:[],last:null,
period:'24h',end:null,h:[],from:'',to:'',consent:false,serial:0,idx:null,ie:null,res:null,sfs:[]},lru=new Map(),
note=m=>S.errors.push(String(m)),
gj=(u,cache,raw)=>{let c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw c.signal.aborted||e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
gx=u=>{S.requests++;return new Promise((res,rej)=>{let x=new XMLHttpRequest();x.open('GET',u);x.timeout=TMO;
x.onload=()=>{if(x.status>=200&&x.status<300){try{if(x.responseURL&&!x.responseURL.startsWith(u))E('redirected');res(JSON.parse(x.responseText))}catch(e){rej(e)}}else rej(new Error('HTTP '+x.status))};
x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.send()})},
lg=k=>{if(!lru.has(k))return;let v=lru.get(k);lru.delete(k);lru.set(k,v);return v},ls=(k,v)=>{lru.delete(k);lru.set(k,v);while(lru.size>RQ)lru.delete(lru.keys().next().value)},
vk=r=>{let n=r&&r.count,b=w=>E(`invalid index row ${r&&r.date}: ${w}`);if(!r||ymd(ds(r.date)||0)!=r.date)b('date');if(!['none','partial','full'].includes(r.coverage))b('coverage');
if(r.coverage==='none'?n!==null:n>>>0!==n)b('count');if(n===0&&!(r.scanned_seconds>0))b('count 0 unscanned');if(n>0&&!r.path&&!(r.parts&&r.parts.length))b('no path/parts');
if(r.path&&!/^days\/\d{4}\/\d{2}\/\d{2}\.json$/.test(r.path))b('path');if(typeof r.sealed!=='boolean')b('sealed');
if(r.parts&&!(AI(r.parts)&&r.parts.length<=24&&r.parts.every(p=>p&&/^days\/\d{4}(\/\d\d){3}\.json$/.test(p.path)&&(p.count>>>0||-1)===p.count)))b('parts')},
ni=raw=>{if(!raw||typeof raw!=='object'||!AI(raw.days))E('not a lightning history index');
if(raw.schema!==IX_SCHEMA)E('unsupported index schema '+raw.schema);
if(raw.observation!=='satellite optical lightning flashes, not ground strikes')E('index observation missing');
let gen=DP(raw.generated_utc);if(!isFinite(gen))E('index generated_utc missing');if(!DRE.test(raw.cutoff_date_utc||''))E('index cutoff_date_utc missing');
raw.days.forEach(vk);
let sw=(raw.scan_windows||[]).map(w=>({s:DP(w.start_utc),e:DP(w.end_utc),n:Number(w.successful_runs)||1})).filter(w=>isFinite(w.s)&&isFinite(w.e)&&w.e>w.s).sort((a,b)=>a.s-b.s),
cutoff=ds(raw.cutoff_date_utc),iv=Number(raw.collection_interval_hours)||3;
return{days:raw.days,by:new Map(raw.days.map(r=>[r.date,r])),sw,gen,cutoff,iv,nextDue:DP(raw.next_update_due_utc||'')||gen+(iv+1)*HOUR,lastScan:sw.length?sw.reduce((a,w)=>MX(a,w.e),-Infinity):null,
covStart:DP(raw.coverage_start_utc||'')||(sw.length?sw[0].s:cutoff),cutoffDate:raw.cutoff_date_utc,lost:new Set(raw.days.filter(r=>r.shard_lost).map(r=>r.date))}},
stale=(g,now,f=g)=>!(now-f<=4*HOUR&&g<=now+9e5),
li=q=>{if(!S.ip){let p=S.ip=gj(AR+'index.json'+(q?'?'+q:''),'no-cache').then(ni).then(m=>{if(S.ip===p){for(let k of[...lru.keys()])if(!lru.get(k).sealed)lru.delete(k);S.idx=m;S.ie=null}return m}).catch(e=>{if(S.ip===p){S.ip=null;S.idx=null;S.ie=msg(e)}throw e})}return S.ip},
cv=(x,ws,we)=>{let win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0,l=0,fs=null,lz,pp=0;
for(let w of x.sw){let o=ov(MX(ws,b),we,w.s,w.e);if(o<=0)continue;sd+=o;r+=w.n;let s=MX(ws,w.s),e=MN(we,w.e);a=a===null?s:MN(a,s);b=b===null?e:MX(b,e)}
for(let t=ds(ymd(ws));t<we;t+=DAY){if(ov(ws,we,t,t+DAY)<=0)continue;d++;let y=ymd(t),row=x.by.get(y);if(x.lost.has(y)){l++;let m=t;for(let w of x.sw)sd-=ov(MX(ws,m),MN(we,t+DAY),w.s,w.e),m=MX(m,w.e)}else if(!row||row.coverage==='none')u.push(y);else{fs??=t;lz=t;pp+=row.coverage==='partial'}}
return{f:win>0?MN(1,sd/win):0,r,a,b,d,u,l,fs,lz,pp,k:d-u.length-l,ny:x.lastScan===null?win:MX(0,we-MX(ws,x.lastScan)),bf:MX(0,MN(we,x.covStart)-ws)}},
wf=now=>{let P=PERIODS.find(p=>p[0]===S.period)||PERIODS[1],cu=S.period==='custom';let s,e,atLatest;
if(cu){s=ds(S.from);e=MN(ds(S.to)+DAY,now);atLatest=ds(S.to)+DAY>=now}else{e=S.end===null?now:MN(S.end,now);atLatest=S.end===null;s=P[2]<0?mm(e,-P[2]):e-P[2]}
return{s,e,atLatest,period:P[0],label:P[1],span:e-s,clamped:false,custom:cu}},
tg=(row,ws,we)=>!row||!row.count?[]:row.path?[row]
:(row.parts||[]).filter(p=>{let h=ds(row.date)+p.path.slice(-7,-5)*HOUR;return h<we&&h+HOUR>ws}).map(p=>({...p,sealed:row.sealed})),
sh=(t,date)=>{let u=AR+t.path,c=lg(u);if(c)return c.p;
let p=gj(u,t.sealed?'default':'no-cache',1).then(async b=>{let o=b.byteLength>=0?await new Response(b).json():b,s=(window.crypto||0).subtle;
if(!isFC(o)||o.schema!=='uk-lightning-history-day.v1'||!o.metadata||o.metadata.date_utc!==date)E('invalid day file');
let bad=[o.features.length!==t.count&&'count',b.byteLength!==t.bytes&&'bytes',s&&[...new Uint8Array(await s.digest('SHA-256',b))].map(x=>(x|256).toString(16).slice(1)).join('')!==t.sha256&&'sha256'].filter(Boolean);
if(bad.length)E('index mismatch: '+bad.join(', '));if(!s&&t.sha256)E('not verified (no WebCrypto)');return o.features}).catch(e=>{lru.delete(u);throw e});
ls(u,{p,sealed:!!t.sealed});return p},
fr=async(rows,ws,we,sn)=>{let jobs=[];for(let row of rows)for(let t of tg(row,ws,we))jobs.push({row,t});let parts=new Array(jobs.length),fl=[];let pos=0;
await Promise.all(Array.from({length:MN(4,jobs.length)},async()=>{while(pos<jobs.length&&sn===S.serial){let i=pos++,{row,t}=jobs[i];try{parts[i]=await sh(t,row.date)}catch(e){parts[i]=[];fl.push({date:row.date,error:msg(e),t})}}}));
return{parts,fl,rq:jobs.length}},
ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&(c=>AI(c)&&c.length<4&&bx(c[0],c[1]))(f.geometry.coordinates)&&f.properties&&FEED_SCHEMA.split('/')[1]===f.properties.observation_kind&&isFinite(tm(f))&&!(f.id&&typeof f.id=='object'),
co=(parts,ws,we)=>{let m=new Map();let k=0;for(let part of parts)for(let f of part){if(!ok(f)){k++;continue}let t=tm(f);if(t>=ws&&t<we)m.set(f.id==null?t+','+f.geometry.coordinates:JSON.stringify(f.id),f)}let a=[...m.values()].sort((a,b)=>tm(a)-tm(b));a.bad=k;return a},
gg=mo=>{if(!/^\d{4}-\d\d$/.test(mo))E('grid path');const u=AR+'grid/'+mo+'.json',h=lg(u);if(h)return h.p;
let p=gj(u,'no-cache',1).then(async b=>{let o=b.byteLength>2e6?E('grid size'):b.byteLength>=0?await new Response(b).json():b;if(!o||o.schema!==GS||o.month!==mo||o.cols!==140||o.rows!==120||o.cell_deg!==.1||!AI(o.days)||o.days.length>31||!AI(o.cells)||o.cells.length>16800)E('invalid grid '+mo);let t=[];
for(let r of o.cells){if(!AI(r)||r.length%2<1||r.length<3||r.length>63||r[0]>>>0!==r[0]||r[0]>=16800)E('grid cell');for(let i=1;i<r.length;i+=2){let d=r[i],n=r[i+1];if(d>>>0!==d||d<1||d>31||n>>>0!==n||!n)E('grid count');t[d]=(t[d]||0)+n}}
for(let d of o.days)if(!d||!AI(d.sha256)||(d.date+'').slice(0,8)!==mo+'-'||(t[+d.date.slice(8)]||0)!==(d.count||0))E('grid sum '+mo);return o}).catch(e=>{lru.delete(u);throw e});ls(u,{p});return p},
LM=()=>{if(!LM.a){let a=LM.a=new Uint8Array(16800);let p=0,v=1;for(const c of'M3bCjeCie83C7rC6sC6r4583Bmr1a28BmAg26BaAqB7AsB6AsB5AtB3AuB4AtB4AsB5AsAw81AqAvB0AvAzAxB0AwB1AvB3AuB3AuB8ArB6AtB4AvB0AwAzAuAyAwAzAxAyAyAxB0AvB0AuB1AmBaAmBbAkBe82A7Bh47A5BrA4Av4e5aA3Am71b7a6A3Alo4b4A4Ajr3c2A5Agv3c1A5Agw3AfAhz3AbAkA0161A3AnB9AoB5AsB1AxAyAzAwB1l2A8B2AtB9AnBbAkBdAiBdAjBcAjBdAiBfAgBiAdBnA6Bh44A5Bh81A6BgAgBgAhBgAhBiAgBjAdBib1A3B872AgB692AfB6ArB5AsB6ArBcAkBdAjB973AcB9b1A9BaA793BeA6BrA7BoAaBmf1vBnd5rBp9dlBs2hmCcmCghChfCghCfhCgfCidCl9Cr2L07ChhCdkCckCdjCehCkdCkdCkcClbClaCp4Tj'.match(/[A-Z]?./g))a.fill(v^=1,p,p+=c[1]?(c.charCodeAt(0)-64)*36+parseInt(c[1],36):parseInt(c,36))}return LM.a},
gd=async(rows,sn)=>{let er,n=0,st=0,k=0;let gs=new Map(await Promise.all([...new Set(rows.filter(y=>y.count>0).map(y=>y.date.slice(0,7)))].map(async m=>[m,await gg(m).catch(e=>(er=e,{days:[],cells:[]}))]))),ok=new Set,c=new Map,f=[],v=[];
for(let y of rows)if(y.count>0){let d=gs.get(y.date.slice(0,7)).days.find(d=>d.date===y.date);if(d&&d.count===y.count&&d.coverage===y.coverage&&d.sha256+''==(y.path?[y.sha256]:y.parts.map(p=>p.sha256))+'')ok.add(y.date),n+=y.count;else st++}if(!n)throw er||Error('grid stale');
for(let[m,g]of gs)for(let r of g.cells)for(let i=1;i<r.length;i+=2)if(ok.has(m+'-'+(r[i]+'').padStart(2,0)))c.set(r[0],(c.get(r[0])||0)+r[i+1]);
for(let[q,x]of c)if(LM()[q]){let lon=-11+(q%140+.5)/10,lat=49.5+((q/140|0)+.5)/10;k+=x;v.push(x);f.push({type:'Feature',properties:{cell:q,n:x,lon,lat,s:sn},geometry:{type:'Point',coordinates:[lon,lat]}})}
v.sort((a,b)=>a-b);return{fc:FC(f),n,k,st,e:er&&msg(er),T:MX(30,v[v.length*.95|0]||0)}},
ff=async(w,now,reason)=>{
let f=await(S.fp||(S.fp=gx(FEED).catch(e=>{S.fp=null;throw e})));if(!isFC(f))E('invalid live feed');
let ev=co([f.features],w.s,w.e);
return{mode:'feed',w,idx:null,ie:reason,meta:f.metadata||{},old:w.s<now-7*DAY,ev,fl:[],cs:'live feed',ic:ev.length,cl:ev.length>cap(),cov:null}},
lw=async(now,sn,q)=>{let w=wf(now);let x=null,ie=null;try{x=await li(q)}catch(e){ie=msg(e)}
if(!x)return ff(w,now,ie);
if(w.e<=x.cutoff)return{mode:'overview',w,idx:x,before:true,fl:[],ev:[],arch:0};
if(w.s<x.cutoff){w.s=x.cutoff;w.span=w.e-w.s;w.clamped=true}
let rows=[...x.by.values()].filter(y=>{let f=ds(y.date);return f<w.e&&f+DAY>w.s}),known=rows.filter(y=>y.count!==null),
r={mode:'overview',w,idx:x,before:false,rows,arch:known.reduce((n,y)=>n+(y.parts&&hz(w)?tg(y,w.s,w.e).reduce((a,p)=>a+p.count,0):y.count),0),cov:cv(x,w.s,w.e),fl:[],ev:[],ld:[],sk:[]};
let tf=rows.filter(y=>y.count>0),bytes=0,count=0,nq=0;
for(let row of tf)for(let t of tg(row,w.s,w.e)){nq++;count+=t.count||0;bytes+=t.bytes>0?t.bytes:(t.count||0)*530}
if(count>MN(BUDGET,cap())||bytes>32e6||nq>RQ){r.budget=`${N(count)} flashes, ${N(bytes)} bytes, ${N(nq)} files`;try{r.gd=await gd(rows,sn)}catch(e){r.ge=NA(msg(e))+': '+msg(e)}if(sn!==S.serial)return r;if(!S.consent){r.clp=true;return r}
let run=0,rb=0,rn=0;tf.sort((a,b)=>b.date.localeCompare(a.date));let keep=[];for(let y of tf){let ps=tg(y,w.s,w.e),c=ps.reduce((a,p)=>a+(p.count||0),0),b=ps.reduce((a,p)=>a+(p.bytes>0?p.bytes:(p.count||0)*530),0),q=ps.length;if(r.sk.length||run+c>BUDGET||rb+b>32e6||rn+q>RQ){r.sk.push(y.date);continue}keep.push(y);run+=c;rb+=b;rn+=q}if(!keep.length){r.clp=r.big=1;return r}tf=keep;count=run}
r.ld=tf.map(y=>y.date);r.ic=count;r.cs='index';r.cl=count>cap();
let got=await fr(tf,w.s,w.e,sn);for(let f of got.fl)if(/WebCrypto/.test(f.error))f.u=1;else if(!f.t.sealed&&/mismatch/.test(f.error)){if(!q){S.ip=null;return lw(now,sn,now)}f.error+='; archive updating, reload later';f.u=1}r.mode='detail';r.fl=got.fl;r.rq=got.rq;r.ev=co(got.parts,w.s,w.e);return r},
cf=(r,now)=>{let st;let rs=[];
if(r.fail){st='FAIL';rs.push(r.fail)}else if(r.before){st='BEFORE-ARCHIVE';rs.push('before archive start')}
else if(r.fl.some(f=>!f.u)){st='FAIL';rs.push(`${r.fl.length} of ${r.rq} day files failed`)}
else{let c=r.cov,f=c?c.f:0;if(r.mode==='feed'){st=r.ev.length?'PARTIAL':'UNKNOWN';rs.push('coverage unknown')}else if(!c||f<=0){st='UNKNOWN';rs.push('nothing searched')}
else if(f<1||c.ny>0||c.l||c.u.length||r.fl.length){st='PARTIAL';if(c.ny>0)rs.push('tail unknown');if(c.bf>0)rs.push('head unknown');if(c.u.length)rs.push(`${c.u.length} unscanned dates`);if(!rs.length)rs.push(r.fl.length?'unverified':'gaps in window')}
else if(r.mode!=='overview')st=r.sk.length?(rs.push('days not loaded'),'PARTIAL'):r.ev.length?'READY·DETAIL':'EMPTY-COVERED';else st=r.arch>0?r.gd?'READY·CELLS':'READY·SUMMARY':'EMPTY-COVERED'}
let g=r.idx?r.idx.gen:r.meta?DP(r.meta.query_end_utc):NaN,f=r.idx&&r.idx.lastScan||g;return{st,g,f,stale:!!(r.idx||r.meta)&&r.w.atLatest!==false&&stale(g,now,f),colour:COLOUR(st),rs}},
DN=r=>{let g=r.gd;return`map limited to ≤30 km of REPD sites, not a national density map: ${N(g.k)} in ${pl(g.fc.features.length,'0.1° cell')}; ${N(g.n-g.k)} counted, not drawn${g.st?` · ${pl(g.st,'day')} not yet mapped (unknown${g.e?'; '+g.e:''})`:''} · tap a cell for nearest substations`},
cp=(r,now,k)=>{let w=r.w,x=r.idx,v=r.cov,nz=` (${U})`,L={window:'',days:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER};
L.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(MX(w.s,w.e-1))} inclusive (${pl(Math.ceil(w.span/DAY),'day')}${w.atLatest?', to now':''})`:`Window  ${w.label} · ${dt(w.s)} → ${de(w.s,w.e)} UTC · ${w.atLatest?'latest':'earlier page'}`;
L.days=r.mode==='feed'?`${r.old?'Last 7 days only (live feed)':'Live 7-day feed'} · ${NA(r.ie)}${/404/.test(r.ie)?'':': '+r.ie} · ${r.old?'earlier days '+U:'hours searched unknown'}`:r.before?`Before the 1-year archive (from ${dm(x.cutoff)}): never searched${nz}`:!v?'':hz(w)?(v.f<=0?`None of the ${w.label} searched yet${nz}`:k&&/READY|EMPTY/.test(k.st)?`All ${w.label} searched (${dt(v.a)} → ${de(v.a,v.b)} UTC)`:`Searched ${du(v.f*w.span)} of ${w.label} (${dt(v.a)} → ${de(v.a,v.b)} UTC) · ${du(w.span*(1-v.f))} not searched${nz}`):!v.k?`None of the ${pl(v.d,'day')} searched yet${nz}`:`${v.k==v.d&&!v.pp?'All':v.k+' of'} ${pl(v.d,'day')} searched (${dm(v.fs)}${v.lz>v.fs?'–'+dm(v.lz):''}${v.pp?`, ${v.pp} in part`:''})${v.u.length?` · ${v.u.length} not yet searched`:''}${v.l?` · ${v.l} lost (integrity alert)`:''}${v.k<v.d?nz:''}`;
if(v&&v.bf>0&&v.f<=0&&x)L.days+=` · archive starts ${dm(x.covStart)}`;
if(w.clamped)L.window+=' · start clamped to retention start '+x.cutoffDate;
if(r.fail){L.warning=r.ie&&!x?`Archive unavailable: ${r.ie} — nothing shown (${U})`:r.fail;return L}
if(r.before){L.warning=`Window predates the archive (began ${T(x.covStart)}; retention from ${x.cutoffDate}) — ${U}`;return L}
r.out=0;try{let b=mh().getBounds();r.out=r.ev.filter(f=>!b.contains(f.geometry.coordinates)).length}catch(_){}
let n=r.ev.length,first=n?`Actual  first ${Ts(tm(r.ev[0]))} · last ${Ts(tm(r.ev[n-1]))}`:'',
drawn=(!n?'':` · ${N(n)} drawn as ${r.cl?'clusters':'points'} (cap ${N(cap())})`)+(r.ev&&r.ev.bad?` · ${N(r.ev.bad)} malformed records rejected`:'')+(r.out?` · ${N(r.out)} of ${N(n)} outside the current view`:'');
if(r.mode==='feed'){let m=r.meta,P=(k,f=T)=>f(DP(m[k]));
L.refresh=`Refresh live feed ${P('query_end_utc')} (last collection window ${P('query_start_utc')} → ${P('query_end_utc')}; latest detection ${P('latest_detection_utc',Ts)}; 7-day retention; ${NA(r.ie)}: ${r.ie}; earlier hours ${U})`;
L.searched='Searched EUMETSAT unknown (live feed records only its last collection window)';if(r.old)L.warning=NA(r.ie)+': earlier coverage '+U
L.actual=first||`Actual  none seen in the 7-day feed (${U})`;L.flashes=`Flashes ${F7(r)}${drawn}`}
else if(r.mode==='detail'){L.actual=r.fl.length?'Actual  unknown (day files failed)':first||'Actual  no archived flashes within this window';
L.flashes=(r.sk.length?`Flashes ${N(r.arch)} archived on the overlapping UTC dates (index, whole days) · ${N(n)} downloaded from the newest ${r.ld.length} of ${r.ld.length+r.sk.length} days (budget ${N(BUDGET)} flashes / 32 MB; ${r.sk.length} days not loaded)${drawn}`:`Flashes ${r.fl.length?`${N(r.ic)} in index · ${N(n)} loaded`:N(n)+' archived in window'}${drawn}`)+(r.gd?' · '+DN(r):'')}
else{let o=r.rows.filter(y=>y.first_observation_utc),k=r.rows.length;
L.actual=o.length?`Actual  on the ${k} overlapping UTC dates: first ${Ts(DP(o[0].first_observation_utc))} · last ${Ts(DP(o[o.length-1].last_observation_utc))} (whole UTC days)`:`Actual  no archived flashes on the ${k} overlapping UTC dates`;
L.flashes=`Flashes ${N(r.arch)} archived on ${k} overlapping UTC dates · ${r.gd?`${DN(r)}${r.clp&&!r.big?` · LOAD POINTS adds the newest ${N(MN(BUDGET,r.arch))} flashes`:''}`:`none drawn (summary mode; ${r.clp?`index sum ${r.budget} exceeds the budget; ${r.big?'newest day alone exceeds it; none drawn':`LOAD POINTS draws up to the newest ${N(BUDGET)}`}`:'points load automatically within the budget'})${r.ge?' · cell grid '+r.ge:''}`}`}
if(x)L.refresh=`Refresh archive ${T(x.gen)} (${AGO(now-x.gen)} ago; expected every ${x.iv} h)${stale(x.gen,now,x.lastScan||x.gen)?' · overdue':''}`;
let c=r.mode!=='feed'&&r.cov;if(c){let warn=[];
L.searched=c.f>0?`Searched EUMETSAT ${du(c.f*w.span)} of ${du(w.span)}${c.a!==null?` · ${T(c.a)} → ${T(c.b)}`:''}`:c.l?'Searched EUMETSAT: shard lost (integrity alert), '+U:'Searched EUMETSAT none of this window — no collection run covers it';
if(c.ny>0)warn.push(`Not yet searched: last ${AGO(c.ny)} of window (${U})`);
if(c.bf>0&&x&&!c.u.length)warn.push(`Unknown: ${ymd(w.s)} to ${ymd(MN(w.e,x.covStart)-1)} precede archive start ${T(x.covStart)} (not zero)`);
if(c.l)warn.push(`${c.l} days lost from the archive (integrity alert), ${U}`);if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);
if(r.fl.length)warn.push(`${r.fl.length} of ${r.rq} day files failed (${r.fl.map(f=>f.date+' '+f.error).join(', ')}); points incomplete, counts from index`);
let ub=(r.rows||[]).filter(y=>[y.first_observation_utc,y.last_observation_utc].some(t=>t!=null&&!isFinite(DP(t)))).length;if(ub)warn.push(`${N(ub)} archive entr${ub==1?'y':'ies'} unreadable (malformed timestamp; ${U})`);
if(c.f<1&&!warn.length)warn.push('Unknown: gaps between collection runs inside this window (not zero)');L.warning=warn.join(' · ')}
if(k&&/UNK|PAR/.test(k.st)&&/^Flashes 0 a/.test(L.flashes))L.flashes+=' (gaps unknown)'
if(v&&v.f<=0&&!v.l&&r.mode!=='feed'&&!r.fl.length){L.flashes='Flashes not yet searched'+nz;L.actual='Actual  not yet searched'}
return L},
mh=()=>{let m=window.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{try{for(let l of m.getStyle().layers||[]){let f=l.type==='symbol'&&l.layout&&l.layout['text-font'];if(AI(f)&&f.length&&typeof f[0]==='string')return f}}catch(_){}return['Open Sans Regular']},
HIT=SRC+'-hit',CEL=SRC+'-cell',CNT=LAYER+'-count',pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
cs=v=>(v+'').replace(/\p{Cf}/gu,'').slice(0,200),el=(t,css,s)=>{let e=document.createElement(t);if(css)e.style.cssText=css;if(s!=null)e.textContent=s;return e},
cpos=()=>{let c=S.pp,m=mh();if(!c||!m)return;let k=gr(m.getContainer()),q=Q('gridatlas-menu-bar'),t=MX(0,(q?gr(q).bottom:0)-k.top)+8,w=MN(480,k.width-16),sd=c.sd=k.height<500&&k.width-w>=300,L=sd?k.right-8-w:k.left+(k.width-w)/2,h=c.offsetHeight||0;c.style.marginRight=sd?'0':'auto';let b=8;
for(let o of[Q('gridatlas-dash-toggle'),document.querySelector('.map-controls')]){let r=o&&gr(o);if(r&&r.height&&r.right>L&&r.left<L+w&&r.top<k.bottom&&r.bottom>k.top)b=MX(b,k.bottom-r.top+8)}
if(b+h>k.height-t)b=8;c.bb=b;c.style.bottom=b+'px';c.style.maxHeight=MX(44,MN(k.height-t-b,MX(240,k.height-b-320)))+'px'},
cx=()=>{let m=mh();pc();if(m)try{for(let l of[CNT,HIT,LAYER])if(m.getLayer(l))m.removeLayer(l);if(m.getSource(SRC))m.removeSource(SRC);dd()}catch(e){note(e)}S.mode=null},
CS=SRC+'-cells',CL=[CEL+'-glow',CEL+'-core',CEL],RP=(m,a)=>{try{return m.getStyle().layers.filter(l=>(l.source=='src-repd'||l.id=='l-subs')&&(a||!/glow/.test(l.id)&&m.getLayoutProperty(l.id,'visibility')!='none')).map(l=>l.id)}catch(_){return[]}},
dd=g=>{let m=mh();if(!m)return;for(let l of CL)if(m.getLayer(l))m.removeLayer(l);if(m.getSource(CS))m.removeSource(CS);if(!g||!g.fc.features.length)return;
let b=RP(m,1).find(l=>l!='l-subs')||(m.getLayer(LAYER)?LAYER:void 0),L=['log10',['get','n']],I=(x,...s)=>['interpolate',['linear'],x,...s],B=[0,.48,1,1.48,2,2.48],R=v=>I(L,...B.flatMap((k,i)=>[k,v[i]])),Z=(a,c,d)=>I(['zoom'],5,a,7,c,10,d),
C=R(['#5a5590','#6f68a8','#8d7fd0','#a066ff','#c23cff','#e01cff']),A=(i,p,x)=>m.addLayer({id:CL[i],type:'circle',source:CS,...x,paint:p},b);m.addSource(CS,{type:'geojson',data:g.fc});
A(0,{'circle-radius':Z(I(L,1.48,5,2.48,13),I(L,1.48,8,2.48,20),I(L,1.48,16,2.48,36)),'circle-color':C,'circle-opacity':I(L,1.48,.15,2.48,.4),'circle-blur':1},{filter:['>=',['get','n'],g.T]});
A(1,{'circle-radius':Z(R([.8,1,1.2,1.7,3.2,6]),R([1,1.2,1.6,2.4,5,9]),R([2,2.5,3.5,6,12,20])),'circle-color':C,'circle-opacity':R([.22,.3,.42,.6,.85,.95]),'circle-stroke-width':I(L,1.48,0,2,.6),'circle-stroke-color':'#140a2a'},{layout:{'circle-sort-key':['get','n']}});
A(2,{'circle-radius':22,'circle-opacity':0})},
dw=(fc,cl)=>{let m=mh(),K={'circle-stroke-width':1.5,'circle-stroke-color':'#1a1a1a'},Z=k=>['interpolate',['linear'],['zoom'],5,k(6),8,k(8),11,k(10)];if(!m)E('no map');let mode=cl?'cluster':'raw';if(S.mode&&S.mode!==mode)cx();
if(!m.getSource(SRC)){m.addSource(SRC,Object.assign({type:'geojson',data:FC()},cl?{cluster:true,clusterRadius:40,clusterMaxZoom:10}:{}));
m.addLayer({id:LAYER,type:'circle',source:SRC,layout:{visibility:'none'},paint:cl?{'circle-radius':Z(x=>['case',['has','point_count'],['step',['get','point_count'],12,100,16,1000,20,10000,26],x]),...K,'circle-color':['case',['has','point_count'],'#ffb000','#fff3a0'],'circle-opacity':0.9}
:{'circle-radius':Z(x=>x),...K,'circle-color':'#fff3a0','circle-opacity':0.95}});
m.addLayer({id:HIT,type:'circle',source:SRC,layout:{visibility:'none'},paint:{'circle-radius':22,'circle-opacity':0}});
if(cl)try{m.addLayer({id:CNT,type:'symbol',source:SRC,filter:['has','point_count'],layout:{visibility:'none','text-field':['get','point_count_abbreviated'],'text-font':sf(m),'text-size':11},paint:{'text-color':'#000'}})}catch(e){note('count labels: '+msg(e))}S.mode=mode}
m.getSource(SRC).setData(fc);let v=fc.features.length?'visible':'none';for(let l of[LAYER,HIT,CNT])if(m.getLayer(l))m.setLayoutProperty(l,'visibility',v)},
tap=e=>{let m=mh();if(!S.on||S.busy||!m||!(m.getLayer(HIT)||m.getLayer(CEL)))return;let px=e.point.x??e.point[0],py=e.point.y??e.point[1],Y=l=>m.getLayer(l)?m.queryRenderedFeatures(e.point,{layers:[l]}):[];let f=null,dm=Infinity;
for(let q of Y(HIT)){let g=q.properties&&!q.properties.cluster&&S.res&&S.res.ev[q.properties.i],a=m.project((g||q).geometry.coordinates),d=(a.x-px)**2+(a.y-py)**2;if(d<dm){dm=d;f=q}}pc();if(!f){let rp=RP(m),h=rp.length&&m.queryRenderedFeatures(e.point,{layers:rp});if(h&&h.length){for(let q of h)S.ly&&S.ly.delete(q.properties&&q.properties.tech);return Ry()}for(let q of Y(CEL)){let p=q.properties||{},k=cb(p),a=k&&m.project([p.lon,p.lat]),d=k?(a.x-px)**2+(a.y-py)**2:1/0;if(d<dm){dm=d;f=p}}return f?cc(m,f):Ry()}
let p=f.properties||{};if(p.cluster){let go=z=>(cm(m),m.easeTo({center:f.geometry.coordinates,zoom:z})),z=m.getSource(SRC).getClusterExpansionZoom(p.cluster_id,(err,z)=>err||go(z));if(z&&z.then)z.then(go,note);return}
let g=S.res&&p.s===S.res.s&&S.res.ev[p.i];if(!g)return;let[x,y]=g.geometry.coordinates,id=g.id==null?'(none)':cs(g.id);
cd(m,x,y,'Lightning flash','Flash '+Ts(tm(g)),`lat ${y.toFixed(3)}, lon ${x.toFixed(3)} · ID ${sid(id)}`,'Flash ID '+id,'optical flash')},
cd=(m,x,y,lb,ti,su,de,wh,o={})=>{let c=el('div','position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;background:#000;color:#e8f4f5;border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25);font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain'),
bar=el('div','display:flex;align-items:center;gap:6px;padding-left:8px;background:#0a1a1d;border-bottom:1px solid #1d3238'),bd=el('div','padding:0 8px 6px'),d=el('details'),rf=()=>{cpos();if(S.pp===c)ck(1)},
B=(t,a,f)=>{let e=el('button','flex:none;width:44px;height:44px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:14px/1 monospace;cursor:pointer',t);e.type='button';e.setAttribute('aria-label',a);e.addEventListener('click',f);ap(bar,e);return e};
c.dataset.lightningCard='';c.setAttribute('role','dialog');c.setAttribute('aria-label',lb);c.wh=wh;c.o=o;c.re=open=>cd(m,x,y,lb,ti,su,de,wh,{...o,open});
ap(bar,el('span','flex:1;min-width:0;color:#5fbdc2;font-weight:bold',ti));
let mn=B('−','Minimise',()=>{let o=bd.style.display=='none';bd.style.display=o?'':'none';mn.textContent=o?'−':'+';mn.setAttribute('aria-expanded',o);rf()});d.addEventListener('toggle',rf);mn.setAttribute('aria-expanded',true);B('×','Close',()=>{pc();Ry()});
c.sm=el('summary','padding:14px 0 13px;line-height:17px;cursor:pointer;color:#bfe9ee',su);ap(d,c.sm);
ap(d,el('div','color:#8b9aa1;font-size:11px;overflow-wrap:anywhere',de));c.out=el('div','margin-top:4px;color:#9fb3ba');ap(d,c.out);if(o.back){let k=ap(bd,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer',o.back[0]));k.type='button';k.dataset.lightningBack='';k.setAttribute('aria-label',o.back[0].slice(2));k.addEventListener('click',o.back[1])}ap(bd,d);if(o.open)d.open=true;
ap(bd,el('div','color:#8b9aa1;font-size:11px',o.foot||'EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.'));
ap(c,bar);ap(c,bd);c.lv=ap(c,el('div','position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)'));c.lv.setAttribute('role','status');S.pp=c;ap(m.getContainer(),c);cpos();nf(m,c,x,y,15)},
cb=p=>{let c=p.cell,w=-11+c%140/10,s=49.5+(c-c%140)/1400;return c>>>0===c&&c<16800&&Number.isSafeInteger(p.n)&&p.n>0&&p.lon>w&&p.lon<w+.1&&p.lat>s&&p.lat<s+.1&&S.res&&(p.s==null||p.s===S.res.s)?[w,s]:null},
cc=(m,p)=>{let[w,s]=cb(p),W=S.res.w,r=a=>a.toFixed(2)+'–'+(a+.1).toFixed(2),x=11.156*Math.cos(p.lat*Math.PI/180);cd(m,p.lon,p.lat,'Lightning cell',pl(p.n,'optical flash','es')+' in this 0.1° cell',`${ymd(W.s)} to ${ymd(MX(W.s,W.e-1))} UTC · centre lat ${p.lat.toFixed(3)}, lon ${p.lon.toFixed(3)}`,`Cell lat ${r(s)}, lon ${r(w)}: 0.1°, ≈${x.toFixed(1)} km E–W × 11.1 km N–S, ≈${x*11.13+.5|0} km² here; the centre is not a flash location · searched UTC days only; unsearched days ${U}`,'cell centre')},
sid=s=>{let r=/_\d{8}(\d\d)(\d\d)\d\d_\d{8}(\d\d)(\d\d)\d\d_N_.*:(\d+)$/.exec(s);return r?`${r[1]}:${r[2]}–${r[3]}:${r[4]} #${r[5]}`:s.length>24?s.slice(0,12)+'…'+s.slice(-8):s},
NP='gridatlas-lightning-neon',NI=['glow','core','flow','flow-b','node-ring','node','label','pin-halo','pin','p-core','p-node','p-label'].map(s=>NP+'-'+s),NSR=[NP+'-links',NP+'-nodes',NP+'-pin',NP+'-plinks',NP+'-pnodes'],
nc=()=>{let m=mh();if(S.raf){cancelAnimationFrame(S.raf);S.raf=null}if(m)try{for(let l of[...NI].reverse())if(m.getLayer(l))m.removeLayer(l);for(let s of NSR)if(m.getSource(s))m.removeSource(s)}catch(e){note(e)}},
nr=(m,c,x,y)=>{let L=window.__GRIDATLAS_NEON_LINKS__||{},M=L.measure||{},subs=Object.hasOwn(L,'substations')?L.substations:null,say=s=>ap(c.out,el('div','',s));c.out.textContent='';nc();
if(!AI(subs)||!subs.length||typeof M.nearestSubstations!=='function')return say('Substation data not loaded yet; trying again.'),0;
let k=c.k=M.nearestSubstations(x,y,subs),o=[x,y],TC='#d8c96a',TL='#5fbdc2',FL='#bfe9ee',Z=(a,b,h=12)=>['interpolate',['linear'],['zoom'],6,a,h,b],RJ={'line-cap':'round','line-join':'round'},
A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{}));S.fk=[o,...k.map(a=>a.at)];say(c.o.np?'Screening · nearest substations, straight line. Not its declared connection or capacity.':`Screening · nearest substations to this ${c.wh}, straight line. Proximity, not exposure or a current path; not evidence any asset was struck.`);
if(!k.length){let b=k.beyondRadiusNearest;say(`No substation within ${k.radiusKm||40} km`+(b?` (nearest: ${cs(b.name||'unnamed substation')}, ${(+b.km).toFixed(2)} km)`:''))}
for(let a of k)say(`${(+a.km).toFixed(2)} km · ${a.kv[0]} kV · ${cs(a.name||'unnamed substation')}`);
if(!c.o.np)Rp(m,c,x,y,M);if(!k.length)return k;
m.addSource(NSR[0],{type:'geojson',data:FC(k.map((a,i)=>({type:'Feature',properties:{colour:TC,strength:MX(.2,.62-i*.1)},geometry:{type:'LineString',coordinates:[o,a.at]}})))});
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
if(rm){m.setPaintProperty(NI[2],'line-opacity',0);m.setPaintProperty(NI[3],'line-opacity',0)}else if(typeof requestAnimationFrame=='function'){let ph=0;let fd=typeof M.flowDash=='function'?M.flowDash:p=>{let s=Math.floor(p/1.5*24)%24/24*1.5;return[.001,MX(.001,s),.42,MX(.001,1.5-s)]},mo={},
set=(i,p)=>{let d=fd(p),j=d.join();if(mo[i]!==j){mo[i]=j;m.setPaintProperty(NI[i],'line-dasharray',d)}},st=()=>{ph=(ph+.055)%1.5;try{set(2,ph);set(3,(ph+.75)%1.5)}catch(_){S.raf=null;return}S.raf=requestAnimationFrame(st)};S.raf=requestAnimationFrame(st)}
return k},
nf=(m,c,x,y,n)=>{if(S.pp!==c)return;let k;try{k=nr(m,c,x,y)}catch(e){note('nearest: '+msg(e));nc();c.out.textContent='Substation data unavailable.';return cpos()}cpos();
if(AI(k)){c.sm.textContent+=k.length?` · ${k.length} nearest substations`:` · no substation within ${k.radiusKm||40} km`;if(k.length||c.o.np)nz(m,x,y);return}if(n)setTimeout(()=>nf(m,c,x,y,n-1),2e3)},
cw=()=>Promise.resolve().then(()=>{let m=mh();m&&!(m.isMoving&&m.isMoving())&&ck()}),cm=m=>m.off&&m.off('moveend',cw),
nz=(m,x,y)=>{try{cm(m);m.flyTo({center:[x,y],zoom:12,duration:1200,essential:true});typeof m.once=='function'?m.once('moveend',cw):ck()}catch(e){note('camera: '+msg(e))}},
ck=f=>{try{let m=mh(),c=S.pp,k=S.fk,C=m&&m.getContainer(),H=C&&C.clientHeight||1e4,d=c&&c.sd,B=d?100:c&&(c.bb+c.offsetHeight||196)+24,R=d?c.offsetWidth+32:40,T=d?60:150;if(!c||!k||f!==1&&k.every(a=>{let p=m.project(a);return p.x>=20&&p.x<=(C.clientWidth||1e4)-R+20&&p.y>=T-20&&p.y<=H-B}))return;let[w,s]=k[0],[e,n]=k[0];for(let[a,o]of k){w=MN(w,a);e=MX(e,a);s=MN(s,o);n=MX(n,o)}
cm(m);m.fitBounds([[w,s],[e,n]],{padding:{top:T,left:40,right:R,bottom:d?B:H-150>B?B:MX(0,H-270)},maxZoom:12,duration:900})}catch(e){note('camera: '+msg(e))}},
/* ---- M3: the REPD map layers of the listed projects ---------------------------------------------------------------
   The owner (28 Oct 2026, 21:39 UTC): "auto activate the REPD layers of the targeted 10 nearest projects". Each register
   tech is the id of the original's own REPD layer (solar, solar_roof, wind, bess, biomass, …; engine config "REPD (GeoJSON)").
   A layer is switched exactly as a tap on its Layers checkbox would: the original #scada-ui-container input is ticked and
   a bubbling "change" is dispatched, so the engine's own delegated listener syncs the fullscreen-curtain copy and runs
   its handleLayerToggle (visibility + hydration), and the menu bar's document listener syncs its proxy. S.ly holds only
   the layers M3 itself switched on; a layer the user already had on is never touched, and a layer the user ticks or
   unticks while M3 holds it becomes the user's (bt below). */
RL='solar solar_roof wind bess biomass tidal hydrogen hydro flywheel act geothermal caes'.split(' '),
Ly=(id,on)=>{let h=Q('scada-ui-container'),b=h&&h.querySelector(`input[data-layer-id="${id}"]`);if(!b||b.disabled||!!b.checked===on)return 0;
  S.lyx=1;try{b.checked=on;b.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){note('REPD layer '+id+': '+msg(e))}finally{S.lyx=0}return 1},
// switch on the layers `need` names that are off, and off every layer M3 switched on that `need` no longer names
Ry=(need=[])=>{let o=S.ly||(S.ly=new Set);for(let id of[...o])if(!need.includes(id)){o.delete(id);Ly(id,false)}
  for(let id of need)if(RL.includes(id)&&!o.has(id)&&Ly(id,true))o.add(id)},
RU='https://ventusltd.github.io/gridatlas/data/repd_projects_202608290716.parquet',RM='https://ventusltd.github.io/gridatlas/data/repd_v9_manifest_202608290716.json',RpE=1.000001e-6,RpP=new WeakMap,
RpQ=async pts=>{let C=S.rc||(S.rc=new Map),ks=RpU(pts.filter(a=>a&&a[0]===+a[0]&&a[1]===+a[1]&&!C.has(a+'')),a=>a+''),t,k;
  if(ks.length){let w=window.__GRIDATLAS_DUCKDB_RUNTIME__,R=p=>Promise.race([p,new Promise((_,j)=>t=setTimeout(()=>j(new Error(TOE)),TMO))]).finally(()=>clearTimeout(t));
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
  if(e)L('REPD record unavailable: '+msg(e)+'. Tap again to retry.');else if(o===void 0)L('REPD record: loading…');else if(!o)L('Record · address not in register (no exact REPD match; no ref shown)');
  else{L([o.repd_address_display||'address not stated',o.repd_postcode||'no postcode',o.county,o.region].filter(Boolean).join(' · '),'color:#c9d6da');
    L(`Record · REPD ${o.repd_ref} · ${o.status}`+(o.status!=q.status?` (map register: ${q.status})`:''));
    L('Operator: '+(o.applicant_publication_state=='REPD_AS_PUBLISHED'&&o.repd_operator_or_applicant||'not shown (may name a person) or not stated'));
    L([o.planning_authority||'planning authority not stated',o.planning_application_reference,o.source_record_updated&&'record updated '+o.source_record_updated].filter(Boolean).join(' · '))}
  return b},
RpX=NS.repdRecords||(NS.repdRecords=Object.freeze({source:RU,manifest:RM,records:RpQ,join:RpJ,block:RpB})),
// fill record slots [[div, props]] now from the cache, then again when the rows at their points have arrived
RpH=(c,sl)=>{let F=(C,e)=>{if(S.pp==c)for(let[s,q]of sl){s.textContent='';ap(s,RpB(q,RpP.get(q),C,e))}};F(S.rc);RpQ(sl.map(v=>RpP.get(v[1]))).then(F,e=>F(0,e))},
// Area summary (Screening): every row within 40 km, all statuses and technologies, by technology and by status class
RpY=(c,box)=>{let h=ap(box,el('div','margin-top:8px;color:#5fbdc2','Area summary · Screening · straight line; all statuses and technologies')),g=ap(box,el('div','display:grid;grid-template-columns:auto auto auto;gap:2px 10px;font-size:11px;color:#c9d6da')),C=s=>ap(g,el('span','',s)),u=0,V=new Map;
  h.dataset.tier=g.dataset.tier='screening';['','≤10 km','≤40 km'].map(C);
  for(let[v,n]of[...RpF.te,...RpF.st])if(v!='all'){let K=d=>{let r=c.rpAll.filter(q=>q.km<=d&&(RpT(q.p.tech)==v||RpS(q.p.status)==v)),w=RpW(r.map(q=>q.p)),z=r.some(q=>!(q.p.capacity>0));u|=z;return r.length+(w>0?' · '+N(w)+' MW':'')+(z?'*':'')},a=K(40);if(a!='0'){C(n);C(K(10));C(a)}}
  for(let s of c.k||[])V.has(s.kv[0])||V.set(s.kv[0],s);
  if(V.size)ap(box,el('div','margin-top:4px;color:#c9d6da;font-size:11px','Nearest per voltage, of the substations above: '+[...V].sort((a,b)=>b[0]-a[0]).map(([v,s])=>`${v} kV ${(+s.km).toFixed(2)} km`).join(' · ')));
  ap(box,el('div','color:#8b9aa1;font-size:11px',(u?'* some capacities not stated: unknown, not zero. ':'')+'Counts and distances only: not capacity, connection feasibility or exposure.'))},
/* ---- REPD projects near a tap (M2, M3) --------------------------------------------------------------------------------
   The register the map already holds (the engine's src-repd data when a REPD layer has loaded it, else the engine URL
   /dist/repd_master.json through the untouched bridge): REPD, DESNZ, April 2026 (Q1) extract, OGL v3.0. Measured by
   straight-line distance from the flash or the cell centre with the original link.measure.distanceKm. Nearest by distance
   only: never a claim that a project was struck or affected. */
RG=(m,M)=>S.rg||(S.rg=(async()=>{
  let f;try{f=m.getSource('src-repd').serialize().data.features}catch(_){}
  // gj: the module's fetch helper (15 s timeout that also covers the body, redirect refusal, "HTTP n")
  if(!(f&&f.length))f=(await gj('/dist/repd_master.json')).features;
  // a malformed row is skipped, never the whole register; numeric coordinates only; the search registry's Scilly
  // placeholder point is dropped should a register ever carry it (0 rows today)
  let o=f.map(x=>{try{let a=M.representativePoint(x.geometry);if(a[0]===+a[0]&&a[1]===+a[1]&&!(a[0]==-7.55716&&a[1]==49.766807))return[a,x.properties||{}]}catch(_){}return[]}).filter(([a,p])=>a&&M.isProjectTech(p.tech));
  return o.length?o:E('register empty')})().catch(e=>{S.rg=null;throw e})),
// filter chips: status classes (operational | under or awaiting construction | application submitted) and technology
RpF={st:[['all','All'],['op','Operational'],['cc','Consented'],['pl','Planning']],
  te:[['all','All'],['solar','Solar'],['wind','Wind'],['bess','BESS'],['other','Other']]},
// an explicit table: a status the pinned register does not carry (refused, withdrawn, decommissioned…) is in no class
RpS=s=>({operational:'op','under construction':'cc','awaiting construction':'cc','application submitted':'pl'})[String(s||'').toLowerCase()]||'?',
RpT=t=>/^solar/.test(t)?'solar':/^wind/.test(t)?'wind':/^bess/.test(t)?'bess':'other',
RpN=p=>({solar:'Solar',solar_roof:'Rooftop solar'})[p.tech]||cs(p.raw_tech),
// stated capacity of the parts at one point; repeated records of one scheme (same name, technology and capacity; only
// status or operator differ) count once. A capacity of 0 means "not stated".
RpW=ps=>RpU(ps,p=>p.name+'|'+p.raw_tech+'|'+(p.capacity>0?+p.capacity:0)).reduce((s,k)=>s+ +k.split('|').pop(),0),
RpMW=v=>v>0?` ${N(v)} MW`:'',
RpC=ps=>RpW(ps)>0?'':' · capacity not stated',
RpU=(ps,f)=>[...new Set(ps.map(f))],
// one label per site: projects at one point (e.g. solar + battery) share one link, one node and one label
RpG=g=>`${g.km.toFixed(2)} km · ${RpU(g.parts,RpN).sort().join(' + ')}${RpMW(RpW(g.parts))}`,
// the card's polite status region (outside the closed <details>): one 99 ms delay keeps the messages in order
Ra=(c,s)=>setTimeout(()=>{if(c.lv)c.lv.textContent=s},99),
Rp=(m,c,x,y,M)=>{
  let pd=ap(c.out,el('div','','REPD projects: loading…')),box=ap(c.out,el('div'));Ra(c,pd.textContent);
  RG(m,M).then(G=>{
    if(S.pp!==c||!c.out.contains(pd))return;
    // every register row is measured once; exact duplicate rows (same point, same properties) count once
    let all=[],seen=new Set;
    for(let[a,p]of G){let km=M.distanceKm(x,y,...a);if(km<=40){let k=a+JSON.stringify(p);if(!seen.has(k)){seen.add(k);RpP.set(p,a);all.push({a,p,km})}}}
    c.rpAll=all;c.fk0=S.fk.slice();c.smb=c.sm.textContent;RpR(m,c,pd,box)
  }).catch(e=>{
    if(S.pp!==c)return;Ry();S.rgf=(S.rgf||0)+1;
    // the bridge keeps a failed DuckDB/manifest start for the page lifetime, so a retry can fail at once: say so
    pd.textContent=`REPD projects unavailable: ${msg(e)}. `+(S.rgf>1?'Switch on a REPD layer or reload the page, then tap again.':`Tap the ${c.wh=='cell centre'?'cell':'flash'} again to retry.`);
    c.sm.textContent+=' · REPD unavailable';Ra(c,pd.textContent)})},
RpR=(m,c,pd,box)=>{
  let f=S.rf||(S.rf={st:'all',te:'all'}),o=c.fk0[0],
    sel=c.rpAll.filter(r=>(f.st==='all'||RpS(r.p.status)===f.st)&&(f.te==='all'||RpT(r.p.tech)===f.te)),groups=new Map;
  // one site per registered point: a row within about 10 m (2e-4° lon, 1e-4° lat) of a nearer row joins its site
  for(let r of[...sel].sort((a,b)=>a.km-b.km)){let g=[...groups.values()].find(g=>Math.abs(g.a[0]-r.a[0])<2e-4&&Math.abs(g.a[1]-r.a[1])<1e-4);if(!g)groups.set(r.a.join(),g={a:r.a,km:r.km,parts:[]});g.parts.push(r.p)}
  // the nearest 10 sites within the filter, plus any site at exactly the 10th site's distance
  let P=[...groups.values()].sort((a,b)=>a.km-b.km).filter((g,i,a)=>i<10||g.km==a[9].km),parts=P.reduce((s,g)=>s+g.parts.length,0),
    nm=v=>(RpF.st.find(q=>q[0]===v)||RpF.te.find(q=>q[0]===v))[1],all=f.st==='all'&&f.te==='all',
    fa=all?'all statuses':[f.st,f.te].filter(v=>v!=='all').map(nm).join(' · '),
    n10=sel.filter(r=>r.km<=10),nc10=n10.filter(r=>!(r.p.capacity>0)).length,W=[...groups.values()].reduce((s,g)=>s+(g.km<=10?RpW(g.parts):0),0);
  pd.textContent=`Screening · ${P.length?pl(P.length,'nearest REPD site')+(parts>P.length?` (${N(parts)} projects; those at one point grouped)`:''):'No REPD site'} within 40 km of this ${c.wh}, straight line${all?'':` (${fa})`}. Proximity only, not impact; not evidence any project was struck.`;
  box.textContent='';
  // unknown is not zero: a project without a stated capacity is never summed as 0 MW
  if(sel.length)ap(box,el('div','margin-top:4px;color:#ffc48a',`Within 10 km: ${pl(n10.length,'project')}${n10.length?' · '+(W>0?`${N(W)} MW stated, ${all?'mixed statuses':fa}`+(nc10?`, ${N(nc10)} not stated`:''):'capacity not stated'):''} · within 40 km: ${pl(sel.length,'project')}`));RpY(c,box);
  let ol=P.length&&P.length<10?ap(box,el('div','',`Only ${pl(P.length,'site')} within the 40 km search radius${all?'':' for this filter'}.`)).textContent:'';
  for(let[k,defs,lb]of[['st',RpF.st,'Status'],['te',RpF.te,'Tech']]){
    let row=ap(box,el('div','display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0 2px'));row.setAttribute('role','group');row.setAttribute('aria-label','REPD '+lb.toLowerCase()+' filter');
    ap(row,el('span','color:#8b9aa1;font-size:11px;min-width:40px',lb));
    for(let[v,t]of defs){let on=f[k]===v,b=ap(row,el('button',`min-height:44px;padding:0 10px;background:${on?'#2f6f75':'#050a0d'};border:1px solid #2f6f75;border-radius:3px;color:${on?'#e8f4f5':'#5fbdc2'};font:11px/1 monospace;cursor:pointer`,t));
      // a press re-renders the chips: focus returns to the chip just pressed
      b.type='button';b.dataset.lightningRepdFilter=k+':'+v;b.setAttribute('aria-pressed',on);b.addEventListener('click',()=>{if(f[k]!==v&&S.pp===c){f[k]=v;RpR(m,c,pd,box);box.querySelector(`[data-lightning-repd-filter="${k}:${v}"]`)?.focus?.()}})}}
  let sl=[];for(let g of P){
    let p=g.parts[0],one=g.parts.length===1,
      b=ap(box,el('a','display:block;padding:14px 0 13px;border-top:1px solid #1d3238;color:#ffb27a',`${RpG(g)}${RpC(g.parts)} · ${one?cs(p.status)+' · '+cs(p.name):g.parts.length+' projects at this point:'}`));
    // the href keeps the original coordinate deep link (open in a new tab); a plain tap stays in this page
    b.href=location.pathname+'?'+new URLSearchParams({longitude:g.a[0],latitude:g.a[1],technology:p.tech,project:p.name,capacity_mw:p.capacity,status:p.status});
    b.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.button)return;if(e.preventDefault)e.preventDefault();RpV(m,c,g)});
    for(let q of g.parts){one||ap(box,el('div','padding:0 0 2px 12px;color:#c9a27e;font-size:11px',`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`));sl.push([ap(box,el('div')),q])}}
  ap(box,el('div','margin-top:6px;color:#8b9aa1;font-size:11px','Record · REPD (DESNZ, OGL v3.0): the map register is the Apr 2026 extract; address, ref, operator and planning fields are from the Jul 2026 extract the map\'s project search reads, shown only on an exact point, name, MW and type match. Status as registered, not as built.')).dataset.tier='record';RpH(c,sl);
  c.sm.textContent=c.smb+' · '+(P.length?pl(P.length,'nearest REPD site'):'no REPD site within 40 km')+(all?'':` (${fa})`);Ra(c,pd.textContent+' '+ol);
  // M3: the original REPD layers of the listed technologies (within the filter) are on while this list is shown
  let lt=RpU(P.flatMap(g=>g.parts),q=>q.tech).filter(t=>RL.includes(t)),h=Q('scada-ui-container');Ry(lt);lt=lt.filter(t=>{let b=h&&h.querySelector(`input[data-layer-id="${t}"]`);return b&&b.checked});
  if(lt.length)ap(box,el('div','margin-top:6px;color:#8b9aa1;font-size:11px',`REPD map layers on for this list: ${lt.map(t=>{let q=Q('lbl-'+t);return q&&q.getAttribute('data-base-label')||t}).join(', ')}${S.ly.size?' (those switched on here go off when this card closes)':''}`));
  let C=['interpolate',['linear'],['get','mw'],0,'#ffaa00',50,'#ff4400',200,'#f00'],Z=(a,b)=>['interpolate',['linear'],['zoom'],6,a,12,b],
    F=geo=>FC(P.map(g=>({type:'Feature',properties:{mw:RpW(g.parts),label:RpG(g)},geometry:geo(g)}))),
    A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{})),
    ln=F(g=>({type:'LineString',coordinates:[o,g.a]})),nd=F(g=>({type:'Point',coordinates:g.a}));
  // a map error while drawing is noted (not shown as a register failure); a half-built set is rebuilt on the next render
  try{if(m.getLayer(NI[10])){m.getSource(NSR[3]).setData(ln);m.getSource(NSR[4]).setData(nd)}
  else{for(let l of NI.slice(9))m.getLayer(l)&&m.removeLayer(l);for(let q of NSR.slice(3))m.getSource(q)&&m.removeSource(q);
    m.addSource(NSR[3],{type:'geojson',data:ln});m.addSource(NSR[4],{type:'geojson',data:nd});
    A(9,'line',NSR[3],{'line-color':C,'line-width':Z(1,2),'line-opacity':.8,'line-dasharray':[2,2]});A(10,'circle',NSR[4],{'circle-radius':Z(3,5),'circle-color':C,'circle-stroke-width':1});
    try{A(11,'symbol',NSR[4],{'text-color':'#ffc48a','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-font':sf(m)})}catch(e){note('neon labels: '+msg(e))}}}catch(e){note('project lines: '+msg(e))}
  // frame origin, substations and the listed sites; a register that lands mid-move is framed when that move ends
  cpos();S.fk=[...c.fk0,...P.map(g=>g.a)];m.isMoving&&m.isMoving()?(cm(m),m.once('moveend',cw)):ck()},
// a row tap stays in this page: fly to the site and draw the original engine's nearest-substation links from it
// (link.measure.nearestSubstations, as for a flash); "◀ back" restores the lightning card as at its tap (collapsed, so the
// camera can frame it), its links and the filter. Both cards arrive collapsed so the neon links stay visible. Focus moves to
// "◀ back" on the project card, and to the restored card's summary after back. The REPD layers M3 switched on stay on.
RpV=(m,c,g)=>{
  let back=c.re,src=c.wh==='cell centre'?'cell':'flash',[x,y]=g.a,ps=g.parts;
  pc();
  cd(m,x,y,'REPD project',`REPD · ${RpU(ps,RpN).sort().join(' + ')}${RpMW(RpW(ps))}`,
    ps.length>1?`${ps.length} projects at this point · ${RpU(ps,q=>cs(q.name)).join(' / ')}`:`${cs(ps[0].name)} · ${cs(ps[0].status)}`,
    ps.map(q=>`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`).join('; ')+` · lat ${y.toFixed(3)}, lon ${x.toFixed(3)} · ${g.km.toFixed(2)} km from the ${c.wh} (straight-line)`,
    'project',{np:1,foot:'Record · REPD (DESNZ, Apr 2026, OGL v3.0). Status as registered, not as built. Lightning: optical flashes, not ground strikes; not evidence the project was struck.',
      back:['◀ back to lightning '+src,()=>{pc();back();S.pp&&S.pp.sm.focus?.()}]});
  let o=S.pp.out;RpH(S.pp,ps.map(q=>[o.parentNode.insertBefore(el('div'),o),q]));S.pp.querySelector('[data-lightning-back]')?.focus?.()},
BTN=(a,t,x)=>`<button type="button" class="map-ctrl-btn" ${a}${x||''}>${t}</button>`,NAV=(k,t,x)=>BTN(`data-lightning-nav="${k}"`,t,x),ROW='style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0"',
DATE=k=>`<input type="date" class="search-input" data-lightning-date="${k}" aria-label="${k} date (UTC)" style="width:9.5em;color-scheme:dark">`,
bg=key=>{let g=document.createElement('div');g.className='key-group';g.style.gridColumn='1/-1';g.dataset.lightningGroup=key;
g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-lightning-control="toggle"> <span data-lightning-label="${key}" style="color:#ffdf44">${BASE} [WAIT]</span></label>`
+`<div data-lightning-controls="${key}" hidden><div role="group" ${ROW}>${PERIODS.map(p=>BTN(`data-lightning-period="${p[0]}"`,p[0].toUpperCase())).join('')}</div>`
+`<div class="radius-input-row" data-lightning-custom style="display:none;flex-wrap:wrap;margin:4px 0"><span class="radius-unit">From (UTC)</span>${DATE('from')}<span class="radius-unit">To (incl.)</span>${DATE('to')}${NAV('apply','APPLY')}</div>`
+`<div ${ROW}>${NAV('prev','◀ PREV')}${NAV('latest','LATEST',' disabled')}${NAV('next','NEXT ▶',' disabled')}${NAV('points','LOAD POINTS',' hidden')}${NAV('fit','FIT FLASHES',' hidden')}</div>`
+`<div class="status-legend" style="border:0;margin:0;padding:2px 0"><div class="status-dot" style="color:#bbb"><span data-lightning-dot style="background:#888"></span>LOADING</div></div>`
+`<div id="gridatlas-lightning-caption-${key}" data-lightning-caption role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word">`
+['window','days','actual','flashes','refresh','searched','warning','footer'].map(k=>`<div data-cap="${k}"${k==='days'?' style="font-weight:bold"':k==='warning'?' style="color:#ffcc00"':k==='footer'?' style="font-size:11px;color:#bbb"':''}></div>`).join('')+'</div></div>';
if(ph())g.querySelectorAll('.map-ctrl-btn').forEach(b=>b.style.cssText+='min-height:44px;min-width:44px');
let q=s=>g.querySelector(s),sf={key,group:g,toggle:q('[data-lightning-control]'),label:q('[data-lightning-label]'),ctl:q('[data-lightning-controls]'),custom:q('[data-lightning-custom]'),from:q('[data-lightning-date="from"]'),to:q('[data-lightning-date="to"]'),dot:q('[data-lightning-dot]'),stx:q('.status-dot').lastChild,caps:{},nav:{},chips:{}};
g.querySelectorAll('[data-cap],[data-lightning-nav],[data-lightning-period]').forEach(n=>{let d=n.dataset;if(d.cap)sf.caps[d.cap]=n;else if(d.lightningNav)sf.nav[d.lightningNav]=n;else sf.chips[d.lightningPeriod]=n});
g.addEventListener('click',ev=>{let b=ev.target.closest('button');if(!b||!g.contains(b))return;if(b.dataset.lightningPeriod)sp(b.dataset.lightningPeriod);else if(b.dataset.lightningNav)nv(b.dataset.lightningNav,sf)});
return sf},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},flag=(n,a,on)=>{if(n)on?n.setAttribute(a,''):n.removeAttribute(a)},
lt=(r,c,loading)=>{if(!S.on)return BASE+' [WAIT]';if(loading)return BASE+' [LOAD]';if(!r||c.st==='FAIL')return BASE+' [FAIL]';
let n=fn(r);return`${BASE} [${r.mode==='feed'?(n?N(n):'none seen')+' | '+(r.old?'last 7 days only':'live feed'):/UNKNOWN|BEFORE/.test(c.st)?(r.before?'UNKNOWN':'not yet searched')+' | '+(r.before?'before archive':sv(r,c)):(n?N(n):'none found')+' | '+sv(r,c)}]`},fn=r=>r.mode==='overview'||r.mode==='detail'&&(r.sk.length||r.fl.length)?r.arch:r.ev.length,
sl=(r,c)=>{let st=c.st,n=fn(r),z=c.stale?' · '+lr(c.g,Date.now(),c.f).toUpperCase()+' · STALE':'';
return st==='FAIL'?'FAIL · '+c.rs.join('; ')+z:(r.mode==='feed'?`${pl(n,'flash','es')} · ${r.old?'last 7 days only · older not yet collected':'live 7-day feed · searched unknown'}`:/UNKNOWN|BEFORE/.test(st)?(r.before?'unknown':'not yet searched')+' · '+(r.before?'before archive (from '+dm(r.idx.cutoff)+')':sv(r,c)):`${n?(r.sk&&r.sk.length?N(r.ev.length)+' of ':'')+pl(n,'flash','es'):st==='EMPTY-COVERED'?'no flashes detected':'none found'} · ${sv(r,c,1)}`).toUpperCase()+z},
pt=loading=>{S.busy=loading;let now=Date.now(),r=S.res,c=r?cf(r,now):null,L=r?cp(r,now,c):null,text=lt(r,c,loading),fail=!!(c&&c.st==='FAIL'),w=r?r.w:null;
for(let sf of S.sfs){if(sf.toggle.checked!==S.on)sf.toggle.checked=S.on;txt(sf.label,text);sf.label.style.opacity=fail?'0.6':'1'}
for(let sf of S.sfs){flag(sf.ctl,'hidden',!S.on);if(!S.on)continue;
for(let k in sf.chips){let b=sf.chips[k],na=!S.idx&&!!S.ie&&LONG.includes(k);b.setAttribute('aria-pressed',b.classList.toggle('active',k===S.period));
if(LONG.includes(k)){let d=b.lastChild;if(!d||!d.tagName){d=document.createElement('span');d.style.opacity='.55';ap(b,d)}txt(d,na?' •':'');b.title=na?'7-day feed only: the archive is not available yet':''}}
let cu=S.period==='custom';sf.custom.style.display=cu?'flex':'none';if(S.idx)sf.from.min=sf.to.min=S.idx.cutoffDate;sf.from.max=sf.to.max=ymd(now);if(sf.from.value!==S.from)sf.from.value=S.from;if(sf.to.value!==S.to)sf.to.value=S.to;
sf.nav.prev.disabled=loading||cu||!S.idx||!w||w.s<=S.idx.covStart||w.s-w.span<S.idx.cutoff;sf.nav.next.disabled=sf.nav.latest.disabled=loading||cu||!w||w.atLatest;flag(sf.nav.points,'hidden',!(r&&r.clp&&!r.big));flag(sf.nav.fit,'hidden',loading||!(r&&r.ev.length));
sf.dot.style.background=loading?COLOUR('L'):c.colour;txt(sf.stx,loading?'LOADING':sl(r,c));if(!loading){for(let k in L)txt(sf.caps[k],L[k]);if(c)sf.caps.days.style.color=c.colour}}
if(r&&!loading)S.last={state:c.st,stale:c.stale,mode:r.mode,period:w.period,drawn:r.ev.length,cluster:!!r.cl,cap:cap(),cap_source:r.cs||null,index_count:r.ic===undefined?null:r.ic,failures:r.fl.length,reasons:c.rs,cells:r.gd?r.gd.fc.features.length:0};if(S.installed)fit()},
sp=p=>{S.period=p;S.consent=false;S.end=null;S.h=[];if(p==='custom'&&!S.from)S.from=S.to=ymd(Date.now());ld()},
fb=()=>{let e=S.res&&S.res.ev,m=mh();if(!e||!e.length||!m)return;let a=180,b=90,c=-180,d=-90;for(let f of e){let[x,y]=f.geometry.coordinates;a=MN(a,x);b=MN(b,y);c=MX(c,x);d=MX(d,y)}cm(m);m.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:9})},
nv=(which,sf)=>{if(which==='fit')return fb();let now=Date.now(),w=wf(now);S.consent=which==='points';
if(which==='apply'){let f=sf.from.value,t=sf.to.value,good=DRE.test(f)&&DRE.test(t)&&f<=t&&t<=ymd(now);sf.from.style.borderColor=sf.to.style.borderColor=good?'':'#ff4444';
if(!good)return txt(sf.caps.warning,'Custom dates invalid — nothing loaded');S.from=f;S.to=t}
else if(which==='latest'){S.end=null;S.h=[];pc();Ry();return ld(true)}else if(which==='prev')S.h.push(S.end),S.end=w.s;else if(which==='next')S.end=S.h.pop()||null;
ld()},
ld=refresh=>{if(!refresh)pc(),Ry();let serial=++S.serial,now=Date.now();if(refresh)S.ip=S.fp=null;pt(true);
lw(now,serial).then(r=>({r}),e=>({e})).then(({r,e})=>{if(serial!==S.serial||!S.on)return;
if(e){note(e);r={mode:'fail',fail:msg(e),w:wf(now),idx:S.idx,ie:S.ie,fl:[],ev:[]}}
S.res=r;r.s=serial;try{dw(FC(r.ev.map((f,i)=>({type:'Feature',id:f.id,geometry:f.geometry,properties:{i,s:serial}}))),!!r.cl)}catch(err){note('draw: '+err.message);r.fail=r.fail||'map layer: '+err.message}try{dd(r.gd)}catch(e){note('cells: '+msg(e))}pt(false)})},
so=on=>{if(S.on===on)return;S.on=on;
if(on){S.end=null;S.consent=false;S.res=null;let m=mh();if(m&&!S.ck&&typeof m.on==='function'){S.ck=1;m.on('click',tap);m.on('resize',cpos);m.on('moveend',()=>{if(S.on&&S.res&&!S.busy)pt(false)})}
ld(true);if(!S.timer)S.timer=setInterval(()=>{if(S.on&&S.res&&S.res.w.atLatest)ld(true)},6e5)}
else{S.serial++;S.res=null;cx();Ry();if(S.rz){S.rz.disconnect();S.rz=S.ro=null}if(S.timer){clearInterval(S.timer);S.timer=null}pt(false)}},
bt=c=>c.addEventListener('change',ev=>{let t=ev.target,d=t&&t.dataset;if(!d)return;if(d.lightningControl==='toggle')so(!!t.checked);else if(!S.lyx&&S.ly)S.ly.delete(d.layerId)}),
fit=()=>{let d=Q('gridatlas-dash-toggle'),b=d&&gr(d),v=b&&b.height;if(d&&d!==S.ro&&typeof ResizeObserver=='function'){if(S.rz)S.rz.disconnect();(S.rz=new ResizeObserver(fit)).observe(S.ro=d)}for(let sf of S.sfs){let s=sf.group.style;s.paddingBottom=(v?innerHeight-b.top+16:96)+'px';s.paddingRight=(v?MX(0,gr(sf.group).right-b.left+16):0)+'px'}},
ins=()=>{if(S.installed)return true;
let M=NS.menuBar,P=window.__GRIDATLAS_PIPELINE_LAYERS__,host=Q('scada-ui-container'),miss=[];
if(!(M&&M.installed===true))miss.push('menuBar');if(!(P&&P.installed))miss.push('pipelineLayers');if(!mh())miss.push('map');if(!host||!host.querySelector('.key-group'))miss.push('groups');S.waiting_for=miss;if(miss.length)return false;
let main=bg('main');ap(host,main.group);bt(host);S.sfs.push(main);
let cur=Q('fs-curtain-keys');if(cur){let fs=bg('fs');ap(cur,fs.group);bt(cur);S.sfs.push(fs)}
S.installed=true;pt(!S.res);for(let e of['resize','orientationchange','click','transitionend'])addEventListener(e,fit);return true};
if(typeof setInterval==='function'&&typeof MutationObserver==='function'){let ob=new MutationObserver(()=>tick()),poll=setInterval(()=>tick(),250),
tick=()=>{try{if(ins()){clearInterval(poll);ob.disconnect()}}catch(e){note('install: '+msg(e))}};ob.observe(document.documentElement,{childList:true,subtree:true})}
NS.ukLightning=Object.freeze({schema:S.schema,generation:GEN,state:S,install:ins,setOn:so,load:()=>ld(true),windowFor:wf});
})();
