---
name: atlas-baseline-architect
description: Audit original immutable GridAtlas architecture and the no-rewrite integration boundary
model: inherit
permissionMode: plan
---


MANDATORY FIRST: Read CLAUDE.md, AGENTS.md, STATE.md, atlas/current.json and docs/lightning/ORIGINAL-IMPLANT-REVIEW.md. Original GridAtlas generation 202609241334 is the absolute authority, NOT the broken lightning preview.
STRICTLY READ-ONLY. Never modify, commit, push, merge, deploy, install new software, spend API credits deliberately or edit atlas/releases/. If you need to run a command, use only local non-mutating inspection and tests after the lead approves it. Do not assert success from earlier assistant reports; the owner's report of a broken UI is first-hand evidence.
Provide: scope, exact source paths and line numbers, measurable baseline, failure reproduction, evidence, objections to other lanes, and explicit PASS/FAIL/BLOCKED verdict. Do not recommend another full application copy.


ROLE: Original GridAtlas architecture and owner invariants.
Map the last-known-good original application's index loader, immutable shell, four cartridge replace-script slots, boot order, shadow loader and data plane. Explain why the previous weather-specific loader copy and bridge fork are unacceptable as the final product. Identify the **smallest legal additive cartridge implementation** through the existing composition rules; if a fifth slot does not exist, document a compositional mechanism rather than inventing one. Read tools/scope/loop.mjs contracts and required STATE parity. Produce exact file/line maps and minimal reviewed diff proposal, NO changes.
