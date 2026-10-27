
// ---------------------------------------------------------------- kv-card (fail-first against fixed-module-I.js)
const EUM = 'W_XX-EUMETSAT-Darmstadt,IMG+SAT,MTI1+LI-2-LFL--FD--x-x--ARC-x_C_EUMT_20261025112026_L2PF_OPE_20261025111009_20261025112009_N__O_0068_0000:2025';
const SUBS = [
  { at: [-1.51, 52.01], kv: [33], name: 'Tiny 33kV' },
  { at: [-1.6, 52.0], kv: [132], name: 'A 132' },
  { at: [-1.5, 52.3], kv: [400, 132], name: 'B 400' },
  { at: [-2.5, 52.0], kv: [275], name: 'C 275' },
  { at: [-4.0, 55.0], kv: [400], name: 'Far 400' }];
const cardOf = x => x.mapEl.querySelector('[data-lightning-card]');
const walkAll = function* (e) { yield e; for (const c of e.children || []) if (c.tagName) yield* walkAll(c); };
const tapAt = (x, i = 0) => x.tapMap([5, 5], { 'l-gridatlas-lightning-hit': [{ properties: { i }, geometry: { coordinates: [0, 0] } }] });

test('K1: the card is a compact bottom bar: [Flash <UTC>][−][×], an expandable "lat/lon · ID hh:mm–hh:mm #index" row holding the full ID, and the honesty line; no NEAREST button', async () => {
  const t = Date.parse('2026-10-25T11:15:58.149Z'), x = boot({ feedFn: () => feed([flash(t, EUM, [-4.4874, 55.1637])]) }); x.toggle(true); x.click(x.chip('7d')); await drain(); tapAt(x);
  assert.equal(x.popups.length, 0); const card = cardOf(x); assert.ok(card);
  const st = card.style.cssText;
  for (const re of [/position:absolute/, /left:8px;right:8px/, /z-index:21/, /max-width:480px/, /background:#000/, /color:#e8f4f5/, /border:1px solid #2f6f75/, /font:11px\/1\.45 monospace/, /overflow-y:auto/]) assert.match(st, re);
  assert.doesNotMatch(st, /transform|top:/, 'card still anchored to the flash');
  assert.equal(card.getAttribute('role'), 'dialog');
  const [bar, body] = card.children; assert.equal(card.children.length, 2);
  assert.match(bar.style.cssText, /display:flex;align-items:center/); assert.match(bar.style.cssText, /background:#0a1a1d/);
  assert.equal(bar.children[0].textContent, 'Flash 2026-10-25 11:15:58 UTC'); assert.match(bar.children[0].style.cssText, /text-overflow:ellipsis;white-space:nowrap/);
  const btns = bar.children.filter(c => c.tagName === 'BUTTON'); assert.deepEqual(btns.map(b => [b.getAttribute('aria-label'), b.textContent]), [['Minimise', '−'], ['Close', '×']]);
  for (const b of btns) { assert.match(b.style.cssText, /width:44px;height:44px/); assert.equal(b.type, 'button'); }
  const det = body.children[0]; assert.equal(det.tagName, 'DETAILS'); assert.equal(det.hasAttribute('open'), false, 'full ID open by default');
  const sum = det.children[0]; assert.equal(sum.tagName, 'SUMMARY'); assert.equal(sum.textContent, 'lat 55.164, lon -4.487 · ID 11:10–11:20 #2025');
  assert.match(sum.style.cssText, /padding:14px 0 13px;line-height:17px/, 'summary not a 44 px row');
  assert.equal(det.children[1].textContent, 'Flash ID ' + EUM); assert.match(det.children[1].style.cssText, /overflow-wrap:anywhere/);
  assert.equal(body.children[1].textContent, 'EUMETSAT optical flash, not a confirmed ground strike. Lines: nearest substations, straight-line; not evidence any asset was hit.');
  assert.equal(card.querySelector('[data-lightning-nearest]'), null); assert.doesNotMatch(card.textContent, /NEAREST SUBSTATIONS/);
  assert.doesNotMatch(card.textContent.replace(EUM, ''), /affected|repd/i);
});

test('K1b: short ID falls back to head…tail for a non-EUMETSAT id; markup in an id stays text', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, '<img src=x onerror=alert(1)>-very-long-identifier-0001', [-1.5, 52])]) }); x.toggle(true); await drain(); tapAt(x);
  const card = cardOf(x); assert.equal(card.querySelector('details').children[0].textContent, 'lat 52.000, lon -1.500 · ID <img src=x o…ier-0001');
  assert.equal(card.querySelectorAll('img').length, 0);
  const y = boot({ feedFn: () => feed([flash(Date.now() - H, null, [-1.5, 52])]) }); y.toggle(true); await drain(); tapAt(y);
  assert.match(cardOf(y).textContent, /ID \(none\)/);
});

