# kv-security: Builds H and I (lightning card, hit layer, nearest substations): security and robustness

Lane kv-security, NODE only (node:vm + minidom.mjs, no browser). Target: `wt/atlas/modules/202610270929-uk-lightning-overlay.js` (33,623 B, identical to `fixed-module-I.js`). Line numbers below refer to that file.
Evidence is in `hardening/evidence/kv-security/`:
- `repro.mjs`: 15 cases. `run-live.txt`: 12 PROVEN on Build I. `run-patched.txt`: 0 proven.
- `build-patch.mjs` → `patched-module-I.js` + `patched-module-I.diff`, with byte costs in `bytes.json`.
- `test-fixes-kv.mjs`: the existing suite with one harness change (see "Regression"). `suite-kv.txt`: I 91/91, patched 91/91.

## Verdict
There is no injection path. Every card string goes through `textContent`: a markup ID made 0 `<img>` elements (C1-markup), and there is no `innerHTML` in the H and I card or nearest code. There is no listener leak (C9). I found 6 robustness defects, two of which work as spoofing vectors. A minimal fix for all six costs **+265 B** (33,888 B, 10,893 B under the 44,781 B budget).

## Findings

**K1. Bidi and zero-width text, and unbounded length, in the card (l.147 flash ID, l.157 substation name).** Severity: low (spoofing).
- C1: an ID containing U+202E (RLO) or U+200B reaches the card line unchanged. A 200,000-char ID gives a 200,009-char line.
- RLO reverses the rest of the line, so a name such as `‮niaga yrt :TRUCK OT NUR` reads as a different instruction. Zero-width characters make two different IDs look the same.
- Real EUMETSAT IDs are 140–143 chars (408 features in `uk_lightning.geojson`), so a 200-char cap loses nothing.
- Fix: `cs=v=>(v+'').replace(/\p{Cf}/gu,'').slice(0,200)` used for the ID and the name. **+57 B**

**K2. An ID that is an object throws inside the map click handler (l.69 `ok`, thrown at l.147).** Severity: medium (robustness).
- C2: feed `"id":{"toString":1}` passes `ok()`, then `'Flash ID '+g.id` throws "Cannot convert object to primitive value".
- No card opens. A `click` listener registered after Lightning's did **not run** (`later click listener ran: 0`). MapLibre 3.6.2 `Evented.fire` loops its listeners without try/catch, so a throw skips the rest.
- GeoJSON ids are string or number. Fix: reject the feature as malformed in `ok()` with `&&!(f.id instanceof Object)`. It is then counted as "malformed records rejected". **+27 B**

**K3. NaN in the positioning maths (l.131 `cpos`).** Severity: low.
- Opening a card under a NaN projection is already safe: the tap loop's `d<dm` stays false, so no card opens.
- C3: once a card is open, a `move` that projects NaN writes `left:NaNpx; top:NaNpx`. A browser drops those values and the card stays stuck at its old place, detached from the flash.
- With MapLibre 3.6.2 (Mercator, coordinates already range-checked by `bx`) this is theoretical, but the guard costs little.
- Fix: `if(!isFinite(p.x+p.y))return;` **+35 B**

**K4. Hit layer: a stale rendered index opens the wrong flash (l.206 `properties:{i}`, l.145).** Severity: medium (wrong data shown).
- The only property Lightning puts on a hit feature is `{i}`, an index into `S.res.ev`. Untrusted feed properties never reach `queryRenderedFeatures`, so that path is good.
- `S.res` is replaced synchronously, but `setData` re-tiles in a worker. Between the two, MapLibre still returns the old tile's features.
- C4: tapping the old flash at −0.25, 51.95 opened a card for **"NEW-in-Cornwall, lat 50.200, lon −5.000"**. The nearest-pick (l.143) also measures distance from the new flash's coordinates.
- The 10-minute auto-refresh and every period or arrow change open this window.
- Fix: tag each load with `properties:{i,s:serial}` and `r.s=serial`, and accept a hit only when `p.s===S.res.s`. A stale tap then opens nothing, and the next tap after re-render works. **+35 B**

