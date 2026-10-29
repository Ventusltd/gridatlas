/// 12 REPD projects near a tap (M, M2, M3): the register, the filter chips, the list, the links and the project view.
///
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
  let o=f.map(x=>{///
            try{///
              let a=M.representativePoint(x.geometry);///
              if(a[0]===+a[0]&&a[1]===+a[1]&&!(a[0]==-7.55716&&a[1]==49.766807))return[a,x.properties||{}]///
            }catch(_){}return[]///
          }).filter(([a,p])=>a&&M.isProjectTech(p.tech));
  return o.length?o:E('register empty')})().catch(e=>{S.rg=null;throw e})),
// filter chips: status classes (operational | under or awaiting construction | application submitted) and technology
RpF={st:[['all','All'],['op','Operational'],['cc','Consented'],['pl','Planning']],
  te:[['all','All'],['solar','Solar'],['wind','Wind'],['bess','BESS'],['other','Other']]},
// an explicit table: a status the pinned register does not carry (refused, withdrawn, decommissioned…) is in no class
RpS=s=>({///
      operational:'op','under construction':'cc','awaiting construction':'cc','application submitted':'pl'///
    })[String(s||'').toLowerCase()]||'?',
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
/// Rp: the REPD list of a lightning card: every register row is measured once (all 10,784 rows), then RpR renders it.
Rp=(m,c,x,y,M)=>{
  let pd=ap(c.out,el('div','','REPD projects: loading…')),box=ap(c.out,el('div'));Ra(c,pd.textContent);
  RG(m,M).then(G=>{
    if(S.pp!==c||!c.out.contains(pd))return;
    // every register row is measured once; exact duplicate rows (same point, same properties) count once
    let all=[],seen=new Set;
    for(let[a,p]of G){///
          let km=M.distanceKm(x,y,...a);///
          if(km<=40){///
            let k=a+JSON.stringify(p);///
            if(!seen.has(k)){seen.add(k);///
              all.push({a,p,km})}///
          }///
        }
    c.rpAll=all;c.fk0=S.fk.slice();c.smb=c.sm.textContent;RpR(m,c,pd,box)
  }).catch(e=>{
    if(S.pp!==c)return;///
///#if dots
        S.rgf=(S.rgf||0)+1;
///#else
        Ry();S.rgf=(S.rgf||0)+1;
///#endif
    // the bridge keeps a failed DuckDB/manifest start for the page lifetime, so a retry can fail at once: say so
    pd.textContent=`REPD projects unavailable: ${msg(e)}. `+(S.rgf>1?'Switch on a REPD layer or reload the page, then tap again.':`Tap the ${c.wh=='cell centre'?'cell':'flash'} again to retry.`);
    c.sm.textContent+=' · REPD unavailable';Ra(c,pd.textContent)})},
