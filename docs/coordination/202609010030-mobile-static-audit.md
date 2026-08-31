# GridAtlas mobile static audit - 202609010030

This is a source-level audit of the current immutable shell plus Claude's
`202608312324` v9.34 SLD cartridge. It does not replace Claude's iPhone and
Chrome checks. It identifies failures that do not require rendering to prove.

## Viewport rule matrix

| Viewport | Shell rule | Cartridge rule | Consequence |
|---|---|---|---|
| 390 x 844 portrait | `max-width:480` | `max-width:700` | one-column layer keys; measure/poly text wraps; SLD panel becomes `left:14px; right:14px; top:96px` |
| 414 x 896 portrait | `max-width:480` | `max-width:700` | same as 390 portrait |
| 844 x 390 landscape | `max-height:600` only | none | shell shrinks header/key text and caps SCADA at 28vh; SLD stays 310px wide at `top:112px` |

The shell correctly declares `height:100vh; height:100dvh`; supporting browsers
therefore use the dynamic viewport. The failures below remain with either unit.

## Stop-ship findings

1. **The claimed moving interactions are mouse-only.** The project card and SLD
   panel start on DOM `mousedown`; array movement, rotation and route-pin
   movement start on MapLibre `mousedown`. There is no `pointerdown` or
   `touchstart` path. On an iPhone the layout can be visible while the named
   move/rotate/route capabilities cannot begin. Use one Pointer Events path
   where the DOM owns the surface; for map features add an explicit touch path
   that coordinates with `dragPan`, and set `touch-action` on grips only.

2. **The SLD panel's height is algebraically outside its container.** Its cap is
   `calc(100% - 28px)`, but it starts at 112px (96px under the phone rule).
   Therefore its bottom is 84px beyond the map normally and 68px beyond it on
   portrait mobile, before borders or padding. The parent map clips overflow,
   so scrolling the panel does not reveal the clipped part. Give the panel a
   real bottom inset, or make the cap subtract top plus bottom.

3. **Core panel controls are below a compact touch target.** Card controls are
   26 x 22px minimum and SLD controls 24 x 20px. Height is below 24px, never
   mind a comfortable 44px phone target. This particularly affects minimise
   and close, the controls needed to recover map space.

4. **Landscape control stack is unbounded.** Six shell map buttons and the
   injected GB conditions control remain a fixed bottom-left column. The
   short-height rule does not collapse, wrap or scroll it. At 390px total
   viewport height, the map also shares space with the header and SCADA panel;
   the source provides no bound that can keep the stack inside the map.

5. **Landscape search results are clipped by construction on a short map.** The
   search wrapper begins 72px from the map top; results begin another 36px down
   and allow 220px height, an extent of 328px. There is no short-height rule,
   while `.map-container` clips overflow.

6. **Free-card horizontal clamping does not measure the card.** It clamps the
   left edge to `innerWidth - 60`, so most of a 220-300px card can remain beyond
   the right edge after a drag. Clamp against the measured card width and the
   map rectangle.

## Gate

Run:

```text
node tools/proofs/202609010030-mobile-static.audit.mjs --require-clean <sld-cartridge> <ventusv8.css> <shell-index.html>
```

The gate carries a diseased fixture that fires and a repaired fixture that is
silent. Claude owns visible verification in portrait and landscape after these
source failures are repaired.
