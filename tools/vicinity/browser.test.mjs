/** Independent native Android QA. Injection mode never counts as publication acceptance. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT, assemble} from './build.mjs';
const atlasRoot=process.env.VICINITY_ATLAS_ROOT||ROOT;
const generation=process.env.VICINITY_BROWSER_GENERATION||'202611172355';
const injecting=process.env.VICINITY_BROWSER_INJECT==='1';
const browserName=process.env.VICINITY_BROWSER_ENGINE||'chromium';
const output=process.env.VICINITY_BROWSER_OUTPUT||path.join(os.tmpdir(),'vicinity-independent-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(output,{recursive:true});
fs.rmSync(path.join(output,'receipt.json'),{force:true});
const pwModule=process.env.PLAYWRIGHT_MODULE;
const pw=await import(pwModule&&path.isAbsolute(pwModule)?pathToFileURL(pwModule).href:pwModule||'playwright');
const {createPreviewServer}=await import(pathToFileURL(path.join(atlasRoot,'tools/journey/serve.mjs')).href);
const server=await createPreviewServer(),base='http://127.0.0.1:'+server.address().port;
const compiled=assemble({generation});
console.log(JSON.stringify({startedUTC:new Date().toISOString(),output,generation,browser:browserName,candidateSha:compiled.sha256,injecting}));
const dc={at:[-0.404504,51.496403],type:'datacentre',id:'dcuk-04bb759f3d52d660',name:'Source-listed London data centre'};
const repd={at:[2.1708996,52.1374391],type:'repd',id:'repd:2470',name:'East Anglia 3 (EA 3)'};
const errors=[],failed=[],layouts=[],origins=[],radiusChecks=[],renderChecks=[];
const startedUTC=new Date().toISOString();let browser,page,baselineLayers=[],baselineSource=null;
function intent(origin,radius=10){const q=new URLSearchParams({journey:'vicinity',origin_type:origin.type,origin_id:origin.id,latitude:String(origin.at[1]),longitude:String(origin.at[0]),radius_km:String(radius),name:origin.name});return q.toString();}
async function snapshot(){return page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot());}
async function visibleTap(locator){await locator.scrollIntoViewIfNeeded();assert.equal(await locator.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit);}),true,'control centre is hit-testable');await locator.tap();}
async function open(origin,radius=10){await page.evaluate(o=>window.__GRIDATLAS_MODULES__.gridVicinity.open(o),{origin,radiusKm:radius});}
async function ownData(){return page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-vicinity-context')?.serialize().data);}
async function assertOwnPoints(radius){const data=await ownData();assert.ok(data);const points=data.features.filter(f=>f.properties.kind==='substation');assert.ok(points.every(f=>Number.isFinite(f.properties.km)&&f.properties.km>=0&&f.properties.km<=radius));return points;}
async function sourceFingerprint(){return page.evaluate(()=>{const m=window.__GRIDATLAS_V9_MAP__,s=m.getSource('src-subs');return s?JSON.stringify(s.serialize().data):null;});}
try{
 browser=await pw[browserName].launch({headless:true,...(browserName==='chromium'?{args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}: {})});
 const context=await browser.newContext({...pw.devices[browserName==='webkit'?'iPhone 13':'Pixel 7'],viewport:{width:393,height:852}});
 page=await context.newPage();page.on('pageerror',e=>errors.push({message:e.message,stack:e.stack}));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
 await page.goto(base+'/atlas/v/'+generation+'/?'+intent(dc),{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__&&window.__GRIDATLAS_MODULES__?.geodesy,null,{timeout:90000});
 await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getStyle()?.layers?.length>0,null,{timeout:90000});
 baselineLayers=await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getStyle().layers.filter(l=>!l.id.startsWith('gridatlas-vicinity-')).map(l=>l.id));
 if(injecting)await page.addScriptTag({content:compiled.body});
 await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__?.gridVicinity?.snapshot().opened,null,{timeout:90000});
 await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().matching>1,null,{timeout:90000});
 await page.waitForFunction(()=>{const m=window.__GRIDATLAS_MODULES__?.menuBar;return m?.installed||m?.failure;},null,{timeout:90000});
 const menu=await page.evaluate(()=>window.__GRIDATLAS_MODULES__.menuBar);
 assert.equal(menu.installed,true,JSON.stringify(menu));assert.equal(menu.layer_controls,63);
 const panel=page.getByRole('region',{name:'Vicinity familiarisation'}),close=page.getByRole('button',{name:'Close vicinity explorer',exact:true});
 const initial=await snapshot();assert.equal(initial.origin.id,dc.id);assert.deepEqual(initial.origin.at,dc.at);assert.equal(initial.radiusKm,10);assert.equal(initial.realConnectionsInferred,0);
 assert.equal(await page.locator('#gridatlas-vicinity').count(),1);assert.match(await panel.innerText(),/Spatial vicinity, connectivity unknown/);
 await visibleTap(page.getByRole('button',{name:'Show physical grid',exact:true}));
 const physicalControls=await page.evaluate(()=>['400','275','220','132','66','subs'].map(id=>{const e=document.querySelector('#scada-ui-container input[data-layer-id=\"'+id+'\"]');return{id,present:!!e,checked:e?.checked};}));
 assert.ok(physicalControls.filter(c=>c.present).length>0);assert.ok(physicalControls.every(c=>!c.present||c.checked));
 await page.screenshot({path:path.join(output,'physical-grid-origin.png')});
 baselineSource=await sourceFingerprint();
 const slider=page.getByRole('slider',{name:'Vicinity radius in kilometres'});
 radiusChecks.push({radius:10,matching:initial.matching,shown:(await assertOwnPoints(10)).length});
 await slider.focus();await page.keyboard.press('Home');assert.equal((await snapshot()).radiusKm,1);radiusChecks.push({radius:1,matching:(await snapshot()).matching,shown:(await assertOwnPoints(1)).length});
 await page.keyboard.press('End');assert.equal((await snapshot()).radiusKm,50);radiusChecks.push({radius:50,matching:(await snapshot()).matching,shown:(await assertOwnPoints(50)).length});
 // Native Android taps operate voltage labels; no script-driven state changes.
 for(const name of ['400 kV','275 kV','132 kV','66 kV','11 kV','Other stated voltage','Voltage not stated']){const box=page.getByRole('checkbox',{name,exact:true});if(await box.isChecked())await visibleTap(box);}
 assert.deepEqual((await snapshot()).selectedBands,['33']);
 const filtered=await assertOwnPoints(50);assert.ok(filtered.length>1);assert.ok(filtered.every(f=>f.properties.voltage.split(' / ').some(v=>/^33(?: kV)?$/.test(v))));
 const added=panel.getByRole('button',{name:/^Add .+ to my model$/});await visibleTap(added.nth(0));await visibleTap(added.nth(1));
 const scenario=await snapshot(),scenarioData=await ownData(),line=scenarioData.features.find(f=>f.properties.kind==='user-model');assert.equal(scenario.modelStations.length,2);assert.equal(line.properties.evidence,'USER_ASSUMED_LOCAL_MODEL');assert.deepEqual(line.geometry.coordinates,scenario.modelStations.map(s=>s.at));assert.equal(scenarioData.features.filter(f=>f.geometry.type==='LineString').length,2);
 await visibleTap(page.getByRole('button',{name:'Undo last station',exact:true}));assert.equal((await snapshot()).modelStations.length,1);
 await visibleTap(page.getByRole('button',{name:'Clear model',exact:true}));assert.equal((await snapshot()).modelStations.length,0);assert.equal((await ownData()).features.some(f=>f.properties.kind==='user-model'),false);
 assert.equal(await sourceFingerprint(),baselineSource,'native source geometry is never rewritten by a local model');
 await visibleTap(panel.getByRole('checkbox',{name:'33 kV',exact:true}));assert.deepEqual((await snapshot()).selectedBands,[]);assert.equal((await snapshot()).matching,0);assert.equal((await assertOwnPoints(50)).length,0);
 await visibleTap(panel.getByRole('checkbox',{name:'Voltage not stated',exact:true}));assert.deepEqual((await snapshot()).selectedBands,['unknown']);assert.ok((await assertOwnPoints(50)).every(f=>f.properties.voltage==='Not stated'));
 // Restore every filter before checking origin types.
 for(const box of await panel.getByRole('checkbox').all())if(!(await box.isChecked()))await visibleTap(box);
 for(const origin of [repd,dc]){await open(origin,50);const s=await snapshot();assert.equal(s.origin.id,origin.id);assert.deepEqual(s.origin.at,origin.at);assert.equal(s.realConnectionsInferred,0);if(origin.type==='repd')assert.ok(s.matching>0,'full loaded source includes the known coastal stations within EA3 50 km');origins.push({type:origin.type,id:s.origin.id,at:s.origin.at,matching:s.matching});await assertOwnPoints(50);}
 await open(dc,50);
 const station=(await ownData()).features.find(f=>f.properties.kind==='substation');assert.ok(station);
 await open({at:station.geometry.coordinates,id:'grid_substations:0',name:station.properties.name,type:'substation'},10);assert.equal((await snapshot()).origin.id,'grid_substations:0');origins.push({type:'substation',id:'grid_substations:0',at:station.geometry.coordinates,matching:(await snapshot()).matching});
 // Native result control supplies the actual station's coordinates, without a nearest-identity guess.
 const recenter=panel.getByRole('button',{name:/^Use .+ as origin$/}).first();await visibleTap(recenter);assert.equal((await snapshot()).origin.type,'substation');
 await visibleTap(close);assert.equal(await page.evaluate(()=>!!window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-vicinity-context')),false);
 const grid=page.locator('#gridatlas-menu-bar-title-4');await grid.tap();const nativeLaunch=page.locator('#gridatlas-menu-bar-panel-4 [data-vicinity-group] button');await visibleTap(nativeLaunch);assert.equal((await snapshot()).opened,true);await visibleTap(close);assert.equal(await grid.evaluate(e=>e===document.activeElement&&e.getClientRects().length>0),true);
 await open(dc,10);
 // Keep both orientations inside the same native map lifecycle. Exit browser Fullscreen API
 // before Chromium's window resize because Windows rejects Browser.setWindowBounds while fullscreen.
 const exitedFullscreen=await page.evaluate(async()=>{if(document.fullscreenElement){await document.exitFullscreen();return true;}return false;});
 for(const [width,height]of[[393,852],[852,393]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.resize());
  const layout=await panel.evaluate(e=>{const p=e.getBoundingClientRect();return{x:p.x,y:p.y,width:p.width,height:p.height,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(layout.x>=0&&layout.y>=0&&layout.x+layout.width<=width+1&&layout.y+layout.height<=height+1,JSON.stringify(layout));assert.equal(layout.overflow,false);await visibleTap(close);await page.locator('.vic-launch').tap();assert.equal((await snapshot()).opened,true);
  await page.screenshot({path:path.join(output,'vicinity-'+width+'x'+height+'.png')});layouts.push({width,height,layout});
 }
 // Malformed input is explicit, then a native map-centre action recovers without invented identity.
 await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.open({origin:{at:[0,0],id:'bad',type:'repd'},radiusKm:10}));assert.equal((await snapshot()).origin,null);assert.equal((await snapshot()).matching,null);assert.equal(await ownData(),undefined);assert.match(await page.locator('.vic-error').innerText(),/valid located origin/);
 await visibleTap(page.getByRole('button',{name:'Use map centre',exact:true}));assert.equal((await snapshot()).origin.type,'map-centre');assert.equal((await snapshot()).origin.id,null);
 // The same controller handles explicit events; opaque IDs are retained, never interpreted as topology.
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('gridatlas:vicinity-open',{detail:{origin:{at:[-0.1,51.5],type:'datacentre',id:'DC-WD-Q',name:'Opaque producer contract fixture'},radiusKm:10}})));assert.equal((await snapshot()).origin.id,'DC-WD-Q');
 // Existing source and layer collisions remain byte/object-identical through close and destroy.
 await visibleTap(close);
 await page.evaluate(()=>{const m=window.__GRIDATLAS_V9_MAP__;m.addSource('vicinity-independent-foreign',{type:'geojson',data:{type:'FeatureCollection',features:[]}});m.addLayer({id:'gridatlas-vicinity-radius',type:'line',source:'vicinity-independent-foreign'});window.__vicinityForeign=m.getLayer('gridatlas-vicinity-radius');});
 await open(dc,10);assert.equal((await snapshot()).sourceUnavailable,true);assert.equal(await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getLayer('gridatlas-vicinity-radius')===window.__vicinityForeign),true);await visibleTap(close);assert.equal(await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getLayer('gridatlas-vicinity-radius')===window.__vicinityForeign),true);
 await page.evaluate(()=>{const m=window.__GRIDATLAS_V9_MAP__;m.removeLayer('gridatlas-vicinity-radius');m.removeSource('vicinity-independent-foreign');});
 await open(dc,10);await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.destroy());assert.equal(await page.locator('#gridatlas-vicinity').count(),0);assert.equal(await page.locator('[data-vicinity-group]').count(),0);
 const finalLayers=await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getStyle().layers.map(l=>l.id));assert.ok(baselineLayers.every(id=>finalLayers.includes(id)),'all inherited native layers remain');assert.equal(await sourceFingerprint(),baselineSource);
 await page.evaluate(()=>window.__GRIDATLAS_MODULES__.gridVicinity.mount().open({origin:{at:[-0.1,51.5],type:'map-centre',id:null},radiusKm:1}));assert.equal((await snapshot()).opened,true);await page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.remove());assert.equal((await snapshot()).alive,false);assert.equal(await page.locator('#gridatlas-vicinity').count(),0);
 assert.deepEqual(errors,[]);
 const actualModule=injecting?compiled.body:fs.readFileSync(path.join(atlasRoot,'atlas/modules/'+generation+'-grid-vicinity.js'),'utf8').replace(/\r\n/g,'\n');
 const receipt={result:'PASS',startedUTC,finishedUTC:new Date().toISOString(),mode:injecting?'CANDIDATE_MODULE_INJECTION_NOT_PUBLIC_ACCEPTANCE':'LOCAL_FULL_COMPOSITION',browser:browserName,device:browserName==='webkit'?'iPhone 13 software regression':'Pixel 7 Android touch emulation',generation,moduleBytes:Buffer.byteLength(actualModule),moduleSha256:createHash('sha256').update(actualModule).digest('hex'),initial,physicalControls,radiusChecks,origins,scenario,layouts,exitedFullscreen,baselineLayers:baselineLayers.length,finalLayers:finalLayers.length,errors,failed,physicalPhone:'UNKNOWN',webKitBinaryAvailable:fs.existsSync(pw.webkit.executablePath())};
 fs.writeFileSync(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output,generation,matching:initial.matching,loaded:initial.loadedRecords}));
}catch(e){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:e.message,stack:e.stack,errors,failed,snapshot:page?await snapshot().catch(()=>null):null},null,2));throw e;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
