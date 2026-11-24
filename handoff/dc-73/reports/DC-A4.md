# DC-A4 report: operational UK data centres from OSM (ODbL) and Wikidata (CC0)

Status: done (29 Oct 2026). Team A. No PR: the lane did not ask for one.
Evidence: `hardening/evidence/DC-A4/`

## Reachability
- Overpass (overpass-api.de, kumi.systems, private.coffee): **blocked**. The proxy returns 403 CONNECT, and WebFetch says the host is not on the allowlist.
- Wikidata SPARQL (query.wikidata.org): **blocked** the same way.
- The fetchers ran and recorded the failure in `raw/osm_overpass.fetch.json` and `raw/wikidata_sparql.fetch.json`.
- Fallback: the globalgrid2050 `origin/main:datacentres.geojson`.
  - SHA-256 a686a2e0…c73acab4, the same file the offtakers filter used.
  - 240 points with name and operator only. No OSM element ids, tags or dates were kept.
  - Built by `scripts/fetch_datacentres.py`: telecom|building=data_center in Overpass area 3600062149, `out center`.
  - Snapshot date unknown (it is in history at da7d8f6e, 2026-10-13).

## Code: `evidence/DC-A4/dc_a4.py` (standard library only)
- `fetch-osm`: a pinned endpoint and query, stored as raw JSON plus SHA-256. The query uses nwr for:
  - `telecom=data_center`;
  - `building` = data_center or data_centre;
  - `building:use` = data_center or data_centre;
  - `industrial` = data_center or data_centre;

  then runs `out center tags`.
- `fetch-wikidata`: P31/P279* on Q671224 (data center, including every subclass) with P17 = Q145. It also asks for:
  - coordinates, operator and owner;
  - inception, dissolved date and state of use;
  - website;
  - P2109 nominal power output and P2791 power consumed (unverified for data centres), with their units.
- `build`: normalise, then de-duplicate, then reconcile, then write `out/dc_operational.json`, `.geojson` and `counts.json`. It is byte-reproducible (checked).
- `selftest`: synthetic Overpass and Wikidata fixtures. It checks:
  - merging, keeping different operators apart, cable landing stations, the UK bounding box;
  - Wikidata items without coordinates;
  - that MW never goes into the IT or connection fields;
  - determinism.

  Result: PASS.

## Schema (#73 step 3) choices
- `status` is "operational", with `status_basis` saying it is mapped as existing, not verified and not a pipeline entry.
- `it_load_mw` and `grid_connection_mw` are kept separate and are always null with a basis "unknown". Any MW in an OSM tag or Wikidata property goes to `mw_unclassified` with its raw value and the flag "does not say IT load or grid connection".
- Placeholders such as "Unknown Data Centre" or "Unknown Operator" become null.
- Each source entry carries its licence, licence URL, attribution "© OpenStreetMap contributors" with https://www.openstreetmap.org/copyright, and location precision. The output licence is ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/), because a derived database is share-alike. Wikidata is CC0 (https://creativecommons.org/publicdomain/zero/1.0/).

## Counts (legacy snapshot)
- 240 OSM objects make **190 sites**. 50 duplicates were merged using a 250 m radius with compatible operators, the same rule as ot_filter step 4.
  - 149 single data centres;
  - 29 campuses;
  - 12 cable landing stations, which are tagged telecom=data_center but are not data centres. They are kept, flagged and excluded from the total.
- That leaves **178 operational data-centre sites**.
- 159 sites have a name and 145 an operator. None has IT-load or connection MW (0).
- 15 sites have flagged conflicts (multiple names; one with two operators: Digital Realty LHR26 and Global Technical Realty).
- Every one of the 240 objects appears exactly once.

## Reconciliation with offtakers class C (offtakers_filtered_202610290945, 164 sites)
- The offtakers class C splits into 133 OSM-primary and 31 NAEI-primary sites.
- All 228 non-cable OSM refs (`osm_dc-N`) are found in my sites, matched exactly by index.
- 156 of the 164 are matched.
- The 8 unmatched are NAEI-only sites with no OSM object, so they are out of scope for OSM and Wikidata. Examples are Hemel Hempstead, LCY10, Riverdale, Stevenage, Stone, two in Swindon, and Virtus Stockley Park. The merge lane should add them.
- **Finding:** ot_filter merges OSM data centres into an NAEI site within 500 m with no operator check. Distinct operators collapse as a result:
  - OT-C-1228 "Virtus London 9" absorbs 12 OSM objects, including Kao, Digital Realty, NTT, Rackspace and Lumen;
  - OT-C-1264 "Slough LON2" absorbs 6, including Equinix LD5 and LD10, and CyrusOne.

  In total, 13 offtakers sites map to 2–6 of my sites each. The Slough cluster is under-represented in the overlay, and the step 7 category should use the pipeline grouping.
- **Caveat:** an unknown operator lets two sites merge, for example China Mobile Slough with VIRTUS London 11. These merges are flagged and kept for review.

## Next
- Allow overpass-api.de and query.wikidata.org, then run the following. A live run would add element ids, evidence URLs and tags, which the legacy file lacks.

  ```
  dc_a4.py fetch-osm && dc_a4.py fetch-wikidata && dc_a4.py build --offtakers …
  ```
