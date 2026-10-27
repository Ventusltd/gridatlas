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

\* 1440 deep-link is a harness flake (solar-layer opacity and card-parking timing), reproduced baseline-vs-baseline (`selfcheck-baseline-deeplink-1`). Additive-host growth (14 vs 13 groups, Weather last) is expected; `<style>` lists are identical in every cell.

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

1. `page.evaluate(STRING, arg)` returned `undefined` in Playwright, so the first `p14-p15.mjs` run produced nothing. Fixed with an `ev()` helper and logged.
2. `originalRowsMovedByON=65` in `p14-p15-*.json` is an artefact (the element screenshot scrolls the container). The container-coordinate probe (`probe-on-reflow-and-curtain.v2.json`) shows 0/65 moved.

## Commands (BEFORE)

All runs are from `E/parity`.
- `parity-harness.mjs --baseline B --candidate C --additive '[data-lightning-group]'` with `--viewports`, `--states` and `--out` as in the logs (`logs/*.log`, `runs/*/harness.log`).
- Self-checks pass B as both baseline and candidate.
- The other scripts run as `node <script>`: `r01/r01-grid-footer.mjs`, `p14-p15/*.mjs` and `owner-defect/hide-layers-occlusion.mjs`.
- Not tested: real devices (BLOCKED_HARNESS); tiles and REPD/DuckDB (BLOCKED_DEPENDENCY).

## AFTER runs: E = 202610270024 and F = 202610270047 (updated 01:05 UTC 27 Oct)

- **Provenance:**
  - E: overlay sha256 2976cae7…, worktree 0424d45.
  - F: overlay sha256 421f3d7e…, 24,773 B, worktree 9e9d655.
  - Both loaders are byte-identical to atlas/index.html. Production c08f3a6 unchanged.
- **Setup:** ports 8191 (E) and 8193 (F); one browser and one context at a time.
- **Harness:** the parity harness unchanged; lead-shim plus the lightning-archive fixture for ON. Phones are Chromium emulation, NOT WebKit.
- **Evidence:** `evidence/visual-challenge-B/after-2026102700{24,47}/`.
- **202610262323:** its partial run before the restarts is in `after-202610262323/` (P02 FAIL at 1440: PIPELINE NEWS group +10 px).

| ID | BEFORE 261949 | E 270024 | F 270047 | evidence (F) | command (F folder) |
|---|---|---|---|---|---|
| P14 / M01, main panel **mid-scroll** (393x659, 390x664, 375x548, 430x739, 393x852) | FAIL | **FAIL**: 3–8 covered scroll positions per viewport | **PASS**: 0 covered positions in all 5 viewports, 45–48 steps each | `m01/m01-sweep-202610270047.json` | `GEN=202610270047 INSETS=0 ./with-servers.sh node m01-sweep.mjs` |
| P14 / M01, main panel at the end | FAIL | PASS | PASS (atEnd 0) | same | same |
| P14 / M01, curtain mid-scroll (iPhone-UA CSS fullscreen; 393x659, 375x548, 393x852) | not measured | 0 covered (control) | 0 covered; paddingRight 144 px | `m01/m01-sweep-202610270047-curtain.json` | `… CURTAIN=1 VPS=393x659,375x548,393x852 …` |
| P02 / P10, 36 cells | FAIL (Grid body −78 px) | PASS, 0 moved | **PASS**: 0 moved original elements in all 36 cells, Grid-open included; 0 original surface diffs | `parity/<viewport>/SUMMARY.md` | `./run-parity-per-viewport.sh <viewport>` |
| P11 | PASS | PASS, 0.000 % | **PASS**: 0.000 % in all 36 cells (after one 1920 rerun) | same | same |
| M04 / P15 | FAIL (`#555`, 9 px, 2.73:1) | captions 12 px `#bbb` 10.6:1; **footer 11 px** | not re-measured (F changes dots and insets only) | — | — |

