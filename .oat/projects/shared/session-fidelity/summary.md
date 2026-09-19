---
oat_status: complete
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-19
oat_generated: true
oat_summary_last_task: p10-t01
oat_summary_revision_count: 0
oat_summary_includes_revisions: []
---

# Summary: session-fidelity

## Overview

This project added an opt-in, source-attributable activity view to the session
observer and Markdown transcript exporter while preserving their default
conversation behavior. It also corrected native Codex parent/child identity,
saved-position binding, and Claude provenance so stateful operations refuse
ambiguous or changed sources instead of silently reusing unsafe state.

The work fulfilled and archived `BL-260916-session-fidelity-opt`. Local
acceptance and eleven independent phase reviews through p10 passed. The
accepted p08 stack was republished as ready PRs #94, #95, and #96; only the p10
top-layer effective-filter correction awaits publication. No merge, release,
installation, global sync, or live-provider acceptance has occurred.

## What Was Implemented

- Added exact Codex session identity and lineage discovery, root-first ranking,
  exact native pins, identity-aware caches, and source-bound observer state.
  Missing, mismatched, replaced, or truncated sources fail closed with scoped
  recovery guidance.
- Corrected Claude human, task-notification, peer, unknown, and absent
  provenance across observation, export, fork, and collaboration boundaries.
  Envelope-shaped content cannot overwrite explicit native provenance.
- Added a detailed JSONL reader with one-based physical lines, zero-based
  decoded record indices, stable parse diagnostics, and legacy `readRecords()`
  compatibility. Sanitized native captures document the supported Claude,
  Codex, and Cursor evidence.
- Built a shared dependency-free activity pipeline for native extraction,
  exact-ID correlation, classification, range selection, and bounded
  projection. Reports retain honest outcomes, source locations, coverage,
  captured/delivered/displayed counts, and omission accounting without reading
  sidecars or child trajectories.
- Added `--include-activity` to observer review, catch-up, watch, and transcript
  export. Watch can deliver activity-only deltas through the existing cursor
  while keeping event logs metadata-only; exporter output remains stateless,
  sanitized, and explicitly labelled as sensitive activity/debug data.
- Made activity mode report its effective suppression of legacy tool markers
  and count the suppressed call/result entries consistently, including under
  observer debug output.
- Integrated Cursor frame evidence using positional call identity and existing
  terminal settlement. Stateful delivery waits for settled turns and avoids
  replay; stateless review/export may show pending evidence without inventing
  call IDs, result payloads, versions, or usage.
- Updated canonical skills, user and engineering documentation, generated
  standalone/plugin payloads, four affected skill versions, and the changelog.
  Post-p10 verification passed type checking, generated-build freshness, 2,232
  tests with one expected skip, repository validation, smoke, version checks,
  changed-file formatting/linting, a 56-page docs build, and fixture privacy
  checks.
- Applied the four p08 corrections from PR #94 review: aligned completed
  planning status, removed withdrawn multi-line recovery guidance, kept
  detached MCP result subtrees opaque without a unique same-file ID match, and
  corrected the LF framing rationale to describe the observed scanner rather
  than attribute Unicode separator handling to Node `readline`.

## Key Decisions

- **Stateful work requires exact identity.** Native session identity and source
  path are propagated through discovery, caches, pins, and saved positions.
  Ambiguous identity or a changed binding refuses state reuse; valid legacy
  bindings retain their offsets.
- **Digests are natural-language-only by default; tool activity is opt-in.**
  Activity is a separate optional envelope and exporter section. With the flag
  absent, existing digest, export, sanitization, and state behavior remains the
  contract.
- **Content availability is not completion.** Coverage distinguishes available,
  not-recorded, not-found, not-read, unsupported, malformed, and truncated
  evidence, while lifecycle and call outcomes remain separate.
- **Separate observation and collaboration cursors.** Activity delivery uses the
  existing observation cursor and checkpoint rules without gaining authority
  to wake collaborators or confirm completion.
- **Watch event logs are metadata-only.** Activity content remains on the digest
  output path; event logs record only delivery metadata such as an
  activity-only marker.
- **Export sanitization is two layers.** Default conversation exports preserve
  structural filtering and evidence-driven content filtering. Opt-in activity
  is bounded, escaped as data, and clearly labelled rather than treated as a
  publish-safe export.
- **Declared skill distributions.** Canonical sources and distribution
  declarations own every generated skill/plugin payload and transitive version
  bump; generated outputs are never edited directly.

## Design Deltas

- The approved refinement deferred new per-record byte ranges until a concrete
  consumer needs them. Physical line numbers, logical record indices, source
  size, Cursor continuity offsets, and UTF-8 output budgets remain implemented
  and tested.
- Final review promoted the watcher `stat` diagnostic into p07: missing sources
  retain reset guidance, while non-missing errors now preserve state and report
  `WATCH_TRANSCRIPT_STAT_FAILED` without misleading recovery instructions.
- Review-driven corrections tightened provenance ownership, coverage and
  omission accounting, final-format byte budgeting, Cursor settlement, and
  effective legacy-filter reporting. These changes stayed within the activity
  and identity contracts.
- The p08 review corrections changed closeout records, recovery guidance, MCP
  evidence traversal, and framing documentation without changing the approved
  activity contract or adding a compatibility path.

## Notable Challenges

- Identity and activity work crossed shared transcript code and several
  independently shipped skills. Four owner versions, changelog entries, docs,
  and generated outputs had to advance together while preserving local stack
  boundaries.
- Review found subtle evidence errors involving interrupted outcomes, Claude
  `toolUseResult`, ambiguous child lineage, duplicate previews, and final-format
  budgets. Bounded recovery commits fixed each issue and fresh phase reviews
  passed.
