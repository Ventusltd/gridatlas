/**
 * Build F (UNPUBLISHED, EXPERIMENTAL): optically observed flash tap bridge.
 *
 * This is a separate adapter, not a replacement for the GridAtlas E overlay.
 * Overlay source "gridatlas-lightning" and data are owned by the immutable
 * candidate, and this creates only its own hit-target layer in a future
 * standalone explorer. No grid calculation, duplicate geodesy or risk score.
 */
export const BUILD_F_SCHEMA='gridatlas.lightning-tap-bridge.v1';
export const SOURCE='gridatlas-lightning';
export const HIT_LAYER='l-gridatlas-lightning-tap-hit';
const VALID_BOX={west:-11,east:3,south:49.5,north:61.5};
const isFiniteNumber=n=>typeof n==='number'&&Number.isFinite(n);
function validateOpticalFeature(feature){
  if(!feature||feature.type!=='Feature'||feature.geometry?.type!=='Point'
     ||!Array.isArray(feature.geometry.coordinates))throw new TypeError('Optical Point required');
  const [lon,lat]=feature.geometry.coordinates;
  if(!isFiniteNumber(lon)||!isFiniteNumber(lat)
     ||lon<VALID_BOX.west||lon>VALID_BOX.east
     ||lat<VALID_BOX.south||lat>VALID_BOX.north)
    throw new RangeError('Optical coordinate outside stated collection bounds');
  if(feature.properties?.observation_kind!=='optical_lightning_flash')
    throw new TypeError('No authenticated optical flash');
  const id=feature.id;
  if(id===null||id===undefined||!String(id).trim())throw new TypeError('Missing genuine source ID');
  const t=Date.parse(feature.properties?.time_utc);
  if(!Number.isFinite(t))throw new TypeError('Missing real UTC observation time');
  return Object.freeze({
    id:String(id),lon,lat,time_utc:new Date(t).toISOString(),
    observation_kind:'optical_lightning_flash',
    source:'EUMETSAT MTG LI L2-LFL',
    caveat:'Optical detection, NOT a measured cloud-to-ground strike or asset fault'
  });
}
export {validateOpticalFeature};

/**
 * Mount ONLY in a standalone experimental page after the original map exists.
 * The source may be unavailable until the OFF-by-default Lightning layer is ON.
 * A transparent 22 CSS-pixel radius hit layer gives >=44px circular diameter.
 * An independent consumer receives validated optical event, never an REPD ID.
 *
 * Cluster click requires expanding to an individual feature; the map's click
 * handler MUST NOT fabricate a single flash from a cluster's centroid.
 */
export function attachLightningHitTargets(map,{
  onFlash=()=>{},onCluster=()=>{},onError=()=>{},radiusPx=22
}={}){
  if(!map||typeof map.on!=='function'||typeof map.getSource!=='function'
     ||typeof map.addLayer!=='function'||typeof map.getLayer!=='function')
    throw new TypeError('MapLibre map with layer/source APIs required');
  if(!Number.isFinite(radiusPx)||radiusPx<22||radiusPx>48)
    throw new RangeError('Tap diameter must be at least 44 CSS px');
  let disposed=false,installed=false,selectionEpoch=0;
  const install=()=>{
    if(disposed)return false;
    if(!map.getSource(SOURCE))return false;
    if(map.getLayer(HIT_LAYER)){installed=true;return true}
    try{
      map.addLayer({
        id:HIT_LAYER,type:'circle',source:SOURCE,
        layout:{visibility:'visible'},
        paint:{
          'circle-radius':radiusPx,
          'circle-color':'#fff',
          'circle-opacity':0.01,
          'circle-stroke-opacity':0
        },
        metadata:{purpose:'accessible optical detection pointer hit region; NOT physical footprint'}
      });
      installed=true;return true;
    }catch(error){onError(error);return false}
  };
  const click=e=>{
    if(disposed)return;
    const feature=e?.features?.[0];
    if(!feature)return;
    const epoch=++selectionEpoch;
    if(feature.properties?.cluster===true||feature.properties?.cluster==='true'
       ||feature.properties?.point_count>1){
      onCluster({cluster_id:feature.properties?.cluster_id??null,
        point_count:Number(feature.properties?.point_count)||null,epoch,
        note:'Multiple optical flashes; choose an individual observation to model'});
      return;
    }
    try{
      const observation=validateOpticalFeature(feature);
      onFlash({observation,epoch,layer:HIT_LAYER});
    }catch(error){onError(error)}
  };
  const poll=()=>install();
  map.on('sourcedata',poll);
  map.on('styledata',poll);
  // MapLibre dispatches layer-specific click only when that layer is present.
  map.on('click',HIT_LAYER,click);
  install();
  return Object.freeze({
    refresh:()=>install(),
    get installed(){return installed&&!disposed&&!!map.getLayer(HIT_LAYER)},
    get epoch(){return selectionEpoch},
    destroy(){
      if(disposed)return;
      disposed=true;++selectionEpoch;
      map.off?.('click',HIT_LAYER,click);
      map.off?.('sourcedata',poll);
      map.off?.('styledata',poll);
      if(map.getLayer(HIT_LAYER))map.removeLayer?.(HIT_LAYER);
    }
  });
}
