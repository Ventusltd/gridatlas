# DC-B2 report (card and map design for the 30/30/30 data-centre tap)

Status 19:59 UTC: DONE. The spec has "SPEC READY" as its first line, for DC-B1 to poll.

## Files
- evidence/DC-B2/CARD-SPEC.md: the spec, covering tabs, pixel budgets at 393×852, wording, colours, labels, reveal, camera, area summary, CSV, accessibility and performance.
- evidence/DC-B2/proto.mjs: the node prototype (no browser).
- Its outputs: proto-output.txt, proto-sites.json (per site) and inputs.sha256.

## Key findings
- The original nearestSubstations is fixed at 5 within 40 km, so the card needs `nearest30` over the same list and distance, plus a parity test (first 5 must equal nearestSubstations).
- Conventional set, using offtakers class B as a proxy: only 27 of 164 data-centre sites have 30 conventional sites within 40 km, and 5 have none. Uncapped, the 30th is a median 51.6 km away (max 276 km). The spec keeps the 40 km cap and says so on the card.
- The 30th substation is more than 20 km away for 20 of 164 sites. The camera is held on the site; the initial radius is the larger of the 10th substation, the 10th REPD site and the nearest conventional site. That gives a median zoom of 10.08 (P10 8.56), against 7.62 if all 90 are framed.
- Colours: substations #ffccee, REPD #88aa00, conventional #999988. Each is at least 20 ΔE2000 from every existing map colour, including under protan and deutan simulation.
- The largest CSV is 16.8 KB; 90 links are 22.6 KB of GeoJSON; three full scans take 3.6 ms per tap in node.
- #73 had no comments as of 19:59 UTC.

Nothing was committed, pushed or deployed.
