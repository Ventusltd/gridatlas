/// 04 windows and day files: UTC, end-anchored [start,end) windows; hourly or daily shard targets; a 4-wide fan-out.
///
/// wf: the window {s, e, span, atLatest, period, label, clamped, custom}; S.end anchors PREV/NEXT, CUSTOM uses whole UTC dates.
wf=now=>{let P=PERIODS.find(p=>p[0]===S.period)||PERIODS[1],cu=S.period==='custom';let s,e,atLatest;
if(cu){///
      s=ds(S.from);///
      e=MN(ds(S.to)+DAY,now);///
      atLatest=ds(S.to)+DAY>=now///
    }else{///
      e=S.end===null?now:MN(S.end,now);///
      atLatest=S.end===null;///
      s=P[2]<0?mm(e,-P[2]):e-P[2]///
    }
return{s,e,atLatest,period:P[0],label:P[1],span:e-s,clamped:false,custom:cu}},
/// tg: the shard targets of one index row inside the window (a daily file, or the hourly parts that overlap it).
tg=(row,ws,we)=>!row||!row.count?[]:row.path?[row]
:(row.parts||[]).filter(p=>{///
      let h=ds(row.date)+p.path.slice(-7,-5)*HOUR;///
      return h<we&&h+HOUR>ws///
    }).map(p=>({...p,sealed:row.sealed})),
/// sh: fetch one day file (the HTTP cache is used only for a sealed day), check schema, date, count, bytes and sha256 against its index row.
sh=(t,date)=>{let u=AR+t.path,c=lg(u);if(c)return c.p;
let p=gj(u,t.sealed?'default':'no-cache',1).then(async b=>{///
        let o=b.byteLength>=0?await new Response(b).json():b,s=(window.crypto||0).subtle;
if(!isFC(o)||o.schema!=='uk-lightning-history-day.v1'||!o.metadata||o.metadata.date_utc!==date)E('invalid day file');
let bad=[o.features.length!==t.count&&'count',b.byteLength!==t.bytes&&'bytes',///
          s&&[...new Uint8Array(await s.digest('SHA-256',b))].map(x=>(x|256).toString(16).slice(1)).join('')!==t.sha256&&'sha256'].filter(Boolean);
if(bad.length)E('index mismatch: '+bad.join(', '));///
        if(!s&&t.sha256)E('not verified (no WebCrypto)');///
        return o.features///
      }).catch(e=>{lru.delete(u);///
        throw e});
ls(u,{p,sealed:!!t.sealed});return p},
/// fr: fan out over the shard targets, 4 at a time, abandoned when S.serial moves on; failures are kept per day.
fr=async(rows,ws,we,sn)=>{///
    let jobs=[];///
    for(let row of rows)for(let t of tg(row,ws,we))jobs.push({row,t});///
    let parts=new Array(jobs.length),fl=[];///
    let pos=0;
await Promise.all(Array.from({length:MN(4,jobs.length)},async()=>{///
          while(pos<jobs.length&&sn===S.serial){///
            let i=pos++,{row,t}=jobs[i];///
            try{parts[i]=await sh(t,row.date)}catch(e){///
              parts[i]=[];///
              fl.push({date:row.date,error:msg(e),t})///
            }///
          }///
        }));
return{parts,fl,rq:jobs.length}},
