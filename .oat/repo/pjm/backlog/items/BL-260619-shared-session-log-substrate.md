---
id: BL-260619-shared-session-log-substrate
title: Shared session log substrate (become-observable daemon + merged log)
status: open
priority: medium
scope: initiative
scope_estimate: L
labels:
  - multi-agent
  - substrate
  - session-observer
  - foundation
assignee: null
created: 2026-06-19T23:57:18Z
updated: 2026-06-19T23:57:18Z
associated_issues: []
legacy_id: bl-4e2e
---

## Description

Foundation layer of a proposed **multi-agent collaboration substrate** that lets
multiple agents (Claude, Codex, Cursor, …) working on one project observe each
other. Promotes the vault idea cluster (2026-06-19) into the backlog so the
direction is visible on the planning surface.

**Vault source notes:**

- `02 - Projects/Skills/Ideas/2026-06-19-multi-agent-collaboration-substrate-index.md` (MOC + build order)
- `02 - Projects/Skills/Ideas/2026-06-19-shared-session-log-substrate.md` (this item's design)
- `02 - Projects/Skills/Research/2026-06-19-cass-cross-provider-session-tooling.md` (prior-art assessment)

**Concept:** an agent-initiated "become observable" action registers its session
with a central daemon; the daemon collects + filters + merges all registered
sessions into one timestamp-ordered shared log that any participating agent can
tail via the existing cursor/high-water-mark pattern. This subsumes the current
"one agent can't watch multiple sessions" limitation — multi-watch becomes "tail
the merged log." Establishes the shared project-scoped state directory (e.g.
`.consensus/`) and agent identity/naming convention that inter-agent messaging
([[inter-agent-direct-messaging]]) reuses.

**Relationship to shipped work:** extends the existing `session-observer` skill
(which already locates, reads, and live-watches a single peer session with noise
filtering and cursor catch-up). The new territory is the become-observable
daemon, the merged multi-session log, lifecycle (heartbeat/crash cleanup, idle
watch-timeout, reactivation), and the live observation loop. Evaluate building
the plumbing on `cass` rather than bespoke per-provider parsers.

**Maturity:** brainstorm/active with ~6 open design questions (adopt `cass` vs
bespoke; daemon packaged inside the consensus plugin vs standalone; merge/filter
schema). The index note sequences this **after** TypeScript/test foundation
hardening — "this substrate is the next build-out once that is solid." Needs a
design pass before implementation.

## Acceptance Criteria

- A design pass resolves the open questions: adopt-vs-build on `cass`, packaging
  (consensus plugin vs standalone), and the merged-log filter/schema.
- Become-observable registration + central daemon collect and merge registered
  sessions into one timestamp-ordered, noise-filtered shared log.
- Any participating agent can tail the merged log via the existing cursor /
  high-water-mark mechanism (reuses `session-observer` state pattern).
- Lifecycle handled: idle watch-timeout, heartbeat-based crash detection +
  cleanup, and reactivation/auto-reregister on session resume.
- Shared `.consensus/` project-scoped state directory and agent identity/naming
  convention defined as the primitive that [[inter-agent-direct-messaging]] builds on.
- Decision (DR) recorded for adopt-vs-build and packaging if durable.
