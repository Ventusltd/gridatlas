/// ---- a tap on a site ----
oc=(m,r,n=15)=>{let[x,y]=r.a,p=r.p,c=cd(m,'Potential offtaker',HEAD),h=c.head,w=MW(p),bd=p.emission_band_naei_2023,rc=p.records||[],naei=rc.some(q=>q.source==='NAEI');c.r=r;c.re=()=>oc(m,r,0);S.fk=[r.a];
 L(h,`${NM(r)} · ${OP(r)} · ${SUBL(r)}`,'color:#f3e6da;font-weight:bold;margin-top:6px','record');
 L(h,(w?`${N(w)} MW installed (GPPD, DUKES-derived; installed, not connection capacity)`+(bd?' · ':''):'')+(bd?`Emission band ${cs(bd)} CO2e a year, NAEI 2023 (band only, approximate)`:w?'':'No NAEI 2023 emission band'),'color:#9fb3ba','record');
 if(p.class==='B'||p.status_date){let st=cs(p.status).replace(/^status /,''),sd=cs(p.status_date||'');L(h,`Status: ${st}${sd&&!st.includes(sd)?' '+sd:''}${p.status_source?' · source '+cs(p.status_source):''}`,'color:#9fb3ba','record')}
 if(r.t==='cl'||r.t==='cc')L(h,(r.t==='cl'?'Closing station':/^converted/i.test(p.status)?'Converted station (it may still generate on another fuel)':'Closed station')+': no grid connection, TEC or connection rights are implied.','color:#9fb3ba');
 c.smb=`${CLS[r.k][0]} · ${SUBL(r)}${rc.length>1?` · ${rc.length} records merged`:''}`;c.sm.textContent=c.smb+' · details';
 let dv=c.det;L(dv,p.class==='B'?`Listed as a power producer${naei?' (NAEI 2023)':''}. Not a measure of its electricity use.`:`On-site combustion: ${cs(p.onsite_combustion_indicator||'unknown')}.${naei?' Source NAEI 2023.':''} Not on-site generation capacity.`,'color:#c9d6da;margin-top:4px','record');
 if(rc.length>1)L(dv,`${rc.length} records merged: `+rc.map(q=>`${unk(q.name)?'name not listed':cs(q.name)} (${cs(q.source)}${q.mw?', '+N(q.mw)+' MW':''})`).join('; '),'color:#9fb3ba','record');
 L(dv,'Record · '+LIC(r),'color:#8b9aa1','record');
 let oc_=p.osm_corroboration||[],ds=S.data.dots.filter(q=>q!==r&&q.k!=r.k&&hv(r.a,q.a)<=.3).sort((a,b)=>hv(r.a,a.a)-hv(r.a,b.a)).slice(0,3);
 if(oc_.length)L(dv,'Also mapped in OpenStreetMap nearby: '+oc_.slice(0,4).map(q=>unk(q.name)?'name not listed':cs(q.name)).join('; '),'color:#c9d6f2;margin-top:4px','discovery');
 if(ds.length)L(dv,'Also listed within 300 m: '+ds.map(q=>`${NM(q)} (${CLS[q.k][0]}, ${SUBL(q)})`).join('; '),'color:#c9d6f2;margin-top:4px','discovery');
 if(oc_.length||ds.length)L(dv,'Discovery · nearby listing, not checked to be the same site','color:#8b9aa1','discovery');
 L(dv,'Discovery · listed site, not a confirmed electricity user','color:#8b9aa1','discovery');
 c.area=ap(dv,el('div'));L(dv,SCR,'color:#8b9aa1;margin-top:4px');c.box=ap(dv,el('div'));c.sub=ap(dv,el('div','margin-top:6px'));c.csv=ap(dv,el('div'));
 c.pd=L(c.box,'REPD projects: loading…','margin-top:4px');Ra(c,c.sm.textContent);
 sb(m,c,x,y,n);return c},
