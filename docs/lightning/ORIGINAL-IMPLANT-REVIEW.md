# Lightning reintegration — exact original GridAtlas preservation

**Status: STOP / review pack only. Do not deploy or merge until owner expressly approves a visually identical original Atlas with lightning as the only addition.**

**Owner's report (26 October 2026):** the V5 lightning preview is visually unlike the original GridAtlas and the UI is broken. Passing toggle-count tests did NOT disprove that. Owner observation overrides those narrow tests.

## Mandatory read order
1. `CLAUDE.md` then `AGENTS.md` (especially *local clone before edits* and release/state rules).
2. `STATE.md`, `atlas/current.json` — live generation **202609241334**, original four-cartridge composition. Keep these files untouched until explicit release approval.
3. `atlas/index.html` and `atlas/releases/202608300453-atlas-v9/index.html` (original immutable shell) + `ventusv8.css`.
4. Original `atlas/cartridges/202609241251-streaming-parquet-bridge-v9-5.js`, `202609062358-substation-intelligence-v9-63.js`, `202609241334-sld-sandbox-v9-8.js`.
5. `tools/proofs/v8-layers-panel-restored.proof.mjs`, `tools/proofs/menu-bar-mobile-hit.browser.mjs`, `tools/proofs/all-controls.browser.mjs`, `tools/proofs/all-layer-clicks.browser.mjs`.
6. Faulty prototype ONLY as evidence: `atlas/preview/lightning/` and `atlas/cartridges/202610230100-streaming-parquet-bridge-v9-5.js`.
7. Independent observation source: `Ventusltd/lightning/data/uk_lightning.geojson`. Do not alter the lightning collector.

## Verified facts
- Main GridAtlas lives at https://ventusltd.github.io/gridatlas/atlas/ and continues to point to generation `202609241334`.
- The previous preview `atlas/preview/lightning/` is a distinct copied composer/loader, with a forked bridge and custom DOM-injected controls. It is **not** an acceptable final version solely because its narrower automated tests passed.
- GridAtlas's native menu intentionally validates exactly 60 engine `data-layer-id` controls plus three Pipeline News `data-pn-layer` controls before it installs. Injecting a 61st core layer broke the six-menu UI in an early attempt.
- The legacy SCADA `#scada-ui-container`, the fullscreen curtain `#fs-curtain-keys`, and the six-menu `Grid` dropdown are different interfaces. A menu checkbox alone does not prove the actual Layers panel is usable.
- The original global fetch bridge's `legacyStem()` recognises **any URL pathname ending .geojson**, then incorrectly routes public `raw.githubusercontent.com/.../uk_lightning.geojson` to an internal Parquet partition. It only hooks `window.fetch`, not `XMLHttpRequest`. A *tested cross-origin XMLHttpRequest* could be a minimal path that leaves the original bridge byte-for-byte unchanged. Test, don't assume it.
- A V5 published Android-Chrome emulation fetched 408 observations and clicked Weather; that did not include a full original visual equivalence or all-controls regression audit.
- `AGENTS.md` explicitly forbids copying the full app and requires cartridges, manifests and state parity.

## Definition of done (all mandatory)
- **Baseline first**: capture screenshots at 1440×900 desktop, 393×852 Android Chrome, 360×740 Android Chrome, 390×844 WebKit/iPhone emulation. Capture original CSS/computed style and DOM geometry of every major original surface.
- Compare original production against candidate with **lightning OFF by default**. After masking only nondeterministic timestamps, weather-specific additive controls and live data/status fields, differences in original layout, palette, font, control visibility, map sizing, menu placement or hit targets are release blockers. Include visual evidence.
- Preserve original `atlas/releases/`, all original cartridges unless a versioned derivative is narrowly justified, and exactly 60+3 original input IDs/listeners. No `ukConfig` or global `window.fetch` patch in the addon.
- A single user-facing Weather entry in the original layer ecosystem (and required same-state mirrors if the original app has them), consistent with the original style. **No replacing the original UI.**
- Real network loading of EUMETSAT LI L2 optical flashes, data validation, UK bounding box and metadata; no implication of a confirmed ground strike. Show *stale*, *no observations*, *network error* separately from a successful nonzero load.
- Real human-like tap/click (no `force:true`), and the original menu, native layers, fullscreen, search, project details, grid controls, Pipeline News and deep links still work.
- Run `node tools/scope/loop.mjs lint`, `node tools/scope/loop.mjs state --stdout` equal to `STATE.md`, original `tools/proofs` suite and paired local/served-browser tests; log all failures with `FAIL`, `BLOCKED_HARNESS`, or `BLOCKED_DEPENDENCY`.
- Independent `atlas-merge-veto` written sign-off, owner visual approval, *then* propose a **separate release PR**. **NEVER auto-merge, alter live current.json, regenerate STATE.md, or publish from the agent pack branch.**

