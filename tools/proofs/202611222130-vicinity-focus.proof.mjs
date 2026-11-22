import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {retireLayout,sourcePath,outputPath} from '../sld/retire-gridatlas-layout.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const baseline=JSON.parse(read('atlas/v/202611222000/current.json'));
const live=JSON.parse(read('atlas/current.json'));
const candidate=JSON.parse(read('atlas/v/202611222130/current.json'));
assert.ok(['202611222000','202611222130','202611222325','202611222343'].includes(live.generation),'live must be V9.194 or approved V9.195');
if(live.generation==='202611222130')for(const c of candidate.cartridges){
 const active=live.cartridges.find(x=>x.id===c.id);
 assert.ok(active&&active.sha256===c.sha256,'promoted '+c.id+' must match the accepted candidate SHA');
}
assert.equal(candidate.generation,'202611222130');
assert.equal(candidate.previous_generation,'202611222000');
assert.deepEqual(candidate.cartridge_order,[...baseline.cartridge_order,'vicinity-focus']);
assert.equal(candidate.cartridges.length,baseline.cartridges.length+1);
// Release preview re-rooting canonicalises descriptive contract paths; these
// are not fetched by the loader. Preserve every source byte pin, slot and
// cartridge field, comparing descriptor paths by their repository identity.
const normalise=value=>Array.isArray(value)?value.map(normalise):
 value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalise(v)])):
 typeof value==='string'&&/^(?:\.\/|\.\.\/)/.test(value)?value.replace(/^(?:\.\.\/|\.\/)+/,''):value;
for(let i=0;i<baseline.cartridges.length;i++){
 const before=baseline.cartridges[i],after=candidate.cartridges[i];
 if(before.id==='sld-sandbox')continue;
 for(const field of ['id','generation','version','type','slot','replace_script','after','path','sha256'])
   assert.deepEqual(after[field],before[field],before.id+': runtime field '+field+' must remain unchanged');
 assert.deepEqual(normalise(after),normalise(before),
   before.id+': inherited metadata may only differ by relative descriptor path prefix');
}
const sld=candidate.cartridges.find(c=>c.id==='sld-sandbox');
assert.ok(sld&&sld.path.endsWith('/202611222130-sld-without-layout.js'));
assert.equal(sld.slot,'replace-script');
const original=read(sourcePath),derived=read(outputPath);
assert.equal(derived,retireLayout(original),'ONLY the enumerated minimal UI changes; zero truncation');
assert.ok(Buffer.byteLength(original)>450000&&Buffer.byteLength(derived)>445000,'full-size engine preserved');
assert.equal(crypto.createHash('sha256').update(derived).digest('hex'),sld.sha256,'byte-exact no-layout cartridge');
assert.equal(Buffer.byteLength(derived),sld.bytes);
new vm.Script(derived);
assert.ok(derived.includes('function enableSubstationLayer()'));
assert.ok(derived.includes('window.__GRIDATLAS_NEON_LINKS__'));
assert.ok(derived.includes('keepLayersInFullscreen();'));
assert.ok(derived.includes('armCorridorGestures(map);'));
assert.ok(derived.includes('    return false; // retired: no substation-triggered layout'));
assert.ok(derived.includes('    return false; // retired: no project-triggered layout'));
assert.ok(!derived.includes('        + `<button class="neon-layout"'),'visible layout entry must be absent');
const focus=candidate.cartridges.at(-1);
assert.equal(focus.slot,'after-cartridge');assert.equal(focus.after,'pipeline-vicinity-button');
const src=read('atlas/modules/202611222130-vicinity-focus.js');
assert.equal(crypto.createHash('sha256').update(src).digest('hex'),focus.sha256);
assert.equal(Buffer.byteLength(src),focus.bytes);
new vm.Script(src);
for(const term of ['data-vicinity-focus-card','data-offtakers-row','Project vicinity asset browser','data-vicinity-browse-toggle','gridatlas-offtakers-neon-dc-node','asset-first'])assert.ok(src.includes(term),'missing '+term);
assert.ok(!/gridJourneyPreview|journey=vicinity/.test(src),'Journey must stay discontinued');
assert.equal(read('atlas/v/202611222130/index.html'),read('atlas/v/202611222000/index.html'),'composer unchanged');
console.log('PASS V9.195: full Grid Engine identical except exact retired Layout UI; seven other cartridges pinned; no truncation');
