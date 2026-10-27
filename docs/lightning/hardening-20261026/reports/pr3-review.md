# pr3-review (interim, 00:08 UTC 27 Oct) — Ventusltd/lightning PR #3 @ d4caf9e

Interim table; final version follows.

| ID | status | evidence path | command |
|---|---|---|---|
| T0 existing unittest (78) | PASS | evidence/pr3-review/run-unittest.txt | python -m unittest discover -s tests -v |
| T0 node tests (24) | PASS | evidence/pr3-review/run-node.txt | node --test tests/test_history_window.mjs |
| D1/D2 determinism | PASS | evidence/pr3-review/run-adversarial.txt | adversarial_test D1 D2 |
| Z1 zero searched hours -> proximity 0 | FAIL | evidence/pr3-review/run-z1-probe.txt | z1_probe.py |
| E1 episode edge over shard_lost day | FAIL | evidence/pr3-review/run-adversarial.txt | adversarial_test E1 |
| V1-V6 verifier gaps (tamper + refreshed manifest passes verify) | FAIL x6 | evidence/pr3-review/run-adv-real.txt | adversarial_test.Real |
| S1 day scanned_seconds vs sum(hourly) off by 1 s | WARN | evidence/pr3-review/run-adv-real.txt | adversarial_test S1 |
| T1/T2 lightning.duckdb reopened in non-UTC session buckets by local TZ | FAIL (analyst file only) | evidence/pr3-review/run-adv-real.txt | adversarial_test T1 T2 |
| Patches 0001 Z1, 0002 E1, 0003 V1-V6 committed in evidence wt (2c7d93e, 36ec278, abb4fed) | done, suites pending | evidence/pr3-review/run-v-messages-patched.txt | WT=wt python3 v_messages.py |
| TZ patch + distance cross-check | running | — | — |
| W workflow push failure | PASS (warn) | evidence/pr3-review/wfsim/sim-output.txt | bash wfsim/sim.sh |
| L licence/NOTICE | PASS | — | sha256sum LICENSE |
