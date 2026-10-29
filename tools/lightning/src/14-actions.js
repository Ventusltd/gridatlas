/// 14 actions: period, navigation, load, the ON/OFF switch, the toggle binding and the HIDE LAYERS clearance.
///
/// sp: choose a period (resets the PREV/NEXT stack and the LOAD POINTS consent).
sp=p=>{///
    S.period=p;///
    S.consent=false;///
    S.end=null;///
    S.h=[];///
    if(p==='custom'&&!S.from)S.from=S.to=ymd(Date.now());///
    ld()///
  },
/// fb: the fit button: frame every drawn flash (a camera move: cm first).
fb=()=>{///
    let e=S.res&&S.res.ev,m=mh();///
    if(!e||!e.length||!m)return;///
    let a=180,b=90,c=-180,d=-90;///
    for(let f of e){///
      let[x,y]=f.geometry.coordinates;///
      a=MN(a,x);///
      b=MN(b,y);///
      c=MX(c,x);///
      d=MX(d,y)///
    }cm(m);///
    m.fitBounds([[a,b],[c,d]],{padding:40,maxZoom:9})///
  },
/// nv: PREV, NEXT, LATEST, FIT, LOAD POINTS and CUSTOM apply. LATEST closes the card and its links (LR-taps F1).
nv=(which,sf)=>{if(which==='fit')return fb();let now=Date.now(),w=wf(now);S.consent=which==='points';
if(which==='apply'){///
      let f=sf.from.value,t=sf.to.value,good=DRE.test(f)&&DRE.test(t)&&f<=t&&t<=ymd(now);///
      sf.from.style.borderColor=sf.to.style.borderColor=good?'':'#ff4444';
if(!good)return txt(sf.caps.warning,'Custom dates invalid — nothing loaded');S.from=f;S.to=t}
else if(which==='latest'){S.end=null;///
      S.h=[];///
      pc();///
///#if dots
///#else
      Ry();///
///#endif
      return ld(true)}else if(which==='prev')S.h.push(S.end),S.end=w.s;///
    else if(which==='next')S.end=S.h.pop()||null;
ld()},
/// ld: load and draw the current window; a newer load (S.serial) or OFF discards this one. The cell layer draws in its own
/// try, so a failed cell layer never marks the load FAIL (LR-regress m1). A period or page change closes the card.
ld=refresh=>{if(!refresh)pc(///
///#if dots
      );///
///#else
      ),Ry();///
///#endif
    let serial=++S.serial,now=Date.now();if(refresh)S.ip=S.fp=null;pt(true);
lw(now,serial).then(r=>({r}),e=>({e})).then(({r,e})=>{if(serial!==S.serial||!S.on)return;
if(e){note(e);r={mode:'fail',fail:msg(e),w:wf(now),idx:S.idx,ie:S.ie,fl:[],ev:[]}}
S.res=r;///
        r.s=serial;///
        try{///
          dw(FC(r.ev.map((f,i)=>({///
                    type:'Feature',id:f.id,geometry:f.geometry,properties:{i,s:serial}///
                  }))),!!r.cl)///
        }catch(err){///
          note('draw: '+err.message);///
          r.fail=r.fail||'map layer: '+err.message///
        }try{dd(r.gd)}catch(e){note('cells: '+msg(e))}pt(false)///
      })///
  },
/// so: switch ON (first request, map click listener, 10-minute refresh while at LATEST) or OFF (everything removed).
so=on=>{if(S.on===on)return;S.on=on;
if(on){///
      S.end=null;///
      S.consent=false;///
      S.res=null;///
      let m=mh();///
      if(m&&!S.ck&&typeof m.on==='function'){///
        S.ck=1;///
        m.on('click',tap);///
        m.on('resize',cpos);///
        m.on('moveend',()=>{if(S.on&&S.res&&!S.busy)pt(false)})///
      }
ld(true);if(!S.timer)S.timer=setInterval(()=>{if(S.on&&S.res&&S.res.w.atLatest)ld(true)},6e5)}
else{///
      S.serial++;///
      S.res=null;///
      cx();///
///#if dots
      if(S.rz){S.rz.disconnect();///
///#else
      Ry();///
      if(S.rz){S.rz.disconnect();///
///#endif
        S.rz=S.ro=null}if(S.timer){clearInterval(S.timer);///
        S.timer=null}pt(false)///
    }///
  },
/// bt: the panel's change listener (toggle). layers: a reader's tick or untick of a layer this module holds makes it the
/// reader's (the module's own dispatch runs with S.lyx set).
bt=c=>c.addEventListener('change',ev=>{///
///#if dots
      let t=ev.target;///
      if(t&&t.dataset&&t.dataset///
///#else
      let t=ev.target,d=t&&t.dataset;///
      if(!d)return;///
      if(d///
///#endif
        .lightningControl==='toggle')so(///
///#if dots
        !!t.checked)///
    }),
///#else
        !!t.checked);///
      else if(!S.lyx&&S.ly)S.ly.delete(d.layerId)///
    }),
///#endif
/// fit: keep Lightning-owned text clear of the shell's fixed HIDE LAYERS button (its live rect + 16 px; 96 px if absent).
fit=()=>{///
    let d=Q('gridatlas-dash-toggle'),b=d&&gr(d),v=b&&b.height;///
    if(d&&d!==S.ro&&typeof ResizeObserver=='function'){///
      if(S.rz)S.rz.disconnect();///
      (S.rz=new ResizeObserver(fit)).observe(S.ro=d)///
    }for(let sf of S.sfs){///
      let s=sf.group.style;///
      s.paddingBottom=(v?innerHeight-b.top+16:96)+'px';///
      s.paddingRight=(v?MX(0,gr(sf.group).right-b.left+16):0)+'px'///
    }///
  },
