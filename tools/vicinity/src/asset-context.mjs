/** Read-only context from existing Atlas source owners. No fetching or electrical inference. */
export const ASSET_CONTEXT_CATEGORIES = Object.freeze([
 ['generation','REPD generation context'],['storage','REPD storage context'],['datacentre','Data-centre listings'],
 ['conventional','Listed conventional power context'],['demand-context','Other potential demand context']
]);
const assetCoordinate = at => Array.isArray(at)&&at.length>=2&&at.slice(0,2).every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(at[0])<=180&&Math.abs(at[1])<=90&&(at[0]!==0||at[1]!==0);
const statedMw = value => {const v=value&&typeof value==='object'?value.value:value;if(typeof v!=='number'&&typeof v!=='string')return null;if(typeof v==='string'&&!/^\d+(?:\.\d+)?$/.test(v.trim()))return null;const n=Number(v);return Number.isFinite(n)&&n>0?n:null;};
const assetId = value => (typeof value==='string'||typeof value==='number')&&String(value).trim()&&String(value).length<=256?String(value).trim():null;
function assetPrecision(p){for(const [field,value]of[['location.precision',p.location?.precision],['coordinate_precision',p.coordinate_precision],['location_precision',p.location_precision]])if(typeof value==='string'&&value.trim())return{precision:value,precisionField:field,approximateLocation:/approx|centroid|postcode|settlement|area/i.test(value)};return{precision:null,precisionField:null,approximateLocation:false};}
export function collectAssetContext({map,registry={},origin,radiusKm,geodesy,limit=200}={}){
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
 try{const data=map?.getSource?.('src-repd')?.serialize?.().data;if(data?.type==='FeatureCollection'&&Array.isArray(data.features))features=data.features;}catch{/* Explicit NOT_LOADED below; no replacement fetch. */}
 if(features){
  for(const id of ['generation','storage'])Object.assign(get(id),{availability:'LOADED',source:'Existing loaded src-repd GeoJSON'});
  features.forEach((f,i)=>{
   const p=f?.properties||{},point=geodesy.representativePoint(f?.geometry),tech=String(p.tech||p.technology||p.technology_type||'Not stated');
   const category=/^(?:bess|battery(?: storage)?|storage|flywheel|caes)$/i.test(tech)?'storage':'generation';
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
