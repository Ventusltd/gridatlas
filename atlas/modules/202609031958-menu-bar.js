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
  var forwardingLayerChoice = false;
  var observer = null;
  var timer = null;
  var brandSlot = null;    // holds the v8 .hud-header (VENTUS wordmark), fused into the bar itself
  var gridHead = null;     // holds the v8 .scada-brand + .status-legend, restored at the top of Grid
  var gridBody = null;     // holds the layer groups, so gridHead never enters the 2-column flow

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
    /* The V8 panel exposes WAIT/LOAD/OK/FAIL beside every layer.  The first
       menu implementation preferred data-base-label, which deliberately
       strips that live suffix.  That made a successful load and a failed
       load indistinguishable in the only layer surface left on a phone. */
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
      /* All six titles now run in ONE contiguous group in .gm-side-left (see
         buildBar) -- the architect, 2026-09-04, twice: "have all the menus
         together, not split with the Ventus logo, but keep the logo". The
         right-hand group is kept only as an empty element so nothing that
         looks for it throws; it must take no space, or the single left group
         would be squeezed to half the bar by the shared flex:1 1 0 above.
         Same fix as the shared estate-menu module
         (spiders/species/seer-spider/estate-menu/estate-menu.js, buildBar). */
      '#' + BAR_ID + ' .gm-side-right{flex:0 0 0;width:0;overflow:hidden}',
      /* The VENTUS masthead, fused into the centre of this same 36px strip
         (see buildBar) rather than a second row, so it costs no map height
         on a phone and can never be torn out into a closed panel again. */
      /* "The VENTUS logo is the best part" -- the architect's own words.
         It is the hero of this strip: sized and weighted to outrank the
         six menu titles either side of it, not a corner credit shrunk to
         fit. Same face, tracking and two-line lockup as the v8 masthead
         and the fullscreen letterhead it is carried from verbatim. */
      /* Centred INDEPENDENTLY of the titles, not by flex-balancing two side
         groups any more (that trick only worked while three titles sat each
         side). Taken out of flow and centred on the bar itself, exactly the
         technique the shared estate-menu module uses for the same wordmark
         (estate-menu.js .gm-brand-slot, generation 202609042153): position
         absolute, left 50%, translateX(-50%). The sizing/display rule below
         (flex/max-width/etc.) still applies to it for its own children's
         layout; position:absolute only removes it from the nav's flex flow. */
      '#' + BAR_ID + ' .gm-brand-slot{position:absolute!important;left:50%!important;top:0!important;',
      'bottom:0!important;transform:translateX(-50%);pointer-events:none}',
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
      /* Right-align every panel whose title lives in the right-hand group,
         not "the last two of six flat siblings" -- that positional rule is
         what let the About panel resolve to a negative x once the six
         titles stopped being one undifferentiated row (measured live:
         x=-95 at 1568px, a quarter of its own Versions control
         unreachable). clampPanel() below is the second, JS-measured
         guarantee: this CSS is the common case, not the only defence. */
      '#' + BAR_ID + ' .gm-side-right .gm-panel{left:auto;right:0}',
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
      /* Every layer control's OWN <input> covers its whole label (see
         layerCheckbox / buildLayerControls): a measured audit found the raw
         v8 checkboxes at 17x17px, the input element itself and not just a
         padded label, so a re-measurement of the input's own rect is the
         bar this has to clear, not only a centre-point hit test. */
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
      /* The restored SCADA panel: a branded head (the real .scada-brand and
         .status-legend nodes, moved in once -- see install()) above a
         scrollable body that never mixes with the head's own layout. */
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
      /* The v8 SCADA layers panel STAYS. It was hidden here unconditionally,
         and the reasoning that justified it was circular: this rule set
         display:none!important, which is why "the container height never
         changes", which was then cited as evidence the panel's own toggle was
         inert, which justified the rule. Measured on the live page at
         202609041957, with the toggle un-hidden and clicked: the label does
         flip (LAYERS -> HIDE LAYERS) and data-gridatlas-collapsed does clear.
         The toggle was never inert. Only its effect was invisible.

         The cost of the rule was the whole product surface: all 60 engine
         layer switches sat in a container measured at 0x0, on desktop AND
         phone, with the page unable to scroll to it -- zero of 120 layer
         controls reachable without opening a menu. The register, the
         voltages, the supermarkets, the transit and the EV layers were all
         still in the DOM and none of them could be touched.

         "One identity surface" is still honoured, and it was always about the
         VENTUS wordmark rather than the switches: the real .scada-brand node
         is MOVED into the Grid panel head by install(), not cloned, so the
         restored panel has no second wordmark to show. The Grid dropdown and
         this panel drive the SAME 63 original inputs -- the dropdown proxies
         them -- so the two cannot disagree about what is on.

         Requested directly by the architect, whose product this is, on
         2026-09-04: "restore v8 panels but keep dropdowns file, edit, scope,
         grid, about". Both, not either. */
      '.gridatlas-menu-hosted .scada-wrapper{display:flex!important}',
      /* At phone widths the panel starts collapsed and the toggle opens it:
         measured, an expanded panel held 31.6% of a 393x852 screen against
         the map's 29.3%, which is the wrong trade on the surface most
         readers arrive on. Desktop has the room and gets the panel open, as
         v8 always did. Either way the toggle is now visible, so the reader
         decides rather than the stylesheet. */
      '#gridatlas-dash-toggle{display:inline-flex!important}',
      /* v9.90 made the mobile project card a fixed, full-width bottom sheet.
         The old SCADA layer panel remained underneath it, so a visible layer
         checkbox could lose the hit test to text in the project card. Keep the
         conventional menu and its fixed phone panel in the higher, interactive
         stacking context whenever that sheet is open. */
      'html.gridatlas-sheet-open #' + BAR_ID + '{z-index:10020!important;pointer-events:auto!important}',
      'html.gridatlas-sheet-open #' + BAR_ID + ' .gm-panel{pointer-events:auto!important}',
      'body:not(.fs-active) #' + BAR_ID + ' #btn-fullscreen-exit{display:none!important}',
      'body.fs-active #' + BAR_ID + ' #btn-fullscreen-exit{display:flex!important}',
      /* The shell's own .custom-map-attrib (OpenStreetMap / CARTO / Open
         Charge Map credit) only ever cleared this bar while body.fs-active
         was set. At rest -- and on every Pipeline News deep-link arrival,
         which does not always reach fs-active -- the credit painted at its
         default top:10px and sat directly under the bar, invisible under
         the ABOUT title. A licence credit that is painted but covered is
         not attribution. Clear it whenever this bar is hosted, not only in
         fullscreen; --gridatlas-menu-bar-clear is kept in step with the
         bar's own rendered height (see syncAttribClearance) rather than a
         second hard-coded constant, because the bar itself drops from 36px
         to 34px under the @media rule below and a fixed number sized for
         one breakpoint would leave the credit covered, or needlessly far
         down, at the other. 44px is only the pre-JS fallback. Z-INDEX, not
         only top: measured live, an open dropdown panel painted over the
         credit's right two-thirds (elementFromPoint at 50/70/90% of its
         width resolved to the panel's own button) even though the credit's
         TOP already cleared the bar -- the two are siblings in the same
         stacking context and the panel simply painted after it. The credit
         must outrank every panel this bar can ever open, present or future,
         so its z-index is set once here rather than chased per panel. */
      '.gridatlas-menu-hosted .custom-map-attrib{',
      'top:var(--gridatlas-menu-bar-clear,44px)!important;z-index:10025!important}',
      /* The v8 fullscreen letterhead stands down once this bar hosts the
         brand. #fs-letterhead is painted only under body.fs-active, and
         fs-active is set by exactly one caller: the deep-link arrival's
         enterFullscreen(), which runs when trayTarget() is true. That is
         every phone and no desktop -- so the duplicate was invisible to
         every desktop check and present on every phone arrival. Measured
         on an iPhone 13 viewport at 202609041250: the fused masthead sat
         correctly at x=165 (11px) while this one painted at x=254 (15px),
         over the SCOPE, GRID and ABOUT titles in the right side group.
         The brand is not lost by hiding it -- it is the same wordmark,
         still on screen, now in the bar at every width and in every
         fullscreen state, which is what fusing it there was for. */
      '.gridatlas-menu-hosted #fs-letterhead{display:none!important}',
      /* A phone cannot hold six titles and a centred wordmark on one line
         without one crossing the other -- the same problem the shared
         estate-menu module solved the same way (estate-menu.js, generation
         202609042153): the wordmark keeps a row of its own, centred on the
         full width of the bar, and the titles run in a second row beneath
         it. height:auto (not the old fixed 34px) plus padding-top reserving
         the wordmark row's own height is what makes the bar really two rows
         tall here; syncAttribClearance() measures that real rendered height
         at runtime (it always did), so --gridatlas-menu-bar-clear reflects
         whatever the two rows actually come to, not a second hard number. */
      '@media(max-width:700px){#' + BAR_ID + '{flex-wrap:wrap;height:auto!important;',
      'padding-top:30px!important}',
      '#' + BAR_ID + ' .gm-title{min-height:34px;padding:0 6px;font-size:9px;letter-spacing:.025em}',
      '#' + BAR_ID + ' .gm-brand-slot{left:0!important;right:0!important;top:0!important;',
      'bottom:auto!important;height:30px;transform:none;max-width:none!important;padding:0 2px}',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header>div:first-child,',
      '#' + BAR_ID + ' .gm-brand-slot .hud-header>div:last-child{display:none}',
      '#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:11px;letter-spacing:.14em}',
      '#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:4.5px}',
      '#' + BAR_ID + ' .gm-side-left{flex:0 0 100%;justify-content:center}',
      /* A panel now opens below TWO rows, not one: top:34px (the old
         single-row height) would have opened it under the wordmark row
         and over the titles. --gridatlas-menu-bar-clear already measures
         the bar's real rendered height every time it can change
         (syncAttribClearance, via ResizeObserver / resize) for exactly this
         reason -- it is the same variable .custom-map-attrib already reads
         below -- so the panel reads it too, rather than a second hard
         number that would go stale the moment either row's height did. */
      '#' + BAR_ID + ' .gm-panel{position:fixed;top:var(--gridatlas-menu-bar-clear,64px);',
      'left:4px!important;right:4px!important;',
      'width:auto;max-width:none;max-height:calc(100dvh - 40px);padding-bottom:',
      'calc(6px + env(safe-area-inset-bottom))}',
      '#' + BAR_ID + ' .gm-panel-grid{max-width:none}}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
  }

  function syncAttribClearance(doc) {
    /* Measured, not asserted: the bar is 36px at rest and 34px under the
       @media(max-width:700px) rule in installStyle, and either number could
       change again. Reading the live box keeps the credit clear of the bar
       at whatever height it actually rendered, on the phone width the
       fixture failed on as much as on desktop. Guarded so the DOM-fixture
       proof, which stubs neither getBoundingClientRect nor a CSSOM style
       object, runs through this as a no-op. */
    if (!bar || typeof bar.getBoundingClientRect !== 'function') return;
    var root = doc.documentElement;
    if (!root || !root.style || typeof root.style.setProperty !== 'function') return;
    var rect = bar.getBoundingClientRect();
    var height = Math.ceil(rect.height) || 36;
    var clearance = height + 8;   // clear of the bar's own border-bottom, not flush against it
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

  /* Measured live: the About panel resolved to x=-95 at 1568px width, a
     quarter of its own control off the left edge of the window -- the CSS
     right:0 anchor (now scoped to the right-hand group, see installStyle)
     covers the common case, but this is the second, JS-measured guarantee
     that no panel this bar ever opens can resolve outside the viewport,
     regardless of how its title happens to be positioned. Runs after the
     panel is laid out (post layout, not pre-measured), clears any earlier
     override before measuring so a panel that no longer overflows is not
     left pinned from a previous, narrower viewport. */
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

  var openPanelRefs = null;    // {menu, panel} while a panel is open, so a resize can re-clamp it

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

    /* The VENTUS identity had earlier been torn out of view -- moved into a
       closed About panel, so the reader saw the v8 masthead for the first
       ~1.5s of every arrival and then watched it vanish. Fusing the brand
       into the CENTRE of the same 36px strip the menu titles already live
       in restores it permanently, at every width, with no extra row and
       therefore no map height stolen on a phone.

       UPDATED 2026-09-04: the brand no longer relies on two flex:1 side
       groups balancing around it -- it is taken out of the flex flow
       entirely and centred on the bar itself via position:absolute (see
       the .gm-brand-slot rule in installStyle), because the architect asked
       twice for the six titles to run together as ONE group rather than
       split three-and-three either side of the logo. All six now live in
       .gm-side-left; .gm-side-right is kept only as an empty element so
       nothing that looks for it throws, and is collapsed to zero width so
       it cannot squeeze the left group. Every panel therefore anchors left
       by default; clampPanel() (already relied on below as "the second,
       JS-measured guarantee") is what keeps a title near the right edge --
       About, in particular -- from resolving its panel off-screen, exactly
       as it already did before this change for the same reason. */
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
        /* The real v8 SCADA panel, restored: a branded head (Ventus /
           Cables & Connectivity(r) / the status legend -- the exact shell
           nodes, moved in rather than cloned) above a scrollable body that
           carries the layer groups in the two-column shape v8 used. The
           head never enters that column flow. */
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
      /* All six titles in ONE contiguous group, not split three-and-three
         either side of the brand -- the architect, 2026-09-04, twice: "have
         all the menus together, not split with the Ventus logo, but keep the
         logo". The brand stays, centred independently (see the .gm-brand-slot
         position:absolute rule in installStyle); the right-hand group is kept
         as an empty element so nothing that looks for it throws, and it takes
         no space. */
      left.appendChild(menu);
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

  /* A measured audit found the v8 panel's own checkboxes at 17x17 px --
     the input element itself, not just its label. A label with a tall
     min-height passes a hit-test at its centre but still measures 17x17
     if something re-measures the <input> node's own rect, the way the
     live audit did. So the proxy <input> here is stretched, invisible,
     over the FULL label (position:absolute;inset:0) -- its own
     getBoundingClientRect() is therefore the whole >=44px control, under
     any measurement method -- and a separate, normally-sized box (built
     from CSS alone, no image) carries the visible tick. */
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
          /* original.click() must remain the implementation: its delegated
             engine listener owns hydration.  Suppress only the document-level
             outside-click closer while that synchronous forwarding runs, so
             the reader can see the tick and its live load state. */
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

  /* The two chips that must NOT be swallowed by a menu on a phone.
     ------------------------------------------------------------------------
     GRID and SUBS were put on the map deliberately, and the reason is on the
     record: the grid-line and substation switches live in the SCADA panel
     below the map, "which a phone never scrolls to; activation looked
     broken" (composition manifest, mobile_tray, from phone acceptance on
     2026-09-01). Moving every tray button into a dropdown re-created a milder
     form of exactly that fault - measured at an iPhone 13 viewport on
     202609041330, zero layer controls were reachable without first opening a
     menu.

     So on a touch screen or a narrow window these two stay where they were
     designed to be. Everything else still routes into the menus, and desktop
     is unchanged: there the chips are redundant with a menu that is already
     one click away and always visible. */
  function chipStaysOnMap(node) {
    var text = cleanText(node && node.textContent).toLowerCase();
    if (!/\bgrid\b|\bsubs\b/.test(text)) return false;
    /* An UNKNOWN width is not a phone. Reading `(window.innerWidth || 0) <= 700`
       makes a missing or zero width report narrow, which is the wrong way for
       a default to fail: it would strand these chips on the map in any host
       that does not publish a width, including a headless proof fixture. The
       width has to be a real positive number before it argues for a phone. */
    var coarse = false;
    try {
      coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (error) {
      coarse = false;
    }
    var width = Number(window.innerWidth);
    var narrow = isFinite(width) && width > 0 && width <= 700;
    return coarse || narrow;
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
        if (chipStaysOnMap(button)) return;   // one tap on a phone, not two
        var route = trayRoute(button);
        if (route) move(panels[route], button);
        else button.hidden = true;       // Tools only revealed the controls now in menus
      });
    }

    var gridpoint = doc.getElementById('btn-gridpoint');
    if (move(panels.Scope, gridpoint) && panels.Scope.firstChild !== gridpoint) {
      /* "Grid At Point" sorts before this panel's other four tools
         (Measure, Poly Zone, Radius Area, Radius Search), but this button
         is not always present when the panel's own moves run above -- it
         is added by a different cartridge (sld-sandbox), at its own timing.
         move() only ever appends, so once it does exist it is repositioned
         to the front here, the one time it actually moves into the bar. */
      panels.Scope.insertBefore(gridpoint, panels.Scope.firstChild);
    }

    var disclaimer = doc.querySelector('.disclaimer-box');
    var shoutout = doc.querySelector('.podcast-shoutout');
    move(panels.About, disclaimer);
    move(panels.About, shoutout);

    /* The real .scada-brand (VENTUS, again) and .status-legend move once,
       into the restored SCADA panel's head, during install() below -- not
       hidden as a "duplicate" and not here, so a late DOM rebuild cannot
       repeatedly fight over one node's location. */

    /* The panel's own show/hide control stays REACHABLE. It was hidden here as
       "superseded; measured inert", and it is neither: the stylesheet rule
       above was hiding the panel it moved, so its effect could not be seen.
       With the panel restored this is the only control that opens and closes
       it, and hiding it would leave a phone with a collapsed panel and nothing
       to open it with -- which is the fault this generation exists to end. */
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
    /* The alphabetical rule from the shared estate-menu module applied to
       this panel's own list of tools -- moved in the order their VISIBLE
       labels sort (case-insensitive, en-GB), read once from the live shell:
       "Radius Search", "Radius Area", "Poly Zone", "Measure" -- so this
       call order is Measure, Poly Zone, Radius Area, Radius Search. (A
       fifth Scope tool, Grid At Point, is moved in adoptLate() below,
       asynchronously, and is repositioned there rather than reordered here
       because it does not always exist yet at this point.) NOT applied to
       the 63 layer proxies in the Grid panel below (buildLayerControls) --
       those keep the engine's own grouping, unchanged -- nor to the
       Clear/Scope/Grid/Subs mobile-tray chips a DIFFERENT cartridge
       (sld-sandbox) contributes into this panel at its own async timing;
       reaching into that cartridge's routing was judged out of scope for a
       change confined to this module. */
    move(panels.Scope, ready.nodes.measureButton);
    move(panels.Scope, ready.nodes.zoneButton);
    move(panels.Scope, ready.nodes.radiusAreaButton);
    move(panels.Scope, ready.nodes.radiusButton);

    /* The VENTUS masthead: fused into the bar's own centre (see buildBar),
       never a closed panel -- the architect's "VENTUS branding has been
       lost" was this node being moved into a collapsed About panel, and
       the measured "flash then vanish" (present for ~1.5s, then torn out)
       was that same move happening after the raw v8 page had already
       painted it once. Moving it here, into brandSlot, keeps it visible
       through the whole transition: raw markup, then fused into the bar,
       never hidden in between. */
    move(brandSlot, ready.nodes.header);

    /* The restored SCADA panel's head: the real .scada-brand (VENTUS,
       again, exactly as v8 rendered it) and .status-legend, moved once --
       not cloned, not hidden as a duplicate. gridHead sits above gridBody
       (built by buildLayerControls) and never enters its column flow. */
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
      /* No ResizeObserver: a viewport resize is the only other way the
         bar's own height changes (the @media breakpoint), so fall back to
         watching that. */
      doc.defaultView.addEventListener('resize', function () {
        syncAttribClearance(doc);
        if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
      });
      state.attrib_clearance_source = 'resize-listener';
    }

    /* One document click listener and one change listener, installed once.
       The retry path cannot multiply effects. */
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
