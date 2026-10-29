/// ---- DC-B1 (#73 steps 7-8): a data-centre tap fires the Grid Engine 30/30/30 (card and map: DC-B2 CARD-SPEC.md) ----
/// Substations: the original link.measure.nearestSubstations returns LINK_COUNT = 5, a closure constant with no limit
/// argument (sld-sandbox 202609241334 :1664, :3513), so the 30 come from the engine's own Grid Finding Scope
/// (__GRIDATLAS_MODULES__.gridScope.scope, same cartridge :45-186: same list link.substations, same geodesy) with its count
/// and its 40 km radius as parameters (DC-B3 ENGINE.md). The original is still called on every tap: its 5 must be the
/// head of the scope's list (else noted in S.errors), and it names the nearest beyond 40 km when none is within.
/// REPD: the same register and grouping as the 15 (RG, near, sites), 30 within 40 km, ties kept.
/// Conventional (owner via lead, 29 Oct 20:05 UTC): ALWAYS the nearest 30, any distance, listed with km; lines are
/// drawn only up to R100 km and the card says so.
VB=[['all','All'],['400','400'],['275','275'],['132','132'],['33','33–66 kV']],
VK=(v,b)=>b=='all'||(b=='400'?v>=399.5:b=='275'?v>=274.5&&v<399.5:b=='132'?v>=131.5&&v<274.5:v<131.5),
LC={s:'#ffccee',r:'#88aa00',v:'#999988'},TC={s:'#ffccee',r:'#c6dd7a',v:'#c9c9bb'},
TB=[['a','Area'],['s','Substations'],['r','REPD'],['v','Conventional']],SN={s:'Substations',r:'REPD sites',v:'Conventional power sites'},
D10=10,KM3=[5,10,20],
DHEAD='A listing or pipeline entry (screening): not a confirmed demand, contract, commitment or connection.',
PN=()=>typeof performance=='object'&&performance.now?performance.now():Date.now(),
RMo=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches===true}catch(_){return false}},
/// the conventional list: the pinned DC-A6 file (read on the first data-centre tap), else the offtakers power-station
/// class without closed or converted stations (and the card says which)
lcv=()=>S.cv||(S.cv=(CVF?gx(CVF,CVFSHA,PCAP).then(o=>(o&&o.type==='FeatureCollection'&&AI(o.features)||E('data check failed (not a feature collection)'),cn(o.features))):Promise.reject(Error('not published')))
 .catch(e=>(S.cve=msg(e),note('conventional: '+S.cve),S.cv=null,{o:S.data.dots.filter(q=>q.k=='b'&&q.t!='cc').map(q=>({id:q.p.id,a:q.a,n:NM(q),op:q.op,f:SUBL(q),te:'',mw:MW(q.p)||null,st:BST[q.t].toLowerCase(),p:q.p})),bad:0,fb:1}))),
