/// 01 helpers: date and number formatting, GeoJSON guards, the device cap, month arithmetic and the published state S.
///
/// ymd: UTC date; ds: date -> ms; Q: getElementById; E: throw. T/Ts: UTC minute/second text, 'unknown' if not finite.
ymd=t=>new Date(t).toISOString().slice(0,10),///
  ds=d=>DP(d+'T00:00:00Z'),///
  Q=id=>document.getElementById(id),///
  E=m=>{throw new TypeError(m)},
T=(t,n=16)=>isFinite(t)?new Date(t).toISOString().slice(0,n).replace('T',' ')+' UTC':'unknown',Ts=t=>T(t,19),
/// N: grouped number; pl: plural; dm/hm/dt: short date, hh:mm, both; du: duration in h/min (LR-words W8: hours grouped);
/// hz: a window of 48 h or less (hour clip); de: end text; sv: "x of y searched"; lr: when the collector last ran and how far
/// it searched; F7: the live-feed flash phrase; AGO: age, via du (LR-words W6).
N=n=>Number(n).toLocaleString('en-GB'),///
  pl=(n,w,s='s')=>N(n)+' '+w+(n==1?'':s),///
  dm=t=>{///
    let s=new Date(t).toUTCString(),y=s.slice(12,16);///
    return+s.slice(5,7)+s.slice(7,11)+(y==new Date().getUTCFullYear()?'':' '+y)///
  },///
  hm=t=>T(t).slice(11,16),///
  dt=t=>dm(t)+' '+hm(t),///
  du=m=>(m=Math.round(m/6e4),(m>59?N(m/60|0)+' h ':'')+(m%60||m<60?m%60+' min':'')).trim(),///
  hz=w=>!w.custom&&w.span<=2*DAY,///
  de=(a,b)=>dm(a)==dm(b)?hm(b):dt(b),///
  sv=(r,k,p)=>{///
    let v=r.cov,w=r.w,a=k&&/READY|EMPTY/.test(k.st);///
    return hz(w)?(a?'all ':(v.f>0?du(v.f*w.span):'0')+' of ')+w.label+' searched':(a?'all '+pl(v.d,'day'):`${v.k} of ${pl(v.d,'day')}`)+' searched'+(p&&v.pp?` (${v.pp} in part)`:'')///
  },///
  lr=(g,now,f)=>isFinite(g)?`collector last ran ${ymd(g)==ymd(now)?hm(g):dt(g)} UTC${f&&g-f>HOUR?`, searched to ${ymd(f)==ymd(now)?hm(f):dt(f)} UTC`:''}${g>now+9e5?' (device clock behind)':''}`:'collector last run unknown',///
  F7=r=>`${N(r.ev.length)} seen in the available 7-day feed · ${r.w.label} requested${r.old?' · older history unknown':''}`,///
  AGO=t=>t<0?'?':t<3e4?'<1 min':du(t),
/// ov: overlap of [a,b) and [c,d); FC: FeatureCollection; bx: inside the UK box; isFC; tm: a flash's time (Z added when
/// missing); msg: an error's text, sanitised by cs (LR-security S3).
ov=(a,b,c,d)=>MX(0,MN(b,d)-MX(a,c)),///
  FC=f=>({type:'FeatureCollection',features:f||[]}),///
  bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5,///
  isFC=o=>o&&o.type==='FeatureCollection'&&AI(o.features),///
  tm=f=>{///
    let s=f.properties.time_utc+'';///
    return DP(/T[\d:.]+$/.test(s)?s+'Z':s)///
  },///
  msg=e=>cs(e&&e.message||e),
/// The device point cap: 10,000 on a phone (coarse pointer or <= 700 px), else 40,000. Above it a window draws as cells.
ph=()=>{///
    try{///
      return matchMedia('(pointer: coarse)').matches||window.innerWidth<=700///
    }catch(_){return false}///
  },///
  cap=()=>ph()?10000:40000,
/// mm: t minus k calendar months, the day clamped to the target month (3M, 6M, 12M).
mm=(t,k)=>{///
    let d=new Date(t),day=d.getUTCDate();///
    d.setUTCDate(1);///
    d.setUTCMonth(d.getUTCMonth()-k);///
    d.setUTCDate(MN(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));///
    return d.getTime()///
  },
/// State machine (published as NS.ukLightning.state): installed, waiting_for, on, requests, errors, last; period, end and h
/// (the PREV/NEXT stack of window ends), from/to (CUSTOM), consent (LOAD POINTS), serial (cancels stale loads), idx/ie (index
/// and its error), res (the drawn result), sfs (the panel groups). lru: url -> {p: promise, sealed}.
S={///
    schema:'gridatlas.module.uk-lightning-overlay.v1',generation:GEN,installed:false,waiting_for:[],on:false,requests:0,errors:[],last:null,
period:'24h',end:null,h:[],from:'',to:'',consent:false,serial:0,idx:null,ie:null,res:null,sfs:[]///
  },///
  lru=new Map(),
