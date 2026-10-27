# OWNER-REVIEW — lightning candidate 202610261949 (draft for the lead)

Drafted 2026-10-26 22:50 UTC by opus-owner-decisions (issue #32 §12 F, §9 "Additional judgement").
- Candidate: generation 202610261949 at fda6b10 (PR #30, open draft, unmerged).
- Production: main c08f3a6 (generation 202609241334), untouched.
- Claude branch (remote 3bdb751): docs and evidence only.

Evidence labels: **lead-shim** = offline Playwright shim, Chromium 153 headless; phones are Chromium emulation, not Safari. Nothing here was observed on a real device.

Screenshots: the visual lane fills `evidence/visual-challenge-B/<viewport>-<state>-<a|b>.png`; each row says what -a and -b show. Interim images are in `evidence/opus-owner-decisions/shots/`. Line refs: module = `atlas/modules/202610261949-uk-lightning-overlay.js`; substation-intelligence = `atlas/cartridges/202609062358-substation-intelligence-v9-63.js`.

## Decisions at a glance

| # | Your decision | If you don't answer | Blocks release? |
|---|---|---|---|
| R01 | Desktop Grid-menu lightning switch: A footer (as built), B top of panel, C none on desktop | A | Yes, until you choose (§13.2) |
| R02 | Merge only lightning PR #2 (index v2), close PR #1 (v1)? | v2 only; v1 shows an explicit error | Only if PR #1 is merged |
| R03 | On failure: switch stays ticked with [FAIL] and the reason, or unticks (V10 as written)? | Stays ticked; amend V10 | Only if V10 is held literally |
| R04/R05 | Is CUSTOM + dates + APPLY acceptable for opening one day from a long summary? | Accept | No |
| D11 | Keep 10,000 phone / 40,000 desktop point caps, with clusters above? | Keep, after a defect fix | No, once fixed |
| R07/R08/E | Will you run the network and device checks; will you authorise an HTTPS preview? | BLOCKED | Yes |

## R01 — Grid dropdown lightning switch on desktop (P14)

**What you see.** At 1440×900 the map frame (`#map-container`, `overflow:hidden`) ends at y=524, but the open Grid panel runs to y=660 (at 1280×720: 412 vs 558). Nothing there is clickable: not the original's own "⬇ Layers" tab, and not the candidate's new "Weather · EUMETSAT Lightning Imager" row (y=562–606). The row is clickable at 1920×1080, on phones and in desktop full-screen.

Keyboard users can still reach the row: 65 Tab presses from the Grid title. Focusing it slides the whole frame, menu bar included, up 137 px (147 px at 1280×720) until Escape. The original's "⬇ Layers" tab does the same (137/143 px). On desktop, the full lightning control sits at the end of the Layers panel, which is open on arrival.

**Options.**
- **A — footer, as built.**
  - Moves 0 of the 63 original Grid rows: engine:400 is at the same screen spot on both routes, and ArrowDown still lands on it.
  - The list box is 78 px shorter (512→434 px).
  - A mouse cannot reach the row at 1440×900 or 1280×720 windowed.
- **B — top of panel, `role=checkbox` (not applied).** Expected geometry comes from the menu-contracts head-slot probe (F3).
  - The row sits at y≈126–171 at 1440×900, 393×852 and 360×740, so it is reachable everywhere.
  - But all 63 original rows move down 71 px whenever Grid is open, and the visible list shrinks from 424 to 353 px (312→241 px at 1280×720; inferred, not measured).
  - ArrowDown is unaffected (it queries `button,input,[role="button"]`, substation-intelligence:4925), but in Tab order the switch would come before engine:400.
  - Period controls still cannot live in that menu (time-window-ux F7).
- **C — no desktop mirror; Layers panel only.** The desktop Grid menu should match the original (screenshot to confirm), and phones keep A. In desktop full-screen, however, the Grid menu is the only surface left (menu-contracts F5a/b). A's row was measured clickable there and switches lightning on (E5; the caption is not visible in full-screen, pre-existing). C leaves no switch in full-screen at all.

**Evidence.**
- `../lightning/evidence/atlas-implant-builder/verify/15-grid-clip-probe.txt` and `../lightning/evidence/atlas-implant-builder/verify/14-grid-open-geometry.txt`.
- `../lightning/reports/atlas-menu-contracts.md` F3/F6. F6's "visible without scrolling at every width" contradicts its own footer probe, whose label sits at y=562, below the 524 px edge (`../lightning/evidence/atlas-menu-contracts/menu-contracts.geometry.json` `runs[0].steps.grid_footer`).
- `evidence/opus-owner-decisions/owner-probe.json` (E1) and `evidence/opus-owner-decisions/owner-probe-E5.json`.

**Preferred (lead to confirm).** A, with the windowed-desktop mirror declared an optional secondary affordance. No original row moves, it is the only switch in desktop full-screen, and its clip is the one that already hides the original's Layers tab. B only if you accept the original list moving 71 px; C only if you want a pixel-identical desktop Grid menu and no switch in full-screen.

**Question.** "Accept A (mouse-unreachable at 1440×900/1280×720 windowed, like the original ⬇ Layers tab), or choose B or C?"
**Default.** A. The row stays OWNER_DECISION, and release waits.
**Screenshots.** a = A as built; b = a B mock (the visual lane's own copy, never committed):
- `evidence/visual-challenge-B/1440x900-gridmirror-a.png`, `evidence/visual-challenge-B/1440x900-gridmirror-b.png`
- `evidence/visual-challenge-B/1280x720-gridmirror-a.png`, `evidence/visual-challenge-B/1280x720-gridmirror-b.png`
- `evidence/visual-challenge-B/1920x1080-gridmirror-a.png`, `evidence/visual-challenge-B/1920x1080-gridmirror-b.png`
- `evidence/visual-challenge-B/393x852-gridmirror-a.png`, `evidence/visual-challenge-B/393x852-gridmirror-b.png`

C on desktop is the original Grid view: `evidence/visual-challenge-B/1440x900-grid-a.png`.

## R02 — index v1 refused (D08)

**What you see.** Today lightning main serves no index (`data/history/index.json` returned 404 at 22:26 UTC; `evidence/pr2-data-verifier/live-checks.txt`), so everyone gets the 7-day live-feed fallback.

With a v1 index served (lead-shim, synthetic fixture where only the schema string changed):
- the label reads `[408 | 7d]` and the status "PARTIAL · 408 FLASHES DRAWN · SEARCHED 2%";
- the refresh line says "…archive not yet published: unsupported index schema uk-lightning-history-index.v1; earlier hours unknown, not zero";
- 30D/3M/6M/12M are greyed out;
- a custom day older than 7 days shows a red FAIL, "needs the archive".

Nothing claims zero. But the v1 history is invisible, and "not yet published" is wrong for a published v1 archive.

**Producers.** Lightning PR #1 (open draft, 22e5579) writes v1. PR #2 (open draft, f7db76c) writes v2, and also reads v1, upgrading it on its next write (`history.py:42–43` at f7db76c). Neither is merged.

**Positions.** For refusing v1: PR #2 is the declared producer, and a v1 reader would duplicate its upgrade logic inside an 808-byte margin. For adding a v1 reader (PLAN 3.2): it protects against PR #1 being merged first.

**Preferred.** Keep v2-only: merge PR #2 and close PR #1. The lead should also change "archive not yet published:" to "archive unavailable:" (one constant, module line 11).
**Question.** "Will PR #2 be the only archive producer, with PR #1 closed unmerged?"
**Default.** v2-only, with D08 recorded as a visible, known deviation. On release day, confirm the served index is v2 (or 404).
**Screenshots.** a = v2 index at 7D; b = v1 index at 7D:
- `evidence/visual-challenge-B/1440x900-v1index-a.png`, `evidence/visual-challenge-B/1440x900-v1index-b.png`

Interim: `evidence/opus-owner-decisions/shots/E2-v1-index-1440x900-7d-group.png` and `evidence/opus-owner-decisions/shots/E2-v1-index-1440x900-custom-2026-10-12-group.png`.

## R03 — FAIL keeps the switch ticked (D15 vs V10)

**What you see** (lead-shim, missing-day fixture, 7D): all three switches stay ticked. The label shows "[FAIL]" at half opacity, with a red status "FAIL · 1 of 5 day files failed". 219 of 408 flashes are drawn, and the caption says "1 of 5 day files failed (2026-10-23 HTTP 404); points incomplete, counts from index". Unticking clears everything.

**V10 as written** (`../lightning/reports/atlas-merge-veto.md:62`): "…the toggle returns to OFF on error".

**Original precedent.** The engine marks a failed layer "[FAIL]" at opacity 0.5 and never unticks it (substation-intelligence:676–695; failure paths at 1289, 1307 and 1346). It unticks only a transit sub-layer that loaded with nothing drawable (1259–1280). Pipeline News unticks only when no project is selected, and says why (6650–6655).

**Arguments for keeping it ticked.**
- The caption sits in a container that is hidden whenever the switch is off (module line 155), so forcing OFF would hide the reason and the partial-data warning.
- The caption is a polite live region (line 135) that cannot announce while hidden, so a screen-reader user would not learn that their switch flipped.
- Retrying needs no re-tick.
- It matches the engine.

**Arguments for unticking.**
- A ticked box reads as "working".
- Someone who skips the caption may take partial points as complete.
- The half-opacity label lowers contrast (not measured; P15 lane).

**Preferred.** Keep it ticked. Propose amending V10 to: "an error shows a distinct FAIL state with its reason; the switch stays as the user set it, like the engine's layers". The ChatGPT reviewer must rule.
**Question.** "When lightning data fails, keep the switch ticked showing [FAIL] and the reason, or untick it and hide the reason?"
**Default.** Keep it ticked; the amendment is proposed, not assumed.
**Screenshots.** a = FAIL as built; b = the same page after unticking (no code change needed):
- `evidence/visual-challenge-B/1440x900-fail-a.png`, `evidence/visual-challenge-B/1440x900-fail-b.png`
- `evidence/visual-challenge-B/393x852-fail-a.png`, `evidence/visual-challenge-B/393x852-fail-b.png`

Interim: `../lightning/evidence/atlas-implant-builder/candidate-202610261949-lightning-archive-missing-shard-1440x900-ON.png`.

## R04/R05 — summaries cannot drill down; CUSTOM has no ◀/▶

**What you see** (lead-shim, 1440×900):
1. 3M draws no points. The caption reads "Flashes 408 archived on 93 overlapping UTC dates · none drawn (summary mode; choose ≤31 days for points)". There is no per-day list; the only clue is "first 2026-10-21 12:32:19 · last 2026-10-25 11:15:58 UTC (day-level)".
2. Tap CUSTOM. Both dates prefill with today, and ◀ PREV, LATEST and NEXT ▶ grey out. Until APPLY, the label and caption still describe the 3-month summary while CUSTOM is highlighted.
3. Enter 2026-10-23 twice and press APPLY: 189 flashes are drawn.
4. The next day needs both dates edited and APPLY again.

Busiest-day chips were dropped (candidate report §4.2–4.3).

**Positions.** Accept: everything shown is honest, and any day is reachable. Reject: users must guess dates, the pre-APPLY caption is ambiguous, and there is no day stepping.

**Preferred.** Accept for this release. If the byte margin allows, the lead should (1) let ◀/▶ step a custom window by its own length and (2) show "choose dates, then APPLY" on CUSTOM.
**Question.** "Is CUSTOM + dates + APPLY acceptable for opening a day from a 3/6/12-month summary, or must day stepping or shortcuts come first?"
**Default.** Accept, as a known limitation.
**Screenshots.** a = before APPLY; b = after APPLY:
- `evidence/visual-challenge-B/1440x900-custom-a.png`, `evidence/visual-challenge-B/1440x900-custom-b.png`
- `evidence/visual-challenge-B/393x852-custom-a.png`, `evidence/visual-challenge-B/393x852-custom-b.png`

Interim: `evidence/opus-owner-decisions/shots/E4-*.png`.

## D11 — point caps and clusters

**What you see.** Up to the cap, flashes are points, e.g. "408 drawn as points (index count 408 within the 10,000-point cap for this phone)". Above the cap they are amber circles sized by count, with no numbers, and the status reads "N FLASHES CLUSTERED". "Phone" means a coarse pointer or a viewport ≤700 px wide (module line 20).

**Origin.** The caps come from PLAN.md:66. On a throttled phone emulation, the budget lane measured 40,000 raw points at 6.0 s to idle, with 1.8 s blocks and +24 MB. It recommended clustering on desktop above 20,000 (`../lightning/reports/mobile-performance-budget.md` F6/F7, rec. 4; indicative only).

**Defect to fix first (for the lead).** The consent text says "LOAD POINTS draws the newest 40,000", but whole days are kept until the running total reaches 40,000, so the last day overshoots, and the 32 MB limit is not applied after consent (code reading). The builder's run loaded days with an index count of 119,902 (module lines 81–83; `../lightning/evidence/atlas-implant-builder/candidatepoints-202610261949-lightning-archive-big-count-1440x900.json`; synthetic counts). The download budget is the same on phones.

**Question.** "Keep 10,000 phone / 40,000 desktop with clusters above, or lower desktop to 20,000?"
**Default.** Keep as built, once the overshoot is fixed.
**Screenshots.**
- a = within cap, b = clustered: `evidence/visual-challenge-B/393x852-cluster-a.png`, `evidence/visual-challenge-B/393x852-cluster-b.png`
- a = before LOAD POINTS, b = after: `evidence/visual-challenge-B/1440x900-loadpoints-a.png`, `evidence/visual-challenge-B/1440x900-loadpoints-b.png`

## Residual BLOCKED (real device or live network only; shim runs never make these PASS)

- **R07: raw.githubusercontent.com CORS and caching.** BLOCKED_DEPENDENCY, because the shim always answers `access-control-allow-origin: *`. Context: a non-browser fetch (22:26 UTC) got the feed with `cache-control: max-age=300` and a 404 for the index. **You:** open the local route below in desktop Chrome, switch lightning on, then use DevTools → Network. Save a HAR, and note the status, `access-control-allow-origin`, `cache-control` and `age` for `index.json` and `uk_lightning.geojson`.
- **R08.** DuckDB Parquet (REPD technology layers, search) and basemap tiles/glyphs are BLOCKED_DEPENDENCY; WebKit is BLOCKED_HARNESS. **You:** in the same session, tick a REPD technology layer, search for a REPD project and check the map labels against the public original. Desktop Safari on a Mac at `127.0.0.1` exercises WebKit, but not iPhone touch.
- **Step E: devices.**
  - Android Chrome: enable USB debugging, run `adb reverse tcp:8000 tcp:8000`, and open the localhost route. Tap Grid → lightning, then LAYERS → the lightning group, then a period chip.
  - iPhone Safari: needs HTTPS. A phone opening `http://<computer-LAN-IP>` gets "GRIDATLAS COMPOSITION FAILED … reading 'digest'", because the loader verifies cartridges with `crypto.subtle` (atlas/index.html:27–28), which exists only on secure origins. This was measured in Chromium (E3) and affects the original route equally. Safari follows the same spec rule, but that was not tested here.
  - Record the device, OS, browser version, screenshots and taps.

**Question.** "Will you run these, and do you authorise an HTTPS preview for the iPhone (outside this work order)?"
**Default.** These stay BLOCKED, and so does release (§8 Step E).

## Live route (no public URL exists yet)

`atlas/v/202610261949/` exists only on PR #30's branch `candidate/202610261949-uk-lightning-additive` (fda6b10) and on the Claude branch. Pages builds from main (the last pages-build-deployment ran from c08f3a6, per atlas-merge-veto finding 2; inferred, because the Pages API is refused here). `git ls-tree` on main shows no `atlas/v/202610261949/`, so `https://ventusltd.github.io/gridatlas/atlas/v/202610261949/` does not exist. The public original, `https://ventusltd.github.io/gridatlas/atlas/`, works on your phone for the -a side.

On a desktop with real network:
```
git clone --branch candidate/202610261949-uk-lightning-additive --single-branch https://github.com/Ventusltd/gridatlas.git
cd gridatlas
git rev-parse HEAD        # fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d
cmp atlas/index.html atlas/v/202610261949/index.html && echo loader identical
shasum -a 256 atlas/cartridges/202610261949-sld-sandbox-v9-8.js   # b7d4d6657b1d52624b51a90da477291dbd079fa83adf97b678f4610cd8725f85
cd ..
python3 -m http.server 8000 --bind 127.0.0.1
```
Then open:
- `http://127.0.0.1:8000/gridatlas/atlas/` for the original;
- `http://127.0.0.1:8000/gridatlas/atlas/v/202610261949/` for the candidate.

Never use a LAN address (see Step E).

**Requests to expect for the candidate, in order:**
1. `v/202610261949/index.html` (5,223 B, a byte copy of the loader).
2. `v/202610261949/current.json` (50,403 B).
3. The shell `releases/202608300453-atlas-v9/index.html` and its assets.
4. Four cartridges, each SHA-256-checked: `202609241251-streaming-parquet-bridge-v9-5.js`, `202609071213-place-global-search-v9-5.js`, `202610261949-sld-sandbox-v9-8.js` (459,192 B = original 435,218 + newline + 23,973-byte module) and `202609062358-substation-intelligence-v9-63.js`.
5. jsDelivr, CARTO, and GridAtlas data from `ventusltd.github.io` and `raw.githubusercontent.com`.

With lightning off, there is no lightning request. After switching it on, expect `…/lightning/main/data/history/index.json` (404 today), then `data/uk_lightning.geojson` (XHR).

**What you should see today.** Off: identical to the original except the Weather group at the end of the Layers panel (and the Grid footer row at 1920×1080 and on phones). On: the yellow PARTIAL feed fallback "archive not yet published: HTTP 404", with the long periods greyed out. 24H may legitimately be empty; 7D shows the feed's points. "SEARCHED 2%" there reflects only the last 3-hour collection window recorded in the feed (an R06/D13 question for the reviewers).

## Side-by-side (lightning OFF) and unresolved differences

`evidence/visual-challenge-B/<viewport>-<state>-<a|b>.png`, where a = original and b = candidate.
- Viewports: 1440x900, 393x852, 360x740, 390x844 (iPhone-UA Chromium emulation).
- States: initial, layers, grid, fullscreen (plus about and deeplink).
- Example pair: `evidence/visual-challenge-B/393x852-grid-a.png` and `evidence/visual-challenge-B/393x852-grid-b.png`.

**Unresolved differences.**
1. The Weather group is appended last in the Layers panel and the curtain (the approved affordance).
2. The Grid footer row, and a list box 78 px shorter (R01).
3. The pre-existing fixed "▾ HIDE LAYERS" button covers part of the lightning caption's last line at 1440×900 ("…ground strike[s · Missing days are] unknown…"; `evidence/opus-owner-decisions/shots/E2-v1-index-1440x900-7d-group.png`). That mandated caveat must stay readable (D13); visual lane to quantify.
4. R02–R05 and D11 above.
5. ChatGPT-suite findings H01–H05 await reproduction (not adjudicated here).
