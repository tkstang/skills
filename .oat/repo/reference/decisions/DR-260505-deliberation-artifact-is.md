---
id: DR-260505-deliberation-artifact-is
title: Deliberation artifact is the canonical resume state; corruption fails closed
date: 2026-05-05
status: Accepted.
legacy_id: DR-005
---

### DR-005: Deliberation artifact is the canonical resume state; corruption fails closed

- **Date:** 2026-05-05
**Context:** Resume must recover from interruption, corruption, or new user direction mid-run. Loose run files (records, status JSON) and the assembled artifact both held state.
**Decision:** The deliberation artifact is the single canonical resume source. Resume parses artifact frontmatter and per-section HTML-commented canonical JSON blocks, recomputes hashes, and fails closed on mismatch: corrupt sections require explicit `--skip-corrupt-section <id>` (or `--skip-all-corrupt` / `--yes-skip-corrupt` with user approval). User direction on resume is recorded as a first-class `USER_INTERVENTION` round. Completed sections are never reconstructed from the current input file.
**Rationale:** The artifact is durable, human-readable, and already the accountability surface; making it canonical keeps resume single-file and makes tampering/corruption detectable. Silent recovery or silent restarts would falsify the audit trail.
- **Status:** Accepted.
