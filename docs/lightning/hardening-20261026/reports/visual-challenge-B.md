# visual-challenge-B: issue #32 Step B (visual parity, layout, reachability, accessibility)

- **Lane:** visual-challenge-B. This run resumed after a container restart. Finished cells from the first run are kept as they were. Only the missing cells were run again.
- **Candidate:** generation 202610261949 at fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d, read-only worktree `hardening/wt`.
  - The worktree HEAD is now df3cb71.
  - `git -C wt diff --stat fda6b10 HEAD -- atlas tools .github` returns **empty**, so everything under test is byte-identical to fda6b10. Only `docs/` changed (268 files).
  - Receipt: `evidence/visual-challenge-B/logs/resume-00-worktree-check.txt`.
- **Production:** /home/claude/gridatlas c08f3a6178752d9ccc77ce76451107f28375a8b2, generation 202609241334, untouched.
- **Routes:**
  - Baseline: `http://127.0.0.1:8141/gridatlas/atlas/` (serves /home/claude).
  - Candidate: `http://127.0.0.1:8142/wt/atlas/v/202610261949/` (serves `scratchpad/hardening`).
  - Both servers were restarted at 22:56 UTC. Logs are in `logs/http-814{1,2}.log`.
- **Browser and harness:**
  - Chromium 153.0.8010.12 headless, Node v22.23.4, Playwright from /home/claude/gridatlas/node_modules.
  - The lead's offline shim (`lightning/harness/offline-shim.mjs`) was used unmodified, labelled **lead-shim**.
  - Phones are **Chromium emulation** (isMobile, hasTouch, Android UA). "iphone-390x844-geometry-only" is Chromium with an iPhone UA. It is **not WebKit or Safari** (BLOCKED_HARNESS for real iOS).
  - Lightning is OFF for parity. ON tests use the fixture `lightning/fixtures/lightning-archive/data`, built from the genuine 408-flash seed. Every artefact names its harness and viewport.
- **Gestures:** real `click()`, `tap()` and `mouse.wheel()` only. No `force:true`. Simulation B in R01 is `page.evaluate` in one browser session only. No file was modified.
- **Abbreviation:** `E` = `scratchpad/hardening/evidence/visual-challenge-B`.

## Results

