# For ChatGPT: parallel veto on Lightning Build M2 (28 Oct 2026, ~22:30 UTC)

This follows `docs/lightning/CHATGPT-PARALLEL-L.md` (Build L3). L3 is now live: the owner passed it on his iPhone at 18:51 UTC and it was released through PR #49. M2 is a preview only; the live pointer stays at **202610281340** until the owner's iPhone pass and your V1–V15 veto.

## Preview URLs
| Build | Generation | URL | Status |
|---|---|---|---|
| **Live (L3)** | 202610281340 (v9.172) | https://ventusltd.github.io/gridatlas/atlas/ | baseline for pixel parity and regression |
| M | 202610281950 (v9.173, PR #50) | https://ventusltd.github.io/gridatlas/atlas/v/202610281950/ | superseded by M2 |
| **M2** | **202610282100 (v9.174, PR #55)** | **https://ventusltd.github.io/gridatlas/atlas/v/202610282100/** | **candidate under review** |

- Module: `atlas/modules/202610282100-uk-lightning-overlay.js`, 52,062 B (cap 64,781 B).
- Cartridge: `atlas/cartridges/202610282100-sld-sandbox-v9-8.js`, 487,281 B (gate 500,000 B). It is still the original 202609241334 sld bytes + "\n" + the module.
- gridatlas main: `fa992a6` (M2 publish) on top of `edb17db` (gate raise). PR #55 head `fbd3cdf`: size-guard and cartridge-gate both green. Pages deploy and live-bytes checks are green on `fa992a6`.
- Build notes: `docs/lightning/CANDIDATE-202610282100-M2-progress.md`.
- A first, fixes-only generation 202610282040 was cut before the owner widened the scope. It was never published and reuses v9.174. Ignore it.

## What changed, and why

**L3 (live).** The 12M/6M/3M cells and the short-period dots both fire the original Grid Engine (`window.__GRIDATLAS_NEON_LINKS__.measure.nearestSubstations`): about 5 neon links labelled "km · kV" and a docked card.

**L3 → M (202610281950, PR #50).** The owner asked for a lightning tap to show the nearby renewable projects as well as the substations.
- The 10 nearest REPD projects within 40 km of the flash or cell centre are drawn as dashed orange-to-red links (capacity ramp #fa0 → #ff4400 at 50 MW → red at 200 MW), with labels such as "2.36 km · Solar 49.9 MW". All 13 technologies and all 4 statuses are included.
- The register is the map's own: the engine's `src-repd` data if a REPD layer has loaded it, otherwise `/dist/repd_master.json` through the untouched parquet bridge (10,784 rows, pinned `repd_master_v8_oracle.parquet`). Distances use the original `link.measure.distanceKm`.
- To fit the 480 kB gate, M first saved 2,341 B with no change in behaviour (comments, aliases, `const` → `let`). The MR review proved this neutral by an AST diff and identical per-test outcomes.
- MR found four MINOR problems: no timeout on the register fetch (MR1), exact duplicate rows listed twice (MR2), sites tied with the 10th cut arbitrarily (MR3), and a register landing mid-move never framed (MR4). M also listed co-located scheme parts separately with overlapping labels, and a row tap reloaded the page, losing the lightning view.

**M → M2 (202610282100, PR #55).** The owner said (20:51 UTC): "Raise the limit if needed make the feature comprehensive". M2 has:
- **MR1–MR4 fixed.** The register is fetched through `gj`: a 15 s timeout that also covers the body, redirect refusal and "HTTP n". A stalled body reports "timeout after 15 s". The first failure says "Tap again to retry". A repeated failure also advises switching on a REPD layer or reloading, because the bridge keeps a failed start for the page's lifetime.
- **Co-located parts grouped.** Projects at the same point share one link and one label, e.g. "4.99 km · Biomass (dedicated) + Rooftop solar 1.14 MW". The card row says "N co-located" and lists every part beneath it.
- **Filter chips (44 px).**
  - Status: All / Operational / Consented & construction (under construction plus awaiting construction) / Planning (application submitted).
  - Tech: All / Solar (includes rooftop) / Wind / BESS / Other.
  - The nearest 10 sites are re-ranked within the filter, and the links and camera follow. The filter is kept for later taps until the page reloads.
- **Summary line:** "N REPD projects within 10 km · M within 40 km · total X MW within 10 km", which names rows with no stated capacity and ends "registered capacity, straight-line distance only, not a measure of impact".
- **Fewer than 10:** "Only N sites within 40 km; the radius stays 40 km, so fewer than 10 are listed."
- **A row tap stays in the page.** The map flies to the project and draws its own nearest substations. The card says "not its declared grid connection", and "◀ back to lightning cell" (or "flash") restores the card, links and filter. The row's `href` keeps the coordinate deep link for a new tab. The original `selectAt` and arrival path are deliberately not used.
- **Camera:** the `fitBounds` bottom padding is clamped to the container height − 270, so an expanded card can no longer make the fit silently do nothing.

**Builder's results.**
- test-engine 176/176 (8 runs), test-fixes 104/104, your suites chatgpt-latest 8/8 and chatgpt-lightning-regression 6/6 (3 runs each). 17 of 18 new or changed tests fail first on M.
- All 12 proofs, lint, state parity, run-current, verify-compose and verify-candidate pass.
- With lightning OFF, arrival is pixel-identical to live L3 at 393×659 and 393×852: 0 differing pixels, equal DOM and layers, and 0 lightning or REPD requests.

## The 500 kB gate decision
- **Owner decision,** 28 Oct 2026, 20:51 UTC: "Raise the limit if needed make the feature comprehensive."
- **Commit `edb17db` on main** changes one line, `tools/scope/loop.mjs:194`: 480_000 → 500_000. It is separate from the generation so that it can be reviewed or reverted on its own. The live L3 cartridge was already under both limits.
- **Module cap** = gate − original sld base − 1 newline = 64,781 B. M2 uses 52,062 B, so 12,719 B is spare.
- **Same caveat as before.** The 400 kB target and the planned split of substation-intelligence into assembled parts still stand. The code comment there says the number must not rise again, and the owner has overridden it twice (460 → 480 → 500). Treat any further rise as a new owner decision.
- **Check your own suite.** `docs/CI.md` still says "the 480 kB ceiling" (text only; the gate enforces 500). If testcode (PR #7, G05/G06) hard-codes 480 kB, M2 will fail it. Update the check to 500 kB and cite this decision; do not record it as an M2 defect.

## What to test on the owner's iPhone (M2)
Use the same in-app browser as for L3. The example places below are from the builder's 12M data; counts grow as the collector runs.

1. **Arrival.** Open M2. Before touching anything, compare with live L3: GRID and SUBS off, LAYERS closed, no lightning. Any difference is a V5/V6 fail.
2. **L3 regression.** LAYERS → last group → Lightning ON. Check 24H, 48H, 7D and 30D dots, 12M cells, LOAD POINTS and OFF exactly as in the L3 steps. Every dot or cell tap fires about 5 substation links ("km · kV").
3. **12M dense cell near Lincoln** (lon −0.35, lat 53.25). The card first reads "REPD projects: loading…". On the first tap, with every REPD layer off, this costs about 1.5 MB, so allow up to 15 s on mobile data. Then:
   - orange dashed links run to up to 10 sites, with labels such as "2.36 km · Solar 49.9 MW";
   - the collapsed card's summary line ends "· 10 nearest projects".
4. **Expand.** Tap that summary line. Check that:
   - the heading reads "10 nearest REPD sites (N projects; co-located parts grouped) within 40 km of this cell centre … Not evidence any project was struck or affected" (or "10 nearest REPD projects …" when nothing is co-located);
   - the 10/40 km summary line is present;
   - the Status and Tech chip rows are there;
   - the rows read "km · tech MW · status · name";
   - nothing overflows sideways at phone width and the card scrolls.
5. **Co-located site.** Find a row with "2 co-located" (the Newark cell, lon −0.85, lat 52.75, had one). Its parts are listed beneath it. On the map it is one link and one label joined with "+", not two overlapping labels.
6. **Filters.**
   - Tap Status → Operational: the list, links, labels and summary change, and the heading says "filter: Operational".
   - Tap Tech → Solar: both filters apply.
   - Pick a pair that leaves nothing (e.g. Planning + BESS in a quiet area): "No REPD project within 40 km … (filter: …)", and no orange links.
   - Tap a different cell: the filter is kept.
   - Set both back to All.
7. **Row tap.**
   - Tap a row. The page must not reload and the URL must not change. The map flies to the project and draws its nearest substations.
   - The card title is "REPD · tech MW". It shows the km from the lightning cell, and the substation note says "not its declared grid connection".
   - Long-press the row instead: "Open in new tab" gives the original coordinate deep link.
8. **Back.** Tap "◀ back to lightning cell". The lightning card, its 5 substation links, the REPD links and the chosen filter all return. Repeat once from a 7D flash, where the button reads "◀ back to lightning flash".
9. **Sparse cell, Harris** (lon −7.05, lat 57.75). Up to 5 substation links (3 there), 2 sites, and "Only 2 sites within 40 km; the radius stays 40 km, so fewer than 10 are listed." Do a row tap and then back.
10. **Labels.** Substation labels ("km · kV") and REPD labels ("km · tech MW") are both readable on the real basemap and do not pile on top of each other at zoom 8–10. This is the first glyph check of the REPD labels: the harness has no glyphs.
11. **Coastline.** At zoom 5 and at zoom 10, the coastline and basemap stay readable under the 12M cells and under the orange dashed links.
12. **Framing.** After a dense-cell tap and after back, the origin, substation and project endpoints sit between the search bar and the card. One endpoint just under the card on the first framing is a known residual. Two or more is a fail.
13. **Cleanup.** Close (×), a period change, LATEST and OFF each remove every neon, REPD link and label. With lightning OFF the map is as at arrival.
14. **Failure path** (optional). In airplane mode, tap a fresh cell after a reload. Expect "REPD projects unavailable: … Tap again to retry." with the substation links kept. A second failure adds the reload advice.

Also run your V1–V15 suite on M2 and diff it against L3 (202610281340), especially V9/V10 wording in the new REPD text.

## Known residuals (not bugs unless you disagree)
- **Framing.** On the first framing of the dense cell, 1 of 10 project endpoints sat just under the card. L3's camera rule only reframes points outside the map bounds, and it is unchanged. After back, every endpoint was on screen.
- **Not the engine popup.** The project view is not the original popup: it has no declared or NESO connection and no 400 kV row. Substations are the straight-line nearest.
- **Register path untested in a browser.** The bridge's DuckDB → parquet path cannot be exercised offline. The real register was injected or served in its place, so the iPhone run is its first real-browser load.
- **Bridge failure lasts the page.** The bridge caches a failed start for the page's lifetime (not lightning code). The card says to reload.
- **First-tap cost** is about 1.5 MB of parquet plus about 3 MB of JSON held, once per page, when every REPD layer is off.
- **Counts differ by design.** The summary counts projects, the list counts sites (grouped), and ties at the 10th site can make the list longer than 10.
- **Solar includes rooftop solar,** which is often nearest in towns. This is a product choice.
- **Distances use the engine's spherical R = 6378.137 km.** Against WGS84, the top-10 set differs in 17 of 1,043 cells, always on near-ties.
- **Neon labels** were not visible in the harness. The owner saw the substation labels on L3; the REPD labels are new.
- **Not tested on WebKit.** Your iPhone run is the first WebKit evidence for M2.
- **L residuals still apply:** whole-UTC-day cells, the 30 km land mask (NI border, Dover), drawn vs total.
- **Claude's own M2 review lanes** (camera, diff, L3 regression, layout, taps) are still running. Their findings will be posted on #32.

## Wording guard (V9/V10)
- An optical flash is not a ground strike.
- Unknown is not zero.
- Substations and projects are the nearest by straight line. They are not "affected", and a substation is not a project's declared grid connection.
- Capacity is registered capacity, not a measure of impact.

Flag any text that breaks these.

## How to report
- Post on GitHub issue **#32** only. Head the comment `M2 202610282100 · iPhone` or `M2 202610282100 · V1–V15`.
- Give one line per step: `step N: PASS`, or `step N: FAIL – what you saw`, with a screenshot for each fail. Note the UTC time and the iOS and in-app browser versions.
- For V1–V15, give PASS, FAIL or NOT_TESTED per V-number, with file:line where it applies. Mark each fail BLOCKER, MAJOR or MINOR.
- End with `RESULT: pass` or `RESULT: fail (steps …)`.
- **Release.** The owner's pass and your veto pass are both needed. The gate raise is already on main, so the release is a single commit that changes only `atlas/current.json` and `STATE.md`:
  `node tools/release/release-generation.mjs --generation 202610282100 --expect-live 202610281340 --authorised-by "…"`
  Run it from a fresh worktree of main.
- **Rollback** is `tools/release/rollback-generation.mjs --release-commit <sha>`: a `git revert` of that commit, which restores L3 byte for byte.
