/* SatNav practice section preview. Positions and section coordinates are session-local. */
void async function () {
  const root = new URL('../../../', location.href);
  const p1 = new URL('https://ventusltd.github.io/satnav/preview/9698781539e549deaa6ecaa4a2b34610c1f9fd29/');
  const [maths, { MAX_AGE_MS, fixQuality }, { createPositionOverlay, point }, { validCoordinate }, { buildDestination }] =
    await Promise.all([
      import(new URL('vendor/grid-distance-maths/src/geodesy.mjs', p1)),
      import(new URL('nav/compass.mjs', p1)),
      import(new URL('tools/satnav/line/position-overlay.mjs', root)),
      import(new URL('tools/vicinity/src/model.mjs', root)),
      import(new URL('tools/satnav/place.mjs', root)),
    ]);

  const style = document.createElement('style');
  style.textContent = `
    :root { --line-tracker-top:128px; }
    @media (max-width:600px) { :root { --line-tracker-top:136px; } }
    @media (max-width:359px) { :root { --line-tracker-top:214px; } }
    #line-open { position:fixed; top:var(--line-tracker-top); left:12px; z-index:10019; }
    #line-panel { position:fixed; top:calc(var(--line-tracker-top) + 52px); right:12px; z-index:10019;
      width:min(360px,calc(100% - 24px)); max-height:calc(100dvh - var(--line-tracker-top) - 64px);
      overflow:auto; padding:12px; box-sizing:border-box; color:#e4f7f7;
      background:#08141bf5; border:1px solid #367078; border-radius:6px;
      font:14px/1.4 ui-monospace,monospace; }
    #line-panel h2 { font-size:16px; margin:0 0 8px; color:#00ffff; }
    #line-panel p { margin:6px 0; }
    #line-open, #line-panel button { min-height:44px; padding:6px 8px; border:1px solid #367078;
      border-radius:4px; color:#bff7f9; background:#07191f; font:14px/1.4 ui-monospace,monospace;
      cursor:pointer; touch-action:manipulation; }
    #line-panel button:disabled { color:#8ba0a2; cursor:default; }
    #line-open:focus-visible, #line-panel button:focus-visible { outline:2px solid #fff; outline-offset:1px; }
    #line-panel .line-controls { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; }
    #line-panel [hidden], #line-panel[hidden] { display:none; }
    #line-panel .line-values { display:grid; grid-template-columns:1fr auto; gap:4px 10px; margin:8px 0; }
    #line-panel dd { margin:0; color:#00ffff; }
  `;
  document.head.append(style);

  const panel = document.createElement('section');
  panel.id = 'line-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'line-title');
  const title = document.createElement('h2');
  title.id = 'line-title';
  title.textContent = 'Practice line tracking';
  const description = document.createElement('p');
  description.textContent = 'Draw a short practice section on the map. Track your position from a public path.';
  const status = document.createElement('p');
  status.id = 'line-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Waiting for GridAtlas…';
  const choices = document.createElement('div');
  choices.className = 'line-controls';
  const controls = document.createElement('div');
  controls.className = 'line-controls';
  function button(id, label, parent) {
    const element = document.createElement('button');
    element.type = 'button';
    element.id = 'line-' + id;
    element.textContent = label;
    parent.append(element);
    return element;
  }
  const open = button('open', 'Line tracker', document.body);
  open.setAttribute('aria-controls', panel.id);
  open.setAttribute('aria-expanded', 'false');
  const dark = button('dark', 'Dark', choices);
  const satellite = button('satellite', 'Satellite', choices);
  const draw = button('draw', 'Pick start and end', controls);
  const cancel = button('cancel', 'Cancel selection', controls);
  const start = button('start', 'Start location', controls);
  const stop = button('stop', 'Stop location', controls);
  const compass = button('compass', 'Compass to end', controls);
  const close = button('close', 'Close', controls);
  const values = document.createElement('dl');
  values.className = 'line-values';
  function readout(id, label) {
    const term = document.createElement('dt');
    term.textContent = label;
    const value = document.createElement('dd');
    value.id = 'line-' + id;
    values.append(term, value);
    return value;
  }
  const accuracy = readout('accuracy', 'GPS accuracy');
  const offset = readout('offset', 'Distance from line');
  const progress = readout('progress', 'Progress from first tap');
  const legend = document.createElement('p');
  legend.textContent = 'Cyan: practice line. Yellow: your GPS. Pink: nearest point on the line.';
  panel.append(title, description, status, choices, controls, values, legend);
  document.body.append(panel);

  const sourceId = 'gridatlas-satnav-line-position';
  const layerSpecs = [
    ['accuracy', 'gps-accuracy', 'fill', { 'fill-color': '#ffdf61', 'fill-opacity': 0.22 }],
    ['section', 'selected-section', 'line', { 'line-color': '#00ffff', 'line-width': 4 }],
    ['start', 'start-point', 'circle', { 'circle-color': '#00ffff', 'circle-radius': 5 }],
    ['nearest', 'nearest-on-section', 'circle', { 'circle-color': '#ff65d5', 'circle-radius': 5 }],
    ['gps', 'measured-gps', 'circle', { 'circle-color': '#ffdf61', 'circle-radius': 6, 'circle-stroke-color': '#171100', 'circle-stroke-width': 2 }],
  ];
  let map, ownedSource, first, end, tracker, fix;
  let picking = false;
  let watch = null;
  let watchGeneration = 0;
  const formatMetres = value => Math.round(value) + ' m';

  function drawFeatures(features) {
    if (!map) return;
    if (!ownedSource) {
      if (!features.length || map.getSource(sourceId)) return;
      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      ownedSource = map.getSource(sourceId);
      for (const [id, role, type, paint] of layerSpecs) {
        map.addLayer({
          id: sourceId + '-' + id, source: sourceId, type, paint,
          filter: ['==', ['get', 'role'], role],
        });
      }
    }
    if (map.getSource(sourceId) === ownedSource) ownedSource.setData({ type: 'FeatureCollection', features });
  }

  function render() {
    const { metrics, features } = tracker ? tracker(fix, Date.now()) :
      { metrics: null, features: first ? [point('start-point', first)] : [] };
    drawFeatures(features);
    choices.hidden = picking;
    description.hidden = picking || !!tracker;
    draw.hidden = picking || watch !== null;
    cancel.hidden = !picking;
    start.hidden = stop.hidden = values.hidden = legend.hidden = !tracker;
    compass.hidden = !tracker || watch !== null;
    draw.disabled = !map;
    start.disabled = watch !== null || !tracker;
    stop.disabled = watch === null;
    const usable = metrics?.status === 'ok';
    const quality = fixQuality(fix);
    accuracy.textContent = quality === 'usable' || quality === 'poor' ? '±' + formatMetres(fix.accuracyM) : '—';
    offset.textContent = usable ? formatMetres(metrics.offsetM) : '—';
    progress.textContent = usable ? formatMetres(metrics.progressM) + ' / ' + formatMetres(metrics.totalM) : '—';
    return metrics;
  }

  function stopTracking(message) {
    watchGeneration++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    fix = null;
    if (message) status.textContent = message;
  }

  function clearSelection(message) {
    stopTracking(message);
    tracker = first = end = null;
    picking = false;
    render();
  }

  function mapClick(event) {
    if (!picking || panel.hidden || !event.lngLat) return;
    const at = [event.lngLat.lng, event.lngLat.lat];
    if (!validCoordinate(at)) return;
    if (!first) {
      first = at;
      status.textContent = 'Tap the end less than 1 km from your first point.';
      render();
      return;
    }
    const length = maths.distanceKm(...first, ...at);
    if (length === 0 || length > 1) {
      status.textContent = 'Choose a different end within 1 km of your first point.';
      return;
    }
    tracker = createPositionOverlay([first, at], maths);
    end = at;
    picking = false;
    status.textContent = 'Practice section selected. Start location when ready.';
    render();
  }

  function showPanel(show) {
    panel.hidden = !show;
    open.setAttribute('aria-expanded', String(show));
    if (!show) {
      if (picking) clearSelection('Selection cancelled.');
      else stopTracking(tracker ? 'Location stopped. Your practice line is still selected.' : null);
    }
    render();
  }
  open.onclick = () => showPanel(panel.hidden);
  close.onclick = () => { showPanel(false); open.focus({ preventScroll: true }); };
  draw.onclick = () => {
    clearSelection('Tap the start of your practice line.');
    picking = true;
    render();
  };
  cancel.onclick = () => clearSelection('Selection cancelled.');
  dark.onclick = () => document.querySelector('#scada-ui-container input[name="bm"][value="dark"]')?.click();
  satellite.onclick = () => document.querySelector('#scada-ui-container input[name="bm"][value="sat"]')?.click();
  compass.onclick = () => {
    if (end) location.assign(new URL(buildDestination({ name: 'Practice line end', coordinates: end }), new URL('nav/', p1)));
  };

  start.onclick = () => {
    if (!tracker || watch !== null) return;
    if (!isSecureContext || !navigator.geolocation) {
      status.textContent = 'Location needs a secure browser connection.';
      return;
    }
    const generation = ++watchGeneration;
    status.textContent = 'Waiting for your location…';
    try {
      watch = navigator.geolocation.watchPosition(position => {
        if (generation !== watchGeneration) return;
        const { longitude, latitude, accuracy: accuracyM } = position.coords;
        fix = { longitude, latitude, accuracyM, timestampMs: position.timestamp };
        const metrics = render();
        const quality = fixQuality(fix);
        if (quality === 'usable') {
          status.textContent = metrics.status === 'ok' ? 'Location fix received.' : 'Progress is uncertain on this section.';
        } else if (quality === 'poor') {
          status.textContent = 'GPS accuracy is too low for line progress.';
        } else {
          status.textContent = 'Waiting for a usable location fix.';
        }
      }, error => {
        if (generation !== watchGeneration) return;
        if (error.code === 1) stopTracking('Location permission denied.');
        else {
          fix = null;
          status.textContent = 'Location unavailable. Waiting for another fix.';
        }
        render();
      }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 });
    } catch {
      stopTracking('Location could not start.');
    }
    render();
  };
  stop.onclick = () => { stopTracking('Location stopped.'); render(); };

  for (const event of ['click', 'dblclick', 'mousedown', 'pointerdown', 'touchstart']) {
    panel.addEventListener(event, input => input.stopPropagation());
  }
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); showPanel(false); open.focus({ preventScroll: true }); }
  });

  function refresh() {
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (open.parentElement !== host) host.append(open, panel);
    const nextMap = window.__GRIDATLAS_V9_MAP__;
    if (nextMap && nextMap !== map && nextMap.getLayer('l-sat')) {
      map?.off('click', mapClick);
      map = nextMap;
      ownedSource = null;
      map.on('click', mapClick);
      status.textContent = 'Pick a start and end on the map.';
      render();
    }
    if (fix && Date.now() - fix.timestampMs > MAX_AGE_MS) {
      fix = null;
      status.textContent = 'GPS fix is stale. Waiting for a fresh fix.';
      render();
    }
  }
  render();
  refresh();
  let timer = setInterval(refresh, 250);
  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    stopTracking('Location stopped.');
    render();
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    refresh();
    timer = setInterval(refresh, 250);
  });
}().catch(error => console.error('SatNav practice line preview failed', error));
