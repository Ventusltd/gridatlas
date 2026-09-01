# Deep study brief — the REPD register as evidence about grid connection

Paste everything below the line into a new Claude chat and attach the two
CSVs named in §2. Written 2026-09-01 for Ventus / GlobalGrid2050.

---

You are doing a deep, reproducible study of the UK Renewable Energy
Planning Database (REPD) for an engineering firm that publishes a public
grid atlas. Your output will be read by people who know the network. Take
your time; depth beats speed.

## 1. The house rules — these override any instinct to be helpful

1. **Never grade a project.** Do not call any scheme well-connected,
   poorly-connected, close, remote, strong, weak, attractive or
   constrained. Report measurements and let them speak. A distance is a
   distance; it is not a verdict about a connection.
2. **Bind to the public record or say nothing.** Any claim about a
   specific project's grid connection must cite a public source: a made
   Development Consent Order on legislation.gov.uk, a Planning
   Inspectorate published document, a public planning application, or a
   public company statement. If you cannot cite it, present it as an
   unverified candidate and say what would verify it.
3. **A straight line is not a cable route.** Distances here are
   straight-line to mapped geometry. A real connection depends on network
   impedance, fault level, thermal headroom, existing committed
   connections and queue position, right of way, wayleaves, crossings,
   terrain, land control and consent. State this wherever you report
   distance, and never infer any of those factors from a distance.
4. **Every number must be reproducible** from the attached files by code
   you include. No figure may appear that your own script cannot
   regenerate. If you estimate, label it an estimate and give the method.
5. Stay neutral on geopolitics; this is an engineering and business study.

## 2. The data (attached)

**A. `repd-atlas-register-202608290716.csv`** — 11,069 rows, one per REPD
identity, extracted 2026-08-29 from the REPD and normalised. Columns:
`repd_ref, name, technology, repd_technology, status, capacity_mw, county,
region, country, planning_authority, operator, postcode, latitude,
longitude, source_record_updated`.

Ground truth you can check on load:

- 11,069 distinct `repd_ref`; every row has coordinates.
- `technology` (normalised, 14 values) vs `repd_technology` (REPD's own,
  longer vocabulary). Counts and total MW by `technology`:
  solar_roof 3,397 / 1,656 MW · solar 2,864 / 56,255 MW · bess 2,111 /
  128,972 MW · wind_onshore 1,488 / 35,652 MW · biomass 820 / 5,740 MW ·
  hydro 155 / 14,413 MW · wind_offshore 97 / 72,581 MW · hydrogen 63 ·
  act 38 · tidal 20 · geothermal 7 · caes 4 · other 4 · flywheel 1.
- `status` has exactly four values here: awaiting construction 5,942 ·
  operational 3,132 · application submitted 1,539 · under construction
  456. **This slice carries live pipeline only.** Refused, Withdrawn,
  Revised, Expired, Abandoned and Decommissioned records exist in the
  REPD and are absent here. Any statement about attrition, refusal rates
  or success probability is therefore **out of scope for this file** —
  say so rather than computing it. (If you want that dimension, name the
  public REPD extract that carries it and treat it as further work.)
- 1,110 rows have null or zero `capacity_mw`; 9 have no
  `planning_authority`.

**B. `grid-substations-202608300453.csv`** — 5,800 substations derived
from OpenStreetMap, columns `name, voltage_raw, operator, latitude,
longitude`. Read `voltage_raw` under this contract, which is not
negotiable: **OSM `voltage` is volts at every magnitude**, and a record
may carry several separated by `;` (e.g. `400000;275000`). Take the
maximum for classification. Tokens below 1,000 are still volts — 750 is a
DC traction supply at a railway depot, not 750 kV — and an audit of this
payload found 229 features (3.95%) carrying such a token, all previously
misread. Substations whose maximum is below 33 kV are out of scope: 11 kV
is rare for utility-scale export and often a private network.

