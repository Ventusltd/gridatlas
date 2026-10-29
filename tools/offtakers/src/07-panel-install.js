/// ---- the Layers group ----
BTN=(a,t)=>`<button type="button" class="map-ctrl-btn" ${a}>${t}</button>`,
bg=key=>{let g=document.createElement('div');g.className='key-group';g.style.gridColumn='1/-1';g.dataset.offtakersGroup=key;
 g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-offtakers-control="toggle"> <span data-offtakers-label="${key}" style="color:#8fb4ff">${BASE}</span></label>`
 +`<div data-offtakers-controls="${key}" hidden><div role="group" aria-label="Offtaker classes" style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">${BTN('data-offtakers-all','All')}${CK.map(k=>BTN(`data-offtakers-class="${k}" aria-pressed="false"`,CLS[k][0])).join('')}</div>`
 +`<div role="group" aria-label="Power station status" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:4px 0"><span style="font-size:11px;color:#bbb">Power stations:</span>${BK.map(k=>BTN(`data-offtakers-bst="${k}" aria-pressed="true"`,BST[k])).join('')}</div>`
 +`</div><div data-offtakers-status role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word"></div><div data-offtakers-foot hidden style="font-size:11px;color:#bbb">${LEG} ${FOOT}</div>`;
 g.querySelectorAll('.map-ctrl-btn').forEach(b=>{b.style.cssText+='min-height:44px;min-width:44px';let k=b.dataset.offtakersClass||(b.dataset.offtakersBst?'b':'');if(k)b.style.borderLeft='4px solid '+CLS[k][1]});
 let q=s=>g.querySelector(s),o={key,group:g,toggle:q('[data-offtakers-control]'),label:q('[data-offtakers-label]'),ctl:q('[data-offtakers-controls]'),st:q('[data-offtakers-status]'),ft:q('[data-offtakers-foot]'),chips:{}};
 o.bchips={};g.querySelectorAll('[data-offtakers-class]').forEach(b=>o.chips[b.dataset.offtakersClass]=b);g.querySelectorAll('[data-offtakers-bst]').forEach(b=>o.bchips[b.dataset.offtakersBst]=b);
 g.addEventListener('click',ev=>{let b=ev.target.closest('button');if(!b||!g.contains(b))return;let d=b.dataset;if(d.offtakersClass)S.cls[d.offtakersClass]=!S.cls[d.offtakersClass];else if(d.offtakersBst)S.bst[d.offtakersBst]=!S.bst[d.offtakersBst];else if(d.offtakersAll!=null){for(let k of CK)S.cls[k]=!!CLS[k][5];for(let k of BK)S.bst[k]=true}else return;
  rf();let r=S.pp&&S.pp.r;if(r&&(!S.cls[r.k]||r.k=='b'&&!S.bst[r.t]))pc();pt()});
 g.addEventListener('change',ev=>{let t=ev.target;if(t&&t.dataset&&t.dataset.offtakersControl==='toggle')so(!!t.checked)});return o},
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},
pt=()=>{let d=S.data,n=d?d.dots.filter(r=>S.cls[r.k]&&(r.k!='b'||S.bst[r.t])).length:0,lab=!S.on?BASE:S.busy?BASE+' [LOAD]':S.err?BASE+' [FAIL]':`${BASE} [${N(n)} sites]`,
 st=!S.on?'':S.busy?'Loading the pinned open data…':S.err?'Nothing drawn: '+S.err:`${N(n)} sites drawn (${CK.filter(k=>S.cls[k]).map(k=>CLS[k][0]+' '+N(d.counts[k])).join(' · ')||'no class selected'}) · tap a site for its 15 nearest REPD sites and 5 nearest substations (straight line)`;
 for(let o of S.sfs){if(o.toggle.checked!==S.on)o.toggle.checked=S.on;txt(o.label,lab);o.label.style.opacity=S.err?'0.8':'1';o.ctl.hidden=o.ft.hidden=!S.on;txt(o.st,st);
  for(let k in o.chips){let b=o.chips[k];b.setAttribute('aria-pressed',S.cls[k]);b.classList.toggle('active',S.cls[k])}
  for(let k in o.bchips){let b=o.bchips[k];b.setAttribute('aria-pressed',S.bst[k]);b.classList.toggle('active',S.bst[k])}}if(S.installed)fit()},
ld=async()=>{let sn=++S.serial;S.busy=true;S.err=null;pt();
 try{let o=await rd();if(sn!==S.serial||!S.on)return;S.data=S.data||nm(o.features);S.from=DATA;dw();top()}
 catch(e){if(sn!==S.serial)return;S.err=msg(e);note(e);cx()}finally{if(sn===S.serial){S.busy=false;pt()}}},
so=on=>{if(S.on===on)return;S.on=on;let m=mh();
 if(on){if(m&&typeof m.on==='function'){m.on('click',tap);m.on('resize',cpos)}W.addEventListener('gridatlas:card-open',co);ld()}
 else{S.serial++;S.busy=false;S.err=null;cx();if(m&&typeof m.off==='function'){m.off('click',tap);m.off('resize',cpos);m.off('moveend',cw)}W.removeEventListener('gridatlas:card-open',co);pt()}},
fit=()=>{let d=Q('gridatlas-dash-toggle'),b=d&&gr(d),v=b&&b.height;for(let o of S.sfs){let g=o.group,last=!g.nextElementSibling,s=g.style;s.paddingBottom=last?(v?innerHeight-b.top+16:96)+'px':'';s.paddingRight=last&&v?MX(0,gr(g).right-b.left+16)+'px':''}},
put=(host,o)=>{let lg=host.querySelector('[data-lightning-group]');lg?host.insertBefore(o.group,lg):ap(host,o.group);S.sfs.push(o)},
ins=()=>{if(S.installed)return true;let M=NS.menuBar,P=W.__GRIDATLAS_PIPELINE_LAYERS__,host=Q('scada-ui-container'),miss=[];
 if(!(M&&M.installed===true))miss.push('menuBar');if(!(P&&P.installed))miss.push('pipelineLayers');if(!mh())miss.push('map');if(!host||!host.querySelector('.key-group'))miss.push('groups');S.waiting_for=miss;if(miss.length)return false;
 put(host,bg('main'));let cur=Q('fs-curtain-keys');if(cur)put(cur,bg('fs'));S.installed=true;pt();for(let t of[0,1e3,5e3])setTimeout(fit,t);return true};
if(typeof setInterval==='function'&&typeof MutationObserver==='function'){let ob=new MutationObserver(()=>tick()),poll=setInterval(()=>tick(),250),
 tick=()=>{try{if(ins()){clearInterval(poll);ob.disconnect()}}catch(e){note('install: '+msg(e))}};ob.observe(document.documentElement,{childList:true,subtree:true})}
NS.ukOfftakers=Object.freeze({schema:S.schema,generation:GEN,state:S,install:ins,setOn:so});
})();