**K5. `__GRIDATLAS_NEON_LINKS__` read through the prototype chain (l.154).** Severity: medium (data injection without code execution).
- `link.substations` is **not an own property** until `loadSubstations()` resolves (cartridge l.3503). If that fetch fails, it is never set.
- Before then, `L.substations` resolves to `Object.prototype.substations`. A data-only prototype pollution, such as a deep-merge of URL or JSON input, is enough. It needs no function, because the real `link.measure.distanceKm` is an own property.
- C8: the polluted substation was **listed and a neon line drawn to it**.
- The fallback `window.__GRIDATLAS_SUBSTATIONS__` is **never assigned anywhere in `atlas/`** (grep), and it also resolves through the prototype (C8b).
- C6: `substations` set to a string or an array-like object throws "subs.filter is not a function".
- C7: when `distanceKm` returns a numeric string, the global `isFinite` coerces it, and `.toFixed` then throws (l.157). This happens after `nc()` has already removed the previous lines, so the card is left with only the disclaimer.
- Fix: `subs=Object.hasOwn(L,'substations')?L.substations:[]` (this drops the dead fallback), add `Array.isArray(subs)&&` to the check, and change to `km:+dk(…)`. **+19 B**

**K6. Any other throw in NEAREST escapes and gives no user feedback (l.163 `near`).** Severity: medium.
- C5: a getter that throws on `substations` raised "getter boom" out of the button listener. The card showed nothing, and the **previous lines stayed on the map** while the card text no longer matched them.
- Fix: `try{nr(…)}catch(e){note('nearest: '+msg(e));nc();c.out.textContent='Substation data unavailable.'}` **+92 B**

## Checked and sound
- **Time strings (C10):** RLO, ZWSP, a 500 kB trailing-digit string, and `'T'+'1'×500k+'x'` are all rejected as malformed. The card time is rebuilt from `Date.parse` and `toISOString`, so it cannot carry text. `/T[\d:.]+$/` is linear (50 ms for 1 MB).
- **Memory (C9):** 1,000 open → NEAREST → move → × cycles plus 100 OFF/ON cycles. Map listeners stayed at 3 (`click, move, moveend`), and the `S.ck` guard binds them once. No card nodes or nearest sources were left behind, with 0 errors.
  - `pc()` removes the card and calls `nc()`. Card closures become unreachable once `S.pp=null`.
  - Note: these 3 listeners are never removed on OFF (they return early, which is cheap). `S.ck` also means a replaced `__GRIDATLAS_V9_MAP__` instance would never get them. That is not a leak and is outside H and I.
- **Card on the map container:** the card is a sibling of MapLibre's canvas container, so taps on the card do not reach the map's `click`.
- **Not fixed here (functional):** if the substation fetch fails, "try again in a moment" never succeeds, because Lightning has no public loader to call.

## Byte cost (UTF-8, from `bytes.json`)
| Fix | Bytes |
|---|---|
| K1 | +57 |
| K2 | +27 |
| K3 | +35 |
| K4 | +35 |
| K5 | +19 |
| K6 | +92 |
| **Total** | **+265** (33,623 → 33,888 B) |

If bytes are tight, K4, K5 and K6 matter most (+146 B).

## Regression
- The patched module passes the existing 91 tests once the harness's synthetic hits carry the source's own `s` tag, as MapLibre would return it.
- Without that harness change, 4 card tests (H3/I1, I1, I3, I1b) fail. They do not fail because of a behaviour change: they build hits as `{properties:{i}}` by hand.
- The only other edit in `test-fixes-kv.mjs` is the path to `fixed-module-F.js`.

## Reproduce
```
cd hardening/evidence/kv-security
node repro.mjs                                  # Build I: 12 PROVEN
node build-patch.mjs                            # writes patched-module-I.js, bytes.json
MODULE=$PWD/patched-module-I.js node repro.mjs  # 0 proven
MODULE=$PWD/patched-module-I.js node --test test-fixes-kv.mjs   # 91/91
```
