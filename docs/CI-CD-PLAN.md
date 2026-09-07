# CI and CD plan

Two tiers, deliberately different in what they can see and how often they run.

| tier | where | cadence | sees |
| --- | --- | --- | --- |
| Overnight worker | `D:\gridatlas-ci` (external SSD) | continuous, in a fixed window | the running application, live and offline |
| GitHub Actions | `Ventusltd/gridatlas` | annual timer, dispatch, path triggers | the data sources, on a clean Linux checkout |

Neither tier grades. Both report measurements and let a person decide.

---

## 1. Overnight worker

`node D:\gridatlas-ci\worker.mjs`, launched detached with `CI_WINDOW_MIN`, one
cycle then twelve minutes idle. Throttled deliberately: cycles ran back to back
at first, which is a browser launch every two and a half minutes all night for
almost no extra signal.

Open **`D:\gridatlas-ci\index.html`** straight from the drive. No server. It
leads with what changed in the last cycle, then all-night findings, then
measurements, then the cycle log, and it refreshes after every cycle.

### The five lanes

| lane | what it does | why it exists |
| --- | --- | --- |
| `offline` | `claude-ci` runner over the no-server fabric | parses what ships, binds identity, clicks layers and passes only on rendered evidence |
| `live` | drives the published Atlas on Pages | real Esri tiles, served-byte integrity and the arrival radius on real data |
| `map-button` | reads every MAP link on Pipeline News, follows two | the link shape is what decides whether a button can fire at all |
| `study` | counts from files on disk, no browser, no network | coordinate coverage, offshore gaps, interconnector endpoint reconciliation |
| `twins` | **read-only** watch of Codex's `acceptance.json` | reports that lane without stamping on it |

The `twins` lane never executes Codex's harness. Running it would rewrite
`site/twins/acceptance.json` underneath an active lane, which is the same class
of mistake as committing onto someone else's branch.

The `map-button` lane rotates through four sort orders so a different slice of
the corpus is sampled each pass. The dead-button rate depends entirely on which
twenty rows are on screen, which is why a one-off check never settled it.

### Three outcome classes, never merged

```
FAIL                the application did something wrong
BLOCKED_HARNESS     this rig measured wrongly
BLOCKED_DEPENDENCY  a host or tile was unreachable or uncached
```

Only the first is a bug in the code. Every fault found on the first night was
one class wearing another's clothes at least once, so the separation is the
whole point rather than a nicety.

### Fingerprint and diff

Each finding is hashed on `class + area + subject + normalised detail`, with
stamps, hashes, numbers and units normalised out, then diffed against
`baseline.json`. A recurring finding collapses into a count with a first-seen
cycle. The morning shows what changed, not the same rows sixty times.

---

## 2. GitHub Actions

### `offshore-coordinate-reconcile.yml`

Runs `tools/offshore/reconcile_offshore_coordinates.py`, which gives every
offshore REPD row a coordinate or says plainly why it has none.

- **annual** `23 4 14 2 *` — 14 February, 04:23 UTC. Off the hour and off the
  first of the month so it does not land with every other cron on the planet.
- **`workflow_dispatch`** with a `commit` toggle, for running it now.
- **push** on `tools/offshore/**`.

It checks out `globalgrid2050` and `testcode` as siblings, so the same script
runs unchanged on a laptop and on the runner. Inputs are found by glob rather
than named, so a lease file added under a new name is picked up without editing
the workflow.

The regression gate runs **before** the write. Checking afterwards would only
compare the new file against itself and could never fail. It is proven both
ways: exit 1 against an inflated baseline, exit 0 against the real one.

`repd.csv` is never edited. The register is the register; the output is a
separate and explicitly derived coordinate set.

---

## 3. Publishing

