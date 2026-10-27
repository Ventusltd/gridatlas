# Kuiper–Vogel / Stars bug hunt: brief (27 Oct 2026, 16:15 UTC)

The owner approves everything. Work autonomously and don't ask for permission. Report concrete findings with exact file:line and minimal fixes.

## The target
Lightning Build I, generation **202610270929**, published at https://ventusltd.github.io/gridatlas/atlas/v/202610270929/
- Module: `/tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/wt/atlas/modules/202610270929-uk-lightning-overlay.js` (33,623 B; budget 44,781 B under the owner-approved 480 kB gate).
- Source variant: `hardening/evidence/opus-fix-designer/fixed-module-I.js`. Change log: `I-progress.md`. Tests: `test-fixes.mjs` + `minidom.mjs`.
- The live original it is appended to: `wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js`, which has project deep-link arrival, the neon links object `window.__GRIDATLAS_NEON_LINKS__` (around line 3273), `nearestTransmission` (around lines 623, 1975 and 6157), `deepLinkPlan` (around line 3378) and `runDeepLink` (around line 6320).

## What the owner saw on his real iPhone (13:45 UTC; screenshots described)
1. **Counts look identical across periods.** 30D, 3M and 12M all show "Lightning Flashes (Optical) [≥1,480 | 30d STALE]" (or 3m/12m) and the same map. 48H shows "[≥29 | 48h STALE]".
   - Ground truth: the real archive on Ventusltd/lightning main has **29 searched days, 2026-09-29 to 2026-10-27, totalling 1,480 flashes**. The other 337 of 366 index days are never searched.
   - So every window ≥30 days contains the same 1,480. The UI does not make that clear. "≥" and "STALE" confuse.
   - The STALE flag is real: the hourly collector schedule did not run between 08:55 and the screenshots. The likely cause is backfill runs sharing concurrency group `uk-lightning-update`, together with GitHub's one-pending-run rule.
2. **"The substation engine doesn't fire at all."**
   - Tapping a flash opens Lightning's card: a tall black box with time, a very long flash ID, lat/lon, a "NEAREST SUBSTATIONS" button, and a text list such as "5.42 km · 400 kV · Wymondley Substation". **No lines appear on the map.** The card covers most of the map.
   - What the owner expects is the project deep-link behaviour, as in https://ventusltd.github.io/gridatlas/atlas/?repd_ref=12588&technology=solar&latitude=51.8132088&longitude=-1.3489728&zoom=12: the map frames the point, a red pulsing origin appears, and white substation nodes are joined by light neon lines labelled "4.56 km · 33 kV", "3.43 km · 132 kV" and so on. That covers 33 kV as well as 132 kV, about 5 links, and the original's card bar.
3. The 7D, 48H and 30D dots draw. Taps open the card.

## Lightning data (read-only clone at /home/claude/lightning; `git fetch origin main` first)
- `data/history/index.json` (schema uk-lightning-history-index.v2), `data/history/days/YYYY/MM/DD.json`, `data/uk_lightning.geojson` (7-day feed), `data/status.json`.
- Workflows: `.github/workflows/update-lightning.yml` (hourly, cron :17) and `backfill-lightning.yml` (manual, ≤31 days, 200-minute budget, about 10 days per run).

## The owner's own methods (read-only clones in /home/claude/ventusltd/)
- `kuiper-belt/` (README.md, SPEC.md, LAWS.md): the estate drawn as orbiting bodies. **Vogel 1979 sunflower layout**: item n sits at radius ∝ √n with one golden-angle turn (137.508°) per item, and Fibonacci hashing (2654435769) gives stable placement.
- `stars/` (README, CODE-UNIVERSE.md, reports/CHEMISTRY.md, CLASSIFICATION.md, RANDOM.md): stars are recorded browser tests of component combinations. Chemistry shows which combinations always work or fail, with the error each produces. Families are the periodic table's atomic numbers.
- `elements/` (README, CATALOGUE.md, ELEMENTS.md): the elements catalogue, with keys block:/family:/line:.
- `spiders/`: the Spider sandbox, a graph of nodes and edges, with column and spider views.
Use these methods faithfully, citing the files. Don't invent keys the estate doesn't use.

## Rules
- **Never edit** the hardening worktree, /home/claude/gridatlas or /home/claude/lightning. Write only to `hardening/evidence/kv-<lane>/` and `hardening/reports/kv-<lane>.md`. For a writable copy, use `git worktree add` under your own evidence folder.
- **Memory:** about 6 GB in total. Only lanes explicitly marked BROWSER may start Chromium, with one browser and one context at a time, closed after each case. Everyone else uses node only (node:vm + minidom.mjs).
- Background commands must stay under 10 minutes. Write your report every 10 minutes, because the container has restarted three times.
- Honesty rules: a flash is optical, not a ground strike; unknown is not zero; never invent a repd_ref; nearest substations are not "affected".
- The report is at most 1,200 words. Return a summary of 150 words or fewer: findings, exact locations, and minimal fixes with byte cost.
