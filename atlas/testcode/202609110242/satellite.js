/* Satellite-only test cartridge. No project, grid, substation or branding edits. */
(() => {
  'use strict';
  const VERSION = '202609110242';
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
  async function sentinel() {
    cancel(); const token = request;
    const centre = map.getCenter(), point = [centre.lng, centre.lat];
    if (map.getZoom() < 6) { say('Zoom in to a project (level 6+) before loading S2.'); return; }
    if (active && covers(active.item, point) && Date.now() - active.fetched < 300000) {
      metrics.reused++; mode = 's2'; visible('l-sat', true);
      LAYER.forEach((id, i) => visible(id, i === active.slot));
      orderImagery(); updateButtons(); say(sceneText(active.item) + ' · Copernicus / Microsoft PC; Esri outside scene'); return;
    }
    const ownController = new AbortController(); controller = ownController; const signal = ownController.signal;
    let metadataTimer = setTimeout(() => ownController.abort(), 25000), stage = null;
    say('Finding recent S2 at map centre; current map retained…');
    try {
      const key = point.map(x => x.toFixed(3)).join(',');
      let result = cache.get(key);
      if (!result || Date.now() - result.fetched > 300000 || !covers(result.item, point)) {
        const now = new Date(), start = new Date(now.getTime() - 60 * 86400000);
        const query = new URLSearchParams({ collections: 'sentinel-2-l2a', intersects: JSON.stringify({ type: 'Point', coordinates: point }), datetime: start.toISOString() + '/' + now.toISOString(), sortby: '-datetime', limit: '50' });
        metrics.searches++;
        const found = await json(ROOT + '/api/stac/v1/search?' + query, signal);
        const rows = (found.features || []).filter(f => Number.isFinite(Date.parse(f.properties?.datetime)) && covers(f, point));
        rows.sort((a, b) => Date.parse(b.properties.datetime) - Date.parse(a.properties.datetime));
        const item = rows.find(f => finite(f.properties['eo:cloud_cover']) && f.properties['eo:cloud_cover'] <= 35) || rows[0];
        if (!item) throw Error('No scene covering this point in the last 60 days.');
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
  let scheduled = false;
  function schedulePosition() { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; position(); }); } }
  function position() {
    if (!panel?.isConnected) return;
    const host = map.getContainer().getBoundingClientRect(), gap = 8;
    const shown = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > host.top && r.top < host.bottom && s.display !== 'none' && s.visibility !== 'hidden'; };
    const obstacles = [...document.querySelectorAll('.search-bar-wrapper,#gridatlas-menu-bar,.maplibregl-popup-content,.gm-panel,button')].filter(e => !panel.contains(e) && shown(e)).map(e => e.getBoundingClientRect());
    const search = document.querySelector('.search-bar-wrapper')?.getBoundingClientRect();
    const header = document.getElementById('gridatlas-menu-bar')?.getBoundingClientRect();
    const overlaps = (a, b) => a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom + 3 && a.bottom > b.top - 3;
    panel.hidden = false;
    for (const compact of [false, true]) {
      panel.dataset.compact = String(compact);
      const size = panel.getBoundingClientRect();
      const xs = [host.right - size.width - gap, host.left + gap];
      const ys = [Math.max(host.top + gap, (search?.bottom || host.top) + gap), Math.max(host.top + gap, (header?.bottom || host.top) + gap)];
      for (const y of ys) for (const x of xs) {
        const candidate = { left: x, right: x + size.width, top: y, bottom: y + size.height };
        if (candidate.bottom <= Math.min(host.bottom, innerHeight) - gap && !obstacles.some(r => overlaps(candidate, r))) {
          panel.style.left = (x - host.left) + 'px'; panel.style.top = (y - host.top) + 'px'; return;
        }
      }
    }
    // An open native menu/card has priority. Restore the add-on when it closes.
    panel.hidden = true;
  }
  function install(m) {
    if (panel || !m.getLayer('l-sat')) return;
    map = m; window.__GRIDATLAS_SATELLITE_TEST_MAP__ = map;
    const css = document.createElement('style'); css.textContent = `
#sat-test-panel{position:absolute;z-index:100;width:300px;max-width:calc(100% - 16px);box-sizing:border-box;padding:6px;background:#070d11f2;color:#cfe6e8;border:1px solid #426d73;border-radius:6px;font:11px/1.25 ui-monospace,monospace}
#sat-test-panel[hidden]{display:none!important}#sat-test-panel .sat-row{display:flex;gap:4px}
#sat-test-panel button{min-height:44px;min-width:44px;flex:1;padding:5px;border:1px solid #426d73;border-radius:4px;background:#0d171c;color:#bde6e8;font:600 11px ui-monospace,monospace;cursor:pointer;touch-action:manipulation}
#sat-test-panel button[aria-pressed=true]{border-color:#00ffff;background:#183940;color:#00ffff}
#sat-test-panel button:focus-visible{outline:2px solid #fff;outline-offset:1px}
#sat-test-status{margin-top:5px;min-height:28px;overflow-wrap:anywhere}#sat-test-panel[data-compact=true] #sat-test-status{display:none}
`;
    document.head.appendChild(css);
    panel = document.createElement('section'); panel.id = 'sat-test-panel'; panel.setAttribute('aria-label', 'Satellite comparison test');
    panel.innerHTML = '<div class="sat-row"><button id="sat-test-dark" type="button">DARK</button><button id="sat-test-esri" type="button">ESRI</button><button id="sat-test-s2" type="button">RECENT S2</button></div><div id="sat-test-status" role="status" aria-live="polite"></div>';
    map.getContainer().appendChild(panel); status = panel.querySelector('#sat-test-status');
    for (const event of ['pointerdown', 'touchstart', 'dblclick', 'wheel']) panel.addEventListener(event, e => e.stopPropagation(), { passive: true });
    panel.addEventListener('click', e => { e.stopPropagation(); const id = e.target.closest('button')?.id; if (id === 'sat-test-s2') sentinel(); else if (id === 'sat-test-esri') basic('esri'); else if (id === 'sat-test-dark') basic('dark'); });
    document.addEventListener('change', e => { if (e.target.name === 'bm' || e.target.name === 'bm-fs') basic(e.target.value === 'sat' ? 'esri' : 'dark'); });
    const resize = new ResizeObserver(schedulePosition); resize.observe(map.getContainer());
    const search = document.querySelector('.search-bar-wrapper'); if (search) resize.observe(search);
    new MutationObserver(records => { if (records.some(r => !panel.contains(r.target) && (r.type === 'childList' || r.target.matches?.('.maplibregl-popup,.maplibregl-popup-content,.gm-panel,.search-bar-wrapper,body,#gridatlas-dash-toggle')))) schedulePosition(); }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    window.addEventListener('resize', schedulePosition); window.visualViewport?.addEventListener('resize', schedulePosition);
    document.addEventListener('click', () => setTimeout(schedulePosition, 50));
    map.on('moveend', () => { if (mode === 's2' && active) { const c = map.getCenter(); say(covers(active.item, [c.lng, c.lat]) ? sceneText(active.item) + ' · Copernicus / Microsoft PC; Esri outside scene' : 'Outside S2 scene; Esri shown. Press RECENT S2 for this location.'); } });
    window.__GRIDATLAS_SATELLITE_TEST__ = { snapshot: () => ({ version: VERSION, mode, scene: active?.item.id || null, bounds: active?.bounds || null, ...metrics }) };
    updateButtons(); say('Dark map · satellite test ' + VERSION);
  }
  // Consume the already-captured map; do not patch the MapLibre constructor.
  let attempts = 0;
  const timer = setInterval(() => {
    const m = window.__GRIDATLAS_V9_MAP__;
    if (m?.getLayer('l-sat')) { clearInterval(timer); install(m); }
    else if (++attempts >= 240) clearInterval(timer);
  }, 250);
})();
