# Lane deeplinks — INTERIM (00:07 UTC 27 Oct, restart checkpoint)

Status: static inventory done; browser runs in progress (serial; parallel runs starved the 2-CPU sandbox).

| ID | status | evidence path | command |
|---|---|---|---|
| DL-S1 static contract inventory (original) | PASS (inventory) | evidence/deeplinks/static-api-hits.txt | grep (see report) |
| DL-S2 lightning module adds no URL/storage API | PASS | evidence/deeplinks/static-bytes.txt | grep module |
| DL-B* browser deep links / history / share / storage | NOT_TESTED (running) | evidence/deeplinks/runs/ | ./run.sh --cases=... |
