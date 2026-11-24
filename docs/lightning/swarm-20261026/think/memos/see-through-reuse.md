# See Through code reuse for a lightning descent

Paths are under `/home/claude/ventusltd/kuiper-belt/see-through/202610050609/` unless stated; `PLAN.md` is `scratchpad/lightning/PLAN.md`.

## Reusable
- **Stage machine.** The depth `D` runs from 0 to 8 (`descent.js:21`). It drives `camera` (251–263), `frame` (519–568), the scripted fall `flightDepth` (428–437), `flyTo` (417–425) and `arrive` (855–859). All are target-agnostic.
- **Stars and gather.** `KuiperLaw.place` (`kuiper-law.js:44–51`) places the particles built at 950–967, which blend onto targets at 586–595. Stars are code keys (`kuiper-law.js:36`), so decoration: keep `descent.js:11`'s disclaimer (cvaa compute vaccine).
- **Porthole.** A clip-path circle (168–169), `loadMap` (277–320) and `syncMap` (335–345), with honest failure messages (321–334, 824–832).
- **3D ground.** In `see3d.js`: `enter` (165–199), the terrain clamp (177–178, 223–228), one GL_LINES layer (113–155), and `fitZoom` with `tipTo` (200–207).
- **Pylons.** In `model.js`: `lattice` (150–167), `towersOn` (171–197), `sagLine` (140–148) and `KV` (31–37).
- **Place frame.** `pf.js` is upstream `place-frame.mjs` with only `export` removed (checked with diff). `pack` uses it (`see3d.js:97–106`).
- **Joystick.** `see3d.js:301–314` plus `move` (271–287). `vendor/joystick.js` is never loaded.

## Substation-specific
- **Target identity.** Every target is a substation index: `nameOf`, `voltText` and `opText` (93–100), name search (389–415), `nearestToCentre` (570–574). The 3D handoff passes `rec={i,name,lat,lon,volt}` (376). Its `i` is the row position in atlas-v9, used to look up footprints (`see3d.js:189`) and `data/osm/<i>.json` (`see3d.js:61–63`).
- **Star count.** `pSub[p]=p%NSUB` (965) gives each target a star only while stars outnumber targets. Phones draw 12,900 stars (955), so 40,000 flashes (the collector's cap) would leave 27,100 flashes with no star.
- **Towers need a fence.** `SeeModel.substation` (200–452) grows towers only from fence gantries (416–418, 184–185). A flash beside a line needs a fence-free entry point.
- **Depth.** `ZEND=16` (22) and `fitZoom`'s 14.2–18.6 range (`see3d.js:203`) assume a surveyed point. Lightning Imager accuracy is not recorded on this machine: unknown. The fall should stop at an uncertainty disc.
- **Distance.** SPIDER's nearest-six search (503–510) is the "nearest substation" kernel, but `km(i,j)` only takes substation indices (104–108).
- **Naming.** `X.flash` (`see3d.js:146,259`) already means busbar energising.
- **Policy.** `/home/claude/lightning/README.md` says "No particular site is targeted, analysed or named." Naming one is the owner's call.

## Embedded data to become loaded contracts
- **`SUB` table** (line 15): 84,950 characters, 5,800 rows. Its builder (`build_descent_data.py`, `DESCENT-MAP.md`) is not on this machine.
- **`FRAME` constants** (38–39): fitted to `grid-data.js` (587 kB).
- **Pinned release:** atlas-v9 202608300453 (`descent.js:30`, `see3d.js:22`).
- **Joins by row order** across SUB, grid-data, atlas-v9 and the footprints file (1.18 MB). These should use stable OpenStreetMap ids.
- **Flashes** arrive as archive-contract rows (`PLAN.md:38`), never embedded.

## Licence
- **The CERN-OHL-S v2 text.** §3.2 (`licences/…txt:151–153`): "Including Covered Source in a larger work is modifying the Covered Source". §3.3(d) (168–174): the whole modified work takes the same licence.
- **Covered files.** Per `NOTICE.md`, `pf.js`, `model.js`, `see3d.js` and the joystick derive from globalgrid2050 (CERN-OHL-S). A lightning fork of them is CERN-OHL-S and needs a dated modification notice and a source location (§3.3(b), §3.3(c), §4).
- **GridAtlas is Apache-2.0** (its LICENSE and NOTICE), with no CERN text in the tree. Including the covered files makes the combined work CERN-OHL-S, unless the owner relicenses them. Unknown: whether globalgrid2050 has outside contributors.
- **An Apache-2.0 2D descent already exists:** `learn-the-kuiper/202610050609/modules/descent.js` (per its NOTICE.md), with the same SUB line and no 3D. See Through relabelled it, after a 355-line diff, as CERN-OHL-S.
- **ODbL.** Joining flashes to OpenStreetMap substations makes a derivative database, so share-alike applies.

## Fit with GridAtlas
- **Not a cartridge.** See Through's own code is 249 kB; the cartridge has 24,782 bytes of headroom (`PLAN.md:16`).
- **MapLibre version.** GridAtlas runs 3.6.2 (`gridatlas/atlas/releases/202608300453-atlas-v9/index.html:8`). `see3d.js` targets 4.7.1 and touches internals (177, 267) untested on 3.6.2.
- **Load.** Boot is 1.71 MB; 3D adds 5.99 MB of lines.
- **So: a separate page** reading the cartridge's contract, a complement rather than a replacement.

## Recommendations
1. Build the lightning descent as a separate CERN-OHL-S page; GridAtlas links to it and never includes it.
2. First extract a target contract `{id, lat, lon, label, accuracy_m, kind}` with OpenStreetMap ids.
3. Stop the fall at the uncertainty disc and keep "optical flash, not a ground strike; stars are decoration" on screen.

**What would change my mind:** the owner relicensing `pf.js`, `model.js` and `see3d.js` to Apache-2.0 while GridAtlas moves to MapLibre 4.x.
