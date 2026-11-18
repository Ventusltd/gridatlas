/** Native new-UI acceptance helper. No route graph/provider interception or scripted selection. */
import assert from 'node:assert/strict';
// Read painted feature geometry, not the newer serialized source point or its hit halo.
export function sampleRenderedTrainCursor(){
 const m=window.__GRIDATLAS_V9_MAP__,ride=window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().train.ride,r=m.getContainer().getBoundingClientRect(),center=m.getCenter(),id='gridatlas-train-cursor';
 const rendered=(m.getLayer(id)?m.queryRenderedFeatures(undefined,{layers:[id]}):[]).filter(f=>f.geometry?.type==='Point').map(f=>{const at=f.geometry.coordinates.slice(0,2),p=m.project(at),screen=[r.left+p.x,r.top+p.y],hit=document.elementFromPoint(...screen);return{at,screen,uncovered:screen[0]>0&&screen[1]>0&&screen[0]<innerWidth&&screen[1]<innerHeight&&hit?.tagName==='CANVAS',hit:hit?.tagName||null};});
 return{timestamp:performance.now(),visibility:document.visibilityState,ride,rendered,serialized:m.getSource(id)?.serialize().data.features[0]?.geometry.coordinates||null,camera:[center.lng,center.lat,m.getZoom(),m.getBearing(),m.getPitch()],viewport:{width:innerWidth,height:innerHeight,canvas:[r.left,r.top,r.width,r.height]},sourceLoaded:m.isSourceLoaded?.(id)??null,styleLoaded:m.isStyleLoaded?.()??null};
}
export async function waitForPaintedCursorProgress({page,diagnostics,timeoutMs=15000,intervalMs=100,minimumPixels=2,now=Date.now}){
 const start=now(),samples=[];let baseline=null;
 diagnostics.paintObservation={minimumPixels,timeoutMs,samples};
 while(now()-start<timeoutMs){
  const sample=await page.evaluate(sampleRenderedTrainCursor);if(samples.length<200)samples.push(sample);
  const point=sample.rendered.find(p=>p.uncovered),valid=point&&sample.visibility==='visible'&&sample.ride.playing===true&&sample.ride.cameraFollow===false;
  if(valid){
   const value={...point,timestamp:sample.timestamp,fraction:sample.ride.fraction,camera:sample.camera,viewport:sample.viewport};
   if(!baseline){baseline=value;diagnostics.paintObservation.baseline=value;}
   else{
    const fixed=sample.camera.every((n,i)=>Math.abs(n-baseline.camera[i])<1e-7)&&sample.viewport.canvas.every((n,i)=>Math.abs(n-baseline.viewport.canvas[i])<0.5);
    assert.ok(fixed,'Follow is OFF: rendered cursor comparison requires the same fitted camera and viewport');
    const pixels=Math.hypot(value.screen[0]-baseline.screen[0],value.screen[1]-baseline.screen[1]);
    if(pixels>=minimumPixels&&value.fraction>baseline.fraction&&value.at.some((n,i)=>n!==baseline.at[i])){diagnostics.paintObservation.accepted={...value,pixels};return{firstRendered:baseline,secondRendered:value,pixels};}
   }
  }
  await page.waitForTimeout(intervalMs);
 }
 assert.fail('No two actual painted, uncovered cursor positions advanced at least '+minimumPixels+' CSS pixels with active Play and advancing fraction; diagnostic samples preserved.');
}