CT=v=>(/^(CCGT|OCGT|CHP|EfW)\b/.exec(v.te)||[v.f=='fuel not stated'?'Power site':v.f[0].toUpperCase()+v.f.slice(1)])[0],
KA=v=>(AI(v.kva)?v.kva:[v.kv]).filter(x=>x>0),
/// the site record (DC-B2 §7): IT load and grid connection apart, never summed or derived; unknown is not zero
MWL=w=>w.it!=null&&w.gc!=null?`IT load ${N(w.it)} MW · grid connection ${N(w.gc)} MW`:w.it!=null?`IT load ${N(w.it)} MW · grid connection not stated`:w.gc!=null?`Grid connection ${N(w.gc)} MW · IT load not stated`:'IT load and grid connection not stated',
dcc=(m,r,n=15,o={})=>{let p=r.p,w=DMW(p),c=cd(m,'Data centre','Data centre (screening)',{open:1,hh:1,foot:'Not shown here: electricity use, connection terms, TEC, queue position, consent, viability.'}),h=c.head,dv=c.det,st=DST[r.t],sr=p.sources||[];
 Object.assign(c,{r,tab:o.tab||'a',sh:o.sh||{},vb:o.vb||'all',rst:o.rst||'all'});S.fk=null;c.foot.dataset.tier='screening';
 L(h,`${NM(r)} · ${unk(r.op)?'operator not listed':cs(r.op)}`,'color:#e9dcff;font-weight:bold;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis','record');
 L(h,MWL(w),'color:#9fb3ba;white-space:nowrap;overflow:hidden;text-overflow:ellipsis','record');
 c.tl=tier(ap(h,el('div')),'screening');c.pn=ap(h,el('div'));c.csv=ap(h,el('div'));
 L(dv,DHEAD,'color:#c9b3ff;margin-top:4px');
 if(w.un!=null)L(dv,`Also stated: ${N(w.un)} MW, not said to be IT load or grid connection${(o=>o&&typeof o.label=='string'?' ('+cs(o.label.split('|')[1]||'').trim()+')':'')(p.unclassified_mw||(p.mw_unclassified||[])[0])}; not added to either.`,'color:#9fb3ba','record');
 L(dv,`Status: ${r.dc?st[0].toLowerCase():'not tracked'} · ${cs(p.status_basis||p.status_source_id||(r.dc?'source not stated':'OpenStreetMap listing'))}`,'color:#9fb3ba','record');
 if(r.t!='op')L(dv,'A pipeline entry is not a commitment: plans change, stall or are withdrawn.','color:#9fb3ba');
 L(dv,'IT load is what the computing equipment draws. Grid connection is the import capacity agreed with the network operator, which also covers cooling and losses. Neither is derived from the other here.','color:#8b9aa1');
 if(w.it==null||w.gc==null)L(dv,'Not stated is unknown, not zero.','color:#8b9aa1');
 if(!r.dc||sr.every(s=>/openstreetmap/i.test(s.source||s.dataset||s.name)))L(dv,'Listed in OpenStreetMap; no open IT-load or connection figure found.','color:#8b9aa1');
 let ds=p.dates&&typeof p.dates=='object'?Object.entries(p.dates).filter(([,v])=>typeof v=='string'&&v):[],pr=AI(p.planning_refs)?p.planning_refs:[],qr=AI(p.connection_refs)?p.connection_refs:[];
 if(ds.length)L(dv,'Dates: '+ds.slice(0,6).map(([k,v])=>cs(k).replace(/_/g,' ')+' '+cs(v)).join(' · '),'color:#9fb3ba','record');
 if(pr.length)L(dv,'Planning: '+pr.slice(0,3).map(o=>cs(o&&o.authority)+' '+cs(o&&o.reference)).join('; '),'color:#9fb3ba','record');
 if(qr.length)L(dv,'Connection queue refs: '+qr.slice(0,3).map(cs).join('; ')+' (a queue entry is not a connection)','color:#9fb3ba','record');
 if(AI(p.conflicts)&&p.conflicts.length)L(dv,`${pl(p.conflicts.length,'conflict')} between sources: `+p.conflicts.slice(0,4).map(o=>cs(o&&o.field)).join(', '),'color:#ffc48a','record');
 for(let s of r.dc?sr.slice(0,6):[])L(dv,`Record · ${cs(s.source||s.dataset||s.name)} (${cs(String(s.licence||'licence not stated').split(/,|:/)[0])}${s.licence_status=='unverified'?', licence unverified':''})`,'color:#8b9aa1','record');
 if(AI(p.operator_alternatives)&&p.operator_alternatives.length)L(dv,'Also listed under operator: '+p.operator_alternatives.slice(0,3).map(cs).join('; ')+' (merged by the source as one site; not checked)','color:#ffc48a','record');
 r.dc||L(dv,'Record · '+LIC(r),'color:#8b9aa1','record');
 c.cam=o.cam;c.row=o.row;dg(m,c,n);return c},
/// the three sets; substations and conventional first, REPD when the register is read (retried while the engine loads)
dg=(m,c,n)=>{if(S.pp!==c)return;let[x,y]=c.r.a,Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},subs=Object.hasOwn(Lk,'substations')?Lk.substations:null,GS=NS.gridScope;c.ks=0;
 if(!AI(subs)||!subs.length||typeof M.nearestSubstations!='function'||typeof M.distanceKm!='function'||!GS||typeof GS.scope!='function'){c.ks='Substation data not loaded yet; trying again.';c.sc=[];dt(m,c);nl(m,[x,y]);return n?setTimeout(()=>dg(m,c,n-1),2e3):0}
 let t0=PN(),mp=S.kas===subs?S.kam:(S.kas=subs,S.kam=new Map(subs.map(s=>[s.at,s])));
 try{c.sc=GS.scope([x,y],subs,{bandsKm:[40],nearestCount:subs.length}).nearest;for(let e of c.sc)e.kva=(mp.get(e.at)||{}).kv}catch(e){note('scope: '+msg(e));c.sc=[];c.ks='Substation data unavailable.'}
 try{let o=M.nearestSubstations(x,y,subs);c.by=o.beyondRadiusNearest;if(o.some((a,i)=>!c.sc[i]||a.km!==c.sc[i].km||a.at!==c.sc[i].at))note('scope head differs from nearestSubstations')}catch(e){note('nearest: '+msg(e))}
 c.ms={search:0};dt(m,c);S.pend=(S.pend||0)+1;
 Promise.all([lcv().then(v=>{if(S.pp!==c)return;c.cvs=v;c.cva=v.o.map(q=>({q,km:M.distanceKm(x,y,...q.a)})).sort((a,b)=>a.km-b.km)}),
  typeof M.isProjectTech=='function'?RG(m,M).then(G=>{if(S.pp===c)c.all=near(G,M,x,y)},e=>{c.pe=`REPD projects unavailable: ${msg(e)}. Tap the site again to retry.`;Ru(c,'REPD unavailable',c.pe)}):(c.pe='REPD projects unavailable: the map measure is not loaded yet. Tap the site again.',0)])
 .then(()=>{if(S.pp!==c)return;c.ms.search=+(PN()-t0).toFixed(1);dt(m,c);dl3(m,c);if(c.cam)try{m.jumpTo(c.cam)}catch(_){}else dcam(m,c);
  if(c.row!=null)c.pn.querySelector(`[data-offtakers-row="${c.row}"]`)?.focus?.()}).catch(e=>note('dc: '+msg(e))).finally(()=>S.pend--)},
