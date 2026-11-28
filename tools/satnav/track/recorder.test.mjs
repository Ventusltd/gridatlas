import assert from 'node:assert/strict';
import {createTrackRecorder} from './recorder.mjs';
function runTests(createTrackRecorder,assert){
  const fixQuality=(f,n)=>!f?"missing":!Number.isFinite(f.longitude)?"invalid":n-f.timestampMs<0||n-f.timestampMs>10000?"stale":f.accuracyM>30?"poor":"usable";
  const fix=(t,accuracyM=5,longitude=-0.3)=>({longitude,latitude:51.5,accuracyM,timestampMs:t});
  const tests=[
    ["explicit opt-in",()=>{const r=createTrackRecorder({fixQuality});assert(!r.ingest(fix(1),1).accepted);assert(r.start());assert(r.ingest(fix(2),2).accepted);assert(r.snapshot().pointCount===1)}],
    ["pause/resume gap",()=>{const r=createTrackRecorder({fixQuality});r.start();r.ingest(fix(1),1);r.pause();assert(!r.ingest(fix(2),2).accepted);r.resume();r.ingest(fix(3),3);assert(r.snapshot().segments.length===2)}],
    ["poor and stale fixes split",()=>{const r=createTrackRecorder({fixQuality});r.start();r.ingest(fix(1),1);assert(r.ingest(fix(2,31),2).reason==="poor");assert(r.ingest(fix(3),20000).reason==="stale");r.ingest(fix(4),4);assert(r.snapshot().segments.length===2);assert(r.snapshot().rejected===2)}],
    ["missing and invalid fixes",()=>{const r=createTrackRecorder({fixQuality});r.start();assert(!r.ingest(null,1).accepted);assert(!r.ingest(fix(2,5,181),2).accepted);assert(r.snapshot().pointCount===0)}],
    ["signal gap",()=>{const r=createTrackRecorder({fixQuality});r.start();r.ingest(fix(1),1);r.ingest(fix(10002),10002);assert(r.snapshot().segments.length===2)}],
    ["duplicate or out-of-order",()=>{const r=createTrackRecorder({fixQuality});r.start();r.ingest(fix(2),2);assert(!r.ingest(fix(2),2).accepted);assert(!r.ingest(fix(1),2).accepted);assert(r.snapshot().pointCount===1)}],
    ["stop rejects later callbacks",()=>{const r=createTrackRecorder({fixQuality});r.start();r.ingest(fix(1),1);r.stop();assert(!r.ingest(fix(2),2).accepted);assert(!r.resume());assert(!r.start());assert(r.snapshot().status==="stopped")}],
    ["immutable snapshot boundary and exact measured coordinates",()=>{const r=createTrackRecorder({fixQuality});r.start();const f=fix(1);r.ingest(f,1);f.longitude=0;const s=r.snapshot();s.segments[0][0].longitude=1;assert(r.snapshot().segments[0][0].longitude===-0.3)}],
    ["capacity bound",()=>{const r=createTrackRecorder({fixQuality,maxPoints:2});r.start();r.ingest(fix(1),1);r.ingest(fix(2),2);assert(r.snapshot().status==="stopped");assert(!r.ingest(fix(3),3).accepted);assert(r.snapshot().pointCount===2)}],
    ["independent recorder sessions",()=>{const a=createTrackRecorder({fixQuality}),b=createTrackRecorder({fixQuality});a.start();a.ingest(fix(1),1);assert(b.snapshot().pointCount===0)}]
  ];
  for(const [name,test] of tests){try{test()}catch(e){throw Error(name+": "+e.message)}}
  return tests.map(([name])=>name);
}
console.log(runTests(createTrackRecorder,assert).length+' tests passed');
