# owner-device-script: lane report (documentation, no browser), 27 Oct 2026 ~00:45 UTC

**Target:** generation 202610270024. Module sha256 `2976cae7…f890bf`, byte-identical to `opus-fix-designer/fixed-module-E.202610270024.js`. The E-progress figure "8684a63a…" refers to an earlier unstamped build.
**Feed:** `Ventusltd/lightning` origin/main **4b35a6c**, with 408 flashes from 2026-10-21T12:32:19Z to 2026-10-25T11:15:58Z and query end **2026-10-27T00:27:07Z**. The prompt quotes query end 20:30Z, which was the previous run 38f2126; its features are identical.
**Method:** node:vm plus minidom (copied), phone mode, with archive index.json answering 404. That matches today's real state: `data/history/` does not exist on lightning main, so the module runs in feed mode. The real feed bytes were saved under `evidence/owner-device-script/data/`.

## Deliverables
- `hardening/evidence/owner-device-script/OWNER-PHONE-CHECK.md`: a 10-step owner script for the preview and live URLs, ending in a RESULT block.
- `hardening/evidence/owner-device-script/SAFARI-ONLY-RISKS.md`: 13 risks, all UNVERIFIED (no WebKit).
- `captions.mjs` plus `out/*.txt`: the exact strings at 01:00Z, 09:00Z, 12:00Z and 14:00Z, for a UK-wide view and a London view, including CUSTOM 25 Oct.

## Results

| ID | status | evidence path | command |
|---|---|---|---|
| ODS-1 OFF by default, 0 requests before ON | PASS (node) | out/T1400-ukview.txt | `node captions.mjs <module> data/feed-4b35a6c.geojson 2026-10-27T14:00:00Z -11.5,46,4.5,62` |
| ODS-2 feed-mode wording (UNKNOWN / "seen in the available 7-day feed" / "archive not yet published: HTTP 404") | PASS (node) | out/T0100-ukview.txt | same, at 01:00Z |
| ODS-3 chips 12H–12M strings, ≥ prefix, "older history unknown" on 30D+ | PASS (node) | out/T1400-ukview.txt | as ODS-1 |
| ODS-4 48H "3 of 3 outside the current view" | PASS (node) at 01:00Z with London bounds. **Time-limited:** 48H holds 3, 2, 1 and then 0 flashes as the window passes 03:28Z, 04:12Z and 11:15:58Z on 27 Oct. The script uses CUSTOM 2026-10-25, which gives the same 3 flashes and the same suffix (out/T1400-london.txt). | out/T0100-london.txt, out/T1400-london.txt, out/count-schedule.txt | bounds `-0.6,51.2,0.4,51.8`, `CUSTOM=2026-10-25,2026-10-25` |
| ODS-5 the fullscreen twin has the same label and captions | PASS (node, text only) | all out/*.txt (no "twin differs") | — |
| ODS-6 OFF again: layer and source removed, label [WAIT] | PASS (node) | out/*.txt | — |
| ODS-7 caption readable above HIDE LAYERS (panel and fullscreen) | NOT_TESTED: needs the owner's device or WebKit. See SAFARI risks S1–S4. | SAFARI-ONLY-RISKS.md | — |
| ODS-8 no Grid menu row | PASS (source): the menu-bar collects only `input[data-layer-id]` (menu-bar.js L108–110), and the lightning checkbox has none. | module L134 | — |

## Findings for the lead (no FAIL in the module text; owner-relevant facts)
1. **ChatGPT's "3 flashes in 48H" will not reproduce after 11:16 UTC today.** By the time the owner checks, 48H will most likely read `[UNKNOWN | 48h]`. This is correct behaviour, not a regression. The script routes the viewport check through CUSTOM 25 Oct.
2. **With the default camera (−3.5, 54, zoom 4.2), all 3 flashes are inside `getBounds()`.** So no "outside the current view" text appears unless the user zooms away and taps the chip again; the moveend recount was cut. The likely cause of M03's "none obvious" is the dot size of about 2.3 px at zoom 4.2 (S9), not out-of-view points.
3. **On iPhone, HIDE LAYERS is not hidden in fullscreen** (S1: no element Fullscreen API). The Chromium fullscreen evidence therefore does not cover the owner's case. Step 8 checks it.
4. **STALE will often show legitimately.** Feed runs have been 3.5–7.4 h apart (13:05 → 20:30 → 00:27 UTC). The script tells the owner this is not a failure.
5. **Wording nit (not fixed):** Custom APPLY with an empty date shows "From must not be after To" (L162).

## OWNER_DECISION
- None new. Whether a 2.3 px dot at the starting zoom is acceptable (M03 discoverability without FIT FLASHES) is already an open owner item.

Nothing was committed, pushed or deployed. The only file written outside the evidence folder is this report.
