# Proposal: the menu bar as its own cartridge

**Proposal only. Nothing under `atlas/` changes in this branch.**

## The measurement

The reviewer's amplification point: "Release amplification is excessive …
Menu/UI code should become a small independent cartridge." Measured, not
asserted:

The menu bar lives in one module, `atlas/modules/202609031958-menu-bar.js`
— **919 lines**. Today that module is assembled into exactly one cartridge,
`substation-intelligence` (see
`atlas/manifests/202609042123-substation-intelligence-v9-63-parts.json`,
line 76). But the generation that last repaired it,
`202609042123-gridatlas-v9.116` ("the v8 layers panel is back beneath the
menus"), restamped **both** composed cartridges:

| cartridge | file | lines |
|---|---|---:|
| sld-sandbox | `atlas/cartridges/202609042123-sld-sandbox-v9-8.js` | 7,382 |
| substation-intelligence | `atlas/cartridges/202609042123-substation-intelligence-v9-63.js` | 6,345 |
| **total regenerated** | | **13,727** |

A fix to one 919-line module regenerated 13,727 lines of composed
cartridge bytes — 14.9× amplification — because `tools/recompose.mjs`
reassembles a cartridge whole from its part list; there is no unit smaller
than "the whole cartridge" to restamp. (`sld-sandbox` does not carry the
menu module in its own parts manifest, yet was restamped in the same cut
because the two cartridges' layout depends on each other at that
generation — the SLD panel's dock geometry the menu bar's height math
reads. That coupling is itself part of what "small independent cartridge"
would remove.)

A more recent, unlanded example on `candidate/v9.117-menu-contiguous`
(`c44ba11`) touched only `atlas/modules/202609031958-menu-bar.js` — 112
lines changed — and would, if composed today, still require
`substation-intelligence`'s full 6,345+ lines to be reassembled and
rehashed to carry those 112 lines to the served page.

## What a cartridge cut would look like instead

`estate-menu.js` (the shared estate menu module,
`https://ventusltd.github.io/spiders/species/seer-spider/estate-menu/estate-menu.js`,
942 lines, verified reachable — `200`, fetched directly for this proposal)
already exists as a **separate, independently-versioned** file outside this
repository. Its own `INTEGRATION.md` is explicit that gridatlas should
**not** load it as a second script:

> GridAtlas already has a menu bar … Adding `estate-menu.js` there as a
> second script would trip this module's own refusal … GridAtlas does not
> need a second bar, it needs its *existing* bar to carry the estate's
> other surfaces.

The contract it describes: GridAtlas's own `install(doc)` in
`202609031958-menu-bar.js`, immediately after `buildLayerControls(ready.found)`
(line 774) and before the `move(panels.File, …)` calls at line 776, reads
`window.__VENTUS_ESTATE_MENU__.entries(name)` for `'File'`, `'Edit'`,
`'View'` and `'About'` only — never `'Scope'` or `'Grid'`, which stay
GridAtlas's own real controls — and appends the same row/link shapes
`estate-menu.js` builds internally, under an `Estate` heading, guarded by
`typeof window.__VENTUS_ESTATE_MENU__ === 'object'` so a page where the
estate script never loaded is unaffected.

**The proposed cut, when someone actually schedules it (not this branch):**

1. Extract the menu bar's *own* logic — `buildBar`, the panel-move calls,
   `applyClearance`, the estate-entries reader above — out of
   `substation-intelligence`'s part list into its own cartridge, e.g.
   `menu-bar` (slot `replace-script` against whatever the shell names, the
   same mechanism `streaming-parquet-bridge` already uses at 328 lines and
   `place-global-search` at ~800).
2. `tools/recompose.mjs --restamp menu-bar` then touches **one** cartridge
   file on a menu-only change. `substation-intelligence` (currently 6,345
   lines) and `sld-sandbox` (7,382 lines) stop being restamped for a menu
   edit at all, because the module they no longer carry cannot appear stale
   in their own bytes.
3. Measured cost of NOT doing this, per menu-only cut, at today's sizes: up
   to 13,727 lines of unrelated cartridge content re-hashed, re-verified by
   `verify-compose.mjs`, and re-shipped to every client that re-fetches
   those cartridges — for a change that touched 919 lines at most.

## What this proposal does not claim

- It does not claim the estate-menu.js integration should be wired up in
  this repository now — `INTEGRATION.md` explicitly frames every snippet in
  it as unapplied, and doing so is its own composition cycle with its own
  proof, per `gridatlas/CLAUDE.md`.
- It does not claim `sld-sandbox`'s growth (5,144 → 7,382 lines across the
  generations sampled while preparing this task) is caused by the menu
  bar — most of that growth is the SLD sandbox's own feature history. The
  point measured here is narrower: the menu bar is the one module that, by
  being embedded rather than cartridge-scoped, forces cartridges that did
  not change to be restamped anyway.
- No file under `atlas/` was touched to write this proposal.
