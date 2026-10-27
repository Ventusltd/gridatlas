# Session handover — the night of 1–2 September 2026

Written at generation `202609020035` because the session was running long
and Vikram asked for the whole thread saved so a fresh one can continue.

**Read this with [`202609012305-quantumspawn-recovery.md`](./202609012305-quantumspawn-recovery.md),
which carries the wake sequence and the standing rules. This file carries
what happened, what is broken, and what to do next.**

Both are witnesses. **Current Git and the deployed bytes outrank both.**

---

## 1. Start here (read-only, in this order)

```bash
cat atlas/current.json | head -5                       # what is POINTED at
curl -s https://ventusltd.github.io/gridatlas/atlas/current.json   # what is SERVED
node -e "const j=require('./tools/overnight/shift-log.json');for(const r of j.runs)console.log(r.step,r.version,r.outcome,r.reason||'')"
cd ../pipelinenews && git log --oneline -10
sed -n '/202609020020/,$p' docs/coordination/BOARD.md   # the last exchange with Codex
```

**Only `outcome: "live"` counts as a version.** Failed and dry runs are not
versions. Do not inflate the count.

---

## 2. What is live

### GridAtlas — 9 of 10, all verified on the deployed bytes

| Version | Generation | What it added |
| --- | --- | --- |
| v9.69 | `202609012211` | sizing arithmetic became a module (**attended**) |
| v9.70 | `202609012234` | Codex's v2/v3 data-contract hold, closed (**attended**) |
| v9.71 | `202609012243` | electrical distance — hops, not kilometres |
| v9.72 | `202609012249` | every published season; structural refusal to sum ratings |
| v9.73 | `202609012308` | **the declared DC powerflow** |
| v9.74 | `202609012317` | grid at any point; collapsible layers dash |
| v9.75 | `202609012345` | published planned changes, kept apart from what exists |
| v9.76 | `202609020006` | **the computation left the sandbox** (see §4) |
| v9.77 | `202609020018` | Codex's powerflow stop-ship, closed |

"Attended" means a human step was needed (a hand push after a runner
refspec fault). v9.71 onward were clean unattended runner passes.

### Pipeline News — 1 live

`202609012326` — live at
`https://globalgrid2050.com/pipelinenews_intelligence/202609012326/`.

Three more cartridges are authored and their steps queued but **not cut**:
`mapped-is-not-nearest`, `season-is-named`, `hops-are-not-kilometres`.

---

## 3. OPEN BUGS — Vikram reported these from his phone at 01:25–01:30 BST

These are the top priority. The first is a regression I introduced.

### 3a. HIDE LAYERS hides the whole app on mobile — REGRESSION, v9.74

`#gridatlas-dash-toggle` collapses `.dashboard`. **`.dashboard` is the
whole application**: `atlas/releases/202608300453-atlas-v9/index.html:22`
opens it and `.map-container` at line 36 is INSIDE it. Pressing HIDE
LAYERS therefore blanks the entire page (his third screenshot is a black
screen with only the button left).

**The element it should collapse is `.scada-wrapper`** (index.html:111) —
the brand block, the status legend, `#scada-ui-container` (the TOPOLOGY /
ASSETS checkboxes) and the disclaimer. That is "the layers dash".

Also reported: the control is "strangely out of place in full screen".
The shell has `#btn-fullscreen`, `#btn-fullscreen-exit`, `#fs-curtain`.
The toggle should be hidden while fullscreen is active — in fullscreen the
dash is already out of the way and the button just floats over the map.

The fix belongs in a new step; **do not amend v9.74**.

### 3b. SUBS do not load for wind

Screenshot: Dorenell Extension Wind Farm (REPD 14535, wind_onshore,
476.6 MW, Moray), SUBS chip active, no substations and no neon links.

Ruled out already: `wind_onshore` **is** in `PROJECT_TECHS`
(`atlas/parts/202609012045-sld-sandbox-body.js:163-171`), so the click
path is not gated out by technology.

Not yet diagnosed. The next step was to deep-link that project on the live
page in Chrome and read `window.__GRIDATLAS_NEON_LINKS__` — its
`failures`, `recovered`, `substations_loaded` and `links_drawn`. Suspects
worth checking in order: the substation payload's coverage in Moray (it is
33 kV and above, OSM-derived); `SUBS_URL` / `loadSubstations()` at
`…body.js:1233`; and whether the layer id `l-subs` is present at that
zoom. **Diagnose before fixing.**

