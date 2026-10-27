# code-review-E: line review of the lightning overlay, generation 202610270024 (variant E)

Lane: code-review-E. NODE ONLY: no Chromium was started. Target: `wt/atlas/modules/202610270024-uk-lightning-overlay.js` (24,780 B, sha256 2976cae7…e3e9). It is byte-identical to `opus-fix-designer/fixed-module-E.202610270024.js`. I reviewed the whole file and a word diff against `202610262323` (D). The diff is equivalent to FINAL-E.diff after the GEN stamp. I formed my own findings before I read `reports/code-review-final.md`.

Harness: self-fixture. Tests run under node:vm with `minidom.mjs`, copied into my folder. `boot()` was copied from `test-fixes.mjs` and extended with a `lazy` install option and a map-call log. The viewport is a 1440 px desktop with `matchMedia` false. All data is SYNTHETIC. Nothing outside `evidence/code-review-E/` or this report was written.

Evidence: `hardening/evidence/code-review-E/`
- `repro-E.mjs` (= `base.part.mjs` + `tests.part.mjs`)
- logs: `run-202610270024.log` (E), `run-202610262323.log` (D), `run-repro-*.log`, `run-testfixes-*.log`, `run-chatgpt-*.log`
- `patched-E.js` (all fixes, 24,891 B), `patched-E-mustfix.js` (E1+E3+E4 only, 24,793 B), `patched-E-fit.js` (all fixes, with three comments removed to fit, **24,716 B ≤ 24,781**), `patched-E-fit.diff` and `patched-bytes.txt`. These were verified and never applied.

Command (from the evidence folder): `MODULE=<module> node --test repro-E.mjs`

## Results table

| ID | status | evidence path | command |
|---|---|---|---|
| E1 `cf` 0.999 tolerance vs `floor` caption: "SEARCHED 100%" next to "99%" (minification regression) | **FAIL** (defect, honesty) | run-202610270024.log #1; D passes | `MODULE=…/202610270024… node --test repro-E.mjs` |
| E2 T08 NEXT after PREV misses latest on month-end dates; T08 passes only by date (regression) | **FAIL** (cosmetic; test passes for the wrong reason) | #2 (2026-05-31 → window ends 05-28); D passes | same |
| E3 `parts[]` without `hour` gives a false "NO FLASHES DETECTED · SEARCHED 100%" | **FAIL** (defect, false zero; S5 guard incomplete) | #3 (E and D) | same |
| E4 a date with no index row inside 100% scan coverage gives EMPTY-COVERED | **FAIL** (defect, false zero; pre-existing state-machine hole) | #4 (E and D) | same |
| E5 `setOn(true)` before install: `pt(false)` throws on `c.colour`, so `fit` and the resize listeners are never registered | **FAIL** (low, API-only; failure mode changed by reordering) | #5 | same |
| E6 `ok()` `endsWith('/'+kind)` accepts `["optical_lightning_flash"]` (lost `===` guard) | **FAIL** (low, regression) | #6; D passes | same |
| E7 CR6 PARTIAL from budget-skipped days has `reasons: []` | **FAIL** (low) | #7 | same |
| CHK-RACE chip/timer/OFF during parked shard loads | PASS | #8 | same |
| CHK-DOM/MAP original nodes unchanged; map touched only on own ids; no camera move | PASS | #9 | same |
| CR1–CR6 (code-review-final) hold on E | PASS (CR6 PASS with E7 caveat) | run-testfixes-202610270024…log 49/49 | `MODULE=… node --test test-fixes.mjs` |
| Fix verification: all fixes | PASS: repro 9/9, test-fixes 49/49, ChatGPT 4f9bcdf 8/8, proof needles present, 24,716 B | run-*-patched-E*.log, patched-bytes.txt | as above with `MODULE=patched-E-fit.js` |
| r.out "outside the current view" not recounted after pan (moveend dropped for budget) | OWNER_DECISION | static, line 101 | – |

## Findings (line numbers refer to the E file)

### E1: "NO FLASHES DETECTED · SEARCHED 100%" next to "Searched EUMETSAT 99%" (FAIL, regression from round→floor)
Line 92 still treats `f≥0.999` as fully covered, but lines 115 and 150 now use `Math.floor`. Repro: a 24 h window with a 60 s internal scan gap. Observed: state `EMPTY-COVERED`, status `NO FLASHES DETECTED · SEARCHED 100%`, caption `Searched EUMETSAT 99% of window`, label `[EMPTY | 24h]`. D showed 100% in both places. The tolerance is not small: 0.1% is 43 min on 30D and 8.8 h on 12M of unsearched time, all reported as "no flashes, searched 100%".
**Fix (line 92):** `f<0.999` → `f<1` (`sd`/`win` are integer milliseconds, so full coverage gives exactly 1).

### E2: T08 is date-dependent (FAIL, cosmetic; the test passes for the wrong reason)
Line 163 computes NEXT as `mm(w.e,w.mo)`, but `mm` clamps the day of the month, so it is not invertible. With now = 2026-05-31 12:00, PREV lands on 02-28 and NEXT then lands on 05-28 (`atLatest:false`). With now = 12-31, NEXT lands on 12-30. D's `w.e+w.span` happens to round-trip on those dates, but it fails on 27 October, which is why T08 is green today. **Fix:** keep a PREV stack. Add `h:[]` to S. On PREV, `S.h.push(S.end),S.end=w.s`. On NEXT, `const e=S.h.length?S.h.pop():…;S.end=e===null||e>=now-9e5?null:e`. Reset `S.h=[]` in `sp` and LATEST (+66 B).