/// the lists for the chips: substations by voltage band (re-ranked from the whole scope), REPD by status
sets=c=>{c.k=(c.sc||[]).filter(e=>VK(e.kv,c.vb)).slice(0,N3);c.P=c.all?sites(c.all,{st:c.rst,te:'all'},N3).P:null;c.cv=c.cva?c.cva.slice(0,N3):null;
 let D=(v,q)=>q?c.sh[v]?q.length:MN(D10,q.length):0;c.nd={s:D('s',c.k),r:D('r',c.P),v:c.cv?c.cv.slice(0,D('v',c.cv)).filter(o=>o.km<=R100).length:0}},
TBL=(v,q,c)=>v=='a'?'5·10·20 km':v=='s'&&c.ks?'…':v=='r'&&c.pe?'unavailable':!q?'…':!q.length?'none ≤40 km':`${q.length} · ≤${k1(q.at(-1).km)} km`,
/// the tablist (DC-B2 §2): Area · Substations · REPD · Conventional; arrows, Home and End move and select
dt=(m,c)=>{sets(c);let T=c.tl,row=el('div','display:flex;gap:3px;margin:6px 0');T.textContent='';ap(T,row);row.setAttribute('role','tablist');row.setAttribute('aria-label','Data-centre vicinity sets');
 for(let[v,t]of TB){let on=c.tab==v,q={s:c.k,r:c.P,v:c.cv}[v],b=ap(row,el('button',`flex:1;min-width:0;min-height:52px;padding:2px;background:${on?'#1c1430':'#050a12'};border:1px solid ${on?'#b07cff':'#2f5fa8'};border-bottom:3px solid ${v=='a'?'#b07cff':LC[v]};border-radius:3px;color:${on?'#f1e9ff':'#c9d6f2'};font:11px/1.3 monospace;cursor:pointer;text-align:center`));
  ap(b,el('div','',t));ap(b,el('div','color:#9fb3ba',TBL(v,q,c)));b.type='button';b.id='gridatlas-offtakers-dc-tab-'+v;b.setAttribute('role','tab');b.setAttribute('aria-selected',on);b.setAttribute('aria-controls','gridatlas-offtakers-dc-panel');b.tabIndex=on?0:-1;b.dataset.offtakersTab=v;
  b.addEventListener('click',()=>stab(m,c,v))}
 row.addEventListener('keydown',e=>{let i=TB.findIndex(t=>t[0]==c.tab),j={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:3}[e.key];if(j==null)return;e.preventDefault?.();stab(m,c,TB[(j+4)%4][0]);T.querySelector('[aria-selected="true"]')?.focus?.()});
 let P=c.pn;P.textContent='';P.id='gridatlas-offtakers-dc-panel';P.setAttribute('role','tabpanel');P.setAttribute('aria-labelledby','gridatlas-offtakers-dc-tab-'+c.tab);P.dataset.offtakersPanel=c.tab;
 (c.tab=='a'?pa:pls)(m,c,P);dcsv(c);
 c.sm.textContent=`Data centre · ${c.k?pl(c.k.length,'substation'):'…'}, ${c.P?pl(c.P.length,'REPD site'):'…'} within 40 km, ${c.cv?c.cv.length:'…'} conventional listed · details`;cpos()},
stab=(m,c,v)=>{if(S.pp!==c||c.tab==v)return;c.tab=v;dt(m,c);dlab(m,c);let q={s:c.k,r:c.P,v:c.cv}[v];if(q&&q.length)Ra(c,`${SN[v]}: ${c.nd[v]} of ${q.length} shown on the map, nearest ${k2(q[0].km)} km.`)},
/// a row: rank and distance first, a second line, and ▸ (it opens the item's own card; ◀ back returns here)
RW=(P,i,a,b,f,col)=>{let e=tier(ap(P,el('a',`display:block;min-height:44px;padding:9px 0 6px;border-top:1px solid #1d2f52;color:${col};text-decoration:none`)),'screening');ap(e,el('div','',a));ap(e,el('div','color:#9fb3ba',b+' ▸'));e.href='#';e.dataset.offtakersRow=i;e.addEventListener('click',x=>{x.preventDefault?.();f()});return e},
BT=(P,t,f,k)=>{let b=ap(P,el('button','display:block;width:100%;min-height:44px;margin:6px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1.2 monospace;text-align:left;padding:0 10px;cursor:pointer',t));b.type='button';if(k)b.dataset[k]='';b.addEventListener('click',f);return b},
CH=(P,lb,defs,cur,f,k)=>{let row=ap(P,el('div','display:flex;flex-wrap:wrap;gap:4px;margin:6px 0'));row.setAttribute('role','group');row.setAttribute('aria-label',lb);
 for(let[v,t]of defs){let on=cur==v,b=ap(row,el('button',`min-height:44px;min-width:44px;padding:0 8px;background:${on?'#2f5fa8':'#050a12'};border:1px solid #2f5fa8;border-radius:3px;color:${on?'#e8eef9':'#8fb4ff'};font:11px/1 monospace;cursor:pointer`,t));b.type='button';b.dataset[k]=v;b.setAttribute('aria-pressed',on);b.addEventListener('click',()=>{if(cur!=v)f(v)})}},
