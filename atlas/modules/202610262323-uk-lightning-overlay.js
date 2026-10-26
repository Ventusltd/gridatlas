/* uk-lightning-overlay, generation 202610262323 (UTC). EUMETSAT MTG Lightning Imager (L2-LFL) optical flashes as an
 * OFF-by-default overlay appended LAST to the original Layers panel and fullscreen curtain (no Grid dropdown row). No
 * request, source or layer until the first switch-on; never persisted; no engine, Pipeline News or menu-proxy attribute.
 * Rules trimmed from lightning history-window.mjs (data-plane/hourly-lookback-index-v2 @ f7db76c). Optical flashes are
 * NOT confirmed ground strikes; a day never searched is unknown, never zero. Glossary: docs/lightning/CANDIDATE-202610261949.md */
(()=>{'use strict';
const NS=(window.__GRIDATLAS_MODULES__=window.__GRIDATLAS_MODULES__||{});
if(NS.ukLightning||typeof document==='undefined')return;
const GEN='202610262323',AR='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/history/',
FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson',
SRC='gridatlas-lightning',LAYER='l-gridatlas-lightning',DAY=864e5,HOUR=36e5,TMO=15000,BUDGET=40000,DRE=/^\d{4}-\d{2}-\d{2}$/,TOE='timeout after 15 s',NA=e=>/HTTP 404/.test(e)?'archive not yet published':'archive unavailable',
PERIODS=[['12h','12 hours',12*HOUR],['24h','24 hours',DAY],['48h','48 hours',2*DAY],['7d','7 days',7*DAY],['30d','30 days',30*DAY],['3m','3 months',-3],['6m','6 months',-6],['12m','1 year',-12],['custom','Custom UTC dates',0]],
BASE='Lightning flashes (optical)',TITLE='Weather · EUMETSAT Lightning Imager',
FOOTER='Times UTC · Optical flashes seen by MTG Lightning Imager (EUMETSAT L2-LFL), not confirmed ground strikes · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5',
COLOUR=st=>({L:'#888',P:'#ffcc00',U:'#ff8800',B:'#ff8800',F:'#ff4444'})[st[0]]||'#00ff88',
ymd=t=>new Date(t).toISOString().slice(0,10),ds=d=>Date.parse(d+'T00:00:00Z'),Q=id=>document.getElementById(id),E=m=>{throw new TypeError(m)},
T=(t,n=16)=>isFinite(t)?new Date(t).toISOString().slice(0,n).replace('T',' ')+' UTC':'unknown',Ts=t=>T(t,19),
N=n=>Number(n).toLocaleString('en-GB'),AGO=t=>{const m=Math.max(0,Math.round(t/6e4));return`${Math.floor(m/60)}h ${m%60}min`},
ov=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c)),FC=f=>({type:'FeatureCollection',features:f||[]}),// D02 UK box
bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5,isFC=o=>o&&o.type==='FeatureCollection'&&Array.isArray(o.features),tm=f=>Date.parse(f.properties.time_utc),msg=e=>e&&e.message||String(e),
ph=()=>{try{return matchMedia('(pointer: coarse)').matches||window.innerWidth<=700}catch(_){return false}},cap=()=>ph()?10000:40000,
mm=(t,k)=>{const d=new Date(t),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-k);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));return d.getTime()},
S={schema:'gridatlas.module.uk-lightning-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,requests:0,errors:[],last:null,
period:'24h',end:null,from:'',to:'',consent:false,serial:0,idx:null,ie:null,ip:null,fp:null,res:null,mode:null,timer:null,sfs:[]},lru=new Map(),
note=m=>S.errors.push(String(m)),
// transport: fetch for .json, XMLHttpRequest for the live feed
gj=(u,cache,raw)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),TMO);S.requests++;
return fetch(u,{cache,signal:c.signal}).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return raw&&r.arrayBuffer?r.arrayBuffer():r.json()}).catch(e=>{throw e&&e.name==='AbortError'?new Error(TOE):e}).finally(()=>clearTimeout(t))},
gx=u=>{S.requests++;return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('GET',u);x.timeout=TMO;
x.onload=()=>{if(x.status>=200&&x.status<300){try{res(JSON.parse(x.responseText))}catch(e){rej(e)}}else rej(new Error('HTTP '+x.status))};
x.onerror=()=>rej(new Error('network error'));x.ontimeout=()=>rej(new Error(TOE));x.send()})},
lg=k=>{if(!lru.has(k))return;const v=lru.get(k);lru.delete(k);lru.set(k,v);return v},ls=(k,v)=>{lru.delete(k);lru.set(k,v);while(lru.size>8)lru.delete(lru.keys().next().value)},
// index v2
vk=r=>{const n=r&&r.count,b=w=>E(`invalid index row ${r&&r.date}: ${w}`);if(!r||!DRE.test(r.date))b('date');if(!['none','partial','full'].includes(r.coverage))b('coverage');
if(r.coverage==='none'?n!==null:!(n>=0))b('count');if(n===0&&!(r.scanned_seconds>0))b('count 0 unscanned');if(n>0&&!r.path&&!(r.parts&&r.parts.length))b('no path/parts');
if(r.path&&!/^days\/\d{4}\/\d{2}\/\d{2}\.json$/.test(r.path))b('path');if(typeof r.sealed!=='boolean')b('sealed')},
ni=raw=>{if(!raw||typeof raw!=='object'||!Array.isArray(raw.days))E('not a lightning history index');
if(raw.schema!=='uk-lightning-history-index.v2')E('unsupported index schema '+raw.schema);
if(raw.observation!=='satellite optical lightning flashes, not ground strikes')E('index observation sentence missing');
const gen=Date.parse(raw.generated_utc);if(!isFinite(gen))E('index generated_utc missing');if(!DRE.test(raw.cutoff_date_utc||''))E('index cutoff_date_utc missing');
raw.days.forEach(vk);
const sw=(raw.scan_windows||[]).map(w=>({s:Date.parse(w.start_utc),e:Date.parse(w.end_utc),n:Number(w.successful_runs)||1})).filter(w=>isFinite(w.s)&&isFinite(w.e)&&w.e>w.s).sort((a,b)=>a.s-b.s),
cutoff=ds(raw.cutoff_date_utc),iv=Number(raw.collection_interval_hours)||3;
return{days:raw.days,by:new Map(raw.days.map(r=>[r.date,r])),sw,gen,cutoff,iv,nextDue:Date.parse(raw.next_update_due_utc||'')||gen+(iv+1)*HOUR,lastScan:sw.length?Math.max(...sw.map(w=>w.e)):null,
covStart:Date.parse(raw.coverage_start_utc||'')||(sw.length?Math.min(...sw.map(w=>w.s)):cutoff),cutoffDate:raw.cutoff_date_utc}},
stale=(x,now)=>now-x.gen>4*HOUR||now>x.nextDue,
li=()=>{if(!S.ip)S.ip=gj(AR+'index.json','no-cache').then(ni).then(m=>{for(const k of[...lru.keys()])if(!lru.get(k).sealed)lru.delete(k);S.idx=m;S.ie=null;return m}).catch(e=>{S.ip=null;S.ie=msg(e);throw e});return S.ip},
// coverage from scan_windows
cv=(x,ws,we)=>{const win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0;
for(const w of x.sw){const o=ov(ws,we,w.s,w.e);if(o<=0)continue;sd+=o;r+=w.n;const s=Math.max(ws,w.s),e=Math.min(we,w.e);a=a===null?s:Math.min(a,s);b=b===null?e:Math.max(b,e)}
for(let t=ds(ymd(ws));t<we;t+=DAY){if(ov(ws,we,t,t+DAY)<=0)continue;d++;const row=x.by.get(ymd(t));if(!row||row.coverage==='none')u.push(ymd(t))}
return{f:win>0?Math.min(1,sd/win):0,r,a,b,d,u,ny:x.lastScan===null?win:Math.max(0,we-Math.max(ws,x.lastScan)),bf:Math.max(0,Math.min(we,x.covStart)-ws)}},
// windows: UTC, end-anchored, [start,end)
wf=now=>{const P=PERIODS.find(p=>p[0]===S.period)||PERIODS[1],cu=S.period==='custom';let s,e,atLatest;
if(cu){s=ds(S.from);e=Math.min(ds(S.to)+DAY,now);atLatest=ds(S.to)+DAY>=now}else{e=S.end===null?now:Math.min(S.end,now);atLatest=S.end===null;s=P[2]<0?mm(e,-P[2]):e-P[2]}
return{s,e,atLatest,period:P[0],label:P[1],span:e-s,clamped:false,custom:cu}},
tg=(row,ws,we)=>!row||!row.count?[]:row.path?[row]
:(row.parts||[]).filter(p=>{const h=ds(row.date)+Number(p.hour)*HOUR;return h<we&&h+HOUR>ws}).map(p=>({...p,sealed:row.sealed})),
sh=(t,date)=>{const u=AR+t.path,c=lg(u);if(c)return c.p;
const p=gj(u,t.sealed?'default':'no-cache',1).then(async b=>{const o=b.byteLength>=0?await new Response(b).json():b,s=(window.crypto||0).subtle;
if(!isFC(o)||o.schema!=='uk-lightning-history-day.v1'||!o.metadata||o.metadata.date_utc!==date)E('invalid day file');
// D08 (sha256 needs https)
const bad=[o.features.length!==t.count&&'count',b.byteLength!==t.bytes&&'bytes',s&&[...new Uint8Array(await s.digest('SHA-256',b))].map(x=>(x|256).toString(16).slice(1)).join('')!==t.sha256&&'sha256'].filter(Boolean);
if(bad.length)E('index mismatch: '+bad.join(', '));return o.features}).catch(e=>{lru.delete(u);throw e});
ls(u,{p,sealed:!!t.sealed});return p},
fr=async(rows,ws,we)=>{const jobs=[];for(const row of rows)for(const t of tg(row,ws,we))jobs.push({row,t});const parts=new Array(jobs.length),fl=[];let pos=0;
await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(pos<jobs.length){const i=pos++,{row,t}=jobs[i];try{parts[i]=await sh(t,row.date)}catch(e){parts[i]=[];fl.push({date:row.date,error:msg(e)})}}}));
return{parts,fl,rq:jobs.length}},
ok=f=>f&&f.type==='Feature'&&f.geometry&&f.geometry.type==='Point'&&bx(...[].concat(f.geometry.coordinates))&&f.properties&&f.properties.observation_kind==='optical_lightning_flash'&&isFinite(tm(f)),
co=(parts,ws,we)=>{const m=new Map();let k=0;for(const part of parts)for(const f of part){if(!ok(f)){k++;continue}const t=tm(f);if(t>=ws&&t<we)m.set(String(f.id),f)}const a=[...m.values()].sort((a,b)=>tm(a)-tm(b));a.bad=k;return a},
// tiers
ff=async(w,now,reason)=>{
const f=await(S.fp||(S.fp=gx(FEED).catch(e=>{S.fp=null;throw e})));if(!isFC(f))E('invalid live feed');
const ev=co([f.features],w.s,w.e);
return{mode:'feed',w,idx:null,ie:reason,meta:f.metadata||{},old:w.s<now-7*DAY,ev,fl:[],cs:'live feed',ic:ev.length,cl:ev.length>cap(),cov:null}},
lw=async now=>{const w=wf(now);let x=null,ie=null;try{x=await li()}catch(e){ie=msg(e)}
if(!x)return ff(w,now,ie);
if(w.e<=x.cutoff)return{mode:'overview',w,idx:x,before:true,rows:[],cov:null,fl:[],ev:[],arch:0};
if(w.s<x.cutoff){w.s=x.cutoff;w.span=w.e-w.s;w.clamped=true}
const rows=x.days.filter(y=>{const f=ds(y.date);return f<w.e&&f+DAY>w.s}),known=rows.filter(y=>y.count!==null),
r={mode:'overview',w,idx:x,before:false,rows,arch:known.reduce((n,y)=>n+y.count,0),cov:cv(x,w.s,w.e),fl:[],ev:[],ld:[],sk:[],clp:false};
if(w.span/DAY>31)return r;
let tf=rows.filter(y=>y.count>0),bytes=0,count=0;
for(const row of tf)for(const t of tg(row,w.s,w.e)){count+=t.count||0;bytes+=t.bytes>0?t.bytes:(t.count||0)*530}
if(count>BUDGET||bytes>32e6){if(!S.consent){r.clp=true;r.budget=`${N(count)} flashes, ${N(bytes)} bytes`;return r}
// newest days within both budgets
let run=0,rb=0;tf.sort((a,b)=>b.date.localeCompare(a.date));const keep=[];for(const y of tf){const b=y.bytes>0?y.bytes:y.count*530;if(r.sk.length||run+y.count>BUDGET||rb+b>32e6){r.sk.push(y.date);continue}keep.push(y);run+=y.count;rb+=b}tf=keep;count=run}
r.ld=tf.map(y=>y.date);r.ic=count;r.cs='index';r.cl=count>cap();
const got=await fr(tf,w.s,w.e);r.mode='detail';r.fl=got.fl;r.rq=got.rq;r.ev=co(got.parts,w.s,w.e);return r},
// state machine
cf=(r,now)=>{let st;const rs=[];
if(r.fail){st='FAIL';rs.push(r.fail)}else if(r.before){st='BEFORE-ARCHIVE';rs.push('window entirely before the archive')}
else if(r.fl.length){st='FAIL';rs.push(`${r.fl.length} of ${r.rq} day files failed`)}
else{const c=r.cov,f=c?c.f:0;if(r.mode==='feed'){st=r.ev.length?'PARTIAL':'UNKNOWN';rs.push('feed coverage unknown')}else if(!c||f<=0){st='UNKNOWN';rs.push('0% searched')}
else if(f<0.999){st='PARTIAL';if(c.ny>0)rs.push('tail not yet ingested');if(c.bf>0)rs.push('head before archive start');if(c.u.length)rs.push(`${c.u.length} dates without a scan window`);if(!rs.length)rs.push('gaps inside the window')}
else if(r.mode!=='overview')st=r.ev.length?'READY·DETAIL':'EMPTY-COVERED';else st=r.arch>0?'READY·SUMMARY':'EMPTY-COVERED'}
return{st,stale:stale(r.idx||{gen:Date.parse((r.meta||0).query_end_utc)},now),colour:COLOUR(st),rs}},
// the seven caption templates
cp=(r,now)=>{const w=r.w,x=r.idx,L={window:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER};
L.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(w.e-1)} inclusive = ${T(w.s)} → ${T(w.e)}`:`Window  ${T(w.s)} → ${T(w.e)} (${w.label}${w.atLatest?', latest':', end exclusive'})`;
if(w.clamped)L.window+=' · start clamped to retention start '+x.cutoffDate;
if(r.fail){L.warning=r.ie&&!x?`Archive unavailable: ${r.ie} at ${T(now)} — nothing shown (unknown, not zero)`:r.fail;return L}
if(r.before){L.warning=`Window predates the archive (began ${T(x.covStart)}; retention from ${x.cutoffDate}) — nothing can be shown; not zero lightning`;return L}
const n=r.ev.length,dev=ph()?'phone':'desktop',first=n?`Actual  first ${Ts(tm(r.ev[0]))} · last ${Ts(tm(r.ev[n-1]))}`:'',
drawn=(!n?'':` · ${N(n)} drawn as ${r.cl?'clusters':'points'} (${r.cs} count ${N(r.ic)} ${r.cl?'exceeds':'within'} the ${N(cap())}-point cap for this ${dev})`)+(r.ev&&r.ev.bad?` · ${N(r.ev.bad)} malformed records rejected`:'');
if(r.mode==='feed'){const m=r.meta,P=(k,f=T)=>f(Date.parse(m[k]));
L.refresh=`Refresh live feed ${P('query_end_utc')} (last collection window ${P('query_start_utc')} → ${P('query_end_utc')}; latest detection ${P('latest_detection_utc',Ts)}; 7-day retention; ${NA(r.ie)}: ${r.ie}; earlier hours unknown, not zero)`;
L.searched='Searched EUMETSAT unknown (live feed records only its last collection window)';if(r.old)L.warning=NA(r.ie)+': earlier coverage unknown, not zero';
L.actual=first||'Actual  no flashes in the live feed in this window';L.flashes=`Flashes ${N(n)} in window (live feed, 7-day retention)${drawn}`}
else if(r.mode==='detail'){L.actual=first||'Actual  no archived flashes within this window';
L.flashes=r.sk.length?`Flashes ${N(r.arch)} archived on the overlapping UTC dates (index, whole days) · ${N(n)} downloaded from the newest ${r.ld.length} of ${r.ld.length+r.sk.length} days (budget ${N(BUDGET)} flashes / 32 MB; ${r.sk.length} days not loaded)${drawn}`:`Flashes ${r.fl.length?'at least ':''}${N(n)} archived in window${drawn}`}
else{const o=r.rows.filter(y=>y.first_observation_utc),k=r.rows.length;
L.actual=o.length?`Actual  on the ${k} overlapping UTC dates: first ${Ts(Date.parse(o[0].first_observation_utc))} · last ${Ts(Date.parse(o[o.length-1].last_observation_utc))} (day-level; may lie outside a mid-day window edge)`:`Actual  no archived flashes on the ${k} overlapping UTC dates`;
L.flashes=`Flashes ${N(r.arch)} archived on ${k} overlapping UTC dates · none drawn (summary mode; ${r.clp?`index sum ${r.budget} exceeds the budget; LOAD POINTS draws up to the newest ${N(BUDGET)}`:'choose ≤31 days for points'})`}
if(x)L.refresh=`Refresh archive ${T(x.gen)} (${AGO(now-x.gen)} ago; expected every ${x.iv} h)${stale(x,now)?' · STALE':''}`;
const c=r.cov;if(c){const warn=[];
L.searched=c.f>0?`Searched EUMETSAT ${Math.round(c.f*100)}% of window · ${c.r} successful runs${c.a!==null?` · ${T(c.a)} → ${T(c.b)}`:''}`:'Searched EUMETSAT 0% of window — no collection run covers these dates';
if(c.ny>0)warn.push(`Not yet ingested: last ${AGO(c.ny)} of window (unknown, not zero)`);
if(c.bf>0&&x)warn.push(`Unknown: ${ymd(w.s)} to ${ymd(Math.min(w.e,x.covStart)-1)} precede archive start ${T(x.covStart)} (not zero)`);
if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);
if(r.fl.length)warn.push(`${r.fl.length} of ${r.rq} day files failed (${r.fl.map(f=>f.date+' '+f.error).join(', ')}); points incomplete, counts from index`);
L.warning=warn.join(' · ')}
return L},
// map: one source, one circle layer, hidden until data
mh=()=>{const m=window.__GRIDATLAS_V9_MAP__;return m&&typeof m.addSource==='function'?m:null},
cx=()=>{const m=mh();if(m)try{if(m.getLayer(LAYER))m.removeLayer(LAYER);if(m.getSource(SRC))m.removeSource(SRC)}catch(e){note(e)}S.mode=null},
dw=(fc,cl)=>{const m=mh();if(!m)E('no map');const mode=cl?'cluster':'raw';if(S.mode&&S.mode!==mode)cx();
if(!m.getSource(SRC)){m.addSource(SRC,Object.assign({type:'geojson',data:FC()},cl?{cluster:true,clusterRadius:40,clusterMaxZoom:10}:{}));
m.addLayer({id:LAYER,type:'circle',source:SRC,layout:{visibility:'none'},paint:cl?{'circle-radius':['case',['has','point_count'],['step',['get','point_count'],9,100,13,1000,18,10000,24],3],'circle-color':['case',['has','point_count'],'#ffb000','#ffdf44'],'circle-opacity':0.8}
:{'circle-radius':['interpolate',['linear'],['zoom'],4,2.2,8,4,12,7],'circle-color':'#ffdf44','circle-opacity':0.85}});S.mode=mode}
m.getSource(SRC).setData(fc);m.setLayoutProperty(LAYER,'visibility',fc.features.length?'visible':'none')},
// DOM: shell classes, inline styles on own nodes only
BTN=(a,t,x)=>`<button type="button" class="map-ctrl-btn" ${a}${x||''}>${t}</button>`,NAV=(k,t,x)=>BTN(`data-lightning-nav="${k}"`,t,x),ROW='style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0"',
DATE=k=>`<input type="date" class="search-input" data-lightning-date="${k}" aria-label="${k} date (UTC)" style="width:9.5em;color-scheme:dark">`,
bg=key=>{const g=document.createElement('div');g.className='key-group';g.dataset.lightningGroup=key;
g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-lightning-control="toggle"> <span data-lightning-label="${key}" style="color:#ffdf44">${BASE} [WAIT]</span></label>`
+`<div data-lightning-controls="${key}" hidden><div role="group" ${ROW}>${PERIODS.map(p=>BTN(`data-lightning-period="${p[0]}"`,p[0].toUpperCase())).join('')}</div>`
+`<div class="radius-input-row" data-lightning-custom style="display:none;flex-wrap:wrap;margin:4px 0"><span class="radius-unit">From (UTC)</span>${DATE('from')}<span class="radius-unit">To (incl.)</span>${DATE('to')}${NAV('apply','APPLY')}</div>`
+`<div ${ROW}>${NAV('prev','◀ PREV')}${NAV('latest','LATEST',' disabled')}${NAV('next','NEXT ▶',' disabled')}${NAV('points','LOAD POINTS',' hidden')}</div>`
+`<div class="status-legend" style="border:0;margin:0;padding:2px 0"><div class="status-dot" style="color:#888"><span data-lightning-dot style="background:#888"></span>LOADING</div></div>`
+`<div id="gridatlas-lightning-caption-${key}" data-lightning-caption role="status" aria-live="polite" style="font:10px/1.5 'Courier New',monospace;color:#888;overflow-wrap:anywhere">`
+['window','actual','flashes','refresh','searched','warning','footer'].map(k=>`<div data-cap="${k}"${k==='warning'?' style="color:#ffcc00"':k==='footer'?' style="font-size:9px;color:#888"':''}></div>`).join('')+'</div></div>';
if(ph())g.querySelectorAll('.map-ctrl-btn').forEach(b=>b.style.cssText+='min-height:44px;min-width:44px');
const q=s=>g.querySelector(s),sf={key,group:g,toggle:q('[data-lightning-control]'),label:q('[data-lightning-label]'),ctl:q('[data-lightning-controls]'),custom:q('[data-lightning-custom]'),from:q('[data-lightning-date="from"]'),to:q('[data-lightning-date="to"]'),dot:q('[data-lightning-dot]'),stx:q('.status-dot').lastChild,caps:{},nav:{},chips:{}};
g.querySelectorAll('[data-cap],[data-lightning-nav],[data-lightning-period]').forEach(n=>{const d=n.dataset;if(d.cap)sf.caps[d.cap]=n;else if(d.lightningNav)sf.nav[d.lightningNav]=n;else sf.chips[d.lightningPeriod]=n});
g.addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b||!g.contains(b))return;if(b.dataset.lightningPeriod)sp(b.dataset.lightningPeriod);else if(b.dataset.lightningNav)nv(b.dataset.lightningNav,sf)});
return sf},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},flag=(n,a,on)=>{if(n)on?n.setAttribute(a,''):n.removeAttribute(a)},
lt=(r,c,loading)=>{if(!S.on)return BASE+' [WAIT]';if(loading)return BASE+' [LOAD]';if(!r||c.st==='FAIL')return BASE+' [FAIL]';
const n=r.mode==='overview'?r.arch:r.ev.length;return`${BASE} [${/UNKNOWN|BEFORE/.test(c.st)?'UNKNOWN':n>0?N(n):c.st==='PARTIAL'?'UNKNOWN':'EMPTY'} | ${r.w.period}${c.stale?' STALE':''}]`},
sl=(r,c)=>{const st=c.st,n=r.mode==='overview'?`${N(r.arch)} ARCHIVED`:`${N(r.ev.length)} FLASHES${r.cl?' CLUSTERED':' DRAWN'}`;
return(st.startsWith('READY')?'READY · '+n:st==='EMPTY-COVERED'?'NO FLASHES DETECTED · SEARCHED 100%':st==='PARTIAL'?`PARTIAL · ${n} · SEARCHED ${r.cov?Math.round(r.cov.f*100)+'%':'UNKNOWN'}`:st==='FAIL'?'FAIL · '+c.rs.join('; '):st)+(c.stale?' · STALE':'')},
// one batched repaint
pt=loading=>{const now=Date.now(),r=S.res,c=r?cf(r,now):null,L=r?cp(r,now):null,text=lt(r,c,loading),fail=!!(c&&c.st==='FAIL'),w=r?r.w:null;
for(const sf of S.sfs){if(sf.toggle.checked!==S.on)sf.toggle.checked=S.on;txt(sf.label,text);sf.label.style.opacity=fail?'0.6':'1'}
for(const sf of S.sfs){flag(sf.ctl,'hidden',!S.on);if(!S.on)continue;
for(const k in sf.chips){const b=sf.chips[k];b.setAttribute('aria-pressed',b.classList.toggle('active',k===S.period))}
const cu=S.period==='custom';sf.custom.style.display=cu?'flex':'none';if(S.idx)sf.from.min=sf.to.min=S.idx.cutoffDate;sf.from.max=sf.to.max=ymd(now);if(sf.from.value!==S.from)sf.from.value=S.from;if(sf.to.value!==S.to)sf.to.value=S.to;
sf.nav.prev.disabled=loading||cu||!S.idx||!w||w.s<=S.idx.cutoff;sf.nav.next.disabled=sf.nav.latest.disabled=loading||cu||!w||w.atLatest;flag(sf.nav.points,'hidden',!(r&&r.clp));
sf.dot.style.background=loading?COLOUR('L'):c.colour;txt(sf.stx,loading?'LOADING':sl(r,c));if(!loading)for(const k in L)txt(sf.caps[k],L[k])}
if(r&&!loading)S.last={state:c.st,stale:c.stale,mode:r.mode,period:w.period,drawn:r.ev.length,cluster:!!r.cl,cap:cap(),cap_source:r.cs||null,index_count:r.ic===undefined?null:r.ic,failures:r.fl.length,reasons:c.rs}},
// actions
sp=p=>{S.period=p;S.consent=false;if(p==='custom'&&!S.from)S.from=S.to=ymd(Date.now());ld()},
nv=(which,sf)=>{const now=Date.now(),w=wf(now);S.consent=which==='points';
if(which==='apply'){const f=sf.from.value,t=sf.to.value,good=DRE.test(f)&&DRE.test(t)&&f<=t;sf.from.style.borderColor=sf.to.style.borderColor=good?'':'#ff4444';
if(!good)return txt(sf.caps.warning,'Custom dates: From must not be after To — nothing loaded');S.from=f;S.to=t}
else if(which==='latest'){S.end=null;return ld(true)}else if(which==='prev')S.end=w.s;else if(which==='next'){const e=w.e+w.span;S.end=e>=now-9e5?null:e}
ld()},
ld=refresh=>{const serial=++S.serial,now=Date.now();if(refresh)S.ip=S.fp=null;pt(true);
lw(now).then(r=>({r}),e=>({e})).then(({r,e})=>{if(serial!==S.serial||!S.on)return;
if(e){note(e);r={mode:'fail',fail:msg(e),w:wf(now),idx:S.idx,ie:S.ie,fl:[],ev:[],rows:[],arch:0}}
S.res=r;try{dw(FC(r.ev),!!r.cl)}catch(err){note('draw: '+err.message);r.fail=r.fail||'map layer: '+err.message}pt(false)})},
so=on=>{if(S.on===on)return;S.on=on;
if(on){S.end=null;S.consent=false;S.res=null;
ld(true);if(!S.timer)S.timer=setInterval(()=>{if(S.on&&S.res&&S.res.w.atLatest)ld(true)},6e5)}
else{S.serial++;S.res=null;cx();if(S.timer){clearInterval(S.timer);S.timer=null}pt(false)}},
bt=c=>c.addEventListener('change',ev=>{const t=ev.target;if(t&&t.dataset&&t.dataset.lightningControl==='toggle')so(!!t.checked)}),
// install after menu, Pipeline News and map exist
ins=()=>{if(S.installed)return true;
const M=NS.menuBar,P=window.__GRIDATLAS_PIPELINE_LAYERS__,host=Q('scada-ui-container'),miss=[];
if(!(M&&M.installed===true))miss.push('menuBar');if(!(P&&P.installed))miss.push('pipelineLayers');if(!mh())miss.push('map');if(!host||!host.querySelector('.key-group'))miss.push('groups');S.waiting_for=miss;if(miss.length)return false;
const main=bg('main');main.group.style.paddingBottom='64px';host.appendChild(main.group);bt(host);S.sfs.push(main);
const cur=Q('fs-curtain-keys');if(cur){const fs=bg('fs');cur.appendChild(fs.group);bt(cur);S.sfs.push(fs)}
pt(false);S.installed=true;return true};
if(typeof setInterval==='function'&&typeof MutationObserver==='function'){const ob=new MutationObserver(()=>tick()),poll=setInterval(()=>tick(),250),
tick=()=>{try{if(ins()){clearInterval(poll);ob.disconnect()}}catch(e){note('install: '+msg(e))}};ob.observe(document.documentElement,{childList:true,subtree:true})}
NS.ukLightning=Object.freeze({schema:S.schema,generation:GEN,state:S,install:ins,setOn:so,load:()=>ld(true),windowFor:wf});
})();
