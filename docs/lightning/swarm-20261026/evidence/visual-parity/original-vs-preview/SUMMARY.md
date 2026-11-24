# Parity run 2026-10-26T17:29:44.722Z

baseline: http://127.0.0.1:8102/gridatlas/atlas/
candidate: http://127.0.0.1:8102/gridatlas/atlas/preview/lightning/
offline shim: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs
fixtures: none
threshold: 0.1% changed pixels (channel > 16), geometry tolerance 1px
masks: #clock, #date, #days + live-count suffixes + map canvas
additive: [data-weather-group],[data-weather-native-group],[data-gridatlas-layer-key="weather:uk_lightning"]

## Verdict: FAIL

| viewport | state | changed px % | bbox | geometry diffs | result |
|---|---|---|---|---|---|
| desktop-1440x900 | initial | 1.473 | 29,541 847x330 | 35 | FAIL |
| desktop-1440x900 | layers | 1.473 | 29,541 847x330 | 35 | FAIL |
| desktop-1440x900 | grid | 3.698 | 29,106 1341x765 | 37 | FAIL |
| desktop-1440x900 | about | 1.206 | 29,541 847x330 | 35 | FAIL |
| desktop-1440x900 | fullscreen | 2.701 | 1013,101 362x506 | 39 | FAIL |
| desktop-1440x900 | deeplink | 1.097 | 29,541 847x330 | 35 | FAIL |
| android-393x852 | initial | 0.000 | - | 36 | FAIL |
| android-393x852 | layers | 3.512 | 17,556 125x279 | 36 | FAIL |
| android-393x852 | grid | 3.076 | 16,181 361x603 | 37 | FAIL |
| android-393x852 | about | 0.000 | - | 36 | FAIL |
| android-393x852 | fullscreen | 3.557 | 11,176 371x603 | 40 | FAIL |
| android-393x852 | deeplink | 0.000 | - | 39 | FAIL |
| android-360x740 | initial | 0.000 | - | 36 | FAIL |
| android-360x740 | layers | 3.685 | 17,486 125x237 | 36 | FAIL |
| android-360x740 | grid | 3.027 | 16,181 328x504 | 37 | FAIL |
| android-360x740 | about | 0.000 | - | 36 | FAIL |
| android-360x740 | fullscreen | 3.619 | 11,176 338x504 | 40 | FAIL |
| android-360x740 | deeplink | 0.000 | - | 39 | FAIL |
| iphone-390x844-geometry-only | initial | 0.000 | - | 36 | FAIL |
| iphone-390x844-geometry-only | layers | 3.526 | 17,551 125x276 | 36 | FAIL |
| iphone-390x844-geometry-only | grid | 3.127 | 16,181 358x603 | 37 | FAIL |
| iphone-390x844-geometry-only | about | 0.000 | - | 36 | FAIL |
| iphone-390x844-geometry-only | fullscreen | 4.287 | 11,93 368x686 | 40 | FAIL |
| iphone-390x844-geometry-only | deeplink | 0.000 | - | 39 | FAIL |

## Geometry differences (first 12 per state)

### desktop-1440x900 / initial
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 23 more

### desktop-1440x900 / layers
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 23 more

### desktop-1440x900 / grid
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row rect.height: baseline=44 candidate=88.22 (Δ 44.22)
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- … 25 more

### desktop-1440x900 / about
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 23 more

### desktop-1440x900 / fullscreen
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row rect.height: baseline=44 candidate=88.22 (Δ 44.22)
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- … 27 more

### desktop-1440x900 / deeplink
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 23 more

### android-393x852 / initial
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### android-393x852 / layers
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### android-393x852 / grid
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- grid-panel-400kv-row rect.y: baseline=132 candidate=203 (Δ 71)
- … 25 more

### android-393x852 / about
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### android-393x852 / fullscreen
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- grid-panel-400kv-row rect.y: baseline=127 candidate=198 (Δ 71)
- … 28 more

### android-393x852 / deeplink
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 27 more

### android-360x740 / initial
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### android-360x740 / layers
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### android-360x740 / grid
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- grid-panel-400kv-row rect.y: baseline=132 candidate=203 (Δ 71)
- … 25 more

### android-360x740 / about
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### android-360x740 / fullscreen
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- grid-panel-400kv-row rect.y: baseline=127 candidate=198 (Δ 71)
- … 28 more

### android-360x740 / deeplink
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 27 more

### iphone-390x844-geometry-only / initial
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### iphone-390x844-geometry-only / layers
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### iphone-390x844-geometry-only / grid
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- grid-panel-400kv-row rect.y: baseline=132 candidate=203 (Δ 71)
- … 25 more

### iphone-390x844-geometry-only / about
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 24 more

### iphone-390x844-geometry-only / fullscreen
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- grid-panel-400kv-row rect.y: baseline=127 candidate=198 (Δ 71)
- … 28 more

### iphone-390x844-geometry-only / deeplink
- grid-panel-body childCount: baseline=78 candidate=80
- grid-panel-body text: baseline="Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]11kV (UKPN) [WAIT]Subs [OK]Assets (GeoJSON)Nuclear [O" candidate="Weather (GeoJSON)Lightning (satellite flashes) [WAIT]Topology (GeoJSON)400kV [OK]275kV [OK]220kV [OK]132kV [OK]66kV [OK]"
- grid-panel-body inventory.groupCount: baseline=13 candidate=14
- grid-panel-body inventory.inputs: baseline=65 candidate=66
- grid-panel-body inventory.proxies: baseline=63 candidate=64
- grid-panel-body inventory.weather: baseline=0 candidate=1
- grid-panel-body inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"] candidate=["Weather (GeoJSON)","Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","PIPELINE NEWS (REPD)","Basemap"]
- grid-panel-body inventory.firstRows: baseline=["400kV [OK]","275kV [OK]","220kV [OK]","132kV [OK]"] candidate=["Lightning (satellite flashes) [WAIT]","400kV [OK]","275kV [OK]","220kV [OK]"]
- grid-panel-first-child text: baseline="Topology (GeoJSON)" candidate="Weather (GeoJSON)"
- grid-panel-first-layer-row count: baseline=65 candidate=66
- grid-panel-first-layer-row text: baseline="400kV [OK]" candidate="Lightning (satellite flashes) [WAIT]"
- scada-wrapper text: baseline="Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66kV [OK] 11kV (UKPN) [WAIT] Subs [OK]Assets (GeoJSON) Nu" candidate="Weather (GeoJSON) Lightning (satellite flashes) [WAIT]Topology (GeoJSON) 400kV [OK] 275kV [OK] 220kV [OK] 132kV [OK] 66k"
- … 27 more
