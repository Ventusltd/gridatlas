import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context={window:{}};vm.runInNewContext(fs.readFileSync('atlas/modules/202609060323-measurement-import.js','utf8'),context);
const {exportOutline,importOutline}=context.window.__GRIDATLAS_MODULES__.polygonFiles;
const points=[[1,51],[2,51],[2,52],[1,52]];
test('own export round-trips all coordinate bytes through collection, feature and geometry forms',()=>{
 const data=exportOutline(points);
 for(const form of [data,data.features[0],data.features[0].geometry])assert.equal(JSON.stringify(importOutline(JSON.stringify(form))),JSON.stringify(points));
});
test('ambiguous collections, holes, open rings, huge inputs and invalid coordinates fail explicitly',()=>{
 const data=exportOutline(points),geometry=data.features[0].geometry;
 for(const value of [{type:'FeatureCollection',features:[]},{type:'FeatureCollection',features:[data.features[0],data.features[0]]},{...geometry,coordinates:[...geometry.coordinates,...geometry.coordinates]},{...geometry,coordinates:[points]},{type:'LineString',coordinates:points},{...geometry,coordinates:[[[190,0],[0,0],[0,1],[190,0]]]}])assert.throws(()=>importOutline(JSON.stringify(value)));
 assert.throws(()=>importOutline('{broken'));assert.throws(()=>importOutline(' '.repeat(250001)));
});
