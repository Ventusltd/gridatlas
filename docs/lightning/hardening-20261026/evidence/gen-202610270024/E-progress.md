# Variant E progress (opus-fix-designer)
- 00:13 UTC resumed after container restart. Base = fixed-module-D.js (23,226 B, stamped 202610262310). Scope: CR1-CR6, M01-M05/H08, shard_lost, S4/S5/S6/S8/S10/S10b, T08/T11/T12/T13/T14/T15. Node-only (no Chromium).
- 00:16 UTC E built: D 23226 -> E 24757 bytes (delta +1531); cap 24781: MET (24 spare). FIT FLASHES button and moveend recount dropped for budget; three old one-line comments dropped. Next: tests.
- 00:19 UTC E = 24,763 B (18 spare); existing 24 tests pass on D and E; writing E fail-first tests.
- 00:20 UTC tests: E 47/47, D 24/47 (all 23 new fail on D for the named reason); ChatGPT latest (4f9bcdf, line 11 only) E 8/8, D 7/8 (H08). Reading copy-consistency next.
- 00:5x UTC FINAL. fixed-module-E.js 24,780 B (cap 24,781, 1 B spare), sha256 8684a63a…55cd; FINAL-E.diff vs fixed-module-D.js; per-group bytes in bytes-E.txt (build-E.mjs).
  - test-fixes.mjs: E 47/47; D 24/47 (all 23 new tests fail on D for the named defect; out/test-fixes-{E,D}.tap).
  - ChatGPT suite origin/chatgpt-veto 4f9bcdf (chatgpt-latest.test.mjs, only line 11 path changed): E 8/8, D 7/8 (H08).
  - Real fixtures (lightning-archive, -stale): all 10 shards still pass H04 integrity on E.
- Test changes to EXISTING tests (recorded as required):
  1. F6 / owner device 2 (test-fixes.mjs:180, was :165): label regex /\[1 \| 7d\]/ -> /\[≥?1 \| 7d\]/ (copy-consistency C09: PARTIAL counts are lower bounds).
  2. Owner device 3: paddingBottom '64px' -> >=56 px numeric; dropped the "curtain group has no padding" assertion (M01 now pads both twins).
  3. A11Y P15-3: colour regex #888 -> "#888 or brighter" (M04 moves to #bbb).
  4. boot(): new harness options (park, bounds, dash, innerHeight, now, index as function/string/promise); behaviour for old tests unchanged.
- Dropped for budget: M03 FIT FLASHES button (~330 B) and moveend recount (~90 B: count is as drawn); three old one-line comments (77 B); the S6 per-load request cap (unreachable once parts<=24 and windows<=31 days). M02 implemented via copy-consistency C06-C09 (status line) instead of my own caption line.
- Not done: browser/WebKit verification (no Chromium per order); proof needles gm-panel-body/insertBefore (since C) and the 24,000 assertion must be updated by the lead.
- 01:0x UTC SCHEMA update (coordinator order): IX_SCHEMA='uk-lightning-history-index.v2' right after AR; FEED_SCHEMA='FeatureCollection/optical_lightning_flash' right after FEED. ni() now checks raw.schema!==IX_SCHEMA (wrong/missing/v1 -> "archive unavailable: unsupported index schema …", R02); ok() checks FEED_SCHEMA.endsWith('/'+observation_kind) for every feed and shard record (type FeatureCollection still via isFC). Node parity simulation (out/parity-sim-E.txt) finds exactly these two constants for the two URLs.
  - Bytes: +74 for SCHEMA; funded by dropping copy-consistency C02 ("0 h 5 min", +2), C04 (en-GB/plural runs, +18), C05 (budget in MB, +11) and three navigation comments ("// tiers", "// one batched repaint", "// actions", −43). C01 "12 months", C03 midday and C10 Title Case kept (they fit). No honesty text or functional fix cut. E = 24,780 B (1 spare).
  - Tests: + PARITY and IX_SCHEMA (fail on D and on pre-schema E; pass on E). test-fixes.mjs boot() gained a source-override hook (globalThis.__SRC_OVERRIDE) used only by the IX_SCHEMA mutation test. E 49/49, D 24/49, ChatGPT 4f9bcdf E 8/8. Pre-schema E kept at out/fixed-module-E.pre-schema.js.
