# GJ-03 native GridAtlas preview

This is a partial GJ-03 engineering deliverable, separate from Pipeline News
V9.xx. It adds one removable source-built cartridge to the existing MapLibre
composer at `atlas/v/202611171525/`. The operative `atlas/current.json`, live
loader, STATE, immutable shells and every existing cartridge stay unchanged.
There is no second application, map, canvas, collector or scheduled workflow.

The native map has a Journey action. Real assets start **WITHHELD** because no
accepted real circuit crosswalk or dataset-specific licence is supplied.
An explicit **SYNTHETIC demonstration** action loads invented review fixtures;
the user must then choose a node. Selecting an existing real asset clears the
demonstration and refuses any assumed connection. Nearby stations, shared
coordinates, line crossings and the existing spatial 30/30/30 results do not
seed a circuit or imply a transformer.

The pinned owner engine plans four synthetic source-row edges and eight moves,
including explicit backtracking: one invented reviewed polyline, two dotted
schematic connectors and one unlocated text-only edge. Only reviewed polylines
receive a travelling cursor; schematic moves are discrete. There are no MW
inputs, energisation claims or measured flow arrows. Physical unit count stays
unknown. The permanent caption explains the learning cursor and schematic
limits. Input/source/review/plan hashes and bounds are available in the panel.

## Reproduce

From a clean repository checkout:

```text
node tools/journey/build.mjs --check
node tools/journey/contract.test.mjs
node --test tools/journey/controller.test.mjs
node tools/proofs/202611171525-grid-journey-preview.proof.mjs
node tools/scope/loop.mjs lint
node tools/scope/loop.mjs state --stdout
npm ci
npx playwright install chromium
node tools/journey/browser.test.mjs
```

`build.mjs` without `--check` deterministically assembles the preview. It requires
only this checkout and Node built-ins. It never reads adjacent worktrees.
`vendor-pin.json` records repository, exact owner commit, path, byte length and
SHA256 for the canonical three-module engine closure. The source files are
unchanged Git blobs, assembled in isolated namespaces with explicit checked
ESM import/export transformations; there is no fork of the traversal algorithm.
The exact shared data/engine contract fixture retains SHA256
`174ac6824c5a8fa5d161d6529840211d7d94472e2b2a172abdc25643b0230087`.
The larger synthetic branch fixture has a separate manifest hash.

For an interactive local preview:

```text
node tools/journey/serve.mjs 8084
```

Open `http://127.0.0.1:8084/atlas/v/202611171525/`. This read-only server serves
published LF text bytes. Stop it with Ctrl+C. The browser proof uses the same
server and the actual existing composer, native MapLibre 3.6.2, WebGL canvas and
normal map assets. It does not substitute a map stub. The node controller suite
uses labelled stubs for adversarial lifecycle cases.

Local Playwright installations can set `PLAYWRIGHT_MODULE` to their existing
Playwright ESM entry point and `PLAYWRIGHT_BROWSERS_PATH` to their browser cache.
Each browser run creates a unique temporary output directory unless
`JOURNEY_BROWSER_OUTPUT` is explicitly set. The receipt includes the tested
cartridge SHA, UTC clock, MapLibre downloaded-byte hash, screenshots and network
failures. A failed run cannot leave an older PASS receipt at its output path.
The existing PR workflow has one branch-specific exact-head browser job;
the existing cartridge gate runs deterministic assembly and node tests.

## Integration and removal

The new cartridge id is `grid-journey-preview`, after `uk-offtakers-overlay`,
using the existing registered loader v2. Generation `202611171525` is preview
only, labelled `GJ-03-preview-1`. Its 64,000-byte limit is a **proposed preview
budget**, within the default 500,000-byte ceiling. It is not owner approval of a
new release budget and does not borrow the Offtakers allowance.

Public hooks are `window.__GRIDATLAS_V9_MAP__`, the module registry and the
documented `gridatlas:card-open` event. The preview does not patch card closures.
`window.__GRIDATLAS_MODULES__.gridJourneyPreview` exposes `mount(nativeMap)`,
`snapshot()` and `destroy()`. Repeated mounts reuse a live controller; explicit
mount after native map removal creates a fresh controller for the supplied map.
The bounded initial attachment timer is cancelled on removal. `Close` removes
owned map sources/layers and returns focus; `destroy` additionally removes the
panel and all listeners/RAFs. Native map removal skips the already-destroyed
style while still detaching listeners and DOM. Object identity protects foreign
sources/layers, including replacements with the same id after a style change.
The public map resize event reframes the bounded itinerary outside the panel;
close/removal restores the map's original padding.

To remove the preview from a future composition, omit its cartridge record and
order entry; existing cartridges are byte-identical to the parent generation.
There is no production pointer to roll back in this change. Do not remove or
overwrite historical preview files after publication. Any future promotion
requires the GridAtlas owner's separate acceptance and release process.

## Acceptance and remaining gates

The native browser proof covers first-click opening in the real composer,
explicit seed, branch/backtracking, reset/pause, 390/393/1440 widths, 844×390
landscape, 44px controls, viewport bounds and overflow, hit-tested Close after
rotation, retained itinerary position, Tab/Shift+Tab/Enter/Escape, reduced-motion
manual stepping, close/remount, source/layer collisions, stylesheet reload and
map removal during animation. It asserts zero page errors, one native canvas,
preservation of the initial Atlas layer ids and no surviving Journey layers
after removal. Every viewport waits for source/renderer readiness and verifies
three actual rendered located synthetic edges outside the panel. External
request failures are recorded rather than hidden. Local results are preserved
in `receipts/gj03-native-20261117.json` and
`receipts/gj03-validation-20261117.json`; hosted exact-head CI is a separate state.

This is Chromium software emulation. Physical handset, Safari, VoiceOver and
other assistive technology acceptance are **unknown**. The existing Pipeline
MAP receiver and real asset card integration are not claimed as newly accepted
by this standalone Journey test. GJ-01 real identity/rights review, GJ-04 real
regional evidence, GJ-05 qualified flow context, owner budget acceptance and
production promotion remain separate gates. No real route is accepted here.

Scope predecessors: Neural Link consolidated engineering schedule commit
`02168064dfea4929e28c04d4e9c3d6c78e148b41`, execution reconciliation PR55/commit
`e69caf8`, engine PR4 at `65d48a851fc2ac74b13f939a0184e11298e7e5bd`, and data PR12
at `d090de5fbe08bb268f66f7250389c000099a1b99`.
