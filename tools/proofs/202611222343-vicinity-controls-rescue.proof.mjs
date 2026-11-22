import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const current=JSON.parse(read('atlas/current.json'));
const old=JSON.parse(read('atlas/v/202611222325/current.json'));
assert.equal(current.generation,'202611222343');
assert.equal(current.previous_generation,'202611222325');
assert.deepEqual(current.cartridge_order,old.cartridge_order,'nine original logical cartridges retained');
for(let i=0;i<old.cartridges.length-1;i++){
 const a=current.cartridges[i],b=old.cartridges[i];
 for(const k of ['id','generation','version','type','slot','after','sha256'])
  assert.deepEqual(a[k],b[k],'old cartridge changed: '+b.id+' '+k);
 assert.equal(a.path.replace(/^\.\//,''),b.path.replace(/^\.\.\/\.\.\//,''));
}
const target=current.cartridges.at(-1);
assert.equal(target.generation,'202611222343');
assert.equal(target.sha256,'97cb8d05c7c0855b3bdd02ba614f470fbe2d489ed2db7181ca0b7edd5313c8fc');
const src=read('atlas/modules/202611222343-vicinity-controls-rescue.js');
const oldSource=read('atlas/modules/202611222325-vicinity-controls-rescue.js');
assert.ok(src.startsWith(oldSource),'V9.196 PDF/engine and button position code preserved verbatim');
assert.equal(Buffer.byteLength(src),7367);
assert.equal(crypto.createHash('sha256').update(src).digest('hex'),target.sha256);
new vm.Script(src);
for(const token of ["D.getElementById('fs-curtain-tab')","target.click()","stopImmediatePropagation()","D.fullscreenElement||D.webkitFullscreenElement","normal-scada-panel"]){assert.ok(src.includes(token),token);}
assert.equal(read('atlas/v/202611222343/current.json'),JSON.stringify(current,null,1).replace(/": "(?:\.\/|\.\.\/)/g,'": "../../')+'\n');
assert.equal(read('atlas/v/202611222343/index.html'),read('atlas/v/202611222325/index.html'));
let onClickCapture,originalClicks=0,timer,full=true,curtainOpen=false,press=0;
const button={hidden:true,parentElement:{},style:{setProperty(){}},addEventListener(type,cb,cap){if(type==='click'&&cap)onClickCapture=cb;},
 setAttribute(name,value){this[name]=value;},textContent:''};
const curtain={parentNode:{},classList:{contains(k){return k==='curtain-open'&&curtainOpen}},getAttribute(){}};
const tab={click(){curtainOpen=!curtainOpen;}};
const body={classList:{contains(k){return k==='fs-active'&&full}}};
const doc={body,documentElement:{classList:{contains(){return false}}},
 getElementById(k){return {'gridatlas-dash-toggle':button,'fs-curtain':curtain,'fs-curtain-tab':tab,'map-container':{classList:{contains(){return false}}}}[k];},
 addEventListener(){},fullscreenElement:null,webkitFullscreenElement:null};
const win={__GRIDATLAS_DASH__:{collapsed:false},addEventListener(){}};
const bridge=src.slice(src.indexOf('(function fullscreenLayerBridge()'));
assert.ok(bridge.startsWith('(function fullscreenLayerBridge()'));
vm.runInNewContext(bridge,{window:win,document:doc,setInterval(fn){timer=fn;return 1},clearInterval(){}});
assert.equal(typeof onClickCapture,'function');
function click(){
 let stopped=false;
 onClickCapture({preventDefault(){},stopImmediatePropagation(){stopped=true}});
 if(!stopped)originalClicks++;
}
click();assert.equal(curtainOpen,true,'fullscreen button must open actual original curtain');
assert.equal(originalClicks,0,'must NOT touch hidden normal-view SCADA state');
assert.equal(button['aria-pressed'],'true');
click();assert.equal(curtainOpen,false,'same button must close real curtain');
full=false;timer();click();
assert.equal(originalClicks,1,'outside fullscreen the original SCADA click handler must remain owner');
console.log('PASS V9.197: source SHA256, no truncation, old 8 carriers unchanged, original fullscreen curtain route and normal-view delegation');
