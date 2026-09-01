# Pipeline News and GridAtlas, origin to today

Generation `202609012230`. Commissioned by Vikram, 2026-09-01: *"a deep CI/CD
scan on everything we have done on the pipeline news app, the gridatlas app,
from day 1 till now, so that you have a file with deep understanding of both
so that you can deepen the grid engine."*

Every number here was produced by `tools/ci/202609012230-deep-scan.mjs`
against the real git history of both repositories, and is regenerable in
about thirty seconds. The raw output is `202609012230-deep-scan.json`.

**Screening-grade unless marked otherwise.** That is the spiders repo's rule
and it is not a formality: while writing this, the scanner's own deep-link
pass reported that GridAtlas ignores twenty-three parameters, including two
that are visibly on the card. The finding was my regex, not the code. Every
claim below that survived was re-checked by hand against the file, and the
two places where the scanner was wrong are recorded rather than deleted.

---

## 1. The two applications, in one paragraph each

**Pipeline News** is the governed evidence surface. It owns project identity
(the REPD register, 14,657 canonical refs), the news and relationship
intelligence built on top of it, and the decision about what is publishable.
It is a build pipeline that emits immutable, timestamped releases into
`releases/`, each with its own manifest and SHA-256 sums. Its interface to
the map is one artefact: the deep-link builder.

**GridAtlas** is the spatial and electrical surface. It owns an immutable
shell (`ventus-corev8engine.js`, eight retained releases) plus a composition
of hashed cartridges named by `atlas/current.json`. Nothing about the shell
changes; a version is a new set of cartridges and a new composition manifest.
It answers: where is this project, what network is near it, what does the
public record say it connects to, and — since v9.62 — what grid is mapped
around an arbitrary point.

---

## 2. Eras

| | Pipeline News | GridAtlas |
|---|---|---|
| First commit | 2026-08-24 | 2026-08-29 |
| Commits | 369 | 264 |
| Active days | 9 | 4 |
| Stamped generations | 206 | 247 |
| Code families | 345 | 97 |

GridAtlas is five days younger and has almost as many commits: 247 stamped
generations in four days is roughly one every twenty-five minutes of working
time. That rate is the context for everything in section 5 — the defects
found tonight are not carelessness so much as the arithmetic of cutting a
release every twenty-five minutes by hand.

Both repositories run the same discipline: a twelve-digit UTC generation
stamp opens every commit subject, artefacts are timestamped rather than
edited, and a superseded artefact is retained rather than deleted.

---

## 3. The contract between them — and the one gap in it

Pipeline News's MAP button builds a URL through
`assets/*-atlas-pointer-deep-link.mjs`. Resolving both sides precisely — the
producer by file, the consumer by the variable actually bound to
`new URLSearchParams(location.search)` — gives:

| Parameter | Set by Pipeline News | Read by GridAtlas |
|---|---|---|
| `repd_ref` | yes | yes |
| `project` | yes | yes |
| `technology` | yes | yes |
| `capacity_mw` | yes | yes |
| `latitude` | yes | yes |
| `longitude` | yes | yes |
| **`zoom`** | **yes** | **no** |

**Finding, confirmed by hand.** `zoom` is set on every deep link and read
nowhere in GridAtlas. There is no `get('zoom')` in the repository. Arrival
zoom is instead hard-coded — `map.flyTo({ ..., zoom: 12 })` in the gazetteer
cartridge, with a kind-based variant for postcodes. Pipeline News currently
sends `zoom=12`, so the two agree **by coincidence**, not by contract. The
day someone tunes the sending side, nothing changes on the map and nobody
finds out for a week.

This matters more than it looks, because the next feature is a click
anywhere on the map: the moment arrival is not a project, the right zoom
stops being a constant.

---

## 4. What grew, and into what

Line counts are of the artefact family across all its timestamped versions.

