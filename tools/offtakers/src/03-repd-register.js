/// ---- REPD register (the map's own, as M2+) ----
RG=(m,M)=>S.rg||(S.rg=(async()=>{let f;try{f=m.getSource('src-repd').serialize().data.features}catch(_){}
 if(!(f&&f.length))f=(await gj('/dist/repd_master.json')).features;
 let o=f.map(x=>{try{let a=M.representativePoint(x.geometry);if(a[0]===+a[0]&&a[1]===+a[1]&&!(a[0]==-7.55716&&a[1]==49.766807))return[a,x.properties||{}]}catch(_){}return[]}).filter(([a,p])=>a&&M.isProjectTech(p.tech));
 return o.length?o:E('register empty')})().catch(e=>{S.rg=null;throw e})),
RpF={st:[['all','All'],['op','Operational'],['cc','Consented'],['pl','Planning']],te:[['all','All'],['solar','Solar'],['wind','Wind'],['bess','BESS'],['other','Other']]},
RpS=s=>{let o={operational:'op','under construction':'cc','awaiting construction':'cc','application submitted':'pl'},k=String(s||'').toLowerCase();return Object.hasOwn(o,k)?o[k]:'?'},
RpT=t=>/^solar/.test(t)?'solar':/^wind/.test(t)?'wind':/^bess/.test(t)?'bess':'other',
RpN=p=>({solar:'Solar',solar_roof:'Rooftop solar'})[p.tech]||cs(p.raw_tech),
RpU=(ps,f)=>[...new Set(ps.map(f))],
RpW=ps=>RpU(ps,p=>p.name+'|'+p.raw_tech+'|'+(p.capacity>0?+p.capacity:0)).reduce((s,k)=>s+ +k.split('|').pop(),0),
RpMW=v=>v>0?` ${N(v)} MW`:'',RpC=ps=>RpW(ps)>0?'':' · capacity not stated',
RpG=g=>`${k2(g.km)} km · ${RpU(g.parts,RpN).sort().join(' + ')}${RpMW(RpW(g.parts))}`,
