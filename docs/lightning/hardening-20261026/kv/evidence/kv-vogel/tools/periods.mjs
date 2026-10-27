#!/usr/bin/env node
// Complaint A, keyed: run the deployed module under node:vm against the real lightning archive at a pinned commit.
// Usage: node periods.mjs <module.js> <lightning-commit> <nowISO>   (reads /home/claude/lightning via git show; writes nothing there)
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { webcrypto, createHash } from 'node:crypto';
import { makeDocument, dispatch } from '../../opus-fix-designer/minidom.mjs';
const [MOD, COMMIT, NOW] = process.argv.slice(2);
const git = p => execFileSync('git', ['-C', '/home/claude/lightning', 'show', `${COMMIT}:${p}`], { maxBuffer: 1 << 28 });
const index = git('data/history/index.json'), feedRaw = git('data/uk_lightning.geojson').toString();
const now = Date.parse(NOW);
const doc = makeDocument(), body = doc.createElement('body'); doc.documentElement.appendChild(body);
const host = doc.createElement('div'); host.id = 'scada-ui-container'; body.appendChild(host);
const kg = doc.createElement('div'); kg.className = 'key-group'; host.appendChild(kg);
const mapEl = doc.createElement('div'); body.appendChild(mapEl);
const sources = new Map(), layers = new Map();
const map = { getLayer: id => layers.get(id), getSource: id => sources.get(id), addSource: (id, o) => sources.set(id, { ...o, setData(x) { this.data = x; } }), addLayer: x => layers.set(x.id, x),
  removeLayer: id => layers.delete(id), removeSource: id => sources.delete(id), setLayoutProperty() {}, getContainer: () => mapEl, project: () => ({ x: 0, y: 0 }), on() {}, getStyle: () => ({ layers: [] }),
  getBounds: () => ({ contains: () => true }) };
const fetchLog = [];
const fetch = async url => { fetchLog.push(url); const k = url.split('?')[0].split('/data/history/')[1];
  if (k === 'index.json') return new Response(index, { status: 200 });
  try { return new Response(git('data/history/' + k), { status: 200 }); } catch (_) { return new Response('nope', { status: 404 }); } };
class XHR { open(m, u) { this.url = u; } send() { setTimeout(() => { this.status = 200; this.responseURL = this.url; this.responseText = feedRaw; this.onload(); }, 0); } }
class D extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } }
const W = { __GRIDATLAS_V9_MAP__: map, innerWidth: 393, innerHeight: 852, crypto: webcrypto, __GRIDATLAS_MODULES__: { menuBar: { installed: true } }, __GRIDATLAS_PIPELINE_LAYERS__: { installed: true }, addEventListener() {} };
const sandbox = { window: W, document: doc, Date: D, AbortController, Map, XMLHttpRequest: XHR, fetch, Response, TextDecoder, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
  matchMedia: () => ({ matches: true }), MutationObserver: class { observe() {} disconnect() {} }, innerHeight: 852, addEventListener() {} };
const SRC = readFileSync(MOD, 'utf8');
vm.runInNewContext(SRC, sandbox, { filename: MOD });
const api = W.__GRIDATLAS_MODULES__.ukLightning; if (!api.install()) throw new Error('install refused: ' + api.state.waiting_for);
const sf = api.state.sfs[0], errs = [];
const drain = async () => { for (let k = 0; k < 60; k++) { await new Promise(r => setImmediate(r)); await new Promise(r => setTimeout(r, 1)); } };
sf.toggle.checked = true; dispatch(sf.toggle, 'change', errs); await drain();
const rows = [];
for (const p of ['48h', '7d', '30d', '3m', '6m', '12m']) {
  dispatch(sf.chips[p], 'click', errs); await drain();
  const r = api.state.res, c = r.cov;
  rows.push({ period: p, label: sf.label.textContent, status: sf.stx.textContent, flashes: sf.caps.flashes.textContent, searched: sf.caps.searched.textContent,
    mode: r.mode, drawn: (sources.get('gridatlas-lightning')?.data.features || []).length, window_days: c ? c.d : null, unscanned_dates: c ? c.u.length : null,
    searched_days: c ? c.d - c.u.length - c.l : null, searched_fraction: c ? +c.f.toFixed(4) : null });
}
console.log(JSON.stringify({ module_sha256: createHash('sha256').update(SRC).digest('hex'), lightning_commit: COMMIT, now: NOW, index_sha256: createHash('sha256').update(index).digest('hex'), errors: errs.map(String), rows }, null, 1));
