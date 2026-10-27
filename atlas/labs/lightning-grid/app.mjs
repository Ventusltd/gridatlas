/**
 * Standalone Lightning → existing MAP/nearest Grid Engine integration LAB.
 * Read-only browser sidecar; no mutation of Atlas, archive, original controls.
 *
 * The dependency is pinned to a REVIEWED draft Grid Engine source SHA.
 * This is experimental: verify actual CDN import/CORS in browser before
 * publication. NOT a confirmed ground strike or electrical fault prediction.
 */
import {
  createLightningContextEngine,
  lightningElectricalScenario,
  postEventDiligence,
  caveat
} from 'https://cdn.jsdelivr.net/gh/Ventusltd/ventus-grid-engine@69b4e88c8464f0310bd67e47ec83ee8afa9e1921/engine/lightning-click-context.js';

const FEED='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson';
const SUBSTATIONS='https://raw.githubusercontent.com/Ventusltd/gridatlas/main/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson';
const SOLAR_PREFIX='https://raw.githubusercontent.com/Ventusltd/pipelinenews/main/data/atlas/202608261927-atlas-solar-partition-v9-1-';
const solarURLs=Array.from({length:8},(_,i)=>SOLAR_PREFIX+String(i+1).padStart(3,'0')+'.geojson');

