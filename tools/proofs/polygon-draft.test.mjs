import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync('atlas/modules/202609060320-measurement-draft.js','utf8');
function fixture(storage){const context={window:{},localStorage:storage};vm.runInNewContext(source,context);return context.window.__GRIDATLAS_MODULES__.polygonDraft;}
const outline=[[0.9,51.3],[0.91,51.3],[0.91,51.31],[0.9,51.31]];
test('exact edited coordinates survive a fresh module instance; Reset removes only its own draft',()=>{
 const store=new Map([['other-tool','preserve']]);const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 assert.equal(fixture(storage).saveOutline(outline).saved,true);
 assert.equal(JSON.stringify(fixture(storage).readOutline()),JSON.stringify(outline));
 fixture(storage).clearOutline();assert.equal(fixture(storage).readOutline(),null);assert.equal(store.get('other-tool'),'preserve');
});
test('blocked storage never breaks drawing and reports that the outline was not saved',()=>{
 const blocked=new Proxy({},{get(){throw Error('Storage denied');}}),draft=fixture(blocked);
 assert.equal(draft.saveOutline(outline).saved,false);assert.equal(draft.readOutline(),null);assert.equal(draft.clearOutline().saved,false);
});
test('malformed, oversized, non-finite and out-of-bounds stored outlines are rejected',()=>{
 for(const points of [[],[[1,2]],[[181,0],[0,0],[1,1]],[[1,86],[0,0],[1,1]],[[1,null],[0,0],[1,1]],Array(4097).fill([0,0])]){
  const draft=fixture({getItem:()=>JSON.stringify({schema:'gridatlas.polygon-draft.v1',points})});assert.equal(draft.readOutline(),null);
 }
 for(const text of ['{bad','x'.repeat(250001),JSON.stringify({schema:'wrong',points:outline})])assert.equal(fixture({getItem:()=>text}).readOutline(),null);
});
