# Devil's advocate: not now

Paths: ST = /home/claude/ventusltd/kuiper-belt/see-through/202610050609/, GA = /home/claude/gridatlas/, R = scratchpad lightning/reports/.

## The sound half is already being built
Lightning already follows the electricity pattern: the lightning repo owns the data, index v2 records per-day coverage (R/lightning-data-plane-builder.md F2, 73 tests), and a 23,973-byte off-by-default cartridge reads it (evidence/atlas-implant-builder). The new parts (descent, 3D, Kuiper, implant) bring all the new risk and no evidence.

## Unfinished work comes first
- The candidate has not been through parity, regression or the veto. Nothing is pushed (PLAN.md §6).
- The rejected V5 preview's workflow fails GridAtlas main's own lint (state-stderr.txt; R/atlas-regression-auditor.md F2). Lightning PR #1 is FAIL (R/lightning-archive-auditor.md).
- No green regression record exists for the live generation; the proof workflow is disabled, last run September (regression F4).
- See Through has no proofs. kuiper-belt CI parses only top-level pages (tools/ci_check.py K3), and cvaa never names it.

## Too little data for awe
There are 408 flashes: 31/67/189/118/3 per day. One of seven days was fully searched; 23–25 Oct, 49–59% (data-plane F3). The hourly fix has never run on Actions (F9). Electricity earned "intelligence" from 3,339 days behind a 4 kB rollup (GA/atlas/current.json:330-341). Lightning has four days.

## Awe oversells optical flashes
The fall ends at zoom 16 (ST/descent.js:22, world 512·2^z at :257), about 0.74 m per CSS pixel at 52°N. One Lightning Imager pixel is at least 4.5 km, with 70–95% detection (archive F10). That is about 6,100 px, or fifteen phone widths. A flash beside one named substation reads as "struck here". The lightning README forbids that: "No particular site is targeted, analysed or named" (README.md:3). It also blurs See Through's own line, "A star is a line of code today, not a substation" (descent.js:11).

## It does not fit
- **No slot.** All four slots are claimed, and the 460 kB ceiling "must not be raised again" (GA/tools/scope/loop.mjs:188-193). sld-sandbox keeps 808 bytes after lightning. See Through's JS is 840,958 bytes, plus 803 kB of MapLibre 4.7.1.
- **Version clash.** GridAtlas pins MapLibre 3.6.2 (releases/202608300453-atlas-v9/index.html:133). See Through patches 4.7.1's private terrain object (see3d.js:173-177). setTerrain (:172) applies to the whole map, so every original layer would be re-draped.
- **A second source of truth.** grid-data.js (587,233 B) and the 84,911-byte table on descent.js line 15 duplicate GridAtlas's substations. gb_decade retired exactly this (current.json:333).
- **A fork of a fork.** descent.js exists in five distinct versions, and ten identical grid-data.js copies are committed. descent.js:8 still says "3.6.2 from jsDelivr"; :24 vendors 4.7.1.

## Licences
GridAtlas and lightning are Apache-2.0, chosen so others can adopt them (GA/NOTICE). See Through is CERN-OHL-S v2 and strongly reciprocal. descent.js was relicensed from Apache-2.0 (ST/NOTICE.md:10). Ventus can relicense its own code, but must decide before any merge. I cannot settle whether joining flashes to OSM substations triggers ODbL share-alike.

## Maintainer and budget
One author maintains 96 registered repositories (kuiper-belt/cosmos/wafer-meta.json), not sixty. V6 alone has 18 repair reports. Phones already spend 17–19 s in long tasks at boot (R/mobile-performance-budget.md F1). See Through's phone cost is unmeasured.

## The minimal thing
1. Release the additive layer.
2. Publish one sealed monthly rollup from the lightning repo. Keep it under 4 kB and pin it by sha256 like gb_decade, with searched hours beside the count.
3. Add one deep link. Wire See Through's unused ATLAS_URL (descent.js:35) to GridAtlas's proven longitude/latitude/zoom deep link (sld-sandbox-v9-8.js:6362-6387). It costs zero GridAtlas bytes; I have not seen how a bare substation coordinate arrives.
Separately, list See Through on the homepage as in development, without lightning.

## Evidence that would justify the full product
30 full-coverage days; a severe storm day ingested without a push failure; a green GridAtlas regression record; See Through proofs and a measured phone run; recorded decisions on licence and MapLibre version; flashes never drawn above the zoom the instrument resolves; observed use of the layer (kuiper-belt diary 2026-10-05:42).

## Recommendations
- Release the additive cartridge before opening any new lightning surface.
- Add one sealed rollup and one deep link; let no See Through code enter GridAtlas.
- Give See Through proofs and a homepage entry on its own merits.

**What would change my mind:** thirty consecutive UTC days at full searched coverage from the hourly collector.
