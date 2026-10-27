// kv-spider probe: NODE only (node:vm + minidom.mjs). Replays the owner's 13:45 UTC view against the REAL
// lightning index/shards/feed at commit 2a49652 (the archive commit live at 13:45), then taps a real flash and
// presses NEAREST SUBSTATIONS against the REAL substation list and geodesy module of the original.
// Usage: MODULE=<overlay.js> node probe.mjs > probe-result.json
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const here = new URL('.', import.meta.url).pathname;
const H_ = await import('./harness-boot.mjs?' + Date.now()).catch(e => { throw e; });
const { boot, drain } = H_;
const LREPO = '/home/claude/lightning', COMMIT = process.env.COMMIT || '2a49652', FEEDC = process.env.FEEDC || '69468dd';
const NOW = Date.parse(process.env.NOW || '2026-10-27T13:45:00Z');
const git = p => execFileSync('git', ['-C', LREPO, 'show', p], { maxBuffer: 64e6 });
const idxBuf = git(`${COMMIT}:data/history/index.json`), idx = JSON.parse(idxBuf);
const files = {};
for (const r of idx.days) { for (const p of [r.path, ...(r.parts || []).map(x => x.path)].filter(Boolean)) files[p] = git(`${COMMIT}:data/history/${p}`); }
const feedObj = JSON.parse(git(`${FEEDC}:data/uk_lightning.geojson`));
const out = { commit: COMMIT, feed_commit: FEEDC, now: new Date(NOW).toISOString(), index_generated_utc: idx.generated_utc, next_update_due_utc: idx.next_update_due_utc, periods: {} };

for (const p of ['48h', '7d', '30d', '3m', '6m', '12m']) {
  const x = boot({ index: idxBuf.toString('utf8'), files, feedFn: () => feedObj, now: NOW });
  x.toggle(true); await drain(); x.click(x.chip(p)); await drain(); await drain();
  out.periods[p] = { label: x.label(), status: x.status(), flashes: x.cap('flashes'), refresh: x.cap('refresh'), warning: x.cap('warning'), drawn: x.S.res && x.S.res.ev.length, mode: x.S.res && x.S.res.mode, layer_features: (x.sources.get('gridatlas-lightning') || {}).data?.features?.length ?? 0 };
}

// ---- nearest: real substations (grid_substations.geojson, the list loadSubstations() publishes) + real geodesy
const W = '/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/wt/atlas';
const gctx = { window: {} }; vm.runInNewContext(readFileSync(`${W}/modules/202609011950-geodesy.js`, 'utf8'), gctx);
const distanceKm = gctx.window.__GRIDATLAS_MODULES__.geodesy.distanceKm;
// faithful copies of cartridge 202609241334 voltagesKv (l.3338) / representativePoint / loadSubstations (l.3477-3504)
const voltagesKv = pr => { const o = []; const push = (raw, d) => { for (const t of String(raw ?? '').split(/[;,|:\s]+/)) { if (!t) continue; const v = Number(t); if (!Number.isFinite(v) || v <= 0) continue; o.push(v / d); } }; push(pr?.voltage, 1000); if (!o.length) push(pr?.kv, 1); return o; };
const rep = g => { if (!g) return null; const { type, coordinates: c } = g; if (type === 'Point') return [c[0], c[1]]; const ring = type === 'Polygon' ? c[0] : type === 'MultiPolygon' ? c[0]?.[0] : null; if (!Array.isArray(ring) || !ring.length) return null; let a = 0, b = 0; for (const q of ring) { a += q[0]; b += q[1]; } return [a / ring.length, b / ring.length]; };
const gs = JSON.parse(readFileSync(`${W}/releases/202608300453-atlas-v9/data/grid_substations.geojson`, 'utf8'));
const subs = []; for (const f of gs.features) { const kv = voltagesKv(f.properties); if (!kv.length || Math.max(...kv) < 32.5) continue; const at = rep(f.geometry); if (!at) continue; subs.push({ at, kv: kv.filter(v => v >= 32.5).sort((a, b) => b - a), name: f.properties?.name || '', operator: f.properties?.operator || '' }); }
const engineNearest = (lon, lat) => subs.map(s => ({ ...s, km: distanceKm(lon, lat, s.at[0], s.at[1]) })).filter(s => s.km <= 40).sort((a, b) => a.km - b.km).slice(0, 5); // cartridge l.3509-3540
out.substations = { features: gs.features.length, qualifying_ge_33kv: subs.length, ge_132kv: subs.filter(s => s.kv[0] >= 132).length };

const x = boot({ index: idxBuf.toString('utf8'), files, feedFn: () => feedObj, now: NOW });
x.W.__GRIDATLAS_NEON_LINKS__ = { substations: subs, measure: { distanceKm } };
x.toggle(true); await drain(); x.click(x.chip('30d')); await drain(); await drain();
const ev = x.S.res.ev, wym = subs.find(s => /Wymondley/i.test(s.name));
let bi = 0, bd = Infinity; ev.forEach((f, i) => { const c = f.geometry.coordinates; const d = distanceKm(c[0], c[1], wym.at[0], wym.at[1]); const land = c[0] > -5.5 && c[1] < 55.8 && c[1] > 50.2; if (land && d < bd) { bd = d; bi = i; } });
const g = ev[bi], [lon, lat] = g.geometry.coordinates;
x.tapMap({ x: lon * 10, y: lat * 10 }, { 'l-gridatlas-lightning-hit': [{ properties: { i: bi }, geometry: g.geometry }] });
const card = x.mapEl.children.find(c => c.dataset && c.dataset.lightningCard !== undefined);
const btn = card && card.children.find(c => c.dataset && c.dataset.lightningNearest !== undefined);
const cam0 = x.camera.length; if (btn) x.click(btn); await drain();
const src = x.sources.get('gridatlas-lightning-nearest'), feats = src ? src.data.features : [];
const lines = feats.filter(f => f.geometry.type === 'LineString');
const mpp = z => 78271.517 * Math.cos(lat * Math.PI / 180) / 2 ** z; // MapLibre 512 px tiles
const flashR = z => z <= 5 ? 6 : z >= 11 ? 10 : z <= 8 ? 6 + (z - 5) * 2 / 3 : 8 + (z - 8) * 2 / 3;
out.nearest = {
  flash: { id_len: String(g.id).length, time: g.properties.time_utc, lon, lat },
  card_text: card ? card.out.children.map(c => c.textContent) : null,
  lightning_lines: lines.map(l => ({ to: l.geometry.coordinates[1] })),
  lightning_line_count: lines.length, layers_added: [...x.layers.keys()].filter(k => k.startsWith('gridatlas-lightning-nearest')),
  camera_calls_after_nearest: x.camera.length - cam0,
  engine_would_draw: engineNearest(lon, lat).map(s => `${s.km.toFixed(2)} km · ${s.kv[0]} kV · ${s.name || 'unnamed'}`),
  line_px_by_zoom: Object.fromEntries([6, 8, 10, 12].map(z => [z, { flash_radius_px: +flashR(z).toFixed(1), lightning_lines_px: lines.map(l => { const [a, b] = l.geometry.coordinates; return +(distanceKm(a[0], a[1], b[0], b[1]) * 1000 / mpp(z)).toFixed(1); }) }])),
  errors: x.S.errors
};
console.log(JSON.stringify(out, null, 1));
