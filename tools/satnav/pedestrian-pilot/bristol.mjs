// SPDX-License-Identifier: Apache-2.0
import {createBristolFootpathRouter} from '../pedestrian/mapped-footpaths.mjs';

const bundleUrl = new URL('../pedestrian/bristol-footpaths.geojson', import.meta.url);
const sourceId = 'satnav-bristol-footpaths';
const coverageLayer = sourceId + '-coverage';
const routeLayer = sourceId + '-route';
const empty = {type: 'FeatureCollection', features: []};
const unavailable = {
  'invalid-point': 'Select FROM and TO on the highlighted footpaths.',
  'outside-coverage': 'Route unavailable. Select both pins within 12 m of a highlighted Bristol footpath.',
  'no-mapped-connection': 'Route unavailable. No mapped connection joins these pins in this extract.',
  'ambiguous-tap': 'Route unavailable. Select a point away from a crossing or overlapping paths.',
  'same-position': 'Both pins select the same place on the footpath.',
  'excluded-section': 'Route unavailable. A section is excluded.',
};

export function installBristolFootpaths({map, container, maths, getEndpoints}) {
  const style = document.createElement('style');
  style.textContent = `#satnav-bristol{border-radius:6px;background:#081820ed;color:#e4f7f7}
    #satnav-bristol summary{padding:8px;min-height:40px;box-sizing:border-box;cursor:pointer}
    #satnav-bristol .footpath-brief{display:block;font-size:11px;color:#c9edce}
    #satnav-bristol[open] .footpath-brief,#satnav-bristol .footpath-brief[hidden]{display:none}
    #satnav-bristol p,#satnav-bristol small{display:block;margin:0;padding:3px 7px 7px}
    #satnav-bristol a{color:#8bf7f7}#satnav-bristol button{margin:2px 0 2px 4px}`;
  const details = document.createElement('details');
  details.id = 'satnav-bristol';
  details.innerHTML = `<summary>Bristol footpaths<span class="footpath-brief" aria-live="polite" hidden></span></summary>
    <p>Coverage is limited to council paths BCC/21, BCC/25 and BCC/38. Check signs and current restrictions before walking.</p>
    <button type="button" data-bristol="example">Show example</button>
    <button type="button" data-bristol="pins">Route FROM to TO</button>
    <button type="button" data-bristol="clear" hidden>Clear footpaths</button>
    <p role="status" class="footpath-result"></p>
    <small>Contains public sector information from <a href="https://www.arcgis.com/home/item.html?id=3716eccf257a423f939a2bf6da435c5c" target="_blank" rel="noopener noreferrer">Bristol City Council</a> licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener noreferrer">Open Government Licence v3.0</a>.</small>`;
  container.append(style, details);
  const message = details.querySelector('[role="status"]');
  const brief = details.querySelector('.footpath-brief');
  const clear = details.querySelector('[data-bristol="clear"]');

  let bundle, calculate, example, loading;
  let mode = null, lastPins = null, displayed = empty, paintedSource, paintedData;
  let revision = 0, painting = false;

  function paint() {
    if (painting || (!mode && !paintedSource)) return;
    if (!map.getLayer('l-sat') && !map.isStyleLoaded()) return;
    painting = true;
    try {
      if (!map.getSource(sourceId)) map.addSource(sourceId, {type: 'geojson', data: displayed});
      const source = map.getSource(sourceId);
      const marker = map.getStyle().layers.find(layer => layer.type === 'circle' && layer.id.includes('satnav'))?.id;
      if (!map.getLayer(coverageLayer)) {
        map.addLayer({id: coverageLayer, source: sourceId, type: 'line',
          filter: ['has', 'ROUTE_CODE'], paint: {'line-color': '#e7d4ff', 'line-width': 4, 'line-dasharray': [2, 1]}}, marker);
      }
      if (!map.getLayer(routeLayer)) {
        map.addLayer({id: routeLayer, source: sourceId, type: 'line',
          filter: ['==', ['get', 'role'], 'mapped-footpath'],
          paint: {'line-color': '#93f16d', 'line-width': 5}}, marker);
      }
      if (source !== paintedSource || displayed !== paintedData) source.setData(displayed);
      paintedSource = source;
      paintedData = displayed;
    } finally {
      painting = false;
    }
  }

  function showResult(result) {
    const features = [...bundle.features];
    if (result.status === 'mapped') {
      features.push({type: 'Feature', properties: {role: 'mapped-footpath'}, geometry: result.geometry});
      const prefix = mode === 'example' ? 'Example' : 'FROM to TO';
      message.textContent = `${prefix} · ${result.route} · ${Math.round(result.distanceM)} m on the mapped path. Current access is unverified.`;
      brief.textContent = `${prefix} · ${result.route} · ${Math.round(result.distanceM)} m · access unverified`;
      if (Math.max(result.fromOffsetM, result.toOffsetM) >= 0.5) {
        message.textContent += ` Pins are ${Math.round(result.fromOffsetM)} m and ${Math.round(result.toOffsetM)} m from the path.`;
      }
    } else {
      message.textContent = unavailable[result.reason] || 'A mapped pedestrian route is unavailable.';
      brief.textContent = 'Coverage only · no mapped route';
    }
    brief.hidden = false;
    displayed = {type: 'FeatureCollection', features};
    paint();
  }

  function refresh() {
    if (mode !== 'pins' || !calculate) return;
    const pins = getEndpoints() || [];
    const key = JSON.stringify(pins);
    if (key === lastPins) return;
    lastPins = key;
    showResult(calculate(pins[0], pins[1]));
  }

  async function load() {
    const response = await fetch(bundleUrl);
    if (!response.ok) throw new Error('Footpaths unavailable');
    const data = await response.json();
    const route = createBristolFootpathRouter(data, maths);
    const points = code => data.features.find(f => f.properties.ROUTE_CODE === code).geometry.coordinates;
    const sample = route(points('BCC/21/10')[0], points('BCC/21/30').at(-1));
    if (sample.status !== 'mapped') throw new Error('Footpath example unavailable');
    bundle = data;
    calculate = route;
    example = sample;
  }

  async function select(next) {
    const selected = ++revision;
    mode = next;
    lastPins = null;
    clear.hidden = false;
    if (!calculate) {
      message.textContent = 'Loading Bristol footpaths…';
      try {
        loading ??= load().finally(() => { loading = null; });
        await loading;
      } catch {
        if (selected === revision) message.textContent = 'Bristol footpaths could not be loaded. Try again when connected.';
        return;
      }
    }
    if (selected !== revision) return;
    if (mode === 'pins') {
      refresh();
      return;
    }
    showResult(example);
    const points = bundle.features.flatMap(feature => feature.geometry.coordinates);
    const lngs = points.map(p => p[0]), lats = points.map(p => p[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      {padding: 35, maxZoom: 17, duration: 0});
  }

  function hide() {
    revision++;
    mode = null;
    displayed = empty;
    clear.hidden = true;
    message.textContent = '';
    brief.hidden = true;
    brief.textContent = '';
    paint();
  }

  details.querySelector('[data-bristol="example"]').onclick = () => select('example');
  details.querySelector('[data-bristol="pins"]').onclick = () => select('pins');
  clear.onclick = hide;
  details.addEventListener('toggle', () => { if (!details.open && loading) hide(); });
  map.on('style.load', paint);
  map.on('idle', paint);
  return {refresh, destroy() {
    revision++;
    mode = null;
    map.off('style.load', paint);
    map.off('idle', paint);
    if (map.getLayer(routeLayer)) map.removeLayer(routeLayer);
    if (map.getLayer(coverageLayer)) map.removeLayer(coverageLayer);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    details.remove();
    style.remove();
  }};
}
