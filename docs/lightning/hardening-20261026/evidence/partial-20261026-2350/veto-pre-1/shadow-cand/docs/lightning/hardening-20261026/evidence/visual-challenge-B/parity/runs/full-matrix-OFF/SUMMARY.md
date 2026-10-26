# Parity run 2026-10-26T22:37:08.341Z

baseline: http://127.0.0.1:8141/gridatlas/atlas/
candidate: http://127.0.0.1:8142/wt/atlas/v/202610261949/
offline shim: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs
fixtures: none
threshold: 0.1% changed pixels (channel > 16), geometry tolerance 1px
masks: #clock, #date, #days + map canvas
additive: [data-lightning-group]

suffix (live-count) mask: OFF (issue-32 mask list only)

## Verdict: FAIL

| viewport | state | changed px | changed px % | bbox | surface diffs (original / additive-host) | elements (base/cand) | moved | styleΔ | hitΔ | scrollΔ | styles equal | masks (base) | result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| desktop-1440x900 | initial | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1440x900 | layers | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1440x900 | grid | 0 | 0.000 | - | 1 / 9 | 1468/1468 | 1 | 0 | 0 | 4 | true | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1440x900 | about | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:8 | PASS |
| desktop-1440x900 | fullscreen | 0 | 0.000 | - | 1 / 9 | 1468/1468 | 1 | 0 | 1 | 4 | true | mask:3 mask-map:1 overlay:8 | FAIL |
| desktop-1440x900 | deeplink | 8 | 0.001 | 671,41 114x1 | 0 / 9 | 1524/1524 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:7 | PASS |
| android-393x852 | initial | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:6 | PASS |
| android-393x852 | layers | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:7 | PASS |
| android-393x852 | grid | 0 | 0.000 | - | 1 / 9 | 1475/1475 | 1 | 0 | 1 | 6 | true | mask-map:1 overlay:8 | FAIL |
| android-393x852 | about | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:9 | PASS |
| android-393x852 | fullscreen | 0 | 0.000 | - | 1 / 10 | 1475/1475 | 1 | 0 | 1 | 10 | true | mask-map:1 overlay:9 | FAIL |
| android-393x852 | deeplink | 2 | 0.003 | 237,144 2x1 | 0 / 10 | 1531/1531 | 0 | 0 | 0 | 6 | true | mask-map:1 overlay:10 | PASS |
| android-360x740 | initial | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:6 | PASS |
| android-360x740 | layers | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:7 | PASS |
| android-360x740 | grid | 0 | 0.000 | - | 1 / 9 | 1475/1475 | 1 | 0 | 1 | 6 | true | mask-map:1 overlay:8 | FAIL |
| android-360x740 | about | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:9 | PASS |
| android-360x740 | fullscreen | 0 | 0.000 | - | 1 / 10 | 1475/1475 | 1 | 0 | 1 | 10 | true | mask-map:1 overlay:9 | FAIL |
| android-360x740 | deeplink | 5 | 0.008 | 112,34 100x111 | 0 / 10 | 1531/1531 | 0 | 0 | 0 | 6 | true | mask-map:1 overlay:10 | PASS |
| iphone-390x844-geometry-only | initial | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:6 | PASS |
| iphone-390x844-geometry-only | layers | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:7 | PASS |
| iphone-390x844-geometry-only | grid | 0 | 0.000 | - | 1 / 9 | 1475/1475 | 1 | 0 | 1 | 6 | true | mask-map:1 overlay:8 | FAIL |
| iphone-390x844-geometry-only | about | 0 | 0.000 | - | 0 / 9 | 1475/1475 | 0 | 0 | 0 | 2 | true | mask-map:1 overlay:9 | PASS |
| iphone-390x844-geometry-only | fullscreen | 0 | 0.000 | - | 1 / 10 | 1475/1475 | 1 | 0 | 1 | 10 | true | mask-map:1 overlay:9 | FAIL |
| iphone-390x844-geometry-only | deeplink | 7 | 0.011 | 114,34 176x111 | 0 / 10 | 1531/1531 | 0 | 0 | 0 | 6 | true | mask-map:1 overlay:10 | PASS |
| desktop-1280x720 | initial | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1280x720 | layers | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1280x720 | grid | 0 | 0.000 | - | 1 / 9 | 1468/1468 | 1 | 0 | 0 | 4 | true | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1280x720 | about | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:8 | PASS |
| desktop-1280x720 | fullscreen | 0 | 0.000 | - | 1 / 9 | 1468/1468 | 1 | 0 | 1 | 4 | true | mask:3 mask-map:1 overlay:8 | FAIL |
| desktop-1280x720 | deeplink | n/a | n/a | - | n/a | ?/? | ? | ? | ? | ? | ? |  | FAIL |
| desktop-1920x1080 | initial | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1920x1080 | layers | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1920x1080 | grid | 0 | 0.000 | - | 1 / 9 | ?/? | ? | ? | ? | ? | ? | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1920x1080 | about | n/a | n/a | - | n/a | ?/? | ? | ? | ? | ? | ? |  | FAIL |
| desktop-1920x1080 | fullscreen | n/a | n/a | - | n/a | ?/? | ? | ? | ? | ? | ? |  | FAIL |
| desktop-1920x1080 | deeplink | n/a | n/a | - | n/a | ?/? | ? | ? | ? | ? | ? |  | FAIL |

