# Acid test — try to break everything we shipped today

Paste everything below the line into a fresh Claude chat. No repository
access is needed: every artefact is public and every source is citable.

---

You are a hostile reviewer. A two-agent team (Claude and Codex) built the
following in one session, checked each other's work, and believe it is
sound. Your job is to find where it is wrong, misleading, or unproven —
not to confirm it. A review that finds nothing is a failed review unless
you can show what you tried.

Everything below is public. Verify against primary sources, never against
the team's own description of them.

## What was built

**GridAtlas** — https://ventusltd.github.io/gridatlas/atlas/
A map of the GB renewables pipeline. Deep links open a project card:
`?repd_ref=10916&project=West+Burton+Solar+Project&technology=solar&capacity_mw=480&latitude=53.2926216&longitude=-0.6774547&zoom=12`

**data-grid-gb** — https://github.com/Ventusltd/data-grid-gb
Products derived from NESO's Electricity Ten Year Statement 2025:
- https://raw.githubusercontent.com/Ventusltd/data-grid-gb/main/derived/connection-points.v2.json
- https://raw.githubusercontent.com/Ventusltd/data-grid-gb/main/derived/gb-transmission-network.v1.json

**Studies** in `Ventusltd/gridatlas/governance/`:
`202609011515-400kv-customer-substation-study.md`.

**Sources to check against**: legislation.gov.uk (made DCOs), the Planning
Inspectorate's published documents, and NESO's ETYS appendices
(neso.energy → Electricity Ten Year Statement → documents and appendices;
Appendix B system technical data, Appendix D fault levels).

## The standing rules the work claims to follow

1. Never grade a project's grid position. No strong/weak, close/remote,
   good/poor. Measurements only.
2. Bind to the public record or say nothing. Every scheme-specific claim
   cites a made Order, a PINS document, or a public statement.
3. A straight line is not a cable route; distances are straight-line to
   mapped geometry and must say so.
4. Products fail closed on an unknown schema; consumers never own source
   data.

**Any breach of these is a finding, however small.**

## Start here: the defect the team already suspects

Open the West Burton link above and read the "NESO published" line. At the
time of writing it says:

> 8 circuits · 6 transformers · circuit winter ratings 1,500–3,326 MVA ·
> three-phase RMS break current **5.1–49.6 kA** across 25 peak-demand rows
> (2025/26 to 2033/34) · 4 changes published for 2028–2030

Now fetch `connection-points.v2.json` and look at West Burton's
`fault_current.peak.locations`. They include `WBUR1 M2` and `WBUR4 M3` —
**132 kV and 400 kV busbars in the same envelope**. So 5.1 kA is a 132 kV
node and 49.6 kA is a 400 kV node, and the card presents the range as one
figure for "the substation".

Questions to answer with evidence:
- Is that range meaningful to a network engineer, or is it a category
  error that a plausible-looking sentence conceals?
- The same question for `circuit_winter_rating_mva` 1,500–3,326 MVA: are
  those ratings from circuits at one voltage or several?
- Does the product's own `aggregation` note ("envelope across the listed
  published rows; metrics are not interchangeable") cover this, or does it
  warn about the wrong hazard — different METRICS while the real problem
  is different VOLTAGES?
- What is the correct presentation? Per voltage level? Only the level the
  project connects at? Propose the fix and say what it costs.

That one is handed to you deliberately. Find the others yourself.

## Where else it is probably weakest

**The name join.** ETYS names substations; it does not locate them.
Coordinates come from an OpenStreetMap-derived payload joined by
normalised name in two tiers: `exact_name` 486, `distinctive_tokens` 88,
`unlocated` 312 of 886. Sample the token-matched 88 by hand. How many pair
a substation with an unrelated site that shares a place name? What is the
false-positive rate, and does anything downstream depend on a wrong one?

**The declared-connections table** is hand-curated — roughly a dozen REPD
identities mapped to named substations with Order citations, inside the
Atlas cartridge. For each entry, open the cited Order on legislation.gov.uk
and check the claim survives: Cottam Solar (SI 2024/943), West Burton
Solar (SI 2025/116), Gate Burton (SI 2024/807), Tillbridge (SI 2025/1105),
Heckington Fen (SI 2025/85), Beacon Fen (EN010151), One Earth (EN010159),
Thorpe Marsh, West Burton C. Is any quoted works description wrong,
stale, or attached to the wrong REPD reference? Is any scheme's point of
connection misstated?

**The pink "not built yet" line.** One Earth draws pink because its point
of connection is said to be NGET's *new* substation beside the existing
High Marnham; Thorpe Marsh because a new 400 kV substation is under
construction. Is either wrong today? Is a scheme drawn gold whose far end
is *also* not built?

**Little Crow** (`?repd_ref=6557`) draws no line at all, claiming its
point of connection is a 132 kV Northern Powergrid circuit within the
site, not a substation. Check EN010101. Is that right, and is drawing
nothing the honest answer or an evasion?

**The node-code convention** in `gb-transmission-network.v1.json` is
DERIVED, not documented: site code + voltage digit (1→132, 2→275, 4→400) +
suffix. The product publishes the counts it derived this from and a count
of nodes whose voltage their site does not declare. Is the convention
right? What about digits 3, 5, 6? How many nodes does it silently
misclassify, and does any published figure depend on one?

**The measurement discipline.** Distances use haversine on R = 6378.137 km.
Check the Atlas's stated distances against your own calculation from the
published coordinates. Do any disagree? Does every distance carry its
caveat?

**Mobile.** The claim is that a phone shows the declared connection
"immediately" and the full measurement within a few seconds. Test on a
narrow viewport. Time it. Does the card ever show a measured value before
it is measured, or a stale one after a new selection?

## Specific claims to falsify

Each of these is asserted somewhere in the work. Verify or break it:

1. 886 connection points at ≥132 kV; 574 located; 605 with fault current.
2. 1,392 circuits with R/X/B on a 100 MVA base; 2,230 planned changes for
   2026/27–2033/34.
3. Cottam has 17 published changes; Thorpe Marsh 19; Blackhillock 16
   circuits and 15 changes.
4. Cleve Hill Solar Park's own substation is mapped 1.73 km from the
   project and 0.21 km from National Grid's Cleve Hill 400 kV.
5. Tillbridge's consented scheme substations are each "2 × 400/33 kV,
   150/75/75 MVA transformers with 400 kV GIS".
6. West Burton's point of connection is taken by "extending main busbar 4
   and reserve busbar 3/4 gas zones" for a new GIS bay.
7. Little Crow secured 99.9 MW of export capacity and its report records
   ~£22M of switchgear and cable replacement at Keadby.
8. The Atlas grades nothing: no sentence anywhere states or implies that a
   project is well or poorly placed for connection.
9. Every fault-current figure on a card is NESO's published three-phase
   RMS break current, never conflated with the peak or DC metrics.
10. The products fail closed: a consumer given a schema it does not
    recognise yields no answers rather than plausible ones.

## What to deliver

A findings list, most severe first. For each: the claim, the evidence that
breaks it (quote the primary source), the consequence for a reader, and
the smallest correct fix. Separate **wrong** from **unproven** from
**misleading but true** — they need different remedies.

Then answer one question directly: **if a network engineer at a developer
read this map and acted on it, where would it mislead them first?**

Be specific and be hard. The team's own rule is that a measurement is
worth more than a judgement, so bring measurements.