| ID | Result | One-line finding | Evidence | Command |
|---|---|---|---|---|
| P02 | **FAIL** | When the Grid dropdown is open (the `grid` state, and the `fullscreen` state, which opens Grid), **1 original element changes size** at all 6 viewports: `#gridatlas-menu-bar-panel-4 .gm-panel-body` is 78 px shorter. It loses visible proxy rows; for example, at 1920 the last visible row is "Offshore Wind" instead of "Battery Storage". The panel also gains `scrollWidth` +43…+50 px. No original element moves in rest, Layers, About or deep-link. ON state, desktop only: the original PIPELINE NEWS group box stretches from 98 to 227 px high (grid-row stretch), but its rows do not move. | `E/parity/runs/full-matrix-OFF/SUMMARY.md`, `E/parity/runs/resume-1920x1080/SUMMARY.md`, `E/p14-p15/probe-on-reflow-and-curtain.v2.json` | see §Commands 1–3, 7 |
| P10 | **FAIL** (same root cause as P02; placement itself = R01 OWNER_DECISION) | 36 cells (6 viewports × 6 states). 26 PASS, 10 FAIL. Every FAIL is a Grid-open cell and has the single cause above: the footer mirror shrinks the original panel body. All rest, Layers, About and deep-link cells PASS on geometry, styles, `<style>` list and hit targets. | `full-matrix-OFF`, `resume-1920x1080`, `deeplink-repeat-{1,2,3}`, `selfcheck-baseline-deeplink-{1,2,3}` | §1–4 |
| P11 | PASS (pixel bar), with a caveat | Masks: `#clock`, `#date`, `#days`, `.maplibregl-canvas` and `[data-lightning-group]` only. The PR #31 live-count suffix mask is OFF. The largest changed area is 0.011 % (390x844 deep-link), against a 0.1 % threshold. **Caveat:** the additive mask covers the footer band, which is where the panel body was cut. So the Grid-open cells show 0 changed pixels even though an original element shrank. Only the geometry check catches it, so pixel parity alone is not evidence of zero movement. | same as P10, `*/diff/` | §1 |
| P14 | **FAIL** (new owner-device defect reproduced) + pre-existing clipping separated | (a) Main Layers lightning toggle: reachable at all 6 viewports by real wheel (4–6 steps); PASS. (b) Grid footer mirror: blocked at 1440 and 1280 (clipped by `#map-container` overflow:hidden) and on phones when Layers is open. The **original "⬇ Layers" tab is blocked in exactly the same cases on both routes** (pre-existing). That is R01. (c) Fullscreen curtain: 0 of 860 sampled points are hit-testable inside `#fs-curtain` on desktop and Android emulation, **on both routes**. So the original PIPELINE NEWS curtain rows and the lightning fs toggle are both blocked (pre-existing). Reachable in the iPhone-UA profile. (d) **"▾ HIDE LAYERS" occlusion, see §Owner-device defect: FAIL (defect).** | `E/p14-p15/p14-p15-{desktop,phone}.json`, `probe-phone-both-routes.json`, `probe-curtain-what.mjs` log, `E/owner-defect/` | §5–9 |
| P15 | **FAIL** (contrast), otherwise PASS | Name, role and state are correct. Contrast fails on the lightning footer caption and the status line. Full details are in §P15. | `E/p14-p15/p14-p15-*.json` | §5 |
| R01 | **OWNER_DECISION** | Option A (footer, as built) and Option B (head-slot checkbox, simulated only) both change the original Grid panel. The figures are in §R01. A third option, C (no Grid mirror), would satisfy P02. | `E/r01/r01-geometry.json`, `E/r01/side-by-side-{1440x900,1280x720,1920x1080,393x852}.png`, `*-SIM-B1/B2-NOT-APPLIED.png` | §6 |
| R12 | PASS for this lane's artefacts, with two disclosures | Every artefact here names its route, generation, harness, viewport and command. The two disclosures are in §R12. | this file, `logs/` | — |

## P10/P02 cell detail (OFF, lead-shim)

| viewport | rest | Layers | Grid | About | fullscreen (Grid+curtain) | deep-link |
|---|---|---|---|---|---|---|
| desktop-1440x900 | PASS | PASS | FAIL body −78 | PASS | FAIL body −78 | PASS* |
| android-393x852 (Chromium) | PASS | PASS | FAIL body −78, last visible "Railways"→"Airports" | PASS | FAIL | PASS |
| android-360x740 (Chromium) | PASS | PASS | FAIL body −78, "Data Ctrs"→"Industry" | PASS | FAIL | PASS |
| iphone-390x844 (Chromium iPhone UA, geometry only) | PASS | PASS | FAIL body −78 | PASS | FAIL | PASS |
| desktop-1280x720 | PASS | PASS | FAIL body −78 | PASS | FAIL | PASS (repeats 1, 2; the first-run cell crashed) |
| desktop-1920x1080 | PASS | PASS | FAIL body −78 | PASS | FAIL | PASS (resume run; the first-run baseline renderer crashed, "Target crashed") |

\* **1440x900 deep-link is non-deterministic in this harness, and not because of the candidate:**
- Runs: full-matrix PASS; repeat-1 FAIL (the free deep-link popup was placed at x 205 vs 17, 55 elements moved); repeat-2 FAIL (styleΔ 2); repeat-3 FAIL (styleΔ 1).
- Signature: `#lbl-solar`/`#fs-lbl-solar` opacity 1 vs 0.5, the solar layer still loading while DuckDB is blocked.
- **Baseline-vs-baseline self-check** (`selfcheck-baseline-deeplink-1`) reproduces the same opacity diff, with styleΔ 2 and no candidate involved. Self-checks 2 and 3 PASS.
- I classify the deep-link flake as harness timing (BLOCKED_DEPENDENCY: DuckDB/REPD), not a regression.
- The popup-placement variant (repeat-1) was not reproduced in 3 self-checks. It is a map-anchored popup, so map-load timing is the likely cause. It is unproven, so I report it as such.

