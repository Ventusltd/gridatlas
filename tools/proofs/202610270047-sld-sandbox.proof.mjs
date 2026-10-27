/** Exact change boundary: the live 202609241334 sld-sandbox bytes are carried forward UNCHANGED and exactly one module, the UK lightning overlay, is appended after a single '\n'. Static negatives keep the module outside the engine's, Pipeline News' and the menu's contracts. Browser regression tests prove layout, hit targets and the OFF/ON behaviour separately. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const GEN='202610270047';
const readJson=(p)=>JSON.parse(fs.readFileSync(new URL(p,root)));
/* The composition that names this generation: atlas/current.json once the owner releases it, the pinned candidate route
   atlas/v/<GEN>/ until then. The candidate branch leaves the live pointer at 202609241334 by design. */
let current=readJson('atlas/current.json'),base='atlas/';
if(current.cartridges.find(x=>x.id==='sld-sandbox').generation!==GEN){current=readJson('atlas/v/'+GEN+'/current.json');base='atlas/v/'+GEN+'/';}
const entry=current.cartridges.find(x=>x.id==='sld-sandbox');
assert.equal(entry.generation,GEN);
assert.equal(current.generation,GEN);
const source=fs.readFileSync(new URL(base+entry.path,root),'utf8');
assert.equal(createHash('sha256').update(source).digest('hex'),entry.sha256);
const original=fs.readFileSync(new URL('atlas/cartridges/202609241334-sld-sandbox-v9-8.js',root),'utf8');
assert.equal(createHash('sha256').update(original).digest('hex'),'7812953671d8bb22a566de5e98fd3137da2d23411c5aecd526df5afa111ca4ca','the live 202609241334 cartridge must itself be untouched');
const module=fs.readFileSync(new URL('atlas/modules/'+GEN+'-uk-lightning-overlay.js',root),'utf8');
const expected=original+'\n'+module;
assert.equal(source,expected,'the cartridge must be the live bytes, one newline and the module: nothing replaced, nothing reordered');
assert.ok(Buffer.byteLength(module,'utf8')<=24781,'module exceeds the 24,781-byte budget');
assert.ok(Buffer.byteLength(source,'utf8')<=460000,'cartridge exceeds the 460 kB ceiling');
assert.ok(module.includes('generation '+GEN),'module header must name its generation');
/* Static negatives: the module must not reach into any original contract. */
const negatives=/ukConfig|initVentusMap|window\.fetch|data-layer-id|data-pn-layer|data-gridatlas-layer-proxy|data-gridatlas-layer-key|prepend\(|lbl-|name=["']bm|<style|createElement\(['"]style|localStorage|sessionStorage|document\.cookie/;
assert.equal(negatives.test(module),false,'module touches an engine, Pipeline News, menu, stylesheet or storage contract');
const geojson=module.split('.geojson');
assert.equal(geojson.length,2,'exactly one .geojson literal is allowed: the live feed read by XMLHttpRequest');
assert.ok(module.includes("FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson'"),'the one .geojson literal is the live feed URL');
assert.ok(module.includes('XMLHttpRequest'),'the live feed must be read by XMLHttpRequest, which the original bridge does not hook');
assert.ok(/data\/history\//.test(module),'archive base URL');
const v6=/price-history-time-tabs|price-history-chart-nav|price-history-period-(back|forward)|v5-chart-open|electricity-price-history-panel/;
assert.equal(v6.test(module),false,'no UK Energy Tracker V6 markup transplanted');
/* Static positives: OFF by default, honest vocabulary, the three surfaces, the caps. */
assert.equal(module.includes('gm-panel-body'),false,'the Grid dropdown mirror was removed: the module must not touch the original Grid panel body (P02/P10)');
for(const needle of ["visibility:'none'",'not confirmed ground strikes','unknown','data-lightning-control="toggle"','scada-ui-container','fs-curtain-keys','appendChild','cluster:true','10000','40000','AbortController','EUMETSAT'])
 assert.ok(module.includes(needle),'module must contain '+JSON.stringify(needle));
assert.equal((module.match(/\(\(\)=>\{'use strict'/g)||[]).length,1,'one IIFE');
new vm.Script(source);
console.log('SLD exact delta (202609241334 bytes + \\n + '+GEN+' uk-lightning-overlay module), SHA-256, byte budget, static negatives, static positives and syntax PASS; browser verification runs separately.');
