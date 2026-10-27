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
