// savings.mjs - byte savings applied on top of H01..H05 for the combined diff. Each is behaviour-preserving:
// S1 same strings from one ISO slice (both old and new throw RangeError on an invalid time);
// S2 result fields that no reader consults for that result kind (verified by grep: ff results never reach the
// detail-only r.ld/r.sk reads; before-archive and fail results return from cp() before rows/cov/arch are read;
// clp is only ever tested for truthiness).
export const SAVINGS = [
  // S1: T/Ts formatters
  ["T=t=>{const d=new Date(t);return`${ymd(t)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`},Ts=t=>T(t).replace(' UTC',`:${pad(new Date(t).getUTCSeconds())} UTC`),",
   "T=(t,n=16)=>new Date(t).toISOString().slice(0,n).replace('T',' ')+' UTC',Ts=t=>T(t,19),"],
  // S2: unread placeholder fields
  ["cl:ev.length>cap(),ld:[],sk:[],cov:", "cl:ev.length>cap(),cov:"],
  ["before:true,rows:[],cov:null,fl:[],ev:[],arch:0}", "before:true,fl:[],ev:[],arch:0}"],
  ["ld:[],sk:[],clp:false};", "ld:[],sk:[]};"],
  ["fl:[],ev:[],rows:[],arch:0}", "fl:[],ev:[]}"],
  // S3: the feed caption's P() formats latest_detection_utc too (same text: Ts(...) when present, else 'unknown')
  ["P=k=>m[k]?T(Date.parse(m[k])):'unknown';", "P=(k,f=T)=>m[k]?f(Date.parse(m[k])):'unknown';"],
  ["latest detection ${m.latest_detection_utc?Ts(Date.parse(m.latest_detection_utc)):'unknown'};", "latest detection ${P('latest_detection_utc',Ts)};"],
];
