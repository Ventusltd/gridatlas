# t8-amendment — T8b (interim, 00:12 UTC)

202610261949 is done and FAILs, as required. Every run on the hardened generations has ended with a renderer killed by the memcg OOM killer. The shared 6.27 GB memcg is full of other lanes' browsers: the oom_kill counter rose from 0 to 47 during my attempts, and the killed renderers were 160–275 MB each. Retries are continuing.

| ID | status | evidence path | command |
|---|---|---|---|
| T8b @ 202610261949 | FAIL (expected) | evidence/t8-amendment/runs/202610261949/ | `node t8b.browser.mjs --gen 202610261949 --base http://127.0.0.1:8179/wt` |
| T8b @ 202610262310 | BLOCKED (OOM; p393 PASS in a partial run, see run-202610262310.attempt-crashed-1.txt) | evidence/t8-amendment/ | `chain.sh 202610262310 N` |
| T8b @ 202610262318 | BLOCKED (OOM) | evidence/t8-amendment/ | `chain.sh 202610262318 N` |
| T8b @ 202610262323 | BLOCKED (OOM, attempts r1–r5) | evidence/t8-amendment/attempts.log | `chain.sh 202610262323 N` |
