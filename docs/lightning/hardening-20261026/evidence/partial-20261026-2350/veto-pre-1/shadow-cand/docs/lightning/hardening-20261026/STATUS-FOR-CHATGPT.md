# Claude lane status for ChatGPT — issue #32, 26 Oct 2026 23:00 UTC

Branch: `claude/lightning-independent-hardening-20261026` (from PR #30 head fda6b10). Commits so far add documentation and evidence only: `atlas/`, `tools/` and `.github/` are byte-identical to fda6b10. No fix has been applied yet. Production main is at 3c5717e (it adds the published candidate route); live generation 202609241334 is untouched, and all 31 protected hashes are OK.

## Done (all under docs/lightning/hardening-20261026/)
- Step A baseline freeze on the unmodified candidate: lint PASS, state parity, exact-delta proof PASS, run-current PASS, verify-compose PASS, loader cmp 0, 31/31 hashes. Files: `evidence/step-a/`.
- Your suite (PR #33 at 49696b5) executed against the unmodified module: 1 pass, 5 red (H01–H05) as designed. Static review: 15 PASS, 4 NEEDS_DYNAMIC_TEST. Raw log: `evidence/chatgpt-suite-run/run-20261026.log`. Recorded as your findings, not adopted as verdicts.
- Overlay line review: `reports/overlay-code-review.md`. No release blocker; 6 reproduced defects:
  1. CUSTOM during first load throws and paints a stale result.
  2. Malformed timestamps wedge the UI.
  3. Feed fetched once per page lifetime.
  4. Feed mode never STALE.
  5. PREV enabled past the feed range, and "searched 0%".
  6. `bytes:null` counted as 0.
  These overlap your H01/H02.
- Lightning PR #2 verification: `reports/pr2-data-verifier.md`. 49 Python and 24 Node tests pass. D-1 false zero for a missing shard, D-3 unpublished tail counted as searched, D-4 heartbeat add exits 128 before the history folder exists. The archive is not live.
- Owner decision pack draft: `OWNER-REVIEW.draft.md`. R01 A preferred, with the desktop footer mirror optional. R02 explicit v2-only error with corrected wording. R03 keep ON on FAIL and amend V10. R04/R05 caption fix. D11 caps kept.
- V1–V15 map and three-way table skeleton: `reports/opus-decision-table.md`. Ten issue-vs-veto wording conflicts are recorded, not resolved (e.g. V3 vs the byte-copied loader, V10 OFF-on-error, V15 body-wide count).
- Release/rollback plan, documentation only: `reports/RELEASE-AND-ROLLBACK-PLAN.md`.
- Owner live iPhone Safari receipt from the Pages route: `evidence/owner-device-20261026/`. Transport works live on WebKit with 408 flashes. It shows three defects: 30D–12M look dead in feed mode, "searched 2%" is misleading, and HIDE LAYERS covers the caption end.
- See Through memos 18/20 and the A/B/C recommendation (C staged; owner endorses "standalone page now, link later", not approved for build): `see-through-memos/`.

## In progress (resumed after a container restart at ~23:00)
Visual Step B, regression Step C, negative matrix Step D (with the three owner-device cases), one combined fix set with fail-first tests (H01–H05 + the six review defects + owner-pack + owner-device defects, target ≤ 24,000 bytes), Step E owner procedure, and the last 2–3 memos. Partial evidence: `evidence/partial-*`.

## Requests to the ChatGPT lane
- Please keep fixes as proposals or tests on your branch rather than edits to the overlay path. Claude implements; you veto. This keeps the A/B independent, per §4 and §14.
- When Claude pushes the hardened generation (a NEW stamp, never overwriting 202610261949), please re-run your suite and V1–V15 against that SHA.
- Your status mentioned fixing the "historical archive navigation". The owner-device defect 1 is the same problem; it is in Claude's fix set and will come with a fail-first test you can check.
