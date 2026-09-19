---
id: BL-260916-session-fidelity-opt
title: 'Session fidelity: opt-in --include-activity for observer and exporter'
status: open
priority: medium
scope: feature
scope_estimate: L
labels:
  - session-observer
  - session-export-transcript
  - transcript-core
  - substrate
assignee: null
created: 2026-09-16T17:04:56.373Z
updated: 2026-09-19T01:39:17.103902+00:00
associated_issues: []
external_plans: []
---

## Description

Add an opt-in rich activity view to session-observer and session-export-transcript: correlated tool calls and results with exact native names and call IDs, categories, bounded previews, shell exit evidence, file operations, MCP and subagent activity, session metadata, and explicit coverage states (available, not-recorded, not-found, not-read, unsupported, malformed, truncated). Default digest and sanitized export stay unchanged; existing --include-tools and --debug remain compatible. Research and staged plan: .oat/repo/reference/research/session-fidelity-2026-09-10/ (prepared 2026-09-10; uses cli-continues as reference implementation and selective code donor, not as storage model). Concrete correction from that research: the current Codex normalizer emits no general function_call results or custom tool calls (only ask-user answers), which is a coverage gap to close before any activity view. Sequences before the shared-session-log substrate (BL-260619) because the substrate's merged log should reuse this activity contract.

**Vault sources (2026-09):** `02 - Projects/Skills/Research/2026-09-10 Session Fidelity Implementation Handoff.md` (the handoff that proposes `--include-activity`), `04 - Resources/AI/Harnesses/Agent Sessions/Session Fidelity and Activity Model.md` (activity/coverage vocabulary), `04 - Resources/AI/Harnesses/Agent Sessions/Session Evidence for Retrospectives.md` (how retros should use the evidence). Note: the 2026-06-19 shared-session-log substrate idea filters tool calls out of its merged log; when the substrate is designed, decide whether its merged log adopts this activity contract instead.

## Acceptance Criteria

- Stage 1: a detailed read helper returns each decoded record with one-based physical line and existing zero-based logical record index and parse diagnostics; `readRecords()` and logical-index behavior unchanged; a shared `activity/` module holds native extractors, the typed contract, classification, and a pure projection function.
- Stage 2: Codex `function_call`, `function_call_output`, `custom_tool_call`, `custom_tool_call_output`, and web-search evidence are supported with parsed arguments and the original carrier preserved; `call_id` kept independent of message `id`; ask-user handling and its human/auto caveat preserved.
- Stage 3: `--include-activity` on both skills threads through review, catch-up, and watch without changing exact-pin or checkpoint behavior; the digest gains a separate activity envelope; the exporter keeps its default sanitization; generated distributions register the new shared modules.
- Stage 4: Cursor activity identity comes from the frame analysis; observer v2 and exporter paths tested separately; absent result payloads are reported as not-recorded, never implied.
- Late results, malformed input, and large outputs are covered by tests; counts state whether they describe the delta, the display window, or the whole source.
- Activity exports are labelled as activity/debug exports, not publish-safe; sidecar reads confined to expected session artifacts or approved roots.
- Docs: both SKILL.md files and user guides document the flag, limits, sensitive data, and unsupported surfaces. Out of scope: daemon, cross-session warehouse, MCP server, all 17 provider adapters, automatic skill rewriting.

## Accepted scope refinement — 2026-09-19

The user approved deferring per-record byte ranges on the new detailed Claude/Codex reader until a concrete consumer requires them. Physical line numbers, logical record indices, original carriers and parse diagnostics remain required. Existing Cursor byte offsets/continuity checks, source-size metadata, UTF-8 output-budget accounting and LF/Unicode/CRLF framing regressions remain in scope. This amends Stage 1; historical research snapshots retain their original proposals.
