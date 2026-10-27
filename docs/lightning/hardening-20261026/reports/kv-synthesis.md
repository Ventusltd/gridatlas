# kv-synthesis: root-cause chemistry, Builds C→I → Build J

v3, 16:31 UTC. 13 of 16 lanes are final. Interim: card, vogel, regress (merge run), spider, stars. Line numbers refer to `wt/atlas/modules/202610270929-uk-lightning-overlay.js` (33,623 B, budget 44,781 B) unless a file is named. C stands for `cartridges/202609241334-sld-sandbox-v9-8.js`.

**Method.** The terms come from `stars/reports/CHEMISTRY.md`:
- *Decay*: a defect.
- *Compound*: the change that carried it.
- *Family*: a shared root cause.
- *Radioactive*: decays in most builds that carry it.

Families are ranked by owner impact.

**Corrections to the brief.**
- The live code has no red pulsing origin: the origin is a pale ring, `l-project-pin`, and the red is the engine's `l-solar-glow`.
- Nodes are teal `#5fbdc2`, not white.
- 3M spans 93 dates, 64 of them unsearched.

Sources: [kv-neon §1](kv-neon.md), [kv-engine KE2](kv-engine.md), [kv-periods §1](kv-periods.md).

## 1. Root-cause families

### F1 (owner-visible, radioactive): re-implemented estate elements instead of binding to canonical ones
Every Lightning-owned copy decayed: the H3 popup, the I1 card and the I3 nearest search.
- **Nearest search.** Line 156 hand-rolls `kv[0]>=132 … slice(0,3)`. The canonical `link.measure.nearestSubstations` (C:3513, exported C:3584, `family:64149`) uses ≥33 kV, 5 links, ≤40 km and `beyondRadiusNearest`.
  - It drops a 0.53 km 33 kV site.
  - It draws 95.6 km sea chords that the original refuses to draw (C:4559-4567).
  - With the same parameters, the four estate routines agree bitwise, 15/15 ([kv-lab §2](kv-lab.md), [kv-elements](kv-elements.md)).
- **"Transmission".** Line 158 labels 132 kV as transmission. The estate means ≥400 kV (`nearestTransmission`, `family:8373`).
- **Drawing.** The paint copies `ensureLayers` byte for byte but omits the flow, the ring and the camera.
- **Card.** The card is a div rather than `Popup` + `dockAsSheet` + card bar, which gives the "tall black box".
- **The root assumption was false.** I-progress assumed there was "no public draw entry". Browser test KE3 routes a flash through the original `link.selectAt` with the popup created first and `currentRepdRef` null. It gets the engine's own 5 links, ring, flow, sheet card bar and z12 camera ([kv-engine KE3](kv-engine.md)).
- **The lanes repeat it.** kv-neon proposes a 6 kB second copy ([kv-neon §3](kv-neon.md)).

### F2 (owner-visible): UI state not re-derived after a tap, an async load or a mode change
- **No lines on screen (confirmed in a browser).**
  - The lines are drawn on top of all 105 layers, but at the phone's default z4.2 they are 4.6–6.9 px long, under an 8 px dot and a 144×788 card: 0% visible.
  - At z11 they render at 511–768 px ([kv-engine KE1](kv-engine.md); 256/256 taps in [kv-stars](kv-stars.md)).
- **Period change.** Period changes keep `S.end`/`S.h` (196, 201): the 7D chip lands on 21–28 Aug ([kv-paging K4](kv-paging.md)).
- **Stale hit index.** After `setData`, a stale rendered hit index opens the wrong flash (206/145; [kv-security K4](kv-security.md)).
- **Substations read too early.** `L.substations` is read before it loads, through the prototype chain (K5).
- **Click order.** The `l-` prefix makes the engine's `interactiveLayerIds` (C:6029) treat a flash tap as a feature tap.
- **Precedent.** M01 `fit()` ran at install only (`veto-static-E.md`).

