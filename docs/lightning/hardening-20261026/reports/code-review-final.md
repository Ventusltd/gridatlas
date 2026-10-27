# code-review-final: line review of the lightning overlay, generation 202610262323

Lane: code-review-final (relaunched after the container restart; there was no earlier partial work). Scope: `wt/atlas/modules/202610262323-uk-lightning-overlay.js` (23,226 B). I reviewed the whole file and also a word diff against `202610261949-uk-lightning-overlay.js` (fda6b10). I read no other lane's report.
Harness: self-fixture. Every repro runs under node:vm with `minidom.mjs`, copied from opus-fix-designer. The `boot()` function is copied from `test-fixes.mjs`, with one addition: a `gate` option that parks fetches. All data is SYNTHETIC and built inside the test. There is no browser and no network, and the viewport is 1440 px desktop with `matchMedia` set to false. Nothing outside `evidence/code-review-final/` was written.

Evidence folder: `hardening/evidence/code-review-final/`
- `repro.mjs` (= `repro-base.mjs` + `repro-tests.part.mjs`), with logs `run-202610262323.log`, `run-202610261949.log` and `run-patched.log`
- `patched-CR1-CR2.js` and `patched-CR1-CR2.diff` contain the proposed minimal fixes. They were verified, never applied to the worktree.
- `test-fixes.copy.mjs` is an unmodified copy. It gives 24/24 PASS on 202610262323 and 24/24 PASS on the patched copy, so the fixes introduce no regression in that suite.

Command (from the evidence folder): `MODULE=../../wt/atlas/modules/<gen>-uk-lightning-overlay.js node --test repro.mjs`

## Results table

| ID | status | severity | evidence path | command |
|---|---|---|---|---|
| CR1 LOAD POINTS false zero (regression) | **FAIL** | release-blocker | run-202610262323.log #1; BEFORE run-202610261949.log #1 ok | `MODULE=…/202610262323… node --test repro.mjs` |
| CR2 stale `S.idx` after index failure | **FAIL** | defect | run-202610262323.log #2, #3 | same |
| CR3 shard requests issued after OFF / chip change | **FAIL** (pre-existing) | defect | run-*.log #4 (both gens) | same |
| CR4 late older index overwrites `S.idx` | **FAIL** (minor race) | cosmetic/defect | run-202610262323.log #5 | same |
| CR5 `vk()` accepts a string `count` | **FAIL** (pre-existing, hostile index only) | defect | run-*.log #6 | same |
| CHK1 serial guard: chip change and OFF during a gated load | PASS | – | run-202610262323.log #7 | same |
| CHK2 original DOM untouched; only own map ids; no Grid row | PASS | – | run-202610262323.log #8 | same |
| CR6 READY·DETAIL when some days were skipped | OWNER_DECISION | – | static (lines 87–88, 96) | – |
| S1–S6 static observations | NOT_TESTED / unproven | – | this report | – |

## Findings

### CR1: LOAD POINTS reports "NO FLASHES DETECTED · SEARCHED 100%" for 45,100 archived flashes (FAIL, release-blocker, introduced by the hardening edit)

Location: `lw`, line 87, in the new "newest days within both budgets" loop:
`if(r.sk.length||run+y.count>BUDGET||rb+b>32e6){r.sk.push(y.date);continue}`
If the newest overlapping day exceeds 40,000 flashes or 32 MB on its own, that day is skipped. Every older day is then skipped as well. `keep` ends up empty, `fr([])` returns no parts, and the result has `mode='detail'` with `ev=[]`. `cf` then gives `EMPTY-COVERED` because coverage is 100%. The same thing happens when only the in-window hourly parts are within budget but the whole-day `y.count` is over it, because the trigger sums parts while the keep loop uses whole-day totals.

Repro: CR1. The index has today at 45,000 (full coverage) and yesterday at 100. The user picks 7D and then clicks LOAD POINTS. Observed:
`state EMPTY-COVERED · label "[EMPTY | 7d]" · status "NO FLASHES DETECTED · SEARCHED 100%" · 0 day fetches`.
The expected result is a non-zero state that never claims "no flashes". On 202610261949 the old loop (`if(run>=BUDGET)`) always kept the newest day, so the same input gave a FAIL or load and never EMPTY. This is a new false zero, and it breaks the core rule "unknown, never zero".

Minimal fix (verified in `patched-CR1-CR2.js`, +48 B, 23,274 B, still under the 24,781 B ceiling):
- Line 85: set `r.budget=…` before `if(!S.consent)`.
- Line 87: insert `if(!keep.length){r.clp=true;return r}` before `tf=keep`.
The result is then `READY·SUMMARY`, with label `[45,100 | 7d]` and caption `index sum 45,100 flashes, 20,050,000 bytes exceeds the budget`.

One wording issue remains: the button still says it "draws up to the newest 40,000". Whether to load the newest day's in-window hours partially is an OWNER_DECISION.

### CR2: `S.idx` is never cleared when the index later fails (FAIL, defect, latent before; now reachable because ON refetches)

Location: `li`, line 47, in `.catch(e=>{S.ip=null;S.ie=msg(e);throw e})`. `S.idx` keeps the last good index.

