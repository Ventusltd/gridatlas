// SPDX-License-Identifier: Apache-2.0
// SV05: Pure local field-perimeter adapter; no GPS, routing or access authority.
// Source: atlas/parts/202609060254-ventus-corev8engine-polyzone-grabbable.js
// blob bd3287c17a42bf0bf08b1b75f1d023a5d53795ea. Inject canonical distanceKm.
// Local simple rings only, <=1000 vertices, latitudes within ±85°, no antimeridian.
export function buildPerimeter(vertices, maths) {
  const fail = code => { throw new Error(code); };
  if (!Array.isArray(vertices) || vertices.length < 3 || vertices.length > 1001) fail("INVALID_VERTEX_COUNT");
  const valid = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85;
  if (!vertices.every(valid)) fail("INVALID_COORDINATE");
  if (typeof maths?.distanceKm !== "function") fail("MISSING_DISTANCE_MATHS");
  const same = (a,b) => a[0] === b[0] && a[1] === b[1];
  const pts = vertices.map(p => p.slice());
  if (same(pts[0],pts.at(-1))) pts.pop();
  if (pts.length < 3 || pts.length > 1000) fail("INVALID_VERTEX_COUNT");
  if (new Set(pts.map(p => p.join(","))).size !== pts.length) fail("DUPLICATE_VERTEX");
  const lons = pts.map(p => p[0]);
  if (Math.max(...lons)-Math.min(...lons) >= 180) fail("UNSUPPORTED_LONGITUDE_SPAN");
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on = (a,b,c) => Math.min(a[0],b[0])<=c[0] && c[0]<=Math.max(a[0],b[0]) && Math.min(a[1],b[1])<=c[1] && c[1]<=Math.max(a[1],b[1]);
  const hit = (a,b,c,d) => {
    const x=cross(a,b,c), y=cross(a,b,d), z=cross(c,d,a), w=cross(c,d,b);
    return (x===0&&on(a,b,c))||(y===0&&on(a,b,d))||(z===0&&on(c,d,a))||(w===0&&on(c,d,b))||(Math.sign(x)*Math.sign(y)<0&&Math.sign(z)*Math.sign(w)<0);
  };
  const n=pts.length;
  for(let i=0;i<n;i++){
    const a=pts[(i+n-1)%n],b=pts[i],c=pts[(i+1)%n];
    if(cross(a,b,c)===0 && ((a[0]-b[0])*(c[0]-b[0])+(a[1]-b[1])*(c[1]-b[1])>0)) fail("BACKTRACKING_EDGE");
  }
  for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){
    if(i===0&&j===n-1) continue;
    if(hit(pts[i],pts[(i+1)%n],pts[j],pts[(j+1)%n])) fail("SELF_INTERSECTION");
  }
  // Adapted from GridAtlas polyzone _zoneDrawCalcArea: spherical area,
  // same 6378.137 km radius, subtract constant terms to reduce cancellation.
  const rad=Math.PI/180, R=6378.137, sin0=Math.sin(pts[0][1]*rad);
  let sum=0, perimeterM=0, exceedsFollowerSegmentLimit=false;
  for(let i=0;i<n;i++){
    const a=pts[i],b=pts[(i+1)%n];
    const km=maths.distanceKm(...a,...b);
    if(!Number.isFinite(km)||km<=0) fail("INVALID_EDGE_DISTANCE");
    perimeterM+=km*1000;
    if(km>1) exceedsFollowerSegmentLimit=true;
    sum+=(b[0]-a[0])*rad*((Math.sin(a[1]*rad)-sin0)+(Math.sin(b[1]*rad)-sin0));
  }
  const areaM2=Math.abs(sum)*R*R*500000;
  if(!Number.isFinite(areaM2)||areaM2<=0) fail("DEGENERATE_POLYGON");
  const closed=()=>[...pts.map(p=>p.slice()),pts[0].slice()];
  return {perimeterM,areaM2,areaHa:areaM2/10000,polygon:{type:"Polygon",coordinates:[closed()]},plannedWalk:{type:"LineString",coordinates:closed()},exceedsFollowerSegmentLimit,approximate:true,plannedOnly:true};
}
