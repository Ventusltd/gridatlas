  // Survey UI and boundary/date selection. Original GRID/SUBS nodes are not moved.
  let boundary = null, boundaryRevision = 0, catalogueKey = '', catalogueTime = 0;
  const slots = [null, null], comparisons = { A: null, B: null };
  let nativeNodes = [], gridTitle;
  const empty = () => ({ type: 'FeatureCollection', features: [] });
  const byId = id => panel.querySelector('#' + id);
  const dateISO = d => d.toISOString().slice(0, 10);
  function schedulePosition() { if (panel) panel.removeAttribute('title'); }
  function currentScope() {
    const c = map.getCenter();
    const start = byId('survey-start').value, end = byId('survey-end').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw Error('Choose a valid start and end date.');
    if ((Date.parse(end) - Date.parse(start)) / 86400000 > 366) throw Error('Choose a date range of at most one year.');
    return { geometry: boundary?.geometry || { type: 'Point', coordinates: [c.lng, c.lat] },
      key: (boundary ? 'boundary:' + boundaryRevision : c.lng.toFixed(3) + ',' + c.lat.toFixed(3)) + '|' + start + '|' + end,
      start, end };
  }
  function sceneOptions(selected) {
    const select = byId('sat-scene'); select.replaceChildren();
    if (!catalogue.length) { const o = new Option('Load S2 to list capture dates', ''); select.append(o); }
    for (const item of catalogue) {
      const cloud = item.properties['eo:cloud_cover'];
      const text = item.properties.datetime.slice(0, 16).replace('T', ' ') + ' UTC | ' + (finite(cloud) ? cloud.toFixed(1) + '%' : '?') + ' scene cloud';
      select.append(new Option(text, item.id, false, item.id === selected));
    }
    select.disabled = !catalogue.length;
    byId('survey-count').textContent = catalogue.length ? catalogue.length + ' scenes returned. Maximum 100 newest in the selected range; narrow dates to inspect older captures.' : '';
  }
  async function getCatalogue(scope, signal, force) {
    if (!force && scope.key === catalogueKey && Date.now() - catalogueTime < 300000 && catalogue.length) { metrics.reused++; return catalogue; }
    const body = { collections: ['sentinel-2-l2a'], intersects: scope.geometry,
      datetime: scope.start + 'T00:00:00Z/' + scope.end + 'T23:59:59Z',
      sortby: [{ field: 'datetime', direction: 'desc' }], limit: 100 };
    metrics.searches++;
    const r = await fetch(ROOT + '/api/stac/v1/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!r.ok) throw Error('Scene catalogue HTTP ' + r.status);
    const found = await r.json(); if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const rows = (found.features || []).filter(f => Number.isFinite(Date.parse(f.properties?.datetime)) && f.assets?.tilejson?.href);
    rows.sort((a, b) => Date.parse(b.properties.datetime) - Date.parse(a.properties.datetime));
    catalogue = rows; catalogueKey = scope.key; catalogueTime = Date.now(); sceneOptions(null);
    return rows;
  }
  function paintFootprint(item) {
    const data = item ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: item.geometry }] } : empty();
    if (map.getSource('survey-footprint')) map.getSource('survey-footprint').setData(data);
    else {
      map.addSource('survey-footprint', { type: 'geojson', data });
      map.addLayer({ id: 'survey-footprint-line', type: 'line', source: 'survey-footprint', paint: { 'line-color': '#e6bf64', 'line-width': 1, 'line-dasharray': [4, 3] } });
    }
  }
  function explainScene() {
    if (!active) return;
    say(sceneText(active.item) + ' | Esri outside the scene or in no-data gaps.');
    byId('survey-item').textContent = active.item.id;
    byId('survey-view-date').textContent = active.item.properties.datetime.replace('T', ' ').replace('Z', ' UTC');
  }
  async function showResult(result, token, signal) {
    let stage = slots.findIndex(s => s?.item.id === result.item.id && map.getSource(SOURCE[s.slot]));
    if (stage >= 0) {
      metrics.reused++; active = slots[stage]; mode = 's2';
      visible('l-sat', true); LAYER.forEach((id, i) => visible(id, i === stage));
      map.setPaintProperty(LAYER[stage], 'raster-opacity', 1); orderImagery();
      paintFootprint(active.item); updateButtons(); sceneOptions(active.item.id); explainScene(); return;
    }
    stage = active ? 1 - active.slot : 0; removeSlot(stage); slots[stage] = null; owners[stage] = token;
    try {
      const tj = result.tj;
      map.addSource(SOURCE[stage], { type: 'raster', tiles: tj.tiles, bounds: result.bounds, tileSize: 256,
        minzoom: 6, maxzoom: Math.min(14, finite(tj.maxzoom) ? tj.maxzoom : 14),
        attribution: 'Contains modified Copernicus Sentinel data; Microsoft Planetary Computer' });
      metrics.sourceAdds++;
      const ready = awaitTiles(SOURCE[stage], signal);
      map.addLayer({ id: LAYER[stage], type: 'raster', source: SOURCE[stage], paint: { 'raster-opacity': 0.001, 'raster-opacity-transition': { duration: 180 }, 'raster-fade-duration': 180 } });
      orderImagery(); say('Loading ' + sceneText(result.item) + '; previous map retained.');
      await ready;
      if (signal.aborted || token !== request) { removeSlot(stage, token); return; }
      active = { ...result, slot: stage }; slots[stage] = active; mode = 's2';
      visible('l-sat', true); LAYER.forEach((id, i) => visible(id, i === stage));
      map.setPaintProperty(LAYER[stage], 'raster-opacity', 1); paintFootprint(active.item);
      updateButtons(); sceneOptions(active.item.id); explainScene();
    } catch (error) { if (active?.slot !== stage) removeSlot(stage, token); throw error; }
  }
  async function task(work) {
    cancel(); const token = request, own = new AbortController(); controller = own;
    const timeout = setTimeout(() => own.abort(), 55000);
    panel.setAttribute('aria-busy', 'true');
    try { await work(token, own.signal); }
    catch (e) { if (token === request) say(e.name === 'AbortError' ? 'Image request timed out; previous map retained.' : 'Satellite survey: ' + e.message); }
    finally { clearTimeout(timeout); if (controller === own) { controller = null; panel.setAttribute('aria-busy', 'false'); } }
  }
  async function sentinel(preferredId = null, force = false) {
    if (map.getZoom() < 6) { say('Zoom to a project, or load and fit a boundary, before loading S2.'); return; }
    return task(async (token, signal) => {
      const scope = currentScope(); say('Finding dated scenes intersecting ' + (boundary ? 'the survey boundary' : 'the map centre') + '; previous map retained.');
      const rows = await getCatalogue(scope, signal, force);
      const item = preferredId ? rows.find(f => f.id === preferredId) : selectionPolicy === 'latest' ? rows[0] : (rows.find(f => finite(f.properties['eo:cloud_cover']) && f.properties['eo:cloud_cover'] <= 35) || rows[0]);
      if (!item) throw Error('No available scene in this area and date range.');
      let result = cache.get(item.id);
      if (!result) {
        metrics.tilejson++; const tj = await json(item.assets.tilejson.href, signal);
        if (!Array.isArray(tj.tiles) || !tj.tiles.length) throw Error('Scene has no image tiles.');
        tj.tiles.forEach(allowed); const bounds = tj.bounds || item.bbox;
        if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(finite) || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw Error('Invalid scene footprint.');
        result = { item, tj, bounds, fetched: Date.now() }; cache.set(item.id, result);
        while (cache.size > 8) cache.delete(cache.keys().next().value);
      }
      if (token === request && !signal.aborted) await showResult(result, token, signal);
    });
  }
  function validateBoundary(input) {
    if (input.crs && !/4326|CRS84/.test(JSON.stringify(input.crs))) throw Error('Use WGS84 longitude/latitude GeoJSON.');
    const features = input.type === 'FeatureCollection' ? input.features : [input.type === 'Feature' ? input : { geometry: input }];
    if (!Array.isArray(features) || !features.length || features.length > 100) throw Error('Expected 1–100 polygon features.');
    const polygons = [], points = [];
    for (const f of features) {
      const g = f.geometry; if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) throw Error('Only Polygon or MultiPolygon boundaries are supported.');
      const ps = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      if (!Array.isArray(ps) || !ps.length) throw Error('Empty boundary.');
      for (const poly of ps) {
        if (!Array.isArray(poly) || !poly.length) throw Error('Empty polygon.');
        for (const ring of poly) {
          if (!Array.isArray(ring) || ring.length < 4) throw Error('Polygon rings need at least four coordinates.');
          for (const p of ring) {
            if (!Array.isArray(p) || !finite(p[0]) || !finite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 85.051) throw Error('Invalid longitude/latitude coordinate.');
            points.push(p); if (points.length > 20000) throw Error('Boundary exceeds 20,000 coordinates.');
          }
          if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw Error('Close every polygon ring.');
        }
        polygons.push(poly.map(r => r.map(p => p.slice(0, 2))));
      }
    }
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (bbox[0] === bbox[2] || bbox[1] === bbox[3] || bbox[2] - bbox[0] > 10 || bbox[3] - bbox[1] > 10) throw Error('Use a non-degenerate local project boundary, at most 10 degrees across.');
    return { geometry: { type: 'MultiPolygon', coordinates: polygons }, bbox, vertices: points.length };
  }
  function setBoundary(input, name) {
    const clean = validateBoundary(input); cancel(); basic('dark');
    boundary = { ...clean, name: String(name).slice(0, 120) }; boundaryRevision++; catalogue = []; catalogueKey = ''; comparisons.A = comparisons.B = null;
    const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: clean.geometry }] };
    if (map.getSource('survey-boundary')) map.getSource('survey-boundary').setData(data);
    else {
      map.addSource('survey-boundary', { type: 'geojson', data });
      map.addLayer({ id: 'survey-boundary-case', type: 'line', source: 'survey-boundary', paint: { 'line-color': '#000000', 'line-width': 4 } });
      map.addLayer({ id: 'survey-boundary-line', type: 'line', source: 'survey-boundary', paint: { 'line-color': '#ffffff', 'line-width': 2 } });
    }
    byId('survey-boundary-name').textContent = boundary.name + ' | ' + clean.vertices + ' coordinates';
    byId('survey-fit').disabled = byId('survey-clear').disabled = false;
    paintFootprint(null); sceneOptions(null); compareLabels(); say('Boundary loaded. Fit boundary, then load dated imagery.');
  }
  function closeGrid() { if (gridTitle.closest('.gm-menu')?.classList.contains('gm-open')) gridTitle.click(); }
  function fitBoundary() {
    if (!boundary) return; closeGrid();
    const b = boundary.bbox; map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 170, bottom: 100, left: 35, right: 35 }, maxZoom: 15, duration: 0 });
  }
  function compareLabels() {
    for (const key of ['A', 'B']) {
      byId('survey-show-' + key).disabled = !comparisons[key];
      byId('survey-date-' + key).textContent = comparisons[key] ? comparisons[key].item.properties.datetime.slice(0, 10) : 'Not set';
    }
  }
  function install(m) {
    if (panel || !m.getLayer('l-sat')) return false;
    gridTitle = [...document.querySelectorAll('#gridatlas-menu-bar .gm-title')].find(e => e.textContent.trim().toLowerCase() === 'grid');
    const gridPanel = gridTitle?.closest('.gm-menu')?.querySelector('.gm-panel');
    if (!gridPanel) return false;
    map = m; window.__GRIDATLAS_SATELLITE_TEST_MAP__ = map;
    nativeNodes = [...document.querySelectorAll('button')].filter(e => !e.closest('#gridatlas-menu-bar') && /⚡\s*grid|[◉◎]\s*subs/i.test(e.textContent));
    const css = document.createElement('style'); css.id = 'satellite-survey-css'; css.textContent = `
#satellite-survey{display:block;grid-column:1 / -1;margin:8px 4px;padding:6px;border:1px solid #426d73;border-radius:4px;color:#cfe6e8;font:11px/1.4 ui-monospace,monospace;box-sizing:border-box}
#satellite-survey>summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:bold;color:#7fe3d0;list-style:none}
#satellite-survey>summary::before{content:'▸';margin-right:8px}#satellite-survey[open]>summary::before{content:'▾'}
#satellite-survey .survey-row{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}
#gridatlas-menu-bar #satellite-survey button{display:flex;width:auto;flex:1 1 65px;min-height:44px;align-items:center;justify-content:center;margin:0;padding:7px;border:1px solid #426d73;border-radius:4px;background:#0d171c;font:600 11px ui-monospace,monospace;color:#bde6e8;box-sizing:border-box;touch-action:manipulation}
#gridatlas-menu-bar #satellite-survey button[aria-pressed=true]{background:#183940;border-color:#00ffff;color:#00ffff}
#satellite-survey button:disabled{opacity:.45;cursor:default}
#satellite-survey label{display:block;margin:7px 0;font:11px/1.5 ui-monospace,monospace;color:#cfe6e8}
#satellite-survey input,#satellite-survey select{position:static;width:100%;min-width:0;min-height:44px;box-sizing:border-box;background:#0d171c;border:1px solid #426d73;border-radius:3px;color:#cfe6e8;font:11px ui-monospace,monospace;padding:5px;opacity:1;margin:4px 0 0}
#satellite-survey input[type=file]{font-size:10px}#satellite-survey .survey-row label{flex:1 1 100px;min-width:0}
#satellite-survey p{font:10px/1.45 ui-monospace,monospace;overflow-wrap:anywhere;margin:6px 0;color:#a6c0c6}
#satellite-survey #sat-test-status{color:#cfe6e8;white-space:normal}
#satellite-survey :focus-visible{outline:2px solid #7fe3d0;outline-offset:1px}
`;
    document.head.append(css); panel = document.createElement('details'); panel.id = 'satellite-survey';
    panel.innerHTML = `<summary>Satellite survey</summary><p>Dated imagery for domestic and public-interest study of renewable projects. No project status is inferred.</p>
<div class="survey-row"><button id="sat-test-dark" type="button">DARK</button><button id="sat-test-esri" type="button">ESRI</button><button id="sat-test-s2" type="button">SENTINEL-2</button></div>
<p id="sat-test-status" role="status" aria-live="polite"></p><p id="survey-view-date"></p><p id="survey-item"></p>
<details><summary>Project boundary</summary><p>WGS84 polygon GeoJSON, up to 1 MB. Files are read in this browser; only geometry is sent to the imagery catalogue when loading S2.</p><label>Boundary file<input id="survey-file" type="file" accept=".geojson,.json,application/geo+json,application/json"></label><p id="survey-boundary-name">No boundary: survey uses map centre.</p><div class="survey-row"><button id="survey-fit" type="button" disabled>FIT BOUNDARY</button><button id="survey-clear" type="button" disabled>CLEAR</button></div></details>
<div class="survey-row"><label>From (UTC)<input id="survey-start" type="date"></label><label>To (UTC)<input id="survey-end" type="date"></label></div>
<label>Selection<select id="sat-policy"><option value="latest">Newest acquisition (may be cloudy)</option><option value="clear">Newest with ≤35% scene cloud</option></select></label>
<label>Capture date<select id="sat-scene" disabled><option>Load S2 to list capture dates</option></select></label><p id="survey-count"></p>
<div class="survey-row"><button id="survey-refresh" type="button">REFRESH DATES</button><button id="survey-view" type="button">VIEW MAP</button></div>
<details><summary>Compare two dates</summary><p>Load a capture and set A, then load another and set B. Show A/B switches actual imagery at the same map position; it does not classify changes.</p><div class="survey-row"><button id="survey-set-A" type="button">SET A</button><button id="survey-show-A" type="button" disabled>SHOW A</button></div><p id="survey-date-A">Not set</p><div class="survey-row"><button id="survey-set-B" type="button">SET B</button><button id="survey-show-B" type="button" disabled>SHOW B</button></div><p id="survey-date-B">Not set</p></details>
<p>Sentinel-2 RGB: 10 m. Cloud percentage describes the whole scene, not this site. White outline: supplied boundary. Gold dashed outline: scene footprint. Esri remains outside the scene and in no-data gaps; its capture date varies. A lack of visible change is not proof of no activity.</p>`;
    // Insert one section inside Grid; no floating controls or native-node reparenting.
    gridPanel.insertBefore(panel, gridPanel.firstChild); status = byId('sat-test-status');
    const now = new Date(); byId('survey-end').value = dateISO(now); byId('survey-start').value = dateISO(new Date(now.getTime() - 60 * 86400000));
    panel.addEventListener('click', e => {
      e.stopPropagation(); const id = e.target.closest('button')?.id;
      if (id === 'sat-test-s2') sentinel(); else if (id === 'sat-test-esri') { basic('esri'); paintFootprint(null); } else if (id === 'sat-test-dark') { basic('dark'); paintFootprint(null); }
      else if (id === 'survey-refresh') sentinel(null, true); else if (id === 'survey-view') closeGrid(); else if (id === 'survey-fit') fitBoundary();
      else if (id === 'survey-clear') {
        cancel(); boundary = null; boundaryRevision++; catalogue = []; catalogueKey = ''; comparisons.A = comparisons.B = null; basic('dark');
        map.getSource('survey-boundary')?.setData(empty()); paintFootprint(null); byId('survey-boundary-name').textContent = 'No boundary: survey uses map centre.';
        byId('survey-fit').disabled = byId('survey-clear').disabled = true; sceneOptions(null); compareLabels();
      } else if (id?.startsWith('survey-set-')) {
        if (mode !== 's2' || !active) { say('Load a Sentinel-2 capture before setting a comparison.'); return; }
        comparisons[id.at(-1)] = { ...active }; compareLabels();
      } else if (id?.startsWith('survey-show-')) {
        const saved = comparisons[id.at(-1)]; if (saved) task((token, signal) => showResult(saved, token, signal));
      }
    });
    panel.addEventListener('change', async e => {
      e.stopPropagation();
      if (e.target.id === 'survey-file') {
        const f = e.target.files?.[0]; if (!f) return;
        try { if (f.size > 1048576) throw Error('Boundary file exceeds 1 MB.'); setBoundary(JSON.parse(await f.text()), f.name); }
        catch (err) { say('Boundary: ' + err.message); } finally { e.target.value = ''; }
      } else if (e.target.id === 'sat-policy') { selectionPolicy = e.target.value; sentinel(null, false); }
      else if (e.target.id === 'sat-scene' && e.target.value) sentinel(e.target.value);
      else if (e.target.id === 'survey-start' || e.target.id === 'survey-end') { cancel(); catalogueKey = ''; catalogue = []; sceneOptions(null); say('Date range changed. Refresh dates to load this range.'); }
    });
    for (const event of ['pointerdown', 'touchstart', 'dblclick', 'wheel']) panel.addEventListener(event, e => e.stopPropagation(), { passive: true });
    document.addEventListener('change', e => { if (e.target.name === 'bm' || e.target.name === 'bm-fs') { basic(e.target.value === 'sat' ? 'esri' : 'dark'); paintFootprint(null); } });
    map.on('moveend', () => { if (mode === 's2' && active) { const c = map.getCenter(); if (!covers(active.item, [c.lng, c.lat])) say('Outside selected scene at map centre: Esri shown. Open Grid > Satellite survey to choose imagery here.'); else explainScene(); } });
    window.__GRIDATLAS_SATELLITE_TEST__ = { snapshot: () => ({ version: VERSION, mode, scene: active?.item.id || null, date: active?.item.properties.datetime || null,
      scenes: catalogue.length, boundary: boundary ? { name: boundary.name, bbox: boundary.bbox, vertices: boundary.vertices } : null,
      menuOnly: panel.closest('.gm-panel') !== null, nativeNodesUnmoved: nativeNodes.every(n => n.isConnected && !panel.contains(n)), comparisonA: comparisons.A?.item.id || null, comparisonB: comparisons.B?.item.id || null, ...metrics }) };
    updateButtons(); say('Open Grid > Satellite survey to inspect dated imagery.'); return true;
  }
  let attempts = 0; const timer = setInterval(() => { const m = window.__GRIDATLAS_V9_MAP__; if (m?.getLayer('l-sat') && install(m)) clearInterval(timer); else if (++attempts >= 240) clearInterval(timer); }, 250);
})();
