/** Candidate integrity; actual MAP and visible-result acceptance runs separately. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {deriveCurrent,rerootForPreview} from '../release/lib.mjs';
const root=new URL('../../',import.meta.url),G='202611161645';
const read=p=>fs.readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const manifest=read(`atlas/manifests/${G}-composition.json`),candidate=JSON.parse(manifest),live=JSON.parse(read('atlas/current.json'));
const parent=JSON.parse(read('atlas/manifests/202611132345-composition.json'));
assert.ok([parent.generation,G].includes(live.generation),'live composition must be the declared parent or promoted candidate');
assert.equal(candidate.previous_generation,parent.generation);
assert.equal(candidate.superseded_generation,parent.generation);
assert.equal(candidate.candidate_predecessor,parent.generation);
assert.equal(read(`atlas/v/${G}/current.json`),rerootForPreview(deriveCurrent(manifest)));
assert.equal(read(`atlas/v/${G}/index.html`),read('atlas/index.html'));
for(const c of candidate.cartridges){
 const source=read('atlas/'+c.path);assert.equal(createHash('sha256').update(source).digest('hex'),c.sha256);
 if(c.id!=='sld-sandbox')assert.deepEqual(c,parent.cartridges.find(x=>x.id===c.id));
 else { assert.equal(Buffer.byteLength(source),c.bytes); new vm.Script(source); }
}
const bundle=read(`atlas/modules/${G}-ventus-compute-observer.js`);
assert.equal(createHash('sha256').update(bundle).digest('hex'),candidate.provenance.compute_observer.sha256);
const apiContext={};vm.runInNewContext(bundle,apiContext);
const api=apiContext.VentusGridCompute;
assert.equal(api.distanceKm(-1,52,-1,52),0);
assert.ok(api.distanceKm(-1,52,-1,53)>111);
// The optional declaration lookup must settle independently of the nearest calculation.
const cartridge=read(`atlas/cartridges/${G}-sld-sandbox-v9-8.js`);
const start=cartridge.indexOf('  let nesoPromise = null;'),end=cartridge.indexOf('  function siteKey(',start);
let xhr;class XHR{constructor(){xhr=this;}open(){}send(){}}
const ctx={link:{},document:{baseURI:'https://ventusltd.github.io/gridatlas/atlas/releases/shell/'},URL,XMLHttpRequest:XHR};
vm.runInNewContext(cartridge.slice(start,end)+';globalThis.load=loadNesoSites',ctx);
const pending=ctx.load();assert.equal(xhr.timeout,4000);xhr.ontimeout();await pending;
assert.equal(ctx.link.neso_lookup.status,'failed');assert.equal(ctx.link.neso_lookup.reason,'TIMEOUT');
console.log('Candidate hashes, immutable parent, owner distance bundle and bounded lookup PASS; browser proof required separately.');
