/* GridAtlas vicinity 202611180026: source-built spatial context, no inferred circuits. */
(() => {
'use strict';
const VICINITY_GENERATION="202611180026";
const VICINITY_CSS="#gridatlas-vicinity{position:absolute;inset:0;pointer-events:none;z-index:32;font:12px/1.4 monospace;color:#bfe9ee}#gridatlas-vicinity *{box-sizing:border-box}#gridatlas-vicinity button,#gridatlas-vicinity input{font:inherit;pointer-events:auto}#gridatlas-vicinity button{min-height:44px;padding:7px 10px;color:#0ff;background:#061216;border:1px solid #367078;cursor:pointer}#gridatlas-vicinity :focus-visible{outline:3px solid #ffd84d;outline-offset:2px}#gridatlas-vicinity [hidden]{display:none!important}#gridatlas-vicinity .vic-launch{position:absolute;left:8px;top:170px;max-width:180px}#gridatlas-vicinity .vic-panel{position:absolute;pointer-events:auto;right:8px;top:58px;width:min(400px,calc(100% - 16px));max-height:calc(100% - var(--gridatlas-sheet-h,0px) - 130px);overflow:auto;overscroll-behavior:contain;background:#020809;border:1px solid #0ff;padding:10px}#gridatlas-vicinity .vic-head{display:flex;gap:8px;align-items:center;justify-content:space-between;position:sticky;top:-10px;background:#020809;padding:6px 0;z-index:1}#gridatlas-vicinity h2{font:700 14px/1.3 monospace;margin:0;color:#0ff}#gridatlas-vicinity p{margin:8px 0}#gridatlas-vicinity .vic-caption{color:#ffd84d}#gridatlas-vicinity fieldset{margin:8px 0;border:1px solid #315057;padding:6px}#gridatlas-vicinity .vic-bands{display:flex;flex-wrap:wrap;gap:2px 8px}#gridatlas-vicinity .vic-bands label{display:flex;gap:6px;align-items:center;min-height:44px}#gridatlas-vicinity input[type=checkbox]{width:20px;height:20px;accent-color:#0ff}#gridatlas-vicinity input[type=range]{display:block;width:100%;height:44px;accent-color:#0ff}#gridatlas-vicinity .vic-actions{display:flex;flex-wrap:wrap;gap:5px}#gridatlas-vicinity ol{margin:8px 0;padding-left:22px}#gridatlas-vicinity li{padding:7px 0;border-bottom:1px solid #18333a;overflow-wrap:anywhere}#gridatlas-vicinity li button{display:block;margin-top:4px}#gridatlas-vicinity .vic-error{color:#ff8585}#gridatlas-vicinity .vic-row-meta{display:block;color:#9ab8be}@media(max-height:440px){#gridatlas-vicinity .vic-panel{top:8px;max-height:calc(100% - 16px)}#gridatlas-vicinity .vic-launch{top:100px}}@media(prefers-reduced-motion:reduce){#gridatlas-vicinity *{animation:none!important;transition:none!important}}\n#gridatlas-gj03 select{appearance:none;-webkit-appearance:none;color-scheme:dark;background:#071013!important;color:#bfe9ee!important;border-radius:0}#gridatlas-gj03 select option{background:#071013;color:#bfe9ee}@media(max-height:480px){#gridatlas-vicinity .vic-panel{top:52px;max-height:calc(100% - var(--gridatlas-sheet-h,0px) - 124px)}body #gridatlas-gj03 .gj-panel{max-height:calc(100% - var(--gridatlas-sheet-h,0px) - 124px)}}\n#gridatlas-vicinity summary{min-height:44px;padding:8px 0;cursor:pointer}\n";
/** Spatial exploration only. Canonical Atlas geodesy is injected, never forked. */
const VOLTAGE_BANDS = Object.freeze([
  ['400', '400 kV', '#ff5555'], ['275', '275 kV', '#ff8a3d'],
  ['132', '132 kV', '#ffd84d'], ['66', '66 kV', '#8be28b'],
  ['33', '33 kV', '#48d8df'], ['11', '11 kV', '#b8b8ed'],
  ['other', 'Other stated voltage', '#e6e6e6'], ['unknown', 'Voltage not stated', '#8b9ca0']
]);

function validCoordinate(at) {
  return Array.isArray(at) && at.length >= 2 && at.slice(0, 2).every(v => typeof v === 'number' && Number.isFinite(v))
    && Math.abs(at[0]) <= 180 && Math.abs(at[1]) <= 90
    && !(Math.abs(at[0]) < 1e-9 && Math.abs(at[1]) < 1e-9);
}

function radiusKm(value) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error('Choose a whole-kilometre radius from 1 to 50 km.');
  if (typeof value === 'string' && !value.trim()) throw new Error('Choose a radius from 1 to 50 km.');
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error('Choose a whole-kilometre radius from 1 to 50 km.');
  return n;
}

function normaliseOrigin(origin, {requireIdentity = false} = {}) {
  if (!validCoordinate(origin?.at)) throw new Error('A valid located origin is required; no coordinates were inferred.');
  const type = String(origin.type || 'map-centre');
  const id = origin.id == null ? null : String(origin.id).trim();
  if (requireIdentity && (!['repd', 'datacentre', 'substation'].includes(type) || !id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id))) {
    throw new Error('Journey origin type and stable source ID are required.');
  }
  return {at: [origin.at[0], origin.at[1]], type, id, name: String(origin.name || (id ? `${type} ${id}` : 'Map centre')).slice(0, 240)};
}

function parseVicinityIntent(search) {
  const q = new URLSearchParams(search);
  if (q.get('journey') !== 'vicinity') return null;
  if (q.getAll('journey').length !== 1 || q.getAll('radius_km').length > 1) throw new Error('Journey link has duplicate intent or radius fields.');
  const fields = ['origin_type', 'origin_id', 'latitude', 'longitude'];
  const hasOrigin = fields.some(k => q.has(k));
  let origin = null;
  if (hasOrigin) {
    if (fields.some(k => q.getAll(k).length !== 1) || !q.has('radius_km')) throw new Error('Journey link has missing or duplicate origin fields.');
    const latitude = q.get('latitude'), longitude = q.get('longitude');
    const numberText = value => typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim());
    if (!numberText(latitude) || !numberText(longitude)) throw new Error('Journey link has invalid coordinates.');
    origin = normaliseOrigin({at: [Number(longitude), Number(latitude)], type: q.get('origin_type'), id: q.get('origin_id'), name: q.get('name')}, {requireIdentity: true});
  }
  const intent = origin ? {origin, radiusKm: radiusKm(q.get('radius_km'))} : {manual: true, radiusKm: q.has('radius_km') ? radiusKm(q.get('radius_km')) : 10};
  if (q.has('news_context_url')) {
    try {
      if (q.getAll('news_context_url').length !== 1 || q.getAll('news_topic').length > 1) throw new Error('News context has duplicate fields.');
      intent.newsContextUrl = validateNewsContextBase(q.get('news_context_url'));
      intent.newsTopic = normaliseNewsTopic(q.get('news_topic'), origin);
    } catch (error) {
      delete intent.newsContextUrl; delete intent.newsTopic;
      intent.newsContextError = 'News context link was not applied: ' + error.message;
    }
  }
  return intent;
}

