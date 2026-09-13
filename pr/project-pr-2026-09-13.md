---
oat_generated: true
oat_generated_at: 2026-09-13
oat_pr_type: project
oat_pr_scope: final
oat_project: .oat/projects/synced/coding-session-handoff
---

# feat(coding-session-handoff): add destination-session fork guidance

## Summary

Add an experimental, read-only workflow for continuing a selected Codex or Claude Code session in an existing destination Git worktree. The public skill discovers and previews source sessions, validates the destination, and prepares guarded commands for the user to run in the destination tab. It does not execute providers, create sessions, manipulate IDE tabs, or write provider stores.

The earlier automated executor remains preserved for evidence and future work, but it is incomplete, paused, and unreachable from the public guidance bundle. Cursor guidance fails closed because the available transcript evidence cannot prove an exact working-directory match.

## Goals / Non-Goals

**Goals:**

- Discover provider-qualified source sessions with exact-all, zero-persistence reads.
- Preview bounded, sanitized transcript evidence without exposing source paths.
- Validate an existing Git worktree and prepare destination-only commands.
- Preserve strict observer/executor behavior while allowing guidance to use internally consistent continued prefixes.
- Ship the workflow as an experimental standalone skill with generated, dependency-free runtime output.

**Non-goals:**

- Provider execution, session creation, child-session reconciliation, or cleanup.
- IDE tab creation or switching, provider-store writes, or a cross-provider registry.
- Portable context packets, which remain the separate `session-handoff` workflow.
- Installation, marketplace publication, or release claims in this PR.

## Changes

- Added `coding-session-handoff` guidance capabilities, discovery, preview, preparation, and CLI modules under canonical TypeScript source.
- Added the experimental public skill and generated runtime with `discover`, `preview`, and `prepare` commands.
- Extended shared transcript discovery for bounded, provider-qualified Claude, Codex, and fail-closed Cursor evidence.
- Added exact source/destination checks, stable path-free failure provenance, provider-scoped preview/prepare behavior, and shell-safe destination instructions.
- Isolated guidance classification caches from strict observer/executor policy and preserved guidance prefixes across continued sessions.
- Added focused and integration coverage for realistic transcript stores, generated output, repository layout, and skill versioning.
- Updated repository current-state and roadmap references with the review-complete, unreleased status and the proposed future `session` plugin / `session-fork-to-destination` migration.

## Verification

- Full Vitest suite: 1,923 passed, 1 skipped at reviewed feature head `10d901e8`.
- Root repeated 566 focused tests covering the final repair range.
- Final gate independently repeated 1,055 focused tests.
- Type-check, generated build parity, repository validation, skill-version validation, smoke, authored lint/format, documentation build/format, and diff hygiene passed.
- Skill versions advanced to `coding-session-handoff` 0.1.12, `session-observer` 1.0.33, and `export-session-transcript` 1.0.10.

## Reviews

- The additional standard final re-review passed with 0 Critical, 0 Important, 0 Medium, and 0 Minor findings at `10d901e8`.
- The configured Cursor Fable final gate passed its Important threshold with 0 Critical, 0 Important, 1 Medium, and 2 Minor findings at the same reviewed head.
- The nonblocking large Codex-store ceiling and second-stage preview provenance findings are deferred to the coordinated session-plugin/naming follow-up. The design wording finding was corrected in the project artifact without changing the reviewed feature implementation.

## References

- Project record: [.oat/repo/reference/project-summaries/20260913-coding-session-handoff.md](https://github.com/tkstang/skills/blob/feat/coding-session-handoff/.oat/repo/reference/project-summaries/20260913-coding-session-handoff.md)
