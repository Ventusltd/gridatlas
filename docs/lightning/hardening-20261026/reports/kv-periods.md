# kv-periods: what each period window really holds, and how Build I shows it

Node only. Evidence is in `hardening/evidence/kv-periods/`. The archive is lightning **2a49652**, the last commit before 13:45Z (index generated 10:43:35Z). Current main d32e6b6 is in `truth-now.json`.

## 1. Ground truth at 13:45Z (`truth.mjs` → `truth-1345.json`)

| Period | Window start | Flashes | Searched h / window h | Searched dates | PREV page: flashes, searched h |
|---|---|---|---|---|---|
| 12H | 27 Oct 01:45 | 29 | 8.6 / 12 | 1 of 1 | 0, 12 / 12 |
| 24H | 26 Oct 13:45 | 29 | 20.6 / 24 | 2 of 2 | 0, 24 / 24 |
| 48H | 25 Oct 13:45 | 29 | 44.6 / 48 | 3 of 3 | 283, 31.8 / 48 |
| 7D | 20 Oct 13:45 | 444 | 130.3 / 168 | 8 of 8 | 183, 153.8 / 168 |
| 30D | 27 Sep 13:45 | 1,480 | 633.9 / 720 | 29 of 31 | 0, 0 / 720 |
| 3M | 27 Jul 13:45 | 1,480 | 633.9 / 2,208 | 29 of 93 | 0, 0 |
| 6M | 27 Apr 13:45 | 1,480 | 633.9 / 4,392 | 29 of 184 | 0, 0 |
| 12M | 27 Oct 2025 13:45 | 1,480 | 633.9 / 8,760 | 29 of 366 | clamped to 13 h 45 min, 0 searched |

- Searched dates: 29 Sep – 27 Oct, 20 in full and 9 partly (20 Oct only 1.3 h).
- Every current window has a **3 h 25 min** unsearched tail (frontier 10:20:09).
- **Why 48H = 29:** all fall on 27 Oct 01:56–08:44. 26 Oct was fully searched with none; 25 Oct's 10 came before 13:19, outside the window.
- The brief's example "61 of 90 days" is wrong. 3M is a 92-day window touching 93 dates, and **64** of them have never been searched.

## 2. Build I against the same archive (frozen clock, iPhone cap; `trace-build-I.json`)

**All 16 drawn counts equal the ground truth** (`KV-guard`). The wording misleads, not the numbers.

Mechanism, line by line in `wt/atlas/modules/202610270929-uk-lightning-overlay.js`:
- **L85** checks the budget, which puts every page in detail mode.
- **L70 `co`** keeps only flashes with `t>=ws&&t<we`. So 3M and 12M draw only in-window flashes; the maps match because nothing exists before 29 Sep.
- **L50–53 `cv` and L93–95**: any gap in the union of scan windows means PARTIAL.
- **L182** builds the label `[(PARTIAL?'≥':'')+N | period+' STALE']`.
- **L184** builds the status `PARTIAL · n · SEARCHED floor(f·100)%`. "N ARCHIVED" appears only in overview mode (L183).

## 3. Discrepancies
1. **"≥" (L182) means "lower bound" and is unreadable.** "≥1,480 | 12m" appears while 93% of the year is unsearched. A PARTIAL page with 0 flashes shows "UNKNOWN" and drops the searched hours.
2. **48H "≥29" is exact for the 44.6 searched hours.** The "≥" comes only from the 3.4 h tail, and nothing says so. The whole-day index sum would be 39.
3. **Overview mode puts whole-day sums under sub-day labels** (L113, L182). It would show "≥39 | 48h" (true 29) and "≥342" on 7D PREV (true 183).
4. **Day counts mix dates with window length.** L120 says "2 of 31 dates" for 30D. A date searched for 1.3 h counts as searched, and hours are never shown.
5. **The same dates are warned about twice:** L119 "precede archive start" and L120 "no collection run". "Precede archive start" is also wrong for dates the backfill has not reached.
6. **The Searched line (L117) is jargon.** It reports "43 successful runs" and a hull range that hides the gaps on 20, 23 and 24 Oct.
7. **STALE trigger (L47):** `!(now−gen≤4h && gen≤now+15min) || now>nextDue`.
   - The inputs are index `generated_utc` and `next_update_due_utc` (generated + 3 h). Feed mode uses `query_end_utc`. status.json is never read (its stale threshold is 12 h).
   - It was correct at 13:45:00, 85 s past the 13:43:35 due time.
   - **Backfill hides it.** 9c52dff (07:01) and 88f115b (10:26) refreshed `generated_utc` while the frontier stayed at 02:30. So it showed fresh from 07:01 to 10:01 with data 4.5–7.5 h old.
