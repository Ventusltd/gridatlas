/* Compact successor of atlas/modules/202609031958-menu-bar.js; original source retained, tokens and AST verified. */

(function gridAtlasMenuBar() {
'use strict';
if (typeof window === 'undefined' || typeof document === 'undefined') return;
var SCHEMA = 'gridatlas.menu-bar.v2';
var BAR_ID = 'gridatlas-menu-bar';
var STYLE_ID = BAR_ID + '-css';
var FAILURE_ID = BAR_ID + '-failure';
var MENUS = ['File', 'Edit', 'View', 'Scope', 'Grid', 'About'];
var EXPECTED_ENGINE_LAYERS = 60;
var EXPECTED_PIPELINE_LAYERS = 3;
var EXPECTED_LAYER_CONTROLS = 63;
var MAX_TRIES = 160;
var NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.menuBar && NS.menuBar.schema === SCHEMA) return;
var state = {
schema: SCHEMA,
menus: MENUS.slice(),
bar_id: BAR_ID,
installed: false,
controls_moved: 0,
layer_controls: 0,
engine_layer_controls: 0,
pipeline_layer_controls: 0,
expected_layer_controls: EXPECTED_LAYER_CONTROLS,
panel_counts: {},
failure: null,
tries: 0,
listeners: 0,
closed_at_rest: true,
one_identity_surface: false
};
NS.menuBar = state;
var bar = null;
var panels = {};
var titles = [];
var layerTargets = Object.create(null);
var layerProxies = Object.create(null);
var forwardingLayerChoice = false;
var observer = null;
var timer = null;
var brandSlot = null;
var gridHead = null;
var gridBody = null;
function array(value) {
return Array.prototype.slice.call(value || []);
}
function cleanText(value) {
return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
function layerKey(input) {
if (!input || !input.getAttribute) return '';
var engine = input.getAttribute('data-layer-id');
if (engine) return 'engine:' + engine;
var pipeline = input.getAttribute('data-pn-layer');
return pipeline ? 'pipeline:' + pipeline : '';
}
function layerLabel(input) {
var label = input && input.closest ? input.closest('label') : null;
var span = label && label.querySelector
? label.querySelector('[data-base-label], [data-pn-label], span') : null;
var base = span && span.getAttribute ? span.getAttribute('data-base-label') : '';
var text = cleanText((span && span.textContent) || base
|| (label && label.textContent) || layerKey(input).split(':').slice(1).join(':'));
return text || layerKey(input);
}
function layerGroup(input) {
var group = input && input.closest ? input.closest('.key-group') : null;
var title = group && group.querySelector ? group.querySelector('.key-title') : null;
return cleanText(title && title.textContent) || 'Other layers';
}
function inventory(doc) {
var host = doc.getElementById('scada-ui-container');
var engine = host ? array(host.querySelectorAll(
'input[type="checkbox"][data-layer-id]')) : [];
var pipeline = host ? array(host.querySelectorAll(
'input[type="checkbox"][data-pn-layer]')) : [];
var controls = engine.concat(pipeline);
var keys = controls.map(layerKey);
var unique = new Set(keys);
return {
host: host,
engine: engine,
pipeline: pipeline,
controls: controls,
keys: keys,
complete: engine.length === EXPECTED_ENGINE_LAYERS
&& pipeline.length === EXPECTED_PIPELINE_LAYERS
&& controls.length === EXPECTED_LAYER_CONTROLS
&& unique.size === EXPECTED_LAYER_CONTROLS
&& !keys.includes('')
};
}
state.inspect = function () {
var found = inventory(document);
return {
engine: found.engine.length,
pipeline: found.pipeline.length,
total: found.controls.length,
unique: new Set(found.keys).size,
complete: found.complete
};
};
function required(doc) {
var found = inventory(doc);
var nodes = {
host: doc.querySelector('.map-container'),
stack: doc.querySelector('.map-controls'),
search: doc.querySelector('.search-bar-wrapper'),
header: doc.querySelector('.hud-header'),
exportButton: doc.getElementById('btn-export'),
statusButton: doc.getElementById('btn-status'),
fullscreenButton: doc.getElementById('btn-fullscreen'),
radiusButton: doc.getElementById('btn-radius'),
radiusAreaButton: doc.getElementById('btn-radius-area'),
zoneButton: doc.getElementById('btn-zonedraw'),
measureButton: doc.getElementById('btn-measure')
};
var missing = Object.keys(nodes).filter(function (key) { return !nodes[key]; });
if (!found.complete) missing.push('63 unique layer controls');
return { found: found, nodes: nodes, missing: missing };
}
function installStyle(doc) {
if (doc.getElementById(STYLE_ID)) return;
var style = doc.createElement('style');
style.id = STYLE_ID;
style.textContent = [
'#' + BAR_ID + '{position:absolute;top:0;left:0;right:0;height:36px;z-index:10020;',
'display:flex;align-items:stretch;gap:0;padding-left:env(safe-area-inset-left);',
'padding-right:env(safe-area-inset-right);box-sizing:border-box;',
'background:rgba(4,10,13,.95);border-bottom:1px solid rgba(80,220,240,.3);',
'font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
'-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);',
'isolation:isolate;pointer-events:auto}',
'#' + BAR_ID + ' .gm-menu{position:relative;min-width:0}',
'#' + BAR_ID + ' .gm-title{appearance:none;border:0;background:transparent;color:#cfeef6;',
'min-height:36px;padding:0 11px;cursor:pointer;font:inherit;letter-spacing:.05em;',
'text-transform:uppercase;white-space:nowrap}',
'#' + BAR_ID + ' .gm-title:hover,#' + BAR_ID + ' .gm-title:focus-visible,',
'#' + BAR_ID + ' .gm-menu.gm-open>.gm-title{background:rgba(80,220,240,.16);color:#fff}',
'#' + BAR_ID + ' .gm-title:focus-visible,#' + BAR_ID + ' .gm-panel :focus-visible{',
'outline:2px solid #6bebff;outline-offset:-2px}',
'#' + BAR_ID + ' .gm-side{display:flex;align-items:stretch;flex:1 1 0;min-width:0}',
'#' + BAR_ID + ' .gm-side-left{justify-content:flex-start}',
'#' + BAR_ID + ' .gm-side-right{justify-content:flex-end}',
'#' + BAR_ID + ' .gm-brand-slot{flex:0 1 auto;min-width:0;max-width:64%;',
'display:flex;align-items:center;justify-content:center;overflow:hidden;',
'padding:0 6px;text-align:center}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header{display:flex!important;',
'position:static!important;width:auto!important;align-items:center;',
'justify-content:center;gap:11px;margin:0!important;padding:0!important;',
'background:none!important;border:0!important}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header>div{flex:0 0 auto;line-height:1.05}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header small{font-size:6.5px;white-space:nowrap}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header .hud-val{font-size:10.5px;',
'text-shadow:none}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:14px;font-weight:800;',
'letter-spacing:.2em;margin:0;color:#fff}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:5.5px;letter-spacing:.14em}',
'#' + BAR_ID + ' .gm-panel{position:absolute;top:100%;left:0;min-width:240px;',
'max-width:min(92vw,420px);max-height:min(72dvh,620px);overflow:auto;',
'overscroll-behavior:contain;padding:6px;background:rgba(4,10,13,.98);',
'border:1px solid rgba(80,220,240,.32);border-top:0;',
'box-shadow:0 12px 34px rgba(0,0,0,.68);box-sizing:border-box}',
'#' + BAR_ID + ' .gm-panel[hidden]{display:none!important}',
'#' + BAR_ID + ' .gm-side-right .gm-panel{left:auto;right:0}',
'#' + BAR_ID + ' .gm-panel button,#' + BAR_ID + ' .gm-panel [role="button"]{',
'display:flex;align-items:center;width:100%;min-height:44px;box-sizing:border-box;',
'position:static!important;inset:auto!important;transform:none!important;margin:0 0 3px;',
'padding:7px 10px;border:0;border-radius:2px;background:transparent;color:#cfeef6;',
'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:left;',
'letter-spacing:.03em;text-transform:none;cursor:pointer}',
'#' + BAR_ID + ' .gm-panel button:hover,#' + BAR_ID + ' .gm-panel [role="button"]:hover{',
'background:rgba(80,220,240,.14);color:#fff}',
'#' + BAR_ID + ' .gm-panel a[data-gm-estate],#' + BAR_ID + ' .gm-panel a[data-gm-engine],',
'#' + BAR_ID + ' .gm-panel a[data-gm-study]',
'{text-decoration:none}',
'#' + BAR_ID + ' .gm-panel a[data-gm-engine]{white-space:nowrap;overflow:hidden;',
'text-overflow:ellipsis;display:block;line-height:30px;min-height:44px}',
'#' + BAR_ID + ' .gm-panel .custom-map-attrib{position:static!important;',
'inset:auto!important;margin:4px 0 2px;padding:6px 8px;max-width:none;',
'background:transparent;border:0;white-space:normal;line-height:1.45;',
'font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fb6c0}',
'#' + BAR_ID + ' .gm-layer-group{margin:5px 0 2px;padding:6px 8px 3px;',
'border-top:1px solid #19343b;color:#6fa2ae;font-size:10px;letter-spacing:.08em;',
'text-transform:uppercase}',
'#' + BAR_ID + ' .gm-layer{position:relative;display:flex;align-items:center;gap:10px;',
'min-height:44px;box-sizing:border-box;padding:7px 9px;color:#cfeef6;cursor:pointer;',
'line-height:1.35}',
'#' + BAR_ID + ' .gm-layer:hover{background:rgba(80,220,240,.12)}',
'#' + BAR_ID + ' .gm-layer input{position:absolute;inset:0;width:100%;height:100%;',
'margin:0;opacity:0;cursor:pointer;z-index:1}',
'#' + BAR_ID + ' .gm-layer-box{width:20px;height:20px;flex:0 0 auto;',
'border:1.5px solid #4a8b96;border-radius:4px;position:relative;',
'background:rgba(255,255,255,.04)}',
'#' + BAR_ID + ' .gm-layer input:checked~.gm-layer-box{background:#4fd7ee;',
'border-color:#4fd7ee}',
'#' + BAR_ID + ' .gm-layer input:checked~.gm-layer-box::after{content:"";',
'position:absolute;left:6px;top:2px;width:5px;height:10px;',
'border:solid #04141a;border-width:0 2px 2px 0;transform:rotate(38deg)}',
'#' + BAR_ID + ' .gm-layer input:focus-visible~.gm-layer-box{outline:2px solid #6bebff;',
'outline-offset:2px}',
'#' + BAR_ID + ' .gm-layer-name{overflow-wrap:anywhere}',
'#' + BAR_ID + ' .gm-panel-grid{padding:0;overflow:hidden;display:flex;',
'flex-direction:column;min-width:min(94vw,360px);max-width:min(96vw,900px)}',
'#' + BAR_ID + ' .gm-panel-head{flex:0 0 auto;padding:8px 8px 0}',
'#' + BAR_ID + ' .gm-panel-head .scada-brand{padding:0 0 6px;margin:0 0 6px}',
'#' + BAR_ID + ' .gm-panel-head .status-legend{padding:0 0 8px;margin:0;border:0}',
'#' + BAR_ID + ' .gm-panel-body{flex:1 1 auto;overflow:auto;',
'overscroll-behavior:contain;padding:6px;min-height:0}',
'@media(min-width:560px){#' + BAR_ID + ' .gm-panel-body{column-count:2;',
'column-gap:14px}',
'#' + BAR_ID + ' .gm-panel-body .gm-layer-group{break-inside:avoid}',
'#' + BAR_ID + ' .gm-panel-body .gm-layer{break-inside:avoid}}',
'@media(min-width:900px){#' + BAR_ID + ' .gm-panel-body{column-count:3}}',
'#' + BAR_ID + ' .search-bar-wrapper{position:static!important;display:grid!important;',
'grid-template-columns:minmax(150px,1fr) auto;width:min(82vw,390px);gap:5px;margin:2px 0 6px}',
'#' + BAR_ID + ' .search-bar-wrapper>div{position:relative}',
'#' + BAR_ID + ' .search-input{width:100%!important;min-height:44px;box-sizing:border-box}',
'#' + BAR_ID + ' .search-results{position:static!important;max-height:42vh;overflow:auto}',
'#' + BAR_ID + ' .disclaimer-box,#' + BAR_ID + ' .podcast-shoutout{',
'display:block!important;position:static!important;max-width:380px;padding:8px;',
'box-sizing:border-box;text-align:left;pointer-events:auto}',
'.gridatlas-menu-hosted .map-controls[data-gridatlas-menu-emptied="1"]{display:none!important}',
'.gridatlas-menu-hosted .scada-wrapper{display:flex!important}',
'#gridatlas-dash-toggle{display:inline-flex!important}',
'html.gridatlas-sheet-open #' + BAR_ID + '{z-index:10020!important;pointer-events:auto!important}',
'html.gridatlas-sheet-open #' + BAR_ID + ' .gm-panel{pointer-events:auto!important}',
'body:not(.fs-active) #' + BAR_ID + ' #btn-fullscreen-exit{display:none!important}',
'body.fs-active #' + BAR_ID + ' #btn-fullscreen-exit{display:flex!important}',
'.gridatlas-menu-hosted .custom-map-attrib{',
'top:var(--gridatlas-menu-bar-clear,44px)!important;z-index:10025!important}',
'.gridatlas-menu-hosted #fs-letterhead{display:none!important}',
'@media(max-width:700px){#' + BAR_ID + '{height:34px}',
'#' + BAR_ID + ' .gm-title{min-height:34px;padding:0 6px;font-size:9px;letter-spacing:.025em}',
'#' + BAR_ID + ' .gm-brand-slot{max-width:48%;padding:0 2px}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header>div:first-child,',
'#' + BAR_ID + ' .gm-brand-slot .hud-header>div:last-child{display:none}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:11px;letter-spacing:.14em}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:4.5px}',
'#' + BAR_ID + ' .gm-panel{position:fixed;top:34px;left:4px!important;right:4px!important;',
'width:auto;max-width:none;max-height:calc(100dvh - 40px);padding-bottom:',
'calc(6px + env(safe-area-inset-bottom))}',
'#' + BAR_ID + ' .gm-panel-grid{max-width:none}}'
].join('');
(doc.head || doc.documentElement).appendChild(style);
}
function syncAttribClearance(doc) {
if (!bar || typeof bar.getBoundingClientRect !== 'function') return;
var root = doc.documentElement;
if (!root || !root.style || typeof root.style.setProperty !== 'function') return;
var rect = bar.getBoundingClientRect();
var height = Math.ceil(rect.height) || 36;
var clearance = height + 8;
root.style.setProperty('--gridatlas-menu-bar-clear', clearance + 'px');
state.attrib_clearance_px = clearance;
}
function closeAll(focusTitle) {
if (!bar) return;
array(bar.querySelectorAll('.gm-menu.gm-open')).forEach(function (menu) {
menu.classList.remove('gm-open');
var title = menu.querySelector('.gm-title');
var panel = menu.querySelector('.gm-panel');
if (title) title.setAttribute('aria-expanded', 'false');
if (panel) panel.hidden = true;
});
state.closed_at_rest = true;
openPanelRefs = null;
if (focusTitle && typeof focusTitle.focus === 'function') focusTitle.focus();
}
function syncLayer(key) {
var original = layerTargets[key];
var proxy = layerProxies[key];
if (!original || !proxy) return;
proxy.checked = !!original.checked;
proxy.disabled = !!original.disabled;
proxy.setAttribute('aria-label', layerLabel(original));
var name = proxy.parentNode && proxy.parentNode.querySelector
? proxy.parentNode.querySelector('.gm-layer-name') : null;
if (name) {
var nextLabel = layerLabel(original);
if (name.textContent !== nextLabel) name.textContent = nextLabel;
}
}
function syncAll() {
Object.keys(layerTargets).forEach(syncLayer);
}
function clampPanel(doc, menu, panel) {
if (!panel || typeof panel.getBoundingClientRect !== 'function') return;
if (!menu || typeof menu.getBoundingClientRect !== 'function') return;
panel.style.left = '';
panel.style.right = '';
var view = doc.defaultView || (typeof window !== 'undefined' ? window : null);
var vw = (view && view.innerWidth) || doc.documentElement.clientWidth;
if (!vw) return;
var margin = 4;
var panelRect = panel.getBoundingClientRect();
var desiredLeft = panelRect.left;
if (panelRect.left < margin) desiredLeft = margin;
else if (panelRect.right > vw - margin) desiredLeft = Math.max(margin, vw - margin - panelRect.width);
if (Math.round(desiredLeft) === Math.round(panelRect.left)) return;
var menuRect = menu.getBoundingClientRect();
panel.style.left = (desiredLeft - menuRect.left) + 'px';
panel.style.right = 'auto';
}
var openPanelRefs = null;
function openMenu(menu, title, panel) {
var wasOpen = menu.classList.contains('gm-open');
closeAll();
if (wasOpen) { openPanelRefs = null; return; }
if (title.textContent === 'Grid') syncAll();
menu.classList.add('gm-open');
title.setAttribute('aria-expanded', 'true');
panel.hidden = false;
state.closed_at_rest = false;
openPanelRefs = { menu: menu, panel: panel };
clampPanel(title.ownerDocument || document, menu, panel);
}
function buildBar(doc) {
var nav = doc.createElement('nav');
nav.id = BAR_ID;
nav.setAttribute('aria-label', 'Atlas menu');
var left = doc.createElement('div');
left.className = 'gm-side gm-side-left';
var right = doc.createElement('div');
right.className = 'gm-side gm-side-right';
var brand = doc.createElement('div');
brand.className = 'gm-brand-slot';
brandSlot = brand;
MENUS.forEach(function (name, index) {
var menu = doc.createElement('div');
menu.className = 'gm-menu';
var title = doc.createElement('button');
title.type = 'button';
title.className = 'gm-title';
title.textContent = name;
title.id = BAR_ID + '-title-' + index;
title.setAttribute('aria-haspopup', 'menu');
title.setAttribute('aria-expanded', 'false');
title.setAttribute('aria-controls', BAR_ID + '-panel-' + index);
var panel = doc.createElement('div');
panel.className = 'gm-panel';
panel.id = BAR_ID + '-panel-' + index;
panel.hidden = true;
panel.setAttribute('role', 'group');
panel.setAttribute('aria-labelledby', title.id);
if (name === 'Grid') {
var head = doc.createElement('div');
head.className = 'gm-panel-head';
var body = doc.createElement('div');
body.className = 'gm-panel-body';
panel.appendChild(head);
panel.appendChild(body);
panel.classList.add('gm-panel-grid');
gridHead = head;
gridBody = body;
}
title.addEventListener('click', function (event) {
event.stopPropagation();
openMenu(menu, title, panel);
});
menu.appendChild(title);
menu.appendChild(panel);
(index < 3 ? left : right).appendChild(menu);
panels[name] = panel;
titles.push(title);
});
nav.appendChild(left);
nav.appendChild(brand);
nav.appendChild(right);
nav.addEventListener('keydown', function (event) {
var active = doc.activeElement;
var index = titles.indexOf(active);
if (event.key === 'Escape') {
var owner = active && active.closest ? active.closest('.gm-menu') : null;
var ownerTitle = owner && owner.querySelector ? owner.querySelector('.gm-title') : null;
closeAll(ownerTitle);
event.preventDefault();
return;
}
if (index < 0) return;
if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
var delta = event.key === 'ArrowRight' ? 1 : -1;
titles[(index + delta + titles.length) % titles.length].focus();
event.preventDefault();
} else if (event.key === 'Home' || event.key === 'End') {
titles[event.key === 'Home' ? 0 : titles.length - 1].focus();
event.preventDefault();
} else if (event.key === 'ArrowDown') {
var ownerMenu = active.closest('.gm-menu');
var ownerPanel = ownerMenu.querySelector('.gm-panel');
openMenu(ownerMenu, active, ownerPanel);
var first = ownerPanel.querySelector('button,input,[role="button"]');
if (first && first.focus) first.focus();
event.preventDefault();
}
});
return nav;
}
function appendGroup(panel, text) {
var heading = document.createElement('div');
heading.className = 'gm-layer-group';
heading.textContent = text;
panel.appendChild(heading);
}
var ESTATE_LINKS = [
{ href: 'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph',
text: 'Grid engine · the maths' },
{ href: 'https://ventusltd.github.io/data-federation-map-for-globalgrid2050-all-repos/dashboard/sandbox/spider_full_po_test.html',
text: 'Federation map' },
{ href: 'https://ventusltd.github.io/spiders/spider_printer_v1/',
text: 'Spider printer' }
];
var ENGINE_GRAPH_URL =
'https://ventusltd.github.io/ventus-grid-engine/genome/engine-graph.json';
var ENGINE_VIEW_URL =
'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph&focus=';
var engineFetchStarted = false;
function appendEngineModules(panel) {
if (!panel || !window.fetch || engineFetchStarted) return;
if (panel.querySelector('[data-gm-engine]')) return;
engineFetchStarted = true;
fetch(ENGINE_GRAPH_URL, { cache: 'no-cache' }).then(function (response) {
if (!response.ok) throw new Error('HTTP ' + response.status);
return response.json();
}).then(function (graph) {
var nodes = (graph && graph.nodes) || [];
if (!nodes.length || panel.querySelector('[data-gm-engine]')) return;
var ORDER = ['canonical', 'extract', 'reference', 'fragment'];
var FALLBACK_LABEL = {
canonical: 'Engine · the maths this runs on',
extract: 'Extracts',
reference: 'References',
fragment: 'Copies elsewhere in the estate'
};
var kindLabels = (graph && graph.kind_labels) || {};
var byKind = {};
nodes.forEach(function (node) {
if (!node || !node.label) return;
var kind = node.type || 'other';
if (!byKind[kind]) byKind[kind] = [];
byKind[kind].push(node);
});
var kinds = ORDER.filter(function (k) { return byKind[k]; })
.concat(Object.keys(byKind).filter(function (k) { return ORDER.indexOf(k) < 0; }).sort());
var RUN_COMMAND =
'git clone https://github.com/Ventusltd/ventus-grid-engine'
+ ' && cd ventus-grid-engine && node verify.mjs';
appendGroup(panel, 'Run the engine yourself · offline, no dependencies');
var run = document.createElement('button');
run.setAttribute('data-gm-engine', '1');
run.setAttribute('type', 'button');
run.title = RUN_COMMAND;
run.textContent = '⧉ Copy: clone the engine and run its 133 checks';
run.addEventListener('click', function () {
var done = function (ok) {
run.textContent = ok
? '✓ Copied — paste it into a terminal'
: '⧉ ' + RUN_COMMAND;
};
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(RUN_COMMAND).then(function () { done(true); },
function () { done(false); });
} else {
done(false);
}
} catch (_) { done(false); }
});
panel.appendChild(run);
var total = 0;
kinds.forEach(function (kind) {
var group = byKind[kind];
group.sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'en-GB'); });
appendGroup(panel, (FALLBACK_LABEL[kind] || kindLabels[kind] || kind) + ' · ' + group.length);
group.forEach(function (node) {
var a = document.createElement('a');
a.setAttribute('data-gm-engine', '1');
a.setAttribute('role', 'button');
a.href = ENGINE_VIEW_URL + encodeURIComponent(node.label);
a.target = '_blank';
a.rel = 'noopener';
a.textContent = node.label;
if (node.reason) a.title = node.reason;
panel.appendChild(a);
total += 1;
});
});
state.engine_modules = total;
}).catch(function () {
state.engine_modules = 0;
});
}
var STUDY_LINKS = [
{ href: 'https://globalgrid2050.com/data/grid_studies_public/'
+ 'great_britain_electricity_price_grid_constraint_trends_2016_2026.html',
text: 'GB electricity price & grid constraint trends · 2016–2026' }
];
function appendStudies(panel) {
if (!panel || panel.querySelector('[data-gm-study]')) return 0;
appendGroup(panel, 'Studies');
var added = 0;
STUDY_LINKS.forEach(function (item) {
var a = document.createElement('a');
a.setAttribute('data-gm-study', '1');
a.setAttribute('role', 'button');
a.href = item.href;
a.target = '_blank';
a.rel = 'noopener';
a.textContent = item.text;
panel.appendChild(a);
added += 1;
});
return added;
}
function exportStamp() {
var now = new Date();
return now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
function attributionText(doc) {
var node = doc.querySelector('.custom-map-attrib');
return cleanText(node && node.textContent)
|| 'Data © OpenStreetMap contributors | © CARTO | EV data © Open Charge Map';
}
function generationText() {
var atlas = window.__GRIDATLAS_ATLAS__;
var generation = (atlas && atlas.generation)
|| (document.documentElement && document.documentElement.dataset
&& document.documentElement.dataset.gridatlasGeneration);
return generation ? 'generation ' + generation : '';
}
function dropById(doc, id) {
var existing = doc.getElementById(id);
if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}
function buildPrintFurniture(doc) {
dropById(doc, 'gridatlas-print-furniture');
var box = doc.createElement('div');
box.id = 'gridatlas-print-furniture';
var selected = doc.querySelector('.project-popup .name, .gm-panel .project-name');
var title = cleanText(selected && selected.textContent) || 'GlobalGrid2050 · Grid Atlas';
box.innerHTML =
'<div class="gpf-head"><span class="gpf-brand">VENTUS</span>'
+ '<span class="gpf-sub">GLOBAL GRID 2050 · GRID ATLAS</span></div>'
+ '<div class="gpf-title"></div>'
+ '<div class="gpf-foot"><span class="gpf-attrib"></span>'
+ '<span class="gpf-stamp"></span></div>';
box.querySelector('.gpf-title').textContent = title;
box.querySelector('.gpf-attrib').textContent = attributionText(doc);
box.querySelector('.gpf-stamp').textContent =
[generationText(), exportStamp()].filter(Boolean).join(' · ');
doc.body.appendChild(box);
return box;
}
function installPrintStyle(doc) {
if (doc.getElementById('gridatlas-print-css')) return;
var style = doc.createElement('style');
style.id = 'gridatlas-print-css';
style.textContent = [
'#gridatlas-print-furniture{display:none}',
'#gridatlas-print-map{display:none}',
'@media print{',
'  @page{size:auto;margin:0}',
'  html{background:#fff!important;height:auto!important;',
'    overflow:visible!important}',
'  body{background:#0b1416!important;margin:0!important;padding:0!important;',
'    width:var(--gpf-vw,100%)!important;height:auto!important;',
'    min-height:0!important;overflow:visible!important;display:block!important}',
'  body>.dashboard{width:var(--gpf-vw,100%)!important;',
'    height:var(--gpf-vh,100vh)!important;max-height:none!important;',
'    min-height:0!important;overflow:hidden!important}',
'  #gridatlas-print-map{display:block!important;position:absolute!important;',
'    left:0!important;top:0!important;width:100%!important;height:100%!important;',
'    max-width:none!important;max-height:none!important;object-fit:fill;',
'    z-index:1;pointer-events:none}',
'  body.gridatlas-print-raster .maplibregl-canvas{visibility:hidden!important}',
'  #gridatlas-print-furniture{display:block!important;position:static!important;',
'    width:var(--gpf-vw,100%)!important;box-sizing:border-box!important;',
'    inset:auto!important;padding:5mm 7mm 6mm!important;background:#040a0c!important;',
'    color:#eaf4f6!important;z-index:auto!important;',
'    font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace!important}',
'  #gridatlas-print-furniture::before,#gridatlas-print-furniture::after{',
'    content:none!important}',
'  #gridatlas-print-furniture .gpf-head{letter-spacing:.28em;font-size:11px}',
'  #gridatlas-print-furniture .gpf-brand{font-weight:700;margin-right:10px}',
'  #gridatlas-print-furniture .gpf-sub{opacity:.65;letter-spacing:.16em}',
'  #gridatlas-print-furniture .gpf-title{margin-top:2mm;font-size:15px;',
'    letter-spacing:.02em}',
'  #gridatlas-print-furniture .gpf-foot{position:static;margin-top:2mm;',
'    display:flex;justify-content:space-between;gap:6mm;',
'    font-size:8.5px;opacity:.75}',
'  .map-container{position:relative!important;width:100%!important;',
'    height:100%!important;max-height:100%!important;min-height:0!important}',
'  #map,.maplibregl-map,.maplibregl-canvas-container{',
'    height:100%!important;width:100%!important;max-height:100%!important}',
'  .maplibregl-canvas{width:100%!important;height:100%!important}',
'  body>*{break-inside:avoid;page-break-inside:avoid}',
'  body{page-break-after:avoid}',
'}'
].join('');
doc.head.appendChild(style);
}
function buildPrintMap(doc, dataUrl) {
dropById(doc, 'gridatlas-print-map');
var image = doc.createElement('img');
image.id = 'gridatlas-print-map';
image.alt = '';
image.src = dataUrl;
var canvas = doc.querySelector('.maplibregl-canvas');
var host = canvas && canvas.parentNode;
if (host && host.appendChild) host.appendChild(image);
else doc.body.appendChild(image);
return image;
}
function pinViewportSize(doc) {
var root = doc.documentElement;
if (!root || !root.style || !root.style.setProperty) return;
var width = Number(window.innerWidth) || (root.clientWidth || 0);
var height = Number(window.innerHeight) || (root.clientHeight || 0);
if (width > 0) root.style.setProperty('--gpf-vw', width + 'px');
if (height > 0) root.style.setProperty('--gpf-vh', height + 'px');
}
function unpinViewportSize(doc) {
var root = doc.documentElement;
if (!root || !root.style || !root.style.removeProperty) return;
root.style.removeProperty('--gpf-vw');
root.style.removeProperty('--gpf-vh');
}
function printView(doc) {
installPrintStyle(doc);
pinViewportSize(doc);
var furniture = buildPrintFurniture(doc);
var shot = null;
var clean = function () {
if (furniture && furniture.parentNode) furniture.parentNode.removeChild(furniture);
if (shot && shot.parentNode) shot.parentNode.removeChild(shot);
if (doc.body && doc.body.classList) {
doc.body.classList.remove('gridatlas-print-raster');
}
unpinViewportSize(doc);
window.removeEventListener('afterprint', clean);
};
window.addEventListener('afterprint', clean);
var go = function () {
window.setTimeout(function () { window.print(); }, 60);
window.setTimeout(clean, 20000);
};
captureMap(doc, function (dataUrl) {
if (dataUrl) {
shot = buildPrintMap(doc, dataUrl);
if (doc.body && doc.body.classList) {
doc.body.classList.add('gridatlas-print-raster');
}
if (shot.decode) { shot.decode().then(go, go); return; }
shot.onload = go;
shot.onerror = go;
return;
}
go();
});
}
function looksBlank(canvas) {
try {
var probe = document.createElement('canvas');
probe.width = 40; probe.height = 40;
var context = probe.getContext('2d');
context.drawImage(canvas, 0, 0, 40, 40);
var data = context.getImageData(0, 0, 40, 40).data;
for (var i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
return true;
} catch (_) {
return false;
}
}
function mapHandle() {
var map = window.__GRIDATLAS_V9_MAP__;
if (map && map.getCanvas) return map;
return (window.map && window.map.getCanvas) ? window.map : null;
}
function captureMap(doc, then) {
var map = mapHandle();
var canvas = doc.querySelector('.maplibregl-canvas')
|| (map && map.getCanvas ? map.getCanvas() : null);
if (!canvas) { then(null, null); return; }
var grab = function () {
var url = null;
try { url = canvas.toDataURL('image/png'); } catch (_) { url = null; }
if (!url || looksBlank(canvas)) { then(null, canvas); return; }
then(url, canvas);
};
if (map && map.once && map.triggerRepaint) {
map.once('render', grab);
map.triggerRepaint();
} else {
grab();
}
}
function saveImage(doc, button) {
var map = mapHandle();
var canvas = doc.querySelector('.maplibregl-canvas')
|| (map && map.getCanvas ? map.getCanvas() : null);
var say = function (text) { button.textContent = text; };
if (!canvas) { say('⊘ No map canvas to save — use Print'); return; }
var grab = function () {
var url;
try { url = canvas.toDataURL('image/png'); } catch (_) { url = null; }
if (!url || looksBlank(canvas)) {
say('⊘ The map could not be captured — use Print instead');
return;
}
var link = doc.createElement('a');
link.href = url;
link.download = 'gridatlas-' + exportStamp().replace(/[^0-9]/g, '').slice(0, 12) + '.png';
doc.body.appendChild(link);
link.click();
doc.body.removeChild(link);
say('✓ Image saved');
window.setTimeout(function () { say('⤓ Save an image of this view'); }, 4000);
};
if (map && map.once && map.triggerRepaint) {
map.once('render', grab);
map.triggerRepaint();
} else {
grab();
}
}
function pdfEscape(text) {
return String(text == null ? '' : text)
.replace(/\\/g, '\\\\')
.replace(/\(/g, '\\(')
.replace(/\)/g, '\\)')
.replace(/[^\x20-\x7e]/g, '');
}
function buildMapPdf(jpegBinary, pixelWidth, pixelHeight, heading, leftFoot, rightFoot) {
var pageW = pixelWidth;
var pageH = pixelHeight;
var unit = Math.max(1, Math.min(pageW, pageH) / 520);
var band = Math.round(Math.min(pageH * 0.14, 46 * unit));
var headSize = Math.round(13 * unit);
var footSize = Math.round(8 * unit);
var pad = Math.round(14 * unit);
var rightX = Math.max(pad, pageW - pad - String(rightFoot).length * footSize * 0.56);
var content = [
'q', pageW + ' 0 0 ' + pageH + ' 0 0 cm', '/Im0 Do', 'Q',
'q', '/GsA gs', '0.02 0.06 0.07 rg',
'0 ' + (pageH - band) + ' ' + pageW + ' ' + band + ' re f',
'0 0 ' + pageW + ' ' + band + ' re f', 'Q',
'BT /F1 ' + headSize + ' Tf 1 1 1 rg ' + pad + ' ' + (pageH - pad - headSize)
+ ' Td (' + pdfEscape(heading) + ') Tj ET',
'BT /F1 ' + footSize + ' Tf 0.86 0.93 0.94 rg ' + pad + ' ' + Math.round(pad * 0.7)
+ ' Td (' + pdfEscape(leftFoot) + ') Tj ET',
'BT /F1 ' + footSize + ' Tf 0.86 0.93 0.94 rg ' + rightX + ' ' + Math.round(pad * 0.7)
+ ' Td (' + pdfEscape(rightFoot) + ') Tj ET'
].join('\n');
var objects = [
'<< /Type /Catalog /Pages 2 0 R >>',
'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + ']'
+ ' /Resources << /XObject << /Im0 5 0 R >> /Font << /F1 6 0 R >>'
+ ' /ExtGState << /GsA 7 0 R >> >> /Contents 4 0 R >>',
'<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
'<< /Type /XObject /Subtype /Image /Width ' + pixelWidth + ' /Height ' + pixelHeight
+ ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '
+ jpegBinary.length + ' >>\nstream\n' + jpegBinary + '\nendstream',
'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
'<< /Type /ExtGState /ca 0.55 >>'
];
var out = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
var offsets = [];
var i;
for (i = 0; i < objects.length; i += 1) {
offsets.push(out.length);
out += (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n';
}
var xref = out.length;
out += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
for (i = 0; i < offsets.length; i += 1) {
out += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
}
out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n'
+ 'startxref\n' + xref + '\n%%EOF\n';
var bytes = new Uint8Array(out.length);
for (i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
return { bytes: bytes, pageW: pageW, pageH: pageH };
}
function captureMapJpeg(doc, then) {
var map = mapHandle();
var canvas = doc.querySelector('.maplibregl-canvas')
|| (map && map.getCanvas ? map.getCanvas() : null);
if (!canvas) { then(null, null); return; }
var grab = function () {
var url = null;
try { url = canvas.toDataURL('image/jpeg', 0.92); } catch (_) { url = null; }
if (!url || url.indexOf('data:image/jpeg') !== 0 || looksBlank(canvas)) {
then(null, canvas);
return;
}
then(url, canvas);
};
if (map && map.once && map.triggerRepaint) {
map.once('render', grab);
map.triggerRepaint();
} else {
grab();
}
}
function pdfFileStamp() {
var d = new Date();
var pad = function (n) { return (n < 10 ? '0' : '') + n; };
return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
+ pad(d.getUTCHours()) + pad(d.getUTCMinutes());
}
function savePdf(doc, button) {
var say = function (text) { button.textContent = text; };
say('... building PDF');
captureMapJpeg(doc, function (jpegDataUrl, canvas) {
if (!jpegDataUrl) {
say('\u2298 The map could not be captured \u2014 try again once it has drawn');
return;
}
var binary;
try {
binary = atob(jpegDataUrl.slice(jpegDataUrl.indexOf(',') + 1));
} catch (_) {
say('\u2298 The capture could not be decoded');
return;
}
var built = buildMapPdf(binary, canvas.width, canvas.height,
'GlobalGrid2050 \u00b7 Grid Atlas', attributionText(doc), (generationText() || 'generation unknown')
+ ' · ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
var blob = new Blob([built.bytes], { type: 'application/pdf' });
var url = URL.createObjectURL(blob);
var link = doc.createElement('a');
link.id = 'gridatlas-pdf-download';
link.href = url;
link.download = 'globalgrid2050-grid-atlas-' + pdfFileStamp() + '.pdf';
doc.body.appendChild(link);
link.click();
setTimeout(function () {
URL.revokeObjectURL(url);
if (link.parentNode) link.parentNode.removeChild(link);
}, 30000);
say('\u2713 PDF saved \u00b7 ' + built.pageW + '\u00d7' + built.pageH + ' px, 1:1');
});
}
function appendExport(panel, doc) {
if (!panel || panel.querySelector('[data-gm-export]')) return 0;
appendGroup(panel, 'Export this view');
var print = doc.createElement('button');
print.id = 'gridatlas-export-print';
print.setAttribute('data-gm-export', 'print');
print.setAttribute('type', 'button');
print.textContent = '⎙ Print · or save as PDF';
print.addEventListener('click', function () { printView(doc); });
panel.appendChild(print);
var pdf = doc.createElement('button');
pdf.id = 'gridatlas-export-pdf';
pdf.setAttribute('data-gm-export', 'pdf');
pdf.setAttribute('type', 'button');
pdf.textContent = '\u2913 Save this view as a PDF';
pdf.addEventListener('click', function () { savePdf(doc, pdf); });
panel.appendChild(pdf);
var image = doc.createElement('button');
image.id = 'gridatlas-export-image';
image.setAttribute('data-gm-export', 'image');
image.setAttribute('type', 'button');
image.textContent = '⤓ Save an image of this view';
image.addEventListener('click', function () { saveImage(doc, image); });
panel.appendChild(image);
return 3;
}
function appendEstateLinks(panel) {
if (!panel || panel.querySelector('[data-gm-estate]')) return 0;
appendGroup(panel, 'Estate');
var added = 0;
ESTATE_LINKS.forEach(function (item) {
var a = document.createElement('a');
a.setAttribute('data-gm-estate', '1');
a.setAttribute('role', 'button');
a.href = item.href;
a.target = '_blank';
a.rel = 'noopener';
a.textContent = item.text;
panel.appendChild(a);
added += 1;
});
return added;
}
function layerCheckbox(kind) {
var proxy = document.createElement('input');
proxy.type = kind;
var box = document.createElement('span');
box.className = 'gm-layer-box';
box.setAttribute('aria-hidden', 'true');
return { proxy: proxy, box: box };
}
function buildLayerControls(found) {
var lastGroup = '';
found.controls.forEach(function (original) {
var key = layerKey(original);
var group = layerGroup(original);
if (group !== lastGroup) {
appendGroup(gridBody, group);
lastGroup = group;
}
var label = document.createElement('label');
label.className = 'gm-layer';
label.setAttribute('data-gridatlas-layer-key', key);
var built = layerCheckbox('checkbox');
var proxy = built.proxy;
proxy.setAttribute('data-gridatlas-layer-proxy', key);
var name = document.createElement('span');
name.className = 'gm-layer-name';
label.appendChild(proxy);
label.appendChild(built.box);
label.appendChild(name);
gridBody.appendChild(label);
layerTargets[key] = original;
layerProxies[key] = proxy;
proxy.addEventListener('change', function () {
if (!!original.checked !== !!proxy.checked && typeof original.click === 'function') {
forwardingLayerChoice = true;
try { original.click(); }
finally { forwardingLayerChoice = false; }
}
syncLayer(key);
});
syncLayer(key);
});
var basemaps = array(found.host.querySelectorAll('input[type="radio"][name="bm"]'));
if (basemaps.length) appendGroup(gridBody, 'Basemap');
basemaps.forEach(function (original) {
var label = document.createElement('label');
label.className = 'gm-layer';
var built = layerCheckbox('radio');
var proxy = built.proxy;
proxy.name = 'gridatlas-menu-basemap';
proxy.value = original.value;
proxy.checked = !!original.checked;
var name = document.createElement('span');
name.className = 'gm-layer-name';
name.textContent = cleanText(original.closest('label').textContent) || original.value;
proxy.addEventListener('change', function () {
if (proxy.checked && !original.checked && typeof original.click === 'function') original.click();
closeAll();
});
label.appendChild(proxy);
label.appendChild(built.box);
label.appendChild(name);
gridBody.appendChild(label);
});
}
function move(panel, node, label) {
if (!node || !panel || (bar && bar.contains(node))) return false;
if (label && node.setAttribute) node.setAttribute('aria-label', label);
panel.appendChild(node);
if (node.removeAttribute) node.removeAttribute('hidden');
state.controls_moved += 1;
return true;
}
function trayRoute(node) {
var text = cleanText(node && node.textContent).toLowerCase();
if (/\bclear\b|\bscope\b/.test(text)) return 'Scope';
if (/\bgrid\b|\bsubs\b/.test(text)) return 'Grid';
return '';
}
function chipStaysOnMap(node) {
var text = cleanText(node && node.textContent).toLowerCase();
if (!/\bgrid\b|\bsubs\b/.test(text)) return false;
var coarse = false;
try {
coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
} catch (error) {
coarse = false;
}
var width = Number(window.innerWidth);
var narrow = isFinite(width) && width > 0 && width <= 700;
return true;
}
function adoptLate(doc) {
if (!bar) return;
move(panels.View, doc.getElementById('gridatlas-gb-conditions'));
move(panels.About, doc.getElementById('gridatlas-version-ledger'));
move(panels.View, doc.getElementById('btn-fullscreen-exit'), 'Exit full screen');
var curtain = doc.getElementById('fs-curtain-tab');
if (curtain && !bar.contains(curtain)) {
curtain.setAttribute('role', 'button');
curtain.setAttribute('tabindex', '0');
curtain.setAttribute('aria-label', 'Open the fullscreen layer curtain');
move(panels.Grid, curtain);
}
var tray = doc.getElementById('gridatlas-mobile-tray');
if (tray) {
array(tray.querySelectorAll('button')).forEach(function (button) {
if (chipStaysOnMap(button)) return;
var route = trayRoute(button);
if (route) move(panels[route], button);
else button.hidden = true;
});
}
move(panels.Scope, doc.getElementById('btn-gridpoint'));
var disclaimer = doc.querySelector('.disclaimer-box');
var shoutout = doc.querySelector('.podcast-shoutout');
move(panels.About, disclaimer);
move(panels.About, shoutout);
state.estate_links = appendEstateLinks(panels.About);
appendEngineModules(panels.File);
state.export_controls = appendExport(panels.File, doc);
state.studies = appendStudies(panels.View);
var attrib = doc.querySelector('.custom-map-attrib');
if (attrib) {
if (!bar || !bar.contains(attrib)) move(panels.About, attrib);
else if (panels.About.lastElementChild !== attrib) panels.About.appendChild(attrib);
}
var dashToggle = doc.getElementById('gridatlas-dash-toggle');
if (dashToggle) dashToggle.hidden = false;
var stack = doc.querySelector('.map-controls');
if (stack) {
var leftovers = array(stack.querySelectorAll('button,input,select,textarea,a'))
.filter(function (node) { return !node.hidden; });
if (leftovers.length === 0) stack.setAttribute('data-gridatlas-menu-emptied', '1');
}
MENUS.forEach(function (name) {
state.panel_counts[name] = panels[name] ? panels[name].children.length : 0;
});
}
function install(doc) {
if (state.installed || doc.getElementById(BAR_ID)) return true;
var ready = required(doc);
state.engine_layer_controls = ready.found.engine.length;
state.pipeline_layer_controls = ready.found.pipeline.length;
state.layer_controls = ready.found.controls.length;
if (ready.missing.length) {
state.waiting_for = ready.missing.slice();
return false;
}
installStyle(doc);
bar = buildBar(doc);
buildLayerControls(ready.found);
move(panels.File, ready.nodes.search);
move(panels.File, ready.nodes.exportButton);
move(panels.Edit, ready.nodes.statusButton);
move(panels.View, ready.nodes.fullscreenButton);
move(panels.Scope, ready.nodes.radiusButton);
move(panels.Scope, ready.nodes.radiusAreaButton);
move(panels.Scope, ready.nodes.zoneButton);
move(panels.Scope, ready.nodes.measureButton);
move(brandSlot, ready.nodes.header);
move(gridHead, doc.querySelector('.scada-brand'));
move(gridHead, doc.querySelector('.status-legend'));
ready.nodes.host.insertBefore(bar, ready.nodes.host.firstChild);
doc.documentElement.classList.add('gridatlas-menu-hosted');
syncAttribClearance(doc);
if (typeof ResizeObserver === 'function') {
var barResize = new ResizeObserver(function () {
syncAttribClearance(doc);
if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
});
barResize.observe(bar);
state.attrib_clearance_source = 'ResizeObserver';
} else if (doc.defaultView && typeof doc.defaultView.addEventListener === 'function') {
doc.defaultView.addEventListener('resize', function () {
syncAttribClearance(doc);
if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
});
state.attrib_clearance_source = 'resize-listener';
}
doc.addEventListener('click', function (event) {
if (!bar.contains(event.target)) {
if (!forwardingLayerChoice) closeAll();
}
else if (event.target && /^(BUTTON|INPUT)$/.test(event.target.tagName || '')) {
if (event.target.type !== 'text'
&& !event.target.classList.contains('gm-title')
&& !event.target.hasAttribute('data-gridatlas-layer-proxy')) {
window.setTimeout ? window.setTimeout(closeAll, 0) : closeAll();
}
}
});
doc.addEventListener('change', function (event) {
var key = layerKey(event.target);
if (key && layerProxies[key]) syncLayer(key);
});
state.listeners = 2;
adoptLate(doc);
closeAll();
state.installed = true;
state.waiting_for = [];
state.failure = null;
state.one_identity_surface = true;
state.mobile_sheet_hit_target_guard = true;
state.layer_status_mirrored = true;
state.layer_menu_stays_open = true;
if (typeof MutationObserver === 'function') {
observer = new MutationObserver(function () {
adoptLate(doc);
syncAll();
});
observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
}
return true;
}
state.install = function () { return install(document); };
state.closeAll = closeAll;
function loudFailure(doc) {
if (state.installed || doc.getElementById(FAILURE_ID)) return;
var found = inventory(doc);
state.failure = 'menu not installed: expected 60 engine + 3 Pipeline News layer controls; found '
+ found.engine.length + ' + ' + found.pipeline.length;
if (window.console && typeof window.console.error === 'function') {
window.console.error('[GRIDATLAS MENU] ' + state.failure);
}
var alert = doc.createElement('div');
alert.id = FAILURE_ID;
alert.setAttribute('role', 'alert');
alert.textContent = state.failure + '. Original controls remain available.';
alert.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:10030;'
+ 'padding:8px;background:#280b0b;color:#ffd0d0;border:1px solid #b44;'
+ 'font:11px/1.4 monospace';
(doc.body || doc.documentElement).appendChild(alert);
}
function start() {
if (!document.documentElement || typeof document.createElement !== 'function') {
state.failure = 'menu not installed: full document unavailable';
return;
}
var probe = document.createElement('div');
if (!probe || typeof probe.setAttribute !== 'function' || !probe.classList) {
state.failure = 'menu not installed: full DOM element API unavailable';
return;
}
if (install(document)) return;
if (typeof window.setInterval !== 'function'
|| typeof window.clearInterval !== 'function') return;
timer = window.setInterval(function () {
state.tries += 1;
if (install(document)) {
window.clearInterval(timer);
timer = null;
} else if (state.tries >= MAX_TRIES) {
window.clearInterval(timer);
timer = null;
loudFailure(document);
}
}, 250);
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
start();
}
}());
