# opus-decision-table: V1-V15-MAP and THREE-WAY-TABLE (issue #32 §9, §13)

**Harness:** self (static reads, `git show`, read-only `gh api`, node 22.23.4; no browser). **Snapshot:** 2026-10-26 22:30 UTC; other lanes still writing.
**Pins:** main c08f3a6 (gen 202609241334); candidate fda6b10 (gen 202610261949; Claude branch 18842df adds docs only, `git diff fda6b10 18842df -- atlas tools .github` empty); ChatGPT 49696b5 (lead-executed), PR #33 head b8306e4 (+1 doc, not executed); PR #31 dc55d31. Spot checks (not lane verdicts): `evidence/opus-decision-table/spot-checks.txt`.

---

## Section 1: V1-V15-MAP

**Source.** `../lightning/reports/atlas-merge-veto.md` lines 49–67, byte-identical to the PR #31 copy (`cmp`) and complete through V15, so nothing was reconstructed from the §9 one-liners. Its harness policy (line 49) binds every row: shim evidence counts for DOM, geometry, counts, hit tests, transport pass-through and fixtures; never for tiles, DuckDB, CDN/cache, real CORS or real touch.

**Carrier codes:**
- A: step-a
- B: visual-challenge-B
- C: regression-challenge-C
- D: negative-matrix-D
- R: overlay-code-review
- P: pr2-data-verifier
- H: a later hardening receipt

**Kind codes:**
- T: technical
- T+O: technical, with an owner decision inside it
- L: needs live or real-device evidence (BLOCKED locally)

"Unreported" means raw files exist but the lane has not filed a report. Those gates stay NOT_TESTED.

