---
oat_generated: false
oat_last_updated: 2026-07-23
---

# Project Summary: wave-3-execution

Wave 3 of the repo-audit execution program: two write-disjoint lanes, merged
conflict-free.

## What shipped

1. **Consensus CLI helper consolidation** — 17 byte-identical helpers (arg
   parsing, path confinement, provider-CLI envelope/inventory) extracted from
   the create/decide/plan/evaluate command modules into canonical
   `src/consensus/shared/cli-helpers.ts` with per-skill + plugin-root generated
   fan-out; the consensus-loop's drifted lax parsers reconciled to the bounded/
   validated canonical (documented user-visible tightening: direct loop-CLI
   `--max-rounds`/`--peers` now validate); W1's same-name loop-internal
   `atomicWriteFile` kept deliberately distinct. Re-fork guard + panel-
   decoupling guard tests enforce the new invariants. Panel excluded from
   consolidation by reviewed ruling (its documented loop-decoupling would be
   regressed; ~10 trivial pure-helper copies accepted; loop-free core split
   filed as follow-up). Bumps: create/decide/plan 0.1.6, evaluate 0.1.9,
   refine 0.1.8.
2. **Worktree/hook behavioral tests** — `scripts/worktree/validate.sh` and
   `init.sh` now executed under stub-pnpm/oat harnesses (dirty-tree fail-closed,
   exact 8-step pipeline order, post-run drift detection, fail-fast); all four
   git hooks + manage-hooks.mjs characterized; DX-05 `command -v pnpm` guards
   added to pre-commit/pre-push; the GIT_* env scrub extracted to a shared
   `tests/helpers/git-env.mjs` and applied to every temp-repo git spawn
   (empirically verified harmless to the real repo).

Net: 1155 tests passing (+18). Zero merge conflicts.

## Review chain

Plan gate: 3 findings (1 rejected with wave-1 evidence) → passed. p01: Codex ×2
+ Opus review APPROVE with a formal ruling on the panel-exclusion escalation.
p02: APPROVE clean. 

## Workflow Observations

- The implementer→reviewer escalation path for interlocking design decisions
  worked as designed (panel ruling).
- MAX-TWO codex cap held; equivalent-invocation note eliminated the pnpm `--`
  failure class.
- Scaffold-readiness ordering (gate finding) adopted for W4/W5.

## Follow-ups

- Filed: loop-free `cli-helpers-core.ts` split (panel pure-helper sharing).
