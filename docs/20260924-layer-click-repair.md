# Layer and control repair, 24 September 2026

The Trams, DLR and UK Metro station controls were disabled after loading because
their shared URL selected `uk_metros_trams_root.parquet`: 7,829 track LineStrings.
The existing circle layers require points and their station classification filters.
The explicitly selected, already published station partition contains 5,267 Points:
1,294 match Trams, 216 DLR and 1,672 UK Metro. This is a historical snapshot, not a
claim of current network completeness. The previous quarantine and this deliberate
selection are recorded in the composition manifest. No dataset was rewritten.

Browser testing also found two card defects. Project-card bounds only considered
space below the card, so a tall card could extend above the map; calculated height
was overridden by shared `!important` CSS. Ordinary industrial-site cards could
put their close button behind the mobile search field. The new cartridge bounds
project cards below the menu and gives ordinary cards visible 44px close controls
below the search field. Existing mobile project sheets retain their own controls.

## Verification

`tools/proofs/all-layer-clicks.browser.mjs` loads the actual composed application,
uses every one of its 60 engine layer controls, waits for rendering, navigates to
one eligible feature per layer, clicks/taps it, closes its card, and switches the
layer off. It writes per-layer JSON and three screenshots. Camera placement uses
the map API; controls and feature hits use actual browser input. This verifies a
representative interaction per layer, not every feature or every possible viewport.

`tools/proofs/all-controls.browser.mjs` additionally exercises menus, drawing,
measurements, downloads, search, fullscreen, card controls and Pipeline layers.
Windows uses installed Chrome; hosted Linux uses pinned Playwright Chromium.
The Android profile emulates a 393×852 touch device. Physical Android/iPhone and
native print-dialog output are outside these automated receipts.

`prepare-layer-census.mjs` reads the actual shell definitions. `layer-census.py`
verifies published Parquet hashes and computes scalar CPU reference masks from
original properties. `layer-census-gpu.py` uses CuPy on the local NVIDIA GPU to
independently evaluate geometry/filter masks and coordinate bounds. The corpus
contains 60 layers, 40 source partitions, 745,368 feature/layer pairs and 3,634,033
coordinate tuples. Pairs include shared-source evaluations; they are not a claim
of that many unique features. String membership is encoded into dictionaries
before GPU evaluation. No synthetic or repeated billion-case counts are used.

Run the complete local gate with a Python containing NumPy/PyArrow, a CuPy Python,
and the published data directory:

```powershell
./tools/proofs/verify-layers-local.ps1 -DataRoot <data-directory> -GpuPython <gpu-python.exe>
```

The existing cartridge Actions workflow adds desktop and Android touch-emulation
jobs. Hosted browser jobs are not GPU runs. Local GPU receipts and browser receipts
are distinct evidence. A failed assertion exits nonzero.

Three published cartridge generations had no generation-matched proof files.
Search now carries its existing behavioural suite forward. The unchanged engine
has explicit published-byte/syntax checks. The SLD proof verifies its exact delta
against the published predecessor, with browser behaviour covered separately.
These integrity proofs do not claim to rerun the obsolete parts-assembly suite:
the published cartridges have already diverged from those historical parts.

The arrival browser regression now restores the intentionally minimized mobile
card through its real button before checking visible measurement text. Its
identity, absence and retry assertions remain in force.

The immutable release shell and existing datasets remain unchanged. Changes are
new cartridges, a bounded popup module, a new composition, tests and CI wiring.

## Changed files

- `.github/workflows/202608312212-cartridge-proof.yml`
- `STATE.md`
- `atlas/cartridges/202609241251-sld-sandbox-v9-8.js`
- `atlas/cartridges/202609241251-streaming-parquet-bridge-v9-5.js`
- `atlas/current.json`
- `atlas/manifests/202609241251-composition.json`
- `atlas/modules/202609241251-popup-viewport.js`
- `docs/20260924-layer-click-repair.md`
- `tools/proofs/202609040229-arrival-identity.browser.mjs`
- `tools/proofs/202609062358-substation-intelligence.proof.mjs`
- `tools/proofs/202609071213-uk-gazetteer-flyto.proof.mjs`
- `tools/proofs/202609241251-sld-sandbox.proof.mjs`
- `tools/proofs/202609241251-streaming-parquet-bridge.proof.mjs`
- `tools/proofs/all-controls.browser.mjs`
- `tools/proofs/all-layer-clicks.browser.mjs`
- `tools/proofs/layer-census-gpu.py`
- `tools/proofs/layer-census.py`
- `tools/proofs/prepare-layer-census.mjs`
- `tools/proofs/receipts/202609241251-local-browser.json`
- `tools/proofs/receipts/202609241251-local-controls.json`
- `tools/proofs/receipts/202609241251-local-gpu.json`
- `tools/proofs/verify-layers-local.ps1`
- `ui/cartridges/202609241251-streaming-parquet-bridge-v9-5.mjs`

## Hosted browser timing correction

The first hosted run passed both 60-layer sweeps. Its control audit sampled a
temporary print image after native headless printing had already removed it,
and sampled one Pipeline layer before its source finished rendering. The audit
now observes the decoded raster at the actual native print call (calling native
print through), and waits for source loading plus a rendered feature. Actual
PNG/PDF downloads are awaited as events. Both 26-control profiles pass locally
with the CI Chromium 151 build as well as the earlier Chrome 153 run. Output
directories can be selected with `--out`, and failures also save screenshots.
