# Security lane — 202610262323 lightning module (INTERIM 00:10 UTC, after restart)
Node harness (real module bytes, minidom, fake clock) done for S0–S6, S8, S10, S10b, S11: node-runs/*.json. Browser runs under shim BLOCKED by cgroup OOM kills (dmesg) — retrying.
| ID | status | evidence | 
|---|---|---|
| XSS S1/S2/S11 | PASS (no data reaches innerHTML; payload shown as text) | node-runs/S0_S1_S2_S3.json |
| Proto S3 | PASS | same |
| Parts traversal S5 | FAIL (3 requests to other repos on raw.githubusercontent.com) | node-runs/S4a_...json |
| Parts flood S6 | FAIL (20,002 requests, 127 s) | same |
| scan_windows spread S8 | FAIL (archive rejected, falls to feed) | same |
| Feed coords spread S10 | FAIL (whole feed FAIL) | same |
| id-less collapse S10b | FAIL (29 of 50 dropped) | same |
| count types S4a/S4b | FAIL-low (∞, "03") | same |
