---
oat_status: in_progress
oat_ready_for: null
oat_blockers: []
oat_last_updated: 2026-09-18
oat_phase: plan
oat_phase_status: in_progress
oat_plan_parallel_groups: []
oat_plan_source: quick
oat_generated: false
oat_template: false
---

# Implementation Plan: session-fidelity

> Execute with `oat-project-implement` after the plan reviews and dispatch/gate setup are complete. This is a draft, not an implementation-ready handoff.

**Goal:** expose trustworthy opt-in activity in observer/exporter, and correct native Codex session selection and unsafe cursor reuse.

**Architecture:** shared detailed reading, native extraction, exact correlation, range selection and bounded projection; consumers own delivery and rendering. Existing default conversation behavior remains intact, except the explicitly authorized identity correction.

**Tech stack:** dependency-free Node >=22 TypeScript runtime; pnpm, Vitest, esbuild, oxlint/oxfmt as development tooling.

## Delivery and existing work

The user selected `gh stack` in this order:

1. **Schema documentation:** existing commit `c970c876`, with native schema pages, dated evidence, navigation, inventory script and privacy canaries. This is completed preparatory work, not a pending implementation task.
2. **Identity/cursor correction:** phase p01; independently buildable and reviewable.
3. **Activity support:** phases p02–p06; depends on the identity layer.

Before source implementation, the root must arrange these local layers using `gh-stack` and verify `gh stack view --json`. The docs commit currently follows OAT planning commits on `session-fidelity`; preserve that history through recoverable refs when arranging layers and keep each PR's diff scoped to its concern. Place project planning artifacts in the top activity layer; preserve layer-local validation evidence with its code. Use distinct branch names without a `session-fidelity/` prefix while the `session-fidelity` branch exists. Do not create hidden worktrees. Publication, merge, installation and live provider execution are outside this planning invocation.

Record each code layer's exact base as `IDENTITY_BASE` or `ACTIVITY_BASE` in implementation evidence before changing it; use that actual ref for version validation. These names below are shell variables bound to those verified refs, never guessed placeholders. No source changes have been implemented.

## Parallelism

`oat_plan_parallel_groups: []`. p01 establishes identity for every later consumer. p02 establishes the activity contract. p03/p04/p05 share transcript imports, version fan-out, generated bundles and regression coverage; their changes are intentionally serial even where individual authored modules differ. p06 validates the integrated result. Bounded read-only review can run concurrently; file mutation remains owned by one implementation phase.

## Task execution contract

Before source/tests read `src/AGENTS.md`; before tooling read the generated-runtime architecture contract; before docs read `documentation/AGENTS.md`. Never hand-edit `skills/`, generated plugin skill payloads or provider mirrors.

Each task below defines its authored files, behavior and verification. Test behavioral changes with a focused failing regression, implement, then rerun the named check. Keep fixtures synthetic or reviewed/redacted, with provenance in their README. No real sessions, command bodies, private names or raw locators enter tracked fixtures. Existing captured schemas establish shape, not universal provider behavior.

**Format every task:** run `pnpm exec oxfmt --write` with only that task's changed authored TypeScript/JavaScript/JSON/Markdown paths. Then run `pnpm exec oxlint` with only its changed authored TypeScript/JavaScript paths (omit when none). Never pass generated outputs, AGENTS files or the whole repository. For ignored OAT artifacts, use a temporary copy of `.oxfmtrc.json` removing only the `.oat/**` ignore, then run `pnpm exec oxfmt --write --config <temporary-config>` on the explicit project paths; delete the temporary config afterwards.

**Generated outputs and versions:** any changed canonical skill directory requires its `metadata.version` increase and matching Unreleased changelog entry. Build with `pnpm run build` before CLI tests because they execute generated entrypoints. Inspect the generated diff for transitive consumers of changed shared modules and bump every affected skill owner before the layer is complete. Include the corresponding generated outputs in the same task commit when they change; do not install the branch globally. Never replace a whole plugin root.

