/* Local engineering layouts for the versioned SatNav survey map. */
void async function () {
  const root = new URL('../../../', location.href);
  const { readLayout, layoutChoices, walkLayoutChoice, MAX_FILE_BYTES } =
    await import(new URL('tools/satnav/interchange/layout-import.mjs', root));
  const sourceId = 'satnav-imported-layout';
  const mapLayers = [
    ['perimeters', 'fill', ['==', ['get', 'satnavRole'], 'perimeter'], { 'fill-color': '#8de7ae', 'fill-opacity': 0.13 }],
    ['design', 'line', ['in', ['get', 'satnavRole'], ['literal', ['planned-route', 'perimeter']]], { 'line-color': '#8de7ae', 'line-width': 3, 'line-dasharray': [3, 2] }],
    ['waypoints', 'circle', ['==', ['get', 'satnavRole'], 'waypoint'], { 'circle-color': '#8de7ae', 'circle-stroke-color': '#10251b', 'circle-stroke-width': 1, 'circle-radius': 5 }],
    ['track', 'line', ['==', ['get', 'satnavRole'], 'walked-track'], { 'line-color': '#bb9cff', 'line-width': 3 }],
    ['fix', 'circle', ['==', ['get', 'satnavRole'], 'walked-fix'], { 'circle-color': '#bb9cff', 'circle-radius': 4 }],
  ];

  function mount() {
    const survey = document.querySelector('#satnav-compact')?.satnavSurvey;
    const host = document.querySelector('#satnav-field-tools');
    if (!survey || !host || document.getElementById('satnav-layout')) return;
    const controls = document.createElement('details');
    controls.id = 'satnav-layout';
    controls.innerHTML = `
      <summary>Layouts</summary>
      <button type="button" data-import>Import layout</button>
      <input type="file" accept=".json,.geojson,application/json,application/geo+json" aria-label="Local GIS or GeoJSON file" hidden>
      <input type="search" placeholder="Find a design feature" aria-label="Find a design feature" hidden>
      <select aria-label="Design feature" hidden></select>
      <button type="button" data-walk hidden>Use for walk</button>
      <button type="button" data-show hidden>Show layout on map</button>
      <button type="button" data-export hidden>Save layout GeoJSON</button>
      <p role="status" aria-live="polite"></p>`;
    host.append(controls);
    const file = controls.querySelector('input[type=file]');
    const search = controls.querySelector('input[type=search]');
    const select = controls.querySelector('select');
    const status = controls.querySelector('[role=status]');
    const show = controls.querySelector('[data-show]');
    const walk = controls.querySelector('[data-walk]');
    const save = controls.querySelector('[data-export]');
    let layout = null;
    let choices = [];
    let filename = '';
    let request = 0;
    let map = null;
    let renderedLayout = null;
    const panel = document.querySelector('#satnav-compact');

    function drawLayout() {
      const nextMap = survey.getMap();
      if (map !== nextMap) {
        map?.off('style.load', drawLayout);
        map = nextMap;
        renderedLayout = null;
        map?.on('style.load', drawLayout);
      }
      if (!map || !layout) return;
      if (!map.getSource(sourceId)) {
        if (!map.getLayer('l-sat') && !map.isStyleLoaded()) return;
        map.addSource(sourceId, { type: 'geojson', data: layout });
        renderedLayout = layout;
      } else if (renderedLayout !== layout) {
        map.getSource(sourceId).setData(layout);
        renderedLayout = layout;
      }
      for (const [name, type, filter, paint] of mapLayers) {
        const id = sourceId + '-' + name;
        if (!map.getLayer(id)) map.addLayer({ id, type, source: sourceId, filter, paint });
      }
    }

    function listChoices() {
      const term = search.value.trim().toLowerCase();
      select.replaceChildren();
      for (const choice of choices) {
        if (!choice.label.toLowerCase().includes(term)) continue;
        const option = document.createElement('option');
        option.value = String(choice.index);
        option.textContent = choice.label;
        select.append(option);
        if (select.length >= 50) break;
      }
      select.hidden = select.length === 0;
      walk.hidden = select.hidden;
    }

    controls.querySelector('[data-import]').onclick = () => file.click();
    search.oninput = listChoices;
    file.onchange = async () => {
      const selected = file.files[0];
      file.value = '';
      if (!selected) return;
      const active = ++request;
      try {
        if (selected.size > MAX_FILE_BYTES) throw Error('Choose a file smaller than 16 MiB.');
        const next = readLayout(await selected.text());
        const items = layoutChoices(next);
        if (active !== request) return;
        layout = next;
        choices = items;
        filename = selected.name;
        search.hidden = items.length <= 50;
        search.value = '';
        listChoices();
        show.hidden = save.hidden = false;
        drawLayout();
        const measured = next.features.filter(f => ['walked-track', 'walked-fix'].includes(f.properties.satnavRole)).length;
        status.textContent = filename + ' · ' + (next.features.length - measured) + ' design · ' + measured + ' recorded';
      } catch (error) {
        if (active === request) status.textContent = 'Import failed. ' + error.message;
      }
    };
    walk.onclick = () => {
      const chosen = choices.find(item => item.index === Number(select.value));
      try {
        const applied = walkLayoutChoice(survey, layout, chosen);
        if (applied === false) throw Error('The map could not use this selection.');
        status.textContent = chosen.label + ' selected for walking.';
      } catch (error) {
        status.textContent = error.message;
      }
    };
    show.onclick = () => {
      drawLayout();
      if (!map || !layout) return;
      let west = 180, east = -180, south = 90, north = -90;
      for (const { geometry } of layout.features) {
        const coordinates = geometry.type === 'Point' ? [geometry.coordinates] :
          geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates;
        for (const [lng, lat] of coordinates) {
          west = Math.min(west, lng); east = Math.max(east, lng);
          south = Math.min(south, lat); north = Math.max(north, lat);
        }
      }
      if (west === east && south === north) map.jumpTo({ center: [west, south], zoom: 16 });
      else map.fitBounds([[west, south], [east, north]], { padding: 50, duration: 0, maxZoom: 17 });
    };
    save.onclick = () => {
      if (!layout) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(layout)], { type: 'application/geo+json' }));
      const download = document.createElement('a');
      download.href = url;
      download.download = filename.replace(/\.(geojson|json)$/i, '') + '-layout.geojson';
      controls.append(download);
      download.click();
      download.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    drawLayout();
    panel.addEventListener('satnav:map', drawLayout);

    // The walking example is independent of local file parsing and the active GPS watch.
    import(new URL('tools/satnav/pedestrian-pilot/bristol.mjs', root)).then(({ installBristolFootpaths }) => {
      const routingHost = document.createElement('div');
      host.append(routingHost);
      let pilot = null;
      let pilotMap = null;
      function attachPilot() {
        const nextMap = survey.getMap();
        if (!nextMap || nextMap === pilotMap) return;
        pilot?.destroy();
        pilotMap = nextMap;
        pilot = installBristolFootpaths({
          map: nextMap, container: routingHost, maths: survey.maths, getEndpoints: survey.getEndpoints,
        });
      }
      panel.addEventListener('satnav:map', attachPilot);
      panel.addEventListener('satnav:pins', () => pilot?.refresh());
      attachPilot();
      window.addEventListener('pagehide', () => { pilot?.destroy(); pilot = null; pilotMap = null; });
      window.addEventListener('pageshow', attachPilot);
    }).catch(error => console.error('SatNav pedestrian example failed', error));
  }
  document.addEventListener('satnav:ready', mount);
  mount();
}().catch(error => console.error('SatNav layout import failed', error));
