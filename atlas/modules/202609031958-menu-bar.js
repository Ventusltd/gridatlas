/* GridAtlas menu bar.

   v9.94 proved that the conventional menu is the right shape and the wrong
   implementation can still strand the product. That version enumerated only
   direct children of .map-controls and then hid the whole owner container.
   Scope, Clear and their result surfaces were nested, so they disappeared.

   This successor has a stricter admission rule:

   - it installs nothing until the engine's 60 layer controls and the three
     Pipeline News controls are all present and uniquely identified;
   - the Grid menu proxies those 63 ORIGINAL inputs, so their delegated engine
     handlers remain the only implementation of behaviour;
   - action buttons are moved as the same DOM nodes, preserving listeners and
     state, while result panels stay with the map that owns them;
   - legacy containers collapse only after the complete inventory is built.
     A missing control leaves the old interface reachable and is published as
     a failure instead of being silently skipped.

   The six names are the architect's current vocabulary. In particular Grid
   is not exposed through the abandoned "Select layers" alias. */
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
  var MAX_TRIES = 160;             // 40 s: the register UI is built after map load

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
  var observer = null;
  var timer = null;

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
    var text = cleanText(base || (span && span.textContent)
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
      '-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}',
      '#' + BAR_ID + ' .gm-menu{position:relative;min-width:0}',
      '#' + BAR_ID + ' .gm-title{appearance:none;border:0;background:transparent;color:#cfeef6;',
      'min-height:36px;padding:0 11px;cursor:pointer;font:inherit;letter-spacing:.05em;',
      'text-transform:uppercase;white-space:nowrap}',
      '#' + BAR_ID + ' .gm-title:hover,#' + BAR_ID + ' .gm-title:focus-visible,',
      '#' + BAR_ID + ' .gm-menu.gm-open>.gm-title{background:rgba(80,220,240,.16);color:#fff}',
      '#' + BAR_ID + ' .gm-title:focus-visible,#' + BAR_ID + ' .gm-panel :focus-visible{',
      'outline:2px solid #6bebff;outline-offset:-2px}',
      '#' + BAR_ID + ' .gm-panel{position:absolute;top:100%;left:0;min-width:240px;',
      'max-width:min(92vw,420px);max-height:min(72dvh,620px);overflow:auto;',
      'overscroll-behavior:contain;padding:6px;background:rgba(4,10,13,.98);',
      'border:1px solid rgba(80,220,240,.32);border-top:0;',
      'box-shadow:0 12px 34px rgba(0,0,0,.68);box-sizing:border-box}',
      '#' + BAR_ID + ' .gm-panel[hidden]{display:none!important}',
      '#' + BAR_ID + ' .gm-menu:nth-last-child(-n+2)>.gm-panel{left:auto;right:0}',
      '#' + BAR_ID + ' .gm-panel button,#' + BAR_ID + ' .gm-panel [role="button"]{',
      'display:flex;align-items:center;width:100%;min-height:44px;box-sizing:border-box;',
      'position:static!important;inset:auto!important;transform:none!important;margin:0 0 3px;',
      'padding:7px 10px;border:0;border-radius:2px;background:transparent;color:#cfeef6;',
      'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:left;',
      'letter-spacing:.03em;text-transform:none;cursor:pointer}',
      '#' + BAR_ID + ' .gm-panel button:hover,#' + BAR_ID + ' .gm-panel [role="button"]:hover{',
      'background:rgba(80,220,240,.14);color:#fff}',
      '#' + BAR_ID + ' .gm-layer-group{margin:5px 0 2px;padding:6px 8px 3px;',
      'border-top:1px solid #19343b;color:#6fa2ae;font-size:10px;letter-spacing:.08em;',
      'text-transform:uppercase}',
      '#' + BAR_ID + ' .gm-layer{display:flex;align-items:flex-start;gap:8px;min-height:44px;',
      'box-sizing:border-box;padding:7px 9px;color:#cfeef6;cursor:pointer;line-height:1.35}',
      '#' + BAR_ID + ' .gm-layer:hover{background:rgba(80,220,240,.12)}',
      '#' + BAR_ID + ' .gm-layer input{width:18px;height:18px;flex:0 0 auto;margin:1px 0 0;',
      'accent-color:#4fd7ee}',
      '#' + BAR_ID + ' .gm-layer-name{overflow-wrap:anywhere}',
      '#' + BAR_ID + ' .search-bar-wrapper{position:static!important;display:grid!important;',
      'grid-template-columns:minmax(150px,1fr) auto;width:min(82vw,390px);gap:5px;margin:2px 0 6px}',
      '#' + BAR_ID + ' .search-bar-wrapper>div{position:relative}',
      '#' + BAR_ID + ' .search-input{width:100%!important;min-height:44px;box-sizing:border-box}',
      '#' + BAR_ID + ' .search-results{position:static!important;max-height:42vh;overflow:auto}',
      '#' + BAR_ID + ' .hud-header{display:flex!important;position:static!important;',
      'width:min(82vw,390px);box-sizing:border-box;margin:0 0 5px}',
      '#' + BAR_ID + ' .status-legend{display:flex;flex-wrap:wrap;gap:7px;padding:8px}',
      '#' + BAR_ID + ' .disclaimer-box,#' + BAR_ID + ' .podcast-shoutout{',
      'display:block!important;position:static!important;max-width:380px;padding:8px;',
      'box-sizing:border-box;text-align:left;pointer-events:auto}',
      '.gridatlas-menu-hosted .map-controls[data-gridatlas-menu-emptied="1"]{display:none!important}',
      '.gridatlas-menu-hosted .scada-brand[data-gridatlas-menu-duplicate="1"]{display:none!important}',
      'body:not(.fs-active) #' + BAR_ID + ' #btn-fullscreen-exit{display:none!important}',
      'body.fs-active #' + BAR_ID + ' #btn-fullscreen-exit{display:flex!important}',
      '@media(max-width:700px){#' + BAR_ID + '{height:34px}',
      '#' + BAR_ID + ' .gm-title{min-height:34px;padding:0 6px;font-size:9px;letter-spacing:.025em}',
      '#' + BAR_ID + ' .gm-panel{position:fixed;top:34px;left:4px!important;right:4px!important;',
      'width:auto;max-width:none;max-height:calc(100dvh - 40px);padding-bottom:',
      'calc(6px + env(safe-area-inset-bottom))}}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
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

  function openMenu(menu, title, panel) {
    var wasOpen = menu.classList.contains('gm-open');
    closeAll();
    if (wasOpen) return;
    if (title.textContent === 'Grid') syncAll();
    menu.classList.add('gm-open');
    title.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    state.closed_at_rest = false;
  }

  function buildBar(doc) {
    var nav = doc.createElement('nav');
    nav.id = BAR_ID;
    nav.setAttribute('aria-label', 'Atlas menu');

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
      title.addEventListener('click', function (event) {
        event.stopPropagation();
        openMenu(menu, title, panel);
      });
      menu.appendChild(title);
      menu.appendChild(panel);
      nav.appendChild(menu);
      panels[name] = panel;
      titles.push(title);
    });

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

  function buildLayerControls(found) {
    var lastGroup = '';
    found.controls.forEach(function (original) {
      var key = layerKey(original);
      var group = layerGroup(original);
      if (group !== lastGroup) {
        appendGroup(panels.Grid, group);
        lastGroup = group;
      }
      var label = document.createElement('label');
      label.className = 'gm-layer';
      label.setAttribute('data-gridatlas-layer-key', key);
      var proxy = document.createElement('input');
      proxy.type = 'checkbox';
      proxy.setAttribute('data-gridatlas-layer-proxy', key);
      var name = document.createElement('span');
      name.className = 'gm-layer-name';
      label.appendChild(proxy);
      label.appendChild(name);
      panels.Grid.appendChild(label);
      layerTargets[key] = original;
      layerProxies[key] = proxy;
      proxy.addEventListener('change', function () {
        if (!!original.checked !== !!proxy.checked && typeof original.click === 'function') {
          original.click();
        }
        syncLayer(key);
        closeAll();
      });
      syncLayer(key);
    });

    var basemaps = array(found.host.querySelectorAll('input[type="radio"][name="bm"]'));
    if (basemaps.length) appendGroup(panels.Grid, 'Basemap');
    basemaps.forEach(function (original) {
      var label = document.createElement('label');
      label.className = 'gm-layer';
      var proxy = document.createElement('input');
      proxy.type = 'radio';
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
      label.appendChild(name);
      panels.Grid.appendChild(label);
    });
  }

  function move(panel, node, label) {
    if (!node || !panel || (bar && bar.contains(node))) return false;
    if (label && node.setAttribute) node.setAttribute('aria-label', label);
    panel.appendChild(node);             // same node: its original listener survives
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

  function collapseDashboard(doc) {
    var wrapper = doc.querySelector('.scada-wrapper');
    var toggle = doc.getElementById('gridatlas-dash-toggle');
    if (!wrapper) return;
    if (!wrapper.hasAttribute('data-gridatlas-collapsed')) {
      if (toggle && typeof toggle.click === 'function') toggle.click();
      else wrapper.setAttribute('data-gridatlas-collapsed', '1');
    }
  }

  function adoptLate(doc) {
    if (!bar) return;
    move(panels.View, doc.getElementById('gridatlas-dash-toggle'));
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
        var route = trayRoute(button);
        if (route) move(panels[route], button);
        else button.hidden = true;       // Tools only revealed the controls now in menus
      });
    }

    move(panels.Scope, doc.getElementById('btn-gridpoint'));

    var statusLegend = doc.querySelector('.status-legend');
    var disclaimer = doc.querySelector('.disclaimer-box');
    var shoutout = doc.querySelector('.podcast-shoutout');
    move(panels.About, statusLegend);
    move(panels.About, disclaimer);
    move(panels.About, shoutout);

    var duplicateBrand = doc.querySelector('.scada-brand');
    if (duplicateBrand) duplicateBrand.setAttribute('data-gridatlas-menu-duplicate', '1');

    collapseDashboard(doc);

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
    move(panels.About, ready.nodes.header);

    ready.nodes.host.insertBefore(bar, ready.nodes.host.firstChild);
    doc.documentElement.classList.add('gridatlas-menu-hosted');

    /* One document click listener and one change listener, installed once.
       The retry path cannot multiply effects. */
    doc.addEventListener('click', function (event) {
      if (!bar.contains(event.target)) closeAll();
      else if (event.target && /^(BUTTON|INPUT)$/.test(event.target.tagName || '')) {
        if (event.target.type !== 'text' && !event.target.classList.contains('gm-title')) {
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
    /* Cartridge proofs and prerenderers can provide a deliberately partial
       document. Treat that exactly like any other missing dependency: publish
       the refusal and leave the owner's interface untouched. In particular,
       do not start the 40-second browser retry loop against a non-DOM stub. */
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
