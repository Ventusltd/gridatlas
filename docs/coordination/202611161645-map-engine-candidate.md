# MAP receiver and distance calculation candidate

Candidate composition `202611161645` / V9.190 derives from live `202611132345`.
The live pointer and historical shells/cartridges remain unchanged.
The new read-only browser CI workflow is registered in the workflow budget;
`STATE.md` is regenerated only to record its count (10).

The real V9.24 MAP click for REPD 12588 at 390px reproduced issue #87: the
engine measured five nearby substations, but the reader's restored card
collapsed again within two seconds. Asynchronous identity reconciliation
called `injectIntoCard`, which reset the mobile minimized default. The new
cartridge remembers the reader's choice for the exact selection across card
updates and replacement. A different project retains its own default.

The optional NESO declared-connection lookup now settles after a four-second
timeout or abort, with a separate failure state. An unavailable declaration
does not suppress the measured nearest distances or invent a connection.

The embedded browser distance and receipt module is built by
`Ventusltd/ventus-grid-engine` commit
`487ec7bd38dfa5aecb1c75da53b4a866ab2101cb`, using
`tools/build-browser-observer.mjs`. Its SHA256 is pinned in the composition.
The actual nearest-substation scan calls the owner's `distanceKm` for each
candidate. GridAtlas still owns the search, ranking, map and card rendering.
The owner observer runs at that calculation call site and validates exact
entity, origin, node coordinates and unrounded kilometre results. It exposes
queued, computing, failed and completed receipt states in the actual card.
No project MW, PV DC, inverter AC, export capacity, storage MWh or transformer
rating is inferred or converted. These are geographic distances, not
electrical connections, grid capacity, routes, offers or engineering designs.

Validation commands:

```
node tools/proofs/202611161645-sld-sandbox.proof.mjs
node tools/proofs/map-receiver-restoration.browser.mjs
node tools/scope/loop.mjs lint
node tools/scope/loop.mjs state --stdout
node tools/ci/pr-gate.mjs --base origin/main
```

The browser proof clicks the real V9.24 MAP control and intercepts only the
GridAtlas owner files to compose this local candidate at the canonical
receiver URL. It uses live publisher/owner data requests where files are not
present locally; this is candidate acceptance, not a public deployment.
Default sample: refs 12588 (solar), 14535 (onshore wind), 2470 (offshore wind)
at 390, 393 and 1440px. It checks actual numeric results, owner computation
receipts, exact identity, visible kilometre text and persistence after restore.
Set `NESO_TIMEOUT=1 WIDTHS=390 REFS=12588` to test a stalled optional lookup.
JSON receipts go into ignored `work/`; no machine paths or credentials belong
in public artifacts. This sample does not prove all 7,775 projects or physical
iPhone behavior, and does not classify nearshore versus distant offshore.

One existing test harness used URL `.pathname` as a filesystem path, which
failed on Windows before any offtaker assertions ran. It now uses
`fileURLToPath`; no application behavior changed with that portability fix.

No main merge, production pointer promotion or deployment is performed by
this candidate. Root integrator retains release ownership and review gates.
