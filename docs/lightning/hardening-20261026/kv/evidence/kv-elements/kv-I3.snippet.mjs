test('KV-I3: NEAREST SUBSTATIONS binds to the cartridge nearestSubstations (33 kV+, 5 links, 40 km), frames them above a docked card, rings the flash', async () => {
  // the cartridge's own functions, extracted verbatim (lines 3299-3301, 3338-3366, 3513-3541) on its geodesy module
  const cart = readFileSync(process.env.CARTRIDGE, 'utf8').split('\n'), part = (a, b) => cart.slice(a - 1, b).join('\n');
  const gw = {}; vm.runInNewContext(readFileSync(process.env.GEODESY, 'utf8'), { window: gw, Object, Math, Number, Array });
  const cx = { GEODESY: gw.__GRIDATLAS_MODULES__.geodesy, MIN_KV: 33, LINK_COUNT: 5, MAX_LINK_KM: 40, Math, Number, String, Array };
  vm.runInNewContext(part(3299, 3301) + part(3513, 3541) + '\nthis.f={distanceKm,nearestSubstations}', cx);
  const subs = [
    { at: [-1.51, 52.01], kv: [33], name: 'Tiny 33kV' },
    { at: [-1.6, 52.0], kv: [132], name: 'A 132' },
    { at: [-1.5, 52.3], kv: [400, 132], name: 'B 400' },
    { at: [-1.45, 52.05], kv: [66], name: 'D 66' },
    { at: [-1.7, 52.1], kv: [33], name: 'E 33' },
    { at: [-2.5, 52.0], kv: [275], name: 'C 275' },
    { at: [-4.0, 55.0], kv: [400], name: 'Far 400' }];
  const x = boot({ feedFn: () => feed([flash(Date.now() - H, 'z', [-1.5, 52]), flash(Date.now() - H, 'sea', [-10.5, 50])]) });
  x.W.__GRIDATLAS_NEON_LINKS__ = { substations: subs, measure: { distanceKm: cx.f.distanceKm, nearestSubstations: cx.f.nearestSubstations } };
  x.toggle(true); await drain(); tapFlash(x);
  const card = x.mapEl.querySelector('[data-lightning-card]');
  x.camera.length = 0; dispatch(card.querySelector('[data-lightning-nearest]'), 'click', x.log.errors); assert.deepEqual(x.log.errors.map(String), []);
  const src = x.sources.get('gridatlas-lightning-nearest'), lines = src.data.features.filter(f => f.geometry.type === 'LineString');
  assert.equal(lines.length, 5, 'LINK_COUNT 5');
  assert.equal(JSON.stringify(lines[0].geometry.coordinates[1]), '[-1.51,52.01]', 'nearest is the 33 kV site');
  assert.ok(!lines.some(f => f.geometry.coordinates[1][0] === -2.5), 'C 275 is the 6th: not drawn');
  assert.match(card.textContent, /1\.33 km · 33 kV · Tiny 33kV/); assert.match(card.textContent, /Not evidence any asset was struck/);
  assert.ok(x.layers.get('gridatlas-lightning-nearest-origin'), 'origin ring');
  assert.equal(x.camera.length, 1); assert.equal(x.camera[0][0], 'fitBounds'); assert.equal(x.camera[0][1][1].maxZoom, 12);
  assert.equal(card.style.bottom, '8px', 'card docked at the foot of the map');
  dispatch(card.querySelector('button'), 'click', x.log.errors);
  for (const id of ['glow', 'core', 'node', 'label', 'origin']) assert.equal(x.layers.get('gridatlas-lightning-nearest-' + id), undefined, id + ' kept after close');
});

