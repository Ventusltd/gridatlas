# The 400 kV customer substation, as the DCO record illustrates it

Generation `202609011515` · commissioned by Vikram, 2026-09-01: *"spend at
least an hour studying the 400kV challenge re customer subs illustrations
for DCO."* Every fact below is from the public record — made Orders on
legislation.gov.uk and Planning Inspectorate published documents. A private
project document was read during this work solely to validate that the
logic matches practice; nothing in this study or on any card derives from
it that is not independently public.

## 1. The challenge, stated

NSIP-scale solar and storage does not connect to the network the map
already shows. Each scheme builds its own **customer substation** — scheme
infrastructure, consented inside the DCO, standing on farmland the day
before — and reaches a **point of connection** at a National Grid 400 kV
substation through a dedicated cable circuit. A nearest-substation map
that ranks by distance reads these schemes against 33 and 132 kV points
that have nothing to do with them, and no OSM-derived payload contains the
customer substation at all, because it does not exist yet.

The durable public illustration of all of this is the DCO itself: Schedule
1's numbered Works define the customer substation, the cable circuit and
the National Grid works verbatim; the Environmental Statement's parameter
tables give the physical envelope ("Rochdale envelope" — maxima, not final
design); and the works plans place them.

## 2. Per-scheme evidence

### Cottam Solar Project — Order 2024 (SI 2024/943, EN010133)

- Customer substation (Work No. 4A, "Cottam 1 substation"): "an up to
  400kV substation, with associated transformer bays, feeder bays,
  transformers, switchgear buildings", control building, maintenance
  compound. It is a **33/132/400 kV collation node**: Cottam 2, 3a, 3b
  arrive at 132 kV (satellite sites each step 33→132 kV with their own
  transformer), Cottam 1's own generation and storage enter at 33 kV
  (Grid Connection Statement C7.7, §3.3, §3.9).
- Cable (Works 6A/6B): "a single 400kV circuit, consisting of three
  cables… underground… approximately 13.3 km", HDD under the River Trent
  (GCS §3.2).
- NG works (Work No. 5), at an **ex-generation bay** of Cottam 400 kV:
  "busbars and connectors to connect to the existing busbar
  disconnectors; a 400kV 3-phase 4000A circuit breaker; a 3-phase set of
  current transformers for protection; a 3-phase High Accuracy Metering
  Current and Voltage Transformer assembly; a 3-phase 400 kV line
  disconnector/earth switch; a 3-phase set of 400kV high voltage cable
  sealing ends", plus a stand-alone protection building (GCS §3.10).
- Grid process: application to NGESO July 2020; offer October 2020
  (ref A/NGET/CGCL/20/COTT-EN(0)); accepted (GCS §2.1).

### West Burton Solar Project — Order 2025 (SI 2025/116, EN010132)

- Intermediate site substations (Works 3A, 3B): each "an up to 132kV
  substation, with associated transformer bays, feeder bays, transformers,
  switchgear buildings and ancillary equipment **including reactive power
  units**".
- Customer substation (Work No. 3C, at West Burton 3): "an up to 400kV
  substation" with the same composition including reactive power units.
- NG works (Work No. 4), at West Burton 400 kV: "**extending main busbar 4
  and reserve busbar 3/4 gas zones** to allow for the connection of a
  **new GIS substation bay** comprising a 400kV 3phase 4000A circuit
  breaker…" — a GIS busbar-zone extension, not a bay refit.
- Cable (Work No. 5): high-voltage cables connecting Work 3C to Work 4.

### Gate Burton Energy Park — Order 2024 (SI 2024/807, EN010131)

- Customer substation (Work No. 3): "substation, switch room buildings and
  ancillary equipment including reactive power units" and — unique in this
  set — "a **400 kilovolt harmonic filter compound**".
- Cable (Works 4A/4B): "one 400 kilovolt cable circuit", ~7.5 km, to
  Cottam.
- NG works (Work No. 4C): "the installation of **one 400 kilovolt
  generation bay**" at Cottam — a new bay, where Cottam Solar reuses a
  spare one: two different bay strategies at the same NG substation.

### Tillbridge Solar — Order 2025 (SI 2025/1105, EN010142)

- Customer substations (Works 3A and 3B — two of them): each "**2 x
  400/33kV, 150/75/75 MVA transformers**", "**400kV Gas Insulated
  Switchgear**", 33 kV switchgear, surge arresters, post insulators, bus
  ducts. Direct 33→400 kV, no 132 kV intermediate, and the only Order in
  this set that names MVA ratings.
- Cable (Works 4A–4E): ~18.5 km 400 kV circuit to a free bay at Cottam.
- NG works (Work No. 5): the standard bay kit (breaker, metering CT/VT,
  busbars/connectors, line disconnector/earth switch).

### Heckington Fen Solar Park — Order 2025 (SI 2025/85, EN010123)

