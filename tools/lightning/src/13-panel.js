/// 13 panel: the Layers-panel group (main and fullscreen curtain), its label and status line, and the batched repaint pt.
///
/// BTN/NAV/DATE: the panel controls, in the shell's own classes. bg: build one panel group (key = main | fs); the menu's
/// bubble-phase click closer never sees these controls.
BTN=(a,t,x)=>`<button type="button" class="map-ctrl-btn" ${a}${x||''}>${t}</button>`,///
  NAV=(k,t,x)=>BTN(`data-lightning-nav="${k}"`,t,x),///
  ROW='style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0"',
DATE=k=>`<input type="date" class="search-input" data-lightning-date="${k}" aria-label="${k} date (UTC)" style="width:9.5em;color-scheme:dark">`,
bg=key=>{///
    let g=document.createElement('div');///
    g.className='key-group';///
    g.style.gridColumn='1/-1';///
    g.dataset.lightningGroup=key;
g.innerHTML=`<div class="key-title">${TITLE}</div><label class="key-item"><input type="checkbox" data-lightning-control="toggle"> <span data-lightning-label="${key}" style="color:#ffdf44">${BASE} [WAIT]</span></label>`
+`<div data-lightning-controls="${key}" hidden><div role="group" ${ROW}>${PERIODS.map(p=>BTN(`data-lightning-period="${p[0]}"`,p[0].toUpperCase())).join('')}</div>`
+`<div class="radius-input-row" data-lightning-custom style="display:none;flex-wrap:wrap;margin:4px 0"><span class="radius-unit">From (UTC)</span>${DATE('from')}<span class="radius-unit">To (incl.)</span>${DATE('to')}${NAV('apply','APPLY')}</div>`
+`<div ${ROW}>${NAV('prev','◀ PREV')}${NAV('latest','LATEST',' disabled')}${NAV('next','NEXT ▶',' disabled')}${NAV('points','LOAD POINTS',' hidden')}${NAV('fit','FIT FLASHES',' hidden')}</div>`
+`<div class="status-legend" style="border:0;margin:0;padding:2px 0"><div class="status-dot" style="color:#bbb"><span data-lightning-dot style="background:#888"></span>LOADING</div></div>`
+`<div id="gridatlas-lightning-caption-${key}" data-lightning-caption role="status" aria-live="polite" style="font:12px/1.5 'Courier New',monospace;color:#bbb;overflow-wrap:break-word">`
+['window','days','actual','flashes','refresh','searched','warning',///
      'footer'].map(k=>`<div data-cap="${k}"${k==='days'?' style="font-weight:bold"':k==='warning'?' style="color:#ffcc00"':k==='footer'?' style="font-size:11px;color:#bbb"':''}></div>`).join('')+'</div></div>';
if(ph())g.querySelectorAll('.map-ctrl-btn').forEach(b=>b.style.cssText+='min-height:44px;min-width:44px');
let q=s=>g.querySelector(s),sf={///
      key,group:g,toggle:q('[data-lightning-control]'),label:q('[data-lightning-label]'),ctl:q('[data-lightning-controls]'),custom:q('[data-lightning-custom]'),from:q('[data-lightning-date="from"]'),to:q('[data-lightning-date="to"]'),dot:q('[data-lightning-dot]'),stx:q('.status-dot').lastChild,caps:{},nav:{},chips:{}///
    };
g.querySelectorAll('[data-cap],[data-lightning-nav],[data-lightning-period]').forEach(n=>{///
        let d=n.dataset;///
        if(d.cap)sf.caps[d.cap]=n;///
        else if(d.lightningNav)sf.nav[d.lightningNav]=n;///
        else sf.chips[d.lightningPeriod]=n///
      });
g.addEventListener('click',ev=>{///
        let b=ev.target.closest('button');///
        if(!b||!g.contains(b))return;///
        if(b.dataset.lightningPeriod)sp(b.dataset.lightningPeriod);///
        else if(b.dataset.lightningNav)nv(b.dataset.lightningNav,sf)///
      });
return sf},
/// txt/flag: write only on change. lt: the Layers label ("Lightning Flashes (Optical) [...]"); sl: the status line.
txt=(n,s)=>{if(n&&n.textContent!==s)n.textContent=s},///
  flag=(n,a,on)=>{if(n)on?n.setAttribute(a,''):n.removeAttribute(a)},
