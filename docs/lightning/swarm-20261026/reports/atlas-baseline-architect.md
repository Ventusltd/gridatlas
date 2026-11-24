# atlas-baseline-architect — original GridAtlas architecture and owner invariants

Clone: /home/claude/gridatlas, main @ c08f3a6, `git status --short` clean before and after (evidence/atlas-baseline-architect/00-git-state.txt). Strictly read-only; no worktree created, no server started.

## Scope

Map the last-known-good composition 202609241334 (loader, immutable shell, four slots, boot order, data plane); explain why the preview loader copy and bridge fork fail AGENTS.md; identify the smallest legal additive mechanism; state what `tools/scope/loop.mjs` lint/state and the workflow budget demand; give a file/line map and a pseudo-diff; answer whether `atlas/current.json` must move for a branch preview.

## Method and commands

All read-only: `Read`/`grep` on files; `git show <ref>:<path>` for the review branch; `git show cd9a27e`/`1eb6414` for the V1 lightning commit and its rollback; `diff`/`cmp` between loader copies and cartridges; `stat -c %s` for byte budgets; `node tools/scope/loop.mjs lint`, `node tools/scope/loop.mjs state --stdout | diff - STATE.md` (non-writing: loop.mjs:247-253 returns before any write), `node tools/scope/verify-compose.mjs`, `node tools/cartridges/audit.mjs`. Raw outputs saved under evidence/atlas-baseline-architect/00..10.

## Findings

**F1. The composer admits exactly one slot type and only script tags the shell already loads.**
`atlas/index.html:61` requires `type === 'script'`, `:62` requires `slot === 'replace-script'`, `:63` requires `replace_script`; `:74-79` replace the first `<script src>` whose basename matches and throw if none. There is no append/add slot and nothing after the loop injects extra scripts (`:83-97` only writes `window.__GRIDATLAS_ATLAS__` and `document.write`s the result — the running page is a "shadow" of the immutable shell with `<base>` injected at `:52`, cartridge bytes hash-verified at `:70` and served from blob URLs at `:71`). The shell has five `<script src>` tags (`atlas/releases/202608300453-atlas-v9/index.html:133,135,136,138,139`; evidence 03): MapLibre CDN plus the four local scripts, all four claimed by current.json (`:27,61,84,569`). The CDN tag is technically matchable by basename but replacing it would mean shipping MapLibre inside a cartridge — not additive — and the owner already recorded "only the four scripts index.html loads are slots" (`atlas/current.json:612-616`, `slot_lesson`). **No fifth slot, no other slot type.** Boot order: MapLibre → bridge slot → search slot → engine slot → adapter slot (sld-sandbox) → inline `ukConfig` (60 layers: 7+6+11+9+1+1+3+4+1+1+16, `:142-261`) → `initVentusMap` (`:263`).

**F2. The owner's own additive mechanism is "extend an existing slot's cartridge", twice documented and once used in the live generation.**
`atlas/current.json:252-257` (`supersedes_cartridge`): "the composer has one slot type and four shell scripts, three already used … it extends it rather than claiming a fourth slot". `tools/build-cartridge.mjs:4-9`: "one file per shell script slot … That does not mean it has to be WRITTEN as one file". `tools/recompose.mjs:103,274-281` implements `--add-module <id>=<path>`. Decisively, the live sld-sandbox proof `tools/proofs/202609241334-sld-sandbox.proof.mjs:11-21` asserts `source === (202609200022 cartridge + 5 reviewed replacements) + '\n' + atlas/modules/202609241334-popup-viewport.js`: the live generation was cut by appending a module to the previous cartridge bytes, with an exact-delta proof. The lightning implant should be exactly that shape with zero replacements.

**F3. Only the sld-sandbox slot has byte headroom; the engine/menu slot cannot host it.**
`tools/scope/loop.mjs:194` fails any cartridge over 460,000 bytes. Measured (evidence 06): substation-intelligence 451,935 (headroom 8,065); sld-sandbox 435,218 (headroom 24,782); bridge 13,589; search 41,120. The preview module alone is 8,751 bytes; PR #1's `history-window.mjs` is 8,990. Appending lightning to substation-intelligence breaches the ceiling; appending to sld-sandbox fits only if the module stays ≤ 24,781 bytes (both pieces together ≈ 17.7 kB, leaving ~7 kB). The bridge and search slots are the wrong data plane (AGENTS.md:15) and the sld-sandbox is the slot that already captured the map handle and absorbed a sibling cartridge (F2). **Target slot: sld-sandbox, replace_script `202608292126-pre-snapped-config-adapter.js`, with a hard size budget.**

