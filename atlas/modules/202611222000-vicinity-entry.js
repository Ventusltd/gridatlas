/* GridAtlas V9.194 additive PipelineNews MAP VICINITY button. Journey remains discontinued. */
(function launcher(){
 'use strict';
 const W=window,D=document,q=new URLSearchParams(W.location.search);
 const ref=q.get('repd_ref'),latitude=q.get('latitude'),longitude=q.get('longitude');
 if(!/^[1-9]\d{0,11}$/.test(ref||'')||!latitude?.trim()||!longitude?.trim())return;
 if(['repd_ref','latitude','longitude'].some(k=>q.getAll(k).length!==1))return;
 const lat=Number(latitude),lon=Number(longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lon<-11||lon>3||lat<49.5||lat>61.5)return;
 const origin={repdRef:ref,at:[lon,lat],name:(q.get('project')||q.get('name')||'REPD '+ref).slice(0,180),technology:(q.get('technology')||'').slice(0,80)};
 let button,attempts=0;
 function position(){ const stack=D.querySelector('.map-controls');if(stack&&button?.isConnected)stack.removeAttribute('data-gridatlas-menu-emptied'); }
 function mount(){
   if(button?.isConnected)return true;
   const map=W.__GRIDATLAS_V9_MAP__,engine=W.__GRIDATLAS_MODULES__?.ukOfftakers;
   const stack=D.querySelector('.map-controls');if(!map?.getContainer||!stack||!engine?.openProjectVicinity)return false;
   button=D.createElement('button');button.id='gridatlas-pipeline-vicinity-button';button.type='button';
   button.textContent='◎ VICINITY';button.title='Explore the nearest 30 substations, 30 REPD sites and 30 conventional power sites';
   button.setAttribute('aria-label','Open project vicinity screening');
   button.style.cssText='min-height:44px;min-width:118px;padding:8px 10px;border:1px solid #367078;border-radius:5px;background:#071b21;color:#8de5dc;font:12px monospace;letter-spacing:.04em;cursor:pointer;touch-action:manipulation';
   for(const type of ['click','pointerdown','mousedown','touchstart','dblclick'])button.addEventListener(type,event=>event.stopPropagation());
   button.addEventListener('click',()=>{if(!engine.openProjectVicinity(origin)){button.textContent='NOT READY';button.setAttribute('aria-label','Vicinity engine not ready');setTimeout(()=>{if(button?.isConnected){button.textContent='◎ VICINITY';button.setAttribute('aria-label','Open project vicinity screening')}},2500)}});
   const holder=D.createElement('div');holder.id='gridatlas-pipeline-vicinity-holder';holder.style.cssText='display:flex;align-items:center;position:relative;z-index:21;padding:0;pointer-events:auto';holder.appendChild(button);const tray=D.getElementById('gridatlas-mobile-tray');stack.insertBefore(holder,tray?tray.nextSibling:stack.firstChild);position();
   return true;
 }
 const timer=setInterval(()=>{if(mount()||++attempts>160)clearInterval(timer)},250);
 mount();
})();
