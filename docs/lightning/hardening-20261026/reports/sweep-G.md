# sweep-G: sweep-F harnesses rerun on generation 202610270113 (variant G), node only

**Target:** G = `wt/atlas/modules/202610270113-uk-lightning-overlay.js`, 24,777 B, sha256 d17d3035…9d27df, byte-identical to `opus-fix-designer/fixed-module-G.202610270113.js`. F = `202610270047`, 24,773 B, 421f3d7e…b45f. Both were run in this session with the same harness copies (`evidence/sweep-G/`, copied from `evidence/sweep-F/` and `evidence/code-review-F/`). No Chromium was started. All data are SYNTHETIC except the data-contract real/collector sets.

**Harness deviations (vs sweep-F):**
1. **Data-contract stub fix (as ordered).** `dc/scripts/run-real-E.mjs` line 23 now strips `?query` before serving, so the cache-busted `index.json?<ms>` refetch is served the same object, as raw.githubusercontent does. The file is now identical to sweep-F's `run-real-E.qtol.mjs`. The original is kept as `run-real-E.orig.mjs`. Result: 0 "HTTP 404" fallbacks in the skew sets (sweep-F had 14 on F).
2. ChatGPT suite reads `LIGHTNING_MODULE`, not `MODULE`.
3. The designer REST test reads `./fixed-module-F.js`, so I copied it in. It differs from 421f…b45f only in the GEN stamp. A second run against the real F (`designer/test-fixes.restF.mjs`) also PASSES.

## Results (F → G)

