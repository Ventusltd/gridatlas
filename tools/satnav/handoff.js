/* Native GridAtlas M1 candidate; adapted from Agent33 c07f23de. */
// Loader v2 composes script text inline; preview route is /atlas/v/<candidate>/.
const satnavRoot = new URL('../../../', location.href);
void async function () {
  const compass = new URL('https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/');
  const { buildDestination } = await import(new URL('tools/satnav/place.mjs', satnavRoot));
  const { normaliseOrigin, validCoordinate } = await import(new URL('tools/vicinity/src/model.mjs', satnavRoot));
  const style = document.createElement('style');
  style.textContent = `
    #gridatlas-satnav-toggle { position:fixed; z-index:10019; left:12px; top:92px; }
    #gridatlas-satnav-satnav { position:fixed; z-index:10019; right:12px; top:var(--satnav-panel-top, 144px);
      width:min(380px,calc(100% - 24px)); max-height:calc(100dvh - var(--satnav-panel-top, 144px) - 12px);
      overflow:auto; box-sizing:border-box; padding:12px;
      border:1px solid #367078; border-radius:6px; background:#08141bed;
      color:#e4f7f7; font:14px/1.45 ui-monospace,monospace; }
    #gridatlas-satnav-satnav h2 { margin:0 0 8px; font:inherit; font-weight:bold; color:#00ffff; }
    #gridatlas-satnav-satnav p { margin:8px 0 0; overflow-wrap:anywhere; }
    #gridatlas-satnav-satnav .actions { display:flex; flex-wrap:wrap; gap:6px; }
    #gridatlas-satnav-toggle, #gridatlas-satnav-satnav button { min-height:44px; max-width:100%; padding:6px 9px;
      border:1px solid #367078; border-radius:3px; background:#07191f;
      color:#bff7f9; font:14px/1.45 ui-monospace,monospace; cursor:pointer; text-align:left; touch-action:manipulation; }
    #gridatlas-satnav-satnav button:disabled { color:#8ba0a2; cursor:default; }
    #gridatlas-satnav-toggle:focus-visible, #gridatlas-satnav-satnav button:focus-visible { outline:2px solid #fff; outline-offset:1px; }
    #gridatlas-satnav-satnav summary { display:flex; align-items:center; min-height:44px; cursor:pointer; }
    #gridatlas-satnav-satnav summary::before { content:'▸'; margin-right:.5em; }
    #gridatlas-satnav-satnav details[open] summary::before { content:'▾'; }
    #gridatlas-satnav-satnav input { display:block; box-sizing:border-box; width:100%; min-height:44px;
      background:#07191f; color:white; border:1px solid #367078; font-size:16px; }
    #gridatlas-satnav-pin-label { width:100%; }
    #gridatlas-satnav-satnav [hidden] { display:none; }
  `;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.id = 'gridatlas-satnav-satnav';
  panel.setAttribute('aria-labelledby', 'gridatlas-satnav-satnav-title');
  const heading = document.createElement('h2');
  heading.id = 'gridatlas-satnav-satnav-title';
  heading.textContent = 'Where are you going?';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const confirmation = document.createElement('div');
  confirmation.className = 'actions';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = 'Waiting for the GridAtlas map…';
  function button(id, name, parent = actions) {
    const element = document.createElement('button');
    element.type = 'button';
    element.id = `gridatlas-satnav-${id}`;
    element.textContent = name;
    parent.append(element);
    return element;
  }
  const mapSearch = button('map-search', 'Search projects, places or postcodes');
  const planned = button('planned', 'Use selected search result');
  const pick = button('pick', 'Choose point on satellite');
  const origin = button('origin', 'Use Vicinity origin');
  const asset = button('asset', 'Use highlighted asset');
  const confirm = button('confirm', 'Use in SatNav', confirmation);
  const cancel = button('cancel', 'Cancel', confirmation);
  const vicinity = button('vicinity', 'Explore this point in Vicinity', confirmation);
  const pinLabel = document.createElement('label');
  pinLabel.id = 'gridatlas-satnav-pin-label';
  pinLabel.textContent = 'Name this pin (optional)';
  const pinName = document.createElement('input');
  pinName.type = 'text';
  pinName.maxLength = 120;
  pinLabel.append(pinName);
  confirmation.prepend(pinLabel);
  const manual = document.createElement('form');
  const field = (label, id) => {
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement('input');input.id='gridatlas-satnav-'+id;
    input.type='text';
    wrap.append(input);manual.append(wrap);return input;
  };
  const latitude=field('Latitude (signed WGS84)','latitude');
  const longitude=field('Longitude (signed WGS84)','longitude');
  latitude.inputMode=longitude.inputMode='decimal';
  const manualLabel=field('Optional destination label','label');
  const commit=button('manual','Choose coordinates',manual);commit.type='submit';
  const lookup=document.createElement('form');
  const searchLabel=document.createElement('label');searchLabel.textContent='Existing substation name or source ID';
  const search=document.createElement('input');search.type='search';searchLabel.append(search);lookup.append(searchLabel);
  const find=button('search','Find substations',lookup);
  find.type='submit';
  const results=document.createElement('div');lookup.append(results);
  function disclosure(id, title, content) {
    const details = document.createElement('details');
    details.id = `gridatlas-satnav-${id}-details`;
    const summary = document.createElement('summary');
    summary.textContent = title;
    details.append(summary, content);
    return details;
  }
  panel.append(heading, actions, status, confirmation,
    disclosure('station', 'Find an existing substation', lookup),
    disclosure('manual', 'Enter coordinates (advanced)', manual));
  document.body.append(panel);
  panel.hidden = true;
  const toggle = button('toggle','SatNav',document.body);
  toggle.setAttribute('aria-label','SatNav destination');
  toggle.setAttribute('aria-controls',panel.id);
  toggle.setAttribute('aria-expanded','false');
  const close=button('close','Close destination panel',panel);

  const samePoint = (a, b) => a?.length === 2 && b?.length === 2 && a[0] === b[0] && a[1] === b[1];
  const satellite = () => document.querySelector('#scada-ui-container input[name="bm"][value="sat"]');
  let map, marker, armed = false, pending = null, searchEpoch=0;
  const defaultStatus = 'Search for a destination, choose a satellite point or use an open Vicinity card.';
  const projectRef = () => new URLSearchParams(location.search).get('repd_ref');
  const placeSearch = () => window.__GRIDATLAS_PLACE_SEARCH__;
  const projectSelection = () => placeSearch()?.last_selection;
  const searchInput = () => document.getElementById('search-input');

  function closePanel() {
    if (armed) reset('Selection cancelled.');
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.onclick = () => {
    if (!panel.hidden) { closePanel(); return; }
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };
  close.onclick = () => { closePanel(); toggle.focus({ preventScroll: true }); };
  mapSearch.onclick = () => {
    closePanel();
    searchInput()?.focus();
  };

  // Read the exact current project or swiped item from the native Vicinity card.
  function currentCardPoint(kind) {
    const card = window.__GRIDATLAS_MODULES__?.ukOfftakers?.state.pp;
    if (!card?.project) return null;
    if (kind === 'origin') {
      const selected = projectSelection();
      const ref = card.r.p.repd_ref;
      if (ref && ((selected && String(selected.repd_ref) === String(ref) && selected.mapped !== true) ||
        samePoint(card.r.a, [-7.55716, 49.766807]))) return null;
      return { card, name: card.r.n, at: card.r.a };
    }
    if(card.__vicFocus?.origin) return null;
    const swipe = card.swipe;
    const entry = swipe?.entries[swipe.index];
    const highlight = swipe?.marker?.getLngLat();
    if (!entry || !highlight || !samePoint([highlight.lng, highlight.lat], entry.at)) return null;
    return { card, index: swipe.index, name: entry.name, at: entry.at };
  }

  function reset(message) {
    armed = false;
    pending = null;
    pinName.value = '';
    marker?.remove();
    marker = null;
    status.textContent = message;
    render();
  }

  function render() {
    pick.disabled = !map?.getLayer('l-sat') || !satellite();
    pick.setAttribute('aria-pressed', String(armed));
    mapSearch.disabled = !searchInput() || !placeSearch()?.ready;
    origin.disabled = !currentCardPoint('origin');
    asset.disabled = !currentCardPoint('asset');
    origin.hidden = origin.disabled;
    asset.hidden = asset.disabled;
    confirmation.hidden = !armed && !pending;
    confirm.hidden = !pending;
    vicinity.hidden = !pending;
    pinLabel.hidden = pending?.kind !== 'map';
  }

  function stage(kind, selection) {
    if (!selection) return;
    searchEpoch++;
    results.textContent='';
    reset('');
    try {
      const value = normaliseOrigin({ at: selection.at, name: selection.name, type: 'map-point' });
      pending = { kind, selection: { ...selection, at: value.at }, value };
      if (kind === 'map') marker = new window.maplibregl.Marker({ color: '#00ffff' }).setLngLat(value.at).addTo(map);
      status.textContent = `${value.name} · ${value.at[1].toFixed(6)}, ${value.at[0].toFixed(6)}`;
      render();
      confirm.focus();
    } catch {
      reset('Choose a valid map point.');
    }
  }

  // Same armed MapLibre click and [longitude, latitude] order as Vicinity bootstrap.
  function mapClick(event) {
    if (!panel.hidden && armed && event.lngLat) {
      stage('map', { name: 'Chosen map point', at: [event.lngLat.lng, event.lngLat.lat] });
    }
  }

  pick.onclick = () => {
    searchEpoch++;
    results.textContent='';
    if (armed) { reset('Selection cancelled.'); return; }
    reset('Tap a point on the satellite map.');
    const input = satellite();
    if (!input.checked) input.click();
    armed = true;
    render();
  };
  origin.onclick = () => stage('origin', currentCardPoint('origin'));
  asset.onclick = () => stage('asset', currentCardPoint('asset'));
  function selectedProject() {
    const selected = projectSelection();
    if (selected?.mapped !== true || String(selected.repd_ref) !== projectRef() ||
      !validCoordinate([selected.longitude, selected.latitude])) return null;
    // Keep the exact record for source status and address.
    const rows = placeSearch().last_results.filter(row => row.repd_ref === selected.repd_ref &&
      row.longitude === selected.longitude && row.latitude === selected.latitude);
    return rows.length === 1 ? rows[0] : null;
  }

  function selectedLocation() {
    const selected = placeSearch()?.last_location_selection;
    return projectRef() === null && selected?.mapped === true &&
      validCoordinate([selected.longitude, selected.latitude]) ? selected : null;
  }

  planned.onclick = () => {
    const selected = projectSelection();
    if (selected && String(selected.repd_ref) === projectRef() && selected.mapped !== true) {
      reset('This project has no mapped location. Choose a point on satellite or enter known coordinates.');
      return;
    }
    const record = selectedProject();
    if (record) {
      stage('planned', { name: record.name, at: [record.longitude, record.latitude], record });
      if (pending) status.textContent += ' · ' + [
        'REPD ' + record.repd_ref, record.status, record.address, record.postcode, 'Source point; entrance unverified',
      ].filter(Boolean).join(' · ');
      return;
    }
    const place = selectedLocation();
    if (place) {
      stage('location', { name: place.label, at: [place.longitude, place.latitude], place });
      if (pending) status.textContent += ' · ' + [place.sublabel, place.provider, 'Location only'].filter(Boolean).join(' · ');
      return;
    }
    reset('Select a mapped result in GridAtlas search, or choose a point on satellite.');
  };
  manual.onsubmit=event=>{
    event.preventDefault();
    const number=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
    if(!number.test(latitude.value.trim())||!number.test(longitude.value.trim())||Math.abs(Number(latitude.value))>90||Math.abs(Number(longitude.value))>180||(!Number(latitude.value)&&!Number(longitude.value))){status.textContent='Enter valid signed latitude and longitude. Previous selection retained.';return;}
    searchEpoch++;results.textContent='';
    stage('manual',{name:manualLabel.value.trim()||'Manual coordinate point',at:[Number(longitude.value),Number(latitude.value)]});
  };
  let stationIndex;
  search.addEventListener('input', () => {
    searchEpoch++;
    results.textContent = '';
  });
  lookup.onsubmit=async event=>{
    event.preventDefault();
    const epoch=++searchEpoch;const query=search.value.trim();results.textContent='';
    if(!query)return;
    reset('Loading the existing mapped substation snapshot…');
    try{
      if(!stationIndex){
        const [{buildStationIndex},response]=await Promise.all([import(new URL('tools/train/src/station-index.mjs',satnavRoot)),fetch(new URL('atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson',satnavRoot))]);
        if(!response.ok)throw Error('Substation source unavailable');
        const data=await response.json();
        const geodesy=window.__GRIDATLAS_MODULES__?.geodesy;
        if(!geodesy)throw Error('Canonical geodesy is not ready');
        stationIndex=buildStationIndex(data.features,{geodesy,datasetPin:'gridatlas baseline 1c9ed251ea31de67cc9d7e3b3d7908ea6aa39779'});
      }
      if(epoch!==searchEpoch)return;
      const matches=stationIndex.search(query,{limit:25});
      status.textContent=matches.matched?matches.matched+' source records; select the exact location. Addresses are not supplied by this snapshot.':'No matching substation in the mapped snapshot.';
      for(const row of matches.rows){
        const item=button('station-'+results.children.length,row.name+' · '+row.stationId+' · '+row.at[1]+', '+row.at[0],results);
        item.onclick=()=>{if(epoch!==searchEpoch)return;stage('station',{name:row.name,at:row.at,row});};
      }
    }catch(error){if(epoch===searchEpoch)status.textContent='Substation provider failed: '+error.message;}
  };
  function stillCurrent(){
    if(!pending)return false;
    if(pending.kind==='planned'&&selectedProject()!==pending.selection.record){reset('Project selection changed. Select it again.');return false;}
    if(pending.kind==='location'&&selectedLocation()!==pending.selection.place){reset('Location selection changed. Select it again.');return false;}
    if(['origin','asset'].includes(pending.kind)){
      const current=currentCardPoint(pending.kind), selection=pending.selection;
      if(!current||current.card!==selection.card||current.index!==selection.index||current.name!==selection.name||!samePoint(current.at,pending.value.at)){reset('The Vicinity selection changed. Select it again.');return false;}
    }
    return true;
  }
  function destinationName(kind, value) {
    return kind === 'map' ? pinName.value.trim() || value.name : value.name;
  }
  vicinity.onclick=()=>{
    if(!stillCurrent())return;
    const {value,selection,kind}=pending;
    const opened=window.__GRIDATLAS_MODULES__?.ukOfftakers?.openPointVicinity?.({at:value.at,name:destinationName(kind,value),kind,repdRef:kind==='planned'?selection.record.repd_ref:null,status:kind==='planned'?selection.record.status:null});
    if(opened){reset('Vicinity opened at the selected source point.');closePanel();}
    else status.textContent='Vicinity engine not ready. Selection retained; retry when loaded.';
  };
  cancel.onclick = () => { searchEpoch++;results.textContent='';reset('Selection cancelled.'); pick.focus(); };
  confirm.onclick = () => {
    if (!stillCurrent()) return;
    const { kind, value } = pending;
    const query = buildDestination({ name: destinationName(kind, value), coordinates: value.at, mode: 'compass' });
    location.assign(new URL(query, compass));
  };
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (armed || pending)) { event.preventDefault(); cancel.click(); }
  });
  for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown', 'touchstart']) {
    panel.addEventListener(type, event => event.stopPropagation());
  }

  function positionControls() {
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (toggle.parentElement !== host) host.append(toggle, panel);
    const menu = document.getElementById('gridatlas-menu-bar')?.getBoundingClientRect();
    const mapTop = map?.getContainer().getBoundingClientRect().top ?? 44;
    let top = Math.max(92, Math.ceil(menu?.height ? menu.bottom : mapTop) + 8);
    const buttonRect = toggle.getBoundingClientRect();
    // Leave the existing search and attribution controls accessible on narrow screens.
    for (const selector of ['.custom-map-attrib', '.search-bar-wrapper']) {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      if (rect?.height && rect.left < buttonRect.right && rect.right > buttonRect.left &&
        rect.top < top + buttonRect.height && rect.bottom > top) top = Math.ceil(rect.bottom) + 8;
    }
    toggle.style.top = `${top}px`;
    panel.style.setProperty('--satnav-panel-top', `${top + buttonRect.height + 8}px`);
  }

  function refresh() {
    const nativeMap = window.__GRIDATLAS_V9_MAP__;
    if (nativeMap && nativeMap !== map && nativeMap.getLayer('l-sat')) {
      map?.off('click', mapClick);
      map = nativeMap;
      map.on('click', mapClick);
      status.textContent = defaultStatus;
    }
    positionControls();
    render();
  }
  refresh();
  let timer = setInterval(refresh, 250);
  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    map?.off('click', mapClick);
    reset(defaultStatus);
    map = null;
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    refresh();
    timer = setInterval(refresh, 250);
  });
}().catch(error => console.error('Detached SatNav handoff failed', error));