**Commit every task:** stage only the named authored changes, necessary version/changelog updates and their owned generated outputs; use the exact Conventional Commit message listed. Record task results and commit in `implementation.md`. The listed commands are planned checks, not current pass claims.

## Phase 1: Native identity and safe state binding

**Layer:** identity. **Depends on:** committed schema documentation and locally arranged stack.

### Task p01-t01: Resolve native Codex identity and lineage

**Files:** `src/shared/transcript/runtimes.ts`, `runtimes.test.ts`; new reviewed fixtures under `src/shared/transcript/fixtures/session-fidelity/codex/` with a provenance README.

**Implement:** Use the first physical session_meta payload.id, corroborated by a recognized rollout filename UUID. Keep root and parent lineage distinct; accept inherited parent headers later in the file. Preserve documented older shapes. Cover root/child, fork, duplicate sources, filename conflict, repeated parent header and independent call/message IDs. Do not infer child identity from nickname or recency.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/runtimes.test.ts`; assert first-header identity and explicit contradictory-evidence failures.

**Commit:** `fix(p01-t01): preserve native Codex thread identity`.

### Task p01-t02: Propagate exact identity through discovery and consumers

**Files:** `src/skills/session-observer/src/lib/locate.ts`, `rank.ts`, `types.ts`, `observe.ts`, `digest.ts`, `session-observer.ts`; observer `locate.test.ts`, `rank.test.ts`, `cli-session-override.test.ts`; exporter `src/session-export-transcript.ts`, `src/cli.test.ts` if identity metadata needs adaptation.

**Implement:** Invalidate/revalidate stale root-to-child cache mappings using native evidence. Explicit native pins select exactly one canonical file or report ambiguity; unpinned cwd lookup prefers roots while listing labelled children. Carry identity through whoami, digest and export metadata. Child digests/exports warn about inherited parent context even without activity, giving the ordinal boundary or unknown ownership; keep conversation entries intact. Fixture parent/child mtimes must prove an exact pin cannot change source when a child is newer.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/locate.test.ts src/skills/session-observer/src/rank.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/cli-session-override.test.ts src/skills/session-export-transcript/src/cli.test.ts`.

**Commit:** `fix(p01-t02): bind discovery and exact pins to native sessions`.

### Task p01-t03: Reject unsafe saved positions and watcher path changes

**Files:** `src/skills/session-observer/src/lib/state.ts`, `observe.ts`, `watch.ts`, `watch-state.ts`; `state.test.ts`, `observe.test.ts`, `watch.test.ts`, `watch-state.test.ts`; affected collab source/tests only if the corrected observer contract requires them.

**Implement:** Use the Codex first-header validator only for Codex; retain Claude session identity and Cursor source/frame continuity checks. Validate saved transcriptPath against the native pin and selected canonical path before nonzero reuse. Preserve valid legacy offsets. Missing/mismatched legacy bindings require explicit scoped reset; fresh zero state can bind. Watch mismatch emits one error to stdout, exits nonzero and leaves offsets unchanged. Ensure leases against mislabelled files fail closed and require owner re-arm. Cover mixed old/new writers, source replacement, ambiguity, shrink, review versus mark-read and no unrelated reset. Introduce no state schema, marker or receipt.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/state.test.ts src/skills/session-observer/src/observe.test.ts src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/watch-state.test.ts src/skills/session-observer-collab/src`; compare state bytes before/after failed delivery.

**Commit:** `fix(p01-t03): guard saved cursors against source identity changes`.

### Task p01-t04: Finalize and validate the identity layer

**Files:** Affected canonical skill `SKILL.md` versions and generated distributions; `CHANGELOG.md`; `documentation/docs/user-guide/skills/session-observer.md`; observer reference guidance and collab recovery guidance where changed.

**Implement:** Document intentional selection changes and exact scoped reset/re-arm behavior. Determine shared-runtime version fan-out from actual bundle diffs. Keep docs accurate to tested behavior. Root reviews the identity layer before activity work; do not merge or publish automatically.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run type-check`, `pnpm run build`, `pnpm run build:check`, `pnpm run test`, `pnpm run validate`, `pnpm run smoke`, and `pnpm run validate:skill-versions -- --base-ref "$IDENTITY_BASE"`; build docs with `pnpm --dir documentation build` if changed, checking `.oat/config.json` for the known generator side effect.