8. **STALE is printed on past PREV pages** (L96): "[EMPTY | 24h STALE]".
9. **"Refresh archive 10:43" (L115) is the time the index was written**, not the collector run or the frontier.
10. **PREV stops at `cutoff` (L192).** 30D, 3M and 6M PREV open pages that are 0% searched. 12M PREV opens 13 h 45 min labelled "12 months".

## 4. Display rules for a non-specialist

- **R1 Label:** `count · searched part | period [| STALE]`. Never use "≥".
  - Windows of 7 days or less use hours: `[29 · 44.6 of 48 h searched | 48h | STALE]`.
  - Longer windows use dates: `[1,480 · 29 of 93 days searched | 3m | STALE]`.
  - When nothing was searched: `[not searched | 3m]`.
  - Summary mode adds `on N dates`.
- **R2 Flashes line:**
  - Long windows: "Flashes 1,480 in 29 searched days (29 Sep – 27 Oct; 9 only partly); 64 of 93 days not yet searched (unknown, not zero)".
  - Short windows: "Flashes 29 in 44.6 searched hours; 3.4 of 48 h not yet searched (unknown, not zero)".
- **R3 STALE:** "STALE: collector last searched up to 2026-10-27 10:20 UTC (3h 25min ago); next update was due by 2026-10-27 13:43 UTC".
  - Measure age from the frontier (`lastScan`). Show STALE on the latest window only.
- **R4 Searched:** "Searched EUMETSAT 7% of window = 634 of 8,760 h · earliest … · latest …". No run counts.
- **R5:** Warn about each unknown span once. **R6:** PREV stops at the first searched date and never opens a clamped page.

## 5. Minimal changes (`patch-kv.mjs` → `fixed-module-kv.js`, sha256 09ecfcc4…)

| # | Build I line | Change | Bytes |
|---|---|---|---|
| K1 | 47 | `now-(x.lastScan??x.gen)` in `stale` | +14 |
| K2 | 96 | `&&r.w.atLatest&&` before `stale(` | +14 |
| K3 | 111 | `N(n)+' archived in window'` → `fx(r)` | −21 |
| K4 | 115 | Refresh line becomes the STALE sentence (R3); a future-dated index still reads "? ago" | +85 |
| K5 | 117 | Searched line in hours, no "successful runs" | +60 |
| K6 | 119 | Add `&&!c.u.length` to the before-archive warning | +13 |
| K7 | before 181 | New helpers `sx` (searched days/hours) and `fx` (flashes sentence) | +774 |
| K8 | 182 | Label body per R1, `' \| STALE'` | +54 |
| K9 | 184 | `SEARCHED x%` → `sx(r).toUpperCase()` | −8 |
| K10 | 192 | `w.s<=S.idx.covStart\|\|w.s-w.span<S.idx.cutoff` | +27 |
| | | **Total: 33,623 → 34,637 B** | **+1,014** (of 44,781 B headroom) |

Patched output for all pages: `trace-fixed-kv.json`.

## 6. Tests (`evidence/kv-periods/test-kv-periods.mjs`, a copy of test-fixes.mjs plus a KV section)

Real archive snapshots, no network: `MODULE=… node --test --test-name-pattern='^KV' test-kv-periods.mjs`

- **KV1–KV11 fail on Build I and pass on the fix** (one per discrepancy; KV5 replays 88f115b at 12:00Z).
- **Full suite:** Build I 92/104, fix 103/104.
  - `REST` fails on both (pre-existing, compares against build F). F6 and F1 assertions were amended for the new copy, marked `// KV`.

## 7. Not changed (recommendation only)

- The stall is in the lightning repo: both workflows share concurrency group `uk-lightning-update`, so hourly runs queue behind backfill and GitHub keeps only one pending run.
- Publish `next_update_due_utc` as frontier + 3 h, not as `generated_utc` + 3 h.
