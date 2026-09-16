---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-16
oat_generated: true
oat_summary_last_task: p01-t03
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: session-observer-rearm

## Overview

This project investigated whether stopping and restarting an exact-pin legacy
Codex observer can lose a renderable peer message. The reported raw-index gaps
contained tool, reasoning, and subagent activity, so the work separated
persisted consumption, process stdout, and delivery into an observing agent
before deciding whether the runtime needed a fix.

## What Was Implemented

- Added deterministic exact-pin tests spanning clean SIGTERM, `watch-ctl stop`,
  max-runtime expiry, filtered-only ranges, appends during replacement startup,
  rejected stdout, and both relevant competing-consumer interleavings.
- Demonstrated that supported clean `catch-up-then-watch` restarts emit a known
  renderable message exactly once. No clean-path runtime defect was reproduced,
  so watcher, observer, and state runtime code remained unchanged.
- Replaced stale Claude Code Monitor/re-arm guidance with the verified exact-pin
  procedure, range interpretation, shutdown distinctions, and explicit limits
  on synthetic delivery evidence. The public Session Observer and Collaborative
  Observer guides now expose the same boundaries.
- Bumped `session-observer`, `session-observer-collab`, and the mechanically
  affected `session-fork-to-destination` versions, then regenerated every
  declared standalone and plugin payload.
- Closed and archived `BL-260916-session-observer-re-armed` after all acceptance
  criteria, full premerge checks, phase/final review, and the configured
  different-family exit gate passed.

## Key Decisions

- **Watch is a foreground polling watcher with a shared observe pipeline, not a
  daemon or provider hooks.** Re-arm retains the exact pin and uses
  `catch-up-then-watch`; plain `watch` intentionally consumes an unread startup
  baseline and reports `baseline-gap` instead of rendering that backlog.
- **Read offsets in XDG state, keyed by runtime:sessionId, with locked atomic
  persistence.** Raw `[fromIndex, nextIndex)` consumption and rendered ranges
  remain distinct. Filtered records may advance the shared legacy offset without
  producing conversational output.

## Tradeoffs Made

- Preserved the existing legacy checkpoint order instead of rolling offsets
  back after stdout failure. Another consumer may have advanced the shared
  state, so rollback would weaken concurrency safety without providing a real
  acknowledgment protocol.
- Kept the fix characterization-only because all supported clean paths passed.
  No speculative signal handler, blanket raw-gap alarm, or broader reservation
  system was added.
- Treated synthetic stdout as process evidence only. Live Monitor-to-agent
  delivery remains a separate provider/harness claim.

## Integration Notes

- Operators re-arm a stopped or expired watcher with the same exact
  `<runtime>:<session-id>` pin and `catch-up-then-watch`, after confirming the
  previous watcher no longer owns the target.
- Legacy Claude Code/Codex state is persisted before stdout completes. A failed
  output write consumes the range, and a later exact-pin restart does not replay
  it.
- Verification passed with 88 focused tests, 2,002 full-suite tests and 1 skip,
  `pnpm run premerge`, type checking, generated-output freshness, structural
  validation, smoke, transitive skill-version validation, PJM doctor, scoped
  lint/format, and diff hygiene.
- Generic whole-repository lint still diagnoses unchanged generated/OAT mirrors
  that repository instructions exclude; required changed-file and premerge
  lint paths passed.

## Follow-up Items

- Stronger replay guarantees would require a separate acknowledgment,
  reservation, or compare-and-set checkpoint design. The owner-polls-before-
  contender-rollback ordering remains part of that broader limitation.
- A live provider harness run is still required before claiming that completed
  observer stdout reached an observing agent. Synthetic tests deliberately make
  no such claim.

## Associated Issues

- `BL-260916-session-observer-re-armed` — closed and archived after the bounded
  acceptance criteria were satisfied.

## Explainer Outcome

- **project-recap:** skipped — interactive completion choice

## Workflow Observations

### 2026-09-16 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:3,minor:4 exit=0 status=ok artifact=.oat/projects/shared/session-observer-rearm/reviews/artifact-plan-review-2026-09-16T204720Z.md run=6e485c5f-811e-45bd-b529-637f18677b01

### 2026-09-16 · structural · oat-project-implement · p01

p01-phase-outcome-bfb7fc08 status=passed tasks=3/3 commits=74a68ee2,74240d78,7399f071 fix=bfb7fc08 review=reviews/archived/p01-review-2026-09-16T212106Z.md rereview=reviews/p01-review-2026-09-16T213252Z.md orchestration=attempted findings=critical:0,important:0,medium:0,minor:0

### 2026-09-16 · project · friction · generic final lint crosses generated-provider exclusions

final-lint-generated-exclusions-20260916: Generic `pnpm lint` scanned generated/OAT mirrors under `.claude/skills/**` and failed on unchanged baseline rules, while repository guidance explicitly excludes those mirrors and CI/premerge lint only the changed authored files. The bounded closeout used the passing changed authored-file lint plus the green premerge, type-check, build, and generated-parity gates rather than widening this ticket into unrelated tooling cleanup.

### 2026-09-16 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:0 exit=0 status=ok artifact=.oat/projects/shared/session-observer-rearm/reviews/final-review-2026-09-16T220057Z.md run=5d81d0bd-08cf-4353-be4c-1fba7b9c14f6

### 2026-09-16 · project · feedback · lite closeout PR blocked by explicit local-only boundary

lite-pr-boundary-20260916: The deterministic lite tail resolved to its required `pr` step, but the originating instruction explicitly forbids push, publication, and merge. The PR step was not dispatched; implementation code, phase/final reviews, configured exit gate, and backlog closeout remain complete and locally committed, while the lifecycle sequence stays resumable only if that authorization boundary is later changed.
