import { readFileSync, writeFileSync } from 'node:fs';
const S = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const out = {};
out.total = S.length; out.errors = S.filter(s => s.errors.length || s.unhandled.length || s.harness_error).map(s => [s.id, s.errors, s.unhandled]);
out.drawn_ne_truth = S.filter(s => s.mode === 'detail' && s.drawn !== s.truth).map(s => s.id);
out.feed_drawn_ne_feedtruth = S.filter(s => s.mode === 'feed' && s.drawn !== s.truthFeed).map(s => s.id);
// equivalence classes: (archive, paging, fresh, device) -> group periods with identical (drawn, window-independent label count)
const cls = {};
for (const s of S.filter(s => s.tap === 'none')) { const k = `${s.archive}|p${s.paging}|${s.fresh ? 'fresh' : 'stale'}|${s.device}`; (cls[k] = cls[k] || {}); const c = String(s.drawn) + ' ' + (s.label.match(/\[(.*?)[ |·]/) || [])[1]; (cls[k][c] = cls[k][c] || []).push(s.period); }
out.identical_count_classes = Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([, p]) => p.length > 1))]));
// device and freshness invariance
const key = (s, drop) => ['period', 'paging', 'archive', 'fresh', 'device', 'tap'].filter(k => k !== drop).map(k => s[k]).join('|');
for (const dim of ['device', 'fresh']) { const m = {}; for (const s of S) (m[key(s, dim)] = m[key(s, dim)] || []).push(s); out[dim + '_changes_drawn'] = Object.values(m).filter(g => new Set(g.map(s => s.drawn)).size > 1).length; out[dim + '_changes_label_beyond_STALE'] = Object.values(m).filter(g => new Set(g.map(s => s.label.replace(' STALE', ''))).size > 1).map(g => g[0].id).slice(0, 5); }
out.stale_shown = {}; for (const s of S.filter(s => s.tap === 'none' && s.paging === 0)) { const k = `${s.archive}|${s.fresh ? 'fresh' : 'stale'}`; out.stale_shown[k] = out.stale_shown[k] || { yes: 0, no: 0 }; out.stale_shown[k][/STALE/.test(s.label) ? 'yes' : 'no']++; }
out.roundtrip_fail = S.filter(s => s.pagesTaken > 0).filter(s => { const z = S.find(t => t.id === s.id.replace(/\|p\d\|/, '|p0|')); return z.label !== s.label_after_next; }).map(s => s.id + ' => ' + s.label_after_next);
out.paging_blocked = S.filter(s => s.tap === 'none' && s.pagesTaken < s.paging).map(s => `${s.id} took ${s.pagesTaken}`);
out.no_flash_to_tap = [...new Set(S.filter(s => s.tap_result).map(s => `${s.archive}|${s.period}|p${s.paging}`))];
const n = S.filter(s => s.tap === 'nearest' && s.card);
out.nearest = { stars: n.length, lines_added: [...new Set(n.map(s => s.lines_added))], camera_moves_after_nearest: [...new Set(n.map(s => s.camera_after_nearest))], retap: [...new Set(n.map(s => s.lines_after_retap))],
  over40km: n.filter(s => s.nearest_text.slice(2).some(t => parseFloat(t) > 40)).length,
  lightning_has_33kV: n.filter(s => s.nearest_text.some(t => / 33 kV/.test(t))).length, engine_has_33kV: n.filter(s => s.engine_would_draw.some(t => / 33 kV/.test(t))).length,
  engine_draws_nothing_within_40km: n.filter(s => !s.engine_would_draw.length).length,
  same_first_as_engine: n.filter(s => s.engine_would_draw[0] && s.nearest_text[2] && s.engine_would_draw[0] === s.nearest_text[2]).length };
out.flash_id_len = [...new Set(S.filter(s => s.tap_target).map(s => s.tap_target.id_len))];
writeFileSync(process.argv[3], JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1).slice(0, 9000));
