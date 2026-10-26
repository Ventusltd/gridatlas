# Parity run 2026-10-26T23:00:10.824Z

baseline: http://127.0.0.1:8141/gridatlas/atlas/
candidate: http://127.0.0.1:8141/gridatlas/atlas/
offline shim: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs
fixtures: none
threshold: 0.1% changed pixels (channel > 16), geometry tolerance 1px
masks: #clock, #date, #days + map canvas
additive: [data-lightning-group]

suffix (live-count) mask: OFF (issue-32 mask list only)

## Verdict: PASS

| viewport | state | changed px | changed px % | bbox | surface diffs (original / additive-host) | elements (base/cand) | moved | styleΔ | hitΔ | scrollΔ | styles equal | masks (base) | result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| desktop-1440x900 | deeplink | 14 | 0.002 | 545,443 1x14 | 0 / 0 | 1526/1526 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:7 | PASS |

## Geometry differences (first 12 per state)

## Every-element, scroll-area and hit-target differences (first 12 per state)

## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)
- desktop-1440x900/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900

## Candidate additive nodes and lightning toggle hit tests (P14), per state
- desktop-1440x900/deeplink: additive=[] toggles=[]
