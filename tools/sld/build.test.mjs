import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSld} from './build.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/sld/generations.json')));

test('rebuilds both accepted generations without the expected cartridge in its source tree',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gridatlas-sld-source-'));
  try {
    const entry=registry.generations['202611161720'];
    for(const rel of ['tools/sld/generations.json',entry.base.path,entry.owner.path,entry.edits]) {
      const to=path.join(root,rel);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(ROOT,rel),to);
    }
    for(const generation of Object.keys(registry.generations)) {
      const expected=`atlas/cartridges/${generation}-sld-sandbox-v9-8.js`;
      assert.equal(fs.existsSync(path.join(root,expected)),false);
      assert.deepEqual(buildSld(generation,root),fs.readFileSync(path.join(ROOT,expected)));
    }
    // A changed source and a dropped edit must both fail, rather than copy the expected output.
    fs.appendFileSync(path.join(root,entry.base.path),'\n');
    assert.throws(()=>buildSld('202611161720',root),/Source pin drift/);
    fs.copyFileSync(path.join(ROOT,entry.base.path),path.join(root,entry.base.path));
    const edits=JSON.parse(fs.readFileSync(path.join(root,entry.edits)));edits.pop();
    fs.writeFileSync(path.join(root,entry.edits),JSON.stringify(edits));
    assert.throws(()=>buildSld('202611161720',root),/differs from its registered output pin/);
  } finally {assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});}
});

test('unregistered generations fail closed',()=>{
  assert.throws(()=>buildSld('202611160000'),/No SLD source recipe/);
});
