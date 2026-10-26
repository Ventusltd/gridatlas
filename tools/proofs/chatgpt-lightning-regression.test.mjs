#!/usr/bin/env node
// Independent fail-first runtime regressions for GridAtlas lightning. Node built-ins only.
// From repo root: node --test tools/proofs/chatgpt-lightning-regression.test.mjs
// RED tests are expected on the original candidate; do not adjust expectations to pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const gen=process.env.LIGHTNING_TEST_GEN||'202610261949';
const path='atlas/modules/'+gen+'-uk-lightning-overlay.js';
const src=readFileSync(path,'utf8');
const seam='NS.ukLightning=Object.freeze(';
assert.equal(src.split(seam).length,2,'Test probe cannot locate the original module seam');
const observed=src.replace(seam,'window.__PROBE__={ok,cf,sh,cp,ff,state:S};'+seam);
const hoursAgo=h=>Date.now()-h*3600000;
const stamp=h=>new Date(hoursAgo(h)).toISOString();
const flash=(h,id,coords=[-1.5,52])=>({type:'Feature',id,
  geometry:{type:'Point',coordinates:coords},
  properties:{time_utc:stamp(h),observation_kind:'optical_lightning_flash'}});
const feed=(features,age=1)=>({type:'FeatureCollection',features,
  metadata:{query_start_utc:stamp(age+1),query_end_utc:stamp(age),
    scan_end_utc:stamp(age),published_at_utc:stamp(age)}});

function boot({getFeed=()=>feed([flash(2,'one')]),getJson=()=>({ok:false,status:404})}={}){
  const xhr=[],requests=[],sources=new Map(),layers=new Map();
  const map={
    getLayer:id=>layers.get(id),getSource:id=>sources.get(id),
    addSource:(id,opt)=>sources.set(id,{...opt,setData(x){this.data=x;}}),
    addLayer:x=>layers.set(x.id,{...x}),
    removeLayer:id=>layers.delete(id),removeSource:id=>sources.delete(id),
    setLayoutProperty(id,key,value){let x=layers.get(id);if(x){x.layout=x.layout||{};x.layout[key]=value;}}
  };
  class XHR {
    open(method,url){this.url=url;}
    send(){xhr.push(this.url);const data=getFeed();
      if(data?.error){this.onerror?.();return;}
      this.status=data?.status||200;
      this.responseText=JSON.stringify(data?.json??data);this.onload?.();
    }
  }
  const sandbox={
    window:{__GRIDATLAS_V9_MAP__:map,innerWidth:1440},document:{},
    Date,AbortController,Map,XMLHttpRequest:XHR,
    fetch:async(url,opts)=>{requests.push(url);return getJson(url,opts);},
    matchMedia:()=>({matches:false}),setTimeout,clearTimeout,
    setInterval:()=>17,clearInterval:()=>{}
  };
  vm.runInNewContext(observed,sandbox,{filename:path,timeout:2000});
  return {api:sandbox.window.__GRIDATLAS_MODULES__.ukLightning,
    probe:sandbox.window.__PROBE__,xhr,requests,sources,layers};
}
const drain=async()=>{for(let k=0;k<15;k++)await new Promise(resolve=>setImmediate(resolve));};

test('Sanity: lightning starts OFF with zero network and map work',async()=>{
  const x=boot();await drain();
  assert.equal(x.api.state.on,false);
  assert.equal(x.requests.length,0);
  assert.equal(x.xhr.length,0);
  assert.equal(x.sources.size,0);
});

test('H01: reactivating feed fetches newer observations, not a cached promise',async()=>{
  let response=feed([flash(2,'old')]);
  const x=boot({getFeed:()=>response});
  x.api.setOn(true);await drain();
  assert.equal(x.xhr.length,1);
  assert.equal(x.api.state.res?.ev?.[0]?.id,'old');
  x.api.setOn(false);
  response=feed([flash(0.5,'new')]);
  x.api.setOn(true);await drain();
  assert.equal(x.xhr.length,2,'refresh / OFF→ON must revalidate the live feed');
  assert.equal(x.api.state.res?.ev?.[0]?.id,'new');
});