/// re-open state for ◀ back: tab, reveal, chips, camera and the row that opened the item
rst=(m,c,i)=>{let cam;try{let z=m.getCenter&&m.getCenter();cam=z&&{center:[z.lng,z.lat],zoom:m.getZoom()}}catch(_){}c.re=()=>dcc(m,c.r,0,{tab:c.tab,sh:c.sh,vb:c.vb,rst:c.rst,cam,row:i})},
pls=(m,c,P)=>{let v=c.tab,q={s:c.k,r:c.P,v:c.cv}[v],nn=q?c.sh[v]?q.length:MN(D10,q.length):0,X=(t,s)=>L(P,t,'color:'+(s||'#9fb3ba'));
 if(v=='s'&&c.ks)return X(c.ks);if(v=='r'&&c.pe)return X(c.pe);if(!q)return X(`${SN[v]}: loading…`);
 if(v=='s'){X(`Screening · ${pl(q.length,'nearest substation')} ≥33 kV (straight line)`,TC.s);CH(P,'Voltage band',VB,c.vb,b=>{c.vb=b;dt(m,c);dl3(m,c)},'offtakersVolt')}
 if(v=='r'){let n=q.reduce((s,g)=>s+g.parts.length,0);X(`Screening · ${pl(q.length,'nearest REPD site')}${n>q.length?` (${N(n)} projects; those at one point grouped)`:''}, straight line`,TC.r);CH(P,'REPD status filter',RpF.st,c.rst,b=>{c.rst=b;dt(m,c);dl3(m,c)},'offtakersRepdFilter')}
 if(v=='v'){let d=q.filter(o=>o.km<=R100).length;X(`Screening · ${pl(q.length,'nearest conventional power site')}, straight line`,TC.v);X(`Lines drawn for ${d} of ${q.length} (≤${R100} km); the nearest ${N3} are listed at any distance${q.length?`, out to ${k1(q.at(-1).km)} km`:''}.`);
  if(c.cvs&&c.cvs.fb)X(`From the offtakers power-station class (the conventional dataset is not loaded: ${S.cve}).`,'#ffc48a')}
 else if(q.length<N3){if(q.length)X(`Only ${q.length} ${v=='s'?'substations ≥33 kV':'REPD sites'} within ${R40} km of this site${v=='s'&&c.vb!='all'||v=='r'&&c.rst!='all'?' for this filter':''}; all are listed.`);
  else X(`None within ${R40} km.`+(v=='s'&&c.by?` Nearest: ${cs(c.by.name||'unnamed substation')}, ${k2(c.by.km)} km (not drawn).`:''))}
 q.slice(0,nn).forEach((o,i)=>{let g=v=='r'&&o,s=v=='s'&&o,w=v=='v'&&o.q,p0=g&&g.parts[0],one=g&&g.parts.length==1,ka=s&&KA(s);
  v=='s'?RW(P,i,`${i+1}. ${k2(s.km)} km · ${s.kv} kV · ${cs(s.name||'unnamed substation')}`,`${ka.length>1?'also '+ka.filter(x=>x!=s.kv).join(', ')+' kV':'single voltage'} · OSM`,()=>{rst(m,c,i);sk(m,c,'s',s)},TC.s)
  :v=='r'?RW(P,i,`${i+1}. ${k2(g.km)} km · ${RpU(g.parts,RpN).sort().join(' + ')}${RpMW(RpW(g.parts))} · ${one?cs(p0.status):g.parts.length+' projects'}`,`${one?cs(p0.name):g.parts.map(q=>cs(q.name)).join('; ')}${RpC(g.parts)}`,()=>{rst(m,c,i);pv(m,c,g,'◀ back to data centre')},TC.r)
  :RW(P,i,`${i+1}. ${k2(o.km)} km · ${cs(w.te||w.f)} · ${w.mw?N(w.mw)+' MW':'MW not stated'} · ${w.st}`,`${w.n} · ${cs(String(((w.p.sources||[])[0]||{}).name||'source not stated').split(' ')[0])}${/clos|convert/.test(w.st)?' · no connection rights implied':''}${o.km>R100?' · not drawn':''}`,()=>{rst(m,c,i);sk(m,c,'v',w,o.km)},TC.v)});
 if(q.length>D10)BT(P,c.sh[v]?'Show nearest 10 only':`Show all ${q.length} on the map and in this list`,()=>{c.sh[v]=!c.sh[v];dt(m,c);dl3(m,c);c.sh[v]&&dcam(m,c,v);P.querySelector('[data-offtakers-reveal]')?.focus?.();Ra(c,`${SN[v]}: ${c.nd[v]} of ${q.length} shown on the map.`)},'offtakersReveal');
 L(P,v=='s'?'Mapped substations (OpenStreetMap, ODbL 1.0). Not capacity, headroom or a connection point.':v=='r'?'REPD (DESNZ, OGL v3.0). Status as registered, not as built. MW is installed capacity as registered, not export or connection capacity.'
  :`${c.cvs&&!c.cvs.fb?'UK conventional power assets (NAEI 2023 OGL v3.0, GPPD v1.3.0 CC BY 4.0, OpenStreetMap ODbL 1.0)':'NAEI 2023, GPPD v1.3.0, OpenStreetMap'}. MW is installed capacity as stated by the source, not export or connection capacity. Proximity to a power station is not access to its output or its grid connection.`,'margin-top:6px;color:#8b9aa1','record')},
