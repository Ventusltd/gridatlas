/* ---- REPD projects near a tap (M2) ----------------------------------------------------------------------------------
   The register the map already holds (the engine's src-repd data when a REPD layer has loaded it, else the engine URL
   /dist/repd_master.json through the untouched bridge), measured by straight-line distance from the flash or the cell
   centre with the original link.measure.distanceKm. Nearest by distance only: never a claim that a project was struck
   or affected. */
RG=(m,M)=>S.rg||(S.rg=(async()=>{
  let f;try{f=m.getSource('src-repd').serialize().data.features}catch(_){}
  // gj: the module's fetch helper (15 s timeout that also covers the body, redirect refusal, "HTTP n")
  if(!(f&&f.length))f=(await gj('/dist/repd_master.json')).features;
  let o=f.map(x=>[M.representativePoint(x.geometry),x.properties||{}]).filter(([a,p])=>a&&M.isProjectTech(p.tech));
  return o.length?o:E('register empty')})().catch(e=>{S.rg=null;throw e})),
// filter chips: status classes (operational | under or awaiting construction | application submitted) and technology
RpF={st:[['all','All'],['op','Operational'],['cc','Consented & construction'],['pl','Planning']],
  te:[['all','All'],['solar','Solar'],['wind','Wind'],['bess','BESS'],['other','Other']]},
RpS=s=>{s=String(s||'').toLowerCase();return s==='operational'?'op':/construction/.test(s)?'cc':/application|submitted|planning/.test(s)?'pl':'?'},
RpT=t=>/^solar/.test(t)?'solar':/^wind/.test(t)?'wind':/^bess/.test(t)?'bess':'other',
RpN=p=>({solar:'Solar',solar_roof:'Rooftop solar'})[p.tech]||cs(p.raw_tech),
RpW=ps=>ps.reduce((s,p)=>s+(p.capacity>0?+p.capacity:0),0),
RpMW=v=>v>0?` ${N(v)} MW`:'',
RpU=(ps,f)=>[...new Set(ps.map(f))],
// one label per site: co-located parts (e.g. solar + battery at one point) share one link, one node and one label
RpG=g=>`${g.km.toFixed(2)} km · ${RpU(g.parts,RpN).sort().join(' + ')}${RpMW(RpW(g.parts))}`,
Rp=(m,c,x,y,M)=>{
  let pd=ap(c.out,el('div','','REPD projects: loading…')),box=ap(c.out,el('div'));
  RG(m,M).then(G=>{
    if(S.pp!==c||!c.out.contains(pd))return;
    // every register row is measured once; exact duplicate rows (same point, same properties) count once
    let all=[],seen=new Set;
    for(let[a,p]of G){let km=M.distanceKm(x,y,...a);if(km<=40){let k=a+JSON.stringify(p);if(!seen.has(k)){seen.add(k);all.push({a,p,km})}}}
    c.rpAll=all;c.fk0=S.fk.slice();c.smb=c.sm.textContent;RpR(m,c,pd,box)
  }).catch(e=>{
    if(S.pp!==c)return;S.rgf=(S.rgf||0)+1;
    // the bridge keeps a failed DuckDB/manifest start for the page lifetime, so a retry can fail at once: say so
    pd.textContent=`REPD projects unavailable: ${msg(e)}. Tap again to retry`+(S.rgf>1?"; if it keeps failing, switch on a REPD layer or reload the page (the map's REPD loader keeps a failed start until the page is reloaded).":'.')})},
