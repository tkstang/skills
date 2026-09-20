---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-20
oat_phase: plan
oat_phase_status: in_progress
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_import_reference: null
oat_import_source_path: null
oat_import_provider: null
oat_template: true
oat_generated: false
---

# Implementation Plan: session-evidence-followups

**Goal:** Complete the six approved backlog tickets in one wave through a mergeable PR.
**Baseline:** `be6cab1e859ae786b34fc2194249ed2d00493fd6` (merged PRs 96 and 98).
**Architecture:** Extend `readRecordsDetailed → extractActivity → correlateActivity → projectActivity`; retain exact native identity, source locators, captured snapshot and coverage. Watch terminal events use the consumed native range independently of activity. Session retro consumes a frozen export.
**Stack:** TypeScript, Node standard library, Vitest, generated standalone/plugin distributions.
**Commits:** Conventional Commits, one product commit per task plus separate project bookkeeping.

## Execution and Review Contract

One canonical plan owns the entire wave. Root owns judgment, planning, integration and review disposition. User-selected Sol owns implementation through native OAT phase implementers. User-selected `consensus:review` invokes `claude:opus` for the plan, each of p01–p04 and final integration; retain actual invocation and result artifacts. No extra duplicate Fable or native reviewer gates. Root conducts complexity review after Opus plan findings are resolved and obtains another Opus review for material plan changes. Hold the worktree stable during each Consensus invocation. Escalate real scope conflicts or unavailable required reviews; do not silently substitute a model or loosen acceptance.

Run to a mergeable PR without stopping at phase boundaries. No merge/release. Record evidence and remaining acceptance honestly. Installation/live-provider acceptance beyond the explicitly requested reviews is out of scope.

## Parallelism

Read-only watcher and activity reconnaissance ran concurrently. Product phases are sequential: p01 and p02 both affect observer's generated payload/version; p02 and p03 share activity contracts and exporter output; p04 depends on the final exporter CLI. All touch the shared changelog/distribution builds. These are not disjoint phase write sets, so `oat_plan_parallel_groups: []`. Within-phase independent read-only inspection or verification may overlap when it does not compete for CPU-sensitive stress tests or mutate a review snapshot. Do not create hidden implementation worktrees.

## Shared Task Requirements

Every task reads applicable AGENTS files, updates canonical owners only, uses focused tests, self-reviews its complete diff, and commits its owned files. A shared-source change bumps all affected shipped skill versions determined from the distribution catalog; a canonical skill test/doc change also bumps that skill. Add named versions to CHANGELOG Unreleased, run `pnpm run build`, inspect generated changes, and include them atomically with the task. Never hand-edit generated payloads.

**Format for every task:** `pnpm exec oxfmt <explicit changed authored file paths>`; exclude AGENTS/CLAUDE instructions, generated payloads and OAT mirrors. For project Markdown ignored by default, use `pnpm exec oxfmt --stdin-filepath <file> < <file> > <temporary-file>` then replace only that owned file. No repository-wide formatting.
**Task checks:** listed scoped Vitest command, `pnpm run type-check` when TypeScript changes, `pnpm run build:check`, and `pnpm run validate:skill-versions -- --base-ref be6cab1e859ae786b34fc2194249ed2d00493fd6` after the build. Inspect no-change defaults and public docs where relevant. Final full checks are below.

## Phase 1: Reliable and informative watch events

### Task p01-t01: Stabilize SIGTERM re-arm evidence

**Ticket:** BL-260919-stabilize-the-watcher-sigterm — Stabilize the watcher SIGTERM re-arm test.
**Files:** `src/skills/session-observer/src/watch.test.ts`, owning skill version, CHANGELOG and generated outputs. Runtime `src/skills/session-observer/src/lib/watch.ts` only if investigation proves a real product race.

Replace the re-arm subprocess's 120ms lifetime assumption with a condition-based wait for the expected delta, bounded by a generous deadline, followed by clean stop and assertions on exact count, checkpoint and process exit. Audit other subprocess signal/timer count tests and record fixes or reasons no change is needed. Do not skip tests, mark them flaky, or retry failed results. If a runtime race exists, fix it with a regression or explicitly file the defect; do not merely lengthen its window.

**Verify:** `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts`. Run the exact re-arm test 50 consecutive times, including a bounded artificial CPU-load interval; retain per-iteration results and stop/investigate on failure. Use a temporary local harness and ensure child/load cleanup; no shipped stress framework. Three consecutive CI `validate` runs are a final PR acceptance item, not implied by local passes.
**Commit:** `test(session-observer): stabilize SIGTERM watcher re-arm`.

