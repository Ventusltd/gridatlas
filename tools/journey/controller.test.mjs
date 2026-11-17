/** Lifecycle negatives use a small DOM/map stub. Native GIS acceptance is browser.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createJourneyController} from './src/controller.mjs';
import {planJourney} from './vendor/65d48a851fc2ac74b13f939a0184e11298e7e5bd/edge-cover-journey.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/synthetic-branch.v1.json',import.meta.url)));
const clone=x=>JSON.parse(JSON.stringify(x));
class Target {
  events=new Map();
  addEventListener(t,f){if(!this.events.has(t))this.events.set(t,new Set());this.events.get(t).add(f);}
  removeEventListener(t,f){this.events.get(t)?.delete(f);}
  emit(t,e={}){for(const f of [...(this.events.get(t)||[])])f({type:t,preventDefault(){},...e});}
  listeners(){return [...this.events.values()].reduce((n,s)=>n+s.size,0);}
}
function harness({planner=planJourney,input=fixture,reduced=false,ready=true}={}) {
  const D={activeElement:null}, W=new Target(), media=new Target(); media.matches=reduced;
  let nextRaf=0;const rafs=new Map();W.matchMedia=()=>media;W.requestAnimationFrame=f=>{rafs.set(++nextRaf,f);return nextRaf;};W.cancelAnimationFrame=id=>rafs.delete(id);
  class E extends Target {
    constructor(tag){super();this.tag=tag;this.children=[];this.attrs={};this.textContent='';this.disabled=false;this.hidden=false;}
    setAttribute(k,v){this.attrs[k]=v;if(k==='disabled')this.disabled=true;if(k==='hidden')this.hidden=true;}
    appendChild(e){e.parent=this;this.children.push(e);return e;}
    replaceChildren(){this.children=[];}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);}
    focus(){D.activeElement=this;}
  }
  const container=new E('div');container.attrs.id='map-container';
  const all=(e=container)=>[e,...e.children.flatMap(c=>all(c))];
  D.createElement=t=>new E(t);D.getElementById=id=>all().find(e=>e.attrs.id===id)||null;
  const map=new Target(), sources=new Map(),layers=new Map();map.on=map.addEventListener;map.off=map.removeEventListener;
  map.getContainer=()=>container;map.getStyle=()=>ready?{layers:[...layers.values()]}:undefined;
  map.addSource=(id,v)=>{assert.ok(!sources.has(id));sources.set(id,{data:clone(v.data),writes:0,setData(d){this.data=clone(d);this.writes++;}});};
  map.getSource=id=>sources.get(id);map.removeSource=id=>sources.delete(id);
  map.addLayer=l=>{assert.ok(!layers.has(l.id));layers.set(l.id,clone(l));};map.getLayer=id=>layers.get(id);map.removeLayer=id=>layers.delete(id);map.fitBounds=()=>{};
  const c=createJourneyController({map,document:D,window:W,planner,fixture:clone(input),css:'',generation:'test'});
  const button=s=>all().find(e=>e.tag==='button'&&e.textContent===s),select=()=>all().find(e=>e.tag==='select');
  function choose(){c.open();button('Load SYNTHETIC demonstration').emit('click');select().value='A1';select().emit('change');}
  return {D,W,map,media,rafs,sources,layers,c,all,button,choose,ready(v){ready=v;},status:()=>all().find(e=>e.attrs.role==='status')?.textContent,tick(t){const active=[...rafs.values()];rafs.clear();active.forEach(f=>f(t));}};
}
async function settled(h){for(let i=0;i<250;i++){if(h.c.snapshot().status!=='withheld'||h.status()?.startsWith('WITHHELD:'))return;await new Promise(r=>setTimeout(r,2));}throw new Error('Planner did not settle');}
test('missing map refuses before DOM mount',()=>assert.throws(()=>createJourneyController({map:null}),/Native MapLibre/));
test('explicit demo/seed, branch/backtrack, reset and owned cleanup',async()=>{const h=harness();h.c.open();assert.equal(h.sources.size,0);h.choose();await settled(h);assert.equal(h.layers.size,3);assert.equal(h.sources.size,2);assert.equal(h.c.snapshot().steps,8);for(let i=0;i<8;i++)h.button('Next').emit('click');assert.equal(h.c.snapshot().step,8);assert.match(h.status(),/backtrack B1 → A1/);h.button('Reset').emit('click');assert.equal(h.c.snapshot().step,0);h.c.close();assert.equal(h.sources.size,0);h.c.open();assert.equal(h.layers.size,3);h.c.destroy();assert.equal(h.map.listeners(),0);assert.equal(h.W.listeners(),0);assert.equal(h.media.listeners(),0);assert.equal(h.all().length,1);});
for(const kind of ['source','layer'])test(`${kind} collision is terminal and never mutates external content`,async()=>{const h=harness();let external;if(kind==='source'){h.map.addSource('gridatlas-gj03-cursor',{data:{owner:'external'}});external=h.sources.get('gridatlas-gj03-cursor');}else{h.map.addLayer({id:'gridatlas-gj03-schematic',source:'external'});external=h.layers.get('gridatlas-gj03-schematic');}h.choose();await settled(h);assert.equal(h.c.snapshot().status,'withheld');assert.match(h.status(),/collision/);assert.equal(h.button('Next').disabled,true);h.button('Next').emit('click');assert.equal(kind==='source'?h.sources.get('gridatlas-gj03-cursor'):h.layers.get('gridatlas-gj03-schematic'),external);if(kind==='source')assert.equal(external.writes,0);h.c.destroy();assert.equal(kind==='source'?h.sources.size:h.layers.size,1);});
test('style reload installs exactly one owned set without listener growth',async()=>{const h=harness();h.choose();await settled(h);for(let i=0;i<4;i++){h.sources.clear();h.layers.clear();h.map.emit('style.load');assert.equal(h.sources.size,2);assert.equal(h.layers.size,3);assert.equal(h.map.listeners(),3);}let frames=0;h.map.fitBounds=()=>frames++;h.map.emit('resize');assert.equal(frames,1);h.c.destroy();});
test('replacement source with the same ID after style reload remains foreign',async()=>{const h=harness();h.choose();await settled(h);h.sources.clear();h.layers.clear();h.map.addSource('gridatlas-gj03-cursor',{data:{owner:'external-new-style'}});const foreign=h.sources.get('gridatlas-gj03-cursor');h.map.emit('style.load');assert.match(h.status(),/collision/);assert.equal(h.c.snapshot().status,'withheld');assert.equal(foreign.writes,0);h.c.destroy();assert.equal(h.sources.get('gridatlas-gj03-cursor'),foreign);});
test('reduced motion is manual; preference changes cancel playback RAF',async()=>{const h=harness({reduced:true});h.choose();await settled(h);h.button('Start · manual').emit('click');assert.equal(h.c.snapshot().step,1);assert.equal(h.rafs.size,0);h.media.matches=false;h.media.emit('change');h.button('Start').emit('click');assert.equal(h.rafs.size,1);h.tick(0);h.tick(400);assert.equal(h.sources.get('gridatlas-gj03-cursor').data.features.length,1);h.media.matches=true;h.media.emit('change');assert.equal(h.rafs.size,0);assert.equal(h.c.snapshot().playing,false);h.c.destroy();});
test('map removal cancels RAF/listeners and stale callback cannot resurrect UI',async()=>{const h=harness();h.choose();await settled(h);h.button('Start').emit('click');const stale=[...h.rafs.values()][0];h.sources.clear();h.layers.clear();h.map.getLayer=()=>{throw new Error('style already destroyed');};h.map.emit('remove');assert.equal(h.c.snapshot().alive,false);assert.equal(h.rafs.size,0);assert.equal(h.map.listeners(),0);assert.equal(h.W.listeners(),0);stale(1000);h.map.emit('style.load');assert.equal(h.sources.size,0);assert.equal(h.all().length,1);h.c.destroy();});
test('late asynchronous planning after close/destroy cannot add map resources',async()=>{let resolve;const h=harness({planner:()=>new Promise(r=>{resolve=r;})});h.choose();h.c.close();h.c.destroy();resolve(await planJourney({sourceBytes:fixture.networkText,ledger:fixture.ledger,query:{seed:{chosenNode:'A1'}}}));await new Promise(r=>setTimeout(r,0));assert.equal(h.sources.size,0);assert.equal(h.all().length,1);});
test('blocked seed rights draws nothing',async()=>{const input=clone(fixture);input.ledger.nodes[0].rights={status:'blocked'};const h=harness({input});h.choose();await settled(h);assert.match(h.status(),/seed_rights_withheld/);assert.equal(h.sources.size,0);h.c.destroy();});
test('unsupported geometry output is refused by presentation',async()=>{const h=harness({planner:async()=>({status:'complete',steps:[{}],edgeCatalog:[{geometryStatus:'invented'}]})});h.choose();await settled(h);assert.match(h.status(),/Unsupported geometry/);assert.equal(h.sources.size,0);h.c.destroy();});
test('stylesheet arriving late and real card selection while closed',async()=>{const h=harness({ready:false});h.choose();await settled(h);assert.equal(h.sources.size,0);h.ready(true);h.map.emit('style.load');assert.equal(h.sources.size,2);h.c.close();h.W.emit('gridatlas:card-open');h.c.open();assert.equal(h.c.snapshot().status,'withheld');assert.equal(h.sources.size,0);assert.match(h.status(),/no reviewed circuit/);h.c.destroy();});
test('public bootstrap replaces a controller destroyed by native map.remove',()=>{const instances=[], firstMap={},nextMap={}, W={__GRIDATLAS_V9_MAP__:firstMap};const context={window:W,document:{},JourneyEngine:{},JourneyFixture:{},JourneyCSS:'',JourneyGeneration:'test',console,setTimeout,clearTimeout,createJourneyController(options){let alive=true;const c={options,snapshot:()=>({alive}),destroy(){alive=false;}};instances.push(c);return c;}};vm.runInNewContext(fs.readFileSync(new URL('./src/bootstrap.js',import.meta.url),'utf8'),context);assert.equal(instances.length,1);instances[0].destroy();const mounted=W.__GRIDATLAS_MODULES__.gridJourneyPreview.mount(nextMap);assert.equal(instances.length,2);assert.equal(mounted.options.map,nextMap);W.__GRIDATLAS_MODULES__.gridJourneyPreview.destroy();});
test('missing-map bounded attachment timer is removed by public destroy',()=>{let timer,cleared=false,created=0;const W={};const context={window:W,document:{},JourneyEngine:{},JourneyFixture:{},JourneyCSS:'',JourneyGeneration:'test',console,setTimeout(f){timer=f;return 7;},clearTimeout(id){assert.equal(id,7);cleared=true;},createJourneyController(){created++;}};vm.runInNewContext(fs.readFileSync(new URL('./src/bootstrap.js',import.meta.url),'utf8'),context);assert.equal(typeof timer,'function');W.__GRIDATLAS_MODULES__.gridJourneyPreview.destroy();timer();assert.equal(cleared,true);assert.equal(created,0);});
