# DC-A7 report (schema + dedupe/merge, #73 steps 3-4)

Final, 2026-10-29 ~20:55 UTC. Polling stopped on the lead's instruction (all source lanes finished). Nothing committed, pushed or deployed by this lane.

## Files (hardening/evidence/DC-A7/)
- `dc_pipeline.schema.json`: JSON Schema 2020-12. Separate nullable `it_load_mw`, `grid_connection_mw` and `unclassified_mw` objects `{value, source_id, label}`. A status enum: operational / under_construction / consented / in_planning / connection_request / announced / refused_or_withdrawn / unknown. Six ISO dates. A location `{lat, lon, precision enum, source_id}`. `planning_refs`, `connection_refs`, `evidence_urls`. `sources[]` with url, a licence enum of fully open licences only, licence_url and licence_status. `conflicts[]` and `match[]` provenance. The id is `dcuk-` plus sha256(site_key)[:16].
- `dcschema.py`: a standard-library validator. It adds semantic checks: an MW value needs a source_id that exists in sources[], lat and lon are set together, and the id must equal the hash of site_key. It cross-checks against `jsonschema` when that is installed.
- `dcmerge.py`: the dedupe/merge engine.
  - **Matching rules:** planning ref, then connection ref, then a shared evidence document, then name+distance (similarity ≥0.85), then operator+distance (similarity ≥0.5), then exact name+operator (used when there is no location).
  - **Distance thresholds by the coarser precision of the pair:** exact 0.5 km, address/planning 1 km, postcode 2 km, settlement 5 km, local authority 15 km, region/unknown never.
  - **Cannot-link guards:** names with different digit designators (LD4 vs LD5), and same-dataset pairs below 0.95 similarity. A shared URL counts only across different lanes, for at most 2 citing records, and not when the points are more than 25 km apart.
  - **Conflicts flagged:** mw (within one field only; never IT vs grid), status, operator, date, location, same_source_duplicate.
  - **Field choice:** source tier first (system operator > planning > gov > company > Wikidata > OSM). The location comes from the record with the best precision.
- `dcingest.py`: a tolerant adapter for each lane's format, plus the build. It rejects non-open or missing licences, missing URLs, points outside the UK bounds, NESO rows that are not data-centre-like, and cable landing stations. A bare MW figure goes to `unclassified_mw`. On-site generation MW goes to notes only.
- `test_dcmerge.py`: 49 synthetic tests. All pass both with and without `jsonschema` (`DC_NO_JSONSCHEMA=1`).
- `uk_datacentre_pipeline.geojson` (sha256 6896145234…c96456; byte-identical on rebuild, 0 validation errors) and `uk_datacentre_pipeline.rejects.json`.
- `poll_summary.py` and `poll_loop.sh`: the polling helpers.

## Final merge
| Lane | Input | Note |
|---|---|---|
| DC-A1 NESO | 0 | fetch 403; NESO has no site-level demand register |
| DC-A2 planning | 3 | NSIP s35: Wapseys Wood, Bedford/QuestPit, Ebbsfleet |
| DC-A3 gov sites | 27 | OGL |
| DC-A4 OSM | 178 | plus 12 cable landing stations rejected |
| DC-A5 DNO | 0 | ECR fetch 403 |

208 inputs merge to **204 sites**.

**By status:**
- operational 180 (OSM "mapped as existing", not verified);
- announced 12;
- in planning 7;
- consented 4;
- unknown 1 (Woodlands Park, Iver).

**By source:**
- DC-A4 OSM (ODbL) 177;
- DC-A3 GOV.UK/gov.scot/gov.wales (OGL) 27;
- DC-A2 s35 (OGL) 3.

Three sites are cross-lane: Wapseys Wood (A2+A3, via a shared PINS/GOV.UK document), Bedford/QuestPit (A2+A3, via a shared request statement PDF) and Google Waltham Cross (A3+A4, name match at 1.47 km). All licences are marked `unverified` unless the lane stated otherwise.

**MW:**
- IT load is known for 4 sites: QuestPit 720, SDC M40 300, Ebbsfleet 240, Manor Farm 72; sum 1,332 MW.
- Grid connection is known for 2 sites: Court Lane, Iver 140 (reserved), and QuestPit 200 (initial); sum 340 MW.
- 8 sites have an unclassified MW figure, for example North East AIGZ 1,100, South Wales AIGZ 1,000, Culham 100, and Ebbsfleet 300 "total power load".
- Every other value is null, which means unknown, not zero.

**Conflicts:** 1. Ark Data Centres is a same_source_duplicate: two DC-A4 OSM records 245 m apart were merged by name. No MW or status disagreements exist yet, because the lanes barely overlap.

## Caveats
- A test pass that matched on shared URLs alone created false merges: one GOV.UK press release names several sites. The fix is the rule above (cross-lane only, at most 2 records, at most 25 km), and it is pinned by tests.
- The site_key prefers planning > connection > geo keys. An id can change when a later source adds a planning ref to a site that had only a geo key.
- The #73 progress comment at 20:17 (203 sites) is superseded by these 204-site counts.
