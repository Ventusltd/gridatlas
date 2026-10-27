# parity-harness.mjs — visual-challenge-B copy (issue #32 Step B)

Copied from PR #31 `evidence/visual-parity/parity-harness.mjs` (scratchpad path
`lightning/evidence/atlas-visual-parity/parity-harness.mjs`, sha256 `0317604252c4a299d4ef847f56fad84a83868dfe797878535bf0847a0635fd55`,
recorded in `00-harness-copy-provenance.txt`). The original file was never mutated. Exact delta: `parity-harness.diff`.

Changes (all additive to the measurement, none to the wait strategy, the click/tap discipline or the pixel comparator):
1. `DEFAULT_SHIM` is the lead's shim by absolute path (the relative `../../harness/` path does not resolve from this folder).
2. Two desktop profiles added for the P10 clipping diagnosis: `desktop-1280x720`, `desktop-1920x1080`.
3. Masks: the PR #31 harness also masked the trailing `[...]` live-count suffix of every layer label. Issue §5 P11 lists only
   clock/DAYS, map canvas and the lightning-owned additive group, so the suffix mask is now OFF unless `--suffix-mask` is passed.
   Primary run = no suffix mask. The mask counts actually applied are printed per cell.
4. Readiness: waits for `__GRIDATLAS_MODULES__.ukLightning.state.installed === true` on the candidate (absent on the original = pass through).
5. Surfaces: a surface selector never resolves to a node inside the additive subtree (`[data-lightning-group]`), because the
   overlay reuses shell class names (`.status-legend`, `.key-item`, `.status-dot`) inside its own group. Inventory gains a
   `lightning` count. Surface diffs are classified `original` vs `additive-host` (childCount/inventory/text/count of the three
   host containers `#scada-ui-container`, `#fs-curtain-keys`, `#gridatlas-menu-bar-panel-4`); only `original` diffs fail a cell.
6. Per-state extras (`<state>.extras.json`): EVERY element in `document.body` in DOM order (lightning subtrees excluded) with
   `getBoundingClientRect` and 11 computed styles; scroll areas (scrollHeight/clientHeight/scrollWidth/overflow) of the panel,
   its body, the Layers container, the curtain and the map container; original hit targets (`elementFromPoint` at the centre
   must be the element itself or a descendant — "visible row" means inside the viewport AND inside every overflow-clipping
   ancestor); the candidate's own toggles hit-tested separately (P14); the `<style>` list (index, id, bytes, FNV-1a) and
   `<link rel=stylesheet>` hrefs. `diffExtras` aligns elements by index+signature; host containers that only GROW in height
   (appended group at the end) are listed as additive-host growth; controls occluded on BOTH routes whose occluder differs are
   listed as occluder-changed; both are reported but do not fail the cell. The pass bar per cell is: pixel <= threshold AND
   0 original surface diffs AND 0 moved elements AND 0 style changes AND 0 hit-target regressions AND identical `<style>` lists.
7. Fullscreen curtain: `#fs-curtain-tab` is clicked ONLY when `elementFromPoint` at its centre resolves to the tab (a real
   pointer could hit it). Otherwise Playwright would scroll `overflow:hidden` ancestors programmatically; that case is recorded
   as UNREACHABLE with the occluder named. The phone LAYERS toggle gets the same pre-check.
8. SUMMARY.md gains columns (changed px, elements, moved, styleΔ, hitΔ, scrollΔ, styles-equal, masks applied) and sections for
   every-element/scroll/hit differences, pre-existing not-self hit targets (identical on both routes), additive nodes and
   lightning toggle hit tests per state.
