// SPDX-License-Identifier: Apache-2.0
// Tracking only, not routing or authorisation. Inject the pinned canonical maths.
export function createRouteFollower(geometry,maths){
  const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
  if(geometry?.type!=="LineString"||!Array.isArray(geometry.coordinates)||geometry.coordinates.length<2||geometry.coordinates.length>20000||!geometry.coordinates.every(valid))throw Error("INVALID_LINE");
  const {distanceKm,distanceToSegmentKm,initialBearingDeg}=maths;
  const coords=geometry.coordinates.map(p=>p.slice()),segments=[];let total=0;
  for(let i=0;i<coords.length-1;i++){const a=coords[i],b=coords[i+1],length=distanceKm(...a,...b)*1000;if(!Number.isFinite(length)||length>1000)throw Error("SEGMENT_REQUIRES_DENSIFICATION");if(length>0){segments.push({a,b,length,start:total,index:i});total+=length;}}
  if(!segments.length)throw Error("EMPTY_ROUTE");
  return function locate(fix,nowMs){
    if(!valid([fix?.longitude,fix?.latitude])||!Number.isFinite(fix?.accuracyM)||fix.accuracyM<0||!Number.isFinite(fix?.timestampMs)||!Number.isFinite(nowMs))return {status:"invalid"};
    const age=nowMs-fix.timestampMs;if(age<0||age>10000)return {status:"stale"};
    if(fix.accuracyM>30)return {status:"uncertain",reason:"GPS_ACCURACY"};
    const hits=segments.map(s=>{const h=distanceToSegmentKm(fix.longitude,fix.latitude,...s.a,...s.b);return {s,h,distance:h.km*1000,progress:s.start+h.t*s.length};}).sort((a,b)=>a.distance-b.distance||a.s.index-b.s.index);
    const best=hits[0];
    if(hits.some(h=>h.distance<=best.distance+Math.max(5,fix.accuracyM)&&Math.abs(h.progress-best.progress)>Math.max(30,2*fix.accuracyM)))return {status:"uncertain",reason:"AMBIGUOUS_ROUTE_POSITION"};
    let signedCrossTrackM=null;
    if(best.h.t>0&&best.h.t<1){const direction=initialBearingDeg(...best.s.a,...best.s.b),offset=initialBearingDeg(...best.h.foot,fix.longitude,fix.latitude);signedCrossTrackM=best.distance<1e-6?0:Math.sign(Math.sin((offset-direction)*Math.PI/180))*best.distance;}
    return {status:"ok",segmentIndex:best.s.index,nearest:best.h.foot,offsetM:best.distance,signedCrossTrackM,progressM:best.progress,remainingM:Math.max(0,total-best.progress),totalM:total,offRoute:best.distance-fix.accuracyM>25,accuracyM:fix.accuracyM,fixAgeMs:age,trackingOnly:true};
  };
}