/// the Area tab (DC-B2 §5): counts and stated MW in 5, 10 and 20 km circles from the full scans (never capped at 30)
pa=(m,c,P)=>{let g=ap(P,el('div','display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:1px 8px;margin-top:6px;font-size:11px;color:#c9d6da;text-align:right')),C=(s,l)=>ap(g,el('span',l?'text-align:left':'',s)),sc=c.sc||[],al=c.all,cv=c.cva,
  W3=f=>KM3.map(f),R=(l,f,on)=>{C(l,1);for(let d of KM3)C(on?f(d):'…')},rw=d=>al.filter(q=>q.km<=d).map(q=>q.p),cw_=d=>cv.filter(o=>o.km<=d),Mw=v=>v>0?N(v)+' MW':'–';
 g.dataset.tier='screening';C('Within (straight line)',1);W3(d=>C(d+' km'));
 R('Substations ≥33 kV',d=>sc.filter(e=>e.km<=d).length,!c.ks);R('  of which ≥275 kV',d=>sc.filter(e=>e.km<=d&&e.kv>=274.5).length,!c.ks);
 R('REPD projects',d=>rw(d).length,!!al);R('  MW stated',d=>Mw(RpW(rw(d))),!!al);R('  not stated',d=>rw(d).filter(p=>!(p.capacity>0)).length,!!al);
 R('Conventional sites',d=>cw_(d).length,!!cv);R('  MW stated',d=>Mw(cw_(d).reduce((s,o)=>s+(o.q.mw||0),0)),!!cv);R('  not stated',d=>cw_(d).filter(o=>!o.q.mw).length,!!cv);
 if(al)L(P,'REPD at 20 km: '+RpF.st.slice(1).map(([v,t])=>`${t.toLowerCase()} ${Mw(RpW(rw(20).filter(p=>RpS(p.status)==v)))}`).join(' · '),'color:#c9d6da;margin-top:4px');
 if(cv){let a=cw_(20),s=f=>Mw(a.filter(o=>f.test(o.q.st)).reduce((t,o)=>t+(o.q.mw||0),0));L(P,`Conventional at 20 km: operating ${s(/^operat/)} · closing/closed ${s(/clos/)}`,'color:#c9d6da')}
 for(let[b]of VB.slice(1)){let e=sc.find(e=>VK(e.kv,b));L(P,`Nearest ${b=='33'?'33–66':b} kV `+(e?`${k2(e.km)} km · ${cs(e.name||'unnamed substation')}`:`none ≤${R40} km`),'color:#ffccee')}
 for(let v of'srv')L(P,`${{s:'━',r:'╍',v:'┈'}[v]} ${SN[v]} (${{s:'rose, solid',r:'olive, dashed',v:'grey, dotted'}[v]})`,'color:'+TC[v]);L(P,'◯ 5 · 10 · 20 km rings','color:#8b9aa1');
 for(let t of['Counts within straight-line circles around the site point. Not cable routes, capacity, headroom or connection offers.','MW is installed capacity as each register states it, not export or connection capacity. Generation MW is never added to the site\'s MW.','Not stated is unknown, not zero.'])L(P,t,'color:#8b9aa1;margin-top:4px');
 let n=(c.k||[]).length+(c.P||[]).length+(c.cv||[]).filter(o=>o.km<=R100).length;if(n>c.nd.s+c.nd.r+c.nd.v)BT(P,`Draw all ${n} links`,()=>{c.sh={s:1,r:1,v:1};dt(m,c);dl3(m,c);dcam(m,c,'s')},'offtakersDrawAll')},
