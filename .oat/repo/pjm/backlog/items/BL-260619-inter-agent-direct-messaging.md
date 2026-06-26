---
id: BL-260619-inter-agent-direct-messaging
title: Inter-agent direct messaging (addressable, prioritized)
status: open
priority: medium
scope: feature
scope_estimate: M
labels:
  - multi-agent
  - substrate
  - messaging
assignee: null
created: 2026-06-19T23:57:18Z
updated: 2026-06-19T23:57:18Z
associated_issues: []
legacy_id: bl-f59f
---

## Description

Capability layer of the multi-agent collaboration substrate: **addressable,
agent-to-agent direct messages**, distinct from passive observation of the
shared log. The shared log gives ambient/asynchronous awareness;
direct messaging gives targeted, prioritizable signal.

**Vault source note:** `02 - Projects/Skills/Ideas/2026-06-19-inter-agent-messaging.md`

**Concept:** reuse the agent identity/naming and cursor-polling primitives from
[[shared-session-log-substrate]] for point-to-point messages. An agent checks
its message location (cursor over last-read) **before** catching up on the shared
log, so urgent/targeted items jump the ambient queue (priority-over-log
semantics). Messages are project/work-tree-scoped and cleaned up alongside the
shared log.

**Build-vs-adopt:** the note recommends strongly evaluating adopting (or
wrapping) **Agent Mail** (`cass` / `mcp-agent-mail` — local SQLite-backed, named
agents, path-keyed projects, threaded subjects, `ack_required`) before building a
bespoke file/SQLite queue-with-cursor. Start simple, evolve only if limits are hit.

**Depends on:** [[shared-session-log-substrate]] (identity + state-directory +
cursor primitives). **Maturity:** brainstorm/active, ~4 open design questions;
ready to implement after the substrate lands.

## Acceptance Criteria

- Build-vs-adopt decision recorded (Agent Mail / `cass` wrapper vs lightweight
  file-or-SQLite queue-with-cursor), with rationale.
- Agents can send addressable direct messages using the substrate's identity
  layer; recipients read new messages via cursor polling.
- Priority-over-log semantics: direct messages are checked before shared-log
  catch-up.
- Message scope + lifecycle bound to the project/work-tree and cleaned up with
  the shared log.
- Reuses [[shared-session-log-substrate]] identity/state primitives (no separate
  identity system).