### E3: `parts[]` rows without `hour` silently fetch nothing (FAIL, false zero)
The new S5 guard (line 36) validates `path` and `count` but not `hour`, which `tg` (line 58) uses: `Number(undefined)` is NaN, so every part is filtered out. Repro: yesterday has count 3 in one part with no `hour`. Observed: `idx` accepted, 0 shard fetches, `EMPTY-COVERED`, `NO FLASHES DETECTED · SEARCHED 100%`, `[EMPTY | 48h]`. A wrong `hour` has the same effect. **Fix (line 58):** derive the hour from the validated path: `Number(p.hour)*HOUR` → `p.path.slice(-7,-5)*HOUR` (+5 B).

### E4: a date with no index row (or `coverage:'none'`) inside full scan coverage reads EMPTY (FAIL, false zero, pre-existing)
`cv` counts such a date in `u` (line 51), but `cf` (line 92) never looks at `c.u`. Observed: `EMPTY-COVERED` / `NO FLASHES DETECTED · SEARCHED 100%` while the caption warns `Unknown: 1 of 3 UTC dates have no collection run`. In detail mode that day is never fetched. **Fix (line 92):** `…||c.l` → `…||c.l||c.u.length`. Together with E1 the line becomes `else if(f<1||c.ny>0||c.l||c.u.length){` (+8 B).

### E5: ON before install crashes the install's `pt(false)` (FAIL, low, public API only)
E moved `S.installed=true` before `pt(false)` (line 181). If `NS.ukLightning.setOn(true)` runs before install and the load is still pending, `pt(false)` reads `c.colour` with `c=null` and throws TypeError. The install then counts as done, but `fit()` and the resize/orientation listeners are never registered. In D the throw came before `installed=true`, leaving `installed:false` with one group already appended, so the next tick retried the whole install (not exercised here). **Fix:** `pt(false);fit()` → `pt(!S.res);fit()` (+1 B).

### E6: `observation_kind` check loosened (FAIL, low, regression)
`FEED_SCHEMA.endsWith('/'+kind)` (line 68) string-coerces the value, so `["optical_lightning_flash"]` and `[["…"]]` pass. D used `===`. **Fix:** `FEED_SCHEMA.split('/')[1]===f.properties.observation_kind` (+2 B, keeps the PARITY constant).

### E7: budget PARTIAL without a reason (FAIL, low)
Line 93 makes `r.sk.length` PARTIAL (CR6) but pushes nothing into `rs`, so `S.last.reasons` is `[]`. **Fix:** `st=r.sk.length?(rs.push('days not loaded'),'PARTIAL'):…` (+29 B).

### Budget
E is 24,780 B against a 24,781 B cap. All fixes come to +111 B. Removing three descriptive comments (`// transport…`, `// map…`, `// DOM…`, −175 B, none of them a proof needle) gives 24,716 B. The must-fix set (E1+E3+E4) alone is +13 B and needs at least the `// transport` comment removed.

## Checked and clean (minification audit)
- **Precedence:** `!!(r.idx||r.meta)&&stale(…)`; `s&&hex!==t.sha256&&'sha256'`; `raw&&r.arrayBuffer?…`; `throw e&&e.name==='AbortError'?…:e`; the feed-first ternary chain in `sl`; `n>0?(…?'≥':'')+N(n):…`; `!(now-x.gen<=4*HOUR)` (NaN → stale). All are correct.
- **Shadowing:** `b` in `vk` (local fn) and in `cv`/`fit`/the keep loop are separate scopes. `c` in `ok`'s IIFE and in `cp` are not shared. `r` is reassigned in the `ld` fail path, which is intended. `e` in `nv` NEXT is block-scoped. None of these are harmful.
- **Guards:** `li` `S.ip===p` (CR2/CR4) is correct for both success and failure. In `fr`, `sn===S.serial` stops new requests. Superseded runs leave holes in `parts` and `co` then throws, but `ld` discards that result through the serial check (CHK-RACE). In-flight fetches are not aborted; `AbortController` handles the timeout only, as in D.
- **DOM/MapLibre:** the host, the original `.key-group`, the Grid panel body and the curtain are unchanged apart from one appended group and one filtered `change` listener each. The map is touched only on `gridatlas-lightning`/`l-gridatlas-lightning`, both are removed on OFF, and there are no camera calls. `fit()` writes only to our own group's style and only reads `#gridatlas-dash-toggle`.

## CR1–CR6 (read after my review)
CR1 (newest day alone over budget → summary plus "newest day alone exceeds", LOAD POINTS hidden), CR2 (S.idx cleared), CR3 (no new shard requests after OFF), CR4 (late index ignored), CR5 (safe-integer counts) and CR6 (PARTIAL) all hold on E: test-fixes reports 49/49. The one caveat is E7: CR6 holds, but the PARTIAL state carries no reason.
