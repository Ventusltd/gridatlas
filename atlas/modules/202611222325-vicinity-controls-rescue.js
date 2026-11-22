/* GridAtlas V9.196: keep the inherited Grid Engine; repair PDF/tab wake and Layers hit target. */
(function(){
 'use strict';
 const W=window,D=document,q=new URLSearchParams(W.location.search);
 const ref=q.get('repd_ref'),latRaw=q.get('latitude'),lonRaw=q.get('longitude');
 if(!/^[1-9]\d{0,11}$/.test(ref||'')||!latRaw?.trim()||!lonRaw?.trim())return;
 if(['repd_ref','latitude','longitude'].some(k=>q.getAll(k).length!==1))return;
 const lat=Number(latRaw),lon=Number(lonRaw);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<49.5||lat>61.5||lon< -11||lon>3)return;
 if(Math.abs(lat-49.766807)<.0001&&Math.abs(lon+7.55716)<.0001)return;
 const loc=[lon,lat],name=(q.get('project')||q.get('name')||'REPD '+ref).slice(0,180);
 const tech=(q.get('technology')||'').slice(0,80),mw=Number(q.get('capacity_mw'));
 const started=Date.now(),qa=W.__GRIDATLAS_VICINITY_LINK_QA__={generation:'202611222325',repd_ref:ref,layers:'pending',grid:'pending',fallback_attempts:0};
 function answered(){const e=W.__GRIDATLAS_NEON_LINKS__;return Boolean(e?.arrival_engine?.answered===true||e?.links_drawn>0||e?.declared_connection_framed===true)}
 function floatLayers(){
   const b=D.getElementById('gridatlas-dash-toggle');if(!b)return;
   // The V9.194 launcher put this button INSIDE the map-controls stacking
   // context. Its huge z-index could not outrank the project card.
   const host=D.fullscreenElement||D.webkitFullscreenElement||D.body;
   if(!host)return;
   if(b.parentElement!==host)host.appendChild(b);
   b.hidden=false;
   const menu=D.getElementById('gridatlas-menu-bar'),map=W.__GRIDATLAS_V9_MAP__?.getContainer?.();
   const anchor=menu?.getBoundingClientRect?.().bottom??map?.getBoundingClientRect?.().top??0;
   const height=Math.max(80,W.innerHeight||D.documentElement.clientHeight||852);
   const top=Math.min(Math.max(8,Math.ceil(anchor)+8),Math.max(8,height-54));
   for(const [k,v] of Object.entries({position:'fixed',top:top+'px',bottom:'auto',right:'12px',left:'auto','z-index':'2147483646','pointer-events':'auto','touch-action':'manipulation','min-height':'44px'}))b.style.setProperty(k,v,'important');
   qa.layers='accessible-floating-toggle';
 }
 let wakes=0,recovered=false,inflight=false;
 function wake(){
   const l=W.__GRIDATLAS_NEON_LINKS__;
   if(D.visibilityState!=='visible'||answered()||wakes>=2)return;
   if(!l?.arrival_attempts||l?.arrival_engine?.reason==='DEFERRED_FOR_VISIBILITY'){
     wakes++;D.dispatchEvent(new Event('visibilitychange'));qa.grid='visible-wake-'+wakes;
   }
 }
 async function fallback(){
   if(answered()){qa.grid='answered';return}
   if(D.visibilityState!=='visible'||Date.now()-started<20000||recovered||inflight)return;
   const l=W.__GRIDATLAS_NEON_LINKS__;
   if(typeof l?.selectAt!=='function'||l.arrival_engine?.terminal===false)return;
   if(['FALSE_ORIGIN','NOT_IN_REGISTER','HANDED_TO_INTERCONNECTORS','IDENTITY_REJECTED'].includes(l.arrival_engine?.reason))return;
   recovered=inflight=true;qa.fallback_attempts++;qa.grid='measuring-original-engine';
   try{
     const ok=await l.selectAt(loc,name,tech,false,Number.isFinite(mw)&&mw>0?mw:null);
     qa.grid=ok===true?'original-engine-completed':'original-engine-unavailable';
   }catch(error){qa.grid='original-engine-failed';qa.error=String(error?.message||error).slice(0,160)}
   finally{inflight=false}
 }
 function tick(){floatLayers();if(answered()){qa.grid='answered';return}if(Date.now()-started>1500&&wakes===0)wake();void fallback()}
 const timer=setInterval(tick,1000);
 const later=()=>setTimeout(tick,0);
 for(const n of ['focus','pageshow','resize','orientationchange'])W.addEventListener(n,later);
 for(const n of ['fullscreenchange','webkitfullscreenchange'])D.addEventListener(n,later);
 D.addEventListener('visibilitychange',later);
 W.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 tick();
})();
