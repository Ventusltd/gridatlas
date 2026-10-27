# Lens: grid engineering value

Evidence: `hardening/evidence/opus-memos-1/grid-colocation.py` and its output `grid-colocation.out.json` (self-fixture harness, `python3 -I`, no network). The script compares the genuine 408 LI L2-LFL flashes (21–25 Oct 2026) with GridAtlas atlas-v9 data (5,800 substations; 400/275/132 kV OSM ways) and with REPD (11,069 sites). Searched time comes from the fixture index: 93.7 h, about 562 ten-minute slots. Only aggregates are reported, and no site is named.

## What the instrument allows

From source-science-and-terms.md:
- Detection is about 70 % by day and 95 % by night. There is no UK figure.
- Location error is about 7–12 km.
- In-cloud and ground flashes look the same to the instrument.

My geometry calculation (`viewing_geometry_0E`) gives UK pixels of about 5 × 9–15 km. Each kilometre of cloud-top height error adds 1.5–2.8 km of parallax.

So a 1 km result is noise: 6 substations had a flash "within 1 km". The smallest radius worth printing is 10 km, and against a single asset it is 20 km.

## What one week shows

- **Substations:** 238 of 5,800 had a flash within 10 km; 510 within 20 km.
- **REPD sites:** 452 of 11,069 had a flash within 10 km (operational 141/3,132).
- **Lines:** 632 of 14,036 route-km of 132 kV lay within 10 km of a flash; 164 of 7,340 route-km of 400 kV.
- **One storm day, not a climate:** for every substation near a flash, all its flashes fell on one UTC day. For 63 %, they fell within a single hour.
- **Chance coincidence:** 502 of 3.26 M substation × searched-slot pairs had a flash within 10 km. That is a rate of 1.5×10⁻⁴ per 10-minute slot and 3.4×10⁻⁴ within ±10 minutes. Across the fleet, that is about one substation per searched slot "coinciding" with a flash by chance.

Any fault log matched against flashes will find matches, so causality must never be implied.

## What each user can honestly do

| User | Defensible | Not defensible |
|---|---|---|
| Developer | Screening context next to REPD/grid layers: "convective activity observed near here on N searched days" | Site risk scores; "struck" |
| EPC | Seasonal flash-day profile within 20 km for construction planning (needs ≥ 1 archived year) | BS EN 62305 design. It needs ground-flash density, while LI sees total lightning at 3–6× ground flashes, uncalibrated for the UK |
| DNO | Post-event context: optical lightning within 20 km in that hour, with coverage shown | Trip attribution; per-span or per-pylon statements |
| Insurer | Free CC BY corroboration that a convective event occurred near a place in a window | Replacing ground-strike networks; treating "no flash" as proof (missed detections and unsearched hours exist) |

## The one honest number per site

> **Flash-days within 20 km: k of D searched days.** UTC, [start, end), MTG LI optical flashes. Detection about 70–95 %, location about 10 km. Unsearched days are unknown.

- It counts days, so one storm cannot inflate it. Raw counts reach 60 within 10 km of one substation in a single day.
- Its denominator exposes missing coverage.
- A day counts only if at least 50 % of its slots were searched. Otherwise it is unknown, never 0.

Today it would print "1 of 5"; it needs about a year of archive.

## Unknowns

- UK detection efficiency, and L2 parallax correction over UK storm tops.
- Annual UK volume.
- Whether REPD coordinates are centroids or postcode points.
- No DNO, EPC or insurer was interviewed; the table above is my judgement.

## Recommendations

1. Publish per-site exposure only as "flash-days within 20 km, k of D searched days", after at least 12 months of archive.
2. Show the chance-coincidence base rate wherever flashes meet assets, and never relate a flash to a fault, span or asset.
3. Ban sub-10 km radii and "nearest flash" distances from every table.

**Would change my mind:** a published UK validation of LI against a ground network showing a stable cloud-to-ground ratio and location error under 5 km. Calibrated ground-flash density on 10 km cells would then become defensible for screening.
