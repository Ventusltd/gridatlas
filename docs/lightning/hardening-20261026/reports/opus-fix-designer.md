# opus-fix-designer: one combined, tested fix set for the 202610261949 lightning overlay

- **Base:** `atlas/modules/202610261949-uk-lightning-overlay.js` at fda6b10 (23,973 bytes, sha256 `3ce0ddc1…2cb277`). The worktree was read-only and was not touched.
- **Harness:** self-fixture. node v22.23.4, `node:vm`, a minimal synthetic DOM (`minidom.mjs`), and SYNTHETIC index, feed and shard data built inside the tests. No browser was used, so WebKit and real devices are NOT_TESTED here.
- **Evidence folder:** `evidence/opus-fix-designer/`. All paths below are relative to it.

## 1. Result

| Variant | File | Bytes | 24,000 proof cap | 24,781 ceiling | My tests (16) | ChatGPT suite (6) |
|---|---|---|---|---|---|---|
| original | `orig/…/202610261949-uk-lightning-overlay.js` | 23,973 | met | met | **0 pass / 16 fail** | 1 pass / 5 fail |
| **B, complete** | `fixed-module.js`, `FINAL.diff` | **24,170** | **exceeded by 170** | met (611 spare) | 16 / 16 | 6 / 6 |
| **A, ≤ 24,000** | `fixed-module-A.js`, `FINAL-A.diff` | **23,984** | met (16 spare) | met | 15 / 16 (LP fails as designed) | 6 / 6 |

**The complete set does not fit 24,000.** `tools/proofs/202610261949-sld-sandbox.proof.mjs:23` asserts `<= 24000`, so variant B needs an owner decision. The owner can either raise that assertion to the derived ceiling of 24,781 (cartridge 460,000 − live sld-sandbox 435,218 − 1 newline) or accept variant A.

**What variant A omits:**
1. The **LOAD POINTS overshoot fix** (owner pack, +144 B). In A, LOAD POINTS still keeps whole newest days until the running total reaches 40,000, so the last day can overshoot. It also ignores 32 MB after consent, and the caption still says "draws the newest 40,000".
2. The two new one-line comments (`// D02 UK box`, `// D08 (sha256 needs https)`), which are 42 B. The code is the same.

Variant A keeps every owner-device fix, H01–H05, F1–F6 and R02.

A cheaper partial LP fix would cost about +19 B (`if(r.sk[0]||run&&run+y.count>BUDGET)`), which puts A at about 24,003. That is 3 bytes over, so I left it out rather than shave text or comments to make it fit.

**Static checks** (`static-check.mjs` reproduces proof lines 23–39): A and B both pass the generation header, negatives, single `.geojson`, feed literal, XHR, history base, no-V6, positives, one IIFE and syntax. B fails only the 24,000 check (`out/static-check.txt`).

**Diff application:** `patch -p1 < FINAL.diff` applied to a pristine copy reproduces `fixed-module.js` byte-for-byte.

**Commands** (run from `evidence/opus-fix-designer/`):
```
node build.mjs                                   # writes fixed-module.js, fixed-module-A.js, FINAL.diff, FINAL-A.diff, bytes.txt
MODULE=<module> node --test --test-concurrency=1 test-fixes.mjs
LIGHTNING_MODULE=<module> node --test chatgpt-lightning-regression.test.mjs
node static-check.mjs <module>...
node fixture-check.mjs fixed-module.js <lightning fixture>/data
```
**Outputs:** `out/test-fixes-{orig,A,B}.tap`, `out/chatgpt-suite-{orig,A,B}.tap`, `out/static-check.txt`, `out/fixture-check.txt`, `out/sha256.txt`, `bytes.txt`.

**Hashes:** B `b928aace…8c6d`, A `590e2f37…496b`.

`build.mjs` applies each edit to the original exactly once, in groups, and records each group's byte delta on the cumulative text. These are the deltas below. They are order-dependent, because later groups edit text that earlier groups produced.

## 2. Funding (behaviour-preserving savings): −303 B

