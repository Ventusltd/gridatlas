# sweep-F: E-lane harnesses rerun on generation 202610270047 (variant F), node only

**Target:** F = `wt/atlas/modules/202610270047-uk-lightning-overlay.js`, 24,773 B, sha256 421f3d7e…b45f. It is byte-identical to `opus-fix-designer/fixed-module-F.202610270047.js`. E = `202610270024` (24,780 B, 2976cae7…90bf).

**Method:** the harnesses were copied unchanged into `evidence/sweep-F/` and run on E and F in the same session. My E runs reproduce the E lanes' published results; data-contract SUMMARY is byte-identical apart from timestamps. No Chromium was started, and all data are SYNTHETIC except the data-contract real/collector sets.

**Harness deviations:**
1. The `addEventListener`/`innerHeight` sandbox globals were already in the E copies.
2. In `security/*.mjs`, one extra `'..'` in the fixture path, because the folder is one level deeper.
3. `dc/scripts/run-real-E.qtol.mjs` is a SUPPLEMENTARY run only. It strips `?query` from URLs, as raw.githubusercontent does. The unchanged harness was also run, and its results are the ones reported.

**Status column:** each cell gives E → F. "fix" is F with my minimal patch (`evidence/sweep-F/patched/module-F-fix.js`).

## Results