Geodesy convention, so your numbers match the atlas: **haversine on a
single Earth radius R = 6378.137 km**. Do not mix radii; do not use a
projected CRS for distance without saying so.

Date note: `source_record_updated` is a **string in DD/MM/YYYY**. Parse it
before any comparison — string ordering silently produces nonsense (a
naive min/max returns 01/01/2020 to 31/12/2014).

## 3. What is already established — do not redo it

Nine NSIP-scale schemes have publicly declared 400 kV points of
connection, already verified against made Orders: Cottam Solar → Cottam
(SI 2024/943); West Burton Solar → West Burton via a new customer
substation at WB3 (SI 2025/116); Gate Burton → Cottam (SI 2024/807);
Tillbridge → Cottam (SI 2025/1105); Heckington Fen → Bicker Fen
(SI 2025/85); Beacon Fen → Bicker Fen extension (EN010151); One Earth →
NGET's new High Marnham substation (EN010159); Thorpe Marsh Green Energy
Hub → Thorpe Marsh (new four-bay 400 kV substation under construction);
West Burton C BESS → West Burton.

The established pattern from those Orders: collection at 33 kV; either a
132 kV backbone or a direct 33/400 kV step-up at a **customer substation
consented inside the scheme** (2–4 HV transformers, reactive power units,
sometimes a harmonic filter compound); then one 400 kV underground
circuit of 7.5–21 km to a National Grid point of connection, whose
interface falls into five public classes — spare/ex-generation bay reuse,
a new generation bay, a GIS busbar-zone extension, a National
Grid-delivered multi-customer extension, or a wholly new NG substation.

## 4. Work packages

**WP1 — Register anatomy.** What can this dataset support, and what can it
not? Field completeness; duplicate or near-duplicate identities (same
site, several refs — note that a solar scheme and its co-located battery
usually hold separate refs); the relationship between the two technology
vocabularies; the capacity semantics problem (REPD's figure is nominally
MW electrical, but schemes report AC export and DC MWp and the register
does not carry the distinction — quantify how often this ambiguity could
matter); what `status` does and does not tell you.

**WP2 — The transmission-scale population.** Describe the capacity
distribution per technology. Where, empirically, does the population
separate into distribution-scale and transmission-scale? Do not assert a
threshold from convention — derive candidate breaks from the data
(quantiles, gaps, the 50 MW NSIP line as a reference marker only), state
which you use and why, and how many projects and MW sit above it, by
technology and by status.

**WP3 — Proximity structure, at population scale only.** For every row
with coordinates, compute distance to (a) the nearest substation ≥33 kV,
(b) the nearest ≥400 kV, (c) the nearest *named* ≥400 kV. Report
distributions by technology and capacity band — medians, quartiles, the
tails. The question to answer is about the population, not about
individuals: does the transmission-scale population sit measurably
differently from the rest, and by how much? Publish the per-project table
as data, but **write no per-project judgement into the prose.**

**WP4 — Connection-region clusters (the valuable one).** The DCO record
shows NSIPs deliberately sharing corridors and points of connection. Using
the large-capacity population from WP2, identify geographic clusters whose
members share a plausible connection region — e.g. group by nearest named
≥400 kV substation, or cluster spatially and then name the substation.
For each cluster report: member projects, total MW, technology mix,
status mix, and the named substation. Then, for the top clusters,
**check the public record** and mark each member as: publicly declared
(cite the Order or PINS document), publicly discussed without a
declaration (cite), or unverified. Deliver the unverified ones as a
candidate list with the exact search terms that would settle each. This
extends the nine known declarations without inventing a tenth.

**WP4b — Validation, by holding declarations back.** The nine declared
schemes in §3 are ground truth. Hold each out in turn: would your WP4
method have surfaced the correct substation as its top candidate, from
the data alone? Report recall (how many of the nine you recover), the
rank of the true substation where you do not, and the failure modes.
Then do the same for the worked case in WP7. This measures the candidate
generator; it never authorises a claim.