**Commit:** `docs(p01-t04): finalize native identity recovery and distributions`.

## Phase 2: Detailed reads and shared activity contract

**Layer:** activity. **Depends on:** p01. Establish a fresh `ACTIVITY_BASE` before this layer.

### Task p02-t01: Add LF-only detailed source reading and captured fixtures

**Files:** `src/shared/transcript/runtimes.ts`, `runtimes.test.ts`; new `src/shared/transcript/fixtures/session-fidelity/{claude-code,codex,cursor}/` plus README; `scripts/session-schema-inventory.mjs` and colocated canary test if promoting the snapshot tooling.

**Implement:** Return detailed records with byte ranges, physical lines, unchanged logical decoded indices and diagnostics while preserving readRecords output/warnings. First regression includes U+2028/U+2029 within strings, escaped carriage return, CRLF, blanks, malformed interior, valid no-newline and partial tail. Record the sampled shape/version and sanitization review for fixtures; do not copy whole sessions. Promote the inventory workflow as development tooling without modifying the historical snapshot or introducing runtime dependencies; preserve explicit allowlist mode, opaque data maps and omission diagnostics.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/runtimes.test.ts`; `node --test scripts/session-schema-inventory.canary.test.mjs` if promoted; `pnpm run type-check`. Compare legacy decoded records and warnings byte-for-byte against pre-change expectations.

**Commit:** `feat(p02-t01): add detailed transcript provenance and schema fixtures`.

### Task p02-t02: Extract native Claude and Codex activity

**Files:** New `src/shared/transcript/activity/types.ts`, `extract.ts`, `claude-code.ts`, `codex.ts`, `extract.test.ts`; fixture README and focused fixtures.

**Implement:** Implement versioned source-attributed events, metadata, coverage and diagnostics. Cover Claude multiblock calls/results, top-level toolUseResult string/array/object, unread persisted output, origin.kind task notifications, exact message-ID usage deduplication, empty errors and absent-error unknowns. Cover Codex function/custom/web-search carriers and item_completed evidence; native child IDs, statuses, compaction and output cap warnings. Exclude reasoning/instruction bodies. Preserve raw native arguments internally before presentation budgets. Per-record extraction failures degrade narrowly with ACTIVITY_EXTRACTION_ERROR; core reads and identity failures still fail closed.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/extract.test.ts`; `pnpm run type-check`. Assert no sidecar read or provider execution occurs.

**Commit:** `feat(p02-t02): extract source-attributed Claude and Codex activity`.

### Task p02-t03: Correlate calls and classify ownership without guessing

**Files:** New `src/shared/transcript/activity/correlate.ts`, `classify.ts`, `correlate.test.ts`; shared activity types/extractors.