| ID | Change | Δ B | Source |
|---|---|---|---|
| S1 | `T`/`Ts` built from `toISOString().slice()`; `pad()` removed | −115 | byte-budget S1 |
| S2 | `NAV(k,t,x)` helper for the five `data-lightning-nav` buttons | −55 | byte-budget S2 |
| S3 | one `isFC()` predicate shared by day files and the feed | −37 | byte-budget S3 |
| S4/S5 | one `cu=S.period==='custom'` local in `wf()` and in `pt()` | −28 | byte-budget S4/S5 |
| S6 | one-statement `forEach` arrow | −2 | byte-budget S6 |
| R1 | dead `${L.refresh?' · '+L.refresh.slice(8):''}` at L109 | −41 | review #14 |
| D | dead `raw` field in the index record (`deadcode.txt`: written L43, never read) | −4 | byte-budget deadcode |
| R2 | drop the static `aria-label="${BASE}"` on the Grid twin, so the label text (with `[FAIL]` or `[N \| 7d]`) becomes the accessible name | −21 | review #13 |

The fixes also remove code that the new design makes unnecessary:
- the feed's synthetic `cv()` coverage, the `LONG` list and the chip-disable logic: −209 in the FEED row;
- the `cut` and `feedOnly` locals: −40 in the F5 row.

The byte-budget lane's "trade" items C1–C9 (header and section comments, the `cf` reasons, shape-documenting initialisers, shorter error messages) were **not** used. Using them would have cost readability or diagnosability.

## 3. Defects, fixes, deltas and tests

Each test is in `test-fixes.mjs`. Every test fails on the original for the reason it names; the raw messages are in `out/test-fixes-orig.tap`.

**Owner iPhone (LIVE observation 2026-10-26 22:44 UTC, reproduced here under self-fixture):**

**OD1. 30D–12M chips look dead in feed fallback.**
- Fix: chips are never disabled.
- `ff()` no longer throws `"… needs the archive"` for windows older than 7 days. It returns the feed's points that fall inside the window, flagged with `old:w.s<now-7*DAY`.
- `cp()` then sets the warning line to `archive not yet published: earlier coverage unknown, not zero`, or `archive unavailable: …` when the index is not a 404 (see R02).
- Result at 12M: label `[N | 12m]`, status `PARTIAL · N FLASHES DRAWN · SEARCHED UNKNOWN` (or `UNKNOWN` when there are no flashes). It is never FAIL.
- Δ: part of FEED (−209 together with OD2 and F6).
- Test: *Owner device 1*. Original fails with `30d chip disabled`.

**OD2 / F6 / review #5 second half. Feed-mode "searched 2%" and the past-window "searched 0%".**
- The feed records only its last collection window, so feed results now carry `cov:null`.
- `cf()` gives feed mode `PARTIAL` (flashes drawn) or `UNKNOWN` (none drawn), with reason `feed coverage unknown`.
- `sl()` prints `SEARCHED UNKNOWN`.
- `cp()` sets the searched line to exactly `Searched EUMETSAT unknown (live feed records only its last collection window)`.
- The archive path is unchanged.
- Δ: in FEED.
- Test: *F6 / owner device 2*. Original prints a percentage.

**OD3. The fixed `▾ HIDE LAYERS` button covers the caption.**
- Fix: in `ins()`, `main.group.style.paddingBottom='64px'` is set before append.
- 64 px clears the button's footprint: `bottom:12px` plus `min-height:44px` from `202610261949-sld-sandbox-v9-8.js` L2533–2535, plus margin.
- It is inline style on the lightning-owned main group only. No selector, `<style>` element, original node, curtain group or Grid footer row is touched.
- Δ: +38.
- Test: *Owner device 3*. It asserts the main group has `paddingBottom` and the host, the original `.key-group`, the curtain group and the menu row do not.
- The visual clearance itself on an iPhone is **NOT_TESTED** (no browser run in this lane).

**ChatGPT findings:**

**H01 / F3 / review #6. The feed is not revalidated on OFF→ON or on the 10-minute refresh.**
- Fix: `ld(refresh)` now clears `S.ip=S.fp=null`, and `so(true)` calls `ld(true)`. Every ON and every timer tick re-requests both `index.json` and the feed.
- Δ: +9.
- Tests: *H01* (OFF→ON makes the second XHR and shows the new data) and *H01/F3* (two ticks give 3 feed requests). The original stays at 1 request in both.

**H02 / F4. Feed mode is never STALE.**
- Fix: `cf()` computes `stale(r.idx||{gen:Date.parse((r.meta||0).query_end_utc)},now)`. This applies the archive's 4-hour rule to the feed's `query_end_utc`, which is the time the refresh line shows.
- A fail result has no `meta` and is not flagged.
- An **undated feed is not flagged STALE**. Its refresh line reads `unknown` instead; I chose this to save 20 B.
- Δ: +34.
- Test: *H02/F4*, a 6-hour-old feed. It asserts `S.last.stale`, `STALE` in the label and `STALE` in the status.

