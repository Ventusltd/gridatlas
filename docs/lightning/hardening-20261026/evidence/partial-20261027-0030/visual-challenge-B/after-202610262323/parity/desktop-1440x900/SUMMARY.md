# Parity run 2026-10-26T23:48:00.886Z

baseline: http://127.0.0.1:8141/gridatlas/atlas/
candidate: http://127.0.0.1:8160/wt/atlas/v/202610262323/
offline shim: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs
fixtures: none
threshold: 0.1% changed pixels (channel > 16), geometry tolerance 1px
masks: #clock, #date, #days + map canvas
additive: [data-lightning-group]

suffix (live-count) mask: OFF (issue-32 mask list only)

## Verdict: FAIL

| viewport | state | changed px | changed px % | bbox | surface diffs (original / additive-host) | elements (base/cand) | moved | styleΔ | hitΔ | scrollΔ | styles equal | masks (base) | result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| desktop-1440x900 | initial | 0 | 0.000 | - | 0 / 8 | 1468/1468 | 1 | 0 | 0 | 2 | true | mask:3 mask-map:1 overlay:5 | FAIL |
| desktop-1440x900 | layers | 0 | 0.000 | - | 0 / 8 | 1468/1468 | 1 | 0 | 0 | 2 | true | mask:3 mask-map:1 overlay:5 | FAIL |
| desktop-1440x900 | grid | 0 | 0.000 | - | 0 / 8 | 1468/1468 | 1 | 0 | 0 | 2 | true | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1440x900 | about | 0 | 0.000 | - | 0 / 8 | 1468/1468 | 1 | 0 | 0 | 2 | true | mask:3 mask-map:1 overlay:8 | FAIL |
| desktop-1440x900 | fullscreen | 0 | 0.000 | - | 0 / 8 | 1468/1468 | 1 | 0 | 0 | 2 | true | mask:3 mask-map:1 overlay:8 | FAIL |
| desktop-1440x900 | deeplink | 0 | 0.000 | - | 0 / 8 | 1526/1526 | 1 | 0 | 0 | 2 | true | mask:3 mask-map:1 overlay:7 | FAIL |

## Geometry differences (first 12 per state)

### desktop-1440x900 / initial
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / layers
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / grid
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / about
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / fullscreen
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1440x900 / deeplink
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

## Every-element, scroll-area and hit-target differences (first 12 per state)

### desktop-1440x900 / initial
- MOVED (original) #1449 div.key-group: baseline=[17,1795,697,98] candidate=[17,1795,697,108] Δ={"x":0,"y":0,"width":0,"height":10}
- scroll #scada-ui-container scrollHeight: baseline=1361 candidate=1371 (Δ 10)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1019 candidate=1029 (Δ 10)

### desktop-1440x900 / layers
- MOVED (original) #1449 div.key-group: baseline=[17,1795,697,98] candidate=[17,1795,697,108] Δ={"x":0,"y":0,"width":0,"height":10}
- scroll #scada-ui-container scrollHeight: baseline=1361 candidate=1371 (Δ 10)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1019 candidate=1029 (Δ 10)

### desktop-1440x900 / grid
- MOVED (original) #1449 div.key-group: baseline=[17,1795,697,98] candidate=[17,1795,697,108] Δ={"x":0,"y":0,"width":0,"height":10}
- scroll #scada-ui-container scrollHeight: baseline=1361 candidate=1371 (Δ 10)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1019 candidate=1029 (Δ 10)

### desktop-1440x900 / about
- MOVED (original) #1449 div.key-group: baseline=[17,1795,697,98] candidate=[17,1795,697,108] Δ={"x":0,"y":0,"width":0,"height":10}
- scroll #scada-ui-container scrollHeight: baseline=1361 candidate=1371 (Δ 10)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1019 candidate=1029 (Δ 10)

### desktop-1440x900 / fullscreen
- MOVED (original) #1449 div.key-group: baseline=[17,1271,697,98] candidate=[17,1271,697,108] Δ={"x":0,"y":0,"width":0,"height":10}
- scroll #scada-ui-container scrollHeight: baseline=1361 candidate=1371 (Δ 10)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1019 candidate=1029 (Δ 10)

### desktop-1440x900 / deeplink
- MOVED (original) #1507 div.key-group: baseline=[17,1795,697,98] candidate=[17,1795,697,108] Δ={"x":0,"y":0,"width":0,"height":10}
- scroll #scada-ui-container scrollHeight: baseline=1361 candidate=1371 (Δ 10)
- scroll #scada-ui-container hiddenOverflowPx: baseline=1019 candidate=1029 (Δ 10)

## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)
- desktop-1440x900/initial: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- desktop-1440x900/layers: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- desktop-1440x900/grid: search-input=OTHER:div.status-dot; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 1002,100,374,512 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 1001,40,376,620 > div#map-container.map-container 4,4,1432,520 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900; fs-curtain-tab=OTHER:div.key-group clippedBy div#map-container.map-container 4,4,1432,520
- desktop-1440x900/about: search-input=OTHER:button; search-btn=OTHER:button; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900; about-last-control=ANCESTOR:div.custom-map-attrib
- desktop-1440x900/fullscreen: dash-toggle=OTHER:canvas.maplibregl-canvas; search-input=OTHER:div.gm-layer-group; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:canvas.maplibregl-canvas; layers-first-visible-row=OTHER:canvas.maplibregl-canvas; layers-last-visible-row=OTHER:input; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1406,342 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 1007,95,374,512 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 1006,35,376,620 > div#map-container.map-container.is-fullscreen 0,0,1440,900 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900; btn-fullscreen-exit=OUT-OF-VIEWPORT; curtain-400kv-row=OTHER:canvas.maplibregl-canvas; curtain-first-visible-row=OTHER:canvas.maplibregl-canvas; curtain-last-visible-row=OTHER:div#fs-curtain-tab
- desktop-1440x900/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900

## Candidate additive nodes and lightning toggle hit tests (P14), per state
- desktop-1440x900/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x108"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x108"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x108"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x108"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1440x900/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 728,1302 696x98","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1271 697x108"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,1440,630 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1406,342 > body.fs-active 0,0,1440,900 > html.gridatlas-menu-hosted.fs-active 0,0,1440,900"]
- desktop-1440x900/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x108"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
