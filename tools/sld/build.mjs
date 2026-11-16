/** Rebuild the MAP receiver from a pinned immutable baseline and explicit source edits. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const digest=b=>createHash('sha256').update(b).digest('hex');
export function buildSld(generation,root=ROOT) {
  const registry=JSON.parse(fs.readFileSync(path.join(root,'tools/sld/generations.json')));
  const entry=registry.generations[generation];
  assert.ok(entry,`No SLD source recipe for ${generation}`);
  const pinned=input=>{
    const bytes=fs.readFileSync(path.join(root,input.path));
    assert.equal(digest(bytes),input.sha256,`Source pin drift: ${input.path}`);
    return bytes.toString('utf8');
  };
  let source=pinned(entry.base);
  const owner=pinned(entry.owner);
  const edits=JSON.parse(fs.readFileSync(path.join(root,entry.edits)));
  assert.ok(Array.isArray(edits)&&edits.length>0);
  for(const [index,edit] of edits.entries()) {
    assert.equal(typeof edit.before,'string');assert.ok(edit.before.length);
    assert.equal(typeof edit.after,'string');
    const at=source.indexOf(edit.before);
    assert.ok(at>=0,`Source edit ${index} no longer matches`);
    assert.equal(source.indexOf(edit.before,at+1),-1,`Source edit ${index} is ambiguous`);
    source=source.slice(0,at)+edit.after+source.slice(at+edit.before.length);
  }
  const built=Buffer.from(entry.header+owner+'\n'+source);
  assert.equal(digest(built),entry.output_sha256,'Rebuilt SLD differs from its registered output pin');
  return built;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const arg=name=>process.argv[process.argv.indexOf(name)+1];
  assert.ok(process.argv.includes('--gen')&&process.argv.includes('--out'),'Use --gen G --out NEW_FILE');
  const built=buildSld(arg('--gen'));
  fs.writeFileSync(arg('--out'),built,{flag:'wx'});
  console.log(`SLD source rebuild: ${built.length} bytes sha256 ${digest(built)}`);
}
