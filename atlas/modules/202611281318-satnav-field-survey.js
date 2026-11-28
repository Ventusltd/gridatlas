/* Add a local field survey to the waypoint map's existing pins and GPS watch. */
(() => {
  let mounting = false;
  async function mount() {
    const panel = document.getElementById('satnav-compact');
    const host = panel?.querySelector('#satnav-field-tools');
    const api = panel?.satnavSurvey;
    if (!host || !api || mounting) return;
    mounting = true;
    try {
      const root = new URL('../../../', location.href);
      const { createFieldSurvey } = await import(new URL('tools/satnav/survey/model.mjs', root));
      const survey = createFieldSurvey({ fixQuality: api.fixQuality, distanceKm: api.distanceKm });
      const disclosure = document.createElement('details');
      disclosure.id = 'satnav-survey';
      disclosure.innerHTML = '<summary>Field survey</summary><div class="survey-sheet"><div class="survey-actions"><button type="button" data-loop>Close perimeter</button><button type="button" data-record>Record track</button><button type="button" data-stop>Stop track</button><button type="button" data-export>Export GeoJSON</button></div><p data-plan></p><p data-track></p><p data-message role="status"></p></div>';
      host.append(disclosure);
      const style = document.createElement('style');
      style.textContent = '#satnav-survey{border-radius:6px;background:#081820ed;color:#e4f7f7}#satnav-survey summary{padding:10px;cursor:pointer;min-height:40px;box-sizing:border-box}#satnav-survey .survey-sheet{max-height:min(42dvh,19rem);overflow-y:auto;overscroll-behavior:contain;padding:0 6px 5px}#satnav-survey .survey-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}#satnav-survey .survey-actions button{min-height:44px;padding:4px;line-height:1.2}#satnav-survey p{margin:4px 0;font-size:12px}#satnav-survey p:empty{display:none}';
      document.head.append(style);
      const loop = disclosure.querySelector('[data-loop]');
      const record = disclosure.querySelector('[data-record]');
      const stop = disclosure.querySelector('[data-stop]');
      const download = disclosure.querySelector('[data-export]');
      const planText = disclosure.querySelector('[data-plan]');
      const trackText = disclosure.querySelector('[data-track]');
      const message = disclosure.querySelector('[data-message]');
      const sourceId = 'satnav-field-survey';
      const layers = [
        ['area', 'perimeter', 'fill', { 'fill-color': '#a98efa', 'fill-opacity': 0.12 }],
        ['boundary', 'perimeter', 'line', { 'line-color': '#b59bff', 'line-width': 2, 'line-dasharray': [2, 2] }],
        ['trail', 'walked-track', 'line', { 'line-color': '#ffa56b', 'line-width': 4 }],
        ['fix', 'walked-fix', 'circle', { 'circle-radius': 4, 'circle-color': '#ffa56b', 'circle-stroke-color': '#182028', 'circle-stroke-width': 1 }],
      ];
      const errors = {
        INVALID_VERTEX_COUNT: 'Use 3 to 1,000 boundary pins.',
        INVALID_COORDINATE: 'Perimeters require points between 85° S and 85° N.',
        DUPLICATE_VERTEX: 'Move or remove the repeated boundary pin.',
        SELF_INTERSECTION: 'Reorder the pins so the boundary does not cross itself.',
        BACKTRACKING_EDGE: 'Move the pin that doubles back along a boundary edge.',
        DEGENERATE_POLYGON: 'Move a pin so the boundary encloses an area.',
        UNSUPPORTED_LONGITUDE_SPAN: 'This perimeter crosses the supported longitude range.',
      };
      let map = null;
      let drawTimer = null;
      const length = metres => metres < 1000 ? Math.round(metres) + ' m' : (metres / 1000).toFixed(2) + ' km';

      function draw() {
        drawTimer = null;
        if (!map?.getStyle()?.layers?.length) return;
        if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: survey.mapData() });
        else map.getSource(sourceId).setData(survey.mapData());
        const before = map.getStyle().layers.find(layer => layer.type === 'circle' && layer.id.includes('satnav') && layer.source !== sourceId)?.id;
        for (const [suffix, role, type, paint] of layers) {
          const id = sourceId + '-' + suffix;
          if (!map.getLayer(id)) map.addLayer({ id, source: sourceId, type, paint, filter: ['==', ['get', 'satnavRole'], role] }, before);
        }
      }

      function scheduleDraw() {
        if (drawTimer === null) drawTimer = setTimeout(draw, 500);
      }

      function attachMap() {
        const next = api.getMap();
        if (map !== next) {
          map?.off('style.load', scheduleDraw);
          map = next;
          map?.on('style.load', scheduleDraw);
        }
        scheduleDraw();
      }

      function render() {
        const pins = api.getPins();
        const polygon = survey.perimeter;
        loop.disabled = !polygon && pins.length < 3;
        loop.textContent = polygon ? 'Open perimeter' : 'Close perimeter';
        loop.setAttribute('aria-pressed', String(!!polygon));
        record.textContent = { recording: 'Pause track', paused: 'Resume track' }[survey.status] ?? 'Record track';
        record.disabled = survey.full || !api.isTracking();
        stop.disabled = !['recording', 'paused'].includes(survey.status);
        download.disabled = !pins.length && !survey.pointCount;
        if (polygon) {
          const area = polygon.areaM2 < 10_000 ? Math.round(polygon.areaM2) + ' m²' : polygon.areaHa.toFixed(2) + ' ha';
          planText.textContent = 'Planned perimeter ' + length(polygon.perimeterM) + ' · ' + area +
            (polygon.exceedsFollowerSegmentLimit ? ' · Use legs of 1 km or less for guidance.' : '');
        } else planText.textContent = '';
        const progress = { recording: 'Recording', paused: 'Paused', stopped: 'Stopped' }[survey.status];
        if (survey.full) trackText.textContent = '20,000 fixes recorded. Export your track.';
        else if (progress) trackText.textContent = progress + ' · ' + survey.pointCount + (survey.pointCount === 1 ? ' fix · ' : ' fixes · ') + length(survey.distanceM) + ' measured';
        else trackText.textContent = api.isTracking() ? '' : 'Select My location to record a track.';
      }

      function applyLoop() {
        try {
          const polygon = survey.close(api.getPins());
          const canFollow = !polygon.exceedsFollowerSegmentLimit;
          const accepted = api.setClosedLoop(canFollow);
          if (canFollow && accepted === false) message.textContent = 'Perimeter drawn. Return guidance unavailable.';
        } catch (error) {
          survey.reopen();
          api.setClosedLoop(false);
          message.textContent = errors[error.message] ?? 'These pins cannot form a perimeter.';
        }
      }

      loop.onclick = () => {
        message.textContent = '';
        if (survey.perimeter) { survey.reopen(); api.setClosedLoop(false); }
        else applyLoop();
        render();
        scheduleDraw();
      };
      record.onclick = () => {
        message.textContent = '';
        if (!api.isTracking()) return;
        if (survey.status === 'recording') survey.pause();
        else if (survey.status === 'paused') survey.resume();
        else survey.start();
        render();
      };
      const stopRecording = () => { survey.stop(); render(); scheduleDraw(); };
      stop.onclick = stopRecording;
      download.onclick = () => {
        try {
          const data = survey.exportData(api.getPins());
          const blob = new Blob([JSON.stringify(data)], { type: 'application/geo+json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'ventus-survey-' + new Date().toISOString().replace(/[:.]/g, '-') + '.geojson';
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
          message.textContent = '';
        } catch { message.textContent = 'Export could not be prepared. Your track is still here.'; }
      };
      panel.addEventListener('satnav:pins', () => {
        message.textContent = '';
        if (survey.perimeter) applyLoop();
        render();
        scheduleDraw();
      });
      panel.addEventListener('satnav:fix', event => {
        if (survey.ingest(event.detail)) { render(); scheduleDraw(); }
      });
      panel.addEventListener('satnav:watch', render);
      panel.addEventListener('satnav:stop', stopRecording);
      panel.addEventListener('satnav:map', attachMap);
      disclosure.addEventListener('toggle', render);
      attachMap();
      render();
    } catch (error) {
      console.error('Field survey could not start', error);
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'Field survey unavailable.';
      host.append(message);
    }
  }
  document.addEventListener('satnav:ready', mount, { once: true });
  void mount();
})();
