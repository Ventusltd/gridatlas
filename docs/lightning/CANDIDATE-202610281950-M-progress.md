# M-build: L3 + the 10 nearest REPD projects on a lightning tap

Status: **DONE**, 20:20 UTC, 28 Oct 2026. Committed in my own worktree and **not pushed**. The live pointer is unchanged.

## Deliverables
- **Generation:** 202610281950, v9.173.
  - candidate_predecessor = previous = superseded = parent = 202610281340 (the live L3).
  - The cartridge base is still the original 202609241334 sld bytes.
- **Worktree:** `evidence/M-build/gridatlas-wt`, branch `claude/lightning-M-repd-20261028`, cut from origin/main 08b5cae (live = L3).
- **Commit:** `24aa74e`. It adds the 6 scaffolder files: module, cartridge, proof, manifest, and `atlas/v/202610281950/{index.html,current.json}`.
- **Module:** `atlas/modules/202610281950-uk-lightning-overlay.js`, 44,736 B against a 44,781 B cap. sha256 a6501fd0…
- **Cartridge:** 479,955 B against a 480,000 B gate. sha256 (LF) 3775a86c…
- **Source and tools:**
  - `tools/build-M.mjs` builds the module from the live L3 module. Every replacement is exact-once.
  - `tools/const2let.mjs` (acorn scope analysis).
  - `tools/make-generation-M.mjs` is the L3 scaffolder adapted for live = L3. It first proves the L3 cartridge equals base + "\n" + L3 module.
  - `tools/patch-tests-M.mjs`, `tools/m-tests.txt`, `tools/gates.sh`.

## Bytes: savings first, no change in behaviour (M0)
L3 was 44,700 B; M0 is 42,359 B, a saving of **2,341 B**.
- Comments: the header went from 4 lines to 1, and the `//` lines were removed.
- Aliases: `Math.max`, `Math.min`, `Array.isArray`, `Date.parse`, `appendChild`, `getBoundingClientRect`, and a shared `U` for the 13 repeats of "unknown, not zero".
- `const` → `let` (−310 B). Scope analysis proved that none of the 155 converted bindings is ever reassigned. Two declarations whose text the suites assert stay `const`.

Proof that M0 behaves like L3: test-engine passes 152/152 and test-fixes passes 104/104, unchanged.

The feature adds 2,377 B, which leaves **45 B spare**.

## Recon findings
- **Where the REPD data lives.** The map's REPD data is the engine source `src-repd`, filled only when a REPD layer is switched on (engine :1126-1178, :1302).
  - Every REPD layer has the URL `/dist/repd_master.json` (shell index.html:243-252).
  - The bridge serves that URL from the pinned `repd_master_v8_oracle.parquet` through DuckDB: 10,784 rows.
- **Properties.** Each row has name, tech, raw_tech, capacity and status. **There is no repd_ref in any row.**
  - 13 technologies.
  - 4 statuses: operational 3,095, under construction 434, awaiting construction 5,586, application submitted 1,669.
  - 1,088 rows have capacity 0. These are shown with no MW.
- **The original's own nearest-projects code.** `nearestProjects` (C:3547) reads only loaded tiles and is not exported. I reused `link.measure.distanceKm` (haversine, R 6378.137), `representativePoint`, `isProjectTech`, and the radius `MAX_LINK_KM` = 40.

## Design as built
- **Which projects.** The 10 nearest within 40 km of the flash or cell centre, from all 10,784 rows: every technology (including rooftop solar) and all 4 statuses.
  - The data source is `src-repd` if a layer has loaded it. Otherwise the module fetches `/dist/repd_master.json` once per page, through the bridge.
- **How they are drawn.**
  - Dashed links with a capacity ramp: #fa0 → #ff4400 (50 MW) → red (200 MW). This is the engine's REPD glow language and is distinct from the #d8c96a substation links.
  - Node dots, with labels like "2.36 km · Solar 49.9 MW".
- **The card.**
  - It states: "10 nearest REPD projects within 40 km of this cell centre (straight-line; all technologies and statuses). Not evidence any project was struck or affected."
  - Each row is a 44 px link: "km · tech MW · status · name".
  - A row opens the original coordinate deep link on the page route (longitude, latitude, technology, project, capacity_mw, status). No repd_ref is sent, because none exists.
- **Camera.** It frames the origin, the substations and the projects together, using L3's padding (top 150, bottom = card height + 24).
- **Cleanup.** The new layers are part of L3's neon set, so close, period switch, LATEST and OFF remove them. A register that arrives after the card has closed draws nothing.

## Results
- **Gates** (`out/checks-202610281950.log`, before and after the commit):
  - lint: PASS.
  - STATE.md and `atlas/current.json` unchanged.
  - All 11 lightning proofs on main: PASS. The 202610281225 and 202610271647 proofs are not on main, so they were not run.
  - run-current: 4/4.
  - verify-compose: PASS.
  - verify-candidate: PASS.
- **Suites on the generation module:**
  - test-engine 159/159, including the new REPD1–7. Run 5×.
  - test-fixes 104/104. Run 4×.
  - ChatGPT suites: 8/8 and 6/6.
  - Fail-first: REPD1–7 all fail on L3.
  - One intended assertion change, I3/J1: "no project" is now checked only on the substation part of the card.
- **REPD1 (real data, flash at Newark):** the result equals a brute-force search over all 10,784 rows.
- **Rest-state parity against the LIVE L3 arrival, lightning OFF:** 0 differing pixels at both 393×852 and 393×659, and 0 lightning requests (`rest/pixcmp-M.txt`).
- **Browser:** one Chromium, real lightning data from c3083a3, `browser/run3.txt`. 0 page, map or module errors.
  - **12M Newark cell** (n=332): 5 substation links and 10 project links. The nearest project is "1.73 km · Solar 49.9 MW · operational · The Grange". Every endpoint is on screen, above the card and below the search bar. Close removes everything.
    - Screenshots: `M-12M-newark-cell.png`, `M-12M-newark-cell-list.png`.
  - **7D flash, fetch path:** 5 + 10 links. The register was fetched once and reused on the second tap. The period switch and OFF clean up.
    - Screenshot: `M-7d-flash-tap.png`.
  - **Row tap:** this ran the original arrival for The Grange: its card, 5 neon links, zoom 12.
    - Screenshot: `M-row-deeplink-arrival.png`.

## Residuals
1. **The bridge's DuckDB → parquet REPD query is not exercised in the browser.** The offline shim has no parquet extension, so the real register was injected into `src-repd`, or served behind `window.fetch`. The engine's own REPD layers depend on the same path.
2. **First-tap cost when every REPD layer is off:** about 1.5 MB of parquet plus a query, and about 3 MB of JSON parsed and held. It happens once per page.
3. **Neon labels were not seen** in the browser: the shim has no glyphs. This was already the case for L3.
4. **A row tap reloads the page** (the deep link), so the lightning view is lost. Lightning state is never persisted.
5. **Some rows sit at the same point** (for example solar and BESS components of one scheme), so they list separately and their labels overlap.
6. **Rooftop solar is included** (3,241 rows). Excluding it is possible.
7. **Sparse areas can show fewer than 10 projects**, because of the 40 km radius. The card says so.
8. **No guard for the placeholder coordinate**, because this partition contains 0 of them.
9. **Only 45 B of headroom is left.**
10. **Not tested on WebKit.**
