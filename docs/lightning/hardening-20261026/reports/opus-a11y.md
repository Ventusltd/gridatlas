# opus-a11y — issue #32 §5 P07 (keyboard) and P15 (accessibility)

Candidate: SHA fda6b10, generation 202610261949, unmodified, at `hardening/wt` (served on :8153 as `/wt/atlas/v/202610261949/`). Baseline: main c08f3a6, generation 202609241334 (served on :8152 from `/home/claude` as `/gridatlas/atlas/`).
Harness: lead-shim (`lightning/harness/offline-shim.mjs`), Playwright 1.63 Chromium headless, `page.keyboard` for every key press, CDP `Accessibility.getPartialAXTree` and `locator.ariaSnapshot()` for semantics. Viewports: 1440x900 desktop, and 393x852 as Chromium Android emulation (no WebKit; this is not Safari). Lightning data: `fixtures/lightning-archive` (synthetic archive built from the genuine 408-flash seed) and `fixtures/lightning-archive-missing-shard` for the FAIL state.
Evidence folder: `hardening/evidence/opus-a11y/`. It holds the scripts `common.mjs`, `tab-order.mjs`, `cmp.mjs`, `keyboard.mjs`, `a11y.mjs`, `a11y-extra.mjs` and `curtain-tab.mjs`, and every JSON output named below.

## Results

| ID | Verdict | Summary | Evidence | Command (run in evidence/opus-a11y) |
|---|---|---|---|---|
| P07 | **PASS** (one pre-existing note) | With lightning OFF, the original Tab order is identical, forward and reverse, on desktop and phone. Grid ArrowDown starts at `engine:400` on both routes. Escape closes the menu and returns focus to Grid. Enter and Space behave like the original checkboxes. Focus rings are visible. | tab-*.json, keyboard-*.json, grid-menu-tab-*.json, curtain-tab-*.json | `node tab-order.mjs <route> <WxH> off\|on`; `node cmp.mjs tab-baseline-…json tab-candidate-…json`; `node keyboard.mjs <route> <WxH>`; `node curtain-tab.mjs <route>` |
| P15 | **FAIL** (4 defects, none release-blocking alone; ≈82 B to fix) | Period chips have no `aria-pressed`. The custom date inputs have no accessible name. Two lightning text lines have 2.73:1 contrast. The FAIL-state label has 4.25:1. The toggle's role, name and checked state pass. Live-region churn passes. Reduced motion and sound pass. | a11y-*.json, a11y-extra-*.json | `node a11y.mjs <route> <WxH> reduce\|no-preference <fixture> [idleMs]`; `PERIOD=7d OPENMENU=1 TAG=fail-menu node a11y.mjs candidate 1440x900 reduce lightning-archive-missing-shard 3000`; `node a11y-extra.mjs <WxH> <fixture>` |

## 1. Tab order (P07)

Method: from load, press Tab until focus wraps, recording `document.activeElement` (key, name, surface, rect, computed outline) after each press; then press Shift+Tab 40 times.

| Run | Baseline stops | Candidate stops | Candidate minus lightning nodes equals baseline? |
|---|---|---|---|
| 1440x900, lightning OFF | 74 + body | 75 + body | **yes, identical**. Reverse 38: identical |
| 393x852, lightning OFF | 76 + body | 77 + body | **yes, identical**. Reverse 38: identical |

Original order: six menu titles, map canvas, search, GO, [phone: ⚡ Grid, ◉ Subs], 60 engine checkboxes, Dark radio, 3 Pipeline News, `#gridatlas-dash-toggle`.

**Where lightning enters (OFF):** there is exactly one new stop, the Layers-panel checkbox `[data-lightning-control=toggle]`, between **Pipeline News "All pipeline"** and **`#gridatlas-dash-toggle`**. It is position 73 at 1440x900 and position 75 at 393x852. The controls block is `hidden`, the Grid-menu row is inside a closed panel, and the curtain copy is `display:none`, so none of them is focusable.

**Lightning ON** (`tab-candidate-1440x900-on.json`): toggle → nine period chips → ◀ PREV → `#gridatlas-dash-toggle`; disabled LATEST/NEXT and hidden LOAD POINTS are skipped; From, To and APPLY join after CUSTOM only in custom mode.

**Grid dropdown open** (`grid-menu-tab-*.json`): the lightning row is the only extra stop, after **Dark** and before `#fs-curtain-tab`, in viewport at both sizes.

## 2. Keyboard behaviour (P07)