| ID | E → F | evidence (evidence/sweep-F/…) | command |
|---|---|---|---|
| time T01–T11, T13–T15 (×4 TZ) | PASS → PASS | time/runs/{E,F}/*.log | `sh time/run.sh <module> runs/<v>` |
| time T12 (original) | FAIL → FAIL (superseded by T12a; floor is correct) | same | same |
| time T12a | PASS → PASS | same | same |
| time E01, E04, E05 | PASS → PASS | same | same |
| time E02 month ends / E03 leap day | **FAIL → PASS** | same | same |
| time E06 (future-dated index sub-assert) | FAIL → **FAIL** (now STALE, but still "<1 min ago"): OWNER_DECISION, see R3 | same | same |
| sec S0–S7, S9–S11 | PASS → PASS (wording only: "(cap N)"; "0 archived … (unknown, not zero)") | security/node-runs-{E,F}, `node cmpS.mjs` | `node node-harness-E.mjs <mod> S0 … S11` |
| sec S8 250 k scan windows | **FAIL → PASS** ("SEARCHED 42% · 5 runs") | same | same |
| sec S9 feed point budget | OWNER_DECISION (unchanged) | same | same |
| sec probes A (27), B (11), C (6), F (20), G (5), H (3), E-rowcount (11), E-scanned/sealed (3) | PASS → PASS (only one wording change: "index observation missing") | security/logs/probes-{E,F}.log | `node probes.mjs <mod> out.json` |
| sec D-dup ×3 (590 / 1,001 requests, count ×3) | **FAIL → PASS** (0 / 2 requests, ic 9 → 3) | same | same |
| sec D-alias 02-30, 10-32 | residual → PASS (rejected) | same | same |
| sec E-partcount-negative | **FAIL → PASS** | same | same |
| sec E-partcount-zero-x24 | OWNER_DECISION → PASS (rejected) | same | same |
| sec **E-partcount-float** (count 0.5) | PASS → **FAIL (REGRESSION R1)** | same | same |
| sec E-parthour ×6 | note → PASS (hour taken from path; part fetched; 404 reported as FAIL) | same | same |
| sec F-feed-kind-array | accepted → PASS (rejected, E6) | same | same |
| sec I overlapping scan windows ×3 | **FAIL → PASS** (85% → 42%) | same | same |
| sec suites: test-fixes 49 + ChatGPT 8 | PASS → PASS | suites-secE/*.log | `MODULE=… node --test` |
| FNE-01/02/04/07/08/10/11/12/14 | PASS → PASS (68/68 recovered, 0 stale, 0 throws) | flaky/rep-{E,F}-*.log, out-* | `MODULE=<mod> node flaky-network-E.node.mjs --out <dir>` |
| FNE-03 index off-host CORS redirect | OWNER_DECISION → PASS (rejected → feed fallback) | same | same |
| FNE-05/06/13 unknown shown as zero | **FAIL (61 zero hits) → PASS (0)** | same | same |
| FNE-09 feed off-host CORS redirect | OWNER_DECISION → PASS ("FAIL · redirected") | same | same |
| FNE-15 | n/a (E-lane patch) | — | — |
| FNE-16 real browser | BLOCKED_HARNESS | — | — |
| flaky harness flake | 1 of 68 "recovered=false" in the first run on each of E and F (different cases); 4/4 reruns 68/68 on both. Snapshot taken while the real `crypto.subtle` digest was pending: a harness timing issue, not a module defect | flaky/run-{E,F}.log vs rep-* | — |
| DC E01–E08, E11, E14 | PASS → PASS | dc/{E,F}/node/SUMMARY.txt | `dc/run.sh <v> <mod>` (= run-all.sh + skew) |
| DC E09 shard_lost / E12 "0" for unknown | **FAIL → PASS** ("…(unknown, not zero)", "shard lost (integrity alert)") | same | same |
| DC **E10 sha256 tamper on a SEALED shard** | PASS → **FAIL (REGRESSION R2)** | dc/F/node, dc/F/qtol | same; qtol: `run-real-E.qtol.mjs` |
| DC E13 CDN skew | **FAIL → PASS** (qtol: PARTIAL "archive updating, retrying next refresh"; unchanged harness: the `?<ms>` refetch 404s, so the panel falls back to the feed, which is a harness artefact) | dc/F/node-skew, dc/F/qtol | same |
| CR E1–E7 | **FAIL → PASS** (repro 2/9 → 9/9) | cr/repro-{E,F}.log | `MODULE=… node --test repro-E.mjs` |
| CR CHK-RACE, CHK-DOM/MAP | PASS → PASS | same | same |
| CR CR1–CR6 (test-fixes 49), ChatGPT 4f9bcdf 8 | PASS → PASS | cr/tf-*.log, cg-*.log | as listed |
| designer test-fixes 69 / ChatGPT 8 | — → PASS; also PASS on fix | designer/*.log | `MODULE=… node --test test-fixes.mjs` |

Every previous FAIL now passes, except time E06 (OWNER_DECISION). Two cases that passed on E fail on F (R1, R2).

## Regressions

### R1: part count 0.5 is accepted (line 33)
`(p.count>>>0||.5)===p.count`: for a count of 0.5, `0.5>>>0` is 0, so the fallback `.5` equals the count and the part is accepted. E rejected it. On F the panel shows "Flashes 3.5 in index · 0 loaded" and fetches the part.

Fix: `||.5` → `||-1`. **0 B.** The fallback only applies when `>>>0` gives 0, and −1 never matches, so 0, 0.5 and other fractions are all rejected.

### R2: a tampered SEALED shard reads PARTIAL "archive updating" instead of FAIL (line 81)
F2 downgrades every `index mismatch` to `f.u=1` after one index refetch. The TAMPER-sha set (2026-10-24, `sealed:true`, wrong sha256) now gives `PARTIAL · 290 FLASHES DRAWN`, `[≥290 | 7d]` and "2026-10-24 archive updating, retrying next refresh" (qtol run). E gave `FAIL … index mismatch: sha256`. Sealed shards are immutable, and the data-contract-E spec said "Sealed rows keep the FAIL".

The unchanged harness shows a second effect. The cache-busted refetch 404s, so 7d, 30d and custom fall back to the feed with "archive not yet published: HTTP 404". This is a harness artefact, but the module logic is real: any failed refetch discards a valid index for that render.

Fix (+7 B net, 24,780 B ≤ 24,781):
- line 61 `fl.push({date:row.date,error:msg(e)})` → `fl.push({date:row.date,error:msg(e),t})` (+2)
- line 81 `if(/mismatch/.test(f.error)){` → `if(!f.t.sealed&&/mismatch/.test(f.error)){` (+13)
- byte offset on line 166: `typeof ResizeObserver=='function'` → `typeof ResizeObserver<'u'` (−8; same behaviour)

R1 and R2 together give 24,780 B (1 B spare). Results with `patched/module-F-fix.js`:
- E-partcount-float is rejected again.
- TAMPER gives `FAIL … index mismatch: sha256` in both harnesses, the same as E.
- The skew sets stay PARTIAL "archive updating".
- Every other output is identical to F: time ×4 TZ, S0–S11, 104 probes, flaky 68/68, DC.
- Suites: designer test-fixes 69/69, repro 9/9, test-fixes 49/49, ChatGPT 8/8.
- Diff: `patched/fix.diff`; builder: `patched/make.mjs`.

### R3 (OWNER_DECISION, not a regression): E06 future-dated index
F now marks it STALE, but the line still reads "(<1 min ago …)". Fix in `AGO` on line 17: `return m<1?'<1 min'` → `return m<0?'?':m<1?'<1 min'` (**+8 B**), which reads "(? ago …) · STALE". Verified: E06 PASS (`time/runs/fixfuture-UTC.log`). Combined with R1+R2 the module is 24,788 B, 7 B over the cap. This needs 7 B of trims or a cap decision.

## Info
- raw.githubusercontent ignores `?query` (data-contract-E cdn-probe), so F2's cache-busted refetch normally returns the same CDN object. The PARTIAL "updating" downgrade does the useful work.
- `cv` subtracts lost-day coverage once per scan window. With overlapping windows on a lost day this can over-subtract. It is only reachable with an overlapping index, and no case covers it.
- The proof checks the byte cap only. The lead must regenerate the cartridge, proof hashes and manifest after any patch.
