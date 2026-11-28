/* GridAtlas waypoint map. Based on the immutable PR113 compact map and GPS lifecycle. */
void async function () {
  const root = new URL('../../../', location.href);
  const vendor = new URL('tools/satnav/vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/', root);
  const [maths, compass, { point }, { createWaypointState }, { createWaypointGuidance }, { assessFieldState }] = await Promise.all([
    import(new URL('vendor/grid-distance-maths/src/geodesy.mjs', vendor)),
    import(new URL('nav/compass.mjs', vendor)),
    import(new URL('tools/satnav/line/position-overlay.mjs', root)),
    import(new URL('tools/satnav/waypoints/state.mjs', root)),
    import(new URL('tools/satnav/guidance/ordered.mjs', root)),
    import(new URL('tools/satnav/field-reliability/state.mjs', root)),
  ]);

  const style = document.createElement('style');
  style.textContent = `
    body .dashboard{position:fixed!important;inset:0!important;height:100dvh!important;width:100vw!important;padding:0!important;display:block!important}
    body #map-container{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:0!important;border-radius:0!important}
    body .hud-header,body .scada-wrapper,body .podcast-shoutout,body .search-bar-wrapper,body .map-controls,body #btn-fullscreen,body #fs-curtain-tab,body #fs-letterhead{display:none!important}
    #satnav-compact,#satnav-access{position:fixed;left:max(8px,env(safe-area-inset-left));color:#e4f7f7;font:13px/1.3 system-ui,sans-serif;z-index:10030}
    #satnav-compact{top:max(8px,env(safe-area-inset-top));width:min(204px,calc(100vw - 20px));display:grid;gap:4px;max-height:calc(100dvh - 68px);overflow:auto;overscroll-behavior:contain}
    #satnav-compact [hidden],#satnav-compact :empty.satnav-readout,#satnav-field-tools:empty{display:none!important}
    #satnav-compact button,#satnav-access{background:#081820ed;color:#e4f7f7;border:1px solid #367078;border-radius:6px}
    #satnav-compact button{min-width:0;min-height:44px;padding:4px 7px;font:inherit;touch-action:manipulation;cursor:pointer}
    #satnav-compact button:disabled{opacity:.55;cursor:default}
    #satnav-compact button[aria-pressed=true]{border-color:#67f9ff;box-shadow:inset 0 0 0 1px #67f9ff}
    #satnav-compact :focus-visible,#satnav-access :focus-visible{outline:2px solid white;outline-offset:-3px}
    #satnav-compact .satnav-endpoint{text-align:left}
    #satnav-compact .satnav-endpoint b{display:inline-block;width:43px;color:#68e8f5}
    #satnav-compact .satnav-row{display:flex;gap:4px}
    #satnav-compact .satnav-row button{flex:1}
    #satnav-editor{display:grid;gap:4px;background:#081820ed;padding:4px;border-radius:6px}
    #satnav-selected,#satnav-limit{margin:2px 3px}
    #satnav-selected{font-weight:bold}
    #satnav-limit{font-size:11px;color:#b6d4d6}
    #satnav-compact .satnav-readout{background:#081820ed;margin:0;padding:3px 6px;border-radius:4px;font-size:12px;overflow-wrap:anywhere}
    #satnav-guide{color:#8bf7f7}
    #satnav-access{bottom:max(8px,env(safe-area-inset-bottom));max-width:min(300px,calc(100vw - 110px));font-size:11px}
    #satnav-access summary{min-height:24px;box-sizing:border-box;padding:4px 7px;cursor:pointer}
    #satnav-access p{margin:0;padding:2px 8px 7px}
  `;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.id = 'satnav-compact';
  panel.setAttribute('aria-label', 'SatNav map controls');
  panel.innerHTML = `
    <button class="satnav-endpoint" type="button" id="satnav-from" aria-pressed="false"><b>FROM</b><span>My location</span></button>
    <button class="satnav-endpoint" type="button" id="satnav-to" aria-pressed="false"><b>TO</b><span>Tap map</span></button>
    <div class="satnav-row">
      <button type="button" id="satnav-add" aria-label="Add a waypoint" aria-pressed="false">+ Pin</button>
      <button type="button" id="satnav-undo" disabled>Undo</button>
      <button type="button" id="satnav-edit" aria-controls="satnav-editor" aria-expanded="false" disabled>Edit</button>
    </div>
    <button type="button" id="satnav-use-fix" hidden>Place at my GPS fix</button>
    <div id="satnav-editor" hidden>
      <div class="satnav-row"><button type="button" id="satnav-prev" aria-label="Previous pin">Previous</button><button type="button" id="satnav-next" aria-label="Next pin">Next</button></div>
      <p id="satnav-selected"></p>
      <div class="satnav-row"><button type="button" id="satnav-replace">Move on map</button><button type="button" id="satnav-remove">Delete</button></div>
      <div class="satnav-row"><button type="button" id="satnav-earlier">Earlier</button><button type="button" id="satnav-later">Later</button></div>
      <p id="satnav-limit"></p>
    </div>
    <div class="satnav-row"><button type="button" id="satnav-location">My location</button><button type="button" id="satnav-stop" disabled>Stop</button></div>
    <p class="satnav-readout" id="satnav-status" role="status"></p>
    <p class="satnav-readout" id="satnav-guide" aria-label="Waypoint guidance"></p>
    <div id="satnav-field-tools"></div>`;
  const access = document.createElement('details');
  access.id = 'satnav-access';
  access.innerHTML = '<summary>Check access before entry</summary><p>Maps do not grant access. You and your organisation must check land rights, restrictions and safe working conditions. Ventus retains its own legal and safety duties.</p>';
  document.body.append(panel, access);
  const controls = Object.fromEntries([...panel.querySelectorAll('[id]')].map(el => [el.id.slice(7), el]));
  const notify = (name, detail) => panel.dispatchEvent(new CustomEvent('satnav:' + name, { detail }));
  const updateText = (element, value) => { if (element.textContent !== value) element.textContent = value; };
  const distanceText = metres => metres >= 1000 ? (metres / 1000).toFixed(1) + ' km' : Math.round(metres) + ' m';
  const bearingText = degrees => (Math.round(degrees) % 360) + '°';
  const collection = features => ({ type: 'FeatureCollection', features });

  let state = createWaypointState();
  let snapshot = state.snapshot();
  let roles = { from: null, to: null, gpsOrigin: false };
  let selected = null, picking = null, closed = false;
  let guidance = createWaypointGuidance(maths, compass);
  // The model records reversible coordinate edits. Keep matching endpoint roles with each edit.
  const history = [];
  let map = null, fix = null, watch = null, generation = 0, pendingLocation = false;
  let resumedAt = null, lastFixMs = -Infinity, permissionDenied = false;
  let notice = '', planData = collection([]), positionData = collection([]);
  let planDirty = true, positionDirty = true, planDistance = 0, longLegs = 0, dateLineLegs = 0;
  const planSource = 'gridatlas-satnav-waypoints';
  const positionSource = 'gridatlas-satnav-position';
  const layers = [
    [positionSource, 'accuracy', 'gps-accuracy', 'fill', {'fill-color':'#ffdf61','fill-opacity':.22}],
    [planSource, 'line', 'selected-section', 'line', {'line-color':'#00ffff','line-width':3,'line-dasharray':[3,2]}],
    [planSource, 'via', 'waypoint', 'circle', {'circle-color':'#ffffff','circle-radius':6,'circle-stroke-color':'#006a76','circle-stroke-width':3}],
    [planSource, 'start', 'start-point', 'circle', {'circle-color':'#00ffff','circle-radius':7,'circle-stroke-color':'#071820','circle-stroke-width':2}],
    [planSource, 'end', 'destination-point', 'circle', {'circle-color':'#ff65d5','circle-radius':8,'circle-stroke-color':'#071820','circle-stroke-width':2}],
    [positionSource, 'gps', 'measured-gps', 'circle', {'circle-color':'#ffdf61','circle-radius':7,'circle-stroke-color':'#171100','circle-stroke-width':2}],
  ];

  function refreshGuidance() {
    let pins = roles.from && snapshot.pins.length > 1 ? snapshot.pins : [];
    if (closed) pins = [...pins, {id:'return-' + roles.from, coordinate:pins[0].coordinate}];
    guidance.setRoute(pins);
  }
  function changePlan() {
    snapshot = state.snapshot();
    closed = false;
    if (!snapshot.pins.some(pin => pin.id === selected)) selected = snapshot.pins[0]?.id ?? null;
    if (!selected) controls.editor.hidden = true;
    planDistance = 0;
    longLegs = 0;
    dateLineLegs = 0;
    const features = [];
    for (const [i, pin] of snapshot.pins.entries()) {
      const role = pin.id === roles.from ? 'start-point' : pin.id === roles.to ? 'destination-point' : 'waypoint';
      const feature = point(role, pin.coordinate);
      feature.properties.pinId = pin.id;
      feature.properties.order = i + 1;
      features.push(feature);
      if (!i) continue;
      const previous = snapshot.pins[i - 1].coordinate;
      const length = maths.distanceKm(...previous, ...pin.coordinate);
      planDistance += length * 1000;
      if (length > 1) { longLegs++; continue; }
      if (Math.abs(previous[0] - pin.coordinate[0]) > 180) { dateLineLegs++; continue; }
      if (length > 0) features.push({type:'Feature', properties:{role:'selected-section'}, geometry:{type:'LineString',coordinates:[previous,pin.coordinate]}});
    }
    planData = collection(features);
    planDirty = true;
    refreshGuidance();
    notify('pins', snapshot.pins);
    render();
  }
  function edit(operation) {
    const before = {...roles};
    if (!operation()) return false;
    history.push({roles:before});
    if (history.length > 256) history.shift();
    changePlan();
    return true;
  }
  function setPin(which, at, fromGps = false) {
    const replaceId = which === 'replace' ? selected : roles[which];
    if (replaceId) {
      return edit(() => {
        if (!state.replace(replaceId, at)) return false;
        if (replaceId === roles.from) roles.gpsOrigin = fromGps;
        return true;
      });
    }
    return edit(() => {
      const toIndex = roles.to ? snapshot.pins.length - 1 : snapshot.pins.length;
      const establishesFrom = which === 'from' || (which === 'add' && !roles.from);
      const atIndex = establishesFrom ? 0 : which === 'to' ? snapshot.pins.length : toIndex;
      const id = state.add(at, atIndex);
      if (establishesFrom) {roles.from = id; roles.gpsOrigin = fromGps;}
      if (which === 'to') roles.to = id;
      selected = id;
      return true;
    });
  }
  function place(at, fromGps = false) {
    if (!picking) return;
    const which = picking;
    picking = null;
    if (which === 'from' || (which === 'add' && !roles.from) || (which === 'replace' && selected === roles.from)) pendingLocation = false;
    try { notice = ''; setPin(which, at, fromGps); }
    catch (error) { notice = error.message; }
    render();
  }
  function replacePlan(coordinates) {
    if (!Array.isArray(coordinates) || !coordinates.length || coordinates.length > snapshot.maxPins) throw new RangeError('Choose a plan with 1 to 20,000 pins');
    const imported = createWaypointState();
    for (const at of coordinates) imported.add(at); // Validate everything before switching state.
    const newPins = imported.snapshot().pins;
    history.length = 0; // A whole-file replacement retains one previous plan.
    history.push({state, roles:{...roles}});
    state = imported;
    roles = {from:newPins[0].id, to:newPins.length > 1 ? newPins.at(-1).id : null, gpsOrigin:false};
    guidance = createWaypointGuidance(maths, compass);
    picking = null;
    pendingLocation = false;
    selected = roles.from;
    notice = '';
    changePlan();
  }
  function undo() {
    const previous = history.pop();
    if (!previous) return;
    if (previous.state) {
      state = previous.state;
      guidance = createWaypointGuidance(maths, compass);
    } else state.undo();
    roles = previous.roles;
    picking = null;
    pendingLocation = false;
    notice = '';
    changePlan();
  }

  function setFix(next) {
    fix = next;
    const features = [];
    if (next) {
      const at = [next.longitude, next.latitude];
      features.push(point('measured-gps', at));
      if (next.accuracyM > 0) features.push({type:'Feature',properties:{role:'gps-accuracy'},geometry:{type:'Polygon',coordinates:[maths.geodesicCircle(...at,next.accuracyM/1000,64)]}});
    }
    positionData = collection(features);
    positionDirty = true;
    notify('fix', next);
  }
  function fieldState(sample) {
    return assessFieldState({tracking:watch !== null,hidden:document.hidden,resumedAt,fix:sample,
      networkOnline:navigator.onLine,permissionDenied}, compass.fixQuality);
  }
  function refreshSources() {
    if (!map || !map.getLayer('l-sat')) return;
    for (const [id, data] of [[planSource,planData],[positionSource,positionData]]) {
      if (!map.getSource(id)) map.addSource(id, {type:'geojson',data});
      else if (id === planSource ? planDirty : positionDirty) map.getSource(id).setData(data);
    }
    for (const [source, key, role, type, paint] of layers) {
      const id = source + '-' + key;
      if (!map.getLayer(id)) map.addLayer({id,source,type,paint,filter:['==',['get','role'],role]});
    }
    planDirty = positionDirty = false;
  }
  function guidanceText() {
    const result = guidance.locate(fix, Date.now());
    if (result.status === 'complete') return 'Arrived at the final pin';
    if (result.status !== 'guiding' || !Number.isFinite(result.distanceM)) return '';
    const name = closed && result.targetIndex === snapshot.pins.length ? 'Return to FROM' : 'Pin ' + (result.targetIndex + 1);
    const parts = [name, distanceText(result.distanceM)];
    if (Number.isFinite(result.bearingDeg)) parts.push(bearingText(result.bearingDeg) + ' true');
    if (Number.isFinite(result.remainingM)) parts.push(distanceText(result.remainingM) + ' remaining');
    if (result.offRoute === true) parts.push('Off planned line');
    return parts.join(' · ');
  }
  function render() {
    refreshSources();
    const count = snapshot.pins.length;
    controls.from.disabled = controls.to.disabled = controls.location.disabled = !map;
    controls.add.disabled = !map || count >= snapshot.maxPins;
    controls.stop.disabled = watch === null;
    updateText(controls.location, watch !== null ? 'Centre GPS' : roles.from ? 'Start GPS' : 'My location');
    controls.undo.disabled = !history.length;
    controls.edit.disabled = !count;
    controls.edit.setAttribute('aria-expanded', String(!controls.editor.hidden));
    updateText(controls.from.querySelector('span'), picking === 'from' ? 'Tap map' : roles.from ? (roles.gpsOrigin ? 'GPS fix' : 'Selected point') : 'My location');
    updateText(controls.to.querySelector('span'), picking === 'to' || !roles.to ? 'Tap map' : 'Selected point');
    for (const key of ['from','to','add']) controls[key].setAttribute('aria-pressed', String(picking === key));
    controls['use-fix'].hidden = !picking || compass.fixQuality(fix) !== 'usable';
    if (!controls.editor.hidden) {
      const index = snapshot.pins.findIndex(pin => pin.id === selected);
      updateText(controls.selected, 'Pin ' + (index+1) + ' of ' + count + (selected === roles.from ? ' · FROM' : selected === roles.to ? ' · TO' : ''));
      updateText(controls.limit, 'Maximum ' + snapshot.maxPins.toLocaleString('en-GB') + ' pins');
      controls.prev.disabled = index <= 0;
      controls.next.disabled = index >= count - 1;
      const via = selected !== roles.from && selected !== roles.to;
      controls.earlier.disabled = !via || index <= (roles.from ? 1 : 0);
      controls.later.disabled = !via || index >= count - (roles.to ? 2 : 1);
    }
    const messages = [];
    if (!map) messages.push('Loading map');
    else if (picking) messages.push(picking === 'add' ? 'Tap map to add pin' : picking === 'replace' ? 'Tap map to move pin' : 'Tap map to set ' + picking.toUpperCase());
    else if (count > 1) messages.push(count + ' pins · ' + distanceText(planDistance) + ' planned');
    if (longLegs) messages.push('Lines shown for legs up to 1 km');
    if (dateLineLegs) messages.push('Line omitted at the date line');
    if (notice) messages.push(notice);
    if (fieldState(fix).mapAvailability === 'offline-unverified') messages.push('Offline · map coverage unverified');
    if (fix) {
      messages.push('GPS ±' + Math.round(fix.accuracyM) + ' m');
      if (fix.heading !== null && compass.fixQuality(fix) === 'usable') messages.push('GPS course ' + bearingText(fix.heading));
    }
    updateText(controls.status, messages.join(' · '));
    updateText(controls.guide, guidanceText());
  }
  function arm(which) {
    picking = picking === which ? null : which;
    notice = '';
    if (picking === 'from') pendingLocation = false;
    render();
  }
  function mapClick(event) {
    if (picking && event.lngLat) {
      const at = event.lngLat.wrap ? event.lngLat.wrap() : event.lngLat;
      place([at.lng, at.lat]);
    } else if (event.point) {
      const {x,y} = event.point;
      const ids = ['start','via','end'].map(role => planSource + '-' + role);
      if (!ids.every(id => map.getLayer(id))) return;
      const hit = map.queryRenderedFeatures([[x-7,y-7],[x+7,y+7]], {layers:ids})[0];
      if (hit?.properties?.pinId) { selected = hit.properties.pinId; controls.editor.hidden = false; render(); }
    }
  }
  for (const name of ['from','to','add','replace']) controls[name].onclick = () => arm(name);
  controls['use-fix'].onclick = () => {
    if (compass.fixQuality(fix) === 'usable') place([fix.longitude,fix.latitude], true);
    else {notice = 'Waiting for a usable GPS fix';render();}
  };
  controls.undo.onclick = undo;
  controls.edit.onclick = () => {controls.editor.hidden = !controls.editor.hidden; picking = null; render();};
  const selectedIndex = () => snapshot.pins.findIndex(pin => pin.id === selected);
  for (const [name,offset] of [['prev',-1],['next',1]]) controls[name].onclick = () => {
    selected = snapshot.pins[selectedIndex() + offset].id;
    picking = null;
    render();
  };
  for (const [name,offset] of [['earlier',-1],['later',1]]) controls[name].onclick = () => {
    picking = null;
    edit(() => state.move(selected, selectedIndex() + offset));
  };
  controls.remove.onclick = () => {
    picking = null;
    edit(() => {
      const removed = selected;
      state.remove(removed);
      if (removed === roles.from) { roles.from = null; roles.gpsOrigin = false; pendingLocation = false; }
      if (removed === roles.to) roles.to = null;
      return true;
    });
  };
  function stopTracking(message) {
    generation++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    lastFixMs = -Infinity;
    pendingLocation = false;
    notice = message;
    setFix(null);
    notify('stop');
    render();
  }
  function centreOnFix() {
    if (!pendingLocation || compass.fixQuality(fix) !== 'usable') return;
    pendingLocation = false;
    const at = [fix.longitude,fix.latitude];
    // An imported or hand-picked start belongs to the plan. Starting the GPS
    // centres the map. Only an empty FROM field takes this first measured fix.
    try { if (!roles.from) setPin('from', at, true); }
    catch (error) { notice = error.message; return; }
    map?.jumpTo({center:at,zoom:Math.max(15,map.getZoom())});
  }
  controls.location.onclick = () => {
    if (!isSecureContext || !navigator.geolocation) {notice = 'Location needs HTTPS and device GPS';render();return;}
    pendingLocation = true;
    permissionDenied = false;
    picking = null;
    notice = 'Waiting for GPS';
    if (watch !== null) {
      if (compass.fixQuality(fix) === 'usable') {notice = '';centreOnFix();}
      render();
      return;
    }
    const active = ++generation;
    try {
      watch = navigator.geolocation.watchPosition(position => {
        if (active !== generation) return;
        const {longitude,latitude,accuracy:accuracyM,heading,speed} = position.coords;
        const next = Object.freeze({longitude,latitude,accuracyM,timestampMs:position.timestamp,
          heading:Number.isFinite(heading) && heading >= 0 && heading < 360 && Number.isFinite(speed) && speed > 0 ? heading : null});
        const field = fieldState(next);
        const quality = field.gpsState;
        if (field.showMeasuredFix) {
          if (next.timestampMs < lastFixMs) return;
          lastFixMs = next.timestampMs;
          setFix(next);
          notice = quality === 'poor' ? 'Low GPS accuracy' : '';
          centreOnFix();
        } else {
          setFix(null);
          notice = quality === 'stale' ? 'GPS fix is stale' : 'Waiting for a fresh GPS fix';
        }
        render();
      }, error => {
        if (active !== generation) return;
        if (error.code === 1) {permissionDenied = true;stopTracking('Location permission denied');}
        else {setFix(null); notice = 'Location unavailable'; render();}
      }, {enableHighAccuracy:true,maximumAge:1000,timeout:10000});
      notify('watch');
    } catch {stopTracking('Location could not start');}
    render();
  };
  controls.stop.onclick = () => stopTracking('Location stopped');
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) resumedAt = Date.now();
    if (watch !== null) {
      setFix(null);
      notice = document.hidden ? 'GPS in background' : 'Waiting for a fresh GPS fix';
      render();
    }
  });
  window.addEventListener('offline', render);
  window.addEventListener('online', render);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {picking = null; controls.editor.hidden = true; render();}
  });
  for (const element of [panel,access]) {
    for (const name of ['click','dblclick','mousedown','pointerdown','touchstart']) element.addEventListener(name, event => event.stopPropagation());
  }
  function refresh() {
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (panel.parentElement !== host) host.append(panel,access);
    const next = window.__GRIDATLAS_V9_MAP__;
    if (next && next.getLayer('l-sat') && next !== map) {
      map?.off('click',mapClick);
      map = next;
      planDirty = positionDirty = true;
      map.on('click',mapClick);
      map.resize();
      notify('map',map);
    }
    if (fix && compass.fixQuality(fix) === 'stale') {setFix(null);notice = 'GPS fix is stale';}
    render();
  }
  panel.satnavSurvey = Object.freeze({
    getPins: () => snapshot.pins,
    getEndpoints: () => [roles.from ? snapshot.pins[0].coordinate : null, roles.to ? snapshot.pins.at(-1).coordinate : null],
    getMap: () => map,
    getFix: () => ['usable','poor'].includes(compass.fixQuality(fix)) ? fix : null,
    isTracking: () => watch !== null,
    maths,
    distanceKm: maths.distanceKm,
    fixQuality: compass.fixQuality,
    replacePlan,
    setDestination: at => { const changed = setPin('to', at); picking = null; render(); return changed; },
    setClosedLoop(enabled) {
      if (enabled && (!roles.from || snapshot.pins.length < 3 || snapshot.pins.length >= snapshot.maxPins)) return false;
      const previous = closed;
      closed = Boolean(enabled);
      if (closed !== previous) {refreshGuidance();render();}
      return true;
    },
  });
  refresh();
  document.dispatchEvent(new Event('satnav:ready'));
  let timer = setInterval(refresh, 500);
  window.addEventListener('pagehide', () => {clearInterval(timer); stopTracking('Location stopped');});
  window.addEventListener('pageshow', event => {if (event.persisted) {refresh();timer = setInterval(refresh, 500);}});
}().catch(error => {
  console.error('SatNav waypoint map failed', error);
  const message = document.createElement('p');
  message.setAttribute('role','alert');
  message.textContent = 'SatNav controls could not load. Reload to try again.';
  document.body.prepend(message);
});
