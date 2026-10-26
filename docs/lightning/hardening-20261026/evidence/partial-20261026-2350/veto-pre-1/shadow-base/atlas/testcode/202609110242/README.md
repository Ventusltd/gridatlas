# Satellite-only test 202609110242

Test route: https://ventusltd.github.io/gridatlas/atlas/testcode/202609110242/

Isolated repair of test 202609110310. That failed historical test remains unchanged. The new generation stamp is UTC task-start time; the older test used a later-looking local-time stamp.

## Scope

The loader uses the existing production shell and exactly the same four hash-verified cartridges as production generation 202609080850 / v9.154. Only this new test loader and satellite.js supply new runtime behaviour. No production file, homepage, branding, engineering dataset, original control or release pointer is edited. Nothing is promoted to the production Atlas.

The satellite selector sits below the search control rather than over GRID/SUBS. It uses 44px controls, yields to existing menus/cards, and offers Dark, Esri, and Recent S2. The add-on consumes the existing map handle rather than replacing MapLibre's constructor. Imagery layers alone move beneath engineering overlays.

Sentinel requests are bounded to a scene covering the current map centre. TileJSON bounds and a zoom cap prevent irrelevant tile requests. The prior map stays visible until replacement tiles load. Recent scene/source reuse avoids unnecessary catalogue requests; cancellation and request ownership stop a late Sentinel response overriding the user's subsequent Esri selection. Original Dark/Satellite choices clear the additional layer correctly.

Sentinel is a single dated 10 m scene, not a live or seamless high-resolution basemap. Esri remains underneath outside the scene footprint, explicitly labelled. The latest acceptable scene is selected from at most 50 newest results within 60 days, preferring <=35% scene-wide cloud. That is not a cloud-free guarantee for the selected project. A new location requires pressing Recent S2 again. External imagery availability and first-load latency vary.

## Browser evidence

Candidate commit: deb51f868308f55e4453485ecf062ed438969f85
Run: https://github.com/Ventusltd/gridatlas/actions/runs/34557705346
Artifact: satellite-browser-evidence, ID 10183192763
Artifact SHA-256: 5e12c859901ee442a627718261d77ec0c4b377a21487fbefd3f921f9c783de94

82 scoped assertions passed in real Chrome on a GitHub runner using software WebGL. Phone viewports 393x852 and 852x393, plus 1440x900. Candidate index/JS were served by interception from the exact commit; all production cartridges, project data and external imagery services were real network requests. This is not a Safari/iPhone hardware certification or a full-estate audit.

Verified: actual GRID/SUBS on/off clicks in imagery modes; project-card open/minimised layout; top Grid menu; cancellation; cached Esri-to-S2 return without a new source or catalogue search; scene bounds/zoom limits; imagery below vector overlays; no uncaught JavaScript errors. 29 Esri and 19 S2 tile responses succeeded, zero imagery HTTP errors. First S2 transition was 1.85 seconds in this run, not a general speed guarantee. Both the regional offshore view and a separate Oxford-area map location displayed actual imagery in inspected screenshots.

Known independent baseline issue: in this Chrome fullscreen configuration the existing bottom LAYERS shortcut is behind the map canvas on the unmodified production page too. The top Grid menu works. This satellite-only change deliberately does not alter that unrelated control. The proof retains the baseline evidence and does not claim that shortcut passes a click test.

## Reproduce

Install Playwright and Chrome/Chromium, then run browser-proof.py. With PROBE_SHA unset it tests the actual public test route. With PROBE_SHA set it intercepts only the test loader and add-on from that immutable Git commit. Evidence is written to ./evidence. Failed assertions return a nonzero exit code.

Add-on SHA-256: 8bff3b7b1c5e26038f5229066863486be32cf8b0124badad28a7326723d4fe4a

Rollback: stop using this test URL and use /gridatlas/atlas/. The production composition was never changed.
