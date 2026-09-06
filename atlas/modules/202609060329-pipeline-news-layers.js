/* Compact successor of atlas/modules/202609030048-pipeline-news-layers.js; original source retained, tokens and AST verified. */

(() => {
'use strict';
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.pipelineNewsLayers) return;
const geodesy = NS.geodesy;
if (!geodesy) {
throw new Error('pipeline-news-layers requires the geodesy module');
}
const GENERATION = '202609030048';
const RADIUS_KM = 25;
const GROUP_TITLE = 'PIPELINE NEWS (REPD)';
const REGISTER_SOURCE = 'src-repd';
const REGISTER_PRIMER = 'biomass';
const SPINE_TECHS = new Set(['solar', 'solar_roof', 'bess', 'wind']);
const TECH_COLOUR = {
solar: '#ffff00', solar_roof: '#ffcc00', bess: '#ffae00', wind: '#00ffff',
biomass: '#39ff14', hydro: '#00aaff', hydrogen: '#ffffff', tidal: '#00bfff',
act: '#ff6600', geothermal: '#ff3300', flywheel: '#ff69b4', caes: '#88aaff',
other: '#888888'
};
const CONTROLS = [
{
id: 'same',
label: 'Same technology',
colour: '#5fbdc2',
keep: (row, selection) => row.tech === selection.tech
},
{
id: 'wider',
label: 'Wider fleet',
colour: '#39ff14',
keep: (row) => !SPINE_TECHS.has(row.tech)
},
{
id: 'all',
label: 'All pipeline',
colour: '#d8b64a',
keep: () => true
}
];
const state = {
schema: 'gridatlas.pipeline-news-layers.v1',
generation: GENERATION,
installed: false,
register_rows: 0,
register_url: null,
radius_km: RADIUS_KM,
selection: null,
counts: {},
active: [],
failures: []
};
window.__GRIDATLAS_PIPELINE_LAYERS__ = state;
function note(message) {
const text = String(message && message.message ? message.message : message);
if (!state.failures.includes(text)) state.failures.push(text);
}
let register = null;
function readRegisterSource(map) {
try {
const source = map.getSource(REGISTER_SOURCE);
const features = source && source._data && source._data.features;
if (!Array.isArray(features) || !features.length) return null;
return features.map((feature) => {
const properties = feature.properties || {};
const coordinates = (feature.geometry || {}).coordinates || [];
return {
name: properties.name || '',
operator: properties.operator || '',
tech: properties.tech || 'other',
raw: properties.raw_tech || '',
status: properties.status || '',
mw: Number(properties.capacity) || 0,
lon: Number(coordinates[0]),
lat: Number(coordinates[1])
};
}).filter((row) => Number.isFinite(row.lon) && Number.isFinite(row.lat));
} catch (error) {
note('register: ' + String(error && error.message || error));
return null;
}
}
function primeRegister() {
const box = document.querySelector(
'#scada-ui-container input[type=checkbox][data-layer-id="' + REGISTER_PRIMER + '"]');
if (!box) { note('register: no ' + REGISTER_PRIMER + ' control to prime with'); return false; }
if (!box.checked) box.click();
state.primed_with = REGISTER_PRIMER;
return true;
}
async function loadRegister(map) {
if (register) return register;
register = readRegisterSource(map);
if (register) { state.register_rows = register.length; return register; }
if (!primeRegister()) throw new Error('register unavailable');
for (let attempt = 0; attempt < 40; attempt += 1) {
await new Promise((resolve) => setTimeout(resolve, 250));
register = readRegisterSource(map);
if (register) { state.register_rows = register.length; return register; }
}
note('register: ' + REGISTER_SOURCE + ' did not hydrate within 10 s');
throw new Error('register unavailable');
}
function readSelection(map) {
try {
const source = map.getSource('gridatlas-project-pin');
const features = source && source._data && source._data.features;
if (!features || !features.length) return null;
const [lon, lat] = features[0].geometry.coordinates || [];
if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
const links = window.__GRIDATLAS_NEON_LINKS__ || {};
const name = (features[0].properties || {}).name
|| (links.project_pin || {}).name || '';
return { lon, lat, name, tech: (links.last_selection || {}).tech || '' };
} catch (error) {
note('selection: ' + String(error && error.message || error));
return null;
}
}
function near(rows, selection) {
const found = [];
for (const row of rows) {
const km = geodesy.distanceKm(selection.lon, selection.lat, row.lon, row.lat);
if (km > RADIUS_KM) continue;
if (km < 0.0005 && row.name === selection.name) continue;
found.push({ ...row, km });
}
found.sort((a, b) => a.km - b.km);
return found;
}
function collection(rows) {
return {
type: 'FeatureCollection',
features: rows.map((row) => ({
type: 'Feature',
geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
properties: {
name: row.name, operator: row.operator, tech: row.tech,
raw_tech: row.raw, status: row.status, mw: row.mw,
km: Number(row.km.toFixed(3)),
colour: TECH_COLOUR[row.tech] || TECH_COLOUR.other
}
}))
};
}
function setSourceData(map, id, data) {
try {
const source = map.getSource(id);
if (!source || typeof source.setData !== 'function') {
note('source missing, nothing drawn: ' + id);
return false;
}
source.setData(data);
return true;
} catch (error) {
note('source ' + id + ': ' + String(error && error.message || error));
return false;
}
}
function ensureLayers(map, control) {
const sourceId = 'pn-src-' + control.id;
const ringId = 'l-pn-' + control.id + '-ring';
const dotId = 'l-pn-' + control.id;
if (map.getSource(sourceId)) return { sourceId, ringId, dotId };
try {
map.addSource(sourceId, { type: 'geojson', data: collection([]) });
} catch (error) {
note('addSource ' + sourceId + ': ' + String(error && error.message || error));
return { sourceId, ringId, dotId };
}
map.addLayer({
id: ringId, type: 'circle', source: sourceId,
paint: {
'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8, 16, 13],
'circle-color': 'rgba(0,0,0,0)',
'circle-stroke-color': control.colour,
'circle-stroke-width': 1.4,
'circle-stroke-opacity': 0.9
}
});
map.addLayer({
id: dotId, type: 'circle', source: sourceId,
paint: {
'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.8, 12, 3.4, 16, 5.5],
'circle-color': ['coalesce', ['get', 'colour'], '#888888'],
'circle-opacity': 0.95
}
});
map.on('click', dotId, (event) => {
const properties = (event.features && event.features[0] || {}).properties || {};
try {
new window.maplibregl.Popup({ closeButton: true })
.setLngLat(event.lngLat)
.setHTML(
'<div style="font-family:monospace;background:#000;padding:6px;max-width:260px">'
+ '<b style="color:#5fbdc2;font-size:12px">' + escapeHtml(properties.name || 'Project') + '</b><br>'
+ '<span style="color:#888">' + escapeHtml(properties.raw_tech || properties.tech || '') + '</span><br>'
+ '<span style="color:#ffae00">' + escapeHtml(String(properties.mw || 0)) + ' MW</span> · '
+ '<span style="color:#aaa">' + escapeHtml(properties.status || '') + '</span><br>'
+ '<span style="color:#555;font-size:10px">' + escapeHtml(String(properties.km)) + ' km from the selected project. '
+ 'Proximity only — not a connection, a circuit or a queue position.</span></div>')
.addTo(map);
} catch (error) {
note('popup: ' + String(error && error.message || error));
}
});
map.on('mouseenter', dotId, () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', dotId, () => { map.getCanvas().style.cursor = ''; });
return { sourceId, ringId, dotId };
}
function escapeHtml(value) {
return String(value == null ? '' : value)
.replace(/[&<>"]/g, (character) => ({
'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[character]));
}
function setVisibility(map, control, visible) {
for (const id of ['l-pn-' + control.id + '-ring', 'l-pn-' + control.id]) {
if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}
}
function labelFor(control, count, selection) {
if (!selection) return control.label + ' [SELECT A PROJECT]';
if (count === null || count === undefined) return control.label + ' [WAIT]';
return control.label + ' [' + count.toLocaleString('en-GB') + ' within ' + RADIUS_KM + ' km]';
}
function paintLabels(selection) {
for (const control of CONTROLS) {
const text = labelFor(control, state.counts[control.id], selection);
for (const span of document.querySelectorAll('[data-pn-label="' + control.id + '"]')) {
span.textContent = text;
}
}
}
async function refresh(map, control) {
const selection = state.selection;
if (!selection) return;
const rows = await loadRegister(map);
const found = near(rows.filter((row) => control.keep(row, selection)), selection);
state.counts[control.id] = found.length;
const { sourceId } = ensureLayers(map, control);
setSourceData(map, sourceId, collection(found));
paintLabels(selection);
}
function buildGroup(container, isFullscreen) {
if (container.querySelector('[data-pn-group]')) return;
const group = document.createElement('div');
group.className = 'key-group';
group.setAttribute('data-pn-group', '1');
const title = document.createElement('div');
title.className = 'key-title';
title.textContent = GROUP_TITLE;
group.appendChild(title);
for (const control of CONTROLS) {
const label = document.createElement('label');
label.className = 'key-item';
const input = document.createElement('input');
input.type = 'checkbox';
input.setAttribute('data-pn-layer', control.id);
input.dataset.pnLayer = control.id;
const span = document.createElement('span');
span.setAttribute('data-pn-label', control.id);
span.style.color = control.colour;
span.textContent = labelFor(control, state.counts[control.id], state.selection);
label.appendChild(input);
label.appendChild(document.createTextNode(' '));
label.appendChild(span);
group.appendChild(label);
}
container.appendChild(group);
state[isFullscreen ? 'installed_fullscreen' : 'installed_main'] = true;
}
function bind(map, container) {
container.addEventListener('change', (event) => {
const target = event.target;
if (!target || target.type !== 'checkbox' || !target.dataset.pnLayer) return;
const control = CONTROLS.find((candidate) => candidate.id === target.dataset.pnLayer);
if (!control) return;
for (const twin of document.querySelectorAll(
'input[data-pn-layer="' + control.id + '"]')) {
twin.checked = target.checked;
}
state.active = CONTROLS
.filter((candidate) => document.querySelector(
'input[data-pn-layer="' + candidate.id + '"]:checked'))
.map((candidate) => candidate.id);
if (!target.checked) {
setVisibility(map, control, false);
return;
}
if (!state.selection) {
paintLabels(null);
target.checked = false;
return;
}
ensureLayers(map, control);
setVisibility(map, control, true);
refresh(map, control).catch((error) => {
note('refresh: ' + String(error && error.message || error));
paintLabels(state.selection);
});
});
}
function install() {
const map = window.__GRIDATLAS_V9_MAP__;
const container = document.getElementById('scada-ui-container');
if (!map || typeof map.addSource !== 'function') return false;
if (!container || !container.querySelector('.key-group')) return false;
buildGroup(container, false);
bind(map, container);
const curtain = document.getElementById('fs-curtain-keys');
if (curtain) { buildGroup(curtain, true); bind(map, curtain); }
let lastKey = '';
if (typeof setInterval !== 'function') return true;
setInterval(() => {
const selection = readSelection(map);
const key = selection ? [selection.lon, selection.lat, selection.tech].join('|') : '';
if (key === lastKey) return;
lastKey = key;
state.selection = selection;
state.counts = {};
if (!selection) {
for (const control of CONTROLS) setVisibility(map, control, false);
paintLabels(null);
return;
}
paintLabels(selection);
for (const control of CONTROLS) {
if (!document.querySelector('input[data-pn-layer="' + control.id + '"]:checked')) continue;
refresh(map, control).catch((error) => note('refresh: '
+ String(error && error.message || error)));
}
}, 1000);
state.installed = true;
return true;
}
if (typeof setInterval === 'function') {
const started = Date.now();
const boot = setInterval(() => {
let done = false;
try { done = install(); } catch (error) { note('install: ' + String(error && error.message || error)); }
if (done || Date.now() - started > 120000) clearInterval(boot);
}, 400);
}
NS.pipelineNewsLayers = Object.freeze({
schema: 'gridatlas.module.pipeline-news-layers.v1',
generation: GENERATION,
RADIUS_KM,
CONTROLS: CONTROLS.map((control) => control.id),
install,
state
});
})();