test('K2: no node in the card carries a class or id, and no rule in the original sld-styles module (202609040400) has a bare-element or universal compound that could reach it', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, EUM, [-1.5, 52])]) }); x.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } };
  x.toggle(true); await drain(); tapAt(x);
  for (const e of walkAll(cardOf(x))) { assert.equal(e.className, '', e.tagName + ' has a class'); assert.equal(e.id, '', e.tagName + ' has an id'); }
  const W = {}; vm.runInNewContext(readFileSync(STYLES, 'utf8'), { window: W });
  const S = W.__GRIDATLAS_MODULES__.sldStyles; let css = '';
  for (const k of Object.keys(S)) if (typeof S[k] === 'function') css += S[k]('X');
  assert.match(css, /\.maplibregl-popup\.gridatlas-min \.maplibregl-popup-content > \*:not\(\.gridatlas-card-bar\)\{display:none !important\}/, 'hiding rule not found: wrong file');
  const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')[0].trim()).filter(Boolean);
  assert.ok(sels.length > 100, 'parsed ' + sels.length);
  // A rule reaches a card node only if its subject compound is class/id-free (card nodes have none) and every class/id it
  // names on an ancestor is one the card's real ancestors can carry (html, body, .map-container, #map.maplibregl-map).
  const ANC = new Set(['.gridatlas-sheet-open', '.fs-active', '.map-container', '#map-container', '.is-fullscreen', '#map', '.maplibregl-map']);
  const toks = c => (c.replace(/:not\([^)]*\)/g, '').match(/[.#][\w-]+/g) || []);
  const reach = (list) => list.filter(sel => !/^(@|\d+%|from$|to$)/.test(sel)).flatMap(sel => sel.split(',')).map(o => o.trim()).filter(one => {
    const parts = one.split(/\s*[>+~]\s*|\s+/), subj = parts.pop();
    return toks(subj).length === 0 && parts.every(a => toks(a).every(t => ANC.has(t)));
  });
  assert.deepEqual(reach(sels), [], 'an sld-styles rule can reach the Lightning card');
  const shell = readFileSync(SHELLCSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map(r => r.split('{')[0].trim()).filter(Boolean);
  // html/body reach by inheritance only (the card sets its own font and colours inline); inputs: the card has none; the rest are scrollbar paint
  assert.deepEqual(reach(shell), ['html', 'body', 'input[type="checkbox"]', 'input[type="radio"]', '::-webkit-scrollbar', '::-webkit-scrollbar-track', '::-webkit-scrollbar-thumb', '::-webkit-scrollbar-thumb:hover', '*']);
  for (let p = cardOf(x).parentNode; p && p.tagName; p = p.parentNode) assert.doesNotMatch(p.className, /maplibregl-popup/);
});

test('K3: tapping a flash draws the substation lines at once (no button) and lists them inside the expandable row; close removes both', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, EUM, [-1.5, 52])]) }); x.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } };
  x.toggle(true); await drain(); tapAt(x);
  const src = x.sources.get('gridatlas-lightning-nearest'); assert.ok(src, 'lines not fired on tap');
  assert.equal(JSON.stringify(src.data.features.filter(f => f.geometry.type === 'LineString').map(f => f.geometry.coordinates[1])), JSON.stringify([[-1.6, 52], [-1.5, 52.3], [-2.5, 52]]));
  for (const id of ['glow', 'core', 'node', 'label']) assert.ok(x.layers.get('gridatlas-lightning-nearest-' + id), id);
  const det = cardOf(x).querySelector('details'); assert.match(det.textContent, /6\.85 km · 132 kV · A 132/); assert.match(det.textContent, /Not evidence any asset was struck/);
  dispatch(cardOf(x).querySelector('[aria-label="Close"]'), 'click', x.log.errors);
  assert.equal(cardOf(x), null); assert.equal(x.sources.get('gridatlas-lightning-nearest'), undefined);
  tapAt(x); assert.ok(x.sources.get('gridatlas-lightning-nearest')); x.tapMap([200, 200], {}); assert.equal(x.sources.get('gridatlas-lightning-nearest'), undefined, 'empty tap kept lines');
  tapAt(x); x.toggle(false); assert.equal(x.sources.get('gridatlas-lightning-nearest'), undefined, 'OFF kept lines');
  assert.deepEqual(x.log.errors.map(String), []);
});

