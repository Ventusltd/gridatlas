# GridAtlas lightning re-integration — shared brief for every agent

Read this whole file before doing anything. You are one specialist in a swarm of parallel agents
coordinated by a lead. Other agents are working in the same clones at the same time.

## Mission (owner's words, condensed)
Preserve the original GridAtlas exactly as it was, and implant the EUMETSAT lightning functionality
without breaking its interface, menus, layers, maps, engineering tools or existing features.
The original working composition is generation **202609241334** (atlas/current.json on main). It is
the authoritative baseline. The previous lightning integration (preview V5) is UNACCEPTABLE: some
automated tests passed, but the owner reports the application looks different from the original and
the UI is broken. Do not treat earlier test results or earlier assistant claims as evidence of visual
or functional equivalence. The owner's first-hand report wins.

## Where everything is (local, already cloned)
- GridAtlas (push-capable clone, main at c08f3a6 "Show lightning in native GridAtlas Layers panels (isolated V5)"):
  /home/claude/gridatlas
  - Owner contract: CLAUDE.md -> AGENTS.md; STATE.md and atlas/current.json are the current facts.
  - Original immutable shell: atlas/releases/202608300453-atlas-v9/ (index.html, ventusv8.css etc). NEVER edit atlas/releases/.
  - Root composer/loader: atlas/index.html; composition manifest atlas/manifests/202609241334-composition.json.
  - Original cartridges (the four live slots in current.json): 
    atlas/cartridges/202609241251-streaming-parquet-bridge-v9-5.js (replace-script slot for 202608292311-maplibre-worker-bridge.js),
    atlas/cartridges/202609071213-place-global-search-v9-5.js (uk-gazetteer-flyto),
    atlas/cartridges/202609062358-substation-intelligence-v9-63.js (substation-intelligence; owns the 60+3 menu contract),
    atlas/cartridges/202609241334-sld-sandbox-v9-8.js (sld-sandbox).
  - The REJECTED preview (evidence only, never the product): atlas/preview/lightning/ (index.html = copied loader, weather-module.js = DOM-injected toggles, current.json = forked composition) and the forked bridge atlas/cartridges/202610230100-streaming-parquet-bridge-v9-5.js, plus atlas/cartridges/202610221600-sld-sandbox-v9-8.js, workflow .github/workflows/uk-lightning-preview.yml and proof tools/proofs/uk-lightning-preview.browser.mjs.
  - Proof suites: tools/proofs/ (all-controls.browser.mjs, all-layer-clicks.browser.mjs, menu-bar-mobile-hit.browser.mjs, v8-layers-panel-restored.proof.mjs, deep-link-*.browser.mjs, run-current.mjs, etc.). Scope tool: tools/scope/loop.mjs (lint, state --stdout).
  - Branch with the nine agent definitions and the review doc (NOT checked out; read with git show):
    git -C /home/claude/gridatlas show origin/review/lightning-original-implant-agent-pack:docs/lightning/ORIGINAL-IMPLANT-REVIEW.md
    git -C /home/claude/gridatlas show origin/review/lightning-original-implant-agent-pack:.claude/agents/<name>.md
  - Branch of the V5 preview: origin/feature/lightning-in-native-layers-preview-v5 (already merged into main as the preview folder).
  - GitHub: issue #28 (STOP condition and acceptance gates) and draft PR #29 (review pack). Both must stay as they are. Use `gh api repos/Ventusltd/gridatlas/...` read-only if you need them.
- Lightning collector (push-capable clone, main at 21c3e56): /home/claude/lightning
  - collect.py, tests/test_collect.py, .github/workflows/update-lightning.yml (cron every 3 h, commits data/uk_lightning.geojson), data/uk_lightning.geojson (215 KB, EUMETSAT MTG Lightning Imager Level 2 optical flashes, UK box, last 7 days seed).
  - Draft PR #1 branch (NOT checked out; read with git show origin/feature/one-year-utc-lightning-history:<path>): history.py, history-window.mjs, docs/HISTORY_ONE_YEAR.md, tests/test_history.py, tests/test_history_window.mjs, workflow changes. It proposes daily UTC shards named .json (GeoJSON inside), data/history/index.json, one-year rolling retention, and a DOM-free date-window loader modelled on UK Energy Tracker V6.
  - Public feed: https://raw.githubusercontent.com/Ventusltd/lightning/main/data/uk_lightning.geojson
