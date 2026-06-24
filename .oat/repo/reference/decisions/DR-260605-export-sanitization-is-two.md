---
id: DR-260605-export-sanitization-is-two
title: Export sanitization is two layers — structural filtering plus
  evidence-driven content detectors, drop-on-match
date: 2026-06-05
status: Accepted.
legacy_id: DR-016
---

### DR-016: Export sanitization is two layers — structural filtering plus evidence-driven content detectors, drop-on-match

- **Date:** 2026-06-05
**Context:** Structural filtering (dropping tool calls/results) is insufficient on Codex/Cursor, where injected context (`<system-reminder>`, environment context, skill bodies) arrives as plain user/assistant text.
**Decision:** Layer 1: shared `normalizeEntries` drops structural records. Layer 2: export-owned `sanitize.mjs` drops entire entries matching hidden-payload detectors (system-reminder, task-notification, local-command wrappers, environment context, skill/AGENTS.md content, subagent notifications, etc.), with the detector table derived by grepping real provider stores. On match, drop the whole entry — prefer false positives over leaks.
**Rationale:** The privacy boundary is export-specific policy, so it lives in the export skill, not the shared core. Evidence-driven detectors validated against 41k+ real entries (0 survivors) beat speculative patterns.
- **Status:** Accepted.
