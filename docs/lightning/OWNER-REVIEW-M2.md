# Owner review: Build M2 (202610282100)

This takes about 15 minutes on your iPhone, in the same in-app browser you used for L3. PR #55 is merged, so the preview is live. The live map stays on L3 until you pass this and ChatGPT's veto passes.

**What is new since L3.** A lightning tap still shows the 5 nearest substations. It now also shows the 10 nearest REPD sites within 40 km:
- schemes at one point are grouped;
- Status and Tech filters;
- a 10 km / 40 km summary;
- tapping a project stays on the page, with "◀ back".

To fit it, the cartridge limit went from 480 kB to 500 kB, as you decided at 20:51 ("Raise the limit if needed make the feature comprehensive"). M2 uses 487 kB.

1. **Open** https://ventusltd.github.io/gridatlas/atlas/v/202610282100/
2. **Arrival.** It must look exactly like the live map (https://ventusltd.github.io/gridatlas/atlas/): GRID and SUBS off, "▲ LAYERS" closed, no lightning. *Fail* if anything differs before you tap.
3. **L3 still works.** LAYERS → last group → Lightning ON. Check that:
   - 24H–30D show dots;
   - 12M shows violet cells;
   - every tap fires the neon lines to about 5 substations ("km · kV").
4. **Tap a busy 12M cell near Lincoln.** The card says "REPD projects: loading…" for a few seconds the first time (up to 15 s on mobile data). Then orange dashed lines run to up to 10 projects, labelled e.g. "2.36 km · Solar 49.9 MW".
5. **Open the list.** Tap the card's summary line (it ends "· 10 nearest projects"). You see:
   - the line "N REPD projects within 10 km · M within 40 km · total X MW within 10 km";
   - two rows of buttons, Status and Tech;
   - 10 rows of "km · technology MW · status · name".

   A grouped scheme shows "2 co-located" with its parts listed underneath, and has one line and one label on the map. Nothing should run off the right-hand edge.
6. **Filters.**
   - Tap Status → **Operational**: the list, the orange lines and the summary change.
   - Tap Tech → **Solar** (this includes rooftop solar): both filters apply.
   - Try a pair that leaves nothing nearby: it says "No REPD project within 40 km". Tap another cell: your filter is kept.
   - Set both back to **All**.
7. **Row tap.** Tap a project row.
   - The page must not reload. The map flies to the project and draws lines to its nearest substations.
   - The card says "not its declared grid connection" and shows how far the project is from the lightning cell.
8. **Back.** Tap "◀ back to lightning cell". The lightning card, its substation lines, the project lines and your filter all return. Repeat once from a 7D dot: the button then reads "◀ back to lightning flash".
9. **Sparse area.** Tap a cell on Harris in the Western Isles. It shows only 2 sites, with the line "Only 2 sites within 40 km; the radius stays 40 km, so fewer than 10 are listed." Do a row tap and then back.
10. **Labels.** Both kinds of label are readable, "km · kV" for substations and "km · technology MW" for projects. They do not pile on top of each other at zoom 8–10.
11. **Coastline.** At zoom 5 and at zoom 10 the coastline is still readable under the cells and under the orange lines.
12. **Wording.** The cards say:
    - optical flashes, not ground strikes;
    - unsearched days are unknown, not zero;
    - projects and substations are the "nearest" by straight line, "not evidence any project was struck or affected";
    - capacity is "not a measure of impact".
13. **Close and OFF.** Tap ×, then turn Lightning OFF. Every line, label and card disappears, and the map is as it was on arrival.

**How to reply.** Post on GitHub issue #32 with the heading `M2 202610282100 · iPhone`:
- one line per step, `step N: PASS` or `step N: FAIL – what you saw`;
- a screenshot for each fail;
- the time;
- a last line `RESULT: pass` or `RESULT: fail (steps …)`.

A plain "yes it's good" with screenshots also works.

**Release.** After your pass and ChatGPT's V1–V15 veto, the release is one commit that moves `atlas/current.json` and STATE.md to 202610282100. The 500 kB gate is already on main. Rollback is a `git revert` of that commit, which puts L3 back exactly.

**Known limits.**
- On the first view of a busy cell, one project end may sit just under the card. Drag the map or collapse the card.
- A project's substation lines are the nearest by distance. They are not its real grid connection, and they are not the engine's own popup (there is no 400 kV or NESO row).
- The first tap after a reload loads the REPD register (about 1.5 MB) if no REPD layer is on.
- If it fails, the card says "Tap again to retry"; if that fails too, reload.
- Steps 4–11 have not run on a real iPhone or in Safari before, so your screenshots of the labels, the coastline and the row tap and back matter most.