A published version under `atlas/v/<UTC stamp>/` is two files — `current.json`
and an `index.html` that *is* the Atlas loader, booting from its own
`./current.json`. Cartridges are referenced as `../../cartridges/`, so a whole
publish costs a few hundred kilobytes. A release also needs a composition
manifest under `atlas/manifests/`, which is where the homepage catalogue reads
the title from; without one no catalogue row can be derived.

Before pushing, three checks that each caught something real:

1. **Stamp with `date -u`.** A stamp typed from the local clock is an hour wrong
   under BST.
2. **Verify the committed blob against the manifest sha256.** Git normalises
   CRLF to LF, so a cartridge written on Windows is committed with different
   bytes than were hashed. That mismatch nearly shipped a version whose hash
   could never match what was served.
3. **Verify the served URL after deploying**, not just that the file exists.

---

## 4. What the pipeline currently tracks

| finding | class | state |
| --- | --- | --- |
| Nearest substation beyond `RADIUS_KM = 25` reports no links and a null distance | product | open, identical in published versions, **not** introduced by recent work |
| MAP links emitted with only `repd_ref` and `technology` fail the arrival invariant | product | open; cause is a row with no coordinate, now closable |
| `substation-intelligence` cartridge exceeds the 400 kB lint boundary | product | open and **pre-existing** — already failing at `66b445b` |
| Offshore rows with no coordinate | data | 6 of 8 recovered from Crown Estate leases |
| Interconnector far-end coordinates | data | 0 of 10 sourced; GB ends all located |

---

## 5. Data sources

Catalogued in `atlas/coordinate-systems.json`, summarised in the README. The
short version: REPD is the majority source and the only one in metres
(EPSG:27700); everything else is degrees (EPSG:4326); the interconnector
reference has electricity flow data and no geometry at all.

### Cable intel

The BritNed v ABB judgment gives quotable figures: **245 km of submarine cable
plus 9 km of land cable**, 1,000 MW, converter stations at the landfall in both
countries, and **Maasvlakte** named as the Netherlands site. Once that
coordinate is sourced, great-circle from Grain Static Inverter Plant
(`0.71616, 51.44050`, measured from our own substation data) divides into 245 to
give the first measured **route factor** — the number a later bend computation
must reproduce. A factor from one link is one observation, not a constant.

---

## 6. Next

1. **Interconnector far ends.** TSO navigational publications are the strongest
   lead: TenneT, Energinet, Elia, Statnett and National Grid are obliged to tell
   mariners where offshore assets and cable corridors are, which makes those
   coordinates both findable and authoritative.
2. **Interconnectors as Ventus lines.** An interconnector is shaped exactly like
   an offshore project to the Atlas — a name, a capacity, a technology and a
   point — so reusing the offshore rendering means no new layer, no new styling
   and no new card. The midpoint becomes the project point and the grid engine
   fires from it unchanged. Blocked only on the far ends: a midpoint needs both.
3. **Turbine OEM references.** Vestas and Siemens Gamesa cover a large share of
   GB offshore and are a tractable reconciliation target, though they give the
   site rather than the cable.
4. **The two unmatched offshore rows**, Morecombe and Muir Mhòr.

---

## 7. Rules earned the hard way

Each of these cost a wrong answer before it became a rule.

- **Measure before asserting, and prefer the application's own signals to a
  clock.** A fixed wait made three healthy lanes look dead simultaneously; three
  lanes failing identically means the measurement is wrong, not the lanes.
- **Register the offline service worker before judging anything offline.**
  Navigating straight to the Atlas sends requests to the real internet, every
  tile passes, and it reads as "satellite works" — a measurement of the test
  browser, not the product.
- **Parse CSV with a real parser.** `split(',')` on quoted fields shifts every
  later column until coordinate columns appear to hold the word `England`. That
  artefact reached a published README and had to be retracted.
- **Point-on-surface, not centroid.** A centroid of a concave or multipart lease
  can fall in open water outside its own lease.
- **A pre-existing failure is not yours to hide or to claim.** Check whether the
  gate already failed before your change, and say which.
