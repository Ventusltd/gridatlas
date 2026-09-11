# Satellite survey — test 202609111007

Dated imagery for domestic and public-interest surveying of renewable-energy projects.

Open **Grid → Satellite survey**. All new imagery, date and boundary controls live inside the existing Grid dropdown. The original on-map GRID and SUBS buttons are not moved or rewritten. There is no floating satellite dock. The production homepage, branding, immutable shell and live composition remain unchanged.

## Use

Choose **ESRI** for existing high-resolution context or **SENTINEL-2** for dated optical imagery. The newest acquisition may be cloudy; scene cloud percentage is not a measurement of cloud at the project.

Under **Project boundary**, load a WGS84 Polygon/MultiPolygon GeoJSON (maximum 1 MB / 20,000 coordinates), then **FIT BOUNDARY**. The file is read in the browser. Only geometry is sent to the public Microsoft Planetary Computer catalogue when requesting S2; file metadata is not uploaded. Without a boundary, the query uses the map centre. File parsing validates coordinate/ring structure, not the planning authority or topological correctness of a supplied boundary.

Choose a UTC date range (maximum one year), newest/lower-cloud preference, or an individual capture. The catalogue is bounded to the first 100 newest intersecting scenes; narrow the range to inspect older dates. **VIEW MAP** closes the dropdown.

For manual before/after comparison, load a capture and **SET A**, load another and **SET B**, then **SHOW A / SHOW B**. These switch actual dated imagery at the same view; no change classification or project-status inference is performed.

White outline: supplied boundary. Gold dashed outline: the selected scene footprint. Sentinel-2 RGB is 10 m resolution; Esri remains visible outside the scene and in no-data gaps, and its acquisition date varies. A scene may intersect only part of a boundary. No visible change is not evidence of no activity.

## Build and evidence

`python atlas/testcode/202609111007/build.py` builds a hash-verified loader and small add-on using the pinned imagery helpers from test 202609110849. All four production cartridges remain pinned to composition 202609080850. `browser-proof.py` runs bounded Chrome checks with live external imagery; `LIVE_TEST=1` checks the actual published URL without response substitution. Mobile emulation is not physical-device Safari testing.

No commercial imagery was ordered. No credentials are included. Sentinel-1 radar and commercial imagery services are not integrated in this test.
