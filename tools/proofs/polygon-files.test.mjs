import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context={window:{}};
vm.runInNewContext(fs.readFileSync('atlas/modules/202609060322-measurement-export.js','utf8'),context);
const {exportOutline}=context.window.__GRIDATLAS_MODULES__.polygonFiles;
test('GeoJSON closes the ring, normalizes winding and preserves every source vertex without mutation',()=>{
 const points=[[1,51],[1,52],[2,52],[2,51]],original=JSON.stringify(points);
 const feature=exportOutline(points,{area_m2:15,area_ha:.0015,perimeter_km:2,unsafe:'omit'}).features[0];
 assert.equal(feature.geometry.type,'Polygon');const ring=feature.geometry.coordinates[0];
 assert.equal(ring.length,5);assert.equal(JSON.stringify(ring[0]),JSON.stringify(ring.at(-1)));
 assert.deepEqual(new Set(ring.map(JSON.stringify)),new Set(points.map(JSON.stringify)));
 assert.ok(ring.slice(0,-1).reduce((sum,p,i)=>sum+p[0]*ring[i+1][1]-ring[i+1][0]*p[1],0)>0);
 assert.equal(JSON.stringify(points),original);assert.equal(feature.properties.area_m2,15);assert.equal(feature.properties.unsafe,undefined);
});
test('empty or nonfinite outlines do not produce misleading downloadable polygons',()=>{
 for(const points of [[],[[1,2]],[[NaN,1],[0,0],[1,1]]])assert.throws(()=>exportOutline(points));
});
