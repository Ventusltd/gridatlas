import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createPreviewServer} from '../journey/serve.mjs';
const engineName=process.env.VICINITY_BROWSER||'chromium';
const engine=engineName==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(engineName==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}: {})});
const server=await createPreviewServer(),base='http://127.0.0.1:'+server.address().port+'/atlas/v/';
const out=path.resolve('work/vicinity-v9197-'+engineName);fs.mkdirSync(out,{recursive:true});
const query='?repd_ref=12588&latitude=51.8132088&longitude=-1.3489728&project=Botley%20West&technology=solar&journey=vicinity';
const evidence={browser:engineName,physicalSafari:false,headlessEmulation:true,baseline:{},candidate:{}};
const contexts=[];
async function launch(generation,viewport){
 const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 contexts.push(context);const page=await context.newPage();
 await page.goto(base+generation+'/'+query,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__GRIDATLAS_ATLAS__&&window.__GRIDATLAS_V9_MAP__&&window.__GRIDATLAS_DASH__?.installed&&window.__GRIDATLAS_MODULES__?.ukOfftakers?.openProjectVicinity&&document.getElementById('gridatlas-dash-toggle')&&document.getElementById('fs-curtain-tab')&&document.querySelectorAll('#fs-curtain-keys input[data-layer-id]').length>=40,null,{timeout:120000});
 return page;
}
async function fullscreen(page){
 // The genuine legacy entry applies fs-active even if iOS rejects requestFullscreen.
 await page.evaluate(()=>window.enterFullscreen());
 await page.waitForFunction(()=>document.body.classList.contains('fs-active'));
 await page.waitForTimeout(400);
}
async function state(page){
 return page.evaluate(()=>{const panel=document.getElementById('fs-curtain');
 const r=panel.getBoundingClientRect(),css=getComputedStyle(panel);
 return{open:panel.classList.contains('curtain-open'),display:css.display,transform:css.transform,
  rect:{top:r.top,bottom:r.bottom,height:r.height},controls:panel.querySelectorAll('input[data-layer-id]').length,
  collapsed:window.__GRIDATLAS_DASH__?.collapsed,fullscreen:document.body.classList.contains('fs-active'),
  buttonText:document.getElementById('gridatlas-dash-toggle')?.textContent};});
}
function panelVisible(s){return s.open&&s.display!=='none'&&s.rect.height>100&&s.rect.bottom>45&&s.rect.top<400;}
try{
 if(engineName==='chromium'){
  const v195=await launch('202611222130',{width:393,height:852});
  await fullscreen(v195);
  await v195.evaluate(()=>document.getElementById('fs-curtain-tab').click());
  await v195.waitForTimeout(450);
  const worked=await state(v195);
  // Historical baseline is observed, not assumed to work in native fullscreen.
  evidence.baseline.v195={...worked,actuallyVisible:panelVisible(worked)};
  console.log('BASELINE V9.195 original curtain:',JSON.stringify(evidence.baseline.v195));
  await v195.close();

  const v196=await launch('202611222325',{width:393,height:852});
  await fullscreen(v196);
  const button=v196.locator('#gridatlas-dash-toggle');
  await button.waitFor();
  const before=await state(v196);
  await button.click({timeout:15000});
  await v196.waitForTimeout(450);
  const broken=await state(v196);
  assert.equal(broken.open,false,'V9.196 reproduce: floating button must NOT open original fullscreen curtain');
  assert.notEqual(broken.collapsed,before.collapsed,'V9.196 bug: toggled unrelated hidden SCADA state instead');
  evidence.baseline.v196={before,after:broken,confirmed:'button changed SCADA state but curtain remained hidden'};
  await v196.screenshot({path:path.join(out,'baseline-v9196-broken.png')});
  await v196.close();
 }
 for(const viewport of [{width:393,height:852},{width:852,height:393}]){
  const name=viewport.width===393?'portrait':'landscape';
  const page=await launch('202611222343',viewport);
  await page.locator('#gridatlas-pipeline-vicinity-button').click({timeout:20000});
  const card=page.locator('[data-offtakers-card]');
  await card.waitFor({timeout:30000});
  await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp?.swipe?.entries?.length>1,null,{timeout:90000});
  await fullscreen(page);
  const toggle=page.locator('#gridatlas-dash-toggle');
  await toggle.waitFor();
  const initial=await state(page);
  assert.equal(initial.open,false,'start with original curtain closed');
  const hit=await toggle.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
   const target=document.elementFromPoint(x,y);
   return{rect:{width:r.width,height:r.height,top:r.top},uncovered:target===el||el.contains(target)};});
  assert.ok(hit.uncovered&&hit.rect.width>=44&&hit.rect.height>=44,'real touch hit target with card open '+JSON.stringify(hit));
  await toggle.click({timeout:20000});
  await page.waitForTimeout(500);
  const opened=await state(page);
  assert.ok(panelVisible(opened),'tap must SHOW visible original fullscreen curtain, not just change a Boolean: '+JSON.stringify(opened));
  assert.equal(opened.collapsed,initial.collapsed,'must not toggle hidden SCADA panel in fullscreen');
  assert.ok(opened.controls>=40,'actual original layer inputs must be present');
  // The original delegated GridAtlas engine should synchronise the two layer controls.
  const input=page.locator('#fs-curtain-keys input[data-layer-id]:not([disabled])').first();
  const id=await input.getAttribute('data-layer-id');
  const prior=await input.isChecked();
  await input.click({timeout:16000});
  assert.notEqual(await input.isChecked(),prior,'fullscreen curtain input must really toggle');
  const mirror=page.locator('#scada-ui-container input[data-layer-id="'+id+'"]').first();
  assert.equal(await mirror.isChecked(),!prior,'curtain must drive the original GridAtlas layer control');
  await input.click({timeout:16000});
  assert.equal(await mirror.isChecked(),prior,'original layer can be restored without stale proxy');
  await page.screenshot({path:path.join(out,name+'-real-layers-open.png')});
  await toggle.click({timeout:20000});
  await page.waitForTimeout(480);
  const closed=await state(page);
  assert.equal(closed.open,false,'same button must close original layer curtain');
  assert.ok(closed.rect.bottom<48||closed.transform!=='none','panel is no longer over the map');
  assert.equal(await card.isVisible(),true,'Vicinity swipe card remains usable');
  const entries=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp.swipe.entries.length);
  assert.ok(entries>1&&entries<=90,'90-point source-backed browser preserved');
  evidence.candidate[name]={hit,initial,opened,closed,entries,layerId:id,synchronised:true};
  await page.close();
 }

 // Owner 23 November: compare the original Grid menu, not just #fs-curtain,
 // at the effective CSS viewport produced by ~190% browser zoom.
 // The previous acceptance only counted inputs inside the fullscreen curtain.
 async function gridMenuAudit(generation,viewport,label){
  const page=await launch(generation,viewport);
  await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__?.menuBar?.installed===true,null,{timeout:30000});
  const title=page.locator('#gridatlas-menu-bar .gm-title').filter({hasText:/^Grid$/}).first();
  await title.click({timeout:15000});
  const result=await page.evaluate(()=>{
   const menu=document.getElementById('gridatlas-menu-bar');
   const panel=menu?.querySelector('.gm-panel-grid');
   const body=panel?.querySelector('.gm-panel-body');
   const menuState=window.__GRIDATLAS_MODULES__?.menuBar?.inspect?.();
   const original=document.querySelectorAll('#scada-ui-container input[data-layer-id],#scada-ui-container input[data-pn-layer]').length;
   const groups=body?Array.from(body.querySelectorAll('.gm-layer-group'),el=>el.textContent.trim()):[];
   const keys=body?.querySelectorAll('input[data-gridatlas-layer-proxy]').length||0;
   const rect=body?.getBoundingClientRect();
   return{generation:window.__GRIDATLAS_ATLAS__?.generation,menuState,original,keys,groups,
    body:body?{clientWidth:body.clientWidth,scrollWidth:body.scrollWidth,clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,
     overflowX:getComputedStyle(body).overflowX,columnCount:getComputedStyle(body).columnCount,
     rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom}}:null};
  });
  assert.equal(result.original,63,'original layer inventory must remain 63');
  assert.equal(result.keys,63,'Grid dropdown must retain all 63 engine/pipeline proxies');
  for(const term of ['REPD','TRANSIT','EV','BASEMAP']){
   assert.ok(result.groups.some(x=>x.toUpperCase().includes(term)),term+' layer group must remain');
  }
  if(result.body){
   const b=page.locator('#gridatlas-menu-bar .gm-panel-body');
   await b.evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth});
   const last=page.locator('#gridatlas-menu-bar .gm-panel-body .gm-layer').last();
   await last.scrollIntoViewIfNeeded({timeout:15000});
   result.lastReachable=await last.isVisible();
   result.afterScroll=await b.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop}));
  }
  await page.screenshot({path:path.join(out,label+'-grid-menu-highzoom.png')});
  await page.close();
  return result;
 }
 evidence.gridMenuBaseline=await gridMenuAudit('202611222130',{width:640,height:650},'v9195-640x650');
 evidence.gridMenuCandidate=await gridMenuAudit('202611222343',{width:640,height:650},'v9197-640x650');
 console.log('V9.195 versus V9.197 Grid menu at 190%-equivalent viewport:',JSON.stringify({old:evidence.gridMenuBaseline,current:evidence.gridMenuCandidate}));
 const recent=evidence.gridMenuCandidate;
 assert.ok(recent.lastReachable,'final Basemap switch must be reachable');
 assert.ok(recent.body.scrollWidth-recent.body.clientWidth<=4,
   'high-zoom Grid menu must not hide later groups in sideways overflow: '+JSON.stringify(recent.body));

 evidence.result='PASS';
 console.log('PASS V9.197 '+engineName+': V9.195 working curtain, V9.196 bug reproduced, candidate visible original curtain, real controls and full screen touch: '+JSON.stringify(evidence));
}catch(e){evidence.result='FAIL';evidence.error=String(e);throw e}
finally{fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(evidence,null,2));for(const ctx of contexts)await ctx.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve))}