/// substations (5 nearest, the original measure) and then the REPD register; retried while the engine data is still loading
sb=(m,c,x,y,n)=>{if(S.pp!==c)return;let Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},subs=Object.hasOwn(Lk,'substations')?Lk.substations:null;c.sub.textContent='';
 if(!AI(subs)||!subs.length||typeof M.nearestSubstations!=='function'){L(c.sub,'Substation data not loaded yet; trying again.');nl(m,[x,y]);return n?setTimeout(()=>sb(m,c,x,y,n-1),2e3):0}
 let k;try{k=c.k=M.nearestSubstations(x,y,subs)}catch(e){note('nearest: '+msg(e));L(c.sub,'Substation data unavailable.');k=c.k=[]}
 L(c.sub,`Screening · ${k.length} nearest substations, straight line. Not capacity or connection feasibility.`,'color:#5fbdc2');
 if(!k.length){let b=k.beyondRadiusNearest;L(c.sub,`No substation within ${k.radiusKm||40} km`+(b?` (nearest: ${cs(b.name||'unnamed substation')}, ${KV(b)} kV, ${k2(b.km)} km)`:''))}
 for(let a of k)L(c.sub,`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'color:#c9d6da');
 S.fk=[[x,y],...k.map(a=>a.at)];nl(m,[x,y],k);cpos();nz(m,x,y);
 if(typeof M.distanceKm!='function'||typeof M.isProjectTech!='function'){c.pd.textContent='REPD projects unavailable: the map measure is not loaded yet. Tap the site again.';return}
 RG(m,M).then(G=>{if(S.pp!==c)return;c.all=near(G,M,x,y);c.fk0=S.fk.slice();rr(m,c)}).catch(e=>{if(S.pp!==c)return;c.pd.textContent=`REPD projects unavailable: ${msg(e)}. Tap the site again to retry.`;Ru(c,'REPD unavailable',c.pd.textContent)})},
/// area summary within a fixed 5 km: REPD by status group (stated MW; not stated counted, never 0), other listed sites by class, nearest substation
ar=c=>{let A=c.area,r=c.r,f=c.all.filter(q=>q.km<=5),t=[],z=0;A.textContent='';
 for(let[v,n]of RpF.st)if(v!='all'){let q=f.filter(o=>RpS(o.p.status)==v),w=RpW(q.map(o=>o.p)),u=q.filter(o=>!(o.p.capacity>0)).length;z+=u;if(q.length)t.push(`${n} ${q.length}${w>0?' · '+N(w)+' MW stated':''}${u?` (${u} not stated)`:''}`)}
 let o=CK.map(k=>[k,S.data.dots.filter(q=>q!==r&&q.k==k&&hv(r.a,q.a)<=5).length]).filter(v=>v[1]).map(([k,v])=>`${CLS[k][0]} ${v}`),s=c.k&&c.k[0];
 L(A,`Within 5 km: ${pl(f.length,'REPD project')}${t.length?' · '+t.join(' · '):''}`,'margin-top:6px;color:#cfe0ff');
 L(A,`Other listed sites within 5 km: ${o.length?o.join(' · '):'none'}${s?` · nearest substation ${KV(s)} kV, ${k1(s.km)} km`:''}`,'color:#c9d6da');
 if(z)L(A,'Capacity not stated: unknown, not zero.','color:#8b9aa1')},
/// the list: chips, the 15 nearest sites with each project's full REPD record, the REPD links
rr=(m,c)=>{let f=S.rf,{sel,P}=sites(c.all,f),box=c.box,all=f.st==='all'&&f.te==='all',nmv=v=>(RpF.st.find(q=>q[0]===v)||RpF.te.find(q=>q[0]===v))[1],fa=all?'all statuses and technologies':[f.st,f.te].filter(v=>v!=='all').map(nmv).join(' · ');
 ar(c);box.textContent='';c.P=P;
 for(let[k,defs,lb]of[['st',RpF.st,'Status'],['te',RpF.te,'Tech']]){let row=ap(box,el('div','display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0 2px'));row.setAttribute('role','group');row.setAttribute('aria-label','REPD '+lb.toLowerCase()+' filter');
  ap(row,el('span','color:#8b9aa1;font-size:11px;min-width:40px',lb));
  for(let[v,t]of defs){let on=f[k]===v,b=ap(row,el('button',`min-height:44px;padding:0 10px;background:${on?'#2f5fa8':'#050a12'};border:1px solid #2f5fa8;border-radius:3px;color:${on?'#e8eef9':'#8fb4ff'};font:11px/1 monospace;cursor:pointer`,t));
   b.type='button';b.dataset.offtakersRepdFilter=k+':'+v;b.setAttribute('aria-pressed',on);b.addEventListener('click',()=>{if(f[k]!==v&&S.pp===c){f[k]=v;rr(m,c);box.querySelector(`[data-offtakers-repd-filter="${k}:${v}"]`)?.focus?.()}})}}
 let parts=P.reduce((s,g)=>s+g.parts.length,0),reach=P.length?P[P.length-1].km:0;
 c.pd=L(box,P.length?`Screening · ${pl(P.length,'nearest REPD site')}${parts>P.length?` (${N(parts)} projects; those at one point grouped)`:''}, all within ${k1(reach)} km, straight line (${fa}):`:`Screening · no REPD site within ${R40} km, straight line (${fa}).`,'margin-top:6px;color:#ffc48a');
 if(P.length&&P.length<NR)L(box,`Only ${pl(P.length,'REPD site')} within ${R40} km${all?'':' for this filter'}.`,'color:#ffc48a');
 let sl=[];P.forEach((g,i)=>{let p=g.parts[0],one=g.parts.length===1,b=tier(ap(box,el('a','display:block;padding:12px 0 6px;border-top:1px solid #1d2f52;color:#ffb27a;text-decoration:none',`${i+1}. ${RpG(g)}${RpC(g.parts)} · ${one?cs(p.status)+' · '+cs(p.name):g.parts.length+' projects at this point:'} ▸`)),'screening');
  b.href='#';b.addEventListener('click',e=>{if(e.preventDefault)e.preventDefault();pv(m,c,g)});
  for(let q of g.parts){one||ap(box,tier(el('div','padding:0 0 2px 12px;color:#c9a27e;font-size:11px',`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`),'record'));sl.push([ap(box,el('div')),q])}});
 L(box,'Record · REPD (DESNZ, OGL v3.0): list from the Apr 2026 extract; address, ref, operator and planning fields from the Jul 2026 extract, only on an exact point, name, MW and type match. Status as registered, not as built.','margin-top:6px;color:#8b9aa1','record');
 RpH(c,sl);cv(c);
 c.sm.textContent=`${c.smb} · ${P.length?pl(P.length,'nearest REPD site'):'no REPD site'} · details`;Ra(c,c.pd.textContent);
 try{nl(m,c.fk0[0],c.k,P)}catch(e){note('links: '+msg(e))}top();
 cpos();S.fk=[...c.fk0,...P.map(g=>g.a)];m.isMoving&&m.isMoving()?(cm(m),m.once('moveend',cw)):ck()},