lt=(r,c,loading)=>{///
    if(!S.on)return BASE+' [WAIT]';///
    if(loading)return BASE+' [LOAD]';///
    if(!r||c.st==='FAIL')return BASE+' [FAIL]';
let n=fn(r);///
    return`${BASE} [${r.mode==='feed'?(n?N(n):'none seen')+' | '+(r.old?'last 7 days only':'live feed'):/UNKNOWN|BEFORE/.test(c.st)?(r.before?'UNKNOWN':'not yet searched')+' | '+(r.before?'before archive':sv(r,c)):(n?N(n):'none found')+' | '+sv(r,c)}]`///
  },///
  fn=r=>r.mode==='overview'||r.mode==='detail'&&(r.sk.length||r.fl.length)?r.arch:r.ev.length,
sl=(r,c)=>{let st=c.st,n=fn(r),z=c.stale?' · '+lr(c.g,Date.now(),c.f).toUpperCase()+' · STALE':'';
return st==='FAIL'?'FAIL · '+c.rs.join('; ')+z:(r.mode==='feed'?`${pl(n,'flash','es')} · ${r.old?'last 7 days only · older not yet collected':'live 7-day feed · searched unknown'}`:/UNKNOWN|BEFORE/.test(st)?(r.before?'unknown':'not yet searched')+' · '+(r.before?'before archive (from '+dm(r.idx.cutoff)+')':sv(r,c)):`${n?(r.sk&&r.sk.length?N(r.ev.length)+' of ':'')+pl(n,'flash','es'):st==='EMPTY-COVERED'?'no flashes detected':'none found'} · ${sv(r,c,1)}`).toUpperCase()+z///
  },
/// pt: one batched repaint of every group: toggle, label, chips, CUSTOM, PREV/NEXT/LATEST, status dot and captions; S.last
/// is the published summary.
pt=loading=>{///
    S.busy=loading;///
    let now=Date.now(),r=S.res,c=r?cf(r,now):null,L=r?cp(r,now,c):null,text=lt(r,c,loading),fail=!!(c&&c.st==='FAIL'),w=r?r.w:null;
for(let sf of S.sfs){///
      if(sf.toggle.checked!==S.on)sf.toggle.checked=S.on;///
      txt(sf.label,text);///
      sf.label.style.opacity=fail?'0.6':'1'///
    }
for(let sf of S.sfs){flag(sf.ctl,'hidden',!S.on);if(!S.on)continue;
for(let k in sf.chips){///
        let b=sf.chips[k],na=!S.idx&&!!S.ie&&LONG.includes(k);///
        b.setAttribute('aria-pressed',b.classList.toggle('active',k===S.period));
if(LONG.includes(k)){///
          let d=b.lastChild;///
          if(!d||!d.tagName){///
            d=document.createElement('span');///
            d.style.opacity='.55';///
            ap(b,d)///
          }txt(d,na?' •':'');///
          b.title=na?'7-day feed only: the archive is not available yet':''///
        }///
      }
let cu=S.period==='custom';///
      sf.custom.style.display=cu?'flex':'none';///
      if(S.idx)sf.from.min=sf.to.min=S.idx.cutoffDate;///
      sf.from.max=sf.to.max=ymd(now);///
      if(sf.from.value!==S.from)sf.from.value=S.from;///
      if(sf.to.value!==S.to)sf.to.value=S.to;
sf.nav.prev.disabled=loading||cu||!S.idx||!w||w.s<=S.idx.covStart||w.s-w.span<S.idx.cutoff;///
      sf.nav.next.disabled=sf.nav.latest.disabled=loading||cu||!w||w.atLatest;///
      flag(sf.nav.points,'hidden',!(r&&r.clp&&!r.big));///
      flag(sf.nav.fit,'hidden',loading||!(r&&r.ev.length));
sf.dot.style.background=loading?COLOUR('L'):c.colour;///
      txt(sf.stx,loading?'LOADING':sl(r,c));///
      if(!loading){///
        for(let k in L)txt(sf.caps[k],L[k]);///
        if(c)sf.caps.days.style.color=c.colour///
      }///
    }
if(r&&!loading)S.last={///
      state:c.st,stale:c.stale,mode:r.mode,period:w.period,drawn:r.ev.length,cluster:!!r.cl,cap:cap(),cap_source:r.cs||null,index_count:r.ic===undefined?null:r.ic,failures:r.fl.length,reasons:c.rs,cells:r.gd?r.gd.fc.features.length:0///
    };///
    if(S.installed)fit()///
  },
