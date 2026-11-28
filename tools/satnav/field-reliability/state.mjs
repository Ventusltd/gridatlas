// Pure field-state adapter: no watch, cache, DOM, or permission side effects.
// Inject pinned SatNav compass fixQuality. resumedAt is the epoch ms of foreground resumption.
// verifiedOfflineResources must mean an independently verified complete resource set, not navigator.onLine.
export function assessFieldState({tracking=false,hidden=false,resumedAt=null,fix=null,now=Date.now(),networkOnline=null,verifiedOfflineResources=false,permissionDenied=false}={},fixQuality){
  if(typeof fixQuality!=="function")throw new TypeError("canonical fixQuality required");
  if(!Number.isFinite(now)|| (resumedAt!==null&&!Number.isFinite(resumedAt)))throw new TypeError("invalid clock");
  const offline=networkOnline===false;
  const mapAvailability=offline?(verifiedOfflineResources===true?"verified-cache":"offline-unverified"):"not-verified";
  const quality=fixQuality(fix,now);
  let gpsState;
  if(permissionDenied)gpsState="denied";
  else if(!tracking)gpsState="stopped";
  else if(hidden)gpsState="background";
  else if(resumedAt!==null&&(!fix||!Number.isFinite(fix.timestampMs)||fix.timestampMs<resumedAt))gpsState="awaiting-resume-fix";
  else gpsState=quality;
  return {gpsState,showMeasuredFix:!hidden&&tracking&&!permissionDenied&&["usable","poor"].includes(gpsState),canGuide:gpsState==="usable",mapAvailability};
}
