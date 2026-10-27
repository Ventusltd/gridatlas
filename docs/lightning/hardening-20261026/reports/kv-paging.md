# kv-paging: PREV / NEXT / LATEST / CUSTOM on Build I against the real archive

**Lane:** kv-paging, run in Node only (node:vm with minidom). No browser was started, and no protected tree was edited.
**Target:** `wt/atlas/modules/202610270929-uk-lightning-overlay.js` (33,623 B, the same bytes as `fixed-module-I.202610270929.js`).
**Data:** the real archive served from `/home/claude/lightning` git objects.
- `2a49652` (index 10:43Z): this is what the owner saw at 13:45. It has **29 searched days, 29 Sep to 27 Oct, 1,480 flashes**, and 337 days with `coverage:none`.
- `d32e6b6` (15:24Z, 1,507 flashes): a cross-check at 00:05.

**Clocks:** 2026-10-27T13:45Z and 2026-10-28T00:05Z. The device was a phone (cap 10,000), with the map view at `-6,50,2,56`.
**Evidence:** `hardening/evidence/kv-paging/`, which holds `paging.mjs` (the harness), `run-*.json` and `sum-*.txt` (Build I), `patch.mjs`, `patched-I.js`, `kv-paging.diff`, and `p-*.json` and `psum-*.txt` (patched).

## Method
For each of the 8 periods the harness ran LATEST, then PREV 1–3 times, then NEXT 1–3 times, then PREV, PREV, LATEST. It also covered a cross-period sequence (30D PREV, PREV, then the 7D chip, then NEXT) and 7 CUSTOM ranges. On every page it recorded:
- the window, label, status, the four caption lines, and whether each nav button was enabled
- `r.out`, the off-view count
- FIT FLASHES: whether it is hidden, the box it requests from `fitBounds`, and the off-view count after a simulated `moveend` inside that box.

Ground truth comes from `truth(s,e)` in `paging.mjs`. It reads each day shard straight from git and counts features with `time_utc` in [s,e). It also records how many of the dates are searched or never searched, and whether `e ≤ coverage_start` (29 Sep).

## What is correct
- **Counts are exact on every page at both clocks (more than 120 pages).** The number drawn equals the shard ground truth, e.g. 12H 29, 24H PREV3 196, 48H PREV1 283, 7D 444/183/183/665, and 30D–12M 1,480 (1,507 on `d32e6b6`). No day file failed and the SHA-256 checks passed.
- **Windows are end-anchored and step exactly one span.** NEXT is the exact inverse of PREV within a period, and LATEST returns to `now`. Month periods use calendar months (3M 27 Jul → 27 Oct). CUSTOM uses [from 00:00, to+1 day) clamped to `now`, and the window line reads "inclusive" correctly.
- **FIT FLASHES** shows exactly when a page has at least one drawn flash and is hidden otherwise. It frames every flash: after the move, the off-view count is 0 on every page. A single flash (48H PREV3, −3.918, 49.515) gives a degenerate box, which `maxZoom:9` handles.
- **The off-view count** ("N of M outside the current view") matches the view on every page and is recomputed on `moveend`. It appears only in the caption, never in the label or status.
- The STALE flag is correct at 13:45, because `now` is after `next_update_due` (13:43:35).

## Defects
Line numbers refer to the Build I module. Byte costs come from `patch.mjs`, and the total is **+419 B** (33,623 → 34,042, inside the 44,781 B budget).

