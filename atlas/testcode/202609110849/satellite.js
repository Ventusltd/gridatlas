/* Satellite-only test cartridge. No project, grid, substation or branding edits. */
(() => {
  'use strict';
  const VERSION = '202609110849';
  let catalogue = [], selectionPolicy = 'latest';
  const ROOT = 'https://planetarycomputer.microsoft.com';
  const SOURCE = ['sat-test-s2-0', 'sat-test-s2-1'];
  const LAYER = SOURCE.map(id => id + '-layer');
  const cache = new Map();
  const owners = [null, null];
  let map, panel, status, active = null, mode = 'dark', request = 0, controller;
  const metrics = { searches: 0, tilejson: 0, reused: 0, sourceAdds: 0, tileErrors: 0, loadedTileEvents: 0 };
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const visible = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  const say = text => { if (status.textContent !== text) status.textContent = text; panel.title = text; schedulePosition(); };
  function containsRing(p, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function covers(item, p) {
    const g = item.geometry;
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    return polys.some(poly => containsRing(p, poly[0]) && !poly.slice(1).some(r => containsRing(p, r)));
  }
  function sceneText(item) {
    const cloud = item.properties['eo:cloud_cover'];
    return 'S2 ' + item.properties.datetime.slice(0, 10) + ' · 10 m · scene cloud ' + (finite(cloud) ? cloud.toFixed(1) + '%' : 'unknown');
  }
  function allowed(url) { const u = new URL(url); if (u.origin !== ROOT) throw Error('Unexpected imagery service'); return u.href; }
  async function json(url, signal) {
    const r = await fetch(allowed(url), { signal });
    if (!r.ok) throw Error('Imagery service HTTP ' + r.status);
    return r.json();
  }
  function orderImagery() {
    // Move only the imagery. Some original engineering overlays arrive before l-sat.
    const style = map.getStyle();
    const anchor = style.layers.find(l => style.sources[l.source]?.type === 'geojson');
    if (!anchor) return;
    for (const id of ['l-sat', ...LAYER]) if (map.getLayer(id)) map.moveLayer(id, anchor.id);
  }
  function updateButtons() {
    for (const [id, value] of [['dark', 'dark'], ['esri', 'esri'], ['s2', 's2']]) {
      document.getElementById('sat-test-' + id).setAttribute('aria-pressed', String(mode === value));
    }
    // Keep the original Dark/Satellite choices truthful; never dispatch their handlers.
    document.querySelectorAll('input[name="bm"],input[name="bm-fs"]').forEach(e => { e.checked = mode !== 's2' && e.value === (mode === 'esri' ? 'sat' : 'dark'); });
  }
  function cancel() { request++; if (controller) controller.abort(); controller = null; }
  function basic(next) {
    cancel(); mode = next;
    LAYER.forEach(id => visible(id, false));
    visible('l-sat', next === 'esri');
    orderImagery(); updateButtons();
    say(next === 'esri' ? 'Esri World Imagery · capture date varies' : 'Dark map · satellite test ' + VERSION);
  }
  function removeSlot(slot, owner) {
    if (owner !== undefined && owners[slot] !== owner) return;
    if (map.getLayer(LAYER[slot])) map.removeLayer(LAYER[slot]);
    if (map.getSource(SOURCE[slot])) map.removeSource(SOURCE[slot]);
  }
  function awaitTiles(sourceId, signal) {
    return new Promise((resolve, reject) => {
      let sawTile = false;
      const done = error => { clearTimeout(timer); map.off('sourcedata', data); map.off('error', errorEvent); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
      const abort = () => done(new DOMException('Cancelled', 'AbortError'));
      const data = e => {
        if (e.sourceId !== sourceId) return;
        // MapLibre 3.6 tile-completion events do not set sourceDataType.
        if (e.tile?.state === 'loaded') { sawTile = true; metrics.loadedTileEvents++; }
        if (sawTile && map.isSourceLoaded(sourceId)) done();
      };
      const errorEvent = e => { if (e.sourceId === sourceId) metrics.tileErrors++; };
      const timer = setTimeout(() => done(Error('Tiles took too long; previous map retained. Retry S2.')), 25000);
      map.on('sourcedata', data); map.on('error', errorEvent); signal.addEventListener('abort', abort, { once: true });
    });
  }
  async function sentinel(preferredId = null, force = false) {
    cancel(); const token = request;
    const centre = map.getCenter(), point = [centre.lng, centre.lat];
    if (map.getZoom() < 6) { say('Zoom in to a project (level 6+) before loading S2.'); return; }
    if (!preferredId && !force && active && covers(active.item, point) && Date.now() - active.fetched < 300000) {
      metrics.reused++; mode = 's2'; visible('l-sat', true);
      LAYER.forEach((id, i) => visible(id, i === active.slot));
      orderImagery(); updateButtons(); say(sceneText(active.item) + ' · Copernicus / Microsoft PC; Esri outside scene'); return;
    }
    const ownController = new AbortController(); controller = ownController; const signal = ownController.signal;
    let metadataTimer = setTimeout(() => ownController.abort(), 25000), stage = null;
    say('Finding dated S2 scenes at map centre; current map retained…');
    try {
      const key = point.map(x => x.toFixed(3)).join(',') + '|' + selectionPolicy + '|' + (preferredId || '');
      let result = cache.get(key);
      if (!result || Date.now() - result.fetched > 300000 || !covers(result.item, point)) {
        const now = new Date(), start = new Date(now.getTime() - 60 * 86400000);
        const query = new URLSearchParams({ collections: 'sentinel-2-l2a', intersects: JSON.stringify({ type: 'Point', coordinates: point }), datetime: start.toISOString() + '/' + now.toISOString(), sortby: '-datetime', limit: '100' });
        let found;
        if (preferredId && catalogue.some(f => f.id === preferredId && covers(f, point))) found = {features: catalogue};
        else { metrics.searches++; found = await json(ROOT + '/api/stac/v1/search?' + query, signal); }
        const rows = (found.features || []).filter(f => Number.isFinite(Date.parse(f.properties?.datetime)) && covers(f, point));
        rows.sort((a, b) => Date.parse(b.properties.datetime) - Date.parse(a.properties.datetime));
        catalogue = rows;
        const item = preferredId ? rows.find(f => f.id === preferredId) : selectionPolicy === 'latest' ? rows[0] : (rows.find(f => finite(f.properties['eo:cloud_cover']) && f.properties['eo:cloud_cover'] <= 35) || rows[0]);
        if (!item) throw Error('No scene covering this point in the last 60 days.');
        sceneOptions(item.id);
        if (!item.assets?.tilejson?.href) throw Error('Scene has no TileJSON.');
        metrics.tilejson++; const tj = await json(item.assets.tilejson.href, signal);
        if (!Array.isArray(tj.tiles) || !tj.tiles.length) throw Error('No image tiles.');
        tj.tiles.forEach(allowed);
        const bounds = tj.bounds || item.bbox;
        if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(finite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw Error('Invalid scene bounds.');
        result = { item, tj, bounds, fetched: Date.now() }; cache.set(key, result);
        while (cache.size > 5) cache.delete(cache.keys().next().value);
      } else metrics.reused++;
      clearTimeout(metadataTimer);
      if (signal.aborted || token !== request) return;
      if (active?.item.id === result.item.id) {
        active.fetched = result.fetched; mode = 's2'; visible('l-sat', true);
        LAYER.forEach((id, i) => visible(id, i === active.slot)); updateButtons(); say(sceneText(active.item) + ' · Copernicus / Microsoft PC; Esri outside scene'); return;
      }
      stage = active ? 1 - active.slot : 0; removeSlot(stage); owners[stage] = token;
      const tj = result.tj;
      map.addSource(SOURCE[stage], { type: 'raster', tiles: tj.tiles, bounds: result.bounds, tileSize: 256,
        minzoom: 6, maxzoom: Math.min(14, finite(tj.maxzoom) ? tj.maxzoom : 14),
        attribution: 'Contains modified Copernicus Sentinel data; Microsoft Planetary Computer' });
      metrics.sourceAdds++;
      const ready = awaitTiles(SOURCE[stage], signal);
      // Near-transparent, not hidden: request new tiles without removing the old view.
      map.addLayer({ id: LAYER[stage], type: 'raster', source: SOURCE[stage], paint: { 'raster-opacity': 0.001, 'raster-opacity-transition': { duration: 180 }, 'raster-fade-duration': 180 } });
      orderImagery(); say('Loading ' + sceneText(result.item) + '; current map retained…');
      await ready;
      if (signal.aborted || token !== request) { removeSlot(stage, token); return; }
      active = { ...result, slot: stage }; mode = 's2';
      visible('l-sat', true); LAYER.forEach((id, i) => visible(id, i === stage));
      map.setPaintProperty(LAYER[stage], 'raster-opacity', 1);
      updateButtons(); say(sceneText(active.item) + ' · Copernicus / Microsoft PC; Esri outside scene');
    } catch (e) {
      if (stage !== null && active?.slot !== stage) removeSlot(stage, token);
      if (token === request && e.name !== 'AbortError') say('S2: ' + e.message);
      if (token === request && e.name === 'AbortError') say('S2 request timed out; current map retained.');
    } finally { clearTimeout(metadataTimer); if (controller === ownController) controller = null; }
  }
  // This is the replacement UI tail of the satellite-only test cartridge.
  // It MOVES the original quick buttons; it never clones them or their logic.
  let scheduled = false, nativeButtons = [], savedPosition = null, dragging = null;
  let originalPositions = [], userCollapsed = false;
  function schedulePosition() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; position(); }); }
  }
  function sceneOptions(selected) {
    const select = document.getElementById('sat-scene');
    if (!select) return;
    select.replaceChildren();
    for (const item of catalogue) {
      const option = document.createElement('option'), cloud = item.properties['eo:cloud_cover'];
      option.value = item.id;
      option.textContent = item.properties.datetime.slice(0,16).replace('T',' ') + ' UTC · ' + (finite(cloud) ? cloud.toFixed(1)+'%' : '?') + ' scene cloud';
      option.selected = item.id === selected; select.appendChild(option);
    }
    select.disabled = !catalogue.length;
  }
  function nativeQuickButtons() {
    const all = [...document.querySelectorAll('button')].filter(e => !e.closest('#gridatlas-menu-bar,#sat-test-panel'));
    return [all.find(e => /⚡\s*grid/i.test(e.textContent)), all.find(e => /[◉◎]\s*subs/i.test(e.textContent))];
  }
  function shownRect(e) {
    if (!e) return null;
    const r=e.getBoundingClientRect(), s=getComputedStyle(e);
    return r.width && r.height && s.display!=='none' && s.visibility!=='hidden' && !e.closest('[hidden]') ? r : null;
  }
  function bounds() {
    const h=map.getContainer().getBoundingClientRect(), v=window.visualViewport;
    return {left:Math.max(h.left,v?.offsetLeft||0)+8, top:Math.max(h.top,v?.offsetTop||0)+8,
      right:Math.min(h.right,(v?.offsetLeft||0)+(v?.width||innerWidth))-8,
      bottom:Math.min(h.bottom,(v?.offsetTop||0)+(v?.height||innerHeight))-8,host:h};
  }
  function overlap(a,b,gap=6) { return a.left<b.right+gap && a.right>b.left-gap && a.top<b.bottom+gap && a.bottom>b.top-gap; }
  function position() {
    if (!panel?.isConnected || dragging) return;
    const b=bounds();
    const obstacles=[...document.querySelectorAll('.search-bar-wrapper,#search-results,#gridatlas-menu-bar,.gm-panel,.maplibregl-popup-content,#gridatlas-dash-toggle')]
      .filter(e=>!panel.contains(e)).map(shownRect).filter(r=>r && r.bottom>b.top && r.top<b.bottom && r.right>b.left && r.left<b.right);
    panel.hidden=false;
    panel.dataset.collapsed=String(userCollapsed);
    for (const compact of [false,true]) {
      panel.dataset.autoCompact=String(compact);
      const size=panel.getBoundingClientRect(), w=size.width,h=size.height;
      const clampX=x=>Math.max(b.left,Math.min(b.right-w,x));
      const clampY=y=>Math.max(b.top,Math.min(b.bottom-h,y));
      const candidates=[];
      if(savedPosition) candidates.push([clampX(b.host.left+savedPosition.x),clampY(b.host.top+savedPosition.y)]);
      // Home is bottom-left, beside the existing map tools, never below search.
      candidates.push([b.left,b.bottom-h],[b.right-w,b.bottom-h]);
      for(const r of obstacles) { candidates.push([b.left,r.top-h-8],[b.right-w,r.top-h-8]); }
      candidates.push([b.left,b.top+40],[b.right-w,b.top+40]);
      for(const r of obstacles) candidates.push([b.left,r.bottom+8],[b.right-w,r.bottom+8]);
      for(const [x,y] of candidates) {
        const r={left:x,top:y,right:x+w,bottom:y+h};
        if(x<b.left || r.right>b.right || y<b.top || r.bottom>b.bottom || obstacles.some(o=>overlap(r,o))) continue;
        panel.style.left=(x-b.host.left)+'px'; panel.style.top=(y-b.host.top)+'px'; return;
      }
    }
    // Native search / menus / cards have priority. Return the dock on close.
    panel.hidden=true;
  }
  function dragStart(e) {
    if (e.button!==undefined && e.button!==0) return;
    e.preventDefault();e.stopPropagation();
    const r=panel.getBoundingClientRect();
    dragging={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top};
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.dataset.dragging='true';
  }
  function dragMove(e) {
    if(!dragging || dragging.id!==e.pointerId)return;
    e.preventDefault();e.stopPropagation();
    const b=bounds(),r=panel.getBoundingClientRect();
    const x=Math.max(b.left,Math.min(b.right-r.width,dragging.left+e.clientX-dragging.x));
    const y=Math.max(b.top,Math.min(b.bottom-r.height,dragging.top+e.clientY-dragging.y));
    panel.style.left=(x-b.host.left)+'px';panel.style.top=(y-b.host.top)+'px';
  }
  function dragEnd(e) {
    if(!dragging || e.pointerId!==dragging.id)return;
    e.stopPropagation();
    const b=bounds(),r=panel.getBoundingClientRect();
    savedPosition={x:r.left-b.host.left,y:r.top-b.host.top};
    dragging=null;panel.dataset.dragging='false';
    try { sessionStorage.setItem('gridatlas.satellite.dock.position',JSON.stringify(savedPosition)); } catch(_) {}
    schedulePosition();
  }
  function install(m) {
    if(panel || !m.getLayer('l-sat'))return;
    const quick=nativeQuickButtons();if(quick.some(e=>!e))return false;
    map=m;nativeButtons=quick;window.__GRIDATLAS_SATELLITE_TEST_MAP__=map;
    try { const p=JSON.parse(sessionStorage.getItem('gridatlas.satellite.dock.position')); if(p && finite(p.x)&&finite(p.y)) savedPosition=p; }catch(_){}
    const css=document.createElement('style');css.id='sat-dock-css';css.textContent=`
#sat-test-panel{position:absolute;z-index:110;width:360px;max-width:calc(100% - 20px);box-sizing:border-box;padding:5px;background:#070d11f2;color:#cfe6e8;border:1px solid #426d73;border-radius:6px;font:11px/1.3 ui-monospace,monospace}
#sat-test-panel[hidden]{display:none!important}
#sat-test-panel .sat-head,#sat-test-panel .sat-row{display:flex;gap:4px;align-items:stretch}
#sat-test-panel .sat-head{margin-bottom:4px}
#sat-test-panel button,#sat-test-panel select{position:static!important;inset:auto!important;transform:none!important;box-sizing:border-box;min-width:44px;min-height:44px;margin:0!important;padding:5px;border:1px solid #426d73;border-radius:4px;background:#0d171c;color:#bde6e8;font:600 10px ui-monospace,monospace;cursor:pointer;touch-action:manipulation}
#sat-test-panel .sat-row button{flex:1 1 0;white-space:nowrap}
#sat-test-panel #sat-drag{flex:1;text-align:left;touch-action:none;cursor:grab;user-select:none}
#sat-test-panel[data-dragging=true] #sat-drag{cursor:grabbing}
#sat-test-panel #sat-reset,#sat-test-panel #sat-collapse{flex:0 0 44px}
#sat-test-panel button[aria-pressed=true]{border-color:#00ffff;background:#183940;color:#00ffff}
#sat-test-panel :focus-visible{outline:2px solid white;outline-offset:1px}
#sat-test-status{margin-top:5px;overflow-wrap:anywhere;font-size:10px;line-height:1.3}
#sat-scene-options{margin-top:6px;border-top:1px solid #426d73;padding-top:5px}
#sat-scene-options[hidden]{display:none!important}
#sat-test-panel select{width:100%;margin-top:4px!important;font-size:10px}
#sat-test-panel .sat-note{margin:5px 0 0;color:#9cb8bd;font-size:10px}
#sat-test-panel[data-collapsed=true] .sat-row,#sat-test-panel[data-collapsed=true] #sat-test-status,#sat-test-panel[data-collapsed=true] #sat-scene-options{display:none!important}
#sat-test-panel[data-auto-compact=true] #sat-test-status,#sat-test-panel[data-auto-compact=true] #sat-scene-options{display:none!important}
`;
    document.head.appendChild(css);
    panel=document.createElement('section');panel.id='sat-test-panel';panel.setAttribute('aria-label','Movable grid and imagery controls');
    panel.innerHTML='<div class="sat-head"><button id="sat-drag" type="button" aria-label="Drag map controls; arrow keys also move">⠿ MOVE</button><button id="sat-scenes-toggle" type="button" aria-expanded="false" aria-controls="sat-scene-options">SCENES</button><button id="sat-reset" type="button" aria-label="Return controls to bottom">↩</button><button id="sat-collapse" type="button" aria-label="Collapse controls" aria-expanded="true">−</button></div><div class="sat-row" role="group" aria-label="Grid, substations and imagery"><button id="sat-test-dark" type="button">DARK</button><button id="sat-test-esri" type="button">ESRI</button><button id="sat-test-s2" type="button">S2</button></div><div id="sat-test-status" role="status" aria-live="polite"></div><div id="sat-scene-options" hidden><label>Scene selection at map centre<select id="sat-policy"><option value="latest">Newest acquisition (may be cloudy)</option><option value="clear">Newest with ≤35% scene cloud</option></select></label><label>Capture date<select id="sat-scene" disabled><option>Load S2 to list dates</option></select></label><button id="sat-refresh" type="button">REFRESH DATES</button><p class="sat-note">10 m RGB. Scene cloud is not cloud at this site. Up to 100 scenes / 60 days. Esri remains outside the selected scene. No site status is inferred.</p></div>';
    map.getContainer().appendChild(panel);status=panel.querySelector('#sat-test-status');
    const row=panel.querySelector('.sat-row');
    for(let i=0;i<quick.length;i++) {
      const node=quick[i];originalPositions.push({node,parent:node.parentNode,next:node.nextSibling});
      node.dataset.satNative=i===0?'grid':'subs';
      row.insertBefore(node,document.getElementById('sat-test-dark'));
    }
    const handle=panel.querySelector('#sat-drag');
    handle.addEventListener('pointerdown',dragStart);handle.addEventListener('pointermove',dragMove);
    handle.addEventListener('pointerup',dragEnd);handle.addEventListener('pointercancel',dragEnd);
    handle.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();const b=bounds(),r=panel.getBoundingClientRect(),n=e.shiftKey?5:20;savedPosition={x:r.left-b.host.left+(e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0),y:r.top-b.host.top+(e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0)};schedulePosition();});
    for(const event of ['pointerdown','touchstart','dblclick','wheel'])panel.addEventListener(event,e=>e.stopPropagation(),{passive:true});
    panel.addEventListener('click',e=>{
      e.stopPropagation();const id=e.target.closest('button')?.id;
      if(id==='sat-test-s2')sentinel();else if(id==='sat-test-esri')basic('esri');else if(id==='sat-test-dark')basic('dark');
      else if(id==='sat-reset'){savedPosition=null;try{sessionStorage.removeItem('gridatlas.satellite.dock.position')}catch(_){}schedulePosition();}
      else if(id==='sat-collapse'){userCollapsed=!userCollapsed;e.target.textContent=userCollapsed?'+':'−';e.target.setAttribute('aria-expanded',String(!userCollapsed));schedulePosition();}
      else if(id==='sat-scenes-toggle'){const options=panel.querySelector('#sat-scene-options');options.hidden=!options.hidden;e.target.setAttribute('aria-expanded',String(!options.hidden));userCollapsed=false;panel.querySelector('#sat-collapse').textContent='−';panel.querySelector('#sat-collapse').setAttribute('aria-expanded','true');schedulePosition();}
      else if(id==='sat-refresh')sentinel(null,true);
    });
    panel.addEventListener('change',e=>{e.stopPropagation();if(e.target.id==='sat-policy'){selectionPolicy=e.target.value;sentinel(null,true);}else if(e.target.id==='sat-scene')sentinel(e.target.value,true);});
    document.addEventListener('change',e=>{if(e.target.name==='bm'||e.target.name==='bm-fs')basic(e.target.value==='sat'?'esri':'dark');});
    const resize=new ResizeObserver(schedulePosition);resize.observe(map.getContainer());
    const search=document.querySelector('.search-bar-wrapper');if(search)resize.observe(search);
    new MutationObserver(records=>{if(records.some(r=>!panel.contains(r.target) && (r.type==='childList'||r.target.matches?.('#search-results,.search-bar-wrapper,.gm-panel,.gm-menu,.maplibregl-popup-content,.maplibregl-popup,body,#gridatlas-dash-toggle'))))schedulePosition();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});
    window.addEventListener('resize',schedulePosition);window.visualViewport?.addEventListener('resize',schedulePosition);window.visualViewport?.addEventListener('scroll',schedulePosition);
    document.addEventListener('click',()=>setTimeout(schedulePosition,50));
    map.on('moveend',()=>{if(mode==='s2'&&active){const c=map.getCenter();say(covers(active.item,[c.lng,c.lat])?sceneText(active.item)+' · Esri outside scene':'Outside S2 scene; Esri shown. Press S2 for this location.');}});
    window.__GRIDATLAS_SATELLITE_TEST__={snapshot:()=>({version:VERSION,mode,scene:active?.item.id||null,date:active?.item.properties.datetime||null,bounds:active?.bounds||null,policy:selectionPolicy,scenes:catalogue.length,nativeNodesPreserved:nativeButtons.every(e=>panel.contains(e)),dockMoved:!!savedPosition,...metrics})};
    updateButtons();say('Map tools · drag MOVE to reposition');return true;
  }
  let attempts=0;const timer=setInterval(()=>{const m=window.__GRIDATLAS_V9_MAP__;if(m?.getLayer('l-sat')&&install(m))clearInterval(timer);else if(++attempts>=240)clearInterval(timer);},250);
})();