### Task p01-t02: Emit unsuccessful terminal metadata

**Ticket:** BL-260919-surface-terminally — Surface terminally unsuccessful peer turns as watch events.
**Files:** observer `src/lib/{types,digest,watch}.ts` (resolve actual digest owner before editing), `src/watch.test.ts`, narrow shared native decoder under `src/shared/transcript/`, observer user guide and skill instructions/version, CHANGELOG/generated outputs.

Decode explicit recorded native terminal failures within the already consumed range. Codex `event_msg.payload.type=task_complete` with `payload.error` and `turn_aborted`; Cursor `turn_ended` with recorded error/aborted/cancelled status only if supported by the actual frame source. Claude item/tool errors are not terminal turn failures; no unsupported inferred terminal signal.

Emit one `terminal` event with exact runtime/native session identity, record or frame locator, unsuccessful status, native error code when available and recorded retry evidence. No transcript/error body. Reuse exact-session checkpoints for dedup across polling/restart; retain existing at-most-once checkpoint semantics and document them. `--quiet-empty` must not hide terminal-only events. Do not add them to transcript entries or peer-message/continuation eligibility. Optional event logs retain metadata only.

**Retry evidence:** local recorded Codex limits carry `payload.error.codex_error_info=usage_limit_exceeded`; retry clock/date is in `payload.error.message`, not a structured timestamp. Match only the verified provider retry sentence, expose the time/date fragment with `inferred-from-error-message` provenance and source locator. Do not expose the full message, guess date/timezone, or turn a clock into an absolute instant. Unrecognized messages yield no retry field. The metadata names ambiguity explicitly.

**Verify:** virtual-clock/fixture tests for provider limit+retry, abort, quiet-empty, one event per record, restart dedup, metadata-only log, unchanged successful/no-signal behavior, malformed retry text and no body leakage. Test that downstream collaboration does not treat terminal events as peer messages. `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts` plus any changed shared decoder and collaboration suite. Document per-runtime limitations.
**Commit:** `feat(session-observer): report unsuccessful terminal turns`.

## Phase 2: Native skill and usage evidence

### Task p02-t01: Attribute skill activity without instruction bodies

**Ticket:** BL-260919-skill-attribution-in-session — Skill attribution in session activity events.
**Files:** `src/shared/transcript/activity/{types,extract,claude-code,codex,cursor,project,render}.ts` as needed, colocated tests/fixtures, native-schema/user documentation, affected skill versions, CHANGELOG/generated outputs.

Add optional typed skill evidence to events while retaining existing native tool names. Claude copies recorded top-level `attributionSkill`; `nativeName=Skill` structurally identifies an invocation and structured native arguments may provide its name. Never derive attribution from prose/previews. Source-wide metadata reports names from native attachments with provenance and locators: `attachment.type=skill_listing` uses `attachment.names[]`; `invoked_skills` uses `attachment.skills[].name` and is labelled invoked, not availability. Exclude content/path bodies; validate strings and malformed shapes.

Codex/Cursor direct read-tool structured path arguments ending in `SKILL.md` supply inferred file-read skill-load evidence. Use actual known read schemas; do not parse arbitrary command strings or interpret prose mention as a load. Preserve the path/locator necessary to resolve the skill while distinguishing load evidence from a proven invocation.

Source-wide skill metadata is labelled captured-source, not delivered-range. Carry metadata through extraction/correlation/projection with existing byte accounting; compact reports may mark omissions but must not silently mislabel completeness. No recorded skill version is invented. Docs explain timestamp-relevant install/git lookup is inferred, may be unknown, and does not prove executed revision.

**Native structural provenance:** Claude listing at local `~/.claude/projects/-Users-Shared-Vault/091fa1a7-89a1-4a02-9a50-77717216a76b.jsonl:19`; invoked attachment at `~/.claude/projects/-Users-tstang-Code-personal-agents/c4b468fd-8582-474d-8223-82167ff66a50.jsonl:5766`. Persist only synthetic structural fixtures, never raw user content.
**Verify:** `pnpm run test:vitest src/shared/transcript/activity`; native attribution present/absent, Skill discriminator, names-only attachments with body sentinel exclusion, malformed attachments, direct-read positives versus shell/prose negatives, source/delivery scope and compact-budget cases.
**Commit:** `feat(session-activity): add native and inferred skill evidence`.

### Task p02-t02: Preserve honest token accounting

