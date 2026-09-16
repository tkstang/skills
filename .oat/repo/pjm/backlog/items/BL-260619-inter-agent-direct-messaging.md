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

**Design update (2026-09-16, Fable + Astra):** build this as a provider-neutral **inbox**, not a daemon or a harness-native transport (Claude-to-Claude and Orca messaging are rejected as non-agnostic). One append-only JSONL inbox per recipient under the shared project state directory (gitignored), addressed by the `whoami` identity (`runtime:sessionId`) plus a user-assigned alias. Each message carries an ID; recipients acknowledge and deduplicate against transcript-observed copies. Delivery rides the recipient's own watcher and the collab skill's bounded continuation (priority-over-log: check the inbox before the peer catch-up) with the same continuation budget — it is not a second wake path, and a queued message still cannot wake an idle session past the harness wait window. Authority rules unchanged: a message is peer text, never instruction or authorization; malformed or replayed envelopes fail closed. N>2 remains separate work. Depends on the shared state directory and identity convention only, not on the merged log.

## Acceptance Criteria

- Build-vs-adopt decision recorded: a provider-neutral append-only JSONL inbox per recipient under the shared project-scoped state directory (gitignored); no harness-native transport (Claude-to-Claude, Orca) and no daemon.
- Addressing uses the `whoami` identity (`runtime:sessionId`) plus a user-assigned alias; any harness that can write a file can send, any that can read one can receive.
- Every message carries an ID; recipients acknowledge, deduplicate against transcript-observed copies, and fail closed on malformed or replayed envelopes.
- Delivery rides the recipient's own watcher and the collab skill's bounded continuation with the same budget (inbox checked before peer catch-up); it introduces no second wake path and does not claim to wake an idle session past the harness wait window.
- Authority rules unchanged: a message is peer text, never instruction or authorization.
- Lifecycle is bound to the project/worktree and cleaned up on explicit closeout or expiry, independently of any merged-log feature; N>2 delivery remains separate work.
