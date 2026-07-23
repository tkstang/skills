---
oat_generated: false
oat_last_updated: 2026-07-23
---

# Project Summary: wave-1-execution

Wave 1 of the 2026-07-22 repo-audit execution program, executed as a wrapper
OAT project via `oat-wave-execute`. Four external plans ran as parallel
write-disjoint worktree lanes at ceiling 4 and merged conflict-free.

## What shipped

1. **Atomic consensus state writes** (`2026-07-17-atomic-consensus-records-writes.md`)
   — `atomicWriteFile` (same-dir pid tmp + fsync + rename, unmasked rethrow)
   now backs `records.json` and loop-status writes; a mid-write crash can no
   longer corrupt a resumable deliberation session. refine 0.1.6, evaluate 0.1.7.
2. **Cross-provider recursion enforcement** (`2026-07-17-cross-provider-recursion-guard.md`)
   — the host guard's `different_host` branch now propagates depth and blocks at
   `max_depth`, closing the alternating-provider bypass (claude→codex→claude…).
   Strictly tightening: zero blocked→allowed transitions (128-case matrix +
   independent review probes).
3. **Session-observer state robustness** (`2026-07-17-session-observer-state-robustness.md`)
   — locks record owner PIDs; stale locks are reclaimed exactly once per
   acquisition via rename-based exclusive claim with post-claim re-verification
   (the demonstrated two-contender theft interleaving is closed and
   interleaving-tested; a narrow documented multi-contender residual remains,
   funneled through exclusive lock creation); codex cwd-cache writes are
   atomic. session-observer 1.0.6.
4. **Docs staleness sweep** (`2026-07-17-docs-staleness-sweep.md`) — CHANGELOG
   caught up (~3 weeks: phone-a-friend, consensus config, session-observer-collab),
   README standalone-skill list fixed, CONTRIBUTING moved to pnpm commands,
   marketplace descriptions synced to all seven skills, repository-layout gained
   `src/consensus/`, AGENTS.md documents the session-observer-collab hand-written
   runtime exception (deliberateness verified from shipped docs first).

Net: +14 tests (1104 passing / 1 intentional skip); integration `premerge`
green; 3 skill version bumps validated.

## Review chain

- Plan gate (Codex, bounded): FIXES_NEEDED → 6 fixed, 3 rejected with reasons → passed.
- Per-phase: p01 PASS (after 1 Codex Medium fixed, disposition verified twice),
  p02 PASS (security review with weaker-anywhere analysis at two layers),
  p03 PASS after one fix round (reviewer-found reclaim TOCTOU Critical closed,
  disposition-verified), p04 PASS clean.
- 5 real defects were caught and fixed pre-merge across the review chain
  (1 test-quality Medium, 2 Codex Criticals, 1 reviewer TOCTOU Critical,
  1 tmp-collision Medium).

## Workflow Observations

Rolled up from `orchestration-log.md` end-of-run synthesis:

- Write-disjoint composition + serialized rebase-merge choreography produced a
  zero-conflict fan-in; the mechanical write-surface intersection at drift
  refresh was the load-bearing input.
- Cross-model (Codex) implementation reviews and adversarial phase reviewers
  with self-designed probes were complementary, not redundant: each layer
  caught defects the other missed (p03's TOCTOU was found only by the phase
  reviewer's own interleaving analysis after Codex passed the fix).
- Frictions worth upstreaming into `oat-wave-execute`: pnpm `--` forwarding in
  the wrapper-template DoD example; codex `exec -o` output-flush fallback
  guidance in implementer briefs; a Step-1 note for branching when the program
  artifact is not yet on main; gate-prompt context that rule-1 drift addenda
  are skill-sanctioned.
- Environment: this checkout is itself a linked git worktree — resolve
  `info/exclude` and similar via `git rev-parse --git-path`.

## Follow-ups

- Backlog item filed at closeout: atomic conversion of the two deferred
  consensus-loop write sites (`writeSectionOutput`, `seedRecordsFile`).
- Post-merge operator step: refresh `~/.agents/skills/session-observer` from
  main and `oat sync --scope user` (dogfooding convention).
