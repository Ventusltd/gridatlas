import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const old = readFileSync(new URL('../../atlas/parts/202609041234-sld-sandbox-technology-buckets.js',import.meta.url),'utf8');
const updated = readFileSync(new URL('../../atlas/parts/202609060246-sld-sandbox-offshore-corridor-scope.js',import.meta.url),'utf8');
const coverage = readFileSync(new URL('../../atlas/modules/202609031310-technology-coverage.js',import.meta.url),'utf8');
function functionSource(source,name){const start=source.indexOf('  function '+name+'(');assert.ok(start>=0);const end=source.indexOf('\n  }',start);assert.ok(end>start);return source.slice(start,end+4);}
function render(source,tech,km,modulePresent=true){
 const calls=[];const context={window:{},console};vm.createContext(context);vm.runInContext(coverage,context);
 const policy=context.window.__GRIDATLAS_MODULES__.technologyCoverage.policy(tech);
 const module={forCable:n=>{calls.push(n);return n<1?{withheld:'centroid separation too short',km:null}:{km:n*1.245,factor:1.245}},basis:{factor:1.245,within_15_pct:73,distinct_site_pairs:59,source:'published cable circuits',median_absolute_error_pct:8},caveat:'Screening only.',not_for_overhead:'Not for overhead.',not_an_assessment:'Not a connection assessment.'};
 context.window.__GRIDATLAS_MODULES__.corridorEstimate=modulePresent?module:null;
 Object.assign(context,{currentPolicy:policy,escapeHtml:s=>String(s),corridorTargets:()=>[{name:'Torness',km,note:'nearest mapped 400 kV'}],sheet:{dataset:{},hidden:true}});
 const at=source.indexOf('  const OFFSHORE_CORRIDOR_NOTE =');
 if(at>=0)vm.runInContext(source.slice(at,source.indexOf('  function corridorBeside',at)),context);
 vm.runInContext(functionSource(source,'corridorBeside')+'\n'+functionSource(source,'openCorridorSheet'),context);
 const inline=vm.runInContext(`corridorBeside(${km})`,context);vm.runInContext('openCorridorSheet(sheet)',context);
 return{inline,sheet:context.sheet.innerHTML,calls,opened:context.sheet.dataset.open};
}
test('offshore inline and expanded card withhold highway arithmetic for both supported offshore buckets',()=>{
 for(const tech of ['wind_offshore','wind_offshore_operational']){
  const result=render(updated,tech,78.96);assert.deepEqual(result.calls,[]);
  assert.match(result.inline,/Offshore export route unassessed/);assert.match(result.sheet,/78.96 km straight/);
  assert.match(result.sheet,/Offshore export route unassessed/);assert.doesNotMatch(result.inline+result.sheet,/~98\.3|times 1\.245|98\.3 km corridor estimate/);assert.equal(result.opened,'1');
 }
});
test('regression control: old source does apply the highway factor to the same offshore arrival',()=>{
 const result=render(old,'wind_offshore',78.96);assert.deepEqual(result.calls,[78.96,78.96]);assert.match(result.inline+result.sheet,/98\.3 km corridor estimate/);
});
test('onshore rendering and forCable inputs are byte-for-byte unchanged, including withheld and absent module cases',()=>{
 for(const tech of ['solar','bess','wind_onshore'])for(const km of [78.96,0.2])for(const present of [true,false])assert.deepEqual(render(updated,tech,km,present),render(old,tech,km,present));
});
test('offshore scope remains explicit when calculation module is unavailable',()=>{
 const result=render(updated,'wind_offshore',78.96,false);assert.match(result.sheet,/Offshore export route unassessed/);assert.doesNotMatch(result.sheet,/module is not loaded/);assert.deepEqual(result.calls,[]);
});
