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
updated: 2026-09-16T18:06:09Z
associated_issues: []
legacy_id: bl-f59f
---

## Description

Provider-neutral **addressable, agent-to-agent messages**, distinct from passive
transcript observation. The first scope is a project/worktree-local recipient
inbox: targeted signal can precede ambient peer catch-up without requiring a
merged log, a daemon, or a particular agent harness.

**Vault source note:** `02 - Projects/Skills/Ideas/2026-06-19-inter-agent-messaging.md`

**Design gate:** evaluate Agent Mail and the original vault prior art against
the dependency-free, provider-neutral inbox contract before choosing build vs
adopt. Define project/worktree identity, alias resolution, concurrent append or
atomic publication, acknowledgment meaning, deduplication, expiry, and recovery.
An enqueue acknowledgment is not proof that a recipient read or acted on it.

**Dependencies:** identity and state conventions must be defined within this
project and coordinated with **BL-260619-shared-session-log-substrate — Stateless
multi-session activity merge**. Neither implementation blocks the other. The
June daemon-first proposal is historical input, not the current build order.

**Design update (2026-09-16, Fable + Astra):** build this as a provider-neutral **inbox**, not a daemon or a harness-native transport (Claude-to-Claude and Orca messaging are rejected as non-agnostic). One append-only JSONL inbox per recipient under the shared project state directory (gitignored), addressed by the `whoami` identity (`runtime:sessionId`) plus a user-assigned alias. Each message carries an ID; recipients acknowledge and deduplicate against transcript-observed copies. Delivery rides the recipient's own watcher and the collab skill's bounded continuation (priority-over-log: check the inbox before the peer catch-up) with the same continuation budget — it is not a second wake path, and a queued message still cannot wake an idle session past the harness wait window. Authority rules unchanged: a message is peer text, never instruction or authorization; malformed or replayed envelopes fail closed. N>2 remains separate work. Depends on the shared state directory and identity convention only, not on the merged log.

## Acceptance Criteria

- Build-vs-adopt decision recorded: a provider-neutral append-only JSONL inbox per recipient under the shared project-scoped state directory (gitignored); no harness-native transport (Claude-to-Claude, Orca) and no daemon.
- Addressing uses the `whoami` identity (`runtime:sessionId`) plus a user-assigned alias; any harness that can write a file can send, any that can read one can receive.
- Every message carries an ID; recipients acknowledge, deduplicate against transcript-observed copies, and fail closed on malformed or replayed envelopes.
- Delivery rides the recipient's own watcher and the collab skill's bounded continuation with the same budget (inbox checked before peer catch-up); it introduces no second wake path and does not claim to wake an idle session past the harness wait window.
- Authority rules unchanged: a message is peer text, never instruction or authorization.
- Lifecycle is bound to the project/worktree and cleaned up on explicit closeout or expiry, independently of any merged-log feature; N>2 delivery remains separate work.