**F4. The live sld-sandbox is not reproducible from any parts manifest; recompose needs a seed or the hand-derivation precedent.**
No `atlas/manifests/202609241334-sld-sandbox-v9-8-parts.json` or `202609200022-…` exists (latest is 202609051540; evidence in shell output). The cartridge header `atlas/cartridges/202609241334-sld-sandbox-v9-8.js:1-6` says: "CARRIED FORWARD AND EDITED, NOT ASSEMBLED … Do NOT rebuild this cartridge from those parts". `recompose.mjs:215-224` therefore either needs `--parts-from sld-sandbox=<seed.json>` whose `assembled_from` lists the live cartridge as one `part`, or falls back to a verbatim copy (`:335-339`) in which `--add-module` is NOT applied. With a seed the module is inserted before the part (`:278-279`) and `build-cartridge.mjs:99-111` prepends a header, so the original bytes become a byte-exact suffix. The live sld-sandbox contains no `const VERSION_LEDGER` (0 matches), so `recompose.mjs:290-305` will not rewrite the live file in place. Either route is legal; the proof must assert the exact delta.

**F5. The preview loader copy violates the loader-copy invariant that the estate already has.**
`diff atlas/index.html atlas/preview/lightning/index.html` (evidence 04) shows a title change and 12 added lines (`preview/lightning/index.html:83-93`) inventing a `weather_module` key and a fifth injection before `</body>`; `current.json` there adds five keys not in schema v2 (`baseline_route, preview_only, preview_purpose, preview_route, weather_module`). Meanwhile `atlas/v/<generation>/` holds 26 published candidate routes whose `index.html` is byte-identical to the root loader (`cmp` differs 0 of 26, evidence 07) with a `current.json` using `../../` paths — documented at `docs/CI-CD-PLAN.md:92-98` and `tools/proofs/export-print-and-image-outcomes.browser.mjs:104-110`: "A pinned candidate route under atlas/v/<generation>/ composes its own generation without changing anything the live route serves, which is how a candidate is measured here without shipping it." The preview is a second loader with its own semantics — "another full application copy" in miniature (AGENTS.md:12) and a schema fork the root composer would reject.

