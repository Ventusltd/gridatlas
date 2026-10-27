// kv-words: exact old -> new edits against fixed-module-I.js. Each old string must occur exactly once.
// Usage: node edits.mjs <in> <out>   Prints per-edit line number in the INPUT and byte delta.
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
let s = readFileSync(inp, 'utf8');
const orig = s;
const B = x => Buffer.byteLength(x);
const E = [
['W1 helpers: plural, short date, HH:MM, duration, scope, last-run',
 "N=n=>Number(n).toLocaleString('en-GB'),",
 "N=n=>Number(n).toLocaleString('en-GB'),pl=(n,w,s='s')=>N(n)+' '+w+(n==1?'':s),dm=t=>{const s=new Date(t).toUTCString(),y=s.slice(12,16);return+s.slice(5,7)+s.slice(7,11)+(y==new Date().getUTCFullYear()?'':' '+y)},hm=t=>T(t).slice(11,16),dt=t=>dm(t)+' '+hm(t),du=m=>(m=Math.round(m/6e4),(m>59?Math.floor(m/60)+' h ':'')+(m%60||m<60?m%60+' min':'')).trim(),hz=w=>!w.custom&&w.span<=2*DAY,de=(a,b)=>dm(a)==dm(b)?hm(b):dt(b),"
 + "sv=(r,k,p)=>{const v=r.cov,w=r.w,a=k&&/READY|EMPTY/.test(k.st);return hz(w)?(a?'all ':(v.f>0?du(v.f*w.span):'0')+' of ')+w.label+' searched':(a?'all '+pl(v.d,'day'):`${v.k} of ${pl(v.d,'day')}`)+' searched'+(p&&v.pp?` (${v.pp} in part)`:'')},"
 + "lr=(g,now)=>isFinite(g)?`collector last ran ${ymd(g)==ymd(now)?hm(g):dt(g)} UTC${g>now+9e5?' (device clock behind)':''}`:'collector last run unknown',"],
['W2 stale = collector age over 4 h (or ahead of the device clock, or unknown); nextDue no longer flags',
 "stale=(x,now)=>!(now-x.gen<=4*HOUR&&x.gen<=now+9e5)||now>x.nextDue,",
 "stale=(g,now)=>!(now-g<=4*HOUR&&g<=now+9e5),"],
['W3 cv: per-day searched count k, first/last searched date, part-searched days',
 "cv=(x,ws,we)=>{const win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0,l=0;",
 "cv=(x,ws,we)=>{const win=we-ws,u=[];let r=0,a=null,b=null,sd=0,d=0,l=0,fs=null,lz,pp=0;"],
['W3b',
 "else if(!row||row.coverage==='none')u.push(y)}",
 "else if(!row||row.coverage==='none')u.push(y);else{fs??=t;lz=t;pp+=row.coverage==='partial'}}"],
['W3c',
 "return{f:win>0?Math.min(1,sd/win):0,r,a,b,d,u,l,",
 "return{f:win>0?Math.min(1,sd/win):0,r,a,b,d,u,l,fs,lz,pp,k:d-u.length-l,"],
['W4 cf: expose collector time g',
 "return{st,stale:!!(r.idx||r.meta)&&stale(r.idx||{gen:Date.parse(r.meta.query_end_utc)},now),colour:COLOUR(st),rs}},",
 "const g=r.idx?r.idx.gen:r.meta?Date.parse(r.meta.query_end_utc):NaN;return{st,g,stale:!!(r.idx||r.meta)&&stale(g,now),colour:COLOUR(st),rs}},"],
['W5 caption slots: notice retired, new line-2 slot "days"; line 1 Window rewritten',
 "cp=(r,now,k)=>{const w=r.w,x=r.idx,L={notice:'',window:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER};\nL.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(Math.max(w.s,w.e-1))} inclusive = ${T(w.s)} → ${T(w.e)}`:`Window  ${T(w.s)} → ${T(w.e)} (${w.label}${w.atLatest?', latest':', end exclusive'})`;",
 "cp=(r,now,k)=>{const w=r.w,x=r.idx,v=r.cov,nz=' (unknown, not zero)',L={window:'',days:'',actual:'',flashes:'',refresh:'',searched:'',warning:'',footer:FOOTER};\nL.window=w.custom?`Window  UTC dates ${ymd(w.s)} to ${ymd(Math.max(w.s,w.e-1))} inclusive (${pl(Math.ceil(w.span/DAY),'day')}${w.atLatest?', to now':''})`:`Window  ${w.label} · ${dt(w.s)} → ${de(w.s,w.e)} UTC · ${w.atLatest?'latest':'earlier page'}`;\n"
 + "L.days=r.mode==='feed'?`${r.old?'Last 7 days only (live feed)':'Live 7-day feed'} · ${NA(r.ie)}${/404/.test(r.ie)?'':': '+r.ie} · ${r.old?'earlier days unknown, not zero':'hours searched unknown'}`:r.before?`Before the 1-year archive (from ${dm(x.cutoff)}): never searched${nz}`:!v?''"
 + ":hz(w)?(v.f<=0?`None of the ${w.label} searched yet${nz}`:k&&/READY|EMPTY/.test(k.st)?`All ${w.label} searched (${dt(v.a)} → ${de(v.a,v.b)} UTC)`:`Searched ${du(v.f*w.span)} of ${w.label} (${dt(v.a)} → ${de(v.a,v.b)} UTC) · ${du(w.span*(1-v.f))} not searched${nz}`)"
 + ":!v.k?`None of the ${pl(v.d,'day')} searched yet${nz}`:`${v.k==v.d&&!v.pp?'All':v.k+' of'} ${pl(v.d,'day')} searched (${dm(v.fs)}${v.lz>v.fs?'–'+dm(v.lz):''}${v.pp?`, ${v.pp} in part`:''})${v.u.length?` · ${v.u.length} not yet searched`:''}${v.l?` · ${v.l} lost (integrity alert)`:''}${v.k<v.d?nz:''}`;\n"
 + "if(v&&v.bf>0&&v.f<=0&&x)L.days+=` · archive starts ${dm(x.covStart)}`;"],
['W6 feed: bold 7-day notice folded into line 2',
 "if(r.old){L.notice='Only the last 7 days are available yet. The 12-month archive is being collected and backfilled; earlier months are unknown, not zero.';L.warning=NA(r.ie)+': earlier coverage unknown, not zero'}",
 "if(r.old)L.warning=NA(r.ie)+': earlier coverage unknown, not zero'"],
['W7 refresh line: STALE word -> overdue (time already shown)',
 "${stale(x,now)?' · STALE':''}",
 "${stale(x.gen,now)?' · overdue':''}"],
['W8 caption order and line-2 style (colour set per state in pt)',
 "['notice','window','actual','flashes','refresh','searched','warning','footer'].map(k=>`<div data-cap=\"${k}\"${k==='notice'?' style=\"color:#ffcc00;font-weight:bold\"'",
 "['window','days','actual','flashes','refresh','searched','warning','footer'].map(k=>`<div data-cap=\"${k}\"${k==='days'?' style=\"font-weight:bold\"'"],
['W9 label',
 "const n=r.mode==='overview'?r.arch:r.ev.length;if(r.mode==='feed'&&r.old)return`${BASE} [${n>0?N(n):'UNKNOWN'} · last 7 days only${c.stale?' STALE':''}]`;return`${BASE} [${/UNKNOWN|BEFORE/.test(c.st)?'UNKNOWN':n>0?(c.st==='PARTIAL'?'≥':'')+N(n):c.st==='PARTIAL'?'UNKNOWN':'EMPTY'} | ${r.w.period}${c.stale?' STALE':''}]`},",
 "const n=fn(r);return`${BASE} [${r.mode==='feed'?(n?N(n):'none seen')+' | '+(r.old?'last 7 days only':'live feed'):/UNKNOWN|BEFORE/.test(c.st)?'UNKNOWN | '+(r.before?'before archive':sv(r,c)):(n?N(n):'none found')+' | '+sv(r,c)}]`},fn=r=>r.mode==='overview'||r.mode==='detail'&&(r.sk.length||r.fl.length)?r.arch:r.ev.length,"],
['W10 status line',
 "sl=(r,c)=>{const st=c.st,n=r.mode==='overview'?`${N(r.arch)} ARCHIVED`:`${N(r.ev.length)} FLASHES${r.cl?' CLUSTERED':' DRAWN'}`;\nreturn(r.mode==='feed'&&r.old&&st!=='FAIL'?`7-DAY FEED ONLY · ${N(r.ev.length)} FLASHES · OLDER HISTORY NOT YET COLLECTED`:r.mode==='feed'&&st!=='FAIL'?`${st} · ${F7(r)} · searched unknown`:st.startsWith('READY')?'READY · '+n:st==='EMPTY-COVERED'?'NO FLASHES DETECTED · SEARCHED 100%':st==='PARTIAL'?`PARTIAL · ${n} · SEARCHED ${r.cov&&!r.fl.length?Math.floor(r.cov.f*100)+'%':'UNKNOWN'}`:st==='FAIL'?'FAIL · '+c.rs.join('; '):st)+(c.stale?' · STALE':'')},",
 "sl=(r,c)=>{const st=c.st,n=fn(r),z=c.stale?' · '+lr(c.g,Date.now()).toUpperCase():'';\nreturn st==='FAIL'?'FAIL · '+c.rs.join('; ')+z:(r.mode==='feed'?`${pl(n,'flash','es')} · ${r.old?'last 7 days only · older not yet collected':'live 7-day feed · searched unknown'}`:/UNKNOWN|BEFORE/.test(st)?'unknown · '+(r.before?'before archive (from '+dm(r.idx.cutoff)+')':sv(r,c)):`${n?pl(n,'flash','es'):st==='EMPTY-COVERED'?'no flashes detected':'none found'} · ${sv(r,c,1)}`).toUpperCase()+z},"],
['W11 line-2 colour follows the status dot',
 "if(!loading)for(const k in L)txt(sf.caps[k],L[k])}",
 "if(!loading){for(const k in L)txt(sf.caps[k],L[k]);if(c)sf.caps.days.style.color=c.colour}}"],
];
let total = 0;
for (const [id, a, b] of E) {
  const n = s.split(a).length - 1;
  if (n !== 1) { console.error(`${id}: old occurs ${n} times`); process.exit(1); }
  const at = orig.indexOf(a), line = at < 0 ? '(after earlier edit)' : orig.slice(0, at).split('\n').length;
  s = s.replace(a, () => b);
  const d = B(b) - B(a); total += d;
  console.log(`${id.split(' ')[0].padEnd(4)} line ${String(line).padStart(3)}  ${d >= 0 ? '+' : ''}${d} B  ${id.split(' ').slice(1).join(' ')}`);
}
writeFileSync(out, s);
console.log(`total ${total >= 0 ? '+' : ''}${total} B: ${B(orig)} -> ${B(s)} B (cap 44,781)`);
