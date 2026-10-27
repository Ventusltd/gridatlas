/* uk-lightning-overlay, generation 202610270929 (UTC). EUMETSAT MTG Lightning Imager (L2-LFL) optical flashes as an
 * OFF-by-default overlay appended LAST to the original Layers panel and fullscreen curtain (no Grid dropdown row). No
 * request, source, layer or map listener until the first switch-on; never persisted; no engine, Pipeline News or
 * menu-proxy attribute. Rules trimmed from lightning history-window.mjs (data-plane/hourly-lookback-index-v2 @ f7db76c).
 * Optical flashes are NOT confirmed ground strikes; a day never searched is unknown, never zero. Until the archive is
 * published only the 7-day live feed exists, and the panel says so. Glossary: docs/lightning/CANDIDATE-202610261949.md */
(()=>{'use strict';
const NS=(window.__GRIDATLAS_MODULES__=window.__GRIDATLAS_MODULES__||{});
if(NS.ukLightning||typeof document==='undefined')return;
const GEN='202610270929',AR='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/',IX_SCHEMA='uk-lightning-history-index.v2',
FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson',FEED_SCHEMA='FeatureCollection/optical_lightning_flash',
SRC='gridatlas-lightning',LAYER='l-gridatlas-lightning',DAY=864e5,HOUR=36e5,TMO=15000,BUDGET=40000,RQ=400,DRE=/^\d{4}-\d{2}-\d{2}$/,TOE='timeout after 15 s',NA=e=>/HTTP 404/.test(e)?'archive not yet published':'archive unavailable',
PERIODS=[['12h','12 hours',12*HOUR],['24h','24 hours',DAY],['48h','48 hours',2*DAY],['7d','7 days',7*DAY],['30d','30 days',30*DAY],['3m','3 months',-3],['6m','6 months',-6],['12m','12 months',-12],['custom','Custom UTC dates',0]],
LONG=['30d','3m','6m','12m'],BASE='Lightning Flashes (Optical)',TITLE='Weather · EUMETSAT Lightning Imager',
FOOTER='Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5',
COLOUR=st=>({L:'#888',P:'#ffcc00',U:'#ff8800',B:'#ff8800',F:'#ff4444'})[st[0]]||'#00ff88',
ymd=t=>new Date(t).toISOString().slice(0,10),ds=d=>Date.parse(d+'T00:00:00Z'),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
T=(t,n=16)=>isFinite(t)?new Date(t).toISOString().slice(0,n).replace('T',' ')+' UTC':'unknown',Ts=t=>T(t,19),
N=n=>Number(n).toLocaleString('en-GB'),F7=r=>`${N(r.ev.length)} seen in the available 7-day feed · ${r.w.label} requested${r.old?' · older history unknown':''}`,AGO=t=>{const m=Math.round(t/6e4);return m<0?'?':m<1?'<1 min':`${Math.floor(m/60)}h ${m%60}min`},
ov=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c)),FC=f=>({type:'FeatureCollection',features:f||[]}),bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5,isFC=o=>o&&o.type==='FeatureCollection'&&Array.isArray(o.features),tm=f=>{const s=f.properties.time_utc+'';return Date.parse(/T[\d:.]+$/.test(s)?s+'Z':s)},msg=e=>e&&e.message||String(e),
ph=()=>{try{return matchMedia('(pointer: coarse)').matches||window.innerWidth<=700}catch(_){return false}},cap=()=>ph()?10000:40000,
mm=(t,k)=>{const d=new Date(t),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-k);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.getTime()},
S={schema:'gridatlas.module.uk-lightning-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,requests:0,errors:[],last:null,
period:'24h',end:null,h:[],from:'',to:'',consent:false,serial:0,idx:null,ie:null,res:null,sfs:[]},lru=new Map(),
note=m=>S.errors.push(String(m)),
// transport: fetch for .json (no redirects), XMLHttpRequest for the live feed
gj=(u,cache,raw)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
gx=u=>{S.requests++;return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('GET',u);x.timeout=TMO;
x.onload=()=>{if(x.status>=200&&x.status<300){try{if(x.responseURL&&!x.responseURL.startsWith(u))E('redirected');res(JSON.parse(x.responseText))}catch(e){rej(e)}}else rej(new Error('HTTP '+x.status))};
x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.send()})},
lg=k=>{if(!lru.has(k))return;const v=lru.get(k);lru.delete(k);lru.set(k,v);return v},ls=(k,v)=>{lru.delete(k);lru.set(k,v);while(lru.size>8)lru.delete(lru.keys().next().value)},
// index v2: every row validated; parts are hourly days/YYYY/MM/DD/HH.json with integer counts
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
stale=(x,now)=>!(now-x.gen<=4*HOUR&&x.gen<=now+9e5)||now>x.nextDue,
li=q=>{if(!S.ip){const p=S.ip=gj(AR+'index.json'+(q?'?'+q:''),'no-cache').then(ni).then(m=>{if(S.ip===p){for(const k of[...lru.keys()])if(!lru.get(k).sealed)lru.delete(k);S.idx=m;S.ie=null}return m}).catch(e=>{if(S.ip===p){S.ip=null;S.idx=null;S.ie=msg(e)}throw e})}return S.ip},
// coverage from scan_windows (union); lost (shard_lost) days are unknown, never searched
cv=(x,ws,we)=>{const win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0,l=0;
for(const w of x.sw){const o=ov(Math.max(ws,b),we,w.s,w.e);if(o<=0)continue;sd+=o;r+=w.n;const s=Math.max(ws,w.s),e=Math.min(we,w.e);a=a===null?s:Math.min(a,s);b=b===null?e:Math.max(b,e)}
for(let t=ds(ymd(ws));t<we;t+=DAY){if(ov(ws,we,t,t+DAY)<=0)continue;d++;const y=ymd(t),row=x.by.get(y);if(x.lost.has(y)){l++;let m=t;for(const w of x.sw)sd-=ov(Math.max(ws,m),Math.min(we,t+DAY),w.s,w.e),m=Math.max(m,w.e)}else if(!row||row.coverage==='none')u.push(y)}
return{f:win>0?Math.min(1,sd/win):0,r,a,b,d,u,l,ny:x.lastScan===null?win:Math.max(0,we-Math.max(ws,x.lastScan)),bf:Math.max(0,Math.min(we,x.covStart)-ws)}},
// windows: UTC, end-anchored, [start,end); PREV/NEXT walk the S.h stack of window ends
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
ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&(c=>Array.isArray(c)&&c.length<4&&bx(c[0],c[1]))(f.geometry.coordinates)&&f.properties&&FEED_SCHEMA.split('/')[1]===f.properties.observation_kind&&isFinite(tm(f)),
co=(parts,ws,we)=>{const m=new Map();let k=0;for(const part of parts)for(const f of part){if(!ok(f)){k++;continue}const t=tm(f);if(t>=ws&&t<we)m.set(f.id==null?t+','+f.geometry.coordinates:JSON.stringify(f.id),f)}const a=[...m.values()].sort((a,b)=>tm(a)-tm(b));a.bad=k;return a},
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
r={mode:'overview',w,idx:x,before:false,rows,arch:known.reduce((n,y)=>n+y.count,0),cov:cv(x,w.s,w.e),fl:[],ev:[],ld:[],sk:[]};
let tf=rows.filter(y=>y.count>0),bytes=0,count=0,nq=0;
for(const row of tf)for(const t of tg(row,w.s,w.e)){nq++;count+=t.count||0;bytes+=t.bytes>0?t.bytes:(t.count||0)*530}
// within the device point cap, 32 MB and RQ files the points load for any window length; above, LOAD POINTS asks first
if(count>Math.min(BUDGET,cap())||bytes>32e6||nq>RQ){r.budget=`${N(count)} flashes, ${N(bytes)} bytes, ${N(nq)} files`;if(!S.consent){r.clp=true;return r}
let run=0,rb=0,rn=0;tf.sort((a,b)=>b.date.localeCompare(a.date));const keep=[];for(const y of tf){const b=y.bytes>0?y.bytes:y.count*530,q=tg(y,w.s,w.e).length;if(r.sk.length||run+y.count>BUDGET||rb+b>32e6||rn+q>RQ){r.sk.push(y.date);continue}keep.push(y);run+=y.count;rb+=b;rn+=q}if(!keep.length){r.clp=r.big=1;return r}tf=keep;count=run}
r.ld=tf.map(y=>y.date);r.ic=count;r.cs='index';r.cl=count>cap();
const got=await fr(tf,w.s,w.e,sn);for(const f of got.fl)if(/WebCrypto/.test(f.error))f.u=1;else if(!f.t.sealed&&/mismatch/.test(f.error)){if(!q){S.ip=null;return lw(now,sn,now)}f.error+='; archive updating, reload later';f.u=1}r.mode='detail';r.fl=got.fl;r.rq=got.rq;r.ev=co(got.parts,w.s,w.e);return r},
// state machine
cf=(r,now)=>{let st;const rs=[];
if(r.fail){st='FAIL';rs.push(r.fail)}else if(r.before){st='BEFORE-ARCHIVE';rs.push('before archive start')}
else if(r.fl.some(f=>!f.u)){st='FAIL';rs.push(`${r.fl.length} of ${r.rq} day files failed`)}
else{const c=r.cov,f=c?c.f:0;if(r.mode==='feed'){st=r.ev.length?'PARTIAL':'UNKNOWN';rs.push('coverage unknown')}else if(!c||f<=0){st='UNKNOWN';rs.push('0% searched')}
else if(f<1||c.ny>0||c.l||c.u.length||r.fl.length){st='PARTIAL';if(c.ny>0)rs.push('tail unknown');if(c.bf>0)rs.push('head unknown');if(c.u.length)rs.push(`${c.u.length} unscanned dates`);if(!rs.length)rs.push(r.fl.length?'unverified':'gaps in window')}
else if(r.mode!=='overview')st=r.sk.length?(rs.push('days not loaded'),'PARTIAL'):r.ev.length?'READY·DETAIL':'EMPTY-COVERED';else st=r.arch>0?'READY·SUMMARY':'EMPTY-COVERED'}
return{st,stale:!!(r.idx||r.meta)&&stale(r.idx||{gen:Date.parse(r.meta.query_end_utc)},now),colour:COLOUR(st),rs}},
// caption lines
cp=(r,now,k)=>{const w=r.w,x=r.idx,L={notice:'',window:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER};
L.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(Math.max(w.s,w.e-1))} inclusive = ${T(w.s)} → ${T(w.e)}`:`Window  ${T(w.s)} → ${T(w.e)} (${w.label}${w.atLatest?', latest':', end exclusive'})`;
if(w.clamped)L.window+=' · start clamped to retention start '+x.cutoffDate;
if(r.fail){L.warning=r.ie&&!x?`Archive unavailable: ${r.ie} — nothing shown (unknown, not zero)`:r.fail;return L}
if(r.before){L.warning=`Window predates the archive (began ${T(x.covStart)}; retention from ${x.cutoffDate}) — unknown, not zero`;return L}
r.out=0;try{const b=mh().getBounds();r.out=r.ev.filter(f=>!b.contains(f.geometry.coordinates)).length}catch(_){}
const n=r.ev.length,first=n?`Actual  first ${Ts(tm(r.ev[0]))} · last ${Ts(tm(r.ev[n-1]))}`:'',
drawn=(!n?'':` · ${N(n)} drawn as ${r.cl?'clusters':'points'} (cap ${N(cap())})`)+(r.ev&&r.ev.bad?` · ${N(r.ev.bad)} malformed records rejected`:'')+(r.out?` · ${N(r.out)} of ${N(n)} outside the current view`:'');
if(r.mode==='feed'){const m=r.meta,P=(k,f=T)=>f(Date.parse(m[k]));
L.refresh=`Refresh live feed ${P('query_end_utc')} (last collection window ${P('query_start_utc')} → ${P('query_end_utc')}; latest detection ${P('latest_detection_utc',Ts)}; 7-day retention; ${NA(r.ie)}: ${r.ie}; earlier hours unknown, not zero)`;
L.searched='Searched EUMETSAT unknown (live feed records only its last collection window)';if(r.old){L.notice='Only the last 7 days are available yet. The 12-month archive is being collected and backfilled; earlier months are unknown, not zero.';L.warning=NA(r.ie)+': earlier coverage unknown, not zero'}
L.actual=first||'Actual  none seen in the 7-day feed (unknown, not zero)';L.flashes=`Flashes ${F7(r)}${drawn}`}
else if(r.mode==='detail'){L.actual=r.fl.length?'Actual  unknown (day files failed)':first||'Actual  no archived flashes within this window';
L.flashes=r.sk.length?`Flashes ${N(r.arch)} archived on the overlapping UTC dates (index, whole days) · ${N(n)} downloaded from the newest ${r.ld.length} of ${r.ld.length+r.sk.length} days (budget ${N(BUDGET)} flashes / 32 MB; ${r.sk.length} days not loaded)${drawn}`:`Flashes ${r.fl.length?`${N(r.ic)} in index · ${N(n)} loaded`:N(n)+' archived in window'}${drawn}`}
else{const o=r.rows.filter(y=>y.first_observation_utc),k=r.rows.length;
L.actual=o.length?`Actual  on the ${k} overlapping UTC dates: first ${Ts(Date.parse(o[0].first_observation_utc))} · last ${Ts(Date.parse(o[o.length-1].last_observation_utc))} (day-level; may lie outside a midday window edge)`:`Actual  no archived flashes on the ${k} overlapping UTC dates`;
L.flashes=`Flashes ${N(r.arch)} archived on ${k} overlapping UTC dates · none drawn (summary mode; ${r.clp?`index sum ${r.budget} exceeds the budget; ${r.big?'newest day alone exceeds it; none drawn':`LOAD POINTS draws up to the newest ${N(BUDGET)}`}`:'points load automatically within the budget'})`}
if(x)L.refresh=`Refresh archive ${T(x.gen)} (${AGO(now-x.gen)} ago; expected every ${x.iv} h)${stale(x,now)?' · STALE':''}`;
const c=r.mode!=='feed'&&r.cov;if(c){const warn=[];
L.searched=c.f>0?`Searched EUMETSAT ${Math.floor(c.f*100)}% of window · ${c.r} successful runs${c.a!==null?` · ${T(c.a)} → ${T(c.b)}`:''}`:c.l?'Searched EUMETSAT: shard lost (integrity alert), unknown, not zero':'Searched EUMETSAT 0% of window — no collection run covers these dates';
if(c.ny>0)warn.push(`Not yet ingested: last ${AGO(c.ny)} of window (unknown, not zero)`);
if(c.bf>0&&x)warn.push(`Unknown: ${ymd(w.s)} to ${ymd(Math.min(w.e,x.covStart)-1)} precede archive start ${T(x.covStart)} (not zero)`);
if(c.l)warn.push(`${c.l} days lost from the archive (integrity alert), unknown, not zero`);if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);
if(r.fl.length)warn.push(`${r.fl.length} of ${r.rq} day files failed (${r.fl.map(f=>f.date+' '+f.error).join(', ')}); points incomplete, counts from index`);
L.warning=warn.join(' · ')}
if(k&&/UNK|PAR/.test(k.st)&&/^Flashes 0 a/.test(L.flashes))L.flashes+=' (unknown, not zero)'
return L},
// map: one source, a points layer, an invisible 44 px hit layer and (clustered) count labels; hidden until data
mh=()=>{const m=window.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
sf=m=>{try{for(const l of m.getStyle().layers||[]){const f=l.type==='symbol'&&l.layout&&l.layout['text-font'];if(Array.isArray(f)&&f.length&&typeof f[0]==='string')return f}}catch(_){}return['Open Sans Regular']},
HIT=LAYER+'-hit',CNT=LAYER+'-count',pc=()=>{if(S.pp){S.pp.remove();S.pp=null}nc()},
el=(t,css,s)=>{const e=document.createElement(t);if(css)e.style.cssText=css;if(s!=null)e.textContent=s;return e},
// above the flash when it fits below the menu bar, else below it; clamped inside the map; scrolls when taller than the map
cpos=()=>{const c=S.pp,m=mh();if(!c||!m)return;const p=m.project(c.ll),k=m.getContainer().getBoundingClientRect(),b=Q('gridatlas-menu-bar'),t=Math.max(0,(b?b.getBoundingClientRect().bottom:0)-k.top)+8,w=c.offsetWidth||0,h=c.offsetHeight||0;
c.style.maxHeight=Math.max(120,k.height-t-8)+'px';c.style.left=Math.min(Math.max(p.x,w/2+8),Math.max(w/2+8,k.width-w/2-8))+'px';c.style.top=(p.y-h-14>=t?p.y-h-14:Math.max(t,Math.min(p.y+14,k.height-h-8)))+'px'},
cx=()=>{const m=mh();pc();if(m)try{for(const l of[CNT,HIT,LAYER])if(m.getLayer(l))m.removeLayer(l);if(m.getSource(SRC))m.removeSource(SRC)}catch(e){note(e)}S.mode=null},
dw=(fc,cl)=>{const m=mh(),K={'circle-stroke-width':1.5,'circle-stroke-color':'#1a1a1a'},Z=k=>['interpolate',['linear'],['zoom'],5,k(6),8,k(8),11,k(10)];if(!m)E('no map');const mode=cl?'cluster':'raw';if(S.mode&&S.mode!==mode)cx();
if(!m.getSource(SRC)){m.addSource(SRC,Object.assign({type:'geojson',data:FC()},cl?{cluster:true,clusterRadius:40,clusterMaxZoom:10}:{}));
m.addLayer({id:LAYER,type:'circle',source:SRC,layout:{visibility:'none'},paint:cl?{'circle-radius':Z(x=>['case',['has','point_count'],['step',['get','point_count'],12,100,16,1000,20,10000,26],x]),...K,'circle-color':['case',['has','point_count'],'#ffb000','#fff3a0'],'circle-opacity':0.9}
:{'circle-radius':Z(x=>x),...K,'circle-color':'#fff3a0','circle-opacity':0.95}});
m.addLayer({id:HIT,type:'circle',source:SRC,layout:{visibility:'none'},paint:{'circle-radius':22,'circle-opacity':0}});
if(cl)try{m.addLayer({id:CNT,type:'symbol',source:SRC,filter:['has','point_count'],layout:{visibility:'none','text-field':['get','point_count_abbreviated'],'text-font':sf(m),'text-size':11},paint:{'text-color':'#000'}})}catch(e){note('count labels: '+msg(e))}S.mode=mode}
m.getSource(SRC).setData(fc);const v=fc.features.length?'visible':'none';for(const l of[LAYER,HIT,CNT])if(m.getLayer(l))m.setLayoutProperty(l,'visibility',v)},
// tap: query only our hit layer; open our card only when a flash is under the tap. Other click handlers always run.
tap=e=>{const m=mh();if(!S.on||!m||!m.getLayer(HIT))return;const px=e.point.x??e.point[0],py=e.point.y??e.point[1];let f=null,dm=Infinity;
for(const q of m.queryRenderedFeatures(e.point,{layers:[HIT]})){const g=q.properties&&!q.properties.cluster&&S.res&&S.res.ev[q.properties.i],a=m.project((g||q).geometry.coordinates),d=(a.x-px)**2+(a.y-py)**2;if(d<dm){dm=d;f=q}}pc();if(!f)return;
const p=f.properties||{};if(p.cluster){const go=z=>m.easeTo({center:f.geometry.coordinates,zoom:z}),z=m.getSource(SRC).getClusterExpansionZoom(p.cluster_id,(err,z)=>err||go(z));if(z&&z.then)z.then(go,note);return}
const g=S.res&&S.res.ev[p.i];if(!g)return;const[x,y]=g.geometry.coordinates,c=el('div','position:absolute;z-index:5;max-width:280px;box-sizing:border-box;background:#000;color:#e8f4f5;border:1px solid #00ffff;border-radius:4px;padding:8px 48px 8px 10px;font:12px/1.45 monospace;overflow-wrap:anywhere;overflow:auto;transform:translateX(-50%)');
c.dataset.lightningCard='';c.ll=[x,y];const b=el('button','position:absolute;top:0;right:0;width:44px;height:44px;background:none;border:0;color:#e8f4f5;font:20px monospace;cursor:pointer','×');b.type='button';b.setAttribute('aria-label','Close');b.addEventListener('click',pc);c.appendChild(b);
for(const s of[Ts(tm(g)),'Flash ID '+(g.id==null?'(none)':g.id),`lat ${y.toFixed(3)}, lon ${x.toFixed(3)}`,'EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike'])c.appendChild(el('div','',s));
const n=el('button','margin-top:6px;min-height:44px;padding:0 10px;background:#001418;color:#00ffff;border:1px solid #00ffff;font:12px monospace;cursor:pointer','NEAREST SUBSTATIONS');n.type='button';n.dataset.lightningNearest='';n.addEventListener('click',()=>near(m,c,x,y));c.appendChild(n);
c.out=el('div','margin-top:6px');c.appendChild(c.out);m.getContainer().appendChild(c);S.pp=c;cpos()},
// nearest substations: no public draw entry exists (link.selectAt treats its origin as a project and needs the engine's popup),
// so the neon-links lane's PUBLIC list and distance function are reused; the lines are Lightning-owned, styled like the originals.
NEAR='gridatlas-lightning-nearest',NL=[NEAR+'-glow',NEAR+'-core',NEAR+'-node',NEAR+'-label'],
nc=()=>{const m=mh();if(m)try{for(const l of NL)if(m.getLayer(l))m.removeLayer(l);if(m.getSource(NEAR))m.removeSource(NEAR)}catch(e){note(e)}},
nr=(m,c,x,y)=>{const L=window.__GRIDATLAS_NEON_LINKS__||{},subs=L.substations||window.__GRIDATLAS_SUBSTATIONS__||[],dk=L.measure&&L.measure.distanceKm,say=s=>c.out.appendChild(el('div','',s));c.out.textContent='';nc();
if(!subs.length||typeof dk!=='function')return say('Substation data not loaded yet; try again in a moment.');
const k=subs.filter(s=>s&&Array.isArray(s.at)&&Array.isArray(s.kv)&&s.kv[0]>=132).map(s=>({s,km:dk(x,y,s.at[0],s.at[1])})).filter(a=>isFinite(a.km)).sort((a,b)=>a.km-b.km).slice(0,3);
say('Nearest substations to this optical flash (straight-line km). Not evidence any asset was struck; faults can have other causes.');for(const a of k)say(`${a.km.toFixed(2)} km · ${a.s.kv[0]} kV · ${a.s.name||'unnamed substation'}`);if(!k.length)return say('No transmission substation (132 kV or above) in the published list.');
const F=[];k.forEach((a,i)=>F.push({type:'Feature',properties:{o:Math.max(.2,.62-i*.1)},geometry:{type:'LineString',coordinates:[[x,y],a.s.at]}},{type:'Feature',properties:{t:`${a.km.toFixed(2)} km · ${a.s.kv[0]} kV`},geometry:{type:'Point',coordinates:a.s.at}}));
const C='#5fbdc2',LS=['==',['geometry-type'],'LineString'],PT=['==',['geometry-type'],'Point'];m.addSource(NEAR,{type:'geojson',data:FC(F)});
m.addLayer({id:NL[0],type:'line',source:NEAR,filter:LS,paint:{'line-color':C,'line-width':['interpolate',['linear'],['zoom'],6,5,12,12],'line-opacity':0.1,'line-blur':['interpolate',['linear'],['zoom'],6,3,12,8]}});
m.addLayer({id:NL[1],type:'line',source:NEAR,filter:LS,paint:{'line-color':C,'line-width':['interpolate',['linear'],['zoom'],6,0.9,12,1.8],'line-opacity':['get','o']}});
m.addLayer({id:NL[2],type:'circle',source:NEAR,filter:PT,paint:{'circle-radius':['interpolate',['linear'],['zoom'],6,2.2,12,4],'circle-color':C,'circle-opacity':0.8}});
try{m.addLayer({id:NL[3],type:'symbol',source:NEAR,filter:PT,layout:{'text-field':['get','t'],'text-size':10,'text-offset':[0,-1.5],'text-anchor':'bottom','text-font':sf(m)},paint:{'text-color':'#a9c4c9','text-halo-color':'#000c10','text-halo-width':1.5}})}catch(e){note('nearest labels: '+msg(e))}},near=(m,c,x,y)=>{nr(m,c,x,y);cpos()},
// DOM: shell classes, inline styles on own nodes only
BTN=(a,t,x)=>`<button type="button" class="map-ctrl-btn" ${a}${x||''}>${t}</button>`,NAV=(k,t,x)=>BTN(`data-lightning-nav="${k}"`,t,x),ROW='style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0"',
DATE=k=>`<input type="date" class="search-input" data-lightning-date="${k}" aria-label="${k} date (UTC)" style="width:9.5em;color-scheme:dark">`,
bg=key=>{const g=document.createElement('div');g.className='key-group';g.style.gridColumn='1/-1';g.dataset.lightningGroup=key;
g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-lightning-control="toggle"> <span data-lightning-label="${key}" style="color:#ffdf44">${BASE} [WAIT]</span></label>`
+`<div data-lightning-controls="${key}" hidden><div role="group" ${ROW}>${PERIODS.map(p=>BTN(`data-lightning-period="${p[0]}"`,p[0].toUpperCase())).join('')}</div>`
+`<div class="radius-input-row" data-lightning-custom style="display:none;flex-wrap:wrap;margin:4px 0"><span class="radius-unit">From (UTC)</span>${DATE('from')}<span class="radius-unit">To (incl.)</span>${DATE('to')}${NAV('apply','APPLY')}</div>`
+`<div ${ROW}>${NAV('prev','◀ PREV')}${NAV('latest','LATEST',' disabled')}${NAV('next','NEXT ▶',' disabled')}${NAV('points','LOAD POINTS',' hidden')}${NAV('fit','FIT FLASHES',' hidden')}</div>`
+`<div class="status-legend" style="border:0;margin:0;padding:2px 0"><div class="status-dot" style="color:#bbb"><span data-lightning-dot style="background:#888"></span>LOADING</div></div>`
+`<div id="gridatlas-lightning-caption-${key}" data-lightning-caption role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word">`
+['notice','window','actual','flashes','refresh','searched','warning','footer'].map(k=>`<div data-cap="${k}"${k==='notice'?' style="color:#ffcc00;font-weight:bold"':k==='warning'?' style="color:#ffcc00"':k==='footer'?' style="font-size:11px;color:#bbb"':''}></div>`).join('')+'</div></div>';
if(ph())g.querySelectorAll('.map-ctrl-btn').forEach(b=>b.style.cssText+='min-height:44px;min-width:44px');
const q=s=>g.querySelector(s),sf={key,group:g,toggle:q('[data-lightning-control]'),label:q('[data-lightning-label]'),ctl:q('[data-lightning-controls]'),custom:q('[data-lightning-custom]'),from:q('[data-lightning-date="from"]'),to:q('[data-lightning-date="to"]'),dot:q('[data-lightning-dot]'),stx:q('.status-dot').lastChild,caps:{},nav:{},chips:{}};
g.querySelectorAll('[data-cap],[data-lightning-nav],[data-lightning-period]').forEach(n=>{const d=n.dataset;if(d.cap)sf.caps[d.cap]=n;else if(d.lightningNav)sf.nav[d.lightningNav]=n;else sf.chips[d.lightningPeriod]=n});
g.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||!g.contains(b))return;if(b.dataset.lightningPeriod)sp(b.dataset.lightningPeriod);else if(b.dataset.lightningNav)nv(b.dataset.lightningNav,sf)});
return sf},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},flag=(n,a,on)=>{if(n)on?n.setAttribute(a,''):n.removeAttribute(a)},
lt=(r,c,loading)=>{if(!S.on)return BASE+' [WAIT]';if(loading)return BASE+' [LOAD]';if(!r||c.st==='FAIL')return BASE+' [FAIL]';
const n=r.mode==='overview'?r.arch:r.ev.length;if(r.mode==='feed'&&r.old)return`${BASE} [${n>0?N(n):'UNKNOWN'} · last 7 days only${c.stale?' STALE':''}]`;return`${BASE} [${/UNKNOWN|BEFORE/.test(c.st)?'UNKNOWN':n>0?(c.st==='PARTIAL'?'≥':'')+N(n)+(c.st==='PARTIAL'&&r.cov?` · ${Math.floor(r.cov.f*100)}% searched`:''):c.st==='PARTIAL'?'UNKNOWN':'EMPTY'} | ${r.w.period}${c.stale?' STALE':''}]`},
sl=(r,c)=>{const st=c.st,n=r.mode==='overview'?`${N(r.arch)} ARCHIVED`:`${N(r.ev.length)} FLASHES${r.cl?' CLUSTERED':' DRAWN'}`;
return(r.mode==='feed'&&r.old&&st!=='FAIL'?`7-DAY FEED ONLY · ${N(r.ev.length)} FLASHES · OLDER HISTORY NOT YET COLLECTED`:r.mode==='feed'&&st!=='FAIL'?`${st} · ${F7(r)} · searched unknown`:st.startsWith('READY')?'READY · '+n:st==='EMPTY-COVERED'?'NO FLASHES DETECTED · SEARCHED 100%':st==='PARTIAL'?`PARTIAL · ${n} · SEARCHED ${r.cov&&!r.fl.length?Math.floor(r.cov.f*100)+'%':'UNKNOWN'}`:st==='FAIL'?'FAIL · '+c.rs.join('; '):st)+(c.stale?' · STALE':'')},
// one batched repaint
pt=loading=>{S.busy=loading;const now=Date.now(),r=S.res,c=r?cf(r,now):null,L=r?cp(r,now,c):null,text=lt(r,c,loading),fail=!!(c&&c.st==='FAIL'),w=r?r.w:null;
for(const sf of S.sfs){if(sf.toggle.checked!==S.on)sf.toggle.checked=S.on;txt(sf.label,text);sf.label.style.opacity=fail?'0.6':'1'}
for(const sf of S.sfs){flag(sf.ctl,'hidden',!S.on);if(!S.on)continue;
for(const k in sf.chips){const b=sf.chips[k],na=!S.idx&&!!S.ie&&LONG.includes(k);b.setAttribute('aria-pressed',b.classList.toggle('active',k===S.period));
if(LONG.includes(k)){let d=b.lastChild;if(!d||!d.tagName){d=document.createElement('span');d.style.opacity='.55';b.appendChild(d)}txt(d,na?' •':'');b.title=na?'7-day feed only: the archive is not available yet':''}}
const cu=S.period==='custom';sf.custom.style.display=cu?'flex':'none';if(S.idx)sf.from.min=sf.to.min=S.idx.cutoffDate;sf.from.max=sf.to.max=ymd(now);if(sf.from.value!==S.from)sf.from.value=S.from;if(sf.to.value!==S.to)sf.to.value=S.to;
sf.nav.prev.disabled=loading||cu||!S.idx||!w||w.s<=S.idx.cutoff;sf.nav.next.disabled=sf.nav.latest.disabled=loading||cu||!w||w.atLatest;flag(sf.nav.points,'hidden',!(r&&r.clp&&!r.big));flag(sf.nav.fit,'hidden',loading||!(r&&r.ev.length));
sf.dot.style.background=loading?COLOUR('L'):c.colour;txt(sf.stx,loading?'LOADING':sl(r,c));if(!loading)for(const k in L)txt(sf.caps[k],L[k])}
if(r&&!loading)S.last={state:c.st,stale:c.stale,mode:r.mode,period:w.period,drawn:r.ev.length,cluster:!!r.cl,cap:cap(),cap_source:r.cs||null,index_count:r.ic===undefined?null:r.ic,failures:r.fl.length,reasons:c.rs};if(S.installed)fit()},
// actions
sp=p=>{S.period=p;S.consent=false;if(p==='custom'&&!S.from)S.from=S.to=ymd(Date.now());ld()},
fb=()=>{const e=S.res&&S.res.ev,m=mh();if(!e||!e.length||!m)return;let a=180,b=90,c=-180,d=-90;for(const f of e){const[x,y]=f.geometry.coordinates;a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y)}m.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:9})},
nv=(which,sf)=>{if(which==='fit')return fb();const now=Date.now(),w=wf(now);S.consent=which==='points';
if(which==='apply'){const f=sf.from.value,t=sf.to.value,good=DRE.test(f)&&DRE.test(t)&&f<=t;sf.from.style.borderColor=sf.to.style.borderColor=good?'':'#ff4444';
if(!good)return txt(sf.caps.warning,'Custom dates invalid — nothing loaded');S.from=f;S.to=t}
else if(which==='latest'){S.end=null;return ld(true)}else if(which==='prev')S.h.push(S.end),S.end=w.s;else if(which==='next')S.end=S.h.pop()||null;
ld()},
ld=refresh=>{const serial=++S.serial,now=Date.now();if(refresh)S.ip=S.fp=null;pt(true);
lw(now,serial).then(r=>({r}),e=>({e})).then(({r,e})=>{if(serial!==S.serial||!S.on)return;
if(e){note(e);r={mode:'fail',fail:msg(e),w:wf(now),idx:S.idx,ie:S.ie,fl:[],ev:[]}}
S.res=r;try{dw(FC(r.ev.map((f,i)=>({type:'Feature',id:f.id,geometry:f.geometry,properties:{i}}))),!!r.cl)}catch(err){note('draw: '+err.message);r.fail=r.fail||'map layer: '+err.message}pt(false)})},
so=on=>{if(S.on===on)return;S.on=on;
if(on){S.end=null;S.consent=false;S.res=null;const m=mh();if(m&&!S.ck&&typeof m.on==='function'){S.ck=1;m.on('click',tap);m.on('move',cpos);m.on('moveend',()=>{if(S.on&&S.res&&!S.busy)pt(false)})}
ld(true);if(!S.timer)S.timer=setInterval(()=>{if(S.on&&S.res&&S.res.w.atLatest)ld(true)},6e5)}
else{S.serial++;S.res=null;cx();if(S.timer){clearInterval(S.timer);S.timer=null}pt(false)}},
bt=c=>c.addEventListener('change',ev=>{const t=ev.target;if(t&&t.dataset&&t.dataset.lightningControl==='toggle')so(!!t.checked)}),
// keep Lightning-owned text clear of the shell's fixed HIDE LAYERS button (its live rect + 16 px; 96 px if absent)
fit=()=>{const d=Q('gridatlas-dash-toggle'),b=d&&d.getBoundingClientRect(),v=b&&b.height;if(d&&d!==S.ro&&typeof ResizeObserver=='function')new ResizeObserver(fit).observe(S.ro=d);for(const sf of S.sfs){const s=sf.group.style;s.paddingBottom=(v?innerHeight-b.top+16:96)+'px';s.paddingRight=(v?Math.max(0,sf.group.getBoundingClientRect().right-b.left+16):0)+'px'}},
// install after menu, Pipeline News and map exist
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
