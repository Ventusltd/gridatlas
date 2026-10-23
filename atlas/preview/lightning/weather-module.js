/**
 * Public UK Lightning, isolated from the immutable 60+3 control contract.
 * EUMETSAT Meteosat LI L2 optical flashes; NOT confirmed ground strikes.
 *
 * This module NEVER edits ukConfig, the engine's 60 layer controls, the three
 * Pipeline News controls, or their delegated click/keyboard handlers.
 * It waits until GridAtlas installs its own menu, then adds a separate toggle
 * inside Grid and one standard MapLibre GeoJSON point source.
 */
(() => {
  'use strict';
  const DATA_URL='https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson';
  const SOURCE='src-uk_lightning';
  const LAYER='l-uk_lightning';
  const PREFIX='weather:uk_lightning';
  const PANEL='#gridatlas-menu-bar-panel-4 .gm-panel-body';
  const state={schema:'gridatlas.uk-weather-lightning.v2',installed:false,status:'WAIT',
    source:DATA_URL,features:0,source_type:'EUMETSAT satellite optical flashes',
    observations_are_ground_strikes:false,errors:[]};
  window.__GRIDATLAS_WEATHER_LIGHTNING__=state;

  function install() {
    if(state.installed)return true;
    const map=window.__GRIDATLAS_V9_MAP__;
    const menu=window.__GRIDATLAS_MODULES__?.menuBar;
    const body=document.querySelector(PANEL);
    if(!map||!menu?.installed||!body||!map.isStyleLoaded())return false;
    if(!map.getSource(SOURCE)){
      map.addSource(SOURCE,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    }
    if(!map.getLayer(LAYER)){
      map.addLayer({
        id:LAYER,type:'circle',source:SOURCE,
        layout:{visibility:'none'},
        paint:{
          'circle-color':'#ffdf44',
          'circle-radius':['interpolate',['linear'],['zoom'],4,3,9,5,14,8],
          'circle-stroke-width':1.2,
          'circle-stroke-color':'#251800',
          'circle-opacity':0.95
        }
      });
    }

    // The GridAtlas menu's fixed 60+3 inventory was validated BEFORE this
    // module runs. This toggle has NO data-layer-id or data-pn-layer.
    const group=document.createElement('div');
    group.className='gm-layer-group';
    group.textContent='Weather (GeoJSON)';
    group.setAttribute('data-weather-group','uk_lightning');
    const label=document.createElement('label');
    label.className='gm-layer';
    label.setAttribute('data-gridatlas-layer-key',PREFIX);
    const input=document.createElement('input');
    input.id='gridatlas-weather-lightning-toggle';
    input.type='checkbox';
    input.setAttribute('data-gridatlas-layer-proxy',PREFIX);
    input.setAttribute('data-weather-layer','uk_lightning');
    input.setAttribute('aria-label','Lightning (satellite flashes)');
    const box=document.createElement('span');
    box.className='gm-layer-box';
    box.setAttribute('aria-hidden','true');
    const title=document.createElement('span');
    title.className='gm-layer-name';
    title.id='lbl-uk_lightning';
    title.textContent='Lightning (satellite flashes) [WAIT]';
    label.append(input,box,title);
    // Front-load the public Weather overlay so it is visible immediately
    // when Grid opens on desktop and phone, without scrolling through 63 layers.
    // These independent nodes do not alter any original input or handler.
    body.prepend(group,label);

    function status(word,details) {
      state.status=word;
      title.textContent='Lightning (satellite flashes) ['+word+']'+(details?' '+details:'');
      input.setAttribute('aria-label',title.textContent);
    }
    let loaded=false;
    let loading=null;
    async function hydrate() {
      if(loaded)return;
      if(loading)return loading;
      status('LOAD');
      loading=(async()=>{
        const response=await fetch(DATA_URL,{cache:'no-store'});
        if(!response.ok)throw new Error('lightning GeoJSON HTTP '+response.status);
        const data=await response.json();
        if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
          throw new Error('lightning feed is not a GeoJSON FeatureCollection');
        const features=data.features.filter(f=>f?.type==='Feature'
          && f.geometry?.type==='Point'
          && Array.isArray(f.geometry.coordinates)
          && f.geometry.coordinates.length>=2
          && f.geometry.coordinates.slice(0,2).every(Number.isFinite));
        map.getSource(SOURCE).setData({type:'FeatureCollection',features});
        state.features=features.length;
        state.latest_utc=data.metadata?.latest_detection_utc||null;
        state.feed_status=data.metadata?.status||'unknown';
        loaded=true;
        status(features.length?'OK':'EMPTY',features.length?'('+features.length+' flashes)':'(no published observations)');
      })().finally(()=>{loading=null;});
      return loading;
    }

    input.addEventListener('change',()=>{
      const visible=input.checked;
      map.setLayoutProperty(LAYER,'visibility',visible?'visible':'none');
      if(visible)hydrate().catch(error=>{
        state.errors.push(String(error?.message||error));
        status('FAIL');
        input.checked=false;
        map.setLayoutProperty(LAYER,'visibility','none');
        console.error('[GRIDATLAS WEATHER]',error);
      });
    });

    map.on('click',LAYER,e=>{
      if(!input.checked||!e.features?.length)return;
      const p=e.features[0].properties||{};
      const box=document.createElement('div');
      box.style.cssText='font:12px/1.5 monospace;color:#dceeff;background:#07151e;padding:8px;max-width:260px';
      const headline=document.createElement('strong');
      headline.textContent='⚡ Satellite lightning flash';
      headline.style.color='#ffdf44';
      const detail=document.createElement('div');
      detail.textContent=(p.time_utc||'Time unavailable')+' · UTC / source: EUMETSAT MTG LI';
      const note=document.createElement('small');
      note.textContent='Optical lightning detection; not a confirmed ground strike.';
      box.append(headline,detail,note);
      new window.maplibregl.Popup({closeButton:true}).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    });
    map.on('mouseenter',LAYER,()=>{if(input.checked)map.getCanvas().style.cursor='pointer';});
    map.on('mouseleave',LAYER,()=>{map.getCanvas().style.cursor='';});
    state.installed=true;
    status('WAIT');
    return true;
  }

  const begin=Date.now();
  const timer=setInterval(()=>{
    try {
      if(install()){clearInterval(timer);}
      else if(Date.now()-begin>60000){
        state.errors.push('Weather module did not find installed GridAtlas menu within 60s');
        clearInterval(timer);
      }
    }catch(error){
      state.errors.push(String(error?.message||error));
      console.error('[GRIDATLAS WEATHER] isolated extension failure',error);
      clearInterval(timer);
    }
  },250);
})();
