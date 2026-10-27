/**
 * Optical-flash map view for the standalone Lightning → Grid laboratory.
 *
 * This is NOT a patch to the original Atlas map. It is an isolated map on a
 * different page, with a real 44 CSS-pixel target for every visible flash.
 * Click selection calls the imported Ventus Grid Engine through app.mjs.
 * Never infer a ground strike, connection or damage from these coordinates.
 */
const blank=()=>({type:'FeatureCollection',features:[]});
const ref=(p)=>Number.isFinite(p?.[0])&&Number.isFinite(p?.[1])
  && Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const checkedFeature=f=>f?.type==='Feature' && f?.geometry?.type==='Point'
  && ref(f.geometry.coordinates) && f.id!=null
  && f.properties?.observation_kind==='optical_lightning_flash';
const number=n=>Number(n).toLocaleString('en-GB');
const notice='Optical positions only. Nearest assets are not necessarily connected, hit or damaged.';

export function initLightningMap({onPick,onStatus=()=>{},onError=()=>{}}={}) {
  if(typeof onPick!=='function')throw new TypeError('Map must have a genuine observation selection callback');
  if(!globalThis.maplibregl?.Map)throw new Error('MapLibre library unavailable. Use the accessible UTC dropdown below.');
  const lib=globalThis.maplibregl;
  const map=new lib.Map({
    container:'flash-map',center:[-3.5,54.5],zoom:5.3,minZoom:2,maxZoom:17,
    attributionControl:true,
    style:{
      version:8,name:'Dark UK context (CARTO / OSM)',
      sources:{
        'carto-dark':{type:'raster',
          tiles:['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
          tileSize:256,
          attribution:'© OpenStreetMap contributors · © CARTO'}
      },
      layers:[{id:'dark-basemap',type:'raster',source:'carto-dark'}]
    }
  });
  map.addControl(new lib.NavigationControl({showCompass:false}),'top-right');

  let ready=false;
  let events=[],selection=null,context=null;
  let popup=null;
  const solarById=new Map(),subsById=new Map();

  function addSourcesAndLayers(){
    if(ready)return;
    map.addSource('optical-observations',{type:'geojson',data:blank(),cluster:true,
      clusterRadius:42,clusterMaxZoom:10});
    map.addLayer({id:'optical-clusters',type:'circle',source:'optical-observations',
      filter:['has','point_count'],
      paint:{'circle-radius':['step',['get','point_count'],14,10,18,100,23,1000,27],
        'circle-color':'#e4a523','circle-stroke-color':'#15202b','circle-stroke-width':2}});
    // Count-scaled cluster circles require no external glyph URL. Tap to expand.
    map.addLayer({id:'optical-cluster-tap',type:'circle',source:'optical-observations',
      filter:['has','point_count'],paint:{'circle-radius':24,'circle-opacity':0.01}});
    map.addLayer({id:'optical-dots',type:'circle',source:'optical-observations',
      filter:['!',['has','point_count']],
      paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,7,7,10,10,13,15,17],
        'circle-color':'#fff2ad','circle-stroke-color':'#18242b',
        'circle-stroke-width':1.5,'circle-opacity':0.97}});
    // 22px RADIUS = 44 CSS px DIAMETER. Transparent hit layer remains
    // hit-testable on mobile; a dropdown provides keyboard access.
    map.addLayer({id:'optical-flash-tap',type:'circle',source:'optical-observations',
      filter:['!',['has','point_count']],
      paint:{'circle-radius':22,'circle-opacity':0.01}});
    map.addSource('selected-optical',{type:'geojson',data:blank()});
    map.addLayer({id:'selected-optical-ring',type:'circle',source:'selected-optical',
      paint:{'circle-radius':24,'circle-color':'#ffffff','circle-opacity':0,
        'circle-stroke-color':'#ffffff','circle-stroke-width':3,'circle-stroke-opacity':1}});
    map.addSource('nearby-solar',{type:'geojson',data:blank()});
    map.addLayer({id:'nearby-solar-capacity',type:'circle',source:'nearby-solar',
      paint:{'circle-radius':['get','marker_radius_px'],
        'circle-color':'#43e3ab','circle-stroke-color':'#0c2020','circle-stroke-width':2,
        'circle-opacity':0.85}});
    map.addLayer({id:'nearby-solar-tap',type:'circle',source:'nearby-solar',
      paint:{'circle-radius':22,'circle-opacity':0.01}});
    map.addSource('nearest-substations',{type:'geojson',data:blank()});
    map.addLayer({id:'nearest-substation-dots',type:'circle',source:'nearest-substations',
      paint:{'circle-radius':7,'circle-color':'#83acff','circle-stroke-color':'#102038',
        'circle-stroke-width':2}});
    map.addLayer({id:'nearest-substation-tap',type:'circle',source:'nearest-substations',
      paint:{'circle-radius':22,'circle-opacity':0.01}});

    map.on('click','optical-flash-tap',event=>{
      const id=event.features?.[0]?.properties?.flash_id;
      if(id==null)return;
      const match=events.find(f=>String(f.id)===String(id));
      if(match)onPick(String(match.id)); // App callback selects & computes
    });
    map.on('click','optical-cluster-tap',event=>{
      const group=event.features?.[0];
      const id=group?.properties?.cluster_id;
      if(id==null)return;
      map.getSource('optical-observations')?.getClusterExpansionZoom(id,(error,zoom)=>{
        if(error){onError(error.message);return}
        map.easeTo({center:group.geometry.coordinates,zoom:Math.min(17,zoom),duration:550});
      });
    });
    map.on('click','nearby-solar-tap',event=>{
      const refId=String(event.features?.[0]?.properties?.repd_ref??'');
      const p=solarById.get(refId);
      if(!p)return;
      const panel=document.createElement('div');
      const headline=document.createElement('strong');headline.textContent=p.name;
      panel.append(headline);
      const description=document.createElement('p');
      description.textContent=number(p.km)+' km from selected optical position · '+
        (p.capacity_mw==null?'capacity not recorded':number(p.capacity_mw)+' MW recorded')+
        ' · no strike or damage implied.';
      panel.append(description);
      const link=document.createElement('a');
      link.textContent='Open existing GridAtlas MAP project';
      link.href=p.gridatlas_project_url;
      link.target='_blank';link.rel='noopener noreferrer';
      panel.append(link);
      popup?.remove();
      popup=new lib.Popup({closeButton:true,closeOnClick:true})
        .setLngLat([p.location.lon,p.location.lat]).setDOMContent(panel).addTo(map);
    });
    map.on('click','nearest-substation-tap',event=>{
      const id=String(event.features?.[0]?.properties?.item_id??'');
      const p=subsById.get(id);
      if(!p)return;
      const panel=document.createElement('div');
      const headline=document.createElement('strong');
      headline.textContent=p.name||'Unnamed mapped substation';panel.append(headline);
      const para=document.createElement('p');
      para.textContent=number(p.km)+' km from selected optical point · '+
        (p.voltages_kv||[]).map(x=>x+' kV').join(', ') +
        '. Straight-line only; no confirmed electrical connection.';
      panel.append(para);
      popup?.remove();
      popup=new lib.Popup({closeButton:true,closeOnClick:true})
        .setLngLat([p.location.lon,p.location.lat]).setDOMContent(panel).addTo(map);
    });
    const interactive=['optical-flash-tap','optical-cluster-tap',
      'nearby-solar-tap','nearest-substation-tap'];
    for(const layer of interactive){
      map.on('mouseenter',layer,()=>map.getCanvas().style.cursor='pointer');
      map.on('mouseleave',layer,()=>map.getCanvas().style.cursor='');
    }
    ready=true;
    paint();
    onStatus('Map ready: '+number(events.length)+' genuine optical flashes. Yellow dots have a 44 px tap target. '+notice);
  }

  function paint(){
    if(!ready)return;
    const data=events.filter(checkedFeature).map(f=>({
      type:'Feature',geometry:{type:'Point',coordinates:f.geometry.coordinates.slice(0,2)},
      properties:{flash_id:String(f.id),time_utc:f.properties.time_utc}
    }));
    map.getSource('optical-observations').setData({type:'FeatureCollection',features:data});
    paintSelection();
    paintContext();
  }
  function paintSelection(){
    if(!ready)return;
    const data=selection&&checkedFeature(selection)
      ?{type:'FeatureCollection',features:[{type:'Feature',geometry:selection.geometry,
        properties:{flash_id:String(selection.id)}}]}:blank();
    map.getSource('selected-optical').setData(data);
  }
  function paintContext(){
    if(!ready)return;
    solarById.clear();subsById.clear();
    const solar=[],subs=[];
    for(const p of context?.nearby_solar||[]){
      const coords=[p.location?.lon,p.location?.lat];
      if(!ref(coords)||!p.repd_ref)continue;
      solarById.set(String(p.repd_ref),p);
      solar.push({type:'Feature',geometry:{type:'Point',coordinates:coords},
        properties:{repd_ref:String(p.repd_ref),marker_radius_px:p.marker_radius_px}});
    }
    for(const [i,p] of (context?.substations||[]).entries()){
      const coords=[p.location?.lon,p.location?.lat];
      if(!ref(coords))continue;
      const id=String(i);
      subsById.set(id,p);
      subs.push({type:'Feature',geometry:{type:'Point',coordinates:coords},
        properties:{item_id:id}});
    }
    map.getSource('nearby-solar').setData({type:'FeatureCollection',features:solar});
    map.getSource('nearest-substations').setData({type:'FeatureCollection',features:subs});
  }
  function fit(features,padding=40){
    if(!ready){onStatus('Map is still loading.');return}
    const coords=features.map(f=>f?.geometry?.coordinates).filter(ref);
    if(!coords.length){onStatus('No valid coordinates to fit; no camera move.');return}
    if(coords.length===1){map.easeTo({center:coords[0],zoom:8,duration:650});return}
    const bounds=new lib.LngLatBounds(coords[0],coords[0]);
    coords.forEach(c=>bounds.extend(c));
    map.fitBounds(bounds,{padding,maxZoom:9,duration:650});
  }
  map.once('load',addSourcesAndLayers);
  map.on('error',e=>onError('Map tiles or rendering: '+String(e.error?.message||'unknown error')));
  return Object.freeze({
    setObservations(rows){
      events=Array.isArray(rows)?rows.filter(checkedFeature).slice(0,40000):[];
      paint();
      return events.length;
    },
    selectFlash(f){
      selection=checkedFeature(f)?f:null;
      // No auto-flying or zooming: owner must press Fit selection.
      context=null;
      popup?.remove();popup=null;
      paintSelection();paintContext();
    },
    setContext(c){context=c||null;paintContext()},
    clearContext(){context=null;paintContext()},
    fitFlashes(){fit(events)},
    fitSelection(){fit(selection?[selection]:[])},
    getBounds(){return ready?map.getBounds():null},
    isReady(){return ready}
  });
}
