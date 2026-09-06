import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../atlas/parts/202609060402-sld-sandbox-transmission-line.js',import.meta.url),'utf8');
const start=source.indexOf('  function drawLinks('),end=source.indexOf('\n  /*',start);
assert(start>=0&&end>start);
function draw(links,nearest,direction='to-substation'){
 const data={},box={ensureLayers(){},SUBSTATION_COLOUR:'blue',TECH_COLOUR:{},currentNearest400:nearest,currentDeclared:null,SRC:'lines',SRC_NODES:'nodes',setSourceData(_map,id,value){data[id]=value;},armCardKeeper(){},injectIntoCard(){return true;},startAnimation(){},link:{},lastSelection:null,setPin(){}};
 vm.createContext(box);vm.runInContext(source.slice(start,end)+'\nthis.run=drawLinks;',box);
 box.run({},[0,0],'A project','wind_offshore',links,direction,1800);
 return JSON.parse(JSON.stringify(data));
}
test('a distant measured endpoint is drawn even when the nearby list is empty',()=>{
 const out=draw([],{at:[1,2],km:250});assert.equal(out.lines.features.length,1);assert.equal(out.nodes.features.length,1);
 assert.deepEqual(out.lines.features[0].geometry.coordinates,[[0,0],[1,2]]);assert.equal(out.lines.features[0].properties.km,250);assert.equal(out.lines.features[0].properties.role,'indicative-nearest-transmission');assert.match(out.nodes.features[0].properties.label,/straight/);
});
test('a transmission endpoint already in nearby results is not duplicated',()=>{
 const nearby={at:[1,2],km:10,kv:[400]};const out=draw([nearby],nearby);assert.equal(out.lines.features.length,1);assert.equal(out.nodes.features.length,1);
});
test('substation-to-project mode cannot inherit a project transmission result',()=>{
 assert.equal(draw([],{at:[1,2],km:250},'from-substation').lines.features.length,0);
 assert.equal(draw([],null).lines.features.length,0);
});
