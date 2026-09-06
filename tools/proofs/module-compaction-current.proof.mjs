import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {proveEquivalent} from '../compact-modules.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(s).digest('hex');
const current=JSON.parse(read('atlas/current.json'));
const composition=JSON.parse(read('atlas/'+current.composition_manifest.replace(/^\.\//,'')));
const pin=composition.acceptance.module_compaction;
assert(pin,'Compaction receipt must be part of this composition');
const raw=read(pin.path);assert.equal(hash(raw),pin.sha256);
const record=JSON.parse(raw);assert.equal(record.generation,current.generation);
assert.equal(record.modules.length,5);
const cartridge=current.cartridges.find(c=>c.id==='substation-intelligence');
const assembled=read('atlas/'+cartridge.path.replace(/^\.\//,''));
const parts=JSON.parse(read('atlas/'+cartridge.assembled_from.replace(/^\.\//,'')));
for(const item of record.modules){
 const before=read(item.input),after=read(item.output);
 assert.equal(hash(before),item.sourceSha256);assert.equal(hash(after),item.sha256);
 assert(parts.assembled_from.some(p=>p.path===item.output&&p.sha256===item.sha256));
 assert(assembled.includes(after.trim()),'Compact module missing from served cartridge');
 proveEquivalent(before,after);
}
assert(assembled.length<=368640,'Existing payload ceiling is unchanged');
console.log(`PASS five compact modules: identical executable tokens and AST; ${assembled.length}/368640 characters`);