**F6. The bridge fork is unnecessary; the data plane already passes `.json`.**
Original bridge `atlas/cartridges/202609241251-streaming-parquet-bridge-v9-5.js`: `requestPath` strips origin (`:72-79`), `mapReadyKey` whitelists 11 release paths (`:81-86`), `legacyStem` claims `repd_master.json`, `heavy_emitters_uk.json` and ANY `*.geojson` (`:88-94`), and `window.fetch` (`:277-287`) hands everything else to `nativeFetch` at `:287`. The fork (evidence 05) is a 6-line origin check at `:75-80`. A feed named `.json` (PR #1 shards) never reaches `legacyStem`'s `.geojson` branch, so the original bridge bytes stay LIVE and untouched. `XMLHttpRequest` is not hooked (no occurrence in the file). The transport lane must prove this in a browser; architecturally the fork is a replacement of a live cartridge that no requirement needs.

**F7. The preview module changes original geometry with lightning OFF.**
`atlas/preview/lightning/weather-module.js:71` `body.prepend(group,label)` into the Grid dropdown; `:104` `host.prepend(weatherGroup)` into `#scada-ui-container` and `#fs-curtain-keys` (`:108-109`), and `:66,:101` write a visible `[WAIT]` status at idle. Prepending moves every original control below it on three surfaces whether or not the layer is on — the owner's "looks different" is structurally explained. The engine builds `#scada-ui-container` and `#fs-curtain-keys` in one pass from `ukConfig` (`ventus-corev8engine.js:1000-1022`) and the menu bar proxies only `[data-layer-id]`/`[data-pn-layer]` inputs (`atlas/modules/202609031958-menu-bar.js:107-128, 1428-1488`), so any additive row must be added by the module to each surface itself; it must be **appended**, never prepended, and must not carry those attributes (count at `:122-126` fails closed otherwise).

**F8. lint/state fail on main for a pre-existing reason, and the cartridge-proof gate will fail any PR until it is resolved.**
Reproduced (evidence 01): `active workflow budget mismatch` because `.github/workflows/uk-lightning-preview.yml` is not in `ACTIVE_WORKFLOWS` (`tools/scope/lib.mjs:42-65`, 9 names) — `loop.mjs:105`. `lint()` throws at `:211` before `validateAtlasLayout` (`:212`), so `state --stdout` emits nothing and parity with STATE.md cannot be proven. `.github/workflows/202608312212-cartridge-proof.yml` runs on `pull_request` for `atlas/**, tools/proofs/**, tools/scope/**, STATE.md` and executes `loop.mjs lint`, `loop.mjs state` and `git diff --exit-code -- STATE.md`. Classification: **pre-existing FAIL on main (not introduced by the candidate)**. Two legal fixes: (a) register the file in `lib.mjs` → STATE.md "Active workflows" becomes 10 → STATE.md must change, which the owner forbade before approval; (b) **delete `.github/workflows/uk-lightning-preview.yml`** (rejected preview tooling; `pull_request`-only, so production is untouched) → budget returns to 9, STATE.md unchanged, lint and state pass. (b) is the only fix consistent with the STOP condition. It cannot be archived into `.github/workflow-archive/202608301321-hostile-amnesia/` (count pinned at 21, `loop.mjs:109`).

**F9. What lint, state parity and the proof runner require of a new generation.**
`loop.mjs:148-150,162-165` fix release_id/routes/shell; `:166-179` every ordered cartridge exists under `atlas/` and its LF SHA-256 matches; `:194` ≤ 460 kB; `:152-154` `releases/current-v5.json` and `state/live-set.json` must stay identical to each other (both already stale at `atlas_composition.generation 202609051624` — pre-existing, tolerated). `verify-compose.mjs:51-52` hash and slot present in shell; `:77-84` manifest generation equals current, order equal, `acceptance.full_application_copies_created === 0`. `tools/proofs/run-current.mjs:30-38` demands `tools/proofs/<cartridge.generation>-<id>.proof.mjs` for every composed cartridge — the sld-sandbox proof must be renamed to the new stamp (recompose does this at `:341-348`). STATE.md's only moving line is `Composition:` (`loop.mjs:243,246`). AGENTS.md:16 ties the current.json change and `node tools/scope/loop.mjs state` to one commit.

**F10. V1 (cd9a27e) had the right shape and the wrong two acts.**
Evidence 08: it restamped sld-sandbox to 202610221600 by appending 33 lines that wrapped `window.initVentusMap` and `groups.push`ed a 61st `ukConfig` layer with a `.geojson` URL — breaking the 60+3 contract and hitting the bridge — and it moved the LIVE pointer directly (`previous_generation: 202609241334`) with a hand-written manifest whose `composition_manifest`/`composition_id` still name 202609241334 and `parent_generation: null` (evidence 10) — the identity drift `recompose.mjs:4-10` exists to prevent. Rolled back by hand (1eb6414, c09d199), not via `tools/rollback.mjs`.

## Objections to other lanes

- Transport: do not accept "XHR works" alone; `.json` naming already passes `bridge:287`. Also test MapLibre worker-side `addSource({data: url})`, which does not see the main-thread hook (`state.architecture.delivery: 'MAPLIBRE_WORKER_DIRECT_URL'`, `bridge:35-48`), before adding any fetch code.
- Menu/visual lanes: a toggle **inside** the three surfaces is itself a geometry change; "pixel identical with lightning OFF" can only mean "no original control moves or resizes". Append-at-end satisfies that; prepend never does. The accepted baseline already contains additive non-inventory controls (sld-sandbox tray chips, `current.json:455-466`), so an appended row or a chip is the precedent, not an inserted group.
- Builder: do not restamp substation-intelligence to add a ledger row (F3). Do not type a generation stamp (`recompose.mjs:53-64`). Do not use `atlas/preview/`.

## Recommendation for the smallest additive integration

**Candidate branch (live pointer untouched):**
1. NEW `atlas/modules/<GEN>-uk-lightning-overlay.js` (≤ 24,781 bytes). Self-contained IIFE: polls for `window.__GRIDATLAS_V9_MAP__` (set by the search cartridge `202609071213-place-global-search-v9-5.js:230`), `window.__GRIDATLAS_MODULES__.menuBar.installed` (`menu-bar.js:1731`) and the populated `#scada-ui-container`; adds one GeoJSON source and one circle layer with `layout.visibility:'none'`; **appends** one synchronised row to `#scada-ui-container`, `#fs-curtain-keys` and the Grid panel body, with no `data-layer-id`/`data-pn-layer`, no `ukConfig`, `initVentusMap` or `window.fetch` reference; loads `.json` shards/index only on first activation; labels period, UNKNOWN days and "optical flashes, not ground strikes".
2. NEW `atlas/cartridges/<GEN>-sld-sandbox-v9-8.js` = bytes of `202609241334-sld-sandbox-v9-8.js` + `'\n'` + module (or recompose + seed, F4).
3. RENAME `tools/proofs/202609241334-sld-sandbox.proof.mjs` → `<GEN>-sld-sandbox.proof.mjs`; replace lines 11-21 with `expected = read(202609241334 cartridge) + '\n' + read(module)`; add static negatives (`/ukConfig|initVentusMap|window\.fetch\s*=|data-layer-id|data-pn-layer|\.geojson/` absent from the module; `visibility:'none'` present); keep `vm.Script`.
4. NEW `atlas/manifests/<GEN>-composition.json` derived per `recompose.mjs:392-420` (`parent_generation: "202609241334"`, acceptance scope/proof/`golden_browser_verification: PENDING_THIS_GENERATION`).
5. NEW `atlas/v/<GEN>/index.html` (byte-identical copy of `atlas/index.html`, `cmp` = 0) and `atlas/v/<GEN>/current.json` (candidate composition with `../../releases/…`, `../../cartridges/…`, `../../manifests/<GEN>-composition.json`).
6. DELETE `.github/workflows/uk-lightning-preview.yml` (F8). Optional owner-approved cleanup: `atlas/preview/lightning/`, `atlas/cartridges/202610230100-…`, `tools/proofs/uk-lightning-preview.browser.mjs` (audit classes TOOLING/ROLLBACK, evidence 09).
Untouched: `atlas/current.json`, `STATE.md`, `atlas/releases/**`, `atlas/index.html`, all four live cartridges, pointer files.

Pseudo-diff of the release step (separate PR, after owner visual approval):
```
 atlas/current.json
-  "generation": "202609241334",  "previous_generation": "202609200022",
+  "generation": "<GEN>",         "previous_generation": "202609241334",
   sld-sandbox: generation/version/path/sha256 → <GEN>/v9.158/./cartridges/<GEN>-sld-sandbox-v9-8.js/<sha>
+  capabilities += "uk-lightning-optical-flash-overlay-off-by-default"
+  "derived_from": "./cartridges/202609241334-sld-sandbox-v9-8.js"
-  "composition_manifest": "./manifests/202609241334-composition.json"  → "./manifests/<GEN>-composition.json"
-  "composition_version": "v9.156" → "v9.158"   (v9.157 was burned by the rolled-back V1)
-  "composition_id": "202609241334-gridatlas-v9.156" → "<GEN>-gridatlas-v9.158"
-  "superseded_generation": "202609200022" → "202609241334"
-  "candidate_predecessor": "202609241251" → "202610221600"   (the rejected V1; honest lineage)
 STATE.md   Composition line regenerated by `node tools/scope/loop.mjs state` in the SAME commit
 state/live-set.json + releases/current-v5.json   both or neither (loop.mjs:154); recompose updates both
```
**Does `atlas/current.json` have to change for a branch preview? No.** `atlas/v/<GEN>/` is the owner's mechanism (F5); the proofs accept `--url`/`--route` for it (`all-controls.browser.mjs:11`, `export-print…:129`). It changes only at release, atomically with STATE.md, with `previous_generation`/`parent_generation` naming 202609241334 so `tools/rollback.mjs:120-132` can still walk the lineage.

## Verdict

**FAIL (pre-existing) on main** — `loop.mjs lint`/`state --stdout` fail on the unregistered preview workflow; the preview loader copy and bridge fork are architecturally inadmissible; the smallest legal implant is one appended module in a restamped sld-sandbox cartridge, previewed at `atlas/v/<GEN>/`, with the live pointer untouched until approval.
