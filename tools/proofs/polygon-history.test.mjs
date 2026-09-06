import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context={window:{}};vm.runInNewContext(fs.readFileSync('atlas/modules/202609060324-measurement-history.js','utf8'),context);
const {createHistory}=context.window.__GRIDATLAS_MODULES__.polygonHistory;
const shape=n=>[[n,51],[n+1,51],[n,52]];
test('undo and redo restore entire edits and resets without aliasing live coordinates',()=>{
 const h=createHistory(),a=shape(0),b=shape(1);h.commit(a);h.commit(b);h.commit([]);
 assert.equal(JSON.stringify(h.undo()),JSON.stringify(b));const restored=h.undo();assert.equal(JSON.stringify(restored),JSON.stringify(a));restored[0][0]=99;
 assert.equal(JSON.stringify(h.redo()),JSON.stringify(b));assert.equal(JSON.stringify(h.undo()),JSON.stringify(a));
 assert.equal(JSON.stringify(h.undo()),'[]');assert.equal(h.canUndo,false);
});
test('new edits discard redo and duplicate renders do not consume history capacity',()=>{
 const h=createHistory(4);h.commit(shape(1));h.commit(shape(1));h.commit(shape(2));h.undo();h.commit(shape(3));assert.equal(h.canRedo,false);
 h.commit(shape(4));h.commit(shape(5));let count=0;while(h.canUndo){h.undo();count++;}assert.equal(count,3);
});