**H03 / review #10. No bounds or finite check on coordinates.**
- Fix: `bx=(x,y)=>x===+x&&y===+y&&x>=-11&&x<=3&&y>=49.5&&y<=61.5`, called in `ok()` as `bx(...[].concat(f.geometry.coordinates))`.
- `x===+x` rejects null, strings, NaN and arrays. The range rejects ±Infinity and out-of-box points. `[].concat` makes non-arrays such as `null`, `5` or `'1,52'` safe without throwing.
- The edges are inclusive and match the footer box.
- Δ: +113 in B, +99 in A (no comment).
- Test: *H03*, 12 malformed shapes plus an end-to-end feed in which only the in-box point is drawn.
- Not done: counting the quarantined records in the caption (byte-budget "H03+", +91 B).

**H04 / review D08. Shard count, bytes and sha256 are not cross-checked against the index.**
- `tg()` now passes the index row or part itself (`[row]`, `{...p,sealed}`), so `sha256` reaches `sh()`.
- `gj(u,cache,raw)` returns `r.arrayBuffer()`. `sh()` parses with `new Response(b).json()` after the shape check, then compares three values:
  - `o.features.length` against `t.count`;
  - `b.byteLength` against `t.bytes`;
  - the SHA-256 hex of the bytes (`crypto.subtle`) against `t.sha256`.
