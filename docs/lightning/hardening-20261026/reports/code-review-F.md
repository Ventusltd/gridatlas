# code-review-F: generation 202610270047 lightning module (NODE ONLY)

**Target:** `wt/atlas/modules/202610270047-uk-lightning-overlay.js` (24,773 B, sha256 421f3d7e…a3b45f, identical to `evidence/opus-fix-designer/fixed-module-F.202610270047.js`; the cartridge tail matches byte for byte). **Base:** 202610270024 (E). **Method:** I read the whole module line by line (176 lines), then the word diff from E to F. Every finding has a minidom/node:vm repro in `evidence/code-review-F/repro-F.mjs`, which is self-contained (a copy of the test-fixes harness plus a probe of `cv,vk,ni,fit,wf`). No Chromium was used. I read the other code-review reports only after forming this view; none of them overlaps with these findings.

Run: `cd hardening/evidence/code-review-F && MODULE=<module> node --test --test-reporter=tap repro-F.mjs`. Each repro asserts the *correct* behaviour, so `not ok` means the defect is present.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| BASE syntax, size, cartridge tail, copied suite | PASS (69/69) | code-review-F/suite-F.tap | `MODULE=…/202610270047-uk-lightning-overlay.js node --test test-fixes.copy.mjs` |
| CRF-1 part count `0.5` accepted (lost guard) | **FAIL** (regression vs E) | repro-F.202610270047.tap #1 (E: ok) | repro-F.mjs `CRF-1` |
| CRF-2/2b lost day with overlapping scan windows: Searched % under-counted, can flip to UNKNOWN | **FAIL** (LOW; F-C fix incomplete) | repro-F.202610270047.tap #2, #16 | repro-F.mjs `CRF-2` |
| CRF-3 mismatch refetch/retry is bounded (no loop) | PASS | repro-F.202610270047.tap #3 | repro-F.mjs `CRF-3` |
| CRF-3b retry-exhausted PARTIAL gives reason "gaps in window" | FAIL (LOW, wording) | #4 | `CRF-3b` |
| CRF-3c "retrying next refresh" promised on a non-latest window, but no refresh happens | OWNER_DECISION (wording) | #5 | `CRF-3c` |
| CRF-3d superseded load still does its cache-busted refetch | INFO | #6 | `CRF-3d` |
| CRF-4 redirect rejection, fetch (index and day file) and XHR (feed) | PASS (day-file redirect was accepted in E) | #7 | `CRF-4` |
| CRF-5a ResizeObserver never disconnected when the button is replaced | INFO/LOW (shell never replaces it) | #8 | `CRF-5a` |
| CRF-5b RO and window listeners stay active after OFF | INFO | #9 | `CRF-5b` |
| CRF-5c RO→fit→RO loop | PASS (idempotent; target is `position:fixed`) | #10 | `CRF-5c` |
| CRF-6a 7D PREV → chip 12H → NEXT jumps 168 h to LATEST | OWNER_DECISION (behaviour change vs E) | #11 (E: ok, +12 h) | `CRF-6a` |
| CRF-6b 24H PREV×2 → chip 7D → NEXT overlaps by 6 d | INFO (E overlaps 5 d) | #12 | `CRF-6b` |
| CRF-6c stack consistency across CUSTOM, LATEST and OFF/ON | PASS (S.h grows by 1 per PREV/LATEST cycle; never cleared) | #13 | `CRF-6c` |
| CRF-7 `aria-live="polite"` removed (role=status kept) | OWNER_DECISION | #14 | `CRF-7` |
| CRF-8 conflicting duplicate rows: `lost` comes from all rows, `by` keeps the last | INFO (same in E) | #15 | `CRF-8` |
| UND four caches (ip, fp, mode, timer) now `undefined` | PASS | static grep in this report; suite H01/F3 | `grep -o "S\.\(ip\|fp\|mode\|timer\)…"` |
| PREC precedence and ASI audit of every changed expression | PASS | below | read |
| HARNESS CR6/E7 flake (30k-flash shards vs a 30-tick `drain`) | INFO (harness) | suite-fix1+2.tap vs .rerun.tap | rerun passes |

## FAIL details and minimal fixes (verified)

**CRF-1, line 33.** `(p.count>>>0||.5)===p.count`. For `p.count===0.5`, `0.5>>>0` is `0`, so the left side becomes `.5` and the check passes. E's `Number.isSafeInteger` rejected it. The index loads, and the part then fails as an "index mismatch", which triggers the F2 refetch and ends as a PARTIAL "archive updating" instead of "invalid index row … parts". **Fix (0 B):** `(p.count>>>0||-1)===p.count`. This rejects 0, 0.5, negatives, NaN and strings. Verified in `fix/F+fix1.js` (24,773 B): CRF-1 ok, suite 69/69.