| Check | Baseline | Candidate | Verdict |
|---|---|---|---|
| Tab to Grid, then ArrowDown: first focused item | `input[data-gridatlas-layer-proxy=engine:400]` "400kV [OK]" | same | PASS (unchanged, both viewports) |
| Escape from the first menu item | menu closes, focus on Grid title | same | PASS |
| Escape from the lightning menu row | n/a | menu closes, focus on Grid title | PASS (row is inside `.gm-menu`, so the native handler at substation-intelligence cartridge L4906 applies) |
| Space on the lightning menu row | n/a | ON/OFF; menu stays open; focus kept | PASS (L145) |
| Enter on a checkbox | original 400: no change | lightning toggle: no change | PASS (native checkbox; parity) |
| Space on the Layers-panel toggle | 400 toggles | lightning ON, focus kept on the toggle | PASS |
| Enter or Space on a chip | — | period changes (48h, 7d), focus stays on the chip, `.active` moves | PASS (behaviour); semantics: see P15-1 |
| Enter on ◀ PREV (it becomes `disabled` while loading) | — | focus still on PREV after load; next Tab goes to LATEST | PASS |
| ArrowRight in the chip row; Escape in the panel | — | no effect (plain `role=group`; nothing to close) | PASS |

**Focus visibility** (computed outline): the lightning toggle uses Chromium's `auto` ring like the 60 originals; chips and nav get 1px solid #00ffff (shell `.map-ctrl-btn:focus-visible`, ventusv8.css L144); date inputs get the cyan `.search-input:focus` border; the menu row's `.gm-layer-box` gets 2px solid #6bebff, identical to engine:400. Every stop matches `:focus-visible`. PASS.

**Pre-existing, not a regression:** in fullscreen, `#fs-curtain` lies outside `document.fullscreenElement` (`#map-container`), so the original curtain input 400 cannot take focus on **both** routes (`curtain-tab-*.json`). The curtain copy of lightning is therefore not keyboard-testable; this is a shell issue.

## 3. Lightning control semantics (P15)

Source: CDP AX tree, 1440x900, lightning ON (`a11y-candidate-1440x900-reduce-lightning-archive.json`, `a11y-extra-*.json`).

| Node | Role | Name | State | Verdict |
|---|---|---|---|---|
| Panel toggle (L130) | checkbox | "Lightning flashes (optical) [UNKNOWN \| 24h STALE]" (state suffix follows the original "400kV [OK]" convention) | `checked` true/false tracks | PASS |
| Menu row (L143) | checkbox | "Lightning flashes (optical)" (static `aria-label`) | `checked` tracks | PASS. Advisory A3: originals expose status in the name ("400kV [OK]"); this row does not |
| Period chips (L131) | button | "12H" … "CUSTOM" | **no `aria-pressed`**. The selected period is shown only by the `.active` colour | **FAIL P15-1** |
| Chip container | group | "" (no name) | — | Advisory A1 |
| PREV / LATEST / NEXT | button | names include the ◀ ▶ glyphs | `disabled` exposed | PASS |
| From / To date inputs (L128) | Date | **""**. The visible "From (UTC)" and "To (incl.)" are plain `<span>`s, not labels | after an invalid APPLY, `invalid` stays false and only the border turns red | **FAIL P15-2** (name). aria-invalid is advisory A4 |
| Caption (L135) | status | — | live polite, **atomic true** (implicit for `role=status`), relevant "additions text" | PASS (aria-live present). See §6 |
| Curtain caption copy | ignored (notRendered, `#fs-curtain` is `display:none` outside fullscreen) | — | — | PASS: no duplicate announcement |

## 4. Contrast (P15)

Method: WCAG 2.x luminance; foreground composited with ancestor opacity; background is the composited ancestor chain. The panel resolves to opaque #050505 and the menu to #040a0d, so the missing basemap does not affect the numbers. Threshold 4.5:1 (all text < 18.66px).

**Lightning-owned text** (identical at 1440x900 and 393x852, under both reduce and no-preference):

