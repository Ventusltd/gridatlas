# Lens: the Atlas ↔ See Through bridge

The evidence is in `hardening/evidence/opus-memos-2/`:
- `lightning-link.v1.mjs`: a design prototype, not wired into any product.
- `lightning-link.proof.mjs`: a static, self-fixture node proof. It passed 34/34 at worktree 4fad8e7 and again on 26 Oct at 35fbceb (`*.rerun-*.txt`).

The browser half is **NOT_TESTED**.

## The owner's position

The owner endorsed **"standalone public page now, link later"**. That endorsement is **not approval to build**: issue #32 §10 requires separate approval for any new product. No See Through receiver exists today; the prototype marks it `exists:false`.

## The contract, `lightning-window.v1`

| Key | Meaning |
|---|---|
| `lightning` | The period: `12h 24h 48h 7d 30d 3m 6m 12m custom`, exactly the `history-window.mjs` PERIODS (A4) |
| `lightning_end` | A UTC instant ending in `Z`, the exclusive end of `[start,end)` |
| `lightning_start` | Used for `custom` only |
| `lightning_lon`, `lightning_lat` | The view centre to 3 decimals, sent only as a pair |
| `lightning_zoom` | Capped at 10, which matches the instrument's location error of roughly 10 km |

All keys share one `lightning*` namespace (A3) and stay outside `deeplink/contract.js` PARAMS, so existing project links are unchanged (A1, A2). A key is never repurposed; a new meaning gets a new key.

**The parameters travel in the fragment**, because both receivers can carry it:
- See Through's stable route forwards only the hash (`see-through/index.html:12`).
- No original GridAtlas script reads the hash (B1), and the map has no MapLibre `hash` option (B2).
- The root redirect keeps the fragment (B3).

A lightning link therefore reaches the live Atlas as a plain visit (B5).

**Rules the proof enforces:**
- "Latest" never crosses the bridge. A link without an end is refused (F1), and an end without `Z` is never guessed (F2).
- Unknown periods are reported, never coerced (F3).
- Derived starts match `selectUtcWindow` in 64 cases covering month ends, leap day, DST and new year (F4).
- A window may span at most one calendar year (F6). A future end is clamped with a visible note (F7).
- Half a coordinate pair is dropped (G1). Null Island is refused (G2). A view outside the box is flagged (G4).
- **The receiver only pre-selects. Switching ON stays a user gesture.** It never writes the address, because sld-sandbox cancels a pending arrival on `hashchange` (`202609241334-sld-sandbox-v9-8.js:3474`, B6).
- A project or interconnector arrival never shares a URL with a window (B8).

**Round trip (E2):** Atlas → See Through → Atlas returns the same window and view.

## Status

- **It does not fit the Atlas cartridge now.** The headroom is 808 B. The emitter is about 807 B and the receiver about 1,047 B (H4).
- **Approval comes first.** Either direction requires a new candidate generation, a byte-budget decision and owner approval.
- **See Through cannot receive a link yet.** Generation 202610050609 reads no URL state (D2), and its `ATLAS_URL` (`descent.js:35`) is unused (D3). The retired link would arrive in the Atlas as a false "Deep-linked project" (C1).

## Never implant into the Atlas

H1 confirms none of the following is in the candidate today. They reach the Atlas only as a link:
- star field, Kuiper placement, descent, 3D, terrain, pylons, audio;
- a second MapLibre (Atlas 3.6.2 vs See Through 4.7.1, H2);
- CERN-OHL-S v2 code in the Apache-2.0 Atlas (H3);
- a typed GL layer or binary reader;
- code that writes `location.hash`, switches lightning ON from a link, or carries "latest";
- any flash-to-asset, flash-to-fault or "nearest flash" relation.

## Unknowns

- Real navigation through the Pages redirect with a fragment, including iOS Safari.
- Whether kuiper-belt Pages permits cross-origin archive reads.

## Recommendations

1. Freeze `lightning-window.v1` beside `contract.js`, not inside it, with the 34-check proof as its gate.
2. Build nothing until the standalone page is separately approved. Then build the See Through receiver first, because it costs the Atlas zero bytes.
3. Add the Atlas emitter only in a later approved generation with its own budget. Never add the receiver to the current cartridge.

**Would change my mind:** evidence that users need to send exact windows back from See Through into the Atlas. A receiver would then earn its own cartridge budget.