test('K3b: substations not loaded at tap: the card says so, retries every 2 s while open, draws when they arrive; a closed card never draws', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); x.toggle(true); await drain(); tapAt(x);
  assert.match(cardOf(x).textContent, /Substation data not loaded yet/); assert.equal(x.sources.get('gridatlas-lightning-nearest'), undefined);
  x.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } };
  await new Promise(r => setTimeout(r, 2150)); assert.ok(x.sources.get('gridatlas-lightning-nearest'), 'no retry');
  const y = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); y.toggle(true); await drain(); tapAt(y);
  dispatch(cardOf(y).querySelector('[aria-label="Close"]'), 'click', y.log.errors);
  y.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } };
  await new Promise(r => setTimeout(r, 2150)); assert.equal(y.sources.get('gridatlas-lightning-nearest'), undefined, 'drew for a closed card');
});

test('K4: docked at the bottom of the map, lifted 8 px clear of the original .map-controls / LAYERS toggle, below the menu bar; falls back to 8 px when lifting cannot fit', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]), dash: { top: 640, bottom: 684, left: 300, right: 380, width: 80, height: 44 } });
  x.mapEl._rect = { top: 100, left: 0, right: 393, bottom: 700, width: 393, height: 600 };
  x.doc.getElementById('gridatlas-menu-bar')._rect = { top: 0, bottom: 150, left: 0, right: 393, width: 393, height: 150 };
  const mc = x.doc.createElement('div'); mc.className = 'map-controls'; mc._rect = { top: 560, bottom: 670, left: 10, right: 380, width: 370, height: 110 }; x.mapEl.parentNode.appendChild(mc);
  x.toggle(true); await drain(); tapAt(x); const card = cardOf(x);
  assert.equal(card.style.bottom, '148px', 'not lifted above .map-controls'); assert.equal(card.style.maxHeight, '394px');
  mc._rect = { ...mc._rect, height: 0 }; for (const h of x.handlers.filter(h => h.t === 'resize')) h.f();
  assert.equal(card.style.bottom, '68px', 'not lifted above the LAYERS toggle');
  mc._rect = { top: 200, bottom: 670, left: 10, right: 380, width: 370, height: 470 }; card.offsetHeight = 120; for (const h of x.handlers.filter(h => h.t === 'resize')) h.f();
  assert.equal(card.style.bottom, '8px', 'no fallback when the lift cannot fit');
  assert.ok(x.handlers.some(h => h.t === 'resize')); assert.ok(!x.handlers.some(h => h.t === 'move'), 'still repositions on every move frame');
});

test('K5: − minimises to the bar alone (lines stay), + restores; aria-expanded follows', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]) }); x.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } };
  x.toggle(true); await drain(); tapAt(x); const card = cardOf(x), mn = card.querySelector('[aria-label="Minimise"]');
  assert.equal(mn.getAttribute('aria-expanded'), 'true');
  dispatch(mn, 'click', x.log.errors); assert.equal(card.children[1].style.display, 'none'); assert.equal(mn.textContent, '+'); assert.equal(mn.getAttribute('aria-expanded'), 'false');
  assert.ok(x.sources.get('gridatlas-lightning-nearest'), 'minimise removed the lines');
  dispatch(mn, 'click', x.log.errors); assert.equal(card.children[1].style.display, ''); assert.equal(mn.textContent, '−');
});

test('K6: when a line end is off-screen the map fits flash + substations, padded for the menu bar and the card, never zooming in; no camera move when all are visible', async () => {
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]), bounds: [-1.7, 51.9, -1.4, 52.1] });
  x.map.getZoom = () => 11; x.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } };
  x.mapEl._rect = { top: 100, left: 0, right: 393, bottom: 700, width: 393, height: 600 };
  x.toggle(true); await drain(); tapAt(x);
  const fit = x.camera.filter(c => c[0] === 'fitBounds'); assert.equal(fit.length, 1);
  assert.equal(JSON.stringify(fit[0][1][0]), JSON.stringify([[-2.5, 52], [-1.5, 52.3]]));
  assert.equal(JSON.stringify(fit[0][1][1].padding), JSON.stringify({ top: 40, bottom: 38, left: 40, right: 40 })); assert.equal(fit[0][1][1].maxZoom, 11);
  const y = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52])]), bounds: [-3, 51, 0, 53] });
  y.W.__GRIDATLAS_NEON_LINKS__ = { substations: SUBS, measure: { distanceKm: haversine } }; y.toggle(true); await drain(); tapAt(y);
  assert.equal(y.camera.length, 0, 'moved the camera although every end was visible');
});
