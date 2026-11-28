// Session-only measured GPS recorder; inject pinned compass.fixQuality.
// No browser GPS watch, storage, upload, interpolation or access inference.
// Pause, rejected quality and signal gaps create separate segments.
export function createTrackRecorder({fixQuality,maxGapMs=10000,maxPoints=20000}={}){
  if(typeof fixQuality!=="function"||!Number.isFinite(maxGapMs)||maxGapMs<=0||!Number.isSafeInteger(maxPoints)||maxPoints<1)throw new TypeError("INVALID_TRACK_CONFIG");
  let status="idle",segments=[],count=0,lastTimestamp=null,split=true,rejected=0;
  const snapshot=()=>({schema:"ventus.satnav-track.v1",status,pointCount:count,rejected,segments:segments.map(s=>s.map(p=>({...p}))),kind:"measured_gps",accessStatus:"unverified"});
  function start(){if(status!=="idle")return false;status="recording";return true;}
  function pause(){if(status!=="recording")return false;status="paused";split=true;return true;}
  function resume(){if(status!=="paused")return false;status="recording";split=true;return true;}
  function stop(){if(!["recording","paused"].includes(status))return false;status="stopped";return true;}
  function ingest(fix,now=Date.now()){
    if(status!=="recording")return {accepted:false,reason:status};
    if(count>=maxPoints){stop();return {accepted:false,reason:"capacity"};}
    const quality=fixQuality(fix,now);
    if(quality!=="usable"){rejected++;split=true;return {accepted:false,reason:quality};}
    const {longitude,latitude,accuracyM,timestampMs}=fix;
    if(![longitude,latitude,accuracyM,timestampMs,now].every(Number.isFinite)||Math.abs(longitude)>180||Math.abs(latitude)>90||accuracyM<0||timestampMs>now){rejected++;split=true;return {accepted:false,reason:"invalid"};}
    if(lastTimestamp!==null&&timestampMs<=lastTimestamp){rejected++;return {accepted:false,reason:"nonmonotonic"};}
    if(split||lastTimestamp===null||timestampMs-lastTimestamp>maxGapMs)segments.push([]);
    segments[segments.length-1].push({longitude,latitude,accuracyM,timestampMs});count++;lastTimestamp=timestampMs;split=false;
    if(count===maxPoints)stop();
    return {accepted:true,reason:"usable"};
  }
  return Object.freeze({start,pause,resume,stop,ingest,snapshot});
}
