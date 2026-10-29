/// 06 tiers: the live feed (7 days only), the archive overview (cells), the archive detail (points, budgeted).
///
/// ff: the live feed tier (7 days only); reason names why the archive was not used.
ff=async(w,now,reason)=>{
let f=await(S.fp||(S.fp=gx(FEED).catch(e=>{S.fp=null;throw e})));if(!isFC(f))E('invalid live feed');
let ev=co([f.features],w.s,w.e);
return{///
      mode:'feed',w,idx:null,ie:reason,meta:f.metadata||{},old:w.s<now-7*DAY,ev,fl:[],cs:'live feed',ic:ev.length,cl:ev.length>cap(),cov:null///
    }},
/// lw: load a window: the index, then BEFORE-ARCHIVE, overview (cells) or detail (points). Within the device cap, 32 MB and
/// RQ files, points load for any window; above, cells draw and LOAD POINTS asks first (S.consent). arch counts whole UTC
/// days above 48 h (LR-bugs LRB4 + LR-numbers F1), J's hour clip at 48 h or less.
lw=async(now,sn,q)=>{let w=wf(now);let x=null,ie=null;try{x=await li(q)}catch(e){ie=msg(e)}
if(!x)return ff(w,now,ie);
if(w.e<=x.cutoff)return{mode:'overview',w,idx:x,before:true,fl:[],ev:[],arch:0};
if(w.s<x.cutoff){w.s=x.cutoff;w.span=w.e-w.s;w.clamped=true}
let rows=[...x.by.values()].filter(y=>{let f=ds(y.date);///
        return f<w.e&&f+DAY>w.s}),known=rows.filter(y=>y.count!==null),
r={///
      mode:'overview',w,idx:x,before:false,rows,arch:known.reduce((n,y)=>n+(y.parts&&hz(w)?tg(y,w.s,w.e).reduce((a,p)=>a+p.count,0):y.count),///
        0),cov:cv(x,w.s,w.e),fl:[],ev:[],ld:[],sk:[]///
    };
let tf=rows.filter(y=>y.count>0),bytes=0,count=0,nq=0;
for(let row of tf)for(let t of tg(row,w.s,w.e)){///
      nq++;///
      count+=t.count||0;///
      bytes+=t.bytes>0?t.bytes:(t.count||0)*530///
    }
if(count>MN(BUDGET,cap())||bytes>32e6||nq>RQ){///
      r.budget=`${N(count)} flashes, ${N(bytes)} bytes, ${N(nq)} files`;///
      try{r.gd=await gd(rows,sn)}catch(e){r.ge=NA(msg(e))+': '+msg(e)}if(sn!==S.serial)return r;///
      if(!S.consent){r.clp=true;///
        return r}
let run=0,rb=0,rn=0;///
      tf.sort((a,b)=>b.date.localeCompare(a.date));///
      let keep=[];///
      for(let y of tf){///
        let ps=tg(y,w.s,w.e),c=ps.reduce((a,p)=>a+(p.count||0),0),b=ps.reduce((a,p)=>a+(p.bytes>0?p.bytes:(p.count||0)*530),0),q=ps.length;///
        if(r.sk.length||run+c>BUDGET||rb+b>32e6||rn+q>RQ){r.sk.push(y.date);///
          continue}keep.push(y);///
        run+=c;///
        rb+=b;///
        rn+=q///
      }if(!keep.length){r.clp=r.big=1;///
        return r}tf=keep;///
      count=run///
    }
r.ld=tf.map(y=>y.date);r.ic=count;r.cs='index';r.cl=count>cap();
/// A sha256 mismatch on an unsealed day means the archive is being rewritten: reload the index once, then say so.
let got=await fr(tf,w.s,w.e,sn);///
    for(let f of got.fl)if(/WebCrypto/.test(f.error))f.u=1;///
    else if(!f.t.sealed&&/mismatch/.test(f.error)){///
      if(!q){S.ip=null;///
        return lw(now,sn,now)}f.error+='; archive updating, reload later';///
      f.u=1///
    }r.mode='detail';///
    r.fl=got.fl;///
    r.rq=got.rq;///
    r.ev=co(got.parts,w.s,w.e);///
    return r///
  },
