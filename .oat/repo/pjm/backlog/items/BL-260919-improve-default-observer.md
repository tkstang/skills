---
id: BL-260919-improve-default-observer
title: Improve default observer digest coverage and full-history recovery
status: open
priority: medium
scope: task
scope_estimate: S
labels:
  - session-observer
  - digest
  - usability
assignee: null
created: 2026-09-19T00:30:54.438Z
updated: 2026-09-19T00:30:54.438Z
associated_issues: []
external_plans: []
---

## Description

During the September 18 agent-messaging design collaboration, Fable reported that a pinned default review rendered 13 of 56 messages and tail-sliced 43 after the 20,000-character large-digest fallback. The full digest was reported as 29,918 characters and was recovered with an arbitrary --max-bytes 600000. Automatic tail-slicing is documented behavior, not evidence that transcript records were lost. Improve first-catch-up coverage and provide an obvious, bounded route to complete history with explicit omission accounting. Keep this independent of agent-messaging and the opt-in activity-fidelity project, which explicitly leaves the default digest unchanged.

## Acceptance Criteria

- Reproduce the reported 56-to-13 rendered-message reduction with a sanitized long-planning-session fixture, distinguishing the automatic 20,000-character fallback from explicit bounds and normal tool/metadata filtering. Use `src/skills/session-observer/src/lib/digest.ts` and its colocated digest tests as the starting point.
- Define a practical initial-collaboration read policy that does not quietly omit most relevant history. Evaluate an explicit full-history option, bounded pagination, or a documented initial-read bound; do not prescribe an arbitrary huge byte value or silently remove output safety limits.
- Make the active bound, original/retained/omitted message counts, rendered range, and exact recovery action clear in JSON and human output. Complete history must be attainable without guessing a magic number, while respecting caller-selected limits.
- Preserve raw record indexes and read/checkpoint semantics; never describe tail-sliced messages as deleted or consumed by the model. Verify any mark-read interaction explicitly instead of claiming a digest change repairs unread-record loss.
- Add regression tests below/above the automatic threshold, explicit byte/turn bounds, initial collaboration reads, and recovery of earlier omitted user decisions. State whether each count describes raw records, rendered messages, or the display window.
- Update observer/collaboration guidance where needed, bump affected canonical skill versions, regenerate outputs, and pass focused tests plus repository validation. Coordinate with BL-260916-session-fidelity-opt without absorbing its opt-in activity extraction scope; agent-messaging remains independent.