- GlobalGrid2050 (read-only clone, 5.6 GB): /home/claude/ventusltd/globalgrid2050
  - UK Energy Tracker V6 reference implementation: uk_energy_tracking_v6/ (price_history_chart/control_price_history/control_price_history.js, price_history_chart/load_price_history_data/load_price_history_data.js, generation_history/load_generation_history_data.js, generation_history/generation_daily_mwh_by_technology_fuelhh_index.json). Live at https://globalgrid2050.com/uk_energy_tracking_v6/ . Reuse its date-range navigation, lazy loading, historical indexing and storage principles; never import its UI/CSS.

## Known facts established by the lead (verify, do not assume)
- On main as checked out, `node tools/scope/loop.mjs lint` and `state --stdout` both FAIL with "active workflow budget mismatch": STATE.md declares 9 active workflows but .github/workflows now has 10 — the tenth is uk-lightning-preview.yml from the preview work. This is a PRE-EXISTING failure on main, not something our candidate introduced. Classify accordingly.
- The original bridge cartridge patches only window.fetch and its legacyStem() classifies ANY pathname ending .geojson as an internal Parquet partition request, which is why a raw.githubusercontent.com .geojson URL got hijacked. Paths ending .json are expected to pass through to native fetch; XMLHttpRequest is not hooked. Transport lane must prove this with real code paths and a browser test.
- The native menu fails closed unless exactly 60 engine controls (data-layer-id) plus 3 Pipeline News controls (data-pn-layer) are present. Lightning must NOT become a 61st engine input, must not carry data-layer-id or data-pn-layer, and must not mutate ukConfig.
- #scada-ui-container (native SCADA Layers panel), #fs-curtain-keys (fullscreen curtain) and the six-menu Grid dropdown are three different surfaces. A menu checkbox alone does not prove a usable Layers panel.
- Lightning must be OFF by default. With lightning OFF, original and candidate must be pixel/geometry identical after masking clocks and live data.
- EUMETSAT LI flashes are satellite OPTICAL flashes, not confirmed ground strikes. Missing archive days are UNKNOWN, never zero. The one-year archive is prospective plus a 7-day seed; no back-data exists yet; nothing may be fabricated.

## Hard rules for every agent
1. STRICTLY READ-ONLY on both clones unless your role text explicitly says you are the single-writer builder. No commits, no pushes, no merges, no deploys, no edits to atlas/releases/, atlas/current.json, STATE.md or any original cartridge. No `npm install` or new software: Playwright 1.62 and Chromium are already installed system-wide (`node -e "import('playwright').then(()=>console.log('ok'))"`); if an import fails, set NODE_PATH=$(npm root -g) and retry; if still failing, report BLOCKED_HARNESS, do not install.
2. NEVER run `git checkout`, `git switch`, `git stash`, `git reset`, `git clean` or `git pull` inside /home/claude/gridatlas, /home/claude/lightning or /home/claude/ventusltd/globalgrid2050 — other agents share those working trees. To read another branch use `git show <ref>:<path>` or `git diff <a> <b> -- <path>`. If you need a checked-out tree of another ref, create an isolated worktree under YOUR OWN evidence directory: `git -C /home/claude/gridatlas worktree add /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/<your-name>/wt <ref>`.
3. Local serving for browser tests: the live route is https://ventusltd.github.io/gridatlas/atlas/ . Mirror it by serving the PARENT directory so the path matches: `python3 -m http.server <PORT> --directory /home/claude >/dev/null 2>&1 &` then open http://127.0.0.1:<PORT>/gridatlas/atlas/ . Use ONLY your assigned port (given in your prompt) so agents do not collide. Kill your server when done.
4. Outbound network from this container goes through an allowlist: GitHub (github.com, raw.githubusercontent.com, ventusltd.github.io) usually works; basemap tiles (cartocdn), postcodes.io, Nominatim and EUMETSAT will usually be refused. A black map in a local screenshot is therefore expected — classify it BLOCKED_DEPENDENCY and compare the shell, menus, panels and geometry instead. Never work around the allowlist.
5. Evidence discipline: every finding cites file path and line numbers, the exact command used, and the observed output. Screenshots go to /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/evidence/<your-name>/ with descriptive names (viewport, route, state). Never use Playwright force:true for a click that is supposed to prove a hit target.
6. Classify every defect as FAIL (genuine product failure), BLOCKED_HARNESS (test tooling problem) or BLOCKED_DEPENDENCY (unreachable external service). Do not mask pre-existing failures on main; name them as pre-existing.
7. Your written report goes to /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/reports/<your-name>.md with sections: Scope; Method and commands; Findings (numbered, each with evidence); Objections to other lanes (what you think another lane will get wrong); Recommendation for the smallest additive integration; Verdict (PASS / FAIL / BLOCKED with one-line reason). Keep it under 2,500 words. Then return a summary of at most 300 words to the lead, naming the three findings that most change the plan.
8. Work with the files directly; do not ask the lead questions — make the most reasonable reading and state it in your report.

