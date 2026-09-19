---
id: BL-260919-grouped-activity-summaries
title: Grouped activity summaries and derived enrichments adapted from cli-continues
status: open
priority: low
scope: feature
scope_estimate: M
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
  - presentation
assignee: null
created: 2026-09-19T19:23:59.953Z
updated: 2026-09-19T19:23:59.953Z
associated_issues: []
external_plans: []
---

## Description

Deferred from BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter. Version 1 presents a chronological list with raw input previews, native tool names and a small category table. The presentation layer of cli-continues is its best-executed part and is the intended starting point here: `src/utils/tool-summarizer.ts`, `src/utils/diff.ts` and `src/utils/markdown.ts` at commit e486cd22a592d89d890cff056624647fbe9cbe80 (MIT). No cli-continues code was adapted in version 1. The 2026-09-10 research (05-reuse-porting-map.md, 11-source-audit-corrections-and-limitations.md) lists the defects to fix while porting.

## Acceptance Criteria

- A grouped-by-tool index and derived fields (command, file paths, query, URL, diff preview with line counts) are added without replacing the chronological trace or the native names.
- Adapted files carry an attribution header naming the upstream commit and original path, and a `THIRD_PARTY_NOTICES` entry preserves the MIT notice; only code actually copied is attributed.
- The known upstream defects are fixed: no first-N sampling that hides late failures, tails taken from the full available output, diff statistics computed before truncation.
- Enrichments are derived only from recorded payloads and are never presented as proof that a file changed or a command succeeded.
- Shipped only when a recurring need is recorded, per the design's reintroduction rule.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
