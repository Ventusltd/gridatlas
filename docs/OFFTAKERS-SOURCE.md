# The potential-offtakers overlay: source, build and cartridge

`atlas/modules/<G>-uk-offtakers-overlay.js` is built from `tools/offtakers/src/` by `tools/offtakers/build.mjs`, with
the same deterministic transform as the lightning overlay (`tools/lightning/build.mjs` `assemble()`, docs/LIGHTNING-SOURCE.md):
files in name order, `///` source-only lines dropped, `///` continuations joined, `@@GEN@@` stamped. There is one variant.

    node tools/offtakers/build.mjs --gen <G> --out /tmp/m.js   # build
    node tools/offtakers/build.mjs --check                     # PR gate "offtakers-source"

Every generation listed in `tools/offtakers/generations.json` must rebuild byte for byte, and the newest
`*-uk-offtakers-overlay.js` must be listed. An older generation stays in the registry as a record, marked
`"historical": "<commit that cut it>"`: its source is that commit, and `--check` and its proof do not rebuild it.

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

## Data centres and the Grid Engine 30/30/30 (issue #73 steps 7-8, from 202610292044)
Data centres are their own class: violet, a status ring (operational, under construction, consented, in planning,
connection request, announced, refused/withdrawn, not stated), sized by the stated IT load, else the stated grid connection
(faint when neither is stated; an unlabelled MW is quoted with its label and never sizes a dot or adds to either), with their
own chip row and legend. They come from a second pinned file, `data/uk_datacentre_pipeline_<stamp>.geojson` (the open UK
data-centre pipeline, data-grid-gb PR #3 (operator-separated); from 202610312138 the file at data-grid-gb `01a4491`, 226 sites (225 mappable), Wapseys Wood one site, `dc_pipeline.schema.json`; committed verbatim), read after the other sites are drawn;
if it fails, the offtakers file's data centres are drawn and the status line says why.

A data-centre tap opens a half-height card with four tabs, Area · Substations · REPD · Conventional (hardening DC-B2's
spec), and draws the nearest 10 of each set (Show all / Draw all for the rest), labels for the open tab only (at most 6):
- **substations:** the engine's own Grid Finding Scope (`__GRIDATLAS_MODULES__.gridScope.scope`, sld-sandbox :45-186) within
  40 km. The original `link.measure.nearestSubstations` is fixed at 5 (`LINK_COUNT`, a closure constant), so it is called
  as well and must equal the first 5 (else a note in `state.errors`); voltage chips re-rank within a band;
- **REPD:** the same register and grouping as the 15 (`RG`, `near`, `sites`), 30 within 40 km, ties kept, status chips;
  the full record is joined on a row tap and for the CSV;
- **conventional:** `data/conventional_power_uk_<stamp>.geojson` (hardening DC-A6, verbatim; read on the first data-centre
  tap; else the power-station class): always the nearest 30, at any distance; lines only up to 100 km.

Other classes keep 15 REPD + 5 substations. Every URL the module reads is a file of this site's `data/` folder (`AL`), pinned
by SHA-256 and capped in bytes and features; records failing the schema checks (id, point, fully open licence: never NC/ND)
are skipped and counted. The module grew to about 71 kB: the owner approved an 80,000 B ceiling on 29 Oct 2026 (issue #73;
40,000 B before).

## Cartridge
It ships as its own cartridge (docs/LIGHTNING-CARTRIDGE.md, loader v2): `uk-offtakers-overlay`, slot `after-cartridge`,
`after: uk-lightning-overlay`, last in `cartridge_order`, path = the module file, budget 80,000 B (owner-approved 29 Oct 2026; 40,000 B until 202610291044;
`CARTRIDGE_BYTE_BUDGETS`). Each generation has `tools/proofs/<G>-uk-offtakers-overlay.proof.mjs`, which calls
`tools/proofs/offtakers-cartridge.mjs` (identity, anchor, hashes, budget, source rebuild, one strict IIFE, static
negatives and positives, and a v2 composition in node:vm with every other cartridge unchanged). The lightning proof
(`tools/proofs/lightning-cartridge.mjs`) takes further chained after-cartridges out of its arrival-parity comparison.

To cut one: `node tools/release/split-lightning-cartridge.mjs --from <lightning M> --generation <G> --version <vX>`, then
add the offtakers entry (the hardening lane OT-build's `add-offtakers-cartridge.mjs`), list G in `generations.json`.
