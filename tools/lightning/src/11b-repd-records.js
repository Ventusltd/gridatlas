/// 11b M5: the full REPD record of a listed project (owner, 29 Oct 2026 02:21 UTC: "list all 10 sites, their names and
/// distances and full addresses as per REPD following the pattern from the grid engine").
///
/// Source: the SAME file, read the SAME way, as the engine's own project search (atlas/cartridges/
/// 202609071213-place-global-search-v9-5.js:14-17 and :280-310, whose popup at :413-416 is the card pattern:
/// name, technology, MW, "<address> · <postcode> · <county>", "REPD <ref> · <status>"): the pinned
/// data/repd_projects_202608290716.parquet (REPD July 2026 / Q2 extract, DESNZ, published 3 Aug 2026, OGL v3.0;
/// 11,069 rows, one per REPD ref), queried through the page's shared DuckDB runtime (window.__GRIDATLAS_DUCKDB_RUNTIME__,
/// built by the streaming-parquet bridge, prewarmed after 400 kV), only after the pinned manifest's SHA-256 and its
/// parquet identity check out. Only the listed points are queried, on a tap, with the module's 15 s timeout (TMO);
/// rows are cached per point for the page (S.rc), so a filter press or a re-tap reads the cache.
///
/// The join: the map register (src-repd, April 2026) carries no REPD ref and no address. A register part gets a record
/// only when EXACTLY ONE record has: the same point (each axis within 1e-6°), the same name after whitespace collapse,
/// NFC and the cp1252 C1 repair only, the same MW (both <=0/absent = not stated) and the same REPD technology string.
/// Otherwise the card says "address not in register". A ref or an address is never inferred. Over the whole register
/// this joins 10,503 of 10,784 rows and never gives one record to two rows (suite M5-3; evidence/M5-build).
///
/// Reusable (the offtakers overlay): window.__GRIDATLAS_MODULES__.repdRecords = {source, manifest, records, join, block}:
///   records(points [[lon,lat]]) -> Promise<Map "lon,lat" -> record rows at that point>
///   join(registerProps, point, map) -> record | null (no exact single match) | undefined (not loaded yet)
///   block(registerProps, point, map, error) -> the card block (data-tier="record")
RU='https://ventusltd.github.io/gridatlas/data/repd_projects_202608290716.parquet',RM='https://ventusltd.github.io/gridatlas/data/repd_v9_manifest_202608290716.json',RpE=1.000001e-6,RpP=new WeakMap,
/// RpQ: fetch the record rows at the given points (uncached ones only); the SQL holds only numbers from the register.
/// R() keeps its own timer (R-otsec ORS8): with one shared timer, R(R(runtime).then(connect)) cleared the outer timer
/// when the runtime resolved, so a hung connect() never timed out.
RpQ=async pts=>{let C=S.rc||(S.rc=new Map),ks=RpU(pts.filter(a=>a&&a[0]===+a[0]&&a[1]===+a[1]&&!C.has(a+'')),a=>a+''),k;
  if(ks.length){let w=window.__GRIDATLAS_DUCKDB_RUNTIME__,R=p=>{let t;return Promise.race([p,new Promise((_,j)=>t=setTimeout(()=>j(new Error(TOE)),TMO))]).finally(()=>clearTimeout(t))};
    if(!w)E('the map search runtime has not started; reload the page');
    await R(S.rv||(S.rv=gj(RM,'no-store',1).then(async b=>{let o,h=[...new Uint8Array(await window.crypto.subtle.digest('SHA-256',b))].map(x=>(x|256).toString(16).slice(1)).join('');
      if(h!='8850567ff9f1d2b6996b4e0d9707320030f3466a0b821cdcfc5325322b8be8c8'||(o=JSON.parse(new TextDecoder().decode(b))).parquet.sha256!='174040c37f3d63742d6fdd7af722a8cfdf3fb53de3ff85ff1142d22fdac4866b')E('REPD manifest is not the pinned one')}).catch(e=>{S.rv=0;throw e})));
    k=await R(R(w.promise).then(d=>d.database.connect()));
    try{let r=(await R(k.query(`SELECT * FROM read_parquet('${RU}') WHERE ${ks.map(a=>a.split(',')).map(([x,y])=>`(abs(longitude-(${x}))<=${RpE} AND abs(latitude-(${y}))<=${RpE})`).join(' OR ')}`))).toArray().map(o=>o.toJSON?o.toJSON():o);
      for(let a of ks){let[x,y]=a.split(',');C.set(a,r.filter(o=>Math.abs(o.longitude-x)<=RpE&&Math.abs(o.latitude-y)<=RpE))}}finally{try{k.close()?.catch?.(()=>0)}catch(_){}}}
  return C},
