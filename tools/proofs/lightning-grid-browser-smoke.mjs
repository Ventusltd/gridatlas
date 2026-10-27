#!/usr/bin/env node
/**
 * Single Chromium browser: actual MapLibre/WebGL rendering and 44px optical
 * point click -> real imported Grid Engine -> REPD MAP link -> scenarios.
 *
 * Fakes ONLY the upstream external data (clearly identified test fixtures).
 * Uses actual pinned jsDelivr ESM import + same map code as the standalone lab.
 * NOT an EUMETSAT historical coverage test, production release or iPhone pass.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {mkdir} from 'node:fs/promises';

const base=process.env.LAB_URL || 'http://127.0.0.1:8765/atlas/labs/lightning-grid/';
const output='artifacts/lightning-grid-browser';
await mkdir(output,{recursive:true});
const stamp=h=>new Date(Date.now()-h*3600000).toISOString();
const optical=(id,lon,lat,h)=>({
  type:'Feature',id,geometry:{type:'Point',coordinates:[lon,lat]},
  properties:{observation_kind:'optical_lightning_flash',time_utc:stamp(h)}
});
const FEED={
  type:'FeatureCollection',
  metadata:{source:'EUMETSAT MTG Lightning Imager L2-LFL',
    query_start_utc:stamp(3),query_end_utc:stamp(0.1),
    latest_detection_utc:stamp(0.5),retention_days:7},
  features:[
    optical('browser-source-centre',-3.5,54.5,1.5),
    optical('browser-source-far',-0.1,51.5,0.5)
  ]
};
const SUBS={type:'FeatureCollection',features:[
 {type:'Feature',id:'mock-sub-400',geometry:{type:'Point',coordinates:[-3.48,54.49]},
   properties:{name:'TEST SUBSTATION',voltage:'400000'}}
]};
const SOLAR={type:'FeatureCollection',features:[
 {type:'Feature',id:'GG2050-REPD-12588',geometry:{type:'Point',coordinates:[-3.49,54.51]},
   properties:{repd_ref:'12588',name:'TEST REPD SOLAR PROJECT',technology:'solar',
     capacity_mw:125,repd_technology:'Solar Photovoltaics',geometry_status:'valid'}}
]};
const EMPTY={type:'FeatureCollection',features:[]};
const errors=[];
const browser=await chromium.launch({
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']
});
let page;
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,
    isMobile:true,hasTouch:true});
  page=await context.newPage();
  page.on('pageerror',e=>errors.push('PAGE:'+e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push('CONSOLE:'+e.text())});
  await page.route('https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson',
    route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(FEED),
      headers:{'access-control-allow-origin':'*'}}));
  await page.route('**/data/grid_substations.geojson',
    route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SUBS),
      headers:{'access-control-allow-origin':'*'}}));
  await page.route('**/202608261927-atlas-solar-partition-v9-1-*.geojson',
    route=>route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(route.request().url().endsWith('001.geojson')?SOLAR:EMPTY),
      headers:{'access-control-allow-origin':'*'}}));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('#flash option').length>=2,null,{timeout:45000});
  const options=await page.locator('#flash option').count();
  assert.equal(options,2,'two synthetic source records must be visible');
  // Map may initially show an empty backdrop while network tiles load. A
  // WebGL error is not swallowed: this must become a blocked/failed review.
  await page.waitForFunction(()=>{
    const s=document.querySelector('#map-status')?.textContent||'';
    return s.includes('Map ready')||s.includes('could not start');
  },null,{timeout:45000});
  const status=await page.locator('#map-status').textContent();
  assert.match(status,/Map ready/,'Real MapLibre map needs WebGL and source rendering');
  const canvas=page.locator('#flash-map canvas.maplibregl-canvas');
  await canvas.waitFor({timeout:25000});
  // Initial map camera is -3.5/54.5. Fixture optical feature is exactly
  // centred on this camera and unclustered, so the centre tap must select it.
  const box=await canvas.boundingBox();
  assert.ok(box && box.width>150 && box.height>200,'map canvas has usable phone geometry');
  await page.waitForTimeout(2000); // map paint and GeoJSON worker index
  await canvas.click({position:{x:box.width/2,y:box.height/2},timeout:10000});
  await page.waitForFunction(
    ()=>document.querySelector('#flash')?.value==='browser-source-centre',
    null,{timeout:12000}
  );
  await page.waitForFunction(()=>{
    const text=document.querySelector('#status')?.textContent||'';
    return text.includes('Ready ·')||text.includes('Unable to compute');
  },null,{timeout:35000});
  const uiStatus=await page.locator('#status').textContent();
  assert.match(uiStatus,/Ready ·/,'Map pixel tap must actually run Grid Engine context');
  const solarLink=page.locator('#solar a').first();
  assert.equal((await solarLink.getAttribute('href'))?.includes('repd_ref=12588'),true,
    'Existing MAP receiver must receive authentic REPD reference');
  assert.equal(await page.locator('#scenario').isEnabled(),true,
    'Scenario becomes available only after genuine proximity context');
  await page.locator('#ac').selectOption('IT');
  await page.locator('#dc').selectOption('floating');
  await page.locator('#scenario').click();
  assert.match(await page.locator('#scenario-output').textContent(),/NOT RUN/,
    'Hypothetical scenario does not invent numerical fault currents');
  assert.match(await page.locator('#scenario-output').textContent(),/IT AC first and second earth fault/i,
    'IT fault study checklist must be present');
  await page.screenshot({path:output+'/iphone-sized-click-to-grid.png',fullPage:true});
  console.log('PASS — real Chromium viewport 390x844: flash dot tapped, grid context populated, original MAP link, IT/DC scenarios NOT RUN.');
  console.log('Fixture counts: optical='+FEED.features.length+' substation='+SUBS.features.length+' solar='+SOLAR.features.length);
  if(errors.length)console.log('Nonfatal browser console notes: '+JSON.stringify(errors.slice(0,10)));
}catch(error){
  if(page){try{await page.screenshot({path:output+'/on-error.png',fullPage:true})}catch(_){}}
  console.error('Browser smoke FAILED: '+String(error));
  if(errors.length)console.error('Browser messages: '+JSON.stringify(errors.slice(0,20)));
  throw error;
}finally{
  await browser.close();
}
