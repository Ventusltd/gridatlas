/** Exercises real inherited/patched functions; VM evaluates only pinned local test inputs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { applyEdits, buildSubstation } from './build.mjs';

const base = fs.readFileSync(new URL('../../atlas/cartridges/202609062358-substation-intelligence-v9-63.js', import.meta.url), 'utf8');
const edits = JSON.parse(fs.readFileSync(new URL('./src/map-removal-edits.json', import.meta.url)));
const patched = applyEdits(base, edits);
const extract = (source, name) => {
  source = source.slice(source.indexOf(" * Module: pipeline-news-layers"));
  const start = source.indexOf('  function ' + name + '(') >= 0
    ? source.indexOf('  function ' + name + '(') : source.indexOf('  async function ' + name + '(');
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
};
function fixture(source = patched, { waiting = false } = {}) {
  const callbacks = [], removed = [], clears = [], accesses = [], changes = [];
  let destroyed = false, resolveWait;
  const map = {
    addSource() {}, on(event, fn) { assert.equal(event, 'remove'); removed.push(fn); },
    getLayer(id) { accesses.push(id); if (destroyed) throw Error('style already destroyed'); return {}; },
    setLayoutProperty() { accesses.push('layout'); }
  };
  const box = { checked: true };
  const state = { installed: false, selection: { lon: 0, lat: 51 }, counts: {}, active: ['a'] };
  let selection = state.selection;
  const c = { map, window: { __GRIDATLAS_V9_MAP__: map }, state, removedMaps: new WeakSet(), installedMap: null,
    register: waiting ? null : [{ name: 'live' }], REGISTER_SOURCE: 'src-repd', CONTROLS: [{ id: 'a', keep: () => true }],
    document: { getElementById(id) { return id === 'scada-ui-container' ? { querySelector: () => true } : null; },
      querySelector: () => box, querySelectorAll: () => [] },
    buildGroup() {}, bind() {}, readSelection() { accesses.push('selection'); return destroyed ? null : selection; },
    readRegisterSource() { accesses.push('register'); if (destroyed) throw Error('style already destroyed'); return null; },
    primeRegister: () => true, near: rows => rows, collection: rows => rows,
    ensureLayers() { accesses.push('ensureLayers'); return { sourceId: 'pn' }; },
    setSourceData() { accesses.push('setData'); }, paintLabels() { changes.push('labels'); }, note() {},
    setInterval(fn) { callbacks.push(fn); return callbacks.length; }, clearInterval(id) { clears.push(id); },
    setTimeout(resolve) { resolveWait = resolve; }
  };
  vm.createContext(c);
  vm.runInContext(['setVisibility', 'loadRegister', 'refresh', 'install'].map(name => extract(source, name)).join('\n'), c);
  c.install();
  return { c, map, callbacks, removed, clears, accesses, changes, state,
    remove() { destroyed = true; for (const fn of removed) fn(); },
    clearSelection() { selection = null; }, resolveWait() { resolveWait(); } };
}

test('successor recipe is exact-once, compiles, and refuses unknown generations/double application', () => {
  assert.ok(!base.includes('const removedMaps = new WeakSet()'));
  assert.throws(() => applyEdits(patched, edits), /missing/);
  assert.throws(() => applyEdits(base + edits[0].before, edits), /ambiguous/);
  assert.throws(() => buildSubstation('not-registered'), /No Pipeline/);
  new vm.Script(buildSubstation('202611180026').toString('utf8'));
  assert.equal(buildSubstation('202611180026').toString('utf8'), patched);
});

test('real baseline poll reproduces inherited destroyed-style failure', () => {
  const f = fixture(base);
  f.callbacks[0]();
  f.remove();
  assert.throws(() => f.callbacks[0](), /style already destroyed/);
  assert.equal(f.clears.length, 0);
});

test('remove clears captured poll; even an already queued callback never reads destroyed style', () => {
  const f = fixture(); f.remove(); f.accesses.length = 0; f.changes.length = 0;
  f.callbacks[0]();
  assert.deepEqual(f.clears, [1]);
  assert.deepEqual(f.accesses, []); assert.deepEqual(f.changes, []);
  assert.equal(f.state.installed, false); assert.equal(f.state.selection, null);
  assert.equal(f.c.install(), false);
});

test('live poll and refresh retain layer updates', async () => {
  const f = fixture(); f.callbacks[0]();
  assert.ok(f.accesses.includes('selection'));
  await f.c.refresh(f.map, f.c.CONTROLS[0]);
  assert.ok(f.accesses.includes('ensureLayers')); assert.ok(f.accesses.includes('setData'));
});

test('removal during register hydration exits without another source/style read', async () => {
  const f = fixture(patched, { waiting: true });
  const pending = f.c.refresh(f.map, f.c.CONTROLS[0]);
  f.remove(); f.accesses.length = 0; f.changes.length = 0;
  f.resolveWait(); await pending;
  assert.deepEqual(f.accesses, []); assert.deepEqual(f.changes, []);
});

test('removal after resolved register but before refresh continuation prevents layer writes', async () => {
  const f = fixture(); const pending = f.c.refresh(f.map, f.c.CONTROLS[0]);
  f.remove(); f.accesses.length = 0; await pending;
  assert.deepEqual(f.accesses, []);
});

test('old map removal and in-flight refresh cannot clear newer installed map state', async () => {
  const f = fixture(); const pending = f.c.refresh(f.map, f.c.CONTROLS[0]);
  const newer = {}; f.c.installedMap = newer;
  const selection = f.state.selection, counts = f.state.counts, active = f.state.active;
  f.remove(); f.callbacks[0](); await pending;
  assert.equal(f.c.installedMap, newer); assert.equal(f.state.installed, true);
  assert.equal(f.state.selection, selection); assert.equal(f.state.counts, counts);
  assert.equal(f.state.active, active); assert.deepEqual(f.clears, [1]);
});