### 3c. Nothing new appears on globalgrid2050.com

Two separate causes, one fixed and one not.

**Fixed:** the Pages deploy is paths-filtered and *no path matched
`pipelinenews_intelligence/`*. Pushing a snapshot deployed nothing —
`202609012326` sat complete on origin/main and returned 404 for over an
hour. Every earlier snapshot had been served only as a side effect of a
commit that also touched `index.html`. `pipelinenews_intelligence/**` was
added to `.github/workflows/deploy-pages.yml` (commit `875a881`) and the
release went live immediately.

**Not fixed:** the homepage `index.html` still lists `202608312339` as the
newest Pipeline News release, so from a reader's point of view nothing new
exists. Naming a release on the homepage is a **governed act** — see
`homepage_versions/README.md` (numbered snapshot + recorded counts +
plain-English intention BEFORE any edit) and the `V8_ENTRY` sentinel
contract in `scripts/catalogue_gridatlas_v9.py`. A previous session
rewrote more of that page than was asked and had the work rejected.
**Change only the entry he names, keep every other `name:`/`note:` string
byte-identical, and diff to prove it.**

---

## 4. The architectural change that matters most (v9.76)

The sld-sandbox cartridge hit **383,614 of a 400,000-byte boundary** and
the scope lint refused the next cut. There is no fifth script slot: the
shell loads four scripts and all four are claimed.

Two dishonest exits were available and are recorded as **rejected**: raise
the boundary because my own lane needed it, or leave the module uncomposed
and call the version shipped.

What shipped instead: the five modules that read the operator's published
network moved to `substation-intelligence`, whose own header has said since
`202609012045` that *"the sandbox owns the card, this owns the
computation."* The shell loads `ventus-corev8engine.js` (line 138) before
the sandbox adapter (line 139), so a module composed there is defined
before the body that calls it. Geodesy moved too, which finally ended the
duplicate-geodesy class: the substation body had been computing distance
with `2*R*asin(√a)` while the estate canonical form is
`R*2*atan2(√a,√(1−a))`, invisible while that half was a monolith.

**Sizes now:** sld-sandbox ~316 kB, substation-intelligence ~187 kB.

This forced tooling changes, all committed separately:
- `recompose.mjs` takes `cartridge-id=path` on `--add-module` /
  `--remove-module`, gained `--remove-module` and `--parts-from` (a parts
  SEED, deliberately not written into `atlas/manifests/`, because
  back-dating a manifest that cannot reproduce its own cartridge is a
  false record), and now updates `assembled_from` — which had rotted five
  generations behind.
- the runner takes `step.restamp` so one cut can restamp both halves of a
  move.
- four proof harnesses now compose the way the page does (sandbox proof,
  all-versions, module-parity, data-contract parity). The all-versions one
  loads bare and **retries** with sibling modules rather than naming a
  boundary generation that would rot.

---

## 5. Codex — the two-lane protocol

Codex works in parallel and is **right often enough to take seriously**.
Tonight they found the v2/v3 data-contract lie (closed in v9.70) and both
powerflow P0s (closed in v9.77).

Handshake: `pipelinenews/docs/coordination/from-claude/202609012325-two-lane-handshake.md`.

**Path ownership.** Claude owns `atlas/current.json`,
`atlas/{manifests,cartridges,parts,modules}/**`, `tools/recompose.mjs`,
`tools/build-cartridge.mjs`, `tools/overnight/**`. Codex owns
`atlas/codex/**` and `tools/acceptance/**`. Shared, additive-only:
`tools/ci/202609012200-local-ci.mjs`, other proofs, and the board.

**Push protocol.** Never force. Fetch immediately before pushing; if
origin moved, rebase **and re-run the gates** — a gate computed against a
different base is not a gate result. Never one commit spanning both lanes.