## Geometry differences (first 12 per state)

### desktop-1440x900 / initial
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / layers
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / grid
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=512 candidate=434 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / about
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / fullscreen
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=512 candidate=434 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / deeplink
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-393x852 / initial
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-393x852 / layers
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-393x852 / grid
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=698 candidate=620 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-393x852 / about
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-393x852 / fullscreen
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=698 candidate=620 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys rect.height: baseline=2123 candidate=2179 (Δ 56)
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-393x852 / deeplink
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys rect.height: baseline=2123 candidate=2179 (Δ 56)
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-360x740 / initial
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-360x740 / layers
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-360x740 / grid
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=586 candidate=508 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-360x740 / about
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-360x740 / fullscreen
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=586 candidate=508 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys rect.height: baseline=2123 candidate=2179 (Δ 56)
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### android-360x740 / deeplink
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys rect.height: baseline=2123 candidate=2179 (Δ 56)
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### iphone-390x844-geometry-only / initial
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### iphone-390x844-geometry-only / layers
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### iphone-390x844-geometry-only / grid
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=690 candidate=612 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### iphone-390x844-geometry-only / about
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### iphone-390x844-geometry-only / fullscreen
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=690 candidate=612 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys rect.height: baseline=2123 candidate=2179 (Δ 56)
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### iphone-390x844-geometry-only / deeplink
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys rect.height: baseline=2123 candidate=2179 (Δ 56)
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1280x720 / initial
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1280x720 / layers
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1280x720 / grid
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=410.39 candidate=332.39 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1280x720 / about
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1280x720 / fullscreen
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=410.39 candidate=332.39 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1920x1080 / initial
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1920x1080 / layers
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1920x1080 / grid
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [original] grid-panel-body rect.height: baseline=512 candidate=434 (Δ -78)
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

## Every-element, scroll-area and hit-target differences (first 12 per state)

### desktop-1440x900 / grid
- MOVED (original) #297 div.gm-panel-body: baseline=[1001.67,100,374.45,512] candidate=[1001.67,100,374.45,434] Δ={"x":0,"y":0,"width":0,"height":-78}
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=512 candidate=434 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=931 candidate=1009 (Δ 78)

### desktop-1440x900 / fullscreen
- MOVED (original) #297 div.gm-panel-body: baseline=[1006.67,95,374.45,512] candidate=[1006.67,95,374.45,434] Δ={"x":0,"y":0,"width":0,"height":-78}
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=512 candidate=434 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=931 candidate=1009 (Δ 78)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":1263.64,"y":519.34,"width":111.48,"height":58.53} "Battery Storage [WAIT]" candidate={"x":1263.64,"y":431.13,"width":111.48,"height":88.22} "Offshore Wind (Operational Only) [WAIT]"

### android-393x852 / initial
- scroll #scada-ui-container scrollHeight: baseline=2145 candidate=2201 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2140 candidate=2196 (Δ 56)

### android-393x852 / layers
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1832 candidate=1888 (Δ 56)

