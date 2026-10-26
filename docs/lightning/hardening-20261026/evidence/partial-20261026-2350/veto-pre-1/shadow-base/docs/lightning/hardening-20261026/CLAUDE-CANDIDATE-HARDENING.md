# CLAUDE-CANDIDATE-HARDENING — issue #32 §12 B (TEMPLATE, pre-filled 2026-10-26 by opus-matrix-aggregator)

> Template status: skeleton. Every "Fix", "After" and "Footprint (measured)" field is TODO until the lead applies a change.
> Pre-filled from: `reports/overlay-code-review.md` (OCR), `reports/opus-owner-decisions.md` (OWD),
> `evidence/owner-device-20261026/README.md` (DEV), and ChatGPT's H01–H05 as run by the lead
> (`evidence/chatgpt-suite-run/run-20261026.log`, suite at ChatGPT SHA 49696b5, Node v22.23.4, Node-VM harness, no browser).
> Nothing here is a verdict. "Reproduced" means a lane recorded a failing run; the harness is named every time.

## 0. Pins and budget (fill in on the hardened SHA)

| Item | Before (pinned) | After |
|---|---|---|
| Candidate SHA / generation | fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d / 202610261949 (immutable, never overwritten) | TODO new SHA / new generation (§12 E) |
| Module | `atlas/modules/202610261949-uk-lightning-overlay.js`, 23,973 B, 187 lines, sha256 3ce0ddc1059f5de08e77dc99d58bd633a2c5ed8fa97964c3093c46c45f2cb277 | TODO path, bytes, sha256 |
| Cartridge | `atlas/cartridges/202610261949-sld-sandbox-v9-8.js`, 459,192 B = 435,218 + LF + 23,973 | TODO bytes (ceiling 460,000) |
| Module ceiling | 24,781 B (460,000 − 435,218 − 1) → 808 B headroom | TODO headroom |
| Second ceiling in play | ChatGPT static check asserts overlay ≤ 24,000 B (`chatgpt-lightning-static-review.mjs`, "overlay stays under 24000-byte ceiling") → 27 B headroom | UNRESOLVED: which ceiling governs. A fix set above +27 B passes one check and fails the other (`reports/opus-decision-table.md` §2, Performance row) |
| Production | main c08f3a6, generation 202609241334 | TODO reconfirm. NOTE: `git -C wt log origin/main` shows 3c5717e (2026-10-26 22:37 UTC, "Publish isolated experimental … candidate route without touching live composition"); DEV says the owner's iPhone loaded the route published by 3c5717e. Whether atlas/current.json and STATE.md are unchanged at 3c5717e: not checked by this lane |

Running byte ledger (proposed deltas are OCR §4 estimates, not measurements):

| Issue | Proposed Δ (OCR) | Measured Δ | Cumulative |
|---|---|---|---|
| (fill in per applied fix) | | TODO | TODO |

## 1. Invariant proofs to re-run after every change (reference list for the "Invariants proven" fields)

- I1 exact delta: `node tools/proofs/<NEWGEN>-sld-sandbox.proof.mjs` (prefix byte-for-byte, + LF + module, sha256 matches manifest).
- I2 composition: `node tools/proofs/run-current.mjs`; `node tools/scope/verify-compose.mjs`; `cmp atlas/index.html atlas/v/<NEWGEN>/index.html`.
- I3 governance: `node tools/scope/loop.mjs lint`; `node tools/scope/loop.mjs state --stdout | cmp - STATE.md`; 31-file `sha256sum -c` (P01/V1).
- I4 controls: `menuBar.inspect()` OFF and ON, 63 proxies, 63 keys, 13 original groups in order (P05/V4).
- I5 OFF silence: 0 lightning requests, no source/layer, no timer while OFF; reload resets OFF (P13/V7).
- I6 ChatGPT suite: `node --test tools/proofs/chatgpt-lightning-regression.test.mjs` (H01–H05) and `node tools/proofs/chatgpt-lightning-static-review.mjs`.
- I7 OCR browser repro: `node evidence/overlay-code-review/browser-repro.mjs <port>`, `node evidence/overlay-code-review/browser-repro-c.mjs <port>`; Node probes `probe-arith.mjs`, `probe-vk2.mjs`.
- I8 parity: lane B parity harness OFF matrix (`evidence/visual-challenge-B/parity/`), same harness before/after.
- I9 mutation budget: 30 s idle ON, lightning-caused mutations < 20 (P12/V15).

