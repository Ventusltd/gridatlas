/* ══════════════════════════════════════════════════════════════════════
   menu-bar - the product is the first impression, not the controls
   ══════════════════════════════════════════════════════════════════════

   THE DEFECT, MEASURED ON A PHONE.

   At 393x852 the Atlas opened with six horizontal bands of chrome stacked
   between the top of the screen and the project card:

     1. Exit / LAYERS / VENTUS
     2. the attribution strip
     3. a search box holding a REPD ref the reader never typed, with GO beside it
     4. a floating tooltip carrying the project identity
     5. TOOLS / GRID / SUBS / SCOPE / CLEAR
     6. GB PRICES, and VERSIONS with HIDE LAYERS overlapping it

   Then the card, whose first lines repeat the title, address and REPD ref
   already visible in band 4. Roughly sixty per cent of the screen was menu
   before any content, and the map - the thing the reader came for - got what
   was left.

   v9.90 and v9.91 fixed reachability: the measurement now lands on screen with
   its qualifiers. Neither touched the clutter, because reachability was
   measured and clutter never was. `overlap: 0 px2` and `fullyInViewport: true`
   were both true of that screen.

   WHY A MENU BAR, AND WHY THIS ONE.

   The architect's instruction: collapse everything into File, Edit, View and
   About at the top, "people are familiar with from Linux, instead of clutter",
   and "the screen should show the product as the first impression".

   That is deliberately a solved pattern. A desktop menu bar is understood
   without instruction, occupies one band instead of three, and - the part that
   matters here - is CLOSED at rest. Chrome that is closed at rest costs the map
   nothing.

   WHAT THIS MODULE DOES NOT DO.

   It does not reimplement a single control. Every button keeps its own handler,
   its own state and its own identity, because this MOVES the existing nodes
   into menu panels rather than building replacements. A moved node is the same
   node: `.click()` on it does exactly what clicking it always did, and any
   state the sandbox mutates on it - a pressed class, a label flip between
   'Tools >' and 'Tools v' - keeps working with no knowledge of this file.

   That is the whole safety argument. The alternative, recreating five controls
   and wiring them to internals, would have made this module a second
   implementation of behaviour that already exists, and the two would drift.

   WHY IT LIVES HERE.

   The chrome is built by sld-sandbox, which is 491 characters from its ceiling
   (368,149 of 368,640) while carrying 18,148 characters of stylesheet that is
   presentation rather than computation. There is no room there for a menu bar.

   substation-intelligence has 161,828 characters clear and loads BEFORE
   sld-sandbox in cartridge_order, so this module can watch for the chrome and
   act the moment it appears. The same move as the version ledger at v9.85: put
   the thing in the cartridge that has room for it.

   Hoisting that stylesheet out of sld-sandbox remains the right next step and
   is not attempted here. Bundling an architectural hoist into a UI change is
   how two things fail together.

   FAILING SOFT, DELIBERATELY.

   If the chrome never appears, this does nothing and the Atlas is exactly as it
   was. If a control is missing, that control is skipped and the rest still
   move. Nothing is ever removed from the document - only relocated - so the
   worst case is a control in a menu instead of a bar, never a control that
   stopped existing.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SCHEMA = 'gridatlas.menu-bar.v1';
  var STYLE_ID = 'gridatlas-menu-bar-css';
  var BAR_ID = 'gridatlas-menu-bar';

  /* Which menu a control belongs in, decided by its own visible text.
     Matching on text rather than position means a control that moves, or one
     that is added later, still lands somewhere sensible instead of vanishing. */
  var ROUTING = [
    { menu: 'File',  test: /exit|close|share|export|download/i },
    { menu: 'Edit',  test: /clear|scope|grid at point|gridpoint|tools/i },
    { menu: 'View',  test: /grid\b|subs|layer|price|historic|map|ring/i },
    { menu: 'About', test: /version|about|credit|source|attribution/i }
  ];
  var MENUS = ['File', 'Edit', 'View', 'About'];
  var FALLBACK = 'View';

  function routeFor(label) {
    var text = String(label || '').trim();
    for (var i = 0; i < ROUTING.length; i += 1) {
      if (ROUTING[i].test.test(text)) return ROUTING[i].menu;
    }
    return FALLBACK;
  }

  function installStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + BAR_ID + '{position:absolute;top:0;left:0;right:0;z-index:640;',
      'display:flex;gap:2px;align-items:stretch;',
      'background:rgba(6,14,18,0.92);border-bottom:1px solid rgba(80,220,240,0.28);',
      'font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
      '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}',
      '#' + BAR_ID + ' .gm-menu{position:relative}',
      '#' + BAR_ID + ' .gm-title{appearance:none;background:transparent;border:0;',
      'color:#cfeef6;letter-spacing:0.08em;text-transform:uppercase;',
      'min-height:44px;padding:0 14px;cursor:pointer;font:inherit}',
      '#' + BAR_ID + ' .gm-title:hover,#' + BAR_ID + ' .gm-menu.gm-open .gm-title',
      '{background:rgba(80,220,240,0.16);color:#eafcff}',
      '#' + BAR_ID + ' .gm-panel{display:none;position:absolute;top:100%;left:0;',
      'min-width:212px;max-height:60vh;overflow:auto;padding:6px;',
      'background:rgba(6,14,18,0.97);border:1px solid rgba(80,220,240,0.3);',
      'border-top:0;box-shadow:0 10px 30px rgba(0,0,0,0.55)}',
      '#' + BAR_ID + ' .gm-menu.gm-open .gm-panel{display:block}',
      '#' + BAR_ID + ' .gm-panel > *{display:block;width:100%;min-height:44px;',
      'box-sizing:border-box;margin:0 0 4px 0;text-align:left}',
      '#' + BAR_ID + ' .gm-panel > *:last-child{margin-bottom:0}',
      '#' + BAR_ID + ' .gm-empty{color:#7fa6b0;padding:10px 12px;font-style:italic}',
      /* the bar owns one band; the map takes everything under it */
      '.gridatlas-menu-hosted .map-controls{display:none !important}',
      '.gridatlas-menu-hosted .map-container{top:44px !important}'
    ].join('');
    (doc.head || doc.documentElement).appendChild(style);
  }

  function buildBar(doc) {
    var bar = doc.createElement('nav');
    bar.id = BAR_ID;
    bar.setAttribute('aria-label', 'Atlas menu');
    var panels = {};

    MENUS.forEach(function (name) {
      var wrap = doc.createElement('div');
      wrap.className = 'gm-menu';

      var title = doc.createElement('button');
      title.type = 'button';
      title.className = 'gm-title';
      title.textContent = name;
      title.setAttribute('aria-expanded', 'false');

      var panel = doc.createElement('div');
      panel.className = 'gm-panel';

      title.addEventListener('click', function (event) {
        event.stopPropagation();
        var open = wrap.classList.contains('gm-open');
        /* one menu at a time - two open panels is the clutter this replaces */
        bar.querySelectorAll('.gm-menu.gm-open').forEach(function (other) {
          other.classList.remove('gm-open');
          var t = other.querySelector('.gm-title');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          wrap.classList.add('gm-open');
          title.setAttribute('aria-expanded', 'true');
        }
      });

      wrap.appendChild(title);
      wrap.appendChild(panel);
      bar.appendChild(wrap);
      panels[name] = panel;
    });

    /* Closed at rest, and closed again after any choice. "Self minimise" is the
       instruction; a menu that stays open has simply become another bar. */
    doc.addEventListener('click', function () {
      bar.querySelectorAll('.gm-menu.gm-open').forEach(function (other) {
        other.classList.remove('gm-open');
        var t = other.querySelector('.gm-title');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    });

    return { bar: bar, panels: panels };
  }

  function adopt(doc, panels) {
    var stack = doc.querySelector('.map-controls');
    if (!stack) return 0;

    /* Direct children only. Nested structure is left intact and moved whole, so
       a control that is really a group keeps its group. */
    var moved = 0;
    Array.prototype.slice.call(stack.children).forEach(function (node) {
      var label = node.textContent || node.getAttribute('aria-label') || '';
      var target = panels[routeFor(label)];
      if (!target) return;
      target.appendChild(node);
      moved += 1;
    });

    MENUS.forEach(function (name) {
      if (panels[name].children.length === 0) {
        var empty = doc.createElement('div');
        empty.className = 'gm-empty';
        empty.textContent = 'nothing here yet';
        panels[name].appendChild(empty);
      }
    });

    return moved;
  }

  function install(doc) {
    if (doc.getElementById(BAR_ID)) return true;
    var stack = doc.querySelector('.map-controls');
    if (!stack || stack.children.length === 0) return false;

    installStyle(doc);
    var built = buildBar(doc);
    var host = stack.parentNode || doc.body;
    host.insertBefore(built.bar, host.firstChild);
    var moved = adopt(doc, built.panels);
    doc.documentElement.classList.add('gridatlas-menu-hosted');

    var NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
    if (NS.menuBar) NS.menuBar.installed = true;
    if (NS.menuBar) NS.menuBar.controls_moved = moved;
    return true;
  }

  function start() {
    var doc = document;
    if (install(doc)) return;
    /* The chrome is built by a later cartridge, so wait for it rather than
       racing it. Bounded: if it never arrives, this module simply did nothing.

       The guard is not defensive noise. This module is executed inside the
       cartridge proofs under node:vm against a window stub, and the first cut
       of it called setInterval unconditionally - which threw there and took the
       sld-sandbox proof down with it. "Fails soft" was in the comment and not
       in the code; the proof caught the difference. Where there is no timer
       there is also no chrome coming, so doing nothing is the correct answer
       rather than a degraded one. */
    if (typeof window.setInterval !== 'function'
      || typeof window.clearInterval !== 'function') return;
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (install(doc) || tries > 120) window.clearInterval(timer);
    }, 250);
  }

  var NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
  NS.menuBar = {
    schema: SCHEMA,
    menus: MENUS.slice(),
    bar_id: BAR_ID,
    installed: false,
    controls_moved: 0,
    routeFor: routeFor,
    reason: 'The product is the first impression. Chrome that is closed at rest '
      + 'costs the map nothing.',
    not_a_reimplementation: 'Controls are moved, not rebuilt, so every handler '
      + 'and every piece of state belongs to the cartridge that made it.'
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
