---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-18
oat_generated: false
oat_template: false
---

# Design: session-fidelity

## Overview

Add a shared, deterministic activity pipeline alongside the existing conversation pipeline. With `--include-activity`, both skills expose attributable tool calls and results, selected recorded session metadata, bounded previews, and explicit coverage. Without the flag, their existing output remains unchanged. The activity path retains native names, call IDs, argument carriers, and source locations before applying display limits; it does not reconstruct evidence from rendered conversation text.

Build correlation from the selected session's available source before selecting the delivered range. This lets a newly arrived result reference its earlier call without replaying the call or changing observer checkpoints. Claude and Codex use detailed record extraction; Cursor uses its frame analysis and existing continuity rules. The observer receives a separate optional activity envelope, and the exporter adds a clearly labelled activity section alongside its sanitized conversation. Missing evidence remains explicit, and a pending or missing result never implies success.

Keep this increment within the selected transcript's recorded evidence. The proposed initial scope reads no additional child/result sidecars; it reports them as `not-read` where their existence is indicated, and does not invent their contents. This covers recorded MCP/subagent activity without introducing recursive ingestion. Source-native metadata can be represented, but instruction bodies and recorded reasoning are not implicitly exposed by the activity flag. Later sections will define precise identities, budgets, interfaces, and failure behavior.

## Design Validation

- Design depth: lightweight, selected by the user on 2026-09-18.
- Interaction mode: collaborative, mapped from persisted `workflow.designMode=selective` according to quick-start.
- Overview: drafted; awaiting user validation, including the proposed no-sidecar scope.
- Architecture, Component Design, Data Models, API Design, Error Handling, and Testing Strategy: not yet drafted. Each will be validated before planning.

## References

- [Discovery](discovery.md)
- Backlog: `.oat/repo/pjm/backlog/items/BL-260916-session-fidelity-opt.md`
- Research proposal: `.oat/repo/reference/research/session-fidelity-2026-09-10/06-optional-activity-flag-design.md`
- Existing source and decision evidence is catalogued in discovery.
