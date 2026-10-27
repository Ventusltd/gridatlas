# Lens: cvaa governance, or what "disrespected" means in the record

Paths: CV = /home/claude/ventusltd/cvaa (HEAD 877bf38); KB = /home/claude/ventusltd/kuiper-belt (d5fec2c); ST = KB/see-through/202610050609; GG = /home/claude/ventusltd/globalgrid2050; GA = /home/claude/gridatlas; EV = scratchpad/hardening/evidence/opus-memos-3 (see LABELS.txt).

## The record
- **Never named.** "See Through" appears nowhere in cvaa. The diary links Learn the Kuiper "without declaring a new vaccine or certifying an application release" (CV/reports/DIARY-20261005-learn-the-kuiper.md:13).
- **Not attached.** kuiper-belt has no inoculate workflow and no `.cvaa/`. Its own CI parses root pages only (KB/tools/ci_check.py:68-71). GridAtlas runs cvaa in one path-triggered workflow, pinned to d2ebc01 (30 Aug), gating four vaccines (GA/.github/workflows/202608301321-verify-live.yml:7-12,30,117).
- **Not flagged.** A full-history run finds nothing under see-through/ (EV/run-kb-head.json), because the antibodies cannot see it.
- **Listed, under another name.** The pinned owner catalogue (globalgrid2050-homepage 4a35572, sha256 36edfd10… as pinned in GG/catalogue/homepage-owner.json:3,8) lists `see-through` under Kuiper. The title is "See to grid connection probabilities iteratively", and the description says "no connection probability is calculated today" (EV/net/pinned-homepage.json:87-101). The brief and three memos read a stale committed copy (GG/homepage-shell/data/homepage.json, sha256 49364588…), which the deploy overwrites (GG/scripts/import_homepage_owner.py:44-47). I could not observe the live page (proxy 403).
- **cvaa can certify nothing today.** HEAD has failed closed against itself since ade4688 (26 Sep). observed-before-asserted declares dose `every-live-mutation` (CV/vaccines/202609261425-observed-before-asserted.md:4), which is outside DOSES (CV/inoculate.mjs:22,55), and the file is missing from vaccines.lock. At the last loadable commit, cvaa's own allowlists expired on 30 Sep (CV/cvaa.json:7,12).

So "disrespected" means unseen: uncertified, unattached, unnamed, and catalogued under a title that overclaims.

## The five vaccines against See Through
Run: cvaa HEAD minus the unloadable file (a labelled copy) against kuiper-belt (EV/run-kb-head.txt). Four of the five diseases are present; no antibody sees them.
- **no-app-copies:** immune, but it matches only root `<12 digits>-name-vN` folders (vaccine :15). Present: three 3.08 MB dated copies; grid-data.js ×10, kuiper-law.js ×13.
- **release-name-convention:** immune, but it reads only `name:"…"` in the root index.html (vaccine :15,19). The disease is the catalogue title.
- **monotonic-utc-generations:** immune, but it reads only 12-digit commit-subject prefixes (CV/inoculate.mjs:251). 202610050609 was committed at 05:09:57Z (d303932): a BST stamp beside the catalogue's UTC `published_at`.
- **observed-before-asserted:** cannot load. No live receipt exists.
- **star-grammar:** applies only to Star folders. ST has no `Math.random`.

The cells claim regex (CV/inoculate.mjs:182) scans pages at most one level deep, with scripts stripped (:183-185). Every See Through word is injected by descent.js, and the dated page sits two levels deep. The trillion-loop scan ran out of its 4 MB budget before reading any See Through script (EV/scripts/walk-replica.mjs).

The dated folder, "kept unchanged" (KB/see-through/README.md:25), was edited three times after publication, last by 8e24d1f, after the catalogue's source_ref 613b10f.

## What GridAtlas-grade means here
GridAtlas's discipline is mostly its own loop.mjs: immutable releases with checksums, one pointer, hashed cartridges and a generated STATE.md (GA/tools/scope/loop.mjs:150-205,236-255). For See Through:
1. **Ledger:** `see-through/releases/<UTC gen>/` with sha256sums.txt and a generated pointer. The three BST folders are frozen and annotated, not renamed.
2. **Stamp:** `date -u +%Y%m%d%H%M` (verify-live.yml:64), used as both folder name and commit-subject prefix.
3. **Proof:** a live browser receipt built from `window.__errors` (ST/index.html:21) and `window.__descent.state()` (ST/descent.js:1034-1051), filed as `.cvaa/contracts/observed-before-asserted.json`.
4. **Catalogue:** the title "See Through", a 12-digit release id and the source_ref of the served bytes, edited in globalgrid2050-homepage (GG/AGENTS.md:15-17).

pointer-verifies sees only root pointers and atlas/releases (CV/inoculate.mjs:116,126). Nested products therefore need antibodies that read contracts (:85-91).

## Born respected
A lightning explorer starts inside that ledger:
- a UTC generation, sha256sums, and no edits after publication;
- honesty lines in static HTML, where the scan reads;
- `.cvaa/contracts/` holding a live receipt and the lexicon;
- the consumer workflow pinned to a cvaa commit that loads (CV/consumer-workflow-template.yml:16-18);
- an immunisation record (CV/202609211457-immunisation-records.md:17);
- a catalogue entry marked "In development" until its receipt exists.

## Recommendations
1. Repair cvaa first: give observed-before-asserted a valid dose and lock entry, and decide on the expired allowlists.
2. Give See Through a UTC ledger, one live receipt and its real name before any lightning work.
3. Extend those three antibodies to nested products and catalogue JSON, using See Through as the diseased fixture.

**Would change my mind:** the served globalgrid2050.com catalogue lacking `see-through`. "Not listed" would then be literally true, and the first fix would be a redeploy, not a ledger.
