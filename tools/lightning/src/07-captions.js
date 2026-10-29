/// 07 state and captions: the state machine (cf) and the caption lines (cp). Unknown is never shown as zero.
///
/// cf: classify a result: FAIL, BEFORE-ARCHIVE, PARTIAL, UNKNOWN, READY·DETAIL, READY·OVERVIEW or EMPTY, with reasons.
cf=(r,now)=>{let st;let rs=[];
if(r.fail){st='FAIL';rs.push(r.fail)}else if(r.before){st='BEFORE-ARCHIVE';rs.push('before archive start')}
else if(r.fl.some(f=>!f.u)){st='FAIL';rs.push(`${r.fl.length} of ${r.rq} day files failed`)}
else{///
      let c=r.cov,f=c?c.f:0;///
      if(r.mode==='feed'){///
        st=r.ev.length?'PARTIAL':'UNKNOWN';///
        rs.push('coverage unknown')///
      }else if(!c||f<=0){st='UNKNOWN';///
        rs.push('nothing searched')}
else if(f<1||c.ny>0||c.l||c.u.length||r.fl.length){///
        st='PARTIAL';///
        if(c.ny>0)rs.push('tail unknown');///
        if(c.bf>0)rs.push('head unknown');///
        if(c.u.length)rs.push(`${c.u.length} unscanned dates`);///
        if(!rs.length)rs.push(r.fl.length?'unverified':'gaps in window')///
      }
else if(r.mode!=='overview')st=r.sk.length?(rs.push('days not loaded'),'PARTIAL'):r.ev.length?'READY·DETAIL':'EMPTY-COVERED';///
      else st=r.arch>0?r.gd?'READY·CELLS':'READY·SUMMARY':'EMPTY-COVERED'///
    }
let g=r.idx?r.idx.gen:r.meta?DP(r.meta.query_end_utc):NaN,f=r.idx&&r.idx.lastScan||g;///
    return{///
      st,g,f,stale:!!(r.idx||r.meta)&&r.w.atLatest!==false&&stale(g,now,f),colour:COLOUR(st),rs///
    }///
  },
/// DN: the cell caption (LR-words W1 with LRB3's reason): what the map shows, what is counted but not drawn.
DN=r=>{///
    let g=r.gd;///
    return`map shows ${N(g.k)} in ${pl(g.fc.features.length,'≈10 km cell')} within 30 km of a REPD site; ${N(g.n-g.k)} further out counted, not drawn${g.st?` · ${pl(g.st,'day')} not yet mapped (unknown${g.e?'; '+g.e:''})`:''} · tap a cell for nearest substations`///
  },
