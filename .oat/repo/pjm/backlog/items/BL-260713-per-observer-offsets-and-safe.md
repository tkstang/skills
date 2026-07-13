---
id: BL-260713-per-observer-offsets-and-safe
title: Per-observer offsets and safe N>2 collaboration mesh
status: open
priority: low
scope: initiative
scope_estimate: L
labels:
  - session-observer-collab
  - v2
  - multi-agent
  - offsets
  - mesh
assignee: null
created: 2026-07-13T04:02:18Z
updated: 2026-07-13T04:02:18Z
associated_issues: []
oat_template: true
oat_template_name: backlog-item
---

## Description

The v1 collaboration skill deliberately supports one user plus two mutually
observing agents. Its shared observer state is not sufficient for a safe N>2
full mesh: each observer/consumer needs an independent read offset and
duplicate watchers must not race one another. This item records the deferred
Part 1.10 work without changing the existing shared-session-log or direct-
messaging initiatives, which remain separate foundations and follow-ons.

## Acceptance Criteria

- A design decision defines per-observer offset namespaces, identity and
  ownership, migration/backward compatibility, and duplicate-watcher locking.
- A bounded N>2 topology is specified (or a documented go/no-go is recorded)
  with exact peer identity, compare-and-swap cursor advancement, and explicit
  behavior for late, replayed, or concurrently consumed records.
- Automated fixtures exercise at least three observers, independent cursors,
  duplicate-watcher races, restart/recovery, and no loss or duplicate delivery
  for each consumer.
- The implementation and operator documentation preserve the N=2 behavior and
  state how this work composes with the existing shared-session-log substrate
  and direct-messaging backlog items.

