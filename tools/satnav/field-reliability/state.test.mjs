// Run with Node; pass a local copy of the exact pinned compass module as first argument.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {assessFieldState} from './state.mjs';
function runTests(assess,quality){
 const fix={longitude:0,latitude:51,accuracyM:8,timestampMs:10000};
 const base={tracking:true,fix,now:10500};
 const cases=[
 ["usable",{}, "usable",true,true,"not-verified"],
 ["poor",{fix:{...fix,accuracyM:31}},"poor",true,false,"not-verified"],
 ["stale",{now:20001},"stale",false,false,"not-verified"],
 ["future",{now:9999},"stale",false,false,"not-verified"],
 ["invalid",{fix:{...fix,latitude:91}},"invalid",false,false,"not-verified"],
 ["missing",{fix:null},"missing",false,false,"not-verified"],
 ["stopped",{tracking:false},"stopped",false,false,"not-verified"],
 ["denied",{permissionDenied:true},"denied",false,false,"not-verified"],
 ["hidden",{hidden:true},"background",false,false,"not-verified"],
 ["resume old",{resumedAt:10100},"awaiting-resume-fix",false,false,"not-verified"],
 ["resume fresh",{resumedAt:10000},"usable",true,true,"not-verified"],
 ["resume poor",{resumedAt:10000,fix:{...fix,accuracyM:31}},"poor",true,false,"not-verified"],
 ["offline GPS independent",{networkOnline:false},"usable",true,true,"offline-unverified"],
 ["verified cache",{networkOnline:false,verifiedOfflineResources:true},"usable",true,true,"verified-cache"],
 ["online not proof",{networkOnline:true,verifiedOfflineResources:true},"usable",true,true,"not-verified"]
 ];
 for(const [name,over,gpsState,showMeasuredFix,canGuide,mapAvailability] of cases){
 const actual=assess({...base,...over},quality),expected={gpsState,showMeasuredFix,canGuide,mapAvailability};
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(name+": "+JSON.stringify(actual));
 }
 return cases.length;
}
if(!process.argv[2])throw new Error('Supply local pinned SatNav nav/compass.mjs path');
const {fixQuality}=await import(pathToFileURL(resolve(process.argv[2])).href);
console.log(runTests(assessFieldState,fixQuality)+' field state cases passed');
