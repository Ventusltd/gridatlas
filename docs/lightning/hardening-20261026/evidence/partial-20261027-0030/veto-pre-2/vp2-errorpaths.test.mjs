// veto-pre-2: error paths of the 202610262323 uk-lightning module with lightning OFF, under node:vm + minidom
// (harness: self-fixture, SYNTHETIC shell; no network, no browser). Faults are injected only into in-memory copies.
// Usage: node --test vp2-errorpaths.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { makeDocument, dispatch } from './minidom.mjs';

const WT = new URL('../../wt/', import.meta.url).pathname;
const MOD = readFileSync(WT + 'atlas/modules/202610262323-uk-lightning-overlay.js', 'utf8');
const CART = readFileSync(WT + 'atlas/cartridges/202610262323-sld-sandbox-v9-8.js', 'utf8');
const ORIG = readFileSync(WT + 'atlas/cartridges/202609241334-sld-sandbox-v9-8.js', 'utf8');
const once = (s, a, b) => { assert.equal(s.split(a).length, 2, 'inject anchor: ' + a.slice(0, 40)); return s.replace(a, b); };

function shell({ pipeline = true, menu = true, map = true } = {}) {
  const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
  const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
  const g = doc.createElement('div'); g.className = 'key-group'; host.appendChild(g);
  const engine = doc.createElement('input'); engine.setAttribute('type', 'checkbox'); engine.setAttribute('data-layer-id', 'l400'); g.appendChild(engine);
  const curtain = doc.createElement('div'); curtain.id = 'fs-curtain-keys'; body.appendChild(curtain);
  const log = { fetch: 0, xhr: 0, intervals: [], cleared: 0, observers: [], mapCalls: 0 };
  const mapObj = { addSource() { log.mapCalls++; }, addLayer() { log.mapCalls++; }, getSource() { return null; }, getLayer() { return null }, removeLayer() { log.mapCalls++; }, removeSource() { log.mapCalls++; }, setLayoutProperty() { log.mapCalls++; } };
  const W = { innerWidth: 1440, __GRIDATLAS_MODULES__: menu ? { menuBar: { installed: true } } : {}, __GRIDATLAS_PIPELINE_LAYERS__: pipeline ? { installed: true } : undefined, __GRIDATLAS_V9_MAP__: map ? mapObj : undefined };
  const sandbox = { window: W, document: doc, Date, Map, Promise, AbortController, setTimeout, clearTimeout, matchMedia: () => ({ matches: false }),
    fetch: () => { log.fetch++; return new Promise(() => { }); }, XMLHttpRequest: class { open() { } send() { log.xhr++; } },
    setInterval: (f, ms) => { log.intervals.push({ f, ms }); return log.intervals.length; }, clearInterval: () => { log.cleared++; },
    MutationObserver: class { constructor(cb) { this.cb = cb; log.observers.push(this); } observe() { this.on = true; } disconnect() { this.on = false; } } };
  return { doc, host, curtain, engine, log, W, sandbox };
}
const run = (src, s) => { let thrown = null; try { vm.runInNewContext(src, s.sandbox, { timeout: 5000 }); } catch (e) { thrown = e; } return thrown; };
const tick = (s, n) => { const p = s.log.intervals.find(i => i.ms === 250); for (let k = 0; k < n; k++) { p.f(); for (const o of s.log.observers) if (o.on) o.cb([]); } };
const groups = s => [s.host.querySelectorAll('[data-lightning-group]').length, s.curtain.querySelectorAll('[data-lightning-group]').length];

test('seam: candidate cartridge = live 202609241334 bytes + "\\n" + module; live tail ends with ";\\n" (no ASI call-merge)', () => {
  assert.equal(CART, ORIG + '\n' + MOD);
  assert.match(ORIG.slice(-8), /\}\)\(\);\n$/);
});

test('E1 load-time throw: statements before the module keep their effects; module leaves no DOM, timers or NS entry', () => {
  const s = shell();
  const faulty = 'window.__ORIGINAL_RAN__=1;\n' + once(MOD, "(()=>{'use strict';", "(()=>{'use strict';throw new Error('VP2 load fault');");
  const err = run(faulty, s);
  assert.match(String(err), /VP2 load fault/);
  assert.equal(s.W.__ORIGINAL_RAN__, 1);
  assert.equal(s.W.__GRIDATLAS_MODULES__.ukLightning, undefined);
  assert.deepEqual(groups(s), [0, 0]); assert.equal(s.log.intervals.length, 0); assert.equal(s.log.observers.length, 0);
});

