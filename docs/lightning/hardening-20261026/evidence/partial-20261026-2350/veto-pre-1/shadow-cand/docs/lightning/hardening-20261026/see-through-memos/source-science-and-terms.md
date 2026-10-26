# Lens: source science and terms of use

L = /home/claude/lightning (HEAD 21c3e56); [tags] are the sources below.

## The product
Collection `EO:EUM:DAT:0691`, LI Lightning Flashes, MTG 0° (L/collect.py:20-22, 127-130). This is Level 2 **LFL**, not LGR (groups) or the AF/AFA/AFR 30 s grids [PUG §5].
- **Granules:** all 116 behind the 408 flashes are `MTI1+LI-2-LFL--FD--x-x--ARC-x`: Meteosat-12, full disc, 600 s each, created 12–224 s after sensing ended (median 16 s; ids in L/data/uk_lightning.geojson).
- **Fields:** collect.py keeps longitude, latitude and flash_time (:76-82). It drops radiance, duration, footprint and flash_filter_confidence [PUG Table 3].

## What an optical flash is
LI images 777.4 nm oxygen light [PUG §3.2.1]. Pixels above background in one frame form a group. Groups within 16.5 km and 330 ms form a flash, placed at its radiance-weighted centre [PUG §4.1-4.2].

Cloud-top light comes from in-cloud and ground lightning alike. LI cannot tell which, and thick cloud hides it [ESSL p.14]. LI flash density is 3–6× EUCLID's cloud-to-ground density [AMT reviews]. A flash is not a ground stroke.

## Over the UK (no UK figure is published)
- **Detection:** 87.4 % on average, 70 % by day to 95 % by night; Europe 80–90 %, about 75 % at local noon, about 73 % at 70° N; upper limits against GLD360 [P26 pp.1, 8-11]. Jul–Aug 2024: 0.72, varying 60–90 % over the day and falling off from about 60° of arc toward the north-east edge [VR pp.10, 20, 22].
- **Geometry (my calculation):** the UK box is 49.5–62° of arc from the sub-satellite point (zenith 57–70°). Pixels there are about 5 km east–west by 9–15 km north–south. Published sizes: 4.5 km at nadir, about 7 km over central Europe [PUG §3.2.1], about 10 km at 60° [ESSL p.18].
- **Location:** mean error 11.7 km; 7.1–11.6 km over Europe, 11.7–20.0 km over Finland, worse at night [P26 pp.8-10, 13]. Uncorrected parallax would shift them northward here; L2 corrects with a cloud-top climatology [AMT], and a storm top 1 km off it moves a UK flash about 1.5–2.8 km (my estimate).
- **Other limits:** timing within 1 ms; 0.16 % of flashes false [P26]; object transits, camera-overlap duplicates, read-out stripes and eclipse-season gaps near 00 UTC [VR pp.29-35]. Latency is nominally 90 s [ESSL p.19], but our map trails by the collector's schedule: never "live". The user guide is a 2022 draft whose quality flags are not yet reliable [PUG §5.1].

## Terms
Data Policy, amended 25 Nov 2025 [DP]:
- "LI Derived Products" are Core (Art. 4): free and unrestricted under CC BY 4.0 (Art. 5.1), redistributable (Art. 6.1), commercial use included.
- Credit (Art. 6.3): "[Contains modified] EUMETSAT [Meteosat/Metop] [data/product] [Year]".
- LI Level 1 is Recommended: no redistribution of its numbers (Art. 6.2), fees possible under 1 h (Art. 14.2). We do not use it.

Ours says "NoConditions" (L/README.md:7, collect.py:181); the candidate footer (overlay line 14) has no credit.

## Backfill
- **Legitimacy:** legitimate. Core data are redistributable, so no permission letter is needed (correcting roadmap.md:27 and SEE-THROUGH-ABC-RECOMMENDATION.md:47).
- **Limits:** practical only. Orders may be volume-limited (Art. 3). I found no Data Store quota; the collection page was unreachable here.
- **Depth:** data exist from July 2024 [FEAT]; operational dissemination was planned for November 2024 [VR p.7]; 2025 was the first full operational year. "Multi-year" means 2025–2026, with 2024 flagged pre-operational.
- **Cost:** 52,560 whole-disc granules a year, about 11,600 flashes each (608 M in 2025 [FEAT]). collect.py caps a run at 48 h and 1,000 products (:138, :201).
- **Labelling:** backfilled days carry their ingest time and product version, and missing slots stay unknown (history.py:69).

## Recommendations
1. Replace "NoConditions" with "Contains modified EUMETSAT Meteosat product 2026 · CC BY 4.0" in the metadata, README and footer.
2. Archive confidence, footprint, radiance and processing version, and state "70–95 % detected, ~10 km location" on every surface.
3. Backfill 2025 onward as a labelled, throttled ingestion; flag or exclude 2024.

**Would change my mind:** a UK validation (e.g. vs ATDnet) showing detection below 60 % or errors above 20 km. Then draw ≥ 20 km density cells, not points.

## Sources
[PUG] https://www-cdn.eumetsat.int/files/2022-05/LI%20L2%20Product%20User%20Guide%20%5BLIL2PUG%5D.pdf
[VR] https://user.eumetsat.int/s3/eup-strapi-media/LI_Level_2_Data_Operational_Dissemination_Validation_Report_pub2_bd35cd8ccf.pdf
[P26] https://egusphere.copernicus.org/preprints/2026/egusphere-2026-3177/egusphere-2026-3177-manuscript-version4.pdf (preprint)
[ESSL] https://essl.org/cms/wp-content/uploads/20250307-LI-Application-Guide-for-Forecasters-v3.1.4.pdf
[AMT] https://egusphere.copernicus.org/preprints/2026/egusphere-2026-3386/ (AMT 19, 6681–6697)
[FEAT] https://www-cdn.eumetsat.int/files/features/1bn-lightning-flashes/index.html
[DP] https://www-cdn.eumetsat.int/files/2026-01/45173%20-%20Data_Policy.pdf