| V | Evidence that satisfies it (veto line) | Carrier | Status, 22:30Z | Kind |
|---|---|---|---|---|
| V1 | `sha256sum -c` of the 31-file manifest in a candidate worktree gives 31/31 OK. Any change to releases/, the four cartridges, atlas/index.html, current.json, STATE.md or the 202609241334 manifest is a FAIL (L53) | A | PASS, Claude side only. `evidence/P01-baseline-hashes.txt` shows 31 OK but does not name a SHA or command. Spot re-run at 18842df: 31/31. Hash set equals the veto manifest's | T |
| V2 | Bridge sha 60be8215… is still composed. `window.fetch.name==='gridAtlasMaplibreWorkerFetch'`. After ON: `intercepted_on_demand` Δ0 and no lightning entry in `failures[]`. Request seen at raw.githubusercontent.com: shim locally, live once by the owner (L54) | A, C/D, H + owner | Hash: covered by V1, and candidate current.json still composes it. Runtime: NOT_TESTED (builder claim only). Live: BLOCKED_DEPENDENCY | T+L |
| V3 | No new directory holding an index.html under atlas/ except releases/. The diff has no atlas/index.html and no atlas/preview/. The composer still accepts replace-script only (L55) | C (`p04-static.txt`, unreported) | NOT_TESTED. Wording conflict, see D1 | T, ruling needed |
| V4 | OFF and ON, at four viewports: `menuBar.inspect()` = {60,3,63,63,true}. 63 `[data-gridatlas-layer-proxy]`. The lightning control carries none of the four menu attributes. ukConfig unchanged (11 groups, 60 layers). `initVentusMap` not wrapped (L56) | B, C, D | NOT_TESTED. Builder: OFF and post-reload counts only, no `inspect()` while ON (PR #31 `candidate-verify/10-…summary.txt`) | T |
| V5 | 13 groups keep their index, Topology first, first label 400kV. `.map-controls` state unchanged per viewport. `<style>` list is 8/9 plus at most one lightning id, with no rules on original selectors and no `!important`. ventusv8.css untouched (L57) | B | NOT_TESTED | T |
| V6 | Same-harness pairs at 1440×900, 393×852, 360×740 and 390×844, in four states (rest, Grid, Layers, curtain). `masked-pixel-diff.py` = 0 px, masking only the clock/DAYS and the canvas. Geometry equal except the one approved lightning row (L58) | B | NOT_TESTED (B is mid-run) | T+O |
| V7 | Real `click()`/`tap()` with no `force:true`, from the owner-named surface. Mirrors agree. Layer visible and source count >0 from a served response. OFF restores the OFF snapshot. Reload gives OFF with nothing in storage (L59) | B, D | NOT_TESTED. Builder's desktop Grid-mirror click needed programmatic scroll (PR #30 report §7): inadmissible here | T+O |
| V8 | The visible label shows: selected UTC start/end; actual first/last detection inside the window; shown-of-archived with the cap; refresh time; "optical flashes · not confirmed ground strikes"; EUMETSAT MTG LI L2-LFL (also in About, with `.custom-map-attrib` untouched). Every number is traced to the loaded file (L60) | D, R | NOT_TESTED. At risk: H05 fails in a Node VM (`chatgpt-suite-run/run-20261026.log` L101–126) | T |
| V9 | With `data/history/index.json` returning 404: says "archive unavailable", never "0 flashes". Absent days unknown. Long windows use index counts only. No synthetic points. Shards validated against `…index.v1` (L61) | P, D | NOT_TESTED. Index 404 on lightning main at 22:26Z (P `live-checks.txt`, curl): the fallback is today's live path | T+O |
| V10 | Three runs: an empty FeatureCollection, HTTP 404/500, and a feed with `latest_detection_utc` >24 h. Each gives a distinct visible state, and the toggle returns to OFF on error (L62) | D | NOT_TESTED. At risk: H01 and H02 fail in a Node VM. OFF-on-error is not implemented, by design (PR #30 report §4.4) | T+O |
| V11 | Under the shim: `run-current` 4/4, `v8-layers-panel-restored`, `menu-bar-dom`, `all-controls` (desktop and mobile), `all-layer-clicks`, `menu-bar-mobile-hit`, deep-link arrival. Logs carry command, Chromium version, timestamps and exit codes. REPD search is BLOCKED_DEPENDENCY (L63) | C | NOT_TESTED. Unreported raw: 40-proof static tables (baseline FAIL 7/PASS 20, candidate FAIL 6/PASS 21); browser runs under way | T+L |
| V12 | `lint` and `state --stdout` pass, or fail with the identical pre-existing string. No new workflow. STATE.md unchanged (L64) | A | PASS, Claude side. Spot re-run: lint exit 0, and `state --stdout` equals STATE.md. step-a stores no lint log. 9 workflows. R11 still open (see D8) | T |
| V13 | `gh api` shows: candidate PR draft, unmerged, base main; main at c08f3a6 with generation 202609241334; no pages-build-deployment run from the candidate; #28 and #29 unedited (L65) | H, at SHA freeze | NOT_TESTED. Spot REST 22:29Z: #30, #31, #33 open drafts, unmerged; main c08f3a6; Pages runs unchecked | T (release itself: owner) |
| V14 | A grep for `price-history-time-tabs`, `price-history-chart-nav`, `price-history-period-back/forward`, `v5-chart-open` and `electricity-price-history-panel` finds nothing. Only date logic is reused (L66) | R | NOT_TESTED. Spot grep: 0 hits | T |
| V15 | Lightning ON, idle 30 s: body mutations <20, and no `appendChild` inside status updates (L67) | D or B | NOT_TESTED. The builder recorded 0 lightning-owned mutations in 8 s | T |

### Wording disagreements, issue vs veto (recorded here, not resolved)

- **D1. V3, copied loader.** The veto says "no new directory containing an index.html under atlas/", and its title says "no copied loader". Issue §2 says "candidate loader identical bytes to atlas/index.html". The candidate adds `atlas/v/202610261949/index.html`, a byte copy (spot `cmp`). Read literally, the veto fails it; the issue expects it. ChatGPT's preliminary row calls V3 "static source consistent". A reviewer must rule on this explicitly.
- **D2. V4 object.** The veto's `{60,3,63,63,true}` is positional. Issue P05 names the keys `engineInputs/pnInputs/proxies/installed`, but `inspect()` returns `{engine,pipeline,total,unique,complete}` (substation-intelligence 4479–4488). So the fourth value is the count of unique keys, not proxies. The proxy count and `menuBar.installed` are separate checks. The issue's "63 markers" means both private attributes, `-layer-key` and `-layer-proxy` (PR #31 `atlas-menu-contracts.md` L27). The veto counts only the proxy attribute.
- **D3. V6 states and masks.**
  - Veto: four states, mask only clock/DAYS and canvas, 0 px. Issue §1(c)/P10: six or more states (adds About, deep-link); P11 also masks the "lightning-owned additive group". Where the Grid footer row is on screen (phones, 1920×1080) the wordings give different verdicts.
  - PR #31 `candidate-verify/15-grid-clip-probe.txt` shows `.gm-panel-body` 78 px shorter on the candidate at all five sizes (512→434 at 1440×900), because the footer is inserted after it (overlay L145). That original-element change is not clearly allowed by "equal except the one approved lightning row". For lane B to measure; not a verdict.
- **D4. V7 surface.** The gate needs "the surface the owner names". The owner has not named one yet (R01).
- **D5. V9 schema.** The veto validates against `uk-lightning-history-index.v1`, but the candidate accepts v2 only. Issue D08 specifies an index v2 with day shards v1, and calls rejecting v1 a KNOWN DEVIATION. The gate needs to be re-pointed at whatever PR #2 publishes (lane P), and R02 needs a ruling.
- **D6. V10, OFF on error.**
  - Veto: "toggle returns to OFF on error"; the §9 one-liner softens this to "state on error"; the candidate stays ON. D15/R03 require an explicit ruling; the veto text stands until the owner amends it.
  - The veto's stale trigger is feed `latest_detection_utc` >24 h; the candidate's rule is index-based (>4 h, or past `next_update_due_utc`), and feed mode never shows STALE (H02).
- **D7. V11 scope.** The issue adds "search/SLD". The veto list names no SLD-specific proof, even though sld-sandbox is the cartridge that changed. C's tables include `sld-202609241334` and `sld-finance-fixture`. Someone must state which of these count.
- **D8. V12, workflow deletion.** The veto allows a pass, or the identical pre-existing failure, and forbids new workflows. It never considered deleting one. The candidate passes by deleting `uk-lightning-preview.yml` (R11).
- **D9. V13 base and preview.** The veto wants the candidate PR based on main (true for #30); issue §0 wants new draft PRs based on the candidate branch (#33 complies). ChatGPT's b8306e4 documents a raw.githack.com third-party proxy URL pinned to fda6b10. It is not a Pages deployment, so the veto's literal V13 text does not cover it; whether it is "legitimately published" (issue §12F) is an owner call.
- **D10. V15 metric.** The veto counts all body mutations (<20 in 30 s); issue P12 counts lightning-caused ones only. PR #30 report §2 records 24 shell-clock mutations per 8 s on both routes, so the veto's literal count would fail the baseline itself. The builder measured 8 s, not 30 s.

**Defect in the committed TEST-MATRIX.json (18842df).** It has no `V1` row. V1's text sits under a duplicate `V15` id (skeleton lines 429–431). The real V15 requirement is cut off, and "Additional judgement" text has spilled into it (line 557). Fix this before filling in statuses.

**Owner-approval-only.** As worded, none of V1–V15 is owner-only. All are technical, and some have an owner decision inside them (T+O). The owner-only conditions sit beside the gates (§13):
- **O1:** Grid-footer placement (R01, P14).
- **O2:** the deviations:
  - FAIL keeps the toggle ON (R03, D15)
  - v1 is rejected (R02, D08)
  - no drill-down (R04, D11)
- **O3:** visual approval on a real device.
- **O4:** authorising a separate release PR.

---

## Section 2: THREE-WAY-TABLE (skeleton)

The middle column is the **unmodified** candidate; no hardened SHA exists yet. The ChatGPT column summarises, without adopting, their artefacts at 49696b5 (`docs/lightning/CHATGPT-INDEPENDENT-REVIEW-20261026.md`, `tools/proofs/chatgpt-lightning-static-review.mjs`, `tools/proofs/chatgpt-lightning-regression.test.mjs`) and b8306e4's added doc. Their status labels ("STATIC SOURCE CONSISTENT", "BUILDER RECEIPT ONLY", "AT RISK / LIKELY FAIL") are outside the §1 vocabulary; mapping them is the final reviewer's job.

| Row | Original GridAtlas | Claude candidate (now: unmodified fda6b10; hardened: pending) | ChatGPT challenged candidate |
|---|---|---|---|
| SHAs / PRs | main c08f3a6, generation 202609241334, v9.156. Evidence pack: PR #31 dc55d31, draft | fda6b10, generation 202610261949, v9.158. PR #30, draft, based on main. Branch 18842df adds docs only | 49696b5 = fda6b10 + 3 files (lead ran it at 22:19Z). PR #33 head b8306e4 (+1 doc), draft, based on the candidate branch |
| File diffs | — | 8 files vs main, +10,753/−33: overlay, appended cartridge, proof, manifest, `atlas/v/202610261949/{index.html,current.json}`, report. Deletes `uk-lightning-preview.yml` | +4 files, all docs or tools. None under atlas/ |
| Architecture | Four replace-script slots: bridge → gazetteer → substation-intelligence → sld-sandbox. Immutable shell 202608300453-atlas-v9. MapLibre 3.6.2 | Same four slots. sld-sandbox = 435,218 B + LF + a 23,973 B module. Loader byte copy at a versioned route. No change to the composer, bridge, ukConfig or initVentusMap | Proposes no architecture. Its static script gives 15 PASS_STATIC: exact delta, four slots, hashes, loader, no forbidden patterns |
| UI same/different | 13 groups, Topology first. Six menus. Desktop Layers panel open at rest. 8/9 `<style>` | Adds a Weather group last in Layers and in the curtain, plus a Grid footer row (L145). `.gm-panel-body` is 78 px shorter when Grid is open. The footer is clipped at 1440×900 and 1280×720; that clipping is pre-existing and also hides the original "⬇ Layers". No independent parity run yet | Treats the footer clipping as an OWNER DECISION (H06). No screenshots |
| Controls (60+3, proxies, markers, groups) | `inspect()` {60,3,63,63,true}. 63 proxies and 63 keys. 65 inputs in `#scada-ui-container` (63 + 2 basemap radios) | Builder: same counts while OFF, 14 groups, no engine or proxy attributes on lightning. Independent check: NOT_TESTED | Calls it "BUILDER RECEIPT ONLY". Static forbidden-attribute check: PASS_STATIC |
| Browser proofs | Veto baseline: run-current 4/4, v8-layers PASS, menu-bar-dom exit 0. Chromium 153 / Playwright 1.63. WebKit absent | Builder only: lead-shim at 1440×900, plus 360×740 emulation. B and C have not reported | No browser runs: their environment failed DNS. Node-VM tests only |
| Data truth | No lightning in the live composition | MTG LI L2-LFL optical flashes, labelled "not confirmed ground strikes" and "missing days unknown, not zero". Index v2 only. The archive returns 404 today, so the candidate falls back to the 7-day feed (408 features; the feed metadata covers a 3-h query) | H03: no bounds or numeric-coordinate check. H04: no index-to-shard check on count, bytes or sha. H05: whole-day counts captioned "archived in window" |
| Failures | Pre-existing on main: lint/state budget mismatch. Stale proofs (C baseline, unreported) | FAIL keeps the toggle ON (a deviation). H01–H05 fail in a Node VM but have not yet been reproduced in a browser. R raw output, unreported: malformed index dates accepted (a cutoff of 9999-99-99 becomes NaN) | Their grading: H01–H03 HIGH, H04 MED/HIGH, H05 MED, H06–H07 OWNER, H08 BLOCKED |
| Transport | Bridge patches `window.fetch` only and treats any `.geojson` as a partition. XHR is not hooked | `.json` by fetch, the feed by XHR. Builder: `intercepted_on_demand` Δ0 under the shim. Browser CORS/cache untested. curl: feed 200, `max-age=300` | "STATIC SOURCE CONSISTENT; RUNTIME PENDING". The b8306e4 proxy URL is untested |
| Performance / budget | sld-sandbox 435,218 B | Module 23,973 B. Cartridge 459,192 of 460,000. 0 lightning mutations per 8 s idle. 10k/40k caps. CPU, memory and first-interaction time unmeasured | Their static check asserts the overlay is ≤ 24,000 B, the PR #30 report's budget. The lead's ceiling is 24,781 B. A fix that lands between the two passes one and fails the other |
| Unsatisfied gates | Baseline. lint/state fail on main (pre-existing) | Nothing independently adjudicated. Passing on the Claude side only: V1, V12. At risk: V8 (H05), V10 (H01/H02). Wording rulings needed: D1–D10. O1–O4 open | Preliminary: V13 "PASS on GitHub"; V10 "AT RISK / LIKELY FAIL"; V6, V7, V11 "BLOCKED"; the rest pending |
| Verdict | Production, untouched | Not vetoed yet (PR #31 README) | "NO-RELEASE / independent challenge incomplete" |

**Contested points to re-run on one pinned harness (§13), not averaged:** H01–H05 in a browser (D); the V3 loader (D1); V10 OFF-on-error (D6); the V15 metric (D10); the overlay ceiling, 24,000 or 24,781.

**To fill in when the hardened SHA lands:** new generation, SHA and route; `git diff --stat fda6b10..<SHA>`; module size against both ceilings; B, C and D receipts and ChatGPT's suite re-run on that SHA.
