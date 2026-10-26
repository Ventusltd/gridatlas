# Parity run 2026-10-26T22:51:22.632Z

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
| desktop-1440x900 | deeplink | 2 | 0.000 | 671,41 2x1 | 0 / 9 | 1524/1524 | 0 | 2 | 0 | 0 | true | mask:3 mask-map:1 overlay:7 | FAIL |
| desktop-1280x720 | deeplink | 8 | 0.001 | 542,41 147x174 | 0 / 9 | 1524/1524 | 0 | 0 | 0 | 0 | true | mask:3 mask-map:1 overlay:7 | PASS |

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
- style #161 span#fs-lbl-solar: baseline="Courier New", monospace|11px|400|normal|rgb(255, 255, 0)|rgba(0, 0, 0, 0)|auto|block|visible|static|1 candidate="Courier New", monospace|11px|400|normal|rgb(255, 255, 0)|rgba(0, 0, 0, 0)|auto|block|visible|static|0.5
- style #1453 span#lbl-solar: baseline="Courier New", monospace|13px|400|normal|rgb(255, 255, 0)|rgba(0, 0, 0, 0)|auto|block|visible|static|1 candidate="Courier New", monospace|13px|400|normal|rgb(255, 255, 0)|rgba(0, 0, 0, 0)|auto|block|visible|static|0.5

## Pre-existing hit targets not resolving to themselves on BOTH routes (identical result, not a regression)
- desktop-1440x900/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900
- desktop-1280x720/deeplink: attribution=OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408; layers-first-pipeline-row=OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720

## Candidate additive nodes and lightning toggle hit tests (P14), per state
- desktop-1440x900/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 726,1795 697x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1432,520","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,541,1406,342 > body 0,0,1440,900 > html.gridatlas-menu-hosted 0,0,1440,900"]
- desktop-1280x720/deeplink: additive=["div.key-group[data-lightning-group=fs] @div#fs-curtain-keys[13/14] 0,0 0x0","div[data-lightning-group=menu] @div#gridatlas-menu-bar-panel-4.gm-panel.gm-panel-grid[2/4] 0,0 0x0","div.key-group[data-lightning-group=main] @div#scada-ui-container.scada-keys[13/14] 646,1683.41 617x98"] toggles=["lightning-toggle-fs:OUT-OF-VIEWPORT","lightning-toggle-menu:OUT-OF-VIEWPORT clippedBy div#map-container.map-container 4,4,1272,408","lightning-toggle-main:OUT-OF-VIEWPORT clippedBy div#scada-ui-container.scada-keys 17,429,1246,274 > body 0,0,1280,720 > html.gridatlas-menu-hosted 0,0,1280,720"]
