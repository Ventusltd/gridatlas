// kuiper-lightning-keys.mjs  (opus-memos-1, issue #32 §10, design-only evidence; harness: self-fixture, Node, no browser)
// Reads the GENUINE 408-flash feed and the Kuiper law VERBATIM (kuiper-law.js, unmodified, loaded by path).
// Tests candidate lightning keys: bijectivity, geo-blindness, stability under partial-slot completion,
// float32 shader precision, stride-sampling fairness, angular artefacts; and measures See Through's own stride.
// Usage: node kuiper-lightning-keys.mjs > kuiper-lightning-keys.out.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const LAW = require('/home/claude/ventusltd/kuiper-belt/see-through/202610050609/kuiper-law.js');
const FEED = '/home/claude/lightning/data/uk_lightning.geojson';
const WAFER = '/home/claude/ventusltd/kuiper-belt/cosmos/wafer.tsv';
const out = { harness: 'self-fixture, node ' + process.version + ', kuiper-law.js unmodified (' + LAW.source + ')', feed: FEED };

// ---------------------------------------------------------------- the 408 genuine flashes
const feed = JSON.parse(fs.readFileSync(FEED, 'utf8'));
const SLOT = /_OPE_(\d{14})_(\d{14})_/;                       // same pattern as data-plane collect.py:51
const ts = s => Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
const E0 = Date.UTC(2026, 9, 20, 0, 0, 9);                    // proposed fixed epoch: first slot of the seed's first UTC day (HH:M0:09, history.py:50)
const F = feed.features.map(f => {
  const id = String(f.id), cut = id.lastIndexOf(':'), prod = id.slice(0, cut), rec = +id.slice(cut + 1);
  const m = prod.match(SLOT), slotStart = ts(m[1]);
  return { id, prod, rec, slot: Math.round((slotStart - E0) / 600000), slotStart, t: Date.parse(f.properties.time_utc),
           lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
});
const bySlot = new Map(); for (const f of F) { if (!bySlot.has(f.slot)) bySlot.set(f.slot, []); bySlot.get(f.slot).push(f); }
for (const a of bySlot.values()) a.sort((x, y) => x.rec - y.rec);
const facts = { flashes: F.length, products: new Set(F.map(f => f.prod)).size, slots_with_flashes: bySlot.size,
  max_record_index: Math.max(...F.map(f => f.rec)), max_flashes_in_one_slot: Math.max(...[...bySlot.values()].map(a => a.length)),
  distinct_flash_times: new Set(F.map(f => f.t)).size, distinct_lonlat: new Set(F.map(f => f.lon + ',' + f.lat)).size };
// record order vs time and vs latitude inside each product (does the product's own order leak geography?)
let pairs = 0, recTimeAgree = 0, recLatAgree = 0, recLonAgree = 0;
for (const a of bySlot.values()) for (let i = 1; i < a.length; i++) { pairs++;
  if (a[i].t >= a[i - 1].t) recTimeAgree++; if (a[i].lat >= a[i - 1].lat) recLatAgree++; if (a[i].lon >= a[i - 1].lon) recLonAgree++; }
facts.within_slot_consecutive_pairs = pairs; facts.record_order_nondecreasing_in_time = recTimeAgree;
facts.record_order_nondecreasing_in_lat = recLatAgree; facts.record_order_nondecreasing_in_lon = recLonAgree;
// the two slot definitions in the data plane: product name (collect.py:280) vs flash time (history.py:191-199)
facts.flash_time_slot_differs_from_product_slot = F.filter(f => Math.floor((f.t - E0) / 600000) !== f.slot).length;
facts.flash_time_before_product_start = F.filter(f => f.t < f.slotStart).map(f => ({ id: f.id.slice(-40), ms_early: f.slotStart - f.t }));
out.facts = facts;

// ---------------------------------------------------------------- key designs
const M = 65536;
const designs = {
  dense_rank_time_order: (all) => { const s = [...all].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)); const k = new Map(); s.forEach((f, i) => k.set(f.id, i)); return k; },
  slot_only: (all) => new Map(all.map(f => [f.id, f.slot])),                                   // one key per slot: NOT one star per flash
  slot_shift16_or_rank_js_bitops: (all) => { const k = new Map(); const g = groupRank(all); for (const f of all) k.set(f.id, (f.slot << 16) | g.get(f.id)); return k; },
  slot_times_M_plus_rank: (all) => { const k = new Map(); const g = groupRank(all); for (const f of all) k.set(f.id, f.slot * M + g.get(f.id)); return k; },
  slot_times_2p20_plus_record_index: (all) => new Map(all.map(f => [f.id, f.slot * 1048576 + f.rec])),
};
function groupRank(all) { const g = new Map(), m = new Map(); for (const f of all) { if (!m.has(f.slot)) m.set(f.slot, []); m.get(f.slot).push(f); }
  for (const a of m.values()) { a.sort((x, y) => x.rec - y.rec); a.forEach((f, j) => g.set(f.id, j)); } return g; }

