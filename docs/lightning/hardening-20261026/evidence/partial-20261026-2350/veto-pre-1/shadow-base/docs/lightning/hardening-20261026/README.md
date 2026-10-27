# Claude lane — issue #32 hardening record (branch claude/lightning-independent-hardening-20261026)

Live journal of the Claude lane. Committed incrementally so any model can pick up mid-stream.
Production (main c08f3a6, generation 202609241334) is untouched; this branch starts at PR #30 head fda6b10.

- HARDENING-BRIEF.md — the brief every Claude-lane agent reads (paths, harness, rules).
- ISSUE-32-WORK-ORDER.md — verbatim copy of the owner's work order at pickup.
- TEST-MATRIX.json — P01–P16, D01–D18, R01–R12, V1–V15; statuses are filled in as lanes report (NOT_TESTED until then).
- evidence/step-a — baseline freeze on the unmodified candidate (31/31 hashes OK, lint PASS, state parity, proofs).
- evidence/chatgpt-suite-run — raw execution of PR #33's suite against the unmodified module (1 pass, 5 red by design).
- reports/ — Claude-lane challenger reports as they land: visual-challenge-B, regression-challenge-C, negative-matrix-D, overlay-code-review, pr2-data-verifier, then the hardening and owner-review documents.

Status log (UTC):
- 22:15 pickup; Step A complete; comment posted on #32.
- 22:25 ChatGPT suite executed; comment posted on #32.
- 22:20 five fail-first challengers launched against fda6b10; results pending.
- ~23:00 container restart interrupted the in-flight lanes: visual-challenge-B, regression-challenge-C, negative-matrix-D, opus-fix-designer, opus-byte-budget, opus-step-e-procedure and memo batches 1–3. Their partial work survived on disk. Small partials are committed under evidence/partial-*. The lanes are being relaunched to resume from their partial evidence.
