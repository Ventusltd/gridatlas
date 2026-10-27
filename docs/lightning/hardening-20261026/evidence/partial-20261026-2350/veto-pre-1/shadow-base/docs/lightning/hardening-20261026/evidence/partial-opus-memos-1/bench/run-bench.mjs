#!/usr/bin/env node
// run-bench.mjs (opus-memos-1, issue #32 §10, design-only evidence for think/memos/rendering-performance.md)
// Harness: self-fixture. Headless Chromium (Playwright, /opt/pw-browsers), MapLibre GL JS 3.6.2 from the vendored tarball
// (scratchpad/lightning/cdn-cache), background-only style (no tiles/glyphs: BLOCKED_DEPENDENCY, not needed here).
// CPU throttle via CDP applies to the renderer main thread only, NOT to the GPU process: WebGL raster runs on SwiftShader
// (software) at full sandbox speed, so GL draw times are indicative only; decode/bin/JSON/MapLibre-worker costs are the signal.
// DATA ARE SYNTHETIC (status SYNTHETIC_BENCHMARK_NOT_OBSERVATIONS): clustered points in the collector box, time-sorted.
// Usage: node run-bench.mjs <throttle> <dpr> <scenario,...>   scenarios: A10k,B100k,C1m,D100kjson,E1mgrid,F10kgeojson,F40kgeojson
import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/cdn-cache/maplibre-gl-3.6.2/package/dist';
const throttle = Number(process.argv[2] || 4), dpr = Number(process.argv[3] || 3);
const scen = (process.argv[4] || 'A10k,B100k,C1m,D100kjson,E1mgrid,F10kgeojson').split(',');

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const T0 = Date.UTC(2025, 9, 27) / 1000;
function synth(n, seed = 11) {   // storm cells: heavy-tailed size, 1-4 h life, drift, ~8 km scatter; 365 days
  const r = rng(seed), g = () => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const lon = new Float64Array(n), lat = new Float64Array(n), t = new Uint32Array(n); let i = 0;
  while (i < n) { const cellN = Math.min(n - i, Math.max(20, Math.floor(150 / Math.pow(r() + 0.01, 1.3))));
    const lo0 = -11 + 14 * r(), la0 = 49.5 + 12 * r(), c = Math.cos(la0 * Math.PI / 180), dur = 3600 * (1 + 3 * r());
    const ts = Math.floor(r() * 365) * 86400 + Math.floor(r() * 86400), dir = 2 * Math.PI * r(), v = 40 / 3600 / 111; let made = 0, tries = 0;
    while (made < cellN && tries++ < cellN * 4) { const dt = r() * dur, la = la0 + Math.sin(dir) * v * dt + g() * 0.072, lo = lo0 + (Math.cos(dir) * v * dt + g() * 0.072) / c;
      if (lo < -11 || lo > 3 || la < 49.5 || la > 61.5) continue; lon[i] = lo; lat[i] = la; t[i] = Math.floor(ts + dt); i++; made++; }
    if (!made) { lon[i] = lo0; lat[i] = la0; t[i] = ts; i++; } }
  const idx = Array.from({ length: n }, (_, k) => k).sort((a, b) => t[a] - t[b]);
  return { lon: idx.map(k => lon[k]), lat: idx.map(k => lat[k]), t: idx.map(k => t[k]) };
}
function lfb1(d) {               // 32-byte header | u32 offsets[145] | u16 x[n] | u16 y[n] | (pad to 4) | u32 t[n]
  const n = d.t.length, xOff = 32 + 580, yOff = xOff + 2 * n, tOff0 = yOff + 2 * n, tOff = tOff0 + (tOff0 % 4 ? 4 - tOff0 % 4 : 0);
  const buf = Buffer.alloc(tOff + 4 * n), dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  dv.setUint32(0, 0x3142464c, true); dv.setUint16(4, 1, true); dv.setUint32(8, n, true); dv.setUint32(12, T0, true); dv.setUint32(16, 1000, true); // unit: s
  for (let i = 0; i <= 144; i++) dv.setUint32(32 + 4 * i, Math.floor(i * n / 144), true);
  for (let i = 0; i < n; i++) { dv.setUint16(xOff + 2 * i, Math.round((d.lon[i] + 11) / 14 * 65535), true); dv.setUint16(yOff + 2 * i, Math.round((d.lat[i] - 49.5) / 12 * 65535), true);
    dv.setUint32(tOff + 4 * i, d.t[i], true); }
  return buf;
}
function leanJSON(d) { const f = []; for (let i = 0; i < d.t.length; i++) f.push(`{"type":"Feature","id":"${1000 + (i >> 8)}:${i & 255}","geometry":{"type":"Point","coordinates":[${d.lon[i].toFixed(4)},${d.lat[i].toFixed(4)}]},"properties":{"t":${T0 + d.t[i]}}}`);
  return Buffer.from(`{"type":"FeatureCollection","metadata":{"status":"SYNTHETIC_BENCHMARK_NOT_OBSERVATIONS"},"features":[${f.join(',')}]}`); }

