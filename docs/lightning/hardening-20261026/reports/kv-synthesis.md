# kv-synthesis: root-cause chemistry, Builds C→I → Build J

v6 (final), 16:44 UTC. All 17 lanes are in. Line numbers refer to `wt/atlas/modules/202610270929-uk-lightning-overlay.js` (33,623 B, budget 44,781 B). C means `cartridges/202609241334-sld-sandbox-v9-8.js`.

**Method** (`stars/reports/CHEMISTRY.md`): a *decay* is a defect, and the *compound* is the change that carried it. A *family* is a shared root cause. A family is *radioactive* when it decays in most builds that carry it. Families are ranked by owner impact.

**Measured chemistry** ([kv-stars](kv-stars.md), 972 stars on the real archive):
- No decay is an error or a wrong count. Every decay is presentation or framing.
- The two complaints share no defective body ([kv-vogel](kv-vogel.md), 157 bodies, 549 edges).
- Stability by compound, Build I → patched: `real·none` 74% → 100%, `real·nearest` 41% → 100%, `feedonly·nearest` 6% → 67%.

**Corrections to the brief:**
- The live code has no red pulsing origin. The origin is a pale ring, `l-project-pin`; the red is the engine's `l-solar-glow`.
- The substation nodes are teal, not white.
- 3M covers 93 dates, 64 of them unsearched.
- Substations come from OSM `grid_substations.geojson`, not data-grid-gb.
- The collector last ran 10:26–10:43, not 08:55.

Sources: [kv-neon §1](kv-neon.md), [kv-engine KE2](kv-engine.md), [kv-periods §1](kv-periods.md), [kv-spider](kv-spider.md).

## 1. Root-cause families

### F1 (owner-visible, radioactive): estate elements re-implemented instead of bound to the canonical ones
Every Lightning-owned copy decayed: the H3 popup, the I1 card and the I3 nearest search.
- **Nearest search.** Line 156 hand-rolls `kv[0]>=132 … slice(0,3)`. The canonical `link.measure.nearestSubstations` (C:3513, exported at C:3584, `family:64149`) gives ≥33 kV, 5 links, ≤40 km and `beyondRadiusNearest`. The hand-rolled version:
  - drops 33 kV sites as close as 0.53 km;
  - draws 95.6 km sea chords that the original refuses to draw (C:4559-4567).

  With the same parameters, the estate's four routines agree bitwise, 15/15 ([kv-lab §2](kv-lab.md), [kv-elements](kv-elements.md)).
- Line 158 calls 132 kV "transmission"; the estate means ≥400 kV.
- **Card.** A div replaces `Popup` + `dockAsSheet` + card bar (C:3950): the "tall black box".
- **The root assumption was false.** I-progress says there is "no public draw entry". The browser test KE3 routes a flash through the original `link.selectAt`, with the popup first and `currentRepdRef` null. It gets the engine's 5 links, the ring, the flow, the sheet card bar and the z12 camera ([kv-engine KE3](kv-engine.md)).
- **The lanes repeat the pattern.**
  - kv-neon proposes a 6 kB copy ([kv-neon §3](kv-neon.md)).
  - kv-card proposes a third card, "a copy, not shared" ([kv-card](kv-card.md)).

### F2 (owner-visible): UI state not re-derived after a tap, a load or a mode change
- **No lines visible (browser-confirmed; 7 lanes agree).** The lines sit on top of all 105 layers. At the phone's z4.2 they are 4.6–6.9 px long, under an 8 px dot and a 144×788 card, so 0% of them is visible. Nothing moves the camera.
  - Evidence: [kv-engine KE1](kv-engine.md) (browser), [kv-stars](kv-stars.md) (256/256 taps).
- **Period change** keeps `S.end`/`S.h` (196, 201): 7D lands on 21–28 Aug ([kv-paging K4](kv-paging.md)).
- **Card survives redraw.** I removed H's `pc()` from `dw` (line 134), so the card and its lines survive PREV after the flash is gone ([kv-regress R2](kv-regress.md)).
- **Stale hit index.** After `setData`, a stale rendered hit index opens the wrong flash (lines 206/145; [kv-security K4](kv-security.md)).
- **`substations` read too early.** It is read before it loads, through the prototype chain (K5).