/// cp: the caption lines window, days, actual, flashes, refresh, searched, warning and footer. Every number is either
/// measured or named unknown; a day never searched is never zero (complexity 82: see reports/V-maintain.md).
cp=(r,now,k)=>{///
    let w=r.w,x=r.idx,v=r.cov,nz=` (${U})`,L={///
      window:'',days:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER///
    };
L.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(MX(w.s,w.e-1))} inclusive (${pl(Math.ceil(w.span/DAY),'day')}${w.atLatest?', to now':''})`:`Window  ${w.label} · ${dt(w.s)} → ${de(w.s,w.e)} UTC · ${w.atLatest?'latest':'earlier page'}`;
L.days=r.mode==='feed'?`${r.old?'Last 7 days only (live feed)':'Live 7-day feed'} · ${NA(r.ie)}${/404/.test(r.ie)?'':': '+r.ie} · ${r.old?'earlier days '+U:'hours searched unknown'}`:r.before?`Before the 1-year archive (from ${dm(x.cutoff)}): never searched${nz}`:!v?'':hz(w)?(v.f<=0?`None of the ${w.label} searched yet${nz}`:k&&/READY|EMPTY/.test(k.st)?`All ${w.label} searched (${dt(v.a)} → ${de(v.a,v.b)} UTC)`:`Searched ${du(v.f*w.span)} of ${w.label} (${dt(v.a)} → ${de(v.a,v.b)} UTC) · ${du(w.span*(1-v.f))} not searched${nz}`):!v.k?`None of the ${pl(v.d,'day')} searched yet${nz}`:`${v.k==v.d&&!v.pp?'All':v.k+' of'} ${pl(v.d,'day')} searched (${dm(v.fs)}${v.lz>v.fs?'–'+dm(v.lz):''}${v.pp?`, ${v.pp} in part`:''})${v.u.length?` · ${v.u.length} not yet searched`:''}${v.l?` · ${v.l} lost (integrity alert)`:''}${v.k<v.d?nz:''}`;
if(v&&v.bf>0&&v.f<=0&&x)L.days+=` · archive starts ${dm(x.covStart)}`;
if(w.clamped)L.window+=' · start clamped to retention start '+x.cutoffDate;
if(r.fail){L.warning=r.ie&&!x?`Archive unavailable: ${r.ie} — nothing shown (${U})`:r.fail;return L}
if(r.before){///
      L.warning=`Window predates the archive (began ${T(x.covStart)}; retention from ${x.cutoffDate}) — ${U}`;///
      return L///
    }
r.out=0;try{let b=mh().getBounds();r.out=r.ev.filter(f=>!b.contains(f.geometry.coordinates)).length}catch(_){}
let n=r.ev.length,first=n?`Actual  first ${Ts(tm(r.ev[0]))} · last ${Ts(tm(r.ev[n-1]))}`:'',
drawn=(!n?'':` · ${N(n)} drawn as ${r.cl?'clusters':'points'} (cap ${N(cap())})`)+(r.ev&&r.ev.bad?` · ${N(r.ev.bad)} malformed records rejected`:'')+(r.out?` · ${N(r.out)} of ${N(n)} outside the current view`:'');
if(r.mode==='feed'){let m=r.meta,P=(k,f=T)=>f(DP(m[k]));
L.refresh=`Refresh live feed ${P('query_end_utc')} (last collection window ${P('query_start_utc')} → ${P('query_end_utc')}; latest detection ${P('latest_detection_utc',Ts)}; 7-day retention; ${NA(r.ie)}: ${r.ie}; earlier hours ${U})`;
L.searched='Searched EUMETSAT unknown (live feed records only its last collection window)';///
      if(r.old)L.warning=NA(r.ie)+': earlier coverage '+U
L.actual=first||`Actual  none seen in the 7-day feed (${U})`;L.flashes=`Flashes ${F7(r)}${drawn}`}
else if(r.mode==='detail'){///
      L.actual=r.fl.length?'Actual  unknown (day files failed)':first||'Actual  no archived flashes within this window';
L.flashes=(r.sk.length?`Flashes ${N(r.arch)} archived on the overlapping UTC dates (index, whole days) · ${N(n)} downloaded from the newest ${r.ld.length} of ${r.ld.length+r.sk.length} days (budget ${N(BUDGET)} flashes / 32 MB; ${r.sk.length} days not loaded)${drawn}`:`Flashes ${r.fl.length?`${N(r.ic)} in index · ${N(n)} loaded`:N(n)+' archived in window'}${drawn}`)+(r.gd?' · '+DN(r):'')///
    }
else{let o=r.rows.filter(y=>y.first_observation_utc),k=r.rows.length;
L.actual=o.length?`Actual  on the ${k} overlapping UTC dates: first ${Ts(DP(o[0].first_observation_utc))} · last ${Ts(DP(o[o.length-1].last_observation_utc))} (whole UTC days)`:`Actual  no archived flashes on the ${k} overlapping UTC dates`;
L.flashes=`Flashes ${N(r.arch)} archived on ${k} overlapping UTC dates · ${r.gd?`${DN(r)}${r.clp&&!r.big?` · LOAD POINTS adds the newest ${N(MN(BUDGET,r.arch))} flashes`:''}`:`none drawn (summary mode; ${r.clp?`index sum ${r.budget} exceeds the budget; ${r.big?'newest day alone exceeds it; none drawn':`LOAD POINTS draws up to the newest ${N(BUDGET)}`}`:'points load automatically within the budget'})${r.ge?' · cell grid '+r.ge:''}`}`///
    }
if(x)L.refresh=`Refresh archive ${T(x.gen)} (${AGO(now-x.gen)} ago; expected every ${x.iv} h)${stale(x.gen,now,x.lastScan||x.gen)?' · overdue':''}`;
let c=r.mode!=='feed'&&r.cov;if(c){let warn=[];
L.searched=c.f>0?`Searched EUMETSAT ${du(c.f*w.span)} of ${du(w.span)}${c.a!==null?` · ${T(c.a)} → ${T(c.b)}`:''}`:c.l?'Searched EUMETSAT: shard lost (integrity alert), '+U:'Searched EUMETSAT none of this window — no collection run covers it';
if(c.ny>0)warn.push(`Not yet searched: last ${AGO(c.ny)} of window (${U})`);
if(c.bf>0&&x&&!c.u.length)warn.push(`Unknown: ${ymd(w.s)} to ${ymd(MN(w.e,x.covStart)-1)} precede archive start ${T(x.covStart)} (not zero)`);
if(c.l)warn.push(`${c.l} days lost from the archive (integrity alert), ${U}`);///
      if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);
if(r.fl.length)warn.push(`${r.fl.length} of ${r.rq} day files failed (${r.fl.map(f=>f.date+' '+f.error).join(', ')}); points incomplete, counts from index`);
let ub=(r.rows||[]).filter(y=>[y.first_observation_utc,y.last_observation_utc].some(t=>t!=null&&!isFinite(DP(t)))).length;///
      if(ub)warn.push(`${N(ub)} archive entr${ub==1?'y':'ies'} unreadable (malformed timestamp; ${U})`);
if(c.f<1&&!warn.length)warn.push('Unknown: gaps between collection runs inside this window (not zero)');///
      L.warning=warn.join(' · ')///
    }
if(k&&/UNK|PAR/.test(k.st)&&/^Flashes 0 a/.test(L.flashes))L.flashes+=' (gaps unknown)'
if(v&&v.f<=0&&!v.l&&r.mode!=='feed'&&!r.fl.length){///
      L.flashes='Flashes not yet searched'+nz;///
      L.actual='Actual  not yet searched'///
    }
return L},
