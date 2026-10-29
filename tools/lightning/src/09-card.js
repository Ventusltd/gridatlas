/// 09 card: the docked card (flash, cell or REPD project), the cell card and the short flash ID.
///
/// cd: the card. lb aria label, ti title, su summary, de detail, wh what was tapped ("optical flash" | "cell centre" |
/// "project"); o: np (no REPD list: the project view), open, foot, back [label, action], g (dots: the site to draw).
/// c.re re-opens the same card (for "◀ back"); the title wraps (LR-layout). M2R-layout F3: re-frame on expand, collapse and
/// minimise. M2R-a11y MAJOR-1: one visually hidden polite status region per card, outside the closed <details>.
/// M6 (owner, iPhone 03:05 UTC: "the list is not there"): the list was rendered but inside the collapsed <details>.
/// The card now opens by default (o.open===0 keeps it closed) as a half-height panel (cpos: max 45 % of the map) that
/// scrolls inside; the "−" minimise is replaced by a toggle that says what it does and reflects the real state
/// ("▾ Hide list" / "▸ Show 10 sites"; c.n is the number of listed sites, set by RpR). T: one handler for the button
/// and the details toggle event; it reframes only when the open state really changed (c.dO), so the default open
/// never adds a camera move to the arrival.
cd=(m,x,y,lb,ti,su,de,wh,o={})=>{///
    let c=el('div','position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;background:#000;color:#e8f4f5;border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25);font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain'),
bar=el('div','display:flex;align-items:center;gap:6px;padding-left:8px;background:#0a1a1d;border-bottom:1px solid #1d3238'),bd=el('div',///
      'padding:0 8px 6px'),d=el('details'),rf=()=>{cpos();///
      if(S.pp===c)ck(1)},
B=(t,a,f)=>{///
      let e=el('button','flex:none;width:44px;height:44px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:14px/1 monospace;cursor:pointer',t);///
      e.type='button';///
      e.setAttribute('aria-label',a);///
      e.addEventListener('click',f);///
      ap(bar,e);///
      return e///
    };
c.dataset.lightningCard='';///
    c.setAttribute('role','dialog');///
    c.setAttribute('aria-label',lb);///
    c.wh=wh;///
    c.o=o;///
    c.re=open=>cd(m,x,y,lb,ti,su,de,wh,{...o,open});
ap(bar,el('span','flex:1;min-width:0;color:#5fbdc2;font-weight:bold',ti));
let T=()=>{///
        c.u();///
        if(d.open!=c.dO){c.dO=d.open;///
          rf()}///
      },mn=B('','',()=>{///
        d.open=!d.open;///
        T()///
      });///
    mn.style.width='auto';///
    mn.style.padding='0 8px';///
    mn.style.fontSize='12px';///
    c.u=(t=d.open?'▾ Hide '+(o.np?'details':'list'):'▸ Show '+(c.n?pl(c.n,'site'):o.np?'details':'list'))=>{///
        mn.textContent=t;///
        mn.setAttribute('aria-label',t.slice(2));///
        mn.setAttribute('aria-expanded',d.open)///
      };///
    d.addEventListener('toggle',T);///
    B('×','Close',///
///#if dots
      pc);
///#else
      ()=>{pc();///
        Ry()});
///#endif
c.sm=el('summary','padding:14px 0 13px;line-height:17px;cursor:pointer;color:#bfe9ee',su);ap(d,c.sm);
c.out=el('div','margin-top:4px;color:#9fb3ba');///
    ap(d,c.out);///
    ap(d,el('div','color:#8b9aa1;font-size:11px;overflow-wrap:anywhere',de));///
    if(o.back){///
      let k=ap(bd,el('button','display:block;width:100%;min-height:44px;margin:8px 0 2px;background:#050a0d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:12px/1 monospace;text-align:left;padding:0 10px;cursor:pointer',o.back[0]));///
      k.type='button';///
      k.dataset.lightningBack='';///
      k.setAttribute('aria-label',o.back[0].slice(2));///
      k.addEventListener('click',o.back[1])///
    }ap(bd,d);///
    c.dO=d.open=o.open!==0;///
    c.u();
ap(bd,el('div','color:#8b9aa1;font-size:11px',o.foot||'EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike.'));
ap(c,bar);///
    ap(c,bd);///
    c.lv=ap(c,el('div','position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)'));///
    c.lv.setAttribute('role','status');///
    S.pp=c;///
    ap(m.getContainer(),c);///
    cpos();///
    nf(m,c,x,y,15)///
  },
/// cb: a cell's south-west corner, only for a well-formed cell of the drawn result (LR-security S2: safe-integer n).
/// cc: the cell card (LR-words W3; M5 V-geometry G3-G4b: "N optical flashes in this 0.1° cell", and the real cell size at
/// this latitude: E–W = 11.156·cos(lat) km (WGS84, max error 2.3 m over the UK rows), N–S ≈ 11.1 km).
cb=p=>{///
    let c=p.cell,w=-11+c%140/10,s=49.5+(c-c%140)/1400;///
    return c>>>0===c&&c<16800&&Number.isSafeInteger(p.n)&&p.n>0&&p.lon>w&&p.lon<w+.1&&p.lat>s&&p.lat<s+.1&&S.res&&(p.s==null||p.s===S.res.s)?[w,s]:null///
  },
cc=(m,p)=>{///
    let[w,s]=cb(p),W=S.res.w,r=a=>a.toFixed(2)+'–'+(a+.1).toFixed(2),///
      x=11.156*Math.cos(p.lat*Math.PI/180);///
    cd(m,p.lon,p.lat,'Lightning cell',pl(p.n,'optical flash','es')+' in this 0.1° cell',///
      `${ymd(W.s)} to ${ymd(MX(W.s,W.e-1))} UTC · centre lat ${p.lat.toFixed(3)}, lon ${p.lon.toFixed(3)}`,///
      `Cell lat ${r(s)}, lon ${r(w)}: 0.1°, ≈${x.toFixed(1)} km E–W × 11.1 km N–S, ≈${x*11.13+.5|0} km² here; the centre is not a flash location · searched UTC days only; unsearched days ${U}`,'cell centre')///
  },
/// sid: short ID = product sensing window + flash index (W_XX-..._<start>_<end>_N__..._0000:<index>); the full ID stays
/// in the detail line.
sid=s=>{///
    let r=/_\d{8}(\d\d)(\d\d)\d\d_\d{8}(\d\d)(\d\d)\d\d_N_.*:(\d+)$/.exec(s);///
    return r?`${r[1]}:${r[2]}–${r[3]}:${r[4]} #${r[5]}`:s.length>24?s.slice(0,12)+'…'+s.slice(-8):s///
  },