**Implement:** Pair only explicit native IDs in the same source scope; preserve repeated calls, ambiguous reuse, unmatched/multiple outputs and independent poll invocations. Inherited ordinal ranges are excluded from child invocation counts; absent/conflicting boundaries remain unknown. Cross-stream item outcomes remain standalone unless corroborated IDs link them. An optional turn/ordinal candidate relation is explicitly inferred and cannot set canonical call outcome. Process handles establish pending evidence, not success. Response-stream call counts and standalone item evidence counts remain separate.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/correlate.test.ts src/shared/transcript/activity/extract.test.ts`; include late results, duplicates, process polls, inherited records and cross-stream ID nonmatches.

**Commit:** `feat(p02-t03): correlate activity with explicit evidence and ownership`.

### Task p02-t04: Project bounded activity reports

**Files:** New `src/shared/transcript/activity/project.ts`, `render.ts`, `index.ts`, `project.test.ts`; shared activity types.

**Implement:** Project existing delivery ranges with 32KiB/80-invocation watch/catch-up and 128KiB/1024-invocation review caps. Export has no total invocation cap but a 64MiB activity-section safety cap and 2KiB input/output previews per invocation, with size/omission notices in the header. Budget all serialized activity overhead; prioritize failures by invocation group then render chronologically. Standalone failed item events and their explicitly inferred candidate groups get failure priority without setting a call’s canonical outcome. Test a late item-only Codex failure under a tight cap, including unmatched and ambiguous cases. Late results receive at most 256 UTF-8 bytes of out-of-range call context, excluded from counts. Preserve actual available tails, explicit omissions, source locators, separate count scopes and escaped/control-safe output. Tiny budgets remain bounded and diagnostic, never malformed JSON.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/project.test.ts`; assert UTF-8 byte size, deterministic serialization, failure retention, late-result context and independent conversation budget.

**Commit:** `feat(p02-t04): project bounded activity with honest omission counts`.

## Phase 3: Observer activity delivery

**Layer:** activity. **Depends on:** p02.

### Task p03-t01: Expose activity in observer review and catch-up

**Files:** `src/skills/session-observer/src/session-observer.ts`, `lib/types.ts`, `lib/digest.ts`, `lib/observe.ts`; `cli.test.ts`, `digest.test.ts`, `observe.test.ts`.

**Implement:** Parse --include-activity and reuse one captured decoded read for conversation/activity. Add the optional activity object without changing outer digest v1/v2. Correlate whole captured source, select delivered range, render mode-specific limits. Preserve default JSON/text and legacy flags where present, except authorized identity behavior. Stateless review does not move state; mark-read follows existing writes. Whole optional extraction failure preserves conversation with explicit unavailable coverage.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/cli.test.ts src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/observe.test.ts`; compare no-flag output against existing golden behavior.

**Commit:** `feat(p03-t01): expose opt-in activity in observer digests`.

### Task p03-t02: Deliver activity-only watch deltas safely

**Files:** `src/skills/session-observer/src/lib/watch.ts`, `watch-state.ts`, `observe.ts`, `types.ts`; `watch.test.ts`, `watch-state.test.ts`, `integration.test.ts`.

**Implement:** Emit activityOnly when no conversation content is new; quiet-empty must retain activity or new coverage. Deduplicate diagnostics by source change without new persistent activity state. Existing cursor/write path governs advancement even when display is truncated; turning the flag on does not replay consumed history. Preserve stdout delivery-before-write failures and metadata-only event logs. Never enable activity on collaboration watchers or let it authorize a wake.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/watch.test.ts src/skills/session-observer/src/watch-state.test.ts src/skills/session-observer/src/integration.test.ts src/skills/session-observer-collab/src`; assert logs contain no transcript/activity content.

**Commit:** `feat(p03-t02): deliver activity-only watch updates without cursor drift`.

## Phase 4: Markdown exporter activity

**Layer:** activity. **Depends on:** shared contract and p03 integrated behavior.

### Task p04-t01: Add opt-in activity to Markdown export

**Files:** `src/skills/session-export-transcript/src/session-export-transcript.ts`, `src/cli.test.ts`; shared activity renderer; new exporter activity fixtures if needed.

**Implement:** Parse --include-activity, reuse the captured read, and append source-attributed activity with the export preview policy. Keep the exporter Markdown-only and stateless. Label activity/debug content and coverage, retain exact names/raw carriers only through bounded previews, and report external results/children as unread. Preserve source order and logical-to-physical locators without claiming a public range-selection flag.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-export-transcript/src/cli.test.ts src/shared/transcript/activity/project.test.ts`; verify exported activity counts/previews and no observer state mutation.

**Commit:** `feat(p04-t01): export bounded source-attributed activity`.

### Task p04-t02: Protect default sanitization and content boundaries

**Files:** `src/skills/session-export-transcript/src/cli.test.ts`, `src/sanitize.test.ts`, `src/fixtures/`; shared projection tests where output escaping is shared.

**Implement:** Prove no-flag exports retain current sanitizer behavior and activity flag does not implicitly enable instruction bodies, reasoning, or hidden payloads. Recorded prompt/tool content remains data; escape Markdown structure/control sequences without suppressing declared activity evidence. Exercise malicious-looking tool text, secret-like synthetic strings, oversized output and unavailable tails. Do not describe opt-in output as publish-safe or alter default redaction policy.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-export-transcript/src/cli.test.ts src/skills/session-export-transcript/src/sanitize.test.ts`; `pnpm run type-check`.

