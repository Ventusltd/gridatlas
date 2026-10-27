<!-- Draft sections for OWNER-REVIEW.md (issue #32 §12 F), by opus-matrix-aggregator, 2026-10-26.
     Decision details live in reports/opus-owner-decisions.md (OWD); this file links to it and does not restate it.
     Paths are relative to the hardening root (scratchpad/hardening/ = docs/lightning/hardening-20261026/ on the branch). -->

## Side-by-side screenshots: original vs candidate, four widths

**Source.** Lane B (visual-challenge-B) raw parity run `full-matrix-OFF`:
- **Run:** 2026-10-26 22:37 UTC, Chromium 153.0.8010.12, lead-shim (`../lightning/harness/offline-shim.mjs`), no fixtures.
- **Routes:** baseline `http://127.0.0.1:8141/gridatlas/atlas/` (generation 202609241334); candidate `http://127.0.0.1:8142/wt/atlas/v/202610261949/` (fda6b10).
- **Masks:** `#clock`, `#date`, `#days`, map canvas. The additive host is `[data-lightning-group]`.
- **Status:** lane B has not filed its report. The "Raw result" column copies `parity/runs/full-matrix-OFF/SUMMARY.md` and is NOT an adjudicated verdict.
- **390×844:** Chromium with an iPhone geometry. It is not Safari or WebKit (BLOCKED_HARNESS).
- **Not covered:** lightning OFF only. No ON-state pairs exist in this run.

Prefix `R = evidence/visual-challenge-B/parity/runs/full-matrix-OFF`. In each cell, `a` is the original route, `b` is the candidate route and `diff` is the diff image.

| Width | State | a (original) | b (candidate, OFF) | diff | Raw result (unadjudicated) | Owner seen? |
|---|---|---|---|---|---|---|
| 1440×900 | initial | `R/baseline-202609241334/desktop-1440x900/initial.png` | `R/candidate-202610261949/desktop-1440x900/initial.png` | `R/diff/desktop-1440x900.initial.diff.png` | PASS, 0 px | TODO |
| 1440×900 | layers | `…/desktop-1440x900/layers.png` | `…/desktop-1440x900/layers.png` | `R/diff/desktop-1440x900.layers.diff.png` | PASS, 0 px | TODO |
| 1440×900 | grid | `…/desktop-1440x900/grid.png` | `…/desktop-1440x900/grid.png` | `R/diff/desktop-1440x900.grid.diff.png` | FAIL: 0 px, but 1 original-surface geometry diff, 1 moved | TODO |
| 1440×900 | fullscreen | `…/desktop-1440x900/fullscreen.png` | `…/desktop-1440x900/fullscreen.png` | `R/diff/desktop-1440x900.fullscreen.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 1440×900 | about | `…/desktop-1440x900/about.png` | `…/desktop-1440x900/about.png` | `R/diff/desktop-1440x900.about.diff.png` | PASS, 0 px | TODO |
| 1440×900 | deeplink | `…/desktop-1440x900/deeplink.png` | `…/desktop-1440x900/deeplink.png` | `R/diff/desktop-1440x900.deeplink.diff.png` | PASS, 8 px (0.001 %) | TODO |
| 393×852 | initial | `…/android-393x852/initial.png` | `…/android-393x852/initial.png` | `R/diff/android-393x852.initial.diff.png` | PASS, 0 px | TODO |
| 393×852 | layers | `…/android-393x852/layers.png` | `…/android-393x852/layers.png` | `R/diff/android-393x852.layers.diff.png` | PASS, 0 px | TODO |
| 393×852 | grid | `…/android-393x852/grid.png` | `…/android-393x852/grid.png` | `R/diff/android-393x852.grid.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 393×852 | fullscreen | `…/android-393x852/fullscreen.png` | `…/android-393x852/fullscreen.png` | `R/diff/android-393x852.fullscreen.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 393×852 | about | `…/android-393x852/about.png` | `…/android-393x852/about.png` | `R/diff/android-393x852.about.diff.png` | PASS, 0 px | TODO |
| 393×852 | deeplink | `…/android-393x852/deeplink.png` | `…/android-393x852/deeplink.png` | `R/diff/android-393x852.deeplink.diff.png` | PASS, 2 px | TODO |
| 360×740 | initial | `…/android-360x740/initial.png` | `…/android-360x740/initial.png` | `R/diff/android-360x740.initial.diff.png` | PASS, 0 px | TODO |
| 360×740 | layers | `…/android-360x740/layers.png` | `…/android-360x740/layers.png` | `R/diff/android-360x740.layers.diff.png` | PASS, 0 px | TODO |
| 360×740 | grid | `…/android-360x740/grid.png` | `…/android-360x740/grid.png` | `R/diff/android-360x740.grid.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 360×740 | fullscreen | `…/android-360x740/fullscreen.png` | `…/android-360x740/fullscreen.png` | `R/diff/android-360x740.fullscreen.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 360×740 | about | `…/android-360x740/about.png` | `…/android-360x740/about.png` | `R/diff/android-360x740.about.diff.png` | PASS, 0 px | TODO |
| 360×740 | deeplink | `…/android-360x740/deeplink.png` | `…/android-360x740/deeplink.png` | `R/diff/android-360x740.deeplink.diff.png` | PASS, 5 px | TODO |
| 390×844 (iPhone geometry, Chromium) | initial | `…/iphone-390x844-geometry-only/initial.png` | `…/iphone-390x844-geometry-only/initial.png` | `R/diff/iphone-390x844-geometry-only.initial.diff.png` | PASS, 0 px | TODO |
| 390×844 | layers | `…/iphone-390x844-geometry-only/layers.png` | same, candidate | `R/diff/iphone-390x844-geometry-only.layers.diff.png` | PASS, 0 px | TODO |
| 390×844 | grid | `…/iphone-390x844-geometry-only/grid.png` | same, candidate | `R/diff/iphone-390x844-geometry-only.grid.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 390×844 | fullscreen | `…/iphone-390x844-geometry-only/fullscreen.png` | same, candidate | `R/diff/iphone-390x844-geometry-only.fullscreen.diff.png` | FAIL: 0 px, 1 moved, hitΔ 1 | TODO |
| 390×844 | about | `…/iphone-390x844-geometry-only/about.png` | same, candidate | `R/diff/iphone-390x844-geometry-only.about.diff.png` | PASS, 0 px | TODO |
| 390×844 | deeplink | `…/iphone-390x844-geometry-only/deeplink.png` | same, candidate | `R/diff/iphone-390x844-geometry-only.deeplink.diff.png` | PASS, 7 px | TODO |

`…/` stands for `R/baseline-202609241334/` in column a and `R/candidate-202610261949/` in column b. All 24 baseline, candidate and diff files existed at 2026-10-26 ~23:00 UTC, checked with `test -f`.

**Placeholders, to fill in later:**
- **Lightning ON at the four widths (7D, feed fallback):** TODO; lane B or D has to produce these. For the live receipt, see `evidence/owner-device-20261026/iphone-safari-live-pages-v202610261949-7d-ON-2244.png` (real iPhone Safari, 7D ON).
- **R01 alternatives A, B and C:** the screenshot list is in OWD §R01. Lane B's raw R01 captures are in `evidence/visual-challenge-B/r01/`.
- **Hardened SHA re-run (same harness):** TODO.
- **Supplemental 1280×720 and 1920×1080:** these are in the same run. Raw rows for 1280×720 deeplink and for 1920×1080 grid, about, fullscreen and deeplink are `n/a` or FAIL with no data (the run was incomplete or was resumed in `parity/runs/resume-1920x1080`).

## Unresolved differences

Every item is unresolved until lane B reports and a reviewer adjudicates it. Owner rulings are in OWD and are only linked here.

1. **Weather group appended last** in the Layers panel and the curtain. This is the approved additive affordance. Raw geometry: group count 13→14, inputs 65→68 in `#scada-ui-container`; Grid panel child count 3→4.
2. **Grid footer row.** `.gm-panel-body` is 78 px shorter when Grid is open, and the row is mouse-unreachable at 1440×900 and 1280×720 windowed. Raw parity marks grid and fullscreen FAIL at every width (1 moved element). Which element moved is not yet stated by lane B. Owner decision R01 is in OWD §R01.
3. **The pre-existing "▾ HIDE LAYERS" button hides the end of the lightning caption** when lightning is ON. It was seen on the real iPhone (`evidence/owner-device-20261026/README.md` item 3) and under lead-shim at 1440×900. See hardening template HC-08. Lane B raw data: `evidence/visual-challenge-B/owner-defect/`.
4. **Long-period chips are dimmed in feed fallback with no reason given**, so the owner saw "stuck at 7 days" (DEV item 1; HC-07).
5. **Feed-mode "SEARCHED 2%".** Coverage is unknown in feed mode (DEV item 2; HC-06).
6. **Deeplink state** shows 2–8 changed px at each width (raw). The cause is not stated.
7. **Rulings still pending:** FAIL keeps the switch ticked (R03), v1 index refused (R02), no drill-down (R04/R05) and point caps (D11). See OWD.
8. **ChatGPT findings H01–H05.**
   - H01 and H02 match overlay-review defects that were reproduced in a browser under lead-shim (HC-01, HC-02).
   - H03, H04 and H05 have failing runs in a Node VM only (HC-09, HC-10, HC-11). H04's numeric-validation part also appears in the overlay-review Node probe.
   - None of the five has been reproduced on a real device.
9. **Public route.** OWD's "Live route" section says no public URL exists. That is now outdated: DEV records the owner loading `https://ventusltd.github.io/gridatlas/atlas/v/202610261949/`, published by main 3c5717e. Whether 3c5717e left `atlas/current.json` and `STATE.md` unchanged has not been verified by this lane, and V13 needs re-checking.
10. **Not observed anywhere yet:**
    - real Android Chrome;
    - the iPhone Grid dropdown, OFF parity and reload;
    - CORS and cache headers in a HAR (R07);
    - REPD/DuckDB and basemap glyphs (R08).

## Owner questions

The first six are asked, with defaults, in OWD "Decisions at a glance". Answer them there:

| # | Question (short) | Where |
|---|---|---|
| Q1 | R01 desktop Grid mirror: A (as built), B or C | OWD §R01 |
| Q2 | R02: PR #2 is the only archive producer; PR #1 is closed unmerged | OWD §R02 |
| Q3 | R03: on failure, keep the switch ticked with [FAIL] and amend V10 | OWD §R03 |
| Q4 | R04/R05: is CUSTOM + dates + APPLY acceptable for opening a day | OWD §R04/R05 |
| Q5 | D11: 10,000 phone / 40,000 desktop caps, or 20,000 desktop | OWD §D11 |
| Q6 | Step E: will you run the network and device checks, and authorise an HTTPS preview | OWD "Residual BLOCKED" |

These were raised after OWD was written. Each needs an owner answer, or confirmation that it is a reviewer call:

| # | Question | Why it is open | Default if unanswered |
|---|---|---|---|
| Q7 | In feed fallback, should the 30D–12M chips stay clickable and explain "archive not yet published; earlier coverage UNKNOWN, not zero", instead of greying out? | Your iPhone report ("stuck at 7 days"); HC-07 | Greyed out as built, which you reported as a defect |
| Q8 | In feed mode, should coverage read "unknown" instead of a percentage? | HC-06; OWD calls it an R06/D13 reviewer question | Reviewer rules |
| Q9 | Is it acceptable for the HIDE LAYERS button (original, unchanged) to overlap the last line of the lightning caption, or must the lightning group make room for it within the overlay? | HC-08; original bytes and CSS cannot change | Treat as a defect to fix inside the overlay if the byte budget allows |
| Q10 | Which overlay ceiling governs: 24,781 B (cartridge arithmetic, lead) or 24,000 B (PR #30 report, used by ChatGPT's static check)? | Decides how many fixes fit: 808 B or 27 B of headroom | Reviewer and owner; no fix lands above 24,000 B until this is ruled |
| Q11 | Is the main 3c5717e publication of `/atlas/v/202610261949/` the "legitimately published" preview route for §12 F, and was it intended to be the unhardened generation? | DEV; issue §2 and §13 stop rule ("stop and report if a … live pointer … moves unexpectedly") | Lead verifies that the pointer and STATE are untouched, then records it |
| Q12 | The V3 copied-loader wording conflict, the V10 STALE threshold (24 h feed vs 4 h index) and the V15 metric (all body mutations vs lightning-caused only) | `reports/opus-decision-table.md` D1, D6 and D10 | Reviewer rules; owner amends veto text only if asked |
