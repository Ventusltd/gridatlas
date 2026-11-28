/* SV02 isolated waypoint state. Adapted ordered add/pop behaviour from Ventusltd/gis-sld-sandbox release 202609052024 gis-sld-v5-ui.js and frozen snapshot convention from src/gis-sld/route-state.js. No GPS, distance, route legality, DOM or network dependencies. */
export function createWaypointState({maxPins=20000,maxUndo=256}={}) {
  if(!Number.isSafeInteger(maxPins)||maxPins<2||!Number.isSafeInteger(maxUndo)||maxUndo<1)throw new RangeError('Invalid limits');
  const pins=[],history=[]; let nextId=1;
  const coordinate=at=>{
    if(!Array.isArray(at)||at.length!==2||!Number.isFinite(at[0])||!Number.isFinite(at[1])||Math.abs(at[0])>180||Math.abs(at[1])>90)throw new RangeError('Expected WGS84 [longitude, latitude]');
    return Object.freeze([...at]);
  };
  const indexOf=id=>{const i=pins.findIndex(p=>p.id===id);if(i<0)throw new RangeError('Unknown waypoint');return i;};
  const checkIndex=(i,max)=>{if(!Number.isInteger(i)||i<0||i>max)throw new RangeError('Invalid waypoint index');};
  const record=fn=>{history.push(fn);if(history.length>maxUndo)history.shift();};
  const snapshot=()=>Object.freeze({schema:'ventus.satnav-waypoints.v1',status:pins.length>=2?'ready':pins.length?'draft':'empty',pins:Object.freeze(pins.slice()),canUndo:history.length>0,maxPins});
  const add=(at,index=pins.length)=>{
    checkIndex(index,pins.length);if(pins.length>=maxPins)throw new RangeError('Waypoint limit reached');
    const position=coordinate(at);
    const pin=Object.freeze({id:'wp-'+nextId++,coordinate:position});
    pins.splice(index,0,pin);record(()=>pins.splice(index,1));return pin.id;
  };
  const replace=(id,at)=>{
    const i=indexOf(id),position=coordinate(at),old=pins[i];
    if(old.coordinate.every((v,j)=>v===position[j]))return false;
    pins[i]=Object.freeze({id,coordinate:position});record(()=>{pins[i]=old;});return true;
  };
  const remove=id=>{
    const i=indexOf(id),old=pins[i];pins.splice(i,1);record(()=>pins.splice(i,0,old));return true;
  };
  const move=(id,to)=>{
    const from=indexOf(id);checkIndex(to,pins.length-1);if(from===to)return false;
    const [pin]=pins.splice(from,1);pins.splice(to,0,pin);
    record(()=>{pins.splice(to,1);pins.splice(from,0,pin);});return true;
  };
  const undo=()=>{const inverse=history.pop();if(!inverse)return false;inverse();return true;};
  return Object.freeze({add,replace,remove,move,undo,snapshot});
}
