# kv-regress: Build G and H harnesses re-run against I (node only, 27 Oct 2026)

**Modules (wt/atlas/modules):**
- G 202610270113, sha d17d3035…
- H 202610270246, sha a882099c…
- I 202610270929, sha c797fffc…, 33,623 B

No Chromium was started.

**Evidence:** `evidence/kv-regress/`
- `run-all.sh <V> <module>` runs every harness. `compare.mjs A B` compares two runs, with output in `cmp-{G-H,H-I,G-I}.txt`.
- `kv-probes.mjs` holds new probes K1–K9 (SYNTHETIC data), with output in `logs/kv/`.
- `real-main/` is a copy of `Ventusltd/lightning` origin/main `data/` (index generated 15:24Z), run through data-contract `run-real-E.mjs`. Output is in `rm/SUMMARY.txt`.

**Harness copies:** the sweep-G copies, byte-identical to the originals (security-E differs only in fixture path depth). The designer's 91-test suite is in `designer-I/`.

## Results (G → H → I)

| Harness | G | H | I | Δ H/I vs G |
|---|---|---|---|---|
| time (×4 TZ, 22 cases) | 21/22 | 21/22 | 21/22 | none. T12 is the known stale FAIL. |
| security S0–S11 | all identical | | | none |
| security probes (104) | | | | 1 key differs: wording in the flashes line only |
| flaky FNE (68) | 68/68 recovered, 0 stale-as-fresh, 0 zero, 0 throws | same | same | none |
| data-contract real + skew (13 sets) | | | | 35 lines G→H, 94 H→I; see R4 and T1 |
| CR-E repro (9) | 9/9 | 8/9 | 8/9 | CHK-DOM/MAP (T2) |
| CR-E test-fixes (49) | 48/49 | 48/49 | 48/49 | M02 (REG-1 from sweep-G, unchanged) |
| sec-E test-fixes (49) | 48/49 | 47/49 | 48/49 | H failed CR6 once. 3 reruns passed: a known flake. |
| CR-F repro (16) | 8/16 | 11/16 | 11/16 | H fixes CRF-2, CRF-2b and CRF-7 |
| CR-F suite copy (69) | 67/69 | 66/69 | 66/69 | DOTS (T3) |
| designer G suite (75) | 75/75 | 72/75 | 72/75 | M02, DOTS, REST (T3) |
| designer I suite (91) | 77/91 | 85/91 | **91/91** | expected fail-first |
| ChatGPT 4f9bcdf (8) | 8/8 | 8/8 | 8/8 | none |

**Real archive** (origin/main, 22 counted days, 1,507 flashes, 22 files, 800,841 B):
- H: 3M, 6M and 12M are summary only (0 drawn).
- I: 3M, 6M and 12M each draw 1,507 points. 22 day files are fetched.
- Every other window is identical between H and I.

## Test-only differences (not module defects)

- **T1.** data-contract G→H: the H1 wording ("7-DAY FEED ONLY…", "12 months").
  - In H→I, 3M, 6M and 12M switch from summary to detail.
  - On the TAMPER set they now read `FAIL · 1 of 5 day files failed`. That matches 7D and 30D (the R2 contract), so it is consistent, not a regression.
- **T2.** CHK-DOM/MAP hard-codes the own-id list. H added `l-gridatlas-lightning-hit`, which is an own id. But see R3.
- **T3.** Older suites still assert pre-H details the designer has since amended: DOTS (1 px stroke; H uses 1.5), REST (hidden markup equal to F) and M02 (phrase placement).

## Caps and LOAD POINTS consent: not bypassed

`module-I.js:85` auto-loads only when all three hold:
- index count ≤ min(40,000, `cap()` = 10,000 on a phone or 40,000 elsewhere)
- bytes ≤ 32e6
- files ≤ 400 (RQ)

Anything above that sets `clp`, shows LOAD POINTS and makes **0** day requests. The probes confirm it:

| Probe | Case | Before consent | After LOAD POINTS |
|---|---|---|---|
| K2 | 12M, 366 days, 40,260 flashes | `clp`, 0 day requests | 363 files, 39,930 flashes, 21.2 MB, 3 days skipped |
| K3 | 12M, 40 × 1 MB | asks | 32 files = 32 MB |
| K4 | 12M, 20 days × 24 parts = 480 files | asks | 384 files |
| K5 | 15,000 flashes on a phone, 12M | asks | (not separately reported) |

