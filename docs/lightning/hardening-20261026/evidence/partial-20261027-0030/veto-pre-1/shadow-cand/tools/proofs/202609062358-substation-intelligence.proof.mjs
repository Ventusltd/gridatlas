/** Integrity coverage for the unchanged published engine; real behaviour is exercised by all-layer-clicks and all-controls. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const current=JSON.parse(fs.readFileSync(new URL('atlas/current.json',root)));
const entry=current.cartridges.find(x=>x.id==='substation-intelligence');
const source=fs.readFileSync(new URL('atlas/'+entry.path,root),'utf8');
assert.equal(entry.generation,'202609062358');
assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
const previous=JSON.parse(fs.readFileSync(new URL('atlas/manifests/202609200022-composition.json',root)));
assert.equal(entry.sha256,previous.cartridges.find(x=>x.id===entry.id).sha256,'unchanged engine must preserve its published bytes');
new vm.Script(source);
assert.match(source,/window\.initVentusMap/);
console.log('Published engine byte integrity and syntax PASS; browser coverage runs separately.');
