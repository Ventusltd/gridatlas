# DC-B3 (Team B, node): Grid Engine 30/30/30 feasibility. DONE.
The deliverable is evidence/DC-B3/ENGINE.md, with bench.mjs/results.json and bench2.mjs/results2.json beside it. No code was changed and there was no PR.

**Engine reuse**
- The original `nearestSubstations` is hard-capped at 5 links within 40 km. Its constants are closure consts, so it cannot return 30.
- Reuse the engine's own `__GRIDATLAS_MODULES__.gridScope.scope(o, link.substations, {bandsKm:[2,5,10,25,40], nearestCount:30})`. Its first 5 match `nearestSubstations` for 2,499/2,499 origins, and an independent haversine gives the same 30 for 178/178.

**30 within 40 km**
- Holds for substations (99.4% of data centres) and REPD (100%).
- Fails for conventional (15%). List conventional uncapped and draw only up to 100 km.

**Cost and layers**
- Cost is 16.5 ms per tap, or 0.47 ms with a bbox prefilter.
- 90 lines are 25 kB of GeoJSON.
- Proposed: 2 sources and 7 layers, constant in N.

**Slough**
- 16 DC-A4 sites (11 operators) against 5 offtakers sites.
- The test is specified in ENGINE.md.
