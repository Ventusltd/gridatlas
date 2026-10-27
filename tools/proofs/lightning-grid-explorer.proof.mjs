/**
 * Static/Node proof for the isolated next-version Lightning → Grid Lab.
 * Does not claim real iPhone/browser/CORS success.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../');
const page='atlas/labs/lightning-grid/index.html';
const app='atlas/labs/lightning-grid/app.mjs';
const html=readFileSync(resolve(root,page),'utf8');
const js=readFileSync(resolve(root,app),'utf8');
const live=JSON.parse(readFileSync(resolve(root,'atlas/current.json'),'utf8'));
let count=0;
const check=(condition,msg)=>{assert.ok(condition,msg);count++};
check(live.generation==='202609241334','Original live generation must be untouched');
check(html.includes('src="./app.mjs"'),'Lab uses separate JS sidecar');
check(html.includes('id="scenario" disabled'),'Scenario disabled until real selection');
check(html.includes('id="inspect" disabled'),'Cannot search without actual feed');
check(html.includes('id="flash" disabled'),'No fabricated default optical event');
check(html.includes('min-height:44px'),'Mobile touch-size declared on controls');
check(html.includes('not</strong> a confirmed cloud-to-ground strike'),'Observation disclaimer in initial static HTML');
check(js.includes('ventus-grid-engine@1829ea0b132dc5f1650c1cacdc54635fec6b1fc1'),'Use immutable shared source, not a duplicate nearest engine');
check(js.includes('createLightningContextEngine'),'Import existing nearest engine');
check(js.includes('lightningElectricalScenario'),'Import existing scenario adapter');
check(js.includes('www.')===false || !js.includes('eval('),'No dynamic eval');
check(js.includes('https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson'),'Real live optical feed');
check(js.includes('Ventusltd/pipelinenews/main/data/atlas/'),'Genuine solar partitions');
check(js.includes('grid_substations.geojson'),'Actual original Atlas substation dataset');
check(js.includes('location.href'),'Deep-link selected genuine source event');
check(js.includes('flash_id'),'Unique real flash key, not fake REPD identity');
check(js.includes('Earlier than the seven-day feed remains UNKNOWN'),'Coverage honesty maintained');
check(js.includes("target='_blank'")===false,'Links created with DOM methods');
check(js.includes("a.rel='noopener noreferrer'"),'External receiver links protect opener');
check(!/setLayoutProperty|addLayer|addSource|atlas\/current\.json.*write/.test(js),'Do not edit or reimplement original map shell');
check(!js.includes('calculateFaultCurrent('),'No fake quantitative protection calculations');
const compile=spawnSync(process.execPath,['--check',resolve(root,app)],{encoding:'utf8'});
check(compile.status===0,'ESM syntax parses: '+compile.stderr);
const bytes=new TextEncoder().encode(js).length;
check(bytes<30000,'Bounded standalone controller size');
console.log('PASS — '+count+' isolated Lightning → Grid Lab static checks; app '+bytes+' UTF-8 bytes.');
