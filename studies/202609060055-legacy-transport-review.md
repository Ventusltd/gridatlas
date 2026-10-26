# Legacy transport composition review

Baseline: GridAtlas805b4b1, generation202609051624, v9.138. Question: can the old verify-live workflow silently remove substation-intelligence and sld-sandbox?

The current builder returns ALREADY_BUILT because transport already exists. Its postprocessor then attempts to read a newly named cartridge that the early return never generated. The claimed single-dispatch loss is not reproduced for this current composition. No deployment workflow was invoked to test that destructive hypothesis.

A narrower hazard is real: the unbuilt path constructs both registry and order from transport and search only. A baseline with search plus additional cartridges but no transport would lose those additional entries. The new guard accepts only the original search-only input or original completed transport/search order, checks registry parity and uniqueness, and refuses later compositions before writing a report or any source. Future compositions must use the current promotion lane.

Six local regression tests pass, including exact before/after file-byte comparison on refusal of the real current manifest. The existing cartridge-proof CI now runs these tests and watches tools/v9_5. Application cartridges and current.json are unchanged; this is not a new application release or browser acceptance claim.

Independent pre-existing scope blockers: the active workflow allowlist has six entries but seven workflows exist, including teleprint-parse-gate.yml. Temporarily registering that existing detector exposed the next failure: substation-intelligence exceeds400kB. The temporary allowlist edit was reverted; limits were not weakened. STATE.md regeneration is blocked by the same lint failure and its existing generation is stale. These require separately reviewed owner work before this candidate can be treated as fully green.

Local evidence: C:/Users/vikra/OneDrive/Desktop/offline-screenshots/legacy-composition-review-202609060055. Baseline builder output, source identity, six regression results, scope-lint failure and state failure retained. No raw app downloads or screenshots committed.

Next: reconcile the existing workflow register, then audit assembled substation parts and the intended400kB boundary before choosing an extraction. Do not raise the limit just to make CI green. Rollback for this guard is its single commit; it does not move the live composition.
