# Lens: licensing and legal (reasoning, not a legal opinion)

GA = /home/claude/gridatlas; ENG = /home/claude/ventusltd/ventus-grid-engine; KB = /home/claude/ventusltd/kuiper-belt; ST = KB/see-through/202610050609; CERN = ST/licences/globalgrid2050-CERN-OHL-S-2.0.txt.

## As found
- **GridAtlas and ENG:** Apache-2.0, with third-party data excluded (GA/NOTICE:10-32; ENG/NOTICE:10-32). ENG/package.json:6 contradicts this with `"UNLICENSED"`.
- **lightning:** Apache-2.0, no NOTICE. Its CC BY 4.0 EUMETSAT data are labelled "NoConditions" (collect.py:181).
- **kuiper-belt:** Apache-2.0 root; See Through CERN-OHL-S v2 (ST/LICENSE.md:3-7); Learn the Kuiper Apache except grid.js and zoom.js (its NOTICE.md:7-11). Mixed by folder.
- **See Through's CERN text** is wrapped in a Ventus header and notice (CERN:1-8, 303-336); CERN allows it "in unmodified form only" (:25-26).

## CERN-OHL-S code appended to a GridAtlas cartridge?
Plain reading: no, unless the owner relicenses.
- "Including Covered Source in a larger work is modifying the Covered Source, and the larger work becomes modified Covered Source" (§3.2, CERN:151-153). It is licensed "as a whole" (§3.3(d), :168-174), and serving a page is Conveying (§1.13).
- A cartridge is one file (live sld-sandbox + "\n" + module, PLAN.md:19). Appending see3d/model/pf would put it under CERN-OHL-S, breaking its Apache promise to adopters (GA/NOTICE:17-20).
- Apache code keeps its licence as an "Available Component" (§1.7(a), §3.3(d)) only if Apache-2.0 is a "Compatible Licence" (§1.2(c)). CERN's FAQ is silent on this.
- The reverse is ordinary (Apache-2.0 §4): Learn the Kuiper's descent.js entered See Through so, declared (ST/NOTICE.md:10), without Apache text. That is harmless only if Ventus is the sole author, which shallow clones cannot show.
- CERN recommends GPL-3.0 or Apache-2.0 for software, and says CERN-OHL-S is not GPL-compatible (FAQ).

## What a See Through lightning derivative must carry
- **Forked code:** keep Notices (§3.3(a)); add a dated modification Notice (§3.3(b)) and a three-year Source Location (§3.3(c), §1.9); license the whole CERN-OHL-S (§3.3(d)).
- **Screens and exports** may be "Products" ("any … work … arising from the use … of Covered Source", §1.5). If so, §4 requires a "Source: KB@<commit>" line in About and exports.
- **Alternative:** built only from Apache parts (kuiper-law.js, sha256-identical in Learn the Kuiper, plus the 2D descent), the explorer can be Apache-2.0 (SEE-THROUGH-ABC-RECOMMENDATION.md:16).

## Does share-alike reach the rollups?
ODbL binds publicly used Derivative Databases (§4.4), not Collective Databases (§4.5(a)). A Produced Work needs a notice (§4.3) and an offer of the Derivative Database behind it (§4.6).
- **Flashes over OSM lines or CARTO tiles:** no share-alike. "Plot your own unrelated data over the top" (Horizontal Layers guideline, 2014).
- **Rollups by time, UK box or boundary region:** no OSM, so no ODbL.
- **Counts by distance to OSM substations or lines** (data-product-rollups.md `near-*`): OSM selects the records, so probably a Derivative Database; the Collective Database guideline (2016) is silent. If published, use a separate ODbL file, never inside CC BY products.

## Attribution per screen
- **Atlas with lightning:** OSM, CARTO, EUMETSAT. On SAT, add Esri.
- **See Through:** add the Environment Agency terrain credit (ST/NOTICE.md:32-34) and the Source Location.

Measured gaps:
- **Esri:** GridAtlas shows Esri World Imagery (substation-intelligence:1353; radios :1101, :1112) but credits Esri nowhere (fallback :5171-5175). Esri requires "Powered by Esri" plus providers. Pre-existing.
- **CARTO:** its terms (29 Sep 2026) tie free use to a CARTO key (§3.b), require conspicuous credit (§13) and treat a business's trade as commercial (§1.g). Both apps call the keyless style (substation-intelligence:666; descent.js:28).
- **Lightning:** the overlay footer (module line 14) lacks the EUMETSAT credit.

## Cleanest arrangement
One licence per repository (or per top-level folder with SPDX headers). Repositories meet only through data contracts (URL, schema, sha256) and links. Relicensing is an owner act, recorded by file, sha256 and date in both NOTICEs (issue §10).

For a lawyer: §1.2(c)/§1.7; screens as Products; ODbL proximity counts; keyless and commercial CARTO and Esri use; the wrapped CERN text.

## Recommendations
1. Never append CERN-OHL-S bytes to a GridAtlas cartridge; link to See Through instead.
2. Carry every credit string in the data, and render it on every screen and export.
3. Fix ENG/package.json, and add a CC BY 4.0 data NOTICE to lightning before any rollup ships.

**Would change my mind:** written advice that Apache code stays Apache as an Available Component, or the owner relicensing see3d/model/pf to Apache-2.0.

## Sources
https://ohwr.org/project/cernohl/wikis/FAQ · https://opendatacommons.org/licenses/odbl/1-0/ · https://osmfoundation.org/wiki/Community_Guidelines/Horizontal_Map_Layers_-_Guideline · https://osmfoundation.org/wiki/Community_Guidelines/Collective_Database_Guideline_Guideline · https://carto.com/legal/basemap-terms/ · https://developers.arcgis.com/documentation/esri-and-data-attribution/interactive-maps/ · https://www-cdn.eumetsat.int/files/2026-01/45173%20-%20Data_Policy.pdf
