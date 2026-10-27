# veto-static-E — independent static/node:vm veto of generation 202610270024 (variant E, v9.162)

Lane: veto-static-E. NODE ONLY: no Chromium was started. Harness: `self-fixture` (node:vm v22.23.4 + `minidom.mjs`). One run used the REAL live feed bytes fetched from raw.githubusercontent.com at 00:3x UTC on 27 Oct (`feed-live.geojson`, 408 features). Evidence: `hardening/evidence/veto-static-E/` (EV/ below). Reviewed bytes: worktree commit 0424d45. These are byte-identical (git blob OIDs) to origin/main 1c19b76 and to the raw-served bytes (`EV/V13-main-vs-reviewed.txt`, `EV/served-bytes.txt`). Other lanes' reports were not used as evidence. Every number below comes from my own runs.

## Results table

| ID | Status | Evidence (EV/) | Command |
|---|---|---|---|
| V1 tamper baseline | PASS | V1-sha256.txt, V1-candidate-hashes.txt | `sha256sum -c baseline-manifest.fixed.txt` (31/31 OK). Cartridge = live 202609241334 + "\n" + module (`cmp` identical). All 4 hashes in the route current.json and the manifest OK. |
| V2 bridge untouched | PASS (static) / NOT_TESTED (runtime) | static-greps.txt | Bridge sha 60be8215… is still composed. Module has no `window.fetch=`. Feed is read by XHR. `index.json` and day `.json` give `legacyStem()===''` and do not match `MAP_READY_PATHS`, so they go to nativeFetch. **Browser check:** toggle ON, then `__GRIDATLAS_MAP_READY__.intercepted_on_demand` delta 0, no `failures[]` entry naming lightning, and a live network witness. |
| V3 no shell change | PASS (note) | V3-diff-names.txt | `git diff --name-status c08f3a6 HEAD`: no atlas/index.html, releases, preview or STATE.md change. `atlas/v/202610270024/index.html` is byte-identical to atlas/index.html and to the 29 existing `atlas/v/*` routes. This follows the repo's pinned-route convention, but is a literal deviation from V3 ("no new dir with index.html"). |
| V4 60+3 / proxies | PARTIAL | adversarial-E-*.tap (X-V4) | vm: lightning nodes carry only `data-lightning-*`/aria/role attributes. No engine/proxy attribute. Group is appended LAST, the original group stays at index 0, and nothing goes into `#gridatlas-menu-bar`. `adoptLate()` ignores it. **Browser check:** `menuBar.inspect()`={60,3,63,63,true} and `[data-gridatlas-layer-proxy]`=63, OFF and ON, at 1440×900, 393×852, 360×740 and 390×844. |
| V5 original surfaces | PARTIAL | static-greps.txt | No `<style>`, no `!important`, no `.map-controls`, `.custom-map-attrib`, `gm-panel`, `prepend` or `insertBefore`. Inline styles on its own nodes only. **Browser check:** `.key-title` order and the `<style>` id list equal the baseline per viewport. |
| V6 pixel parity OFF | NOT_TESTED | — | Needs paired screenshots in 4 states × 4 viewports with `masked-pixel-diff.py` = 0. |
| V7 lightning ON | PARTIAL | X-V7 | vm: default OFF, a second boot is OFF with 0 requests and 0 sources, and nothing is read from storage. **Browser check:** `locator.click()`/`tap()` with no `force`, the mirrored twin, source feature count > 0, and OFF returning to the OFF snapshot. |
| V8 period/provenance | PARTIAL | realfeed-E.tap | Real feed (12h–12m): the visible caption shows the UTC window, actual first/last, counts and cap, feed refresh/collection window, latest detection, "not confirmed ground strikes" and "EUMETSAT L2-LFL". **FAIL sub-item:** no attribution in the About panel (module never touches About, and no renderer reads `data_sources`). |
| V9 no claim of a year | PASS | realfeed-E.tap, V9-producer*.txt | Index 404 reads "archive not yet published … unknown, not zero". 12m reads `[≥408 \| 12m]` "older history unknown". Schema is **v2**, not the v1 the checklist names. v2 matches the draft producer (lightning PR #2 f7db76c, PR #4 1b883c2: `SCHEMA_INDEX`, observation sentence and all 17 index fields). A v1 index reads "archive unavailable". |
| V10 zero/error/stale | FAIL (literal) / OWNER_DECISION | X-V10a/b/c | Empty FC reads `[UNKNOWN]` "unknown, not zero". `query_end` 30 h old reads `STALE`. HTTP 500 reads `[FAIL]` with layer hidden, **but the toggle stays ON** (V10 requires OFF). The caption warning also names only "Archive unavailable: HTTP 404" and omits the feed's HTTP 500 (line 99). Stale is keyed on `query_end_utc`, not `latest_detection_utc` (defensible). |
| V11 regression | PARTIAL | proofs-lint-state.log | `202610270024-sld-sandbox.proof.mjs` PASS. `run-current.mjs` 4/4. **Browser check:** v8-layers-panel-restored, menu-bar-dom, all-controls (desktop and mobile), all-layer-clicks, menu-bar-mobile-hit and deep-link. |
| V12 lint/state | PASS with CONDITION | proofs-lint-state.log | `lint` PASS. `state --stdout` equals STATE.md. **Only because** de69f86 deletes `.github/workflows/uk-lightning-preview.yml`, which origin/main still has. No new workflow. |
| V13 governance | PARTIAL | V13-governance.txt | PR #34 is draft and unmerged, but its base is `candidate/202610261949-uk-lightning-additive`, not main. Main = 1c19b76 (Ventusltd, 00:31:14Z) already publishes the E standalone route, with Pages run success at 00:31:17Z. Live current.json is still 202609241334 (raw-verified sha 1ea60d…). Issue #28 and PR #29 have not been updated since 19:24Z. PR head c014e0e adds only evidence and docs over 0424d45. |
| V14 no V6 transplant | PASS | static-greps.txt | 0 hits for every V6 identifier. |
| V15 mutation budget | PASS (static) / NOT_TESTED | — | The install MutationObserver disconnects and the poll is cleared. The only timer is a 600 s refresh. `txt()` writes only on change, and no `appendChild` happens in paint. **Browser check:** body mutations < 20 over 30 s idle with lightning ON. |

Test totals that I ran myself:
- Unmodified upstream ChatGPT suite (origin/chatgpt-veto 4f9bcdf): **E 8/8**; D (202610262323) 7/8, failing H08.
- test-fixes.mjs: **E 49/49**; D 24/49.
- My adversarial suite: E 9/11, with the two FAILs below. D 6/11.
- Real-feed suite: E 8/8.

## ChatGPT owner-iPhone items

| Item | Verdict on E | Code evidence |
|---|---|---|
| **M01** caption behind HIDE LAYERS | **PARTIALLY ADDRESSES** | `fit()` (line 174) sets `gridColumn:1/-1`, a bottom spacer of `innerHeight−btn.top+16` and a right inset of `group.right−btn.left+16` on both twins. It runs only at install and on `resize`/`orientationchange`. **Defect (X-M01a):** on phones the Layers panel is closed at install, so the group rect is 0 and `paddingRight` is `0px`. Opening the panel and switching lightning ON does not recompute it, so the horizontal overlap that ChatGPT photographed survives. Also, once applied, the 152 px inset narrows the caption to about 220 px. The 12m real caption (902 chars) then wraps to about 34 lines (≈612 px) inside a 38vh (≈324 px) scroller (`caption-height-estimate.txt`). **Minimal fix:** call `fit()` at the end of `pt()` (or use a ResizeObserver on each group). **Device check:** scroll to the bottom in Layers and in the curtain, then `elementFromPoint` on every caption line and the 44 px button at 393×852, 390×844, 360×740 and the owner's iPhone. |
| **M02** 6M/12M coverage context | **ADDRESSES** (bytes) | On the real feed the status line reads `PARTIAL · 408 seen in the available 7-day feed · 12 months requested · older history unknown · searched unknown`, and the label reads `[≥408 \| 12m]`. Actual first/last: 2026-10-21 12:32:19 / 2026-10-25 11:15:58 UTC. 12H/24H read `[UNKNOWN]` with "none seen … (unknown, not zero)", never EMPTY or 0. Legibility on the device is NOT_TESTED. |
| **M03** 48H "3 drawn", none visible | **PARTIALLY ADDRESSES** | The caption appends "N of M outside the current view" from `map.getBounds().contains` (MapLibre 3.6.2 has it). The camera is never moved. On the real feed at 48H: 3 flashes; with my assumed southern-UK bounds, "3 of 3 outside". The FIT FLASHES button was dropped for budget, and there is no moveend recount, so the claim is stale after a pan (X-M03). **Device check:** `map.getBounds()` and `map.project()` of the 3 coordinates at the owner's viewport. |
| **M04** legibility | **ADDRESSES** (bytes) | Caption is now `12px/1.5`, `#bbb` (≈10:1 on the panel background), footer 11px, `overflow-wrap:break-word`, up from 10px `#888` and 9px. Real-device readability is NOT_TESTED. |
| **M05 / H08** feed cov overwrite | **ADDRESSES** | Line 114: `const c=r.mode!=='feed'&&r.cov`. The unmodified upstream H08 test passes on E and fails on D. My extended X-H08 (cov=0.5 injected; 12h, 7d, 12m) never shows a "%" in label, status or caption. |

## Other defects found

- **D1 (doc):** `surfaces` in `atlas/v/202610270024/current.json` and in the composition manifest lists "Grid dropdown footer after .gm-panel-body (toggle only)". The bytes have no Grid row, and the proof asserts there is no `gm-panel-body`. These are immutable files, so correct this in the next generation.
- **D2 (copy):** when the feed fails after an index 404, the caption warning blames only the archive. Fix: append `; live feed: ${r.fail}` at line 99.

## Advisory

**NO-RELEASE (advisory) for any live-pointer switch at this time.** The binding veto stays with ChatGPT and the owner. E fixes H08, M02 and M04 in the bytes, and the static boundary is clean (V1, V2 static, V3, V9, V14). However:
1. M01 has a statically reproducible gap on exactly the owner's scenario: phone, panel opened after load, no resize.
2. V4–V7 and V11 browser gates are NOT_TESTED.
3. V10's error-to-OFF requirement and the About attribution in V8 are unmet.
4. The workflow deletion (V12) and the PR base (V13) are governance deviations.

The advisory would become **RELEASE-WITH-CONDITIONS** after:
- (a) `fit()` re-runs on paint or open, plus the M01 device check;
- (b) browser runs of V4–V7 and V11;
- (c) owner decisions on V10 (toggle stays ON with [FAIL]), V8 About, the de69f86 workflow deletion and the PR base;
- (d) a fresh owner iOS Safari review of the new generation.
