// SV07: pure, explicit local interchange; no GPS, network or financial mutation.
const SCHEMA = 'ventus.satnav.geojson.v1';
const MAX = 20000;
const fail = msg => { throw new TypeError(msg); };
function point(p) {
  if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) fail('Expected WGS84 [longitude, latitude]');
  return [...p];
}
function points(a, min=0) {
  if (!Array.isArray(a) || a.length < min || a.length > MAX) fail('Invalid coordinate count');
  return a.map(point);
}
const same = (a,b) => a[0]===b[0] && a[1]===b[1];
function ring(a) {
  const r=points(a,4);
  if (!same(r[0],r.at(-1)) || new Set(r.slice(0,-1).map(p=>p.join(','))).size<3) fail('Expected closed polygon with three distinct vertices');
  return r;
}
function fix(f) {
  if (!f || !Number.isFinite(f.timestamp) || f.timestamp<0 || !Number.isFinite(f.accuracy) || f.accuracy<0) fail('Invalid measured fix metadata');
  return {coordinate:point(f.coordinate),timestamp:f.timestamp,accuracy:f.accuracy};
}
function track(a) {
  if(!Array.isArray(a)||a.length>MAX)fail('Invalid track count');
  const t=a.map(fix);
  if(t.some((f,i)=>i>0&&f.timestamp<t[i-1].timestamp))fail('Track timestamps not ordered');
  return t;
}
const feature=(role,type,coordinates,props={})=>({type:'Feature',geometry:{type,coordinates},properties:{role,...props}});
export function exportGeoJSON({pins=[],plannedRoute=null,perimeter=null,walkedTrack=[]}={}) {
  const features=points(pins).map((p,i)=>feature('waypoint','Point',p,{order:i}));
  if(plannedRoute!==null)features.push(feature('planned-route','LineString',points(plannedRoute,2)));
  if(perimeter!==null)features.push(feature('perimeter','Polygon',[ring(perimeter)]));
  const t=track(walkedTrack);
  // Separate point features preserve individual GPS fixes, including a single fix.
  for(const [i,f] of t.entries())features.push(feature('walked-fix','Point',f.coordinate,{order:i,timestamp:f.timestamp,accuracy:f.accuracy}));
  return {type:'FeatureCollection',schema:SCHEMA,features};
}
export function importGeoJSON(doc) {
  if(!doc||doc.type!=='FeatureCollection'||!Array.isArray(doc.features)||doc.features.length>2*MAX+2)fail('Expected bounded FeatureCollection');
  if(doc.schema!==undefined&&doc.schema!==SCHEMA)fail('Unsupported schema');
  const state={pins:[],plannedRoute:null,perimeter:null,walkedTrack:[]};
  const pins=[], fixes=[];
  for(const f of doc.features){
    if(f?.type!=='Feature'||!f.geometry)fail('Invalid feature');
    const {type,coordinates:c}=f.geometry;
    const p=f.properties??{};
    // Untagged standard features: Points are waypoints, never measured GPS fixes.
    const role=p.role??({Point:'waypoint',LineString:'planned-route',Polygon:'perimeter'}[type]);
    if(role==='waypoint'&&type==='Point')pins.push({order:p.order??pins.length,value:point(c)});
    else if(role==='planned-route'&&type==='LineString'&&state.plannedRoute===null)state.plannedRoute=points(c,2);
    else if(role==='perimeter'&&type==='Polygon'&&Array.isArray(c)&&c.length===1&&state.perimeter===null)state.perimeter=ring(c[0]);
    else if(role==='walked-fix'&&type==='Point')fixes.push({order:p.order,value:fix({coordinate:c,timestamp:p.timestamp,accuracy:p.accuracy})});
    else fail('Unsupported, duplicate or ambiguous feature');
  }
  function ordered(a){if(a.length>MAX)fail('Too many points');a.sort((x,y)=>x.order-y.order);if(a.some((v,i)=>v.order!==i))fail('Invalid point order');return a.map(v=>v.value);}
  state.pins=ordered(pins);state.walkedTrack=track(ordered(fixes));
  return state;
}
export function importGisRouteSnapshot(snapshot){
  if(snapshot?.schema!=='ventus.gis-route.v1'||snapshot.status!=='available'||snapshot.committed!==true||snapshot.route?.geometry?.type!=='LineString')fail('GIS route is not committed and available');
  const route=points(snapshot.route.geometry.coordinates,2);
  // Original manual route geometry is authoritative. Never modify source pins or financial metadata.
  return {pins:route.map(p=>[...p]),plannedRoute:route,perimeter:null,walkedTrack:[]};
}