test('E2 OFF invariants after install: no request, no map call, poll cleared, observer disconnected, no engine attributes', () => {
  const s = shell(); assert.equal(run(MOD, s), null); tick(s, 1);
  const L = s.W.__GRIDATLAS_MODULES__.ukLightning;
  assert.equal(L.state.installed, true); assert.deepEqual(groups(s), [1, 1]);
  assert.equal(s.log.fetch + s.log.xhr, 0); assert.equal(s.log.mapCalls, 0); assert.equal(s.log.cleared, 1); assert.equal(s.log.observers[0].on, false);
  for (const grp of [...s.host.querySelectorAll('[data-lightning-group]'), ...s.curtain.querySelectorAll('[data-lightning-group]')]) for (const a of ['data-layer-id', 'data-pn-layer', 'data-gridatlas-layer-proxy', 'data-gridatlas-layer-key']) assert.equal(grp.querySelectorAll('[' + a + ']').length + (grp.hasAttribute(a) ? 1 : 0), 0, a);
  assert.equal(s.host.children.at(-1).getAttribute('data-lightning-group'), 'main', 'appended last');
  // an ORIGINAL engine checkbox change bubbling through the shared host must not switch lightning on
  s.engine.checked = true; dispatch(s.engine, 'change', []);
  assert.equal(L.state.on, false); assert.equal(s.log.fetch + s.log.xhr, 0);
});

test('E3 Pipeline News never installs: lightning never installs, no DOM change, but its 250 ms poll and body observer run forever', () => {
  const s = shell({ pipeline: false }); run(MOD, s); tick(s, 2000);
  const L = s.W.__GRIDATLAS_MODULES__.ukLightning;
  assert.equal(L.state.installed, false); assert.equal(JSON.stringify(L.state.waiting_for), '["pipelineLayers"]');
  assert.deepEqual(groups(s), [0, 0]); assert.equal(s.log.cleared, 0, 'poll never cleared'); assert.equal(s.log.observers[0].on, true, 'observer never disconnected');
});

test('E4 install throws persistently before touching the DOM: no DOM change; state.errors grows by one per tick (unbounded)', () => {
  const s = shell(); run(once(MOD, "ins=()=>{if(S.installed)return true;", "ins=()=>{if(S.installed)return true;throw new Error('VP2 pre-DOM fault');"), s); tick(s, 1000);
  const L = s.W.__GRIDATLAS_MODULES__.ukLightning;
  assert.deepEqual(groups(s), [0, 0]);
  console.log('# E4 state.errors after 1000 poll+observer ticks:', L.state.errors.length);
  assert.ok(L.state.errors.length >= 1000);
});

test('E5 install throws AFTER appending (mid-install): ins() is not idempotent, every retry appends another Lightning group to the ORIGINAL Layers panel and curtain', () => {
  const s = shell(); run(once(MOD, 'pt(false);S.installed=true;return true};', "throw new Error('VP2 mid-install fault');pt(false);S.installed=true;return true};"), s); tick(s, 10);
  const [m, f] = groups(s);
  console.log(`# E5 lightning groups after 10 poll+observer ticks: #scada-ui-container=${m} #fs-curtain-keys=${f}`);
  assert.ok(m > 1, 'duplicates expected if non-idempotent');
});

test('E6 one-shot mid-install fault: the retry succeeds but leaves a duplicate orphan group in the original panel', () => {
  const s = shell(); run(once(MOD, 'pt(false);S.installed=true;return true};', "if(!window.__f){window.__f=1;throw new Error('VP2 one-shot')}pt(false);S.installed=true;return true};"), s); tick(s, 5);
  const L = s.W.__GRIDATLAS_MODULES__.ukLightning;
  console.log('# E6 installed', L.state.installed, 'groups', groups(s), 'sfs', L.state.sfs.length);
  assert.equal(L.state.installed, true);
  assert.deepEqual(groups(s), [2, 2]);
});
