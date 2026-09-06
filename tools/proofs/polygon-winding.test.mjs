import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(process.env.POLYGON_MODULE||new URL('../../atlas/modules/202609060441-measurement-winding.js',import.meta.url),'utf8'),context);
const api=context.window.__GRIDATLAS_MODULES__.polygonFiles;
test('clockwise small rectangles export counterclockwise without losing coordinate precision',()=>{
 for(const [x,y,size] of [[1,51,1e-8],[179,85,1e-8],[-3,56,1e-7],[0,0,1]]){
  const points=[[x,y],[x,y+size],[x+size,y+size],[x+size,y]],before=JSON.stringify(points);
  const ring=api.exportOutline(points,{}).features[0].geometry.coordinates[0];
  const [a,b,c]=ring;
  // The rectangle's first corner has a strictly positive left turn iff CCW.
  assert((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0,`wrong winding at ${x},${y} with size ${size}`);
  assert.equal(ring.length,5);assert.equal(JSON.stringify(ring[0]),JSON.stringify(ring.at(-1)));
  assert.deepEqual([...ring.slice(0,-1).map(p=>JSON.stringify(p))].sort(),points.map(p=>JSON.stringify(p)).sort());
  assert.equal(JSON.stringify(points),before);
 }
});
test('counterclockwise input retains exact vertex order',()=>{
 const points=[[179,85],[179.00000001,85],[179.00000001,85.00000001],[179,85.00000001]];
 const ring=api.exportOutline(points,{}).features[0].geometry.coordinates[0];
 assert.equal(JSON.stringify(ring.slice(0,-1)),JSON.stringify(points));
});
