# Owner device observation — 26 Oct 2026 22:44 UTC

- Harness: LIVE (owner's iPhone, Safari, GitHub Pages `ventusltd.github.io`, route `/gridatlas/atlas/v/202610261949/` published by main 3c5717e). The first real-device and real-network receipt in this work. Partial evidence for Step E and R07.
- Observed: lightning ON at 7D. The label reads `[408 | 7d]`. Status is PARTIAL with "408 flashes drawn · searched 2%". The window shows 2026-10-19 22:44 → 2026-10-26 22:44 UTC. Actual first and last detections are 2026-10-21 12:32:19 and 2026-10-25 11:15:58 UTC. The flashes line reads "408 in window (live feed, 7-day retention) · 408 drawn as points (… within the 10,000 … phone)". 408 points render over the basemap on the real raw.githubusercontent.com feed, so the XHR fallback works live on iOS WebKit.
- Defects visible on device (to reproduce in the sandbox, then fix):
  1. Owner report: "doesn't work at 12 months, gets stuck at 7 days". The 30D–12M chips render dimmed or disabled in feed-fallback mode with no explanation at the chip. They should respond and state plainly that the archive is not yet published and earlier coverage is UNKNOWN, not zero (D05/D06).
  2. "Searched 2%" in feed mode is misleading. Feed metadata carries only the last 3-hour query window, so feed-mode coverage is unknown rather than 2% (overlay review defect 5, D13).
  3. The pre-existing sld-sandbox "▾ HIDE LAYERS" fixed button covers the end of the last panel group, here the lightning caption lines. The original button overlaps whatever group is last (UX lane finding 10), but the caption text is now the occluded content (P14).
- Not observed here: Grid dropdown, OFF parity, reload. The owner should follow reports/opus-step-e-procedure.md when it lands.
