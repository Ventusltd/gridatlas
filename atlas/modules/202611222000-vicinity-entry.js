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
 function position(){
   if(!button?.isConnected)return;
   const map=W.__GRIDATLAS_V9_MAP__,host=map?.getContainer(),rect=host?.getBoundingClientRect();
   if(!rect)return;
   const tray=D.getElementById('gridatlas-mobile-tray');
   const subs=tray&&[...tray.querySelectorAll('button')].find(b=>/\bSUBS\b/i.test(b.textContent||'')&&!b.hidden);
   if(subs){
     const b=subs.getBoundingClientRect(),width=button.getBoundingClientRect().width||110;
     let x=b.right-rect.left+6,y=b.top-rect.top;
     if(x+width>rect.width-8){x=Math.max(8,b.left-rect.left);y=Math.max(52,y-51)}
     button.style.left=Math.max(8,x)+'px';button.style.top=Math.max(52,y)+'px';button.style.bottom='auto';
   }else{button.style.left='8px';button.style.top='auto';button.style.bottom='78px'}
   const layer=D.getElementById('gridatlas-dash-toggle');
   if(layer&&!layer.hidden){
     const a=button.getBoundingClientRect(),b=layer.getBoundingClientRect();
     if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top){button.style.top=Math.max(52,a.top-rect.top-51)+'px';button.style.bottom='auto'}
   }
 }
 function mount(){
   if(button?.isConnected)return true;
   const map=W.__GRIDATLAS_V9_MAP__,engine=W.__GRIDATLAS_MODULES__?.ukOfftakers;
   if(!map?.getContainer||!engine?.openProjectVicinity)return false;
   button=D.createElement('button');button.id='gridatlas-pipeline-vicinity-button';button.type='button';
   button.textContent='◎ VICINITY';button.title='Explore the nearest 30 substations, 30 REPD sites and 30 conventional power sites';
   button.setAttribute('aria-label','Open project vicinity screening');
   button.style.cssText='position:absolute;z-index:19;left:8px;bottom:78px;min-height:44px;min-width:105px;padding:8px 10px;border:1px solid #367078;border-radius:5px;background:#071b21;color:#8de5dc;font:12px monospace;letter-spacing:.04em;cursor:pointer;touch-action:manipulation';
   for(const type of ['click','pointerdown','mousedown','touchstart','dblclick'])button.addEventListener(type,event=>event.stopPropagation());
   button.addEventListener('click',()=>{if(!engine.openProjectVicinity(origin)){button.textContent='NOT READY';button.setAttribute('aria-label','Vicinity engine not ready');setTimeout(()=>{if(button?.isConnected){button.textContent='◎ VICINITY';button.setAttribute('aria-label','Open project vicinity screening')}},2500)}});
   map.getContainer().appendChild(button);
   position();setTimeout(position,650);W.addEventListener('resize',position);
   return true;
 }
 const timer=setInterval(()=>{if(mount()||++attempts>160)clearInterval(timer)},250);
 mount();
})();
