/** Credit Esri while the Satellite basemap is on.
 * The Satellite basemap is Esri World Imagery (source 'sat-s', layer 'l-sat',
 * declared by substation-intelligence). Esri asks for "Powered by Esri" and
 * the service's data attribution to be shown on the map, always visible,
 * whenever its imagery is displayed:
 * https://developers.arcgis.com/documentation/esri-and-data-attribution/
 * The text is the service's own copyrightText, read once when Satellite is
 * first switched on; the constant below is used until then or if the read fails.
 * While Satellite is on: a small credit strip sits at the bottom of the map,
 * lifted clear of any control over it, and the same credit is appended to the
 * map attribution line so exports carry it. Both are removed when it is off.
 */
(() => {
  const STRIP_ID = 'gridatlas-esri-credit';
  const LINE_ID = 'gridatlas-esri-credit-line';
  const SERVICE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=json';
  let source = 'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community';
  let asked = false;

  function map() { return window.__GRIDATLAS_V9_MAP__; }
  function satelliteOn() {
    const m = map();
    try { return !!(m && m.getLayer && m.getLayer('l-sat') && m.getLayoutProperty('l-sat', 'visibility') === 'visible'); }
    catch (_) { return false; }
  }

  function fill(node) {
    node.textContent = '';
    node.append('Powered by ');
    const link = document.createElement('a');
    link.href = 'https://www.esri.com';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Esri';
    node.append(link, ' | ' + source);
  }

  function askService() {
    if (asked) return;
    asked = true;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    fetch(SERVICE, { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(json => {
        const text = json && typeof json.copyrightText === 'string' ? json.copyrightText.trim() : '';
        if (text && /esri/i.test(text) && text.length < 300 && text !== source) { source = text; sync(true); }
      })
      .catch(() => {});
  }

  function style() {
    if (document.getElementById(STRIP_ID + '-style')) return;
    const css = document.createElement('style');
    css.id = STRIP_ID + '-style';
    css.textContent = `#${STRIP_ID}{position:absolute;right:4px;bottom:4px;z-index:2;max-width:calc(100% - 8px);
  box-sizing:border-box;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.62);color:#d6dee2;
  font:10px/1.4 'Courier New',monospace;text-align:right;pointer-events:auto}
#${STRIP_ID} a,#${LINE_ID} a{color:#00ffff;text-decoration:none}
#${STRIP_ID} a:hover,#${LINE_ID} a:hover{text-decoration:underline}`;
    document.head.appendChild(css);
  }

  /* Bottom of the map unless a control is over that band; then step up until
     the strip is the topmost element across its width and height. */
  function place(strip) {
    const host = strip.parentElement;
    if (!host) return;
    const limit = host.getBoundingClientRect().height / 2;
    for (let bottom = 4; bottom <= limit; bottom += 4) {
      strip.style.bottom = bottom + 'px';
      const box = strip.getBoundingClientRect();
      const clear = [0.1, 0.5, 0.9].every(row => [0.03, 0.25, 0.5, 0.75, 0.97].every(f => {
        const hit = document.elementFromPoint(box.left + box.width * f, box.top + box.height * row);
        return !hit || strip.contains(hit);
      }));
      if (clear) return;
    }
    strip.style.bottom = '4px';
  }

  function sync(refill) {
    const on = satelliteOn();
    const host = document.getElementById('map-container');
    let strip = document.getElementById(STRIP_ID);
    let line = document.getElementById(LINE_ID);
    if (!on) {
      if (strip) strip.remove();
      if (line) line.remove();
      return;
    }
    askService();
    style();
    if (host && !strip) {
      strip = document.createElement('div');
      strip.id = STRIP_ID;
      fill(strip);
      host.appendChild(strip);
    } else if (strip && refill) fill(strip);
    const attrib = document.querySelector('.custom-map-attrib');
    if (attrib && !line) {
      line = document.createElement('span');
      line.id = LINE_ID;
      attrib.appendChild(line);
      line.append(' | ');
      const inner = document.createElement('span');
      fill(inner);
      line.appendChild(inner);
    } else if (line && refill) {
      line.textContent = ' | ';
      const inner = document.createElement('span');
      fill(inner);
      line.appendChild(inner);
    }
    if (strip) place(strip);
  }

  function later() { setTimeout(() => sync(false), 0); }

  // The engine sets the layer in its own change handler; read it afterwards.
  document.addEventListener('change', event => {
    const name = event.target && event.target.name;
    if (name === 'bm' || name === 'bm-fs' || name === 'gridatlas-menu-basemap') later();
  }, true);
  window.addEventListener('resize', later);

  let hooked = false;
  function hook() {
    const m = map();
    if (!hooked && m && m.on) { hooked = true; m.on('styledata', later); }
  }
  // Re-place while Satellite is on: sheets and cards change what sits over the map.
  setInterval(() => { hook(); if (satelliteOn() || document.getElementById(STRIP_ID)) sync(false); }, 1000);
  hook();
  sync(false);
})();
