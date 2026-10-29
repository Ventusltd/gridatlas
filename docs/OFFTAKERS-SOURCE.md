# The potential-offtakers overlay: source, build and cartridge

`atlas/modules/<G>-uk-offtakers-overlay.js` is built from `tools/offtakers/src/` by `tools/offtakers/build.mjs`, with
the same deterministic transform as the lightning overlay (`tools/lightning/build.mjs` `assemble()`, docs/LIGHTNING-SOURCE.md):
files in name order, `///` source-only lines dropped, `///` continuations joined, `@@GEN@@` stamped. There is one variant.

    node tools/offtakers/build.mjs --gen <G> --out /tmp/m.js   # build
    node tools/offtakers/build.mjs --check                     # PR gate "offtakers-source"

Every generation listed in `tools/offtakers/generations.json` must rebuild byte for byte, and the newest
`*-uk-offtakers-overlay.js` must be listed.

## What it is
A Layers group "Potential offtakers", OFF by default and never persisted. Switched on, it reads one file,
`data/offtakers_filtered_<stamp>.geojson`, checked against its SHA-256 pin before anything is drawn. The file is the
output of the hardening lane OT-filter (`tools/offtakers/filter/ot_filter.py`, `OFFTAKERS-FILTER.md`, `licences.md`),
built from open registers only under the owner's rules of 29 Oct 2026: energy-intensive industry (NAEI 2023 point
sources), power stations including closed and closing ones (NAEI, GPPD v1.3.0 CC BY 4.0, OSM), data centres, large water
works (small NAEI-listed works behind a sub-chip; the 5,602 OSM water rows dropped) and other large users. Classes have
chips, power stations also have status chips; dot size is the NAEI emission band or the GPPD installed MW; closed or
closing stations are hollow rings. No emission figure is shown, only the band.

A tap draws neon links to the 15 nearest REPD project sites (40 km; status and technology chips as in the lightning card;
ties at the 15th kept) and the 5 nearest substations (the original `link.measure.nearestSubstations`), and docks a card
with the site's record (operator, band or MW, curated status with its source, on-site combustion indicator, merged
records, sources and licences), each listed project's full REPD record (`src/04-repd-record-m5.js`, M5-build's exact
join copied unchanged), a 5 km area summary and a CSV vicinity sheet. A listing is not electricity demand; distances
are straight lines; vicinity screening only.

## Cartridge
It ships as its own cartridge (docs/LIGHTNING-CARTRIDGE.md, loader v2): `uk-offtakers-overlay`, slot `after-cartridge`,
`after: uk-lightning-overlay`, last in `cartridge_order`, path = the module file, budget 40,000 B
(`CARTRIDGE_BYTE_BUDGETS`). Each generation has `tools/proofs/<G>-uk-offtakers-overlay.proof.mjs`, which calls
`tools/proofs/offtakers-cartridge.mjs` (identity, anchor, hashes, budget, source rebuild, one strict IIFE, static
negatives and positives, and a v2 composition in node:vm with every other cartridge unchanged). The lightning proof
(`tools/proofs/lightning-cartridge.mjs`) takes further chained after-cartridges out of its arrival-parity comparison.

To cut one: `node tools/release/split-lightning-cartridge.mjs --from <lightning M> --generation <G> --version <vX>`, then
add the offtakers entry (the hardening lane OT-build's `add-offtakers-cartridge.mjs`), list G in `generations.json`.
