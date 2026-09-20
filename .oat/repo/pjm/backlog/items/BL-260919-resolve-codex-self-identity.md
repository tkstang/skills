---
id: BL-260919-resolve-codex-self-identity
title: Resolve Codex self identity with duplicate rollout candidates
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - session-observer
  - identity
  - codex
assignee: null
created: 2026-09-19T00:31:07.663Z
updated: 2026-09-19T00:31:07.663Z
associated_issues: []
external_plans: []
---

## Description

During the September 18 agent-messaging design collaboration, Codex whoami returned no match while locate found two rollout files reporting the same native session ID. The main transcript and a second rollout with a different filename ID were both candidates; inherited parent identity is a hypothesis to verify. This prevented the driver from safely arming stateful observation and required stateless pinned reads. Diagnose exact-pin candidate resolution and distinguish real ambiguity from absence without guessing self identity. This is independent session-observer reliability work, outside agent-messaging.

## Acceptance Criteria

- Reproduce the main/secondary-rollout collision with sanitized fixtures. Record harness signals, transcript metadata, filename IDs, cwd, and parent/child provenance; do not assume the secondary rollout is a subagent without checking.
- Cover tonight's verified environment: `CODEX_THREAD_ID` and `CODEX_SESSION_ID` both held `01a0b699-43c0-74e2-9353-b52f70a00f36`; `OPENAI_CODEX_SESSION_ID` and `CODEX_SANDBOX` were unset. Missing identity variables must not be assumed as the cause.
- Correct identity/candidate handling so a provable exact self pin resolves safely despite duplicate or inherited transcript metadata; genuinely conflicting candidates return actionable ambiguity rather than misleading absence. Never select by newest transcript, nickname, or cwd alone.
- Investigate the current `src/skills/session-observer/src/lib/locate.ts` `findSessionCandidate` single-match/null contract and its use in `lib/observe.ts`; preserve the distinction among no candidate, ambiguous candidates, and invalid/conflicting harness signals.
- Add focused regression coverage for a normal single candidate, parent/child metadata collision, two genuinely ambiguous candidates, conflicting environment IDs, and absent signals. Verify whoami, locate, and stateful exact-self validation agree; failed identity never advances cursors or arms a watch.
- Document actionable diagnostics, bump affected canonical skill versions, regenerate outputs, and pass scoped tests plus repository validation. No live hook installation or messaging-project dependency is introduced by this item.