## Harness note added by the lead
- ESM `import 'playwright'` now resolves inside /home/claude/gridatlas: the lead symlinked the global package (1.63.0; the repo pins 1.62.1 as a devDependency) into the git-ignored node_modules/ of the clone. `git status` stays clean. If a proof fails only because of the 1.62 vs 1.63 difference, say so and classify BLOCKED_HARNESS.
- Chromium is installed; WebKit may not be. If a proof needs WebKit (iPhone emulation) and the browser is missing, report BLOCKED_HARNESS and fall back to Chromium device emulation of 390x844 with the iPhone user agent, clearly labelled as an emulation of geometry only.
- Headless screenshots: use `page.screenshot({ path, fullPage: false })` at the exact viewport, after waiting for the composer to settle (wait for network idle up to 20 s, then a fixed 3 s). Record the wait used.

## Offline harness added by the lead (17:10) — USE THIS for every browser test
The sandbox cannot reach jsdelivr (MapLibre, DuckDB), cartocdn (style, tiles, fonts) or ventusltd.github.io, so a plain local load builds ZERO controls. The lead built a Playwright request shim that answers those requests from local copies (MapLibre 3.6.2 and DuckDB-wasm 1.29.0 npm tarballs in scratchpad/lightning/cdn-cache; the public data-gridatlas repo cloned at /home/claude/ventusltd/data-gridatlas; a minimal background-only style in place of the carto style; raw.githubusercontent.com/Ventusltd/lightning data answered from /home/claude/lightning/data or a directory you pass). Everything else off-origin is aborted and logged.
- Module: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/offline-shim.mjs  (exports installOfflineShim(page, {lightningDataDir}), waitForComposition(page), MINIMAL_STYLE)
- Proof it works: /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/lightning/harness/smoke.mjs and smoke-out/ — original composition at 1440x900 boots in ~8 s with menuBar.installed true, 120 engine inputs (60 x two mirrored surfaces) and 6 Pipeline News inputs (3 x two), map object present, zero page errors, screenshot smoke-1440x900.png shows the original shell, menu bar, search box and native Layers panel.
- Known remaining gap: the DuckDB "+esm" bundle from jsdelivr is not in the npm tarball, so the REPD search lane (DuckDB prewarm) stays BLOCKED_DEPENDENCY locally; layers, menus, panels, cards and lightning transport are testable. Basemap tiles are intentionally absent (background-only style), so mask the map canvas in pixel comparisons.
- Import playwright in your scripts as: import { chromium } from '/home/claude/gridatlas/node_modules/playwright/index.mjs';
- Serve the parent dir on YOUR port as before; the shim only intercepts off-origin requests.

## Harness update (17:58)
- The shim now serves jsdelivr's duckdb-wasm "+esm" as an esbuild bundle (cdn-cache/duckdb-browser-esm-bundle.mjs, apache-arrow 17 inlined). The DuckDB runtime now starts under the shim (duckdb_runtime_started true), BUT Parquet-backed layers still fail because DuckDB fetches its parquet extension from extensions.duckdb.org, which the allowlist refuses (bridge failure "table index is out of bounds"; label [FAIL]). So the Parquet/DuckDB lane (REPD technology layers, search) remains BLOCKED_DEPENDENCY locally; the 11 same-origin map-ready GeoJSON partitions, menus, panels, cards, lightning transport and rendering are testable.
