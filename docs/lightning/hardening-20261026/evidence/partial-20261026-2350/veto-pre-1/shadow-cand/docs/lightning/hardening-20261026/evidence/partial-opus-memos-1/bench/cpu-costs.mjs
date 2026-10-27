#!/usr/bin/env node
// cpu-costs.mjs (opus-memos-1) - CPU time (process.cpuUsage: user+system of this single-threaded process), not wall time,
// so the result is robust to the other agents' load on this 2-core sandbox (load average ~14 during the run).
// Same V8 family as Chromium's main thread; a phone proxy multiplies by ~4 (the budget lane's CPU throttle convention).
// DATA ARE SYNTHETIC (SYNTHETIC_BENCHMARK_NOT_OBSERVATIONS). Usage: node cpu-costs.mjs > cpu-costs.json
import os from 'node:os';
const cpu = (fn, reps = 5) => { const xs = []; let r; for (let i = 0; i < reps; i++) { const a = process.cpuUsage(); r = fn(); const b = process.cpuUsage(a); xs.push((b.user + b.system) / 1000); }
  xs.sort((p, q) => p - q); return { cpu_ms_median: +xs[Math.floor(xs.length / 2)].toFixed(1), cpu_ms_min: +xs[0].toFixed(1), result: r }; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function synth(n) { const r = rng(5), lon = new Float64Array(n), lat = new Float64Array(n), t = new Uint32Array(n);
  for (let i = 0; i < n; i++) { lon[i] = -11 + 14 * r(); lat[i] = 49.5 + 12 * r(); t[i] = Math.floor(i * 31536000 / n); } return { lon, lat, t }; }
function lfb1(d) { const n = d.t.length, buf = new ArrayBuffer(32 + 580 + 8 * n), dv = new DataView(buf);
  dv.setUint32(0, 0x3142464c, true); dv.setUint32(8, n, true); for (let i = 0; i <= 144; i++) dv.setUint32(32 + 4 * i, Math.floor(i * n / 144), true);
  const x = new Uint16Array(buf, 612, n), y = new Uint16Array(buf, 612 + 2 * n, n), t = new Uint32Array(buf, 612 + 4 * n, n);
  for (let i = 0; i < n; i++) { x[i] = Math.round((d.lon[i] + 11) / 14 * 65535); y[i] = Math.round((d.lat[i] - 49.5) / 12 * 65535); t[i] = d.t[i]; } return buf; }
function lean(d, n) { const f = []; for (let i = 0; i < n; i++) f.push(`{"type":"Feature","id":"${1000 + (i >> 8)}:${i & 255}","geometry":{"type":"Point","coordinates":[${d.lon[i].toFixed(4)},${d.lat[i].toFixed(4)}]},"properties":{"t":${1761523200 + d.t[i]}}}`);
  return `{"type":"FeatureCollection","features":[${f.join(',')}]}`; }
const out = { harness: 'self-fixture, node ' + process.version + ', CPU time via process.cpuUsage', cores: os.cpus().length, loadavg: os.loadavg().map(x => +x.toFixed(1)),
  data: 'SYNTHETIC_BENCHMARK_NOT_OBSERVATIONS', results: {} };
for (const n of [100000, 1000000]) {
  const d = synth(n), buf = lfb1(d), R = out.results[n] = { lfb1_bytes: buf.byteLength };
  // binary: views + the validation a consumer must run on untrusted bytes (offsets monotone, count matches, time sorted)
  R.binary_views_and_validate = cpu(() => { const dv = new DataView(buf), m = dv.getUint32(8, true); const offs = new Uint32Array(buf, 32, 145), t = new Uint32Array(buf, 612 + 4 * m, m);
    let ok = offs[144] === m; for (let i = 1; i < 145; i++) ok = ok && offs[i] >= offs[i - 1]; for (let i = 1; i < m; i++) if (t[i] < t[i - 1]) { ok = false; break; } return ok; });
  // interleave x,y for one GPU buffer (avoidable if the shard stores x,y interleaved)
  R.interleave_xy = cpu(() => { const x = new Uint16Array(buf, 612, n), y = new Uint16Array(buf, 612 + 2 * n, n), xy = new Uint16Array(2 * n);
    for (let i = 0; i < n; i++) { xy[2 * i] = x[i]; xy[2 * i + 1] = y[i]; } return xy.length; });
  // LOD: bin into ~10 x 10 km cells (0.15 x 0.09 deg; about one LI footprint at 54 N): 94 x 134 cells
  R.bin_grid_10km = cpu(() => { const x = new Uint16Array(buf, 612, n), y = new Uint16Array(buf, 612 + 2 * n, n), nx = 94, ny = 134, c = new Uint32Array(nx * ny), sx = 14 / 65535 / 0.15, sy = 12 / 65535 / 0.09;
    for (let i = 0; i < n; i++) { const gx = Math.min(nx - 1, (x[i] * sx) | 0), gy = Math.min(ny - 1, (y[i] * sy) | 0); c[gy * nx + gx]++; } return c.length; });
  // Kuiper keys for every flash (memo 1): slot from offsets, rank within slot, key = slot*65536 + rank; then KuiperLaw.keyPlace
  R.kuiper_keys_and_place = cpu(() => { const offs = new Uint32Array(buf, 32, 145), P = new Float32Array(2 * n); const G32 = 2654435769;
    for (let s = 0; s < 144; s++) for (let i = offs[s]; i < offs[s + 1]; i++) { const k = s * 65536 + (i - offs[s]); const m = Math.imul((k % 4294967296) >>> 0, G32) >>> 0, th = 2 * Math.PI * m / 4294967296, r = Math.sqrt(k + 0.5);
      P[2 * i] = r * Math.cos(th); P[2 * i + 1] = r * Math.sin(th); } return P.length; });
  if (n === 100000) { const txt = lean(d, n); R.lean_json_bytes = txt.length; R.lean_json_parse = cpu(() => JSON.parse(txt).features.length, 3);
    R.lean_json_parse_then_typed = cpu(() => { const fc = JSON.parse(txt), m = fc.features.length, x = new Uint16Array(m), y = new Uint16Array(m);
      for (let i = 0; i < m; i++) { const c = fc.features[i].geometry.coordinates; x[i] = Math.round((c[0] + 11) / 14 * 65535); y[i] = Math.round((c[1] - 49.5) / 12 * 65535); } return m; }, 3); }
}
out.loadavg_end = os.loadavg().map(x => +x.toFixed(1));
console.log(JSON.stringify(out, null, 1));