**CRF-2/2b, line 47.** F-C made the scan-window *sum* a union (line 46), but subtracting a lost day still loops over every window: `for(const w of x.sw)sd-=ov(…)`. With overlapping windows the lost day is subtracted several times:
- 7D window, one lost day, windows listed twice: the single-window index gives 85%, the duplicated one gives 71%. (E gave 100%, which was the F-C over-count.)
- CUSTOM 2 days, one lost day and one searched day with 2 drawn flashes, windows ×3: the label reads `[UNKNOWN | custom]`, the state is UNKNOWN and Searched says "shard lost … unknown". The single-window index gives PARTIAL `[≥2]` at 50%.

The error is conservative (it never over-claims), and the real fixtures have 0 overlapping windows, so this is LOW. **Fix (+26 B, over the 8 B spare):** `let m=t;for(const w of x.sw)sd-=ov(Math.max(ws,m),Math.min(we,t+DAY),w.s,w.e),m=Math.max(m,w.e)`. Verified in `fix/F+fix1+fix2.js` (24,799 B): CRF-1/2/2b ok, suite 69/69 (one E7 flake on the first run; rerun clean).

**CRF-3b, line 86.** When only retry-exhausted ("u") failures remain and coverage is full, `rs` is empty, so the reason becomes "gaps in window" and the status reads `PARTIAL · 0 FLASHES DRAWN · SEARCHED 100%`. The warning line itself is correct. Fix: push `'archive updating'` when `r.fl.length` (about +40 B), or accept as is.

## OWNER_DECISIONS

- **CRF-3c, line 81.** The text "archive updating, retrying next refresh" is false after PREV, because the 10-minute timer reloads only `atLatest` windows (0 fetches after a tick). Changing it to `'archive updating, reload later'` saves 9 B and pays for most of FIX-2. That would bring FIX-1+2+3 to 24,790 B, still 9 B over the cap. The data-contract-E wording is an owner decision.
- **CRF-6a, lines 151/155.** E's NEXT advanced one page of the *current* period. F's stack returns to the previous end, so a chip change after PREV makes NEXT jump: from 7D to 12H it jumps 168 h, straight to LATEST. The window caption always states the real window, so nothing is dishonest. Options: keep it, or have `sp` reset to LATEST with `S.end=null;S.h=[];` (+19 B).
- **CRF-7, line 131.** `role="status"` implies polite in ARIA, but redundant `aria-live` is the common compatibility advice for older VoiceOver and NVDA builds. Restoring it costs +19 B. This should be checked on the owner's iPhone with VoiceOver.

## Areas checked clean

- **Retry path (CRF-3):** when the mismatch persists, a 48H load makes exactly 1 cache-busted `index.json?<now>` request and at most 2 shard GETs, then ends PARTIAL. The recursion passes `q=now` (truthy), so the second pass cannot recurse. Each timer tick does the same bounded work (4 fetches). A superseded load still does its own refetch and sets `S.ip=null` (CRF-3d), which can make the newer load skip its `S.idx` write. The stale load then writes it, so the result is only one extra request (INFO). A guard `if(!q&&sn===S.serial)` would cost +14 B.
- **Redirects (CRF-4):** a fetch with `r.redirected` throws `'redirected'` for both the index and day files. In E a redirected day file was accepted as PARTIAL; in F it is FAIL with 0 drawn. On XHR, a `responseURL` that does not start with the requested URL is rejected. A same-origin path-prefix redirect such as `…/uk_lightning.geojson.attacker-branch.json` is accepted, and so is an empty `responseURL`. Both are INFO: the URL already pins the origin.
- **ResizeObserver (CRF-5):** the target `#gridatlas-dash-toggle` is created once by the sld-sandbox (cartridge line 2530 guards on the id) and is `position:fixed; right:12px; bottom:12px`, so the group padding that `fit()` writes cannot resize it, and no loop is possible. In node, 100 callbacks produce 0 new observers and identical padding. `S.ro=d` is assigned before `observe()` is called, so even a synchronous first callback does not re-attach. Two gaps remain: replacing the button leaks one observer per replacement (old observers are never disconnected), and the observer plus the 4 window listeners stay live after OFF. Both are harmless with this shell.
- **Undefined caches:** every use is a truthiness test (`!S.ip`, `S.fp||`, `S.mode&&`, `if(S.timer)`). No `===null` is applied to them, and no proof or consumer reads them (grep of the 202610270047 proof and atlas/tools).
- **Precedence and ASI:** I checked each changed expression: `n>>>0!==n` (`>>>` binds before `!==`), `r.ok?'redirected':'HTTP '+r.status`, `ds(row.date)+p.path.slice(-7,-5)*HOUR`, the `r.fl.length?…:first||…` ternary, `c.f>0?…:c.l?…:…`, the `(rs.push(…),'PARTIAL')` comma expression, and line 114, which ends without `;` before `return` (ASI applies). All are correct. The `ymd(ds(r.date)||0)!=r.date` check uses loose `!=`, so array dates coerce, but E's `DRE.test` coerced in the same way, so this is not a regression.
- **Short-circuits:** `ins` now calls `pt(!S.res)`, and ON before install paints LOADING without a null dereference. `cf` uses `r.fl.some(f=>!f.u)`, so a non-"u" failure still means FAIL.