// T1 bijectivity on the flashes (one key per flash, no collisions, decodable)
const T = {};
for (const [name, fn] of Object.entries(designs)) {
  const k = fn(F), vals = [...k.values()];
  T[name] = { unique_keys: new Set(vals).size, of: F.length, bijective_on_flashes: new Set(vals).size === F.length,
              all_nonnegative_finite: vals.every(v => Number.isFinite(v) && v >= 0) };
}
// JS bit-op overflow of (slot << 16): first slot that goes negative, and its date
T.slot_shift16_or_rank_js_bitops.first_negative_slot = 32768;
T.slot_shift16_or_rank_js_bitops.example = { slot: 32768, key: (32768 << 16) | 0, keyPlace_r: Math.sqrt(((32768 << 16) | 0) + 0.5),
  date_utc: new Date(E0 + 32768 * 600000).toISOString() };
// decode round trip for the recommended design (slot*M + rank -> slot, rank -> flash id)
{ const k = designs.slot_times_M_plus_rank(F); let ok = 0;
  for (const f of F) { const key = k.get(f.id), s = Math.floor(key / M), j = key - s * M; if (bySlot.get(s)[j].id === f.id) ok++; }
  T.slot_times_M_plus_rank.decode_round_trip = ok + '/' + F.length; }

