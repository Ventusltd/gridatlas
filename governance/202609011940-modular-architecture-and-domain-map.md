# Modules, and the domain they have to cover

Vikram, 2026-09-01: *"build code in a modular fashion, do not build huge
monologues that become difficult to maintain… these are all deep science
of the grid affecting inflation and the economy and must be democratised
like Linux."*

Both halves of that are engineering instructions. The second one sets the
scope; the first one is the only way the scope is reachable.

## 1. Why the monolith has to stop here

The sandbox cartridge passed four thousand lines tonight. It holds the
geodesy, the substation lookup, the card rendering, the declared-connection
table, the SLD layout, the finance port, the price panel, the version
ledger, the mobile tray and the failure ledger. Every version this session
appended to it, and every append made the next one harder: the v9.57
outage, the manifest identity drift and the mixed-voltage envelope were
all easier to make and harder to see because everything lives in one file
with one proof.

A file that does eleven things cannot be reviewed for any one of them.

## 2. The rule

**One module, one responsibility, one proof, one public surface.**

- `atlas/modules/<name>.js` — a module registers itself on a namespace and
  exports pure functions where it can. It does not reach into another
  module's internals and it does not touch the DOM unless rendering is its
  responsibility.
- `tools/proofs/modules/<name>.proof.mjs` — proves that module alone,
  against stubs, with no cartridge loaded.
- `tools/build-cartridge.mjs` — assembles a generation-stamped cartridge
  from a named list of modules, and records each module's SHA-256 in the
  composition manifest.

So a cartridge becomes a **manifest of modules**, not a place where code
accumulates. The composer still sees one file per slot, because that is
its contract; the repository sees parts that can be read, replaced and
proven one at a time.

**A module is small enough to hold in your head.** If a proof for one
module needs to stub three others, the boundary is wrong.

**Shared modules are shared, not copied.** The geodesy has been written
three times in this estate already — once in the sandbox, once in the
substation cartridge, once in the data repository. One radius, one
implementation, one proof.

## 3. The domain, and which module owns it

The subjects below are the ones Vikram named. Each is a module or a data
product, each has a public source, and none of them is a place for an
opinion. They are listed with what would have to be true before anything
ships.

### Already built

| Module / product | Owns | Source |
|---|---|---|
| geodesy | one Earth radius, distance, representative point | Ventusltd/grid-distance-maths |
| substation lookup | name normalisation, index, nearest by position | data-grid-gb connection points |
| network summary | what NESO publishes about a site, scoped | ETYS Appendix B and D |
| declared connections | DCO points of connection, works, PoC state | made Orders, PINS documents |
| price context | GB day-ahead and imbalance history | data-gb-electricity |

### To build, in the order they earn their place

**Fault current, properly.** The published metrics per BUS, not per site:
Appendix D's eight named currents at each node, peak and minimum, across
the demand scenarios. Today the consumer prints a site-wide envelope and
says so; the honest version quotes the bus the project connects at.
*Source: ETYS Appendix D. Blocked on: the per-bus split in data-grid-gb.*

**Headroom and impedance.** Circuit R/X/B on a 100 MVA base and seasonal
ratings are already in the network product; what is missing is the
honest statement of what they do and do not imply. Thermal rating is not
headroom. Impedance is not capacity. A module here must be able to say
"this is what is published, and here is what it cannot tell you" without
ever computing a connection verdict.
*Source: ETYS Appendix B. Rule: descriptive, never advisory.*

**The Great Grid Upgrade, and who is paying.** National Grid's and
TenneT's published programmes, the ETYS planned changes already parsed
(2,230 of them to 2033/34), and the published costs. The map can show
which reinforcements are published at which node and when.
*Source: ETYS Appendix B changes, NGET and TenneT published programmes,
Ofgem determinations.*

**The network operators' own statements.** UKPN, ENWL, Northern Powergrid,
SSEN, SP Energy Networks, NGED — their long term development statements,
constraint maps, curtailment and ANM schemes. Little Crow's own report
already showed why this matters: Keadby needed ~£22M of switchgear and
cabling, and the applicant recorded that 99.9 MW took the NGET network
"very close to its network capability". That is a DNO fact a map should
carry, from the DNO's own publication.
*Source: DNO LTDS and constraint publications, ENA open data.*

**NESO statements and reform.** Connections reform, the queue, the
gate-2 process, and what changed. This is the single biggest determinant
of whether any project in the register ever connects, and it is entirely
public.
*Source: NESO publications. Rule: report the process, never a project's
position in it.*

**Ofgem, ENA and government guidance.** Price control determinations,
connections policy, and the energy-cost interventions. Where they set a
number a project economics panel uses, that number must be cited to them.
*Source: Ofgem decisions, ENA, DESNZ publications.*

**Industrial energy cost and emissions.** The large CO2 users already
carried in globalgrid2050, the carbon prices they pay, and the published
energy costs behind the shift Vikram describes: gas peakers behind the
meter, installed because the grid connection was not there, now being
displaced by solar and storage as gas prices and export limits change the
arithmetic. British Steel and its peers are the visible edge of this.
*Source: UK ETS and CBAM publications, DESNZ industrial energy prices,
company statements. Rule: report the published cost, never a company's
viability.*

**G100 and export limitation.** Why a site exports less than it generates,
what the engineering recommendation actually says, and what that does to a
project's economics. Currently invisible on the map and material to every
behind-the-meter case.
*Source: ENA Engineering Recommendation G100.*

**Data centres.** Load growth, connection restrictions and the published
constraints on where they can be built. Already a layer on the map;
without the connection context it is only a dot.
*Source: NESO and DNO publications, published planning decisions.*

**The Heathrow North Hyde substation fire.** Already saved in
globalgrid2050 as NESO's interim and final reviews. A worked case of what
a single substation failure costs, which is the most concrete argument
this estate can make for why any of this matters.
*Source: NESO North Hyde review, already in the repository.*

## 4. The rule that survives all of it

Every module above reports what an authority published and measures what
can be measured. None of them grades a project, a company, a network
operator or a policy. The estate's value is that a reader can check every
number against its source — that is what makes it worth democratising, and
it is the first thing that would be lost by being clever instead of exact.

## 5. What happens next

The module system lands with the substation cartridge rebuilt from parts
— geodesy, lookup, summary — each with its own proof, and the composition
manifest recording each module's hash. After that, no new capability is
added to a cartridge body: it is added as a module and listed.
