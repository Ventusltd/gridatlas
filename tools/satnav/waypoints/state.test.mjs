import { createWaypointState } from './state.mjs';
function runTests(createWaypointState) {
  let count=0;
  const eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('Expected '+JSON.stringify(b)+'; got '+JSON.stringify(a));};
  const reject=fn=>{let caught=false;try{fn();}catch(e){caught=e instanceof RangeError;}if(!caught)throw new Error('Expected RangeError');};
  const test=(name,fn)=>{fn();count++;};
  test('empty draft ready and ordered ids',()=>{const s=createWaypointState();eq(s.snapshot().status,'empty');s.add([0,0]);eq(s.snapshot().status,'draft');s.add([1,1]);eq(s.snapshot().status,'ready');eq(s.snapshot().pins.map(p=>p.id),['wp-1','wp-2']);});
  test('insert before destination',()=>{const s=createWaypointState();const a=s.add([0,0]),b=s.add([2,2]),c=s.add([1,1],1);eq(s.snapshot().pins.map(p=>p.id),[a,c,b]);s.undo();eq(s.snapshot().pins.map(p=>p.id),[a,b]);});
  test('replace stable identity and opposite endpoint',()=>{const s=createWaypointState();const a=s.add([0,0]),b=s.add([1,1]);s.replace(a,[2,2]);eq(s.snapshot().pins,[{id:a,coordinate:[2,2]},{id:b,coordinate:[1,1]}]);s.undo();eq(s.snapshot().pins[0].coordinate,[0,0]);});
  test('remove restore same id',()=>{const s=createWaypointState();const a=s.add([0,0]),b=s.add([1,1]);s.remove(a);eq(s.snapshot().status,'draft');s.undo();eq(s.snapshot().pins.map(p=>p.id),[a,b]);});
  test('move both directions and undo',()=>{const s=createWaypointState();const a=s.add([0,0]),b=s.add([1,1]),c=s.add([2,2]);s.move(a,2);eq(s.snapshot().pins.map(p=>p.id),[b,c,a]);s.move(a,0);eq(s.snapshot().pins.map(p=>p.id),[a,b,c]);s.undo();s.undo();eq(s.snapshot().pins.map(p=>p.id),[a,b,c]);});
  test('invalid edits atomic',()=>{const s=createWaypointState();const a=s.add([0,0]);const before=s.snapshot();for(const at of [[181,0],[0,91],[NaN,0],[0,0,0],null])reject(()=>s.add(at));reject(()=>s.replace(a,[0,Infinity]));reject(()=>s.move(a,1));reject(()=>s.remove('missing'));reject(()=>s.add([1,1],-1));eq(s.snapshot(),before);});
  test('snapshot immutable and no input alias',()=>{const s=createWaypointState(),at=[0,0];s.add(at);const snap=s.snapshot();at[0]=7;s.add([1,1]);eq(snap.pins.length,1);eq(snap.pins[0].coordinate,[0,0]);if(!Object.isFrozen(snap)||!Object.isFrozen(snap.pins)||!Object.isFrozen(snap.pins[0])||!Object.isFrozen(snap.pins[0].coordinate))throw Error('Not frozen');});
  test('no-op not recorded',()=>{const s=createWaypointState();const a=s.add([0,0]);eq(s.replace(a,[0,0]),false);eq(s.move(a,0),false);eq(s.undo(),true);eq(s.snapshot().status,'empty');eq(s.undo(),false);});
  test('ids never recycled on undo',()=>{const s=createWaypointState();const a=s.add([0,0]);s.undo();if(s.add([0,0])===a)throw Error('Recycled id');});
  test('capacity and undo bound',()=>{const s=createWaypointState({maxPins:2,maxUndo:1});s.add([0,0]);s.add([1,1]);reject(()=>s.add([2,2]));eq(s.undo(),true);eq(s.undo(),false);eq(s.snapshot().pins.length,1);});
  test('many pins and independent instances',()=>{const s=createWaypointState(),other=createWaypointState();for(let i=0;i<1000;i++)s.add([i/1000,51]);eq(s.snapshot().pins.length,1000);eq(other.snapshot().pins.length,0);for(let i=0;i<256;i++)eq(s.undo(),true);eq(s.snapshot().pins.length,744);eq(s.undo(),false);});
  test('mixed action undo',()=>{const s=createWaypointState();const a=s.add([0,0]),b=s.add([1,1]),c=s.add([2,2]);const before=s.snapshot().pins;s.move(c,0);s.replace(b,[3,3]);s.remove(a);s.add([4,4],1);for(let i=0;i<4;i++)eq(s.undo(),true);eq(s.snapshot().pins,before);});
  return count;
}
console.log(`${runTests(createWaypointState)} waypoint cases passed`);