const files = {}; const sizes = {};
const need = (k, fn) => { if (!files[k]) { files[k] = fn(); sizes[k] = { raw: files[k].length, gzip: zlib.gzipSync(files[k], { level: 6 }).length }; } };
const D = {}; const data = (n) => (D[n] ||= synth(n));
for (const s of scen) {
  if (s === 'A10k') need('p10k.lfb', () => lfb1(data(10000)));
  if (s === 'B100k' || s === 'D100kjson') { need('p100k.lfb', () => lfb1(data(100000))); }
  if (s === 'D100kjson') need('p100k.json', () => leanJSON(data(100000)));
  if (s === 'C1m' || s === 'E1mgrid') need('p1m.lfb', () => lfb1(data(1000000)));
  if (s === 'F10kgeojson') need('p10k.json', () => leanJSON(data(10000)));
  if (s === 'F40kgeojson') need('p40k.json', () => leanJSON(data(40000)));
}
const serve = { '/bench.html': [fs.readFileSync(path.join(HERE, 'bench.html')), 'text/html'], '/maplibre-gl.js': [fs.readFileSync(path.join(DIST, 'maplibre-gl.js')), 'application/javascript'],
  '/maplibre-gl.css': [fs.readFileSync(path.join(DIST, 'maplibre-gl.css')), 'text/css'] };
for (const [k, v] of Object.entries(files)) serve['/' + k] = [v, k.endsWith('.json') ? 'application/json' : 'application/octet-stream'];

const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const result = { harness: 'self-fixture; headless Chromium ' + browser.version() + ' via Playwright; MapLibre 3.6.2 vendored; background-only style', cpu_throttle: throttle,
  viewport: `393x852@${dpr}`, data: 'SYNTHETIC_BENCHMARK_NOT_OBSERVATIONS', file_sizes: sizes, runs: [] };
async function page() {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.setDefaultTimeout(600000);
  await p.route('http://bench.local/**', r => { const u = new URL(r.request().url()); const f = serve[u.pathname]; return f ? r.fulfill({ status: 200, body: f[0], contentType: f[1] }) : r.fulfill({ status: 404, body: '' }); });
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  p.on('pageerror', e => console.error('pageerror', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  await p.goto('http://bench.local/bench.html'); const init = await p.evaluate(() => B.init()); return { ctx, p, init };
}
for (const s of scen) {
  const { ctx, p, init } = await page(); const run = { scenario: s, init, loadavg_before: (await import('node:os')).loadavg().map(x => +x.toFixed(1)) }; const t0 = Date.now();
  try {
    if (s === 'A10k' || s === 'B100k' || s === 'C1m') {
      const f = s === 'A10k' ? 'p10k.lfb' : s === 'B100k' ? 'p100k.lfb' : 'p1m.lfb';
      run.decode = await p.evaluate(u => B.decodeBinary(u), '/' + f);
      run.add = await p.evaluate(() => B.addPoints(2));
      run.frames = await p.evaluate(k => B.frames(k), s === 'C1m' ? 6 : 10);
      if (s === 'B100k') { run.windows = [];
        for (const [label, days] of [['24h', 1], ['7d', 7], ['30d', 30], ['365d', 365]]) {
          const w = await p.evaluate(([a, b]) => B.setWindow(a, b), [200 * 86400 - days * 86400, 200 * 86400]);
          w.frames = await p.evaluate(() => B.frames(3)); run.windows.push({ label, ...w }); } }
    } else if (s === 'D100kjson') {
      run.json = await p.evaluate(u => B.decodeLeanJSON(u), '/p100k.json');
      run.binary_same_n = await p.evaluate(u => B.decodeBinary(u), '/p100k.lfb');
    } else if (s === 'E1mgrid') {
      run.decode = await p.evaluate(u => B.decodeBinary(u), '/p1m.lfb');
      run.bin = await p.evaluate(() => B.binGrid(0.15, 0.09));            // ~10 x 10 km cells at 54 N, about one LI footprint
      run.add = await p.evaluate(() => B.addGrid());
      run.frames = await p.evaluate(() => B.frames(10, 'grid'));
    } else if (s === 'F10kgeojson' || s === 'F40kgeojson') {
      run.geojson = await p.evaluate(u => B.geojsonCircles(u), s === 'F10kgeojson' ? '/p10k.json' : '/p40k.json');
    }
  } catch (e) { run.error = String(e && e.message || e); }
  run.loadavg_after = (await import('node:os')).loadavg().map(x => +x.toFixed(1)); run.cores = (await import('node:os')).cpus().length;
  run.wall_s = +((Date.now() - t0) / 1000).toFixed(1); result.runs.push(run); console.error(s, 'done', run.wall_s + 's'); await ctx.close();
}
await browser.close();
const out = path.join(HERE, `bench-cpu${throttle}x-dpr${dpr}.json`); fs.writeFileSync(out, JSON.stringify(result, null, 1)); console.log(out);
