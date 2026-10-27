# performance lane — INTERIM (00:12 UTC 27 Oct)
Chromium emulation (Playwright Chromium 153 headless, SwiftShader GL, isMobile/hasTouch) — not WebKit, not real devices.
Evidence: hardening/evidence/performance/ . Runs in progress.

| ID | status | evidence path | command |
|---|---|---|---|
| P1 boot cand 393x852@4x | measured: menu 8.5 s, 0 lightning requests, heap 17.95 MB | runs/boot-cand-393x852-cpu4x.json | ./run.sh <log> boot cand 393x852 4 <out> |
| P2 toggle | BLOCKED_ENVIRONMENT so far: renderer OOM-killed (dmesg memcg oom-kill, load avg ~80 on 2 cores, ~20 concurrent lanes) | runs/toggle-P408-393x852-cpu4x.json | ./run.sh <log> toggle cand 393x852 4 <out> fixtures/P408/data |
