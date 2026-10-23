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
updated: 2026-10-23T00:30:34.696Z
associated_issues:
  - https://github.com/tkstang/skills/issues/136
external_plans: []
---

## Description

Deferred from BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter. Version 1 presents a chronological list with raw input previews, native tool names and a small category table. The presentation layer of cli-continues is its best-executed part and is the intended starting point here: `src/utils/tool-summarizer.ts`, `src/utils/diff.ts` and `src/utils/markdown.ts` at commit e486cd22a592d89d890cff056624647fbe9cbe80 (MIT). No cli-continues code was adapted in version 1. The 2026-09-10 research (05-reuse-porting-map.md, 11-source-audit-corrections-and-limitations.md) lists the defects to fix while porting.

The combined M scope now also covers a bounded view over one frozen StructuredActivityCapture. Deliver the frozen-input reader, explicit selector and ActivityReport-shaped view together as the first slice; sequence the existing cli-continues enrichments later. Both slices retain the recorded-recurring-need gate, and the first slice can be used without porting those enrichments. Re-estimate when the enrichment slice starts or if both slices must ship together.

## Acceptance Criteria

- Given one explicitly supplied immutable frozen capture-file byte buffer, parsed by the reader into a supported StructuredActivityCapture, and half-open record-index bounds `[start, end)` or endpoint event keys, read its activity and render an ActivityReport-shaped bounded view through a documented `session-retro` step without recapturing or reading native stores. Reject unsupported envelope/activity versions and invalid, reversed, absent or ambiguous selectors. This usable frozen-reader/view is the first slice; cli-continues enrichments follow later within the combined M scope.
- Reuse deliveryRange, counts.capturedSource/deliveredRange/displayed, omitted (including invocationLimitGroups and byteLimitGroups), callContexts with availability outside-delivered-range, coverage, diagnostics and source metadata with their existing meanings. Add only inputDigest (SHA-256 of that same immutable supplied byte buffer, before parsing; never a re-serialization of the parsed value) and selection; no EpisodeView type or separate projection-version field. Record-index bounds use the declared index base and existing half-open `[start, end)` semantics; event-key endpoints resolve to the enclosing half-open record range, include all events in both endpoint records, and report the resolved bounds explicitly.
- Preserve event keys, locators, recorded correlations, coverage states and existing truncation. Outside-range call context stays labelled and outside selected counts; a view cannot restore content omitted from its input. Verify the frozen narrative pair only when narrative anchors are requested. The frozen-view reader accepts at most 64 MiB (67,108,864 bytes) of input, 1,000,000 recorded activity events and a selected half-open record range of at most 100,000 records; reject an exceeded input/event/range limit visibly without truncating the input or silently narrowing the selection. These are frozen-view admission limits only and do not change complete-capture export. After admission, apply the existing review projection limits: 128 KiB (131,072 bytes) of serialized output, 1,024 invocation groups, 2 KiB previews and 256-byte late context. The output cap includes inputDigest, selection and mandatory provenance/coverage/limit metadata; reserve that overhead before projecting and verify the final serialized size. These review limits, rather than complete-capture unlimited budgets, govern the view; preserve existing priority and omission accounting, including invocationLimitGroups and byteLimitGroups. Fail visibly when mandatory metadata cannot fit; late failures are displayed or accounted for as omitted. Never mutate the frozen pair.
- New automated coverage is limited to the frozen-reader boundary: unsupported envelope version, invalid selector, a selected result whose call lies outside the range, and mandatory metadata budget exhaustion. Reuse existing generic projection determinism, priority and clipping coverage.
- A grouped-by-tool index and derived fields (command, file paths, query, URL, diff preview with line counts) are added without replacing the chronological trace or the native names.
- Adapted files carry an attribution header naming the upstream commit and original path, and a `THIRD_PARTY_NOTICES` entry preserves the MIT notice; only code actually copied is attributed.
- The known upstream defects are fixed: no first-N sampling that hides late failures, tails taken from the full available output, diff statistics computed before truncation.
- Enrichments are derived only from recorded payloads and are never presented as proof that a file changed or a command succeeded.
- Both the frozen-reader/view first slice and later cli-continues enrichments ship only when a recurring need is recorded, per the design's reintroduction rule.

## Dependencies

- **BL-260916-session-fidelity-opt — Session fidelity: opt-in --include-activity for observer and exporter**
