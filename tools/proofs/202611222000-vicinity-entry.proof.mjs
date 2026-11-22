import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'../..');
const gen='202611222000';
const live=JSON.parse(fs.readFileSync(path.join(root,'atlas/current.json'),'utf8'));
const candidate=JSON.parse(fs.readFileSync(path.join(root,'atlas/v',gen,'current.json'),'utf8'));
assert.equal(live.generation,'202611161720','do not alter V9.191 live pointer');
assert.equal(candidate.generation,gen);
assert.deepEqual(candidate.cartridge_order.slice(0,6),live.cartridge_order,'preserve accepted cartridge order');
assert.deepEqual(candidate.cartridge_order.slice(6),['pipeline-vicinity-button'],'no Journey');
assert.equal(candidate.cartridges.length,8);
for(const c of candidate.cartridges){
  const p=path.resolve(root,'atlas/v',gen,c.path);
  assert.ok(p.startsWith(root+path.sep),'path confined to checkout');
  assert.ok(fs.existsSync(p),c.id+' path missing');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),c.sha256,c.id+' digest');
  new vm.Script(fs.readFileSync(p,'utf8'),{filename:p});
}
const owner=fs.readFileSync(path.join(root,'atlas/modules',gen+'-uk-offtakers-overlay.js'),'utf8');
const button=fs.readFileSync(path.join(root,'atlas/modules',gen+'-vicinity-entry.js'),'utf8');
for(const part of ['openProjectVicinity','initProjectSwipe','updateProjectSwipe','stepProjectSwipe','S.pp.swipe','GRID']){}
assert.match(owner,/openProjectVicinity/);
assert.match(owner,/const subs=\(card.k\|\|\[\]\)/);
assert.match(owner,/const repd=\(card.P\|\|\[\]\)\.slice\(0,N3\)/);
assert.match(owner,/const power=\(card.cv\|\|\[\]\)\.slice\(0,N3\)/);
assert.match(owner,/Math\.abs\(x\)>54/,'horizontal swipe threshold');
assert.match(button,/gridatlas-pipeline-vicinity-button/);
assert.match(button,/repd_ref/);
assert.doesNotMatch(button,/gridJourneyPreview|journey=vicinity/,'the discontinued Journey must not be coupled');
const predecessor=live.cartridges.find(c=>c.id==='uk-offtakers-overlay');
const next=candidate.cartridges.find(c=>c.id==='uk-offtakers-overlay');
assert.equal(predecessor.path,'./modules/202611132345-uk-offtakers-overlay.js');
assert.notEqual(next.sha256,predecessor.sha256);
console.log('PASS V9.194: eight byte-pinned cartridges, 90-point swipe ceiling, unchanged V9.191 and no Journey');
