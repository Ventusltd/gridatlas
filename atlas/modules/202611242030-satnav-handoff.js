/* Native GridAtlas M1 candidate; adapted from Agent33 c07f23de. */
// Loader v2 composes script text inline; preview route is /atlas/v/<candidate>/.
const satnavRoot = new URL('../../../', location.href);
void async function () {
  const compass = new URL('https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/');
  const { buildDestination } = await import(new URL('tools/satnav/place.mjs', satnavRoot));
  const { normaliseOrigin } = await import(new URL('tools/vicinity/src/model.mjs', satnavRoot));
  const style = document.createElement('style');
  style.textContent = `
    #gridatlas-satnav-satnav { position:absolute; z-index:1200; right:12px; top:52px;
      width:min(380px,calc(100% - 24px)); max-height:calc(100% - 70px); overflow:auto; box-sizing:border-box; padding:12px;
      border:1px solid #367078; border-radius:6px; background:#08141bed;
      color:#e4f7f7; font:14px/1.45 ui-monospace,monospace; }
    #gridatlas-satnav-satnav h2 { margin:0 0 8px; font:inherit; font-weight:bold; color:#00ffff; }
    #gridatlas-satnav-satnav p { margin:8px 0 0; overflow-wrap:anywhere; }
    #gridatlas-satnav-satnav .actions { display:flex; flex-wrap:wrap; gap:6px; }
    #gridatlas-satnav-satnav button { min-height:44px; max-width:100%; padding:6px 9px;
      border:1px solid #367078; border-radius:3px; background:#07191f;
      color:#bff7f9; font:inherit; cursor:pointer; text-align:left; }
    #gridatlas-satnav-satnav button:disabled { color:#8ba0a2; cursor:default; }
    #gridatlas-satnav-satnav button:focus-visible { outline:2px solid #fff; outline-offset:1px; }
    #gridatlas-satnav-satnav [hidden] { display:none; }
  `;
  document.head.append(style);
  const panel = document.createElement('section');
  panel.id = 'gridatlas-satnav-satnav';
  panel.setAttribute('aria-labelledby', 'gridatlas-satnav-satnav-title');
  const heading = document.createElement('h2');
  heading.id = 'gridatlas-satnav-satnav-title';
  heading.textContent = 'SatNav destination';
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
  const pick = button('pick', 'Choose point on satellite');
  const origin = button('origin', 'Use Vicinity origin');
  const asset = button('asset', 'Use highlighted asset');
  const confirm = button('confirm', 'Use in SatNav', confirmation);
  const cancel = button('cancel', 'Cancel', confirmation);
  const vicinity = button('vicinity', 'Explore this point in Vicinity', confirmation);
  const planned = button('planned', 'Use selected project record');
  const manual = document.createElement('form');
  const field = (label, id) => {
    const wrap=document.createElement('label');wrap.textContent=label;
    const input=document.createElement('input');input.id='gridatlas-satnav-'+id;
    input.type='text';input.style.cssText='display:block;box-sizing:border-box;width:100%;min-height:44px;background:#07191f;color:white;border:1px solid #367078';
    wrap.append(input);manual.append(wrap);return input;
  };
  const latitude=field('Latitude (signed WGS84)','latitude');
  const longitude=field('Longitude (signed WGS84)','longitude');
  latitude.inputMode=longitude.inputMode='decimal';
  const manualLabel=field('Optional destination label','label');
  const commit=button('manual','Choose coordinates',manual);commit.type='submit';
  const lookup=document.createElement('div');
  const searchLabel=document.createElement('label');searchLabel.textContent='Existing substation name or source ID';
  const search=document.createElement('input');search.type='search';search.style.cssText=latitude.style.cssText;searchLabel.append(search);lookup.append(searchLabel);
  const find=button('search','Find substations',lookup);
  const results=document.createElement('div');lookup.append(results);
  const hint=document.createElement('p');hint.textContent='For planned projects use the existing map search, then select the exact project record here. Coordinates are source points, not confirmed entrances. No route or access permission is implied.';
  const sources=document.createElement('details');
  const summary=document.createElement('summary');summary.textContent='Search substations or enter coordinates';summary.style.minHeight='44px';
  sources.append(summary,lookup,manual,hint);
  panel.append(heading, actions, status, confirmation,sources);
  document.body.append(panel);
  panel.hidden = true;
  const toggle = button('toggle','SatNav destination',document.body);
  toggle.setAttribute('aria-expanded','false');
  toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
  const close=button('close','Close destination panel',panel);
  close.onclick=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();};

  const samePoint = (a, b) => a?.length === 2 && b?.length === 2 && a[0] === b[0] && a[1] === b[1];
  const satellite = () => document.querySelector('#scada-ui-container input[name="bm"][value="sat"]');
  let map, marker, armed = false, pending = null, searchEpoch=0;

  // Read the exact current project or swiped item from the native Vicinity card.
  function currentCardPoint(kind) {
    const card = window.__GRIDATLAS_MODULES__?.ukOfftakers?.state.pp;
    if (!card?.project) return null;
    if (kind === 'origin') return { card, name: card.r.n, at: card.r.a };
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
    marker?.remove();
    marker = null;
    status.textContent = message;
    render();
  }

  function render() {
    pick.disabled = !map?.getLayer('l-sat') || !satellite();
    pick.setAttribute('aria-pressed', String(armed));
    origin.disabled = !currentCardPoint('origin');
    asset.disabled = !currentCardPoint('asset');
    origin.hidden = origin.disabled;
    asset.hidden = asset.disabled;
    confirmation.hidden = !armed && !pending;
    confirm.hidden = !pending;
    vicinity.hidden = !pending;
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
    if (armed && event.lngLat) stage('map', { name: 'Chosen map point', at: [event.lngLat.lng, event.lngLat.lat] });
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
    const state=window.__GRIDATLAS_PLACE_SEARCH__, selected=state?.last_selection;
    if(!selected) return null;
    // Retain the exact search record, not a name/proximity join or summary.
    const rows=(state.last_results||[]).filter(r=>r.repd_ref===selected.repd_ref&&r.longitude===selected.longitude&&r.latitude===selected.latitude);
    return rows.length===1?rows[0]:null;
  }
  planned.onclick=()=>{
    const record=selectedProject();
    if(!record){status.textContent='Choose an exact project using the existing map search first.';return;}
    if(!Number.isFinite(record.longitude)||!Number.isFinite(record.latitude)){
      status.textContent='This project has no located source point. Choose an explicit pin or enter coordinates; no nearest site is substituted.';return;
    }
    stage('planned',{name:record.name,at:[record.longitude,record.latitude],record,signature:JSON.stringify(record)});
    if(pending)status.textContent+=' · REPD '+record.repd_ref+' · '+(record.status||'status not stated')+' · '+[record.address,record.postcode].filter(Boolean).join(', ')+' · source project point; entrance unverified';
  };
  manual.onsubmit=event=>{
    event.preventDefault();
    const number=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
    if(!number.test(latitude.value.trim())||!number.test(longitude.value.trim())||Math.abs(Number(latitude.value))>90||Math.abs(Number(longitude.value))>180||(!Number(latitude.value)&&!Number(longitude.value))){status.textContent='Enter valid signed latitude and longitude. Previous selection retained.';return;}
    searchEpoch++;results.textContent='';
    stage('manual',{name:manualLabel.value.trim()||'Manual coordinate point',at:[Number(longitude.value),Number(latitude.value)]});
  };
  let stationIndex;
  find.onclick=async()=>{
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
    if(pending.kind==='planned'&&JSON.stringify(selectedProject())!==pending.selection.signature){reset('Project selection changed. Select it again.');return false;}
    if(['origin','asset'].includes(pending.kind)){
      const current=currentCardPoint(pending.kind), selection=pending.selection;
      if(!current||current.card!==selection.card||current.index!==selection.index||current.name!==selection.name||!samePoint(current.at,pending.value.at)){reset('The Vicinity selection changed. Select it again.');return false;}
    }
    return true;
  }
  vicinity.onclick=()=>{
    if(!stillCurrent())return;
    const {value,selection,kind}=pending;
    const opened=window.__GRIDATLAS_MODULES__?.ukOfftakers?.openPointVicinity?.({at:value.at,name:value.name,kind,repdRef:kind==='planned'?selection.record.repd_ref:null,status:kind==='planned'?selection.record.status:null});
    if(opened){reset('Vicinity opened at the selected source point.');panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
    else status.textContent='Vicinity engine not ready. Selection retained; retry when loaded.';
  };
  cancel.onclick = () => { searchEpoch++;results.textContent='';reset('Selection cancelled.'); pick.focus(); };
  confirm.onclick = () => {
    if (!stillCurrent()) return;
    const { kind, selection, value } = pending;
    if (kind === 'origin' || kind === 'asset') {
      const current = currentCardPoint(kind);
      if (!current || current.card !== selection.card || current.index !== selection.index ||
          current.name !== selection.name || !samePoint(current.at, value.at)) {
        reset('The Vicinity selection changed. Select it again.');
        pick.focus();
        return;
      }
    }
    const query = buildDestination({ name: value.name, coordinates: value.at, mode: 'compass' });
    location.assign(new URL(query, compass));
  };
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && (armed || pending)) { event.preventDefault(); cancel.click(); }
  });
  for (const type of ['click', 'dblclick', 'mousedown', 'pointerdown', 'touchstart']) {
    panel.addEventListener(type, event => event.stopPropagation());
  }

  function refresh() {
    const nativeMap = window.__GRIDATLAS_V9_MAP__;
    if (nativeMap && nativeMap !== map && nativeMap.getLayer('l-sat')) {
      map?.off('click', mapClick);
      map = nativeMap;
      map.getContainer().append(panel);
      const stack=document.querySelector('.map-controls');if(stack)stack.append(toggle);
      map.on('click', mapClick);
      status.textContent = 'Choose a point or use an open Vicinity card.';
    }
    render();
  }
  refresh();
  let timer = setInterval(refresh, 250);
  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    map?.off('click', mapClick);
    reset('Choose a point or use an open Vicinity card.');
    map = null;
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    refresh();
    timer = setInterval(refresh, 250);
  });
}().catch(error => console.error('Detached SatNav handoff failed', error));
