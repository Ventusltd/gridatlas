// Lightning-owned reproduction of the sld-sandbox neon arrival for an optical flash. Spec: hardening/reports/kv-neon.md.
// Source of every constant: atlas/cartridges/202609241334-sld-sandbox-v9-8.js (line refs in the report). A flash has no
// technology, so the colour is the engine's own fallback for an unknown tech: SUBSTATION_COLOUR (drawLinks, l.4524-4526).
(() => {
  const P = 'gridatlas-lightning-neon', SL = P + '-links', SN = P + '-nodes', SP = P + '-pin';
  const IDS = ['glow', 'core', 'flow', 'flow-b', 'node-ring', 'node', 'label', 'pin-halo', 'pin'].map(s => P + '-' + s);
  const TEAL = '#5fbdc2', FLOW = '#bfe9ee', Z = (a, b, hi = 12) => ['interpolate', ['linear'], ['zoom'], 6, a, hi, b];
  const PERIOD = 1.5, SPEED = 0.055, PULSE = 0.42, STEPS = 24, FC = f => ({ type: 'FeatureCollection', features: f });
  let raf = null, phase = 0, last = {};
  const cfg = () => { const L = window.__GRIDATLAS_NEON_LINKS__ || {}, M = L.measure || {};
    return { subs: Array.isArray(L.substations) ? L.substations : [], dk: M.distanceKm, fd: M.flowDash,
      min: M.MIN_KV ?? 33, max: M.MAX_LINK_KM ?? 40, cap: M.LINK_COUNT ?? 5 }; };
  const dash = (p, fd) => { if (typeof fd === 'function') return fd(p);   // the cartridge's own frozen patterns
    const w = ((p % PERIOD) + PERIOD) % PERIOD, i = Math.floor((w / PERIOD) * STEPS) % STEPS, s = (i / STEPS) * PERIOD;
    return [0.001, Math.max(0.001, s), PULSE, Math.max(0.001, PERIOD - s)]; };
  function font(m) { try { const s = m.getStyle(); if (!s || !s.glyphs) return null;   // styleTextFont, l.5248
      for (const l of s.layers || []) { const f = l.layout && l.layout['text-font']; if (Array.isArray(f) && f.length && typeof f[0] === 'string') return f; }
      return ['Open Sans Bold', 'Arial Unicode MS Bold']; } catch (_) { return null; } }
  // nearestSubstations, l.3509: >= 33 kV (the payload is already floored), <= 40 km, nearest 5; the nearest beyond is kept
  function nearest(x, y) { const c = cfg(); if (typeof c.dk !== 'function' || !c.subs.length) return null;
    const all = c.subs.filter(s => s && Array.isArray(s.at) && Array.isArray(s.kv) && s.kv.length && Math.max(...s.kv) >= c.min - 0.5)
      .map(s => ({ ...s, km: c.dk(x, y, s.at[0], s.at[1]) })).filter(s => Number.isFinite(s.km)).sort((a, b) => a.km - b.km);
    const k = all.filter(s => s.km <= c.max).slice(0, c.cap); k.beyond = k.length ? null : all[0] || null; k.radiusKm = c.max; return k; }
  function clear(m) {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; } last = {};
    if (!m) return; try { for (const id of [...IDS].reverse()) if (m.getLayer(id)) m.removeLayer(id);
      for (const s of [SP, SN, SL]) if (m.getSource(s)) m.removeSource(s); } catch (_) { /* map already gone */ } }
  function animate(m, fd) { const set = (id, p) => { const d = dash(p, fd); if (last[id] === d.join()) return; last[id] = d.join(); m.setPaintProperty(id, 'line-dasharray', d); };
    const step = () => { phase = (phase + SPEED) % PERIOD;
      try { set(IDS[2], phase); set(IDS[3], (phase + PERIOD / 2) % PERIOD); } catch (_) { clear(null); return; }
      raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); }
  function show(m, x, y) {
    clear(m); const k = nearest(x, y); if (!k) return { ok: false, why: 'NOT_LOADED', links: [] };
    const o = [x, y], strength = i => Math.max(0.20, 0.62 - i * 0.10), label = s => `${s.km.toFixed(2)} km · ${s.kv[0]} kV`;
    m.addSource(SL, { type: 'geojson', data: FC(k.map((s, i) => ({ type: 'Feature', properties: { colour: TEAL, strength: strength(i), km: s.km }, geometry: { type: 'LineString', coordinates: [o, s.at] } }))) });
    m.addSource(SN, { type: 'geojson', data: FC(k.map(s => ({ type: 'Feature', properties: { colour: TEAL, label: label(s) }, geometry: { type: 'Point', coordinates: s.at } }))) });
    const L = (i, type, source, paint, layout) => m.addLayer(Object.assign({ id: IDS[i], type, source, paint }, layout ? { layout } : {}));
    const RJ = { 'line-cap': 'round', 'line-join': 'round' };   // ensureLayers, l.4314-4375
    L(0, 'line', SL, { 'line-color': ['get', 'colour'], 'line-width': Z(5, 12), 'line-opacity': 0.10, 'line-blur': Z(3, 8) }, RJ);
    L(1, 'line', SL, { 'line-color': ['get', 'colour'], 'line-width': Z(0.9, 1.8), 'line-opacity': ['get', 'strength'] }, RJ);
    L(2, 'line', SL, { 'line-color': FLOW, 'line-width': Z(1.2, 2.4), 'line-opacity': 0.8, 'line-dasharray': [0.2, 3.2] }, { 'line-cap': 'round' });
    L(3, 'line', SL, { 'line-color': FLOW, 'line-width': Z(0.9, 1.8), 'line-opacity': 0.45, 'line-dasharray': [0.2, 3.2] }, { 'line-cap': 'round' });
    L(4, 'circle', SN, { 'circle-radius': Z(6, 13), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': TEAL, 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.4 });
    L(5, 'circle', SN, { 'circle-radius': Z(2.2, 4), 'circle-color': TEAL, 'circle-opacity': 0.8 });
    const f = font(m); if (f) try { L(6, 'symbol', SN, { 'text-color': '#a9c4c9', 'text-halo-color': '#000c10', 'text-halo-width': 1.5, 'text-opacity': 0.9 },
      { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, -1.5], 'text-anchor': 'bottom', 'text-allow-overlap': false, 'text-font': f }); } catch (_) { /* lines stand without labels */ }
    // the origin: the cartridge's project ring (ensurePinLayers, l.5163-5185), in the unknown-tech colour; static, it does not pulse
    m.addSource(SP, { type: 'geojson', data: FC([{ type: 'Feature', properties: { colour: TEAL }, geometry: { type: 'Point', coordinates: o } }]) });
    L(7, 'circle', SP, { 'circle-radius': Z(11, 26, 14), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'colour'], 'circle-stroke-width': 6, 'circle-stroke-opacity': 0.13, 'circle-blur': 0.4 });
    L(8, 'circle', SP, { 'circle-radius': Z(11, 26, 14), 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#cfe9ed', 'circle-stroke-width': 1.6, 'circle-stroke-opacity': 0.85 });
    const reduced = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true; } catch (_) { return false; } })();
    if (reduced) { m.setPaintProperty(IDS[2], 'line-opacity', 0); m.setPaintProperty(IDS[3], 'line-opacity', 0); } else animate(m, cfg().fd);
    // camera: the arrival's flyTo (l.6629) to the zoom it then eases to (framed(), l.6396), with the link's zoom fixed at 12
    const zoom = Math.min(18, Math.max(3, 12 + Math.log2(Math.max(window.innerWidth || 393, 320) / 393)));
    try { m.flyTo({ center: o, zoom, duration: 1200, essential: true }); } catch (_) { /* a still map still shows the links */ }
    return { ok: true, links: k, beyond: k.beyond, reduced, zoom };
  }
  // card: the cartridge's bar (addCardBar, l.3950) and block heading (cardBlockHtml, l.3712), Lightning-owned DOM
  function bar(card, title, onClose) {
    const b = document.createElement('div'); b.className = 'gridatlas-lightning-bar';
    b.style.cssText = 'display:flex;align-items:center;gap:6px;margin:-8px -48px 6px -10px;padding:5px 6px;background:#0a1a1d;border-bottom:1px solid #1d3238;font-family:monospace';
    const s = (css, t) => { const e = document.createElement('span'); e.style.cssText = css; e.textContent = t; b.appendChild(e); return e; };
    s('color:#3f6f75;letter-spacing:2px;font-size:11px', '⋮⋮'); s('color:#8b9aa1;font-size:10px;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title); s('flex:1', '');
    const x = document.createElement('button'); x.type = 'button'; x.setAttribute('title', 'Close'); x.setAttribute('aria-label', 'Close'); x.textContent = '×';
    x.style.cssText = 'background:#050a0d;border:1px solid #2f6f75;color:#5fbdc2;font:inherit;font-size:14px;line-height:1;min-width:44px;height:44px;border-radius:3px;cursor:pointer;padding:0 6px';
    x.addEventListener('click', e => { if (e && e.stopPropagation) e.stopPropagation(); onClose(); }); b.appendChild(x);
    card.insertBefore(b, card.children[0] || null); return b; }
  const head = () => `NEAREST SUBSTATIONS ≥${cfg().min} KV · BETA`;
  window.__GRIDATLAS_LIGHTNING_NEON__ = Object.freeze({ show, clear, nearest, bar, head, ids: IDS, sources: [SL, SN, SP] });
})();
