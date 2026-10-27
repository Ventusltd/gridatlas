# time-E lane: time boundaries on generation 202610270024 (variant E), node:vm only

**Target:** `wt/atlas/modules/202610270024-uk-lightning-overlay.js`, 24,780 B, sha256 2976cae7…f890bf. It is byte-identical to `opus-fix-designer/fixed-module-E.js` apart from the generation stamp (10 bytes).

**Harness:** node:vm with minidom, a controlled `Date`, and process TZ set to Europe/London, UTC, America/New_York and Asia/Kolkata. Fixtures are SYNTHETIC (not EUMETSAT). No Chromium was started.

**Harness change:** E calls the bare globals `addEventListener` and `innerHeight` (lines 181 and 174), so I added both to the copied sandbox. Without them, install throws on every case. That was a harness gap, not a module defect.

**Data limits:** EUMETSAT, real browsers and real devices remain BLOCKED_DEPENDENCY / BLOCKED_HARNESS as in HARDENING-BRIEF.md.

## Results (identical in all 4 TZs)
Status shows base E first, then E with the NEXT fix (`fix/next-stack.js`).

| ID | status (base E → with NEXT fix) | evidence path | command |
|---|---|---|---|
| T01–T07, T09, T10 | PASS → PASS | evidence/time-E/runs/base/*.log | `sh evidence/time-E/run.sh` |
| T08 3M/12M PREV→NEXT | PASS → PASS (was FAIL on 2323) | same | same |
| T11 feed with no query_end_utc → STALE | PASS → PASS (was FAIL) | same | same |
| T12 "Xh Ymin" arithmetic | FAIL on the searched-% sub-assert only → see T12a | same | same |
| T12a (T12 with the searched % floored, per T14) | PASS → PASS | same | same |
| T13 zone-less time_utc | PASS → PASS (was FAIL) | same | same |
| T14 40-min tail not 100%/READY | PASS → PASS (was FAIL) | same | same |
| T15 CUSTOM at 00:00:00.000 | PASS → PASS (was FAIL) | same | same |
| E01 UK clock change 25 Oct 01:00 UTC | PASS → PASS | same | same |
| E02 31 Dec→1 Jan, month ends | **FAIL** → PASS | same | same |
| E03 leap day 2028-02-29 | **FAIL** → PASS | same | same |
| E04 23:59:59.999 / 00:00:00.000 | PASS → PASS | same | same |
| E05 4 h stale at exactly 4 h (ms) | PASS → PASS | same | same |
| E06 "<1 min" wording | PASS, except the future-dated-index sub-case: OWNER_DECISION | same | same |
| Regression: opus-fix-designer test-fixes.mjs (copied) | 49/49 on orig, on next-stack and on next-stack+future | evidence/time-E/regress/*.tap | `MODULE=fix/<v>.js node --test regress/test-fixes.mjs` |

Per-TZ totals: base E 18 PASS / 4 FAIL (T12, E02, E03, E06). With the NEXT fix: 20 PASS / 2 FAIL (T12 is superseded by T12a; E06 is the OWNER_DECISION). Runs for the fixed copies are in runs/next-stack/ and runs/next-stack+future/.

## FAIL F1: calendar-month NEXT loses days at month ends and leap day (line 163)
`else if(which==='next'){const e=w.mo<0?mm(w.e,w.mo):w.e+w.span;S.end=e>=now-9e5?null:e}`

`mm` clamps the day to the end of the shorter month, so the inverse step does not recover the original end:
- **3M at 2026-05-31 12:00:** PREV gives [2025-11-28, 2026-02-28). NEXT then gives [2026-02-28, **2026-05-28**), which is not the latest window. It drops 3 days and is not marked latest.
- **6M at 2026-08-31:** NEXT returns a window ending 2026-08-28.
- **3M at 2026-03-31:** PREV, PREV, NEXT returns a window ending 2025-12-30 instead of 12-31. The drift accumulates with each page.
- **12M at 2028-02-29 12:00:** PREV then NEXT ends at 2028-02-28. The leap day is dropped.
- Fixed-length periods (12H to 30D) and T08's dates are unaffected.

**Minimal fix (`fix/next-stack.diff`):** keep a back-stack of ends.
1. Add `h:[],` to the `S` initialiser.
2. Change PREV to `S.h.push(S.end),S.end=w.s`.
3. Change NEXT to `S.end=S.h.pop()||null`.

NEXT now returns exactly the previous page, with `null` meaning latest.

**Byte cost: −22 B** (24,780 → 24,758). The proof's ≤24,781 check holds and no proof needle references this code. The lead must regenerate the cartridge, proof hashes and manifest.

Leftover stack entries are harmless:
- `S.end!==null` always implies a prior push.
- Toggle and LATEST reset only `S.end`, and the next PREV pushes `null`.

## OWNER_DECISION O1: future-dated index (device clock behind) reads "<1 min ago" and is never STALE (lines 18 and 46)
**Observed:** with `generated_utc` 2 h in the future, the line reads `Refresh archive 2026-10-27 01:40 UTC (<1 min ago; expected every 3 h)` and is not STALE.

**Option:** `stale=(x,now)=>!(now-x.gen<=4*HOUR&&x.gen<=now+9e5)||now>x.nextDue`. **Cost: +16 B** (24,774 B together with F1). It flags STALE but the text still says "<1 min ago". Changing the wording as well costs more bytes. No spec covers this case.

## Test amendment: T12's searched-% sub-assert expects Math.round, but E uses Math.floor (line 115)
Rounding would show 100% with 20 s or 1 min still unknown, which T14 forbids. E's floor is correct. T12a is T12 verbatim with the % floored, and it passes. This is not a module defect.

## INFO
- With `collection_interval_hours=2` and no `next_update_due_utc`, the derived due time is gen+3 h. The index is STALE at 3h 0min while the line says "expected every 2 h". The 4 h threshold only coincides with the derived due time when the interval is 3 h.
- Ages and percentages are shown to the minute. So 4h+1 ms reads "4h 0min ago · STALE", while exactly 4 h reads "4h 0min ago" with no STALE marker. This is cosmetic.
- Within one session, CUSTOM From/To stay on the previous day after midnight UTC (by design, line 159). A fresh page uses the new UTC date in all 4 TZs (E02, E03).

## What the new cases verified (PASS in all TZs)
- **E01:** 12H and 24H windows at 00:59:59.999, 01:00:00.000, 01:00:00.001 and 02:00 UTC on 25 Oct have exact [start,end) bounds and counts. 48H over the change has 96 flashes. CUSTOM day-so-far is 47. Refresh age across the change reads 2h 0min and 4h 0min (not 3 h or 5 h of wall-clock time). 7D PREV/NEXT across the change works.
- **E02:** 24H windows and the CUSTOM default/max at 2026-12-31 23:59:59.999 and 2027-01-01 00:00:00.000 are correct. CUSTOM 31 Dec–1 Jan has 96 flashes. 30D PREV across the Oct/Nov boundary works. 3M/6M/12M start clamps are correct (02-28, 12-31).
- **E03:** 24H and CUSTOM at 29 Feb 2028 23:59:59.999 and 1 Mar 00:00:00.000 are correct. 7D across the leap day has 336 flashes. 3M from 2028-05-31 starts on 02-29. 12M from 2029-02-28 starts on 2028-02-28.
- **E04:** start 00:00:00.000 is included, 23:59:59.999 is included, and the end instant is excluded. The zone-less `…23:59:59.999` time is read as UTC in every TZ. The "Actual" line truncates to seconds and keeps the UTC suffix.
- **E05:** index and feed are not STALE at exactly 4 h, and are STALE at 4h+1 ms. The `next_update_due` boundary behaves the same way. The 4 h cap wins over a later due time.
- **E06:** refresh age reads "<1 min" for 0, 1 ms and 29.999 s, and "0h 1min" for 30 s to 89.999 s. The tail line reads "Not yet ingested: last <1 min of window (unknown, not zero)" with searched ≤99% and state PARTIAL.
