---
id: DR-260912-separate-forks-and-handoffs
title: Separate forks and handoffs
date: 2026-09-12
status: accepted
legacy_id: null
---

# Separate forks and handoffs

## Context

The desired workflows are Codex-to-Codex and Claude-to-Claude native forks into an existing destination worktree, plus a detailed portable continuation packet from any agent to any agent. Native continuity and portable context transfer have different guarantees. The existing personal-skills session-handoff already serves the portable workflow; the session-fidelity research packet identifies opportunities for shared activity extraction and richer evidence, not proof that native gates pass.

## Decision

Keep `coding-session-handoff` and `session-handoff` as separate, composable skills:

- `coding-session-handoff` owns Codex-to-Codex and Claude-to-Claude native successor creation into an explicitly selected existing destination worktree, with exact identity, lineage, cwd, and source-resume evidence.
- `session-handoff` owns any-agent-to-any-agent continuation packets without requiring a native fork, worktree creation, or session launch.
- Enrich portable packets through the shared canonical transcript/activity infrastructure also used by observation and export, with concise core context and optional relevant sanitized tool-call/result evidence, provenance, and explicit omissions.
- Treat migration of `session-handoff` from personal-skills as a separately planned change.

## Consequences

Native identity remains required to claim and safely manage a native fork; portable handoffs do not require native successor identity and must not claim native history or runtime-state continuity. Native forks inherit provider history; the current fork readiness marker is not a full portable handoff prompt. Research-backed activity enrichment is accepted direction, not implemented capability: preserve existing safe export defaults, make additional evidence explicit and opt-in, and do not replay historical tool calls or carry forward authorization. Reuse dependency-free canonical TypeScript and generated runtime outputs rather than introducing another parser or universal session service. Finish the current native-fork reviews and exact-version live gates independently of future packet enrichment or migration; no new provider operation, automatic retry, installation, or cleanup is authorized by this decision.

## Related decisions and evidence

- [Exact identity for stateful work](DR-260724-stateful-work-requires-exact.md).
- [Two-pass export sanitization](DR-260605-export-sanitization-is-two.md).
- [Natural-language digests](DR-260514-digests-are-natural-language.md).
- [Canonical TypeScript sources](DR-260615-canonical-typescript-sources.md).
- Local `session-fidelity-research-packet`, prepared 2026-09-10: implementation/reuse proposals and session-resume comparison. Its source audit informs future work; it is not live native-gate evidence.
