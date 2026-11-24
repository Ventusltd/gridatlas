// Coordinate contract: GeoJSON order [longitude, latitude], WGS84.
const modes = new Set(['compass','road_to_field','foot_survey','cable_trench']);
function coordinate(value,max) {
  if(typeof value!=='string'||!value.trim()||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) throw new Error('invalid coordinate');
  const n=Number(value); if(!Number.isFinite(n)||Math.abs(n)>max) throw new Error('coordinate out of range');return n;
}
export function parseDestination(search) {
  const p=new URLSearchParams(search);
  for(const k of ['latitude','longitude','to','name','mode','source','id']) if(p.getAll(k).length>1)throw new Error('duplicate '+k);
  const mode=p.get('mode')??'compass';if(!modes.has(mode))throw new Error('invalid mode');
  const lat=p.get('latitude'),lon=p.get('longitude'),legacy=p.get('to');
  if(legacy!==null&&(lat!==null||lon!==null))throw new Error('conflicting coordinates');
  let pair;
  if(legacy!==null){const a=legacy.split(',');if(a.length!==2)throw new Error('invalid legacy coordinates');pair=[coordinate(a[1],180),coordinate(a[0],90)];}
  else if(lat!==null||lon!==null)pair=[coordinate(lon,180),coordinate(lat,90)];
  else return null;
  const source=p.get('source'),id=p.get('id');
  if((source===null)!==(id===null)||source===''||id==='')throw new Error('incomplete asset identity');
  return {coordinates:pair,mode,name:p.get('name')??'',asset:source===null?null:{source,id},accessStatus:'unverified'};
}
export function buildDestination({coordinates,mode='compass',name='',asset=null}){
  if(!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite))throw new Error('invalid coordinates');
  const [lon,lat]=coordinates;if(Math.abs(lon)>180||Math.abs(lat)>90||!modes.has(mode))throw new Error('invalid destination');
  const p=new URLSearchParams({latitude:String(lat),longitude:String(lon),mode,name});
  if(asset!==null){if(typeof asset.source!=='string'||typeof asset.id!=='string'||!asset.source||!asset.id)throw new Error('invalid asset');p.set('source',asset.source);p.set('id',asset.id);}
  return '?'+p.toString();
}
