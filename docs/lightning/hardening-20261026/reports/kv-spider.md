# kv-spider: the lightning data-and-code path as a spider graph (NODE only)

27 Oct 2026, about 17:00 UTC. Sources: lightning main at `d32e6b6` (15:24 UTC), exported read-only to `evidence/kv-spider/lightning-d32e6b6/`. Generation 202610270929: the published cartridge `202610270929-sld-sandbox-v9-8.js` (sha256 e37b754d…), fetched with `gh api`, is byte-equal to the original 202609241334 + "\n" + the module, so module line n is cartridge line n+8667. No browser was used.

## Deliverables (all in `hardening/evidence/kv-spider/`)
- `lightning-graph.json`: 31 nodes, 42 edges. It uses the shape of `ventus-grid-engine/genome/engine-graph.json` (nodes `label,type,rag,reason,gh,ext`; edges `from,to,type,evidence{file,lines,method}`), as CODE-UNIVERSE.md §2 describes. Edge types come only from the estate's own vocabulary (data, workflow, governance, external, imports, should_import, drifts_from). No new keys are added: 13 edges whose `evidence.method` begins "CONTRACT MISMATCH POSSIBLE" mark possible mismatches, and five of those carry "RISK n/5". `gen-graph.py` regenerates the file.
- `lightning-spider.html`: a static column view of the focused node, its dependencies and its dependents. Each edge shows its type and file:line evidence, and mismatch edges are tagged red. It has risk jump buttons and a node index, and `?focus=<id>` opens a node. The graph is inlined, so the page works from file://. A node smoke test passed (`viewer-smoke.mjs`).
- `probe.mjs` (+ `harness-boot.mjs`, `minidom.mjs`): replays the owner's view against the **real** index and shards at `2a49652` (the archive commit that was live at 13:45) and taps a real flash, using the real 5,800-substation list and the real geodesy module. Outputs: `probe-result.json`, `probe-result-1615.json` (current index), `probe-result-fixed.json`.
- `hourly-runs.json`, `gh-runs-20261027.json`, `index-*.json`, `make-fix.py` → `fixed-module-kv.js`, test logs.

## RAG today (facts)
- **Identical counts: RED, reproduced exactly.** At 13:45 with index 2a49652, the label reads `[≥1,480 | 30d STALE]` for 30D, 3M, 6M and 12M, and `[≥29 | 48h STALE]` for 48H. Every window covers the same 29 searched dates. Searched shares of 88/28/14/7% exist in `cv()` but appear only in the status line (module:184). Now (index 15:24) the figure is ≥1,507, not stale until 18:24.
- **STALE: RED, but the cause is mostly not concurrency.** The hourly cron fired **21 times since 23 Oct against about 112 slots, with 0 cancelled runs** and a median gap of 5.5 h. That was before any backfill existed. Today it fired at 00:26, 08:55 and 15:19. The shared group delayed only the 08:55 run, which was held 91 min until the backfill ended at 10:26. Nothing explains 10:43→15:19 except GitHub dropping schedule events. At 13:45 the module had been STALE for 85 s, because `next_update_due` (generated + 1 h + 2 h) was 13:43:35.
- **Engine lines not visible: RED, mechanism found.** The probe reproduces "5.42 km · 400 kV · Wymondley Substation" (flash 2026-10-18 13:46, near Hitchin). The module **does** add 3 lines in its own source, but it makes **0 camera calls**. At zoom 6 the lines are 7–9 px long against a flash dot of 6.7 px radius plus stroke, and they sit beside a card up to 280 px wide. They only become readable from about z10 (115–140 px). The project deep-link flies to z12 first (cartridge:6628-6630). Whether the label layer renders on the device (it needs style glyphs) is unknown.
- **Correction to the brief:** Lightning's substations are OSM `grid_substations.geojson` (release 202608300453-atlas-v9, 5,800 features), loaded by `loadSubstations()` (cartridge:1666, 3480-3503). **data-grid-gb** only feeds declared NESO connections and ETYS topology for projects (cartridge:264-293), so it is grey in the graph and not on the lightning path.

