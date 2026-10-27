# GridAtlas v9.35 mobile pointer handoff

Generation: `202609010021`

Branch: `codex/202609010018-mobile-pointer`

Handoff: `H-GA-MOBILE-202609010020`

Codex performed no browser, network, push or deployment action. Claude owns
the live acceptance and must write its receipt to the canonical Pipeline News
coordination board.

## What changed

- Project-card and layout-panel drags use Pointer Events and pointer capture.
  The panel no longer adds document-wide mouse listeners every time its
  contents redraw.
- Array movement, rotation and cable-route vertex movement share explicit
  MapLibre mouse and touch paths. Pointer cancellation releases an interrupted
  edit. Map pan and touch gestures are restored only if they were enabled when
  the edit began.
- The full card width is clamped to the map. The SLD panel uses top and bottom
  insets, not an overflowing `top + max-height`. The landscape control stack
  scrolls and search results are bounded inside a short viewport.
- Primary card/panel controls are 44 CSS pixels. Coarse-pointer shell buttons,
  inputs and sandbox controls receive the same minimum height.
- The electrical summary no longer labels array/export as `DC/AC`. It shows
  Array DC, Inverter AC, Export limit, Design DC/AC, DC/export and
  Inverter/export separately. A mismatch between entered and derived DC/AC is
  descriptive and never rewrites an input or grades the design.

## Local evidence

- SLD proof: `374/374`.
- Independent mobile audit: disease fixture fires; healthy fixture silent;
  candidate `CLEAN` at source-rule matrices for 390x844, 414x896 and 844x390.
- Composition verifier: `PASS`, generation `202609010021`, eight immutable
  releases, three ordered cartridges.
- Current-cartridge runner: every composed cartridge carrying a proof passed.
- Scope lint/state and LF diff checks: `PASS`.
- Cartridge SHA-256:
  `9ecfabf53d577c35e60399cdd656061f7058d3af96304a8047d2881752167b16`.

The optional `verify-live.mjs` was not run here: this worktree has no installed
Playwright package, and Vikram assigned all browser work to Claude. This is not
substituted by a simulated claim.

## Claude acceptance matrix

Use the Pipeline News MAP link first, not only a bare Atlas URL. At each mobile
viewport test an onshore project and a BESS project; test offshore separately
to confirm that it opens a card but draws no misleading onshore link.

1. 390x844 portrait: open project card, minimise/restore, drag to every edge,
   open the layout, scroll every electrical row, change AC/DC basis, move the
   array, rotate it, add/move/remove a cable vertex, close and reopen.
2. 414x896 portrait: repeat the arrival and all touch operations; confirm the
   control and search stacks do not cover the action buttons.
3. 844x390 landscape: repeat with search results open and the left control
   stack expanded; both must remain contained and scrollable.
4. Desktop regression: mouse drag still works for the card, panel, array,
   rotation handle and route pins; map pan/zoom returns after every release.
5. Maths text: the panel must show the six named quantities and the original
   string/central inputs. It must not contain `outside the usual`, `unusual for
   solar`, or an automatic string-count reconciliation.

Receipt is `TESTED` only when all four interaction matrices pass visibly and
the browser console has no exception loop. Otherwise write `BLOCKED` with the
viewport, exact action and first exception.
