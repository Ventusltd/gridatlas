/** Candidate integrity; actual MAP and visible-result acceptance runs separately. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {deriveCurrent,rerootForPreview} from '../release/lib.mjs';
const root=new URL('../../',import.meta.url),G='202611161720';
const read=p=>fs.readFileSync(new URL(p,root),'utf8').replace(/\r\n/g,'\n');
const manifest=read(`atlas/manifests/${G}-composition.json`),candidate=JSON.parse(manifest),live=JSON.parse(read('atlas/current.json'));
const parent=JSON.parse(read('atlas/manifests/202611132345-composition.json'));
// A later live generation may retain this exact source-verified V9.191 SLD.
const approvedSld=candidate.cartridges.find(c=>c.id==='sld-sandbox');
const activeSld=live.cartridges.find(c=>c.id==='sld-sandbox');
assert.ok([parent.generation,G].includes(live.generation)
 || (activeSld?.generation===G&&activeSld.sha256===approvedSld.sha256&&activeSld.path===approvedSld.path),
 'later live compositions must carry the identical approved SLD cartridge');
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
const bundle=read('atlas/modules/202611161645-ventus-compute-observer.js');
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

// Cut metadata is checked by the real promotion and rollback guards.
assert.equal(candidate.parent_generation,parent.generation);
assert.equal(candidate.acceptance.full_application_copies_created,0);
assert.equal(candidate.acceptance.immutable_shell_modified,false);
assert.equal(candidate.version,candidate.composition_version);
assert.equal(candidate.cut_at_utc,'2026-11-16T17:20:00.000Z');
assert.equal(read('atlas/cartridges/202611161720-sld-sandbox-v9-8.js'),read('atlas/cartridges/202611161645-sld-sandbox-v9-8.js'));
// Prove the claim: the immutable application tree is the published base tree,
// and this generation's only HTML is the byte-identical registered loader.
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD:atlas/releases'),git('rev-parse','76653e40:atlas/releases'));
assert.deepEqual(fs.readdirSync(new URL('atlas/v/202611161720/',root)).sort(),['current.json','index.html']);
assert.equal(read('atlas/v/202611161720/index.html'),read('atlas/index.html'));
assert.equal(fs.readdirSync(root).filter(n=>/^\d{12}-atlas-v9$/.test(n)).length,0);
console.log('Cut metadata, real parent lineage and zero full-application copies PROVED');