- Customer substation (Work No. 4): "transformers, including associated
  cooling equipment, bunding and blast walls; switchgear, including
  circuit breakers, disconnectors and earth switches; **harmonic filtering
  reactive power compensation equipment**".
- NG works at Bicker Fen, in three parts: Work 6A "creation of a **new
  generation bay**"; Work 6B "an **extension to the existing substation**"
  as "outdoor AIS or indoor GIS"; Work 6C "a **cable sealing end
  compound** and construction of a new circuit bay".

### Beacon Fen Energy Park — DCO granted Aug 2026 (EN010151)

- Customer substation (ES Ch. 2 §2.8): "up to **four HV transformers**"
  (each, per Table 2.1: "33kV up to 400kV… **160 tonnes** per unit,
  footprint up to **15m × 9.5m**, height up to **10.5m**"), whole compound
  "no more than **40,000 m²** (e.g. 250m × 160m… height of up to 13m)".
  Collection at 33 kV; conversion to 400 kV for a ~13 km circuit.
- NG works (§2.13): the Bicker Fen extension is "**delivered by National
  Grid**", sited "to take into account **the needs of other customers**",
  with NGET requesting **AIS/GIS optionality** (AIS option ≈ 18,022 m²,
  height 15 m) and an explicit design interface with the Heckington Fen
  generation bay. NESO and NGET named in their roles.

### One Earth Solar Farm (EN010159) — consented

- PoC is "**NGET's proposed new substation at High Marnham**", built
  adjacent to the existing one as Great Grid Upgrade works with new lines
  to Beverley and Brinsworth — the class where the NG end itself does not
  exist yet.
- The Outline Export Cable Route CMS (APP/7.13.1) illustrates the
  construction method: a **7.5 km** corridor for a 400 kV underground
  export cable; a connection agreement for "**export and import of up to
  740 MW**" (import — the BESS matters to the agreement, not just the
  panels); crossings selected per site from **HDD, TBM microtunnelling /
  pipe-jacking, or conventional tunnelling**; an illustrative **25 m ×
  20 m trenchless launch pit "for a 400 kV connection"**; 5 m haul roads;
  concrete joint bays.

### Thorpe Marsh Green Energy Hub (public planning/contractor records)

- 1,400 MW / 3,100 MWh BESS connecting at Thorpe Marsh, where "a new 400kV
  4-bay double bus-bar AIS substation" with "two skeleton generator bays,
  four circuit feeder bays… four new transformers" is under construction —
  the new-build NG substation class, already in delivery.

### West Burton C (public project records)

- 500 MW / 1.1 GWh BESS at the former coal site; 400 kV grid connection;
  financial close July 2026; construction from 2026.

## 3. The cross-scheme model

**Collection voltage** is 33 kV in every scheme.

**Two intra-scheme architectures.** (1) A 132 kV backbone: satellites step
33→132, the customer substation collates 33/132 and steps to 400 (Cottam
built this way; West Burton consents up-to-132 kV intermediates). (2)
Direct 33→400 at the customer substation (Tillbridge, 2×150/75/75 MVA per
substation; Beacon Fen, up to four 33→400 units).

**The customer substation's composition**, across the Orders: HV
transformers (2–4 units; where rated, 150/75/75 MVA; where weighed, 160 t),
switchgear (GIS where named at Tillbridge; AIS/GIS open elsewhere),
**reactive power units** (West Burton, Gate Burton), **harmonic filter
compounds** (Gate Burton, Heckington), control/switch-room buildings,
bunding and blast walls, and a BESS compound adjacent. Envelope idiom: "up
to" maxima throughout.

**Five PoC interface classes at the NG end**, all public:
1. **Spare / ex-generation bay reuse** — Cottam Solar at Cottam.
2. **New generation bay** — Gate Burton at Cottam; Heckington 6A at
   Bicker Fen.
3. **GIS busbar-zone extension** — West Burton at West Burton.
4. **Substation extension** (AIS-or-GIS, sealing-end compound, new circuit
   bay, NG-delivered, multi-customer) — Heckington 6B/6C and Beacon Fen at
   Bicker Fen.
5. **New NG substation** — One Earth at NGET's new High Marnham; Thorpe
   Marsh's new four-bay AIS build.

**The standard NG bay kit**, near-verbatim across Orders: busbars and
connectors to existing busbar disconnectors; a 400 kV 3-phase **4000 A**
circuit breaker; protection CTs; a high-accuracy metering CT/VT assembly;
a 400 kV line disconnector/earth switch; cable sealing ends; a protection
building.

**The cable circuit**: one 400 kV circuit of three single-core cables,
underground, 7.5–21 km in this set, trenched with joint bays and HDD at
crossings — the Trent HDD is shared by four NSIPs (Cottam, West Burton,
Gate Burton, Tillbridge), and corridors are shared deliberately.

