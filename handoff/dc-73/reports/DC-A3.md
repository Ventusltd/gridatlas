# DC-A3: government-published UK data-centre sites (Team A, research)

Finished 2026-10-29. Nothing committed, pushed or deployed, and no PR (this is a research lane).

## Outputs (hardening/evidence/DC-A3/)
- `gov_sites.json` has 27 records in the #73 step-3 schema, plus `context` and `excluded` blocks. Its SHA-256 is 4b545f7f…0185; the build is deterministic and rebuilds byte-identical.
- `gov_sites.geojson` holds the same records as Points.
- `gov_sites.py` (stdlib only):
  - `build` writes both files; `check` runs the validator (0 errors).
  - `fetch [--verify]` snapshots every cited source through the machine-readable GOV.UK Content API (`/api/content/<path>`). It writes raw files plus a SHA-256 manifest and checks that each quote still appears.
  - **`fetch` could NOT run here:** the sandbox proxy returns 403 for gov.uk, so the facts were gathered with WebSearch+WebFetch. Run `fetch --verify` from an unrestricted host before ingesting.

## Records
- **Status:** 12 announced, 6 in planning, 4 consented, 4 operational, 1 unknown.
- **Precision:** 1 exact, 21 town, 5 region.

### AI Growth Zones (5)
These match the Covenant ("five AI Growth Zones across England, Scotland and Wales") and the One Year On update (Jan 2026).

| Zone | Announced | Location | Power figure in source | Basis of that figure |
|---|---|---|---|---|
| Culham | 13 Jan 2025 | Culham | ~100 MW ("steady state, dual resilient power", UKAEA PIN) | Not stated |
| North East | 16 Sep 2025 | Blyth-Cambois QTS; Cobalt Park "already established" | 1.1 GW zone ambition within 6 years | Not stated |
| North Wales | 13 Nov 2025 | Prosperity Parc, Trawsfynydd | No MW | n/a |
| South Wales | 20 Nov 2025 | M4 Newport–Bridgend, ex-Ford Bridgend | "Potential over 1GW by early 2030s" | Not stated |
| Lanarkshire | 29 Jan 2026 | DataVita Airdrie | >500 MW | On-site generation, not IT or connection |

**Not one gov.uk figure for an AI Growth Zone is labelled as IT load or as grid connection.**

### Other records
- **Section 35 NSIP directions (MHCLG):**
  - Wapseys Wood SDC M40, 16 Mar 2026: IT load c.300 MW; 270–350 MW generation; 900 MW gas. It is the only record with exact precision (from the grid reference in the request). PINS says pre-application, with the application expected in January 2027.
  - QuestPit, Bedford, 15 Jun 2026: IT load c.720 MW.
- **Secretary of State recovered appeals:**
  - Court Lane, Iver: allowed. 140 MW grid connection reserved.
  - Abbots Langley: allowed. "96 MW of capacity"; the basis is not stated, so it sits in other_mw.
  - Manor Farm, Slough: allowed 10 Jun 2026. IT about 72 MW; the separate 100 MW is battery storage.
  - Woodlands Park, Iver: allowed 9 Jul 2025, but secondary press reports the approval was conceded for quashing. Status is null and flagged as a conflict.
- **Sites named in DSIT releases:** DC01UK Hertsmere, CloudHQ Didcot, Nscale Loughton, Equinix Hertfordshire, Google Waltham Cross.
- **Public compute:** Isambard-AI, DAWN, and the Edinburgh national supercomputer. The annex gives only a combined "<0.01GW" (IT load) for Isambard-AI plus Dawn.
- **Scotland (Aug 2026 Ministerial directions):** Wester Hermiston, Auchtertool, Redheughs Avenue.

## Key findings
1. The **Covenant** (HMT, 28 Oct 2026) has **no annexes and names no sites**. "6 GW … capacity" is undefined. The **evidence annex** names no data-centre sites and measures everything in **IT load** (1.8 GW across ~330 DCs).
2. **CNI** (12 Sep 2024) is a sector designation. No site list is public, so no records can be made from it.
3. **Local and combined-authority pages are excluded.** The NECA footer reads "(c) North East Mayoral Strategic Authority 2026" with no OGL statement. gov.scot and gov.wales are OGL v3 (quoted).
4. **Coordinates are approximate**, except Wapseys Wood. They are DC-A3 place centroids, labelled `coordinates_source`, and are not taken from the sources.

## Open items
- Verify the WebFetch-derived quotes with `fetch --verify` on an unrestricted host.
- Woodlands Park current status.
- The Scottish candidate-site PDFs were not ingested, deliberately: candidates are not projects.
- #73 had no ChatGPT comments to cross-check at 29 Oct ~20:40 UTC.
