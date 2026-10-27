// grid summary sketch (NOT applied): long windows draw one circle per 0.25° cell summed over the window's days.
GR=AR+'grid-0p25.json',gg=()=>S.gp||(S.gp=gj(GR,'no-cache').then(o=>{if(!o||o.schema!=='uk-lightning-grid-day.v1'||o.cell_deg!==.25)E('invalid grid');return o}).catch(e=>{S.gp=null;throw e})),
ga=(g,rows,w)=>{const m=new Map(),c=g.cols;for(const y of rows){if(!y.count)continue;const a=g.days[y.date]||[];let n=0;for(let i=0;i<a.length;i+=2){n+=a[i+1];const k=a[i],v=m.get(k)||[0,0];v[0]+=a[i+1];v[1]++;m.set(k,v)}if(n!==y.count)E('grid mismatch '+y.date)}
return[...m].map(([k,[n,d]])=>({type:'Feature',id:'g'+k,geometry:{type:'Point',coordinates:[-11+(k%c+.5)*.25,49.5+(Math.floor(k/c)+.5)*.25]},properties:{time_utc:'',n,d,g:1}}))},
// in lw, before the budget test:  if(w.span>31*DAY&&!S.consent)try{r.ev=ga(await gg(),rows,w);r.mode='grid';r.cl=0;return r}catch(e){r.ge=msg(e)}
// in dw paint (grid): 'circle-radius':['interpolate',['linear'],['sqrt',['get','n']],1,4,30,14,200,26],'circle-color':'#ffb000','circle-opacity':.75
// in tap (grid): say(`${N(p.n)} optical flashes in this 0.25° cell on ${p.d} UTC days of the window (daily summary; not ground strikes; no nearest-substation search)`)
// in cp (grid): L.flashes=`Flashes ${N(r.arch)} archived · drawn as ${N(r.ev.length)} 0.25° cells (daily summary) · LOAD POINTS draws up to the newest ${N(BUDGET)}`
