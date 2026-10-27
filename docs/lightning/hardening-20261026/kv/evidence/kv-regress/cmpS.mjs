import { readFileSync } from 'node:fs';
const [a,b]=process.argv.slice(2);
for (const c of ['S0','S1','S2','S3','S4a','S4b','S4c','S5','S6','S7','S8','S9','S10','S10b','S11']) {
  const E=JSON.parse(readFileSync(a))[c], F=JSON.parse(readFileSync(b))[c];
  const pick=x=>({label:x.label,status:x.status,requests:x.requests,offPath:x.offPathCount,html:x.htmlWritesWithData,proto:x.protoKeysAdded,drawn:x.drawn,err:x.errors,le:x.listenerErrors,caps:x.caps});
  const pe=pick(E),pf=pick(F);
  const diffs=Object.keys(pe).filter(k=>JSON.stringify(pe[k])!==JSON.stringify(pf[k]));
  console.log(`## ${c} diffs: ${diffs.join(',')||'none'}`);
  for (const k of diffs) { if(k==='caps'){for(const ck of new Set([...Object.keys(pe.caps),...Object.keys(pf.caps)])) if(pe.caps[ck]!==pf.caps[ck]) console.log(`  caps.${ck}\n    E: ${pe.caps[ck]}\n    F: ${pf.caps[ck]}`)} else console.log(`  ${k}\n    E: ${JSON.stringify(pe[k])}\n    F: ${JSON.stringify(pf[k])}`) }
}