RpR=(m,c,pd,box)=>{
  let f=S.rf||(S.rf={st:'all',te:'all'}),o=c.fk0[0],
    sel=c.rpAll.filter(r=>(f.st==='all'||RpS(r.p.status)===f.st)&&(f.te==='all'||RpT(r.p.tech)===f.te)),groups=new Map;
  for(let r of sel){let k=r.a.join(),g=groups.get(k);if(!g)groups.set(k,g={a:r.a,km:r.km,parts:[]});g.parts.push(r.p)}
  // the nearest 10 sites within the filter, plus any site at exactly the 10th site's distance
  let P=[...groups.values()].sort((a,b)=>a.km-b.km).filter((g,i,a)=>i<10||g.km==a[9].km),parts=P.reduce((s,g)=>s+g.parts.length,0),
    nm=v=>(RpF.st.find(q=>q[0]===v)||RpF.te.find(q=>q[0]===v))[1],all=f.st==='all'&&f.te==='all',
    ft=all?'all technologies and statuses':'filter: '+[f.st,f.te].filter(v=>v!=='all').map(nm).join(' · '),
    n10=sel.filter(r=>r.km<=10),nc10=n10.filter(r=>!(r.p.capacity>0)).length;
  pd.textContent=`${P.length?(parts>P.length?`${pl(P.length,'nearest REPD site')} (${N(parts)} projects; co-located parts grouped)`:pl(P.length,'nearest REPD project')):'No REPD project'} within 40 km of this ${c.wh} (straight-line; ${ft}). Not evidence any project was struck or affected.`;
  box.textContent='';
  ap(box,el('div','margin-top:4px;color:#ffc48a',`${pl(n10.length,'REPD project')} within 10 km · ${N(sel.length)} within 40 km · total${RpMW(RpW(n10.map(r=>r.p)))||' 0 MW'} within 10 km`
    +`${nc10?` (${N(nc10)} without a stated capacity not counted)`:''}; registered capacity, straight-line distance only, not a measure of impact`));
  if(P.length&&P.length<10)ap(box,el('div','',`Only ${pl(P.length,'site')} within 40 km${all?'':' for this filter'}; the radius stays 40 km, so fewer than 10 are listed.`));
  for(let[k,defs,lb]of[['st',RpF.st,'Status'],['te',RpF.te,'Tech']]){
    let row=ap(box,el('div','display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0 2px'));row.setAttribute('role','group');row.setAttribute('aria-label','REPD '+lb.toLowerCase()+' filter');
    ap(row,el('span','color:#8b9aa1;font-size:10px;min-width:40px',lb));
    for(let[v,t]of defs){let on=f[k]===v,b=ap(row,el('button',`min-height:44px;padding:0 10px;background:${on?'#2f6f75':'#050a0d'};border:1px solid #2f6f75;border-radius:3px;color:${on?'#e8f4f5':'#5fbdc2'};font:11px/1 monospace;cursor:pointer`,t));
      b.type='button';b.dataset.lightningRepdFilter=k+':'+v;b.setAttribute('aria-pressed',on);b.addEventListener('click',()=>{if(f[k]!==v&&S.pp===c){f[k]=v;RpR(m,c,pd,box)}})}}
  for(let g of P){
    let p=g.parts[0],one=g.parts.length===1,st=RpU(g.parts,q=>cs(q.status)).join(' / '),nm2=RpU(g.parts,q=>cs(q.name)).join(' / '),
      b=ap(box,el('a','display:block;padding:14px 0 13px;border-top:1px solid #1d3238;color:#ffb27a',`${RpG(g)} · ${one?'':g.parts.length+' co-located · '}${st} · ${nm2}`));
    // the href keeps the original coordinate deep link (open in a new tab); a plain tap stays in this page
    b.href=location.pathname+'?'+new URLSearchParams({longitude:g.a[0],latitude:g.a[1],technology:p.tech,project:p.name,capacity_mw:p.capacity,status:p.status});
    b.addEventListener('click',e=>{if(e.preventDefault)e.preventDefault();RpV(m,c,g)});
    if(!one)for(let q of g.parts)ap(box,el('div','padding:0 0 8px 12px;color:#c9a27e;font-size:10px',`${RpN(q)}${RpMW(+q.capacity)} · ${cs(q.status)} · ${cs(q.name)}`))}
  c.sm.textContent=c.smb+(P.length?` · ${P.length} nearest projects`:'');
  let C=['interpolate',['linear'],['get','mw'],0,'#ffaa00',50,'#ff4400',200,'#f00'],Z=(a,b)=>['interpolate',['linear'],['zoom'],6,a,12,b],
    F=geo=>FC(P.map(g=>({type:'Feature',properties:{mw:RpW(g.parts),label:RpG(g)},geometry:geo(g)}))),
    A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{})),
    ln=F(g=>({type:'LineString',coordinates:[o,g.a]})),nd=F(g=>({type:'Point',coordinates:g.a}));
  if(m.getSource(NSR[3])&&m.getSource(NSR[4])){m.getSource(NSR[3]).setData(ln);m.getSource(NSR[4]).setData(nd)}
  else{m.addSource(NSR[3],{type:'geojson',data:ln});m.addSource(NSR[4],{type:'geojson',data:nd});
    A(9,'line',NSR[3],{'line-color':C,'line-width':Z(1,2),'line-opacity':.8,'line-dasharray':[2,2]});A(10,'circle',NSR[4],{'circle-radius':Z(3,5),'circle-color':C,'circle-stroke-width':1});
    try{A(11,'symbol',NSR[4],{'text-color':'#ffc48a','text-halo-color':'#000c10','text-halo-width':1.5},{'text-field':['get','label'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-font':sf(m)})}catch(e){note('neon labels: '+msg(e))}}
  // frame origin, substations and the listed sites; a register that lands mid-move is framed when that move ends
  cpos();S.fk=[...c.fk0,...P.map(g=>g.a)];m.isMoving&&m.isMoving()?m.once('moveend',ck):ck()},
// a row tap stays in this page: fly to the site and draw the original engine's nearest-substation links from it
// (link.measure.nearestSubstations, as for a flash); "◀ back" restores the lightning card as at its tap (collapsed, so the
// camera can frame it), its links and the filter. Both cards arrive collapsed so the neon links stay visible.
RpV=(m,c,g)=>{
  let back=c.re,src=c.wh==='cell centre'?'cell':'flash',[x,y]=g.a,ps=g.parts;
  pc();
  cd(m,x,y,'REPD project',`REPD · ${RpU(ps,RpN).sort().join(' + ')}${RpMW(RpW(ps))}`,
    ps.length>1?`${ps.length} co-located projects · ${RpU(ps,q=>cs(q.name)).join(' / ')}`:`${cs(ps[0].name)} · ${cs(ps[0].status)}`,
    ps.map(q=>`${RpN(q)}${RpMW(+q.capacity)} · ${cs(q.status)} · ${cs(q.name)}`).join('; ')+` · lat ${y.toFixed(3)}, lon ${x.toFixed(3)} · ${g.km.toFixed(2)} km from the lightning ${src} (straight-line)`,
    'project',{np:1,foot:'REPD register as the map holds it · nearest substations by straight-line distance, not the declared grid connection · not evidence the project was struck or affected.',
      back:['◀ back to lightning '+src,()=>{pc();back()}]})},
