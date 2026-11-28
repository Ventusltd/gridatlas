/* SatNav compact preview: GridAtlas map, independent endpoints, session-only GPS. */
void async function () {
  const root = new URL('../../../', location.href);
  const p1 = new URL('https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/');
  const [maths, { MAX_AGE_MS, fixQuality }, { point }, { validCoordinate }] = await Promise.all([
    import(new URL('vendor/grid-distance-maths/src/geodesy.mjs', p1)),
    import(new URL('nav/compass.mjs', p1)),
    import(new URL('tools/satnav/line/position-overlay.mjs', root)),
    import(new URL('tools/vicinity/src/model.mjs', root)),
  ]);
  const style = document.createElement('style');
  style.textContent = `
    body .dashboard { position:fixed!important; inset:0!important; height:100dvh!important; width:100vw!important; padding:0!important; display:block!important; }
    body #map-container { position:absolute!important; inset:0!important; width:100%!important; height:100%!important; border:0!important; border-radius:0!important; }
    body .hud-header,body .scada-wrapper,body .podcast-shoutout,body .search-bar-wrapper,body .map-controls,body #btn-fullscreen,body #fs-curtain-tab,body #fs-letterhead { display:none!important; }
    #satnav-compact { position:fixed; top:max(8px,env(safe-area-inset-top)); left:max(8px,env(safe-area-inset-left)); z-index:10030; display:grid; gap:5px; width:min(210px,calc(100vw - 24px)); color:#e4f7f7; font:13px/1.3 system-ui,sans-serif; }
    #satnav-compact button { min-height:44px; border:1px solid #367078; border-radius:6px; background:#081820; color:#e4f7f7; text-align:left; padding:6px 9px; font:inherit; touch-action:manipulation; }
    #satnav-compact button[aria-pressed=true] { outline:2px solid #00ffff; }
    #satnav-compact button:focus-visible { outline:2px solid white; }
    #satnav-compact button:disabled { opacity:.55; }
    #satnav-compact b { display:inline-block; width:45px; color:#68e8f5; }
    #satnav-gps-row { display:flex; gap:5px; }
    #satnav-gps-row button { flex:1; text-align:center; }
    #satnav-status { background:#081820e8; border-radius:4px; padding:3px 6px; margin:0; font-size:11px; overflow-wrap:anywhere; }
  `;
  document.head.append(style);
  const panel=document.createElement('section');
  panel.id='satnav-compact';
  panel.setAttribute('aria-label','SatNav map selection');
  panel.innerHTML='<button type="button" id="satnav-from" aria-pressed="false"><b>FROM</b><span>My location</span></button><button type="button" id="satnav-to" aria-pressed="false"><b>TO</b><span>Tap map</span></button><div id="satnav-gps-row"><button type="button" id="satnav-location">My location</button><button type="button" id="satnav-stop" disabled>Stop</button></div><p id="satnav-status" role="status">Loading map</p>';
  document.body.append(panel);
  const fromButton=panel.querySelector('#satnav-from'), toButton=panel.querySelector('#satnav-to'), locate=panel.querySelector('#satnav-location'), stop=panel.querySelector('#satnav-stop'), status=panel.querySelector('#satnav-status');
  let map, source, first=null, end=null, picking=null, fix=null, watch=null, generation=0, useLocation=true, pendingLocation=false, notice='', drawnKey=null;
  const sourceId='gridatlas-satnav-compact';
  const layers=[
    ['accuracy','gps-accuracy','fill',{'fill-color':'#ffdf61','fill-opacity':.22}],
    ['line','selected-section','line',{'line-color':'#00ffff','line-width':3,'line-opacity':.8}],
    ['start','start-point','circle',{'circle-color':'#00ffff','circle-radius':6,'circle-stroke-color':'#071820','circle-stroke-width':2}],
    ['end','destination-point','circle',{'circle-color':'#ff65d5','circle-radius':8,'circle-stroke-color':'#071820','circle-stroke-width':2}],
    ['gps','measured-gps','circle',{'circle-color':'#ffdf61','circle-radius':7,'circle-stroke-color':'#171100','circle-stroke-width':2}],
  ];
  function features() {
    const out=[];
    if(first)out.push(point('start-point',first));
    if(end)out.push(point('destination-point',end));
    const distance=first&&end?maths.distanceKm(...first,...end):null;
    if(distance>0&&distance<=1)out.push({type:'Feature',properties:{role:'selected-section'},geometry:{type:'LineString',coordinates:[first,end]}});
    if(fix&&['usable','poor'].includes(fixQuality(fix))&&Date.now()-fix.timestampMs<=MAX_AGE_MS){
      const at=[fix.longitude,fix.latitude];
      out.push(point('measured-gps',at));
      if(fix.accuracyM>0)out.push({type:'Feature',properties:{role:'gps-accuracy'},geometry:{type:'Polygon',coordinates:[maths.geodesicCircle(...at,fix.accuracyM/1000,64)]}});
    }
    return {out,distance};
  }
  function render() {
    const {out,distance}=features();
    const key=JSON.stringify(out);
    if(map&&source&&map.getSource(sourceId)===source&&key!==drawnKey){source.setData({type:'FeatureCollection',features:out});drawnKey=key;}
    fromButton.disabled=toButton.disabled=!map;
    fromButton.querySelector('span').textContent=picking==='from'?'Tap map':useLocation?'My location':first?'Selected point':'Tap map';
    toButton.querySelector('span').textContent=picking==='to'?'Tap map':end?'Selected point':'Tap map';
    fromButton.setAttribute('aria-pressed',String(picking==='from'));
    toButton.setAttribute('aria-pressed',String(picking==='to'));
    locate.disabled=!map;
    stop.disabled=watch===null;
    const parts=[];
    if(!map)parts.push('Loading map');
    else if(picking)parts.push('Tap map to set '+picking.toUpperCase());
    else if(distance!==null)parts.push(distance===0?'Same point':distance>1?'Points selected; practice line limited to 1 km':Math.round(distance*1000)+' m straight line');
    else parts.push('Select FROM or TO');
    if(notice)parts.push(notice);
    if(fix&&['usable','poor'].includes(fixQuality(fix)))parts.push('GPS ±'+Math.round(fix.accuracyM)+' m');
    const message=parts.join(' · ');
    if(status.textContent!==message)status.textContent=message;
  }
  function arm(which){picking=picking===which?null:which;render();}
  function mapClick(event){
    if(!picking||!event.lngLat)return;
    const at=[event.lngLat.lng,event.lngLat.lat];
    if(!validCoordinate(at))return;
    if(picking==='from'){first=at;useLocation=false;pendingLocation=false;}else end=at;
    picking=null;
    render();
  }
  fromButton.onclick=()=>arm('from');toButton.onclick=()=>arm('to');
  function stopTracking(message){
    generation++;
    if(watch!==null)navigator.geolocation.clearWatch(watch);
    watch=null;fix=null;pendingLocation=false;notice=message;render();
  }
  function applyLocation(){
    if(!pendingLocation||!fix||!validCoordinate([fix.longitude,fix.latitude]))return;
    first=[fix.longitude,fix.latitude];useLocation=true;pendingLocation=false;
    map?.jumpTo({center:first,zoom:Math.max(15,map.getZoom())});
  }
  locate.onclick=()=>{
    if(!isSecureContext||!navigator.geolocation){notice='Location needs HTTPS';render();return;}
    pendingLocation=true;picking=null;notice='Waiting for GPS';
    if(watch!==null){
      if(fix&&fixQuality(fix)==='usable'&&Date.now()-fix.timestampMs<=MAX_AGE_MS){applyLocation();notice='';}
      render();return;
    }
    const active=++generation;
    try {
      watch=navigator.geolocation.watchPosition(position=>{
        if(active!==generation)return;
        const {longitude,latitude,accuracy:accuracyM}=position.coords;
        fix={longitude,latitude,accuracyM,timestampMs:position.timestamp};
        if(fixQuality(fix)==='usable'&&Date.now()-fix.timestampMs<=MAX_AGE_MS&&validCoordinate([longitude,latitude])){
          applyLocation();
          notice='';
        }else notice='Waiting for a usable GPS fix';
        render();
      },error=>{
        if(active!==generation)return;
        if(error.code===1)stopTracking('Location permission denied');
        else{fix=null;notice='Location unavailable';render();}
      },{enableHighAccuracy:true,maximumAge:1000,timeout:10000});
    }catch{stopTracking('Location could not start');}
    render();
  };
  stop.onclick=()=>stopTracking('Location stopped');
  for(const event of ['click','dblclick','mousedown','pointerdown','touchstart'])panel.addEventListener(event,e=>e.stopPropagation());
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){picking=null;render();}});
  function refresh(){
    const host=document.fullscreenElement||document.webkitFullscreenElement||document.body;
    if(panel.parentElement!==host)host.append(panel);
    const next=window.__GRIDATLAS_V9_MAP__;
    if(next&&next.getLayer('l-sat')&&next!==map){
      map?.off('click',mapClick);map=next;source=null;drawnKey=null;map.on('click',mapClick);map.resize();
    }
    if(map&&!map.getSource(sourceId)){
      map.addSource(sourceId,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      source=map.getSource(sourceId);drawnKey=null;
      for(const [id,role,type,paint] of layers)map.addLayer({id:sourceId+'-'+id,source:sourceId,type,paint,filter:['==',['get','role'],role]});
    }
    if(fix&&Date.now()-fix.timestampMs>MAX_AGE_MS){fix=null;notice='GPS fix is stale';}
    render();
  }
  render();refresh();let timer=setInterval(refresh,250);
  window.addEventListener('pagehide',()=>{clearInterval(timer);stopTracking('Location stopped');});
  window.addEventListener('pageshow',event=>{if(event.persisted){refresh();timer=setInterval(refresh,250);}});
}().catch(error=>console.error('SatNav compact preview failed',error));