**Commit:** `test(p04-t02): protect export sanitization and activity boundaries`.

## Phase 5: Cursor terminal-settled activity

**Layer:** activity. **Depends on:** p02–p04. Uses existing frame analysis and terminal checkpoints.

### Task p05-t01: Extract stable Cursor call evidence

**Files:** New `src/shared/transcript/activity/cursor.ts`, `cursor.test.ts`; `src/shared/transcript/cursor-analysis.ts` only for necessary additive accessors; existing Cursor fixtures and shared activity contract.

**Implement:** Use frame/block positional identity and terminal lifecycle. Expose calls only where recorded; do not invent IDs, results, client version, usage, per-call success or cancellation support from sample absence. Terminal error/abort is a turn outcome, not each call outcome. Defer open-turn activity in stateful delivery; stateless review/export includes valid open-frame calls as pending-lifecycle with separate pending counts and snapshot-scoped positional identity. Cover grow-in-place, repairs, safe prefix, malformed/replaced frames and source/delivery coordinate separation.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run test:vitest src/shared/transcript/activity/cursor.test.ts src/shared/transcript/cursor-analysis.test.ts src/shared/transcript/cursor-frames.test.ts src/shared/transcript/cursor-fixtures.test.ts`.

**Commit:** `feat(p05-t01): extract Cursor activity from settled frame evidence`.

### Task p05-t02: Integrate Cursor settlement with observer and export

**Files:** `src/skills/session-observer/src/lib/digest.ts`, `observe.ts`, `cursor-state.ts`, `watch.ts`; observer `digest.test.ts`, `cursor-state.test.ts`, `watch.test.ts`; exporter entrypoint/CLI tests.

**Implement:** Use previous/new terminal checkpoints to select settled activity, distinct from the conversation delivery range. A previously observed open turn settling emits one activity-only delta; read both checkpoints before the existing atomic update. No new receipt/schema/cursor is introduced. Flag-off settlement is not replayed later; review/export can recover it statelessly. Preserve early conversation delivery and strict collaboration confirmed-completion gating, including unsuccessful terminals.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, then `pnpm run test:vitest src/skills/session-observer/src/digest.test.ts src/skills/session-observer/src/cursor-state.test.ts src/skills/session-observer/src/watch.test.ts src/skills/session-export-transcript/src/cli.test.ts src/skills/session-observer-collab/src`; assert no duplicate invocations across polls.

**Commit:** `feat(p05-t02): deliver Cursor activity through terminal checkpoints`.

## Phase 6: Documentation, distribution and acceptance

**Layer:** activity. **Depends on:** all feature phases.

### Task p06-t01: Document and build the tested feature

**Files:** `src/skills/session-observer/SKILL.md`, `src/skills/session-export-transcript/SKILL.md`, their transcript references; `documentation/docs/user-guide/skills/session-observer.md`, `session-export-transcript.md`; `documentation/docs/engineering/architecture/transcript-core.md`, schema pages where parser support is now proven; affected canonical versions, `CHANGELOG.md`, generated outputs.

**Implement:** Document flags, budgets, unavailable/unread evidence, late call context, Cursor settlement and retrospective review. Keep existing native-format sample qualifiers. Inspect transitive generated changes and version all affected owners; include new runtime files through existing import closure, changing build declarations only if necessary. Check navigation/local maps when adding pages. Do not edit the dated research snapshot to reflect new behavior.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run build`, `pnpm run build:check`, `pnpm run validate:skill-versions -- --base-ref "$ACTIVITY_BASE"`, and `pnpm --dir documentation build`; check `.oat/config.json` before/after documentation generation and restore only a proven command side effect without discarding other work.

