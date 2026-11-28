// SPDX-License-Identifier: Apache-2.0
// Local 2D WGS84 interchange only; no network, legal access, engineering accuracy or route calculation.
// Source: GIS SLD read-only ventus.gis-route.v1 snapshot contract.
export function normaliseGeoJSON(input) {
  const data=typeof input==="string"?JSON.parse(input):input;
  const fail=message=>{throw Error(message);};
  const MAX=20000;
  let count=0;
  const point=p=>{
    if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)fail("INVALID_WGS84_COORDINATE");
    if(++count>MAX)fail("COORDINATE_LIMIT");
    return p.slice();
  };
  const line=(p,min)=>{
    if(!Array.isArray(p)||p.length<min||p.length>MAX)fail("INVALID_COORDINATE_SEQUENCE");
    return p.map(point);
  };
  const feature=f=>{
    if(f?.type!=="Feature"||!f.geometry)fail("INVALID_FEATURE");
    const {type,coordinates}=f.geometry;
    const source=f.properties??{};
    if(typeof source!=="object"||Array.isArray(source))fail("INVALID_PROPERTIES");
    const role=source.satnavRole??({Point:"waypoint",LineString:"planned-route",Polygon:"perimeter"}[type]);
    const expected={"waypoint":"Point","planned-route":"LineString","perimeter":"Polygon","walked-track":"LineString"};
    if(!Object.hasOwn(expected,role)||expected[role]!==type)fail("UNSUPPORTED_GEOMETRY_OR_ROLE");
    let geometry,properties={satnavRole:role};
    if(typeof source.name==="string")properties.name=source.name.slice(0,200);
    if(type==="Point")geometry={type,coordinates:point(coordinates)};
    else if(type==="LineString")geometry={type,coordinates:line(coordinates,2)};
    else {
      if(!Array.isArray(coordinates)||coordinates.length!==1)fail("ONLY_SINGLE_RING_SUPPORTED");
      const ring=line(coordinates[0],4);
      const first=ring[0],last=ring[ring.length-1];
      if(first[0]!==last[0]||first[1]!==last[1])fail("RING_NOT_CLOSED");
      if(new Set(ring.slice(0,-1).map(p=>JSON.stringify(p))).size<3)fail("RING_TOO_FEW_DISTINCT_POINTS");
      geometry={type,coordinates:[ring]};
    }
    if(role==="walked-track"){
      for(const key of ["timestampMs","accuracyM"]){
        if(source[key]===undefined)continue;
        const values=source[key];
        if(!Array.isArray(values)||values.length!==geometry.coordinates.length||values.some(x=>x!==null&&(!Number.isFinite(x)||x<0)))fail("INVALID_TRACK_METADATA");
        if(key==="timestampMs"){
          let last=-Infinity;
          for(const t of values){if(t===null)continue;if(t<last)fail("NON_MONOTONIC_TRACK_TIMESTAMPS");last=t;}
        }
        properties[key]=values.slice();
      }
    }
    const result={type:"Feature",geometry,properties};
    if(typeof f.id==="string"&&f.id.length<=200)result.id=f.id;
    return result;
  };
  let features;
  if(data?.type==="FeatureCollection")features=data.features;
  else if(data?.type==="Feature")features=[data];
  else if(["Point","LineString","Polygon"].includes(data?.type))features=[{type:"Feature",geometry:data}];
  else fail("UNSUPPORTED_GEOJSON");
  if(!Array.isArray(features)||features.length>MAX)fail("FEATURE_LIMIT");
  const output=features.map(feature);
  const ids=output.filter(f=>f.id!==undefined).map(f=>f.id);
  if(new Set(ids).size!==ids.length)fail("DUPLICATE_FEATURE_ID");
  return {type:"FeatureCollection",features:output};
}

export function fromGisSnapshot(snapshot){
  if(snapshot?.schema!=="ventus.gis-route.v1"||snapshot.status!=="available"||snapshot.route?.geometry?.type!=="LineString")throw Error("GIS_ROUTE_UNAVAILABLE");
  const route={type:"Feature",geometry:snapshot.route.geometry,properties:{satnavRole:"planned-route"}};
  return normaliseGeoJSON(route);
}

export function exportGeoJSON(input){return JSON.stringify(normaliseGeoJSON(input),null,2);}
