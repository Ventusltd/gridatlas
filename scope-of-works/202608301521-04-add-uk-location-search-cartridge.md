---
schema: "gridatlas.scope-of-works.v1"
generation: "202608301521"
status: "active"
scope: 4
parent: "202608301520-03-apply-pipelinenews-lessons.md"
next: null
---
# Scope 4 — add UK postcode and town location search

Do only this scope.

## Changes

- Derive `atlas/cartridges/202608301136-place-postcode-search.js` from the immutable shell search script.
- Add the postcodes.io postcode, outcode and OS Open Names place lane.
- Keep REPD results first and exact REPD identity/deep-link behaviour unchanged.
- Add `ui/cartridges/202608301136-uk-gazetteer-flyto.mjs`.
- Activate the script as a SHA-256 replacement cartridge in `atlas/current.json`.

## Acceptance

- Location results are `LOCATION_ONLY`, never set `repd_ref`, and remove a stale `repd_ref` on selection.
- Full postcode, outcode and place branches exist.
- The REPD and geocoder queries run concurrently with a stale-response guard.
- Geocoder failure cannot break the REPD lane.
- No immutable release file changes.
- On green, write the timestamped Scope 5 file.
