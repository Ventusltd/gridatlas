import { normaliseGeoJSON, fromGisSnapshot, exportGeoJSON } from "./geojson.mjs";
function runTests(normaliseGeoJSON,fromGisSnapshot,exportGeoJSON){
  const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error("ASSERT_EQUAL");};
  const reject=(fn,msg)=>{try{fn();}catch(e){if(e.message===msg)return;throw e;}throw Error("EXPECTED "+msg);};
  const f=(type,coordinates,properties={})=>({type:"Feature",geometry:{type,coordinates},properties});
  const coords=[[-0.3,51.5],[-0.31,51.51]];
  const track=f("LineString",coords,{satnavRole:"walked-track",timestampMs:[100,200],accuracyM:[5,null],untrusted:"discard"});
  const route=f("LineString",coords,{name:"Cable design"});
  const perimeter=f("Polygon",[[[0,0],[1,0],[1,1],[0,0]]]);
  const point=f("Point",coords[0]);
  const collection={type:"FeatureCollection",features:[point,route,perimeter,track]};
  const tests=[
    ()=>eq(normaliseGeoJSON(collection).features.map(x=>x.properties.satnavRole),["waypoint","planned-route","perimeter","walked-track"]),
    ()=>eq(normaliseGeoJSON(exportGeoJSON(collection)),normaliseGeoJSON(collection)),
    ()=>eq(normaliseGeoJSON(track).features[0].properties,{satnavRole:"walked-track",timestampMs:[100,200],accuracyM:[5,null]}),
    ()=>{const a=normaliseGeoJSON(collection);a.features[0].geometry.coordinates[0]=9;eq(point.geometry.coordinates[0],-0.3);},
    ()=>eq(fromGisSnapshot({schema:"ventus.gis-route.v1",status:"available",route}).features[0].geometry,route.geometry),
    ()=>reject(()=>fromGisSnapshot({schema:"ventus.gis-route.v1",status:"editing",route}),"GIS_ROUTE_UNAVAILABLE"),
    ()=>reject(()=>normaliseGeoJSON(f("Point",[181,0])),"INVALID_WGS84_COORDINATE"),
    ()=>reject(()=>normaliseGeoJSON(f("Point",[0,NaN])),"INVALID_WGS84_COORDINATE"),
    ()=>reject(()=>normaliseGeoJSON(f("Point",[0,0,10])),"INVALID_WGS84_COORDINATE"),
    ()=>reject(()=>normaliseGeoJSON(f("Polygon",[[[0,0],[1,0],[1,1],[0,1]]])),"RING_NOT_CLOSED"),
    ()=>reject(()=>normaliseGeoJSON(f("Polygon",[[[0,0],[1,0],[1,0],[0,0]]])),"RING_TOO_FEW_DISTINCT_POINTS"),
    ()=>reject(()=>normaliseGeoJSON(f("Polygon",[perimeter.geometry.coordinates[0],perimeter.geometry.coordinates[0]])),"ONLY_SINGLE_RING_SUPPORTED"),
    ()=>reject(()=>normaliseGeoJSON(f("Point",[0,0],{satnavRole:"walked-track"})),"UNSUPPORTED_GEOMETRY_OR_ROLE"),
    ()=>reject(()=>normaliseGeoJSON(f("LineString",coords,{satnavRole:"walked-track",timestampMs:[200,100]})),"NON_MONOTONIC_TRACK_TIMESTAMPS"),
    ()=>reject(()=>normaliseGeoJSON(f("LineString",coords,{satnavRole:"walked-track",accuracyM:[5]})),"INVALID_TRACK_METADATA"),
    ()=>reject(()=>normaliseGeoJSON(f("LineString",coords,{satnavRole:"walked-track",accuracyM:[-1,2]})),"INVALID_TRACK_METADATA"),
    ()=>eq(normaliseGeoJSON(f("LineString",coords,{satnavRole:"walked-track"})).features[0].properties,{satnavRole:"walked-track"}),
    ()=>reject(()=>normaliseGeoJSON({type:"FeatureCollection",features:[{...point,id:"a"},{...point,id:"a"}]}),"DUPLICATE_FEATURE_ID"),
    ()=>reject(()=>normaliseGeoJSON(f("LineString",Array.from({length:20001},()=>[0,0]))),"INVALID_COORDINATE_SEQUENCE"),
    ()=>eq(normaliseGeoJSON({type:"Point",coordinates:[0,0]}).features[0].properties,{satnavRole:"waypoint"}),
    ()=>reject(()=>normaliseGeoJSON(f("Point",[0,0],{satnavRole:"__proto__"})),"UNSUPPORTED_GEOMETRY_OR_ROLE"),
  ];
  tests.forEach((t,i)=>{try{t();}catch(e){throw Error(`Test ${i+1}: ${e.message}`);}});
  return tests.length;
}
console.log(`${runTests(normaliseGeoJSON,fromGisSnapshot,exportGeoJSON)} tests passed`);