export async function runTrainUiAcceptance({page,panel,snapshot,visibleTap,output,pageErrors=[],diagnostics={}}) {
 const train=panel.locator('.train-panel'),query=train.locator('#gridatlas-train-query'),role=train.getByRole('combobox',{name:'Use search choice as',exact:true}),results=train.locator('.train-search-results');
 const readings={scope:'LOCAL_NATIVE_UI_REAL_STATION_SOURCE',caps:[],places:[],motion:{}};
 const state=async()=>(await snapshot()).train;
 const clear=async()=>{await visibleTap(train.getByRole('button',{name:'Clear selected stops',exact:true}));assert.equal((await state()).itinerary.selectedCount,0);};
 const find=async(id)=>{await query.fill(id);await visibleTap(train.getByRole('button',{name:'Find stations',exact:true}));assert.ok(await results.getByRole('button').count());};
 const choose=async(id,position)=>{await role.selectOption(position);await find(id);await visibleTap(results.getByRole('button').first());};
 const source=await page.evaluate(()=>{const ns=window.__GRIDATLAS_MODULES__,g=ns.geodesy,features=window.__GRIDATLAS_V9_MAP__.getSource('src-subs').serialize().data.features;return features.filter(f=>f.id&&f.properties?.name&&Array.from(g.voltagesKv(f.properties)).includes(33)).map(f=>({id:String(f.id),name:f.properties.name,at:g.representativePoint(f.geometry),kv:Array.from(g.voltagesKv(f.properties))})).sort((a,b)=>g.distanceKm(-0.404504,51.496403,...a.at)-g.distanceKm(-0.404504,51.496403,...b.at)).filter((row,i,rows)=>i===0||row.at.some((v,j)=>v!==rows[0].at[j])).slice(0,2);});
 assert.equal(source.length,2);readings.canonicalStations=source;assert.equal((await state()).index.sourceRecords,5800);assert.equal((await state()).index.indexedRecords,5800);assert.equal((await state()).index.datasetPin.sha256,'87976435766a58ddf19c99540b58cd7f18a224148af42ba55075d8851f9e6251');
 await clear();await query.fill('Kearsley');await visibleTap(train.getByRole('button',{name:'Find stations',exact:true}));assert.match(await results.innerText(),/grid_substations:5799/);await query.fill('qa-no-such-station-uniquely-missing');await visibleTap(train.getByRole('button',{name:'Find stations',exact:true}));assert.equal(await results.getByRole('button').count(),0);await visibleTap(train.getByRole('button',{name:/^Journey .*10 stops$/}));
 await choose(source[0].id,'start');await choose(source[1].id,'finish');
 let current=await state();assert.deepEqual(current.itinerary.stops.map(s=>s.stationId),source.map(s=>s.id));assert.deepEqual(current.itinerary.stops.map(s=>s.at),source.map(s=>s.at));
 await visibleTap(train.locator('.train-stops > li').first().getByRole('button',{name:/^Move down /}));assert.deepEqual((await state()).itinerary.stops.map(s=>s.stationId),source.map(s=>s.id).reverse());await visibleTap(train.locator('.train-stops > li').last().getByRole('button',{name:/^Move up /}));assert.deepEqual((await state()).itinerary.stops.map(s=>s.stationId),source.map(s=>s.id));
 for(const select of await train.locator('.train-stops select').all())await select.selectOption('33');
 await visibleTap(train.getByRole('button',{name:'Draw itinerary',exact:true}));current=await state();assert.equal(current.plan.simulated,false);assert.ok(current.plan.legs.some(l=>l.evidence==='MISSING'),'missing documented joins remain missing before opt-in');assert.equal(current.plan.playable,false);
 const fallback=train.getByRole('checkbox',{name:/Allow my SIMULATED straight-line legs/});await visibleTap(fallback.locator('..'));assert.equal(await fallback.isChecked(),true);
 await visibleTap(train.getByRole('button',{name:'Draw itinerary',exact:true}));await visibleTap(train.getByRole('button',{name:'Draw itinerary',exact:true}));current=await state();assert.equal(current.plan.playable,true);assert.equal(current.plan.simulated,true);assert.ok(current.plan.legs.every(leg=>leg.electricalFlow==='UNKNOWN'));
 await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-train-cursor')?.serialize().data.features.length===1,null,{timeout:15000});
 const cursor=()=>page.evaluate(()=>window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-train-cursor')?.serialize().data.features[0]?.geometry.coordinates);
 await visibleTap(train.getByRole('button',{name:'Fit itinerary on map',exact:true}));
 const mapControls=page.getByRole('region',{name:'Journey map controls',exact:true});await visibleTap(mapControls.getByRole('button',{name:'Edit journey',exact:true}));
 const before=await cursor();const speed=train.getByRole('slider',{name:'Seconds per leg',exact:true});await speed.focus();await page.keyboard.press('End');const actualSpeed=Number(await speed.inputValue());assert.equal(actualSpeed,20,'native range End selects 20 seconds per leg');diagnostics.actualSpeedSeconds=actualSpeed;
 await visibleTap(train.getByRole('button',{name:'Play',exact:true}));const compact=page.getByRole('region',{name:'Journey map controls',exact:true});assert.equal(await compact.isVisible(),true);
 const {firstRendered,secondRendered}=await waitForPaintedCursorProgress({page,diagnostics});
 const moving=await cursor();await page.screenshot({path:output+'/train-native-playing.png'});await visibleTap(compact.getByRole('button',{name:'Pause journey',exact:true}));assert.equal((await state()).ride.playing,false);const paused=await cursor();await page.waitForTimeout(150);assert.deepEqual(await cursor(),paused);
 await visibleTap(compact.getByRole('button',{name:'Next journey stop',exact:true}));assert.equal((await state()).ride.stopIndex,1);await visibleTap(compact.getByRole('button',{name:'Edit journey',exact:true}));readings.motion={actualSpeed,paintObservation:diagnostics.paintObservation,firstRendered,secondRendered,before,moving,paused,afterStep:await cursor(),ride:(await state()).ride};
 await page.screenshot({path:output+'/train-native-drawn.png'});
 // Close an active ride through the focused compact Escape control, spanning deferred work.
 const visitsBeforeClose=(await state()).itinerary.stops.map(stop=>stop.stopId);await visibleTap(train.getByRole('button',{name:'Play',exact:true}));assert.equal((await state()).ride.playing,true);await page.keyboard.press('Escape');assert.equal((await snapshot()).opened,false);
 const ownedCounts=()=>page.evaluate(()=>Object.fromEntries(['routes','stops','cursor'].map(suffix=>[suffix,window.__GRIDATLAS_V9_MAP__.getSource('gridatlas-train-'+suffix)?.serialize().data.features.length||0])));
 assert.deepEqual(await ownedCounts(),{routes:0,stops:0,cursor:0});assert.equal((await state()).plan,null);assert.equal((await state()).ride.playing,false);await page.waitForTimeout(1200);assert.deepEqual(await ownedCounts(),{routes:0,stops:0,cursor:0});assert.deepEqual(pageErrors,[]);
 await visibleTap(page.locator('#gridatlas-menu-bar-title-4'));await visibleTap(page.locator('#gridatlas-menu-bar-panel-4').getByRole('button',{name:'Great Grid Journeys',exact:true}));assert.deepEqual((await state()).itinerary.stops.map(stop=>stop.stopId),visitsBeforeClose);assert.equal((await state()).plan,null);assert.deepEqual(await ownedCounts(),{routes:0,stops:0,cursor:0});readings.close={observationMs:1200,ownedCounts:await ownedCounts(),selectedVisitsPreserved:true,reopenAutoDraw:false};
 // Place lookup uses the existing live provider; failure is retained, never replaced by a fixture.
 await clear();await role.selectOption('start');const typed='SW1A 1AA';await query.fill(typed);await visibleTap(train.getByRole('button',{name:'Find place / postcode',exact:true}));
 await page.waitForFunction(()=>{const e=document.querySelector('.train-status');return e&&!e.textContent.includes('Looking up');},null,{timeout:90000});
 const places=results.getByRole('button',{name:'Choose stations near this place',exact:true});assert.ok(await places.count(),'existing provider must resolve the typed postcode for positive binding coverage');const selectedProviderCaption=await results.locator('li').first().innerText();await visibleTap(places.first());await visibleTap(results.getByRole('button').first());current=await state();const bound=current.itinerary.stops[0];assert.equal(bound.place.label,typed);assert.ok(bound.place.provider);assert.ok(selectedProviderCaption.includes(bound.place.precision||'precision unknown'));assert.ok(selectedProviderCaption.includes(bound.place.provider));assert.ok(bound.place.distanceKm>=0);assert.ok(bound.stationId.startsWith('grid_substations:'));assert.match(await train.locator('.train-place-binding').innerText(),/SW1A 1AA/);readings.places.push(bound);
 // Both caps are selected visit limits; repeat visits are intentional and remain separate.
 await clear();await visibleTap(train.getByRole('button',{name:/^Journey .*10 stops$/}));await role.selectOption('waypoint');await find(source[0].id);
 for(let n=0;n<10;n++)await visibleTap(results.getByRole('button').first());const atTen=(await state()).itinerary;await visibleTap(results.getByRole('button').first());assert.deepEqual((await state()).itinerary,atTen);readings.caps.push({mode:'journey',count:atTen.selectedCount,refused:11});
 await visibleTap(train.getByRole('button',{name:/^Vicinity .*90 stops$/}));for(let n=10;n<90;n++)await visibleTap(results.getByRole('button').first());const atNinety=(await state()).itinerary;await visibleTap(results.getByRole('button').first());assert.deepEqual((await state()).itinerary,atNinety);assert.equal(atNinety.selectedCount,90);readings.caps.push({mode:'vicinity',count:90,refused:91});
 await visibleTap(train.getByRole('button',{name:/^Journey .*10 stops$/}));assert.deepEqual((await state()).itinerary,atNinety,'mode downgrade never truncates');
 await clear();
 // Pin a real user-chosen map point; only the separate session proposed store changes.
 await role.selectOption('start');await visibleTap(train.locator('.train-proposed > summary'));await train.getByRole('textbox',{name:'Proposed customer substation label',exact:true}).fill('QA customer screening');await train.getByRole('combobox',{name:'Proposed customer substation voltage',exact:true}).selectOption('11');
 if(!(await fallback.isChecked()))await visibleTap(fallback.locator('..'));
 await visibleTap(train.getByRole('button',{name:'Pin proposed FEED concept',exact:true}));assert.equal((await state()).proposedPicking,true);assert.equal(await panel.isVisible(),false,'pin mode exposes map touch surface');
 const canvas=page.locator('canvas.maplibregl-canvas');const bounds=await canvas.boundingBox();await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().train.proposals.count===1);
 await page.waitForFunction(()=>{const m=window.__GRIDATLAS_V9_MAP__,id='gridatlas-train-proposed-point';return m.getLayer(id)&&m.queryRenderedFeatures(undefined,{layers:[id]}).some(f=>f.properties.evidence==='SESSION_ONLY_USER_PROPOSED'&&f.properties.role==='customer_substation');});
 const feed=await page.evaluate(()=>{const m=window.__GRIDATLAS_V9_MAP__,e=document.querySelector('.train-proposed-map-label'),r=e?.getBoundingClientRect(),style=e?getComputedStyle(e):null;return{colour:m.getPaintProperty('gridatlas-train-proposed-point','circle-color'),marker:e?{text:e.textContent,colour:style.color,borderStyle:style.borderTopStyle,visible:style.display!=='none'&&style.visibility==='visible'&&Number(style.opacity)>0&&r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}:null,source:m.getSource('gridatlas-train-proposed-stations').serialize().data.features.map(f=>f.properties)};});
 assert.equal(String(feed.colour).toLowerCase(),'#e0b050');assert.ok(feed.marker?.visible,'the proposed FEED label is visibly on the map');assert.match(feed.marker.text,/Proposed.*FEED/);assert.equal(feed.marker.borderStyle,'dashed');assert.equal(feed.marker.colour,'rgb(224, 176, 80)');assert.equal(feed.source.length,1);assert.ok(feed.source.every(p=>p.evidence==='SESSION_ONLY_USER_PROPOSED'&&p.role==='customer_substation'));readings.feedPaint=feed;
await page.screenshot({path:output+'/train-proposed-session-map.png'});
 await visibleTap(compact.getByRole('button',{name:'Edit journey',exact:true}));current=await state();assert.equal(current.proposals.count,1);const proposal=current.proposals.stations[0];assert.match(proposal.id,/^scenario:/);assert.deepEqual(proposal.kv,[11]);assert.equal(proposal.source,'SESSION_ONLY_USER_PROPOSED');assert.equal(current.itinerary.stops[0].stationId,proposal.id);assert.equal(current.index.sourceRecords,5800);
 const proposalEpochBeforeEdit=current.itinerary.planEpoch;
 const proposedList=train.getByRole('list',{name:'Session proposed substations',exact:true});await proposedList.getByRole('combobox').selectOption('33');await visibleTap(proposedList.getByRole('button',{name:'Apply proposed label / voltage',exact:true}));current=await state();assert.deepEqual(current.proposals.stations[0].kv,[33]);assert.ok(current.itinerary.planEpoch>proposalEpochBeforeEdit,'the proposed voltage edit itself invalidates the plan');
 await visibleTap(fallback.locator('..'));assert.equal(await fallback.isChecked(),true,'documented-only refuses active proposed stops');
 await visibleTap(proposedList.getByRole('button',{name:'Remove proposed pin',exact:true}));current=await state();assert.equal(current.proposals.count,0);assert.equal(current.itinerary.valid,false);assert.equal(current.itinerary.selectedCount,1);await visibleTap(train.getByRole('button',{name:'Draw itinerary',exact:true}));assert.equal((await state()).plan,null,'a deleted proposed station cannot be drawn or assigned a current route');assert.equal((await state()).itinerary.valid,false);await visibleTap(train.locator('.train-stops').getByRole('button',{name:/^Remove /}).first());assert.equal((await state()).itinerary.valid,true);readings.proposed={id:proposal.id,sourceRecords:current.index.sourceRecords,removedInvalidVisitRetained:true,deletedVisitDrawingBlocked:true};
 await clear();await visibleTap(train.getByRole('button',{name:/^Vicinity .*90 stops$/}));

 // Reduced motion uses the real public controller lifecycle and the same unchanged source inventory.
 const contextBefore=await snapshot();await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(options=>{const module=window.__GRIDATLAS_MODULES__.gridVicinity;module.destroy();module.mount().open(options);},{origin:contextBefore.origin,radiusKm:contextBefore.radiusKm,mode:'journey'});
 await page.waitForFunction(()=>window.__GRIDATLAS_MODULES__.gridVicinity.snapshot().train?.index?.indexedRecords===5800);
 await choose(source[0].id,'start');await choose(source[1].id,'finish');for(const select of await train.locator('.train-stops select').all())await select.selectOption('33');
 const reducedFallback=train.getByRole('checkbox',{name:/Allow my SIMULATED straight-line legs/});await visibleTap(reducedFallback.locator('..'));await visibleTap(train.getByRole('button',{name:'Draw itinerary',exact:true}));await visibleTap(train.getByRole('button',{name:'Play',exact:true}));
 current=await state();assert.equal(current.ride.reducedMotion,true);assert.equal(current.ride.playing,false);const staticAt=await cursor();await page.waitForTimeout(250);assert.deepEqual(await cursor(),staticAt);readings.reducedMotion={ride:current.ride,staticAt};
 await visibleTap(compact.getByRole('button',{name:'Edit journey',exact:true}));await clear();await visibleTap(train.getByRole('button',{name:/^Vicinity .*90 stops$/}));
 const sourceBands=panel.getByRole('group',{name:'Source voltage tags',exact:true});for(const box of await sourceBands.getByRole('checkbox').all()){const wanted=contextBefore.selectedBands.includes(await box.getAttribute('value'));if(await box.isChecked()!==wanted)await visibleTap(box.locator('..'));}
 const contextAfter=await snapshot();assert.deepEqual(contextAfter.origin,contextBefore.origin);assert.equal(contextAfter.radiusKm,contextBefore.radiusKm);assert.equal(contextAfter.loadedRecords,5800);readings.contextPreserved={origin:contextAfter.origin,radiusKm:contextAfter.radiusKm,loadedRecords:contextAfter.loadedRecords};await page.emulateMedia({reducedMotion:'no-preference'});
 return readings;
}
