# PARALLEL WORK ORDER — Finish GridAtlas lightning without touching production

**Owner:** Ventus Ltd / GlobalGrid2050.
**Priority:** HIGH; preservation and scientific integrity outrank shipping speed.
**Status:** authorised to work, run tests, commit and push to the TWO named isolated branches below; NOT authorised to merge, deploy, modify production pointers, or declare release complete.
**Supersedes:** no existing scope. This is a continuation of #28, PRs #30/#31, and lightning PR #2, not a restart.

## 0. Exact starting point, ownership and parallel lanes

Start SHA (GridAtlas PR #30 candidate): **fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d**, generation **202610261949**. Production main SHA at assignment: **c08f3a6178752d9ccc77ce76451107f28375a8b2**, generation **202609241334**. Reconfirm both on entry and exit.

**Claude execution branch (already created):** claude/lightning-independent-hardening-20261026. It starts from the PR #30 head, not main. Claude is SINGLE WRITER for code fixes/hardening and its own self-tests. All work must use an isolated worktree; do not edit the prior Claude builder worktree or any other developer's branch.

**ChatGPT independent branch (already created):** chatgpt/lightning-independent-veto-20261026, also from the identical PR #30 head. ChatGPT is INDEPENDENT CHALLENGER/REVIEWER, owns read-only examination, standalone regression/preservation test additions and its own evidence/report. ChatGPT must not copy Claude's verdict; Claude must not modify this branch. Both branches must remain independent for an A/B diff.

**Review topology:** branch work is compared against the frozen PR #30 head. Open DRAFT PRs from each branch against candidate/202610261949-uk-lightning-additive. Do not merge either PR, even into the candidate, without owner authorisation. Never create a release PR changing live pointer as part of this scope.

**Core source links**
- Owner STOP / acceptance: https://github.com/Ventusltd/gridatlas/issues/28
- Claude handover: https://github.com/Ventusltd/gridatlas/blob/review/lightning-swarm-evidence-20261026/docs/lightning/swarm-20261026/HANDOVER-TO-CHATGPT.md
- Evidence pack PR #31: https://github.com/Ventusltd/gridatlas/pull/31
- Technical PLAN: https://github.com/Ventusltd/gridatlas/blob/review/lightning-swarm-evidence-20261026/docs/lightning/swarm-20261026/PLAN.md
- Read-only veto baseline: docs/lightning/swarm-20261026/reports/atlas-merge-veto.md on PR #31
- Candidate PR #30: https://github.com/Ventusltd/gridatlas/pull/30
- Candidate report: docs/lightning/CANDIDATE-202610261949.md on PR #30
- Collector/UTC one-year archive draft: https://github.com/Ventusltd/lightning/pull/2
- Original preservation PR #29: https://github.com/Ventusltd/gridatlas/pull/29
- Immersive See Through concept and 20-lane brief: docs/lightning/swarm-20261026/think/THINK-BRIEF.md (PR #31) and docs/lightning/SEE_THROUGH_20_OPUS_REVIEW.md (PR #29).

## 1. Top-level mission and real definition of done

Deliver an add-on showing *genuine EUMETSAT MTG Lightning Imager L2-LFL satellite optical flash detections* in original GridAtlas, selectable OFF by default, with period-accurate historical browsing, provenance and honest coverage uncertainty, without changing original UI composition or breaking any original GridAtlas capability. This is not evidence of verified cloud-to-ground strikes, damage to assets, electric current, voltage, physical bolt geometry, causal transmission-line faults or lightning risk at specific sites.

**DONE means** (a) a final pinned, isolated candidate with passing, separately generated Claude and ChatGPT evidence; (b) V1–V15 independently adjudicated; (c) four viewport/six-or-more UI state visual parity with legitimate masks only; (d) real click/tap and original-behaviour regression; (e) data-v2/collector compatibility and coverage integrity independently checked; (f) an OWNER decision on the Grid dropdown desktop clipping and any visual exceptions; (g) documented live data and actual device acceptance or explicit BLOCKED labels. Only then propose a SEPARATE release PR. No acceptance-by-green-test alone.

No one may claim the project is finished while a release-critical UNKNOWN/BLOCKED/FAIL exists. Document differences between PASS, FAIL, BLOCKED_DEPENDENCY, BLOCKED_HARNESS, NOT_TESTED, and OWNER_DECISION.

## 2. Absolute preservation barriers (automatic NO-RELEASE if breached)

- Do not modify atlas/current.json, STATE.md, atlas/index.html, atlas/releases/**, atlas/manifests/202609241334-composition.json, or the four original live cartridges (bridge, gazetteer, substation intelligence, sld sandbox).
- Do not move live pointer, regenerate production state, change deployment, or alter existing released composition.
- Do not add a fifth app, duplicate app shell or loader, fork the Parquet/GeoJSON bridge, patch window.fetch, wrap initVentusMap, change ukConfig, import a foreign stylesheet, or transplant UK Energy Tracker UI markup into Atlas.
- Composer remains four replace-script cartridge slots. Candidate is original sld-sandbox bytes + newline + narrowly defined additive overlay. Preserve exact-delta proof and SHA-256, candidate loader identical bytes to atlas/index.html.
- Preserve original 60 engine data-layer-id and three Pipeline News data-pn-layer controls, 63 dropdown proxies, 63 markers, 13 original native groups and their order (Topology first), original map/shell/SCADA/fullscreen/search/SLD/deep-link controls. No fake proxy or namespace attributes on Lightning.
- No injected CSS targeting original controls or global DOM layout. Do not prepend Weather to an existing list. Any added group goes AFTER original groups, and OFF must be visually indistinguishable from baseline except the approved additive Weather affordance.
- No data fetch, MapLibre source/layer, polling or persistent activation during OFF. Reload resets OFF. No storage-based ON persistence.
- Do not change existing PR #29, PR #31, lightning PR #1, owner issue #28 text, or collector main.
- Do not merge, enable auto-merge, push to main, update Pages/public homepage, or switch a released version. Owner approval is required for a release step.

## 3. Inputs to read IN ORDER (no guesswork from handovers)

1. GridAtlas CLAUDE.md, AGENTS.md, STATE.md and atlas/current.json on main; git status and commit log. 
2. Issue #28 and its comments; PR #29 original preservation contract.
3. PR #31 HANDOVER-TO-CHATGPT.md, README.md, PLAN.md, BRIEF.md, all 10 read-only audits plus two builder reports; VETO report's V1–V15; regression and visual-parity evidence.
4. PR #30, exact changed-file list (8), candidate code and report. Read the 23,973-byte overlay, its appended cartridge, candidate-only current.json, manifest and proof. Read exact delta rather than just summaries.
5. PR #31 evidence/visual-parity/parity-harness.mjs plus evidence/regression/CANDIDATE-PROTOCOL.md, run-baseline.mjs, compare-candidate.mjs, lightning-cases.mjs; runner configs/fixtures and original hash manifest.
6. Lightning PR #2 docs/HISTORY_ONE_YEAR.md, collect.py, history.py, status.py, history-window.mjs, workflows and all tests. Read the actual contracts and changes, not only the PR description.
7. GridAtlas native original shell CSS/MapLibre, 60+3 gate, bridge legacyStem(), native Layers panel and curtain, keyboard navigation, clip behaviour.
8. For the optional second product concept ONLY, See Through release/code + nine completed memos; no change to that product in this work.

Every report must cite pinned commit SHA, file paths, test commands, browser/version and harness provenance. Record any contradictions between source and handover.

## 4. Parallel ownership: Claude (code hardening) vs ChatGPT (adversarial challenge)

### Claude: code hardening and builder defence — ONLY Claude branch
1. Run the PRE-EXISTING challenger protocols against unmodified PR #30 first and preserve raw before-results. No speculative fixes.
2. Inspect candidate overlay line-by-line for wrong time windows, cache/stale behaviour, byte limits, cancellation races, event races, malformed data, injection/XSS and unexpected map/style reload behaviour.
3. Check integration paths where host page may be fully/partly initialised, where map style is swapped, on OFF/ON rapidly, when network is slow/cancelled, or the page goes offline then online.
4. Test all documented edge cases; add small, narrowly scoped fixes only for *reproduced* failures, keeping module under hard byte ceiling and original cartridge prefix byte-for-byte.
5. If space is insufficient, do NOT broaden the cartridge or minify unreadably to conceal failures. Explain budget, options and a proposed safe alternative, then pause that change.
6. In a separate worktree, READ-ONLY verify lightning PR #2 via its Python/Node tests and schemas; report data defects. Do not push to lightning without a separate owner decision.
7. Produce before/after screenshots, geometry, tests and explicit known limitations. No unverified CLAIM of real-device or real-EUMETSAT access.

### ChatGPT: INDEPENDENT adversarial reviewer — ONLY ChatGPT branch
1. Independently run static preservation checks, baseline SHA validation and source scan; do not trust Claude's output as proof.
2. Adapt or write isolated proof scripts and regression cases without editing the production shell or the same overlay path Claude edits.
3. Re-run visual parity, interaction, provenance, negative controls and non-visual invariants against BASE and ORIGINAL candidate and later Claude's exact pushed SHA.
4. Apply V1–V15 individually, with PASS/FAIL/BLOCKED rationale; check earlier failures Claude may have missed and report a proposed resolution.
5. Review lightning PR #2's archival honesty/cadence scientifically; generate counterexamples/edge-case tests independently.
6. Publish an independent DRAFT PR/report with evidence links, exact commands, tool limitations, reproducibility and final reviewer recommendation. The ChatGPT lane does not unilaterally authorise release.

The TWO approaches should be genuinely independent, not twenty copies of one model agreeing with itself. Do not allow a builder to self-veto.

## 5. Acceptance matrix — preservation (P01–P16)

**P01 Baseline files:** verify the 31-file SHA-256 baseline manifest from PR #31; list each hash, mismatches = blocker. Also compare baseline against candidate original assets directly, not just precomputed logs.
**P02 Zero original movement:** compare original DOM order and computed box geometry of every original UI element. Original 13 Layers groups, 63 proxies, menu headings and map controls retain order/position at each viewport in each opened state.
**P03 Exact delta:** candidate sld-sandbox file equals original *bytes* plus newline plus module bytes; no CRLF mutation; proof and composition hashes agree.
**P04 Four-slot discipline:** no extra composer slot or replaced bridge; correct immutable shell, original MapLibre version and original CSS.
**P05 Control inventory:** menuBar.inspect() exact baseline object {engineInputs:60, pnInputs:3, total:63, proxies:63, installed:true} or corresponding original array representation, plus precisely 63 private markers. Do not count unrelated basemap radios as core layers. Check while OFF and ON.
**P06 Event semantics:** original six-menu dropdown opens/closes, body click works, Grid ArrowDown starts at engine:400, native Layers/SCADA opens, curtain works, search focus intact, no event capture swallowing original controls.
**P07 Keyboard:** Tab, Shift+Tab, Enter, Space, Arrow keys, Escape, focus restoration. Lightning keyboard interactions meaningful with correct role/checked/aria semantics.
**P08 Touch:** actual hit-tested clicks/taps, no force:true, no JS direct invocation replacing user gestures; 44x44px targets where justified on mobile.
**P09 Preserve layering:** no new map-layer/source while OFF; map after OFF exactly returns to original state, and all existing grid layers remain clickable.
**P10 Layout:** compare original vs candidate at rest, Grid dropdown, native Layers open, fullscreen curtain open, About open and deep-link arrival. Include 1440x900, 393x852, 360x740, 390x844 iPhone-like geometry; 1280x720 + 1920x1080 supplemental for clipping diagnosis. Chromium emulation is NOT real iPhone Safari.
**P11 Pixel evidence:** paired same-harness screenshots and masked diff; mask only non-deterministic live clock/DAYS, canvas tiles/particles and lightening-owned additive group. No blanket masking of the menu/panel.
**P12 No mutation storm:** idle 30 s ON, monitor lightning-owned DOM updates/body observer, cap <20 lightning-caused mutations; no blinking/ticking write loop.
**P13 No unintended data traffic:** idle OFF triggers 0 lightning requests, 0 sources and no 10-minute updater; while ON only declared data endpoints.
**P14 Controls accessible:** all original controls and *approved* new Lightning control physically reachable in normal viewport without programmatic scrolling to clipped content. Any known original clipping must be honestly separated from new regression.
**P15 Accessibility:** named/announced toggle, state and labels, focus/touch, readable contrast, reduced-motion tolerance; no seizure-like animation, flashing UI or forced sound.
**P16 Resource budget:** overlay 23,973 bytes originally; sld-sandbox <460,000 bytes and proof budgets pass; measured CPU/memory/network and first interaction budget; do not blindly introduce new CDN/browser library.

## 6. Acceptance matrix — data, source and historical truth (D01–D18)

**D01 What is observed:** EUMETSAT MTG LI L2-LFL optical flash centroids/time, not ground strike channels; always display exact wording and attribution, including popup where present.
**D02 Geodesy:** lon/lat valid and within declared UK+neighbour-waters bounds (-11,49.5) to (3,61.5); validate and quarantine malformed/out-of-box records; no invented bolt paths or attribution to individual pylons.
**D03 Time semantics:** timestamps UTC, selection [start,end) consistently, true selected start/end, actual first/last observations INSIDE selection, ingestion/generated timestamp kept separate from last detection timestamp.
**D04 Current windows:** 12h,24h,48h,7d from available underlying observations; no saying 408 'in last hour' if actual feed spans five days.
**D05 History windows:** 30d,3m,6m,12m and custom, clamped to retention boundary; PREV/NEXT/LATEST exact and justified; no invented historical coverage prior to collector start.
**D06 Archive absent:** index 404/schema mismatch/CORS/network issue → explicit fallback to rolling seven-day feed, with 'archive not published/unavailable', and long ranges disabled, never zero.
**D07 Missing=unknown:** missing days, scan gaps, failed runs, partial coverage, not-yet-ingested tail all explicitly unknown; zero only if searched coverage and count legitimately zero.
**D08 Schema:** index v2, dated shards v1, day parts[] for high-volume split dates, sha256/bytes/count metadata consistency, sealed/unsealed cache correctness. Candidate rejecting v1 is a KNOWN DEVIATION — adjudicate its impact with PR #2, do not silently normalise the scope.
**D09 Time-window correctness:** DST boundary, UTC midnight, leap day, month-length variation, leap-year 12-month lookback, date picker From > To, date before archive, future date, mid-window ingestion and selected window outside feed retention.
**D10 Concurrency:** four shard reads max, settled per shard with named failures; LRU 8; cancellation and stale responses may NOT repaint a newer window or leave old points under a mismatching caption.
**D11 Budget tier:** detail up to 31 days only if <=40k index count and <=32MB; larger index summary before fetch. >31d daily index only by default; LOAD POINTS explicit and honest; 10k phone/40k desktop map cap and cluster state honestly indicated.
**D12 Large storm:** max shard 25MB, target 8MiB and parts[] hourly split; 100k-flash day stress. Zero synthetic observation points in published archive; synthetic counts are allowed in TEST FIXTURES only, clearly labelled.
**D13 Status captions:** show selection window, first/last genuine detection, archived vs drawn counts, refreshed/published timestamp with stale semantics, coverage fraction/runs, warnings + UTC/source/uncertainty note; if footer/legend hidden, fail visibility.
**D14 State matrix:** OFF, LOADING, READY·DETAIL, READY·SUMMARY, EMPTY-COVERED, PARTIAL, UNKNOWN, BEFORE-ARCHIVE, FAIL and STALE modifier. Distinguish network error from successfully searched and empty.
**D15 Failure handling:** bad JSON, HTTP 404/500, partial shard failure, stale index, sha mismatch, CORS/network rejection, zero feed, cancelled request, stop/start rapidly. Newest partial features remain accurately labelled if FAIL. Candidate keeping toggle ON on FAIL is a KNOWN DEVIATION vs original V10 — reviewer must rule explicitly.
**D16 Transport:** .json absolute fetch bypasses original broad .geojson interceptor; rolling feed .geojson uses tested XHR; verify intercepted_on_demand unchanged, request headers/CORS/cache must be tested *live* separately. No original bridge edits.
**D17 Collector:** hourly at minute 17; max(6h, gap+30m) lookback capped 48h, successful examined 10-minute slots only, missed source product coverage recorded unknown; status always writes heartbeat, feed-first/archive-second; backfill not fabricated.
**D18 Retention/provenance:** true prospective rolling UTC year; initial genuine 408 events seed with partially searched days. EUMETSAT availability and licensing/attribution checked. Actual archive is NOT presently live merely because draft PR #2 exists.

## 7. Candidate-specific known risks requiring explicit disposition (R01–R12)

R01. Candidate's Grid dropdown Weather mirror resides in FOOTER clipped by #map-container overflow:hidden at 1440x900 and 1280x720; the original Layers tab itself is also clipped there. Quantify if mirror is required for release or optional secondary affordance. This is AN OWNER DESIGN DECISION. Compare (A) unchanged footer, (B) head-slot role=checkbox; if B shifts original body/changes pixels, do not apply silently. Provide side-by-side screenshots and control geometry. No broad CSS fix.
R02. Candidate supports index v2, not v1 despite design plan v1+v2. Identify whether production PR #2 guarantees v2; decide whether v1 fallback necessary or explicit error acceptable.
R03. FAIL leaves Weather switch ON, contrary to V10 wording. Assess accessibility, error transparency and preservation; propose V10 amendment only if evidence supports it; no forced OFF that hides diagnosis.
R04. Long-range overview cannot always drill down; CUSTOM one-day workaround. Decide whether a genuine user can inspect selected historical flashes without ambiguous controls.
R05. Custom period date-navigation buttons disabled, unlike named periods. Test usability and caption correctness.
R06. Dataset may be incomplete (scheduled runs previously missed ~46% of hours). Search coverage is critical; do not describe 408 as all flashes in UK or all lightning strikes.
R07. Actual GitHub raw data CORS/cache is untested in shim; a live proof is required before release.
R08. DuckDB Parquet extension, REPD layers/search, basemap tile/glyph and iOS WebKit were BLOCKED in Claude sandbox. Do not turn BLOCKED into PASS based on shell tests.
R09. Module byte budget extremely tight (~24 KB), risk of dense/unclear code and omissions; use tests rather than compress away error validation.
R10. 10-minute refresh, aborted pending read, style reload, LRU eviction and parts[] fan-out have not had genuine end-to-end fixture coverage.
R11. The candidate removed .github/workflows/uk-lightning-preview.yml to restore workflow budget. Independently check its removal doesn't delete a required safeguard; report alternative budget fix separately if needed.
R12. Candidate pack and PR #31 include extensive screenshots, some shim-backed. Match every claim to provenance, SHA and a reproducible command, not just an image filename.

## 8. Test execution protocol — challengers FIRST; builder edits SECOND

**Step A: baseline freeze.** In separate worktree at the PR #30 SHA record Node/Playwright versions, git status, sha256, unmodified original live generation. Run:
    node tools/scope/loop.mjs lint
    node tools/scope/loop.mjs state --stdout > /tmp/gridatlas-state.txt
    cmp /tmp/gridatlas-state.txt STATE.md
    node tools/proofs/202610261949-sld-sandbox.proof.mjs
    node tools/proofs/run-current.mjs
    node tools/scope/verify-compose.mjs
    cmp atlas/index.html atlas/v/202610261949/index.html

**Step B: visual challenge.** Use PR #31 evidence/visual-parity/parity-harness.mjs (from review branch; do not mutate it in place). Configure the harness to compare original route /gridatlas/atlas/ vs candidate /gridatlas/atlas/v/202610261949/. Run at 1440x900, 393x852, 360x740, 390x844, all opened surfaces. Do not mislabel Chromium UA as WebKit. Report screenshots, geometry, computed styles, palette/typography, scroll area, original hit targets, auto-placed controls, basemap caveat, diff pixels and masks. Include Grid clipping alternatives as separate screenshots.

**Step C: regression challenge.** Use PR #31 evidence/regression/CANDIDATE-PROTOCOL.md, run-baseline.mjs, compare-candidate.mjs, lightning-cases.mjs. Execute against baseline and candidate with SAME harness/environment. Run original controls and all-layer-clicks, menu-bar-dom, menu-bar-mobile-hit, deep link; investigate regressions, not just counts. Handle shim registry/Playwright dependencies honestly.

**Step D: negative matrix.** At least: zero valid events after complete scan; none under partial scan; no index; broken index; 404 and malformed shard; stale index; 100k counted; split hourly parts; count/hash mismatch; 4 simultaneous fetches; >40k capped; cutoff older than year; UTC/DST/leap date; mobile viewport switch; cache invalidation; offline; CORS denial; data arriving after user toggles OFF; repeated ON/OFF; network callback after navigating to a different window; reduced motion; focus/close of Grid menu. Every case shows actual rendered user-visible caption and underlying source/map feature count.

**Step E: unmocked network / true device.** Record a genuinely served route and raw.githubusercontent.com access, with timestamps and browser network receipts, separate from fixtures. Owner to check on desktop Chrome, actual Android Chrome, actual iPhone Safari if available; report device/browser/version, what was visually different, screenshots and clicks. If these cannot run, mark BLOCKED for release rather than guess.

**Step F: comparison and hardening.** Claude fixes only reproduced failures on its own branch, with test first if practical, and regenerates candidate-generation proof hashes for changed overlay/cartridge. If a changed cartridge differs from the pinned 202610261949 candidate, issue a new candidate generation and internally consistent SHA/manifest/route; do not overwrite the existing immutable candidate files. Never edit original root pointer. Independent reviewer repeats all challenges on final Claude SHA, evaluates deltas and signs or vetoes.

**Step G: independent veto.** The final reviewer adjudicates ALL V1–V15 explicitly with evidence paths and distinguishes owner-approval-only conditions from technical PASS. Result must be either RELEASE-CANDIDATE / NO-RELEASE / BLOCKED-PENDING-OWNER. RELEASE-CANDIDATE is NOT permission to deploy.

## 9. Explicit V1–V15 veto gates

V1 hash baseline; V2 untouched bridge/data interceptor; V3 no fifth app/copy; V4 60+3/proxy/marker exact; V5 original surface/DOM parity; V6 four viewport, four-state masked screenshot + geometry parity; V7 hit-tested ON/OFF/reload state; V8 explicit selected/actual detection period and source; V9 no imaginary 12-month history / unknown gaps; V10 zero/error/stale and state on error; V11 original menu/search/SLD/all-layer regressions; V12 lint and STATE parity; V13 governance/branch/pointer/deployment; V14 no V6 UI transplant; V15 bounded mutation observer and idle side-effects. Refer to the exact original checklist and report disagreements, not silent rewrites.

**Additional judgement**: Are P14 clipped Grid mirror, D08 v1 compatibility, D15 FAIL stays ON, and D11 drill-down limitations genuine release blockers? Give competing positions, screenshots/repro, preferred disposition, and an owner decision row for each.

## 10. See Through / Kuiper second product: bounded design-only stream (NOT a blocker for GridAtlas)

Nine of twenty promised conceptual memos reportedly exist in PR #31. At most finish the eleven missing as distinct, grounded READ-ONLY memos if the owner wants concept completion; no distracting code integration into Atlas. Design a separate, linked, versioned See Through Lightning explorer using existing kuiper-belt/see-through code. Do not move Earth coordinates onto Vogel/Kuiper key-space or render artistic thunderbolt trajectories as observed sensor data; do not blend MapLibre 4.7.1 from See Through with original GridAtlas 3.6.2, or silently relicence code (CERN-OHL-S/attribution obligations vs Apache-2.0). Consider professional-grid and public-education storyboards, source uncertainties, accessibility and mobile performance. Recommend A minimal native GridAtlas, B standalone immersive See Through, C linked hybrid with shared archive; owner decides. Do not create a new repo or product implementation without separate approval.

## 11. Safety/data/evidence quality and CI constraints

- Separate real sensor points from simulated/fake fixture inputs. Synthetic counts are permitted only inside fixture metadata and must be clearly labelled.
- Do not infer lightning damage to UK substations from optical events, imply pinpoint strikes, invent unobserved cloud-to-ground channels, or ascribe fault causality.
- Handle broken and hostile JSON/GeoJSON as untrusted input; never inject source strings as HTML. Validate bounds, count, date ranges, lengths and remote URL origin.
- Keep token/network/runtime usage proportionate. A failed external dependency is recorded, not silently skipped or replaced with weaker green tests.
- No secrets or EUMETSAT tokens in logs/branches/screenshots. Don't delete significant evidence to save CI size. Avoid repository bloat from duplicated binary screenshots; retain only essential changed receipts and compressed report artefacts.
- Distinguish source file assertions, simulated fixture tests, browser-on-live evidence and direct real device observation.
- Avoid tests that count DOM structure but do not actually click and observe outcomes; avoid screenshots at rest only.

## 12. Required concrete outputs from Claude branch

A. **BASELINE-CHALLENGER-RESULT.md**: fail-first reproductions with exact PR #30 SHA and harness.
B. **CLAUDE-CANDIDATE-HARDENING.md**: each issue, code file changed, why fix is minimal, invariants proven, before/after screenshots/test receipts, footprint.
C. **TEST-MATRIX.json**: P01–P16, D01–D18, R01–R12 and V1–V15 with exact PASS/FAIL/BLOCKED/NOT_TESTED/OWNER_DECISION and evidence link.
D. Regression/negative-case scripts and fixtures, modified only on Claude branch.
E. If code changes: a NEW, immutable candidate generation with matching manifest, proof, URL, SHA, byte budget and a DRAFT PR. Never overwrite generation 202610261949.
F. **OWNER-REVIEW.md**: clickable preview route (if legitimately published) or precise local route; side-by-side screenshots of original and candidate at four widths, list of unresolved differences, all owner questions.
G. A draft PR against original candidate branch for head-to-head review, plus a single top-level comment on THIS ISSUE with links and no claim of final release.

Required concrete outputs from ChatGPT branch are an INDEPENDENT-REVIEW.md, test additions/scripts and evidence matrix plus separate draft PR against original candidate, no builder modifications.

## 13. Required acceptance outputs / final three-way review

Prepare a three-column decision table: **original GridAtlas** vs **Claude hardened candidate** vs **ChatGPT challenged candidate**. Show architecture, UI same/different, controls, browser proofs, data truth, failures, transport, performance, and unsatisfied gates. Compare GitHub SHAs and file diffs. If the two reviewers disagree, reproduce each contested point with the same pinned harness and document the resolution without averaging verdicts.

Before ANY release:
1. Independent reviewers complete protocol and signed V1–V15 matrix;
2. Owner explicitly decides Grid-footer placement and any other deviations;
3. Owner visually approves on real device(s);
4. Owner separately authorises a distinct release PR; only that PR may move atlas/current.json, regenerate STATE.md and update state/live-set.json plus releases/current-v5.json atomically; never implied by approval of this issue;
5. Rollback plan must identify old generation, preview routing, data compatibility, sanity checks and an atomic pointer rollback.

**Stop immediately** and report if a branch, live pointer or protected file moves unexpectedly; do not silently rebase onto main and continue.

## 14. Claude Code pickup — exact first action

Read this issue fully, then check out the ALREADY CREATED branch claude/lightning-independent-hardening-20261026 from fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d in a NEW worktree. Verify status clean and confirm production pointer untouched. Read PR #31 handover, PLAN and audit evidence, PR #30 candidate and PR #2 data plane. Run BOTH independent challenger protocols on UNMODIFIED candidate first, record failed/bounded cases, then harden only reproducible faults on your branch. Push evidence and code there, open DRAFT PR against candidate/202610261949-uk-lightning-additive; DO NOT MERGE OR DEPLOY. ChatGPT owns the other branch and separate veto review.

Post initial branch/SHA and every major pass/fail to this issue. Ask for owner decision only where one is truly required; do not halt safe read-only testing on account of the Grid footer choice.

**Binding instruction:** No release, merge or deployment from this work order. The owner will review both independent branches together.
