# Security lane E: generation 202610270024 (variant E, v9.162), node only

**Target:** `wt/atlas/modules/202610270024-uk-lightning-overlay.js`, 24,780 B, sha256 2976cae7…90bf. The hash is in `evidence/security-E/logs/module.sha256`.

**Harness:** node:vm, minidom, fake clock 2026-10-26T18:40Z, desktop at 1440 px, 24-hour window. No Chromium was started.

**Fixtures:** all are SYNTHETIC. The S-cases use the interim lane's fixtures, copied unchanged to `evidence/security-E/fixtures/`. The probes mutate the lead's real `lightning-archive` fixture in memory.

**Harness note (BLOCKED_HARNESS, not a module defect):**
- The interim `node-harness.mjs`, run unchanged, throws `ReferenceError: addEventListener is not defined` at module line 181. That line is new in E and uses the bare globals `addEventListener` and `innerHeight`, which a browser provides. The log is `logs/00-unchanged-harness.log`.
- `node-harness-E.mjs` is the same harness with those two sandbox globals added, plus a different output filename. Nothing else differs, and every case ran unchanged with it.

All paths below are relative to `hardening/evidence/security-E/`.

## Results table

| ID | status | evidence path | command |
|---|---|---|---|
| S0 baseline (real fixture) | PASS: same as the interim run (PARTIAL detail, 2 requests) | node-runs/E-S0.json | `node node-harness-E.mjs $MOD S0` |
| S1 XSS in feed fields | PASS: 0 data reaches innerHTML | node-runs/E-S1.json | same, S1 |
| S2 XSS in index schema | PASS: rejected by the schema check, shown as text | node-runs/E-S2.json | same, S2 |
| S3 prototype keys | PASS: Object.prototype unchanged | node-runs/E-S3.json | same, S3 |
| S4a count 1e999 | PASS (was FAIL-low): row rejected, "archive unavailable: invalid index row 2026-10-25: count" | node-runs/E-S4a.json | same, S4a |
| S4b count "03" / true | PASS (was FAIL-low): row rejected | node-runs/E-S4b.json | same, S4b |
| S4c extreme header values | PASS | node-runs/E-S4c.json | same, S4c |
| S5 parts traversal | PASS (was FAIL): 0 requests off the allowed path, row rejected | node-runs/E-S5.json | same, S5 |
| S6 20,000-part flood (fixture) | PASS (was FAIL): parts > 24 rejected, 2 requests in total. **The cap can still be bypassed; see D-dup (FAIL F-B).** | node-runs/E-S6.json | same, S6 |
| S7 1.2 M-row index | PASS: 10.6 s, 196 MB heap (interim: 30.8 s) | node-runs/E-S7.json | same, S7 |
| S8 250 k scan_windows | Crash fixed. **FAIL F-C**: status reads "SEARCHED 100% · 250004 successful runs" when the true coverage is 42%, alongside "Not yet ingested 5h 40min" | node-runs/E-S8.json | same, S8 |
| S9 300 k-point feed | OWNER_DECISION, unchanged from interim: the feed has no point budget (21.7 s in node, 197 MB, clustered) | node-runs/E-S9.json | same, S9 |
| S10 1 M-coordinate feature | PASS (was FAIL): 50 drawn, "1 malformed records rejected" | node-runs/E-S10.json | same, S10 |
| S10b id-less features | PASS (was FAIL): 50 of 50 drawn (interim: 21) | node-runs/E-S10b.json | same, S10b |
| S11 click props | PASS | node-runs/E-S11.json | same, S11 |
| A row.path allow-list, 27 variants | PASS: all 25 hostile variants rejected (see below). `["days/2026/10/25.json"]` is accepted but builds the identical URL. A path naming another date is fetched but rejected by the `metadata.date_utc` check | node-runs/probes-E.json (A-*) | `node probes.mjs $MOD out.json '^A-'` |
| B parts path allow-list, 11 variants | PASS: same pattern as A | probes-E.json (B-*) | `'^B-'` |
| C parts caps | PASS: 24 accepted; 25, array-like, string, `[null]` and `[]` with count > 0 rejected | probes-E.json (C-*) | `'^C-'` |
| D dedupe of index dates | **FAIL F-B**: duplicate rows with the same date are all loaded. 31 rows × 24 parts gave 590 requests; 1,000 `path` rows gave 1,001 requests. The archived sum is also counted once per duplicate | probes-E.json (D-dup-*) | `'^D-'` |
| D aliased dates | Residual (low): `2026-02-30` is accepted, because V8 rolls it over to 03-02. That lets one window date carry at most 2 rows. `2026-10-32` is accepted but parses to NaN, so it is never used | probes-E.json (D-alias-*) | `'^D-alias'` |
| E row count coercion | PASS: "3", true, 1e999, 3.5, −1, 2^53, "0x3", null on a full row, and [3] all rejected. −0 and 3e0 are accepted (numerically equal, harmless) | probes-E.json (E-rowcount-*) | `'^E-row'` |
| E part count coercion | **FAIL F-A**: a negative part count passes `Number.isSafeInteger`. One part with count −10,000,000 cancels a 10,000,000-flash row, so the budget and LOAD POINTS consent are skipped and the 10 M day file is fetched. The control case without the negative part does show the consent prompt | probes-E.json (E-partcount-negative-budget-bypass, E-control-budget-no-negative) | `'^E-(part\|control)'` |
| E zero part counts | Residual (OWNER_DECISION): count 0 parts pass and add nothing to the budget. After the fix this is bounded at 32 dates × 24 = 768 requests per load. Optional: reject 0 with `(p.count>>>0\|\|.5)===p.count` (+6 B) | probes-E.json (E-partcount-zero-x24) | `'^E-partcount-zero'` |
| E part hour coercion | PASS on security; a data-honesty note. Hour `"x"` or −100 means the part is never fetched and is not reported as a failure, but a valid index can understate counts the same way | probes-E.json (E-parthour-*) | `'^E-parthour'` |
| E scanned_seconds "1" / true, sealed "true" | Cosmetic: scanned_seconds is coerced; sealed is rejected | probes-E.json | `'^E-(scanned\|sealed)'` |
| F index schema | PASS: trailing space, upper case, v1, v3, missing, array, null, zero-width space and a `__proto__`-only schema are all rejected; the observation sentence and days are checked strictly | probes-E.json (F-schema-*, F-observation-*, F-days-*) | `'^F-'` |
| F feed observation_kind | PASS: only the exact value is accepted (`["optical_lightning_flash"]` stringifies to it, which is harmless) | probes-E.json (F-feed-kind-*) | `'^F-feed'` |
| G prototype keys in rows and parts | PASS: no pollution; a `path` that exists only on the prototype is rejected | probes-E.json (G-*) | `'^G-'` |
| H feed dedupe keys | PASS: 14 features become 9, as expected. ids 0 and −0 collapse together (negligible); an id cannot collide with an id-less key | probes-E.json (H-*) | `'^H-'` |
| I overlapping scan_windows | **FAIL F-C**: listing every window twice raises coverage from 42% to 85% and runs from 4 to 8 | node-runs/probes-E-I.json | `'^I-'` |