### android-393x852 / grid
- MOVED (original) #300 div.gm-panel-body: baseline=[10,99,373,698] candidate=[10,99,373,620] Δ={"x":0,"y":0,"width":0,"height":-78}
- occluded on both routes, occluder changed (listed, not failed): map-control-1 baseline=OTHER:input candidate=OTHER:input[data-lightning-control=toggle]
- occluded on both routes, occluder changed (listed, not failed): map-control-2 baseline=OTHER:input candidate=OTHER:input[data-lightning-control=toggle]
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=373 candidate=421 (Δ 48)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=373 candidate=421 (Δ 48)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=698 candidate=620 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=2526 candidate=2604 (Δ 78)
- scroll #scada-ui-container scrollHeight: baseline=2145 candidate=2201 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2140 candidate=2196 (Δ 56)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":16,"y":687,"width":361,"height":44} "Railways [OK]" candidate={"x":16,"y":643,"width":361,"height":44} "Airports [OK]"

### android-393x852 / about
- scroll #scada-ui-container scrollHeight: baseline=2145 candidate=2201 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2140 candidate=2196 (Δ 56)

### android-393x852 / fullscreen
- MOVED (original) #300 div.gm-panel-body: baseline=[5,94,383,698] candidate=[5,94,383,620] Δ={"x":0,"y":0,"width":0,"height":-78}
- additive-host growth (listed, not failed) #4 div#fs-curtain-keys: height 2123 -> 2179 (Δ +56; x/y/width unchanged; appended group at the end)
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=383 candidate=433 (Δ 50)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=383 candidate=433 (Δ 50)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=698 candidate=620 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=2526 candidate=2604 (Δ 78)
- scroll #scada-ui-container scrollHeight: baseline=2145 candidate=2201 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2140 candidate=2196 (Δ 56)
- scroll #fs-curtain scrollHeight: baseline=2187 candidate=2243 (Δ 56)
- scroll #fs-curtain hiddenOverflowPx: baseline=1592 candidate=1648 (Δ 56)
- scroll #fs-curtain-keys scrollHeight: baseline=2123 candidate=2179 (Δ 56)
- scroll #fs-curtain-keys clientHeight: baseline=2123 candidate=2179 (Δ 56)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":11,"y":682,"width":371,"height":44} "Railways [OK]" candidate={"x":11,"y":638,"width":371,"height":44} "Airports [OK]"

### android-393x852 / deeplink
- additive-host growth (listed, not failed) #4 div#fs-curtain-keys: height 2123 -> 2179 (Δ +56; x/y/width unchanged; appended group at the end)
- scroll #scada-ui-container scrollHeight: baseline=2145 candidate=2201 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2140 candidate=2196 (Δ 56)
- scroll #fs-curtain scrollHeight: baseline=2187 candidate=2243 (Δ 56)
- scroll #fs-curtain hiddenOverflowPx: baseline=1592 candidate=1648 (Δ 56)
- scroll #fs-curtain-keys scrollHeight: baseline=2123 candidate=2179 (Δ 56)
- scroll #fs-curtain-keys clientHeight: baseline=2123 candidate=2179 (Δ 56)

### android-360x740 / initial
- scroll #scada-ui-container scrollHeight: baseline=2189 candidate=2245 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2184 candidate=2240 (Δ 56)

### android-360x740 / layers
- scroll #scada-ui-container scrollHeight: baseline=2189 candidate=2245 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1908 candidate=1964 (Δ 56)

### android-360x740 / grid
- MOVED (original) #300 div.gm-panel-body: baseline=[10,99,340,586] candidate=[10,99,340,508] Δ={"x":0,"y":0,"width":0,"height":-78}
- occluded on both routes, occluder changed (listed, not failed): map-control-1 baseline=OTHER:input candidate=OTHER:input[data-lightning-control=toggle]
- occluded on both routes, occluder changed (listed, not failed): map-control-2 baseline=OTHER:input candidate=OTHER:input[data-lightning-control=toggle]
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=340 candidate=383 (Δ 43)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=340 candidate=383 (Δ 43)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=586 candidate=508 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=2638 candidate=2716 (Δ 78)
- scroll #scada-ui-container scrollHeight: baseline=2189 candidate=2245 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2184 candidate=2240 (Δ 56)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":16,"y":599,"width":328,"height":44} "Data Ctrs [OK]" candidate={"x":16,"y":555,"width":328,"height":44} "Industry [OK]"

