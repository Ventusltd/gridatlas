#!/usr/bin/env bash
# release-rehearsal-E | ROLLBACK of 202610270024 (v9.162) to 202609241334 (v9.156) | OWNER ONLY
# Rehearsed in a private worktree (evidence 4B-*, 4C-*). Nothing was pushed.
# Run from your own clone. Pick ONE route. Set REPO first.
set -euo pipefail
REPO=${REPO:?set REPO to your gridatlas clone}
cd "$REPO" && git fetch origin
REL=$(git log --format=%H -1 --grep='^202610270024-gridatlas-v9.162: release' origin/main)
test -n "$REL" || { echo "STOP: release commit not found on origin/main"; exit 1; }
echo "release commit: $REL"

# ---- Route C (recommended): byte-exact revert of the release commit --------------------
# Restores atlas/current.json and STATE.md to the exact pre-release bytes (rehearsed: 4C-revert.txt).
git worktree add -b rollback/202610270024 ~/gridatlas-rollback origin/main
cd ~/gridatlas-rollback
git revert --no-edit "$REL"
sha256sum atlas/current.json STATE.md
# expect:
# 1ea60d61bc6ae2f463b6eaee52ee377c9e1da4aac1944c01239bedc99ec2520d  atlas/current.json
# b8bef1e1699f353e8e0a62c11bad950dd212137f4f562621511f34dd7f6d96fb  STATE.md
node tools/scope/loop.mjs lint                                   # scope-ledger=PASS active=none master=done
node tools/scope/loop.mjs state --stdout | cmp - STATE.md && echo STATE_PARITY_OK
node tools/scope/verify-compose.mjs                              # "composition":"PASS","generation":"202609241334"
node tools/proofs/run-current.mjs                                # every composed cartridge passed
node tools/proofs/202609241334-sld-sandbox.proof.mjs             # ... syntax PASS
# git push -u origin rollback/202610270024   # then PR + merge (or push to main if you authorise an emergency)
exit 0

# ---- Route B (tool path; a NEW generation <RB>, NOT byte-exact by design) ----------------
# Same four cartridges, shell, order and composition_version as 202609241334; seven identity keys
# differ (generation, previous_generation, composition_id, composition_manifest, composition_note,
# superseded_generation, candidate_predecessor). Rehearsed: 4B-rollback.txt, 4B-rolledback.gates.txt.
#   git worktree add -b rollback/202610270024 ~/gridatlas-rollback origin/main && cd ~/gridatlas-rollback
#   node tools/rollback.mjs --to 202609241334 --reason "<why>"
#   node tools/scope/loop.mjs state && node tools/scope/loop.mjs lint
#   node tools/scope/verify-compose.mjs && node tools/proofs/run-current.mjs
#   git add atlas/current.json STATE.md atlas/state/live-set.json atlas/manifests/*-composition.json
#   git commit -m "<RB>: roll back 202610270024 to 202609241334 - <why>"
#
# ---- Route A (emergency, no terminal) ---------------------------------------------------
# GitHub Actions -> "Rollback GridAtlas composition": to_generation=202609241334, a reason,
# confirm=ROLL BACK. Equivalent to Route B.
