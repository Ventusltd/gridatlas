# Parity run 2026-10-26T22:56:23.483Z

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
| desktop-1920x1080 | initial | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1920x1080 | layers | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:5 | PASS |
| desktop-1920x1080 | grid | 0 | 0.000 | - | 1 / 9 | 1468/1468 | 1 | 0 | 1 | 4 | true | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1920x1080 | about | 0 | 0.000 | - | 0 / 9 | 1468/1468 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:8 | PASS |
| desktop-1920x1080 | fullscreen | 0 | 0.000 | - | 1 / 9 | 1468/1468 | 1 | 0 | 1 | 4 | true | mask:3 mask-map:1 overlay:8 | FAIL |
| desktop-1920x1080 | deeplink | 0 | 0.000 | - | 0 / 9 | 1526/1526 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:7 | PASS |

## Geometry differences (first 12 per state)

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

### desktop-1920x1080 / about
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

### desktop-1920x1080 / fullscreen
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

### desktop-1920x1080 / deeplink
- [additive-host] menu-panel-Grid childCount: baseline=3 candidate=4
- [additive-host] scada-ui-container childCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.groupCount: baseline=13 candidate=14
- [additive-host] scada-ui-container inventory.inputs: baseline=65 candidate=68
- [additive-host] scada-ui-container inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]
- [additive-host] fs-curtain-keys childCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.groupCount: baseline=13 candidate=14
- [additive-host] fs-curtain-keys inventory.inputs: baseline=65 candidate=68
- [additive-host] fs-curtain-keys inventory.groups: baseline=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)"] candidate=["Topology (GeoJSON)","Assets (GeoJSON)","Supermarkets (GeoJSON)","Transit (GeoJSON)","Leisure & Sports (GeoJSON)","Global Data Backbone","Global Supply Chain & Chokepoints","Highway Infrastructure","EV (GeoJSON)","Heavy Industry","REPD (GeoJSON)","Basemap","PIPELINE NEWS (REPD)","Weather · EUMETSAT Lightning Imager"]

## Every-element, scroll-area and hit-target differences (first 12 per state)

### desktop-1920x1080 / grid
- MOVED (original) #297 div.gm-panel-body: baseline=[1481.67,100,374.45,512] candidate=[1481.67,100,374.45,434] Δ={"x":0,"y":0,"width":0,"height":-78}
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=512 candidate=434 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=931 candidate=1009 (Δ 78)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":1738.64,"y":524.34,"width":111.48,"height":58.53} "Battery Storage [WAIT]" candidate={"x":1738.64,"y":436.13,"width":111.48,"height":88.22} "Offshore Wind (Operational Only) [WAIT]"

### desktop-1920x1080 / fullscreen
- MOVED (original) #297 div.gm-panel-body: baseline=[1486.67,95,374.45,512] candidate=[1486.67,95,374.45,434] Δ={"x":0,"y":0,"width":0,"height":-78}
- scroll #gridatlas-menu-bar .gm-panel:not([hidden]) scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 scrollWidth: baseline=374 candidate=423 (Δ 49)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body clientHeight: baseline=512 candidate=434 (Δ -78)
- scroll #gridatlas-menu-bar-panel-4 .gm-panel-body hiddenOverflowPx: baseline=931 candidate=1009 (Δ 78)
- hit-target grid-last-visible-proxy rect (dynamic row: identity follows the visible area): baseline={"x":1743.64,"y":519.34,"width":111.48,"height":58.53} "Battery Storage [WAIT]" candidate={"x":1743.64,"y":431.13,"width":111.48,"height":88.22} "Offshore Wind (Operational Only) [WAIT]"

## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)
- desktop-1920x1080/initial: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080
- desktop-1920x1080/layers: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080
- desktop-1920x1080/grid: search-input=OTHER:div.status-dot; attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 1482,100,374,512 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 1481,40,376,620 > div#map-container.map-container 4,4,1912,632 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080
- desktop-1920x1080/about: search-input=OTHER:button; search-btn=OTHER:button; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080; about-last-control=ANCESTOR:div.custom-map-attrib
- desktop-1920x1080/fullscreen: dash-toggle=OTHER:canvas.maplibregl-canvas; search-input=OTHER:div.gm-layer-group; attribution=OUT-OF-VIEWPORT; layers-400kv-row=OTHER:canvas.maplibregl-canvas; layers-first-visible-row=OTHER:canvas.maplibregl-canvas; layers-last-visible-row=OTHER:canvas.maplibregl-canvas; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1886,410 > body.fs-active 0,0,1920,1080 > html.gridatlas-menu-hosted.fs-active 0,0,1920,1080; grid-last-proxy-in-dom=OUT-OF-VIEWPORT clippedBy div.gm-panel-body 1487,95,374,512 > div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid 1486,35,376,620 > div#map-container.map-container.is-fullscreen 0,0,1920,1080 > body.fs-active 0,0,1920,1080 > html.gridatlas-menu-hosted.fs-active 0,0,1920,1080; btn-fullscreen-exit=OUT-OF-VIEWPORT; curtain-400kv-row=OTHER:canvas.maplibregl-canvas; curtain-first-visible-row=OTHER:canvas.maplibregl-canvas; curtain-last-visible-row=OTHER:canvas.maplibregl-canvas
- desktop-1920x1080/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080

## Candidate additive nodes and lightning toggle hit tests (P14), per state
- desktop-1920x1080/initial: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
- desktop-1920x1080/layers: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
- desktop-1920x1080/grid: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 1481.67,534 374.45x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
- desktop-1920x1080/about: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
- desktop-1920x1080/fullscreen: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 968,1302 936x98","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 1486.67,529 374.45x78","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1271 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT clippedBy div#fs-curtain.curtain-open 0,0,1920,756 > body.fs-active 0,0,1920,1080 > html.gridatlas-menu-hosted.fs-active 0,0,1920,1080","lightning-toggle-menu:self","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,17,1886,410 > body.fs-active 0,0,1920,1080 > html.gridatlas-menu-hosted.fs-active 0,0,1920,1080"]
- desktop-1920x1080/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 966,1906.61 937x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1912,632","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,653,1886,410 > body 0,0,1920,1080 > html.gridatlas-menu-hosted 0,0,1920,1080"]
