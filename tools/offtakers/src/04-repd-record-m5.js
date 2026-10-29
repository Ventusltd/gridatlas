/// 04 the full REPD record of a listed project: M5-build's exact join (RU..RpB), copied byte for byte from the built M5 module
/// (evidence/M5-build/tools/build-M5.mjs; tests/offtakers.test.mjs T8 compares it with M5_MODULE). Do not edit it here: re-copy it.
/// One deliberate difference (R-otsec ORS8): R() keeps its own timer; the same fix is due in tools/lightning/src/11b-repd-records.js.
/// ---- M5-build's exact REPD record join, copied unchanged (evidence/M5-build/tools/build-M5.mjs) ----
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
  if(e)L('REPD record unavailable — tap the site again to retry ('+msg(e)+')');else if(o===void 0)L('REPD record: loading…');else if(!o)L('Record · address not in register (no exact REPD match; no ref shown)');
  else{L([o.repd_address_display||'address not stated',o.repd_postcode||'no postcode',o.county,o.region].filter(Boolean).join(' · '),'color:#c9d6da');
    L(`Record · REPD ${o.repd_ref} · ${o.status}`+(o.status!=q.status?` (map register: ${q.status})`:''));
    L('Operator: '+(o.applicant_publication_state=='REPD_AS_PUBLISHED'&&o.repd_operator_or_applicant||'not shown (may name a person) or not stated'));
    L([o.planning_authority||'planning authority not stated',o.planning_application_reference,o.source_record_updated&&'record updated '+o.source_record_updated].filter(Boolean).join(' · '))}
  return b},
/// sites: register rows within 40 km (exact duplicate rows once), filtered by the chips, grouped within about 10 m; the 15 nearest, ties at the 15th kept
sites=(all,f)=>{let sel=all.filter(r=>(f.st==='all'||RpS(r.p.status)===f.st)&&(f.te==='all'||RpT(r.p.tech)===f.te)),gs=[];
 for(let r of[...sel].sort((a,b)=>a.km-b.km)){let g=gs.find(g=>Math.abs(g.a[0]-r.a[0])<2e-4&&Math.abs(g.a[1]-r.a[1])<1e-4);if(!g)gs.push(g={a:r.a,km:r.km,parts:[]});g.parts.push(r.p)}
 return{sel,P:gs.filter((g,i,a)=>i<NR||g.km==a[NR-1].km)}},
near=(G,M,x,y)=>{let all=[],seen=new Set;for(let[a,p]of G){let km=M.distanceKm(x,y,...a);if(km<=R40){let k=a+JSON.stringify(p);if(!seen.has(k)){seen.add(k);RpP.set(p,a);all.push({a,p,km})}}}return all},
