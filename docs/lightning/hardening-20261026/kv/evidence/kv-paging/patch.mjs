// applies the kv-paging minimal fixes to a copy of Build I; prints byte cost per fix
import {readFileSync,writeFileSync} from 'node:fs';
let s=readFileSync(process.argv[2],'utf8');const out=process.argv[3],base=Buffer.byteLength(s);
const R=[
['P1 before-archive = before coverage start (l.78)','if(w.e<=x.cutoff)return{mode','if(w.e<=x.covStart)return{mode'],
['P1 not-yet-searched caption (l.102)','if(r.before){L.warning=`Window predates the archive (began ${T(x.covStart)}; retention from ${x.cutoffDate}) — unknown, not zero`;return L}','if(r.before){L.flashes=\'Flashes not yet searched (unknown, not zero)\';L.warning=`Archive begins ${T(x.covStart)}: this window was never searched`;return L}'],
['P1 0%-searched caption (l.123)',"if(k&&/UNK|PAR/.test(k.st)&&/^Flashes 0 a/.test(L.flashes))L.flashes+=' (unknown, not zero)'","if(c&&c.f<=0){L.flashes='Flashes not yet searched (unknown, not zero)';L.actual=''}else if(c&&c.f<1&&/^Flashes 0 a/.test(L.flashes))L.flashes=`Flashes 0 in the ${Math.floor(c.f*100)}% searched; rest unknown`"],
['P1/P3 label (l.182)',"/UNKNOWN|BEFORE/.test(c.st)?'UNKNOWN':n>0?(c.st==='PARTIAL'?'≥':'')+N(n):c.st==='PARTIAL'?'UNKNOWN':'EMPTY'","/UNKNOWN|BEFORE/.test(c.st)?(r.mode==='feed'?'UNKNOWN':'NOT YET SEARCHED'):N(n)+(c.st==='PARTIAL'&&r.cov?` in ${Math.floor(r.cov.f*100)}% searched`:n?'':' · searched 100%')"],
['P1 status line (l.184)',":st==='FAIL'?'FAIL · '+c.rs.join('; '):st)",":st==='FAIL'?'FAIL · '+c.rs.join('; '):r.mode==='feed'?st:'NOT YET SEARCHED')"],
['P2 period chip resets paging (l.196)','sp=p=>{S.period=p;','sp=p=>{S.period=p;S.end=null;S.h=[];'],
['P2 LATEST clears stack (l.201)',"which==='latest'){S.end=null;","which==='latest'){S.end=null;S.h=[];"],
['P4 PREV stops at the first whole period (l.192)','w.s<=S.idx.cutoff;','w.s<S.idx.cutoff+DAY;'],
['P5 custom To not after today (l.199)','&&f<=t;','&&f<=t&&t<=ymd(now);'],
['P6 gaps warning (l.120)',"if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);","if(c.u.length)warn.push(`Unknown: ${c.u.length} of ${c.d} UTC dates have no collection run`);if(c.f<1&&!warn.length)warn.push(`Unknown: ${100-Math.floor(c.f*100)}% of window lies between collection runs (not zero)`);"],
['P7 runs prorated (l.51,53)','sd+=o;r+=w.n;','sd+=o;r+=w.n*o/(w.e-w.s);'],
['P7b','return{f:win>0?Math.min(1,sd/win):0,r,','return{f:win>0?Math.min(1,sd/win):0,r:Math.ceil(r),'],
['P8 0% wording (l.117)',"0% of window — no collection run covers these dates'","0% of window — no collection run covers this window'"],
];
for(const [n,a,b] of R){if(s.split(a).length!==2)throw new Error('anchor '+n);const before=Buffer.byteLength(s);s=s.replace(a,()=>b);console.log(n.padEnd(48),'+'+(Buffer.byteLength(s)-before),'B')}
writeFileSync(out,s);console.log('total',base,'->',Buffer.byteLength(s),'(+'+(Buffer.byteLength(s)-base)+')');
