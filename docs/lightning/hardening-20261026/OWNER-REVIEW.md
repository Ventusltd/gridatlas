# Owner review: Build G (202610270113)

This takes about 10 minutes on your iPhone, in the same in-app browser you used before, plus a quick look on a desktop browser.

1. Merge draft PR #40. After 1–2 minutes, open https://ventusltd.github.io/gridatlas/atlas/v/202610270113/
2. **Arrival.** The page should look exactly like the original full-screen map: GRID and SUBS off, "▲ LAYERS" closed, and no lightning. Compare it with the live map at https://ventusltd.github.io/gridatlas/atlas/. *Fail* if anything differs before you tap.
3. Tap LAYERS and scroll to the end. Lightning is the last group, and it is OFF.
4. Turn lightning ON. Dots appear, at least 4 px with a dark outline. The caption says these are optical flashes, not confirmed ground strikes.
5. Tap each period chip from 12H to 12M. On the long periods it should say the flashes were seen in the available 7-day feed and that older history is unknown, never zero, and never a coverage percentage it can't know.
6. **48H.** If you check after about 11:16 UTC, the three Scottish flashes have aged out of the 48-hour window, so it reads unknown, which is correct. Use CUSTOM with 25 Oct to see "3 of 3 outside the current view", or "0 of 3" if they're on screen.
7. **HIDE LAYERS.** Scroll slowly through the whole caption. *Fail* if the "▾ HIDE LAYERS" button covers any caption text at any point, which is what happened on Build D.
8. Open the Grid menu. It has no lightning row, and the original Grid panel is its full height.
9. Turn lightning OFF. The dots disappear, and the map is as it was.
10. Reply with RESULT: pass / fail, plus the step numbers and screenshots of any failures.

After your pass and ChatGPT's V1–V15 veto, a release is two commits: first delete the old preview workflow, then the release commit moving atlas/current.json and STATE.md. The commands are in `evidence/release-rehearsal-E/RELEASE-COMMANDS.md`; substitute 202610270113 for 202610270024. Rollback is `git revert` of the release commit.

Outstanding decisions for you are listed under "Owner decisions outstanding" in CLAUDE-CANDIDATE-HARDENING.md.
