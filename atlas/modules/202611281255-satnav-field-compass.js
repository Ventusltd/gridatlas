/* Add-on for the versioned SatNav maps. Reuses the existing location overlay. */
void (async function () {
  const root = new URL('../../../', location.href);
  const { deviceHeading, compactTargetBearing, formatDegrees } =
    await import(new URL('tools/satnav/orientation/heading.mjs', root));
  const panel = document.createElement('section');
  panel.id = 'field-compass';
  panel.setAttribute('aria-label', 'Field compass and land access');
  panel.innerHTML = `
    <div class="field-compass-row">
      <button id="field-compass-toggle" type="button" aria-pressed="false">Compass</button>
      <details id="field-land-access">
        <summary>Land access</summary>
        <p>Use an existing right of access or obtain permission. You and your organisation must respect restrictions and work safely. Ventus retains its own legal and safety duties.</p>
      </details>
    </div>
    <div id="field-compass-reading"></div>
    <div id="field-target-bearing"></div>`;
  const style = document.createElement('style');
  style.textContent = `
    #field-compass { position:fixed; z-index:10029; left:max(8px,env(safe-area-inset-left)); bottom:max(27px,calc(env(safe-area-inset-bottom) + 17px)); max-width:calc(100vw - 24px); color:#e4f7f7; font:13px/1.3 system-ui,sans-serif; }
    .field-compass-row { display:flex; gap:5px; align-items:end; }
    #field-compass button,#field-compass summary { min-height:44px; box-sizing:border-box; padding:10px 9px; background:#081820; border:1px solid #367078; border-radius:6px; color:inherit; font:inherit; cursor:pointer; touch-action:manipulation; }
    #field-compass summary { display:flex; align-items:center; }
    #field-compass button[aria-pressed=true] { outline:2px solid #68e8f5; }
    #field-compass :focus-visible { outline:2px solid white; }
    #field-land-access p { position:absolute; left:0; bottom:100%; width:min(250px,calc(100vw - 36px)); padding:10px; border:1px solid #367078; border-radius:6px; background:#081820; }
    #field-compass-reading:not(:empty),#field-target-bearing:not(:empty) { background:#081820ed; width:fit-content; padding:2px 6px; margin-top:3px; border-radius:4px; font-variant-numeric:tabular-nums; }
  `;
  document.head.append(style);
  document.body.append(panel);
  const toggle = panel.querySelector('#field-compass-toggle');
  const reading = panel.querySelector('#field-compass-reading');
  const bearing = panel.querySelector('#field-target-bearing');
  const access = panel.querySelector('details');
  const sourceId = 'gridatlas-satnav-compact';
  let map = null;
  let enabled = false;
  let generation = 0;
  let expiry;
  let discovery;

  function orientation(event) {
    if (!enabled) return;
    const apple = typeof event.webkitCompassHeading === 'number';
    if (!apple && event.type !== 'deviceorientationabsolute' && event.absolute !== true) return;
    const angle = window.screen.orientation?.angle ?? window.orientation ?? 0;
    const heading = deviceHeading(event, angle);
    clearTimeout(expiry);
    if (!heading) {
      reading.textContent = 'Compass unavailable · hold phone level';
      return;
    }
    reading.textContent = 'Heading ' + formatDegrees(heading.degrees) + ' ' + heading.reference;
    expiry = setTimeout(() => { reading.textContent = 'Waiting for a fresh heading'; }, 10000);
  }
  function stop(message = '') {
    generation++;
    enabled = false;
    clearTimeout(expiry);
    window.removeEventListener('deviceorientation', orientation);
    window.removeEventListener('deviceorientationabsolute', orientation);
    toggle.setAttribute('aria-pressed', 'false');
    reading.textContent = message;
  }
  toggle.addEventListener('click', async () => {
    if (enabled) { stop(); return; }
    const api = window.DeviceOrientationEvent;
    if (!window.isSecureContext || !api) {
      reading.textContent = 'Phone compass unavailable';
      return;
    }
    const thisRun = ++generation;
    enabled = true;
    toggle.setAttribute('aria-pressed', 'true');
    reading.textContent = 'Waiting for compass';
    try {
      if (typeof api.requestPermission === 'function') {
        const result = await api.requestPermission(true);
        if (thisRun !== generation) return;
        if (result !== 'granted') { stop('Compass permission denied'); return; }
      }
      window.addEventListener('deviceorientationabsolute', orientation);
      window.addEventListener('deviceorientation', orientation);
      expiry = setTimeout(() => { reading.textContent = 'No compass reading · hold phone level'; }, 7000);
    } catch {
      if (thisRun === generation) stop('Compass permission unavailable');
    }
  });
  function updateBearing() {
    const features = map?.getSource(sourceId)?.serialize().data?.features;
    const text = compactTargetBearing(features);
    if (bearing.textContent !== text) bearing.textContent = text;
  }
  function sourceChanged(event) {
    if (event.sourceId === sourceId) updateBearing();
  }
  function attachMap() {
    const current = window.__GRIDATLAS_V9_MAP__;
    if (current && current !== map) {
      map?.off('sourcedata', sourceChanged);
      map = current;
      map.on('sourcedata', sourceChanged);
      updateBearing();
    }
    const host = document.fullscreenElement || document.webkitFullscreenElement || document.body;
    if (panel.parentElement !== host) host.append(panel);
  }
  function resume() {
    clearInterval(discovery);
    attachMap();
    discovery = setInterval(attachMap, 1000);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  window.addEventListener('pagehide', () => {
    stop();
    clearInterval(discovery);
    map?.off('sourcedata', sourceChanged);
    map = null;
  });
  window.addEventListener('pageshow', event => { if (event.persisted) resume(); });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && access.open) { access.open = false; access.querySelector('summary').focus(); }
  });
  resume();
})().catch(error => console.error('Field compass failed to initialise', error));
