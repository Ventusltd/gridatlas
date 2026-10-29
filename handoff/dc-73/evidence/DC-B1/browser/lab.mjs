import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { installOfflineShim, waitForComposition } from '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs';
const ROOT = new URL('../serve/', import.meta.url).pathname, G = fs.readFileSync(new URL('../out/G', import.meta.url), 'utf8').trim();
const TY = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.geojson': 'application/geo+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
const SRV = await new Promise(res => { const s = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); r.writeHead(200, { 'content-type': TY[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); } catch { r.writeHead(404); r.end(); } }); s.listen(8472, '127.0.0.1', () => res(s)); });
const b = await chromium.launch({ headless: true }), p = await (await b.newContext({ viewport: { width: 393, height: 852 } })).newPage();
await installOfflineShim(p, { lightningDataDir: '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/R-taps/lt/data' });
await p.goto(`http://127.0.0.1:8472/wt/atlas/v/${G}/`); await waitForComposition(p, { deadlineMs: 90000, settleMs: 3000 });
const out = await p.evaluate(() => { const m = window.__GRIDATLAS_V9_MAP__, E = []; m.on('error', e => E.push(String(e.error && e.error.message || e)));
  m.addSource('t-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 's0', l: 'x', k: 0, s: 's' }, geometry: { type: 'Point', coordinates: [0, 51] } }] } });
  let font; for (const l of m.getStyle().layers) { const f = l.type === 'symbol' && l.layout && l.layout['text-font']; if (Array.isArray(f) && f.length && typeof f[0] === 'string') { font = f; break; } }
  const base = { 'text-field': ['get', 'l'], 'text-size': 10, 'text-font': font || ['Open Sans Regular'] }, R = {};
  const tryL = (n, layout, filter) => { const n0 = E.length; try { m.addLayer({ id: 't-' + n, type: 'symbol', source: 't-src', ...(filter ? { filter } : {}), layout: { ...base, ...layout } }); } catch (e) { E.push('throw ' + e.message); } R[n] = { ok: !!m.getLayer('t-' + n), err: E.slice(n0) }; };
  tryL('plain', {}); tryL('emptyIn', {}, ['in', ['get', 'id'], ['literal', []]]); tryL('in', {}, ['in', ['get', 'id'], ['literal', ['s0']]]); tryL('sortkey', { 'symbol-sort-key': ['get', 'k'] }); tryL('overlap', { 'text-allow-overlap': false }); tryL('offset', { 'text-offset': [0, 1], 'text-anchor': 'top' });
  return { font, R, ver: window.maplibregl && window.maplibregl.getVersion && window.maplibregl.getVersion() }; });
console.log(JSON.stringify(out, null, 1)); await b.close(); SRV.close();