// T2 geo-blindness: shuffle lon/lat across flashes; every key must be unchanged
function shuffled(arr, seed) { const a = arr.slice(); let s = seed >>> 0; for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
{ const coords = shuffled(F.map(f => [f.lon, f.lat]), 42); const G = F.map((f, i) => ({ ...f, lon: coords[i][0], lat: coords[i][1] }));
  for (const [name, fn] of Object.entries(designs)) { const a = fn(F), b = fn(G); T[name].geo_blind = F.every(f => a.get(f.id) === b.get(f.id)); }
  // a forbidden design for contrast: key from geography (Morton order of lon/lat). It must FAIL this test.
  const morton = (all) => { const s = [...all].sort((p, q) => zorder(p) - zorder(q)); return new Map(s.map((f, i) => [f.id, i])); };
  function zorder(f) { const x = Math.floor((f.lon + 11) / 14 * 65535), y = Math.floor((f.lat - 49.5) / 12 * 65535); let z = 0; for (let b = 15; b >= 0; b--) z = z * 4 + (((y >> b) & 1) << 1 | ((x >> b) & 1)); return z; }
  const a = morton(F), b = morton(G); T.FORBIDDEN_morton_geo_key = { geo_blind: F.every(f => a.get(f.id) === b.get(f.id)) }; }

// T3 stability: complete partial slots late. Simulate: for every slot, the first ingestion missed a random suffix-in-time
// (collect.py:94 drops flashes outside [start,end)); later the rest arrives. Count keys that MOVE for flashes present both times.
{ let s = 7; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const early = F.filter(f => { const a = bySlot.get(f.slot); const cut = a.length > 1 && rnd() < 0.5 ? a[0].t + (a[a.length - 1].t - a[0].t) * rnd() : Infinity; return f.t <= cut; });
  for (const [name, fn] of Object.entries(designs)) { const a = fn(early), b = fn(F); let moved = 0; for (const f of early) if (a.get(f.id) !== b.get(f.id)) moved++;
    T[name].late_completion = { present_early: early.length, arrived_late: F.length - early.length, moved_keys: moved }; }
  // and the realistic whole-slot case: one whole earlier slot arrives late (lookback filled a gap)
  const firstSlot = Math.min(...bySlot.keys()), lateSlotRemoved = F.filter(f => f.slot !== [...bySlot.keys()].sort((x, y) => x - y)[3]);
  for (const [name, fn] of Object.entries(designs)) { const a = fn(lateSlotRemoved), b = fn(F); let moved = 0; for (const f of lateSlotRemoved) if (a.get(f.id) !== b.get(f.id)) moved++;
    T[name].whole_slot_arrives_late = { moved_keys: moved, of: lateSlotRemoved.length }; }
}

// T4 float32 shader precision: KuiperLaw.shader reproduces index.html:143-148 in float32. Batches of 4,000,000 as :333-335.
{ const res = {};
  for (const [name, fn] of [['slot_times_M_plus_rank', designs.slot_times_M_plus_rank], ['slot_times_2p20_plus_record_index', designs.slot_times_2p20_plus_record_index]]) {
    const k = fn(F); let maxErr = 0, minSep = Infinity; const P = [];
    for (const key of k.values()) { const off = Math.floor(key / 4e6) * 4e6, d = key - off; const g = LAW.shader(off, d), e = LAW.keyPlace(key);
      maxErr = Math.max(maxErr, Math.hypot(g.x - e[0], g.y - e[1])); P.push([g.x, g.y]); }
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) minSep = Math.min(minSep, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]));
    res[name] = { max_key: Math.max(...k.values()), max_float32_vs_float64_world_units: +maxErr.toFixed(5), min_separation_world_units: +minSep.toFixed(3),
                  neighbour_spacing_world_units: +Math.sqrt(Math.PI).toFixed(3) }; }
  // one year at full scale, worst radius: last slot of a 366-day year
  const yrKey = (366 * 144) * M + 50000, off = Math.floor(yrKey / 4e6) * 4e6;
  const g = LAW.shader(off, yrKey - off), e = LAW.keyPlace(yrKey);
  res.year_end_probe = { key: yrKey, r: +Math.sqrt(yrKey + 0.5).toFixed(1), float32_error_world_units: +Math.hypot(g.x - e[0], g.y - e[1]).toFixed(4) };
  T.float32_shader = res; }
out.tests = T;

// ---------------------------------------------------------------- angular artefacts
const phi32 = LAW.constants.G32 / 4294967296;
const turnOf = (dk) => { const m = Math.imul((dk % 4294967296) >>> 0, LAW.constants.G32) >>> 0; return m / 4294967296; };
const signedTurn = x => (x > 0.5 ? x - 1 : x);
const art = {};
// (a) slot-only keys: what are nearest neighbours in the plane, by key difference, at the radii a year of slots occupies?
{ const N = 366 * 144, P = []; for (let k = 0; k < N; k++) P.push(LAW.keyPlace(k));
  const bands = [[100, 400], [1000, 1400], [5000, 5600], [20000, 21000], [50000, 52000]];
  art.slot_only_nearest_neighbour_key_differences = bands.map(([a, b]) => { const hist = {};
    for (let k = a; k < b; k++) { let best = -1, bd = Infinity; for (let j = Math.max(0, k - 2000); j < Math.min(N, k + 2000); j++) { if (j === k) continue;
      const d = Math.hypot(P[j][0] - P[k][0], P[j][1] - P[k][1]); if (d < bd) { bd = d; best = Math.abs(j - k); } } hist[best] = (hist[best] || 0) + 1; }
    return { keys: `${a}..${b}`, radius: `${Math.sqrt(a).toFixed(0)}..${Math.sqrt(b).toFixed(0)}`, nn_key_difference_counts: hist }; });
  art.one_day_144_slots_rotation_turns = +signedTurn(turnOf(144)).toFixed(5);
  art.one_day_144_slots_rotation_degrees = +(signedTurn(turnOf(144)) * 360).toFixed(2); }