function validateNewsContextBase(value) {
  if (typeof value !== 'string' || value.length > 200 || !/^https:\/\/globalgrid2050\.com\//.test(value)) throw new Error('News context must use a dated GlobalGrid2050 edition.');
  const url = new URL(value);
  if (url.origin !== 'https://globalgrid2050.com' || url.username || url.password || url.port || url.search || url.hash
    || !/^\/uk_renewables_pipeline\/\d{12}\/(?:index\.html)?$/.test(url.pathname)) throw new Error('News context must use a dated GlobalGrid2050 edition without extra URL fields.');
  return url.href;
}

function normaliseNewsTopic(value, origin) {
  const allowed = ['datacentre','grid','renewables','storage','solar','wind'];
  if (value != null && value !== '') {
    if (!allowed.includes(value)) throw new Error('News topic is not supported.');
    return value;
  }
  return origin?.type === 'datacentre' ? 'datacentre' : origin?.type === 'substation' ? 'grid' : 'renewables';
}

function newsContextHref(base, origin, topic) {
  const url = new URL(validateNewsContextBase(base));
  if (['repd','datacentre','substation'].includes(origin?.type) && origin?.id) {
    url.searchParams.set('news_origin_type', origin.type);
    url.searchParams.set('news_origin_id', String(origin.id).slice(0,256));
  }
  url.searchParams.set('news_topic', normaliseNewsTopic(topic, origin));
  url.hash = 'headlinesHeading';
  return url.href;
}

function voltageBands(kv) {
  if (!kv.length) return ['unknown'];
  return [...new Set(kv.map(v => VOLTAGE_BANDS.some(b => b[0] === String(v)) ? String(v) : 'other'))];
}

function stationRecords(features, geodesy) {
  const seen = new Set(), records = [];
  for (const feature of features || []) {
    const p = feature?.properties || {}, at = geodesy.representativePoint(feature?.geometry);
    if (!validCoordinate(at)) continue;
    const kv = Array.from(geodesy.voltagesKv(p)).filter(v => Number.isFinite(v) && v > 0);
    // This key deduplicates display rows only. It is never exported as source identity.
    const id = feature.id ?? p.id ?? null;
    const key = `${at[0]}|${at[1]}|${p.name || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({id: id == null ? null : String(id), at: [at[0], at[1]], name: String(p.name || 'Unnamed mapped substation'),
      operator: String(p.operator || ''), kv, bands: voltageBands(kv), source: String(p.source || 'Existing Atlas substation layer')});
  }
  return records;
}

function exploreVicinity({origin, radius, records, bands, geodesy, limit = 200}) {
  const o = normaliseOrigin(origin), r = radiusKm(radius), selected = new Set(bands);
  const ordered = [];
  for (const row of records) {
    if (!row.bands.some(b => selected.has(b))) continue;
    const km = geodesy.distanceKm(o.at[0], o.at[1], row.at[0], row.at[1]);
    if (!Number.isFinite(km) || km < 0 || km > r) continue;
    ordered.push({...row, km});
  }
  ordered.sort((a, b) => a.km - b.km || a.name.localeCompare(b.name, 'en') || String(a.id).localeCompare(String(b.id), 'en'));
  return {origin: o, radiusKm: r, matching: ordered.length, loadedRecords: records.length,
    shown: ordered.slice(0, limit), truncated: ordered.length > limit,
    statement: 'Spatial vicinity, connectivity unknown. Distances are straight-line; mapped voltage is a source tag, not capacity or an electrical path.'};
}

/** A radius boundary is spatial geometry, never a circuit or route. */
function vicinityGeoJSON(result, geodesy) {
  const [lon, lat] = result.origin.at;
  const ring = [];
  for (let i = 0; i <= 96; i++) {
    ring.push(geodesy.destinationPoint(lon, lat, result.radiusKm, i * 360 / 96));
  }
  return {type: 'FeatureCollection', features: [
    {type: 'Feature', properties: {kind: 'radius', meaning: 'Spatial boundary; not a circuit'}, geometry: {type: 'LineString', coordinates: ring}},
    {type: 'Feature', properties: {kind: 'origin', name: result.origin.name}, geometry: {type: 'Point', coordinates: result.origin.at}},
    ...result.shown.map(row => ({type: 'Feature', properties: {kind: 'substation', name: row.name, km: row.km,
      voltage: row.kv.length ? row.kv.join(' / ') + ' kV' : 'Not stated', colour: VOLTAGE_BANDS.find(b => b[0] === row.bands[0])?.[2] || '#e6e6e6'},
      geometry: {type: 'Point', coordinates: row.at}}))
  ]};
}

const collectAssetContext = (() => {
/** Read-only context from existing Atlas source owners. No fetching or electrical inference. */
const ASSET_CONTEXT_CATEGORIES = Object.freeze([
 ['generation','REPD generation context'],['storage','REPD storage context'],['datacentre','Data-centre listings'],
 ['conventional','Listed conventional power context'],['demand-context','Other potential demand context']
]);
const assetCoordinate = at => Array.isArray(at)&&at.length>=2&&at.slice(0,2).every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(at[0])<=180&&Math.abs(at[1])<=90&&(at[0]!==0||at[1]!==0);
const statedMw = value => {const v=value&&typeof value==='object'?value.value:value;if(typeof v!=='number'&&typeof v!=='string')return null;if(typeof v==='string'&&!/^\d+(?:\.\d+)?$/.test(v.trim()))return null;const n=Number(v);return Number.isFinite(n)&&n>0?n:null;};
const assetId = value => (typeof value==='string'||typeof value==='number')&&String(value).trim()&&String(value).length<=256?String(value).trim():null;
function assetPrecision(p){for(const [field,value]of[['location.precision',p.location?.precision],['coordinate_precision',p.coordinate_precision],['location_precision',p.location_precision]])if(typeof value==='string'&&value.trim())return{precision:value,precisionField:field,approximateLocation:/approx|centroid|postcode|settlement|area/i.test(value)};return{precision:null,precisionField:null,approximateLocation:false};}
function collectAssetContext({map,registry={},origin,radiusKm,geodesy,limit=200}={}){
 const at=origin?.at;
 if(!assetCoordinate(at)||!Number.isInteger(radiusKm)||radiusKm<1||radiusKm>50)throw Error('Located origin and integer radius 1-50 km are required.');
 if(!geodesy?.distanceKm||!geodesy?.representativePoint)throw Error('Canonical Atlas geodesy is required.');
 if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('Asset result limit must be 1-200.');
 const categories=ASSET_CONTEXT_CATEGORIES.map(([id,label])=>({id,label,availability:'NOT_LOADED',source:null,count:0,loadedRecords:0,truncated:false,rows:[]}));
 const get=id=>categories.find(c=>c.id===id),seen=new Map(categories.map(c=>[c.id,new Set()]));
 function add(category,row){
  const c=get(category);c.loadedRecords++;
  if(!assetCoordinate(row.at))return;
  // Source IDs deduplicate records; coincident coordinates alone never merge facilities.
  const key=row.id===null?null:row.source+'|'+row.id;
  if(key!==null){if(seen.get(category).has(key))return;seen.get(category).add(key);}
  const km=geodesy.distanceKm(at[0],at[1],row.at[0],row.at[1]);
  if(!Number.isFinite(km)||km<0||km>radiusKm)return;
  c.rows.push({...row,at:row.at.slice(0,2),km,demandMw:null,facilityVerified:null,connection:null});
 }
 let features=null;
 try{const data=map?.getSource?.('src-repd')?.serialize?.().data;if(data?.type==='FeatureCollection'&&Array.isArray(data.features)&&data.features.length)features=data.features;}catch{/* Explicit NOT_LOADED below; no replacement fetch. */}
 if(features){
  for(const id of ['generation','storage'])Object.assign(get(id),{availability:'LOADED',source:'Existing loaded src-repd GeoJSON'});
  features.forEach((f,i)=>{
   const p=f?.properties||{},point=geodesy.representativePoint(f?.geometry),tech=String(p.tech||p.technology||p.technology_type||'Not stated');
   const category=/^(?:bess(?:[_ -].*)?|battery(?:[_ -].*)?|storage|flywheel|caes)$/i.test(tech)?'storage':'generation';
   const ref=assetId(p.repd_ref??p.ref_id),id=ref??assetId(p.id??f?.id);
   add(category,{id,originId:ref&&/^\d+$/.test(ref)?'repd:'+ref:null,name:String(p.name||'Unnamed REPD record'),at:point,kind:category,status:String(p.status||'Not stated'),technology:tech,
    capacityMw:statedMw(p.capacity_mw??p.capacity),capacityBasis:typeof p.capacity_basis==='string'?p.capacity_basis:'REGISTER_STATED_POWER_BASIS_NOT_DECLARED',
    metrics:{itLoadMw:null,gridConnectionMw:null,unclassifiedMw:null},...assetPrecision(p),source:'src-repd',sourceRow:i});
  });
 }
 const owner=registry.ukOfftakers?.state, data=owner?.data, dots=Array.isArray(data?.dots)?data.dots:null;
 if(dots){
  for(const id of ['datacentre','conventional','demand-context'])Object.assign(get(id),{availability:'LOADED',source:id==='conventional'?'Loaded potential-offtaker power-station listing; not the full conventional dataset':'Existing loaded off-taker owner records'});
  dots.forEach((r,i)=>{
   const p=r?.p||{},category=r?.k==='c'?'datacentre':r?.k==='b'?'conventional':['a','d','s','e'].includes(r?.k)?'demand-context':null;if(!category)return;
   const id=assetId(p.id??r.id),size=p.size_metric;
   const capacity=category==='conventional'?(typeof size?.unit==='string'&&/^MW(?:\b|_)/.test(size.unit)?statedMw(size.value):statedMw(p.mw)):null;
   add(category,{id,originId:id,name:String(r.n||p.name||'Unnamed listed site'),at:r.a,kind:category,status:String(p.status||'Not stated'),technology:String(p.technology||p.fuel||r.sub||'Not stated'),
    capacityMw:capacity,capacityBasis:capacity===null?null:'SOURCE_STATED_POWER_NOT_CURRENT_OUTPUT',metrics:category==='datacentre'?{itLoadMw:statedMw(p.it_load_mw),gridConnectionMw:statedMw(p.grid_connection_mw),unclassifiedMw:statedMw(p.unclassified_mw)}:{itLoadMw:null,gridConnectionMw:null,unclassifiedMw:null},
    ...assetPrecision(p),source:category==='datacentre'&&r.dc?'ukOfftakers.data-centre-pipeline':'ukOfftakers.loaded-listing',sourceRow:i});
  });
 }
 for(const c of categories){c.rows.sort((a,b)=>a.km-b.km||a.name.localeCompare(b.name,'en')||String(a.id).localeCompare(String(b.id),'en'));c.count=c.rows.length;c.truncated=c.count>limit;c.rows=c.rows.slice(0,limit);}
 return{categories,radiusKm,connectionsInferred:0,limitations:['Loaded source records only; NOT_LOADED is not zero nearby assets.','Register power, IT load and connection figures remain separate; demand and present output are unknown.','A supplied location and source ID do not verify a facility or its connections; source precision is retained.']};
}

return collectAssetContext;
})();
const documentContextFor = (() => {
/** Existing documentary context only. No fetch, name matching or spatial joins. */
function freezeDocumentContext(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeDocumentContext(child); Object.freeze(value); }
  return value;
}

const DOCUMENT_CONTEXT_PROVENANCE = freezeDocumentContext({
  declaredModule: {
    repository: 'Ventusltd/gridatlas', commit: 'b52693aaf513e63240acd8ab99a698df5b738cc6',
    path: 'atlas/modules/202609012128-declared-connections.js', bytes: 15461,
    sha256: 'a44520ebd644e725f644e7f3aea76839982c82d577022ac04583c5bc3346a371',
    sourceUrl: 'https://github.com/Ventusltd/gridatlas/blob/b52693aaf513e63240acd8ab99a698df5b738cc6/atlas/modules/202609012128-declared-connections.js'
  },
  noticeProducer: {
    repository: 'Ventusltd/globalgrid2050', commit: '07bff3a6d1cdc4d845062cafa1cf49161b135c96',
    path: 'automation/grid_notice_ui/20261117-v938/notice.json', bytes: 5300,
    sha256: 'bef90e1a64e4f1921c62f85ee61d636d1fe02fcebd30ea1570a7b3bfd49f5148',
    factsSha256: 'f9802c96444c21e84b328d612475353861c8053cde31f55196d1ea5862918afb',
    sourceUrl: 'https://github.com/Ventusltd/globalgrid2050/blob/07bff3a6d1cdc4d845062cafa1cf49161b135c96/automation/grid_notice_ui/20261117-v938/notice.json',
    reviewReferences: ['https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6953350836', 'https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-6953404444']
  }
});

const DOCUMENT_CONTEXT_NOTICES = freezeDocumentContext([{
  id: 'government:EN020026:consented:2026-10-30', title: 'Sea Link development consent',
  applicationRef: 'EN020026', status: 'NARROW_FACTS_REVIEWED_NO_ASSET_ASSOCIATION',
  sourceUrl: 'https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008',
  sourceTitle: 'Department for Energy Security and Net Zero: Sea Link development consent order',
  date: {value: '2026-10-30', precision: 'DAY'},
  statement: 'Government decision records development consent for the Suffolk–Kent transmission proposal. Its planned transmission upper bound is 2,000 MW; current capacity, commissioning and available headroom are unknown.',
  scope: 'Standalone official planning context. No association with the selected asset or its vicinity has been established.',
  plannedMetric: {value: 2000, unit: 'MW', kind: 'planned_transmission_upper_bound'},
  currentCapacityMw: null, commissioned: null, connection: null, repdRef: null, coordinates: null,
  verifiedAssetJoins: 0,
  rightsScope: 'government_html_facts_only_no_images_or_third_party_material',
  licenceUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  sources: [
    {title: 'Planning Inspectorate: Sea Link development consent decision announced', url: 'https://www.gov.uk/government/news/sea-link-development-consent-decision-announced',
      publishedDate: {value: '2026-10-30', precision: 'DAY'}, sourceUpdatedAt: null,
      archivedReceipt: {retrievedAt: '2026-11-17T15:48:11Z', bytes: 68432, sha256: 'b9ba26b90820292e0b181da7993d2d3a2180fc2de0ac53cc6239adeb4cccfaeb'},
      currentObservation: {retrievedAt: '2026-11-18T00:35:01.291330Z', bytes: 68432, sha256: 'b404ca2c91a4b84def5c521ceccab617c4b3bda860d40d2da32fd3e9298f599a', scope: 'Decision day and stated OGL footer reconfirmed; current HTML differs from archived receipt.'}},
    {title: 'Department for Energy Security and Net Zero: Sea Link development consent order', url: 'https://www.gov.uk/government/publications/sea-link-development-consent-order-planning-act-2008',
      publishedDate: {value: '2026-10-30', precision: 'DAY'}, sourceUpdatedAt: null,
      archivedReceipt: {retrievedAt: '2026-11-17T15:48:11Z', bytes: 69536, sha256: 'c26f93aa307740f8b4ec8ad150b152fb6d30e77f201e5bc31a6da52bba16e0d0'},
      currentObservation: {retrievedAt: '2026-11-18T00:35:01.437596Z', bytes: 69536, sha256: 'f15b12f35fa4fd1364894d550d3f053dfa680550ad7d83a56fa5b794624e4084', scope: 'Decision day and stated OGL footer reconfirmed; current HTML differs from archived receipt.'}}
  ]
}]);

function documentOrigin(origin) {
  if (!origin || !['repd', 'datacentre', 'substation'].includes(origin.type) || typeof origin.id !== 'string'
      || !origin.id || origin.id.length > 256 || /[\s\u0000-\u001f\u007f]/.test(origin.id)) return null;
  return {type: origin.type, id: origin.id};
}

function documentContextFor(origin, {declaredConnections} = {}) {
  const identity = documentOrigin(origin), matchedRecords = [];
  const limitations = [
    'No independently verified asset-to-upgrade or asset-to-notice crosswalk is supplied by this adapter.',
    'A published declaration or planning consent does not establish construction, energisation, a surveyed route, electrical connection, power flow or available capacity.',
    'The standalone Sea Link notice is not linked to the selected asset, nearby substations or a distance radius.'
  ];
  // Read the canonical already-published owner table; do not fork its records or
  // attach works to a nearby/name-matching substation. Its status stays verbatim.
  const ref = identity?.type === 'repd' && /^repd:[1-9]\d*$/.test(identity.id) ? identity.id.slice(5) : null;
  const canonical = declaredConnections?.schema === 'gridatlas.module.declared-connections.v1' ? declaredConnections.records : null;
  const declaration = ref && canonical && Object.hasOwn(canonical, ref) ? canonical[ref] : null;
  if (declaration && typeof declaration.source === 'string') {
    const statement = [declaration.works, declaration.poc_works, declaration.via].filter(v => typeof v === 'string' && v).join('; ');
    if (statement) matchedRecords.push({
      id: 'existing-atlas-declaration:' + ref, originId: identity.id,
      title: 'Existing published declaration for REPD ' + ref,
      sourceUrl: DOCUMENT_CONTEXT_PROVENANCE.declaredModule.sourceUrl, sourceTitle: declaration.source,
      statement, status: 'EXISTING_PUBLISHED_DECLARATION_UNREVALIDATED',
      scope: 'Existing published declaration; source citation not revalidated here. Exact REPD key only; not an independently verified asset-to-document association.',
      matchBasis: 'EXACT_REPD_KEY_IN_CANONICAL_OWNER_MODULE', verifiedAssetAssociation: false,
      date: null, datePrecision: 'UNKNOWN',
      declaredStatus: declaration.poc_status ?? null,
      // Preserve the original owner's fields and classification separately from
      // this adapter's review status. Never infer an absent status or date.
      declaration: Object.fromEntries(['works', 'poc_works', 'substation', 'circuit', 'via', 'source', 'poc_status', 'poc_status_note', 'poc_kind', 'kv']
        .filter(k => Object.hasOwn(declaration, k)).map(k => [k, declaration[k]]))
    });
  }
  if (!identity) limitations.unshift('No supported stable source identity was supplied; names and coordinates were not used to create a match.');
  else if (!matchedRecords.length) limitations.unshift('No exact existing documentary declaration is available for this source identity.');
  return freezeDocumentContext({
    schema: 'gridatlas.vicinity.document-context.v1', origin: identity,
    status: matchedRecords.length ? 'EXISTING_DECLARATION_ONLY' : 'NO_EXACT_ASSET_DOCUMENT_CONTEXT',
    matchedRecords, unassociatedNotices: DOCUMENT_CONTEXT_NOTICES,
    verifiedAssetJoins: 0, realConnectionsInferred: 0,
    counts: {existingDeclarations: matchedRecords.length, unassociatedNotices: 1, governmentDocuments: 2, verifiedAssetJoins: 0},
    limitations, provenance: DOCUMENT_CONTEXT_PROVENANCE
  });
}

return documentContextFor;
})();
const W = window, D = document, NS = W.__GRIDATLAS_MODULES__ = W.__GRIDATLAS_MODULES__ || {};
if (!NS.gridVicinity) {
  let controller = null, timer = null, stopped = false, pendingIntent = null, intentError = null;
  try { pendingIntent = parseVicinityIntent(W.location.search); } catch (error) { intentError = error.message; }
  function createController(map) {
    const geodesy = NS.geodesy;
    if (!geodesy?.distanceKm || !geodesy?.voltagesKv || !geodesy?.representativePoint) throw new Error('Canonical Atlas geodesy is not ready.');
    const host = map.getContainer(), prior = D.getElementById('gridatlas-vicinity');
    if (prior) throw new Error('Vicinity UI already mounted.');
    let alive = true, opened = false, origin = null, radius = 10, picking = false, result = null, records = [], contextSource = 'No loaded substation data', error = null, phase = 'CHOOSE_ORIGIN';
    let source = null, sourceUnavailable = false, selectionEpoch = 0, refreshTimer = null, returning = null, newsBase = null, newsTopic = null, assetContext = null, documentContext = null, assetSignature = null, stationSignature = null, documentSignature = null;
    const categoryElements = new Map();
    const itinerary = [], bands = new Set(VOLTAGE_BANDS.map(b => b[0])), listeners = [], groups = [], controls = [], ownedLayers = new Map();
    const SOURCE = 'gridatlas-vicinity-context', LAYERS = ['gridatlas-vicinity-radius', 'gridatlas-vicinity-points', 'gridatlas-vicinity-model'];
    const root = D.createElement('div'); root.id = 'gridatlas-vicinity'; host.appendChild(root);
    const style = D.createElement('style'); style.textContent = VICINITY_CSS; root.appendChild(style);
    function el(tag, text, parent, attrs = {}) { const e = D.createElement(tag); if (text != null) e.textContent = text; for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v); parent?.appendChild(e); return e; }
    function listen(target, type, fn) { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); }
    const launch = el('button', 'Vicinity · 1–50 km', root, {type: 'button', class: 'vic-launch', 'aria-expanded': 'false', 'aria-controls': 'gridatlas-vicinity-panel'});
    const panel = el('section', null, root, {id: 'gridatlas-vicinity-panel', class: 'vic-panel', 'aria-label': 'Vicinity familiarisation'}); panel.hidden = true;
    const heading = el('div', null, panel, {class: 'vic-head'}); el('h2', 'Explore the nearby grid', heading);
    const close = el('button', 'Close', heading, {type: 'button', 'aria-label': 'Close vicinity explorer'});
    const originLabel = el('p', '', panel, {class: 'vic-origin'});
    const originPrecision = el('p', 'Source-provided location; coordinate precision not supplied.', panel, {class: 'vic-origin-precision'});
    el('p', 'Spatial vicinity, connectivity unknown. Mapped points and voltage tags are context, not capacity or an electrical path.', panel, {class: 'vic-caption'});
    const actions = el('div', null, panel, {class: 'vic-actions'});
    const centre = el('button', 'Use map centre', actions, {type: 'button'});
    const pick = el('button', 'Pick origin on map', actions, {type: 'button', 'aria-pressed': 'false'});
    const fit = el('button', 'Fit radius', actions, {type: 'button'});
    const physical = el('button', 'Show physical grid', actions, {type: 'button'});
    const news = el('a', 'News context', actions, {target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Open news topic context in the supplied dated edition'}); news.hidden = true;
    news.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:7px 10px;color:#0ff;background:#061216;border:1px solid #367078';
    const newsCaption = el('p', 'Topic context only; a headline is not an association with this asset.', panel, {class: 'vic-news-caption'}); newsCaption.hidden = true;
    const radial = el('fieldset', null, panel); el('legend', 'Radius in whole kilometres', radial);
    const rangeLabel = el('label', '', radial, {for: 'gridatlas-vicinity-radius-input'});
    const slider = el('input', null, radial, {id: 'gridatlas-vicinity-radius-input', type: 'range', min: '1', max: '50', step: '1', value: '10', 'aria-label': 'Vicinity radius in kilometres'});
    const voltage = el('fieldset', null, panel); el('legend', 'Source voltage tags', voltage);
    const bandBox = el('div', null, voltage, {class: 'vic-bands'});
    for (const [key, name, colour] of VOLTAGE_BANDS) {
      const label = el('label', null, bandBox), input = el('input', null, label, {type: 'checkbox', value: key, 'aria-label': name}); input.checked = true;
      const text = el('span', name, label); text.style.color = colour;
      listen(input, 'change', () => { input.checked ? bands.add(key) : bands.delete(key); refresh(); });
    }
    const status = el('p', '', panel, {class: 'vic-status', role: 'status', 'aria-live': 'polite'});
    const failure = el('p', '', panel, {class: 'vic-error', role: 'alert'}); failure.hidden = true;
    const modelBox = el('fieldset', null, panel); el('legend', 'Your local grid model', modelBox);
    el('p', 'Add mapped assets in your chosen order. Dashed pink joins are your assumed scenario, not source-confirmed cables or power flow.', modelBox);
    const modelStatus = el('p', 'No stations added.', modelBox, {class: 'vic-model-status'});
    const modelActions = el('div', null, modelBox, {class: 'vic-actions'});
    const undo = el('button', 'Undo last station', modelActions, {type: 'button'}), clear = el('button', 'Clear model', modelActions, {type: 'button'});
    el('p', 'Nearby mapped substations · straight-line distance', panel);
    const list = el('ol', null, panel, {class: 'vic-results'});
    el('p', 'Existing Atlas substation layer; source tags and coverage may be incomplete. Reuses the map’s existing data loader.', panel, {class: 'vic-source'});
    const energy = el('fieldset', null, panel, {class: 'vic-energy-context'}); el('legend', 'Nearby generation and demand context', energy);
    el('p', 'Counts describe loaded source records. Nameplates, IT load, grid requests and actual electricity demand are different quantities.', energy);
    const loadAssets = el('button', 'Load existing asset layers', energy, {type: 'button'});
    const energyRows = el('div', null, energy, {class: 'vic-energy-categories'});
    const documents = el('details', null, panel, {class: 'vic-document-context'}); el('summary', 'Documented works and official notices', documents);
    const documentRows = el('div', null, documents);
    panel.insertBefore(energy, modelBox); panel.insertBefore(documents, modelBox);

    function sourceAnchor(parent, title, href) {
      try { const url = new URL(href); if (url.protocol !== 'https:' || url.username || url.password) return; el('a', title, parent, {href: url.href, target: '_blank', rel: 'noopener noreferrer'}); } catch (_) {}
    }
    function rowOrigin(row) {
      return {at: row.at, name: row.name, id: row.originId || row.id, type: row.kind === 'datacentre' ? 'datacentre' : ['generation','storage'].includes(row.kind) ? 'repd' : 'context-asset'};
    }
    function text(node, value) { if (node.textContent !== value) node.textContent = value; }
    function renderAssetContext() {
      assetContext = collectAssetContext({map, registry: NS, origin, radiusKm: radius, geodesy, limit: 40});
      const originRow = assetContext.categories.flatMap(category => category.rows).find(row => (row.originId || row.id) === origin.id && row.at.every((v,i) => v === origin.at[i]));
      text(originPrecision, ['map-centre','map-point'].includes(origin.type) ? 'User-chosen map point; no facility identity was inferred.'
        : originRow?.approximateLocation ? 'Source-provided location is approximate' + (originRow.precision ? ': ' + originRow.precision.replace(/_/g,' ').toLowerCase() : '') + '.'
        : originRow?.precision ? 'Source location tag: ' + originRow.precision.replace(/_/g,' ').toLowerCase() + '. Facility position has not been independently verified.'
        : 'Source-provided location; coordinate precision not supplied. A stable ID and coordinates alone do not verify a facility location.');
      const signature = JSON.stringify(assetContext);
      if (signature === assetSignature) return;
      assetSignature = signature;
      const scroll = panel.scrollTop;
      for (const category of assetContext.categories) {
        let view = categoryElements.get(category.id);
        if (!view) {
          const section = el('details', null, energyRows, {'data-vicinity-category': category.id});
          view = {section, heading: el('summary','',section), source: el('p','',section), hint: el('p','',section), rows: el('ol',null,section), records: new Map()};
          categoryElements.set(category.id, view);
        }
        text(view.heading, category.availability === 'LOADED' ? `${category.label}: ${category.count} within ${radius} km · ${category.loadedRecords} loaded records` : `${category.label}: not loaded; nearby count unknown`);
        text(view.source, `${category.source || 'Existing Atlas layer'}${category.truncated ? ' · showing nearest 40; narrow the radius for more detail.' : ''}`);
        text(view.hint, 'Use Load existing asset layers to request the map’s existing data.'); view.hint.hidden = category.availability === 'LOADED';
        const retained = new Set();
        for (const [index,row] of category.rows.entries()) {
          // A source-row index is a DOM cache key only; it never becomes an asset identity.
          const key = row.source + '|' + (row.originId || row.id || 'missing-source-id:' + row.sourceRow);
          retained.add(key);
          let entry = view.records.get(key);
          if (!entry) {
            const item = el('li',null,null,{'data-vicinity-asset-id':row.originId || row.id || ''});
            entry = {item, title: el('span','',item), meta: el('span','',item,{class:'vic-row-meta'}), row};
            const buttons = el('div',null,item,{class:'vic-actions'});
            entry.recenter = el('button','Use as origin',buttons,{type:'button'}); entry.add = el('button','Add to my model',buttons,{type:'button'});
            entry.recenter.addEventListener('click',()=>setOrigin(rowOrigin(entry.row))); entry.add.addEventListener('click',()=>addStation(entry.row));
            view.records.set(key,entry);
          }
          entry.row = row; text(entry.title,row.name);
          entry.recenter.setAttribute('aria-label','Use '+row.name+' as origin'); entry.add.setAttribute('aria-label','Add '+row.name+' to my model');
          const facts = [`${row.km.toFixed(2)} km straight-line`, row.status, row.technology].filter(Boolean);
          const basis = row.capacityBasis === 'REGISTER_STATED_POWER_BASIS_NOT_DECLARED' ? 'register power; basis not supplied' : row.capacityBasis === 'SOURCE_STATED_POWER_NOT_CURRENT_OUTPUT' ? 'source-stated power, not current output' : row.capacityBasis || 'source-stated basis not supplied';
          if (row.capacityMw != null) facts.push(`${row.capacityMw} MW (${basis})`);
          if (row.metrics?.itLoadMw != null) facts.push(`${row.metrics.itLoadMw} MW IT load`);
          if (row.metrics?.gridConnectionMw != null) facts.push(`${row.metrics.gridConnectionMw} MW grid-connection statement`);
          if (row.metrics?.unclassifiedMw != null) facts.push(`${row.metrics.unclassifiedMw} MW (basis unclassified)`);
          if (row.kind === 'datacentre' || row.kind === 'demand-context') facts.push('Actual electricity demand unknown');
          if (row.kind === 'storage') facts.push('Storage energy (MWh) unknown');
          if (row.approximateLocation) facts.push('Approximate source location' + (row.precision ? ': ' + row.precision.replace(/_/g,' ').toLowerCase() : ''));
          else facts.push(row.precision ? 'Source location tag: ' + row.precision.replace(/_/g,' ').toLowerCase() : 'Coordinate precision not supplied');
          text(entry.meta,facts.join(' · '));
          if (view.rows.children[index] !== entry.item) view.rows.insertBefore(entry.item,view.rows.children[index] || null);
        }
        for (const [key,entry] of view.records) if (!retained.has(key)) { entry.item.remove(); view.records.delete(key); }
      }
      panel.scrollTop = scroll;
    }
    function renderDocumentContext() {
      documentContext = documentContextFor(origin, {declaredConnections: NS.declaredConnections});
      const signature = JSON.stringify(documentContext); if (signature === documentSignature) return; documentSignature = signature;
      documentRows.replaceChildren();
      el('p', documentContext.matchedRecords?.length ? 'Existing published works context; source citations have not been revalidated in this release.' : 'No exact documentary works context is available for this asset.', documentRows);
      for (const row of (documentContext.matchedRecords || []).slice(0,10)) {
        const box = el('div', null, documentRows); el('strong', row.title || 'Existing source declaration', box);
        el('p', row.statement || '', box); el('p', 'Existing published declaration; not independently revalidated.', box); sourceAnchor(box, 'Source record', row.sourceUrl);
      }
      for (const row of (documentContext.unassociatedNotices || []).slice(0,5)) {
        const box = el('div', null, documentRows); el('strong', row.title || 'Unassociated official notice', box);
        el('p', row.statement || 'No verified association to the selected asset.', box); sourceAnchor(box, 'Official notice context', row.sourceUrl);
      }
      for (const text of documentContext.limitations || []) el('p', String(text), documentRows);
    }

    function readRecords() {
      let features = [];
      try {
        const data = map.getSource('src-subs')?.serialize?.().data;
        if (data?.type === 'FeatureCollection' && Array.isArray(data.features) && data.features.length) {
          contextSource = 'Existing loaded Atlas substation GeoJSON'; return stationRecords(data.features, geodesy);
        }
      } catch (_) {}
      try { if (map.getSource('src-subs')) features = map.querySourceFeatures('src-subs') || []; } catch (_) {}
      if (features.length) { contextSource = 'Loaded viewport subset of Atlas substations; use Fit radius to load this view'; return stationRecords(features, geodesy); }
      const loaded = W.__GRIDATLAS_NEON_LINKS__?.substations || W.__GRIDATLAS_SUBSTATIONS__ || [];
      if (loaded.length) {
        contextSource = 'Loaded Atlas ≥33 kV screening subset; lower voltages are not included';
        return stationRecords(loaded.map(row => ({type: 'Feature', id: row.id ?? undefined, geometry: {type: 'Point', coordinates: row.at},
          properties: {name: row.name, operator: row.operator, kv: (row.kv || []).join(';'), source: row.source || 'Existing Atlas screening subset'}})), geodesy);
      }
      contextSource = 'Substation layer is not loaded yet'; return [];
    }
    function draw() {
      if (!opened || !result || !alive) return;
      try {
        let current = map.getSource(SOURCE);
        if (current && current !== source) { sourceUnavailable = true; return; }
        for (const id of LAYERS) {
          const existing = map.getLayer(id);
          if (existing && existing !== ownedLayers.get(id)) { sourceUnavailable = true; showError('A map layer ID is already in use. Results remain available; existing layers were preserved.'); return; }
        }
        if (!current) { map.addSource(SOURCE, {type: 'geojson', data: {type: 'FeatureCollection', features: []}}); source = map.getSource(SOURCE); }
        sourceUnavailable = false;
        const specs = [
          {id: LAYERS[0], type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'radius'], paint: {'line-color': '#0ff', 'line-width': 1.5, 'line-dasharray': [3,3], 'line-opacity': 0.8}},
          {id: LAYERS[1], type: 'circle', source: SOURCE, filter: ['in', ['get', 'kind'], ['literal', ['origin','substation']]], paint: {'circle-color': ['case', ['==', ['get', 'kind'], 'origin'], '#ff4fd8', ['get', 'colour']], 'circle-radius': ['case', ['==', ['get', 'kind'], 'origin'], 8, 5], 'circle-stroke-color': '#020809', 'circle-stroke-width': 1.5}},
          {id: LAYERS[2], type: 'line', source: SOURCE, filter: ['==', ['get', 'kind'], 'user-model'], paint: {'line-color': '#ff4fd8', 'line-width': 3, 'line-dasharray': [2,3]}}
        ];
        for (const spec of specs) if (!map.getLayer(spec.id)) { map.addLayer(spec); ownedLayers.set(spec.id, map.getLayer(spec.id)); }
        const data = vicinityGeoJSON(result, geodesy);
        if (itinerary.length > 1) data.features.push({type: 'Feature', properties: {kind: 'user-model', evidence: 'USER_ASSUMED_LOCAL_MODEL'}, geometry: {type: 'LineString', coordinates: itinerary.map(row => row.at)}});
        source.setData(data);
      } catch (e) { sourceUnavailable = true; failure.textContent = 'Map overlay not ready. Results remain available below.'; failure.hidden = false; }
    }
    function removeMap(mapRemoved = false) {
      if (!source || mapRemoved) { source = null; ownedLayers.clear(); return; }
      try {
        if (map.getSource(SOURCE) === source) {
          for (const id of [...LAYERS].reverse()) if (map.getLayer(id) && map.getLayer(id) === ownedLayers.get(id)) map.removeLayer(id);
          const foreignDependency = (map.getStyle()?.layers || []).some(layer => layer.source === SOURCE);
          if (!foreignDependency && map.getSource(SOURCE) === source) map.removeSource(SOURCE);
        }
      } catch (_) {}
      source = null; ownedLayers.clear();
    }
    function showError(message) { error = message; failure.textContent = message; failure.hidden = !message; }
    function clearNews() { newsBase = null; newsTopic = null; news.removeAttribute('href'); news.hidden = newsCaption.hidden = true; }
    function clearSelectedContext() { origin = null; result = null; assetContext = null; documentContext = null; assetSignature = stationSignature = documentSignature = null; categoryElements.clear(); list.replaceChildren(); energyRows.replaceChildren(); documentRows.replaceChildren(); news.hidden = newsCaption.hidden = true; removeMap(); }
    function updateModel() { modelStatus.textContent = itinerary.length ? `${itinerary.length} selected assets: ${itinerary.map(row => row.name).join(' → ')}. User-assumed joins.` : 'No assets added.'; undo.disabled = clear.disabled = !itinerary.length; }
    function addStation(row) {
      if (itinerary.length >= 20) { showError('This local model holds up to 20 assets. Undo or clear to make another choice.'); return; }
      if (itinerary.at(-1) === row || row.id && itinerary.at(-1)?.id === row.id && itinerary.at(-1)?.kind === row.kind) { showError('That asset is already the last choice.'); return; }
      itinerary.push({...row, at: row.at.slice()}); showError(null); updateModel(); draw();
    }
    function refresh() {
      if (!alive || !opened) return;
      if (!origin) { rangeLabel.textContent = `${radius} km radius`; slider.value = String(radius); return; }
      try {
        records = readRecords(); result = exploreVicinity({origin, radius, records, bands, geodesy});
        originLabel.textContent = `Origin: ${origin.name}${origin.id ? ' · source ID ' + origin.id : ''}`;
        if (newsBase) { news.href = newsContextHref(newsBase, origin, newsTopic); news.hidden = newsCaption.hidden = false; }
        rangeLabel.textContent = `${radius} km radius`; slider.value = String(radius);
        status.textContent = `${result.matching} matching mapped stations within ${radius} km · ${result.loadedRecords} loaded records. ${result.truncated ? 'Showing nearest 200. ' : ''}${contextSource}.`;
        const nextStationSignature = JSON.stringify(result);
        if (nextStationSignature !== stationSignature) {
          stationSignature = nextStationSignature; list.replaceChildren();
          for (const row of result.shown) {
          const item = el('li', row.name, list); el('span', `${row.km.toFixed(2)} km · ${row.kv.length ? row.kv.join(' / ') + ' kV' : 'Voltage not stated'}${row.operator ? ' · ' + row.operator : ''}`, item, {class: 'vic-row-meta'});
          const buttons = el('div', null, item, {class: 'vic-actions'});
          const recenter = el('button', 'Use as origin', buttons, {type: 'button', 'aria-label': 'Use ' + row.name + ' as origin'});
          const add = el('button', 'Add to my model', buttons, {type: 'button', 'aria-label': 'Add ' + row.name + ' to my model'});
          recenter.addEventListener('click', () => setOrigin({at: row.at, name: row.name, id: row.id, type: 'substation'}));
          add.addEventListener('click', () => addStation(row));
          }
        }
        renderAssetContext(); renderDocumentContext(); draw(); updateModel();
      } catch (e) { showError(e.message); }
    }
    function setOrigin(next) {
      try { const validated = normaliseOrigin(next); origin = validated; phase = 'READY'; selectionEpoch++; picking = false; pick.setAttribute('aria-pressed', 'false'); pick.textContent = 'Pick origin on map'; showError(null); refresh(); return true; }
      catch (e) { clearSelectedContext(); phase = 'REFUSED'; originLabel.textContent = 'Origin was not applied.'; showError(e.message); return false; }
    }
    function mapCentre() { const c = map.getCenter(); return {at: [c.lng, c.lat], type: 'map-centre', id: null, name: 'Chosen map centre'}; }
    function fitRadius() {
      if (!result) return;
      const points = vicinityGeoJSON(result, geodesy).features[0].geometry.coordinates;
      const lngs = points.map(p => p[0]), lats = points.map(p => p[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {padding: 32, duration: 0});
    }
    function installControls() {
      for (const host of [D.getElementById('scada-ui-container'), D.getElementById('fs-curtain-keys'), D.querySelector('#gridatlas-menu-bar-panel-4 .gm-panel-body')]) {
        if (!host || groups.some(g => g.parentNode === host)) continue;
        if (host.id === 'scada-ui-container' && !host.querySelector('input[data-layer-id]')) continue;
        if (host.id === 'fs-curtain-keys' && !host.querySelector('input[data-layer-id]')) continue;
        if (host.closest?.('#gridatlas-menu-bar-panel-4') && !NS.menuBar?.installed) continue;
        const group = el('div', null, host, {class: 'key-group', 'data-vicinity-group': 'true'}); group.style.gridColumn = '1/-1'; el('div', 'Vicinity familiarisation', group, {class: 'key-title'});
        const button = el('button', 'Explore nearby grid · 1–50 km', group, {type: 'button', class: 'map-ctrl-btn', 'aria-expanded': String(opened), 'aria-controls': panel.id});
        button.style.minHeight = '44px'; listen(button, 'click', event => { event.stopPropagation(); NS.menuBar?.closeAll?.(); open({}, button); }); groups.push(group); controls.push(button);
      }
    }
    function open(options = {}, invoker = null) {
      if (!alive) return false;
      returning = invoker || (D.activeElement && D.activeElement !== D.body && D.activeElement !== D.documentElement ? D.activeElement : launch); opened = true; panel.hidden = false; launch.setAttribute('aria-expanded', 'true'); for (const b of controls) b.setAttribute('aria-expanded', 'true');
      try {
        if (options.error) { clearSelectedContext(); phase = 'REFUSED'; originLabel.textContent = 'Journey link was not applied. Choose an origin to explore.'; status.textContent = ''; showError(options.error); close.focus(); return false; }
        let newsError = options.newsContextError || null;
        if (newsError) clearNews();
        else if (options.newsContextUrl !== undefined) {
          try { const base = validateNewsContextBase(options.newsContextUrl), topic = normaliseNewsTopic(options.newsTopic, options.origin); newsBase = base; newsTopic = topic; }
          catch (e) { clearNews(); newsError = 'News context link was not applied: ' + e.message; }
        }
        radius = radiusKm(options.radiusKm ?? radius);
        if (options.manual || !options.origin && !origin) {
          clearSelectedContext(); phase = 'CHOOSE_ORIGIN'; picking = false; pick.setAttribute('aria-pressed','false'); pick.textContent = 'Pick origin on map';
          originLabel.textContent = 'Choose an origin to begin.'; originPrecision.textContent = 'Use map centre or pick a point; no location is chosen automatically.';
          status.textContent = 'Choose a location, then explore the grid within your selected radius.'; refresh(); showError(newsError ? newsError + ' Choose a location to continue grid exploration.' : null); close.focus(); return true;
        }
        if (!setOrigin(options.origin || origin)) return false;
        try { W.__GRIDATLAS_NEON_LINKS__?.enableSubstationLayer?.(); } catch (_) {}
        refresh(); if (newsError) showError(newsError + ' Grid exploration continues.'); close.focus(); return true;
      } catch (e) { clearSelectedContext(); phase = 'REFUSED'; originLabel.textContent = 'Journey request was not applied. Choose a valid origin and radius.'; showError(e.message); close.focus(); return false; }
    }
    function shut() {
      if (!alive) return;
      opened = false; picking = false; panel.hidden = true; launch.setAttribute('aria-expanded', 'false'); for (const b of controls) b.setAttribute('aria-expanded', 'false');
      removeMap(); const candidate = returning?.isConnected && returning.getClientRects().length ? returning : D.getElementById('gridatlas-menu-bar-title-4') || launch; candidate.focus();
    }
    listen(launch, 'click', () => { opened ? shut() : open({}, launch); }); listen(close, 'click', shut);
    listen(centre, 'click', () => setOrigin(mapCentre())); listen(fit, 'click', fitRadius);
    listen(loadAssets, 'click', event => {
      event.stopPropagation();
      const ids = ['solar','solar_operational','solar_roof','wind','wind_onshore_operational','wind_offshore_operational','bess','bess_operational','biomass','tidal','hydrogen','hydro','flywheel','act','geothermal','caes'];
      const boxes = ids.map(id => D.querySelector(`#scada-ui-container input[data-layer-id="${id}"]`)).filter(Boolean);
      for (const box of boxes) if (!box.checked) box.click();
      NS.ukOfftakers?.setOn?.(true); refresh();
    });
    listen(physical, 'click', event => {
      event.stopPropagation();
      const boxes = ['400','275','220','132','66','subs'].map(id => D.querySelector(`#scada-ui-container input[data-layer-id="${id}"]`)).filter(Boolean);
      if (!boxes.length) { showError('Physical grid controls are loading. Try again when the map controls appear.'); return; }
      for (const box of boxes) if (!box.checked) box.click();
      showError(null); status.textContent = 'Existing physical grid layers switched on. Source-mapped corridors are context; crossings and proximity do not establish a connection.';
      fitRadius();
    });
    listen(pick, 'click', () => { picking = !picking; pick.setAttribute('aria-pressed', String(picking)); pick.textContent = picking ? 'Tap a point on the map' : 'Pick origin on map'; });
    listen(slider, 'input', () => { try { radius = radiusKm(slider.value); showError(null); refresh(); } catch (e) { showError(e.message); } });
    listen(undo, 'click', () => { itinerary.pop(); updateModel(); draw(); }); listen(clear, 'click', () => { itinerary.length = 0; updateModel(); draw(); });
    listen(panel, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); shut(); } });
    for (const type of ['click','dblclick','pointerdown','touchstart']) listen(panel, type, event => event.stopPropagation());
    const clicked = event => { if (opened && picking && event.lngLat) setOrigin({at: [event.lngLat.lng,event.lngLat.lat], name: 'Chosen map point', type: 'map-point', id: null}); };
    const sourced = event => { if (opened && (!event || ['src-subs','src-repd','gridatlas-offtakers'].includes(event.sourceId))) { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 100); } };
    const styled = () => { if (!map.getSource(SOURCE)) source = null; if (opened) refresh(); };
    const removed = () => destroy(true);
    map.on('click', clicked); map.on('sourcedata', sourced); map.on('style.load', styled); map.on('remove', removed);
    const onIntent = event => open(event.detail || {}); listen(W, 'gridatlas:vicinity-open', onIntent);
    const onCard = event => { if (event.detail?.origin && opened) setOrigin(event.detail.origin); }; listen(W, 'gridatlas:card-open', onCard);
    const observer = new MutationObserver(installControls); observer.observe(D.documentElement, {childList: true, subtree: true}); installControls();
    function destroy(mapRemoved = false) {
      if (!alive) return; alive = false; clearTimeout(refreshTimer); observer.disconnect(); listeners.forEach(off => off());
      map.off('click', clicked); map.off('sourcedata', sourced); map.off('style.load', styled); map.off('remove', removed); removeMap(mapRemoved);
      groups.forEach(g => g.remove()); root.remove();
    }
    return Object.freeze({open, close: shut, setOrigin, refresh, destroy, snapshot: () => ({alive, opened, phase, generation: VICINITY_GENERATION, radiusKm: radius,
      origin: origin ? {...origin,at: origin.at.slice()} : null, matching: result?.matching ?? null, shown: result?.shown.length ?? 0, loadedRecords: records.length,
      newsContextUrl: newsBase, newsHref: newsBase && origin ? newsContextHref(newsBase, origin, newsTopic) : null,
      assetContext: assetContext ? {...assetContext, categories: assetContext.categories.map(category => ({...category, rows: category.rows.map(({sourceRow, ...row}) => row)}))} : null,
      documentContext,
      selectedBands: [...bands], contextSource, sourceUnavailable, modelStations: itinerary.map(row => ({name: row.name, id: row.id, at: row.at.slice()})),
      modelEvidence: 'USER_ASSUMED_LOCAL_MODEL', realConnectionsInferred: 0, error, selectionEpoch})});
  }
  function mount(map = W.__GRIDATLAS_V9_MAP__) {
    if (controller?.snapshot().alive) return controller;
    if (!map?.getContainer) return null;
    controller = createController(map); return controller;
  }
  let tries = 0;
  function attach() {
    if (stopped) return;
    try {
      if (mount()) {
        if (pendingIntent) { controller.open(pendingIntent); pendingIntent = null; }
        else if (intentError) { controller.open({error: 'Journey link refused: ' + intentError}); intentError = null; }
        return;
      }
    } catch (e) { console.warn('[Vicinity]', e.message); }
    if (++tries < 240) timer = setTimeout(attach, 250);
  }
  NS.gridVicinity = Object.freeze({schema: 'gridatlas.vicinity.v1', generation: VICINITY_GENERATION, mount,
    open(options) { return mount()?.open(options); }, setOrigin(origin) { return mount()?.setOrigin(origin); },
    snapshot: () => controller?.snapshot() || {alive: false, opened: false, status: 'map-unavailable'},
    destroy() { stopped = true; clearTimeout(timer); controller?.destroy(); controller = null; }});
  attach();
}

})();
