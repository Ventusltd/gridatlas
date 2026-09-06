import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {proveMenuBar} from './menu-bar-dom.proof.mjs';
const path=new URL('../../atlas/modules/202609031958-menu-bar.js',import.meta.url);
test('current menu keeps Grid/Subs while adopting nested Scope controls',async()=>{
 const result=await proveMenuBar(path);
 assert.equal(result.status,'PASS');assert.equal(result.layers,63);
});
test('hiding a nonempty tray fails the corrected proof',async()=>{
 const source=await readFile(path,'utf8');
 const marker="if (leftovers.length === 0) stack.setAttribute('data-gridatlas-menu-emptied', '1');";
 assert.equal(source.split(marker).length,2,'mutation targets exactly one adoption boundary');
 const dir=await mkdtemp(join(tmpdir(),'atlas-menu-tray-'));
 try{
  const changed=join(dir,'hidden-tray.js');
  await writeFile(changed,source.replace(marker,"stack.setAttribute('data-gridatlas-menu-emptied', '1');"));
  await assert.rejects(proveMenuBar(changed),/retained mobile Grid\/Subs tray stays reachable/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