| Family | Versions | Smallest | Largest |
|---|---|---|---|
| `atlas/cartridges/sld-sandbox` | 64 | 1,462 | **5,166** |
| `atlas/parts/sld-sandbox-body` | 4 | 4,862 | **4,876** |
| `tools/proofs/sld-sandbox.proof` | 63 | 525 | **2,453** |
| `atlas/cartridges/substation-intelligence` | 6 | 435 | 1,690 |
| `pipelinenews:releases/…/assets/app.mjs` | 24 | 997 | 1,603 |
| `pipelinenews:atman/verify-mobile-ui-browser` | 6 | 1,471 | 1,964 |

Sixty-eight files in the working tree are at or over 800 lines.

The instruction was: *"if there are 4000 lines then modularise next
versions."* The sandbox cartridge is **5,166** lines and its body part is
**4,876**. It is over the line and this document exists partly to make the
split a measured decision rather than a rewrite.

Its proof is a second monolith and a quieter problem: 2,453 lines containing
five functions. A flat proof is one nobody re-reads, and three of tonight's
defects were checks that had gone stale inside it.

---

## 5. The seams already inside the monolith

The body divides itself into 22 named sections. They are not arbitrary — the
file has been telling us where it wants to be cut:

| Line | Section | Belongs |
|---|---|---|
| 198 | the 400 kV public record | **data module** (475 lines) |
| 673 | geodesy | **already a module — duplicated here** |
| 684 | substation layer | render |
| 854 | the project card | render |
| 1327 | the card keeper | render |
| 1341 | the arrival card | render |
| 1442 | the map layers | render |
| 1669 | selection | behaviour |
| 1727 | say what is happening | behaviour |
| 1919 | the project pin | render |
| 2021 | labels need glyphs | render |
| 2117 | GB grid conditions | data |
| 2321 | the version ledger | generated metadata |
| 2412 | the Grid Finding Scope | **correctly uses its module** |
| 2534 | the mobile tray | render |
| 2918 | arrival by identity | behaviour |
| 3136 | capture the map | infrastructure |
| 3360 | geodesy the layout needs | **module candidate** |
| 3442 | the sizing arithmetic | **module candidate** (529 lines) |
| 3971 | the layout | render |
| 4218 | dragging | render |
| 4314 | the panel | render |

### 5.1 The finding that decides the order of work

**The served cartridge defines its Earth radius twice and `distanceKm`
twice.** In `202609012155-sld-sandbox-v9-8.js`:

```
line  33   const EARTH_RADIUS_KM = 6378.137;     ← the geodesy module
line  36   function distanceKm(...)               ← the geodesy module
line 412   const R_ATLAS = 6378.137;              ← the body
line 966   function distanceKm(...)               ← the body
```

They agree today. They agreed all evening. And tonight the module's copy was
found to differ from the body's in the last bit of the result, because the
extraction wrote the haversine in a different algebraic form — caught only
because a proof compared every shipped version against every other.

The module extraction was supposed to end this. It did not, because the body
was never changed to *use* the module: the module was placed in front of it
and both were shipped. The Grid Finding Scope, added later, does it correctly
— it calls `window.__GRIDATLAS_MODULES__.gridScope` and computes nothing
itself. That is the pattern; geodesy is the exception.

**So the first modularisation is not a new module. It is making the body
consume the two modules already sitting inside the same file.**

The 3360 section is different work — `destinationPoint` and
`initialBearingDeg`, projection and bearing rather than distance. Those
belong in the geodesy module and are not there yet.

---

## 6. The surfaces — the real API, previously undocumented

Fifteen `window.__X__` registrations have existed; thirteen are live. Nothing
in either repository documents them, and they are how cartridges find each
other:

| Surface | Registered by | Purpose |
|---|---|---|
| `__GRIDATLAS_ATLAS__` | atlas/index | the page itself |
| `__GRIDATLAS_V9_MAP__` | place-search cartridges | the MapLibre instance |
| `__GRIDATLAS_MAP_READY__` | streaming bridge | map lifecycle |
| `__GRIDATLAS_V9_BRIDGE__` | parquet fetch bridge | payload transport |
| `__GRIDATLAS_PRE_SNAPPED_CONFIG__` | neon links, sandbox | shell config |
| `__GRIDATLAS_NEON_LINKS__` | neon links, sandbox | **link ledger + `measure`** |
| `__GRIDATLAS_NETWORK__` | substation-intelligence | the NESO product |
| `__GRIDATLAS_SLD__` | sandbox | layout state |
| `__GRIDATLAS_PLACE_SEARCH__` | place-search | search lane |
| `__GRIDATLAS_MODULES__` | modules | **geodesy, gridScope** |

