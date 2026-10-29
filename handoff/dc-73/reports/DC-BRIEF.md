# Data-centre programme brief (29 Oct 2026, 19:50 UTC)

The scope and steps are in GitHub issue https://github.com/Ventusltd/gridatlas/issues/73; read it first. The owner approves this work and wants actions, not questions. ChatGPT works the same 10 steps in parallel and posts on #73. Read #73's comments (`gh api repos/Ventusltd/gridatlas/issues/73/comments`) before finishing, and cross-check them.

Background: the owner's fact-check note on the HM Treasury Data Centre Covenant (6 GW by 2030; IT load vs connection) is at /mnt/user-data/attachments/9d39ad54-8b77-5d0b-8e49-a2fb538211db/e9966b13-what-did-claude-think-of-my-thoughts-and-the-covenant.txt.

## State
- Live GridAtlas is 202610291044 (v9.186): lightning M6u plus the Potential offtakers overlay, each in its own cartridge, loaded by loader v2.
- Offtakers source is in tools/offtakers/src; its data is data/offtakers_filtered_*.geojson (1,568 sites, built by evidence/OT-filter/ot_filter.py with R-otdata's corrections).
- Lightning source is in tools/lightning/src (the M6 REPD record join lives in 11b-repd-records.js).
- The PR gate is tools/ci/pr-gate.mjs. Release: docs/RELEASE.md and tools/release/*.
- Reports are in /tmp/claude-0/-home-claude/9d39ad54-8b77-5d0b-8e49-a2fb538211db/scratchpad/hardening/reports/ (OT-*, R-*, PW-design, OT-filter).
- Clones: /home/claude/gridatlas, /home/claude/lightning, /home/claude/globalgrid2050 (SPARSE: never do a full checkout) and /home/claude/data-grid-gb (if present; else add_repo it).

## Rules
- FULLY OPEN data only (OGL v3, CC-BY, CC0, PD, ODbL with attribution). Quote each licence with its URL, and mark "unverified" when unsure.
- Never conflate IT load MW with grid connection MW.
- Honesty: proximity is not connection, capacity or feasibility; a pipeline entry is not a commitment; unknown is not zero.
- Write only under hardening/evidence/DC-<lane>/ and reports/DC-<lane>.md. Put worktrees there, with no node_modules.
- You may push a branch and open a DRAFT PR when your lane says so. Never merge, never touch the live pointer, STATE.md or atlas/index.html.
- Memory: at most 2 Chromium processes in total. Detect them with `pgrep -x chrome` or `pgrep -f 'chrom.*--type=renderer'`, NOT `pgrep -fc chrom`.
- After any `cd`, guard with `|| exit 1`. Never let a failed cd run git in another repo.
- Write the report every 10 minutes. Return a summary of 120 words or fewer, with PR URLs.
- Commit attribution:
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01JcZ2nJ9f9fgHY3X3JTk4DF
- PR bodies end with:
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  https://claude.ai/code/session_01JcZ2nJ9f9fgHY3X3JTk4DF
- Link your PR on issue #73 with a short comment headed "Claude · step N".
