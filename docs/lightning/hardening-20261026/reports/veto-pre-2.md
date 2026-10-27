# veto-pre-2 — adversarial release review of 202610262323 (lightning OFF), CHECKPOINT 00:05 UTC

Status: IN PROGRESS. Static items done. Browser runs are being starved (load avg 74–92 on 2 CPUs; renderer crashes in baseline too).

| ID | status | evidence | command |
|---|---|---|---|
| V1 | PASS | evidence/veto-pre-2/v1-sha256-check.txt | sha256sum -c baseline manifest in wt |
| V2 static | PASS | evidence/veto-pre-2/v2-v4-v5-module-static.txt | grep module |
| V3 | PASS (static) | evidence/veto-pre-2/static-checks.txt | git diff --name-status c08f3a6..HEAD |
| V11 static | PASS | evidence/veto-pre-2/v11-v12-static.log | run-current.mjs, generation proof |
| V12 | PASS (note: preview workflow deleted) | evidence/veto-pre-2/v11-v12-static.log | loop.mjs lint/state |
| V14 | PASS | evidence/veto-pre-2/static-checks.txt | grep |
| fault probes | RUNNING | evidence/veto-pre-2/fault-desk/ | fault-probe.mjs |
