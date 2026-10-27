# kv-perf: Build I at 365 days (NODE only)

Target: `202610270929-uk-lightning-overlay.js` (sha256 c797fffc…, 33,623 B), run under node:vm with minidom and a simulated fetch that serves archive dirs from disk. Evidence is in `hardening/evidence/kv-perf/`: `gen/perf.mjs`, `results*.jsonl`, `grid.jsonl`, `case*.json`, `fix.diff` and `module-fix.js`.

## Archives
Every archive was written by lightning **main d32e6b6** `history.archive_observations`, so the rows, hourly parts and sha256 values are real writer output. All are SYNTHETIC except the real one. The storm years use the `stress_storm_year.py` model.

| archive | flashes | files | JSON |
|---|---|---|---|
| real (29 days) | 1,507 | 22 | 0.8 MB |
| real rate tiled to 365 days | 18,900 | 278 | 10.3 MB |
| storm 50k | 50,000 | 87 | 27 MB |
| storm 250k, wide (350 days) | 250,000 | 357 | 134 MB |
| storm 1M (largest day 48,496 in 8 hourly parts) | 1,000,000 | 191 | 537 MB |

The archives run at about 535 B per flash. raw.githubusercontent gzips the shards 19–27× and sends `max-age=300` with an ETag. **The cost is the request count, plus parsing and SHA-256 of uncompressed bytes, not the transfer.**

## Results
Times are from a contended 2-vCPU node and are relative only. "4G" models an 80 ms RTT and 2.5 MB/s across the module's 4 workers, using uncompressed bytes.

| archive, window | device | requests | raw MB | parse / sha ms | drawn | heap | peak RSS | 4G |
|---|---|---|---|---|---|---|---|---|
| real, 12M | phone | 22 | 0.8 | 13 / 37 | 1,507 | 1.8 MB | 80 MB | 0.8 s |
| real rate, 6M | phone, auto | 140 | 5.2 | 33 / 331 | 9,544 | 8 MB | 139 MB | – |
| real rate, 12M | desktop, **auto** | **278** | 10.3 | 66 / 683 | 18,899 | 15 MB | 155 MB | **9.9 s** |
| 50k, 12M | phone, after consent | 67 | 20.2 | 576 / 2,437 | 38,529 clusters | 30 MB | 211 MB | 9.8 s |
| 1M, 12M | phone, after consent | 6 | 18.0 | 338 / 490 | 33,404 clusters | 26 MB | 227 MB | 10.6 s |

The index adds one request per load, at 73–116 kB raw and about 19 kB gzipped.

**Every 10-minute refresh fetches everything again.** The LRU holds only 8 shards (`overlay.js:32`). A 12M refresh therefore made 279 requests at the real rate and 69 for the 50k year. With max-age=300, each refresh means conditional requests followed by parsing and SHA-256 of every body.

## Where the caps bind (`overlay.js:84–86`)
- **BUDGET 40,000 flashes, with `cap()` at 10,000 on a phone and 40,000 on a desktop, is the only cap that binds.** Points auto-load while the index sum is within the device cap.
  - At the observed rate, a year is about 18.9k flashes, so a desktop 12M auto-loads 278 files and a phone 6M auto-loads 140.
  - After consent, a phone holds up to 40k points (4× its cap), drawn as clusters.
- **32 MB never binds:** 40,000 flashes × 537 B is 21.5 MB.
- **RQ 400 never binds first:** a year has at most 366 day files. A day is split into hourly parts only above about 15.6k flashes, and such a day already breaks the budget.

## Is the UI honest?
Mostly. Before consent a stormy 12M shows `[≥1,000,000 | 12m]` with "none drawn (summary mode; … LOAD POINTS draws up to the newest 40,000)". After consent it shows "33,404 downloaded from the newest 3 of 87 days (… 84 days not loaded)". Days that were never searched stay "unknown, not zero". There are three defects:

1. **The headline count shrinks 30× after consent** (`overlay.js:182–183`). The label goes from `[≥1,000,000 | 12m]` to `[≥33,404 | 12m]`. That is the owner's confusion. Fix: `n=r.mode==='overview'||r.sk&&r.sk.length?r.arch:r.ev.length`, and make the status read "33,404 OF 1,000,000 FLASHES CLUSTERED".
2. **A false "newest day alone exceeds it".** Take the phone, 1M archive, 12H window ending 2026-08-11 16:00: its 4 parts hold 31,750 flashes (`caseB-phone.json`). After LOAD POINTS: "newest day alone exceeds it; none drawn", with 0 requests. The consent loop charges the whole day's `y.count` (48,496) and `y.bytes` (`overlay.js:86`). Fix: sum the part counts and bytes from `tg(y,w.s,w.e)`.
3. **A sub-day overview overcounts.** The same window is labelled `[48,496 | 12h] READY` (`overlay.js:81`). Fix: for split rows, sum only the overlapping parts.

The wide year also loads 6,878 flashes from 13 of 350 days. That happens because the 14th day alone holds 50,220. The caption is honest but gives no reason.

**Verified fix** (`fix.diff`, applied to a copy only): defects 1–3 plus LRU 8→32.
- It costs **+171 B** (33,794 B, within the 44,781 B headroom).
- Case 2 now draws 31,750 clusters.
- The 1M 12M status reads "33,404 OF 1,000,000".
- A 30D refresh falls from 24 requests to 2.
- `test-fixes.mjs`: 90 pass, 1 fail, the same on the original and the fix. The one failure, T74 "REST … identical to F", already fails on Build I.

## Recommendation: yes, per-day grid summary for 3M, 6M and 12M
Raw points fail on long windows either way:
- **Quiet year:** the module silently makes 278 requests (about 10 s on 4G) and repeats them every 10 minutes.
- **Stormy year:** the map shows only the newest 3–16 of 87 storm days, a recency sample labelled "12 months".

**Data.** `history.py` writes `data/history/grid-0p25.json` beside the index:
`{"schema":"uk-lightning-grid-day.v1","cell_deg":0.25,"origin":[-11,49.5],"cols":56,"observation":"satellite optical lightning flashes, not ground strikes","days":{"YYYY-MM-DD":[cell,count,…]}}`
It lists searched days with flashes only, so unscanned days stay unknown through the index.

Measured sizes (`grid.jsonl`). The real-rate year is so small after gzip because the tiled data is repetitive.

| year | raw | gzip |
|---|---|---|
| real, 29 days | 3.6 kB | 1.6 kB |
| real rate, 365 days | 44 kB | 3.2 kB |
| 50k | 56 kB | 20 kB |
| wide 250k | 209 kB | 70 kB |
| 1M | 101 kB | 41 kB |

A 0.1° grid is 2–4× larger. A 0.25° grid has at most 2,688 cells, so it needs no clustering.

**Module.** The sketch is `evidence/kv-perf/grid-sketch.js`: 1,196 B, or about 1.8 kB with glue.
- When `w.span>31*DAY` and the viewer has not consented, it fetches the grid once with ETag revalidation.
- It sums each cell over the window, **checking every day's sum against the index `count`**. On any mismatch it falls back to the current summary mode.
- It draws circles with radius proportional to √n. The caption reads "… drawn as M 0.25° cells (daily summary)".
- Tapping a cell shows "n optical flashes in this 0.25° cell on d UTC days". There is no nearest-substation search, because a cell is not a flash.
- LOAD POINTS stays. Windows of 30 days or less keep raw points.

**Cost.** About 1.8 kB of module, about 40 lines of Python, and 3–70 kB gzipped in 1 request. That replaces 6–278 requests and 18–21 MB of JSON parsing.