/// the camera (DC-B2 §6): ease to the site at the zoom that fits radius r in the free band above the card; r0 = the 10th
/// substation, the 10th REPD site or the nearest conventional site, whichever is farther (2 to 40 km); after "Show all"
/// it may widen to that set's farthest drawn item; never inside another move. An offset, not padding: MapLibre keeps an
/// easeTo padding for every later camera move of the page
dcam=(m,c,v)=>{try{let C=m.getContainer(),Wd=C.clientWidth||393,H=C.clientHeight||852,B=(c.bb||8)+(c.offsetHeight||188)+24,f=(q,i)=>q&&q.length?q[MN(i,q.length-1)].km:0,
  r=MX(f(c.k,D10-1),f(c.P,D10-1),f(c.cv,0));if(v){let q={s:c.k,r:c.P,v:(c.cv||[]).filter(o=>o.km<=R100)}[v];r=MX(r,f(q,99))}r=MN(R40,MX(2,r));
  let hs=MX(40,MN(Wd-80,H-150-B)/2),z=MX(7.5,MN(13,Math.log2(78271.517*Math.cos(c.r.a[1]*Math.PI/180)*hs/(r*1e3)))),go=()=>{cm(m);m.easeTo({center:c.r.a,zoom:z,offset:[0,(150-MN(B,H-200))/2],duration:RMo()?0:900})};
  m.isMoving&&m.isMoving()?m.once('moveend',go):go()}catch(e){note('camera: '+msg(e))}},
