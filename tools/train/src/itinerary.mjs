import {normaliseTrainStop} from './station-index.mjs';
/** Selected stops, including endpoints. Intermediate traversal nodes are not stored here. */
export function createItinerary({mode = 'journey', stationIndex, scenarioStore = null, law: initialLaw = {}} = {}) {
  if (typeof stationIndex?.get !== 'function') throw new Error('The full canonical station index is required.');
  let law=normaliseJourneyLaw(initialLaw);
  const copyStation=row=>({...normaliseTrainStop(row),...(row.proposed?{proposed:true,sessionId:row.sessionId,scenarioRevision:row.scenarioRevision,evidence:'SESSION_ONLY_USER_PROPOSED_NOT_OFFICIAL'}:{})});
  function selectedStation(stop) {
    const id=stop?.stationId ?? stop?.id, canonical=stationIndex.get(id) || (law.fallback === 'user-opted-hypothetical' ? scenarioStore?.get(id) : null);
    if(!canonical)throw new Error('Selected stops must exist by stable ID in the station inventory.');
    if(stop.at && (!Array.isArray(stop.at)||stop.at.length!==2||stop.at.some((v,i)=>v!==canonical.at[i])))throw new Error('Selected station point differs from its canonical source point.');
    if(stop.id != null && stop.id !== id)throw new Error('Conflicting station identity.');
    return copyStation({...canonical,...(stop.place?{place:stop.place}:{})});
  }
  const caps = {journey:10,vicinity:90};
  if (!Object.hasOwn(caps,mode)) throw new Error('Choose journey or vicinity mode.');
  let stops = [], revision = 0, serial = 0;
  const snapshot = () => {
    const invalidStopIds=[];
    const selected=stops.map(s=>{
      const current=s.proposed?scenarioStore?.get(s.stationId):stationIndex.get(s.stationId);
      const valid=!!current && (!s.proposed || law.fallback==='user-opted-hypothetical');
      if(!valid)invalidStopIds.push(s.stopId);
      return {...copyStation(current?{...current,...(s.place?{place:s.place}:{})}:s),stopId:s.stopId,...(!valid?{invalid:true}:{})};
    });
    return {schema:'gridatlas.user-itinerary.v1',mode,limit:caps[mode],selectedCount:stops.length,revision,planEpoch:revision+(scenarioStore?.snapshot().revision||0),law:normaliseJourneyLaw(law),valid:invalidStopIds.length===0,invalidStopIds,evidence:'USER_SELECTED_ITINERARY_NOT_CONFIRMED_CONNECTION',stops:selected,start:stops[0]?.stopId||null,finish:stops.at(-1)?.stopId||null};
  };
  function setLaw(value){const next=normaliseJourneyLaw(value);if(next.fallback!=='user-opted-hypothetical'&&stops.some(s=>s.proposed))throw new Error('Remove proposed stops explicitly before choosing documented-only.');law=next;revision++;return snapshot();}
  function position(value) {
    if (Number.isInteger(value) && value >= 0 && value < stops.length) return value;
    if (typeof value === 'string') { const exact = stops.findIndex(s=>s.stopId===value); if (exact>=0) return exact; const found=stops.map((s,i)=>s.stationId===value?i:-1).filter(i=>i>=0); if(found.length===1)return found[0]; }
    throw new Error('Choose one unambiguous selected stop.');
  }
  function insert(stop,index=stops.length) {
    if(stops.length>=caps[mode])throw new Error('Selected stop limit is '+caps[mode]+' including start and finish.');
    if(!Number.isInteger(index)||index<0||index>stops.length)throw new Error('Invalid selected stop position.');
    const row=selectedStation(stop);stops.splice(index,0,{...row,stopId:'selected-stop-'+(++serial)});revision++;return snapshot();
  }
  function replace(value,stop){const index=position(value),row=selectedStation(stop);stops[index]={...row,stopId:stops[index].stopId};revision++;return snapshot();}
  return Object.freeze({snapshot,setLaw,add(stop,{index}={}){return insert(stop,index);},remove(value){stops.splice(position(value),1);revision++;return snapshot();},move(value,index){const from=position(value);if(!Number.isInteger(index)||index<0||index>=stops.length)throw new Error('Invalid selected stop position.');const [row]=stops.splice(from,1);stops.splice(index,0,row);revision++;return snapshot();},replace,setStart(stop){return stops.length?replace(0,stop):insert(stop);},setFinish(stop){return stops.length>1?replace(stops.length-1,stop):insert(stop);},setMode(next){if(!Object.hasOwn(caps,next))throw new Error('Choose journey or vicinity mode.');if(stops.length>caps[next])throw new Error('Remove selected stops explicitly before reducing the limit.');mode=next;revision++;return snapshot();},clear(){stops=[];revision++;return snapshot();}});
}
/** Declarative user constraints only; execution and electrical enforcement belong to the planner. */
export function normaliseJourneyLaw(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['schema','mustVisitStationIds','allowedVoltageBands','fallback','allowTransformers'].includes(key))) throw new Error('Journey law must use the supported declarative fields only.');
  if(value.schema != null && value.schema !== 'gridatlas.journey-law.v1') throw new Error('Unknown journey law schema.');
  const ids=value.mustVisitStationIds ?? [],bands=value.allowedVoltageBands ?? null,fallback=value.fallback ?? 'documented-only',allowTransformers=value.allowTransformers ?? true;
  if(!Array.isArray(ids)||ids.length>90||ids.some(id=>typeof id!=='string'||!id.trim()||/[\u0000-\u001f\u007f]/.test(id)))throw new Error('Ordered must-visit entries require stable station IDs.');
  const supported=new Set(['400','275','220','132','66','33','11','other','unknown']);
  if(bands!==null&&(!Array.isArray(bands)||bands.some(b=>typeof b!=='string'||!supported.has(b))))throw new Error('Choose supported source voltage bands.');
  if(!['documented-only','user-opted-hypothetical'].includes(fallback)||typeof allowTransformers!=='boolean')throw new Error('Choose documented-only or explicit user hypothetical fallback and a boolean transformer gate.');
  return {schema:'gridatlas.journey-law.v1',mustVisitStationIds:ids.slice(),allowedVoltageBands:bands===null?null:[...new Set(bands)],fallback,allowTransformers};
}



