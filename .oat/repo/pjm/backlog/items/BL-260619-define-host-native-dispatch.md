---
id: BL-260619-define-host-native-dispatch
title: Define host-native dispatch / safe-packet protocol (reserved seam)
status: open
priority: low
scope: initiative
scope_estimate: L
labels:
  - consensus
  - provider-cli
  - host-native
  - reserved
assignee: null
created: 2026-06-19T23:41:44Z
updated: 2026-06-19T23:41:44Z
associated_issues: []
legacy_id: bl-3ca6
---

## Description

`design.md:159` reserves **host-native dispatch** for a future project. The
shipped first-scope provider CLI deliberately does **not** implement it:

- All first-scope adapters report `supports_host_native_dispatch: false`.
- The `host_native_safe_packet_required` guard value is a **reserved vocabulary
  item only** — no first-scope adapter emits it.

The design states that before any adapter sets
`supports_host_native_dispatch: true`, a future project must define the packet
contents, the conversation-history boundary, the execution contract, the audit
fields, and the safety checks.

This is a **thin seed** so the reserved seam has a tracked home rather than
living only as commentary in `design.md`. It is **speculative and large**, not
near-term work; the value is preventing the reserved capability flags and
vocabulary from being orphaned or accidentally enabled without a real contract.

**Why:** the provider CLI shipped with reserved extension points
(`supports_host_native_dispatch`, `host_native_safe_packet_required`,
`future_extension_kind`). Without a backlog anchor, a later contributor could
flip a flag without the safety/history/audit contract the design requires. A
seed item keeps the gate explicit.

Cross-link: [[bl-bb7e]] (done — shipped the provider CLI that established these
reserved capability flags).

## Acceptance Criteria

- A written go/no-go that decides whether host-native dispatch is worth pursuing
  at all (it may end as `wont_do` if the prompt/CLI floor stays sufficient).
- If pursued, a design that specifies: safe-packet contents, conversation-history
  boundary, execution contract (local vs cloud), audit fields, and the safety
  checks that must pass before dispatch.
- The conditions under which an adapter may set
  `supports_host_native_dispatch: true` and emit `host_native_safe_packet_required`
  are defined, with guard behavior for the not-yet-supported state.
- No adapter flips `supports_host_native_dispatch` to `true` until the above
  contract exists and is reviewed.
