# Independent ChatGPT source review — GridAtlas Lightning candidate 202610261949

**Date:** 26 October 2026. **Assignment:** https://github.com/Ventusltd/gridatlas/issues/32  
**Role:** independent adversarial reviewer; not the builder or release authority.  
**Source checked:** GridAtlas candidate head fda6b10f7d2672bf1bf74c4fbf6184cd36b1ec1d; production main c08f3a6178752d9ccc77ce76451107f28375a8b2; candidate file atlas/modules/202610261949-uk-lightning-overlay.js; collector draft Ventusltd/lightning PR #2.

## Status: NO-RELEASE / independent challenge incomplete

This is an initial **GitHub source inspection**, not a completed V1–V15 veto, screenshot review, browser test, collector exercise, or hardware review. The authoring environment can read and commit through the connected GitHub repository, but local git clone failed DNS for github.com, and its browser/test fixture suite was therefore not available for independent execution. Script committed on this branch: tools/proofs/chatgpt-lightning-static-review.mjs. Do NOT report that Node script as green until it is run in a repository checkout. It implements non-destructive static checks and prints separate dynamic-test warnings.

Confirmed GitHub facts:
- main atlas/current.json still specifies production 202609241334; candidate current.json specifies 202610261949 and previous_generation 202609241334.
- Candidate overlay references genuine Ventusltd/lightning archive and feed URLs, distinguishes optical flashes from confirmed ground strikes in the footer, uses XHR for .geojson and fetch for .json, and begins S.on=false.
- Claude's PR #30 is draft and unmerged; PR #31 includes baseline/test receipts but they are not substitutes for THIS independent challenger.
- The module is approximately 23,973 UTF-8 bytes and sld-sandbox budget is only 460 KB, leaving limited headroom. Keep this in mind for fixes.

## Findings requiring reproducible challenger tests

### H01 — HIGH: rolling live feed appears permanently cached across refresh and OFF/ON

Source: overlay lines 67–71 and 168–175.

The live fallback uses a singleton successful promise: S.fp || (S.fp = gx(FEED)...). The refresh path resets S.ip (archive index promise), but not S.fp (live feed promise). OFF also leaves S.fp intact. When archive index is unavailable, the first successful 7-day feed can therefore remain in memory indefinitely, even if the ten-minute timer runs and even when the layer is toggled OFF then ON.

**Test:** serve an index 404; first XHR response feed A, note its latest flash/metadata; change the network fixture to feed B containing a later genuine fixture point; invoke LATEST / simulate 10-minute refresh / toggle OFF and ON. Assert a second XHR and that visible actual timestamps/counts match B. If still A, FAIL. A successful timer invocation is not sufficient.

**Repair options for Claude:** invalidate S.fp on refresh and on new activation (not for every concurrent window navigation); use explicit short TTL and in-flight deduplication; ensure abort/serial logic prohibits a late older response overwriting newer state. Measure idle network cost.

### H02 — HIGH: a stale live feed cannot acquire STALE state

Source: overlay line 92, cf(); feed source at 67–71; caption at 101–103.

The stale modifier is conditional on r.idx. In the live fallback r.idx is null, so stale is false for an hours- or days-old successfully fetched feed. Captions expose the feed's last query window but the primary state does not warn that it is stale. Users may regard the count as current. This is especially important with an intermittently scheduled collector.

**Test:** index unavailable and feed published/query_end_utc older than 24h, then 7d; verify visible STALE/UNKNOWN freshness message and no assertion that the empty/newer sky was observed. Compare a fresh feed and an absent timestamp. Choose and document freshness thresholds grounded in PR #2 status heartbeat and expected update interval.

### H03 — HIGH: feature validation does not enforce geographic bounds or numeric coordinates

Source: overlay lines 64–65, ok(), co().

Validation checks Feature, geometry.type=Point, observation_kind and parseable time, but has no numeric lon/lat array, finite-position or UK bounding-box test. Wrong-place or malformed source features may be passed to MapLibre. IDs are coerced with String(f.id); missing IDs all collide at the key "undefined".

**Test:** fixture with valid point, out-of-UK point, longitude NaN/string/null, missing/broken coordinates, unsupported geometry and missing id. Verify no bad points drawn, valid event count unchanged, invalid count/warning surfaced without XSS. Preserve real source centroid: do NOT geocode to a nearby station.

### H04 — MEDIUM/HIGH: index-to-shard integrity is not checked at the point of use

Source: overlay lines 33–35, 56–65, sh().

Candidate validates shard schema, type, features array and metadata.date_utc but does not verify index row's expected SHA-256, bytes, per-file count, parts metadata or duplicate IDs at load time. PR #2 explicitly includes hashes and sizes to detect cache skew. The UI can give inconsistent archived-vs-rendered totals when a shard is stale or tampered; the caption's partial warning is based on request failures, not necessarily integrity mismatch.

**Test:** index row advertises count/hash for shard A but server returns shard B with the same date, shorter length, different IDs; expected explicit mismatch warning/FAIL and no dishonest 'complete' state. Exercise a split day parts[] with one missing hourly part. If cryptographic validation cannot fit module budget, at least compare defensible count/bytes/metadata, mark unverified hash and provide an offline proof gate. Do not invent a green hash-check claim.

