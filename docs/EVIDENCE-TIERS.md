# Evidence tiers (DRAFT)

Status: **draft for owner review**. This document only describes a convention and proposes wording. It changes no code. It does not touch `atlas/current.json`, `STATE.md` or `atlas/releases/**`.

Written 29 Oct 2026 against:
- live L3 (generation `202610281340`, v9.172);
- the M3 preview (`202610282215`, v9.175);
- Pipeline News live release `202609040144-pipelinenews`.

## Why

The external assessment of 29 Oct 2026 makes three points:
- the platform is strongest when it clearly separates **discovery**, **preliminary screening** and **validated engineering conclusions**;
- geographical proximity is not electrical exposure;
- the nearest substation does not establish capacity or connection feasibility.

GridAtlas already says much of this, but it says it in prose that differs from card to card. Badges such as "Beta", "Public record", "NESO register" and "Named by inference" each mean something different, and none of them tells a reader how far to trust the line beside it.

This convention gives every statement one of four tiers, and each tier has a short label that works on a phone.

## The four tiers

| Tier | Badge | What it means | What qualifies | What it never says |
|---|---|---|---|---|
| **Discovery** | `Discovery` | A lead worth checking. Its identity or relevance has not been verified. | News headlines; name, text or score matches; fields carried by an arrival link; a pairing made by name and capacity. | That it is this project, or that the event happened as stated. |
| **Record** | `Record` | What a named source publishes, reproduced without inference, with the source and its date. | A REPD row, matched by exact REPD ref. A NESO TEC register entry. NESO/ETYS published parameters. A DCO quotation. A EUMETSAT LI optical-flash observation. | That the source is right today, or anything the source does not say. |
| **Screening** | `Screening` | Something GridAtlas computed from records. It is reproducible, but it has not been validated against ground truth. It tells you where to look; it does not answer the question. | Straight-line distances, the nearest substation, counts and sums within a radius, 0.1° cell counts, corridor-length estimates, and the SLD sandbox sizing and finance. | Capacity, headroom, connection feasibility, a route, exposure, risk, impact or damage. |
| **Engineering** | *(never shown as achieved)* | A validated conclusion for a specific site, made by a competent person. | Examples: a DNO or NESO connection offer; an IEC 62305-2 risk assessment; an earthing study; a cable-route survey. | GridAtlas does not produce this tier. It names it only to say "not done here". |

**Unknown** is not a tier. Any tier can hold an unknown value. Unknown is never shown as zero, and it is never summed as zero.

## Rules

1. **One tier per statement, not per card.** A card can hold a Record (the REPD row), a Screening line (the distance to it) and a Discovery line (the news that led there). Each line or block carries its own badge.
2. **Computed means Screening at best.** Anything GridAtlas calculates is Screening, however precise the arithmetic. Precise arithmetic does not make the result validated.
3. **The lowest input wins.** If any input is Discovery, the output is Discovery. For example, a distance to a connection site that was paired by name is Discovery, not Screening.
4. **Promotion from Discovery to Record needs one of these:**
   - an exact shared identifier (a REPD ref present in both sources); or
   - a dated, attributed human review, recorded in the data.

   A heuristic score never promotes, whatever its value.
5. **A Record needs:**
   - the source name;
   - the version or date ("Apr 2026", or "date not carried" if the product lacks it);
   - the licence, where one applies;
   - values reproduced unchanged. A unit conversion is allowed if it is stated.
6. **Engineering is never claimed.** It appears only as a pointer to what is not done here. If an external engineering document is ever linked, it is labelled "Engineering · external · author · date", and GridAtlas does not vouch for it.
7. **Banned in Screening and Discovery text, except in a negation:**
   - risk, exposure / exposed;
   - struck, hit, impact, damage, safe;
   - capacity available, headroom, feasible, can connect;
   - route (allowed only in "not a route");
   - a percentage that reads as a probability.

   A lint enforces this (see the spec below).
8. **Proximity, nearest and unknown each have one fixed phrase:**
   - "Proximity, not exposure."
   - "Nearest is not connectable." (About), or "not capacity or connection feasibility" (cards).
   - "Unknown, not zero."

