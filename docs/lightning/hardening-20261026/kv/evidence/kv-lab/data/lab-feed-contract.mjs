/**
 * Read-only source-evidence contract for the standalone Lightning → Grid Lab.
 * A recent collector query is NOT proof that seven days were exhaustively
 * searched. A quiet interval is UNKNOWN unless durable coverage says otherwise.
 * No optical event is a verified ground strike or diagnosed site incident.
 */
const hour=3600000;
const utc=t=>typeof t==='string' && /(?:Z|\+00:00)$/i.test(t) && Number.isFinite(Date.parse(t))
  ? Date.parse(t) : NaN;
const finite=n=>typeof n==='number' && Number.isFinite(n);
const validCoordinates=p=>Array.isArray(p) && p.length>=2
  && finite(p[0]) && finite(p[1])
  && p[0]>=-180 && p[0]<=180 && p[1]>=-90 && p[1]<=90;

export function parseOpticalFeed(data,{nowMs=Date.now(),staleAfterHours=6}={}){
  if(!finite(nowMs)||!finite(staleAfterHours)||staleAfterHours<=0)
    throw new TypeError('Invalid clock or freshness threshold');
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
    throw new Error('Source is not a GeoJSON FeatureCollection');
  const meta=data.metadata||{};
  const queryStartMs=utc(meta.query_start_utc);
  const queryEndMs=utc(meta.query_end_utc);
  if(Number.isFinite(queryEndMs)&&queryEndMs>nowMs+5*60000)
    throw new Error('Feed query end is in the future; coverage UNKNOWN');
  if(Number.isFinite(queryStartMs)&&Number.isFinite(queryEndMs)&&queryStartMs>queryEndMs)
    throw new Error('Feed query window is inverted; coverage UNKNOWN');
  const selected=new Map(),conflicting=new Set();
  let rejected=0,duplicate=0;
  for(const f of data.features){
    const id=f?.id==null?'':String(f.id).trim();
    const time=utc(f?.properties?.time_utc);
    const coordinates=f?.geometry?.coordinates;
    if(!id || f?.type!=='Feature' || f?.geometry?.type!=='Point'
      || !validCoordinates(coordinates)
      || f?.properties?.observation_kind!=='optical_lightning_flash'
      || !Number.isFinite(time)||time>nowMs+5*60000
      || (Number.isFinite(queryEndMs)&&time>queryEndMs+5*60000)){
      rejected++;continue;
    }
    if(selected.has(id)){
      duplicate++;
      const old=selected.get(id);
      if(old.properties.time_utc!==f.properties.time_utc
        || old.geometry.coordinates[0]!==coordinates[0]
        || old.geometry.coordinates[1]!==coordinates[1])conflicting.add(id);
      continue;
    }
    selected.set(id,f);
  }
  for(const id of conflicting){selected.delete(id);rejected++}
  const observations=[...selected.values()].sort((a,b)=>
    Date.parse(b.properties.time_utc)-Date.parse(a.properties.time_utc));
  const freshness=Number.isFinite(queryEndMs)
    ?(nowMs-queryEndMs>staleAfterHours*hour?'STALE_QUERY':'RECENT_QUERY')
    :'QUERY_TIME_UNKNOWN';
  const latestMs=observations.length?Date.parse(observations[0].properties.time_utc):NaN;
  const latestDeclaredMs=utc(meta.latest_detection_utc);
  const warnings=[];
  if(rejected||duplicate)warnings.push(rejected+' rejected/ambiguous, '+duplicate+' duplicate source records');
  if(freshness==='STALE_QUERY')warnings.push('Collector query is stale; later optical observations UNKNOWN');
  if(freshness==='QUERY_TIME_UNKNOWN')warnings.push('Last successful query time UNKNOWN');
  if(Number.isFinite(latestDeclaredMs) && Number.isFinite(latestMs)
    && Math.abs(latestMs-latestDeclaredMs)>60000)
    warnings.push('Latest detected timestamp differs from feed metadata');
  if(Number.isFinite(meta.total_before_display_cap)
    && meta.total_before_display_cap<data.features.length)
    warnings.push('Feed source total is inconsistent with displayed rows');
  if(data.features.length && !observations.length)
    throw new Error('All source records invalid or ambiguous; observations UNKNOWN, not zero');
  return Object.freeze({
    observations,
    evidence:Object.freeze({
      raw_records:data.features.length,accepted:observations.length,
      rejected,duplicates:duplicate,conflicting_ids:conflicting.size,
      latest_detection_utc:Number.isFinite(latestMs)?new Date(latestMs).toISOString():null,
      query_start_utc:Number.isFinite(queryStartMs)?new Date(queryStartMs).toISOString():null,
      query_end_utc:Number.isFinite(queryEndMs)?new Date(queryEndMs).toISOString():null,
      query_freshness:freshness,
      query_age_hours:Number.isFinite(queryEndMs)?Math.max(0,(nowMs-queryEndMs)/hour):null,
      retention_days:Number.isFinite(meta.retention_days)?meta.retention_days:null,
      cumulative_coverage:'UNKNOWN',
      unobserved_interval:'UNKNOWN',
      warnings
    })
  });
}

export function describeOpticalFeedEvidence(e){
  const last=e.latest_detection_utc?e.latest_detection_utc.replace('T',' ').replace('Z',' UTC')
    :'not recorded';
  const query=e.query_end_utc?e.query_end_utc.replace('T',' ').replace('Z',' UTC')
    :'UNKNOWN';
  const freshness=e.query_freshness==='STALE_QUERY'?'STALE COLLECTOR QUERY'
    :e.query_freshness==='QUERY_TIME_UNKNOWN'?'QUERY FRESHNESS UNKNOWN'
    :'recent collector query (not complete coverage)';
  return 'Authentic optical observations: '+e.accepted+' accepted of '+e.raw_records+
    ' source records. Latest optical detection: '+last+'. Latest collector query ended: '+
    query+' ('+freshness+'). Seven-day retention is not a verified seven-day search: '+
    'unsearched hours and older history UNKNOWN, not zero.'+
    (e.warnings.length?' SOURCE WARNINGS: '+e.warnings.join('; ')+'.':'');
}
