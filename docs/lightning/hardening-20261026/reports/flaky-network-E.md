# flaky-network-E: transport faults on generation 202610270024 (variant E, v9.162)

Lane flaky-network-E, 27 Oct 2026. NODE ONLY: Chromium was not started.
**Harness:** self-fixture. `wt/atlas/modules/202610270024-uk-lightning-overlay.js` (24,780 B, sha256 2976cae7…90bf, copied byte for byte to `evidence/flaky-network-E/module.js`) runs in node:vm with `minidom.mjs` (copied from opus-fix-designer). The harness stubs `fetch` (index.json, day shards, hourly parts) and `XMLHttpRequest` (uk_lightning.geojson). It uses a virtual clock for Date, setTimeout and clearTimeout, so the 15 s AbortController and XHR timeouts fire on `clock.advance()`. The "next refresh" is the module's own 10-minute `setInterval` callback, invoked after the clock advances 600 s. All data are SYNTHETIC. The viewport is nominally desktop 1440x900, with no layout.
**Fixture:** at T0 = 2026-10-27 06:30 UTC with the 24 h window, the clean baseline is `[7 | 24h]` and `READY · 7 FLASHES DRAWN`. It has 1 sealed day shard (10-26, 3 flashes) and 2 unsealed hourly parts (10-27 01 and 03, 2 flashes each). The feed holds 2 flashes.
**Note on scope:** the module has only one live-feed transport, the XHR to `uk_lightning.geojson`. It runs only as the fallback when the index is unavailable. So "live feed" and "XHR fallback" are the same path here. The `feed` group therefore also takes the index down (HTTP 503).

## Method
There are 68 cases: 5 resource groups × 14 fetch faults (12 for XHR). The `all-day-files` group faults the shard and both parts together, which is the "archive CDN down, index up" case. Each case has four phases:
1. **cold:** first ON with the fault active.
2. **refresh_fault:** next refresh with the fault still active. This records the retry request count.
3. **refresh_clean:** next refresh with the fault cleared. The result must equal the clean baseline.
4. **warm:** clean ON, then the next refresh hits the fault. This is the stale-as-fresh check, with a LOADING snapshot for stalls.

Faults:
- HTTP 500, 503, 403 and 404.
- `stall`: headers never arrive. `stall-body`: headers arrive, then the body stalls.
- `reset` (pre-headers TypeError) and `reset-midbody`.
- `truncated` (first 60 %).
- `html200` (captive-portal page).
- `wrong-ctype` (valid body served as text/html).
- `empty`.
- `redirect-offhost-blocked`: 302 to evil.example without CORS, which the browser reports as a network error.
- `redirect-offhost-cors`: 302 to evil.example with ACAO:*, serving a fabricated, schema-valid payload.

For stalls, the status is sampled at +14,999 ms. It was LOADING in every group, so the timeout fires at 15 s and not before.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| FNE-01 index: 500/503/403/404, stall, stall-body, reset, reset-midbody, truncated, html200, empty, redirect-blocked | PASS | evidence/flaky-network-E/out/cases.json (group index) | `MODULE=module.js node flaky-network-E.node.mjs` |
| FNE-02 index: wrong content-type | PASS (accepted; correct, since raw.githubusercontent serves text/plain) | same | same |
| FNE-03 index: off-host redirect with CORS, fabricated index | OWNER_DECISION (F2) | out/cases.json index/redirect-offhost-cors | same |
| FNE-04 day shard: all 14 faults | PASS | out/cases.json (group shard) | same |
| FNE-05 hourly parts: all 14 faults | PASS for status, retry, stale and throw; caption defect F1 | out/cases.json (group part) | same |
| FNE-06 all day files fail, index up | **FAIL (F1)**: unknown shown as zero in captions | out/cases.json (group all-day-files) | same |
| FNE-07 live feed (XHR fallback): 500/503/403/404, stall, reset, truncated, html200, empty, redirect-blocked | PASS | out/cases.json (group feed) | same |
| FNE-08 live feed: wrong content-type | PASS | same | same |
| FNE-09 live feed: off-host redirect with CORS, fabricated feed | OWNER_DECISION (F2) | out/cases.json feed/redirect-offhost-cors | same |
| FNE-10 next refresh retries the faulted resource | PASS 68/68 | out/summary.tsv (retry reqs ≥ 1; 0 for shard/wrong-ctype because it was served from the verified sealed LRU) | same |
| FNE-11 recovers once the fault clears | PASS 68/68 | out/summary.json `recovered` | same |
| FNE-12 stale data never presented as fresh | PASS (see note N1) | out/summary.json `stale_as_fresh`, `during` | same |
| FNE-13 unknown never shown as zero | FAIL in 13 all-day-files cases (F1); fabricated zero in index/redirect-cors (F2) | out/summary.json `zero_hits` | same |
| FNE-14 nothing throws uncaught | PASS: 0 listener errors, 0 unhandledRejection, 0 uncaughtException | out/cases.json `dispatch_errors`, `unhandled`, `uncaught` | same |
| FNE-15 fixes F1+F2 verified | PASS: 68/68 with 0 anomalies; existing test-fixes 49/49 | fix/out-F1F2/, fix/test-fixes-regression.txt, fix/bytes.txt | `MODULE=fix/module-F1F2.js node flaky-network-E.node.mjs --out fix/out-F1F2` |
| FNE-16 real browser CORS/redirect semantics, real TCP resets, WebKit | BLOCKED_HARNESS (node-only lane; the redirect and reset semantics are modelled on the Fetch/XHR specs) | | |