/// RpR: render the list for the current filter (MR3: ties with the 10th site are kept), the summary, the chips, the rows,
/// the links and the camera. Every filter press re-renders it.
RpR=(m,c,pd,box)=>{
  let f=S.rf||(S.rf={st:'all',te:'all'}),o=c.fk0[0],
    sel=c.rpAll.filter(r=>(f.st==='all'||RpS(r.p.status)===f.st)&&(f.te==='all'||RpT(r.p.tech)===f.te)),groups=new Map;
  // one site per registered point: a row within about 10 m (2e-4° lon, 1e-4° lat) of a nearer row joins its site
  for(let r of[...sel].sort((a,b)=>a.km-b.km)){///
      let g=[...groups.values()].find(g=>Math.abs(g.a[0]-r.a[0])<2e-4&&Math.abs(g.a[1]-r.a[1])<1e-4);///
      if(!g)groups.set(r.a.join(),g={a:r.a,km:r.km,parts:[]});///
      g.parts.push(r.p)///
    }
  // the nearest 10 sites within the filter, plus any site at exactly the 10th site's distance
  let P=[...groups.values()].sort((a,b)=>a.km-b.km).filter((g,i,a)=>i<10||g.km==a[9].km),parts=P.reduce((s,g)=>s+g.parts.length,0),
    nm=v=>(RpF.st.find(q=>q[0]===v)||RpF.te.find(q=>q[0]===v))[1],all=f.st==='all'&&f.te==='all',
    fa=all?'all statuses':[f.st,f.te].filter(v=>v!=='all').map(nm).join(' · '),
    n10=sel.filter(r=>r.km<=10),nc10=n10.filter(r=>!(r.p.capacity>0)).length,W=[...groups.values()].reduce((s,g)=>s+(g.km<=10?RpW(g.parts):0),0);
  pd.textContent=`${P.length?pl(P.length,'nearest REPD site')+(parts>P.length?` (${N(parts)} projects; those at one point grouped)`:''):'No REPD site'} within 40 km of this ${c.wh}, straight-line${all?'':` (${fa})`}. Not evidence any project was struck.`;
  box.textContent='';
  // unknown is not zero: a project without a stated capacity is never summed as 0 MW
  if(sel.length)ap(box,el('div','margin-top:4px;color:#ffc48a',`Within 10 km: ${pl(n10.length,'project')}${n10.length?' · '+(W>0?`${N(W)} MW stated (${fa})`+(nc10?`, ${N(nc10)} not stated`:''):'capacity not stated'):''} · within 40 km: ${pl(sel.length,'project')} · straight-line distance only, not impact · REPD: DESNZ, April 2026, OGL v3.0`));
  let ol=P.length&&P.length<10?ap(box,el('div','',`Only ${pl(P.length,'site')} within the 40 km search radius${all?'':' for this filter'}.`)).textContent:'';
  for(let[k,defs,lb]of[['st',RpF.st,'Status'],['te',RpF.te,'Tech']]){
    let row=ap(box,el('div','display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:6px 0 2px'));///
      row.setAttribute('role','group');///
      row.setAttribute('aria-label','REPD '+lb.toLowerCase()+' filter');
    ap(row,el('span','color:#8b9aa1;font-size:11px;min-width:40px',lb));
    for(let[v,t]of defs){///
        let on=f[k]===v,b=ap(row,el('button',`min-height:44px;padding:0 10px;background:${on?'#2f6f75':'#050a0d'};border:1px solid #2f6f75;border-radius:3px;color:${on?'#e8f4f5':'#5fbdc2'};font:11px/1 monospace;cursor:pointer`,t));
      // a press re-renders the chips: focus returns to the chip just pressed
      b.type='button';///
        b.dataset.lightningRepdFilter=k+':'+v;///
        b.setAttribute('aria-pressed',on);///
        b.addEventListener('click',()=>{///
            if(f[k]!==v&&S.pp===c){///
              f[k]=v;///
              RpR(m,c,pd,box);///
              box.querySelector(`[data-lightning-repd-filter="${k}:${v}"]`)?.focus?.()///
            }///
          })///
      }}
  for(let g of P){
    let p=g.parts[0],one=g.parts.length===1,
      b=ap(box,el('a','display:block;padding:14px 0 13px;border-top:1px solid #1d3238;color:#ffb27a',`${RpG(g)}${RpC(g.parts)} · ${one?cs(p.status)+' · '+cs(p.name):g.parts.length+' projects at this point:'}`));
    // the href keeps the original coordinate deep link (open in a new tab); a plain tap stays in this page
    b.href=location.pathname+'?'+new URLSearchParams({///
          longitude:g.a[0],latitude:g.a[1],technology:p.tech,project:p.name,capacity_mw:p.capacity,status:p.status///
        });
    b.addEventListener('click',e=>{///
          if(e.ctrlKey||e.metaKey||e.shiftKey||e.button)return;///
          if(e.preventDefault)e.preventDefault();///
          RpV(m,c,g)///
        });
    if(!one)for(let q of g.parts)ap(box,el('div','padding:0 0 8px 12px;color:#c9a27e;font-size:11px',`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`))}
  c.sm.textContent=c.smb+' · '+(P.length?pl(P.length,'nearest REPD site'):'no REPD site within 40 km')+(all?'':` (${fa})`);///
    Ra(c,pd.textContent+' '+ol);
///#if dots
  /// dots (M4b): keep the drawn list for dot taps and say what the map shows.
  c.ps=P;///
    if(P.length)ap(box,///
///#else
  // M3: the original REPD layers of the listed technologies (within the filter) are on while this list is shown
  /// layers (M3): switch on the listed technologies' layers (Ry), name them on the card.
  let lt=RpU(P.flatMap(g=>g.parts),q=>q.tech).filter(t=>RL.includes(t)),h=Q('scada-ui-container');///
    Ry(lt);///
    lt=lt.filter(t=>{///
        let b=h&&h.querySelector(`input[data-layer-id="${t}"]`);///
        return b&&b.checked///
      });
  if(lt.length)ap(box,///
///#endif
      el('div','margin-top:6px;color:#8b9aa1;font-size:11px',///
///#if dots
        'Map: only these sites are drawn, in the REPD layer style; tap a dot for its project view. Your Layers are unchanged.'));
///#else
        `REPD map layers on for this list: ${lt.map(t=>{let q=Q('lbl-'+t);return q&&q.getAttribute('data-base-label')||t}).join(', ')}${S.ly.size?' (those switched on here go off when this card closes)':''}`));
