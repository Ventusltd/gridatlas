import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {REQUIRED_CARTRIDGES,validateCompositionContract} from '../scope/composition-contract.mjs';
const current=JSON.parse(fs.readFileSync(new URL('../../atlas/current.json',import.meta.url),'utf8'));
test('the actual current composition satisfies the required replacement contract',()=>validateCompositionContract(current));
for(const id of REQUIRED_CARTRIDGES){
 test(`reject ${id} removed from both registry and execution order`,()=>{
  const mutant=structuredClone(current);mutant.cartridges=mutant.cartridges.filter(entry=>entry.id!==id);mutant.cartridge_order=mutant.cartridge_order.filter(entry=>entry!==id);
  assert.throws(()=>validateCompositionContract(mutant),new RegExp('Required cartridge absent from registry: '+id));
 });
}
test('reject empty, mismatched and duplicate registries',()=>{
 for(const mutate of [
  c=>{c.cartridges=[];c.cartridge_order=[];},
  c=>c.cartridge_order.pop(),
  c=>c.cartridges.push(structuredClone(c.cartridges[0])),
  c=>c.cartridge_order.push(c.cartridge_order[0]),
  c=>c.cartridges.push({id:'optional-test'}),
  c=>c.cartridge_order.push('unknown')
 ]){const c=structuredClone(current);mutate(c);assert.throws(()=>validateCompositionContract(c));}
});
test('additional independently declared cartridges remain allowed',()=>{
 const c=structuredClone(current);c.cartridges.push({id:'optional-test'});c.cartridge_order.push('optional-test');validateCompositionContract(c);
});
