/* lightning-window.v1 emitter: href computed at click from what the caption shows; new tab keeps the Atlas session */
STL='https://ventusltd.github.io/kuiper-belt/see-through-lightning/',
stHref=(w,m)=>{const u=new URLSearchParams({lightning:w.period,lightning_end:new Date(w.e).toISOString()});
if(w.period==='custom')u.set('lightning_start',new Date(w.s).toISOString());
if(m){const c=m.getCenter();u.set('lightning_lon',c.lng.toFixed(3));u.set('lightning_lat',c.lat.toFixed(3));
u.set('lightning_zoom',String(Math.min(10,Math.round(m.getZoom()*10)/10)))}return STL+'#'+u},
`<a data-lightning-see target="_blank" rel="noopener" style="color:#0ff">SEE THROUGH ↗</a>`
cap.addEventListener('click',ev=>{const a=ev.target.closest&&ev.target.closest('[data-lightning-see]');if(a)a.href=stHref(cur(),mh())})
