// engine-nearest.js: the integration under test, verbatim as proposed for the lightning module.
// In the module, S/pc/note/msg are the module's own; this page harness supplies stand-ins (see kv-engine.browser.mjs).
const ENGINE_CLASS = 'gridatlas-lightning-engine';
function engineNearest(m, x, y, when) {
  const L = window.__GRIDATLAS_NEON_LINKS__, gl = window.maplibregl;
  if (!L || typeof L.selectAt !== 'function' || !gl || typeof gl.Popup !== 'function') return false;
  pc();                                              // Lightning's own card (and any earlier engine card) goes
  if (!document.getElementById(ENGINE_CLASS)) {      // project-only controls are hidden inside the engine block
    const st = document.createElement('style'); st.id = ENGINE_CLASS;
    st.textContent = `.${ENGINE_CLASS} .neon-layout,.${ENGINE_CLASS} .neon-pin{display:none}`;
    document.head.appendChild(st);
  }
  const card = document.createElement('div'), b = document.createElement('b'), s = document.createElement('span');
  card.style.cssText = 'font-family:monospace;background:#000;padding:6px';
  b.style.cssText = 'color:#00ffff;font-size:13px'; b.textContent = 'Optical flash ' + when;
  s.style.cssText = 'color:#888;font-size:11px';
  s.textContent = 'EUMETSAT MTG Lightning Imager: an optical flash, not necessarily a ground strike. '
    + 'Distances to the nearest mapped substations only; nothing here says any asset was affected.';
  card.append(b, document.createElement('br'), s);
  // The card must exist BEFORE selectAt: the engine's popup watcher clears lines that stand with no .maplibregl-popup.
  const ep = S.ep = new gl.Popup({ maxWidth: '340px', closeOnClick: false, className: ENGINE_CLASS })
    .setLngLat([x, y]).setDOMContent(card).addTo(m);
  if (!S.ev) S.ev = { center: m.getCenter(), zoom: m.getZoom() };   // camera to give back on OFF
  m.flyTo({ center: [x, y], zoom: Math.max(12, m.getZoom()), duration: 1200, essential: true });
  // The engine measures (>=33 kV, 5 nearest within 40 km), draws l-neon-*, sets its origin ring and fills the card.
  L.selectAt([x, y], 'Optical flash ' + when, '', false, null).catch(e => note('engine nearest: ' + msg(e)));
  return true;
}
// Close through the card's OWN bar button: clearLinks() (lines, ring, block, arrival record), popup.remove(), undockSheet().
function engineClose() {
  const p = S.ep; S.ep = null; if (!p) return;
  const x = p.getElement && p.getElement().querySelector('.gridatlas-card-bar .close');
  try { if (x) x.click(); else p.remove(); } catch (_) {}
}
// pc() gains:      engineClose();
// so(false) gains: if (S.ev) { const m = mh(); if (m) m.jumpTo(S.ev); S.ev = null; } document.getElementById(ENGINE_CLASS)?.remove();
// card button:     n.addEventListener('click', () => engineNearest(m, x, y, Ts(tm(g))) || near(m, c, x, y));
