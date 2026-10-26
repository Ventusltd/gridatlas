# Lens: proofs from the first commit

## What to copy
- **ventus-grid-engine/verify.mjs** runs each proof in its own child process (:41-54), fails on an empty set (:31-36), and runs before any publish (verify.yml). Each check is a plain sentence (geodesy.proof.mjs:4-6). Run here: "verify PASS — 22 proofs, 561 checks".
- **GridAtlas run-current.mjs** treats a missing generation-matched proof as failure (:10-12, 37-40).
- **cvaa inoculate.mjs** runs antibodies on a data-only snapshot with no network or filesystem (:260-291); a skip is never immune (:400-404).

## Holes found
1. verify.mjs counts only output matching `PASS — N checks` (:49). Two proofs print "20/20" and "8/8", so the real total is 589, not 561. A proof that exits 0 after zero checks also passes. A lightning verify should fail on a missing terminal sentence or N = 0.
2. **cvaa cannot run.** On main (877bf38), `node inoculate.mjs <dir> --no-write` exits 1 with REGISTRY INVALID: observed-before-asserted.md has dose `every-live-mutation` and is missing from vaccines.lock. Any honesty vaccine waits on that fix.
3. **The archive commits unverified.** update-lightning.yml:99-110 commits data/history `if: always()` with no `history.py verify` after ingest (:75-84). verify_archive (history.py:575) checks only bytes and sha256, and skips each check when its field is absent (:282, :284). It never compares a shard's feature count with its row.
4. **Presence is not display.** The candidate proof asserts that "not confirmed ground strikes" is in the module, not that it reaches the screen.
5. **Missing becomes zero.** cvaa trillion-loop flags overlay:80 and history-window.mjs:421 (`count+=t.count||0`). Both are budget sums: a split-day part without a count is under-budgeted.

## The proof set (every proof carries a planted fault it must catch: "an unexercised gate is a decoration", cvaa trillion-loop D4)
- **Data** (Python and Node, offline, run on every index before commit): coverage/count rules, digests, Σ parts, bounds, slot membership, no synthetic points outside fixtures.
- **Placement:** key-space keyed by UTC slot only; the fall stops at instrument resolution; no site names.
- **Rendering:** circle geometry only; caps chosen from index counts; sampling by flash id, never `Math.random`; one MapLibre per document, with its version asserted; `prefers-reduced-motion` honoured (absent today in descent/see3d/model/pf).
- **Honesty:** a forbidden-word lexicon applied to every template; runtime receipts per screen, state and viewport recording the rendered text.

## Harness policy
- **Sandbox:** offline shim, labelled fixtures, Chromium emulation ("not iPhone Safari").
- **Device:** a real Android Chrome or iPhone Safari receipt, recording the browser version, URL, commit, sha256 of the served bytes and `physical_android` (precedent: tools/proofs/receipts/202609241251-local-controls.json).
- **Live:** "live" only with a runtime receipt from the deployed identity (observed-before-asserted).
- BLOCKED stays BLOCKED; a sandbox result is never quoted as a device result.

## The first ten sentences
```
ok  a never-searched day has count null; count 0 appears only where scanned_seconds > 0
ok  every shard and hourly part matches its row's bytes and sha256; a row missing either is refused
ok  each shard holds exactly its row's count, and a split day's parts sum to it
ok  every flash is finite and inside -11..3 E, 49.5..61.5 N; a planted out-of-box flash is quarantined, not drawn
ok  every flash time lies in its UTC date and in an examined 10-minute slot
ok  key-space places by UTC slot and rank only: moving every flash 1 degree east moves no star; ten minutes later moves its star
ok  the fall stops where one Lightning Imager pixel (>= 4.5 km) fills the porthole, and no flash carries a substation name
ok  the observation source feeds circle layers only, so no bolt, line or symbol geometry is built from a flash
ok  with 40,001 flashes, a desktop draws 40,000 and a phone 10,000 by flash-id rule, and the caption says "N of M drawn"
ok  every screen shows: optical flashes, not ground strikes; 70-95 % detection; searched H of T; unknown, not zero; UTC; a planted "strike" fails
```

## Recommendations
1. Copy verify.mjs, adding a zero-check guard and planted faults.
2. Put `history.py verify` and the count and coverage checks before the archive commit.
3. Fix cvaa's registry before relying on any lightning honesty vaccine.

**Would change my mind:** device receipts showing that sandbox results predict real-phone results within stated bounds. Fewer device runs, never none before release.
