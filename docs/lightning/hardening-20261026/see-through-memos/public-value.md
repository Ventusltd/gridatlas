# Lens: public value, education and the gift

## Answer
Yes, build lightning as a separate data product. Through this lens, the gift is the data, with its coverage and credit, in a form people can reuse. GridAtlas should not be the public surface. On a phone-class CPU it already spends 17–19 s in long tasks and sends about 2.6 MB gzip before DuckDB's 7.09 MB. Its document.write CDN script can also be dropped on 2G, which leaves a fatal banner (reports/mobile-performance-budget.md F1, F2, F4). Order: the data product first; then a small teaching page and a classroom pack; then the in-flight cartridge as the engineers' overlay, linking to the page; See Through's 3D last, on the projector.

## The gift, legally
- **EUMETSAT Data Policy (amended 25 Nov 2025).** Core products are free under CC BY 4.0 (Art. 5.1) and may be redistributed (6.1). The required credit is "[Contains modified] EUMETSAT [Meteosat] [product] [Year]" (6.3). EO:EUM:DAT:0691 is listed as NoConditions (lightning README.md:7). I could not confirm LI's column in the policy table from the PDF text. Neither collect.py:181 nor the cartridge footer (overlay module line 14) uses the 6.3 wording.
- **Licences do not stop a paywall; they stop capture.** CC BY 4.0 §2(a)(5)(B) forbids downstream restrictions and DRM, and §2(a)(6) forbids implied endorsement. Apache-2.0 §6 grants no trademark rights. The real protection is a free original that is better than any copy and easy to find. Today homepage.json has zero entries for Learn the Kuiper or See Through. "Knowledge guarded selfishly withers" (Shastra :62); knowledge nobody can find withers the same way. The diary's commit-pinned catalogue (kuiper-belt/diary/2026-10-05-public-links.json) is the provenance record; repeat it for every release.
- **The teaching product can be entirely Apache-2.0.** kuiper-law.js is byte-identical in Learn the Kuiper (Apache-2.0, NOTICE.md:7,15) and in See Through (CERN-OHL-S, NOTICE.md:11). That fits GridAtlas's "exists to be adopted" (gridatlas/NOTICE:14–23). Only See Through's 3D files (see3d.js, model.js, pf.js) carry strong reciprocity. Implanting them into GridAtlas needs a licence decision, written down.

## Who needs what
| Reader | On screen | Never |
|---|---|---|
| School | One real storm; numerator and denominator, as gb_decade does (atlas/current.json:338); works offline | Safety advice of our own; link the Met Office instead |
| Parish council (solar application) | "What this cannot tell you" first; flashes drawn as discs several km wide (archive audit F10); the IEC 62305-2 route via Ng, as the estate's illustrative pack explains it (packs/lightning/README.md:8–9,21) | A score for a site, or a fall that lands on a named site (lightning README.md:3) |
| Journalist | A dated URL with the state in its hash; a PNG with the caveat and credit burned in | "Record", "most", "struck" |
| Engineer in another country | The bounding box as a parameter (now a constant, collect.py:24; source filter at :164); the index v2 contract | A UK-only schema |
| Researcher | flash_id and flash_filter_confidence (dropped today, archive audit F7); coverage per slot; a CITATION file and sha256 | Climate claims from five half-searched days |

## Three layers that teach
Each ends in a question with a computed answer, as Learn the Kuiper's targets do.
1. **Why optical flashes.** A geostationary camera sees light at the cloud tops, including flashes inside clouds that never reach the ground. Q: "189 flashes were seen on 23 Oct. How many hit the ground?" A: "This data cannot say."
2. **Why the spiral.** One star per flash, not per line of code (see-through descent.js:11). The rule r = √(k+0.5) makes a disc's area proportional to its count, so twice the area means twice the flashes. The spiral is an index; it does not compute (cvaa vaccine, line 62).
3. **Why unknown is not zero.** Each day becomes a strip of 144 ten-minute slots, each marked flashes, searched and empty, or never searched. On 23 Oct there were 189 flashes in the 42,472 of 86,400 s that were searched (fixtures/README.md). Q: "Estimate the whole day. Why can't ~385 be trusted?" The Kuiper already leaves unissued keys for measured silence (what-is-kuiper.html:108).

## Classroom pack and the £100 phone
**Format.** One self-contained HTML file. Learn the Kuiper's zip is 26 files, and nobody has tested a folder of local files on Android. Canvas 2D on the public-domain Natural Earth coastline, not MapLibre (803 kB in see-through/vendor). No CDN, WebGL, account or tracking. System fonts and 44 px targets.

**Contents.**
- flashes.csv (408 rows)
- coverage.csv (null ≠ 0)
- a spreadsheet using Build-Your-Own-Kuiper's formulas
- teacher notes and an A4 worksheet with answers
- a NOTICE with the 6.3 credit, plus sha256 and the source commit

**Budget (proposed, not measured).** At most 250 kB for the first view and 1 MB for the pack, small enough to share by Bluetooth. The projector shows the fall; the phones do the counting.

## Fix in the cartridge now
The footer says "not confirmed ground strikes · Missing days are unknown, not zero". It is set at 9 px in #555 (overlay module line 136): about 2.7:1 contrast against the 4.5:1 that WCAG AA asks for. The shell's own #888 gives 5.6:1. Add the 6.3 credit too.

## Unknown
- Whether any of this teaches. Nobody has watched it in use, as the diary admits (2026-10-05-learn-kuiper-project-links.md:42).
- How CERN-OHL-S "communicate to the public" (§1.13) applies to software served on the web.
- How offline files behave on Android.

## Recommendations
1. Make the lightning repo the owner of CC BY 4.0 data with coverage, with the Art. 6.3 credit in every file. Every surface reads only pinned rollups.
2. Ship an Apache-2.0 teaching page and a one-file classroom pack with the three layers before any 3D. The cartridge links to the page.
3. Publish rather than restrict. List Learn the Kuiper, See Through and the page in homepage.json, and record each pack in the diary with its commit and sha256.

**What would change my mind:** a pilot with one class and one parish council. If readers still take dots for strikes, or blank days for calm, after using the layers, there should be no public surface beyond the cartridge until the layers are fixed.
