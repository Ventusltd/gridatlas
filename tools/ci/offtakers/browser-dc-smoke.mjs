#!/usr/bin/env node
/**
 * Issue #73 real-Chromium screening smoke test for a draft preview.
 * Serves only committed files; replaces GitHub Pages data requests with local
 * SHA-pinned PR files. No credentials, no writes to live, no external APIs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const G = process.env.DC_SMOKE_GENERATION || '202610292044';
const OUT = path.join(process.env.RUNNER_TEMP || '/tmp', 'gridatlas-dc-browser');
fs.mkdirSync(OUT, { recursive: true });
const FIXTURE = JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, 'tools/ci/lightning/fixtures/repd-master-v8-oracle.json.gz'))));
const MIME = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const errors = [], observations = [];
const server = http.createServer((req,res)=>{
  let u; try {u = decodeURIComponent(new URL(req.url,'http://localhost').pathname)} catch {res.writeHead(400);return res.end();}
  if(!u.startsWith('/gridatlas/')){res.writeHead(404);return res.end();}
  const rel = u.slice('/gridatlas/'.length), loc=path.resolve(ROOT,rel);
  if(loc!==ROOT&&!loc.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
  try { const f=fs.statSync(loc).isDirectory()?path.join(loc,'index.html'):loc;const data=fs.readFileSync(f);
    res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store','access-control-allow-origin':'*'}); res.end(data);
  }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const browser=await chromium.launch({headless:true});
async function run(width,height){
  const ctx=await browser.newContext({viewport:{width,height},acceptDownloads:true,deviceScaleFactor:1,hasTouch:width<500,isMobile:width<500,locale:'en-GB',timezoneId:'Europe/London'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(width+' pageerror '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&/offtakers|TypeError|ReferenceError/.test(m.text()))errors.push(width+' console '+m.text().slice(0,250));});
  await page.route(/https:\/\/ventusltd\.github\.io\/gridatlas\/data\/[\w.-]+\.geojson$/,async route=>{
    const base=route.request().url().split('/').pop(),f=path.join(ROOT,'data',base);
    if(!fs.existsSync(f))return route.fulfill({status:404,body:'not found'});
    return route.fulfill({status:200,body:fs.readFileSync(f),headers:{'content-type':'application/geo+json','access-control-allow-origin':'*'}});
  });
  await page.route(/\/dist\/repd_master\.json(?:\?.*)?$/,route=>route.fulfill({status:200,body:JSON.stringify(FIXTURE),headers:{'content-type':'application/json','access-control-allow-origin':'*'}}));
  const route=`http://127.0.0.1:${port}/gridatlas/atlas/v/${G}/`;
  await page.goto(route,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(g=>document.documentElement.dataset.gridatlasGeneration===g&&window.__GRIDATLAS_MODULES__?.ukOfftakers&&window.__GRIDATLAS_V9_MAP__,G,{timeout:90000});
  await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__?.menuBar?.inspect?.().complete===true,null,{timeout:90000});
  const init=await page.evaluate(()=>({gen:document.documentElement.dataset.gridatlasGeneration,lightning:window.__GRIDATLAS_MODULES__.ukLightning?.generation,installed:window.__GRIDATLAS_MODULES__.menuBar.inspect()}));
  assert.equal(init.gen,G);assert.equal(init.lightning,'202610291043');
  assert.equal(init.installed.complete,true);
  await page.waitForSelector('[data-offtakers-control="toggle"]',{state:'attached',timeout:45000});
  await page.evaluate(()=>{const el=[...document.querySelectorAll('[data-offtakers-control="toggle"]')].find(x=>x.closest('#scada-ui-container'))||document.querySelector('[data-offtakers-control="toggle"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  try {
    await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__.ukOfftakers?.state?.data?.dots?.filter(d=>d.k==='c').length>=225,{timeout:45000});
  } catch(error) {
    const diagnosis=await page.evaluate(()=>{
      const x=window.__GRIDATLAS_MODULES__.ukOfftakers,S=x?.state;
      return {gen:x?.generation,on:S?.on,serial:S?.serial,busy:S?.busy,err:S?.err,pe:S?.pe,
        waiting_for:x?.state?.waiting_for,counts:S?.data?.counts,pl:S?.data?.pl&&{count:S.data.pl.o.length,bad:S.data.pl.bad},
        dots:S?.data?.dots?.length,c:S?.data?.dots?.filter(d=>d.k==='c').length,
        waiting:document.querySelectorAll('[data-offtakers-control="toggle"]').length};
    });
    throw new Error(String(error)+'; DC state '+JSON.stringify(diagnosis));
  }
  const n=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.ukOfftakers.state.data.dots.filter(d=>d.k==='c').length);
  assert.equal(n,225,'227 source records, of which two planning sites have unknown coordinates and must not be mapped');
  await page.evaluate(()=>{const S=window.__GRIDATLAS_MODULES__.ukOfftakers.state,m=window.__GRIDATLAS_V9_MAP__;
    const d=S.data.dots.find(x=>x.k==='c'&&/Digital Realty LHR26/.test(x.n))||S.data.dots.find(x=>x.k==='c'&&/Slough/.test(x.n));
    if(!d)throw Error('No Slough data centre');window.__DC_SMOKE_SITE__=d;m.jumpTo({center:d.a,zoom:15});});
  await page.waitForTimeout(1500);
  const point=await page.evaluate(()=>{const m=window.__GRIDATLAS_V9_MAP__,d=window.__DC_SMOKE_SITE__,c=m.getContainer().getBoundingClientRect(),p=m.project(d.a);return [c.left+p.x,c.top+p.y]});
  await page.mouse.click(...point);
  await page.waitForSelector('[data-offtakers-card][aria-label="Data centre"]',{timeout:30000});
  const tabs=await page.locator('[data-offtakers-card] [role="tab"]').count();
  assert.equal(tabs,4);
  // Independent numerical oracle, not the engine's distance helper.
  await page.waitForFunction(()=>{const c=window.__GRIDATLAS_MODULES__?.ukOfftakers?.state?.pp;return c?.k?.length===30&&c?.P?.length===30&&c?.cv?.length===30},{timeout:45000});
  const oracle=await page.evaluate(()=>{
    const c=window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp;
    const [lon,lat]=c.r.a;
    const hav=(o)=>{
      const [x,y]=o,r=Math.PI/180,dlat=(y-lat)*r,dlon=(x-lon)*r,
        a=Math.sin(dlat/2)**2+Math.cos(lat*r)*Math.cos(y*r)*Math.sin(dlon/2)**2;
      return 2*6378.137*Math.asin(Math.sqrt(a));
    };
    function check(set, coords, cutoff){
      const km=set.map(v=>hav(coords(v)));
      const ok=km.every((x,i)=>Math.abs(x-set[i].km)<0.02 && (!i||x>=km[i-1]-0.0001) && (!cutoff||x<=cutoff+0.0001));
      if(!ok)throw Error('independent haversine ranking failure '+JSON.stringify(km.slice(0,5)));
      return {count:km.length,nearest_km:km[0],farthest_km:km.at(-1),monotonic:ok};
    }
    return {substations:check(c.k,x=>x.at,40),repd:check(c.P,x=>x.parts?.[0]?.at||x.at,40),
      conventional:check(c.cv,x=>x.q.a,null),
      lines_within_100:c.cv.filter(x=>x.km<=100).length};
  });
  assert.equal(oracle.substations.count,30);
  assert.equal(oracle.repd.count,30);
  assert.equal(oracle.conventional.count,30);
  const info={viewport:[width,height],oracle,site:(await page.locator('[data-offtakers-card]').innerText()).slice(0,400),tabs,
    initial:await page.evaluate(()=>{const S=window.__GRIDATLAS_MODULES__.ukOfftakers.state;return {links:S.perf?.links,search_ms:S.perf?.search_ms,errors:S.errors.slice(-8)}})};
  for(const value of ['s','r','v','a']){
    const t=page.locator(`[data-offtakers-card] [data-offtakers-tab="${value}"]`);
    await t.click();
    await page.waitForTimeout(700);
    assert.equal(await t.getAttribute('aria-selected'),'true','tab '+value);
    info['tab_'+value]=(await page.locator('[data-offtakers-card]').innerText()).slice(0,260);
  }
  const s=page.locator('[data-offtakers-card] [data-offtakers-tab="s"]');await s.click();
  await page.waitForTimeout(400);
  const reveal=page.locator('[data-offtakers-card] [data-offtakers-reveal]');
  if(await reveal.count())await reveal.first().click();
  const csv=page.locator('[data-offtakers-card] [data-offtakers-csv]');
  assert.ok(await csv.count(),'CSV control');
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:45000}),csv.click()]);
  const csvPath=await download.path();const rows=fs.readFileSync(csvPath,'utf8');
  assert.ok(rows.includes('set,rank,name,ref,type_or_voltage,status'),'CSV columns');
  assert.ok(rows.includes('grid connection'),'IT/connection distinction');
  assert.ok(rows.length<=256000+500,'CSV is capped');
  info.csv_bytes=rows.length;
  await page.screenshot({path:path.join(OUT,`dc-${width}x${height}.png`),fullPage:false});
  // Tap two further locations, including a consented project, on both screen sizes.
  info.additional_taps=[];
  for(const wanted of ['Global Technical Realty London GB One','Court Lane Industrial Estate','SDC M40 Campus (Wapseys Wood)','Data Centre Campus, Ampthill Road, Bedford','Cobalt Park Data Centres']){
    await page.locator('[data-offtakers-card] button[aria-label="Close"]').click();
    const other=await page.evaluate(label=>{
      const m=window.__GRIDATLAS_V9_MAP__,S=window.__GRIDATLAS_MODULES__.ukOfftakers.state;
      const d=S.data.dots.find(x=>x.k==='c'&&x.n?.includes(label));
      if(!d)throw Error('missing second screening origin: '+label);
      m.jumpTo({center:d.a,zoom:15});
      return {name:d.n,point:d.a};
    },wanted);
    await page.waitForTimeout(600);
    const pos=await page.evaluate(ll=>{const m=window.__GRIDATLAS_V9_MAP__,p=m.project(ll),r=m.getContainer().getBoundingClientRect();return [r.left+p.x,r.top+p.y]},other.point);
    await page.mouse.click(...pos);
    await page.waitForSelector('[data-offtakers-card][aria-label="Data centre"]',{timeout:15000});
    const body=await page.locator('[data-offtakers-card]').innerText();
    assert.ok(body.includes(wanted),'the intended data centre was tapped: '+wanted);
    assert.equal(await page.locator('[data-offtakers-card] [role="tab"]').count(),4);
    if(wanted.startsWith('Global Technical Realty')) {
      assert.match(body,/Global Technical Realty/,'GTR remains distinct from Digital Realty');
      assert.doesNotMatch(body,/Digital Realty LHR26/,'no Slough operator over-merge');
    }
    if(wanted.startsWith('SDC M40')) assert.match(body,/300 MW/,'planned M40 site has the separately stated IT load');
    if(wanted.startsWith('Data Centre Campus, Ampthill')) {
      assert.match(body,/720 MW/,'Ampthill IT load retained');
      assert.match(body,/200 MW/,'Ampthill grid connection separate from IT load');
    }
    if(wanted.startsWith('Court Lane')) assert.match(body,/140 MW/,'Court Lane grid connection retained without inventing IT load');
    info.additional_taps.push({name:other.name,tab_count:4,has_unknown_statement:body.includes('not stated'),details:body.slice(0,300)});
  }
  observations.push(info);
  await ctx.close();
}
try{
  for(const vp of [[375,667],[390,844],[768,1024],[1280,800]])await run(...vp);
  assert.deepEqual(errors,[],'uncaught UI errors');
  console.log('BROWSER DC SMOKE PASS '+JSON.stringify({observations,errors}));
}catch(e){
  console.error('BROWSER DC SMOKE FAIL '+String(e));
  console.error(JSON.stringify({observations,errors},null,2));
  process.exitCode=1;
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