// (b) slot*M designs: rotation between rank-0 stars of consecutive slots, and after one day
art.per_slot_rotation = {};
for (const MM of [65536, 65537, 65536 + 13, 1048576, 1048576 + 1]) {
  art.per_slot_rotation[MM] = { per_slot_turns: +turnOf(MM).toFixed(5), per_day_turns: +signedTurn(turnOf(144 * MM)).toFixed(5),
    period_in_slots_if_power_of_two: (MM & (MM - 1)) === 0 ? 4294967296 / (MM) / (gcdPow2(LAW.constants.G32)) : null }; }
function gcdPow2() { return 1; }
// choose M near 2^16: per-slot rotation as close as possible to the golden turn (0.381966 or 0.618034) and the
// per-day rotation far from 0 (no diurnal spokes). Report the best few.
{ const cand = []; for (let MM = 65536; MM < 65536 + 4096; MM++) { const a = turnOf(MM), dd = Math.abs(signedTurn(turnOf(144 * MM)));
    const g = Math.min(Math.abs(a - 0.381966), Math.abs(a - 0.618034)); cand.push({ M: MM, per_slot_turns: +a.toFixed(6), golden_gap: +g.toFixed(6), per_day_abs_turns: +dd.toFixed(4) }); }
  art.best_M_near_2p16 = cand.filter(c => c.per_day_abs_turns > 0.1).sort((x, y) => x.golden_gap - y.golden_gap).slice(0, 3); }
// (c) arms test: for rank-0 stars of 2,000 consecutive slots at M, nearest-neighbour regularity (mean NN / ideal) — low = clumped arms
function armScore(MM, n = 2000, s0 = 20000) { const P = []; for (let s = s0; s < s0 + n; s++) P.push(LAW.keyPlace(s * MM));
  let sum = 0; for (let i = 0; i < n; i++) { let bd = Infinity; for (let j = 0; j < n; j++) if (j !== i) bd = Math.min(bd, Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1])); sum += bd; }
  const rA = Math.sqrt(s0 * MM), rB = Math.sqrt((s0 + n) * MM), area = Math.PI * (rB * rB - rA * rA); return +((sum / n) / Math.sqrt(area / n)).toFixed(3); }
art.rank0_star_evenness_meanNN_over_ideal = {}; for (const MM of [65536, art.best_M_near_2p16[0].M]) art.rank0_star_evenness_meanNN_over_ideal[MM] = armScore(MM);
art.rank0_star_evenness_note = 'mean nearest-neighbour distance / sqrt(area per point) for the first star of 2,000 consecutive slots; Poisson ~0.5, hexagonal ~1.07; low = stars bunch on arms';
out.angles = art;