### android-360x740 / about
- scroll #scada-ui-container scrollHeight: baseline=2189 candidate=2245 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2184 candidate=2240 (Δ 56)

### android-360x740 / fullscreen
- MOVED (original) #300 div.gm-panel-body: baseline=[5,94,350,586] candidate=[5,94,350,508] Δ={"x":0,"y":0,"width":0,"height":-78}
- additive-host growth (listed, not failed) #4 div#fs-curtain-keys: height 2123 -> 2179 (Δ +56; x/y/width unchanged; appended group at the end)
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=350 candidate=395 (Δ 45)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=350 candidate=395 (Δ 45)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=586 candidate=508 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=2638 candidate=2716 (Δ 78)
- scroll #scada-ui-container scrollHeight: baseline=2189 candidate=2245 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2184 candidate=2240 (Δ 56)
- scroll #fs-curtain scrollHeight: baseline=2187 candidate=2243 (Δ 56)
- scroll #fs-curtain hiddenOverflowPx: baseline=1670 candidate=1726 (Δ 56)
- scroll #fs-curtain-keys scrollHeight: baseline=2123 candidate=2179 (Δ 56)
- scroll #fs-curtain-keys clientHeight: baseline=2123 candidate=2179 (Δ 56)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":11,"y":594,"width":338,"height":44} "Data Ctrs [OK]" candidate={"x":11,"y":550,"width":338,"height":44} "Industry [OK]"

### android-360x740 / deeplink
- additive-host growth (listed, not failed) #4 div#fs-curtain-keys: height 2123 -> 2179 (Δ +56; x/y/width unchanged; appended group at the end)
- scroll #scada-ui-container scrollHeight: baseline=2189 candidate=2245 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2184 candidate=2240 (Δ 56)
- scroll #fs-curtain scrollHeight: baseline=2187 candidate=2243 (Δ 56)
- scroll #fs-curtain hiddenOverflowPx: baseline=1670 candidate=1726 (Δ 56)
- scroll #fs-curtain-keys scrollHeight: baseline=2123 candidate=2179 (Δ 56)
- scroll #fs-curtain-keys clientHeight: baseline=2123 candidate=2179 (Δ 56)

### iphone-390x844-geometry-only / initial
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2151 candidate=2207 (Δ 56)

### iphone-390x844-geometry-only / layers
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1835 candidate=1891 (Δ 56)

### iphone-390x844-geometry-only / grid
- MOVED (original) #300 div.gm-panel-body: baseline=[10,99,370,690] candidate=[10,99,370,612] Δ={"x":0,"y":0,"width":0,"height":-78}
- occluded on both routes, occluder changed (listed, not failed): map-control-1 baseline=OTHER:input candidate=OTHER:input[data-lightning-control=toggle]
- occluded on both routes, occluder changed (listed, not failed): map-control-2 baseline=OTHER:input candidate=OTHER:input[data-lightning-control=toggle]
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=370 candidate=418 (Δ 48)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=370 candidate=418 (Δ 48)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=690 candidate=612 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=2534 candidate=2612 (Δ 78)
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2151 candidate=2207 (Δ 56)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":16,"y":687,"width":358,"height":44} "Railways [OK]" candidate={"x":16,"y":643,"width":358,"height":44} "Airports [OK]"

### iphone-390x844-geometry-only / about
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2151 candidate=2207 (Δ 56)

### iphone-390x844-geometry-only / fullscreen
- MOVED (original) #300 div.gm-panel-body: baseline=[5,94,380,690] candidate=[5,94,380,612] Δ={"x":0,"y":0,"width":0,"height":-78}
- additive-host growth (listed, not failed) #4 div#fs-curtain-keys: height 2123 -> 2179 (Δ +56; x/y/width unchanged; appended group at the end)
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=380 candidate=429 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=380 candidate=429 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=690 candidate=612 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=2534 candidate=2612 (Δ 78)
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2151 candidate=2207 (Δ 56)
- scroll #fs-curtain scrollHeight: baseline=2187 candidate=2243 (Δ 56)
- scroll #fs-curtain hiddenOverflowPx: baseline=1597 candidate=1653 (Δ 56)
- scroll #fs-curtain-keys scrollHeight: baseline=2123 candidate=2179 (Δ 56)
- scroll #fs-curtain-keys clientHeight: baseline=2123 candidate=2179 (Δ 56)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":11,"y":682,"width":368,"height":44} "Railways [OK]" candidate={"x":11,"y":638,"width":368,"height":44} "Airports [OK]"

