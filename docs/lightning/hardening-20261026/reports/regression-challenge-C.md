# regression-challenge-C: Step C regression challenge (P03–P09, P12, P13, P16, R08, R11)

Final, 2026-10-27 00:10 UTC.

Evidence root: `E = /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/evidence/regression-challenge-C`.

Harness:
- Lead offline shim, Playwright 1.63.0, **Chromium headless only**. The "iPhone" runs are Chromium with an iPhone UA, not WebKit.
- Baseline: main c08f3a6 (202609241334), served at `:8143/gridatlas/atlas/`.
- BEFORE: fda6b10 (202610261949), served at `:8144/wt/atlas/v/202610261949/`.
- AFTER: 202610262323, served at `:8162/wt/atlas/v/202610262323/`.

## Pinning (`E/head-verification.txt`)

- `git diff --stat fda6b10 HEAD -- atlas tools .github` was empty at 22:55 and 23:03.
- From 23:12 it shows 18 **added** files only: generations 202610262310/2318/2323. There are 0 modified and 0 deleted files.
- The fda6b10 cartridge, module, loader, v/…/current.json, atlas/current.json and atlas/index.html are byte-identical to their fda6b10 blobs, so every BEFORE run served the pinned bytes.
- Production c08f3a6 is clean before and after the run.

## Results

| ID | BEFORE fda6b10 | AFTER 202610262323 | evidence | command |
|---|---|---|---|---|
| P03 | **PASS**: 435,218 + 1 + 23,973 = 459,192, byte-exact; 0 CR; no BOM; current.json and manifest sha256 match; live blob unchanged | **PASS**: 435,218 + 1 + 23,226 = 458,445, byte-exact; hashes match; generation proof passes | `E/p03-exact-delta.resume.json`, `E/p03-exact-delta-after.json`, `E/static-sld-*-proof.log` | `node E/p03-exact-delta-gen.mjs <gen> <sha>` |
| P04 | **PASS**: 4 replace-script slots; the 3 other cartridges unchanged; loader identical to atlas/index.html (e1e403f6…); same shell; MapLibre 3.6.2; no protected path touched | **PASS** (static): same 4 slots; loader `cmp`-identical | `E/p04-static.txt` | `cmp atlas/index.html atlas/v/<gen>/index.html` |
| P05 | **PASS** at 4 viewports, OFF and ON: inspect {60,3,63,63,true}, 63 proxies, 63 markers, basemap radios excluded. Weather is the 14th native/curtain group (last) and sits at the end of the Grid panel. Lightning nodes carry 0 forbidden attributes | **PASS (OFF, 393 + 360 only)**: same inventory; Weather is the 14th group, last; Grid headings now **identical to baseline** (mirror removed); 0 forbidden attributes. 1440, 390 and ON are **BLOCKED_HARNESS** (OOM) | `E/challenge-paired-table.md`, `E/challenge/after/*/result.json` | `node E/challenge-c.mjs …`; `node E/compare-challenge.mjs` |
| P06 | **PASS** at 4 viewports: six menus, body click, ArrowDown to engine:400 with Escape focus restore, Layers toggle, search, fullscreen and curtain identical to baseline. The 16 capture listeners are identical; lightning adds only bubble listeners on its own nodes and #scada/#fs `change` | **BLOCKED_HARNESS** (renderer OOM mid-run). Capture listeners 16 = baseline | same | same |
| P07 | **PASS**: Tab order identical plus one stop (the lightning toggle) at the end of the native panel. Shift+Tab, Space, Escape and arrows identical. The lightning toggle is a named implicit checkbox; chips are reachable by Tab and Enter | **BLOCKED_HARNESS** | same | same |
| P08 | **PASS** (real taps): original-target outcomes identical at 393/360/390. The lightning checkbox is 16.9 px, the same as the original native inputs; its label row is 30 px; chips are 44×44 | **BLOCKED_HARNESS** | same | same |
| P09 | **PASS**: OFF has no lightning source or layer. ON adds exactly 1 source and 1 layer. After OFF, after rapid ×5 and after a reload, the map equals boot. The 400 kV click after the cycles is identical. Layer clicks: the same 12 PASS layers at 1440 and 393 (393 identical layer for layer). A grid click **while ON** is **NOT_TESTED** (probe `E/p09-on-click.mjs` killed by restart/OOM) | **BLOCKED_HARNESS** | `E/catalogue-paired-table.md` | `node E/build-paired-catalogue.mjs` |
| P12 | **PASS**: 0 lightning-owned mutations in 30 s idle, OFF and ON, at 4 viewports; totals equal baseline (2,010) except one extra 1 Hz tick of the original menu bar at 1440 | **BLOCKED_HARNESS** | `E/challenge-paired-table.md` | as P05 |
| P13 | **PASS** (page.clock fake timers, 671 s virtual). OFF: 0 lightning requests, 0 module fetches; the only module timer is the 250 ms install poll (cleared); 56/100 sources/layers equal baseline. ON: only declared endpoints, and the refresh fires at 607.7 s (positive control). Back OFF: 0 requests and the timer is cleared | **PASS (OFF)**: 767 s virtual, 0 lightning requests, 0 module fetches, install poll cleared, 56/100 sources/layers. **ON: BLOCKED_HARNESS** (killed at the segment deadline after OOM slowed boot to 26–77 s) | `E/p13-clock/`, `E/p13-clock-after/` | `node E/p13-clock.mjs --phase off\|on --minutes 11` |
| P13-decl | **FAIL** (defect, see below) | **FAIL** (unchanged) | `E/{candidate,after}-static/logs/data-contract-parity-202609012214/stdout.log` | data-contract-parity proof in `E/shadow-{candidate,after}` |
| P16 | Static **PASS**: 23,973 ≤ 24,000; 459,192 < 460,000; no CDN, injection, storage or fetch patch. Runtime **BLOCKED_HARNESS**: CPU/memory contention, see below | Static **PASS**: 23,226 (gzip 10,253) and 458,445. Runtime **BLOCKED_HARNESS** | `E/p16-static-before-after.txt` | `E/p16-boot-paired.mjs` |
| R08 | **BLOCKED_DEPENDENCY** (DuckDB extension, REPD/Parquet layers, search, basemap tiles and glyphs) + **BLOCKED_HARNESS** (no WebKit) | same | `E/baseline-browser-shim/logs/all-layer-clicks-1440/shim.jsonl` | n/a |
| R11 | **PASS** + **OWNER_DECISION** | same (the file stays deleted; only additive changes) | `E/r11-*`, `E/candidate-static-table.md` | `git show c08f3a6:.github/workflows/uk-lightning-preview.yml` |

