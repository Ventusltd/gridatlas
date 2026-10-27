// Applies the kv-periods edits to Build I and reports per-edit byte cost. Usage: node patch-kv.mjs <in> <out>
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
let s = readFileSync(inp, 'utf8');
const lineOf = (src, needle) => src.slice(0, src.indexOf(needle)).split('\n').length;
const E = [
 ['K1 stale(): measure from the search frontier (lastScan), not generated_utc that backfill bumps', 47,
  'stale=(x,now)=>!(now-x.gen<=4*HOUR&&', 'stale=(x,now)=>!(now-(x.lastScan??x.gen)<=4*HOUR&&'],
 ['K2 cf(): STALE only on the latest window, not on PREV pages', 96,
  'return{st,stale:!!(r.idx||r.meta)&&stale(', 'return{st,stale:!!(r.idx||r.meta)&&r.w.atLatest&&stale('],
 ['K3 cp(): flashes sentence names searched days/hours and the unsearched remainder', 111,
  "N(n)+' archived in window'}${drawn}`}", "fx(r)}${drawn}`}"],
 ['K4 cp(): refresh line says when the collector last searched and when the next update was due', 115,
  "if(x)L.refresh=`Refresh archive ${T(x.gen)} (${AGO(now-x.gen)} ago; expected every ${x.iv} h)${stale(x,now)?' · STALE':''}`;",
  "if(x){const q=x.lastScan??x.gen;L.refresh=`${stale(x,now)?'STALE: c':'C'}ollector last searched up to ${T(q)} (${AGO(x.gen>now+9e5?-1e6:now-q)} ago); next update ${now>x.nextDue?'was ':''}due by ${T(x.nextDue)}`}"],
 ['K5 cp(): searched line in hours, no "successful runs", hull named earliest/latest', 117,
  '`Searched EUMETSAT ${Math.floor(c.f*100)}% of window · ${c.r} successful runs${c.a!==null?` · ${T(c.a)} → ${T(c.b)}`:\'\'}`',
  '`Searched EUMETSAT ${Math.floor(c.f*100)}% of window = ${N(Math.round(c.f*w.span/HOUR))} of ${N(Math.round(w.span/HOUR))} h${c.a!==null?` · earliest ${T(c.a)} · latest ${T(c.b)}`:\'\'}`'],
 ['K6 cp(): no second "precede archive start" warning for the same never-searched dates', 119,
  'if(c.bf>0&&x)warn.push(', 'if(c.bf>0&&x&&!c.u.length)warn.push('],
 ['K7 sx()/fx() helpers + label without "≥": count · searched days or hours | period | STALE', 181,
  'lt=(r,c,loading)=>{',
  "sx=r=>{const v=r.cov,s=r.w.span,h=t=>+(t/HOUR).toFixed(1);return s<=7*DAY?`${h(v.f*s)} of ${h(s)} h searched`:`${v.d-v.u.length-v.l} of ${v.d} days searched`},\n" +
  "fx=r=>{const v=r.cov,n=N(r.ev.length),s=r.w.span,h=t=>+(t/HOUR).toFixed(1),D=d=>new Date(ds(d)).toUTCString().slice(5,11);if(!v)return n;if(s<=7*DAY){const a=v.f*s;return`${n} in ${h(a)} searched hours`+(a<s?`; ${h(s-a)} of ${h(s)} h not yet searched (unknown, not zero)`:' (whole window searched)')}\n" +
  "const k=r.rows.filter(y=>y.coverage!=='none'),p=k.filter(y=>y.coverage==='partial').length;return`${n} in ${k.length} searched days`+(k.length?` (${D(k[0].date)} – ${D(k[k.length-1].date)}${p?`; ${p} only partly`:''})`:'')+(v.u.length?`; ${v.u.length} of ${v.d} days not yet searched (unknown, not zero)`:'')},\n" +
  'lt=(r,c,loading)=>{'],
 ['K8 lt(): label body', 182,
  "${/UNKNOWN|BEFORE/.test(c.st)?'UNKNOWN':n>0?(c.st==='PARTIAL'?'≥':'')+N(n):c.st==='PARTIAL'?'UNKNOWN':'EMPTY'} | ${r.w.period}${c.stale?' STALE':''}]`",
  "${/UNKNOWN|BEFORE/.test(c.st)?r.cov?'not searched':'UNKNOWN':N(n)+(r.mode==='overview'?` on ${r.rows.length} dates`:'')+(r.cov?' · '+sx(r):' · searched unknown')} | ${r.w.period}${c.stale?' | STALE':''}]`"],
 ['K9 sl(): PARTIAL status says what was searched', 184,
  "SEARCHED ${r.cov&&!r.fl.length?Math.floor(r.cov.f*100)+'%':'UNKNOWN'}`", "${r.cov&&!r.fl.length?sx(r).toUpperCase():'SEARCHED UNKNOWN'}`"],
 ['K10 PREV: stop at searched coverage start, and never open a page the retention clamp would cut short', 192,
  'w.s<=S.idx.cutoff;', 'w.s<=S.idx.covStart||w.s-w.span<S.idx.cutoff;'],
];
const rows = [];
for (const [name, line, a, b] of E) {
  const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${name}: ${n} matches`);
  const at = lineOf(s, a); s = s.replace(a, () => b);
  rows.push(`${name}\n   Build I line ${line} (patched-file line ${at}) · ${Buffer.byteLength(b) - Buffer.byteLength(a) >= 0 ? '+' : ''}${Buffer.byteLength(b) - Buffer.byteLength(a)} B`);
}
writeFileSync(out, s);
const b0 = readFileSync(inp).length, b1 = Buffer.byteLength(s);
console.log(rows.join('\n') + `\nTOTAL ${b0} -> ${b1} B (${b1 - b0 >= 0 ? '+' : ''}${b1 - b0} B; budget 44,781 B headroom -> ${44781 - (b1 - b0)} B left)`);
