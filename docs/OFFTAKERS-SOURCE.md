# The potential-offtakers overlay: source, build and cartridge

`atlas/modules/<G>-uk-offtakers-overlay.js` is built from `tools/offtakers/src/` by `tools/offtakers/build.mjs`, with
the same deterministic transform as the lightning overlay (`tools/lightning/build.mjs` `assemble()`, docs/LIGHTNING-SOURCE.md):
files in name order, `///` source-only lines dropped, `///` continuations joined, `@@GEN@@` stamped. There is one variant.

    node tools/offtakers/build.mjs --gen <G> --out /tmp/m.js   # build
    node tools/offtakers/build.mjs --check                     # PR gate "offtakers-source"

Every generation listed in `tools/offtakers/generations.json` must rebuild byte for byte, and the newest
`*-uk-offtakers-overlay.js` must be listed.

## What it is
A Layers group "Potential offtakers", OFF by default and never persisted. Switched on, it draws sites listed in open
registers (NAEI 2023 point sources less power producers and offshore; OpenStreetMap industry, data centres and, behind a
chip, water works), read from the shell's own preloaded layers when they hold rows, else from the pinned, SHA-256-checked
globalgrid2050 files. A tap draws neon links to the 15 nearest REPD project sites (40 km; status and technology chips as in
the lightning card; ties at the 15th kept) and the 5 nearest substations (the original `link.measure.nearestSubstations`),
and docks a card with each listed project's full REPD record (`src/04-repd-record-m5.js`, M5-build's exact join copied
unchanged), a 5 km area summary and a CSV vicinity sheet. A listing is not electricity demand; distances are straight
lines; vicinity screening only. Design: the hardening lane PW-design's OFFTAKERS-OVERLAY-SPEC.md (29 Oct 2026).

## Cartridge
It ships as its own cartridge (docs/LIGHTNING-CARTRIDGE.md, loader v2): `uk-offtakers-overlay`, slot `after-cartridge`,
`after: uk-lightning-overlay`, last in `cartridge_order`, path = the module file, budget 40,000 B
(`CARTRIDGE_BYTE_BUDGETS`). Each generation has `tools/proofs/<G>-uk-offtakers-overlay.proof.mjs`, which calls
`tools/proofs/offtakers-cartridge.mjs` (identity, anchor, hashes, budget, source rebuild, one strict IIFE, static
negatives and positives, and a v2 composition in node:vm with every other cartridge unchanged). The lightning proof
(`tools/proofs/lightning-cartridge.mjs`) takes further chained after-cartridges out of its arrival-parity comparison.

To cut one: `node tools/release/split-lightning-cartridge.mjs --from <lightning M> --generation <G> --version <vX>`, then
add the offtakers entry (the hardening lane OT-build's `add-offtakers-cartridge.mjs`), list G in `generations.json`.