### iphone-390x844-geometry-only / deeplink
- additive-host growth (listed, not failed) #4 div#fs-curtain-keys: height 2123 -> 2179 (Δ +56; x/y/width unchanged; appended group at the end)
- scroll #scada-ui-container scrollHeight: baseline=2156 candidate=2212 (Δ 56)
- scroll #scada-ui-container hiddenOverflowPx: baseline=2151 candidate=2207 (Δ 56)
- scroll #fs-curtain scrollHeight: baseline=2187 candidate=2243 (Δ 56)
- scroll #fs-curtain hiddenOverflowPx: baseline=1597 candidate=1653 (Δ 56)
- scroll #fs-curtain-keys scrollHeight: baseline=2123 candidate=2179 (Δ 56)
- scroll #fs-curtain-keys clientHeight: baseline=2123 candidate=2179 (Δ 56)

### desktop-1280x720 / grid
- MOVED (original) #297 div.gm-panel-body: baseline=[841.67,100,374.45,410.39] candidate=[841.67,100,374.45,332.39] Δ={"x":0,"y":0,"width":0,"height":-78}
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=410 candidate=332 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=1033 candidate=1111 (Δ 78)

### desktop-1280x720 / fullscreen
- MOVED (original) #297 div.gm-panel-body: baseline=[846.67,95,374.45,410.39] candidate=[846.67,95,374.45,332.39] Δ={"x":0,"y":0,"width":0,"height":-78}
- occluded on both routes, occluder changed (listed, not failed): curtain-last-visible-row baseline=OTHER:div.gm-layer-group candidate=OTHER:input[data-lightning-control=toggle]
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=410 candidate=332 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=1033 candidate=1111 (Δ 78)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":1103.64,"y":342.91,"width":111.48,"height":88.22} "Onshore Wind (Operational Only) [WAIT]" candidate={"x":1103.64,"y":298.91,"width":111.48,"height":44} "Wind [WAIT]"

### desktop-1920x1080 / grid
- <style> inventory differs: undefined
- <link rel=stylesheet> inventory differs

## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)
- desktop-1440x900/initial: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- desktop-1440x900/layers: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- desktop-1440x900/grid: search-input=OTHER:div.status-dot; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 1002,100,374,512 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 1001,40,376,620 > div#map-container.map-container 4,4,1432,520 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900; fs-curtain-tab=OTHER:div.key-group clippedBy div#map-container.map-container 4,4,1432,520
- desktop-1440x900/about: search-input=OTHER:button; search-btn=OTHER:button; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900; about-last-control=ANCESTOR:div.custom-map-attrib
- desktop-1440x900/fullscreen: dash-toggle=OTHER:canvas.maplibregl-canvas; search-input=OTHER:div.gm-layer-group; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:canvas.maplibregl-canvas; layers-first-visible-row=OTHER:canvas.maplibregl-canvas; layers-last-visible-row=OTHER:input; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1406,342 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 1007,95,374,512 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 1006,35,376,620 > div#map-container.map-container.is-fullscreen 0,0,1440,900 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900; btn-fullscreen-exit=OUT-OF-VIEWPORT; curtain-400kv-row=OTHER:canvas.maplibregl-canvas; curtain-first-visible-row=OTHER:canvas.maplibregl-canvas; curtain-last-visible-row=OTHER:div#fs-curtain-tab
- desktop-1440x900/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- android-393x852/initial: map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852
- android-393x852/layers: map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,490; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,490; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,511,359,324 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852
- android-393x852/grid: dash-toggle=OTHER:div#fs-curtain-tab; search-input=OTHER:div.gm-panel-body; search-btn=OTHER:div.gm-panel-body; map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 10,99,373,698 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 9,39,375,812 > div#map-container.map-container 4,4,385,840 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852
- android-393x852/about: search-input=OTHER:div#gridatlas-menu-bar-panel-5.gm-panel; search-btn=OTHER:div#gridatlas-menu-bar-panel-5.gm-panel; map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852
- android-393x852/fullscreen: dash-toggle=OTHER:div#fs-curtain-tab; search-input=OTHER:input; search-btn=OTHER:input; map-control-0=OUT-OF-VIEWPORT; map-control-1=OTHER:div#fs-curtain-tab; map-control-2=OTHER:div#fs-curtain-tab; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:div.gm-brand-slot clippedBy div#scada-ui-container.scada-keys 16,4,361,5 > div.scada-wrapper 4,4,385,0; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,361,5 > div.scada-wrapper 4,4,385,0 > body.fs-active 0,0,393,852 > html.gridatlas-menu-hosted.fs-active 0,0,393,852; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 5,94,383,698 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 4,34,385,812 > div#map-container.map-container.is-fullscreen 0,0,393,852 > body.fs-active 0,0,393,852 > html.gridatlas-menu-hosted.fs-active 0,0,393,852; btn-fullscreen-exit=OUT-OF-VIEWPORT; curtain-400kv-row=OTHER:div.gm-panel-head; curtain-first-visible-row=OTHER:div.gm-panel-head; curtain-last-visible-row=OTHER:input
- android-393x852/deeplink: dash-toggle=OTHER:canvas.maplibregl-canvas; map-control-0=OUT-OF-VIEWPORT clippedBy div.map-controls.gm-tools-collapsed 10,730,135,44; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:div.gm-brand-slot clippedBy div#scada-ui-container.scada-keys 16,4,361,5 > div.scada-wrapper 4,4,385,0; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,361,5 > div.scada-wrapper 4,4,385,0 > body.fs-active 0,0,393,852 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,393,852
- android-360x740/initial: map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740
- android-360x740/layers: map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,421; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,421; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,442,326,281 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740
- android-360x740/grid: dash-toggle=OTHER:div#fs-curtain-tab; search-input=OTHER:div.gm-panel-body; search-btn=OTHER:div.gm-panel-body; map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 10,99,340,586 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 9,39,342,700 > div#map-container.map-container 4,4,352,728 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740
- android-360x740/about: search-input=OTHER:div#gridatlas-menu-bar-panel-5.gm-panel; search-btn=OTHER:div#gridatlas-menu-bar-panel-5.gm-panel; map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740
- android-360x740/fullscreen: dash-toggle=OTHER:div#fs-curtain-tab; search-input=OTHER:input; search-btn=OTHER:input; map-control-0=OUT-OF-VIEWPORT; map-control-1=OTHER:div#fs-curtain-tab; map-control-2=OTHER:div#fs-curtain-tab; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:div.gm-brand-slot clippedBy div#scada-ui-container.scada-keys 16,4,328,5 > div.scada-wrapper 4,4,352,0; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,328,5 > div.scada-wrapper 4,4,352,0 > body.fs-active 0,0,360,740 > html.gridatlas-menu-hosted.fs-active 0,0,360,740; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 5,94,350,586 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 4,34,352,700 > div#map-container.map-container.is-fullscreen 0,0,360,740 > body.fs-active 0,0,360,740 > html.gridatlas-menu-hosted.fs-active 0,0,360,740; btn-fullscreen-exit=OUT-OF-VIEWPORT; curtain-400kv-row=OTHER:div.gm-panel-head; curtain-first-visible-row=OTHER:div.gm-panel-head; curtain-last-visible-row=OTHER:input
- android-360x740/deeplink: dash-toggle=OTHER:canvas.maplibregl-canvas; map-control-0=OUT-OF-VIEWPORT clippedBy div.map-controls.gm-tools-collapsed 10,618,135,44; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:div.gm-brand-slot clippedBy div#scada-ui-container.scada-keys 16,4,328,5 > div.scada-wrapper 4,4,352,0; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,328,5 > div.scada-wrapper 4,4,352,0 > body.fs-active 0,0,360,740 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,360,740
- iphone-390x844-geometry-only/initial: map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844
- iphone-390x844-geometry-only/layers: map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,485; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,485; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,506,356,321 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844
- iphone-390x844-geometry-only/grid: dash-toggle=OTHER:div#fs-curtain-tab; search-input=OTHER:div.gm-panel-body; search-btn=OTHER:div.gm-panel-body; map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 10,99,370,690 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 9,39,372,804 > div#map-container.map-container 4,4,382,832 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844
- iphone-390x844-geometry-only/about: search-input=OTHER:div#gridatlas-menu-bar-panel-5.gm-panel; search-btn=OTHER:div#gridatlas-menu-bar-panel-5.gm-panel; map-control-0=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832; layers-400kv-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844
- iphone-390x844-geometry-only/fullscreen: menu-title-0=OTHER:div#fs-curtain.curtain-open; menu-title-1=OTHER:div#fs-curtain.curtain-open; menu-title-2=OTHER:div#fs-curtain.curtain-open; menu-title-3=OTHER:div#fs-curtain.curtain-open; menu-title-4=OTHER:div#fs-curtain.curtain-open; menu-title-5=OTHER:div#fs-curtain.curtain-open; search-input=OTHER:label.key-item; search-btn=OTHER:label.key-item; map-control-0=OUT-OF-VIEWPORT; map-control-1=OTHER:div#fs-curtain-tab; map-control-2=OTHER:div#fs-curtain-tab; attribution=OUT-OF-VIEWPORT; hud-brand=OTHER:div#fs-curtain.curtain-open; layers-400kv-row=OTHER:div#fs-curtain.curtain-open clippedBy div#scada-ui-container.scada-keys 16,4,358,5 > div.scada-wrapper 4,4,382,0; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,358,5 > div.scada-wrapper 4,4,382,0 > body.fs-active 0,0,390,844 > html.gridatlas-menu-hosted.fs-active 0,0,390,844; grid-400kv-proxy=OTHER:label.key-item; grid-first-visible-proxy=OTHER:label.key-item; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 5,94,380,690 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 4,34,382,804 > div#map-container.map-container.is-fullscreen 0,0,390,844 > body.fs-active 0,0,390,844 > html.gridatlas-menu-hosted.fs-active 0,0,390,844; grid-panel-head=OTHER:div.key-group; btn-fullscreen-exit=OUT-OF-VIEWPORT
- iphone-390x844-geometry-only/deeplink: map-control-0=OUT-OF-VIEWPORT clippedBy div.map-controls.gm-tools-collapsed 10,722,135,44; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:div.gm-brand-slot clippedBy div#scada-ui-container.scada-keys 16,4,358,5 > div.scada-wrapper 4,4,382,0; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,358,5 > div.scada-wrapper 4,4,382,0 > body.fs-active 0,0,390,844 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,390,844
- desktop-1280x720/initial: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720
- desktop-1280x720/layers: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720
- desktop-1280x720/grid: search-input=OTHER:div.status-dot; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 842,100,374,410 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 841,40,376,518 > div#map-container.map-container 4,4,1272,408 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720; fs-curtain-tab=OTHER:label.key-item clippedBy div#map-container.map-container 4,4,1272,408
- desktop-1280x720/about: search-input=OTHER:button; search-btn=OTHER:button; attribution=OTHER:div.key-group clippedBy div#map-container.map-container 4,4,1272,408; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720; about-last-control=OTHER:label.key-item clippedBy div#map-container.map-container 4,4,1272,408
- desktop-1280x720/fullscreen: dash-toggle=OTHER:canvas.maplibregl-canvas; search-input=OTHER:div.gm-layer-group; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:canvas.maplibregl-canvas; layers-first-visible-row=OTHER:canvas.maplibregl-canvas; layers-last-visible-row=OTHER:input; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1246,274 > body.fs-active 0,0,1280,720 > html.gridatlas-menu-hosted.fs-active 0,0,1280,720; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 847,95,374,410 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 846,35,376,518 > div#map-container.map-container.is-fullscreen 0,0,1280,720 > body.fs-active 0,0,1280,720 > html.gridatlas-menu-hosted.fs-active 0,0,1280,720; btn-fullscreen-exit=OUT-OF-VIEWPORT; curtain-400kv-row=OTHER:canvas.maplibregl-canvas; curtain-first-visible-row=OTHER:canvas.maplibregl-canvas
- desktop-1920x1080/initial: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080
- desktop-1920x1080/layers: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080