## 2. Issue sections

Field key for every section:
- **Defect**: what is wrong, observed behaviour versus expected behaviour.
- **Matrix rows**: the P, D, R and V rows it affects.
- **Reproduction**: lane, harness, command, artefact, and its status: REPRODUCED-BROWSER, REPRODUCED-NODE, REPRODUCED-LIVE, READING-ONLY, or NOT-REPRODUCED.
- **Code changed**: file and line range at the pinned SHA, then the new range.
- **Why minimal**: why the change is as small as possible.
- **Invariants proven**: which I1–I9 proofs passed, with the receipt path for each.
- **Before / after receipts**: the paths before and after the change.
- **Footprint**: bytes.

Line numbers below are module lines at fda6b10 (spot-checked by this lane: L11 `NA=`, L17 `T=`, L37 schema, L64 `ok=`, L69 `S.fp`, L80 bytes, L92 stale, L158 nav, L162 `sp=`, L164 apply, L168 `ld=`, L174 timer).

### HC-01 Live feed never re-fetched (10-min refresh and OFF→ON reuse a cached feed promise)
- **Defect:** `S.fp` (L69) is never invalidated. Refresh at L168 resets only `S.ip`, and re-ON at L174 calls `ld()` without refresh. With no archive (today's production path), the 7-day feed is fetched once per page lifetime.
- **Matrix rows:** D13, D15, R10, V10.
- **Reproduction:**
  - REPRODUCED-BROWSER: OCR browser B, lead-shim, Chromium 153, 1440×900, `lightning-no-index` fixture, fake clock +20 min. Request log `['index.json','uk_lightning.geojson','index.json','index.json',…]` in `evidence/overlay-code-review/browser-out/`; command `node evidence/overlay-code-review/browser-repro.mjs 8146`.
  - Re-ON: OCR browser A gave `newRequestsSinceOff: []` (OCR #6).
  - REPRODUCED-NODE: H01 "refresh / OFF→ON must revalidate the live feed", expected 2 fetches, got 1 (run log L10–31).
  - ChatGPT static W01 needs a dynamic test.
- **Code changed:** TODO. OCR proposes F3 at L168 (`if(refresh)S.ip=S.fp=null;`, +5 B) and F8 at L174 (`ld(true)`, +4 B). An unreviewed draft diff exists at `evidence/opus-fix-designer/H01.diff` (partial lane, no report; its combined browser run log shows a Chromium launch failure).
- **Why minimal:** TODO.
- **Invariants proven:** TODO (I1–I3, I5, I6 H01, I7 browser B).
- **Before / after receipts:** before as listed above; after TODO.
- **Footprint:** proposed +9 B; measured TODO.

### HC-02 Feed mode never shows STALE
- **Defect:** at L92, `stale:!!(r.idx&&stale(r.idx,now))` only computes stale from the index. In feed fallback, a 5 h 55 min-old feed shows `[408 | 7d]`, PARTIAL and a frozen `Refresh live feed 13:05 UTC` with no STALE.
- **Matrix rows:** D13, D14, V10.
- **Reproduction:**
  - REPRODUCED-BROWSER: OCR browser B, `B2-feed-after-20min.png`.
  - REPRODUCED-NODE: H02, expected true, got false (run log L32–57).
- **Open question:** threshold. The veto V10 trigger is feed `latest_detection_utc` > 24 h. OCR F4 proposes `query_end_utc` > 4 h. `reports/opus-decision-table.md` wording disagreement D6 says a ruling is needed before the number is fixed.
- **Code changed:** TODO. OCR F4 at L92 (+51 B); draft `evidence/opus-fix-designer/H02.diff` (unreviewed).
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** proposed +51 B; measured TODO.

### HC-03 Hostile timestamp strings wedge the overlay until OFF/ON
- **Defect:** `T()` and `ymd()` at L17 throw on NaN. Index `first/last_observation_utc` (L107) and feed `query_start/end_utc` / `latest_detection_utc` (L102) are parsed without validation. The result is `RangeError: Invalid time value`; every later chip or nav click throws, the label stays `[LOAD]`, and only OFF→ON recovers.
- **Matrix rows:** D15, §11 (untrusted input).
- **Reproduction:** REPRODUCED-BROWSER with SYNTHETIC fixtures:
  - OCR browser C (`SYNTHETIC-hostile-index-first-obs`, `C1-12m-hostile-first-obs.png`);
  - OCR browser D (`SYNTHETIC-hostile-feed-query-end`, `D1-feed-hostile-query-end.png`);
  - command `node evidence/overlay-code-review/browser-repro-c.mjs 8146`; fixtures described in `evidence/overlay-code-review/fixtures/README.md`.
- **Code changed:** TODO. OCR F1 at L17 (`if(!isFinite(t))return'unknown'`, +32 B).
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** proposed +32 B; measured TODO.

### HC-04 CUSTOM chip during first LOADING dereferences null and paints a stale window
- **Defect:** `sp('custom')` at L162 calls `pt(false)` with `S.res===null`, and `pt(false)` at L153/159 throws `TypeError … reading 'colour'`. No `S.serial++` happens, so the in-flight 24h result then paints under the CUSTOM chip.
- **Matrix rows:** D10, D14.
- **Reproduction:** REPRODUCED-BROWSER, OCR browser A steps 3–4 (`A1-custom-during-loading.png`, `A2-24h-caption-under-custom-chip.png`).
- **Code changed:** TODO. OCR F2 at L162 (−18 B).
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** proposed −18 B; measured TODO.

### HC-05 PREV enabled in feed-only mode; past feed windows claim "Searched EUMETSAT 0%"
- **Defect:** L158 leaves PREV enabled without an archive. After 48H → PREV ×2, the caption reads "Searched EUMETSAT 0% of window — no collection run covers these dates" and the label UNKNOWN while 261 and 91 flashes are drawn. The third PREV throws at L68 → FAIL. The feed cannot know that negative.
- **Matrix rows:** D07, D13.
- **Reproduction:** REPRODUCED-BROWSER, OCR browser B PREV#1–#3, `B3-feed-48h-prev3.png`.
- **Code changed:** TODO. OCR F5 at L158 (+10 B); F6 wording is optional (+103 B, "largely moot after F5").
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** proposed +10 B; measured TODO.

### HC-06 Feed-mode coverage "SEARCHED 2%" at the latest window
- **Defect:** in feed fallback at 7D, the status reads "PARTIAL · 408 FLASHES DRAWN · SEARCHED 2%". The feed metadata records only the last 3-hour query window, so feed-mode coverage of the 7-day window is unknown, not 2%. DEV item 2 calls it misleading. OWD ("What you should see today") calls it an R06/D13 question for reviewers.
- **Matrix rows:** D07, D13, R06.
- **Reproduction:**
  - REPRODUCED-LIVE: owner iPhone Safari, GitHub Pages route, 22:44 UTC, `evidence/owner-device-20261026/iphone-safari-live-pages-v202610261949-7d-ON-2244.png`.
  - Also seen under lead-shim (OWD R02 section).
  - Classification as defect versus wording: UNRESOLVED, reviewer to rule.
- **Code changed:** TODO (no fix proposed by any lane yet).
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** TODO.

### HC-07 30D–12M chips disabled in feed fallback with no explanation at the chip
- **Defect:** DEV item 1, owner report: "doesn't work at 12 months, gets stuck at 7 days". Long-period chips render dimmed or disabled with no reason at the chip. Expected: they respond and say plainly that the archive is not yet published and earlier coverage is UNKNOWN, not zero.
- **Matrix rows:** D05, D06, P15.
- **Reproduction:**
  - REPRODUCED-LIVE: owner iPhone, as for HC-06.
  - Lead-shim: OWD R02 section records "30D/3M/6M/12M are greyed out" with a v1-index fixture.
  - Sandbox reproduction with the `lightning-no-index` fixture: TODO.
  - Related: OCR #12, where disabled chips and nav look identical to enabled because the shell has no `:disabled` rule for `.map-ctrl-btn`.
- **Code changed:** TODO. Disabling logic is L156–158 per OCR; exact range TODO.
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** TODO.

### HC-08 Pre-existing "▾ HIDE LAYERS" fixed button covers the lightning caption's last lines
- **Defect:** the original sld-sandbox fixed button overlaps whatever group is last in the Layers panel. With lightning ON, that content is the mandated caveat text ("…ground strikes · Missing days are unknown…").
- **Matrix rows:** P14, D13.
- **Reproduction:**
  - REPRODUCED-LIVE: owner iPhone (DEV item 3).
  - Lead-shim 1440×900: `evidence/opus-owner-decisions/shots/E2-v1-index-1440x900-7d-group.png`.
  - Lane B raw (unreported): `evidence/visual-challenge-B/owner-defect/hide-layers-occlusion.json` and `side-by-side-393x852-bottom-baseline-vs-candidateON.png`.
- **Constraint:** the original button bytes and CSS must not change (issue §2: no injected CSS targeting original controls), so any fix must live inside the lightning-owned group. Whether that is possible within budget is UNKNOWN.
- **Code changed / Why minimal / Invariants proven / Receipts / Footprint:** TODO.

### HC-09 Coordinates not bounds-checked (H03)
- **Defect:** `ok()` at L64 never checks `geometry.coordinates`, so out-of-box or non-numeric points reach MapLibre.
- **Matrix rows:** D02, §11.
- **Reproduction:**
  - REPRODUCED-NODE: H03, `bad coordinate: [150,10]` accepted (run log L58–83).
  - OCR: READING-ONLY (OCR #10).
  - Browser: NOT-REPRODUCED.
- **Code changed:** TODO. OCR F14 in `ok()` (+76 B, tier 2); draft `evidence/opus-fix-designer/H03.diff` (unreviewed).
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** proposed +76 B; measured TODO.

### HC-10 Index/shard metadata not cross-validated (H04), weak numeric validation, `bytes:null` budget hole
- **Defect:**
  - Shard count, bytes and sha256 are not checked against the index (H04). sha256 is never verified, a known deviation shared with the reference client.
  - L33–35 accept non-integer, boolean, array, Infinity and string counts or bytes (OCR #9).
  - `parts[]` is not validated (OCR #9).
  - At L80, `t.bytes>=0` is true for `null` (OCR #8).
- **Matrix rows:** D08, D11, D15.
- **Reproduction:**
  - REPRODUCED-NODE: H04, "Missing expected rejection" (run log L84–100).
  - OCR `node evidence/overlay-code-review/probe-vk2.mjs` (verbatim helpers, Node) → `probe-vk2.out.txt`.
  - Browser: NOT-REPRODUCED.
- **Code changed:** TODO. OCR F9 at L80 (−1 B), F11 (+25 B), F12 parts (+112 B, optional); draft `evidence/opus-fix-designer/H04.diff` (unreviewed).
- **sha256 verification:** cost within the budget is UNKNOWN.
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** proposed −1 to +136 B; measured TODO.

### HC-11 Sub-day window captions whole-day index counts as "archived in window" (H05)
- **Defect:** the caption template at L105 (`Flashes N archived in window (index) …`) uses whole-UTC-day index counts for a window that covers only part of those days. Example from the H05 run: "Flashes 50,000 archived in window (index) · 1 downloaded from the newest 1 of 2 days …".
- **Matrix rows:** D03, D13, V8.
- **Reproduction:**
  - REPRODUCED-NODE: H05 (run log L101–126).
  - OCR does not list this defect.
  - Browser: NOT-REPRODUCED.
- **Code changed:** TODO. Draft `evidence/opus-fix-designer/H05.diff` (unreviewed).
- **Why minimal / Invariants proven / Receipts:** TODO.
- **Footprint:** TODO.

### HC-12 Future "From" date accepted in CUSTOM
- **Defect:** L164 validates only `f<=t`. With `From=2030-01-01`, the span is −1162 d and the state is UNKNOWN.
- **Matrix rows:** D09, R05.
- **Reproduction:** REPRODUCED-NODE, OCR `probe-arith`, "custom future window".
- **Code changed:** TODO. OCR F7 (+22 B, tier 2).
- **Footprint:** proposed +22 B.

### HC-13 LOAD POINTS overshoot; 32 MB limit not applied after consent
- **Defect:** at L82/108, whole days are added until the total reaches 40,000, so the last day overshoots. The builder's run loaded days with an index count of 119,902 (synthetic). The phone 10 k cap only switches clustering.
- **Matrix rows:** D11, P16.
- **Reproduction:**
  - READING-ONLY (OCR #21, OWD D11).
  - Builder artefact: `../lightning/evidence/atlas-implant-builder/candidatepoints-202610261949-lightning-archive-big-count-1440x900.json`.
  - Independent browser reproduction: TODO.
- **OWD says:** "fix first" before the owner rules on caps.
- **Code changed / Why minimal / Invariants proven / Receipts / Footprint:** TODO.

### HC-14 "archive not yet published:" wording is wrong when the index exists with an unsupported schema
- **Defect:** the L11 constant `NA='archive not yet published'` is also used for a published v1 or unknown-schema index.
- **Matrix rows:** R02, D06.
- **Reproduction:** REPRODUCED-NODE (OCR `probe-vk2`; pr2-data-verifier `exp5-client.log`, cosmetic). OWD proposes "archive unavailable:".
- **Code changed:** TODO (one constant). **Footprint:** TODO (string length alone: 25 → 19 characters, −6 B; not measured in the module).

### HC-15 Install poll and document-wide MutationObserver never give up
- **Defect:** at L184–185, if the menu never installs, `ins()` runs 4×/s plus once per DOM mutation for the page lifetime.
- **Matrix rows:** V15, P12.
- **Reproduction:** READING-ONLY (OCR #11). No failing run recorded.
- **Code changed:** TODO. OCR F10 (+34 B, tier 2).

### HC-16 Accessibility: no `aria-pressed`, disabled controls look enabled, static `aria-label` on the Grid twin
- **Defect:** L131/156 (OCR #12) and L143 (OCR #13). Screen readers never hear `[FAIL]` or the count suffix.
- **Matrix rows:** P07, P15, R03.
- **Reproduction:** READING-ONLY, plus OCR screenshots `A1`/`B3`.
- **Code changed:** TODO. OCR F13 (+34 B) and R2 (−21 B).

### HC-17 Cosmetic and low-severity register (one section each when acted on)
Every item: Reproduction READING-ONLY or REPRODUCED-NODE as stated in OCR §3; Fix TODO; After TODO.
- OCR #14, L109: dead ternary (R1, −41 B).
- OCR #15, L166: month NEXT drifts 2 d (probe-arith; optional, about +30 B).
- OCR #16, L153/168: LOADING keeps the previous caption and points (optional, about +40 B).
- OCR #17, L46: an older `index.json` response can overwrite `S.idx`.
- OCR #18, L69: an invalid-shape feed is cached (F15, +20 B, optional).
- OCR #19, L164–165: custom validation UX.
- OCR #20, L20/71/83/100: `cap()` is evaluated twice across a viewport change.

## 3. Owner-gated items: no code change until ruled

These are linked, not duplicated. See `reports/opus-owner-decisions.md`.
- **R01** Grid footer mirror (A as built, B or C).
- **R02** v2-only index.
- **R03** FAIL keeps the switch ticked (amend V10?).
- **R04/R05** no drill-down; CUSTOM has no ◀/▶.
- **D11** caps.
- **Step E** devices and HTTPS preview.

For each item, record: the ruling (TODO), the date and who ruled (TODO), the resulting code change if any (TODO, with an HC-section), and the matrix rows updated (TODO).

## 4. Reported, not fixed here (lightning data plane, PR #2 at f7db76c)

See `reports/pr2-data-verifier.md`. This includes D-1 (false zero after a missing shard), D-2 (one-hour storm exceeds 25 MB, `ShardTooLarge`), D-3 (unparseable product names over-claim searched coverage) and D-4 (bootstrap heartbeat lost, `git add` exit 128). Issue §4.6: no push to lightning without a separate owner decision. Status: TODO (owner).

## 5. Known limitations after hardening (fill in)
- BLOCKED_DEPENDENCY: live CORS and cache on raw.githubusercontent.com (R07; partial live receipt in DEV, iOS WebKit XHR feed fetch worked at 22:44 UTC); DuckDB/REPD; basemap tiles and glyphs; EUMETSAT.
- BLOCKED_HARNESS: WebKit in the sandbox (iPhone rows are Chromium emulation).
- TODO: anything left unfixed for budget reasons, with the §4.5 explanation and the proposed safe alternative.