## How a tier is shown

- **Cards.** The badge goes at the start of the block's first line, as `Tier · statement`. It reuses the existing `.neon-beta` pill on GridAtlas and the `.news-quality` pill on Pipeline News.
  - The badge text is 12 characters or fewer.
  - The first line is 90 characters or fewer, so it fits one or two lines at 393 px.
  - Colour is secondary. The word carries the meaning, so the pill colour is never the only cue.
- **Captions** (layer and legend lines). Use the tier word only where the caption makes a claim, for example "Cells drawn only near onshore REPD sites: not a national density map."
- **About.** One short block, given below. It is the only place where all four tiers are explained.
- **Machine-readable.** Every block carries `data-tier="discovery|record|screening"`, so tests and screen readers see the same tier.

### About block (proposed, about 75 words)

> **How to read GridAtlas**
> **Discovery**: a lead (news, a name match, link fields). Check it.
> **Record**: what a named source publishes (REPD, NESO, EUMETSAT), with its date.
> **Screening**: what GridAtlas computes from records, such as straight-line distances, nearest substations and counts. It shows where to look; it is not an answer.
> **Engineering**: capacity, connection offers, lightning risk (IEC 62305-2) and earthing. Not done here.
> Proximity is not exposure. Nearest is not connectable. Unknown is not zero.

## Applied: current wording and proposed wording

Byte counts are for the literal text with sample values. Measure them with `evidence/V-tiers/wording.mjs`, which is not part of this PR. The GridAtlas literals come to **−210 B** in total, before template code.

### Lightning flash and cell card (live L3; the same in M3)

| # | Tier | Current | Proposed |
|---|---|---|---|
| F1 | R | EUMETSAT MTG Lightning Imager · optical flash, not necessarily a ground strike. | **Record** · EUMETSAT LI optical flash. Not a ground strike. |
| F2 | S | Nearest substations to this optical flash (straight-line km). Not evidence any asset was struck; faults can have other causes. | **Screening** · nearest substations ≥33 kV, straight line. Proximity, not exposure or a current path. |
| F3 | E | *(none)* | Engineering: not done here (IEC 62305-2 risk, earthing). |
| C1 | S | Cell lat 52.40–52.50, lon -1.30–-1.20 (0.1°) · searched UTC days only; unsearched days unknown, not zero | **Screening** · 0.1° cell (≈7×11 km here), searched UTC days only; unsearched days unknown, not zero |
| C2 | S | *(none; the card title says "≈10 km cell")* | Cells drawn only within 30 km of onshore REPD sites: not a national density map. |

Notes:
- **C1.** The cell is 0.1° of longitude by 0.1° of latitude. It is 11.1 km north to south and 5.3–7.2 km east to west across the UK box (49.5–61.5° N). "≈10 km" is therefore wrong in one dimension. Compute the east–west size from the cell's latitude, and change the title to "in this 0.1° cell".
- **C2** goes in the long-window caption, and nowhere else.

### Substation links (project card, flash and cell cards, blank click)

| # | Tier | Current | Proposed |
|---|---|---|---|
| N1 / G1 | S | Badge `Beta` | Badge `Screening` |
| N2 | S | **Beta analytics, not an actual grid connection.** | **Screening, not a connection assessment.** |
| N3 | S | The long caveat (impedance, fault level, headroom, queue, wayleaves…) | Keep it word for word, inside a `<details>` titled "What a distance cannot tell you". |
| A11 | S | Nearest 400 kV substation: … | **Screening** · nearest 400 kV substation: … *(the corridor estimate stays beside it, under the same tier)* |

### REPD list (M3 preview)

| # | Tier | Current | Proposed |
|---|---|---|---|
| R1 | S | 10 nearest REPD sites within 40 km of this optical flash, straight-line. Not evidence any project was struck. | **Screening** · 10 nearest REPD sites within 40 km, straight line. Proximity only, not impact. |
| R2 | S | Within 10 km: 12 projects · 196.57 MW stated (all statuses) · within 40 km: 67 projects · straight-line distance only, not impact · REPD: DESNZ, April 2026, OGL v3.0 | Within 10 km: 12 projects · 196.57 MW stated, mixed statuses · within 40 km: 67 projects |
| R3 | R | REPD register (DESNZ, April 2026 · OGL v3.0) as loaded by the map · lightning = optical flashes, not necessarily ground strikes; not evidence the project was struck. | **Record** · REPD (DESNZ, Apr 2026, OGL v3.0). Status as registered, not as built. |
| R4 | S | Nearest substations to this project (straight-line km; not its declared grid connection). | **Screening** · nearest substations, straight line. Not its declared connection or capacity. |

