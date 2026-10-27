# veto-pre-1 — V1–V15 on generation 202610262323 (IN PROGRESS, checkpoint 00:12 UTC)

Worktree HEAD 5929c56 (candidate files unchanged since baf4e58). Prod clone c08f3a6 gen 202609241334. main now 199ea45 (owner merged PR #35 = 202610262323 preview route, blobs identical to WT; live pointer unchanged).
Host load average ~68 on 2 CPUs (≈15 lanes running Chromium): browser runs crash/time out repeatedly.

| ID | status (provisional) | evidence | command |
|---|---|---|---|
| V1 | PASS | V1-redo.txt | sha256sum -c; cmp WT vs PROD |
| V2 | PASS (static + desktop ON snapshot) | static-checks.txt; interact-run2-vp/veto-interact.json | grep; veto-interact.mjs |
| V3 | PASS (owner-ratified v/ loader copy) | static-checks.txt; V13-main-2323-blobs.txt | cmp; gh api |
| V4 | desktop PASS OFF+ON; phones pending | interact-run2-vp | veto-interact.mjs |
| V8 | About attribution absent → FAIL candidate | module source | grep |
| V9 | "Flashes 0 in window" with archive 404 → FAIL candidate | interact-run2-vp on24h caps | veto-interact.mjs |
| V12 | PASS | V11-V12-node.log, V12-V13-recheck.txt | loop.mjs lint/state |
| V13 | PASS | V12-V13-recheck.txt, V13-main-moved-2.txt | gh api |
| V14 | PASS | static-checks.txt | grep |
| V6, V11 | pending; host cgroup OOM-kills Chromium renderers (dmesg), 4 desktop runs killed at the 7d draw step | dmesg; focus-desktop.log | |
| others | pending | | |
