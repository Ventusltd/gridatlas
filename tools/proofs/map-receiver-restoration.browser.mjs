import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const ROOT=process.cwd(), GEN='202611161645';
const widths=process.env.WIDTHS?.split(',').map(Number)||[390,393,1440];
const refs=process.env.REFS?.split(',')||['12588','14535','2470'];
const channel=process.env.BROWSER_CHANNEL||null;
const receipts=[];const browser=await chromium.launch({headless:true,...(channel?{channel}:{})});
const browserIdentity={channel:channel||'playwright-chromium',version:browser.version()};
await fs.mkdir('work',{recursive:true});
try{
 for(const width of widths)for(const ref of refs){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<700,isMobile:width<700});
  await context.route('https://ventusltd.github.io/gridatlas/**',async route=>{
   const pathname=new URL(route.request().url()).pathname.replace(/^\/gridatlas\//,'');
   if(process.env.NESO_TIMEOUT==='1' && pathname.endsWith('neso-connection-sites.lean.json')){await new Promise(resolve=>setTimeout(resolve,6500));await route.abort().catch(()=>{});return;}
   const rel=pathname==='atlas/current.json'?`atlas/manifests/${GEN}-composition.json`:pathname.endsWith('/')?pathname+'index.html':pathname;
   try{const body=await fs.readFile(path.join(ROOT,rel));const ext=path.extname(rel);await route.fulfill({body,contentType:({'.html':'text/html','.json':'application/json','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[ext]||'application/octet-stream',headers:{'access-control-allow-origin':'*'}});}catch{await route.continue();}
  });
  const page=await context.newPage();const errors=[];
  await page.goto('https://globalgrid2050.com/uk_renewables_pipeline/202611161244/',{waitUntil:'domcontentloaded'});
  await page.locator('#search').fill(ref);const map=page.locator(`#repd-${ref} a.atlaslink`);await map.waitFor({timeout:60000});
  const [receiver]=await Promise.all([context.waitForEvent('page'),map.click()]);receiver.on('pageerror',e=>errors.push(e.message));
  await receiver.waitForLoadState('domcontentloaded');
  await receiver.waitForFunction(()=>window.__GRIDATLAS_NEON_LINKS__?.arrival_engine?.terminal && window.__GRIDATLAS_NEON_LINKS__?.links_drawn>0,null,{timeout:120000});
  const card=receiver.locator('.maplibregl-popup').first();
  if((await card.getAttribute('class')).includes('gridatlas-min'))await receiver.locator('.gridatlas-card-bar .min').first().click();
  await receiver.waitForTimeout(12000);
  await receiver.locator('.neon-km').first().scrollIntoViewIfNeeded();
  assert.ok(await receiver.locator('.neon-km').first().isVisible());
  const r=await receiver.evaluate(()=>{const l=window.__GRIDATLAS_NEON_LINKS__,p=document.querySelector('.maplibregl-popup'),block=p?.querySelector('.gridatlas-neon-block')||p;return {generation:document.documentElement.dataset.gridatlasGeneration,url:location.href,compute:l.compute_receipt,neso:l.neso_lookup,identity:l.identity_verification,arrival:l.arrival_engine,selection:l.last_selection,links:l.links_drawn,failures:l.failures,technology:l.technology_layer,cardClass:p?.className,cardText:p?.innerText,rect:block?.getBoundingClientRect().toJSON()};});
  r.width=width;r.ref=ref;r.errors=errors;r.browser=browserIdentity;
  assert.equal(r.generation,GEN);assert.equal(new URL(r.url).searchParams.get('repd_ref'),ref);
  assert.equal(r.identity.repd_ref,ref);assert.equal(r.arrival.answered,true);assert.ok(Number.isFinite(r.selection.nearest_km));assert.ok(r.selection.nearest_name);
  assert.ok(!r.cardClass.includes('gridatlas-min'),'reader restore must persist');assert.match(r.cardText,/km/);assert.ok(r.rect.height>100);assert.deepEqual(errors,[]);
  assert.equal(r.compute.status,'completed');assert.equal(r.compute.entity.id,ref);assert.equal(r.compute.entity.kind,'repd');assert.ok(r.compute.measurements.length>0);assert.match(r.cardText,/Ventus Grid Engine/);
  if(process.env.NESO_TIMEOUT==='1'){assert.equal(r.neso.status,'failed');assert.equal(r.neso.reason,'TIMEOUT');assert.match(r.cardText,/Declared connection lookup unavailable/);}
  assert.equal(r.technology.enabled,true);assert.deepEqual(r.failures,[]);
  await receiver.screenshot({path:`work/map-${channel||'chromium'}-${width}-${ref}${process.env.NESO_TIMEOUT==='1'?'-timeout':''}.png`});
  receipts.push(r);console.log('PASS',width,ref,r.identity.status,r.selection.nearest_name,r.selection.nearest_km);
  await context.close();
 }
}finally{await fs.mkdir('work',{recursive:true});await fs.writeFile(process.env.NESO_TIMEOUT==='1'?'work/map-receiver-timeout.json':`work/map-receiver-${channel||'chromium'}-candidate.json`,JSON.stringify(receipts,null,2));await browser.close();}
