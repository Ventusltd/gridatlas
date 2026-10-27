# long-session lane (interim, 00:02 UTC 27 Oct) — generation 202610262323, shim, port 8175

Status: IN PROGRESS. Host load average ~70-80 (many lanes' Chromium). Full single-page run hit a 30 s click timeout on the first toggle (run-candidate-timeout1.stdout.txt); previous incarnation saw one renderer crash at ON->7D that did not reproduce (repro-r2-3.log). Now running in per-phase chunks (A refresh, B toggles, C chips), each under 10 min wall, with 120 s action timeouts.

| ID | status | evidence path | command |
|---|---|---|---|
| LS-A refresh x18 | running | evidence/long-session/cand-A/ | run.sh candidate cand-A A |
| LS-B toggles x50 | NOT_TESTED | | |
| LS-C chips x30 | NOT_TESTED | | |
| LS-base baseline | NOT_TESTED | | |