/// record slots [[div, props]]: filled from the cache now and again when the rows at their points arrive (M5's RpQ/RpB)
RpH=(c,sl)=>{let r=()=>{RpH(c,sl);c.sm.focus?.()},F=(C,e)=>{if(S.pp==c){for(let[s,q]of sl){s.textContent='';let b=ap(s,RpB(q,RpP.get(q),C,e));if(e){b.setAttribute('role','button');b.setAttribute('tabindex','0');b.style.cursor='pointer';b.addEventListener('click',r);b.addEventListener('keydown',k=>{if(k.key=='Enter'||k.key==' '){k.preventDefault?.();r()}})}}
  if(sl.length)Ru(c,e?'REPD records unavailable':'',e&&`REPD records unavailable: ${msg(e)}. Tap a record line to retry.`)}};F(S.rc);RpQ(sl.map(v=>RpP.get(v[1]))).then(F,e=>F(0,e))},
/// CSV vicinity sheet: one row per listed REPD project and per substation, generated in the page
/// a cell: Cf stripped; a text starting = + - @ TAB or CR gets a leading apostrophe (no formula), numbers stay numbers; quoted on " , CR LF # (R-otsec ORS5)
cq=v=>{let s=v==null?'':String(v).replace(/\p{Cf}/gu,'');if(typeof v!='number'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return/[",\r\n#]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s},
csv=c=>{let[x,y]=c.r.a,J=q=>{let o=S.rc&&RpJ(q,RpP.get(q),S.rc);return o||null},rows=[['kind','name','ref','technology','status','MW','km','lon','lat','source','licence','data date']];
 for(let g of c.P||[])for(let q of g.parts){let o=J(q),a=RpP.get(q)||g.a;rows.push(['REPD project',q.name,o?o.repd_ref:'',q.raw_tech||q.tech,q.status,q.capacity>0?+q.capacity:'not stated',k2(g.km),a[0],a[1],o?'REPD (DESNZ) Jul 2026 extract, exact match':'REPD (DESNZ) Apr 2026 map register','OGL v3.0',o?(o.source_record_updated||'record date not stated'):'Apr 2026 extract'])}
 for(let a of c.k||[])rows.push(['substation',a.name||'unnamed substation','','',KV(a)+' kV','',k2(a.km),a.at[0],a.at[1],'OpenStreetMap as loaded by the map','ODbL 1.0','not carried']);
 for(let{q,km}of c.cv||[])rows.push(['conventional power site',NM(q),'',SUBL(q),BST[q.t],MW(q.p)||'not stated',k2(km),q.a[0],q.a[1],(q.p.sources||[]).map(s=>s.name).join('; ')||'not stated',(q.p.sources||[]).map(s=>String(s.licence||'').split(/ \(|, \(c\)/)[0]).join('; ')||'licence not stated','listed site']);
 return[`# GridAtlas potential offtakers vicinity sheet · generation ${GEN} · tap point ${x},${y} (${NM(c.r).replace(/[\r\n]/g,' ')}) · ${new Date().toISOString()}`,'# '+SCR+' A listing is not electricity demand. '+NOTSHOWN,...rows.map(r=>r.map(cq).join(','))].join('\n')+'\n'},
cv=c=>{c.csv.textContent='';let b=ap(c.csv,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a12;border:1px solid #2f5fa8;border-radius:3px;color:#8fb4ff;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer','Download vicinity sheet (CSV)'));b.type='button';b.dataset.offtakersCsv='';
 b.addEventListener('click',()=>{try{let u=URL.createObjectURL(new Blob([csv(c)],{type:'text/csv'})),a=el('a');a.href=u;a.download=`offtaker-vicinity-${GEN}.csv`;ap(document.body,a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4e3)}catch(e){note('csv: '+msg(e))}})},
/// a row: fly to the REPD site and draw its own 5 nearest substations; "◀ back" restores the offtaker card
pv=(m,c,g,bl='◀ back to offtaker')=>{let back=c.re,[x,y]=g.a,ps=g.parts;pc();
 let v=cd(m,'REPD project',`REPD · ${RpU(ps,RpN).sort().join(' + ')}${RpMW(RpW(ps))}`,{foot:'Record · REPD (DESNZ, Apr 2026, OGL v3.0). Status as registered, not as built. '+NOTSHOWN,open:1,back:[bl,()=>{pc();back();S.pp&&S.pp.sm.focus?.()}]});
 v.sm.textContent=`${k2(g.km)} km from ${NM(c.r)} (straight line) · details`;
 let sl=ps.map(q=>(L(v.det,`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`,'color:#ffb27a;margin-top:6px'),[ap(v.det,el('div')),q]));RpH(v,sl);
 let Lk=W.__GRIDATLAS_NEON_LINKS__||{},M=Lk.measure||{},k=[];try{k=AI(Lk.substations)&&Lk.substations.length?M.nearestSubstations(x,y,Lk.substations):[]}catch(e){note('nearest: '+msg(e))}
 L(v.det,'Screening · nearest substations to this project, straight line. Not its declared connection or capacity.','color:#5fbdc2;margin-top:6px');for(let a of k)L(v.det,`${k2(a.km)} km · ${KV(a)} kV · ${cs(a.name||'unnamed substation')}`,'color:#c9d6da');
 v.k=k;S.fk=[[x,y],...k.map(a=>a.at)];try{nl(m,[x,y],k)}catch(e){note('links: '+msg(e))}cpos();nz(m,x,y);v.querySelector('[data-offtakers-back]')?.focus?.()},
/// map tap: decided after every click handler of this tap has run, so an offtaker hit wins over a lightning card opened by the same tap
/// the hit is decided at once and the tap claimed (e.gridatlasClaim), so the lightning overlay leaves it alone (R-taps MAJOR);
/// the card is drawn after every click handler of this tap has run
tap=e=>{if(!S.on)return;let f=th(e);if(f)try{e.gridatlasClaim='offtakers'}catch(_){}setTimeout(()=>{try{tq(e,f)}catch(x){note('tap: '+msg(x))}},0)},
th=e=>{let m=mh();if(!S.on||!m||!m.getLayer(HIT)||!S.data)return null;let px=e.point.x??e.point[0],py=e.point.y??e.point[1],f=null,dm=1/0;
 for(let q of m.queryRenderedFeatures(e.point,{layers:[HIT]})){let r=S.data.dots[q.properties&&q.properties.i];if(!r||!S.cls[r.k]||r.k=='b'&&!S.bst[r.t])continue;let a=m.project(r.a),d=(a.x-px)**2+(a.y-py)**2;if(d<dm){dm=d;f=r}}
 return f},
/// an offtaker hit wins: the lightning card and a map popup opened by the same tap (a REPD dot under the site) close through
/// their own Close buttons
tq=(e,f)=>{let m=mh();if(!S.on||!m)return;
 if(!f){if(S.pp&&!S.pp.contains(e.originalEvent&&e.originalEvent.target))pc();return}
 (f.k=='c'?dcc:oc)(m,f);let lc=document.querySelector('[data-lightning-card]'),x=lc&&[...lc.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Close');x&&x.click();
 for(let b of (m.getContainer?.()||document).querySelectorAll('.maplibregl-popup-close-button'))b.click()},
co=e=>{if(e&&e.detail&&e.detail.owner!=='offtakers')pc()},