### F3 (owner-visible): true flags printed without their denominator or cause
- **The counts are exact** (972 stars).
- **The wording is wrong.**
  - `[≥1,480 | 30d STALE]` is identical from 30D to 12M (line 182).
  - Pages before 29 Sep read "Flashes 0" (lines 78/123).
  - STALE shows on PREV pages (line 96).
- **The headline falls to the loaded count.** After consent it drops 30× (1,000,000 → 33,404). Under CDN skew it reads ≥98 against 262 ([kv-perf](kv-perf.md), [kv-regress R4](kv-regress.md)).

Sources: [kv-periods §3](kv-periods.md), [kv-words](kv-words.md), [kv-paging](kv-paging.md).

### F4: day-granular counts under sub-day windows
Whole-day `count` and `bytes` are charged against 12H and 48H windows. The results:
- a false "newest day alone exceeds it" (line 86);
- `[48,496 | 12h]` for 31,750 flashes (line 81);
- "≥39 | 48h" for 29 flashes (line 113).

Sources: [kv-perf](kv-perf.md), [kv-periods §3](kv-periods.md).

### F5 (pipeline): STALE on the wrong clock, and an unreliable scheduler
- `stale` (line 47) keys on `generated_utc`, which backfill bumps. The panel looked fresh from 07:01 to 10:01 while the search frontier was at 02:30.
- There are three freshness rules: 3 h, 4 h and 12 h.
- Feed mode never shows STALE: 0 of 54 stale stars ([kv-stars §2](kv-stars.md)).
- GitHub's cron delivered 21 of about 112 slots, and none was cancelled. The shared group `uk-lightning-update` added one 91-min queue behind a backfill ([kv-collector §1](kv-collector.md), [kv-spider](kv-spider.md)).

### F6 (historic, E–G): every fix squeezed for bytes regressed something
Radioactive under the 24,781 B cap:

| Build | Decay | Compound |
|---|---|---|
| E | E1 | round→floor |
| E | E6 | loosened |
| E | M03 | dropped |
| F | R1 | `>>>0` |
| F | R2 | — |
| F/G | CRF-2 | dropped |
| G | REG-1 | revert |

Sources: code-review-E §E1/E6, code-review-F.md:33, sweep-F.md:32,46, sweep-G.md:46,51. The family went stable when H raised the cap and restored all of these.

### F7: tests lock in the drift and never take the owner's path
- I3 asserted "3 nearest ≥132 kV" and no "Tiny 33kV".
- `test-fixes.mjs:634` asserts the false "Flashes 0".
- Build I's browser check ran on a glyph-less shim at 1440×900.

## 2. Ordered fix list for Build J
Bytes start from 33,623.