## Candidate additive nodes and lightning toggle hit tests (P14), per state
- desktop-1440x900/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 1001.67,534 374.45x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OTHER:div.key-group clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 728,1302 696x98","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 1006.67,529 374.45x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1271 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,1440,630 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1406,342 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900"]
- desktop-1440x900/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- android-393x852/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2996 361x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852"]
- android-393x852/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 17,2670.25 359x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,490","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,511,359,324 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852"]
- android-393x852/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 10,719 373x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2996 361x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852"]
- android-393x852/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2996 361x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,385,840","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,848,361,5 > div.scada-wrapper 4,848,385,0 > body 0,0,393,852 > html.gridatlas-menu-hosted 0,0,393,852"]
- android-393x852/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 16,2179 361x44","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 5,714 383x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2152 361x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,393,596 > body.fs-active 0,0,393,852 > html.gridatlas-menu-hosted.fs-active 0,0,393,852","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,361,5 > div.scada-wrapper 4,4,385,0 > body.fs-active 0,0,393,852 > html.gridatlas-menu-hosted.fs-active 0,0,393,852"]
- android-393x852/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 16,1582.61 361x44","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2152 361x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain 0,-596,393,596 > body.fs-active 0,0,393,852 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,393,852","lightning-toggle-menu:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,361,5 > div.scada-wrapper 4,4,385,0 > body.fs-active 0,0,393,852 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,393,852"]
- android-360x740/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2928 328x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740"]
- android-360x740/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 17,2633.81 326x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,421","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,442,326,281 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740"]
- android-360x740/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 10,607 340x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2928 328x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740"]
- android-360x740/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2928 328x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,352,728","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,736,328,5 > div.scada-wrapper 4,736,352,0 > body 0,0,360,740 > html.gridatlas-menu-hosted 0,0,360,740"]
- android-360x740/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 16,2179 328x44","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 5,602 350x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2196 328x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,360,518 > body.fs-active 0,0,360,740 > html.gridatlas-menu-hosted.fs-active 0,0,360,740","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,328,5 > div.scada-wrapper 4,4,352,0 > body.fs-active 0,0,360,740 > html.gridatlas-menu-hosted.fs-active 0,0,360,740"]
- android-360x740/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 16,1661 328x44","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2196 328x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain 0,-518,360,518 > body.fs-active 0,0,360,740 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,360,740","lightning-toggle-menu:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,328,5 > div.scada-wrapper 4,4,352,0 > body.fs-active 0,0,360,740 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,360,740"]
- iphone-390x844-geometry-only/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2999 358x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844"]
- iphone-390x844-geometry-only/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 17,2665.28 356x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,485","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,506,356,321 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844"]
- iphone-390x844-geometry-only/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 10,711 370x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2999 358x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844"]
- iphone-390x844-geometry-only/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2999 358x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,382,832","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,840,358,5 > div.scada-wrapper 4,840,382,0 > body 0,0,390,844 > html.gridatlas-menu-hosted 0,0,390,844"]
- iphone-390x844-geometry-only/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 16,2179 358x44","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 5,706 380x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2163 358x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,390,591 > body.fs-active 0,0,390,844 > html.gridatlas-menu-hosted.fs-active 0,0,390,844","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,358,5 > div.scada-wrapper 4,4,382,0 > body.fs-active 0,0,390,844 > html.gridatlas-menu-hosted.fs-active 0,0,390,844"]
- iphone-390x844-geometry-only/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 16,1588.2 358x44","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 16,2163 358x44"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain 0,-591,390,591 > body.fs-active 0,0,390,844 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,390,844","lightning-toggle-menu:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 16,4,358,5 > div.scada-wrapper 4,4,382,0 > body.fs-active 0,0,390,844 > html.fs-active.gridatlas-sheet-open.gridatlas-menu-hosted 0,0,390,844"]
- desktop-1280x720/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1683.41 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720"]
- desktop-1280x720/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1683.41 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720"]
- desktop-1280x720/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 841.67,432.39 374.45x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1683.41 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OTHER:label.key-item clippedBy div#map-container.map-container 4,4,1272,408","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720"]
- desktop-1280x720/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1683.41 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720"]
- desktop-1280x720/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 648,1302 616x98","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 846.67,427.39 374.45x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1271 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,1280,504 > body.fs-active 0,0,1280,720 > html.gridatlas-menu-hosted.fs-active 0,0,1280,720","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1246,274 > body.fs-active 0,0,1280,720 > html.gridatlas-menu-hosted.fs-active 0,0,1280,720"]
- desktop-1920x1080/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
- desktop-1920x1080/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
- desktop-1920x1080/grid: additive=[] toggles=[]
