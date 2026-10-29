/// 03 archive index v2 (Ventusltd/lightning data/history/index.json): every row validated; coverage from scan_windows.
///
/// vk: one index v2 row; parts are hourly days/YYYY/MM/DD/HH.json with integer counts; a bad row throws with its date.
vk=r=>{///
    let n=r&&r.count,b=w=>E(`invalid index row ${r&&r.date}: ${w}`);///
    if(!r||ymd(ds(r.date)||0)!=r.date)b('date');///
    if(!['none','partial','full'].includes(r.coverage))b('coverage');
if(r.coverage==='none'?n!==null:n>>>0!==n)b('count');///
    if(n===0&&!(r.scanned_seconds>0))b('count 0 unscanned');///
    if(n>0&&!r.path&&!(r.parts&&r.parts.length))b('no path/parts');
if(r.path&&!/^days\/\d{4}\/\d{2}\/\d{2}\.json$/.test(r.path))b('path');///
    if(typeof r.sealed!=='boolean')b('sealed');
if(r.parts&&!(AI(r.parts)&&r.parts.length<=24&&r.parts.every(p=>p&&/^days\/\d{4}(\/\d\d){3}\.json$/.test(p.path)&&(p.count>>>0||-1)===p.count)))b('parts')///
  },
/// ni: normalise the index: schema, observation, generated_utc, cutoff and the scan windows; by = date -> row; lost
/// (shard_lost) days are unknown, never searched.
ni=raw=>{if(!raw||typeof raw!=='object'||!AI(raw.days))E('not a lightning history index');
if(raw.schema!==IX_SCHEMA)E('unsupported index schema '+raw.schema);
if(raw.observation!=='satellite optical lightning flashes, not ground strikes')E('index observation missing');
let gen=DP(raw.generated_utc);///
    if(!isFinite(gen))E('index generated_utc missing');///
    if(!DRE.test(raw.cutoff_date_utc||''))E('index cutoff_date_utc missing');
raw.days.forEach(vk);
let sw=(raw.scan_windows||[]).map(w=>({///
          s:DP(w.start_utc),e:DP(w.end_utc),n:Number(w.successful_runs)||1///
        })).filter(w=>isFinite(w.s)&&isFinite(w.e)&&w.e>w.s).sort((a,b)=>a.s-b.s),
cutoff=ds(raw.cutoff_date_utc),iv=Number(raw.collection_interval_hours)||3;
return{///
      days:raw.days,by:new Map(raw.days.map(r=>[r.date,r])),sw,gen,cutoff,iv,nextDue:DP(raw.next_update_due_utc||'')||gen+(iv+1)*HOUR,lastScan:sw.length?sw.reduce((a,w)=>MX(a,w.e),-Infinity):null,
covStart:DP(raw.coverage_start_utc||'')||(sw.length?sw[0].s:cutoff),cutoffDate:raw.cutoff_date_utc,lost:new Set(raw.days.filter(r=>r.shard_lost).map(r=>r.date))///
    }///
  },
/// stale: the archive last searched more than 4 h ago, or its index is dated more than 15 min after the device clock.
stale=(g,now,f=g)=>!(now-f<=4*HOUR&&g<=now+9e5),
/// li: load the index once (q busts the cache after a mismatch); unsealed LRU entries are dropped when it changes.
li=q=>{///
    if(!S.ip){///
      let p=S.ip=gj(AR+'index.json'+(q?'?'+q:''),'no-cache').then(ni).then(m=>{///
          if(S.ip===p){///
            for(let k of[...lru.keys()])if(!lru.get(k).sealed)lru.delete(k);///
            S.idx=m;///
            S.ie=null///
          }return m///
        }).catch(e=>{///
          if(S.ip===p){S.ip=null;///
            S.idx=null;///
            S.ie=msg(e)}throw e///
        })///
    }return S.ip///
  },
/// cv: coverage of [ws,we) from scan_windows (union): f fraction searched, r runs, a/b first/last scan, d dates, u unknown
/// dates, l lost days, ny not yet searched (ms at the end), bf before the archive (ms), k known days, pp partly searched days.
cv=(x,ws,we)=>{let win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0,l=0,fs=null,lz,pp=0;
for(let w of x.sw){///
      let o=ov(MX(ws,b),we,w.s,w.e);///
      if(o<=0)continue;///
      sd+=o;///
      r+=w.n;///
      let s=MX(ws,w.s),e=MN(we,w.e);///
      a=a===null?s:MN(a,s);///
      b=b===null?e:MX(b,e)///
    }
for(let t=ds(ymd(ws));///
      t<we;///
      t+=DAY){///
      if(ov(ws,we,t,t+DAY)<=0)continue;///
      d++;///
      let y=ymd(t),row=x.by.get(y);///
      if(x.lost.has(y)){///
        l++;///
        let m=t;///
        for(let w of x.sw)sd-=ov(MX(ws,m),MN(we,t+DAY),w.s,w.e),m=MX(m,w.e)///
      }else if(!row||row.coverage==='none')u.push(y);///
      else{fs??=t;///
        lz=t;///
        pp+=row.coverage==='partial'}///
    }
return{///
      f:win>0?MN(1,sd/win):0,r,a,b,d,u,l,fs,lz,pp,k:d-u.length-l,ny:x.lastScan===null?win:MX(0,we-MX(ws,x.lastScan)),bf:MX(0,MN(we,x.covStart)-ws)///
    }///
  },