| Text | fg / bg | Ratio | Verdict |
|---|---|---|---|
| Group title `.key-title` | #66ccff / #050505 | 11.30 | PASS |
| Label (normal) | #ffdf44 / #050505 | 15.42 | PASS |
| **Label in FAIL state, panel** (opacity 0.5, L154) | #827225 / #050505 | **4.25** | **FAIL P15-4** |
| Label in FAIL state, menu (opacity 0.5) | #6a7c82 / #040a0d | 4.56 | PASS (narrow margin) |
| Chips and nav (9px), active chip | #888 / #050505; #00ffff / #051919 | 5.75; 14.45 | PASS |
| Caption lines window…searched (10px) | #888 / #050505 | 5.75 | PASS |
| Caption warning | #ffcc00 / #050505 | 13.48 | PASS |
| **Caption footer** (9px, inline `color:#555`, L136) | #555 / #050505 | **2.73** | **FAIL P15-3** |
| **Status line** "PARTIAL · … · STALE" (8px; shell `.status-dot` color #555, L134) | #555 / #050505 | **2.73** | **FAIL P15-3** |
| Status dot (7px, non-text) | #888 to #ff4444 | ≥ 5.7 | PASS (1.4.11) |

Disabled LATEST/NEXT look identical to enabled ones (exempt from 1.4.3; already overlay-code-review #12).

**Original panel reference (pre-existing, not lightning's to fix):** 13 of the 49 original label colour groups fail 4.5:1. Examples: Eurostar #001489 1.42, Aldi #003087 1.72, Booths #6d2077 2.06, Lidl #0050aa 2.65, 400kV #0054ff 3.60, 66kV #b200ff 4.21. The original menu also uses #555 text (2.67:1); lightning copies that convention, but P15 requires readable contrast on the new control, so it is FAIL.

## 5. Motion and sound (P15)

Test conditions: `reducedMotion: 'reduce'`, with `no-preference` as a control. Init-script hooks counted `AudioContext`, `HTMLMediaElement.play`, `navigator.vibrate` and `speechSynthesis.speak`.

- No transition or animation on any lightning node; `document.getAnimations()` is empty under reduce and no-preference.
- The map layer is a static `circle` layer with no animated paint. With 408 or 1,153 features visible, the map fired **0 `render` events in 10 s** of idle, so there is no repaint loop, pulsing or blinking.
- The status dot changes colour once per load, from grey LOADING to the state colour. That is far below 3 flashes/s.
- Sound: AudioContext 0, play 0, vibrate 0, speech 0, and no `<audio>` or `<video>` elements. PASS.

## 6. Screen-reader churn (P15)

A MutationObserver watched both captions and the label and dot for 30 s of idle with lightning ON. At 1440x900 (24h window) and at 393x852 (7d, 408 points drawn) it recorded **0 caption mutations and 0 label/dot mutations**. PASS.

One user action (Enter on 48H) produced **one** batched caption mutation in 5 s; the LOADING repaint does not touch the caption (L159).

From code (L174), not observed: the 10-minute auto-refresh gives one announcement per 10 min at "latest". Not chatter, but `role=status` implies `aria-atomic=true`, so each announcement re-reads the whole ~600-character caption (advisory A2).

## Minimal fixes (lightning nodes only; byte estimates against the 808 B headroom)

Required to clear P15:

| # | Defect | Overlay line | Change | Bytes |
|---|---|---|---|---|
| F-a | P15-1: chips do not expose the selected state | L156 | after `b.classList.toggle('active',on);` add `b.setAttribute('aria-pressed',on);` (or `b.ariaPressed=on;` at +16 B) | **+34** |
| F-b | P15-2: unnamed date inputs | L128 `DATE` | add ` aria-label="${k} date (UTC)"` to the input | **+29** |
| F-c | P15-3: footer 2.73:1 | L136 | `color:#555` → `color:#888` (5.75:1) | **0** |
| F-d | P15-3: status line 2.73:1 | L134 | `<div class="status-dot">` → `<div class="status-dot" style="color:#888">` (5.75:1) | **+19** |
| F-e | P15-4: FAIL label 4.25:1 | L154 | `opacity='0.5'` → `'0.6'` (≈5.7:1 panel, higher in menu) | **0** |
| | **Total** | | | **+82 B** (+64 with `ariaPressed`) |

Optional (advisory, ≈ +124 B):

| # | Item | Change | Bytes |
|---|---|---|---|
| A1 | Name the chip group | L131 `role="group"` → `role="group" aria-label="Period"` | +20 |
| A2 | Announce only the changed caption lines | L135 add ` aria-atomic="false"` | +20 |
| A3 | Menu-row name carries status, as originals do | in `pt` (L154) set `sf.toggle.setAttribute('aria-label',text)` for the menu row; drop the static one at L143 | ≈ +40 |
| A4 | Mark bad custom dates invalid | L164 `sf.from.ariaInvalid=sf.to.ariaInvalid=!good;` | ≈ +44 |

None of these touch shell CSS, original nodes, the 60+3 contract or the Tab order. F-c and F-e change no bytes.

## What I do not know

- Real screen-reader speech (NVDA, JAWS, VoiceOver, TalkBack): **NOT_TESTED**. These results come from the Chromium AX tree only.
- WebKit and iOS Safari focus behaviour: **BLOCKED_HARNESS**.
- Keyboard access to the curtain copy in fullscreen is **NOT_TESTED**, because the original curtain is not focusable in fullscreen on either route (pre-existing).
- The 10-minute refresh announcement is inferred from code (L174), not observed.

Severity: P15-1, P15-2 and P15-3 are defects; P15-4 is a defect in the FAIL state only. None is a release-blocker by itself, but P15 cannot be PASS until F-a to F-e land.
