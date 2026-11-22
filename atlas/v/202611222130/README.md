# GridAtlas V9.195 — asset-first Vicinity, no Layout Sandbox

Immutable candidate generation `202611222130`. **The public Atlas pointer remains on V9.194 `202611222000` until acceptance.**

## Owner decision

The unfinished **Layout Sandbox** has been retired from all of GridAtlas; the owner's separate, more capable **GIS SLD Financial Sandbox** remains the specialist design tool. Its files are not touched here. The two tools must not be conflated.

## Implementation and preservation

- The original V9.191 SLD carrier remains byte-identical in `atlas/cartridges/202611161720-sld-sandbox-v9-8.js`.
- `tools/sld/retire-gridatlas-layout.mjs` deterministically derives `atlas/modules/202611222130-sld-without-layout.js` by exact changes: no visible "Lay out a scheme" button, no installed SLD map-click launch or dragging, no mounted panel, both legacy public layout openers return false.
- Crucially, the shared Grid Engine, `gridScope`, nearest-substation links, REPD deep-link receiver, map cards, declared-connection distinctions, fullscreen layer controls and corridor gestures are preserved.
- The Vicinity focus card opens on the clicked PipelineNews project before browsing the up-to-90 nearby substations, REPD and conventional power sites. Details are based on available source records. 5/10/20 km area screening and complete lists remain accessible.
- No Journey module restored; old releases and the canonical live pointer remain unchanged.

## CI/CD acceptance

Required: independent SHA-256 verification of all cartridge bytes; exact generated source comparison to prove no unrelated byte changes or truncation; V9.194 inheritance check; Chromium and WebKit phone-emulated browser checks of active Grid Engine, absent Layout Sandbox, swipe cards, source-backed details, working 5/10/20 km area, Hide Layers and return to ordinary map controls. Preserve screenshots and receipts. Then verify published preview served bytes and perform physical iPhone Safari portrait/landscape checks before a separate release PR.

**Do not merge this draft or update the live pointer until all gates pass and the owner has reviewed the actual served preview.**