- **Consent lifetime (K6), same as H:** consent resets on a chip change, PREV/NEXT/LATEST and OFF. It persists across the 10-minute refresh.
- **Corrupt index (K9):** zero-count hourly parts are rejected by `vk` (`module-I.js:37`). Feed fallback follows, with no day requests. I found no way to bypass the index pre-check.
- **Not a regression (G, H and I alike):** after consent, a phone may draw up to 40,000 points, clustered (`module-I.js:86` uses BUDGET, not `cap()`).

## Regressions introduced by H or I

**R1 (I, MEDIUM): every 10-minute refresh re-downloads every day file of a long window.**
- K7: 12M with 22 sealed days makes 22 day requests per tick on I, against 0 on G and H.
- Cause: the shard LRU holds 8 entries (`module-I.js:32`, `while(lru.size>8)`).
  - The same churn already existed at 30D in G and H (K7b: 22 per tick).
  - I extends it to 3M, 6M and 12M.
- With a backfilled year, that means up to 400 requests, re-hashing and re-parsing up to 32 MB every 10 minutes on a phone.
- Sealed files use `cache:'default'`, so the browser may answer with 304s. I did not measure this (node has no HTTP cache).
- **Fix (+1 B):** `lru.size>8` → `lru.size>RQ`. Memory stays bounded by the same 40,000-point/32 MB budget, and only sealed entries survive `li()`.

**R2 (I, LOW): the flash card survives a window change that removes its flash.**
- H closed the popup on redraw (`pc()` in `dw`). I removed that call (`module-I.js:134`).
- K8b: open the card, then press PREV. In H the card closes. In I it stays open, with 0 flashes drawn and its NEAREST lines still on the map (K8).
- **Fix (+17 B):** `ld=refresh=>{if(!refresh)pc();…` (`module-I.js:203`). It closes on chip, PREV, NEXT and APPLY, and survives the 10-minute refresh.

**R3 (H, carried into I; MEDIUM): the 22 px hit layer is an `l-` layer, so the neon-links click handler treats it as an engine layer.**
- `sld-sandbox` `interactiveLayerIds` (`cartridges/202609241334-sld-sandbox-v9-8.js:6029-6034`) takes every visible `l-*` style layer.
- A tap within 22 px of a flash now reaches the `!hit` branch (line ~6222: `clearLinks()`, then armed GRID point or scope) instead of `if(!features.length) return`.
  - So whether GRID or scope runs depends on whether the tap lands near a flash.
- Taps near a project or substation also open the Lightning card alongside the engine popup and neon links (H's recorded residual, still present).
- G had the same prefix on the 4–6 px dot layer only, so H made the footprint about 20 times larger.
- **Fix (0 B):** `HIT=LAYER+'-hit'` → `HIT=SRC+'-hit'` (`module-I.js:128`). Optionally, also skip the card when a non-Lightning feature is under the tap.

**R4 (I, LOW): the 3M and 12M headline drops to the loaded count during CDN skew or a failure.**
- data-contract skew sets, 12M: H reads `[≥262 | 12m]` from the index. I reads `[≥98 | 12m]`, the loaded count, while the caption says "262 in index · 98 loaded".
- `lt()` uses `r.ev.length` in detail mode (`module-I.js:182`). This was already true at 30D. I now exposes it on the long windows the owner is comparing.
- **Fix (~+35 B):** `n=r.mode==='overview'?r.arch:r.fl.length?Math.max(r.ic,r.ev.length):r.ev.length`.

**R5 (I, behaviour change, deliberate per I2):** on a phone, an archive window with 10,000–40,000 flashes (e.g. 30D) now asks first. G and H auto-drew it as clusters (K5-30d-phone). This is more conservative, so it needs no fix. It belongs in the owner's change log.

## Why "no lines appear" (I3, owner report 2)

`nr()` (`module-I.js:154-163`) adds the lines but never moves the camera.
- At the national zoom where flashes are tapped, a 5.42 km line is a few pixels long and sits under a card up to 280 px wide.
- The original frames its links with `fitBounds` (cartridge lines 4611 and 8427).
- **Fix (~+95 B):** after `addLayer`, call `m.fitBounds([[min lon,min lat],[max lon,max lat]] of flash+nodes,{padding:60,maxZoom:12})`.

I also differs from the original's behaviour, as a spec gap rather than a regression:
- 3 links at ≥132 kV, where the original draws about 5 at ≥33 kV.
- A Lightning card in place of the original's card bar.

Byte total for R1, R2, R3 and R4 is about +53 B, giving about 33,676 B against the 44,781 B cap. Adding the framing fix gives about 33,771 B. None of these fixes has been applied or tested. After any patch, the lead must regenerate the cartridge, the hashes and the manifest.