### What each fault shows (cold phase)

**Index fault (any transport error).** The module falls back to the feed honestly.
- Label: `[≥2 | 24h]`.
- Status: `PARTIAL · 2 seen in the available 7-day feed · 24 hours requested · searched unknown`.
- Refresh caption: `… archive unavailable: HTTP 503 …`. For a 404 it reads `archive not yet published: HTTP 404`. Stalls read `timeout after 15 s`.
- Searched caption: `Searched EUMETSAT unknown …`.

**Shard or part fault.**
- Label: `[FAIL]`.
- Status: `FAIL · 1 of 3 day files failed` (or `2 of 3` for parts).
- Warning: `… (2026-10-26 HTTP 503); points incomplete, counts from index`.
- The successful files' points are drawn, and the failed files' points are not.

**Feed fault (index down).**
- Label: `[FAIL]`.
- Status: `FAIL · HTTP 503`, `FAIL · timeout after 15 s`, `FAIL · network error`, `FAIL · Unexpected token '<' …` or `FAIL · Unexpected end of JSON input`.
- Warning: `Archive unavailable: HTTP 503 at … — nothing shown (unknown, not zero)`.
- Nothing is drawn and the layer is hidden.

## Findings

### F1: FAIL (defect, honesty contract), `cp()` lines 108–109
When every day file in the window fails and the index is up, the label and status correctly read `[FAIL]` / `FAIL · 3 of 3 day files failed`. The captions contradict them:
- `Actual  no archived flashes within this window`
- `Flashes at least 0 archived in window`

The index count of 7 is not shown anywhere. With a partial failure, `Actual  first … · last …` is computed from the incomplete set. For parts failed it reads last 10-26 14:00, while the index says 10-27 03:20.

Reproduce with group `all-day-files`, any fault except wrong-ctype. Expected: unknown, not zero.

Minimal fix (+75 B):
```
L.actual=r.fl.length?'Actual  unknown (day files failed)':first||'Actual  no archived flashes within this window';
… Flashes ${r.fl.length?`${N(r.ic)} in index · ${N(n)} loaded`:N(n)+' archived in window'}
```
The result reads `Actual  unknown (day files failed)` and `Flashes 7 in index · 0 loaded`.

### F2: OWNER_DECISION (defence in depth), `gj` line 27 and `gx` line 29
Neither `r.redirected`/`r.url` nor `x.responseURL` is checked. If an off-host redirect target sends CORS headers, its payload is accepted.

- A fabricated index gave `[EMPTY | 24h]` and `NO FLASHES DETECTED · SEARCHED 100%`.
- A fabricated feed gave `UNKNOWN · 0 seen …`.
- Shards and parts are protected by the sha256/bytes/count check: the fabricated day files were rejected.
- An off-host redirect without CORS behaves like a reset (PASS).

Reaching this needs raw.githubusercontent.com itself, under TLS, to redirect to a CORS host, which makes it an owner trust decision.

Fix (+84 B):
```
if(!r.ok||r.redirected)throw new Error(r.ok?'redirected':'HTTP '+r.status)
try{if(x.responseURL&&x.responseURL!=u)E('redirected');…
```
This also rejects same-host redirects, such as after a repo rename.

### Byte budget
E is 24,780 B against a 24,781 B cap. F1 alone needs +75 B, and F1+F2 = 24,938 B (+158). Either needs a budget raise or an offsetting cut, which is the lead's or owner's call. Full diffs are in `fix/bytes.txt`; the patched module is `fix/module-F1F2.js`, for evidence only (it is not applied to the worktree).

### N1 (note, not a FAIL): the LOADING interval
During a refresh, `pt(true)` sets `[LOAD]` / `LOADING` and the grey dot. The previous points and captions stay visible until the load settles:
- up to 15 s for a stalled shard or feed;
- up to 30 s for a stalled index, because the feed fallback follows the index timeout.

They are never relabelled as fresh. After a failed refresh the old points are removed (shards and parts) or replaced (feed mode). A sealed, sha-verified shard is served from the LRU without a request, which is correct for immutable data.

## Files
- `evidence/flaky-network-E/flaky-network-E.node.mjs`: runner.
- `minidom.mjs`, `module.js`: copies.
- `out/{baseline.json,cases.json,summary.json,summary.tsv}` and `run.log`.
- `fix/{module-F1F2.js,bytes.txt,out-F1F2/,run-F1F2.log,test-fixes.copy.mjs,test-fixes-regression.txt}`.
