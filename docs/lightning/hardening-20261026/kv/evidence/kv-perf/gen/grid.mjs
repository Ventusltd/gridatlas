// grid.mjs: per-day x grid-cell summary byte cost from an archive dir (reads every day file listed in index).
import { readFileSync } from 'node:fs'; import { gzipSync } from 'node:zlib';
const A = process.argv[2], x = JSON.parse(readFileSync(A + '/index.json'));
for (const deg of [0.25, 0.1]) {
  const cols = Math.round(14 / deg), days = {}; let pairs = 0, flashes = 0;
  for (const r of x.days) { if (!r.count) continue; const files = r.path ? [r.path] : r.parts.map(p => p.path), m = new Map();
    for (const f of files) for (const ft of JSON.parse(readFileSync(A + '/' + f)).features) { const [lo, la] = ft.geometry.coordinates;
      const c = Math.min(Math.floor((la - 49.5) / deg), Math.round(12 / deg) - 1) * cols + Math.min(Math.floor((lo + 11) / deg), cols - 1); m.set(c, (m.get(c) || 0) + 1); flashes++; }
    days[r.date] = [...m].sort((a, b) => a[0] - b[0]).flat(); pairs += m.size; }
  const s = JSON.stringify({ schema: 'uk-lightning-grid-day.v1', cell_deg: deg, origin: [-11, 49.5], cols, observation: 'satellite optical lightning flashes, not ground strikes', days });
  console.log(JSON.stringify({ arch: A.split('/').pop(), deg, daysWithFlashes: Object.keys(days).length, pairs, flashes, bytes: s.length, gzip: gzipSync(s).length }));
}