## Multi-agent division of labour (read-only concurrent phase)
Use the checked-in `.claude/agents/` definitions. Let agents 1–7 research and challenge each other in parallel, each producing a self-contained report in conversation, citing file paths/lines and reproduction commands. Lead consolidates disagreements into one proposal. Only the `atlas-implant-builder` agent should edit a **separate** implementation worktree after the original preservation design is approved. The `atlas-merge-veto` agent independently reviews the diff and has a veto.

No agent should treat the previous assistant's confident success statements as evidence of visual equivalence.

## PowerShell / Claude Code handoff
```powershell
git fetch origin
git switch review/lightning-original-implant-agent-pack
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
claude
```
Within Claude Code, prompt:
> Read CLAUDE.md, AGENTS.md, STATE.md, and docs/lightning/ORIGINAL-IMPLANT-REVIEW.md. Form a team of the project-specific reviewers under .claude/agents. Run the original-preservation and transport audits in parallel, not implementation. Show me screenshots and a proposed single-cartridge integration that changes none of the original interface when OFF. Do not edit production, merge, or deploy without my explicit consent. The final verdict belongs to atlas-merge-veto.

The opt-in agent teams setting may be version-dependent; if it is unavailable, use subagents individually with distinct contexts and read-only reviewers instead. Do not launch unsupervised API-spending background runs.

## Work boundaries
1. Read-only audits first; no simultaneous edits to shared files.
2. Prototype permitted *only after* baseline evidence in a distinct unmerged branch/worktree.
3. No more duplicated `atlas/preview/lightning/index.html` loaders.
4. Prefer a documented, versioned additive cartridge composed with the existing loader, without rewriting the shell.
5. If a transport bridge change is truly essential, demonstrate no smaller solution exists with comparative tests and keep original traffic untouched.
6. Preserve the independent `Ventusltd/lightning` collector and its GitHub Actions schedule.

Tracking issue: https://github.com/Ventusltd/gridatlas/issues/28


## Added requirement: exact lightning observation period and one-year historical access

Owner also found the lightning legend did not say **which period** its flash count described. This must be corrected without replacing the original GridAtlas controls or style.

**Approved research reference (do not transplant its markup or CSS):**
https://globalgrid2050.com/uk_energy_tracking_v6/ and
- Ventusltd/globalgrid2050/uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js
- Ventusltd/globalgrid2050/uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js
- Ventusltd/globalgrid2050/uk_energy_tracking_v6/generation_history/load_generation_history_data.js
- Ventusltd/globalgrid2050/uk_energy_tracking_v6/generation_history/generation_daily_mwh_by_technology_fuelhh_index.json

**Isolated proposed data implementation:** draft https://github.com/Ventusltd/lightning/pull/1 and docs/HISTORY_ONE_YEAR.md within that branch. It introduces separate UTC-dated GeoJSON-in-JSON files, an index and a DOM-free date-window loader, with period options 12h, 24h, 48h, 7d, 30d, 3 months, 6 months, 12 months and custom start/end. Long ranges use daily counts in the lightweight index and short ranges load actual dated points.

**Non-negotiable honest labels:** distinguish selected start/end UTC, first and last *actual detections within the selection*, events in the archive vs rendered (with any cap), ingestion time, original EUMETSAT query window, and missing-historical-data/partial-coverage warning. EUMETSAT LI optical flashes are not confirmed ground strikes. Missing days mean UNKNOWN, not "zero lightning". Do not claim a complete prior year: the first archive is prospective plus a partial 7-day seed. Historic backfill must use genuine source products.

**Technical discovery:** the original legacy fetch bridge classifies all paths ending in .geojson, even external ones. The proposed daily historical files end with .json and contain valid GeoJSON FeatureCollections. That bypasses the interception without changing original bridge bytes. Agent transport review must verify this against the production composition and consider the easiest correct method of fetching the short live-window feed too. Do not reintroduce a copied bridge just to fix lightning.

**Review responsibilities:** source/retention/coverage to data-archive agent; date picker, label, pagination and exact observation ranges to time-window UX agent; mobile performance and archival growth to budget agent; screenshot/pixel parity and original behaviour to UI guardian; separate independent final veto remains mandatory.

**Release sequence:** validate data contract in its own repo (draft PR, not merged), then read-only architecture/UX reviews, then owner-approved isolated GridAtlas implant. No auto-merge. GridAtlas live production pointer stays unchanged.
