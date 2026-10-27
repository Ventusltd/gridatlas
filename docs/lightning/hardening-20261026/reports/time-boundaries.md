# time-boundaries lane (interim 00:10 UTC 27 Oct; browser runs in progress)
node:vm cross-check (real module source, controlled Date, process TZ = London/UTC/New York/Kolkata, SYNTHETIC fixtures): evidence/time-boundaries/runs/vm/*.log
| ID | status (vm, 4 TZ) | evidence path | command |
|---|---|---|---|
| T01-T07, T09, T10 | PASS | runs/vm/ | TZ=<tz> node time-boundaries.vm.mjs --module wt/atlas/modules/202610262323-uk-lightning-overlay.js |
| T08 3M/12M NEXT | FAIL (line 167, NEXT uses w.e+w.span) | runs/vm/ | same |
| T11 feed w/o query_end_utc not STALE | FAIL (line 46/97) | runs/vm/ | same |
| T12 sub-minute gap "0h 0min" | FAIL (line 18 AGO round) | runs/vm/ | same |
| T13 zone-less time_utc shifts with TZ | FAIL non-UTC TZ (line 20 tm) | runs/vm/ | same |
| T14 30D 40-min tail shows 100%/READY | FAIL (lines 95, 117) | runs/vm/ | same |
| T15 CUSTOM at 00:00:00.000 inverted caption | FAIL (line 55/100) | runs/vm/ | same |
| Browser (Playwright) | IN PROGRESS / host OOM | runs/r* | run.sh |