// ---------------------------------------------------------------- stride sampling fairness on the genuine flashes
{ const keyRank = designs.slot_times_M_plus_rank(F), keyRec = designs.slot_times_2p20_plus_record_index(F);
  const days = {}; for (const f of F) { const d = new Date(f.t).toISOString().slice(0, 10); days[d] = (days[d] || 0) + 1; }
  const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rules = {
    every_Kth_in_key_order: (K) => { const s = [...F].sort((a, b) => keyRank.get(a.id) - keyRank.get(b.id)); return new Set(s.filter((f, i) => i % K === 0).map(f => f.id)); },
    key_mod_K_power_of_two: (K) => new Set(F.filter(f => keyRank.get(f.id) % K === 0).map(f => f.id)),           // K=4: rank%4==0 in every slot
    record_key_mod_odd_K: (K) => new Set(F.filter(f => keyRec.get(f.id) % (K | 1) === 0).map(f => f.id)),        // K made odd
    hash_of_id_mod_K: (K) => new Set(F.filter(f => fnv(f.id) % K === 0).map(f => f.id)),
  };
  const st = {};
  for (const K of [4, 8]) for (const [name, rule] of Object.entries(rules)) {
    const sel = rule(K), Kodd = name === 'record_key_mod_odd_K' ? (K | 1) : K;
    const perDay = Object.entries(days).map(([d, n]) => { const got = F.filter(f => sel.has(f.id) && new Date(f.t).toISOString().slice(0, 10) === d).length;
      return { day: d, flashes: n, drawn: got, expected: +(n / Kodd).toFixed(1) }; });
    const slotsWith = [...bySlot.values()], kept = slotsWith.filter(a => a.some(f => sel.has(f.id))).length;
    // stability: does the drawn set of already-present flashes change when one earlier whole slot arrives late?
    const third = [...bySlot.keys()].sort((x, y) => x - y)[3], early = F.filter(f => f.slot !== third);
    let changed = 0; if (name === 'every_Kth_in_key_order') { const s = [...early].sort((a, b) => keyRank.get(a.id) - keyRank.get(b.id)); const selE = new Set(s.filter((f, i) => i % K === 0).map(f => f.id)); for (const f of early) if (selE.has(f.id) !== sel.has(f.id)) changed++; }
    st[`${name}_K${Kodd}`] = { drawn: sel.size, expected: +(F.length / Kodd).toFixed(1), slots_with_flashes: slotsWith.length, slots_keeping_at_least_one: kept,
      max_abs_day_error: Math.max(...perDay.map(p => Math.abs(p.drawn - p.expected))).toFixed(1), per_day: perDay,
      drawn_set_changes_when_an_earlier_slot_arrives: name === 'every_Kth_in_key_order' ? changed : 0 }; }
  out.stride = st; }

// ---------------------------------------------------------------- See Through's own stride over the Kuiper wafer
{ const rows = fs.readFileSync(WAFER, 'utf8').split('\n').filter(l => l && l[0] !== '#').map(l => l.split('\t'));
  let k = 0; const runs = []; for (const p of rows) { k += +p[4]; runs.push([k, k + +p[1]]); k += +p[1]; }
  const SPACE = LAW.constants.SPACE; const boundary = runs.findIndex(r => r[1] === SPACE);
  const issuedBelowSPACE = runs.filter(r => r[1] <= SPACE).reduce((a, r) => a + r[1] - r[0], 0);
  let issuedHits = 0; const NRULE = 20000; let j = 0;
  const keys = []; for (let ki = 0; ki < NRULE; ki++) keys.push(Math.floor((ki + 0.5) * SPACE / NRULE));         // descent.js:964
  for (const key of keys) { while (j < runs.length - 1 && runs[j][1] <= key) j++; if (key >= runs[j][0] && key < runs[j][1]) issuedHits++; }
  // phones (descent.js:955-964): the first 5,800 keys, then every second key index of the rest
  const NSUB = 5800, nPhone = NSUB + Math.ceil((NRULE - NSUB) / 2); let phoneHits = 0; j = 0;
  const pk = []; for (let p = 0; p < nPhone; p++) { const ki = p >= NSUB ? NSUB + 2 * (p - NSUB) : p; pk.push(Math.floor((ki + 0.5) * SPACE / NRULE)); }
  for (const key of pk) { while (j < runs.length - 1 && runs[j][1] <= key) j++; if (key >= runs[j][0] && key < runs[j][1]) phoneHits++; }
  out.see_through_stride_phone = { stars: nPhone, on_issued_line: phoneHits, on_silence: nPhone - phoneHits };
  out.see_through_stride = { wafer_rows_now: rows.length, SPACE_in_kuiper_law: SPACE, a_commit_ends_exactly_at_SPACE: boundary >= 0,
    issued_keys_below_SPACE: issuedBelowSPACE, issued_share_of_address_space: +(issuedBelowSPACE / SPACE).toFixed(6),
    stride_keys: NRULE, stride_keys_on_an_issued_line: issuedHits, stride_keys_on_silence: NRULE - issuedHits,
    note: 'descent.js:964 key = floor((ki+0.5)*SPACE/NRULE): a midpoint stride over ADDRESSES (lines + silence at 600 keys/s), not over lines' }; }

console.log(JSON.stringify(out, null, 1));
