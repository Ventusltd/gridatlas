# Lens: the lightning descent as interaction and typed grammar

Paths: ST = /home/claude/ventusltd/kuiper-belt/see-through/202610050609; RG, CG = globalgrid2050/energy-transition-simulator/202609282123/mod/engine/repd-grammar.mjs, cmd-grammar.mjs; DP = lightning-data-plane-builder/wt; MB = lightning/reports/mobile-performance-budget.md.

## What See Through gives
See Through has one control: D, from 0 to 8 (ST/descent.js:21), moved by wheel, pinch, keys and hold buttons (:937-947, 996-1017). It has four depth captions (:801-802), shortened on phones (:820), and a scale readout (:843-844). A scripted 10 s fall holds two seconds at zoom 9 (:428-437) before switching to SAT and 3D (:536-537, 553). There is a lite mode (:567) and a test hook (:1034-1051).

It reads no URL hash, although the stable page forwards one (see-through/index.html:12). It has no reduced-motion path. It boots ~511 kB gzip synchronously, MapLibre included (ST/index.html:10-16).

## Grammar
RG is pure (RG:4). It returns null for lines it does not own, refuses in words (RG:30, 55-56), echoes its filter (RG:67-72), and its `next` reuses the last filter (RG:12). parseLightning keeps all four. It must run before parseRepd, which refuses `next` lines it does not own (RG:48), and before `go <place>` falls through to Find (CG:188, 203-207). sub-grammar is already placed this way (sub-grammar.mjs:5-6).

| typed | hash | does | refuses |
|---|---|---|---|
| go lightning | #lightning | stage 0 | — |
| go storm 2026-10-23 | #storm=2026-10-23 | that UTC day | "never searched: unknown, not calm" |
| go flash 20261023.091.07 | #flash=… | slot 91, 7th flash | "provisional until sealed" |
| next/previous flash · next storm | — | by time, searched slots only | "14 h later; 6 h unsearched between" |

Dates are UTC (ISO, today, yesterday); "23/10" is refused as ambiguous. "strike", "bolt" and "hit" are refused with "this data holds optical flashes". Places are never targets (/home/claude/lightning/README.md:3). Flash ids exist only for sealed days, ranked by (time_utc, id) (DP/history.py:208-214, 418). Time alone is unique in the seed (408 of 408), but not at storm rates.

## Stages
| D | caption | shows | never |
|---|---|---|---|
| 0–0.9 | EVERY TEN MINUTES WATCHED | one kuiper-law point per UTC slot: grey unsearched, dark empty, lit by count; "N flashes · H of T h searched" | "A STAR FOR EVERY LINE OF CODE" (:801) |
| 0.9–1.95 | ONE DAY, AS SEEN | slots unwrap; flashes fly to place in time order before the map fades in (D 2.3, :558) | a point in flight over the map |
| 1.95–3.6 | ONE STORM | GB, grid lines as context, footprint discs, stepped clock, grey slots at full length | tweening, trails, "track" |
| 3.6–floor | ONE FLASH | stops near zoom 9 (4.5–7 km ≈ 50–80 px); UTC ms, slot, product, sealed or provisional | zoom 16 (:22), SAT, 3D, substation names |

Every frame says: optical flashes seen from orbit, not ground strikes; unknown is not zero; UTC. A flash is only ever a footprint disc, and its fade is labelled as display persistence. No line, zigzag or ground contact is ever drawn.

## Phone (under 600 px, :152)
The slot field is drawn once, offscreen (:172-181). One day animates, up to 10,000 points (MB F6); above that, a labelled 1-in-K sample by flash id. MapLibre loads only on request, with no SAT or 3D. Sound is off. Reduced motion turns the fall into cuts. Controls are 44 px (:200).

## Ten seconds from a WhatsApp link
WhatsApp reads only static meta tags. Each sealed storm day therefore gets a pre-rendered page, titled "23 Oct 2026: 189 flashes seen from orbit; 49 % of the day searched", with the caveat in its preview image.
- **0–1 s:** static HTML gives the sentence, the denominator and the caveat before any script runs.
- **1–3 s:** the field appears with the linked day lit, with no climb to the stars (:420).
- **3–8 s:** the active hours replay at one hour per second, and skipped hours are stated.
- **8–10 s:** the view holds on the storm with one button, WHAT AM I SEEING? A tap stops all motion.

Budget: ≤150 kB gzip before the replay. That day's 189 flashes come to ~2.3 kB as gzipped rows.

## Recommendations
1. Write parseLightning as a pure module in REPD's style, with the hash using the same grammar.
2. End every fall at the instrument footprint, never at a site or zoom 16.
3. Pre-render a static page for each sealed storm, so link readers meet the caveat first.

**Would change my mind:** a five-reader test in which people describe the gather as lightning crossing the country. Then cut the gather and fade the flashes in place.
