# atlas-regression-auditor — evidence index

Report: ../../reports/atlas-regression-auditor.md · Protocol: CANDIDATE-PROTOCOL.md

Scripts (all read-only against the clones; Playwright resolved through node_modules/ symlinks here):
- run-baseline.mjs      whole proof estate with per-proof process-group timeouts; `--shim` runs the UNMODIFIED browser proofs under the lead's offline shim via shim-preload.cjs; `--group static|historical|python|browser|live`; `--only`, `--skip`, `--concurrency`, `--lightning-data-dir`
- shim-preload.cjs      NODE_OPTIONS=--require preload: patches chromium.launch so every context gets installOfflineShim + raw.githubusercontent.com pass-through (+ GRIDATLAS_SHIM_DENY, GRIDATLAS_SHIM_LOG)
- assess.mjs            merges results.json files into one table with an assessed column; `--diff baseline-table.json` for the candidate
- compare-candidate.mjs baseline vs candidate under identical contexts: DOM/geometry/style/network manifests, masked pure-Node PNG diff, lightning-OFF invariants; `--self-parity` noise floor; run with NODE_OPTIONS=--require shim-preload.cjs
- lightning-cases.mjs   the ten lightning failure-mode cases through an adapter (adapters/v5-preview.mjs today; adapters/candidate.template.mjs for the candidate)
- probe-route.mjs       what headless Chromium gets from a URL (failed hosts, sentinels, screenshot)

Results:
- baseline-table.md / .json          table 1 (as-is, 81 rows)         baseline-{static,historical,python,browser,live}/
- baseline-shim-table.md / .json     table 2 (under the shim, 20 rows) baseline-browser-shim/, baseline-browser-shim-alone/
- self-parity/, self-parity-shim/    harness noise floor
- compare-v5-preview/                original vs rejected V5 (geometry, pixels, DOM)
- lightning-cases-v5/                failure modes on V5 (the floor the candidate must beat)
- probe/, server-8107.log

Candidate run (same commands, candidate URL):
  node run-baseline.mjs --repo <clone> --base <candidate-url> --out candidate-browser-shim --group browser --shim --concurrency 1 --label candidate-browser-shim
  node assess.mjs --label candidate --dirs candidate-browser-shim --out candidate-shim-table.md --diff baseline-shim-table.json
  NODE_OPTIONS=--require $PWD/shim-preload.cjs node compare-candidate.mjs --baseline <baseline-url> --candidate <candidate-url> --baseline-generation 202609241334 --candidate-generation <gen> --allow-added "<lightning control selectors>" --out compare-candidate
  node lightning-cases.mjs --base <candidate-url> --adapter adapters/<candidate>.mjs --out lightning-cases-candidate