| # | Sev | Where | Defect (observed) | Minimal fix | B |
|---|---|---|---|---|---|
| K1 | **High** | l.78, l.102, l.110, l.123 | Pages entirely before 29 Sep show **"0"**: "Flashes 0 archived in window (unknown, not zero)", "Actual no archived flashes within this window", label `[UNKNOWN \| 30d]`. The words "not yet searched" appear nowhere. This happens on 30D PREV1–3, 3M PREV1–3, 6M PREV1, 12M PREV1, CUSTOM 01–28 Sep and CUSTOM 2025-10-27..11-10. The cause: `before` is only set when `w.e<=x.cutoff` (2025-10-27), not when `w.e` is before the archive start (29 Sep). | l.78 `w.e<=x.cutoff` → `w.e<=x.covStart`. l.102: also set `L.flashes='Flashes not yet searched (unknown, not zero)'` and use the warning "Archive begins … this window was never searched". l.123: when `c.f<=0`, set `L.flashes` to the same text and `L.actual=''`. | 123 |
| K2 | **High** | l.182, l.184 | The label and status for a 0%-searched page say `UNKNOWN`, and `BEFORE-ARCHIVE` comes out as a raw state string. At **00:05 the 12H LATEST page** (27 Oct 12:05 → 28 Oct 00:05; last scan 10:20) reads "Flashes 0 archived". | l.182 `/UNKNOWN\|BEFORE/` → `'NOT YET SEARCHED'` (keep `UNKNOWN` for feed mode). l.184 final fallback `st` → `r.mode==='feed'?st:'NOT YET SEARCHED'`. | 99* |
| K3 | **High** (owner complaint 1) | l.182 | The label is `[≥1,480 \| 30d]`, which is identical for 30D, 3M, 6M and 12M. "≥" hides the fact that 1,480 is exact for 88%, 28%, 14% and 7% of each window. | Replace `(PARTIAL?'≥':'')+N(n)` with ``N(n)+(PARTIAL&&r.cov?` in ${floor(f*100)}% searched`:n?'':' · searched 100%')``. The labels become `[1,480 in 88% searched \| 30d]`, `… 7% … \| 12m]`, `[0 · searched 100% \| 12h]`. | in K2* |
| K4 | **High** | l.196, l.201 | Changing period keeps `S.end` and the old `S.h`. 30D PREV, PREV, then the 7D chip lands on **21–28 Aug**, not on the latest 7D. NEXT then pops a 30D boundary and jumps to **20–27 Sep**, skipping 23 days. LATEST never clears `S.h`: after the period loops, 16 stale entries had built up. | l.196 `sp`: add `S.end=null;S.h=[];`. l.201 LATEST: add `S.h=[];`. | 25 |
| K5 | Med | l.123, l.182 | A searched day with 0 flashes reads as unknown. CUSTOM 2026-10-12 (99% searched, count 0, the index says `partial`) shows label `[UNKNOWN]` and "0 archived (unknown, not zero)", while the status says "SEARCHED 99%". The two contradict each other. | l.123: when `0<c.f<1`, show ``Flashes 0 in the ${pct}% searched; rest unknown``. The label comes from K3. | in K1 |
| K6 | Med | l.120 | A PARTIAL page with gaps inside it has an **empty warning line**, and the "a → b" text suggests continuous coverage. Examples: 24H PREV3 51%, 48H PREV1 66%, 48H PREV3 52%, 7D PREV1 91%, CUSTOM 10-12 99%. | After the `c.u` push: ``if(c.f<1&&!warn.length)warn.push(`Unknown: ${100-floor(f*100)}% of window lies between collection runs (not zero)`)``. | 123 |
| K7 | Med | l.199 | CUSTOM does not check that To ≤ today (iOS ignores `max` when a date is typed). At 13:45, the range 28 Oct..28 Oct gives an **inverted window**, "2026-10-28 00:00 → 2026-10-27 13:45", with 0 dates and a blank warning. | Add `&&t<=ymd(now)` to `good`. | 13 |
| K8 | Low | l.51, l.53 | "N successful runs" adds up the runs of the *whole* scan windows that overlap the page. Every 12H and 24H page near 25–27 Oct says "9 runs", which is the total for the 25 Oct 01:43 → 27 Oct 10:20 window. | l.51 `r+=w.n` → `r+=w.n*o/(w.e-w.s)`. l.53 `r` → `r:Math.ceil(r)`. 12H then reads 2 runs. | 25 |
| K9 | Low | l.192 | PREV is still enabled at 12M LATEST (and at 6M PREV1, 3M PREV3) because `w.s` (13:45) is after `cutoff` (00:00). The next page is a 13h45 stub, "2025-10-27 00:00 → 13:45 … start clamped" (24h05 at 00:05). | `w.s<=S.idx.cutoff` → `w.s<S.idx.cutoff+DAY`. | 3 |
| K10 | Low | l.117 | "0% of window — no collection run covers **these dates**" is wrong for 12H at 00:05, because 27 Oct does have runs. | "…covers this window". | 0 |

\*K2 and K3 share one edit: l.182 costs +64 B and l.184 costs +35 B.

All of these fixes are applied in `evidence/kv-paging/patched-I.js` (`kv-paging.diff`), and the full matrix was re-run on it (`psum-1345.txt`, `psum-0005.txt`):
- Every pre-29-Sep page now reads `[NOT YET SEARCHED | …]` with "Flashes not yet searched (unknown, not zero)". No "0" and no "EMPTY" appear.
- Counts are unchanged and still exact.
- Cross-period: the 7D chip lands on LATEST 20–27 Oct.
- The future CUSTOM range is refused.
- 10-12 reads "0 in the 99% searched; rest unknown".

**Existing suite** (`test-fixes.mjs`): Build I gives 90 pass / 1 fail. The failure is F2, which is flaky in the full run but passes 3 out of 3 times on its own. Patched gives 90 pass / 1 fail. The failing test is **F1 at `test-fixes.mjs:634`**, which asserts the old wording `/^Flashes 0 archived.*\(unknown, not zero\)/`, the exact wording K1 removes. Update that assertion to `/^Flashes not yet searched/`.

## Notes
- **The "same map for 30D/3M/12M" is correct data.** Those windows contain exactly the same 1,480 flashes, because no day before 29 Sep has been searched. The defect is the wording (K3), not the selection.
- The off-view count is caption-only. On the phone view, 993 of 1,480 flashes (Ireland and the North Sea) are off screen while the label shows 1,480. A label suffix such as ` · 993 off view` would cost about 30 B; this is optional and not applied.
- At 00:05 with the stale index, 28 Oct has no index row. It is counted correctly as "1 of N UTC dates have no collection run", and the tail as "Not yet ingested".
