---
id: BL-260930-import-sessions-before-native
title: Import sessions before native fork
status: closed
priority: medium
scope: feature
scope_estimate: M
labels:
  - session
  - claude
  - codex
assignee: null
created: 2026-09-30T14:26:31.172Z
updated: 2026-09-30T16:00:09.504Z
associated_issues: []
external_plans: []
---

## Description

Implement cross-provider session seed import into an existing canonical destination worktree, then prepare the user-run native fork command. Preserve existing same-provider guidance. Build on the isolated Teleporter 1.2.0 experiment, with dependency-free TypeScript, explicit conversion limits, Opus high design and implementation reviews through consensus, and GPT-6.1 Sol implementation.

## Acceptance Criteria

- Preserve the isolated import-then-fork experiment, source provenance, client versions, and bounded verification limits in repository research records.
- Opus at high effort reviews the concrete design through consensus before GPT-6.1 Sol begins product implementation; material findings are resolved.
- Cross-provider Claude/Codex imports create a new seed at the canonical existing destination worktree and return a guarded user-run native fork command; same-provider guidance remains available.
- The dependency-free TypeScript implementation preserves supported active conversation text and completed native tool calls/results, reports conversion omissions, and refuses histories it cannot safely represent.
- Dry runs do not mutate provider stores. Applying preserves source sessions, refuses overwrite and unsafe paths, and handles repeat imports without replacing evolved or archived sessions.
- Focused tests protect the public import/publication boundaries, and isolated real-client probes verify our generated payload through native fork, continuation and restart without personal data or external model calls.
- Update skill metadata version, changelog, docs and generated payloads; pass repository checks and an Opus high implementation review through consensus.

## Design and evidence

- [Design](../../../reference/research/session-import-fork-2026-09-30/design.md)
- [Evidence](../../../reference/research/session-import-fork-2026-09-30/evidence.md)
- Runtime scope excludes GUI placement, automatic provider execution, worktree creation, file transfer and Cursor import.

## Completion

Accepted on `t3code/investigate-session-teleporter`: GPT-6.1 Sol implementation followed the completed Opus design gate, and Opus implementation re-review passed after bounded fixes. Full suite 2,502 passed/3 skipped; both isolated generated-client loops passed. [Verification](../../../reference/research/session-import-fork-2026-09-30/verification.md) and [review disposition](../../../reference/research/session-import-fork-2026-09-30/implementation-review.md) retain evidence and the two nonblocking completion edge cases. Exact interactive terminal acceptance, merge, release and installation remain separate.
