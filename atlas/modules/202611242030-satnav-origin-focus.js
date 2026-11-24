/* GridAtlas V9.195 candidate: asset-first VICINITY focus.
 * Adds a single browseable source-backed asset card without changing the V9.194
 * engine, its 30/30/30 caps, 5/10/20 km calculations or the canonical MAP.
 * Layout Sandbox is closed and suppressed only while Project vicinity is active.
 */
(()=>{'use strict';
 const W=window,D=document,ROOT=D.documentElement;
 const module=()=>W.__GRIDATLAS_MODULES__?.ukOfftakers;
 const map=()=>W.__GRIDATLAS_V9_MAP__;
 const id='gridatlas-vicinity-focus-style';
 if(!D.getElementById(id)){
   const css=D.createElement('style');css.id=id;
   css.textContent=`html[data-vicinity-focus="on"] #gridatlas-sld-panel{display:none!important}
   [data-vicinity-focus-card]{border:1px solid #367078;border-radius:5px;background:#06151b;padding:10px;margin:7px 0;line-height:1.55;max-width:100%;box-sizing:border-box}
   [data-vicinity-focus-title]{font:600 15px/1.4 monospace;color:#c3f5f1;overflow-wrap:anywhere}
   [data-vicinity-focus-row]{display:flex;gap:8px;justify-content:space-between;border-bottom:1px solid #17383b;padding:4px 0;align-items:baseline}
   [data-vicinity-focus-row]>span:first-child{color:#9badb2;flex:0 0 34%}
   [data-vicinity-focus-row]>span:last-child{color:#e7f4ef;flex:1;text-align:right;overflow-wrap:anywhere}
   [data-vicinity-browse-toggle]{display:block;min-height:44px;width:100%;background:#07191f;color:#a6e9e3;border:1px solid #367078;border-radius:4px;margin:4px 0 8px;padding:8px;cursor:pointer;text-align:left;font:12px monospace}`;
   D.head.appendChild(css);
 }
 let active=null,observing=null,mapBound=null,shutdown=false;
 const fmt=n=>Number.isFinite(+n)?Number(n).toLocaleString('en-GB',{maximumFractionDigits:2}):'not stated';
 const safely=v=>v==null||v===''?'not stated':String(v).slice(0,200);
 const label=(p,txt,attr)=>{const e=D.createElement('div');if(attr)e.dataset[attr]='';e.textContent=txt;p.appendChild(e);return e};
 const asset=(card)=>{
   const s=card.swipe;if(!s)return null;
   if(card.__vicFocus?.origin){
     const p=card.r?.p||{};
     return{title:card.r?.n||'Selected REPD project',kind:p.repd_ref?'REPD project (origin)':'Chosen source point (origin)',
       source:p.repd_ref?'REPD source point; entrance and connection unverified':'Explicit '+(p.origin_kind||'map')+' point; no asset identity inferred',
       rows:[['Distance','0 km straight line (origin)'],[p.repd_ref?'REPD reference':'Asset identity',p.repd_ref?safely(p.repd_ref):'not asserted'],
         ['Technology',safely(p.technology)],['Registered capacity',p.capacity_mw>0?fmt(p.capacity_mw)+' MW':'MW not stated']],
       index:'origin',count:s.entries?.length||0};
   }
   if(!s.entries?.length)return null;
   const r=s.entries[s.index],position=s.entries.slice(0,s.index).filter(x=>x.tab===r.tab).length;
   const rows=[['Distance',fmt(r.km)+' km straight line']];
   let title=r.name,kind='Asset',source='',record;
   if(r.tab==='s'){
     kind='Substation';record=card.k?.[position];
     if(record){title=record.name||title;rows.push(['Voltage',fmt(record.kv)+' kV']);if(record.operator)rows.push(['Operator',safely(record.operator)]);}
     source='Map substation register / OpenStreetMap, ODbL';
   }else if(r.tab==='r'){
     kind='REPD project';record=card.P?.[position]?.parts?.[0];
     if(record){title=record.name||title;rows.push(['Technology',safely(record.raw_tech||record.tech)]);rows.push(['Status',safely(record.status)]);rows.push(['Registered capacity',record.capacity>0?fmt(record.capacity)+' MW':'MW not stated']);if(card.P[position].parts.length>1)rows.push(['Shared site',card.P[position].parts.length+' registered projects']);}
     source='REPD map register, DESNZ; exact-source details via existing REPD tab';
   }else if(r.tab==='v'){
     kind='Conventional power site';record=card.cv?.[position]?.q;
     if(record){title=record.n||title;rows.push(['Operator',safely(record.op)]);rows.push(['Fuel / technology',[record.f,record.te].filter(Boolean).join(' / ')||'not stated']);rows.push(['Status',safely(record.st)]);rows.push(['Installed capacity',record.mw>0?fmt(record.mw)+' MW':'MW not stated']);}
     source='Conventional power open register; see detailed source in existing tab';
   }
   return{title,kind,source,rows,index:s.index+1,count:s.entries.length};
 };
 function render(card){
   if(active!==card||!card.isConnected||!card.__vicFocus)return;
   const ui=card.__vicFocus,a=asset(card);
   const signature=a?JSON.stringify(a):'empty';
   if(ui.signature===signature)return;ui.signature=signature;
   const box=ui.box;box.textContent='';
   if(!a){label(box,'Loading nearby substations, REPD projects and power stations.','vicinityFocusTitle');return;}
   label(box,a.kind+' | '+a.index+' of '+a.count,'vicinityFocusKind');
   label(box,a.title,'vicinityFocusTitle').setAttribute('data-vicinity-focus-title','');
   for(const [key,value] of a.rows){const row=D.createElement('div');row.setAttribute('data-vicinity-focus-row','');const l=D.createElement('span'),v=D.createElement('span');l.textContent=key;v.textContent=safely(value);row.append(l,v);box.appendChild(row)}
   label(box,'Source: '+a.source,'vicinityFocusSource').style.cssText='padding-top:7px;color:#9aabb0;font-size:10px';
   label(box,'Screening only: proximity does not establish a grid connection, route, capacity or headroom.','vicinityFocusCaveat').style.cssText='padding-top:6px;color:#adc4c7;font-size:10px';
 }
 function navigate(card,type,rank){
   const s=card.swipe;if(!s||!s.entries?.length)return false;
   let count=0,target=-1;
   for(let i=0;i<s.entries.length;i++)if(s.entries[i].tab===type){if(count===rank){target=i;break;}count++}
   if(target<0)return false;
   card.__vicFocus.origin=false;s.label.style.visibility='';
   s.index=(target+s.entries.length-1)%s.entries.length;
   s.next.click();render(card);
   return true;
 }
 function install(card){
   if(card.__vicFocus)return;
   const s=card.swipe;if(!s)return;
   // Keep map and asset foreground; the old four tabs and full listings remain
   // available from the secondary Browse sets control.
   const nav=s.prev.parentElement;
   card.head.insertBefore(nav,card.tl);
   const panel=D.createElement('div');panel.setAttribute('data-vicinity-focus-card','');
   panel.setAttribute('role','group');panel.setAttribute('aria-label','Selected vicinity asset');
   card.head.insertBefore(panel,card.tl);
   const more=D.createElement('button');more.type='button';more.setAttribute('data-vicinity-browse-toggle','');more.textContent='Browse nearby sets and full records +';
   more.setAttribute('aria-expanded','false');card.head.insertBefore(more,card.tl);
   const groups=[card.tl,card.pn,card.csv];
   groups.forEach(g=>{g.style.display='none'});
   more.addEventListener('click',()=>{const open=more.getAttribute('aria-expanded')!=='true';more.setAttribute('aria-expanded',String(open));more.textContent=open?'Hide nearby sets -':'Browse nearby sets and full records +';groups.forEach(g=>g.style.display=open?'':'none')});
   card.d.open=false;card.d.querySelector('summary')?.setAttribute('title','Show 5/10/20 km area analysis');
   card.setAttribute('aria-label','Project vicinity asset browser');
   card.__vicFocus={box:panel,more,signature:null,origin:true};
   // The first card is always the clicked PipelineNews project; the 90
   // neighbouring locations start only after the first left/right movement.
   s.label.style.visibility='hidden';
   for(const [button,direction] of [[s.next,1],[s.prev,-1]]){
     button.addEventListener('click',()=>{
       if(!card.__vicFocus?.origin||!s.entries.length)return;
       card.__vicFocus.origin=false;
       s.index=direction===1?s.entries.length-1:0;
       s.label.style.visibility='';
     },true);
   }
   let touchOrigin=null;
   card.addEventListener('touchstart',e=>{if(e.touches.length===1)touchOrigin={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true,capture:true});
   card.addEventListener('touchend',e=>{
     if(!card.__vicFocus?.origin||!s.entries.length||!touchOrigin||!e.changedTouches.length)return;
     const x=e.changedTouches[0].clientX-touchOrigin.x,y=e.changedTouches[0].clientY-touchOrigin.y;
     touchOrigin=null;
     if(Math.abs(x)>54&&Math.abs(x)>1.5*Math.abs(y)){
       card.__vicFocus.origin=false;
       s.index=x<0?s.entries.length-1:0;
       s.label.style.visibility='';
     }
   },{passive:true,capture:true});
   card.addEventListener('click',e=>{
     if(!card.__vicFocus||!card.isConnected)return;
     const row=e.target.closest('[data-offtakers-row]');
     if(!row||!card.contains(row)||!['s','r','v'].includes(card.tab))return;
     const rank=Number(row.dataset.offtakersRow);
     if(!Number.isInteger(rank)||rank<0)return;
     if(navigate(card,card.tab,rank)){e.preventDefault();e.stopImmediatePropagation();if(more.getAttribute('aria-expanded')==='true')more.click()}
   },true);
   const watch=new MutationObserver(()=>render(card));watch.observe(s.label,{childList:true,characterData:true,subtree:true});
   observing?.disconnect();observing=watch;
   render(card);
 }
 function sync(){
   if(shutdown)return;
   const card=module()?.state?.pp;
   const focused=!!(card?.project&&card.isConnected&&card.swipe);
   if(!focused){
     if(active){observing?.disconnect();observing=null;active=null}
     ROOT.removeAttribute('data-vicinity-focus');return;
   }
   ROOT.setAttribute('data-vicinity-focus','on');
   if(card!==active){
     active=card;
     // Stop the unrelated layout calculation panel taking over the screen.
     const close=D.querySelector('#gridatlas-sld-panel .sld-close');
     if(close)try{close.click()}catch(_){}
     install(card);
   }
   render(card);
   const m=map();
   if(m&&m!==mapBound&&typeof m.on==='function'){
     mapBound=m;
     m.on('click',e=>{
       const c=active;
       if(!c?.project||!c.isConnected)return;
       const layer='gridatlas-offtakers-neon-dc-node';
       try{
         if(!m.getLayer(layer))return;
         const features=m.queryRenderedFeatures(e.point,{layers:[layer]});
         const key=features?.[0]?.properties?.id;
         const hit=/^([srv])(\d+)$/.exec(String(key||''));
         if(hit){navigate(c,hit[1],Number(hit[2]));e.preventDefault?.()}
       }catch(_){}
     });
   }
 }
 const timer=setInterval(sync,250);
 D.addEventListener('visibilitychange',sync);
 W.addEventListener('pagehide',()=>{shutdown=true;clearInterval(timer);observing?.disconnect();ROOT.removeAttribute('data-vicinity-focus')},{once:true});
 sync();
})();