| ID | F → G | evidence (evidence/sweep-G/…) | command |
|---|---|---|---|
| time T01–T11, T13–T15, T12a, E01–E05 (×4 TZ) | PASS → PASS (21/22 per TZ on G) | time/runs/{F,G}/*.log | `sh time/run.sh <mod> runs/<v>` |
| time T12 (original) | FAIL → FAIL (superseded by T12a, unchanged since E; not a module defect) | same | same |
| **time E06** future-dated index | **FAIL → PASS** ("? ago", all 4 TZ) | same | same |
| sec S0–S11 (15 cases) | PASS → PASS; status, requests, off-path, html, proto, drawn and errors identical. Wording only: Actual reads "none seen in the 7-day feed (unknown, not zero)" | security/logs/S-{F,G}.log, security/cmpS-F-G.txt | `node node-harness-E.mjs <mod> S0 … S11` |
| sec S9 feed point budget | OWNER_DECISION (unchanged) | same | same |
| sec probes (104) | 103 identical | security/logs/probes-{F,G}.log | `node probes.mjs <mod> out.json` |
| **sec E-partcount-float (R1)** | **FAIL → PASS** (acc false, "invalid index row 2026-10-26: parts", 0 day requests) | same | same |
| flaky FNE-01…14 (68 cases) | PASS → PASS: 68/68 recovered, 0 stale-as-fresh, 0 zero hits, 0 throws; G ×3 runs all 68/68 | flaky/run-{F,G}.log, rep-G-{2,3}.log | `MODULE=<mod> node flaky-network-E.node.mjs --out <dir>` |
| FNE-16 real browser | BLOCKED_HARNESS (node only) | — | — |
| DC E01–E09, E11, E12, E14 (10 real sets) | PASS → PASS (status lines identical apart from the C01 period-label wording, see REG-1) | dc/{F,G}/node/SUMMARY.txt | `bash dc/run.sh <v> <mod>` |
| **DC E10 TAMPER sha on SEALED shard (R2)** | **FAIL → PASS**: 7d, 30d and custom read `FAIL · 1 of 5 day files failed`, "2026-10-24 index mismatch: sha256", the same as E. F read PARTIAL "archive updating" | same | same |
| DC E13 CDN skew ×3 (fixed stub) | PASS → PASS: PARTIAL, never FAIL, no feed fallback. G reads "SEARCHED UNKNOWN" and "<date> index mismatch: count, bytes, sha256; archive updating, reload later" (intended T10/CRF-3b/3c). F read "SEARCHED n%" and "retrying next refresh" | dc/{F,G}/node-skew, *-rerun | same |
| DC skew harness flake | The first F run had one "custom 2026-10-23 only" line stuck at LOADING (a settle timing issue under parallel load). The rerun gave PARTIAL. G was clean in both runs | dc/F/node-skew vs node-skew-rerun | — |
| CR-E repro E1–E7, CHK (9) | 9/9 → 9/9 (G ×3) | cr/repro-E-{F,G}.log | `MODULE=<mod> node --test repro-E.mjs` |
| CR CR1–CR6 test-fixes 49 | 49/49 → **48/49 (M02, REG-1)** | cr/tf-{F,G}.log | `MODULE=<mod> node --test test-fixes.mjs` |
| sec-E test-fixes 49 | 48/49 (CR6 flake; rerun 49/49) → **48/49 (M02, REG-1)** ×4 | suites-secE/tf-*.log | same |
| ChatGPT 4f9bcdf (×3 copies) | 8/8 → 8/8 | {cr,designer,suites-secE}/cg-{F,G}.log | `LIGHTNING_MODULE=<mod> node --test chatgpt-latest.test.mjs` |
| designer test-fixes 75 | 69/75 (R1, R2, T10, E06, I01 fail as designed; plus a CR6 flake) → **75/75** (×3) | designer/tf-{F,G}*.log | `MODULE=<mod> node --test test-fixes.mjs` |
| CR-F suite copy 69 | 69/69 → **67/69**: M02 (REG-1) and F2 (literal "retrying next refresh"; the new text is "reload later" = CRF-3c, see REG-2) | cr-F/suite-{F,G}.log | `MODULE=<mod> node --test test-fixes.copy.mjs` |
| CRF-1 part count 0.5 | **FAIL → PASS** | cr-F/repro-F-{F,G}.log #1 | `MODULE=<mod> node --test repro-F.mjs` |
| CRF-2 / CRF-2b lost day under overlapping windows | **FAIL → FAIL** (LOW; the designer dropped it for bytes, and the real fixtures have no overlapping windows) | #2, #16 | same |
| CRF-3 bounded refetch, CRF-4 redirects, CRF-5b, 5c, 6c | PASS → PASS | #3, #7, #9, #10, #13 | same |
| CRF-3b "gaps in window" reason | **FAIL → PASS** | #4 | same |
| CRF-3c "retrying next refresh" false after PREV | OWNER_DECISION → PASS ("reload later") | #5 | same |
| CRF-3d, 5a, 6b, 8 | INFO → INFO (unchanged) | #6, #8, #12, #15 | same |
| CRF-6a, CRF-7 | OWNER_DECISION → OWNER_DECISION (unchanged) | #11, #14 | same |

## Verdict

R1, R2 and E06 now pass, and so do CRF-1, CRF-3b and CRF-3c. Behaviour is identical to F everywhere else: time, S0–S11, 103 of 104 probes, flaky 68/68 and the DC real sets.

Not every earlier FAIL passes:
- **CRF-2/2b** is still FAIL (LOW, dropped knowingly in G-progress.md; a fix costs +26 B and there is no room under the cap).
- **time T12 (original)** is still FAIL, as it has been since E (superseded by T12a, which passes).

## Regressions vs F

**REG-1 (cosmetic, deliberate).** The 12M period label went back from "12 months" to "1 year" (the C01 revert in G-progress, used to fund I01). It fails M02 in three of the older suites (cr/tf, sec-E/tf, the CR-F copy). The designer's own suite was changed to read the label from the window, so it passes. It also reopens copy-consistency CC06: chip "12M", caption "1 year".

**Fix: +3 B, fits.**
- On line 11, change `['12m','1 year',-12]` to `['12m','12 months',-12]`, which gives 24,780 B, within the 24,781 B cap.
- Verified in `patched/module-G-C01.js` (sha 781d8920…):
  - cr/tf 49/49, sec-E/tf 49/49, designer 75/75, ChatGPT 8/8
  - time: identical to G (E06 PASS)
  - CR-F copy 68/69 (only F2 fails, on the text, see REG-2)
- Diff: `patched/C01.diff`. After any patch, the lead must regenerate the cartridge, the proof hashes and the manifest.

**REG-2 (expected text change, not a defect).** The CR-F copy of F2 asserts the literal "retrying next refresh". G says "reload later", which is the CRF-3c owner-decision wording that G adopted. The designer suite accepts both. Treat as PASS if the owner accepts "reload later".

**Intended, more conservative:** while day files are unverified, the status reads SEARCHED UNKNOWN instead of SEARCHED n% (T10/CRF-3b). Several captions are shorter, and each still keeps "unknown, not zero".