**A lane collision that already bit, and its fix.** Codex publishes into
the Pipeline News release chain too: `202609020010` is a Codex-lane
release with `atlas_target: "codex"` importing
`202609020010-codex-atlas-lab-deep-link.mjs`, so MAP opens their isolated
lab. My runner took "the newest release" as parent and would have made
that the base of the LIVE line — the public MAP would have pointed at the
Codex lab. The deep-link gate caught it. The PN runner now selects the
newest release whose `atlas_target` matches the lane it builds for.
**That change is written and NOT yet committed** (see §7).

**Open to Codex, not claimed:** the Chrome *interaction* receipt. v9.74
added `#btn-gridpoint` and `#gridatlas-dash-toggle` and nobody has clicked
either. What I have is module evaluation in the live page, which is not a
UI click, and I have not said otherwise.

---

## 6. The grid computation, as it now stands

Six modules, all in `substation-intelligence`, all proven against the real
10 MB published payload (a skip is not a pass — absent the product they
FAIL):

| Module | Proof | What it answers |
| --- | --- | --- |
| network-topology `202609012245` | in sandbox proof | what lands at a site, per voltage |
| electrical-distance `202609012245` | 52/52 | how many published circuits away |
| rating-envelope `202609012250` | 40/40 | every season, never summed |
| injection-response `202609020015` | 76/76 | **the declared DC powerflow** |
| planned-change `202609012345` | 79/79 | what is published for a future year |
| owner-boundary `202609012350` | 72/72 | which owners, and where two meet |

**The powerflow is a DECLARED model**, and the declaration is the licence
to compute with X at all: equations, 100 MVA base, named slack, flat
1.0 pu, small angles, no losses, no taps, intact network — all carried in
the answer. Validated to 1e-9 against networks with exact analytic
solutions (parallel paths inverse-to-reactance, symmetric ring 2/3–1/3,
reciprocity under reversal), and power conserved at all 339 intermediate
buses of the real 400 kV network. **There is no commercial solver in this
estate and none has been claimed.**

Facts worth keeping: the 400 kV graph has **573 buses, 459 modelled
branches, 238 connected components**, largest 320. A cross-component
transfer is refused before the solver is asked. Acceptance requires
convergence AND a global residual AND Kirchhoff at EVERY bus — any one
alone can hold while the answer is wrong.

Real answer, for reference: 480 MW injected at West Burton, withdrawn at
the declared sink `HUNE4-`: 64% on KEAD43–WBUR41, 55% on NORT41–OSBA42,
55% on OSBA42–THTO41.

**Data facts verified by reading the products, not assumed:** 921 sites,
2,679 nodes (649 publish a null voltage), 1,392 circuits, 1,472
transformers, 2,230 planned changes. 886 connection points, **502 located,
384 without coordinates**. Summer differs from winter on 1,081 of the
1,276 circuits publishing both. Four circuits publish 9,999 MVA on spans
of a kilometre or less — placeholders, flagged and excluded from ranges.
**No field expressing headroom, spare capacity or availability exists
anywhere in either product** (verified by key scan).

---

## 7. Uncommitted work in the tree

`pipelinenews/tools/overnight/202609012300-shift.mjs` has the lane-aware
parent selection (§5) applied but **not committed** — the commit was
interrupted. Check `git status` and commit it before the next PN cut, or
the runner will build on Codex's lane again.

Also present and uncommitted: an unrecorded `shift-log.json` edit marking
`202609012326` live.

---

## 8. What to do next, in order

1. **Fix 3a** — collapse `.scada-wrapper`, not `.dashboard`; hide the
   toggle in fullscreen. New step, new version. Do not amend v9.74.
2. **Diagnose 3b** in Chrome before touching code.
3. Commit the lane-aware PN parent (§7), then cut the three queued PN
   cartridges.
4. Ask Vikram before touching the homepage (3c) — that is his call and a
   governed edit.
5. GridAtlas needs one more version for ten.

## 9. Standing rules — none of these may be relaxed

Never grade a project's grid position. A straight line is not a cable
route. Never mix voltages; never decode a voltage from a node code (trust
`voltage_consistent_with_site === true` only). R/X/B are carried, and may
be computed with ONLY inside a model that declares itself. Ratings are
never summed. A rating is not headroom. A skip is not a pass. Fail closed
on an unknown schema. Never amend a shipped generation. Commit tooling
separately from a cut. Stamps are read from `date -u` at commit time,
never chosen. **Never weaken a shared check to make your own lane pass —
make it more precise and say why.**
