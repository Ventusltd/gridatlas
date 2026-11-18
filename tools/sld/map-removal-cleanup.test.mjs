/** Regression over the real rebuilt SLD functions, including its inherited failure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildSld} from './build.mjs';
const original=buildSld('202611161720').toString('utf8');
const edits=JSON.parse(fs.readFileSync(new URL('./src/map-removal-cleanup-edits.json',import.meta.url)));
let modified=original;for(const e of edits){assert.equal(modified.split(e.before).length-1,1);modified=modified.replace(e.before,e.after);}new vm.Script(modified);
const extract=(source,name,indent=2)=>{const pad=' '.repeat(indent),start=source.indexOf(pad+'function '+name+'(');assert.ok(start>=0);return source.slice(start,source.indexOf('\n'+pad+'}',start)+indent+2);};
function fixture({removed=false,other=false}={}){
 const calls=[],map={getSource(){calls.push('getSource');if(removed)throw Error('style already destroyed');return{setData(){calls.push('setData');}};}},current=other?{}:map;
 const c={map,capturedMap:current,popupWatcher:{disconnect(){calls.push('disconnect');}},link:{last_selection:{name:'Before'},links_drawn:5,grid_scope:{before:true}},SRC:'route',SRC_NODES:'nodes',SRC_PIN:'pin',SCOPE_SRC:'scope',SCOPE_BLOCK:'scope-block',scopeResult:{before:true},currentRepdRef:'2470',currentDeclared:{},currentNeso:{},currentNearest400:{},document:{querySelectorAll(){return[];}},invalidatePendingArrival(reason){calls.push('invalidate:'+reason);},stopAnimation(){calls.push('cancel-animation');},setSourceData(m,id){m.getSource(id).setData({});},emptyCollection(){return{type:'FeatureCollection',features:[]};},disarmCardKeeper(){calls.push('disarm-card');},removeArrivalFallback(){calls.push('remove-fallback');},removeCardBlock(){calls.push('remove-block');},clearArrivalEngine(){calls.push('clear-engine');}};
 vm.createContext(c);vm.runInContext(['clearLinks','clearScope','clearPin'].map(n=>extract(modified,n)).join('\n')+'\n'+extract(modified,'cleanupRemovedMap',4),c);return{c,calls,map};
}
test('additive recipe applies exactly once and compiled successor preserves immutable base',()=>{assert.equal(original.includes('function cleanupRemovedMap'),false);assert.ok(modified.includes("map.on('remove', cleanupRemovedMap)"));assert.equal(edits.length,1);});
test('baseline clearLinks reproduces the inherited destroyed-style error',()=>{const f=fixture({removed:true});assert.throws(()=>f.c.clearLinks(),/style already destroyed/);assert.ok(f.calls.includes('getSource'));});
test('removed-map cleanup cancels work and clears state without any destroyed-style access',()=>{const f=fixture({removed:true});f.c.cleanupRemovedMap();assert.equal(f.c.capturedMap,null);assert.equal(f.calls.includes('getSource'),false);assert.deepEqual(f.calls,['disconnect','invalidate:clear','cancel-animation','disarm-card','remove-fallback','remove-block','clear-engine']);assert.equal(f.c.link.last_selection,null);assert.equal(f.c.link.links_drawn,0);assert.equal(f.c.link.project_pin.shown,false);assert.equal(f.c.link.grid_scope,null);assert.equal(f.c.scopeResult,null);assert.equal(f.c.currentRepdRef,null);f.c.cleanupRemovedMap();assert.equal(f.calls.filter(c=>c==='invalidate:clear').length,1);});
test('removal of an obsolete map cannot clear a newer map selection',()=>{const f=fixture({removed:true,other:true});const current=f.c.capturedMap;f.c.cleanupRemovedMap();assert.equal(f.c.capturedMap,current);assert.deepEqual(f.calls,['disconnect']);assert.equal(f.c.link.last_selection.name,'Before');});
test('ordinary live clear still resets all existing route/node/pin source data',()=>{const f=fixture();f.c.clearLinks();assert.equal(f.calls.filter(c=>c==='setData').length,3);assert.equal(f.c.link.last_selection,null);});
