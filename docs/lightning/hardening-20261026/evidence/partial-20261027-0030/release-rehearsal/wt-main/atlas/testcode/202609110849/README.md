# Movable grid / imagery controls — test 202609110849

Isolated successor to 202609110242. Production Atlas, all four core cartridges, immutable release shell and homepage are unchanged.

The original GRID and SUBS button nodes are moved into the same dock as DARK, ESRI and S2; their existing click handlers remain the source of truth. Drag MOVE with mouse or touch; arrow keys move it; return arrow restores bottom docking. Placement gives priority to search results, native menus and project cards. Session-only dock position storage contains no project data.

SCENES offers newest acquisition or newest with at most 35% scene cloud and a dated acquisition selector. The default is newest. Scene cloud is not site cloud. RGB resolution is 10 m. The selected Sentinel scene is not a seamless worldwide basemap; Esri remains outside its footprint. No construction or project status is inferred from images.

The renderer retains bounds, two-slot tile staging, cancellation and cache reuse from the previous test. `build.py` verifies the baseline renderer SHA-256 and generates `satellite.js`, `index.html` and `manifest.json`. `dock-ui.js` is the authored UI tail; there is no production source edit.

Browser evidence must distinguish candidate interception of local test files from the actual published route. Imagery/data requests are real in both cases. Chrome device emulation is not physical-iPhone Safari acceptance. The pre-existing bottom LAYERS stacking issue is outside this patch; the native top Grid menu remains the layers route.
