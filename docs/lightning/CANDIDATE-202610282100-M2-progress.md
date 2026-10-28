# M2-build: Build M + the MR fixes + a comprehensive REPD card

Status: **DONE**, about 21:35 UTC, 28 Oct 2026. Committed in my own worktree and **not pushed**. The live pointer is unchanged (L3, 202610281340).

## Deliverables
- **Generation:** 202610282100, v9.174.
  - candidate_predecessor = 202610281950 (M).
  - previous = superseded = parent = 202610281340 (the live L3).
  - The cartridge base is still the original 202609241334 sld bytes.
- **Worktree:** `evidence/M2-build/gridatlas-wt`, branch `claude/lightning-M2-repd-fixes-20261028`, cut from `claude/lightning-M-repd-20261028` (24aa74e).
- **Commits:**
  1. `5c3df0d`, gate only. `tools/scope/loop.mjs:194`: 480_000 → 500_000, with the owner's decision of 28 Oct 2026 in the message. It is separate so it can ship like 4d66f19.
  2. `afd8ba1`, the 6 scaffolder files for 202610282100.
- **Module:** 52,062 B against the 64,781 B cap. sha256 105b7404… before restamp; `out/make-generation-M2.json` has the generation hash.
- **Cartridge:** 487,281 B against the 500,000 B gate (sha256 LF in `out/make-generation-M2.json`).
- **Proof `tools/proofs/202610282100-sld-sandbox.proof.mjs`:** asserts ≤64,781 for the module and ≤500,000 for the cartridge.

### Tools (all in `evidence/M2-build/tools/`)
- `build-M2.mjs` builds the module from M. Every replacement is exact-once. The REPD block lives in `repd-m2.part.js`, written as readable code with comments.
- `make-generation-M2.mjs` is the scaffolder this build actually used. It is the M scaffolder with predecessor M, live L3, and a 500 kB ceiling. Before writing anything, it proves both lineages (the L3 cartridge and the M cartridge are each BASE + "\n" + their own module).
- `make-generation-500.mjs` is the generic copy of `make-generation-480.mjs` with the ceilings changed to 64,781 and 500,000.
- `patch-tests-M2.mjs`, `m2-tests.txt`, `repd1-m2.txt`, `gates.sh`, `run-suites.sh`.
- `vc/verify-candidate.mjs`: its hard-coded 480 kB check is now 500 kB.

### Superseded
The first, fixes-only generation (202610282040: 44,526 B, 255 B spare) was made before the scope change. It is kept on the unpushed branch `claude/lightning-M2-fixes-only-2040-20261028` (2e839b1), with a patch in `superseded-2040/`. **Do not publish it:** it also uses the version v9.174.

## What changed (module)
- **MR1:** the register is now fetched through `gj`. That gives the 15 s timeout (which also covers the body), redirect refusal, and "HTTP n".
  - **New from the browser run:** in Chromium, a stalled body that is aborted rejects with "Failed to fetch", not with an AbortError. `gj` now reports any rejection after its own abort as "timeout after 15 s" (+18 B; test M2-MR1d).
- **Bridge note:** the first failure says "Tap again to retry." A repeated failure adds advice to switch on a REPD layer or reload, because the bridge keeps a failed start for the page's lifetime.
- **MR2:** exact duplicate rows count once. The deduplication happens after measuring, so all 10,784 rows are still measured.
- **MR3:** sites tied with the 10th site are kept.
- **MR4:** a register that lands mid-move is framed at `moveend`.

### The comprehensive REPD card
1. **Co-located parts become one site.** Projects at the same point share one link and one label, for example "4.99 km · Biomass (dedicated) + Rooftop solar 1.14 MW". The card row reads "… · 2 co-located · …" and every part is listed beneath it.
2. **Filter chips (44 px).**
   - Status: All / Operational / Consented & construction / Planning. Consented & construction covers under construction and awaiting construction.
   - Technology: All / Solar / Wind / BESS / Other.
   - The default is All. The nearest 10 sites are re-ranked within the filter, and the lines and the camera follow.
   - The filter is kept for the next tap during the page session.
3. **Summary line:** "N REPD projects within 10 km · M within 40 km · total X MW within 10 km". It names any rows with no stated capacity and says "registered capacity, straight-line distance only, not a measure of impact".
4. **Fewer than 10:** "Only N sites within 40 km; the radius stays 40 km, so fewer than 10 are listed."
5. **A row tap stays in the page.**
   - The tap does not navigate (the `href` keeps the deep link for a new tab).
   - The map flies to the project and draws its 5 nearest substations with the original `link.measure.nearestSubstations`. The card says "not its declared grid connection".
   - "◀ back to lightning cell" (or "flash") restores the card, the links and the filter.
   - It flies to the project even when no substation is within 40 km.
   - **The original `selectAt` and click path are not used.** The earlier notes list why: a stale repd_ref, the arrival gate and `arrival_engine`.
6. **Camera:** the `fitBounds` bottom padding is clamped to the container height − 270. Before this, an expanded card left no room and the fit silently did nothing. It is unchanged for collapsed cards.

## Results
- **Gates** (`out/checks-202610282100.log`, after the commit):
  - lint: PASS.
  - STATE.md identical; STATE.md and current.json unchanged.
  - All 12 proofs: PASS.
  - run-current: PASS.
  - verify-compose: PASS.
  - verify-candidate: PASS.
- **Suites on the generation module:**
  - test-engine: 176/176, 8 runs.
  - test-fixes: 104/104, 3 runs.
  - ChatGPT suites: 8/8 and 6/6, 3 runs each.
- **The unmodified M suite on M2** fails exactly 2 tests, both intended:
  - L10, the 44,781 budget.
  - REPD1, which expected ungrouped rows. Newark has a co-located site, so it now compares against an independent grouped brute force.
- **Fail-first:** 17 of the 18 new or changed tests fail on M. M2-MR4b is a guard and passes on both.
- **Rest-state parity against live L3** (`browser/pixcmp-M2.txt`): 0 differing pixels at 393×659 and at 393×852. The DOM and layers are equal, with 0 lightning or REPD requests.
- **Browser** (one Chromium, one context per case; `browser/taps*.json`, screenshots `M2-*.png`):
  - **Dense, Lincoln 12M cell:**
    - 10 sites and 12 projects; no overflow at 393 px.
    - Filters re-rank correctly.
    - The row tap stays on the same URL (0 navigations). It shows the project card with 5 links, and every endpoint is on screen.
    - Back restores the 10 links with every endpoint on screen. Close leaves 0 layers.
  - **Sparse, Harris cell:** 2 sites, and the "Only 2 sites" text shows. Row tap and back work.
  - **REPD register stall:** after "loading…", the card says "timeout after 15 s" at 17 s. The 5 substation links stay, and a retap refetches.
  - 0 page, map or module errors.

## Residuals
- On the first framing of the dense cell, 1 of 10 project endpoints sat just under the card. The camera rule only reframes when a point is outside the map bounds; this is L3's rule and I left it unchanged. After back, every endpoint was on screen.
- The project view is not the engine's popup: there is no declared or NESO line and no 400 kV row.
- The bridge's DuckDB path still cannot be exercised offline.
- Neon labels were not seen (no glyphs).
- Not tested on WebKit.