/// RpZ: the name normalisation of the join (whitespace, NFC, cp1252 C1 characters); nothing else.
RpZ=s=>((s||'')+'').replace(/[\x80-\x9f]/g,c=>new TextDecoder('windows-1252').decode(Uint8Array.of(c.charCodeAt()))).normalize('NFC').split(/\s+/).filter(Boolean).join(' '),
/// RpJ: the exact join (see above).
RpJ=(p,a,C)=>{let c=a&&C&&C.get&&C.get(a+''),n=v=>v>0?+v:0;if(!c)return;c=c.filter(o=>RpZ(o.name)==RpZ(p.name)&&Math.abs(n(o.capacity_mw)-n(p.capacity))<1e-6&&o.repd_technology===p.raw_tech);return c.length==1?c[0]:null},
/// RpB: one project's record block in the engine card pattern; missing fields are said, never filled; an operator the
/// record marks as possibly a person (applicant_publication_state != REPD_AS_PUBLISHED) is not shown.
/// M6: a record already cached shows even when a later fetch fails; the failure line is a retry button (RpH).
RpB=(q,a,C,e)=>{let o=RpJ(q,a,C),b=el('div','padding:2px 0 10px 12px;font-size:11px;color:#9fb3ba;overflow-wrap:anywhere'),L=(s,c)=>ap(b,el('div',c,cs(s)));b.dataset.tier='record';
  if(o===void 0)L(e?`REPD record unavailable — tap to retry (${msg(e)})`:'loading REPD record…');else if(!o)L('Record · address not in register (no exact REPD match; no ref shown)');
  else{L([o.repd_address_display||'address not stated',o.repd_postcode||'no postcode',o.county,o.region].filter(Boolean).join(' · '),'color:#c9d6da');
    L(`Record · REPD ${o.repd_ref} · ${o.status}`+(o.status!=q.status?` (map register: ${q.status})`:''));
    L('Operator: '+(o.applicant_publication_state=='REPD_AS_PUBLISHED'&&o.repd_operator_or_applicant||'not shown (may name a person) or not stated'));
    L([o.planning_authority||'planning authority not stated',o.planning_application_reference,o.source_record_updated&&'record updated '+o.source_record_updated].filter(Boolean).join(' · '))}
  return b},
/// RpX: export once, frozen.
RpX=NS.repdRecords||(NS.repdRecords=Object.freeze({source:RU,manifest:RM,records:RpQ,join:RpJ,block:RpB})),
// fill record slots [[div, props]] now from the cache, then again when the rows at their points have arrived
/// M6: the rows never wait: each slot shows "loading REPD record…" at once, then the record, or within 15 s in all
/// (one deadline over manifest, runtime, connect and query) "REPD record unavailable — tap to retry"; a tap retries.
RpH=(c,sl)=>{let t,F=(C,e)=>{clearTimeout(t);///
      if(S.pp==c)for(let[s,q]of sl){s.textContent='';///
        let b=ap(s,RpB(q,RpP.get(q),C,e));///
        if(/^REPD record u/.test(b.textContent)){b.style.cursor='pointer';///
          b.setAttribute('role','button');///
          b.addEventListener('click',()=>RpH(c,sl))}}///
    };F(S.rc);///
    Promise.race([RpQ(sl.map(v=>RpP.get(v[1]))),new Promise((_,j)=>t=setTimeout(()=>j(Error(TOE)),TMO))]).then(F,e=>F(S.rc,e))},
// Area summary (Screening): every row within 40 km, all statuses and technologies, by technology and by status class
/// RpY: the Area summary (V-tiers Screening): every register row within 40 km (all statuses and technologies; the
/// list's filters do not apply), counted and its stated MW summed per technology class and per status class at 10 and
/// 40 km (repeated records of one scheme once; * = some capacities not stated); then the nearest substation per voltage
/// among the card's own 5 (c.k from nr). Counts and distances only.
RpY=(c,box)=>{let h=ap(box,el('div','margin-top:8px;color:#5fbdc2','Area summary · Screening · straight line; all statuses and technologies')),g=ap(box,el('div','display:grid;grid-template-columns:auto auto auto;gap:2px 10px;font-size:11px;color:#c9d6da')),C=s=>ap(g,el('span','',s)),u=0,V=new Map;
  h.dataset.tier=g.dataset.tier='screening';['','≤10 km','≤40 km'].map(C);
  for(let[v,n]of[...RpF.te,...RpF.st])if(v!='all'){let K=d=>{let r=c.rpAll.filter(q=>q.km<=d&&(RpT(q.p.tech)==v||RpS(q.p.status)==v)),w=RpW(r.map(q=>q.p)),z=r.some(q=>!(q.p.capacity>0));u|=z;return r.length+(w>0?' · '+N(w)+' MW':'')+(z?'*':'')},a=K(40);if(a!='0'){C(n);C(K(10));C(a)}}
  for(let s of c.k||[])V.has(s.kv[0])||V.set(s.kv[0],s);
  if(V.size)ap(box,el('div','margin-top:4px;color:#c9d6da;font-size:11px','Nearest per voltage, of the substations above: '+[...V].sort((a,b)=>b[0]-a[0]).map(([v,s])=>`${v} kV ${(+s.km).toFixed(2)} km`).join(' · ')));
  ap(box,el('div','color:#8b9aa1;font-size:11px',(u?'* some capacities not stated: unknown, not zero. ':'')+'Counts and distances only: not capacity, connection feasibility or exposure.'))},