## FAILs and minimal fixes

All three fixes are applied in `patched/module-E-secfix.js` (diff: `patched/secfix.diff`, bytes: `patched/bytes.txt`). Together they take the module from 24,780 B to **24,773 B (−7 B; cap 24,781)**.

**F-A (defect): a negative part count bypasses the budget and consent gate.**
- Location: line 36, `Number.isSafeInteger(p.count)`. The gate itself is at lines 82–83.
- Fix: `p.count>>>0===p.count`. This costs −8 B and rejects negatives, non-integers and strings.
- Byte donor: line 34 has the same weakness in a form that happens to be safe. `!(Number.isSafeInteger(n)&&n>=0)` → `n>>>0!==n` behaves the same and costs −23 B.

**F-B (defect): duplicate dates in the index multiply requests and the archived count.**
- This also makes the dropped S6 per-load cap reachable again.
- Location: line 78, `rows=x.days.filter(`.
- Fix: `rows=[...x.by.values()].filter(`. This costs +12 B; the existing Map keeps the last row for each date.

**F-C (defect, low): overlapping scan_windows over-state "Searched %".**
- Location: line 50, `const o=ov(ws,we,w.s,w.e)`.
- Fix: `const o=ov(Math.max(ws,b),we,w.s,w.e)`. This costs +12 B. The windows are already sorted by start, and `b` is the running end of the union, so this computes the union.
- After the fix, S8 reads "42% · 5 runs".

**Verification of the patched module:**
- All probes give the same result except the three FAILs, which are fixed: 590 → 20 requests, 1,001 → 2 requests, the negative-count index is rejected, and coverage reads 42% (`logs/07-diff-E-vs-secfix.txt`).
- The S-cases are unchanged apart from S8, which is now correct (`logs/08-rerun-secfix.log`).
- `test-fixes.mjs` passes 49/49 and the ChatGPT 4f9bcdf suite passes 8/8, on both E and the patched module (`logs/04-suites-E-vs-patched.log`).

## OWNER_DECISION
- S9: the live feed has no point budget.
- Requests per load are bounded at 768 when zero-count parts are allowed.
- Aliased dates such as 2026-02-30 are accepted. The cheapest fix is to replace `DRE.test(r.date)` with `ymd(ds(r.date))==r.date` on line 33 (+8 B).