- PR #94 review arrived after the three-layer stack was already published.
  Applying its four corrections to the bottom layer required cascade rebasing
  the identity and activity layers and republishing the accepted p08 stack.
  The later p10 review correction now leaves only the activity top layer ahead
  of its ready remote PR head.

## Tradeoffs Made

- Extraction and correlation operate on one selected source capture and keep
  full native evidence until presentation budgets apply. This avoids display
  truncation changing semantics, at the cost of additional opt-in CPU and
  memory work.
- Calls correlate only through unique explicit native identifiers. Ambiguous or
  absent identifiers stay unmatched rather than using timing, command text, or
  cross-stream inference.
- The first increment supports Claude, Codex, and Cursor evidence recorded in
  the transcript. It does not recursively ingest child sessions, follow
  arbitrary output paths, expose reasoning/instruction bodies, or reconstruct
  missing provider evidence.

## Integration Notes

- Activity schema version 1 is additive to the observer digest; the exporter
  remains Markdown-only. Existing consumers that omit `--include-activity`
  continue on the legacy path.
- Physical lines and decoded record indices are provenance coordinates, not
  observer checkpoints. Cursor frame and terminal delivery positions remain a
  separate coordinate system.
- PRs #94 through #96 remain open, published, non-draft, and ready. Their
  republished heads include the accepted p08 planning-status,
  recovery-guidance, detached-MCP, and LF-framing corrections. Only the p10
  effective-filter correction on the activity layer awaits publication before
  remote review or merge can cover it.
- Merge, release, installation, global sync, and live-provider acceptance
  remain separate lifecycle steps and have not occurred.

## Follow-up Items

- **Codex item/call relation:** choose one authoritative native relation for
  completed items, then align correlation code, maintained schema prose, and a
  regression. Current exact native-string equality is fail-closed, but its
  `payload.id` use disagrees with documented guidance.
- **Nested web-search query carriers:** when a captured native
  `response_item.web_search_call` establishes a nested query location, retain
  that carrier or report explicit unsupported coverage. Do not encode a
  speculative provider shape before evidence exists.
- **Cursor final record without a newline:** reconcile the activity export's
  frame-scanned conversation source with legacy `readRecords()` behavior and
  add a focused fixture for a valid unterminated final record.
- **Claude metadata-only watch deltas:** if operators report noise, collapse
  repeated model metadata or exclude metadata-only groups from the renderable
  activity signal, with a thinking-only assistant regression.
- **Repeated observer reads and warnings:** thread the existing `capturedRead`
  seam through saved-position validation and digest construction if repeated
  parsing or duplicate malformed-line warnings become operationally material.
- **Durable backlog discoverability:** the five technical follow-ups above are
  recorded here and in the archived gate review. Create a separately
  prioritized backlog item only when product-priority direction selects that
  work.

## Workflow Observations

### 2026-09-19 · structural · oat gate review · plan

target=cursor-fable-5-1-high threshold=important exit=1 status=review_failed run=96ff6416-8431-4145-ba18-985bec37b222

### 2026-09-19 · structural · oat gate review · plan

target=cursor-fable-5-1-high threshold=important findings=critical:0,important:0,medium:4,minor:3 exit=0 status=ok artifact=.oat/projects/shared/session-fidelity/reviews/artifact-plan-review-2026-09-19T003400Z.md run=ddd86035-011c-447a-bfac-9ac6191a89fe

### 2026-09-19 · structural · oat gate review · plan

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:1,minor:3 exit=0 status=ok artifact=.oat/projects/shared/session-fidelity/reviews/artifact-plan-review-2026-09-19T004303Z.md run=a40ecbf5-e651-4bdc-8667-4d9d92eece59

### 2026-09-19 · structural · oat-project-implement · p00

sf-p00-pass-20260919: p00 passed independent review with zero findings and zero fix loops; see implementation.md and reviews/p00-review-2026-09-19T014930Z.md.

### 2026-09-19 · structural · oat-project-implement · p01

sf-p01-terminal-20260919: phase blocked after p01-t03 recovery attempt 2 failed a pathname-specific EISDIR assertion; correction restored, terminal ledger validated, used count 2 preserved, no phase review or fix loop. See implementation.md.

### 2026-09-19 · structural · oat-project-implement · stop

sf-stop-recovery-20260919: stopping under phase-execution failed-attempt terminal rule; renewed direction needed to reapply the bounded mark-read correction with a portable assertion. Same target and history retained; see implementation.md.

### 2026-09-19 · structural · oat-project-implement · p01

sf-p01-outcome-20260919-d4069b77 Phase p01 passed after bounded fixes and fresh review: 0 Critical, 0 Important, 1 deferred Medium; see reviews/p01-review-2026-09-19T122907Z-round2.md.

### 2026-09-19 · structural · oat-project-implement · p02

sf-p02-phase-outcome-20260919 p02 passed after five tasks, two review-fix rounds, and governance-final review; artifact reviews/p02-review-2026-09-19T145413Z-round3.md.

### 2026-09-19 · structural · oat-project-review-provide · final-review-2026-09-19T180659Z.md

final-review-20260919T180659Z validated final review orchestration; see reviews/final-review-2026-09-19T180659Z.md.

### 2026-09-19 · structural · oat gate review · final

target=claude-fable-skip-permissions threshold=important findings=critical:0,important:0,medium:0,minor:6 exit=0 status=ok artifact=.oat/projects/shared/session-fidelity/reviews/final-review-2026-09-19T190056Z.md run=05d3cda3-7de8-475c-b831-9bdd011c51c7