Additive-host differences on every cell are expected and do not fail a cell:
- 14 vs 13 groups in `#scada-ui-container` and `#fs-curtain-keys`, with Weather last.
- `menu-panel-Grid` has 4 children instead of 3.
- 68 vs 65 inputs.
- On phones, the scroll height grows by +56 px.
- `<style>` lists are identical in every cell.

**Proposed minimal fix for the P02/P10 FAIL** (depends on the owner's R01 choice; I do not apply it): in the overlay's menu-mirror builder, either
- (C) do not append the `[data-lightning-group="menu"]` footer to `#gridatlas-menu-bar-panel-4` at all, which brings back zero original movement; or
- (A′) keep it, but the owner records the −78 px body as an approved exception.

The +49 px `scrollWidth` comes from the mirror's visually hidden input. Its rect is 469 px wide and starts at x −38 on a 393 phone. Clamping its width to the label (`width:1px;height:1px` like the main toggle) removes that overflow.

## Owner-device defect: "▾ HIDE LAYERS" covers the lightning caption (P14)

Context: owner iPhone Safari observation 22:44 UTC, `wt/docs/lightning/hardening-20261026/evidence/owner-device-20261026/README.md`, defect 3.

Reproduced in Chromium phone emulation (not Safari):
- Setup: Layers opened by a real tap on the toggle, lightning switched ON by a real tap, `#scada-ui-container` wheeled to its end.
- Harness: lead-shim + the fixture, which ends in state PARTIAL / STALE.
- Script: `E/owner-defect/hide-layers-occlusion.mjs`. Output: `hide-layers-occlusion.json`.

| viewport | button rect (fixed, z 9999) | baseline: last original group (PIPELINE NEWS) | candidate ON: lightning group | candidate OFF |
|---|---|---|---|---|
| 393x852 | 248.6,796 132x44 | 1/4 lines covered: "All pipeline [SELECT A PROJECT]" (21 %) | **3/19 lines covered**, all the `footer` caption: 0.7 %, 34.4 %, 21.8 % | label "Lightning flashes (optical) [WAIT]" 28 % covered |
| 360x740 | 215.6,684 132x44 | 1/4: "All pipeline …" (35 %) | **3/17**: 3.1 %, 39.4 %, 39.4 % | label 41 % covered |
| 390x844 (iPhone UA, geometry only) | 245.6,788 132x44 | 1/4 (22 %) | **3/19**: 0.8 %, 35.3 %, 22.9 % | label 29 % covered |

`elementFromPoint` at the centre of each overlap returns the button. The covered words are the end of the footer disclaimer: "…not confirmed ground s[trikes] · Missing days are unknown, not zero · UK box −11.0,49.5 → 3.0,61.5". This is the D01/D07 honesty wording.

- **Before and after:** on the baseline the same button covers the last row of the last original group. The defect is pre-existing in `202609241334-sld-sandbox-v9-8.js` (`dashCollapse`, `#gridatlas-dash-toggle{position:fixed;right:12px;bottom:12px}`) together with the container's 5 px bottom padding. In the candidate the occluded content becomes the lightning caption, and the original "All pipeline" row is no longer covered (0/0).
- The text cannot be read by any gesture. The container is already at max scroll, and the only other control is the button itself, which hides the panel.
- Visual: `E/owner-defect/side-by-side-393x852-bottom-baseline-vs-candidateON.png` (left baseline, right candidate ON), plus `*-layers-end-{OFF,ON}.png` per viewport.
- **Severity:** defect (not release-blocker). Mandatory scientific-caveat text is partly hidden on every phone. **Proposed minimal fix (overlay-only, additive):** give the overlay's own main group a bottom spacer ≥ 56 px (44 px button + 12 px inset). Apply it only when `#gridatlas-dash-toggle` exists and the viewport is a phone, for example `margin-bottom:56px` inline on `[data-lightning-group="main"]` in the main-group builder (line 134–136 template). It must not touch the original button or `#scada-ui-container` CSS. Original rows do not move, because the lightning group is last.

## R01 detail (lead-shim, OFF, Grid opened by real click)

Script: `E/r01/r01-grid-footer.mjs`. Output: `r01-geometry.json`. Log: `logs/r01.log`.

| viewport | #map-container bottom | A footer (as built) | original "⬇ Layers" tab | body height base → A | B (simulated, not applied) |
|---|---|---|---|---|---|
| 1440x900 | 524 | y 534–612, **blocked** (clipped by #map-container); a real wheel does not reveal it (mapContainer scrollTop stays 0) | blocked (pre-existing) | 512 → 434 | row at y 100–144, hit=self; **all 65 proxies move +44 px**; B1 body 390, B2 body 468 |
| 1280x720 | 412 | y 432–510, **blocked** | blocked (pre-existing) | 410 → 332 | same shift, 65/65 +44 px |
| 1920x1080 | 636 | reachable (hit=self) | reachable | 512 → 434; visible proxies 22 → 18 | same shift |
| 393x852, Layers collapsed | 844 | reachable | reachable | 698 → 620 | same shift |
| 393/360/390, Layers open | 494/425/489 | **blocked** (P14 run) | blocked on both routes, occluder = Layers content | — | — |

- **A:** an optional secondary affordance. It is blocked exactly where the original tab is already blocked, and it shrinks the original body by 78 px everywhere.
- **B:** reachable everywhere, but it moves every original proxy. B must not be applied silently.
- **C (my preferred disposition):** drop the Grid mirror. The main Layers toggle is reachable at every viewport, so the mirror is not required.
- If the owner keeps A, record the −78 px as an approved exception and clamp the hidden input width.
- Side-by-sides: `E/r01/side-by-side-*.png` (baseline | candidate A | B2).

## P15 detail (candidate, lead-shim + fixture)

- **Toggle:** a native `<input type=checkbox>` wrapped in a `<label>`. Accessible name "Lightning flashes (optical) [WAIT]", the same pattern as original rows. Space toggles it ON (`checked=true`, `state.on=true`, focus kept); Space again turns it OFF (layer removed).
- **Menu mirror:** `aria-label="Lightning flashes (optical)"`, the same pattern as the original proxies.
- **Captions:** the caption region has `role=status` and `aria-live=polite`.
- **Group label:** the group has no role or aria-label, the same as the original groups.
- **Contrast** (WCAG 2, composited on #050505):
  - label 15.4, group title 11.3, caption 5.75, warning 13.5, active chip 14.5, chip 5.75;
  - **footer caption `#555` 9 px = 2.73:1** (fails AA);
  - **status line 8 px = 2.73:1** (fails AA; this colour comes from the reused shell class `.status-dot`);
  - for reference, the original row label "400kV" is 3.6:1, so the shell palette itself is below AA.
- **Proposed fix:** in the main-group template, overlay line 136 (`k==='footer'?' style="font-size:9px;color:#555"'`), change `#555` to `#888` (5.75:1, +0 bytes). For the status line, set the overlay's own inline colour. Do not touch `.status-dot` CSS.
- **Motion and flashing:**
  - 0 CSS animations or transitions in the group (`getAnimations()`=0).
  - Idle: 0 changed frames in 12 frames over 5 s.
  - Loading → ready: exactly 1 frame changes (9.8–17 % of the group). That is a single state transition, not flashing.
  - `prefers-reduced-motion: reduce` is honoured trivially (identical results). No sound.
  - Map-canvas flash rendering was not assessed (canvas masked / no tiles: BLOCKED_DEPENDENCY).
- **Target sizes:** chips are 44x44 on phones and 37x22 on desktop (mouse pointer).

## R12 disclosures

1. **Script bug found and fixed (original script already in my folder):**
   - In `p14-p15.mjs`, `page.evaluate(STRING, arg)` returns `undefined`, because Playwright does not call a function-valued string. That is why the first run produced no output.
   - I replaced these calls with an `ev()` helper and logged the change in `logs/resume-00-worktree-check.txt`.
   - The curtain wheel point was moved from the container's geometric centre (covered by the map canvas) to a scanned hit-testable point.
2. **p14 artefact in `p14-p15-*.json` (superseded):**
   - `originalRowsMovedByON=65` is an artefact. The element screenshot used for the flashing sample scrolls the container between the two viewport-coordinate measurements.
   - The dedicated probe (`probe-on-reflow-and-curtain.v2.json`) measures in container coordinates with no screenshot in between. It finds **0/65 rows moved** at 1440 and 1920, scrollTop unchanged, rows restored after OFF.
   - `probe-on-reflow-and-curtain.v1-wrong-wheel-point.json` is kept and labelled.
- `full-matrix-OFF-run1-superseded-classification/` is the first run, before the additive-host classification. It is kept and not used for verdicts.

## Commands (run from `E/parity` unless stated; B = baseline URL, C = candidate URL)

1. `node parity-harness.mjs --baseline B --candidate C --additive '[data-lightning-group]' --out runs/full-matrix-OFF`. Log: `logs/full-matrix-OFF.stdout.log`.
2. `… --viewports desktop-1920x1080 --out runs/resume-1920x1080`. Log: `logs/resume-1920x1080.log`.
3. `… --viewports desktop-1440x900,desktop-1280x720 --states deeplink --out runs/deeplink-repeat-{1,2}`, and `… --viewports desktop-1440x900 --states deeplink --out runs/deeplink-repeat-3`.
4. Self-check: `--baseline B --candidate B --viewports desktop-1440x900 --states deeplink --out runs/selfcheck-baseline-deeplink-{1,2,3}`.
5. `cd E/p14-p15 && VPS=desktop-1440x900,desktop-1280x720,desktop-1920x1080 OUTNAME=p14-p15-desktop.json node p14-p15.mjs`, and the phone equivalent with `OUTNAME=p14-p15-phone.json`.
6. `node E/r01/r01-grid-footer.mjs`
7. `node E/p14-p15/probe-on-reflow-and-curtain.mjs`, `node E/p14-p15/probe-phone-both-routes.mjs`, `node E/p14-p15/probe-curtain-what.mjs`
8. `node E/owner-defect/hide-layers-occlusion.mjs`

Not tested here: real iPhone Safari or Android devices (BLOCKED_HARNESS, apart from the owner's own receipt); basemap tiles and glyphs, and REPD/DuckDB (BLOCKED_DEPENDENCY: masked or blocked by the shim).

## AFTER runs (updated 00:30 UTC 27 Oct)

**202610262323** (superseded, not the release candidate): partial only. Two container restarts and memory-cgroup kills (evidence `after-202610262323/crashed-under-load/`). Measured:
- P02 at 1440x900: FAIL in all 6 states. PIPELINE NEWS `div.key-group` grows by 10 px because the 64 px `paddingBottom` stretches the shared grid row.
- P11 at 1440x900: 0.000 %.
- P14 HIDE LAYERS in Chromium at 393 and 360: 0 caption lines occluded. ChatGPT's owner-iPhone veto (M01) reports otherwise on a real device.

**E = 202610270024** (variant E, overlay sha256 2976cae7…f890bf, 24,780 B; worktree 0424d45; loader identical; production c08f3a6 unchanged). Port 8191. ONE browser and ONE context at a time.

| ID | BEFORE 202610261949 | E 202610270024 | E evidence |
|---|---|---|---|
| P14 / M01 HIDE LAYERS, main panel and curtain | FAIL | running | `after-202610270024/` |
| P02 / P10 | FAIL | pending | |
| P11 | PASS | pending | |
| M04 / P15 font and contrast | FAIL (#555, 9 px) | source: caption 12 px `#bbb`, footer 11 px `#bbb` (overlay lines 139–140); measurement pending | |
