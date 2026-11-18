/** Successor-only public seam, derived from the exact currently composed gazetteer. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export function buildGazetteer(generation,root=ROOT) {
 const registry=JSON.parse(fs.readFileSync(path.join(root,'tools/train/gazetteer/generations.json'))),entry=registry.generations[generation];assert.ok(entry,'Unknown gazetteer successor generation '+generation);
 const bytes=fs.readFileSync(path.join(root,entry.base.path)),hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(bytes.length,entry.base.bytes,'Gazetteer base length drift');assert.equal(hash(bytes),entry.base.sha256,'Gazetteer base pin drift');let body=bytes.toString('utf8');
 for(const [i,edit]of JSON.parse(fs.readFileSync(path.join(root,entry.edits))).entries()){assert.ok(typeof edit.before==='string'&&edit.before.length&&typeof edit.after==='string');const at=body.indexOf(edit.before);assert.ok(at>=0,'Gazetteer edit missing '+i);assert.equal(body.indexOf(edit.before,at+1),-1,'Gazetteer edit ambiguous '+i);body=body.slice(0,at)+edit.after+body.slice(at+edit.before.length);}
 const built=Buffer.from(body);assert.equal(built.length,entry.output_bytes,'Gazetteer output length drift');assert.equal(hash(built),entry.output_sha256,'Gazetteer output pin drift');return built;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const arg=k=>process.argv[process.argv.indexOf(k)+1];assert.ok(process.argv.includes('--gen')&&process.argv.includes('--out'),'Use --gen G --out NEW_FILE');const bytes=buildGazetteer(arg('--gen'));fs.writeFileSync(arg('--out'),bytes,{flag:'wx'});console.log(JSON.stringify({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));}