///#endif
  let C=['interpolate',['linear'],['get','mw'],0,'#ffaa00',50,'#ff4400',200,'#f00'],Z=(a,b)=>['interpolate',['linear'],['zoom'],6,a,12,b],
    F=geo=>FC(P.map(g=>({type:'Feature',properties:{mw:RpW(g.parts),label:RpG(g)},geometry:geo(g)}))),
    A=(i,type,source,paint,layout)=>m.addLayer(Object.assign({id:NI[i],type,source,paint},layout?{layout}:{})),
    ln=F(g=>({type:'LineString',coordinates:[o,g.a]})),nd=F(g=>({type:'Point',coordinates:g.a}));
  // a map error while drawing is noted (not shown as a register failure); a half-built set is rebuilt on the next render
  try{if(m.getLayer(NI[10])){m.getSource(NSR[3]).setData(ln);m.getSource(NSR[4]).setData(///
///#if dots
          nd);RpD(m,P)}
///#else
          nd)}
///#endif
  else{///
        for(let l of NI.slice(9))m.getLayer(l)&&m.removeLayer(l);///
        for(let q of NSR.slice(3))m.getSource(q)&&m.removeSource(q);
    m.addSource(NSR[3],{type:'geojson',data:ln});m.addSource(NSR[4],{type:'geojson',data:nd});
    A(9,'line',NSR[3],{///
            'line-color':C,'line-width':Z(1,2),'line-opacity':.8,'line-dasharray':[2,2]///
          });///
///#if dots
        RpD(m,P);///
        A(10,///
///#else
        A(10,///
///#endif
          'circle',NSR[4],{///
            'circle-radius':Z(3,5),'circle-color':C,'circle-stroke-width':1///
          });
    try{///
          A(11,'symbol',NSR[4],{///
              'text-color':'#ffc48a','text-halo-color':'#000c10','text-halo-width':1.5///
            },{///
              'text-field':['get','label'],'text-size':10,'text-offset':[0,1],'text-anchor':'top','text-font':sf(m)///
            })///
        }catch(e){note('neon labels: '+msg(e))}///
      }///
    }catch(e){note('project lines: '+msg(e))}
  // frame origin, substations and the listed sites; a register that lands mid-move is framed when that move ends
  cpos();S.fk=[...c.fk0,...P.map(g=>g.a)];m.isMoving&&m.isMoving()?(cm(m),m.once('moveend',cw)):ck()},
// a row tap stays in this page: fly to the site and draw the original engine's nearest-substation links from it
// (link.measure.nearestSubstations, as for a flash); "◀ back" restores the lightning card as at its tap (collapsed, so the
// camera can frame it), its links and the filter. Both cards arrive collapsed so the neon links stay visible. Focus moves to
///#if dots
// "◀ back" on the project card, and to the restored card's summary after back. The project view draws its own site in the REPD style.
///#else
// "◀ back" on the project card, and to the restored card's summary after back. The REPD layers M3 switched on stay on.
///#endif
/// RpV: the project view of one site (a row or, with dots, a dot tap).
RpV=(m,c,g)=>{
  let back=c.re,src=c.wh==='cell centre'?'cell':'flash',[x,y]=g.a,ps=g.parts;
  pc();
  cd(m,x,y,'REPD project',`REPD · ${RpU(ps,RpN).sort().join(' + ')}${RpMW(RpW(ps))}`,
    ps.length>1?`${ps.length} projects at this point · ${RpU(ps,q=>cs(q.name)).join(' / ')}`:`${cs(ps[0].name)} · ${cs(ps[0].status)}`,
    ps.map(q=>`${RpN(q)}${RpMW(+q.capacity)}${RpC([q])} · ${cs(q.status)} · ${cs(q.name)}`).join('; ')+` · lat ${y.toFixed(3)}, lon ${x.toFixed(3)} · ${g.km.toFixed(2)} km from the ${c.wh} (straight-line)`,
    'project',{///
        np:1,///
///#if dots
        g,///
///#else
///#endif
        foot:'REPD register (DESNZ, April 2026 · OGL v3.0) as loaded by the map · lightning = optical flashes, not necessarily ground strikes; not evidence the project was struck.',
      back:['◀ back to lightning '+src,()=>{pc();back();S.pp&&S.pp.sm.focus?.()}]});
  S.pp.querySelector('[data-lightning-back]')?.focus?.()},