Repro CR2a: index OK, then OFF/ON with index 404 and feed 503. The ld fail path (line 171) builds `idx:S.idx`, which is the stale index. `cp` line 102 (`r.ie&&!x`) therefore drops the "Archive unavailable … nothing shown (unknown, not zero)" sentence. The warning shows only `HTTP 503`. A fresh session given the same inputs shows the full sentence.

Repro CR2b: after the archive is lost and the overlay falls back to the feed tier, PREV is enabled. A fresh feed-only session has it disabled. Date `min` also comes from the stale index (line 158–159).

Minimal fix (verified): `.catch(e=>{S.ip=null;S.idx=null;S.ie=msg(e);throw e})`. CR2a and CR2b then PASS and test-fixes stays at 24/24.

### CR3: superseded loads keep issuing new shard requests after OFF or a chip change (FAIL, pre-existing in fda6b10)

Location: `fr`, line 67. The worker loop `while(pos<jobs.length)` has no serial or abort check, and the `AbortController` in `gj` exists only for the 15 s timeout.

Repro CR3: 8 one-flash days, all shard fetches parked, then 7D, then OFF. Observed: 6 requests were in flight at OFF, and **2 new shard requests were issued after OFF**. Results are discarded correctly (no layer, label `[WAIT]`, CHK1 PASS), so this wastes network but does not corrupt state.

Minimal fix: pass the serial into `fr` and stop the loop when it changes. In `lw`/`fr`: `while(pos<jobs.length&&serial===S.serial)`. That needs `lw(now,serial)` threaded through, about 30 B. Aborting in-flight fetches would need a shared controller and is not proposed as minimal.

### CR4: a slow older index response overwrites a newer `S.idx` (FAIL, minor race)

Location: `li` success handler (line 47), where `S.idx=m` runs for superseded requests. Sequence: OFF/ON while index request #1 is parked, then #2 resolves, then #1 resolves. `S.idx.gen` regresses to the older index, while `S.res.idx` is the newer one. The only effects are PREV enablement and date `min` (pt). Minimal fix: in the success handler, assign only when `S.ip===p`. That needs the promise held in a local, about 20 B. Low priority.

### CR5: `vk()` accepts a string `count` (FAIL, pre-existing; hostile or malformed index only)

Location: `vk`, line 35, in `!(n>=0)`, which passes `"5"`. In the overview sum at line 81 (`n+y.count`), the numbers are concatenated as strings, giving `"050000000000"`. The caption then reads `Flashes 50,000,000,000 archived`. The producer (`history.py`) always writes integers, so this is reachable only with a corrupt index. Fix: `!(Number.isSafeInteger(n)&&n>=0)`.

### CR6: OWNER_DECISION, budget-skipped days still read READY

When LOAD POINTS skips some days but loads others (`r.sk.length>0`, `ev.length>0`), `cf` reports `READY·DETAIL` with 100% searched. The label shows the downloaded count, not the archived total. The caption is accurate ("N downloaded from the newest k of m days"), but the state and label overstate completeness. The owner needs to choose between leaving it as it is and reporting PARTIAL.

## PASS checks

- **CHK1, races:** two chip changes and an OFF during parked loads leave exactly the last action's result. After OFF, `S.res` is null and no source or layer remains. The `serial`+`S.on` guard on line 170 is sound. The 10-minute timer re-enters through `ld(true)` under the same guard.
- **CHK2, original DOM/MapLibre:** the original `.key-group` attributes, children and style are unchanged. The host gains one appended group and one `change` listener, which filters on `data-lightning-control` and does not use `data-layer-id`, so the engine's delegated handler ignores it. The Grid panel body receives nothing. The map holds only `gridatlas-lightning` and `l-gridatlas-lightning`, and both are removed on OFF. No `setStyle` exists in the live shell (grep), so the layer can't be lost to a style reload. No live cartridge's checkbox-label fallback (`subs `, tech labels) matches "Lightning flashes".
- The cartridge tail is byte-identical to the module (`cmp` of the last 23,226 B).

## Static observations (unproven, no repro)

- **S1, dead code:** the `raw&&r.arrayBuffer?…:r.json()` fallback (line 28) and `b.byteLength>=0?…:b` (line 60) are unreachable in browsers. If either were reached, the `bytes` check would always fail. Harmless.
- **S2, silent skip:** SHA-256 verification is skipped when `crypto.subtle` is absent (a non-secure origin). Production is served over HTTPS, so this is acceptable.
- **S3, cosmetic:** the out-of-box UK flashes are counted as "malformed records rejected". The producer already filters to the box, so it is unproven in practice.
- **S4, cosmetic:** the header glossary still points to `docs/lightning/CANDIDATE-202610261949.md`.
- **S5:** `ins()` still waits for `NS.menuBar.installed` although the Grid row was removed. If menuBar never installs, the overlay never appears. The behaviour is intentional per the comment.
- **S6, swallowed errors:** `tick` notes install errors every 250 ms without bound, and `pt` throwing inside the `.then` would leave the label stuck at `[LOAD]`. No reachable trigger was found: `T()` is now NaN-safe, and `ymd(NaN)` needs a calendar-invalid custom date that `<input type=date>` cannot produce.
- Regressions versus fda6b10 that I checked and found clean: NA→function, the feed `cov:null` and PARTIAL/UNKNOWN path, `T()` NaN-safety, the removed LONG chip disabling, CUSTOM now loading immediately, ON now refreshing (`ld(true)`), and removal of the menu row (no leftover references). Apart from CR1, none introduced a defect.