**The construction-method illustration** (One Earth oCMS as exemplar):
trenchless method chosen crossing-by-crossing from HDD, TBM
microtunnelling / pipe-jacking, or conventional tunnelling; 25 × 20 m
launch pits at a 400 kV connection; 5 m haul roads; concrete joint bays;
satellite and construction compounds with typical details appended. And
one contractual fact the maps never show: the connection agreements are
for **export and import** — 740 MW both ways at One Earth — because the
BESS behind the customer substation is party to the connection, not a
passenger.

## 4. What this cooks into the Atlas

1. **Declared card enrichment** (next composition): each declared scheme
   carries its customer-substation works and PoC interface class, quoted
   from its Order — e.g. Tillbridge: "two scheme substations, each 2 ×
   400/33 kV 150/75/75 MVA transformers, 400 kV GIS"; West Burton PoC:
   "new GIS bay by busbar-zone extension". Statements remain quotations of
   consented works, never design advice.
2. **Nearest-400 row companion**: where the nearest 400 kV feature is
   unnamed, also show the nearest *named* 400 kV substation — two
   measurements, no judgement.
3. **SLD sandbox, later**: a 400 kV step-up stage for declared schemes —
   collector 33 kV, N × 33/400 kV transformer block, single 400 kV export
   circuit to the named PoC — drawn from the same public parameters. Held
   for its own composition with its own proofs.

## Sources

- SI 2024/943 (Cottam), SI 2025/116 + 2025/647 (West Burton), SI 2024/807
  + 2024/1249 (Gate Burton), SI 2025/1105 (Tillbridge), SI 2025/85 +
  2025/482 (Heckington) — legislation.gov.uk, Schedule 1 in each.
- EN010133-000442 Cottam Grid Connection Statement (Jan 2023).
- EN010151-000086 Beacon Fen ES Chapter 2 (incl. Table 2.1; §2.8, §2.13).
- EN010159 One Earth application documents (export cable CMS and LIRs).
- Thorpe Marsh Green Energy Hub and West Burton C: public project and
  contractor records.

---

## Addendum, 202609011718 — the counter-archetype, and the far end's state

Vikram asked how West Burton and Little Crow are each being connected.
They are opposites, and holding them side by side is what produced the
pink line.

**West Burton Solar (SI 2025/116).** Build your own transmission
substation: a 400 kV customer substation at WB3 with reactive power
units, up to 132 kV site substations at WB1 and WB2, a 10 km 400 kV cable
to an **existing** National Grid bay, taken by extending main busbar 4 and
reserve busbar 3/4 gas zones for a new GIS bay.

**Little Crow Solar Park (EN010101, Grid Network Constraints Report,
November 2020).** Do none of that. The point of connection is "a single
main connection at 132kV to the Northern Powergrid network **located
within the Order Limits**" — a looped connection into "the Keadby –
Broughton – Teed – Scawby Brook overhead 132kV line circuit" that already
crosses the site, with **99.9 MW** of export capacity secured. The
applicant's own reasoning is instructive: a PoC for a scheme this size
would normally sit outside the boundary and need "kilometres of
underground cable at substantial cost". The report also records what the
local network costs: NGET and NPG 132 kV switchgear and NGET 132 kV
cabling must be replaced at Keadby at a budget cost of about £22M; Keadby
GSP is approaching its export capability limit; NPG is making Active
Network Management offers there; and "the 99.9MW capacity has also taken
the NGET electricity network very close to its network capability."

So a DCO scheme is not automatically a 400 kV scheme. The register cannot
tell these two apart — both are large solar with consent — and only the
public record can.

**What this forces on the drawing.** The far end of a declared connection
carries two properties, and flattening them into one gold line said things
that were not true:

1. **Does it exist?** One Earth connects to NGET's *new* substation beside
   the existing High Marnham (Great Grid Upgrade); Thorpe Marsh's new
   400 kV four-bay substation is under construction. Both draw **pink**
   from v9.56, with the state named on the card. The state comes from the
   public record, never from whether OSM happens to have mapped the asset
   — an unbuilt substation may be absent, or present because someone
   mapped the consented site.
2. **Is it a node at all?** Little Crow's PoC is a *circuit*. There is
   nothing to draw a line to and nothing to measure, so nothing is drawn
   — and the card says why, rather than leaving a silence that reads as
   absence.

**Still to come, from the network side.** NESO publishes what would settle
much of this without inference: ETYS Appendix A (system schematics),
Appendix B (connectivity and impedances), Appendix C (power flow
diagrams) and Appendix D (fault levels, peak and minimum). Fault level in
particular is one of the factors every card says cannot be inferred from a
distance — quoting NESO's own published figure at a named substation would
be citation, not inference. That is a feed to parse, not a study to
commission.
