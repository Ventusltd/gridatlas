# Grid Atlas V9

Standalone, evidence-gated successor to the immutable GlobalGrid Atlas V8.

V9 compiles the official DESNZ REPD Q2 2026 extract into typed ZSTD Parquet with DuckDB 1.3.2, verifies it against the pinned V8 project/coordinate oracle, and publishes a browser registry with official project addresses and postcodes.

The address/fly-to cartridge searches project name, official REPD address, official postcode, county, planning authority and REPD reference. It never uses proximity to claim project identity or ownership.

Live route: https://ventusltd.github.io/gridatlas/

## CI and CD

`docs/CI-CD-PLAN.md` is the plan: an overnight worker on an external drive that
drives the live and offline application in five lanes, and GitHub Actions that
reconcile the data sources on a timer. Outcome classes are kept apart there —
product, harness, dependency — because only the first is a bug in the code.

Offshore coordinates are reconciled by `tools/offshore/reconcile_offshore_coordinates.py`,
run annually and on demand by `.github/workflows/offshore-coordinate-reconcile.yml`,
writing `atlas/data/offshore-coordinates.json`.

## Coordinate systems

The Atlas draws from more than one register, and they do not arrive in the same
coordinate system. `atlas/coordinate-systems.json` is the catalogue: every
source, its CRS, its units, its geometry type and the caveat that matters when
reconciling it against the others.

The short version:

| source | CRS | units | geometry |
| --- | --- | --- | --- |
| DESNZ REPD (`repd.csv`) | EPSG:27700 (OSGB36) | **metres** | none — `X-coordinate` / `Y-coordinate` columns |
| The Crown Estate wind leases | EPSG:4326 | degrees | Polygon (72) |
| Crown Estate Scotland wind leases | EPSG:4326 | degrees | Polygon (58) |
| Pipeline News offshore partition | EPSG:4326 (undeclared) | degrees | Point (94) |
| Transmission circuits `grid_*kv` | EPSG:4326 (undeclared) | degrees | LineString |
| Substations `grid_substations` | EPSG:4326 (undeclared) | degrees | Point |
| GB interconnectors (BMRS reference) | — | — | **none: flow data only** |
| Atlas arrival deep link | EPSG:4326 | degrees | `latitude` / `longitude` |

REPD is the majority source and the only one measured in metres, so it must be
transformed before it is compared with anything else. Its coordinates are near
complete — 13,970 of 13,995 rows carry a finite easting and northing. Wind
Offshore is the worst technology at 8 per cent unmappable (8 of 101 rows), then
Tidal Stream at 6; every other technology measures 0.

Parse that file with a real CSV reader. Site names contain commas inside quoted
fields, so `split(',')` shifts every later column and makes the coordinate
columns appear to hold region names like `England`. This README asserted exactly
that artefact in its first commit, and the figures above replace it.

The Crown Estate files are the reconciliation for exactly that gap, and they are
leased separately for Scotland — matching REPD against only one of the two files
leaves every Scottish offshore project unmatched. They are lease *areas*, so a
representative point must be taken with point-on-surface rather than a centroid,
which on a concave or multipart lease can fall outside the lease itself.

Interconnectors are catalogued because the estate holds their electricity flow
data — sixteen links keyed by BMRS code, ten operational — and no coordinates at
all. Neither converter station is known for any link, so BritNed, Nemo Link and
the rest cannot yet be drawn. Two points per link, sourced from the owning SPV
and the counterpart TSO, are all the Ventus grid engine needs to fire. A straight
line between converter stations is the intended output, not a stopgap: it states
the separation exactly and is honest so long as it is labelled a straight line
rather than a cable route. Computing the bends of the consented corridor is a
later refinement of that same geometry.


---

## Cable engines

Ventus is a **cables and connectivity** company, and the clue is in the name. What this estate measures is **cables**: where one starts, where it ends, what route it can take, and what is publicly known about it. Every engine models a cable, and a project's class selects **which question** is asked, never **whether** a question is answered.