**Commit:** `docs(p06-t01): document and package opt-in session activity`.

### Task p06-t02: Verify acceptance and close tracked work

**Files:** Project `implementation.md` and review records; `.oat/repo/pjm/backlog/` lifecycle outputs and `.oat/repo/pjm/current-state.md` only after acceptance; related project summary when lifecycle completion occurs.

**Implement:** Run the complete mocked/local acceptance suite, review both stack deltas, confirm no missing canonical/generated files and no raw session data. Complete required code/gate reviews through their lifecycle; record actual evidence. Close/archive BL-260916-session-fidelity-opt only when every criterion passes, following PJM guidance and doctor adoption check. Do not label live provider support, PR publication, merge or installation complete. Do not archive project artifacts prematurely while review/delivery remains outstanding.

**Format:** follow the file-scoped task execution contract above.

**Verify:** `pnpm run type-check`, `pnpm run build:check`, `pnpm run test`, `pnpm run validate`, `pnpm run smoke`, `pnpm run validate:skill-versions -- --base-ref "$ACTIVITY_BASE"`, `git diff --check`, and changed-authored-file lint/format checks; `oat pjm doctor --json` before PJM writes. Run the full suite after the final source changes, not repeatedly without cause.

**Commit:** `chore(p06-t02): record session fidelity acceptance and backlog completion`.

## Reviews

Existing pending scaffold rows are preserved. Quick mode has no spec; that legacy placeholder does not imply a missing spec requirement. The design self-review and Fable collaboration are distinct from the formal plan artifact review below.

| Scope  | Type     | Status  | Date | Artifact | Reviewed Head | Invocation | Gate Target |
| ------ | -------- | ------- | ---- | -------- | ------------- | ---------- | ----------- |
| p01    | code     | pending | -    | -        | -             | -          | -           |
| p02    | code     | pending | -    | -        | -             | -          | -           |
| final  | code     | pending | -    | -        | -             | -          | -           |
| spec   | artifact | pending | -    | -        | -             | -          | -           |
| design | artifact | pending | -    | -        | -             | -          | -           |
| p03    | code     | pending | -    | -        | -             | -          | -           |
| p04    | code     | pending | -    | -        | -             | -          | -           |
| p05    | code     | pending | -    | -        | -             | -          | -           |
| p06    | code     | pending | -    | -        | -             | -          | -           |
| plan   | artifact | pending | -    | -        | -             | -          | -           |

Before readiness: resolve project dispatch policy; finish phase/lifecycle gate choices; incorporate Fable's read-back; run the configured structured plan review and quick-start gate with the complete discovery/design/plan bundle. Pending gates are not passed by the documentation build or peer silence.

## Implementation Complete

**Planned total:** 6 phases, 16 tasks; 0 implemented.

- p01: 4 tasks — native identity and safe state binding.
- p02: 4 tasks — detailed reads and shared activity contract.
- p03: 2 tasks — observer integration.
- p04: 2 tasks — exporter integration and sanitization.
- p05: 2 tasks — Cursor settlement.
- p06: 2 tasks — docs/distribution and acceptance.

The schema documentation preparatory commit is complete separately. No feature implementation, review approval, stack publication, merge or installation is claimed.

## References

- [Discovery](discovery.md)
- [Design](design.md)
- [Collaboration summary](references/collaboration-summary.md)
- [Native schema reference](../../../../documentation/docs/engineering/architecture/session-schemas/index.md)
- [Dated evidence snapshot](../../../repo/reference/research/session-schemas-2026-09-18/README.md)
- [Backlog brief](../../../repo/pjm/backlog/items/BL-260916-session-fidelity-opt.md)