| # | Fix | Lines | B | Proving test |
|---|---|---|---|---|
| J1 | Route NEAREST through the original engine (`kv-engine/engine-nearest.js`). Before the call, click any open `.gridatlas-card-bar .close`, which clears a stale `currentRepdRef` ([kv-arrival-api risk 1](kv-arrival-api.md)). Hide `.gridatlas-corridor-open`. | 128, 133, 146-163 | ≈+1,450 | `kv-engine.browser.mjs proto`: land flash → 5 links ≥33 kV, z12, first line 100% visible; sea → 0 lines + beyond-40 km text; × and OFF → 0 sources. **New:** project card open → tap flash → no PoC or Declared line. |
| J1b | Fallback `near()` bound to `L.measure.nearestSubstations`, with framing and docking (`kv-elements/KV-nearest.diff`; spider F1+F2 is equivalent) | 154-164 | +845 | KV-I3 (`kv-elements/test-kv.mjs`) 91/91; `kv-lab/bitcheck.mjs` 15/15 |
| J2 | Rename the hit layer: `HIT=SRC+'-hit'` | 128 | 0 | kv-regress R3 probe: a tap 15 px from a flash with GRID armed → engine `!features.length` path |
| J3 | Hardening: own-property `substations`, `Array.isArray`, `+dk`, try/catch cleanup, serial-tagged hits, `\p{Cf}` and 200-char cap, object ids rejected, NaN guard | 69, 131, 145-163, 206 | +265 | `kv-security/repro.mjs`: 12 → 0 proven |
| J4 | One grammar: kv-words W1, W3–W11, e.g. `[1,480 \| 29 of 31 days searched]`, hours for ≤48H, no "≥", no 0 before the archive. This supersedes kv-paging K1–K3, kv-periods K3/K5–K9 and spider F3. | 19, 50-53, 96-123, 174-193 | ≈+1,680 | `kv-periods/test-kv-periods.mjs` KV1–KV11 + KV-guard, reworded; 6 old assertions rewritten ([kv-words](kv-words.md)). Keep "(N in part)": a bare days ratio overstates coverage ([kv-vogel](kv-vogel.md)) |
| J5 | STALE from frontier age (`lastScan`) plus `nextDue`, on the latest page only (kv-periods K1/K2). Feed mode moves from `4*HOUR` to `3*HOUR` (stars K2, 0 B). **Not** W2: it drops `nextDue`, so 13:45 would read fresh. | 47, 96 | +28 | KV "backfill hides STALE" @88f115b; KV "no STALE on PREV"; 54/54 stale feed stars |
| J6 | Headline keeps the archive total; charge only overlapping parts; LRU `>RQ` | 32, 81, 86, 182 | ≈+200 | kv-perf caseB draws 31,750; "33,404 OF 1,000,000"; kv-regress K7 0 requests per tick; skew 12M reads 262 |
| J7 | Reset `S.end`/`S.h` on period change and LATEST; `pc()` on non-refresh loads; PREV stops at the first searched date; CUSTOM To ≤ today | 192-203 | +82 | paging cross-period (7D → 20–27 Oct); regress K8b; paging K7 |
| J8 | Merge J1–J7 in one tree, then run every lane suite and KE1 on it | — | 0 | kv-regress `run-all.sh` with no new FAIL; KE1 shows lines on screen |

**Total ≈ +4,550 B → about 38.2 kB** (6.6 kB spare).

**Owner decisions:**
- whether lines fire on tap (kv-card) or on NEAREST (kv-engine);
- the camera on OFF;
- kv-card's short-ID `sid()` (worth keeping).

**Lightning repo:**
- **L1.** `fix/collector-own-lane-20261027` @4ca2b8d: a separate backfill group, a :47 fallback cron, push-with-replay and a heartbeat. 138 py + 25 node tests; 3 mutants killed.
  - L1 wins over kv-spider's "keep the shared group": its 11 two-clone tests solve the push races.
- **L2.** `feature/backfill-parallel-20261027` @2ef8f7f, rebased onto L1 (conflict in `backfill-lightning.yml`). First run: 3 shards, 30 days.
- **L3 (owner).** An external dispatch pinger, and a single freshness rule.
- **After J:** a 0.25° day grid for windows over 31 days ([kv-perf](kv-perf.md)).

## 3. Process changes
1. **Bind-first gate.** Before writing UI or maths, run `node stars/modular-star/find-prior.mjs` and name the `block:`/`family:` you bind to. `stars/code/names.json` already numbers `nearestSubstations` (families 514, 8477, 64149), so this gate would have caught I3. A copy needs a written reason and a parity test on real data. A claim of "no public entry" needs a browser probe like KE3.
2. **No byte squeeze.** A trim never shares a build with a fix, and it needs its own green suite. Keep at least 2 kB of headroom, and raise the gate before trimming.
3. **Owner-path proof before "done".** Use a 393×659 viewport, the real route and archive, and the owner's taps. Assert visible pixels ("≥40 px of core line, not under the card"), not `addLayer` calls.
4. **One `render(state)`** on every tap, load, period change or `setData`, with no carried fields. Add an A→B→A sequence test.
5. **Tests cite their canonical source** (for example `MIN_KV` C:1691). No test may assert a defect.
6. **One owner per line range.** This round, three lanes rewrote line 182, three built cards or links, and two edited `backfill-lightning.yml`.
7. **Every count states its denominator and every flag its clock** ("29 of 31 days", "searched to 10:20"). No whole-day number goes under a sub-day label.
