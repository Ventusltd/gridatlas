// Offline replay of atlas/v/<GEN>/index.html's resolution logic (index.html:39-80) against the filesystem. Read-only.
import fs from 'node:fs'; import path from 'node:path'; import {createHash} from 'node:crypto';
const REPO=path.resolve(process.argv[2]), GEN=process.argv[3];
const ROOT=REPO; const page=new URL(`http://h/atlas/v/${GEN}/index.html`);
const toFs=u=>path.join(ROOT, decodeURIComponent(new URL(u).pathname));
let fails=0; const ok=(c,s)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+s); };
const curU=new URL('./current.json',page); ok(fs.existsSync(toFs(curU)), `current.json -> ${toFs(curU).slice(REPO.length)}`);
const cur=JSON.parse(fs.readFileSync(toFs(curU),'utf8'));
ok(cur.schema==='gridatlas.current.v2' && cur.architecture==='IMMUTABLE_SHELL_PLUS_HASHED_CARTRIDGES', 'schema/architecture invariants (index.html:42-44)');
ok(cur.generation===GEN, `generation ${cur.generation}`);
const shellU=new URL(cur.shell.index,page), baseU=new URL(cur.shell.base,page);
ok(fs.existsSync(toFs(shellU)), `shell.index -> ${toFs(shellU).slice(REPO.length)}`);
ok(fs.statSync(toFs(baseU)).isDirectory(), `shell.base -> ${toFs(baseU).slice(REPO.length)}`);
const html=fs.readFileSync(toFs(shellU),'utf8');
ok(/<head\b/i.test(html)&&/<body\b/i.test(html),'shell is HTML');
const srcs=[...html.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*>\s*<\/script>/gi)].map(m=>m[2]);
// every shell-relative src that is NOT replaced must exist under shell.base
const byId=new Map(cur.cartridges.map(c=>[c.id,c])); const replaced=new Set();
for(const id of cur.cartridge_order){ const c=byId.get(id); ok(!!c,`cartridge ${id} registered`);
  const u=new URL(c.path,page); const f=toFs(u); const ex=fs.existsSync(f); ok(ex,`${id}: ${c.path} -> ${f.slice(REPO.length)}`);
  if(ex){ const h=createHash('sha256').update(fs.readFileSync(f)).digest('hex'); ok(h===c.sha256,`${id}: served-bytes sha256 ${h.slice(0,16)} == declared`); }
  const slot=srcs.find(s=>s.split('/').pop()===c.replace_script); ok(!!slot,`${id}: shell slot ${c.replace_script} present`); if(slot) replaced.add(slot);
}
for(const s of srcs.filter(s=>!replaced.has(s))){ if(/^(https?:)?\/\//.test(s)){ console.log('INFO external shell script '+s); continue; }
  const f=toFs(new URL(s,baseU)); ok(fs.existsSync(f),`shell script (kept) ${s} -> ${f.slice(REPO.length)}`); }
// every relative path string anywhere in route current.json
const strs=[]; const walk=o=>{ if(o&&typeof o==='object') Object.values(o).forEach(walk); else if(typeof o==='string') strs.push(o); }; walk(cur);
for(const s of [...new Set(strs)].filter(s=>/^\.\.?\//.test(s) && !/\s/.test(s))){ const f=toFs(new URL(s,page)); ok(fs.existsSync(f),`ref ${s} -> ${f.slice(REPO.length)}`); }
for(const s of [...new Set(strs)].filter(s=>/^(tools|atlas|docs)\/\S+$/.test(s))){ ok(fs.existsSync(path.join(REPO,s)),`repo-root ref ${s}`); }
console.log(fails?`RESULT FAIL (${fails})`:'RESULT PASS'); process.exit(fails?1:0);
