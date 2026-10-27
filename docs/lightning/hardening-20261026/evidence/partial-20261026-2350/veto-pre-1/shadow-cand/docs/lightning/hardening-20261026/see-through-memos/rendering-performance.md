# Lens: rendering performance (a year of flashes on a phone)

Evidence comes from two places:
- **Bench:** `hardening/evidence/opus-memos-1/bench/`. Harness: self-fixture, headless Chromium 153, MapLibre 3.6.2, background-only style, 393×852 at DPR 3, CPU throttled 4×. The data are SYNTHETIC.
- **Budget lane:** `lightning/reports/mobile-performance-budget.md`.

WebGL ran on SwiftShader, unthrottled, so frame intervals measure the harness (62 ms at DPR 1, 815 ms at DPR 3). **Real-GPU frame cost is BLOCKED_HARNESS**; decode, parse and upload costs are the signal.

## The cost is JSON, not drawing

| Path (4× CPU) | Main thread |
|---|---|
| 10k lean GeoJSON → MapLibre source | 4.5 s from add to idle; 9 long tasks, 4.0 s in total |
| 10k binary → typed custom layer | 8 ms decode and validate; 40 ms to first frame; **0 long tasks** |
| 100k lean JSON (12.5 MB raw, 1.16 MB gzip) | `JSON.parse` 951 ms; 30 MB heap |
| 100k binary (0.80 MB raw, 0.47 MB gzip) | 137 ms to first frame; 0 long tasks |
| 1M binary (8.0 MB raw, 5.4 MB gzip) | 16 ms validate; 80 ms to first frame |
| 1M binned into 10 km cells | 45 ms; 12,596 cells; a 25 kB texture |

The original Atlas already spends 17–19 s in long tasks at phone CPU (F1); 40k GeoJSON points add ~27 s (F6).

## Design

**Binary shard, LFB1** (`run-bench.mjs`, function `lfb1()`):
- Layout: a 32-byte header, then `u32 offsets[145]` (one per 10-minute slot), then `u16 x/y` quantised to the UK box, then `u32 t`.
- Size: 8 B per flash, against 525.5 B in today's feed (F8).
- Quantisation is about 20 m, far finer than the ~10 km location error. Time-sorted, so a window is two binary searches.
- The consumer validates magic, count, offsets and order (3–16 ms); index v2 sha256 still applies.

**Typed WebGL layer** (`bench.html:60-95`):
- A MapLibre `custom` layer with one `u16` buffer, drawn as `gl.POINTS`.
- A window change is `drawArrays(first,count)` with no re-upload (0.1–0.6 ms). Needs WebGL2; drop the bench's `gl.finish()`.

**Level of detail by window:**
- Up to 7 days: points.
- 30 days: points if the index count is within the cap, otherwise a density grid.
- 3–12 months: a 10 km grid (about one LI footprint), binned client-side or pre-binned.
- A full year is never drawn as raw points on a phone.

**Degradation ladder.** Each rung is chosen from the index count, WebGL2 support and the measured first frame, before any download. The caption names the rung in use.
1. WebGL2 with a first frame under 100 ms: typed points, with the phone cap kept at 10k until a real device proves more.
2. Over the cap, or a window longer than 31 days: the 10 km grid.
3. No WebGL2, or a slow first frame: capped GeoJSON circles, clustered above the cap.
4. Memory pressure or a failed load: daily counts as text and bars only.
5. Reduced motion: no replay animation on any rung.
6. FAIL: the reason is shown, and any partial data stays labelled as partial.

## Where it belongs

This belongs in the standalone See Through explorer (MapLibre 4.7.1), not in GridAtlas:
- The Atlas cartridge has 808 B of headroom.
- A custom GL layer would add a new rendering path to a frozen composition.

The Atlas keeps its capped GeoJSON layer.

## Unknowns

- UK annual volume. The full disc saw 608 M flashes in 2025, but the UK share is unmeasured. Size scales at 5.4 MB gzip per million flashes.
- Real phone GPU fill rate at DPR 3, and WebGL2 behaviour on iOS WebKit.

## Recommendations

1. Add sealed LFB1 day shards, validated and protected by sha256, plus a pre-binned 10 km daily rollup to the data plane, alongside the JSON.
2. Build the typed layer and the ladder only in the standalone explorer. GridAtlas stays on capped GeoJSON.
3. Run this bench on one real Android phone and one iPhone before raising any cap.

**Would change my mind:** real mid-range phones drawing 40k GeoJSON points with no long task over 200 ms. A second data format would then not earn its keep.