Two are gone: `__ATMAN_MAP__` and `__ATMAN_400_CLICK_START__`.

`__GRIDATLAS_NEON_LINKS__.measure` is the most important entry: it is what
every cross-version proof compares against, and it is what a map-click
feature has to reuse rather than reimplement.

---

## 7. Duplication, today

662 function name/arity pairs are defined in more than one file. Most is
honest: immutable release copies of the same artefact. What is not:

| Function | Files | Note |
|---|---|---|
| `invariant(2)` | 190 | every tool re-declares it |
| `sha256Hex(1)` | 61 | across live cartridges |
| `escapeHtml(1)` | 52 | across live cartridges |
| `installStyles(1)` | 49 | across live cartridges |

These are small and low-risk individually. They are listed because the
geodesy defect shows what the class costs when the function is not small.

---

## 8. Clicks — what exists before the next feature is built

177 files handle a click; 18 handle a **map** click. The live composition
holds three map click handlers, all in the sandbox cartridge:

1. a project or substation hit → the neon links path (the anchor)
2. blank space with the scope armed → the Grid Finding Scope
3. blank space otherwise → clear

The neon path is the mature one: it resolves an identity, measures five
links, draws them, and writes a ledger. The scope path is one generation old
and answers only "what is mapped here" from the OSM-derived substation
payload. **It does not consult `__GRIDATLAS_NETWORK__`** — the NESO product
with 886 connection points, per-voltage fault current and planned changes —
even when that cartridge has already loaded it.

That is the gap the next build closes.

---

## 9. What this says to build next, in order

1. **Make the body consume the geodesy module** rather than carrying its own
   `R_ATLAS`/`distanceKm`. One radius, one function, one file, proven by the
   existing all-versions gate. *(Removes the standing risk that produced
   tonight's ULP divergence.)*
2. **Move `destinationPoint` and `initialBearingDeg` into geodesy**, with
   parity against the incumbent as before.
3. **A click anywhere runs the whole engine.** The scope should ask every
   cartridge that has loaded what it knows about that point — the OSM
   substation payload for what is mapped, `__GRIDATLAS_NETWORK__` for what
   NESO publishes at the nearest connection point, the topology module for
   the circuits and neighbours at that site — and say plainly which sources
   answered and which were absent. Discovery, not assumption: the surfaces
   in section 6 are the registry.
4. **Read `zoom`**, closing the contract gap in section 3.
5. **Split the proof** before splitting the render code. A 2,453-line flat
   proof is where stale checks hide, and three of tonight's defects were
   exactly that.
6. **Then** the render sections, one module per generation, each with parity
   against the incumbent. There is no hurry: they are the least dangerous
   1,500 lines in the file.

Render code is deliberately last. The computation is where a wrong answer is
invisible; a mis-drawn card is obvious the moment anyone looks.

---

## 10. Where the scanner was wrong, and what that means

Recorded because a screening tool that never reports its own errors is one
nobody should trust.

- **The deep-link pass first reported 23 orphaned parameters.** Its consumer
  regex matched `searchParams|params|query|url` followed by `.get()`;
  GridAtlas binds `const q = new URLSearchParams(...)`, and `q` was not in
  the list. Fixed by resolving the binding rather than guessing at names.
- **The corrected version then matched nothing at all.** The edit that
  introduced `\b` word boundaries wrote literal backspace bytes instead —
  found by Codex reading the scanner rather than its output, which is the
  whole argument for a second pair of eyes on a tool that reports on itself.
  A pass that matches zero now traces the count of files it examined, so
  silence is visible as a zero rather than as correctness.

Neither error would have been caught by running the scanner. Both were caught
by checking a surprising claim against the file it was about.
