---
id: BL-260713-cursor-transcript-store
title: Cursor transcript-store and slug coverage
status: open
priority: low
scope: feature
scope_estimate: M
labels:
  - session-observer
  - session-observer-collab
  - v2
  - cursor
  - transcripts
assignee: null
created: 2026-07-13T04:02:18Z
updated: 2026-07-13T04:02:18Z
associated_issues: []
---

## Description

Cursor transcript discovery currently depends on the stores and path shapes
measured for v1. Background-agent/CLI transcript stores and dotted-path slug
variants remain a coverage gap, so identity and completed-turn selection must
be expanded only from sanitized evidence rather than guessed path rules.

## Acceptance Criteria

- A discovery record inventories the supported Cursor transcript stores,
  session/conversation identifiers, retention/path conventions, and known
  dotted-path slug variants, with unsupported stores explicitly documented.
- Canonical transcript location and slug parsing handle the measured variants
  without selecting a different project/session or exposing secrets; ambiguous
  candidates fail closed with evidence.
- Sanitized fixtures and tests cover each supported store, background-agent or
  CLI records where available, dotted slugs, malformed paths, duplicate
  candidates, and restart/catch-up behavior.
- User and engineering documentation state the supported coverage and retain a
  documented-but-unvalidated label for stores that cannot be probed.
