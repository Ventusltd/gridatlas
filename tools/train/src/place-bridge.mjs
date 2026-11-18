import {normaliseTrainStop,trainCoordinate} from './station-index.mjs';
/** Adapter to the existing gazetteer result shape. No provider fetch or station auto-selection. */
export function createPlaceBridge({resolve,index,geodesy}={}) {
  if(typeof resolve!=='function'||!index?.near||!index?.get||typeof geodesy?.distanceKm!=='function')throw new Error('Existing gazetteer resolver, station index and canonical geodesy are required.');
  let epoch=0,current=null;const offered=new Map();
  function invalidate(){epoch++;current=null;offered.clear();}
  return Object.freeze({invalidate,
    async lookup(label,{radiusKm=10,limit}={}) {
      invalidate();if(typeof label!=='string'||!label.trim())throw new Error('Type a place or postcode.');
      if(!Number.isInteger(radiusKm)||radiusKm<1||radiusKm>50)throw new Error('Choose a whole radius from 1 to 50 km.');
      const request=epoch;current={label,status:'RESOLVING',epoch:request};
      let raw;try{raw=await resolve(label);}catch(error){if(request!==epoch)return{stale:true,epoch:request};current={label,status:'FAILED',epoch:request,error:String(error?.message||error)};throw error;}
      if(request!==epoch)return{stale:true,epoch:request};
      const places=[];
      for(const [i,result]of (Array.isArray(raw)?raw:[]).entries()) {
        const at=result.at || [result.longitude,result.latitude];
        if(!trainCoordinate(at)||typeof result.provider!=='string'||!result.provider)continue;
        const place={label, resolvedLabel:String(result.label||label),at:at.slice(),provider:result.provider,precision:result.precision==null?null:String(result.precision),kind:String(result.kind||'location'),token:request+':'+i};
        const nearby=index.near(at,{radiusKm,limit});offered.set(place.token,{place,stationIds:new Set(nearby.rows.map(s=>s.stationId))});places.push({...place,at:place.at.slice(),nearby});
      }
      current={label,status:places.length?'CHOOSE_PLACE_AND_STATION':'NO_RESULTS',epoch:request};return{...current,places,stationAutomaticallySelected:false};
    },
    bind(token,stationId) {
      const choice=offered.get(token);if(!choice||!token.startsWith(epoch+':'))throw new Error('Place result is stale; search again.');
      if(!choice.stationIds.has(stationId))throw new Error('Explicitly choose a station offered within this place radius.');
      const station=index.get(stationId);if(!station)throw new Error('Station identity is unavailable or ambiguous.');
      const p=choice.place,distanceKm=geodesy.distanceKm(p.at[0],p.at[1],station.at[0],station.at[1]);
      return normaliseTrainStop({...station,place:{label:p.label,resolvedLabel:p.resolvedLabel,at:p.at,provider:p.provider,precision:p.precision,distanceKm}});
    },snapshot(){return current?{...current}:{status:'IDLE',epoch};}
  });
}