## FAIL: P13-decl, undeclared lightning fetches (BEFORE and AFTER)

The estate gate `tools/proofs/202609012214-data-contract-parity.proof.mjs` gives:
- main: 6/9, with 3 pre-existing failures;
- both candidates: 6/11, adding **2 new** failures, `sld-sandbox: data/history/ fetched by the bytes is declared on the entry` and `… data/uk_lightning.geojson …`.

The endpoints appear only under the bespoke `uk_lightning` key, not under `data_sources`. Because the row already read "FAIL (pre-existing)", a status-only diff hides this.
- **Severity:** defect (a provenance gate, not user-visible).
- **Location:** the sld-sandbox entry in `atlas/v/202610262323/current.json` and `atlas/manifests/202610262323-composition.json`.
- **Minimal fix:** append two `data_sources` items:
  - `{repository:"Ventusltd/lightning", product:"data/history/", schema_required:<index schema>, fetched:"only while switched on"}`
  - `{repository:"Ventusltd/lightning", product:"data/uk_lightning.geojson", …}`

  This requires a new generation, because the manifest is immutable.

## Differences investigated, not regressions

**Static catalogue** (40 proofs):
- `scope-lint` and `scope-state` go from FAIL on main to PASS. Main has 10 workflows against a budget of 9; the candidate deletes `uk-lightning-preview.yml`.
- `sld-202609241334` goes from PASS to FAIL. It is the predecessor's generation-pinned strict-equality proof and reads the cartridge via current.json. The successor proofs for 202610261949 and 202610262323 both pass, and P03 proves the prefix is identical.
- AFTER differs from BEFORE only in the generation string printed by `quantumspawn`.

**Browser catalogue** (19 proofs, paired chunk by chunk, same shim):
- 17 proofs have the same status, and the same-status FAIL logs are identical after normalising timings. Exceptions: export PNG sizes differ by 3–200 bytes (canvas non-determinism), and PDF filename timestamps differ.
- `uk-lightning-preview` goes from PASS to FAIL ("baseline generation mismatch"). It asserts that the self-served root `/atlas/` is production, so it fails whenever a candidate is mounted there. This is a harness artefact.
- `all-controls-desktop`: 23/26 steps are identical. The 3 differing steps are **renderer crashes caused by memcg OOM** (dmesg: "Memory cgroup out of memory: Killed process … chrome-headless"; limit 5.84 GiB, shared with other lanes).
- `all-controls-mobile` is identical across all 26 steps.

**Layer clicks:** the crashed layers are the same heavy layers on both routes.

**Challenge table:** 66 of 156 rows differ, all explained by the additive group, one tab stop, the lightning listeners, candidate-only steps and timing. Console errors are shim `ERR_BLOCKED_BY_CLIENT` aborts on both routes.

**P16 runtime:**
- Boot transfer +25 KB, about +200 DOM nodes, +6 listeners.
- Boot timings are not comparable. The candidate mobile runs overlapped another browser, and other lanes share 2 CPUs and the memcg (`E/logs/contention-*.txt`).
- The interleaved rerun was lost to the restart and the OOM.

## R08

- DuckDB `extensions.duckdb.org` is aborted in 44 of 60 layer contexts, so 41 Parquet layers show `[FAIL]` with eligible 0 on **both** routes.
- Search fails on both.
- The basemap is the shim's background-only style.
- `/opt/pw-browsers` has no WebKit.
- None of these are upgraded to PASS.

## R11

- The deleted workflow fired only on `atlas/preview/lightning/**`, the preview bridge, its own proof and itself. It guarded no original or candidate file.
- `202608312212-cartridge-proof.yml` still covers `atlas/**`, but it proves `atlas/current.json`, not `v/<gen>`. So the candidate proof is not run in CI before release.
- Alternative budget fix: move the file to `.github/workflow-archive/<new-dir>/`. The lint counts only `.github/workflows` and the `202608301321-hostile-amnesia` 21, so lint stays green.
- **OWNER_DECISION:** the rejected preview `atlas/preview/lightning/**` remains published with no CI. Delete or archive it.

## Why the AFTER browser rows are BLOCKED_HARNESS

- Three segments ran from 23:39 to 00:09. Every AFTER browser run hit `Target crashed`, while the memcg OOM-kill counter rose by 40–50 per segment.
- The memcg stayed at its 6.27 GB limit, filled by other lanes' parity, matrix and a11y browsers.
- Salvaged without crash taint: AFTER P05 OFF inventory at 393/360, and AFTER P13 OFF.
- Status files: `E/steps-final.txt.status.seg1-oom`, `E/steps-final2.txt.status`, `E/steps-crit.txt.status`.
- To finish, rerun `E/segment.sh E/steps-final2.txt` (segments under 10 minutes) when the container is quiet.
