# For ChatGPT: parallel veto on Lightning Build L (28 Oct 2026, ~13:30 UTC)

> Updated 28 Oct 2026 ~14:20 UTC: the target is now Build L3, generation 202610281340. It is L2 (202610281250) plus all review fixes, listed in CANDIDATE-202610281340-L3-progress.md. Where this text says L2, read L3.


This follows `docs/lightning/hardening-20261026/kv/CHATGPT-PARALLEL.md` (Build I, 27 Oct). The owner still approves everything except moving the live pointer, which stays at **202609241334**. Your V1–V15 veto remains the release gate.

## Preview URLs
| Build | Generation | URL | Status |
|---|---|---|---|
| Live (original) | 202609241334 | https://ventusltd.github.io/gridatlas/atlas/ | baseline for pixel parity |
| J | 202610271740 (v9.168, PR #45) | https://ventusltd.github.io/gridatlas/atlas/v/202610271740/ | predecessor; regression reference |
| K | 202610280950 (v9.169, PR #46) | https://ventusltd.github.io/gridatlas/atlas/v/202610280950/ | rejected by the owner |
| **L2** | **202610281340 (v9.171, PR #47)** | **https://ventusltd.github.io/gridatlas/atlas/v/202610281340/** | **candidate under review** |

L1 (202610281225, v9.170) was built but never published; L2 differs from it only in the cell paint. Reference for "engine firing": the project deep link https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588&technology=solar&latitude=51.8132088&longitude=-1.3489728&zoom=12

Module: `atlas/modules/202610281340-uk-lightning-overlay.js`, 44,655 B (cap 44,781; 126 B spare). Cartridge 479,874 B (cap 480,000). Branch commit 2848cde; gridatlas main c3666d5.

## What changed, and why
**I → J (27 Oct).** The owner said a tapped flash did not "fire the substation engine". J binds the tap to the original `window.__GRIDATLAS_NEON_LINKS__.measure.nearestSubstations`: the map frames the flash, a pulsing origin appears, neon links run to about 5 nearest substations (labelled e.g. "4.21 km · 33 kV"), and a compact docked card replaces the tall box. Period captions say plainly what was searched.

**J stops firing (overnight 27–28 Oct).** Nothing in J changed. The parallel backfill grew the archive from 3,050 to 364,980 flashes. Above the phone cap (10,000 points) J goes into summary mode, so 3M, 6M and 12M drew no dots and there was nothing to tap (L-repro-J: hypothesis A confirmed). A data-format change (lightning PR #13/#14) was ruled out: all 366 index rows, 304 shards and 364,980 features validate.

**J → K (28 Oct, 09:50).** K added the monthly 0.1° cell grid (`data/history/grid/YYYY-MM.json`) and drew long periods as a yellow heatmap. The owner called it "awful". Two reasons:
- Nothing was tappable: the tap queried only the point layer, so 0 of 11 cell taps fired anything.
- The smear covered Ireland, the seas and northern France, because the collector's box (-11, 49.5, 3, 61.5) holds 47% of flashes outside the UK. The heatmap kernel made it look worse.

**K → L2 (28 Oct, 12:50).** L keeps J's code and adds only the cells:
- **Short periods (12H–30D)** are unchanged from J: individual tappable dots.
- **Long periods above the cap (3M, 6M, 12M)** draw small graduated circles, one per ≈10 km cell. They are faint violet pixels for 1–13 flashes and larger magenta circles for 88 or more; only the busiest ~5% glow. No heatmap code remains. The violet palette is chosen so it cannot be confused with the yellow-to-red solar project dots.
- **Land clip.** Only cells within ≈30 km of UK land are drawn. Totals still count every cell, and the caption says "sea and abroad not drawn".
- **Every cell tap fires the engine** from the cell centre (22 px hit area): the same neon links and docked card as a flash. The card reads "N observed optical flashes · ≈10 km cell", with the window's UTC dates and "unsearched days unknown, not zero".
- **Tap priority:** a flash or cluster under the finger wins. Next comes a visible project or substation, where the original's own engine fires and Lightning stays silent. Otherwise the nearest cell fires.
- **LOAD POINTS** still adds the newest 40,000 flashes as tappable points (clustered on a phone).

Builder's results: test-engine 122/122, test-fixes 104/104, your suites chatgpt-latest 8/8 and chatgpt-lightning-regression 6/6. With lightning OFF, arrival is pixel-identical to live at 393×852 and 393×659, with 0 lightning requests.

## What to test on the owner's iPhone (L2)
Use the same in-app browser as before. Numbers below are from the 12:03 UTC data; they grow as the collector runs.
1. Open L2. Before touching anything, compare with live: GRID and SUBS off, LAYERS closed, no lightning. Any difference is a V5/V6 fail.
2. LAYERS → last group → Lightning is OFF. Turn it ON.
3. **24H, 48H, 7D, 30D:** J-style dots (at least 4 px, dark outline). Tap one dot per period: the map frames it, the origin pulses, about 5 neon links appear with "km · kV" labels, and the card docks without covering the links.
4. **12M:** small faint violet cells over GB and NI, a few bright glowing ones along the storm tracks. *Fail* on any blurry smear, or cells out at sea, over Ireland's west coast or inland France. The status line reads roughly "364,980 FLASHES · 266 OF 366 DAYS SEARCHED".
5. Read the 12M caption: "observed optical flashes per ≈10 km cell (not ground strikes)", drawn vs total, "within ≈30 km of UK land", "unsearched days unknown, not zero", and "tap a cell for nearest substations".
6. **Tap a bright cell** (for example near Newark, -0.85/52.75). The engine fires with about 5 links, and the card reads "N observed optical flashes · ≈10 km cell" with UTC dates.
7. **Tap a faint cell** (1–3 flashes) away from any project. It must still fire. This is the one path the builder did not tap in a browser.
8. Tap a solar project dot where it overlaps cells. The original project engine fires, not a lightning card. This path was not exercised in a browser either.
9. Repeat 4–6 on **3M** and **6M**. Then on 12M press **LOAD POINTS**: clusters appear over the cells, and an expanded flash fires the engine.
10. Pinch to zoom 5 → 10. Cells grow but stay small; the coastline and basemap stay readable. Turn lightning OFF: everything Lightning drew is gone.

Also run your V1–V15 suite on L2 and diff against J (202610271740) for V9/V10 wording.

## Known residuals (not bugs unless you disagree)
- **Day granularity:** cells sum whole UTC days, so a window's partial first day counts in full. The card's dates say so.
- **Mask edges:** the land mask comes from onshore REPD sites (30 km). Some Republic of Ireland cells near the NI border are drawn, and the Dover Strait edge touches Calais.
- **Drawn vs total:** at 12M, 174,268 of 364,980 flashes are drawn (4,695 of 11,010 cells). The rest are off the UK and are named, not hidden.
- **Not browser-tested:** a tap on an n ≤ 3 cell, the project-wins path, and WebKit/Safari generally. Your iPhone run is the first WebKit evidence.
- **Coastline under cells** could not be checked in the offline harness, which has no basemap tiles.
- **Neon labels** were blank in the harness (no glyphs); they should show on the real basemap.
- **Byte headroom** is 126 B, so any fix must be tiny or save bytes elsewhere.

## Wording guard (V9/V10)
- An optical flash is not a ground strike.
- Unknown is not zero.
- The nearest substations are not "affected".
Flag any text that breaks these.

## How to report
- Post on GitHub issue **#32** (coordination stays on GitHub only). Head the comment `L2 202610281340 · iPhone` or `L2 202610281340 · V1–V15`.
- Give one line per step: `step N: PASS`, or `step N: FAIL – what you saw`, with a screenshot for each fail. Note the UTC time and the iOS and in-app browser version.
- For V1–V15, use PASS, FAIL or NOT_TESTED per V-number, with file:line where it applies. Mark the severity BLOCKER, MAJOR or MINOR.
- End with `RESULT: pass` or `RESULT: fail (steps …)`. The owner's pass plus your veto pass are both needed before the two-commit release (delete the old preview workflow, then move `atlas/current.json` and STATE.md). Rollback is `git revert` of the release commit.
