# Native Great Grid Journeys

This source is bundled into the additive vicinity module. The module budget is
140,000 bytes for the full station index, explicit place binding, selected-stop
editor, declarative journey law and native learning cursor. The repository's
500 kB global cartridge ceiling is unchanged. No railway dataset, logo, collector,
backend or power-flow solver is introduced.

`station-index.mjs` reads the original loaded `src-subs` FeatureCollection. A
display limit never limits that inventory. Every factual selected stop must
resolve to the canonical source ID and point. The sole scenario exception is a
proposed 11/33 kV customer substation owned by the current session store, under an
explicit hypothetical law. Its existing SLD node symbol is marked “Proposed ·
FEED concept”; it establishes no official station, transformer, connection or
rights. Editing/deleting it advances the plan epoch; an unavailable selected
proposal remains invalid until the user resolves its visit. Journey mode permits 10 selected
stops; vicinity mode permits 90, including both endpoints. Traversal nodes have
their own graph-search bound and are not selected stops. A mode downgrade never
silently removes choices. Non-station generation/demand records stay context.

The gazetteer successor exposes only the existing lookup functions. Resolving a
typed place never selects a station or moves the map. The user chooses a source
station explicitly; the typed label, resolved point/provider and distance remain
attached to that selection. No facility coordinate precision is invented.

The law applies ordered required visits, allowed voltage bands and reviewed
transformer permission before graph search. Reviewed identity joins are required
for production topology; GIS geometry additionally requires the exact reviewed
circuit identity. Missing routes remain missing. Explicit hypothetical fallback
can draw a simulated same-voltage leg, without asserting a cable or transformer.

Play is a user action. There is one owned native cursor, bounded cached neon dash
patterns, optional camera follow and a static reduced-motion path. Rule/stop edits
pause and invalidate the prior animation epoch. Synthetic interchange, long-leg
and branch fixtures use the same planner/controller but stay separate from the
canonical real-station selection.

Run `node --test tools/train/*.test.mjs tools/train/gazetteer/*.test.mjs`.
The generation proof and twin independently rebuild the new gazetteer and module
from their pinned inputs. Published historical cartridges and G2355 remain intact.