**Notes**
- **M01 reproduction.** Order: load with Layers closed, tap LAYERS, lightning ON, then 60 px real-wheel sweep. This reproduces the owner's overlap on 202610262323 at every tested viewport, in mid-scroll only.
- **E's cause.** `fit()` measured the 91 px "▴ LAYERS" button, giving `paddingRight` 103.5 px where 143.4 px is needed. A forced re-fit cleared it.
- **F's fix.** F gets 143.406 px from its ResizeObserver, and the overlap is gone.
- **Curtain control is weak.** The curtain sweep did not separate E from F (E had 0 covered with `paddingRight` 0). At 393x852 the curtain ends at y≈596, above the button (y 796). Read that row as "no overlap observed", not as proof that the fix works there. Android profiles cannot reach the curtain on either route (pre-existing).
- **34 px bottom inset.** `env(safe-area-inset-bottom)` is 0 without `viewport-fit=cover`, which atlas/index.html lacks. The overlay emulation covered the toggle itself, so it was not used. Evidence: `after-202610270024/m01/*inset-run.json`.
- **Real iPhone.** Still an owner check (BLOCKED_HARNESS).
- **Deep-link flake on F** (harness timing, not a regression):
  - Three cells (393, 1280; E also had 1440 and 390) record styleΔ 2, the `#lbl-solar` opacity loading flake, reproduced baseline-vs-baseline.
  - The first 1920 deep-link run (`parity-desktop-1920x1080-run1-popup-flake/`) placed the original deep-link card docked (x 17) instead of anchored (x 790), giving 20 % pixels. The rerun passed 6/6. The same placement flake appeared once on BEFORE (repeat-1) and is map-timing.
- **Not covered by parity.** F's dot radius change is on the map canvas, which is masked, so parity says nothing about the dots. ON states grow `#scada-ui-container` scrollHeight by up to +128 px (additive-host, after all original groups).
- **OWNER_DECISION:** footer caption at 11 px versus the M04 12 px target.

### G = 202610270113 (final run, complete 01:35 UTC)

- **Provenance:** overlay sha256 d17d3035…, 24,777 B; worktree f6c95db; loader identical; production c08f3a6. Port 8196, one browser at a time. Evidence in `after-202610270113/`.
- **Commands:** the same as F, run from the G folder.

| ID | F 270047 | G 270113 | evidence |
|---|---|---|---|
| M01 main panel, mid-scroll and end (393x659, 390x664, 375x548, 430x739, 393x852) | PASS | **PASS**: 0 covered positions, atEnd 0; padding 72 px bottom / 143.406 px right | `m01/m01-sweep-202610270113.json` |
| M01 curtain, mid-scroll and end (same 5 viewports, iPhone-UA CSS fullscreen) | PASS (3 viewports) | **PASS**: 0 covered, atEnd 0 (weak discriminator, see F note) | `m01/…-curtain.json` |
| P02 / P10 (36 cells) | PASS | **PASS**: 0 moved original elements in every non-deep-link cell (30/30), Grid-open included. The deep-link cells are PASS after reruns (below). | `parity/<viewport>/SUMMARY.md`, `deeplink-rerun/`, `deeplink-1920-repeat/` |
| P11 | PASS | **PASS**: 0.000 % in all settled cells | same |

**Deep-link flakes**

- **Card-parking race in the original `popup-viewport` module.** The module parks the deep-link card (`gridatlas-free`) if its rect falls outside the map at measurement time.
  - 1440 (first G run): the **baseline** card parked and the candidate's did not (57 "moved", 19 % pixels). The rerun passed on moved and pixels; the only difference was the `#lbl-solar` opacity flake below.
  - 1920: the candidate card parked in 2 of 5 runs (20 % pixels), and in 1 of 2 runs on F.
  - The **3 alternating 1920 repeats all PASS**, and the baseline-vs-baseline self-checks at 1440 and 1920 PASS.
  - Parking happens in both directions, so I classify it as a pre-existing timing race, not a regression. It is the only residual intermittent visual difference, and the owner should be aware of it.
- **`#lbl-solar` opacity (styleΔ 2).** Seen at 360 and 1280. This is the known solar-layer loading flake, reproduced baseline-vs-baseline.