## The 5 riskiest edges

**1. `m_nearest → ui_card` (module:157-163): no framing.** Lines are drawn but never brought into view, which is what the owner calls "doesn't fire".
Fix F2: after adding the layers, `m.fitBounds` the flash plus its substations, using the engine's padding (cartridge:4611-4614), `maxZoom:12`, and bottom padding of 220 on phones. **+221 B.**

**2. `m_nearest → link.measure.nearestSubstations` (should_import; module:156 vs cartridge:1663-1665, 3509-3540, 3584).** The module re-implements a narrower rule: `kv[0]>=132`, 3 links, no radius. The engine rule is 33 kV, 5 links, 40 km. For the same flash the engine gives Wymondley 400, unnamed 33 (5.67 km), Stevenage 132, Luton South 132, unnamed 33 (7.10 km), so the two 33 kV links the owner expects are dropped.
Fix F1: call `L.measure.nearestSubstations(x,y,subs)`, falling back to the same 33/5/40 rule, and correct the empty message. **+3 B net.**

**3. `m_window → m_label` (module:80-81, 182).** The sum of known whole-day counts is shown only as `≥N`, so every long window looks identical.
Fix F3: the label appends `· 29/366 days searched` (from `cv().d` and `cv().u`). Probe output: `[≥1,480 · 29/93 days searched | 3m STALE]`. **+84 B.**

**4. `GitHub scheduler → update-lightning.yml` (yml:8; index promises hourly at history.py:49-50).** The only clock is a best-effort cron that delivers about 19% of its slots. This is not a module fix and needs an owner decision. Options:
- add a second cron line, e.g. `"47 * * * *"` (about +25 B YAML). This doubles the chances but is not a guarantee.
- trigger it externally with `workflow_dispatch`.

Keep backfill on the shared group: it prevents push races on `index.json`. Run backfill only when the hourly run has just finished.

**5. `index.next_update_due → module stale()` (history.py:641; module:45-47; status.py:43-52).** There are three different freshness rules: due at 3 h, the module's own 4 h, and status.py's warn at 6 h / stale at 12 h. With the real cadence the UI shows STALE about 45% of the time while status.json says "ok". Minimal fix, on the producer side: set `UPDATE_GRACE_HOURS` from 2 to 5 (0 B). Alternatively, make the module honour status thresholds. The cron cadence (risk 4) is the real cure.

## Other mismatch-possible edges (in the graph)
- **raw CDN → transport.** `max-age=300` applies per file on the moving ref `main`. `cache:'no-cache'` cannot bypass Fastly, so the index and today's shard can come from different commits for up to 5 min. The module handles this with one `?q=` retry and then "archive updating" (module:88).
- **Exact prose and schema equality** of the index `observation` (history.py:646 ↔ module:40). Any change in wording turns every window into FAIL.
- **The hourly-parts branch** (module:37, 59) has never met real data, because no day has split yet.
- **status.json is never read** by GridAtlas, so `remaining_unknown_days` never reaches the user.
- **The feed display cap** (collect.py:209) is not reflected in counts (module:19).
- **`window.__GRIDATLAS_NEON_LINKS__`** is used as an unversioned surface (module:154). `link.substations` exists only after its fetch resolves.

## Verification
- Original module: existing suite 91/91.
- `fixed-module-kv.js` (33,931 B, **+308 B**, 10,850 B under the 44,781 B budget):
  - The probe shows 5 links including 33 kV, 1 camera call, and the new labels.
  - The suite gives 90/91. The single failure is **I3**, which pins the old "3 nearest ≥132 kV" rule, the very rule F1 changes. I3 needs updating to 5 / 33 kV / 40 km.
- Not verified on a real device: label glyphs, and the fitBounds behaviour with the card open on iPhone.

## Honesty
Flashes are optical, not ground strikes. The 337 unsearched dates are unknown, not zero. The nearest substations are distances, not "affected" assets. No `repd_ref` was used or invented.