Notes:
- The rows themselves are Record. Each row's distance is Screening.
- **R2.** When a filter is on, the filter name replaces "mixed statuses". When capacity is not stated, the line keeps "capacity not stated" (the M2R-words W1 fix).

### The original engine's arrival card (`sld-sandbox`, `ensureArrivalCard`, `nesoBlockHtml`, `declaredBlockHtml`)

The arrival card makes these claims today:
- The fallback card is "built from the arrival link". This is correctly flagged.
- The REPD identity is "checking", "verified" or "not in the active-register snapshot".
- The NESO block calls the connection site "a contractual fact from the connection authority".
- It shows a "Public record" (DCO) block.
- It shows "NESO published" site parameters.
- It shows the "Nearest 400 kV substation" with a corridor estimate.
- It carries the "Beta analytics" caveat.

The only overstatement is "contractual fact". The TEC register lists contracted positions as at its publication date, and those positions change.

| # | Tier | Current | Proposed |
|---|---|---|---|
| A1 | D | Card and point built from the arrival link. | **Discovery** · from the arrival link, not yet checked. |
| A2 | D | REPD 14550 · checking the active-register snapshot | **Discovery** · REPD 14550 · checking the register |
| A3 | R | REPD 14550 · verified in the active-register snapshot. | **Record** · REPD 14550 found in the Apr 2026 snapshot. |
| A4 | D | REPD 14550 · not in the active-register snapshot; project details and point are from the arrival link. | **Discovery** · REPD 14550 not in the active snapshot; details from the link. |
| A5 | D | Status supplied by arrival link: Awaiting Construction | Link says: Awaiting Construction (unchecked) |
| A6 | R | Badge `NESO register` | Badge `Record · NESO TEC` |
| A7 | R | The substation this project is contracted to connect at, from NESO's Transmission Entry Capacity register. This is a contractual fact from the connection authority, not a measurement and not a cable route. | Connection site as listed in NESO's TEC register. A listed contract, not a measurement, a route or spare capacity. |
| A8 | D | Badge `Named by inference` | Badge `Discovery · name match`. Under rule 3, the distance to that site is Discovery too. |
| A9 | R | Badge `Public record` | Badge `Record` |
| A10 | R | Badge `NESO published` | Badge `Record · NESO ETYS`. The `Site-wide` and `kV bus` scope pills stay. |

### Pipeline News match labels (live `202609040144`, `202608291447-app.mjs`, `newsHtml`)

The live edition holds 136 stories:
- 47 show `RELEVANT nn% · PRIMARY_MATCH · REPD x`, with scores from 64% to 100%;
- 69 are `DISCOVERY ONLY`;
- 19 are regional discovery;
- 1 is related context.

The percentage is a heuristic relevance score, not a calibrated probability. Under rule 4 it cannot promote a story to Record. The assessment's point that matching errors stop results being "verified commercial intelligence" applies directly here.

| # | Tier | Current | Proposed |
|---|---|---|---|
| P1 | D | RELEVANT 72% · PRIMARY_MATCH · REPD 14550 | **DISCOVERY** · name-matched to REPD 14550 · unverified |
| P2 | D | DISCOVERY ONLY · no project signal | **DISCOVERY** · no project link |
| P3 | D | SCOTLAND · ‹evidence› · regional discovery only · no REPD project signal | **DISCOVERY** · SCOTLAND · no project link |
| P4 | D | RELATED CONTEXT ONLY — NOT A PROJECT BINDING · no project signal | **DISCOVERY** · context only, not this project |
| P5 | D | classified against the frozen REPD spine | matched by text to REPD; not verified |
| P6 | R | *(not in the live release)* | **RECORD** · REPD 14550 confirmed (reviewed 2026-11-02). Use this only when the article carries the exact REPD ref, or when a dated review is in the data. |

