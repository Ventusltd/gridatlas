/**
 * Step: the grid computation stops needing a project.
 *
 * Everything built tonight - the published circuits and transformers, the
 * seasonal ratings, the electrical distance in hops, the declared DC
 * powerflow - has only been reachable by arriving from Pipeline News with
 * a project in the URL. That is one journey, and it is the wrong one to
 * be the only one: the interesting question is often asked of a place, not
 * of a scheme that already exists.
 *
 * TWO CHANGES
 * -----------
 * 1. A tool in the tray arms "grid at point". The next click on open map
 *    resolves the nearest published connection points and renders the
 *    whole stack against the nearest one. The arming is explicit and
 *    follows the Scope chip's existing rule: a map that analysed every
 *    stray tap would put a card over the thing the reader was looking at.
 *
 * 2. The layers dash collapses and restores. It is 816 px tall on a
 *    desktop and occupies most of a phone, and until now the only way past
 *    it was fullscreen - which is a different mode with a different
 *    layout. A reader who wants to look at the map should not have to
 *    change mode to do it. The choice is remembered per browser.
 *
 * THE CAVEAT THAT HAS TO TRAVEL WITH "NEAREST"
 * --------------------------------------------
 * The owner product publishes 886 connection points and locates 502 of
 * them; the other 384 are published without coordinates because "a site
 * nobody has mapped is published without coordinates rather than dropped".
 * So "the nearest connection point" is really "the nearest of the 502 that
 * anyone has mapped", and there may be a closer one that OpenStreetMap has
 * never had a node for. The card says so every time. It is also a
 * straight-line distance and not a cable route, and it is not a statement
 * that anything can connect there.
 */

const BODY = 'atlas/parts/202609012045-sld-sandbox-body.js';