| document | what it holds |
| --- | --- |
| [Cable engines](https://github.com/Ventusltd/gridmachine1/blob/main/CABLE-ENGINES.md) | the rule, the priority, and how a project is routed to an engine |
| [Datasheets](https://github.com/Ventusltd/gridmachine1/blob/main/CABLE-ENGINE-DATASHEETS.md) | one contract per engine: question, endpoints, geometry, inputs, outputs, allowed silence |
| [Engineering plan](https://github.com/Ventusltd/gridmachine1/blob/main/ENGINEERING-PLAN.md) | what gets fixed, in what order, and what is protected |
| [Bug register](https://github.com/Ventusltd/gridmachine1/blob/main/BUGS.md) | numbered tickets with links, evidence and status |
| [The capsule](https://github.com/Ventusltd/gridmachine1/blob/main/reports/20260907T230000Z-engine-capsule/README.md) | the working engines sealed with their hashes, and what makes them worth copying |

The five engines: **substation finder within a radius**, **interconnector subsea link**, **offshore export cable to its onshore connection**, **400 kV overhead line and transmission connection**, and **132 kV distribution**. The first and fourth work today and are protected by their own passing receipts.

**This repository is where the engines fire.** An arrival from the pipeline resolves an identity, places the camera, draws the project and then hands to a cable engine. The composition is immutable once published: a version is never edited, only succeeded. The two working engines are sealed in the capsule with their hashes, and their bytes survive here, on the published lane, and inside two candidate pairs in the test repository.

---

## SEED — BUILDING HIGHER LEVELS OF COMPUTATIONAL INTELLIGENCE

27 November 2026 — Kernel-level development doctrine. This is a conceptual kernel for building intellectual instruments, not an operating-system kernel or a new runtime.

The objective of SEED is not to understand every line of the approximately 483,000 lines of accumulated source code. Nor is it to identify the most frequently repeated functions. Frequency does not necessarily indicate intellectual importance.

Instead, we should concentrate on discovering rare and exceptional computational achievements that substantially expand what we can accomplish.

GridAtlas provides an excellent example. Its ability to display extensive railway infrastructure beautifully within an ordinary browser, with an experience comparable to a premium vehicle navigation system, is a meaningful achievement. Its ability to selectively load enormous quantities of information, maintain an interactive environment and generate source-code exports exceeding 3,000 pages is another.

We should investigate the mechanisms responsible for these achievements rather than becoming distracted by individual drawing instructions, numerical constants or repetitive functions.

The proposed development methodology is as follows.

### STEP 1 — DISCOVERY

Identify exceptional observable achievements within existing applications. Concentrate particularly on capabilities that overcome limitations in scale, memory, complexity, responsiveness, representation and interoperability.

Look for rare computational mechanisms rather than frequently occurring source patterns.

### STEP 2 — ISOLATION

Trace backwards from the observable achievement to the computational assembly responsible for it.

Recover the relevant source through permanent STARS identities. Establish its dependencies, inputs, outputs and execution requirements.

We do not need to understand every internal instruction to establish what the assembly accomplishes.

### STEP 3 — GENERALISATION

Separate the fundamental intellectual mechanism from its original application.

For example, GridAtlas does not merely display railway tracks. It demonstrates the ability to represent extensive geographical networks across multiple scales.

Its loading architecture does not merely load geographical data. It demonstrates the ability to make large collections selectively accessible within constrained computing environments.

Its source-code printer does not merely produce documents. It provides access to substantial quantities of underlying computational material according to the application's loaded state.

These capabilities could potentially be transferred to entirely different applications.

### STEP 4 — VALIDATION

Establish that the isolated mechanism can reproduce its intended achievement under defined conditions.

Record the complete dependencies, limitations, evidence and permanent identities.

Distinguish demonstrated functionality from inferred functionality. Where generalisation has not been tested, preserve it as a hypothesis.

### STEP 5 — INSTRUMENTATION

Transform the verified mechanism into an intelligible computational instrument.

The human should primarily understand what the instrument accomplishes, what information it requires and what it produces.

The underlying code must remain accessible but should not become an obstacle to using the instrument.

### STEP 6 — COMPOSITION

Combine existing computational instruments to produce higher-order capabilities.

For example, combining geographical representation, selective loading, spatial measurement, object identification and environmental observation produces a sophisticated geographical investigation environment.

The resulting composition must produce a real working outcome rather than merely represent relationships on a diagram.

### STEP 7 — ELEVATION

Once a composition has been validated, treat the entire composition as another computational instrument.

This allows subsequent development to occur at a higher intellectual level.

A complete application containing thousands of lines could become a single reusable computational seed, which can subsequently combine with other seeds.

Repeat this process recursively.

The objective is to progressively increase the sophistication of what we can accomplish while reducing the number of instructions and decisions required from the human.

The approximately 483,000 lines should become the underlying computational foundation rather than the principal subject of human attention.

Our existing applications should serve as evidence of what is possible. GridAtlas, Pipeline News, Kuiper, LiDAR, STARS, VEDIC and the remaining estate contain numerous potentially valuable intellectual mechanisms.

We should investigate these mechanisms through different deterministic analytical perspectives, but there is no necessity to comprehend everything before beginning useful development.

A single exceptional discovery could be more valuable than classifying another 100,000 lines.

The eventual interface could remain within an ordinary browser. Two-dimensional representations, interactive tables, working demonstrations and optional three-dimensional exploration should be selected according to their intellectual usefulness.

Every abstract object must remain connected to a real computational achievement.

We are not attempting to construct an encyclopaedia of source code. We are attempting to construct a hierarchy of increasingly powerful intellectual instruments.

The measure of success should be the sophistication of real products that can be created with progressively fewer human instructions, without sacrificing accuracy, reliability, transparency or reproducibility.

The ultimate purpose is to inherit the intellectual achievements of nine months of development without repeating nine months of cognitive exhaustion.

### Evidence boundary and kernel rule

The owner reports the FILE-menu export can exceed 3,000 pages; that print function is not Spider Printer. Railway coverage completeness and whole-browser latency/memory limits are not established by the screenshots. The pinned GridAtlas generation 202609241251 loading-bridge replay reported by Codex demonstrates bounded controlled behaviour: critical cached path without DuckDB startup, early optional response before manifest resolution, one partition reconstruction and release of serialized payload, and cancellation. STARS tablets 6504 (runtime), 6519 (contract), 6512 (proof). Source revision: [GridAtlas afffa97](https://github.com/Ventusltd/gridatlas/tree/afffa9781f6130529ae93052604cd3d98d172a35). The runtime is a 331-line bridge, not a full dependency count.

COSMIC independently documents resolution-aware, on-demand sector retrieval, invertible addressing and accounting of resolved + held + outside-field = whole. This is a candidate complementary instrument, not a proof of cross-application equivalence.

No frequency threshold, mandatory whole-estate comprehension or line-count target may block an exceptional candidate. The 100 perspectives are optional discovery lenses, not a prerequisite to building. A high-order seed must retain its exact lower-order dependencies, evidence and failure/refusal conditions. Use selective access: smallest useful answer first, expand on demand, exact source always addressable. Preserve existing safety and repository-local governance. No active vaccine, production release or executable integration is authorised by this note.

### Linked kernel doctrine copies

- [gridatlas](https://github.com/Ventusltd/gridatlas/blob/main/README.md#seed--building-higher-levels-of-computational-intelligence)
- [cvaa](https://github.com/Ventusltd/cvaa/blob/main/studies/20261127-seed-kernel-build-order.md)
- [seed-data](https://github.com/Ventusltd/seed-data/blob/main/09_SEED_KERNEL_BUILD_ORDER.md)
- [cosmic](https://github.com/Ventusltd/cosmic/blob/main/docs/SEED_KERNEL_BUILD_ORDER.md)
- [neural-link-between-agents](https://github.com/Ventusltd/neural-link-between-agents/blob/main/SESSIONS/2026-11-27-SEED-KERNEL-BUILD-ORDER.md)
- [Spiders kernel-level reference index](https://github.com/Ventusltd/spiders/blob/main/docs/SEED_KERNEL_LINKS.md)

These committed references are intended for Spider observation as documentary links. They are not runtime dependency edges or proof of working integration.