**Ticket:** BL-260919-token-and-usage-accounting — Token and usage accounting for session activity.
**Files:** same activity owner, usage helper only if it reduces complexity, fixtures/tests, native-schema/user docs, affected skill versions, CHANGELOG/generated outputs.

Add captured-source usage metadata preserving recorded fields, native locators, semantics and model where recorded. Claude deduplicates by exact native session plus `message.id`; equal repeats collapse, conflicts create diagnostics and never sum competing copies. Missing message IDs cannot safely deduplicate: label uncertainty instead of fabricating totals. Model comes from recorded `message.model`.

Codex preserves cumulative `total_token_usage`, per-turn `last_token_usage`, and response-joinable `token_usage_record` as separate semantics. Do not add cumulative and per-turn counters together, double count repeated snapshots or invent turn joins. Decreases create a segment/reset diagnostic and never negative use. Associate a model only with native evidence (e.g. recorded turn_id and turn_context), preserving unknown model otherwise. Cursor reports not-recorded, not zero. Group per model only where evidenced; retain unknown and reset boundaries. Report tokens only, no pricing types/configuration or currency machinery.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity`; repeated Claude blocks and conflicting usage, missing IDs/models, multiple native sessions in source rejecting/matching identity consistently, Codex cumulative/per-turn separation and decrease/repeated samples, response usage presence/absence, Cursor not-recorded, bounded report metadata budget and default output parity.
**Commit:** `feat(session-activity): preserve native token usage semantics`.

## Phase 3: Complete structured activity capture

### Task p03-t01: Export complete sensitive JSON from one snapshot

**Ticket:** BL-260919-uncapped-structured-activity — Uncapped structured activity export for cross-session analysis.
**Files:** `src/skills/session-export-transcript/src/{session-export-transcript,cli.test}.ts`, its SKILL.md, narrow activity projection/types/render followup, both observer/exporter user guides, affected skill versions, CHANGELOG/generated outputs.

Add explicit `--activity-output <path>` to exporter for one exact `--session` native pin; reject `--all` and ambiguous/name discovery. The flag enables activity capture independently; it does not silently alter normal narrative/default output or require capped observer review. Capture once via existing detailed reader and derive both requested representations from that snapshot. Never write observer checkpoints/markers. Validate activity output is distinct from narrative output and source transcript/state paths before writing so it cannot overwrite evidence. File failures return failure; no partial success claim. Use a small exporter-owned temporary sibling plus rename for the JSON artifact, with cleanup and clear existing-destination behavior consistent with documented exporter overwrite behavior. Do not create a shared filesystem framework.

The JSON envelope has format/schema version and `sensitive: not-publish-safe`, and carries the ActivityReport with runtime, exact native session identity, capturedAt, sourceBytes, source/decoded counts, full delivery range, coverage, diagnostic/omission information, metadata and event locators. Use one report schema, not a duplicate graph. Introduce an explicitly unbounded projection for this file (no total-byte or invocation eviction), retaining the same per-preview cap as Markdown. Existing review/catch-up/Markdown budgets remain unchanged. Invalid/partial source reads retain honest coverage and counts; complete means all captured supported invocations, not proof the session stopped or all runtime actions were recorded.

**Verify:** `pnpm run test:vitest src/skills/session-export-transcript/src/cli.test.ts src/shared/transcript/activity`. Test exact selection/rejected ambiguity and --all, stateless sentinel, default output unchanged, sensitive schema metadata, coverage preservation, every Markdown invocation key present in round-trip parsed JSON from the same fixture, >1024 invocations, byte-budget overflow without structured invocation eviction (use injectable tiny test budget instead of huge fixtures), preview cap, invalid/output collision/write failure and temporary-file cleanup. Both guides explain sensitivity and snapshot limits.
**Commit:** `feat(session-export): write complete structured activity captures`.

## Phase 4: Evidence-backed session retro

### Task p04-t01: Review frozen activity with provenance

**Ticket:** BL-260919-session-retro-consume-activity — Session-retro: consume activity evidence.
**Files:** `src/skills/session-retro/SKILL.md` and existing owned references if needed, user guide, skill version, CHANGELOG/generated outputs. No new runtime/harness.

Require execution from a different session than the target. Resolve exact identity and capture full narrative plus activity to a file before analysis using p03's verified CLI; analyze only the frozen artifacts, never mix later live reads into findings. For active/unknown-ended targets title as a review of captured activity. Report contamination if detected, including multiple writers; do not assert detection is exhaustive.

Use full exports, not capped review output. Each finding separates observed evidence with event/source keys, interpretation and proposed change. Pass the seven coverage states through unchanged (available, not-recorded, not-found, not-read, unsupported, malformed, truncated); absence only supports a negative claim when native recording is reliable and capture coverage supports it. Human-intervention analysis links request → activity → native-human correction → recovery; automated notifications are not human corrections. Keep unknown authorship explicit.

Output template: outcome, what worked, friction, improvement candidates with evidence, likely cause, suggested change, validation; include human interventions and coverage limits. Explain Cursor calls-only/no results/no timestamps, Codex separately correlated outcome streams, Claude no exit codes. Native skill usage and token metadata support hypotheses, not causal claims or guessed versions/cost. Propose changes only; never edit another skill as part of retro.

**Verify:** inspect two representative frozen fixtures (result-bearing Claude/Codex and limited Cursor) against every checklist requirement. Validate command examples against generated CLI/help and the p03 round-trip fixture. Use source/manifest/build validation, not prose snapshot tests or a new evaluator. `pnpm run build:check` and `pnpm run validate`.
**Commit:** `feat(session-retro): analyze frozen activity evidence`.

## Final Acceptance and Delivery

Root integrates and checks `pnpm run test`, `pnpm run type-check`, `pnpm run build:check`, `pnpm run validate`, `pnpm run smoke`, changed-file lint/format, version validation and `git diff --check`. Resolve failures with bounded Sol fixes and meaningful rechecks. Independent Opus final review covers complete tracked delta from baseline plus acceptance mapping. Retain receipts; no claims based only on exit code.

Open/push one Conventional Commit titled PR. Inspect remote reviews/checks; disposition all findings, implement valid fixes and re-review changed behavior. For watcher acceptance obtain three consecutive distinct successful CI workflow runs with the `validate` job on the fixing PR (via pushes or supported reruns without retrying away a failure). Record URLs, head and job results. A failure resets the consecutive success count and requires investigation. Preserve the 50-run local log with CPU-load evidence.

Close each fully satisfied item via repo Backlog Lifecycle: status/updated, completed.md entry, move to archived, regenerate index and remove any consumed handoff. Update current-state/roadmap/priority-alignment for this batch. Do not close the watcher ticket before its CI proof. OAT implementation owns summary → documentation → PR closeout, honoring user authorization to deliver but not merge. Complete goal only after requirement-by-requirement proof and current PR mergeability/checks. Further wave requires separate selection.

## Reviews

| Scope  | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | pending | -    | -        | -             | -          | -           |
| p02    | code     | pending | -    | -        | -             | -          | -           |
| final  | code     | pending | -    | -        | -             | -          | -           |
| spec   | artifact | pending | -    | -        | -             | -          | -           |
| design | artifact | pending | -    | -        | -             | -          | -           |
| plan   | artifact | pending | -    | -        | -             | -          | -           |
| p03    | code     | pending | -    | -        | -             | -          | -           |
| p04    | code     | pending | -    | -        | -             | -          | -           |

Spec/design rows are retained template history; quick mode uses discovery and this plan only.

## Implementation Complete

Not started. Phase 1: 2 tasks; Phase 2: 2 tasks; Phase 3: 1 task; Phase 4: 1 task. **Total: 6 tasks, 0 complete.** Final acceptance/delivery remains mandatory after product phases.

## References

- [Discovery](discovery.md)
- [Backlog review](../../../repo/pjm/backlog/reviews/backlog-and-roadmap-review.md)
- Native schemas: `documentation/docs/engineering/architecture/session-schemas/`
- Retained structure research: `.oat/repo/reference/research/session-schemas-2026-09-18/`
- [BL-260919-stabilize-the-watcher-sigterm](../../../repo/pjm/backlog/items/BL-260919-stabilize-the-watcher-sigterm.md)
- [BL-260919-surface-terminally](../../../repo/pjm/backlog/items/BL-260919-surface-terminally.md)
- [BL-260919-skill-attribution-in-session](../../../repo/pjm/backlog/items/BL-260919-skill-attribution-in-session.md)
- [BL-260919-token-and-usage-accounting](../../../repo/pjm/backlog/items/BL-260919-token-and-usage-accounting.md)
- [BL-260919-uncapped-structured-activity](../../../repo/pjm/backlog/items/BL-260919-uncapped-structured-activity.md)
- [BL-260919-session-retro-consume-activity](../../../repo/pjm/backlog/items/BL-260919-session-retro-consume-activity.md)