export default {
  id: 'grid-at-point',
  version: 'v9.74',

  scope: 'the grid computation is reachable from the map itself: a tool arms a point query, and a click on open map resolves the nearest published connection points and renders the published circuits, the seasonal ratings, the electrical distance in hops and the declared powerflow against the nearest one, saying every time that 384 of the 886 published points have no coordinates so the nearest MAPPED point may not be the nearest point; and the layers dash collapses and restores on any device without entering fullscreen, the choice remembered per browser',

  note: 'the arming is explicit, following the Scope chip: a map that analysed every stray tap would cover the thing the reader was looking at. Distance to a point is straight-line and is not a cable route, and nothing here says anything can connect.',

  apply({ read, write, sandboxProof }) {
    let body = read(BODY);

    const once = (from, to, label) => {
      const n = body.split(from).length - 1;
      if (n !== 1) throw new Error(`anchor found ${n} times: ${label}`);
      body = body.replace(from, () => to);
    };

    /* ── 1. state ────────────────────────────────────────────────────── */
    once(`  let scopeArmed = false;`,
      `  let scopeArmed = false;
  /* Armed explicitly, like the scope. Published on the link object so a
     reviewer can ask the page which modes are live. */
  let pointArmed = false;`,
      'scope state');

    /* ── 2. the tool in the tray ─────────────────────────────────────── */
    once(`    const grid = quickChip('\\u26a1 Grid', GRID_LINE_LAYERS);`,
      `    /* The tray tool. The shell owns .map-controls and the shell is
       immutable, so the button is added by this cartridge at runtime and
       removed again if the cartridge is not composed - there is no orphan
       control left behind claiming a feature that is not present. */
    (function addGridPointTool() {
      const tray = document.querySelector('.map-controls');
      if (!tray || document.getElementById('btn-gridpoint')) return;
      const button = document.createElement('button');
      button.className = 'map-ctrl-btn';
      button.id = 'btn-gridpoint';
      button.type = 'button';
      button.textContent = '\\u25c8 Grid At Point';
      button.setAttribute('aria-pressed', 'false');
      button.title = 'Click anywhere on the map for the published network at the nearest mapped connection point';
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        pointArmed = !pointArmed;
        button.setAttribute('aria-pressed', String(pointArmed));
        button.style.outline = pointArmed ? '1px solid currentColor' : '';
        link.grid_point_armed = pointArmed;
        if (!pointArmed) clearScope();
      });
      tray.appendChild(button);
    }());

    const grid = quickChip('\\u26a1 Grid', GRID_LINE_LAYERS);`,
      'tray tool');

    /* ── 3. the click ────────────────────────────────────────────────── */
    once(`          clearLinks();
          if (scopeArmed) await runGridScope(map, [event.lngLat.lng, event.lngLat.lat]);
          return;`,
      `          clearLinks();
          if (pointArmed) await runGridAtPoint(map, event.lngLat.lng, event.lngLat.lat);
          if (scopeArmed) await runGridScope(map, [event.lngLat.lng, event.lngLat.lat]);
          return;`,
      'click branch');

    /* ── 4. the answer ───────────────────────────────────────────────── */
    once(`  function topologyBlockHtml(queries) {`,
      `  /* The published network at an arbitrary point.
     ---------------------------------------------------------------------
     The connection-points cartridge already resolves a position to the
     nearest published sites, so this does not measure anything itself -
     a second distance implementation in this file is exactly the drift
     that put two geodesies in one cartridge. It resolves, states the
     limit of what "nearest" can mean here, and hands the nearest name to
     the block that already renders circuits, ratings, hops and flow. */
  async function runGridAtPoint(map, lon, lat) {
    const gl = window.maplibregl;
    if (!gl?.Popup) return;
    const network = window.__GRIDATLAS_NETWORK__ || null;
    const show = (html) => {
      try {
        return new gl.Popup({ maxWidth: '380px', closeOnClick: false })
          .setLngLat([lon, lat]).setHTML(html).addTo(map);
      } catch (error) {
        noteFailure('grid at point: ' + String(error?.message || error));
        return null;
      }
    };

    if (!network || typeof network.nearest !== 'function' || !network.loaded) {
      show('<p class="neon-caveat"><b>Grid at point:</b> the connection-points '
        + 'cartridge has not loaded, so no published site can be named. '
        + 'Nothing is inferred from its absence.</p>');
      return;
    }

    /* nearest() returns { point, km } pairs, sorted. It owns the distance;
       measuring again here would be the second implementation that put
       two geodesies in one cartridge earlier tonight. */
    let found = [];
    try { found = network.nearest(lon, lat, { limit: 5 }) || []; }
    catch (_) { found = []; }
    if (!Array.isArray(found)) found = found ? [found] : [];

    const points = Number(network.points || 0);
    const located = Number(network.located || 0);
    const unlocated = points - located;

    if (!found.length) {
      show('<p class="neon-caveat"><b>Grid at point:</b> no published connection '
        + 'point with coordinates resolved here. ' + unlocated + ' of the '
        + points + ' published points carry no coordinates at all, so this is '
        + 'a statement about the mapped set and not about the network.</p>');
      pointQuery.answered += 1;
      return;
    }

    const rows = found.map(entry => escapeHtml(String(entry.point?.name || '?'))
      + (Number.isFinite(entry.km) ? ' \\u00b7 ' + entry.km.toFixed(1) + ' km' : ''));

    const popup = show('<div class="neon-hd">Grid at this point'
      + '<span class="neon-beta">published network</span></div>'
      + '<p class="neon-caveat"><b>Nearest mapped connection points:</b> '
      + rows.join(', ') + '.</p>'
      + '<p class="neon-caveat">Straight-line distance from where you clicked - '
      + 'not a cable route, and not a statement that anything can connect at any '
      + 'of them. ' + unlocated + ' of the ' + points + ' published connection '
      + 'points have no coordinates, so the nearest <i>mapped</i> point may not '
      + 'be the nearest point.</p>'
      /* fillTopologyBlocks() selects by CLASS, not by a data attribute.
         Getting that wrong would have produced a block that renders its
         loading line forever and never fills. */
      + '<div class="' + TOPOLOGY_BLOCK + '" data-queries="'
      + escapeHtml(JSON.stringify([{ name: String(found[0].point?.name || ''), kv: null }])) + '">'
      + '<p class="neon-caveat"><b>Transmission network:</b> loading\\u2026</p></div>');

    pointQuery.answered += 1;
    if (!popup) return;
    try { await ensureTopology(); } catch (_) { /* the block reports its own state */ }
    fillTopologyBlocks();
  }

  function topologyBlockHtml(queries) {`,
      'the point answer');

    /* ── 5. state published for review ───────────────────────────────── */
    once(`  window.__GRIDATLAS_POWERFLOW__ = powerflow;`,
      `  window.__GRIDATLAS_POWERFLOW__ = powerflow;

  /* How many point queries the reader ran. A feature nobody can reach is
     indistinguishable from a feature that does not work, and this is the
     number that tells them apart. */
  const pointQuery = { answered: 0 };
  window.__GRIDATLAS_POINT_QUERY__ = pointQuery;`,
      'point query state');

    /* ── 6. the layers dash collapses ────────────────────────────────── */
    once(`  window.__GRIDATLAS_POINT_QUERY__ = pointQuery;`,
      `  window.__GRIDATLAS_POINT_QUERY__ = pointQuery;

  /* The layers dash collapses without entering fullscreen.
     ---------------------------------------------------------------------
     The dash is 816 px tall on a desktop and takes most of a phone, and
     the only way past it has been fullscreen - a different mode with a
     different layout, which is a large thing to ask of a reader who just
     wants to see the map. This collapses it in place and leaves a tab to
     bring it back.

     The choice is remembered per browser and every storage access is
     wrapped: a private window, cleared site data or a browser set to
     block storage all throw here, and a thrown error must not take the
     control with it. */
  (function dashCollapse() {
    const KEY = 'gridatlas.dash.collapsed';
    const dash = document.querySelector('.dashboard');
    if (!dash || document.getElementById('gridatlas-dash-toggle')) return;

    const style = document.createElement('style');
    style.textContent = '.dashboard[data-gridatlas-collapsed="1"]{max-height:0;'
      + 'overflow:hidden;padding-top:0;padding-bottom:0;border:0;}'
      + '#gridatlas-dash-toggle{position:fixed;right:12px;bottom:12px;z-index:9999;'
      + 'font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;'
      + 'letter-spacing:.08em;padding:8px 12px;border-radius:6px;cursor:pointer;'
      + 'background:#0d1117;color:#7fe3d0;border:1px solid #2b3a44;}'
      + '#gridatlas-dash-toggle:focus-visible{outline:2px solid #7fe3d0;outline-offset:2px;}';
    document.head.appendChild(style);

    const toggle = document.createElement('button');
    toggle.id = 'gridatlas-dash-toggle';
    toggle.type = 'button';

    let collapsed = false;
    try { collapsed = window.localStorage.getItem(KEY) === '1'; } catch (_) { collapsed = false; }

    function reflect() {
      if (collapsed) dash.setAttribute('data-gridatlas-collapsed', '1');
      else dash.removeAttribute('data-gridatlas-collapsed');
      toggle.textContent = collapsed ? '\\u25b4 LAYERS' : '\\u25be HIDE LAYERS';
      toggle.setAttribute('aria-pressed', String(collapsed));
      toggle.setAttribute('aria-label', collapsed
        ? 'Show the layers panel' : 'Hide the layers panel');
      /* MapLibre sizes itself to its container and will not notice the
         page reflowing under it. */
      try { if (window.map && typeof window.map.resize === 'function') window.map.resize(); }
      catch (_) { /* the control still works without the resize */ }
    }

    toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      try { window.localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (_) { /* per-viewer nicety only */ }
      reflect();
    });

    document.body.appendChild(toggle);
    reflect();
    window.__GRIDATLAS_DASH__ = {
      get collapsed() { return collapsed; },
      toggle: () => { toggle.click(); return collapsed; }
    };
  }());`,
      'dash collapse');

    write(BODY, body);

    /* ── 7a. a positional guard becomes an enumerated one ─────────────
       The existing check proved the 10 MB product is not fetched at page
       load by scanning a SPAN of the file - everything between the
       declared table and topologyBlockHtml - for a call to the loader.
       The guarantee is right and must not be lost; the mechanism is
       positional, so any on-demand caller written inside that span turns
       it red for the wrong reason, which is what runGridAtPoint just did.

       It is replaced by an enumerated one: every call site is located,
       the enclosing function is named, and each name must be on an
       allow-list. That is a stronger claim than the span version - it
       covers the whole file rather than one region - and adding a caller
       now requires declaring it here, which is the point. */
    {
      const p = read(sandboxProof);
      const OLD = [
        "check('the module is never asked at load: the boot path does not touch the loader', (() => {",
        "  const boot = cartridgeSource.indexOf('function topologyBlockHtml(queries)');",
        "  const before = cartridgeSource.slice(cartridgeSource.indexOf('const DECLARED = '), boot);",
        "  return !/ensureTopology\\(\\)/.test(before.replace(/function ensureTopology\\(\\)[\\s\\S]*?\\n  \\}\\n/, ''));",
        "})());"
      ].join('\n');
      if (p.split(OLD).length - 1 !== 1) throw new Error('boot-path check anchor is not unique');
      const NEW = [
        "check('the loader is called only from named on-demand paths, never at load', (() => {",
        "  /* Every caller is enumerated. A new one must be added here, which",
        "     is the guarantee: the 10 MB product is fetched when a reader asks",
        "     a question, and never because the page opened. */",
        "  const ALLOWED = new Set(['topologyBlockHtml', 'runGridAtPoint']);",
        "  const found = [];",
        "  let at = cartridgeSource.indexOf('ensureTopology()');",
        "  while (at >= 0) {",
        "    const before = cartridgeSource.slice(0, at);",
        "    /* the declaration is not a call site; skip `function ensureTopology()` */",
        "    if (!/function\\s+$/.test(before.slice(-12))) {",
        "      const m = [...before.matchAll(/function\\s+(\\w+)\\s*\\(/g)].pop();",
        "      found.push(m ? m[1] : '<top level>');",
        "    }",
        "    at = cartridgeSource.indexOf('ensureTopology()', at + 1);",
        "  }",
        "  if (!found.length) return false;   // the loader vanished entirely",
        "  const strays = found.filter(name => !ALLOWED.has(name));",
        "  if (strays.length) console.log('    unexpected ensureTopology caller(s): ' + strays.join(', '));",
        "  return strays.length === 0;",
        "})());"
      ].join('\n');
      write(sandboxProof, p.split(OLD).join(NEW));
    }

    /* ── 7. the gate ─────────────────────────────────────────────────── */
    const proof = read(sandboxProof);
    const TAIL = 'console.log(`\\n${passed}/${passed + failures.length} checks passed`);';
    if (proof.split(TAIL).length - 1 !== 1) throw new Error('sandbox proof tail anchor is not unique');
    write(sandboxProof, proof.replace(TAIL, [
      "console.log('\\nthe grid computation without a project, and a dash that gets out of the way\\n');",
      '',
      "check('a tool is added to the shell tray, which the cartridge does not own',",
      "  /id = 'btn-gridpoint'/.test(cartridgeSource)",
      "  && /document\\.querySelector\\('\\.map-controls'\\)/.test(cartridgeSource));",
      "check('the tool does not duplicate itself if the cartridge runs twice',",
      "  /document\\.getElementById\\('btn-gridpoint'\\)\\) return;/.test(cartridgeSource));",
      "check('arming is explicit, as it is for the scope',",
      "  /let pointArmed = false;/.test(cartridgeSource)",
      "  && /pointArmed = !pointArmed;/.test(cartridgeSource));",
      "check('an unarmed click still does nothing new',",
      "  /if \\(pointArmed\\) await runGridAtPoint/.test(cartridgeSource));",
      "check('the point query never measures a distance itself',",
      "  (() => {",
      "    const start = cartridgeSource.indexOf('async function runGridAtPoint');",
      "    const end = cartridgeSource.indexOf('function topologyBlockHtml');",
      "    if (start < 0 || end < 0 || end < start) return false;",
      "    const fn = cartridgeSource.slice(start, end);",
      "    return /network\\.nearest\\(lon, lat/.test(fn)",
      "      && !/Math\\.atan2|Math\\.asin|6378\\.137/.test(fn);",
      "  })());",
      "/* A plain substring, not a regex: fillTopologyBlocks selects by CLASS",
      "   and getting this wrong produces a block that shows its loading line",
      "   forever and never fills - which no other check here would catch. */",
      "check('the block it writes is found by the filler, which selects by class',",
      "  cartridgeSource.includes(`'<div class=\"' + TOPOLOGY_BLOCK + '\" data-queries=\"'`)",
      "  && /querySelectorAll\\('\\.' \\+ TOPOLOGY_BLOCK\\)/.test(cartridgeSource));",
      "check('the reader is told that nearest MAPPED is not nearest',",
      "  /the nearest <i>mapped<\\/i> point may not/.test(cartridgeSource));",
      "check('the reader is told it is a straight line and not a cable route',",
      "  /not a cable route/.test(cartridgeSource));",
      "check('the point answer never claims anything can connect',",
      "  /not a statement that anything can connect/.test(cartridgeSource));",
      "check('an absent connection-points cartridge is an absence, not a guess',",
      "  /Nothing is inferred from its absence/.test(cartridgeSource));",
      "check('the layers dash can be collapsed without entering fullscreen',",
      "  /gridatlas-dash-toggle/.test(cartridgeSource)",
      "  && /data-gridatlas-collapsed/.test(cartridgeSource));",
      "check('the collapsed choice is remembered, and every storage access is guarded',",
      "  /localStorage\\.getItem\\(KEY\\)/.test(cartridgeSource)",
      "  && /localStorage\\.setItem\\(KEY/.test(cartridgeSource)",
      "  && (cartridgeSource.match(/catch \\(_\\) \\{ collapsed = false; \\}/) || []).length === 1);",
      "check('the map is told to resize when the dash moves under it',",
      "  /window\\.map\\.resize\\(\\)/.test(cartridgeSource));",
      "check('the toggle is reachable and labelled for assistive technology',",
      "  /aria-pressed/.test(cartridgeSource) && /aria-label/.test(cartridgeSource)",
      "  && /focus-visible/.test(cartridgeSource));",
      "check('both new surfaces are published for review',",
      "  /window\\.__GRIDATLAS_POINT_QUERY__ = pointQuery;/.test(cartridgeSource)",
      "  && /window\\.__GRIDATLAS_DASH__ = \\{/.test(cartridgeSource));",
      '',
      TAIL
    ].join('\n')));
  }
};
