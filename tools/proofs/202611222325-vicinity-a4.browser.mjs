import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium,webkit} from 'playwright';
import {createPreviewServer} from '../journey/serve.mjs';
const name=process.env.VICINITY_BROWSER||'chromium';
const engine=name==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}: {})});
const server=await createPreviewServer();
const out=path.resolve('work/vicinity-v9196-'+name);fs.mkdirSync(out,{recursive:true});
const viewport={width:393,height:852};
let receipt={engine:name,softwareEmulation:true,physicalSafari:false,generation:'202611222325'};
const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,acceptDownloads:true,reducedMotion:'reduce'});
const pipeline=await context.newPage(),errors=[];
pipeline.on('pageerror',e=>errors.push('pipeline '+String(e)));
try{
 await pipeline.goto('https://globalgrid2050.com/uk_renewables_pipeline/202611222222/',{waitUntil:'domcontentloaded',timeout:90000});
 await pipeline.waitForFunction(()=>document.querySelector('#tbody .pn-journey-link[href]')&&document.querySelector('#tbody .pn-report-launch'),null,{timeout:90000});
 const row=pipeline.locator('#tbody tr[id^="repd-"]').filter({has:pipeline.locator('.pn-journey-link[href]')}).first();
 const ref=(await row.getAttribute('id')).slice(5);
 const native=await row.locator('td:last-child a.pn-journey-link[href]').getAttribute('href');
 assert.equal(new URL(native).searchParams.get('repd_ref'),ref);
 assert.equal(new URL(native).origin+new URL(native).pathname,'https://ventusltd.github.io/gridatlas/atlas/');
 await row.locator('.pn-report-launch').click();
 await pipeline.locator('#pnRepdReport:not([hidden])').waitFor({timeout:15000});
 const a4=await pipeline.locator('#pnReportMap').getAttribute('href');
 assert.equal(a4,native,'A4 HTML MAP must be identical to REPD MAP');
 const downloadTask=pipeline.waitForEvent('download',{timeout:20000});
 await pipeline.locator('[data-report-action="pdf"]').click();
 const downloaded=await downloadTask;
 const pdf=(await fs.promises.readFile(await downloaded.path())).toString('latin1');
 const lit=native.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
 assert.ok(pdf.includes('/URI ('+lit+')'),'Downloaded A4 PDF must include exact same native MAP URL');
 assert.equal((pdf.match(/\/URI \(/g)||[]).length,1);
 await pipeline.screenshot({path:path.join(out,'pipeline-a4.png')});
 // The PDF's actual URI and the native REPD map must BOTH run the real
 // Grid Engine. No dummy receiver or mocked arrival is permitted.
 for(const entry of ['REPD-MAP','A4-PDF']){
  const map=await context.newPage();
  map.on('pageerror',e=>errors.push(entry+' '+String(e)));
  const u=new URL(entry==='REPD-MAP'?native:a4);
  const target='http://127.0.0.1:'+server.address().port+'/atlas/v/202611222325/'+u.search;
  try{
   await map.goto(target,{waitUntil:'domcontentloaded',timeout:90000});
   await map.waitForFunction(()=>window.__GRIDATLAS_ATLAS__?.generation==='202611222325'&&window.__GRIDATLAS_VICINITY_LINK_QA__&&window.__GRIDATLAS_MODULES__?.ukOfftakers?.openProjectVicinity,null,{timeout:120000});
   await map.waitForFunction(()=>window.__GRIDATLAS_NEON_LINKS__?.arrival_engine?.answered===true||window.__GRIDATLAS_NEON_LINKS__?.links_drawn>0,null,{timeout:150000});
   const result=await map.evaluate(()=>({generation:window.__GRIDATLAS_ATLAS__.generation,answer:window.__GRIDATLAS_NEON_LINKS__?.arrival_engine,
     drawn:window.__GRIDATLAS_NEON_LINKS__?.links_drawn,qa:window.__GRIDATLAS_VICINITY_LINK_QA__,scope:typeof window.__GRIDATLAS_MODULES__?.gridScope?.scope==='function'}));
   assert.equal(result.scope,true,'Actual Grid Engine module must survive');
   const vicinity=map.locator('#gridatlas-pipeline-vicinity-button');await vicinity.waitFor({timeout:15000});
   await vicinity.click();
   const card=map.locator('[data-offtakers-card]');await card.waitFor({timeout:30000});
   const layers=map.locator('#gridatlas-dash-toggle');await layers.waitFor({timeout:15000});
   const targetHit=await layers.evaluate(el=>{const b=el.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2;
      const hit=document.elementFromPoint(x,y);return{visible:b.width>=44&&b.height>=44,uncovered:hit===el||el.contains(hit),y,top:b.top,parent:el.parentElement?.tagName}});
   assert.ok(targetHit.visible&&targetHit.uncovered,'Layers toggle must be touch-clickable WHILE VICINITY CARD IS OPEN: '+JSON.stringify(targetHit));
   assert.ok(targetHit.y<Math.min(viewport.height,420),'Layers control must not hide behind bottom Vicinity card');
   const before=await map.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed);
   await layers.click({timeout:12000});
   assert.notEqual(await map.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed),before,'Layers control must hide/show its real panel');
   await layers.click({timeout:12000});
   assert.equal(await map.evaluate(()=>window.__GRIDATLAS_DASH__.collapsed),before,'Layers control must reopen');
   assert.equal((await card.locator('[data-vicinity-focus-card]').count()),1);
   await map.waitForFunction(()=>window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp?.swipe?.entries?.length>=2,null,{timeout:100000});
   const entries=await map.evaluate(()=>window.__GRIDATLAS_MODULES__.ukOfftakers.state.pp.swipe.entries.length);
   assert.ok(entries>0&&entries<=90,'Preserve source-backed 30/30/30');
   await map.screenshot({path:path.join(out,entry+'.png')});
   receipt[entry]={ref,links:native,drawn:result.drawn,answer:result.answer,targetHit,entries,pass:true};
  }finally{await map.close()}
 }
 assert.equal(errors.length,0,'No unhandled browser errors: '+errors.join('; '));
 receipt.result='PASS';console.log('PASS V9.196 '+name+' '+JSON.stringify({ref,native,entries:receipt['REPD-MAP'].entries,grid:'answered from both origins',layers:'visible and toggled while card open'}));
}catch(e){receipt.result='FAIL';receipt.error=String(e);throw e}
finally{fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2));await pipeline.close();await context.close();await browser.close();await new Promise(resolve=>server.close(resolve))}