/// the links (DC-B2 §6): one line source and one node source for the three sets, rings at 5/10/20 km, the azure pin;
/// a set draws its nearest 10 (all after "Show all"), conventional only up to R100 km; S.perf = links and ms
dl3=(m,c)=>{let o=c.r.a,t0=PN(),F=[],G=[],Z=(a,b)=>['interpolate',['linear'],['zoom'],6,a,12,b],I=s=>['==',['get','s'],s],
  add=(s,a,i,km,l)=>{F.push({type:'Feature',properties:{s,k:i},geometry:{type:'LineString',coordinates:[o,a]}});G.push({type:'Feature',properties:{s,k:i,id:s+i,l,km},geometry:{type:'Point',coordinates:a}})};
 c.k.slice(0,c.nd.s).forEach((e,i)=>add('s',e.at,i,e.km,`${e.kv} kV · ${k2(e.km)} km`));(c.P||[]).slice(0,c.nd.r).forEach((g,i)=>add('r',g.a,i,g.km,`${RpU(g.parts,RpN).sort()[0]}${RpMW(RpW(g.parts))} · ${k2(g.km)} km`));
 (c.cv||[]).slice(0,c.sh.v?N3:D10).forEach((v,i)=>v.km<=R100&&add('v',v.q.a,i,v.km,`${CT(v.q)}${v.q.mw?' '+N(v.q.mw)+' MW':''} · ${k2(v.km)} km`));c.G=G;
 try{if(m.getSource(DS[0])){m.getSource(DS[0]).setData(FC(F));m.getSource(DS[1]).setData(FC(G))}else{nl(m,o);let K=Math.cos(o[1]*Math.PI/180);
  m.addSource(DS[0],{type:'geojson',data:FC(F)});m.addSource(DS[1],{type:'geojson',data:FC(G)});
  m.addSource(DS[2],{type:'geojson',data:FC(KM3.map(d=>({type:'Feature',properties:{l:d+' km'},geometry:{type:'LineString',coordinates:Array.from({length:65},(_,i)=>[o[0]+d/111.32/K*Math.sin(i*Math.PI/32),o[1]+d/111.32*Math.cos(i*Math.PI/32)])}})))});
  m.addLayer({id:DI[0],type:'line',source:DS[2],paint:{'line-color':'#8b9aa1','line-opacity':.45,'line-width':1,'line-dasharray':[3,3]}});
  m.addLayer({id:DI[1],type:'line',source:DS[0],paint:{'line-color':['match',['get','s'],'s',LC.s,'r',LC.r,LC.v],'line-width':Z(4,9),'line-opacity':.1,'line-blur':Z(2,6)},layout:{'line-cap':'round'}});
  [['s',null],['r',[2,2]],['v',[.5,2]]].forEach(([s,d],j)=>m.addLayer({id:DI[2+j],type:'line',source:DS[0],filter:I(s),paint:Object.assign({'line-color':LC[s],'line-width':Z(1,2),'line-opacity':.7},d?{'line-dasharray':d}:{}),layout:{'line-cap':'round'}}));
  m.addLayer({id:DI[5],type:'circle',source:DS[1],paint:{'circle-radius':Z(2.5,4.5),'circle-color':['case',I('v'),'rgba(0,0,0,0)',['match',['get','s'],'s',LC.s,LC.r]],'circle-stroke-width':['case',I('v'),2,1],'circle-stroke-color':['case',I('v'),LC.v,'#000']}});
  try{m.addLayer({id:DI[6],type:'symbol',source:DS[1],filter:['in',['get','id'],['literal',[]]],layout:{'text-field':['get','l'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-allow-overlap':false,'symbol-sort-key':['get','k'],'text-font':sf(m)},paint:{'text-color':['match',['get','s'],'s',TC.s,'r',TC.r,TC.v],'text-halo-color':'#000c10','text-halo-width':1.5}});
   m.addLayer({id:DI[7],type:'symbol',source:DS[2],layout:{'text-field':['get','l'],'text-size':10,'text-font':sf(m)},paint:{'text-color':'#8b9aa1','text-halo-color':'#000c10','text-halo-width':1.5}})}catch(e){note('labels: '+msg(e))}}
  dlab(m,c)}catch(e){note('links: '+msg(e))}
 top();S.perf={links:F.length,ms:+(PN()-t0).toFixed(1),search_ms:c.ms&&c.ms.search}},
/// labels (DC-B2 §6): the open tab's set only, ranks 1-3 plus the nearest drawn 400/275/132 kV (substations) or the
/// largest stated MW (REPD, conventional), at most 6; the Area tab: rank 1 of each set; a tab press is one setFilter and
/// paint opacities (selected 0.9, others 0.3, Area 0.7), no source rebuild
dlab=(m,c)=>{let t=c.tab,G=c.G||[],ids=t=='a'?['s0','r0','v0']:G.filter(f=>f.properties.s==t&&f.properties.k<3).map(f=>f.properties.id);
 if(t=='s')for(let b of['400','275','132']){let i=(c.k||[]).slice(0,c.nd.s).findIndex(e=>VK(e.kv,b));i>2&&ids.push('s'+i)}
 if(t=='r'||t=='v'){let q=(t=='r'?(c.P||[]).map(g=>RpW(g.parts)):(c.cv||[]).map(o=>o.km<=R100?o.q.mw||0:0)).slice(0,t=='r'?c.nd.r:c.sh.v?N3:D10),i=q.indexOf(MX(0,...q));q[i]>0&&i>2&&ids.push(t+i)}
 try{m.getLayer(DI[6])&&m.setFilter(DI[6],['in',['get','id'],['literal',ids.slice(0,6)]]);for(let[j,s]of['s','r','v'].entries())m.getLayer(DI[2+j])&&m.setPaintProperty(DI[2+j],'line-opacity',t=='a'?.7:t==s?.9:.3)}catch(e){note('labels: '+msg(e))}},
/// a substation's or a conventional site's own card: its record; for a substation, its 5 nearest REPD sites; for a power
/// site, its 5 nearest substations (the original nearestSubstations); ◀ back restores the data-centre card as it was
sk=(m,c,t,v,km)=>{let back=c.re,o=t=='s'?v.at:v.a,[x,y]=o,Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},p=v.p||{};pc();
 let d=cd(m,t=='s'?'Substation':'Conventional power site',t=='s'?`Substation · ${v.kv} kV`:`Power site · ${cs(v.te||v.f)}`,{open:1,foot:NOTSHOWN,back:['◀ back to data centre',()=>{pc();back()}]}),X=(s,col,ti)=>L(d.det,s,'margin-top:4px;color:'+(col||'#9fb3ba'),ti);
 d.sm.textContent=`${k2(t=='s'?v.km:km)} km from ${NM(c.r)} (straight line) · details`;S.fk=[o];nl(m,o);
 if(t=='s'){X(`${cs(v.name||'unnamed substation')} · ${KA(v).join(', ')} kV${v.operator?' · operator '+cs(v.operator):''}`,TC.s,'record');X('Record · OpenStreetMap as loaded by the map (ODbL 1.0). Not capacity, headroom or a connection point.','#8b9aa1','record');
  RG(m,M).then(G=>{if(S.pp!==d)return;let P=sites(near(G,M,x,y),{st:'all',te:'all'},5).P;X('Screening · 5 nearest REPD sites to this substation, straight line. Not its connections.',TC.r);
   P.forEach((g,i)=>X(`${i+1}. ${RpG(g)}${RpC(g.parts)} · ${cs(g.parts[0].status)} · ${cs(g.parts[0].name)}`,'#c9d6da'));S.fk=[o,...P.map(g=>g.a)];nl(m,o,null,P);ck()}).catch(e=>X('REPD projects unavailable: '+msg(e)))}
 else{X(`${v.n} · ${unk(v.op)?'operator not listed':cs(v.op)}`,TC.v,'record');X(`${v.f} · ${cs(v.te||'type not stated')} · ${v.mw?N(v.mw)+' MW installed (as stated; not connection capacity)':'MW not stated (unknown, not zero)'}`,0,'record');
  X(`Status: ${v.st}${p.status_basis?' · '+cs(p.status_basis):''}`,0,'record');X('Record · '+((p.sources||[]).map(s=>`${cs(String(s.name||'').split(' (')[0])} (${cs(String(s.licence||'licence not stated').split(/[:,]/)[0])})`).join(' · ')||'source not stated'),'#8b9aa1','record');
  let k=[];try{k=AI(Lk.substations)&&Lk.substations.length?M.nearestSubstations(x,y,Lk.substations):[]}catch(e){note('nearest: '+msg(e))}
  X('Screening · nearest substations to this site, straight line. Not its declared connection or capacity.',TC.s);for(let a of k)X(`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'#c9d6da');S.fk=[o,...k.map(a=>a.at)];try{nl(m,o,k)}catch(e){note('links: '+msg(e))}}
 cpos();nz(m,x,y);d.querySelector('[data-offtakers-back]')?.focus?.()},
/// the vicinity sheet (DC-B2 §8): every listed row of the three sets, whatever is drawn; REPD records joined at the click
/// (15 s at most; the export never waits longer); 400 rows and 256 kB at most; cells through cq() (no formulas)
dcsv=c=>{c.csv.textContent='';let n=(c.k||[]).length+(c.P||[]).reduce((s,g)=>s+g.parts.length,0)+(c.cv||[]).length,b=BT(c.csv,`Download all ${n} as CSV (vicinity sheet)`,()=>{if(b.busy)return;b.busy=1;b.textContent='Preparing… (joining REPD records)';
  let ps=(c.P||[]).flatMap(g=>g.parts),T,go=()=>{clearTimeout(T);if(!b.busy)return;b.busy=0;b.textContent=`Download all ${n} as CSV (vicinity sheet)`;
   try{let u=URL.createObjectURL(new Blob([dsv(c)],{type:'text/csv'})),a=el('a');a.href=u;a.download=`datacentre-vicinity-${GEN}-${String(c.r.p.id||'site').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)}.csv`;ap(document.body,a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4e3)}catch(e){note('csv: '+msg(e))}};
  T=setTimeout(go,TMO);RpQ(ps.map(q=>RpP.get(q))).then(go,go)},'offtakersCsv')},
dsv=c=>{let r=c.r,[x,y]=r.a,w=DMW(r.p),M=v=>v==null?'not stated':v,J=q=>S.rc&&RpJ(q,RpP.get(q),S.rc)||null,id=r.p.id||'',sl=r.dc?DST[r.t][0]:'not tracked',rows=[
  ['data centre',0,NM(r),id,'data centre',sl,'','',M(w.it),'IT load',0,x,y,'site',r.dc?'data-centre dataset':'OpenStreetMap','ODbL 1.0','']];
 if(w.gc!=null)rows.push(['data centre',0,NM(r),id,'data centre',sl,'','',w.gc,'grid connection',0,x,y,'site','data-centre dataset','ODbL 1.0','']);
 (c.k||[]).forEach((e,i)=>rows.push(['substation',i+1,e.name||'unnamed substation','',e.kv+' kV','',e.kv,KA(e).join(';'),'','',k2(e.km),e.at[0],e.at[1],i<c.nd.s?'yes':'no','OpenStreetMap as loaded by the map','ODbL 1.0','not carried']));
 (c.P||[]).forEach((g,i)=>{for(let q of g.parts){let o=J(q),a=RpP.get(q)||g.a;rows.push(['REPD project',i+1,q.name,o?o.repd_ref:'',q.raw_tech||q.tech,q.status,'','',q.capacity>0?+q.capacity:'not stated','installed (REPD)',k2(g.km),a[0],a[1],i<c.nd.r?'yes':'no',o?'REPD (DESNZ) Jul 2026 extract, exact match':'REPD (DESNZ) Apr 2026 map register','OGL v3.0',o?(o.source_record_updated||'record date not stated'):'Apr 2026 extract'])}});
 (c.cv||[]).forEach(({q,km},i)=>rows.push(['conventional',i+1,q.n,q.id||q.p.id||'',`${q.f} ${q.te}`.trim(),q.st,'','',q.mw||'not stated',`installed (${q.mw?'GPPD':'not stated'})`,k2(km),q.a[0],q.a[1],km<=R100&&i<(c.sh.v?N3:D10)?'yes':'no',(q.p.sources||[]).map(s=>String(s.name||'').split(' (')[0]).join('; ')||'not stated',(q.p.sources||[]).map(s=>String(s.licence||'').split(/[:,]/)[0]).join('; ')||'licence not stated',cs(q.p.status_date||'')]));
 let s=[`# GridAtlas data-centre vicinity sheet · generation ${GEN} · site ${id} ${NM(r).replace(/[\r\n]/g,' ')} · point ${x},${y} · ${new Date().toISOString()}`,'# Straight-line distances from the site point. Not cable routes, capacity, headroom, connection offers or feasibility.',
  `# Site: IT load ${w.it!=null?w.it+' MW':'not stated'} · grid connection ${w.gc!=null?w.gc+' MW':'not stated'}. Never added together. A pipeline entry is not a commitment.`,'# MW columns are installed capacity as each source states it, not export or connection capacity. "not stated" is unknown, not zero.',
  'set,rank,name,ref,type_or_voltage,status,kv_max,kv_all,mw_stated,mw_basis,km_straight_line,lon,lat,drawn_on_map,source,licence,data_date'].join('\n')+'\n',k=0;
 for(let o of rows){let l=o.map(cq).join(',')+'\n';if(++k>400||s.length+l.length>256e3){s+=`# truncated at ${k>400?'400 rows':'256 kB'}\n`;break}s+=l}return s},