Notes:
- Move the score out of the visible label and into a `title` attribute: "match score 72/100 (heuristic, not a probability)".
- The unreleased BBC module (`202609060232`) already separates `OFFICIAL_IDENTITY_VERIFIED` from `UNMATCHED_REQUIRES_REVIEW`. Map those to Record and Discovery under the same rule.

## Spec for the next GridAtlas build (after M4; M4 is untouched)

1. **Constants.** Add one module-level map, `TIER = {D:'Discovery', R:'Record', S:'Screening'}`, and one helper, `tb(t, text)`. The helper returns `<span class="neon-beta" data-tier=…>` followed by ` · text`.
   - The lightning module (`cd`, `nr`, `RpR`, `cc`) and the neon block (`cardBlockHtml`, `caveatHtml`, `nesoBlockHtml`, `declaredBlockHtml`, `ensureArrivalCard`, `markArrivalIdentityState`) call this helper. They do not repeat literals.
2. **Wording.** Apply F1–C2, N1–N3, A1–A11, G1 and R1–R4 exactly as above. Each literal keeps its existing escaping (`escapeHtml` or `cs`).
3. **Cell size.** In `cc`, compute the east–west size as `(11.13*Math.cos(lat*Math.PI/180)).toFixed(0)` km. The north–south size is fixed at 11 km. Drop "≈10 km" from the title and the composition note.
4. **The long caveat (N3).** Move it into `<details>`. The wording does not change. Its summary is a 44 px touch target.
5. **About.** Add the About block to the `About` menu panel in `substation-intelligence`. If the owner prefers not to touch that cartridge, add it to the lightning module's own About entry.
6. **Byte budget.** M3 is 492,163 B against the 500,000 B gate. The literal delta is −210 B. The helper, the `<details>` and the About block are estimated at +600 to +900 B (unmeasured). The result must stay at or below 500,000 B, and it must be measured before release.
7. **Tests** (node only, added to `tools/ci/lightning/overlay-engine.test.mjs`):
   - Every rendered card block has `data-tier`. A distance, count or sum is never `record`.
   - A banned-word lint (rule 7) runs over every rendered Screening and Discovery string. It allows only the negation forms listed in this document.
   - A Discovery input (`n.confidence==='MEDIUM'`, an arrival-link card) never renders a `Record` or `Screening` badge on a line derived from it.
   - The cell-size helper returns 7 km at 49.5° N and 5 km at 61.5° N.
   - No visible label shows `%` beside "match" or "relevant".
8. **Phone acceptance (owner's device).** At 393×852:
   - every badge fits on one line;
   - the first line of each block is 2 lines or fewer;
   - the About block needs no horizontal scroll.
9. **Pipeline News** is a separate repository and a separate PR. Apply P1–P5 in `newsHtml`. Ship P6 only with a dated-review field in the news index.

## Open questions for the owner

- Should the Engineering line (F3) show on every lightning card, or only in About? It costs 56 B per card type.
- Is "Discovery" acceptable as the tier name on Pipeline News? It replaces the existing "DISCOVERY ONLY".
- The NESO TEC product as loaded carries no register date that I could find in the cartridge. Should the card say "date not carried" until the pinned product exposes one?

## Sources

- The external assessment: owner's attachment, 29 Oct 2026. It is not public.
- EUMETSAT MTG Lightning Imager L2 LFL collection: https://api.eumetsat.int/data/browse/collections/EO%3AEUM%3ADAT%3A0691?format=html. The detection efficiency of about 87.4% is quoted from the assessment and is **unverified** here.
- IEC 62305-2:2024, Protection against lightning, Part 2: Risk management: https://webstore.iec.ch/en/publication/28137
- NESO TEC register: https://www.neso.energy/data-portal/transmission-entry-capacity-tec-register
- DESNZ Renewable Energy Planning Database: https://www.gov.uk/government/publications/renewable-energy-planning-database-monthly-extract. The April 2026 extract is as named in the M3 cartridge.
