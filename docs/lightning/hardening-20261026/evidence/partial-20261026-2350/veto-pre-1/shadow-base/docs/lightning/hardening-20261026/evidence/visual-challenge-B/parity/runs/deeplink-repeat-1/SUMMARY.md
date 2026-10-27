# Parity run 2026-10-26T22:47:43.155Z

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
| desktop-1440x900 | deeplink | 157287 | 18.503 | 17,41 768x487 | 5 / 9 | 1524/1524 | 55 | 0 | 2 | 0 | true | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1280x720 | deeplink | 14 | 0.002 | 542,41 147x174 | 0 / 9 | 1524/1524 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:7 | PASS |

## Geometry differences (first 12 per state)

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
- [original] project-card-popup rect.x: baseline=205.22 candidate=17 (Δ -188.22)
- [original] project-card-popup rect.y: baseline=89 candidate=53 (Δ -36)
- [original] project-card-popup rect.height: baseline=440 candidate=452 (Δ 12)
- … 2 more

### desktop-1280x720 / deeplink
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

### desktop-1440x900 / deeplink
- MOVED (original) #1183 div.maplibregl-popup.gridatlas-free.maplibregl-popup-anchor-top: baseline=[205.22,89,340,440] candidate=[17,53,340,452] Δ={"x":-188.22,"y":-36,"width":0,"height":12}
- MOVED (original) #1185 div.maplibregl-popup-content: baseline=[205.22,89,340,440] candidate=[17,53,340,452] Δ={"x":-188.22,"y":-36,"width":0,"height":12}
- MOVED (original) #1186 div.gridatlas-card-bar: baseline=[208.22,92,334,55] candidate=[20,56,334,55] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- MOVED (original) #1187 span.grip: baseline=[214.22,109,26,20] candidate=[26,73,26,20] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- MOVED (original) #1188 span.label: baseline=[246.22,109,114.39,20] candidate=[58,73,114.39,20] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- MOVED (original) #1189 span.spacer: baseline=[366.61,119,69.61,0] candidate=[178.39,83,69.61,0] Δ={"x":-188.22000000000003,"y":-36,"width":0,"height":0}
- MOVED (original) #1190 button.min: baseline=[442.22,97,44,44] candidate=[254,61,44,44] Δ={"x":-188.22000000000003,"y":-36,"width":0,"height":0}
- MOVED (original) #1191 button.close: baseline=[492.22,97,44,44] candidate=[304,61,44,44] Δ={"x":-188.22000000000003,"y":-36,"width":0,"height":0}
- MOVED (original) #1192 div: baseline=[214.22,153,322,73] candidate=[26,117,322,73] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- MOVED (original) #1193 b: baseline=[220.22,161,148.72,15] candidate=[32,125,148.72,15] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- MOVED (original) #1194 br: baseline=[368.94,162,0,14] candidate=[180.72,126,0,14] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- MOVED (original) #1195 span: baseline=[220.22,182,36.13,14] candidate=[32,146,36.13,14] Δ={"x":-188.22,"y":-36,"width":0,"height":0}
- … 43 more moved elements
- hit-target card-bar rect: baseline={"x":208.22,"y":92,"width":334,"height":55} "⋮⋮Deep-linked project−×" candidate={"x":20,"y":56,"width":334,"height":55} "⋮⋮Deep-linked project−×"
- hit-target card-bar-first-button rect: baseline={"x":442.22,"y":97,"width":44,"height":44} "−" candidate={"x":254,"y":61,"width":44,"height":44} "−"

## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)
- desktop-1440x900/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- desktop-1280x720/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720

## Candidate additive nodes and lightning toggle hit tests (P14), per state
- desktop-1440x900/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1280x720/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1683.41 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720"]
