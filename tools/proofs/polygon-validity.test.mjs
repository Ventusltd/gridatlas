import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(new URL('../../atlas/modules/202609060355-measurement-validity.js',import.meta.url),'utf8'),context);
const {analyzeOutline,exportOutline}=context.window.__GRIDATLAS_MODULES__.polygonFiles;
test('accept simple convex and concave boundaries in either winding',()=>{
 for(const points of [[[0,0],[2,0],[2,2],[0,2]],[[0,0],[2,0],[1,1],[2,2],[0,2]],[[0,0],[1,0],[2,0],[2,2],[0,2]]]){
  assert.equal(analyzeOutline(points).valid,true);assert.equal(analyzeOutline(points.toReversed()).valid,true);
 }
});
test('reject crossings, nonadjacent touching, duplicates and retraced edges',()=>{
 const invalid=[[[0,0],[2,2],[0,2],[2,0]],[[0,0],[2,0],[1,0],[1,1]],[[0,0],[1,0],[1,0],[0,1]],[[0,0],[2,0],[2,2],[1,0],[0,2]],[[0,0],[1,1],[2,2]],[[179,0],[-179,0],[-179,1],[179,1]]];
 for(const points of invalid){assert.equal(analyzeOutline(points).valid,false);assert.throws(()=>exportOutline(points,{area_m2:123}),/Polygon not exported/);}
});
test('reject invalid coordinates without changing the caller outline',()=>{
 const points=[[0,0],[1,0],[0,Infinity]],before=points.map(p=>p.slice());assert.equal(analyzeOutline(points).code,'coordinates');assert.deepEqual(points,before);
});
test('retain small valid outlines and handle the maximum 4096 vertices',()=>{
 assert.equal(analyzeOutline([[1,51],[1.00000001,51],[1.00000001,51.00000001],[1,51.00000001]]).valid,true);
 const points=Array.from({length:4096},(_,i)=>[Math.cos(i*2*Math.PI/4096),51+Math.sin(i*2*Math.PI/4096)]);
 const start=performance.now();assert.equal(analyzeOutline(points).valid,true);console.log('4096 vertex validation milliseconds',performance.now()-start);
});
