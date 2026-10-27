# kv-card: Lightning flash card rebuilt as the original card bar

Lane kv-card, node only (node:vm + minidom). 27 Oct 2026. Evidence: `hardening/evidence/kv-card/`.

## Verdict

The patch to `fixed-module-I.js` costs **+1,900 B** (33,623 → 35,523 B; gzip 14,314 → 15,088). That leaves 9,258 B of the 44,781 B budget. Results:
- Patched module: **96/96** tests pass. The suite is the Build I suite minus the 3 tests that pinned the old card, plus 8 new K tests.
- Unpatched I: **7 of the 8 K tests fail**, so they are fail-first. K2 is a guard and passes on both.
- ChatGPT suites on the patched module: 8/8 and 6/6.
- No original file or CSS was changed.

## How the original does it (read, not changed)

- **Card bar:** `wt/atlas/cartridges/202609241334-sld-sandbox-v9-8.js:3950-4005` (`addCardBar`): `.grip`, `.label` (the card's `<b>` title, ellipsised: "Botley West, Botley – Botley West Sol…"), `.spacer`, `button.min` and `button.close`, each 44 px. On a phone it docks as a sheet (`dockAsSheet` :3878) and arrives minimised (`resetCardGeometry` :4060-4108).
- **Styles:** the brief's `atlas/cartridges/202609040400-sld-styles.js` does not exist; the file is **`wt/atlas/modules/202609040400-sld-styles.js`**. Bar visuals :57-71; **:75 `.maplibregl-popup.gridatlas-min .maplibregl-popup-content > *:not(.gridatlas-card-bar){display:none !important}`** is the rule that blanked Build H's popup; controls are lifted at :130-140.
- `boundCardToMap` :3901, the card keeper :4268, `popupWatcher` :6059 and the popup fitter :8617 all act only on `.maplibregl-popup`.

## The design (Lightning-owned, inline, no classes or ids)

The card is appended to `map.getContainer()`. That puts it outside MapLibre's canvas container, so taps on it never reach the map's `click` (the same reason MapLibre popups don't).

```
div[data-lightning-card][role=dialog][aria-label="Lightning flash"]
  style: position:absolute;left:8px;right:8px;z-index:21;max-width:480px;margin:0 auto;box-sizing:border-box;
         background:#000;color:#e8f4f5;border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25);
         font:11px/1.45 monospace;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain   (+ bottom, max-height from cpos)
├─ div (bar)  display:flex;align-items:center;gap:6px;padding-left:8px;background:#0a1a1d;border-bottom:1px solid #1d3238
│   ├─ span  flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5fbdc2;font-weight:bold
│   │        "Flash 2026-10-25 11:15:58 UTC"
│   ├─ button[aria-label=Minimise][aria-expanded]  "−"/"+"   ┐ flex:none;width:44px;height:44px;background:#050a0d;
│   └─ button[aria-label=Close]                    "×"       ┘ border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;font:14px/1 monospace
└─ div (body) padding:0 8px 6px
    ├─ details (closed)
    │   ├─ summary  padding:14px 0 13px;line-height:17px (44 px row);color:#bfe9ee
    │   │           "lat 55.164, lon -4.487 · ID 11:10–11:20 #2025"
    │   ├─ div  color:#8b9aa1;font-size:10px;overflow-wrap:anywhere   "Flash ID W_XX-EUMETSAT-…_0000:2025" (full)
    │   └─ div (c.out) margin-top:4px;color:#9fb3ba   nr()'s caveat + "6.85 km · 132 kV · A 132" list
    └─ div  color:#8b9aa1;font-size:10px
            "EUMETSAT optical flash, not a confirmed ground strike. Lines: nearest substations, straight-line; not evidence any asset was hit."
```

- **Bar.** The bar's visuals are copied from the original's `.gridatlas-card-bar` values (sld-styles :57-71), but written inline. It is a copy, not shared: there is no drag, and none of the original's classes are used.
- **Short ID.** `sid()` takes the product sensing window and the flash index from `…_<start14>_<end14>_N__…:<index>`. All 471 IDs in today's `uk_lightning.geojson` match this form. Any other ID is shown as `head12…tail8`, and a missing ID as `(none)`. Everything is set with `textContent`.
- **Height (393 px iPhone, estimated):** about 140 px expanded, 46 px minimised.
- **Placement (`cpos`).** The card is docked at the bottom of the map, never over the menu bar.
  - It rises to 8 px above any visible `.map-controls` (which includes the mobile tray) or `#gridatlas-dash-toggle` whose rectangle overlaps it horizontally. The original's own rule (sld-styles :124-131) says these controls must never sit under a card. Lightning can't restyle them, so the card moves instead.
  - If lifting would not fit, it falls back to `bottom:8px` at z 21, above `.map-controls` (z 20).
  - It is repositioned on map `resize`, not on every `move`.
- **Lines fire on tap (`nf`).** Tapping a flash opens the card and runs `nr()` in the same task, so the lines and the card render in one frame.
  - There is no NEAREST button.
  - If the substation list has not loaded yet, the card says so and retries every 2 s, up to 15 times, only while the same card is open.
- **Framing (`nz`).** If a line end is off-screen, the map runs `fitBounds` on the flash plus the substations. Padding covers the menu bar and the card. `maxZoom` is the current zoom, so it never zooms in. If everything is already visible, the camera does not move.
- **Close and minimise.**
  - × closes the card. An empty-map tap and OFF also close it. Each close removes the card and its lines, as in the original ("the lines belong to the card").
  - − hides the body and leaves the lines in place, like the original's `gridatlas-min`.

## Check against the original's popup-hiding CSS (test K2)

K2 runs the real sld-styles module under vm and reads the CSS of all 7 surfaces (more than 100 selectors). It first confirms that the :75 rule is present.

- **sld-styles.** A rule can reach a card node only if its subject has no class or id and every class or id it names on an ancestor is one the card's real ancestors carry (`html.gridatlas-sheet-open`, `body.fs-active`, `.map-container`, `#map.maplibregl-map`). **Zero sld-styles rules pass that test.** The :75 rule needs a `.maplibregl-popup` ancestor, and the card has none.
- **Shell (`ventusv8.css`).** Only these rules reach the card: `html`, `body` (inheritance only, and the card sets its own font and colours), the scrollbar rules and `*`. The two `input` rules also pass the test, but the card has no inputs. The shell's `.maplibregl-popup-content{background:#000;color:#00ffff}` cannot match.

## Tests (`evidence/kv-card/`)

`make-card.mjs` applies the patch (4 exact anchors, each once) → `fixed-module-I-card.js` (sha256 c2e2d5e0…), `kv-card.diff`. `splice.mjs` builds `test-card.mjs`: the Build I suite without H3/I1, I1 and I3 (they pinned the old card and button), plus `card-tests.part.mjs`. Run: `MODULE=<module> node --test test-card.mjs`.

| Test | What it checks | Patched | Build I |
|---|---|---|---|
| K1 | DOM and inline CSS as above; full ID kept but collapsed; honesty line; no NEAREST button | pass | fail |
| K1b | head…tail fallback; `<img>` in an ID stays text; `(none)` | pass | fail |
| K2 | no class or id on any card node; no sld-styles rule reaches it; shell reach is pinned | pass | pass (guard) |
| K3 | lines drawn on tap (3 lines; 4 layers); list in the details row; close, empty tap and OFF remove them | pass | fail |
| K3b | not-loaded → retry draws within 2 s; a closed card never draws | pass | fail |
| K4 | bottom 148 px above `.map-controls`, 68 px above LAYERS, 8 px fallback; max-height below the menu bar; `resize` not `move` | pass | fail |
| K5 | minimise and restore; aria-expanded; lines stay | pass | fail |
| K6 | fitBounds only when an end is off-screen; padding {40, 38, 40, 40}; maxZoom = current zoom | pass | fail |

Logs: `run-*.log` (about 44 s; K3b uses real timers).

## Not covered or open

1. **Selection.** The owner expects 33 kV and 132 kV, about 5 links; `nr` still picks the 3 nearest at 132 kV and above. That belongs to the kv-elements / kv-lab lanes. The card renders whatever `nr` returns; the only change to `nr` is `return k`.
2. **No browser run.** Unchecked: iOS Safari `details`/`summary` rendering, real pixel heights, and the label layer (BLOCKED_DEPENDENCY under the shim earlier).
3. **Project pixel under a flash.** The original's popup can still open too (z 400) and cover the card; engine click handlers always run by design.
4. **Fullscreen fallback.** At `bottom:8px` the home indicator can overlap the honesty line; the bar stays clear.
