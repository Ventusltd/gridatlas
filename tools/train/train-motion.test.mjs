import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoutePlan} from './src/route-plan.mjs';
import {createTrainRide} from './src/train-motion.mjs';
const geodesy={distanceKm:(a,b,c,d)=>Math.hypot(c-a,d-b)*100};
const makePlan=()=>buildRoutePlan({synthetic:true,stops:[{source:'SYNTHETIC_TEST',id:'a',at:[0,51],kv:400},{source:'SYNTHETIC_TEST',id:'b',at:[1,51],kv:400},{source:'SYNTHETIC_TEST',id:'c',at:[2,51],kv:400}],geodesy,allowSimulated:true});
function fixture(reducedMotion=false,extras={}){
 const sources=new Map(),layers=new Map(),listeners=new Map(),frames=new Map(),history=[],cameras=[];let serial=0,removed=false;
 const access=()=>{if(removed)throw Error('destroyed style');};
 const map={isStyleLoaded:()=>true,on(n,fn){listeners.set(n,fn);},off(n,fn){if(listeners.get(n)===fn)listeners.delete(n);},
  getSource(id){access();return sources.get(id);},getLayer(id){access();return layers.get(id);},
  addSource(id,s){access();sources.set(id,{...s,setData(data){access();this.data=data;history.push(id);}});},addLayer(layer){access();layers.set(layer.id,layer);},
  removeSource(id){access();sources.delete(id);},removeLayer(id){access();layers.delete(id);},
  setPaintProperty(id,k,v){access();layers.get(id).paint[k]=v;},easeTo(o){cameras.push(o);}};
 const ride=createTrainRide({map,geodesy,reducedMotion,requestFrame:fn=>{frames.set(++serial,fn);return serial;},cancelFrame:id=>frames.delete(id),...extras});
 const run=time=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(time);};
 return{ride,map,sources,layers,frames,history,cameras,run,listeners,
  remove(){removed=true;listeners.get('remove')();},styleReload(){sources.clear();layers.clear();listeners.get('style.load')();}};
}
test('explicit play owns one cursor/one bounded loop and leaves native layers intact',()=>{
 const f=fixture();f.layers.set('native400',{id:'native400'});f.ride.setPlan(makePlan());assert.equal(f.frames.size,0);
 assert.equal(f.ride.play(),true);assert.equal(f.ride.play(),true);assert.equal(f.frames.size,1);
 f.run(0);f.run(200);assert.ok(f.ride.snapshot().fraction>0);assert.equal(f.frames.size,1);
 assert.equal(f.sources.get('gridatlas-train-cursor').data.features.length,1);assert.equal(f.cameras.length,0);
 f.ride.pause();assert.equal(f.frames.size,0);f.ride.destroy();assert.deepEqual([...f.layers.keys()],['native400']);
});
test('plan edit midplay invalidates queued old epoch and never moves replacement cursor',()=>{
 const f=fixture();f.ride.setPlan(makePlan());f.ride.play();const stale=[...f.frames.values()][0];
 f.ride.setPlan(makePlan());f.ride.play();stale(100000);assert.equal(f.ride.snapshot().fraction,0);assert.equal(f.frames.size,1);
});
test('reduced motion has static manual step/seek and no animation loop',()=>{
 const f=fixture(true);f.ride.setPlan(makePlan());assert.equal(f.ride.play(),false);assert.equal(f.frames.size,0);
 assert.equal(f.ride.snapshot().stopIndex,1);assert.equal(f.ride.seekStop(2),true);assert.equal(f.ride.snapshot().stopIndex,2);
 assert.equal(f.ride.seekStop(-1),false);assert.equal(f.layers.get('gridatlas-train-flow').paint['line-opacity'],0);
});
test('style reload restores own overlay paused; map removal cancels and queued callbacks do not access style',()=>{
 const f=fixture();f.ride.setPlan(makePlan());f.ride.play();f.styleReload();assert.equal(f.ride.snapshot().playing,false);
 assert.equal(f.layers.size,7);f.ride.play();const stale=[...f.frames.values()][0];f.remove();assert.equal(f.frames.size,0);
 assert.doesNotThrow(()=>stale(9000));assert.doesNotThrow(()=>f.ride.destroy());assert.equal(f.ride.snapshot().alive,false);
});
test('foreign source/layer identities are preserved and block playback',()=>{
 const f=fixture(),foreign={data:'foreign'};f.sources.set('gridatlas-train-routes',foreign);f.ride.setPlan(makePlan());
 assert.equal(f.ride.play(),false);f.ride.destroy();assert.equal(f.sources.get('gridatlas-train-routes'),foreign);
});
test('missing documented route cannot start motion; setting a plan snapshots later UI mutation',()=>{
 const f=fixture(),p=makePlan();f.ride.setPlan(p);p.stops[0].at[0]=99;
 assert.equal(f.sources.get('gridatlas-train-stops').data.features[0].geometry.coordinates[0],0);
 p.playable=false;f.ride.setPlan(p);assert.equal(f.ride.play(),false);assert.equal(f.frames.size,0);
});
test('step and seek cannot cross a missing leg; later stop pins remain and cursor stays on approved prefix',()=>{
 const f=fixture(),p=makePlan();p.legs[1]={...p.legs[1],evidence:'MISSING',coordinates:null,km:null};p.playable=false;
 f.ride.setPlan(p);assert.equal(f.ride.snapshot().approvedThroughStop,1);assert.equal(f.sources.get('gridatlas-train-stops').data.features.length,3);
 assert.equal(f.sources.get('gridatlas-train-routes').data.features.length,1);assert.equal(f.ride.step(),true);
 const at=f.sources.get('gridatlas-train-cursor').data.features[0].geometry.coordinates;
 assert.equal(f.ride.step(),false);assert.equal(f.ride.seekStop(2),false);assert.equal(f.ride.play(),false);
 assert.deepEqual(f.sources.get('gridatlas-train-cursor').data.features[0].geometry.coordinates,at);
 const gapFirst=makePlan();gapFirst.legs[0]={...gapFirst.legs[0],evidence:'MISSING',coordinates:null};gapFirst.playable=false;
 f.ride.setPlan(gapFirst);assert.equal(f.ride.step(),false);assert.equal(f.ride.seekStop(1),false);assert.equal(f.sources.get('gridatlas-train-routes').data.features.length,0);
});
test('clearPlan atomically removes stale route/cursor, retains current valid pins, and refuses old navigation',()=>{
 const f=fixture();f.ride.setPlan(makePlan());f.ride.play();const stale=[...f.frames.values()][0];
 const current=[{id:'new',at:[3,51],kv:[33],proposed:true},{id:'deleted',at:[4,51],invalid:true}];
 assert.equal(f.ride.clearPlan({stops:current}),true);stale(9999);
 assert.equal(f.sources.get('gridatlas-train-routes').data.features.length,0);assert.equal(f.sources.get('gridatlas-train-cursor').data.features.length,0);
 const pins=f.sources.get('gridatlas-train-stops').data.features;assert.equal(pins.length,1);assert.equal(pins[0].properties.kind,'customer_substation');
 assert.equal(f.layers.get('gridatlas-train-proposals').paint['circle-radius'],5);assert.equal(f.layers.get('gridatlas-train-proposals').paint['circle-stroke-width'],1.5);
 assert.equal(f.layers.get('gridatlas-train-proposals').paint['circle-color'],'#e0b050');assert.equal(f.layers.get('gridatlas-train-proposals').paint['circle-stroke-color'],'#000c10');
 assert.equal(f.ride.play(),false);assert.equal(f.ride.seekStop(1),false);assert.equal(f.ride.step(),false);assert.equal(f.frames.size,0);
 f.styleReload();assert.equal(f.sources.get('gridatlas-train-cursor').data.features.length,0);assert.equal(f.sources.get('gridatlas-train-stops').data.features.length,1);
});
test('changed external plan epoch clears the active cursor before a stale frame or seek can run',()=>{
 let epoch=1;const f=fixture(false,{readPlanEpoch:()=>epoch}),p=makePlan();p.planEpoch=1;f.ride.setPlan(p);f.ride.play();
 epoch=2;f.run(100);assert.equal(f.ride.snapshot().playing,false);assert.equal(f.frames.size,0);assert.equal(f.sources.get('gridatlas-train-cursor').data.features.length,0);assert.equal(f.ride.seekStop(1),false);
});
test('GIS solid, topology long-dash and simulated dots are distinct without relying on colour',()=>{
 const f=fixture();f.ride.setPlan(makePlan());
 assert.equal(f.layers.get('gridatlas-train-route-gis').paint['line-dasharray'],undefined);
 assert.deepEqual(f.layers.get('gridatlas-train-route-topology').paint['line-dasharray'],[5,2]);
 assert.deepEqual(f.layers.get('gridatlas-train-route-simulated').paint['line-dasharray'],[1,3]);
 assert.deepEqual(f.layers.get('gridatlas-train-flow').filter,['==',['get','evidence'],'GIS_REVIEWED']);
});
test('rejected replacement clears old route, cursor and queued animation before reporting failure',()=>{
 const f=fixture();f.ride.setPlan(makePlan());f.ride.play();const stale=[...f.frames.values()][0];
 assert.throws(()=>f.ride.setPlan({schema:'invalid'}),/Invalid/);stale(10000);
 assert.equal(f.frames.size,0);assert.equal(f.ride.play(),false);assert.equal(f.ride.seekStop(1),false);
 assert.equal(f.sources.get('gridatlas-train-routes').data.features.length,0);assert.equal(f.sources.get('gridatlas-train-cursor').data.features.length,0);
});
