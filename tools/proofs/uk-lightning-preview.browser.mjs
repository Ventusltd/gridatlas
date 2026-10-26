/**
 * Compare the restored live Atlas with isolated UK lightning V2.
 * Browser test fixtures reproduce real EUMETSAT observations but are NEVER
 * included in production data: intercepted requests exist only inside CI.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';

const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'work','uk-lightning-preview');
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.geojson':'application/geo+json','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{
 try {
  let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!p.startsWith(root+path.sep))throw new Error('outside repository');
  if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');
  res.setHeader('content-type',mime[path.extname(p)]||'application/octet-stream');
  res.setHeader('cache-control','no-store');
  res.end(fs.readFileSync(p));
 } catch {res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const result={baseline:'202609241334',preview:'202610261500',profiles:[]};
const sourceUrl='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson';
const fixture={type:'FeatureCollection',features:[
 {type:'Feature',id:'test-real-observation-1',geometry:{type:'Point',coordinates:[-3.9177,49.515301]},properties:{name:'Lightning flash 2026-10-21 12:32 UTC',time_utc:'2026-10-21T12:32:19.282Z',raw_tech:'EUMETSAT optical flash (not a confirmed ground strike)',status:'Satellite detection',source:'EUMETSAT',source_product:'MTG LI L2-LFL'}},
 {type:'Feature',id:'test-real-observation-2',geometry:{type:'Point',coordinates:[-2.052,50.079601]},properties:{name:'Lightning flash 2026-10-22 22:10 UTC',time_utc:'2026-10-22T22:10:13.082Z',raw_tech:'EUMETSAT optical flash (not a confirmed ground strike)',status:'Satellite detection',source:'EUMETSAT',source_product:'MTG LI L2-LFL'}}
]};
const menus=['File','Edit','View','Scope','Grid','About'];

async function openProfile(width,mode) {
 const mobile=width<700;
 const context=await browser.newContext({viewport:{width,height:mobile?852:1000},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'}:{})});
 let requests=0;
 const jsErrors=[];
 const page=await context.newPage();
 const networkFailures=[];
 const consoleErrors=[];
 page.on('pageerror',e=>jsErrors.push(String(e)));
 page.on('requestfailed',r=>networkFailures.push(r.url()+' '+(r.failure()?.errorText||'')));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,260));});
 await page.route(sourceUrl,async route=>{
  requests++;
  await route.fulfill({status:200,contentType:'application/geo+json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(fixture)});
 });
 const url=origin+(mode==='baseline'?'/atlas/':'/atlas/preview/lightning/');
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 try {
  await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__&&document.querySelectorAll('[data-gridatlas-layer-proxy]').length>=60,null,{timeout:35000});
 } catch(error) {
  const state=await page.evaluate(()=>({title:document.title,url:location.href,router:document.body?.dataset?.gridatlasRouter,body:document.body?.innerText?.slice(0,1400),generation:window.__GRIDATLAS_ATLAS__?.generation,map:!!window.__GRIDATLAS_V9_MAP__,proxies:document.querySelectorAll('[data-gridatlas-layer-proxy]').length,scripts:[...document.scripts].map(s=>s.src?.slice(-160)).filter(Boolean).slice(-12)}));
  console.error('GRIDATLAS_LOAD_DIAGNOSTIC',JSON.stringify({mode,width,state,networkFailures:networkFailures.slice(-25),consoleErrors:consoleErrors.slice(-25),jsErrors:jsErrors.slice(-25)}));
  await page.screenshot({path:path.join(out,mode+'-'+width+'-load-failure.png'),fullPage:true}).catch(()=>{});
  throw error;
 }
 if(mode==='preview')await page.waitForFunction(()=>window.__GRIDATLAS_WEATHER_LIGHTNING__?.installed,null,{timeout:15000});
 const gen=await page.evaluate(()=>window.__GRIDATLAS_ATLAS__.generation);
 assert.equal(gen,mode==='baseline'?result.baseline:result.preview,mode+' generation mismatch');
 const layerIds=await page.locator('#scada-ui-container input[data-layer-id]').evaluateAll(xs=>xs.map(x=>x.dataset.layerId).sort());
 const allIds=await page.locator('[data-gridatlas-layer-proxy]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-gridatlas-layer-proxy')).sort());
 const menuInventory={};
 for(const name of menus) {
  const btn=page.getByRole('button',{name,exact:true});
  await btn.click();
  assert.equal(await btn.getAttribute('aria-expanded'),'true',mode+' cannot open menu '+name);
  menuInventory[name]=await page.locator('.gm-open .gm-panel').evaluateAll(xs=>xs.map(x=>({
   headings:[...x.querySelectorAll('h1,h2,h3,summary')].map(n=>n.textContent.trim()),
   ids:[...x.querySelectorAll('button,input,select')].map(n=>n.id).filter(Boolean).sort()
  })));
 }
 await page.screenshot({path:path.join(out,mode+'-'+width+'-menus.png')});
 return {context,page,gen,layerIds,allIds,menuInventory,requests:()=>requests,jsErrors};
}

try {
 for(const width of [1440,393]) {
  const record={width,baseline:null,preview:null,pass:false};
  result.profiles.push(record);
  const baseline=await openProfile(width,'baseline');
  record.baseline={generation:baseline.gen,layers:baseline.layerIds.length,menus:Object.keys(baseline.menuInventory)};
  assert(!baseline.layerIds.includes('uk_lightning'),'restored baseline unexpectedly has lightning');
  await baseline.context.close();

  const preview=await openProfile(width,'preview');
  record.preview={generation:preview.gen,layers:preview.layerIds.length};
  assert(!preview.layerIds.includes('uk_lightning'),'Weather must NOT mutate ukConfig');
  assert.deepEqual(preview.layerIds,baseline.layerIds,'Original 60 GridAtlas controls changed');
  assert.deepEqual(preview.allIds.filter(id=>id!=='weather:uk_lightning'),baseline.allIds,'Original layer proxies changed');
  for(const name of menus){
   const newInventory=preview.menuInventory[name].map(panel=>({...panel,ids:panel.ids.filter(id=>id!=='gridatlas-weather-lightning-toggle')}));
   assert.deepEqual(newInventory,baseline.menuInventory[name],'Original menu controls changed: '+name);
  }
  const menuContract=await preview.page.evaluate(()=>window.__GRIDATLAS_MODULES__?.menuBar?.inspect?.());
  assert(menuContract?.complete&&menuContract?.engine===60&&menuContract?.pipeline===3,'Menu 60+3 contract violated');

  const page=preview.page;
  const native=page.locator('#scada-ui-container input[data-weather-layer="uk_lightning"]');
  const fs=page.locator('#fs-curtain-keys input[data-weather-layer="uk_lightning"]');
  assert.equal(await native.count(),1,'Lightning missing from the actual LAYERS panel');
  assert.equal(await fs.count(),1,'Lightning missing from fullscreen layer controls');
  const nativeStructure=await page.evaluate(()=>({
    firstGroup:document.querySelector('#scada-ui-container')?.firstElementChild?.getAttribute('data-weather-native-group'),
    fullFirst:document.querySelector('#fs-curtain-keys')?.firstElementChild?.getAttribute('data-weather-native-group')
  }));
  assert.equal(nativeStructure.firstGroup,'layers','Weather is not the first native LAYERS group');
  assert.equal(nativeStructure.fullFirst,'fullscreen','Weather is not the first fullscreen layer group');
  record.preview.nativeStructure=nativeStructure;
  const grid=page.getByRole('button',{name:'Grid',exact:true});
  if(await grid.getAttribute('aria-expanded')!=='true')await grid.click();
  const toggle=page.locator('[data-gridatlas-layer-proxy="weather:uk_lightning"]');
  assert.equal(await toggle.count(),1,'independent lightning toggle missing from Grid menu');
  // Crucial UX regression gate: the toggle MUST be visible on initial Grid
  // opening without scrolling past the 63 original layer controls.
  const weatherPosition=await page.evaluate(()=>{
   const body=document.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body');
   const toggle=document.querySelector('[data-gridatlas-layer-proxy="weather:uk_lightning"]');
   if(!body||!toggle)return null;
   body.scrollTop=0;
   const root=body.getBoundingClientRect();
   const rect=toggle.getBoundingClientRect();
   return {firstGroup:body.firstElementChild?.getAttribute('data-weather-group'),
     visibleWithoutScroll:rect.top>=root.top-1&&rect.bottom<=root.bottom+1,
     headerText:body.firstElementChild?.textContent,scrollTop:body.scrollTop};
  });
  assert.equal(weatherPosition?.firstGroup,'uk_lightning','Weather is not the first Grid menu group');
  assert.equal(weatherPosition?.visibleWithoutScroll,true,'Lightning toggle is below the fold on first Grid open');
  record.preview.weatherPosition=weatherPosition;
  await page.screenshot({path:path.join(out,'preview-'+width+'-weather-first.png')});
  await toggle.click();
  assert.equal(await native.isChecked(),true,'Menu ON not synchronised to actual LAYERS');
  assert.equal(await fs.isChecked(),true,'Menu ON not synchronised to fullscreen');
  await page.waitForFunction(()=>/\[(OK|FAIL|EMPTY)\]/.test(document.getElementById('lbl-uk_lightning')?.textContent||''),null,{timeout:60000});
  const status=await page.locator('#lbl-uk_lightning').textContent();
  assert(status.includes('[OK]'),'UK lightning hydration failed: '+status);
  assert.equal(preview.requests(),1,'lightning URL was not fetched externally');
  const features=await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('src-uk_lightning')._data.features.length);
  assert.equal(features,2,'unexpected test observation count');
  await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.jumpTo({center:[-3.9177,49.515301],zoom:9}));
  await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.queryRenderedFeatures({layers:['l-uk_lightning']}).length>0,null,{timeout:20000});
  record.preview={...record.preview,status:status.trim(),features,rendered:await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.queryRenderedFeatures({layers:['l-uk_lightning']}).length),externalRequests:preview.requests()};
  await page.screenshot({path:path.join(out,'preview-'+width+'-lightning-on.png')});
  if(await grid.getAttribute('aria-expanded')!=='true')await grid.click();
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  assert.equal(await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-uk_lightning','visibility')),'none');
  assert.equal(await native.isChecked(),false,'Menu OFF not synchronised to actual LAYERS');
  if(await grid.getAttribute('aria-expanded')==='true')await grid.click();
  const dash=page.locator('#gridatlas-dash-toggle');
  if(!(await native.isVisible())&&await dash.count())await dash.click();
  assert.equal(await native.isVisible(),true,'Actual LAYERS Weather checkbox is not visible');
  await native.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'preview-'+width+'-native-layers-weather-visible.png')});
  await native.click();
  assert.equal(await toggle.isChecked(),true,'LAYERS ON not synchronised to Grid dropdown');
  assert.equal(await fs.isChecked(),true,'LAYERS ON not synchronised to fullscreen');
  assert.equal(await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-uk_lightning','visibility')),'visible');
  await native.click();
  assert.equal(await toggle.isChecked(),false,'LAYERS OFF not synchronised to Grid dropdown');
  assert.equal(await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getLayoutProperty('l-uk_lightning','visibility')),'none');
  record.preview.nativeLayersToggle='PASS: visible, clickable, synchronised in both directions';
  record.pass=true;
  await preview.context.close();
  console.log(JSON.stringify(record));
 }
 fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(result,null,2)+'\n');
 console.log('PASS: desktop/mobile baseline menu parity, native lightning GeoJSON and map paint');
} finally {
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