### H05 — MEDIUM: index count for overlapping partial UTC days can exceed selected-window count

Source: overlay lines 74–84, 94–108.

r.arch sums whole-day known counts for every UTC day overlapping the selected window before shards are time-filtered. Detail mode usually captions actual filtered n, but the budget/LOAD POINTS flow can label r.arch 'archived in window' even though it covers entire edge days. Overview wisely says 'on overlapping UTC dates'; preserve that distinction.

**Test:** 12-hour period crossing midnight with large day counts outside the selected interval, triggering the summary budget. Check exact caption, over-count disclosure, percent coverage and that 'archived in window' is never claimed from day-only totals without caveat. Prefer 'on overlapping dates' when precise counts unavailable.

### H06 — OWNER DECISION: desktop Grid footer mirror is clipped

The candidate report already documents that #map-container overflow:hidden clips the footer Lightning control at 1440x900 and 1280x720; the original Layers tab in the same zone was also clipped. The primary native Layers panel remains open on desktop. Compare footer (no original movement) against head-row role=checkbox (potential original body movement). Require owner choice and actual hit-testing before applying changes. Never mask the menu area in screenshots or use Playwright forced click/programmatic scroll as proof of physical reachability.

### H07 — OWNER DECISION: error toggle, historical v1 schema and summary drill-down

Candidate kept the toggle ON during FAIL to preserve red explanation even though old veto V10 expects OFF; candidate accepts only index v2, not v1; custom one-day navigation substitutes for certain overview drill-downs. These are deliberate deviations from PLAN; require an explicit record before final veto, not silent approval.

### H08 — BLOCKED until independent external/device execution

Real EUMETSAT source operation, actual raw.githubusercontent.com CORS/cache, basemap tiles/glyphs, original DuckDB/Parquet and REPD search, mobile Safari/WebKit, physical Android and iPhone hit tests, stale/refresh 10 minutes, and history hourly parts[] were not independently exercised here. Claude's offline shim cannot count as proof for these.

## Preliminary V1–V15 matrix (not a signed veto)

| Gate | Preliminary status | Reason |
|---|---|---|
| V1 original files protected | STATIC SOURCE CONSISTENT; SHA CHECK PENDING | GitHub shows original pointer; local 31-file manifest not independently re-run |
| V2 original bridge | STATIC SOURCE CONSISTENT; RUNTIME PENDING | overlay uses JSON fetch / XHR feed; counters/real CORS untested |
| V3 no fifth app | STATIC SOURCE CONSISTENT | PR #30 changed 8 files; only versioned candidate route, no separate loader |
| V4 60+3/proxies | BUILDER RECEIPT ONLY | need fresh OFF/ON inventory and real click |
| V5 surfaces preserved | UNVERIFIED | desktop footer clipping is explicit |
| V6 parity four viewports/states | BLOCKED | independent harness not executed |
| V7 live toggle/source/reload | BLOCKED | independent browser not executed |
| V8 attribution/window | SOURCE-LEVEL PRESENT; BEHAVIOUR PENDING | seven caption template code exists; partial-day counting ambiguity |
| V9 historical honesty | PARTIAL SOURCE REVIEW | index v2 only; fallback older than feed errors visibly |
| V10 zero/error/stale | AT RISK / LIKELY FAIL | H01/H02 feed freshness and H07 toggle deviation |
| V11 original regressions | BLOCKED | existing receipt is builder's, not independent |
| V12 lint/state | BUILDER RECEIPT ONLY | independent Node run pending |
| V13 governance | PASS ON GITHUB AT TIME CHECKED | draft candidate, main unchanged; re-check before release |
| V14 no V6 UI transplant | SOURCE REVIEW ONLY | final grep/browser comparison pending |
| V15 mutation budget | BUILDER RECEIPT ONLY | 30s independent idle measurement pending |

No RELEASE/NO-RELEASE signature can be inferred from a static report. Current recommendation is **NO-RELEASE pending H01–H04 tests, P14 owner decision and full independent V1–V15 evidence**.

## Commands for a local independent reviewer

From checkout of chatgpt/lightning-independent-veto-20261026 or equivalent candidate descendant:

    node tools/proofs/chatgpt-lightning-static-review.mjs 202610261949
    node tools/scope/loop.mjs lint
    node tools/scope/loop.mjs state --stdout > /tmp/state-chatgpt.txt
    cmp /tmp/state-chatgpt.txt STATE.md
    node tools/proofs/202610261949-sld-sandbox.proof.mjs
    node tools/proofs/run-current.mjs

Then run PR #31 visual-parity/regression challenger protocols in a matching local environment, before interpreting or marking any gate PASS. For hardened generation, pass that generation to the static script, and compare both versions independently.

**Next handoff:** Claude hardening branch owns reproducible fixes and a new immutable candidate generation; ChatGPT branch remains an independent review branch. Cross-review only after SHA freeze and owner review of the Grid footer.
