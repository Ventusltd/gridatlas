# Owner review: Build L (202610281340)

> Updated 28 Oct 2026 ~14:20 UTC: the target is now Build L3, generation 202610281340. It is L2 (202610281250) plus all review fixes, listed in CANDIDATE-202610281340-L3-progress.md. Where this text says L2, read L3.


This takes about 10 minutes on your iPhone, in the same in-app browser you used before. PR #47 is already merged, so the preview is live.

1. Open https://ventusltd.github.io/gridatlas/atlas/v/202610281340/
2. **Arrival.** The page should look exactly like the original full-screen map: GRID and SUBS off, "▲ LAYERS" closed, and no lightning. Compare it with the live map at https://ventusltd.github.io/gridatlas/atlas/. *Fail* if anything differs before you tap.
3. Tap LAYERS and scroll to the end. Lightning is the last group, and it is OFF. Turn it ON.
4. **Short periods (24H, 48H, 7D, 30D).** You get Build J's individual dots. Tap one dot in each period. The map frames it, the origin pulses, neon lines run to about 5 substations labelled e.g. "4.21 km · 33 kV", and the card docks at the bottom. *Fail* if any tap does nothing.
5. **12M.** You get small, faint violet cells over Great Britain and Northern Ireland, with a few brighter glowing ones where storms were busiest. *Fail* if you see a blurry yellow smear, or cells out at sea, along Ireland's west coast or over France.
6. **Tap a bright cell.** The same engine fires from the cell centre, with neon lines to the nearest substations. The card reads "N observed optical flashes · ≈10 km cell", followed by the UTC dates.
7. **Tap a faint cell** well away from any project. It must fire too. Then tap a solar project dot that sits among cells: the original project engine should fire, not a lightning card.
8. **3M and 6M.** These are drawn as cells like 12M, and every tap fires. On 12M, press LOAD POINTS: flash clusters appear over the cells, and tapping an expanded flash fires the engine.
9. **Wording.** Read the 12M caption and one card. They must say optical flashes, not ground strikes; unsearched days are unknown, not zero; and the substations are "nearest", never "affected". Also check that the coastline is still readable under the cells at zoom 5 and at zoom 10.
10. Turn lightning OFF. Everything it drew disappears, and the map is as it was. Reply with RESULT: pass / fail, plus the step numbers and screenshots of any failures.

After your pass and ChatGPT's V1–V15 veto, a release is two commits: first delete the old preview workflow, then the release commit moving atlas/current.json and STATE.md to 202610281340. The commands are in `evidence/release-rehearsal-E/RELEASE-COMMANDS.md`; substitute 202610281340 for 202610270024. Rollback is `git revert` of the release commit.

Known limits: cells count whole UTC days. A few cells near the Northern Ireland border and at Dover are drawn. Steps 7 and 9 (faint-cell tap, project-wins, coastline) have not yet been checked on a real phone, so your screenshots of them matter most.
