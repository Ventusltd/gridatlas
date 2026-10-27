import test from 'node:test';
import assert from 'node:assert/strict';
import {attachLightningHitTargets,HIT_LAYER,SOURCE,validateOpticalFeature}
  from '../../atlas/experiments/lightning-grid-20261027/selection.mjs';

const sourceFeature={
 type:'Feature',id:'authentic-eumetsat-source-id',
 geometry:{type:'Point',coordinates:[-4.212,55.374302]},
 properties:{observation_kind:'optical_lightning_flash',time_utc:'2026-10-25T03:28:34.229Z'}
};
function mockMap(){
 const source=new Map(),layer=new Map(),listeners=new Map();
 const key=(type,id)=>type+'|'+(id||'');
 const map={
   on(type,a,b){const k=key(type,typeof a==='string'?a:'');const fn=typeof a==='string'?b:a;
     const xs=listeners.get(k)||[];xs.push(fn);listeners.set(k,xs);return map;},
   off(type,a,b){const k=key(type,typeof a==='string'?a:'');const fn=typeof a==='string'?b:a;
     listeners.set(k,(listeners.get(k)||[]).filter(x=>x!==fn));return map;},
   trigger(type,id,event){for(const f of listeners.get(key(type,id))||[])f(event);},
   getSource:id=>source.get(id),addSource:(id,s)=>source.set(id,s),
   getLayer:id=>layer.get(id),addLayer:l=>layer.set(l.id,l),
   removeLayer:id=>layer.delete(id),
   listenerCount:(type,id)=>listeners.get(key(type,id))?.length||0
 };return map;
}
test('no lighting source: does NOT invent source or layer; installs lazily',()=>{
 const map=mockMap(),r=attachLightningHitTargets(map);
 assert.equal(r.installed,false);
 assert.equal(map.getLayer(HIT_LAYER),undefined);
 map.addSource(SOURCE,{type:'geojson'});
 map.trigger('sourcedata');
 assert.equal(r.installed,true);
 assert.equal(map.getLayer(HIT_LAYER).source,SOURCE);
 assert.equal(map.getLayer(HIT_LAYER).paint['circle-radius'],22);
 r.destroy();assert.equal(map.getLayer(HIT_LAYER),undefined);
});
test('select authentic individual flash, keeping exact UTC/coordinates and original ID',()=>{
 const map=mockMap(),found=[];
 map.addSource(SOURCE,{type:'geojson'});
 const r=attachLightningHitTargets(map,{onFlash:x=>found.push(x)});
 map.trigger('click',HIT_LAYER,{features:[sourceFeature]});
 assert.equal(found.length,1);
 assert.equal(found[0].observation.id,sourceFeature.id);
 assert.equal(found[0].observation.lon,-4.212);
 assert.equal(found[0].observation.lat,55.374302);
 assert.equal(found[0].observation.time_utc,'2026-10-25T03:28:34.229Z');
 assert.equal(found[0].layer,HIT_LAYER);
 assert.match(found[0].observation.caveat,/NOT a measured cloud-to-ground strike/);
 r.destroy();
});
test('reject missing optical ID, malformed time and non-optical observations',()=>{
 const broken=[
  {...sourceFeature,id:null},
  {...sourceFeature,geometry:{type:'Point',coordinates:[null,55]}},
  {...sourceFeature,properties:{...sourceFeature.properties,observation_kind:'ground_strike'}},
  {...sourceFeature,properties:{...sourceFeature.properties,time_utc:'not-time'}}
 ];
 for(const f of broken)assert.throws(()=>validateOpticalFeature(f));
});
test('a cluster is not transformed into a fake individual strike',()=>{
 const map=mockMap(),flashes=[],clusters=[];
 map.addSource(SOURCE,{type:'geojson'});
 const r=attachLightningHitTargets(map,{onFlash:f=>flashes.push(f),onCluster:c=>clusters.push(c)});
 map.trigger('click',HIT_LAYER,{features:[{
   type:'Feature',id:44,geometry:{type:'Point',coordinates:[-4.2,55.3]},
   properties:{cluster:true,cluster_id:23,point_count:55}
 }]});
 assert.equal(flashes.length,0);
 assert.equal(clusters.length,1);
 assert.equal(clusters[0].point_count,55);
 r.destroy();
});
test('44 px hit target refuses smaller and prevents ghost callbacks after OFF',()=>{
 const map=mockMap(),found=[];
 assert.throws(()=>attachLightningHitTargets(map,{radiusPx:19}),/44/);
 map.addSource(SOURCE,{type:'geojson'});
 const r=attachLightningHitTargets(map,{onFlash:f=>found.push(f)});
 r.destroy();
 map.trigger('click',HIT_LAYER,{features:[sourceFeature]});
 assert.equal(found.length,0);
 assert.equal(map.listenerCount('click',HIT_LAYER),0);
 assert.equal(map.listenerCount('styledata'),0);
 assert.equal(map.listenerCount('sourcedata'),0);
});
test('source geometry remains unchanged during each selection',()=>{
 const before=JSON.stringify(sourceFeature);
 const map=mockMap();
 map.addSource(SOURCE,{type:'geojson'});
 const r=attachLightningHitTargets(map);
 map.trigger('click',HIT_LAYER,{features:[sourceFeature]});
 assert.equal(JSON.stringify(sourceFeature),before);
 r.destroy();
});
