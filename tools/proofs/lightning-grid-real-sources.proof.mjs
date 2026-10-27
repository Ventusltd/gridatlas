#!/usr/bin/env node
/**
 * READ-ONLY external-source contract smoke for draft Lightning Grid Lab.
 * Network required; never modifies the Lightning archive, Atlas, or public data.
 * This is NOT an iPhone/browser proof or a numerical electrical study.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const PIN='69b4e88c8464f0310bd67e47ec83ee8afa9e1921';
const BASE='https://raw.githubusercontent.com/';
const prefix=BASE+'Ventusltd/ventus-grid-engine/'+PIN+'/';
const paths={
  'engine/v9-geodesy.js':'14023f06d4ef2ea806437863bd35dee954c46b11',
  'engine/v9-nearest-search.js':'d2ab3b111eb09f7af3df3a9fce9ad0a9dc1dea99',
  'deeplink/contract.js':'c0c9103f9198d2e8c76221fdc5138ad1e1f1da73',
  'engine/lightning-click-context.js':'ff3c8937cdcab6c7e7ef1da939570972556377e3'
};
const DATA={
  optical:BASE+'Ventusltd/lightning/main/data/uk_lightning.geojson',
  substation:BASE+'Ventusltd/gridatlas/main/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson',
  solar: Array.from({length:8},(_,i)=>BASE+'Ventusltd/pipelinenews/main/data/atlas/202608261927-atlas-solar-partition-v9-1-'+String(i+1).padStart(3,'0')+'.geojson')
};
const read=async(url,max=6_000_000)=>{
  const res=await fetch(url,{signal:AbortSignal.timeout(25000)});
  assert.equal(res.ok,true,'HTTP '+res.status+' for '+url);
  const bytes=Buffer.from(await res.arrayBuffer());
  assert.ok(bytes.length>0&&bytes.length<=max,'unexpected size '+bytes.length+' for '+url);
  const cors=res.headers.get('access-control-allow-origin');
  assert.ok(cors==='*'||(cors||'').includes('ventusltd.github.io'),'browser cross-origin access not declared for '+url);
  return {bytes,cors};
};
const parse=(data,label)=>{
  const j=JSON.parse(data.bytes.toString('utf8'));
  assert.ok(Array.isArray(j.features),'Expected real GeoJSON feature array in '+label);
  return j;
};
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
const temp=await mkdtemp(join(tmpdir(),'ventus-grid-smoke-'));
try{
  await writeFile(join(temp,'package.json'),'{"type":"module"}\n');
  for(const [path,sha] of Object.entries(paths)){
    const data=await read(prefix+path,500_000);
    assert.equal(gitBlobSha(data.bytes),sha,'pinned engine Git blob integrity '+path);
    await mkdir(dirname(join(temp,path)),{recursive:true});
    await writeFile(join(temp,path),data.bytes);
  }
  // Also test that jsDelivr serves the exact pinned module with CORS;
  // this is a transport smoke, not a real Safari ES-module import.
  const cdn='https://cdn.jsdelivr.net/gh/Ventusltd/ventus-grid-engine@'+PIN+'/engine/lightning-click-context.js';
  const cdnData=await read(cdn,500_000);
  assert.equal(gitBlobSha(cdnData.bytes),paths['engine/lightning-click-context.js'],
    'CDN must match exact immutable Git blob');

  const {createLightningContextEngine,postEventDiligence,lightningElectricalScenario}=
    await import(pathToFileURL(join(temp,'engine/lightning-click-context.js')).href);
  const {parseDeepLink}=await import(pathToFileURL(join(temp,'deeplink/contract.js')).href);

  const feed=parse(await read(DATA.optical,5_000_000),'EUMETSAT feed');
  const stations=parse(await read(DATA.substation,6_000_000),'GridAtlas substations');
  const solar=[];
  for(let i=0;i<DATA.solar.length;i++){
    const part=parse(await read(DATA.solar[i],3_000_000),'Pipeline News partition '+(i+1));
    solar.push(...part.features);
  }
  assert.equal(feed.metadata?.source,'EUMETSAT MTG Lightning Imager L2-LFL','real optical provenance');
  const flashes=feed.features.filter(f=>f?.id&&f.properties?.observation_kind==='optical_lightning_flash'
    &&f.geometry?.type==='Point'&&Number.isFinite(Date.parse(f.properties.time_utc)));
  assert.ok(flashes.length>0,'NO current authentic flashes; proximity contract blocked, not zero strikes');
  assert.ok(stations.features.length>0,'No real Atlas substation records');
  assert.ok(solar.length>0,'No real REPD solar records');
  const engine=createLightningContextEngine({substations:stations.features,solarProjects:solar});
  assert.ok(engine.dataset_summary.located_substations>0,
    'All OSM substations rejected: inspect Polygon/MultiPolygon or properties');
  assert.ok(engine.dataset_summary.locatable_repd_solar_projects>0,
    'All real Pipeline News solar records rejected');
  const ctx=engine.selectFlash(flashes[0],{
    radiusKm:500,substationLimit:6,solarLimit:30,minimumKv:0
  });
  assert.ok(ctx.substations.length>0,'No substation with declared kV returned');
  assert.ok(ctx.nearby_solar.length>0,'No real REPD solar record within 500km of first genuine flash');
  const first=ctx.nearby_solar[0],link=parseDeepLink(first.gridatlas_project_url);
  assert.equal(link.repd_ref,first.repd_ref,'MAP receiver must use genuine REPD identity');
  assert.equal(link.layer_exists,true,'MAP receiver must support solar bucket');
  const study=lightningElectricalScenario(ctx,{selectedRepdRef:first.repd_ref,acEarthing:'IT',dcReference:'floating'});
  const diligence=postEventDiligence(ctx,{selectedRepdRef:first.repd_ref});
  assert.equal(study.solver_status,'NOT_RUN','No numerical solver');
  assert.equal(diligence.causation_established,false,'No causality inferred');
  assert.equal(diligence.site.repd_ref,first.repd_ref,'Diligence site must be genuine REPD');

  console.log('PASS — genuine source contract and CDN integrity; source pin '+PIN);
  console.log(JSON.stringify({
    observed_optical_flashes:flashes.length,substation_source_records:stations.features.length,
    geolocated_substations:engine.dataset_summary.located_substations,
    solar_source_records:solar.length,eligible_repd_solar:engine.dataset_summary.locatable_repd_solar_projects,
    first_observation_utc:ctx.event.time_utc,nearest_km:ctx.substations[0].km,
    broad_500km_validation_solar_count:ctx.nearby_solar.length,
    real_project_repd_ref:first.repd_ref,scenario_solver_status:study.solver_status,
    note:'500km is a test-only validation radius, not a proximity alert or asset-risk finding'
  },null,2));
}finally{
  await rm(temp,{recursive:true,force:true});
}