**WP7 — The customer substation, where it already exists on the map.**
The consented schemes build their own substation, and once built it
appears in OpenStreetMap, usually named after the scheme. Cleve Hill
Solar Park (REPD 6502 solar 373 MW and 7856 BESS 150 MW, both
operational, Kent) is the worked case, and its whole chain is already in
the attached substation file:

  Cleve Hill Solar Park Substation — 400 kV — 1.73 km from the project
  Cleve Hill 400kV Substation (National Grid) — 0.21 km from that
  (haversine, R = 6378.137 km; the National Grid substation was built for
  the London Array offshore wind farm, and the DCO point of connection is
  publicly stated to be that adjacent 400 kV substation)

Census this across the whole register: for how many REPD identities does
the substation file contain a substation whose name matches the project
name (define your matching rule, report precision by inspecting a
sample), and what is the distance distribution of those matches? Where
both a name-matched substation and a nearby National Grid substation
exist, report the **two-hop chain** — project → its own substation →
transmission substation — as three measurements.

This is a measurement over public map data, not an inference: "a
substation named after this scheme is mapped 1.73 km away" is a fact
about the map. Do not upgrade it into a claim that the scheme connects
there; say what is mapped and what would confirm it.

**WP5 — Coordinate provenance and its limits.** Assess how the
coordinates behave: are they site centroids, postcode centroids, or
mixed? Test for tell-tales (many projects sharing an identical point;
coordinates that land on a postcode centroid rather than a field). State
the measurement error this implies for WP3, in kilometres, and which
conclusions survive it.

**WP6 — Who is building the transmission-scale population.** Concentration
by `operator` in the WP2 population: how many holders, how concentrated,
which hold multiple NSIP-scale schemes in one connection region (join to
WP4). Register facts and public corporate statements only.

## 5. Deliverables

1. **A written report**, structured by work package, that a network
   engineer would find worth reading — findings first, method visible,
   limits stated in the same breath as each finding.
2. **A machine-readable table** of the WP3 measurements (one row per
   `repd_ref`, distances and nearest names) and **a candidate table** from
   WP4/WP7. The candidate table must use exactly these columns, because a
   downstream renderer consumes it:

   `repd_ref, project_name, technology, capacity_mw, substation_name,
   substation_kv, distance_km, own_substation_name, own_substation_km,
   evidence_class, source, search_terms`

   where `evidence_class` is one of `PUBLICLY_DECLARED` (with `source`
   naming the Order or PINS document), `MAPPED_OWN_SUBSTATION` (a
   name-matched substation exists on the map; source is the map), or
   `UNVERIFIED_CANDIDATE` (proximity or clustering only — `source` empty,
   `search_terms` filled with what would settle it). Never leave
   `evidence_class` blank and never invent a `source`.
3. **The code**, complete and runnable against the two attached files,
   producing every number in the report.
4. **A limits section**: what a reader must not conclude from this study.

## 6. Acceptance tests — check your own work against these before finishing

- Every figure in the prose is regenerated by your code from the attached
  files. No orphan numbers.
- No sentence grades an individual project's grid position.
- Every distance states its method and radius, and carries the
  straight-line caveat at least once per section that uses distances.
- Every claim about a specific scheme's connection cites a public source
  or is explicitly labelled unverified.
- The absence of refused/withdrawn/expired records is stated wherever it
  bears on a conclusion.
- Voltage classification follows the volts-at-every-magnitude contract,
  and you report how many records the ≥400 kV filter selected.
- Anything you could not determine is written down as such, not smoothed
  over.
- No row in the candidate table carries a `source` unless that source
  genuinely says what the row claims. A proximity result is never
  promoted to a declaration, however convincing the geometry looks. This
  is the single failure that would discredit the whole study, because a
  reader cannot tell a measured guess from a cited fact once they are in
  the same column.

Start with WP1 and show me the register anatomy before going further, so
we can agree the ground before the analysis is built on it.
