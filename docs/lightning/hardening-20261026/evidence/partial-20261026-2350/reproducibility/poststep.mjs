// Applies the lead's two post-steps to the reproduced generation in ./wt (this lane's own worktree only).
import fs from 'node:fs';
const P='wt/tools/proofs/202610262323-sld-sandbox.proof.mjs', M='wt/atlas/manifests/202610262323-composition.json';
let p=fs.readFileSync(P,'utf8');
const before=p.split('\n').filter(l=>l.startsWith('for(const needle of')); if(before.length!==1) throw Error('needle line count '+before.length);
let line=before[0];
for(const n of ["'gm-panel-body',","'insertBefore',"]){ if(line.split(n).length!==2) throw Error('needle '+n); line=line.replace(n,''); }
// assertion message wording is the lead's (not specified by the brief); the code expression is the brief's
const add="assert.equal(module.includes('gm-panel-body'),false,'the Grid dropdown mirror was removed: the module must not touch the original Grid panel body (P02/P10)');";
p=p.replace(before[0], add+'\n'+line); fs.writeFileSync(P,p);
let m=fs.readFileSync(M,'utf8'); const o='"candidate_predecessor": "202610261949"';
if(m.split(o).length!==2) throw Error('cp'); m=m.replace(o,'"candidate_predecessor": "202610262318"');
JSON.parse(m); fs.writeFileSync(M,m); console.log('post-steps applied');
