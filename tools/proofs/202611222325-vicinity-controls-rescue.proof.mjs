import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const current=JSON.parse(read('atlas/current.json'));
const predecessor=JSON.parse(read('atlas/v/202611222130/current.json'));
const preview=JSON.parse(read('atlas/v/202611222325/current.json'));
assert.equal(current.generation,'202611222325');
assert.equal(current.previous_generation,'202611222130');
assert.deepEqual(current.cartridge_order,[...predecessor.cartridge_order,'vicinity-controls-rescue']);
assert.equal(current.cartridges.length,predecessor.cartridges.length+1);
for(let i=0;i<predecessor.cartridges.length;i++){
 const a=current.cartridges[i],b=predecessor.cartridges[i];
 for(const field of ['id','generation','version','type','slot','replace_script','after','sha256'])
  assert.deepEqual(a[field],b[field],'Inherited cartridge changed '+b.id+' '+field);
 assert.equal(a.path.replace(/^\.\//,''),b.path.replace(/^\.\.\/\.\.\//,''),'Source changed '+b.id);
}
const target=current.cartridges.at(-1);
assert.equal(target.id,'vicinity-controls-rescue');
assert.equal(target.after,'vicinity-focus');
const source=read('atlas/modules/202611222325-vicinity-controls-rescue.js');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),target.sha256);
assert.equal(Buffer.byteLength(source),3865);
assert.ok(source.includes("D.fullscreenElement||D.webkitFullscreenElement||D.body"));
assert.ok(source.includes("l.selectAt(loc,name,tech,false"));
assert.ok(!source.includes("gridJourneyPreview"));
new vm.Script(source);
const canonical=JSON.stringify(current,null,1)+'\n';
assert.equal(read('atlas/v/202611222325/current.json'),canonical.replace(/": "(?:\.\/|\.\.\/)/g,'": "../../'));
assert.equal(read('atlas/v/202611222325/index.html'),read('atlas/v/202611222130/index.html'),'Immutable loader changed');
assert.equal(preview.cartridges.at(-1).sha256,target.sha256);
let fakeTime=0,tick,visibilityEvents=0,selectCalls=[],parent;
const style={props:{},setProperty(k,v){this.props[k]=v}};
const body={appendChild(n){n.parentElement=this;parent=this}};
const button={parentElement:{id:'map-controls'},hidden:true,style};
const doc={body,visibilityState:'visible',documentElement:{clientHeight:852},
 getElementById(id){return id==='gridatlas-dash-toggle'?button:id==='gridatlas-menu-bar'?{getBoundingClientRect:()=>({bottom:56})}:null},
 addEventListener(){},dispatchEvent(){visibilityEvents++}};
const engine={arrival_attempts:0,selectAt(...args){selectCalls.push(args);return Promise.resolve(true)}};
const win={location:{search:'?repd_ref=12588&latitude=51.8132088&longitude=-1.3489728&project=Botley%20West&technology=solar'},
 innerHeight:852,__GRIDATLAS_NEON_LINKS__:engine,__GRIDATLAS_V9_MAP__:{getContainer:()=>({getBoundingClientRect:()=>({top:80})})},
 addEventListener(){}};
class Clock extends Date{static now(){return fakeTime}}
vm.runInNewContext(source,{window:win,document:doc,URLSearchParams,Date:Clock,
 Event:class{constructor(type){this.type=type}},setInterval(fn){tick=fn;return 1},setTimeout(){},clearInterval(){}});
assert.equal(parent,body,'Layer toggle must be outside map-controls stacking context');
assert.equal(button.hidden,false);
assert.equal(style.props.top,'64px','Button must be below menu, above card');
assert.equal(style.props.bottom,'auto');
assert.equal(style.props['z-index'],'2147483646');
fakeTime=23000;tick();
await Promise.resolve();await Promise.resolve();
assert.equal(selectCalls.length,1,'Unanswered A4 deep link must wake original Grid Engine exactly once');
assert.deepEqual([...selectCalls[0][0]],[-1.3489728,51.8132088]);
assert.equal(selectCalls[0][1],'Botley West');
assert.equal(selectCalls[0][2],'solar');
assert.equal(visibilityEvents,1,'Safari visible wake dispatched to original handler');
tick();await Promise.resolve();
assert.equal(selectCalls.length,1,'No repeated recovery loop');
console.log('PASS V9.196: preserved inherited cartridge hashes, exact source, independent Layers touch target, one-shot original engine fallback');