const el=id=>document.getElementById(id);
const pretty=n=>Number(n).toLocaleString('en-GB',{maximumFractionDigits:2});
const date=t=>new Date(t).toISOString().replace('T',' ').replace('Z',' UTC');
const state={observations:[],files:null,engine:null,ctx:null,serial:0,loadingAssets:null};
function node(tag,value,cls=''){
  const e=document.createElement(tag);
  if(value!=null)e.textContent=String(value);
  if(cls)e.className=cls;
  return e;
}
function clear(id){const e=el(id);e.replaceChildren();return e}
function line(target,what){target.appendChild(node('p',what,'small'))}
function status(msg){el('status').textContent=msg}
function fail(message){
  const e=document.createElement('span');
  e.className='strong';e.textContent=message;
  el('status').replaceChildren(e);
}
async function downloadJSON(url){
  const c=new AbortController(),timeout=setTimeout(()=>c.abort(),20000);
  try {
    const r=await fetch(url,{cache:'no-store',signal:c.signal});
    if(!r.ok)throw Error('HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(timeout)}
}
function features(data){
  if(data?.type==='FeatureCollection' && Array.isArray(data.features))return data.features;
  if(Array.isArray(data?.features))return data.features;
  throw Error('Not a GeoJSON feature collection');
}
function observationList(geo){
  return features(geo).filter(f=>
    f?.id && f.properties?.observation_kind==='optical_lightning_flash'
    && f.geometry?.type==='Point'
    && Array.isArray(f.geometry.coordinates)
    && f.geometry.coordinates.length>=2
    && Number.isFinite(Date.parse(f.properties.time_utc))
    && f.geometry.coordinates.slice(0,2).every(Number.isFinite)
  ).sort((a,b)=>Date.parse(b.properties.time_utc)-Date.parse(a.properties.time_utc));
}
async function getAssets(){
  if(state.loadingAssets)return state.loadingAssets;
  state.loadingAssets=(async()=>{
    // No 35.7 MB register download; reuse eight established, bounded,
    // genuine Pipeline News solar partitions and original Atlas substations.
    const settled=await Promise.allSettled([downloadJSON(SUBSTATIONS),...solarURLs.map(downloadJSON)]);
    let subs=[],solar=[],issues=[];
    if(settled[0].status==='fulfilled'){
      try{subs=features(settled[0].value)}catch(e){issues.push('Substation source shape: '+e.message)}
    } else issues.push('Substation source unavailable: '+settled[0].reason.message);
    for(let i=1;i<settled.length;i++){
      const x=settled[i];
      if(x.status==='fulfilled'){try{solar.push(...features(x.value))}catch(e){issues.push('Solar partition '+i+': '+e.message)}}
      else issues.push('Solar partition '+i+' unavailable: '+x.reason.message);
    }
    state.files={substations:subs,solar,issues};
    state.engine=createLightningContextEngine({substations:subs,solarProjects:solar});
    return state.files;
  })();
  try{
    const result=await state.loadingAssets;
    // A partial source load is not a permanently cached zero. Let the
    // next explicit Inspect attempt retry unavailable source partitions.
    if(result.issues.length)state.loadingAssets=null;
    return result;
  }catch(e){state.loadingAssets=null;throw e}
}
function currentFlash(){
  const id=el('flash').value;
  return state.observations.find(f=>String(f.id)===id)||null;
}
function setObservation(f){
  state.ctx=null;
  el('scenario').disabled=true;
  el('project').replaceChildren(node('option','No project selected'));
  el('scenario-output').textContent='Select a genuine optical observation and run the proximity search first.';
  const t=clear('observation');
  if(!f){line(t,'No observation selected.');return}
  const p=node('div',null,'record');
  line(p,'Optical detection · '+date(f.properties.time_utc));
  line(p,'Latitude '+f.geometry.coordinates[1]+', longitude '+f.geometry.coordinates[0]+' (source coordinate; not a ground-strike fix)');
  line(p,'Source ID: '+String(f.id));
  t.appendChild(p);
  const u=new URL(location.href);
  u.searchParams.set('flash_id',String(f.id));
  const a=node('a','Link to this optical observation');
  a.href=u.href;a.rel='noopener';t.appendChild(a);
}
function display(ctx,assets){
  const summary=el('provenance');
  const d=ctx.search,n=state.engine.dataset_summary;
  summary.textContent=
    'Scanned '+pretty(d.scanned_geolocated_substations)+' located substation records of '+pretty(n.total_substations)+
    '; '+pretty(d.scanned_repd_solar_projects)+' located, identified solar projects of '+pretty(n.total_solar_records)+
    ' source rows. Distances are straight-line, not electrical paths.'+
    (assets.issues.length?' PARTIAL SOURCE FAILURE: '+assets.issues.join('; '):'');
  const subs=clear('substations');
  if(!ctx.substations.length)line(subs,'No eligible located substation found in the loaded records. Not evidence that none exists.');
  for(const p of ctx.substations){
    const card=node('div',null,'record');
    card.appendChild(node('strong',p.name||'Unnamed substation'));
    line(card,pretty(p.km)+' km · declared '+p.voltages_kv.map(x=>x+' kV').join(', '));
    if(p.source_site_id)line(card,'Source identifier: '+p.source_site_id);
    subs.appendChild(card);
  }
  const solar=clear('solar'),chooser=el('project');
  chooser.replaceChildren(node('option','No project selected'));
  chooser.firstChild.value='';
  if(!ctx.nearby_solar.length)line(solar,'No eligible identified REPD solar project in this radius among the loaded records. This is not a site exposure assessment.');
  for(const p of ctx.nearby_solar){
    const card=node('div',null,'record');
    card.appendChild(node('strong',p.name));
    line(card,pretty(p.km)+' km · '+(p.capacity_mw===null?'MW capacity not declared':pretty(p.capacity_mw)+' MW as recorded')+
      ' · symbol radius '+pretty(p.marker_radius_px)+' px (display only; not land area)');
    line(card,'Observed optical lightning activity '+pretty(p.km)+' km from this mapped project. Consider post-event inspection as diligence, NOT as evidence of a strike, fault or damage.');
    const a=node('a','Open project in existing GridAtlas MAP');
    a.href=p.gridatlas_project_url;a.target='_blank';a.rel='noopener noreferrer';
    card.appendChild(a);solar.appendChild(card);
    const option=node('option',p.name+' · '+pretty(p.km)+' km');option.value=p.repd_ref;
    chooser.appendChild(option);
  }
}
function scenario(){
  const t=clear('scenario-output');
  if(!state.ctx){line(t,'No selected context.');return}
  try{
    const result=lightningElectricalScenario(state.ctx,{
      acEarthing:el('ac').value,dcReference:el('dc').value,
      inverterIsolation:el('inverter').value,
      selectedRepdRef:el('project').value||null
    });
    const diligence=postEventDiligence(state.ctx,{
      selectedRepdRef:el('project').value||null,
      overheadLineProximity:el('overhead').value,
      wetWeather:el('weather').value
    });
    const title=node('p','NOT RUN — no current, voltage, probability or event causality calculated','strong');
    t.appendChild(title);
    line(t,'Selected site: '+(result.site?.name||'None; generic hypothetical study inputs only'));
    line(t,result.disclaimer);
    result.candidate_scenarios.forEach(s=>{
      const detail=node('details');
      const summary=node('summary',s.label+' · '+(s.applicable===false?'not confirmed applicable':'scenario inputs'));
      detail.appendChild(summary);
      const list=node('ul');
      s.needs.forEach(need=>list.appendChild(node('li',need)));
      detail.appendChild(list);t.appendChild(detail);
    });
    t.appendChild(node('h3','Post-event inspection: engineering diligence, not diagnosis'));
    line(t,diligence.disclaimer);
    line(t,diligence.overhead_note);
    line(t,diligence.weather_note);
    const inspection=node('ul');
    diligence.actions.forEach(a=>inspection.appendChild(node('li',a)));
    t.appendChild(inspection);
    line(t,'Other possible causes: '+diligence.other_possible_causes.join('; ')+'.');
    line(t,'Technical background: DEHN WPX051 / EN / 0422 on string-inverter AC-side surge paths; consult manufacturer instructions and applicable standards.');
  }catch(e){line(t,'Scenario setup refused: '+e.message)}
}
async function inspect(){
  const f=currentFlash();if(!f)return;
  const serial=++state.serial;
  el('inspect').disabled=true;
  status('Loading genuine substation and solar source records. No changes to the original Atlas…');
  try{
    const assets=await getAssets();
    if(serial!==state.serial)return;
    const ctx=state.engine.selectFlash(f,{
      radiusKm:Number(el('radius').value),minimumKv:Number(el('kv').value),
      solarLimit:30,substationLimit:6
    });
    state.ctx=ctx;
    display(ctx,assets);
    el('scenario').disabled=false;
    status('Ready · '+pretty(ctx.nearby_solar.length)+' located solar projects and '+pretty(ctx.substations.length)+
      ' nearest substations returned from LOADED datasets. '+caveat+
      (assets.issues.length?' Partial data: see source failures.':'')+
      ' Earlier than the seven-day feed remains UNKNOWN.');
  }catch(e){
    if(serial===state.serial)fail('Unable to compute or load context: '+e.message+'. No results have been inferred.');
  }finally{
    // Changing flash or filters while a request is in flight invalidates
    // that request, but must NEVER strand the Inspect button disabled.
    el('inspect').disabled=false;
  }
}
el('flash').addEventListener('change',()=>{
  state.serial++;setObservation(currentFlash());el('scenario').disabled=true;
  clear('substations').textContent='Awaiting proximity search.';
  clear('solar').textContent='Awaiting proximity search.';
  el('provenance').textContent='New observation selected; previous results cleared.';
  status('Observation changed. Run a new proximity search; earlier results are not retained.');
});
el('inspect').addEventListener('click',inspect);
el('scenario').addEventListener('click',scenario);
for(const k of ['ac','dc','inverter','project','overhead','weather']){
  el(k).addEventListener('change',()=>{
    el('scenario-output').textContent='Assumptions changed; prepare the scenario again. No electrical solver has run.';
  });
}
for(const k of ['radius','kv'])el(k).addEventListener('change',()=>{
  state.serial++;state.ctx=null;el('scenario').disabled=true;
  clear('substations').textContent='Parameters changed. Run proximity search again.';
  clear('solar').textContent='Parameters changed. Run proximity search again.';
  el('provenance').textContent='Prior proximity results cleared; no new search yet.';
  el('project').replaceChildren(node('option','No project selected'));
  el('scenario-output').textContent='Parameters changed. Run proximity search again.';
  status('Search parameters changed. Earlier results cleared; select Find nearest mapped infrastructure to recalculate.');
});
async function start(){
  try{
    const source=await downloadJSON(FEED);
    state.observations=observationList(source);
    if(!state.observations.length)throw Error('The feed contains no valid identified optical flashes');
    const seen=new Set(),distinct=[];
    for(const f of state.observations)if(!seen.has(String(f.id))){seen.add(String(f.id));distinct.push(f)}
    state.observations=distinct;
    const selector=el('flash');
    selector.replaceChildren();
    distinct.forEach((f,i)=>{
      const name=date(f.properties.time_utc)+' · '+f.geometry.coordinates.map(x=>Number(x).toFixed(3)).join(', ')+' · #'+(i+1);
      const item=node('option',name);item.value=String(f.id);selector.appendChild(item);
    });
    const requested=new URL(location.href).searchParams.get('flash_id');
    if(requested && distinct.some(f=>String(f.id)===requested))selector.value=requested;
    selector.disabled=el('inspect').disabled=false;
    setObservation(currentFlash());
    status('Loaded '+pretty(distinct.length)+' distinct authentic optical observations in the available seven-day feed. '+caveat+
      ' No historical coverage is assumed; select one, then run the genuine nearest search.');
  }catch(e){fail('Feed unavailable: '+e.message+'. No flash or infrastructure result is inferred.')}
}
start();
