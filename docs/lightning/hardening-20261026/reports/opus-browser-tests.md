# opus-browser-tests — browser fail-first suite for the lightning overlay

**Harness:** lead-shim (`../lightning/harness/offline-shim.mjs`). Chromium 153.0.8010.12 headless, Playwright 1.63.0, Node v22.23.4. Phones are Chromium emulation (isMobile, hasTouch), **not WebKit/Safari**.
**Candidate:** generation 202610261949. Module sha256 `3ce0ddc1059f5de0…`, identical to `git show fda6b10:atlas/modules/202610261949-uk-lightning-overlay.js`; the worktree HEAD is 35fbceb, which adds docs only. The worktree was not modified.
**Route:** `http://127.0.0.1:8151/wt/atlas/v/202610261949/`. The server on 8151 was stopped after the run.
**Folder (E):** `evidence/opus-browser-tests/`

## Files
- `E/lightning-hardening.browser.mjs` (sha256 `87eb342d…`) is the suite.
- `E/build_synthetic.py` (sha256 `7bf9f8b9…`) builds `E/fixtures/SYNTHETIC-*`. See `fixtures/README.md` and `MANIFEST.sha256`; each changed index row carries `fixture_synthetic`.
- `E/run-original-fda6b10.stdout.txt` is the raw console output.
- `E/runs/202610261949-20261026T231115/` holds `results.json` (every step's label, status, 7 caption lines, chips, nav, page errors, lightning request log, shim summary and invariants), `summary.tsv` and screenshots.

## Exact command
```
python3 -m http.server 8151 --bind 127.0.0.1 --directory /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening &
cd /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/opus-browser-tests
python3 -I build_synthetic.py            # once; deterministic (seeded)
node lightning-hardening.browser.mjs --gen 202610261949 --base http://127.0.0.1:8151/wt
```
- **Generations:** the route is `<base>/atlas/v/<gen>/`. For a hardened generation, pass its stamp with `--gen`. Use `--route <url>` to override, `--only 1,5,13` to select tests, and `--out DIR` to choose the output folder.
- **Exit code:** 0 only if every test passes.
- **Wall time:** 4 min 25 s for the full suite, 13 browser contexts.

## Method (applies to every test)
- **Gestures:** each context is fresh. The suite uses only real `locator.click()` (desktop, 1440×900) or `locator.tap()` (phones) and real `mouse.wheel` scrolling. It never uses `force:true` or `dispatchEvent`.
- **Clock:** a fake clock is installed (`page.clock.install`), defaulting to `2026-10-26T18:40:00Z`. The lead's fixtures were built at 18:37:03Z.
- **What is asserted:** user-visible text, read with `innerText`: the label, the status line, the seven `[data-cap]` caption lines, and chip and nav state. The only other probes are the T13 invariants, the request log (T3, T12, T13), and the map source count, which is recorded as supporting evidence only.
- **Settling:** a step is settled when the status is not `LOADING` and the label is not `[LOAD]` or `[WAIT]`, up to 10–120 s depending on the step.
- **Every case closes the same way:** a real OFF gesture, then 11 fake minutes, then the invariants again (T13).

## Results on the UNMODIFIED candidate (12 FAIL as expected, T13 PASS)

| Test | Result | Fixture / profile | Observed (what failed) |
|---|---|---|---|
| T1 CUSTOM during first load | **FAIL** | lead `lightning-archive`, index delayed 6 s | Uncaught `Cannot read properties of null (reading 'colour')`. With CUSTOM active, the delayed 24h result paints `Window 2026-10-25 18:40 UTC → 2026-10-26 18:40 UTC (24 hours, latest)` |
| T2 Malformed index timestamp | **FAIL** | SYNTHETIC-hostile-index-timestamp | 3× `Invalid time value`. After 12M the label is stuck at `[LOAD]` / LOADING. 7D and 24H taps are accepted but stay LOADING, with the 24h caption left on screen. No caption names the bad data |
| T3 Feed revalidation | **FAIL** | runtime copy of lead `no-index`; the feed's query window was changed between the two ONs (SYNTHETIC, logged) | Feed requests: 1 after the first ON, still 1 after OFF→ON. The refresh line still reads `13:05 UTC` (expected 18:05) |
| T4 Feed STALE | **FAIL** (the control passes) | lead `no-index`, 18:40Z; control at 14:00Z | `[408 \| 7d]`, `PARTIAL · 408 FLASHES DRAWN · SEARCHED 2%`, with no STALE. The feed collection ended 5 h 34 min earlier |
| T5 Feed mode + PREV | **FAIL** | lead `no-index`, 48H, PREV ×3 | PREV#1 and #2 show `Searched EUMETSAT 0% of window — no collection run covers these dates` with 255 and 90 points drawn. PREV#3 shows `FAIL · 48 hours needs the archive (archive not yet published); the live feed keeps 7 days` |
| T6 Long chips, owner device | **FAIL** | lead `no-index`, 393×852, iPhone UA (Chromium) | 30D, 3M, 6M and 12M are each `disabled`. The real tap times out (3 s), so these are dead chips with no message |
| T7 Feed coverage wording | **FAIL** | lead `no-index`, 7D | `SEARCHED 2%` in the status and `Searched EUMETSAT 2% of window · 1 successful runs` in the caption. Nothing says unknown |
| T8 HIDE LAYERS occlusion | **FAIL** (strict); the as-specified centre rule **PASSES** | lead `lightning-archive`, 7D, 393×852 and 360×740, scrolled to the end by wheel | See the note below. The button at [249,796,132,44] (393) and [216,684,132,44] (360) covers the right part of footer rendered lines 2/3 and 3/3: 2–3 of 9 sample points per line hit `HIDE-LAYERS-BUTTON` |
| T9 Out-of-box / NaN points | **FAIL** | SYNTHETIC-out-of-box | `411 FLASHES DRAWN` (map source 411) where 408 are genuine. Nothing reports rejection |
| T10 Shard integrity | **FAIL** | SYNTHETIC-shard-mismatch | `PARTIAL · 408 FLASHES DRAWN`. No caption mentions a mismatch for 22 Oct (sha256), 23 Oct (bytes) or 24 Oct (count) |
| T11 Sub-day caption | **FAIL** | SYNTHETIC-bulk-day, clock 2026-10-25T06:00Z, 12H, LOAD POINTS | `Flashes 85,118 archived in window (index)`: the whole-day sum of 24 + 25 Oct is shown for a 12 h window. Before consent the caption was honest (`archived on 2 overlapping UTC dates`) |
| T12 LOAD POINTS | **FAIL** | same run as T11 | The caption promised `the newest 40,000`, but 85,000 were drawn (`85,000 FLASHES CLUSTERED`). After consent it fetched `days/2026/10/25.json`, declared at 33,713,273 B, above the 32,000,000 budget |
| T13 Invariants | **PASS** | all 13 contexts | Before and after every case, `inspect()` = `{engine:60,pipeline:3,total:63,unique:63,complete:true}`, with 63 `[data-gridatlas-layer-proxy]` and 63 `[data-gridatlas-layer-key]`. Every case made 0 lightning requests before the first ON and 0 in the 11 fake minutes after OFF. The OFF gesture succeeded every time and every switch ended unticked |

Composition booted in all 13 contexts. The shim aborted 2 off-origin URLs per context (`data-grid-gb … connection-points.v3.json`, `ventus-grid-engine … engine-graph.json`). Both are BLOCKED_DEPENDENCY and are not touched by the overlay.

## Pass criteria for the hardened generation (abridged; exact asserts are in the file and in `results.json`)
- **T1:** no `pageerror`. The CUSTOM chip is active, and the window line is empty or in the custom form (`UTC dates …`).
- **T2:** no `pageerror`, and 12M, 7D and 24H each settle and show their period. The actual or warning line matches `invalid|malformed|unparseable|bad data|not-a-date|unknown` (the standard "unknown, not zero" phrases are stripped first).
- **T3:** one more feed request after OFF→ON, and the refresh line shows `18:05 UTC`.
- **T4:** STALE in the label or status at 18:40Z, and none at the 14:00Z control.
- **T5:** no FAIL after any PREV, and never "searched 0%" while N > 0 points are drawn. Disabling PREV passes.
- **T6:** each long chip accepts the tap, and the visible non-footer text says `archive not yet published` and `earlier … unknown, not zero`.
- **T7:** no `%` in the status or searched line, and `unknown` is stated.
- **T8:** (a) **as specified:** each `[data-cap]` block's centre hits the caption. (b) **strict:** each rendered line (`Range.getClientRects`) is sampled at 10…90 % of its width.
- **T9:** drawn exactly 408, and `reject|quarantin` appears (the fix designer's H03 wording).
- **T10:** `mismatch` appears, and each date is named with it.
- **T11:** every `N archived in window` equals the drawn count.
- **T12:** drawn ≤ the promised `newest N`, and the declared bytes fetched after consent are ≤ 32,000,000. Loading nothing, and saying so, passes.

## What I do not know / limits
- **T8 as worded is not fail-first.** The work order's centre-of-line rule passes on the original. The centre of each wrapped footer line is x≈180–200, left of the button at x≥216/249. The owner's occlusion (footer lines 2–3 at 22–39 % of their width) is caught only by the strict per-line sampling, which I added and which decides the verdict. The lead should confirm that strict sampling is the intended bar. If not, T8 reverts to PASS on the original.
- **T5 is strict about FAIL.** It treats any FAIL after PREV as a failure, including the explained "needs the archive" FAIL. The work order says "unexplained"; I read the overlay review's #5 as requiring no FAIL at all. If an explained FAIL is acceptable, the third press is the only change: drop the `PREV #n: not FAIL` assertion when the status names "archive".
- **Wording-dependent assertions.** T2, T6, T9 and T10 rely on keywords (listed above) chosen to match the fix-designer drafts (`H01–H05.diff`) and the work-order phrases. A hardened generation with different but honest wording could fail them; check `results.json` before calling it a regression.
- **Shared scenario.** T11 and T12 share one scenario (one 33.7 MB synthetic shard, about 20 s).
- **Not tested:**
  - real WebKit/Safari or a real device (BLOCKED_HARNESS);
  - live CORS and caching (BLOCKED_DEPENDENCY);
  - the 10-minute timer re-fetch (T3 covers OFF→ON only);
  - `parts[]` shards;
  - the phone 10,000-point cap after consent;
  - the desktop Grid-menu surface.
- **Synthetic fixtures are not observations.** The out-of-box, mismatch and bulk shards are SYNTHETIC by construction. The bulk day's 85,000 points are random positions inside the UK box.
