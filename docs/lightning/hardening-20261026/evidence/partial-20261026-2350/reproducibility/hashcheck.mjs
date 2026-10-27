// Independent recomputation of every sha256/bytes in the 202610262323 manifest and current.json files. Read-only.
import fs from 'node:fs'; import path from 'node:path'; import {createHash} from 'node:crypto';
const REPO=path.resolve(process.argv[2]); const R=p=>path.join(REPO,p);
const sha=b=>createHash('sha256').update(b).digest('hex');
const lf=b=>Buffer.from(b.toString('binary').replace(/\r\n/g,'\n'),'binary');
let fails=0; const out=(s,ok)=>{ if(ok===false) fails++; console.log((ok===false?'FAIL ':ok===true?'PASS ':'INFO ')+s); };
const files={manifest:'atlas/manifests/202610262323-composition.json', route:'atlas/v/202610262323/current.json', live:'atlas/current.json'};
const base={manifest:'atlas', route:'atlas/v/202610262323', live:'atlas'};
for(const [k,f] of Object.entries(files)){
  const j=JSON.parse(fs.readFileSync(R(f),'utf8')); console.log(`#### ${f}`);
  j.cartridges.forEach((c,i)=>{
    const p=path.normalize(path.join(base[k],c.path)); const b=fs.readFileSync(R(p));
    const raw=sha(b), l=sha(lf(b));
    out(`cart[${i}] ${c.id} ${p} sha256 decl=${c.sha256.slice(0,12)} raw=${raw.slice(0,12)} lf=${l.slice(0,12)}`, c.sha256===l);
    if(c.bytes!==undefined) out(`cart[${i}] ${c.id} bytes decl=${c.bytes} actual=${b.length} lf=${lf(b).length}`, c.bytes===b.length);
    else out(`cart[${i}] ${c.id} no bytes field (actual ${b.length})`);
    if(c.uk_lightning){ const mp=path.normalize(path.join(base[k],c.uk_lightning.module)); const mb=fs.readFileSync(R(mp));
      out(`cart[${i}] uk_lightning.module ${mp} module_bytes decl=${c.uk_lightning.module_bytes} actual=${mb.length} sha256=${sha(mb)}`, c.uk_lightning.module_bytes===mb.length); }
    if(c.supersedes_shell_script){ const n=c.supersedes_shell_script.name; const cands=fs.readdirSync(R('atlas/releases')).map(d=>`atlas/releases/${d}/${n}`).filter(p=>fs.existsSync(R(p)));
      const hit=cands.filter(p=>sha(lf(fs.readFileSync(R(p))))===c.supersedes_shell_script.sha256);
      out(`cart[${i}] supersedes_shell_script ${n} sha256 ${c.supersedes_shell_script.sha256.slice(0,12)} matches LF bytes of ${hit.length}/${cands.length} release copies: ${hit.join(', ')}`, hit.length>0); }
    if(c.supersedes_cartridge){ const g=c.supersedes_cartridge.generation; const p=fs.readdirSync(R('atlas/cartridges')).filter(n=>n.startsWith(g+'-'+c.supersedes_cartridge.id)).map(n=>'atlas/cartridges/'+n);
      const ok=p.length===1 && sha(lf(fs.readFileSync(R(p[0]))))===c.supersedes_cartridge.sha256; out(`cart[${i}] supersedes_cartridge ${p.join()} sha256 ${c.supersedes_cartridge.sha256.slice(0,12)}`, ok); }
    if(c.transit_data_selection) out(`cart[${i}] transit_data_selection ${c.transit_data_selection.selected} sha256 ${c.transit_data_selection.sha256.slice(0,12)}: file not in repo (remote partition); value-compared with live below`);
  });
}
// any other 64-hex values: compare candidate vs live
const hexes=f=>[...fs.readFileSync(R(f),'utf8').matchAll(/[0-9a-f]{64}/g)].map(m=>m[0]);
const L=new Set(hexes(files.live));
for(const k of ['manifest','route']){ const extra=[...new Set(hexes(files[k]))].filter(h=>!L.has(h)); out(`${files[k]}: 64-hex values not present in live atlas/current.json: ${extra.join(',')||'none'}`, extra.length===1 && extra[0].startsWith('b143bf05')); }
// manifest vs route: identical apart from relative paths?
const m=fs.readFileSync(R(files.manifest),'utf8'), r=fs.readFileSync(R(files.route),'utf8');
out(`manifest sld sha == route sld sha == ${sha(fs.readFileSync(R('atlas/cartridges/202610262323-sld-sandbox-v9-8.js')))}`, JSON.parse(m).cartridges[2].sha256===JSON.parse(r).cartridges[2].sha256);
console.log(fails? `RESULT FAIL (${fails})` : 'RESULT PASS'); process.exit(fails?1:0);