test('H02: fallback feed older than 24h carries visible STALE state',()=>{
  const x=boot(),now=Date.now(),w={s:now-7*864e5,e:now,period:'7d'};
  const r={mode:'feed',idx:null,fl:[],ev:[flash(72,'stale')],w,
    meta:feed([flash(72,'stale')],72).metadata,
    cov:{f:0.1,ny:3*864e5,bf:0,u:[],r:1}};
  assert.equal(x.probe.cf(r,now).stale,true);
});

test('H03: geodesy rejects out-of-bounds and malformed coordinates',()=>{
  const x=boot();
  assert.equal(x.probe.ok(flash(1,'valid',[-1.5,52])),true);
  for(const bad of [[150,10],[null,52],['bad',52],[NaN,52],[-1.5,95],[],[0]]){
    assert.equal(x.probe.ok(flash(1,'invalid',bad)),false,'bad coordinate: '+JSON.stringify(bad));
  }
});

test('H04: reject a dated shard whose index count, bytes and hash are wrong',async()=>{
  const x=boot({getJson:async()=>({ok:true,status:200,json:async()=>({
    schema:'uk-lightning-history-day.v1',type:'FeatureCollection',
    metadata:{date_utc:'2026-10-26'},features:[flash(2,'valid')]
  })})});
  await assert.rejects(
    x.probe.sh({path:'days/2026/10/26.json',sealed:true,
      count:999,bytes:123456,sha256:'0'.repeat(64)},'2026-10-26'),
    /integrity|mismatch|count|sha|bytes/i);
});

test('H05: do not call overlapping whole-day index counts exact in-window totals',()=>{
  const x=boot(),now=Date.now(),w={s:now-12*36e5,e:now,period:'12h',
    label:'12 hours',atLatest:true,custom:false,clamped:false};
  const r={w,mode:'detail',idx:{gen:now,iv:1,nextDue:now+36e5},
    ev:[flash(2,'valid')],arch:50000,ld:['2026-10-26'],sk:['2026-10-25'],
    fl:[],rq:2,cs:'index',ic:40000,cl:true,
    cov:{f:1,r:6,a:w.s,b:w.e,ny:0,bf:0,u:[],d:2}};
  const captions=x.probe.cp(r,now);
  assert.doesNotMatch(captions.flashes,/50,000 archived in window/i);
});


test('H07: 12-month selection remains usable with no archive, retaining only genuine feed events',async()=>{
  const x=boot({getFeed:()=>feed([flash(2,'genuine')])});
  const now=Date.now();
  const oneYear={s:now-365*864e5,e:now,label:'1 year',period:'12m',
    atLatest:true,custom:false,clamped:false,span:365*864e5};
  const r=await x.probe.ff(oneYear,now,'archive index HTTP 404');
  assert.equal(r.mode,'feed');
  assert.equal(r.ev.length,1,'No fake historical observations: only one genuine feed fixture point');
  assert.equal(r.ev[0].id,'genuine');
  const captions=x.probe.cp(r,now);
  assert.match(captions.window,/1 year|12m|2025/i);
  assert.match(captions.flashes+' '+captions.warning+' '+captions.refresh,
    /unknown|unavailable|not published/i,
    'Historical periods remain selectable but missing older coverage must be called UNKNOWN');
});

test('H08: live-feed last query window is NOT an evidence-backed 2% searched coverage claim',()=>{
  const x=boot(),now=Date.now(),w={s:now-7*864e5,e:now,
    period:'7d',label:'7 days',atLatest:true,custom:false,clamped:false};
  const f=feed([flash(2,'real')],1);
  const r={mode:'feed',idx:null,ie:'archive HTTP 404',meta:f.metadata,w,
    ev:f.features,fl:[],rq:1,cs:'live feed',ic:1,cl:false,ld:[],sk:[],
    cov:{f:0.02,ny:now-w.s,bf:0,u:[],d:7,r:1,a:now-3*36e5,b:now}};
  const lines=x.probe.cp(r,now);
  assert.doesNotMatch(lines.searched,/Searched EUMETSAT\s+\d+(?:\.\d+)?%\s+of window/i,
    'The most recent collection query does not prove seven-day cumulative search coverage');
  assert.match(lines.searched+' '+lines.warning,/unknown|unverified|not available/i,
    'Feed mode must explicitly state that full-window searched coverage is unknown');
});