- Any mismatch gives `index mismatch: count, bytes, sha256`. The day is listed among failed files, the state is FAIL, and the promise is dropped from the LRU.
- Δ: +332 in B, +304 in A.
- Tests: *H04*. A matching shard loads; a wrong count, wrong bytes or wrong sha256 is each rejected (fresh boot per case, because `sh()` caches by URL).
- Two caveats, stated plainly:
  - (a) `crypto.subtle` exists only in secure contexts. On GitHub Pages (https) sha256 is verified. On a plain-http dev server only count and bytes are checked.
  - (b) `gj` has a `raw&&r.arrayBuffer?…:r.json()` fallback. It exists **only** so that a response object without `arrayBuffer` (ChatGPT's mock) reaches the count check. On that path `b.byteLength` is undefined, so the shard is **always rejected** ("bytes"). The fallback can never accept an unverified shard.
- Fixture check (`out/fixture-check.txt`):
  - all 5 shards of the `lightning-archive` fixture pass;
  - all 5 of `-stale` pass;
  - `-missing-shard` gives 4 pass and the expected 404;
  - **`-big-count` 2026-10-23 is now rejected** (`index mismatch: count, bytes`). That fixture's index declares synthetic counts its shard does not contain, so it must be regenerated with real shards before anyone reuses it as LOAD POINTS evidence.

**H05. A sub-day caption calls whole-day index counts "in window".**
- Fix: the budget-skip caption reads `Flashes N archived on the overlapping UTC dates (index, whole days) · …`.
- The other "archived in window" phrase counts drawn, in-window features, so it was left alone.
- Δ: +31.
- Test: *H05*.

**overlay-code-review:**

**F2 / review #1. CUSTOM clicked during the first load throws and paints a stale result.**
- Fix: `sp()` no longer calls `pt(false)` with `S.res===null`. CUSTOM now prefills today's UTC date, if no dates are set, and calls `ld()`. That bumps the serial, so the in-flight 24h result is discarded.
- Δ: −18.
- Test: *F2*. The original's click handler throws `TypeError … 'colour'` and the 24h result is then painted.

**F2 also fixes owner pack R04/R05, "the CUSTOM caption stays stale until APPLY".**
- CUSTOM now loads and captions the custom window immediately.
- Test: *R04*. After 3M then CUSTOM, the window line no longer says "3 months" and the label reads `| custom`.

**F1 / review #2. Unvalidated timestamps wedge the UI.**
- Fix: `T()` returns `'unknown'` when `!isFinite(t)`. `Ts()` inherits this.
- With F1 in place, the feed's `P()` no longer needs its own presence test (`P=(k,f=T)=>f(Date.parse(m[k]))`). That saving is booked in FEED.
- Δ: +22.
- Test: *F1*, using `query_end_utc:'garbage'` and `latest_detection_utc:'nope'`.
  - Original: `RangeError: Invalid time value` escapes, and the label is stuck at `[LOAD]`.
  - Fixed: the label leaves LOAD, a later 7D click loads, and the refresh line reads `Refresh live feed unknown`.

**F5 / review #5. PREV is enabled past the feed range in feed mode.**
- Fix: `prev.disabled=loading||cu||!S.idx||!w||w.s<=S.idx.cutoff`. With no index, PREV is disabled, which matches the reference client.
- Before the first result `w` is null, so the old `now-7*DAY` fallback and `feedOnly` were unreachable and were removed.
- Δ: −40.
- Test: *F5*.

**F9 / review #8. `bytes:null` is counted as 0.**
- Fix: `t.bytes>0?t.bytes:(t.count||0)*530`.
- Δ: −1.
- Test: *F9*. One day of 30 MB plus a `bytes:null` day of 5,000 flashes must exceed 32 MB and ask before loading. The original loads without asking.

**Owner decisions pack:**

**R02. Module line 11 wording.**
- Fix: `NA` becomes `e=>/HTTP 404/.test(e)?'archive not yet published':'archive unavailable'`.
  - A v1 index, an invalid index, a timeout or a network error reads `archive unavailable: <reason>`.
  - A 404 keeps `archive not yet published`, which is today's production state and the owner's requested chip wording.
- Δ: +45.
- Test: *R02*, a v1 index. The original says "archive not yet published: unsupported index schema …v1".

**LP. LOAD POINTS overshoots its promised newest 40,000 and ignores 32 MB after consent.**
- Fix: the consent walk keeps newest whole days while both `run+count ≤ 40,000` and `bytes ≤ 32 MB` hold. The first day that would break either budget ends the walk (contiguity is kept via `r.sk.length`). Row `bytes:null` is estimated at 530 B per flash.
- Captions now read `(budget 40,000 flashes / 32 MB; …)` and `LOAD POINTS draws up to the newest 40,000`.
- Δ: +144 (**B only**).
- Test: *LP*. Three 30,000-flash days: the original loads 60,000, the fix loads 30,000. Three 20 MB days: the original loads 3, the fix loads 1.
- Residual, disclosed: the **newest day always loads, even if it alone exceeds a budget**. Loading nothing would give a detail result with no points, and `cf()` would then report `EMPTY-COVERED` / "NO FLASHES DETECTED · SEARCHED 100%", which is a false zero. Splitting at part level would cost more bytes. The caption still reports the true downloaded count.

## 4. ChatGPT suite (PR #33)

- **Copied to:** `chatgpt-lightning-regression.test.mjs`.
- **Change:** one line only, line 11, the path line: `const path=process.env.LIGHTNING_MODULE||('atlas/modules/'+gen+'-uk-lightning-overlay.js');`. The diff is in `out/chatgpt-suite-change.diff`.
- **Unchanged:** the seam line, the mocks and every expectation.
- **Results:**
  - original: 1 pass, 5 fail (same as `run-20261026.log`);
  - A: 6 / 6;
  - B: 6 / 6.
- **H04 caveat:** this suite's H04 passes through the fallback described in §3 H04(b), and is rejected with "count, bytes".

## 5. What I do not know / not tested

- No browser run. This lane tested only under `node:vm` plus `minidom`, so the following are **NOT_TESTED** here:
  - layout and the 64 px clearance;
  - hit targets and real gestures;
  - WebKit (BLOCKED_HARNESS);
  - the real raw.githubusercontent.com CORS/cache behaviour (BLOCKED_DEPENDENCY);
  - `crypto.subtle` on iOS Safari.
- The lead's Playwright parity, regression and negative-matrix runners should be re-run on whichever variant is chosen.
- `minidom` parses only the overlay's own markup, so a selector or markup change that real browsers treat differently would not be caught.
- These residual review items are unchanged: #7 (future From), #11 (install poll never gives up), #12 (`aria-pressed`), #15 (month NEXT), #16 (loading caption), #17 (index resolution order), #18 (invalid feed cached until the next refresh, now at most 10 minutes), #20 (cap at paint time).
- The LRU keeps a sealed shard across index refreshes even if its sha256 changed in the index. H04 checks only at fetch time.
- Behaviour change to flag for reviewers: in feed fallback, the long chips now draw the feed's last-7-day points under a 30D–12M label. The warning line states that earlier coverage is unknown. This is my reading of the owner's "respond … instead of looking dead". The alternative, an empty `UNKNOWN` result, would cost more bytes and draw nothing.
