/* Explicit walking on the existing field map. Location is owned by the waypoint cartridge. */
void async function () {
  const root = new URL('../../../', location.href);
  const [{createDirectWalk,walkTargets}, compass, {createRouteFollower}] = await Promise.all([
    import(new URL('tools/satnav/walk/direct.mjs',root)),
    import(new URL('tools/satnav/vendor/9698781539e549deaa6ecaa4a2b34610c1f9fd29/nav/compass.mjs',root)),
    import(new URL('tools/satnav/line/route-follower.mjs',root)),
  ]);
  let mounted = false;
  function mount() {
    const panel = document.getElementById('satnav-compact');
    const api = panel?.satnavSurvey;
    if (mounted || !api) return;
    mounted = true;
    const css = document.createElement('style');
    css.textContent = `
      #satnav-compact{--satnav-walk-top:max(env(safe-area-inset-top,0px),var(--gridatlas-menu-bar-clear,8px),var(--satnav-measured-menu-bottom,8px));top:var(--satnav-walk-top)!important;max-height:calc(100dvh - var(--satnav-walk-top) - 42px)!important}
      #gridatlas-menu-bar{z-index:10045!important}
      body:has(#gridatlas-menu-bar .gm-open) #satnav-compact{visibility:hidden}
      #satnav-compact #satnav-guide{display:none!important}
      #satnav-walk-actions{display:grid;grid-template-columns:1fr 1fr;gap:4px}
      #satnav-walk-actions select{min-height:44px;min-width:0;width:100%;border:1px solid #367078;border-radius:6px;background:#081820;color:#e4f7f7;font:inherit}
      #satnav-walk-actions #satnav-walk-start{border-color:#60d6d9}
      #satnav-walk-guidance{background:#081820ed;color:#b2faf7;margin:0;padding:4px 7px;border-radius:4px;font-size:12px;line-height:1.35}
      #satnav-walk-guidance:empty{display:none}
      #satnav-walk-source{background:#081820ed;padding:4px 7px;border-radius:4px;font-size:11px}
      #satnav-walk-source a{color:#8bf7f7}
    `;
    document.head.append(css);
    const row = document.createElement('div');
    row.id = 'satnav-walk-actions';
    row.innerHTML = '<select id="satnav-walk-mode" aria-label="Guidance mode"><option value="direct">Direct to pin</option><option value="walking">Walking route</option></select><button id="satnav-walk-start" type="button">Start walk</button><button id="satnav-walk-stop" type="button" hidden>Stop walk</button>';
    const message = document.createElement('p');
    message.id = 'satnav-walk-guidance';
    message.setAttribute('role','status');
    const sourceNote = document.createElement('details');
    sourceNote.id = 'satnav-walk-source';sourceNote.hidden = true;
    sourceNote.innerHTML = '<summary>Footpath source and restrictions</summary><span></span> <a target="_blank" rel="noopener">Council closures</a> · <a target="_blank" rel="noopener">Licence</a>';
    document.getElementById('satnav-to').after(row,message,sourceNote);
    const start = row.querySelector('#satnav-walk-start'), stop = row.querySelector('#satnav-walk-stop');
    const mode = row.querySelector('select');
    const gps = panel.querySelector('#satnav-location'), stopGps = panel.querySelector('#satnav-stop');
    const choose = () => panel.querySelector('[data-loop]')?.getAttribute('aria-pressed') === 'true';
    const direct = createDirectWalk(api.maths,compass);
    const distance = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2) + ' km';
    const bearing = n => Math.round(n) % 360 + '° true';
    const lineId = 'satnav-active-walking-route';
    let active = false, stopped = false, targets = [], walkingOrigin = null;
    let routerPromise = null, key = '', request = 0, routeState = 'none', geometry = null, follow = null;
    let routeMap = null, drawn = null, arrived = false;

    let observedMenu = null;
    function clearHeader() {
      const menu = document.getElementById('gridatlas-menu-bar');
      if (observedMenu !== menu) {
        if (observedMenu) menuSize?.unobserve(observedMenu);
        observedMenu = menu;
        if (menu) menuSize?.observe(menu);
      }
      const px = Math.ceil(menu?.getBoundingClientRect().bottom ?? 0) + 8;
      panel.style.setProperty('--satnav-measured-menu-bottom',px + 'px');
    }
    const menuSize = typeof ResizeObserver === 'function' ? new ResizeObserver(clearHeader) : null;
    clearHeader();
    // The existing GridAtlas bar can mount after the SatNav cartridge.
    if (!observedMenu) {
      const discovery = new MutationObserver(() => {clearHeader();if (observedMenu) discovery.disconnect();});
      discovery.observe(document.body,{subtree:true,childList:true});
    }
    window.addEventListener('resize',clearHeader);
    window.visualViewport?.addEventListener('resize',clearHeader);
    document.addEventListener('fullscreenchange',clearHeader);
    document.addEventListener('webkitfullscreenchange',clearHeader);
    panel.addEventListener('click', event => {
      const control = event.target.closest?.('button');
      if (control && ['satnav-from','satnav-to','satnav-add','satnav-replace'].includes(control.id)
          && control.getAttribute('aria-pressed') !== 'true') {
        const zoom = api.getMap()?.doubleClickZoom;
        // A deliberate toolbar selection interrupts the previous map tap pair.
        if (zoom?.isEnabled()) {zoom.disable();zoom.enable();}
      }
    },true);

    function draw() {
      if (!routeMap?.getLayer('l-sat')) return;
      let source = routeMap.getSource(lineId);
      const data = {type:'FeatureCollection',features:geometry ?
        [{type:'Feature',properties:{kind:'mapped-footpath'},geometry}] : []};
      if (!source) {routeMap.addSource(lineId,{type:'geojson',data});source = routeMap.getSource(lineId);}
      else if (drawn !== geometry) source.setData(data);
      if (!routeMap.getLayer(lineId)) routeMap.addLayer({id:lineId,type:'line',source:lineId,paint:{'line-color':'#77ed91','line-width':5}},
        routeMap.getLayer('gridatlas-satnav-waypoints-via') ? 'gridatlas-satnav-waypoints-via' : undefined);
      drawn = geometry;
    }
    function attachMap() {
      const next = api.getMap();
      if (next !== routeMap) {
        routeMap?.off('style.load',draw);routeMap = next;
        routeMap?.on('style.load',draw);drawn = null;
      }
      draw();
      clearHeader();
    }
    function clearRoute(status) {
      routeState = status;geometry = null;follow = null;arrived = false;sourceNote.hidden = true;draw();
    }
    async function calculate(points, revision) {
      try {
        routerPromise ??= import(new URL('tools/satnav/walk/council/council-router.mjs',root))
          .then(module => module.loadPedestrianRouter(api.maths)).catch(error => {routerPromise = null;throw error;});
        const route = await routerPromise;
        if (request !== revision) return;
        const coordinates = [];
        let publication;
        for (let i = 1; i < points.length; i++) {
          const result = route(points[i-1],points[i]);
          if (result.status !== 'mapped') {
            if (result.reason === 'footpath-data-unavailable') routerPromise = null;
            clearRoute('unavailable');render();return;
          }
          publication = result;
          const leg = result.geometry.coordinates;
          if (i > 1 && api.maths.distanceKm(...coordinates.at(-1),...leg[0]) > 0.0001) {
            clearRoute('unavailable');render();return;
          }
          for (let j = i === 1 ? 0 : 1; j < leg.length; j++) coordinates.push(leg[j]);
          if (coordinates.length > 20_000) {clearRoute('unavailable');render();return;}
        }
        geometry = {type:'LineString',coordinates};
        follow = createRouteFollower(geometry,api.maths);
        sourceNote.querySelector('span').textContent = publication.attribution + ' ';
        const [closures,licence] = sourceNote.querySelectorAll('a');
        closures.href = publication.closureNotices;licence.href = publication.licence;sourceNote.hidden = false;
        routeState = 'mapped';draw();render();
      } catch {
        if (request === revision) {clearRoute('unavailable');render();}
      }
    }
    function syncPlan() {
      const pins = api.getPins(), [from] = api.getEndpoints();
      targets = walkTargets(pins,from,choose());
      direct.setTargets(targets);
      if (mode.value === 'walking') {
        const fix = api.getFix();
        if (!from && !walkingOrigin && compass.fixQuality(fix) === 'usable') walkingOrigin = [fix.longitude,fix.latitude];
        const origin = from ?? walkingOrigin;
        const points = origin && targets.length ? [origin,...targets.map(pin => pin.coordinate)] : [];
        const next = JSON.stringify(points);
        if (key !== next) {
          key = next;const revision = ++request;
          clearRoute(points.length >= 2 ? 'loading' : 'none');
          if (points.length >= 2) void calculate(points,revision);
        }
      } else if (key) {key = '';request++;clearRoute('none');}
      render();
    }
    function liveRoute(fix) {
      const now = Date.now();
      const projection = follow(fix,now);
      if (projection.status !== 'ok') return 'Position on mapped path uncertain';
      if (projection.offRoute) return 'Away from mapped footpath';
      const end = geometry.coordinates.at(-1);
      if (projection.remainingM <= 15 && api.maths.distanceKm(fix.longitude,fix.latitude,...end) * 1000 + fix.accuracyM <= 15) arrived = true;
      if (arrived) return 'Arrived at mapped path end';
      const next = geometry.coordinates[projection.segmentIndex + 1];
      const forward = compass.guide(fix,{coordinates:next},now);
      const parts = [distance(projection.remainingM) + ' remaining'];
      if (Number.isFinite(forward?.bearingDeg)) parts.push(bearing(forward.bearingDeg));
      return parts.join(' · ');
    }
    function render() {
      start.hidden = active;stop.hidden = !active;
      const isPath = mode.value === 'walking';
      const label = isPath ? 'Walking route' : 'Direct to pin';
      let text = '';
      if (isPath && routeState === 'unavailable') text = 'Walking route unavailable here · choose Direct to pin';
      else if (isPath && routeState === 'loading') text = 'Checking mapped footpaths';
      else if (active) {
        const sample = api.getFix();
        const quality = compass.fixQuality(sample);
        if (!targets.length) text = 'Select TO or add a waypoint';
        else if (quality !== 'usable') text = label + ' · ' + (quality === 'poor' ? 'Waiting for more accurate GPS' : 'Waiting for a fresh GPS fix');
        else if (isPath) text = routeState === 'mapped' ? label + ' · ' + liveRoute(sample) + ' · check current access' : 'Waiting for route origin';
        else {
          const guidance = direct.locate(sample);
          if (guidance.status === 'complete') text = label + ' · Arrived';
          else if (guidance.status === 'guiding') {
            const parts = [label,distance(guidance.distanceM)];
            if (Number.isFinite(guidance.bearingDeg)) parts.push(bearing(guidance.bearingDeg));
            if (targets.length > 1) parts.push('Waypoint ' + (guidance.targetIndex + 1) + ' of ' + targets.length,distance(guidance.remainingM) + ' remaining');
            text = parts.join(' · ');
          } else text = label + ' · Waiting for a fresh GPS fix';
        }
      } else if (stopped) text = 'Walk stopped';
      else if (isPath && routeState === 'mapped') text = 'Walking route ready · check current access';
      if (message.textContent !== text) message.textContent = text;
    }
    start.onclick = () => {
      active = true;stopped = false;arrived = false;walkingOrigin = null;direct.restart();
      // This is the UI's existing user-initiated watch. It freezes a missing
      // FROM on the first usable fix and preserves an imported or hand-picked FROM.
      if (!api.isTracking()) gps.click();
      if (!api.isTracking()) {active = false;stopped = true;}
      syncPlan();
    };
    function stopWalk() {
      active = false;stopped = true;arrived = false;walkingOrigin = null;direct.restart();render();
    }
    stop.onclick = () => {stopWalk();if (api.isTracking()) stopGps.click();};
    mode.onchange = () => {walkingOrigin = null;stopped = false;arrived = false;direct.restart();syncPlan();};
    panel.addEventListener('satnav:fix',() => {
      if (mode.value === 'walking' && !walkingOrigin && !api.getEndpoints()[0]) syncPlan();
      else render();
    });
    panel.addEventListener('satnav:stop',stopWalk);
    panel.addEventListener('satnav:pins',syncPlan);
    panel.addEventListener('satnav:map',attachMap);
    panel.addEventListener('click',event => {if (event.target.closest?.('[data-loop]')) syncPlan();});
    document.addEventListener('visibilitychange',render);
    window.addEventListener('online',() => {
      if (mode.value === 'walking' && routeState === 'unavailable') {routerPromise = null;key = '';syncPlan();}
    });
    window.addEventListener('pagehide',stopWalk);
    attachMap();syncPlan();
  }
  document.addEventListener('satnav:ready',mount);
  mount();
}().catch(error => console.error('SatNav walking controls failed',error));