### F3 (owner-visible): true flags printed without the denominator or cause
- **The counts are exact** on more than 120 pages and 972 stars. The wording is the defect.
  - `[≥1,480 | 30d STALE]` is identical from 30D to 12M (182), even though those windows have 29 of 31, 93, 184 and 366 days searched.
  - Pages before 29 Sep read "Flashes 0" (78/123).
  - STALE is printed on PREV pages (96).
- **After consent** the headline shrinks 30×, from `≥1,000,000` to `≥33,404` (182-183; [kv-perf](kv-perf.md)).
- Sources: [kv-periods §3](kv-periods.md), [kv-words](kv-words.md), [kv-paging](kv-paging.md).

### F4: day-granular data shown under sub-day windows
- Whole-day `count`/`bytes` are charged to 12H and 48H windows.
- The consequences:
  - a false "newest day alone exceeds it" (86);
  - a 12H overview labelled `[48,496]` for 31,750 flashes (81);
  - "≥39 | 48h" for 29 flashes (113);
- Sources: [kv-perf](kv-perf.md) and [kv-periods §3.3-3.4](kv-periods.md).

### F5 (pipeline): STALE keyed on the wrong clock, and the scheduler is unreliable
- `stale` (47) uses `generated_utc`, which backfill commits bump. The panel therefore looked fresh from 07:01 to 10:01, while the search frontier sat at 02:30 ([kv-periods §3.7](kv-periods.md)).
- Two thresholds disagree: the module uses 4 h, `status.json` uses 12 h.
- No run was cancelled. GitHub created 2 of 13 hourly runs between 03:17 and 15:17, and one waited 91 min behind backfill in the shared group `uk-lightning-update` ([kv-collector §1](kv-collector.md)).

### F6 (historic, E–G): every fix squeezed for bytes regressed something
This family was radioactive under the 24,781 B cap. Seven decays trace to it:

| Build | Decay | Cause |
|---|---|---|
| E | E1 | round→floor |
| E | E6 | loosened |
| E | M03 | dropped |
| F | R1 | `>>>0` let 0.5 through |
| F | R2 | — |
| F, G | CRF-2 | dropped |
| G | REG-1 | revert |

Evidence: code-review-E §E1/E6; code-review-F.md:33; sweep-F.md:32,46; sweep-G.md:46,51. The family has been stable since H raised the cap to 44,781 B and restored all seven (bytes-H.txt).

### F7: tests lock in the drift and never take the owner's path
- Test I3 asserted "3 nearest ≥132 kV" and `doesNotMatch(/Tiny 33kV/)`.
- `test-fixes.mjs:634` asserts the false "Flashes 0".
- Build I's browser check ran on a glyph-less shim at 1440×900.
- The lab smoke test used 2 synthetic points.
- Nobody tapped NEAREST at phone zoom until KE1.

## 2. Ordered fix list for Build J
Bytes run from 33,623.

