# opus-matrix-aggregator: tooling for issue #32 §12 B, C and F

**Harness:** self. Node v22.23.4 with static markdown parsing; no browser and no network.
**Pins:** candidate fda6b10 (module sha256 3ce0ddc1…, unchanged). The wt checkout is at 35fbceb, which adds docs only.
**Folder:** `evidence/opus-matrix-aggregator/`

## What this lane built

**`aggregate.mjs`** merges `reports/*.md` into a copy of TEST-MATRIX.json.
- Writes only to `--out`. Without `--out` it does a dry run, and it refuses to overwrite its input.
- Parses three kinds of source:
  - table rows, using the column headed Status, Result or Verdict;
  - decision tables;
  - bullet and "ID: STATUS" lines.
- Ignores `[FAIL]` and `code` spans, and count uses such as "FAIL 7/PASS 20".
- Records every source lane with file:line and the raw text. The policy is printed into the output JSON.
- Self-test on SYNTHETIC inputs: `selftest/`.

**Merged output (five reports)** is in `TEST-MATRIX.merged.json`, with the log in `aggregate-run-5reports.txt`. Counts:
- PASS 14
- FAIL 7
- BLOCKED_DEPENDENCY 4
- OWNER_DECISION 5
- NOT_TESTED 31

`opus-release-rollback.md` yields no result rows; it has prose only. The input matrix has no duplicate IDs; the earlier V1/V15 defect is gone.

**Conservative merges to check:**
- pr2-data-verifier gives D18 as PASS, but the merge records BLOCKED_DEPENDENCY because the same cell names a BLOCKED part.
- The decision table gives V2 as NOT_TESTED, but the merge records BLOCKED_DEPENDENCY for the same reason.

**Templates:**
- `CLAUDE-CANDIDATE-HARDENING.template.md` covers issues HC-01 to HC-17. Fix and after fields are TODO.
- `OWNER-REVIEW.sections.draft.md` contains 24 real screenshot triplets from lane B's raw run (not yet adjudicated), the unresolved differences and owner questions Q7 to Q12.

**Unknowns:**
- origin/main is now 3c5717e, which published the candidate route. This lane has not verified whether `current.json` and `STATE.md` are untouched.
- Which overlay ceiling governs is unresolved: 24,000 or 24,781 bytes.