| # | Fix | Lines | B | Proving test |
|---|---|---|---|---|
| J1 | NEAREST goes through the original engine (`engine-nearest.js`). Guards: click any existing `.gridatlas-card-bar .close` first (clears a stale `currentRepdRef`, [kv-arrival-api risk 1](kv-arrival-api.md)); hide `.gridatlas-corridor-open`. | 146-163, 128, 133 | ≈+1,450 | `kv-engine.browser.mjs proto`: land flash 5 links ≥33 kV, z12, first line 100% visible; sea flash 0 lines + beyond-40 km text; × and OFF leave 0 sources. **Add:** project card open → flash → no PoC/Declared line |
| J1b | Keep `near()` as the fallback, bound to `L.measure.nearestSubstations`, with camera and docking (`kv-elements/KV-nearest.diff`) | 154-164 | +845 | KV-I3 (`kv-elements/test-kv.mjs`) 91/91; `kv-lab/bitcheck.mjs` 15/15 |
| J2 | Hardening: own-property `substations`, `Array.isArray`, `+dk`, try/catch with cleanup, serial-tagged hits, `\p{Cf}` strip + 200-char cap, object ids rejected, NaN guard | 69, 131, 145-163, 206 | +265 | `kv-security/repro.mjs` 12 → 0 proven; suite 91/91 |
| J3 | **One** grammar: kv-words W1, W3–W11, e.g. `[1,480 \| 29 of 31 days searched]`, hours for ≤48H, no "≥", no 0 before the archive. Supersedes kv-paging K1–K3 and kv-periods K3/K5–K9. | 19, 50-53, 96-123, 174-193 | ≈+1,680 | `kv-periods/test-kv-periods.mjs` KV1–KV11 + KV-guard, re-worded; 6 old assertions rewritten ([kv-words, Tests](kv-words.md)) |
| J4 | STALE uses frontier age (`lastScan`) and `nextDue`, on the latest page only. This is kv-periods K1/K2, **not** W2, which drops `nextDue` so 13:45 would read fresh. Status shows "COLLECTOR SEARCHED TO 10:20 UTC". | 47, 96 | +28 | KV "backfill hides STALE" @88f115b 12:00Z; KV "no STALE on PREV" |
| J5 | Granularity and headline: keep the archive total after consent; charge only overlapping parts; LRU 8→32 | 32, 81, 86, 182 | +171 | `kv-perf` caseB-phone draws 31,750; 1M reads "33,404 OF 1,000,000"; 30D refresh 24→2 requests |
| J6 | Reset `S.end`/`S.h` on a period change and on LATEST; PREV stops at the first searched date; CUSTOM To ≤ today | 192, 196, 199, 201 | +65 | paging cross-period (7D → 20–27 Oct); K7; KV PREV-stop |
| J7 | Merge J1–J6 in one tree; run every lane suite plus the KE1 repro on the merged module | — | 0 | kv-regress `run-all.sh`, no new FAIL against G/H/I |

**Subtotal:** about +4,500 B, so about 38.1 kB (6.6 kB spare).

**Lightning repo (separate PRs, in this order):**
- **L1:** `fix/collector-own-lane-20261027` @4ca2b8d. It moves backfill to its own group, adds the :47 fallback cron, push-with-replay and the heartbeat. 138 py + 25 node tests pass, and 3 mutants fail.
- **L2:** `feature/backfill-parallel-20261027` @2ef8f7f, rebased onto L1 (conflict in `backfill-lightning.yml`). The first real run uses 3 shards, 30 days. 337 dates take about 18 h.
- **L3 (owner decision):** an external `workflow_dispatch` pinger.

**Next build after J (owner decision):** a 0.25° per-day grid for windows over 31 days, about 1.8 kB, 3–70 kB gzipped in 1 request ([kv-perf](kv-perf.md)).

**Still pending:** J8 card (kv-card) and J9 Vogel (kv-vogel).

## 3. Process changes
1. **Bind-first gate.** Before writing UI or maths, run `node stars/modular-star/find-prior.mjs` and name the `block:`/`family:` it binds to. A copy needs a written reason and a real-data parity test (`bitcheck.mjs`). Claims of "no public entry" need a browser probe, as in KE3.
2. **No byte squeeze.** A trim never ships in the same build as a fix, and gets its own green full suite. Keep ≥2 kB of headroom; raise the gate before you trim.
3. **Owner-path proof before "done".** Run a 393×659 phone on the real route and archive, with the owner's exact taps. Assert what is visible on screen ("≥40 px of core line, not under the card"), not that `addLayer` was called.
4. **One `render(state)`** on every tap, load, period change or `setData`, with no carried fields. Each lane adds an A→B→A sequence test.
5. **Tests cite their canonical source** (e.g. `MIN_KV` C:1691). No test may assert a defect.
6. **One owner per line range.** This round, three lanes rewrote line 182 and two wrote `backfill-lightning.yml`. The lead assigns overlaps up front.
7. **Every count states its denominator, and every flag its clock.** Write "29 of 31 days" and "searched to 10:20". Never put a whole-day number under a sub-day label.
